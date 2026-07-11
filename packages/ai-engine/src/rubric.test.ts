import { describe, it, expect } from 'vitest'
import {
  DIMENSIONS,
  WEIGHTS,
  aggregateReps,
  estimateCost,
  renderReportMarkdown,
  type RubricScore,
} from './rubric'

// Partes PURAS do juiz do bake-off (US-17, slice 2): agregação das repetições,
// custo estimado e render do relatório markdown. Determinísticas → rodam no
// `pnpm test`/CI. A chamada ao juiz LLM (generateObject) fica no caminho gated.

/** Helper: monta um RubricScore com a mesma nota em todas as dimensões. */
function flat(nota: number): RubricScore {
  return Object.fromEntries(
    DIMENSIONS.map((d) => [d.key, { nota, justificativa: 'x' }]),
  ) as unknown as RubricScore
}

describe('aggregateReps — média por dimensão, MÉDIA geral, spread', () => {
  it('média por dimensão é a média das repetições', () => {
    const agg = aggregateReps([flat(4), flat(5), flat(3)])
    // cada dimensão: (4+5+3)/3 = 4
    for (const d of DIMENSIONS) expect(agg.perDim[d.key]).toBeCloseTo(4, 5)
  })

  it('MÉDIA geral é a média ponderada das dimensões (pesos iguais → média simples)', () => {
    // rep único, notas distintas por dimensão: 1..6 mapeadas nas 6 dims
    const notas = [5, 4, 3, 5, 4, 3]
    const rep = Object.fromEntries(
      DIMENSIONS.map((d, i) => [d.key, { nota: notas[i], justificativa: 'x' }]),
    ) as unknown as RubricScore
    const agg = aggregateReps([rep])
    const esperado = notas.reduce((a, b) => a + b, 0) / notas.length
    expect(agg.media).toBeCloseTo(esperado, 5)
  })

  it('spread é a amplitude da MÉDIA entre repetições (max − min)', () => {
    // três reps flat 3/4/5 → MÉDIA por rep = 3,4,5 → spread = 2
    const agg = aggregateReps([flat(3), flat(4), flat(5)])
    expect(agg.spread).toBeCloseTo(2, 5)
  })

  it('pesos são todos 1.0 por ora (decisão 4 da US)', () => {
    for (const d of DIMENSIONS) expect(WEIGHTS[d.key]).toBe(1)
  })
})

describe('estimateCost — tokens × preço da tabela', () => {
  it('candidato grátis (NVIDIA) custa 0 independentemente dos tokens', () => {
    expect(estimateCost('mistralai/mistral-large-3-475b-instruct', 10_000)).toBe(0)
  })

  it('modelo pago custa tokens/1e6 × preço', () => {
    // gpt-5-mini a $2.00/1M → 500k tokens = $1.00 (usa o preço real da const)
    const preco = 2.0
    const custo = estimateCost('gpt-5-mini', 500_000)
    // tolera o preço real da tabela; valida a fórmula com o preço declarado no teste
    expect(custo).toBeCloseTo((500_000 / 1_000_000) * preco, 5)
  })

  it('modelo desconhecido cai em 0 (sem inventar preço)', () => {
    expect(estimateCost('modelo/que-nao-existe', 1_000_000)).toBe(0)
  })
})

describe('renderReportMarkdown — tabela determinística', () => {
  const rows = [
    { model: 'mistralai/mistral-large-3-475b-instruct', perDim: dims(4.7), media: 4.55, spread: 0.3, custo: 0 },
    { model: 'meta/llama-3.3-70b-instruct', perDim: dims(3.8), media: 3.87, spread: 0.4, custo: 0 },
  ]

  it('tem um cabeçalho por dimensão + MÉDIA/spread/custo', () => {
    const md = renderReportMarkdown(rows, { date: '2026-07-10', guardrailSummary: 'idioma OK', incumbent: null })
    for (const d of DIMENSIONS) expect(md).toContain(d.label)
    expect(md).toMatch(/MÉDIA/)
    expect(md).toMatch(/spread/)
    expect(md).toMatch(/custo/)
  })

  it('tem uma linha por modelo', () => {
    const md = renderReportMarkdown(rows, { date: '2026-07-10', guardrailSummary: 'idioma OK', incumbent: null })
    expect(md).toContain('mistralai/mistral-large-3-475b-instruct')
    expect(md).toContain('meta/llama-3.3-70b-instruct')
  })

  it('estrutura estável: mesma entrada → mesma saída', () => {
    const meta = { date: '2026-07-10', guardrailSummary: 'idioma OK', incumbent: null }
    expect(renderReportMarkdown(rows, meta)).toBe(renderReportMarkdown(rows, meta))
  })
})

/** Helper: perDim uniforme para os testes de render. */
function dims(v: number): Record<string, number> {
  return Object.fromEntries(DIMENSIONS.map((d) => [d.key, v]))
}
