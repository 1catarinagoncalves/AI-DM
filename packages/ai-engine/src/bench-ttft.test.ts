import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { streamText } from 'ai'
import { describe, it } from 'vitest'

// Benchmark de TTFT (time to first token) dos modelos candidatos no NVIDIA NIM.
// NÃO é um eval (não pontua qualidade) — só mede latência até a 1ª palavra.
//
// Uso:  NVIDIA_API_KEY=... BENCH=1 pnpm --filter @ai-dm/ai-engine test bench-ttft
// Sem BENCH=1 fica skip, para não gastar API paga no `pnpm test`/CI.
// ponytail: roda na suite vitest existente em vez de trazer tsx só para um script.

// ids no formato do NVIDIA NIM (org/modelo). Trim/edita a lista à vontade.
const MODELS = [
  'nvidia/nemotron-3-super-120b-a12b',
  'z-ai/glm-5.1',
  'qwen/qwen3-next-80b-a3b-instruct',
  'minimaxai/minimax-m2.7',
  'deepseek-ai/deepseek-v4-flash',
  'minimaxai/minimax-m3',
  'mistralai/mistral-medium-3.5-128b',
  'stockmark/stockmark-2-100b-instruct',
  'openai/gpt-oss-120b',
]

const RUNS = 3
const PROMPT =
  'Você é o mestre de RPG. Narre em 2 frases a chegada do herói a uma taverna movimentada ao anoitecer.'

const nvidia = createOpenAICompatible({
  name: 'nvidia',
  baseURL: 'https://integrate.api.nvidia.com/v1',
  apiKey: process.env['NVIDIA_API_KEY'],
})

const REQ_TIMEOUT_MS = 45_000 // corta pedido pendurado p/ não comer o orçamento do run

/** TTFT em ms: do início do pedido até o primeiro chunk de texto do stream. */
async function measureTTFT(modelId: string): Promise<number> {
  const start = performance.now()
  const result = streamText({
    model: nvidia(modelId),
    prompt: PROMPT,
    abortSignal: AbortSignal.timeout(REQ_TIMEOUT_MS),
  })
  for await (const _chunk of result.textStream) {
    return performance.now() - start
  }
  throw new Error('stream vazio (sem token de texto)')
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2
}

// sanity check da única lógica não-óbvia
console.assert(median([3, 1, 2]) === 2 && median([1, 2, 3, 4]) === 2.5, 'median bug')

describe('benchmark TTFT (NVIDIA NIM)', () => {
  it.runIf(process.env['BENCH'])(
    'mede e compara o tempo até a primeira palavra',
    async () => {
      if (!process.env['NVIDIA_API_KEY']) throw new Error('Falta NVIDIA_API_KEY')

      // modelos em paralelo (wall time ≈ modelo mais lento, não a soma);
      // os RUNS de cada modelo ficam em série para não inflar a própria latência.
      const results = await Promise.all(
        MODELS.map(async (model) => {
          const samples: number[] = []
          for (let i = 0; i < RUNS; i++) {
            try {
              samples.push(await measureTTFT(model))
            } catch (e) {
              console.error(`  ✗ ${model}: ${(e as Error).message}`)
            }
          }
          return { model, ttftMs: samples.length ? median(samples) : null }
        }),
      )

      results.sort((a, b) => (a.ttftMs ?? Infinity) - (b.ttftMs ?? Infinity))
      console.table(
        results.map((r) => ({
          modelo: r.model,
          'TTFT (mediana)': r.ttftMs === null ? 'falhou' : `${Math.round(r.ttftMs)} ms`,
        })),
      )
    },
    300_000, // 9 modelos × 3 runs podem demorar
  )
})
