import { describe, it, expect, vi, afterEach } from 'vitest'
import type { AdventureEncounter, AdventureNpc, GeneratedAdventure } from '@ai-dm/shared'
import { runAdventureGate, generateWithGate } from './adventure-gate'

function enc(overrides: Partial<AdventureEncounter> = {}): AdventureEncounter {
  return {
    id: 'encounter-1', locationId: 'loc-1', npcIds: [], type: 'combat',
    fiction: 'O bando cerca a clareira.',
    behaviors: 'Vigiam a entrada.', goal: 'Recuperar o item roubado.', complications: 'Reforços a caminho.',
    unlocks: 'A localização do esconderijo do chefe.',
    ...overrides,
  }
}

function npc(overrides: Partial<AdventureNpc> = {}): AdventureNpc {
  return { id: 'npc-1', name: 'Marta', role: 'herborista suspeita', want: 'proteger o bosque', ...overrides }
}

// US-232: fixture mundo-primeiro fechada. loc-1 referenciado por encounter-1 e objective; npc-1
// (narrativo) ocupa loc-1; npc-2 (Brute, CR 2) no encounter. Nível 5: encounterDeadlyThreshold=2,
// singleMonsterCrCap=7.5 — um Brute sozinho passa as duas checagens de orçamento (US-159).
function validAdventure(overrides: Partial<GeneratedAdventure> = {}): GeneratedAdventure {
  return {
    id: 'char-1:1',
    levelRange: { min: 5, max: 5 },
    registry: { tone: 'heroico', setting: 'fantasy', areaType: 'wilderness' },
    summary: 'Uma ameaça desperta.',
    world: { name: 'Vhel-Toran', description: 'Cidade entre costelas.' },
    story: 'Facções disputam a clareira.',
    factions: [{ id: 'faction-1', name: 'Guardiões', kind: 'ordem', want: 'selar a clareira' }],
    npcs: [
      npc(),
      { id: 'npc-2', name: 'Brute', role: 'Brute', combatRole: 'Brute', want: 'esmagar' },
    ],
    locations: [
      { id: 'loc-1', title: 'Clareira', aspects: ['névoa'], boxedText: 'Você chega à clareira.', description: 'notas', occupants: ['npc-1'], vibe: 'combat' },
    ],
    challenges: [],
    encounters: [enc({ npcIds: ['npc-2'] })],
    start: 'A jornada começa.',
    objective: { description: 'Impedir o saque da clareira.', reward: { name: 'Selo', effect: 'sela portais' }, locationId: 'loc-1' },
    branchedResolution: [{ choice: 'Selar', consequence: 'os nomes calam' }],
    followUps: ['O pacto pode ressurgir.'],
    ...overrides,
  }
}

describe('runAdventureGate (US-232)', () => {
  it('fixture válida passa nas verificações', () => {
    expect(runAdventureGate(validAdventure()).ok).toBe(true)
  })

  it('schema inválido (campo obrigatório vazio) falha na verificação 1, antes das outras', () => {
    const broken = { ...validAdventure(), summary: '' }
    const result = runAdventureGate(broken)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.stage).toBe('parse')
  })

  it('challenge.locationId aponta para local inexistente → falha na verificação 2', () => {
    const broken = validAdventure({ challenges: [{ id: 'challenge-1', locationId: 'loc-999', test: 'x', situation: 'x', consequence: 'x' }] })
    const result = runAdventureGate(broken)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.stage).toBe('graph')
      expect(result.reason).toContain('loc-999')
    }
  })

  it('objective.locationId inexistente → falha na verificação 2', () => {
    const broken = validAdventure({ objective: { description: 'x', reward: { name: 'x', effect: 'x' }, locationId: 'loc-999' } })
    const result = runAdventureGate(broken)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain('loc-999')
  })

  it('encounter.npcIds aponta para npc inexistente → falha na verificação 2', () => {
    const broken = validAdventure({ encounters: [enc({ npcIds: ['npc-999'] })] })
    const result = runAdventureGate(broken)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain('npc-999')
  })

  it('location.occupants aponta para npc que não resolve → falha na verificação 2', () => {
    const broken = validAdventure({
      locations: [{ id: 'loc-1', title: 'Clareira', aspects: [], boxedText: 'x', description: 'x', occupants: ['nome nunca resolvido'], vibe: 'combat' }],
    })
    const result = runAdventureGate(broken)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain('nome nunca resolvido')
  })

  it('NPC órfão (sem encontro nem local) falha na verificação 2', () => {
    const broken = validAdventure({
      npcs: [npc(), { id: 'npc-2', name: 'Brute', role: 'Brute', combatRole: 'Brute', want: 'esmagar' }, { id: 'npc-3', name: 'Órfão', role: 'coadjuvante', want: 'sobreviver' }],
    })
    const result = runAdventureGate(broken)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.stage).toBe('graph')
      expect(result.reason).toContain('npc-3')
    }
  })

  // US-232: âncora de local agora inclui challenges/objective/occupants além de encounter.
  it('local órfão (nenhum encontro, desafio, objetivo ou morador aponta) falha na verificação 2', () => {
    const broken = validAdventure({
      locations: [
        { id: 'loc-1', title: 'Clareira', aspects: [], boxedText: 'x', description: 'x', occupants: ['npc-1'], vibe: 'combat' },
        { id: 'loc-2', title: 'Caverna esquecida', aspects: [], boxedText: 'x', description: 'x', occupants: [], vibe: 'combat' },
      ],
    })
    const result = runAdventureGate(broken)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain('loc-2')
  })

  it('local ancorado só por desafio (sem encontro) NÃO é órfão', () => {
    const adventure = validAdventure({
      locations: [
        { id: 'loc-1', title: 'Clareira', aspects: [], boxedText: 'x', description: 'x', occupants: ['npc-1'], vibe: 'combat' },
        { id: 'loc-2', title: 'Poço', aspects: [], boxedText: 'x', description: 'x', occupants: [], vibe: 'skill' },
      ],
      challenges: [{ id: 'challenge-1', locationId: 'loc-2', test: 'teste de Força', situation: 'escalar', consequence: 'cai' }],
    })
    expect(runAdventureGate(adventure).ok).toBe(true)
  })

  it('encontro superorçado (soma de CR excede o limiar) falha na verificação 3', () => {
    const broken = validAdventure({
      levelRange: { min: 8, max: 8 },
      npcs: [
        { id: 'npc-2', name: 'Brute', role: 'Brute', combatRole: 'Brute', want: 'x' },
        { id: 'npc-3', name: 'Brute', role: 'Brute', combatRole: 'Brute', want: 'x' },
        { id: 'npc-4', name: 'Brute', role: 'Brute', combatRole: 'Brute', want: 'x' },
      ],
      locations: [{ id: 'loc-1', title: 'Clareira', aspects: [], boxedText: 'x', description: 'x', occupants: [], vibe: 'combat' }],
      encounters: [enc({ npcIds: ['npc-2', 'npc-3', 'npc-4'] })],
    })
    const result = runAdventureGate(broken)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.stage).toBe('budget')
      expect(result.reason).toContain('excede limiar')
    }
  })

  it('monstro único alcança o teto (>=) falha na verificação 3', () => {
    const broken = validAdventure({
      levelRange: { min: 2, max: 2 },
      npcs: [{ id: 'npc-2', name: 'Brute', role: 'Brute', combatRole: 'Brute', want: 'x' }],
      locations: [{ id: 'loc-1', title: 'Clareira', aspects: [], boxedText: 'x', description: 'x', occupants: [], vibe: 'combat' }],
      encounters: [enc({ npcIds: ['npc-2'] })],
    })
    const result = runAdventureGate(broken)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.stage).toBe('budget')
      expect(result.reason).toContain('teto')
    }
  })

  it('NPCs narrativos (role fora de MONSTER_ROLE_CR) não entram na soma de CR', () => {
    const adventure = validAdventure({
      levelRange: { min: 1, max: 1 },
      encounters: [enc({ npcIds: ['npc-1'] })],
      npcs: [npc()],
    })
    expect(runAdventureGate(adventure).ok).toBe(true)
  })
})

