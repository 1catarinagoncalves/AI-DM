# US-171 — Encontros de combate entram no ledger e chegam ao Mestre

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** ✅ Concluída
**Depende de:** nenhuma
**Relacionado:** [US-151](./US-151-semear-ledger-segredos-gerados.md) (dona de `seedLedgerFromGeneratedAdventure`, ✅ — terceira story a estender a mesma função, depois da US-170) · [US-170](./US-170-locais-gerados-entram-no-ledger.md) (mesmo gap de origem, mesmo padrão de correção — locais em vez de combatentes) · [US-152](./US-152-statblocks-papel-orcamento.md)/[US-160](./US-160-composer-encontro-usa-limiar-de-soma.md)/[US-161](./US-161-jogador-escolhe-nivel-de-desafio-do-encontro.md) (composer que gera os papéis Minion/Soldier/Brute — trabalho hoje descartado) · [US-166](./US-166-motor-gera-multiplos-encontros.md) (Backlog — motor passa de 1 pra N encontros; esta story deve funcionar pra N sem mudança, já que itera `adventure.encounters` genericamente)
**Criada em:** 2026-08-18 — achado ao mapear campo a campo o que de `GeneratedAdventure` chega ao Mestre: `npcs[]` de combate (role ∈ `Minion`/`Soldier`/`Brute`) são FILTRADOS pra fora do ledger (`seedLedgerFromGeneratedAdventure`), e `encounters[]` só é lido pelo gate de validação (US-150) — o Mestre nunca sabe que uma ameaça foi orçada e montada num local, mesmo já tendo `rollDice`/`updateCharacterHp` disponíveis pra narrar um confronto hoje, sem esperar por um sistema de combate por turno.
**Atualizada em:** 2026-08-20 — escopo expandido: seedear o combatente no ledger sem NUNCA o tirar de lá criava risco de "ressurreição" (combatente derrotado narrativamente continua listado como ameaça ativa pra sempre, Mestre pode reintroduzi-lo). Story ganhou uma segunda metade: `reconcileScene` passa a reconciliar o ledger junto do `sceneState`.

---

## História

> **Como** jogador explorando uma aventura gerada,
> **quero** que o Mestre saiba que existe uma ameaça armada num local (mesmo sem um sistema de combate formal),
> **para que** ele possa dar tensão/pistas na narração e resolver o confronto com os tools que já existem, em vez de o encontro orçado pelo motor simplesmente nunca acontecer.

---

## Contexto e motivação

### O que existe hoje

- `composeEncounterRoles`/`buildEncounterNpcs` ([monster-roles.ts:48-85](../../../apps/api/src/adventure-generation/monster-roles.ts)) orçam um encontro por nível (CR de `Minion`/`Soldier`/`Brute`, US-152/159/160/161) e viram instâncias em `GeneratedAdventure.npcs[]` (ex.: `{ id: 'npc-6', name: 'Minion', role: 'Minion', interactions: [] }`).
- `encounters: AdventureEncounter[]` ([adventure-generation.ts:37-41](../../../packages/shared/src/types/adventure-generation.ts)) liga `locationId` aos `npcIds` desses combatentes — hoje sempre 1 elemento (`encounter-1`, [adventure.service.ts:158-160](../../../apps/api/src/adventure/adventure.service.ts)), passa a N quando a US-166 (Backlog) for feita.
- `seedLedgerFromGeneratedAdventure` ([seed-ledger.ts:27-28](../../../apps/api/src/adventure-generation/seed-ledger.ts)) filtra esses NPCs FORA do ledger: `.filter((npc) => !(npc.role in MONSTER_ROLE_CR))`. Motivo original (US-151): "NPC de combate... é um combatente genérico que morre no próprio encontro" — correto pra não POLUIR o ledger permanente com algo descartável, mas o efeito colateral é que o Mestre não sabe da existência do encontro NUNCA, nem antes de ele acontecer.
- `encounters[]` só é lido em `adventure-gate.ts` (fecha grafo/orçamento, US-150) — confirmado por grep, nenhum outro consumidor em `apps/api/src`.
- O Mestre já tem `rollDice` (teste d20 genérico com modificador da ficha, [ai.service.ts:555-597](../../../apps/api/src/ai/ai.service.ts)) e `updateCharacterHp` — dá pra narrar e resolver um confronto de forma freeform HOJE, sem esperar um sistema de combate por turno (fora do roadmap da Fase 1).

### O problema

