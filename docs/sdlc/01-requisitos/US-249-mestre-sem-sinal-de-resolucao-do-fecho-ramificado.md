# US-249 — Mestre não tem sinal pra reconhecer quando a ficção resolve um dos rumos de `branchedResolution`

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** 🗂️ Backlog
**Depende de:** nenhuma — `branchedResolution` já existe e já é gravado; `nextUnrevealedEncounterLocation` já estabelece o padrão de sinal-por-`revelado` que esta story reusa.
**Relacionado:** [US-169](./US-169-quest-gerada-ganha-objetivo-e-conclusao-acionavel.md) (`completeQuest`, `objective` exposto todo turno) · [US-232](./US-232-schema-cresce-e-prompt-de-autoria-call-unico.md) (introduziu `branchedResolution`; **a decisão que esta story NÃO reabre**, ver abaixo) · [US-166](./US-166-motor-gera-multiplos-encontros.md) (`nextUnrevealedEncounterLocation`, o padrão de sinal determinístico via `revelado` que esta story reusa) · [US-247](./US-247-recompensa-da-quest-nunca-chega-ao-mestre.md) (mesmo `completeQuest`, eixo diferente — recompensa vs. detecção de resolução)
**Criada em:** 2026-09-16 — a jogadora questionou por que `branchedResolution` foi descartado como fora de escopo ao mapear os gaps de `GeneratedAdventure`; a resposta revelou um eixo diferente do que a US-232 fechou, que não estava coberto.

---

## História

> **Como** jogadora chegando ao fim de uma aventura,
> **quero** que o Mestre reconheça de forma confiável quando minha ação resolveu o objetivo principal — sem hesitar nem chamar `completeQuest` cedo ou tarde demais —,
> **para que** o fecho da campanha aconteça no momento certo, mesmo quando a autoria previu vários jeitos diferentes de resolver a mesma meta.

---

## Contexto e motivação

### O problema observado

`AUTHORING_SCHEMA.branchedResolution` ([ai.service.ts:166-169](../../../apps/api/src/ai/ai.service.ts)) pede a a autoria **~`factionCount` rumos nomeados** de como a aventura pode terminar — cada um `{ choice, consequence }`. É a autoria antecipando, de propósito, que existem várias formas CONCRETAS de resolver o mesmo `objective` (no artefato de referência usado nesta investigação: purificar a pedra, entregá-la a um clã, fragmentá-la para vender, ou destruí-la — quatro ações bem diferentes, todas resolvendo "decidir o destino do Hjartasteinn").

Hoje, o Mestre que narra o turno de fecho não recebe `branchedResolution` em prompt nenhum — só `objective.description`, uma frase abstrata ("levar a Pedra-Coração ao cume e decidir seu destino"), exposta via `## Main quest` ([dm-system.ts:665-666](../../../packages/ai-engine/src/prompts/dm-system.ts)). A instrução de quando agir é igualmente genérica: "When the fiction resolves this quest... call `completeQuest`" ([dm-system.ts:657](../../../packages/ai-engine/src/prompts/dm-system.ts)). O Mestre precisa inferir, sem nenhuma âncora concreta, se a ação que a jogadora acabou de narrar ("jogo a pedra na fenda") de fato conta como resolução — mesmo a autoria já tendo escrito, no próprio artefato, que essa é EXATAMENTE uma das quatro formas reconhecidas de terminar.

### Por que isso é diferente do que a US-232 já decidiu

A US-232 fechou uma pergunta diferente: **"a tool deveria pré-escrever o fecho?"** — decisão: não, `Quest.conclusionHint` (fecho único pré-escrito) saiu do schema, `completeQuest` não recebe qual ramo aconteceu, o Mestre escreve o fecho da PRÓPRIA ficção do turno (`ai.service.ts:986-989`). Essa decisão é sobre **autoria da prosa final** — evitar que o fecho pareça computado/citado em vez de emergente.

Esta story propõe algo num eixo ortogonal: **"o Mestre tem como RECONHECER que uma resolução aconteceu?"** — não é sobre quem escreve o fecho (continua sendo o Mestre, da ficção do turno), é sobre o Mestre ter ou não uma âncora pra saber QUANDO chamar `completeQuest`. Expor só o `choice` (o rótulo da decisão, ex. "Entregar o Hjartasteinn a Ylva") sem o `consequence` (o texto de fecho pré-escrito) preserva a decisão da US-232 (nada pré-escrito chega à narração) e ainda assim dá ao Mestre o sinal que falta.

