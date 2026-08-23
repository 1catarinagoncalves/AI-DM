import { describe, it, expect, vi, afterEach } from 'vitest'
import type { AdventureEncounter, GeneratedAdventure } from '@ai-dm/shared'
import { runAdventureGate, generateWithGate } from './adventure-gate'

// US-166: encontro completo ganhou type/behaviors/goal/complications obrigatórios —
// helper centraliza os 4 campos padrão (`type: 'combat'`, o caso mais comum neste ficheiro)
// pra cada teste só sobrescrever o que importa pra ele (id/locationId/npcIds/type).
function enc(overrides: Partial<AdventureEncounter> = {}): AdventureEncounter {
  return {
    id: 'encounter-1', locationId: 'loc-1', npcIds: [], type: 'combat',
    behaviors: 'Vigiam a entrada.', goal: 'Recuperar o item roubado.', complications: 'Reforços a caminho.',
    ...overrides,
  }
}

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
    encounters: [enc({ npcIds: ['npc-2'] })],
    start: 'A jornada começa.',
    objective: 'Impedir que Malvora reúna um exército para tomar a região.',
    conclusion: 'A ameaça é contida.',
    followUps: ['O pacto pode ressurgir.'],
    antagonist: { name: 'Malvora', want: 'poder sobre a região', method: 'reunir um exército', trait: 'fala em sussurros', weakness: 'vaidade', connection: 'já cruzou caminho com o grupo antes', npcId: 'npc-2' },
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
    const broken = validAdventure({ encounters: [enc({ npcIds: ['npc-999'] })] })
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
      encounters: [enc({ npcIds: ['npc-2', 'npc-3', 'npc-4'] })],
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
      encounters: [enc({ npcIds: ['npc-2'] })],
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
      encounters: [enc({ npcIds: ['npc-2'] })],
    })
    expect(runAdventureGate(adventure).ok).toBe(true)
  })

  it('NPCs narrativos (role fora de MONSTER_ROLE_CR) não entram na soma de CR', () => {
    const adventure = validAdventure({
      levelRange: { min: 1, max: 1 },
      encounters: [enc({ npcIds: ['npc-1'] })], // npc-1 é narrativo
      npcs: [{ id: 'npc-1', name: 'Marta', role: 'herborista suspeita', interactions: [] }],
    })
    expect(runAdventureGate(adventure).ok).toBe(true)
  })

  // US-166: encontro `skill`/`social` nunca tem role de MONSTER_ROLE_CR em npcIds na prática,
  // mas o filtro por `type` na verificação 3 é explícito — este teste prova que MESMO um
  // encontro `social` com um npcId que (por bug) resolvesse pra um role de monstro não seria
  // barrado por orçamento: só `combat` é checado.
  it('encontro type "social" nunca reprova por orçamento, mesmo com role de monstro em npcIds', () => {
    const adventure = validAdventure({
      levelRange: { min: 1, max: 1 }, // encounterDeadlyThreshold(1) = 0
      npcs: [
        { id: 'npc-1', name: 'Marta', role: 'herborista suspeita', interactions: [] },
        { id: 'npc-2', name: 'Brute', role: 'Brute', interactions: [] },
      ],
      locations: [{ id: 'loc-1', title: 'Clareira', aspects: [], boxedText: 'x', description: 'x', occupants: ['npc-1'] }],
      encounters: [enc({ type: 'social', npcIds: ['npc-1', 'npc-2'] })],
    })
    expect(runAdventureGate(adventure).ok).toBe(true)
  })

  // US-167: sem o segundo argumento, verificação 3 sempre validava contra encounterDeadlyThreshold
  // (bug pré-existente — nunca soube do dial de challenge da US-161). Mesma composição de nível 1
  // que composeEncounterRoles('challenge') realmente produz (Soldier + 3 Minions, soma 0.875,
  // ver monster-roles.test.ts): rejeitada em modo 'adventure' (limiar 0), aceita em 'challenge'
  // (singleMonsterCrCap(1) = 1).
  it('challenge "challenge" no nível 1: soma 0.875 passa contra singleMonsterCrCap, não encounterDeadlyThreshold (US-167)', () => {
    const adventure = validAdventure({
      levelRange: { min: 1, max: 1 },
      npcs: [
        { id: 'npc-2', name: 'Soldier', role: 'Soldier', interactions: [] },
        { id: 'npc-3', name: 'Minion', role: 'Minion', interactions: [] },
        { id: 'npc-4', name: 'Minion', role: 'Minion', interactions: [] },
        { id: 'npc-5', name: 'Minion', role: 'Minion', interactions: [] },
      ],
      locations: [{ id: 'loc-1', title: 'Clareira', aspects: [], boxedText: 'x', description: 'x', occupants: [] }],
      encounters: [enc({ npcIds: ['npc-2', 'npc-3', 'npc-4', 'npc-5'] })],
    })

    expect(runAdventureGate(adventure).ok).toBe(false) // default 'adventure': limiar 0, sem regressão
    expect(runAdventureGate(adventure, 'challenge').ok).toBe(true)
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
      encounters: [enc({ npcIds: ['npc-2', 'npc-3', 'npc-4'] })],
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

  // US-167: terceiro parâmetro de generateWithGate chega até checkEncounterBudget — mesma
  // fixture do teste acima de runAdventureGate, agora fim a fim pelo reseed loop.
  it('challenge repassado a runAdventureGate: encontro nível 1 que falharia em modo adventure passa em modo challenge', async () => {
    const adventure = validAdventure({
      levelRange: { min: 1, max: 1 },
      npcs: [
        { id: 'npc-2', name: 'Soldier', role: 'Soldier', interactions: [] },
        { id: 'npc-3', name: 'Minion', role: 'Minion', interactions: [] },
        { id: 'npc-4', name: 'Minion', role: 'Minion', interactions: [] },
        { id: 'npc-5', name: 'Minion', role: 'Minion', interactions: [] },
      ],
      locations: [{ id: 'loc-1', title: 'Clareira', aspects: [], boxedText: 'x', description: 'x', occupants: [] }],
      encounters: [enc({ npcIds: ['npc-2', 'npc-3', 'npc-4', 'npc-5'] })],
    })
    const generate = vi.fn(async () => adventure)

    const result = await generateWithGate(generate, 3, 'challenge')

    expect(result.ok).toBe(true)
    expect(generate).toHaveBeenCalledTimes(1)
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
