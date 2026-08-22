import { createSeededRandom, deriveAdventureSeed } from '@ai-dm/shared'

export type EncounterType = 'combat' | 'skill' | 'social'

// US-166: multiset das posições 1-7. `combatViable` decide ANTES do shuffle, não depois —
// `combatViable = composeEncounterRoles(level, challenge).length > 0` (monster-roles.ts).
// Inviável (nível 1-3, modo 'adventure'): 'combat' some do multiset inteiro, nunca aparece
// como npcIds vazio (ver Decisões fechadas da US-166).
const COMBAT_VIABLE_MULTISET: EncounterType[] = ['combat', 'combat', 'skill', 'skill', 'skill', 'social', 'social']
const COMBAT_INVIABLE_MULTISET: EncounterType[] = ['social', 'social', 'social', 'social', 'skill', 'skill', 'skill']

function hasAdjacentRepeat(sequence: EncounterType[]): boolean {
  return sequence.some((type, i) => i > 0 && type === sequence[i - 1])
}

/**
 * Greedy "reorganize string" (LeetCode 767): a cada slot escolhe, entre os tipos que ainda
 * restam e não repetem o anterior, o de MAIOR contagem restante (empate quebrado pelo seed) —
 * único algoritmo que GARANTE arranjo sem repetição adjacente sempre que ele existe (condição
 * necessária/suficiente: nenhuma contagem > ceil(n/2)). Shuffle-e-rejeita (tentativa anterior
 * desta função) falhava aqui: `{social×4, skill×3}` tem UM ÚNICO arranjo interno válido
 * (alternado, começando E terminando em social — 4 sociais em 7 posições força isso por
 * contagem), então sortear e rejeitar até acertar essa exata sequência tem ~2,9% de chance por
 * tentativa — não confiável em 20 tentativas, e SEMPRE termina em social por construção.
 */
function greedyNoAdjacentSequence(multiset: EncounterType[], rand: () => number): EncounterType[] {
  const counts = new Map<EncounterType, number>()
  for (const type of multiset) counts.set(type, (counts.get(type) ?? 0) + 1)

  const result: EncounterType[] = []
  for (let slot = 0; slot < multiset.length; slot++) {
    const prev = result[slot - 1]
    const candidates = [...counts.entries()].filter(([type, count]) => count > 0 && type !== prev)
    if (candidates.length === 0) {
      throw new Error(`shuffleEncounterTypes: multiset ${JSON.stringify(multiset)} não admite arranjo sem repetição adjacente`)
    }

    const maxCount = Math.max(...candidates.map(([, count]) => count))
    const top = candidates.filter(([, count]) => count === maxCount)
    const [type] = top[Math.floor(rand() * top.length)]!
    result.push(type)
    counts.set(type, counts.get(type)! - 1)
  }
  return result
}

/**
 * Quando o arranjo greedy termina em `avoidAtLast` (colidiria com a posição 8 fixa), troca o
 * último slot com o slot MAIS À DIREITA cujo valor é diferente de `avoidAtLast` e cuja troca
 * mantém a sequência inteira sem repetição adjacente — preserva a aleatoriedade original do
 * greedy (só troca posição, não resorteia) e cobre exatamente o caso do exemplo na US-166
 * (`C,K,C,K,S,K,S` — swap resolve). Pra `{social×4, skill×3}` NENHUMA troca passa no `!hasAdjacentRepeat`
 * (arranjo interno é único) — a colisão é aceita, estruturalmente forçada, não um bug silencioso.
 */
function repairLastSlotCollision(result: EncounterType[], avoidAtLast: EncounterType): EncounterType[] {
  const lastIdx = result.length - 1
  if (result[lastIdx] !== avoidAtLast) return result

  for (let j = lastIdx - 1; j >= 0; j--) {
    if (result[j] === avoidAtLast) continue
    const swapped = [...result]
    ;[swapped[j], swapped[lastIdx]] = [swapped[lastIdx]!, swapped[j]!]
    if (!hasAdjacentRepeat(swapped)) return swapped
  }
  return result
}

/**
 * US-166: monta os `type` dos 8 encontros — posição 8 fixa (`'combat'` viável, `'social'`
 * inviável), posições 1-7 um arranjo sem repetição adjacente do multiset correspondente
 * (`greedyNoAdjacentSequence` + `repairLastSlotCollision`, que tenta também evitar colisão
 * com a posição 8). Sub-seed próprio (`encounter-types`), não compartilha stream com nenhuma
 * outra rolagem — mesmo padrão de `tableSeed` (roll-content.ts).
 */
export function shuffleEncounterTypes(
  characterId: string,
  order: number,
  combatViable: boolean,
  attempt = 0,
): EncounterType[] {
  const lastType: EncounterType = combatViable ? 'combat' : 'social'
  const multiset = combatViable ? COMBAT_VIABLE_MULTISET : COMBAT_INVIABLE_MULTISET
  const rand = createSeededRandom(deriveAdventureSeed(`${characterId}:encounter-types`, order, attempt))

  const head = repairLastSlotCollision(greedyNoAdjacentSequence(multiset, rand), lastType)
  return [...head, lastType]
}
