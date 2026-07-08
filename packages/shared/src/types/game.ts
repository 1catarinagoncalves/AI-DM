export interface DiceResult {
  formula: string
  rolls: number[]
  modifier: number
  total: number
}

/** US-29: turno de rolagem exibido no chat (bloco antes da narração). */
export interface RollTurn extends DiceResult {
  role: 'roll'
  label: string
}

/** Uma linha do histórico de jogo servido/renderizado (US-18 + US-29). */
export type ChatTurn = { role: 'user' | 'dm'; content: string } | RollTurn

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
