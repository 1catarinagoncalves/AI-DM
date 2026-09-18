# US-256 — Jogador entra na tela de chat antes do resto da aventura terminar de gerar

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada) — desenho decidido em 2026-09-18 (autoria em duas chamadas, opção C); restam 3 questões de implementação
**Depende de:** [US-255](./US-255-start-reordenado-apos-locais-nomeados.md) (✅ Implementada — `start` já é o último campo antes de `challenges`, então fecha a fatia inicial) · [US-234](./US-234-gate-regenera-on-fail-com-saneamento.md) (gate + regenera-on-fail — passa a rodar só sobre o resto, ver *Decisão*) · [US-235](./US-235-gatilho-assincrono-tela-de-espera-erro-retry.md) (gatilho assíncrono + polling que esta story adianta)
**Relacionado:** [backlog-motor-de-geracao-de-aventuras.md](./backlog-motor-de-geracao-de-aventuras.md) (MA-1/MA-4/MA-5, o desenho que esta story evolui — o diagrama de lá diz "UMA chamada", ver *Decisão*) · [US-257](./US-257-abertura-narra-identidade-do-personagem.md) (✅ — acrescentou `generateIntroNarration` em `Promise.all` com `generateOpeningNarration` dentro de `finalizeGeneratedAdventure`; a liberação antecipada desta story precisa cobrir as DUAS chamadas, não só a abertura)
**Criada em:** 2026-09-17 — desmembrada da US-255 original a pedido da mantenedora, pra reordenação do campo (pronta pra implementar) não ficar presa atrás de uma decisão de arquitetura ainda em aberto.
**Atualizada em:** 2026-09-18 — (a) referências de linha e Escopo revisados após a implementação da US-257, que mexeu exatamente nas funções que esta story referencia (`finalizeGeneratedAdventure` cresceu de ~90 para ~150 linhas, `generateAdventureAuthoring` deslocou ~80 linhas em `ai.service.ts`); (b) Questão em aberto #1 decidida pela mantenedora: **opção C, duas chamadas de autoria** — Escopo, Notas e Critérios reescritos em cima dela; a descrição original da opção B tinha uma premissa que o código não sustenta (ver *Decisão*); (c) lacuna fechada: as transações de liberação e final concorriam por `Adventure.status` — agora há junção (`Promise.allSettled`) e só `runAdventureGeneration` grava o estado terminal (Notas: *Ordem das transações*).

---

## História

> **Como** jogadora,
> **quero** ver a abertura da minha aventura assim que o gancho (`start`) estiver pronto, sem esperar locais/desafios/encontros/objetivo/fecho ramificado terminarem de gerar,
> **para que** a espera entre criar o personagem e começar a jogar caia pro tempo da fatia inicial da autoria + narração da abertura, não da autoria inteira + gate + narração de abertura + extração de cena.

---

## Contexto e motivação

### O caminho de espera hoje

`createForCharacter` já é assíncrono (US-235): a `Adventure` nasce em `GENERATING` e o controller devolve na hora; quem acompanha é o polling do frontend (`pollAdventureStatus`, [SetupWizard.tsx:1011](../../../apps/web/src/components/setup/SetupWizard.tsx)), que só sai do loop quando o status vira `ACTIVE`. Entre `GENERATING` e `ACTIVE` hoje cabe, em série:

1. `generateAdventure` → **uma** chamada bloqueante (`generateObject`, [ai.service.ts:1653](../../../apps/api/src/ai/ai.service.ts)) que só resolve quando o objeto INTEIRO (`world`…`followUps`, 12 campos) sai pronto — com escada de modelos (`authoringModels`) se um falhar.
2. O gate (US-234, `generateWithGate`) pode **regenerar a CHAMADA 1 inteira** até `maxAttempts` (3) vezes se `parse`/grafo/orçamento/saneamento reprovar.
3. `finalizeGeneratedAdventure` ainda faz MAIS duas chamadas de LLM em PARALELO — `generateOpeningNarration` e `generateIntroNarration` (US-257, `Promise.all`, [adventure.service.ts:749-797](../../../apps/api/src/adventure/adventure.service.ts), não soma latência entre si) — seguidas de uma TERCEIRA em série, `extractOpeningScene` ([adventure.service.ts:806](../../../apps/api/src/adventure/adventure.service.ts)) — antes de gravar e virar `ACTIVE`.

