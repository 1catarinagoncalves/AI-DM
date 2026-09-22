import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'

// US-260: fake class nomeada (não stub inline) — o teste só precisa de um sistema com DUAS
// classes e uma perícia, para que trocar de classe invalide a etapa `skills` (a classe nova
// zera as perícias escolhidas, US-224).
const { fakeApi } = vi.hoisted(() => {
  class FakeSetupApi {
    async listSystems() {
      return [{
        id: 'sys-1', name: 'D&D 5e SRD', sourceType: 'SRD',
        config: {
          attributes: [{ key: 'strength', label: 'Força', min: 8, max: 15, default: 8 }],
          startingKits: { default: [] },
          pointBuy: { budget: 2 },
          races: [{ key: 'elf', label: 'Elfo' }],
          classes: [{ key: 'wizard', label: 'Mago' }, { key: 'fighter', label: 'Guerreiro' }],
          skills: [{ key: 'athletics', label: 'Atletismo', ability: 'strength' }],
          proficiency: { choices: 1, bonus: 2 },
          alignments: [{ key: 'lawful-good', label: 'Leal e Bom' }],
        },
      }]
    }
  }
  return { fakeApi: new FakeSetupApi() }
})
vi.mock('@/lib/api', () => ({ api: fakeApi }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

import { SetupWizard } from './SetupWizard'

const next = () => fireEvent.click(screen.getByRole('button', { name: /Próximo/ }))
const trail = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement
const current = () => screen.getAllByRole('button').find(b => b.getAttribute('aria-current') === 'step')?.textContent
const backToReview = () => screen.queryByRole('button', { name: 'Voltar à revisão' })

async function pickSystem() {
  render(<SetupWizard />)
  fireEvent.click(await screen.findByText('D&D 5e SRD'))
}

// Mesmo caminho de `reachReview` em SetupWizard.closedSteps.test.tsx, com uma perícia marcada.
async function reachReview() {
  await pickSystem()
  fireEvent.click(screen.getByRole('radio', { name: 'Mago' }))
  next() // → raça
  fireEvent.click(screen.getByRole('radio', { name: 'Elfo' }))
  next() // → background
  next() // → atributos
  const inc = screen.getByLabelText('Aumentar Força')
  fireEvent.click(inc); fireEvent.click(inc)
  next() // → perícias
  fireEvent.click(screen.getByRole('button', { name: /Atletismo/ }))
  next() // → magias
  next() // → identidade
  fireEvent.change(screen.getByLabelText('Nome do personagem'), { target: { value: 'Lyra' } })
  fireEvent.change(screen.getByLabelText('Gênero'), { target: { value: 'Feminino' } })
  fireEvent.change(screen.getByLabelText('Alinhamento'), { target: { value: 'lawful-good' } })
  next() // → revisão
}

describe('SetupWizard — corrigir a partir da revisão sem refazer o caminho (US-260)', () => {
  afterEach(() => cleanup())

  it('da revisão: `class` na trilha e depois `review` volta à revisão em um clique', async () => {
    await reachReview()
    fireEvent.click(trail('Classe'))
    expect(current()).toContain('Classe')

    fireEvent.click(trail('Revisão'))
    expect(current()).toContain('Revisão')
  })

  it('REGRESSÃO: trocar de classe e voltar à revisão para em `skills`, onde as perícias da classe anterior já não valem', async () => {
    await reachReview()
    fireEvent.click(trail('Classe'))
    fireEvent.click(screen.getByRole('radio', { name: 'Guerreiro' }))

    fireEvent.click(screen.getByRole('button', { name: 'Voltar à revisão' }))
    expect(current()).toContain('Perícias')

    // corrigida a etapa, o mesmo botão termina o caminho
    fireEvent.click(screen.getByRole('button', { name: /Atletismo/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Voltar à revisão' }))
    expect(current()).toContain('Revisão')
  })

  it('"Voltar à revisão" só aparece depois de a revisão ter sido alcançada, e não na própria revisão', async () => {
    await pickSystem()
    expect(backToReview()).toBeNull() // em `class`, nada alcançado além dela

    fireEvent.click(screen.getByRole('radio', { name: 'Mago' }))
    next() // → raça
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }))
    expect(backToReview()).toBeNull() // já esteve em `race`, mas nunca em `review`
    cleanup()
    sessionStorage.clear() // US-261: remontar na mesma aba restauraria o rascunho — aqui é outra criação

    await reachReview()
    expect(backToReview()).toBeNull() // é a própria revisão
    fireEvent.click(trail('Classe'))
    expect(backToReview()).not.toBeNull()
  })

  it('a trilha nunca alcança por clique uma etapa que nunca foi alcançada em ordem', async () => {
    await pickSystem()
    for (const name of ['Espécie', 'Background', 'Atributos', 'Perícias', 'Magias', 'Identidade', 'Revisão', 'Mundo']) {
      expect(trail(name).disabled, name).toBe(true)
    }
  })

  it('`world` fica fora da trilha mesmo com a revisão alcançada: só `Criar personagem` leva até lá', async () => {
    await reachReview()
    fireEvent.click(trail('Classe'))
    expect(trail('Mundo').disabled).toBe(true)
    expect(trail('Revisão').disabled).toBe(false)
  })

  it('trocar de sistema zera `furthest`: a trilha e o atalho voltam ao começo', async () => {
    await reachReview()
    fireEvent.click(trail('Sistema'))
    fireEvent.click(await screen.findByText('D&D 5e SRD')) // mesmo sistema de novo: reseta tudo

    expect(current()).toContain('Classe')
    expect(trail('Revisão').disabled).toBe(true)
    expect(trail('Espécie').disabled).toBe(true)
    expect(backToReview()).toBeNull()
  })
})
