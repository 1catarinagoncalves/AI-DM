import { z } from 'zod'
import { generateObject, type LanguageModelV1 } from 'ai'

// Rubrica + juiz LLM do bake-off narrativo (US-17, slice 2).
//
// O juiz é um LLM-as-judge com rubrica multi-eixo, ancorado nos turnos
// exemplares da aventura de referência (docs/sdlc/referencia/aventura-seraphine.md).
// Pontua cada turno gerado 1–5 por dimensão, com saída ESTRUTURADA (generateObject
// + Zod) — nada de parsear prosa livre. A parte pura (agregação, custo, render do
// relatório) mora aqui também e roda no CI; só `judgeTurn` bate na API.

// ─── Dimensões da rubrica ────────────────────────────────────────────────────
// key = chave interna/schema; label = cabeçalho do relatório; pergunta = o que o
// juiz responde (doc US-17, tabela "Rubrica de qualidade narrativa").

export interface Dimension {
  key: 'imersao' | 'sensorial' | 'agencia' | 'vozNpc' | 'ritmo' | 'coerencia'
  label: string
  pergunta: string
}

export const DIMENSIONS: readonly Dimension[] = [
  { key: 'imersao', label: 'Imersão', pergunta: 'Narra em 2ª pessoa, presente, sem quebrar a 4ª parede nem virar "assistente"?' },
  { key: 'sensorial', label: 'Sensorial', pergunta: 'Ancora a cena em visão/som/cheiro/toque sem encher linguiça?' },
  { key: 'agencia', label: 'Agência', pergunta: 'Fecha o turno oferecendo escolhas significativas (+ opção livre)?' },
  { key: 'vozNpc', label: 'Voz NPC', pergunta: 'NPCs falam distinto, com intenção e emoção próprias?' },
  { key: 'ritmo', label: 'Ritmo', pergunta: 'Avança a cena sem atropelar nem enrolar; tamanho adequado?' },
  { key: 'coerencia', label: 'Coerência', pergunta: 'Respeita o estado da cena/ficha/histórico dado no contexto?' },
] as const

// Pesos por dimensão. Decisão 4 da US: todos iguais (1.0) por ora — ponderar
// antes de ver a matriz é premature optimization. Const trivial de mudar depois.
export const WEIGHTS: Record<Dimension['key'], number> = {
  imersao: 1,
  sensorial: 1,
  agencia: 1,
  vozNpc: 1,
  ritmo: 1,
  coerencia: 1,
}

// ─── Schema de saída do juiz (Zod) ───────────────────────────────────────────

const dimScore = z.object({
  nota: z.number().int().min(1).max(5),
  justificativa: z.string().describe('uma frase curta explicando a nota'),
})

/** Schema que o juiz preenche: uma { nota, justificativa } por dimensão. */
export const rubricSchema = z.object(
  Object.fromEntries(DIMENSIONS.map((d) => [d.key, dimScore])) as Record<Dimension['key'], typeof dimScore>,
)

export type RubricScore = z.infer<typeof rubricSchema>

// ─── Tabela de preços (decisão 5 da US: const hardcoded, não JSON) ────────────
// $/1M tokens de saída. Candidatos NVIDIA = endpoint preview grátis (0). Juiz
// Gemini free = 0. O único pago em jogo é o fallback gpt-5-mini. Modelo ausente
// do mapa custa 0 (nunca inventa preço). Groq entra como controle (id `groq:`).

export const PRICES: Record<string, number> = {
  'gpt-5-mini': 2.0,
  'groq:openai/gpt-oss-120b': 0.75,
}

/** Custo estimado (US$) = tokens/1e6 × preço da tabela. Desconhecido → 0. */
export function estimateCost(model: string, tokens: number): number {
  const price = PRICES[model] ?? 0
  return (tokens / 1_000_000) * price
}

// ─── Agregação das repetições ────────────────────────────────────────────────

export interface ModelAggregate {
  model: string
  perDim: Record<Dimension['key'], number>
  media: number
  spread: number
  custo: number
  /** nº de casos (cenário × rep) efetivamente julgados que entraram na média */
  n: number
}

/** MÉDIA ponderada das 6 dimensões de um único score (pesos iguais → média simples). */
function weightedMean(dims: Record<Dimension['key'], number>): number {
  let num = 0
  let den = 0
  for (const d of DIMENSIONS) {
    num += dims[d.key] * WEIGHTS[d.key]
    den += WEIGHTS[d.key]
  }
  return den === 0 ? 0 : num / den
}

/**
 * Agrega N repetições de um mesmo (modelo × cenário): média por dimensão, MÉDIA
 * geral (média das dimensões já mediadas) e spread (amplitude da MÉDIA por rep,
 * max − min). Reportar o spread junto da média denuncia modelo de alta variância
 * mesmo com poucas reps (decisão 3 da US). `custo` é somado por fora e injetado.
 */
