import { describe, it, expect } from 'vitest'
import type { SystemConfig } from '@ai-dm/shared'
import { AdventureService } from './adventure.service'
import type { PrismaService } from '../prisma.service'

const config: SystemConfig = {
  attributes: [{ key: 'constitution', label: 'Con', min: 1, max: 20, default: 10 }],
  startingKits: { guerreiro: [{ name: 'Espada longa', qty: 1 }], default: [{ name: 'Adaga', qty: 1 }] },
}

interface Recorded {
  adventureCreate?: Record<string, unknown>
  adventureUpdateMany?: Record<string, unknown>
  participantCreate?: Record<string, unknown>
  characterStateCreate?: Record<string, unknown>
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
  }

  const prisma = {
    character: { findUnique: async () => character },
    $transaction: async (fn: (tx: unknown) => unknown) => fn(tx),
  } as unknown as PrismaService

  return { prisma, recorded }
}

describe('AdventureService.createForCharacter', () => {
  it('cria a aventura com systemId/creatorId do personagem, participante e estado inicial', async () => {
    const character = {
      id: 'char-1', userId: 'user-1', systemId: 'sys-1', class: 'Guerreiro',
      baseAttributes: { constitution: 14 },
      system: { config },
    }
    const { prisma, recorded } = fakePrisma(character)
    const service = new AdventureService(prisma)

    const adventure = await service.createForCharacter('char-1', { title: 'A Torre Negra' })

    expect(adventure).toMatchObject({ id: 'adv-1', systemId: 'sys-1', creatorId: 'user-1', title: 'A Torre Negra', order: 1 })
    expect(recorded.participantCreate).toEqual({ adventureId: 'adv-1', characterId: 'char-1' })
    expect(recorded.characterStateCreate).toMatchObject({
      characterId: 'char-1', adventureId: 'adv-1', hp: 12, maxHp: 12,
      inventory: [{ name: 'Espada longa', qty: 1 }],
    })
  })

  it('numera order pela contagem de aventuras anteriores do personagem', async () => {
    const character = {
      id: 'char-1', userId: 'user-1', systemId: 'sys-1', class: 'Mago',
      baseAttributes: { constitution: 10 },
      system: { config },
    }
    const { prisma, recorded } = fakePrisma(character, 2)
    const service = new AdventureService(prisma)

    await service.createForCharacter('char-1', { title: 'Segunda aventura' })

    expect(recorded.adventureCreate).toMatchObject({ order: 3 })
  })

  it('rejeita quando o personagem não existe', async () => {
    const { prisma } = fakePrisma(null)
    const service = new AdventureService(prisma)
    await expect(service.createForCharacter('missing', { title: 'X' })).rejects.toThrow()
  })
})
