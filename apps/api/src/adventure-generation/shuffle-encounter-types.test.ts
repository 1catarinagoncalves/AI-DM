import { describe, it, expect } from 'vitest'
import { shuffleEncounterTypes } from './shuffle-encounter-types'

describe('shuffleEncounterTypes (US-166)', () => {
  it('combatViable: devolve 8 tipos, posição 8 sempre combat', () => {
    const types = shuffleEncounterTypes('char-1', 1, true)
    expect(types).toHaveLength(8)
    expect(types[7]).toBe('combat')
  })

  it('combatViable: posições 1-7 são o multiset {combat×2, skill×3, social×2}', () => {
    const types = shuffleEncounterTypes('char-1', 1, true)
    const head = types.slice(0, 7)
    expect(head.filter((t) => t === 'combat')).toHaveLength(2)
    expect(head.filter((t) => t === 'skill')).toHaveLength(3)
    expect(head.filter((t) => t === 'social')).toHaveLength(2)
  })

  it('combatViable: nenhum tipo repete em posições adjacentes, incluindo 7↔8', () => {
    const types = shuffleEncounterTypes('char-7', 3, true)
    for (let i = 1; i < types.length; i++) {
      expect(types[i]).not.toBe(types[i - 1])
    }
  })

  it('não combatViable: posição 8 vira social, combat não aparece em nenhuma posição', () => {
    const types = shuffleEncounterTypes('char-1', 1, false)
    expect(types).toHaveLength(8)
    expect(types[7]).toBe('social')
    expect(types).not.toContain('combat')
  })

  it('não combatViable: posições 1-7 são o multiset {social×4, skill×3}', () => {
    const types = shuffleEncounterTypes('char-1', 1, false)
    const head = types.slice(0, 7)
    expect(head.filter((t) => t === 'social')).toHaveLength(4)
    expect(head.filter((t) => t === 'skill')).toHaveLength(3)
  })

  it('não combatViable: posições 1-7 nunca repetem tipo em posições adjacentes ENTRE SI', () => {
    const types = shuffleEncounterTypes('char-9', 4, false)
    const head = types.slice(0, 7)
    for (let i = 1; i < head.length; i++) {
      expect(head[i]).not.toBe(head[i - 1])
    }
  })

  // {social×4, skill×3} em 7 posições tem UM ÚNICO arranjo sem repetição adjacente interna —
  // alternado, começando E terminando em social (4 sociais forçam isso por contagem: nenhum
  // outro arranjo evita social-social). Como a posição 8 também é social, a fronteira 7↔8
  // colide por construção matemática — exceção aceita, não regressão (ver buildNoAdjacentSequence).
  it('não combatViable: posições 1-7 formam o único arranjo válido — alternado, terminando em social', () => {
    const types = shuffleEncounterTypes('char-1', 1, false)
    expect(types.slice(0, 7)).toEqual(['social', 'skill', 'social', 'skill', 'social', 'skill', 'social'])
    expect(types[7]).toBe('social') // posição 8, fronteira 7↔8 colide — forçado, ver acima
  })

  it('mesmo characterId+order+attempt: sequência determinística entre execuções', () => {
    const a = shuffleEncounterTypes('char-1', 5, true, 0)
    const b = shuffleEncounterTypes('char-1', 5, true, 0)
    expect(a).toEqual(b)
  })

  it('characterId diferente: sequência de tipos diferente (não hardcoded)', () => {
    const a = shuffleEncounterTypes('char-1', 5, true, 0)
    const b = shuffleEncounterTypes('char-2', 5, true, 0)
    expect(a).not.toEqual(b)
  })

  it('attempt diferente (reseed): sequência diferente da tentativa anterior', () => {
    const a = shuffleEncounterTypes('char-1', 5, true, 0)
    const b = shuffleEncounterTypes('char-1', 5, true, 1)
    expect(a).not.toEqual(b)
  })
})
