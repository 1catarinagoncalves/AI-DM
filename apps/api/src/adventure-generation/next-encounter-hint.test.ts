import { describe, it, expect } from 'vitest'
import type { AdventureEncounter, AdventureLocation, WorldEntity } from '@ai-dm/shared'
import { nextUnrevealedEncounterLocation } from './next-encounter-hint'

function encounter(overrides: Partial<AdventureEncounter> = {}): AdventureEncounter {
  return {
    id: 'encounter-1', locationId: 'loc-1', npcIds: [], type: 'skill',
    behaviors: 'x', goal: 'x', complications: 'x',
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
  it('devolve o encontro de menor id cujo local ainda não é revelado', () => {
    const encounters = [
      encounter({ id: 'encounter-2', locationId: 'loc-2' }),
      encounter({ id: 'encounter-1', locationId: 'loc-1' }),
    ]
    const locations = [location({ id: 'loc-1', title: 'Clareira' }), location({ id: 'loc-2', title: 'Ruína' })]
    const entities = [entity({ nome: 'Clareira', revelado: false }), entity({ nome: 'Ruína', revelado: false })]

    const result = nextUnrevealedEncounterLocation(encounters, locations, entities)
    expect(result?.id).toBe('encounter-1')
  })

  it('local já revelado é pulado, avança pro próximo encontro não revelado', () => {
    const encounters = [
      encounter({ id: 'encounter-1', locationId: 'loc-1' }),
      encounter({ id: 'encounter-2', locationId: 'loc-2' }),
    ]
    const locations = [location({ id: 'loc-1', title: 'Clareira' }), location({ id: 'loc-2', title: 'Ruína' })]
    const entities = [entity({ nome: 'Clareira', revelado: true }), entity({ nome: 'Ruína', revelado: false })]

    const result = nextUnrevealedEncounterLocation(encounters, locations, entities)
    expect(result?.id).toBe('encounter-2')
  })

  it('todos os locais revelados: devolve null', () => {
    const encounters = [encounter({ id: 'encounter-1', locationId: 'loc-1' })]
    const locations = [location({ id: 'loc-1', title: 'Clareira' })]
    const entities = [entity({ nome: 'Clareira', revelado: true })]

    expect(nextUnrevealedEncounterLocation(encounters, locations, entities)).toBeNull()
  })

  it('sem entities nenhuma (ledger vazio): local sem entrada nunca conta como revelado', () => {
    const encounters = [encounter({ id: 'encounter-1', locationId: 'loc-1' })]
    const locations = [location({ id: 'loc-1', title: 'Clareira' })]

    const result = nextUnrevealedEncounterLocation(encounters, locations, [])
    expect(result?.id).toBe('encounter-1')
  })

  it('encounters vazio: devolve null', () => {
    expect(nextUnrevealedEncounterLocation([], [location()], [entity()])).toBeNull()
  })

  it('duas locations com o mesmo título contam como a mesma entidade — encontro herda o revelado dela', () => {
    // Risco documentado na US-166 (Notas de implementação): ledger é chaveado por nome/título,
    // não por id. Regressão pura: se um dia isto mudar, este teste é o primeiro a acusar.
    const encounters = [
      encounter({ id: 'encounter-1', locationId: 'loc-1' }),
      encounter({ id: 'encounter-2', locationId: 'loc-2' }),
    ]
    const locations = [location({ id: 'loc-1', title: 'Clareira' }), location({ id: 'loc-2', title: 'Clareira' })]
    const entities = [entity({ nome: 'Clareira', revelado: true })]

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
})
