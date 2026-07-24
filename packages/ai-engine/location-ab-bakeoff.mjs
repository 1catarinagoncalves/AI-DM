// A/B da LOCALIZAÇÃO do AI DM (US-71) — mesmo modelo de PRODUÇÃO, dois estados de
// localização, sobre a cena EXATA do bug de replay (anexo `erro location.md`).
//
// Clona `prompt-ab-bakeoff.mjs` para o cenário de localização:
//   - ANTIGO = system + turn-state PRÉ-US-71 (capturados em location-old.snapshot.json
//     por capture-old-location.mjs): 3 fontes de localização + ~40 linhas de prosa
//     anti-replay + arbitragem de precedência + `— em {local}` redundante do NPC presente.
//   - NOVO   = builders atuais do dist: fonte única (cena) + sinal de continuidade
//     estrutural + prosa enxuta + `— em {local}` suprimido para NPC em cena.
// Ambos os braços compartilham a MESMA cena, personagem e histórico (turno 1 no history).
//
// Mede, por braço:
//   (a) TAXA DE REPLAY = overlapRatio(narração nova, narração do turno 1) — o alvo
//   (b) tokens de ENTRADA reais (a prosa encolheu — validação do "enxugar")
//   (c) MÉDIA da rubrica do juiz (US-36) — trava contra regredir qualidade ao cortar prosa
//   (d) taxa de DEGENERAÇÃO (n-grama repetido / palavra colada), como no A/B existente
// Sucesso = NOVO com replay menor, tokens de entrada menores e rubrica ≥ ANTIGO.
//
// Rodar (na pasta packages/ai-engine, com o dist NOVO buildado):
//   1) capture-old-location.mjs uma vez com o dist PRÉ-US-71 (gera o snapshot ANTIGO)
//   2) npx dotenv-cli -e ../../.env -- node location-ab-bakeoff.mjs
import { generateText } from 'ai'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildDmSystemPrompt, buildTurnStateBlock, resolveModel, judgeModel, judgeTurn,
  meanOfScore, overlapRatio, REPLAY_OVERLAP_THRESHOLD,
  NARRATION_MAX_TOKENS, NARRATION_FREQUENCY_PENALTY,
} from './dist/index.js'
import { SCENE } from './location-scene.mjs'

const t = () => new Date().toISOString().slice(11, 19)
const log = (...a) => console.log(`[${t()}]`, ...a)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const REPS = Math.max(1, Number(process.env.JUDGE_REPS ?? 4))
const REQ_TIMEOUT_MS = 180_000
const PACE_MS = Number(process.env.PACE_MS ?? 2000)

// Modelo de produção (narrationModels[0]) + preço OpenRouter — paridade com prompt-ab.
const MODEL = { slug: 'deepseek/deepseek-v4-flash', effort: 'high', price: { in: 0.098, out: 0.196 } }

// NOVO = builders atuais do dist. ANTIGO = snapshot capturado do dist pré-US-71.
const OLD = JSON.parse(readFileSync(SCENE.oldSnapshotPath, 'utf8'))
const NEW = {
  system: buildDmSystemPrompt(SCENE.character),
  turnState: buildTurnStateBlock(SCENE.turnStateArgs),
}
const ARMS = [
  { label: 'ANTIGO', system: OLD.system, turnState: OLD.turnState },
  { label: 'NOVO', system: NEW.system, turnState: NEW.turnState },
]

// Histórico compartilhado: turno 1 (ação + narração com a chegada) já ANTES do turno 2.
// Só o prefixo turn-state do turno 2 e o system diferem entre os braços.
function messagesFor(arm) {
  return [
    { role: 'user', content: SCENE.turn1Action },
    { role: 'assistant', content: SCENE.turn1Narration },
    { role: 'user', content: `${arm.turnState}\n\n${SCENE.turn2Action}` },
  ]
}

const SCENARIO_CONTEXT =
  'Cena de continuidade: Anetra JÁ ESTÁ na forja de Hélio (a chegada e a saudação dele foram narradas no turno anterior, presente no histórico). No turno atual ela apenas CONTINUA a conversa. O esperado é Hélio responder ali mesmo, na forja — NUNCA re-narrar a viagem, a chegada ou a saudação de novo.'
const EXEMPLAR = {
  playerAction: SCENE.turn2Action,
  dmResponse:
    '— Pântano de Ossos… — Hélio repete o nome como se doesse, e pousa o martelo na bigorna. O tinir do metal morre entre vocês.\n\nEle limpa as mãos no avental e te encara, a testa franzida de um jeito que você conhece desde criança.\n\n— Já perdi um irmão pra aquela lama, menina. Se vai mesmo, leva minha adaga velha e não bebe água parada de lá. E volta. — A voz falha na última palavra.\n\n- 🗡️ Aceitar a adaga e prometer voltar.\n- 💬 Perguntar o que aconteceu com o irmão dele.\n- 🚪 Agradecer e seguir para o cais.',
}

// Detector de DEGENERAÇÃO — idêntico ao de prompt-ab-bakeoff.mjs (palavra colada / n-grama repetido).
function detectDegeneration(text) {
  const glued = text.match(/\p{Ll}\p{Lu}/u)
  if (glued) return { degen: true, match: `colado: ${text.slice(Math.max(0, glued.index - 8), glued.index + 8)}` }
  const words = text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').match(/\p{L}+/gu) ?? []
  const seen = new Map()
  for (let i = 0; i + 5 <= words.length; i++) {
    const gram = words.slice(i, i + 5).join(' ')
    if (seen.has(gram)) return { degen: true, match: `repetido: "${gram}"` }
    seen.set(gram, i)
  }
  return { degen: false, match: '' }
}

