import { generateText, generateObject } from 'ai'
import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import {
  primaryModel,
  fallbackModel,
  groqFallbackModel,
  NARRATION_PROVIDER_OPTIONS,
  EXTRACTION_PROVIDER_OPTIONS,
} from './model'

// Smoke de CONTRATO com o provider: cada combinação (modelo × providerOptions × modo de
// chamada) que a API usa em produção faz aqui uma chamada real e mínima. Não pontua
// qualidade — só responde "o provider aceita este request?".
//
// Existe por um bug de 04/08/2026: `generateObject` manda `tool_choice` (modo tool do
// openai-compatible), o thinking do DeepSeek recusa essa combinação, e as três extrações
// estruturadas falhavam em 100% das chamadas por três dias. Typecheck, teste unitário e
// eval não pegam isso — a forma do request só o provider valida. Este é o teste que pega.
//
// Uso:  CONTRACT=1 npx dotenv -e .env -- pnpm --filter @ai-dm/ai-engine test provider-contract
// Sem CONTRACT=1 fica skip: são chamadas pagas, não entram no `pnpm test`/CI.
// Rodar ao mexer em model.ts (modelo novo, opção de provider nova) e antes de deploy.

const REQ_TIMEOUT_MS = 45_000

const PROSE_PROMPT = 'Responda apenas com a palavra: pronto.'

// Schema mínimo com array + string: reproduz a forma dos OPENING_*_SCHEMA sem o custo.
const SMOKE_SCHEMA = z.object({
  local: z.string(),
  presentes: z.array(z.string()),
})
const EXTRACTION_PROMPT = 'Texto: "Na taverna, Bran enche uma caneca." Extraia o local e quem está presente.'

describe('contrato com o provider', () => {
  it.runIf(process.env['CONTRACT'])(
    'narração: primário aceita reasoning + pin de rota',
    async () => {
      const { text } = await generateText({
        model: primaryModel,
        prompt: PROSE_PROMPT,
        providerOptions: NARRATION_PROVIDER_OPTIONS,
        abortSignal: AbortSignal.timeout(REQ_TIMEOUT_MS),
      })
      expect(text.trim().length).toBeGreaterThan(0)
    },
    REQ_TIMEOUT_MS,
  )

  it.runIf(process.env['CONTRACT'])(
    'narração: fallback aceita as mesmas opções (é o degrau que assume quando o primário cai)',
    async () => {
      const { text } = await generateText({
        model: fallbackModel,
        prompt: PROSE_PROMPT,
        providerOptions: NARRATION_PROVIDER_OPTIONS,
        abortSignal: AbortSignal.timeout(REQ_TIMEOUT_MS),
      })
      expect(text.trim().length).toBeGreaterThan(0)
    },
    REQ_TIMEOUT_MS,
  )

  it.runIf(process.env['CONTRACT'])(
    'narração: 3º degrau (Groq, outro provider) responde — é o que sobrevive a um outage do OpenRouter',
    async () => {
      const { text } = await generateText({
        model: groqFallbackModel,
        prompt: PROSE_PROMPT,
        providerOptions: NARRATION_PROVIDER_OPTIONS,
        abortSignal: AbortSignal.timeout(REQ_TIMEOUT_MS),
      })
      expect(text.trim().length).toBeGreaterThan(0)
    },
    REQ_TIMEOUT_MS,
  )

  it.runIf(process.env['CONTRACT'])(
    'extração: generateObject com thinking desligado devolve objeto (o caso que quebrou)',
    async () => {
      const { object } = await generateObject({
        model: primaryModel,
        schema: SMOKE_SCHEMA,
        prompt: EXTRACTION_PROMPT,
        providerOptions: EXTRACTION_PROVIDER_OPTIONS,
        abortSignal: AbortSignal.timeout(REQ_TIMEOUT_MS),
      })
      expect(object.local.trim().length).toBeGreaterThan(0)
    },
    REQ_TIMEOUT_MS,
  )
})
