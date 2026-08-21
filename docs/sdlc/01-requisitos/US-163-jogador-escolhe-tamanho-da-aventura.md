# US-163 — Jogador escolhe o tamanho da aventura (NPCs de história)

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** 🗂️ Backlog
**Depende de:** [US-158](./US-158-locais-npcs-prosa-motor.md) (`generateLocationsAndNpcs`/`NPC_ROLL_COUNT`, ✅ implementada — o ponto que esta story parametriza)
**Relacionado:** [US-162](./US-162-jogador-escolhe-quantidade-de-segredos.md) (dial irmão de densidade de segredos; questão em aberto ali: os dois dials são um só ou independentes) · [US-161](./US-161-jogador-escolhe-nivel-de-desafio-do-encontro.md) (onde a preferência mora, resolvido igual — por aventura gerada) · [US-144](./US-144-schema-aventura-shared.md) (`AdventureNpcSchema`, shape inalterado) · [US-156](./US-156-catalogos-registro-dto-validacao.md)/[US-157](./US-157-tela-de-mundo-depois-da-revisao.md) (precedente de campo escolhido pelo jogador com fallback default) · [US-166](./US-166-motor-gera-multiplos-encontros.md) (dona do piso de LOCAIS desde 2026-08-20 — ver nota abaixo)
**Criada em:** 2026-08-17
**Atualizada em:** 2026-08-20 — o eixo de LOCAIS saiu desta story e entrou na [US-166](./US-166-motor-gera-multiplos-encontros.md). Motivo: aquela story fixou 8 encontros com round-robin sobre `locations` — o piso de locais que cobre isso sem repetição (8) é requisito estrutural dos encontros, não preferência de tamanho que o jogador possa escolher menor. Esta story fica só com o dial de NPCs de história, que não tem relação com contagem de encontros.

---

## História

> **Como** jogador,
> **quero** escolher se a aventura gerada tem mais ou menos NPCs de história pra conhecer,
> **para que** eu ajuste o elenco ao tempo que tenho, sem depender de código pra mudar um número hardcoded.

---

## Contexto e motivação

### O problema observado

`NPC_ROLL_COUNT = 7` ([roll-content.ts:20](../../../apps/api/src/adventure-generation/roll-content.ts)) — constante de módulo que decide quantas vezes `rollPatronsAndNpcs` rola a tabela `patronsandnpcs` ([roll-content.ts:36-41](../../../apps/api/src/adventure-generation/roll-content.ts)). `generateLocationsAndNpcs` gera **exatamente** um NPC por linha rolada — `npcs.length === rolled.patronsandnpcs.length` sempre ([ai.service.ts:1277](../../../apps/api/src/ai/ai.service.ts)) —, e o próprio prompt instrui isso explicitamente: *"gere exatamente {rolled.patronsandnpcs.length}"* ([ai.service.ts:133](../../../apps/api/src/ai/ai.service.ts)). O número de NPCs da aventura é, hoje, literalmente `NPC_ROLL_COUNT`.

> **Nota (2026-08-20):** este documento tinha originalmente um segundo problema aqui — contagem de locais sem controle algum. Esse eixo saiu desta story e virou piso fixo (8, não preferência) na [US-166](./US-166-motor-gera-multiplos-encontros.md), que precisa dele pra cobrir os 8 encontros sem repetição de local. Ver *Atualizada em* no topo do documento.

### Por que a solução atual não basta

`NPC_ROLL_COUNT` é uma constante de módulo, não um parâmetro — mudar quantidade de NPC exige editar código.

### A proposta

`NPC_ROLL_COUNT` vira função de uma preferência de tamanho (`adventureSize` ou nome equivalente) em vez de constante — mesmo padrão de US-161/US-162 (reaproveitar um número já hardcoded, não inventar mecânica).

---

## Escopo

### Dentro do escopo

- `NPC_ROLL_COUNT` deixa de ser constante fixa — vira valor resolvido a partir de uma preferência de tamanho, passada a `rollPatronsAndNpcs`/`rollContent`.
- Nível default/omitido reproduz o valor de hoje (7) — nenhum chamador existente muda de comportamento.
- Pelo menos 2 níveis (ex.: curta/padrão — nomes exatos a decidir na implementação).
- Testes de regressão: cada nível produz o `NPC_ROLL_COUNT` esperado.

### Fora do escopo

