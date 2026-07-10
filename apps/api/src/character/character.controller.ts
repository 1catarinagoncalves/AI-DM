import { Controller, Get, Post, Delete, Body, Param } from '@nestjs/common'
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger'
import { CharacterService } from './character.service'
import { CreateCharacterSchema } from './character.schema'
import { zodBody } from '../openapi'

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
      skills: ['athletics', 'perception'],
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

  @ApiOperation({ summary: 'Apaga a ficha, as aventuras dela e todos os dependentes numa transação. Id inexistente devolve 404.' })
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.characterService.remove(id)
  }
}
