import { describe, it, expect } from 'vitest'
import type { AdventureEncounter, AdventureLocation, WorldEntity } from '@ai-dm/shared'
import { nextUnrevealedEncounterLocation } from './next-encounter-hint'

function encounter(overrides: Partial<AdventureEncounter> = {}): AdventureEncounter {
  return {
    id: 'encounter-1', locationId: 'loc-1', npcIds: [], type: 'skill',
    behaviors: 'x', goal: 'x', complications: 'x', unlocks: 'x',
    ...overrides,
  }
}

function location(overrides: Partial<AdventureLocation> = {}): AdventureLocation {
  return { id: 'loc-1', title: 'Clareira', aspects: [], boxedText: 'x', description: 'x', occupants: [], vibe: 'combat', ...overrides }
}

function entity(overrides: Partial<WorldEntity> = {}): WorldEntity {
  return { nome: 'Clareira', tipo: 'local', revelado: false, atualizadoEm: '', ...overrides }
}

describe('nextUnrevealedEncounterLocation (US-166)', () => {
  it('devolve o encontro de menor id (acima de 1) cujo local ainda não é revelado', () => {
    const encounters = [
      encounter({ id: 'encounter-3', locationId: 'loc-3' }),
      encounter({ id: 'encounter-2', locationId: 'loc-2' }),
    ]
    const locations = [location({ id: 'loc-2', title: 'Ruína' }), location({ id: 'loc-3', title: 'Torre' })]
    const entities = [entity({ nome: 'Ruína', revelado: false }), entity({ nome: 'Torre', revelado: false })]

    const result = nextUnrevealedEncounterLocation(encounters, locations, entities)
    expect(result?.id).toBe('encounter-2')
  })

  it('local já revelado é pulado, avança pro próximo encontro não revelado', () => {
    const encounters = [
      encounter({ id: 'encounter-2', locationId: 'loc-2' }),
      encounter({ id: 'encounter-3', locationId: 'loc-3' }),
    ]
    const locations = [location({ id: 'loc-2', title: 'Ruína' }), location({ id: 'loc-3', title: 'Torre' })]
    const entities = [entity({ nome: 'Ruína', revelado: true }), entity({ nome: 'Torre', revelado: false })]

    const result = nextUnrevealedEncounterLocation(encounters, locations, entities)
    expect(result?.id).toBe('encounter-3')
  })

  it('todos os locais revelados: devolve null', () => {
    const encounters = [encounter({ id: 'encounter-2', locationId: 'loc-2' })]
    const locations = [location({ id: 'loc-2', title: 'Ruína' })]
    const entities = [entity({ nome: 'Ruína', revelado: true })]

    expect(nextUnrevealedEncounterLocation(encounters, locations, entities)).toBeNull()
  })

  it('sem entities nenhuma (ledger vazio): local sem entrada nunca conta como revelado', () => {
    const encounters = [encounter({ id: 'encounter-2', locationId: 'loc-2' })]
    const locations = [location({ id: 'loc-2', title: 'Ruína' })]

    const result = nextUnrevealedEncounterLocation(encounters, locations, [])
    expect(result?.id).toBe('encounter-2')
  })

  it('encounters vazio: devolve null', () => {
    expect(nextUnrevealedEncounterLocation([], [location()], [entity()])).toBeNull()
  })

  it('duas locations com o mesmo título contam como a mesma entidade — encontro herda o revelado dela', () => {
    // Risco documentado na US-166 (Notas de implementação): ledger é chaveado por nome/título,
    // não por id. Regressão pura: se um dia isto mudar, este teste é o primeiro a acusar.
    const encounters = [
      encounter({ id: 'encounter-2', locationId: 'loc-2' }),
      encounter({ id: 'encounter-3', locationId: 'loc-3' }),
    ]
    const locations = [location({ id: 'loc-2', title: 'Ruína' }), location({ id: 'loc-3', title: 'Ruína' })]
    const entities = [entity({ nome: 'Ruína', revelado: true })]

    expect(nextUnrevealedEncounterLocation(encounters, locations, entities)).toBeNull()
  })

  it('ordena por id numérico, não lexicográfico (encounter-2 antes de encounter-10 se existisse)', () => {
    const encounters = [
      encounter({ id: 'encounter-2', locationId: 'loc-2' }),
      encounter({ id: 'encounter-10', locationId: 'loc-10' }),
    ]
    const locations = [location({ id: 'loc-2', title: 'B' }), location({ id: 'loc-10', title: 'A' })]
    const entities: WorldEntity[] = []

    const result = nextUnrevealedEncounterLocation(encounters, locations, entities)
    expect(result?.id).toBe('encounter-2')
  })

  // US-194: encontro 1 é onde a abertura (`start`) já narra a personagem — ele nasce
  // `revelado: false` no ledger (mesmo `seedLedgerFromGeneratedAdventure` de sempre), mas
  // esta função nunca pode devolvê-lo, senão o Mestre lê "ainda não descoberto" sobre o
  // MESMO local que acabou de narrar.
  it('nunca devolve encounter-1, mesmo sendo o único não revelado', () => {
    const encounters = [
      encounter({ id: 'encounter-1', locationId: 'loc-1' }),
      encounter({ id: 'encounter-2', locationId: 'loc-2' }),
    ]
    const locations = [location({ id: 'loc-1', title: 'Clareira' }), location({ id: 'loc-2', title: 'Ruína' })]
    const entities = [entity({ nome: 'Ruína', revelado: true })] // só o encontro 1 não é revelado

    expect(nextUnrevealedEncounterLocation(encounters, locations, entities)).toBeNull()
  })

  it('ledger recém-semeado (todos os locais revelado: false): devolve encounter-2, não encounter-1', () => {
    const encounters = [
      encounter({ id: 'encounter-1', locationId: 'loc-1' }),
      encounter({ id: 'encounter-2', locationId: 'loc-2' }),
    ]
    const locations = [location({ id: 'loc-1', title: 'Clareira' }), location({ id: 'loc-2', title: 'Ruína' })]
    const entities = [entity({ nome: 'Clareira', revelado: false }), entity({ nome: 'Ruína', revelado: false })]

    const result = nextUnrevealedEncounterLocation(encounters, locations, entities)
    expect(result?.id).toBe('encounter-2')
  })
})
