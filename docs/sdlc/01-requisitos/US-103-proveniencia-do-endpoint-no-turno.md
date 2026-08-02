# US-103 — Saber qual endpoint serviu o turno

**Épico:** 5 — Qualidade e avaliação do DM Agent
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Nasceu de:** a [ADR 008](../../adr/008-pin-de-roteamento-no-openrouter.md) pinou a rota do OpenRouter e não deixou como conferir se o pin é obedecido. Nasceu apontando para a *Questão em aberto* #2 daquela ADR, que **fechou antes desta story começar** (a resposta estava no SDK, não no tráfego — ver ADR 008 §3); o motivo abaixo sobreviveu à pergunta que a originou.
**Relacionada a:** [ADR 008](../../adr/008-pin-de-roteamento-no-openrouter.md) (o pin que esta story torna verificável), [US-69](./US-69-guard-anti-degeneracao-narracao.md) (o PASSO 0 que já tentou logar isto e não entregou o dado), [US-74](./US-74-guard-turno-truncado-narracao.md) (mesma classe de investigação: sintoma na prosa, causa possivelmente no backend), [US-104](./US-104-baseline-de-cache-do-prompt-pos-pin.md) (consome este log para explicar um hit-rate ruim)
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

A causa provável é o caminho `@ai-sdk/openai-compatible@0.2.16`, que normaliza só o que o formato OpenAI prevê. O OpenRouter devolve o endpoint servidor em campo **fora** desse formato, que sobrevive no corpo bruto — o mesmo lugar de onde o spike de cache já pesca `prompt_tokens_details.cached_tokens` (ver o bloco `DM_CACHE_SPIKE` no `onFinish`). O dado provavelmente está lá; o que falta é ler.

Não é certeza: **é a hipótese a testar no primeiro slice**, e a story tem um plano B se ela cair.

### O que fica bloqueado sem isto

1. **O pin em si.** Declarar `provider.order` no request não é prova de que o request foi servido por ele — `allow_fallbacks` continua ligado, de propósito, e o único endpoint que cacheia é um só. Um outage silencioso do first-party degrada o cache sem erro nenhum. Hoje isso é invisível, e é a razão principal desta story.
2. **A próxima US-69.** Volta o embaralhamento, volta a mesma pergunta sem resposta.
3. **A [US-104](./US-104-baseline-de-cache-do-prompt-pos-pin.md) quando o número vier ruim.** Hit-rate baixo com rota confirmada aponta para o prompt; hit-rate baixo com rota errada aponta para a allowlist. Sem este log, os dois diagnósticos são indistinguíveis.

*(A quarta razão original — fechar a Q2 da ADR 008 — caiu. A pergunta pressupunha que os `generateObject` mandavam `json_schema`; eles mandam tool, e isso se descobriu lendo o SDK. Fica como lembrete de que capacidade anunciada pelo servidor não é o mesmo que conteúdo do request.)*

---

## Escopo

### Dentro do escopo

- Extrair o nome do endpoint servidor no `onFinish` do turno e no retorno dos `generateObject`.
- Uma linha de log curta e estável por chamada, **sem flag de env** — é barata e o valor está em existir no dia do incidente, não em ser ligada depois dele.
- Plano B, se o corpo bruto não trouxer o campo: buscar por `GET /api/v1/generation?id=<id>` na API do OpenRouter, com o id da geração. É uma chamada extra, fora do caminho da resposta ao jogador.
- Teste de regressão da função de extração, com fixture de um corpo de resposta real.

### Fora do escopo

- Persistir a proveniência no banco. É log, não dado de domínio. (Se virar dado de domínio, é outra story — e provavelmente passa pela [US-75](./US-75-dimensao-de-proveniencia-no-ledger.md), que já tem "proveniência" no nome com outro sentido.)
- Dashboard, agregação, alerta. Reagir a um endpoint ruim é decisão humana enquanto não houver número dizendo com que frequência acontece.
- Mudar o pin, a allowlist ou qualquer coisa da [ADR 008](../../adr/008-pin-de-roteamento-no-openrouter.md). Esta story **observa**; não decide.
- Medir cache. É a [US-104](./US-104-baseline-de-cache-do-prompt-pos-pin.md).

---

## Critérios de aceite

