import { describe, it, expect } from 'vitest'
import type { SystemConfig } from '@ai-dm/shared'
import { AdventureService } from './adventure.service'
import type { PrismaService } from '../prisma.service'
import type { AiService } from '../ai/ai.service'

// Fake do AiService: por padrão devolve null (força o fallback estático da US-28,
// preservando as asserções de texto abaixo). `opening` != null exercita o caminho IA.
// `scene` (US-35) default null → extração falha/vazia, sceneState nulo (fallback).
// `entities` (US-75) default null → ledger vazio, igual ao comportamento pré-US-75.
// `seen` (US-105) recebe o input da geração — é como se afirma que o Mestre viu o RÓTULO
// de raça/classe, e não a chave crua guardada na ficha.
function fakeAi(
  opening: string | null = null,
  scene: Record<string, unknown> | null = null,
  entities: Record<string, unknown>[] | null = null,
  seen: Record<string, unknown> = {},
): AiService {
  return {
    generateOpeningNarration: async (input: Record<string, unknown>) => { Object.assign(seen, input); return opening },
    extractOpeningScene: async () => scene,
    extractOpeningEntities: async () => entities,
  } as unknown as AiService
}

const config: SystemConfig = {
  attributes: [{ key: 'constitution', label: 'Con', min: 1, max: 20, default: 10 }],
  startingKits: { fighter: [{ name: 'Espada longa', qty: 1 }], default: [{ name: 'Adaga', qty: 1 }] },
  // US-105: a ficha guarda a chave; o catálogo é quem sabe o rótulo do locale.
  races: [{ key: 'human', label: 'Humano' }],
  classes: [{ key: 'wizard', label: 'Mago' }],
  initialAdventures: {
    hooks: [
      {
        id: 'mago-arquivo', classKey: 'wizard', title: 'O Arquivo Que Sussurra',
        pitch: 'Um grimório reconhece {characterName}.', primaryQuestTitle: 'Descobrir o arquivo',
        primaryQuestDescription: 'Investigar o grimório.', openingNarration: 'A vela curva-se, {characterName}.',
        tags: [],
      },
      {
        id: 'default-sinal', classKey: 'default', title: 'O Primeiro Sinal de {characterClass}',
        pitch: 'Algo reconhece {characterName}.', primaryQuestTitle: 'Descobrir o chamado',
        primaryQuestDescription: 'Investigar o chamado de {characterName}.',
        openingNarration: 'Alguém pronuncia a tua classe: {characterClass}.', tags: [],
      },
    ],
  },
}

interface Recorded {
  adventureCreate?: Record<string, unknown>
  adventureUpdateMany?: Record<string, unknown>
  participantCreate?: Record<string, unknown>
  characterStateCreate?: Record<string, unknown>
  questCreate?: Record<string, unknown>
  eventLogCreate?: Record<string, unknown>
}

// Test double mínimo: só os métodos que AdventureService.createForCharacter chama,
// incluindo um $transaction que executa o callback com um "tx" que grava as chamadas.
function fakePrisma(character: Record<string, unknown> | null, participantCount = 0): { prisma: PrismaService; recorded: Recorded } {
  const recorded: Recorded = {}
  const tx = {
    adventureParticipant: {
      count: async () => participantCount,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        recorded.participantCreate = data
        return { id: 'participant-1', ...data }
      },
    },
    adventure: {
      updateMany: async (args: Record<string, unknown>) => {
        recorded.adventureUpdateMany = args
        return { count: 0 }
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        recorded.adventureCreate = data
        return { id: 'adv-1', ...data }
      },
    },
    characterState: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        recorded.characterStateCreate = data
        return data
      },
    },
    quest: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        recorded.questCreate = data
        return { id: 'quest-1', ...data }
      },
    },
    eventLog: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        recorded.eventLogCreate = data
        return { id: 'evt-1', ...data }
      },
    },
  }

  const prisma = {
    character: { findUnique: async () => character },
    $transaction: async (fn: (tx: unknown) => unknown) => fn(tx),
  } as unknown as PrismaService

  return { prisma, recorded }
}

