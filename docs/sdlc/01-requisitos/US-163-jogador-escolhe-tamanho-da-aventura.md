# US-163 — Jogador escolhe o tamanho da aventura (locais e NPCs)

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** 🗂️ Backlog
**Depende de:** [US-158](./US-158-locais-npcs-prosa-motor.md) (`generateLocationsAndNpcs`/`NPC_ROLL_COUNT`, ✅ implementada — os dois pontos que esta story parametriza)
**Relacionado:** [US-162](./US-162-jogador-escolhe-quantidade-de-segredos.md) (dial irmão de densidade de segredos; questão em aberto ali: os dois dials são um só ou independentes) · [US-161](./US-161-jogador-escolhe-nivel-de-desafio-do-encontro.md) (onde a preferência mora, resolvido igual — por aventura gerada) · [US-144](./US-144-schema-aventura-shared.md) (`AdventureLocationSchema`/`AdventureNpcSchema`, shape inalterado) · [US-156](./US-156-catalogos-registro-dto-validacao.md)/[US-157](./US-157-tela-de-mundo-depois-da-revisao.md) (precedente de campo escolhido pelo jogador com fallback default)
**Criada em:** 2026-08-17

---

## História

> **Como** jogador,
> **quero** escolher se a aventura gerada é mais curta (menos locais e NPCs pra conhecer) ou mais longa,
> **para que** eu ajuste o tamanho da sessão ao tempo que tenho, em vez de toda aventura vir sempre com a mesma contagem fixa de elenco e cenário.

---

## Contexto e motivação

### O problema observado

Dois pontos do motor hoje fixam contagem sem expor parâmetro:

- **NPCs:** `NPC_ROLL_COUNT = 7` ([roll-content.ts:20](../../../apps/api/src/adventure-generation/roll-content.ts)) — constante de módulo que decide quantas vezes `rollPatronsAndNpcs` rola a tabela `patronsandnpcs` ([roll-content.ts:36-41](../../../apps/api/src/adventure-generation/roll-content.ts)). `generateLocationsAndNpcs` gera **exatamente** um NPC por linha rolada — `npcs.length === rolled.patronsandnpcs.length` sempre ([ai.service.ts:1277](../../../apps/api/src/ai/ai.service.ts)) —, e o próprio prompt instrui isso explicitamente: *"gere exatamente {rolled.patronsandnpcs.length}"* ([ai.service.ts:133](../../../apps/api/src/ai/ai.service.ts)). O número de NPCs da aventura é, hoje, literalmente `NPC_ROLL_COUNT`.
- **Locais:** **não há** constante equivalente. `locais`/`monumentos` vêm de **uma única linha** rolada da tabela `locationsmonumentsanditems` ([roll-content.ts:53](../../../apps/api/src/adventure-generation/roll-content.ts), `RolledAdventureContent.locais`/`.monumentos`, ambos `string`) — o "~6 locais" que a doc-fonte da US-158 menciona é o modelo elaborando livremente essa única linha em `generateLocationsAndNpcs`, sem nenhuma instrução de quantidade-alvo no prompt (`buildLocationsAndNpcsPrompt`, [ai.service.ts:124-135](../../../apps/api/src/ai/ai.service.ts), não tem linha equivalente à dos NPCs).

### Por que a solução atual não basta

`NPC_ROLL_COUNT` é uma constante de módulo, não um parâmetro — mudar quantidade de NPC exige editar código. Contagem de locais é pior: não existe controle algum, nem hardcoded — depende inteiramente de quanto o modelo decide elaborar a partir de uma linha só, o que já é uma lacuna de previsibilidade independente desta story (o "~6" da US-158 é estimativa, não garantia).

### A proposta

Duas mudanças de forma diferente, porque partem de pontos diferentes do código:

1. **NPCs:** `NPC_ROLL_COUNT` vira função de uma preferência de tamanho (`adventureSize` ou nome equivalente) em vez de constante — mesmo padrão de US-161/US-162 (reaproveitar um número já hardcoded, não inventar mecânica).
2. **Locais:** como não existe hoje instrução de quantidade-alvo, esta story **adiciona** uma — nova linha em `buildLocationsAndNpcsPrompt`, espelhando a que já existe pros NPCs (*"gere exatamente N locais"* ou *"aproximadamente N"*, a decidir), com `N` vindo da mesma preferência de tamanho. É a única peça desta story que não é só parametrizar algo já existente — é a peça que fecha a lacuna de previsibilidade que a US-158 deixou aberta, aproveitando o mesmo trabalho.

---

## Escopo

### Dentro do escopo

- `NPC_ROLL_COUNT` deixa de ser constante fixa — vira valor resolvido a partir de uma preferência de tamanho, passada a `rollPatronsAndNpcs`/`rollContent`.
- Nível default/omitido reproduz o valor de hoje (7) — nenhum chamador existente muda de comportamento.
- `buildLocationsAndNpcsPrompt` ganha instrução explícita de quantidade-alvo de locais, na mesma preferência de tamanho — hoje ausente, ponto novo desta story (não parametrização de constante existente).
- Pelo menos 2 níveis (ex.: curta/padrão — nomes exatos a decidir na implementação).
- Testes de regressão: cada nível produz o `NPC_ROLL_COUNT` esperado e a instrução de locais correspondente no prompt montado.