- [ ] Todo turno emite uma linha de log contendo o nome do endpoint que serviu (ex.: `deepseek`, `baidu/fp8`), no formato de uma linha só, sem dump de objeto.
- [ ] Os três `generateObject` (`extractOpeningScene`, `extractOpeningEntities`, `reconcileScene`) também emitem essa linha.
- [ ] Numa sessão real, o log mostra o endpoint da narração como o first-party da DeepSeek — o pin da [ADR 008](../../adr/008-pin-de-roteamento-no-openrouter.md) confirmado por observação, não por declaração.
- [ ] Numa sessão real, os três `generateObject` aparecem servidos pelo **mesmo** endpoint da narração — a §3 da [ADR 008](../../adr/008-pin-de-roteamento-no-openrouter.md) confirmada por observação. Se aparecerem em endpoint diferente, a §3 está errada e a story registra isso em vez de acomodar o resultado.
- [ ] A extração tem teste com fixture do corpo bruto real, e o teste falha se o campo mudar de lugar.
- [ ] A ausência do campo **não** derruba o turno: falta de proveniência loga `desconhecido` e segue.
- [ ] Um turno servido por endpoint **fora** da allowlist (se acontecer) é distinguível no log sem precisar de investigação — é o caso que a story existe para tornar visível.

---

## Notas de implementação

- **Onde.** [`apps/api/src/ai/ai.service.ts`](../../../apps/api/src/ai/ai.service.ts), no `onFinish` do `streamText` (busque por `US-69 PASSO 0`) — o log de `providerMetadata` já está lá e é o ponto natural de troca: hoje despeja o objeto inteiro, deveria emitir o nome.
- **Onde procurar o campo.** O bloco atrás de `DM_CACHE_SPIKE` já despeja `providerMetadata` **e** `response.body`. Rodar uma sessão com a flag ligada e ler o dump é o primeiro passo — barato, e responde onde o campo vive antes de escrever qualquer código.
- **Extração isolada.** A leitura do corpo bruto merece função própria e testável, não um encadeamento de `?.` no meio do `onFinish`. É o mesmo motivo pelo qual o spike de cache é um bloco separado.
- **Plano B tem custo.** `GET /api/v1/generation?id=` é uma chamada de rede a mais por turno. Só entra se o campo não vier no corpo, e mesmo assim fora do caminho crítico (o turno já foi entregue) — mesmo padrão do `reconcileScene`.
- **Nomear o endpoint, não só o provedor.** O que importa é `baidu/fp8` contra `deepinfra/fp4`: o campo `tag` da API de endpoints carrega provedor **e** quantização. Se o corpo da resposta só trouxer o nome do provedor, registrar essa limitação — quantização é metade do valor diagnóstico.

---

## Questões em aberto

1. **O campo existe no corpo bruto?** Toda a story assume que sim. Se o dump com `DM_CACHE_SPIKE` mostrar que não, o slice 1 vira o plano B e o custo da story sobe — decidir ali se ainda vale.
2. **Vale logar em todo turno ou só quando algo cheira mal?** A proposta é sempre, porque o incidente é justamente quando ninguém estava medindo. Se o volume de log incomodar em produção, a alternativa é logar sempre em erro/`finishReason` anômalo e amostrar o resto.
3. **A escada de fallback também deveria aparecer?** Saber que o turno foi servido pelo nível 2 (`deepseek-v4-pro`) ou pelo Groq é informação da mesma família e hoje igualmente invisível. Fora do escopo por ora; se o slice 1 for barato, cabe junto.
4. **Contar as extrações que caem no `catch`.** Signal diferente deste (conformidade de schema, não roteamento), mas mesma classe de defeito silencioso e mesmo arquivo. Hoje as três extrações rodam em tool mode e a conformidade depende de quão bem o endpoint valida argumento de tool; ninguém sabe com que frequência falham, porque o `catch` devolve `null` igual a "não havia cena para extrair". É o número que decide se vale ligar `supportsStructuredOutputs: true` (ver [ADR 008](../../adr/008-pin-de-roteamento-no-openrouter.md) §3) — e é um contador, não uma feature. Cabe junto se o slice 1 for barato; vira story própria se não for.

---

## Referências no código

- [`apps/api/src/ai/ai.service.ts`](../../../apps/api/src/ai/ai.service.ts) — `onFinish` do `streamText`: o log do PASSO 0 (`US-69 PASSO 0`), o bloco `DM_CACHE_SPIKE` e o comentário do `presencePenalty` que registra o diagnóstico travado. Os três `generateObject` estão mais abaixo no mesmo arquivo.
- [`packages/ai-engine/src/model.ts`](../../../packages/ai-engine/src/model.ts) — `DEEPSEEK_ALLOWED_PROVIDERS`: os nomes que o log deve mostrar, e o comando de re-medição da lista.
- [`packages/ai-engine/src/model-routing.test.ts`](../../../packages/ai-engine/src/model-routing.test.ts) — o guard do pin. Ele protege a *declaração*; esta story observa o *efeito*.
