import { createGroq } from '@ai-sdk/groq'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import type { LanguageModelV1 } from 'ai'

const groq = createGroq({
  apiKey: process.env['GROQ_API_KEY'],
})

// Juiz do bake-off (US-17, slice 2): externo aos candidatos NVIDIA/Groq → sem
// self-preference bias. Default gemini-flash-latest (alias vivo — `gemini-2.5-flash`
// foi descontinuado para novos users em 2026-07; os *-pro têm quota-zero no free
// tier). O flash-tier discrimina bem (spread real); gpt-4o-mini satura. Pin em
// @ai-sdk/google@1.2.x (mesma geração AI SDK v4 / provider 1.1.3 do groq).
const google = createGoogleGenerativeAI({
  apiKey: process.env['GEMINI_API_KEY'],
})

// OpenAI e OpenRouter são OpenAI-compatible: reaproveitam o mesmo encanamento,
// sem dependência nova. Servem de juiz alternativo (fallback quando o free tier
// do Gemini acaba) e, no caso do OpenRouter, de provider da narração de produção.
const openaiJudge = createOpenAICompatible({
  name: 'openai',
  baseURL: 'https://api.openai.com/v1',
  apiKey: process.env['OPENAI_API_KEY'],
})
const openrouter = createOpenAICompatible({
  name: 'openrouter',
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env['OPENROUTER_API_KEY'],
})

/**
 * Modelo-juiz do bake-off. Trocável por env JUDGE_MODEL, roteado por prefixo:
 * `openai:<id>` → OpenAI, `openrouter:<id>` → OpenRouter, senão Google (Gemini).
 * Default gemini-3.1-flash-lite (grátis). Ex.: JUDGE_MODEL=openai:gpt-5-mini.
 */
export const judgeModel = (): LanguageModelV1 => {
  const id = process.env['JUDGE_MODEL'] ?? 'gemini-3.1-flash-lite'
  if (id.startsWith('openai:')) return openaiJudge(id.slice('openai:'.length))
  if (id.startsWith('openrouter:')) return openrouter(id.slice('openrouter:'.length))
  return google(id)
}

// Candidatos do bake-off narrativo (US-17) via endpoint preview grátis do
// NVIDIA NIM. Mesmo provider do bench-ttft.test.ts. Só usado nos evals — a
// narração de produção continua no Groq (narrationModels abaixo).
const nvidia = createOpenAICompatible({
  name: 'nvidia',
  baseURL: 'https://integrate.api.nvidia.com/v1',
  apiKey: process.env['NVIDIA_API_KEY'],
})

/** Modelo candidato da NVIDIA NIM por id (`org/modelo`), para os evals da US-17. */
export const nvidiaModel = (id: string): LanguageModelV1 => nvidia(id)

/**
 * Resolve um id de candidato do bake-off para o provider certo por PREFIXO
 * (US-17, slice 2). `groq:<id>` → Groq (incumbente de produção); `openrouter:<id>`
 * → OpenRouter (candidatos free, ex.: `openrouter:meta-llama/llama-3.3-70b-instruct:free`);
 * qualquer outro id → NVIDIA NIM. Prefixo necessário porque provedores compartilham
 * o mesmo slug (`openai/gpt-oss-120b` existe em Groq, NVIDIA e OpenRouter).
 */
export const resolveModel = (id: string): LanguageModelV1 =>
  id.startsWith('groq:')
    ? groq(id.slice('groq:'.length))
    : id.startsWith('openrouter:')
      ? openrouter(id.slice('openrouter:'.length))
      : id.startsWith('openai:')
        ? openaiJudge(id.slice('openai:'.length))
        : nvidia(id)

// Narração: deepseek-v4-flash (DeepSeek) como primário, via OpenRouter. O id é o
// slug do openrouter.ai. Se emitir raciocínio, o `exclude` em
// NARRATION_PROVIDER_OPTIONS corta antes de vazar na prosa.
export const primaryModel: LanguageModelV1 = openrouter('deepseek/deepseek-v4-flash')
// Fallback: deepseek-v4-pro via OpenRouter. Mesma família do primário (tool
// calling + raciocínio ok), modelo maior para o dia em que o flash falhar.
// Nota: primário e fallback no MESMO provider — um outage do OpenRouter derruba
// os dois (o antigo fallback Groq cobria esse caso).
export const fallbackModel: LanguageModelV1 = openrouter('deepseek/deepseek-v4-pro')
// 3º nível: llama-3.3-70b via Groq. OUTRO provider → sobrevive a um outage do
// OpenRouter, que derrubaria os dois deepseek de uma vez.
export const groqFallbackModel: LanguageModelV1 = groq('llama-3.3-70b-versatile')

// Modelos de narração em ordem de prioridade. O serviço tenta o primeiro e,
// se ele falhar ANTES de emitir texto, cai para o próximo.
export const narrationModels: LanguageModelV1[] = [primaryModel, fallbackModel, groqFallbackModel]

