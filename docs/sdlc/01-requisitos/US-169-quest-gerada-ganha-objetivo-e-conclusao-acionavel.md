# US-169 — Quest gerada ganha objetivo concreto e o Mestre passa a poder concluí-la

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada (2026-08-22) — código + testes unitários/eval determinístico verdes; `test:int`
(completeQuest contra Postgres real) e `pnpm eval` de qualidade de narração (US-36, chaves de API)
NÃO rodaram nesta sessão, ver nota abaixo.
**Depende de:** [US-181](./US-181-antagonista-ganha-want-e-method-estruturados.md) ✅ implementada (`antagonist.want`/`antagonist.method`/`trait`/`weakness`/`connection` confirmados em `AdventureAntagonistSchema`, [adventure-generation.ts:65-69](../../../packages/shared/src/types/adventure-generation.ts) — `objective` já pode citar motivo/método desde a primeira versão) · [US-190](./US-190-antagonista-vira-passo-proprio-entre-segredos-e-encontros.md) ✅ implementada (`generateClosing` já RECEBE `antagonist` como parâmetro pronto, não coproduz mais — confirmado em [ai.service.ts:1626-1636](../../../apps/api/src/ai/ai.service.ts) e na chamada em [adventure.service.ts:251-261](../../../apps/api/src/adventure/adventure.service.ts)). Nenhuma dependência bloqueia mais esta story.
**Relacionado:** [US-153](./US-153-aventura-deixa-de-ser-derivada-da-classe.md) (dono de `Quest.title`/`Quest.description` como estão hoje; *Questões em aberto* #4 já adiou `conclusion` explicitamente pra "consumo futuro") · [US-164](./US-164-orquestrador-motor-monta-aventura-gerada.md) (`generateClosing`, a função que ganha o campo novo) · [US-168](./US-168-abertura-narra-gancho-fixo-nao-aventura-gerada.md) (mexe nos mesmos arquivos — `buildOpeningInstruction`, `buildTurnStateBlock`, região de `generateClosing`/`createForCharacter`; sequenciar depois dela evita conflito de merge, mas não é bloqueio técnico: os dois campos que faltam — `objective` aqui, `mainQuest`/`entities` lá — são independentes) · [US-183](./US-183-antagonista-ganha-conexao-pessoal-com-personagem.md) (`antagonist.connection` — insumo adicional disponível pra `objective` quando existir; esta story não exige, só ganha se `connection` já estiver no `antagonist` recebido) · [US-166](./US-166-motor-gera-multiplos-encontros.md) (mexe na MESMA região de `generateClosing`/`adventure.service.ts` — `encounterSkeleton`/`encounterSituations`; sem dependência técnica com `objective`, mas mesmo cuidado de merge que US-168 já registra acima)
**Criada em:** 2026-08-18 — achado ao revisar `generateAdventure()` com a mantenedora: `summary` é só o TIPO da missão ("Rescue an NPC", rótulo cru da tabela `1d20quests`), `start` é o gancho fixo por classe — nenhum dos dois amarra a um alvo concreto da aventura REALMENTE gerada (ex.: "ajudar Marta", "acabar com o culto da Enseada Cinzenta"). E mesmo que amarrasse, não existe hoje nenhum tool que deixe o Mestre marcar a quest como concluída — `Quest.status` existe no schema e nunca é escrito.
**Atualizada em:** 2026-08-21 — amarra explícita à US-190 (antagonista vira passo próprio): corrige a suposição de que `antagonist` nasce na MESMA chamada que `objective` — `generateClosing` passa a RECEBER `antagonist`, não coproduzi-lo. Conteúdo de `objective` não muda, só a mecânica de onde `antagonist` vem. Soma referência a US-183 (`connection`, insumo opcional) e nota de conflito de merge com US-166 (mesma região de código, sem dependência técnica).
**Atualizada em:** 2026-08-22 — checagem contra o código atual: US-181, US-183, US-190 e US-166 já estão MERGED (nenhuma dependência resta). Nada do escopo desta story (`objective`, `conclusionHint`, `completeQuest`, colunas novas em `Quest`) existe ainda — confirmado por grep (zero ocorrências de `objective`/`conclusionHint`/`completeQuest` em `ai.service.ts`, `adventure.service.ts` e `schema.prisma`). Todas as referências de linha desta story foram refrescadas pro código atual (números antigos ficaram defasados por US-166/US-175/US-190, que mexeram nas mesmas funções). Achado novo: `enum EventType` (`schema.prisma:144-150`) já tem `QUEST_UPDATE`, não usado em lugar nenhum hoje — alternativa a `CHARACTER_UPDATE` pro `EventLog` do `completeQuest` (a proposta original, linha 53, ainda usa `CHARACTER_UPDATE` "mesmo padrão de `updateScene`"; troca é decisão de implementação, não critério de aceite).
**Atualizada em:** 2026-08-22 (2) — revisão preditiva de bugs antes da implementação (nenhum código ainda existe, achados abaixo são análise de risco contra o código atual + a proposta desta story). Cinco achados viraram *Notas de implementação* novas; um virou *Questão em aberto* nova (idempotência com `outcome` trocado entre chamadas).
**Atualizada em:** 2026-08-22 (3) — implementação. Todos os itens do Escopo entregues; decisão de implementação
tomada: `EventLog` do `completeQuest` usa `CHARACTER_UPDATE` (texto original desta story), não `QUEST_UPDATE`
(a alternativa citada na nota de 2026-08-22) — mantém o mesmo guard de edição de turno (US-67) que já cobre
`updateCharacterHp`/`updateScene`; quest completada é mutação de estado tão significativa quanto as outras
duas. `pnpm typecheck`, `pnpm test` (todo o monorepo) e `pnpm eval` passam verdes. Dois itens do critério de
aceite NÃO puderam ser verificados nesta sessão, por falta de infraestrutura, não por decisão de escopo:
- `apps/api/src/ai/ai.int.test.ts` ganhou 4 casos novos para `completeQuest` (mesmo padrão de
  `updateCharacterHp`/`recordEntity`) mas `pnpm test:int` exige `TEST_DATABASE_URL` (Postgres efêmero local),
  ausente neste ambiente — os casos não foram executados, só escritos e revisados.
- As duas linhas "Eval" do critério de aceite (`completeQuest` chamado quando o jogador cumpre o `objective`,
  e NÃO chamado quando não cumpre) dependem de um Mestre real decidindo — `evals/cases` é determinístico por
  convenção do repo (ver US-38: "a obediência do modelo depende do LLM e não roda aqui"; harness de N turnos
  contra Mestre real é US-94, backlog). `evals/cases/us-169-completar-quest.ts` cobre a parte determinística
  (o prompt instrui a chamada certa, `conclusionHint` nunca vaza fora do tool) — a obediência do modelo em si
  fica sem cobertura automatizada, mesmo status que todo o resto do DM Agent hoje.

---

## História

> **Como** jogador que cumpriu o objetivo real da aventura gerada para o meu personagem,
> **quero** que o Mestre reconheça isso e narre um desfecho coerente com o que o motor já preparou,
> **para que** a aventura tenha um fim reconhecível em vez de ficar `OPEN` para sempre, com o Mestre narrando cenas soltas sem nunca saber que "acabou".

---

## Contexto e motivação

### O que existe hoje

- `GeneratedAdventureSchema` ([adventure-generation.ts:77-90](../../../packages/shared/src/types/adventure-generation.ts)) tem `summary` (tipo curto, ex. `"Rescue an NPC"`), `start` (gancho fixo por classe), `conclusion` (prosa de fecho) e `followUps` — mas nenhum campo diz QUEM precisa ser resgatado, QUAL culto precisa cair. Essa informação existe, espalhada, dentro de `npcs[].role`/`secrets[].text`/`locations[]`, nunca sintetizada.
- `Quest.title = generated.summary`, `Quest.description = generated.start` ([adventure.service.ts:483-490](../../../apps/api/src/adventure/adventure.service.ts)) — o comentário na própria US-153 já documentou isso como INTENCIONALMENTE incompleto: *"`adventure.conclusion` não alimenta nenhum campo de `Quest` nesta story: usá-lo como descrição vazaria o desfecho antes do jogo começar; fica no artefato disponível pra consumo futuro"* (US-153, Questões em aberto #4). Esta story É esse consumo futuro.
- `Quest.status` ([schema.prisma:117](../../../apps/api/prisma/schema.prisma), enum `OPEN`/`COMPLETED`/`FAILED`) nunca é escrito em lugar nenhum de `apps/api/src` — confirmado por grep: o único uso é `quest.findMany({ where: { adventureId, status: 'OPEN' } })` em [ai.service.ts:545-546](../../../apps/api/src/ai/ai.service.ts). Toda quest fica `OPEN` para sempre; `completedAt` nunca é preenchido.
- O DM Agent não tem NENHUM tool de conclusão de quest. Os tools existentes (`updateScene`, `recordEntity`, `updateCharacterHp`, `updateInventory`, `rollDice`, `getSpell`, `const tools = {...}` em [ai.service.ts:703](../../../apps/api/src/ai/ai.service.ts)) cobrem estado de cena/personagem, nenhum cobre progresso de missão.
- `generateClosing` ([ai.service.ts:1626-1659](../../../apps/api/src/ai/ai.service.ts)) já roda DENTRO de `generateAdventure()` ([adventure.service.ts:194](../../../apps/api/src/adventure/adventure.service.ts), chamada em [adventure.service.ts:251-261](../../../apps/api/src/adventure/adventure.service.ts)) com `locations`, `npcs`, `secrets`, `registry`, `complicacao` E `antagonist` (US-190, já pronto) em mãos — é o único ponto do motor que já viu a aventura inteira antes dela começar. Hoje ele devolve `conclusion`+`followUps`+`encounterSituations` (US-166); ainda sem `objective`.

### O problema

Mesmo com um objetivo concreto sintetizado, não há como o Mestre AGIR sobre ele: sem tool, sem status gravável, sem o texto de `conclusion` acessível num turno qualquer (ele nasce em `generateAdventure()`, não sobrevive à criação — nem a `Quest`, nem a nenhuma outra tabela). O jogador pode cumprir o objetivo da aventura e o jogo nunca vai saber.

### A proposta

1. `generateClosing` ganha um campo novo no seu retorno — `objective: string` — um objetivo concreto e verificável, sintetizado a partir de `locations`/`npcs`/`secrets`/`complicacao`/`antagonist` (US-181 — `want`/`method`, não só `name`) (ex.: `"Impedir que Malvora drene a vila de Enseada Cinzenta pra alimentar seu ritual"`), na mesma chamada de IA que já produz `conclusion`/`followUps` (nenhum round-trip novo — `antagonist` chega como PARÂMETRO de `generateClosing`, US-190, não é mais coproduzido nessa chamada).
2. `GeneratedAdventureSchema` ganha `objective: z.string().min(1)` — cai automaticamente sob o gate da US-150 (`GeneratedAdventureSchema.parse`), sem checagem nova.
3. `Quest` ganha duas colunas: `objective String` (o texto novo, exposto ao Mestre todo turno) e `conclusionHint String` (= `generated.conclusion`, guardado mas NUNCA exposto em `buildTurnStateBlock` — só devolvido pelo tool novo quando o Mestre chama).
4. Tool novo `completeQuest` em `ai.service.ts` (mesmo padrão de `updateScene`/`recordEntity`): o Mestre chama quando a fdefinição JULGA que o objetivo foi cumprido ou fracassado na fábula; `execute` grava `status`/`completedAt` na quest primária e DEVOLVE `conclusionHint` — o texto que o motor já escreveu pra esse desfecho — pro Mestre expandir na narração do MESMO turno (mesma disciplina de "não citar verbatim" que `buildOpeningInstruction` já usa pro `hookSeed`).
5. `buildTurnStateBlock`/`## Main quest` passa a mostrar `objective` (não só `title`+`description`) — dá ao Mestre o alvo concreto pra reconhecer quando foi atingido.

---

## Escopo

### Dentro do escopo

- `generateClosing` (`ai.service.ts`) e o schema Zod do seu `generateObject` interno ganham `objective`.
- `GeneratedAdventureSchema` (`packages/shared`) ganha `objective: z.string().min(1)`.
- Migração Prisma: `Quest.objective String?`, `Quest.conclusionHint String?` (opcionais — confirmado no Neon em 2026-08-20: 6 quests já existem, todas `OPEN`; NOT NULL exigiria placeholder fictício nelas, ver Notas).
- `createForCharacter` (`adventure.service.ts`) grava `objective: generated.objective`, `conclusionHint: generated.conclusion` no `tx.quest.create`.
- Novo tool `completeQuest` (`ai.service.ts`, mesma seção dos outros tools): parâmetros `{ outcome: 'success' | 'failure', reason?: string }`; localiza a quest `isPrimary: true` da aventura corrente, atualiza `status` (`COMPLETED`/`FAILED`) e `completedAt`, grava `EventLog` tipo `CHARACTER_UPDATE` (mesmo padrão de `updateScene`) com `reason` no `payload` (sem coluna nova em `Quest`), devolve `{ conclusion: quest.conclusionHint }`. Se `status` já for terminal e o `outcome` recebido for DIFERENTE do gravado, NÃO sobrescreve (decidido, Questão em aberto #4) — devolve `{ alreadyCompleted: true, status: quest.status, conclusion: quest.conclusionHint }` em vez de atualizar.
- `buildTurnStateBlock` (`dm-system.ts`): `## Main quest` passa a incluir `objective` junto de `title`/`description`; instrução do bloco de ofício ganha uma linha dizendo ao modelo pra chamar `completeQuest` quando a fábula resolver o objetivo — e a usar o texto devolvido como base da narração de fecho (sem citar verbatim, mesmo padrão do `hookSeed`).
- `activeQuests`/quests secundárias (`isPrimary: false`) NÃO ganham objetivo/tool nesta story — só a primária.
- Teste de regressão (estrutural, sem chamada de modelo): fixture com `antagonist.want`/`antagonist.method` preenchidos e um `objective` gerado que cite só `antagonist.name` → teste FALHA (heurística mínima: `objective` deve conter alguma palavra de `want` ou `method` além do nome; ajuste de heurística é implementação, não critério fechado, mas a checagem em si é obrigatória). Ver critério de aceite dedicado acima — evita que a dependência da US-181 vire só prosa esquecível.
- Eval/teste de regressão: cenário onde a ação do jogador cumpre claramente o `objective` gerado → confirma que o modelo chama `completeQuest`, que `Quest.status` vira `COMPLETED` no banco, e que a narração do turno referencia o `conclusion` sem citá-lo palavra por palavra.
- Eval/teste de regressão: cenário onde o jogador NÃO cumpriu o objetivo ainda → confirma que `completeQuest` NÃO é chamado (falso positivo é pior que um final tardio).

### Fora do escopo

- Quests secundárias (`activeQuests`, `isPrimary: false`) ganharem objetivo/tool de conclusão — o motor de geração (US-164) não produz quests secundárias hoje; sem fonte, sem escopo aqui.
- Detecção automática/mecânica de conclusão (ex.: contar HP do vilão a zero) — a decisão continua sendo julgamento narrativo do modelo, como todo o resto do DM Agent.
- Fim de sessão/tela de resumo no frontend quando a quest fecha — puramente backend+prompt nesta story.
- Mudar `summary`/`start`/`followUps` ou a tabela `1d20quests` — ficam como estão; `objective` é um campo NOVO, não substitui nenhum.
- Encadear automaticamente uma nova aventura quando a atual fecha — `Adventure.status` já vira `COMPLETED` na criação da PRÓXIMA aventura ([adventure.service.ts:320-323](../../../apps/api/src/adventure/adventure.service.ts)), esta story não mexe nesse fluxo, só na `Quest`.

---

## Critérios de aceite

- [x] `generateClosing` devolve `objective` além de `conclusion`/`followUps`, sintetizado a partir de `locations`/`npcs`/`secrets`/`complicacao` já disponíveis na chamada.
- [x] **`objective` cita `antagonist.want`/`antagonist.method` (US-181), não só `antagonist.name`** — critério de aceite próprio, não só nota de implementação: teste de regressão falha se o texto de `objective` reduzir o antagonista ao nome (ex. rejeita `"Impedir Malvora"` sozinho como saída válida de fixture; aceita `"Impedir que Malvora drene a vila pra alimentar seu ritual"`, que referencia `want`/`method`). Sem este critério, a dependência da US-181 fica só documentada em prosa (ver *Notas de implementação*) e pode ser esquecida na implementação.
  Instrução no system de `generateClosing` ([ai.service.ts:1699](../../../apps/api/src/ai/ai.service.ts)); heurística de regressão `objectiveCitesWantOrMethod` + 3 casos em `ai.service.test.ts`.
- [x] `GeneratedAdventureSchema.parse` exige `objective` — falha o gate (US-150) se ausente, mesmo tratamento de reseed que qualquer outro campo obrigatório.
- [x] `Quest` (schema.prisma) ganha `objective String?` e `conclusionHint String?`; migração escrita
  (`prisma/migrations/20260822120000_us169_quest_objective_conclusion_hint`) e `prisma generate` rodado —
  **NÃO aplicada** a nenhum banco real (Neon) nesta sessão: aplicar migração é ação de infraestrutura
  compartilhada, fora do que um agente decide sozinho. Rodar `prisma migrate deploy` antes do próximo deploy.
- [x] `createForCharacter` grava os dois campos na criação da quest primária.
- [x] Tool `completeQuest` existe, aceita `outcome: 'success' | 'failure'` (desistência/fuga/abandono do objetivo conta como `failure`) e `reason?: string` opcional, atualiza `status`/`completedAt` da quest primária da aventura corrente, grava `EventLog` (com `reason` no `payload`, se enviado), devolve `conclusionHint`.
- [x] Se a quest primária já tem `status` terminal e chega `outcome` DIFERENTE do gravado, `completeQuest` NÃO sobrescreve `status`/`completedAt` — devolve `{ alreadyCompleted: true, status: quest.status, conclusion: quest.conclusionHint }` (Questão em aberto #4).
- [x] `## Main quest` no turn state block mostra `objective`.
- [x] Instrução de ofício no system prompt diz ao modelo pra chamar `completeQuest` ao reconhecer o objetivo cumprido/fracassado, e usar o `conclusion` devolvido como base (não verbatim) da narração de fecho.
- [ ] **Eval:** ação do jogador cumpre o `objective` → `completeQuest` chamado, `Quest.status = COMPLETED` no banco, narração referencia o `conclusion` sem repeti-lo literalmente. NÃO coberto — depende de um Mestre real decidindo, fora do que `evals/cases` testa por convenção do repo (US-38). `evals/cases/us-169-completar-quest.ts` cobre só a parte determinística (prompt correto, sem vazamento). Fica pendente do harness da US-94.
- [ ] **Eval:** objetivo ainda não cumprido → `completeQuest` NÃO chamado (sem falso positivo). Mesma pendência acima.
- [x] `pnpm eval` passa (mudança em prompt do DM Agent).

---

## Notas de implementação

- `objective` deve nascer JÁ referenciando nomes concretos do artefato gerado (o NPC pelo nome, o vilão/facção pelo nome) — senão vira só uma paráfrase de `summary` e não resolve o problema original (ex.: "Ajudar Marta" é melhor que "Ajudar uma NPC").
- **Depende de US-181 (decisão de ordem, 2026-08-20):** `objective` deve citar `antagonist.want`/`antagonist.method` — não só `antagonist.name` — desde a primeira implementação ("Impedir que Malvora drene a vila pra alimentar seu ritual" é melhor que só "Impedir Malvora"). Implementar US-169 antes da US-181 produziria um `objective` mais pobre (só nome) que precisaria de retrabalho de prompt assim que `antagonist` existisse — mais barato inverter a ordem agora do que reabrir esta story depois.
- **Depende de US-190 (2026-08-21):** `antagonist` deixa de ser coproduzido na mesma chamada de `generateClosing` — passa a chegar PRONTO, de `generateAntagonist` (chamada anterior, sequencial, antes do `Promise.all`). Pra `objective`, isso não muda o CONTEÚDO (ainda cita `want`/`method`), só a mecânica: `generateClosing` lê `params.antagonist.want`/`method` em vez de gerar `antagonist` e `objective` juntos no mesmo `generateObject`. Sem custo extra de round-trip pra ESTA story especificamente — o round-trip de `generateAntagonist` já é custo da US-190, não desta.
- Migração do `Quest`: `objective`/`conclusionHint` são `String?` opcionais — confirmado no Neon (2026-08-20): 6 quests já existem, todas `status = OPEN`, sem valor óbvio pra preencher retroativamente. NOT NULL exigiria placeholder fictício nessas 6 linhas; opcional evita isso.
- `completeQuest`, ao devolver `conclusionHint`, pode receber `null` pra essas 6 quests legadas (criadas antes desta story) — o Mestre não tem desfecho pré-escrito pra elas; tratar como "sem hint disponível", não como erro.
- **Achado 2026-08-22 — leak de `"null"` literal pro prompt:** `mainQuest` ([ai.service.ts:575](../../../apps/api/src/ai/ai.service.ts)) hoje é `${primary.title}\n${primary.description}`. Se a implementação concatenar `primary.objective` sem guard (ele é `String?`, `null` nas 6 quests legadas), o texto `"null"` vaza literal no `## Main quest` do turn state pra essas 6 aventuras. Guard obrigatório: `primary.objective ? \`\n${primary.objective}\` : ''` (mesmo cuidado que `conclusionHint` já tem acima).
- **Achado 2026-08-22 — `completeQuest` sem quest primária:** `findFirst({ adventureId, isPrimary: true })` pode devolver `null` (estado inconsistente, ex.: falha silenciosa na criação). O tool deve lançar erro com o valor ofensivo (`adventureId`) e o que era esperado — convenção do projeto (AGENTS.md, "mensagem de exceção inclui o valor ofensor") — nunca deixar o `update` seguinte quebrar em `undefined.id`.
- **Achado 2026-08-22 — schema Zod sozinho não basta:** adicionar `objective` só ao `CLOSING_SCHEMA` (o schema Zod interno do `generateObject`) não garante que o texto cite `want`/`method` — o `system` prompt de `generateClosing` ([ai.service.ts:1644-1652](../../../apps/api/src/ai/ai.service.ts)) precisa de instrução explícita nesse sentido, senão o critério de aceite dedicado (linha 73, "cita `want`/`method`, não só `name`") falha no teste de regressão.
- **Achado 2026-08-22 — reseed rate sobe:** `objective: z.string().min(1)` é mais um campo obrigatório no `GeneratedAdventureSchema.parse` (gate US-150) — aumenta a chance de falha/reseed em produção. Não é bloqueio, é efeito colateral esperado; vale monitorar custo/latência de geração depois do deploy.
- `completeQuest` segue o MESMO padrão de idempotência que `recordEntity` SE o `outcome` repetir: se chamado duas vezes com o MESMO `outcome` (ex.: o modelo "confirma" a conclusão em dois turnos seguidos por engano), o segundo `update` é inofensivo (mesmo `status`, `completedAt` reescrito) — não precisa de guarda especial. **Outcome TROCADO entre chamadas é guard À PARTE (decidido, Questão em aberto #4):** se `status` já for terminal (`COMPLETED`/`FAILED`) e chegar um `outcome` DIFERENTE do gravado, `completeQuest` REJEITA — não sobrescreve `status`/`completedAt`, devolve `{ alreadyCompleted: true, status: quest.status, conclusion: quest.conclusionHint }`.
- Cuidado com o texto de `conclusionHint` na resposta do tool: ele SÓ deve chegar ao modelo depois de `completeQuest` ser chamado, nunca antes (nem em `buildTurnStateBlock`, nem em nenhum bloco passivo) — é exatamente o vazamento que a US-153 (Questões em aberto #4) evitou de propósito ao não gravar `conclusion` em `Quest.description`.
- **Achado 2026-08-22 — atomicidade não é regressão nova:** `completeQuest` faz dois writes sequenciais (`quest.update` + `eventLog.create`) sem `$transaction` — falha entre os dois dessincroniza `status` e o log. Isso NÃO é um defeito introduzido por esta story: `updateScene` já faz exatamente o mesmo (`characterState.upsert` + `eventLog.create` sem transação, [ai.service.ts:851-871](../../../apps/api/src/ai/ai.service.ts)) — é o padrão aceito no codebase pros tools do DM Agent. Seguir o mesmo padrão aqui é consistência, não um bug novo pra corrigir fora de escopo.
- Arquivo principal: [ai.service.ts](../../../apps/api/src/ai/ai.service.ts) — `generateClosing` (~1626-1659), novo tool `completeQuest` (dentro de `const tools = {...}`, ~703; ao lado de `updateScene`, ~830).
- Segundo arquivo: [dm-system.ts](../../../packages/ai-engine/src/prompts/dm-system.ts) — `buildTurnStateBlock` (~650-654, bloco `## Main quest`).
- Terceiro arquivo: [adventure.service.ts](../../../apps/api/src/adventure/adventure.service.ts) — `tx.quest.create` (~483-490).
- Mudança em prompt do DM Agent — rodar `pnpm eval` depois (custa chamadas reais de LLM, ver `AGENTS.md`).

---

## Questões em aberto

1. ~~`completeQuest` deve aceitar UM `outcome` só (sucesso/fracasso), ou também um `reason: string` livre pro modelo registrar COMO terminou?~~ **Decidido (mantenedora, 2026-08-20): sim, adicionar `reason: string` opcional.** Custo é baixo — não vai em coluna nova de `Quest` (evita migração pra campo que ninguém lê ainda), vai no `payload` (`Json`, já livre) do `EventLog` que `completeQuest` grava. Sem leitura em runtime hoje, mas fica pronto pro dia que `followUps` for consumido por uma aventura futura sem precisar reabrir esta story.
2. ~~Existe caso onde a aventura deveria encerrar SEM o jogador "vencer" explicitamente (ex.: ele foge, abandona) — isso conta como `failure` ou precisa de um terceiro outcome?~~ **Decidido (mantenedora, 2026-08-20): desistência conta como `failure`.** Sem `ABANDONED` no schema — `outcome: 'failure'` cobre tanto derrota quanto abandono/fuga do objetivo. `completeQuest` deve ser chamado também quando o jogador claramente desiste do objetivo primário (foge, recusa continuar, muda de rumo de forma irreversível), não só quando é derrotado na fábula.
3. ~~Migração de dados — depende de quantas aventuras já existem no Neon com `Quest` sem os campos novos.~~ **Decidido (checado no Neon, 2026-08-20): 6 quests existentes, todas `OPEN`.** `objective`/`conclusionHint` viram `String?` opcionais — sem migração de dados fictícia.
4. ~~`completeQuest` chamado duas vezes com `outcome` DIFERENTE (ex.: `success` num turno, `failure` num turno seguinte) — o segundo `update` deve SOBRESCREVER ou REJEITAR?~~ **Decidido (2026-08-22): REJEITA.** Se a quest primária já tem `status` terminal (`COMPLETED`/`FAILED`), uma segunda chamada com `outcome` diferente NÃO sobrescreve — devolve algo como `{ alreadyCompleted: true, status: quest.status, conclusion: quest.conclusionHint }` em vez de atualizar `status`/`completedAt` de novo. Razão: a própria US-169 já trata falso positivo como pior que final tardio (ver *Fora do escopo*) — uma segunda chamada com outcome trocado é quase sempre o modelo se corrigindo por engano, não uma reviravolta real da fábula; sobrescrever produziria duas conclusões narrativas contraditórias na mesma campanha. Trade-off aceito: bloqueia o caso raro de reversão narrativa legítima no mesmo turno — resolvível manualmente (update direto no banco) sem reabrir a story. Chamada repetida com o MESMO `outcome` continua coberta pela idempotência normal (nota acima) — o guard novo é só para `outcome` diferente do já gravado.

---

## Referências no código

- [packages/shared/src/types/adventure-generation.ts:77-90](../../../packages/shared/src/types/adventure-generation.ts) — `GeneratedAdventureSchema`, ganha `objective`.
- [apps/api/src/ai/ai.service.ts:1626-1659](../../../apps/api/src/ai/ai.service.ts) — `generateClosing`, função que sintetiza `objective` junto de `conclusion`/`followUps`/`encounterSituations` (US-166); já recebe `antagonist` pronto (US-190).
- [apps/api/src/adventure/adventure.service.ts:194](../../../apps/api/src/adventure/adventure.service.ts) — `generateAdventure`; chamada a `generateClosing` em [adventure.service.ts:251-261](../../../apps/api/src/adventure/adventure.service.ts).
- [apps/api/src/adventure/adventure.service.ts:483-490](../../../apps/api/src/adventure/adventure.service.ts) — `tx.quest.create`, onde `objective`/`conclusionHint` passam a ser gravados; comentário existente já cita a US-153 #4.
- [apps/api/prisma/schema.prisma:111-126](../../../apps/api/prisma/schema.prisma) — `model Quest`/`enum QuestStatus`, ganha as duas colunas novas.
- [apps/api/prisma/schema.prisma:144-150](../../../apps/api/prisma/schema.prisma) — `enum EventType`; já tem `QUEST_UPDATE` não usado hoje, alternativa a `CHARACTER_UPDATE` pro `EventLog` do `completeQuest` (achado 2026-08-22, ver *Atualizada em*).
- [apps/api/src/ai/ai.service.ts:545-546](../../../apps/api/src/ai/ai.service.ts) — único lugar que lê `Quest.status` hoje (`findMany` com filtro `OPEN`); prova de que nada grava `COMPLETED`/`FAILED` ainda.
- [apps/api/src/ai/ai.service.ts:574-576](../../../apps/api/src/ai/ai.service.ts) — `mainQuest`/`activeQuests` montados por turno a partir de `Quest`.
- [apps/api/src/ai/ai.service.ts:703](../../../apps/api/src/ai/ai.service.ts) — `const tools = {...}`, onde `completeQuest` entra ao lado de `updateScene` (~830)/`recordEntity` (~881).
- [packages/ai-engine/src/prompts/dm-system.ts:650-654](../../../packages/ai-engine/src/prompts/dm-system.ts) — bloco `## Main quest`/`## Active quests` no turn state.
- [US-153, Questões em aberto #4](./US-153-aventura-deixa-de-ser-derivada-da-classe.md) — decisão original de NÃO gravar `conclusion` em `Quest`, precedente direto desta story.
