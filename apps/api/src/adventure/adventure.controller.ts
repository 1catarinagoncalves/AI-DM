import { Controller, Post, Get, Body, Param } from '@nestjs/common'
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { AdventureService } from './adventure.service'
import { zodBody } from '../openapi'

const CreateAdventureSchema = z.object({
  initialHookId: z.string().min(1),
})

@ApiTags('Aventuras')
@Controller('characters/:characterId/adventures')
export class AdventureController {
  constructor(private readonly adventureService: AdventureService) {}

  @ApiOperation({ summary: 'Aventura inicial resolvida pela classe do personagem (US-28), com placeholders aplicados.' })
  @Get('initial')
  getInitial(@Param('characterId') characterId: string) {
    return this.adventureService.getInitialAdventure(characterId)
  }

  @ApiOperation({ summary: 'Inicia a aventura inicial do personagem a partir do gancho escolhido pela classe.' })
  @ApiBody({ schema: zodBody(CreateAdventureSchema, { initialHookId: 'wizard-forbidden-archive' }) })
  @Post()
  create(@Param('characterId') characterId: string, @Body() body: unknown) {
    const dto = CreateAdventureSchema.parse(body)
    return this.adventureService.createForCharacter(characterId, dto)
  }

  @ApiOperation({ summary: 'Devolve o histórico de turnos (mensagens jogador/Mestre) de uma aventura.' })
  @Get(':adventureId/turns')
  getTurns(
    @Param('characterId') characterId: string,
    @Param('adventureId') adventureId: string,
  ) {
    return this.adventureService.getTurns(characterId, adventureId)
  }
}
