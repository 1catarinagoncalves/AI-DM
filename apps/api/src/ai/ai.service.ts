import { Injectable, NotFoundException } from '@nestjs/common'
import { streamText, tool } from 'ai'
import { z } from 'zod'
import { defaultModel } from '@ai-dm/ai-engine'
import { buildDmSystemPrompt } from '@ai-dm/ai-engine'
import { DiceService } from '../game/dice.service'
import { PrismaService } from '../prisma.service'

export interface ChatInput {
  adventureId: string
  characterId: string
  message: string
}

@Injectable()
export class AiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dice: DiceService,
  ) {}

  async streamChat(input: ChatInput) {
    const { adventureId, characterId, message } = input

    // Carrega contexto do banco
    const [character, adventure, characterState, quests] = await Promise.all([
      this.prisma.character.findUnique({ where: { id: characterId } }),
      this.prisma.adventure.findUnique({
        where: { id: adventureId },
        include: { campaign: { include: { system: true } } },
      }),
      this.prisma.characterState.findUnique({
        where: { characterId_adventureId: { characterId, adventureId } },
      }),
      this.prisma.quest.findMany({
        where: { adventureId, status: 'OPEN' },
      }),
    ])

    if (!character) throw new NotFoundException(`Character ${characterId} not found`)
    if (!adventure) throw new NotFoundException(`Adventure ${adventureId} not found`)

    const systemName = adventure.campaign.system.name
    const systemPrompt = buildDmSystemPrompt({
      systemName,
      characterName: character.name,
      characterGender: character.gender,
      characterClass: character.class,
      characterRace: character.race,
      activeQuests: quests.map((q) => q.title),
    })

    // Monta as tools — cada tool chama o Game Server (this.dice, this.prisma)
    const tools = {
      rollDice: tool({
        description: 'Roll dice using standard RPG notation. Always use this for any mechanical roll.',
        parameters: z.object({
          formula: z.string().describe('e.g. "1d20+5" or "2d6+3"'),
          reason: z.string().describe('Why this roll is happening'),
        }),
        execute: async ({ formula, reason }: { formula: string; reason: string }) => {
          const result = this.dice.roll(formula)
          await this.prisma.eventLog.create({
            data: {
              adventureId,
              characterId,
              type: 'DICE_ROLL',
              payload: { formula, reason, rolls: result.rolls, modifier: result.modifier, total: result.total },
            },
          })
          return result
        },
      }),

      updateCharacterHp: tool({
        description: 'Update character HP after taking damage or healing.',
        parameters: z.object({
          newHp: z.number().describe('New HP value (cannot exceed maxHp)'),
          reason: z.string().describe('Why HP changed'),
        }),
        execute: async ({ newHp, reason }: { newHp: number; reason: string }) => {
          const maxHp = characterState?.maxHp ?? 0
          const clampedHp = Math.max(0, Math.min(newHp, maxHp))
          await this.prisma.characterState.upsert({
            where: { characterId_adventureId: { characterId, adventureId } },
            update: { hp: clampedHp },
            create: {
              characterId,
              adventureId,
              hp: clampedHp,
              maxHp,
              attributes: (character.baseAttributes as object) ?? {},
            },
          })
          await this.prisma.eventLog.create({
            data: {
              adventureId,
              characterId,
              type: 'CHARACTER_UPDATE',
              payload: { field: 'hp', newHp: clampedHp, reason },
            },
          })
          return { hp: clampedHp, maxHp }
        },
      }),
    }

    // Retorna o stream — o controller vai encaminhar para o cliente
    return streamText({
      model: defaultModel,
      system: systemPrompt,
      messages: [{ role: 'user', content: message }],
      tools,
      maxSteps: 5, // permite até 5 tool calls por turno
    })
  }
}
