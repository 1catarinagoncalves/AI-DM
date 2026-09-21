import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'

// US-259: mesmo fake e mesmo caminho de SetupWizard.closedSteps.test.tsx — só o que o wizard
// mostra quando o "Próximo" está desabilitado.
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
          classes: [{ key: 'wizard', label: 'Mago' }],
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

const nextButton = () => screen.getByRole('button', { name: /Próximo/ }) as HTMLButtonElement
const next = () => fireEvent.click(nextButton())
const missingLine = () => screen.queryByText(/^Falta:/)

async function pickSystem() {
  render(<SetupWizard />)
  fireEvent.click(await screen.findByText('D&D 5e SRD'))
}

async function reachIdentity() {
  await pickSystem()
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
}

describe('SetupWizard — "Próximo" desabilitado diz o que falta (US-259)', () => {
  afterEach(() => cleanup())

  // Regressão: a copy dizia "nada é obrigatório além do nome" e o avanço exigia gênero e
  // alinhamento também — quem preenchia só o nome ficava parada sem saber por quê.
  it('identity: só com o nome, Próximo fica desabilitado e a tela lista gênero e alinhamento', async () => {
    await reachIdentity()
    fireEvent.change(screen.getByLabelText('Nome do personagem'), { target: { value: 'Lyra' } })

    expect(nextButton().disabled).toBe(true)
    expect(missingLine()!.textContent).toBe('Falta: gênero, alinhamento.')
  })

  it('identity: a linha some quando o último item é preenchido e o botão libera', async () => {
    await reachIdentity()
    expect(missingLine()!.textContent).toBe('Falta: nome, gênero, alinhamento.')

    fireEvent.change(screen.getByLabelText('Nome do personagem'), { target: { value: 'Lyra' } })
    fireEvent.change(screen.getByLabelText('Gênero'), { target: { value: 'Feminino' } })
    expect(missingLine()!.textContent).toBe('Falta: alinhamento.')

    fireEvent.change(screen.getByLabelText('Alinhamento'), { target: { value: 'lawful-good' } })
    expect(missingLine()).toBeNull()
    expect(nextButton().disabled).toBe(false)
    expect(nextButton().getAttribute('aria-describedby')).toBeNull()
  })

  it('identity: Próximo aponta para a linha por aria-describedby enquanto está desabilitado', async () => {
    await reachIdentity()
    const line = missingLine()!
    expect(line.id).not.toBe('')
    expect(nextButton().getAttribute('aria-describedby')).toBe(line.id)
  })

  it('identity: nome, gênero e alinhamento marcados como obrigatórios; a copy não os chama de opcionais', async () => {
    await reachIdentity()
    for (const label of ['Nome do personagem', 'Gênero', 'Alinhamento']) {
      expect((screen.getByLabelText(label) as HTMLInputElement).required, label).toBe(true)
    }
    expect((screen.getByLabelText('Aparência') as HTMLTextAreaElement).required).toBe(false)
    expect(screen.queryByText(/Nada aqui é obrigatório/)).toBeNull()
    expect(screen.getByText(/Nome, gênero e alinhamento são obrigatórios/)).toBeTruthy()
  })

  it('class: sem classe escolhida a linha diz "classe" e some ao escolher', async () => {
    await pickSystem()
    expect(nextButton().disabled).toBe(true)
    expect(missingLine()!.textContent).toBe('Falta: classe.')

    fireEvent.click(screen.getByRole('radio', { name: 'Mago' }))
    expect(missingLine()).toBeNull()
    expect(nextButton().disabled).toBe(false)
  })

  it('attributes: pontos sobrando aparecem na linha e somem quando o orçamento fecha', async () => {
    await pickSystem()
    fireEvent.click(screen.getByRole('radio', { name: 'Mago' }))
    next() // → raça
    fireEvent.click(screen.getByRole('radio', { name: 'Elfo' }))
    next() // → background
    next() // → atributos
    expect(missingLine()!.textContent).toBe('Falta: pontos de atributo a distribuir.')

    const inc = screen.getByLabelText('Aumentar Força')
    fireEvent.click(inc); fireEvent.click(inc)
    expect(missingLine()).toBeNull()
    expect(nextButton().disabled).toBe(false)
  })
})
