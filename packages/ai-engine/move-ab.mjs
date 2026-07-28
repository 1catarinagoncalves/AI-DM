// A/B do FIX de deslocamento (emenda de 2026-07-28 à continuityLine da US-71).
//
// Reproduz o turno que falhou em sessão local: a personagem está num local (cena com
// `local` → a continuityLine é emitida), o turno anterior encerrou ali, e o jogador
// escolhe VOLTAR para um lugar já visitado e falar com um NPC conhecido — trajeto +
// chegada + cumprimento, as três coisas que a linha proibia re-narrar.
//
// Mede o sinal DURO, não a prosa: o Mestre chamou `updateScene` mudando o `local`?
// Foi exatamente isso que faltou em produção (`steps=1`, nenhuma tool, `finishReason=stop`).
// ANTIGO = continuityLine sem as duas frases da emenda (recortadas do próprio texto atual,
// para o diff ser só elas). NOVO = o builder do dist.
//
// Rodar (na pasta packages/ai-engine):
//   npx dotenv-cli -e ../../.env -- node move-ab.mjs
//   (REPS=5 default)
import { generateText, tool } from 'ai'
import { z } from 'zod'
import { buildDmSystemPrompt, buildTurnStateBlock, resolveModel } from './dist/index.js'

const REPS = Math.max(1, Number(process.env.REPS ?? 5))
const MODEL = 'deepseek/deepseek-v4-flash' // narrationModels[0], igual à produção
const PACE_MS = 1500
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const t = () => new Date().toISOString().slice(11, 19)
const log = (...a) => console.log(`[${t()}]`, ...a)

const LOCAL = 'Círculo dos Sussurros, serra acima de Pedra do Norte'

const CHARACTER = {
  systemName: 'D&D 5e', characterName: 'Nyra Alvecinza', characterGender: 'feminino',
  characterClass: 'maga', characterRace: 'humana',
  sheet: { level: 3, hp: 18, maxHp: 18, attributes: { intelligence: 16, dexterity: 14, constitution: 12 }, conditions: [] },
}
const SYSTEM = buildDmSystemPrompt(CHARACTER)

const TURN_STATE_NEW = buildTurnStateBlock({
  sheet: CHARACTER.sheet,
  sceneState: { local: LOCAL, ambiente: 'externo', periodo: 'tarde', presentes: [], objetos_em_cena: ['disco de cobre opaco', 'cinco monólitos'] },
  entities: [
    { nome: 'Pedra do Norte', tipo: 'local', nota: 'vila costeira ao pé da serra; ponto de partida', atualizadoEm: '' },
    { nome: 'Mateus', tipo: 'npc', local: 'Pedra do Norte', estado: 'aliado', nota: 'zelador do farol; deu o diário de Mira', atualizadoEm: '' },
  ],
  mainQuest: 'Descobrir o que Mira Blackwood selou no farol',
  activeQuests: [],
  inventory: ['Cajado com cristal azul', 'Diário de Mira'],
})

// ANTIGO = o texto de hoje MENOS a emenda. Recorte ancorado na 1ª frase adicionada:
// se o builder mudar de forma, o script falha alto em vez de comparar prompt errado.
const EMENDA_INICIO = " When the player's action IS that move"
const corte = TURN_STATE_NEW.indexOf(EMENDA_INICIO)
if (corte === -1) throw new Error(`emenda não encontrada no turn-state (âncora: "${EMENDA_INICIO}") — o builder mudou; ajuste o recorte`)
const fimDaLinha = TURN_STATE_NEW.indexOf('\n', corte)
const TURN_STATE_OLD = TURN_STATE_NEW.slice(0, corte) + TURN_STATE_NEW.slice(fimDaLinha)

const NARRACAO_ANTERIOR = `A visão se desfaz. Você está de volta ao Círculo dos Sussurros, de joelhos na grama seca. O disco de cobre está opaco, cinza, morto — a luz azul agora vive dentro do seu cristal, pulsando no ritmo do seu coração.

Dentro dele, três presenças: o sopro (a chama do farol), a carne (algo úmido e salgado, nas entranhas da terra) e a pedra (imóvel, em algum lugar na serra).

- 🕯️ Seguir o farol — voltar para a vila e contar a Mateus o que descobriu.
- 💧 Descer às profundezas — encontrar a entrada da caverna.
- 🪨 Subir ao pico — alcançar o guardião de pedra.`

const ACAO = 'Seguir o farol — voltar para a vila e contar a Mateus o que descobriu.'

