import { describe, it } from 'vitest'
import { streamText, tool } from 'ai'
import { z } from 'zod'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { DiceResult } from '@ai-dm/shared'
import { buildDmSystemPrompt } from './prompts/dm-system'
import { resolveModel, judgeModel } from './model'
import { checkNoSelfRoll, detectLanguageDrift, detectReasoningLeak } from './guardrails'
import {
  judgeTurn,
  aggregateReps,
  estimateCost,
  renderReportMarkdown,
  DIMENSIONS,
  type Exemplar,
  type RubricScore,
  type ModelAggregate,
} from './rubric'

// Bake-off narrativo (US-17) — SLICE 2 completo. Roda os candidatos contra os
// cenários fixos, aplica os guardrails DETERMINÍSTICOS (deriva de idioma +
// vazamento de reasoning em todo cenário; "não rola dados sozinho" no combate)
// e, nos turnos que passam, pontua a QUALIDADE NARRATIVA com o juiz LLM (Gemini)
// via rubrica multi-eixo (rubric.ts). Saída: dump por cenário no stdout + matriz
// modelo × dimensão gravada em evals/reports/<data>.md.
// Convenção do bench-ttft.test.ts: teste vitest gated por env, fora do CI.
//
// Uso: BAKEOFF=1 NVIDIA_API_KEY=... GEMINI_API_KEY=... \
//        pnpm --filter @ai-dm/ai-engine test narrative-bakeoff
//      MODELS=a,b,groq:openai/gpt-oss-120b  troca a lista (default = rodada 1).
//      JUDGE_REPS=3  repetições por caso (default 3).
//
// ponytail: parametrização por env (MODELS=), não flag --models de CLI — vitest
// não repassa flags custom bem. Mesmo resultado, sem reinventar o runner.

// ids no formato do NVIDIA NIM (org/modelo); prefixo `groq:` roteia pro incumbente.
// Trio validado 2026-07-10 no endpoint real (rápidos <8s, texto puro, PT-BR): os
// slugs antigos ou eram 404 (mistral-large-3-475b) ou penduravam (llama-3.3-70b,
// qwen3-next-80b). Confirme sempre no catálogo antes de trocar (ver probe.mjs).
const DEFAULT_MODELS = [
  'mistralai/mistral-large-3-675b-instruct-2512', // aposta nº1 (~2s)
  'mistralai/mistral-small-4-119b-2603', // mid rápido (~1.5s)
  'z-ai/glm-5.2', // generalista forte (~5s)
]

