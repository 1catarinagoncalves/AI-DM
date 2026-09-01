import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import type { PrismaClient } from '../generated/prisma/client'
import type { PrismaService } from '../prisma.service'
import { makeTestPrisma, truncateGameTables } from '../../test/int-db'
import { AuthService } from './auth.service'

// US-201 (risco 1): a reivindicação de órfãos do D1 mora numa transação real. O
// fakePrisma de auth.service.test.ts nunca fala com Postgres — não prova que a
// query `NOT: { OR: [...] }` é sintaxe válida do Prisma Client, só que a lógica em
// TypeScript está certa contra um dublê que aceita qualquer forma. Só um banco de
// verdade prova as duas ordens do risco: conta de dev nascendo antes e depois de
// um login real.

let prisma: PrismaClient
let systemId: string

beforeAll(async () => {
  prisma = makeTestPrisma()
  await prisma.$connect()
  // Seed do system-dnd5e (US-47) já precisa existir no TEST_DATABASE_URL — mesma
  // pré-condição de src/ai/ai.int.test.ts.
  systemId = (await prisma.system.findUniqueOrThrow({ where: { id: 'system-dnd5e' } })).id
})

afterAll(async () => {
  await prisma?.$disconnect()
})

beforeEach(async () => {
  await truncateGameTables(prisma)
})

function svc(): AuthService {
  return new AuthService(prisma as unknown as PrismaService)
}

async function criarOrfao(emailConvidado: string) {
  const guest = await prisma.user.create({ data: { email: emailConvidado, name: 'Jogador' } })
  const character = await prisma.character.create({
    data: { userId: guest.id, systemId, name: 'Órfão', gender: 'x', race: 'human', class: 'fighter', baseAttributes: {} },
  })
  const adventure = await prisma.adventure.create({
    data: { systemId, creatorId: guest.id, title: 'Aventura órfã', order: 1 },
  })
  return { guest, character, adventure }
}

const DEV_EMAIL = 'dev@ai-dm.invalid'
const DEV_NAME = 'Agente de desenvolvimento'

describe('AuthService.sync × Postgres real — conta de dev fora da reivindicação de órfãos (US-201)', () => {
  it('dev primeiro: pnpm dev:token não reivindica, e o login Google real ainda reivindica depois', async () => {
    const { guest, character, adventure } = await criarOrfao('guest_int201a@aidm.local')

    await svc().sync(DEV_EMAIL, DEV_NAME)

    expect((await prisma.character.findUniqueOrThrow({ where: { id: character.id } })).userId).toBe(guest.id)
    expect(await prisma.user.findUnique({ where: { id: guest.id } })).not.toBeNull()

    const ana = await svc().sync('ana-int201@gmail.com', 'Ana')

    expect((await prisma.character.findUniqueOrThrow({ where: { id: character.id } })).userId).toBe(ana.id)
    expect((await prisma.adventure.findUniqueOrThrow({ where: { id: adventure.id } })).creatorId).toBe(ana.id)
    expect(await prisma.user.findUnique({ where: { id: guest.id } })).toBeNull()
  })

  it('dev depois: conta de dev nascendo após um login real não leva os órfãos dele', async () => {
    const real = await prisma.user.create({ data: { email: 'ana-int201b@gmail.com', name: 'Ana' } })
    const { guest, character, adventure } = await criarOrfao('guest_int201b@aidm.local')

    await svc().sync(DEV_EMAIL, DEV_NAME)

    expect((await prisma.character.findUniqueOrThrow({ where: { id: character.id } })).userId).toBe(guest.id)
    expect((await prisma.adventure.findUniqueOrThrow({ where: { id: adventure.id } })).creatorId).toBe(guest.id)
    expect(await prisma.user.findUnique({ where: { id: guest.id } })).not.toBeNull()
    expect(await prisma.user.findUnique({ where: { id: real.id } })).not.toBeNull()
  })
})
