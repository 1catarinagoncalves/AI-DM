import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RubricScore } from '@ai-dm/ai-engine'
import { judgeAdventureProse, liveEvalAdventure, proseToJudge } from './adventure-eval-live'
import { EXPECTED_GOOD, goodAdventure } from './adventure-eval.test-helpers'

// Fake do juiz (Gemini): registra o que recebeu e devolve nota fixa, ou falha por chave/quota.
const FakeJudge = vi.hoisted(() => {
  class FakeJudge {
    calls: { narration: string; scenarioContext: string; exemplar?: unknown }[] = []
    failWith: Error | null = null
    async judgeTurn(params: { narration: string; scenarioContext: string; exemplar?: unknown }) {
      this.calls.push(params)
      if (this.failWith) throw this.failWith
      const dimension = { nota: 5, justificativa: 'n/a' }
      return { score: new Proxy({}, { get: () => dimension }) as unknown as RubricScore, judgeTokens: 1 }
    }
  }
  return new FakeJudge()
})

vi.mock('@ai-dm/ai-engine', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@ai-dm/ai-engine')>()),
  judgeModel: () => ({}) as never,
  judgeTurn: (params: Parameters<typeof FakeJudge.judgeTurn>[0]) => FakeJudge.judgeTurn(params),
  meanOfScore: () => 4.5,
}))

describe('proseToJudge (US-238)', () => {
  it('é a ambientação + o gancho: o que a jogadora lê ao entrar', () => {
    const adventure = goodAdventure()
    expect(proseToJudge(adventure)).toBe(`${adventure.world.description}\n\n${adventure.start}`)
  })
})

describe('judgeAdventureProse (US-238)', () => {
  beforeEach(() => { FakeJudge.calls = []; FakeJudge.failWith = null })

  it('pontua a prosa de abertura com o exemplar como âncora e devolve a média', async () => {
    const exemplar = { playerAction: 'x', dmResponse: 'A Floresta de Ashwyrne cobre léguas de terreno antigo.' }
    const { media } = await judgeAdventureProse(goodAdventure(), exemplar)
    expect(media).toBe(4.5)
    expect(FakeJudge.calls[0]!.exemplar).toBe(exemplar)
    expect(FakeJudge.calls[0]!.narration).toContain('Praça do Sino')
    expect(FakeJudge.calls[0]!.scenarioContext).toMatch(/NÃO é um turno de jogo/)
  })

  it('falha do juiz (chave/quota) propaga — quem chama decide se derruba', async () => {
    FakeJudge.failWith = new Error('quota exceeded')
    await expect(judgeAdventureProse(goodAdventure())).rejects.toThrow('quota exceeded')
  })
})

describe('liveEvalAdventure (US-238)', () => {
  const log = vi.spyOn(console, 'log').mockImplementation(() => {})
  const original = { flag: process.env.DM_LIVE_EVAL, node: process.env.NODE_ENV }

  beforeEach(() => { FakeJudge.calls = []; FakeJudge.failWith = null; log.mockClear() })
  afterEach(() => {
    if (original.flag === undefined) delete process.env.DM_LIVE_EVAL
    else process.env.DM_LIVE_EVAL = original.flag
    process.env.NODE_ENV = original.node
  })

  it('sem DM_LIVE_EVAL: não julga nem loga (produção e dev normal não pagam nada)', async () => {
    delete process.env.DM_LIVE_EVAL
    await liveEvalAdventure(goodAdventure(), EXPECTED_GOOD)
    expect(FakeJudge.calls).toHaveLength(0)
    expect(log).not.toHaveBeenCalled()
  })

  it('em produção não roda nem com a flag ligada', async () => {
    process.env.DM_LIVE_EVAL = '1'
    process.env.NODE_ENV = 'production'
    await liveEvalAdventure(goodAdventure(), EXPECTED_GOOD)
    expect(FakeJudge.calls).toHaveLength(0)
    expect(log).not.toHaveBeenCalled()
  })

  it('com a flag: loga UMA linha JSON com os asserts que falharam e a nota do juiz', async () => {
    process.env.DM_LIVE_EVAL = '1'
    process.env.NODE_ENV = 'development'
    const broken = goodAdventure()
    broken.challenges[0]!.locationId = 'loc-999'
    await liveEvalAdventure(broken, EXPECTED_GOOD)
    const line = JSON.parse(log.mock.calls[0]![0] as string)
    expect(line).toMatchObject({ event: 'adventure_live_eval', adventureId: broken.id, judgeMedia: 4.5 })
    expect(line.assertionsFailed).toEqual([expect.stringContaining('grafo-fecha: ')])
    expect(line.assertionsFailed[0]).toContain('loc-999')
  })

  it('juiz falhando NÃO lança e não apaga o resultado dos asserts: loga judgeError', async () => {
    process.env.DM_LIVE_EVAL = '1'
    process.env.NODE_ENV = 'development'
    FakeJudge.failWith = new Error('quota exceeded')
    await expect(liveEvalAdventure(goodAdventure(), EXPECTED_GOOD)).resolves.toBeUndefined()
    const line = JSON.parse(log.mock.calls[0]![0] as string)
    expect(line).toMatchObject({ assertionsFailed: [], judgeError: 'quota exceeded' })
    expect(line).not.toHaveProperty('judgeMedia')
  })
})
