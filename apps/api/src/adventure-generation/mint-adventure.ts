import {
  GeneratedAdventureSchema,
  type AdventureChallenge,
  type AdventureEncounter,
  type AdventureLocation,
  type AdventureNpc,
  type AdventureRegistry,
  type GeneratedAdventure,
} from '@ai-dm/shared'
import type { AuthoredRest, AuthoredSlice } from '../ai/adventure-authoring'
import { AdventureSliceSchema, type AdventureSlice } from './adventure-slice'
import { BESTIARY, chooseNominalCreature } from './bestiary'
import { assignBudgetedCombatRoles, type EncounterChallenge } from './monster-roles'

// US-256: o minting que vivia inline em `AdventureService.generateAdventure` (~200 linhas) foi
// partido em duas funções PURAS, uma por chamada de autoria: `mintSlice` (1A) e
// `mintRestOntoSlice` (1B, que recebe a fatia já mintada e devolve o artefato completo). A saída
// BRUTA do modelo referencia por índice (0-based na array irmã) — o código minta os ids reais aqui.
// Índice fora de faixa é filtrado (occupants/npcIndices) ou lança (locationIndex obrigatório),
// mesma disciplina de `occupants` da US-158.

interface SliceMeta {
  id: string
  level: number
  registry: AdventureRegistry
  modelId: string
}

// `idx != null`: `null >= 0` é true em JS — sem isso o null do modelo indexaria factions[null] e lançaria.
function resolveFactionId(factions: { id: string }[], idx: number | null | undefined): string | undefined {
  return idx != null && idx >= 0 && idx < factions.length ? factions[idx]!.id : undefined
}

/** 1A: mint dos ids de facção/NPC/local + validação de forma da fatia (`.parse()`). */
export function mintSlice(authored: AuthoredSlice, meta: SliceMeta): AdventureSlice {
  const factions = authored.factions.map((f, i) => ({ id: `faction-${i + 1}`, name: f.name, kind: f.kind, want: f.want }))

  const npcs: AdventureNpc[] = authored.npcs.map((n, i) => {
    const factionId = resolveFactionId(factions, n.factionIndex)
    return { id: `npc-${i + 1}`, name: n.name, role: n.role, want: n.want, ...(factionId ? { factionId } : {}) }
  })

  const locations: AdventureLocation[] = authored.locations.map((l, i) => {
    const factionId = resolveFactionId(factions, l.factionIndex)
    return {
      id: `loc-${i + 1}`,
      title: l.title,
      aspects: l.aspects,
      boxedText: l.boxedText,
      description: l.description,
      occupants: l.occupants.filter((idx) => idx < npcs.length).map((idx) => npcs[idx]!.id),
      ...(factionId ? { factionId } : {}),
      vibe: l.vibe,
    }
  })

  return AdventureSliceSchema.parse({
    id: meta.id,
    levelRange: { min: meta.level, max: meta.level },
    registry: meta.registry,
    summary: authored.summary,
    world: authored.world,
    story: authored.story,
    factions,
    npcs,
    locations,
    start: authored.start,
    generationModel: meta.modelId,
  })
}

// Índice fora de faixa aqui LANÇA (ao contrário de occupants/npcIndices, que são "melhor esforço"
// e filtram): challenge/encounter/objective.locationId são campos ÚNICOS e OBRIGATÓRIOS — um clamp
// silencioso pro local 0 corrompia o local do Final sem erro nenhum (achado ao ler um artefato
// real: Final e objective foram parar no local errado porque o modelo mirou um `anchors` que
// nunca virou `locations[]`). Lançar aqui vira falha de estágio 'parse' no gate (US-234), que
// regenera a chamada em vez de persistir o local errado.
function locationIdResolver(locations: AdventureLocation[]): (idx: number) => string {
  return (idx) => {
    if (idx < 0 || idx >= locations.length) {
      throw new Error(`locationIndex ${idx} fora de faixa — esperado 0..${locations.length - 1} (${locations.length} locais autorados)`)
    }
    return locations[idx]!.id
  }
}

