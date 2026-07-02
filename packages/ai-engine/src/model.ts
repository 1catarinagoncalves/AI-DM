import { createOpenAICompatible } from '@ai-sdk/openai-compatible'

type OpenAICompatModel = ReturnType<ReturnType<typeof createOpenAICompatible>>

// NVIDIA NIM — API OpenAI-compatible (https://integrate.api.nvidia.com/v1).
const nvidia = createOpenAICompatible({
  name: 'nvidia',
  baseURL: 'https://integrate.api.nvidia.com/v1',
  apiKey: process.env['NVIDIA_API_KEY'],
})

// Narração: gpt-oss-120b como primário (TTFT ~1.2s vs ~5s do nemotron 120B, que
// estourava o timeout de 90s da NVIDIA); nemotron 120B fica como fallback.
export const primaryModel: OpenAICompatModel = nvidia('openai/gpt-oss-120b')
export const fallbackModel: OpenAICompatModel = nvidia('nvidia/nemotron-3-super-120b-a12b')

// Modelos de narração em ordem de prioridade. O serviço tenta o primeiro e,
// se ele falhar ANTES de emitir texto, cai para o próximo.
export const narrationModels: OpenAICompatModel[] = [primaryModel, fallbackModel]

// Compat: modelo principal isolado.
export const defaultModel: OpenAICompatModel = primaryModel

// Sumarização de memória: tarefa simples; usa o mesmo provedor primário
// (falha aqui é tolerada e só adia a sumarização para o próximo turno).
export const summaryModel: OpenAICompatModel = nvidia('nvidia/nemotron-3-super-120b-a12b')
