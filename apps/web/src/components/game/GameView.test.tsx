import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'

const { getTurns } = vi.hoisted(() => ({ getTurns: vi.fn() }))
vi.mock('@/lib/api', () => ({ api: { getTurns } }))
vi.mock('@/lib/session', () => ({ loadSession: () => null, saveSession: vi.fn() }))

import { GameView } from './GameView'

// happy-dom não implementa scrollIntoView; a GameView chama no efeito de mensagens.
beforeEach(() => {
  getTurns.mockResolvedValue([])
  Element.prototype.scrollIntoView = vi.fn()
})
afterEach(() => cleanup())

const baseProps = {
  adventureId: 'adv-1',
  characterId: 'char-1',
  characterName: 'Lyra Silvermoon',
  characterClass: 'Maga',
  characterRace: 'Elfa',
  hp: 10,
  maxHp: 10,
  attributes: { strength: 16, dexterity: 12 },
  skills: [{ key: 'arcana', label: 'Arcana', modifier: 3, proficient: true }],
  conditions: [],
  inventory: [],
}

describe('GameView — abas na ficha (US-45)', () => {
  it('abre na aba Ficha (mecânica) e não mostra o background antes de trocar de aba', async () => {
    render(
      <GameView
        {...baseProps}
        background={{ story: 'Nasceu numa vila à beira do rio.', flaws: ['Teme o fogo.'] }}
      />,
    )

    // Aba Ficha é a padrão: atributos visíveis.
    expect(await screen.findByText('Atributos')).toBeTruthy()
    expect(screen.getByText('FOR')).toBeTruthy()
    // Background ainda não renderizado.
    expect(screen.queryByText('Nasceu numa vila à beira do rio.')).toBeNull()

    // As duas abas existem.
    expect(screen.getByRole('tab', { name: 'Ficha' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Background' })).toBeTruthy()
  })

  it('ao clicar na aba Background mostra a história e uma fraqueza', async () => {
    render(
      <GameView
        {...baseProps}
        background={{ story: 'Nasceu numa vila à beira do rio.', flaws: ['Teme o fogo.'] }}
      />,
    )

    fireEvent.click(await screen.findByRole('tab', { name: 'Background' }))

    expect(await screen.findByText('Nasceu numa vila à beira do rio.')).toBeTruthy()
    expect(screen.getByText('Teme o fogo.')).toBeTruthy()
    // Trocou de aba: a mecânica saiu de vista.
    expect(screen.queryByText('Atributos')).toBeNull()
  })

  it('com background vazio ({}) a aba Background continua presente e mostra o empty state', async () => {
    render(<GameView {...baseProps} background={{}} />)

    const bgTab = await screen.findByRole('tab', { name: 'Background' })
    fireEvent.click(bgTab)

    expect(screen.getByText('Este personagem ainda não tem história.')).toBeTruthy()
    // Nenhum bloco fantasma.
    expect(screen.queryByText('Ideais')).toBeNull()
    expect(screen.queryByText('Fraquezas')).toBeNull()
  })

  it('HP fica fixo acima das abas e continua visível na aba Background', async () => {
    render(<GameView {...baseProps} background={{ story: 'História.' }} />)

    expect(await screen.findByText('10/10')).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: 'Background' }))
    // HP não pertence a nenhuma aba — segue visível.
    expect(screen.getByText('10/10')).toBeTruthy()
  })
})
