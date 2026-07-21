import { describe, it, expect } from 'vitest'
import { createHmac } from 'crypto'
import { verifyJwt } from './jwt'

// Assinador HS256 local (espelha o que o web faz com `jose`) — só para os testes.
function sign(payload: Record<string, unknown>, secret: string, alg = 'HS256'): string {
  const header = Buffer.from(JSON.stringify({ alg, typ: 'JWT' })).toString('base64url')
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url')
  return `${header}.${body}.${sig}`
}

const SECRET = 'segredo-compartilhado-web-api'

describe('verifyJwt (US-61)', () => {
  it('aceita token válido e devolve o payload', () => {
    const token = sign({ sub: 'user_1', email: 'ana@gmail.com' }, SECRET)
    expect(verifyJwt(token, SECRET)).toMatchObject({ sub: 'user_1', email: 'ana@gmail.com' })
  })

  it('rejeita assinatura feita com outro segredo', () => {
    const token = sign({ sub: 'user_1' }, 'outro-segredo')
    expect(() => verifyJwt(token, SECRET)).toThrow()
  })

  it('rejeita token adulterado (payload trocado sem re-assinar)', () => {
    const token = sign({ sub: 'user_1' }, SECRET)
    const [h, , s] = token.split('.')
    const forged = Buffer.from(JSON.stringify({ sub: 'user_2' })).toString('base64url')
    expect(() => verifyJwt(`${h}.${forged}.${s}`, SECRET)).toThrow()
  })

  it('rejeita token expirado', () => {
    const token = sign({ sub: 'user_1', exp: Math.floor(Date.now() / 1000) - 10 }, SECRET)
    expect(() => verifyJwt(token, SECRET)).toThrow('Token expirado')
  })

  it('rejeita algoritmo não-HS256 (defesa contra alg=none)', () => {
    const token = sign({ sub: 'user_1' }, SECRET, 'none')
    expect(() => verifyJwt(token, SECRET)).toThrow()
  })

  it('rejeita formato malformado', () => {
    expect(() => verifyJwt('nao-e-um-jwt', SECRET)).toThrow()
  })
})
