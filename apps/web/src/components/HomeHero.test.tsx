import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'

const { listCharacters, deleteCharacter } = vi.hoisted(() => ({
  listCharacters: vi.fn(),
  deleteCharacter: vi.fn(),
}))
vi.mock('@/lib/api', () => ({ api: { listCharacters, deleteCharacter } }))

import { HomeHero } from './HomeHero'

describe('HomeHero — hub orientado a dados (US-25)', () => {
  beforeEach(() => {
    listCharacters.mockReset()
    deleteCharacter.mockReset().mockResolvedValue(undefined)
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

    // US-98: a saudação virou uma frase inteira (o <span> que isolava "Aventureiro"
    // saiu — destacar o miolo exigiria partir a frase em duas chaves). A asserção
    // continua sendo a mesma: genérica, sem o nome do personagem.
    expect(await screen.findByText('Bem-vindo de volta, Aventureiro.')).toBeTruthy()
    expect(screen.queryByText('Gale')).toBeNull()
  })

  it('sem personagens: mostra o convite de criação', async () => {
    listCharacters.mockResolvedValue([])

    render(<HomeHero />)

    expect(await screen.findByText('Criar meu personagem')).toBeTruthy()
    expect(screen.getByText('Você ainda não tem nenhum personagem.')).toBeTruthy()
  })

  describe('delete remove o personagem da lista', () => {
    const lyra = { id: 'char-1', name: 'Lyra Silvermoon', race: 'Elfa', class: 'Maga', level: 1, currentAdventure: null }
    const gale = { id: 'char-2', name: 'Gale', race: 'Humano', class: 'Bardo', level: 2, currentAdventure: null }

    beforeEach(() => vi.spyOn(window, 'confirm').mockReturnValue(true))
    afterEach(() => vi.restoreAllMocks())

    it('deletar o personagem em foco chama a API e tira-o da lista', async () => {
      listCharacters.mockResolvedValue([lyra, gale])

      render(<HomeHero />)
      fireEvent.click(await screen.findByText('Deletar Lyra Silvermoon'))

      await waitFor(() => expect(deleteCharacter).toHaveBeenCalledWith('char-1'))
      // Foco cai no próximo personagem restante.
      expect(await screen.findByText('Gale')).toBeTruthy()
    })

    it('deletar outro personagem chama a API com o id certo', async () => {
      listCharacters.mockResolvedValue([lyra, gale])

      render(<HomeHero />)
      fireEvent.click(await screen.findByText('Ver todos os personagens'))
      fireEvent.click(screen.getByLabelText('Deletar Gale'))

      await waitFor(() => expect(deleteCharacter).toHaveBeenCalledWith('char-2'))
    })

    // US-269: erro sem `role="alert"` não é falado por leitor de tela — a jogadora clica em
    // "Deletar" e nada acontece, para quem não enxerga.
    it('delete que falha mostra o erro, anunciado como alerta', async () => {
      listCharacters.mockResolvedValue([lyra])
      deleteCharacter.mockRejectedValue(new Error('boom'))

      render(<HomeHero />)
      fireEvent.click(await screen.findByText('Deletar Lyra Silvermoon'))

      const alert = await screen.findByRole('alert')
      expect(alert.textContent).toBe('Não foi possível deletar o personagem. Tente de novo.')
    })
  })

  it('falha ao carregar os personagens mostra o erro anunciado como alerta, com "Tentar de novo"', async () => {
    listCharacters.mockRejectedValue(new Error('boom'))

    render(<HomeHero />)

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe('Não foi possível carregar seus personagens.')
    expect(screen.getByRole('button', { name: /Tentar de novo/ })).toBeTruthy()
  })
})
