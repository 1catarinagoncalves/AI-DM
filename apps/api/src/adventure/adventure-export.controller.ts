import { Controller, Get, Param, Query, Res, UseGuards, ForbiddenException } from '@nestjs/common'
import { ApiOperation, ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger'
import type { Response } from 'express'
import { AdventureService } from './adventure.service'
import { buildAdventureExportView, renderAdventureExportMarkdown } from './adventure-export'
import { AuthGuard } from '../auth/auth.guard'
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator'

// US-202: `adventureId` é cuid ([a-z0-9]), mas o filename monta com ele — sanitiza para o
// dia em que vier de outra fonte (Notas de implementação da US).
function safeFilenameSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '')
}

// US-202: controller SEPARADO de AdventureController (não um `if` dentro do handler) — só
// assim a rota de fato NÃO EXISTE em produção. `@Get()` do Nest registra a rota no load do
// módulo; "desligar" um método de um controller já ativo exigiria um `if` no handler, o
// anti-padrão que este controller à parte evita (ver adventure.module.ts, registro
// condicional). Reusa `AuthGuard` e `assertCharacterOwner` (já público) — mesma checagem de
// dono que a rota de turnos.
@ApiTags('Aventuras (dev)')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('characters/:characterId/adventures')
export class AdventureExportController {
  constructor(private readonly adventureService: AdventureService) {}

  @ApiOperation({
    summary:
      'US-202 (dev, atrás de DEV_EXPORT=1): despeja a aventura inteira — artefato gerado, ledger, quest, personagem, log de jogo — como .md para download, ou JSON com ?format=json. Carrega spoiler (segredos, fraqueza do antagonista, conclusão) — nunca em produção.',
  })
  @ApiQuery({ name: 'format', required: false, enum: ['json'], description: 'Ausente = .md para download. "json" = mesmo conteúdo em application/json.' })
  @Get(':adventureId/export')
  async export(
    @Param('characterId') characterId: string,
    @Param('adventureId') adventureId: string,
    @Query('format') format: string | undefined,
    @Res() res: Response,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    if (!user.userId) throw new ForbiddenException('Token sem identidade de utilizador')
    await this.adventureService.assertCharacterOwner(characterId, user.userId)
    const data = await this.adventureService.getExportData(characterId, adventureId)
    const view = buildAdventureExportView(data)

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.send(JSON.stringify(view))
      return
    }

    res.setHeader('Content-Type', 'text/markdown; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="aventura-${safeFilenameSegment(adventureId)}.md"`)
    res.send(renderAdventureExportMarkdown(view))
  }
}
