import { Controller, Post, Get, Body, Param, UseGuards, ForbiddenException } from '@nestjs/common'
import { ApiBody, ApiOperation, ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { z } from 'zod'
import { AdventureService } from './adventure.service'
import { zodBody } from '../openapi'
import { AuthGuard } from '../auth/auth.guard'
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator'

const CreateAdventureSchema = z.object({
  initialHookId: z.string().min(1),
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

  @ApiOperation({ summary: 'Inicia a aventura inicial do personagem a partir do gancho escolhido pela classe.' })
  @ApiBody({ schema: zodBody(CreateAdventureSchema, { initialHookId: 'wizard-forbidden-archive' }) })
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
