// US-232 — smoke E2E: gera uma aventura autoral (call único REAL, paga OpenRouter) para um
// personagem já criado, e valida contra GeneratedAdventureSchema.parse(). Off do CI; roda à mão:
//   npx dotenv-cli -e .env -- pnpm --filter api exec ts-node scripts/run-authoring.ts [characterId]
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { GeneratedAdventureSchema, SystemConfigSchema, resolveLocale, catalogLabel, type SystemConfig } from '@ai-dm/shared'
import { resolveAdventuresAndAdvancement, type CharacterBackground } from '@ai-dm/ai-engine'
import { PrismaService } from '../src/prisma.service'
import { AiService } from '../src/ai/ai.service'
import { AdventureService, type AdventureProfile } from '../src/adventure/adventure.service'
import { configForLocale } from '../src/system/system-locale'

async function main() {
  const prisma = new PrismaService()
  await prisma.$connect()

  const wanted = process.argv[2]
  const character = wanted
    ? await prisma.character.findUnique({ where: { id: wanted }, include: { user: { select: { locale: true } } } })
    : await prisma.character.findFirst({ include: { user: { select: { locale: true } } }, orderBy: { createdAt: 'desc' } })
  if (!character) throw new Error('nenhum personagem encontrado no banco')

  const system = await prisma.system.findUniqueOrThrow({ where: { id: character.systemId } })
  const locale = resolveLocale(character.user?.locale)
  const config = SystemConfigSchema.parse(configForLocale(system, locale)) as SystemConfig
  const origin = (character.origin ?? {}) as { key?: string }

  const profile: AdventureProfile = {
    level: character.level ?? 1,
    classKey: character.class,
    background: (character.background ?? {}) as CharacterBackground,
    origin: { adventuresAndAdvancement: resolveAdventuresAndAdvancement(config.backgrounds, origin.key) },
    hookSeed: '',
    challenge: 'adventure',
  }

  console.log(`Personagem: ${character.name} — ${catalogLabel(config.classes, character.class)} nível ${profile.level} (${locale}) [${character.id}]`)

  const ai = new AiService(prisma, {} as never)
  const svc = new AdventureService(prisma, ai)

  const t0 = Date.now()
  const adventure = await svc.generateAdventure(profile, character.id, 999, locale, config)
  const secs = ((Date.now() - t0) / 1000).toFixed(1)

  GeneratedAdventureSchema.parse(adventure) // lança se a forma não bate

  const dir = resolve(__dirname, '../../../evals/reports')
  mkdirSync(dir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const path = resolve(dir, `authoring-${character.id}-${stamp}.json`)
  writeFileSync(path, JSON.stringify(adventure, null, 2), 'utf8')

  console.log(`\n✅ .parse() OK em ${secs}s`)
  console.log(`💾 artefato: ${path}\n`)
  console.log('Mundo:', adventure.world.name, '—', adventure.world.description.slice(0, 120), '…')
  console.log('Story:', adventure.story.slice(0, 160), '…')
  console.log('Facções:', adventure.factions.map((f) => `${f.name} (${f.kind}) quer ${f.want}`))
  console.log('Objetivo:', adventure.objective.description, '| recompensa:', adventure.objective.reward.name)
  console.log('Desafios:', adventure.challenges.length, '| Encontros:', adventure.encounters.length, '| Locais:', adventure.locations.length, '| NPCs:', adventure.npcs.length)
  console.log('Fecho ramificado:', adventure.branchedResolution.map((b) => b.choice))
  console.log('NPCs want:', adventure.npcs.map((n) => `${n.name}: ${n.want}${n.factionId ? ` [${n.factionId}]` : ''}`))
  console.log('\nStart:', adventure.start)

  await prisma.$disconnect()
}

main().catch((e) => { console.error(e); process.exit(1) })
