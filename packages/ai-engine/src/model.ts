import { createGroq } from '@ai-sdk/groq'
import { createOpenAICompatible, type MetadataExtractor } from '@ai-sdk/openai-compatible'
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

/**
 * Modelo de tradução do overlay do SRD (US-52). Roda no BUILD (`pnpm srd:ingest`),
 * nunca em runtime de jogo. Mesmo provider e mesma `GEMINI_API_KEY` do `judgeModel`.
 *
 * Fixo de propósito (US-52 → Questões em aberto #2): como roda no build, um modelo
 * mais forte custa latência, não dinheiro — mas trocar antes de o flash-lite
 * decepcionar é env var sem cliente. Extrair `TRANSLATE_MODEL` é uma linha aqui.
 */
export const translateModel = (): LanguageModelV1 => google('gemini-3.1-flash-lite')

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

/**
 * US-103 — proveniência: QUAL endpoint do OpenRouter serviu a chamada. O slug
 * `deepseek/deepseek-v4-flash` é servido por 22 endpoints (ADR 008) e o pin abaixo
 * só DECLARA a rota: sem isto, "backend ruim" fica sendo hipótese sem teste (foi o
 * que travou o diagnóstico da US-69).
 *
 * O OpenRouter devolve `provider` e `system_fingerprint` no TOPO do corpo, fora do
 * formato OpenAI — o @ai-sdk/openai-compatible@0.2.16 não os normaliza. Medido no
 * dist em 04/08/2026: `doGenerate` expõe o corpo bruto (`rawResponse.body`), mas
 * `doStream` NÃO (só headers) — no streaming o único acesso ao campo é este
 * `metadataExtractor`, que o SDK chama por chunk (index.mjs:543). Por isso a leitura
 * vive aqui e não num `?.` dentro do onFinish: um só código serve narração e extrações.
 *
 * Corpo real capturado em 04/08/2026 (o mesmo que o teste usa de fixture):
 *   "provider": "DeepSeek",
 *   "system_fingerprint": "fp_a18b46594c_prod0820_fp8_kvcache_20260402"
 * O `provider` nomeia só o provedor; a quantização (metade do valor diagnóstico) vem
 * de carona no fingerprint, que é do upstream e pode sumir sem aviso — daí ser opcional.
 */
type Provenance = { endpoint: string; fingerprint?: string }

const readProvenance = (payload: unknown): Provenance | undefined => {
  const body = payload as { provider?: unknown; system_fingerprint?: unknown } | null
  const endpoint = typeof body?.provider === 'string' ? body.provider.trim() : ''
  if (!endpoint) return undefined
  const fingerprint = typeof body?.system_fingerprint === 'string' ? body.system_fingerprint : undefined
  return fingerprint ? { endpoint, fingerprint } : { endpoint }
}

/**
 * Põe a proveniência em `providerMetadata.openrouter` — a mesma chave onde o SDK já
 * escreve `cachedPromptTokens`/`reasoningTokens`, e onde o log do turno já olha.
 */
export const OPENROUTER_PROVENANCE: MetadataExtractor = {
  extractMetadata: ({ parsedBody }) => {
    const provenance = readProvenance(parsedBody)
    return provenance ? { openrouter: { ...provenance } } : undefined
  },
  createStreamExtractor: () => {
    // Todo chunk repete os campos; guardamos o PRIMEIRO — o roteamento não muda no
    // meio do stream, e o chunk final às vezes vem só com usage.
    let seen: Provenance | undefined
    return {
      processChunk(parsedChunk) {
        if (!seen) seen = readProvenance(parsedChunk)
      },
      buildMetadata: () => (seen ? { openrouter: { ...seen } } : undefined),
    }
  },
}

/**
 * Formata a proveniência para UMA linha de log (US-103). Nunca lança e nunca some:
 * ausência do campo vira `desconhecido`, que é sinal — turno servido pelo Groq (3º
 * nível da escada, outro provider) ou endpoint que parou de mandar `provider`.
 */
export const formatProvenance = (metadata: unknown): string => {
  const openrouter = (metadata as Record<string, Partial<Provenance>> | null)?.['openrouter']
  const endpoint = typeof openrouter?.endpoint === 'string' ? openrouter.endpoint : 'desconhecido'
  const fingerprint = typeof openrouter?.fingerprint === 'string' ? ` fp=${openrouter.fingerprint}` : ''
  return `endpoint=${endpoint}${fingerprint}`
}

