import { describe, it, expect } from 'vitest'
import { abilityModifier, formatModifier } from './ability'

describe('abilityModifier', () => {
  it('cobre os casos de fronteira da tabela 5e', () => {
    expect(abilityModifier(1)).toBe(-5)
    expect(abilityModifier(8)).toBe(-1)
    expect(abilityModifier(10)).toBe(0)
    expect(abilityModifier(11)).toBe(0)
    expect(abilityModifier(15)).toBe(2)
    expect(abilityModifier(20)).toBe(5)
  })

  it('ímpar e o par anterior dão o mesmo modificador (14 e 15 → +2)', () => {
    expect(abilityModifier(14)).toBe(abilityModifier(15))
  })
})

describe('formatModifier', () => {
  it('põe sinal em positivos, mantém negativo, 0 sem sinal', () => {
    expect(formatModifier(2)).toBe('+2')
    expect(formatModifier(0)).toBe('0')
    expect(formatModifier(-1)).toBe('-1')
  })
})
