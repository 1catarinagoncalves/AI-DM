import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../prisma.service'

export interface CreateCampaignDto {
  userId: string
  name: string
  systemId: string
}

export interface JoinCampaignDto {
  characterId: string
}

export interface CreateAdventureDto {
  title: string
}

@Injectable()
export class CampaignService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCampaignDto) {
    const system = await this.prisma.system.findUnique({ where: { id: dto.systemId } })
    if (!system) throw new NotFoundException(`Sistema ${dto.systemId} não encontrado`)

    return this.prisma.campaign.create({
      data: {
        creatorId: dto.userId,
        name: dto.name,
        systemId: dto.systemId,
      },
      include: { system: true },
    })
  }

  async findAllByUser(userId: string) {
    return this.prisma.campaign.findMany({
      where: { creatorId: userId },
      include: { system: true, _count: { select: { slots: true, adventures: true } } },
      orderBy: { createdAt: 'desc' },
    })
  }

  async findOne(id: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
      include: {
        system: true,
        slots: { include: { character: true } },
        adventures: { orderBy: { order: 'asc' } },
      },
    })
    if (!campaign) throw new NotFoundException(`Campanha ${id} não encontrada`)
    return campaign
  }

  async join(campaignId: string, dto: JoinCampaignDto) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { _count: { select: { slots: true } } },
    })
    if (!campaign) throw new NotFoundException(`Campanha ${campaignId} não encontrada`)

    if (campaign._count.slots >= campaign.maxPlayers) {
      throw new BadRequestException(`Campanha cheia (máximo ${campaign.maxPlayers} personagens)`)
    }

    const existing = await this.prisma.characterSlot.findUnique({
      where: { campaignId_characterId: { campaignId, characterId: dto.characterId } },
    })
    if (existing) throw new ConflictException('Personagem já está nessa campanha')

    return this.prisma.characterSlot.create({
      data: { campaignId, characterId: dto.characterId },
      include: { character: true },
    })
  }

  async createAdventure(campaignId: string, dto: CreateAdventureDto) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { _count: { select: { adventures: true } } },
    })
    if (!campaign) throw new NotFoundException(`Campanha ${campaignId} não encontrada`)

    const order = campaign._count.adventures + 1

    // Fecha a aventura ativa anterior, se existir
    await this.prisma.adventure.updateMany({
      where: { campaignId, status: 'ACTIVE' },
      data: { status: 'COMPLETED', completedAt: new Date() },
    })

    const adventure = await this.prisma.adventure.create({
      data: { campaignId, title: dto.title, order },
    })

    // Cria CharacterState inicial para cada personagem na campanha
    const slots = await this.prisma.characterSlot.findMany({
      where: { campaignId },
      include: { character: true },
    })

    for (const slot of slots) {
      const attrs = slot.character.baseAttributes as Record<string, number>
      const conMod = Math.floor(((attrs['constitution'] ?? 10) - 10) / 2)
      const maxHp = 10 + conMod

      await this.prisma.characterState.upsert({
        where: { characterId_adventureId: { characterId: slot.characterId, adventureId: adventure.id } },
        update: {},
        create: {
          characterId: slot.characterId,
          adventureId: adventure.id,
          hp: maxHp,
          maxHp,
          attributes: slot.character.baseAttributes as object,
        },
      })
    }

    return adventure
  }

  async listSystems() {
    return this.prisma.system.findMany({ orderBy: { name: 'asc' } })
  }
}
