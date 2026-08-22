import { describe, it, expect, vi } from 'vitest'
import { AiService, scenePatchFromExtraction, applyInventoryDeltas } from './ai.service'
import { mergeSceneState, extractionModel, primaryModel, ONOMASTICS_SECTION, CRAFT_CORE_SECTION, NPC_VOICE_BULLET } from '@ai-dm/ai-engine'
import type { InventoryItem, SceneState, WorldEntity } from '@ai-dm/shared'
import type { PrismaService } from '../prisma.service'
import type { DiceService } from '../game/dice.service'
import type { EventLog } from '../generated/prisma/client'

// US-74: a geração do fecho é a única I/O externa do `completeTruncatedTurn`. Fake
// fixa — o que se testa aqui é o encanamento (o que é persistido, o que é
// reconciliado, o que vai no prompt), não a prosa do modelo.
// US-158: mesmo padrão para `generateObject` — `genObj.result` é o retorno fixo,
// `genObj.error` (quando setado) faz o fake REJEITAR em vez de resolver, pra testar
// que a falha propaga (critério de aceite da US-158) em vez de cair num catch mudo.
const { salvage, genObj } = vi.hoisted(() => ({
  salvage: { text: '', system: '', prompt: '', model: undefined as unknown, providerOptions: undefined as unknown },
  genObj: { result: undefined as unknown, error: undefined as unknown, system: '', prompt: '', model: undefined as unknown },
}))
vi.mock('ai', async (importOriginal) => ({
  ...(await importOriginal<typeof import('ai')>()),
  generateText: async ({ system, prompt, model, providerOptions }: { system: string; prompt: string; model: unknown; providerOptions: unknown }) => {
    salvage.system = system
    salvage.prompt = prompt
    salvage.model = model
    salvage.providerOptions = providerOptions
    return { text: salvage.text }
  },
  generateObject: async ({ system, prompt, model }: { system: string; prompt: string; model: unknown }) => {
    genObj.system = system
    genObj.prompt = prompt
    genObj.model = model
    if (genObj.error) throw genObj.error
    return { object: genObj.result, providerMetadata: undefined }
  },
}))

// Evento mínimo para os testes de edição (US-67). `createdAt` numérico simplifica a
// comparação de ordem (o serviço só usa <, >, >= sobre o campo).
type Evt = { id: string; type: EventLog['type']; summarized: boolean; createdAt: number; payload?: unknown }

function fakePrisma(events: Evt[]) {
  const deleted: string[] = []
  const created: unknown[] = []
  const prisma = {
    eventLog: {
      findFirst: async ({ where, orderBy }: any) => {
        let list = events.filter((e) => e.type === where.type)
        if (where.createdAt?.lt !== undefined) list = list.filter((e) => e.createdAt < where.createdAt.lt)
        list = [...list].sort((a, b) => a.createdAt - b.createdAt)
        // Só usamos orderBy desc → devolve o mais recente.
        void orderBy
        return list.length ? list[list.length - 1] : null
      },
      findMany: async ({ where }: any) => {
        let list = events.filter((e) => where.type.in.includes(e.type))
        if (where.createdAt?.gt !== undefined) list = list.filter((e) => e.createdAt > where.createdAt.gt)
        if (where.createdAt?.gte !== undefined) list = list.filter((e) => e.createdAt >= where.createdAt.gte)
        return [...list].sort((a, b) => a.createdAt - b.createdAt)
      },
      deleteMany: async ({ where }: any) => { deleted.push(...where.id.in); return { count: where.id.in.length } },
      createMany: async ({ data }: any) => { created.push(...data); return { count: data.length } },
    },
  } as unknown as PrismaService
  return { prisma, deleted, created }
}

function service(events: Evt[]) {
  const { prisma, deleted, created } = fakePrisma(events)
  return { svc: new AiService(prisma, {} as unknown as DiceService), deleted, created }
}

describe('AiService.clearLastTurnForEdit (US-67)', () => {
  it('turno sem mutação: apaga o rastro (ação + rolagem + narração) e devolve-o', async () => {
    const events: Evt[] = [
      { id: 'opening', type: 'NARRATION', summarized: false, createdAt: 0 },
      { id: 'roll', type: 'DICE_ROLL', summarized: false, createdAt: 1 },
      { id: 'action', type: 'ACTION', summarized: false, createdAt: 2 },
      { id: 'narration', type: 'NARRATION', summarized: false, createdAt: 3 },
    ]
    const { svc, deleted } = service(events)

    const trail = await svc.clearLastTurnForEdit('adv-1', 'char-1')

    expect(trail.map((e) => e.id).sort()).toEqual(['action', 'narration', 'roll'])
    expect(deleted.sort()).toEqual(['action', 'narration', 'roll'])
    // A abertura (narração anterior) NÃO é apagada.
    expect(deleted).not.toContain('opening')
  })

  it('turno que mudou o estado (CHARACTER_UPDATE no rastro) → rejeita, nada apagado', async () => {
    const events: Evt[] = [
      { id: 'opening', type: 'NARRATION', summarized: false, createdAt: 0 },
      { id: 'hp', type: 'CHARACTER_UPDATE', summarized: false, createdAt: 1 },
      { id: 'action', type: 'ACTION', summarized: false, createdAt: 2 },
      { id: 'narration', type: 'NARRATION', summarized: false, createdAt: 3 },
    ]
    const { svc, deleted } = service(events)

    await expect(svc.clearLastTurnForEdit('adv-1', 'char-1')).rejects.toThrow(/estado/)
    expect(deleted).toEqual([])
  })

  it('última ação já resumida → rejeita', async () => {
    const events: Evt[] = [
      { id: 'opening', type: 'NARRATION', summarized: true, createdAt: 0 },
      { id: 'action', type: 'ACTION', summarized: true, createdAt: 1 },
      { id: 'narration', type: 'NARRATION', summarized: true, createdAt: 2 },
    ]
    const { svc, deleted } = service(events)

    await expect(svc.clearLastTurnForEdit('adv-1', 'char-1')).rejects.toThrow(/resumido/)
    expect(deleted).toEqual([])
  })

  it('sem nenhuma ação → rejeita', async () => {
    const events: Evt[] = [{ id: 'opening', type: 'NARRATION', summarized: false, createdAt: 0 }]
    const { svc } = service(events)
    await expect(svc.clearLastTurnForEdit('adv-1', 'char-1')).rejects.toThrow()
  })
})

describe('AiService.restoreClearedTurn (US-67)', () => {
  it('reinsere os eventos apagados preservando id e createdAt', async () => {
    const { svc, created } = service([])
    const events = [
      { id: 'action', adventureId: 'adv-1', characterId: 'char-1', type: 'ACTION', payload: { text: 'Abro a porta' }, summarized: false, createdAt: new Date(0) },
      { id: 'narration', adventureId: 'adv-1', characterId: 'char-1', type: 'NARRATION', payload: { text: 'Range' }, summarized: false, createdAt: new Date(1) },
    ] as unknown as EventLog[]

    await svc.restoreClearedTurn(events)

    expect(created).toHaveLength(2)
    expect((created[0] as { id: string }).id).toBe('action')
  })

  it('lista vazia → no-op', async () => {
    const { svc, created } = service([])
    await svc.restoreClearedTurn([])
    expect(created).toEqual([])
  })
})

