import { APICallError } from 'ai'

/**
 * Log de falha de chamada a LLM que SEPARA o que é nosso do que é do provider.
 *
 * Todo `catch` de LLM neste serviço degrada e segue (devolve null, cai no fallback
 * estático) — está certo, não pode derrubar o turno nem a criação da aventura. O preço
 * é que os dois tipos de falha saíam com a MESMA cara, um `console.error` com 60 linhas
 * de stack, e ninguém distingue um do outro no meio do log do dev.
 *
 * Foi assim que o 400 `Thinking mode does not support this tool_choice` sobreviveu de
 * 01/08 a 04/08/2026 nas três extrações estruturadas: elas falhavam em 100% das vezes,
 * a aventura nascia sem cena e sem ledger, e a tela carregava igual.
 *
 * A distinção é o statusCode:
 * - **4xx** = o provider ENTENDEU e RECUSOU o nosso request. Não é transitório: essa
 *   chamada vai falhar sempre, com qualquer entrada. É bug nosso, e o log diz isso.
 *   Sai sem stack — o rastro do SDK não ajuda, quem responde é a mensagem do provider.
 * - **5xx / rede / resto** = o provider tossiu. Degradação esperada, o fallback existe
 *   para isto. Sai com o erro inteiro, que aí sim é o que se tem para investigar.
 *
 * @param scope o que falhou, em uma frase ('extração da cena da abertura')
 * @param consequence o que o jogador perde com a degradação ('sceneState fica nulo')
 */
export function logLlmFailure(scope: string, consequence: string, err: unknown): void {
  const status = APICallError.isInstance(err) ? err.statusCode : undefined

  if (status !== undefined && status >= 400 && status < 500) {
    const call = err as APICallError
    const model = (call.requestBodyValues as { model?: string } | undefined)?.model ?? 'desconhecido'
    console.error(
      `[AiService] ALERTA — ${scope}: o provider RECUSOU o request (HTTP ${status}). ` +
        `Não é transitório: esta chamada falha SEMPRE até o request mudar. ${consequence}. ` +
        `modelo=${model} resposta=${(call.responseBody ?? call.message).slice(0, 400)}`,
    )
    return
  }

  console.error(`[AiService] ${scope} falhou${status ? ` (HTTP ${status})` : ''}, degradando: ${consequence}:`, err)
}
