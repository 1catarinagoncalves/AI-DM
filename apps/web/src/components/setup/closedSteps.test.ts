import { describe, it, expect } from 'vitest'
import { isClosedStep } from './closedSteps'

const steps = ['system', 'class', 'review', 'world']

describe('isClosedStep (US-258)', () => {
  it('sem personagem criado nenhuma etapa está fechada', () => {
    for (const s of steps) expect(isClosedStep(steps, s, '')).toBe(false)
  })

  it('com personagem criado fecha toda etapa antes de `world`', () => {
    expect(isClosedStep(steps, 'system', 'char-1')).toBe(true)
    expect(isClosedStep(steps, 'class', 'char-1')).toBe(true)
    expect(isClosedStep(steps, 'review', 'char-1')).toBe(true)
  })

  it('`world` nunca fecha — é a etapa em que a jogadora está', () => {
    expect(isClosedStep(steps, 'world', 'char-1')).toBe(false)
  })

  it('etapa fora da trilha lança com o valor ofensor e a trilha esperada', () => {
    expect(() => isClosedStep(steps, 'nope', 'char-1')).toThrow(/"nope".*system, class, review, world/)
  })
})