- **Contagem de locais.** Saiu desta story em 2026-08-20 — vira piso fixo (8) na [US-166](./US-166-motor-gera-multiplos-encontros.md), sem relação com esta preferência de tamanho.
- **Onde a preferência mora** — decidido: por aventura gerada, mesma decisão da [US-161](./US-161-jogador-escolhe-nivel-de-desafio-do-encontro.md)/[US-162](./US-162-jogador-escolhe-quantidade-de-segredos.md) (ver *Questões em aberto* #2). Não persiste em `Character`.
- **Tela/DTO/i18n** — segue fora: depende primeiro da Questão em aberto #1 (mesmo dial que a US-162, ou independente) pra saber se é um campo ou dois. Story própria quando resolvido; precedente de forma: US-156/US-157.
- **Se este dial é o mesmo da US-162 (densidade de segredos) ou independente** — ver *Questões em aberto*, cruzado nas duas stories.
- **Reduzir/aumentar `SECRET_CATEGORY_COUNT`** junto com o tamanho — é a US-162; esta story não toca em `ai.service.ts:163-168`.

---

## Modelo de dados proposto

Sem schema novo — `AdventureNpcSchema` ([US-144](./US-144-schema-aventura-shared.md)) não muda de forma, só a quantidade de itens gerados. A preferência de tamanho em si (tipo, onde vive) fica em aberto — ver *Fora do escopo*.

---

## Critérios de aceite

- [ ] `NPC_ROLL_COUNT` (ou equivalente) deixa de ser `const` de módulo fixa — passa a depender de um parâmetro de tamanho recebido por `rollContent`.
- [ ] Nível default/omitido reproduz o valor de hoje (7 NPCs) — nenhum teste existente da US-158 quebra.
- [ ] Nível "curto" produz `NPC_ROLL_COUNT` menor que o default, sem chegar a 0.
- [ ] `pnpm typecheck` e testes do módulo passam.
- [ ] **Eval / teste de regressão:** um caso por nível de tamanho, verificando `rolled.patronsandnpcs.length` — mesmo padrão de teste unitário com `generateObject` mockado que a US-158 já usa (conteúdo real de saída do modelo fica fora do alcance, como lá).

---

## Notas de implementação

- Arquivos a mudar: [`apps/api/src/adventure-generation/roll-content.ts`](../../../apps/api/src/adventure-generation/roll-content.ts) (`NPC_ROLL_COUNT`, linha 20) e a assinatura de `generateLocationsAndNpcs` ([ai.service.ts:1252](../../../apps/api/src/ai/ai.service.ts)), que passa o parâmetro adiante.
- **`buildLocationsAndNpcsPrompt` NÃO é tocado por esta story** — a instrução de quantidade-alvo de locais que viveria ali é agora piso fixo (8) da [US-166](./US-166-motor-gera-multiplos-encontros.md), não preferência de tamanho. Se as duas stories forem implementadas fora de ordem, cuidado com conflito de merge no mesmo trecho do arquivo — não é dependência técnica, é só proximidade de código.
- **`NPC_ROLL_COUNT` maior não quebra o determinismo do seed (US-146)** — `rollPatronsAndNpcs` já usa `tableSeed(characterId, order, 'npc-N')` por índice dentro de um `Array.from({ length: N })`; aumentar `N` só estende a mesma sequência de sub-seeds, não muda os já existentes.
- Precedente de dial binário/discreto reaproveitando código já existente: [US-161](./US-161-jogador-escolhe-nivel-de-desafio-do-encontro.md) (`encounterDeadlyThreshold`/`singleMonsterCrCap`) e [US-162](./US-162-jogador-escolhe-quantidade-de-segredos.md) (`SECRET_CATEGORY_COUNT`).

---

## Questões em aberto

1. Este dial e o de densidade de segredos ([US-162](./US-162-jogador-escolhe-quantidade-de-segredos.md)) são a **mesma** preferência (um "tamanho da aventura" único que move as duas) ou independentes? Não decidido — mesma questão em aberto, espelhada nas duas stories.
2. ~~Mesma pergunta da US-161 #1: preferência por personagem ou por aventura gerada?~~ **Resolvido: por aventura gerada**, mesma decisão da US-161 — não persiste em `Character`.
3. Nomes dos níveis de tamanho — resolver na implementação, mesmo padrão de chave canônica EN do repo ([US-54](./US-54-chaves-canonicas-em-ingles.md)).
4. Nível mais curto ainda garante ao menos 1 NPC amarrado a `background.bonds` (critério de aceite da US-158)? Com `NPC_ROLL_COUNT` pequeno o suficiente, a chance do modelo ter "espaço" pra cumprir essa amarração cai — não resolvido aqui, mas o piso mínimo de `NPC_ROLL_COUNT` escolhido na implementação precisa considerar isso.

---

## Referências no código

- [`apps/api/src/adventure-generation/roll-content.ts:20`](../../../apps/api/src/adventure-generation/roll-content.ts) — `NPC_ROLL_COUNT`, a constante que esta story parametriza.
- [`apps/api/src/adventure-generation/roll-content.ts:36-41`](../../../apps/api/src/adventure-generation/roll-content.ts) — `rollPatronsAndNpcs`, consome `NPC_ROLL_COUNT`.
- [`apps/api/src/ai/ai.service.ts:1252`](../../../apps/api/src/ai/ai.service.ts) — `generateLocationsAndNpcs`, assinatura que ganha o parâmetro de tamanho.
- [US-158](./US-158-locais-npcs-prosa-motor.md) — story original de locais/NPCs, cuja contagem de NPCs esta story parametriza.
- [US-161](./US-161-jogador-escolhe-nivel-de-desafio-do-encontro.md)/[US-162](./US-162-jogador-escolhe-quantidade-de-segredos.md) — dials irmãos, mesmo padrão de reaproveitar constante já existente como opção.
- [US-166](./US-166-motor-gera-multiplos-encontros.md) — dona do piso de locais desde 2026-08-20 (eixo que saiu desta story).
