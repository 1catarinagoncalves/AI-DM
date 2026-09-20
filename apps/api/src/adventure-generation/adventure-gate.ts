import {
  GeneratedAdventureSchema,
  stripFabricatedRolls,
  type AdventureChallenge,
  type AdventureLocation,
  type GeneratedAdventure,
  type SystemConfig,
} from '@ai-dm/shared'
import { encounterDeadlyThreshold, singleMonsterCrCap } from './lazy-encounter-benchmark'
import type { AdventureSlice } from './adventure-slice'
import { MONSTER_ROLE_CR, totalCr, type MonsterRole, type EncounterChallenge } from './monster-roles'

// US-234: catálogo mínimo pra validar `challenge.test` — o mesmo `config.skills`/`attributes`
// que `ai.service.ts` já carrega (buildSkillSheet). O gate recebe o subconjunto de que precisa
// em vez de buscar o system config sozinho (não duplicar a fonte).
type SkillCatalog = Pick<SystemConfig, 'skills' | 'attributes'>

/**
 * US-150: resultado público do gate — o que o chamador (futuro consumidor de
 * `generateWithGate`) recebe. `reason` carrega o motivo da ÚLTIMA tentativa quando o teto
 * esgota, não uma lista de todas as falhas — o log estruturado (`logGateFailure`) é quem
 * regista o histórico completo.
 */
export type GateResult =
  | { ok: true; adventure: GeneratedAdventure }
  | { ok: false; reason: string; attempt: number }

// Estágio interno de UMA verificação. US-234: todo estágio re-semeia no orquestrador — orçamento
// perdeu a exceção de falha imediata que tinha na US-150 (ver `generateWithGate`).
type GateStage = 'parse' | 'graph' | 'budget' | 'saneamento'

type GateCheckResult =
  | { ok: true; adventure: GeneratedAdventure }
  | { ok: false; reason: string; stage: GateStage }

/**
 * As quatro verificações mecânicas (parse, grafo fecha, orçamento, saneamento — US-234), na
 * ordem de custo crescente do backlog. Saneamento não reprova por leak de número na prosa —
 * limpa e segue; só reprova por perícia/atributo nomeado que não existe no catálogo.
 */
export function runAdventureGate(
  candidate: unknown,
  challenge: EncounterChallenge = 'adventure',
  catalog?: SkillCatalog,
): GateCheckResult {
  const parsed = GeneratedAdventureSchema.safeParse(candidate)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const where = issue ? issue.path.join('.') || '(raiz)' : 'desconhecido'
    return { ok: false, reason: `schema inválido em "${where}": ${issue?.message ?? 'erro desconhecido'}`, stage: 'parse' }
  }

  const graphReason = checkAdventureGraph(parsed.data)
  if (graphReason) return { ok: false, reason: graphReason, stage: 'graph' }

  const budgetReason = checkEncounterBudget(parsed.data, challenge)
  if (budgetReason) return { ok: false, reason: budgetReason, stage: 'budget' }

  const sanitized = sanitizeProse(parsed.data)
  const skillReason = checkSkillCatalog(sanitized, catalog)
  if (skillReason) return { ok: false, reason: skillReason, stage: 'saneamento' }

  return { ok: true, adventure: sanitized }
}

/**
 * Verificação 2: toda referência cruzada resolve (`locationId`, `npcId` — inclusive
 * `location.occupants`, que `generateLocationsAndNpcs` deixa como "melhor esforço", ver
 * ai.service.ts:1316 — e `encounterId`), e nenhuma locação/NPC declarado fica órfão.
 */
// Exportada (US-238): o eval mede o MESMO grafo que o gate exige, sem segundo detector.
export function checkAdventureGraph(adventure: GeneratedAdventure): string | null {
  return checkReferencesResolve(adventure) ?? checkNoOrphans(adventure)
}

