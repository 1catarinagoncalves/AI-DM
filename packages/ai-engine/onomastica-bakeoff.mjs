// Bake-off de ONOMÁSTICA — 3 modelos OpenRouter, cena que força nomeação.
//
// Objetivo: comparar (a) o respeito à barra de onomástica da US-34/US-36 e (b) o
// CUSTO da resposta do AI DM (tokens reais × preço OpenRouter) entre 3 modelos.
//
// A cena é um "ímã de nomes": a jogadora pede ao taberneiro que apresente, PELO NOME,
// vários NPCs de uma vez — força o DM a cunhar 4–6 nomes próprios num único turno, o
// pior caso para onomástica. Mede: nota do juiz na dimensão `onomastica`, taxa de slop
// (detectSlopName, blocklist Elara/Kael/...) e custo $/resposta.
//
// Rodar:
//   npx dotenv-cli -e ../../.env -- node onomastica-bakeoff.mjs
//   (JUDGE_REPS=3 default; JUDGE_MODEL=... p/ trocar o juiz)
import { generateText } from 'ai'
import { mkdirSync, writeFileSync } from 'node:fs'
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

const REPS = Math.max(1, Number(process.env.JUDGE_REPS ?? 3))
const REQ_TIMEOUT_MS = 180_000
const PACE_MS = Number(process.env.PACE_MS ?? 2000)

// Os 3 modelos + effort de raciocínio pedido + preço OpenRouter ($/1M tokens,
// validado na /api/v1/models). exclude:true = raciocínio gerado (e COBRADO) mas não
// volta na prosa — igual à produção (NARRATION_PROVIDER_OPTIONS).
const MODELS = [
  { slug: 'deepseek/deepseek-v4-flash', label: 'deepseek-v4-flash (max)', effort: 'high', price: { in: 0.098, out: 0.196 } },
  { slug: 'x-ai/grok-4.3', label: 'grok-4.3 (medium)', effort: 'medium', price: { in: 1.25, out: 2.5 } },
  { slug: 'xiaomi/mimo-v2.5-pro', label: 'mimo-v2.5-pro', effort: null, price: { in: 0.435, out: 0.87 } },
]

// Personagem de referência (aventura Seraphine) — mesma source of truth da produção.
const CHARACTER = {
  systemName: 'D&D 5e', characterName: 'Lady Seraphine Valthor', characterGender: 'feminino',
  characterClass: 'paladina', characterRace: 'humana',
  sheet: { level: 5, hp: 44, maxHp: 44, attributes: { strength: 16, wisdom: 14, charisma: 16 }, conditions: [] },
}
const SYSTEM = buildDmSystemPrompt(CHARACTER)
// Estado do turno: quest que motiva a cena portuária (subir o rio até o vilarejo).
const TURN_STATE = buildTurnStateBlock({
  sheet: CHARACTER.sheet,
  activeQuests: ['Encontrar um barqueiro disposto a levá-la rio acima até o vilarejo isolado onde as crianças foram vistas pela última vez'],
  inventory: ['Espada longa Luz da Manhã', 'Escudo do Sol Dourado', 'Armadura de placas'],
})

// A AÇÃO — ímã de onomástica: força o DM a cunhar VÁRIOS nomes próprios de uma vez
// (o taberneiro, três barqueiros/contrabandistas, o rio, o porto), com registro certo.
const PLAYER_ACTION = 'Entro na taverna mais movimentada do cais ao anoitecer e peço ao taberneiro que me indique — pelo nome — os três barqueiros capazes de me levar rio acima ainda esta noite, e que me diga, de cada um, o que devo saber antes de escolher.'
const INPUT = `${TURN_STATE}\n\n${PLAYER_ACTION}`

const SCENARIO_CONTEXT = 'Cena portuária de investigação: a paladina procura, numa taverna do cais, um barqueiro para subir o rio. O turno EXIGE nomear o taberneiro e três barqueiros distintos — teste de estresse de onomástica.'

// Âncora "nota 5" de onomástica: nomes ORIGINAIS, registro fluvial/portuário, sem clichês.
const EXEMPLAR = {
  playerAction: PLAYER_ACTION,
  dmResponse:
    'O taberneiro — um homem de braços grossos e avental encardido que atende por Doran Mareto — limpa um caneco e inclina a cabeça para três figuras espalhadas pelo salão. — Barqueiro de verdade, disposto a subir o Rio Vermelha à noite? Só três, senhora. — Ele aponta o queixo. — Aquele de barba trançada é Ferro Bexiga; conhece cada banco de areia, mas cobra caro e bebe demais. A mulher de capa cinza no canto é Isolda Vau; silenciosa, honesta, mas perdeu o irmão nas águas altas e evita a foz do Corvo. E o rapaz nervoso perto do fogo é Teobo Rala; barato e afoito, bom demais para ser só sorte. Escolha com cuidado — o rio não perdoa pressa. O que você faz, Lady Seraphine?',
}

