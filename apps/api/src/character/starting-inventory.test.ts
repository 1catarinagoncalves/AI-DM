import { describe, it, expect } from 'vitest'
import { getStartingInventory } from './starting-inventory'

describe('getStartingInventory', () => {
  it('mapeia classes da tabela (case/acento-insensível)', () => {
    expect(getStartingInventory('Guerreiro').some(i => i.name === 'Espada longa')).toBe(true)
    expect(getStartingInventory('maga').some(i => i.name === 'Grimório')).toBe(true)
    expect(getStartingInventory('Paladino').some(i => i.name === 'Símbolo sagrado')).toBe(true)
  })

  it("'paladin' não é confundido com 'ladin'", () => {
    expect(getStartingInventory('Paladina').some(i => i.name === 'Escudo')).toBe(true)
  })

  it('mapeia arquétipos próximos (Patrulheira/Caçador → arqueiro)', () => {
    for (const c of ['Patrulheira', 'Caçador', 'Ranger']) {
      expect(getStartingInventory(c).some(i => i.name === 'Arco longo')).toBe(true)
    }
  })

  it('nunca devolve inventário vazio (fallback para classe desconhecida)', () => {
    expect(getStartingInventory('Inventor Steampunk').length).toBeGreaterThan(0)
    expect(getStartingInventory('').length).toBeGreaterThan(0)
  })
})
