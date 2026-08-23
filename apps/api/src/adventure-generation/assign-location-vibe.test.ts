import { describe, it, expect } from 'vitest'
import type { AdventureLocation } from '@ai-dm/shared'
import { pickLocationIdForType } from './assign-location-vibe'

function loc(overrides: Partial<AdventureLocation> = {}): AdventureLocation {
  return { id: 'loc-1', title: 'x', aspects: [], boxedText: 'x', description: 'x', occupants: [], vibe: 'combat', ...overrides }
}

describe('pickLocationIdForType (US-187)', () => {
  it('subconjunto com candidato: round-robin dentro dele, ignora locais de outro vibe', () => {
    const locations = [
      loc({ id: 'loc-1', vibe: 'combat' }),
      loc({ id: 'loc-2', vibe: 'social' }),
      loc({ id: 'loc-3', vibe: 'combat' }),
    ]
    expect(pickLocationIdForType(locations, 'combat', 0, 0)).toEqual({ id: 'loc-1', usedFallback: false })
    expect(pickLocationIdForType(locations, 'combat', 1, 5)).toEqual({ id: 'loc-3', usedFallback: false })
    expect(pickLocationIdForType(locations, 'combat', 2, 5)).toEqual({ id: 'loc-1', usedFallback: false }) // volta ao início (round-robin)
  })

  it('subconjunto vazio: cai no round-robin original sobre locations inteiro, usedFallback true', () => {
    const locations = [loc({ id: 'loc-1', vibe: 'combat' }), loc({ id: 'loc-2', vibe: 'combat' })]
    expect(pickLocationIdForType(locations, 'social', 0, 0)).toEqual({ id: 'loc-1', usedFallback: true })
    expect(pickLocationIdForType(locations, 'social', 0, 1)).toEqual({ id: 'loc-2', usedFallback: true })
    expect(pickLocationIdForType(locations, 'social', 0, 2)).toEqual({ id: 'loc-1', usedFallback: true }) // globalIndex % length
  })
})
