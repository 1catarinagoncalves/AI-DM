import { describe, it, expect, vi, afterEach } from 'vitest'
import type { GeneratedAdventure } from '@ai-dm/shared'
import { runAdventureGate, generateWithGate } from './adventure-gate'

// Fixture fechada: loc-1 referenciado por secret-1 e encounter-1; npc-1 (narrativo) ocupa
// loc-1; npc-2 (Brute, CR 2) está no encounter. Nível 5: encounterDeadlyThreshold=2,
// singleMonsterCrCap=7.5 — um Brute sozinho (soma 2, não > 2; CR 2, não >= 7.5) passa as duas
// checagens da US-159. Ponto de partida para as variantes quebradas abaixo.
function validAdventure(overrides: Partial<GeneratedAdventure> = {}): GeneratedAdventure {
  return {
    id: 'char-1:1',
    levelRange: { min: 5, max: 5 },
    registry: { tone: 'heroico', setting: 'fantasy', areaType: 'wilderness' },
    summary: 'Uma ameaça desperta.',
    npcs: [
      { id: 'npc-1', name: 'Marta', role: 'herborista suspeita', interactions: [] },
      { id: 'npc-2', name: 'Brute', role: 'Brute', interactions: [] },
    ],
    secrets: [{ id: 'secret-1', locationId: 'loc-1', text: 'A herborista esconde um pacto.' }],
    locations: [
      { id: 'loc-1', title: 'Clareira', aspects: ['névoa'], boxedText: 'Você chega à clareira.', description: 'notas', occupants: ['npc-1'] },
    ],
    encounters: [{ id: 'encounter-1', locationId: 'loc-1', npcIds: ['npc-2'] }],
    start: 'A jornada começa.',
    conclusion: 'A ameaça é contida.',
    followUps: ['O pacto pode ressurgir.'],
    ...overrides,
  }
}

