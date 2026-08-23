import type { AdventureLocation } from '@ai-dm/shared'
import type { EncounterType } from './shuffle-encounter-types'

/**
 * US-187: round-robin de locationId FILTRADO por vibe — dentro do subconjunto de
 * `locations` com `vibe === type`. Subconjunto vazio cai no round-robin original sobre
 * `locations` inteiro (mesmo mecanismo da US-166, nunca removido) — nunca bloqueia,
 * nunca falha o `.parse()`. `usedFallback` avisa quem chama que caiu no fallback, sem
 * precisar recalcular o filtro de novo.
 */
export function pickLocationIdForType(
  locations: AdventureLocation[],
  type: EncounterType,
  matchedCount: number,
  globalIndex: number,
): { id: string; usedFallback: boolean } {
  const matching = locations.filter((location) => location.vibe === type)
  if (matching.length === 0) {
    return { id: locations[globalIndex % locations.length]!.id, usedFallback: true }
  }
  return { id: matching[matchedCount % matching.length]!.id, usedFallback: false }
}
