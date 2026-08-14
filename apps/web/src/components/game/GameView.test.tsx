import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'

const { getTurns } = vi.hoisted(() => ({ getTurns: vi.fn() }))
vi.mock('@/lib/api', () => ({ api: { getTurns } }))

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

// US-107: a mesa não tinha navegação nenhuma (zero `Link`/`useRouter` no arquivo).
// A saída para o hub existe em duas posições — cabeçalho da ficha (desktop) e barra
// de toggle (mobile) — e as duas têm de estar FORA do painel recolhível.
describe('GameView — saída para o hub (US-107)', () => {
  it('tem saída para / no desktop e no mobile, com a ficha fechada', async () => {
    render(<GameView {...baseProps} />)
    await screen.findByText('Atributos')

    const exits = screen.getAllByRole('link', { name: /Voltar aos personagens/ })
    expect(exits.length).toBe(2) // P2 (cabeçalho da ficha) + P3 (barra de toggle)
    expect(exits.every(a => a.getAttribute('href') === '/')).toBe(true)

    // Nenhuma das duas vive dentro do painel que o toggle abre — senão a saída do
    // mobile só apareceria depois de abrir a ficha.
    const sheet = document.getElementById('character-sheet')!
    expect(exits.some(a => sheet.contains(a))).toBe(false)
  })

  it('a saída do mobile é irmã do toggle, não filha (button dentro de button é inválido)', async () => {
    render(<GameView {...baseProps} />)
    await screen.findByText('Atributos')

    const toggle = screen.getByRole('button', { name: /Ficha — Lyra Silvermoon/ })
    const exits = screen.getAllByRole('link', { name: /Voltar aos personagens/ })
    expect(exits.some(a => toggle.contains(a))).toBe(false)
  })
})

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

  // US-132: bloco de ferramentas/veículos — mesmo padrão condicional de skills (bloco próprio
  // na aba Ficha, some sem itens), nunca dentro do BackgroundPanel.
  it('mostra o bloco de ferramentas na aba Ficha quando presente', async () => {
    render(<GameView {...baseProps} tools={['Ferramentas de Ladrão', 'Jogo de Dados']} />)
    expect(await screen.findByText('Proficiências')).toBeTruthy()
    expect(screen.getByText('Ferramentas de Ladrão')).toBeTruthy()
    expect(screen.getByText('Jogo de Dados')).toBeTruthy()
  })

  it('sem tools (ou lista vazia) o bloco de ferramentas não aparece', async () => {
    render(<GameView {...baseProps} tools={[]} />)
    expect(await screen.findByText('Atributos')).toBeTruthy()
    expect(screen.queryByText('Proficiências')).toBeNull()
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

  // US-40: divindade aparece na aba Background quando presente.
  it('mostra a divindade (nome + portfólio) na aba Background quando presente', async () => {
    render(
      <GameView
        {...baseProps}
        background={{ story: 'História.', deity: { name: 'Auril', portfolio: 'goddess of winter' } }}
      />,
    )

    fireEvent.click(await screen.findByRole('tab', { name: 'Background' }))

    expect(screen.getByText('Divindade/Patrono')).toBeTruthy()
    expect(screen.getByText('Auril — goddess of winter')).toBeTruthy()
  })

  // US-40: sem deity, nenhum bloco de divindade.
  it('sem deity, a aba Background não mostra bloco de divindade', async () => {
    render(<GameView {...baseProps} background={{ story: 'História.' }} />)

    fireEvent.click(await screen.findByRole('tab', { name: 'Background' }))

    expect(screen.queryByText('Divindade/Patrono')).toBeNull()
  })

  // US-122: origem (catálogo de backgrounds, US-121) aparece na aba Background, na ficha.
  it('mostra a origem (nome) na aba Background quando presente', async () => {
    render(
      <GameView
        {...baseProps}
        characterOrigin="Acólito"
        background={{ story: 'História.' }}
      />,
    )

    fireEvent.click(await screen.findByRole('tab', { name: 'Background' }))

    expect(screen.getByText('Origem')).toBeTruthy()
    expect(screen.getByText('Acólito')).toBeTruthy()
  })

  // US-122: sem origem escolhida (ou sistema sem catálogo), nenhum bloco de Origem.
  it('sem origem, a aba Background não mostra bloco de Origem', async () => {
    render(<GameView {...baseProps} background={{ story: 'História.' }} />)

    fireEvent.click(await screen.findByRole('tab', { name: 'Background' }))

    expect(screen.queryByText('Origem')).toBeNull()
  })

  // US-122: origem sozinha (sem nenhum campo de background preenchido) já basta para a aba
  // não cair no empty state — mesmo tratamento de deity/story/listas.
  it('origem sozinha (background {}) já basta para não mostrar o empty state', async () => {
    render(<GameView {...baseProps} characterOrigin="Sábio" background={{}} />)

    fireEvent.click(await screen.findByRole('tab', { name: 'Background' }))

    expect(screen.getByText('Sábio')).toBeTruthy()
    expect(screen.queryByText('Este personagem ainda não tem história.')).toBeNull()
  })

  // US-124: conexão/memento escolhidos na criação aparecem na aba Background, em blocos
  // próprios (não misturados com a linha de origem nem com a história).
  it('mostra conexão e memento na aba Background quando presentes', async () => {
    render(
      <GameView
        {...baseProps}
        characterOrigin="Acólito"
        characterConnection="A high priest awaiting your return."
        characterMemento="A timeworn holy symbol."
        background={{ story: 'História.' }}
      />,
    )

    fireEvent.click(await screen.findByRole('tab', { name: 'Background' }))

    expect(screen.getByText('Conexão')).toBeTruthy()
    expect(screen.getByText('A high priest awaiting your return.')).toBeTruthy()
    expect(screen.getByText('Memento')).toBeTruthy()
    expect(screen.getByText('A timeworn holy symbol.')).toBeTruthy()
  })

  // US-124: sem conexão/memento escolhidos, nenhum dos dois blocos aparece.
  it('sem conexão/memento, a aba Background não mostra esses blocos', async () => {
    render(<GameView {...baseProps} characterOrigin="Acólito" background={{ story: 'História.' }} />)

    fireEvent.click(await screen.findByRole('tab', { name: 'Background' }))

    expect(screen.queryByText('Conexão')).toBeNull()
    expect(screen.queryByText('Memento')).toBeNull()
  })

  // US-124: conexão/memento sozinhos (sem origem, sem background) já bastam para não cair
  // no empty state — mesmo tratamento de origin/deity/story.
  it('conexão sozinha (sem mais nada preenchido) já basta para não mostrar o empty state', async () => {
    render(<GameView {...baseProps} characterConnection="A childhood friend who left the priesthood." background={{}} />)

    fireEvent.click(await screen.findByRole('tab', { name: 'Background' }))

    expect(screen.getByText('A childhood friend who left the priesthood.')).toBeTruthy()
    expect(screen.queryByText('Este personagem ainda não tem história.')).toBeNull()
  })

  // US-41: aba Features lista as features de classe (nome + descrição), read-only.
  it('mostra a aba Features e lista as features de classe ao clicar', async () => {
    render(
      <GameView
        {...baseProps}
        features={[
          { name: 'Sentido Divino', description: 'Sente o mal por perto.' },
          { name: 'Impor as Mãos', description: 'Cura ao toque.' },
        ]}
      />,
    )

    // A aba existe e a padrão (Ficha) não mostra features ainda.
    expect(await screen.findByRole('tab', { name: 'Features' })).toBeTruthy()
    expect(screen.queryByText('Sentido Divino')).toBeNull()

    fireEvent.click(screen.getByRole('tab', { name: 'Features' }))

    expect(await screen.findByText('Sentido Divino')).toBeTruthy()
    expect(screen.getByText('Sente o mal por perto.')).toBeTruthy()
    expect(screen.getByText('Impor as Mãos')).toBeTruthy()
    // Trocou de aba: a mecânica saiu de vista.
    expect(screen.queryByText('Atributos')).toBeNull()
  })

  it('sem features e sem magias a aba Features continua presente e mostra o empty state', async () => {
    render(<GameView {...baseProps} features={[]} spells={[]} />)

    fireEvent.click(await screen.findByRole('tab', { name: 'Features' }))

    expect(screen.getByText('Esta classe ainda não tem features nem magias registradas.')).toBeTruthy()
    // Nenhum título órfão.
    expect(screen.queryByRole('heading', { name: 'Magias' })).toBeNull()
  })

  // US-50: as magias conhecidas (Character.spells, já servido pela API) aparecem
  // numa secção da aba Features — o jogador vê o que pode conjurar.
  it('mostra as magias conhecidas (nome, nível e descrição) na aba Features', async () => {
    render(
      <GameView
        {...baseProps}
        features={[{ name: 'Conjuração', description: 'Lança magias.' }]}
        spells={[
          { key: 'cure-wounds', source: 'srd', name: 'Curar Ferimentos', level: 1, description: 'Cura HP ao toque.' },
          { key: 'sacred-flame', source: 'srd', name: 'Chama Sagrada', level: 0, description: 'Fogo radiante desce sobre o alvo.' },
        ]}
      />,
    )

    fireEvent.click(await screen.findByRole('tab', { name: 'Features' }))

    // Secções com headings reais (US-46), não <p> a fingir de título.
    expect(screen.getByRole('heading', { name: 'Features' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Magias' })).toBeTruthy()

    expect(screen.getByText('Chama Sagrada (truque)')).toBeTruthy()
    expect(screen.getByText('Fogo radiante desce sobre o alvo.')).toBeTruthy()
    expect(screen.getByText('Curar Ferimentos (nível 1)')).toBeTruthy()
    // A feature de classe continua lá, acima.
    expect(screen.getByText('Conjuração')).toBeTruthy()
  })

  it('ordena as magias por nível e depois por nome (truques primeiro)', async () => {
    render(
      <GameView
        {...baseProps}
        spells={[
          { key: 'cure-wounds', source: 'srd', name: 'Curar Ferimentos', level: 1 },
          { key: 'guidance', source: 'srd', name: 'Orientação', level: 0 },
          { key: 'sacred-flame', source: 'srd', name: 'Chama Sagrada', level: 0 },
        ]}
      />,
    )

    fireEvent.click(await screen.findByRole('tab', { name: 'Features' }))

    const names = screen.getAllByTestId('spell-name').map(el => el.textContent)
    expect(names).toEqual(['Chama Sagrada (truque)', 'Orientação (truque)', 'Curar Ferimentos (nível 1)'])
  })

  it('não-conjurador (spells: []) não mostra a secção Magias, mas mostra as features', async () => {
    render(
      <GameView
        {...baseProps}
        features={[{ name: 'Estilo de Combate', description: 'Bónus com armas.' }]}
        spells={[]}
      />,
    )

    fireEvent.click(await screen.findByRole('tab', { name: 'Features' }))

    expect(await screen.findByText('Estilo de Combate')).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Magias' })).toBeNull()
    expect(screen.queryByText('Esta classe ainda não tem features nem magias registradas.')).toBeNull()
  })

  it('HP fica fixo acima das abas e continua visível na aba Background', async () => {
    render(<GameView {...baseProps} background={{ story: 'História.' }} />)

    expect(await screen.findByText('10/10')).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: 'Background' }))
    // HP não pertence a nenhuma aba — segue visível.
    expect(screen.getByText('10/10')).toBeTruthy()
  })
})