Todo o trabalho do composer de encontro (orçamento de CR, papéis balanceados por nível) é gerado, validado pelo gate (US-150) e então descartado. O jogador pode entrar no local onde o motor armou uma emboscada e o Mestre nunca vai mencionar nada, porque nenhuma informação sobre a ameaça sobreviveu até o prompt do turno.

### A proposta

`seedLedgerFromGeneratedAdventure` ganha um mapeamento novo: itera `adventure.encounters`, resolve os NPCs de combate de cada um (via `npcIds` → `adventure.npcs`) e emite um `WorldEntity` por combatente (`tipo: 'npc'`, `revelado: false` — ameaça ainda não descoberta, mesma disciplina `⚠ OCULTO` já usada por segredos/locais). O Mestre passa a VER no ledger que existe uma ameaça armada num local, pode dar pistas/tensão antes do confronto, e resolver a cena com os tools que já tem — sem sistema de combate novo.

Segunda metade (resolve o risco de "ressurreição", ver Atualizada em): `reconcileScene` ([ai.service.ts:1593](../../../apps/api/src/ai/ai.service.ts)) já roda em background todo turno em que o modelo não chamou `updateScene`, recalculando `sceneState.presentes` (quem está na cena) a partir da narração — é a rede de segurança da US-73 pra `sceneState` não apodrecer. Ele passa a fazer o mesmo pelo ledger: compara `presentes` ANTES/DEPOIS da reconciliação e, pra todo `WorldEntity` de combatente (`nota` ∈ papel de `MONSTER_ROLE_CR`) que SAIU de `presentes` nesta passagem, aplica um patch determinístico de `estado` (`"fora de cena"` — não afirma derrota, fuga nem negociação, só que não está mais na cena). Sem LLM novo (reusa a extração que já roda), sem gate, sem depender do Mestre lembrar de nada — o combatente só some da lista de "ameaça ativa" quando o próprio sistema de reconciliação de cena, que já é a fonte de verdade de quem está presente, registra que ele saiu.

---

## Escopo

### Dentro do escopo

- `seedLedgerFromGeneratedAdventure` (`seed-ledger.ts`) ganha `encounterNpcEntities` — itera `adventure.encounters`, resolve `locationId` → título (reusa `locationTitleById`, já existe na função) e `npcIds` → os NPCs correspondentes em `adventure.npcs`.
- Um `WorldEntity` por combatente: `tipo: 'npc'`, `local` = título do local do encontro, `nota` = o papel (`role`, ex. `"Soldier"`), `revelado: false`.
- `nome` precisa ser ÚNICO por combatente (papéis se repetem — ex. 3 `Soldier` no mesmo encontro) — critério de aceite exige distinção (ex. incluir o `id` do NPC), não dita o formato exato.
- Funciona para 1 encontro (estado atual) e para N (US-166, quando implementada) sem mudança — a iteração é sobre `adventure.encounters`, não um índice fixo.
- Teste de regressão em `seed-ledger.test.ts`: encontro com N combatentes gera N `WorldEntity` de `tipo: 'npc'`, `revelado: false`, `local` batendo com o local do encontro.
- Eval/teste de regressão: cenário onde o personagem entra no local de um encontro gerado — narração do Mestre reflete tensão/ameaça compatível com os combatentes ali (sem revelar estatísticas, mesma regra `⚠ OCULTO` que já existe).
- `reconcileScene` ([ai.service.ts:1593](../../../apps/api/src/ai/ai.service.ts)) carrega `adventure.entities` além de `characterState.sceneState`, diffa `presentes` (antes vs depois da reconciliação) e, pra `WorldEntity` com `nota` ∈ `Object.keys(MONSTER_ROLE_CR)` que saiu de `presentes` nesta passagem, aplica `estado: 'fora de cena'` via `mergeEntities` (mesmo helper de `recordEntity`, [entities.ts:54](../../../packages/ai-engine/src/entities.ts)) e persiste em `adventure.update({ data: { entities } })`.
- O patch é só na TRANSIÇÃO (presente→ausente nesta passagem) — um combatente que já saiu em turno anterior não é tocado de novo, então um `estado` mais específico que o Mestre tenha registrado depois (`recordEntity` manual) não é sobrescrito.
- Combatente nunca engajado (nunca entrou em `presentes`) fica intocado — continua `revelado: false`, sem `estado`, como hoje.

### Fora do escopo

