import { describe, it, expect } from 'vitest'
import { buildDmSystemPrompt } from '@ai-dm/ai-engine'

// Eval case: US-23 — DM ciente da ficha completa (injeção dirigida por dados).
// Metade determinística do critério de regressão: um personagem com HP baixo e
// condição "envenenado" produz um bloco de ficha no prompt que contém HP, nível,
// condições e TODOS os atributos, com rótulos vindos do config (US-21). A metade
// "narração coerente" depende do modelo e não roda aqui (sem API paga na suite).

describe('US-23 — DM ciente da ficha', () => {
  const prompt = buildDmSystemPrompt({
    systemName: 'D&D 5e',
    characterName: 'Aria',
    characterGender: 'feminino',
    characterClass: 'guerreiro',
    characterRace: 'humana',
    activeQuests: [],
    inventory: [],
    sheet: {
      level: 3,
      hp: 4,
      maxHp: 24,
      attributes: { strength: 16, dexterity: 12, constitution: 14, intelligence: 10, wisdom: 13, charisma: 8 },
      conditions: ['envenenado'],
    },
    attributeLabels: {
      strength: 'FOR', dexterity: 'DES', constitution: 'CON',
      intelligence: 'INT', wisdom: 'SAB', charisma: 'CAR',
    },
  })

  it('o bloco de ficha traz nível, HP baixo e a condição', () => {
    expect(prompt).toMatch(/Level:\s*3/)
    expect(prompt).toMatch(/HP:\s*4\/24/)
    expect(prompt).toMatch(/Conditions:.*envenenado/)
  })

  it('traz TODOS os atributos com os rótulos do config', () => {
    for (const label of ['FOR 16', 'DES 12', 'CON 14', 'INT 10', 'SAB 13', 'CAR 8']) {
      expect(prompt).toContain(label)
    }
  })

  it('a ficha é marcada como read-only / fonte de verdade', () => {
    expect(prompt.toLowerCase()).toMatch(/character sheet \(read-only/)
  })
})
