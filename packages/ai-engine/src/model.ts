import { createGroq } from '@ai-sdk/groq'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import type { LanguageModelV1 } from 'ai'

const groq = createGroq({
  apiKey: process.env['GROQ_API_KEY'],
})

// Candidatos do bake-off narrativo (US-17) via endpoint preview grátis do
// NVIDIA NIM. Mesmo provider do bench-ttft.test.ts. Só usado nos evals — a
// narração de produção continua no Groq (narrationModels abaixo).
const nvidia = createOpenAICompatible({
  name: 'nvidia',
  baseURL: 'https://integrate.api.nvidia.com/v1',
  apiKey: process.env['NVIDIA_API_KEY'],
})

/** Modelo candidato da NVIDIA NIM por id (`org/modelo`), para os evals da US-17. */
export const nvidiaModel = (id: string): LanguageModelV1 => nvidia(id)

// Narração: gpt-oss-120b como primário (Groq). O id na Groq leva o prefixo do
// provider de origem — `openai/gpt-oss-120b`; sem ele a API responde "model does
// not exist or you do not have access".
export const primaryModel: LanguageModelV1 = groq('openai/gpt-oss-120b')
// Fallback: llama-3.3-70b-versatile via Groq.
export const fallbackModel: LanguageModelV1 = groq('llama-3.3-70b-versatile')

// Modelos de narração em ordem de prioridade. O serviço tenta o primeiro e,
// se ele falhar ANTES de emitir texto, cai para o próximo.
export const narrationModels: LanguageModelV1[] = [primaryModel, fallbackModel]

// Compat: modelo principal isolado.
export const defaultModel: LanguageModelV1 = primaryModel

// Sumarização de memória: tarefa simples; usa o modelo mais rápido e barato.
export const summaryModel: LanguageModelV1 = groq('llama-3.1-8b-instant')
