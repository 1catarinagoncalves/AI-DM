import { describe, it, expect } from 'vitest'
import { DiceService } from './dice.service'

const dice = new DiceService()

describe('DiceService', () => {
  it('rola 1d20 dentro do intervalo [1, 20]', () => {
    for (let i = 0; i < 100; i++) {
      const { total } = dice.roll('1d20')
      expect(total).toBeGreaterThanOrEqual(1)
      expect(total).toBeLessThanOrEqual(20)
    }
  })

  it('aplica modificador positivo', () => {
    const { rolls, modifier, total } = dice.roll('1d6+3')
    expect(total).toBe(rolls[0]! + modifier)
    expect(modifier).toBe(3)
  })

  it('aplica modificador negativo', () => {
    const { modifier } = dice.roll('1d6-2')
    expect(modifier).toBe(-2)
  })

  it('rola múltiplos dados', () => {
    const { rolls } = dice.roll('3d6')
    expect(rolls).toHaveLength(3)
  })

  it('retorna breakdown correto', () => {
    const result = dice.roll('2d6+3')
    expect(result.total).toBe(result.rolls.reduce((a, b) => a + b, 0) + result.modifier)
  })

  it('lança erro para fórmula inválida', () => {
    expect(() => dice.roll('invalido')).toThrow('Invalid dice formula')
  })
})
