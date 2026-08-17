import { describe, it, expect } from 'vitest'
import { NARRATION_PROVIDER_OPTIONS, EXTRACTION_PROVIDER_OPTIONS, extractionModel, primaryModel, OPENROUTER_PROVENANCE, formatProvenance } from './model'

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

  // US-114: as extrações saíram do `summaryModel`/DeepSeek para `extractionModel`
  // (`qwen/qwen3.7-flash`). O pin `DEEPSEEK_ROUTE` é `only: DEEPSEEK_ALLOWED_PROVIDERS`
  // — herdá-lo aqui faria o OpenRouter não achar provedor que case, e a falha cairia
  // dentro de um `catch` que devolve `null`, em silêncio. Sem `provider` nenhum não
  // há rota para herdar por engano (critério de aceite #4 da US-114).
  it('não carrega pin de rota do DeepSeek (o modelo novo não é DeepSeek)', () => {
    expect(openrouter).not.toHaveProperty('provider')
  })
})

describe('extractionModel (US-114)', () => {
  it('é um modelo distinto do da narração/sumarização', () => {
    expect(extractionModel.modelId).toBe('qwen/qwen3.7-flash')
    expect(extractionModel.modelId).not.toBe(primaryModel.modelId)
  })
})

// US-103: os testes acima guardam a DECLARAÇÃO da rota; estes guardam a leitura do
// que de fato serviu. Fixtures capturados do OpenRouter em 04/08/2026 (corpo real,
// recortado no que o extrator lê) — se o campo mudar de lugar, é aqui que quebra.
describe('proveniência do endpoint (US-103)', () => {
  const CORPO = {
    id: 'gen-1785861907-pfdOh5DqHkzmPn7fjvB2',
    model: 'deepseek/deepseek-v4-flash',
    provider: 'DeepSeek',
    system_fingerprint: 'fp_a18b46594c_prod0820_fp8_kvcache_20260402',
    choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: 'ok' } }],
  }
  const CHUNK = {
    id: 'gen-1785861909-gpIPwT3rq82pAI2XW2p2',
    object: 'chat.completion.chunk',
    model: 'deepseek/deepseek-v4-flash',
    provider: 'DeepSeek',
    system_fingerprint: 'fp_a18b46594c_prod0820_fp8_kvcache_20260402',
    choices: [{ index: 0, delta: { content: 'ok', role: 'assistant' }, finish_reason: null }],
  }
  const CHUNK_FINAL = { ...CHUNK, provider: undefined, system_fingerprint: undefined, usage: { prompt_tokens: 9 } }

  it('lê o endpoint do corpo não-streaming (`generateObject`)', () => {
    expect(OPENROUTER_PROVENANCE.extractMetadata({ parsedBody: CORPO })).toEqual({
      openrouter: { endpoint: 'DeepSeek', fingerprint: 'fp_a18b46594c_prod0820_fp8_kvcache_20260402' },
    })
  })

  it('lê o endpoint dos chunks do stream (narração do turno)', () => {
    const stream = OPENROUTER_PROVENANCE.createStreamExtractor()
    stream.processChunk(CHUNK)
    stream.processChunk(CHUNK_FINAL) // último chunk vem só com usage — não pode apagar o já visto
    expect(stream.buildMetadata()).toEqual({
      openrouter: { endpoint: 'DeepSeek', fingerprint: 'fp_a18b46594c_prod0820_fp8_kvcache_20260402' },
    })
  })

  it('devolve undefined quando o campo não vem — nada a mesclar, turno segue', () => {
    expect(OPENROUTER_PROVENANCE.extractMetadata({ parsedBody: { choices: [] } })).toBeUndefined()
    const stream = OPENROUTER_PROVENANCE.createStreamExtractor()
    stream.processChunk(CHUNK_FINAL)
    expect(stream.buildMetadata()).toBeUndefined()
  })

  it('formata uma linha só, e degrada para `desconhecido` sem derrubar o turno', () => {
    expect(formatProvenance({ openrouter: { endpoint: 'DeepSeek', fingerprint: 'fp_x' } })).toBe('endpoint=DeepSeek fp=fp_x')
    // Groq (3º nível da escada) não escreve nessa chave; ausência é sinal, não erro.
    expect(formatProvenance({ groq: {} })).toBe('endpoint=desconhecido')
    expect(formatProvenance(undefined)).toBe('endpoint=desconhecido')
  })
})