- Qualquer sistema de combate por turno / iniciativa — fora do roadmap da Fase 1 (MVP single-player); esta story só faz a AMEAÇA existir no ledger e sair da lista de "ativa" quando sai de cena, a resolução do confronto em si continua freeform com `rollDice`/`updateCharacterHp` como qualquer outra cena.
- Tool novo pra "matar"/remover um combatente do ledger — não precisa: a reconciliação automática (acima) já tira o combatente da leitura de "ameaça ativa" sem tool novo e sem depender do Mestre lembrar.
- Determinar a CAUSA da saída (derrota/fuga/negociação) — `estado: 'fora de cena'` é neutro de propósito; o sistema não tem HP/statblock (ver item abaixo) pra saber o desfecho. Se o Mestre quiser registrar o desfecho específico, `recordEntity` manual continua disponível e não é sobrescrito (ver critério acima).
- Mudar `composeEncounterRoles`/`buildEncounterNpcs`/o motor que gera os papéis (US-152/160/161) — o orçamento já está correto, só não circula.
- US-166 (motor gerar múltiplos encontros) — story separada, Backlog; esta aqui só garante compatibilidade (iteração genérica), não implementa o "múltiplos".
- Estatística/statblock completo do combatente (dano, AC, etc.) chegando ao Mestre — o motor só gera `role`/CR (US-152), não um statblock; fora de alcance desta story porque a fonte não existe.

---

## Critérios de aceite

- [x] `seedLedgerFromGeneratedAdventure` emite um `WorldEntity` de `tipo: 'npc'` por combatente de CADA encontro em `adventure.encounters`.
- [x] `nome` de cada entrada é único mesmo quando o `role` se repete no mesmo encontro.
- [x] `local` do combatente bate com o título do local do encontro (`encounter.locationId` → `locations[].title`).
- [x] `revelado: false` em toda entrada de combatente semeada.
- [x] Funciona sem alteração para `encounters` com 1 ou N elementos.
- [x] Teste de regressão em `seed-ledger.test.ts` cobre a nova entrada.
- [x] **Eval:** narração do Mestre ao entrar no local de um encontro reflete a presença de uma ameaça (tensão, sinais), sem vazar estatística/CR. Caso estático `evals/cases/us-171-eval-combatente-no-ledger.ts`, mesmo padrão sem chamada de modelo do caso US-170 (harness de N turnos reais fica com a US-94, em backlog).
- [x] `pnpm eval` passa (mudança no ledger muda o que o Mestre vê no prompt todo turno).
- [x] `reconcileScene` aplica `estado: 'fora de cena'` a um combatente de encontro que estava em `presentes` no `sceneState` anterior e não está mais no reconciliado.
- [x] `reconcileScene` NÃO toca em `WorldEntity` que nunca esteve em `presentes` (ameaça ainda não engajada).
- [x] `reconcileScene` NÃO toca em `WorldEntity` que já saiu de `presentes` em turno anterior (transição já processada) — não sobrescreve `estado` manual mais específico.
- [x] `reconcileScene` NÃO toca em NPC que não é combatente de encontro (`nota` fora de `MONSTER_ROLE_CR`).
- [x] Teste de regressão cobrindo os 4 critérios acima (unit em `ai.service.test.ts`, mockando `prisma.adventure` como as demais tools).

---

## Notas de implementação

- Sugestão de `nome` único: `` `${npc.role} (${npc.id})` `` — mesmo espírito de `nome: secret.id` que `seedLedgerFromGeneratedAdventure` já usa quando não há nome próprio natural ([seed-ledger.ts:18](../../../apps/api/src/adventure-generation/seed-ledger.ts)); decisão de implementação, não critério de aceite fechado.
- `locationTitleById` já existe na função ([seed-ledger.ts:15](../../../apps/api/src/adventure-generation/seed-ledger.ts)) — reusar, não recriar.
- Filtro atual (`!(npc.role in MONSTER_ROLE_CR)`) em `npcEntities` CONTINUA como está — esta story não muda quem entra em `npcEntities`, só ADICIONA `encounterNpcEntities` como array irmão no retorno.
- Sem mudança em `dm-system.ts` — ledger já é lido e renderizado por turno; a mudança de fonte é suficiente (mesmo argumento da US-170). `ai.service.ts` MUDA (ao contrário do que a versão anterior desta US dizia): `reconcileScene` ganha o passo de reconciliação do ledger descrito no Escopo.
- `reconcileScene` já recebe `adventureId` como parâmetro ([ai.service.ts:1593](../../../apps/api/src/ai/ai.service.ts)) — só falta o `select: { entities: true }` no mesmo `findUnique`/um segundo, e o `mergeEntities`+`adventure.update` já usados por `recordEntity` ([ai.service.ts:860-870](../../../apps/api/src/ai/ai.service.ts)), mesmo padrão, sem helper novo.
- Identificação de "é combatente de encontro": `entity.nota` bate com uma chave de `MONSTER_ROLE_CR` (`monster-roles.ts`) — mesmo teste que `seedLedgerFromGeneratedAdventure` já usa pro filtro inverso; nenhum campo novo no schema de `WorldEntity`.
- Mudança indireta em prompt do DM Agent (mais entidades no ledger todo turno, e agora algumas saem de "ativa" sozinhas) — rodar `pnpm eval` depois (AGENTS.md).

