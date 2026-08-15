// US-100 — regressão da migração de dados. O que se testa aqui é o ÍNDICE (texto gravado → chave)
// contra o catálogo REAL dos dois artefatos: é a peça que decide se uma ficha antiga perde item.
// A escrita no banco não entra: é I/O, e o índice é onde o erro mora. Mesmo recorte da US-105.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { SystemConfig } from '@ai-dm/shared'
import { buildNameIndex, toEntryKey } from './migrate-feature-spell-keys'

const artifact = (locale: string) =>
  JSON.parse(readFileSync(join(__dirname, `../../../scripts/srd/srd-5e.config.${locale}.json`), 'utf8')) as SystemConfig

const ptBR = artifact('pt-BR')
const enUS = artifact('en-US')
// O índice de migração é a UNIÃO dos locales do sistema (§1) — a base EN mora em `config` e o
// pt-BR em `configLocales`, e a ficha legada pode ter guardado texto de qualquer um dos dois.
const featureIndex = buildNameIndex([enUS, ptBR], 'features')
const spellIndex = buildNameIndex([enUS, ptBR], 'spells')

/** Entrada do catálogo pt-BR de uma classe, pela chave — o "texto gravado" de uma ficha legada. */
const feature = (classKey: string, key: string) => ptBR.classFeatures?.[classKey]?.find(f => f.key === key)
const spell = (classKey: string, key: string) => ptBR.classSpells?.[classKey]?.find(s => s.key === key)

describe('migração US-100 — texto gravado na ficha vira chave do catálogo', () => {
  it('ficha pt-BR legada: o texto PT de TODA feature do catálogo tem destino, e é a própria chave', () => {
    for (const [classKey, entries] of Object.entries(ptBR.classFeatures ?? {})) {
      for (const entry of entries) {
        const found = toEntryKey({ name: entry.name, description: entry.description }, classKey, featureIndex)
        expect(found, `feature sem destino: ${classKey} "${entry.name}"`).toBe(entry.key)
      }
    }
  })

  it('ficha com FALLBACK EN (janela US-47→US-52): o texto inglês casa na mesma chave', () => {
    // US-139: "Weapon Mastery" (fighter) saiu do catálogo vivo — voltou a ser conteúdo do 5.2,
    // agora só em `retiredFeatures` (ambíguo entre as 5 classes que o tinham, ver teste de
    // retired abaixo). "Divine Sense" é o exemplo vivo equivalente: voltou ao catálogo NESTA
    // mesma story (era órfã desde o bump pro 5.2), mesma janela de risco de fallback EN.
    const en = enUS.classFeatures?.['paladin']?.find(f => f.key === 'paladin_divine-sense')
    expect(en?.name).toBe('Divine Sense')
    expect(toEntryKey({ name: en!.name }, 'paladin', featureIndex)).toBe('paladin_divine-sense')
    expect(feature('paladin', 'paladin_divine-sense')?.name).not.toBe(en?.name) // o PT é outro texto
  })

  it('nome repetido entre classes casa na chave da CLASSE da ficha, não na primeira do catálogo', () => {
    // "Defesa sem Armadura" existe em 2 classes (bárbaro/monge) — casar no catálogo inteiro
    // escolheria a errada em silêncio (§2). Este é o teste que prova o escopo.
    const name = feature('barbarian', 'barbarian_unarmored-defense')!.name
    const donas = Object.entries(ptBR.classFeatures ?? {})
      .filter(([, entries]) => entries.some(f => f.name === name))
      .map(([classKey]) => classKey)
    expect(donas.length).toBeGreaterThan(1)
    for (const classKey of donas) {
      expect(toEntryKey({ name }, classKey, featureIndex)).toBe(`${classKey}_unarmored-defense`)
    }
  })

  it('magia: a chave é o slug, então "Luz" do mago e do clérigo é a MESMA chave', () => {
    const luz = spell('wizard', 'light')!
    expect(toEntryKey({ name: luz.name }, 'wizard', spellIndex)).toBe('light')
    expect(toEntryKey({ name: luz.name }, 'cleric', spellIndex)).toBe('light')
  })

  it('ficha pt-BR legada: o texto PT de TODA magia do catálogo tem destino', () => {
    for (const [classKey, entries] of Object.entries(ptBR.classSpells ?? {})) {
      for (const entry of entries) {
        expect(toEntryKey({ name: entry.name }, classKey, spellIndex), `magia sem destino: "${entry.name}"`).toBe(entry.key)
      }
    }
  })

  it('idempotente: item que JÁ é chave passa direto (rodar duas vezes não desfaz)', () => {
    expect(toEntryKey('barbarian_rage', 'barbarian', featureIndex)).toBe('barbarian_rage')
    expect(toEntryKey('sacred-flame', 'cleric', spellIndex)).toBe('sacred-flame')
  })

  it('classe que não resolve cai no catálogo inteiro — e só aceita nome ÚNICO', () => {
    // Ficha pré-US-105 com `class` em texto cru ("Guerreiro"): o escopo por classe não existe.
    const unico = feature('barbarian', 'barbarian_rage')!.name
    expect(toEntryKey({ name: unico }, 'Guerreiro', featureIndex)).toBe('barbarian_rage')
    // Já o nome repetido em 2 classes fica SEM destino em vez de chutar uma delas.
    const ambiguo = feature('barbarian', 'barbarian_unarmored-defense')!.name
    expect(toEntryKey({ name: ambiguo }, 'Guerreiro', featureIndex)).toBeNull()
  })

  it('item aposentado casa pelo retired (a ficha que ninguém migrou ainda)', () => {
    const config = { retiredSpells: { 'toll-the-dead': { key: 'toll-the-dead', name: 'Dobre dos Mortos', source: 'authored' } } }
    const index = buildNameIndex([config], 'spells')
    expect(toEntryKey({ name: 'Dobre dos Mortos' }, 'wizard', index)).toBe('toll-the-dead')
  })

  it('item sem nome ou fora do catálogo fica sem destino — nunca é chutado', () => {
    expect(toEntryKey({ description: 'sem nome' }, 'wizard', featureIndex)).toBeNull()
    expect(toEntryKey({ name: 'Sopro do Dragão de Vapor' }, 'wizard', featureIndex)).toBeNull()
  })
})
