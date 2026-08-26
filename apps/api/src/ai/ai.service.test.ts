import { describe, it, expect, vi } from 'vitest'
import {
  AiService,
  scenePatchFromExtraction,
  applyInventoryDeltas,
  resolveGainedDeltas,
  resolveLostItems,
  composeMainQuestText,
  OPENING_SCENE_SCHEMA,
  CLOSING_SCHEMA,
} from './ai.service'
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

describe('resolveGainedDeltas (US-200)', () => {
  it('nome que não casa com item existente vira +1', () => {
    const current: InventoryItem[] = [{ name: 'Adaga', qty: 1 }]
    expect(resolveGainedDeltas(current, ['Poção de cura'])).toEqual([{ name: 'Poção de cura', delta: 1 }])
  })

  it('nome que casa (tolerante a acento/caixa) com item já existente NÃO duplica', () => {
    const current: InventoryItem[] = [{ name: 'Lúcivis', qty: 1 }]
    expect(resolveGainedDeltas(current, ['lucivis'])).toEqual([])
  })

  it('mistura de novo e já existente: só o novo vira delta', () => {
    const current: InventoryItem[] = [{ name: 'Adaga', qty: 1 }]
    const deltas = resolveGainedDeltas(current, ['adaga', 'Corda'])
    expect(deltas).toEqual([{ name: 'Corda', delta: 1 }])
  })

  it('lista vazia não gera delta', () => {
    expect(resolveGainedDeltas([{ name: 'Adaga', qty: 1 }], [])).toEqual([])
  })
})

describe('resolveLostItems (US-200)', () => {
  const current: InventoryItem[] = [{ name: 'Lúcivis', qty: 1 }, { name: 'Adaga', qty: 1 }]

  it('local do item IGUAL ao local final da personagem: sai do inventário e entra em objetos_em_cena', () => {
    const { deltas, sceneAdditions, ledgerPatches } = resolveLostItems(
      current,
      [{ name: 'lucivis', evidencia: 'largou o símbolo Lúcivis no chão da sacristia', local: 'sacristia' }],
      'Sacristia',
    )
    expect(deltas).toEqual([{ name: 'Lúcivis', delta: -1 }])
    expect(sceneAdditions).toEqual(['Lúcivis'])
    expect(ledgerPatches).toEqual([])
  })

  it('local do item DIFERENTE do local final da personagem: sai do inventário e vira entidade do ledger', () => {
    const { deltas, sceneAdditions, ledgerPatches } = resolveLostItems(
      current,
      [{ name: 'lucivis', evidencia: 'o símbolo Lúcivis caiu no poço', local: 'poço' }],
      'porão do culto',
    )
    expect(deltas).toEqual([{ name: 'Lúcivis', delta: -1 }])
    expect(sceneAdditions).toEqual([])
    expect(ledgerPatches).toEqual([{ nome: 'Lúcivis', tipo: 'objeto', local: 'poço', nota: 'o símbolo Lúcivis caiu no poço' }])
  })

  it('local final da personagem desconhecido: fora do alcance por padrão, vira ledger', () => {
    const { sceneAdditions, ledgerPatches } = resolveLostItems(
      current,
      [{ name: 'Adaga', evidencia: 'deu a adaga ao ferreiro', local: 'forja' }],
      undefined,
    )
    expect(sceneAdditions).toEqual([])
    expect(ledgerPatches).toHaveLength(1)
  })

  it('nome que NÃO casa com item existente é ignorado — sem delta, sem cena, sem ledger', () => {
    const { deltas, sceneAdditions, ledgerPatches } = resolveLostItems(
      current,
      [{ name: 'Escudo', evidencia: 'jogou o escudo no rio', local: 'rio' }],
      'rio',
    )
    expect(deltas).toEqual([])
    expect(sceneAdditions).toEqual([])
    expect(ledgerPatches).toEqual([])
  })

  it('lista vazia: nenhum efeito', () => {
    expect(resolveLostItems(current, [], 'sacristia')).toEqual({ deltas: [], sceneAdditions: [], ledgerPatches: [] })
  })
})

