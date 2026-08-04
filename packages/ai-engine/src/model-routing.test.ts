import { describe, it, expect } from 'vitest'
import { NARRATION_PROVIDER_OPTIONS, EXTRACTION_PROVIDER_OPTIONS } from './model'

// Guard do pin de roteamento do OpenRouter. O mesmo slug
// `deepseek/deepseek-v4-flash` é servido por 22 endpoints e só o first-party da
// DeepSeek tem cache implícito de prefixo — perder esse pin zera o ganho da
// US-55/US-56 SEM erro nenhum: a narração continua saindo, só que sem cache-hit
// e mais cara. Falha silenciosa, por isso o teste.
describe('roteamento de provider do OpenRouter', () => {
  const { provider } = NARRATION_PROVIDER_OPTIONS.openrouter

  it('põe o first-party da DeepSeek em primeiro (único com cache implícito)', () => {
    expect(provider.order[0]).toBe('deepseek')
  })

  it('mantém a allowlist coerente com o order', () => {
    for (const slug of provider.order) expect(provider.only).toContain(slug)
  })

  it('exige suporte a todos os parâmetros do request', () => {
    // Sem isso, endpoint que não implementa `presence_penalty` serve o turno sem a
    // penalidade da US-69 e sem avisar. Falha fechado é o comportamento desejado.
    expect(provider.require_parameters).toBe(true)
  })

  it('não admite os endpoints fp4 nem os de contexto curto', () => {
    // fp4 = degeneração tipo US-69; io-net 32k / akashml 128k truncam histórico.
    const banidos = ['deepinfra', 'ionstream', 'ambient', 'atlas-cloud', 'mancer', 'io-net', 'akashml']
    for (const slug of banidos) expect(provider.only).not.toContain(slug)
  })
})

// Regressão de 04/08/2026: as extrações (`generateObject`) iam com as opções da
// narração, e o thinking do DeepSeek recusa o `tool_choice` do modo tool com 400.
// As três chamadas falhavam SEMPRE e em silêncio — cada catch devolve null, então a
// aventura nascia sem sceneState e sem ledger sem nada quebrar na tela.
describe('opções das extrações estruturadas', () => {
  const { openrouter } = EXTRACTION_PROVIDER_OPTIONS

  it('desliga o thinking — `exclude`/`effort` não bastam, e omitir a chave também não', () => {
    expect(openrouter.reasoning).toEqual({ enabled: false })
  })

  it('mantém o mesmo pin de rota da narração', () => {
    expect(openrouter.provider).toBe(NARRATION_PROVIDER_OPTIONS.openrouter.provider)
  })
})
