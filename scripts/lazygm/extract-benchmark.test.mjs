// US-159 — testes de `extractBenchmark` contra fixture pequena, mesmo padrão de
// extract-tables.test.mjs (US-147). `node --test scripts/lazygm/extract-benchmark.test.mjs`
// (ou `pnpm lazygm:extract-benchmark:test`).

import assert from 'node:assert/strict'
import test from 'node:test'
import { extractBenchmark } from './extract-benchmark.mjs'

function fixtureSection(subsections) {
  return { id: 'lazyencounterbenchmark', subsections }
}

const FIXTURE = {
  version: '3.1.0',
  sections: [
    fixtureSection([
      { id: 'usingthebenchmark', title: 'Using the Benchmark' },
      { id: 'thecrcapforasinglemonster', title: 'The CR Cap for a Single Monster' },
    ]),
  ],
}

test('extractBenchmark pega version e os títulos das 2 subsections', () => {
  const result = extractBenchmark(FIXTURE)
  assert.equal(result.version, '3.1.0')
  assert.deepEqual(result.sourceSubsections, {
    usingthebenchmark: 'Using the Benchmark',
    thecrcapforasinglemonster: 'The CR Cap for a Single Monster',
  })
})

test('extractBenchmark hardcoda a fórmula do LGMRD, não lê do markdown', () => {
  const result = extractBenchmark(FIXTURE)
  assert.deepEqual(result.deadlyDivisor, { upToLevel4: 4, level5Plus: 2 })
  assert.deepEqual(result.singleMonsterCapMultiplier, { upToLevel4: 1, level5Plus: 1.5 })
  assert.equal(result.levelBreakpoint, 5)
})

test('extractBenchmark lança erro quando a section lazyencounterbenchmark não existe', () => {
  const broken = { version: '1.0.0', sections: [] }
  assert.throws(() => extractBenchmark(broken), /lazyencounterbenchmark/)
})

test('extractBenchmark lança erro quando usingthebenchmark sumiu (drift guard)', () => {
  const broken = { version: '1.0.0', sections: [fixtureSection([{ id: 'thecrcapforasinglemonster', title: 'x' }])] }
  assert.throws(() => extractBenchmark(broken), /usingthebenchmark/)
})

test('extractBenchmark lança erro quando thecrcapforasinglemonster sumiu (drift guard)', () => {
  const broken = { version: '1.0.0', sections: [fixtureSection([{ id: 'usingthebenchmark', title: 'x' }])] }
  assert.throws(() => extractBenchmark(broken), /thecrcapforasinglemonster/)
})
