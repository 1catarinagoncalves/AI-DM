import { createGroq } from '@ai-sdk/groq'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'

const groq = createGroq({ apiKey: process.env['GROQ_API_KEY'] })

const openrouter = createOpenAICompatible({
  name: 'openrouter',
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env['OPENROUTER_API_KEY'],
})

// Modelo principal: rápido e barato para narração
export const defaultModel = groq('llama-3.3-70b-versatile')

// Modelo auxiliar para sumarização de memória: tarefa simples, modelo menor
// e mais barato, para não consumir o limite de TPM da narração.
export const summaryModel = groq('llama-3.1-8b-instant')

// Modelo alternativo via OpenRouter (usar se quiser trocar)
export const openrouterModel: ReturnType<typeof openrouter> = openrouter('openai/gpt-4o-mini')
