import { describe, it, expect } from 'vitest'
import type { AdventureEncounter, GeneratedAdventure } from '@ai-dm/shared'
import { formatEntities, mergeEntities } from '@ai-dm/ai-engine'
import { seedLedgerFromGeneratedAdventure } from './seed-ledger'

// US-166: encontro completo ganhou type/behaviors/goal/complications obrigatórios.
function enc(overrides: Partial<AdventureEncounter> = {}): AdventureEncounter {
  return {
    id: 'encounter-1', locationId: 'loc-2', npcIds: ['npc-2'], type: 'combat',
    behaviors: 'Vigiam a passagem.', goal: 'Recuperar relíquia.', complications: 'Reforços chegam em 2 rounds.',
    unlocks: 'O mapa da câmara seguinte.',
    ...overrides,
  }
}

const ENCOUNTER_1_NOTA_SEGMENT = 'combat — objetivo: Recuperar relíquia.; comportamento: Vigiam a passagem.; complicação: Reforços chegam em 2 rounds.'

// US-151: fixture com 3 segredos, 2 NPCs narrativos (npc-1, npc-3) e 1 NPC de combate
// (npc-2, role 'Soldier') — o critério de aceite pede exatamente esta composição.
// npc-3 não ocupa nenhum local (testa "sem location associada não quebra").
// US-189: campos fixos do antagonista, reusados nos testes que não são SOBRE ele —
// `npcId` varia por teste (fixture default usa npc-2, colidindo de propósito com o
// Soldier de combate; testes que só querem exercitar combatente genérico apontam pra
// um id inexistente, pra não disparar a exclusão).
const ANTAGONIST_BASE = {
  name: 'Malvora', want: 'poder sobre a região', method: 'reunir um exército',
  trait: 'fala em sussurros', weakness: 'vaidade', connection: 'já cruzou caminho com o grupo antes',
}

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
      { id: 'loc-1', title: 'Clareira', aspects: ['névoa'], boxedText: 'Você chega à clareira.', description: 'notas', occupants: ['npc-1'], vibe: 'combat' },
      { id: 'loc-2', title: 'Ruína', aspects: [], boxedText: 'x', description: 'x', occupants: [], vibe: 'skill' },
    ],
    encounters: [enc()],
    start: 'A jornada começa.',
    objective: 'Impedir que Malvora reúna um exército para tomar a região.',
    conclusion: 'A ameaça é contida.',
    followUps: ['O pacto pode ressurgir.'],
    antagonist: { ...ANTAGONIST_BASE, npcId: 'npc-2' },
    ...overrides,
  }
}

