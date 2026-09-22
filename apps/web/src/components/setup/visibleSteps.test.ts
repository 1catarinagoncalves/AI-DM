import { describe, it, expect } from 'vitest'
import { visibleSteps } from './visibleSteps'
import type { Step } from './SetupWizard'

const ALL: Step[] = ['system', 'class', 'race', 'background', 'attributes', 'skills', 'spells', 'identity', 'review', 'world']

describe('visibleSteps (US-263)', () => {
  it('classe ainda não escolhida: mantém `spells` mesmo sem conteúdo (Questão #1)', () => {
    expect(visibleSteps(ALL, '', false)).toEqual(ALL)
  })

  it('classe escolhida com conteúdo (magia própria ou truque do Alto-elfo): mantém `spells`', () => {
    expect(visibleSteps(ALL, 'wizard', true)).toEqual(ALL)
  })

  it('classe escolhida sem conteúdo: `spells` sai, o resto preserva ordem e chaves', () => {
    expect(visibleSteps(ALL, 'fighter', false)).toEqual(
      ['system', 'class', 'race', 'background', 'attributes', 'skills', 'identity', 'review', 'world'],
    )
  })
})
