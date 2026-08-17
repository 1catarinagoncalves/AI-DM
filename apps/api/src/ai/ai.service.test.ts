import { describe, it, expect, vi } from 'vitest'
import { AiService, scenePatchFromExtraction, applyInventoryDeltas } from './ai.service'
import { mergeSceneState, extractionModel } from '@ai-dm/ai-engine'
import type { InventoryItem, SceneState } from '@ai-dm/shared'
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

describe('AiService.generateLocationsAndNpcs (US-158)', () => {
  const rolled = {
    premissa: 'Open a gate',
    locais: 'Cove',
    monumentos: 'Cage',
    complicacao: { condition: 'Drenched', description: 'Horrific', origin: 'Aberrant' },
    patronsandnpcs: Array.from({ length: 7 }, () => ({ behavior: 'Sly', ancestry: 'Human' })),
  }
  const registry = { setting: 'coastal', tone: 'grimdark', areaType: 'ruins' }

  function svc() {
    return new AiService({} as unknown as PrismaService, {} as unknown as DiceService)
  }

  it('minta id no código (loc-N/npc-N), nunca deixado ao modelo', async () => {
    genObj.error = undefined
    genObj.result = {
      locations: [{ title: 'Enseada Cinzenta', aspects: ['maré alta'], boxedText: 'Você chega à enseada.', description: 'notas do mestre', occupants: ['Marta'] }],
      npcs: [{ name: 'Marta', role: 'a arquétipo herborista suspeita' }],
    }
    const { locations, npcs } = await svc().generateLocationsAndNpcs({ rolled, registry, hookSeed: 'gancho' })
    expect(npcs[0]!.id).toBe('npc-1')
    expect(locations[0]!.id).toBe('loc-1')
    expect(locations[0]!.occupants).toEqual(['npc-1']) // resolvido por nome → id
  })

  it('occupant sem NPC correspondente fica cru (melhor esforço — gate é US-150)', async () => {
    genObj.error = undefined
    genObj.result = {
      locations: [{ title: 'Torre', aspects: [], boxedText: 'x', description: 'y', occupants: ['Fantasma sem nome'] }],
      npcs: [{ name: 'Marta', role: 'papel' }],
    }
    const { locations } = await svc().generateLocationsAndNpcs({ rolled, registry, hookSeed: 'gancho' })
    expect(locations[0]!.occupants).toEqual(['Fantasma sem nome'])
  })

  it('usa extractionModel (US-114), não primaryModel', async () => {
    genObj.error = undefined
    genObj.result = { locations: [{ title: 't', aspects: [], boxedText: 'b', description: 'd', occupants: [] }], npcs: [{ name: 'n', role: 'r' }] }
    await svc().generateLocationsAndNpcs({ rolled, registry, hookSeed: 'gancho' })
    expect(genObj.model).toBe(extractionModel)
  })

  it('background.bonds presente entra no prompt do modelo', async () => {
    genObj.error = undefined
    genObj.result = { locations: [{ title: 't', aspects: [], boxedText: 'b', description: 'd', occupants: [] }], npcs: [{ name: 'n', role: 'r' }] }
    await svc().generateLocationsAndNpcs({ rolled, registry, hookSeed: 'gancho', background: { bonds: ['jurou vingança contra o culto'] } })
    expect(genObj.system).toContain('jurou vingança contra o culto')
  })

  it('background/origin vazios cai no hookSeed como âncora (US-148)', async () => {
    genObj.error = undefined
    genObj.result = { locations: [{ title: 't', aspects: [], boxedText: 'b', description: 'd', occupants: [] }], npcs: [{ name: 'n', role: 'r' }] }
    await svc().generateLocationsAndNpcs({ rolled, registry, hookSeed: 'gancho da abertura' })
    expect(genObj.system).toContain('gancho da abertura')
  })

  it('falha propaga erro estruturado — NÃO devolve array vazio em silêncio', async () => {
    genObj.error = new Error('modelo indisponível')
    await expect(svc().generateLocationsAndNpcs({ rolled, registry, hookSeed: 'gancho' })).rejects.toThrow('modelo indisponível')
  })
})
