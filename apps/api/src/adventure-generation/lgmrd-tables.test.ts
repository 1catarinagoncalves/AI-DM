import { describe, it, expect } from 'vitest'
import { readLgmrdTables } from './lgmrd-tables'

describe('readLgmrdTables (US-147)', () => {
  it('lê o artefato committed com as 4 subsections de rolagem de quest (US-241)', () => {
    const tables = readLgmrdTables()
    const keys = Object.keys(tables.tables)
    expect(keys).toEqual(expect.arrayContaining(['1d20quests', 'conditiondescriptionandorigin', 'locationsmonumentsanditems', 'patronsandnpcs']))
  })

  it('cada tabela tem linhas', () => {
    const tables = readLgmrdTables()
    for (const table of Object.values(tables.tables)) {
      expect(table.data.length).toBeGreaterThan(0)
    }
  })

  it('locationsmonumentsanditems traz location e monument na mesma linha', () => {
    const tables = readLgmrdTables()
    const row = tables.tables['locationsmonumentsanditems'].data[0]!
    expect(row).toHaveProperty('location')
    expect(row).toHaveProperty('monument')
  })
})
