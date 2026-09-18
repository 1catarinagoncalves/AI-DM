import { describe, it, expect } from 'vitest'
import type { GeneratedAdventure } from '@ai-dm/shared'
import { buildAdventureExportView, renderAdventureExportMarkdown, type AdventureExportData } from './adventure-export'

// US-202, critério de aceite (a): fixture com dois locais, dois NPCs e um encontro —
// falha se uma referência ficar sem resolver (id cru na saída) ou se um NPC declarado no
// artefato sumir do Markdown.
const artifact: GeneratedAdventure = {
  id: 'char-1:1',
  levelRange: { min: 1, max: 1 },
  registry: { setting: 'floresta', tone: 'sombrio', areaType: 'ruína' },
  summary: 'Uma vila à beira da floresta esconde um segredo.',
  world: { name: 'Val do Poço', description: 'Uma vila afundada em névoa perene.', anchors: ['Praça da vila'] },
  story: 'Facções disputam o poço selado da praça.',
  factions: [
    { id: 'faction-1', name: 'Anciãos do Poço', kind: 'ordem', want: 'manter o poço selado' },
    { id: 'faction-2', name: 'Cavadores', kind: 'submundo', want: 'abrir o poço' },
  ],
  npcs: [
    { id: 'npc-1', name: 'Ilvaine Torncroft', role: 'anciã da vila', want: 'manter o poço selado', factionId: 'faction-1' },
    { id: 'npc-2', name: 'Doran Ashwick', role: 'ferreiro rude', want: 'lucrar com o que houver no poço', factionId: 'faction-2' },
  ],
  locations: [
    { id: 'loc-1', title: 'Praça da vila', aspects: ['poço selado'], boxedText: 'x', description: 'x', occupants: ['npc-1'], vibe: 'social' },
    { id: 'loc-2', title: 'Forja de Doran', aspects: [], boxedText: 'y', description: 'y', occupants: ['npc-2'], vibe: 'skill' },
  ],
  challenges: [
    { id: 'challenge-1', locationId: 'loc-2', test: 'teste de Carisma (Persuasão)', situation: 'convencer Doran a largar o pé de cabra', consequence: 'Doran arromba o poço primeiro' },
  ],
  encounters: [
    {
      id: 'encounter-1',
      locationId: 'loc-1',
      npcIds: ['npc-1'],
      type: 'social',
      fiction: 'Ilvaine bloqueia o poço e exige saber de que lado você está.',
      behaviors: 'Ilvaine observa com desconfiança.',
      goal: 'Convencer Ilvaine a falar do poço.',
      complications: 'Ela só fala se o grupo provar boa fé.',
      unlocks: 'A confirmação de que o poço está selado de propósito.',
    },
  ],
  start: 'A caravana chega ao anoitecer.',
  objective: { description: 'Descobrir o que o poço esconde.', reward: { name: 'Selo dos Anciãos', effect: 'sela o que estiver atrás de uma porta ao toque' }, locationId: 'loc-1' },
  branchedResolution: [
    { choice: 'Selar o poço de vez', consequence: 'os Cavadores juram vingança' },
    { choice: 'Abrir o poço', consequence: 'o que dorme desperta, grato' },
  ],
  followUps: ['A entidade pode ter descendentes em outras vilas.'],
}

function fixtureData(generatedAdventure: unknown = artifact): AdventureExportData {
  return {
    adventure: {
      id: 'adv-1',
      title: artifact.summary,
      order: 1,
      status: 'ACTIVE',
      createdAt: new Date('2026-09-01T00:00:00.000Z'),
      memorySummary: null,
      entities: [],
      generatedAdventure,
    },
    quests: [{ title: 'Quest', description: 'desc', status: 'OPEN', isPrimary: true, objective: artifact.objective.description }],
    character: { name: 'Aria', race: 'human', class: 'wizard', level: 1, background: {}, origin: {}, locale: 'pt-BR' },
    characterState: { hp: 10, maxHp: 10, inventory: [], conditions: [], sceneState: null },
    eventLogs: [
      { type: 'INTRODUCTION', payload: { text: 'Um prólogo do Mestre.' }, summarized: false, createdAt: new Date('2026-09-01T00:04:00.000Z') },
      { type: 'ACTION', payload: { text: 'Falo com Ilvaine.' }, summarized: false, createdAt: new Date('2026-09-01T00:05:00.000Z') },
    ],
    system: { id: 'sys-1', name: 'D&D 5e', version: '5.2', sourceType: 'SRD' },
  }
}

function render(generatedAdventure: unknown = artifact): string {
  return renderAdventureExportMarkdown(buildAdventureExportView(fixtureData(generatedAdventure)))
}

describe('US-202 — renderAdventureExportMarkdown resolve referências por id', () => {
  it('encontro e desafio mostram o TÍTULO do local, nunca o locationId cru', () => {
    const md = render()
    expect(md).not.toContain('loc-1')
    expect(md).not.toContain('loc-2')
    expect(md).toContain('Praça da vila')
    expect(md).toContain('Forja de Doran')
  })

  it('nenhum NPC declarado no artefato some do Markdown', () => {
    const md = render()
    expect(md).toContain('Ilvaine Torncroft')
    expect(md).toContain('Doran Ashwick')
  })

  it('unlocks do encontro aparece na saída', () => {
    expect(render()).toContain('A confirmação de que o poço está selado de propósito.')
  })

  it('aventura sem generatedAdventure exporta o resto e marca a seção do artefato como ausente', () => {
    const md = render(null)
    expect(md).toContain('Ausente')
    expect(md).toContain(artifact.summary) // título da aventura, fonte independente do artefato
  })

  it('artefato que não revalida contra o schema cai no JSON cru com aviso, sem quebrar o export', () => {
    const broken = { ...artifact, npcs: undefined }
    const md = render(broken)
    expect(md).toContain('não revalida')
    expect(md).toContain(artifact.summary)
  })

  // US-257: INTRODUCTION renderiza como diálogo do Mestre (mesmo formato de NARRATION),
  // nunca o fallback genérico `[TIPO] JSON`.
  it('renderiza EventLog INTRODUCTION como fala do Mestre, não como fallback genérico', () => {
    const md = render()
    expect(md).toContain('**Mestre** (2026-09-01T00:04:00.000Z): Um prólogo do Mestre.')
    expect(md).not.toContain('[INTRODUCTION]')
  })
})
