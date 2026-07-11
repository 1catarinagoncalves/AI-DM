// Runner standalone do bake-off (US-17, slice 2). Fora do vitest: o endpoint
// preview do NVIDIA rate-limita e o par streamText+vitest pendurava. Aqui:
// generateText (resolve inteiro, sem hang de .usage), maxRetries:0, timeout duro
// por chamada, série com pacing, log progressivo, grava evals/reports/<data>.md.
//
// node --env-file=../../.env JUDGE_MODEL=openai:gpt-4o-mini MODELS=a,b run-bakeoff.mjs
import { generateText, tool } from 'ai'
import { z } from 'zod'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildDmSystemPrompt, resolveModel, judgeModel, judgeTurn,
  checkNoSelfRoll, detectLanguageDrift, detectReasoningLeak,
  aggregateReps, estimateCost, renderReportMarkdown,
} from './dist/index.js'

const t = () => new Date().toISOString().slice(11, 19)
const log = (...a) => console.log(`[${t()}]`, ...a)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const REPS = Math.max(1, Number(process.env.JUDGE_REPS ?? 1))
const REQ_TIMEOUT_MS = 60_000
const PACE_MS = 3000 // respiro entre chamadas p/ não disparar 429
const GEN_RETRIES = 2 // 429 transitório do endpoint preview: tolera com backoff (série, sem storm)

const DEFAULT_MODELS = [
  'mistralai/mistral-large-3-675b-instruct-2512',
  'mistralai/mistral-small-4-119b-2603',
  'z-ai/glm-5.2',
]
const MODELS = (process.env.MODELS ?? '').split(',').map((s) => s.trim()).filter(Boolean)
const models = MODELS.length ? MODELS : DEFAULT_MODELS

const BASE = {
  systemName: 'D&D 5e', characterName: 'Lady Seraphine Valthor', characterGender: 'feminino',
  characterClass: 'paladina', characterRace: 'humana',
  activeQuests: ['Investigar o desaparecimento das crianças de Eldridge'],
  inventory: ['Espada longa Luz da Manhã', 'Escudo do Sol Dourado', 'Armadura de placas'],
  sheet: { level: 5, hp: 44, maxHp: 44, attributes: { strength: 16, wisdom: 14, charisma: 16 }, conditions: [] },
}
const SYSTEM = buildDmSystemPrompt({ ...BASE })
const COHERENCE_SYSTEM = buildDmSystemPrompt({
  ...BASE,
  memorySummary:
    'No início da investigação, o taverneiro Garrick jurou a Seraphine que NUNCA tinha visto o Padre Elias e que nada sabia. Turnos depois, provas revelaram que Garrick escondeu o padre ferido no porão da própria taverna, com medo dos cultistas — ou seja, ele MENTIU naquele primeiro encontro. Seraphine agora sabe disso.',
})

const EX = {
  opening: { playerAction: '[abertura]', dmResponse: 'A chuva fina caía sobre Eldridge; o portão entreaberto, o silêncio pesado. Um velho cai de joelhos: — Levaram as crianças! Você sente o mal próximo. O que faz?' },
  dialogo: { playerAction: 'Pergunto ao velho sobre as crianças e o padre.', dmResponse: 'O velho segura suas mãos, tremendo: — São sete, senhora... sumiram uma por noite. As criaturas passam pelas portas como fumaça. O padre foi à igreja e não voltou. Você sente a presença pulsar mais forte.' },
  combat: { playerAction: 'Invoco Expulsar Mortos-Vivos.', dmResponse: 'Uma onda dourada explode; dois mortos-vivos se desintegram, o terceiro recua fumegando. As portas rangem e uma voz rouca ecoa: — Paladina, sua luz ofende o Mestre.' },
  dilema: { playerAction: 'Uso a visão divina sobre os cultistas.', dmResponse: 'A luz revela: o jovem Balen tem arrependimento genuíno, uma luz fraca mas crescente; o velho Garren esconde cálculo frio. Solariel sussurra: a misericórdia é arma, mas a sabedoria deve guiá-la.' },
  coerencia: { playerAction: 'Confronto o NPC que mentiu.', dmResponse: 'Garrick empalidece, a mesma covardia de antes: — Eu menti, sim. Ele estava no porão, sangrando. Disseram que levariam minha filha se eu contasse. Tive medo, senhora.' },
}

