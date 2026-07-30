import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

// US-66: regressão de responsividade. happy-dom não aplica CSS do Tailwind, então
// não medimos layout renderizado — asseguramos as CLASSES/estruturas que fazem o
// mobile funcionar, falhando se voltarem ao estado desktop-only descrito na US.

const { listSystems, getTurns } = vi.hoisted(() => ({ listSystems: vi.fn(), getTurns: vi.fn() }))
vi.mock('@/lib/api', () => ({ api: { listSystems, getTurns } }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

import { SetupWizard } from './setup/SetupWizard'
import { GameView } from './game/GameView'

afterEach(() => cleanup())

describe('US-66 — trilha do wizard não espreme 7 rótulos no mobile', () => {
  beforeEach(() => {
    listSystems.mockReset()
    listSystems.mockResolvedValue([{ id: 'sys-1', name: 'D&D 5e SRD', sourceType: 'SRD', config: null }])
  })

  it('mostra um rótulo único de etapa e esconde os rótulos da trilha no mobile', async () => {
    render(<SetupWizard />)
    await screen.findByText('D&D 5e SRD')

    // Rótulo-resumo só-mobile: "Etapa 1 de N — <label>".
    expect(screen.getByText(/Etapa 1 de \d+ —/)).toBeTruthy()

    // Os rótulos por-etapa da trilha ficam `hidden sm:block` (só aparecem a partir de sm).
    // 'Atributos' só existe como rótulo de etapa nesta tela — bom sentinela.
    const stepLabel = screen.getByText('Atributos')
    expect(stepLabel.className).toContain('hidden')
    expect(stepLabel.className).toContain('sm:block')
  })
})

describe('US-66 — ficha na mesa é painel recolhível no mobile, não faixa horizontal', () => {
  beforeEach(() => {
    getTurns.mockReset()
    getTurns.mockResolvedValue([])
    Element.prototype.scrollIntoView = vi.fn()
  })

  const props = {
    adventureId: 'adv-1',
    characterId: 'char-1',
    characterName: 'Lyra',
    characterClass: 'Maga',
    characterRace: 'Elfa',
    hp: 10,
    maxHp: 10,
    attributes: { strength: 16 },
  }

  it('tem um toggle da ficha (mobile) e o painel não usa overflow-x-auto', async () => {
    const { container } = render(<GameView {...props} />)
    await screen.findByText('Atributos')

    // Toggle recolhível (D1): botão só-mobile controlando o painel da ficha.
    const toggle = screen.getByRole('button', { name: /Ficha — Lyra/ })
    expect(toggle.getAttribute('aria-controls')).toBe('character-sheet')
    expect(toggle.className).toContain('md:hidden')

    // O painel existe e NÃO volta à tira horizontal (`overflow-x-auto`).
    const sheet = container.querySelector('#character-sheet')
    expect(sheet).not.toBeNull()
    expect(sheet!.className).not.toContain('overflow-x-auto')
  })

  it('a lista de narração preenche o espaço (flex-1 min-h-0) sem calc fixo de altura', async () => {
    render(<GameView {...props} />)
    await screen.findByText('Atributos')

    const log = screen.getByRole('log')
    expect(log.className).toContain('flex-1')
    expect(log.className).toContain('min-h-0')
    // Sem o chute de chrome de desktop: nenhum maxHeight inline.
    expect(log.style.maxHeight).toBe('')
  })

  // Regressão: a coluna de jogo perdeu o `min-h-0` no passe de design e o mobile
  // partiu — sem ele o min-height é `auto` (= altura do conteúdo), o pai
  // `h-dvh overflow-hidden` não a consegue encolher, e a narração empurrava a caixa
  // de ação ~2200px abaixo do ecrã (medido a 375×812) em vez de rolar por dentro.
  // happy-dom não faz layout, então o guard é sobre a classe — como nos testes acima.
  it('a coluna de jogo encolhe dentro do h-dvh (min-h-0), senão o input sai do ecrã no mobile', async () => {
    render(<GameView {...props} />)
    await screen.findByText('Atributos')

    const chatColumn = screen.getByRole('log').parentElement!
    expect(chatColumn.className).toContain('min-h-0')
    expect(chatColumn.className).toContain('flex-1')
  })

  // Regressão: a barra da ficha era baixa demais (56px) e os controlos fixos do
  // layout (Sair + tema, que ocupam 16px→60px na vertical) transbordavam dela para
  // cima da narração. A barra tem de os conter: min-h ≥ 60px.
  it('a barra da ficha é alta o bastante para conter os controlos fixos (Sair/tema)', async () => {
    render(<GameView {...props} />)
    await screen.findByText('Atributos')

    const toggle = screen.getByRole('button', { name: /Ficha — Lyra/ })
    const minH = /min-h-\[(\d+)px\]/.exec(toggle.className)
    expect(minH).not.toBeNull()
    expect(Number(minH![1])).toBeGreaterThanOrEqual(60)
    // Reserva de largura para os mesmos controlos não taparem o nome.
    expect(toggle.className).toContain('pr-40')
  })

  // Regressão: no turno normal o enviar caía numa linha própria abaixo do textarea
  // (o `flex-col` do mobile, que só o modo edição precisa). Fora da edição os dois
  // ficam na mesma linha.
  it('no turno normal o enviar fica na mesma linha do textarea (sem flex-col)', async () => {
    render(<GameView {...props} />)
    await screen.findByText('Atributos')

    const send = screen.getByRole('button', { name: 'Enviar ação' })
    const row = send.parentElement!.parentElement!
    // Âncora: é mesmo a linha que junta os dois (senão o guard passaria em vazio
    // por apanhar um elemento errado que também não tem `flex-col`).
    expect(row.contains(screen.getByLabelText('A tua ação'))).toBe(true)
    expect(row.className).not.toContain('flex-col')
  })
})