describe('seedLedgerFromGeneratedAdventure (US-151)', () => {
  // US-189/US-191: npc-2 (Soldier) é o antagonist.npcId da fixture default — some de
  // encounterNpcEntities (é o antagonista, não um capanga) e vira DUAS entradas Malvora no
  // lugar (pública/oculta, US-191), somando 9.
  it('produz exatamente 9 entidades: 3 segredos + 2 NPCs narrativos + 2 locais + 2 antagonista (pública/oculta)', () => {
    const entities = seedLedgerFromGeneratedAdventure(adventureFixture())
    expect(entities).toHaveLength(9)
    expect(entities.some((e) => e.nome === 'npc-2' || e.nome === 'Soldier')).toBe(false)
    expect(entities.filter((e) => e.nome === 'Malvora')).toHaveLength(2)
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

  // Bug: personagem sabia o nome de um NPC nunca encontrado/apresentado na ficção — o
  // Mestre lia o nome do ledger e narrava de graça. Fix: mesmo mecanismo `⚠ OCULTO` já
  // usado por segredo/local/ameaça/antagonista (US-199) agora cobre NPC narrativo também.
  it('mapeia NPC narrativo com revelado false (⚠ OCULTO até a ficção apresentar), tipo npc, local por reverse-lookup em occupants', () => {
    const entities = seedLedgerFromGeneratedAdventure(adventureFixture())
    const marta = entities.find((e) => e.nome === 'Marta')
    expect(marta).toEqual({
      nome: 'Marta',
      tipo: 'npc',
      local: 'Clareira',
      nota: 'herborista suspeita',
      revelado: false,
      atualizadoEm: expect.any(String),
    })
  })

  it('formatEntities renderiza a linha de NPC narrativo com ⚠ OCULTO antes de qualquer apresentação na ficção', () => {
    const block = formatEntities(seedLedgerFromGeneratedAdventure(adventureFixture()))
    expect(block).toContain('Marta — ⚠ OCULTO')
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
    // US-189: antagonist.npcId movido pra fora de npc-2 — este teste é sobre capanga
    // genérico, não sobre o antagonista (testado em bloco próprio abaixo).
    const entities = seedLedgerFromGeneratedAdventure(adventureFixture({ antagonist: { ...ANTAGONIST_BASE, npcId: 'npc-none' } }))
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
      antagonist: { ...ANTAGONIST_BASE, npcId: 'npc-none' },
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
      antagonist: { ...ANTAGONIST_BASE, npcId: 'npc-none' },
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

describe('seedLedgerFromGeneratedAdventure — antagonista no ledger (US-189/US-191, revelado:false desde US-199)', () => {
  it('antagonist.npcId com role MonsterRole (nível médio/alto): 2 entradas OCULTAS (pública primeiro no array), sem duplicata em npcEntities/encounterNpcEntities', () => {
    const entities = seedLedgerFromGeneratedAdventure(adventureFixture())
    const malvoraIndexes = entities.reduce<number[]>((acc, e, i) => (e.nome === 'Malvora' ? [...acc, i] : acc), [])
    expect(malvoraIndexes).toHaveLength(2)
    const [publicaIdx, ocultaIdx] = malvoraIndexes
    // US-199: mergeEntities patcheia a PRIMEIRA ocorrência — a ordem do array é o
    // mecanismo de revelação (recordEntity promove a pública, não a oculta).
    expect(publicaIdx!).toBeLessThan(ocultaIdx!)

    const publica = entities[publicaIdx!]
    expect(publica).toEqual({
      nome: 'Malvora',
      tipo: 'npc',
      local: 'Ruína', // loc-2, local do encontro final (encounter-1, único encontro da fixture)
      revelado: false,
      atualizadoEm: expect.any(String),
    })

    const oculta = entities[ocultaIdx!]
    expect(oculta).toEqual({
      nome: 'Malvora',
      tipo: 'npc',
      local: 'Ruína',
      nota: 'Quer: poder sobre a região — Método: reunir um exército — Traço: fala em sussurros — Fraqueza: vaidade — Conexão: já cruzou caminho com o grupo antes',
      revelado: false,
      atualizadoEm: expect.any(String),
    })

    expect(entities.some((e) => e.nome === 'Soldier (npc-2)')).toBe(false)
  })

  // Achado de review (Notas de implementação): se a exclusão só rodasse quando
  // `antagonistNpc.role in MONSTER_ROLE_CR`, este caso (nível 1-3/'adventure',
  // `chooseAntagonistRole` devolve undefined, role vira `antagonist.trait` texto livre)
  // passaria batido no filtro de `role` de npcEntities e vazaria com `revelado: true`.
  it('antagonist.npcId com role livre = antagonist.trait (nível 1-3/adventure): mesma exclusão, sem vazar em npcEntities', () => {
    const entities = seedLedgerFromGeneratedAdventure(adventureFixture({
      npcs: [
        { id: 'npc-1', name: 'Marta', role: 'herborista suspeita', interactions: [] },
        { id: 'npc-2', name: 'Malvora', role: 'fala em sussurros', interactions: [] },
        { id: 'npc-3', name: 'Órfão', role: 'coadjuvante', interactions: [] },
      ],
    }))
    const malvora = entities.filter((e) => e.nome === 'Malvora')
    expect(malvora).toHaveLength(2)
    expect(malvora.filter((e) => e.revelado === false)).toHaveLength(2)
  })

  it('encounters vazio: ledger sem entrada do antagonista, sem lançar', () => {
    const entities = seedLedgerFromGeneratedAdventure(adventureFixture({ encounters: [] }))
    expect(entities.some((e) => e.nome === 'Malvora')).toBe(false)
  })

  // US-199: critério de aceite — ledger recém-semeado não tem NENHUMA entrada do
  // antagonista com revelado:true (o Mestre não recebe o vilão de graça no turno 1).
  it('nenhuma entrada do antagonista nasce revelado:true', () => {
    const entities = seedLedgerFromGeneratedAdventure(adventureFixture())
    expect(entities.filter((e) => e.nome === 'Malvora').every((e) => e.revelado === false)).toBe(true)
  })

  // US-199: critério de aceite — o bloco `## Registro de entidades` do turno 1
  // renderiza a linha pública do antagonista com o marcador `⚠ OCULTO`.
  it('formatEntities renderiza a linha pública do antagonista com ⚠ OCULTO', () => {
    const block = formatEntities(seedLedgerFromGeneratedAdventure(adventureFixture()))
    expect(block).toContain('Malvora — ⚠ OCULTO')
  })

  // US-199: critério de aceite — recordEntity({nome, revelado:true}) promove só a
  // PRIMEIRA ocorrência (a pública, US-191); a oculta e seu `nota` (want/method/trait/
  // weakness/connection) ficam intocados. Regressão da ordem do `return`.
  it('recordEntity({ nome, revelado: true }) promove a pública e deixa a oculta intacta', () => {
    const seeded = seedLedgerFromGeneratedAdventure(adventureFixture())
    const promoted = mergeEntities(seeded, [{ nome: 'Malvora', revelado: true }])
    const malvora = promoted.filter((e) => e.nome === 'Malvora')
    expect(malvora).toHaveLength(2)
    expect(malvora[0]).toMatchObject({ revelado: true })
    expect(malvora[0]!.nota).toBeUndefined()
    expect(malvora[1]).toMatchObject({ revelado: false })
    expect(malvora[1]!.nota).toBe('Quer: poder sobre a região — Método: reunir um exército — Traço: fala em sussurros — Fraqueza: vaidade — Conexão: já cruzou caminho com o grupo antes')
  })
})
