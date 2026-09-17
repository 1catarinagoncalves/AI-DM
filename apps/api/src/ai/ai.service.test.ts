import { describe, it, expect, vi } from 'vitest'
import {
  AiService,
  scenePatchFromExtraction,
  applyInventoryDeltas,
  resolveGainedDeltas,
  resolveLostItems,
  composeMainQuestText,
  OPENING_SCENE_SCHEMA,
} from './ai.service'
import { mergeSceneState, extractionModel, authoringModels } from '@ai-dm/ai-engine'
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
  // `hangAttempts`: quantas das primeiras chamadas devem TRAVAR (nunca resolver, exceto
  // se abortadas) em vez de resolver/rejeitar na hora — simula um provedor da escada que
  // não responde nem fecha a conexão (bug de timeout ausente, ver AUTHORING_TIMEOUT_MS).
  genObj: { result: undefined as unknown, error: undefined as unknown, system: '', prompt: '', model: undefined as unknown, calls: 0, hangAttempts: 0 },
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
  generateObject: async ({ system, prompt, model, abortSignal }: { system: string; prompt: string; model: unknown; abortSignal?: AbortSignal }) => {
    genObj.system = system
    genObj.prompt = prompt
    genObj.model = model
    genObj.calls += 1
    if (genObj.calls <= genObj.hangAttempts) {
      return new Promise((_resolve, reject) => {
        abortSignal?.addEventListener('abort', () => reject(new Error('This operation was aborted')))
      })
    }
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

// US-232: motor de autoria mundo-primeiro (call único, escada de modelos). Fake de
// `generateObject` (genObj) devolve o objeto bruto por índice; o parse/minting vive em
// adventure.service, não aqui. Testa o encanamento: params viram restrição no prompt, e a
// escada NUNCA degrada em silêncio (todos os modelos falhando lança).
describe('AiService.generateAdventureAuthoring (US-232)', () => {
  function svc() {
    return new AiService({} as unknown as PrismaService, {} as unknown as DiceService)
  }
  const authored = {
    world: { name: 'Vhel-Toran', description: 'Cidade entre costelas.', anchors: [] },
    summary: 'Três facções disputam um sarcófago.',
    story: 'O conflito central.',
    factions: [
      { name: 'Guardiões', kind: 'ordem', want: 'selar' },
      { name: 'Sindicato', kind: 'submundo', want: 'vender' },
    ],
    npcs: [{ name: 'Kesh', role: 'guardiã', want: 'proteger', factionIndex: 0 }],
    locations: [{ title: 'A Nave', aspects: [], boxedText: 'x', description: 'y', occupants: [0], vibe: 'social' }],
    challenges: [{ locationIndex: 0, test: 'teste de Força', situation: 'escalar', consequence: 'cai' }],
    encounters: [{ locationIndex: 0, npcIndices: [0], type: 'combat', fiction: 'z', behaviors: 'a', goal: 'b', complications: 'c', unlocks: 'd' }],
    objective: { description: 'decidir o destino', reward: { name: 'Cinzel', effect: 'sela ecos' }, locationIndex: 0 },
    branchedResolution: [{ choice: 'selar', consequence: 'os nomes calam' }],
    start: 'O gancho.',
    followUps: ['algo desperta'],
  }

  // US-250: orçamento de combate neutro (>0) pros testes que não são sobre ele — só os 2
  // testes dedicados no fim do describe variam `combatBudget`.
  const combatBudget = { maxHostileCount: 4, viable: true }

  it('devolve o objeto bruto do modelo (sem mintar ids — isso é do adventure.service) + modelId do arm vencedor', async () => {
    genObj.error = undefined
    genObj.result = authored
    const result = await svc().generateAdventureAuthoring({ world: {}, factionCount: 3, counts: { locations: 6, npcs: 7, challenges: 3, encounters: 3 }, namingRegister: 'Celtic', questSeed: 'Kill a villain because a Sly Elf demands it', level: 3, className: 'ladino', combatBudget })
    expect(result.adventure).toBe(authored)
    expect(result.modelId).toBe(authoringModels[0]!.modelId)
  })

  it('contagem de facções, contagens fixas e história do personagem entram no prompt', async () => {
    genObj.error = undefined
    genObj.result = authored
    await svc().generateAdventureAuthoring({
      world: { tone: 'Sombrio' },
      factionCount: 4,
      counts: { locations: 6, npcs: 7, challenges: 3, encounters: 3 },
      characterStory: 'cresceu batendo carteira nos cais',
      namingRegister: 'Celtic',
      questSeed: 'Kill a villain because a Sly Elf demands it',
      level: 3,
      className: 'ladino',
      combatBudget,
    })
    expect(genObj.prompt).toContain('4 facções')
    expect(genObj.prompt).toContain('cresceu batendo carteira nos cais')
    expect(genObj.prompt).toContain('Sombrio')
  })

  // US-240: registro de nomenclatura sorteado por adventure.service entra como restrição
  // cobrindo TODO nome próprio — não só o mundo — e prima sobre o passo 1 da Onomástica.
  it('registro de nomenclatura entra no prompt, cobrindo mundo/facções/locais/NPCs/recompensa', async () => {
    genObj.error = undefined
    genObj.result = authored
    await svc().generateAdventureAuthoring({
      world: {},
      factionCount: 3,
      counts: { locations: 6, npcs: 7, challenges: 3, encounters: 3 },
      namingRegister: 'Norse/Germanic',
      questSeed: 'Kill a villain because a Sly Elf demands it',
      level: 3,
      className: 'ladino',
      combatBudget,
    })
    expect(genObj.prompt).toContain('Norse/Germanic')
    expect(genObj.prompt).toMatch(/facç(ões|ão)/)
    expect(genObj.prompt).toMatch(/locais/)
    expect(genObj.prompt).toMatch(/NPCs/)
    expect(genObj.prompt).toMatch(/recompensa/)
  })

  it('escada esgotada (todos os modelos falham) LANÇA — nunca degrada em silêncio', async () => {
    genObj.error = new Error('modelo indisponível')
    await expect(
      svc().generateAdventureAuthoring({
        world: {},
        factionCount: 3,
        counts: { locations: 6, npcs: 7, challenges: 3, encounters: 3 },
        namingRegister: 'Celtic',
        questSeed: 'Kill a villain because a Sly Elf demands it',
        level: 3,
        className: 'ladino',
        combatBudget,
      }),
    ).rejects.toThrow('modelo indisponível')
  })

  // Regressão: modelo que TRAVA (nunca resolve, nunca rejeita — nem timeout nem erro de
  // rede) tinha o processo pendurado pra sempre, sem cair pro próximo da escada. Fixa via
  // `abortSignal: AbortSignal.timeout(AUTHORING_TIMEOUT_MS)` na chamada. Aqui o fake
  // `AbortSignal.timeout` é substituído por um disparo quase instantâneo — o valor real
  // (180s) não pode rodar num teste — só o encanamento (aborta → cai pro próximo) é testado.
  it('modelo trava sem responder (nem resolve nem rejeita) → timeout aborta e cai pro próximo da escada', async () => {
    const realTimeout = AbortSignal.timeout
    AbortSignal.timeout = ((_ms: number) => {
      const controller = new AbortController()
      setTimeout(() => controller.abort(new Error('TimeoutError')), 5)
      return controller.signal
    }) as typeof AbortSignal.timeout
    try {
      genObj.error = undefined
      genObj.result = authored
      genObj.calls = 0
      genObj.hangAttempts = 1
      const result = await svc().generateAdventureAuthoring({
        world: {},
        factionCount: 3,
        counts: { locations: 6, npcs: 7, challenges: 3, encounters: 3 },
        namingRegister: 'Celtic',
        questSeed: 'Kill a villain because a Sly Elf demands it',
        level: 3,
        className: 'ladino',
        combatBudget,
      })
      expect(result.adventure).toBe(authored)
      expect(genObj.calls).toBe(2)
    } finally {
      AbortSignal.timeout = realTimeout
      genObj.hangAttempts = 0
    }
  })

  // US-241: `rollQuestSeed` vira restrição obrigatória de `summary`, no MESMO call único —
  // sem round-trip novo. `system` ganha o guarda-corpo negativo contra vazamento de palavra em
  // inglês (mesma categoria de risco de `patronsandnpcs`); só com `world.setting` presente o
  // `prompt` pede a TRANSPOSIÇÃO do vocabulário medieval-padrão do MacGuffin pro eixo de Cenário.
  it('questSeed chega ao prompt, e o system instrui traduzir/adaptar sem copiar a palavra em inglês', async () => {
    genObj.error = undefined
    genObj.result = authored
    await svc().generateAdventureAuthoring({
      world: {},
      factionCount: 3,
      counts: { locations: 6, npcs: 7, challenges: 3, encounters: 3 },
      namingRegister: 'Celtic',
      questSeed: 'Kill a villain because of the Obelisk in the Crypts, which is Smoky and Ruined',
      level: 3,
      className: 'ladino',
      combatBudget,
    })
    expect(genObj.prompt).toContain('Kill a villain because of the Obelisk in the Crypts, which is Smoky and Ruined')
    expect(genObj.system).toMatch(/traduza|adapte/i)
    expect(genObj.system).toMatch(/nunca copie a palavra em ingl[êe]s/i)
  })

  it('com world.setting presente, o prompt pede TRANSPOR o MacGuffin pro Cenário restringido', async () => {
    genObj.error = undefined
    genObj.result = authored
    await svc().generateAdventureAuthoring({
      world: { setting: 'cyberpunk' },
      factionCount: 3,
      counts: { locations: 6, npcs: 7, challenges: 3, encounters: 3 },
      namingRegister: 'Celtic',
      questSeed: 'Kill a villain because a Sly Elf demands it',
      level: 3,
      className: 'ladino',
      combatBudget,
    })
    expect(genObj.prompt).toMatch(/TRANSPON[HA]A|transponha/i)
    expect(genObj.prompt).toMatch(/Cenário/)
  })

  it('sem world.setting (Aleatório), a instrução de transposição NÃO entra no prompt', async () => {
    genObj.error = undefined
    genObj.result = authored
    await svc().generateAdventureAuthoring({
      world: {},
      factionCount: 3,
      counts: { locations: 6, npcs: 7, challenges: 3, encounters: 3 },
      namingRegister: 'Celtic',
      questSeed: 'Kill a villain because a Sly Elf demands it',
      level: 3,
      className: 'ladino',
      combatBudget,
    })
    expect(genObj.prompt).not.toMatch(/TRANSPON[HA]A|transponha/i)
  })

  // US-236: os 3 eixos de mundo (cenário/tom/tipo de área) viram linha de restrição
  // ROTULADA no prompt quando o jogador escolheu (nunca a chave); "Aleatório" (eixo
  // ausente) some da lista e cai no fallback "livre" — nenhum sorteio determinístico.
  it('os 3 eixos de mundo entram como linha rotulada; sem nenhum, cai no fallback "livre"', async () => {
    genObj.error = undefined
    genObj.result = authored
    await svc().generateAdventureAuthoring({
      world: { setting: 'Cyberpunk urbano', tone: 'Sombrio', areaType: 'Masmorra' },
      factionCount: 3,
      counts: { locations: 6, npcs: 7, challenges: 3, encounters: 3 },
      namingRegister: 'Celtic',
      questSeed: 'Kill a villain because a Sly Elf demands it',
      level: 3,
      className: 'ladino',
      combatBudget,
    })
    expect(genObj.prompt).toContain('- Cenário: Cyberpunk urbano')
    expect(genObj.prompt).toContain('- Tom: Sombrio')
    expect(genObj.prompt).toContain('- Tipo de área: Masmorra')

    await svc().generateAdventureAuthoring({
      world: {},
      factionCount: 3,
      counts: { locations: 6, npcs: 7, challenges: 3, encounters: 3 },
      namingRegister: 'Celtic',
      questSeed: 'Kill a villain because a Sly Elf demands it',
      level: 3,
      className: 'ladino',
      combatBudget,
    })
    expect(genObj.prompt).not.toMatch(/Cenário:|Tom:|Tipo de área:/)
    expect(genObj.prompt).toContain('Sem eixos de mundo fixados')
  })

  // US-250: orçamento de CR calculado ANTES da autoria (composeEncounterRoles, adventure.service.ts)
  // vira restrição no prompt — a autoria nunca mais escreve `combat` que a mecânica já sabe, de
  // antemão, que não vai caber (ver US-250, Contexto e motivação).
  it('orçamento viável (>0) → prompt tem a contagem MÁXIMA de inimigos por encontro combat, sem proibir type: combat', async () => {
    genObj.error = undefined
    genObj.result = authored
    await svc().generateAdventureAuthoring({
      world: {},
      factionCount: 3,
      counts: { locations: 6, npcs: 7, challenges: 3, encounters: 3 },
      namingRegister: 'Celtic',
      questSeed: 'Kill a villain because a Sly Elf demands it',
      level: 5,
      className: 'ladino',
      combatBudget: { maxHostileCount: 6, viable: true },
    })
    expect(genObj.prompt).toContain('6')
    expect(genObj.prompt).toMatch(/combat/)
    expect(genObj.prompt).not.toMatch(/PROIBID[OA]/i)
  })

  it('orçamento 0 (nível 1-3, modo adventure) → prompt PROÍBE type: combat em qualquer encontro', async () => {
    genObj.error = undefined
    genObj.result = authored
    await svc().generateAdventureAuthoring({
      world: {},
      factionCount: 3,
      counts: { locations: 6, npcs: 7, challenges: 3, encounters: 3 },
      namingRegister: 'Celtic',
      questSeed: 'Kill a villain because a Sly Elf demands it',
      level: 3,
      className: 'ladino',
      combatBudget: { maxHostileCount: 0, viable: false },
    })
    expect(genObj.prompt).toMatch(/PROIBID[OA].*combat/i)
  })
})
