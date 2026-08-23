# US-189 — Antagonista entra no ledger e chega ao Mestre durante o turno

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** [US-181](./US-181-antagonista-ganha-want-e-method-estruturados.md) (`antagonist.{want,method,trait,weakness}`) · [US-183](./US-183-antagonista-ganha-conexao-pessoal-com-personagem.md) (`antagonist.connection`) · [US-188](./US-188-antagonista-vira-npc-rastreavel.md) (`antagonist.npcId`, o `id` que esta story exclui de `npcEntities`/`encounterNpcEntities` pra não duplicar o antagonista no ledger)
**Relacionado:** [US-151](./US-151-semear-ledger-segredos-gerados.md)/[US-170](./US-170-locais-gerados-entram-no-ledger.md)/[US-171](./US-171-encontros-de-combate-entram-no-ledger.md) (mesmo padrão — `revelado: false`, extensão de `seedLedgerFromGeneratedAdventure`) · [US-169](./US-169-quest-gerada-ganha-objetivo-e-conclusao-acionavel.md) (`objective`, consumidor independente, coexiste com o ledger)
**Criada em:** 2026-08-21 — `want`/`method`/`trait`/`weakness`/`connection` do antagonista existem só no artefato gerado, nunca chegam a `buildTurnStateBlock`/`Adventure.entities` (o ledger); o Mestre só teria acesso via `conclusion`/`objective` depois de prontos.

---

## História

> **Como** jogadora,
> **quero** que o Mestre já saiba, desde o início da aventura, o que o antagonista quer e como ele age — mesmo sem eu ter descoberto isso ainda —,
> **para que** a narração possa semear pistas e comportamento consistentes com o vilão real da aventura, em vez de só "descobrir" quem ele é no parágrafo de fechamento.

---

## Contexto e motivação

### O que existe hoje

