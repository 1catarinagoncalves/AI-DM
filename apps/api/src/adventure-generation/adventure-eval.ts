import { formatEntities } from '@ai-dm/ai-engine'
import type { GeneratedAdventure } from '@ai-dm/shared'
import { checkAdventureGraph, checkEncounterBudget, sanitizeProse } from './adventure-gate'
import type { EncounterChallenge } from './monster-roles'
import { seedLedgerFromGeneratedAdventure } from './seed-ledger'

// US-238: eval da aventura gerada. O sinal que decide regressão são estes ASSERTS sobre o artefato —
// o juiz LLM (adventure-eval-live.ts) satura nesta tarefa e só é registrado, nunca gateia. Aqui não
// há chamada de modelo nem banco: função pura sobre um `GeneratedAdventure`, então roda no
// `pnpm test` (fixture boa passa, fixture quebrada falha) e no runner ao vivo com o mesmo código.
//
// Não é um segundo gate: o gate (adventure-gate.ts) BLOQUEIA persistência e para no primeiro
// motivo; isto MEDE uma amostra e devolve todos os veredictos de uma vez. Onde o gate já sabe
// verificar (grafo, orçamento, stripper de prosa), este módulo chama o mesmo código.

export type AdventureAssertionName =
  | 'grafo-fecha'
  | 'ledger-oculto'
  | 'orcamento-cabe'
  | 'facoes'
  | 'objetivo-com-premio'
  | 'desafios-nao-combate'
  | 'prosa-sem-numero'
  | 'estrutura-8-secoes'

export interface AdventureAssertion {
  name: AdventureAssertionName
  ok: boolean
  /** Motivo da falha, com o valor ofensor; vazio quando `ok`. */
  detail: string
}

export interface AdventureExpectation {
  challenge: EncounterChallenge
  /** Pinado pelo perfil (`rollFactionCount`). Ausente (live eval sem perfil) → faixa do sorteio, [2,4]. */
  factionCount?: number
  /** `challenges[]` é o array de obstáculo NÃO-combate (encontro de combate é `encounters[]`). */
  minChallenges: number
}

// As 8 seções do exemplar de estrutura (evals/exemplars/cripta-do-veu-silencioso.md, `###`) →
// o campo do artefato que a carrega. Um teste lê o exemplar e falha se os cabeçalhos deixarem de
// bater com estas chaves: é o que faz o exemplar ancorar o eval sem o runtime ler arquivo.
const EXEMPLAR_SECTIONS: Record<string, (a: GeneratedAdventure) => boolean> = {
  Setting: (a) => a.world.description.trim() !== '',
  Story: (a) => a.story.trim() !== '',
  Objective: (a) => a.objective.description.trim() !== '',
  Locations: (a) => a.locations.length > 0,
  Challenges: (a) => a.challenges.length > 0,
  Encounters: (a) => a.encounters.length > 0,
  'Follow Up Ideas': (a) => a.followUps.length > 0,
  NPCs: (a) => a.npcs.length > 0,
}

export const EXEMPLAR_SECTION_NAMES = Object.keys(EXEMPLAR_SECTIONS)