const judge = judgeModel()
const cost = (usage, price) =>
  (usage.promptTokens / 1e6) * price.in + (usage.completionTokens / 1e6) * price.out

async function genOnce(m) {
  const reasoning = m.effort ? { effort: m.effort, exclude: true } : { exclude: true }
  const res = await generateText({
    model: resolveModel(`openrouter:${m.slug}`),
    system: SYSTEM,
    prompt: INPUT,
    maxTokens: NARRATION_MAX_TOKENS,
    frequencyPenalty: NARRATION_FREQUENCY_PENALTY,
    providerOptions: { openrouter: { reasoning } },
    maxRetries: 1,
    abortSignal: AbortSignal.timeout(REQ_TIMEOUT_MS),
  })
  return { text: res.text, usage: res.usage }
}

const rows = []
for (const m of MODELS) {
  const reps = []
  for (let i = 0; i < REPS; i++) {
    try {
      log(`${m.label} rep ${i + 1}/${REPS}…`)
      const { text, usage } = await genOnce(m)
      if (!text || !text.trim()) { log(`  ⚠ narração vazia — pulando rep`); await sleep(PACE_MS); continue }
      const slop = detectSlopName(text)
      const { score } = await judgeTurn({ judge, scenarioContext: SCENARIO_CONTEXT, playerAction: PLAYER_ACTION, narration: text, exemplar: EXEMPLAR })
      reps.push({
        onomastica: score.onomastica.nota,
        onomasticaWhy: score.onomastica.justificativa,
        media: meanOfScore(score),
        slop: slop.slop, slopMatch: slop.match,
        promptTokens: usage.promptTokens ?? 0, completionTokens: usage.completionTokens ?? 0,
        cost: cost(usage, m.price),
        text,
      })
      log(`  onom=${score.onomastica.nota} media=${meanOfScore(score).toFixed(2)} slop=${slop.slop ? `SIM(${slop.match})` : 'não'} out=${usage.completionTokens}tok $${cost(usage, m.price).toFixed(5)}`)
    } catch (e) {
      log(`  ⚠ falhou: ${e.message} — pulando rep`)
    }
    await sleep(PACE_MS)
  }
  const n = reps.length
  const avg = (f) => (n ? reps.reduce((a, r) => a + f(r), 0) / n : 0)
  rows.push({
    label: m.label, n,
    onomastica: avg((r) => r.onomastica),
    media: avg((r) => r.media),
    slopRate: n ? reps.filter((r) => r.slop).length / n : 0,
    slopMatches: [...new Set(reps.filter((r) => r.slop).map((r) => r.slopMatch))],
    inTok: avg((r) => r.promptTokens), outTok: avg((r) => r.completionTokens),
    cost: avg((r) => r.cost),
    sample: reps[0]?.text ?? '(sem rep válida)',
    onomasticaWhy: reps[0]?.onomasticaWhy ?? '',
  })
}

// Relatório
const fmt = (x, d = 2) => Number(x).toFixed(d)
const header = `| modelo | onomástica (méd) | slop rate | MÉDIA geral | in tok | out tok | $/resposta |`
const sep = `|---|---|---|---|---|---|---|`
const body = rows
  .sort((a, b) => b.onomastica - a.onomastica)
  .map((r) => `| ${r.label} | ${fmt(r.onomastica)}/5 | ${(r.slopRate * 100).toFixed(0)}%${r.slopMatches.length ? ` (${r.slopMatches.join(',')})` : ''} | ${fmt(r.media)} | ${Math.round(r.inTok)} | ${Math.round(r.outTok)} | $${fmt(r.cost, 5)} |`)
  .join('\n')

const samples = rows.map((r) => `### ${r.label} — onomástica ${fmt(r.onomastica)}/5\n_juiz (rep 1):_ ${r.onomasticaWhy}\n\n"""\n${r.sample}\n"""`).join('\n\n')

const md = `# Bake-off de onomástica — ${new Date().toISOString().slice(0, 19)}

Cena "ímã de nomes" (taberneiro + 3 barqueiros num turno). ${REPS} reps/modelo · juiz \`${process.env.JUDGE_MODEL ?? 'gemini-3.1-flash-lite'}\`.
Custo = tokens reais × preço OpenRouter (raciocínio COBRADO conta na saída, como a produção).

${header}
${sep}
${body}

## Amostras (rep 1)

${samples}
`

console.log(`\n${md}`)
const dir = resolve(dirname(fileURLToPath(import.meta.url)), '../../evals/reports')
mkdirSync(dir, { recursive: true })
const path = resolve(dir, `onomastica-bakeoff-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.md`)
writeFileSync(path, md, 'utf8')
log(`relatório: ${path}`)