describe('AiService.completeTruncatedTurn (US-74)', () => {
  // Prisma mínimo do caminho de salvamento: nome da personagem (para o
  // reconciliador) + os dois EventLog do turno. `findMany` vazio mantém o
  // `summarizeOldTurns` abaixo do limiar, sem tocar no modelo.
  function salvageService() {
    const narrations: string[] = []
    const prisma = {
      character: { findUnique: async () => ({ name: 'Seraphine Valthor' }) },
      eventLog: {
        create: async ({ data }: { data: { type: string; payload: { text: string } } }) => {
          if (data.type === 'NARRATION') narrations.push(data.payload.text)
          return data
        },
        findMany: async () => [],
      },
    } as unknown as PrismaService
    const svc = new AiService(prisma, {} as unknown as DiceService)

    // `reconcileScene` é privado e é LLM + DB — a US-73 já o cobre por dentro.
    // O que falta cobrir é a CHAMADA a partir do salvamento, então aqui ele é
    // substituído por um gravador.
    const reconciled: Array<{ narration: string; playerName: string; turnId?: string }> = []
    const spy = async (_adventureId: string, _characterId: string, narration: string, playerName: string, turnId?: string) => {
      reconciled.push({ narration, playerName, turnId })
    }
    ;(svc as unknown as { reconcileScene: typeof spy }).reconcileScene = spy

    return { svc, narrations, reconciled }
  }

  const INPUT = { adventureId: 'adv-1', characterId: 'char-1', message: 'Usar o frasco e descer ao poço' }

  it('reconcilia a cena com o turno COMPLETO — o salvamento não passa pelo onFinish', async () => {
    // Regressão do bug de prod (29/07/2026): o turno truncado narrou a chegada ao beco
    // do Foles Quebrado, mas o sceneState ficou na cozinha da Sibil — o `reconcileScene`
    // do onFinish nunca correu, porque o `turnGuard.incomplete` gateia aquele caminho.
    const { svc, narrations, reconciled } = salvageService()
    salvage.text = 'A grade cede sob os seus dedos.\n\n- 🗡️ Descer ao poço.'

    await svc.completeTruncatedTurn(INPUT, 'O beco engole o som dos seus passos.')

    expect(reconciled).toHaveLength(1)
    expect(reconciled[0]!.narration).toContain('O beco engole') // parcial já mostrado
    expect(reconciled[0]!.narration).toContain('A grade cede') // + fecho
    expect(reconciled[0]!.playerName).toBe('Seraphine Valthor')
    expect(narrations[0]).toContain('A grade cede') // e é o mesmo texto persistido
  })

  it('o prompt do fecho proíbe re-oferecer a ação que o jogador acabou de declarar', async () => {
    // O fecho salvo em prod ofereceu "Passar o óleo nos pulsos, depois descer" DEPOIS
    // de a jogadora ter declarado exatamente isso — a chamada de salvamento não tem
    // ficha, cena nem histórico, então a regra precisa estar no próprio system.
    const { svc } = salvageService()
    salvage.text = 'A grade cede.\n\n- 🗡️ Descer.'

    await svc.completeTruncatedTurn(INPUT, 'O beco engole o som dos seus passos.')

    expect(salvage.system).toMatch(/já aconteceu/i)
    expect(salvage.prompt).toContain(INPUT.message)
  })

  it('fecho sem lista de opções → anexa o fallback estático (jogador nunca fica sem saída)', async () => {
    const { svc, narrations } = salvageService()
    salvage.text = 'A grade cede sob os seus dedos, e o escuro respira.'

    const closure = await svc.completeTruncatedTurn(INPUT, 'O beco engole o som dos seus passos.')

    expect(closure).toContain('- 💬 Continuar.')
    expect(narrations[0]).toContain('- 💬 Continuar.')
  })

  // US-117 (ADR 011): turnId é parâmetro opcional propagado ao reconciliador — aqui
  // é a função "chamada dentro do mesmo turno" mais barata de testar (a outra,
  // `streamChat`, exige montar personagem/aventura/quests inteiros pro onFinish rodar).
  it('US-117: propaga o turnId recebido para reconcileScene', async () => {
    const { svc, reconciled } = salvageService()
    salvage.text = 'A grade cede.\n\n- 🗡️ Descer.'

    await svc.completeTruncatedTurn(INPUT, 'O beco engole o som dos seus passos.', 'turn-abc-123')

    expect(reconciled).toHaveLength(1)
    expect(reconciled[0]!.turnId).toBe('turn-abc-123')
  })

  it('US-117: sem turnId (chamador não passou) → reconcileScene recebe undefined, não quebra', async () => {
    const { svc, reconciled } = salvageService()
    salvage.text = 'A grade cede.\n\n- 🗡️ Descer.'

    await svc.completeTruncatedTurn(INPUT, 'O beco engole o som dos seus passos.')

    expect(reconciled[0]!.turnId).toBeUndefined()
  })

  // US-114: `completeTruncatedTurn` saiu de `narrationModels[0]` para `extractionModel`,
  // e `{effort:'low', exclude:true}` para `{enabled:false}` — a config antiga dá 200
  // com corpo VAZIO no modelo novo (achado 2026-08-17, Questão em aberto #2), sem
  // erro nem log: o `hasOptionsList` abaixo dá falso, `SALVAGE_FALLBACK` assume, e o
  // turno degrada pro "- 💬 Continuar." SEMPRE, em silêncio. Regressão dessa dupla —
  // trocar só o modelo e deixar a config antiga é exatamente o bug que este teste pega.
  it('US-114: usa extractionModel com reasoning {enabled:false}, não a config antiga do 60s', async () => {
    const { svc } = salvageService()
    salvage.text = 'A grade cede.\n\n- 🗡️ Descer.'

    await svc.completeTruncatedTurn(INPUT, 'O beco engole o som dos seus passos.')

    expect(salvage.model).toBe(extractionModel)
    expect(salvage.providerOptions).toEqual({ openrouter: { reasoning: { enabled: false } } })
  })
})

describe('applyInventoryDeltas (US-128)', () => {
  // Regressão: o Map antigo era <string, number> e reconstruía cada item como {name, qty} —
  // mexer em QUALQUER item apagava `origin` (memento/equipamento da origem) de todos os outros.
  it('mexer em OUTRO item não apaga o origin do item marcado', () => {
    const current: InventoryItem[] = [
      { name: 'Memento', qty: 1, origin: 'memento' },
      { name: 'Adaga', qty: 1 },
    ]
    const next = applyInventoryDeltas(current, [{ name: 'Adaga', delta: 1 }])
    expect(next.find((i) => i.name === 'Memento')).toEqual({ name: 'Memento', qty: 1, origin: 'memento' })
    expect(next.find((i) => i.name === 'Adaga')).toEqual({ name: 'Adaga', qty: 2 })
  })

  it('delta negativo remove o item quando a quantidade chega a zero', () => {
    const current: InventoryItem[] = [{ name: 'Poção', qty: 1 }]
    const next = applyInventoryDeltas(current, [{ name: 'Poção', delta: -1 }])
    expect(next).toEqual([])
  })

  it('delta negativo maior que a quantidade não deixa item com qty negativa', () => {
    const current: InventoryItem[] = [{ name: 'Flecha', qty: 2 }]
    const next = applyInventoryDeltas(current, [{ name: 'Flecha', delta: -5 }])
    expect(next).toEqual([])
  })

  it('item novo (sem entrada prévia) nasce sem origin', () => {
    const next = applyInventoryDeltas([], [{ name: 'Corda', delta: 1 }])
    expect(next).toEqual([{ name: 'Corda', qty: 1 }])
  })

  it('remover o item de memento apaga a linha, sem deixar rastro', () => {
    const current: InventoryItem[] = [{ name: 'Memento', qty: 1, origin: 'memento' }]
    const next = applyInventoryDeltas(current, [{ name: 'Memento', delta: -1 }])
    expect(next).toEqual([])
  })
})