export function aggregateReps(reps: RubricScore[], model = '', custo = 0): ModelAggregate {
  const perDim = Object.fromEntries(
    DIMENSIONS.map((d) => {
      const notas = reps.map((r) => r[d.key].nota)
      const mean = notas.reduce((a, b) => a + b, 0) / (notas.length || 1)
      return [d.key, mean]
    }),
  ) as Record<Dimension['key'], number>

  const media = weightedMean(perDim)

  // spread = amplitude da MÉDIA geral entre as repetições
  const mediasPorRep = reps.map((r) => {
    const dims = Object.fromEntries(DIMENSIONS.map((d) => [d.key, r[d.key].nota])) as Record<Dimension['key'], number>
    return weightedMean(dims)
  })
  const spread = mediasPorRep.length ? Math.max(...mediasPorRep) - Math.min(...mediasPorRep) : 0

  return { model, perDim, media, spread, custo, n: reps.length }
}

// ─── Juiz LLM ────────────────────────────────────────────────────────────────

/** Exemplar "nota 5" da referência, âncora de calibração para um cenário. */
export interface Exemplar {
  playerAction: string
  dmResponse: string
}

const JUDGE_SYSTEM = `Você é um juiz imparcial de QUALIDADE NARRATIVA de um mestre de RPG (D&D 5e), em português do Brasil.
Recebe a AÇÃO do jogador e a RESPOSTA do mestre, e pontua a resposta de 1 a 5 em cada dimensão da rubrica, com uma justificativa curta.

Regras de julgamento:
- Julgue APENAS a qualidade da NARRAÇÃO (imersão, sensorial, agência, voz de NPC, ritmo, coerência). NÃO julgue corretude mecânica (dados, ficha, inventário) — isso não é seu papel.
- O EXEMPLAR fornecido é uma âncora do que vale "nota 5" nesta campanha. Use-o como referência de padrão, NÃO como texto a ser copiado; uma resposta diferente pode valer 5 se atingir a mesma qualidade.
- Combata o VIÉS DE TAMANHO: resposta longa não é melhor. Premie concisão adequada; penalize enrolação.
- Combata o VIÉS DE POSIÇÃO: a ordem em que os textos aparecem é irrelevante.
- Nota 1 = falha grave na dimensão; 5 = exemplar. Seja criterioso: 5 é excelência, não "ok".`

function buildJudgePrompt(params: {
  scenarioContext: string
  playerAction: string
  narration: string
  exemplar: Exemplar
}): string {
  return `## Dimensões da rubrica
${DIMENSIONS.map((d) => `- ${d.label}: ${d.pergunta}`).join('\n')}

## Âncora de "nota 5" (referência de padrão, NÃO copiar)
Ação do jogador: ${params.exemplar.playerAction}
Resposta do mestre (nota 5):
"""
${params.exemplar.dmResponse}
"""

## Turno a julgar
Contexto do cenário: ${params.scenarioContext}
Ação do jogador: ${params.playerAction}
Resposta do mestre a ser pontuada:
"""
${params.narration}
"""

Pontue cada dimensão de 1 a 5 com uma justificativa curta.`
}

/**
 * Pontua um turno com o juiz LLM. Externo aos candidatos (Gemini) para evitar
 * self-preference bias. Saída estruturada via generateObject + rubricSchema.
 * Devolve o RubricScore mais os tokens do juiz (para o custo estimado).
 */
export async function judgeTurn(params: {
  judge: LanguageModelV1
  scenarioContext: string
  playerAction: string
  narration: string
  exemplar: Exemplar
}): Promise<{ score: RubricScore; judgeTokens: number }> {
  const { object, usage } = await generateObject({
    model: params.judge,
    schema: rubricSchema,
    system: JUDGE_SYSTEM,
    prompt: buildJudgePrompt(params),
  })
  return { score: object, judgeTokens: usage.completionTokens ?? 0 }
}

// ─── Juiz em BATELADA (1 chamada pontua N narrações do mesmo cenário) ─────────
// Corta as chamadas ao juiz de (modelos × cenários × reps) para (cenários × reps).
// Bônus: julgar lado a lado discrimina melhor (comparação direta). Narrações são
// rotuladas A/B/C anônimas (sem id do modelo) → sem brand bias; o runner remapeia.

/** Item de rubrica + rótulo (A/B/C) da narração dentro da batelada. */
const batchItemSchema = rubricSchema.extend({ id: z.string().describe('rótulo da narração: A, B, C...') })
export const batchSchema = z.object({ avaliacoes: z.array(batchItemSchema) })

