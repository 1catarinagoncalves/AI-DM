import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const { getAdventureStatus, retryAdventureRest } = vi.hoisted(() => ({
  getAdventureStatus: vi.fn(),
  retryAdventureRest: vi.fn(),
}))
vi.mock('@/lib/api', () => ({ api: { getAdventureStatus, retryAdventureRest } }))

import { useAdventureReadiness } from './useAdventureReadiness'

// US-256: o chat consulta o status da aventura ao montar; enquanto o RESTO ainda gera
// (OPENING_READY) o hook diz 'preparing' e faz polling — mesmos 3s/300s do wizard (US-235).
// Tempo controlado com fake timers: a espera real seria de 5 minutos.
const POLL_MS = 3000
const TIMEOUT_MS = 300_000

async function tick(ms: number) {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms) })
}

function mount() {
  return renderHook(() => useAdventureReadiness('char-1', 'adv-1'))
}

beforeEach(() => {
  vi.useFakeTimers()
  getAdventureStatus.mockReset()
  retryAdventureRest.mockReset()
})
afterEach(() => vi.useRealTimers())

describe('useAdventureReadiness — consulta ao montar', () => {
  it('ACTIVE: sem restrição e sem polling', async () => {
    getAdventureStatus.mockResolvedValue({ status: 'ACTIVE' })
    const { result } = mount()
    await tick(0)

    expect(getAdventureStatus).toHaveBeenCalledWith('char-1', 'adv-1')
    expect(result.current.phase).toBe('ready')
    await tick(POLL_MS * 5)
    expect(getAdventureStatus).toHaveBeenCalledTimes(1)
  })

  it('erro de rede/API na consulta inicial nunca derruba a tela: trata como sem restrição', async () => {
    getAdventureStatus.mockRejectedValue(new Error('Erro cru da API em português'))
    const { result } = mount()
    await tick(0)

    expect(result.current.phase).toBe('ready')
    await tick(POLL_MS * 5)
    expect(getAdventureStatus).toHaveBeenCalledTimes(1)
  })

  it('OPENING_READY: fica em preparing', async () => {
    getAdventureStatus.mockResolvedValue({ status: 'OPENING_READY' })
    const { result } = mount()
    await tick(0)

    expect(result.current.phase).toBe('preparing')
  })

  it('FAILED ao abrir o chat: já mostra a falha (o backend recusa turno fora de ACTIVE)', async () => {
    getAdventureStatus.mockResolvedValue({ status: 'FAILED' })
    const { result } = mount()
    await tick(0)

    expect(result.current.phase).toBe('failed')
  })
})

