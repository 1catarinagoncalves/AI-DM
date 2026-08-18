import { Controller, Post, Get, Body, Param, UseGuards, ForbiddenException } from '@nestjs/common'
import { ApiBody, ApiOperation, ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { z } from 'zod'
import { AdventureService } from './adventure.service'
import { zodBody } from '../openapi'
import { AuthGuard } from '../auth/auth.guard'
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator'

// US-153: a aventura é sempre gerada (US-164) — sem initialHookId escolhido pelo cliente.
// Os três campos são opcionais (US-156): ausentes = sorteados pelo seed determinístico.
const CreateAdventureSchema = z.object({
  setting: z.string().min(1).optional(),
  tone: z.string().min(1).optional(),
  areaType: z.string().min(1).optional(),
})

@ApiTags('Aventuras')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('characters/:characterId/adventures')
export class AdventureController {
  constructor(private readonly adventureService: AdventureService) {}

  @ApiOperation({ summary: 'Aventura inicial resolvida pela classe do personagem (US-28), com placeholders aplicados.' })
  @Get('initial')
  async getInitial(@Param('characterId') characterId: string, @CurrentUser() user: AuthUser) {
    await this.assertOwner(characterId, user)
    return this.adventureService.getInitialAdventure(characterId)
  }

  @ApiOperation({ summary: 'Gera e inicia a aventura inicial do personagem via motor de geração (US-164), ancorada no personagem.' })
  @ApiBody({ schema: zodBody(CreateAdventureSchema, { setting: 'coastal-area' }) })
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