describe('scenePatchFromExtraction + reconcile (US-73)', () => {
  // O sceneState CONGELADO do bug (erro narração 2): entrada do pântano, sem o semeador.
  const stale: SceneState = {
    local: 'estrada velha, entrada do Pântano de Ossos',
    ambiente: 'externo',
    periodo: 'manhã',
    presentes: ['Anetra Ulkas'],
    objetos_em_cena: ['névoa espessa', 'trilha desaparecendo na névoa'],
    atualizadoEm: '2026-07-24T14:41:22Z',
  }

  it('viagem→chegada: reconcilia local, traz o NPC e remove a jogadora de presentes', () => {
    // A extração REAL carregou a jogadora em presentes (herdada da cena poluída); o
    // filtro determinístico por playerName tem de removê-la mesmo assim.
    const extracted = {
      local: 'clareira do Coração de Musgo',
      ambiente: 'externo' as const,
      periodo: 'manhã',
      presentes: ['Anetra Ulkas', 'o homem de rosto liso'],
      objetos_em_cena: ['árvore negra', 'raízes como veias', 'musgo esbranquiçado'],
    }
    const next = mergeSceneState(stale, scenePatchFromExtraction(extracted, 'Anetra Ulkas'))
    expect(next.local).toBe('clareira do Coração de Musgo') // não mais a entrada
    expect(next.presentes).toContain('o homem de rosto liso') // o semeador está presente
    expect(next.presentes).not.toContain('Anetra Ulkas') // jogadora filtrada de presentes
  })

  it('turno só-diálogo (local vazio) NÃO teletransporta a personagem para lugar nenhum', () => {
    const dialogueOnly = { local: '', ambiente: 'externo' as const, periodo: '', presentes: ['o homem de rosto liso'], objetos_em_cena: ['árvore negra'] }
    const patch = scenePatchFromExtraction(dialogueOnly)
    expect(patch.local).toBeUndefined() // local vazio não entra no patch
    expect(patch.periodo).toBeUndefined()
    const base: SceneState = { ...stale, local: 'clareira do Coração de Musgo' }
    const next = mergeSceneState(base, patch)
    expect(next.local).toBe('clareira do Coração de Musgo') // preservado
  })

  it('presentes/objetos substituem a lista inteira (NPC que saiu some)', () => {
    const extracted = { local: 'clareira', ambiente: 'externo' as const, periodo: 'manhã', presentes: [], objetos_em_cena: [] }
    const next = mergeSceneState(stale, scenePatchFromExtraction(extracted))
    expect(next.presentes).toEqual([]) // ninguém além da personagem
  })
})

describe('AiService.reconcileEncounterLedger (US-171)', () => {
  const soldier: WorldEntity = {
    nome: 'Soldier (npc-2)',
    tipo: 'npc',
    local: 'Ruína',
    nota: 'Soldier',
    revelado: false,
    atualizadoEm: '2026-01-01T00:00:00.000Z',
  }

  function ledgerService(entities: WorldEntity[] | null) {
    const updates: WorldEntity[][] = []
    const prisma = {
      adventure: {
        findUnique: async () => ({ entities }),
        update: async ({ data }: { data: { entities: WorldEntity[] } }) => {
          updates.push(data.entities)
          return { entities: data.entities }
        },
      },
    } as unknown as PrismaService
    const svc = new AiService(prisma, {} as unknown as DiceService)
    const reconcile = (svc as unknown as {
      reconcileEncounterLedger: (
        adventureId: string,
        presentesBefore: string[] | null | undefined,
        presentesAfter: string[] | null | undefined,
      ) => Promise<void>
    }).reconcileEncounterLedger.bind(svc)
    return { reconcile, updates }
  }

  it('combatente de encontro que SAI de presentes ganha estado "fora de cena"', async () => {
    const { reconcile, updates } = ledgerService([soldier])
    await reconcile('adv-1', ['Soldier (npc-2)'], [])
    expect(updates).toHaveLength(1)
    expect(updates[0]!.find((e) => e.nome === 'Soldier (npc-2)')?.estado).toBe('fora de cena')
  })

  it('combatente NUNCA engajado (nunca esteve em presentes) fica intocado', async () => {
    const { reconcile, updates } = ledgerService([soldier])
    await reconcile('adv-1', [], [])
    expect(updates).toHaveLength(0)
  })

  it('combatente que já saiu num turno anterior não é tocado de novo (não sobrescreve estado manual)', async () => {
    // `presentesBefore` já não lista o combatente — a transição presente→ausente já
    // foi processada num turno passado, que pode ter deixado um `estado` mais
    // específico via `recordEntity` manual.
    const jaResolvido: WorldEntity = { ...soldier, estado: 'negociou rendição' }
    const { reconcile, updates } = ledgerService([jaResolvido])
    await reconcile('adv-1', [], [])
    expect(updates).toHaveLength(0)
  })

  it('NPC que não é combatente de encontro (nota fora de MONSTER_ROLE_CR) não é tocado', async () => {
    const marta: WorldEntity = {
      nome: 'Marta',
      tipo: 'npc',
      nota: 'herborista suspeita',
      revelado: true,
      atualizadoEm: '2026-01-01T00:00:00.000Z',
    }
    const { reconcile, updates } = ledgerService([marta])
    await reconcile('adv-1', ['Marta'], [])
    expect(updates).toHaveLength(0)
  })
})

describe('AiService.reconcileScene → reconcileEncounterLedger, encadeamento (US-171)', () => {
  it('presentes ANTES (sceneState prévio) vs DEPOIS (extração) decide o patch do ledger', async () => {
    const soldier: WorldEntity = {
      nome: 'Soldier (npc-2)',
      tipo: 'npc',
      local: 'Ruína',
      nota: 'Soldier',
      revelado: false,
      atualizadoEm: '2026-01-01T00:00:00.000Z',
    }
    const adventureUpdates: WorldEntity[][] = []
    const prisma = {
      characterState: {
        findUnique: async () => ({
          sceneState: { local: 'Ruína', ambiente: 'interno', periodo: 'noite', presentes: ['Soldier (npc-2)'], objetos_em_cena: [] },
        }),
        update: async () => ({}),
      },
      adventure: {
        findUnique: async () => ({ entities: [soldier] }),
        update: async ({ data }: { data: { entities: WorldEntity[] } }) => {
          adventureUpdates.push(data.entities)
          return {}
        },
      },
    } as unknown as PrismaService
    const svc = new AiService(prisma, {} as unknown as DiceService)
    genObj.error = undefined
    genObj.result = { local: 'Ruína', ambiente: 'interno', periodo: 'noite', presentes: [], objetos_em_cena: [] }

    await (svc as unknown as {
      reconcileScene: (adventureId: string, characterId: string, narration: string, playerName: string, turnId?: string) => Promise<void>
    }).reconcileScene('adv-1', 'char-1', 'O Soldier foge pelo corredor escuro.', 'Seraphine', undefined)

    expect(adventureUpdates).toHaveLength(1)
    expect(adventureUpdates[0]!.find((e) => e.nome === 'Soldier (npc-2)')?.estado).toBe('fora de cena')
  })
})

