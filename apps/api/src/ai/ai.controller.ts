import { Controller, Post, Body, Res, HttpCode, UseGuards, ForbiddenException } from '@nestjs/common'
import { ApiBody, ApiOperation, ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { Response } from 'express'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { detectDegeneration, hasOptionsList } from '@ai-dm/shared'
import { AiService, type RollTurnState } from './ai.service'
import type { EventLog } from '../generated/prisma/client'
import { zodBody } from '../openapi'
import { AuthGuard } from '../auth/auth.guard'
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator'

const ChatBodySchema = z.object({
  adventureId: z.string().min(1),
  characterId: z.string().min(1),
  message: z.string().min(1).max(1000),
  // US-67: turno de edição — limpa o rastro do último turno antes de re-executar.
  edit: z.boolean().optional(),
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
    const { adventureId, characterId, message, edit } = ChatBodySchema.parse(body)

    // US-61: valida a posse ANTES de abrir o SSE — 403 sai limpo (sem headers de
    // stream). Enviar o characterId de outro dono não dá acesso à ficha alheia.
    if (!user.userId) throw new ForbiddenException('Token sem identidade de utilizador')
    await this.aiService.assertCharacterOwner(characterId, user.userId)

    // US-67: numa edição, limpa o rastro do último turno ANTES dos headers SSE —
    // um turno não editável (resumido / mutou estado) rejeita aqui com 400/403
    // limpo, e a narração antiga não volta como contexto da regeneração. Guardamos
    // os eventos para restaurar se a regeneração não produzir narração nenhuma.
    let clearedTurn: EventLog[] = []
    if (edit) {
      clearedTurn = await this.aiService.clearLastTurnForEdit(adventureId, characterId)
    }

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
    // completa; preparação sem opções é preservada. `hasOptionsList` (US-74) é o
    // mesmo predicado que o serviço usa no gate de persistência — fonte única.

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

    // US-69: guard anti-degeneração. Ao detectar repetição patológica mid-stream,
    // descartamos o parcial (sentinel `X` = descarte de TURNO no cliente) e
    // RE-AMOSTRAMOS o MESMO modelo — loop é falha de amostragem, não do modelo estar
    // quebrado; via OpenRouter a re-chamada ainda pode reroteiar o backend. Só
    // descemos a escada (`modelIndex++`) como escalonamento após MAX re-rolls
    // degenerados no mesmo modelo.
    const MAX_SAME_MODEL_REROLLS = 2
    let sameModelRerolls = 0

    // US-117 (ADR 011): um turnId por turno, gerado UMA vez aqui — onde o turno
    // começa — e reusado por qualquer reroll/escalação abaixo (mesmo modelIndex ou
    // modelIndex++): é a mesma ação do jogador sendo tentada de novo, não um turno
    // novo. Correlaciona os logs que este turno emite (guard, onFinish, reconcileScene).
    const turnId = randomUUID()

    for (let modelIndex = 0; ; ) {
      const { result, hasFallback, turnGuard } = await this.aiService.streamChat(
        { adventureId, characterId, message },
        modelIndex,
        rollState,
        turnId,
      )

      let prevStepText = ''
      let curStepText = ''
      let failedBeforeOutput = false
      let degenerated = false
      // US-74: o turno emitiu a lista de opções em ALGUM ponto? Latch por tentativa.
      // Fim do turno sem ela = truncado (cliffhanger) → re-amostra. Latch (não checar só
      // o último step) cobre o caso preparação+desfecho: as opções vêm no step do desfecho.
      let turnHadOptions = false
      // US-74 (salvage): espelha o texto que o cliente mostra (reset no `R`, append no
      // `0:`) — é a narração exata a completar se o turno truncar, sem depender do onFinish.
      let shownText = ''

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
            if (curStepText === '' && hasOptionsList(prevStepText)) {
              res.write('R\n')
              prevStepText = ''
              shownText = '' // o cliente descarta o step anterior; espelha isso
              // O step descartado tinha as opções; ao descartá-lo, o turno volta a NÃO
              // ter fecho. Sem este reset, um desfecho truncado após um `R` passaria por
              // completo e o turno se perderia (onFinish também não persistiria).
              turnHadOptions = false
            }
            curStepText += part.textDelta
            // US-69: detecta o loop ANTES de escrever o delta que cruza o limiar —
            // não emite mais um "cra". Marca o guard (o onFinish desta tentativa não
            // persiste) e sai; o parcial é descartado abaixo.
            if (detectDegeneration(curStepText)) {
              turnGuard.degenerated = true
              degenerated = true
              break
            }
            // US-74: latch — assim que o step corrente exibe a lista de opções, o turno
            // tem fecho. Sem isto ao fim = truncado.
            if (!turnHadOptions && hasOptionsList(curStepText)) turnHadOptions = true
            emittedAnyText = true
            shownText += part.textDelta
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
        console.log(JSON.stringify({ event: 'model_fallback', turnId, timestamp: new Date().toISOString(), modelIndex }))
        modelIndex++
        continue // tenta o próximo provedor
      }

      // US-69: degeneração (loop "cra cra…") — o texto é LIXO, então descartar (`X`) e
      // re-amostrar é o certo. Detectado cedo, mid-stream, com parcial pequeno.
      if (degenerated) {
        // Descarte de TURNO — o cliente apaga o parcial (rolagens + prosa) e espera a
        // reescrita. Reseta o estado de emissão: a reescrita reemite do zero.
        res.write('X\n')
        emittedAnyText = false
        emittedRolls.clear()

        if (sameModelRerolls < MAX_SAME_MODEL_REROLLS) {
          sameModelRerolls++
          console.log(JSON.stringify({ event: 'degeneration_reroll', turnId, timestamp: new Date().toISOString(), modelIndex, sameModelRerolls, maxSameModelRerolls: MAX_SAME_MODEL_REROLLS }))
          continue // MESMO modelIndex
        }

        // Escalona: re-rolls no mesmo modelo esgotados — desce a escada.
        console.log(JSON.stringify({ event: 'degeneration_escalate', turnId, timestamp: new Date().toISOString(), modelIndex, sameModelRerolls }))
        sameModelRerolls = 0
        if (hasFallback) {
          modelIndex++
          continue
        }
        // Último recurso: mensagem limpa, nunca a parede.
        res.write('0:' + JSON.stringify('[O Mestre se perdeu nas palavras. Tenta de novo.]') + '\n')
        break
      }

      // US-74: turno truncado — prosa emitida mas SEM a lista de opções (cliffhanger,
      // finishReason=stop). Distinto da degeneração: a narração é BOA, só falta o fecho, e
      // as tools JÁ commitaram no banco. Por isso NÃO descartamos nem re-rodamos o turno —
      // descartar perderia a prosa e dessincronizaria o mundo (inventário em dobro, cena
      // avançada 2×); re-amostrar serializaria outra geração cheia e estouraria o teto de
      // 60s do proxy (a causa real do "a narração sumiu" em prod). Em vez disso, uma chamada
      // curta SEM tools completa o fecho e é anexada; o serviço persiste o turno combinado.
      const incomplete = emittedAnyText && !turnHadOptions
      if (incomplete) {
        // Gate do onFinish (não persiste o beco-sem-saída) — quem persiste o turno salvo é
        // o completeTruncatedTurn. O serviço também computa o mesmo predicado, sem depender
        // da ordem onFinish×loop.
        turnGuard.incomplete = true
        console.log(JSON.stringify({ event: 'turn_truncated_recovered', turnId, timestamp: new Date().toISOString(), modelIndex }))
        const closure = await this.aiService.completeTruncatedTurn({ adventureId, characterId, message }, shownText, turnId)
        res.write('0:' + JSON.stringify(closure) + '\n')
        break
      }
      break
    }

    // US-67: se a regeneração da edição não produziu narração nenhuma (todos os
    // modelos caíram), restaura o turno original — a aventura nunca fica com a ação
    // apagada e sem resposta. O turno editável em si é decidido pelo servidor no
    // getTurns (o cliente recarrega o histórico ao fim do turno).
    if (edit && !emittedAnyText && clearedTurn.length > 0) {
      await this.aiService.restoreClearedTurn(clearedTurn)
    }

    res.end()
  }
}
