import { describe, it, expect, vi } from 'vitest'
import { GeneratedAdventureSchema, catalogLabel, type GeneratedAdventure, type Locale, type SystemConfig } from '@ai-dm/shared'
import { AdventureGenerationService, type AdventureOpeningContext, type AdventureProfile } from './adventure-generation.service'
import { authored, config, fakeAi, fakePrisma, splitAuthored } from './adventure.test-helpers'
import { NAMING_REGISTERS } from '../adventure-generation/registry-catalog'
import { composeEncounterRoles } from '../adventure-generation/monster-roles'
import { mintSlice } from '../adventure-generation/mint-adventure'
import type { AdventureSlice, AuthoredSliceRecord } from '../adventure-generation/adventure-slice'
import type { AdventureRegistryOverrides } from '../adventure-generation/roll-registry'
import type { AiService } from '../ai/ai.service'

// US-243: o dump em evals/reports/ roda no fim de toda conclusão (NODE_ENV=test do Vitest não é
// 'production') — sem este mock, cada `run` abaixo gravaria de verdade a cada `pnpm test`.
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return { ...actual, mkdirSync: vi.fn(), writeFileSync: vi.fn() }
})

// US-256: a autoria virou 1A (`generateSlice`) + 1B (`generateRestArtifact`). Esta fachada roda as duas em
// sequência, SEM gate, devolvendo o artefato completo — a forma que os testes de minting/PASSO 2
// (ex-`AdventureService.generateAdventure`) sempre exerceram. Só existe em teste: em produção as
// duas metades rodam concorrentes a narração (`run`).
function engineFacade(ai: AiService) {
  const { prisma } = fakePrisma(null)
  const generation = new AdventureGenerationService(prisma, ai)
  return {
    async generateAdventure(profile: AdventureProfile, characterId: string, order: number, locale: Locale, cfg: SystemConfig, overrides: AdventureRegistryOverrides = {}, attempt = 0) {
      const record = await generation.generateSlice(profile, characterId, order, locale, cfg, overrides, attempt)
      const className = catalogLabel(cfg.classes, profile.classKey)
      return generation.generateRestArtifact(record.slice, { challenge: record.challenge, namingRegister: record.namingRegister, locale, className })
    },
  }
}

