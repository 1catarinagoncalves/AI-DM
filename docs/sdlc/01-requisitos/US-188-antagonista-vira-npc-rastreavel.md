# US-188 — Antagonista vira NPC rastreável, encontro final referencia por `id`

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** [US-181](./US-181-antagonista-ganha-want-e-method-estruturados.md) (`antagonist: { name, want, method, trait, weakness }` em `generateClosing` — esta story precisa do objeto existir pra dar `id` a ele; sem US-181, não há o que rastrear)
**Relacionado:** [US-166](./US-166-motor-gera-multiplos-encontros.md) (Backlog — quando implementada, a posição 8 dos 8 encontros é fixa `combat` e é o **confronto final com o antagonista**; esta story é o que garante que o antagonista de fato ESTÁ nos `npcIds` desse encontro, não só ecoado em prosa via `behaviors`/`goal`/`complications`) · [US-189](./US-189-antagonista-entra-no-ledger.md) (**depende desta** — precisa de `antagonist.npcId` pra saber qual entrada excluir de `npcEntities`/`encounterNpcEntities` no ledger e não duplicar o antagonista como três entidades diferentes) · [US-152](./US-152-statblocks-papel-orcamento.md)/[US-160](./US-160-composer-encontro-usa-limiar-de-soma.md)/[US-161](./US-161-jogador-escolhe-nivel-de-desafio-do-encontro.md) (`composeEncounterRoles`/`buildEncounterNpcs`, origem dos combatentes genéricos que hoje preenchem `encounters[].npcIds` sem nenhum vínculo com o antagonista) · [US-164, Questão em aberto #2](./US-164-orquestrador-motor-monta-aventura-gerada.md) (decisão original que adiou "antagonista como entidade rastreável" pra story própria — esta É essa story) · [US-181, Fora do escopo](./US-181-antagonista-ganha-want-e-method-estruturados.md) (a própria US-181 já nomeia esta exclusão: *"Antagonista como entidade rastreável... é escopo de outra story, se algum dia for pedido"*) · [US-190](./US-190-antagonista-vira-passo-proprio-entre-segredos-e-encontros.md) (**muda QUANDO `antagonist` fica disponível** — antes do `Promise.all`, não depois. Se US-190 já estiver implementada, o patch desta story pode entrar logo após `generateAntagonist`, junto de `encounterSkeleton`, em vez de esperar o `Promise.all` resolver — ajuste de posição, não de lógica)
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
- `generateAdventure` (`adventure.service.ts`), depois que `Promise.all([generateClosing, generateOpeningBeat])` resolve e `antagonist` (US-181) está em mãos: monta um `AdventureNpc` pro antagonista — `{ id: npc-${allNpcs.length + 1}, name: antagonist.name, role: antagonist.trait, interactions: [] }` (`role` livre, `AdventureNpcSchema.role` já é `z.string().min(1)`, não enum restrito a `MONSTER_ROLE_CR`) —, adiciona ao array de NPCs final, e adiciona esse `id` aos `npcIds` do encontro final (hoje `encounter-1`; quando US-166 estiver implementada, posição 8 — a que a própria US-166 já reserva como "confronto final com o antagonista").
- `antagonist.npcId` recebe esse mesmo `id`, fechando a referência.
- Teste de regressão: fixture com `generateClosing` mockado → artefato final tem um `AdventureNpc` com `id === antagonist.npcId` e `name === antagonist.name`; esse `id` está em `encounters[<final>].npcIds`. Caso de nível baixo (`composeEncounterRoles` devolve `[]`): encontro final ainda assim tem exatamente 1 `npcId` (o do antagonista) — nunca fica vazio.
- Gate (US-150): `checkReferencesResolve` já valida que todo `npcIds` referencia um `AdventureNpc` existente — o antagonista, sendo um NPC real no array, passa sem mudança na verificação.

### Fora do escopo

- **HP/statblock/CR do antagonista.** Sem sistema de combate por turno (fora do roadmap da Fase 1, ver [Backlog — Combate por turno](./backlog-combate-por-turno.md)); `role` fica como texto livre (`trait`), não vira `MonsterRole` novo em `MONSTER_ROLE_CR`. O confronto continua freeform com `rollDice`/`updateCharacterHp`, mesma disciplina da US-171.
- **Antagonista SUBSTITUIR os combatentes já orçados.** Quando `composeEncounterRoles` devolve papéis não-vazios, eles continuam no encontro — o antagonista é ADICIONADO, não troca ninguém (ex.: um `Brute` guarda-costas ao lado do antagonista é composição válida, não bug).
- **Mudar `composeEncounterRoles`/`buildEncounterNpcs`.** Nenhuma das duas funções muda — o antagonista entra por um caminho paralelo (montado direto em `adventure.service.ts`), não pelo composer de papéis.
- **Antagonista aparecer em mais de um encontro** (ex.: perseguição, reaparição em encontro anterior ao final). `npcId` aponta pra UM encontro (o final); reaparições em cena antes do confronto, se o produto quiser, é story própria.
- **Exposição no ledger** (US-189) — esta story só cria `npcId`; o que o ledger faz com ele (excluir de `npcEntities`/`encounterNpcEntities`, criar entrada dedicada `revelado: false`) é a US-189, que DEPENDE desta.

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
// apps/api/src/adventure/adventure.service.ts — generateAdventure, depois do Promise.all
const antagonistNpc: AdventureNpc = {
  id: `npc-${allNpcs.length + 1}`,
  name: antagonist.name,
  role: antagonist.trait,
  interactions: [],
}
const npcsWithAntagonist = [...allNpcs, antagonistNpc]
const encountersWithAntagonist = encounters.map((e, i) =>
  i === encounters.length - 1 ? { ...e, npcIds: [...e.npcIds, antagonistNpc.id] } : e,
)
```

---

## Critérios de aceite

- [ ] `AdventureAntagonistSchema` exige `npcId`, string não vazia.
- [ ] `generateAdventure` cria um `AdventureNpc` pro antagonista (`id` sequencial, `name === antagonist.name`) e o inclui no array final de `npcs`.
- [ ] O `id` desse NPC é adicionado a `npcIds` do encontro final (último elemento de `encounters[]`).
- [ ] `antagonist.npcId` no artefato final é igual ao `id` desse NPC.
- [ ] Funciona quando `composeEncounterRoles(profile.level)` devolve `[]` (nível 1-3, modo `'adventure'`) — encontro final não fica vazio, tem ao menos o antagonista.
- [ ] Gate (US-150, `checkReferencesResolve`) continua passando sem mudança — antagonista é NPC real, referência resolve.
- [ ] **Teste de regressão:** fixture com `generateClosing` mockado → `antagonist.npcId` aponta pra um `AdventureNpc` existente cujo `id` está em `encounters[<final>].npcIds`; caso de nível baixo cobre o array vazio de `composeEncounterRoles`.
- [ ] `pnpm typecheck` e `pnpm test` passam.

---

## Notas de implementação

- Pontos exatos: [adventure.service.ts:160-205](../../../apps/api/src/adventure/adventure.service.ts) (`generateAdventure`, monta `encounters`/`allNpcs` antes do `Promise.all` e monta o objeto final depois — o patch do antagonista entra ENTRE os dois, depois que `antagonist` já existe).
- **Ordem importa:** hoje `encounters` é montado nas linhas 160-164, ANTES do `Promise.all` (linha 170) que produz `antagonist`. O antagonista só pode ser adicionado a `npcIds` DEPOIS que o `Promise.all` resolve — não dá pra construir `encounters` de uma vez só no início da função a partir desta story em diante.
- Quando [US-166](./US-166-motor-gera-multiplos-encontros.md) for implementada, o "encontro final" deixa de ser `encounters[0]` e vira `encounters[7]` (posição 8, fixa `combat`) — a lógica desta story ("último elemento do array", `encounters.length - 1`) já cobre isso sem mudança, desde que a US-166 mantenha a posição 8 como último elemento do array (o que ela já decide).
- `role: antagonist.trait` é uma escolha de conveniência (reusa o maneirismo já escrito pela US-181 como "papel" narrativo do NPC) — não é obrigatório; se o eval mostrar que fica estranho no ledger (US-189 lê esse `role`/`nota`), ajuste é de prompt/mapeamento, não do schema.
- `npc-${allNpcs.length + 1}` segue o mesmo padrão sequencial que `buildEncounterNpcs` já usa ([monster-roles.ts:78](../../../apps/api/src/adventure-generation/monster-roles.ts)) — sem namespace especial pro antagonista, só o próximo número da sequência.

---

## Questões em aberto

1. O antagonista deveria ganhar um `MonsterRole` real (`Minion`/`Soldier`/`Brute`) pra ter CR e entrar no orçamento do gate (verificação 3, US-150), em vez de ficar de fora do cálculo de dificuldade? Não decidido — hoje o gate só soma CR dos `npcs[]` cujo `role ∈ MONSTER_ROLE_CR`; o antagonista com `role` livre (`trait`) fica fora dessa soma, o que pode subestimar a dificuldade real do encontro final. Se o eval/playtest mostrar confrontos finais desbalanceados, é retrabalho de prompt (dar ao antagonista um `MonsterRole`) ou de gate (somar separado), não decidido aqui.
2. Vale o antagonista aparecer em `locations[].occupants` do local do encontro final (mesmo padrão que NPCs sociais usam, US-158), pra `generateOpeningBeat`/prosa de local poderem referenciá-lo antes do confronto? Não decidido — ideia interessante, mas expande o escopo pra `generateLocationsAndNpcs`, que roda ANTES do antagonista existir (mesma barreira de ordem que a US-181 já documentou pra `generateClosing`); se pedido, é story própria.

---

## Referências no código

- [packages/shared/src/types/adventure-generation.ts:37-41](../../../packages/shared/src/types/adventure-generation.ts) — `AdventureEncounterSchema`, `npcIds` referencia `AdventureNpcSchema.id`.
- [packages/shared/src/types/adventure-generation.ts:11-16](../../../packages/shared/src/types/adventure-generation.ts) — `AdventureNpcSchema`, formato do NPC que o antagonista passa a ser.
- [apps/api/src/adventure/adventure.service.ts:160-205](../../../apps/api/src/adventure/adventure.service.ts) — `generateAdventure`, onde `encounters`/`npcs` nascem e onde o antagonista é injetado depois do `Promise.all`.
- [apps/api/src/adventure-generation/monster-roles.ts:48-85](../../../apps/api/src/adventure-generation/monster-roles.ts) — `composeEncounterRoles`/`buildEncounterNpcs`, origem dos combatentes genéricos; `composeEncounterRoles` pode devolver `[]` em nível 1-3 (linha 37 do comentário da função).
- [apps/api/src/adventure-generation/adventure-gate.ts](../../../apps/api/src/adventure-generation/adventure-gate.ts) — `checkReferencesResolve`, valida que `npcIds` resolve contra `npcs[]`; sem mudança necessária.
- [US-181](./US-181-antagonista-ganha-want-e-method-estruturados.md) — cria `antagonist`, pré-requisito direto.
- [US-166](./US-166-motor-gera-multiplos-encontros.md) — Backlog, reserva a posição 8 (final) como confronto com o antagonista; esta story é o que torna essa reserva mecânica, não só narrativa.
- [US-189](./US-189-antagonista-entra-no-ledger.md) — depende de `antagonist.npcId` criado aqui.
- [US-164, Questão em aberto #2](./US-164-orquestrador-motor-monta-aventura-gerada.md) — decisão original que adiou esta story.
