// US-147 — testes de `extractTables` contra uma fixture pequena, em vez de depender do
// `LGMRD.json` real (600KB, gitignored — US-145). `node --test scripts/lazygm/extract-tables.test.mjs`
// (ou `pnpm lazygm:extract:test`).

import assert from 'node:assert/strict'
import test from 'node:test'
import { extractTables } from './extract-tables.mjs'

function fixtureSubsection(id, table) {
  return { id, content: [{ type: 'paragraph' }, { type: 'table', ...table }] }
}

const FIXTURE = {
  version: '1.2.3',
  sections: [
    {
      id: 'coreadventuregenerators',
      subsections: [
        fixtureSubsection('1d20quests', { data: [{ item_num: 1, item: 'Find an item' }] }),
        fixtureSubsection('locationsmonumentsanditems', {
          headers: { d20: 'd20', location: 'Location', monument: 'Monument', item: 'Item' },
          data: [{ d20: '1', location: 'Tower', monument: 'Sarcophagus', item: 'Coin' }],
        }),
        fixtureSubsection('conditiondescriptionandorigin', {
          headers: { d20: 'd20', condition: 'Condition', description: 'Description', origin: 'Origin' },
          data: [{ d20: '1', condition: 'Smoky', description: 'Ruined', origin: 'Human' }],
        }),
        fixtureSubsection('patronsandnpcs', {
          headers: { d20: 'd20', behavior: 'Behavior', ancestry: 'Ancestry' },
          data: [{ d20: '1', behavior: 'Enthusiastic', ancestry: 'Human' }],
        }),
      ],
    },
    {
      id: 'creatingsecrets',
      subsections: [
        fixtureSubsection('charactersecrets', { data: [{ item_num: 1, item: 'What family history might be revealed?' }] }),
        fixtureSubsection('historicalsecrets', { data: [{ item_num: 1, item: 'What dead god has a connection to the area?' }] }),
        fixtureSubsection('npcandvillainsecrets', { data: [{ item_num: 1, item: 'What dark history follows the NPC?' }] }),
        fixtureSubsection('plotandstorysecrets', { data: [{ item_num: 1, item: 'Placeholder plot prompt' }] }),
      ],
    },
  ],
}

test('extractTables pega as 4 subsections de coreadventuregenerators e as 4 de creatingsecrets', () => {
  const result = extractTables(FIXTURE)
  assert.deepEqual(Object.keys(result.tables), [
    '1d20quests',
    'locationsmonumentsanditems',
    'conditiondescriptionandorigin',
    'patronsandnpcs',
    'charactersecrets',
    'historicalsecrets',
    'npcandvillainsecrets',
    'plotandstorysecrets',
  ])
  assert.equal(result.version, '1.2.3')
})

test('extractTables lança erro quando a section creatingsecrets não existe', () => {
  const broken = { version: '1.0.0', sections: [FIXTURE.sections[0]] }
  assert.throws(() => extractTables(broken), /creatingsecrets/)
})

test('extractTables preserva data e headers de cada tabela sem normalizar', () => {
  const result = extractTables(FIXTURE)
  assert.deepEqual(result.tables['locationsmonumentsanditems'].data, [{ d20: '1', location: 'Tower', monument: 'Sarcophagus', item: 'Coin' }])
  assert.deepEqual(result.tables['locationsmonumentsanditems'].headers, { d20: 'd20', location: 'Location', monument: 'Monument', item: 'Item' })
  // 1d20quests não tem headers na fonte real — vira null, não objeto vazio inventado.
  assert.equal(result.tables['1d20quests'].headers, null)
})

test('extractTables lança erro com o id da subsection ausente', () => {
  const broken = { version: '1.0.0', sections: [{ id: 'coreadventuregenerators', subsections: [] }] }
  assert.throws(() => extractTables(broken), /1d20quests/)
})

test('extractTables lança erro quando a section coreadventuregenerators não existe', () => {
  const broken = { version: '1.0.0', sections: [] }
  assert.throws(() => extractTables(broken), /coreadventuregenerators/)
})
