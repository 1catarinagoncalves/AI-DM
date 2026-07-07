import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react'

const { listSystems, createCharacter, createUser, getInitialAdventure, createAdventure } = vi.hoisted(() => ({
  listSystems: vi.fn(),
  createCharacter: vi.fn(),
  createUser: vi.fn(),
  getInitialAdventure: vi.fn(),
  createAdventure: vi.fn(),
}))
vi.mock('@/lib/api', () => ({ api: { listSystems, createCharacter, createUser, getInitialAdventure, createAdventure } }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/lib/session', () => ({
  loadSession: () => ({ userId: 'u1' }),
  saveSession: vi.fn(),
}))

import { SetupWizard } from './SetupWizard'

const configWithBudget = (budget: number) => ({
  attributes: [{ key: 'strength', label: 'Força', min: 8, max: 15, default: 8 }],
  startingKits: { default: [] },
  pointBuy: { budget },
})

describe('SetupWizard — catálogo de sistemas via API (US-20)', () => {
  beforeEach(() => listSystems.mockReset())
  afterEach(() => cleanup())

  it('renderiza uma opção por sistema devolvido pela API, com o name da API', async () => {
    listSystems.mockResolvedValue([
      { id: 'system-free', name: 'Free', sourceType: 'FREE', config: null },
      { id: 'system-dnd5e', name: 'D&D 5e SRD', sourceType: 'SRD', config: null },
    ])
    render(<SetupWizard />)
    expect(await screen.findByText('Free')).toBeTruthy()
    expect(screen.getByText('D&D 5e SRD')).toBeTruthy()
  })
})

describe('SetupWizard — criação em etapas (US-26)', () => {
  beforeEach(() => {
    listSystems.mockReset()
    createCharacter.mockReset()
    getInitialAdventure.mockReset()
    createAdventure.mockReset()
    getInitialAdventure.mockResolvedValue({ id: 'hook-1', title: 'Aventura', pitch: 'p', openingNarration: 'n' })
  })
  afterEach(() => cleanup())

  async function pickSystemAndFillRaceClass(config = configWithBudget(2)) {
    listSystems.mockResolvedValue([{ id: 'sys-1', name: 'D&D 5e SRD', sourceType: 'SRD', config }])
    render(<SetupWizard />)
    fireEvent.click(await screen.findByText('D&D 5e SRD'))
    fireEvent.change(screen.getByLabelText('Nome do personagem'), { target: { value: 'Lyra' } })
    fireEvent.change(screen.getByLabelText('Género'), { target: { value: 'Feminino' } })
    fireEvent.change(screen.getByLabelText('Raça'), { target: { value: 'Elfo' } })
    fireEvent.change(screen.getByLabelText('Classe'), { target: { value: 'Mago' } })
  }

  it('navegação ida-e-volta preserva o preenchimento e marca estados na trilha', async () => {
    await pickSystemAndFillRaceClass()

    // avança para Atributos
    fireEvent.click(screen.getByRole('button', { name: /Próximo/ }))
    expect(screen.getByRole('heading', { name: 'Atributos' })).toBeTruthy()

    // trilha: Raça/Classe concluída, Atributos atual
    expect(screen.getByRole('button', { name: /Raça\/Classe/ }).getAttribute('data-state')).toBe('concluída')
    expect(screen.getByRole('button', { name: /Atributos/ }).getAttribute('data-state')).toBe('atual')

    // volta para Raça/Classe e avança de novo — valores mantidos
    fireEvent.click(screen.getByRole('button', { name: /Voltar/ }))
    expect((screen.getByLabelText('Nome do personagem') as HTMLInputElement).value).toBe('Lyra')
    expect((screen.getByLabelText('Classe') as HTMLSelectElement).value).toBe('Mago')
    fireEvent.click(screen.getByRole('button', { name: /Próximo/ }))
    expect(screen.getByRole('heading', { name: 'Atributos' })).toBeTruthy()
  })

  it('point-buy bloqueia Próximo até o orçamento fechar exatamente', async () => {
    await pickSystemAndFillRaceClass(configWithBudget(2))
    fireEvent.click(screen.getByRole('button', { name: /Próximo/ }))

    const nextBtn = () => screen.getByRole('button', { name: /Próximo/ }) as HTMLButtonElement
    // sobra 2 pontos → bloqueado
    expect(nextBtn().disabled).toBe(true)

    const inc = screen.getByLabelText('Aumentar Força')
    fireEvent.click(inc) // 9, sobra 1 → ainda bloqueado
    expect(nextBtn().disabled).toBe(true)
    fireEvent.click(inc) // 10, sobra 0 → libera
    expect(nextBtn().disabled).toBe(false)
  })

  it('cria o personagem uma única vez ao Confirmar na Revisão', async () => {
    createCharacter.mockResolvedValue({ id: 'char-1', name: 'Lyra' })
    await pickSystemAndFillRaceClass(configWithBudget(2))

    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → atributos
    const inc = screen.getByLabelText('Aumentar Força')
    fireEvent.click(inc); fireEvent.click(inc) // fecha orçamento
    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → perícias

    const skillInputs = [1, 2, 3].map(n => screen.getByLabelText(`Perícia ${n}`))
    skillInputs.forEach((el, i) => fireEvent.change(el, { target: { value: `Perícia${i}` } }))
    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → revisão

    const review = screen.getByRole('heading', { name: 'Revisão' })
    expect(review).toBeTruthy()
    expect(createCharacter).not.toHaveBeenCalled() // nada criado antes de confirmar

    fireEvent.click(screen.getByRole('button', { name: /Confirmar personagem/ }))
    expect(createCharacter).toHaveBeenCalledTimes(1)
  })

  // US-28: depois de Confirmar, o jogador vê a etapa "Aventura inicial" e a inicia.
  it('mostra a aventura inicial da classe e inicia-a ao confirmar', async () => {
    createCharacter.mockResolvedValue({ id: 'char-1', name: 'Lyra' })
    createAdventure.mockResolvedValue({ id: 'adv-1', title: 'Aventura' })
    await pickSystemAndFillRaceClass(configWithBudget(2))

    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → atributos
    const inc = screen.getByLabelText('Aumentar Força')
    fireEvent.click(inc); fireEvent.click(inc)
    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → perícias
    ;[1, 2, 3].forEach(n => fireEvent.change(screen.getByLabelText(`Perícia ${n}`), { target: { value: `P${n}` } }))
    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → revisão
    fireEvent.click(screen.getByRole('button', { name: /Confirmar personagem/ }))

    // Etapa Aventura inicial aparece com o gancho resolvido pela API.
    const start = await screen.findByRole('button', { name: /Iniciar aventura/ })
    expect(getInitialAdventure).toHaveBeenCalledWith('char-1')
    expect(screen.getByRole('heading', { name: 'Aventura' })).toBeTruthy()

    fireEvent.click(start)
    expect(createAdventure).toHaveBeenCalledWith('char-1', 'hook-1')
  })
})
