// US-100 — migração de dados: `Character.features`/`Character.spells` deixam de guardar o TEXTO
// copiado do config na criação (`{name, description}`) e passam a guardar a CHAVE do catálogo
// (`barbarian_rage`, `sacred-flame`). Não há migração de schema: as duas colunas já são `Json`.
//
// Uso (o .env da RAIZ carrega DATABASE_URL, como todo script de banco deste repo):
//   pnpm db:migrate:feature-spell          → CONTAGEM por origem, não escreve nada (o padrão)
//   pnpm db:migrate:feature-spell --write  → aplica
//
// Idempotente: item que já é string (chave) passa direto, então rodar duas vezes não desfaz nada.
// Ficha com item que NÃO casa não é tocada nem chutada — sai no relatório. Rode a contagem ANTES
// de escrever: item fora das origens conhecidas é caso novo, não escape (US-100 → Migração §4).
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import type { SystemClassFeature, SystemConfig, SystemSpell } from '@ai-dm/shared'

const WRITE = process.argv.includes('--write')

/** Lowercase + sem diacríticos — só para casar texto legado. Mesmo `normalize` do resto do repo. */
function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').trim()
}

/** Índice de um domínio: `classe → nome normalizado → chave`, mais o balde `*` do catálogo inteiro. */
export type NameIndex = Map<string, Map<string, Set<string>>>

const ANY_CLASS = '*'

/**
 * Índice de migração a partir de TODOS os locales do sistema (US-100 → Migração §1).
 *
 * A união é o ponto: ficha pt-BR nem sempre guarda texto PT. Entre a US-47 e a US-52, 64 chaves
 * caíam no fallback EN — quem criou um guerreiro nessa janela tem `"Weapon Mastery"` gravado, e o
 * config pt-BR de hoje chama isso de `"Domínio de Armas"`. Ficha criada em `en-US` tem texto EN
 * inteiro. Procurar só no locale do dono perderia as duas.
 *
 * O escopo por classe (§2) é o que evita a chave errada em silêncio: `"Domínio de Armas"` aparece
 * em 5 classes, e a chave é prefixada por ela (`fighter_weapon-mastery`). O balde `*` existe para
 * o caso em que a classe não resolve — só é aceito quando o nome é ÚNICO no catálogo inteiro.
 */
export function buildNameIndex(configs: (Partial<SystemConfig> | null | undefined)[], domain: 'features' | 'spells'): NameIndex {
  const index: NameIndex = new Map()
  const add = (classKey: string, name: string, key: string) => {
    const byName = index.get(classKey) ?? new Map<string, Set<string>>()
    const keys = byName.get(normalize(name)) ?? new Set<string>()
    keys.add(key)
    byName.set(normalize(name), keys)
    index.set(classKey, byName)
  }
  for (const config of configs) {
    const byClass = domain === 'features' ? config?.classFeatures : config?.classSpells
    const retired = domain === 'features' ? config?.retiredFeatures : config?.retiredSpells
    for (const [classKey, entries] of Object.entries(byClass ?? {})) {
      for (const entry of entries as (SystemClassFeature | SystemSpell)[]) {
        add(classKey, entry.name, entry.key)
        add(ANY_CLASS, entry.name, entry.key)
      }
    }
    // Conteúdo aposentado também casa: é dele que vive a ficha que ninguém migrou ainda.
    for (const entry of Object.values(retired ?? {}) as (SystemClassFeature | SystemSpell)[]) {
      add(ANY_CLASS, entry.name, entry.key)
    }
  }
  return index
}

/**
 * Chave de um item legado, ou null quando nada casa (nunca chuta).
 *
 * Ordem da US-100 → Migração §2: 1) escopo pela classe da ficha — reproduz a escolha da criação;
 * 2) classe que não resolve (ficha pré-US-105 com texto cru, sistema sem a classe) cai no catálogo
 * inteiro e só aceita nome ÚNICO. O passo 3 da story (decidir pela classe que contém as outras
 * features da ficha) não foi implementado: desde a US-105 `Character.class` é chave VALIDADA
 * contra o catálogo, então "classe ambígua e irresolúvel" não tem como acontecer numa ficha que
 * passou pela migração anterior — e adivinhar seria pior que reportar.
 */
export function toEntryKey(item: unknown, classKey: string, index: NameIndex): string | null {
  if (typeof item === 'string') return item // já migrado (ou nasceu chave) — idempotência
  const name = (item as { name?: unknown })?.name
  if (typeof name !== 'string' || !name.trim()) return null
  const scoped = index.get(classKey)?.get(normalize(name))
  if (scoped?.size === 1) return [...scoped][0]!
  const anywhere = index.get(ANY_CLASS)?.get(normalize(name))
  if (anywhere?.size === 1) return [...anywhere][0]!
  return null
}

