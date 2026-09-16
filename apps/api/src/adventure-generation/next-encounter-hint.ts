import type { AdventureEncounter, AdventureLocation, WorldEntity } from '@ai-dm/shared'

/**
 * US-166: sinal determinístico pro Mestre saber qual dos encontros ainda não foi
 * "descoberto" (proxy: local ainda não `revelado` no ledger). Sem IA, sem campo novo em
 * `WorldEntity` — `locations` resolve `locationId → título`, único jeito de casar um
 * encontro com sua entidade de local no ledger (chaveado por `nome`, não por `id`).
 *
 * US-194 pulava sempre o encontro 1 aqui: naquela arquitetura, `composeStartBriefing`
 * (adventure.service.ts) montava `start` POR CÓDIGO a partir do `EncounterDraft` do
 * encontro 1 — garantia estrutural de que a abertura narrava aquele local, então o hint
 * teria que pular pra não se contradizer.
 *
 * US-232 (autoria mundo-primeiro) apagou essa composição: `start` hoje é
 * `authored.start`, prosa livre que o modelo escreve como parte da seção Story, ANTES de
 * `encounters[]` existir na ordem de emissão do prompt (`buildAuthoringPrompt`,
 * ai.service.ts) — não há `locationIndex` nem qualquer campo que ligue `start` a um
 * local específico. `composeStartBriefing` não existe mais no repo (grep vazio). Manter o
 * pulo fixo do encontro 1 sem essa garantia é pior que não ter pulo nenhum: se `start`
 * descrever OUTRO local (comum, já que a ligação não é mais estrutural), o encontro 1 —
 * genuinamente não descoberto — fica escondido do hint PARA SEMPRE (o filtro por id não
 * expira com o passar dos turnos), enquanto o local que `start` de fato narrou nunca é
 * marcado `revelado` e mais cedo ou mais tarde aparece como "ainda não descoberto" —
 * exatamente o defeito que a US-194 queria evitar, só que num local diferente.
 *
 * Sem uma forma barata de saber qual local `start` narrou, a correção é não pular
 * nenhum por número: `revelado` (seedLedgerFromGeneratedAdventure semeia TODO local como
 * `false`) volta a ser o único critério de exclusão.
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
