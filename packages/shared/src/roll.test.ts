import { describe, it, expect } from 'vitest'
import { resolveRollModifier, normalizeDie } from './roll'
import { buildSkillSheet } from './ability'

// US-38: o modificador de um teste vem da ficha (US-27), nunca do modelo.
describe('US-38 — resolveRollModifier', () => {
  // Ficha da imagem: Lyra, DES 16, SAB 16, Furtividade proficiente (bônus +2).
  const catalog = [
    { key: 'stealth', label: 'Furtividade', ability: 'dexterity' },
    { key: 'perception', label: 'Percepção', ability: 'wisdom' },
  ]
  const attributes = { dexterity: 16, wisdom: 16 }
  const skills = buildSkillSheet(catalog, attributes, ['stealth'], 2)

  it('perícia proficiente usa o modificador da ficha + rótulo canônico (Furtividade DES16 prof = +5)', () => {
    expect(resolveRollModifier({ skill: 'stealth', skills, attributes })).toEqual({ modifier: 5, unresolved: false, label: 'Furtividade' })
  })

  it('devolve o rótulo CANÔNICO mesmo quando o modelo manda a key/rótulo variante', () => {
    // "percepção" (label variante) → rótulo canônico "Percepção" para exibir no bloco.
    expect(resolveRollModifier({ skill: 'percepção', skills, attributes }).label).toBe('Percepção')
    expect(resolveRollModifier({ skill: 'perception', skills, attributes }).label).toBe('Percepção')
  })

  it('perícia não-proficiente = só o modificador do atributo (Percepção SAB16 = +3)', () => {
    // O caso da imagem: Percepção real é +3/+5-max, NUNCA +6.
    expect(resolveRollModifier({ skill: 'perception', skills, attributes })).toEqual({ modifier: 3, unresolved: false, label: 'Percepção' })
  })

  it('casa pelo RÓTULO com acento/caixa (o modelo manda "percepção", não a key)', () => {
    // Bug real: o prompt mostra "Percepção", o modelo mandou "percepção" → tem que resolver +3, não +0.
    expect(resolveRollModifier({ skill: 'percepção', skills, attributes })).toEqual({ modifier: 3, unresolved: false, label: 'Percepção' })
    expect(resolveRollModifier({ skill: 'Furtividade', skills, attributes })).toEqual({ modifier: 5, unresolved: false, label: 'Furtividade' })
  })

  it('atributo casa por key ou rótulo (attributeLabels)', () => {
    const attributeLabels = { dexterity: 'Destreza', wisdom: 'Sabedoria' }
    expect(resolveRollModifier({ ability: 'Destreza', attributes, attributeLabels })).toEqual({ modifier: 3, unresolved: false, label: 'Destreza' })
    expect(resolveRollModifier({ ability: 'dexterity', attributes, attributeLabels })).toEqual({ modifier: 3, unresolved: false, label: 'Destreza' })
  })

  it('teste de atributo cru usa abilityModifier (DES16 = +3), rótulo cai na key sem labels', () => {
    expect(resolveRollModifier({ ability: 'dexterity', attributes })).toEqual({ modifier: 3, unresolved: false, label: 'dexterity' })
  })

  it('perícia inexistente → 0 + unresolved (nunca um número inventado)', () => {
    expect(resolveRollModifier({ skill: 'nao_existe', skills, attributes })).toEqual({ modifier: 0, unresolved: true })
  })

  it('sem anchor (misfire) → 0 + unresolved', () => {
    expect(resolveRollModifier({ attributes })).toEqual({ modifier: 0, unresolved: true })
  })
})

describe('US-38 — normalizeDie', () => {
  it('descarta o modificador que o modelo tente embutir', () => {
    expect(normalizeDie('1d20+6')).toBe('1d20')
    expect(normalizeDie('1d20 + 5')).toBe('1d20')
  })
  it('preserva o dado base e aceita NdM genérico', () => {
    expect(normalizeDie('2d6')).toBe('2d6')
    expect(normalizeDie('1d100')).toBe('1d100')
  })
  it('ausente/inválido → 1d20', () => {
    expect(normalizeDie(undefined)).toBe('1d20')
    expect(normalizeDie('lixo')).toBe('1d20')
  })
})
