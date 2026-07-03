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
})
