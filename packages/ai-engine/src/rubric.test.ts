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

describe('estimateCost — custo efetivo (entrada + saída)', () => {
  it('candidato grátis (NVIDIA) custa 0 independentemente dos tokens', () => {
    expect(estimateCost('mistralai/mistral-large-3-475b-instruct', { prompt: 50_000, completion: 10_000 })).toBe(0)
  })

  it('soma entrada × preço_in + saída × preço_out', () => {
    // gpt-5-mini: $0.25/1M in, $2.00/1M out → 1M in + 500k out = 0.25 + 1.00 = $1.25
    const custo = estimateCost('gpt-5-mini', { prompt: 1_000_000, completion: 500_000 })
    expect(custo).toBeCloseTo(0.25 + 1.0, 5)
  })

  it('entrada entra na conta — não é só a saída que custa', () => {
    // mesmo output, só muda o input: o custo TEM que subir (regressão do bug em
    // que a coluna `custo` ignorava o prompt e subestimava ~40% da conta)
    const semInput = estimateCost('gpt-5-mini', { prompt: 0, completion: 500_000 })
    const comInput = estimateCost('gpt-5-mini', { prompt: 1_000_000, completion: 500_000 })
    expect(comInput).toBeGreaterThan(semInput)
  })

  it('modelo desconhecido cai em 0 (sem inventar preço)', () => {
    expect(estimateCost('modelo/que-nao-existe', { prompt: 1_000_000, completion: 1_000_000 })).toBe(0)
  })
})

describe('renderReportMarkdown — tabela determinística', () => {
  const rows = [
    { model: 'mistralai/mistral-large-3-475b-instruct', perDim: dims(4.7), media: 4.55, spread: 0.3, custo: 0, n: 5 },
    { model: 'meta/llama-3.3-70b-instruct', perDim: dims(3.8), media: 3.87, spread: 0.4, custo: 0, n: 4 },
  ]

  it('tem um cabeçalho por dimensão + MÉDIA/spread/casos/custo', () => {
    const md = renderReportMarkdown(rows, { date: '2026-07-10', guardrailSummary: 'idioma OK', incumbent: null })
    for (const d of DIMENSIONS) expect(md).toContain(d.label)
    expect(md).toMatch(/MÉDIA/)
    expect(md).toMatch(/spread/)
    expect(md).toMatch(/casos/)
    expect(md).toMatch(/custo/)
  })

  it('mostra o nº de casos julgados por modelo e marca média parcial', () => {
    const md = renderReportMarkdown(rows, { date: '2026-07-10', guardrailSummary: 'idioma OK', incumbent: null })
    // llama tem n=4 < max(5) → casos marcado com * e rodapé de parcial
    expect(md).toMatch(/meta\/llama-3\.3-70b-instruct\* \|.*\| 4\* \|/)
    expect(md).toMatch(/média parcial/)
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
