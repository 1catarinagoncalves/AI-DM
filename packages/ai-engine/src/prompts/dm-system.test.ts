import { describe, it, expect } from 'vitest'
import { buildDmSystemPrompt, type DmCharacterSheet } from './dm-system'

const baseSheet: DmCharacterSheet = {
  level: 3,
  hp: 8,
  maxHp: 24,
  attributes: { strength: 16, dexterity: 12 },
  conditions: ['envenenado'],
}

function build(overrides: Partial<Parameters<typeof buildDmSystemPrompt>[0]> = {}) {
  return buildDmSystemPrompt({
    systemName: 'D&D 5e',
    characterName: 'Aria',
    characterGender: 'feminino',
    characterClass: 'guerreiro',
    characterRace: 'humana',
    activeQuests: [],
    inventory: [],
    sheet: baseSheet,
    ...overrides,
  })
}

describe('buildDmSystemPrompt — ficha (US-23)', () => {
  it('inclui nível, HP/HP máx, condições e atributos da ficha', () => {
    const p = build()
    expect(p).toMatch(/Level:\s*3/)
    expect(p).toMatch(/HP:\s*8\/24/)
    expect(p).toMatch(/envenenado/)
    expect(p).toMatch(/16/)
    expect(p).toMatch(/12/)
  })

  it('marca a seção da ficha como read-only / fonte de verdade', () => {
    expect(build().toLowerCase()).toMatch(/character sheet \(read-only/)
  })

  it('renderiza atributos iterando o map — um atributo novo aparece sem editar o builder', () => {
    const p = build({ sheet: { ...baseSheet, attributes: { ...baseSheet.attributes, sorte: 7 } } })
    expect(p).toMatch(/sorte/i)
    expect(p).toMatch(/7/)
  })

  it('usa o label do config quando presente e cai na chave crua sem crashar quando ausente', () => {
    const withLabels = build({ attributeLabels: { strength: 'FOR', dexterity: 'DES' } })
    expect(withLabels).toMatch(/FOR 16/)
    expect(withLabels).toMatch(/DES 12/)

    const noLabels = build() // sem attributeLabels → chave crua, sem crash
    expect(noLabels).toMatch(/strength 16/)
  })

  it('não quebra com condições/atributos vazios', () => {
    const p = build({ sheet: { level: 1, hp: 10, maxHp: 10, attributes: {}, conditions: [] } })
    expect(p).toMatch(/Level:\s*1/)
    expect(p).toMatch(/HP:\s*10\/10/)
    expect(typeof p).toBe('string')
  })
})
