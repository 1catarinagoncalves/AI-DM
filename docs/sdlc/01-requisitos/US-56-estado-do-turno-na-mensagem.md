# US-56 — Estado do turno na mensagem (Fase B: cachear também o histórico)

**Épico:** 3 — Narração e mecânica
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** [US-55](./US-55-prompt-caching-do-dm.md) (Fase A: system reordenado por volatilidade e medição de cache-hit; esta US só se justifica se aquele número indicar ganho real ao cachear o histórico) · [US-18](./US-18-historico-servido-pela-api.md) (janela de histórico verbatim) · [US-11b](./US-11b-estado-de-cena-estruturado.md) (estado de cena) · [US-23](./US-23-dm-ciente-da-ficha.md) (ficha)
**Criada em:** 2026-07-19

---

## História

> **Como** operador do AI DM (quem paga a conta do OpenRouter),
> **quero** que o estado volátil do turno (HP/conditions, cena, quests, inventário, resumo) seja injetado na **última mensagem** do jogador em vez de no fim do system prompt,
> **para que** o system e o histórico da conversa formem um prefixo estável e também sejam cacheados — não só a parede de regras.

---

## Contexto e motivação

### O problema observado

A [US-55](./US-55-prompt-caching-do-dm.md) (Fase A) reordena o system prompt por volatilidade e passa a cachear a parede de regras + os dados constantes do personagem (camadas 1 e 2). Mas a **camada 3** (estado volátil) continua no **fim do system prompt**.

Como cache é prefix-only e linear sobre `system + messages`, uma cauda volátil no fim do system muda a cada turno — e tudo que vem **depois** dela deixa de cachear. O `history` verbatim (`ai.service.ts:88-98`), que só cresce (append-only) e seria um prefixo idealmente estável, **nunca é cacheado** enquanto a camada 3 estiver entre ele e o topo.

Em aventuras longas o histórico verbatim (até `KEEP_RECENT` turnos, `ai.service.ts:41`) é uma fatia grande do input a cada turno — reenviada a preço cheio.

### Por que a solução atual não basta

A US-55 (Fase A) já entrega o maior pedaço do ganho (a parede de regras), mas por construção **não** cacheia o histórico: a camada 3 fica no system, antes das mensagens. Tirar a camada 3 do system é a única forma de o histórico virar prefixo estável.

### A proposta

**Mover a camada 3 (estado volátil) para o início da última mensagem do jogador**, junto da ação:

```
[Estado atual do turno — fonte de verdade]
- HP: 12/20
- Conditions: ...
## Cena atual ...
## Main quest / Active quests ...
## Current inventory ...
## A história até agora (resumo) ...

<ação do jogador>
```

Assim `system` (camadas 1+2, invariante por aventura) + todo o `history` (append-only) viram um prefixo estável e cacheável; só a última mensagem (estado + ação) é recomputada por turno.

---

## Escopo

### Dentro do escopo

- **Remover a camada 3 do system prompt**: `buildDmSystemPrompt` passa a emitir só camadas 1 e 2 (estático + constante por personagem). O estado volátil deixa de sair por ali.
- **Montar o bloco de estado do turno em `ai.service.ts`** e prefixá-lo à `message` do jogador antes de compor `messages` (`ai.service.ts:98`). O bloco carrega os cabeçalhos de fonte-de-verdade (HP/conditions, cena, quests, inventário, resumo).
- **Persistência limpa do histórico**: o `onFinish` (`ai.service.ts:427-434`) grava só a **ação crua** (`message`) e a narração — **nunca** o bloco de estado prefixado. Senão o histórico e o resumo (US-18) incham e poluem, e o próprio prefixo do histórico deixa de ser estável.
- **Reaproveitar o mesmo builder/format do estado** já usado pela US-55 (a serialização de sheet/cena/quests/inventário/resumo), só mudando o destino (mensagem em vez de system).
- **Eval de aderência**: confirmar que ler o estado como conteúdo de mensagem (não como instrução de sistema) não regride a obediência às regras (rolagens, gênero, continuidade, formatação).
- **Medição pós-mudança**: comparar cache-hit e tokens faturados por turno com o baseline da Fase A (US-55), provando o ganho do histórico cacheado.

### Fora do escopo

- **A reordenação e o dedup do system** — já entregues na US-55.
- **Comportamento após sumarização**: quando a US-18 funde turnos antigos, o prefixo do histórico muda e o cache quebra naquele ponto — aceitável (ocorre ~1x a cada `SUMMARIZE_THRESHOLD` turnos, `ai.service.ts:40`); não é objetivo desta US mitigar.
- **`cache_control` explícito / troca de provider** — fora, como na US-55.

---

## Critérios de aceite

- [ ] `buildDmSystemPrompt` **não** emite mais nenhum campo volátil (HP, conditions, cena, quests, inventário, resumo); só camadas 1 e 2. (`dm-system.ts` + `dm-system.test.ts`)
- [ ] `ai.service.ts` monta um bloco de estado do turno e o **prefixa à mensagem** do jogador; o bloco declara-se como fonte de verdade do turno. (`ai.service.ts`)
- [ ] O `onFinish` persiste apenas a ação crua (`message`) e a narração — o bloco de estado prefixado **não** entra no `EventLog` (ACTION) nem no histórico/resumo. (`ai.service.ts:427-434` + teste)
- [ ] O `history` reconstruído (`ai.service.ts:88-98`) é idêntico turno a turno para os mesmos turnos passados (prefixo estável / append-only). (teste)
- [ ] **Medição:** o cache-hit reportado pelo provider cobre agora também os tokens do histórico (comparação com o baseline da US-55). Registrar o número. (`ai.service.ts:382`)
- [ ] **Eval / regressão (aderência):** com o estado na mensagem, o mestre continua respeitando rolagens (US-29/US-38), gênero, continuidade espacial (US-11b) e formatação de opções — sem regressão vs. Fase A. (`pnpm eval`)

