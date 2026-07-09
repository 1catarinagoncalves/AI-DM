import { describe, it, expect } from 'vitest'
import { buildDmSystemPrompt } from '@ai-dm/ai-engine'

// Eval case: US-39 — identidade narrativa (background/ideais/vínculos/fraquezas).
// Metade determinística do critério de regressão: um personagem com background +
// uma fraqueza produz uma seção de identidade no prompt contendo os dois textos,
// marcada read-only. A metade "a narração HONRA a fraqueza" depende do modelo e
// vai no bake-off da US-17 (não roda aqui, sem API paga na suite).

describe('US-39 — identidade narrativa no prompt', () => {
  const prompt = buildDmSystemPrompt({
    systemName: 'D&D 5e',
    characterName: 'Lady Seraphine Valthor',
    characterGender: 'feminino',
    characterClass: 'paladina',
    characterRace: 'humana',
    activeQuests: [],
    inventory: [],
    sheet: { level: 5, hp: 44, maxHp: 44, attributes: { charisma: 16 }, conditions: [] },
    background: {
      story: 'Nobre menor que perdeu a família para um culto demoníaco',
      flaws: ['Código de honra rígido: não mente, não abandona inocentes'],
    },
  })

  it('a seção de identidade traz o background e a fraqueza', () => {
    expect(prompt).toMatch(/Nobre menor que perdeu a família/)
    expect(prompt).toMatch(/Código de honra rígido/)
  })

  it('a seção é marcada read-only / roleplay e instrui o uso do traço', () => {
    expect(prompt.toLowerCase()).toMatch(/character identity \(read-only/)
    expect(prompt.toLowerCase()).toMatch(/flaw|dilemma/)
  })

  it('personagem sem identidade não gera a seção', () => {
    const p = buildDmSystemPrompt({
      systemName: 'D&D 5e', characterName: 'Aria', characterGender: 'feminino',
      characterClass: 'guerreiro', characterRace: 'humana', activeQuests: [], inventory: [],
      sheet: { level: 1, hp: 10, maxHp: 10, attributes: {}, conditions: [] },
    })
    expect(p).not.toMatch(/Character identity/i)
  })
})
