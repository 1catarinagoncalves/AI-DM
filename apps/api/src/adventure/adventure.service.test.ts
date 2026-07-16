import { describe, it, expect } from 'vitest'
import type { SystemConfig } from '@ai-dm/shared'
import { AdventureService } from './adventure.service'
import type { PrismaService } from '../prisma.service'
import type { AiService } from '../ai/ai.service'

// Fake do AiService: por padrão devolve null (força o fallback estático da US-28,
// preservando as asserções de texto abaixo). `opening` != null exercita o caminho IA.
function fakeAi(opening: string | null = null): AiService {
  return { generateOpeningNarration: async () => opening } as unknown as AiService
}

const config: SystemConfig = {
  attributes: [{ key: 'constitution', label: 'Con', min: 1, max: 20, default: 10 }],
  startingKits: { fighter: [{ name: 'Espada longa', qty: 1 }], default: [{ name: 'Adaga', qty: 1 }] },
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
      id: 'char-1', userId: 'user-1', systemId: 'sys-1', name: 'Elara', class: 'Mago',
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
      id: 'char-1', userId: 'user-1', systemId: 'sys-1', name: 'Elara', class: 'Mago',
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
      id: 'char-1', userId: 'user-1', systemId: 'sys-1', name: 'Elara', class: 'Mago',
      baseAttributes: { constitution: 10 }, system: { config },
    }
    const { prisma } = fakePrisma(character)
    const service = new AdventureService(prisma, fakeAi())
    await expect(service.createForCharacter('char-1', { initialHookId: 'default-sinal' })).rejects.toThrow()
  })

  it('numera order pela contagem de aventuras anteriores do personagem', async () => {
    const character = {
      id: 'char-1', userId: 'user-1', systemId: 'sys-1', name: 'Elara', class: 'Mago',
      baseAttributes: { constitution: 10 },
      system: { config },
    }
    const { prisma, recorded } = fakePrisma(character, 2)
    const service = new AdventureService(prisma, fakeAi())

    await service.createForCharacter('char-1', { initialHookId: 'mago-arquivo' })

    expect(recorded.adventureCreate).toMatchObject({ order: 3 })
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
      id: 'char-1', userId: 'user-1', systemId: 'sys-1', name: 'Elara', class: 'Mago',
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
      { role: 'user', content: 'Entro.' },
      { role: 'dm', content: 'Três figuras...' },
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
      { role: 'user', content: 'Examino o riacho.' },
      { role: 'roll', label: 'Percepção', formula: '1d20+5', rolls: [7], modifier: 5, total: 12 },
      { role: 'dm', content: 'Marcas sutis nas pedras.' },
    ])
  })
})