describe('AiService.generateLocationsAndNpcs (US-158)', () => {
  const rolled = {
    premissa: 'Open a gate',
    locais: 'Cove',
    monumentos: 'Cage',
    complicacao: { condition: 'Drenched', description: 'Horrific', origin: 'Aberrant' },
    patronsandnpcs: Array.from({ length: 7 }, () => ({ behavior: 'Sly', ancestry: 'Human' })),
  }
  const registry = { tone: 'grimdark', setting: 'coastal', areaType: 'settlement' }

  function svc() {
    return new AiService({} as unknown as PrismaService, {} as unknown as DiceService)
  }

  it('minta id no código (loc-N/npc-N), nunca deixado ao modelo', async () => {
    genObj.error = undefined
    genObj.result = {
      locations: [{ title: 'Enseada Cinzenta', aspects: ['maré alta'], boxedText: 'Você chega à enseada.', description: 'notas do mestre', occupants: [0] }],
      npcs: [{ name: 'Marta', role: 'a arquétipo herborista suspeita' }],
    }
    const { locations, npcs } = await svc().generateLocationsAndNpcs({ rolled, registry })
    expect(npcs[0]!.id).toBe('npc-1')
    expect(locations[0]!.id).toBe('loc-1')
    expect(locations[0]!.occupants).toEqual(['npc-1']) // resolvido por índice → id
  })

  it('índice de occupant fora de faixa é descartado (2026-08-19: sem match por nome pra preservar)', async () => {
    genObj.error = undefined
    genObj.result = {
      locations: [{ title: 'Torre', aspects: [], boxedText: 'x', description: 'y', occupants: [5] }],
      npcs: [{ name: 'Marta', role: 'papel' }],
    }
    const { locations } = await svc().generateLocationsAndNpcs({ rolled, registry })
    expect(locations[0]!.occupants).toEqual([])
  })

  it('usa primaryModel (2026-08-19), não extractionModel — motor precisa amarrar NPC/local sem órfão (gate US-150)', async () => {
    genObj.error = undefined
    genObj.result = { locations: [{ title: 't', aspects: [], boxedText: 'b', description: 'd', occupants: [] }], npcs: [{ name: 'n', role: 'r' }] }
    await svc().generateLocationsAndNpcs({ rolled, registry })
    expect(genObj.model).toBe(primaryModel)
  })

  it('background.story presente entra no prompt do modelo', async () => {
    genObj.error = undefined
    genObj.result = { locations: [{ title: 't', aspects: [], boxedText: 'b', description: 'd', occupants: [] }], npcs: [{ name: 'n', role: 'r' }] }
    await svc().generateLocationsAndNpcs({ rolled, registry, background: { story: 'jurou vingança contra o culto' } })
    expect(genObj.system).toContain('jurou vingança contra o culto')
  })

  it('background.bonds NÃO entra no prompt — motor de geração só consome story', async () => {
    genObj.error = undefined
    genObj.result = { locations: [{ title: 't', aspects: [], boxedText: 'b', description: 'd', occupants: [] }], npcs: [{ name: 'n', role: 'r' }] }
    await svc().generateLocationsAndNpcs({ rolled, registry, background: { bonds: ['jurou vingança contra o culto'] } })
    expect(genObj.system).not.toContain('jurou vingança contra o culto')
  })

  it('background vazio cai em instrução genérica de ancoragem, SEM gancho da classe (US-174)', async () => {
    genObj.error = undefined
    genObj.result = { locations: [{ title: 't', aspects: [], boxedText: 'b', description: 'd', occupants: [] }], npcs: [{ name: 'n', role: 'r' }] }
    await svc().generateLocationsAndNpcs({ rolled, registry })
    expect(genObj.system).toContain('já foi rolado para esta aventura')
  })

  it('assinatura não aceita hookSeed — mesmo forçado por cast, nunca chega ao system/prompt do modelo (US-174)', async () => {
    genObj.error = undefined
    genObj.result = { locations: [{ title: 't', aspects: [], boxedText: 'b', description: 'd', occupants: [] }], npcs: [{ name: 'n', role: 'r' }] }
    const hookSeed = 'A vela curva-se, Elara, numa corte de gelo e etiqueta.'
    await svc().generateLocationsAndNpcs({ rolled, registry, hookSeed } as never)
    expect(genObj.system).not.toContain(hookSeed)
    expect(genObj.prompt).not.toContain(hookSeed)
  })

  it('falha propaga erro estruturado — NÃO devolve array vazio em silêncio', async () => {
    genObj.error = new Error('modelo indisponível')
    await expect(svc().generateLocationsAndNpcs({ rolled, registry })).rejects.toThrow('modelo indisponível')
  })

  it('system segue a regra de Onomástica (US-177) — mesma barra da narração ao vivo', async () => {
    genObj.error = undefined
    genObj.result = { locations: [{ title: 't', aspects: [], boxedText: 'b', description: 'd', occupants: [] }], npcs: [{ name: 'n', role: 'r' }] }
    await svc().generateLocationsAndNpcs({ rolled, registry })
    expect(genObj.system).toContain(ONOMASTICS_SECTION)
  })

  it('system segue a barra de ofício de geração (US-179) — concretude/sensorial e voz do NPC', async () => {
    genObj.error = undefined
    genObj.result = { locations: [{ title: 't', aspects: [], boxedText: 'b', description: 'd', occupants: [] }], npcs: [{ name: 'n', role: 'r' }] }
    await svc().generateLocationsAndNpcs({ rolled, registry })
    expect(genObj.system).toContain(CRAFT_CORE_SECTION)
    expect(genObj.system).toContain(NPC_VOICE_BULLET)
  })

  it('locale entra no system como instrução de idioma-alvo; ausente cai no default pt-BR (US-178)', async () => {
    genObj.error = undefined
    genObj.result = { locations: [{ title: 't', aspects: [], boxedText: 'b', description: 'd', occupants: [] }], npcs: [{ name: 'n', role: 'r' }] }
    await svc().generateLocationsAndNpcs({ rolled, registry, locale: 'en-US' })
    expect(genObj.system).toContain('English')

    await svc().generateLocationsAndNpcs({ rolled, registry })
    expect(genObj.system).toContain('Brazilian Portuguese (pt-BR)')
  })
})

