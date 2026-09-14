import { describe, it, expect } from 'vitest'
import type { AdventureChallenge, AdventureEncounter, GeneratedAdventure } from '@ai-dm/shared'
import { formatEntities } from '@ai-dm/ai-engine'
import { seedLedgerFromGeneratedAdventure } from './seed-ledger'

function enc(overrides: Partial<AdventureEncounter> = {}): AdventureEncounter {
  return {
    id: 'encounter-1', locationId: 'loc-2', npcIds: ['npc-1'], type: 'combat',
    fiction: 'O bando cerca a ruína.',
    behaviors: 'Vigiam a passagem.', goal: 'Recuperar relíquia.', complications: 'Reforços chegam.',
    unlocks: 'O mapa da câmara seguinte.',
    ...overrides,
  }
}

function chal(overrides: Partial<AdventureChallenge> = {}): AdventureChallenge {
  return {
    id: 'challenge-1', locationId: 'loc-2', test: 'teste de Força (Atletismo)',
    situation: 'escalar o muro em ruínas', consequence: 'a pedra cede e você cai',
    ...overrides,
  }
}

const ENCOUNTER_1_SEGMENT = 'combat — objetivo: Recuperar relíquia.; comportamento: Vigiam a passagem.; complicação: Reforços chegam.'
const CHALLENGE_1_SEGMENT = 'desafio — teste: teste de Força (Atletismo); situação: escalar o muro em ruínas; consequência: a pedra cede e você cai'

// US-232: fixture mundo-primeiro — 2 facções, NPC narrativo com want+facção (npc-1), NPC de
// combate com role MonsterRole (npc-2, filtrado), NPC neutro sem facção nem local (npc-3).
function adventureFixture(overrides: Partial<GeneratedAdventure> = {}): GeneratedAdventure {
  return {
    id: 'char-1:1',
    levelRange: { min: 5, max: 5 },
    registry: { tone: 'heroico', setting: 'fantasy', areaType: 'wilderness' },
    summary: 'Uma ameaça desperta.',
    world: { name: 'Vhel-Toran', description: 'Cidade entre costelas.' },
    story: 'Facções disputam a ruína.',
    factions: [
      { id: 'faction-1', name: 'Guardiões', kind: 'ordem', want: 'selar a ruína' },
      { id: 'faction-2', name: 'Sindicato', kind: 'submundo', want: 'saquear a ruína' },
    ],
    npcs: [
      { id: 'npc-1', name: 'Marta', role: 'herborista suspeita', want: 'proteger o bosque', factionId: 'faction-1' },
      { id: 'npc-2', name: 'Soldier', role: 'Soldier', want: 'obedecer ordens' },
      { id: 'npc-3', name: 'Órfão', role: 'coadjuvante', want: 'apenas sobreviver' },
    ],
    locations: [
      { id: 'loc-1', title: 'Clareira', aspects: ['névoa'], boxedText: 'Você chega à clareira.', description: 'notas', occupants: ['npc-1'], vibe: 'combat' },
      { id: 'loc-2', title: 'Ruína', aspects: [], boxedText: 'x', description: 'x', occupants: [], vibe: 'skill' },
    ],
    challenges: [chal()],
    encounters: [enc()],
    start: 'A jornada começa.',
    objective: { description: 'Impedir o saque da ruína.', reward: { name: 'Selo', effect: 'sela portais' }, locationId: 'loc-1' },
    branchedResolution: [{ choice: 'Selar', consequence: 'os nomes calam' }],
    followUps: ['O pacto pode ressurgir.'],
    ...overrides,
  }
}

describe('seedLedgerFromGeneratedAdventure (US-232)', () => {
  // US-232 AC: factionEntities — 1 por facção, tipo 'faccao', revelado false.
  it('semeia 1 entidade por facção (tipo faccao, revelado false, nota kind+want)', () => {
    const entities = seedLedgerFromGeneratedAdventure(adventureFixture())
    const factions = entities.filter((e) => e.tipo === 'faccao')
    expect(factions).toHaveLength(2)
    expect(factions[0]).toEqual({
      nome: 'Guardiões',
      tipo: 'faccao',
      nota: 'ordem — quer: selar a ruína',
      revelado: false,
      atualizadoEm: expect.any(String),
    })
  })

  // US-232 AC: npcEntities.nota inclui want + nome da facção quando factionId presente.
  it('NPC narrativo carrega want e nome da facção na nota, local por occupants, revelado false', () => {
    const marta = seedLedgerFromGeneratedAdventure(adventureFixture()).find((e) => e.nome === 'Marta')
    expect(marta).toEqual({
      nome: 'Marta',
      tipo: 'npc',
      local: 'Clareira',
      nota: 'herborista suspeita — Quer: proteger o bosque — Facção: Guardiões',
      revelado: false,
      atualizadoEm: expect.any(String),
    })
  })

  it('NPC neutro (sem factionId) não cita facção na nota; sem occupants, local ausente', () => {
    const orfao = seedLedgerFromGeneratedAdventure(adventureFixture()).find((e) => e.nome === 'Órfão')
    expect(orfao).toEqual({
      nome: 'Órfão',
      tipo: 'npc',
      local: undefined,
      nota: 'coadjuvante — Quer: apenas sobreviver',
      revelado: false,
      atualizadoEm: expect.any(String),
    })
  })

  it('NPC de combate (role em MONSTER_ROLE_CR) é filtrado de npcEntities', () => {
    const entities = seedLedgerFromGeneratedAdventure(adventureFixture())
    expect(entities.some((e) => e.nome === 'Soldier')).toBe(false)
  })

  it('formatEntities renderiza NPC narrativo com ⚠ OCULTO antes da apresentação', () => {
    const block = formatEntities(seedLedgerFromGeneratedAdventure(adventureFixture()))
    expect(block).toContain('Marta — ⚠ OCULTO')
  })

  // US-232 AC: locationEntities.nota inclui segmento de challenges[] (mesmo padrão de encounters).
  it('local que hospeda encontro E desafio soma os dois segmentos à nota, separados por " | "', () => {
    const ruina = seedLedgerFromGeneratedAdventure(adventureFixture()).find((e) => e.nome === 'Ruína')
    expect(ruina).toEqual({
      nome: 'Ruína',
      tipo: 'local',
      nota: `x | ${ENCOUNTER_1_SEGMENT} | ${CHALLENGE_1_SEGMENT}`,
      revelado: false,
      atualizadoEm: expect.any(String),
    })
  })

  it('local sem encontro nem desafio: nota só boxedText + aspects', () => {
    const clareira = seedLedgerFromGeneratedAdventure(adventureFixture()).find((e) => e.nome === 'Clareira')
    expect(clareira?.nota).toBe('Você chega à clareira. — névoa')
  })

  it('não semeia mais entradas de antagonista nem de segredo (saíram do artefato)', () => {
    const entities = seedLedgerFromGeneratedAdventure(adventureFixture())
    expect(entities.some((e) => e.tipo === 'outro')).toBe(false)
    expect(entities.every((e) => e.revelado === false)).toBe(true)
  })
})