// O 3º argumento é config PARCIAL do modelo de chat: a factory espalha os defaults
// dela (url, headers com a OPENROUTER_API_KEY, `defaultObjectGenerationMode: 'tool'`)
// ANTES do que passamos, então só o `metadataExtractor` muda. Ele não é aceito no
// `createOpenAICompatible` acima — só aqui, por modelo (index.d.ts:284).
const WITH_PROVENANCE = { metadataExtractor: OPENROUTER_PROVENANCE }

// Narração: deepseek-v4-flash (DeepSeek) como primário, via OpenRouter. O id é o
// slug do openrouter.ai. Se emitir raciocínio, o `exclude` em
// NARRATION_PROVIDER_OPTIONS corta antes de vazar na prosa.
//
// 22/08/2026: trocado de `~deepseek/deepseek-v4-flash-latest` (ROUTER alias, "always
// redirects to the latest model in the DeepSeek V4 Flash family") para o slug fixo
// `deepseek/deepseek-v4-flash`, hoje nomeado "DeepSeek V4 Flash 0423" pelo próprio
// OpenRouter (`GET /models/deepseek/deepseek-v4-flash/endpoints` → `name`). O alias
// trocava de versão sozinho debaixo do prompt (medido em 04/08/2026: servia
// `-0731` enquanto o slug fixo servia outro snapshot) — pin explícito fecha esse
// drift; trocar de versão agora exige editar esta linha.
// O pin de rota abaixo continua valendo: os dois probes (reasoning medium/exclude e
// enabled:false) voltaram 200 com `provider: "DeepSeek"` e `require_parameters: true`.
export const primaryModel: LanguageModelV1 = openrouter('deepseek/deepseek-v4-flash', {}, WITH_PROVENANCE)
// Fallback: deepseek-v4-pro via OpenRouter. Mesma família do primário (tool
// calling + raciocínio ok), modelo maior para o dia em que o flash falhar.
// Nota: primário e fallback no MESMO provider — um outage do OpenRouter derruba
// os dois (o antigo fallback Groq cobria esse caso).
export const fallbackModel: LanguageModelV1 = openrouter('deepseek/deepseek-v4-pro', {}, WITH_PROVENANCE)
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
 * `require_parameters: true` derruba o endpoint que não suporta TODO parâmetro do
 * request, em vez de deixá-lo aceitar e ignorar em silêncio. Hoje quem isso protege
 * é o `presencePenalty: 0.3` da narração (US-69): sem a flag, um endpoint que não
 * o implementa serviria o turno sem a penalidade e sem avisar. Falha fechado de
 * propósito — modelo candidato que não aceite algum parâmetro nosso vai ERRAR aqui,
 * não degradar.
 *
 * NÃO afeta os `generateObject` (ai.service.ts:948, :983, :1027), ao contrário do que
 * esta nota afirmou até 01/08/2026. `createChatModel` do openai-compatible força
 * `defaultObjectGenerationMode: 'tool'`, e `generateObject` sem `mode` explícito
 * resolve 'auto' para esse default: o schema vai como definição de tool, e
 * `response_format` nunca é enviado. Sem `response_format` não há o que filtrar por
 * `structured_outputs` — as extrações vão para o MESMO endpoint da narração.
 * Para mudar isso seria preciso `supportsStructuredOutputs: true` no
 * `createOpenAICompatible` acima (default do SDK é `false`, dist/index.mjs:246).
 *
 * CORREÇÃO 04/08/2026: "não afeta" era verdade sobre roteamento e FALSO sobre o
 * request. O `tool_choice` que aquele modo tool envia é incompatível com o thinking
 * do DeepSeek — 400 `Thinking mode does not support this tool_choice`. Por isso as
 * extrações passaram a usar EXTRACTION_PROVIDER_OPTIONS (abaixo).
 *
 * ponytail: o raciocínio ainda é gerado e cobrado, só não volta. Se o custo/TTFT
 * pesar, o próximo passo é `reasoning: { effort: 'low' }`.
 */
