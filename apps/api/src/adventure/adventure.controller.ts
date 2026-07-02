import { Controller, Post, Get, Body, Param } from '@nestjs/common'
import { z } from 'zod'
import { AdventureService } from './adventure.service'

const CreateAdventureSchema = z.object({
  title: z.string().min(1).max(120),
})

@Controller('characters/:characterId/adventures')
export class AdventureController {
  constructor(private readonly adventureService: AdventureService) {}

  @Post()
  create(@Param('characterId') characterId: string, @Body() body: unknown) {
    const dto = CreateAdventureSchema.parse(body)
    return this.adventureService.createForCharacter(characterId, dto)
  }

  @Get(':adventureId/turns')
  getTurns(
    @Param('characterId') characterId: string,
    @Param('adventureId') adventureId: string,
  ) {
    return this.adventureService.getTurns(characterId, adventureId)
  }
}
