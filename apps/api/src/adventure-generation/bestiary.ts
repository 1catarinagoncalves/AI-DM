import BESTIARY_JSON from './bestiary-5e.json'
import { MONSTER_ROLE_CR, type MonsterRole } from './monster-roles'

// US-251: fonte SRD 5.1 (325 criaturas), sem statblock — só nome/tipo/CR/tamanho, sem número
// de combate (US-29). Realocado de scripts/srd/ pra cá pela US-252 (importável por TS direto,
// mesmo padrão de d20-tests.srd-2024.json — ver ingest.mjs, BESTIARY_PATH).
export type BestiaryCreature = { cr: number; name: string; size: string; type: string }

export const BESTIARY: BestiaryCreature[] = BESTIARY_JSON as BestiaryCreature[]

function creaturesAtNearestCr(target: number, bestiary: BestiaryCreature[]): BestiaryCreature[] {
  const nearest = bestiary.reduce((best, c) => (Math.abs(c.cr - target) < Math.abs(best.cr - target) ? c : best))
  return bestiary.filter((c) => c.cr === nearest.cr)
}

/**
 * US-252: escolhe o nome de uma criatura do bestiário pra dar forma ficcional a um
 * `combatRole` (ex.: Soldier CR 1/2 → "Orc"). Determinístico — mesmo combatRole+tema+index
 * produz sempre o mesmo nome, sem RNG (mesmo espírito de assignCombatRoles, US-233).
 *
 * Sem candidato no CR exato: cai pro CR mais próximo (nunca lança erro, nunca deixa o NPC sem
 * nome). Sem candidato do `preferredType` pedido: cai pra qualquer `type` do mesmo CR.
 */
export function chooseNominalCreature(
  combatRole: MonsterRole,
  preferredType: string | undefined,
  bestiary: BestiaryCreature[],
  index: number,
): string {
  const targetCr = MONSTER_ROLE_CR[combatRole]
  const exact = bestiary.filter((c) => c.cr === targetCr)
  const crMatches = exact.length > 0 ? exact : creaturesAtNearestCr(targetCr, bestiary)
  const themed = preferredType ? crMatches.filter((c) => c.type === preferredType) : []
  const candidates = themed.length > 0 ? themed : crMatches
  return candidates[index % candidates.length]!.name
}
