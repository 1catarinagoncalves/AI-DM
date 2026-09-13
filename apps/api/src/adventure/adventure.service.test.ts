import { describe, it, expect, vi } from 'vitest'
import { GeneratedAdventureSchema, type SystemConfig } from '@ai-dm/shared'
import { AdventureService, type AdventureProfile } from './adventure.service'
import type { AiService } from '../ai/ai.service'
import type { PrismaService } from '../prisma.service'

// US-232: artefato BRUTO da autoria (índices, sem ids) que o fake de generateAdventureAuthoring
// devolve. Graph-closed depois do minting: npc-0 ocupa loc-0, encounter/challenge/objective em
// loc-0. `capture` (opcional) recebe os params da chamada, pra afirmar o que chega ao prompt.
function authored(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    world: { name: 'Vhel-Toran', description: 'Cidade entre costelas de um deus.', anchors: ['A Nave'] },
    summary: 'Três facções disputam a Enseada Cinzenta.',
    story: 'O conflito central entre as facções.',
    factions: [
      { name: 'Guardiões', kind: 'ordem', want: 'selar a enseada' },
      { name: 'Sindicato', kind: 'submundo', want: 'saquear a enseada' },
    ],
    npcs: [{ name: 'Marta', role: 'herborista suspeita', want: 'proteger o bosque', factionIndex: 0, speech: 'Cuidado com a maré.' }],
    locations: [{ title: 'Enseada Cinzenta', aspects: ['maré alta'], boxedText: 'Você chega.', description: 'notas', occupants: [0], vibe: 'social' as const }],
    challenges: [{ locationIndex: 0, test: 'teste de Força', situation: 'escalar', consequence: 'cai' }],
    encounters: [{ locationIndex: 0, npcIndices: [0], type: 'social' as const, fiction: 'Marta barra a passagem.', behaviors: 'observa', goal: 'passar', complications: 'ela desconfia', unlocks: 'o mapa' }],
    objective: { description: 'Impedir o saque da enseada.', reward: { name: 'Selo', effect: 'sela portais' }, locationIndex: 0 },
    branchedResolution: [{ choice: 'Selar', consequence: 'os nomes calam' }, { choice: 'Abrir', consequence: 'algo desperta' }],
    start: 'O gancho: você chega à enseada ao anoitecer.',
    followUps: ['A dívida volta a assombrar.'],
    ...overrides,
  }
}

function fakeAi(
  opening: string | null = null,
  scene: Record<string, unknown> | null = null,
  seen: Record<string, unknown> = {},
  authoredObj: Record<string, unknown> = authored(),
  capture?: Record<string, unknown>,
): AiService {
  return {
    generateOpeningNarration: async (input: Record<string, unknown>) => { Object.assign(seen, input); return opening },
    extractOpeningScene: async () => scene,
    extractOpeningEntities: async () => null,
    generateAdventureAuthoring: async (params: Record<string, unknown>) => {
      if (capture) Object.assign(capture, params)
      return authoredObj
    },
  } as unknown as AiService
}

const config: SystemConfig = {
  attributes: [{ key: 'constitution', label: 'Con', min: 1, max: 20, default: 10 }],
  startingKits: { fighter: [{ name: 'Espada longa', qty: 1 }], default: [{ name: 'Adaga', qty: 1 }] },
  races: [{ key: 'human', label: 'Humano' }],
  classes: [{ key: 'wizard', label: 'Mago' }],
  backgroundEquipment: { 'a5e-ag_acolyte': [{ name: 'Símbolo sagrado', qty: 1 }, { name: 'Túnica', qty: 1 }] },
  backgrounds: [
    {
      key: 'a5e-ag_acolyte', name: 'Acólito', source: 'a5e-ag',
      benefits: [{ type: 'adventures_and_advancement', name: 'Chamado', description: 'O templo pede um favor.' }],
    },
  ],
  initialAdventures: {
    hooks: [
      {
        id: 'mago-arquivo', classKey: 'wizard', title: 'O Arquivo Que Sussurra',
        pitch: 'Um grimório reconhece {characterName}.',
        primaryQuestTitle: 'Decifrar o Arquivo', primaryQuestDescription: 'Descubra o que o grimório sussurra a {characterName}.',
        openingNarration: 'A vela curva-se, {characterName}.',
        tags: [],
      },
      {
        id: 'default-sinal', classKey: 'default', title: 'O Primeiro Sinal de {characterClass}',
        pitch: 'Algo reconhece {characterName}.',
        primaryQuestTitle: 'Responder ao Chamado', primaryQuestDescription: 'Descubra o que o mundo espera de {characterName}, {characterClass}.',
        openingNarration: 'Alguém pronuncia a tua classe: {characterClass}.', tags: [],
      },
    ],
  },
}