describe('generateWithGate (US-150, reseed)', () => {
  afterEach(() => vi.restoreAllMocks())

  it('sucesso na 1ª tentativa: gate ok, generate chamado uma vez com attempt 0', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const generate = vi.fn(async () => validAdventure())
    const result = await generateWithGate(generate)
    expect(result.ok).toBe(true)
    expect(generate).toHaveBeenCalledTimes(1)
    expect(generate).toHaveBeenCalledWith(0)
  })

  it('verificação 1 (exceção da própria generate) re-semeia até funcionar', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const generate = vi.fn(async (attempt: number) => {
      if (attempt === 0) throw new Error('schema inválido simulado')
      return validAdventure()
    })
    const result = await generateWithGate(generate)
    expect(result.ok).toBe(true)
    expect(generate).toHaveBeenCalledTimes(2)
  })

  it('verificação 2 (grafo quebrado) re-semeia até fechar o grafo', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const orfao = validAdventure({ npcs: [...validAdventure().npcs, { id: 'npc-3', name: 'Órfão', role: 'x', want: 'x' }] })
    const generate = vi.fn(async (attempt: number) => (attempt === 0 ? orfao : validAdventure()))
    const result = await generateWithGate(generate)
    expect(result.ok).toBe(true)
    expect(generate).toHaveBeenCalledTimes(2)
  })

  it('verificação 3 (orçamento) falha IMEDIATO, sem reseed', async () => {
    const logSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const superorcado = validAdventure({
      levelRange: { min: 8, max: 8 },
      npcs: [
        { id: 'npc-2', name: 'Brute', role: 'Brute', combatRole: 'Brute', want: 'x' },
        { id: 'npc-3', name: 'Brute', role: 'Brute', combatRole: 'Brute', want: 'x' },
        { id: 'npc-4', name: 'Brute', role: 'Brute', combatRole: 'Brute', want: 'x' },
      ],
      locations: [{ id: 'loc-1', title: 'Clareira', aspects: [], boxedText: 'x', description: 'x', occupants: [], vibe: 'combat' }],
      encounters: [enc({ npcIds: ['npc-2', 'npc-3', 'npc-4'] })],
    })
    const generate = vi.fn(async () => superorcado)
    const result = await generateWithGate(generate)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.attempt).toBe(0)
      expect(result.reason).toContain('excede limiar')
    }
    expect(generate).toHaveBeenCalledTimes(1)
    expect(logSpy).toHaveBeenCalled()
  })

  it('teto de tentativas esgotado: falha registrada com o motivo da última tentativa', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const orfao = validAdventure({ npcs: [...validAdventure().npcs, { id: 'npc-3', name: 'Órfão', role: 'x', want: 'x' }] })
    const generate = vi.fn(async () => orfao)
    const result = await generateWithGate(generate, 3)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toContain('teto de 3 tentativas esgotado')
      expect(result.reason).toContain('npc-3')
      expect(result.attempt).toBe(2)
    }
    expect(generate).toHaveBeenCalledTimes(3)
  })
})
