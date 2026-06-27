import { createGroq } from '@ai-sdk/groq'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { wrapLanguageModel } from 'ai'
import type { LanguageModelV1Middleware } from 'ai'

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY })

const openrouter = createOpenAICompatible({
  name: 'openrouter',
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
})

const openrouterFallback = openrouter('openai/gpt-oss-120b:free')

// If Groq fails, transparently retry the same call on OpenRouter
const groqFallbackMiddleware: LanguageModelV1Middleware = {
  wrapGenerate: async ({ doGenerate, params }) => {
    try {
      return await doGenerate()
    } catch {
      return await openrouterFallback.doGenerate(params)
    }
  },
  wrapStream: async ({ doStream, params }) => {
    try {
      return await doStream()
    } catch {
      return await openrouterFallback.doStream(params)
    }
  },
}

export const llama33_70b = groq('llama-3.3-70b-versatile')

export const gptOss120b = wrapLanguageModel({
  model: groq('openai/gpt-oss-120b'),
  middleware: groqFallbackMiddleware,
})

export const defaultModel = gptOss120b
