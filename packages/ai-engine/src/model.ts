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

// OpenAI e OpenRouter são OpenAI-compatible: reaproveitam o mesmo encanamento,
// sem dependência nova. Servem de juiz alternativo (fallback quando o free tier
// do Gemini acaba) e, no caso do OpenRouter, de provider da narração de produção.
const openaiJudge = createOpenAICompatible({
  name: 'openai',
  baseURL: 'https://api.openai.com/v1',
  apiKey: process.env['OPENAI_API_KEY'],
})
const openrouter = createOpenAICompatible({
  name: 'openrouter',
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env['OPENROUTER_API_KEY'],
})

/**
 * Modelo-juiz do bake-off. Trocável por env JUDGE_MODEL, roteado por prefixo:
 * `openai:<id>` → OpenAI, `openrouter:<id>` → OpenRouter, senão Google (Gemini).
 * Default gemini-3.1-flash-lite (grátis). Ex.: JUDGE_MODEL=openai:gpt-5-mini.
 */
export const judgeModel = (): LanguageModelV1 => {
  const id = process.env['JUDGE_MODEL'] ?? 'gemini-3.1-flash-lite'
  if (id.startsWith('openai:')) return openaiJudge(id.slice('openai:'.length))
  if (id.startsWith('openrouter:')) return openrouter(id.slice('openrouter:'.length))
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
      ? openrouter(id.slice('openrouter:'.length))
      : id.startsWith('openai:')
        ? openaiJudge(id.slice('openai:'.length))
        : nvidia(id)

// Narração: deepseek-v4-flash (DeepSeek) como primário, via OpenRouter. O id é o
// slug do openrouter.ai. Se emitir raciocínio, o `exclude` em
// NARRATION_PROVIDER_OPTIONS corta antes de vazar na prosa.
export const primaryModel: LanguageModelV1 = openrouter('deepseek/deepseek-v4-flash')
// Fallback: deepseek-v4-pro via OpenRouter. Mesma família do primário (tool
// calling + raciocínio ok), modelo maior para o dia em que o flash falhar.
// Nota: primário e fallback no MESMO provider — um outage do OpenRouter derruba
// os dois (o antigo fallback Groq cobria esse caso).
export const fallbackModel: LanguageModelV1 = openrouter('deepseek/deepseek-v4-pro')
// 3º nível: llama-3.3-70b via Groq. OUTRO provider → sobrevive a um outage do
// OpenRouter, que derrubaria os dois deepseek de uma vez.
export const groqFallbackModel: LanguageModelV1 = groq('llama-3.3-70b-versatile')

// Modelos de narração em ordem de prioridade. O serviço tenta o primeiro e,
// se ele falhar ANTES de emitir texto, cai para o próximo.
export const narrationModels: LanguageModelV1[] = [primaryModel, fallbackModel, groqFallbackModel]

/**
 * Opções de provider da narração — passar em TODA chamada que usa
 * `narrationModels`. O primário é um modelo de raciocínio: separa o
 * pensamento (canal `analysis`) da resposta (canal `final`). Sem `exclude`, o
 * OpenRouter devolve o raciocínio no campo `reasoning`, que o
 * @ai-sdk/openai-compatible@0.2.16 hoje ignora — ele só lê `reasoning_content`.
 * Ou seja, a prosa fica limpa POR ACIDENTE: basta o provider passar a mapear
 * `reasoning` para o texto e o raciocínio vaza para a narração do mestre.
 * `exclude: true` corta na origem, sem depender desse detalhe do SDK.
 *
 * A chave `openrouter` casa com o `name` do createOpenAICompatible; o fallback
 * Groq ignora o bloco (lê a chave `groq`), então serve os dois modelos da escada.
 *
 * ponytail: o raciocínio ainda é gerado e cobrado, só não volta. Se o custo/TTFT
 * pesar, o próximo passo é `reasoning: { effort: 'low' }`.
 */
export const NARRATION_PROVIDER_OPTIONS = {
  // exclude: raciocínio gerado mas NÃO retornado (não vaza na prosa). SEM cortar
  // effort: um `effort:'low'` fez o modelo raciocinar de menos e desrespeitar as
  // regras do prompt (rolagens/magias inventadas). Raciocínio cheio = mais aderência;
  // o teto de corte fica por conta do maxTokens (4000) no streamText.
  openrouter: { reasoning: { exclude: true } },
} as const

// Compat: modelo principal isolado.
export const defaultModel: LanguageModelV1 = primaryModel

// Sumarização de memória: tarefa simples; usa o modelo mais rápido e barato.
export const summaryModel: LanguageModelV1 = groq('llama-3.1-8b-instant')