interface Recorded {
  adventureCreate?: Record<string, unknown>
  adventureUpdateMany?: Record<string, unknown>
  participantCreate?: Record<string, unknown>
  characterStateCreate?: Record<string, unknown>
  questCreate?: Record<string, unknown>
  eventLogCreate?: Record<string, unknown>
}

function fakePrisma(character: Record<string, unknown> | null, participantCount = 0): { prisma: PrismaService; recorded: Recorded } {
  const recorded: Recorded = {}
  const tx = {
    adventureParticipant: { create: async ({ data }: { data: Record<string, unknown> }) => { recorded.participantCreate = data; return { id: 'participant-1', ...data } } },
    adventure: {
      updateMany: async (args: Record<string, unknown>) => { recorded.adventureUpdateMany = args; return { count: 0 } },
      create: async ({ data }: { data: Record<string, unknown> }) => { recorded.adventureCreate = data; return { id: 'adv-1', ...data } },
    },
    characterState: { create: async ({ data }: { data: Record<string, unknown> }) => { recorded.characterStateCreate = data; return data } },
    quest: { create: async ({ data }: { data: Record<string, unknown> }) => { recorded.questCreate = data; return { id: 'quest-1', ...data } } },
    eventLog: { create: async ({ data }: { data: Record<string, unknown> }) => { recorded.eventLogCreate = data; return { id: 'evt-1', ...data } } },
  }
  const prisma = {
    character: { findUnique: async () => character },
    system: {
      findMany: async () => {
        const c = character as { system?: unknown; systemId?: string } | null
        return c?.system ? [{ id: c.systemId, ...(c.system as object) }] : []
      },
    },
    adventureParticipant: { count: async () => participantCount },
    $transaction: async (fn: (tx: unknown) => unknown) => fn(tx),
  } as unknown as PrismaService
  return { prisma, recorded }
}

