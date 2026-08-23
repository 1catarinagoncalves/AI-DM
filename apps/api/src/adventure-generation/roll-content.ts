import { createSeededRandom, deriveAdventureSeed } from '@ai-dm/shared'
import { readLgmrdTables, type LgmrdTable, type LgmrdTableRow } from './lgmrd-tables'

export interface RolledPatronOrNpc {
  behavior: string
  ancestry: string
}

export interface RolledAdventureContent {
  premissaCandidates: string[]
  locais: string
  monumentos: string
  complicacao: { condition: string; description: string; origin: string }
  patronsandnpcs: RolledPatronOrNpc[]
}

// US-158: uma linha de `patronsandnpcs` dá `behavior`+`ancestry` para ~1 NPC — o modelo
// inventa nome/papel em cima disso (ver Notas de implementação da US-158), então
// rolar 7x cobre os ~7 NPCs do backlog.
const NPC_ROLL_COUNT = 7

// US-192: 5 é o número do artigo-fonte (Adventure Generator, Shadowdark RPG) — rolar N
// candidatos de `1d20quests` e deixar `generatePremissa` (ai.service.ts) escolher/elaborar
// o que mais puxa a personagem DIRETAMENTE para a ação, não arbitrário.
const PREMISSA_ROLL_COUNT = 5

function pickRow(table: LgmrdTable, rand: () => number): LgmrdTableRow {
  return table.data[Math.floor(rand() * table.data.length)]!
}

// US-147: um sub-seed por tabela (characterId+propósito+order), pela mesma razão do
// roll-registry — o conteúdo não pode deslocar de sequência conforme o registro foi ou não
// escolhido manualmente (rolagens independentes entre si). `attempt` (US-150, reseed): default
// `0`, repassado ao seed de cada tabela.
function tableSeed(characterId: string, order: number, purpose: string, attempt = 0): number {
  return deriveAdventureSeed(`${characterId}:${purpose}`, order, attempt)
}

// US-158: sub-seed POR ROLL (`npc-1`..`npc-7`), não um único `npc` compartilhado — mesma
// garantia de independência do resto da tabela: rolar mais ou menos NPCs no futuro não
// desloca a sequência dos outros campos.
function rollPatronsAndNpcs(characterId: string, order: number, table: LgmrdTable, attempt: number): RolledPatronOrNpc[] {
  return Array.from({ length: NPC_ROLL_COUNT }, (_, i) => {
    const row = pickRow(table, createSeededRandom(tableSeed(characterId, order, `npc-${i + 1}`, attempt)))
    return { behavior: String(row['behavior']), ancestry: String(row['ancestry']) }
  })
}

// US-192: sub-seed POR ROLL (`premissa-1`..`premissa-5`), mesmo padrão de `rollPatronsAndNpcs`
// — cada candidato independente do resto da tabela, rolar mais/menos candidatos no futuro
// não desloca a sequência dos outros campos.
function rollPremissaCandidates(characterId: string, order: number, table: LgmrdTable, attempt: number): string[] {
  return Array.from({ length: PREMISSA_ROLL_COUNT }, (_, i) => {
    const row = pickRow(table, createSeededRandom(tableSeed(characterId, order, `premissa-${i + 1}`, attempt)))
    return String(row['item'])
  })
}

/**
 * Conteúdo — matéria-prima bruta das tabelas do LGMRD, rolada pelo seed determinístico da
 * US-146. Ainda não é prosa (isso é US-158, locais/NPCs, e US-149, segredos) nem uma
 * GeneratedAdventure montada (US-144) — só a lista de escolhas roladas.
 *
 * `locais`/`monumentos` vêm da MESMA linha de `locationsmonumentsanditems` — um roll dá os
 * dois juntos na fonte (LGMRD), então usam o mesmo sub-seed.
 */
export function rollContent(
  characterId: string,
  order: number,
  tables: ReturnType<typeof readLgmrdTables> = readLgmrdTables(),
  attempt = 0,
): RolledAdventureContent {
  const locationRow = pickRow(tables.tables['locationsmonumentsanditems'], createSeededRandom(tableSeed(characterId, order, 'locais', attempt)))
  const conditionRow = pickRow(tables.tables['conditiondescriptionandorigin'], createSeededRandom(tableSeed(characterId, order, 'complicacao', attempt)))

  return {
    premissaCandidates: rollPremissaCandidates(characterId, order, tables.tables['1d20quests'], attempt),
    locais: String(locationRow['location']),
    monumentos: String(locationRow['monument']),
    complicacao: {
      condition: String(conditionRow['condition']),
      description: String(conditionRow['description']),
      origin: String(conditionRow['origin']),
    },
    patronsandnpcs: rollPatronsAndNpcs(characterId, order, tables.tables['patronsandnpcs'], attempt),
  }
}
