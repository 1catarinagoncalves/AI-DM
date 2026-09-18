import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/api'

// US-256: o chat abre com a introdução + abertura prontas enquanto o RESTO da aventura
// (desafios/encontros/objetivo) ainda gera em segundo plano (Adventure.status = OPENING_READY).
// Nessa janela o backend recusa turno (409) — este hook só diz à tela se ela deve bloquear
// o input e se há algo a mostrar/repetir. O guard do servidor é o que vale; a UI evita o clique inútil.
//
// Mesmos valores de pollAdventureStatus (SetupWizard.tsx, US-235): 3s entre consultas e teto
// de 300s, a folga que o wizard já provou necessária em geração lenta real.
const STATUS_POLL_INTERVAL_MS = 3000
const STATUS_POLL_TIMEOUT_MS = 300_000

/** ready = pode jogar · preparing = resto ainda gerando · failed = resto falhou ou estourou o teto. */
export type ReadinessPhase = 'ready' | 'preparing' | 'failed'

export interface AdventureReadiness {
  phase: ReadinessPhase
  /** "Tentar de novo" em andamento (desabilita o botão). */
  retrying: boolean
  /** O retry falhou — a tela mostra texto genérico próprio; a mensagem da API nunca chega aqui. */
  retryError: boolean
  retry: () => Promise<void>
}

// null = "não sei" (rede/API falhou). AGENTS.md: erro da API nunca vai para a tela e NUNCA
// derruba a tela — quem chama decide o que "não sei" significa em cada momento.
async function readStatus(characterId: string, adventureId: string): Promise<string | null> {
  try {
    return (await api.getAdventureStatus(characterId, adventureId)).status
  } catch {
    return null
  }
}

function phaseOf(status: string | null): ReadinessPhase {
  if (status === 'OPENING_READY') return 'preparing'
  return status === 'FAILED' ? 'failed' : 'ready'
}

// Resolve no prazo OU ao abortar — o loop de polling checa o sinal e sai, em vez de ficar
// pendurado num timer que o cleanup do efeito já limpou.
function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => { clearTimeout(timer); resolve() }, { once: true })
  })
}

// Consulta até o status sair de OPENING_READY. Erro de rede no meio não é falha (tenta na
// rodada seguinte). "Estourou o teto" != "falhou" (US-235, Bardo 15/09/2026): o resto pode ter
// terminado um instante depois do último poll — UMA consulta final decide antes de declarar.
// Devolve null quando abortado (o efeito já foi desmontado; ninguém mais escuta).
async function pollUntilRestSettles(characterId: string, adventureId: string, signal: AbortSignal): Promise<ReadinessPhase | null> {
  const deadline = Date.now() + STATUS_POLL_TIMEOUT_MS
  while (Date.now() < deadline) {
    await sleep(STATUS_POLL_INTERVAL_MS, signal)
    if (signal.aborted) return null
    const status = await readStatus(characterId, adventureId)
    if (signal.aborted) return null
    if (status !== null && status !== 'OPENING_READY') return phaseOf(status)
  }
  const last = await readStatus(characterId, adventureId)
  if (signal.aborted) return null
  return last === null || last === 'OPENING_READY' ? 'failed' : phaseOf(last)
}

export function useAdventureReadiness(characterId: string, adventureId: string): AdventureReadiness {
  // Começa liberado: a consulta inicial roda em paralelo ao getTurns (que já trava o input
  // no warm-up) e o backend recusa o turno de qualquer forma.
  const [phase, setPhase] = useState<ReadinessPhase>('ready')
  const [retrying, setRetrying] = useState(false)
  const [retryError, setRetryError] = useState(false)

  useEffect(() => {
    let stale = false
    readStatus(characterId, adventureId).then((status) => { if (!stale) setPhase(phaseOf(status)) })
    return () => { stale = true }
  }, [characterId, adventureId])

  // Só corre em 'preparing' — o retry bem-sucedido volta a este estado e o polling recomeça.
  useEffect(() => {
    if (phase !== 'preparing') return
    const abort = new AbortController()
    pollUntilRestSettles(characterId, adventureId, abort.signal).then((next) => { if (next) setPhase(next) })
    return () => abort.abort()
  }, [phase, characterId, adventureId])

  const retry = useCallback(async () => {
    setRetrying(true)
    setRetryError(false)
    try {
      await api.retryAdventureRest(characterId, adventureId)
      setPhase('preparing')
    } catch {
      setRetryError(true)
    } finally {
      setRetrying(false)
    }
  }, [characterId, adventureId])

  return { phase, retrying, retryError, retry }
}