describe('AdventureService.createForCharacter (US-232)', () => {
  const baseChar = {
    id: 'char-1', userId: 'user-1', systemId: 'sys-1', name: 'Elara', class: 'wizard', race: 'human', level: 1,
    baseAttributes: { constitution: 14 }, system: { config },
  }

  it('título e quest vêm do artefato gerado (summary/objective), sem conclusionHint', async () => {
    const { prisma, recorded } = fakePrisma(baseChar)
    const adventure = await new AdventureService(prisma, fakeAi()).createForCharacter('char-1', {})

    expect(adventure).toMatchObject({ id: 'adv-1', systemId: 'sys-1', creatorId: 'user-1', title: 'Três facções disputam a Enseada Cinzenta.', order: 1 })
    expect(recorded.questCreate).toMatchObject({
      title: 'Três facções disputam a Enseada Cinzenta.',
      description: 'Três facções disputam a Enseada Cinzenta.',
      objective: 'Impedir o saque da enseada.',
      isPrimary: true,
    })
    expect(recorded.questCreate).not.toHaveProperty('conclusionHint')
    expect(recorded.eventLogCreate).toMatchObject({ type: 'NARRATION', payload: { text: 'A vela curva-se, Elara.' } })
  })

  it('caminho IA: texto do modelo é persistido como abertura', async () => {
    const { prisma, recorded } = fakePrisma(baseChar)
    await new AdventureService(prisma, fakeAi('A chuva fina cai sobre Elara.')).createForCharacter('char-1', {})
    expect(recorded.eventLogCreate).toMatchObject({ type: 'NARRATION', payload: { text: 'A chuva fina cai sobre Elara.' } })
  })

  it('US-35: extração devolve patch → sceneState preenchido', async () => {
    const { prisma, recorded } = fakePrisma(baseChar)
    const patch = { local: 'estrada', ambiente: 'externo', periodo: 'anoitecer', presentes: ['velho'], objetos_em_cena: ['chuva'] }
    await new AdventureService(prisma, fakeAi('A chuva cai.', patch)).createForCharacter('char-1', {})
    expect((recorded.characterStateCreate as Record<string, unknown>)['sceneState']).toMatchObject(patch)
  })

  it('US-35: extração null → sem sceneState, sem erro', async () => {
    const { prisma, recorded } = fakePrisma(baseChar)
    await new AdventureService(prisma, fakeAi('A chuva cai.', null)).createForCharacter('char-1', {})
    expect(recorded.characterStateCreate).not.toHaveProperty('sceneState')
  })

  // US-232: entities vêm do artefato — facções + NPC narrativo (want+facção) + local (nota com
  // encontro+desafio); SEM antagonista nem segredo.
  it('entities: facções, NPC narrativo com want/facção e local, sem antagonista/segredo', async () => {
    const { prisma, recorded } = fakePrisma(baseChar)
    await new AdventureService(prisma, fakeAi()).createForCharacter('char-1', {})
    const entities = recorded.adventureCreate?.['entities'] as Array<{ nome: string; tipo: string; nota?: string; revelado: boolean }>
    expect(entities.filter((e) => e.tipo === 'faccao').map((e) => e.nome)).toEqual(['Guardiões', 'Sindicato'])
    const marta = entities.find((e) => e.nome === 'Marta')!
    expect(marta.nota).toBe('herborista suspeita — Quer: proteger o bosque — Facção: Guardiões')
    expect(entities.some((e) => e.tipo === 'outro')).toBe(false) // sem segredo
    expect(entities.every((e) => e.revelado === false)).toBe(true)
  })

  it('classe desconhecida cai no gancho default, sem erro', async () => {
    const character = { ...baseChar, name: 'Nyx', class: 'Cartógrafa Estelar' }
    const { prisma, recorded } = fakePrisma(character)
    const adventure = await new AdventureService(prisma, fakeAi()).createForCharacter('char-1', {})
    expect(typeof adventure.title).toBe('string')
    expect(recorded.eventLogCreate).toMatchObject({ payload: { text: 'Alguém pronuncia a tua classe: Cartógrafa Estelar.' } })
  })

  it('order é calculado pela contagem de aventuras anteriores', async () => {
    const { prisma, recorded } = fakePrisma(baseChar, 2)
    await new AdventureService(prisma, fakeAi()).createForCharacter('char-1', {})
    expect(recorded.adventureCreate).toMatchObject({ order: 3 })
  })

  it('a abertura recebe o RÓTULO de raça e classe, não a chave', async () => {
    const { prisma } = fakePrisma({ ...baseChar, baseAttributes: { constitution: 10 } })
    const seen: Record<string, unknown> = {}
    await new AdventureService(prisma, fakeAi(null, null, seen)).createForCharacter('char-1', {})
    expect(seen['characterClass']).toBe('Mago')
    expect(seen['characterRace']).toBe('Humano')
  })

  it('seededEntities chega a generateOpeningNarration como entities', async () => {
    const { prisma } = fakePrisma(baseChar)
    const seen: Record<string, unknown> = {}
    await new AdventureService(prisma, fakeAi(null, null, seen)).createForCharacter('char-1', {})
    const entities = seen['entities'] as Array<{ nome: string }>
    expect(entities.some((e) => e.nome === 'Marta')).toBe(true)
    expect(entities.some((e) => e.nome === 'Guardiões')).toBe(true)
  })

  it('generatedAdventure é persistido com o artefato', async () => {
    const { prisma, recorded } = fakePrisma(baseChar)
    await new AdventureService(prisma, fakeAi()).createForCharacter('char-1', {})
    expect(recorded.adventureCreate?.['generatedAdventure']).toMatchObject({ id: 'char-1:1', summary: expect.any(String), start: expect.any(String) })
  })

  it('rejeita quando o personagem não existe', async () => {
    const { prisma } = fakePrisma(null)
    await expect(new AdventureService(prisma, fakeAi()).createForCharacter('missing', {})).rejects.toThrow()
  })

  it('background.story é repassado à autoria como characterStory (tom)', async () => {
    const capture: Record<string, unknown> = {}
    const { prisma } = fakePrisma({ ...baseChar, background: { story: 'cresceu nos cais' } })
    await new AdventureService(prisma, fakeAi(null, null, {}, authored(), capture)).createForCharacter('char-1', {})
    expect(capture['characterStory']).toBe('cresceu nos cais')
  })

  // US-232: DTO tone/setting/areaType repassados como registryOverrides; config vai como 5º arg.
  it('tone/setting/areaType do DTO são repassados a generateGatedAdventure com config', async () => {
    const configComCatalogo: SystemConfig = { ...config, tones: [{ key: 'heroic', label: 'Heroico' }], settings: [{ key: 'urban', label: 'Urbano' }], areaTypes: [{ key: 'dungeon', label: 'Masmorra' }] }
    const { prisma } = fakePrisma({ ...baseChar, system: { config: configComCatalogo } })
    const service = new AdventureService(prisma, fakeAi())
    const gateSpy = vi.spyOn(service, 'generateGatedAdventure')
    await service.createForCharacter('char-1', { tone: 'heroic', setting: 'urban', areaType: 'dungeon' })
    expect(gateSpy).toHaveBeenCalledWith(expect.anything(), 'char-1', 1, 'pt-BR', expect.anything(), { tone: 'heroic', setting: 'urban', areaType: 'dungeon' })
  })

  it('locale de User.locale (en-US) é repassado a generateGatedAdventure', async () => {
    const { prisma } = fakePrisma({ ...baseChar, user: { locale: 'en-US' } })
    const service = new AdventureService(prisma, fakeAi())
    const gateSpy = vi.spyOn(service, 'generateGatedAdventure')
    await service.createForCharacter('char-1', {})
    expect(gateSpy).toHaveBeenCalledWith(expect.anything(), 'char-1', 1, 'en-US', expect.anything(), expect.anything())
  })

  it('challenge do DTO chega ao profile (default adventure)', async () => {
    const { prisma } = fakePrisma(baseChar)
    const service = new AdventureService(prisma, fakeAi())
    const gateSpy = vi.spyOn(service, 'generateGatedAdventure')
    await service.createForCharacter('char-1', {})
    expect(gateSpy.mock.calls[0]?.[0]).toMatchObject({ challenge: 'adventure' })
    await service.createForCharacter('char-1', { challenge: 'challenge' })
    expect(gateSpy.mock.calls[1]?.[0]).toMatchObject({ challenge: 'challenge' })
  })

  describe('US-156/US-184: validação de catálogo (tone/setting/areaType)', () => {
    const configComCatalogo: SystemConfig = { ...config, tones: [{ key: 'heroic', label: 'Heroico' }], settings: [{ key: 'urban', label: 'Urbano' }], areaTypes: [{ key: 'dungeon', label: 'Masmorra' }] }

    it('chave válida passa', async () => {
      const { prisma } = fakePrisma({ ...baseChar, system: { config: configComCatalogo } })
      await expect(new AdventureService(prisma, fakeAi()).createForCharacter('char-1', { tone: 'heroic' })).resolves.toMatchObject({ id: 'adv-1' })
    })

    it('tone fora do catálogo: 400 com valor e chaves', async () => {
      const { prisma } = fakePrisma({ ...baseChar, system: { config: configComCatalogo } })
      await expect(new AdventureService(prisma, fakeAi()).createForCharacter('char-1', { tone: 'xpto' }))
        .rejects.toThrow('Tom inválido: "xpto". Esperado uma chave do catálogo do sistema: heroic')
    })

    it('setting fora do catálogo: 400', async () => {
      const { prisma } = fakePrisma({ ...baseChar, system: { config: configComCatalogo } })
      await expect(new AdventureService(prisma, fakeAi()).createForCharacter('char-1', { setting: 'xpto' }))
        .rejects.toThrow('Cenário inválido: "xpto". Esperado uma chave do catálogo do sistema: urban')
    })

    it('config legado sem catálogo aceita qualquer chave', async () => {
      const { prisma } = fakePrisma(baseChar)
      await expect(new AdventureService(prisma, fakeAi()).createForCharacter('char-1', { tone: 'qualquer' })).resolves.toMatchObject({ id: 'adv-1' })
    })
  })

  describe('US-128: memento + equipamento da origem', () => {
    it('origem escolhida (sem memento): kit + equipamento', async () => {
      const { prisma, recorded } = fakePrisma({ ...baseChar, origin: { key: 'a5e-ag_acolyte' } })
      await new AdventureService(prisma, fakeAi()).createForCharacter('char-1', {})
      expect(recorded.characterStateCreate).toMatchObject({ inventory: [{ name: 'Adaga', qty: 1 }, { name: 'Símbolo sagrado', qty: 1, origin: 'equipment' }, { name: 'Túnica', qty: 1, origin: 'equipment' }] })
    })

    it('memento escolhido: item "Memento" com nome fixo', async () => {
      const { prisma, recorded } = fakePrisma({ ...baseChar, origin: { memento: 'O símbolo gasto do mentor.' } })
      await new AdventureService(prisma, fakeAi()).createForCharacter('char-1', {})
      expect(recorded.characterStateCreate).toMatchObject({ inventory: [{ name: 'Adaga', qty: 1 }, { name: 'Memento', qty: 1, origin: 'memento' }] })
    })

    it('sem origem nem memento: só o kit', async () => {
      const { prisma, recorded } = fakePrisma(baseChar)
      await new AdventureService(prisma, fakeAi()).createForCharacter('char-1', {})
      expect(recorded.characterStateCreate).toMatchObject({ inventory: [{ name: 'Adaga', qty: 1 }] })
    })
  })

  // US-217: ramo "Aventura pronta" — pula o motor de mundo, não chama generateAdventureAuthoring.
  describe('ramo "Aventura pronta" (dto.preset)', () => {
    function presetAi(opening: string | null = null, scene: Record<string, unknown> | null = null): AiService {
      return {
        generateOpeningNarration: vi.fn().mockResolvedValue(opening),
        extractOpeningScene: vi.fn().mockResolvedValue(scene),
        extractOpeningEntities: vi.fn(),
        generateAdventureAuthoring: vi.fn(),
      } as unknown as AiService
    }

    it('persiste Adventure/Quest do gancho fixo, sem chamar a autoria', async () => {
      const { prisma, recorded } = fakePrisma(baseChar)
      const ai = presetAi()
      const adventure = await new AdventureService(prisma, ai).createForCharacter('char-1', { preset: true })
      expect(adventure).toMatchObject({ id: 'adv-1', title: 'O Arquivo Que Sussurra', order: 1 })
      expect(recorded.questCreate).toMatchObject({ title: 'Decifrar o Arquivo', isPrimary: true })
      expect(ai.generateAdventureAuthoring).not.toHaveBeenCalled()
    })

    it('abertura continua gerada pela IA', async () => {
      const { prisma, recorded } = fakePrisma(baseChar)
      const ai = presetAi('A vela responde de um jeito novo.')
      await new AdventureService(prisma, ai).createForCharacter('char-1', { preset: true })
      expect(recorded.eventLogCreate).toMatchObject({ type: 'NARRATION', payload: { text: 'A vela responde de um jeito novo.' } })
    })

    it('IA vazia: cai no texto estático do gancho', async () => {
      const { prisma, recorded } = fakePrisma(baseChar)
      await new AdventureService(prisma, presetAi(null)).createForCharacter('char-1', { preset: true })
      expect(recorded.eventLogCreate).toMatchObject({ payload: { text: 'A vela curva-se, Elara.' } })
    })

    it('sem generatedAdventure/entities; Quest sem objective/conclusionHint', async () => {
      const { prisma, recorded } = fakePrisma(baseChar)
      await new AdventureService(prisma, presetAi()).createForCharacter('char-1', { preset: true })
      expect(recorded.adventureCreate).not.toHaveProperty('generatedAdventure')
      expect(recorded.adventureCreate).not.toHaveProperty('entities')
      expect(recorded.questCreate).not.toHaveProperty('objective')
    })
  })
})

