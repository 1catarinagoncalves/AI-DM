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

  async findAllByUser(userId: string) {
    return this.prisma.character.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })
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
