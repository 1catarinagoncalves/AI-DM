# US-188 — Antagonista vira NPC rastreável, encontro final referencia por `id`

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Bloqueio de release (2026-08-22):** NÃO fazer merge/deploy desta story sem [US-189](./US-189-antagonista-entra-no-ledger.md) no MESMO release. `seed-ledger.ts` (✅ já implementado, roda em toda geração) filtra `npcEntities` por `!(npc.role in MONSTER_ROLE_CR)` (linha 31) e monta `encounterNpcEntities` com `nome: \`${npc.role} (${npc.id})\`` (linha 79) — assim que `antagonistNpc.role` vira `MonsterRole` (Questão em aberto #1), o antagonista some de `npcEntities` (perde a entrada com `antagonist.name`) e aparece em `encounterNpcEntities` como `"Brute (npc-N)"`, não pelo nome. Sem US-189 (exclusão por `antagonist.npcId` + entrada dedicada) no mesmo release, essa regressão fica visível em produção. Ver *Notas de implementação*.
**Depende de:** [US-181](./US-181-antagonista-ganha-want-e-method-estruturados.md) (`antagonist: { name, want, method, trait, weakness }` em `generateClosing` — esta story precisa do objeto existir pra dar `id` a ele; sem US-181, não há o que rastrear)
**Relacionado:** [US-166](./US-166-motor-gera-multiplos-encontros.md) (Backlog — quando implementada, a posição 8 dos 8 encontros é fixa `combat` e é o **confronto final com o antagonista**; esta story é o que garante que o antagonista de fato ESTÁ nos `npcIds` desse encontro, não só ecoado em prosa via `behaviors`/`goal`/`complications`) · [US-189](./US-189-antagonista-entra-no-ledger.md) (**depende desta** — precisa de `antagonist.npcId` pra saber qual entrada excluir de `npcEntities`/`encounterNpcEntities` no ledger e não duplicar o antagonista como três entidades diferentes) · [US-152](./US-152-statblocks-papel-orcamento.md)/[US-160](./US-160-composer-encontro-usa-limiar-de-soma.md)/[US-161](./US-161-jogador-escolhe-nivel-de-desafio-do-encontro.md) (`composeEncounterRoles`/`buildEncounterNpcs`, origem dos combatentes genéricos que hoje preenchem `encounters[].npcIds` sem nenhum vínculo com o antagonista) · [US-164, Questão em aberto #2](./US-164-orquestrador-motor-monta-aventura-gerada.md) (decisão original que adiou "antagonista como entidade rastreável" pra story própria — esta É essa story) · [US-181, Fora do escopo](./US-181-antagonista-ganha-want-e-method-estruturados.md) (a própria US-181 já nomeia esta exclusão: *"Antagonista como entidade rastreável... é escopo de outra story, se algum dia for pedido"*) · [US-190](./US-190-antagonista-vira-passo-proprio-entre-segredos-e-encontros.md) (**muda QUANDO `antagonist` fica disponível** — antes do `Promise.all`, não depois. Se US-190 já estiver implementada, o patch desta story pode entrar logo após `generateAntagonist`, junto de `encounterSkeleton`, em vez de esperar o `Promise.all` resolver — ajuste de posição, não de lógica) · [US-191](./US-191-antagonista-vira-occupant-do-local-do-confronto-final.md) (**depende desta** — precisa de `antagonistNpc.id` pra adicionar a `locations[].occupants` do local do confronto final; Questão em aberto #2 desta story)
**Criada em:** 2026-08-21 — achado ao revisar US-181/US-182/US-183 com a mantenedora: as três stories estruturam `want`/`method`/`trait`/`weakness`/`connection` como PROSA dentro do objeto `antagonist`, mas nenhuma delas — nem o US-166 (Backlog, confronto final) — amarra esse objeto a um `AdventureNpc` real. O combatente que o jogador efetivamente enfrenta no encontro final (`npcIds` montado por `composeEncounterRoles`/`buildEncounterNpcs`, papéis genéricos `Minion`/`Soldier`/`Brute`) pode ser mecanicamente qualquer coisa, sem relação estrutural nenhuma com `antagonist.name`.

---

## História

> **Como** jogadora,
> **quero** que o combatente que eu enfrento no confronto final SEJA o antagonista que a aventura já nomeou, não um NPC genérico qualquer coincidindo no tempo com o fecho da história,
> **para que** o "vilão" que `conclusion`/`objective` descrevem seja o mesmo que aparece na cena, e não duas coisas que só combinam por acaso.

---

## Contexto e motivação

### O que existe hoje

- `AdventureEncounterSchema` ([adventure-generation.ts:37-41](../../../packages/shared/src/types/adventure-generation.ts)) é `{ id, locationId, npcIds }` — `npcIds` referencia `AdventureNpcSchema.id` (comentário da linha 36: *"referência cruzada é sempre por `id`, nunca texto livre"*).
- Em `generateAdventure` ([adventure.service.ts:160-164](../../../apps/api/src/adventure/adventure.service.ts)), o único encontro hoje (`encounter-1`) recebe `npcIds` de `buildEncounterNpcs(composeEncounterRoles(profile.level), npcs)` — instâncias com `name`/`role` = o PAPEL (`"Minion"`, `"Soldier"`, `"Brute"`, [monster-roles.ts:77-85](../../../apps/api/src/adventure-generation/monster-roles.ts)), nunca um nome próprio.
- `antagonist` (US-181, ainda não implementada) nasce DEPOIS — dentro do `Promise.all` que chama `generateClosing` ([adventure.service.ts:170-191](../../../apps/api/src/adventure/adventure.service.ts)) — ou seja, no momento em que `encounters`/`npcIds` já foram decididos, o antagonista sequer existe como dado ainda.
- Nada no schema liga as duas coisas: `antagonist` (US-181) não tem `npcId`; `AdventureNpcSchema` não tem flag "é o antagonista". Um combatente `Brute` orçado por CR e um antagonista com `want`/`method`/`trait`/`weakness` (US-181) coexistem no mesmo encontro sem vínculo estrutural nenhum.

### O problema

O encontro final pode não ter NENHUM `Brute`/`Soldier`/`Minion` — `composeEncounterRoles` ([monster-roles.ts:48-70](../../../apps/api/src/adventure-generation/monster-roles.ts)) usa um orçamento por nível que, em nível 1-3 no modo `'adventure'` (default, US-160), pode devolver array VAZIO (`encounterDeadlyThreshold` = 0 nesses níveis). Mesmo quando há combatentes, escolher "qual deles é o antagonista" seria arbitrário — um `Brute` CR 2 não é o mesmo tipo de entidade que um vilão com motivo/método/traço/fraqueza estruturados; forçar essa equivalência confundiria "capanga orçado por CR" com "vilão nomeado da aventura".

### Por que a solução atual não basta

`behaviors`/`goal`/`complications` do encontro final (US-166, quando implementada) PODEM ecoar `antagonist.want`/`method` em prosa, mas prosa não é referência: nenhum consumidor mecânico (ledger, US-189; `objective`, US-169) tem como perguntar "quem, entre os `npcIds` deste encontro, é o antagonista?" — porque a pergunta não tem resposta no schema hoje.

### A proposta

O antagonista passa a ser, ele mesmo, um `AdventureNpc` — com `id` próprio, mesmo padrão sequencial (`npc-N`) que `buildEncounterNpcs` já usa ([monster-roles.ts:78](../../../apps/api/src/adventure-generation/monster-roles.ts)) — e esse `id` é adicionado aos `npcIds` do encontro final, garantindo que o combatente enfrentado seja LITERALMENTE o antagonista, mesmo quando `composeEncounterRoles` devolve array vazio (nível 1-3). `AdventureAntagonistSchema` (US-181) ganha `npcId: z.string().min(1)` — referência por `id`, mesma disciplina do resto do schema — pra qualquer consumidor (`objective`/US-169, ledger/US-189) apontar pro NPC real sem casar por nome.

---

## Escopo

### Dentro do escopo

- `AdventureAntagonistSchema` (US-181, `adventure-generation.ts`) ganha `npcId: z.string().min(1)`.
- `chooseAntagonistRole(level, challenge)` (NOVA função pura, `monster-roles.ts`, decide Questão em aberto #1 — ver essa seção): devolve o `MonsterRole` mais difícil (`Brute` > `Soldier` > `Minion`, ordem de `ROLES_BY_IMPACT`) cujo CR sozinho cabe no orçamento do MESMO dial que `composeEncounterRoles` usa (`encounterDeadlyThreshold` em `'adventure'`, `singleMonsterCrCap` em `'challenge'`) — `undefined` quando NENHUM papel coubesse (hoje só nível 1-3, modo `'adventure'`, orçamento 0; ver *Notas de implementação* pra por que NÃO há piso `Minion` forçado nesse caso — violaria o próprio limiar que o gate verifica). Não depende do modelo — só `level`/`challenge`, calculável no MESMO ponto que `combatRoles` (linha 221), antes de `generateAntagonist` sequer rodar.
- `composeEncounterRoles` ganha parâmetro novo opcional `reservedCr = 0`, subtraído do orçamento antes do loop guloso — usado SÓ pra montar os capangas do encontro final (posição 8, índice 7), reservando o CR do antagonista (quando `chooseAntagonistRole` devolve um papel) ANTES de encher o resto do orçamento. Os demais 6-7 encontros `combat` (posições 1-7) continuam usando o `combatRoles` SEM reserva, exatamente como hoje — só o encontro final tem orçamento partilhado com o antagonista (Questão em aberto #3, decidida).
- `generateAdventure` (`adventure.service.ts`), depois que `Promise.all([generateClosing, generateOpeningBeat])` resolve e `antagonist` (US-181) está em mãos: monta um `AdventureNpc` pro antagonista — `{ id: npc-${allNpcs.length + 1}, name: antagonist.name, role: antagonistRole ?? antagonist.trait, interactions: [] }` (`role` é o `MonsterRole` calculado por `chooseAntagonistRole` QUANDO existe um; nos casos raros em que `chooseAntagonistRole` devolve `undefined` — nível 1-3, `'adventure'` — cai de volta pro texto livre `antagonist.trait`, comportamento original desta story antes da Questão em aberto #1. `AdventureNpcSchema.role` continua `z.string().min(1)`, sem mudança de schema, só o valor muda; `antagonist.trait` continua acessível via `antagonist.npcId → npcs[].id` mesmo quando `role` É o `MonsterRole`, sem duplicação) —, adiciona ao array de NPCs final, e adiciona esse `id` aos `npcIds` do encontro final (posição 8, índice 7 — já fixa desde US-166, implementada).
- `antagonist.npcId` recebe esse mesmo `id`, fechando a referência.
- Teste de regressão: fixture com `generateClosing` mockado → artefato final tem um `AdventureNpc` com `id === antagonist.npcId`, `name === antagonist.name`, `role` igual ao `MonsterRole` esperado pro nível/challenge da fixture; esse `id` está em `encounters[<final>].npcIds`. Caso de nível baixo, modo `'adventure'` (`chooseAntagonistRole` devolve `undefined`, `composeEncounterRoles` devolve `[]`): encontro final ainda assim tem exatamente 1 `npcId` (o do antagonista, `role === antagonist.trait`, SEM CR) — nunca fica vazio, mas também não força combate onde o LGMRD diz que não há orçamento seguro. Caso com capangas: soma de CR do encontro final (antagonista + capangas reservados) não excede o limiar do dial — cobre a reserva de orçamento (Questão em aberto #3).
- Gate (US-150): `checkReferencesResolve` já valida que todo `npcIds` referencia um `AdventureNpc` existente — o antagonista, sendo um NPC real no array, passa sem mudança na verificação. `checkEncounterBudget` (verificação 3) agora SOMA o CR do antagonista junto com os capangas do encontro final QUANDO `role` é um `MonsterRole` — é exatamente esse gate que valida que a reserva de orçamento (`reservedCr`) foi respeitada; sem a reserva, esse gate rejeitaria o encontro final com frequência. Quando `role === antagonist.trait` (texto livre, fora de `MONSTER_ROLE_CR`), o gate simplesmente não soma nada pro antagonista nesse encontro — mesmo comportamento de hoje pra NPCs narrativos.

### Fora do escopo

- **HP/statblock além do CR nominal do `MonsterRole`.** O antagonista ganha CR (Questão em aberto #1, decidida) só pra entrar no orçamento do gate — não ganha HP/statblock reais, sem sistema de combate por turno (fora do roadmap da Fase 1, ver [Backlog — Combate por turno](./backlog-combate-por-turno.md)). O confronto continua freeform com `rollDice`/`updateCharacterHp`, mesma disciplina da US-171; `role: MonsterRole` só alimenta a SOMA do gate, não muda como o combate é narrado/resolvido.
- **Antagonista SUBSTITUIR os combatentes já orçados.** Continuam no encontro — o antagonista é ADICIONADO, não troca ninguém; a diferença é que agora o orçamento dos capangas do encontro final é calculado JÁ DESCONTANDO o CR do antagonista (`reservedCr`), não que o antagonista tome o lugar de um capanga específico.
- **Mudar `buildEncounterNpcs`.** Não muda — o antagonista continua montado por um caminho paralelo (direto em `adventure.service.ts`), não por essa função. `composeEncounterRoles` MUDA (ganha `reservedCr`), mas de forma aditiva/retrocompatível (default `0`, chamadas existentes sem o parâmetro novo continuam idênticas).
- **Antagonista aparecer em mais de um encontro** (ex.: perseguição, reaparição em encontro anterior ao final). `npcId` aponta pra UM encontro (o final); reaparições em cena antes do confronto, se o produto quiser, é story própria.
- **Exposição no ledger** (US-189) — esta story só cria `npcId`; o que o ledger faz com ele (excluir de `npcEntities`/`encounterNpcEntities`, criar entrada dedicada `revelado: false`) é a US-189, que DEPENDE desta. **Mas as duas precisam ir pro mesmo release** (ver *Bloqueio de release* no topo) — `seed-ledger.ts` já existe e já reage ao `role` novo, então não é um gap futuro inofensivo, é regressão imediata se só esta story for implantada.
- **Mudar `shuffleEncounterTypes`/a decisão de US-166 sobre posição 8 virar `social` quando `composeEncounterRoles` devolve `[]`.** SEM piso `Minion` forçado (Questão em aberto #1 revista), o antagonista em nível 1-3/`'adventure'` legitimamente não tem CR — posição 8 continua podendo degradar pra `social` nesse caso, exatamente como US-166 já decide, sem contradição. Nenhuma mudança necessária em `shuffleEncounterTypes`/`adventure-gate.ts` por causa desta story.

---

## Modelo de dados proposto

```ts
// packages/shared/src/types/adventure-generation.ts — AdventureAntagonistSchema (US-181)
export const AdventureAntagonistSchema = z.object({
  name: z.string().min(1),
  want: z.string().min(1),
  method: z.string().min(1),
  trait: z.string().min(1),
  weakness: z.string().min(1),
  connection: z.string().min(1), // US-183
  npcId: z.string().min(1), // NOVO — referencia AdventureNpcSchema.id, mesma disciplina do resto do schema
})
```

```ts
// apps/api/src/adventure-generation/monster-roles.ts — chooseAntagonistRole (NOVO) +
// composeEncounterRoles ganha reservedCr (Questão em aberto #1, decidida)
export function chooseAntagonistRole(
  level: number,
  challenge: EncounterChallenge = 'adventure',
): MonsterRole | undefined {
  const budget = challenge === 'challenge' ? singleMonsterCrCap(level) : encounterDeadlyThreshold(level)
  for (const role of ROLES_BY_IMPACT) {
    if (MONSTER_ROLE_CR[role] < budget) return role
  }
  // Sem piso forçado: nível 1-3 modo 'adventure' tem orçamento 0 de propósito (US-160) — mesmo
  // Minion (CR 1/8) violaria esse limiar. `undefined` aqui, não um MonsterRole que quebraria o
  // próprio gate que esta função existe pra alimentar.
  return undefined
}

export function composeEncounterRoles(
  level: number,
  challenge: EncounterChallenge = 'adventure',
  reservedCr = 0, // NOVO — CR já comprometido (antagonista), subtraído do orçamento antes do loop
): MonsterRole[] {
  const budget = (challenge === 'challenge' ? singleMonsterCrCap(level) : encounterDeadlyThreshold(level)) - reservedCr
  // ... loop guloso inalterado, só o `budget` de entrada muda
}
```

```ts
// apps/api/src/adventure/adventure.service.ts — combatRoles (linha ~221), calculado ANTES de
// generateAntagonist rodar (chooseAntagonistRole não depende do modelo, só level/challenge)
const antagonistRole = chooseAntagonistRole(profile.level, profile.challenge) // MonsterRole | undefined
const antagonistCr = antagonistRole ? MONSTER_ROLE_CR[antagonistRole] : 0
const combatRoles = composeEncounterRoles(profile.level, profile.challenge) // capangas dos encontros 1-7, SEM reserva
const finalCombatRoles = composeEncounterRoles(profile.level, profile.challenge, antagonistCr) // só o encontro 8, COM reserva (0 = sem reserva quando antagonistRole é undefined)

// buildEncounterDraft (índice 7 = encontro final) recebe finalCombatRoles em vez de combatRoles
// nessa iteração específica — as demais (índices 0-6) continuam recebendo combatRoles.

// depois do Promise.all, quando antagonist (US-181) está em mãos:
const antagonistNpc: AdventureNpc = {
  id: `npc-${allNpcs.length + 1}`,
  name: antagonist.name,
  role: antagonistRole ?? antagonist.trait, // MonsterRole quando existe; senão volta ao texto livre original
  interactions: [],
}
const npcsWithAntagonist = [...allNpcs, antagonistNpc]
const encountersWithAntagonist = encounters.map((e, i) =>
  i === encounters.length - 1 ? { ...e, npcIds: [...e.npcIds, antagonistNpc.id] } : e,
)
```

---

## Critérios de aceite

- [x] `AdventureAntagonistSchema` exige `npcId`, string não vazia.
- [x] `chooseAntagonistRole(level, challenge)` devolve o `MonsterRole` mais difícil que cabe (CR `<` orçamento do dial) sozinho; `undefined` quando nem `Minion` coubesse (nível 1-3, modo `'adventure'`) — SEM piso forçado, pra não violar o próprio limiar que `checkEncounterBudget` verifica.
- [x] `composeEncounterRoles` aceita `reservedCr` (default `0`, retrocompatível — chamadas existentes sem o parâmetro continuam idênticas).
- [x] `generateAdventure` cria um `AdventureNpc` pro antagonista (`id` sequencial, `name === antagonist.name`, `role === antagonistRole ?? antagonist.trait`) e o inclui no array final de `npcs`.
- [x] O `id` desse NPC é adicionado a `npcIds` do encontro final (posição 8, índice 7).
- [x] Encontro final usa `composeEncounterRoles(level, challenge, antagonistCr)` (orçamento reservado, `antagonistCr = 0` quando `antagonistRole` é `undefined`) pros capangas ao redor do antagonista; encontros 1-7 continuam usando `composeEncounterRoles(level, challenge)` sem reserva.
- [x] `antagonist.npcId` no artefato final é igual ao `id` desse NPC.
- [x] Funciona quando `chooseAntagonistRole` devolve `undefined` (nível 1-3, modo `'adventure'`) — encontro final não fica vazio (antagonista sem CR, `role === antagonist.trait`), `finalCombatRoles` idêntico a `composeEncounterRoles` sem reserva nesse caso.
- [x] Gate (US-150, `checkReferencesResolve`) continua passando sem mudança — antagonista é NPC real, referência resolve. Gate (`checkEncounterBudget`, verificação 3) passa COM o antagonista somado quando `role` é `MonsterRole` — nem `oversized` (CR do antagonista sempre `<` `singleMonsterCrCap`, por construção de `chooseAntagonistRole`) nem soma excedendo o limiar (por causa de `reservedCr`); quando `role` é `antagonist.trait` (fora de `MONSTER_ROLE_CR`), o gate não soma nada pro antagonista, sem regressão no nível 1-3/`'adventure'`.
- [x] **Teste de regressão:** fixture com `generateClosing` mockado → `antagonist.npcId` aponta pra um `AdventureNpc` existente cujo `id` está em `encounters[<final>].npcIds`, `role` bate com `chooseAntagonistRole` pro nível/challenge da fixture; caso de nível baixo/`'adventure'` cobre `role === antagonist.trait` (sem CR, sem regressão do gate); caso com capangas cobre a soma de CR do encontro final não excedendo o limiar.
- [x] `pnpm typecheck` e `pnpm test` passam.

---

## Notas de implementação

- Pontos exatos: [adventure.service.ts:160-205](../../../apps/api/src/adventure/adventure.service.ts) (`generateAdventure`, monta `encounters`/`allNpcs` antes do `Promise.all` e monta o objeto final depois — o patch do antagonista entra ENTRE os dois, depois que `antagonist` já existe).
- **Ordem importa, em dois níveis diferentes:** `chooseAntagonistRole`/`antagonistCr` são calculáveis CEDO (só `level`/`challenge`, mesmo ponto que `combatRoles` — linha ~221, antes de `generateAntagonist`) — é o que permite `finalCombatRoles` já nascer com o orçamento certo, reservado. Já o `antagonistNpc` (com `name`/`id`) só pode ser montado DEPOIS que o `Promise.all` resolve, porque precisa de `antagonist.name` (saída do modelo). São dois momentos: reserva de ORÇAMENTO (cedo, pura) vs. minting do NPC (tarde, depende do modelo).
- O "encontro final" é `encounters[7]` (posição 8, fixa `combat` — [US-166](./US-166-motor-gera-multiplos-encontros.md), ✅ implementada). A lógica desta story ("último elemento do array", `encounters.length - 1`) cobre isso sem mudança.
- **`role: antagonistRole ?? antagonist.trait` substitui `role: antagonist.trait` fixo** (proposta original desta story, antes da Questão em aberto #1 ser decidida): na maioria dos casos, `AdventureNpcSchema.role` passa a carregar o `MonsterRole` (pro gate somar CR), não mais o traço narrativo. `antagonist.trait` não se perde nesse caso — continua no objeto `antagonist` (US-181), acessível via `antagonist.npcId`; consumidores que queriam a versão narrativa (ex.: US-189, ledger) leem `antagonist.trait` diretamente, não `npc.role`. No caso raro em que `chooseAntagonistRole` devolve `undefined` (nível 1-3, `'adventure'`), `role` cai de volta pro comportamento original (`antagonist.trait`) — sem CR, sem entrada na soma do gate, exatamente como a proposta original desta story previa antes da Questão em aberto #1 existir.
- `npc-${allNpcs.length + 1}` segue o mesmo padrão sequencial que `buildEncounterNpcs` já usa ([monster-roles.ts:78](../../../apps/api/src/adventure-generation/monster-roles.ts)) — sem namespace especial pro antagonista, só o próximo número da sequência.
- **`buildEncounterDraft` precisa saber QUAL `combatRoles` usar por índice** — hoje recebe um `combatRoles` único, reusado igual em toda iteração `combat` ([adventure.service.ts:144-158](../../../apps/api/src/adventure/adventure.service.ts)). Com `finalCombatRoles` distinto só pra posição 7, o `.map` que gera `drafts` precisa passar `index === 7 ? finalCombatRoles : combatRoles` (ou equivalente) — pequena mudança na chamada, não na assinatura de `buildEncounterDraft` em si (que já recebe `combatRoles` como parâmetro por chamada). Quando `antagonistCr === 0` (`chooseAntagonistRole` devolveu `undefined`), `finalCombatRoles` é idêntico a `combatRoles` sem reserva — não há tratamento especial extra pra esse caso, o `- 0` no orçamento é no-op.
- **`seed-ledger.ts` já reage ao `role` novo, sem mudança nenhuma nesse arquivo (US-188 não o toca)** — é por isso que o bloqueio de release existe. `npcEntities` ([seed-ledger.ts:30-31](../../../apps/api/src/adventure-generation/seed-ledger.ts)) filtra fora todo `npc.role ∈ MONSTER_ROLE_CR`; `encounterNpcEntities` ([seed-ledger.ts:71-86](../../../apps/api/src/adventure-generation/seed-ledger.ts)) monta `nome` a partir de `npc.role`, não de `npc.name`. Quando `chooseAntagonistRole` devolve um papel (a maioria dos casos), `antagonistNpc.role` passa a satisfazer `role ∈ MONSTER_ROLE_CR` — cai na MESMA filtragem que já existe pros capangas genéricos, perdendo `antagonist.name` no ledger. US-189 precisa excluir `npc.id === adventure.antagonist.npcId` dos dois filtros e semear uma entrada própria (`nome: antagonist.name`) ANTES/junto de US-188 chegar a produção — não depois.
- **Por que NÃO forçar piso `Minion`, decisão revista em 2026-08-22:** a primeira versão desta story propunha `Minion` como piso garantido mesmo com orçamento 0 (nível 1-3, `'adventure'`). Isso quebra `checkEncounterBudget` (verificação 3, US-150) — `soma 1/8 > limiar 0` reprova o gate SEMPRE nesse nível/modo, e ainda force posição 8 a `combat` mesmo quando o jogador escolheu o dial de risco reduzido (contradiz a escolha do jogador, não só o gate). Revertido: sem MonsterRole nesse caso extremo, US-166 continua livre pra degradar posição 8 pra `social` exatamente como já decide — sem mudança em `shuffleEncounterTypes`/`adventure-gate.ts`.

---

## Questões em aberto

1. ~~O antagonista deveria ganhar um `MonsterRole` real (`Minion`/`Soldier`/`Brute`) pra ter CR e entrar no orçamento do gate (verificação 3, US-150), em vez de ficar de fora do cálculo de dificuldade?~~ **Decidido (2026-08-22): sim, na maioria dos casos.** `chooseAntagonistRole(level, challenge)` escolhe o papel mais difícil que cabe sozinho no orçamento do dial (`Brute` > `Soldier` > `Minion`). O CR do antagonista entra na MESMA soma que o gate verifica pro encontro final — não fica de fora nem é somado à parte — o que exige reservar esse CR do orçamento dos capangas do encontro final ANTES de compor `finalCombatRoles` (`composeEncounterRoles(level, challenge, antagonistCr)`), pra não estourar o limiar (verificação 3, US-150) por composição cega. **Revisto no mesmo dia:** a versão inicial desta decisão previa `Minion` como PISO garantido mesmo quando nem ele coubesse (nível 1-3, modo `'adventure'`, orçamento 0) — mas isso contradiz o próprio limiar (`1/8 > 0` reprovaria `checkEncounterBudget` sempre nesse nível/modo) e força combate onde o jogador escolheu o dial de risco reduzido. Sem piso: `chooseAntagonistRole` devolve `undefined` nesse caso, `role` do NPC cai de volta pro texto livre (`antagonist.trait`, sem CR) — US-166 continua livre pra degradar a posição 8 pra `social` nesse nível/modo, exatamente como já decidia antes desta story existir. Ver *Modelo de dados*/*Notas de implementação* pro desenho completo.
2. ~~Vale o antagonista aparecer em `locations[].occupants` do local do encontro final (mesmo padrão que NPCs sociais usam, US-158), pra `generateOpeningBeat`/prosa de local poderem referenciá-lo antes do confronto?~~ **Decidido (2026-08-22): sim, vale — vira story própria, [US-191](./US-191-antagonista-vira-occupant-do-local-do-confronto-final.md).** Só a referência ESTRUTURAL (`id` em `occupants[]`), não a prosa do local em si — `generateLocationsAndNpcs` continua rodando antes do antagonista existir (mesma barreira de ordem que US-190 não resolve), então US-191 patcheia `occupants` depois que `antagonistNpc` existe, mesmo estilo do patch de `npcIds` que esta story já propõe.

---

## Referências no código

- [packages/shared/src/types/adventure-generation.ts:37-41](../../../packages/shared/src/types/adventure-generation.ts) — `AdventureEncounterSchema`, `npcIds` referencia `AdventureNpcSchema.id`.
- [packages/shared/src/types/adventure-generation.ts:11-16](../../../packages/shared/src/types/adventure-generation.ts) — `AdventureNpcSchema`, formato do NPC que o antagonista passa a ser.
- [apps/api/src/adventure/adventure.service.ts:160-205](../../../apps/api/src/adventure/adventure.service.ts) — `generateAdventure`, onde `encounters`/`npcs` nascem e onde o antagonista é injetado depois do `Promise.all`.
- [apps/api/src/adventure-generation/monster-roles.ts:14-72](../../../apps/api/src/adventure-generation/monster-roles.ts) — `MONSTER_ROLE_CR`, `ROLES_BY_IMPACT`, `composeEncounterRoles`/`buildEncounterNpcs` — `chooseAntagonistRole` (NOVA) e o parâmetro `reservedCr` de `composeEncounterRoles` (NOVO) entram aqui.
- [apps/api/src/adventure-generation/adventure-gate.ts:133-163](../../../apps/api/src/adventure-generation/adventure-gate.ts) — `checkEncounterBudget` (verificação 3), soma CR por encontro `combat`, já lê `npc.role ∈ MONSTER_ROLE_CR` — passa a somar o antagonista automaticamente assim que `role` vira `MonsterRole`, sem mudança nesse arquivo. `checkReferencesResolve`, valida que `npcIds` resolve contra `npcs[]`; sem mudança necessária.
- [US-181](./US-181-antagonista-ganha-want-e-method-estruturados.md) — cria `antagonist`, pré-requisito direto.
- [US-166](./US-166-motor-gera-multiplos-encontros.md) — ✅ implementada, fixa a posição 8 (índice 7) como confronto final; esta story é o que torna esse confronto mecanicamente o antagonista, com CR de verdade.
- [apps/api/src/adventure-generation/seed-ledger.ts:30-31,71-86](../../../apps/api/src/adventure-generation/seed-ledger.ts) — `npcEntities`/`encounterNpcEntities`, já implementado, reage ao `role` novo do antagonista sem mudança nesse arquivo — motivo do bloqueio de release (ver topo do documento).
- [US-189](./US-189-antagonista-entra-no-ledger.md) — depende de `antagonist.npcId` criado aqui; PRECISA landar no mesmo release que esta story (ver *Bloqueio de release*), não só "depois".
- [US-164, Questão em aberto #2](./US-164-orquestrador-motor-monta-aventura-gerada.md) — decisão original que adiou esta story.