/**
 * Roteamento do OpenRouter para `deepseek/deepseek-v4-flash`. O slug é servido
 * por 22 endpoints (medido em 01/08/2026) e SEM pin o OpenRouter escolhe por
 * preço/uptime a cada request — a rota muda debaixo do prompt.
 *
 * `order` põe o first-party da DeepSeek primeiro: é o ÚNICO endpoint com
 * `supports_implicit_caching: true`. Os outros 21 só cacheiam com `cache_control`
 * explícito, que não mandamos (US-55 decidiu não mandar) — roteou pra lá, o
 * cache-hit da US-55/US-56 é ZERO e a leitura de cache custa 5x a 25x mais
 * ($0.0028/M no first-party vs $0.014–0.070/M nos demais).
 *
 * `only` é allowlist, não denylist: endpoint novo entra sem revisão nossa e pode
 * ser fp4. Ficaram de fora os fp4 (deepinfra, ionstream, ambient, atlas-cloud,
 * mancer — quantização agressiva é o suspeito nº 1 da degeneração da US-69),
 * os de contexto curto (io-net 32k, akashml 128k) e os de uptime < 99% em 24h.
 *
 * Re-medir com: curl -s openrouter.ai/api/v1/models/deepseek/deepseek-v4-flash/endpoints
 */
// Sem `as const`: readonly[] não casa com o JSONValue de providerOptions.
const DEEPSEEK_ROUTE_ORDER = ['deepseek']
const DEEPSEEK_ALLOWED_PROVIDERS = [
  'deepseek', // ref quant, 1024k, cache implícito — sem structured_outputs
  'baidu', // fp8, 1024k, mais barato, structured_outputs
  'streamlake', // fp8, 1000k, structured_outputs
  'alibaba', // fp8, 977k, structured_outputs
  'cloudflare', // 375k, structured_outputs, uptime mais alto da lista
  'gmicloud', // fp8, 1024k
  'novita', // fp8, 1024k
  'siliconflow', // fp8, 1024k
]

/**
 * Opções de provider da narração — passar em TODA chamada que usa
 * `narrationModels`. O primário é um modelo de raciocínio: separa o
 * pensamento (canal `analysis`) da resposta (canal `final`). Sem `exclude`, o
 * OpenRouter devolve o raciocínio no campo `reasoning`, que o
 * @ai-sdk/openai-compatible@0.2.16 hoje ignora — ele só lê `reasoning_content`.
 * Ou seja, a prosa fica limpa POR ACIDENTE: basta o provider passar a mapear
 * `reasoning` para o texto e o raciocínio vaza para a narração do mestre.
 * `exclude: true` corta na origem, sem depender desse detalhe do SDK.
 *
 * A chave `openrouter` casa com o `name` do createOpenAICompatible; o fallback
 * Groq ignora o bloco (lê a chave `groq`), então serve os dois modelos da escada.
 *
 * `require_parameters: true` faz o bloco servir os dois tipos de chamada com uma
 * config só: no `streamText`/`generateText` da narração a DeepSeek suporta tudo
 * que mandamos e fica em 1º; nos `generateObject` (ai.service.ts:948, :983, :1027)
 * o request leva json_schema, que a DeepSeek NÃO anuncia (`structured_outputs`
 * ausente) — o OpenRouter a descarta sozinho e cai no baidu/streamlake. Sem essa
 * flag o provider aceitaria e ignoraria o schema, devolvendo objeto fora do
 * formato. Extração não tem prefixo cacheável, então não perde nada indo pro 2º.
 *
 * ponytail: o raciocínio ainda é gerado e cobrado, só não volta. Se o custo/TTFT
 * pesar, o próximo passo é `reasoning: { effort: 'low' }`.
 */
export const NARRATION_PROVIDER_OPTIONS = {
  // exclude: raciocínio gerado mas NÃO retornado (não vaza na prosa). SEM cortar
  // effort: `effort:'low'` fez o modelo raciocinar de menos e desrespeitar as
  // regras do prompt (rolagens/magias inventadas). 'medium' = meio-termo custo/aderência;
  // se voltar a inventar regras, subir para 'high'. Teto de corte no maxTokens (4000).
  openrouter: {
    reasoning: { effort: 'medium', exclude: true },
    provider: { order: DEEPSEEK_ROUTE_ORDER, only: DEEPSEEK_ALLOWED_PROVIDERS, require_parameters: true },
  },
} as const

// Sumarização de memória: mesmo deepseek-v4-flash da narração, via OpenRouter.
// Antes usava groq('llama-3.1-8b-instant'), mas o free tier daquele modelo tem
// teto de 6000 TPM — o lote de overflow (resumo acumulado + N turnos) estourava
// com 413 "Request too large". OpenRouter (já pago, aguenta a narração maior)
// não tem esse teto minúsculo. Passe NARRATION_PROVIDER_OPTIONS na chamada para
// o raciocínio não vazar no resumo.
export const summaryModel: LanguageModelV1 = primaryModel