describe('GameView — editar a última ação (US-67)', () => {
  it('só a última ação editável expõe o botão; clicar entra em modo edição', async () => {
    getTurns.mockResolvedValue([
      { role: 'user', content: 'ataco o guarda' },
      { role: 'dm', content: 'O guarda cai.' },
      { role: 'user', content: 'abro a porta com a chava', editable: true },
      { role: 'dm', content: 'A porta range.' },
    ])
    render(<GameView {...baseProps} />)

    // Só um botão de editar — na última ação.
    const editBtn = await screen.findByRole('button', { name: 'Editar a sua última ação' })
    expect(screen.getAllByRole('button', { name: 'Editar a sua última ação' })).toHaveLength(1)

    fireEvent.click(editBtn)

    // Texto volta ao campo e o modo edição aparece (Salvar edição + Cancelar).
    expect((screen.getByLabelText('Editar a sua ação') as HTMLTextAreaElement).value).toBe('abro a porta com a chava')
    expect(screen.getByRole('button', { name: 'Salvar edição' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeTruthy()
  })

  it('turno sem editable (mutou estado / resumido) não expõe o botão de editar', async () => {
    getTurns.mockResolvedValue([
      { role: 'user', content: 'aparo o golpe' },
      { role: 'dm', content: 'A lâmina raspa o teu braço.' },
    ])
    render(<GameView {...baseProps} />)

    expect(await screen.findByText('A lâmina raspa o teu braço.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Editar a sua última ação' })).toBeNull()
  })

  it('Cancelar sai do modo edição e esvazia o campo sem mexer no histórico', async () => {
    getTurns.mockResolvedValue([
      { role: 'user', content: 'abro a porta com a chava', editable: true },
      { role: 'dm', content: 'A porta range.' },
    ])
    render(<GameView {...baseProps} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Editar a sua última ação' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect((screen.getByLabelText('A sua ação') as HTMLTextAreaElement).value).toBe('')
    expect(screen.queryByRole('button', { name: 'Cancelar' })).toBeNull()
    // Histórico intacto.
    expect(screen.getByText('A porta range.')).toBeTruthy()
  })
})
