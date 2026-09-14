import { createSeededRandom, deriveAdventureSeed, type AdventureRegistry } from '@ai-dm/shared'
import { AREA_TYPES, NAMING_REGISTERS, SETTINGS, TONES } from './registry-catalog'

export type { AdventureRegistry }

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

// US-232: contagem de facções sorteada em [2,4] no Game Server (determinístico, mesma
// disciplina de dados — não é o modelo que decide quantas), passada ao prompt de autoria como
// restrição. Sortear a CONTAGEM (não conteúdo de tabela) mantém variedade estrutural sem
// reintroduzir a montagem-por-tabela. Sub-seed próprio (`characterId:factionCount`), ao lado de
// `rollRegistry` — mesmas primitivas já importadas aqui, sem deslocar as rolagens de registro.
export function rollFactionCount(characterId: string, order: number, attempt = 0): number {
  const seed = deriveAdventureSeed(`${characterId}:factionCount`, order, attempt)
  const rand = createSeededRandom(seed)
  return 2 + Math.floor(rand() * 3) // [2,4]
}

// US-240: UM registro de nomenclatura sorteado pra aventura INTEIRA (mundo, facções, locais,
// NPCs, recompensa) — nunca um por entidade, pra não soar como colcha de retalhos cultural.
// Mesmo formato de `rollFactionCount` (sub-seed próprio `characterId:namingRegister`, ao lado
// das outras rolagens, sem deslocá-las); sorteio ÚNICO, sem `slot`, sem loop.
export function rollNamingRegister(characterId: string, order: number, attempt = 0): string {
  const seed = deriveAdventureSeed(`${characterId}:namingRegister`, order, attempt)
  const rand = createSeededRandom(seed)
  return NAMING_REGISTERS[Math.floor(rand() * NAMING_REGISTERS.length)]!
}
