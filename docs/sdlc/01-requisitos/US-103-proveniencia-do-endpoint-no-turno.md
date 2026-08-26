# US-103 — Saber qual endpoint serviu o turno

**Épico:** 5 — Qualidade e avaliação do DM Agent
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada (04/08/2026). Chamada real pelo mesmo caminho do app: narração (streaming) e `generateObject` saíram os dois em `endpoint=DeepSeek fp=fp_a18b46594c_prod0820_fp8_kvcache_20260402` — pin da [ADR 008](../../adr/008-pin-de-roteamento-no-openrouter.md) e sua §3 confirmados por observação
**Nasceu de:** a [ADR 008](../../adr/008-pin-de-roteamento-no-openrouter.md) pinou a rota do OpenRouter e não deixou como conferir se o pin é obedecido. Nasceu apontando para a *Questão em aberto* #2 daquela ADR, que **fechou antes desta story começar** (a resposta estava no SDK, não no tráfego — ver ADR 008 §3); o motivo abaixo sobreviveu à pergunta que a originou.
**Relacionada a:** [ADR 008](../../adr/008-pin-de-roteamento-no-openrouter.md) (o pin que esta story torna verificável), [US-69](./US-69-guard-anti-degeneracao-narracao.md) (o PASSO 0 que já tentou logar isto e não entregou o dado), [US-74](./US-74-guard-turno-truncado-narracao.md) (mesma classe de investigação: sintoma na prosa, causa possivelmente no backend), US-104 (consome este log para explicar um hit-rate ruim)
**Criada em:** 2026-08-01

---

## História

> **Como** quem investiga uma narração ruim ou uma conta de custo estranha,
> **quero** ver no log qual endpoint do OpenRouter serviu aquele turno,
> **para que** "backend ruim" deixe de ser uma hipótese que não dá para confirmar nem descartar.

---

## Contexto e motivação

### O problema observado

O slug `deepseek/deepseek-v4-flash` é servido por **22 endpoints** distintos (medidos em 01/08/2026 — ver [ADR 008](../../adr/008-pin-de-roteamento-no-openrouter.md) §1). Eles diferem em quantização (cinco servem em fp4), em cache implícito (só um tem) e em janela de contexto (de 32k a 1M). Um turno ruim pode ser culpa do prompt, do modelo **ou do endpoint** — e hoje o terceiro nunca entra na conta, porque ninguém consegue nomeá-lo.

Isto já custou uma investigação. O comentário do `presencePenalty` em [`ai.service.ts`](../../../apps/api/src/ai/ai.service.ts) (busque por `presencePenalty, NÃO frequencyPenalty`) registra o diagnóstico da reincidência do embaralhamento de whitespace da [US-69](./US-69-guard-anti-degeneracao-narracao.md), e a frase decisiva é: *"providerMetadata SEM nome de backend (não dá pra confirmar 'backend ruim')"*. A hipótese principal ficou sem teste, e a story seguiu pela hipótese secundária.

### Por que a solução atual não basta

O log já existe. O **PASSO 0** da US-69 despejou `providerMetadata` no `onFinish` exatamente com esta intenção — o comentário diz *"loga SEMPRE o provider upstream que o OpenRouter roteou"*. **Foi implementado e não entregou o dado**: na ocorrência real, `providerMetadata` veio sem o nome do backend.

A causa é o caminho `@ai-sdk/openai-compatible@0.2.16`, que normaliza só o que o formato OpenAI prevê. O OpenRouter devolve o endpoint servidor em campo **fora** desse formato, que só sobrevive no corpo bruto.

**Medido no `dist` do SDK em 04/08/2026** (a story nasceu supondo que isto era hipótese para um spike; a resposta estava no pacote, como na Q2 da ADR 008):

