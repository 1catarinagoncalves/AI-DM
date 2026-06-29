import { Injectable, NotFoundException, ConflictException } from '@nestjs/common'
import { PrismaService } from '../prisma.service'

export interface CreateCharacterDto {
  userId: string
  name: string
  gender: string
  race: string
  class: string
  strength: number
  dexterity: number
  constitution: number
  intelligence: number
  wisdom: number
  charisma: number
}

@Injectable()
export class CharacterService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCharacterDto) {
    const { userId, name, gender, race, class: charClass,
      strength, dexterity, constitution, intelligence, wisdom, charisma } = dto

    return this.prisma.character.create({
      data: {
        userId,
        name,
        gender,
        race,
        class: charClass,
        level: 1,
        baseAttributes: { strength, dexterity, constitution, intelligence, wisdom, charisma },
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
