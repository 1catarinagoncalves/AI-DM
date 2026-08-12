import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react'
import type { SystemConfig } from '@ai-dm/shared'

const { listSystems, createCharacter, getInitialAdventure, createAdventure } = vi.hoisted(() => ({
  listSystems: vi.fn(),
  createCharacter: vi.fn(),
  getInitialAdventure: vi.fn(),
  createAdventure: vi.fn(),
}))
vi.mock('@/lib/api', () => ({ api: { listSystems, createCharacter, getInitialAdventure, createAdventure } }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

import { SetupWizard } from './SetupWizard'

const configWithBudget = (budget: number) => ({
  attributes: [{ key: 'strength', label: 'Força', min: 8, max: 15, default: 8 }],
  startingKits: { default: [] },
  pointBuy: { budget },
  // US-105: raça e classe são catálogo do sistema, não lista literal no componente. Sem elas
  // no config, os dois selects nascem vazios e a etapa nunca libera.
  races: [{ key: 'elf', label: 'Elfo' }, { key: 'dwarf', label: 'Anão' }],
  classes: [{ key: 'wizard', label: 'Mago' }, { key: 'fighter', label: 'Guerreiro' }],
})

// US-122: config com catálogo de backgrounds (US-121) — origem escolhida na etapa `background`.
const configWithBackgrounds = (budget: number) => ({
  ...configWithBudget(budget),
  backgrounds: [
    { key: 'bg-acolyte', name: 'Acólito', source: 'a5e-ag', benefits: [{ type: 'skill_proficiency', name: 'Religião', description: 'x' }] },
    { key: 'bg-sage', name: 'Sábio', source: 'a5e-ag', benefits: [{ type: 'skill_proficiency', name: 'Arcanismo', description: 'x' }] },
  ],
})

// US-124: Markdown real do dataset (heading em nível MISTO, #### e ###) para o benefício
// connection_and_memento — 2 blocos (Acolyte) e a anomalia do Sailor (1 bloco só, "Mementos").
const CAM_ACOLYTE = `Roll 1d10, choose, or make up your own.

#### Acolyte Connections
|d10|Connection|
|---|---|
|1|A high priest awaiting your return.|
|2|A childhood friend who left the priesthood.|

### Acolyte Memento
|d10|Memento|
|---|---|
|1|A timeworn holy symbol.|
|2|A prayer book with notes.|
`

const CAM_SAILOR = `Roll 1d10, choose, or make up your own.

### Sailor Mementos
|d10|Memento|
|---|---|
|1|A compass that always points to the sea.|
|2|A tattoo from your first voyage.|
`

// US-124: origens com adventures_and_advancement (parágrafo) e connection_and_memento
// (seleção por bloco) — 'a5e-ag_sailor' reproduz a anomalia real do dataset (1 bloco só).
const configWithCam = (budget: number) => ({
  ...configWithBudget(budget),
  backgrounds: [
    { key: 'a5e-ag_acolyte', name: 'Acólito', source: 'a5e-ag', benefits: [
      { type: 'adventures_and_advancement', name: 'Adventures and Advancement', description: 'Segue servindo o templo em viagem.' },
      { type: 'connection_and_memento', name: 'Connection and Memento', description: CAM_ACOLYTE },
    ] },
    { key: 'a5e-ag_sailor', name: 'Marinheiro', source: 'a5e-ag', benefits: [
      { type: 'connection_and_memento', name: 'Connection and Memento', description: CAM_SAILOR },
    ] },
  ],
})

// US-27: config com perícias e orçamento de 2 proficiências.
const configWithSkills = (budget: number) => ({
  ...configWithBudget(budget),
  skills: [
    { key: 'athletics', label: 'Atletismo', ability: 'strength' },
    { key: 'stealth', label: 'Furtividade', ability: 'strength' },
    { key: 'perception', label: 'Percepção', ability: 'strength' },
  ],
  proficiency: { choices: 2, bonus: 2 },
})

// US-127: config com kit/features/magias por classe — `wizard` tem entrada própria,
// `fighter` (também no catálogo de configWithBudget) cai no `default` das três.
const configWithClassKit = (budget: number) => ({
  ...configWithBudget(budget),
  startingKits: {
    wizard: [{ name: 'Grimório', qty: 1 }],
    default: [{ name: 'Adaga', qty: 1 }],
  },
  classFeatures: {
    wizard: [{ key: 'wizard_arcane-recovery', name: 'Recuperação Arcana', description: 'Recupera espaços de magia.', source: 'srd' }],
    default: [],
  },
  classSpells: {
    wizard: [{ key: 'fire-bolt', name: 'Raio de Fogo', level: 0, description: 'Dardo de fogo.', source: 'srd' }],
    default: [],
  },
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

  async function pickSystemAndFillRaceClass(config: SystemConfig = configWithBudget(2)) {
    listSystems.mockResolvedValue([{ id: 'sys-1', name: 'D&D 5e SRD', sourceType: 'SRD', config }])
    render(<SetupWizard />)
    fireEvent.click(await screen.findByText('D&D 5e SRD'))
    fireEvent.change(screen.getByLabelText('Nome do personagem'), { target: { value: 'Lyra' } })
    fireEvent.change(screen.getByLabelText('Gênero'), { target: { value: 'Feminino' } })
    fireEvent.change(screen.getByLabelText('Raça'), { target: { value: 'elf' } })
    fireEvent.change(screen.getByLabelText('Classe'), { target: { value: 'wizard' } })
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
    expect((screen.getByLabelText('Classe') as HTMLSelectElement).value).toBe('wizard')
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
    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // sem perícias no config → livre → background
    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // background opcional → revisão

    const review = screen.getByRole('heading', { name: 'Revisão' })
    expect(review).toBeTruthy()
    expect(createCharacter).not.toHaveBeenCalled() // nada criado antes de confirmar

    fireEvent.click(screen.getByRole('button', { name: /Confirmar personagem/ }))
    expect(createCharacter).toHaveBeenCalledTimes(1)
  })

  // US-27: perícias como lista fechada — exatamente 2 proficientes liberam e são persistidas.
  it('bloqueia Próximo até 2 perícias e persiste as keys escolhidas', async () => {
    createCharacter.mockResolvedValue({ id: 'char-1', name: 'Lyra' })
    await pickSystemAndFillRaceClass(configWithSkills(2))

    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → atributos
    const inc = screen.getByLabelText('Aumentar Força')
    fireEvent.click(inc); fireEvent.click(inc)
    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → perícias

    const nextBtn = () => screen.getByRole('button', { name: /Próximo/ }) as HTMLButtonElement
    expect(nextBtn().disabled).toBe(true) // 0 marcadas

    fireEvent.click(screen.getByRole('button', { name: 'Atletismo Força' }))
    expect(nextBtn().disabled).toBe(true) // 1 marcada
    fireEvent.click(screen.getByRole('button', { name: 'Percepção Força' }))
    expect(nextBtn().disabled).toBe(false) // 2 marcadas → libera

    fireEvent.click(nextBtn()) // → background
    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → revisão
    fireEvent.click(screen.getByRole('button', { name: /Confirmar personagem/ }))
    expect(createCharacter).toHaveBeenCalledWith(expect.objectContaining({ skills: ['athletics', 'perception'] }))
  })

  // US-39: a etapa de background captura texto livre e envia na criação.
  it('captura o background e envia na criação, trimando e descartando vazios', async () => {
    createCharacter.mockResolvedValue({ id: 'char-1', name: 'Lyra' })
    await pickSystemAndFillRaceClass(configWithBudget(2))

    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → atributos
    const inc = screen.getByLabelText('Aumentar Força')
    fireEvent.click(inc); fireEvent.click(inc)
    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → perícias
    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → background

    fireEvent.change(screen.getByLabelText('História'), { target: { value: 'Nobre caída' } })
    fireEvent.change(screen.getByLabelText(/Fraquezas/), { target: { value: 'Não mente\n  ' } })

    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → revisão
    fireEvent.click(screen.getByRole('button', { name: /Confirmar personagem/ }))
    expect(createCharacter).toHaveBeenCalledWith(expect.objectContaining({
      background: { story: 'Nobre caída', ideals: [], bonds: [], flaws: ['Não mente'] },
    }))
  })

  // US-122: campo "Origem" só aparece quando o sistema tem config.backgrounds; sem catálogo,
  // etapa `background` continua livre (mesmo comportamento de hoje, sem seleção nenhuma).
  it('sem config.backgrounds, não mostra o campo Origem e a etapa segue livre', async () => {
    await pickSystemAndFillRaceClass(configWithBudget(2))
    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → atributos
    const inc = screen.getByLabelText('Aumentar Força')
    fireEvent.click(inc); fireEvent.click(inc)
    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → perícias
    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → background

    expect(screen.queryByLabelText('Origem')).toBeNull()
    expect((screen.getByRole('button', { name: /Próximo/ }) as HTMLButtonElement).disabled).toBe(false)
  })

  // US-122: com catálogo, "Origem" é um <select> (mesmo padrão de Raça/Classe, US-105) com só o
  // nome de cada background — sem benefícios na opção — e bloqueia o avanço sem escolha.
  it('com config.backgrounds, mostra select de Origem (só o nome) e exige escolha para avançar', async () => {
    await pickSystemAndFillRaceClass(configWithBackgrounds(2))
    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → atributos
    const inc = screen.getByLabelText('Aumentar Força')
    fireEvent.click(inc); fireEvent.click(inc)
    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → perícias
    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → background

    const select = screen.getByLabelText('Origem') as HTMLSelectElement
    const options = [...select.querySelectorAll('option')].filter(o => o.getAttribute('value'))
    expect(options.map(o => [o.getAttribute('value'), o.textContent])).toEqual([
      ['bg-acolyte', 'Acólito'], ['bg-sage', 'Sábio'],
    ])
    expect(screen.queryByText('Religião')).toBeNull() // benefícios não aparecem na opção

    const nextBtn = () => screen.getByRole('button', { name: /Próximo/ }) as HTMLButtonElement
    expect(nextBtn().disabled).toBe(true) // nenhuma origem escolhida

    fireEvent.change(select, { target: { value: 'bg-acolyte' } })
    expect(nextBtn().disabled).toBe(false)

    fireEvent.change(select, { target: { value: '' } }) // volta ao placeholder → bloqueia de novo
    expect(nextBtn().disabled).toBe(true)
  })

  // US-122: a chave (não o nome) viaja para a API, como origin.key — campo IRMÃO de background.
  it('envia origin.key na criação, distinto de background', async () => {
    createCharacter.mockResolvedValue({ id: 'char-1', name: 'Lyra' })
    await pickSystemAndFillRaceClass(configWithBackgrounds(2))
    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → atributos
    const inc = screen.getByLabelText('Aumentar Força')
    fireEvent.click(inc); fireEvent.click(inc)
    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → perícias
    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → background

    fireEvent.change(screen.getByLabelText('Origem'), { target: { value: 'bg-acolyte' } })
    fireEvent.change(screen.getByLabelText('História'), { target: { value: 'Nobre caída' } })

    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → revisão
    fireEvent.click(screen.getByRole('button', { name: /Confirmar personagem/ }))
    expect(createCharacter).toHaveBeenCalledWith(expect.objectContaining({
      origin: { key: 'bg-acolyte' },
      background: expect.objectContaining({ story: 'Nobre caída' }),
    }))
  })

  // US-122: revisão mostra o nome da origem numa linha própria, distinta da linha de background.
  it('revisão mostra o nome da origem, separado da linha de background', async () => {
    await pickSystemAndFillRaceClass(configWithBackgrounds(2))
    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → atributos
    const inc = screen.getByLabelText('Aumentar Força')
    fireEvent.click(inc); fireEvent.click(inc)
    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → perícias
    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → background

    fireEvent.change(screen.getByLabelText('Origem'), { target: { value: 'bg-sage' } })
    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → revisão

    const originRow = screen.getByText('Origem').closest('div')
    expect(within(originRow!).getByText('Sábio')).toBeTruthy()
    // linha de background segue própria e presente, sem o nome da origem misturado nela
    expect(screen.getAllByText('Background').length).toBeGreaterThan(0)
  })

  // US-40: campo "Divindade/Patrono" é parseado na 1ª vírgula → {name, portfolio}.
  it('captura a divindade e a envia parseada (nome antes da vírgula, portfolio depois)', async () => {
    createCharacter.mockResolvedValue({ id: 'char-1', name: 'Lyra' })
    await pickSystemAndFillRaceClass(configWithBudget(2))

    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → atributos
    const inc = screen.getByLabelText('Aumentar Força')
    fireEvent.click(inc); fireEvent.click(inc)
    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → perícias
    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → background

    fireEvent.change(screen.getByLabelText(/Divindade\/Patrono/), { target: { value: 'Auril, goddess of winter' } })

    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → revisão
    fireEvent.click(screen.getByRole('button', { name: /Confirmar personagem/ }))
    expect(createCharacter).toHaveBeenCalledWith(expect.objectContaining({
      background: expect.objectContaining({ deity: { name: 'Auril', portfolio: 'goddess of winter' } }),
    }))
  })

  // US-40: sem vírgula → só o nome; portfolio ausente.
  it('sem vírgula, a divindade vira só nome (portfolio undefined)', async () => {
    createCharacter.mockResolvedValue({ id: 'char-1', name: 'Lyra' })
    await pickSystemAndFillRaceClass(configWithBudget(2))

    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → atributos
    const inc = screen.getByLabelText('Aumentar Força')
    fireEvent.click(inc); fireEvent.click(inc)
    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → perícias
    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → background

    fireEvent.change(screen.getByLabelText(/Divindade\/Patrono/), { target: { value: 'Tymora' } })

    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → revisão
    fireEvent.click(screen.getByRole('button', { name: /Confirmar personagem/ }))
    expect(createCharacter).toHaveBeenCalledWith(expect.objectContaining({
      background: expect.objectContaining({ deity: { name: 'Tymora' } }),
    }))
  })

  // US-40: campo vazio → deity undefined (sem objeto).
  it('divindade em branco → deity undefined', async () => {
    createCharacter.mockResolvedValue({ id: 'char-1', name: 'Lyra' })
    await pickSystemAndFillRaceClass(configWithBudget(2))

    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → atributos
    const inc = screen.getByLabelText('Aumentar Força')
    fireEvent.click(inc); fireEvent.click(inc)
    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → perícias
    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → background
    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → revisão
    fireEvent.click(screen.getByRole('button', { name: /Confirmar personagem/ }))
    expect(createCharacter).toHaveBeenCalledWith(expect.objectContaining({
      background: expect.objectContaining({ deity: undefined }),
    }))
  })

  // US-40/US-127: com só a divindade preenchida, a revisão mostra nome + portfólio — via
  // BackgroundPanel (US-45), o MESMO painel que a ficha em jogo usa.
  it('mostra a divindade (nome + portfólio) na revisão quando só ela é preenchida', async () => {
    await pickSystemAndFillRaceClass(configWithBudget(2))

    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → atributos
    const inc = screen.getByLabelText('Aumentar Força')
    fireEvent.click(inc); fireEvent.click(inc)
    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → perícias
    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → background

    fireEvent.change(screen.getByLabelText(/Divindade\/Patrono/), { target: { value: 'Solariel, Deus da justiça e da cura' } })

    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → revisão
    expect(screen.getByRole('heading', { name: 'Revisão' })).toBeTruthy()
    expect(screen.getByText('Solariel — Deus da justiça e da cura')).toBeTruthy()
  })

  // US-105: o select é o catálogo do config — opção rotulada, `value` = chave — e é a CHAVE
  // que viaja para a API. Falha se alguém voltar a mandar o rótulo (o defeito que a story fecha).
  it('as opções vêm do catálogo do config e a CHAVE é o que vai para a API', async () => {
    createCharacter.mockResolvedValue({ id: 'char-1', name: 'Lyra' })
    await pickSystemAndFillRaceClass(configWithBudget(2))

    const races = [...screen.getByLabelText('Raça').querySelectorAll('option')]
      .filter(o => o.getAttribute('value'))
    expect(races.map(o => [o.getAttribute('value'), o.textContent])).toEqual([['elf', 'Elfo'], ['dwarf', 'Anão']])

    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → atributos
    const inc = screen.getByLabelText('Aumentar Força')
    fireEvent.click(inc); fireEvent.click(inc)
    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → perícias
    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → background
    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → revisão

    // Na revisão o jogador lê o RÓTULO, nunca a chave.
    expect(screen.getByText('Mago')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Confirmar personagem/ }))
    expect(createCharacter).toHaveBeenCalledWith(expect.objectContaining({ race: 'elf', class: 'wizard' }))
  })

  // US-105: o catálogo passou a depender do sistema. Trocar de sistema com raça/classe já
  // escolhidas deixaria uma chave que o catálogo novo não tem — o `Próximo` tem de barrar.
  it('trocar de sistema limpa raça e classe', async () => {
    listSystems.mockResolvedValue([
      { id: 'sys-1', name: 'D&D 5e SRD', sourceType: 'SRD', config: configWithBudget(2) },
      { id: 'sys-2', name: 'Free', sourceType: 'FREE', config: configWithBudget(2) },
    ])
    render(<SetupWizard />)
    fireEvent.click(await screen.findByText('D&D 5e SRD'))
    fireEvent.change(screen.getByLabelText('Nome do personagem'), { target: { value: 'Lyra' } })
    fireEvent.change(screen.getByLabelText('Gênero'), { target: { value: 'Feminino' } })
    fireEvent.change(screen.getByLabelText('Raça'), { target: { value: 'elf' } })
    fireEvent.change(screen.getByLabelText('Classe'), { target: { value: 'wizard' } })
    expect((screen.getByRole('button', { name: /Próximo/ }) as HTMLButtonElement).disabled).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: /Sistema/ })) // volta à etapa 1
    fireEvent.click(screen.getByText('Free'))
    expect((screen.getByLabelText('Raça') as HTMLSelectElement).value).toBe('')
    expect((screen.getByLabelText('Classe') as HTMLSelectElement).value).toBe('')
    expect((screen.getByRole('button', { name: /Próximo/ }) as HTMLButtonElement).disabled).toBe(true)
  })

  // US-107: o wizard era beco sem saída — o rodapé "Voltar" some na etapa 1
  // (`step !== 'system'`) e anda entre etapas, nunca sai da tela. O controlo de
  // saída fica ACIMA da trilha, com lugar fixo nas seis etapas.
  it('oferece saída para o hub na primeira etapa e nas seguintes, sem mexer no rodapé', async () => {
    await pickSystemAndFillRaceClass()
    // A etapa 1 já passou (pickSystem avança), então voltamos a ela pela trilha.
    fireEvent.click(screen.getByRole('button', { name: /Sistema/ }))
    const exit = screen.getByRole('link', { name: /Voltar aos personagens/ })
    expect(exit.getAttribute('href')).toBe('/')
    // Etapa 1 não tem "Voltar" de rodapé: o único caminho para trás é a saída.
    expect(screen.queryByRole('button', { name: /^Voltar$/ })).toBeNull()

    // Etapa 2: a saída continua lá e o rodapé volta ao normal.
    fireEvent.click(screen.getByText('D&D 5e SRD'))
    expect(screen.getByRole('link', { name: /Voltar aos personagens/ }).getAttribute('href')).toBe('/')
    expect(screen.getByRole('button', { name: /Voltar/ })).toBeTruthy()
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
    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → background
    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → revisão
    fireEvent.click(screen.getByRole('button', { name: /Confirmar personagem/ }))

    // Etapa Aventura inicial aparece com o gancho resolvido pela API.
    const start = await screen.findByRole('button', { name: /Iniciar aventura/ })
    expect(getInitialAdventure).toHaveBeenCalledWith('char-1')
    expect(screen.getByRole('heading', { name: 'Aventura' })).toBeTruthy()

    fireEvent.click(start)
    expect(createAdventure).toHaveBeenCalledWith('char-1', 'hook-1')
  })

  // US-127: a revisão espelha o que a ficha vai mostrar depois — atributos e perícias com
  // modificador, não só o valor cru.
  it('revisão mostra atributos e perícias escolhidas com modificador', async () => {
    await pickSystemAndFillRaceClass(configWithSkills(2))

    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → atributos
    const inc = screen.getByLabelText('Aumentar Força')
    fireEvent.click(inc); fireEvent.click(inc) // Força 8 → 10 (fecha o orçamento de 2)
    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → perícias
    fireEvent.click(screen.getByRole('button', { name: 'Atletismo Força' }))
    fireEvent.click(screen.getByRole('button', { name: 'Percepção Força' }))
    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → background
    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → revisão

    // Força 10 → modificador 0 (floor((10-10)/2)); perícia proficiente com bônus +2 → +2.
    expect(screen.getByText(/Força 10 \(0\)/)).toBeTruthy()
    expect(screen.getByText(/Atletismo \(\+2\)/)).toBeTruthy()
    expect(screen.getByText(/Percepção \(\+2\)/)).toBeTruthy()
    // Furtividade não foi escolhida — a revisão só lista as perícias marcadas.
    expect(screen.queryByText(/Furtividade/)).toBeNull()
  })

  // US-127: PV inicial e kit da classe escolhida aparecem na revisão, calculados do mesmo
  // config que a criação vai usar para persistir — sem chamada de API nova.
  it('revisão mostra PV inicial e o kit da classe escolhida', async () => {
    await pickSystemAndFillRaceClass(configWithClassKit(2)) // classe = wizard

    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → atributos
    const inc = screen.getByLabelText('Aumentar Força')
    fireEvent.click(inc); fireEvent.click(inc)
    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → perícias
    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → background
    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → revisão

    // Sem atributo `constitution` no config de teste → cai no fallback (10) → PV = 10 + 0.
    const hpRow = screen.getByText('PV inicial').closest('div')
    expect(within(hpRow!).getByText('10')).toBeTruthy()
    expect(screen.getByText('Grimório')).toBeTruthy() // kit do wizard, não o default
  })

  // US-127: classe sem entrada própria em startingKits/classFeatures/classSpells cai no
  // `default` do config — mesmo padrão de fallback que a criação já usa para persistir.
  it('classe sem kit/features/magias próprios cai no default do config', async () => {
    listSystems.mockResolvedValue([{ id: 'sys-1', name: 'D&D 5e SRD', sourceType: 'SRD', config: configWithClassKit(2) }])
    render(<SetupWizard />)
    fireEvent.click(await screen.findByText('D&D 5e SRD'))
    fireEvent.change(screen.getByLabelText('Nome do personagem'), { target: { value: 'Bram' } })
    fireEvent.change(screen.getByLabelText('Gênero'), { target: { value: 'Masculino' } })
    fireEvent.change(screen.getByLabelText('Raça'), { target: { value: 'dwarf' } })
    fireEvent.change(screen.getByLabelText('Classe'), { target: { value: 'fighter' } }) // sem entrada própria

    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → atributos
    const inc = screen.getByLabelText('Aumentar Força')
    fireEvent.click(inc); fireEvent.click(inc)
    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → perícias
    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → background
    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → revisão

    expect(screen.getByText('Adaga')).toBeTruthy() // kit default
    expect(screen.queryByText('Grimório')).toBeNull() // kit do wizard não vaza para o fighter
    expect(screen.queryByText('Recuperação Arcana')).toBeNull()
    expect(screen.queryByText(/Raio de Fogo/)).toBeNull()
  })

  // US-127: sistema sem classFeatures/classSpells no config não modela esse eixo — o bloco
  // "Features"/"Magias" nem aparece na revisão (mesmo padrão condicional de Origem/perícias).
  it('sistema sem classFeatures/classSpells não mostra bloco de features e magias', async () => {
    await pickSystemAndFillRaceClass(configWithBudget(2))
    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → atributos
    const inc = screen.getByLabelText('Aumentar Força')
    fireEvent.click(inc); fireEvent.click(inc)
    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → perícias
    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → background
    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → revisão

    expect(screen.queryByText('Features')).toBeNull()
    expect(screen.queryByText('Magias')).toBeNull()
  })

  // US-127: o background por extenso (não mais "Preenchido"/"—") vem do mesmo BackgroundPanel
  // que a ficha em jogo usa (US-45) — história, ideais, vínculos e fraquezas visíveis antes de confirmar.
  it('revisão mostra o background por extenso via BackgroundPanel', async () => {
    await pickSystemAndFillRaceClass(configWithBudget(2))
    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → atributos
    const inc = screen.getByLabelText('Aumentar Força')
    fireEvent.click(inc); fireEvent.click(inc)
    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → perícias
    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → background

    fireEvent.change(screen.getByLabelText('História'), { target: { value: 'Nobre caída' } })
    fireEvent.change(screen.getByLabelText(/Ideais/), { target: { value: 'Justiça acima de tudo' } })

    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → revisão
    expect(screen.getByText('Nobre caída')).toBeTruthy()
    expect(screen.getByText('Justiça acima de tudo')).toBeTruthy()
    expect(screen.queryByText('Preenchido')).toBeNull()
  })

  // US-124: adventures_and_advancement vira parágrafo; connection_and_memento vira um
  // <select> por bloco, com título/subtítulo FIXOS (não o heading/preâmbulo do dataset) —
  // nenhum `|` de Markdown cru aparece na tela.
  it('mostra adventures_and_advancement como parágrafo e connection/memento como seleção', async () => {
    await pickSystemAndFillRaceClass(configWithCam(2))
    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → atributos
    const inc = screen.getByLabelText('Aumentar Força')
    fireEvent.click(inc); fireEvent.click(inc)
    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → perícias
    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → background

    fireEvent.change(screen.getByLabelText('Origem'), { target: { value: 'a5e-ag_acolyte' } })

    expect(screen.getByText('Segue servindo o templo em viagem.')).toBeTruthy()

    const connectionSelect = screen.getByLabelText('Conexão') as HTMLSelectElement
    const connectionOptions = [...connectionSelect.querySelectorAll('option')].filter(o => o.getAttribute('value'))
    expect(connectionOptions.map(o => o.textContent)).toEqual([
      'A high priest awaiting your return.', 'A childhood friend who left the priesthood.',
    ])
    const mementoSelect = screen.getByLabelText('Memento') as HTMLSelectElement
    const mementoOptions = [...mementoSelect.querySelectorAll('option')].filter(o => o.getAttribute('value'))
    expect(mementoOptions.map(o => o.textContent)).toEqual(['A timeworn holy symbol.', 'A prayer book with notes.'])

    // Nenhum Markdown cru (heading `####`/`###`, preâmbulo "Roll 1d10…", `|d10|...|`) na tela.
    expect(screen.queryByText(/Roll 1d10/)).toBeNull()
    expect(screen.queryByText(/Acolyte Connections/)).toBeNull()
    expect(screen.queryByText(/\|d10\|/)).toBeNull()
  })

  // US-124: botão "aleatório" preenche o <select> com uma opção sorteada DAQUELE bloco;
  // trocar manualmente depois sobrescreve sem travar.
  it('botão aleatório sorteia uma opção do bloco certo; trocar manualmente sobrescreve', async () => {
    await pickSystemAndFillRaceClass(configWithCam(2))
    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → atributos
    const inc = screen.getByLabelText('Aumentar Força')
    fireEvent.click(inc); fireEvent.click(inc)
    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → perícias
    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → background
    fireEvent.change(screen.getByLabelText('Origem'), { target: { value: 'a5e-ag_acolyte' } })

    const connectionSelect = screen.getByLabelText('Conexão') as HTMLSelectElement
    expect(connectionSelect.value).toBe('') // nada selecionado ainda

    const [connectionRandom] = screen.getAllByRole('button', { name: 'Sortear' })
    fireEvent.click(connectionRandom!)
    expect(['1', '2']).toContain(connectionSelect.value) // sorteou uma das 2 opções

    // Memento não foi tocado — continua vazio (o botão só afeta o bloco dele).
    const mementoSelect = screen.getByLabelText('Memento') as HTMLSelectElement
    expect(mementoSelect.value).toBe('')

    // Trocar manualmente sobrescreve o valor sorteado.
    fireEvent.change(connectionSelect, { target: { value: '2' } })
    expect(connectionSelect.value).toBe('2')
  })

  // US-124: origin.connection/memento viajam com o TEXTO da linha escolhida (não o roll),
  // junto de origin.key, no mesmo POST /characters.
  it('envia origin.connection/memento (texto da linha escolhida) na criação', async () => {
    createCharacter.mockResolvedValue({ id: 'char-1', name: 'Lyra' })
    await pickSystemAndFillRaceClass(configWithCam(2))
    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → atributos
    const inc = screen.getByLabelText('Aumentar Força')
    fireEvent.click(inc); fireEvent.click(inc)
    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → perícias
    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → background
    fireEvent.change(screen.getByLabelText('Origem'), { target: { value: 'a5e-ag_acolyte' } })
    fireEvent.change(screen.getByLabelText('Conexão'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('Memento'), { target: { value: '2' } })

    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → revisão
    fireEvent.click(screen.getByRole('button', { name: /Confirmar personagem/ }))
    expect(createCharacter).toHaveBeenCalledWith(expect.objectContaining({
      origin: { key: 'a5e-ag_acolyte', connection: 'A high priest awaiting your return.', memento: 'A prayer book with notes.' },
    }))
  })

  // US-124: revisão mostra a conexão/memento escolhidos, ou "—" sem seleção.
  it('revisão mostra conexão/memento escolhidos, "—" quando nada foi selecionado', async () => {
    await pickSystemAndFillRaceClass(configWithCam(2))
    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → atributos
    const inc = screen.getByLabelText('Aumentar Força')
    fireEvent.click(inc); fireEvent.click(inc)
    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → perícias
    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → background
    fireEvent.change(screen.getByLabelText('Origem'), { target: { value: 'a5e-ag_acolyte' } })

    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → revisão sem escolher nada
    const connectionRow = screen.getByText('Conexão').closest('div')
    expect(within(connectionRow!).getByText('—')).toBeTruthy()
    const mementoRow = screen.getByText('Memento').closest('div')
    expect(within(mementoRow!).getByText('—')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Voltar/ })) // → background
    fireEvent.change(screen.getByLabelText('Conexão'), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → revisão de novo
    expect(within(screen.getByText('Conexão').closest('div')!).getByText('A childhood friend who left the priesthood.')).toBeTruthy()
  })

  // US-124: anomalia do Sailor (1 bloco só, semanticamente "Mementos") mapeia para Memento,
  // não Connection — SINGLE_BLOCK_IS_MEMENTO corrige por CHAVE, não por texto de heading.
  it('Sailor (bloco único) mostra só o select de Memento, nunca o de Conexão', async () => {
    await pickSystemAndFillRaceClass(configWithCam(2))
    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → atributos
    const inc = screen.getByLabelText('Aumentar Força')
    fireEvent.click(inc); fireEvent.click(inc)
    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → perícias
    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → background
    fireEvent.change(screen.getByLabelText('Origem'), { target: { value: 'a5e-ag_sailor' } })

    expect(screen.queryByLabelText('Conexão')).toBeNull()
    const mementoSelect = screen.getByLabelText('Memento') as HTMLSelectElement
    const options = [...mementoSelect.querySelectorAll('option')].filter(o => o.getAttribute('value'))
    expect(options.map(o => o.textContent)).toEqual([
      'A compass that always points to the sea.', 'A tattoo from your first voyage.',
    ])
  })

  // US-124: origem sem adventures_and_advancement nem connection_and_memento (as 2 origens
  // de configWithBackgrounds só têm skill_proficiency) não quebra — a seção só não aparece.
  it('origem sem os benefícios narrativos não mostra a seção, sem quebrar', async () => {
    await pickSystemAndFillRaceClass(configWithBackgrounds(2))
    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → atributos
    const inc = screen.getByLabelText('Aumentar Força')
    fireEvent.click(inc); fireEvent.click(inc)
    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → perícias
    fireEvent.click(screen.getByRole('button', { name: /Próximo/ })) // → background
    fireEvent.change(screen.getByLabelText('Origem'), { target: { value: 'bg-acolyte' } })

    expect(screen.queryByLabelText('Conexão')).toBeNull()
    expect(screen.queryByLabelText('Memento')).toBeNull()
  })
})