O jogador só vê a tela de chat depois de TODA essa cadeia. O `start` é conteúdo que já existe muito antes do fim dela — é só a chamada 1 que não expõe nada até acabar por inteiro.

### Por que reordenar o campo (US-255) não basta sozinho

`generateAdventureAuthoring` usa `generateObject` — chamada **atômica**: o SDK só devolve o `object` quando o JSON inteiro fecha. A US-255 muda a ORDEM em que o modelo escreve os campos, mas ninguém do lado de fora enxerga nada até a `Promise` inteira resolver. Pra liberar a jogadora assim que `start` existir, precisa haver uma **fronteira observável** entre "fatia inicial pronta" e "resto": ou dentro de uma chamada (streaming, opção B) ou entre duas chamadas (opção C, a escolhida).

---

## Decisão: autoria em duas chamadas (opção C) — 2026-09-18

A chamada de autoria se parte em duas. A fatia inicial (1A) é gerada, saneada e liberada; o resto (1B) é gerado em segundo plano tendo a fatia como contexto **fixo**.

```text
CHAMADA 1A — fatia:  world · summary · story · factions · npcs · locations · start
  └─ minting da fatia → saneamento da fatia → ledger da fatia
       ├─ ramo N — narração: generateOpeningNarration ∥ generateIntroNarration → extractOpeningScene
       │    └─ transação de liberação: estado novo + `authoredSlice` + ledger + EventLogs (INTRODUCTION + NARRATION)
       │       ⇒ a jogadora entra no chat
       └─ ramo R — em paralelo, sem esperar a narração:
          CHAMADA 1B — resto:  challenges · encounters · objective · branchedResolution · followUps
             (a fatia inteira entra no prompt como contexto fixo)
             └─ minting do resto + backstops de `occupants` + PASSO 2 → gate completo (US-234) sobre o artefato mesclado
                  ├─ ok → devolve o artefato mesclado (NÃO grava nada)
                  └─ reprovou → regenera SÓ a 1B (teto `maxAttempts`); esgotou → devolve a falha (NÃO grava nada)

JUNÇÃO — `Promise.allSettled([ramo N, ramo R])`; só depois dela `runAdventureGeneration` grava o estado terminal:
  ├─ N ok + R ok        → transação final: `generatedAdventure` + Quest primária + ledger enriquecido → ACTIVE
  ├─ N ok + R falhou    → FAILED pós-liberação (Questão #4)
  └─ N lançou           → FAILED sem liberação — a jogadora ainda está no wizard, tela de erro+retry da US-235 como hoje
```

### Por que C, e não B nem A

- **A — aceitar o risco:** descartada. Libera cedo e aceita que a aventura persistida seja outra que a jogadora viu.
- **B — gate parcial + `streamObject`:** dois problemas, ambos achados lendo o código:
  1. **O gate parcial não tem o que checar.** `checkNoOrphans` ([adventure-gate.ts:116-146](../../../apps/api/src/adventure-generation/adventure-gate.ts)) ancora local e NPC em `encounters`, `challenges` e `objective` — todos DEPOIS de `start`. Sobre a fatia só cabem o parse e `checkOccupantReferences`, e os dois já passam por construção (Zod no `generateObject`; o minting filtra índice fora de faixa, [adventure.service.ts:289](../../../apps/api/src/adventure/adventure.service.ts)). Orçamento de encontro e catálogo de perícia (`checkEncounterBudget`, `checkSkillCatalog`) também dependem de campos posteriores. A descrição original da B ("`checkNoOrphans` só sobre `factions`/`npcs`/`locations`") reprovaria quase todo local sem `occupants`.
  2. **`generateWithGate` re-semeia a CHAMADA 1 INTEIRA** ([adventure-gate.ts:275-282](../../../apps/api/src/adventure-generation/adventure-gate.ts)) — reprovar depois da liberação gera mundo, NPCs e locais DIFERENTES com a jogadora já no chat. Congelar a fatia é exatamente a C; a B chegaria lá por cima de `streamObject`, com régua nova de escada pra falha no meio do stream e de timeout.

