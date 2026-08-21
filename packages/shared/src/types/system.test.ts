import { describe, it, expect } from 'vitest'
import { SystemConfigSchema, buildCharacterAttributesSchema } from './system'

describe('SystemConfigSchema', () => {
  it('aceita um config mínimo válido', () => {
    const config = {
      attributes: [{ key: 'cool', label: 'Cool', min: 1, max: 10, default: 5 }],
      startingKits: { default: [{ name: 'Adaga', qty: 1 }] },
    }
    expect(SystemConfigSchema.parse(config)).toEqual(config)
  })

  it('rejeita startingKits sem chave default', () => {
    const config = {
      attributes: [{ key: 'cool', label: 'Cool', min: 1, max: 10, default: 5 }],
      startingKits: { fighter: [{ name: 'Espada', qty: 1 }] },
    }
    expect(() => SystemConfigSchema.parse(config)).toThrow()
  })

  // US-128: paralelo a startingKits, mas SEM exigir chave `default` — origem é opcional.
  it('aceita backgroundEquipment sem chave default', () => {
    const config = {
      attributes: [{ key: 'cool', label: 'Cool', min: 1, max: 10, default: 5 }],
      startingKits: { default: [{ name: 'Adaga', qty: 1 }] },
      backgroundEquipment: { a5e_ag_acolyte: [{ name: 'Holy symbol', qty: 1 }] },
    }
    expect(SystemConfigSchema.parse(config)).toEqual(config)
  })

  // US-156: tones é opcional (config legado sem ele continua válido) e, quando presente,
  // segue o mesmo contrato de races/classes (SystemCatalogEntry[]). settings/areaTypes
  // voltaram na US-184, mesmo contrato.
  it('aceita tones como catálogo opcional', () => {
    const config = {
      attributes: [{ key: 'cool', label: 'Cool', min: 1, max: 10, default: 5 }],
      startingKits: { default: [{ name: 'Adaga', qty: 1 }] },
      tones: [{ key: 'heroic', label: 'Heroic' }],
    }
    expect(SystemConfigSchema.parse(config)).toEqual(config)
  })

  // US-184: settings/areaTypes voltam ao registro (revert do corte da US-173) — mesmo
  // contrato opcional de tones, config legado sem eles continua válido.
  it('aceita settings e areaTypes como catálogos opcionais', () => {
    const config = {
      attributes: [{ key: 'cool', label: 'Cool', min: 1, max: 10, default: 5 }],
      startingKits: { default: [{ name: 'Adaga', qty: 1 }] },
      settings: [{ key: 'fantasy', label: 'Fantasy' }],
      areaTypes: [{ key: 'dungeon', label: 'Dungeon' }],
    }
    expect(SystemConfigSchema.parse(config)).toEqual(config)
  })

  it('config sem tones (legado) continua válido', () => {
    const config = {
      attributes: [{ key: 'cool', label: 'Cool', min: 1, max: 10, default: 5 }],
      startingKits: { default: [{ name: 'Adaga', qty: 1 }] },
    }
    expect(() => SystemConfigSchema.parse(config)).not.toThrow()
  })
})

describe('buildCharacterAttributesSchema', () => {
  const attrs = [
    { key: 'cool', label: 'Cool', min: 1, max: 10, default: 5 },
    { key: 'hard', label: 'Hard', min: 1, max: 10, default: 5 },
  ]

  it('valida um conjunto de atributos customizado (não-D&D)', () => {
    expect(buildCharacterAttributesSchema(attrs).parse({ cool: 8, hard: 3 }))
      .toEqual({ cool: 8, hard: 3 })
  })

  it('rejeita atributos fora do config (ex.: strength)', () => {
    expect(() => buildCharacterAttributesSchema(attrs).parse({ cool: 8, hard: 3, strength: 10 }))
      .toThrow()
  })

  it('rejeita valor fora do min/max do config', () => {
    expect(() => buildCharacterAttributesSchema(attrs).parse({ cool: 99, hard: 3 })).toThrow()
  })
})
