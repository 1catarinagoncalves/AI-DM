# US-189 — Antagonista entra no ledger e chega ao Mestre durante o turno

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** [US-181](./US-181-antagonista-ganha-want-e-method-estruturados.md) (`antagonist: { name, want, method, trait, weakness }`) · [US-183](./US-183-antagonista-ganha-conexao-pessoal-com-personagem.md) (`antagonist.connection`) · [US-188](./US-188-antagonista-vira-npc-rastreavel.md) (`antagonist.npcId` — esta story precisa saber qual `id` excluir de `npcEntities`/`encounterNpcEntities` pra não duplicar o antagonista como três entidades diferentes no mesmo ledger)
**Relacionado:** [US-151](./US-151-semear-ledger-segredos-gerados.md) (dona original de `seedLedgerFromGeneratedAdventure`) · [US-170](./US-170-locais-gerados-entram-no-ledger.md)/[US-171](./US-171-encontros-de-combate-entram-no-ledger.md) (mesmo padrão exato — `revelado: false`, ✅ implementadas — esta story é a QUARTA a estender a mesma função) · [US-181, Questão em aberto #2](./US-181-antagonista-ganha-want-e-method-estruturados.md) (*"o antagonista estruturado deve virar pista dosada no ledger... ou fica só disponível a `conclusion`/`objective`? Não decidido"* — esta story É a resposta) · [US-169](./US-169-quest-gerada-ganha-objetivo-e-conclusao-acionavel.md) (`objective`, consumidor independente do artefato — não precisa do ledger pra funcionar, mas passa a coexistir com ele)
**Criada em:** 2026-08-21 — achado ao revisar US-181/182/183 com a mantenedora: as três stories estruturam `want`/`method`/`trait`/`weakness`/`connection` só dentro do artefato gerado (`GeneratedAdventure`), consumido em `generateAdventure()` e nunca mais. Nenhum desses campos é injetado em `buildTurnStateBlock` nem em `Adventure.entities` (o ledger) — o Mestre, rodando o turno, não tem acesso a motivo/método/traço/fraqueza/conexão do antagonista, só ao que `conclusion`/`objective` (US-169, quando implementada) citarem depois de prontos.

---

## História

> **Como** jogadora,
> **quero** que o Mestre já saiba, desde o início da aventura, o que o antagonista quer e como ele age — mesmo sem eu ter descoberto isso ainda —,
> **para que** a narração possa semear pistas e comportamento consistentes com o vilão real da aventura, em vez de só "descobrir" quem ele é no parágrafo de fechamento.

---

## Contexto e motivação

### O que existe hoje

- `seedLedgerFromGeneratedAdventure` ([seed-ledger.ts:16-70](../../../apps/api/src/adventure-generation/seed-ledger.ts)) constrói `WorldEntity[]` a partir de `secrets`/`npcs`/`locations`/`encounters` do artefato gerado — quatro fontes, quatro mapeamentos (`secretEntities`, `npcEntities`, `locationEntities`, `encounterNpcEntities`). Nenhuma leitura de `antagonist` (campo que só existirá após US-181).
- `WorldEntity` ([character.ts:49-76](../../../packages/shared/src/types/character.ts)) já tem exatamente o mecanismo certo pra isso: `revelado?: boolean` — `false` = "verdade do mundo que o Mestre mantém só pra não se contradizer, mas NÃO revela ao jogador até a ficção merecer" (comentário da linha 68-69). `formatEntities` ([entities.ts:130](../../../packages/ai-engine/src/entities.ts)) já renderiza isso como `⚠ OCULTO — verdade do mundo, NÃO revele ao jogador ainda` no bloco de turno. Este é o MESMO mecanismo que segredos (US-151), locais (US-170) e combatentes de encontro (US-171) já usam — nenhuma peça nova.
- `buildTurnStateBlock` ([dm-system.ts:534-608](../../../packages/ai-engine/src/prompts/dm-system.ts)) já lê `entities` (o ledger inteiro) todo turno e injeta com a instrução *"this ledger is YOUR global view; the world does NOT share it"* ([dm-system.ts:599](../../../packages/ai-engine/src/prompts/dm-system.ts)) — o canal já existe e já é o lugar certo pra informação que o Mestre sabe mas não deve vazar cedo.
- Se `antagonist.npcId` (US-188) apontar pra um `AdventureNpc` normal dentro de `npcs[]`, ele cairia automaticamente em `npcEntities` ([seed-ledger.ts:30-39](../../../apps/api/src/adventure-generation/seed-ledger.ts)) — que marca `revelado: true` pra TODO NPC não-combatente. Isso REVELARIA o antagonista ao jogador desde o turno 1, o oposto do que a US-153 (Questão em aberto #4) e a própria US-181 (*Fora do escopo*, "exposição ao Mestre durante o turno... mesma disciplina que já protege `conclusion` de vazar antes da hora") pedem.
- Se `antagonist.npcId` também estiver em `encounters[<final>].npcIds` (US-188), ele cairia TAMBÉM em `encounterNpcEntities` ([seed-ledger.ts:54-67](../../../apps/api/src/adventure-generation/seed-ledger.ts)) — uma segunda entrada, `nome: "${antagonist.trait} (${antagonist.npcId})"`, `nota` só com o `role`/`trait`, sem `want`/`method`/`weakness`/`connection`.

### O problema

Sem esta story: (a) o Mestre não tem acesso a `want`/`method`/`trait`/`weakness`/`connection` durante o turno — só quando `conclusion` (fim da aventura) ou `objective` (US-169, futuro) citarem; (b) se US-188 for implementada primeiro, o antagonista aparece no ledger DUAS vezes com informação incompleta e `revelado: true` num dos casos — exatamente o vazamento que US-153/US-181 tentam evitar.

### Por que a solução atual não basta

Nenhuma das stories de antagonista (US-181/182/183/188) toca `seedLedgerFromGeneratedAdventure` — todas param no artefato. O canal que já existe pra "o Mestre sabe, o jogador ainda não" (`revelado: false`, US-151/170/171) simplesmente nunca é usado pro antagonista.

### A proposta

`seedLedgerFromGeneratedAdventure` ganha uma quinta fonte — `antagonistEntity`, UM `WorldEntity` sintetizado direto de `adventure.antagonist` (não de `npcs[]`): `tipo: 'npc'`, `nome: antagonist.name`, `nota` reunindo `want`/`method`/`trait`/`weakness`/`connection`, `local` = título do local do encontro final (mesmo `locationTitleById` que a função já usa), `revelado: false` — mesma disciplina exata de `encounterNpcEntities` (US-171). Em paralelo, os dois mapeamentos existentes que iterariam `antagonist.npcId` por engano (`npcEntities`, `encounterNpcEntities`) passam a EXCLUIR esse `id`, pra não duplicar.

---

## Escopo

### Dentro do escopo

- `seedLedgerFromGeneratedAdventure` ([seed-ledger.ts](../../../apps/api/src/adventure-generation/seed-ledger.ts)) ganha `antagonistEntity: WorldEntity` — um único `WorldEntity`, não array (só existe UM antagonista por aventura):
  ```ts
  const antagonistEntity: WorldEntity = {
    nome: adventure.antagonist.name,
    tipo: 'npc',
    local: locationTitleById.get(
      adventure.encounters[adventure.encounters.length - 1]!.locationId,
    ),
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
- `npcEntities` ([seed-ledger.ts:30-39](../../../apps/api/src/adventure-generation/seed-ledger.ts)) ganha uma segunda condição no `.filter`: `npc.id !== adventure.antagonist.npcId` — o antagonista não entra mais como NPC narrativo comum (`revelado: true`).
- `encounterNpcEntities` ([seed-ledger.ts:54-67](../../../apps/api/src/adventure-generation/seed-ledger.ts)) ganha o mesmo filtro no `.map`/`.filter` de `npcId` — o `id` do antagonista não vira uma SEGUNDA entrada genérica de combatente.
- Função devolve `[...secretEntities, ...npcEntities, ...locationEntities, ...encounterNpcEntities, antagonistEntity]`.
- Teste de regressão em `seed-ledger.test.ts`: artefato com `antagonist` preenchido → ledger tem EXATAMENTE uma entrada com `nome === antagonist.name`, `revelado: false`, `nota` contendo `want`/`method`/`trait`/`weakness`/`connection`; `antagonist.npcId` NÃO aparece em nenhuma outra entrada do ledger.
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

- [ ] `seedLedgerFromGeneratedAdventure` devolve exatamente um `WorldEntity` com `nome === adventure.antagonist.name`, `tipo: 'npc'`, `revelado: false`.
- [ ] `nota` dessa entrada contém `want`/`method`/`trait`/`weakness`/`connection` (as cinco informações, formato livre).
- [ ] `local` dessa entrada é o título do local do encontro final (`encounters[encounters.length - 1].locationId` → `locations[].title`).
- [ ] `antagonist.npcId` NÃO aparece em `npcEntities` (filtro adicional).
- [ ] `antagonist.npcId` NÃO aparece em `encounterNpcEntities` (filtro adicional) — mesmo quando é o único `npcId` do encontro final (caso de nível baixo, US-188).
- [ ] **Teste de regressão:** fixture com `antagonist` completo (US-181/183/188) → ledger final tem exatamente 1 entrada do antagonista, nenhuma duplicata; `revelado: false`.
- [ ] **Eval:** narração de turno inicial reflete tensão/comportamento coerente com o antagonista sem nomeá-lo nem vazar `weakness`, mesma regra `⚠ OCULTO`.
- [ ] `pnpm typecheck`, `pnpm test` e `pnpm eval` passam.

---

## Notas de implementação

- Pontos exatos: [seed-ledger.ts:16-70](../../../apps/api/src/adventure-generation/seed-ledger.ts) (função inteira — `locationTitleById` já existe na linha 18, reusar), linhas 30-39 (`npcEntities`, ganha filtro), linhas 54-67 (`encounterNpcEntities`, ganha filtro).
- `nota` com as cinco frases concatenadas é deliberadamente verboso pra ESTE `WorldEntity` — mais longo que o padrão "fato durável curto" do resto do ledger (comentário de `WorldEntity.nota`, [character.ts:56](../../../packages/shared/src/types/character.ts)), porque é a ÚNICA fonte de `want`/`method`/`trait`/`weakness`/`connection` que o Mestre tem durante o turno; se o eval mostrar que o bloco fica ruidoso, ajuste é ENCURTAR a síntese (ex.: só `want`+`method` na `nota`, `trait`/`weakness`/`connection` num campo próprio se um dia o schema justificar), não critério fechado aqui.
- Esta story só faz sentido implementada DEPOIS de US-188 — sem `antagonist.npcId`, não há o que excluir de `npcEntities`/`encounterNpcEntities`, e o antagonista vazaria como NPC comum assim que US-181 sozinha for implementada (o campo `antagonist` existe, mas nada no ledger sabe que ele é especial). Se por algum motivo US-188 atrasar, esta story ainda pode ser feita de forma mais simples — sem os dois filtros de exclusão — DESDE que `antagonist.npcId` não exista/não esteja em `npcs[]`/`encounters[].npcIds` ainda (nesse caso não há duplicata possível).
- Mudança indireta em prompt do DM Agent (mais uma entidade no ledger todo turno) — rodar `pnpm eval` depois (`AGENTS.md`).

---

## Questões em aberto

1. `weakness` no ledger significa que o Mestre "sabe" o ponto fraco desde o turno 1 — isso é o comportamento desejado (Mestre pode semear pistas sutis da fraqueza ao longo da aventura) ou deveria nascer com um terceiro estado ("nem o Mestre sabe ainda", revelado só quando `objective`/US-169 o expuser)? Decisão adotada nesta story: Mestre sabe desde o início (mesmo padrão de segredo/local — `revelado: false` é sobre o JOGADOR, não sobre o Mestre) — ajustável se o produto quiser um terceiro eixo, não decidido aqui.
2. Vale reduzir `nota` a só `want`/`method` (mais perto do padrão "fato curto" do resto do ledger) e mover `trait`/`weakness`/`connection` pra quando `objective` (US-169) ou o encontro final (US-166) precisarem, em vez de tudo junto desde o turno 1? Não decidido — ver *Notas de implementação*, ajuste de prompt se o eval acusar ruído.

---

## Referências no código

- [apps/api/src/adventure-generation/seed-ledger.ts:16-70](../../../apps/api/src/adventure-generation/seed-ledger.ts) — `seedLedgerFromGeneratedAdventure`, função a estender (quarta vez, depois de US-151/170/171).
- [packages/shared/src/types/character.ts:49-76](../../../packages/shared/src/types/character.ts) — `WorldEntity`, mecanismo `revelado`/`sabido` já existente, reusado sem mudança.
- [packages/ai-engine/src/entities.ts:118-147](../../../packages/ai-engine/src/entities.ts) — `formatEntities`, já renderiza `⚠ OCULTO` pra qualquer `revelado: false`; sem mudança.
- [packages/ai-engine/src/prompts/dm-system.ts:534-608](../../../packages/ai-engine/src/prompts/dm-system.ts) — `buildTurnStateBlock`, já injeta o ledger inteiro todo turno; sem mudança.
- [US-171](./US-171-encontros-de-combate-entram-no-ledger.md) — precedente direto: mesmo padrão (`revelado: false`, extensão de `seedLedgerFromGeneratedAdventure`) aplicado a combatente de encontro.
- [US-181, Questão em aberto #2](./US-181-antagonista-ganha-want-e-method-estruturados.md) — pergunta que esta story resolve.
- [US-188](./US-188-antagonista-vira-npc-rastreavel.md) — cria `antagonist.npcId`, pré-requisito direto.
