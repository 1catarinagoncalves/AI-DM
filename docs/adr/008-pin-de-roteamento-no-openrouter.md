# ADR 008 — Pin de roteamento no OpenRouter: o endpoint faz parte do modelo

**Status:** Aceito (implementado)
**Data:** 2026-08-01
**Decisores:** Time de Produto e Engenharia
**Relacionado:** [ADR 007 — Camadas do prompt por volatilidade](./007-camadas-do-prompt-por-volatilidade.md) (decide o que é cacheável; este ADR decide **para quem** aquele prefixo é enviado, e corrige uma premissa dela) · [ADR 001 — Arquitetura](./001-arquitetura.md) (a escada de provedores) · [US-55](../sdlc/01-requisitos/US-55-prompt-caching-do-dm.md) e [US-56](../sdlc/01-requisitos/US-56-estado-do-turno-na-mensagem.md) (as duas fases que construíram o prefixo cacheável) · [US-69](../sdlc/01-requisitos/US-69-guard-anti-degeneracao-narracao.md) (degeneração de narração — uma das causas plausíveis é quantização)

---

## 1. Contexto

`packages/ai-engine/src/model.ts` declara o primário da narração como um **slug**: `deepseek/deepseek-v4-flash`. O slug não é um servidor. Em 01/08/2026, medindo `GET /api/v1/models/deepseek/deepseek-v4-flash/endpoints`, ele era servido por **22 endpoints** distintos — Baidu, StreamLake, DeepInfra, Alibaba, Cloudflare, Fireworks, Novita, o first-party da própria DeepSeek e mais catorze.

Sem `provider` no corpo do request, quem escolhe entre os 22 é o OpenRouter, por preço, latência e uptime. A escolha não é sorteada a cada request: o OpenRouter aplica **sticky routing**, fixando o endpoint por conversa depois do primeiro request com cache — a chave default é o hash da primeira mensagem de sistema mais a primeira não-sistema. O efeito prático é pior, não melhor: **a primeira escolha continua não-controlada, e a conversa inteira fica presa nela.** Caiu num dos 21 sem cache implícito, é cache-zero até o fim da sessão.

Os 22 não são intercambiáveis:

- **Cache implícito de prefixo: 1 dos 22.** Só o endpoint first-party da DeepSeek anuncia `supports_implicit_caching: true`. Os outros 21 listam preço de leitura de cache, mas cacheiam apenas com `cache_control` explícito — que não mandamos, por decisão registrada na [US-55](../sdlc/01-requisitos/US-55-prompt-caching-do-dm.md) (*Questões em aberto*, Q3).
- **Preço da leitura de cache varia 25x.** $0.0028/M no first-party contra $0.0140–$0.0700/M nos demais.
- **Quantização varia.** Cinco endpoints servem em **fp4** (DeepInfra, Ionstream, Ambient, AtlasCloud, Mancer). Quantização agressiva degrada aderência a instrução longa antes de degradar fluência — o sintoma é exatamente o da [US-69](../sdlc/01-requisitos/US-69-guard-anti-degeneracao-narracao.md) e o de "inventou rolagem que o prompt proíbe".
- **Janela de contexto varia.** O modelo anuncia 1M tokens; Io Net serve 32k, AkashML 128k, DigitalOcean 256k.
- **Saída estruturada varia.** Cinco endpoints não anunciam `structured_outputs` — inclusive o first-party da DeepSeek.

A consequência é que a [ADR 007](./007-camadas-do-prompt-por-volatilidade.md) §3 e a [US-55](../sdlc/01-requisitos/US-55-prompt-caching-do-dm.md) (*Notas de implementação*) afirmam, ambas, que o cache "é automático no DeepSeek/OpenRouter, sem parâmetro a passar". **A afirmação é verdadeira em 1 dos 22 endpoints e falsa nos outros 21.** Todo o trabalho das duas stories — reordenar o system, mover a camada 3 para a mensagem — rende exatamente zero quando o request cai nos outros 21. E rende zero **em silêncio**: a narração sai normal, só que a preço cheio.