/** Cabeçalhos `###` de um exemplar em markdown — o que o teste de deriva compara com `EXEMPLAR_SECTION_NAMES`. */
export function exemplarHeadings(markdown: string): string[] {
  return [...markdown.matchAll(/^### (.+)$/gm)].map((m) => m[1]!.trim())
}

/** Texto sob um cabeçalho `###` do exemplar (âncora "nota 5" do juiz: a seção Setting). Normaliza CRLF. */
export function exemplarSection(markdown: string, heading: string): string | undefined {
  const block = markdown.replace(/\r\n/g, '\n').split(/^### /m).find((part) => part.startsWith(`${heading}\n`))
  return block?.slice(heading.length).trim()
}

const verdict = (name: AdventureAssertionName, reason: string | null): AdventureAssertion => ({ name, ok: reason === null, detail: reason ?? '' })

function checkStructure(adventure: GeneratedAdventure): string | null {
  const missing = EXEMPLAR_SECTION_NAMES.filter((section) => !EXEMPLAR_SECTIONS[section]!(adventure))
  return missing.length === 0 ? null : `seção do exemplar sem conteúdo no artefato: ${missing.join(', ')}`
}

// US-238 (re-ancoragem): `secrets[]` saiu do artefato na US-232, então "secretId oculto" virou o
// invariante equivalente — nada semeado do artefato nasce revelado, e o bloco de entidades que o
// Mestre lê todo turno marca cada linha com `⚠ OCULTO` (mesmo marcador que a US-154 ancora).
function checkLedgerHidden(adventure: GeneratedAdventure): string | null {
  const ledger = seedLedgerFromGeneratedAdventure(adventure)
  const revealed = ledger.find((entity) => entity.revelado !== false)
  if (revealed) return `entidade "${revealed.nome}" nasceu com revelado !== false`
  const unmarked = formatEntities(ledger).split('\n').find((line) => line.startsWith('- ') && !line.includes('⚠ OCULTO'))
  return unmarked ? `linha do bloco de entidades sem marcador OCULTO: "${unmarked.slice(0, 80)}"` : null
}

// ponytail: igualdade textual — paráfrase do mesmo desejo passa; o juiz/o olho pegam esse caso.
function checkFactions(adventure: GeneratedAdventure, expected: AdventureExpectation): string | null {
  const count = adventure.factions.length
  if (expected.factionCount !== undefined && count !== expected.factionCount) return `esperava ${expected.factionCount} facções, veio ${count}`
  if (expected.factionCount === undefined && (count < 2 || count > 4)) return `${count} facções fora da faixa sorteada [2,4]`
  const wants = adventure.factions.map((f) => f.want.trim().toLowerCase())
  const repeated = wants.find((want, i) => wants.indexOf(want) !== i)
  return repeated ? `facções com o mesmo want: "${repeated}"` : null
}

function checkObjectiveReward(adventure: GeneratedAdventure): string | null {
  const { name, effect } = adventure.objective.reward
  return name.trim() !== '' && effect.trim() !== '' ? null : `objective.reward sem name/effect (name="${name}", effect="${effect}")`
}

function checkChallengeCount(adventure: GeneratedAdventure, min: number): string | null {
  return adventure.challenges.length >= min ? null : `${adventure.challenges.length} desafios não-combate, mínimo ${min}`
}

// Compara espaço-normalizado: o stripper também colapsa espaço/quebra de linha, e isso não é vazamento.
const squash = (value: unknown): string => JSON.stringify(value, (_, v) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : v))

// Mede o que o STRIPPER removeria. No artefato JÁ persistido (pós-gate) isto é vazio por construção —
// o número só aparece medido no artefato BRUTO, antes do gate (runner ao vivo).
function checkProseHasNoNumbers(adventure: GeneratedAdventure): string | null {
  const clean = sanitizeProse(adventure)
  const leaked = (Object.keys(adventure) as (keyof GeneratedAdventure)[]).filter((key) => squash(adventure[key]) !== squash(clean[key]))
  return leaked.length === 0 ? null : `número de mecânica na prosa de: ${leaked.join(', ')}`
}

/**
 * Roda TODOS os asserts do eval sobre um artefato e devolve um veredito por assert (ordem fixa).
 * Nunca lança: falha é `ok: false` + `detail`. Exemplo: `assertAdventureArtifact(adv, { challenge: 'adventure', factionCount: 3, minChallenges: 3 })`.
 */
export function assertAdventureArtifact(adventure: GeneratedAdventure, expected: AdventureExpectation): AdventureAssertion[] {
  return [
    verdict('grafo-fecha', checkAdventureGraph(adventure)),
    verdict('ledger-oculto', checkLedgerHidden(adventure)),
    verdict('orcamento-cabe', checkEncounterBudget(adventure, expected.challenge)),
    verdict('facoes', checkFactions(adventure, expected)),
    verdict('objetivo-com-premio', checkObjectiveReward(adventure)),
    verdict('desafios-nao-combate', checkChallengeCount(adventure, expected.minChallenges)),
    verdict('prosa-sem-numero', checkProseHasNoNumbers(adventure)),
    verdict('estrutura-8-secoes', checkStructure(adventure)),
  ]
}

/** Resultado de UM perfil pinado no runner ao vivo. `error` = a geração nem produziu artefato. */
export interface AdventureEvalRun {
  profileId: string
  assertions: AdventureAssertion[]
  /** Veredito do gate de produção sobre o MESMO artefato bruto — informativo, o gate real roda no create. */
  gate: string
  /** Nota média do juiz — informativa; `undefined` = o juiz não rodou (sem chave) ou falhou. */
  judgeMedia?: number
  error?: string
}

export interface AdventureEvalMeta {
  mode: 'pipeline' | 'producao'
  gitHead: string
  timestamp: string
  judgeModel: string
}

/** A suite passa só se TODO perfil gerou e TODO assert passou — a nota do juiz nunca entra aqui (US-238). */
export function adventureEvalPassed(runs: AdventureEvalRun[]): boolean {
  return runs.every((run) => !run.error && run.assertions.every((a) => a.ok))
}

const MODE_LABEL: Record<AdventureEvalMeta['mode'], string> = {
  pipeline: 'pipeline (temperature 0 + snapshot pinado)',
  producao: 'produção (escada de modelos + temperatura padrão)',
}

function renderRun(run: AdventureEvalRun): string {
  const head = `## ${run.profileId}`
  if (run.error) return `${head} — ❌ geração falhou\n\n${run.error}`
  const failed = run.assertions.filter((a) => !a.ok).length
  const rows = run.assertions.map((a) => `| ${a.name} | ${a.ok ? '✅' : '❌'} | ${a.detail} |`)
  const judge = run.judgeMedia === undefined ? 'n/a' : `${run.judgeMedia.toFixed(2)}/5`
  return [
    `${head} — ${failed === 0 ? '✅' : '❌'} ${run.assertions.length - failed}/${run.assertions.length} asserts`,
    '',
    '| assert | ok | detalhe |',
    '|---|---|---|',
    ...rows,
    '',
    `Gate de produção sobre o artefato bruto: ${run.gate}`,
    `Juiz (informativo, não decide): ${judge}`,
  ].join('\n')
}

/** Markdown do relatório do runner (`evals/reports/us-238-*.md`, gitignored). */
export function renderAdventureEvalReport(runs: AdventureEvalRun[], meta: AdventureEvalMeta): string {
  return [
    `# Eval da aventura gerada (US-238) — ${meta.timestamp}`,
    '',
    `Modo: ${MODE_LABEL[meta.mode]} · git ${meta.gitHead} · juiz ${meta.judgeModel}`,
    `Resultado: ${adventureEvalPassed(runs) ? '✅ passou' : '❌ reprovou'} (decide pelos asserts; a nota do juiz satura e só é registrada — US-17)`,
    '',
    runs.map(renderRun).join('\n\n'),
    '',
  ].join('\n')
}
