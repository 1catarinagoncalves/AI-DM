import { describe, it, expect } from 'vitest'
import { execSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildDmSystemPrompt,
  buildTurnStateBlock,
  buildOpeningInstruction,
  narrationModels,
  detectSlopName,
  generateNarration,
  NARRATION_MAX_TOKENS,
  NARRATION_FREQUENCY_PENALTY,
  judgeModel,
  judgeTurn,
  meanOfScore,
  aggregateReps,
  gateQuality,
  DIMENSION_FLOORS,
  SLOP_RATE_MAX,
  renderQualityReport,
  QUALITY_THRESHOLD,
  type Exemplar,
  type RubricScore,
  type QualityEntry,
  type QualityRunMeta,
} from '@ai-dm/ai-engine'

// US-36 + US-70 — EVAL DE QUALIDADE DA NARRAÇÃO (LLM-as-judge), com DENTE.
//
// Rede de segurança contra REGRESSÃO SILENCIOSA da narração: gera pela MESMA escada
// de produção (buildDmSystemPrompt + narrationModels[0] + provider options +
// maxTokens/frequencyPenalty iguais aos de ai.service.ts) e pontua a prosa pela
// rubrica (DIMENSIONS de rubric.ts, espelho da barra de ofício da US-34) com o juiz
// externo (Gemini).
//
// A US-70 fecha dois furos que a US-36 deixou abertos:
//   - Furo 1: a MÉDIA de 11 dimensões DILUI uma queda cirúrgica (só onomástica, só
//     sensorial). Degradar a barra ainda tirava média 4.45. → PISO POR DIMENSÃO
//     (DIMENSION_FLOORS): um eixo-chave abaixo do piso reprova mesmo com média alta.
//   - Furo 2: slop de onomástica é INTERMITENTE (~3/4 samples). Gate de 1 tiro = flaky.
//     → N REPETIÇÕES + TAXA: roda JUDGE_REPS vezes, agrega, e gateia slop por slopRate.
//
// O gate agora é `gateQuality({ perDim, media, slopRate })` — a MESMA função pura que
// o `pnpm test` prova em rubric.test.ts sem API. Aqui ela recebe a AGREGAÇÃO das reps.
//
// Gated por chave: precisa de OPENROUTER_API_KEY (narração) e GEMINI_API_KEY (juiz).
// Sem elas o caso é PULADO. Custo: JUDGE_REPS × nº de casos × (1 geração + 1 juiz) +
// o anchor set. Use JUDGE_REPS=1 no smoke local; 3 (default) no CI.
//   Rodar só estes casos:  pnpm eval us-36

// Repetições por caso (US-70) — como o bake-off. Média de N reps mata a flakiness
// do gate de piso; a taxa de slop suaviza a intermitência. Default 3; 1 no smoke.
const REPS = Math.max(1, Number(process.env['JUDGE_REPS'] ?? 3))

// Margem mínima que o juiz deve abrir entre narrações "boas" e "ruins" no anchor set.
// Calibrada com folga: um juiz que discrimina abre >1 ponto; <0.75 sinaliza deriva.
const ANCHOR_MARGIN = 0.75

// Paladina de referência (aventura Seraphine) — mesma "source of truth" da produção.
const CHARACTER = {
  systemName: 'D&D 5e',
  characterName: 'Lady Seraphine Valthor',
  characterGender: 'feminino',
  characterClass: 'paladina',
  characterRace: 'humana',
  sheet: {
    level: 5,
    hp: 44,
    maxHp: 44,
    attributes: { strength: 16, wisdom: 14, charisma: 16 },
    conditions: [],
  },
} as const

// Personagem de sistema FREE (US-70): sem regras oficiais — exercita o ramo `isFree`
// do prompt (foco em narrativa/agência, rollDice ainda obrigatório para o acaso).
const FREE_CHARACTER = {
  systemName: 'Free',
  characterName: 'Corvo',
  characterGender: 'masculino',
  characterClass: 'andarilho',
  characterRace: 'humano',
  sheet: { level: 1, hp: 10, maxHp: 10, attributes: { corpo: 12, mente: 14, espirito: 13 }, conditions: [] },
} as const

