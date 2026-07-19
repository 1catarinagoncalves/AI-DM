# US-55 — Prompt caching do DM (system prompt estruturado por volatilidade)

**Épico:** 3 — Narração e mecânica
**Fase:** 1 — MVP single-player
**Status:** 🚧 Em progresso
**Depende de:** [US-23](./US-23-dm-ciente-da-ficha.md) (a ficha injetada no prompt) · [US-11b](./US-11b-estado-de-cena-estruturado.md) (o bloco de cena estruturado) · [US-18](#) (histórico servido pela API / memória de sessão) — todos definem o conteúdo que hoje entra no system prompt em ordem ruim para cache
**Alimenta:** [US-56](./US-56-estado-do-turno-na-mensagem.md) (Fase B: move o estado volátil para a última mensagem e libera o cache do histórico — só se a medição desta US justificar) · custo e latência de TODO turno
**Criada em:** 2026-07-19

---

## História

> **Como** operador do AI DM (quem paga a conta do OpenRouter),
> **quero** que o system prompt do mestre seja estruturado para maximizar o **prompt caching** do provider e reduzir tokens redundantes,
> **para que** cada turno cobre uma fração do input a cada chamada (cache hit ~10% do custo normal) em vez de reenviar a parede de regras inteira a preço cheio.

---

## Contexto e motivação

### O problema observado

O `buildDmSystemPrompt` (`packages/ai-engine/src/prompts/dm-system.ts`) monta um único string onde conteúdo **estático** (regras, formatação, craft narrativo) e **volátil** (HP, cena, inventário, quests, resumo) estão **intercalados**, com o **maior bloco estático** — as regras (`## Critical rules`, `## TURN RESOLUTION ORDER`, `## MANDATORY TEXT FORMATTING`, `## NARRATIVE CONSISTENCY`, `## SPATIAL & SCENE CONTINUITY`, `## ABSOLUTE RULE`, `## STARTING EQUIPMENT`, ~150 linhas) — posicionado **depois** dos dados que mudam a cada turno.

Ordem atual do template (`dm-system.ts:235-422`):

```
role + narrative craft        (estático, ~15 linhas)   ← só isto cacheia hoje
## The player's character     (constante por personagem)
${sheetSection}               (VOLÁTIL: HP, conditions)  ← quebra o cache aqui
${backgroundSection}...spells (constante por personagem)
## Main quest / Active quests (volátil)
## Current inventory          (volátil)
${summarySection}             (volátil)
${rulesSection}               (estático)
## Critical rules ...          }
## TURN RESOLUTION ORDER ...   }  parede estática gigante,
## FORMATTING ...              }  ~150 linhas, NUNCA cacheia
## CONSISTENCY ...             }  (volátil veio antes)
${sceneSection}               (VOLÁTIL, encravado no meio da parede)
## SPATIAL ... ## ABSOLUTE ... ## STARTING EQUIPMENT (estático)
```

### Por que a solução atual não basta

Cache de prompt (DeepSeek via OpenRouter — provider atual, `model.ts:76`) é **linear e prefix-only**: casa do token 0 até o **primeiro byte que muda** entre requests. Depois desse ponto, nada mais aproveita cache.

Consequência da ordem atual: o prefixo cacheável termina em `## The player's character`, porque `sheetSection` (HP/conditions, que mudam quase todo turno) vem logo em seguida. **Toda a parede de regras** — o pedaço mais pesado e 100% invariante — cai **depois** do primeiro conteúdo volátil e por isso **nunca é cacheada**. Pior: `sceneSection` (volátil) está **encravado no meio** da parede (`dm-system.ts:377`), então mesmo reordenando só o topo, o cache quebraria ali.

Há ainda redundância pura de tokens: a regra "opções com hífen+emoji, nunca em-dash" está escrita **inteira duas vezes** — `### 4. Choice Options` (`dm-system.ts:328`) e `## ⚠️ ABSOLUTE RULE — Never confuse options with dialogue` (`dm-system.ts:406`), com exemplos WRONG/CORRECT duplicados.

### A proposta

**Estruturar o system prompt em camadas por volatilidade**, do mais estável para o mais volátil, para que o provider cacheie o maior prefixo possível a cada turno:

1. **Estático** (invariante do sistema) — todas as regras, craft, formatação, continuidade. Primeiro.
2. **Constante por personagem/aventura** — nome, gênero, raça, classe, background, features, nomes de magias, atributos e perícias.
3. **Volátil** (muda por turno) — HP + conditions, cena, quests ativas, inventário, resumo de memória. Por último, **ainda dentro do system prompt**.

Com isso, o prefixo cacheável passa a cobrir camadas 1 + 2 (a parede de regras inteira + os dados constantes do personagem) — o grosso do prompt. Só a cauda volátil (camada 3) e as `messages` do histórico ficam não-cacheadas por turno.

De brinde: deduplicar a regra de em-dash e enxugar exemplos verbosos — corta tokens no trecho não-cacheado e no custo de escrita do cache no 1º turno.

**Fase A / Fase B.** Esta US é a **Fase A**: reorganizar dentro do system, com a camada 3 no fim do system. Isso cacheia a parede de regras, mas **não** o histórico (a cauda volátil muda antes das mensagens). Liberar o cache do histórico exige mover a camada 3 para fora do system — isso é a **[US-56](./US-56-estado-do-turno-na-mensagem.md)** (Fase B), condicionada à medição desta US.

---

## Escopo

### Dentro do escopo

- **Reordenar `buildDmSystemPrompt` por volatilidade** (camadas 1 → 2 → 3), com a camada 3 (volátil) agrupada no **fim do system prompt**.
- **Tirar `sceneSection` do meio da parede** de regras e colocá-lo na cauda volátil (camada 3), junto de HP/conditions, quests, inventário e resumo.
- **Quebrar `sheetSection`**: atributos/perícias/level (constantes sem level-up) sobem para a camada 2; HP/conditions descem para a camada 3.
- **Deduplicar a regra em-dash/opções** (`### 4` + `## ABSOLUTE RULE`) numa única seção; enxugar exemplos WRONG/CORRECT redundantes sem perder aderência.
- **Spike de medição de cache**: logar o objeto completo do `onFinish` (`usage`, `providerMetadata`, `response`) num turno para localizar **onde** o provider reporta cached tokens, e registrar tokens cacheados antes/depois da reorganização.
- **Testes**: garantir que a nova estrutura (a) mantém todo o conteúdo semântico (nenhuma regra sumiu), (b) coloca todo estático + constante antes de todo volátil.

### Fora do escopo

- **Mover o estado volátil (camada 3) para a última mensagem** para cachear também o histórico — é a **[US-56](./US-56-estado-do-turno-na-mensagem.md)** (Fase B). Aqui a camada 3 fica no fim do **system**; o histórico segue não-cacheado. Split porque a Fase B muda o enquadramento (estado deixa de ser instrução de sistema e vira conteúdo de mensagem), tem risco de aderência e só se justifica com o dado de cache-hit que esta US vai medir.
- **Trocar de provider ou usar `cache_control` explícito** (breakpoints estilo Anthropic). DeepSeek cacheia por prefixo **automaticamente**, sem parâmetro — esta US só reorganiza conteúdo. `cache_control` só faria sentido com um provider que exija breakpoint; story futura. (ver Questões em aberto)
- **Reduzir o conteúdo das regras a ponto de mudar comportamento do mestre.** O enxugamento é só de redundância literal e verbosidade de exemplo; US-37/US-34 e US-38/US-29 não podem regredir.
- **Cache da janela de histórico após sumarização.** Fora do escopo desta US (o histórico nem cacheia aqui — ver US-56); quando a US-18 funde turnos, o prefixo de mensagens muda de qualquer forma.

---

## Estrutura proposta

**System prompt** (`buildDmSystemPrompt`), reordenado:

```
[Camada 1 — estático puro; cacheável, invariante do sistema]
You are the Dungeon Master...
## Your role
## Narrative craft
## Rules (Free/sistema — constante por aventura)
## Critical rules you must always follow
## TURN RESOLUTION ORDER
## MANDATORY TEXT FORMATTING (com em-dash/opções UMA vez)
## NARRATIVE CONSISTENCY
## SPATIAL & SCENE CONTINUITY
## STARTING EQUIPMENT

[Camada 2 — constante por personagem/aventura; cacheável enquanto não há level-up]
## The player's character (name, gender, race, class)
## Character identity (background, ideais, vínculos, divindade)
## Class features
## Known spells (nomes)
## Attributes & skills (a parte NÃO-volátil da ficha: atributos, perícias, level)

[Camada 3 — volátil; muda por turno; único trecho não-cacheado do system]
## Estado atual (HP + conditions)
## Cena atual (fonte de verdade)
## Main quest / Active quests
## Current inventory
## A história até agora (resumo)
```

A fronteira de cache fica entre a camada 2 e a 3: tudo acima é reaproveitado a cada turno; só a cauda da camada 3 é recomputada.

---

## Critérios de aceite

- [ ] `buildDmSystemPrompt` emite todo o conteúdo **estático** (camada 1) e depois todo o **constante por personagem** (camada 2) **antes** de qualquer campo **volátil** (camada 3: HP, conditions, cena, quests, inventário, resumo). (`dm-system.ts`)
- [ ] Nenhum campo volátil aparece antes da camada 3; em particular `sceneSection` **não** está mais no meio da parede de regras. (`dm-system.ts`)
- [ ] `sheetSection` foi quebrado: atributos/perícias/level na camada 2; HP/conditions na camada 3. (`dm-system.ts`)
- [ ] A regra "opções com `-`+emoji, nunca em-dash" aparece **uma única vez** no prompt (sem a duplicata `### 4` + `## ABSOLUTE RULE`), mantendo um par de exemplo WRONG/CORRECT. (`dm-system.ts`)
- [ ] Nenhuma regra/instrução semântica foi perdida na reorganização: o mesmo conjunto de restrições (rolagens US-29/US-38, gênero, continuidade, craft US-37) continua presente. (teste de conteúdo + eval)
- [ ] **Spike de medição:** existe o registro (log/nota) de onde o provider reporta cached tokens (`usage` vs `providerMetadata` vs raw response) e do número de tokens cacheados observado a partir do 2º turno de uma mesma aventura. (`ai.service.ts:382`)
- [ ] **Eval / regressão (qualidade):** a suíte de narração (US-36/US-34) não regride com o prompt reordenado — o mestre continua respeitando formatação de opções, gênero e as regras de rolagem. (`pnpm eval`)
- [ ] **Teste (estrutura):** um teste unitário verifica que, dado um personagem+estado, o índice do último marcador estático/constante é **menor** que o índice do primeiro marcador volátil (ex.: `HP:`, `Cena atual`) na saída de `buildDmSystemPrompt`. (`dm-system.test.ts`)

---

## Notas de implementação

- **Cache é automático no DeepSeek/OpenRouter** — não há parâmetro a passar no `streamText` (`ai.service.ts:367`); o ganho vem 100% da ORDEM do conteúdo.
- **Onde o cache é reportado (Q1):** confirmar por spike, mas o esperado é que o `@ai-sdk/openai-compatible@0.2.16` (pin da memória `ai-sdk-v4-provider-pin`) **não** normalize cached tokens no `usage` (que só traz `promptTokens`/`completionTokens`); o número tende a vir em `providerMetadata` ou no corpo bruto do OpenRouter (`prompt_tokens_details.cached_tokens` + `cache_discount`). Logar o objeto inteiro do `onFinish` uma vez resolve — barato, remove a incerteza antes de qualquer conclusão de custo.
- **Rebuild obrigatório do `ai-engine`**: `buildDmSystemPrompt` vive em `packages/ai-engine`; a API roda o `dist`. Rodar `pnpm --filter @ai-dm/ai-engine build` após editar `src` (memória `ai-engine-dist-rebuild`).
- **Quebra do `sheetSection`** (`dm-system.ts:136-141`): separar `attributes`/`skills`/`level` (camada 2) de `hp`/`maxHp`/`conditions` (camada 3). Level muda em level-up (raro) — aceitável na camada 2 (quebra cache só no turno do level-up).
- **Camada 3 no fim do system, não na mensagem:** manter os cabeçalhos de fonte-de-verdade que já existem (sheet, cena) — só muda a posição. Não mexer em `ai.service.ts:98` (montagem de `messages`) nesta US; isso é a US-56.
- **`buildOpeningInstruction`** (`dm-system.ts:431`): herda o system reordenado; contrato inalterado.
- **Dedup em-dash**: consolidar `### 4. Choice Options` e `## ABSOLUTE RULE` numa seção só dentro de `## MANDATORY TEXT FORMATTING`. Manter o par WRONG/CORRECT mais claro.
- **Medir antes/depois**: registrar tokens de prompt (total e cacheados) num turno idêntico antes e depois, para provar o ganho — não só assumir. É o insumo que decide se a US-56 vale a pena.

---

## Questões em aberto

1. **(Q1) Campo exato do cache no SDK/provider** — o spike de medição confirma se cached tokens vêm em `usage`, `providerMetadata` ou raw response do OpenRouter com o pin `@ai-sdk/openai-compatible@0.2.16`. Resolvido dentro desta US pelo próprio spike; não bloqueia a reordenação.
2. **(Q3) `cache_control` explícito como hedge?** — Decisão: **não** nesta US. DeepSeek/OpenRouter cacheia por prefixo automático; breakpoint explícito é redundante e nem sempre suportado pela via openai-compatible. Só entra se um dia o provider primário mudar para um que exija (ex.: Anthropic direto) — story futura, fora do escopo.

> *(Q2 — mover o estado volátil para a mensagem — foi resolvida abrindo a [US-56](./US-56-estado-do-turno-na-mensagem.md) como Fase B condicionada à medição desta US.)*

---

## Referências no código

- `packages/ai-engine/src/prompts/dm-system.ts` — `buildDmSystemPrompt` (`:104-423`): reordenar por volatilidade; tirar `sceneSection` (`:202-210`, injetado em `:377`) da parede; quebrar `sheetSection` (`:136-141`); deduplicar em-dash (`:328` + `:406`).
- `apps/api/src/ai/ai.service.ts` — `systemPrompt` (`:131-149`) alimenta o builder; `onFinish` (`:382`) é onde o spike lê o `usage`/`providerMetadata`. **Sem** mudança na montagem de `messages` (`:98`) — isso é a US-56.
- `packages/ai-engine/src/model.ts` — provider primário DeepSeek via OpenRouter (`:76`); `NARRATION_PROVIDER_OPTIONS` (`:106-112`): sem mudança nesta US.
- `docs/adr/002-memoria-de-sessao.md` — janela verbatim + resumo (US-18) define o que é volátil.

### Relação com US-23 / US-11b / US-18 / US-56

US-23 (ficha) e US-11b (cena) injetam o estado que hoje polui o prefixo; US-18 define a janela de histórico. US-55 (Fase A) reordena **dentro** do system para cachear a parede de regras. US-56 (Fase B) leva o estado volátil para a mensagem, liberando também o cache do histórico — só se a medição da US-55 mostrar que vale.
