// US-152 — extract-monster-roles: recorta de `_data/5e_Monster_Builder.json` (gitignored,
// US-145) a seção "General-Use Combat Stat Blocks" e grava um derivado committed
// (monster-roles.json). Script irmão de extract-benchmark.mjs (US-159): mesmo molde raw→
// committed, artefato próprio porque a seção-fonte é outra (`generalusestatblocks`).
//
// O CR por papel (Minion 1/8, Soldier 1/2, Brute 2) é HARDCODED em
// apps/api/src/adventure-generation/monster-roles.ts, não lido deste JSON em runtime. Este
// derivado serve só de guard de drift: se a seção ou uma das 3 subseções sumir/mudar de id
// na fonte, este script falha alto antes de sobrescrever o committed.
//
// Uso: node scripts/lazygm/extract-monster-roles.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const DATA_PATH = join(HERE, '_data', '5e_Monster_Builder.json')
const OUT_PATH = join(HERE, 'monster-roles.json')

const SECTION_ID = 'generalusestatblocks'
const SUBSECTION_IDS = ['minion', 'soldier', 'brute']

export function extractMonsterRoles(monsterBuilder) {
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
    cr: { minion: '1/8', soldier: '1/2', brute: '2' },
  }
}

function main() {
  const raw = JSON.parse(readFileSync(DATA_PATH, 'utf8'))
  const extracted = extractMonsterRoles(raw)
  writeFileSync(OUT_PATH, JSON.stringify(extracted, null, 2) + '\n')
  console.log(`monster-roles.json escrito → ${OUT_PATH}`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main()
  } catch (e) {
    console.error('extract-monster-roles falhou:', e.message)
    process.exit(1)
  }
}
