import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import { rollRegistry } from './roll-registry'

describe('rollRegistry (US-147)', () => {
  it('mesmo characterId+order produz o mesmo registro em duas execuções', () => {
    expect(rollRegistry('char-1', 1)).toEqual(rollRegistry('char-1', 1))
  })

  it('order diferente produz registro diferente em algum campo (não-degenerado)', () => {
    const results = Array.from({ length: 15 }, (_, i) => rollRegistry('char-1', i + 1))
    const tones = new Set(results.map((r) => r.tone))
    expect(tones.size).toBeGreaterThan(1)
  })

  it('cada campo aceita override independente — sem exigir que os três venham juntos', () => {
    const result = rollRegistry('char-1', 1, { tone: 'horror' })
    expect(result.tone).toBe('horror')
    // setting/areaType continuam vindo do sorteio, não ficam vazios por causa do override de tone
    expect(result.setting).toBe(rollRegistry('char-1', 1).setting)
    expect(result.areaType).toBe(rollRegistry('char-1', 1).areaType)
  })

  it('override de um campo não desloca o sorteio dos outros dois', () => {
    const semOverride = rollRegistry('char-1', 1)
    const comOverrideDeTone = rollRegistry('char-1', 1, { tone: 'comedic' })
    expect(comOverrideDeTone.setting).toBe(semOverride.setting)
    expect(comOverrideDeTone.areaType).toBe(semOverride.areaType)
  })

  it('o módulo não chama Math.random', () => {
    const source = readFileSync(resolve(__dirname, 'roll-registry.ts'), 'utf8')
    expect(source).not.toMatch(/Math\.random\(/)
  })
})
