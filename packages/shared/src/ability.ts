// Modificador de atributo (US-32). Regra 5e, idêntica para D&D e Free:
// derivado do valor bruto, nunca persistido.

// US-108 — faixa oficial do SRD 2024 (`srd-2024_the-six-abilities_ability-scores`): 1 é o
// mínimo, 20 o teto do aventureiro, 30 o teto absoluto (21–30 é monstro). A tabela e a faixa
// vivem em scripts/srd/ability-modifiers.srd-2024.json, gerado do texto do SRD; aqui só a
// fórmula, que reproduz as 16 faixas exatamente (conferido em ability.test.ts).
const SCORE_MIN = 1
const SCORE_MAX = 30

/**
 * Modificador de um atributo pela regra 5e: floor((valor - 10) / 2).
 *
 * O arredondamento para baixo é regra explícita do SRD ("Round Down": arredonde para baixo
 * mesmo quando a fração for meio ou mais), não escolha de implementação.
 *
 * US-108: valor fora de 1–30 LANÇA em vez de devolver número plausível. A ficha já é validada
 * pelo min/max do config (Zod, na criação), então chegar aqui fora da faixa é defeito de
 * código — e antes disto `abilityModifier(0)` devolvia -5 e `abilityModifier(99)` devolvia 44,
 * em silêncio.
 */
export function abilityModifier(score: number): number {
  if (!Number.isInteger(score) || score < SCORE_MIN || score > SCORE_MAX) {
    throw new Error(`Valor de atributo inválido: ${score} (esperado inteiro de ${SCORE_MIN} a ${SCORE_MAX}, faixa do SRD 2024)`)
  }
  return Math.floor((score - 10) / 2)
}

/** Modificador formatado com sinal explícito: +2, 0, -1 (0 não leva sinal). */
export function formatModifier(mod: number): string {
  return mod > 0 ? `+${mod}` : `${mod}`
}

/**
 * Modificador de uma perícia (US-27): modificador do atributo-âncora, mais o
 * bônus de proficiência quando o personagem é proficiente. `proficiencyBonus`
 * vem do config (+2 na Fase 1, nível 1); um dia derivará do nível.
 */
export function skillModifier(abilityScore: number, proficient: boolean, proficiencyBonus: number): number {
  return abilityModifier(abilityScore) + (proficient ? proficiencyBonus : 0)
}

/** Uma perícia com o modificador já resolvido — o que a ficha e o DM consomem (US-27). */
export interface ResolvedSkill {
  key: string
  label: string
  modifier: number
  proficient: boolean
}

/**
 * Resolve TODAS as perícias do catálogo (US-27): para cada uma, lê o atributo-âncora,
 * marca proficiência e computa o modificador. Atributo faltante → cai em 0 (nunca crasha).
 * Fonte única do cálculo, reusada pela API (prompt do DM) e pelo front (ficha).
 */
export function buildSkillSheet(
  catalog: { key: string; label: string; ability: string }[],
  attributes: Record<string, number>,
  proficientKeys: string[],
  // ponytail: hoje os callers passam config.proficiency.bonus fixo (+2, nível 1). Com level-up (Fase
  // futura) o bônus 5e escala com o nível — os callers devem derivá-lo de character.level e passar aqui.
  proficiencyBonus: number,
): ResolvedSkill[] {
  const proficient = new Set(proficientKeys)
  return catalog.map((s) => {
    const isProficient = proficient.has(s.key)
    return {
      key: s.key,
      label: s.label,
      proficient: isProficient,
      modifier: skillModifier(attributes[s.ability] ?? 10, isProficient, proficiencyBonus),
    }
  })
}
