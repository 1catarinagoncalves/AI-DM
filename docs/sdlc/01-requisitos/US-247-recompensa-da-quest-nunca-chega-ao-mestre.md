# US-247 — Recompensa da quest (`objective.reward`) e o `conclusion` que o prompt promete nunca chegam ao Mestre

**Épico:** 3 — Narração e mecânica
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** nenhuma — `objective.reward` já existe e já é gravado; `completeQuest` já existe. É questão de conectar dado que já existe à tool que já existe.
**Relacionado:** [US-169](./US-169-quest-gerada-ganha-objetivo-e-conclusao-acionavel.md) (criou `objective`/`completeQuest`) · [US-232](./US-232-schema-cresce-e-prompt-de-autoria-call-unico.md) (mudou `objective` pra objeto com `reward`, removeu `Quest.conclusionHint`) · [US-200](./US-200-item-da-ficcao-entra-no-inventario.md) (a engine que sincronizaria o item com o inventário DEPOIS que o Mestre narrasse entregá-lo — esta story resolve o passo ANTES: fazer o Mestre saber que o item existe)
**Criada em:** 2026-09-16 — achado ao mapear quais campos de `GeneratedAdventure` o DM Agent lê em jogo (ver conversa que originou esta story).

---

## História

> **Como** jogadora que completa o objetivo principal da aventura,
> **quero** que o Mestre efetivamente narre a entrega da recompensa que a própria aventura prometeu (`objective.reward`),
> **para que** o "Anel de Casca-Viva" (ou o que quer que a autoria tenha escrito) não seja uma promessa que só existe no JSON e nunca aparece na minha ficha.

---

## Contexto e motivação

### O problema observado — dois bugs no mesmo fio

**1) `objective.reward` nunca chega a prompt nenhum.** `AUTHORING_SCHEMA.objective.reward` ([ai.service.ts:160-163](../../../apps/api/src/ai/ai.service.ts)) pede um item mágico nomeado com efeito em ficção. `adventure.service.ts:277` grava `reward: authored.objective.reward` em `GeneratedAdventure.objective`. Depois disso, `objective.reward` só é tocado em três lugares: sanitização (`adventure-gate.ts:192`), exportação humana pro dump de debug (`adventure-export.ts:170,292`) e nos próprios testes. **Nenhum deles alimenta `buildDmSystemPrompt`, `buildTurnStateBlock` ou `completeQuest`.** Só `objective.description` vira `Quest.objective` ([adventure.service.ts:722](../../../apps/api/src/adventure/adventure.service.ts)) e chega ao Mestre via `## Main quest` — o item prometido fica de fora.

**2) O prompt promete um retorno que a tool não dá.** `mainQuestBody` ([dm-system.ts:656-658](../../../packages/ai-engine/src/prompts/dm-system.ts)) instrui:

> "call `completeQuest` (outcome: success/failure) and **use the `conclusion` it returns** as the BASIS for your closing narration"

Mas `completeQuest.execute` ([ai.service.ts:997-1026](../../../apps/api/src/ai/ai.service.ts)) só devolve `{ status }` ou `{ alreadyCompleted, status }` — nunca um campo `conclusion`. O Mestre é instruído a usar algo que a tool jamais entrega.

### Por que a solução atual não basta

Os dois bugs se resolvem juntos: o lugar natural para o Mestre saber da recompensa é exatamente o retorno de `completeQuest` no `outcome: 'success'` — que é também o retorno que o prompt já promete (`conclusion`) e que hoje não existe. Resolver só o primeiro sem o segundo deixaria a instrução do prompt continuar órfã; resolver só o segundo sem o `reward` deixaria o `conclusion` sem a informação mais importante que ele deveria carregar.

### A proposta

`completeQuest`, quando `outcome === 'success'` e a quest tem `Quest.objective` preenchido, passa a devolver um campo `conclusion` — string curta com o nome e o efeito da recompensa prometida (`objective.reward`), servindo de gancho pro Mestre narrar a entrega no fecho do turno. `outcome === 'failure'` não devolve recompensa (a meta não foi alcançada). Isso cumpre a promessa que `dm-system.ts:657` já faz, sem mudar o texto do prompt.

