# US-166 — Motor gera múltiplos encontros (4-5), não só um

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** 🗂️ Backlog
**Depende de:** [US-164](./US-164-orquestrador-motor-monta-aventura-gerada.md) (`generateAdventure` — esta story estende o array de UM elemento pra N; sem ela não há orquestrador pra mudar) · [US-152](./US-152-statblocks-papel-orcamento.md)/[US-160](./US-160-composer-encontro-usa-limiar-de-soma.md)/[US-161](./US-161-jogador-escolhe-nivel-de-desafio-do-encontro.md) (`composeEncounterRoles`/`buildEncounterNpcs`, ✅ implementadas — reusadas como estão, só chamadas mais vezes) · [US-144](./US-144-schema-aventura-shared.md) (`encounters: z.array(...)`, já suporta N sem mudança de schema)
**Relacionado:** [US-150](./US-150-gate-antes-de-persistir-aventura-gerada.md) (gate — verificação 3 já compara "orçamento de **cada** encontro", plural-safe, sem mudança necessária) · [US-163](./US-163-jogador-escolhe-tamanho-da-aventura.md) (dial de tamanho — sinergia com N não decidida, ver *Questões em aberto* #1)
**Criada em:** 2026-08-18 — questão em aberto #3 da US-164 (*"um encontro ou 4-5?"*), respondida "4-5" e destacada como story própria por tocar contrato/custo além do escopo do orquestrador.

---

## História

> **Como** mantenedora,
> **quero** que `generateAdventure` monte 4-5 `AdventureEncounter` em vez de um só,
> **para que** a aventura gerada tenha combate espalhado por múltiplos locais — como o backlog original sempre previu no passo 5 (*"encontros (4-5)"*), não uma única luta isolada.

---

## Contexto e motivação

### O problema observado

[US-164](./US-164-orquestrador-motor-monta-aventura-gerada.md) monta `encounters[]` com **um** elemento — decisão explícita de escopo dela (*Fora do escopo*: *"`composeEncounterRoles` hoje monta UM encontro por chamada. Gerar 4-5 encontros distintos [...] é decisão de produto não resolvida"*). O backlog original ([§Ordem de geração](./backlog-motor-de-geracao-de-aventuras.md), passo 5) sempre foi plural: `encontros (4-5) ← papéis da US-152, orçamento para UM personagem` — nunca implementado como tal.

### Por que a solução atual não basta

Uma aventura com um único encontro contradiz a fonte que o motor implementa (LGMRD *Eight Steps* pressupõe cenas de combate espalhadas pela sessão) e entrega bem menos variedade mecânica/narrativa do que o resto do artefato (`~6` locais, `~7` NPCs, `~11` segredos, mas só 1 combate).

### A proposta

`generateAdventure` chama `composeEncounterRoles(level, challenge)` + `buildEncounterNpcs(roles, existingNpcsCumulativo)` **N vezes** em vez de uma:

- **Papéis:** `composeEncounterRoles` é função pura de `level`/`challenge` (achado da US-160/US-161, sem RNG) — as N chamadas devolvem a MESMA composição de papéis toda vez. Variedade entre encontros vem de `id`/`locationId`/`npcIds`, não de mix de papéis diferente por encontro.
- **NPCs:** `buildEncounterNpcs` numera com `nextId = existingNpcs.length + 1` (monster-roles.ts:78) — cada chamada precisa receber o array cumulativo (NPCs da história + monstros de encontros anteriores), senão colide id.
- **Local:** `locationId` de cada encontro vira `locations[i % locations.length]` — round-robin pelas locations geradas, generalizando a decisão que a US-164 tomou pra UM encontro (`locations[0]` fixo, ver *Questões em aberto* dela, resolvida em 2026-08-18).

---

## Escopo

### Dentro do escopo

- `generateAdventure` (US-164) chama `composeEncounterRoles`/`buildEncounterNpcs` N vezes, `N` na faixa 4-5 do backlog.
- `N` fixo (constante), valor exato decidido na implementação — ver *Questões em aberto* #1 sobre parametrizar por US-163 em vez de constante.
- `locationId` de cada encontro: `locations[i % locations.length]` — round-robin, sem lógica temática (mesma disciplina "barata primeiro" da US-164).
- `npcIds` cumulativo entre chamadas — `existingNpcs` cresce a cada `buildEncounterNpcs`, sem reset por encontro, sem colisão de `id`.
- `id` de cada `AdventureEncounter`: esquema sequencial (`encounter-1`..`encounter-N`).
- Testes de regressão: N encontros gerados, cada um com `locationId` real, `npcIds` sem colisão entre encontros, determinístico (mesmo `characterId`+`order` → mesmos N encontros).

### Fora do escopo

- **Variar composição de papéis por encontro** (ex.: escalada — primeiro mais fraco, último mais forte). `composeEncounterRoles` é pura por design (US-160); variar exigiria parâmetro novo, não pedido aqui. Repetir a mesma composição N vezes é aceitável pra esta story.
- **Amarrar `N` ao dial de tamanho da aventura** ([US-163](./US-163-jogador-escolhe-tamanho-da-aventura.md)). Ver *Questões em aberto* #1 — decisão de produto, não travada aqui.
- **Distribuição temática de `locationId`** (perto da complicação, perto do NPC amarrado a `bonds`). Round-robin é a opção barata; ver *Questões em aberto* #2.
- **Mudar o gate (US-150).** Verificação 3 já compara *"orçamento de **cada** encontro"* (US-150, critério de aceite) — já plural-safe, sem mudança necessária nesta story.
- **Reabrir US-152/US-160/US-161.** Funções usadas como estão, só chamadas mais vezes.

---

## Modelo de dados proposto

Sem schema novo — `GeneratedAdventureSchema.encounters` já é `z.array(AdventureEncounterSchema)` (US-144), suporta N>1 de graça.

---

## Critérios de aceite

- [ ] `generateAdventure` produz N encontros (N na faixa 4-5, valor exato decidido na implementação).
- [ ] Cada encontro tem `locationId` referenciando uma location real, distribuído entre as locations geradas (não todos no mesmo local quando há mais de uma location).
- [ ] `npcIds` entre encontros não colidem — ids sequenciais, sem reset por encontro.
- [ ] Mesmo `characterId`+`order` (mesmo seed) produz os mesmos N encontros — `composeEncounterRoles`/`buildEncounterNpcs` já são puras, sem RNG novo introduzido.
- [ ] `GeneratedAdventureSchema.parse()` continua passando com `encounters.length` = N.
- [ ] `pnpm typecheck` e testes do módulo passam.
- [ ] **Eval / teste de regressão:** fixture com locations/npcs geradas → `generateAdventure` monta N encontros válidos, `.parse()` passa, sem `npcId`/`id` duplicado entre encontros.

---

## Notas de implementação

- **Depende de US-164 já implementada** — o código de `generateAdventure` precisa existir primeiro; esta story só estende o loop de encontros dele.
- `buildEncounterNpcs` assume `existingNpcs` = TODOS os NPCs já mintados até aquele ponto (NPCs da história + monstros de encontros anteriores) — cumulativo, nunca reseta por encontro ([monster-roles.ts:78](../../../apps/api/src/adventure-generation/monster-roles.ts)).
- `composeEncounterRoles`/`buildEncounterNpcs` não tomam seed — determinismo vem de serem funções puras de `level`/`challenge`/`existingNpcs.length`, não de RNG (achado da US-160). Nenhum sub-seed novo necessário, diferente do padrão `tableSeed(characterId, order, 'npc-N')` que `rollPatronsAndNpcs` usa.

---

## Questões em aberto

1. `N` é constante fixa (ex.: sempre 5) ou parametrizada pelo dial de tamanho da aventura ([US-163](./US-163-jogador-escolhe-tamanho-da-aventura.md), curta/padrão)? US-163 hoje só controla locais/NPCs, não encontros — amarrar os três é ampliação de escopo de US-163, não desta story. Não decidido.
2. `locationId` round-robin é aceitável, ou produto quer distribuição temática (perto da complicação, perto do NPC amarrado a `bonds`)? Mesma classe de questão que a US-164 resolveu pra UM encontro (`locations[0]`, opção barata) — aqui só generaliza pra N sem resolver o lado temático. Não decidido.

---

## Referências no código

- [`apps/api/src/adventure-generation/monster-roles.ts`](../../../apps/api/src/adventure-generation/monster-roles.ts) — `composeEncounterRoles`/`buildEncounterNpcs`, chamadas N vezes por esta story.
- [`packages/shared/src/types/adventure-generation.ts`](../../../packages/shared/src/types/adventure-generation.ts) — `AdventureEncounterSchema`/`GeneratedAdventureSchema`, shape inalterado.
- [US-164](./US-164-orquestrador-motor-monta-aventura-gerada.md) — orquestrador que esta story estende; questão em aberto #3 dela é a origem desta story.
- [US-150](./US-150-gate-antes-de-persistir-aventura-gerada.md) — gate, verificação 3 já plural-safe.
- [Backlog — Motor de geração de aventuras one-shot §Ordem de geração](./backlog-motor-de-geracao-de-aventuras.md) — passo 5, `encontros (4-5)`, a intenção original que esta story implementa.