// US-232: orquestrador — 1 chamada de autoria (fake) + montagem determinística + backstop.
describe('AdventureGenerationService — artefato completo (1A + 1B, US-232/US-256)', () => {
  const profile: AdventureProfile = { level: 3, classKey: 'wizard', background: {}, origin: {}, hookSeed: 'x', challenge: 'adventure' }

  const service = engineFacade

  it('monta um GeneratedAdventure que passa em .parse()', async () => {
    const adventure = await service(fakeAi()).generateAdventure(profile, 'char-1', 1, 'pt-BR', config)
    expect(() => GeneratedAdventureSchema.parse(adventure)).not.toThrow()
  })

  it('id/levelRange/summary/world/story/factions vêm do artefato', async () => {
    const adventure = await service(fakeAi()).generateAdventure(profile, 'char-1', 2, 'pt-BR', config)
    expect(adventure.id).toBe('char-1:2')
    expect(adventure.levelRange).toEqual({ min: 3, max: 3 })
    expect(adventure.summary).toBe('Três facções disputam a Enseada Cinzenta.')
    expect(adventure.world.name).toBe('Vhel-Toran')
    expect(adventure.factions).toHaveLength(2)
    expect(adventure.generationModel).toBe('fake/model')
    expect(adventure.restGenerationModel).toBe('fake/rest-model')
  })

  it('minta ids: faction-N, npc-N (com factionId), loc-N, challenge/encounter/objective resolvidos', async () => {
    const adventure = await service(fakeAi()).generateAdventure(profile, 'char-1', 1, 'pt-BR', config)
    expect(adventure.factions[0]!.id).toBe('faction-1')
    const marta = adventure.npcs[0]!
    expect(marta.id).toBe('npc-1')
    expect(marta.factionId).toBe('faction-1')
    expect(adventure.locations[0]!.id).toBe('loc-1')
    expect(adventure.locations[0]!.occupants).toEqual(['npc-1'])
    expect(adventure.challenges[0]!.locationId).toBe('loc-1')
    expect(adventure.encounters[0]!.locationId).toBe('loc-1')
    expect(adventure.encounters[0]!.npcIds).toEqual(['npc-1'])
    expect(adventure.objective.locationId).toBe('loc-1')
  })

  // Regressão de 18/09/2026: v4.1-flash emite `factionIndex: null` pro NPC/local neutro. `null >= 0`
  // é true em JS, então o minting indexava factions[null] e lançava — e antes disso o Zod já
  // descartava o artefato inteiro por `optional()` não aceitar null.
  it('factionIndex null (NPC/local neutro) não quebra o minting e não gera factionId', async () => {
    const base = authored()
    const neutro = authored({
      npcs: [{ ...base.npcs[0]!, factionIndex: null }],
      locations: [{ ...base.locations[0]!, factionIndex: null }],
    })
    const adventure = await service(fakeAi(null, null, {}, neutro)).generateAdventure(profile, 'char-1', 1, 'pt-BR', config)
    expect(adventure.npcs[0]!.factionId).toBeUndefined()
    expect(adventure.locations[0]!.factionId).toBeUndefined()
  })

  it('a autoria recebe factionCount em [2,4], contagens fixas, className rótulo, world label dos overrides', async () => {
    const capture: Record<string, unknown> = {}
    const configComTom: SystemConfig = { ...config, tones: [{ key: 'heroic', label: 'Heroico' }] }
    await service(fakeAi(null, null, {}, authored(), capture)).generateAdventure(profile, 'char-1', 1, 'pt-BR', configComTom, { tone: 'heroic' })
    expect(capture['factionCount']).toBeGreaterThanOrEqual(2)
    expect(capture['factionCount']).toBeLessThanOrEqual(4)
    expect(capture['counts']).toEqual({ locations: 6, npcs: 7, challenges: 3, encounters: 3 })
    expect(capture['className']).toBe('Mago')
    expect((capture['world'] as Record<string, unknown>)['tone']).toBe('Heroico')
    expect(NAMING_REGISTERS).toContain(capture['namingRegister'])
  })

  // US-250: orçamento de CR entra na autoria calculado ANTES da chamada (composeEncounterRoles),
  // não mais só checado depois no PASSO 2 — nível 3/modo 'adventure' tem orçamento SEMPRE 0
  // (US-159), então a autoria deve receber a proibição de `combat`.
  it('combatBudget chega à autoria: nível 3/modo adventure → orçamento 0 (composeEncounterRoles é a única fonte)', async () => {
    const capture: Record<string, unknown> = {}
    await service(fakeAi(null, null, {}, authored(), capture)).generateAdventure(profile, 'char-1', 1, 'pt-BR', config)
    expect(capture['combatBudget']).toEqual({ maxHostileCount: 0, viable: false })
  })

  it('combatBudget chega à autoria: nível 5+ → orçamento > 0, mesma contagem que composeEncounterRoles devolve', async () => {
    const capture: Record<string, unknown> = {}
    const highLevelProfile: AdventureProfile = { ...profile, level: 5 }
    await service(fakeAi(null, null, {}, authored(), capture)).generateAdventure(highLevelProfile, 'char-1', 1, 'pt-BR', config)
    const expectedCount = composeEncounterRoles(5, 'adventure').length
    expect(expectedCount).toBeGreaterThan(0)
    expect(capture['combatBudget']).toEqual({ maxHostileCount: expectedCount, viable: true })
  })

  // US-253: elenco nominal por SLOT de encontro chega à autoria já calculado — a ficção sabe
  // qual criatura vai lutar em cada posição ANTES de escrever (reusa chooseNominalCreature/US-252,
  // não reimplementa).
  it('combatCast chega à autoria: ausente com orçamento 0, um elenco por counts.encounters quando viável', async () => {
    const capture: Record<string, unknown> = {}
    await service(fakeAi(null, null, {}, authored(), capture)).generateAdventure(profile, 'char-1', 1, 'pt-BR', config)
    expect(capture['combatCast']).toBeUndefined()

    const capture2: Record<string, unknown> = {}
    const highLevelProfile: AdventureProfile = { ...profile, level: 5 }
    await service(fakeAi(null, null, {}, authored(), capture2)).generateAdventure(highLevelProfile, 'char-1', 1, 'pt-BR', config)
    const cast = capture2['combatCast'] as Array<Array<{ nominalCreature: string; strongerThanRest: boolean }>>
    expect(cast).toHaveLength(3) // counts.encounters
    expect(cast[0]!.length).toBeGreaterThan(0)
    expect(cast.every((slot) => slot.some((c) => c.strongerThanRest))).toBe(true)
  })

  it('combatCast: elenco da posição 0 difere do da posição 1 (bestiário tem >1 candidato por papel)', async () => {
    const capture: Record<string, unknown> = {}
    const highLevelProfile: AdventureProfile = { ...profile, level: 5 }
    await service(fakeAi(null, null, {}, authored(), capture)).generateAdventure(highLevelProfile, 'char-1', 1, 'pt-BR', config)
    const cast = capture['combatCast'] as Array<Array<{ nominalCreature: string; strongerThanRest: boolean }>>
    expect(cast.length).toBeGreaterThan(1)
    expect(cast[0]).not.toEqual(cast[1])
  })

  it('backstop: local órfão (sem encontro/desafio/objetivo/occupant) recebe um occupant', async () => {
    const twoLoc = authored({
      locations: [
        { title: 'Ancorada', aspects: [], boxedText: 'x', description: 'y', occupants: [0], vibe: 'social' },
        { title: 'Órfã', aspects: [], boxedText: 'x', description: 'y', occupants: [], vibe: 'skill' },
      ],
      npcs: [
        { name: 'Marta', role: 'herborista', want: 'w', factionIndex: 0 },
        { name: 'Bram', role: 'ferreiro', want: 'w' },
      ],
      // encounter/challenge/objective todos em loc-0 → loc-1 fica órfã até o backstop.
      challenges: [{ locationIndex: 0, test: 't', situation: 's', consequence: 'c' }],
      encounters: [{ locationIndex: 0, npcIndices: [0], type: 'social', fiction: 'f', behaviors: 'b', goal: 'g', complications: 'c', unlocks: 'u' }],
      objective: { description: 'd', reward: { name: 'r', effect: 'e' }, locationIndex: 0 },
    })
    const adventure = await service(fakeAi(null, null, {}, twoLoc)).generateAdventure(profile, 'char-1', 1, 'pt-BR', config)
    const orphan = adventure.locations.find((l) => l.title === 'Órfã')!
    expect(orphan.occupants.length).toBeGreaterThan(0)
    expect(() => GeneratedAdventureSchema.parse(adventure)).not.toThrow()
  })

  // US-242: `interactions` saiu (era a válvula de escape de checkNoOrphanNpcs) — o backstop
  // ganhou um 2º passo pra cobrir todo NPC autoral que a autoria deixou sem occupant/encontro,
  // não só os que couberam nos locais órfãos do 1º passo (fixture aqui não tem local órfão).
  it('backstop (US-242): NPC autoral fora de todo encontro/occupant original ganha occupant de algum local', async () => {
    const strandedNpc = authored({
      npcs: [
        { name: 'Marta', role: 'herborista suspeita', want: 'proteger o bosque', factionIndex: 0 },
        { name: 'Bram', role: 'ferreiro', want: 'lucrar com a maré' },
      ],
      // Bram (índice 1) não entra em occupants nem em npcIndices de nenhum encontro.
    })
    const adventure = await service(fakeAi(null, null, {}, strandedNpc)).generateAdventure(profile, 'char-1', 1, 'pt-BR', config)
    const bram = adventure.npcs.find((n) => n.name === 'Bram')!
    const referenced = new Set([...adventure.encounters.flatMap((e) => e.npcIds), ...adventure.locations.flatMap((l) => l.occupants)])
    expect(referenced.has(bram.id)).toBe(true)
    expect(() => GeneratedAdventureSchema.parse(adventure)).not.toThrow()
  })

  // Achado lendo um artefato real (Vhal'zeth, 2026-09-15): `world.anchors` citava um 6º lugar
  // que nunca virou `locations[]` — o modelo mirou `locationIndex` fora de faixa pro Final e pro
  // objective, e o clamp antigo (pro local 0) mascarava o erro sem falhar. Agora LANÇA — vira
  // estágio 'parse' no gate (US-234), que re-semeia em vez de persistir o local errado.
  it('locationIndex fora de faixa (encounter/challenge/objective) LANÇA — não clampa pro local 0', async () => {
    const foraDeFaixa = authored({ objective: { description: 'd', reward: { name: 'r', effect: 'e' }, locationIndex: 5 } })
    await expect(service(fakeAi(null, null, {}, foraDeFaixa)).generateAdventure(profile, 'char-1', 1, 'pt-BR', config))
      .rejects.toThrow('locationIndex 5 fora de faixa — esperado 0..0 (1 locais autorados)')
  })

  it('registryOverrides fixam o registro', async () => {
    const adventure = await service(fakeAi()).generateAdventure(profile, 'char-1', 1, 'pt-BR', config, { tone: 'heroic' })
    expect(adventure.registry.tone).toBe('heroic')
  })

  it('registro é determinístico por characterId+order', async () => {
    const a = await service(fakeAi()).generateAdventure(profile, 'char-1', 7, 'pt-BR', config)
    const b = await service(fakeAi()).generateAdventure(profile, 'char-1', 7, 'pt-BR', config)
    expect(a.registry).toEqual(b.registry)
  })

  // US-240: registro de nomenclatura sorteado ao lado de registry/factionCount, passado
  // pro prompt de autoria — não persiste no artefato (só influencia os nomes que saem).
  it('sorteia namingRegister e passa pro prompt de autoria', async () => {
    const capture: Record<string, unknown> = {}
    await service(fakeAi(null, null, {}, authored(), capture)).generateAdventure(profile, 'char-1', 1, 'pt-BR', config)
    expect(NAMING_REGISTERS).toContain(capture['namingRegister'])
  })

  it('encounters[].fiction presente, npc[].want não vazio', async () => {
    const adventure = await service(fakeAi()).generateAdventure(profile, 'char-1', 1, 'pt-BR', config)
    expect(adventure.encounters.every((e) => e.fiction.length > 0)).toBe(true)
    expect(adventure.npcs.every((n) => n.want.length > 0)).toBe(true)
  })

  // US-233 (PASSO 2): casa fiction com mecânica — papel de statblock por posição, sem número
  // vindo do modelo. `combatRole` só existe em NPC de encontro `combat`.
  describe('PASSO 2 — mecânica 5e determinística (US-233)', () => {
    // Nível alto o bastante (orçamento > 0, US-159) pra mostrar o ciclo posicional puro sem o
    // orçamento descartar nenhuma posição — o `profile` do describe pai (nível 3) é o caso
    // ORÇAMENTO-ZERO coberto no bugfix abaixo.
    const highBudgetProfile: AdventureProfile = { ...profile, level: 8 }

    function combatAuthored() {
      return authored({
        npcs: [
          { name: 'Chefe', role: 'bandido líder', want: 'defender o esconderijo' },
          { name: 'Capanga', role: 'bandido', want: 'sobreviver' },
          { name: 'Capanga 2', role: 'bandido', want: 'sobreviver' },
        ],
        encounters: [
          {
            locationIndex: 0, npcIndices: [0, 1, 2], type: 'combat' as const,
            fiction: 'O bando cerca a clareira.', behaviors: 'vigiam', goal: 'expulsar intrusos',
            complications: 'reforços a caminho', unlocks: 'o mapa do esconderijo',
          },
        ],
      })
    }

    it('atribui combatRole Brute→Soldier→Minion por posição em encontro combat', async () => {
      const adventure = await service(fakeAi(null, null, {}, combatAuthored())).generateAdventure(highBudgetProfile, 'char-1', 1, 'pt-BR', config)
      const [chefe, capanga1, capanga2] = adventure.encounters[0]!.npcIds.map((id) => adventure.npcs.find((n) => n.id === id)!)
      expect(chefe!.combatRole).toBe('Brute')
      expect(capanga1!.combatRole).toBe('Soldier')
      expect(capanga2!.combatRole).toBe('Minion')
    })

    // US-252: todo NPC com combatRole ganha nominalCreature (bestiário SRD) na mesma passada.
    it('atribui nominalCreature a todo NPC que recebe combatRole', async () => {
      const adventure = await service(fakeAi(null, null, {}, combatAuthored())).generateAdventure(highBudgetProfile, 'char-1', 1, 'pt-BR', config)
      const combatNpcs = adventure.encounters[0]!.npcIds.map((id) => adventure.npcs.find((n) => n.id === id)!)
      expect(combatNpcs.every((n) => n.combatRole && n.nominalCreature)).toBe(true)
    })

    it('não atribui combatRole a NPC de encontro social/skill', async () => {
      const adventure = await service(fakeAi()).generateAdventure(highBudgetProfile, 'char-1', 1, 'pt-BR', config)
      expect(adventure.encounters[0]!.type).toBe('social')
      expect(adventure.npcs[0]!.combatRole).toBeUndefined()
    })

    it('mesma fiction (npcIndices fixo), mesmo resultado de combatRole — determinístico, sem seed', async () => {
      const a = await service(fakeAi(null, null, {}, combatAuthored())).generateAdventure(highBudgetProfile, 'char-1', 1, 'pt-BR', config)
      const b = await service(fakeAi(null, null, {}, combatAuthored())).generateAdventure(highBudgetProfile, 'char-1', 1, 'pt-BR', config)
      expect(a.npcs.map((n) => n.combatRole)).toEqual(b.npcs.map((n) => n.combatRole))
    })

    it('resultado passa em .parse() com combatRole preenchido', async () => {
      const adventure = await service(fakeAi(null, null, {}, combatAuthored())).generateAdventure(highBudgetProfile, 'char-1', 1, 'pt-BR', config)
      expect(() => GeneratedAdventureSchema.parse(adventure)).not.toThrow()
    })

    // Bugfix (Paladina nível 3, 16/09/2026): reprodução exata do caso real — nível 3, modo
    // 'adventure' (orçamento 0, US-159), encontro combat com 3 NPCs. Antes do fix, os 3 recebiam
    // combatRole incondicional e `checkEncounterBudget` (adventure-gate.ts) rejeitava sempre,
    // esgotando as 3 tentativas de regenerate (US-234) sem chance de passar. Agora nenhuma
    // posição recebe combatRole (figurantes), mas os NPCs continuam referenciados pelo encontro
    // — não viram órfãos nem quebram `.parse()`.
    it('nível 3 modo adventure (orçamento 0): nenhum NPC recebe combatRole, mas continuam no encontro sem quebrar o gate', async () => {
      const adventure = await service(fakeAi(null, null, {}, combatAuthored())).generateAdventure(profile, 'char-1', 1, 'pt-BR', config)
      const combatNpcs = adventure.encounters[0]!.npcIds.map((id) => adventure.npcs.find((n) => n.id === id)!)
      expect(combatNpcs).toHaveLength(3)
      expect(combatNpcs.every((n) => n.combatRole === undefined)).toBe(true)
      expect(combatNpcs.every((n) => n.nominalCreature === undefined)).toBe(true)
      expect(() => GeneratedAdventureSchema.parse(adventure)).not.toThrow()
    })

    // US-253 (bugfix): antes, `chooseNominalCreature` recebia só o índice DENTRO do encontro (`i`)
    // — dois encontros combat com o mesmo papel na posição 0 (Brute) caíam no MESMO nome
    // (`chooseNominalCreature` é pura). Agora soma `slotIndex * combatBudget.maxHostileCount`,
    // mesma fórmula de `buildCombatCast` — o nome de fallback bate com o que foi prometido no
    // prompt pra CADA slot, e dois Brutes em slots diferentes não repetem elenco.
    it('dois encontros combat, mesmo papel na mesma posição → nominalCreature difere por slot', async () => {
      const twoCombats = authored({
        npcs: [
          { name: 'Chefe A', role: 'bandido líder', want: 'defender o esconderijo' },
          { name: 'Chefe B', role: 'outro bandido líder', want: 'defender o covil' },
        ],
        locations: [{ title: 'Enseada Cinzenta', aspects: [], boxedText: 'x', description: 'y', occupants: [0, 1], vibe: 'combat' as const }],
        encounters: [
          { locationIndex: 0, npcIndices: [0], type: 'combat' as const, fiction: 'a', behaviors: 'b', goal: 'g', complications: 'c', unlocks: 'u' },
          { locationIndex: 0, npcIndices: [1], type: 'combat' as const, fiction: 'a2', behaviors: 'b', goal: 'g', complications: 'c', unlocks: 'u' },
        ],
      })
      const adventure = await service(fakeAi(null, null, {}, twoCombats)).generateAdventure(highBudgetProfile, 'char-1', 1, 'pt-BR', config)
      const [chefeA, chefeB] = adventure.npcs
      expect(chefeA!.combatRole).toBe('Brute')
      expect(chefeB!.combatRole).toBe('Brute')
      expect(chefeA!.nominalCreature).not.toBe(chefeB!.nominalCreature)
    })

    // US-253: garantia de ponta a ponta — o nome que `combatCast` promete no prompt (calculado
    // com `assignBudgetedCombatRoles`, não o `assignCombatRoles` cru) é o MESMO que o PASSO 2
    // confirma depois, quando a autoria obedece a contagem MÁXIMA do orçamento. Achado ao testar
    // manualmente com tsx: em nível 8, `composeEncounterRoles` dá 7 de orçamento, mas um ciclo
    // reto Brute→Soldier→Minion de 7 estoura o orçamento em 2 posições — sem usar a MESMA função
    // budgeted dos dois lados, o prompt prometeria nome pra posição que o PASSO 2 depois deixa
    // sem `combatRole` (figurante muda, contradizendo a ficção).
    it('nome prometido em combatCast bate, em ordem, com nominalCreature confirmado pelo PASSO 2 (autoria usa a contagem MÁXIMA)', async () => {
      const capture: Record<string, unknown> = {}
      const maxCount = composeEncounterRoles(8, 'adventure').length
      const npcs = Array.from({ length: maxCount }, (_, i) => ({ name: `NPC ${i}`, role: 'combatente', want: 'lutar' }))
      const obedient = authored({
        npcs,
        locations: [{ title: 'Arena', aspects: [], boxedText: 'x', description: 'y', occupants: npcs.map((_, i) => i), vibe: 'combat' as const }],
        encounters: [{ locationIndex: 0, npcIndices: npcs.map((_, i) => i), type: 'combat' as const, fiction: 'f', behaviors: 'b', goal: 'g', complications: 'c', unlocks: 'u' }],
      })
      const adventure = await service(fakeAi(null, null, {}, obedient, capture)).generateAdventure(highBudgetProfile, 'char-1', 1, 'pt-BR', config)
      const promised = (capture['combatCast'] as Array<Array<{ nominalCreature: string }>>)[0]!
      const confirmed = adventure.npcs.map((n) => n.nominalCreature).filter((n): n is string => n !== undefined)
      expect(confirmed).toEqual(promised.map((p) => p.nominalCreature))
    })
  })
})

