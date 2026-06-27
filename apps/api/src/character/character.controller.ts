import { Controller, Get, Post, Body, Param } from '@nestjs/common'
import { z } from 'zod'
import { CharacterService } from './character.service'

const CreateCharacterSchema = z.object({
  userId: z.string().min(1),
  name: z.string().min(1).max(60),
  gender: z.string().min(1).max(40),
  race: z.string().min(1).max(40),
  class: z.string().min(1).max(40),
  strength: z.number().int().min(1).max(30),
  dexterity: z.number().int().min(1).max(30),
  constitution: z.number().int().min(1).max(30),
  intelligence: z.number().int().min(1).max(30),
  wisdom: z.number().int().min(1).max(30),
  charisma: z.number().int().min(1).max(30),
})

@Controller('characters')
export class CharacterController {
  constructor(private readonly characterService: CharacterService) {}

  @Post()
  create(@Body() body: unknown) {
    const dto = CreateCharacterSchema.parse(body)
    return this.characterService.create(dto)
  }

  @Get('user/:userId')
  findByUser(@Param('userId') userId: string) {
    return this.characterService.findAllByUser(userId)
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.characterService.findOne(id)
  }
}