// Personagem de fala INGLESA (US-70): o DM narra "na língua que o jogador usa"
// (dm-system.ts), então um turno em inglês só sai em inglês com contexto inglês —
// uma única frase EN contra system+personagem pt-BR não vira a língua. Cena de
// EXPLORAÇÃO (baixa nomeação) de propósito: testa `língua pt-BR` = n/a sem virar
// ímã de onomástica/slop.
const EN_CHARACTER = {
  systemName: 'D&D 5e',
  characterName: 'Ser Aldwin Marsh',
  characterGender: 'masculino',
  characterClass: 'ranger',
  characterRace: 'human',
  sheet: { level: 4, hp: 34, maxHp: 34, attributes: { dexterity: 16, wisdom: 15, constitution: 14 }, conditions: [] },
} as const

const SYSTEM = buildDmSystemPrompt(CHARACTER)
const FREE_SYSTEM = buildDmSystemPrompt(FREE_CHARACTER)
const EN_SYSTEM = buildDmSystemPrompt(EN_CHARACTER)

const TURN_STATE = buildTurnStateBlock({
  sheet: CHARACTER.sheet,
  activeQuests: ['Investigar o desaparecimento das crianças de Eldridge'],
  inventory: ['Espada longa Luz da Manhã', 'Escudo do Sol Dourado', 'Armadura de placas'],
})
// Mesmo personagem à beira da morte (US-70): exercita TOM/STAKES em baixo HP.
const LOW_HP_TURN_STATE = buildTurnStateBlock({
  sheet: { ...CHARACTER.sheet, hp: 6, conditions: ['sangrando'] },
  activeQuests: ['Investigar o desaparecimento das crianças de Eldridge'],
  inventory: ['Espada longa Luz da Manhã', 'Escudo do Sol Dourado', 'Armadura de placas'],
})

// Exemplares "nota 5" (âncoras de calibração), da aventura de referência.
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
const EX_LOWHP: Exemplar = {
  playerAction: 'Cambaleio, ferida, e tento me manter de pé diante da última sombra.',
  dmResponse:
    'O gosto de ferro na boca, o flanco pulsando quente a cada batida do coração. Você crava a ponta de Luz da Manhã no chão de pedra e se apoia nela para não cair — a lâmina treme junto com a sua mão. A sombra não avança; espera, uma mancha de escuro mais densa que a caverna, como se soubesse que o tempo joga a favor dela. Sua respiração ecoa curta demais entre as paredes úmidas. Um passo em falso e você não se levanta de novo. O que você faz?',
}
const EX_CHILD: Exemplar = {
  playerAction: 'Ajoelho diante da menina resgatada e pergunto com doçura o que aconteceu.',
  dmResponse:
    'A menina se encolhe contra a parede, os joelhos sujos abraçados ao peito, e só depois de um longo instante ergue os olhos para os seus. — Elas... elas cantavam — ela sussurra, a voz fina tremendo. — Baixinho, na janela. E a gente ficava com sono. O Tomé foi primeiro. Ela aperta na mão um botão de latão, arrancado de algum casaco. — A senhora vai trazer ele de volta? Os olhos dela procuram os seus, à espera. O que você faz?',
}
const EX_FREE: Exemplar = {
  playerAction: 'Sigo a trilha de fumaça até a clareira.',
  dmResponse:
    'A fumaça te guia por entre os troncos até uma clareira onde o fogo já morreu, deixando só brasas e um cheiro acre de couro queimado. Um acampamento desfeito às pressas: uma panela virada, pegadas fundas indo para o norte, e — pregado numa árvore com uma faca — um pedaço de pano com um símbolo que você não reconhece, três círculos dentro de um. O vento move as folhas e nada mais. O que você faz, Corvo?',
}
const EX_EN: Exemplar = {
  playerAction: '[opening] I reach the flooded ruins of the old watchtower at dusk.',
  dmResponse:
    "Rain hisses on the black stones as you wade the last stretch of marsh, the ruined watchtower leaning against a bruised sky. Water has swallowed its lower hall; your boots find the drowned steps by feel, and something pale drifts just under the surface — a scout's cloak, tangled in the reeds, its clasp still bright. The air smells of rust and old smoke. Above, a single window still holds glass, and behind it, for just a breath, a light moves that is not your own. Your bowstring is already damp against your fingers. What do you do, Ser Aldwin?",
}

