import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, fireEvent, waitFor, screen } from '@testing-library/react'
import axe from 'axe-core'

// US-46: regressão de acessibilidade. axe roda sobre as três superfícies principais
// e não pode acusar violações AA de nome, rótulo e ARIA.
//
// Nota: em happy-dom (sem layout/canvas real) a regra `color-contrast` não consegue
// medir cores — fica "incomplete", nunca "violation". O contraste é garantido à mão
// nos tokens (ver US-46) e não por axe aqui, então desligamos essa regra.
// `region` também é desligada: cada componente é renderizado isolado, sem o <main>
// do layout — o landmark é verificado pela estrutura do layout, não por unidade.
const AXE_OPTIONS = {
  rules: {
    'color-contrast': { enabled: false },
    region: { enabled: false },
  },
} as const

async function expectNoViolations(container: HTMLElement) {
  const results = await axe.run(container, AXE_OPTIONS)
  const summary = results.violations.map(v => `${v.id}: ${v.nodes.length}× — ${v.help}`)
  expect(summary).toEqual([])
}

// --- Mocks compartilhados dos módulos de dados/sessão ---
const { listCharacters, getTurns, listSystems, createUser } = vi.hoisted(() => ({
  listCharacters: vi.fn(),
  getTurns: vi.fn(),
  listSystems: vi.fn(),
  createUser: vi.fn(),
}))
vi.mock('@/lib/api', () => ({ api: { listCharacters, getTurns, listSystems, createUser } }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/lib/session', () => ({
  loadSession: () => ({ userId: 'u1', userName: 'Lyra' }),
  saveSession: vi.fn(),
}))

import { HomeHero } from './HomeHero'
import { GameView } from './game/GameView'
import { SetupWizard } from './setup/SetupWizard'

beforeEach(() => {
  listCharacters.mockReset().mockResolvedValue([
    { id: 'char-1', name: 'Lyra Silvermoon', race: 'Elfa', class: 'Maga', level: 1, currentAdventure: { id: 'adv-1', title: 'A Mina Perdida' } },
  ])
  getTurns.mockReset().mockResolvedValue([])
  listSystems.mockReset().mockResolvedValue([])
  createUser.mockReset().mockResolvedValue({ id: 'u1' })
  // happy-dom não implementa scrollIntoView; a GameView chama no efeito de mensagens.
  Element.prototype.scrollIntoView = vi.fn()
})
afterEach(() => cleanup())

const gameProps = {
  adventureId: 'adv-1',
  characterId: 'char-1',
  characterName: 'Lyra Silvermoon',
  characterClass: 'Maga',
  characterRace: 'Elfa',
  hp: 10,
  maxHp: 10,
  attributes: { strength: 16, dexterity: 12 },
  skills: [{ key: 'arcana', label: 'Arcana', modifier: 3, proficient: true }],
  conditions: ['Envenenado'],
  inventory: [{ name: 'Adaga', qty: 1 }],
  background: { story: 'Nasceu à beira do rio.', ideals: ['Justiça'] },
}

describe('US-46 — acessibilidade (axe) das superfícies principais', () => {
  it('HomeHero (hub) não tem violações de nome/rótulo/ARIA', async () => {
    const { container } = render(<HomeHero />)
    await screen.findByText('Lyra Silvermoon')
    await expectNoViolations(container)
  })

  it('GameView (jogo) não tem violações de nome/rótulo/ARIA', async () => {
    const { container } = render(<GameView {...gameProps} />)
    await screen.findByText('Atributos')
    await expectNoViolations(container)
  })

  it('SetupWizard (criação) não tem violações de nome/rótulo/ARIA', async () => {
    const { container } = render(<SetupWizard />)
    await screen.findByText('Escolha o Sistema')
    await expectNoViolations(container)
  })
})

describe('US-46 — GameView operável por teclado', () => {
  it('escreve uma ação e envia com Enter, sem mouse', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      body: new ReadableStream({
        start(c) {
          c.enqueue(new TextEncoder().encode('0:"O Mestre responde."\n'))
          c.close()
        },
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<GameView {...gameProps} />)

    // Campo alcançado pelo nome acessível (aria-label), não por posição/mouse.
    const field = await screen.findByRole('textbox', { name: 'A tua ação' })
    fireEvent.change(field, { target: { value: 'Ataco o goblin' } })
    // Enter (sem Shift) envia — caminho de teclado da GameView.
    fireEvent.keyDown(field, { key: 'Enter', shiftKey: false })

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/chat')
    const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string)
    expect(body.message).toBe('Ataco o goblin')

    vi.unstubAllGlobals()
  })
})