// US-256: gate sobre o artefato MESCLADO; reprovar regenera SÓ a 1B (a fatia liberada é imutável).
describe('AdventureGenerationService.generateGatedRest (US-256, ex-generateGatedAdventure)', () => {
  const profile: AdventureProfile = { level: 3, classKey: 'wizard', background: {}, origin: {}, hookSeed: 'x', challenge: 'adventure' }

  async function gated(ai: AiService, maxAttempts = 3) {
    const { prisma } = fakePrisma(null)
    const generation = new AdventureGenerationService(prisma, ai)
    const record = await generation.generateSlice(profile, 'char-1', 1, 'pt-BR', config)
    return generation.generateGatedRest(record.slice, { challenge: record.challenge, namingRegister: record.namingRegister, locale: 'pt-BR', className: 'Mago' }, config, maxAttempts)
  }

  it('grafo fechado: gate passa na 1ª tentativa (1A 1×, 1B 1×)', async () => {
    const ai = fakeAi()
    const sliceSpy = vi.spyOn(ai, 'generateAdventureSlice')
    const restSpy = vi.spyOn(ai, 'generateAdventureRest')
    expect((await gated(ai)).ok).toBe(true)
    expect(sliceSpy).toHaveBeenCalledTimes(1)
    expect(restSpy).toHaveBeenCalledTimes(1)
  })

  // US-242: `interactions` era a válvula de escape de checkNoOrphanNpcs — sem ela, este NPC
  // dependia do backstop (mint-adventure.ts) pra não reprovar toda tentativa. Com o 2º passo do
  // backstop, o gate agora passa de primeira.
  it('NPC órfão (nunca referenciado): backstop cobre e o gate passa na 1ª tentativa', async () => {
    const orphanNpc = authored({
      npcs: [
        { name: 'Marta', role: 'herborista', want: 'w', factionIndex: 0 },
        { name: 'Órfão', role: 'coadjuvante', want: 'w' },
      ],
    })
    const ai = fakeAi(null, null, {}, orphanNpc)
    const restSpy = vi.spyOn(ai, 'generateAdventureRest')
    expect((await gated(ai)).ok).toBe(true)
    expect(restSpy).toHaveBeenCalledTimes(1)
  })

  // US-256 (AC): gate reprovado re-executa SÓ a 1B — `generateAdventureSlice` roda 1× (na hora de
  // montar a fatia do teste, fora do gate) e `generateAdventureRest` até `maxAttempts`.
  it('gate reprovado re-executa só a 1B: fatia 1×, resto até maxAttempts', async () => {
    const badRest = authored({ challenges: [{ locationIndex: 0, test: 'Culinária', situation: 's', consequence: 'c' }] })
    const ai = fakeAi(null, null, {}, badRest)
    const sliceSpy = vi.spyOn(ai, 'generateAdventureSlice')
    const restSpy = vi.spyOn(ai, 'generateAdventureRest')
    const result = await gated(ai, 3)
    expect(result).toMatchObject({ ok: false, reason: expect.stringContaining('teto de 3 tentativas esgotado') })
    expect(sliceSpy).toHaveBeenCalledTimes(1)
    expect(restSpy).toHaveBeenCalledTimes(3)
  })

  it('a 1B re-amostrada recebe SEMPRE a mesma fatia (o reseed não re-rola registry/facções/registro)', async () => {
    const badRest = authored({ challenges: [{ locationIndex: 0, test: 'Culinária', situation: 's', consequence: 'c' }] })
    const ai = fakeAi(null, null, {}, badRest)
    const restSpy = vi.spyOn(ai, 'generateAdventureRest')
    await gated(ai, 3)
    const slices = restSpy.mock.calls.map(([params]) => params.slice)
    expect(slices).toHaveLength(3)
    expect(slices[1]).toEqual(slices[0])
    expect(slices[2]).toEqual(slices[0])
  })
})