function buildBatchPrompt(params: {
  scenarioContext: string
  playerAction: string
  exemplar: Exemplar
  items: { label: string; narration: string }[]
}): string {
  const blocks = params.items
    .map((it) => `### Narração ${it.label}\n"""\n${it.narration}\n"""`)
    .join('\n\n')
  return `## Dimensões da rubrica
${DIMENSIONS.map((d) => `- ${d.label}: ${d.pergunta}`).join('\n')}

## Âncora de "nota 5" (referência de padrão, NÃO copiar)
Ação do jogador: ${params.exemplar.playerAction}
Resposta do mestre (nota 5):
"""
${params.exemplar.dmResponse}
"""

## Narrações a julgar — MESMA ação do jogador, mestres diferentes
Contexto do cenário: ${params.scenarioContext}
Ação do jogador: ${params.playerAction}

${blocks}

Pontue CADA narração de 1 a 5 em cada dimensão, com justificativa curta. No campo \`id\` devolva a LETRA da narração (A, B, C...). A ordem é irrelevante — não favoreça por posição.`
}

/**
 * Pontua VÁRIAS narrações do mesmo cenário numa única chamada ao juiz. `items`
 * traz {label, narration} com labels anônimos (A/B/C) — o chamador remapeia
 * label→modelo. Devolve um array de scores com `id` = label.
 */
export async function judgeBatch(params: {
  judge: LanguageModelV1
  scenarioContext: string
  playerAction: string
  exemplar: Exemplar
  items: { label: string; narration: string }[]
  /** corta a chamada (inclui retries) — evita pendurar no backoff se o juiz estiver sobrecarregado */
  abortSignal?: AbortSignal
  /** tentativas em erro transitório (429/"high demand"); default 2 */
  maxRetries?: number
}): Promise<{ scores: (RubricScore & { id: string })[]; judgeTokens: number }> {
  const { object, usage } = await generateObject({
    model: params.judge,
    schema: batchSchema,
    system: JUDGE_SYSTEM,
    prompt: buildBatchPrompt(params),
    abortSignal: params.abortSignal,
    maxRetries: params.maxRetries ?? 2,
  })
  return { scores: object.avaliacoes, judgeTokens: usage.completionTokens ?? 0 }
}

// ─── Relatório markdown (decisão 6 da US: gravado em evals/reports/<data>.md) ──

export interface ReportMeta {
  date: string
  guardrailSummary: string
  /** modelo incumbente (Groq) para a linha "vs incumbente"; null se ausente. */
  incumbent: string | null
}

/** Formata um número de nota/custo com 2 casas, enxuto. */
function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2)
}

/**
 * Renderiza a matriz modelo × dimensão como tabela markdown (o artefato durável
 * de `evals/reports/<data>.md`). Estrutura DETERMINÍSTICA: mesma entrada → mesma
 * saída (critério de aceite); só os números variam pelo não-determinismo do LLM.
 * Ordena por MÉDIA desc para o vencedor saltar aos olhos.
 */
export function renderReportMarkdown(rows: ModelAggregate[], meta: ReportMeta): string {
  const sorted = [...rows].sort((a, b) => b.media - a.media)
  // Baseline de completude = maior nº de casos entre os modelos. Quem tem menos
  // teve turnos perdidos (gen/juiz falhou) → MÉDIA sobre denominador menor, não
  // comparável 1:1. Marca com `*` e explica no rodapé.
  const maxN = Math.max(...sorted.map((r) => r.n), 0)
  const hasPartial = sorted.some((r) => r.n < maxN)
  const header = `| modelo | ${DIMENSIONS.map((d) => d.label).join(' | ')} | MÉDIA | spread | casos | custo |`
  const sep = `|${'---|'.repeat(DIMENSIONS.length + 5)}`
  const body = sorted
    .map((r) => {
      const dims = DIMENSIONS.map((d) => fmt(r.perDim[d.key])).join(' | ')
      const custo = r.custo === 0 ? 'grátis' : `$${r.custo.toFixed(4)}`
      const partial = r.n < maxN ? '*' : ''
      return `| ${r.model}${partial} | ${dims} | **${fmt(r.media)}** | ±${fmt(r.spread)} | ${r.n}${partial} | ${custo} |`
    })
    .join('\n')

  const winner = sorted[0]
  const winnerLine = winner
    ? `Vencedor por MÉDIA: **${winner.model}** (${fmt(winner.media)})${
        meta.incumbent ? ` vs incumbente ${meta.incumbent}` : ''
      }.${winner.n < maxN ? ` ⚠️ vencedor com média PARCIAL (${winner.n}/${maxN} casos) — não confiável.` : ''}`
    : 'Sem candidatos.'

  const partialNote = hasPartial
    ? `\n\n> \\* média parcial: menos casos que o máximo (${maxN}) — turnos perdidos. Comparação de MÉDIA não é 1:1; rode de novo para completar.`
    : ''

  return `# Bake-off narrativo — ${meta.date}

${header}
${sep}
${body}

Guardrails: ${meta.guardrailSummary}
${winnerLine}${partialNote}
`
}
