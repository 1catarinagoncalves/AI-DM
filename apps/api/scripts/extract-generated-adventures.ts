// US-244 — puxa aventuras já geradas e persistidas em prod (Adventure.generatedAdventure,
// US-144/US-239) e grava cada uma como JSON completo em evals/reports/, em vez de provisionar
// disco/bucket pra prod (Render Free não tem disco persistente, ver US-243 "Contexto"). Allowlist
// de creator.email é fixa no código, não flag de CLI: quem entra é decisão de quem edita o
// script, não parâmetro de quem roda (ver US, "Fora do escopo").
//
// Uso (DATABASE_URL de prod NÃO vem do .env da raiz, que é o de dev — ver CLAUDE.md):
//   DATABASE_URL=... pnpm --filter api exec ts-node scripts/extract-generated-adventures.ts
import { GeneratedAdventureSchema, type GeneratedAdventure } from '@ai-dm/shared'
import { PrismaService } from '../src/prisma.service'
import { writeAuthoringDump } from '../src/adventure/adventure-authoring-dump'

export const ALLOWED_EMAILS = ['catarinagoncalves2005@gmail.com']

export interface ExtractableAdventure {
  id: string
  generatedAdventure: unknown
  creator: { email: string }
  participants: { characterId: string }[]
}

type Write = (characterId: string, generated: GeneratedAdventure) => string

// Testável sem Postgres: recebe linhas já buscadas, decide o que grava. `write` é injetável
// pro teste trocar por um espião em vez de tocar disco de verdade (mesmo padrão do
// vi.mock('node:fs') em adventure.service.test.ts, só que sem precisar mockar o módulo).
export function extractAdventures(rows: ExtractableAdventure[], write: Write = writeAuthoringDump): { written: string[]; skipped: string[] } {
  const written: string[] = []
  const skipped: string[] = []
  for (const row of rows) {
    if (!ALLOWED_EMAILS.includes(row.creator.email)) continue
    const parsed = GeneratedAdventureSchema.safeParse(row.generatedAdventure)
    if (!parsed.success) {
      console.error(`Adventure ${row.id}: artefato fora da forma de GeneratedAdventureSchema, pulado`)
      skipped.push(row.id)
      continue
    }
    // Fase 1 é single-player: 1 participante por aventura gerada. Sem participante (não
    // deveria acontecer com generatedAdventure preenchido) cai no id da aventura, não lança.
    const characterId = row.participants[0]?.characterId ?? row.id
    written.push(write(characterId, parsed.data))
  }
  return { written, skipped }
}

async function main() {
  const prisma = new PrismaService()
  await prisma.$connect()

  const rows = await prisma.adventure.findMany({
    where: { generatedAdventure: { not: null }, creator: { email: { in: ALLOWED_EMAILS } } },
    include: { creator: true, participants: true },
  })

  const { written, skipped } = extractAdventures(rows)

  console.log(`✅ ${written.length} aventura(s) gravada(s) em evals/reports/`)
  if (skipped.length) console.log(`⚠️  ${skipped.length} pulada(s) por artefato inválido: ${skipped.join(', ')}`)

  await prisma.$disconnect()
}

if (require.main === module) {
  main().catch((e) => { console.error(e); process.exit(1) })
}
