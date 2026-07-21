import { Controller, Post, Body, Res, HttpCode, UseGuards, ForbiddenException } from '@nestjs/common'
import { ApiBody, ApiOperation, ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { Response } from 'express'
import { z } from 'zod'
import { AiService, type RollTurnState } from './ai.service'
import { zodBody } from '../openapi'
import { AuthGuard } from '../auth/auth.guard'
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator'

const ChatBodySchema = z.object({
  adventureId: z.string().min(1),
  characterId: z.string().min(1),
  message: z.string().min(1).max(1000),
})

@ApiTags('Mestre (IA)')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @ApiOperation({ summary: 'Envia a ação do jogador ao Mestre e recebe a narração em streaming (SSE). Pode atualizar HP e inventário via tool calls durante o turno.' })
  @ApiBody({
    schema: zodBody(ChatBodySchema, {
      adventureId: 'adv_123',
      characterId: 'char_456',
      message: 'Abro a porta com cuidado.',
    }),
  })
  @Post('chat')
  @HttpCode(200)
  async chat(@Body() body: unknown, @Res() res: Response, @CurrentUser() user: AuthUser) {
    const { adventureId, characterId, message } = ChatBodySchema.parse(body)

    // US-61: valida a posse ANTES de abrir o SSE — 403 sai limpo (sem headers de
    // stream). Enviar o characterId de outro dono não dá acesso à ficha alheia.
    if (!user.userId) throw new ForbiddenException('Token sem identidade de utilizador')
    await this.aiService.assertCharacterOwner(characterId, user.userId)

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

    // US-38: estado do teste do turno, COMPARTILHADO entre as tentativas. No
    // fallback o streamChat é reexecutado; sem isto o mesmo teste rolava de novo
    // (duas rolagens iguais). O 1º teste ancorado é reusado pelas tentativas
    // seguintes — um teste por ação, mesmo com fallback.
    const rollState: RollTurnState = { first: null }

    // US-38: cada tentativa reexecuta o stream e reemite o tool-result do MESMO
    // teste (o servidor reusa o resultado, mas o controller ainda veria o
    // tool-result). Dedupe os frames `D:` por assinatura de conteúdo para o
    // bloco aparecer UMA vez, mesmo com fallback.
    const emittedRolls = new Set<string>()

    for (let attempt = 0; ; attempt++) {
      const { result, hasFallback } = await this.aiService.streamChat(
        { adventureId, characterId, message },
        attempt,
        rollState,
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
            } else if (p.toolName === 'updateCharacterHp' && typeof p.result?.hp === 'number') {
              res.write('H:' + JSON.stringify({ hp: p.result.hp, maxHp: p.result.maxHp }) + '\n')
            } else if (p.toolName === 'rollDice' && typeof p.result?.total === 'number') {
              // US-29: bloco de rolagem REAL, emitido antes dos tokens de narração
              // do step (a rollDice resolve antes do texto). O jogador vê o número
              // do sistema primeiro; a prosa só o interpreta.
              const roll = {
                label: p.result.reason,
                skill: p.result.skill, // US-38: perícia/atributo usado
                formula: p.result.formula,
                rolls: p.result.rolls,
                modifier: p.result.modifier,
                total: p.result.total,
              }
              // US-38: dedupe entre tentativas — o mesmo teste reusado no fallback
              // não gera um 2º bloco idêntico.
              const sig = JSON.stringify(roll)
              if (!emittedRolls.has(sig)) {
                emittedRolls.add(sig)
                res.write('D:' + JSON.stringify(roll) + '\n')
              }
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
