import { Controller, Get, Post, Body, Param } from '@nestjs/common'
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { CharacterService } from './character.service'
import { zodBody } from '../openapi'

const CreateCharacterSchema = z.object({
  userId: z.string().min(1),
  systemId: z.string().min(1),
  name: z.string().min(1).max(60),
  gender: z.string().min(1).max(40),
  race: z.string().min(1).max(40),
  class: z.string().min(1).max(40),
  // Atributos dinâmicos: validados contra System.config.attributes no service, não aqui.
  attributes: z.record(z.string(), z.number()),
})

@ApiTags('Personagens')
@Controller('characters')
export class CharacterController {
  constructor(private readonly characterService: CharacterService) {}

  @ApiOperation({ summary: 'Cria uma ficha de personagem para um utilizador num dado sistema. Os atributos são validados contra a config do sistema.' })
  @ApiBody({
    schema: zodBody(CreateCharacterSchema, {
      userId: 'user_123',
      systemId: 'dnd5e',
      name: 'Thorin',
      gender: 'Masculino',
      race: 'Anão',
      class: 'Guerreiro',
      attributes: { Força: 16, Destreza: 12, Constituição: 15, Inteligência: 10, Sabedoria: 13, Carisma: 8 },
    }),
  })
  @Post()
  create(@Body() body: unknown) {
    const dto = CreateCharacterSchema.parse(body)
    return this.characterService.create(dto)
  }

  @ApiOperation({ summary: 'Lista todas as fichas de personagem de um utilizador.' })
  @Get('user/:userId')
  findByUser(@Param('userId') userId: string) {
    return this.characterService.findAllByUser(userId)
  }

  @ApiOperation({ summary: 'Devolve o estado completo de uma ficha (atributos, HP, inventário) pelo seu id.' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.characterService.findOne(id)
  }
}
