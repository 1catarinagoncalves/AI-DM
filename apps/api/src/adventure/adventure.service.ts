import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { SystemConfigSchema, type InitialAdventureHook } from '@ai-dm/shared'
import { PrismaService } from '../prisma.service'
import { getStartingInventory, resolveInitialHook, resolveHookTemplate } from '../character/starting-inventory'

export interface CreateAdventureDto {
  initialHookId: string
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
  /**
   * Aventura inicial resolvida para o personagem (US-28), com placeholders já
   * aplicados. Alimenta a etapa "Aventura inicial" da UI antes de iniciar.
   */
  async getInitialAdventure(characterId: string): Promise<InitialAdventureHook> {
    const character = await this.prisma.character.findUnique({
      where: { id: characterId },
      include: { system: true },
    })
    if (!character) throw new NotFoundException(`Personagem ${characterId} não encontrado`)

    const config = SystemConfigSchema.parse(character.system.config)
    const hook = resolveInitialHook(config, character.class)
    if (!hook) throw new BadRequestException('O sistema deste personagem não tem aventuras iniciais configuradas')

    return this.resolveHook(hook, character.name, character.class)
  }

  private resolveHook(hook: InitialAdventureHook, name: string, charClass: string): InitialAdventureHook {
    const vars = { characterName: name, characterClass: charClass }
    return {
      ...hook,
      title: resolveHookTemplate(hook.title, vars),
      pitch: resolveHookTemplate(hook.pitch, vars),
      primaryQuestTitle: resolveHookTemplate(hook.primaryQuestTitle, vars),
      primaryQuestDescription: resolveHookTemplate(hook.primaryQuestDescription, vars),
      openingNarration: resolveHookTemplate(hook.openingNarration, vars),
    }
  }

  async createForCharacter(characterId: string, dto: CreateAdventureDto) {
    const character = await this.prisma.character.findUnique({
      where: { id: characterId },
      include: { system: true },
    })
    if (!character) throw new NotFoundException(`Personagem ${characterId} não encontrado`)

    const config = SystemConfigSchema.parse(character.system.config)

    // A classe é a fonte de verdade do gancho: resolvemos server-side e só usamos
    // o initialHookId do cliente para validar que ele não escolheu outro (US-28).
    const rawHook = resolveInitialHook(config, character.class)
    if (!rawHook) throw new BadRequestException('O sistema deste personagem não tem aventuras iniciais configuradas')
    if (dto.initialHookId !== rawHook.id) {
      throw new BadRequestException(`Gancho inicial "${dto.initialHookId}" não é válido para a classe ${character.class}`)
    }
    const hook = this.resolveHook(rawHook, character.name, character.class)

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
        data: { systemId: character.systemId, creatorId: character.userId, title: hook.title, order },
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

      // Quest principal derivada do gancho (US-28): dá objetivo ao DM (ver AiService).
      await tx.quest.create({
        data: {
          adventureId: adventure.id,
          title: hook.primaryQuestTitle,
          description: hook.primaryQuestDescription,
          isPrimary: true,
        },
      })

      // Primeira narração persistida: aparece como mensagem do Mestre (getTurns)
      // e entra na janela de contexto do DM (historyLogs, summarized: false).
      await tx.eventLog.create({
        data: {
          adventureId: adventure.id,
          characterId,
          type: 'NARRATION',
          payload: { text: hook.openingNarration },
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
