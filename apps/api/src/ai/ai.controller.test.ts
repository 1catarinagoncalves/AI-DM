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
      // US-74: turno completo termina com a lista de opções (senão o guard re-amostra).
      { type: 'text-delta', textDelta: '\n\n- 🗡️ Revidar.\n- 🛡️ Recuar.' },
    ]
    const controller = new AiController(fakeAiService(parts))
    const { res, writes } = fakeRes()

    await controller.chat({ adventureId: 'a1', characterId: 'c1', message: 'ataco' }, res, { userId: 'u1' })

    // O HP mostrado ao cliente é exatamente o hp persistido retornado pela tool.
    expect(writes).toContain('H:' + JSON.stringify({ hp: 6, maxHp: 12 }) + '\n')
  })
})

describe('AiController.chat — guard anti-degeneração (US-69)', () => {
  it('"cra "×30 é cortada mid-stream (não chega inteira), turno descartado e reescrito no mesmo modelo', async () => {
    const craParts = Array.from({ length: 30 }, () => ({ type: 'text-delta', textDelta: 'cra ' }))
    const cleanParts = [{ type: 'text-delta', textDelta: 'A erva se chama valeriana-da-noite.\n\n- 🌿 Colher a erva.' }]
    let call = 0
    const guards: { degenerated: boolean }[] = []
    const svc = {
      assertCharacterOwner: async () => {},
      streamChat: async () => {
        const turnGuard = { degenerated: false }
        guards.push(turnGuard)
        const parts = call++ === 0 ? craParts : cleanParts
        return {
          result: { fullStream: (async function* () { for (const p of parts) yield p })() },
          hasFallback: false, // sem escada: prova o re-roll no MESMO modelo
          turnGuard,
        }
      },
    } as unknown as AiService
    const controller = new AiController(svc)
    const { res, writes } = fakeRes()

    await controller.chat({ adventureId: 'a1', characterId: 'c1', message: 'como se chama a erva' }, res, { userId: 'u1' })

    const craFrames = writes.filter(w => w === '0:' + JSON.stringify('cra ') + '\n')
    expect(craFrames.length).toBeLessThan(30) // não chegou inteira ao cliente
    expect(writes).toContain('X\n') // sentinel de descarte de turno enviado
    // A reescrita (mesmo modelo, 2ª chamada) chegou limpa ao cliente.
    expect(writes).toContain('0:' + JSON.stringify('A erva se chama valeriana-da-noite.\n\n- 🌿 Colher a erva.') + '\n')
    // 1ª tentativa marcada como degenerada (onFinish NÃO persiste); a boa persiste.
    expect(guards[0]!.degenerated).toBe(true)
    expect(guards[1]!.degenerated).toBe(false)
  })

  it('degeneração persistente (todas as tentativas) → mensagem de erro limpa, nunca a parede', async () => {
    const craParts = () => Array.from({ length: 30 }, () => ({ type: 'text-delta', textDelta: 'cra ' }))
    const svc = {
      assertCharacterOwner: async () => {},
      streamChat: async () => ({
        result: { fullStream: (async function* () { for (const p of craParts()) yield p })() },
        hasFallback: false, // último modelo → esgota re-rolls e cai no erro limpo
        turnGuard: { degenerated: false },
      }),
    } as unknown as AiService
    const controller = new AiController(svc)
    const { res, writes } = fakeRes()

    await controller.chat({ adventureId: 'a1', characterId: 'c1', message: 'como se chama a erva' }, res, { userId: 'u1' })

    expect(writes).toContain('0:' + JSON.stringify('[O Mestre se perdeu nas palavras. Tenta de novo.]') + '\n')
  })
})

