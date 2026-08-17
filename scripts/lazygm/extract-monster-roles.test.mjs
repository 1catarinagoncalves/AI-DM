// US-152 — testes de `extractMonsterRoles` contra fixture pequena, mesmo padrão de
// extract-benchmark.test.mjs (US-159). `node --test scripts/lazygm/extract-monster-roles.test.mjs`
// (ou `pnpm lazygm:extract-monster-roles:test`).

import assert from 'node:assert/strict'
import test from 'node:test'
import { extractMonsterRoles } from './extract-monster-roles.mjs'

function fixtureSection(subsections) {
  return { id: 'generalusestatblocks', subsections }
}

const FIXTURE = {
  version: '3.1.0',
  sections: [
    fixtureSection([
      { id: 'minion', title: 'Minion (CR 1/8)' },
      { id: 'soldier', title: 'Soldier (CR 1/2)' },
      { id: 'brute', title: 'Brute (CR 2)' },
    ]),
  ],
}

test('extractMonsterRoles pega version e os títulos das 3 subsections', () => {
  const result = extractMonsterRoles(FIXTURE)
  assert.equal(result.version, '3.1.0')
  assert.deepEqual(result.sourceSubsections, {
    minion: 'Minion (CR 1/8)',
    soldier: 'Soldier (CR 1/2)',
    brute: 'Brute (CR 2)',
  })
})

test('extractMonsterRoles hardcoda o CR por papel, não deriva do título', () => {
  const result = extractMonsterRoles(FIXTURE)
  assert.deepEqual(result.cr, { minion: '1/8', soldier: '1/2', brute: '2' })
})

test('extractMonsterRoles lança erro quando a section generalusestatblocks não existe', () => {
  const broken = { version: '1.0.0', sections: [] }
  assert.throws(() => extractMonsterRoles(broken), /generalusestatblocks/)
})

test('extractMonsterRoles lança erro quando minion sumiu (drift guard)', () => {
  const broken = {
    version: '1.0.0',
    sections: [fixtureSection([{ id: 'soldier', title: 'x' }, { id: 'brute', title: 'y' }])],
  }
  assert.throws(() => extractMonsterRoles(broken), /minion/)
})

test('extractMonsterRoles lança erro quando soldier sumiu (drift guard)', () => {
  const broken = {
    version: '1.0.0',
    sections: [fixtureSection([{ id: 'minion', title: 'x' }, { id: 'brute', title: 'y' }])],
  }
  assert.throws(() => extractMonsterRoles(broken), /soldier/)
})

test('extractMonsterRoles lança erro quando brute sumiu (drift guard)', () => {
  const broken = {
    version: '1.0.0',
    sections: [fixtureSection([{ id: 'minion', title: 'x' }, { id: 'soldier', title: 'y' }])],
  }
  assert.throws(() => extractMonsterRoles(broken), /brute/)
})
