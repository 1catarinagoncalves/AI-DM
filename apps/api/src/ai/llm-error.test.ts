// O 400 que ficou 3 dias invisível: o teste fixa que request RECUSADO grita e sai sem
// stack, e que falha de provider continua saindo inteira. Se os dois voltarem a ter a
// mesma cara, o próximo bug desta classe some no log de novo.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { APICallError } from 'ai'
import { logLlmFailure } from './llm-error'

const apiError = (statusCode: number, responseBody: string) =>
  new APICallError({
    message: 'Provider returned error',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    requestBodyValues: { model: 'deepseek/deepseek-v4-flash' },
    statusCode,
    responseBody,
  })

const captureError = () => vi.spyOn(console, 'error').mockImplementation(() => {})

afterEach(() => vi.restoreAllMocks())

describe('log de falha de LLM', () => {
  it('400 vira ALERTA, nomeia modelo e resposta, e não passa o erro adiante', () => {
    const spy = captureError()
    logLlmFailure('extração da cena', 'sceneState fica nulo', apiError(400, 'Thinking mode does not support this tool_choice'))

    const [linha, ...resto] = spy.mock.calls[0]!
    expect(linha).toContain('ALERTA')
    expect(linha).toContain('falha SEMPRE')
    expect(linha).toContain('deepseek/deepseek-v4-flash')
    expect(linha).toContain('Thinking mode does not support this tool_choice')
    // Sem o objeto de erro: em 4xx o stack do SDK não diz nada e é ele que enterra a linha.
    expect(resto).toHaveLength(0)
  })

  it('5xx é degradação esperada: sem ALERTA e com o erro inteiro para investigar', () => {
    const spy = captureError()
    const err = apiError(520, 'error code: 520')
    logLlmFailure('semeadura de entidades', 'ledger fica vazio', err)

    const [linha, passado] = spy.mock.calls[0]!
    expect(linha).not.toContain('ALERTA')
    expect(linha).toContain('degradando')
    expect(passado).toBe(err)
  })

  it('erro que não é do provider (timeout, bug nosso) cai no caminho de degradação', () => {
    const spy = captureError()
    const err = new Error('socket hang up')
    logLlmFailure('resumo da memória', 'resumo não avança', err)

    const [linha, passado] = spy.mock.calls[0]!
    expect(linha).not.toContain('ALERTA')
    expect(linha).not.toContain('HTTP')
    expect(passado).toBe(err)
  })
})
