import { describe, it, expect } from 'vitest'
import { getSystemCached, getSystemsCached } from './system-locale'
import type { PrismaService } from '../prisma.service'

// System.config+configLocales é o SRD inteiro (~200KB/linha) — cada `include: { system: true }`
// por turno reenvia esse blob estático pela rede (achado ao investigar consumo do Neon).
// getSystemsCached existe pra isso não acontecer mais de uma vez por processo.
function fakePrisma(): { prisma: PrismaService; calls: () => number } {
  let calls = 0
  const prisma = {
    system: {
      findMany: async () => {
        calls++
        return [
          { id: 'system-dnd5e', name: 'D&D 5e SRD', config: {}, configLocales: {} },
          { id: 'system-free', name: 'Free', config: {}, configLocales: {} },
        ]
      },
    },
  } as unknown as PrismaService
  return { prisma, calls: () => calls }
}

// Prisma que falha na primeira chamada e serve na segunda: a Neon com scale-to-zero
// derruba a primeira query enquanto o compute acorda (US-58).
function flakyPrisma(): { prisma: PrismaService; calls: () => number } {
  let calls = 0
  const prisma = {
    system: {
      findMany: async () => {
        calls++
        if (calls === 1) throw new Error('Connection terminated (compute acordando)')
        return [{ id: 'system-free', name: 'Free', config: {}, configLocales: {} }]
      },
    },
  } as unknown as PrismaService
  return { prisma, calls: () => calls }
}

describe('getSystemsCached', () => {
  it('busca no banco só na primeira chamada', async () => {
    const { prisma, calls } = fakePrisma()

    const a = await getSystemsCached(prisma)
    const b = await getSystemsCached(prisma)

    expect(a).toEqual(b)
    expect(calls()).toBe(1)
  })

  it('chamadas concorrentes compartilham UMA busca (sem estouro no boot)', async () => {
    const { prisma, calls } = fakePrisma()

    await Promise.all([getSystemsCached(prisma), getSystemsCached(prisma), getSystemsCached(prisma)])

    expect(calls()).toBe(1)
  })

  it('erro transitório não envenena a cache — a chamada seguinte tenta de novo', async () => {
    const { prisma, calls } = flakyPrisma()

    await expect(getSystemsCached(prisma)).rejects.toThrow('compute acordando')
    const systems = await getSystemsCached(prisma)

    expect(systems[0]!.id).toBe('system-free')
    expect(calls()).toBe(2)
  })

  it('cada instância de PrismaService tem a sua cache (isolamento entre testes)', async () => {
    const first = fakePrisma()
    const second = fakePrisma()

    await getSystemsCached(first.prisma)
    await getSystemsCached(second.prisma)

    expect([first.calls(), second.calls()]).toEqual([1, 1])
  })
})

describe('getSystemCached', () => {
  it('serve qualquer systemId da mesma busca única', async () => {
    const { prisma, calls } = fakePrisma()

    const a = await getSystemCached(prisma, 'system-dnd5e')
    const b = await getSystemCached(prisma, 'system-free')

    expect([a.id, b.id]).toEqual(['system-dnd5e', 'system-free'])
    expect(calls()).toBe(1)
  })

  it('systemId inexistente estoura com o valor ofensor na mensagem', async () => {
    const { prisma } = fakePrisma()

    await expect(getSystemCached(prisma, 'system-pathfinder')).rejects.toThrow('system-pathfinder')
  })
})
