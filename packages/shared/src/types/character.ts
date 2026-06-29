export interface Attributes {
  strength: number
  dexterity: number
  constitution: number
  intelligence: number
  wisdom: number
  charisma: number
}

export interface CharacterState {
  id: string
  characterId: string
  adventureId: string
  hp: number
  maxHp: number
  attributes: Attributes
  inventory: InventoryItem[]
  conditions: string[]
  updatedAt: string
}

export interface InventoryItem {
  name: string
  qty: number
}

// Estado de cena estruturado (US-03): fonte de verdade da continuidade
// espacial, reinjetada no prompt a cada turno e atualizada deterministicamente.
export interface SceneState {
  local: string
  ambiente: 'externo' | 'interno'
  periodo: string
  presentes: string[]
  objetos_em_cena: string[]
  atualizadoEm: string
}