function checkReferencesResolve(adventure: GeneratedAdventure): string | null {
  const locationIds = new Set(adventure.locations.map((l) => l.id))
  const npcIds = new Set(adventure.npcs.map((n) => n.id))

  return (
    checkChallengeLocationIds(adventure, locationIds) ??
    checkEncounterReferences(adventure, locationIds, npcIds) ??
    checkOccupantReferences(adventure, npcIds) ??
    checkFactionReferences(adventure)
  )
}

// US-238: `npc.factionId`/`location.factionId` → `factions[].id` estava no escopo e nos AC da US-234,
// mas nunca foi verificado no código. `mintSlice` (resolveFactionId) descarta índice fora da faixa,
// então hoje o órfão não nasce do pipeline — a verificação existe pra não depender disso.
function checkFactionReferences(adventure: GeneratedAdventure): string | null {
  const factionIds = new Set(adventure.factions.map((f) => f.id))
  for (const npc of adventure.npcs) {
    if (npc.factionId && !factionIds.has(npc.factionId)) return `NPC "${npc.id}" referencia factionId inexistente "${npc.factionId}"`
  }
  for (const location of adventure.locations) {
    if (location.factionId && !factionIds.has(location.factionId)) return `local "${location.id}" referencia factionId inexistente "${location.factionId}"`
  }
  return null
}

// US-232: `secrets[]` saiu do artefato; `challenges[]` (obstáculo não-combate preso a local)
// entrou — mesma verificação de referência que `checkSecretLocationIds` fazia.
function checkChallengeLocationIds(adventure: GeneratedAdventure, locationIds: Set<string>): string | null {
  for (const challenge of adventure.challenges) {
    if (!locationIds.has(challenge.locationId)) return `desafio "${challenge.id}" referencia locationId inexistente "${challenge.locationId}"`
  }
  if (!locationIds.has(adventure.objective.locationId)) {
    return `objective referencia locationId inexistente "${adventure.objective.locationId}"`
  }
  return null
}

function checkEncounterReferences(adventure: GeneratedAdventure, locationIds: Set<string>, npcIds: Set<string>): string | null {
  for (const encounter of adventure.encounters) {
    if (!locationIds.has(encounter.locationId)) return `encontro "${encounter.id}" referencia locationId inexistente "${encounter.locationId}"`
    for (const npcId of encounter.npcIds) {
      if (!npcIds.has(npcId)) return `encontro "${encounter.id}" referencia npcId inexistente "${npcId}"`
    }
  }
  return null
}

function checkOccupantReferences(adventure: GeneratedAdventure, npcIds: Set<string>): string | null {
  for (const location of adventure.locations) {
    for (const occupantId of location.occupants) {
      if (!npcIds.has(occupantId)) return `local "${location.id}" tem occupant que não resolve para nenhum npcId: "${occupantId}"`
    }
  }
  return null
}

function checkNoOrphans(adventure: GeneratedAdventure): string | null {
  return checkNoOrphanLocations(adventure) ?? checkNoOrphanNpcs(adventure)
}

// US-232: âncoras de local — encontro, desafio, objetivo, ou NPC morando ali (occupants). Sem
// `secrets[]` (saiu do schema) e com só ~3 encontros pra ~6 locais, encontro sozinho reprovaria
// quase toda geração; as âncoras extras (challenges/objective/occupants) + o backstop de minting
// (adventure.service.ts) fazem isto passar SEMPRE, sem depender do regenerate do MA-4 (Dúvidas #9).
function checkNoOrphanLocations(adventure: GeneratedAdventure): string | null {
  const referenced = new Set([
    ...adventure.encounters.map((e) => e.locationId),
    ...adventure.challenges.map((c) => c.locationId),
    adventure.objective.locationId,
    ...adventure.locations.filter((l) => l.occupants.length > 0).map((l) => l.id),
  ])
  for (const location of adventure.locations) {
    if (!referenced.has(location.id)) return `local "${location.id}" órfão — nenhum encontro, desafio, objetivo ou morador aponta para ele`
  }
  return null
}