describe('useAdventureReadiness — polling enquanto o resto gera', () => {
  it('consulta a cada 3s e libera ao virar ACTIVE', async () => {
    getAdventureStatus
      .mockResolvedValueOnce({ status: 'OPENING_READY' }) // consulta ao montar
      .mockResolvedValueOnce({ status: 'OPENING_READY' }) // poll 1 (3s)
      .mockResolvedValueOnce({ status: 'ACTIVE' })        // poll 2 (6s)
    const { result } = mount()
    await tick(0)

    await tick(POLL_MS)
    expect(result.current.phase).toBe('preparing')
    await tick(POLL_MS)
    expect(result.current.phase).toBe('ready')

    await tick(POLL_MS * 5) // parou de consultar
    expect(getAdventureStatus).toHaveBeenCalledTimes(3)
  })

  it('FAILED durante o polling vira failed', async () => {
    getAdventureStatus
      .mockResolvedValueOnce({ status: 'OPENING_READY' })
      .mockResolvedValueOnce({ status: 'FAILED', error: 'teto esgotado' })
    const { result } = mount()
    await tick(0)
    await tick(POLL_MS)

    expect(result.current.phase).toBe('failed')
  })

  it('erro de rede no meio do polling não é falha: tenta de novo na rodada seguinte', async () => {
    getAdventureStatus
      .mockResolvedValueOnce({ status: 'OPENING_READY' })
      .mockRejectedValueOnce(new Error('rede'))
      .mockResolvedValueOnce({ status: 'ACTIVE' })
    const { result } = mount()
    await tick(0)

    await tick(POLL_MS)
    expect(result.current.phase).toBe('preparing')
    await tick(POLL_MS)
    expect(result.current.phase).toBe('ready')
  })

  it('estourou o teto (300s) e o resto continua OPENING_READY → failed, com UMA consulta final', async () => {
    getAdventureStatus.mockResolvedValue({ status: 'OPENING_READY' })
    const { result } = mount()
    await tick(0)

    await tick(TIMEOUT_MS - POLL_MS)
    expect(result.current.phase).toBe('preparing') // ainda dentro do teto

    await tick(POLL_MS + 1)
    expect(result.current.phase).toBe('failed')
    // 1 ao montar + 100 no loop (300s / 3s) + 1 final: a final é a que decide.
    expect(getAdventureStatus).toHaveBeenCalledTimes(102)
  })

  // "Estourou o teto" != "falhou" (US-235, Bardo 15/09/2026): o resto pode ter terminado um
  // instante depois do último poll do loop — a consulta final pega esse ACTIVE tardio.
  it('a consulta final pega o ACTIVE tardio: não declara falha', async () => {
    let calls = 0
    // Consulta 1 = montagem, 2..101 = loop, 102 = final: só a final vê ACTIVE.
    getAdventureStatus.mockImplementation(async () => ({ status: ++calls <= 101 ? 'OPENING_READY' : 'ACTIVE' }))
    const { result } = mount()
    await tick(0)
    await tick(TIMEOUT_MS + 1)

    expect(result.current.phase).toBe('ready')
  })

  it('desmontar o chat interrompe o polling', async () => {
    getAdventureStatus.mockResolvedValue({ status: 'OPENING_READY' })
    const { unmount } = mount()
    await tick(0)
    await tick(POLL_MS)
    const before = getAdventureStatus.mock.calls.length

    unmount()
    await tick(POLL_MS * 10)
    expect(getAdventureStatus).toHaveBeenCalledTimes(before)
  })
})

describe('useAdventureReadiness — tentar de novo', () => {
  async function mountFailed() {
    getAdventureStatus.mockResolvedValueOnce({ status: 'FAILED' })
    const hook = mount()
    await tick(0)
    return hook
  }

  it('retry chama retryAdventureRest, volta a preparing e retoma o polling até ACTIVE', async () => {
    const { result } = await mountFailed()
    retryAdventureRest.mockResolvedValue({ status: 'OPENING_READY' })
    getAdventureStatus.mockResolvedValueOnce({ status: 'ACTIVE' })

    await act(async () => { await result.current.retry() })
    expect(retryAdventureRest).toHaveBeenCalledWith('char-1', 'adv-1')
    expect(result.current.phase).toBe('preparing')
    expect(result.current.retryError).toBe(false)

    await tick(POLL_MS)
    expect(result.current.phase).toBe('ready')
  })

  it('retry que falha mantém failed e marca retryError — o texto da API nunca sai do hook', async () => {
    const { result } = await mountFailed()
    retryAdventureRest.mockRejectedValue(new Error('A fatia da aventura não existe'))

    await act(async () => { await result.current.retry() })

    expect(result.current.phase).toBe('failed')
    expect(result.current.retryError).toBe(true)
    expect(result.current.retrying).toBe(false)
    expect(JSON.stringify(result.current)).not.toContain('A fatia da aventura não existe')
  })

  it('nova tentativa depois de um retry que falhou limpa o retryError', async () => {
    const { result } = await mountFailed()
    retryAdventureRest.mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce({ status: 'OPENING_READY' })
    getAdventureStatus.mockResolvedValue({ status: 'OPENING_READY' })

    await act(async () => { await result.current.retry() })
    expect(result.current.retryError).toBe(true)
    await act(async () => { await result.current.retry() })

    expect(result.current.retryError).toBe(false)
    expect(result.current.phase).toBe('preparing')
  })
})
