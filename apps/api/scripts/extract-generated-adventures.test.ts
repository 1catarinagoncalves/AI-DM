import { describe, it, expect, vi } from 'vitest'
import type { GeneratedAdventure } from '@ai-dm/shared'
import { extractAdventures, ALLOWED_EMAILS, type ExtractableAdventure } from './extract-generated-adventures'

// Fixture mínima válida contra GeneratedAdventureSchema (US-232, mundo-primeiro) — mesmo
// formato da fixture "seraphine" de adventure-generation.test.ts, reduzida ao mínimo que
// ainda passa .parse() (arrays vazios são aceitos, só branchedResolution exige ≥1).
function validAdventure(id = 'adv-1'): GeneratedAdventure {
  return {
    id,
    levelRange: { min: 1, max: 1 },
    registry: { setting: 'fantasy', tone: 'mystery', areaType: 'settlement' },
    summary: 'Resumo.',
    world: { name: 'Mundo', description: 'Descrição.' },
    story: 'História central.',
    factions: [],
    npcs: [],
    locations: [],
    challenges: [],
    encounters: [],
    start: 'Início.',
    objective: { description: 'Objetivo.', reward: { name: 'Prêmio', effect: 'efeito' }, locationId: 'loc-1' },
    branchedResolution: [{ choice: 'Escolha', consequence: 'Consequência' }],
    followUps: [],
  }
}

function row(overrides: Partial<ExtractableAdventure> = {}): ExtractableAdventure {
  return {
    id: 'adv-1',
    generatedAdventure: validAdventure(),
    creator: { email: ALLOWED_EMAILS[0] },
    participants: [{ characterId: 'char-1' }],
    ...overrides,
  }
}

describe('extractAdventures (US-244)', () => {
  it('não grava Adventure de creator.email fora da allowlist', () => {
    const write = vi.fn()
    const result = extractAdventures([row({ creator: { email: 'outra@pessoa.com' } })], write)

    expect(write).not.toHaveBeenCalled()
    expect(result.written).toEqual([])
    expect(result.skipped).toEqual([])
  })

  it('grava Adventure de creator.email na allowlist com o characterId certo', () => {
    const write = vi.fn().mockReturnValue('evals/reports/authoring-char-1-2026-09-16.json')
    const adventure = validAdventure('adv-42')
    const result = extractAdventures([row({ id: 'adv-42', generatedAdventure: adventure, participants: [{ characterId: 'char-9' }] })], write)

    expect(write).toHaveBeenCalledWith('char-9', adventure)
    expect(result.written).toEqual(['evals/reports/authoring-char-1-2026-09-16.json'])
    expect(result.skipped).toEqual([])
  })

  it('pula artefato que falha GeneratedAdventureSchema.parse() sem derrubar o lote', () => {
    const write = vi.fn().mockReturnValue('evals/reports/authoring-char-2-2026-09-16.json')
    const invalid = row({ id: 'adv-bad', generatedAdventure: { conclusion: 'forma velha' } })
    const valid = row({ id: 'adv-ok', participants: [{ characterId: 'char-2' }] })

    const result = extractAdventures([invalid, valid], write)

    expect(write).toHaveBeenCalledTimes(1)
    expect(write).toHaveBeenCalledWith('char-2', validAdventure())
    expect(result.skipped).toEqual(['adv-bad'])
    expect(result.written).toEqual(['evals/reports/authoring-char-2-2026-09-16.json'])
  })
})