### Fora do escopo

- **Onde a preferência mora** — decidido: por aventura gerada, mesma decisão da [US-161](./US-161-jogador-escolhe-nivel-de-desafio-do-encontro.md)/[US-162](./US-162-jogador-escolhe-quantidade-de-segredos.md) (ver *Questões em aberto* #2). Não persiste em `Character`.
- **Tela/DTO/i18n** — segue fora: depende primeiro da Questão em aberto #1 (mesmo dial que a US-162, ou independente) pra saber se é um campo ou dois. Story própria quando resolvido; precedente de forma: US-156/US-157.
- **Garantir que o modelo respeita a instrução de quantidade de locais** — mesma disciplina de "melhor esforço" que a US-158 já assume pra `occupants`/integridade referencial (gate formal é US-150); esta story só adiciona a instrução, não valida a contagem de saída em código de produção.
- **Se este dial é o mesmo da US-162 (densidade de segredos) ou independente** — ver *Questões em aberto*, cruzado nas duas stories.
- **Reduzir/aumentar `SECRET_CATEGORY_COUNT`** junto com o tamanho — é a US-162; esta story não toca em `ai.service.ts:163-168`.

---

## Modelo de dados proposto

Sem schema novo — `AdventureLocationSchema`/`AdventureNpcSchema` ([US-144](./US-144-schema-aventura-shared.md)) não mudam de forma, só a quantidade de itens gerados. A preferência de tamanho em si (tipo, onde vive) fica em aberto — ver *Fora do escopo*.

---

## Critérios de aceite

- [ ] `NPC_ROLL_COUNT` (ou equivalente) deixa de ser `const` de módulo fixa — passa a depender de um parâmetro de tamanho recebido por `rollContent`.
- [ ] Nível default/omitido reproduz o valor de hoje (7 NPCs) — nenhum teste existente da US-158 quebra.
- [ ] `buildLocationsAndNpcsPrompt` inclui instrução de quantidade-alvo de locais, variável pela mesma preferência de tamanho — verificável no prompt montado (mesmo padrão de teste que a US-149/US-158 já usam pra instrução de âncora).
- [ ] Nível "curto" produz `NPC_ROLL_COUNT` menor que o default, sem chegar a 0.
- [ ] `pnpm typecheck` e testes do módulo passam.
- [ ] **Eval / teste de regressão:** um caso por nível de tamanho, verificando `rolled.patronsandnpcs.length` e a instrução de locais no prompt montado — mesmo padrão de teste unitário com `generateObject` mockado que a US-158 já usa (conteúdo real de saída do modelo fica fora do alcance, como lá).

---

## Notas de implementação

- **Dois arquivos, não um:** [`apps/api/src/adventure-generation/roll-content.ts`](../../../apps/api/src/adventure-generation/roll-content.ts) (`NPC_ROLL_COUNT`, linha 20) e [`apps/api/src/ai/ai.service.ts`](../../../apps/api/src/ai/ai.service.ts) (`buildLocationsAndNpcsPrompt`, linha 124, e a assinatura de `generateLocationsAndNpcs`, linha 1252).
- **A peça de locais não é parametrização — é uma lacuna nova a fechar.** Diferente do padrão dos dials irmãos (US-161/US-162, que só trocam qual constante já existente um parâmetro escolhe), a contagem de locais não tem hoje controle algum, nem hardcoded. Vale registrar essa assimetria explicitamente na implementação, pra quem revisar não esperar um "só trocar o número" tão simples quanto o lado dos NPCs.
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
- [`apps/api/src/adventure-generation/roll-content.ts:53`](../../../apps/api/src/adventure-generation/roll-content.ts) — roll de `locationsmonumentsanditems`, única linha que hoje origina `locais`/`monumentos` (sem contagem própria).
- [`apps/api/src/ai/ai.service.ts:124-135`](../../../apps/api/src/ai/ai.service.ts) — `buildLocationsAndNpcsPrompt`; linha 133 tem o precedente de instrução de quantidade-alvo (hoje só pra NPCs) que esta story espelha pra locais.
- [`apps/api/src/ai/ai.service.ts:1252`](../../../apps/api/src/ai/ai.service.ts) — `generateLocationsAndNpcs`, assinatura que ganha o parâmetro de tamanho.
- [US-158](./US-158-locais-npcs-prosa-motor.md) — story original de locais/NPCs, cujas contagens esta story parametriza (NPCs) e formaliza (locais).
- [US-161](./US-161-jogador-escolhe-nivel-de-desafio-do-encontro.md)/[US-162](./US-162-jogador-escolhe-quantidade-de-segredos.md) — dials irmãos, mesmo padrão de reaproveitar constante já existente como opção.
