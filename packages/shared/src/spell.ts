// Magias conhecidas (US-42, US-50): regra pura, partilhada pelo prompt do mestre
// (ai-engine) e pela ficha do jogador (web). Fonte ÚNICA do rótulo: duplicada, o
// prompt podia dizer "nível 0" e a ficha "truque" para a mesma magia.

/** Rótulo de nível de uma magia: 0 → "truque", ≥1 → "nível N", ausente → sem rótulo. */
export function spellLevelLabel(level?: number): string {
  if (level == null) return ''
  return level === 0 ? 'truque' : `nível ${level}`
}
