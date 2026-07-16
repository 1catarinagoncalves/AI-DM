import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'

const { listCharacters, deleteCharacter } = vi.hoisted(() => ({
  listCharacters: vi.fn(),
  deleteCharacter: vi.fn(),
}))
vi.mock('@/lib/api', () => ({ api: { listCharacters, deleteCharacter } }))
const { loadSession, saveSession } = vi.hoisted(() => ({ loadSession: vi.fn(), saveSession: vi.fn() }))
vi.mock('@/lib/session', () => ({ loadSession, saveSession }))

import { HomeHero } from './HomeHero'

// `userName` é resquício de sessão antiga (personagem já deletado): a saudação
// tem que ignorar, não ressuscitar o nome.
const sessionOn = (characterId: string) => ({
  userId: 'u1',
  userName: 'Gale',
  characterId,
  characterName: 'Lyra Silvermoon',
  adventureId: 'adv-1',
})

describe('HomeHero — hub orientado a dados (US-25)', () => {
  beforeEach(() => {
    listCharacters.mockReset()
    deleteCharacter.mockReset().mockResolvedValue(undefined)
    saveSession.mockReset()
    loadSession.mockReset().mockReturnValue(sessionOn('char-1'))
  })
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

  it('saudação é genérica: ignora nome de personagem preso na sessão', async () => {
    listCharacters.mockResolvedValue([
      { id: 'char-1', name: 'Lyra Silvermoon', race: 'Elfa', class: 'Maga', level: 1, currentAdventure: null },
    ])

    render(<HomeHero />)

    expect(await screen.findByText('Aventureiro')).toBeTruthy()
    expect(screen.queryByText('Gale')).toBeNull()
  })

  it('sem personagens: mostra o convite de criação', async () => {
    listCharacters.mockResolvedValue([])

    render(<HomeHero />)

    expect(await screen.findByText('Criar meu personagem')).toBeTruthy()
    expect(screen.getByText('Você ainda não tem nenhum personagem.')).toBeTruthy()
  })

  describe('delete não deixa id morto na sessão', () => {
    const lyra = { id: 'char-1', name: 'Lyra Silvermoon', race: 'Elfa', class: 'Maga', level: 1, currentAdventure: null }
    const gale = { id: 'char-2', name: 'Gale', race: 'Humano', class: 'Bardo', level: 2, currentAdventure: null }

    beforeEach(() => vi.spyOn(window, 'confirm').mockReturnValue(true))
    afterEach(() => vi.restoreAllMocks())

    it('deletar o personagem apontado pela sessão zera os campos dele e preserva o userId', async () => {
      listCharacters.mockResolvedValue([lyra, gale])

      render(<HomeHero />)
      fireEvent.click(await screen.findByText('Deletar Lyra Silvermoon'))

      await waitFor(() => expect(saveSession).toHaveBeenCalledTimes(1))
      // Sessão = "onde eu estava jogando". Personagem apagado ⇒ não estou em lugar nenhum.
      // O userName legado também some: não faz parte de GameSession.
      expect(saveSession).toHaveBeenCalledWith({
        userId: 'u1',
        characterId: '',
        characterName: '',
        adventureId: '',
      })
    })

    it('deletar outro personagem não mexe na sessão', async () => {
      listCharacters.mockResolvedValue([lyra, gale])

      render(<HomeHero />)
      fireEvent.click(await screen.findByText('Ver todos os personagens'))
      fireEvent.click(screen.getByLabelText('Deletar Gale'))

      await waitFor(() => expect(deleteCharacter).toHaveBeenCalledWith('char-2'))
      expect(saveSession).not.toHaveBeenCalled()
    })

    it('delete que falha não zera a sessão', async () => {
      listCharacters.mockResolvedValue([lyra])
      deleteCharacter.mockRejectedValue(new Error('boom'))

      render(<HomeHero />)
      fireEvent.click(await screen.findByText('Deletar Lyra Silvermoon'))

      await screen.findByText('Não foi possível deletar o personagem. Tente de novo.')
      expect(saveSession).not.toHaveBeenCalled()
    })
  })
})