### O risco de fazer isso errado

Expor os `choice` de `branchedResolution` **desde o turno 1**, incondicionalmente, tem um efeito colateral real: o Mestre tenderia a "vender" essas opções cedo — um NPC oferecendo literalmente as mesmas 4 alternativas como menu, terminando por funilar a campanha para um dos rumos pré-escritos em vez de deixar a resolução emergir da jogatina. É o mesmo problema que a US-232 evitou ao tirar `conclusionHint` — só que multiplicado por N rumos em vez de 1. A mitigação é a mesma lógica já usada em `nextUnrevealedEncounterLocation` (US-166): sinal condicional, revelado só quando faz sentido, nunca a resposta pronta.

### A proposta

Expor `branchedResolution[].choice` (nunca `.consequence`) ao Mestre **só quando o local do `objective` já foi descoberto** (mesmo critério `revelado` que `nextUnrevealedEncounterLocation` já usa, [next-encounter-hint.ts:30-43](../../../apps/api/src/adventure-generation/next-encounter-hint.ts)) — ou seja, só na reta final, quando a jogadora já chegou ao local do desfecho. Instrução explícita: são sinais para RECONHECER quando uma ação da jogadora corresponde a um desses rumos (ou a algo no mesmo espírito), nunca falas para colocar na boca de um NPC como menu, nunca uma lista a "vender" ativamente.

---

## Escopo

### Dentro do escopo

- Nova função pura, mesmo padrão de `nextUnrevealedEncounterLocation`: dado `objective.locationId`, `locations[]` e `entities`, devolve `boolean` — o local do objetivo já está `revelado`? (Reusa a mesma resolução `locationId → título → entidade do ledger` já escrita em `next-encounter-hint.ts`.)
- `streamChat` ([ai.service.ts](../../../apps/api/src/ai/ai.service.ts)), ao montar `turnState`: quando essa função devolve `true` **e** a quest primária ainda está `OPEN`, passa `branchedResolution.map(r => r.choice)` para `buildTurnStateBlock`.
- `buildTurnStateBlock` ([dm-system.ts:548](../../../packages/ai-engine/src/prompts/dm-system.ts)) ganha uma seção condicional (mesmo padrão de `nextEncounterSection`) listando os `choice` recebidos, com instrução explícita: reconhecer quando a ficção do turno corresponde a um deles (ou a uma variação no mesmo espírito) e então chamar `completeQuest`; NUNCA oferecer a lista como menu de opções pro jogador, NUNCA citar os rótulos literalmente na narração.
- Quest já `COMPLETED`/`FAILED` → seção não aparece (mesmo padrão de `mainQuestBody` já checar `!isTerminal` implicitamente via `activeQuests`/status).
- Teste cobrindo: local do objetivo não revelado → seção ausente; revelado + quest `OPEN` → seção presente com os `choice`, sem `consequence`; quest já terminal → seção ausente mesmo com local revelado.
- `pnpm eval` roda e passa (mudança em prompt do DM Agent).

### Fora do escopo

- Expor `consequence` — permanece intocado, fora de qualquer prompt de jogo (decisão da US-232, não reaberta).
- `completeQuest` passar a receber/gravar QUAL `choice` aconteceu — continua sem esse parâmetro (mesma decisão da US-232). Esta story só ajuda o Mestre a saber QUANDO chamar a tool, não o QUE gravar.
- Aventuras sem `branchedResolution` (caminho Free/legado, sem motor de geração) — seção simplesmente não aparece, sem novo campo obrigatório.
- Resolver a "Questão em aberto #2" da US-248 (se `completeQuest` um dia capturar o rumo) — mencionada lá como evolução futura; esta story não decide isso.

---

## Critérios de aceite

- [ ] Local do `objective` ainda não `revelado` no ledger → o bloco de rumos de fecho NÃO aparece no `turnState`, em nenhum turno.
- [ ] Local do `objective` já `revelado` e quest primária `OPEN` → o bloco aparece, listando cada `branchedResolution[].choice` — e NENHUM `consequence`.
- [ ] Quest primária já `COMPLETED` ou `FAILED` → o bloco não aparece, mesmo com o local revelado.
- [ ] O texto da instrução deixa explícito que a lista é para RECONHECIMENTO, nunca para oferecer como opção ao jogador nem para citar literalmente na narração.
- [ ] Aventura sem `generatedAdventure` (Free/legado) não quebra — bloco ausente, sem exigir `branchedResolution`.
- [ ] **Eval / teste de regressão:** artefato com `objective.locationId = 'loc-6'`, local `loc-6` marcado `revelado: true` no ledger, `branchedResolution` com 4 `choice` → `turnState` contém os 4 rótulos e nenhum dos 4 `consequence`; sem esta story, nenhum dos dois aparece (ausência total é o comportamento de hoje, então o teste de regressão é: com a story, os `choice` aparecem quando deveriam).
- [ ] `pnpm typecheck`, `pnpm test` e `pnpm eval` passam.

