import type { AdventureEncounter, AdventureLocation, WorldEntity } from '@ai-dm/shared'

/**
 * US-166: sinal determinístico pro Mestre saber qual dos 8 encontros ainda não foi
 * "descoberto" (proxy: local ainda não `revelado` no ledger). Sem IA, sem campo novo em
 * `WorldEntity` — `locations` resolve `locationId → título`, único jeito de casar um
 * encontro com sua entidade de local no ledger (chaveado por `nome`, não por `id`).
 */
export function nextUnrevealedEncounterLocation(
  encounters: AdventureEncounter[],
  locations: AdventureLocation[],
  entities: WorldEntity[],
): AdventureEncounter | null {
  const titleByLocationId = new Map(locations.map((l) => [l.id, l.title]))
  const revealedTitles = new Set(entities.filter((e) => e.revelado).map((e) => e.nome))

  const sorted = [...encounters].sort((a, b) => encounterNumber(a.id) - encounterNumber(b.id))
  return sorted.find((encounter) => {
    const title = titleByLocationId.get(encounter.locationId)
    return title !== undefined && !revealedTitles.has(title)
  }) ?? null
}

function encounterNumber(id: string): number {
  return Number(id.split('-').pop())
}
