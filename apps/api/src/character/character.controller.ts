import { Controller, Get, Post, Delete, Body, Param, UseGuards, ForbiddenException } from '@nestjs/common'
import { ApiBody, ApiOperation, ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { CharacterService } from './character.service'
import { CreateCharacterSchema } from './character.schema'
import { zodBody } from '../openapi'
import { AuthGuard } from '../auth/auth.guard'
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator'

@ApiTags('Personagens')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('characters')
export class CharacterController {
  constructor(private readonly characterService: CharacterService) {}

  @ApiOperation({ summary: 'Cria uma ficha de personagem para o utilizador autenticado. O dono vem do token (US-61), não do corpo.' })
  @ApiBody({
    schema: zodBody(CreateCharacterSchema, {
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
  create(@Body() body: unknown, @CurrentUser() user: AuthUser) {
    // US-61: o `userId` é forçado a partir do token — qualquer `userId` no corpo é ignorado.
    const dto = CreateCharacterSchema.parse({ ...(body as object), userId: this.requireUserId(user) })
    return this.characterService.create(dto)
  }

  @ApiOperation({ summary: 'Lista as fichas do utilizador autenticado (derivado do token).' })
  @Get('mine')
  findMine(@CurrentUser() user: AuthUser) {
    return this.characterService.findAllByUser(this.requireUserId(user))
  }

  @ApiOperation({ summary: 'Devolve o estado completo de uma ficha do próprio utilizador. Ficha de outro dono → 403.' })
  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const character = await this.characterService.findOne(id)
    this.assertOwner(character.userId, user)
    return character
  }

  @ApiOperation({ summary: 'Apaga a ficha (e dependentes) do próprio utilizador. Ficha de outro dono → 403.' })
  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const character = await this.characterService.findOne(id)
    this.assertOwner(character.userId, user)
    return this.characterService.remove(id)
  }

  private requireUserId(user: AuthUser): string {
    if (!user.userId) throw new ForbiddenException('Token sem identidade de utilizador')
    return user.userId
  }

  private assertOwner(ownerId: string, user: AuthUser) {
    if (this.requireUserId(user) !== ownerId) {
      throw new ForbiddenException('Este personagem não pertence ao utilizador autenticado')
    }
  }
}
