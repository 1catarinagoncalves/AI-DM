import { describe, it, expect, beforeAll } from 'vitest'
import { createHmac } from 'crypto'
import { UnauthorizedException, type ExecutionContext } from '@nestjs/common'
import { AuthGuard } from './auth.guard'

function sign(payload: Record<string, unknown>, secret: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url')
  return `${header}.${body}.${sig}`
}

const SECRET = 'segredo-de-teste'

function ctxWith(headers: Record<string, string | undefined>): { ctx: ExecutionContext; req: { user?: unknown } } {
  const req: { headers: Record<string, string | undefined>; user?: unknown } = { headers }
  const ctx = { switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext
  return { ctx, req }
}

describe('AuthGuard (US-61)', () => {
  beforeAll(() => { process.env['AUTH_SECRET'] = SECRET })

  it('anexa a identidade do token em req.user', () => {
    const guard = new AuthGuard()
    const token = sign({ sub: 'user_1', email: 'ana@gmail.com', name: 'Ana' }, SECRET)
    const { ctx, req } = ctxWith({ authorization: `Bearer ${token}` })
    expect(guard.canActivate(ctx)).toBe(true)
    expect(req.user).toEqual({ userId: 'user_1', email: 'ana@gmail.com', name: 'Ana' })
  })

  it('401 sem header Authorization', () => {
    const guard = new AuthGuard()
    const { ctx } = ctxWith({})
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException)
  })

  it('401 com token assinado por outro segredo (spoof)', () => {
    const guard = new AuthGuard()
    const token = sign({ sub: 'user_hacker' }, 'segredo-falso')
    const { ctx } = ctxWith({ authorization: `Bearer ${token}` })
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException)
  })
})
