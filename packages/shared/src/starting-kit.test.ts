import { describe, it, expect } from 'vitest'
import type { SystemConfig } from './types/system'
import { getStartingInventory, getClassFeatures, getClassSpells } from './starting-kit'

const dnd5eConfig: SystemConfig = {
  attributes: [{ key: 'strength', label: 'Força', min: 3, max: 20, default: 10 }],
  startingKits: {
    fighter: [{ name: 'Espada longa', qty: 1 }, { name: 'Escudo', qty: 1 }],
    wizard: [{ name: 'Grimório', qty: 1 }],
    paladin: [{ name: 'Espada longa', qty: 1 }, { name: 'Escudo', qty: 1 }, { name: 'Símbolo sagrado', qty: 1 }],
    ranger: [{ name: 'Arco longo', qty: 1 }],
    default: [{ name: 'Adaga', qty: 1 }],
  },
}

// US-105: o argumento é a CHAVE canônica gravada no Character, não mais o texto do jogador.
// O matcher de substring (CLASS_SYNONYMS) saiu daqui e vive só na migração — o teste dele
// está em apps/api/prisma/migrate-race-class-keys.test.ts.
//
// US-127: função realocada de apps/api/src/character/starting-inventory.ts — packages/shared
// é a casa comum entre a criação (apps/api) e o preview da etapa `review` (apps/web).
describe('getStartingInventory', () => {
  it('devolve o kit da chave da classe', () => {
    expect(getStartingInventory(dnd5eConfig, 'fighter').some(i => i.name === 'Espada longa')).toBe(true)
    expect(getStartingInventory(dnd5eConfig, 'wizard').some(i => i.name === 'Grimório')).toBe(true)
    expect(getStartingInventory(dnd5eConfig, 'paladin').some(i => i.name === 'Símbolo sagrado')).toBe(true)
  })

  // O texto PT era o que chegava aqui até a US-105; se voltar a chegar, cai no default em
  // silêncio — exatamente o defeito que a story fechou. Este teste marca a fronteira.
  it('texto de jogador (não-chave) cai no default, não no kit da classe', () => {
    expect(getStartingInventory(dnd5eConfig, 'Guerreiro')).toEqual([{ name: 'Adaga', qty: 1 }])
  })

  it('nunca devolve inventário vazio (fallback para classe desconhecida)', () => {
    expect(getStartingInventory(dnd5eConfig, 'inventor-steampunk').length).toBeGreaterThan(0)
    expect(getStartingInventory(dnd5eConfig, '').length).toBeGreaterThan(0)
  })

  it('sistema sem a classe no config cai no default (ex.: system-free)', () => {
    const freeConfig: SystemConfig = {
      attributes: [{ key: 'sorte', label: 'Sorte', min: 1, max: 20, default: 10 }],
      startingKits: { default: [{ name: 'Mochila', qty: 1 }] },
    }
    expect(getStartingInventory(freeConfig, 'fighter')).toEqual([{ name: 'Mochila', qty: 1 }])
  })
})

describe('getClassFeatures (US-41)', () => {
  const config: SystemConfig = {
    attributes: [{ key: 'strength', label: 'Força', min: 3, max: 20, default: 10 }],
    startingKits: { default: [{ name: 'Adaga', qty: 1 }] },
    classFeatures: {
      barbarian: [{ key: 'barbarian_rage', source: 'srd', name: 'Fúria', description: 'x' }],
      paladin: [{ key: 'paladin_lay-on-hands', source: 'srd', name: 'Imposição de Mãos', description: 'x' }],
      default: [],
    },
  }

  // US-100: devolve CHAVES, não os objetos do config — é o que a ficha grava.
  it('devolve as chaves das features de nível 1 da classe (barbarian → barbarian_rage)', () => {
    expect(getClassFeatures(config, 'barbarian')).toEqual(['barbarian_rage'])
  })

  it('classes distintas têm listas distintas (não colapsam)', () => {
    expect(getClassFeatures(config, 'paladin')).toEqual(['paladin_lay-on-hands'])
  })

  it('classe sem entrada própria cai no default', () => {
    expect(getClassFeatures(config, 'wizard')).toEqual([])
  })

  it('sem classFeatures no config → lista vazia (sem crash)', () => {
    const noFeatures: SystemConfig = { attributes: config.attributes, startingKits: config.startingKits }
    expect(getClassFeatures(noFeatures, 'barbarian')).toEqual([])
  })
})

describe('getClassSpells (US-42)', () => {
  const config: SystemConfig = {
    attributes: [{ key: 'strength', label: 'Força', min: 3, max: 20, default: 10 }],
    startingKits: { default: [{ name: 'Adaga', qty: 1 }] },
    classSpells: {
      cleric: [{ key: 'sacred-flame', source: 'srd', name: 'Chama Sagrada', level: 0, description: 'luz sagrada.' }],
      sorcerer: [{ key: 'fire-bolt', source: 'srd', name: 'Raio de Fogo', level: 0, description: 'dardo de fogo.' }],
      warlock: [{ key: 'eldritch-blast', source: 'srd', name: 'Rajada Mística', level: 0, description: 'feixe crepitante.' }],
      paladin: [{ key: 'cure-wounds', source: 'srd', name: 'Curar Ferimentos', level: 1, description: 'cura pelo toque.' }],
      ranger: [{ key: 'hunters-mark', source: 'srd', name: 'Marca do Caçador', level: 1, description: 'marca a presa.' }],
      default: [],
    },
  }

  // US-100: devolve CHAVES, não os objetos do config — é o que a ficha grava.
  it('devolve as chaves dos truques da classe conjuradora (cleric → sacred-flame)', () => {
    expect(getClassSpells(config, 'cleric')).toEqual(['sacred-flame'])
  })

  it('sorcerer e warlock têm listas distintas (não colapsam)', () => {
    expect(getClassSpells(config, 'sorcerer')).toEqual(['fire-bolt'])
    expect(getClassSpells(config, 'warlock')).toEqual(['eldritch-blast'])
  })

  it('ranger tem chave própria (2 magias de nível 1)', () => {
    expect(getClassSpells(config, 'ranger')).toContain('hunters-mark')
  })

  it('não-conjurador (fighter) → lista vazia', () => {
    expect(getClassSpells(config, 'fighter')).toEqual([])
  })

  it('sem classSpells no config → lista vazia (sem crash)', () => {
    const noSpells: SystemConfig = { attributes: config.attributes, startingKits: config.startingKits }
    expect(getClassSpells(noSpells, 'cleric')).toEqual([])
  })
})
