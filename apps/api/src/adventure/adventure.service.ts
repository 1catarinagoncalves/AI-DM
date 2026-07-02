import { Injectable, NotFoundException } from '@nestjs/common'
import { SystemConfigSchema } from '@ai-dm/shared'
import { PrismaService } from '../prisma.service'
import { getStartingInventory } from '../character/starting-inventory'

export interface CreateAdventureDto {
  title: string
}

@Injectable()
export class AdventureService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Cria a aventura do personagem, liga-o como participante e gera o
   * CharacterState inicial — tudo numa transação (cobre o caso single-player
   * numa única chamada, ver US-22). `systemId`/`creatorId` vêm do próprio
   * personagem, então a invariante "mesmo sistema" vale por construção.
   */
  async createForCharacter(characterId: string, dto: CreateAdventureDto) {
    const character = await this.prisma.character.findUnique({
      where: { id: characterId },
      include: { system: true },
    })
    if (!character) throw new NotFoundException(`Personagem ${characterId} não encontrado`)

    const config = SystemConfigSchema.parse(character.system.config)
    const attrs = character.baseAttributes as Record<string, number>
    const conMod = Math.floor(((attrs['constitution'] ?? 10) - 10) / 2)
    const maxHp = 10 + conMod

    return this.prisma.$transaction(async (tx) => {
      const order = (await tx.adventureParticipant.count({ where: { characterId } })) + 1

      // Fecha a aventura ativa anterior do personagem (continuidade sequencial, ver ADR 002)
      await tx.adventure.updateMany({
        where: { status: 'ACTIVE', participants: { some: { characterId } } },
        data: { status: 'COMPLETED', completedAt: new Date() },
      })

      const adventure = await tx.adventure.create({
        data: { systemId: character.systemId, creatorId: character.userId, title: dto.title, order },
      })

      await tx.adventureParticipant.create({
        data: { adventureId: adventure.id, characterId },
      })

      await tx.characterState.create({
        data: {
          characterId,
          adventureId: adventure.id,
          hp: maxHp,
          maxHp,
          attributes: character.baseAttributes as object,
          inventory: getStartingInventory(config, character.class) as unknown as object,
        },
      })

      return adventure
    })
  }

  /**
   * Histórico visível ao jogador (US-18): turnos ACTION/NARRATION em ordem
   * cronológica, mapeados para o formato do chat. Inclui os já `summarized` —
   * a condensação da memória não deve apagar a conversa da tela.
   */
  async getTurns(characterId: string, adventureId: string): Promise<{ role: 'user' | 'dm'; content: string }[]> {
    const logs = await this.prisma.eventLog.findMany({
      where: { adventureId, characterId, type: { in: ['ACTION', 'NARRATION'] } },
      orderBy: { createdAt: 'asc' },
    })

    return logs
      .map((log) => ({
        role: (log.type === 'NARRATION' ? 'dm' : 'user') as 'user' | 'dm',
        content: (log.payload as { text?: string }).text ?? '',
      }))
      .filter((m) => m.content.trim().length > 0)
  }
}
