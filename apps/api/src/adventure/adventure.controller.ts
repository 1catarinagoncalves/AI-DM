import { Controller, Post, Get, Body, Param } from '@nestjs/common'
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { AdventureService } from './adventure.service'
import { zodBody } from '../openapi'

const CreateAdventureSchema = z.object({
  title: z.string().min(1).max(120),
})

@ApiTags('Aventuras')
@Controller('characters/:characterId/adventures')
export class AdventureController {
  constructor(private readonly adventureService: AdventureService) {}

  @ApiOperation({ summary: 'Inicia uma nova aventura para um personagem.' })
  @ApiBody({ schema: zodBody(CreateAdventureSchema, { title: 'A Cripta do Rei Esquecido' }) })
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