describe('AiService.generateSecrets (US-149)', () => {
  const locations = [{ id: 'loc-1', title: 'Enseada', aspects: [], boxedText: 'x', description: 'y', occupants: [] }]
  const npcs = [{ id: 'npc-1', name: 'Marta', role: 'herborista suspeita', interactions: [] }]
  const registry = { tone: 'comedic', setting: 'coastal', areaType: 'settlement' }
  const secretPrompts = {
    charactersecrets: Array.from({ length: 10 }, (_, i) => `character prompt ${i + 1}`),
    historicalsecrets: Array.from({ length: 10 }, (_, i) => `historical prompt ${i + 1}`),
    npcandvillainsecrets: Array.from({ length: 10 }, (_, i) => `npc prompt ${i + 1}`),
    plotandstorysecrets: Array.from({ length: 10 }, (_, i) => `plot prompt ${i + 1}`),
  }

  function svc() {
    return new AiService({} as unknown as PrismaService, {} as unknown as DiceService)
  }

  it('minta id no código (secret-N), nunca deixado ao modelo', async () => {
    genObj.error = undefined
    genObj.result = { secrets: [{ locationId: 'loc-1', text: 'A estalajadeira esconde uma dívida com o culto.' }] }
    const secrets = await svc().generateSecrets({ locations, npcs, secretPrompts, registry })
    expect(secrets[0]!.id).toBe('secret-1')
    expect(secrets[0]!.locationId).toBe('loc-1')
  })

  it('usa primaryModel (2026-08-19), não extractionModel', async () => {
    genObj.error = undefined
    genObj.result = { secrets: [{ locationId: 'loc-1', text: 'segredo' }] }
    await svc().generateSecrets({ locations, npcs, secretPrompts, registry })
    expect(genObj.model).toBe(primaryModel)
  })

  it('background.story presente entra no prompt do modelo', async () => {
    genObj.error = undefined
    genObj.result = { secrets: [{ locationId: 'loc-1', text: 'segredo' }] }
    await svc().generateSecrets({ locations, npcs, secretPrompts, registry, background: { story: 'jurou vingança contra o culto' } })
    expect(genObj.system).toContain('jurou vingança contra o culto')
  })

  it('background.bonds NÃO entra no prompt — motor de geração só consome story', async () => {
    genObj.error = undefined
    genObj.result = { secrets: [{ locationId: 'loc-1', text: 'segredo' }] }
    await svc().generateSecrets({ locations, npcs, secretPrompts, registry, background: { bonds: ['jurou vingança contra o culto'] } })
    expect(genObj.system).not.toContain('jurou vingança contra o culto')
  })

  it('origin.adventuresAndAdvancement presente entra no prompt do modelo', async () => {
    genObj.error = undefined
    genObj.result = { secrets: [{ locationId: 'loc-1', text: 'segredo' }] }
    await svc().generateSecrets({ locations, npcs, secretPrompts, registry, origin: { adventuresAndAdvancement: 'pode ser promovido dentro da ordem' } })
    expect(genObj.system).toContain('pode ser promovido dentro da ordem')
  })

  it('origin.connection/memento NÃO entram no prompt do modelo (só adventuresAndAdvancement alimenta o motor)', async () => {
    genObj.error = undefined
    genObj.result = { secrets: [{ locationId: 'loc-1', text: 'segredo' }] }
    await svc().generateSecrets({
      locations, npcs, secretPrompts, registry,
      origin: { connection: 'um sacerdote amado', memento: 'um livro de orações' } as never,
    })
    expect(genObj.system).not.toContain('um sacerdote amado')
    expect(genObj.system).not.toContain('um livro de orações')
  })

  it('background/origin vazios cai em instrução genérica de ancoragem, SEM gancho da classe (US-174)', async () => {
    genObj.error = undefined
    genObj.result = { secrets: [{ locationId: 'loc-1', text: 'segredo' }] }
    await svc().generateSecrets({ locations, npcs, secretPrompts, registry })
    expect(genObj.system).toContain('já foi rolado para esta aventura')
  })

  it('registry (tone) entra no system do modelo (US-176)', async () => {
    genObj.error = undefined
    genObj.result = { secrets: [{ locationId: 'loc-1', text: 'segredo' }] }
    await svc().generateSecrets({ locations, npcs, secretPrompts, registry })
    expect(genObj.system).toContain('comedic')
  })

  it('assinatura não aceita hookSeed — mesmo forçado por cast, nunca chega ao system/prompt do modelo (US-174)', async () => {
    genObj.error = undefined
    genObj.result = { secrets: [{ locationId: 'loc-1', text: 'segredo' }] }
    const hookSeed = 'A vela curva-se, Elara, numa corte de gelo e etiqueta.'
    await svc().generateSecrets({ locations, npcs, secretPrompts, registry, hookSeed } as never)
    expect(genObj.system).not.toContain(hookSeed)
    expect(genObj.prompt).not.toContain(hookSeed)
  })

  it('instrui o split fixo 3+3+3+2 por categoria no prompt', async () => {
    genObj.error = undefined
    genObj.result = { secrets: [{ locationId: 'loc-1', text: 'segredo' }] }
    await svc().generateSecrets({ locations, npcs, secretPrompts, registry })
    expect(genObj.prompt).toContain('escreva exatamente 3')
    expect(genObj.prompt).toContain('escreva exatamente 2')
  })

  it('falha propaga erro estruturado — NÃO devolve array vazio em silêncio', async () => {
    genObj.error = new Error('modelo indisponível')
    await expect(svc().generateSecrets({ locations, npcs, secretPrompts, registry })).rejects.toThrow('modelo indisponível')
  })

  it('locale entra no system como instrução de idioma-alvo; ausente cai no default pt-BR (US-178)', async () => {
    genObj.error = undefined
    genObj.result = { secrets: [{ locationId: 'loc-1', text: 'segredo' }] }
    await svc().generateSecrets({ locations, npcs, secretPrompts, registry, locale: 'en-US' })
    expect(genObj.system).toContain('English')

    await svc().generateSecrets({ locations, npcs, secretPrompts, registry })
    expect(genObj.system).toContain('Brazilian Portuguese (pt-BR)')
  })

  it('system segue a barra de ofício de geração (US-179)', async () => {
    genObj.error = undefined
    genObj.result = { secrets: [{ locationId: 'loc-1', text: 'segredo' }] }
    await svc().generateSecrets({ locations, npcs, secretPrompts, registry })
    expect(genObj.system).toContain(CRAFT_CORE_SECTION)
  })
})