O mesmo vale para qualquer medição — e aqui o sticky routing **agrava**. A chave de aderência é o hash das primeiras mensagens, então dois braços de um A/B de prompt, que por definição diferem no system, recebem chaves diferentes e podem grudar em endpoints diferentes: um em fp8 com cache, outro em fp4 sem. O `DM_CACHE_SPIKE`, o `prompt-ab-bakeoff.mjs`, o `move-ab.mjs`: sem rota fixa, A/B de prompt é em parte A/B de infraestrutura, com o viés estável o suficiente para parecer sinal.

---

## 2. Decisão

**O endpoint upstream faz parte da definição do modelo. Toda chamada ao OpenRouter declara sua rota; o slug sozinho não é especificação suficiente.**

Concretamente, em `NARRATION_PROVIDER_OPTIONS` ([`model.ts`](../../packages/ai-engine/src/model.ts)):

```ts
provider: { order: DEEPSEEK_ROUTE_ORDER, only: DEEPSEEK_ALLOWED_PROVIDERS, require_parameters: true }
```

Três regras derivam disso:

1. **`order` prioriza o único endpoint com cache implícito.** `['deepseek']`. Não é preferência por marca: é a única rota em que a ADR 007 tem efeito. Fica em primeiro, não sozinho — `allow_fallbacks` continua no default (`true`). Declarar `order` **desliga o sticky routing** do OpenRouter, por decisão documentada dele: ordem explícita tem precedência. Não perdemos nada — o sticky existia para adivinhar o que agora afirmamos.

2. **A restrição é allowlist (`only`), nunca denylist (`ignore`).** Oito endpoints aprovados: `deepseek`, `baidu`, `streamlake`, `alibaba`, `cloudflare`, `gmicloud`, `novita`, `siliconflow`. Critério de entrada: sem fp4, contexto ≥ 375k, uptime de 24h ≥ 99%. Denylist admite endpoint novo sem revisão — e o OpenRouter adiciona endpoints sem avisar ninguém.

3. **`require_parameters: true` faz a rota se adaptar ao request, em vez de duplicar configuração.** No `streamText`/`generateText` da narração, o first-party suporta tudo que mandamos e permanece em primeiro. Nos três `generateObject` ([`ai.service.ts`](../../apps/api/src/ai/ai.service.ts) — `extractOpeningScene`, `extractOpeningEntities`, `reconcileScene`), o request carrega json_schema, que o first-party **não** anuncia: o OpenRouter o descarta sozinho e cai no Baidu/StreamLake. Um bloco de config serve os dois workloads.

---

## 3. Decisões-chave e justificativas

**Por que pagar mais caro por token não-cacheado.** O first-party está no topo da banda de preço ($0.140/M input, $0.280/M output) contra o Baidu no piso ($0.090/M, $0.179/M). A aposta é inteiramente no hit-rate. Num turno típico — 8k de input com 85% cacheado, 900 tokens de saída — dá ≈ $0.00044 no first-party contra ≈ $0.00088 no Baidu: 2x a favor do pin. **A margem encolhe conforme a saída cresce**, porque o raciocínio é gerado e cobrado mesmo com `exclude: true` (nota já registrada em `model.ts`) e o output do Baidu é 36% mais barato. A 2000 tokens de saída a razão cai para ≈ 1,4x. Se o effort subir para `'high'`, refazer a conta.

**Por que a fronteira do filtro é fp4, e não "só fp8".** Filtrar por `quantizations: ['fp8']` seria mais direto e **excluiria o first-party da DeepSeek**, que anuncia quantização `unknown` (são os pesos de referência). O filtro por atributo derruba justamente o endpoint que queremos. Daí a allowlist nominal.

**Por que allowlist e não `allow_fallbacks: false`.** Fallback desligado dá determinismo total, e é tentador: rota fixa ou erro, nunca degradação silenciosa. Rejeitado porque um 503 no first-party derrubaria o nível 1 da escada inteiro, e o nível 2 (`deepseek-v4-pro`) está no mesmo OpenRouter, com o mesmo pin — a nota em `model.ts:79-80` já registra que os dois primeiros níveis caem juntos num outage. Preferimos degradar o cache a degradar a disponibilidade.

