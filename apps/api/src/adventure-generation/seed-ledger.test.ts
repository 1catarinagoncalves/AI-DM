import { describe, it, expect } from 'vitest'
import type { AdventureEncounter, GeneratedAdventure } from '@ai-dm/shared'
import { seedLedgerFromGeneratedAdventure } from './seed-ledger'

// US-166: encontro completo ganhou type/behaviors/goal/complications obrigatórios.
function enc(overrides: Partial<AdventureEncounter> = {}): AdventureEncounter {
  return {
    id: 'encounter-1', locationId: 'loc-2', npcIds: ['npc-2'], type: 'combat',
    behaviors: 'Vigiam a passagem.', goal: 'Recuperar relíquia.', complications: 'Reforços chegam em 2 rounds.',
    ...overrides,
  }
}

const ENCOUNTER_1_NOTA_SEGMENT = 'combat — objetivo: Recuperar relíquia.; comportamento: Vigiam a passagem.; complicação: Reforços chegam em 2 rounds.'

// US-151: fixture com 3 segredos, 2 NPCs narrativos (npc-1, npc-3) e 1 NPC de combate
// (npc-2, role 'Soldier') — o critério de aceite pede exatamente esta composição.
// npc-3 não ocupa nenhum local (testa "sem location associada não quebra").
function adventureFixture(overrides: Partial<GeneratedAdventure> = {}): GeneratedAdventure {
  return {
    id: 'char-1:1',
    levelRange: { min: 5, max: 5 },
    registry: { tone: 'heroico', setting: 'fantasy', areaType: 'wilderness' },
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
    encounters: [enc()],
    start: 'A jornada começa.',
    conclusion: 'A ameaça é contida.',
    followUps: ['O pacto pode ressurgir.'],
    antagonist: { name: 'Malvora', want: 'poder sobre a região', method: 'reunir um exército', trait: 'fala em sussurros', weakness: 'vaidade', connection: 'já cruzou caminho com o grupo antes' },
    ...overrides,
  }
}

