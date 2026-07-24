// A/B do PROMPT do AI DM — mesmo modelo de PRODUÇÃO, dois system prompts.
//
// Compara o system prompt ANTIGO (snapshot em old-system.snapshot.txt, capturado
// ANTES da reescrita) contra o NOVO (buildDmSystemPrompt do dist), no MESMO modelo
// (deepseek-v4-flash, effort high — paridade com NARRATION_PROVIDER_OPTIONS) e na
// MESMA cena "ímã de nomes" da onomastica-bakeoff. Mede, por versão de prompt:
//   - onomástica (juiz LLM) e MÉDIA geral da rubrica
//   - taxa de slop de nome (detectSlopName)
//   - taxa de DEGENERAÇÃO (palavras coladas / n-grama repetido) — o alvo "anti-loop"
//   - tokens de ENTRADA reais (o prompt encolheu) e de saída, + custo
//
// Rodar (na pasta packages/ai-engine):
//   npx dotenv-cli -e ../../.env -- node prompt-ab-bakeoff.mjs
//   (JUDGE_REPS=4 default)
import { generateText } from 'ai'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildDmSystemPrompt, buildTurnStateBlock, resolveModel, judgeModel, judgeTurn,
  detectSlopName, meanOfScore,
  NARRATION_MAX_TOKENS, NARRATION_FREQUENCY_PENALTY,
} from './dist/index.js'

const t = () => new Date().toISOString().slice(11, 19)
const log = (...a) => console.log(`[${t()}]`, ...a)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const REPS = Math.max(1, Number(process.env.JUDGE_REPS ?? 4))
const REQ_TIMEOUT_MS = 180_000
const PACE_MS = Number(process.env.PACE_MS ?? 2000)

// Modelo de produção (narrationModels[0]) + preço OpenRouter. exclude:true = raciocínio
// gerado/cobrado mas não vaza na prosa, igual à produção.
const MODEL = { slug: 'deepseek/deepseek-v4-flash', effort: 'high', price: { in: 0.098, out: 0.196 } }

// Personagem de referência (aventura Seraphine) — mesma source of truth da produção.
const CHARACTER = {
  systemName: 'D&D 5e', characterName: 'Lady Seraphine Valthor', characterGender: 'feminino',
  characterClass: 'paladina', characterRace: 'humana',
  sheet: { level: 5, hp: 44, maxHp: 44, attributes: { strength: 16, wisdom: 14, charisma: 16 }, conditions: [] },
}
// NOVO prompt = builder atual do dist. ANTIGO = snapshot capturado antes da reescrita.
const SYSTEM_NEW = buildDmSystemPrompt(CHARACTER)
const SYSTEM_OLD = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'old-system.snapshot.txt'), 'utf8')

const PROMPTS = [
  { label: 'ANTIGO', system: SYSTEM_OLD },
  { label: 'NOVO', system: SYSTEM_NEW },
]

const TURN_STATE = buildTurnStateBlock({
  sheet: CHARACTER.sheet,
  activeQuests: ['Encontrar um barqueiro disposto a levá-la rio acima até o vilarejo isolado onde as crianças foram vistas pela última vez'],
  inventory: ['Espada longa Luz da Manhã', 'Escudo do Sol Dourado', 'Armadura de placas'],
})
// Ímã de onomástica: força cunhar vários nomes próprios num turno (o pior caso).
const PLAYER_ACTION = 'Entro na taverna mais movimentada do cais ao anoitecer e peço ao taberneiro que me indique — pelo nome — os três barqueiros capazes de me levar rio acima ainda esta noite, e que me diga, de cada um, o que devo saber antes de escolher.'
const INPUT = `${TURN_STATE}\n\n${PLAYER_ACTION}`

const SCENARIO_CONTEXT = 'Cena portuária de investigação: a paladina procura, numa taverna do cais, um barqueiro para subir o rio. O turno EXIGE nomear o taberneiro e três barqueiros distintos — teste de estresse de onomástica.'
const EXEMPLAR = {
  playerAction: PLAYER_ACTION,
  dmResponse:
    'O taberneiro — um homem de braços grossos e avental encardido que atende por Doran Mareto — limpa um caneco e inclina a cabeça para três figuras espalhadas pelo salão. — Barqueiro de verdade, disposto a subir o Rio Vermelha à noite? Só três, senhora. — Ele aponta o queixo. — Aquele de barba trançada é Ferro Bexiga; conhece cada banco de areia, mas cobra caro e bebe demais. A mulher de capa cinza no canto é Isolda Vau; silenciosa, honesta, mas perdeu o irmão nas águas altas e evita a foz do Corvo. E o rapaz nervoso perto do fogo é Teobo Rala; barato e afoito, bom demais para ser só sorte. Escolha com cuidado — o rio não perdoa pressa. O que você faz, Lady Seraphine?',
}

// ─── Detector de DEGENERAÇÃO (o alvo "anti-loop" da reescrita) ───────────────
// (1) palavra colada: minúscula seguida de maiúscula no MEIO de uma palavra
//     ("SoltaA flecha") — o bug da rule 7. (2) n-grama repetido: uma sequência de
//     5 palavras que reaparece idêntica = loop/repetição. Custo zero, determinístico.
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
const cost = (usage, price) =>
  (usage.promptTokens / 1e6) * price.in + (usage.completionTokens / 1e6) * price.out