// US-194: `Quest.description` passa a ser `generated.summary` (mesmo texto de `title`) —
// o bloco `## Main quest` do turno não pode repetir a premissa duas vezes.
describe('composeMainQuestText (US-194)', () => {
  it('title === description: emite o texto UMA vez, não duas', () => {
    const text = composeMainQuestText({ title: 'Impedir Malvora.', description: 'Impedir Malvora.', objective: null })
    expect(text).toBe('Impedir Malvora.')
  })

  it('title !== description (quest legada pré-US-194): concatena os dois, como antes', () => {
    const text = composeMainQuestText({ title: 'Impedir Malvora.', description: 'A porta racha ao meio.', objective: null })
    expect(text).toBe('Impedir Malvora.\nA porta racha ao meio.')
  })

  it('objective presente soma ao final, nos dois casos', () => {
    expect(composeMainQuestText({ title: 'x', description: 'x', objective: 'Derrotar Malvora.' })).toBe('x\nDerrotar Malvora.')
    expect(composeMainQuestText({ title: 'x', description: 'y', objective: 'Derrotar Malvora.' })).toBe('x\ny\nDerrotar Malvora.')
  })

  it('objective null (quest legada pré-US-169) não vaza "null" literal no texto', () => {
    const text = composeMainQuestText({ title: 'x', description: 'x', objective: null })
    expect(text).not.toContain('null')
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

// US-192: qwen3.7-flash devolveu `objetos_em_cena` como string solta em prod
// ("fonte de pedra..., roseiras, tesoura prateada"), zod rejeitava (`expected array,
// received string`), reconcileScene falhava e a cena ficava congelada no turno anterior.
describe('OPENING_SCENE_SCHEMA — objetos_em_cena tolera string solta do modelo (US-192)', () => {
  it('string com vírgulas vira array de itens aparados', () => {
    const parsed = OPENING_SCENE_SCHEMA.parse({
      local: 'Fonte Central',
      ambiente: 'externo',
      periodo: 'noite',
      presentes: ['Caelum Folhaverde'],
      objetos_em_cena: '\nfonte de pedra, roseiras, tesoura prateada\n',
    })
    expect(parsed.objetos_em_cena).toEqual(['fonte de pedra', 'roseiras', 'tesoura prateada'])
  })

  it('array continua funcionando normalmente (comportamento antigo preservado)', () => {
    const parsed = OPENING_SCENE_SCHEMA.parse({
      local: 'Fonte Central',
      ambiente: 'externo',
      periodo: 'noite',
      presentes: [],
      objetos_em_cena: ['fonte de pedra', 'roseiras'],
    })
    expect(parsed.objetos_em_cena).toEqual(['fonte de pedra', 'roseiras'])
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

// US-200: `reconcileInventory` é privado e é LLM + DB — mesmo padrão do
// `reconcileScene`/`reconcileEncounterLedger` acima. `inventoryService` monta um
// prisma fake mínimo (characterState + adventure) e devolve as chamadas de
// `update` de cada tabela, para verificar O QUE foi persistido sem acoplar ao SQL.
describe('AiService.reconcileInventory (US-200)', () => {
  function inventoryService(state: { inventory: InventoryItem[]; sceneState: SceneState | null }, entities: WorldEntity[] | null = []) {
    const characterStateUpdates: Record<string, unknown>[] = []
    const adventureUpdates: WorldEntity[][] = []
    const prisma = {
      characterState: {
        findUnique: async () => state,
        update: async ({ data }: { data: Record<string, unknown> }) => {
          characterStateUpdates.push(data)
          return data
        },
      },
      adventure: {
        findUnique: async () => ({ entities }),
        update: async ({ data }: { data: { entities: WorldEntity[] } }) => {
          adventureUpdates.push(data.entities)
          return {}
        },
      },
    } as unknown as PrismaService
    const svc = new AiService(prisma, {} as unknown as DiceService)
    const reconcile = (svc as unknown as {
      reconcileInventory: (adventureId: string, characterId: string, narration: string, turnId?: string) => Promise<void>
    }).reconcileInventory.bind(svc)
    return { reconcile, characterStateUpdates, adventureUpdates }
  }

  const scene: SceneState = {
    local: 'porão do culto',
    ambiente: 'interno',
    periodo: 'noite',
    presentes: [],
    objetos_em_cena: [],
    atualizadoEm: '2026-08-25T00:00:00.000Z',
  }

  it('entrada simples: item adquirido aparece no inventário', async () => {
    genObj.error = undefined
    genObj.result = { adquiridos: ['Poção de cura'], perdidos: [] }
    const { reconcile, characterStateUpdates } = inventoryService({ inventory: [], sceneState: scene })

    await reconcile('adv-1', 'char-1', 'A personagem pega uma poção de cura na prateleira.')

    expect(characterStateUpdates).toHaveLength(1)
    expect(characterStateUpdates[0]!.inventory).toEqual([{ name: 'Poção de cura', qty: 1 }])
  })

  it('saída com destino cena: item largado no mesmo local da personagem sai do inventário e entra em objetos_em_cena', async () => {
    genObj.error = undefined
    genObj.result = {
      adquiridos: [],
      perdidos: [{ name: 'Lúcivis', evidencia: 'largou o símbolo Lúcivis no chão do porão', local: 'porão do culto' }],
    }
    const { reconcile, characterStateUpdates } = inventoryService({ inventory: [{ name: 'Lúcivis', qty: 1 }], sceneState: scene })

    await reconcile('adv-1', 'char-1', 'Ela larga o símbolo Lúcivis no chão do porão.')

    const inventoryUpdate = characterStateUpdates.find((u) => 'inventory' in u)
    expect(inventoryUpdate!.inventory).toEqual([])
    const sceneUpdate = characterStateUpdates.find((u) => 'sceneState' in u)
    expect((sceneUpdate!.sceneState as SceneState).objetos_em_cena).toContain('Lúcivis')
  })

  it('saída com destino ledger: item que fica em local diferente do da personagem vira entidade do ledger', async () => {
    genObj.error = undefined
    genObj.result = {
      adquiridos: [],
      perdidos: [{ name: 'Lúcivis', evidencia: 'o símbolo Lúcivis caiu no poço', local: 'poço' }],
    }
    const { reconcile, characterStateUpdates, adventureUpdates } = inventoryService({ inventory: [{ name: 'Lúcivis', qty: 1 }], sceneState: scene })

    await reconcile('adv-1', 'char-1', 'O símbolo Lúcivis escorrega e cai no poço enquanto ela segue pro porão.')

    const inventoryUpdate = characterStateUpdates.find((u) => 'inventory' in u)
    expect(inventoryUpdate!.inventory).toEqual([])
    expect(adventureUpdates).toHaveLength(1)
    expect(adventureUpdates[0]!.find((e) => e.nome === 'Lúcivis')).toMatchObject({ local: 'poço', nota: 'o símbolo Lúcivis caiu no poço' })
  })

  it('menção ambígua sem verbo de perda (extração não lista em "perdidos"): não remove', async () => {
    genObj.error = undefined
    genObj.result = { adquiridos: [], perdidos: [] }
    const { reconcile, characterStateUpdates, adventureUpdates } = inventoryService({ inventory: [{ name: 'Espada', qty: 1 }], sceneState: scene })

    await reconcile('adv-1', 'char-1', 'Ela guarda a espada na bainha.')

    expect(characterStateUpdates).toHaveLength(0)
    expect(adventureUpdates).toHaveLength(0)
  })

  it('idempotência: narração sem menção de itens não altera nada', async () => {
    genObj.error = undefined
    genObj.result = { adquiridos: [], perdidos: [] }
    const { reconcile, characterStateUpdates, adventureUpdates } = inventoryService({ inventory: [{ name: 'Adaga', qty: 1 }], sceneState: scene })

    await reconcile('adv-1', 'char-1', 'Ela conversa com o guarda sobre o clima.')

    expect(characterStateUpdates).toHaveLength(0)
    expect(adventureUpdates).toHaveLength(0)
  })

  it('falha do provedor de extração não quebra o turno: nada é persistido, erro só loga', async () => {
    genObj.result = undefined
    genObj.error = new Error('quota exceeded')
    const { reconcile, characterStateUpdates, adventureUpdates } = inventoryService({ inventory: [{ name: 'Adaga', qty: 1 }], sceneState: scene })

    await expect(reconcile('adv-1', 'char-1', 'Ela pega uma tocha na parede.')).resolves.toBeUndefined()

    expect(characterStateUpdates).toHaveLength(0)
    expect(adventureUpdates).toHaveLength(0)
    genObj.error = undefined
  })
})

describe('AiService.reconcilePostTurn (US-200)', () => {
  function postTurnService() {
    const calls: string[] = []
    const prisma = {} as unknown as PrismaService
    const svc = new AiService(prisma, {} as unknown as DiceService)
    const spySvc = svc as unknown as {
      reconcileScene: (...args: unknown[]) => Promise<void>
      reconcileInventory: (...args: unknown[]) => Promise<void>
      reconcilePostTurn: (adventureId: string, characterId: string, narration: string, playerName: string, cenaTocada: boolean, turnId?: string) => Promise<void>
    }
    spySvc.reconcileScene = async () => { calls.push('reconcileScene') }
    spySvc.reconcileInventory = async () => { calls.push('reconcileInventory') }
    return { spySvc, calls }
  }

  it('cenaTocada=false: chama reconcileScene ANTES de reconcileInventory (evita ler sceneState desatualizado)', async () => {
    const { spySvc, calls } = postTurnService()
    await spySvc.reconcilePostTurn('adv-1', 'char-1', 'narração', 'Seraphine', false, 'turn-1')
    expect(calls).toEqual(['reconcileScene', 'reconcileInventory'])
  })

  it('cenaTocada=true: reconcileScene NÃO roda (tool já commitou o local); reconcileInventory roda sempre', async () => {
    const { spySvc, calls } = postTurnService()
    await spySvc.reconcilePostTurn('adv-1', 'char-1', 'narração', 'Seraphine', true, 'turn-1')
    expect(calls).toEqual(['reconcileInventory'])
  })
})

// US-200: cobertura do segundo call site (Notas de implementação — "Dois call sites, não
// um"). `completeTruncatedTurn` não passa pelo onFinish, então precisa disparar
// `reconcileInventory` por si — regressão do mesmo bug de classe que a US-73 já cobriu
// para `reconcileScene` (turno truncado esquecido).
describe('AiService.completeTruncatedTurn → reconcileInventory (US-200)', () => {
  it('o salvamento de turno truncado também dispara reconcileInventory', async () => {
    const prisma = {
      character: { findUnique: async () => ({ name: 'Seraphine Valthor' }) },
      eventLog: { create: async ({ data }: { data: unknown }) => data, findMany: async () => [] },
    } as unknown as PrismaService
    const svc = new AiService(prisma, {} as unknown as DiceService)
    const inventoryCalls: unknown[][] = []
    ;(svc as unknown as { reconcileScene: (...a: unknown[]) => Promise<void> }).reconcileScene = async () => {}
    ;(svc as unknown as { reconcileInventory: (...a: unknown[]) => Promise<void> }).reconcileInventory = async (...args: unknown[]) => {
      inventoryCalls.push(args)
    }
    salvage.text = 'A grade cede.\n\n- 🗡️ Descer.'

    await svc.completeTruncatedTurn({ adventureId: 'adv-1', characterId: 'char-1', message: 'Descer ao poço' }, 'O beco engole o som.', 'turn-xyz')

    expect(inventoryCalls).toHaveLength(1)
    expect(inventoryCalls[0]![3]).toBe('turn-xyz') // turnId propagado
  })
})

describe('AiService.generateLocationsAndNpcs (US-158)', () => {
  const rolled = {
    premissaCandidates: ['Open a gate'],
    locais: 'Cove',
    monumentos: 'Cage',
    complicacao: { condition: 'Drenched', description: 'Horrific', origin: 'Aberrant' },
    patronsandnpcs: Array.from({ length: 7 }, () => ({ behavior: 'Sly', ancestry: 'Human' })),
  }
  const registry = { tone: 'grimdark', setting: 'coastal', areaType: 'settlement' }
  const premissa = 'Um portão amaldiçoado se abre na Enseada Cinzenta.'

  function svc() {
    return new AiService({} as unknown as PrismaService, {} as unknown as DiceService)
  }

  it('minta id no código (loc-N/npc-N), nunca deixado ao modelo', async () => {
    genObj.error = undefined
    genObj.result = {
      locations: [{ title: 'Enseada Cinzenta', aspects: ['maré alta'], boxedText: 'Você chega à enseada.', description: 'notas do mestre', occupants: [0] }],
      npcs: [{ name: 'Marta', role: 'a arquétipo herborista suspeita' }],
    }
    const { locations, npcs } = await svc().generateLocationsAndNpcs({ rolled, premissa, registry })
    expect(npcs[0]!.id).toBe('npc-1')
    expect(locations[0]!.id).toBe('loc-1')
    expect(locations[0]!.occupants).toEqual(['npc-1']) // resolvido por índice → id
  })

  // US-192: `premissa` chega explícita (não mais lida de `rolled.premissa`) — confirma que
  // é o valor recebido, não algo derivado de `rolled`, que entra no prompt.
  it('premissa (explícita, não rolled.premissa) entra no prompt do modelo', async () => {
    genObj.error = undefined
    genObj.result = { locations: [{ title: 't', aspects: [], boxedText: 'b', description: 'd', occupants: [] }], npcs: [{ name: 'n', role: 'r' }] }
    await svc().generateLocationsAndNpcs({ rolled, premissa, registry })
    expect(genObj.prompt).toContain(premissa)
  })

  // US-187: vibe rotulado pelo modelo em cada local passa direto pro AdventureLocation final.
  it('vibe do local rotulado pelo modelo passa direto pro AdventureLocation final', async () => {
    genObj.error = undefined
    genObj.result = {
      locations: [{ title: 'Arena', aspects: [], boxedText: 'x', description: 'y', occupants: [], vibe: 'combat' }],
      npcs: [{ name: 'Marta', role: 'papel' }],
    }
    const { locations } = await svc().generateLocationsAndNpcs({ rolled, premissa, registry })
    expect(locations[0]!.vibe).toBe('combat')
  })

  // US-187: registry.setting/areaType passam a entrar no system, ao lado do tone já citado.
  it('registry (setting/areaType) entra no system do modelo, ao lado do tone (US-187)', async () => {
    genObj.error = undefined
    genObj.result = { locations: [{ title: 't', aspects: [], boxedText: 'b', description: 'd', occupants: [], vibe: 'skill' }], npcs: [{ name: 'n', role: 'r' }] }
    await svc().generateLocationsAndNpcs({ rolled, premissa, registry })
    expect(genObj.system).toContain('coastal')
    expect(genObj.system).toContain('settlement')
  })

  // 2026-08-23: sem instrução explícita o modelo às vezes não marcava NENHUM local
  // como vibe:'combat', e o confronto final (sempre combat, US-166) caía no fallback
  // de round-robin cego (adventure.service.ts buildEncounterDraft) em vez de um local
  // pensado pra ele.
  it('system exige ao menos um local com vibe:combat, pro confronto final', async () => {
    genObj.error = undefined
    genObj.result = { locations: [{ title: 't', aspects: [], boxedText: 'b', description: 'd', occupants: [], vibe: 'skill' }], npcs: [{ name: 'n', role: 'r' }] }
    await svc().generateLocationsAndNpcs({ rolled, premissa, registry })
    expect(genObj.system).toContain("vibe:'combat'")
  })

  it('índice de occupant fora de faixa é descartado (2026-08-19: sem match por nome pra preservar)', async () => {
    genObj.error = undefined
    genObj.result = {
      locations: [{ title: 'Torre', aspects: [], boxedText: 'x', description: 'y', occupants: [5] }],
      npcs: [{ name: 'Marta', role: 'papel' }],
    }
    const { locations } = await svc().generateLocationsAndNpcs({ rolled, premissa, registry })
    expect(locations[0]!.occupants).toEqual([])
  })

  it('usa primaryModel (2026-08-19), não extractionModel — motor precisa amarrar NPC/local sem órfão (gate US-150)', async () => {
    genObj.error = undefined
    genObj.result = { locations: [{ title: 't', aspects: [], boxedText: 'b', description: 'd', occupants: [] }], npcs: [{ name: 'n', role: 'r' }] }
    await svc().generateLocationsAndNpcs({ rolled, premissa, registry })
    expect(genObj.model).toBe(primaryModel)
  })

  it('background/origin vazio cai em instrução genérica de ancoragem, SEM gancho da classe (US-174)', async () => {
    genObj.error = undefined
    genObj.result = { locations: [{ title: 't', aspects: [], boxedText: 'b', description: 'd', occupants: [] }], npcs: [{ name: 'n', role: 'r' }] }
    await svc().generateLocationsAndNpcs({ rolled, premissa, registry })
    expect(genObj.system).toContain('já foi rolado para esta aventura')
  })

  it('assinatura não aceita hookSeed — mesmo forçado por cast, nunca chega ao system/prompt do modelo (US-174)', async () => {
    genObj.error = undefined
    genObj.result = { locations: [{ title: 't', aspects: [], boxedText: 'b', description: 'd', occupants: [] }], npcs: [{ name: 'n', role: 'r' }] }
    const hookSeed = 'A vela curva-se, Elara, numa corte de gelo e etiqueta.'
    await svc().generateLocationsAndNpcs({ rolled, premissa, registry, hookSeed } as never)
    expect(genObj.system).not.toContain(hookSeed)
    expect(genObj.prompt).not.toContain(hookSeed)
  })

  it('falha propaga erro estruturado — NÃO devolve array vazio em silêncio', async () => {
    genObj.error = new Error('modelo indisponível')
    await expect(svc().generateLocationsAndNpcs({ rolled, premissa, registry })).rejects.toThrow('modelo indisponível')
  })

  it('system avisa que locais/monumentos rolados são palavras-semente em inglês (LGMRD), nunca nome final', async () => {
    genObj.error = undefined
    genObj.result = { locations: [{ title: 't', aspects: [], boxedText: 'b', description: 'd', occupants: [] }], npcs: [{ name: 'n', role: 'r' }] }
    await svc().generateLocationsAndNpcs({ rolled, premissa, registry })
    expect(genObj.system).toMatch(/nunca (copie|copiar).{0,80}verbatim/i)
  })

  it('system segue a regra de Onomástica (US-177) — mesma barra da narração ao vivo', async () => {
    genObj.error = undefined
    genObj.result = { locations: [{ title: 't', aspects: [], boxedText: 'b', description: 'd', occupants: [] }], npcs: [{ name: 'n', role: 'r' }] }
    await svc().generateLocationsAndNpcs({ rolled, premissa, registry })
    expect(genObj.system).toContain(ONOMASTICS_SECTION)
  })

  it('system segue a barra de ofício de geração (US-179) — concretude/sensorial e voz do NPC', async () => {
    genObj.error = undefined
    genObj.result = { locations: [{ title: 't', aspects: [], boxedText: 'b', description: 'd', occupants: [] }], npcs: [{ name: 'n', role: 'r' }] }
    await svc().generateLocationsAndNpcs({ rolled, premissa, registry })
    expect(genObj.system).toContain(CRAFT_CORE_SECTION)
    expect(genObj.system).toContain(NPC_VOICE_BULLET)
  })

  it('locale entra no system como instrução de idioma-alvo; ausente cai no default pt-BR (US-178)', async () => {
    genObj.error = undefined
    genObj.result = { locations: [{ title: 't', aspects: [], boxedText: 'b', description: 'd', occupants: [] }], npcs: [{ name: 'n', role: 'r' }] }
    await svc().generateLocationsAndNpcs({ rolled, premissa, registry, locale: 'en-US' })
    expect(genObj.system).toContain('English')

    await svc().generateLocationsAndNpcs({ rolled, premissa, registry })
    expect(genObj.system).toContain('Brazilian Portuguese (pt-BR)')
  })
})

describe('AiService.generatePremissa (US-192)', () => {
  const candidates = ['Open a gate', 'Kill a villain', 'Rescue an NPC', 'Uncover a secret', 'Clear out monsters']
  const complicacao = { condition: 'Drenched', description: 'Horrific', origin: 'Aberrant' }
  const registry = { tone: 'grimdark', setting: 'coastal', areaType: 'settlement' }

  function svc() {
    return new AiService({} as unknown as PrismaService, {} as unknown as DiceService)
  }

  it('devolve premissa não vazia', async () => {
    genObj.error = undefined
    genObj.result = { premissa: 'Um portão amaldiçoado ameaça engolir a vila natal da personagem.' }
    const { premissa } = await svc().generatePremissa({ candidates, complicacao, registry })
    expect(premissa.length).toBeGreaterThan(0)
  })

  it('os 5 candidatos chegam ao prompt', async () => {
    genObj.error = undefined
    genObj.result = { premissa: 'x' }
    await svc().generatePremissa({ candidates, complicacao, registry })
    for (const candidate of candidates) expect(genObj.prompt).toContain(candidate)
  })

  it('complicacao chega ao prompt (mesmo padrão de generateClosing) — premissa não pode destoar dela', async () => {
    genObj.error = undefined
    genObj.result = { premissa: 'x' }
    await svc().generatePremissa({ candidates, complicacao, registry })
    expect(genObj.prompt).toContain('Drenched')
    expect(genObj.prompt).toContain('Horrific')
    expect(genObj.prompt).toContain('Aberrant')
  })

  // US-192: decisão de revisão — registry entra no system, mesmo padrão de
  // generateAntagonist/generateClosing/generateLocationsAndNpcs.
  it('registry (tone/setting/areaType) entra no system', async () => {
    genObj.error = undefined
    genObj.result = { premissa: 'x' }
    await svc().generatePremissa({ candidates, complicacao, registry })
    expect(genObj.system).toContain('grimdark')
    expect(genObj.system).toContain('coastal')
    expect(genObj.system).toContain('settlement')
  })

  it('background.story presente entra no system (vínculo pessoal, characterAnchors)', async () => {
    genObj.error = undefined
    genObj.result = { premissa: 'x' }
    await svc().generatePremissa({ candidates, complicacao, registry, background: { story: 'jurou vingança contra o culto' } })
    expect(genObj.system).toContain('jurou vingança contra o culto')
  })

  it('origin.adventuresAndAdvancement presente entra no system', async () => {
    genObj.error = undefined
    genObj.result = { premissa: 'x' }
    await svc().generatePremissa({ candidates, complicacao, registry, origin: { adventuresAndAdvancement: 'o templo pede um favor' } })
    expect(genObj.system).toContain('o templo pede um favor')
  })

  it('sem background/origin cai no fallback genérico, nunca campo vazio', async () => {
    genObj.error = undefined
    genObj.result = { premissa: 'x' }
    await svc().generatePremissa({ candidates, complicacao, registry })
    expect(genObj.system).toContain('Sem vínculo pessoal registrado')
  })

  it('locale entra no system como instrução de idioma-alvo; ausente cai no default pt-BR', async () => {
    genObj.error = undefined
    genObj.result = { premissa: 'x' }
    await svc().generatePremissa({ candidates, complicacao, registry, locale: 'en-US' })
    expect(genObj.system).toContain('English')

    await svc().generatePremissa({ candidates, complicacao, registry })
    expect(genObj.system).toContain('Brazilian Portuguese (pt-BR)')
  })

  it('usa primaryModel — mesma disciplina das outras chamadas do motor', async () => {
    genObj.error = undefined
    genObj.result = { premissa: 'x' }
    await svc().generatePremissa({ candidates, complicacao, registry })
    expect(genObj.model).toBe(primaryModel)
  })

  it('falha propaga erro estruturado — NÃO devolve premissa vazia em silêncio', async () => {
    genObj.error = new Error('modelo indisponível')
    await expect(svc().generatePremissa({ candidates, complicacao, registry })).rejects.toThrow('modelo indisponível')
  })
})

describe('AiService.generateSecrets (US-149)', () => {
  const locations = [{ id: 'loc-1', title: 'Enseada', aspects: [], boxedText: 'x', description: 'y', occupants: [], vibe: 'combat' as const }]
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

  it('registry (setting/areaType) entra no system do modelo, ao lado do tone (US-186)', async () => {
    genObj.error = undefined
    genObj.result = { secrets: [{ locationId: 'loc-1', text: 'segredo' }] }
    await svc().generateSecrets({ locations, npcs, secretPrompts, registry })
    expect(genObj.system).toContain('coastal')
    expect(genObj.system).toContain('settlement')
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
  const locations = [{ id: 'loc-1', title: 'Enseada', aspects: [], boxedText: 'x', description: 'y', occupants: [], vibe: 'combat' as const }]
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

  it('registry (setting/areaType) entra no system do modelo, ao lado do tone (US-186)', async () => {
    genObj.error = undefined
    genObj.result = { name: 'Malvora', want: 'poder', method: 'exército', trait: 'sussurra', weakness: 'vaidade' }
    await svc().generateAntagonist({ locations, npcs, secrets, registry, complicacao, premissa: 'premissa' })
    expect(genObj.system).toContain('coastal')
    expect(genObj.system).toContain('settlement')
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

  // 2026-08-23: `generateAntagonist` NÃO recebe `background`/`origin` — QA local achou o
  // antagonista literalizando feature aberta do background (ex.: Hermit "voz interior",
  // pensada pra atravessar VÁRIAS aventuras) como o vilão desta aventura; derrotá-lo fechava
  // um gancho que devia continuar aberto. `connection` ancora só no que já foi rolado pra
  // esta aventura (locations/npcs/secrets) — nunca em vínculo permanente da ficha.
  it('instrução de connection nunca cita vínculo pessoal — só o que já foi rolado nesta aventura', async () => {
    genObj.error = undefined
    genObj.result = { name: 'Malvora', want: 'poder', method: 'exército', trait: 'sussurra', weakness: 'vaidade', connection: 'x' }
    await svc().generateAntagonist({ locations, npcs, secrets, registry, complicacao, premissa: 'premissa' })
    expect(genObj.system).toContain('nunca em vínculo permanente da ficha')
    expect(genObj.system).not.toContain('Vínculo pessoal da personagem')
  })
})

describe('AiService.generateClosing (US-164/US-166)', () => {
  const locations = [{ id: 'loc-1', title: 'Enseada', aspects: [], boxedText: 'x', description: 'y', occupants: [], vibe: 'combat' as const }]
  const npcs = [{ id: 'npc-1', name: 'Marta', role: 'herborista suspeita', interactions: [] }]
  const secrets = [{ id: 'secret-1', locationId: 'loc-1', text: 'A estalajadeira esconde uma dívida com o culto.' }]
  const registry = { tone: 'grimdark', setting: 'coastal', areaType: 'settlement' }
  const complicacao = { condition: 'Drenched', description: 'Horrific', origin: 'Aberrant' }
  const antagonist = { name: 'Malvora', want: 'poder sobre a região', method: 'reunir um exército', trait: 'fala em sussurros', weakness: 'vaidade', connection: 'já cruzou caminho com o grupo antes', npcId: 'npc-2' }
  // US-166: 8 encontros já resolvidos (locationId/npcIds → location/npcs reais) — o
  // último é o confronto final, exigido pelo prompt a ecoar o antagonista.
  const encounterSkeleton = Array.from({ length: 8 }, (_, i) => ({
    id: `encounter-${i + 1}`,
    type: (i === 7 ? 'combat' : 'skill') as 'combat' | 'skill' | 'social',
    location: locations[0]!,
    npcs: i === 7 ? npcs : [],
  }))
  // US-193: encounterId ecoa o id do encounterSkeleton (encounter-${i+1}) + unlocks novo.
  const encounterSituations = Array.from({ length: 8 }, (_, i) => ({
    encounterId: `encounter-${i + 1}`, behaviors: `behaviors-${i + 1}`, goal: `goal-${i + 1}`, complications: `complications-${i + 1}`, unlocks: `unlocks-${i + 1}`,
  }))

  function svc() {
    return new AiService({} as unknown as PrismaService, {} as unknown as DiceService)
  }

  // US-193 AC: CLOSING_SCHEMA rejeita qualquer item de encounterSituations sem unlocks (ou
  // sem encounterId) — falha de .parse() é motivo de re-seed (US-150), nunca vira .optional().
  describe('CLOSING_SCHEMA (US-193)', () => {
    const validClosing = { objective: 'x', conclusion: 'x', followUps: ['x'], encounterSituations }

    it('aceita os 8 itens completos (encounterId/behaviors/goal/complications/unlocks)', () => {
      expect(CLOSING_SCHEMA.safeParse(validClosing).success).toBe(true)
    })

    it('rejeita quando um item não tem unlocks', () => {
      const broken = {
        ...validClosing,
        encounterSituations: encounterSituations.map((s, i) => (i === 3 ? { ...s, unlocks: undefined } : s)),
      }
      expect(CLOSING_SCHEMA.safeParse(broken).success).toBe(false)
    })

    it('rejeita quando um item não tem encounterId', () => {
      const broken = {
        ...validClosing,
        encounterSituations: encounterSituations.map((s, i) => (i === 3 ? { ...s, encounterId: undefined } : s)),
      }
      expect(CLOSING_SCHEMA.safeParse(broken).success).toBe(false)
    })
  })

  it('devolve objective, conclusion, followUps e encounterSituations do modelo, sem mintar id (sem entidade a referenciar)', async () => {
    genObj.error = undefined
    genObj.result = { objective: 'Impedir que Malvora reúna um exército para tomar a Enseada Cinzenta.', conclusion: 'O culto recua para as sombras.', followUps: ['A dívida da estalajadeira volta a assombrar.'], encounterSituations }
    const closing = await svc().generateClosing({ locations, npcs, secrets, registry, complicacao, premissa: 'Kill a villain', antagonist, encounterSkeleton })
    expect(closing).toEqual({ objective: 'Impedir que Malvora reúna um exército para tomar a Enseada Cinzenta.', conclusion: 'O culto recua para as sombras.', followUps: ['A dívida da estalajadeira volta a assombrar.'], encounterSituations })
  })

  it('usa primaryModel (2026-08-19), não extractionModel', async () => {
    genObj.error = undefined
    genObj.result = { conclusion: 'fecho', followUps: ['semente'], encounterSituations }
    await svc().generateClosing({ locations, npcs, secrets, registry, complicacao, premissa: 'premissa', antagonist, encounterSkeleton })
    expect(genObj.model).toBe(primaryModel)
  })

  it('registry (tone) entra no prompt do modelo', async () => {
    genObj.error = undefined
    genObj.result = { conclusion: 'fecho', followUps: ['semente'], encounterSituations }
    await svc().generateClosing({ locations, npcs, secrets, registry, complicacao, premissa: 'premissa', antagonist, encounterSkeleton })
    expect(genObj.system).toContain('grimdark')
  })

  it('registry (setting/areaType) entra no system do modelo, ao lado do tone (US-186)', async () => {
    genObj.error = undefined
    genObj.result = { conclusion: 'fecho', followUps: ['semente'], encounterSituations }
    await svc().generateClosing({ locations, npcs, secrets, registry, complicacao, premissa: 'premissa', antagonist, encounterSkeleton })
    expect(genObj.system).toContain('coastal')
    expect(genObj.system).toContain('settlement')
  })

  it('locais/NPCs/segredos, complicação/premissa e antagonista entram no prompt do modelo', async () => {
    genObj.error = undefined
    genObj.result = { conclusion: 'fecho', followUps: ['semente'], encounterSituations }
    await svc().generateClosing({ locations, npcs, secrets, registry, complicacao, premissa: 'Kill a villain', antagonist, encounterSkeleton })
    expect(genObj.prompt).toContain('loc-1')
    expect(genObj.prompt).toContain('npc-1')
    expect(genObj.prompt).toContain('secret-1')
    expect(genObj.prompt).toContain('Drenched')
    expect(genObj.prompt).toContain('Kill a villain')
    expect(genObj.prompt).toContain('Malvora')
  })

  // US-166: os 8 encontros do skeleton entram no prompt, na ordem — inclui id/type/local/moradores.
  it('encounterSkeleton entra no prompt: id, type, local e moradores de cada um dos 8 encontros', async () => {
    genObj.error = undefined
    genObj.result = { conclusion: 'fecho', followUps: ['semente'], encounterSituations }
    await svc().generateClosing({ locations, npcs, secrets, registry, complicacao, premissa: 'premissa', antagonist, encounterSkeleton })
    expect(genObj.prompt).toContain('encounter-1 (skill)')
    expect(genObj.prompt).toContain('encounter-8 (combat)')
    expect(genObj.prompt).toContain('Enseada')
    expect(genObj.prompt).toContain('Marta (herborista suspeita)')
  })

  // US-193 AC: cabeçalho declara a lista como TRILHA ordenada, não conjunto de cenas soltas.
  it('encounterLines declara a lista como TRILHA, não conjunto (US-193)', async () => {
    genObj.error = undefined
    genObj.result = { conclusion: 'fecho', followUps: ['semente'], encounterSituations }
    await svc().generateClosing({ locations, npcs, secrets, registry, complicacao, premissa: 'premissa', antagonist, encounterSkeleton })
    expect(genObj.prompt).toMatch(/TRILHA ordenada/)
    expect(genObj.prompt).toMatch(/só acontece por causa do anterior/)
  })

  // US-166 AC: posição 8 (o último do skeleton) tem instrução própria — ecoar o antagonista.
  it('system instrui o ÚLTIMO encontro a ecoar want/method do antagonista; os outros só podem', async () => {
    genObj.error = undefined
    genObj.result = { conclusion: 'fecho', followUps: ['semente'], encounterSituations }
    await svc().generateClosing({ locations, npcs, secrets, registry, complicacao, premissa: 'premissa', antagonist, encounterSkeleton })
    expect(genObj.system).toMatch(/ÚLTIMO encontro.*DEVEM ecoar/s)
    expect(genObj.system).toContain('behaviors')
    expect(genObj.system).toContain('goal')
    expect(genObj.system).toContain('complications')
  })

  // US-193 AC: instrução de encadeamento no system — raciocínio de trás pra frente, goal
  // respondendo o unlocks anterior, exceção explícita da posição 1, regra de corte.
  it('system instrui raciocínio de trás pra frente, goal respondendo unlocks anterior, exceção da posição 1 e regra de corte (US-193)', async () => {
    genObj.error = undefined
    genObj.result = { conclusion: 'fecho', followUps: ['semente'], encounterSituations }
    await svc().generateClosing({ locations, npcs, secrets, registry, complicacao, premissa: 'premissa', antagonist, encounterSkeleton })
    expect(genObj.system).toMatch(/RACIOCINE de trás pra frente/)
    expect(genObj.system).toMatch(/`goal` da posição 2 em diante RESPONDE ao `unlocks` da posição anterior/)
    expect(genObj.system).toMatch(/posição 1 é EXCEÇÃO/)
    expect(genObj.system).toMatch(/REGRA DE CORTE/)
    expect(genObj.system).toContain('unlocks')
  })

  it('falha propaga erro estruturado — NÃO devolve fecho vazio em silêncio', async () => {
    genObj.error = new Error('modelo indisponível')
    await expect(
      svc().generateClosing({ locations, npcs, secrets, registry, complicacao, premissa: 'premissa', antagonist, encounterSkeleton }),
    ).rejects.toThrow('modelo indisponível')
  })

  // US-169 AC: `objective` cita `antagonist.want`/`method` (US-181), não só `antagonist.name`
  // — a instrução precisa estar no system, senão o critério fica só documentado em prosa.
  it('system instrui objective a citar want/method do antagonista, não só o nome (US-169)', async () => {
    genObj.error = undefined
    genObj.result = { objective: 'x', conclusion: 'fecho', followUps: ['semente'], encounterSituations }
    await svc().generateClosing({ locations, npcs, secrets, registry, complicacao, premissa: 'premissa', antagonist, encounterSkeleton })
    expect(genObj.system).toMatch(/objective/i)
    expect(genObj.system).toContain('want')
    expect(genObj.system).toContain('method')
    expect(genObj.system).toMatch(/nunca reduza o antagonista só ao nome/i)
  })

  it('assinatura não aceita hookSeed — mesmo forçado por cast, nunca chega ao system/prompt do modelo (US-175)', async () => {
    genObj.error = undefined
    genObj.result = { conclusion: 'O culto recua para as sombras.', followUps: ['A dívida da estalajadeira volta a assombrar.'], encounterSituations }
    const hookSeed = 'A vela curva-se, Elara, numa corte de gelo e etiqueta.'
    await svc().generateClosing({ locations, npcs, secrets, registry, complicacao, premissa: 'Kill a villain', antagonist, encounterSkeleton, hookSeed } as never)
    expect(genObj.system).not.toContain(hookSeed)
    expect(genObj.prompt).not.toContain(hookSeed)
    expect(genObj.prompt).not.toContain('Elara')
  })

  it('locale entra no system como instrução de idioma-alvo; ausente cai no default pt-BR (US-178)', async () => {
    genObj.error = undefined
    genObj.result = { conclusion: 'fecho', followUps: ['semente'], encounterSituations }
    await svc().generateClosing({ locations, npcs, secrets, registry, complicacao, premissa: 'premissa', antagonist, encounterSkeleton, locale: 'en-US' })
    expect(genObj.system).toContain('English')

    await svc().generateClosing({ locations, npcs, secrets, registry, complicacao, premissa: 'premissa', antagonist, encounterSkeleton })
    expect(genObj.system).toContain('Brazilian Portuguese (pt-BR)')
  })

  it('system segue a barra de ofício de geração (US-179)', async () => {
    genObj.error = undefined
    genObj.result = { conclusion: 'fecho', followUps: ['semente'], encounterSituations }
    await svc().generateClosing({ locations, npcs, secrets, registry, complicacao, premissa: 'premissa', antagonist, encounterSkeleton })
    expect(genObj.system).toContain(CRAFT_CORE_SECTION)
  })

  // 2026-08-23: reversão no mesmo dia do fix que dava a generateClosing acesso a
  // background/origin (ver ai.service.ts) — fecho volta a nunca receber esses campos,
  // igual a generateLocationsAndNpcs/generateSecrets, que também deixaram de ancorar
  // em vínculo pessoal (só generatePremissa continua ancorando).
  it('sem background/origin, system cai no fallback genérico de fecho', async () => {
    genObj.error = undefined
    genObj.result = { conclusion: 'fecho', followUps: ['semente'], encounterSituations }
    await svc().generateClosing({ locations, npcs, secrets, registry, complicacao, premissa: 'premissa', antagonist, encounterSkeleton })
    expect(genObj.system).toContain('Sem vínculo pessoal registrado')
  })
})

// US-169 AC (Escopo, "Teste de regressão"): heurística mínima, sem chamada de modelo — um
// `objective` que reduz o antagonista ao nome (ex.: "Impedir Malvora" sozinho) tem de
// REPROVAR aqui, senão a dependência da US-181 (want/method) vira só prosa esquecível.
// Heurística: `objective` precisa conter alguma PALAVRA (>3 letras) de `want` ou `method`
// além do nome do antagonista — ajuste fino da heurística é implementação, a checagem em
// si é o critério de aceite.
function objectiveCitesWantOrMethod(objective: string, antagonist: { want: string; method: string }): boolean {
  const words = (s: string) => s.toLowerCase().split(/[^\p{L}]+/u).filter((w) => w.length > 3)
  const objectiveWords = new Set(words(objective))
  return [...words(antagonist.want), ...words(antagonist.method)].some((w) => objectiveWords.has(w))
}

describe('objectiveCitesWantOrMethod — heurística de regressão (US-169 AC)', () => {
  const antagonist = { want: 'poder sobre a região', method: 'reunir um exército' }

  it('REPROVA objective que reduz o antagonista só ao nome', () => {
    expect(objectiveCitesWantOrMethod('Impedir Malvora', antagonist)).toBe(false)
  })

  it('APROVA objective que cita method do antagonista', () => {
    expect(objectiveCitesWantOrMethod('Impedir que Malvora reúna um exército para tomar a região', antagonist)).toBe(true)
  })

  it('APROVA objective que cita want do antagonista', () => {
    expect(objectiveCitesWantOrMethod('Tirar de Malvora o poder que ela busca sobre a região', antagonist)).toBe(true)
  })
})

// US-194: `generateOpeningBeat` (US-172) foi apagada — `start` deixou de vir de chamada de
// IA, agora é composto por código a partir do encontro 1 (`composeStartBriefing`,
// adventure.service.ts). Os testes desta chamada morrem junto; cobertura equivalente entra
// em adventure.service.test.ts (composição do briefing) e dm-system.test.ts (instrução de
// abertura ramificada por Scene type).
describe('AiService.generateAntagonistLocationProse (US-191)', () => {
  const location = { id: 'loc-8', title: 'Salão do Trono Partido', aspects: ['tetos desabando'], boxedText: 'Você chega ao salão.', description: 'Ecos de passos antigos.', occupants: [], vibe: 'combat' as const }
  const registry = { tone: 'terror', setting: 'coastal', areaType: 'settlement' }
  const antagonist = { name: 'Malvora', method: 'reunir um exército', trait: 'fala em sussurros' }

  function svc() {
    return new AiService({} as unknown as PrismaService, {} as unknown as DiceService)
  }

  it('devolve boxedText/description do modelo', async () => {
    genObj.error = undefined
    genObj.result = { boxedText: 'Malvora aguarda no trono partido.', description: 'O ar cheira a sussurros dela.' }
    const result = await svc().generateAntagonistLocationProse({ location, antagonist, registry })
    expect(result).toEqual({ boxedText: 'Malvora aguarda no trono partido.', description: 'O ar cheira a sussurros dela.' })
  })

  it('usa primaryModel', async () => {
    genObj.error = undefined
    genObj.result = { boxedText: 'x', description: 'y' }
    await svc().generateAntagonistLocationProse({ location, antagonist, registry })
    expect(genObj.model).toBe(primaryModel)
  })

  it('registry (tone/setting/areaType) entra no system do modelo', async () => {
    genObj.error = undefined
    genObj.result = { boxedText: 'x', description: 'y' }
    await svc().generateAntagonistLocationProse({ location, antagonist, registry })
    expect(genObj.system).toContain('terror')
    expect(genObj.system).toContain('coastal')
    expect(genObj.system).toContain('settlement')
  })

  it('location (título/boxedText/description atuais) e antagonist (nome/method/trait) entram no prompt', async () => {
    genObj.error = undefined
    genObj.result = { boxedText: 'x', description: 'y' }
    await svc().generateAntagonistLocationProse({ location, antagonist, registry })
    expect(genObj.prompt).toContain('Salão do Trono Partido')
    expect(genObj.prompt).toContain('Você chega ao salão.')
    expect(genObj.prompt).toContain('Malvora')
    expect(genObj.prompt).toContain('reunir um exército')
    expect(genObj.prompt).toContain('fala em sussurros')
  })

  it('falha propaga erro estruturado — NÃO devolve prosa vazia em silêncio', async () => {
    genObj.error = new Error('modelo indisponível')
    await expect(svc().generateAntagonistLocationProse({ location, antagonist, registry })).rejects.toThrow('modelo indisponível')
  })

  // US-191, teste de regressão — weakness não vaza: `antagonist` é tipado
  // Pick<'name' | 'method' | 'trait'> — weakness nem existe no parâmetro. Mesmo forçado por
  // cast (pior caso: alguém passa weakness por engano), a implementação não lê a chave.
  it('antagonist sem weakness no tipo — mesmo presente por cast, nunca chega ao prompt/system (US-191)', async () => {
    genObj.error = undefined
    genObj.result = { boxedText: 'x', description: 'y' }
    const antagonistWithWeakness = { ...antagonist, weakness: 'vaidade' } as never
    await svc().generateAntagonistLocationProse({ location, antagonist: antagonistWithWeakness, registry })
    expect(genObj.prompt).not.toContain('vaidade')
    expect(genObj.system).not.toContain('vaidade')
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
