import { describe, it, expect } from 'vitest'
import { buildSkillSheet, resolveRollModifier, normalizeDie } from '@ai-dm/shared'
import { buildDmSystemPrompt } from '@ai-dm/ai-engine'

// Eval US-38 — Rolagens ancoradas na ficha. Determinístico: o modificador de um
// teste vem de buildSkillSheet/abilityModifier (US-27), nunca do modelo; o dado
// base descarta qualquer +N. Reproduz o bug da imagem (Percepção +5 real, +6
// impossível). A obediência do modelo depende do LLM e não roda aqui.

describe('US-38 — modificador ancorado na ficha', () => {
  const catalog = [
    { key: 'stealth', label: 'Furtividade', ability: 'dexterity' },
    { key: 'perception', label: 'Percepção', ability: 'wisdom' },
  ]
  const attributes = { dexterity: 16, wisdom: 16 }
  const skills = buildSkillSheet(catalog, attributes, ['stealth'], 2)

  it('o +6 da imagem é impossível: Percepção real é +3, Furtividade +5', () => {
    expect(resolveRollModifier({ skill: 'perception', skills, attributes }).modifier).toBe(3)
    expect(resolveRollModifier({ skill: 'stealth', skills, attributes }).modifier).toBe(5)
    // nenhuma perícia da ficha chega a +6
    expect(skills.every((s) => s.modifier <= 5)).toBe(true)
  })

  it('o modelo não injeta modificador: o +N da fórmula é descartado', () => {
    expect(normalizeDie('1d20+6')).toBe('1d20')
  })

  it('key desconhecida cai em 0, nunca num número inventado', () => {
    expect(resolveRollModifier({ skill: 'inexistente', skills, attributes })).toEqual({ modifier: 0, unresolved: true })
  })
})

describe('US-38 — prompt instrui nome da perícia e um teste por ação', () => {
  const prompt = buildDmSystemPrompt({
    systemName: 'D&D 5e',
    characterName: 'Lyra',
    characterGender: 'feminino',
    characterClass: 'patrulheira',
    characterRace: 'humana',
    sheet: { level: 1, hp: 10, maxHp: 10, attributes: { wisdom: 16 }, conditions: [] },
  })

  it('pede o NOME da perícia como na ficha e proíbe modificador próprio', () => {
    expect(prompt).toMatch(/skill.*NAME/i)
    expect(prompt).toMatch(/NEVER pass a modifier/i)
  })

  it('exige um teste por ação (sem versão genérica + nomeada)', () => {
    expect(prompt).toMatch(/ONE action.*ONE check/i)
  })
})
