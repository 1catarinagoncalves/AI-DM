// SPIKE 1 — Motor de aventuras autorais (mundo-primeiro), abordagem C da
// docs/arquitetura-motor-aventuras-autorais.md.
//
// Pergunta: um passo de AUTORIA (modelo autora o mundo primeiro, tabelas fora)
// produz aventura no nível de O Olho de Iremet — mundo bespoke, 3 facções
// concorrentes, arco de 3 beats, fecho ramificado sem herói, 4 sessões, tabela
// d8 — para um personagem solo, em pt-BR? A que custo?
//
// Mede, por MODELO (forte de produção × barato utilitário US-114):
//   (a) score do juiz (US-36 judgeModel) nos TRÊS defeitos nomeados pela
//       mantenedora: mundo autoral, estrutura, prosa — 1..5 cada, contra
//       O Olho de Iremet como barra 5/5.
//   (b) tokens/custo por aventura.
//   (c) a aventura renderizada, pra julgar a olho contra o artefato.
//
// NÃO faz: schema/gate (US-144/150, fora do spike), encontros com orçamento 5e
// (passo 7, determinístico, fica). Testa só o TETO de autoria (passos 1-6 numa
// única chamada — a forma mais barata da inversão; a cadeia mundo→facções→… é a
// versão de produção). Se um call só já chega em Khemsar, encadear é ganho.
//
// Rodar (na pasta packages/ai-engine, com dist buildado):
//   pnpm --filter @ai-dm/ai-engine build
//   npx dotenv-cli -e ../../.env -- node adventure-authoring-spike.mjs
//   (REPS=2 JUDGE=0 pra pular o juiz e só gerar; default REPS=1, juiz ligado)
import { generateText } from 'ai'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveModel, judgeModel } from './dist/index.js'

const t = () => new Date().toISOString().slice(11, 19)
const log = (...a) => console.log(`[${t()}]`, ...a)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const REPS = Math.max(1, Number(process.env.REPS ?? 1))
const DO_JUDGE = process.env.JUDGE !== '0'
const REQ_TIMEOUT_MS = 240_000
const PACE_MS = Number(process.env.PACE_MS ?? 2000)

// Bake-off de modelos (2026-09-09, 2ª rodada). Preços reais em $/M puxados do
// GET /api/v1/models do OpenRouter na mesma data. providerOptions universal
// reasoning:{enabled:false}: não vaza raciocínio na prosa e evita o corpo-vazio
// do qwen em generateText (model.ts:extractionModel). Slug inválido → erro
// capturado por rep, vira n=0 na tabela (não derruba a rodada).
const PO = { openrouter: { reasoning: { enabled: false } } }
// 2026-09-10: deepseek-v4-pro será descontinuado — testa v4.1-flash como substituto
// contra o pro (a barra de texto que a mantenedora aprovou na rodada anterior).
const ARMS = [
  { label: 'v4.1-flash (candidato)', slug: 'openrouter:deepseek/deepseek-v4.1-flash', providerOptions: PO, price: { in: 0.150, out: 0.600 } },
  { label: 'v4-pro (barra, saindo)', slug: 'openrouter:deepseek/deepseek-v4-pro', providerOptions: PO, price: { in: 0.955, out: 1.911 } },
]

// Perfil pinado: solo, pt-BR. Nível 3 (one-shot de 4 sessões precisa de mais que nível 1;
// nível é knob do spike, não afeta qualidade de autoria). Background com bonds/flaws/deity
// pra dar gancho — mas a inversão NÃO deriva a aventura do personagem (defeito não marcado),
// o perfil é contexto, não espinha.
const PROFILE = {
  nome: 'Ravi Saltapenha',
  classe: 'ladino (rogue)',
  nivel: 3,
  background: {
    historia: 'Cresceu batendo carteira nos cais de uma cidade portuária afundada em dívidas com uma guilda de agiotas. Fugiu quando a guilda cobrou o pai dele com juros de sangue.',
    bonds: ['Deve a vida a uma velha trapaceira que o escondeu da guilda', 'Guarda a última carta que o pai escreveu antes de sumir'],
    flaws: ['Não resiste a um cofre trancado', 'Confia rápido demais em quem também foi traído'],
    deity: { name: 'Vhael, a Mão Torta', portfolio: 'sorte, ladrões, barganhas justas entre desiguais' },
  },
}

