import { describe, it, expect } from 'vitest'
import { AuthService } from './auth.service'
import type { PrismaService } from '../prisma.service'

// Fake prisma em memória: cobre só as operações que o AuthService.sync usa.
interface U { id: string; email: string; name: string }
interface C { id: string; userId: string }
interface A { id: string; creatorId: string }

function fakePrisma(seed: { users?: U[]; characters?: C[]; adventures?: A[] }) {
  const db = {
    users: [...(seed.users ?? [])],
    characters: [...(seed.characters ?? [])],
    adventures: [...(seed.adventures ?? [])],
  }
  let seq = 0
  const tx = {
    user: {
      findUnique: async ({ where: { email } }: { where: { email: string } }) =>
        db.users.find((u) => u.email === email) ?? null,
      update: async ({ where: { email }, data }: { where: { email: string }; data: { name: string } }) => {
        const u = db.users.find((x) => x.email === email)!
        u.name = data.name
        return u
      },
      create: async ({ data }: { data: { email: string; name: string } }) => {
        const u = { id: `real_${++seq}`, ...data }
        db.users.push(u)
        return u
      },
      count: async ({ where }: { where: { NOT: { email: { endsWith: string } } } }) => {
        const suffix = where.NOT.email.endsWith
        return db.users.filter((u) => !u.email.endsWith(suffix)).length
      },
      findMany: async ({ where }: { where: { email: { endsWith: string } } }) => {
        const suffix = where.email.endsWith
        return db.users.filter((u) => u.email.endsWith(suffix)).map((u) => ({ id: u.id }))
      },
      deleteMany: async ({ where: { id } }: { where: { id: { in: string[] } } }) => {
        db.users = db.users.filter((u) => !id.in.includes(u.id))
        return { count: 0 }
      },
    },
    character: {
      updateMany: async ({ where: { userId }, data }: { where: { userId: { in: string[] } }; data: { userId: string } }) => {
        for (const c of db.characters) if (userId.in.includes(c.userId)) c.userId = data.userId
        return { count: 0 }
      },
    },
    adventure: {
      updateMany: async ({ where: { creatorId }, data }: { where: { creatorId: { in: string[] } }; data: { creatorId: string } }) => {
        for (const a of db.adventures) if (creatorId.in.includes(a.creatorId)) a.creatorId = data.creatorId
        return { count: 0 }
      },
    },
  }
  const prisma = {
    $transaction: async <T>(fn: (t: typeof tx) => Promise<T>) => fn(tx),
  } as unknown as PrismaService
  return { prisma, db }
}

describe('AuthService.sync — reivindicação única de órfãos (US-61 D1)', () => {
  it('o PRIMEIRO login real absorve todos os órfãos da era anônima', async () => {
    const { prisma, db } = fakePrisma({
      users: [{ id: 'g1', email: 'guest_abc@aidm.local', name: 'Jogador' }],
      characters: [{ id: 'c1', userId: 'g1' }],
      adventures: [{ id: 'a1', creatorId: 'g1' }],
    })
    const svc = new AuthService(prisma)

    const user = await svc.sync('ana@gmail.com', 'Ana')

    expect(db.characters[0]!.userId).toBe(user.id) // órfão reatribuído
    expect(db.adventures[0]!.creatorId).toBe(user.id)
    expect(db.users.find((u) => u.id === 'g1')).toBeUndefined() // convidado esvaziado, apagado
  })

  it('um SEGUNDO login (conta diferente) NÃO herda órfãos — começa vazio', async () => {
    const { prisma, db } = fakePrisma({
      users: [
        { id: 'real_ana', email: 'ana@gmail.com', name: 'Ana' }, // já existe uma conta real
        { id: 'g2', email: 'guest_xyz@aidm.local', name: 'Jogador' },
      ],
      characters: [{ id: 'c2', userId: 'g2' }],
      adventures: [{ id: 'a2', creatorId: 'g2' }],
    })
    const svc = new AuthService(prisma)

    await svc.sync('bob@gmail.com', 'Bob')

    // Órfão continua com o convidado — Bob não roubou o que era reivindicável.
    expect(db.characters[0]!.userId).toBe('g2')
    expect(db.adventures[0]!.creatorId).toBe('g2')
    expect(db.users.find((u) => u.id === 'g2')).toBeDefined()
  })

  it('re-login de conta existente atualiza o nome e não reivindica nada', async () => {
    const { prisma, db } = fakePrisma({
      users: [{ id: 'real_ana', email: 'ana@gmail.com', name: 'Ana' }],
      characters: [{ id: 'c3', userId: 'g3' }],
      adventures: [],
    })
    const svc = new AuthService(prisma)

    const user = await svc.sync('ana@gmail.com', 'Ana Maria')

    expect(user.id).toBe('real_ana')
    expect(user.name).toBe('Ana Maria')
    expect(db.characters[0]!.userId).toBe('g3') // intacto — existing=true, sem claim
  })
})