// US-256: orquestração 1A → [narração + liberação] ∥ [1B + gate] → junção → estado terminal.
describe('AdventureGenerationService.run — liberação antecipada (US-256)', () => {
  const baseChar = {
    id: 'char-1', userId: 'user-1', systemId: 'sys-1', name: 'Elara', class: 'wizard', race: 'human', level: 3,
    baseAttributes: { constitution: 14 }, system: { config },
  }
  const profile: AdventureProfile = { level: 3, classKey: 'wizard', background: {}, origin: {}, hookSeed: 'A vela curva-se, Elara.', challenge: 'adventure' }
  const opening: AdventureOpeningContext = {
    systemName: 'D&D 5e', characterName: 'Elara', characterGender: 'feminino', className: 'Mago', raceName: 'Humano',
    level: 3, maxHp: 10, attrs: { constitution: 14 }, attributeLabels: {}, background: {}, features: [], knownSpells: [],
    fullInventory: [{ name: 'Adaga', qty: 1 }], hookSeed: 'A vela curva-se, Elara.', locale: 'pt-BR', origin: {},
  }
  const badRest = authored({ challenges: [{ locationIndex: 0, test: 'Culinária', situation: 's', consequence: 'c' }] })

  function setup(ai: AiService) {
    const { prisma, recorded } = fakePrisma(baseChar)
    const generation = new AdventureGenerationService(prisma, ai)
    const run = () => generation.run('adv-1', 'char-1', profile, 1, 'pt-BR', config, {}, opening)
    return { generation, recorded, run }
  }

  // Narração que só termina quando o teste manda — segura a liberação pra provar a ordem.
  function aiWithHeldNarration(authoredObj: Record<string, unknown> = authored()) {
    let release!: (text: string) => void
    const held = new Promise<string>((resolve) => { release = resolve })
    const ai = { ...fakeAi(null, null, {}, authoredObj), generateOpeningNarration: () => held } as unknown as AiService
    return { ai, releaseNarration: release }
  }

  // AC "Ordem das transações" (a): a 1B + gate terminam ANTES da narração.
  it('1B + gate resolvem ANTES da narração → estado final ACTIVE (nunca OPENING_READY no fim); authoredSlice gravado', async () => {
    const { ai, releaseNarration } = aiWithHeldNarration()
    const { generation, recorded, run } = setup(ai)
    const restSpy = vi.spyOn(generation, 'generateGatedRest')

    const running = run()
    await vi.waitFor(() => expect(restSpy).toHaveBeenCalled())
    await restSpy.mock.results[0]!.value // 1B + gate concluídos, narração ainda presa
    expect(recorded.statusWrites).toBeUndefined() // nada sobrescrito: quem grava estado é a junção
    releaseNarration('A cena de abertura.')
    await running

    expect(recorded.statusWrites).toEqual(['OPENING_READY', 'ACTIVE'])
    expect(recorded.adventureUpdates![0]).toHaveProperty('authoredSlice')
    expect(recorded.adventureUpdate).toHaveProperty('generatedAdventure')
    expect(recorded.questCreate).toMatchObject({ isPrimary: true })
  })

  // AC "Ordem das transações" (b): a 1B falha ANTES da narração terminar → o FAILED não pode ser
  // sobrescrito pela liberação, que é mais lenta.
  it('1B falha ANTES da narração terminar → estado final FAILED (nunca OPENING_READY no fim); authoredSlice gravado', async () => {
    const { ai, releaseNarration } = aiWithHeldNarration(badRest)
    const { generation, recorded, run } = setup(ai)
    const restSpy = vi.spyOn(generation, 'generateGatedRest')

    const running = run()
    await vi.waitFor(() => expect(restSpy).toHaveBeenCalled())
    await restSpy.mock.results[0]!.value // gate esgotou, narração ainda presa
    expect(recorded.statusWrites).toBeUndefined()
    releaseNarration('A cena de abertura.')
    await running

    expect(recorded.statusWrites).toEqual(['OPENING_READY', 'FAILED'])
    expect(recorded.adventureUpdates![0]).toHaveProperty('authoredSlice')
    expect(recorded.adventureFailedUpdate).toMatchObject({ status: 'FAILED', generationError: expect.stringContaining('teto de 3 tentativas esgotado') })
    expect(recorded.questCreate).toBeUndefined()
  })

  it('narração/liberação lança → FAILED na hora, sem liberação e SEM esperar a 1B', async () => {
    const ai = { ...fakeAi(), generateOpeningNarration: vi.fn().mockRejectedValue(new Error('provider caiu')) } as unknown as AiService
    const { generation, recorded, run } = setup(ai)
    vi.spyOn(generation, 'generateGatedRest').mockReturnValue(new Promise(() => {})) // 1B nunca resolve

    await run() // se esperasse a 1B, travaria aqui

    expect(recorded.statusWrites).toEqual(['FAILED'])
    expect(recorded.adventureFailedUpdate).toMatchObject({ generationError: 'provider caiu' })
    expect(recorded.adventureUpdate).toBeUndefined()
    expect(recorded.eventLogCreate).toBeUndefined()
  })

  it('a liberação grava o ledger da FATIA (sem segmentos de encontro/desafio) e a conclusão o enriquece', async () => {
    const { ai } = { ai: fakeAi('A cena.') }
    const { recorded, run } = setup(ai)
    await run()

    const [released, completed] = recorded.adventureUpdates! as Array<{ entities?: Array<{ nome: string; nota?: string }> }>
    expect(released!.entities!.find((e) => e.nome === 'Enseada Cinzenta')!.nota).not.toContain('objetivo: passar')
    expect(completed!.entities!.find((e) => e.nome === 'Enseada Cinzenta')!.nota).toContain('objetivo: passar')
  })

  // AC "Fatia imutável": 1B reprova uma vez antes de passar; a fatia que a jogadora viu é a do final.
  it('fatia imutável: world.name, npcs[].name e locations[].title liberados == os do generatedAdventure final', async () => {
    const ai = fakeAi('A cena.')
    vi.spyOn(ai, 'generateAdventureRest').mockResolvedValueOnce({ rest: splitAuthored(badRest).rest as never, modelId: 'fake/bad' })
    const { recorded, run } = setup(ai)
    await run()

    const released = (recorded.adventureUpdates![0] as { authoredSlice: { slice: AdventureSlice } }).authoredSlice.slice
    const final = recorded.adventureUpdate!['generatedAdventure'] as GeneratedAdventure
    expect(ai.generateAdventureSlice).toBeDefined()
    expect(final.world.name).toBe(released.world.name)
    expect(final.npcs.map((n) => n.name)).toEqual(released.npcs.map((n) => n.name))
    expect(final.locations.map((l) => l.title)).toEqual(released.locations.map((l) => l.title))
    expect(recorded.statusWrites).toEqual(['OPENING_READY', 'ACTIVE'])
  })

  it('1A roda 1× e a 1B até maxAttempts quando o gate nunca passa; estado final FAILED', async () => {
    const ai = fakeAi('A cena.', null, {}, badRest)
    const sliceSpy = vi.spyOn(ai, 'generateAdventureSlice')
    const restSpy = vi.spyOn(ai, 'generateAdventureRest')
    const { recorded, run } = setup(ai)
    await run()

    expect(sliceSpy).toHaveBeenCalledTimes(1)
    expect(restSpy).toHaveBeenCalledTimes(3)
    expect(recorded.statusWrites).toEqual(['OPENING_READY', 'FAILED'])
  })

  // AC: `generateOpeningNarration`/`generateIntroNarration` só recebem texto saneado.
  it('as duas narrações só recebem texto saneado: número de mecânica vazado na fatia chega limpo', async () => {
    const leaky = authored({
      start: 'O gancho: você chega à enseada. Um teste de Força (CD 15) abre o portão. O vento muda ao anoitecer.',
      locations: [{ title: 'Enseada Cinzenta', aspects: [], boxedText: 'Você chega. Um teste de Percepção (CD 10) revela a fenda.', description: 'notas', occupants: [0], vibe: 'social' as const }],
    })
    const seenOpening: Record<string, unknown> = {}
    const seenIntro: Record<string, unknown> = {}
    const { recorded, run } = setup(fakeAi('A cena.', null, seenOpening, leaky, undefined, 'A introdução.', seenIntro))
    await run()

    expect(seenOpening['mainQuest']).not.toMatch(/CD \d/)
    expect(seenIntro['mainQuest']).not.toMatch(/CD \d/)
    expect(JSON.stringify(seenOpening['entities'])).not.toMatch(/CD \d/)
    expect(JSON.stringify(recorded.adventureUpdates![0])).not.toMatch(/CD \d/)
  })

  it('a liberação grava introdução + abertura (INTRODUCTION antes de NARRATION) e a conclusão só a Quest', async () => {
    const { recorded, run } = setup(fakeAi('A cena.', null, {}, authored(), undefined, 'A introdução.'))
    await run()
    expect((recorded.eventLogCreates as Array<{ type: string }>).map((e) => e.type)).toEqual(['INTRODUCTION', 'NARRATION'])
    expect(recorded.questCreate).toMatchObject({ title: 'Três facções disputam a Enseada Cinzenta.' })
  })
})