describe('AiController.chat — guard de turno truncado (US-74, salvamento)', () => {
  it('narração truncada (sem opções) é COMPLETADA sem re-rodar o turno — nunca descarta', async () => {
    // Prosa dramática que para sem opções (o bug real de prod). Um step só, finishReason=stop.
    const truncado = [{ type: 'text-delta', textDelta: 'Você desata o cordão.\n\nVocê abre a primeira.' }]
    const guard = { degenerated: false, incomplete: false }
    let sawNarration = ''
    let salvageCalls = 0
    const svc = {
      assertCharacterOwner: async () => {},
      streamChat: async () => ({
        result: { fullStream: (async function* () { for (const p of truncado) yield p })() },
        hasFallback: false,
        turnGuard: guard,
      }),
      completeTruncatedTurn: async (_input: unknown, narration: string) => {
        salvageCalls++
        sawNarration = narration
        return '\n\nA carta fala de uma dívida antiga.\n\n- 📜 Ler a segunda.\n- 🔥 Queimar tudo.'
      },
    } as unknown as AiService
    const controller = new AiController(svc)
    const { res, writes } = fakeRes()

    await controller.chat({ adventureId: 'a1', characterId: 'c1', message: 'leio as cartas' }, res, { userId: 'u1' })

    // NÃO descarta: nenhum X, e a narração truncada permanece na tela.
    expect(writes).not.toContain('X\n')
    expect(writes).toContain('0:' + JSON.stringify('Você desata o cordão.\n\nVocê abre a primeira.') + '\n')
    // O fecho gerado foi ANEXADO (não re-rodou o turno inteiro).
    expect(salvageCalls).toBe(1)
    expect(writes).toContain('0:' + JSON.stringify('\n\nA carta fala de uma dívida antiga.\n\n- 📜 Ler a segunda.\n- 🔥 Queimar tudo.') + '\n')
    // O salvamento recebeu a narração EXATA que o cliente viu.
    expect(sawNarration).toBe('Você desata o cordão.\n\nVocê abre a primeira.')
    // Gate marcado: o onFinish da tentativa truncada não persiste; completeTruncatedTurn grava.
    expect(guard.incomplete).toBe(true)
  })

  it('opções descartadas por R + desfecho truncado → salva o turno (latch reseta no R)', async () => {
    // step 1: narração completa (com opções) → step 2 substitui e trunca. O `R` descarta
    // o step 1; sem resetar o latch, o turno passaria por completo e se perderia.
    const parts = [
      { type: 'text-delta', textDelta: 'Primeira versão.\n\n- 🗡️ Opção A.' },
      { type: 'step-start' },
      { type: 'text-delta', textDelta: 'Segunda versão, mas corta aqui.' },
    ]
    let salvageCalls = 0
    let sawNarration = ''
    const guard = { degenerated: false, incomplete: false }
    const svc = {
      assertCharacterOwner: async () => {},
      streamChat: async () => ({
        result: { fullStream: (async function* () { for (const p of parts) yield p })() },
        hasFallback: false,
        turnGuard: guard,
      }),
      completeTruncatedTurn: async (_i: unknown, narration: string) => { salvageCalls++; sawNarration = narration; return '\n\n- 🗡️ Continuar.' },
    } as unknown as AiService
    const controller = new AiController(svc)
    const { res, writes } = fakeRes()

    await controller.chat({ adventureId: 'a1', characterId: 'c1', message: 'ago' }, res, { userId: 'u1' })

    expect(writes).toContain('R\n')            // step 1 descartado no cliente
    expect(salvageCalls).toBe(1)               // desfecho truncado → salvamento
    expect(sawNarration).toBe('Segunda versão, mas corta aqui.') // só o step sobrevivente
    expect(guard.incomplete).toBe(true)
  })

  it('turno COMPLETO (já tem opções) não aciona o salvamento', async () => {
    const completo = [{ type: 'text-delta', textDelta: 'A porta se abre.\n\n- 🗡️ Entrar.\n- 🛡️ Recuar.' }]
    let salvageCalls = 0
    const svc = {
      assertCharacterOwner: async () => {},
      streamChat: async () => ({
        result: { fullStream: (async function* () { for (const p of completo) yield p })() },
        hasFallback: false,
        turnGuard: { degenerated: false, incomplete: false },
      }),
      completeTruncatedTurn: async () => { salvageCalls++; return '' },
    } as unknown as AiService
    const controller = new AiController(svc)
    const { res, writes } = fakeRes()

    await controller.chat({ adventureId: 'a1', characterId: 'c1', message: 'abro a porta' }, res, { userId: 'u1' })

    expect(salvageCalls).toBe(0)
    expect(writes).not.toContain('X\n')
    expect(writes).toContain('0:' + JSON.stringify('A porta se abre.\n\n- 🗡️ Entrar.\n- 🛡️ Recuar.') + '\n')
  })
})

describe('AiController.chat — edição do último turno (US-67)', () => {
  it('edição: limpa o rastro do último turno antes de streamar', async () => {
    let cleared = false
    const parts = [{ type: 'text-delta', textDelta: 'Nova narração.\n\n- 🗡️ Avançar.' }]
    const controller = new AiController(fakeAiService(parts, {
      clearLastTurnForEdit: async () => { cleared = true; return [] },
    }))
    const { res, writes } = fakeRes()

    await controller.chat({ adventureId: 'a1', characterId: 'c1', message: 'finto o guarda', edit: true }, res, { userId: 'u1' })

    expect(cleared).toBe(true)
    expect(writes).toContain('0:' + JSON.stringify('Nova narração.\n\n- 🗡️ Avançar.') + '\n')
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