describe('AdventureService.createForCharacter', () => {
  it('classe conhecida: usa o gancho da classe para título, quest primária e narração', async () => {
    const character = {
      id: 'char-1', userId: 'user-1', systemId: 'sys-1', name: 'Elara', class: 'wizard', race: 'human',
      baseAttributes: { constitution: 14 },
      system: { config },
    }
    const { prisma, recorded } = fakePrisma(character)
    const service = new AdventureService(prisma, fakeAi())

    const adventure = await service.createForCharacter('char-1', { initialHookId: 'mago-arquivo' })

    expect(adventure).toMatchObject({ id: 'adv-1', systemId: 'sys-1', creatorId: 'user-1', title: 'O Arquivo Que Sussurra', order: 1 })
    expect(recorded.participantCreate).toEqual({ adventureId: 'adv-1', characterId: 'char-1' })
    expect(recorded.characterStateCreate).toMatchObject({
      characterId: 'char-1', adventureId: 'adv-1', hp: 12, maxHp: 12,
      inventory: [{ name: 'Adaga', qty: 1 }], // 'Mago'→wizard, e o config só tem kit 'fighter' → default
    })
    expect(recorded.questCreate).toMatchObject({
      adventureId: 'adv-1', title: 'Descobrir o arquivo', description: 'Investigar o grimório.', isPrimary: true,
    })
    // Placeholder {characterName} resolvido antes de persistir.
    expect(recorded.eventLogCreate).toMatchObject({
      adventureId: 'adv-1', characterId: 'char-1', type: 'NARRATION',
      payload: { text: 'A vela curva-se, Elara.' },
    })
  })

  it('caminho IA: quando a geração devolve texto, a abertura persiste esse texto, não o template estático', async () => {
    const character = {
      id: 'char-1', userId: 'user-1', systemId: 'sys-1', name: 'Elara', class: 'wizard', race: 'human',
      baseAttributes: { constitution: 14 },
      system: { config },
    }
    const { prisma, recorded } = fakePrisma(character)
    const gerado = 'A chuva fina cai sobre Elara enquanto o grimório desperta.'
    const service = new AdventureService(prisma, fakeAi(gerado))

    await service.createForCharacter('char-1', { initialHookId: 'mago-arquivo' })

    expect(recorded.eventLogCreate).toMatchObject({
      type: 'NARRATION',
      payload: { text: gerado },
    })
  })

  it('US-35: extração devolve patch → CharacterState nasce com sceneState preenchido e coerente', async () => {
    const character = {
      id: 'char-1', userId: 'user-1', systemId: 'sys-1', name: 'Elara', class: 'wizard', race: 'human',
      baseAttributes: { constitution: 14 },
      system: { config },
    }
    const { prisma, recorded } = fakePrisma(character)
    const patch = {
      local: 'estrada de terra ao pé da colina', ambiente: 'externo', periodo: 'anoitecer',
      presentes: ['velho ajoelhado'], objetos_em_cena: ['chuva fina', 'archote apagado'],
    }
    const service = new AdventureService(prisma, fakeAi('A chuva cai sobre a estrada.', patch))

    await service.createForCharacter('char-1', { initialHookId: 'mago-arquivo' })

    const state = recorded.characterStateCreate as Record<string, unknown>
    expect(state['sceneState']).toMatchObject({
      local: 'estrada de terra ao pé da colina', ambiente: 'externo', periodo: 'anoitecer',
      presentes: ['velho ajoelhado'], objetos_em_cena: ['chuva fina', 'archote apagado'],
    })
    // mergeSceneState carimba o timestamp — o snapshot é completo, não parcial.
    expect((state['sceneState'] as Record<string, unknown>)['atualizadoEm']).toBeTruthy()
  })

  it('US-35: extração devolve null → CharacterState criado sem sceneState, sem erro (fallback US-34)', async () => {
    const character = {
      id: 'char-1', userId: 'user-1', systemId: 'sys-1', name: 'Elara', class: 'wizard', race: 'human',
      baseAttributes: { constitution: 14 },
      system: { config },
    }
    const { prisma, recorded } = fakePrisma(character)
    const service = new AdventureService(prisma, fakeAi('A chuva cai sobre a estrada.', null))

    const adventure = await service.createForCharacter('char-1', { initialHookId: 'mago-arquivo' })

    expect(adventure).toMatchObject({ id: 'adv-1' })
    expect(recorded.characterStateCreate).not.toHaveProperty('sceneState')
  })

  it('classe desconhecida: cai no gancho default com a classe no texto, sem erro', async () => {
    const character = {
      id: 'char-1', userId: 'user-1', systemId: 'sys-1', name: 'Nyx', class: 'Cartógrafa Estelar',
      baseAttributes: { constitution: 10 },
      system: { config },
    }
    const { prisma, recorded } = fakePrisma(character)
    const service = new AdventureService(prisma, fakeAi())

    const adventure = await service.createForCharacter('char-1', { initialHookId: 'default-sinal' })

    expect(adventure).toMatchObject({ title: 'O Primeiro Sinal de Cartógrafa Estelar' })
    expect(recorded.eventLogCreate).toMatchObject({
      payload: { text: 'Alguém pronuncia a tua classe: Cartógrafa Estelar.' },
    })
  })

  it('rejeita um initialHookId que não corresponde à classe do personagem', async () => {
    const character = {
      id: 'char-1', userId: 'user-1', systemId: 'sys-1', name: 'Elara', class: 'wizard', race: 'human',
      baseAttributes: { constitution: 10 }, system: { config },
    }
    const { prisma } = fakePrisma(character)
    const service = new AdventureService(prisma, fakeAi())
    await expect(service.createForCharacter('char-1', { initialHookId: 'default-sinal' })).rejects.toThrow()
  })

  it('numera order pela contagem de aventuras anteriores do personagem', async () => {
    const character = {
      id: 'char-1', userId: 'user-1', systemId: 'sys-1', name: 'Elara', class: 'wizard', race: 'human',
      baseAttributes: { constitution: 10 },
      system: { config },
    }
    const { prisma, recorded } = fakePrisma(character, 2)
    const service = new AdventureService(prisma, fakeAi())

    await service.createForCharacter('char-1', { initialHookId: 'mago-arquivo' })

    expect(recorded.adventureCreate).toMatchObject({ order: 3 })
  })

  // US-105: a chave vai ao lookup, o rótulo vai ao Mestre. Falha se a chave crua vazar
  // para a primeira cena ("Elara, a wizard").
  it('a abertura recebe o RÓTULO de raça e classe, não a chave', async () => {
    const character = {
      id: 'char-1', userId: 'user-1', systemId: 'sys-1', name: 'Elara', class: 'wizard', race: 'human',
      baseAttributes: { constitution: 10 }, system: { config },
    }
    const { prisma } = fakePrisma(character)
    const seen: Record<string, unknown> = {}
    const service = new AdventureService(prisma, fakeAi(null, null, null, seen))

    await service.createForCharacter('char-1', { initialHookId: 'mago-arquivo' })

    expect(seen['characterClass']).toBe('Mago')
    expect(seen['characterRace']).toBe('Humano')
  })

  it('rejeita quando o personagem não existe', async () => {
    const { prisma } = fakePrisma(null)
    const service = new AdventureService(prisma, fakeAi())
    await expect(service.createForCharacter('missing', { initialHookId: 'mago-arquivo' })).rejects.toThrow()
  })
})

