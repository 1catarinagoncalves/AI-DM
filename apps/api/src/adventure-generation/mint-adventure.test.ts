import { describe, it, expect } from 'vitest'
import { GeneratedAdventureSchema } from '@ai-dm/shared'
import type { AuthoredRest, AuthoredSlice } from '../ai/adventure-authoring'
import { composeEncounterRoles } from './monster-roles'
import { mintRestOntoSlice, mintSlice } from './mint-adventure'

// US-256: o minting que vivia inline em `AdventureService.generateAdventure` — agora puro e testável
// sem AiService/PrismaService. Os testes de ponta a ponta do artefato (fixture mundo-primeiro, PASSO 2,
// backstops) continuam em adventure-generation.service.test.ts; aqui, o contrato das duas funções.

const registry = { setting: 'fantasy', tone: 'heroic', areaType: 'city' }
const SLICE_META = { id: 'char-1:1', level: 3, registry, modelId: 'fake/slice-model' }

function authoredSlice(overrides: Partial<AuthoredSlice> = {}): AuthoredSlice {
  return {
    world: { name: 'Vhel-Toran', description: 'Cidade entre costelas.', anchors: ['A Nave'] },
    summary: 'Três facções disputam um sarcófago.',
    story: 'O conflito central.',
    factions: [{ name: 'Guardiões', kind: 'ordem', want: 'selar' }, { name: 'Sindicato', kind: 'submundo', want: 'vender' }],
    npcs: [
      { name: 'Kesh', role: 'guardiã', want: 'proteger', factionIndex: 1 },
      { name: 'Bram', role: 'contrabandista', want: 'lucrar', factionIndex: null },
    ],
    locations: [
      { title: 'A Nave', aspects: [], boxedText: 'x', description: 'y', occupants: [0, 9], factionIndex: 0, vibe: 'social' },
      { title: 'O Cais', aspects: [], boxedText: 'x', description: 'y', occupants: [], vibe: 'skill' },
    ],
    start: 'O gancho.',
    ...overrides,
  }
}

function authoredRest(overrides: Partial<AuthoredRest> = {}): AuthoredRest {
  return {
    challenges: [{ locationIndex: 0, test: 'teste de Força', situation: 's', consequence: 'c' }],
    encounters: [{ locationIndex: 0, npcIndices: [0, 7], type: 'social', fiction: 'f', behaviors: 'b', goal: 'g', complications: 'c', unlocks: 'u' }],
    objective: { description: 'd', reward: { name: 'Selo', effect: 'e' }, locationIndex: 0 },
    branchedResolution: [{ choice: 'a', consequence: 'b' }],
    followUps: ['x'],
    ...overrides,
  }
}

const restCtx = { level: 3, challenge: 'adventure' as const, maxHostileCount: 0, modelId: 'fake/rest-model' }

describe('mintSlice (US-256)', () => {
  it('minta faction-N / npc-N / loc-N, com factionId por índice e null/ausente sem factionId', () => {
    const slice = mintSlice(authoredSlice(), SLICE_META)
    expect(slice.factions.map((f) => f.id)).toEqual(['faction-1', 'faction-2'])
    expect(slice.npcs.map((n) => [n.id, n.factionId])).toEqual([['npc-1', 'faction-2'], ['npc-2', undefined]])
    expect(slice.locations.map((l) => [l.id, l.factionId])).toEqual([['loc-1', 'faction-1'], ['loc-2', undefined]])
  })

  it('occupants: índice válido vira npcId, índice fora de faixa é filtrado (melhor esforço, US-158)', () => {
    expect(mintSlice(authoredSlice(), SLICE_META).locations[0]!.occupants).toEqual(['npc-1'])
  })

  it('id, levelRange, registry e generationModel vêm do meta; só a forma da fatia (sem resto) é validada', () => {
    const slice = mintSlice(authoredSlice(), SLICE_META)
    expect(slice).toMatchObject({ id: 'char-1:1', levelRange: { min: 3, max: 3 }, registry, generationModel: 'fake/slice-model' })
    expect(slice).not.toHaveProperty('challenges')
  })
})

describe('mintRestOntoSlice (US-256)', () => {
  const slice = () => mintSlice(authoredSlice(), SLICE_META)

  it('artefato completo passa em GeneratedAdventureSchema, com os dois modelId de proveniência', () => {
    const adventure = mintRestOntoSlice(slice(), authoredRest(), restCtx)
    expect(() => GeneratedAdventureSchema.parse(adventure)).not.toThrow()
    expect(adventure).toMatchObject({ generationModel: 'fake/slice-model', restGenerationModel: 'fake/rest-model' })
  })

  it('locationIndex fora de faixa LANÇA com o valor e o intervalo esperado (nunca clampa)', () => {
    expect(() => mintRestOntoSlice(slice(), authoredRest({ objective: { description: 'd', reward: { name: 'r', effect: 'e' }, locationIndex: 5 } }), restCtx))
      .toThrow('locationIndex 5 fora de faixa — esperado 0..1 (2 locais autorados)')
  })

  it('npcIndices fora de faixa são filtrados', () => {
    expect(mintRestOntoSlice(slice(), authoredRest(), restCtx).encounters[0]!.npcIds).toEqual(['npc-1'])
  })

  // Fatia imutável: backstops de occupants e PASSO 2 mexem numa CÓPIA — o que já foi persistido em
  // `authoredSlice` continua sendo exatamente o que a jogadora leu.
  it('NÃO muta a fatia de entrada: backstops e combatRole só aparecem no artefato final', () => {
    const input = slice()
    const before = structuredClone(input)
    // Bram (npc-2) e o Cais (loc-2) ficam órfãos → os dois backstops rodam.
    const adventure = mintRestOntoSlice(input, authoredRest(), restCtx)
    expect(input).toEqual(before)
    expect(adventure.locations.find((l) => l.id === 'loc-2')!.occupants.length).toBeGreaterThan(0)
  })

  it('a fatia liberada e o artefato final concordam em world.name, npcs[].name e locations[].title', () => {
    const input = slice()
    const adventure = mintRestOntoSlice(input, authoredRest(), restCtx)
    expect(adventure.world.name).toBe(input.world.name)
    expect(adventure.npcs.map((n) => n.name)).toEqual(input.npcs.map((n) => n.name))
    expect(adventure.locations.map((l) => l.title)).toEqual(input.locations.map((l) => l.title))
  })

  it('PASSO 2: encontro combat recebe combatRole/nominalCreature dentro do orçamento; nível 3/adventure (orçamento 0) não recebe', () => {
    const combat = authoredRest({ encounters: [{ locationIndex: 0, npcIndices: [0, 1], type: 'combat', fiction: 'f', behaviors: 'b', goal: 'g', complications: 'c', unlocks: 'u' }] })
    const noBudget = mintRestOntoSlice(slice(), combat, restCtx)
    expect(noBudget.npcs.every((n) => n.combatRole === undefined)).toBe(true)

    const level = 8
    const maxHostileCount = composeEncounterRoles(level, 'adventure').length
    const withBudget = mintRestOntoSlice(slice(), combat, { ...restCtx, level, maxHostileCount })
    expect(withBudget.npcs.every((n) => n.combatRole && n.nominalCreature)).toBe(true)
  })
})