---

## Notas de implementação

> *Dicas. O implementador pode divergir com boa justificativa.*

- Arquivo principal pro sinal: [apps/api/src/adventure-generation/next-encounter-hint.ts](../../../apps/api/src/adventure-generation/next-encounter-hint.ts) — considerar adicionar a nova função pura NESTE arquivo (mesmo domínio: sinais determinísticos derivados de `revelado`), não um arquivo novo.
- `objective.locationId` → título via `locations[]` (mesmo `Map` que `nextUnrevealedEncounterLocation` já monta) → checar se esse título está em `entities.filter(e => e.revelado).map(e => e.nome)`. Mesma função auxiliar pode inclusive ser refatorada pra reusar essa resolução `locationId → revelado`, se o implementador achar que compensa (dedupe entre as duas funções) — não obrigatório.
- Arquivo do prompt: [packages/ai-engine/src/prompts/dm-system.ts:548-670](../../../packages/ai-engine/src/prompts/dm-system.ts) — `buildTurnStateBlock` ganha o novo parâmetro opcional (ex.: `resolutionSignals?: string[] | null`) e a seção condicional, no mesmo estilo de `nextEncounterSection` (texto de "sinal, não obrigação").
- Cuidado com o texto da instrução: o mesmo tom de `nextEncounterSection` ("You MAY... never force it") serve de modelo — aqui o verbo certo é RECONHECER, não "guiar a cena pra lá". A diferença de intenção (orientação de exploração vs. detecção de fecho) deveria ficar clara na redação.
- `streamChat` já calcula `nextEncounter`/`nextEncounterLocationTitle` no mesmo trecho ([ai.service.ts:693-702](../../../apps/api/src/ai/ai.service.ts)) — o cálculo do sinal desta story pode entrar ao lado, reusando `generatedAdventure`/`entities` já carregados, sem query nova.

---

## Questões em aberto

1. O sinal deveria aparecer só quando o local do `objective` é `revelado`, ou também quando TODOS os encontros já foram descobertos (sinal de "a aventura estruturalmente chegou ao fim", mesmo que o local específico do objetivo ainda não)? A proposta usa só o local do objetivo por ser o critério mais direto e já ter mecanismo pronto (`next-encounter-hint.ts`); revisar se, em produção, isso aparece tarde ou cedo demais.
2. Vale medir em QA/eval se o texto de instrução ("reconheça, não ofereça como menu") é suficiente pra evitar o funil, ou se precisa de reforço mais forte (ex.: proibição explícita de um NPC listar as opções em sequência)? Só observável com narração real — mesmo precedente de QA manual das US-168/US-245.

---

## Referências no código

- [apps/api/src/ai/ai.service.ts:166-169](../../../apps/api/src/ai/ai.service.ts) — `AUTHORING_SCHEMA.branchedResolution`.
- [apps/api/src/ai/ai.service.ts:986-989](../../../apps/api/src/ai/ai.service.ts) — comentário da US-232, a decisão que esta story NÃO reabre (tool não recebe/pré-escreve qual ramo aconteceu).
- [apps/api/src/adventure-generation/next-encounter-hint.ts:30-43](../../../apps/api/src/adventure-generation/next-encounter-hint.ts) — `nextUnrevealedEncounterLocation`, o padrão de sinal-por-`revelado` a reusar.
- [apps/api/src/ai/ai.service.ts:693-702](../../../apps/api/src/ai/ai.service.ts) — onde `nextEncounter`/`nextEncounterLocationTitle` já são calculados no mesmo turno; o novo sinal entra ao lado.
- [packages/ai-engine/src/prompts/dm-system.ts:642-666](../../../packages/ai-engine/src/prompts/dm-system.ts) — `nextEncounterSection`/`mainQuestBody`, os dois padrões de seção condicional que esta story combina.
- [US-247](./US-247-recompensa-da-quest-nunca-chega-ao-mestre.md) — mesma tool (`completeQuest`), eixo diferente (recompensa entregue no sucesso vs. detecção de quando chamar a tool).
