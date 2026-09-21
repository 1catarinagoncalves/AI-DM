import { describe, it, expect } from 'vitest'
import { resolveJump } from './stepJump'

const steps = ['system', 'class', 'skills', 'review'] as const
const allValid = () => true
const invalid = (...keys: string[]) => (s: string) => !keys.includes(s)

describe('resolveJump (US-260)', () => {
  it('para trás: cai direto na etapa pedida, sem consultar canAdvance', () => {
    const never = () => { throw new Error('canAdvance não devia ser chamado') }
    expect(resolveJump(steps, 'review', 'class', 3, never)).toBe('class')
  })

  it('para a frente até `furthest` com o meio válido: cai na etapa pedida', () => {
    expect(resolveJump(steps, 'class', 'review', 3, allValid)).toBe('review')
  })

  it('para a frente com etapa do meio inválida: para na primeira inválida', () => {
    expect(resolveJump(steps, 'class', 'review', 3, invalid('skills'))).toBe('skills')
  })

  it('entre duas inválidas, para na primeira', () => {
    expect(resolveJump(steps, 'system', 'review', 3, invalid('skills', 'class'))).toBe('class')
  })

  it('a própria etapa de partida também conta: inválida, não sai do lugar', () => {
    expect(resolveJump(steps, 'class', 'review', 3, invalid('class'))).toBe('class')
  })

  it('etapa além de `furthest` nunca foi alcançada em ordem: não sai do lugar', () => {
    expect(resolveJump(steps, 'class', 'review', 2, allValid)).toBe('class')
  })

  it('etapa alcançada (<= furthest) mas ainda à frente: vale', () => {
    expect(resolveJump(steps, 'class', 'skills', 2, allValid)).toBe('skills')
  })

  it('etapa fora da trilha lança com o valor ofensor e a trilha esperada', () => {
    expect(() => resolveJump(steps, 'class', 'nope', 3, allValid)).toThrow(/"nope".*system, class, skills, review/)
    expect(() => resolveJump(steps, 'nope', 'class', 3, allValid)).toThrow(/"nope".*system, class, skills, review/)
  })
})
