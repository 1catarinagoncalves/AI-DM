import { describe, it, expect } from 'vitest'
import type { SystemConfig } from './types/system'
import { getStartingInventory, getClassFeatures, getClassSpells, getBackgroundEquipment, getBackgroundFeatures, getRaceFeatures, resolveCharacterFeatures, MEMENTO_ITEM_LABEL } from './starting-kit'

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

// US-128: paralelo a getStartingInventory, mas por ORIGEM e sem fallback `default` —
// origem sem catálogo (ou personagem sem origem escolhida) devolve lista vazia, nunca lança.
describe('getBackgroundEquipment (US-128)', () => {
  const config: SystemConfig = {
    attributes: [{ key: 'strength', label: 'Força', min: 3, max: 20, default: 10 }],
    startingKits: { default: [{ name: 'Adaga', qty: 1 }] },
    backgroundEquipment: {
      a5e_ag_acolyte: [{ name: 'Holy symbol', qty: 1 }, { name: 'Common clothes', qty: 1 }],
    },
  }

  it('devolve o equipamento da origem pela chave', () => {
    expect(getBackgroundEquipment(config, 'a5e_ag_acolyte')).toEqual([
      { name: 'Holy symbol', qty: 1 },
      { name: 'Common clothes', qty: 1 },
    ])
  })

  it('origem sem entrada no catálogo devolve lista vazia (nunca lança)', () => {
    expect(getBackgroundEquipment(config, 'a5e_ag_desconhecida')).toEqual([])
  })

  it('config sem backgroundEquipment devolve lista vazia', () => {
    const noEquipment: SystemConfig = { attributes: config.attributes, startingKits: config.startingKits }
    expect(getBackgroundEquipment(noEquipment, 'a5e_ag_acolyte')).toEqual([])
  })
})

