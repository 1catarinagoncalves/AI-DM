import { describe, it, expect } from 'vitest'
import { NARRATION_PROVIDER_OPTIONS } from './model'

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
