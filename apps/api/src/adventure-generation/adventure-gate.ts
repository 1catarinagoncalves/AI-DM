import { GeneratedAdventureSchema, type GeneratedAdventure } from '@ai-dm/shared'
import { encounterDeadlyThreshold, singleMonsterCrCap } from './lazy-encounter-benchmark'
import { MONSTER_ROLE_CR, totalCr, type MonsterRole, type EncounterChallenge } from './monster-roles'

/**
 * US-150: resultado público do gate — o que o chamador (futuro consumidor de
 * `generateWithGate`) recebe. `reason` carrega o motivo da ÚLTIMA tentativa quando o teto
 * esgota, não uma lista de todas as falhas — o log estruturado (`logGateFailure`) é quem
 * regista o histórico completo.
 */
export type GateResult =
  | { ok: true; adventure: GeneratedAdventure }
  | { ok: false; reason: string; attempt: number }

// Estágio interno de UMA verificação — decide se o orquestrador re-semeia (parse/graph) ou
// falha imediato (budget, US-150 Notas de implementação: composeEncounterRoles é puro em
// `level`, reseed nunca muda o resultado dela).
type GateStage = 'parse' | 'graph' | 'budget'

type GateCheckResult =
  | { ok: true; adventure: GeneratedAdventure }
  | { ok: false; reason: string; stage: GateStage }

/**
 * As três verificações mecânicas (parse, grafo fecha, orçamento), na ordem de custo
 * crescente do backlog. A 4ª verificação do backlog (piso de quantidade por seção) é
 * responsabilidade do PROMPT (US-149), não deste gate (ver Escopo da US-150).
 */
export function runAdventureGate(candidate: unknown, challenge: EncounterChallenge = 'adventure'): GateCheckResult {
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

  return { ok: true, adventure: parsed.data }
}

/**
 * Verificação 2: toda referência cruzada resolve (`locationId`, `npcId` — inclusive
 * `location.occupants`, que `generateLocationsAndNpcs` deixa como "melhor esforço", ver
 * ai.service.ts:1316 — e `encounterId`), e nenhuma locação/NPC declarado fica órfão.
 */
function checkAdventureGraph(adventure: GeneratedAdventure): string | null {
  return checkReferencesResolve(adventure) ?? checkNoOrphans(adventure)
}

function checkReferencesResolve(adventure: GeneratedAdventure): string | null {
  const locationIds = new Set(adventure.locations.map((l) => l.id))
  const npcIds = new Set(adventure.npcs.map((n) => n.id))
  const encounterIds = new Set(adventure.encounters.map((e) => e.id))

  return (
    checkSecretLocationIds(adventure, locationIds) ??
    checkEncounterReferences(adventure, locationIds, npcIds) ??
    checkOccupantReferences(adventure, npcIds) ??
    checkInteractionReferences(adventure, encounterIds)
  )
}

function checkSecretLocationIds(adventure: GeneratedAdventure, locationIds: Set<string>): string | null {
  for (const secret of adventure.secrets) {
    if (!locationIds.has(secret.locationId)) return `segredo "${secret.id}" referencia locationId inexistente "${secret.locationId}"`
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

function checkInteractionReferences(adventure: GeneratedAdventure, encounterIds: Set<string>): string | null {
  for (const npc of adventure.npcs) {
    for (const interaction of npc.interactions) {
      if (interaction.encounterId && !encounterIds.has(interaction.encounterId)) {
        return `NPC "${npc.id}" referencia encounterId inexistente "${interaction.encounterId}"`
      }
    }
  }
  return null
}

function checkNoOrphans(adventure: GeneratedAdventure): string | null {
  return checkNoOrphanLocations(adventure) ?? checkNoOrphanNpcs(adventure)
}

function checkNoOrphanLocations(adventure: GeneratedAdventure): string | null {
  const referenced = new Set([
    ...adventure.secrets.map((s) => s.locationId),
    ...adventure.encounters.map((e) => e.locationId),
  ])
  for (const location of adventure.locations) {
    if (!referenced.has(location.id)) return `local "${location.id}" órfão — nenhum encontro ou segredo aponta para ele`
  }
  return null
}

function checkNoOrphanNpcs(adventure: GeneratedAdventure): string | null {
  const referenced = new Set([
    ...adventure.encounters.flatMap((e) => e.npcIds),
    ...adventure.locations.flatMap((l) => l.occupants),
  ])
  for (const npc of adventure.npcs) {
    if (!referenced.has(npc.id) && npc.interactions.length === 0) {
      return `NPC "${npc.id}" órfão — nenhum encontro, local ou interação aponta para ele`
    }
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
 * independente do dial (regra mais forte, não a que o dial troca). NPCs narrativos (role fora
 * de `MONSTER_ROLE_CR`) não têm CR e não entram na soma.
 */
function checkEncounterBudget(adventure: GeneratedAdventure, challenge: EncounterChallenge): string | null {
  const level = adventure.levelRange.min
  const soloCap = singleMonsterCrCap(level)
  const sumBudget = challenge === 'challenge' ? soloCap : encounterDeadlyThreshold(level)
  const roleByNpcId = new Map(adventure.npcs.map((n) => [n.id, n.role]))

  for (const encounter of adventure.encounters) {
    const roles = encounter.npcIds
      .map((id) => roleByNpcId.get(id))
      .filter((role): role is MonsterRole => role !== undefined && role in MONSTER_ROLE_CR)

    const oversized = roles.find((role) => MONSTER_ROLE_CR[role] >= soloCap)
    if (oversized) return `encontro "${encounter.id}" tem monstro único CR ${MONSTER_ROLE_CR[oversized]} >= teto ${soloCap} (nível ${level})`

    const sum = totalCr(roles)
    if (sum > sumBudget) return `encontro "${encounter.id}" soma CR ${sum} excede limiar ${sumBudget} (nível ${level})`
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
): Promise<GateCheckResult> {
  try {
    const adventure = await generate(attempt)
    return runAdventureGate(adventure, challenge)
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err), stage: 'parse' }
  }
}

/**
 * Orquestração de reseed (US-150): falha nas verificações 1 (parse, inclui exceção da própria
 * `generate`) ou 2 (grafo) re-semeia com `attempt + 1`, até `maxAttempts`. Falha na verificação
 * 3 (orçamento) NUNCA re-semeia — `composeEncounterRoles` é pura em `level`, reseed não muda o
 * resultado; falha imediata é erro estrutural, registrado como tal.
 */
export async function generateWithGate(
  generate: (attempt: number) => Promise<GeneratedAdventure>,
  maxAttempts = 3,
  challenge: EncounterChallenge = 'adventure',
): Promise<GateResult> {
  let lastReason = 'nenhuma tentativa executada'

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const check = await runGateAttempt(generate, attempt, challenge)
    if (check.ok) return { ok: true, adventure: check.adventure }

    lastReason = check.reason
    logGateFailure(check.reason, attempt)
    if (check.stage === 'budget') return { ok: false, reason: check.reason, attempt }
  }

  return { ok: false, reason: `teto de ${maxAttempts} tentativas esgotado — última falha: ${lastReason}`, attempt: maxAttempts - 1 }
}
