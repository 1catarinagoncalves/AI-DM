import { describe, it, expect } from 'vitest'
import type { Response } from 'express'
import { AiController } from './ai.controller'
import type { AiService } from './ai.service'

// Fake res que só coleta o que foi escrito no stream.
function fakeRes() {
  const writes: string[] = []
  const res = {
    setHeader: () => res,
    flushHeaders: () => {},
    write: (chunk: string) => { writes.push(chunk); return true },
    end: () => {},
  }
  return { res: res as unknown as Response, writes }
}

// Simula o fullStream do AI SDK a partir de uma lista de parts.
function fakeAiService(parts: unknown[], extra: Partial<AiService> = {}): AiService {
  return {
    // US-61: posse validada antes do stream; no teste o dono confere.
    assertCharacterOwner: async () => {},
    streamChat: async () => ({
      result: { fullStream: (async function* () { for (const p of parts) yield p })() },
      hasFallback: false,
    }),
    ...extra,
  } as unknown as AiService
}

describe('AiController.chat — canal de estado da ficha (US-19)', () => {
  it('emite o HP persistido (H:) quando updateCharacterHp roda no turno', async () => {
    const parts = [
      { type: 'tool-result', toolName: 'updateCharacterHp', result: { hp: 6, maxHp: 12 } },
      { type: 'text-delta', textDelta: 'O goblin te acerta.' },
    ]
    const controller = new AiController(fakeAiService(parts))
    const { res, writes } = fakeRes()

    await controller.chat({ adventureId: 'a1', characterId: 'c1', message: 'ataco' }, res, { userId: 'u1' })

    // O HP mostrado ao cliente é exatamente o hp persistido retornado pela tool.
    expect(writes).toContain('H:' + JSON.stringify({ hp: 6, maxHp: 12 }) + '\n')
  })
})

describe('AiController.chat — edição do último turno (US-67)', () => {
  it('edição: limpa o rastro do último turno antes de streamar', async () => {
    let cleared = false
    const parts = [{ type: 'text-delta', textDelta: 'Nova narração.' }]
    const controller = new AiController(fakeAiService(parts, {
      clearLastTurnForEdit: async () => { cleared = true; return [] },
    }))
    const { res, writes } = fakeRes()

    await controller.chat({ adventureId: 'a1', characterId: 'c1', message: 'finto o guarda', edit: true }, res, { userId: 'u1' })

    expect(cleared).toBe(true)
    expect(writes).toContain('0:' + JSON.stringify('Nova narração.') + '\n')
  })

  it('edição que falha (sem texto) → restaura o turno original', async () => {
    let restored: unknown[] | null = null
    const savedTurn = [{ id: 'action' }, { id: 'narration' }]
    // Stream que erra antes de qualquer texto, sem fallback → nada é emitido.
    const parts = [{ type: 'error', error: new Error('todos os modelos caíram') }]
    const controller = new AiController(fakeAiService(parts, {
      clearLastTurnForEdit: async () => savedTurn as never,
      restoreClearedTurn: async (events: never) => { restored = events },
    }))
    const { res } = fakeRes()

    await controller.chat({ adventureId: 'a1', characterId: 'c1', message: 'finto', edit: true }, res, { userId: 'u1' })

    expect(restored).toEqual(savedTurn)
  })
})
