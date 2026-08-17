// US-159 — extract-benchmark: recorta de `_data/5e_Monster_Builder.json` (gitignored, US-145)
// a seção "The Lazy Encounter Benchmark" e grava um derivado committed
// (lazy-encounter-benchmark.json). Script irmão de extract-tables.mjs (US-147), artefato
// próprio porque a seção é prosa (`type: 'paragraph'`, `markdown`), não tabela —
// extractTables() exige `content[].type === 'table'` em toda subsection que lê.
//
// A fórmula em si (Math.floor(L/4) etc., ver lazy-encounter-benchmark.ts) é HARDCODED, não
// lida deste JSON em runtime. Este derivado serve só de guard de drift: se a seção sumir ou
// mudar de id na fonte, este script falha alto antes de sobrescrever o committed.
//
// Uso: node scripts/lazygm/extract-benchmark.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const DATA_PATH = join(HERE, '_data', '5e_Monster_Builder.json')
const OUT_PATH = join(HERE, 'lazy-encounter-benchmark.json')

const SECTION_ID = 'lazyencounterbenchmark'
const SUBSECTION_IDS = ['usingthebenchmark', 'thecrcapforasinglemonster']

export function extractBenchmark(monsterBuilder) {
  const section = monsterBuilder.sections?.find((s) => s.id === SECTION_ID)
  if (!section) {
    throw new Error(`Section "${SECTION_ID}" ausente em 5e_Monster_Builder.json — esperado sections[].id === "${SECTION_ID}"`)
  }

  const sourceSubsections = {}
  for (const id of SUBSECTION_IDS) {
    const sub = section.subsections?.find((s) => s.id === id)
    if (!sub) {
      throw new Error(`Subsection "${id}" ausente em ${SECTION_ID}.subsections — esperado um item com id === "${id}"`)
    }
    sourceSubsections[id] = sub.title
  }

  return {
    version: monsterBuilder.version,
    sourceSubsections,
    deadlyDivisor: { upToLevel4: 4, level5Plus: 2 },
    singleMonsterCapMultiplier: { upToLevel4: 1, level5Plus: 1.5 },
    levelBreakpoint: 5,
  }
}

function main() {
  const raw = JSON.parse(readFileSync(DATA_PATH, 'utf8'))
  const extracted = extractBenchmark(raw)
  writeFileSync(OUT_PATH, JSON.stringify(extracted, null, 2) + '\n')
  console.log(`lazy-encounter-benchmark.json escrito → ${OUT_PATH}`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main()
  } catch (e) {
    console.error('extract-benchmark falhou:', e.message)
    process.exit(1)
  }
}