// US-256 (Questão #4): "tentar de novo" da 1B contra a fatia persistida.
describe('AdventureGenerationService.retryRest (US-256)', () => {
  const baseChar = {
    id: 'char-1', userId: 'user-1', systemId: 'sys-1', name: 'Elara', class: 'wizard', race: 'human', level: 3,
    baseAttributes: { constitution: 14 }, system: { config },
  }
  const slice = mintSlice(splitAuthored(authored()).slice as never, { id: 'char-1:1', level: 3, registry: { setting: 's', tone: 't', areaType: 'a' }, modelId: 'fake/model' })
  const record: AuthoredSliceRecord = { slice, challenge: 'adventure', namingRegister: 'Celtic' }

  function setup(row: Record<string, unknown> | null, ai: AiService = fakeAi()) {
    const { prisma, recorded } = fakePrisma(baseChar)
    if (row) recorded.adventureRow = row
    const generation = new AdventureGenerationService(prisma, ai)
    return { generation, recorded, ai }
  }

  it('FAILED + fatia persistida → volta a OPENING_READY, re-executa SÓ a 1B contra a fatia e conclui em ACTIVE', async () => {
    const { generation, recorded, ai } = setup({ status: 'FAILED', authoredSlice: record })
    const sliceSpy = vi.spyOn(ai, 'generateAdventureSlice')
    const restSpy = vi.spyOn(ai, 'generateAdventureRest')

    await expect(generation.retryRest('char-1', 'adv-1')).resolves.toEqual({ status: 'OPENING_READY' })
    await vi.waitFor(() => expect(recorded.questCreate).toBeDefined())

    expect(sliceSpy).not.toHaveBeenCalled()
    expect(restSpy.mock.calls[0]![0].slice).toEqual(slice)
    expect(recorded.statusWrites).toEqual(['OPENING_READY', 'ACTIVE'])
    expect(recorded.adventureFailedUpdate).toMatchObject({ status: 'OPENING_READY', generationError: null })
  })

  it('a 1B do retry usa o challenge e o registro de nomenclatura gravados na fatia, não valores novos', async () => {
    const { generation, recorded, ai } = setup({ status: 'FAILED', authoredSlice: { ...record, challenge: 'challenge', namingRegister: 'Norse/Germanic' } })
    const restSpy = vi.spyOn(ai, 'generateAdventureRest')
    await generation.retryRest('char-1', 'adv-1')
    await vi.waitFor(() => expect(recorded.statusWrites).toContain('ACTIVE'))
    expect(restSpy.mock.calls[0]![0]).toMatchObject({ namingRegister: 'Norse/Germanic', className: 'Mago', level: 3 })
    expect(restSpy.mock.calls[0]![0].combatBudget).toEqual({ maxHostileCount: composeEncounterRoles(3, 'challenge').length, viable: composeEncounterRoles(3, 'challenge').length > 0 })
  })

  it('o gate esgotando no retry → FAILED de novo (a jogadora pode tentar outra vez)', async () => {
    const badRest = authored({ challenges: [{ locationIndex: 0, test: 'Culinária', situation: 's', consequence: 'c' }] })
    const { generation, recorded } = setup({ status: 'FAILED', authoredSlice: record }, fakeAi(null, null, {}, badRest))
    await generation.retryRest('char-1', 'adv-1')
    await vi.waitFor(() => expect(recorded.statusWrites).toEqual(['OPENING_READY', 'FAILED']))
    expect(recorded.questCreate).toBeUndefined()
  })

  // Dyno reiniciado no meio da 1B: o status ficou OPENING_READY mas nada roda (o Set `restRunning` é
  // por instância) — o retry precisa aceitar OPENING_READY, senão a jogadora fica presa pra sempre.
  it('OPENING_READY preso (nada rodando nesta instância) → o retry é aceito', async () => {
    const { generation, recorded } = setup({ status: 'OPENING_READY', authoredSlice: record })
    await expect(generation.retryRest('char-1', 'adv-1')).resolves.toEqual({ status: 'OPENING_READY' })
    await vi.waitFor(() => expect(recorded.statusWrites).toContain('ACTIVE'))
  })

  it('1B ainda rodando nesta instância → devolve o estado atual e NÃO dispara uma 2ª 1B (sem Quest duplicada)', async () => {
    const { generation, recorded, ai } = setup({ status: 'OPENING_READY', authoredSlice: record })
    const restSpy = vi.spyOn(ai, 'generateAdventureRest')
    ;(generation as unknown as { restRunning: Set<string> }).restRunning.add('adv-1')

    await expect(generation.retryRest('char-1', 'adv-1')).resolves.toEqual({ status: 'OPENING_READY' })
    expect(restSpy).not.toHaveBeenCalled()
    expect(recorded.statusWrites).toBeUndefined()
  })

  it('dois retries seguidos → só uma 1B (o Set é marcado antes do primeiro await)', async () => {
    const { generation, recorded, ai } = setup({ status: 'FAILED', authoredSlice: record })
    const restSpy = vi.spyOn(ai, 'generateAdventureRest')
    await Promise.all([generation.retryRest('char-1', 'adv-1'), generation.retryRest('char-1', 'adv-1')])
    await vi.waitFor(() => expect(recorded.statusWrites).toContain('ACTIVE'))
    expect(restSpy).toHaveBeenCalledTimes(1)
  })

  it.each(['ACTIVE', 'GENERATING', 'COMPLETED'])('%s → 409: só FAILED ou OPENING_READY reexecutam', async (status) => {
    const { generation } = setup({ status, authoredSlice: record })
    await expect(generation.retryRest('char-1', 'adv-1')).rejects.toThrow(`está em ${status}: só FAILED ou OPENING_READY`)
  })

  it('FAILED sem fatia (falha antes da liberação) → 409 mandando recomeçar a criação', async () => {
    const { generation } = setup({ status: 'FAILED', authoredSlice: null })
    await expect(generation.retryRest('char-1', 'adv-1')).rejects.toThrow('authoredSlice ausente): a falha foi antes da liberação — recomece a criação')
  })

  it('authoredSlice corrompido → 409 (não estoura um erro de zod cru)', async () => {
    const { generation } = setup({ status: 'FAILED', authoredSlice: { slice: { id: 'x' } } })
    await expect(generation.retryRest('char-1', 'adv-1')).rejects.toThrow('authoredSlice inválido')
  })

  it('aventura inexistente ou de outro personagem → 404', async () => {
    const { generation } = setup(null)
    await expect(generation.retryRest('char-1', 'adv-x')).rejects.toThrow('Aventura adv-x não encontrada para este personagem')
  })
})
