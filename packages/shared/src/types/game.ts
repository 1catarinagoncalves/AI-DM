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
  /** US-38: rótulo canônico da perícia/atributo usado (ex.: "Percepção"). Ausente = rolagem sem perícia. */
  skill?: string
}

/** Uma linha do histórico de jogo servido/renderizado (US-18 + US-29).
 * US-67: `editable` só é marcado na ÚLTIMA ação do jogador quando o turno pode ser
 * reescrito (não-resumido, sem mutação de estado) — é o sinal que liga o botão de
 * editar. Ausente/false nas demais linhas e em qualquer turno do Mestre. */
export type ChatTurn = { role: 'user' | 'dm'; content: string; editable?: boolean } | RollTurn

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
