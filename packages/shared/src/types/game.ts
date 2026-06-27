export interface DiceResult {
  formula: string
  rolls: number[]
  modifier: number
  total: number
}

export interface EventLogEntry {
  id: string
  adventureId: string
  characterId?: string
  type: 'action' | 'narration' | 'dice_roll' | 'quest_update' | 'character_update'
  payload: Record<string, unknown>
  createdAt: string
}

export interface Quest {
  id: string
  adventureId: string
  title: string
  description: string
  status: 'open' | 'completed' | 'failed'
  completedAt?: string
}

export type CharacterStatePatch = Partial<{
  hp: number
  maxHp: number
  inventory: import('./character').InventoryItem[]
  conditions: string[]
}>