### O que a C entrega por construção

- **A fatia liberada é imutável.** Gate reprovado regenera só a 1B; mundo, NPCs, locais e gancho que a jogadora viu são os do artefato final.
- **Escada de modelos e `AbortSignal.timeout` valem por chamada**, como hoje. Falha na 1B nunca deixa estado parcial órfão vindo de dentro de uma chamada, porque nada é liberado a partir dela.
- **Sem `streamObject`.** `seedLedgerFromGeneratedAdventure` recebe fatia completa (schema próprio dela), não artefato parcial.
- **O polling e o gatilho assíncrono da US-235 ficam quase intactos** — muda quando o estado é publicado, não como é consultado.

### Custo assumido

- Um round-trip a mais e o prefill da fatia no prompt da 1B; dois prompts e dois schemas pra manter. **A latência total não foi medida** — o ganho da story é justamente cortar a espera percebida, então o spike (Critérios) mede 1A, 1B e o total contra a chamada única de hoje antes de implementar o resto.
- A 1B perde a variação que o reseed dava à chamada inteira (ver Notas: `attempt`).
- Reabre o "call único" da US-232/MA-1 — mas o que aquela decisão consolidou foram os 6 `generate*` encadeados (US-158/166/190…) num só; duas chamadas com contexto estável entre elas não trazem os passos soltos de volta. O diagrama do backlog e o docstring de `generateAdventureAuthoring` ([ai.service.ts:1618](../../../apps/api/src/ai/ai.service.ts), "call ÚNICO, D5") passam a estar desatualizados e são revisados na implementação.

---

## Escopo

### Dentro do escopo

