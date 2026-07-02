import { describe, it, expect } from 'vitest'
import type { SystemConfig } from '@ai-dm/shared'
import { getStartingInventory } from './starting-inventory'

const dnd5eConfig: SystemConfig = {
  attributes: [{ key: 'strength', label: 'Força', min: 3, max: 20, default: 10 }],
  startingKits: {
    guerreiro: [{ name: 'Espada longa', qty: 1 }, { name: 'Escudo', qty: 1 }],
    mago: [{ name: 'Grimório', qty: 1 }],
    paladino: [{ name: 'Espada longa', qty: 1 }, { name: 'Escudo', qty: 1 }, { name: 'Símbolo sagrado', qty: 1 }],
    arqueiro: [{ name: 'Arco longo', qty: 1 }],
    default: [{ name: 'Adaga', qty: 1 }],
  },
}

describe('getStartingInventory', () => {
  it('mapeia classes da tabela (case/acento-insensível)', () => {
    expect(getStartingInventory(dnd5eConfig, 'Guerreiro').some(i => i.name === 'Espada longa')).toBe(true)
    expect(getStartingInventory(dnd5eConfig, 'maga').some(i => i.name === 'Grimório')).toBe(true)
    expect(getStartingInventory(dnd5eConfig, 'Paladino').some(i => i.name === 'Símbolo sagrado')).toBe(true)
  })

  it("'paladin' não é confundido com 'ladin'", () => {
    expect(getStartingInventory(dnd5eConfig, 'Paladina').some(i => i.name === 'Escudo')).toBe(true)
  })

  it('mapeia arquétipos próximos (Patrulheira/Caçador → arqueiro)', () => {
    for (const c of ['Patrulheira', 'Caçador', 'Ranger']) {
      expect(getStartingInventory(dnd5eConfig, c).some(i => i.name === 'Arco longo')).toBe(true)
    }
  })

  it('nunca devolve inventário vazio (fallback para classe desconhecida)', () => {
    expect(getStartingInventory(dnd5eConfig, 'Inventor Steampunk').length).toBeGreaterThan(0)
    expect(getStartingInventory(dnd5eConfig, '').length).toBeGreaterThan(0)
  })

  it('sistema sem a classe no config cai no default (ex.: system-free)', () => {
    const freeConfig: SystemConfig = {
      attributes: [{ key: 'sorte', label: 'Sorte', min: 1, max: 20, default: 10 }],
      startingKits: { default: [{ name: 'Mochila', qty: 1 }] },
    }
    expect(getStartingInventory(freeConfig, 'Guerreiro')).toEqual([{ name: 'Mochila', qty: 1 }])
  })
})