// Tools mínimas: só precisam REGISTRAR a chamada. O alvo é `updateScene`; as outras
// existem para não empurrar o modelo a usar updateScene por falta de alternativa.
function makeTools(chamadas) {
  const reg = (nome) => (args) => { chamadas.push({ nome, args }); return { ok: true, ...args } }
  return {
    updateScene: tool({
      description: 'Atualiza a cena (local / presentes / período) ANTES de narrar a mudança.',
      parameters: z.object({
        local: z.string().optional(), periodo: z.string().optional(),
        presentes: z.array(z.string()).optional(), objetos_em_cena: z.array(z.string()).optional(),
      }),
      execute: async (a) => reg('updateScene')(a),
    }),
    recordEntity: tool({
      description: 'Registra ou atualiza uma entidade durável do mundo.',
      parameters: z.object({ entidades: z.array(z.object({ nome: z.string(), tipo: z.string().optional(), local: z.string().optional(), estado: z.string().optional(), nota: z.string().optional() })) }),
      execute: async (a) => reg('recordEntity')(a),
    }),
    rollDice: tool({
      description: 'Rola dados. Passe `skill` ou `ability`; nunca o modificador.',
      parameters: z.object({ formula: z.string(), reason: z.string(), skill: z.string().optional(), ability: z.string().optional() }),
      execute: async (a) => { reg('rollDice')(a); return { ...a, rolls: [12], modifier: 3, total: 15 } },
    }),
  }
}

async function umaRep(turnState) {
  const chamadas = []
  const res = await generateText({
    model: resolveModel(`openrouter:${MODEL}`),
    system: SYSTEM,
    messages: [
      { role: 'user', content: 'Encostar o cristal no disco — ativar a ligação entre as duas metades do selo.' },
      { role: 'assistant', content: NARRACAO_ANTERIOR },
      { role: 'user', content: `${turnState}\n\n${ACAO}` },
    ],
    tools: makeTools(chamadas),
    maxSteps: 5,
    maxTokens: 4000,
    presencePenalty: 0.3, // paridade com a produção de hoje (US-69, troca de 2026-07-24)
    providerOptions: { openrouter: { reasoning: { effort: 'high', exclude: true } } },
    maxRetries: 1,
    abortSignal: AbortSignal.timeout(180_000),
  })

  const cena = chamadas.filter((c) => c.nome === 'updateScene')
  const localNovo = cena.map((c) => c.args.local).filter(Boolean).join(' | ')
  // Moveu = chamou updateScene com um `local` que NÃO é mais o Círculo.
  const moveu = !!localNovo && !/c[íi]rculo dos sussurros/i.test(localNovo)
  const texto = res.text ?? ''
  return {
    moveu,
    localNovo: localNovo || '—',
    steps: res.steps?.length ?? 1,
    tools: chamadas.map((c) => c.nome).join(',') || 'nenhuma',
    citaVila: /pedra do norte|a vila\b/i.test(texto) && /mateus/i.test(texto),
    chars: texto.length,
    texto,
  }
}

const RODADAS = [
  { label: 'ANTIGO (sem a emenda)', ts: TURN_STATE_OLD },
  { label: 'NOVO   (com a emenda)', ts: TURN_STATE_NEW },
]

const resultado = []
for (const r of RODADAS) {
  const reps = []
  for (let i = 0; i < REPS; i++) {
    try {
      const rep = await umaRep(r.ts)
      log(`${r.label} rep ${i + 1}/${REPS}: updateScene=${rep.moveu ? 'SIM' : 'não'} prosaViajou=${rep.citaVila ? 'SIM' : 'não'} steps=${rep.steps} tools=[${rep.tools}]`)
      reps.push(rep)
    } catch (err) {
      log(`${r.label} rep ${i + 1}/${REPS}: ERRO ${err?.message ?? err}`)
    }
    await sleep(PACE_MS)
  }
  resultado.push({ label: r.label, reps })
}

console.log('\n══════ RESULTADO ══════')
for (const { label, reps } of resultado) {
  if (reps.length === 0) { console.log(`${label}: nenhuma rep válida`); continue }
  const moveu = reps.filter((r) => r.moveu).length
  const citou = reps.filter((r) => r.citaVila).length
  const stepsMedio = (reps.reduce((s, r) => s + r.steps, 0) / reps.length).toFixed(1)
  console.log(`${label}: moveu ${moveu}/${reps.length} | prosa chega à vila e cita Mateus ${citou}/${reps.length} | steps médio ${stepsMedio}`)
}
console.log('\n── amostra da 1ª rep de cada braço ──')
for (const { label, reps } of resultado) {
  if (reps[0]) console.log(`\n### ${label}\n${reps[0].texto.slice(0, 700)}…`)
}
