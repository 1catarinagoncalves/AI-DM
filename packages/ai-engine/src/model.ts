import { createOpenAICompatible } from '@ai-sdk/openai-compatible'

type OpenAICompatModel = ReturnType<ReturnType<typeof createOpenAICompatible>>

// NVIDIA NIM — API OpenAI-compatible (https://integrate.api.nvidia.com/v1).
const nvidia = createOpenAICompatible({
  name: 'nvidia',
  baseURL: 'https://integrate.api.nvidia.com/v1',
  apiKey: process.env['NVIDIA_API_KEY'],
})

const openrouter = createOpenAICompatible({
  name: 'openrouter',
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env['OPENROUTER_API_KEY'],
})

// Narração: NVIDIA gpt-oss-120b como primário; OpenRouter como fallback.
// O gpt-oss-120b segue as regras do system prompt (disciplina de dados,
// formatação, sem duplicação) muito melhor que o antigo llama-3.3-70b.
export const nvidiaModel: OpenAICompatModel = nvidia('openai/gpt-oss-120b')
export const openrouterModel: OpenAICompatModel = openrouter('openai/gpt-oss-120b')

// Modelos de narração em ordem de prioridade. O serviço tenta o primeiro e,
// se ele falhar ANTES de emitir texto, cai para o próximo.
export const narrationModels: OpenAICompatModel[] = [nvidiaModel, openrouterModel]

// Compat: modelo principal isolado.
export const defaultModel: OpenAICompatModel = nvidiaModel

// Sumarização de memória: tarefa simples; usa o mesmo provedor primário
// (falha aqui é tolerada e só adia a sumarização para o próximo turno).
export const summaryModel: OpenAICompatModel = nvidia('openai/gpt-oss-120b')
