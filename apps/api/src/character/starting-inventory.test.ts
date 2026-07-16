import { describe, it, expect } from 'vitest'
import type { SystemConfig } from '@ai-dm/shared'
import { getStartingInventory, getClassSpells, resolveInitialHook } from './starting-inventory'

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

describe('getStartingInventory', () => {
  it('mapeia classes da tabela (case/acento-insensível)', () => {
    expect(getStartingInventory(dnd5eConfig, 'Guerreiro').some(i => i.name === 'Espada longa')).toBe(true)
    expect(getStartingInventory(dnd5eConfig, 'maga').some(i => i.name === 'Grimório')).toBe(true)
    expect(getStartingInventory(dnd5eConfig, 'Paladino').some(i => i.name === 'Símbolo sagrado')).toBe(true)
  })

  it("'paladin' não é confundido com 'ladin'", () => {
    expect(getStartingInventory(dnd5eConfig, 'Paladina').some(i => i.name === 'Escudo')).toBe(true)
  })

  it('mapeia arquétipos próximos (Patrulheira/Caçador/Ranger → ranger)', () => {
    for (const c of ['Patrulheira', 'Caçador', 'Ranger', 'Arqueiro']) {
      expect(getStartingInventory(dnd5eConfig, c).some(i => i.name === 'Arco longo')).toBe(true)
    }
  })

  it('nunca devolve inventário vazio (fallback para classe desconhecida)', () => {
    expect(getStartingInventory(dnd5eConfig, 'Inventor Steampunk').length).toBeGreaterThan(0)
    expect(getStartingInventory(dnd5eConfig, '').length).toBeGreaterThan(0)
  })

  it('sistema sem a classe no config cai no default (ex.: system-free)', () => {
    const freeConfig: SystemConfig = {
      attributes: [{ key: 'sorte', label: 'Sorte', min: 1, max: 20, default: 10 }],
      startingKits: { default: [{ name: 'Mochila', qty: 1 }] },
    }
    expect(getStartingInventory(freeConfig, 'Guerreiro')).toEqual([{ name: 'Mochila', qty: 1 }])
  })
})

describe('getClassSpells (US-42)', () => {
  const config: SystemConfig = {
    attributes: [{ key: 'strength', label: 'Força', min: 3, max: 20, default: 10 }],
    startingKits: { default: [{ name: 'Adaga', qty: 1 }] },
    classSpells: {
      cleric: [{ name: 'Chama Sagrada', level: 0, description: 'luz sagrada.' }],
      sorcerer: [{ name: 'Raio de Fogo', level: 0, description: 'dardo de fogo.' }],
      warlock: [{ name: 'Rajada Mística', level: 0, description: 'feixe crepitante.' }],
      paladin: [{ name: 'Curar Ferimentos', level: 1, description: 'cura pelo toque.' }],
      ranger: [{ name: 'Marca do Caçador', level: 1, description: 'marca a presa.' }],
      default: [],
    },
  }

  it('materializa os truques da classe conjuradora (clérigo → Chama Sagrada)', () => {
    expect(getClassSpells(config, 'Clériga').map(s => s.name)).toContain('Chama Sagrada')
  })

  it('Feiticeiro e Bruxo têm listas distintas (não colapsam)', () => {
    expect(getClassSpells(config, 'Feiticeiro').map(s => s.name)).toEqual(['Raio de Fogo'])
    expect(getClassSpells(config, 'Bruxo').map(s => s.name)).toEqual(['Rajada Mística'])
  })

  it('Patrulheiro/Ranger cai na chave própria (2 magias de nível 1)', () => {
    for (const c of ['Patrulheiro', 'Ranger']) {
      expect(getClassSpells(config, c).map(s => s.name)).toContain('Marca do Caçador')
    }
  })

  it('não-conjurador (guerreiro) → lista vazia', () => {
    expect(getClassSpells(config, 'Guerreiro')).toEqual([])
  })

  it('sem classSpells no config → lista vazia (sem crash)', () => {
    const noSpells: SystemConfig = { attributes: config.attributes, startingKits: config.startingKits }
    expect(getClassSpells(noSpells, 'Clériga')).toEqual([])
  })
})

// US-54: `classKey` é a chave canônica EN, mas Character.class continua sendo texto livre em PT.
// Sem o match por CLASS_SYNONYMS, todo personagem PT cairia no gancho `default` em silêncio.
describe('resolveInitialHook (US-28/US-54)', () => {
  const hook = (id: string, classKey: string) => ({
    id, classKey, title: id, pitch: '', primaryQuestTitle: '', primaryQuestDescription: '',
    openingNarration: '', tags: [],
  })
  const config: SystemConfig = {
    attributes: [{ key: 'strength', label: 'Força', min: 3, max: 20, default: 10 }],
    startingKits: { default: [{ name: 'Adaga', qty: 1 }] },
    initialAdventures: {
      hooks: [hook('paladino-primeira-quebra', 'paladin'), hook('bruxo-preco-do-pacto', 'warlock'), hook('default-primeiro-sinal', 'default')],
    },
  }

  it('classe digitada em PT resolve o gancho de classKey EN', () => {
    expect(resolveInitialHook(config, 'Paladina')?.id).toBe('paladino-primeira-quebra')
    expect(resolveInitialHook(config, 'Bruxo')?.id).toBe('bruxo-preco-do-pacto')
  })

  it('classe sem gancho próprio cai no default', () => {
    expect(resolveInitialHook(config, 'Cartógrafa Estelar')?.id).toBe('default-primeiro-sinal')
    expect(resolveInitialHook(config, 'Mago')?.id).toBe('default-primeiro-sinal')
  })

  it('sistema sem catálogo → null (sem crash)', () => {
    const noHooks: SystemConfig = { attributes: config.attributes, startingKits: config.startingKits }
    expect(resolveInitialHook(noHooks, 'Paladina')).toBeNull()
  })
})
