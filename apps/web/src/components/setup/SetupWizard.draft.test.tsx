import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'

// US-261: fake class nomeada (não stub inline). `classes` é mutável de propósito — o teste de
// regressão remonta o wizard contra um catálogo que perdeu a classe escolhida.
const { fakeApi } = vi.hoisted(() => {
  class FakeSetupApi {
    classes = [{ key: 'wizard', label: 'Mago' }, { key: 'fighter', label: 'Guerreiro' }]
    async listSystems() {
      return [{
        id: 'sys-1', name: 'D&D 5e SRD', sourceType: 'SRD',
        config: {
          attributes: [{ key: 'strength', label: 'Força', min: 8, max: 15, default: 8 }],
          startingKits: { default: [] },
          pointBuy: { budget: 2 },
          races: [{ key: 'elf', label: 'Elfo' }],
          classes: this.classes,
          skills: [{ key: 'athletics', label: 'Atletismo', ability: 'strength' }],
          proficiency: { choices: 1, bonus: 2 },
          alignments: [{ key: 'lawful-good', label: 'Leal e Bom' }],
        },
      }]
    }
    async createCharacter() { return { id: 'char-1', name: 'Lyra' } }
  }
  return { fakeApi: new FakeSetupApi() }
})
vi.mock('@/lib/api', () => ({ api: fakeApi }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

import { SetupWizard } from './SetupWizard'

const DRAFT_KEY = 'aidm.wizard.draft'
const next = () => fireEvent.click(screen.getByRole('button', { name: /Próximo/ }))
const trail = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement
const current = () => screen.getAllByRole('button').find(b => b.getAttribute('aria-current') === 'step')?.textContent
const resumedNotice = () => screen.findByText(/Retomamos de onde você parou/)

// Mesmo caminho de SetupWizard.furthest.test.tsx, parando em `skills` com Atletismo marcada.
async function reachSkills() {
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
  fireEvent.click(screen.getByRole('button', { name: /Atletismo/ }))
}

async function reachReview() {
  await reachSkills()
  next() // → magias
  next() // → identidade
  fireEvent.change(screen.getByLabelText('Nome do personagem'), { target: { value: 'Lyra' } })
  fireEvent.change(screen.getByLabelText('Gênero'), { target: { value: 'Feminino' } })
  fireEvent.change(screen.getByLabelText('Alinhamento'), { target: { value: 'lawful-good' } })
  next() // → revisão
}

// `throw` em toda operação: janela privada / dados de site bloqueados.
class BlockedStorage {
  getItem(): string | null { throw new Error('SecurityError: storage bloqueado') }
  setItem(): void { throw new Error('SecurityError: storage bloqueado') }
  removeItem(): void { throw new Error('SecurityError: storage bloqueado') }
}

describe('SetupWizard — rascunho sobrevive a recarregar (US-261)', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    fakeApi.classes = [{ key: 'wizard', label: 'Mago' }, { key: 'fighter', label: 'Guerreiro' }]
  })

  it('remontar (F5, ou sair pelo "Voltar aos personagens" e voltar) restaura a etapa e os valores', async () => {
    await reachSkills()
    expect(current()).toContain('Perícias')
    cleanup()

    render(<SetupWizard />)
    await resumedNotice()
    expect(current()).toContain('Perícias')
    next() // só libera se Atletismo, atributos, classe e raça voltaram
    // US-263: este fixture não tem `classSpells` nem raça Alto-elfo — `spells` não tem o que
    // mostrar e sai da trilha (visibleSteps.ts); "Próximo" de `skills` vai direto a `identity`.
    expect(current()).toContain('Identidade')
  })

  it('REGRESSÃO: catálogo que perdeu a classe escolhida volta a `class`, sem erro, com a trilha recuada', async () => {
    await reachSkills()
    cleanup()
    fakeApi.classes = [{ key: 'fighter', label: 'Guerreiro' }]

    render(<SetupWizard />)
    await resumedNotice()
    expect(current()).toContain('Classe')
    expect((screen.getByRole('radio', { name: 'Guerreiro' }) as HTMLInputElement).checked).toBe(false)
    expect(trail('Espécie').disabled).toBe(true)
  })

  it('rascunho de outra versão do formato é ignorado', async () => {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ v: 999, systemId: 'sys-1', step: 'skills', furthest: 5 }))
    render(<SetupWizard />)
    await screen.findByText('D&D 5e SRD')
    expect(current()).toContain('Sistema')
    expect(screen.queryByText(/Retomamos de onde você parou/)).toBeNull()
  })

  it('"Recomeçar" apaga o rascunho e volta à escolha de sistema', async () => {
    await reachSkills()
    cleanup()
    render(<SetupWizard />)
    await resumedNotice()

    fireEvent.click(screen.getByRole('button', { name: 'Recomeçar' }))
    await screen.findByText('D&D 5e SRD')
    expect(current()).toContain('Sistema')
    expect(screen.queryByText(/Retomamos de onde você parou/)).toBeNull()
    expect(sessionStorage.getItem(DRAFT_KEY)).toBeNull()
  })

  it('depois de "Criar personagem" bem-sucedido o rascunho não existe mais', async () => {
    await reachReview()
    expect(sessionStorage.getItem(DRAFT_KEY)).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /Criar personagem/ }))
    await screen.findByRole('heading', { name: 'O mundo da aventura' })
    await waitFor(() => expect(sessionStorage.getItem(DRAFT_KEY)).toBeNull())
  })

  it('storage que lança em leitura e escrita não quebra a tela', async () => {
    vi.stubGlobal('sessionStorage', new BlockedStorage())
    expect(() => sessionStorage.getItem(DRAFT_KEY)).toThrow() // o stub pegou de fato

    render(<SetupWizard />)
    fireEvent.click(await screen.findByText('D&D 5e SRD'))
    expect(current()).toContain('Classe')
  })
})