describe('AdventureService.getTurns', () => {
  it('mapeia ACTION→user e NARRATION→dm, inclui resumidos, marca última ação editável', async () => {
    const logs = [
      { type: 'ACTION', payload: { text: 'Abro a porta.' }, summarized: true },
      { type: 'NARRATION', payload: { text: 'A porta range.' }, summarized: true },
      { type: 'ACTION', payload: { text: 'Entro.' }, summarized: false },
      { type: 'NARRATION', payload: { text: 'Três figuras...' }, summarized: false },
    ]
    const prisma = { eventLog: { findMany: async () => logs } } as unknown as PrismaService
    const turns = await new AdventureService(prisma, fakeAi()).getTurns('char-1', 'adv-1')
    expect(turns).toEqual([
      { role: 'user', content: 'Abro a porta.' },
      { role: 'dm', content: 'A porta range.' },
      { role: 'user', content: 'Entro.', editable: true },
      { role: 'dm', content: 'Três figuras...' },
    ])
  })

  it('US-67: último turno mutou o estado (CHARACTER_UPDATE) → não editável', async () => {
    const logs = [
      { type: 'NARRATION', payload: { text: 'O goblin ataca.' }, summarized: false },
      { type: 'CHARACTER_UPDATE', payload: { field: 'hp', newHp: 4 }, summarized: false },
      { type: 'ACTION', payload: { text: 'Aparo o golpe.' }, summarized: false },
      { type: 'NARRATION', payload: { text: 'A lâmina raspa o braço.' }, summarized: false },
    ]
    const prisma = { eventLog: { findMany: async () => logs } } as unknown as PrismaService
    const turns = await new AdventureService(prisma, fakeAi()).getTurns('char-1', 'adv-1')
    expect(turns).toEqual([
      { role: 'dm', content: 'O goblin ataca.' },
      { role: 'user', content: 'Aparo o golpe.' },
      { role: 'dm', content: 'A lâmina raspa o braço.' },
    ])
  })
})

