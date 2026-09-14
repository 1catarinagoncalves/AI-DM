import { createSeededRandom, deriveAdventureSeed } from '@ai-dm/shared'
import { readLgmrdTables, type LgmrdTable, type LgmrdTableRow, type LgmrdTables } from './lgmrd-tables'

const CONDITION_ATTRIBUTES = ['condition', 'description', 'origin'] as const
type ConditionAttribute = (typeof CONDITION_ATTRIBUTES)[number]

function pickRow(table: LgmrdTable, rand: () => number): LgmrdTableRow {
  return table.data[Math.floor(rand() * table.data.length)]!
}

// US-241: sub-seed por PROPÓSITO (`characterId:quest:<propósito>`), mesma disciplina de
// `tableSeed` (roll-content.ts) — conceito primário, caminho do MacGuffin (A/B), e cada
// rolagem dentro do caminho escolhido nunca compartilham sequência entre si.
function questSubSeed(characterId: string, order: number, purpose: string, attempt: number): number {
  return deriveAdventureSeed(`${characterId}:quest:${purpose}`, order, attempt)
}

// US-241: caminho A da fórmula do LGMRD — `locationsmonumentsanditems` (uma linha, `location`
// + `monument` juntos, como `rollContent` já lia) combinada com 2 dos 3 atributos de
// `conditiondescriptionandorigin`. Diferente de `rollContent`: cada atributo escolhido é
// rolado numa COLUNA independente (sub-seed próprio), não a mesma linha pros 3 juntos — as
// colunas dessa tabela não têm relação temática entre si (ver Notas de implementação da US-241).
function rollLocationMacguffin(characterId: string, order: number, tables: LgmrdTables, attempt: number): string {
  const locationRow = pickRow(
    tables.tables['locationsmonumentsanditems'],
    createSeededRandom(questSubSeed(characterId, order, 'macguffinLocation', attempt)),
  )
  const excludeRand = createSeededRandom(questSubSeed(characterId, order, 'macguffinAttrChoice', attempt))
  const excluded = CONDITION_ATTRIBUTES[Math.floor(excludeRand() * CONDITION_ATTRIBUTES.length)]!
  const [attr1, attr2] = CONDITION_ATTRIBUTES.filter((attr): attr is ConditionAttribute => attr !== excluded) as [ConditionAttribute, ConditionAttribute]
  const value1 = String(pickRow(tables.tables['conditiondescriptionandorigin'], createSeededRandom(questSubSeed(characterId, order, `macguffinAttr-${attr1}`, attempt)))[attr1])
  const value2 = String(pickRow(tables.tables['conditiondescriptionandorigin'], createSeededRandom(questSubSeed(characterId, order, `macguffinAttr-${attr2}`, attempt)))[attr2])

  return `of the ${String(locationRow['monument'])} in the ${String(locationRow['location'])}, which is ${value1} and ${value2}`
}

// US-241: caminho B — `patronsandnpcs` sozinha, alternativa ao caminho A inteiro.
function rollPatronMacguffin(characterId: string, order: number, tables: LgmrdTables, attempt: number): string {
  const row = pickRow(tables.tables['patronsandnpcs'], createSeededRandom(questSubSeed(characterId, order, 'macguffinPatron', attempt)))
  return `a ${String(row['behavior'])} ${String(row['ancestry'])} demands it`
}

/**
 * US-241: fórmula de gancho do LGMRD (Sly Flourish) pro campo `summary` — conceito primário
 * (`1d20quests`) + MacGuffin (caminho A: local/monumento + 2 de 3 atributos de
 * condição/descrição/origem; caminho B: patrono/NPC), unidos por "because". Semente EM
 * INGLÊS, efêmera — só entra como restrição do prompt de autoria (`buildAuthoringPrompt`),
 * nunca persistida nem exposta à jogadora. Determinística: mesmo trio de argumentos produz
 * sempre a mesma semente, mesma disciplina de `rollFactionCount`/`rollNamingRegister`.
 */
export function rollQuestSeed(characterId: string, order: number, attempt = 0): string {
  const tables = readLgmrdTables()
  const concept = String(pickRow(tables.tables['1d20quests'], createSeededRandom(questSubSeed(characterId, order, 'concept', attempt)))['item'])
  const pathRand = createSeededRandom(questSubSeed(characterId, order, 'macguffinPath', attempt))
  const macguffin = pathRand() < 0.5 ? rollLocationMacguffin(characterId, order, tables, attempt) : rollPatronMacguffin(characterId, order, tables, attempt)

  return `${concept} because ${macguffin}`
}
