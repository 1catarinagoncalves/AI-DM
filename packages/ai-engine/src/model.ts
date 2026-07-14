import { createGroq } from '@ai-sdk/groq'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import type { LanguageModelV1 } from 'ai'

const groq = createGroq({
  apiKey: process.env['GROQ_API_KEY'],
})

// Juiz do bake-off (US-17, slice 2): externo aos candidatos NVIDIA/Groq → sem
// self-preference bias. Default gemini-flash-latest (alias vivo — `gemini-2.5-flash`
// foi descontinuado para novos users em 2026-07; os *-pro têm quota-zero no free
// tier). O flash-tier discrimina bem (spread real); gpt-4o-mini satura. Pin em
// @ai-sdk/google@1.2.x (mesma geração AI SDK v4 / provider 1.1.3 do groq).
const google = createGoogleGenerativeAI({
  apiKey: process.env['GEMINI_API_KEY'],
})

// Providers alternativos de juiz (fallback quando o free tier do Gemini acaba).
// OpenAI e OpenRouter são OpenAI-compatible → reaproveitam o mesmo encanamento,
// sem dependência nova.
const openaiJudge = createOpenAICompatible({
  name: 'openai',
  baseURL: 'https://api.openai.com/v1',
  apiKey: process.env['OPENAI_API_KEY'],
})
const openrouterJudge = createOpenAICompatible({
  name: 'openrouter',
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env['OPENROUTER_API_KEY'],
})

/**
 * Modelo-juiz do bake-off. Trocável por env JUDGE_MODEL, roteado por prefixo:
 * `openai:<id>` → OpenAI, `openrouter:<id>` → OpenRouter, senão Google (Gemini).
 * Default gemini-2.5-flash (grátis). Ex.: JUDGE_MODEL=openai:gpt-5-mini.
 */
export const judgeModel = (): LanguageModelV1 => {
  const id = process.env['JUDGE_MODEL'] ?? 'gemini-3-flash-preview'
  if (id.startsWith('openai:')) return openaiJudge(id.slice('openai:'.length))
  if (id.startsWith('openrouter:')) return openrouterJudge(id.slice('openrouter:'.length))
  return google(id)
}

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

/**
 * Resolve um id de candidato do bake-off para o provider certo por PREFIXO
 * (US-17, slice 2). `groq:<id>` → Groq (incumbente de produção); `openrouter:<id>`
 * → OpenRouter (candidatos free, ex.: `openrouter:meta-llama/llama-3.3-70b-instruct:free`);
 * qualquer outro id → NVIDIA NIM. Prefixo necessário porque provedores compartilham
 * o mesmo slug (`openai/gpt-oss-120b` existe em Groq, NVIDIA e OpenRouter).
 */
export const resolveModel = (id: string): LanguageModelV1 =>
  id.startsWith('groq:')
    ? groq(id.slice('groq:'.length))
    : id.startsWith('openrouter:')
      ? openrouterJudge(id.slice('openrouter:'.length))
      : id.startsWith('openai:')
        ? openaiJudge(id.slice('openai:'.length))
        : nvidia(id)

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
