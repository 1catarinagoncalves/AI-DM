import { createSeededRandom, deriveAdventureSeed } from '@ai-dm/shared'
import { TONES } from './registry-catalog'

export interface AdventureRegistry {
  tone: string
}

export interface AdventureRegistryOverrides {
  tone?: string
}

// US-147: cada campo tem seu próprio sub-seed (characterId+campo+order) — nunca uma sequência
// compartilhada.
function pickCandidate(characterId: string, order: number, field: string, candidates: readonly string[], attempt: number): string {
  const seed = deriveAdventureSeed(`${characterId}:${field}`, order, attempt)
  const rand = createSeededRandom(seed)
  return candidates[Math.floor(rand() * candidates.length)]!
}

/**
 * Registro — decidido UMA vez por aventura, antes de qualquer rolagem de conteúdo
 * (rollContent). Aceita valor escolhido pelo jogador (DTO da US-156) ou sorteia sozinho
 * quando ausente. `attempt` (US-150, reseed): default `0`, repassado ao seed do campo.
 * US-173: `setting`/`areaType` saíram do registro — só `tone` sobrevive (único eixo com
 * consumidor fora da geração de conteúdo, ver US-173).
 */
export function rollRegistry(characterId: string, order: number, overrides: AdventureRegistryOverrides = {}, attempt = 0): AdventureRegistry {
  return {
    tone: overrides.tone ?? pickCandidate(characterId, order, 'tone', TONES, attempt),
  }
}
