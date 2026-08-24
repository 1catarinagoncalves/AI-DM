import { describe, it, expect } from 'vitest'
import { NotFoundException } from '@nestjs/common'
import type { SystemConfig } from '@ai-dm/shared'
import { CharacterService } from './character.service'
import type { PrismaService } from '../prisma.service'

// Test double mínimo do PrismaService: só os métodos que CharacterService.create chama.
// `as unknown as PrismaService` porque o double não implementa PrismaClient inteiro.
//
// US-99: `configLocales` entra no double porque a criação resolve o config pelo locale do
// dono (`user.findUnique`). Sem localização, `configForLocale` cai na base — que é o `config`.
function fakePrisma(config: SystemConfig | null, locale = 'pt-BR', configLocales: Record<string, SystemConfig> = {}): PrismaService {
  return {
    user: { findUnique: async () => ({ locale }) },
    system: { findMany: async () => [{ id: 'sys-test', config, configLocales }] },
    character: { create: async ({ data }: { data: Record<string, unknown> }) => ({ id: 'char-1', ...data }) },
  } as unknown as PrismaService
}

const config: SystemConfig = {
  attributes: [
    { key: 'cool', label: 'Cool', min: 1, max: 10, default: 5 },
    { key: 'hard', label: 'Hard', min: 1, max: 10, default: 5 },
  ],
  startingKits: { default: [{ name: 'Adaga', qty: 1 }] },
}

// Double do Prisma para findAllByUser: devolve os personagens que a query "encontraria".
// US-105: o hub resolve o rótulo de raça/classe, logo precisa do locale do dono e do config.
function fakePrismaList(characters: unknown[], locale = 'pt-BR'): PrismaService {
  return {
    user: { findUnique: async () => ({ locale }) },
    character: { findMany: async () => characters },
    system: { findMany: async () => [{ id: 'sys-1', ...systemRow }] },
  } as unknown as PrismaService
}

// US-105: catálogo do sistema nos dois locales — a base é EN, a localização vive em configLocales.
const catalogEn: SystemConfig = {
  ...config,
  races: [{ key: 'dwarf', label: 'Dwarf' }, { key: 'elf', label: 'Elf' }],
  classes: [{ key: 'fighter', label: 'Fighter' }, { key: 'wizard', label: 'Wizard' }],
}
const catalogPt: SystemConfig = {
  ...config,
  races: [{ key: 'dwarf', label: 'Anão' }, { key: 'elf', label: 'Elfo' }],
  classes: [{ key: 'fighter', label: 'Guerreiro' }, { key: 'wizard', label: 'Mago' }],
}
const systemRow = { config: catalogEn, configLocales: { 'pt-BR': catalogPt } }

describe('CharacterService.findAllByUser (US-25)', () => {
  it('embute currentAdventure da participação ACTIVE e ordena por último jogado', async () => {
    const service = new CharacterService(fakePrismaList([
      {
        id: 'char-old', name: 'Antigo', race: 'dwarf', class: 'fighter', level: 2, createdAt: new Date('2020-01-01'),
        systemId: 'sys-1',
        states: [{ updatedAt: new Date('2026-01-01') }],
        participations: [],
      },
      {
        id: 'char-new', name: 'Lyra', race: 'elf', class: 'wizard', level: 1, createdAt: new Date('2020-02-01'),
        systemId: 'sys-1',
        states: [{ updatedAt: new Date('2026-06-01') }],
        participations: [{ adventure: { id: 'adv-1', title: 'A Mina Perdida' } }],
      },
    ]))

    const list = await service.findAllByUser('u1')

    const [first, second] = list
    // último jogado (char-new, updatedAt mais recente) primeiro
    expect(list.map((c) => c.id)).toEqual(['char-new', 'char-old'])
    expect(first!.currentAdventure).toEqual({ id: 'adv-1', title: 'A Mina Perdida' })
    expect(second!.currentAdventure).toBeNull()
    // não vaza a chave interna de ordenação
    expect('_lastPlayed' in first!).toBe(false)
  })

  // US-105: o hub guarda chave e exibe rótulo. O par de testes falha se ele voltar a servir
  // a chave crua, ou se ignorar o locale do dono.
  it('o hub devolve o rótulo no locale do dono, não a chave', async () => {
    const rows = [{
      id: 'c1', name: 'Lyra', race: 'dwarf', class: 'wizard', level: 1, createdAt: new Date('2020-01-01'),
      systemId: 'sys-1', states: [], participations: [],
    }]
    const ptList = await new CharacterService(fakePrismaList(rows, 'pt-BR')).findAllByUser('u1')
    expect([ptList[0]!.race, ptList[0]!.class]).toEqual(['Anão', 'Mago'])

    const enList = await new CharacterService(fakePrismaList(rows, 'en-US')).findAllByUser('u1')
    expect([enList[0]!.race, enList[0]!.class]).toEqual(['Dwarf', 'Wizard'])
  })

  it('devolve [] para usuário sem personagens', async () => {
    const service = new CharacterService(fakePrismaList([]))
    expect(await service.findAllByUser('u1')).toEqual([])
  })
})

// Double do Prisma para remove: $transaction roda o callback com um tx que registra os deletes.
function fakePrismaRemove(character: unknown, adventureId = 'adv-1') {
  const deletes: string[] = []
  const tx = {
    character: {
      findUnique: async () => character,
      delete: async () => character,
    },
    adventureParticipant: {
      findMany: async () => (character ? [{ adventureId }] : []),
      deleteMany: async () => { deletes.push('adventureParticipant'); return { count: 1 } },
    },
    characterState: {
      findMany: async () => (character ? [{ adventureId }] : []),
      deleteMany: async () => { deletes.push('characterState'); return { count: 1 } },
    },
    eventLog: { deleteMany: async () => { deletes.push('eventLog'); return { count: 1 } } },
    quest: { deleteMany: async () => { deletes.push('quest'); return { count: 1 } } },
    adventure: { deleteMany: async () => { deletes.push('adventure'); return { count: 1 } } },
  }
  const prisma = {
    $transaction: (fn: (t: typeof tx) => unknown) => fn(tx),
  } as unknown as PrismaService
  return { prisma, deletes }
}

