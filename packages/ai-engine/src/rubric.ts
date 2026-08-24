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
  key:
    | 'imersao'
    | 'sensorial'
    | 'agencia'
    | 'vozNpc'
    | 'ritmo'
    | 'coerencia'
    // US-36: eixos novos da barra de ofício atual (US-34), além dos 6 do bake-off.
    | 'concretude'
    | 'anafora'
    | 'onomastica'
    | 'identidade'
    | 'tensao'
    | 'linguaPt'
  label: string
  pergunta: string
}

// ESPELHA a barra de ofício de dm-system.ts (NARRATIVE_CRAFT_SECTION). Mudou lá?
// Reveja estas dimensões aqui e atualize REVIEWED_CRAFT_HASH em rubric-drift.test.ts.
// Os 6 primeiros eixos vêm do bake-off (US-17); os 5 finais são a barra da US-34
// que a US-36 passou a medir (concretude/nomeação, onomástica, classe-como-lente,
// tensão-antes-da-explicação, língua natural pt-BR).
export const DIMENSIONS: readonly Dimension[] = [
  { key: 'imersao', label: 'Imersão', pergunta: 'Narra em 2ª pessoa, presente, sem quebrar a 4ª parede nem virar "assistente"?' },
  { key: 'sensorial', label: 'Sensorial', pergunta: 'Abre pelos sentidos (chuva, frio, luz), não pela exposição?' },
  { key: 'agencia', label: 'Gancho/Opções', pergunta: 'Fecha chamando o personagem pelo nome e então apresenta escolhas significativas (+ opção livre)?' },
  { key: 'vozNpc', label: 'Voz NPC', pergunta: 'NPCs têm voz, movimento, emoção e stakes — sobretudo os vulneráveis? (n/a se não há NPC)' },
  { key: 'ritmo', label: 'Ritmo', pergunta: 'Mistura frases curtas e longas; 3–5 parágrafos curtos; imersivo sem ser prolixo?' },
  { key: 'coerencia', label: 'Coerência', pergunta: 'Respeita o estado da cena/ficha/histórico dado no contexto?' },
  { key: 'concretude', label: 'Concretude', pergunta: 'Nomeia coisas específicas (a montaria, a espada, o símbolo sagrado, o NPC) em vez do genérico?' },
  { key: 'anafora', label: 'Repetição de nome', pergunta: 'Nomeia cada pessoa/lugar/coisa na PRIMEIRA menção e depois retoma por pronome/epíteto/detalhe, sem repetir o mesmo nome próprio parágrafo após parágrafo (nem em toda opção)?' },
  { key: 'onomastica', label: 'Onomástica', pergunta: 'Nomes próprios ORIGINAIS (sem clichês Elara/Kael/Lyra/Aria/Thorne), com registro cultural certo p/ raça/classe/ambiente, na frase em pt-BR natural? (n/a se não nomeia nada novo)' },
  { key: 'identidade', label: 'Classe-lente', pergunta: 'Raça/classe/equipamento/habilidades afloram por ação e sensação, nunca como lista de stats (o paladino SENTE o mal, não vê um número)?' },
  { key: 'tensao', label: 'Tensão', pergunta: 'Mostra a tensão (o silêncio errado de uma aldeia) antes de explicá-la?' },
  { key: 'linguaPt', label: 'Língua pt-BR', pergunta: 'pt-BR fluente e contemporâneo — usa "você", evita "tu/vós" e construções lusitanas/traduzidas ("a fitar-te", "estás")? (n/a se o jogador narra em inglês)' },
] as const

// Pesos por dimensão. Decisão 4 da US-17: todos iguais (1.0) por ora — ponderar
// antes de ver a matriz é premature optimization. Const trivial de mudar depois.
// Chaveado por DIMENSIONS (dirigido por dados) — dimensão nova entra sem tocar aqui.
export const WEIGHTS: Record<Dimension['key'], number> = Object.fromEntries(
  DIMENSIONS.map((d) => [d.key, 1]),
) as Record<Dimension['key'], number>

/**
 * Threshold mínimo de QUALIDADE da narração (US-36): MÉDIA das dimensões (1–5)
 * abaixo disto reprova o eval no CI. Calibrado com a barra de ofício íntegra
 * batendo ~4+; degradar o prompt (remover a seção de ofício) derruba a média
 * abaixo de 3.5 (critério de aceite de "regressão real"). Const trivial de ajustar.
 */
export const QUALITY_THRESHOLD = 3.5

