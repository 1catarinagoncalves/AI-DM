import { describe, it, expect } from 'vitest'
import type { GeneratedAdventure } from '@ai-dm/shared'
import { seedLedgerFromGeneratedAdventure } from './seed-ledger'

// US-151: fixture com 3 segredos, 2 NPCs narrativos (npc-1, npc-3) e 1 NPC de combate
// (npc-2, role 'Soldier') — o critério de aceite pede exatamente esta composição.
// npc-3 não ocupa nenhum local (testa "sem location associada não quebra").
function adventureFixture(overrides: Partial<GeneratedAdventure> = {}): GeneratedAdventure {
  return {
    id: 'char-1:1',
    levelRange: { min: 5, max: 5 },
    setting: 'floresta', tone: 'heroico', areaType: 'ruína',
    summary: 'Uma ameaça desperta.',
    npcs: [
      { id: 'npc-1', name: 'Marta', role: 'herborista suspeita', interactions: [] },
      { id: 'npc-2', name: 'Soldier', role: 'Soldier', interactions: [] },
      { id: 'npc-3', name: 'Órfão', role: 'coadjuvante', interactions: [] },
    ],
    secrets: [
      { id: 'secret-1', locationId: 'loc-1', text: 'A herborista esconde um pacto.' },
      { id: 'secret-2', locationId: 'loc-1', text: 'O poço está envenenado.' },
      { id: 'secret-3', locationId: 'loc-2', text: 'A Brute serve a um mestre oculto.' },
    ],
    locations: [
      { id: 'loc-1', title: 'Clareira', aspects: ['névoa'], boxedText: 'Você chega à clareira.', description: 'notas', occupants: ['npc-1'] },
      { id: 'loc-2', title: 'Ruína', aspects: [], boxedText: 'x', description: 'x', occupants: [] },
    ],
    encounters: [{ id: 'encounter-1', locationId: 'loc-2', npcIds: ['npc-2'] }],
    start: 'A jornada começa.',
    conclusion: 'A ameaça é contida.',
    followUps: ['O pacto pode ressurgir.'],
    ...overrides,
  }
}

describe('seedLedgerFromGeneratedAdventure (US-151)', () => {
  it('produz exatamente 5 entidades: 3 segredos + 2 NPCs narrativos, NPC de combate fora', () => {
    const entities = seedLedgerFromGeneratedAdventure(adventureFixture())
    expect(entities).toHaveLength(5)
    expect(entities.some((e) => e.nome === 'npc-2' || e.nome === 'Soldier')).toBe(false)
  })

  it('mapeia segredo com nome=id, revelado false, sabido publico, local da location referenciada', () => {
    const [secret1] = seedLedgerFromGeneratedAdventure(adventureFixture())
    expect(secret1).toEqual({
      nome: 'secret-1',
      tipo: 'outro',
      local: 'Clareira',
      nota: 'A herborista esconde um pacto.',
      sabido: 'publico',
      revelado: false,
      atualizadoEm: expect.any(String),
    })
  })

  it('mapeia NPC narrativo com revelado true, tipo npc, local por reverse-lookup em occupants', () => {
    const entities = seedLedgerFromGeneratedAdventure(adventureFixture())
    const marta = entities.find((e) => e.nome === 'Marta')
    expect(marta).toEqual({
      nome: 'Marta',
      tipo: 'npc',
      local: 'Clareira',
      nota: 'herborista suspeita',
      revelado: true,
      atualizadoEm: expect.any(String),
    })
  })

  it('NPC narrativo sem location associada (fora de occupants) não lança — local ausente', () => {
    const entities = seedLedgerFromGeneratedAdventure(adventureFixture())
    const orfao = entities.find((e) => e.nome === 'Órfão')
    expect(orfao).toBeDefined()
    expect(orfao?.local).toBeUndefined()
  })

  it('artefato sem segredos nem NPCs narrativos produz ledger vazio', () => {
    const entities = seedLedgerFromGeneratedAdventure(adventureFixture({
      secrets: [],
      npcs: [{ id: 'npc-2', name: 'Soldier', role: 'Soldier', interactions: [] }],
      locations: [],
      encounters: [],
    }))
    expect(entities).toEqual([])
  })
})