---

## Questões em aberto

1. ~~Quando o confronto termina, quem chama `recordEntity` pra marcar o combatente como resolvido?~~ **Resolvido (2026-08-20): ninguém precisa chamar nada — `reconcileScene` reconcilia sozinho.** Não depende do Mestre lembrar (era o risco: combatente derrotado narrativamente ficava listado como ameaça ativa pra sempre, podendo "ressuscitar" num turno futuro). A reconciliação usa `sceneState.presentes`, que já é a fonte de verdade de quem está em cena (US-73) — quando o combatente sai de `presentes`, o ledger acompanha automaticamente (`estado: 'fora de cena'`), sem gate novo, sem LLM novo, sem tool novo. Ver Escopo/Critérios de aceite. Não cobre a CAUSA da saída (derrota vs fuga vs negociação) — isso continua exigindo statblock/HP, que é o sistema de combate por turno do Backlog ([combate-por-turno-roadmap]); mas a causa é detalhe narrativo, não o bug que motivou a questão.
2. ~~`nota` só com `role` (`"Soldier"`) é suficiente pro Mestre dar tensão, ou vale incluir o CR/força relativa?~~ **Resolvido (2026-08-20): sim, só `role` basta.** Não deriva "ameaça leve"/"ameaça grave" de `MONSTER_ROLE_CR` — mais um dado a manter sincronizado se a tabela mudar, sem necessidade comprovada (Minion/Soldier/Brute já comunica escala pro Mestre calibrar tensão). Reabrir só se o eval mostrar narração sem tensão suficiente com o `role` sozinho.

---

## Referências no código

- [apps/api/src/adventure-generation/monster-roles.ts:48-85](../../../apps/api/src/adventure-generation/monster-roles.ts) — `composeEncounterRoles`/`buildEncounterNpcs`, origem dos combatentes descartados.
- [apps/api/src/adventure-generation/seed-ledger.ts:13-39](../../../apps/api/src/adventure-generation/seed-ledger.ts) — `seedLedgerFromGeneratedAdventure`, função a estender (junto da US-170).
- [packages/shared/src/types/adventure-generation.ts:37-41](../../../packages/shared/src/types/adventure-generation.ts) — `AdventureEncounterSchema`, formato de `encounters[]`.
- [apps/api/src/adventure/adventure.service.ts:156-160](../../../apps/api/src/adventure/adventure.service.ts) — onde `encounters`/combatentes nascem dentro de `generateAdventure`.
- [apps/api/src/adventure-generation/adventure-gate.ts](../../../apps/api/src/adventure-generation/adventure-gate.ts) — único consumidor atual de `encounters[]` (validação, não narração).
- [apps/api/src/ai/ai.service.ts:555-597](../../../apps/api/src/ai/ai.service.ts) — `rollDice`, tool já disponível pra resolver o confronto freeform.
- [apps/api/src/ai/ai.service.ts:1593](../../../apps/api/src/ai/ai.service.ts) — `reconcileScene`, ganha o passo de reconciliação do ledger (US-73, rede de segurança do `sceneState`).
- [apps/api/src/ai/ai.service.ts:860-870](../../../apps/api/src/ai/ai.service.ts) — `recordEntity`, padrão de `mergeEntities` + `adventure.update` a reusar dentro de `reconcileScene`.
- [packages/ai-engine/src/entities.ts:54](../../../packages/ai-engine/src/entities.ts) — `mergeEntities`, merge parcial por `nome` já usado por `recordEntity`.
- [docs/sdlc/01-requisitos/US-170-locais-gerados-entram-no-ledger.md](./US-170-locais-gerados-entram-no-ledger.md) — mesmo padrão de correção, gap irmão.