/**
 * Piso por dimensão (US-70). Além de `MÉDIA ≥ QUALITY_THRESHOLD`, cada dimensão-chave
 * tem um mínimo PRÓPRIO: um eixo abaixo do piso reprova mesmo com média alta. Fecha
 * o Furo 1 da US-70 — com 11 dimensões e um modelo base forte, uma queda cirúrgica
 * (só sensorial, só tensão) some na média (degradar a barra de ofício ainda tirou
 * média 4.45). Só as chaves que a barra dirige e a média dilui ganham piso; ausência
 * da chave = sem piso próprio (só entra na média). Valor calibrado com o anchor set
 * (proposta inicial 3), trivial de ajustar. Piso alto demais = flaky; baixo = não morde.
 *
 * ONOMÁSTICA saiu dos pisos (decisão de calibração após ver a matriz, US-70 decisão 2):
 * o slop de nome é INTERMITENTE por amostra, então a nota de onomástica do juiz oscila
 * (2 quando cai um "Elara", 5 quando não) — um piso por-dimensão reintroduz a flakiness
 * que a US existe para matar. O slop já é gateado de forma ESTÁVEL por TAXA (SLOP_RATE_MAX
 * sobre N reps, via detectSlopName), que é o mecanismo dedicado do Furo 2. Não duplicar.
 */
export const DIMENSION_FLOORS: Partial<Record<Dimension['key'], number>> = {
  sensorial: 3,
  tensao: 3,
  concretude: 3,
  linguaPt: 3,
}

/**
 * Limiar de AVISO da taxa de slop sobre N reps (US-70). `detectSlopName` é determinístico
 * por narração, mas a ENTRADA varia; medir a TAXA (`slopRate = fails/N`) sobre as reps
 * suaviza a intermitência.
 *
 * REPORT-ONLY por ora (decisão de calibração, US-70): a taxa-base de slop do modelo
 * (~40% nos casos com muitos nomes) fica COLADA neste limiar, então gatear a REPS=3
 * seria FLAKY — o run cruzaria 0.5 conforme o azar das amostras — violando a AC
 * "não-flaky". Enquanto a produção não reduz o slop (US irmã de enforcement no onFinish,
 * FORA do escopo desta US), o eval só AVISA quando `slopRate > SLOP_RATE_MAX`; não reprova.
 * Quando o base cair, virar isto num gate é uma linha (adicionar a `slopRate` de volta ao
 * `gateQuality`) — o encanamento (contagem por rep, relatório) já está pronto.
 */
export const SLOP_RATE_MAX = 0.5

/** Entrada da decisão de aprovação — a AGREGAÇÃO de N reps, nunca um tiro só. */
export interface GateInput {
  /** média por dimensão vinda do `aggregateReps` (não um score cru). */
  perDim: Record<Dimension['key'], number>
  /** MÉDIA geral agregada. */
  media: number
}

export interface GateResult {
  passed: boolean
  /** motivos da reprovação (vazio quando passa) — nomeia dimensão + valor. */
  reasons: string[]
}

/**
 * Decisão de aprovação do eval de qualidade (US-70), PURA — sem API, determinística.
 * É o "detector do detector": reprova quando
 *  - `media < QUALITY_THRESHOLD` (US-36), OU
 *  - alguma dimensão-chave `< DIMENSION_FLOORS[k]` (Furo 1: média alta escondia o eixo).
 * Opera sobre `perDim`/`media` do `aggregateReps` — o caso gated a chama com dados reais;
 * o `pnpm test` a chama com dados sintéticos (média 4.6 + sensorial:2 → reprova), provando
 * de graça que o piso pega o que a média deixava passar.
 *
 * O slop NÃO entra no gate por ora (report-only — ver SLOP_RATE_MAX): a taxa-base cola no
 * limiar e gatear a REPS=3 seria flaky. O caso gated mede e AVISA o slopRate; não reprova.
 */
