// US-214 — backfill de dados: soma o idioma FIXO de RACE_LANGUAGES a `Character.languages`
// (sem duplicar) e remove as chaves 'languages'/'extra-language' de `Character.features`
// — agora que `ingest.mjs` parou de emitir essas entradas em `raceFeatures`, uma ficha
// antiga que ainda aponte pra elas cairia no fallback `{key, name: key}` de
// `resolveSheetEntries` (system.ts:314-330), um card vazio na aba Features.
//
// Uso (o .env da RAIZ carrega DATABASE_URL, como todo script de banco deste repo):
//   pnpm db:migrate:race-languages          → CONTAGEM, não escreve nada (o padrão)
//   pnpm db:migrate:race-languages --write  → aplica
//
// Idempotente: idioma já presente em `languages` não duplica (Set); chave já ausente de
// `features` não é tocada de novo — rodar duas vezes não desfaz nada. Cobre só o idioma
// FIXO — o extra à escolha de fichas antigas (Alto-elfo/Humano/Meio-elfo) fica de fora
// (US-214 §Fora do escopo: impossível inferir o que a jogadora teria escolhido).
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { RACE_LANGUAGES } from '@ai-dm/shared'

const WRITE = process.argv.includes('--write')
const STALE_FEATURE_KEYS = new Set(['languages', 'extra-language'])

/**
 * `languages`/`features` pós-backfill pra UM personagem, ou `null` quando nada muda —
 * o `null` é o que torna o script idempotente (ficha já migrada não é regravada à toa).
 */
export function computeBackfill(
  character: { race: string; languages: unknown; features: unknown },
): { languages: string[]; features: string[] } | null {
  const fixedLanguages = RACE_LANGUAGES[character.race] ?? []
  const beforeLanguages = (character.languages ?? []) as string[]
  const languages = [...new Set([...beforeLanguages, ...fixedLanguages])]

  const beforeFeatures = (character.features ?? []) as string[]
  const features = beforeFeatures.filter((k) => !STALE_FEATURE_KEYS.has(k))

  if (languages.length === beforeLanguages.length && features.length === beforeFeatures.length) return null
  return { languages, features }
}

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })
  const characters = await prisma.character.findMany({
    select: { id: true, name: true, race: true, languages: true, features: true },
  })
  console.log(`${characters.length} ficha(s). Modo: ${WRITE ? 'ESCRITA' : 'contagem (use --write para aplicar)'}\n`)

  let changed = 0
  for (const c of characters) {
    const result = computeBackfill(c)
    if (!result) continue
    changed++
    const addedLanguages = result.languages.length - ((c.languages as unknown[] | null)?.length ?? 0)
    const removedFeatures = ((c.features as unknown[] | null)?.length ?? 0) - result.features.length
    console.log(`  ${c.id} (${c.name}, ${c.race}): +${addedLanguages} idioma(s), -${removedFeatures} feature(s) obsoleta(s)`)
    if (WRITE) {
      await prisma.character.update({ where: { id: c.id }, data: { languages: result.languages, features: result.features } })
    }
  }

  console.log(`\n${WRITE ? `${changed} ficha(s) migrada(s).` : `${changed} ficha(s) migrariam.`}`)
  await prisma.$disconnect()
}

// Guard de entrypoint: o .test.ts importa `computeBackfill` daqui, e sem isto o import abriria
// conexão com o banco (mesmo motivo do guard em migrate-race-class-keys.ts).
if (require.main === module) {
  main().catch((e) => {
    console.error('migração falhou:', e.message)
    process.exit(1)
  })
}