**Por que a extração estruturada pode sair do first-party sem perda.** Os três `generateObject` são one-shot, com prompt distinto a cada chamada: não existe prefixo repetido para cachear. Trocar cache por `structured_outputs` estrito é troca sem custo — e sem a flag, o provider aceitaria o schema e o ignoraria, devolvendo objeto fora do formato para um `catch` que hoje trata isso como "extração vazia".

**Por que a mesma allowlist serve o nível 2 da escada.** O bloco é passado também nas chamadas que caem no `deepseek-v4-pro`, e uma allowlist com nomes que não servem aquele slug produziria 404 em vez de fallback. Medido em 01/08/2026: o pro tem 18 endpoints e **os oito da allowlist estão entre eles** — inclusive o first-party, também com `supports_implicit_caching: true`. Nenhum ajuste necessário. (O pro traz um endpoint que o flash não tem, `baseten`, fp4: já excluído pelo mesmo critério.)

**Custo — o que está medido e o que não está.** Os preços, quantizações, janelas e uptimes acima foram medidos em 01/08/2026 pelo endpoint da API, não estimados. **O hit-rate real deste repo continua sem número.** O `DM_CACHE_SPIKE` ([`ai.service.ts`](../../apps/api/src/ai/ai.service.ts), busque por `DM_CACHE_SPIKE`) mede, mas qualquer leitura anterior a este ADR está contaminada por roteamento aleatório e não serve de baseline. Quem rodar o spike depois do pin registra o número **aqui e na ADR 007 §3**, que hoje também está sem ele.

---

## 4. Alternativas rejeitadas

1. **Não pinar, confiando no sticky routing.** É o estado anterior, e a tentação é achar que o sticky já resolve. Ele resolve a *consistência* e não a *escolha*: o sorteio acontece uma vez por conversa e o resultado fica travado até o fim dela. Não pinar é aceitar 21 chances em 22 de jogar a ADR 007 fora numa sessão inteira, e deixar toda medição de prompt confundida com medição de infraestrutura.
2. **`ignore` com a lista dos ruins.** Mais curta de escrever e envelhece mal na direção perigosa: endpoint fp4 novo entra por default. A allowlist envelhece na direção segura — endpoint bom novo fica de fora até alguém re-medir.
3. **`quantizations: ['fp8']`.** Ver §3: derruba o first-party.
4. **`allow_fallbacks: false`.** Ver §3: troca disponibilidade por pureza, com a escada já concentrada num provedor só.
5. **Bloco de `providerOptions` separado para as extrações.** Duas constantes quase idênticas para manter em sincronia, quando `require_parameters` resolve com uma. Rejeitado pela mesma razão da regra 2 da ADR 007: duplicação a distância dessincroniza.
6. **`cache_control` explícito, para destravar os outros 21.** Já rejeitado na [US-55](../sdlc/01-requisitos/US-55-prompt-caching-do-dm.md) Q3 por redundância; segue rejeitado, agora com número: destravaria endpoints cuja leitura de cache custa 5x a 25x a do first-party. Reabre se o first-party sair do ar de vez.

---

## 5. Consequências

**Positivas**
- A ADR 007 passa a ter efeito verificável. Antes dela valer, era preciso torcer pelo roteamento.
- Bake-off e A/B de prompt medem prompt. `prompt-ab-bakeoff.mjs`, `move-ab.mjs` e `location-ab-bakeoff.mjs` usam o mesmo slug e herdam o pin ao passar `NARRATION_PROVIDER_OPTIONS`.
- Quando a narração piorar, fp4 sai do espaço de causas. Uma hipótese a menos nas investigações tipo US-69 e US-74.