// Casos: abertura + turno de diálogo (US-36) e os novos da US-70 — baixo HP, NPC
// vulnerável, turno em inglês (língua pt-BR = n/a) e sistema Free. Todos de NARRAÇÃO PURA
// (sem rolagem): combate/dados ficaram fora — o eval julga a prosa, não a trajetória de
// tool calling (isso é a US-08/09). O prompt de cada caso é o caminho REAL de produção.
interface Case {
  id: string
  scenarioContext: string
  /** ação do jogador / instrução que dispara a narração. */
  input: string
  exemplar: Exemplar
  /** system prompt do caso (default = Seraphine/D&D). O caso Free troca por FREE_SYSTEM. */
  system?: string
  locale?: string
}

const OPENING_INPUT = buildOpeningInstruction({
  characterName: CHARACTER.characterName,
  hookSeed: 'Uma paladina chega a uma vila isolada ao anoitecer, sob chuva; as crianças estão desaparecendo.',
})

const CASES: Case[] = [
  {
    id: 'abertura',
    scenarioContext: 'Turno de abertura: primeira cena da aventura, gerada pelo DM (US-34).',
    input: OPENING_INPUT,
    exemplar: EX_OPENING,
  },
  {
    id: 'turno-dialogo',
    scenarioContext: 'A jogadora interroga um aldeão aterrorizado sobre o desaparecimento das crianças e do padre.',
    input: `${TURN_STATE}\n\nAjoelho perto do velho e pergunto, com calma: quantas crianças foram levadas? Como são essas criaturas? O que aconteceu com o padre?`,
    exemplar: EX_DIALOGUE,
  },
  {
    id: 'baixo-hp',
    scenarioContext: 'A paladina está à beira da morte (6/44, sangrando); o tom precisa carregar as stakes.',
    input: `${LOW_HP_TURN_STATE}\n\nCambaleio, a mão apertando a ferida no flanco, e me apoio na espada para não cair diante da última sombra.`,
    exemplar: EX_LOWHP,
  },
  {
    id: 'npc-vulneravel',
    scenarioContext: 'A jogadora conforta uma criança recém-resgatada e traumatizada — voz de NPC vulnerável.',
    input: `${TURN_STATE}\n\nAjoelho diante da menina que encontramos trancada no porão e pergunto, com doçura, o que aconteceu com ela.`,
    exemplar: EX_CHILD,
  },
  {
    id: 'turno-ingles',
    // O JOGADOR narra em inglês → o juiz marca "Língua pt-BR" como n/a (não penaliza a
    // escolha de língua). Cena de EXPLORAÇÃO (baixa nomeação) para não virar ímã de slop.
    scenarioContext: 'The player narrates their action in English; "Língua pt-BR" must be n/a (not penalized).',
    input: `${buildTurnStateBlock({
      sheet: EN_CHARACTER.sheet,
      activeQuests: ['Find the scout who vanished near the old watchtower'],
      inventory: ['Longbow', 'Hunting knife', 'Rope'],
    })}\n\nI wade into the flooded lower hall of the ruined watchtower, bow in hand, and take in the drowned steps, the broken walls, and the pale shape tangled in the reeds ahead.`,
    exemplar: EX_EN,
    system: EN_SYSTEM,
    locale: 'en',
  },
  {
    id: 'sistema-free',
    scenarioContext: 'Sistema Free (sem regras oficiais): o andarilho investiga um acampamento abandonado.',
    input: `${buildTurnStateBlock({
      sheet: FREE_CHARACTER.sheet,
      activeQuests: ['Encontrar quem incendiou o vilarejo'],
      inventory: ['Faca de caça', 'Corda', 'Lampião'],
    })}\n\nSigo a trilha de fumaça até a clareira e paro diante do que o fogo deixou do acampamento.`,
    exemplar: EX_FREE,
    system: FREE_SYSTEM,
  },
]

