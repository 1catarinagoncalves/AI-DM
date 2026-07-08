import { describe, it, expect } from 'vitest'
import { stripFabricatedRolls, formatDiceBreakdown } from './narration'

describe('US-29 — stripFabricatedRolls', () => {
  it('remove resultado inventado em PT-BR (frase inteira)', () => {
    const { clean, removed } = stripFabricatedRolls(
      'Com um total de 20 no teste de Percepção, você nota a sombra. Ela se move.',
    )
    expect(clean).not.toMatch(/20/)
    expect(clean).not.toMatch(/total/i)
    expect(clean).not.toMatch(/teste de Percep/i)
    expect(clean).toContain('Ela se move.') // frase seguinte preservada
    expect(removed).toHaveLength(1)
  })

  it('remove resultado inventado em EN', () => {
    const { clean } = stripFabricatedRolls('You roll a 17 on your Stealth check and slip past.')
    expect(clean).toBe('')
  })

  it('remove breakdown vazado na prosa', () => {
    const { clean } = stripFabricatedRolls('A lâmina desce. 1d20+5: [14] +5 = 19. Ela acerta.')
    expect(clean).not.toMatch(/1d20/)
    expect(clean).not.toMatch(/19/)
    expect(clean).toContain('A lâmina desce.')
    expect(clean).toContain('Ela acerta.')
  })

  it('preserva números que NÃO são rolagem (falso-positivo)', () => {
    const input = 'Três goblins bloqueiam a ponte; você tem 8 de HP.'
    expect(stripFabricatedRolls(input).clean).toBe(input)
  })

  it('preserva prosa sem número', () => {
    const input = 'A floresta cheira a musgo e chuva recente.'
    expect(stripFabricatedRolls(input).clean).toBe(input)
  })
})

describe('US-29 — formatDiceBreakdown', () => {
  it('formata como US-09', () => {
    expect(formatDiceBreakdown({ formula: '1d20+5', rolls: [14], modifier: 5, total: 19 })).toBe('1d20+5: [14] +5 = 19')
  })
  it('omite modificador zero e mostra vários dados', () => {
    expect(formatDiceBreakdown({ formula: '2d6', rolls: [4, 2], modifier: 0, total: 6 })).toBe('2d6: [4, 2] = 6')
  })
  it('modificador negativo', () => {
    expect(formatDiceBreakdown({ formula: '1d20-1', rolls: [10], modifier: -1, total: 9 })).toBe('1d20-1: [10] -1 = 9')
  })
})
