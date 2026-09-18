import { describe, it, expect } from 'vitest'
import { GeneratedAdventureSchema } from '@ai-dm/shared'
import { AdventureSliceSchema, type AdventureSlice } from '../adventure-generation/adventure-slice'
import { AUTHORING_REST_SCHEMA, AUTHORING_SLICE_SCHEMA, buildRestPrompt, buildRestSystem, buildSlicePrompt } from './adventure-authoring'

// US-256: a autoria mundo-primeiro (US-232) virou duas chamadas. Estes testes são de TEXTO/FORMA puros
// (sem `generateObject`): a divisão dos schemas e o que cada prompt carrega.

// Campos do artefato final que NÃO vêm do modelo: o motor os deriva (id/levelRange/registry) ou os
// grava como proveniência (generationModel/restGenerationModel).
const DERIVED_FIELDS = ['id', 'levelRange', 'registry', 'generationModel', 'restGenerationModel']

describe('divisão do schema de autoria (US-256)', () => {
  it('AUTHORING_SLICE_SCHEMA tem exatamente world, summary, story, factions, npcs, locations, start (nesta ordem)', () => {
    expect(Object.keys(AUTHORING_SLICE_SCHEMA.shape)).toEqual(['world', 'summary', 'story', 'factions', 'npcs', 'locations', 'start'])
  })

  it('AUTHORING_REST_SCHEMA tem os outros cinco campos', () => {
    expect(Object.keys(AUTHORING_REST_SCHEMA.shape)).toEqual(['challenges', 'encounters', 'objective', 'branchedResolution', 'followUps'])
  })

  it('a união cobre todo campo do artefato final, sem perder nem duplicar', () => {
    const sliceKeys = Object.keys(AUTHORING_SLICE_SCHEMA.shape)
    const restKeys = Object.keys(AUTHORING_REST_SCHEMA.shape)
    expect(sliceKeys.filter((key) => restKeys.includes(key))).toEqual([])
    expect([...sliceKeys, ...restKeys, ...DERIVED_FIELDS].sort()).toEqual(Object.keys(GeneratedAdventureSchema.shape).sort())
  })

  it('AdventureSliceSchema (fatia com ids mintados) é o subconjunto da 1A do artefato final', () => {
    expect(Object.keys(AdventureSliceSchema.shape).sort()).toEqual(
      [...Object.keys(AUTHORING_SLICE_SCHEMA.shape), 'id', 'levelRange', 'registry', 'generationModel'].sort(),
    )
  })
})

const slice: AdventureSlice = {
  id: 'char-1:1',
  levelRange: { min: 3, max: 3 },
  registry: { setting: 'x', tone: 'y', areaType: 'z' },
  summary: 'Três facções disputam um sarcófago.',
  world: { name: 'Vhel-Toran', description: 'Cidade entre costelas.', anchors: ['A Nave — o coração'] },
  story: 'O conflito central.',
  factions: [
    { id: 'faction-1', name: 'Guardiões', kind: 'ordem', want: 'selar' },
    { id: 'faction-2', name: 'Sindicato do Sal', kind: 'submundo', want: 'vender' },
  ],
  npcs: [
    { id: 'npc-1', name: 'Kesh', role: 'guardiã', want: 'proteger', factionId: 'faction-1' },
    { id: 'npc-2', name: 'Bram', role: 'contrabandista', want: 'lucrar' },
  ],
  locations: [
    { id: 'loc-1', title: 'A Nave', aspects: ['úmida'], boxedText: 'Você entra.', description: 'Pilares de osso.', occupants: ['npc-1'], vibe: 'social' },
    { id: 'loc-2', title: 'O Cais Morto', aspects: [], boxedText: 'A maré.', description: 'Barcos podres.', occupants: [], vibe: 'skill' },
  ],
  start: 'O gancho: Kesh a espera na Nave.',
}

const restParams = { slice, counts: { challenges: 3, encounters: 3 }, namingRegister: 'Celtic', level: 3, className: 'ladino', combatBudget: { maxHostileCount: 0, viable: false } }

describe('buildRestPrompt (US-256)', () => {
  // A 1B só referencia a fatia por ÍNDICE; se o nome de alguma facção/NPC/local faltar no prompt, o modelo
  // nem tem como saber o que existe.
  it('contém o nome de toda facção, NPC e local da fatia', () => {
    const prompt = buildRestPrompt(restParams)
    for (const name of [...slice.factions, ...slice.npcs].map((x) => x.name).concat(slice.locations.map((l) => l.title))) {
      expect(prompt).toContain(name)
    }
  })

  it('numera NPCs e locais com o índice 0-based que o modelo devolve em npcIndices/locationIndex', () => {
    const prompt = buildRestPrompt(restParams)
    expect(prompt).toContain('[0] Kesh')
    expect(prompt).toContain('[1] Bram')
    expect(prompt).toContain('[0] A Nave')
    expect(prompt).toContain('[1] O Cais Morto')
  })

  it('carrega mundo, sinopse, story e o gancho já lido, e o registro de nomenclatura', () => {
    const prompt = buildRestPrompt(restParams)
    for (const text of ['Vhel-Toran', slice.summary, slice.story, slice.start, 'Celtic']) expect(prompt).toContain(text)
  })

  it('a contagem de rumos/followUps é a de facções da FATIA (o motor não sorteia de novo)', () => {
    expect(buildRestPrompt(restParams)).toContain('2 rumos em branchedResolution e 2 followUps')
  })

  it('o system da 1B manda referir a fatia por índice e não repete a semente em inglês', () => {
    const system = buildRestSystem('pt-BR')
    expect(system).toMatch(/ÍNDICE/)
    expect(system).not.toMatch(/nunca copie a palavra em ingl[êe]s/i)
  })
})

describe('buildSlicePrompt (US-256)', () => {
  const sliceParams = { world: {}, factionCount: 3, counts: { locations: 6, npcs: 7 }, namingRegister: 'Celtic', questSeed: 'Kill a villain', level: 3, className: 'ladino' }

  it('a "ordem de emissão" bate com a ordem real do schema da 1A (a linha antiga divergia dele)', () => {
    const line = buildSlicePrompt(sliceParams).split('\n').find((l) => l.startsWith('Emita na ordem'))!
    const order = ['mundo', 'sinopse', 'story', 'facções', 'NPCs', 'locais', 'start']
    const positions = order.map((token) => line.indexOf(token))
    expect(positions.every((p) => p >= 0)).toBe(true)
    expect([...positions].sort((a, b) => a - b)).toEqual(positions)
  })
})
