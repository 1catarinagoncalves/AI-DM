import { Controller, Post, Get, Body, Param, UseGuards, ForbiddenException } from '@nestjs/common'
import { ApiBody, ApiOperation, ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { z } from 'zod'
import { AdventureService } from './adventure.service'
import { zodBody } from '../openapi'
import { AuthGuard } from '../auth/auth.guard'
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator'

// US-153: a aventura é sempre gerada (US-164) — sem initialHookId escolhido pelo cliente.
// `tone` é opcional (US-156): ausente = sorteado pelo seed determinístico. `setting`/`areaType`
// saíram do registro (US-173): nunca tinham consumidor fora da geração.
const CreateAdventureSchema = z.object({
  tone: z.string().min(1).optional(),
})

@ApiTags('Aventuras')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('characters/:characterId/adventures')
export class AdventureController {
  constructor(private readonly adventureService: AdventureService) {}

  @ApiOperation({ summary: 'Gera e inicia a aventura inicial do personagem via motor de geração (US-164), ancorada no personagem.' })
  @ApiBody({ schema: zodBody(CreateAdventureSchema, { tone: 'heroic' }) })
  @Post()
  async create(@Param('characterId') characterId: string, @Body() body: unknown, @CurrentUser() user: AuthUser) {
    await this.assertOwner(characterId, user)
    const dto = CreateAdventureSchema.parse(body)
    return this.adventureService.createForCharacter(characterId, dto)
  }

  @ApiOperation({ summary: 'Devolve o histórico de turnos (mensagens jogador/Mestre) de uma aventura.' })
  @Get(':adventureId/turns')
  async getTurns(
    @Param('characterId') characterId: string,
    @Param('adventureId') adventureId: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.assertOwner(characterId, user)
    return this.adventureService.getTurns(characterId, adventureId)
  }

  private async assertOwner(characterId: string, user: AuthUser) {
    if (!user.userId) throw new ForbiddenException('Token sem identidade de utilizador')
    await this.adventureService.assertCharacterOwner(characterId, user.userId)
  }
}
