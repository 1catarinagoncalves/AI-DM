import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

const { listCharacters } = vi.hoisted(() => ({ listCharacters: vi.fn() }))
vi.mock('@/lib/api', () => ({ api: { listCharacters } }))
vi.mock('@/lib/session', () => ({
  loadSession: () => ({ userId: 'u1', userName: 'Lyra' }),
}))

import { HomeHero } from './HomeHero'

describe('HomeHero — hub orientado a dados (US-25)', () => {
  beforeEach(() => listCharacters.mockReset())
  afterEach(() => cleanup())

  it('com personagem + aventura: mostra nome, título e Continuar jogando apontando para a aventura', async () => {
    listCharacters.mockResolvedValue([
      { id: 'char-1', name: 'Lyra Silvermoon', race: 'Elfa', class: 'Maga', level: 1, currentAdventure: { id: 'adv-1', title: 'A Mina Perdida' } },
    ])

    render(<HomeHero />)

    expect(await screen.findByText('Lyra Silvermoon')).toBeTruthy()
    expect(screen.getByText('A Mina Perdida')).toBeTruthy()
    const link = screen.getByText('Continuar jogando').closest('a')
    expect(link?.getAttribute('href')).toBe('/play/adv-1?characterId=char-1')
  })

  it('sem personagens: mostra o convite de criação', async () => {
    listCharacters.mockResolvedValue([])

    render(<HomeHero />)

    expect(await screen.findByText('Criar meu personagem')).toBeTruthy()
    expect(screen.getByText('Você ainda não tem nenhum personagem.')).toBeTruthy()
  })
})
