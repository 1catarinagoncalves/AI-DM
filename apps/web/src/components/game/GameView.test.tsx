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

    expect(screen.getByText('Esta classe ainda não tem features nem magias registadas.')).toBeTruthy()
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
          { name: 'Curar Ferimentos', level: 1, description: 'Cura HP ao toque.' },
          { name: 'Chama Sagrada', level: 0, description: 'Fogo radiante desce sobre o alvo.' },
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
          { name: 'Curar Ferimentos', level: 1 },
          { name: 'Orientação', level: 0 },
          { name: 'Chama Sagrada', level: 0 },
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
    expect(screen.queryByText('Esta classe ainda não tem features nem magias registadas.')).toBeNull()
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
    const editBtn = await screen.findByRole('button', { name: 'Editar a tua última ação' })
    expect(screen.getAllByRole('button', { name: 'Editar a tua última ação' })).toHaveLength(1)

    fireEvent.click(editBtn)

    // Texto volta ao campo e o modo edição aparece (Salvar edição + Cancelar).
    expect((screen.getByLabelText('Editar a tua ação') as HTMLTextAreaElement).value).toBe('abro a porta com a chava')
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
    expect(screen.queryByRole('button', { name: 'Editar a tua última ação' })).toBeNull()
  })

  it('Cancelar sai do modo edição e esvazia o campo sem mexer no histórico', async () => {
    getTurns.mockResolvedValue([
      { role: 'user', content: 'abro a porta com a chava', editable: true },
      { role: 'dm', content: 'A porta range.' },
    ])
    render(<GameView {...baseProps} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Editar a tua última ação' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect((screen.getByLabelText('A tua ação') as HTMLTextAreaElement).value).toBe('')
    expect(screen.queryByRole('button', { name: 'Cancelar' })).toBeNull()
    // Histórico intacto.
    expect(screen.getByText('A porta range.')).toBeTruthy()
  })
})
