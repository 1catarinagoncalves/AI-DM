import { describe, it } from 'vitest'
import { streamText } from 'ai'
import { buildDmSystemPrompt } from './prompts/dm-system'
import { nvidiaModel } from './model'

// Bake-off narrativo (US-17) — SLICE 1: roda os modelos candidatos contra um
// cenário fixo e despeja a narração de cada um lado a lado, com TTFT e tokens.
// SEM juiz ainda (slice 2 = LLM-judge + rubrica Zod). Serve para eyeball das
// prosas + provar o pipeline NVIDIA end to end. Mesma convenção do
// bench-ttft.test.ts: teste vitest gated por env, NÃO roda no `pnpm eval`/CI.
//
// Uso: BAKEOFF=1 NVIDIA_API_KEY=... pnpm --filter @ai-dm/ai-engine test narrative-bakeoff
//      MODELS=a,b,c troca a lista (default = rodada 1 da US-17).
//
// ponytail: parametrização por env (MODELS=), não flag --models de CLI — vitest
// não repassa flags custom bem. Mesmo resultado, sem reinventar o runner.

// ids no formato do NVIDIA NIM (org/modelo). Rodada 1 da US-17.
const DEFAULT_MODELS = [
  'mistralai/mistral-large-3-475b-instruct',
  'qwen/qwen3-next-80b-a3b-instruct',
  'meta/llama-3.3-70b-instruct',
]

/** Lê MODELS=a,b,c do ambiente; trim e descarta vazios. Vazio → rodada 1. */
function parseModels(env: string | undefined): string[] {
  const ids = (env ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return ids.length ? ids : DEFAULT_MODELS
}

// sanity check da única lógica não-óbvia
console.assert(
  parseModels(' a , ,b ').join('|') === 'a|b' &&
    parseModels('').join('|') === DEFAULT_MODELS.join('|'),
  'parseModels bug',
)

const REQ_TIMEOUT_MS = 60_000

// Ficha da paladina de referência (aventura Seraphine) — mesma "source of truth"
// que a narração de produção lê. Cenário = turno de abertura da US-17.
const SYSTEM = buildDmSystemPrompt({
  systemName: 'D&D 5e',
  characterName: 'Lady Seraphine Valthor',
  characterGender: 'feminino',
  characterClass: 'paladina',
  characterRace: 'humana',
  activeQuests: ['Investigar o desaparecimento das crianças de Eldridge'],
  inventory: ['Espada longa Luz da Manhã', 'Escudo do Sol Dourado', 'Armadura de placas'],
  sheet: {
    level: 5,
    hp: 44,
    maxHp: 44,
    attributes: { strength: 16, wisdom: 14, charisma: 16 },
    conditions: [],
  },
})

const PLAYER_ACTION =
  'Chego à vila de Eldridge ao anoitecer, sob chuva fina, e desço do meu cavalo perto do portão entreaberto. Observo o ambiente.'

interface TurnResult {
  model: string
  narration: string
  ttftMs: number | null
  tokens: number | null
  error?: string
}

async function runTurn(modelId: string): Promise<TurnResult> {
  const start = performance.now()
  let ttftMs: number | null = null
  let narration = ''
  try {
    const result = streamText({
      model: nvidiaModel(modelId),
      system: SYSTEM,
      prompt: PLAYER_ACTION,
      abortSignal: AbortSignal.timeout(REQ_TIMEOUT_MS),
    })
    for await (const chunk of result.textStream) {
      if (ttftMs === null) ttftMs = performance.now() - start
      narration += chunk
    }
    const usage = await result.usage
    return { model: modelId, narration, ttftMs, tokens: usage.completionTokens ?? null }
  } catch (e) {
    return { model: modelId, narration, ttftMs, tokens: null, error: (e as Error).message }
  }
}

describe('bake-off narrativo (US-17, slice 1: dump)', () => {
  it.runIf(process.env['BAKEOFF'])(
    'roda os candidatos contra o turno de abertura e despeja as narrações',
    async () => {
      if (!process.env['NVIDIA_API_KEY']) throw new Error('Falta NVIDIA_API_KEY')
      const models = parseModels(process.env['MODELS'])

      // Modelos em paralelo (wall time ≈ modelo mais lento, não a soma).
      const results = await Promise.all(models.map(runTurn))

      for (const r of results) {
        console.log(`\n\n========== ${r.model} ==========`)
        if (r.error) console.log(`✗ erro: ${r.error}`)
        console.log(r.narration || '(vazio)')
      }

      console.table(
        results.map((r) => ({
          modelo: r.model,
          TTFT: r.ttftMs === null ? 'falhou' : `${Math.round(r.ttftMs)} ms`,
          tokens: r.tokens ?? '-',
          chars: r.narration.length,
        })),
      )
    },
    300_000,
  )
})
