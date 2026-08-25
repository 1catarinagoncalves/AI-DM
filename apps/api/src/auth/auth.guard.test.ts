import { describe, it, expect, beforeAll } from 'vitest'
import { createHmac } from 'crypto'
import { UnauthorizedException, type ExecutionContext } from '@nestjs/common'
import { AuthGuard, OptionalAuthGuard } from './auth.guard'
import type { PrismaService } from '../prisma.service'

function sign(payload: Record<string, unknown>, secret: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url')
  return `${header}.${body}.${sig}`
}

const SECRET = 'segredo-de-teste'

// 25/08/2026: o guard passou a confirmar que o `sub` do token tem linha em `User`.
// Fake nomeada porque é I/O externo (AGENTS.md) — o guard só toca `user.count`.
class FakeUserTable {
  user: { count: (args: { where: { id: string } }) => Promise<number> }
  constructor(knownIds: string[]) {
    this.user = { count: async ({ where }) => (knownIds.includes(where.id) ? 1 : 0) }
  }
}

function prismaWith(...knownIds: string[]): PrismaService {
  return new FakeUserTable(knownIds) as unknown as PrismaService
}

function ctxWith(headers: Record<string, string | undefined>): { ctx: ExecutionContext; req: { user?: unknown } } {
  const req: { headers: Record<string, string | undefined>; user?: unknown } = { headers }
  const ctx = { switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext
  return { ctx, req }
}

describe('AuthGuard (US-61)', () => {
  beforeAll(() => { process.env['AUTH_SECRET'] = SECRET })

  it('anexa a identidade do token em req.user', async () => {
    const guard = new AuthGuard(prismaWith('user_1'))
    const token = sign({ sub: 'user_1', email: 'ana@gmail.com', name: 'Ana' }, SECRET)
    const { ctx, req } = ctxWith({ authorization: `Bearer ${token}` })
    expect(await guard.canActivate(ctx)).toBe(true)
    expect(req.user).toEqual({ userId: 'user_1', email: 'ana@gmail.com', name: 'Ana' })
  })

  it('401 sem header Authorization', async () => {
    const guard = new AuthGuard(prismaWith('user_1'))
    const { ctx } = ctxWith({})
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException)
  })

  it('401 com token assinado por outro segredo (spoof)', async () => {
    const guard = new AuthGuard(prismaWith('user_1'))
    const token = sign({ sub: 'user_hacker' }, 'segredo-falso')
    const { ctx } = ctxWith({ authorization: `Bearer ${token}` })
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException)
  })

  // Regressão 25/08/2026: token bem assinado com `sub` que não existe no banco atravessava
  // o guard e só estourava no INSERT, como 500 (`Character_userId_fkey`).
  it('401 quando o `sub` do token não tem conta no banco', async () => {
    const guard = new AuthGuard(prismaWith('user_1'))
    const token = sign({ sub: 'user_apagado', email: 'ana@gmail.com' }, SECRET)
    const { ctx, req } = ctxWith({ authorization: `Bearer ${token}` })
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException)
    expect(req.user).toBeUndefined()
  })

  // O token de bootstrap do login (auth.ts) prova o email verificado pelo Google e ainda
  // NÃO tem `sub` — é ele que vai criar a conta no /auth/sync. Barrá-lo trancaria o login.
  it('deixa passar o token de bootstrap (sem sub) sem tocar no banco', async () => {
    const guard = new AuthGuard(prismaWith())
    const token = sign({ email: 'ana@gmail.com', name: 'Ana' }, SECRET)
    const { ctx, req } = ctxWith({ authorization: `Bearer ${token}` })
    expect(await guard.canActivate(ctx)).toBe(true)
    expect(req.user).toMatchObject({ email: 'ana@gmail.com' })
  })
})

describe('OptionalAuthGuard (US-99)', () => {
  beforeAll(() => { process.env['AUTH_SECRET'] = SECRET })

  it('deixa passar SEM header e não inventa identidade', async () => {
    // O health check do Render bate em GET /systems sem token (render.yaml). 401 aqui
    // marcaria o serviço unhealthy e derrubaria o deploy.
    const guard = new OptionalAuthGuard(prismaWith('user_1'))
    const { ctx, req } = ctxWith({})
    expect(await guard.canActivate(ctx)).toBe(true)
    expect(req.user).toBeUndefined()
  })

  it('anexa a identidade quando o token é válido', async () => {
    const guard = new OptionalAuthGuard(prismaWith('user_1'))
    const token = sign({ sub: 'user_1', email: 'ana@gmail.com' }, SECRET)
    const { ctx, req } = ctxWith({ authorization: `Bearer ${token}` })
    expect(await guard.canActivate(ctx)).toBe(true)
    expect(req.user).toMatchObject({ userId: 'user_1' })
  })

  it('token inválido passa como anônimo — nunca como o dono que ele alega ser', async () => {
    const guard = new OptionalAuthGuard(prismaWith('user_1'))
    const token = sign({ sub: 'user_hacker' }, 'segredo-falso')
    const { ctx, req } = ctxWith({ authorization: `Bearer ${token}` })
    expect(await guard.canActivate(ctx)).toBe(true)
    expect(req.user).toBeUndefined()
  })

  it('conta inexistente vira anônimo em vez de 401 (rota pública)', async () => {
    const guard = new OptionalAuthGuard(prismaWith('user_1'))
    const token = sign({ sub: 'user_apagado' }, SECRET)
    const { ctx, req } = ctxWith({ authorization: `Bearer ${token}` })
    expect(await guard.canActivate(ctx)).toBe(true)
    expect(req.user).toBeUndefined()
  })
})
