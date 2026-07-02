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
