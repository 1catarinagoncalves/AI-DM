import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export interface LgmrdTableRow {
  [column: string]: string | number
}

export interface LgmrdTable {
  headers: Record<string, string> | null
  data: LgmrdTableRow[]
}

export type LgmrdSubsectionId = '1d20quests' | 'locationsmonumentsanditems' | 'conditiondescriptionandorigin' | 'patronsandnpcs'

export interface LgmrdTables {
  version: string
  tables: Record<LgmrdSubsectionId, LgmrdTable>
}

// US-147: `scripts/lazygm/lgmrd-tables.json` é o derivado COMMITTED (extraído de LGMRD.json
// bruto/gitignored por scripts/lazygm/extract-tables.mjs) — sem ele a rolagem quebraria em
// produção, onde `lazygm:sync` nunca roda (CI/Render). Lido em runtime (fs), NÃO por `import`
// de JSON: o artefato mora fora de apps/api, e um import arrastaria o rootDir do tsc para a
// raiz do repo, quebrando `dist/main` — mesmo motivo do readSrdArtifact em
// apps/api/prisma/seed.ts:53.
export function readLgmrdTables(): LgmrdTables {
  return JSON.parse(
    readFileSync(join(__dirname, '../../../../scripts/lazygm/lgmrd-tables.json'), 'utf8'),
  ) as LgmrdTables
}