| caminho | o que o SDK devolve | consequência |
| --- | --- | --- |
| `doGenerate` (`dist/index.mjs:431`) | `rawResponse: { headers, body: rawResponse }` | os três `generateObject` **conseguem** ler o corpo bruto |
| `doStream` (`dist/index.mjs:713`) | `rawResponse: { headers }` — **sem `body`** | o turno da narração **nunca** vê o corpo bruto |
| chunk do stream (`dist/index.mjs:543`) | `metadataExtractor?.processChunk(chunk.rawValue)` | é o **único** gancho para o campo bruto no streaming |

Duas consequências práticas. A primeira: o dump de `response.body` atrás do `DM_CACHE_SPIKE` no `onFinish` do `streamText` loga `undefined` — rodar a sessão com a flag ligada nunca ia responder onde o campo vive na narração. A segunda: o caminho suportado é o `metadataExtractor`, que atende streaming **e** não-streaming de uma vez e entrega o resultado dentro de `providerMetadata`, exatamente onde o log do PASSO 0 já olha.

### O que fica bloqueado sem isto

1. **O pin em si.** Declarar `provider.order` no request não é prova de que o request foi servido por ele — `allow_fallbacks` continua ligado, de propósito, e o único endpoint que cacheia é um só. Um outage silencioso do first-party degrada o cache sem erro nenhum. Hoje isso é invisível, e é a razão principal desta story.
2. **A próxima US-69.** Volta o embaralhamento, volta a mesma pergunta sem resposta.
3. **A US-104 quando o número vier ruim.** Hit-rate baixo com rota confirmada aponta para o prompt; hit-rate baixo com rota errada aponta para a allowlist. Sem este log, os dois diagnósticos são indistinguíveis.

*(A quarta razão original — fechar a Q2 da ADR 008 — caiu. A pergunta pressupunha que os `generateObject` mandavam `json_schema`; eles mandam tool, e isso se descobriu lendo o SDK. Fica como lembrete de que capacidade anunciada pelo servidor não é o mesmo que conteúdo do request.)*

---

## Escopo

### Dentro do escopo

