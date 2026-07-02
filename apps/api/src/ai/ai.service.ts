import { Injectable, NotFoundException } from '@nestjs/common'
import { streamText, generateText, tool, type CoreMessage } from 'ai'
import type { InventoryItem, SceneState } from '@ai-dm/shared'
import { z } from 'zod'
import {
  narrationModels,
  summaryModel,
  buildDmSystemPrompt,
  buildSummaryInput,
  mergeSceneState,
  formatSceneState,
  SUMMARY_SYSTEM_PROMPT,
  type SummaryTurn,
} from '@ai-dm/ai-engine'
import { DiceService } from '../game/dice.service'
import { PrismaService } from '../prisma.service'

export interface ChatInput {
  adventureId: string
  characterId: string
  message: string
}

// Acima de SUMMARIZE_THRESHOLD turnos não-resumidos, fundimos os mais antigos
// no resumo, mantendo apenas KEEP_RECENT turnos verbatim na janela. Cada turno
// = 1 ACTION + 1 NARRATION = 2 eventos. ~15 turnos = ~30 eventos.
const SUMMARIZE_THRESHOLD = 30
const KEEP_RECENT = 12

@Injectable()
export class AiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dice: DiceService,
  ) {}

  /**
   * Cria o stream de narração para um turno. `attempt` seleciona o modelo na
   * lista de prioridade (0 = NVIDIA, 1 = OpenRouter fallback). O controller
   * tenta a próxima tentativa quando o modelo falha antes de emitir texto.
   *
   * A ação do jogador NÃO é persistida aqui — é gravada no `onFinish`, junto
   * com a narração, apenas quando o turno produz texto. Assim uma tentativa de
   * fallback não duplica a ação no histórico nem reconstrói a janela errada.
   */
  async streamChat(input: ChatInput, attempt = 0) {
    const { adventureId, characterId, message } = input

    // Carrega contexto do banco
    const [character, adventure, characterState, quests, historyLogs] = await Promise.all([
      this.prisma.character.findUnique({ where: { id: characterId } }),
      this.prisma.adventure.findUnique({
        where: { id: adventureId },
        include: { system: true },
      }),
      this.prisma.characterState.findUnique({
        where: { characterId_adventureId: { characterId, adventureId } },
      }),
      this.prisma.quest.findMany({
        where: { adventureId, status: 'OPEN' },
      }),
      // Janela recente verbatim: só os turnos ainda NÃO resumidos. O que é
      // antigo demais já foi condensado em adventure.memorySummary e entra no
      // system prompt, não aqui. Sem isso o agente perde a memória da cena.
      this.prisma.eventLog.findMany({
        where: { adventureId, characterId, type: { in: ['ACTION', 'NARRATION'] }, summarized: false },
        orderBy: { createdAt: 'asc' },
      }),
    ])

    if (!character) throw new NotFoundException(`Character ${characterId} not found`)
    if (!adventure) throw new NotFoundException(`Adventure ${adventureId} not found`)

    // Reconstrói o fio recente da conversa em ordem cronológica.
    const history: CoreMessage[] = historyLogs
      .map((log) => {
        const text = (log.payload as { text?: string }).text ?? ''
        return {
          role: log.type === 'NARRATION' ? ('assistant' as const) : ('user' as const),
          content: text,
        }
      })
      .filter((m) => m.content.trim().length > 0)

    const messages: CoreMessage[] = [...history, { role: 'user', content: message }]

    const systemName = adventure.system.name
    const inventory = (characterState?.inventory ?? []) as unknown as InventoryItem[]
    const mainQuest = quests.find((q) => q.isPrimary)?.title ?? null
    const activeQuests = quests.filter((q) => !q.isPrimary)
    const systemPrompt = buildDmSystemPrompt({
      systemName,
      characterName: character.name,
      characterGender: character.gender,
      characterClass: character.class,
      characterRace: character.race,
      mainQuest,
      activeQuests: activeQuests.map((q) => q.title),
      memorySummary: adventure.memorySummary,
      inventory: inventory.map((i) => (i.qty > 1 ? `${i.name} (${i.qty})` : i.name)),
      sceneState: (characterState?.sceneState ?? null) as SceneState | null,
    })

    // Monta as tools — cada tool chama o Game Server (this.dice, this.prisma)
    const tools = {
      rollDice: tool({
        description:
          'Roll dice using standard RPG notation. ALWAYS call this BEFORE narrating any chance-based outcome, and WAIT for the result. Never state a dice result you did not get from this tool.',
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

      updateInventory: tool({
        description:
          'Add or remove items from the character inventory. Call when the character acquires, uses, gives away, or loses items. Positive delta = add, negative = remove.',
        parameters: z.object({
          changes: z.array(z.object({
            name: z.string().describe('Item name, exactly as it should appear in the inventory'),
            delta: z.number().int().describe('Quantity change: positive to add, negative to remove'),
          })).describe('List of item changes to apply'),
        }),
        execute: async ({ changes }: { changes: { name: string; delta: number }[] }) => {
          const state = await this.prisma.characterState.findUnique({
            where: { characterId_adventureId: { characterId, adventureId } },
          })

          const current = (state?.inventory ?? []) as unknown as InventoryItem[]
          const inv = new Map<string, number>(current.map(i => [i.name, i.qty]))

          for (const { name, delta } of changes) {
            const next = (inv.get(name) ?? 0) + delta
            if (next <= 0) inv.delete(name)
            else inv.set(name, next)
          }

          const total = Array.from(inv.values()).reduce((a, b) => a + b, 0)
          if (total > 9999) {
            return { error: 'Inventário cheio: limite de 9999 itens atingido. O item não foi adicionado.' }
          }

          const inventory: InventoryItem[] = Array.from(inv.entries()).map(([name, qty]) => ({ name, qty }))

          const inventoryJson = inventory as unknown as object

          await this.prisma.characterState.upsert({
            where: { characterId_adventureId: { characterId, adventureId } },
            update: { inventory: inventoryJson },
            create: {
              characterId,
              adventureId,
              hp: characterState?.hp ?? 10,
              maxHp: characterState?.maxHp ?? 10,
              attributes: (character.baseAttributes as object) ?? {},
              inventory: inventoryJson,
            },
          })

          await this.prisma.eventLog.create({
            data: {
              adventureId,
              characterId,
              type: 'CHARACTER_UPDATE',
              payload: { field: 'inventory', changes: changes as unknown as object, result: inventoryJson },
            },
          })

          return { inventory }
        },
      }),

      updateScene: tool({
        description:
          'Update the structured scene state (source of truth for spatial continuity). Call BEFORE narrating whenever the scene CHANGES: the character moves to a new location, the environment switches indoor/outdoor, the time of day advances, an NPC arrives or leaves, or a notable object appears/disappears. Pass ONLY the fields that changed this turn — omitted fields keep their previous value. For `presentes` and `objetos_em_cena`, send the FULL current list (it replaces the previous one). Do NOT call this when the player merely inspects an item they are carrying — that does not move the character.',
        parameters: z.object({
          local: z.string().optional().describe('Current location in natural language, e.g. "praça central de Willowdale"'),
          ambiente: z.enum(['externo', 'interno']).optional().describe('externo = open/outdoors, interno = enclosed/indoors'),
          periodo: z.string().optional().describe('Time of day, e.g. manhã/tarde/entardecer/noite'),
          presentes: z.array(z.string()).optional().describe('FULL list of NPCs/characters present in the scene now'),
          objetos_em_cena: z.array(z.string()).optional().describe('FULL list of notable objects visible/available in the scene now (distinct from carried inventory)'),
        }),
        execute: async (patch: {
          local?: string
          ambiente?: 'externo' | 'interno'
          periodo?: string
          presentes?: string[]
          objetos_em_cena?: string[]
        }) => {
          const current = (characterState?.sceneState ?? null) as SceneState | null
          const next = mergeSceneState(current, patch)
          const sceneJson = next as unknown as object

          await this.prisma.characterState.upsert({
            where: { characterId_adventureId: { characterId, adventureId } },
            update: { sceneState: sceneJson },
            create: {
              characterId,
              adventureId,
              hp: characterState?.hp ?? 10,
              maxHp: characterState?.maxHp ?? 10,
              attributes: (character.baseAttributes as object) ?? {},
              sceneState: sceneJson,
            },
          })

          await this.prisma.eventLog.create({
            data: {
              adventureId,
              characterId,
              type: 'CHARACTER_UPDATE',
              payload: { field: 'scene', patch: patch as unknown as object, result: sceneJson },
            },
          })

          return next
        },
      }),
    }

    const model = narrationModels[Math.min(attempt, narrationModels.length - 1)]!
    const hasFallback = attempt < narrationModels.length - 1
    console.log(`[AiService] turno attempt=${attempt} modelo=${model.modelId ?? 'unknown'}`)

    // Retorna o stream — o controller vai encaminhar para o cliente
    const result = streamText({
      model,
      system: systemPrompt,
      messages,
      tools,
      maxSteps: 5, // permite até 5 tool calls por turno
      // Persiste a narração do mestre ao final, mantendo a continuidade da cena,
      // e condensa turnos antigos no resumo quando a janela cresce demais.
      onFinish: async ({ text, steps }) => {
        // Em turnos multi-step, `text` concatena a narração de TODOS os steps.
        // Reconstruímos exatamente o que foi mostrado ao jogador (mesma lógica
        // do controller): descartamos um step anterior só quando ele já era uma
        // narração completa (terminava com opções) — duplicação real — mas
        // mantemos preparação + desfecho juntos. Sem isso o histórico grava a
        // duplicação e realimenta o problema nos próximos turnos.
        const COMPLETE_NARRATION = /(^|\n)\s*-\s/
        let shown = ''
        for (const step of steps) {
          const t = step.text ?? ''
          if (t.trim().length === 0) continue
          if (COMPLETE_NARRATION.test(shown)) shown = ''
          shown += t
        }
        const finalText = (shown || text).trim()
        // Só registra o turno (ação + narração) quando ele de fato produziu
        // narração. Uma tentativa que falhou antes de emitir texto não grava
        // nada, evitando duplicar a ação quando o fallback assume.
        if (finalText.length > 0) {
          await this.prisma.eventLog.create({
            data: { adventureId, characterId, type: 'ACTION', payload: { text: message } },
          })
          await this.prisma.eventLog.create({
            data: { adventureId, characterId, type: 'NARRATION', payload: { text: finalText } },
          })
        }
        await this.summarizeOldTurns(adventureId, characterId)
      },
    })

    return { result, hasFallback }
  }

  /**
   * Memória de longo prazo: quando os turnos não-resumidos ultrapassam o limite,
   * funde os mais antigos no resumo acumulado da aventura (Adventure.memorySummary)
   * e os marca como `summarized`, mantendo apenas a janela recente verbatim.
   *
   * Roda no onFinish, de forma assíncrona, e nunca deve derrubar o turno — uma
   * falha aqui apenas adia a sumarização para o próximo turno.
   */
  private async summarizeOldTurns(adventureId: string, characterId: string): Promise<void> {
    try {
      const unsummarized = await this.prisma.eventLog.findMany({
        where: { adventureId, characterId, type: { in: ['ACTION', 'NARRATION'] }, summarized: false },
        orderBy: { createdAt: 'asc' },
      })

      if (unsummarized.length <= SUMMARIZE_THRESHOLD) return

      // Mantém os KEEP_RECENT eventos mais recentes verbatim; o excedente vira resumo.
      const overflow = unsummarized.slice(0, unsummarized.length - KEEP_RECENT)

      const turns: SummaryTurn[] = overflow
        .map((log) => ({
          role: log.type === 'NARRATION' ? ('assistant' as const) : ('user' as const),
          content: (log.payload as { text?: string }).text ?? '',
        }))
        .filter((t) => t.content.trim().length > 0)

      if (turns.length === 0) return

      const [adventure, state] = await Promise.all([
        this.prisma.adventure.findUnique({
          where: { id: adventureId },
          select: { memorySummary: true },
        }),
        this.prisma.characterState.findUnique({
          where: { characterId_adventureId: { characterId, adventureId } },
          select: { sceneState: true },
        }),
      ])

      const sceneLine = formatSceneState((state?.sceneState ?? null) as SceneState | null)

      const { text: updatedSummary } = await generateText({
        model: summaryModel,
        system: SUMMARY_SYSTEM_PROMPT,
        prompt: buildSummaryInput(adventure?.memorySummary, turns, sceneLine),
      })

      if (updatedSummary.trim().length === 0) return

      // Atualiza o resumo e marca os turnos incorporados, atomicamente.
      await this.prisma.$transaction([
        this.prisma.adventure.update({
          where: { id: adventureId },
          data: { memorySummary: updatedSummary.trim() },
        }),
        this.prisma.eventLog.updateMany({
          where: { id: { in: overflow.map((e) => e.id) } },
          data: { summarized: true },
        }),
      ])
    } catch (err) {
      // Não propaga: a narração já foi entregue ao jogador.
      console.error('[AiService] Falha ao sumarizar memória da sessão:', err)
    }
  }
}
