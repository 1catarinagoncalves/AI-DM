# US-162 — Jogador escolhe a quantidade de segredos ativos

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** 🗂️ Backlog
**Depende de:** [US-149](./US-149-segredos-40-prompts-lgmrd.md) (`generateSecrets`, ✅ implementada — `SECRET_CATEGORY_COUNT` é o orçamento que esta story parametriza)
**Relacionado:** [US-161](./US-161-jogador-escolhe-nivel-de-desafio-do-encontro.md) (dial irmão: onde a preferência mora, resolvido igual — por aventura gerada; se precisa de tela segue em aberto aqui) · [US-163](./US-163-jogador-escolhe-tamanho-da-aventura.md) (dial de tamanho de locais/NPCs; pergunta em aberto aqui: os dois dials são um só ou independentes) · [US-144](./US-144-schema-aventura-shared.md) (`AdventureSecretSchema`, shape inalterado) · [US-156](./US-156-catalogos-registro-dto-validacao.md)/[US-157](./US-157-tela-de-mundo-depois-da-revisao.md) (precedente de campo escolhido pelo jogador com fallback default)
**Criada em:** 2026-08-17

---

## História

> **Como** jogador,
> **quero** escolher se a aventura vem com poucos fios narrativos ou vários,
> **para que** eu ajuste a densidade de investigação ao tempo que tenho pra jogar, em vez de toda aventura gerada vir sempre com o mesmo número fixo de segredos.

---

## Contexto e motivação

### O problema observado

`generateSecrets` ([ai.service.ts:1308](../../../apps/api/src/ai/ai.service.ts)) escreve os segredos a partir de `SECRET_CATEGORY_COUNT` ([ai.service.ts:163-168](../../../apps/api/src/ai/ai.service.ts)) — um `Record<keyof SecretPrompts, number>` **hardcoded** no código, não lido de config nem de preferência: `{ charactersecrets: 3, historicalsecrets: 3, npcandvillainsecrets: 3, plotandstorysecrets: 2 }`, sempre 11 no total, sempre o mesmo split entre as 4 categorias do LGMRD. `buildSecretsPrompt` ([ai.service.ts:170](../../../apps/api/src/ai/ai.service.ts)) usa esse record pra montar a instrução de quantidade por categoria — todo jogador recebe a mesma densidade de segredo, não importa quanto tempo tem pra jogar ou quanto quebra-cabeça quer resolver.

### Por que a solução atual não basta

Não existe hoje nenhum parâmetro entre o chamador de `generateSecrets` e `SECRET_CATEGORY_COUNT` — é uma constante de módulo, não um argumento da função. Mudar a densidade da aventura exige editar código, não é escolha disponível em tempo de geração.

### A proposta

Parametrizar `SECRET_CATEGORY_COUNT`: em vez de constante de módulo, vira função (ou lookup) de uma preferência de densidade escolhida pelo jogador, com 2–3 níveis pré-definidos (ex.: enxuta/padrão/densa — nomes exatos a decidir na implementação). Mesma disciplina da [US-161](./US-161-jogador-escolhe-nivel-de-desafio-do-encontro.md): nenhuma tabela do LGMRD muda, nenhum novo prompt-molde é inventado — só o **quanto** de cada categoria já existente é pedido. Teto por categoria continua em 10 (cada uma das 4 seções do LGMRD só tem 10 prompts-molde — [US-149 Notas de implementação](./US-149-segredos-40-prompts-lgmrd.md)), então o nível mais denso não pode pedir mais que isso sem repetir molde.

---

## Escopo

### Dentro do escopo

- `SECRET_CATEGORY_COUNT` deixa de ser constante fixa — vira valor resolvido a partir de uma preferência (`secretDensity` ou nome equivalente) passada a `generateSecrets`/`buildSecretsPrompt`.
- Pelo menos 2 níveis: o valor hoje implementado (3+3+3+2 = 11) vira o nível **padrão/default** — nenhum chamador existente muda de comportamento se a preferência for omitida.
- Um nível "enxuto" com total menor (proporção entre categorias a definir na implementação, mesma lógica de peso da US-149: `plotandstorysecrets` continua a categoria com fallback de âncora mais forte — `hookSeed` sempre presente — então é a que pode cair mais sem esvaziar a aventura).
- Teto por categoria em qualquer nível: nunca ultrapassa 10 (tamanho da seção-fonte no LGMRD).
- Testes de regressão: cada nível de densidade produz o total esperado, sem categoria acima de 10, sem quebrar o critério de âncora (bonds/`locationId`/NPC/`hookSeed`) que a US-149 já garante por categoria.

### Fora do escopo

