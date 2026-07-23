import { streamText } from 'ai'
import { narrationModels, NARRATION_PROVIDER_OPTIONS } from './model'

// Geração de narração pela escada de PRODUÇÃO, reutilizável nos eval cases (US-36).
// Vive DENTRO do pacote (não em evals/) porque só aqui `ai` resolve — um import de
// 'ai' a partir de evals/cases/ na raiz quebra a resolução de @ai-sdk/provider-utils.
//
// Sampling ESPELHA ai.service.ts (streamChat): maxTokens 4000, frequencyPenalty 0.3.
// Mudou lá? Mude aqui — o metadado do relatório da US-36 registra estes valores
// justamente para flagrar drift entre o eval e a prosa que o jogador recebe.
export const NARRATION_MAX_TOKENS = 4000
export const NARRATION_FREQUENCY_PENALTY = 0.3

export interface GeneratedNarration {
  narration: string
  finishReason: string
  tokens: { prompt: number; completion: number }
  /** slug do modelo que efetivamente serviu (pode diferir do pedido em fallback interno do provider). */
  modelServed: string
}

/**
 * Gera uma narração completa pela escada `narrationModels` (nível `ladderLevel`,
 * default 0 = primário) com o system + prompt dados e o MESMO sampling da produção.
 * Consome o stream inteiro e devolve prosa + finishReason + tokens + modelo servido.
 *
 * SEM tools: o eval de qualidade julga a PROSA, não a trajetória de tool calling (isso é
 * eval da US-08/09). Os casos são de narração pura (diálogo, descrição, exploração) — não
 * disparam `rollDice`. Combate/rolagem ficaram de fora de propósito: instrumentar a tool
 * abria uma trajetória tool-loop frágil (o modelo às vezes gastava os passos em chamadas e
 * devolvia narração VAZIA), que é justamente a flakiness que a US-70 quer matar.
 */
export async function generateNarration(params: {
  system: string
  prompt: string
  ladderLevel?: number
  timeoutMs?: number
}): Promise<GeneratedNarration> {
  const model = narrationModels[params.ladderLevel ?? 0]!
  const result = streamText({
    model,
    system: params.system,
    prompt: params.prompt,
    providerOptions: NARRATION_PROVIDER_OPTIONS,
    maxTokens: NARRATION_MAX_TOKENS,
    frequencyPenalty: NARRATION_FREQUENCY_PENALTY,
    abortSignal: AbortSignal.timeout(params.timeoutMs ?? 90_000),
  })
  let narration = ''
  for await (const chunk of result.textStream) narration += chunk
  const usage = await result.usage
  const finishReason = await result.finishReason
  const response = await result.response
  return {
    narration,
    finishReason,
    tokens: { prompt: usage.promptTokens ?? 0, completion: usage.completionTokens ?? 0 },
    modelServed: response.modelId ?? model.modelId ?? 'unknown',
  }
}
