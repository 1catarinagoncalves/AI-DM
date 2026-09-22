import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'

// US-258: fake class nomeada (não stub inline) — guarda cada DTO recebido, para o teste afirmar
// QUANTOS personagens o wizard tentou gravar, que é o defeito (voltar + confirmar de novo
// criava um segundo).
const { fakeApi } = vi.hoisted(() => {
  class FakeSetupApi {
    createCharacterCalls: unknown[] = []
    async listSystems() {
      return [{
        id: 'sys-1', name: 'D&D 5e SRD', sourceType: 'SRD',
        config: {
          attributes: [{ key: 'strength', label: 'Força', min: 8, max: 15, default: 8 }],
          startingKits: { default: [] },
          pointBuy: { budget: 2 },
          races: [{ key: 'elf', label: 'Elfo' }],
          classes: [{ key: 'wizard', label: 'Mago' }],
          alignments: [{ key: 'lawful-good', label: 'Leal e Bom' }],
        },
      }]
    }
    async createCharacter(dto: unknown) {
      this.createCharacterCalls.push(dto)
      return { id: 'char-1', name: 'Lyra' }
    }
  }
  return { fakeApi: new FakeSetupApi() }
})
vi.mock('@/lib/api', () => ({ api: fakeApi }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

import { SetupWizard } from './SetupWizard'

const next = () => fireEvent.click(screen.getByRole('button', { name: /Próximo/ }))

// Mesmo caminho de `reachWorldStep` em SetupWizard.test.tsx, parando na revisão.
async function reachReview() {
  render(<SetupWizard />)
  fireEvent.click(await screen.findByText('D&D 5e SRD'))
  fireEvent.click(screen.getByRole('radio', { name: 'Mago' }))
  next() // → raça
  fireEvent.click(screen.getByRole('radio', { name: 'Elfo' }))
  next() // → background
  next() // → atributos
  const inc = screen.getByLabelText('Aumentar Força')
  fireEvent.click(inc); fireEvent.click(inc)
  next() // → perícias
  next() // → magias
  next() // → identidade
  fireEvent.change(screen.getByLabelText('Nome do personagem'), { target: { value: 'Lyra' } })
  fireEvent.change(screen.getByLabelText('Gênero'), { target: { value: 'Feminino' } })
  fireEvent.change(screen.getByLabelText('Alinhamento'), { target: { value: 'lawful-good' } })
  next() // → revisão
}

async function reachWorld() {
  await reachReview()
  fireEvent.click(screen.getByRole('button', { name: /Criar personagem/ }))
  await screen.findByRole('heading', { name: 'O mundo da aventura' })
}

describe('SetupWizard — etapas fechadas depois de criar o personagem (US-258)', () => {
  beforeEach(() => { fakeApi.createCharacterCalls = [] })
  afterEach(() => cleanup())

  it('o botão da revisão diz "Criar personagem" e não "Próximo"', async () => {
    await reachReview()
    expect(screen.getByRole('button', { name: /Criar personagem/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Próximo/ })).toBeNull()
  })

  it('em `world` não há Voltar, a trilha anterior está inerte e createCharacter foi chamado uma vez', async () => {
    await reachWorld()

    expect(screen.queryByRole('button', { name: /Voltar/ })).toBeNull()
    // US-263: este fixture não tem `classSpells` nem raça Alto-elfo — `spells` nunca teve o que
    // mostrar e nem entra na trilha (visibleSteps.ts).
    for (const name of ['Sistema', 'Classe', 'Espécie', 'Background', 'Atributos', 'Perícias', 'Identidade', 'Revisão']) {
      const trail = screen.getByRole('button', { name }) as HTMLButtonElement
      expect(trail.disabled, name).toBe(true)
      fireEvent.click(trail)
    }
    expect(screen.getByRole('button', { name: 'Mundo' }).getAttribute('aria-current')).toBe('step')
    expect(screen.getByRole('heading', { name: 'O mundo da aventura' })).toBeTruthy()

    expect(fakeApi.createCharacterCalls).toHaveLength(1)
  })

  it('`world` avisa que o personagem já está salvo', async () => {
    await reachWorld()
    expect(screen.getByText(/Personagem salvo/)).toBeTruthy()
  })
})