**Negativas / custo aceito**
- **Mais um ponto único de falha**, agora no nível do endpoint, empilhado sobre o do OpenRouter que `model.ts:79-80` já anota. Mitigado só pelo `allow_fallbacks`, que degrada o cache silenciosamente — a degradação é invisível sem o spike ligado.
- **A allowlist envelhece.** Endpoint novo com cache implícito ficaria de fora indefinidamente. Não há guard automático para isso: o teste em [`model-routing.test.ts`](../../packages/ai-engine/src/model-routing.test.ts) protege as invariantes (first-party em primeiro, fp4 fora, `require_parameters` ligado), não a atualidade da lista. Re-medir quando o custo de narração destoar, com o comando registrado no comentário de `model.ts`.
- **Aposta condicionada ao hit-rate.** Se o cache-hit real for baixo, o pin fica mais caro que o Baidu. É a primeira coisa que o spike tem de responder.
- **As extrações estruturadas não cacheiam.** Aceito e sem alternativa: não têm prefixo.
- **`require_parameters` acopla a troca de modelo aos parâmetros que mandamos, e falha DURO.** Todo modelo candidato precisa suportar tudo o que o `streamText` envia — hoje inclui `presencePenalty: 0.3` ([`ai.service.ts`](../../apps/api/src/ai/ai.service.ts), busque por `presencePenalty`), a 1ª linha de defesa da [US-69](../sdlc/01-requisitos/US-69-guard-anti-degeneracao-narracao.md). Exemplo medido em 01/08/2026: `openai/gpt-5.6-luna` não aceita `presence_penalty`, `frequency_penalty`, `temperature` nem `top_p` em nenhum dos seus 6 endpoints — um request nosso casaria com **zero** provedores e erraria, em vez de degradar. Trocar o primário por ele exigiria remover o `presencePenalty` no mesmo commit, o que é uma decisão da US-69, não desta ADR. É o custo de falhar fechado; a alternativa (falhar aberto) é o provider aceitar e ignorar o parâmetro, que foi exatamente o defeito que esta ADR fecha.

---

## 6. Implementação (referência)

- [`packages/ai-engine/src/model.ts`](../../packages/ai-engine/src/model.ts) — `DEEPSEEK_ROUTE_ORDER` e `DEEPSEEK_ALLOWED_PROVIDERS`, consumidos pelo bloco `provider` de `NARRATION_PROVIDER_OPTIONS`. O docblock traz o critério da allowlist e o comando de re-medição:
  `curl -s openrouter.ai/api/v1/models/deepseek/deepseek-v4-flash/endpoints`
- [`packages/ai-engine/src/model-routing.test.ts`](../../packages/ai-engine/src/model-routing.test.ts) — quatro asserções. Existem porque perder o pin é **falha silenciosa**: nenhum erro, nenhum teste vermelho, só custo. É a mesma classe de defeito que a regra 3 da ADR 007 descreve.
- [`apps/api/src/ai/ai.service.ts`](../../apps/api/src/ai/ai.service.ts) — os três `generateObject` que dependem do desvio por `require_parameters`, e o `DM_CACHE_SPIKE` que mede o resultado.
- Para saber qual endpoint serviu um request específico: `GET /api/v1/generation?id=<id>` na API do OpenRouter, ou a aba *Activity* do painel.
- Fontes das afirmações sobre o OpenRouter, ambas em markdown cru (a página renderizada é JS e não dá pra grepar): `openrouter.ai/docs/features/provider-routing.md` (os campos de `provider`: `order`, `only`, `ignore`, `require_parameters`, `quantizations`) e `openrouter.ai/docs/features/prompt-caching.md` (sticky routing, sua chave default e a precedência de `order` sobre ele).

---

## 7. Questões em aberto

1. **Hit-rate real pós-pin.** Rodar `DM_CACHE_SPIKE` e registrar aqui e na ADR 007 §3. Sem esse número, a §3 deste ADR é aritmética sobre premissa. → [US-104](../sdlc/01-requisitos/US-104-baseline-de-cache-do-prompt-pos-pin.md), que também deriva o limiar de hit-rate abaixo do qual o pin deixa de se pagar.
2. **`require_parameters` filtra mesmo por `structured_outputs`?** Deduzido da lista `supported_parameters` de cada endpoint e do exemplo de formatação JSON na doc de provider routing, **não observado em produção**. Confirmar no primeiro `generateObject` pós-deploy, consultando qual endpoint serviu. Se não filtrar, a alternativa 5 volta à mesa. → [US-103](../sdlc/01-requisitos/US-103-proveniencia-do-endpoint-no-turno.md), que constrói o log sem o qual essa observação não existe.
