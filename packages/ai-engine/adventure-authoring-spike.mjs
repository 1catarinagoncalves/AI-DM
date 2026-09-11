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
// 2026-09-10: geração no FORMATO NOVO (8 seções DnDGenerate + objective/challenges).
// Escada de prosa como resiliência (outage/rate-limit) — pro estável (EOL anunciado
// 10/09, cancelado 11/09). Pro primeiro (preferido); se vier vazio/erro, o rep pula e
// cai no próximo arm — mesma ordem da escada de model.ts.
const ARMS = [
  { label: 'v4-pro (preferido)', slug: 'openrouter:deepseek/deepseek-v4-pro', providerOptions: PO, price: { in: 0.955, out: 1.911 } },
  { label: 'v4-pro-0813 (fallback)', slug: 'openrouter:deepseek/deepseek-v4-pro-0813', providerOptions: PO, price: { in: 0.955, out: 1.911 } },
  { label: 'v4.1-flash (piso barato)', slug: 'openrouter:deepseek/deepseek-v4.1-flash', providerOptions: PO, price: { in: 0.150, out: 0.600 } },
]
const STOP_ON_FIRST = process.env.ALL_ARMS !== '1' // default: primeiro arm que gerar, para (escada). ALL_ARMS=1 roda todos.

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
- ESTRUTURA: 3 facções com desejos concorrentes movendo o enredo (tensão de 3 vias, mas dissolvidas na história e nos NPCs — NÃO listadas numa seção própria); um objetivo com recompensa; fecho RAMIFICADO sem herói claro (cada escolha tem um custo, nenhuma é "a certa"); desafios de não-combate presos a locais.
- PROSA: densa e evocativa, com detalhe sensorial concreto, não descrição funcional.`

function authoringPrompt() {
  const p = PROFILE
  return `Você é um designer de aventuras de RPG de mesa (D&D 5e), no nível de um módulo publicado. Escreva uma aventura one-shot ORIGINAL e AUTORAL para UM único personagem, em português do Brasil.

PERSONAGEM (SÓ tempero interno — a aventura NÃO gira em torno dele nem do passado dele):
- ${p.nome}, ${p.classe}, nível ${p.nivel}.
- Fraquezas/traços: ${p.background.flaws.join('; ')}
- Fé: ${p.background.deity.name} (${p.background.deity.portfolio})
(Primeira aventura: vínculos e história pregressa do personagem NÃO entram — não há passado jogado neste mundo. Use só fé e traços como cor interna, nunca como fatos do mundo.)

${EXEMPLAR_BAR}

INVENTE UM MUNDO NOVO — não use cenários de prateleira (nada de Costa da Espada, Faerûn, etc.). O mundo é seu, específico e nomeado.

PRIMEIRA AVENTURA — o personagem CHEGA NOVO a este mundo. É a primeira sessão dele: NÃO existe história prévia jogada. Portanto:
- NENHUM NPC já conhece o personagem, deve favores a ele, ou o reconhece. Todos são estranhos no início; qualquer vínculo se constrói DURANTE a aventura.
- NÃO pressuponha eventos anteriores como fato: dívidas antigas do personagem, inimigos que já o caçam, aliados do passado, parentes na trama, "o que você fez da última vez".
- NÃO use conhecimento prévio do jogador ("como você já sabe...", "o velho amigo de sempre"). Se algo precisa ser sabido, a aventura o REVELA em cena.
- O background acima é TEMPERO INTERNO (uma motivação, um medo, uma fé) — nunca uma teia de relações pré-existentes no mundo, nunca a espinha da trama. Ex.: a divindade pode colorir uma facção; um vínculo pode ecoar num tema — mas o NPC citado no vínculo NÃO aparece como personagem que já o conhece.
- NÃO ancore item, recompensa, lugar ou pista no passado específico do personagem ("o item que a velha do seu passado buscava", "a carta do seu pai"). A proveniência das coisas é do MUNDO, não da biografia dele.
- Follow-ups introduzem ganchos NOVOS do mundo; NÃO afirmam como fato dívidas, inimigos, guilda da terra natal ou parentes do personagem que "voltam a persegui-lo".
O enredo nasce de um gancho que qualquer forasteiro poderia receber ao chegar, não de um passado que o personagem já tem aqui.

MECÂNICA: NÃO escreva número mecânico na prosa — nada de CD, dano, HP, CA, bônus. Testes são nomeados QUALITATIVAMENTE por perícia/atributo do D&D 5e ("teste de Sabedoria (Percepção)", "teste de Força"), sem CD. Statblocks de inimigo NÃO se escrevem aqui (HP/CA vêm do sistema); descreva o inimigo e seu papel só em ficção.

INTERNO (não vira seção): invente 3 facções com desejos concorrentes que movem o enredo — mas dissolva-as na Story e nos NPCs, SEM uma seção "Facções". A alma vem dessa tensão implícita.

Estruture a saída EXATAMENTE nestas 8 seções, em markdown (nomes em inglês, conteúdo em pt-BR — é a taxonomia do formato):
## Setting
Nome do mundo/lugar e 2-3 parágrafos de worldbuilding evocativo, sensorial. Uma localidade-âncora nomeada.
## Story
O enredo: o que está errado, quem são as forças em jogo (as 3 facções aparecem AQUI, dissolvidas), e o gancho que puxa o personagem pra dentro.
## Objective
Descrição da meta; Recompensa (um item mágico nomeado, com efeito descrito em ficção, sem números); Localização (em qual local se resolve). A meta inclui uma escolha final RAMIFICADA (3 rumos, cada um com custo, nenhum "o certo").
## Locations
~6 locais nomeados, cada um com descrição sensorial curta e itens notáveis (se houver).
## Challenges
3 desafios de NÃO-COMBATE, cada um preso a um local nomeado acima: a situação + o teste nomeado (perícia/atributo, SEM CD) + a consequência da falha.
## Encounters
3 encontros de combate (inclua um Final), cada um com local, qual facção/inimigo ataca, e a SITUAÇÃO em ficção — sem statblock, sem números. O Final amarra a escolha ramificada do Objective.
## Follow Up Ideas
3 ganchos pós-aventura, um por rumo possível do fecho.
## NPCs
~5 NPCs. Cada um: papel, a que facção pertence e o que quer, descrição breve. Inclua a FALA de abertura (palavras exatas) de pelo menos 3 deles.

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
        maxTokens: 9000, // 8 seções + NPCs completos estouram 6000 (corte 10/09)
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
  if (STOP_ON_FIRST && n > 0) { log(`${arm.label} gerou — parando a escada (ALL_ARMS=1 pra rodar todos)`); break }
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
