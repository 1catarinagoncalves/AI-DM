// US-159 — Lazy Encounter Benchmark (`5e_Monster_Builder.json`) para 1 personagem. A fórmula
// é HARDCODED aqui, não lida em runtime de `scripts/lazygm/lazy-encounter-benchmark.json` —
// aquele derivado existe só pro teste de drift do extrator
// (scripts/lazygm/extract-benchmark.mjs). Ver US-159, Notas de implementação.
//
// Assimetria proposital: soma de CR usa "greater than" (>); CR de monstro único usa "equal to
// or higher than" (>=) — o texto-fonte do LGMRD define os dois testes com operadores
// diferentes, e os dois abaixo preservam essa diferença.

// Um encontro é "potencialmente letal" quando a soma de CR dos monstros EXCEDE este valor.
export function encounterDeadlyThreshold(level: number): number {
  return level <= 4 ? Math.floor(level / 4) : Math.floor(level / 2)
}

// Um monstro único é "potencialmente letal" quando seu CR ALCANÇA OU PASSA este valor.
export function singleMonsterCrCap(level: number): number {
  return level < 5 ? level : level * 1.5
}
