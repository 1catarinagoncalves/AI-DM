import { tool } from 'ai'
import { z } from 'zod'
import type { DiceResult } from '@ai-dm/shared'

export const rollDiceTool = tool({
  description: 'Roll dice using standard RPG notation (e.g. 2d6+3, 1d20). Always use this tool for any mechanical dice roll — never generate random numbers yourself.',
  parameters: z.object({
    formula: z.string().describe('Dice formula, e.g. "2d6+3" or "1d20"'),
    reason: z.string().describe('Why this roll is happening, e.g. "attack roll against goblin"'),
  }),
  execute: async ({ formula, reason }): Promise<DiceResult> => {
    // Execution is delegated to the Game Server via HTTP.
    // This placeholder is replaced at runtime by the API handler.
    throw new Error(`rollDice tool must be bound to Game Server. formula=${formula} reason=${reason}`)
  },
})