// ─── Anchor set: valida que o JUIZ rankeia boa acima de ruim (US-70) ─────────
// Narrações rotuladas à mão. Se o juiz NÃO abrir margem entre "alta" e "baixa", o
// eval inteiro é ruído (deriva de slug/modelo, comportamento mudou). As "alta" reusam
// exemplares nota-5; as "baixa" concentram os anti-padrões da barra: voz de assistente,
// despejo de exposição, lista de opções crua, nome de slop, prosa lusitana/traduzida.
interface AnchorItem {
  narration: string
  expect: 'alta' | 'baixa'
}
const ANCHOR_CONTEXT = 'Turno de abertura de uma aventura de terror numa vila isolada; a jogadora acaba de chegar.'
const ANCHOR_ACTION = '[início] Chego à vila ao anoitecer, sob chuva.'
const ANCHOR_SET: AnchorItem[] = [
  { narration: EX_OPENING.dmResponse, expect: 'alta' },
  { narration: EX_DIALOGUE.dmResponse, expect: 'alta' },
  {
    // voz de assistente + meta-abertura + exposição seca
    narration:
      'Bem-vinda à aventura! Nesta cena, você chega a uma vila misteriosa onde as crianças estão desaparecendo. Há muitos perigos pela frente. Prepare-se para grandes desafios, aventureira! O que você gostaria de fazer agora?',
    expect: 'baixa',
  },
  {
    // despejo de exposição + nome de slop + lista de opções crua + sem sentidos
    narration:
      'Você entra na vila. Está chovendo. Há várias casas de madeira. Um homem chamado Elara se aproxima e explica que sete crianças foram levadas por monstros nas últimas noites e que o padre desapareceu. Opções: 1) Investigar a igreja. 2) Falar com os aldeões. 3) Ir embora.',
    expect: 'baixa',
  },
  {
    // prosa lusitana/traduzida + genérica, sem concretude
    narration:
      'Tu chegas à povoação e vês que algo está errado. As pessoas estão assustadas e escondem-se nas suas casas. Uma sombra malévola paira sobre o lugar. Estás perante um grande mistério que deverás resolver com coragem.',
    expect: 'baixa',
  },
]

/** git curto + branch (o sinal mais forte de "o que mudou"); nunca lança. */
function gitInfo(): { head: string; branch: string } {
  const run = (cmd: string) => {
    try {
      return execSync(cmd, { encoding: 'utf8' }).trim()
    } catch {
      return 'unknown'
    }
  }
  return { head: run('git rev-parse --short HEAD'), branch: run('git rev-parse --abbrev-ref HEAD') }
}

/** RubricScore sintético a partir de perDim agregado — para o relatório durável. A
 * justificativa carrega a média por eixo (o texto por-rep vive nos logs, não aqui). */
function aggregatedScore(perDim: Record<string, number>): RubricScore {
  return Object.fromEntries(
    Object.entries(perDim).map(([k, v]) => [k, { nota: v, justificativa: `média de ${REPS} reps` }]),
  ) as unknown as RubricScore
}

