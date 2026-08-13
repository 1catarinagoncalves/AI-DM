// US-106 — a montagem do catálogo do Free: referência resolve contra o artefato, entrada própria
// sobrevive sem ele, e o pt-BR de hoje não regride. O seed em si (I/O) fica de fora: o erro mora
// na resolução, não no upsert.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { SystemConfigSchema, type SystemConfig } from '@ai-dm/shared'
import { buildFreeClassFeatures, buildFreeClassSpells } from './free-catalog'

const artifact = (locale: string) =>
  JSON.parse(readFileSync(join(__dirname, `../../../scripts/srd/srd-5e.config.${locale}.json`), 'utf8')) as SystemConfig

const ptBR = artifact('pt-BR')
const enUS = artifact('en-US')

const names = (entries: { name: string }[] | undefined) => (entries ?? []).map(e => e.name)
const byKey = <T extends { key: string }>(entries: T[] | undefined, key: string) =>
  (entries ?? []).find(entry => entry.key === key)

describe('catálogo do Free montado do artefato', () => {
  it('item herdado troca de idioma com o locale', () => {
    expect(byKey(buildFreeClassFeatures(ptBR, 'pt-BR').barbarian, 'barbarian_rage')?.name).toBe('Fúria')
    expect(byKey(buildFreeClassFeatures(enUS, 'en-US').barbarian, 'barbarian_rage')?.name).toBe('Rage')
  })

  // O coração da story: sem entrada própria, este truque sumiria (não está em SRD nenhum) ou
  // ficaria congelado em PT ao lado dos herdados.
  it('truque autoral existe nos dois locales, com source "authored"', () => {
    const pt = byKey(buildFreeClassSpells(ptBR, 'pt-BR').wizard, 'thunderclap')
    const en = byKey(buildFreeClassSpells(enUS, 'en-US').wizard, 'thunderclap')
    expect(pt?.name).toBe('Estrondo')
    expect(en?.name).toBe('Thunderclap')
    expect(pt?.source).toBe('authored')
    expect(en?.level).toBe(0)
  })

  it('feature autoral (fora da união do ADR 009) sobrevive nos dois locales', () => {
    expect(byKey(buildFreeClassFeatures(ptBR, 'pt-BR').paladin, 'paladin_divine-sense')?.name).toBe('Sentido Divino')
    expect(byKey(buildFreeClassFeatures(enUS, 'en-US').ranger, 'ranger_natural-explorer')?.name).toBe('Natural Explorer')
  })

  it('toda entrada tem key e source; a curadoria continua sendo um subconjunto do artefato', () => {
    const features = Object.values(buildFreeClassFeatures(ptBR, 'pt-BR')).flat()
    const spells = Object.values(buildFreeClassSpells(ptBR, 'pt-BR')).flat()
    for (const entry of [...features, ...spells]) {
      expect(entry.key, `entrada sem key: ${entry.name}`).toBeTruthy()
      expect(['srd', 'authored']).toContain(entry.source)
    }
    expect(features.filter(f => f.source === 'srd')).toHaveLength(14)
    expect(features.filter(f => f.source === 'authored')).toHaveLength(2)
    // A mesma magia entra na lista de várias classes: 27 truques + 4 magias de 1º dão 70 pares
    // classe×magia, e os 7 autorais dão 21. Total 91, igual ao que o catálogo literal produzia.
    expect(spells.filter(s => s.source === 'srd')).toHaveLength(70)
    expect(spells.filter(s => s.source === 'authored')).toHaveLength(21)
  })

  // O config inteiro tem de passar no schema, não só as duas listas: é o mesmo `parse` que a
  // API roda na leitura (character.service, adventure.service) e que barraria o seed.
  it.each(['en-US', 'pt-BR'] as const)('o config do Free monta e valida em %s', locale => {
    const srd = artifact(locale)
    const config = {
      ...srd,
      classFeatures: buildFreeClassFeatures(srd, locale),
      classSpells: buildFreeClassSpells(srd, locale),
      startingKits: { default: [{ name: 'Adaga', qty: 1 }] },
      pointBuy: { budget: 27 },
    }
    expect(() => SystemConfigSchema.parse(config)).not.toThrow()
  })

  // Guard da decisão 6d: um bump que retire conteúdo usado pelo Free tem de ser erro alto.
  it('referência com chave que o artefato não tem falha, nomeando domínio e chave', () => {
    const semRage = { ...ptBR, classFeatures: { ...ptBR.classFeatures, barbarian: [] } }
    expect(() => buildFreeClassFeatures(semRage, 'pt-BR')).toThrow(/classFeatures\.barbarian.*barbarian_rage/s)
  })

  // A outra metade da guard, e a razão de ela ser restrita a referência: `word-of-radiance` NÃO
  // existe no artefato (nem no 5.1, nem no 5.2) e mesmo assim tem de passar. Sem essa distinção,
  // ou os 7 truques quebram o seed, ou a guard vira decorativa.
  it('entrada própria com chave que o artefato não conhece não falha', () => {
    expect(byKey(ptBR.classSpells?.cleric, 'word-of-radiance')).toBeUndefined()
    expect(byKey(buildFreeClassSpells(ptBR, 'pt-BR').cleric, 'word-of-radiance')?.name).toBe('Palavra Radiante')
  })
})

