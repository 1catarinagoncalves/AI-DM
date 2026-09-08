import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import { abilityModifier, formatModifier, skillModifier, buildSavingThrowSheet } from './ability'

// US-108 — o oráculo é a TABELA DO SRD 2024, não número escrito à mão aqui: o artefato é
// gerado do texto normativo (`Rule.json` do Open5e) pelo ingest, e o diff dele é a revisão de
// um bump de tag. Sem isto, trocar `Math.floor` por `Math.round` continuava passando nos 6
// casos de fronteira abaixo.
// cwd = raiz do pacote (o vitest roda por pacote) — mesmo idioma do drift guard da US-36.
const SRD_TABLE = JSON.parse(
  readFileSync(resolve(process.cwd(), '../../scripts/srd/ability-modifiers.srd-2024.json'), 'utf8'),
) as { range: { min: number; max: number }; rows: { scoreMin: number; scoreMax: number; modifier: number }[] }

describe('abilityModifier contra a tabela do SRD 2024 (US-108)', () => {
  // Guarda de vacuidade: artefato vazio ou truncado faria a varredura abaixo passar sem
  // conferir nada.
  it('o oráculo tem as 16 faixas cobrindo a pontuação 1–30', () => {
    expect(SRD_TABLE.rows).toHaveLength(16)
    expect(SRD_TABLE.range).toEqual({ min: 1, max: 30 })
  })

  it('a fórmula reproduz a tabela oficial em TODA a faixa, valor a valor', () => {
    for (const { scoreMin, scoreMax, modifier } of SRD_TABLE.rows) {
      for (let score = scoreMin; score <= scoreMax; score++) {
        expect(abilityModifier(score), `pontuação ${score}`).toBe(modifier)
      }
    }
  })

  it('pontuação fora de 1–30 lança com o valor ofensor e a faixa esperada', () => {
    expect(() => abilityModifier(0)).toThrow(/0 \(esperado inteiro de 1 a 30/)
    expect(() => abilityModifier(31)).toThrow(/31/)
    expect(() => abilityModifier(-3)).toThrow(/-3/)
    expect(() => abilityModifier(10.5)).toThrow(/10\.5/)
  })
})

describe('abilityModifier', () => {
  it('cobre os casos de fronteira da tabela 5e', () => {
    expect(abilityModifier(1)).toBe(-5)
    expect(abilityModifier(8)).toBe(-1)
    expect(abilityModifier(10)).toBe(0)
    expect(abilityModifier(11)).toBe(0)
    expect(abilityModifier(15)).toBe(2)
    expect(abilityModifier(20)).toBe(5)
  })

  it('ímpar e o par anterior dão o mesmo modificador (14 e 15 → +2)', () => {
    expect(abilityModifier(14)).toBe(abilityModifier(15))
  })
})

describe('formatModifier', () => {
  it('põe sinal em positivos, mantém negativo, 0 sem sinal', () => {
    expect(formatModifier(2)).toBe('+2')
    expect(formatModifier(0)).toBe('0')
    expect(formatModifier(-1)).toBe('-1')
  })
})

describe('skillModifier', () => {
  it('não-proficiente = só o modificador do atributo', () => {
    expect(skillModifier(16, false, 2)).toBe(3) // Des 16 → +3
    expect(skillModifier(13, false, 2)).toBe(1) // ímpar → +1
  })

  it('proficiente soma o bônus de proficiência', () => {
    expect(skillModifier(16, true, 2)).toBe(5) // +3 +2
    expect(skillModifier(13, true, 2)).toBe(3) // +1 +2
    expect(skillModifier(8, true, 2)).toBe(1)  // -1 +2
  })
})

// US-222: mesma classe de teste de buildSkillSheet (US-27), mas sem catálogo de escolha —
// sempre as 6 habilidades, proficiência fixada pela classe.
describe('buildSavingThrowSheet', () => {
  const ATTRS = [
    { key: 'strength', label: 'Força' },
    { key: 'dexterity', label: 'Destreza' },
    { key: 'constitution', label: 'Constituição' },
    { key: 'intelligence', label: 'Inteligência' },
    { key: 'wisdom', label: 'Sabedoria' },
    { key: 'charisma', label: 'Carisma' },
  ]
  const SCORES = { strength: 16, dexterity: 13, constitution: 14, intelligence: 8, wisdom: 12, charisma: 10 }

  it('marca proficiente as 2 chaves da classe, com bônus somado só nelas', () => {
    const sheet = buildSavingThrowSheet(ATTRS, SCORES, ['constitution', 'strength'], 2)
    expect(sheet).toHaveLength(6)
    const bySave = Object.fromEntries(sheet.map((s) => [s.key, s]))
    expect(bySave.strength).toEqual({ key: 'strength', label: 'Força', proficient: true, modifier: 5 }) // +3 +2
    expect(bySave.constitution).toEqual({ key: 'constitution', label: 'Constituição', proficient: true, modifier: 4 }) // +2 +2
    expect(bySave.dexterity).toEqual({ key: 'dexterity', label: 'Destreza', proficient: false, modifier: 1 })
    expect(bySave.intelligence?.proficient).toBe(false)
  })

  it('classe sem savingThrows no config (ou sistema Free) devolve as 6 linhas, nenhuma proficiente', () => {
    const sheet = buildSavingThrowSheet(ATTRS, SCORES, undefined, 2)
    expect(sheet).toHaveLength(6)
    expect(sheet.every((s) => s.proficient === false)).toBe(true)
  })

  it('atributo ausente do mapa de scores cai em 10, nunca lança', () => {
    const sheet = buildSavingThrowSheet(ATTRS, {}, ['wisdom'], 2)
    expect(sheet.find((s) => s.key === 'wisdom')).toEqual({ key: 'wisdom', label: 'Sabedoria', proficient: true, modifier: 2 }) // 10 → +0, +2
    expect(sheet.find((s) => s.key === 'charisma')?.modifier).toBe(0)
  })
})