---

## Notas de implementação

- **Gate de decisão:** só implementar se a medição da US-55 mostrar que o histórico é fatia relevante do input e que o provider cacheia mensagens de forma estável. Se o ganho for marginal, arquivar esta US.
- **Cabeçalho forte de fonte-de-verdade:** ao migrar o estado do system para a mensagem, o enquadramento muda (o modelo lê como fala do usuário). Manter/dobrar a linguagem de "precedência sobre inferência" que sheet e cena já usam (`dm-system.ts:137,205`), para não perder força de instrução. É o principal risco desta US — validar no eval.
- **Fronteira de persistência:** o ponto delicado é o `onFinish` gravar a ação **sem** o prefixo de estado. Guardar a `message` crua original separada do conteúdo enviado ao modelo (não derivar uma da outra depois de concatenar).
- **Abertura (`buildOpeningInstruction`, `ai.service.ts:465-482`):** na abertura não há estado volátil relevante (sem HP dinâmico, cena ou histórico) — segue como está.
- **Rebuild do `ai-engine`** após editar `dm-system.ts` (memória `ai-engine-dist-rebuild`).

---

## Questões em aberto

1. **[RESOLVIDA — sim, com ressalva de roteamento] O provider (DeepSeek via OpenRouter) cacheia de forma estável tokens de mensagem (não só do system)?** O cache do DeepSeek é prefix caching automático sobre a sequência **inteira** de tokens — não há fronteira por role, então o `history` (user/assistant) cacheia igual à parede de regras do system. A premissa da US está correta. **Porém "estável" não depende do role, e sim do roteamento:** o cache do DeepSeek é por-endpoint/upstream, e o OpenRouter pode servir `deepseek/*` por múltiplos upstreams — uma requisição roteada para outro backend dá cache miss mesmo com prefixo idêntico. **Ação antes de concluir ganho:** pinar o provider routing na chamada (`provider.order` + `allow_fallbacks:false` no corpo do OpenRouter, via `NARRATION_PROVIDER_OPTIONS`) ou confirmar que já é single-upstream; só então a medição do `DM_CACHE_SPIKE` (`ai.service.ts:393`) mede cache real e não ruído de roteamento. Sem o pin, o cache-hit oscila turno a turno sem relação com o prefixo.
2. **[RESOLVIDA — descartada como otimização de cache; rebaixada a plano B de framing] Vale um caminho intermediário — estado volátil numa mensagem `system` adicional posicionada após o histórico?** Não como ganho de cache: o cache quebra no **primeiro byte volátil, seja qual for o role**. Nos dois desenhos a ordem é `system(1+2) + history + [ESTADO] + user(ação)`; o `[ESTADO]` sendo `role:system` ou dentro do `role:user` produz **exatamente o mesmo prefixo cacheável** (system base + history). Zero ganho de cache. O único eixo que a Q2 toca é obediência (enquadramento de "instrução de sistema"), e ela carrega custo: system message no meio do array é fora da convenção OpenAI-compatible (system no topo) — o pin `@ai-sdk/openai-compatible@0.2.16` tolera, mas um bump de SDK/provider pode reordenar ou fundir em `user`; e como a ação tem de ser a última mensagem, vira **dois** system messages com um interior (o padrão mais frágil). **Decisão:** implementar só a proposta principal (estado no `user`) + cabeçalho forte de fonte-de-verdade (`dm-system.ts:137,205`). Guardar a variante system-message como **plano B**, acionado **apenas se** o eval de aderência (critério de aceite 6) regredir — como mitigação de obediência, nunca de custo. Q2 não entra no caminho crítico.

> **Nota transversal:** ambas as questões só fecham **depois** do número da Fase A (`DM_CACHE_SPIKE`). O gate de decisão (Notas de implementação) e a Q1 são a mesma medição. Sequência: (1) pinar provider, (2) ler baseline da US-55, (3) só então implementar a Fase B.

---

## Referências no código

- `packages/ai-engine/src/prompts/dm-system.ts` — remover a camada 3 do `buildDmSystemPrompt`; expor (ou reusar) o formatter do bloco de estado para o `ai.service.ts`.
- `apps/api/src/ai/ai.service.ts` — montagem de `messages` (`:98`): prefixar o bloco de estado à `message`; `onFinish` (`:427-434`): persistir só a ação crua; `history` (`:88-96`): agora cacheável; `usage`/`providerMetadata` no `onFinish` (`:382`) para a medição.
- `docs/adr/002-memoria-de-sessao.md` — janela verbatim + resumo (US-18): o histórico que esta US torna cacheável.

### Relação com US-55

US-55 (Fase A) cacheia a parede de regras reordenando **dentro** do system. US-56 (Fase B) tira o estado volátil do system e o coloca na mensagem, tornando **o histórico** também cacheável. B depende do dado de A: só vale se o histórico for input pesado o suficiente.
