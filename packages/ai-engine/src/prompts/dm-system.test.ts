import { describe, it, expect } from 'vitest'
import { buildDmSystemPrompt, buildTurnStateBlock, type DmCharacterSheet } from './dm-system'

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
    sheet: baseSheet,
    ...overrides,
  })
}

function buildState(overrides: Partial<Parameters<typeof buildTurnStateBlock>[0]> = {}) {
  return buildTurnStateBlock({
    sheet: baseSheet,
    activeQuests: [],
    inventory: [],
    ...overrides,
  })
}

describe('buildDmSystemPrompt — ficha constante (US-23 / camada 2)', () => {
  it('inclui nível e atributos da ficha (constante por personagem)', () => {
    const p = build()
    expect(p).toMatch(/Level:\s*3/)
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

  it('não quebra com atributos vazios', () => {
    const p = build({ sheet: { level: 1, hp: 10, maxHp: 10, attributes: {}, conditions: [] } })
    expect(p).toMatch(/Level:\s*1/)
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

describe('buildDmSystemPrompt — sem estado volátil no system (US-56 / camadas 1+2 só)', () => {
  const scene = {
    local: 'Praça da vila ao anoitecer',
    ambiente: 'externo' as const,
    periodo: 'anoitecer',
    presentes: ['prefeito'],
    objetos_em_cena: [],
    atualizadoEm: '',
  }

  it('NÃO emite nenhum campo volátil (HP, condições, cena, quests, inventário, resumo)', () => {
    const p = build()
    // Camada 3 saiu inteira do system: nenhum cabeçalho de estado do turno aparece aqui.
    expect(p).not.toMatch(/## Estado atual/)
    expect(p).not.toMatch(/- HP:/)
    expect(p).not.toMatch(/- Conditions:/)
    expect(p).not.toMatch(/## Cena atual/)
    expect(p).not.toMatch(/## Main quest/)
    expect(p).not.toMatch(/## Active quests/)
    expect(p).not.toMatch(/## Current inventory/)
    expect(p).not.toMatch(/## A história até agora/)
    // Mesmo passando dados voláteis herdados, nada vaza (a assinatura já nem os aceita,
    // mas o valor do personagem — envenenado — não deve reaparecer via outra rota).
    expect(p).not.toMatch(/envenenado/)
  })

  it('mantém level/atributos (constante) no system', () => {
    const p = build()
    expect(p.indexOf('- Level:')).toBeLessThan(p.indexOf('- Attributes:'))
    expect(p).toMatch(/Level:\s*3/)
  })

  it('não perde regras semânticas (rolagens, gênero, craft, continuidade, ordem do turno)', () => {
    const p = build()
    expect(p).toMatch(/rollDice/)
    expect(p).toMatch(/Gender Agreement/)
    expect(p).toMatch(/Narrative craft/)
    expect(p).toMatch(/SPATIAL & SCENE CONTINUITY/)
    expect(p).toMatch(/TURN RESOLUTION ORDER/)
  })

  it('inclui a subseção de onomástica (US-68): proíbe slop, ancora sonoridade, paleta aberta', () => {
    const p = build()
    expect(p).toMatch(/Onomastics/)
    // nomes-slop citados como exemplo do que evitar
    expect(p).toMatch(/Elara/)
    expect(p).toMatch(/Kael/)
    // paleta aberta + cobre pessoas/lugares/coisas
    expect(p).toMatch(/OPEN PALETTE/)
    expect(p).toMatch(/not just NPCs/)
  })

  it('a regra em-dash/opções aparece UMA vez (sem a duplicata "ABSOLUTE RULE")', () => {
    const p = build()
    expect(p).not.toMatch(/ABSOLUTE RULE/)
    expect(p.split('Choice Options').length - 1).toBe(1)
  })

  // guard: a cena não volta ao system nem quando um caller antigo tentaria passá-la.
  it('cena estruturada nunca aparece no system', () => {
    const p = build()
    expect(p).not.toContain(scene.local)
  })
})

describe('buildTurnStateBlock — estado volátil na mensagem (US-56 / camada 3)', () => {
  const scene = {
    local: 'Praça da vila ao anoitecer',
    ambiente: 'externo' as const,
    periodo: 'anoitecer',
    presentes: ['prefeito'],
    objetos_em_cena: [],
    atualizadoEm: '',
  }

  it('inclui HP/HP máx e condições da ficha', () => {
    const s = buildState()
    expect(s).toMatch(/## Estado atual/)
    expect(s).toMatch(/HP:\s*8\/24/)
    expect(s).toMatch(/envenenado/)
  })

  it('cabeçalho forte de fonte-de-verdade: declara-se ground truth do sistema, não fala do jogador, com precedência', () => {
    const s = buildState()
    // O risco principal da US: lido como fala do usuário, o estado precisa dobrar a
    // linguagem de precedência para não perder força de instrução.
    expect(s.toLowerCase()).toMatch(/source of truth|fonte de verdade/)
    expect(s.toLowerCase()).toMatch(/not the player speaking/)
    expect(s.toLowerCase()).toMatch(/precedence/)
  })

  it('inclui cena, main quest, active quests, inventário e resumo quando presentes', () => {
    const s = buildState({
      sceneState: scene,
      mainQuest: 'Salvar a vila',
      activeQuests: ['Encontrar o ferreiro'],
      inventory: ['Espada', 'Poção (2)'],
      memorySummary: 'A vila foi atacada por goblins na noite anterior.',
    })
    expect(s).toMatch(/## Cena atual/)
    expect(s).toContain('Praça da vila ao anoitecer')
    expect(s).toMatch(/## Main quest/)
    expect(s).toContain('Salvar a vila')
    expect(s).toMatch(/## Active quests/)
    expect(s).toContain('Encontrar o ferreiro')
    expect(s).toMatch(/## Current inventory/)
    expect(s).toContain('Espada')
    expect(s).toMatch(/## A história até agora/)
    expect(s).toContain('atacada por goblins')
  })

  it('o resumo refere as mensagens recentes como estando ACIMA (history fica antes do bloco)', () => {
    const s = buildState({ memorySummary: 'Algo aconteceu.' })
    expect(s).toMatch(/before the recent messages above/)
    expect(s).not.toMatch(/before the recent messages below/)
  })

  it('campos ausentes → sem cena/resumo, placeholders para quest/inventário, sem crash', () => {
    const s = buildState()
    expect(s).not.toMatch(/## Cena atual/)
    expect(s).not.toMatch(/## A história até agora/)
    expect(s).toMatch(/No main quest set yet/)
    expect(s).toMatch(/No secondary quests yet/)
    expect(s).toMatch(/- Empty\./)
    expect(typeof s).toBe('string')
  })
})