describe('AdventureService.getInitialAdventure', () => {
  it('resolve o gancho da classe com placeholders aplicados', async () => {
    const character = {
      id: 'char-1', userId: 'user-1', systemId: 'sys-1', name: 'Elara', class: 'wizard', race: 'human',
      baseAttributes: { constitution: 10 }, system: { config },
    }
    const { prisma } = fakePrisma(character)
    const service = new AdventureService(prisma, fakeAi())

    const hook = await service.getInitialAdventure('char-1')

    expect(hook).toMatchObject({ id: 'mago-arquivo', title: 'O Arquivo Que Sussurra', openingNarration: 'A vela curva-se, Elara.' })
  })
})

describe('AdventureService.getTurns', () => {
  it('devolve N turnos em ordem, mapeando ACTION→user e NARRATION→dm (inclui resumidos)', async () => {
    const logs = [
      { type: 'ACTION', payload: { text: 'Abro a porta.' }, summarized: true },
      { type: 'NARRATION', payload: { text: 'A porta range.' }, summarized: true },
      { type: 'ACTION', payload: { text: 'Entro.' }, summarized: false },
      { type: 'NARRATION', payload: { text: 'Três figuras...' }, summarized: false },
    ]
    let captured: Record<string, unknown> = {}
    const prisma = {
      eventLog: {
        findMany: async (args: Record<string, unknown>) => { captured = args; return logs },
      },
    } as unknown as PrismaService
    const service = new AdventureService(prisma, fakeAi())

    const turns = await service.getTurns('char-1', 'adv-1')

    // Não filtra por summarized: o histórico visível não some com a condensação.
    expect((captured['where'] as Record<string, unknown>)['summarized']).toBeUndefined()
    expect(turns).toEqual([
      { role: 'user', content: 'Abro a porta.' },
      { role: 'dm', content: 'A porta range.' },
      // US-67: só a ÚLTIMA ação (não-resumida, sem mutação) é marcada editável.
      { role: 'user', content: 'Entro.', editable: true },
      { role: 'dm', content: 'Três figuras...' },
    ])
  })

  it('US-67: última ação sem mutação → marcada editável; a anterior não', async () => {
    const logs = [
      { type: 'ACTION', payload: { text: 'Olho em volta.' }, summarized: false },
      { type: 'NARRATION', payload: { text: 'Uma taberna vazia.' }, summarized: false },
      { type: 'ACTION', payload: { text: 'Sento-me.' }, summarized: false },
      { type: 'NARRATION', payload: { text: 'A cadeira range.' }, summarized: false },
    ]
    const prisma = { eventLog: { findMany: async () => logs } } as unknown as PrismaService
    const service = new AdventureService(prisma, fakeAi())

    const turns = await service.getTurns('char-1', 'adv-1')

    expect(turns[0]).toEqual({ role: 'user', content: 'Olho em volta.' }) // sem editable
    expect(turns[2]).toEqual({ role: 'user', content: 'Sento-me.', editable: true })
  })

  it('US-67: último turno mutou o estado (CHARACTER_UPDATE) → não editável', async () => {
    // O CHARACTER_UPDATE é gravado no stream, ANTES do ACTION (onFinish) — depois da
    // narração anterior. Ele não é renderizado, só decide a editabilidade.
    const logs = [
      { type: 'NARRATION', payload: { text: 'O goblin ataca.' }, summarized: false },
      { type: 'CHARACTER_UPDATE', payload: { field: 'hp', newHp: 4 }, summarized: false },
      { type: 'ACTION', payload: { text: 'Aparo o golpe.' }, summarized: false },
      { type: 'NARRATION', payload: { text: 'A lâmina raspa o teu braço.' }, summarized: false },
    ]
    const prisma = { eventLog: { findMany: async () => logs } } as unknown as PrismaService
    const service = new AdventureService(prisma, fakeAi())

    const turns = await service.getTurns('char-1', 'adv-1')

    // CHARACTER_UPDATE não vira turno; a última ação NÃO leva o flag editable.
    expect(turns).toEqual([
      { role: 'dm', content: 'O goblin ataca.' },
      { role: 'user', content: 'Aparo o golpe.' },
      { role: 'dm', content: 'A lâmina raspa o teu braço.' },
    ])
  })

  it('US-67: última ação já resumida → não editável', async () => {
    const logs = [
      { type: 'ACTION', payload: { text: 'Durmo.' }, summarized: true },
      { type: 'NARRATION', payload: { text: 'Amanhece.' }, summarized: true },
    ]
    const prisma = { eventLog: { findMany: async () => logs } } as unknown as PrismaService
    const service = new AdventureService(prisma, fakeAi())

    const turns = await service.getTurns('char-1', 'adv-1')

    expect(turns).toEqual([
      { role: 'user', content: 'Durmo.' }, // sem editable
      { role: 'dm', content: 'Amanhece.' },
    ])
  })

  it('US-38: reordena o DICE_ROLL (gravado no streaming, antes do ACTION do onFinish) para logo após a ação', async () => {
    // Ordem crua por createdAt: rolagem ANTES da ação do mesmo turno.
    const logs = [
      { type: 'NARRATION', payload: { text: 'Abertura.' }, summarized: false },
      { type: 'DICE_ROLL', payload: { formula: '1d20+5', reason: 'Percepção', rolls: [7], modifier: 5, total: 12 }, summarized: false },
      { type: 'ACTION', payload: { text: 'Examino o riacho.' }, summarized: false },
      { type: 'NARRATION', payload: { text: 'Marcas sutis nas pedras.' }, summarized: false },
    ]
    const prisma = {
      eventLog: { findMany: async () => logs },
    } as unknown as PrismaService
    const service = new AdventureService(prisma, fakeAi())

    const turns = await service.getTurns('char-1', 'adv-1')

    expect(turns).toEqual([
      { role: 'dm', content: 'Abertura.' },
      { role: 'user', content: 'Examino o riacho.', editable: true },
      { role: 'roll', label: 'Percepção', formula: '1d20+5', rolls: [7], modifier: 5, total: 12 },
      { role: 'dm', content: 'Marcas sutis nas pedras.' },
    ])
  })
})