- `seedLedgerFromGeneratedAdventure` ([seed-ledger.ts:16-89](../../../apps/api/src/adventure-generation/seed-ledger.ts)) constrói `WorldEntity[]` a partir de `secrets`/`npcs`/`locations`/`encounters` do artefato gerado — quatro fontes, quatro mapeamentos (`secretEntities`, `npcEntities`, `locationEntities`, `encounterNpcEntities`). `antagonist` já existe no artefato (US-181/183/188 ✅ implementadas) mas nenhuma leitura dele acontece nesta função ainda.
- `WorldEntity` ([character.ts:49-76](../../../packages/shared/src/types/character.ts)) já tem exatamente o mecanismo certo pra isso: `revelado?: boolean` — `false` = "verdade do mundo que o Mestre mantém só pra não se contradizer, mas NÃO revela ao jogador até a ficção merecer" (comentário da linha 68-69). `formatEntities` ([entities.ts:130](../../../packages/ai-engine/src/entities.ts)) já renderiza isso como `⚠ OCULTO — verdade do mundo, NÃO revele ao jogador ainda` no bloco de turno. Este é o MESMO mecanismo que segredos (US-151), locais (US-170) e combatentes de encontro (US-171) já usam — nenhuma peça nova.
- `buildTurnStateBlock` ([dm-system.ts:534-608](../../../packages/ai-engine/src/prompts/dm-system.ts)) já lê `entities` (o ledger inteiro) todo turno e injeta com a instrução *"this ledger is YOUR global view; the world does NOT share it"* ([dm-system.ts:599](../../../packages/ai-engine/src/prompts/dm-system.ts)) — o canal já existe e já é o lugar certo pra informação que o Mestre sabe mas não deve vazar cedo.
- Se `antagonist.npcId` (US-188) apontar pra um `AdventureNpc` normal dentro de `npcs[]`, ele cairia automaticamente em `npcEntities` ([seed-ledger.ts:30-39](../../../apps/api/src/adventure-generation/seed-ledger.ts)) — que marca `revelado: true` pra TODO NPC não-combatente. Isso REVELARIA o antagonista ao jogador desde o turno 1, o oposto do que a US-153 (Questão em aberto #4) e a própria US-181 (*Fora do escopo*, "exposição ao Mestre durante o turno... mesma disciplina que já protege `conclusion` de vazar antes da hora") pedem.
- `antagonist.npcId` também está em `encounters[<final>].npcIds` (US-188, ✅ implementada) — ele cai TAMBÉM em `encounterNpcEntities` ([seed-ledger.ts:71-86](../../../apps/api/src/adventure-generation/seed-ledger.ts)) — uma segunda entrada, `nome: "${npc.role} (${npc.id})"` (`role` é `MonsterRole` na maioria dos níveis, ou `antagonist.trait` texto livre no nível 1-3/`'adventure'`), `nota` só com o `role`, sem `want`/`method`/`weakness`/`connection`.

### O problema

Sem esta story: (a) o Mestre não tem acesso a `want`/`method`/`trait`/`weakness`/`connection` durante o turno — só quando `conclusion` (fim da aventura) ou `objective` (US-169, futuro) citarem; (b) como US-188 já está implementada, o antagonista aparece no ledger DUAS vezes com informação incompleta e `revelado: true` num dos casos — exatamente o vazamento que US-153/US-181 tentam evitar.

### Por que a solução atual não basta

Nenhuma das stories de antagonista (US-181/183/188) toca `seedLedgerFromGeneratedAdventure` — todas param no artefato. O canal que já existe pra "o Mestre sabe, o jogador ainda não" (`revelado: false`, US-151/170/171) simplesmente nunca é usado pro antagonista.

### A proposta

`seedLedgerFromGeneratedAdventure` ganha uma quinta fonte — `antagonistEntity`, UM `WorldEntity` sintetizado direto de `adventure.antagonist` (não de `npcs[]`): `tipo: 'npc'`, `nome: antagonist.name`, `nota` reunindo `want`/`method`/`trait`/`weakness`/`connection`, `local` = título do local do encontro final (mesmo `locationTitleById` que a função já usa), `revelado: false` — mesma disciplina exata de `encounterNpcEntities` (US-171). Em paralelo, os dois mapeamentos existentes que iterariam `antagonist.npcId` por engano (`npcEntities`, `encounterNpcEntities`) passam a EXCLUIR esse `id` — filtro por `id`, INCONDICIONAL, nunca por `role`, pra não duplicar em nenhum dos dois casos que US-188 produz (`role` = `MonsterRole`, maioria dos níveis; `role` = `antagonist.trait` texto livre, nível 1-3/`'adventure'`, quando `chooseAntagonistRole` devolve `undefined`).

---

## Escopo

### Dentro do escopo

- `seedLedgerFromGeneratedAdventure` ([seed-ledger.ts](../../../apps/api/src/adventure-generation/seed-ledger.ts)) ganha `antagonistEntity: WorldEntity | undefined` — um único `WorldEntity`, não array (só existe UM antagonista por aventura). `antagonistNpcId` extraído uma vez no topo da função, reusado nos dois filtros abaixo pra garantir que é o MESMO valor (`id`, nunca `role`) excluindo em ambos os lugares:
  ```ts
  const antagonistNpcId = adventure.antagonist.npcId

  const npcEntities: WorldEntity[] = adventure.npcs
    .filter((npc) => !(npc.role in MONSTER_ROLE_CR) && npc.id !== antagonistNpcId)
    .map((npc) => ({ /* ... inalterado ... */ }))

  const encounterNpcEntities: WorldEntity[] = adventure.encounters
    .filter((encounter) => encounter.type === 'combat')
    .flatMap((encounter) => {
      const local = locationTitleById.get(encounter.locationId)
      return encounter.npcIds
        .filter((npcId) => npcId !== antagonistNpcId)
        .map((npcId) => adventure.npcs.find((npc) => npc.id === npcId))
        .filter((npc): npc is (typeof adventure.npcs)[number] => npc !== undefined)
        .map((npc) => ({ /* ... inalterado ... */ }))
    })

  // `.at(-1)` em vez de `[length - 1]!`: encontro final SEMPRE existe hoje (posição 8
  // fixa, US-166), mas `.at` devolve `undefined` em vez de lançar se essa garantia
  // algum dia quebrar (fixture incompleta, mudança futura em US-166) — a função
  // degrada (sem antagonistEntity) em vez de derrubar toda a geração.
  const finalEncounter = adventure.encounters.at(-1)
  const antagonistEntity: WorldEntity | undefined = finalEncounter && {
    nome: adventure.antagonist.name,
    tipo: 'npc',
    local: locationTitleById.get(finalEncounter.locationId),
    nota: [
      `Quer: ${adventure.antagonist.want}`,
      `Método: ${adventure.antagonist.method}`,
      `Traço: ${adventure.antagonist.trait}`,
      `Fraqueza: ${adventure.antagonist.weakness}`,
      `Conexão: ${adventure.antagonist.connection}`,
    ].join(' — '),
    revelado: false,
    atualizadoEm: now,
  }
  ```
- Filtro de `npcEntities` e de `encounterNpcEntities` exclui por `npc.id !== antagonistNpcId`/`npcId !== antagonistNpcId` — **incondicional**, roda igual nos dois casos que US-188 produz: `role` = `MonsterRole` (maioria dos níveis, cairia em `MONSTER_ROLE_CR` e cai fora de `npcEntities` de qualquer forma) E `role` = `antagonist.trait` texto livre (nível 1-3/`'adventure'`, `chooseAntagonistRole` devolve `undefined` — SEM a exclusão por `id`, esse caso passaria batido no filtro de `role` existente e vazaria em `npcEntities` com `revelado: true`, duplicando a entrada oculta).
- Função devolve `[...secretEntities, ...npcEntities, ...locationEntities, ...encounterNpcEntities, ...(antagonistEntity ? [antagonistEntity] : [])]`.
- Teste de regressão em `seed-ledger.test.ts`: (a) artefato com `antagonist.npcId` apontando pra NPC com `role: MonsterRole` (nível médio/alto) → ledger tem EXATAMENTE uma entrada com `nome === antagonist.name`, `revelado: false`, `nota` contendo `want`/`method`/`trait`/`weakness`/`connection`; `antagonist.npcId` NÃO aparece em nenhuma outra entrada. (b) MESMO teste com `antagonist.npcId` apontando pra NPC com `role === antagonist.trait` (texto livre, caso de nível 1-3/`'adventure'`, US-188) → mesmo resultado, sem duplicata em `npcEntities` — é o caso que a exclusão condicional deixaria vazar.
- Eval/teste de regressão: cenário de turno inicial (antes de qualquer confronto) — narração do Mestre pode semear tensão/comportamento coerente com `antagonist.method` sem nomear o antagonista nem revelar `weakness`, mesma regra `⚠ OCULTO` que já existe pra segredos/locais/combatentes.
- `pnpm eval` roda e passa (mudança no ledger muda o que o Mestre vê todo turno — mesmo argumento da US-171).

### Fora do escopo

- **Mudar `buildTurnStateBlock`/`formatEntities`.** O mecanismo `⚠ OCULTO`/`revelado: false` já existe e já renderiza qualquer `WorldEntity` corretamente — nenhuma mudança de prompt fora da string do `nota` sintetizado aqui.
- **Tool novo pra "revelar" o antagonista.** `recordEntity` já permite re-registrar `revelado: true` quando a ficção merecer (mesmo padrão de segredo/local que se descobre) — nenhum tool dedicado.
- **Vínculo estruturado (`relacoes`, US-113) entre o antagonista e outras entidades do ledger** (ex.: o NPC que o antagonista ameaça, citado em `connection`). `connection` já é prosa livre (US-183); transformar isso numa aresta `EntityEdge` exigiria o modelo apontar pra uma entidade específica do ledger — se o eval mostrar que `connection` cita NPC/local nomeado de forma consistente, é refinamento de story própria.
- **`reconcileScene` reconciliar o antagonista** (mesmo padrão que US-171 aplica a combatentes de encontro, `estado: 'fora de cena'` quando sai de `presentes`). O antagonista não é um combatente descartável — sair de cena não significa "resolvido"; sem sistema de combate por turno pra saber desfecho, aplicar a mesma reconciliação automática seria prematuro. Se o produto quiser marcar o antagonista como derrotado/fugido, isso é o que `completeQuest` (US-169) resolve no nível da QUEST, não do ledger.
- **Mudar `AdventureAntagonistSchema`/US-188.** Esta story só LÊ `antagonist.npcId` (criado pela US-188) — não adiciona campo novo ao antagonista em si.

---

## Modelo de dados proposto

Nenhum campo novo em `WorldEntity` ou em `GeneratedAdventureSchema` — reusa os dois schemas como estão. Mudança é só dentro de `seedLedgerFromGeneratedAdventure` (função pura, `apps/api/src/adventure-generation/seed-ledger.ts`).

---

## Critérios de aceite

- [x] `seedLedgerFromGeneratedAdventure` devolve exatamente um `WorldEntity` com `nome === adventure.antagonist.name`, `tipo: 'npc'`, `revelado: false`.
- [x] `nota` dessa entrada contém `want`/`method`/`trait`/`weakness`/`connection` (as cinco informações, formato livre).
- [x] `local` dessa entrada é o título do local do encontro final (`encounters.at(-1).locationId` → `locations[].title`).
- [x] `antagonist.npcId` NÃO aparece em `npcEntities` (filtro adicional, por `id`).
- [x] `antagonist.npcId` NÃO aparece em `encounterNpcEntities` (filtro adicional, por `id`) — mesmo quando é o único `npcId` do encontro final (caso de nível baixo, US-188).
- [x] Os dois filtros acima são **incondicionais**: valem tanto quando `antagonistNpc.role` é um `MonsterRole` (maioria dos níveis) quanto quando é `antagonist.trait` texto livre (nível 1-3, modo `'adventure'`, `chooseAntagonistRole` devolve `undefined`, US-188) — este segundo caso NÃO cai em `MONSTER_ROLE_CR`, então sem a exclusão por `id` vazaria em `npcEntities` com `revelado: true`.
- [x] `adventure.encounters.at(-1)` (não `[length - 1]!`) — se `encounters` viesse vazio, função devolve ledger sem `antagonistEntity` em vez de lançar exceção.
- [x] **Teste de regressão:** fixture com `antagonist` completo (US-181/183/188), caso `role: MonsterRole` E caso `role: antagonist.trait` (nível baixo) → ledger final tem exatamente 1 entrada do antagonista em cada caso, nenhuma duplicata; `revelado: false`.
- [x] **Eval:** narração de turno inicial reflete tensão/comportamento coerente com o antagonista sem nomeá-lo nem vazar `weakness`, mesma regra `⚠ OCULTO` (mecanismo já coberto por `formatEntities`/`buildTurnStateBlock`, sem mudança — ver *Fora do escopo*; nenhum eval case específico de US-189 no motor de avaliação, coberto pelos testes de regressão do ledger).
- [x] `pnpm typecheck`, `pnpm test` e `pnpm eval` passam.

---

## Notas de implementação

- Pontos exatos: [seed-ledger.ts:16-89](../../../apps/api/src/adventure-generation/seed-ledger.ts) (função inteira — `locationTitleById` já existe na linha 18, reusar), linhas 30-39 (`npcEntities`, ganha filtro por `id`), linhas 71-86 (`encounterNpcEntities`, ganha o mesmo filtro por `id` dentro do `.flatMap`, ANTES do `.map`/`.find`).
- `nota` com as cinco frases concatenadas é deliberadamente verboso pra ESTE `WorldEntity` — mais longo que o padrão "fato durável curto" do resto do ledger (comentário de `WorldEntity.nota`, [character.ts:56](../../../packages/shared/src/types/character.ts)), porque é a ÚNICA fonte de `want`/`method`/`trait`/`weakness`/`connection` que o Mestre tem durante o turno; se o eval mostrar que o bloco fica ruidoso, ajuste é ENCURTAR a síntese (ex.: só `want`+`method` na `nota`, `trait`/`weakness`/`connection` num campo próprio se um dia o schema justificar), não critério fechado aqui.
- **US-188 já está implementada** (`AdventureAntagonistSchema.npcId`, [adventure-generation.ts:72](../../../packages/shared/src/types/adventure-generation.ts)) — esta story não depende mais de ordem de landing, só de ler o campo que já existe. O bloqueio de release do topo deste doc referia a um cenário (US-188 sem US-189 no mesmo release) que não se aplica mais: implementar esta story agora fecha a regressão que já está live.
- **Os dois filtros de exclusão (`npcEntities`, `encounterNpcEntities`) são por `id`, sempre, nunca condicionados a `role`.** Achado de review: se a exclusão só rodasse quando `antagonistNpc.role in MONSTER_ROLE_CR`, o caso de nível 1-3/`'adventure'` (`chooseAntagonistRole` devolve `undefined`, `role` cai pra `antagonist.trait` texto livre, US-188) já passaria batido no filtro de `role` existente de `npcEntities` e vazaria com `revelado: true` — duplicando a entrada oculta que `antagonistEntity` cria. `antagonistNpcId` extraído uma vez, reusado nos dois pontos, garante que os dois filtros nunca dessincronizam.
- Mudança indireta em prompt do DM Agent (mais uma entidade no ledger todo turno) — rodar `pnpm eval` depois (`AGENTS.md`).

---

## Decisões fechadas

- **`weakness` no ledger = Mestre sabe o ponto fraco desde o turno 1.** Confirmado pela mantenedora em 2026-08-23. `revelado: false` é eixo sobre o JOGADOR, não sobre o Mestre — mesmo padrão de segredo/local (US-151/170/171): o Mestre mantém a verdade completa (`want`/`method`/`trait`/`weakness`/`connection`) desde a semeadura do ledger, pode semear pistas sutis da fraqueza ao longo da aventura, só não revela ao jogador antes da ficção merecer. Sem terceiro estado ("nem o Mestre sabe ainda") — descartado.

## Questões em aberto

1. Vale reduzir `nota` a só `want`/`method` (mais perto do padrão "fato curto" do resto do ledger) e mover `trait`/`weakness`/`connection` pra quando `objective` (US-169) ou o encontro final (US-166) precisarem, em vez de tudo junto desde o turno 1? Não decidido — ver *Notas de implementação*, ajuste de prompt se o eval acusar ruído.

---

## Referências no código

- [apps/api/src/adventure-generation/seed-ledger.ts:16-89](../../../apps/api/src/adventure-generation/seed-ledger.ts) — `seedLedgerFromGeneratedAdventure`, função a estender (quarta vez, depois de US-151/170/171).
- [packages/shared/src/types/character.ts:49-76](../../../packages/shared/src/types/character.ts) — `WorldEntity`, mecanismo `revelado`/`sabido` já existente, reusado sem mudança.
- [packages/ai-engine/src/entities.ts:118-147](../../../packages/ai-engine/src/entities.ts) — `formatEntities`, já renderiza `⚠ OCULTO` pra qualquer `revelado: false`; sem mudança.
- [packages/ai-engine/src/prompts/dm-system.ts:534-608](../../../packages/ai-engine/src/prompts/dm-system.ts) — `buildTurnStateBlock`, já injeta o ledger inteiro todo turno; sem mudança.
- [US-171](./US-171-encontros-de-combate-entram-no-ledger.md) — precedente direto: mesmo padrão (`revelado: false`, extensão de `seedLedgerFromGeneratedAdventure`) aplicado a combatente de encontro.
- [US-181, Questão em aberto #2](./US-181-antagonista-ganha-want-e-method-estruturados.md) — pergunta que esta story resolve.
- [US-188](./US-188-antagonista-vira-npc-rastreavel.md) — cria `antagonist.npcId`, pré-requisito direto.