function mintChallenges(authored: AuthoredRest, locationId: (idx: number) => string): AdventureChallenge[] {
  return authored.challenges.map((c, i) => ({
    id: `challenge-${i + 1}`,
    locationId: locationId(c.locationIndex),
    test: c.test,
    situation: c.situation,
    consequence: c.consequence,
  }))
}

function mintEncounters(authored: AuthoredRest, npcs: AdventureNpc[], locationId: (idx: number) => string): AdventureEncounter[] {
  return authored.encounters.map((e, i) => ({
    id: `encounter-${i + 1}`,
    locationId: locationId(e.locationIndex),
    npcIds: e.npcIndices.filter((idx) => idx < npcs.length).map((idx) => npcs[idx]!.id),
    type: e.type,
    fiction: e.fiction,
    behaviors: e.behaviors,
    goal: e.goal,
    complications: e.complications,
    unlocks: e.unlocks,
  }))
}

// US-232 (Dúvidas de implementação #9): backstop determinístico de local órfão. Todo local fora do
// conjunto ancorado (encounter/challenge/objective.locationId + occupants não-vazio) recebe 1 npcId
// em `occupants`, round-robin sobre NPCs ainda sem local (ou sobre todos, se nenhum estiver livre).
// Garante `checkNoOrphanLocations` passando SEMPRE, sem depender do regenerate do MA-4. NPC ocupar 2
// locais não é problema: continuidade é rastreada no ledger por revelado/nome (global por NPC, não
// por local, US-199). US-256: só ACRESCENTA — rodar depois da liberação da fatia não contradiz o que
// a jogadora leu, no máximo um NPC passa a estar também noutro local.
function backstopOrphanLocations(
  locations: AdventureLocation[],
  npcs: AdventureNpc[],
  anchoredLocationIds: Set<string>,
): void {
  const occupiedNpcIds = new Set(locations.flatMap((l) => l.occupants))
  const freeNpcs = npcs.filter((n) => !occupiedNpcIds.has(n.id))
  const pool = freeNpcs.length > 0 ? freeNpcs : npcs
  let rr = 0
  for (const loc of locations) {
    if (anchoredLocationIds.has(loc.id) || pool.length === 0) continue
    loc.occupants = [...loc.occupants, pool[rr % pool.length]!.id]
    rr++
  }
}

// US-242: 2º passo do backstop — `interactions` saiu (era a válvula de escape de
// `checkNoOrphanNpcs`), então TODO npc precisa de occupant/npcIds próprio agora, não só os que
// couberam nos locais órfãos acima. Round-robin sobre `locations` inteiro (não só as sem âncora):
// mesmo padrão de "NPC pode ocupar 2 locais, não é problema" (comentário acima) — fecha o grafo por
// construção sem depender de conteúdo opcional da autoria.
function backstopStrandedNpcs(locations: AdventureLocation[], npcs: AdventureNpc[], encounters: AdventureEncounter[]): void {
  const referencedNpcIds = new Set<string>([...encounters.flatMap((e) => e.npcIds), ...locations.flatMap((l) => l.occupants)])
  const strandedNpcs = npcs.filter((n) => !referencedNpcIds.has(n.id))
  let rr = 0
  for (const npc of strandedNpcs) {
    if (locations.length === 0) break
    const loc = locations[rr % locations.length]!
    loc.occupants = [...loc.occupants, npc.id]
    rr++
  }
}

