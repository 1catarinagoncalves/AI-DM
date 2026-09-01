import { describe, it, expect, afterEach, vi } from 'vitest'

// US-201 (critério de aceite (b), decisão 3): afirma contra o array `providers`
// DE VERDADE que auth-providers.ts exporta — não uma cópia da condição
// `NODE_ENV`/`DEV_LOGIN`, que continuaria passando mesmo depois de alguém apagar a
// porta dupla do código. `NODE_ENV`/`DEV_LOGIN` só valem no MÓDULO carregado após
// setá-los — daí o `vi.resetModules()` + import dinâmico em cada cenário.
// `vi.stubEnv` e não atribuição direta: o Next tipa `NODE_ENV` como readonly em
// `ProcessEnv`. Importa `auth-providers.ts` e não `auth.ts` (que reexporta o mesmo
// array): `auth.ts` chama `NextAuth(...)`, que puxa `next/server` e quebra sob
// Vitest fora de um build do Next — ver o comentário no topo de auth-providers.ts.

afterEach(() => {
  vi.unstubAllEnvs()
})

async function loadProviders() {
  vi.resetModules()
  const { providers } = await import('./auth-providers')
  return providers
}

// `Credentials({ id: 'dev', ... })` não devolve `{ id: 'dev' }` direto: o override
// fica em `.options` até o `NextAuth()` de auth.ts fazer o merge final em runtime
// (comportamento do Auth.js v5, não algo que este teste reimplementa).
function hasDevProvider(providers: unknown[]): boolean {
  return providers.some((p) => (p as { options?: { id?: string } }).options?.id === 'dev')
}

describe('providers de login (US-201)', () => {
  it('não registra o provider de dev em produção, mesmo com DEV_LOGIN=1', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('DEV_LOGIN', '1')
    const providers = await loadProviders()
    expect(hasDevProvider(providers)).toBe(false)
  })

  it('não registra o provider de dev fora de produção sem DEV_LOGIN=1', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('DEV_LOGIN', '')
    const providers = await loadProviders()
    expect(hasDevProvider(providers)).toBe(false)
  })

  it('registra o provider de dev só com as duas condições satisfeitas', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('DEV_LOGIN', '1')
    const providers = await loadProviders()
    expect(hasDevProvider(providers)).toBe(true)
  })
})
