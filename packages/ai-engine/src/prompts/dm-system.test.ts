import { describe, it, expect } from 'vitest'
import { buildDmSystemPrompt, type DmCharacterSheet } from './dm-system'

const baseSheet: DmCharacterSheet = {
  level: 3,
  hp: 8,
  maxHp: 24,
  attributes: { strength: 16, dexterity: 12 },
  conditions: ['envenenado'],
}

function build(overrides: Partial<Parameters<typeof buildDmSystemPrompt>[0]> = {}) {
  return buildDmSystemPrompt({
    systemName: 'D&D 5e',
    characterName: 'Aria',
    characterGender: 'feminino',
    characterClass: 'guerreiro',
    characterRace: 'humana',
    activeQuests: [],
    inventory: [],
    sheet: baseSheet,
    ...overrides,
  })
}

describe('buildDmSystemPrompt — ficha (US-23)', () => {
  it('inclui nível, HP/HP máx, condições e atributos da ficha', () => {
    const p = build()
    expect(p).toMatch(/Level:\s*3/)
    expect(p).toMatch(/HP:\s*8\/24/)
    expect(p).toMatch(/envenenado/)
    expect(p).toMatch(/16/)
    expect(p).toMatch(/12/)
  })

  it('marca a seção da ficha como read-only / fonte de verdade', () => {
    expect(build().toLowerCase()).toMatch(/character sheet \(read-only/)
  })

  it('renderiza atributos iterando o map — um atributo novo aparece sem editar o builder', () => {
    const p = build({ sheet: { ...baseSheet, attributes: { ...baseSheet.attributes, sorte: 7 } } })
    expect(p).toMatch(/sorte/i)
    expect(p).toMatch(/7/)
  })

  it('usa o label do config quando presente e cai na chave crua sem crashar quando ausente', () => {
    const withLabels = build({ attributeLabels: { strength: 'FOR', dexterity: 'DES' } })
    expect(withLabels).toMatch(/FOR 16/)
    expect(withLabels).toMatch(/DES 12/)

    const noLabels = build() // sem attributeLabels → chave crua, sem crash
    expect(noLabels).toMatch(/strength 16/)
  })

  it('não quebra com condições/atributos vazios', () => {
    const p = build({ sheet: { level: 1, hp: 10, maxHp: 10, attributes: {}, conditions: [] } })
    expect(p).toMatch(/Level:\s*1/)
    expect(p).toMatch(/HP:\s*10\/10/)
    expect(typeof p).toBe('string')
  })
})

describe('buildDmSystemPrompt — background narrativo (US-39)', () => {
  const background = {
    story: 'Nobre menor que perdeu a família para um culto demoníaco',
    ideals: ['Justiça acima de tudo', 'A Luz protege os inocentes'],
    bonds: ['Jurou vingança contra o culto que matou sua família'],
    flaws: ['Código de honra rígido: não mente, não abandona inocentes'],
  }

  it('inclui story, ideais, vínculos e fraquezas quando presentes', () => {
    const p = build({ background })
    expect(p).toMatch(/Nobre menor que perdeu a família/)
    expect(p).toMatch(/Justiça acima de tudo/)
    expect(p).toMatch(/Jurou vingança contra o culto/)
    expect(p).toMatch(/Código de honra rígido/)
  })

  it('junta as listas (ideais/vínculos/fraquezas) numa linha', () => {
    const p = build({ background })
    expect(p).toMatch(/Justiça acima de tudo; A Luz protege os inocentes/)
  })

  it('marca a seção como read-only / roleplay guidance e instrui o USO de cada eixo', () => {
    const p = build({ background })
    expect(p.toLowerCase()).toMatch(/character identity \(read-only/)
    // a redação default (US-39 §3): condicional + papel de cada traço
    expect(p.toLowerCase()).toMatch(/flaw|fraqueza/)
    expect(p.toLowerCase()).toMatch(/when the scene|quando a cena/)
  })

  it('sem background → não gera a seção nem quebra', () => {
    const p = build()
    expect(p).not.toMatch(/Character identity/i)
    expect(typeof p).toBe('string')
  })

  it('background vazio ({}) ou campos vazios → sem seção, sem crash', () => {
    expect(build({ background: {} })).not.toMatch(/Character identity/i)
    const p = build({ background: { story: '', ideals: [], flaws: ['   '] } })
    expect(p).not.toMatch(/Character identity/i)
  })

  it('renderiza só os campos preenchidos (vínculo ausente não vira linha vazia)', () => {
    const p = build({ background: { story: 'Um andarilho solitário' } })
    expect(p).toMatch(/Character identity/i)
    expect(p).toMatch(/Um andarilho solitário/)
    expect(p).not.toMatch(/Vínculos:/)
  })
})

describe('buildDmSystemPrompt — ordenação por volatilidade / prompt caching (US-55)', () => {
  const scene = {
    local: 'Praça da vila ao anoitecer',
    ambiente: 'externo' as const,
    periodo: 'anoitecer',
    presentes: ['prefeito'],
    objetos_em_cena: [],
    atualizadoEm: '',
  }

  it('emite todo o estático + constante ANTES de qualquer campo volátil', () => {
    const p = build({ mainQuest: 'Salvar a vila', inventory: ['Espada'], sceneState: scene })
    // Últimos marcadores da camada 1 (estático) + camada 2 (constante por personagem).
    const staticConstant = ['## Critical rules', '## ⚠️ STARTING EQUIPMENT', "## The player's character", '- Attributes:']
    // Primeiros marcadores da camada 3 (volátil, muda por turno).
    const volatile = ['## Estado atual', '- HP:', '## Cena atual', '## Main quest', '## Current inventory']
    const lastStaticConstant = Math.max(...staticConstant.map((m) => p.indexOf(m)))
    const firstVolatile = Math.min(...volatile.filter((m) => p.includes(m)).map((m) => p.indexOf(m)))
    expect(lastStaticConstant).toBeGreaterThan(-1)
    expect(firstVolatile).toBeGreaterThan(lastStaticConstant)
  })

  it('quebra da ficha: HP/condições (volátil) vêm DEPOIS de level/atributos (constante)', () => {
    const p = build()
    expect(p.indexOf('- Level:')).toBeLessThan(p.indexOf('- Attributes:'))
    expect(p.indexOf('- Attributes:')).toBeLessThan(p.indexOf('- HP:'))
    expect(p.indexOf('- HP:')).toBeLessThan(p.indexOf('- Conditions:'))
  })

  it('sceneSection saiu do meio da parede: o bloco "## Cena atual" fica depois da regra SPATIAL', () => {
    const p = build({ sceneState: scene })
    expect(p.indexOf('## Cena atual')).toBeGreaterThan(p.indexOf('SPATIAL & SCENE CONTINUITY'))
  })

  it('a regra em-dash/opções aparece UMA vez (sem a duplicata "ABSOLUTE RULE")', () => {
    const p = build()
    expect(p).not.toMatch(/ABSOLUTE RULE/)
    expect(p.split('Choice Options').length - 1).toBe(1)
  })

  it('não perde regras semânticas na reordenação (rolagens, gênero, craft, continuidade)', () => {
    const p = build()
    expect(p).toMatch(/rollDice/)
    expect(p).toMatch(/Gender Agreement/)
    expect(p).toMatch(/Narrative craft/)
    expect(p).toMatch(/SPATIAL & SCENE CONTINUITY/)
    expect(p).toMatch(/TURN RESOLUTION ORDER/)
  })
})
