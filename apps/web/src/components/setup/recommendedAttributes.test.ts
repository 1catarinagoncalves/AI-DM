import { describe, it, expect } from 'vitest'
import { recommendedAttributes, POINT_COST } from './recommendedAttributes'

// Mesma faixa que o seed grava pro sistema D&D 5e SRD (ATTR_RANGE em scripts/srd/ingest.mjs,
// pointBuy.budget em apps/api/prisma/seed.ts) — não os 8/15 dos configs de teste do
// SetupWizard.test.tsx, que isolam a mecânica de point-buy sem depender do valor real do SRD.
const ATTRIBUTES = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma']
  .map(key => ({ key, min: 10, max: 18, default: 10 }))
const BUDGET = 27

function spend(result: Record<string, number>): number {
  return Object.values(result).reduce((s, v) => s + ((POINT_COST[v] ?? 0) - (POINT_COST[10] ?? 0)), 0)
}

// US-262 §Critérios de aceite: `primary` das 13 classes jogáveis do SRD (config.classes[].primary,
// US-203) — mesmas chaves de scripts/srd/srd-5e.config.en-US.json.
const CLASS_PRIMARY: Record<string, string[]> = {
  barbarian: ['strength', 'constitution'],
  bard: ['charisma'],
  cleric: ['wisdom'],
  druid: ['wisdom'],
  fighter: ['strength', 'dexterity'],
  marshal: ['strength', 'charisma'],
  monk: ['dexterity', 'wisdom'],
  paladin: ['strength', 'charisma'],
  ranger: ['dexterity', 'wisdom'],
  rogue: ['dexterity'],
  sorcerer: ['charisma'],
  warlock: ['charisma'],
  wizard: ['intelligence'],
}

describe('recommendedAttributes', () => {
  // Teste de regressão da US-262: falha se alguma das 13 classes ficar com pontos sobrando
  // (busca que não fecha o orçamento) ou com um `primary` fora dos valores mais altos.
  for (const [classKey, primary] of Object.entries(CLASS_PRIMARY)) {
    it(`${classKey}: gasta o orçamento inteiro e deixa os primary (${primary.join(', ')}) entre os maiores valores`, () => {
      const result = recommendedAttributes({ primary }, ATTRIBUTES, BUDGET)

      expect(spend(result)).toBe(BUDGET)
      for (const attr of ATTRIBUTES) expect(result[attr.key]).toBeGreaterThanOrEqual(attr.min)
      for (const attr of ATTRIBUTES) expect(result[attr.key]).toBeLessThanOrEqual(attr.max)

      const values = Object.values(result)
      const highest = Math.max(...values)
      for (const key of primary) expect(result[key]).toBe(highest)
    })
  }

  it('classe sem primary no catálogo: soma o orçamento inteiro entre os atributos sem preferência', () => {
    const result = recommendedAttributes({ primary: undefined }, ATTRIBUTES, BUDGET)
    expect(spend(result)).toBe(BUDGET)
  })

  it('budget 0: devolve todo mundo no default, sem gastar nada', () => {
    const result = recommendedAttributes({ primary: ['strength'] }, ATTRIBUTES, 0)
    expect(spend(result)).toBe(0)
    for (const attr of ATTRIBUTES) expect(result[attr.key]).toBe(attr.default)
  })
})