describe('CharacterService.remove (US-30)', () => {
  it('apaga aventuras e dependentes antes do personagem (ordem: filhos → aventura → personagem)', async () => {
    const { prisma, deletes } = fakePrismaRemove({ id: 'char-1', name: 'Lyra' })
    const service = new CharacterService(prisma)

    const removed = await service.remove('char-1')

    expect(removed).toEqual({ id: 'char-1', name: 'Lyra' })
    // filhos da aventura antes da aventura; aventura antes do delete final do personagem
    expect(deletes.indexOf('adventure')).toBeGreaterThan(deletes.indexOf('eventLog'))
    expect(deletes.indexOf('adventure')).toBeGreaterThan(deletes.indexOf('adventureParticipant'))
    expect(deletes).toContain('quest')
    expect(deletes).toContain('characterState')
  })

  it('id inexistente → NotFoundException (404)', async () => {
    const { prisma } = fakePrismaRemove(null)
    const service = new CharacterService(prisma)
    await expect(service.remove('nope')).rejects.toThrow('não encontrado')
  })
})

describe('CharacterService.create', () => {
  it('valida os atributos contra o config do sistema e persiste', async () => {
    const service = new CharacterService(fakePrisma(config))
    const char = await service.create({
      userId: 'u1', systemId: 'sys-test', name: 'Test', gender: 'x', race: 'x', class: 'x',
      attributes: { cool: 8, hard: 3 },
    })
    expect(char.baseAttributes).toEqual({ cool: 8, hard: 3 })
  })

  it('rejeita atributo fora do config do sistema (ex.: strength)', async () => {
    const service = new CharacterService(fakePrisma(config))
    await expect(service.create({
      userId: 'u1', systemId: 'sys-test', name: 'Test', gender: 'x', race: 'x', class: 'x',
      attributes: { cool: 8, hard: 3, strength: 10 },
    })).rejects.toThrow()
  })

  // O systemId vem do DTO do cliente, não de FK — id inexistente é erro DELE, 404,
  // e não pode virar 500 por a busca ter passado a sair da cache da tabela.
  it('systemId inexistente continua 404, com o valor ofensor na mensagem', async () => {
    const service = new CharacterService(fakePrisma(config))
    await expect(service.create({
      userId: 'u1', systemId: 'sys-pathfinder', name: 'Test', gender: 'x', race: 'x', class: 'x',
      attributes: { cool: 8, hard: 3 },
    })).rejects.toThrow(new NotFoundException('Sistema sys-pathfinder não encontrado'))
  })

  // Regressão do consumo da Neon: o SRD (~200KB/linha) não pode reviajar a rede a cada ficha.
  it('duas criações seguidas não repetem a busca do sistema', async () => {
    let calls = 0
    const prisma = {
      user: { findUnique: async () => ({ locale: 'pt-BR' }) },
      system: {
        findMany: async () => {
          calls++
          return [{ id: 'sys-test', config, configLocales: {} }]
        },
      },
      character: { create: async ({ data }: { data: Record<string, unknown> }) => ({ id: 'char-1', ...data }) },
    } as unknown as PrismaService
    const service = new CharacterService(prisma)
    const dto = { userId: 'u1', systemId: 'sys-test', name: 'Test', gender: 'x', race: 'x', class: 'x', attributes: { cool: 8, hard: 3 } }

    await service.create(dto)
    await service.create(dto)

    expect(calls).toBe(1)
  })

  it('rejeita criação quando o sistema não tem config', async () => {
    const service = new CharacterService(fakePrisma(null))
    await expect(service.create({
      userId: 'u1', systemId: 'sys-test', name: 'Test', gender: 'x', race: 'x', class: 'x',
      attributes: { cool: 8 },
    })).rejects.toThrow()
  })

  // US-27: perícias proficientes validadas contra config.skills + proficiency.choices.
  const configWithSkills: SystemConfig = {
    ...config,
    skills: [
      { key: 'athletics', label: 'Atletismo', ability: 'cool' },
      { key: 'stealth', label: 'Furtividade', ability: 'hard' },
      { key: 'perception', label: 'Percepção', ability: 'hard' },
    ],
    proficiency: { choices: 2, bonus: 2 },
  }

  it('persiste exatamente as perícias proficientes escolhidas', async () => {
    const service = new CharacterService(fakePrisma(configWithSkills))
    const char = await service.create({
      userId: 'u1', systemId: 'sys-test', name: 'Test', gender: 'x', race: 'x', class: 'x',
      attributes: { cool: 5, hard: 5 }, skills: ['athletics', 'perception'],
    })
    expect(char.skills).toEqual(['athletics', 'perception'])
  })

  it('rejeita número errado de perícias', async () => {
    const service = new CharacterService(fakePrisma(configWithSkills))
    await expect(service.create({
      userId: 'u1', systemId: 'sys-test', name: 'Test', gender: 'x', race: 'x', class: 'x',
      attributes: { cool: 5, hard: 5 }, skills: ['athletics'],
    })).rejects.toThrow('exatamente 2')
  })

  it('rejeita perícia fora do catálogo', async () => {
    const service = new CharacterService(fakePrisma(configWithSkills))
    await expect(service.create({
      userId: 'u1', systemId: 'sys-test', name: 'Test', gender: 'x', race: 'x', class: 'x',
      attributes: { cool: 5, hard: 5 }, skills: ['athletics', 'flying'],
    })).rejects.toThrow('inválida')
  })

  // US-39: background normalizado — trima a prosa, filtra strings vazias, descarta campos vazios.
  it('normaliza e persiste o background', async () => {
    const service = new CharacterService(fakePrisma(config))
    const char = await service.create({
      userId: 'u1', systemId: 'sys-test', name: 'Test', gender: 'x', race: 'x', class: 'x',
      attributes: { cool: 5, hard: 5 },
      background: { story: '  Nobre caída  ', ideals: ['Justiça', '  '], bonds: [], flaws: ['Não mente'] },
    })
    expect(char.background).toEqual({ story: 'Nobre caída', ideals: ['Justiça'], flaws: ['Não mente'] })
  })

  // US-41: features de classe materializadas do kit na criação (mesmo caminho do inventário).
  const configWithFeatures: SystemConfig = {
    ...config,
    classFeatures: {
      paladin: [
        { key: 'paladin_divine-sense', source: 'authored', name: 'Sentido Divino', description: 'Sente o mal por perto.' },
        { key: 'paladin_lay-on-hands', source: 'srd', name: 'Impor as Mãos', description: 'Cura ao toque.' },
      ],
      default: [],
    },
  }

  // US-99: a base EN do mesmo sistema — o que o `ingest` grava sem overlay.
  const configWithFeaturesEn: SystemConfig = {
    ...config,
    classFeatures: {
      paladin: [
        { key: 'paladin_divine-sense', source: 'authored', name: 'Divine Sense', description: 'Senses evil nearby.' },
        { key: 'paladin_lay-on-hands', source: 'srd', name: 'Lay On Hands', description: 'Heals by touch.' },
      ],
      default: [],
    },
  }

  // US-100: a criação grava CHAVES. Nenhum `{name, description}` sai daqui — era o texto
  // materializado que prendia a ficha ao idioma de quem a criou.
  it('grava as CHAVES das features de nível 1 da classe, não o texto', async () => {
    const service = new CharacterService(fakePrisma(configWithFeatures))
    const char = await service.create({
      userId: 'u1', systemId: 'sys-test', name: 'Seraphine', gender: 'feminino', race: 'Humana', class: 'paladin',
      attributes: { cool: 5, hard: 5 },
    })
    expect(char.features).toEqual(['paladin_divine-sense', 'paladin_lay-on-hands'])
  })

  // US-99 tinha aqui um par de testes afirmando que a ficha NASCIA no idioma do dono (a criação
  // resolvia o locale e copiava o texto). A US-100 tirou o texto do meio: o que a ficha guarda é
  // idêntico nos dois locales, e quem escolhe o idioma é a LEITURA (resolveSheetEntries — o par
  // 'Fúria'/'Rage' vive em packages/shared/src/sheet.test.ts). Este teste é o inverso do antigo:
  // falha se a criação voltar a depender do locale.
  it('a ficha nasce IGUAL nos dois locales — a chave não tem idioma', async () => {
    const enService = new CharacterService(fakePrisma(configWithFeaturesEn, 'en-US', { 'pt-BR': configWithFeatures }))
    const ptService = new CharacterService(fakePrisma(configWithFeaturesEn, 'pt-BR', { 'pt-BR': configWithFeatures }))
    const dto = {
      userId: 'u1', systemId: 'sys-test', name: 'Seraphine', gender: 'feminino', race: 'Humana', class: 'paladin',
      attributes: { cool: 5, hard: 5 },
    }
    const [en, pt] = await Promise.all([enService.create(dto), ptService.create(dto)])
    expect(en.features).toEqual(['paladin_divine-sense', 'paladin_lay-on-hands'])
    expect(pt.features).toEqual(en.features)
  })

  it('classe sem kit de features → [] (sem crash)', async () => {
    const service = new CharacterService(fakePrisma(configWithFeatures))
    const char = await service.create({
      userId: 'u1', systemId: 'sys-test', name: 'Test', gender: 'x', race: 'x', class: 'ClasseCustom',
      attributes: { cool: 5, hard: 5 },
    })
    expect(char.features).toEqual([])
  })

  // US-139: Marshal — 13ª classe do catálogo (a5e-ag), primeira que não é uma das 12 do SRD.
  // Classe marcial, sem conjuração: `classSpells` não tem entrada `marshal` nenhuma (nem
  // `default` genérico) — cobre que `getClassSpells` não lança e devolve [] mesmo assim.
  const configWithMarshal: SystemConfig = {
    ...config,
    classes: [{ key: 'marshal', label: 'Marshal' }],
    classFeatures: {
      marshal: [
        { key: 'marshal_commanding-presence', source: 'a5e-ag', name: 'Commanding Presence', description: 'You have a Commanding Presence.' },
        { key: 'marshal_rallying-surge', source: 'a5e-ag', name: 'Rallying Surge', description: 'You can rally allies.' },
      ],
      default: [],
    },
  }

  it('cria personagem classe marshal (a5e-ag): features da classe, sem magia, sem lançar', async () => {
    const service = new CharacterService(fakePrisma(configWithMarshal))
    const char = await service.create({
      userId: 'u1', systemId: 'sys-test', name: 'Vasko', gender: 'x', race: 'x', class: 'marshal',
      attributes: { cool: 5, hard: 5 },
    })
    expect(char.class).toBe('marshal')
    expect(char.features).toEqual(['marshal_commanding-presence', 'marshal_rallying-surge'])
    expect(char.spells).toEqual([])
  })

  // --- US-105: raça e classe são CHAVE do catálogo, e o catálogo é FECHADO ---

  it('persiste a CHAVE de raça e classe, não o texto', async () => {
    const service = new CharacterService(fakePrisma(catalogPt))
    const char = await service.create({
      userId: 'u1', systemId: 'sys-test', name: 'Lyra', gender: 'x', race: 'dwarf', class: 'wizard',
      attributes: { cool: 5, hard: 5 },
    })
    expect([char.race, char.class]).toEqual(['dwarf', 'wizard'])
  })

  // Questões em aberto #2: não existe escape. Rótulo, chave inventada e texto legado são
  // todos "fora do catálogo" — e nenhum é gravado.
  it('rejeita raça ou classe fora do catálogo (sem chave `custom`, sem gravação)', async () => {
    const service = new CharacterService(fakePrisma(catalogPt))
    const base = { userId: 'u1', systemId: 'sys-test', name: 'Lyra', gender: 'x', attributes: { cool: 5, hard: 5 } }
    await expect(service.create({ ...base, race: 'Anão', class: 'wizard' })).rejects.toThrow('Raça inválida')
    await expect(service.create({ ...base, race: 'dwarf', class: 'Mago' })).rejects.toThrow('Classe inválida')
    await expect(service.create({ ...base, race: 'meio-elfo-do-norte', class: 'wizard' })).rejects.toThrow('Raça inválida')
  })

  // `races`/`classes` são opcionais no schema para não invalidar config legado — e um banco
  // ainda não re-semeado tem de continuar criando personagem.
  it('config sem catálogo aceita o valor como veio (compatibilidade)', async () => {
    const service = new CharacterService(fakePrisma(config))
    const char = await service.create({
      userId: 'u1', systemId: 'sys-test', name: 'Test', gender: 'x', race: 'Anão', class: 'Mago',
      attributes: { cool: 5, hard: 5 },
    })
    expect([char.race, char.class]).toEqual(['Anão', 'Mago'])
  })

  it('sistema sem classFeatures no config → features [] (sem crash)', async () => {
    const service = new CharacterService(fakePrisma(config))
    const char = await service.create({
      userId: 'u1', systemId: 'sys-test', name: 'Test', gender: 'x', race: 'x', class: 'paladin',
      attributes: { cool: 5, hard: 5 },
    })
    expect(char.features).toEqual([])
  })

  it('sem background → persiste {}', async () => {
    const service = new CharacterService(fakePrisma(config))
    const char = await service.create({
      userId: 'u1', systemId: 'sys-test', name: 'Test', gender: 'x', race: 'x', class: 'x',
      attributes: { cool: 5, hard: 5 },
    })
    expect(char.background).toEqual({})
  })

  // US-40: divindade normalizada — nome + portfolio trimados; sem nome, descartada.
  it('normaliza e persiste a divindade (nome + portfolio)', async () => {
    const service = new CharacterService(fakePrisma(config))
    const char = await service.create({
      userId: 'u1', systemId: 'sys-test', name: 'Test', gender: 'x', race: 'x', class: 'x',
      attributes: { cool: 5, hard: 5 },
      background: { deity: { name: '  Auril  ', portfolio: '  goddess of winter  ' } },
    })
    expect(char.background).toEqual({ deity: { name: 'Auril', portfolio: 'goddess of winter' } })
  })

  it('divindade sem portfolio → só o nome; sem nome → descartada', async () => {
    const service = new CharacterService(fakePrisma(config))
    const onlyName = await service.create({
      userId: 'u1', systemId: 'sys-test', name: 'Test', gender: 'x', race: 'x', class: 'x',
      attributes: { cool: 5, hard: 5 }, background: { deity: { name: 'Tymora' } },
    })
    expect(onlyName.background).toEqual({ deity: { name: 'Tymora' } })

    const noName = await service.create({
      userId: 'u1', systemId: 'sys-test', name: 'Test', gender: 'x', race: 'x', class: 'x',
      attributes: { cool: 5, hard: 5 }, background: { deity: { name: '  ', portfolio: 'x' } },
    })
    expect(noName.background).toEqual({})
  })

  // US-122: origem do catálogo de backgrounds (US-121) — campo IRMÃO de `background`,
  // nunca aninhado nele (ver US-122 §Nomenclatura).
  const configWithBackgrounds: SystemConfig = {
    ...config,
    backgrounds: [
      { key: 'a5e-ag_acolyte', name: 'Acolyte', source: 'a5e-ag', benefits: [
        { type: 'skill_proficiency', name: 'Religion', description: 'x' },
      ] },
    ],
  }

  it('persiste origin.key válido, sem tocar em background', async () => {
    const service = new CharacterService(fakePrisma(configWithBackgrounds))
    const char = await service.create({
      userId: 'u1', systemId: 'sys-test', name: 'Test', gender: 'x', race: 'x', class: 'x',
      attributes: { cool: 5, hard: 5 },
      origin: { key: 'a5e-ag_acolyte' },
      background: { story: 'Nobre caída' },
    })
    expect(char.origin).toEqual({ key: 'a5e-ag_acolyte' })
    expect(char.background).toEqual({ story: 'Nobre caída' })
  })

  it('rejeita origin.key fora do catálogo', async () => {
    const service = new CharacterService(fakePrisma(configWithBackgrounds))
    await expect(service.create({
      userId: 'u1', systemId: 'sys-test', name: 'Test', gender: 'x', race: 'x', class: 'x',
      attributes: { cool: 5, hard: 5 }, origin: { key: 'nope' },
    })).rejects.toThrow('Origem inválida')
  })

  it('sem origin (ou sistema sem config.backgrounds) → origin {}', async () => {
    const service = new CharacterService(fakePrisma(config))
    const char = await service.create({
      userId: 'u1', systemId: 'sys-test', name: 'Test', gender: 'x', race: 'x', class: 'x',
      attributes: { cool: 5, hard: 5 },
    })
    expect(char.origin).toEqual({})
  })

  // US-124: connection/memento viajam junto de origin.key, sem validação contra catálogo
  // (é a linha que o jogador escolheu no <select>, não uma chave).
  it('persiste origin.connection/memento junto com origin.key, trimados', async () => {
    const service = new CharacterService(fakePrisma(configWithBackgrounds))
    const char = await service.create({
      userId: 'u1', systemId: 'sys-test', name: 'Test', gender: 'x', race: 'x', class: 'x',
      attributes: { cool: 5, hard: 5 },
      origin: { key: 'a5e-ag_acolyte', connection: '  A beloved high priest.  ', memento: '  A prayer book.  ' },
    })
    expect(char.origin).toEqual({ key: 'a5e-ag_acolyte', connection: 'A beloved high priest.', memento: 'A prayer book.' })
  })

  it('connection/memento vazios ou ausentes → descartados, não gravados como string vazia', async () => {
    const service = new CharacterService(fakePrisma(configWithBackgrounds))
    const char = await service.create({
      userId: 'u1', systemId: 'sys-test', name: 'Test', gender: 'x', race: 'x', class: 'x',
      attributes: { cool: 5, hard: 5 },
      origin: { key: 'a5e-ag_acolyte', connection: '   ' },
    })
    expect(char.origin).toEqual({ key: 'a5e-ag_acolyte' })
  })

  // US-123: bônus de atributo do background (`grant.kind === 'ability'`) soma por cima do
  // point-buy. `fixed: 'cool'` (mapeado ao Wisdom do a5e-ag_acolyte real) sobre o config de
  // teste — o par [cool, hard] joga o papel de [wisdom, constitution] sem precisar do config real.
  const configWithAbilityGrant: SystemConfig = {
    ...config,
    backgrounds: [
      { key: 'a5e-ag_acolyte', name: 'Acolyte', source: 'a5e-ag', benefits: [
        { type: 'ability_score', name: 'Ability Score Increases', description: '+1 to Cool and one other ability score.', grant: { kind: 'ability', fixed: 'cool', freeCount: 1 } },
      ] },
    ],
  }

  it('aplica os dois +1 do background (fixo + escolhido) por cima do point-buy', async () => {
    const service = new CharacterService(fakePrisma(configWithAbilityGrant))
    const char = await service.create({
      userId: 'u1', systemId: 'sys-test', name: 'Test', gender: 'x', race: 'x', class: 'x',
      attributes: { cool: 5, hard: 5 },
      origin: { key: 'a5e-ag_acolyte', abilityChoice: 'hard' },
    })
    expect(char.baseAttributes).toEqual({ cool: 6, hard: 6 })
  })

  it('rejeita abilityChoice ausente quando o grant exige', async () => {
    const service = new CharacterService(fakePrisma(configWithAbilityGrant))
    await expect(service.create({
      userId: 'u1', systemId: 'sys-test', name: 'Test', gender: 'x', race: 'x', class: 'x',
      attributes: { cool: 5, hard: 5 }, origin: { key: 'a5e-ag_acolyte' },
    })).rejects.toThrow('abilityChoice inválido')
  })

  it('rejeita abilityChoice fora de config.attributes', async () => {
    const service = new CharacterService(fakePrisma(configWithAbilityGrant))
    await expect(service.create({
      userId: 'u1', systemId: 'sys-test', name: 'Test', gender: 'x', race: 'x', class: 'x',
      attributes: { cool: 5, hard: 5 }, origin: { key: 'a5e-ag_acolyte', abilityChoice: 'strength' },
    })).rejects.toThrow('abilityChoice inválido')
  })

  it('rejeita abilityChoice igual a grant.fixed (repetir o fixo não é "outro atributo")', async () => {
    const service = new CharacterService(fakePrisma(configWithAbilityGrant))
    await expect(service.create({
      userId: 'u1', systemId: 'sys-test', name: 'Test', gender: 'x', race: 'x', class: 'x',
      attributes: { cool: 5, hard: 5 }, origin: { key: 'a5e-ag_acolyte', abilityChoice: 'cool' },
    })).rejects.toThrow('abilityChoice inválido')
  })

  it('background sem grant.kind "ability" (ou sem origem) não exige abilityChoice', async () => {
    const service = new CharacterService(fakePrisma(configWithBackgrounds))
    const char = await service.create({
      userId: 'u1', systemId: 'sys-test', name: 'Test', gender: 'x', race: 'x', class: 'x',
      attributes: { cool: 5, hard: 5 }, origin: { key: 'a5e-ag_acolyte' },
    })
    expect(char.baseAttributes).toEqual({ cool: 5, hard: 5 })
  })

  // US-131: perícias do background (`grant.kind === 'skills'`) mescladas com as `choices` da
  // etapa `skills` — mesmo par find/apply de `abilityChoice` acima. `a5e-ag_acolyte` real:
  // Religion fixa + escolha Insight/Persuasion (US-131 §Critérios de aceite).
  const configWithSkillGrant: SystemConfig = {
    ...config,
    skills: [
      { key: 'religion', label: 'Religião', ability: 'cool' },
      { key: 'insight', label: 'Intuição', ability: 'hard' },
      { key: 'persuasion', label: 'Persuasão', ability: 'hard' },
      { key: 'athletics', label: 'Atletismo', ability: 'cool' },
    ],
    proficiency: { choices: 1, bonus: 2 },
    backgrounds: [
      { key: 'a5e-ag_acolyte', name: 'Acolyte', source: 'a5e-ag', benefits: [
        { type: 'skill_proficiency', name: 'Skill Proficiencies', description: 'Religion, and either Insight or Persuasion.', grant: { kind: 'skills', fixed: ['religion'], chooseFrom: ['insight', 'persuasion'], chooseCount: 1 } },
      ] },
    ],
  }

  // US-131 — critério de aceite: background `a5e-ag_acolyte` (skills fixas `Religion` +
  // escolha `Insight`/`Persuasion`) confere `skills` com `religion` + a escolhida, sem exigir
  // 3 perícias na etapa `skills` (só a `choices` do sistema, aqui 1).
  it('mescla as perícias do background (fixa + escolhida) com as `choices` da etapa skills', async () => {
    const service = new CharacterService(fakePrisma(configWithSkillGrant))
    const char = await service.create({
      userId: 'u1', systemId: 'sys-test', name: 'Test', gender: 'x', race: 'x', class: 'x',
      attributes: { cool: 5, hard: 5 }, skills: ['athletics'],
      origin: { key: 'a5e-ag_acolyte', skillChoice: ['insight'] },
    })
    expect(char.skills).toEqual(['religion', 'insight', 'athletics'])
  })

  it('rejeita skillChoice fora de grant.chooseFrom', async () => {
    const service = new CharacterService(fakePrisma(configWithSkillGrant))
    await expect(service.create({
      userId: 'u1', systemId: 'sys-test', name: 'Test', gender: 'x', race: 'x', class: 'x',
      attributes: { cool: 5, hard: 5 }, skills: ['athletics'],
      origin: { key: 'a5e-ag_acolyte', skillChoice: ['athletics'] },
    })).rejects.toThrow('skillChoice inválido')
  })

  it('rejeita skillChoice ausente quando o grant exige (chooseCount > 0)', async () => {
    const service = new CharacterService(fakePrisma(configWithSkillGrant))
    await expect(service.create({
      userId: 'u1', systemId: 'sys-test', name: 'Test', gender: 'x', race: 'x', class: 'x',
      attributes: { cool: 5, hard: 5 }, skills: ['athletics'],
      origin: { key: 'a5e-ag_acolyte' },
    })).rejects.toThrow('skillChoice inválido')
  })

  it('rejeita contagem errada de skillChoice (grant exige exatamente chooseCount)', async () => {
    const service = new CharacterService(fakePrisma(configWithSkillGrant))
    await expect(service.create({
      userId: 'u1', systemId: 'sys-test', name: 'Test', gender: 'x', race: 'x', class: 'x',
      attributes: { cool: 5, hard: 5 }, skills: ['athletics'],
      origin: { key: 'a5e-ag_acolyte', skillChoice: ['insight', 'persuasion'] },
    })).rejects.toThrow('skillChoice inválido')
  })

  it('perícia já concedida pelo background sai do catálogo da etapa skills (não pode ser reescolhida)', async () => {
    const service = new CharacterService(fakePrisma(configWithSkillGrant))
    await expect(service.create({
      userId: 'u1', systemId: 'sys-test', name: 'Test', gender: 'x', race: 'x', class: 'x',
      attributes: { cool: 5, hard: 5 }, skills: ['religion'],
      origin: { key: 'a5e-ag_acolyte', skillChoice: ['insight'] },
    })).rejects.toThrow('inválida')
  })

  // US-131: Guildmember real ("Two of your choice") — chooseCount 2, chooseFrom = catálogo
  // inteiro (US-131 §Notas de implementação, ingest.mjs `parseSkillGrant`). Confere que
  // `applySkillGrant` aceita chooseCount > 1 (não só o par fixo+escolhido do abilityGrant).
  const configWithFreeSkillGrant: SystemConfig = {
    ...config,
    skills: configWithSkillGrant.skills,
    proficiency: { choices: 0, bonus: 2 },
    backgrounds: [
      { key: 'a5e-ag_guildmember', name: 'Guildmember', source: 'a5e-ag', benefits: [
        { type: 'skill_proficiency', name: 'Skill Proficiencies', description: 'Two of your choice.', grant: { kind: 'skills', fixed: [], chooseFrom: ['religion', 'insight', 'persuasion', 'athletics'], chooseCount: 2 } },
      ] },
    ],
  }

  it('grant.chooseCount > 1 (Guildmember): exige exatamente 2 chaves de chooseFrom', async () => {
    const service = new CharacterService(fakePrisma(configWithFreeSkillGrant))
    const char = await service.create({
      userId: 'u1', systemId: 'sys-test', name: 'Test', gender: 'x', race: 'x', class: 'x',
      attributes: { cool: 5, hard: 5 },
      origin: { key: 'a5e-ag_guildmember', skillChoice: ['religion', 'athletics'] },
    })
    expect(char.skills).toEqual(['religion', 'athletics'])
  })

  it('background sem grant.kind "skills" (ou sem origem) não mexe em skills', async () => {
    const service = new CharacterService(fakePrisma(configWithSkills))
    const char = await service.create({
      userId: 'u1', systemId: 'sys-test', name: 'Test', gender: 'x', race: 'x', class: 'x',
      attributes: { cool: 5, hard: 5 }, skills: ['athletics', 'perception'],
    })
    expect(char.skills).toEqual(['athletics', 'perception'])
  })

  // US-132: ferramenta/veículo do background (`grant.kind === 'tools'`) — mesmo par find/apply
  // de perícia (US-131). `a5e-ag_criminal` real: thieves_tools fixo + escolha de 1 gaming set.
  const configWithToolGrant: SystemConfig = {
    ...config,
    tools: [
      { key: 'thieves_tools', label: "Thieves' Tools", category: 'thieves_tools' },
      { key: 'gaming_set_dice', label: 'Gaming Set, Dice', category: 'gaming-set' },
      { key: 'gaming_set_cards', label: 'Gaming Set, Cards', category: 'gaming-set' },
      { key: 'herbalism_kit', label: 'Herbalism Kit', category: 'kit' },
    ],
    backgrounds: [
      { key: 'a5e-ag_criminal', name: 'Criminal', source: 'a5e-ag', benefits: [
        { type: 'tool_proficiency', name: 'Tool Proficiencies', description: "Gaming set, thieves' tools.", grant: { kind: 'tools', fixed: ['thieves_tools'], chooseFrom: ['gaming_set_cards', 'gaming_set_dice'], chooseCount: 1 } },
      ] },
    ],
  }

  it('mescla ferramenta fixa + escolhida do background em tools', async () => {
    const service = new CharacterService(fakePrisma(configWithToolGrant))
    const char = await service.create({
      userId: 'u1', systemId: 'sys-test', name: 'Test', gender: 'x', race: 'x', class: 'x',
      attributes: { cool: 5, hard: 5 },
      origin: { key: 'a5e-ag_criminal', toolChoice: ['gaming_set_dice'] },
    })
    expect(char.tools).toEqual(['thieves_tools', 'gaming_set_dice'])
  })

  it('rejeita toolChoice fora de grant.chooseFrom', async () => {
    const service = new CharacterService(fakePrisma(configWithToolGrant))
    await expect(service.create({
      userId: 'u1', systemId: 'sys-test', name: 'Test', gender: 'x', race: 'x', class: 'x',
      attributes: { cool: 5, hard: 5 },
      origin: { key: 'a5e-ag_criminal', toolChoice: ['herbalism_kit'] },
    })).rejects.toThrow('toolChoice inválido')
  })

  it('rejeita toolChoice ausente quando o grant exige (chooseCount > 0)', async () => {
    const service = new CharacterService(fakePrisma(configWithToolGrant))
    await expect(service.create({
      userId: 'u1', systemId: 'sys-test', name: 'Test', gender: 'x', race: 'x', class: 'x',
      attributes: { cool: 5, hard: 5 },
      origin: { key: 'a5e-ag_criminal' },
    })).rejects.toThrow('toolChoice inválido')
  })

  // Farmer real: fixed com 5 chaves, chooseCount 0 — proficiência em TODAS, sem escolha.
  const configWithFixedOnlyToolGrant: SystemConfig = {
    ...config,
    tools: [{ key: 'cart', label: 'Cart', category: 'vehicle' }],
    backgrounds: [
      { key: 'a5e-ag_farmer', name: 'Farmer', source: 'a5e-ag', benefits: [
        { type: 'tool_proficiency', name: 'Tool Proficiencies', description: 'Land vehicles.', grant: { kind: 'tools', fixed: ['cart'], chooseFrom: [], chooseCount: 0 } },
      ] },
    ],
  }

  it('grant.chooseCount === 0 (Farmer/Hermit): entra só o fixo, sem exigir toolChoice', async () => {
    const service = new CharacterService(fakePrisma(configWithFixedOnlyToolGrant))
    const char = await service.create({
      userId: 'u1', systemId: 'sys-test', name: 'Test', gender: 'x', race: 'x', class: 'x',
      attributes: { cool: 5, hard: 5 },
      origin: { key: 'a5e-ag_farmer' },
    })
    expect(char.tools).toEqual(['cart'])
  })

  // Folk Hero real: chooseCount 2 (2 slots independentes, união dos catálogos) — exige
  // exatamente 2 chaves de chooseFrom, mesmo teste de Guildmember pra skillChoice (US-131).
  const configWithMultiToolGrant: SystemConfig = {
    ...config,
    tools: [
      { key: 'smiths_tools', label: "Smith's Tools", category: 'artisan' },
      { key: 'cart', label: 'Cart', category: 'vehicle' },
    ],
    backgrounds: [
      { key: 'a5e-ag_folk-hero', name: 'Folk Hero', source: 'a5e-ag', benefits: [
        { type: 'tool_proficiency', name: 'Tool Proficiencies', description: "One type of artisan's tools, one vehicle.", grant: { kind: 'tools', fixed: [], chooseFrom: ['smiths_tools', 'cart'], chooseCount: 2 } },
      ] },
    ],
  }

  it('grant.chooseCount > 1 (Folk Hero): exige exatamente 2 chaves de chooseFrom', async () => {
    const service = new CharacterService(fakePrisma(configWithMultiToolGrant))
    const char = await service.create({
      userId: 'u1', systemId: 'sys-test', name: 'Test', gender: 'x', race: 'x', class: 'x',
      attributes: { cool: 5, hard: 5 },
      origin: { key: 'a5e-ag_folk-hero', toolChoice: ['smiths_tools', 'cart'] },
    })
    expect(char.tools).toEqual(['smiths_tools', 'cart'])
  })

  it('background sem grant.kind "tools" (ou sem origem) não mexe em tools', async () => {
    const service = new CharacterService(fakePrisma(configWithBackgrounds))
    const char = await service.create({
      userId: 'u1', systemId: 'sys-test', name: 'Test', gender: 'x', race: 'x', class: 'x',
      attributes: { cool: 5, hard: 5 }, origin: { key: 'a5e-ag_acolyte' },
    })
    expect(char.tools).toEqual([])
  })

  // US-135: feature nomeada da origem (ex. Thieves' Cant do Criminoso) somada às features de
  // classe já materializadas na criação (US-41) — mesmo campo `Character.features`, sem coluna nova.
  const configWithBackgroundFeature: SystemConfig = {
    ...configWithFeatures,
    backgrounds: [
      { key: 'a5e-ag_criminal', name: 'Criminal', source: 'a5e-ag', benefits: [
        { type: 'feature', name: "Thieves' Cant", description: 'x' },
      ] },
      { key: 'a5e-ag_acolyte', name: 'Acolyte', source: 'a5e-ag', benefits: [
        { type: 'skill_proficiency', name: 'Religion', description: 'x' },
      ] },
    ],
    backgroundFeatures: {
      'a5e-ag_criminal': [{ key: 'a5e-ag_criminal_thieves-cant', source: 'a5e-ag', name: "Thieves' Cant", description: 'x' }],
    },
  }

  it('origem com feature (Criminoso): chave de classe E de origem juntas em Character.features', async () => {
    const service = new CharacterService(fakePrisma(configWithBackgroundFeature))
    const char = await service.create({
      userId: 'u1', systemId: 'sys-test', name: 'Test', gender: 'x', race: 'x', class: 'paladin',
      attributes: { cool: 5, hard: 5 },
      origin: { key: 'a5e-ag_criminal' },
    })
    expect(char.features).toEqual(['paladin_divine-sense', 'paladin_lay-on-hands', 'a5e-ag_criminal_thieves-cant'])
  })

  it('origem sem feature (Acólito): só as chaves de classe, sem entrada fantasma', async () => {
    const service = new CharacterService(fakePrisma(configWithBackgroundFeature))
    const char = await service.create({
      userId: 'u1', systemId: 'sys-test', name: 'Test', gender: 'x', race: 'x', class: 'paladin',
      attributes: { cool: 5, hard: 5 },
      origin: { key: 'a5e-ag_acolyte' },
    })
    expect(char.features).toEqual(['paladin_divine-sense', 'paladin_lay-on-hands'])
  })

  it('sem origem escolhida: só as chaves de classe, comportamento idêntico ao pré-story', async () => {
    const service = new CharacterService(fakePrisma(configWithBackgroundFeature))
    const char = await service.create({
      userId: 'u1', systemId: 'sys-test', name: 'Test', gender: 'x', race: 'x', class: 'paladin',
      attributes: { cool: 5, hard: 5 },
    })
    expect(char.features).toEqual(['paladin_divine-sense', 'paladin_lay-on-hands'])
  })

  // US-142: `raceFeatures`, quando presente, É o catálogo jogável de `race` — a raiz que tem
  // subespécie (elf) fica de fora dele, só a subespécie (high-elf) e a raiz sem subespécie
  // (human) validam. Reverte a decisão da US-140 (raiz+subespécie independentes).
  const configWithRaceFeatures: SystemConfig = {
    ...config,
    races: [
      { key: 'elf', label: 'Elf' },
      { key: 'high-elf', label: 'High Elf', parentKey: 'elf' },
      { key: 'human', label: 'Human' },
    ],
    raceFeatures: {
      'high-elf': [
        { key: 'ability-score-increase', source: 'elf', name: 'Ability Score Increase', description: '+2 Dex.' },
        { key: 'darkvision', source: 'elf', name: 'Darkvision', description: '60 ft.' },
        { key: 'ability-score-increase', source: 'high-elf', name: 'Ability Score Increase', description: '+1 Int.' },
        { key: 'cantrip', source: 'high-elf', name: 'Cantrip', description: 'x' },
      ],
      human: [{ key: 'ability-score-increase', source: 'human', name: 'Ability Score Increase', description: '+1 all.' }],
    },
  }

  it('raça com subespécie: Character.features ganha os traços combinados (raiz + subespécie)', async () => {
    const service = new CharacterService(fakePrisma(configWithRaceFeatures))
    const char = await service.create({
      userId: 'u1', systemId: 'sys-test', name: 'Test', gender: 'x', race: 'high-elf', class: 'x',
      attributes: { cool: 5, hard: 5 },
    })
    expect(char.race).toBe('high-elf')
    expect(char.features).toEqual(['ability-score-increase', 'darkvision', 'ability-score-increase', 'cantrip'])
  })

  it('rejeita a raiz que tem subespécie como Character.race quando raceFeatures está presente', async () => {
    const service = new CharacterService(fakePrisma(configWithRaceFeatures))
    await expect(service.create({
      userId: 'u1', systemId: 'sys-test', name: 'Test', gender: 'x', race: 'elf', class: 'x',
      attributes: { cool: 5, hard: 5 },
    })).rejects.toThrow('Raça inválida')
  })

  it('raiz sem subespécie continua válida com raceFeatures presente, só os traços próprios', async () => {
    const service = new CharacterService(fakePrisma(configWithRaceFeatures))
    const char = await service.create({
      userId: 'u1', systemId: 'sys-test', name: 'Test', gender: 'x', race: 'human', class: 'x',
      attributes: { cool: 5, hard: 5 },
    })
    expect(char.race).toBe('human')
    expect(char.features).toEqual(['ability-score-increase'])
  })

  it('config sem raceFeatures (legado) valida race contra config.races cheio, sem mudar comportamento', async () => {
    const service = new CharacterService(fakePrisma(catalogPt))
    const char = await service.create({
      userId: 'u1', systemId: 'sys-test', name: 'Test', gender: 'x', race: 'dwarf', class: 'wizard',
      attributes: { cool: 5, hard: 5 },
    })
    expect(char.race).toBe('dwarf')
    expect(char.features).toEqual([])
  })
})