describe('AiService.generateAntagonist (US-181/US-190)', () => {
  const locations = [{ id: 'loc-1', title: 'Enseada', aspects: [], boxedText: 'x', description: 'y', occupants: [] }]
  const npcs = [{ id: 'npc-1', name: 'Marta', role: 'herborista suspeita', interactions: [] }]
  const secrets = [{ id: 'secret-1', locationId: 'loc-1', text: 'A estalajadeira esconde uma dívida com o culto.' }]
  const registry = { tone: 'grimdark', setting: 'coastal', areaType: 'settlement' }
  const complicacao = { condition: 'Drenched', description: 'Horrific', origin: 'Aberrant' }

  function svc() {
    return new AiService({} as unknown as PrismaService, {} as unknown as DiceService)
  }

  it('devolve os 6 campos (name/want/method/trait/weakness/connection) do modelo', async () => {
    genObj.error = undefined
    genObj.result = { name: 'Malvora', want: 'poder sobre a região', method: 'reunir um exército', trait: 'fala em sussurros', weakness: 'vaidade', connection: 'já cruzou caminho com o grupo antes' }
    const antagonist = await svc().generateAntagonist({ locations, npcs, secrets, registry, complicacao, premissa: 'Kill a villain' })
    expect(antagonist).toEqual(genObj.result)
  })

  it('usa primaryModel, não extractionModel', async () => {
    genObj.error = undefined
    genObj.result = { name: 'Malvora', want: 'poder', method: 'exército', trait: 'sussurra', weakness: 'vaidade' }
    await svc().generateAntagonist({ locations, npcs, secrets, registry, complicacao, premissa: 'premissa' })
    expect(genObj.model).toBe(primaryModel)
  })

  it('registry (tone) entra no prompt do modelo', async () => {
    genObj.error = undefined
    genObj.result = { name: 'Malvora', want: 'poder', method: 'exército', trait: 'sussurra', weakness: 'vaidade' }
    await svc().generateAntagonist({ locations, npcs, secrets, registry, complicacao, premissa: 'premissa' })
    expect(genObj.system).toContain('grimdark')
  })

  it('locais/NPCs/segredos e complicação/premissa entram no prompt do modelo', async () => {
    genObj.error = undefined
    genObj.result = { name: 'Malvora', want: 'poder', method: 'exército', trait: 'sussurra', weakness: 'vaidade' }
    await svc().generateAntagonist({ locations, npcs, secrets, registry, complicacao, premissa: 'Kill a villain' })
    expect(genObj.prompt).toContain('loc-1')
    expect(genObj.prompt).toContain('npc-1')
    expect(genObj.prompt).toContain('secret-1')
    expect(genObj.prompt).toContain('Drenched')
    expect(genObj.prompt).toContain('Kill a villain')
  })

  it('falha propaga erro estruturado — NÃO devolve antagonista vazio em silêncio', async () => {
    genObj.error = new Error('modelo indisponível')
    await expect(
      svc().generateAntagonist({ locations, npcs, secrets, registry, complicacao, premissa: 'premissa' }),
    ).rejects.toThrow('modelo indisponível')
  })

  it('locale entra no system como instrução de idioma-alvo; ausente cai no default pt-BR (US-178)', async () => {
    genObj.error = undefined
    genObj.result = { name: 'Malvora', want: 'poder', method: 'exército', trait: 'sussurra', weakness: 'vaidade' }
    await svc().generateAntagonist({ locations, npcs, secrets, registry, complicacao, premissa: 'premissa', locale: 'en-US' })
    expect(genObj.system).toContain('English')

    await svc().generateAntagonist({ locations, npcs, secrets, registry, complicacao, premissa: 'premissa' })
    expect(genObj.system).toContain('Brazilian Portuguese (pt-BR)')
  })

  it('system segue a barra de ofício de geração (US-179)', async () => {
    genObj.error = undefined
    genObj.result = { name: 'Malvora', want: 'poder', method: 'exército', trait: 'sussurra', weakness: 'vaidade' }
    await svc().generateAntagonist({ locations, npcs, secrets, registry, complicacao, premissa: 'premissa' })
    expect(genObj.system).toContain(CRAFT_CORE_SECTION)
  })

  // US-183: `background.story`/`origin.adventuresAndAdvancement` presentes → instrução de
  // ligar a `connection` ao vínculo, mesmo padrão de `generateOpeningBeat` (US-180).
  it('background.story presente entra no system — instrução de ligar connection ao vínculo (US-183)', async () => {
    genObj.error = undefined
    genObj.result = { name: 'Malvora', want: 'poder', method: 'exército', trait: 'sussurra', weakness: 'vaidade', connection: 'x' }
    await svc().generateAntagonist({
      locations, npcs, secrets, registry, complicacao, premissa: 'premissa',
      background: { story: 'jurou vingança contra o culto' },
    })
    expect(genObj.system).toContain('jurou vingança contra o culto')
  })

  it('origin.adventuresAndAdvancement presente entra no system — instrução de ligar connection ao vínculo (US-183)', async () => {
    genObj.error = undefined
    genObj.result = { name: 'Malvora', want: 'poder', method: 'exército', trait: 'sussurra', weakness: 'vaidade', connection: 'x' }
    await svc().generateAntagonist({
      locations, npcs, secrets, registry, complicacao, premissa: 'premissa',
      origin: { adventuresAndAdvancement: 'pode ser promovido dentro da ordem' },
    })
    expect(genObj.system).toContain('pode ser promovido dentro da ordem')
  })

  it('background.bonds NÃO entra no system — motor de geração só consome story (US-183)', async () => {
    genObj.error = undefined
    genObj.result = { name: 'Malvora', want: 'poder', method: 'exército', trait: 'sussurra', weakness: 'vaidade', connection: 'x' }
    await svc().generateAntagonist({
      locations, npcs, secrets, registry, complicacao, premissa: 'premissa',
      background: { bonds: ['jurou vingança contra o culto'] },
    })
    expect(genObj.system).not.toContain('jurou vingança contra o culto')
  })

  // Sem âncora nenhuma, cai pro fallback genérico — nunca campo vazio (US-183, AC).
  it('sem background/origin, system cai no fallback genérico de conexão (US-183)', async () => {
    genObj.error = undefined
    genObj.result = { name: 'Malvora', want: 'poder', method: 'exército', trait: 'sussurra', weakness: 'vaidade', connection: 'x' }
    await svc().generateAntagonist({ locations, npcs, secrets, registry, complicacao, premissa: 'premissa' })
    expect(genObj.system).toContain('Sem vínculo pessoal registrado')
  })
})

