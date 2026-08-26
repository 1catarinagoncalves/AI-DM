import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, act } from '@testing-library/react'
import { AdventureLoadingScreen } from './AdventureLoadingScreen'

describe('AdventureLoadingScreen (US-197)', () => {
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  // US-197: mensagem troca sozinha em intervalo fixo, aria-live polite para leitor de tela,
  // e cicla (nunca para nem fica em branco) mesmo depois de passar por todo o conjunto.
  it('cicla a mensagem visível em intervalo fixo, com aria-live polite, sem parar nem ficar em branco', () => {
    vi.useFakeTimers()
    const { container } = render(<AdventureLoadingScreen />)
    const live = container.querySelector('[aria-live="polite"]')!
    expect(live.getAttribute('aria-live')).toBe('polite')

    const seen = new Set<string>()
    seen.add(live.textContent!)
    for (let i = 0; i < 8; i++) {
      act(() => { vi.advanceTimersByTime(3000) })
      expect(live.textContent).toBeTruthy() // nunca em branco
      seen.add(live.textContent!)
    }
    // 8 trocas sobre um conjunto de 6 força voltar ao início pelo menos uma vez (loop).
    expect(seen.size).toBeGreaterThanOrEqual(4)
  })

  // US-197: sem isto, o teste (e o app) acusa warning de state update pós-unmount —
  // a troca de rota em createWorldAdventure desmonta o wizard com o intervalo ainda vivo.
  it('limpa o intervalo no unmount', () => {
    vi.useFakeTimers()
    const clearSpy = vi.spyOn(globalThis, 'clearInterval')
    const { unmount } = render(<AdventureLoadingScreen />)
    unmount()
    expect(clearSpy).toHaveBeenCalled()
  })
})