- **Spike de latência antes do resto** ([`apps/api/scripts/run-authoring.ts`](../../../apps/api/scripts/run-authoring.ts)): tempo da 1A, da 1B e o total contra a chamada única atual. Define o `AUTHORING_TIMEOUT_MS` de cada metade e confirma que o ganho existe.
- Partir `AUTHORING_SCHEMA` em `AUTHORING_SLICE_SCHEMA` (`world`, `summary`, `story`, `factions`, `npcs`, `locations`, `start`) e `AUTHORING_REST_SCHEMA` (`challenges`, `encounters`, `objective`, `branchedResolution`, `followUps`), mantendo os `.describe()` de cada campo. `buildAuthoringSystem`/`buildAuthoringPrompt` também se partem; a linha "Emita na ordem: …" do prompt atual ([ai.service.ts:303](../../../apps/api/src/ai/ai.service.ts)) já diverge da ordem real do schema e precisa ser reescrita de qualquer jeito.
- `generateAdventureAuthoring` → `generateAdventureSlice` + `generateAdventureRest(slice)`, cada uma com sua escada `authoringModels` e seu timeout.
- Extrair de `generateAdventure` ([adventure.service.ts:219-416](../../../apps/api/src/adventure/adventure.service.ts), ~200 linhas) o minting da fatia (facções/NPCs/locais) e o do resto (desafios/encontros/objetivo + backstops de `occupants` + PASSO 2), como funções nomeadas — a divisão da chamada é o ponto natural pra cumprir a regra de função ≤20 linhas que essa função já viola.
- Sanear a fatia ANTES de narrar: hoje o gate final é quem limpa `world.description`, `story`, `start`, `summary` e `locations[].boxedText/description` (`sanitizeProse`, [adventure-gate.ts:205-218](../../../apps/api/src/adventure-generation/adventure-gate.ts)) antes de a abertura ver o texto. A garantia "narração só recebe texto saneado" tem que sobreviver à divisão.
- Ledger em duas fases: semear com a fatia na liberação; na conclusão, enriquecer a `nota` dos locais com os segmentos de encontro/desafio e o `local` dos NPCs com os `occupants` finais — o que `seedLedgerFromGeneratedAdventure` ([seed-ledger.ts:58-81](../../../apps/api/src/adventure-generation/seed-ledger.ts)) hoje faz numa passada só.
- Estado novo da `Adventure` + transação de liberação (nome e semântica: Questão #2) e transação final (`generatedAdventure`, Quest primária, ledger enriquecido, `ACTIVE`).
- `runAdventureGeneration` orquestra: 1A → `Promise.allSettled([narração + liberação, 1B + gate])` → transação final (ou `FAILED`). Os dois ramos NÃO gravam `status` terminal; só `runAdventureGeneration`, depois da junção (ver Notas: *Ordem das transações*). O gate (US-234) roda inteiro sobre o mesclado; o reseed re-executa SÓ a 1B.
- Frontend: `pollAdventureStatus` aceita o estado novo e a tela de chat trata "resto ainda gerando" (política de turnos e de falha: Questões #3 e #4).

### Fora do escopo

- **`streamObject`/`partialObjectStream`** — descartado junto com a opção B.
- **Mudar a instrução de `generateOpeningNarration`/`generateIntroNarration`.** As instruções não mudam, mas um insumo muda: o `entities` (ledger) que a abertura recebe deixa de trazer os segmentos de encontro/desafio dos locais, porque a fatia não os tem (hoje traz, via `seedLedgerFromGeneratedAdventure`). Avaliar no eval da abertura (US-257) — se piorar, decidir à parte; não é desta story.
- **Streaming da narração de abertura em si pro chat** (efeito "digitando") — discussão separada de UX de chat.
- **Dividir a autoria em mais de duas chamadas.**
- **Multiplayer** — fora da fase 1.

---

## Questões em aberto

1. ~~**O que fazer quando o gate (US-234) reprova o resto do artefato DEPOIS que a jogadora já viu a abertura?**~~ **Decidido: C, duas chamadas de autoria** (2026-09-18). Ver *Decisão* acima.

2. **Nome e semântica do estado novo da `Adventure`.** Recomendação: **`OPENING_READY`**, não `ACTIVE` mais cedo. Enquanto `ACTIVE` continuar significando "aventura pronta por inteiro", os invariantes que os consumidores assumem valem: `generatedAdventure` preenchido e Quest primária existente (`completeQuest` lança sem ela, [ai.service.ts:1028-1030](../../../apps/api/src/ai/ai.service.ts)). Custo: todo consumidor de `status` aprende o estado novo. Auditados no código hoje:
   - `pollAdventureStatus` ([SetupWizard.tsx:1016-1021](../../../apps/web/src/components/setup/SetupWizard.tsx)) — passa a resolver em `OPENING_READY`;
   - hub de personagens ([character.service.ts:597](../../../apps/api/src/character/character.service.ts)) só lista aventura `ACTIVE` — a jogadora que sair do chat antes do fim não veria "continuar";
   - `updateMany where status: 'ACTIVE'` que fecha a aventura anterior ao criar outra ([adventure.service.ts:586 e 649](../../../apps/api/src/adventure/adventure.service.ts)) — não pegaria uma `OPENING_READY`;
   - enum Prisma ([schema.prisma:148-157](../../../apps/api/prisma/schema.prisma)) + migração `ALTER TYPE … ADD VALUE`, mesmo molde da `20260915120000_us235_adventure_async_status`;
   - `getGenerationStatus` ([adventure.service.ts:894](../../../apps/api/src/adventure/adventure.service.ts)) devolve a string crua — não precisa mudar.

3. **O que a jogadora pode fazer no chat enquanto a 1B gera?** Um turno na janela roda degradado: sem `tone`/`setting`/`areaType` ([ai.service.ts:717-720](../../../apps/api/src/ai/ai.service.ts), lidos de `generatedAdventure.registry`), sem sinal de próximo encontro (`:727`), sem `mainQuest` (`:636`), e `completeQuest` lançaria. Recomendação: **bloquear o envio de turno até `ACTIVE`** — input desabilitado com aviso na UI **e** guard no backend (`streamChat` recusa status ≠ `ACTIVE`; o guard é o que vale, a UI é conveniência). A jogadora lê introdução + abertura enquanto o resto termina. Bônus: sem turno na janela, o enriquecimento do ledger na transação final não concorre com `recordEntity`. Alternativa descartada: deixar jogar degradado (o Mestre contradiria o que a 1B ainda vai autorar).

4. **Falha da 1B depois da liberação, e onde a fatia mora até lá.** Estourou o teto do gate ou a 1B lançou: a jogadora já saiu do wizard, então a tela de erro+retry da US-235 não a alcança. Recomendação: `FAILED` + aviso no chat com "tentar de novo" que re-executa SÓ a 1B contra a fatia persistida — barato justamente porque a fatia é imutável. Isso exige persistir a fatia: `generatedAdventure` é lido com cast pra `GeneratedAdventure` completo em todo turno, então guardar objeto parcial nele seria uma armadilha. Recomendação: coluna nova `Adventure.authoredSlice Json?` (migração junto com o enum da Questão #2), preenchida na transação de liberação. A mesma coluna cobre o dyno que reinicia com a 1B no meio (o comentário de [SetupWizard.tsx:995](../../../apps/web/src/components/setup/SetupWizard.tsx) já assume que isso acontece): o chat precisa de um teto de espera como o `STATUS_POLL_TIMEOUT_MS` do wizard, e "estourou o teto" ≠ "falhou" (consulta final antes de declarar).

---

## Critérios de aceite

Os marcados com (Q#) dependem da recomendação daquela questão ser aceita; se ela mudar, o critério muda junto.

- [ ] **Spike:** tempo de 1A, 1B e total medidos contra a chamada única atual, com `run-authoring.ts`, em execuções suficientes pra ver a dispersão; resultado registrado nesta story. O resto só segue se o total percebido (chamada 1A + narração + extração) for claramente menor que a cadeia de hoje.
- [ ] `AUTHORING_SLICE_SCHEMA` tem exatamente `world`, `summary`, `story`, `factions`, `npcs`, `locations`, `start`; `AUTHORING_REST_SCHEMA` tem os outros cinco. Teste de regressão de chaves (`Object.keys(schema.shape)`, mesmo molde da US-255) e de que a união cobre todos os campos do artefato final, sem perder nem duplicar campo.
- [ ] O prompt da 1B contém o nome de toda facção, NPC e local da fatia (teste sobre `buildAuthoringPrompt` da 1B).
- [ ] Gate reprovado re-executa só a 1B: com fake class nomeada pro `AiService`, `generateAdventureSlice` é chamada 1× e `generateAdventureRest` até `maxAttempts` vezes.
- [ ] Fatia imutável: `world.name`, `npcs[].name` e `locations[].title` da fatia liberada são idênticos aos do `generatedAdventure` final (teste de regressão, com 1B reprovando uma vez antes de passar).
- [ ] `generateOpeningNarration` e `generateIntroNarration` só recebem texto saneado: fatia com número de mecânica vazado na prosa chega limpa às duas (teste).
- [ ] **Paridade do ledger:** o ledger em duas fases (fatia na liberação + enriquecimento na conclusão) é igual ao de `seedLedgerFromGeneratedAdventure` numa passada só sobre o mesmo artefato, exceto `atualizadoEm` (teste de propriedade sobre uma fixture completa).
- [ ] **Ordem das transações:** com fake class nomeada, (a) 1B + gate resolvem ANTES da narração → estado final `ACTIVE`; (b) a 1B falha ANTES da narração terminar → estado final `FAILED`. Nunca `OPENING_READY` no fim, e `authoredSlice` gravado nos dois casos.
- [ ] Estado novo (Q2): `pollAdventureStatus` resolve em `OPENING_READY`; migração aplicada; hub e `updateMany` de fechamento auditados e cobertos por teste ou justificados.
- [ ] Turno em `OPENING_READY` é recusado no backend e o input fica desabilitado na UI (Q3).
- [ ] Falha da 1B pós-liberação leva a `FAILED` com "tentar de novo" que re-executa só a 1B a partir de `authoredSlice`; teto de espera no chat cobre o dyno reiniciado (Q4).
- [ ] `pnpm typecheck`, `pnpm test` e `pnpm eval` passam.

---

## Notas de implementação

- **`attempt` e as rolagens.** Hoje `attempt` re-rola `registry`, `factionCount`, `namingRegister` e `questSeed` ([adventure.service.ts:228-231](../../../apps/api/src/adventure/adventure.service.ts)) — é a variação que o reseed dá ao prompt. Todas pertencem à 1A (o `registry` gravado no artefato final é o da 1A). Depois da liberação a 1B NÃO pode re-rolar nada: ela só re-amostra. Como o prompt da 1B não depende de `attempt` hoje (`combatBudget`/`combatCast` vêm de `level`/`challenge`), o retry dela é "cego" — se o gate passar a reprovar por causa determinística do prompt, tentar de novo não corrige. Vale olhar o motivo das reprovações no log `adventure_gate_failed` ([adventure-gate.ts:243](../../../apps/api/src/adventure-generation/adventure-gate.ts)) depois de ligar a story. Reseed da 1A ANTES da liberação continua como hoje (`attempt + 1`), já que nada foi mostrado.
- **Ordem das transações: junção antes de gravar o estado terminal.** A liberação (ramo N) e o resultado da 1B (ramo R) rodam concorrentes e ambos mexem em `Adventure.status`. Sem junção há dois ordenamentos que perdem estado: (a) 1B + gate acabam ANTES da narração/extração e a liberação sobrescreve `ACTIVE` com `OPENING_READY`; (b) a 1B falha rápido, `FAILED` é gravado, e a liberação (mais lenta) o sobrescreve com `OPENING_READY` — a aventura fica presa e o erro some. Por isso o ramo R só DEVOLVE o resultado (artefato ou falha) e quem grava `ACTIVE`/`FAILED` é `runAdventureGeneration`, depois de `Promise.allSettled`. Efeitos colaterais desejáveis: a transação final nunca corre com a de liberação, e `authoredSlice` (Questão #4) já está gravado quando o "tentar de novo" precisa dele. Custo: quando a 1B termina antes da narração, `ACTIVE` espera a narração — o spike mede qual ramo costuma ser o último. Alternativa descartada: guarda `updateMany where status: 'GENERATING'` em cada transação — evita o overwrite, mas deixa o resultado do ramo que perdeu a corrida sem dono (um `FAILED` ignorado, por exemplo).
- **Backstops de `occupants` só acrescentam.** O backstop de local órfão e o de NPC encalhado ([adventure.service.ts:338-367](../../../apps/api/src/adventure/adventure.service.ts)) fazem `loc.occupants = [...loc.occupants, …]`, então rodar na 1B, depois da liberação, não contradiz o que a jogadora leu: no máximo um NPC passa a estar também noutro local.
- **Introdução e abertura rodam ANTES da liberação, juntas** (mesmo `Promise.all` de hoje) — resolve a pendência que a US-257 deixou nesta story. As duas só dependem de `summary`, `start`, `registry` e do ledger, todos disponíveis na fatia; adiar a introdução exigiria inserir o `EventLog` `INTRODUCTION` com `createdAt` anterior ao da `NARRATION` já exibida (a ordem estável hoje vem do `createdAt` explícito, [adventure.service.ts:855-862](../../../apps/api/src/adventure/adventure.service.ts)).
- **`generationModel` passa a ter dois candidatos** (arm da 1A e arm da 1B podem diferir na escada). Campo opcional do schema compartilhado, usado pra comparar qualidade entre modelos ([adventure-generation.ts:147-149](../../../packages/shared/src/types/adventure-generation.ts)) — decidir na implementação qual grava (ou os dois).
- **Timeout por chamada.** `AUTHORING_TIMEOUT_MS` (240 s, [ai.service.ts:350](../../../apps/api/src/ai/ai.service.ts)) foi dimensionado pra chamada única (110–150 s medidos, comentário `:343-349`). Cada metade merece o valor que o spike indicar; `maxTokens: 16000` (comentário `:1626-1628`) existe por truncamento em modelo verboso e deve ser revisto pelo mesmo motivo.
- **Sem fila.** A 1B roda como continuação da mesma promise solta de `runAdventureGeneration` (`void this.runAdventureGeneration(...)`, [adventure.service.ts:694](../../../apps/api/src/adventure/adventure.service.ts)) — mesma premissa da US-235 (instância única no Render Free, sem BullMQ/Redis).
- Se o tipo da fatia morar em `packages/shared`, `pnpm --filter @ai-dm/shared build` depois de editar (roda de `dist`); idem `@ai-dm/ai-engine` se seções de prompt compartilhadas mudarem.

---

## Referências no código

- [`apps/api/src/ai/ai.service.ts:116-178`](../../../apps/api/src/ai/ai.service.ts) — `AUTHORING_SCHEMA` (a partir); `:186` `buildAuthoringSystem`, `:226` `buildAuthoringPrompt`, `:350` `AUTHORING_TIMEOUT_MS`.
- [`apps/api/src/ai/ai.service.ts:1633-1672`](../../../apps/api/src/ai/ai.service.ts) — `generateAdventureAuthoring`, vira `generateAdventureSlice` + `generateAdventureRest`.
- [`apps/api/src/adventure/adventure.service.ts:219-416`](../../../apps/api/src/adventure/adventure.service.ts) — `generateAdventure`: minting da fatia em `:270-292`, do resto em `:306-330`, backstops em `:338-367`, PASSO 2 em `:385-396`; `generateGatedAdventure` em `:424-439`.
- [`apps/api/src/adventure/adventure.service.ts:706-886`](../../../apps/api/src/adventure/adventure.service.ts) — `runAdventureGeneration` (706) / `finalizeGeneratedAdventure` (735): `Promise.all` de abertura+introdução em `:749-797`, `extractOpeningScene` em `:806`, `$transaction` em `:812-873`.
- [`apps/api/src/adventure-generation/adventure-gate.ts`](../../../apps/api/src/adventure-generation/adventure-gate.ts) — gate US-234: `runAdventureGate` (40), `checkNoOrphans` (116), `sanitizeProse` (205), `generateWithGate` (267).
- [`apps/api/src/adventure-generation/seed-ledger.ts`](../../../apps/api/src/adventure-generation/seed-ledger.ts) — `seedLedgerFromGeneratedAdventure`, a partir em duas fases.
- [`apps/api/prisma/schema.prisma:148-157`](../../../apps/api/prisma/schema.prisma) — enum `AdventureStatus`.
- [`apps/web/src/components/setup/SetupWizard.tsx:1011`](../../../apps/web/src/components/setup/SetupWizard.tsx) — `pollAdventureStatus`, onde o frontend passa a aceitar o estado antecipado (chamador em `:1062-1065`).
- [`apps/api/src/character/character.service.ts:597`](../../../apps/api/src/character/character.service.ts) — hub só lista `ACTIVE`.
- [`apps/api/scripts/run-authoring.ts`](../../../apps/api/scripts/run-authoring.ts) — runner do spike de latência.
- [US-255](./US-255-start-reordenado-apos-locais-nomeados.md) — pré-requisito: posição do `start` no schema.
- [US-257](./US-257-abertura-narra-identidade-do-personagem.md) — implementada depois desta story ser escrita; acrescentou `generateIntroNarration` ao mesmo trecho que esta story reestrutura.
