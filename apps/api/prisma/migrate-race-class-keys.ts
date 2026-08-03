// US-105 — migração de dados: `Character.race`/`Character.class` deixam de guardar o texto
// que o jogador escolheu ("Anão", "Mago") e passam a guardar a CHAVE do catálogo do sistema
// ("dwarf", "wizard"). Não há migração de schema: as duas colunas já são `String`.
//
// Uso (o .env da RAIZ carrega DATABASE_URL, como todo script de banco deste repo):
//   pnpm db:migrate:race-class          → CONTAGEM, não escreve nada (o padrão)
//   pnpm db:migrate:race-class --write  → aplica
//
// Idempotente: ficha cuja coluna já é chave do catálogo é ignorada, então rodar duas vezes
// não desfaz nada. Ficha que NÃO casa não é tocada nem chutada — sai no relatório para
// decisão à mão. O catálogo é fechado (US-105 → Questões em aberto #2): não existe chave
// `custom` para onde empurrar o que sobra.
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import type { SystemCatalogEntry, SystemConfig } from '@ai-dm/shared'

const WRITE = process.argv.includes('--write')

/** Lowercase + sem diacríticos — só para casar texto legado. */
function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
}

// Texto legado normalizado → chave do catálogo. O `CLASS_SYNONYMS` que vivia em
// starting-inventory.ts (matcher de substring do caminho de LEITURA, tirado de lá pela US-105)
// continua aqui, que é o seu único uso legítimo: rodar uma vez sobre dado antigo.
//
// Ordem importa: chave mais específica antes da ampla ('paladin' antes de 'ladin').
export const CLASS_SYNONYMS: [string, string][] = [
  ['paladin', 'paladin'],
  ['guerreir', 'fighter'],
  ['lutador', 'fighter'],
  ['fighter', 'fighter'],
  ['arqueir', 'ranger'],
  ['patrulhei', 'ranger'],
  ['cacador', 'ranger'],
  ['ranger', 'ranger'],
  ['ladin', 'rogue'],
  ['ladr', 'rogue'],
  ['assassin', 'rogue'],
  ['rogue', 'rogue'],
  ['cleri', 'cleric'],
  ['sacerdot', 'cleric'],
  ['barbar', 'barbarian'],
  ['druid', 'druid'],
  ['bard', 'bard'],
  // 'feitic' (não 'feiticer'): "feiticeiro" = f-e-i-t-i-c-e-i-r-o NÃO contém "feiticer"
  // (o 'i' de -eiro quebra o match). Bug latente pré-US-42: Feiticeiro caía no default.
  ['feitic', 'sorcerer'],
  ['sorcer', 'sorcerer'],
  ['brux', 'warlock'],
  ['warlock', 'warlock'],
  ['monge', 'monk'],
  ['mong', 'monk'],
  ['monk', 'monk'],
  ['mag', 'wizard'],
  ['wizard', 'wizard'],
]

// Raça nunca teve matcher (era campo decorativo). Aqui ele é EXATO, não por substring: os
// valores legados vêm de um <select> fechado de 9 opções, e substring casaria "Meio-Orc"
// dentro de 'orc' — que é justamente a espécie NOVA da união (ADR 009).
export const RACE_ALIASES: Record<string, string> = {
  anao: 'dwarf', dwarf: 'dwarf',
  elfo: 'elf', elf: 'elf',
  halfling: 'halfling',
  humano: 'human', human: 'human',
  dragonborn: 'dragonborn', draconato: 'dragonborn',
  gnomo: 'gnome', gnome: 'gnome',
  'meio-elfo': 'half-elf', 'meio elfo': 'half-elf', 'half-elf': 'half-elf',
  'meio-orc': 'half-orc', 'meio orc': 'half-orc', 'half-orc': 'half-orc',
  tiefling: 'tiefling',
  goliath: 'goliath',
  orc: 'orc',
}

/** Chave do catálogo para um valor legado, ou null quando nada casa. */
export function toKey(value: string, catalog: SystemCatalogEntry[], synonyms: [string, string][], aliases?: Record<string, string>): string | null {
  const valid = new Set(catalog.map((e) => e.key))
  if (valid.has(value)) return value // já migrado (ou nasceu chave) — idempotência
  const text = normalize(value)
  const exact = aliases?.[text]
  if (exact && valid.has(exact)) return exact
  for (const [keyword, key] of synonyms) {
    if (text.includes(keyword) && valid.has(key)) return key
  }
  return null
}

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })
  // `select` explícito (e não `include: { system: true }`): a migração só precisa do nome e da
  // base EN do config, e pedir a linha inteira quebra num banco cuja coluna nova ainda não
  // existe — que é exatamente o banco onde uma migração de dados costuma rodar.
  const characters = await prisma.character.findMany({
    select: { id: true, name: true, race: true, class: true, system: { select: { name: true, config: true } } },
  })
  console.log(`${characters.length} ficha(s). Modo: ${WRITE ? 'ESCRITA' : 'contagem (use --write para aplicar)'}\n`)

  // Guard de ordem: sem o catálogo no `System.config`, TODA ficha sairia como "sem destino" e o
  // relatório seria ruído. O catálogo entra no banco pelo seed — que roda antes desta migração.
  const semCatalogo = [...new Set(
    characters
      .filter((c) => {
        const cfg = c.system.config as SystemConfig | null
        return !cfg?.races?.length || !cfg?.classes?.length
      })
      .map((c) => c.system.name),
  )]
  if (semCatalogo.length) {
    throw new Error(
      `Sistema(s) sem catálogo de raça/classe no config: ${semCatalogo.join(', ')}. ` +
        'Rode `pnpm db:seed` antes desta migração (é o seed que grava races/classes — US-105).',
    )
  }

  const tally = new Map<string, number>() // "campo: antes → depois" → quantas
  const stuck: string[] = [] // sem destino: reportado, nunca chutado
  let changed = 0

  for (const c of characters) {
    // O config do sistema traz o catálogo. Base EN basta: a CHAVE é a mesma nos dois locales.
    const config = c.system.config as SystemConfig | null
    const race = toKey(c.race, config?.races ?? [], [], RACE_ALIASES)
    const charClass = toKey(c.class, config?.classes ?? [], CLASS_SYNONYMS)

    for (const [field, from, to] of [['race', c.race, race], ['class', c.class, charClass]] as const) {
      if (to === null) stuck.push(`${c.id} (${c.name}) — ${field}: "${from}" sem destino no catálogo de ${c.system.name}`)
      else if (to !== from) tally.set(`${field}: "${from}" → ${to}`, (tally.get(`${field}: "${from}" → ${to}`) ?? 0) + 1)
    }

    if (race === null || charClass === null) continue
    if (race === c.race && charClass === c.class) continue
    changed++
    if (WRITE) await prisma.character.update({ where: { id: c.id }, data: { race, class: charClass } })
  }

  for (const [line, n] of [...tally].sort()) console.log(`  ${n}×  ${line}`)
  if (stuck.length) {
    console.log(`\n  SEM DESTINO (${stuck.length}) — nenhuma destas foi tocada:`)
    for (const s of stuck) console.log(`    ${s}`)
  }
  console.log(`\n${WRITE ? `${changed} ficha(s) migrada(s).` : `${changed} ficha(s) migrariam.`}`)
  await prisma.$disconnect()
}

// Guard de entrypoint: o .test.ts importa `toKey` daqui, e sem isto o import abriria conexão
// com o banco (mesmo motivo do guard no scripts/srd/ingest.mjs).
if (require.main === module) {
  main().catch((e) => {
    console.error('migração falhou:', e.message)
    process.exit(1)
  })
}
