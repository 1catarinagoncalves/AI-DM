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
  })
})