// O pin de rota é o MESMO da narração e das extrações: o motivo dele (cache implícito,
// fp4 fora, falha fechado) não muda com o tipo da chamada. Só o raciocínio difere.
const DEEPSEEK_ROUTE = { order: DEEPSEEK_ROUTE_ORDER, only: DEEPSEEK_ALLOWED_PROVIDERS, require_parameters: true }

// 23/08/2026: o MOTOR (generateObject/modo tool) precisa de uma rota SEM
// `require_parameters`. Medido nesta data: o endpoint first-party `deepseek`
// sumiu da tabela de roteamento do slug (17 endpoints restantes, nenhum
// `deepseek`) e, com `require_parameters: true`, NENHUM dos 7 endpoints
// restantes do `only` passa no check do OpenRouter para o `tool_choice`
// FORÇADO ({type:'function', function:{name:...}}) que o modo tool manda —
// mesmo listando `tool_choice` como parâmetro suportado (genérico, não cobre
// a forma forçada). Resultado: 404 "No endpoints found that support the
// provided 'tool_choice' value" em toda chamada do motor. Reproduzido direto
// contra a API do OpenRouter; sem `require_parameters` a mesma allowlist
// funciona (roteia pro StreamLake). `require_parameters` protegia o
// `presencePenalty` da NARRAÇÃO (US-69) — o motor não manda esse parâmetro,
// então a proteção não se aplica aqui.
const DEEPSEEK_ENGINE_ROUTE = { order: DEEPSEEK_ROUTE_ORDER, only: DEEPSEEK_ALLOWED_PROVIDERS }

export const NARRATION_PROVIDER_OPTIONS = {
  // exclude: raciocínio gerado mas NÃO retornado (não vaza na prosa). SEM cortar
  // effort: `effort:'low'` fez o modelo raciocinar de menos e desrespeitar as
  // regras do prompt (rolagens/magias inventadas). 'medium' = meio-termo custo/aderência;
  // se voltar a inventar regras, subir para 'high'. Teto de corte no maxTokens (4000).
  openrouter: {
    reasoning: { effort: 'medium', exclude: true },
    provider: DEEPSEEK_ROUTE,
  },
} as const

/**
 * Opções das EXTRAÇÕES estruturadas (`generateObject`: cena da abertura, entidades,
 * reconciliação de cena). Mesma rota da narração, thinking DESLIGADO.
 *
 * Medido em 04/08/2026 contra o first-party da DeepSeek, com o mesmo `tool_choice`
 * que o modo tool do SDK envia:
 *   reasoning {effort:'medium', exclude:true} → 400 "Thinking mode does not support
 *                                                    this tool_choice"
 *   SEM a chave `reasoning`                   → 400, o MESMO erro (thinking é o
 *                                                    default do modelo — omitir não desliga)
 *   reasoning {enabled:false}                 → 200, tool call correto
 *
 * É o `enabled: false` que faz a extração funcionar; trocar por `exclude`/`effort`
 * volta a derrubar as três chamadas — e elas falham em SILÊNCIO (cada `catch`
 * devolve null e a aventura segue sem cena/ledger).
 *
 * Extrair não é tarefa de raciocínio: o schema é fechado e a instrução é copiar do
 * texto. Desligar o thinking também tira o custo e a latência que ele cobrava aqui.
 */
export const EXTRACTION_PROVIDER_OPTIONS = {
  openrouter: {
    reasoning: { enabled: false },
  },
} as const