// Alvo estético: os pontos fortes de O Olho de Iremet, usados como barra 5/5 do juiz
// e como referência do prompt de autoria (o QUE é "bom", não o conteúdo a copiar).
const EXEMPLAR_BAR = `Referência de qualidade (O Olho de Iremet — barra 5/5):
- MUNDO AUTORAL: um mundo inventado, específico e nomeado (ex.: "Khemsar, o Mar de Areia" — uma cidade erguida sobre a caixa torácica fossilizada de um colosso), não um rótulo genérico ("uma cidade no deserto").
- ESTRUTURA: 3 facções com desejos concorrentes e uma tensão de 3 vias; arco de 3 beats (conflito → jornada → resolução); fecho RAMIFICADO sem herói claro (cada escolha tem um custo, nenhuma é "a certa"); 4 sessões, cada uma fechando num gancho pra próxima; uma tabela d8 de perigo/pista/tesouro.
- PROSA: densa e evocativa, com detalhe sensorial concreto, não descrição funcional.`

function authoringPrompt() {
  const p = PROFILE
  return `Você é um designer de aventuras de RPG de mesa (D&D 5e), no nível de um módulo publicado. Escreva uma aventura one-shot ORIGINAL e AUTORAL para UM único personagem, em português do Brasil.

PERSONAGEM (contexto, não amarra a trama — a aventura não precisa girar em torno dele):
- ${p.nome}, ${p.classe}, nível ${p.nivel}.
- História: ${p.background.historia}
- Vínculos: ${p.background.bonds.join('; ')}
- Fraquezas: ${p.background.flaws.join('; ')}
- Divindade: ${p.background.deity.name} (${p.background.deity.portfolio})

${EXEMPLAR_BAR}

INVENTE UM MUNDO NOVO — não use cenários de prateleira (nada de Costa da Espada, Faerûn, etc.). O mundo é seu, específico e nomeado.

Estruture a saída EXATAMENTE nestas seções, em markdown:
## O Mundo
Nome do mundo/lugar e 2-3 parágrafos de worldbuilding evocativo. Uma localidade-âncora nomeada.
## As Facções
Exatamente 3, cada uma com nome, tipo (poder legítimo / submundo / culto / etc.) e o que QUER — os três desejos devem colidir.
## O Enredo
Arco de 3 beats: Conflito, Jornada, Resolução. A Resolução é RAMIFICADA: 3 escolhas finais, cada uma com sua consequência, nenhuma é a "certa".
## Estrutura de 4 Sessões
Um ato por sessão; cada sessão fecha num gancho pra próxima.
## Locais e NPCs
~4 locais e ~5 NPCs. Cada NPC pertence a uma facção e tem um desejo. Inclua a FALA de abertura de pelo menos 2 NPCs (as palavras exatas).
## Segredos e Pistas
~6 segredos/pistas, cada um ancorado num local ou facção nomeados acima.
## Areias e Perigos (Tabela d8)
Uma tabela d8, cada entrada marcada [PERIGO], [PISTA] ou [TESOURO].

Prosa densa e sensorial. Nada de placeholders.`
}

// Juiz: US-36 judgeModel (Gemini). Pontua os TRÊS defeitos, 1..5, contra a barra do exemplar.
async function judgeAdventure(adventure) {
  const judge = judgeModel()
  const prompt = `Você é um avaliador crítico de aventuras de RPG. ${EXEMPLAR_BAR}

Avalie a AVENTURA abaixo em três eixos, nota INTEIRA de 1 a 5 (5 = no nível da referência):
- MUNDO_AUTORAL: o mundo é inventado, específico e nomeado, ou genérico/de prateleira?
- ESTRUTURA: tem 3 facções concorrentes, arco de 3 beats, fecho ramificado sem herói, 4 sessões e tabela d8 — de verdade, não só de nome?
- PROSA: densa, evocativa, sensorial — ou funcional e sem alma?

Seja severo. Responda SÓ com uma linha exatamente neste formato, nada mais:
MUNDO_AUTORAL=<n> ESTRUTURA=<n> PROSA=<n>

AVENTURA:
${adventure}`
  const res = await generateText({ model: judge, prompt, maxTokens: 60, maxRetries: 1, abortSignal: AbortSignal.timeout(REQ_TIMEOUT_MS) })
  const m = res.text.match(/MUNDO_AUTORAL=(\d).*ESTRUTURA=(\d).*PROSA=(\d)/s)
  if (!m) return { mundo: null, estrutura: null, prosa: null, raw: res.text.trim() }
  return { mundo: +m[1], estrutura: +m[2], prosa: +m[3], raw: res.text.trim() }
}

