// US-238 — eval AO VIVO da aventura gerada: gera uma aventura por PERFIL PINADO (chamadas REAIS, pagas
// no OpenRouter + o juiz Gemini), roda os asserts sobre o artefato BRUTO (antes do gate — é assim que
// se mede vazamento de número na prosa) e grava evals/reports/us-238-<data>.md. Off do CI; roda à mão:
//   npx dotenv-cli -e .env -- pnpm --filter api exec ts-node scripts/run-adventure-eval.ts [--pipeline] [--profile <id>]
//
//   --pipeline   temperature 0 + snapshot pinado do modelo (PIPELINE_AUTHORING_SAMPLING) — teste de
//                PIPELINE (prompt → mint → gate → asserts), não de criatividade. Sem a flag: a escada e a
//                temperatura de produção (variedade real, o que o jogador recebe).
//   --profile    roda só um perfil (id de adventure-eval-profiles.ts).
//
// A decisão de regressão é dos ASSERTS (exit 1 se algum falhar). A nota do juiz é registrada no relatório
// mas nunca decide: ela satura nesta tarefa (US-17). Sem GEMINI_API_KEY o juiz é pulado, os asserts rodam.
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PIPELINE_AUTHORING_SAMPLING, type AuthoringSampling, type CharacterBackground } from '@ai-dm/ai-engine'
import { SystemConfigSchema, resolveLocale, catalogLabel, type GeneratedAdventure, type Locale, type SystemConfig } from '@ai-dm/shared'
import { PrismaService } from '../src/prisma.service'
import { AiService } from '../src/ai/ai.service'
import { AdventureGenerationService, AUTHORING_COUNTS, type AdventureProfile } from '../src/adventure/adventure-generation.service'
import { runAdventureGate } from '../src/adventure-generation/adventure-gate'
import { adventureEvalPassed, assertAdventureArtifact, exemplarSection, renderAdventureEvalReport, type AdventureEvalMeta, type AdventureEvalRun } from '../src/adventure-generation/adventure-eval'
import { ADVENTURE_EVAL_ATTEMPT, ADVENTURE_EVAL_ORDER, ADVENTURE_EVAL_PROFILES, expectationFor, type AdventureEvalProfile } from '../src/adventure-generation/adventure-eval-profiles'
import { judgeAdventureProse } from '../src/adventure-generation/adventure-eval-live'
import { configForLocale } from '../src/system/system-locale'

const LOCALE: Locale = resolveLocale('pt-BR')
const REPO_ROOT = resolve(__dirname, '../../..')

const flagValue = (name: string): string | undefined => {
  const at = process.argv.indexOf(name)
  return at >= 0 ? process.argv[at + 1] : undefined
}

// `git rev-parse` nunca derruba o eval: relatório sem hash é melhor que relatório nenhum.
function gitHead(): string {
  try { return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8', cwd: REPO_ROOT }).trim() } catch { return 'unknown' }
}

function toAdventureProfile(profile: AdventureEvalProfile): AdventureProfile {
  return { level: profile.level, classKey: profile.classKey, background: { story: profile.story } as CharacterBackground, origin: {}, hookSeed: '', challenge: profile.challenge }
}

async function generateRaw(generation: AdventureGenerationService, profile: AdventureEvalProfile, config: SystemConfig, sampling?: AuthoringSampling): Promise<{ adventure: GeneratedAdventure; challenge: AdventureProfile['challenge'] }> {
  const record = await generation.generateSlice(toAdventureProfile(profile), profile.characterId, ADVENTURE_EVAL_ORDER, LOCALE, config, profile.registry, ADVENTURE_EVAL_ATTEMPT, sampling)
  const className = catalogLabel(config.classes, profile.classKey)
  const adventure = await generation.generateRestArtifact(record.slice, { challenge: record.challenge, namingRegister: record.namingRegister, locale: LOCALE, className, sampling })
  return { adventure, challenge: record.challenge }
}

async function judgeOrUndefined(adventure: GeneratedAdventure, exemplarMd: string): Promise<number | undefined> {
  if (!process.env['GEMINI_API_KEY']) return undefined
  const dmResponse = exemplarSection(exemplarMd, 'Setting')
  const exemplar = dmResponse ? { playerAction: '[abertura de uma aventura autoral] a jogadora lê a ambientação.', dmResponse } : undefined
  try {
    return (await judgeAdventureProse(adventure, exemplar)).media
  } catch (err) {
    console.warn(`⚠️ juiz falhou (${err instanceof Error ? err.message : String(err)}) — nota n/a, asserts seguem`)
    return undefined
  }
}

async function runProfile(generation: AdventureGenerationService, profile: AdventureEvalProfile, config: SystemConfig, exemplarMd: string, sampling?: AuthoringSampling): Promise<AdventureEvalRun> {
  try {
    const { adventure, challenge } = await generateRaw(generation, profile, config, sampling)
    const gate = runAdventureGate(adventure, challenge, config)
    return {
      profileId: profile.id,
      assertions: assertAdventureArtifact(adventure, expectationFor(profile, AUTHORING_COUNTS.challenges)),
      gate: gate.ok ? 'ok' : `reprovou (${gate.stage}): ${gate.reason}`,
      judgeMedia: await judgeOrUndefined(adventure, exemplarMd),
    }
  } catch (err) {
    return { profileId: profile.id, assertions: [], gate: '-', error: err instanceof Error ? err.message : String(err) }
  }
}

async function main() {
  const only = flagValue('--profile')
  const profiles = ADVENTURE_EVAL_PROFILES.filter((p) => !only || p.id === only)
  if (profiles.length === 0) throw new Error(`perfil "${only}" não existe — ids: ${ADVENTURE_EVAL_PROFILES.map((p) => p.id).join(', ')}`)
  const pipeline = process.argv.includes('--pipeline')
  const sampling = pipeline ? PIPELINE_AUTHORING_SAMPLING : undefined

  const prisma = new PrismaService()
  await prisma.$connect()
  const system = await prisma.system.findFirstOrThrow({ where: { name: { contains: 'D&D 5e' } } })
  const config = SystemConfigSchema.parse(configForLocale(system, LOCALE)) as SystemConfig
  const exemplarMd = readFileSync(resolve(REPO_ROOT, 'evals/exemplars/cripta-do-veu-silencioso.md'), 'utf8')
  const generation = new AdventureGenerationService(prisma, new AiService(prisma, {} as never))

  const runs: AdventureEvalRun[] = []
  for (const profile of profiles) {
    console.log(`▶ ${profile.id} (${pipeline ? 'pipeline' : 'produção'})…`)
    runs.push(await runProfile(generation, profile, config, exemplarMd, sampling))
  }
  await prisma.$disconnect()

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const meta: AdventureEvalMeta = { mode: pipeline ? 'pipeline' : 'producao', gitHead: gitHead(), timestamp, judgeModel: process.env['JUDGE_MODEL'] ?? 'gemini-3.1-flash-lite' }
  const md = renderAdventureEvalReport(runs, meta)
  const reportsDir = resolve(REPO_ROOT, 'evals/reports')
  mkdirSync(reportsDir, { recursive: true })
  writeFileSync(resolve(reportsDir, `us-238-${timestamp}.md`), md, 'utf8')
  console.log(`\n${md}`)
  process.exit(adventureEvalPassed(runs) ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(1) })
