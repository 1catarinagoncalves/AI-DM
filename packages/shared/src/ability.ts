// Modificador de atributo (US-32). Regra 5e, idêntica para D&D e Free:
// derivado do valor bruto, nunca persistido.

/** Modificador de um atributo pela regra 5e: floor((valor - 10) / 2). */
export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2)
}

/** Modificador formatado com sinal explícito: +2, 0, -1 (0 não leva sinal). */
export function formatModifier(mod: number): string {
  return mod > 0 ? `+${mod}` : `${mod}`
}