const cost = (usage, price) => ((usage.promptTokens ?? 0) / 1e6) * price.in + ((usage.completionTokens ?? 0) / 1e6) * price.out

const rows = []
const samples = []
for (const arm of ARMS) {
  const reps = []
  for (let i = 0; i < REPS; i++) {
    try {
      log(`${arm.label} rep ${i + 1}/${REPS}…`)
      const res = await generateText({
        model: resolveModel(arm.slug),
        prompt: authoringPrompt(),
        maxTokens: 6000,
        providerOptions: arm.providerOptions,
        maxRetries: 1,
        abortSignal: AbortSignal.timeout(REQ_TIMEOUT_MS),
      })
      const text = res.text?.trim()
      if (!text) { log('  ⚠ saída vazia — pulando rep'); await sleep(PACE_MS); continue }
      let scores = { mundo: null, estrutura: null, prosa: null }
      if (DO_JUDGE) {
        try { scores = await judgeAdventure(text) } catch (e) { log(`  ⚠ juiz falhou: ${e.message}`) }
      }
      const c = cost(res.usage, arm.price)
      reps.push({ ...scores, inTok: res.usage?.promptTokens ?? 0, outTok: res.usage?.completionTokens ?? 0, cost: c, text })
      log(`  mundo=${scores.mundo ?? '-'} estrutura=${scores.estrutura ?? '-'} prosa=${scores.prosa ?? '-'} out=${res.usage?.completionTokens} $${c.toFixed(5)}`)
      if (i === 0) samples.push({ label: arm.label, scores, text })
    } catch (e) {
      log(`  ⚠ falhou: ${e.message} — pulando rep`)
    }
    await sleep(PACE_MS)
  }
  const n = reps.length
  const avg = (f) => (n ? reps.reduce((a, r) => a + (f(r) ?? 0), 0) / n : 0)
  rows.push({
    label: arm.label, n,
    mundo: avg((r) => r.mundo), estrutura: avg((r) => r.estrutura), prosa: avg((r) => r.prosa),
    inTok: avg((r) => r.inTok), outTok: avg((r) => r.outTok), cost: avg((r) => r.cost),
  })
}

const fmt = (x, d = 2) => Number(x).toFixed(d)
const header = '| modelo | n | mundo autoral | estrutura | prosa | in tok | out tok | $/aventura |'
const sep = '|---|---|---|---|---|---|---|---|'
const body = rows.map((r) => `| ${r.label} | ${r.n} | ${fmt(r.mundo)} | ${fmt(r.estrutura)} | ${fmt(r.prosa)} | ${Math.round(r.inTok)} | ${Math.round(r.outTok)} | $${fmt(r.cost, 5)} |`).join('\n')
const sampleMd = samples.map((s) => `### ${s.label} — mundo ${s.scores.mundo ?? '-'} · estrutura ${s.scores.estrutura ?? '-'} · prosa ${s.scores.prosa ?? '-'}\n\n${s.text}`).join('\n\n---\n\n')

const md = `# Spike 1 — Autoria de aventura mundo-primeiro — ${new Date().toISOString().slice(0, 19)}

Abordagem C (inversão) de \`docs/arquitetura-motor-aventuras-autorais.md\`. Uma chamada de autoria por rep, perfil solo pinado (${PROFILE.nome}, ${PROFILE.classe} nível ${PROFILE.nivel}), pt-BR. Juiz \`${process.env.JUDGE_MODEL ?? 'gemini-3.1-flash-lite'}\` pontua contra O Olho de Iremet (barra 5/5). ${REPS} rep(s)/modelo.

Regra de decisão (do doc): qualidade ≥ artefato e custo aceitável ⇒ commita a inversão, e a coluna forte×barato fixa o modelo de prosa. Ainda genérico ou caro ⇒ cai pro híbrido (abordagem B).

${header}
${sep}
${body}

## Amostras (rep 1)

${sampleMd}
`

console.log(`\n${md}`)
const dir = resolve(dirname(fileURLToPath(import.meta.url)), '../../evals/reports')
mkdirSync(dir, { recursive: true })
const path = resolve(dir, `adventure-authoring-spike-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.md`)
writeFileSync(path, md, 'utf8')
log(`relatório: ${path}`)
