import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, act } from '@testing-library/react'
import { AdventureLoadingScreen } from './AdventureLoadingScreen'

const DELAY_THRESHOLD_MS = 120_000

describe('AdventureLoadingScreen (US-197)', () => {
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  // US-197: mensagem troca sozinha em intervalo fixo, aria-live polite para leitor de tela,
  // e cicla (nunca para nem fica em branco) mesmo depois de passar por todo o conjunto.
  it('cicla a mensagem visível em intervalo fixo, com aria-live polite, sem parar nem ficar em branco', () => {
    vi.useFakeTimers()
    const { container } = render(<AdventureLoadingScreen delayThresholdMs={DELAY_THRESHOLD_MS} />)
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
    const { unmount } = render(<AdventureLoadingScreen delayThresholdMs={DELAY_THRESHOLD_MS} />)
    unmount()
    expect(clearSpy).toHaveBeenCalled()
  })
})

describe('AdventureLoadingScreen (US-265)', () => {
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('diz que o personagem está salvo e o que sair significa', () => {
    const { getByText } = render(<AdventureLoadingScreen delayThresholdMs={DELAY_THRESHOLD_MS} />)
    expect(getByText('Seu personagem já está salvo.')).toBeTruthy()
    expect(getByText(/Pode sair agora/)).toBeTruthy()
  })

  // Regressão: limiar é 120s (STATUS_POLL_TIMEOUT_MS mora em SetupWizard.tsx, este componente
  // só recebe o valor pronto) — aos 100s ainda não avisa, aos 130s já avisa.
  it('não mostra o aviso de demora aos 100s e mostra aos 130s', () => {
    vi.useFakeTimers()
    const { queryByText } = render(<AdventureLoadingScreen delayThresholdMs={DELAY_THRESHOLD_MS} />)
    const delayText = 'Isso está demorando mais que o normal, mas a aventura ainda está sendo criada.'

    act(() => { vi.advanceTimersByTime(100_000) })
    expect(queryByText(delayText)).toBeNull()

    act(() => { vi.advanceTimersByTime(30_000) })
    expect(queryByText(delayText)).toBeTruthy()
  })

  it('limpa o timeout de demora no unmount', () => {
    vi.useFakeTimers()
    const clearSpy = vi.spyOn(globalThis, 'clearTimeout')
    const { unmount } = render(<AdventureLoadingScreen delayThresholdMs={DELAY_THRESHOLD_MS} />)
    unmount()
    expect(clearSpy).toHaveBeenCalled()
  })
})
