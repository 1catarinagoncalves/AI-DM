# US-171 — Encontros de combate entram no ledger e chegam ao Mestre

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** nenhuma
**Relacionado:** [US-151](./US-151-semear-ledger-segredos-gerados.md) (dona de `seedLedgerFromGeneratedAdventure`, ✅ — terceira story a estender a mesma função, depois da US-170) · [US-170](./US-170-locais-gerados-entram-no-ledger.md) (mesmo gap de origem, mesmo padrão de correção — locais em vez de combatentes) · [US-152](./US-152-statblocks-papel-orcamento.md)/[US-160](./US-160-composer-encontro-usa-limiar-de-soma.md)/[US-161](./US-161-jogador-escolhe-nivel-de-desafio-do-encontro.md) (composer que gera os papéis Minion/Soldier/Brute — trabalho hoje descartado) · [US-166](./US-166-motor-gera-multiplos-encontros.md) (Backlog — motor passa de 1 pra N encontros; esta story deve funcionar pra N sem mudança, já que itera `adventure.encounters` genericamente)
**Criada em:** 2026-08-18 — achado ao mapear campo a campo o que de `GeneratedAdventure` chega ao Mestre: `npcs[]` de combate (role ∈ `Minion`/`Soldier`/`Brute`) são FILTRADOS pra fora do ledger (`seedLedgerFromGeneratedAdventure`), e `encounters[]` só é lido pelo gate de validação (US-150) — o Mestre nunca sabe que uma ameaça foi orçada e montada num local, mesmo já tendo `rollDice`/`updateCharacterHp` disponíveis pra narrar um confronto hoje, sem esperar por um sistema de combate por turno.

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

---

## Escopo

### Dentro do escopo

- `seedLedgerFromGeneratedAdventure` (`seed-ledger.ts`) ganha `encounterNpcEntities` — itera `adventure.encounters`, resolve `locationId` → título (reusa `locationTitleById`, já existe na função) e `npcIds` → os NPCs correspondentes em `adventure.npcs`.
- Um `WorldEntity` por combatente: `tipo: 'npc'`, `local` = título do local do encontro, `nota` = o papel (`role`, ex. `"Soldier"`), `revelado: false`.
- `nome` precisa ser ÚNICO por combatente (papéis se repetem — ex. 3 `Soldier` no mesmo encontro) — critério de aceite exige distinção (ex. incluir o `id` do NPC), não dita o formato exato.
- Funciona para 1 encontro (estado atual) e para N (US-166, quando implementada) sem mudança — a iteração é sobre `adventure.encounters`, não um índice fixo.
- Teste de regressão em `seed-ledger.test.ts`: encontro com N combatentes gera N `WorldEntity` de `tipo: 'npc'`, `revelado: false`, `local` batendo com o local do encontro.
- Eval/teste de regressão: cenário onde o personagem entra no local de um encontro gerado — narração do Mestre reflete tensão/ameaça compatível com os combatentes ali (sem revelar estatísticas, mesma regra `⚠ OCULTO` que já existe).

### Fora do escopo

- Qualquer sistema de combate por turno / iniciativa — fora do roadmap da Fase 1 (MVP single-player); esta story só faz a AMEAÇA existir no ledger, a resolução continua freeform com `rollDice`/`updateCharacterHp` como qualquer outra cena.
- Tool novo pra "matar"/remover um combatente do ledger quando o confronto acaba — `recordEntity` já permite atualizar `estado` (ex. `"derrotado"`) do mesmo jeito que qualquer outra entidade; nenhum tool novo necessário.
- Mudar `composeEncounterRoles`/`buildEncounterNpcs`/o motor que gera os papéis (US-152/160/161) — o orçamento já está correto, só não circula.
- US-166 (motor gerar múltiplos encontros) — story separada, Backlog; esta aqui só garante compatibilidade (iteração genérica), não implementa o "múltiplos".
- Estatística/statblock completo do combatente (dano, AC, etc.) chegando ao Mestre — o motor só gera `role`/CR (US-152), não um statblock; fora de alcance desta story porque a fonte não existe.

---

## Critérios de aceite

