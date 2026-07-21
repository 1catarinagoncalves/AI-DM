import { createHmac, timingSafeEqual } from 'crypto'

// US-61 (D2): a API verifica o JWT HS256 emitido pelo web (Auth.js) com o
// AUTH_SECRET compartilhado. Verificação manual com `crypto` (HMAC-SHA256) para
// não puxar dependência nova na API — o web assina com `jose` no MESMO algoritmo
// (`header.payload` em base64url), então assinar/verificar batem byte a byte.

export interface JwtPayload {
  // Identidade derivada do token. `sub` = userId real (tokens pós-login); ausente
  // no token de bootstrap do primeiro login, que só carrega email/name.
  sub?: string
  email?: string
  name?: string
  iat?: number
  exp?: number
}

function b64urlToBuffer(s: string): Buffer {
  return Buffer.from(s, 'base64url')
}

/**
 * Verifica um JWT HS256 e devolve o payload. Lança se o formato, algoritmo,
 * assinatura ou expiração forem inválidos — o guard traduz para 401.
 */
export function verifyJwt(token: string, secret: string): JwtPayload {
  if (!secret) throw new Error('AUTH_SECRET ausente na API')

  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('Formato de token inválido')
  const [headerB64, payloadB64, signatureB64] = parts as [string, string, string]

  const header = JSON.parse(b64urlToBuffer(headerB64).toString('utf8')) as { alg?: string; typ?: string }
  if (header.alg !== 'HS256') throw new Error(`Algoritmo não suportado: ${header.alg}`)

  const expected = createHmac('sha256', secret).update(`${headerB64}.${payloadB64}`).digest()
  const provided = b64urlToBuffer(signatureB64)
  // timingSafeEqual exige buffers do mesmo tamanho — checa antes para não vazar
  // o comprimento nem lançar RangeError com assinatura truncada.
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    throw new Error('Assinatura inválida')
  }

  const payload = JSON.parse(b64urlToBuffer(payloadB64).toString('utf8')) as JwtPayload
  if (typeof payload.exp === 'number' && Date.now() / 1000 > payload.exp) {
    throw new Error('Token expirado')
  }
  return payload
}