describe('US-36/US-70 — qualidade da narração (LLM-as-judge)', () => {
  const hasKeys = !!process.env['OPENROUTER_API_KEY'] && !!process.env['GEMINI_API_KEY']

  it.runIf(hasKeys)(
    'a narração gerada pela escada de produção passa no gate (média + piso por dimensão + taxa de slop)',
    async () => {
      const judge = judgeModel()
      const git = gitInfo()
      const entries: QualityEntry[] = []
      // Resultado do gate por caso (US-70): agrega N reps antes de decidir.
      const failures: string[] = []

      for (const c of CASES) {
        const reps: RubricScore[] = []
        let slopFails = 0
        let sample: Awaited<ReturnType<typeof generateNarration>> | null = null

        // N repetições: agrega para o gate; conta slop para a taxa (Furo 2). Uma rep
        // que falha (timeout/stall transitório do provider, erro do juiz) é PULADA, não
        // derruba o eval inteiro — a robustez é o ponto da US-70. O gate opera sobre as
        // reps VÁLIDAS; 0 válidas em um caso é que reprova (não dá para julgar).
        for (let i = 0; i < REPS; i++) {
          try {
            const gen = await generateNarration({ system: c.system ?? SYSTEM, prompt: c.input, timeoutMs: 180_000 })
            const { score } = await judgeTurn({
              judge,
              scenarioContext: c.scenarioContext,
              playerAction: c.input,
              narration: gen.narration,
              exemplar: c.exemplar,
            })
            reps.push(score)
            if (detectSlopName(gen.narration).slop) slopFails++
            if (!sample) sample = gen
          } catch (err) {
            console.warn(`⚠️ [US-70] ${c.id} rep ${i + 1}/${REPS} falhou (${(err as Error).message}) — pulando rep`)
          }
        }

        if (reps.length === 0 || !sample) {
          failures.push(`${c.id}: 0 reps válidas (geração/juiz falharam em todas as ${REPS})`)
          continue
        }

        const agg = aggregateReps(reps)
        const slopRate = slopFails / reps.length
        // Slop é REPORT-ONLY (calibração US-70): a taxa-base cola no SLOP_RATE_MAX e
        // gatear a REPS=3 seria flaky. Só AVISA; o gate real é média+pisos. Vira gate
        // quando a produção baixar o slop (US irmã) — adicionar slopRate ao gateQuality.
        if (slopRate > SLOP_RATE_MAX) {
          console.warn(`⚠️ [US-70] ${c.id} slopRate ${(slopRate * 100).toFixed(0)}% > ${(SLOP_RATE_MAX * 100).toFixed(0)}% — report-only, não reprova (ver SLOP_RATE_MAX)`)
        }
        // O MESMO gate puro do rubric.test.ts, agora sobre a AGREGAÇÃO (não 1 tiro).
        const gate = gateQuality({ perDim: agg.perDim, media: agg.media })
        if (!gate.passed) failures.push(`${c.id}: ${gate.reasons.join('; ')}`)

        entries.push({
          caseId: c.id,
          locale: c.locale ?? 'pt-BR',
          scenarioContext: c.scenarioContext,
          playerAction: c.input,
          narration: sample!.narration,
          score: aggregatedScore(agg.perDim),
          media: agg.media,
          finishReason: sample!.finishReason,
          tokens: sample!.tokens,
          modelServed: sample!.modelServed,
          spread: agg.spread,
          slopRate,
          gateReasons: gate.passed ? undefined : gate.reasons,
        })
      }

      // Relatório durável com metadados (comparar duas execuções → o que mudou).
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      const meta: QualityRunMeta = {
        gitHead: git.head,
        gitBranch: git.branch,
        narrationModel: narrationModels[0]!.modelId ?? 'unknown',
        ladderLevel: 0,
        maxTokens: NARRATION_MAX_TOKENS,
        frequencyPenalty: NARRATION_FREQUENCY_PENALTY,
        judgeModel: process.env['JUDGE_MODEL'] ?? 'gemini-3.1-flash-lite',
        timestamp,
      }
      const md = renderQualityReport(entries, meta)
      console.log(`\n${md}`)
      const reportsDir = resolve(process.cwd(), '../../evals/reports')
      mkdirSync(reportsDir, { recursive: true })
      writeFileSync(resolve(reportsDir, `us-36-${timestamp}.md`), md, 'utf8')

      // Portão da US-70: reprova (exit ≠ 0) se QUALQUER caso falhar média, piso ou slop.
      // A mensagem nomeia o eixo e o valor — o relatório traz a justificativa do juiz.
      expect(failures, `casos reprovados:\n${failures.join('\n')}`).toEqual([])
    },
    900_000,
  )

  // ─── Validação do juiz: o anchor set garante que "boa > ruim" por margem ────
  it.runIf(hasKeys)(
    'o juiz rankeia narrações boas acima das ruins por margem (detecta deriva do juiz)',
    async () => {
      const judge = judgeModel()
      const scored = [] as { expect: 'alta' | 'baixa'; media: number }[]
      for (const item of ANCHOR_SET) {
        const { score } = await judgeTurn({
          judge,
          scenarioContext: ANCHOR_CONTEXT,
          playerAction: ANCHOR_ACTION,
          narration: item.narration,
          exemplar: EX_OPENING,
        })
        scored.push({ expect: item.expect, media: meanOfScore(score) })
      }
      const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
      const alta = mean(scored.filter((s) => s.expect === 'alta').map((s) => s.media))
      const baixa = mean(scored.filter((s) => s.expect === 'baixa').map((s) => s.media))
      console.log(`\n[anchor] média alta=${alta.toFixed(2)} · baixa=${baixa.toFixed(2)} · margem=${(alta - baixa).toFixed(2)}`)
      expect(
        alta - baixa,
        `juiz não discrimina: alta ${alta.toFixed(2)} vs baixa ${baixa.toFixed(2)} (margem < ${ANCHOR_MARGIN}) — deriva do juiz?`,
      ).toBeGreaterThanOrEqual(ANCHOR_MARGIN)
    },
    600_000,
  )
})
