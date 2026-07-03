import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { SystemConfigSchema, buildCharacterAttributesSchema } from '@ai-dm/shared'
import { PrismaService } from '../prisma.service'

export interface CreateCharacterDto {
  userId: string
  systemId: string
  name: string
  gender: string
  race: string
  class: string
  attributes: Record<string, number>
}

@Injectable()
export class CharacterService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCharacterDto) {
    const system = await this.prisma.system.findUnique({ where: { id: dto.systemId } })
    if (!system) throw new NotFoundException(`Sistema ${dto.systemId} não encontrado`)
    if (!system.config) {
      throw new BadRequestException(`Sistema ${dto.systemId} não tem configuração de regras (config ausente)`)
    }

    const config = SystemConfigSchema.parse(system.config)
    const baseAttributes = buildCharacterAttributesSchema(config.attributes).parse(dto.attributes)

    return this.prisma.character.create({
      data: {
        userId: dto.userId,
        systemId: dto.systemId,
        name: dto.name,
        gender: dto.gender,
        race: dto.race,
        class: dto.class,
        level: 1,
        baseAttributes,
      },
    })
  }

  /**
   * Lista os personagens do usuário para o hub (US-25): cada um com a aventura
   * em andamento (ACTIVE) embutida e a lista ordenada por último jogado.
   * Uma query só (findMany com includes) — sem loop por personagem.
   */
  async findAllByUser(userId: string) {
    const characters = await this.prisma.character.findMany({
      where: { userId },
      include: {
        // Estado mais recente → "último jogado" (CharacterState.updatedAt bumpa a cada turno).
        states: { orderBy: { updatedAt: 'desc' }, take: 1 },
        // Aventura em andamento: participação numa Adventure ACTIVE, a mais recente desempata.
        participations: {
          where: { adventure: { status: 'ACTIVE' } },
          include: { adventure: { select: { id: true, title: true } } },
          orderBy: { adventure: { createdAt: 'desc' } },
          take: 1,
        },
      },
    })

    return characters
      .map((c) => ({
        id: c.id,
        name: c.name,
        race: c.race,
        class: c.class,
        level: c.level,
        currentAdventure: c.participations[0]?.adventure ?? null,
        // Chave de ordenação: último turno jogado; nunca jogou cai em createdAt.
        _lastPlayed: c.states[0]?.updatedAt ?? c.createdAt,
      }))
      .sort((a, b) => b._lastPlayed.getTime() - a._lastPlayed.getTime())
      .map(({ _lastPlayed, ...rest }) => rest)
  }

  async findOne(id: string) {
    const character = await this.prisma.character.findUnique({
      where: { id },
      include: {
        states: { orderBy: { updatedAt: 'desc' }, take: 1 },
      },
    })
    if (!character) throw new NotFoundException(`Personagem ${id} não encontrado`)
    return character
  }
}