describe('MEMENTO_ITEM_LABEL (US-128)', () => {
  it('tem rótulo pro pt-BR e en-US, mesma palavra dos dois lados (game.background.memento)', () => {
    expect(MEMENTO_ITEM_LABEL['pt-BR']).toBe('Memento')
    expect(MEMENTO_ITEM_LABEL['en-US']).toBe('Memento')
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

// US-135: espelha getClassFeatures, mas por ORIGEM e sem fallback default (mesmo contrato de
// getBackgroundEquipment) — origem opcional, chave ausente devolve [], nunca lança.
describe('getBackgroundFeatures (US-135)', () => {
  const config: SystemConfig = {
    attributes: [{ key: 'strength', label: 'Força', min: 3, max: 20, default: 10 }],
    startingKits: { default: [{ name: 'Adaga', qty: 1 }] },
    backgroundFeatures: {
      a5e_ag_criminal: [{ key: 'a5e_ag_criminal_thieves-cant', source: 'a5e-ag', name: "Thieves' Cant", description: 'x' }],
    },
  }

  it('devolve a chave da feature da origem', () => {
    expect(getBackgroundFeatures(config, 'a5e_ag_criminal')).toEqual(['a5e_ag_criminal_thieves-cant'])
  })

  it('sem originKey → lista vazia', () => {
    expect(getBackgroundFeatures(config, undefined)).toEqual([])
  })

  it('origem sem entrada no catálogo (ex. Acólito) devolve lista vazia, nunca lança', () => {
    expect(getBackgroundFeatures(config, 'a5e_ag_acolyte')).toEqual([])
  })

  it('config sem backgroundFeatures devolve lista vazia', () => {
    const noFeatures: SystemConfig = { attributes: config.attributes, startingKits: config.startingKits }
    expect(getBackgroundFeatures(noFeatures, 'a5e_ag_criminal')).toEqual([])
  })
})

// US-142: espelha getClassFeatures, mas sem fallback `default` (não existe "raça default",
// mesmo contrato de getBackgroundFeatures) — chave sem entrada devolve [], nunca lança.
describe('getRaceFeatures (US-142)', () => {
  const config: SystemConfig = {
    attributes: [{ key: 'strength', label: 'Força', min: 3, max: 20, default: 10 }],
    startingKits: { default: [{ name: 'Adaga', qty: 1 }] },
    raceFeatures: {
      'high-elf': [
        { key: 'ability-score-increase', source: 'elf', name: 'Ability Score Increase', description: '+2 Dex.' },
        { key: 'darkvision', source: 'elf', name: 'Darkvision', description: '60 ft.' },
        { key: 'ability-score-increase', source: 'high-elf', name: 'Ability Score Increase', description: '+1 Int.' },
        { key: 'cantrip', source: 'high-elf', name: 'Cantrip', description: 'x' },
      ],
      human: [{ key: 'ability-score-increase', source: 'human', name: 'Ability Score Increase', description: '+1 all.' }],
    },
  }

  it('devolve as chaves combinadas da subespécie (raiz + próprios), sem dedupe', () => {
    expect(getRaceFeatures(config, 'high-elf')).toEqual(['ability-score-increase', 'darkvision', 'ability-score-increase', 'cantrip'])
  })

  it('raiz sem subespécie: só as chaves próprias', () => {
    expect(getRaceFeatures(config, 'human')).toEqual(['ability-score-increase'])
  })

  it('chave sem entrada no catálogo (raiz que tem subespécie, ex. "elf") devolve lista vazia', () => {
    expect(getRaceFeatures(config, 'elf')).toEqual([])
  })

  it('config sem raceFeatures devolve lista vazia', () => {
    const noFeatures: SystemConfig = { attributes: config.attributes, startingKits: config.startingKits }
    expect(getRaceFeatures(noFeatures, 'human')).toEqual([])
  })
})

// US-135: resolve Character.features (chaves de classe + origem misturadas) contra a UNIÃO
// dos dois catálogos — o ponto delicado do §Notas de implementação (resolveSheetEntries sozinho
// só enxerga um mapa por vez).
describe('resolveCharacterFeatures (US-135)', () => {
  const config: SystemConfig = {
    attributes: [{ key: 'strength', label: 'Força', min: 3, max: 20, default: 10 }],
    startingKits: { default: [{ name: 'Adaga', qty: 1 }] },
    classFeatures: {
      paladin: [{ key: 'paladin_lay-on-hands', source: 'srd', name: 'Impor as Mãos', description: 'Cura ao toque.' }],
      default: [],
    },
    backgroundFeatures: {
      a5e_ag_criminal: [{ key: 'a5e_ag_criminal_thieves-cant', source: 'a5e-ag', name: "Thieves' Cant", description: 'Código secreto.' }],
    },
    raceFeatures: {
      'high-elf': [{ key: 'darkvision', source: 'elf', name: 'Visão no Escuro', description: '18m.' }],
    },
    retiredFeatures: {
      paladin_retired: { key: 'paladin_retired', source: 'srd', name: 'Aposentada', description: 'x' },
    },
  }

  it('resolve chave de classe e chave de origem na MESMA lista', () => {
    const keys = ['paladin_lay-on-hands', 'a5e_ag_criminal_thieves-cant']
    const out = resolveCharacterFeatures(config, 'paladin', 'a5e_ag_criminal', keys)
    expect(out.map(f => f.name)).toEqual(['Impor as Mãos', "Thieves' Cant"])
  })

  it('sem originKey → só resolve as chaves de classe', () => {
    const out = resolveCharacterFeatures(config, 'paladin', undefined, ['paladin_lay-on-hands'])
    expect(out.map(f => f.name)).toEqual(['Impor as Mãos'])
  })

  it('chave fora dos dois catálogos cai no retiredFeatures', () => {
    const out = resolveCharacterFeatures(config, 'paladin', undefined, ['paladin_retired'])
    expect(out.map(f => f.name)).toEqual(['Aposentada'])
  })

  // US-136: origin calculado por pertencimento ao Set de classList/originList, não por
  // parsing de prefixo de chave — as duas chaves abaixo não seguem nenhum padrão comum.
  it('marca origin: class para chave de classFeatures e origin: background para chave de backgroundFeatures', () => {
    const keys = ['paladin_lay-on-hands', 'a5e_ag_criminal_thieves-cant']
    const out = resolveCharacterFeatures(config, 'paladin', 'a5e_ag_criminal', keys)
    expect(out.map(f => f.origin)).toEqual(['class', 'background'])
  })

  it('feature aposentada (fora de classList/originList) recebe origin coerente por eliminação', () => {
    const out = resolveCharacterFeatures(config, 'paladin', undefined, ['paladin_retired'])
    expect(out.map(f => f.origin)).toEqual(['background'])
  })

  // US-142: sem raceKey, traço de raça caía no fallback 'background' por eliminação (bug —
  // aparecia na aba Features com a tag errada). Com raceKey, marca origin: 'race' corretamente.
  it('marca origin: race para chave de raceFeatures quando raceKey é passado', () => {
    const out = resolveCharacterFeatures(config, 'paladin', undefined, ['darkvision'], 'high-elf')
    expect(out.map(f => f.origin)).toEqual(['race'])
  })

  it('sem raceKey, chave de raceFeatures cai no fallback background (compatibilidade)', () => {
    const out = resolveCharacterFeatures(config, 'paladin', undefined, ['darkvision'])
    expect(out.map(f => f.origin)).toEqual(['background'])
  })

  it('chave em nenhum dos dois catálogos nem no retired vira entrada mínima (nome = chave)', () => {
    const out = resolveCharacterFeatures(config, 'paladin', 'a5e_ag_criminal', ['fantasma'])
    expect(out.map(f => f.name)).toEqual(['fantasma'])
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