// Regressão da promessa "sem mudança em pt-BR": o que o jogador brasileiro já via continua igual.
describe('sem regressão em pt-BR', () => {
  // A ordem é a do ARTEFATO (por chave EN), não a do catálogo literal (que era por nome PT). O
  // conteúdo é que não pode mudar: a ficha já reordena por nível e nome na exibição (GameView).
  it('as features herdadas mostram o mesmo texto curado de hoje', () => {
    expect(names(buildFreeClassFeatures(ptBR, 'pt-BR').rogue).sort())
      .toEqual(['Ataque Furtivo', 'Especialização', 'Gíria de Ladrão'])
  })

  it('a lista do clérigo tem os mesmos 9 truques de hoje, os 2 autorais incluídos', () => {
    expect(names(buildFreeClassSpells(ptBR, 'pt-BR').cleric).sort()).toEqual([
      'Chama Sagrada', 'Consertar', 'Dobre dos Mortos', 'Estabilizar', 'Luz',
      'Orientação', 'Palavra Radiante', 'Resistência', 'Taumaturgia',
    ])
  })

  it('paladino e patrulheiro seguem com as 2 magias de nível 1', () => {
    expect(names(buildFreeClassSpells(ptBR, 'pt-BR').paladin).sort()).toEqual(['Abençoar', 'Curar Ferimentos'])
    expect(names(buildFreeClassSpells(ptBR, 'pt-BR').ranger).sort()).toEqual(['Curar Ferimentos', 'Marca do Caçador'])
  })
})

// O outro campo que a story move para a herança: os rótulos que o Free servia à mão. Se um único
// deles mudar, o jogador em pt-BR vê a mudança na ficha — e a story prometeu que não veria.
describe('attributes e skills herdados são os literais que o Free tinha', () => {
  const FREE_ATTRIBUTES = [
    ['strength', 'Força'], ['dexterity', 'Destreza'], ['constitution', 'Constituição'],
    ['intelligence', 'Inteligência'], ['wisdom', 'Sabedoria'], ['charisma', 'Carisma'],
  ]
  const FREE_SKILLS = [
    ['athletics', 'Atletismo', 'strength'], ['acrobatics', 'Acrobacia', 'dexterity'],
    ['sleight_of_hand', 'Prestidigitação', 'dexterity'], ['stealth', 'Furtividade', 'dexterity'],
    ['arcana', 'Arcanismo', 'intelligence'], ['history', 'História', 'intelligence'],
    ['investigation', 'Investigação', 'intelligence'], ['nature', 'Natureza', 'intelligence'],
    ['religion', 'Religião', 'intelligence'], ['animal_handling', 'Adestrar Animais', 'wisdom'],
    ['insight', 'Intuição', 'wisdom'], ['medicine', 'Medicina', 'wisdom'],
    ['perception', 'Percepção', 'wisdom'], ['survival', 'Sobrevivência', 'wisdom'],
    ['deception', 'Enganação', 'charisma'], ['intimidation', 'Intimidação', 'charisma'],
    ['performance', 'Atuação', 'charisma'], ['persuasion', 'Persuasão', 'charisma'],
    // US-130: culture/engineering (A5E) entram no artefato compartilhado — o Free herda por
    // inteiro (mesma política do comentário acima), não é caso novo a filtrar.
    ['culture', 'Cultura', 'intelligence'], ['engineering', 'Engenharia', 'intelligence'],
  ]

  it('os 6 atributos têm a mesma chave, o mesmo rótulo e a mesma faixa', () => {
    expect(ptBR.attributes).toHaveLength(6)
    for (const [key, label] of FREE_ATTRIBUTES) {
      const found = ptBR.attributes.find(a => a.key === key)
      expect(found, `atributo sumiu: ${key}`).toBeDefined()
      expect(found?.label).toBe(label)
      expect([found?.min, found?.max, found?.default]).toEqual([10, 18, 10])
    }
  })

  it('as 20 perícias têm a mesma chave, o mesmo rótulo e a mesma âncora', () => {
    expect(ptBR.skills).toHaveLength(20)
    for (const [key, label, ability] of FREE_SKILLS) {
      const found = (ptBR.skills ?? []).find(s => s.key === key)
      expect(found, `perícia sumiu: ${key}`).toBeDefined()
      expect([found?.label, found?.ability]).toEqual([label, ability])
    }
  })
})