function checkNoOrphanNpcs(adventure: GeneratedAdventure): string | null {
  const referenced = new Set([
    ...adventure.encounters.flatMap((e) => e.npcIds),
    ...adventure.locations.flatMap((l) => l.occupants),
  ])
  for (const npc of adventure.npcs) {
    if (!referenced.has(npc.id)) return `NPC "${npc.id}" órfão — nenhum encontro nem local aponta para ele`
  }
  return null
}

/**
 * Verificação 3 (US-159/US-167): soma de CR dos monstros do encontro não pode EXCEDER (`>`)
 * o orçamento do MESMO dial que `composeEncounterRoles` usou para montar o encontro —
 * `encounterDeadlyThreshold` em modo `'adventure'`, `singleMonsterCrCap` em modo `'challenge'`
 * (sem isto, um encontro montado sob orçamento maior de propósito seria sempre rejeitado
 * contra o limiar menor). CR de monstro único não pode ALCANÇAR OU PASSAR (`>=`)
 * `singleMonsterCrCap` — mesmos operadores do LGMRD, para UM personagem no nível da aventura,
 * independente do dial (regra mais forte, não a que o dial troca). NPC narrativo (sem
 * `combatRole`, US-233) não tem CR e não entra na soma. US-166: só encontros `type === 'combat'`
 * carregam orçamento — `skill`/`social` nunca reprovam por ausência dele.
 */
export function checkEncounterBudget(adventure: GeneratedAdventure, challenge: EncounterChallenge): string | null {
  const level = adventure.levelRange.min
  const soloCap = singleMonsterCrCap(level)
  const sumBudget = challenge === 'challenge' ? soloCap : encounterDeadlyThreshold(level)
  const roleByNpcId = new Map(adventure.npcs.map((n) => [n.id, n.combatRole]))

  for (const encounter of adventure.encounters) {
    if (encounter.type !== 'combat') continue
    const roles = encounter.npcIds
      .map((id) => roleByNpcId.get(id))
      .filter((role): role is MonsterRole => role !== undefined)

    const oversized = roles.find((role) => MONSTER_ROLE_CR[role] >= soloCap)
    if (oversized) return `encontro "${encounter.id}" tem monstro único CR ${MONSTER_ROLE_CR[oversized]} >= teto ${soloCap} (nível ${level})`

    const sum = totalCr(roles)
    if (sum > sumBudget) return `encontro "${encounter.id}" soma CR ${sum} excede limiar ${sumBudget} (nível ${level})`
  }
  return null
}

/**
 * Verificação 4 (US-234): contrato US-29 reimposto aqui — a geração de aventura é OFF-TURN,
 * então a rede `onFinish` que saneia a narração de turno não roda nela. Reusa o MESMO stripper
 * (não escreve um segundo) sobre os campos de prosa autorados; retorna cópia limpa (clona antes
 * de mutar — `parsed.data` do zod não deve ser mexido in-place).
 */
function stripProse(text: string): string {
  return stripFabricatedRolls(text).clean
}

function sanitizeObjective(adventure: GeneratedAdventure): void {
  adventure.objective.description = stripProse(adventure.objective.description)
  adventure.objective.reward.effect = stripProse(adventure.objective.reward.effect)
}

function sanitizeLocation(location: AdventureLocation): void {
  location.boxedText = stripProse(location.boxedText)
  location.description = stripProse(location.description)
}

function sanitizeChallenge(challenge: AdventureChallenge): void {
  challenge.situation = stripProse(challenge.situation)
  challenge.consequence = stripProse(challenge.consequence)
}

// US-256: os campos de prosa da FATIA (1A) — o pedaço de `sanitizeProse` que a narração da abertura
// precisa ANTES de o gate final rodar (a jogadora lê a abertura antes da 1B existir). Mutante, sobre
// uma cópia: `sanitizeProse` (artefato completo) e `sanitizeSlice` (fatia) dividem este corpo em vez
// de duplicá-lo — a garantia "narração só recebe texto saneado" sobrevive à divisão da autoria.
function sanitizeSliceFields(adventure: AdventureSlice): void {
  adventure.world.description = stripProse(adventure.world.description)
  adventure.story = stripProse(adventure.story)
  adventure.start = stripProse(adventure.start)
  adventure.summary = stripProse(adventure.summary)
  adventure.locations.forEach(sanitizeLocation)
}

