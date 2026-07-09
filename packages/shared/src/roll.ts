import { abilityModifier, type ResolvedSkill } from './ability'

/** Normaliza para casar rótulos do modelo com chaves da ficha: sem acento, minúsculo, sem espaços nas pontas. */
function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

/**
 * US-38: resolução do modificador de um TESTE a partir da ficha — nunca de um
 * número dado pelo modelo. O modelo diz O QUE testa (`skill`/`ability`); o Game
 * Server resolve o modificador com os helpers da US-27. Um `+6` que nenhuma
 * perícia dá deixa de ser representável.
 *
 * Match tolerante: o prompt mostra as perícias por RÓTULO (`Percepção +3*`), então
 * o modelo manda o rótulo ("percepção"), não a `key` ("perception"). Casamos por
 * `key` OU `label` (sem acento/caixa) — senão um rótulo válido cairia em +0.
 *
 * `unresolved` = sem anchor, ou `key`/rótulo inexistente (misfire): cai em 0
 * (nunca um número inventado) e o caller loga.
 */
export function resolveRollModifier(params: {
  skill?: string
  ability?: string
  skills?: ResolvedSkill[]
  attributes: Record<string, number>
  /** key → rótulo do atributo (System.config); permite o modelo mandar "Sabedoria" em vez de "wisdom". */
  attributeLabels?: Record<string, string>
}): { modifier: number; unresolved: boolean; label?: string } {
  const { skill, ability, skills, attributes, attributeLabels } = params
  if (skill) {
    const want = norm(skill)
    const found = skills?.find((s) => norm(s.key) === want || norm(s.label) === want)
    // `label` = rótulo CANÔNICO da ficha (US-38: o bloco mostra qual perícia foi usada).
    return found ? { modifier: found.modifier, unresolved: false, label: found.label } : { modifier: 0, unresolved: true }
  }
  if (ability) {
    const want = norm(ability)
    let attrKey = Object.keys(attributes).find((k) => norm(k) === want)
    if (!attrKey && attributeLabels) attrKey = Object.keys(attributeLabels).find((k) => norm(attributeLabels[k] ?? '') === want)
    const score = attrKey != null ? attributes[attrKey] : undefined
    return score != null
      ? { modifier: abilityModifier(score), unresolved: false, label: (attrKey != null ? attributeLabels?.[attrKey] : undefined) ?? attrKey }
      : { modifier: 0, unresolved: true }
  }
  // Sem anchor: todo teste relevante é ancorado numa perícia/atributo. Chegar
  // aqui é misfire do modelo — degrada para 0, nunca rolagem normal.
  return { modifier: 0, unresolved: true }
}

/**
 * US-38: extrai só o dado base (`NdM`) da string do modelo, descartando qualquer
 * `+N`/`-N` — o modificador de um teste vem SEMPRE da ficha, não da fórmula.
 * Ausente/inválido → `1d20`. Sem restrição de catálogo (aceita NdM genérico).
 */
export function normalizeDie(dice?: string): string {
  const match = /(\d+d\d+)/i.exec((dice ?? '').replace(/\s/g, ''))
  return match ? match[1]!.toLowerCase() : '1d20'
}
