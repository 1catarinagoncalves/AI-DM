import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { SessionProvider } from 'next-auth/react'

const { getTurns, setLocale } = vi.hoisted(() => ({ getTurns: vi.fn(), setLocale: vi.fn() }))
vi.mock('@/lib/api', () => ({ api: { getTurns, setLocale } }))

import { LocaleProvider, LOCALE_STORAGE_KEY } from './LocaleProvider'
import { LocaleToggle } from './LocaleToggle'
import { GameView } from './game/GameView'

// happy-dom não implementa scrollIntoView; a GameView chama no efeito de mensagens.
beforeEach(() => {
  getTurns.mockResolvedValue([])
  setLocale.mockResolvedValue({ id: 'u1', locale: 'en-US' })
  Element.prototype.scrollIntoView = vi.fn()
  localStorage.clear()
})
afterEach(() => cleanup())

function renderWithLocale(children: React.ReactNode) {
  // Sessão nula = visitante: a preferência vive no localStorage, sem conta ainda.
  return render(
    <SessionProvider session={null}>
      <LocaleProvider>{children}</LocaleProvider>
    </SessionProvider>,
  )
}

describe('LocaleToggle — seletor de idioma (US-97)', () => {
  it('mostra as duas opções por extenso e marca a ativa', async () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'pt-BR')
    renderWithLocale(<LocaleToggle />)

    const pt = await screen.findByRole('button', { name: 'Português' })
    const en = screen.getByRole('button', { name: 'English' })
    // pt-BR é o default do produto: nasce ativa quando não há preferência salva.
    expect(pt.getAttribute('aria-pressed')).toBe('true')
    expect(en.getAttribute('aria-pressed')).toBe('false')
  })

  it('trocar para English persiste a escolha e move o `lang` do <html>', async () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'pt-BR')
    renderWithLocale(<LocaleToggle />)

    fireEvent.click(await screen.findByRole('button', { name: 'English' }))

    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('en-US')
    // US-46: sem isto o leitor de tela lê inglês com voz portuguesa.
    expect(document.documentElement.lang).toBe('en-US')
    expect(screen.getByRole('button', { name: 'English' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('preferência salva vence o default ao montar', async () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'en-US')
    renderWithLocale(<LocaleToggle />)
    expect((await screen.findByRole('button', { name: 'English' })).getAttribute('aria-pressed')).toBe('true')
  })
})

const gameProps = {
  adventureId: 'adv-1',
  characterId: 'char-1',
  characterName: 'Lyra Silvermoon',
  characterClass: 'Maga',
  characterRace: 'Elfa',
  hp: 10,
  maxHp: 10,
  attributes: { strength: 16 },
  skills: [],
  conditions: [],
  inventory: [],
}

describe('GameView — aviso de troca de idioma no chat (US-97)', () => {
  it('trocar o idioma na mesa insere a pílula, escrita no idioma NOVO', async () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'pt-BR')
    renderWithLocale(<GameView {...gameProps} />)

    // Nada de aviso antes da troca: montar não é trocar.
    expect(screen.queryByText('Language changed to English')).toBeNull()

    fireEvent.click(await screen.findByRole('button', { name: 'English' }))

    expect(await screen.findByText('Language changed to English')).toBeTruthy()
  })

  it('a pílula NÃO entra no cache do histórico — é marcador de sessão, não turno', async () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'pt-BR')
    renderWithLocale(<GameView {...gameProps} />)

    fireEvent.click(await screen.findByRole('button', { name: 'English' }))
    await screen.findByText('Language changed to English')

    const cached = localStorage.getItem('ai-dm-history-adv-1') ?? '[]'
    expect(cached).not.toContain('locale')
  })
})