- Um `metadataExtractor` para o provider `openrouter`, em [`model.ts`](../../../packages/ai-engine/src/model.ts), que põe o nome do endpoint servidor dentro de `providerMetadata`. Vale para a narração (streaming) e para os três `generateObject` (não-streaming) com o mesmo código.
- Uma linha de log curta e estável por chamada, **sem flag de env** — é barata e o valor está em existir no dia do incidente, não em ser ligada depois dele.
- Também na linha: o `modelId` que serviu, para o nível da escada de fallback aparecer junto (era a *Questão em aberto* #3; ver decisão abaixo).
- Plano B, se nem o chunk nem o corpo bruto trouxerem o campo: buscar por `GET /api/v1/generation?id=<id>` na API do OpenRouter, com o id da geração. É uma chamada extra, fora do caminho da resposta ao jogador.
- Teste de regressão do extrator, com fixture de um chunk de stream **e** de um corpo não-streaming reais.

### Fora do escopo

- Persistir a proveniência no banco. É log, não dado de domínio. (Se virar dado de domínio, é outra story — e provavelmente passa pela [US-75](./US-75-dimensao-de-proveniencia-no-ledger.md), que já tem "proveniência" no nome com outro sentido.)
- Dashboard, agregação, alerta. Reagir a um endpoint ruim é decisão humana enquanto não houver número dizendo com que frequência acontece.
- Mudar o pin, a allowlist ou qualquer coisa da [ADR 008](../../adr/008-pin-de-roteamento-no-openrouter.md). Esta story **observa**; não decide.
- Medir cache. É a US-104.

---

## Critérios de aceite

- [x] Todo turno emite uma linha de log contendo o nome do endpoint que serviu, no formato de uma linha só, sem dump de objeto. É a **mesma** linha do `finishReason` que já existe — o log do PASSO 0 (`providerMetadata=` cru) saiu no lugar, então o saldo de linhas por turno é negativo.
- [x] A linha também nomeia o `modelId`, distinguindo os três níveis da escada (`deepseek-v4-flash` / `deepseek-v4-pro` / `llama-3.3-70b-versatile`).
- [x] Os três `generateObject` (`extractOpeningScene`, `extractOpeningEntities`, `reconcileScene`) também emitem essa linha, via `logExtractionEndpoint`.
- [x] Numa chamada real (04/08/2026), o log mostra o endpoint da narração como o first-party da DeepSeek — o pin da [ADR 008](../../adr/008-pin-de-roteamento-no-openrouter.md) confirmado por observação, não por declaração:
      `onFinish finishReason=stop model=deepseek/deepseek-v4-flash endpoint=DeepSeek fp=fp_a18b46594c_prod0820_fp8_kvcache_20260402`
- [x] Na mesma execução, o `generateObject` apareceu servido pelo **mesmo** endpoint da narração (`endpoint=DeepSeek`, mesmo fingerprint) — a §3 da [ADR 008](../../adr/008-pin-de-roteamento-no-openrouter.md) confirmada por observação, não só por leitura do SDK.
- [x] O extrator tem teste com fixture real dos **dois** formatos (chunk de stream e corpo não-streaming), e o teste falha se o campo mudar de lugar. Roda sem rede: o extrator é função pura sobre JSON já parseado.
- [x] A ausência do campo **não** derruba o turno: o extrator devolve `undefined` (nada a mesclar) e o log escreve `endpoint=desconhecido`. Coberto por teste, inclusive para o caminho do Groq, que não escreve nessa chave.
- [x] Um turno servido por endpoint **fora** da allowlist (se acontecer) é distinguível no log sem precisar de investigação — o nome vem do provider, não da nossa declaração.

---

## Notas de implementação

- **Onde se lê.** [`apps/api/src/ai/ai.service.ts`](../../../apps/api/src/ai/ai.service.ts), no `onFinish` do `streamText` (busque por `US-69 PASSO 0`) — o nome entrou na linha do `finishReason` e o dump cru de `providerMetadata` saiu. Nas extrações, `logExtractionEndpoint` no mesmo arquivo.
- **Onde se produz.** [`packages/ai-engine/src/model.ts`](../../../packages/ai-engine/src/model.ts): `OPENROUTER_PROVENANCE` (o `MetadataExtractor` — `extractMetadata` para o corpo, `createStreamExtractor` para os chunks) e `formatProvenance` (a formatação da linha). Não é um encadeamento de `?.` no `onFinish` justamente para o mesmo código servir narração e extrações.
- **A opção não está na factory, mas está na chamada do modelo.** `OpenAICompatibleProviderSettings` (`index.d.ts:291-320`) não tem `metadataExtractor`, então `createOpenAICompatible({...})` não o aceita — mas o modelo devolvido recebe um 3º argumento `config?: Partial<OpenAICompatibleChatConfig>` (`index.d.ts:284`), e a factory espalha os defaults dela **antes** dele (`index.mjs:1335`). Ou seja: `openrouter(slug, {}, { metadataExtractor })` preserva `url`, `headers` (com a `OPENROUTER_API_KEY`) e `defaultObjectGenerationMode: 'tool'`. Instanciar `OpenAICompatibleChatLanguageModel` à mão — o plano anterior desta nota — seria reescrever esses defaults sem ganho; em especial perder o modo `tool` mudaria o roteamento das extrações, que é o que a story quer medir.
- **Plano B não foi preciso.** `GET /api/v1/generation?id=` continua como saída se o campo sumir do corpo. Hoje não é chamado: o dado vem no caminho da resposta, sem rede extra.
- **Nomear o endpoint, não só o provedor.** O corpo real traz `provider` (só o nome: `"DeepSeek"`) e, de carona, `system_fingerprint` (`"fp_a18b46594c_prod0820_fp8_kvcache_20260402"`) — que carrega a quantização que faltava. O extrator guarda os dois, com o fingerprint opcional: ele é do upstream e pode sumir sem aviso, então nada depende dele. Continua não sendo o `tag` da API de endpoints (`baidu/fp8`); é o que dá para saber sem uma segunda chamada.

---

## Questões em aberto

Todas fechadas em 04/08/2026, três delas lendo o `dist` do `@ai-sdk/openai-compatible@0.2.16` em vez de rodar sessão.

1. ~~**O campo existe no corpo bruto?**~~ **Fechada: depende do caminho, e o do turno é o pior.** `doGenerate` devolve `body` no `rawResponse`; `doStream` devolve só `headers`. A narração — que é o caso principal da story — nunca vê o corpo, e o dump do `DM_CACHE_SPIKE` no `onFinish` do stream loga `undefined`. O slice 1 **não** virou plano B por causa disso: o `metadataExtractor` do próprio SDK lê o chunk cru e cobre os dois caminhos. Ver a tabela em *Por que a solução atual não basta*. Quanto à quantização, que ficou pendente da primeira execução: o `provider` traz só o nome, mas o `system_fingerprint` que vem ao lado traz `fp8` — capturado junto, ver *Notas de implementação*.
2. ~~**Vale logar em todo turno ou só quando algo cheira mal?**~~ **Fechada: sempre, e sem linha nova.** O nome entra na linha de `finishReason` que já existe, e o dump cru de `providerMetadata` do PASSO 0 sai — o volume de log por turno **diminui**. Amostrar seria trabalho extra para piorar o dado exatamente no caso que a story existe para cobrir.
3. ~~**A escada de fallback também deveria aparecer?**~~ **Fechada: entra, é de graça.** O `modelId` já está à mão no laço da escada (o `logLlmFailure` do fallback já o usa). Vira mais um campo na mesma linha, sem rede e sem código novo. Efeito colateral útil: o Groq não devolve o campo de provedor do OpenRouter, então `desconhecido` na coluna já é o sinal de que o turno saiu da escada do OpenRouter.
4. ~~**Contar as extrações que caem no `catch`.**~~ **Fechada: fora desta story, e provavelmente de qualquer story.** Dois motivos. (a) Não falta instrumentação — os três `catch` já chamam `logLlmFailure`, então falha **já** é distinguível de "não havia cena para extrair" no log de hoje; falta agregação, e um `grep` nos logs do Render responde de graça, enquanto um contador em memória não sobrevive ao processo que dorme no Free tier. (b) A decisão que o número informaria morreu: ligar `supportsStructuredOutputs: true` faria o request mandar `response_format`, e com `require_parameters: true` isso derruba o first-party da DeepSeek — o **único** endpoint com cache implícito, que é a razão inteira do pin. Some-se a correção de 04/08 (`reasoning: { enabled: false }` em `EXTRACTION_PROVIDER_OPTIONS`), que já destravou as extrações em modo tool. Se valer guardar, o lugar é uma nota na [ADR 008](../../adr/008-pin-de-roteamento-no-openrouter.md) §3, não uma questão desta story.

---

## Referências no código

- [`apps/api/src/ai/ai.service.ts`](../../../apps/api/src/ai/ai.service.ts) — `onFinish` do `streamText`: o log do PASSO 0 (`US-69 PASSO 0`), o bloco `DM_CACHE_SPIKE` e o comentário do `presencePenalty` que registra o diagnóstico travado. Os três `generateObject` estão mais abaixo no mesmo arquivo.
- [`packages/ai-engine/src/model.ts`](../../../packages/ai-engine/src/model.ts) — `DEEPSEEK_ALLOWED_PROVIDERS`: os nomes que o log deve mostrar, e o comando de re-medição da lista. É também onde o `metadataExtractor` e a instanciação direta do modelo de chat vão morar, junto do `createOpenAICompatible` que hoje cria o `openrouter`.
- `node_modules/@ai-sdk/openai-compatible@0.2.16/dist/` — a fonte das medições da tabela acima: `index.mjs:431` (body no `doGenerate`), `:713` (sem body no `doStream`), `:543` (`processChunk`), e `index.d.ts:114` / `:291-320` (a opção que existe no config interno e falta na factory pública).
- [`packages/ai-engine/src/model-routing.test.ts`](../../../packages/ai-engine/src/model-routing.test.ts) — o guard do pin. Ele protege a *declaração*; esta story observa o *efeito*.
