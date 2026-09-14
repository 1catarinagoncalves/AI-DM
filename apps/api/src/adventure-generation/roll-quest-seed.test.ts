import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import { rollQuestSeed } from './roll-quest-seed'
import { rollFactionCount, rollNamingRegister } from './roll-registry'

describe('rollQuestSeed (US-241)', () => {
  it('mesmo characterId+order+attempt produz sempre a mesma semente', () => {
    expect(rollQuestSeed('char-1', 1)).toBe(rollQuestSeed('char-1', 1))
  })

  it('attempt diferente muda a semente (reseed, US-150)', () => {
    const results = Array.from({ length: 10 }, (_, i) => rollQuestSeed('char-1', 1, i))
    expect(new Set(results).size).toBeGreaterThan(1)
  })

  it('order diferente produz semente diferente (não-degenerado)', () => {
    expect(rollQuestSeed('char-1', 1)).not.toBe(rollQuestSeed('char-1', 2))
  })

  it('a frase liga conceito e MacGuffin com "because"', () => {
    expect(rollQuestSeed('char-1', 1)).toMatch(/^.+ because .+$/)
  })

  it('caminho A: local/monumento sempre entram junto com os 2 atributos (nunca só um dos dois)', () => {
    const results = Array.from({ length: 30 }, (_, i) => rollQuestSeed('char-1', i + 1))
    const pathA = results.filter((r) => r.includes(' in the '))
    expect(pathA.length).toBeGreaterThan(0)
    for (const seed of pathA) {
      expect(seed).toMatch(/because of the .+ in the .+, which is .+ and .+$/)
    }
  })

  it('caminho B: patrono/NPC sozinho, sem local/monumento', () => {
    const results = Array.from({ length: 30 }, (_, i) => rollQuestSeed('char-1', i + 1))
    const pathB = results.filter((r) => r.includes(' demands it'))
    expect(pathB.length).toBeGreaterThan(0)
    for (const seed of pathB) {
      expect(seed).toMatch(/because a .+ demands it$/)
      expect(seed).not.toContain(' in the ')
    }
  })

  // AC: "2 de 3" nunca sorteia sempre o MESMO par de atributos — smoke, não estatística completa.
  it('a categoria "2 de 3" varia entre condition/description/origin (smoke)', () => {
    const results = Array.from({ length: 40 }, (_, i) => rollQuestSeed('char-1', i + 1))
    const pathAWithAttrs = results.filter((r) => r.includes(', which is '))
    const pairs = new Set(pathAWithAttrs.map((r) => r.match(/, which is (.+)$/)?.[1]))
    expect(pairs.size).toBeGreaterThan(1)
  })

  it('não desloca o sorteio de rollFactionCount/rollNamingRegister (sub-seed próprio)', () => {
    const semQuestSeed = { factionCount: rollFactionCount('char-1', 1), namingRegister: rollNamingRegister('char-1', 1) }
    rollQuestSeed('char-1', 1)
    const comQuestSeed = { factionCount: rollFactionCount('char-1', 1), namingRegister: rollNamingRegister('char-1', 1) }
    expect(comQuestSeed).toEqual(semQuestSeed)
  })

  it('o módulo não chama Math.random', () => {
    const source = readFileSync(resolve(__dirname, 'roll-quest-seed.ts'), 'utf8')
    expect(source).not.toMatch(/Math\.random\(/)
  })
})