describe('AiService.generateClosing (US-164)', () => {
  const locations = [{ id: 'loc-1', title: 'Enseada', aspects: [], boxedText: 'x', description: 'y', occupants: [] }]
  const npcs = [{ id: 'npc-1', name: 'Marta', role: 'herborista suspeita', interactions: [] }]
  const secrets = [{ id: 'secret-1', locationId: 'loc-1', text: 'A estalajadeira esconde uma dívida com o culto.' }]
  const registry = { tone: 'grimdark', setting: 'coastal', areaType: 'settlement' }
  const complicacao = { condition: 'Drenched', description: 'Horrific', origin: 'Aberrant' }
  const antagonist = { name: 'Malvora', want: 'poder sobre a região', method: 'reunir um exército', trait: 'fala em sussurros', weakness: 'vaidade', connection: 'já cruzou caminho com o grupo antes' }

  function svc() {
    return new AiService({} as unknown as PrismaService, {} as unknown as DiceService)
  }

  it('devolve conclusion e followUps do modelo, sem mintar id (sem entidade a referenciar)', async () => {
    genObj.error = undefined
    genObj.result = { conclusion: 'O culto recua para as sombras.', followUps: ['A dívida da estalajadeira volta a assombrar.'] }
    const closing = await svc().generateClosing({ locations, npcs, secrets, registry, complicacao, premissa: 'Kill a villain', antagonist })
    expect(closing).toEqual({ conclusion: 'O culto recua para as sombras.', followUps: ['A dívida da estalajadeira volta a assombrar.'] })
  })

  it('usa primaryModel (2026-08-19), não extractionModel', async () => {
    genObj.error = undefined
    genObj.result = { conclusion: 'fecho', followUps: ['semente'] }
    await svc().generateClosing({ locations, npcs, secrets, registry, complicacao, premissa: 'premissa', antagonist })
    expect(genObj.model).toBe(primaryModel)
  })

  it('registry (tone) entra no prompt do modelo', async () => {
    genObj.error = undefined
    genObj.result = { conclusion: 'fecho', followUps: ['semente'] }
    await svc().generateClosing({ locations, npcs, secrets, registry, complicacao, premissa: 'premissa', antagonist })
    expect(genObj.system).toContain('grimdark')
  })

  it('locais/NPCs/segredos, complicação/premissa e antagonista entram no prompt do modelo', async () => {
    genObj.error = undefined
    genObj.result = { conclusion: 'fecho', followUps: ['semente'] }
    await svc().generateClosing({ locations, npcs, secrets, registry, complicacao, premissa: 'Kill a villain', antagonist })
    expect(genObj.prompt).toContain('loc-1')
    expect(genObj.prompt).toContain('npc-1')
    expect(genObj.prompt).toContain('secret-1')
    expect(genObj.prompt).toContain('Drenched')
    expect(genObj.prompt).toContain('Kill a villain')
    expect(genObj.prompt).toContain('Malvora')
  })

  it('falha propaga erro estruturado — NÃO devolve fecho vazio em silêncio', async () => {
    genObj.error = new Error('modelo indisponível')
    await expect(
      svc().generateClosing({ locations, npcs, secrets, registry, complicacao, premissa: 'premissa', antagonist }),
    ).rejects.toThrow('modelo indisponível')
  })

  it('assinatura não aceita hookSeed — mesmo forçado por cast, nunca chega ao system/prompt do modelo (US-175)', async () => {
    genObj.error = undefined
    genObj.result = { conclusion: 'O culto recua para as sombras.', followUps: ['A dívida da estalajadeira volta a assombrar.'] }
    const hookSeed = 'A vela curva-se, Elara, numa corte de gelo e etiqueta.'
    await svc().generateClosing({ locations, npcs, secrets, registry, complicacao, premissa: 'Kill a villain', antagonist, hookSeed } as never)
    expect(genObj.system).not.toContain(hookSeed)
    expect(genObj.prompt).not.toContain(hookSeed)
    expect(genObj.prompt).not.toContain('Elara')
  })

  it('locale entra no system como instrução de idioma-alvo; ausente cai no default pt-BR (US-178)', async () => {
    genObj.error = undefined
    genObj.result = { conclusion: 'fecho', followUps: ['semente'] }
    await svc().generateClosing({ locations, npcs, secrets, registry, complicacao, premissa: 'premissa', antagonist, locale: 'en-US' })
    expect(genObj.system).toContain('English')

    await svc().generateClosing({ locations, npcs, secrets, registry, complicacao, premissa: 'premissa', antagonist })
    expect(genObj.system).toContain('Brazilian Portuguese (pt-BR)')
  })

  it('system segue a barra de ofício de geração (US-179)', async () => {
    genObj.error = undefined
    genObj.result = { conclusion: 'fecho', followUps: ['semente'] }
    await svc().generateClosing({ locations, npcs, secrets, registry, complicacao, premissa: 'premissa', antagonist })
    expect(genObj.system).toContain(CRAFT_CORE_SECTION)
  })
})