- **Tela/DTO/i18n pra capturar a escolha** — decidido *onde* a preferência mora (por aventura gerada, ver *Questões em aberto* #2), mas a tela em si segue fora: depende primeiro da Questão em aberto #1 (mesmo dial que a US-163, ou independente) pra saber se é um campo ou dois. Story própria quando resolvido; precedente de forma: US-156/US-157.
- **Mudar o texto dos 40 prompts-molde ou a distribuição por categoria em si (quais categorias existem)** — isso é [US-149](./US-149-segredos-40-prompts-lgmrd.md)/texto-fonte do LGMRD, intocado aqui; esta story só varia o **número por categoria já definida**.
- **Refletir a densidade em `locations`/`npcs`** (mais segredos "densos" pedindo mais locais/NPCs pra ancorar) — é a pergunta em aberto #1 abaixo, resolve se cruza com a [US-163](./US-163-jogador-escolhe-tamanho-da-aventura.md).

---

## Modelo de dados proposto

Sem schema novo — `AdventureSecretSchema` ([US-144](./US-144-schema-aventura-shared.md)) não muda de forma, só a quantidade de itens que `generateSecrets` produz. A preferência de densidade em si (tipo, onde vive) fica em aberto — ver *Fora do escopo*.

---

## Critérios de aceite

- [ ] `SECRET_CATEGORY_COUNT` (ou equivalente) deixa de ser `const` de módulo fixa — passa a depender de um parâmetro de densidade recebido por `generateSecrets`.
- [ ] Nível default/omitido reproduz o total e o split de hoje (3+3+3+2 = 11) — nenhum teste existente da US-149 quebra.
- [ ] Nível "enxuto" produz total menor que 11, sem nenhuma categoria em 0 quando a categoria tem pelo menos 1 âncora disponível (locais/NPCs/bonds/hookSeed).
- [ ] Nenhum nível pede mais de 10 por categoria, em nenhum caso.
- [ ] `pnpm typecheck` e testes do módulo passam.
- [ ] **Eval / teste de regressão:** um caso por nível de densidade, verificando total e teto de 10 por categoria; reusa a fixture de personagem com `bonds` preenchido que a US-149 já tem, pra confirmar que a âncora de conteúdo sobrevive em todo nível.

---

## Notas de implementação

- **Arquivo principal:** [`apps/api/src/ai/ai.service.ts`](../../../apps/api/src/ai/ai.service.ts) — `SECRET_CATEGORY_COUNT` (linha 163), `buildSecretsPrompt` (linha 170) e a assinatura de `generateSecrets` (linha 1308) são os três pontos que mudam.
- **`SECRET_CATEGORY_COUNT` já é `Record<keyof SecretPrompts, number>`** — trocar por uma função `secretCategoryCount(density): Record<keyof SecretPrompts, number>` com 2–3 valores hardcoded (mesmo padrão de constante hardcoded do resto do módulo, não config externa) é a mudança mínima; não precisa reabrir `SecretPrompts`/`readSecretPrompts` ([US-149 §Referências](./US-149-segredos-40-prompts-lgmrd.md)).
- Precedente de dial binário/discreto reaproveitando código já existente: [US-161](./US-161-jogador-escolhe-nivel-de-desafio-do-encontro.md) faz o mesmo com `encounterDeadlyThreshold`/`singleMonsterCrCap`.

---

## Questões em aberto

1. Este dial e o de tamanho de locais/NPCs ([US-163](./US-163-jogador-escolhe-tamanho-da-aventura.md)) são a **mesma** preferência do jogador (uma única escolha "tamanho da aventura" que move os dois) ou dois controles independentes (jogador pode querer poucos segredos mas muitos NPCs)? Não decidido — as duas stories ficam implementáveis de forma independente até essa decisão de produto vir.
2. ~~Mesma pergunta da US-161 #1: preferência por personagem ou por aventura gerada?~~ **Resolvido: por aventura gerada**, mesma decisão da US-161 — não persiste em `Character`.
3. Nomes dos níveis de densidade — resolver na implementação, mesmo padrão de chave canônica EN do repo ([US-54](./US-54-chaves-canonicas-em-ingles.md)).

---

## Referências no código

- [`apps/api/src/ai/ai.service.ts:163-168`](../../../apps/api/src/ai/ai.service.ts) — `SECRET_CATEGORY_COUNT`, a constante que esta story parametriza.
- [`apps/api/src/ai/ai.service.ts:170`](../../../apps/api/src/ai/ai.service.ts) — `buildSecretsPrompt`, consome o record acima.
- [`apps/api/src/ai/ai.service.ts:1308`](../../../apps/api/src/ai/ai.service.ts) — `generateSecrets`, assinatura que ganha o parâmetro de densidade.
- [US-149](./US-149-segredos-40-prompts-lgmrd.md) — story original dos segredos, cujo orçamento fixo esta story parametriza; também a fonte do teto de 10 por categoria (40 prompts ÷ 4 categorias).
- [US-161](./US-161-jogador-escolhe-nivel-de-desafio-do-encontro.md) — dial irmão (desafio de combate), mesmo padrão de reaproveitar constante já existente como opção.
- [US-163](./US-163-jogador-escolhe-tamanho-da-aventura.md) — dial de tamanho de locais/NPCs; questão em aberto #1 acima cruza as duas.
