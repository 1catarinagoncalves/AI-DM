import { describe, it, expect } from 'vitest'
import { buildDmSystemPrompt } from '@ai-dm/ai-engine'
import { buildSkillSheet } from '@ai-dm/shared'

// Eval case: US-27 — Perícias do personagem. O mestre precisa CONHECER todas as
// perícias com o modificador (não só as proficientes) para decidir qualquer teste.
// Metade determinística: o bloco de ficha traz a linha de perícias com o
// modificador certo e marca (*) nas proficientes. A "narração coerente" depende
// do modelo e não roda aqui.

describe('US-27 — perícias injetadas no prompt do DM', () => {
  const catalog = [
    { key: 'athletics', label: 'Atletismo', ability: 'strength' },
    { key: 'stealth', label: 'Furtividade', ability: 'dexterity' },
    { key: 'perception', label: 'Percepção', ability: 'wisdom' },
  ]
  const attributes = { strength: 16, dexterity: 12, wisdom: 13 }
  const skills = buildSkillSheet(catalog, attributes, ['athletics', 'perception'], 2)
    .map(({ label, modifier, proficient }) => ({ label, modifier, proficient }))

  const prompt = buildDmSystemPrompt({
    systemName: 'D&D 5e',
    characterName: 'Aria',
    characterGender: 'feminino',
    characterClass: 'guerreiro',
    characterRace: 'humana',
    sheet: { level: 1, hp: 10, maxHp: 10, attributes, conditions: [], skills },
  })

  it('traz TODAS as perícias, não só as proficientes', () => {
    for (const label of ['Atletismo', 'Furtividade', 'Percepção']) {
      expect(prompt).toContain(label)
    }
  })

  it('modificador = atributo + proficiência (Atletismo For16 prof = +5; Furtividade Des12 = +1)', () => {
    expect(prompt).toContain('Atletismo +5*')   // +3 do atributo +2 proficiência
    expect(prompt).toContain('Furtividade +1')  // +1, não-proficiente, sem *
    expect(prompt).toContain('Percepção +3*')   // +1 do atributo +2 proficiência
  })
})
