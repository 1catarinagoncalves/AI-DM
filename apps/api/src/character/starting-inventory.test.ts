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

// US-105: o argumento é a CHAVE canônica gravada no Character, não mais o texto do jogador.
// O matcher de substring (CLASS_SYNONYMS) saiu daqui e vive só na migração — o teste dele
// está em prisma/migrate-race-class-keys.test.ts.
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

  it('materializa os truques da classe conjuradora (cleric → Chama Sagrada)', () => {
    expect(getClassSpells(config, 'cleric').map(s => s.name)).toContain('Chama Sagrada')
  })

  it('sorcerer e warlock têm listas distintas (não colapsam)', () => {
    expect(getClassSpells(config, 'sorcerer').map(s => s.name)).toEqual(['Raio de Fogo'])
    expect(getClassSpells(config, 'warlock').map(s => s.name)).toEqual(['Rajada Mística'])
  })

  it('ranger tem chave própria (2 magias de nível 1)', () => {
    expect(getClassSpells(config, 'ranger').map(s => s.name)).toContain('Marca do Caçador')
  })

  it('não-conjurador (fighter) → lista vazia', () => {
    expect(getClassSpells(config, 'fighter')).toEqual([])
  })

  it('sem classSpells no config → lista vazia (sem crash)', () => {
    const noSpells: SystemConfig = { attributes: config.attributes, startingKits: config.startingKits }
    expect(getClassSpells(noSpells, 'cleric')).toEqual([])
  })
})

// US-105: `classKey` do hook e `Character.class` são a MESMA chave canônica EN — comparação
// direta. Antes, `Character.class` era texto PT e precisava do CLASS_SYNONYMS no meio.
describe('resolveInitialHook (US-28/US-54/US-105)', () => {
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

  it('a chave da classe resolve o gancho de mesmo classKey', () => {
    expect(resolveInitialHook(config, 'paladin')?.id).toBe('paladino-primeira-quebra')
    expect(resolveInitialHook(config, 'warlock')?.id).toBe('bruxo-preco-do-pacto')
  })

  it('classe sem gancho próprio cai no default', () => {
    expect(resolveInitialHook(config, 'cartografa-estelar')?.id).toBe('default-primeiro-sinal')
    expect(resolveInitialHook(config, 'wizard')?.id).toBe('default-primeiro-sinal')
  })

  it('sistema sem catálogo → null (sem crash)', () => {
    const noHooks: SystemConfig = { attributes: config.attributes, startingKits: config.startingKits }
    expect(resolveInitialHook(noHooks, 'paladin')).toBeNull()
  })
})