// US-233 (PASSO 2): casa a fiction (npcIds já resolvidos) com a mecânica 5e — papel de statblock
// por posição, determinístico, sem pedir número ao modelo.
// Bugfix (Paladina nível 3, 16/09/2026): orçamento pro nível AGORA é aplicado aqui também
// (assignBudgetedCombatRoles), não só checado pelo gate depois — nível 1-3 modo 'adventure' tem
// orçamento 0 (US-159), então dar papel a TODO npcId sempre estourava a verificação 3 do gate, sem
// chance de passar em nenhuma das 3 tentativas de regenerate. Posição que não cabe no orçamento
// fica sem combatRole (figurante, não desaparece da ficção).
// US-252: nome de criatura do bestiário SRD (US-251) por trás do combatRole — insumo pra narração,
// não rótulo mecânico exposto. `preferredType` fica undefined nesta v1: nem `encounter.type`/
// `location.vibe` (mesmo eixo combat/skill/social, não mapeia pra `type` de criatura) nem
// `faction.kind` (texto livre, sem correspondência com as categorias do bestiário) servem de tema
// hoje — ver US-252, Notas de implementação.
// US-253: índice de `chooseNominalCreature` soma `slotIndex * maxHostileCount` — MESMA fórmula de
// `buildCombatCast` (adventure-generation.service.ts), senão o nome de fallback/confirmação aqui
// diverge do nome que já foi prometido no prompt de autoria pra aquele slot. `slotIndex` é a
// posição do encontro no array (0-based), não um contador só dos `combat`.
function assignCombatMechanics(
  encounters: AdventureEncounter[],
  npcs: AdventureNpc[],
  level: number,
  challenge: EncounterChallenge,
  maxHostileCount: number,
): void {
  encounters.forEach((encounter, slotIndex) => {
    if (encounter.type !== 'combat') return
    const roles = assignBudgetedCombatRoles(encounter.npcIds.length, level, challenge)
    encounter.npcIds.forEach((npcId, i) => {
      const npc = npcs.find((n) => n.id === npcId)
      const role = roles[i]
      if (npc && role) {
        npc.combatRole = role
        npc.nominalCreature = chooseNominalCreature(role, undefined, BESTIARY, slotIndex * maxHostileCount + i)
      }
    })
  })
}

interface RestContext {
  level: number
  challenge: EncounterChallenge
  /** `composeEncounterRoles(level, challenge).length` — o mesmo teto que a 1B recebeu no prompt. */
  maxHostileCount: number
  modelId: string
}

/**
 * 1B: minta desafios/encontros/objetivo sobre a fatia JÁ liberada e devolve o artefato completo
 * (`.parse()` só valida FORMA; grafo/orçamento seguem no gate US-150/US-234).
 *
 * A fatia de entrada NÃO é mutada: os backstops de `occupants` e o PASSO 2 (`combatRole`) mexem
 * numa cópia, então a fatia que já foi persistida em `authoredSlice` continua exatamente o que a
 * jogadora leu (US-256: fatia imutável — só o artefato final ganha os acréscimos).
 */
export function mintRestOntoSlice(slice: AdventureSlice, authored: AuthoredRest, ctx: RestContext): GeneratedAdventure {
  const { npcs, locations } = structuredClone(slice)
  const locationId = locationIdResolver(locations)
  const challenges = mintChallenges(authored, locationId)
  const encounters = mintEncounters(authored, npcs, locationId)
  const objective = {
    description: authored.objective.description,
    reward: authored.objective.reward,
    locationId: locationId(authored.objective.locationIndex),
  }

  const anchoredLocationIds = new Set<string>([
    ...encounters.map((e) => e.locationId),
    ...challenges.map((c) => c.locationId),
    objective.locationId,
    ...locations.filter((l) => l.occupants.length > 0).map((l) => l.id),
  ])
  backstopOrphanLocations(locations, npcs, anchoredLocationIds)
  backstopStrandedNpcs(locations, npcs, encounters)
  assignCombatMechanics(encounters, npcs, ctx.level, ctx.challenge, ctx.maxHostileCount)

  return GeneratedAdventureSchema.parse({
    ...slice,
    npcs,
    locations,
    challenges,
    encounters,
    objective,
    branchedResolution: authored.branchedResolution,
    followUps: authored.followUps,
    restGenerationModel: ctx.modelId,
  })
}
