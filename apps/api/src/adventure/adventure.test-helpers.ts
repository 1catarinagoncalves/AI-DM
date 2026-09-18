import type { SystemConfig } from '@ai-dm/shared'
import type { AiService } from '../ai/ai.service'
import type { PrismaService } from '../prisma.service'

// Fixtures compartilhadas por adventure.service.test.ts e adventure-generation.service.test.ts (US-256:
// o motor saiu de AdventureService pra AdventureGenerationService, e os dois arquivos de teste
// precisam do mesmo AiService/PrismaService falso).

// US-232: artefato BRUTO da autoria (índices, sem ids). Graph-closed depois do minting: npc-0 ocupa
// loc-0, encounter/challenge/objective em loc-0. US-256: o fake de `AiService` o PARTE em fatia
// (1A) e resto (1B) pelas chaves de `AUTHORING_SLICE_SCHEMA`, então os testes seguem escrevendo o
// artefato inteiro de uma vez.
export function authored(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    world: { name: 'Vhel-Toran', description: 'Cidade entre costelas de um deus.', anchors: ['A Nave'] },
    summary: 'Três facções disputam a Enseada Cinzenta.',
    story: 'O conflito central entre as facções.',
    factions: [
      { name: 'Guardiões', kind: 'ordem', want: 'selar a enseada' },
      { name: 'Sindicato', kind: 'submundo', want: 'saquear a enseada' },
    ],
    npcs: [{ name: 'Marta', role: 'herborista suspeita', want: 'proteger o bosque', factionIndex: 0 }],
    locations: [{ title: 'Enseada Cinzenta', aspects: ['maré alta'], boxedText: 'Você chega.', description: 'notas', occupants: [0], vibe: 'social' as const }],
    challenges: [{ locationIndex: 0, test: 'teste de Força', situation: 'escalar', consequence: 'cai' }],
    encounters: [{ locationIndex: 0, npcIndices: [0], type: 'social' as const, fiction: 'Marta barra a passagem.', behaviors: 'observa', goal: 'passar', complications: 'ela desconfia', unlocks: 'o mapa' }],
    objective: { description: 'Impedir o saque da enseada.', reward: { name: 'Selo', effect: 'sela portais' }, locationIndex: 0 },
    branchedResolution: [{ choice: 'Selar', consequence: 'os nomes calam' }, { choice: 'Abrir', consequence: 'algo desperta' }],
    start: 'O gancho: você chega à enseada ao anoitecer.',
    followUps: ['A dívida volta a assombrar.'],
    ...overrides,
  }
}

const SLICE_KEYS = ['world', 'summary', 'story', 'factions', 'npcs', 'locations', 'start']

export function splitAuthored(raw: Record<string, unknown>): { slice: Record<string, unknown>; rest: Record<string, unknown> } {
  const entries = Object.entries(raw)
  return {
    slice: Object.fromEntries(entries.filter(([key]) => SLICE_KEYS.includes(key))),
    rest: Object.fromEntries(entries.filter(([key]) => !SLICE_KEYS.includes(key))),
  }
}

// US-257: `intro` (6º parâmetro) é o retorno de `generateIntroNarration` — `null` por
// padrão (comportamento de toda a suíte pré-existente: nenhuma introdução é gravada).
// US-256: `capture` recebe os params das DUAS chamadas de autoria (1A e 1B), fundidos — os `counts`
// da 1A ({locations, npcs}) e da 1B ({challenges, encounters}) somam num objeto só, como era com a
// chamada única.
export function fakeAi(
  opening: string | null = null,
  scene: Record<string, unknown> | null = null,
  seen: Record<string, unknown> = {},
  authoredObj: Record<string, unknown> = authored(),
  capture?: Record<string, unknown>,
  intro: string | null = null,
  seenIntro: Record<string, unknown> = {},
): AiService {
  const { slice, rest } = splitAuthored(authoredObj)
  const record = (params: Record<string, unknown>) => {
    if (!capture) return
    Object.assign(capture, params, { counts: { ...(capture['counts'] as object | undefined), ...(params['counts'] as object) } })
  }
  return {
    generateOpeningNarration: async (input: Record<string, unknown>) => { Object.assign(seen, input); return opening },
    generateIntroNarration: async (input: Record<string, unknown>) => { Object.assign(seenIntro, input); return intro },
    extractOpeningScene: async () => scene,
    extractOpeningEntities: async () => null,
    generateAdventureSlice: async (params: Record<string, unknown>) => { record(params); return { slice, modelId: 'fake/model' } },
    generateAdventureRest: async (params: Record<string, unknown>) => { record(params); return { rest, modelId: 'fake/rest-model' } },
  } as unknown as AiService
}