/**
 * 2026-08-19: opções das chamadas do MOTOR de geração de aventura
 * (`generateLocationsAndNpcs`/`generateSecrets`/`generateClosing`/`generateOpeningBeat`
 * em `ai.service.ts`) — rodam no `primaryModel` (deepseek-v4-flash), não no
 * `extractionModel` (qwen). Motivo: essas quatro chamadas amarram ~7 NPCs a ~6
 * locais/encontros/segredos num único objeto coerente (o gate da US-150 rejeita
 * NPC/local órfão), tarefa de raciocínio real — qwen3.7-flash esgotava as 3
 * tentativas do gate com frequência (`adventure_gate_failed` em produção local).
 * Mesmo `{enabled:false}` de `EXTRACTION_PROVIDER_OPTIONS` (mesma colisão
 * tool_choice/thinking do modo tool), MAIS o `provider: DEEPSEEK_ENGINE_ROUTE`
 * (mesmo `order`/`only` da narração) — sem o pin, o OpenRouter roteia livre
 * entre os endpoints do slug (ADR 008), incluindo os fp4 que a narração exclui
 * por degradação.
 *
 * CORREÇÃO 23/08/2026: era `DEEPSEEK_ROUTE` (com `require_parameters`) até
 * essa data — trocado para `DEEPSEEK_ENGINE_ROUTE` (sem `require_parameters`,
 * ver comentário dela) porque o `tool_choice` forçado do modo tool zerava
 * TODOS os endpoints do `only` e derrubava as 4 chamadas com 404 em toda
 * tentativa (`adventure_gate_failed` × 3, `createForCharacter` sempre falhava).
 */
export const ENGINE_PROVIDER_OPTIONS = {
  openrouter: {
    reasoning: { enabled: false },
    provider: DEEPSEEK_ENGINE_ROUTE,
  },
} as const

/**
 * US-114: modelo utilitário para extração estruturada e fecho de turno truncado —
 * `extractOpeningScene`/`extractOpeningEntities`/`reconcileScene`/`completeTruncatedTurn`
 * (`ai.service.ts`) saem do `deepseek-v4-flash` da narração. As quatro são cópia de
 * schema fechado ou continuação curta, não raciocínio de fronteira; `summaryModel`
 * continua no modelo grande porque É o caso que já quebrou (413 "Request too large"
 * do antigo `groq('llama-3.1-8b-instant')`, ver comentário dele abaixo) — o lote de
 * overflow da sumarização cresce com a aventura, as quatro chamadas daqui têm
 * entrada pequena e limitada (um texto de abertura, uma narração de um turno).
 * 2026-08-19: o MOTOR de geração de aventura saiu daqui para `primaryModel` +
 * `ENGINE_PROVIDER_OPTIONS` acima — ficou maior/mais lento demais pro perfil de
 * latência que justificou esta story (60s do proxy), mas continua exato pras
 * quatro chamadas abaixo.
 *
 * `qwen/qwen3.7-flash`, SEM `provider` pin de propósito: endpoint único (Alibaba
 * direto) — `DEEPSEEK_ROUTE` é pin de rota `only: DEEPSEEK_ALLOWED_PROVIDERS`
 * específico da família DeepSeek; herdá-lo aqui faria o OpenRouter não achar
 * provedor que case (falha dentro de um `catch` que devolve `null`, em silêncio).
 * Sem `provider` nenhum não há esse risco (US-114, critério de aceite #4).
 *
 * Medido 2026-08-16/17 (US-114, Questões em aberto #1/#2) contra
 * `POST /chat/completions` com o mesmo `tool_choice`/schema que `generateObject`
 * em modo tool manda: aceita tool calling; thinking desliga só com
 * `reasoning: { enabled: false }` — mesma armadilha do DeepSeek acima, mas com um
 * agravante: `exclude`/`effort`/omitir dão 400 em `generateObject` (alto e visível),
 * e dão 200 com corpo VAZIO em `generateText` (`completeTruncatedTurn`) — falha
 * SILENCIOSA, sem log, degrada sempre pro `SALVAGE_FALLBACK`. Por isso
 * `SALVAGE_PROVIDER_OPTIONS` (`ai.service.ts`) usa a MESMA chave `{enabled:false}`,
 * não a antiga `{effort:'low', exclude:true}`.
 */
export const extractionModel: LanguageModelV1 = openrouter('qwen/qwen3.7-flash', {}, WITH_PROVENANCE)

// Sumarização de memória: mesmo deepseek-v4-flash da narração, via OpenRouter.
// Antes usava groq('llama-3.1-8b-instant'), mas o free tier daquele modelo tem
// teto de 6000 TPM — o lote de overflow (resumo acumulado + N turnos) estourava
// com 413 "Request too large". OpenRouter (já pago, aguenta a narração maior)
// não tem esse teto minúsculo. Passe NARRATION_PROVIDER_OPTIONS na chamada para
// o raciocínio não vazar no resumo.
export const summaryModel: LanguageModelV1 = primaryModel