const SCENARIOS = [
  { id: 'opening', action: 'Chego à vila de Eldridge ao anoitecer, sob chuva fina, e desço do meu cavalo perto do portão entreaberto. Observo o ambiente.', context: 'Turno de abertura: chegada a Eldridge ao anoitecer, sob chuva.', ex: EX.opening, system: SYSTEM, checkSelfRoll: false },
  { id: 'dialogo', action: 'Ajoelho perto do velho e pergunto, com calma: quantas crianças foram levadas? Como são essas criaturas? O que aconteceu com o padre?', context: 'A jogadora interroga um aldeão aterrorizado.', ex: EX.dialogo, system: SYSTEM, checkSelfRoll: false },
  { id: 'combat', action: 'Saco a espada e ataco o goblin à minha frente.', context: 'Combate: a jogadora ataca — a resolução exige rolagem.', ex: EX.combat, system: SYSTEM, checkSelfRoll: true },
  { id: 'dilema', action: 'Uso a visão divina de Solariel sobre os dois cultistas rendidos à minha frente para julgar se há arrependimento verdadeiro em cada um.', context: 'Dilema moral: visão divina sobre dois cultistas rendidos.', ex: EX.dilema, system: SYSTEM, checkSelfRoll: false },
  { id: 'coerencia', action: 'Encaro Garrick e digo: "Eu sei que você escondeu o Padre Elias no seu porão. Você mentiu quando disse que nunca o tinha visto. Por quê?"', context: 'Coerência: confronta Garrick, que mentiu turnos atrás (histórico no contexto).', ex: EX.coerencia, system: COHERENCE_SYSTEM, checkSelfRoll: false },
]

const rollDiceStub = tool({
  description: 'Roll dice using standard RPG notation (e.g. 2d6+3, 1d20). Always use this tool for any mechanical dice roll — never generate random numbers yourself.',
  parameters: z.object({ formula: z.string(), reason: z.string() }),
  execute: async ({ formula }) => ({ formula, rolls: [12], modifier: 0, total: 12 }),
})

function guardrailFails(narration, calledRollDice, checkSelfRoll) {
  const fails = []
  if (detectLanguageDrift(narration).drift) fails.push('idioma')
  if (detectReasoningLeak(narration).leak) fails.push('reasoning-leak')
  if (checkSelfRoll && !checkNoSelfRoll({ calledRollDice, narration }).passed) fails.push('rollDice')
  return fails
}

async function genTurn(model, scenario) {
  // Tool só no combate: é o único cenário que exige rollDice. Passar a tool em
  // todo cenário quebra modelos sem suporte a tool-use ("No endpoints found that
  // support tool use") — a maioria dos cenários é narração pura, sem tool.
  const toolOpts = scenario.checkSelfRoll ? { tools: { rollDice: rollDiceStub }, maxSteps: 4 } : {}
  const p = generateText({
    model: resolveModel(model), system: scenario.system, prompt: scenario.action,
    ...toolOpts, maxRetries: GEN_RETRIES,
    abortSignal: AbortSignal.timeout(REQ_TIMEOUT_MS),
  })
  const res = await Promise.race([p, sleep(REQ_TIMEOUT_MS + 5000).then(() => { throw new Error('hard-timeout') })])
  const called = (res.toolCalls ?? []).some((c) => c.toolName === 'rollDice')
  return { narration: res.text ?? '', tokens: res.usage?.completionTokens ?? 0, called }
}

