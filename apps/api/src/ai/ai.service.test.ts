import { describe, it, expect } from 'vitest'
import { AiService } from './ai.service'
import type { PrismaService } from '../prisma.service'
import type { DiceService } from '../game/dice.service'
import type { EventLog } from '../generated/prisma/client'

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