async function genOnce(system) {
  const res = await generateText({
    model: resolveModel(`openrouter:${MODEL.slug}`),
    system,
    prompt: INPUT,
    maxTokens: NARRATION_MAX_TOKENS,
    frequencyPenalty: NARRATION_FREQUENCY_PENALTY,
    providerOptions: { openrouter: { reasoning: { effort: MODEL.effort, exclude: true } } },
    maxRetries: 1,
    abortSignal: AbortSignal.timeout(REQ_TIMEOUT_MS),
  })
  return { text: res.text, usage: res.usage }
}

const rows = []
for (const p of PROMPTS) {
  const reps = []
  for (let i = 0; i < REPS; i++) {
    try {
      log(`${p.label} rep ${i + 1}/${REPS}…`)
      const { text, usage } = await genOnce(p.system)
      if (!text || !text.trim()) { log('  ⚠ narração vazia — pulando rep'); await sleep(PACE_MS); continue }
      const slop = detectSlopName(text)
      const degen = detectDegeneration(text)
      const { score } = await judgeTurn({ judge, scenarioContext: SCENARIO_CONTEXT, playerAction: PLAYER_ACTION, narration: text, exemplar: EXEMPLAR })
      reps.push({
        onomastica: score.onomastica.nota,
        onomasticaWhy: score.onomastica.justificativa,
        media: meanOfScore(score),
        slop: slop.slop, slopMatch: slop.match,
        degen: degen.degen, degenMatch: degen.match,
        promptTokens: usage.promptTokens ?? 0, completionTokens: usage.completionTokens ?? 0,
        cost: cost(usage, MODEL.price),
        text,
      })
      log(`  onom=${score.onomastica.nota} media=${meanOfScore(score).toFixed(2)} slop=${slop.slop ? `SIM(${slop.match})` : 'não'} degen=${degen.degen ? 'SIM' : 'não'} in=${usage.promptTokens} out=${usage.completionTokens}`)
    } catch (e) {
      log(`  ⚠ falhou: ${e.message} — pulando rep`)
    }
    await sleep(PACE_MS)
  }
  const n = reps.length
  const avg = (f) => (n ? reps.reduce((a, r) => a + f(r), 0) / n : 0)
  rows.push({
    label: p.label, n,
    systemChars: p.system.length,
    onomastica: avg((r) => r.onomastica),
    media: avg((r) => r.media),
    slopRate: n ? reps.filter((r) => r.slop).length / n : 0,
    slopMatches: [...new Set(reps.filter((r) => r.slop).map((r) => r.slopMatch))],
    degenRate: n ? reps.filter((r) => r.degen).length / n : 0,
    degenMatches: [...new Set(reps.filter((r) => r.degen).map((r) => r.degenMatch))],
    inTok: avg((r) => r.promptTokens), outTok: avg((r) => r.completionTokens),
    cost: avg((r) => r.cost),
    sample: reps[0]?.text ?? '(sem rep válida)',
    onomasticaWhy: reps[0]?.onomasticaWhy ?? '',
  })
}

const fmt = (x, d = 2) => Number(x).toFixed(d)
const header = '| prompt | system chars | onomástica (méd) | MÉDIA geral | slop rate | degen rate | in tok | out tok | $/resp |'
const sep = '|---|---|---|---|---|---|---|---|---|'
const body = rows
  .map((r) => `| ${r.label} | ${r.systemChars} | ${fmt(r.onomastica)}/5 | ${fmt(r.media)} | ${(r.slopRate * 100).toFixed(0)}%${r.slopMatches.length ? ` (${r.slopMatches.join(',')})` : ''} | ${(r.degenRate * 100).toFixed(0)}% | ${Math.round(r.inTok)} | ${Math.round(r.outTok)} | $${fmt(r.cost, 5)} |`)
  .join('\n')
const samples = rows.map((r) => `### ${r.label} — onomástica ${fmt(r.onomastica)}/5\n_juiz (rep 1):_ ${r.onomasticaWhy}\n\n"""\n${r.sample}\n"""`).join('\n\n')

const md = `# A/B do prompt do AI DM — ${new Date().toISOString().slice(0, 19)}

Mesmo modelo (\`${MODEL.slug}\`, effort ${MODEL.effort}) e mesma cena "ímã de nomes". ${REPS} reps/prompt · juiz \`${process.env.JUDGE_MODEL ?? 'gemini-3.1-flash-lite'}\`.
Compara o system prompt ANTIGO (pré-reescrita) vs NOVO. \`in tok\` = tokens de ENTRADA reais (o corte do prompt).

${header}
${sep}
${body}

## Amostras (rep 1)

${samples}
`

console.log(`\n${md}`)
const dir = resolve(dirname(fileURLToPath(import.meta.url)), '../../evals/reports')
mkdirSync(dir, { recursive: true })
const path = resolve(dir, `prompt-ab-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.md`)
writeFileSync(path, md, 'utf8')
log(`relatório: ${path}`)
