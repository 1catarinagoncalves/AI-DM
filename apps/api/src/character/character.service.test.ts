import { describe, it, expect } from 'vitest'
import type { SystemConfig } from '@ai-dm/shared'
import { CharacterService } from './character.service'
import type { PrismaService } from '../prisma.service'

// Test double mínimo do PrismaService: só os métodos que CharacterService.create chama.
// `as unknown as PrismaService` porque o double não implementa PrismaClient inteiro.
function fakePrisma(config: SystemConfig | null): PrismaService {
  return {
    system: { findUnique: async () => ({ id: 'sys-test', config }) },
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
function fakePrismaList(characters: unknown[]): PrismaService {
  return {
    character: { findMany: async () => characters },
  } as unknown as PrismaService
}

describe('CharacterService.findAllByUser (US-25)', () => {
  it('embute currentAdventure da participação ACTIVE e ordena por último jogado', async () => {
    const service = new CharacterService(fakePrismaList([
      {
        id: 'char-old', name: 'Antigo', race: 'Anão', class: 'Guerreiro', level: 2, createdAt: new Date('2020-01-01'),
        states: [{ updatedAt: new Date('2026-01-01') }],
        participations: [],
      },
      {
        id: 'char-new', name: 'Lyra', race: 'Elfa', class: 'Maga', level: 1, createdAt: new Date('2020-02-01'),
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
        { name: 'Sentido Divino', description: 'Sente o mal por perto.' },
        { name: 'Impor as Mãos', description: 'Cura ao toque.' },
      ],
      default: [],
    },
  }

  it('materializa as features de nível 1 da classe (match tolerante a acento/caixa)', async () => {
    const service = new CharacterService(fakePrisma(configWithFeatures))
    const char = await service.create({
      userId: 'u1', systemId: 'sys-test', name: 'Seraphine', gender: 'feminino', race: 'Humana', class: 'Paladina',
      attributes: { cool: 5, hard: 5 },
    })
    expect(char.features).toEqual([
      { name: 'Sentido Divino', description: 'Sente o mal por perto.' },
      { name: 'Impor as Mãos', description: 'Cura ao toque.' },
    ])
  })

  it('classe sem kit de features → [] (sem crash)', async () => {
    const service = new CharacterService(fakePrisma(configWithFeatures))
    const char = await service.create({
      userId: 'u1', systemId: 'sys-test', name: 'Test', gender: 'x', race: 'x', class: 'ClasseCustom',
      attributes: { cool: 5, hard: 5 },
    })
    expect(char.features).toEqual([])
  })

  it('sistema sem classFeatures no config → features [] (sem crash)', async () => {
    const service = new CharacterService(fakePrisma(config))
    const char = await service.create({
      userId: 'u1', systemId: 'sys-test', name: 'Test', gender: 'x', race: 'x', class: 'Paladina',
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
})