export function gateQuality(input: GateInput): GateResult {
  const reasons: string[] = []
  if (input.media < QUALITY_THRESHOLD) {
    reasons.push(`MÉDIA ${input.media.toFixed(2)} < ${QUALITY_THRESHOLD}`)
  }
  for (const key of Object.keys(DIMENSION_FLOORS) as Dimension['key'][]) {
    const floor = DIMENSION_FLOORS[key]!
    const v = input.perDim[key]
    if (v != null && v < floor) {
      reasons.push(`dimensão "${key}" ${v.toFixed(2)} < piso ${floor}`)
    }
  }
  return { passed: reasons.length === 0, reasons }
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
// $/1M tokens, ENTRADA e SAÍDA separadas. Contar só a saída subestima o custo e
// distorce o ranking: o system prompt do DM (ficha + quests + inventário) reenvia
// alguns milhares de tokens por turno, então a entrada pesa ~40% da conta mesmo
// sendo mais barata por token. Candidatos NVIDIA = endpoint preview grátis (0);
// juiz Gemini free = 0; `:free` do OpenRouter paga em RPM, não em dólar. Modelo
// ausente do mapa custa 0 (nunca inventa preço). Conferido na api/v1/models do
// OpenRouter em 2026-07-16.

export interface Price {
  /** $/1M tokens de entrada (prompt) */
  in: number
  /** $/1M tokens de saída (completion; inclui reasoning tokens quando houver) */
  out: number
}

export const PRICES: Record<string, Price> = {
  'gpt-5-mini': { in: 0.25, out: 2.0 },
  'groq:openai/gpt-oss-120b': { in: 0.15, out: 0.75 },
  'openrouter:z-ai/glm-4.7-flash': { in: 0.061, out: 0.4 },
  'openrouter:nex-agi/nex-n2-mini': { in: 0.025, out: 0.1 },
  'openrouter:stepfun/step-3.5-flash': { in: 0.1, out: 0.3 },
  'openrouter:xiaomi/mimo-v2.5': { in: 0.14, out: 0.28 },
  'openrouter:nvidia/nemotron-3-super-120b-a12b': { in: 0.21, out: 0.455 }, // variante paga; o `:free` custa 0 e cai no default
  'openrouter:openai/gpt-oss-120b': { in: 0.037, out: 0.17 }, // base: mesmo modelo da produção, servido pelo OpenRouter
}

/** Tokens consumidos por um modelo numa rodada, separados por direção. */
export interface TokenUsage {
  prompt: number
  completion: number
}

/**
 * Custo EFETIVO estimado (US$) = entrada×preço_in + saída×preço_out, ambos por
 * 1M tokens. Modelo fora da tabela → 0 (nunca inventa preço).
 */
export function estimateCost(model: string, tokens: TokenUsage): number {
  const price = PRICES[model]
  if (!price) return 0
  return (tokens.prompt / 1_000_000) * price.in + (tokens.completion / 1_000_000) * price.out
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

/** MÉDIA das dimensões de UM score (pesos iguais → média simples). Usada pelo
 * threshold da US-36 e pelo log da avaliação ao vivo. */
export function meanOfScore(score: RubricScore): number {
  const dims = Object.fromEntries(DIMENSIONS.map((d) => [d.key, score[d.key].nota])) as Record<Dimension['key'], number>
  return weightedMean(dims)
}

/** Linha compacta "Dim: nota — justificativa" por dimensão. Log da live-eval e relatório. */
export function formatScoreLines(score: RubricScore): string {
  return DIMENSIONS.map((d) => `- ${d.label}: ${score[d.key].nota}/5 — ${score[d.key].justificativa}`).join('\n')
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
- Julgue APENAS a qualidade da NARRAÇÃO, conforme as DIMENSÕES DA RUBRICA fornecidas. NÃO julgue corretude mecânica (dados, ficha, inventário) — isso não é seu papel.
- Se um EXEMPLAR for fornecido, ele é uma âncora do que vale "nota 5" nesta campanha. Use-o como referência de padrão, NÃO como texto a ser copiado; uma resposta diferente pode valer 5 se atingir a mesma qualidade.
- Quando uma dimensão NÃO SE APLICA a este turno (ex.: "Voz NPC" sem NPC na cena; "Onomástica" sem nome próprio novo; "Língua pt-BR" quando o jogador narra em inglês), dê nota 5 e diga "n/a" na justificativa — NÃO penalize o que a cena não pediu.
- Combata o VIÉS DE TAMANHO: resposta longa não é melhor. Premie concisão adequada; penalize enrolação.
- Combata o VIÉS DE POSIÇÃO: a ordem em que os textos aparecem é irrelevante.
- Nota 1 = falha grave na dimensão; 5 = exemplar. Seja criterioso: 5 é excelência, não "ok".`

function buildJudgePrompt(params: {
  scenarioContext: string
  playerAction: string
  narration: string
  /** Âncora "nota 5". Ausente (ex.: avaliação ao vivo por turno) → sem few-shot. */
  exemplar?: Exemplar
}): string {
  const anchor = params.exemplar
    ? `## Âncora de "nota 5" (referência de padrão, NÃO copiar)
Ação do jogador: ${params.exemplar.playerAction}
Resposta do mestre (nota 5):
"""
${params.exemplar.dmResponse}
"""

`
    : ''
  return `## Dimensões da rubrica
${DIMENSIONS.map((d) => `- ${d.label}: ${d.pergunta}`).join('\n')}

${anchor}## Turno a julgar
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
  /** Âncora "nota 5". Opcional: a avaliação ao vivo (US-36) julga sem exemplar. */
  exemplar?: Exemplar
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

// ─── Relatório de QUALIDADE por caso (US-36) ─────────────────────────────────
// Diferente do bake-off (matriz modelo × dim): aqui o eixo é o CASO. Grava, junto
// da narração + notas + justificativas, os FATORES que podem explicar uma mudança
// de nota entre duas execuções (git, modelo que serviu, sampling, finishReason,
// tokens, juiz) — para comparar dois relatórios e saber O QUE mudou, não só QUE caiu.

/** Fatores da run que podem explicar uma mudança de nota entre execuções (US-36). */
export interface QualityRunMeta {
  /** commit curto do git HEAD + branch (o sinal mais forte de "o que mudou"). */
  gitHead: string
  gitBranch: string
  /** slug do modelo de narração que EFETIVAMENTE serviu + nível da escada (0=primário). */
  narrationModel: string
  ladderLevel: number
  /** sampling da narração — mudar qualquer um mexe na prosa. */
  maxTokens: number
  frequencyPenalty: number
  temperature?: number
  /** slug do juiz que `judgeModel()` resolveu. */
  judgeModel: string
  timestamp: string
}

/** Uma narração avaliada + seu score + os metadados do turno que a gerou. */
export interface QualityEntry {
  caseId: string
  locale: string
  scenarioContext: string
  playerAction: string
  narration: string
  score: RubricScore
  media: number
  finishReason: string
  tokens: TokenUsage
  /** slug do modelo que serviu ESTE turno (pode diferir se caiu ao fallback). */
  modelServed: string
  // ─── US-70: agregação de N reps (opcional — ausente = eval de 1 tiro) ───
  /** amplitude da MÉDIA entre as reps (do aggregateReps) — denuncia alta variância. */
  spread?: number
  /** fração das reps com nome de slop (gate por taxa, não por tiro). */
  slopRate?: number
  /** motivos da reprovação do gate (piso/slop/média). Presente ⇒ o caso reprovou. */
  gateReasons?: string[]
}

/** Render markdown do relatório de qualidade da US-36 (um bloco por caso + metadados). */
export function renderQualityReport(entries: QualityEntry[], meta: QualityRunMeta): string {
  const head = `# Eval de qualidade da narração (US-36) — ${meta.timestamp}

- git: \`${meta.gitHead}\` (${meta.gitBranch})
- narração: \`${meta.narrationModel}\` (nível ${meta.ladderLevel} da escada) · maxTokens ${meta.maxTokens} · frequencyPenalty ${meta.frequencyPenalty}${
    meta.temperature != null ? ` · temperature ${meta.temperature}` : ' · temperature default do provider'
  }
- juiz: \`${meta.judgeModel}\`
- threshold: MÉDIA ≥ ${QUALITY_THRESHOLD} · pisos ${Object.entries(DIMENSION_FLOORS)
    .map(([k, v]) => `${k}≥${v}`)
    .join(', ')} · slop report-only (aviso > ${SLOP_RATE_MAX})
`
  const blocks = entries
    .map((e) => {
      // US-70: reprova por MÉDIA OU por gate (piso/slop). gateReasons presente ⇒ ❌.
      const failed = e.media < QUALITY_THRESHOLD || (e.gateReasons?.length ?? 0) > 0
      const pass = failed ? '❌' : '✅'
      const aggLine =
        e.spread != null || e.slopRate != null
          ? `\n- agregado: spread ±${fmt(e.spread ?? 0)} · slopRate ${((e.slopRate ?? 0) * 100).toFixed(0)}%${
              e.gateReasons?.length ? ` · **reprovou:** ${e.gateReasons.join('; ')}` : ''
            }`
          : ''
      return `## ${pass} ${e.caseId} — MÉDIA ${fmt(e.media)} (${e.locale})
- modelo servido: \`${e.modelServed}\` · finishReason \`${e.finishReason}\` · tokens in/out ${e.tokens.prompt}/${e.tokens.completion}${aggLine}
- ação: ${e.playerAction}

### Notas
${formatScoreLines(e.score)}

### Narração avaliada
"""
${e.narration}
"""
`
    })
    .join('\n')
  return `${head}\n${blocks}`
}
