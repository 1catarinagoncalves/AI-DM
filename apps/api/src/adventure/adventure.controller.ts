import { Controller, Post, Get, Body, Param, UseGuards, ForbiddenException } from '@nestjs/common'
import { ApiBody, ApiOperation, ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { z } from 'zod'
import { AdventureService } from './adventure.service'
import { zodBody } from '../openapi'
import { AuthGuard } from '../auth/auth.guard'
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator'

// US-153: a aventura é sempre gerada (US-164) — sem initialHookId escolhido pelo cliente.
// `tone`/`setting`/`areaType` são opcionais (US-156; `setting`/`areaType` voltaram na US-184):
// ausente = sorteado pelo seed determinístico.
const CreateAdventureSchema = z.object({
  tone: z.string().min(1).optional(),
  setting: z.string().min(1).optional(),
  areaType: z.string().min(1).optional(),
  // US-167: sem isto o zod descarta o campo antes de chegar a createForCharacter — a
  // escolha da tela (US-165) nunca alcançaria o motor, mesmo com o service já pronto.
  challenge: z.enum(['adventure', 'challenge']).optional(),
})

@ApiTags('Aventuras')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('characters/:characterId/adventures')
export class AdventureController {
  constructor(private readonly adventureService: AdventureService) {}

  @ApiOperation({ summary: 'Gera e inicia a aventura inicial do personagem via motor de geração (US-164), ancorada no personagem.' })
  @ApiBody({ schema: zodBody(CreateAdventureSchema, { tone: 'heroic', setting: 'high-fantasy', areaType: 'city' }) })
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