describe('seedLedgerFromGeneratedAdventure (US-151)', () => {
  it('produz exatamente 8 entidades: 3 segredos + 2 NPCs narrativos + 2 locais + 1 combatente de encontro', () => {
    const entities = seedLedgerFromGeneratedAdventure(adventureFixture())
    expect(entities).toHaveLength(8)
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

  it('mapeia local sem encontro com tipo local, revelado false, nota só boxedText+aspects', () => {
    const [, , , , , clareira] = seedLedgerFromGeneratedAdventure(adventureFixture())
    expect(clareira).toEqual({
      nome: 'Clareira',
      tipo: 'local',
      nota: 'Você chega à clareira. — névoa',
      revelado: false,
      atualizadoEm: expect.any(String),
    })
  })

  // US-166: Ruína (loc-2) hospeda encounter-1 — a nota ganha o segmento de situação
  // (type/objetivo/comportamento/complicação) além do boxedText (sem aspects, aqui vazio).
  it('local que hospeda um encontro tem a nota com boxedText + segmento de situação, separados por " | "', () => {
    const entities = seedLedgerFromGeneratedAdventure(adventureFixture())
    const ruina = entities.find((e) => e.nome === 'Ruína')
    expect(ruina).toEqual({
      nome: 'Ruína',
      tipo: 'local',
      nota: `x | ${ENCOUNTER_1_NOTA_SEGMENT}`,
      revelado: false,
      atualizadoEm: expect.any(String),
    })
    expect(ruina?.local).toBeUndefined()
  })

  it('dois encontros no mesmo local: segmentos concatenados com " | ", um por encontro', () => {
    const entities = seedLedgerFromGeneratedAdventure(adventureFixture({
      encounters: [
        enc({ id: 'encounter-1', locationId: 'loc-2', npcIds: ['npc-2'] }),
        enc({ id: 'encounter-2', locationId: 'loc-2', npcIds: [], type: 'skill', behaviors: 'Estuda runas.', goal: 'Decifrar o selo.', complications: 'O chão cede.' }),
      ],
    }))
    const ruina = entities.find((e) => e.nome === 'Ruína')
    expect(ruina?.nota).toBe(
      `x | ${ENCOUNTER_1_NOTA_SEGMENT} | skill — objetivo: Decifrar o selo.; comportamento: Estuda runas.; complicação: O chão cede.`,
    )
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

describe('seedLedgerFromGeneratedAdventure — combatentes de encontro (US-171/US-166)', () => {
  it('mapeia combatente de encontro com tipo npc, local do encontro, nota=role, revelado false', () => {
    const entities = seedLedgerFromGeneratedAdventure(adventureFixture())
    const soldier = entities.find((e) => e.nome === 'Soldier (npc-2)')
    expect(soldier).toEqual({
      nome: 'Soldier (npc-2)',
      tipo: 'npc',
      local: 'Ruína', // loc-2, o local do encounter-1
      nota: 'Soldier',
      revelado: false,
      atualizadoEm: expect.any(String),
    })
  })

  it('papel repetido no mesmo encontro gera nomes ÚNICOS (id desambigua)', () => {
    const entities = seedLedgerFromGeneratedAdventure(adventureFixture({
      npcs: [
        { id: 'npc-1', name: 'Marta', role: 'herborista suspeita', interactions: [] },
        { id: 'npc-2', name: 'Soldier', role: 'Soldier', interactions: [] },
        { id: 'npc-4', name: 'Soldier', role: 'Soldier', interactions: [] },
      ],
      encounters: [enc({ npcIds: ['npc-2', 'npc-4'] })],
    }))
    const soldiers = entities.filter((e) => e.nota === 'Soldier')
    expect(soldiers).toHaveLength(2)
    expect(new Set(soldiers.map((e) => e.nome)).size).toBe(2)
  })

  it('funciona para N encontros sem mudança — itera adventure.encounters genericamente', () => {
    const entities = seedLedgerFromGeneratedAdventure(adventureFixture({
      npcs: [
        { id: 'npc-1', name: 'Marta', role: 'herborista suspeita', interactions: [] },
        { id: 'npc-2', name: 'Soldier', role: 'Soldier', interactions: [] },
        { id: 'npc-4', name: 'Brute', role: 'Brute', interactions: [] },
      ],
      encounters: [
        enc({ id: 'encounter-1', locationId: 'loc-2', npcIds: ['npc-2'] }),
        enc({ id: 'encounter-2', locationId: 'loc-1', npcIds: ['npc-4'] }),
      ],
    }))
    const brute = entities.find((e) => e.nota === 'Brute')
    expect(brute?.local).toBe('Clareira') // loc-1, o local do encounter-2
    expect(entities.filter((e) => e.tipo === 'npc' && (e.nota === 'Soldier' || e.nota === 'Brute'))).toHaveLength(2)
  })

  it('encounters vazio não gera combatente algum', () => {
    const entities = seedLedgerFromGeneratedAdventure(adventureFixture({ encounters: [] }))
    expect(entities.some((e) => e.nota === 'Soldier')).toBe(false)
  })

  // US-166: só type 'combat' vira ameaça no ledger — social/skill nunca duplicam NPC ali
  // (o NPC social já entra via npcEntities/occupants, não via encounterNpcEntities).
  it('encontro type "social"/"skill" NÃO gera combatente no ledger, mesmo com npcIds não vazio', () => {
    const entities = seedLedgerFromGeneratedAdventure(adventureFixture({
      npcs: [
        { id: 'npc-1', name: 'Marta', role: 'herborista suspeita', interactions: [] },
        { id: 'npc-2', name: 'Soldier', role: 'Soldier', interactions: [] },
      ],
      encounters: [
        enc({ id: 'encounter-1', locationId: 'loc-1', npcIds: ['npc-1'], type: 'social' }),
        enc({ id: 'encounter-2', locationId: 'loc-1', npcIds: [], type: 'skill' }),
      ],
    }))
    expect(entities.some((e) => e.nome.startsWith('Soldier ('))).toBe(false)
    expect(entities.some((e) => e.nome.startsWith('Marta ('))).toBe(false)
  })
})