describe('AdventureService.buildAdventureProfile', () => {
  function service(): { buildAdventureProfile: (character: Record<string, unknown>, config: SystemConfig, challenge: 'adventure' | 'challenge') => unknown } {
    const { prisma } = fakePrisma(null)
    return new AdventureService(prisma, fakeAi()) as unknown as { buildAdventureProfile: (character: Record<string, unknown>, config: SystemConfig, challenge: 'adventure' | 'challenge') => unknown }
  }

  it('background/origin preenchidos: perfil carrega os campos, hookSeed resolvido', () => {
    const character = {
      name: 'Elara', level: 3, class: 'wizard',
      background: { story: 'Aprendiz fugida', bonds: ['O mentor'], flaws: ['Orgulho'] },
      origin: { key: 'a5e-ag_acolyte', connection: 'O templo', memento: 'Símbolo gasto' },
    }
    const profile = service().buildAdventureProfile(character, config, 'adventure') as Record<string, unknown>
    expect(profile).toEqual({
      level: 3, classKey: 'wizard', background: character.background,
      origin: { adventuresAndAdvancement: 'O templo pede um favor.' },
      hookSeed: 'A vela curva-se, Elara.', challenge: 'adventure',
    })
  })

  it('background {} e origin {}: perfil válido, hookSeed da classe', () => {
    const profile = service().buildAdventureProfile({ name: 'Nyx', level: 1, class: 'wizard', background: {}, origin: {} }, config, 'adventure') as Record<string, unknown>
    expect(profile['level']).toBe(1)
    expect(profile['hookSeed']).toBe('A vela curva-se, Nyx.')
  })
})

