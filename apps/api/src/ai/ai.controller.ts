import { Controller, Post, Body, Res, HttpCode } from '@nestjs/common'
import { Response } from 'express'
import { z } from 'zod'
import { AiService } from './ai.service'

const ChatBodySchema = z.object({
  adventureId: z.string().min(1),
  characterId: z.string().min(1),
  message: z.string().min(1).max(1000),
})

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('chat')
  @HttpCode(200)
  async chat(@Body() body: unknown, @Res() res: Response) {
    const { adventureId, characterId, message } = ChatBodySchema.parse(body)

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    // SSE: envia os headers JÁ, antes da latência do primeiro token. Sem isto o
    // Express só os envia no primeiro res.write() e o cliente (undici) aborta com
    // UND_ERR_HEADERS_TIMEOUT quando o modelo demora a responder.
    res.flushHeaders()

    // Em turnos multi-step o modelo às vezes narra a cena DUAS vezes (uma
    // narração completa, tool call, e outra narração completa) — isso é
    // duplicação e deve ser descartada. Mas ele também pode narrar a
    // PREPARAÇÃO, rolar um dado, e narrar o DESFECHO — e aí os dois trechos se
    // complementam e devem ser mantidos juntos.
    //
    // Distinguimos os casos pela lista de opções: toda narração completa
    // termina com opções (`- 🗡️ ...`). Só descartamos o texto do step anterior
    // (enviando um reset `R` ao cliente) quando ele JÁ era uma narração
    // completa; preparação sem opções é preservada.
    const COMPLETE_NARRATION = /(^|\n)\s*-\s/

    // Fallback de provedor: tenta o modelo primário (NVIDIA) e, se ele falhar
    // ANTES de emitir qualquer texto, cai para o próximo (OpenRouter) sem o
    // jogador perceber. Uma vez que já enviamos texto, não há como voltar atrás
    // — aí apenas sinalizamos o erro.
    let emittedAnyText = false

    for (let attempt = 0; ; attempt++) {
      const { result, hasFallback } = await this.aiService.streamChat(
        { adventureId, characterId, message },
        attempt,
      )

      let prevStepText = ''
      let curStepText = ''
      let failedBeforeOutput = false

      try {
        for await (const part of result.fullStream) {
          if (part.type === 'step-start') {
            if (curStepText) prevStepText = curStepText
            curStepText = ''
          } else if (part.type === 'tool-result') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const p = part as any
            if (p.toolName === 'updateInventory' && p.result?.inventory) {
              res.write('I:' + JSON.stringify(p.result.inventory) + '\n')
            }
          } else if (part.type === 'text-delta') {
            if (curStepText === '' && COMPLETE_NARRATION.test(prevStepText)) {
              res.write('R\n')
              prevStepText = ''
            }
            curStepText += part.textDelta
            emittedAnyText = true
            res.write('0:' + JSON.stringify(part.textDelta) + '\n')
          } else if (part.type === 'error') {
            if (!emittedAnyText && hasFallback) {
              failedBeforeOutput = true
              break
            }
            res.write('0:' + JSON.stringify('\n\n[O Mestre encontrou um erro. Tenta novamente.]') + '\n')
          }
        }
      } catch {
        if (!emittedAnyText && hasFallback) {
          failedBeforeOutput = true
        } else {
          res.write('0:' + JSON.stringify('\n\n[O Mestre encontrou um erro. Tenta novamente.]') + '\n')
        }
      }

      if (failedBeforeOutput) {
        console.warn(`[AiController] modelo attempt=${attempt} falhou antes de emitir texto; caindo para fallback`)
        continue // tenta o próximo provedor
      }
      break
    }

    res.end()
  }
}
