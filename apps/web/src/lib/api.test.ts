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