// US-232: orquestrador — 1 chamada de autoria (fake) + montagem determinística + backstop.
describe('AdventureService.generateAdventure (US-232)', () => {
  const profile: AdventureProfile = { level: 3, classKey: 'wizard', background: {}, origin: {}, hookSeed: 'x', challenge: 'adventure' }

  function service(ai: AiService) {
    const { prisma } = fakePrisma(null)
    return new AdventureService(prisma, ai)
  }

  it('monta um GeneratedAdventure que passa em .parse()', async () => {
    const adventure = await service(fakeAi()).generateAdventure(profile, 'char-1', 1, 'pt-BR', config)
    expect(() => GeneratedAdventureSchema.parse(adventure)).not.toThrow()
  })

  it('id/levelRange/summary/world/story/factions vêm do artefato', async () => {
    const adventure = await service(fakeAi()).generateAdventure(profile, 'char-1', 2, 'pt-BR', config)
    expect(adventure.id).toBe('char-1:2')
    expect(adventure.levelRange).toEqual({ min: 3, max: 3 })
    expect(adventure.summary).toBe('Três facções disputam a Enseada Cinzenta.')
    expect(adventure.world.name).toBe('Vhel-Toran')
    expect(adventure.factions).toHaveLength(2)
  })

  it('minta ids: faction-N, npc-N (com factionId + interações da fala), loc-N, challenge/encounter/objective resolvidos', async () => {
    const adventure = await service(fakeAi()).generateAdventure(profile, 'char-1', 1, 'pt-BR', config)
    expect(adventure.factions[0]!.id).toBe('faction-1')
    const marta = adventure.npcs[0]!
    expect(marta.id).toBe('npc-1')
    expect(marta.factionId).toBe('faction-1')
    expect(marta.interactions).toEqual([{ narrative: 'Cuidado com a maré.' }])
    expect(adventure.locations[0]!.id).toBe('loc-1')
    expect(adventure.locations[0]!.occupants).toEqual(['npc-1'])
    expect(adventure.challenges[0]!.locationId).toBe('loc-1')
    expect(adventure.encounters[0]!.locationId).toBe('loc-1')
    expect(adventure.encounters[0]!.npcIds).toEqual(['npc-1'])
    expect(adventure.objective.locationId).toBe('loc-1')
  })

  it('a autoria recebe factionCount em [2,4], contagens fixas, className rótulo, world label dos overrides', async () => {
    const capture: Record<string, unknown> = {}
    const configComTom: SystemConfig = { ...config, tones: [{ key: 'heroic', label: 'Heroico' }] }
    await service(fakeAi(null, null, {}, authored(), capture)).generateAdventure(profile, 'char-1', 1, 'pt-BR', configComTom, { tone: 'heroic' })
    expect(capture['factionCount']).toBeGreaterThanOrEqual(2)
    expect(capture['factionCount']).toBeLessThanOrEqual(4)
    expect(capture['counts']).toEqual({ locations: 6, npcs: 7, challenges: 3, encounters: 3 })
    expect(capture['className']).toBe('Mago')
    expect((capture['world'] as Record<string, unknown>)['tone']).toBe('Heroico')
  })

  it('backstop: local órfão (sem encontro/desafio/objetivo/occupant) recebe um occupant', async () => {
    const twoLoc = authored({
      locations: [
        { title: 'Ancorada', aspects: [], boxedText: 'x', description: 'y', occupants: [0], vibe: 'social' },
        { title: 'Órfã', aspects: [], boxedText: 'x', description: 'y', occupants: [], vibe: 'skill' },
      ],
      npcs: [
        { name: 'Marta', role: 'herborista', want: 'w', factionIndex: 0 },
        { name: 'Bram', role: 'ferreiro', want: 'w' },
      ],
      // encounter/challenge/objective todos em loc-0 → loc-1 fica órfã até o backstop.
      challenges: [{ locationIndex: 0, test: 't', situation: 's', consequence: 'c' }],
      encounters: [{ locationIndex: 0, npcIndices: [0], type: 'social', fiction: 'f', behaviors: 'b', goal: 'g', complications: 'c', unlocks: 'u' }],
      objective: { description: 'd', reward: { name: 'r', effect: 'e' }, locationIndex: 0 },
    })
    const adventure = await service(fakeAi(null, null, {}, twoLoc)).generateAdventure(profile, 'char-1', 1, 'pt-BR', config)
    const orphan = adventure.locations.find((l) => l.title === 'Órfã')!
    expect(orphan.occupants.length).toBeGreaterThan(0)
    expect(() => GeneratedAdventureSchema.parse(adventure)).not.toThrow()
  })

  it('registryOverrides fixam o registro', async () => {
    const adventure = await service(fakeAi()).generateAdventure(profile, 'char-1', 1, 'pt-BR', config, { tone: 'heroic' })
    expect(adventure.registry.tone).toBe('heroic')
  })

  it('registro é determinístico por characterId+order', async () => {
    const a = await service(fakeAi()).generateAdventure(profile, 'char-1', 7, 'pt-BR', config)
    const b = await service(fakeAi()).generateAdventure(profile, 'char-1', 7, 'pt-BR', config)
    expect(a.registry).toEqual(b.registry)
  })

  it('encounters[].fiction presente, npc[].want não vazio', async () => {
    const adventure = await service(fakeAi()).generateAdventure(profile, 'char-1', 1, 'pt-BR', config)
    expect(adventure.encounters.every((e) => e.fiction.length > 0)).toBe(true)
    expect(adventure.npcs.every((n) => n.want.length > 0)).toBe(true)
  })
})