const judge = judgeModel()
const cost = (usage, price) => (usage.promptTokens / 1e6) * price.in + (usage.completionTokens / 1e6) * price.out

async function genOnce(arm) {
  const res = await generateText({
    model: resolveModel(`openrouter:${MODEL.slug}`),
    system: arm.system,
    messages: messagesFor(arm),
    maxTokens: NARRATION_MAX_TOKENS,
    frequencyPenalty: NARRATION_FREQUENCY_PENALTY,
    providerOptions: { openrouter: { reasoning: { effort: MODEL.effort, exclude: true } } },
    maxRetries: 1,
    abortSignal: AbortSignal.timeout(REQ_TIMEOUT_MS),
  })
  return { text: res.text, usage: res.usage }
}

const rows = []
for (const arm of ARMS) {
  const reps = []
  for (let i = 0; i < REPS; i++) {
    try {
      log(`${arm.label} rep ${i + 1}/${REPS}…`)
      const { text, usage } = await genOnce(arm)
      if (!text || !text.trim()) { log('  ⚠ narração vazia — pulando rep'); await sleep(PACE_MS); continue }
      const replay = overlapRatio(text, SCENE.turn1Narration)
      const degen = detectDegeneration(text)
      const { score } = await judgeTurn({ judge, scenarioContext: SCENARIO_CONTEXT, playerAction: SCENE.turn2Action, narration: text, exemplar: EXEMPLAR })
      reps.push({
        replay,
        isReplay: replay > REPLAY_OVERLAP_THRESHOLD,
        media: meanOfScore(score),
        degen: degen.degen, degenMatch: degen.match,
        promptTokens: usage.promptTokens ?? 0, completionTokens: usage.completionTokens ?? 0,
        cost: cost(usage, MODEL.price),
        text,
      })
      log(`  replay=${replay.toFixed(2)}${replay > REPLAY_OVERLAP_THRESHOLD ? ' (REPLAY)' : ''} media=${meanOfScore(score).toFixed(2)} degen=${degen.degen ? 'SIM' : 'não'} in=${usage.promptTokens} out=${usage.completionTokens}`)
    } catch (e) {
      log(`  ⚠ falhou: ${e.message} — pulando rep`)
    }
    await sleep(PACE_MS)
  }
  const n = reps.length
  const avg = (f) => (n ? reps.reduce((a, r) => a + f(r), 0) / n : 0)
  rows.push({
    label: arm.label, n,
    turnStateChars: arm.turnState.length,
    systemChars: arm.system.length,
    replay: avg((r) => r.replay),
    replayRate: n ? reps.filter((r) => r.isReplay).length / n : 0,
    media: avg((r) => r.media),
    degenRate: n ? reps.filter((r) => r.degen).length / n : 0,
    degenMatches: [...new Set(reps.filter((r) => r.degen).map((r) => r.degenMatch))],
    inTok: avg((r) => r.promptTokens), outTok: avg((r) => r.completionTokens),
    cost: avg((r) => r.cost),
    sample: reps[0]?.text ?? '(sem rep válida)',
  })
}

const fmt = (x, d = 2) => Number(x).toFixed(d)
const header = '| braço | system chars | turn-state chars | replay (méd) | replay rate | MÉDIA rubrica | degen rate | in tok | out tok | $/resp |'
const sep = '|---|---|---|---|---|---|---|---|---|---|'
const body = rows
  .map((r) => `| ${r.label} | ${r.systemChars} | ${r.turnStateChars} | ${fmt(r.replay)} | ${(r.replayRate * 100).toFixed(0)}% | ${fmt(r.media)} | ${(r.degenRate * 100).toFixed(0)}% | ${Math.round(r.inTok)} | ${Math.round(r.outTok)} | $${fmt(r.cost, 5)} |`)
  .join('\n')
const samples = rows.map((r) => `### ${r.label} — replay ${fmt(r.replay)} · média ${fmt(r.media)}\n\n"""\n${r.sample}\n"""`).join('\n\n')

const md = `# A/B da localização do AI DM (US-71) — ${new Date().toISOString().slice(0, 19)}

Mesmo modelo (\`${MODEL.slug}\`, effort ${MODEL.effort}), mesma cena de REPLAY (Anetra já na forja de Hélio, turno 2 só continua a conversa). ${REPS} reps/braço · juiz \`${process.env.JUDGE_MODEL ?? 'gemini-3.1-flash-lite'}\`.
\`replay\` = overlapRatio(narração nova, narração do turno 1); limiar de replay = ${REPLAY_OVERLAP_THRESHOLD}. \`in tok\` = tokens de ENTRADA reais.
Sucesso: NOVO com replay menor, in tok menor e MÉDIA rubrica ≥ ANTIGO.

${header}
${sep}
${body}

## Amostras (rep 1)

${samples}
`

console.log(`\n${md}`)
const dir = resolve(dirname(fileURLToPath(import.meta.url)), '../../evals/reports')
mkdirSync(dir, { recursive: true })
const path = resolve(dir, `location-ab-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.md`)
writeFileSync(path, md, 'utf8')
log(`relatório: ${path}`)
