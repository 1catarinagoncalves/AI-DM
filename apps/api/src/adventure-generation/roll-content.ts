import { createSeededRandom, deriveAdventureSeed } from '@ai-dm/shared'
import { readLgmrdTables, type LgmrdTable, type LgmrdTableRow } from './lgmrd-tables'

export interface RolledAdventureContent {
  premissa: string
  locais: string
  monumentos: string
  complicacao: { condition: string; description: string; origin: string }
}

function pickRow(table: LgmrdTable, rand: () => number): LgmrdTableRow {
  return table.data[Math.floor(rand() * table.data.length)]!
}

// US-147: um sub-seed por tabela (characterId+propósito+order), pela mesma razão do
// roll-registry — o conteúdo não pode deslocar de sequência conforme o registro foi ou não
// escolhido manualmente (rolagens independentes entre si).
function tableSeed(characterId: string, order: number, purpose: string): number {
  return deriveAdventureSeed(`${characterId}:${purpose}`, order)
}

/**
 * Conteúdo — matéria-prima bruta das tabelas do LGMRD, rolada pelo seed determinístico da
 * US-146. Ainda não é prosa (isso é US-149 e a prosa das locações) nem uma GeneratedAdventure
 * montada (US-144) — só a lista de escolhas roladas.
 *
 * `locais`/`monumentos` vêm da MESMA linha de `locationsmonumentsanditems` — um roll dá os
 * dois juntos na fonte (LGMRD), então usam o mesmo sub-seed.
 */
export function rollContent(characterId: string, order: number, tables: ReturnType<typeof readLgmrdTables> = readLgmrdTables()): RolledAdventureContent {
  const questRow = pickRow(tables.tables['1d20quests'], createSeededRandom(tableSeed(characterId, order, 'premissa')))
  const locationRow = pickRow(tables.tables['locationsmonumentsanditems'], createSeededRandom(tableSeed(characterId, order, 'locais')))
  const conditionRow = pickRow(tables.tables['conditiondescriptionandorigin'], createSeededRandom(tableSeed(characterId, order, 'complicacao')))

  return {
    premissa: String(questRow['item']),
    locais: String(locationRow['location']),
    monumentos: String(locationRow['monument']),
    complicacao: {
      condition: String(conditionRow['condition']),
      description: String(conditionRow['description']),
      origin: String(conditionRow['origin']),
    },
  }
}