describe('AdventureService.generateGatedAdventure (US-232)', () => {
  const profile: AdventureProfile = { level: 3, classKey: 'wizard', background: {}, origin: {}, hookSeed: 'x', challenge: 'adventure' }

  function service(ai: AiService) {
    const { prisma } = fakePrisma(null)
    return new AdventureService(prisma, ai)
  }

  it('grafo fechado: gate passa na 1ª tentativa', async () => {
    const ai = fakeAi()
    const spy = vi.spyOn(ai, 'generateAdventureAuthoring')
    const result = await service(ai).generateGatedAdventure(profile, 'char-1', 1, 'pt-BR', config)
    expect(result.ok).toBe(true)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('NPC órfão (nunca referenciado, sem local órfão pro backstop): esgota o teto e falha', async () => {
    const logSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    // 2 NPCs, 1 local já ancorado por occupant npc-0 — npc-1 nunca é referenciado e não há
    // local órfão pro backstop colocá-lo → checkNoOrphanNpcs reprova toda tentativa.
    const orphanNpc = authored({
      npcs: [
        { name: 'Marta', role: 'herborista', want: 'w', factionIndex: 0 },
        { name: 'Órfão', role: 'coadjuvante', want: 'w' },
      ],
    })
    const result = await service(fakeAi(null, null, {}, orphanNpc)).generateGatedAdventure(profile, 'char-1', 1, 'pt-BR', config)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toContain('teto de 3 tentativas esgotado')
    }
    logSpy.mockRestore()
  })
})
