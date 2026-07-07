import { createGroq } from '@ai-sdk/groq'
import type { LanguageModelV1 } from 'ai'

const groq = createGroq({
  apiKey: process.env['GROQ_API_KEY'],
})

// Narração: llama-3.3-70b-versatile como primário (Groq).
export const primaryModel: LanguageModelV1 = groq('llama-3.3-70b-versatile')
// Fallback: gpt-oss-120b via Groq (conforme solicitado).
export const fallbackModel: LanguageModelV1 = groq('gpt-oss-120b')

// Modelos de narração em ordem de prioridade. O serviço tenta o primeiro e,
// se ele falhar ANTES de emitir texto, cai para o próximo.
export const narrationModels: LanguageModelV1[] = [primaryModel, fallbackModel]

// Compat: modelo principal isolado.
export const defaultModel: LanguageModelV1 = primaryModel

// Sumarização de memória: tarefa simples; usa o modelo mais rápido e barato.
export const summaryModel: LanguageModelV1 = groq('llama-3.1-8b-instant')
