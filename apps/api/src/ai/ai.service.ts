import { Injectable, NotFoundException } from '@nestjs/common'
import { streamText, tool, type CoreMessage } from 'ai'
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
    const [character, adventure, characterState, quests, historyLogs] = await Promise.all([
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
      // Histórico do turno: ações do jogador e narrações do mestre, em ordem.
      // Sem isso o agente perde a memória da cena (onde está, o que recebeu)
      // e inventa cenários novos a cada mensagem.
      this.prisma.eventLog.findMany({
        where: { adventureId, characterId, type: { in: ['ACTION', 'NARRATION'] } },
        orderBy: { createdAt: 'desc' },
        take: 40,
      }),
    ])

    if (!character) throw new NotFoundException(`Character ${characterId} not found`)
    if (!adventure) throw new NotFoundException(`Adventure ${adventureId} not found`)

    // Reconstrói o fio da conversa em ordem cronológica (findMany veio desc).
    const history: CoreMessage[] = historyLogs
      .slice()
      .reverse()
      .map((log) => {
        const text = (log.payload as { text?: string }).text ?? ''
        return {
          role: log.type === 'NARRATION' ? ('assistant' as const) : ('user' as const),
          content: text,
        }
      })
      .filter((m) => m.content.trim().length > 0)

    const messages: CoreMessage[] = [...history, { role: 'user', content: message }]

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

    // Persiste a ação do jogador antes de narrar, para que faça parte do
    // histórico do próximo turno.
    await this.prisma.eventLog.create({
      data: { adventureId, characterId, type: 'ACTION', payload: { text: message } },
    })

    // Retorna o stream — o controller vai encaminhar para o cliente
    return streamText({
      model: defaultModel,
      system: systemPrompt,
      messages,
      tools,
      maxSteps: 5, // permite até 5 tool calls por turno
      // Persiste a narração do mestre ao final, mantendo a continuidade da cena.
      onFinish: async ({ text }) => {
        if (text.trim().length > 0) {
          await this.prisma.eventLog.create({
            data: { adventureId, characterId, type: 'NARRATION', payload: { text } },
          })
        }
      },
    })
  }
}
