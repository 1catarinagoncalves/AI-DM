import { describe, it, expect } from 'vitest'
import { getSystemCached } from './system-locale'
import type { PrismaService } from '../prisma.service'

// System.config+configLocales é o SRD inteiro (~200KB/linha) — cada `include: { system: true }`
// por turno reenvia esse blob estático pela rede (achado ao investigar consumo do Neon).
// getSystemCached existe pra isso não acontecer mais de uma vez por processo por systemId.
function fakePrisma(): { prisma: PrismaService; calls: () => number } {
  let calls = 0
  const prisma = {
    system: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        calls++
        return { id: where.id, name: where.id, config: {}, configLocales: {} }
      },
    },
  } as unknown as PrismaService
  return { prisma, calls: () => calls }
}

describe('getSystemCached', () => {
  it('busca no banco só na primeira chamada por systemId', async () => {
    const { prisma, calls } = fakePrisma()

    const a = await getSystemCached(prisma, 'system-dnd5e')
    const b = await getSystemCached(prisma, 'system-dnd5e')

    expect(a).toEqual(b)
    expect(calls()).toBe(1)
  })

  it('busca de novo pra um systemId diferente', async () => {
    const { prisma, calls } = fakePrisma()

    const a = await getSystemCached(prisma, 'system-dnd5e')
    const b = await getSystemCached(prisma, 'system-free')

    expect(a.id).toBe('system-dnd5e')
    expect(b.id).toBe('system-free')
    expect(calls()).toBe(2)
  })
})
