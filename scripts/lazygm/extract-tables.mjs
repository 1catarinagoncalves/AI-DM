// US-147 — extract-tables: recorta de `_data/LGMRD.json` (gitignored, US-145) só as
// subsections de `coreadventuregenerators` que o motor de rolagem usa, e grava o resultado
// em `lgmrd-tables.json` (committed). Sem isso a rolagem em produção quebraria — CI/Render
// nunca rodam `lazygm:sync` (ver render.yaml), e o `LGMRD.json` bruto não existe lá. Mesmo
// padrão do SRD: `_data/` bruto gitignored, derivado committed (scripts/srd/ingest.mjs).
//
// Não normaliza schema (a forma de `data` continua não-uniforme por tabela, ver Questão 1
// da US-147) — só recorte do que a rolagem lê.
//
// Uso: node scripts/lazygm/extract-tables.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const DATA_PATH = join(HERE, '_data', 'LGMRD.json')
const OUT_PATH = join(HERE, 'lgmrd-tables.json')

// Subsections de `coreadventuregenerators` que o motor de rolagem (US-147) e a geração de
// NPCs (GEN-3, futura) consomem. `1d20quests` → premissa; `locationsmonumentsanditems` →
// locais+monumentos (um roll dá os dois); `conditiondescriptionandorigin` → complicação;
// `patronsandnpcs` → NPC/patrono (extraído aqui, rolado só quando a story de NPCs chegar).
const SUBSECTION_IDS = ['1d20quests', 'locationsmonumentsanditems', 'conditiondescriptionandorigin', 'patronsandnpcs']

export function extractTables(lgmrd) {
  const section = lgmrd.sections?.find((s) => s.id === 'coreadventuregenerators')
  if (!section) {
    throw new Error(`Section "coreadventuregenerators" ausente no LGMRD.json — esperado sections[].id === "coreadventuregenerators"`)
  }

  const tables = {}
  for (const id of SUBSECTION_IDS) {
    const sub = section.subsections?.find((s) => s.id === id)
    if (!sub) {
      throw new Error(`Subsection "${id}" ausente em coreadventuregenerators.subsections — esperado um item com id === "${id}"`)
    }
    const table = sub.content?.find((c) => c.type === 'table')
    if (!table) {
      throw new Error(`Subsection "${id}" não tem content do tipo "table" — esperado content[].type === "table"`)
    }
    tables[id] = { headers: table.headers ?? null, data: table.data }
  }

  return { version: lgmrd.version, tables }
}

function main() {
  const raw = JSON.parse(readFileSync(DATA_PATH, 'utf8'))
  const extracted = extractTables(raw)
  writeFileSync(OUT_PATH, JSON.stringify(extracted, null, 2) + '\n')
  console.log(`lgmrd-tables.json escrito (${SUBSECTION_IDS.length} tabelas) → ${OUT_PATH}`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main()
  } catch (e) {
    console.error('extract-tables falhou:', e.message)
    process.exit(1)
  }
}
