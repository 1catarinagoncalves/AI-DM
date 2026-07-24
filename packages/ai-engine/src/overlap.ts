// Detector de REPLAY narrativo (US-71) — mesma família do detector de n-grama da
// US-69. Mede quanto da narração NOVA é feita de trigramas que JÁ apareciam na
// narração ANTERIOR: alto = o Mestre re-narrou um beat já contado (a "chegada duas
// vezes" do bug do anexo). Puro, determinístico, custo zero — serve ao eval e pode
// virar sinal de runtime depois.

function tokens(text: string): string[] {
  return text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').match(/\p{L}+/gu) ?? []
}

function trigrams(ws: string[]): Set<string> {
  const set = new Set<string>()
  for (let i = 0; i + 3 <= ws.length; i++) set.add(`${ws[i]} ${ws[i + 1]} ${ws[i + 2]}`)
  return set
}

/**
 * Fração dos trigramas DISTINTOS de `a` que também ocorrem em `b`
 * (`overlapRatio(narrTurnoNovo, narrTurnoAnterior)`). `a` com menos de 3 palavras
 * (nenhum trigrama) → 0. Assimétrico de propósito: mede quanto do NOVO é reciclado
 * do ANTIGO, não a semelhança mútua.
 */
export function overlapRatio(a: string, b: string): number {
  const ta = trigrams(tokens(a))
  if (ta.size === 0) return 0
  const tb = trigrams(tokens(b))
  let shared = 0
  for (const gram of ta) if (tb.has(gram)) shared++
  return shared / ta.size
}

// Limiar acima do qual a sobreposição é replay e não coesão legítima (um turno pode
// reusar 1-2 frases do anterior). Calibração fina fica aberta (US-71 Q3) — igual à da
// US-69, contra narrações reais no runner de evals. Nomeado para ser o único ponto de
// ajuste.
export const REPLAY_OVERLAP_THRESHOLD = 0.4
