// US-105 — regressão da migração de dados. O que se testa aqui é o MAPA (texto legado → chave),
// contra o catálogo REAL do artefato: é a peça que decide se uma ficha antiga sobrevive.
// A escrita no banco não entra: é I/O, e o mapa é onde o erro mora.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { catalogLabel, type SystemConfig } from '@ai-dm/shared'
import { toKey, CLASS_SYNONYMS, RACE_ALIASES } from './migrate-race-class-keys'

const artifact = (locale: string) =>
  JSON.parse(readFileSync(join(__dirname, `../../../scripts/srd/srd-5e.config.${locale}.json`), 'utf8')) as SystemConfig

const ptBR = artifact('pt-BR')
const enUS = artifact('en-US')
const races = ptBR.races ?? []
const classes = ptBR.classes ?? []

const toRace = (v: string) => toKey(v, races, [], RACE_ALIASES)
const toClass = (v: string) => toKey(v, classes, CLASS_SYNONYMS)

describe('migração US-105 — texto legado vira chave do catálogo', () => {
  // As 9 raças e as 12 classes que o SetupWizard oferecia até esta story. Nenhuma pode ficar
  // sem destino: era isto que a decisão de fechar o catálogo (Questões em aberto #2) exigia.
  const LEGACY_RACES = ['Anão', 'Meio-Orc', 'Elfo', 'Halfling', 'Humano', 'Dragonborn', 'Gnomo', 'Meio-Elfo', 'Tiefling']
  const LEGACY_CLASSES = ['Bárbaro', 'Bardo', 'Clérigo', 'Druida', 'Guerreiro', 'Monge', 'Paladino', 'Patrulheiro', 'Ladino', 'Feiticeiro', 'Bruxo', 'Mago']

  it('toda raça do wizard antigo tem destino, e o rótulo pt-BR volta a ser o MESMO texto', () => {
    for (const legacy of LEGACY_RACES) {
      const key = toRace(legacy)
      expect(key, `raça sem destino: ${legacy}`).not.toBeNull()
      expect(catalogLabel(races, key!)).toBe(legacy)
    }
  })

  it('toda classe do wizard antigo tem destino, e o rótulo pt-BR volta a ser o MESMO texto', () => {
    for (const legacy of LEGACY_CLASSES) {
      const key = toClass(legacy)
      expect(key, `classe sem destino: ${legacy}`).not.toBeNull()
      expect(catalogLabel(classes, key!)).toBe(legacy)
    }
  })

  // ADR 009: Meio-Elfo e Meio-Orc só têm destino porque a fonte é a UNIÃO das duas edições.
  // Se alguém voltar o ingest para só-2024, estas duas fichas ficam órfãs — e este teste cai.
  it('Meio-Elfo e Meio-Orc migram (só existem por causa da união do 5.1)', () => {
    expect(toRace('Meio-Elfo')).toBe('half-elf')
    expect(toRace('Meio-Orc')).toBe('half-orc')
  })

  // Substring casaria "Meio-Orc" em `orc`, que é a espécie NOVA — raça migra por match exato.
  it('"Meio-Orc" não vira `orc`', () => {
    expect(toRace('Meio-Orc')).not.toBe('orc')
    expect(toRace('Orc')).toBe('orc')
  })

  it('é idempotente: valor que já é chave passa intacto', () => {
    expect(toRace('dwarf')).toBe('dwarf')
    expect(toClass('wizard')).toBe('wizard')
  })

  it('texto fora do catálogo não é chutado — devolve null para decisão à mão', () => {
    expect(toRace('Meio-elfo do norte')).toBeNull()
    expect(toClass('Cartógrafa Estelar')).toBeNull()
  })

  // O ponto da story: a MESMA chave resolve nos dois locales, sem tocar no banco.
  it('a chave migrada resolve nos dois idiomas', () => {
    const key = toRace('Anão')!
    expect(catalogLabel(ptBR.races, key)).toBe('Anão')
    expect(catalogLabel(enUS.races, key)).toBe('Dwarf')
    const cls = toClass('Mago')!
    expect(catalogLabel(ptBR.classes, cls)).toBe('Mago')
    expect(catalogLabel(enUS.classes, cls)).toBe('Wizard')
  })
})
