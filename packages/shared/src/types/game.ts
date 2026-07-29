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

