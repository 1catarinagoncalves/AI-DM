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