/** Lê MODELS=a,b,c do ambiente; trim e descarta vazios. Vazio → rodada 1. */
function parseModels(env: string | undefined): string[] {
  const ids = (env ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return ids.length ? ids : DEFAULT_MODELS
}

// sanity check da única lógica não-óbvia
console.assert(
  parseModels(' a , ,b ').join('|') === 'a|b' &&
    parseModels('').join('|') === DEFAULT_MODELS.join('|'),
  'parseModels bug',
)

const REQ_TIMEOUT_MS = 40_000 // endpoint frio falha rápido em vez de comer o orçamento
const REPS = Math.max(1, Number(process.env['JUDGE_REPS'] ?? 3))

// Base da ficha da paladina de referência (aventura Seraphine) — mesma "source
// of truth" que a narração de produção lê. `background`/`features` entram magros
// de propósito no slice 2 inicial; enriquecê-los para paridade total com a
// produção (US-39/40/41) é o próximo passo.
const BASE_SHEET = {
  systemName: 'D&D 5e',
  characterName: 'Lady Seraphine Valthor',
  characterGender: 'feminino',
  characterClass: 'paladina',
  characterRace: 'humana',
  activeQuests: ['Investigar o desaparecimento das crianças de Eldridge'],
  inventory: ['Espada longa Luz da Manhã', 'Escudo do Sol Dourado', 'Armadura de placas'],
  sheet: {
    level: 5,
    hp: 44,
    maxHp: 44,
    attributes: { strength: 16, wisdom: 14, charisma: 16 },
    conditions: [],
  },
}

const SYSTEM = buildDmSystemPrompt({ ...BASE_SHEET })

// Cenário de coerência: injeta um histórico onde o NPC Garrick MENTIU e a
// jogadora hoje SABE disso. O turno bom mantém Garrick consistente com ter
// mentido/escondido o padre — não inventa um Garrick inocente.
const COHERENCE_SYSTEM = buildDmSystemPrompt({
  ...BASE_SHEET,
  memorySummary:
    'No início da investigação, o taverneiro Garrick jurou a Seraphine que NUNCA tinha visto o Padre Elias e que nada sabia. Turnos depois, provas revelaram que Garrick escondeu o padre ferido no porão da própria taverna, com medo dos cultistas — ou seja, ele MENTIU naquele primeiro encontro. Seraphine agora sabe disso.',
})

// ─── Exemplares "nota 5" (few-shot de calibração), da aventura de referência ──
// docs/sdlc/referencia/aventura-seraphine.md — âncoras de padrão, não texto a copiar.

const EX_OPENING: Exemplar = {
  playerAction: '[início da aventura] Chego a Eldridge ao anoitecer, sob chuva.',
  dmResponse:
    'A chuva fina caía sobre a estrada de terra enquanto você cavalgava em Aurora, sua égua branca. À frente, as luzes de Eldridge surgiam entre as árvores — mas o portão estava entreaberto e o silêncio era pesado demais para uma vila ao anoitecer. Você desmonta, a mão no punho de Luz da Manhã. Um velho magro sai correndo de uma casa e cai de joelhos: — Pela Luz! Uma paladina! Eles levaram as crianças! Você sente um formigamento no peito: o mal está próximo. O que você faz, Lady Seraphine?',
}

const EX_DIALOGUE: Exemplar = {
  playerAction: 'Pergunto ao velho quantas crianças, como eram as criaturas e o que houve com o padre.',
  dmResponse:
    'O velho segura suas mãos como uma âncora, os olhos vermelhos de choro. — S-são sete, senhora... as mais novas tinham cinco anos. Sumiram uma por noite, sempre com a lua alta. As criaturas... são mortos-vivos, mas não como zumbis: sombras com forma humana, olhos vermelhos, e passam pelas portas trancadas como fumaça. Ele baixa a voz: — O Padre Elias foi enfrentar o mal na igreja e nunca voltou. Desde então as luzes de lá ficam roxas, erradas. Você sente a presença maligna pulsar mais forte, vinda da igreja. O que faz agora?',
}

const EX_COMBAT: Exemplar = {
  playerAction: 'Invoco Expulsar Mortos-Vivos na entrada da igreja.',
  dmResponse:
    'Você planta os pés no chão molhado, ergue o escudo e proclama: — Pela Luz de Solariel! Que as trevas sejam expulsas! Uma onda dourada explode em todas as direções. Três figuras entre as lápides são atingidas; duas se desintegram em chamas douradas, a terceira recua cambaleando para dentro da igreja, fumegando. A presença maior recua, como se doesse. As portas rangem e uma voz rouca ecoa: — Paladina... sua luz ofende o Mestre. Você chegou tarde. O que um dia foi o Padre Elias surge na entrada, veias negras na pele, olhos roxos.',
}

const EX_DILEMMA: Exemplar = {
  playerAction: 'Uso a visão de Solariel para saber se os dois cultistas rendidos estão arrependidos.',
  dmResponse:
    'Você fecha os olhos, a mão sobre o símbolo de Solariel. Uma luz dourada preenche sua mente. O mais jovem, Balen: arrependimento genuíno — atraído por promessas, nunca matou; há vergonha e um desejo real de redenção, uma luz fraca mas crescente. O mais velho, Garren: há arrependimento, mas também medo e uma dúvida — se a situação apertar, ele pode trair para salvar a própria pele. Solariel sussurra: "A misericórdia é uma arma poderosa, mas a sabedoria deve guiá-la." Você abre os olhos; todos esperam em silêncio. O que deseja fazer?',
}

const EX_COHERENCE: Exemplar = {
  playerAction: 'Confronto o NPC que antes mentiu, agora que sei a verdade.',
  dmResponse:
    'Garrick empalidece e desvia o olhar — a mesma covardia trêmula de antes, agora encurralada. — A senhora... a senhora sabe. Ele engole em seco, as mãos apertando o pano do balcão. — Eu menti, sim. Que Solariel me perdoe. Quando disse que nunca vira o padre... ele estava lá embaixo, no porão, sangrando. Os homens de olhos roxos disseram que se eu contasse a alguém, levariam minha filha também. Eu tive medo, senhora. Ele ergue os olhos, súplica e vergonha misturadas. — O que a senhora vai fazer comigo?',
}

// Cenários. Cada um tensiona eixos diferentes e traz seu exemplar-âncora. Os
// guardrails de idioma/reasoning valem para todos; o de auto-rolagem só no combate.
interface Scenario {
  id: string
  action: string
  scenarioContext: string
  exemplar: Exemplar
  system: string
  checkSelfRoll: boolean
}

const SCENARIOS: Scenario[] = [
  {
    id: 'opening',
    action:
      'Chego à vila de Eldridge ao anoitecer, sob chuva fina, e desço do meu cavalo perto do portão entreaberto. Observo o ambiente.',
    scenarioContext: 'Turno de abertura: chegada à vila de Eldridge ao anoitecer, sob chuva.',
    exemplar: EX_OPENING,
    system: SYSTEM,
    checkSelfRoll: false,
  },
  {
    id: 'dialogo',
    action:
      'Ajoelho perto do velho e pergunto, com calma: quantas crianças foram levadas? Como são essas criaturas? O que aconteceu com o padre?',
    scenarioContext: 'A jogadora interroga um aldeão aterrorizado sobre o desaparecimento das crianças e do padre.',
    exemplar: EX_DIALOGUE,
    system: SYSTEM,
    checkSelfRoll: false,
  },
  {
    id: 'combat',
    action: 'Saco a espada e ataco o goblin à minha frente.',
    scenarioContext: 'Combate: a jogadora ataca um inimigo — a resolução exige uma rolagem de dado.',
    exemplar: EX_COMBAT,
    system: SYSTEM,
    checkSelfRoll: true,
  },
  {
    id: 'dilema',
    action:
      'Uso a visão divina de Solariel sobre os dois cultistas rendidos à minha frente para julgar se há arrependimento verdadeiro em cada um.',
    scenarioContext: 'Dilema moral: a jogadora usa visão divina para pesar o destino de dois cultistas rendidos.',
    exemplar: EX_DILEMMA,
    system: SYSTEM,
    checkSelfRoll: false,
  },
  {
    id: 'coerencia',
    action:
      'Encaro Garrick e digo: "Eu sei que você escondeu o Padre Elias no seu porão. Você mentiu quando disse que nunca o tinha visto. Por quê?"',
    scenarioContext: 'Coerência: a jogadora confronta o taverneiro Garrick, que mentiu turnos atrás (histórico no contexto).',
    exemplar: EX_COHERENCE,
    system: COHERENCE_SYSTEM,
    checkSelfRoll: false,
  },
]

// Stub da tool rollDice: a de produção delega ao Game Server e LANÇA fora dele.
// Aqui devolvemos um DiceResult fixo — só precisamos que a CHAMADA registre no
// `toolCalls` do stream (o guardrail lê a chamada, não o número).
const rollDiceStub = tool({
  description:
    'Roll dice using standard RPG notation (e.g. 2d6+3, 1d20). Always use this tool for any mechanical dice roll — never generate random numbers yourself.',
  parameters: z.object({
    formula: z.string(),
    reason: z.string(),
  }),
  execute: async ({ formula }): Promise<DiceResult> => ({ formula, rolls: [12], modifier: 0, total: 12 }),
})

interface TurnResult {
  model: string
  scenario: string
  narration: string
  ttftMs: number | null
  tokens: number | null
  calledRollDice: boolean
  error?: string
}

async function runTurn(modelId: string, scenario: Scenario): Promise<TurnResult> {
  const start = performance.now()
  let ttftMs: number | null = null
  let narration = ''
  try {
    const result = streamText({
      model: resolveModel(modelId),
      system: scenario.system,
      prompt: scenario.action,
      // tools + maxSteps: deixa o modelo chamar rollDice e depois narrar com o
      // resultado, num único turno. Sem isso o guardrail não observaria a chamada.
      tools: { rollDice: rollDiceStub },
      maxSteps: 4,
      // maxRetries baixo: o endpoint preview rate-limita (429). Retry com backoff
      // exponencial default vira tempestade de minutos; 1 tentativa extra basta.
      maxRetries: 1,
      abortSignal: AbortSignal.timeout(REQ_TIMEOUT_MS),
    })
    for await (const chunk of result.textStream) {
      if (ttftMs === null) ttftMs = performance.now() - start
      narration += chunk
    }
    const usage = await result.usage
    const toolCalls = await result.toolCalls
    const calledRollDice = toolCalls.some((c) => c.toolName === 'rollDice')
    return { model: modelId, scenario: scenario.id, narration, ttftMs, tokens: usage.completionTokens ?? null, calledRollDice }
  } catch (e) {
    return { model: modelId, scenario: scenario.id, narration, ttftMs, tokens: null, calledRollDice: false, error: (e as Error).message }
  }
}

/** Roda os guardrails aplicáveis a um turno e devolve as falhas (vazio = passou). */
function evaluateGuardrails(r: TurnResult, checkSelfRoll: boolean): string[] {
  const fails: string[] = []
  if (detectLanguageDrift(r.narration).drift) fails.push('idioma')
  if (detectReasoningLeak(r.narration).leak) fails.push('reasoning-leak')
  if (checkSelfRoll && !checkNoSelfRoll({ calledRollDice: r.calledRollDice, narration: r.narration }).passed) {
    fails.push('rollDice')
  }
  return fails
}

/** Acumulado por modelo ao longo de todos os cenários × repetições. */
interface ModelAccum {
  scores: RubricScore[]
  candidateTokens: number
  guardrailFails: number
  reps: number
  ttftSamples: number[]
}

describe('bake-off narrativo (US-17, slice 2: guardrails + juiz)', () => {
  it.runIf(process.env['BAKEOFF'])(
    'pontua a qualidade narrativa dos candidatos e grava a matriz de decisão',
    async () => {
      if (!process.env['NVIDIA_API_KEY']) throw new Error('Falta NVIDIA_API_KEY')
      if (!process.env['GEMINI_API_KEY']) throw new Error('Falta GEMINI_API_KEY (juiz)')
      const models = parseModels(process.env['MODELS'])
      const judge = judgeModel()

      const accum = new Map<string, ModelAccum>(
        models.map((m) => [m, { scores: [], candidateTokens: 0, guardrailFails: 0, reps: 0, ttftSamples: [] }]),
      )

      // TUDO em série (modelos × cenários × reps): o endpoint preview do NVIDIA
      // rate-limita agressivamente; paralelizar modelos dispara 429 em rajada e o
      // backoff dos retries come o orçamento. Série é mais lenta no papel, mas
      // termina — sem 429 não há espera de minutos.
      for (const model of models) {
        {
          const acc = accum.get(model)!
          for (const scenario of SCENARIOS) {
            for (let rep = 0; rep < REPS; rep++) {
              acc.reps++
              const turn = await runTurn(model, scenario)
              if (turn.ttftMs !== null) acc.ttftSamples.push(turn.ttftMs)
              acc.candidateTokens += turn.tokens ?? 0

              // Dump da 1ª rep de cada cenário (eyeball da prosa).
              if (rep === 0) {
                console.log(`\n\n########## ${model} · ${scenario.id} ##########`)
                if (turn.error) console.log(`✗ erro: ${turn.error}`)
                console.log(turn.narration || '(vazio)')
              }

              const fails = evaluateGuardrails(turn, scenario.checkSelfRoll)
              if (fails.length) {
                acc.guardrailFails++
                if (rep === 0) console.log(`⛔ guardrails: ${fails.join(' · ')} → não vai ao juiz`)
                continue // guardrail corta ANTES de gastar juiz
              }

              // Passou nos guardrails → juiz LLM pontua a rubrica.
              try {
                const { score } = await judgeTurn({
                  judge,
                  scenarioContext: scenario.scenarioContext,
                  playerAction: scenario.action,
                  narration: turn.narration,
                  exemplar: scenario.exemplar,
                })
                acc.scores.push(score)
              } catch (e) {
                console.log(`  ✗ juiz falhou (${model}/${scenario.id}): ${(e as Error).message}`)
              }
            }
          }
        }
      }

      // Agrega por modelo (média das dimensões × cenários × reps) + custo do candidato.
      const rows: ModelAggregate[] = models
        .map((model) => {
          const acc = accum.get(model)!
          if (!acc.scores.length) return null // reprovado em todos os guardrails
          return aggregateReps(acc.scores, model, estimateCost(model, acc.candidateTokens))
        })
        .filter((r): r is ModelAggregate => r !== null)

      // Resumo de guardrails para o cabeçalho do relatório.
      const totalFails = [...accum.values()].reduce((s, a) => s + a.guardrailFails, 0)
      const guardrailSummary =
        totalFails === 0
          ? `idioma OK · reasoning-leak: nenhum · rollDice: OK (todos, ${REPS} reps × ${SCENARIOS.length} cenários)`
          : `${totalFails} turno(s) cortado(s) por guardrail (ver dump acima)`

      const incumbent = models.find((m) => m.startsWith('groq:')) ?? null
      const date = new Date().toISOString().slice(0, 10)
      const md = renderReportMarkdown(rows, { date, guardrailSummary, incumbent })

      // stdout: matriz + tabela de latência/tokens/reps.
      console.log(`\n\n===== MATRIZ FINAL (média das dimensões × ${SCENARIOS.length} cenários, ${REPS} reps) =====`)
      console.log(md)
      console.table(
        [...accum.entries()].map(([model, a]) => ({
          modelo: model,
          reps: a.reps,
          julgados: a.scores.length,
          'guardrail-fail': a.guardrailFails,
          'TTFT médio': a.ttftSamples.length
            ? `${Math.round(a.ttftSamples.reduce((s, x) => s + x, 0) / a.ttftSamples.length)} ms`
            : 'falhou',
          'tokens (cand.)': a.candidateTokens,
        })),
      )

      // Artefato durável: evals/reports/<data>.md (versionável, comparável).
      const reportsDir = resolve(process.cwd(), '../../evals/reports')
      mkdirSync(reportsDir, { recursive: true })
      const reportPath = resolve(reportsDir, `${date}.md`)
      writeFileSync(reportPath, md, 'utf8')
      console.log(`\n📄 relatório gravado em ${reportPath}`)
    },
    1_200_000, // 5 cenários × N modelos × REPS gerações (narração inteira, ~30s) + juiz
  )
})