export const config: SystemConfig = {
  // US-234: `strength`/'Força' casa com o `challenge.test` canned em `authored()` acima
  // ("teste de Força") — verificação 4 (saneamento) do gate valida perícia/atributo nomeado
  // contra este catálogo; sem esta entrada, o gate reprovaria o fixture inteiro.
  attributes: [
    { key: 'constitution', label: 'Con', min: 1, max: 20, default: 10 },
    { key: 'strength', label: 'Força', min: 1, max: 20, default: 10 },
  ],
  startingKits: { fighter: [{ name: 'Espada longa', qty: 1 }], default: [{ name: 'Adaga', qty: 1 }] },
  races: [{ key: 'human', label: 'Humano' }],
  classes: [{ key: 'wizard', label: 'Mago' }],
  backgroundEquipment: { 'a5e-ag_acolyte': [{ name: 'Símbolo sagrado', qty: 1 }, { name: 'Túnica', qty: 1 }] },
  backgrounds: [
    {
      key: 'a5e-ag_acolyte', name: 'Acólito', source: 'a5e-ag',
      benefits: [{ type: 'adventures_and_advancement', name: 'Chamado', description: 'O templo pede um favor.' }],
    },
  ],
  initialAdventures: {
    hooks: [
      {
        id: 'mago-arquivo', classKey: 'wizard', title: 'O Arquivo Que Sussurra',
        pitch: 'Um grimório reconhece {characterName}.',
        primaryQuestTitle: 'Decifrar o Arquivo', primaryQuestDescription: 'Descubra o que o grimório sussurra a {characterName}.',
        openingNarration: 'A vela curva-se, {characterName}.',
        tags: [],
      },
      {
        id: 'default-sinal', classKey: 'default', title: 'O Primeiro Sinal de {characterClass}',
        pitch: 'Algo reconhece {characterName}.',
        primaryQuestTitle: 'Responder ao Chamado', primaryQuestDescription: 'Descubra o que o mundo espera de {characterName}, {characterClass}.',
        openingNarration: 'Alguém pronuncia a tua classe: {characterClass}.', tags: [],
      },
    ],
  },
}

export interface Recorded {
  adventureCreate?: Record<string, unknown>
  adventureUpdateMany?: Record<string, unknown>
  // US-235: gravações do job em background, separadas da criação síncrona acima — `adventureCreate`
  // só tem a linha GENERATING/placeholder. US-256: o job agora faz DUAS `tx.adventure.update` (liberação
  // `OPENING_READY`, depois conclusão `ACTIVE`); `adventureUpdate` é a fusão das duas (a última vence
  // por campo), `adventureUpdates` guarda cada uma na ordem em que aconteceu.
  adventureUpdate?: Record<string, unknown>
  adventureUpdates?: Record<string, unknown>[]
  // US-235: `this.prisma.adventure.update` FORA da transação — só o caminho FAILED (gate
  // esgotado ou exceção) escreve aqui, fora do `tx` de sucesso.
  adventureFailedUpdate?: Record<string, unknown>
  // US-256: `status` de TODA escrita em Adventure feita pelo job/retry (dentro ou fora da transação), na ordem em
  // que aconteceram — prova a ordem liberação → estado terminal.
  statusWrites?: string[]
  // US-256: linha que `adventure.findFirst` devolve (o "tentar de novo" lê status + authoredSlice).
  adventureRow?: Record<string, unknown>
  participantCreate?: Record<string, unknown>
  characterStateCreate?: Record<string, unknown>
  characterStateUpdate?: Record<string, unknown>
  questCreate?: Record<string, unknown>
  eventLogCreate?: Record<string, unknown>
  // US-257: ordem/timestamps de INTRODUCTION+NARRATION exigem as DUAS chamadas — `eventLogCreate`
  // (acima) sozinho só guarda a ÚLTIMA, suficiente pros testes pré-existentes (NARRATION é sempre
  // a última quando há introdução).
  eventLogCreates?: Record<string, unknown>[]
}

export function fakePrisma(character: Record<string, unknown> | null, participantCount = 0): { prisma: PrismaService; recorded: Recorded } {
  const recorded: Recorded = {}
  const tx = {
    adventureParticipant: { create: async ({ data }: { data: Record<string, unknown> }) => { recorded.participantCreate = data; return { id: 'participant-1', ...data } } },
    adventure: {
      updateMany: async (args: Record<string, unknown>) => { recorded.adventureUpdateMany = args; return { count: 0 } },
      create: async ({ data }: { data: Record<string, unknown> }) => { recorded.adventureCreate = data; return { id: 'adv-1', ...data } },
      update: async ({ data }: { data: Record<string, unknown> }) => {
        recorded.adventureUpdate = { ...recorded.adventureUpdate, ...data }
        ;(recorded.adventureUpdates ??= []).push(data)
        if (typeof data['status'] === 'string') (recorded.statusWrites ??= []).push(data['status'])
        return { id: 'adv-1', ...data }
      },
    },
    characterState: {
      create: async ({ data }: { data: Record<string, unknown> }) => { recorded.characterStateCreate = data; return data },
      update: async ({ data }: { data: Record<string, unknown> }) => { recorded.characterStateUpdate = data; return data },
    },
    quest: { create: async ({ data }: { data: Record<string, unknown> }) => { recorded.questCreate = data; return { id: 'quest-1', ...data } } },
    eventLog: { create: async ({ data }: { data: Record<string, unknown> }) => {
      recorded.eventLogCreate = data
      ;(recorded.eventLogCreates ??= []).push(data)
      return { id: 'evt-1', ...data }
    } },
  }
  const prisma = {
    character: { findUnique: async () => character },
    system: {
      findMany: async () => {
        const c = character as { system?: unknown; systemId?: string } | null
        return c?.system ? [{ id: c.systemId, ...(c.system as object) }] : []
      },
    },
    adventureParticipant: { count: async () => participantCount },
    adventure: {
      // US-235: gravação FORA da transação — só o caminho FAILED chama isto.
      update: async ({ data }: { data: Record<string, unknown> }) => {
        recorded.adventureFailedUpdate = data
        if (typeof data['status'] === 'string') (recorded.statusWrites ??= []).push(data['status'])
        return { id: 'adv-1', ...data }
      },
      findFirst: async () => recorded.adventureRow ?? null,
      // US-256: `completeGeneration` lê o ledger que a liberação gravou, pra enriquecê-lo.
      findUnique: async () => ({ entities: recorded.adventureUpdate?.['entities'] ?? null }),
    },
    $transaction: async (fn: (tx: unknown) => unknown) => fn(tx),
  } as unknown as PrismaService
  return { prisma, recorded }
}