- [ ] `seedLedgerFromGeneratedAdventure` emite um `WorldEntity` de `tipo: 'npc'` por combatente de CADA encontro em `adventure.encounters`.
- [ ] `nome` de cada entrada é único mesmo quando o `role` se repete no mesmo encontro.
- [ ] `local` do combatente bate com o título do local do encontro (`encounter.locationId` → `locations[].title`).
- [ ] `revelado: false` em toda entrada de combatente semeada.
- [ ] Funciona sem alteração para `encounters` com 1 ou N elementos.
- [ ] Teste de regressão em `seed-ledger.test.ts` cobre a nova entrada.
- [ ] **Eval:** narração do Mestre ao entrar no local de um encontro reflete a presença de uma ameaça (tensão, sinais), sem vazar estatística/CR.
- [ ] `pnpm eval` passa (mudança no ledger muda o que o Mestre vê no prompt todo turno).

---

## Notas de implementação

- Sugestão de `nome` único: `` `${npc.role} (${npc.id})` `` — mesmo espírito de `nome: secret.id` que `seedLedgerFromGeneratedAdventure` já usa quando não há nome próprio natural ([seed-ledger.ts:18](../../../apps/api/src/adventure-generation/seed-ledger.ts)); decisão de implementação, não critério de aceite fechado.
- `locationTitleById` já existe na função ([seed-ledger.ts:15](../../../apps/api/src/adventure-generation/seed-ledger.ts)) — reusar, não recriar.
- Filtro atual (`!(npc.role in MONSTER_ROLE_CR)`) em `npcEntities` CONTINUA como está — esta story não muda quem entra em `npcEntities`, só ADICIONA `encounterNpcEntities` como array irmão no retorno.
- Sem mudança em `ai.service.ts`/`dm-system.ts` — ledger já é lido e renderizado por turno; esta story só alimenta a fonte (mesmo argumento da US-170).
- Mudança indireta em prompt do DM Agent (mais entidades no ledger todo turno) — rodar `pnpm eval` depois (AGENTS.md).

---

## Questões em aberto

1. Quando o confronto termina (o jogador derrota/foge/negocia), quem chama `recordEntity` pra marcar `estado: "derrotado"` nos combatentes — o próprio Mestre por julgamento narrativo (mesmo padrão de qualquer outra entidade), ou vale uma instrução explícita no prompt de ofício lembrando disso? Sem isso, um combatente "morto" narrativamente continua `revelado: false`/sem estado atualizado no ledger pra sempre — não quebra nada (é só ledger, não afeta o resultado da cena), mas suja o registro.
2. `nota` só com `role` (`"Soldier"`) é suficiente pro Mestre dar tensão, ou vale incluir o CR/força relativa (ex. "ameaça leve" vs "ameaça grave", derivado de `MONSTER_ROLE_CR`)? Mais informação ajuda a calibrar a narração, mas também é mais um dado a manter sincronizado se a tabela de CR mudar.

---

## Referências no código

- [apps/api/src/adventure-generation/monster-roles.ts:48-85](../../../apps/api/src/adventure-generation/monster-roles.ts) — `composeEncounterRoles`/`buildEncounterNpcs`, origem dos combatentes descartados.
- [apps/api/src/adventure-generation/seed-ledger.ts:13-39](../../../apps/api/src/adventure-generation/seed-ledger.ts) — `seedLedgerFromGeneratedAdventure`, função a estender (junto da US-170).
- [packages/shared/src/types/adventure-generation.ts:37-41](../../../packages/shared/src/types/adventure-generation.ts) — `AdventureEncounterSchema`, formato de `encounters[]`.
- [apps/api/src/adventure/adventure.service.ts:156-160](../../../apps/api/src/adventure/adventure.service.ts) — onde `encounters`/combatentes nascem dentro de `generateAdventure`.
- [apps/api/src/adventure-generation/adventure-gate.ts](../../../apps/api/src/adventure-generation/adventure-gate.ts) — único consumidor atual de `encounters[]` (validação, não narração).
- [apps/api/src/ai/ai.service.ts:555-597](../../../apps/api/src/ai/ai.service.ts) — `rollDice`, tool já disponível pra resolver o confronto freeform.
- [docs/sdlc/01-requisitos/US-170-locais-gerados-entram-no-ledger.md](./US-170-locais-gerados-entram-no-ledger.md) — mesmo padrão de correção, gap irmão.