/** Locales do sistema: a base EN (`config`) mais cada `configLocales[*]`. */
function allConfigs(system: { config: unknown; configLocales: unknown }): (Partial<SystemConfig> | null)[] {
  const locales = Object.values((system.configLocales ?? {}) as Record<string, Partial<SystemConfig>>)
  return [system.config as Partial<SystemConfig> | null, ...locales]
}

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })
  // `select` explícito pelo mesmo motivo da migração da US-105: pedir a linha inteira quebra num
  // banco cuja coluna nova ainda não existe — que é onde uma migração de dados costuma rodar.
  const characters = await prisma.character.findMany({
    select: {
      id: true, name: true, class: true, features: true, spells: true,
      system: { select: { name: true, config: true, configLocales: true } },
    },
  })
  console.log(`${characters.length} ficha(s). Modo: ${WRITE ? 'ESCRITA' : 'contagem (use --write para aplicar)'}\n`)

  // Guard de ordem, igual ao da US-105: sem catálogo no config toda ficha sairia "sem destino" e o
  // relatório viraria ruído. Quem grava o catálogo com `key` é o seed (US-106), que roda antes.
  const semChave = [...new Set(
    characters
      .filter((c) => {
        const entries = Object.values((c.system.config as SystemConfig | null)?.classFeatures ?? {}).flat()
        return entries.length > 0 && !entries.every((e) => e.key)
      })
      .map((c) => c.system.name),
  )]
  if (semChave.length) {
    throw new Error(
      `Sistema(s) cujo config tem feature SEM \`key\`: ${semChave.join(', ')}. ` +
        'Rode `pnpm srd:ingest` e `pnpm db:seed` antes desta migração (é a US-106 que preserva a chave).',
    )
  }

  const tally = new Map<string, number>() // "domínio: texto → chave" → quantas
  const stuck: string[] = [] // sem destino: reportado, nunca chutado
  let changed = 0

  // Índice por SISTEMA, não por ficha: montá-lo dentro do loop refaria o mesmo mapa de 84 magias
  // a cada personagem. `systemId` não está no select — o nome do sistema basta como chave aqui.
  const indexes = new Map<string, { features: NameIndex; spells: NameIndex }>()
  const indexFor = (system: typeof characters[number]['system']) => {
    const cached = indexes.get(system.name)
    if (cached) return cached
    const configs = allConfigs(system)
    const built = { features: buildNameIndex(configs, 'features'), spells: buildNameIndex(configs, 'spells') }
    indexes.set(system.name, built)
    return built
  }

  for (const c of characters) {
    const index = indexFor(c.system)
    const before = { features: (c.features ?? []) as unknown[], spells: (c.spells ?? []) as unknown[] }
    const after = {
      features: before.features.map((i) => toEntryKey(i, c.class, index.features)),
      spells: before.spells.map((i) => toEntryKey(i, c.class, index.spells)),
    }

    for (const domain of ['features', 'spells'] as const) {
      after[domain].forEach((key, i) => {
        const item = before[domain][i]
        if (key === null) stuck.push(`${c.id} (${c.name}) — ${domain}: ${JSON.stringify(item)} sem destino no catálogo de ${c.system.name}`)
        else if (typeof item !== 'string') {
          const line = `${domain}: "${(item as { name?: string })?.name}" → ${key}`
          tally.set(line, (tally.get(line) ?? 0) + 1)
        }
      })
    }

    const keys = [...after.features, ...after.spells]
    if (keys.some((k) => k === null)) continue // ficha com item sem destino não é tocada NEM PELA METADE
    if ([...before.features, ...before.spells].every((i) => typeof i === 'string')) continue
    changed++
    if (WRITE) {
      await prisma.character.update({
        where: { id: c.id },
        data: { features: after.features as string[], spells: after.spells as string[] },
      })
    }
  }

  for (const [line, n] of [...tally].sort()) console.log(`  ${n}×  ${line}`)
  if (stuck.length) {
    console.log(`\n  SEM DESTINO (${stuck.length}) — nenhuma destas fichas foi tocada:`)
    for (const s of stuck) console.log(`    ${s}`)
  }
  console.log(`\n${WRITE ? `${changed} ficha(s) migrada(s).` : `${changed} ficha(s) migrariam.`}`)
  await prisma.$disconnect()
}

// Guard de entrypoint: o .test.ts importa os puros daqui, e sem isto o import abriria conexão
// com o banco (mesmo motivo do guard em migrate-race-class-keys.ts).
if (require.main === module) {
  main().catch((e) => {
    console.error('migração falhou:', e.message)
    process.exit(1)
  })
}
