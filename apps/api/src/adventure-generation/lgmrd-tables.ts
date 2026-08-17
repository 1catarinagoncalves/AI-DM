import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export interface LgmrdTableRow {
  [column: string]: string | number
}

export interface LgmrdTable {
  headers: Record<string, string> | null
  data: LgmrdTableRow[]
}

export type LgmrdSubsectionId =
  | '1d20quests'
  | 'locationsmonumentsanditems'
  | 'conditiondescriptionandorigin'
  | 'patronsandnpcs'
  | SecretPromptCategory

// US-149: os 40 prompts-molde de segredo do LGMRD, 4 categorias × 10 cada.
export type SecretPromptCategory = 'charactersecrets' | 'historicalsecrets' | 'npcandvillainsecrets' | 'plotandstorysecrets'

export type SecretPrompts = Record<SecretPromptCategory, string[]>

export interface LgmrdTables {
  version: string
  tables: Record<LgmrdSubsectionId, LgmrdTable>
}

const SECRET_PROMPT_CATEGORIES: SecretPromptCategory[] = ['charactersecrets', 'historicalsecrets', 'npcandvillainsecrets', 'plotandstorysecrets']

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

// US-149: os 40 prompts-molde de segredo, achatados pra `string[]` por categoria —
// `generateSecrets` (ai.service.ts) só precisa do texto da pergunta, não de `item_num`.
export function readSecretPrompts(tables: LgmrdTables = readLgmrdTables()): SecretPrompts {
  return Object.fromEntries(
    SECRET_PROMPT_CATEGORIES.map((category) => [category, tables.tables[category].data.map((row) => String(row['item']))]),
  ) as SecretPrompts
}