/** US-256: sanea a fatia 1A (mesmo stripper do gate, US-234) antes de narrar/persistir. Devolve cópia. */
export function sanitizeSlice(slice: AdventureSlice): AdventureSlice {
  const clean = structuredClone(slice)
  sanitizeSliceFields(clean)
  return clean
}

// Exportada (US-238): o assert "sem número na prosa" do eval compara o artefato com esta cópia
// saneada — mesmo stripper, mesma lista de campos, nenhum detector paralelo.
export function sanitizeProse(adventure: GeneratedAdventure): GeneratedAdventure {
  const clean = structuredClone(adventure)
  sanitizeSliceFields(clean)
  clean.followUps = clean.followUps.map(stripProse)
  sanitizeObjective(clean)
  clean.challenges.forEach(sanitizeChallenge)
  clean.encounters.forEach((e) => { e.fiction = stripProse(e.fiction) })
  clean.branchedResolution.forEach((b) => { b.consequence = stripProse(b.consequence) })
  return clean
}

function normalizeSkillLabel(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

// `challenge.test` é nomeado livre pelo modelo ("Percepção", "Sabedoria (Percepção)") — casa
// por CONTÉM, não igualdade estrita, pra aceitar perícia+atributo colados num só rótulo. Sem
// catálogo (`config.skills` ausente, sistema legado) não há como validar: passa.
function checkSkillCatalog(adventure: GeneratedAdventure, catalog?: SkillCatalog): string | null {
  const labels = [...(catalog?.skills ?? []), ...(catalog?.attributes ?? [])].map((e) => normalizeSkillLabel(e.label))
  if (labels.length === 0) return null

  for (const challenge of adventure.challenges) {
    const want = normalizeSkillLabel(challenge.test)
    if (!labels.some((label) => want.includes(label))) {
      return `desafio "${challenge.id}" testa perícia/atributo desconhecido: "${challenge.test}"`
    }
  }
  return null
}

// US-120: mesmo molde de log estruturado do `logLlmFailure` (llm-error.ts) — JSON de uma
// linha, sem stack (não há um aqui: a falha é de conteúdo, não de exceção do SDK).
function logGateFailure(reason: string, attempt: number): void {
  console.error(JSON.stringify({ event: 'adventure_gate_failed', timestamp: new Date().toISOString(), attempt, reason }))
}

async function runGateAttempt(
  generate: (attempt: number) => Promise<GeneratedAdventure>,
  attempt: number,
  challenge: EncounterChallenge,
  catalog: SkillCatalog | undefined,
): Promise<GateCheckResult> {
  try {
    const adventure = await generate(attempt)
    return runAdventureGate(adventure, challenge, catalog)
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err), stage: 'parse' }
  }
}

/**
 * Orquestração de reseed (US-150, revertida pela US-234): falha em QUALQUER verificação
 * (parse — inclui exceção da própria `generate` — grafo, orçamento ou saneamento) re-semeia a
 * CHAMADA 1 com `attempt + 1`, até `maxAttempts`. Orçamento perdeu a exceção de falha imediata
 * que tinha na US-150/US-159 (`composeEncounterRoles` era pura em `level`): orçamento agora é
 * autorado pela CHAMADA 1 via LLM, reseed pode corrigir o resultado.
 */
export async function generateWithGate(
  generate: (attempt: number) => Promise<GeneratedAdventure>,
  maxAttempts = 3,
  challenge: EncounterChallenge = 'adventure',
  catalog?: SkillCatalog,
): Promise<GateResult> {
  let lastReason = 'nenhuma tentativa executada'

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const check = await runGateAttempt(generate, attempt, challenge, catalog)
    if (check.ok) return { ok: true, adventure: check.adventure }

    lastReason = check.reason
    logGateFailure(check.reason, attempt)
  }

  return { ok: false, reason: `teto de ${maxAttempts} tentativas esgotado — última falha: ${lastReason}`, attempt: maxAttempts - 1 }
}
