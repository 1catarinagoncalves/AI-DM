import { describe, it, expect } from 'vitest'
import { readLgmrdTables, readSecretPrompts } from './lgmrd-tables'

describe('readLgmrdTables (US-147)', () => {
  it('lê o artefato committed com as 4 subsections da rolagem + as 4 de segredo (US-149)', () => {
    const tables = readLgmrdTables()
    expect(Object.keys(tables.tables).sort()).toEqual(
      [
        '1d20quests',
        'conditiondescriptionandorigin',
        'locationsmonumentsanditems',
        'patronsandnpcs',
        'charactersecrets',
        'historicalsecrets',
        'npcandvillainsecrets',
        'plotandstorysecrets',
      ].sort(),
    )
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

describe('readSecretPrompts (US-149)', () => {
  it('achata as 4 categorias em 10 prompts de texto cada (40 no total)', () => {
    const prompts = readSecretPrompts()
    expect(Object.keys(prompts).sort()).toEqual(
      ['charactersecrets', 'historicalsecrets', 'npcandvillainsecrets', 'plotandstorysecrets'].sort(),
    )
    for (const category of Object.values(prompts)) {
      expect(category).toHaveLength(10)
      expect(category.every((p) => typeof p === 'string' && p.length > 0)).toBe(true)
    }
  })
})
