import { readFileSync } from 'node:fs'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react'
import axe from 'axe-core'

// US-269: fake class nomeada (não stub inline). As duas flags derrubam a chamada que a
// jogadora acabou de disparar — `createCharacter` (revisão) e `createAdventure` (mundo). O
// texto do erro é português cru, como o da API real (AGENTS.md → Frontend): nunca vai à tela.
const { fakeApi } = vi.hoisted(() => {
  class FakeSetupApi {
    createCharacterFails = false
    createAdventureFails = false
    listSystemsFails = false
    async listSystems() {
      if (this.listSystemsFails) throw new Error('Falha interna do servidor ao listar sistemas')
      return [{
        id: 'sys-1', name: 'D&D 5e SRD', sourceType: 'SRD',
        config: {
          attributes: [{ key: 'strength', label: 'Força', min: 8, max: 15, default: 8 }],
          startingKits: { default: [] },
          pointBuy: { budget: 2 },
          races: [{ key: 'elf', label: 'Elfo' }],
          classes: [{ key: 'wizard', label: 'Mago' }],
          skills: [{ key: 'athletics', label: 'Atletismo', ability: 'strength' }],
          proficiency: { choices: 1, bonus: 2 },
          alignments: [{ key: 'lawful-good', label: 'Leal e Bom' }],
        },
      }]
    }
    async createCharacter() {
      if (this.createCharacterFails) throw new Error('Falha interna do servidor ao gravar a ficha')
      return { id: 'char-1', name: 'Lyra' }
    }
    async createAdventure() {
      if (this.createAdventureFails) throw new Error('Falha interna do servidor ao criar a aventura')
      return { id: 'adv-1', title: 'A Mina Perdida' }
    }
  }
  return { fakeApi: new FakeSetupApi() }
})
vi.mock('@/lib/api', () => ({ api: fakeApi }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

import { SetupWizard } from './SetupWizard'

// Mesmas opções de a11y.test.tsx: happy-dom não mede cor (contraste é dos tokens, US-46) e
// cada componente roda sem o <main> do layout.
const AXE_OPTIONS = { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } } as const

const next = () => fireEvent.click(screen.getByRole('button', { name: /Próximo/ }))
const back = () => fireEvent.click(screen.getByRole('button', { name: /Voltar/ }))
const title = () => screen.getByRole('heading', { level: 1 })
const scrollTo = vi.fn()

async function startWizard() {
  render(<SetupWizard />)
  fireEvent.click(await screen.findByText('D&D 5e SRD')) // system → class
}

async function reachRace() {
  await startWizard()
  fireEvent.click(screen.getByRole('radio', { name: 'Mago' }))
  next()
  fireEvent.click(screen.getByRole('radio', { name: 'Elfo' }))
}

async function reachSkills() {
  await reachRace()
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

async function expectAccessibleStep(container: HTMLElement) {
  const results = await axe.run(container, AXE_OPTIONS)
  expect(results.violations.map(v => `${v.id}: ${v.nodes.length}× — ${v.help}`)).toEqual([])
  // 10px/11px são informação (kicker, bônus, selo) — só o tamanho, o contraste passa (US-269 §5).
  const tiny = [...container.querySelectorAll('[class]')]
    .filter(el => /text-\[(?:[0-9]|1[01])px\]/.test(el.getAttribute('class')!))
    .map(el => `<${el.tagName.toLowerCase()} class="${el.getAttribute('class')}">`)
  expect(tiny).toEqual([])
  const orphanLabels = [...container.querySelectorAll('label')]
    .filter(l => !l.htmlFor && !l.querySelector('input, select, textarea'))
    .map(l => l.textContent)
  expect(orphanLabels).toEqual([])
}

describe('SetupWizard — acessibilidade (US-269)', () => {
  beforeEach(() => {
    fakeApi.createCharacterFails = false
    fakeApi.createAdventureFails = false
    fakeApi.listSystemsFails = false
    sessionStorage.clear()
    scrollTo.mockReset()
    window.scrollTo = scrollTo as typeof window.scrollTo
    Element.prototype.scrollIntoView = vi.fn()
  })
  afterEach(() => cleanup())

  it('axe, texto ≥12px e nenhum <label> órfão em CADA etapa, da escolha do sistema ao mundo', async () => {
    render(<SetupWizard />)
    const container = document.body
    await screen.findByText('D&D 5e SRD')
    await expectAccessibleStep(container) // system
    fireEvent.click(screen.getByText('D&D 5e SRD'))
    fireEvent.click(screen.getByRole('radio', { name: 'Mago' }))
    await expectAccessibleStep(container) // class (com cartão selecionado e painel de detalhe)
    next()
    fireEvent.click(screen.getByRole('radio', { name: 'Elfo' }))
    await expectAccessibleStep(container) // race
    next(); await expectAccessibleStep(container) // background
    next(); await expectAccessibleStep(container) // attributes
    const inc = screen.getByLabelText('Aumentar Força')
    fireEvent.click(inc); fireEvent.click(inc)
    next()
    fireEvent.click(screen.getByRole('button', { name: /Atletismo/ }))
    await expectAccessibleStep(container) // skills
    next(); await expectAccessibleStep(container) // spells
    next()
    fireEvent.change(screen.getByLabelText('Nome do personagem'), { target: { value: 'Lyra' } })
    fireEvent.change(screen.getByLabelText('Gênero'), { target: { value: 'Feminino' } })
    fireEvent.change(screen.getByLabelText('Alinhamento'), { target: { value: 'lawful-good' } })
    await expectAccessibleStep(container) // identity
    next(); await expectAccessibleStep(container) // review
    fireEvent.click(screen.getByRole('button', { name: /Criar personagem/ }))
    await screen.findByRole('heading', { name: 'O mundo da aventura' })
    await expectAccessibleStep(container) // world — bifurcação
    fireEvent.click(screen.getByRole('radio', { name: /Criar minha história/ }))
    await expectAccessibleStep(container) // world — grupos
  })

  // O walk acima só vê os ramos do config enxuto (sem subclasse, dracônico, origem com escolha…).
  // Este gate lê o fonte de tudo que o wizard monta, então cobre os ramos que ele não renderiza.
  it('nenhum arquivo que o wizard monta declara texto de 9–11px', () => {
    const files = [
      './SetupWizard.tsx', './CatalogCardGroup.tsx', './AdventureLoadingScreen.tsx', './AdventureErrorScreen.tsx',
      '../ui/dm.tsx', '../character/FeaturesPanel.tsx', '../character/BackgroundPanel.tsx',
    ]
    const tiny = files.flatMap(f => readFileSync(new URL(f, import.meta.url), 'utf8').split('\n')
      .map((line, i) => ({ at: `${f}:${i + 1}`, line }))
      .filter(({ line }) => /text-\[(?:[0-9]|1[01])px\]/.test(line))
      .map(({ at }) => at))
    expect(tiny).toEqual([])
  })

  it('a linha de atributo é um grupo nomeado pelo atributo, não um <label> solto', async () => {
    await reachRace()
    next(); next() // → background → atributos
    const row = screen.getByRole('group', { name: 'Força' })
    expect(within(row).getByLabelText('Aumentar Força')).toBeTruthy()
  })

  describe('trilha', () => {
    it('cada botão da trilha reserva 44px de altura de toque, mesmo sem o rótulo (mobile)', async () => {
      await startWizard()
      const buttons = within(screen.getByRole('navigation', { name: 'Progresso' })).getAllByRole('button')
      expect(buttons.length).toBeGreaterThan(1)
      for (const b of buttons) expect(b.className).toContain('min-h-[44px]')
    })
  })

  describe('foco e rolagem na troca de etapa', () => {
    it('Próximo, Voltar e a trilha levam o foco ao título da etapa nova e a página ao topo', async () => {
      await reachRace()
      const raceTitle = title().textContent
      scrollTo.mockClear()

      next() // race → background
      expect(title().textContent).not.toBe(raceTitle)
      expect(document.activeElement).toBe(title())
      expect(scrollTo).toHaveBeenCalledWith(0, 0)

      back() // background → race
      expect(title().textContent).toBe(raceTitle)
      expect(document.activeElement).toBe(title())

      fireEvent.click(screen.getByRole('button', { name: 'Classe' })) // trilha: salto para trás
      expect(title().textContent).not.toBe(raceTitle)
      expect(document.activeElement).toBe(title())
    })

    it('a escolha do sistema (system → class) também leva o foco ao título', async () => {
      await startWizard()
      expect(document.activeElement).toBe(title())
    })

    it('a montagem inicial não rouba o foco', async () => {
      render(<SetupWizard />)
      await screen.findByText('D&D 5e SRD')
      expect(document.activeElement).toBe(document.body)
      expect(scrollTo).not.toHaveBeenCalled()
    })

    it('restaurar o rascunho (US-261) não rouba o foco nem rola a página', async () => {
      await reachSkills()
      cleanup()
      scrollTo.mockClear()

      render(<SetupWizard />) // F5: lê o rascunho da sessão
      await screen.findByText(/Retomamos de onde você parou/)
      expect(document.activeElement).toBe(document.body)
      expect(scrollTo).not.toHaveBeenCalled()
    })
  })

  describe('erro anunciado junto do botão que falhou', () => {
    // Mesma classe de defeito, na 1ª etapa: sem catálogo não há sistema para escolher e a
    // mensagem "Recarregue a página" precisa ser falada, não só desenhada.
    it('falha ao carregar os sistemas: role="alert" com o texto do dicionário', async () => {
      fakeApi.listSystemsFails = true
      render(<SetupWizard />)

      const alert = await screen.findByRole('alert')
      expect(alert.textContent).toBe('Não foi possível carregar os sistemas. Recarregue a página.')
    })

    it('createCharacter falhou: role="alert" com o texto do dicionário, no rodapé da revisão', async () => {
      fakeApi.createCharacterFails = true
      await reachReview()
      const confirm = screen.getByRole('button', { name: /Criar personagem/ })
      fireEvent.click(confirm)

      const alert = await screen.findByRole('alert')
      expect(alert.textContent).toBe('Erro ao criar personagem. Tente novamente.')
      expect(alert.textContent).not.toContain('servidor') // texto cru da API nunca vai à tela
      expect(alert.parentElement!.contains(confirm)).toBe(true) // mesmo rodapé do botão
    })

    it('sair da etapa apaga o erro — ele não fica velho na etapa anterior', async () => {
      fakeApi.createCharacterFails = true
      await reachReview()
      fireEvent.click(screen.getByRole('button', { name: /Criar personagem/ }))
      await screen.findByRole('alert')

      back()
      expect(screen.queryByRole('alert')).toBeNull()
    })

    it('createAdventure falhou: role="alert" no rodapé do mundo', async () => {
      fakeApi.createAdventureFails = true
      await reachReview()
      fireEvent.click(screen.getByRole('button', { name: /Criar personagem/ }))
      await screen.findByRole('heading', { name: 'O mundo da aventura' })
      fireEvent.click(screen.getByRole('radio', { name: /Criar minha história/ }))
      const start = screen.getByRole('button', { name: /Criar aventura/ })
      fireEvent.click(start)

      const alert = await waitFor(() => screen.getByRole('alert'))
      expect(alert.textContent).toBe('Erro ao iniciar a aventura. Tente novamente.')
      expect(alert.parentElement!.contains(screen.getByRole('button', { name: /Criar aventura/ }))).toBe(true)
    })
  })
})