describe('runAdventureGate (US-150)', () => {
  it('fixture válida passa nas três verificações', () => {
    const result = runAdventureGate(validAdventure())
    expect(result.ok).toBe(true)
  })

  it('schema inválido (campo obrigatório vazio) falha na verificação 1, antes das outras', () => {
    const broken = { ...validAdventure(), secrets: [{ id: '', locationId: 'loc-1', text: 'x' }] }
    const result = runAdventureGate(broken)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.stage).toBe('parse')
  })

  it('secret.locationId aponta para local inexistente → falha na verificação 2 com o motivo correto', () => {
    const broken = validAdventure({ secrets: [{ id: 'secret-1', locationId: 'loc-999', text: 'x' }] })
    const result = runAdventureGate(broken)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.stage).toBe('graph')
      expect(result.reason).toContain('loc-999')
    }
  })

  it('encounter.npcIds aponta para npc inexistente → falha na verificação 2', () => {
    const broken = validAdventure({ encounters: [{ id: 'encounter-1', locationId: 'loc-1', npcIds: ['npc-999'] }] })
    const result = runAdventureGate(broken)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain('npc-999')
  })

  it('location.occupants aponta para npc que não resolveu (fallback de nome cru) → falha na verificação 2', () => {
    const broken = validAdventure({
      locations: [{ id: 'loc-1', title: 'Clareira', aspects: [], boxedText: 'x', description: 'x', occupants: ['nome nunca resolvido'] }],
    })
    const result = runAdventureGate(broken)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain('nome nunca resolvido')
  })

  it('NPC órfão (sem encontro, local ou interação apontando pra ele) falha na verificação 2', () => {
    const broken = validAdventure({
      npcs: [
        { id: 'npc-1', name: 'Marta', role: 'herborista suspeita', interactions: [] },
        { id: 'npc-2', name: 'Brute', role: 'Brute', interactions: [] },
        { id: 'npc-3', name: 'Órfão', role: 'coadjuvante', interactions: [] },
      ],
    })
    const result = runAdventureGate(broken)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.stage).toBe('graph')
      expect(result.reason).toContain('npc-3')
    }
  })

  it('local órfão (nenhum encontro ou segredo aponta pra ele) falha na verificação 2', () => {
    const broken = validAdventure({
      locations: [
        { id: 'loc-1', title: 'Clareira', aspects: [], boxedText: 'x', description: 'x', occupants: ['npc-1'] },
        { id: 'loc-2', title: 'Caverna esquecida', aspects: [], boxedText: 'x', description: 'x', occupants: [] },
      ],
    })
    const result = runAdventureGate(broken)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain('loc-2')
  })

  it('encontro superorçado (soma de CR excede o limiar) falha na verificação 3, mesmo sem nenhum monstro único no teto', () => {
    // Nível 8: encounterDeadlyThreshold=4, singleMonsterCrCap=12. 3 Brutes (CR 2 cada, soma 6)
    // excedem a soma sem NENHUM deles individualmente alcançar o teto único (2 < 12) — isola a
    // checagem de soma da checagem de monstro único (US-159, os dois testes são independentes).
    const broken = validAdventure({
      levelRange: { min: 8, max: 8 },
      npcs: [
        { id: 'npc-2', name: 'Brute', role: 'Brute', interactions: [] },
        { id: 'npc-3', name: 'Brute', role: 'Brute', interactions: [] },
        { id: 'npc-4', name: 'Brute', role: 'Brute', interactions: [] },
      ],
      locations: [{ id: 'loc-1', title: 'Clareira', aspects: [], boxedText: 'x', description: 'x', occupants: [] }],
      encounters: [{ id: 'encounter-1', locationId: 'loc-1', npcIds: ['npc-2', 'npc-3', 'npc-4'] }],
    })
    const result = runAdventureGate(broken)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.stage).toBe('budget')
      expect(result.reason).toContain('excede limiar')
    }
  })

  it('monstro único alcança o teto (>=) falha na verificação 3 com o motivo do teto único', () => {
    // Nível 2: singleMonsterCrCap(2) = 2. Brute (CR 2) ALCANÇA o teto — checagem >=, não >.
    const broken = validAdventure({
      levelRange: { min: 2, max: 2 },
      npcs: [{ id: 'npc-2', name: 'Brute', role: 'Brute', interactions: [] }],
      locations: [{ id: 'loc-1', title: 'Clareira', aspects: [], boxedText: 'x', description: 'x', occupants: [] }],
      encounters: [{ id: 'encounter-1', locationId: 'loc-1', npcIds: ['npc-2'] }],
    })
    const result = runAdventureGate(broken)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.stage).toBe('budget')
      expect(result.reason).toContain('teto')
    }
  })

  it('nível alto o bastante (8): um Brute sozinho não estoura nem soma nem teto único — controle negativo', () => {
    const adventure = validAdventure({
      levelRange: { min: 8, max: 8 }, // encounterDeadlyThreshold(8)=4, singleMonsterCrCap(8)=8
      npcs: [{ id: 'npc-2', name: 'Brute', role: 'Brute', interactions: [] }],
      locations: [{ id: 'loc-1', title: 'Clareira', aspects: [], boxedText: 'x', description: 'x', occupants: [] }],
      encounters: [{ id: 'encounter-1', locationId: 'loc-1', npcIds: ['npc-2'] }],
    })
    expect(runAdventureGate(adventure).ok).toBe(true)
  })

  it('NPCs narrativos (role fora de MONSTER_ROLE_CR) não entram na soma de CR', () => {
    const adventure = validAdventure({
      levelRange: { min: 1, max: 1 },
      encounters: [{ id: 'encounter-1', locationId: 'loc-1', npcIds: ['npc-1'] }], // npc-1 é narrativo
      npcs: [{ id: 'npc-1', name: 'Marta', role: 'herborista suspeita', interactions: [] }],
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

  it('verificação 1 (exceção da própria generate) re-semeia com attempt incrementado até funcionar', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const generate = vi.fn(async (attempt: number) => {
      if (attempt === 0) throw new Error('schema inválido simulado')
      return validAdventure()
    })

    const result = await generateWithGate(generate)

    expect(result.ok).toBe(true)
    expect(generate).toHaveBeenCalledTimes(2)
    expect(generate).toHaveBeenNthCalledWith(1, 0)
    expect(generate).toHaveBeenNthCalledWith(2, 1)
  })

  it('verificação 2 (grafo quebrado) re-semeia até um attempt fechar o grafo', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const orfao = validAdventure({ npcs: [...validAdventure().npcs, { id: 'npc-3', name: 'Órfão', role: 'x', interactions: [] }] })
    const generate = vi.fn(async (attempt: number) => (attempt === 0 ? orfao : validAdventure()))

    const result = await generateWithGate(generate)

    expect(result.ok).toBe(true)
    expect(generate).toHaveBeenCalledTimes(2)
  })

  it('verificação 3 (orçamento) falha IMEDIATO, sem reseed — generate chamado uma única vez', async () => {
    const logSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const superorcado = validAdventure({
      levelRange: { min: 8, max: 8 },
      npcs: [
        { id: 'npc-2', name: 'Brute', role: 'Brute', interactions: [] },
        { id: 'npc-3', name: 'Brute', role: 'Brute', interactions: [] },
        { id: 'npc-4', name: 'Brute', role: 'Brute', interactions: [] },
      ],
      locations: [{ id: 'loc-1', title: 'Clareira', aspects: [], boxedText: 'x', description: 'x', occupants: [] }],
      encounters: [{ id: 'encounter-1', locationId: 'loc-1', npcIds: ['npc-2', 'npc-3', 'npc-4'] }],
    })
    const generate = vi.fn(async () => superorcado)

    const result = await generateWithGate(generate)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.attempt).toBe(0)
      expect(result.reason).toContain('excede limiar')
    }
    expect(generate).toHaveBeenCalledTimes(1) // nenhuma tentativa extra gasta num bug estrutural
    expect(logSpy).toHaveBeenCalled() // falha registrada (US-120)
  })

  it('teto de tentativas esgotado: falha registrada com o motivo da última tentativa, sem travar', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const orfao = validAdventure({ npcs: [...validAdventure().npcs, { id: 'npc-3', name: 'Órfão', role: 'x', interactions: [] }] })
    const generate = vi.fn(async () => orfao) // nunca fecha o grafo

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
