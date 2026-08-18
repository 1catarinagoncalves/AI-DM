import { createSeededRandom, deriveAdventureSeed } from '@ai-dm/shared'
import { AREA_TYPES, SETTINGS, TONES } from './registry-catalog'

export interface AdventureRegistry {
  setting: string
  tone: string
  areaType: string
}

export interface AdventureRegistryOverrides {
  setting?: string
  tone?: string
  areaType?: string
}

// US-147: cada campo tem seu próprio sub-seed (characterId+campo+order) — nunca uma sequência
// compartilhada. É o que garante o critério de aceite "registro diferente não afeta o
// determinismo do conteúdo": escolher `tone` manualmente não desloca a rolagem de `setting`
// nem a de `areaType`, porque cada uma nunca consumiu a mesma sequência de números.
function pickCandidate(characterId: string, order: number, field: string, candidates: readonly string[], attempt: number): string {
  const seed = deriveAdventureSeed(`${characterId}:${field}`, order, attempt)
  const rand = createSeededRandom(seed)
  return candidates[Math.floor(rand() * candidates.length)]!
}

/**
 * Registro — decidido UMA vez por aventura, antes de qualquer rolagem de conteúdo
 * (rollContent). Cada campo é independente: aceita valor escolhido pelo jogador (DTO da
 * US-156, quando existir) ou sorteia sozinho quando ausente — sem exigir que os três venham
 * juntos. `attempt` (US-150, reseed): default `0`, repassado ao seed de cada campo.
 */
export function rollRegistry(characterId: string, order: number, overrides: AdventureRegistryOverrides = {}, attempt = 0): AdventureRegistry {
  return {
    setting: overrides.setting ?? pickCandidate(characterId, order, 'setting', SETTINGS, attempt),
    tone: overrides.tone ?? pickCandidate(characterId, order, 'tone', TONES, attempt),
    areaType: overrides.areaType ?? pickCandidate(characterId, order, 'areaType', AREA_TYPES, attempt),
  }
}
