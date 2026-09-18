import { describe, it, expect, vi, beforeEach } from 'vitest'
import { signOut } from 'next-auth/react'
import { api } from './api'

vi.mock('next-auth/react', () => ({ signOut: vi.fn() }))

function respondWith(status: number, body: string): void {
  global.fetch = vi.fn(async () => new Response(body, { status })) as unknown as typeof fetch
}

// Regressão 25/08/2026: a API passou a devolver 401 quando o `sub` do token não tem conta
// (AuthGuard). Sem deslogar aqui o jogador ficava preso no erro até o cookie de 30 dias
// expirar — o `/auth/sync` só corre no primeiro login.
describe('api — sessão que a API não reconhece', () => {
  beforeEach(() => { vi.mocked(signOut).mockClear() })

  it('401 desloga e leva ao login', async () => {
    respondWith(401, 'Sessão de utilizador desconhecido')
    await expect(api.listCharacters()).rejects.toThrow('Sessão de utilizador desconhecido')
    expect(signOut).toHaveBeenCalledWith({ callbackUrl: '/login' })
  })

  it('erro que não é 401 não desloga ninguém', async () => {
    respondWith(500, 'Boom')
    await expect(api.createCharacter({ systemId: 'dnd5e', name: 'Thorin', gender: 'M', race: 'dwarf', class: 'fighter', attributes: {} })).rejects.toThrow('Boom')
    expect(signOut).not.toHaveBeenCalled()
  })
})

// US-256: o botão "Tentar de novo" do chat reinicia SÓ o resto da aventura (1B) — POST sem
// corpo útil no sub-recurso da aventura, resposta `{ status }` ('OPENING_READY' = reiniciou).
describe('api — retryAdventureRest (US-256)', () => {
  it('POST /characters/:c/adventures/:a/retry-rest com corpo {} e devolve o status', async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify({ status: 'OPENING_READY' }), { status: 201 })) as unknown as typeof fetch

    await expect(api.retryAdventureRest('char-1', 'adv-1')).resolves.toEqual({ status: 'OPENING_READY' })

    const [url, init] = vi.mocked(global.fetch).mock.calls[0]!
    expect(String(url)).toMatch(/\/api\/v1\/characters\/char-1\/adventures\/adv-1\/retry-rest$/)
    expect(init?.method).toBe('POST')
    expect(init?.body).toBe('{}')
  })

  it('erro da API propaga (o chamador descarta e mostra chave de i18n)', async () => {
    respondWith(409, 'A fatia não existe')
    await expect(api.retryAdventureRest('char-1', 'adv-1')).rejects.toThrow('A fatia não existe')
  })
})