`conclusion` é dado bruto (`${reward.name}: ${reward.effect}`), sem moldura de prosa fixa em português — mesmo padrão de `composeMainQuestText` (ver *Questões em aberto* #3).

---

## Escopo

### Dentro do escopo

- `Quest` (ou o closure de `completeQuest`) precisa ter acesso a `objective.reward` no momento do `execute` — hoje `Quest.objective` (coluna `String?`) só guarda `objective.description` ([adventure.service.ts:722](../../../apps/api/src/adventure/adventure.service.ts)), perdendo `reward`. Decidir a fonte: reler `adventure.generatedAdventure.objective.reward` (já disponível no `adventure` carregado por `streamChat`, sem query nova) em vez de adicionar coluna — ver Notas de implementação.
- `completeQuest.execute`, ramo `outcome === 'success'` com `reward` disponível: monta `conclusion` (ex.: `` `${reward.name}: ${reward.effect}` `` — dado bruto, sem frase-conectivo em PT fixo, ver *Questões em aberto* #3) e devolve `{ status, conclusion }`.
- `outcome === 'failure'` ou `reward` indisponível (sistema sem motor de geração — Free/legado): devolve `{ status }` como hoje, sem `conclusion` — o Mestre já lida com a ausência (o prompt não exige o campo, só usa "se vier").
- Teste cobrindo: `completeQuest` com `outcome: 'success'` e `objective.reward` presente devolve `conclusion` contendo nome+efeito do item; `outcome: 'failure'` não devolve `conclusion`; aventura sem `generatedAdventure` (Free) não quebra.
- `pnpm eval` roda e passa (mudança no retorno de uma tool que o DM Agent consome).

### Fora do escopo

- Fazer `completeQuest` ou qualquer engine ENTREGAR o item automaticamente ao `CharacterState.inventory` — isso já é o trabalho da [US-200](./US-200-item-da-ficcao-entra-no-inventario.md) (reconciliação pós-turno por narração). Esta story só garante que o Mestre SAIBA do item e o narre; a sincronização com a ficha continua vindo da engine que já existe.
- Mudar `AUTHORING_SCHEMA.objective.reward` ou o prompt de autoria — o campo já é gerado corretamente; o problema é só que ninguém lê.
- Adicionar coluna nova ao `Quest` no Prisma — a proposta reusa `adventure.generatedAdventure` já carregado (ver Notas de implementação), evitando migração.
- Recompensa parcial ou proporcional a como o objetivo foi alcançado — `objective.reward` é um valor único, sem essa granularidade no schema hoje.

---

## Critérios de aceite

- [x] `completeQuest` com `outcome: 'success'` numa aventura com `generatedAdventure.objective.reward` presente devolve `{ status: 'COMPLETED', conclusion: <string não vazia citando reward.name e reward.effect> }`.
- [x] `completeQuest` com `outcome: 'failure'` devolve `{ status: 'FAILED' }`, sem campo `conclusion`.
- [x] `completeQuest` numa aventura sem `generatedAdventure` (caminho Free/legado) não lança erro e devolve `{ status }` sem `conclusion`.
- [x] Chamada repetida (`alreadyCompleted: true`) continua sem regressão — comportamento idempotente de hoje intacto.
- [x] **Eval / teste de regressão:** artefato com `objective.reward = { name: "Anel de Casca-Viva", effect: "..." }`, `completeQuest({ outcome: 'success' })` → `conclusion` contém "Anel de Casca-Viva"; sem esta story, `conclusion` não existe no retorno e o teste falha.
- [x] `pnpm typecheck`, `pnpm test` e `pnpm eval` passam.

---

## Notas de implementação

> *Dicas. O implementador pode divergir com boa justificativa.*

- Arquivo principal: [apps/api/src/ai/ai.service.ts:990-1027](../../../apps/api/src/ai/ai.service.ts) — `completeQuest`, tool a estender.
- **Fonte do `reward`:** `streamChat` já carrega `adventure.generatedAdventure` como `GeneratedAdventure | null` na variável `generatedAdventure` ([ai.service.ts:598](../../../apps/api/src/ai/ai.service.ts)), disponível no closure onde `completeQuest` é definido (mesmo escopo de função) — sem query nova, só ler `generatedAdventure?.objective.reward` dentro do `execute`. Confirmar antes de implementar que `generatedAdventure` está de fato no escopo léxico de `completeQuest` (ambos dentro do mesmo método de `AiService`) ou se precisa ser passado explicitamente.
- **Por que não gravar `reward` em `Quest`:** `Quest.objective` é `String?` (coluna de texto simples, [schema.prisma:171](../../../apps/api/prisma/schema.prisma)) — guardar um objeto estruturado ali é mudança de schema/migração. Reler de `adventure.generatedAdventure` (já JSON, já carregado) evita isso.
- O texto de `conclusion` é só a BASE, não a narração final — o próprio `dm-system.ts:657` já instrui "never quoting it verbatim (same discipline as any other seed text)" — o Mestre elabora em cima, não copia.
- Depois desta story, considerar (fora do escopo aqui, mas fica registrado): o `reward` entregue narrativamente cairia naturalmente na extração da [US-200](./US-200-item-da-ficcao-entra-no-inventario.md) (item que a narração diz que a personagem RECEBEU) — validar isso em QA manual quando as duas stories estiverem implementadas, mas nenhum código de US-200 precisa mudar para isso funcionar.

---

## Questões em aberto

1. Vale também expor `reward` num bloco visível todo turno (ex.: dentro de `## Main quest`, ao lado de `objective.description`) — pra o Mestre poder aludir à recompensa ANTES do fecho, não só recebê-la no momento de `completeQuest`? A US-169 já decidiu expor `objective.description` todo turno; `reward` seguir o mesmo caminho é natural, mas aumenta o texto reinjetado todo turno (mesma preocupação de custo da US-246). Proposta desta story fica só no momento de fecho (menor custo); expandir pra todo turno fica de discussão futura se o resultado narrativo pedir.
2. `outcome: 'failure'` nunca dá `reward` — mas caberia uma recompensa DIMINUÍDA ou de consolação em caso de fracasso parcial? Fora do escopo — `objective.reward` no schema de hoje não tem essa granularidade.
3. ~~O exemplo de `conclusion` embrulha texto autorado em prosa PT fixa — quebra o padrão do repo?~~ **Resolvido:** sim, quebrava. `reward.name`/`reward.effect` vêm de `generatedAdventure`, autorado no locale do dono da ficha ([buildAuthoringSystem(locale)](../../../apps/api/src/ai/ai.service.ts), EN ou PT-BR) — numa aventura EN, o reward sairia em inglês dentro de frase-conectivo fixa em português. `composeMainQuestText` ([ai.service.ts:308](../../../apps/api/src/ai/ai.service.ts)), que lida com o mesmo tipo de dado, nunca embrulha em prosa com conectivos — só concatena `title\ndescription\nobjective` cru. `conclusion` segue o mesmo padrão: `` `${reward.name}: ${reward.effect}` ``, dado bruto (ver *A proposta* e *Notas de implementação*, já atualizados).
4. ~~AC de "chamada repetida" cobre os dois casos de repetição?~~ **Resolvido:** cobre só um, e é o certo. `alreadyCompleted: true` ([ai.service.ts:1031](../../../apps/api/src/ai/ai.service.ts)) dispara quando o outcome da chamada repetida DIFERE do já gravado — é exatamente o caso já coberto por teste existente ([ai.int.test.ts:417](../../../apps/api/src/ai/ai.int.test.ts), US-169 Questão #4: `success` depois `failure` na mesma quest terminal não sobrescreve). AC #4 desta story protege ESSE teste, não escreve um novo. Chamada repetida com o MESMO outcome (`success` de nova após já `COMPLETED`) não bate o guard `alreadyCompleted` — comportamento pré-existente, sem teste hoje, fora do escopo mudar aqui. Consequência aceita: nesse caso (raro — o prompt já instrui "call this only ONCE"), `conclusion` seria gerado de novo a cada chamada repetida com sucesso; inofensivo (mesmo dado, sem side-effect novo) e não é regressão de nada testado.

---

## Referências no código

- [apps/api/src/ai/ai.service.ts:158-165](../../../apps/api/src/ai/ai.service.ts) — `AUTHORING_SCHEMA.objective.reward`.
- [apps/api/src/adventure/adventure.service.ts:275-279](../../../apps/api/src/adventure/adventure.service.ts) — montagem de `objective` (com `reward`) no `GeneratedAdventure`.
- [apps/api/src/adventure/adventure.service.ts:717-725](../../../apps/api/src/adventure/adventure.service.ts) — `Quest.create`, onde só `objective.description` sobrevive pra coluna `objective`.
- [apps/api/src/ai/ai.service.ts:598](../../../apps/api/src/ai/ai.service.ts) — `generatedAdventure`, já carregado no escopo de `streamChat`.
- [apps/api/src/ai/ai.service.ts:990-1027](../../../apps/api/src/ai/ai.service.ts) — `completeQuest`, tool a estender.
- [packages/ai-engine/src/prompts/dm-system.ts:652-658](../../../packages/ai-engine/src/prompts/dm-system.ts) — `mainQuestBody`, a instrução que promete `conclusion`.
- [apps/api/src/adventure-generation/adventure-gate.ts:192](../../../apps/api/src/adventure-generation/adventure-gate.ts) — `sanitizeProse` sobre `objective.reward.effect`, único tratamento atual.
- [apps/api/src/adventure/adventure-export.ts:170,292](../../../apps/api/src/adventure/adventure-export.ts) — único consumidor atual de `objective.reward` (export/dump humano, não IA).
