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

  // US-156: settings/tones/areaTypes são opcionais (config legado sem eles continua válido)
  // e, quando presentes, seguem o mesmo contrato de races/classes (SystemCatalogEntry[]).
  it('aceita settings/tones/areaTypes como catálogos opcionais', () => {
    const config = {
      attributes: [{ key: 'cool', label: 'Cool', min: 1, max: 10, default: 5 }],
      startingKits: { default: [{ name: 'Adaga', qty: 1 }] },
      tones: [{ key: 'heroic', label: 'Heroic' }],
      settings: [{ key: 'high-fantasy', label: 'High Fantasy' }],
      areaTypes: [{ key: 'ruins', label: 'Ruins' }],
    }
    expect(SystemConfigSchema.parse(config)).toEqual(config)
  })

  it('config sem settings/tones/areaTypes (legado) continua válido', () => {
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