const judge = judgeModel()
const accum = new Map(models.map((m) => [m, { scores: [], tokens: 0, fails: 0 }]))

log(`início · modelos=${models.length} · cenários=${SCENARIOS.length} · reps=${REPS} · juiz=${process.env.JUDGE_MODEL ?? 'gemini-2.5-flash'}`)

for (const model of models) {
  const acc = accum.get(model)
  for (const s of SCENARIOS) {
    for (let rep = 0; rep < REPS; rep++) {
      const start = performance.now()
      let turn
      try {
        turn = await genTurn(model, s)
      } catch (e) {
        log(`✗ gen ${model}/${s.id} r${rep} — ${Math.round(performance.now() - start)}ms — ${e.name}: ${String(e.message).slice(0, 90)}`)
        await sleep(PACE_MS); continue
      }
      const fails = guardrailFails(turn.narration, turn.called, s.checkSelfRoll)
      acc.tokens += turn.tokens
      if (fails.length) {
        acc.fails++
        log(`⛔ ${model}/${s.id} r${rep} — guardrail: ${fails.join(',')} (${Math.round(performance.now() - start)}ms, ${turn.narration.length}c)`)
        await sleep(PACE_MS); continue
      }
      try {
        const { score } = await judgeTurn({ judge, scenarioContext: s.context, playerAction: s.action, narration: turn.narration, exemplar: s.ex })
        acc.scores.push(score)
        const avg = (score.imersao.nota + score.sensorial.nota + score.agencia.nota + score.vozNpc.nota + score.ritmo.nota + score.coerencia.nota) / 6
        log(`✓ ${model}/${s.id} r${rep} — ${Math.round(performance.now() - start)}ms, ${turn.narration.length}c, média=${avg.toFixed(1)}`)
      } catch (e) {
        log(`✗ juiz ${model}/${s.id} r${rep} — ${e.name}: ${String(e.message).slice(0, 90)}`)
      }
      await sleep(PACE_MS)
    }
  }
}

const rows = models
  .map((m) => { const a = accum.get(m); return a.scores.length ? aggregateReps(a.scores, m, estimateCost(m, a.tokens)) : null })
  .filter(Boolean)

const totalFails = [...accum.values()].reduce((s, a) => s + a.fails, 0)
const guardrailSummary = totalFails === 0
  ? `idioma OK · reasoning-leak: nenhum · rollDice: OK (${REPS} reps × ${SCENARIOS.length} cenários)`
  : `${totalFails} turno(s) cortado(s) por guardrail`
const incumbent = models.find((m) => m.startsWith('groq:')) ?? null
const now = new Date()
const pad = (n) => String(n).padStart(2, '0')
const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` // hora local
const stamp = `${date}_${pad(now.getHours())}${pad(now.getMinutes())}` // p/ nome do arquivo (sem ':')
const md = renderReportMarkdown(rows, { date, guardrailSummary, incumbent })

console.log('\n' + md)
console.table([...accum.entries()].map(([m, a]) => ({ modelo: m, julgados: a.scores.length, 'guardrail-fail': a.fails, tokens: a.tokens })))

// Tag por provider no nome do arquivo p/ não sobrescrever runs de providers
// diferentes (NVIDIA vs OpenRouter). Override manual via RUN_LABEL.
const tag = process.env.RUN_LABEL
  ?? (models.every((m) => m.startsWith('openrouter:')) ? 'openrouter'
    : models.every((m) => m.startsWith('groq:')) ? 'groq'
      : models.every((m) => m.startsWith('openai:')) ? 'openai'
        : models.some((m) => /^(groq|openrouter|openai):/.test(m)) ? 'mixed' : 'nvidia')
const dir = resolve(process.cwd(), '../../evals/reports')
mkdirSync(dir, { recursive: true })
const path = resolve(dir, `${stamp}-${tag}.md`)
writeFileSync(path, md, 'utf8')
log(`📄 relatório: ${path}`)