describe('AiService.generateOpeningBeat (US-172)', () => {
  const locations = [{ id: 'loc-1', title: 'Enseada', aspects: [], boxedText: 'x', description: 'y', occupants: [] }]
  const npcs = [{ id: 'npc-1', name: 'Marta', role: 'herborista suspeita', interactions: [] }]
  const secrets = [{ id: 'secret-1', locationId: 'loc-1', text: 'A estalajadeira esconde uma dívida com o culto.' }]
  const registry = { tone: 'terror', setting: 'coastal', areaType: 'settlement' }
  const complicacao = { condition: 'Drenched', description: 'Horrific', origin: 'Aberrant' }

  function svc() {
    return new AiService({} as unknown as PrismaService, {} as unknown as DiceService)
  }

  it('devolve start do modelo', async () => {
    genObj.error = undefined
    genObj.result = { start: 'A porta racha ao meio antes que Marta consiga gritar.' }
    const { start } = await svc().generateOpeningBeat({ locations, npcs, secrets, registry, complicacao, premissa: 'Sobreviver à noite' })
    expect(start).toBe('A porta racha ao meio antes que Marta consiga gritar.')
  })

  it('usa primaryModel (2026-08-19), não extractionModel', async () => {
    genObj.error = undefined
    genObj.result = { start: 'abertura' }
    await svc().generateOpeningBeat({ locations, npcs, secrets, registry, complicacao, premissa: 'premissa' })
    expect(genObj.model).toBe(primaryModel)
  })

  it('registry (tone) entra no prompt do modelo', async () => {
    genObj.error = undefined
    genObj.result = { start: 'abertura' }
    await svc().generateOpeningBeat({ locations, npcs, secrets, registry, complicacao, premissa: 'premissa' })
    expect(genObj.system).toContain('terror')
  })

  it('locais/NPCs/segredos e premissa entram no prompt do modelo — ancoragem (US-172)', async () => {
    genObj.error = undefined
    genObj.result = { start: 'abertura' }
    await svc().generateOpeningBeat({ locations, npcs, secrets, registry, complicacao, premissa: 'Sobreviver à noite' })
    expect(genObj.prompt).toContain('loc-1')
    expect(genObj.prompt).toContain('npc-1')
    expect(genObj.prompt).toContain('secret-1')
    expect(genObj.prompt).toContain('Sobreviver à noite')
  })

  it('assinatura não aceita hookSeed — mesmo forçado por cast, nunca chega ao system/prompt do modelo', async () => {
    genObj.error = undefined
    genObj.result = { start: 'abertura' }
    const hookSeed = 'A vela curva-se, Elara, numa corte de gelo e etiqueta.'
    // O tipo de `generateOpeningBeat` não tem campo `hookSeed` (US-172, Escopo) — um
    // objeto literal normal já seria rejeitado em compile-time (excess property check).
    // O cast `as never` simula o pior caso (alguém força a passagem) pra provar que a
    // implementação também não LÊ a chave, mesmo que ela chegue ao runtime.
    await svc().generateOpeningBeat({ locations, npcs, secrets, registry, complicacao, premissa: 'premissa', hookSeed } as never)
    expect(genObj.system).not.toContain(hookSeed)
    expect(genObj.prompt).not.toContain(hookSeed)
  })

  it('falha propaga erro estruturado — NÃO devolve abertura vazia em silêncio', async () => {
    genObj.error = new Error('modelo indisponível')
    await expect(
      svc().generateOpeningBeat({ locations, npcs, secrets, registry, complicacao, premissa: 'premissa' }),
    ).rejects.toThrow('modelo indisponível')
  })

  // US-180: `complicacao` precisa entrar no PROMPT (não só o tipo em `params`), senão o
  // modelo nunca lê condition/description/origin — mesmo formato de `generateClosing`.
  it('complicação entra no prompt do modelo (US-180)', async () => {
    genObj.error = undefined
    genObj.result = { start: 'abertura' }
    await svc().generateOpeningBeat({ locations, npcs, secrets, registry, complicacao, premissa: 'premissa' })
    expect(genObj.prompt).toContain('Drenched')
    expect(genObj.prompt).toContain('Horrific')
    expect(genObj.prompt).toContain('Aberrant')
  })

  it('background.story presente entra no system — instrução de ancorar a cena no vínculo (US-180)', async () => {
    genObj.error = undefined
    genObj.result = { start: 'abertura' }
    await svc().generateOpeningBeat({
      locations, npcs, secrets, registry, complicacao, premissa: 'premissa',
      background: { story: 'jurou vingança contra o culto' },
    })
    expect(genObj.system).toContain('jurou vingança contra o culto')
  })

  it('background.bonds NÃO entra no system — motor de geração só consome story', async () => {
    genObj.error = undefined
    genObj.result = { start: 'abertura' }
    await svc().generateOpeningBeat({
      locations, npcs, secrets, registry, complicacao, premissa: 'premissa',
      background: { bonds: ['jurou vingança contra o culto'] },
    })
    expect(genObj.system).not.toContain('jurou vingança contra o culto')
  })

  it('origin.adventuresAndAdvancement presente entra no system — instrução de ancorar a cena no vínculo (US-180)', async () => {
    genObj.error = undefined
    genObj.result = { start: 'abertura' }
    await svc().generateOpeningBeat({
      locations, npcs, secrets, registry, complicacao, premissa: 'premissa',
      origin: { adventuresAndAdvancement: 'pode ser promovido dentro da ordem' },
    })
    expect(genObj.system).toContain('pode ser promovido dentro da ordem')
  })

  it('origin.connection/memento NÃO entram no system (só adventuresAndAdvancement alimenta o motor)', async () => {
    genObj.error = undefined
    genObj.result = { start: 'abertura' }
    await svc().generateOpeningBeat({
      locations, npcs, secrets, registry, complicacao, premissa: 'premissa',
      origin: { connection: 'um sacerdote amado', memento: 'um livro de orações' } as never,
    })
    expect(genObj.system).not.toContain('um sacerdote amado')
    expect(genObj.system).not.toContain('um livro de orações')
  })

  it('background/origin vazios cai em instrução genérica de ancoragem, SEM gancho da classe (US-180)', async () => {
    genObj.error = undefined
    genObj.result = { start: 'abertura' }
    await svc().generateOpeningBeat({ locations, npcs, secrets, registry, complicacao, premissa: 'premissa' })
    expect(genObj.system).toContain('já foi rolado para esta aventura')
  })

  it('system não tem mais fallback único de combate — oferece Enraizada e Confronto nomeados (US-180)', async () => {
    genObj.error = undefined
    genObj.result = { start: 'abertura' }
    await svc().generateOpeningBeat({ locations, npcs, secrets, registry, complicacao, premissa: 'premissa' })
    expect(genObj.system).not.toContain('Sem conflito óbvio na premissa/locations/npcs/secrets recebidos, abra com confronto ou ameaça imediata.')
    expect(genObj.system).toContain('ENRAIZADA')
    expect(genObj.system).toContain('CONFRONTO')
  })

  it('system exige mirar pelo menos 2 de recompensa/heroísmo/descoberta (US-182)', async () => {
    genObj.error = undefined
    genObj.result = { start: 'abertura' }
    await svc().generateOpeningBeat({ locations, npcs, secrets, registry, complicacao, premissa: 'premissa' })
    expect(genObj.system).toContain('RECOMPENSA')
    expect(genObj.system).toContain('HEROÍSMO')
    expect(genObj.system).toContain('DESCOBERTA')
    expect(genObj.system).toContain('pelo menos 2')
  })

  it('locale entra no system como instrução de idioma-alvo; ausente cai no default pt-BR (US-178)', async () => {
    genObj.error = undefined
    genObj.result = { start: 'abertura' }
    await svc().generateOpeningBeat({ locations, npcs, secrets, registry, complicacao, premissa: 'premissa', locale: 'en-US' })
    expect(genObj.system).toContain('English')

    await svc().generateOpeningBeat({ locations, npcs, secrets, registry, complicacao, premissa: 'premissa' })
    expect(genObj.system).toContain('Brazilian Portuguese (pt-BR)')
  })

  it('system segue a barra de ofício de geração (US-179)', async () => {
    genObj.error = undefined
    genObj.result = { start: 'abertura' }
    await svc().generateOpeningBeat({ locations, npcs, secrets, registry, complicacao, premissa: 'premissa' })
    expect(genObj.system).toContain(CRAFT_CORE_SECTION)
  })
})

// US-168 — a abertura passa a receber `entities` (o mesmo ledger que o turno 1 persiste)
// e `tone` (registo da aventura gerada), e repassa `mainQuest` para `buildOpeningInstruction`
// em vez de só `hookSeed`. Metade determinística (o que chega ao PROMPT) — a narração de
// fato honrar isso é o bake-off da US-17.
describe('AiService.generateOpeningNarration (US-168)', () => {
  function svc() {
    return new AiService({} as unknown as PrismaService, {} as unknown as DiceService)
  }

  const baseParams = {
    systemName: 'D&D 5e',
    characterName: 'Aria',
    characterGender: 'feminino',
    characterClass: 'bardo',
    characterRace: 'humana',
    inventory: [],
    sheet: { level: 1, hp: 10, maxHp: 10, attributes: {}, conditions: [] },
    hookSeed: 'Um Eladrin convida você para dançar na corte feérica.',
  }

  it('mainQuest presente vira a fagulha do prompt de abertura — hookSeed some dele', async () => {
    salvage.text = 'abertura gerada'
    const mainQuest = 'Proteja a criança Mira dos caçadores que cercam a mina de Kelgrund.'

    await svc().generateOpeningNarration({ ...baseParams, mainQuest })

    expect(salvage.prompt).toContain(mainQuest)
    expect(salvage.prompt).not.toContain(baseParams.hookSeed)
  })

  it('entities (ledger semeado) entra no turn-state do prompt de abertura', async () => {
    salvage.text = 'abertura gerada'
    const entities = [{ nome: 'Mira', tipo: 'npc' as const, local: 'Mina de Kelgrund', sabido: 'publico' as const, revelado: true, atualizadoEm: new Date().toISOString() }]

    await svc().generateOpeningNarration({ ...baseParams, entities })

    expect(salvage.prompt).toContain('Mira')
    expect(salvage.prompt).toContain('Mina de Kelgrund')
  })

  it('sem entities, cai no ramo "nenhuma entidade registrada" (comportamento atual, sem quebrar)', async () => {
    salvage.text = 'abertura gerada'

    await svc().generateOpeningNarration({ ...baseParams })

    expect(salvage.prompt).toMatch(/nenhuma entidade registrada ainda/)
  })

  it('tone entra no system prompt da abertura (mesmo campo que os turnos normais)', async () => {
    salvage.text = 'abertura gerada'

    await svc().generateOpeningNarration({ ...baseParams, tone: 'grimdark' })

    expect(salvage.system).toMatch(/Narrate in this register: grimdark/)
  })

  it('setting/areaType entram no system prompt da abertura (US-185, mesmo campo dos turnos normais)', async () => {
    salvage.text = 'abertura gerada'

    await svc().generateOpeningNarration({ ...baseParams, setting: 'underdark', areaType: 'dungeon' })

    expect(salvage.system).toContain('underdark')
    expect(salvage.system).toContain('dungeon')
  })
})
