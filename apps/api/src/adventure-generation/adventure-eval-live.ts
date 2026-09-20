import { judgeModel, judgeTurn, meanOfScore, type Exemplar, type RubricScore } from '@ai-dm/ai-engine'
import type { GeneratedAdventure } from '@ai-dm/shared'
import { assertAdventureArtifact, type AdventureExpectation } from './adventure-eval'

// US-238: a parte do eval que CHAMA modelo (o juiz) e o hook de dev no caminho de criação. Separada
// de adventure-eval.ts de propósito: aquele é puro e roda no `pnpm test`; este exige GEMINI_API_KEY.
//
// O juiz é o sinal SECUNDÁRIO. Nesta tarefa ele satura (quase tudo 5/5 — lição do bake-off, US-17),
// então a nota é registrada no relatório/log e NUNCA decide aprovação: quem decide são os asserts.

const JUDGE_CONTEXT =
  'Abertura de uma aventura autoral one-shot (ambientação + gancho) escrita por um LLM — NÃO é um turno de jogo. Julgue só a prosa; dimensões que não se aplicam a texto de autoria (Gancho/Opções, Voz NPC, Coerência com a ficha) valem n/a → 5.'
const JUDGE_ACTION = '[abertura de uma aventura autoral] a jogadora lê a ambientação e o gancho.'

/** O que a jogadora lê primeiro (ambientação + gancho) — a prosa que o juiz pontua. */
export function proseToJudge(adventure: GeneratedAdventure): string {
  return `${adventure.world.description}\n\n${adventure.start}`
}

/**
 * Pontua a prosa de abertura com o MESMO juiz e rubrica da US-36 (`judgeTurn`). `exemplar` é a âncora
 * "nota 5" (a seção Setting do exemplar de prosa); sem ele o juiz pontua sem few-shot. Lança se a
 * chave/quota do juiz falhar — quem chama decide se isso derruba (runner) ou só avisa (hook de dev).
 */
export async function judgeAdventureProse(adventure: GeneratedAdventure, exemplar?: Exemplar): Promise<{ media: number; score: RubricScore }> {
  const { score } = await judgeTurn({
    judge: judgeModel(),
    scenarioContext: JUDGE_CONTEXT,
    playerAction: JUDGE_ACTION,
    narration: proseToJudge(adventure),
    exemplar,
  })
  return { media: meanOfScore(score), score }
}

/**
 * Live eval no caminho de criação — mesmo molde do `liveEvalTurn` (US-36): só atrás de `DM_LIVE_EVAL`,
 * nunca em produção, fire-and-forget, nunca lança (a aventura já foi aprovada pelo gate; isto só mede).
 * Loga UMA linha JSON: asserts que falharam + nota do juiz (informativa). Como o artefato aqui já
 * passou pelo gate, `prosa-sem-numero` é vazio por construção — o vazamento só se mede no artefato
 * BRUTO, no runner (scripts/run-adventure-eval.ts).
 */
export async function liveEvalAdventure(adventure: GeneratedAdventure, expected: AdventureExpectation): Promise<void> {
  if (!process.env.DM_LIVE_EVAL || process.env.NODE_ENV === 'production') return
  const failed = assertAdventureArtifact(adventure, expected).filter((a) => !a.ok)
  const line: Record<string, unknown> = {
    event: 'adventure_live_eval',
    timestamp: new Date().toISOString(),
    adventureId: adventure.id,
    assertionsFailed: failed.map((a) => `${a.name}: ${a.detail}`),
  }
  try {
    line['judgeMedia'] = (await judgeAdventureProse(adventure)).media
  } catch (err) {
    line['judgeError'] = err instanceof Error ? err.message : String(err)
  }
  console.log(JSON.stringify(line))
}
