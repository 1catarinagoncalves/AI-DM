// US-145 — teste de regressão do pin do sync do LGMRD (SHA fixo, nunca main/HEAD) e do
// NOTICE gerado a partir do `attribution`.
// `node --test scripts/lazygm/sync.test.mjs` (ou `pnpm lazygm:sync:test`).

import assert from 'node:assert/strict'
import test from 'node:test'

import { SHA, buildNotice } from './sync.mjs'

test('SHA é um commit fixo (40 hex), nunca uma branch/ref móvel', () => {
  assert.match(SHA, /^[0-9a-f]{40}$/)
  assert.doesNotMatch(SHA, /main|HEAD/i)
})

test('buildNotice reproduz o attribution de cada fonte verbatim', () => {
  const notice = buildNotice({
    lgmrd: 'texto da LGMRD com vailable (typo da fonte)',
    monsterBuilder: 'texto do Monster Builder',
  })
  assert.match(notice, /texto da LGMRD com vailable \(typo da fonte\)/)
  assert.match(notice, /texto do Monster Builder/)
  assert.match(notice, /CC-BY-4\.0/)
})
