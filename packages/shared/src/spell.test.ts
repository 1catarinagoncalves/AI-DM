import { describe, it, expect } from 'vitest'
import { spellLevelLabel } from './spell'

describe('spellLevelLabel (US-42/US-50)', () => {
  it('nível 0 é truque', () => {
    expect(spellLevelLabel(0)).toBe('truque')
  })

  it('nível >= 1 é "nível N"', () => {
    expect(spellLevelLabel(1)).toBe('nível 1')
    expect(spellLevelLabel(3)).toBe('nível 3')
  })

  it('nível ausente não tem rótulo', () => {
    expect(spellLevelLabel(undefined)).toBe('')
    expect(spellLevelLabel(undefined, 'en-US')).toBe('')
  })

  // US-100: o rótulo acompanha o locale, como o nome da magia. Sem isto, a mesma lista saía
  // "Sacred Flame (truque)" numa mesa em inglês — metade traduzida.
  it('en-US usa cantrip / level N', () => {
    expect(spellLevelLabel(0, 'en-US')).toBe('cantrip')
    expect(spellLevelLabel(1, 'en-US')).toBe('level 1')
    expect(spellLevelLabel(3, 'en-US')).toBe('level 3')
  })

  it('pt-BR explícito dá o mesmo que o default (o default É pt-BR)', () => {
    expect(spellLevelLabel(0, 'pt-BR')).toBe(spellLevelLabel(0))
    expect(spellLevelLabel(2, 'pt-BR')).toBe(spellLevelLabel(2))
  })
})
