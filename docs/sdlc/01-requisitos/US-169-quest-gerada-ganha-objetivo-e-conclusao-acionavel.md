# US-169 — Quest gerada ganha objetivo concreto e o Mestre passa a poder concluí-la

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** [US-181](./US-181-antagonista-ganha-want-e-method-estruturados.md) (`antagonist.want`/`antagonist.method`, campo novo em `GeneratedAdventure` — decidido implementar antes desta: `objective` deve citar motivo/método do antagonista desde a primeira versão, não como retrabalho depois. Ver *Notas de implementação*)
**Relacionado:** [US-153](./US-153-aventura-deixa-de-ser-derivada-da-classe.md) (dono de `Quest.title`/`Quest.description` como estão hoje; *Questões em aberto* #4 já adiou `conclusion` explicitamente pra "consumo futuro") · [US-164](./US-164-orquestrador-motor-monta-aventura-gerada.md) (`generateClosing`, a função que ganha o campo novo) · [US-168](./US-168-abertura-narra-gancho-fixo-nao-aventura-gerada.md) (mexe nos mesmos arquivos — `buildOpeningInstruction`, `buildTurnStateBlock`, região de `generateClosing`/`createForCharacter`; sequenciar depois dela evita conflito de merge, mas não é bloqueio técnico: os dois campos que faltam — `objective` aqui, `mainQuest`/`entities` lá — são independentes)
**Criada em:** 2026-08-18 — achado ao revisar `generateAdventure()` com a mantenedora: `summary` é só o TIPO da missão ("Rescue an NPC", rótulo cru da tabela `1d20quests`), `start` é o gancho fixo por classe — nenhum dos dois amarra a um alvo concreto da aventura REALMENTE gerada (ex.: "ajudar Marta", "acabar com o culto da Enseada Cinzenta"). E mesmo que amarrasse, não existe hoje nenhum tool que deixe o Mestre marcar a quest como concluída — `Quest.status` existe no schema e nunca é escrito.

---

## História

> **Como** jogador que cumpriu o objetivo real da aventura gerada para o meu personagem,
> **quero** que o Mestre reconheça isso e narre um desfecho coerente com o que o motor já preparou,
> **para que** a aventura tenha um fim reconhecível em vez de ficar `OPEN` para sempre, com o Mestre narrando cenas soltas sem nunca saber que "acabou".

---

## Contexto e motivação

### O que existe hoje

- `GeneratedAdventureSchema` ([adventure-generation.ts:47-61](../../../packages/shared/src/types/adventure-generation.ts)) tem `summary` (tipo curto, ex. `"Rescue an NPC"`), `start` (gancho fixo por classe), `conclusion` (prosa de fecho) e `followUps` — mas nenhum campo diz QUEM precisa ser resgatado, QUAL culto precisa cair. Essa informação existe, espalhada, dentro de `npcs[].role`/`secrets[].text`/`locations[]`, nunca sintetizada.
- `Quest.title = generated.summary`, `Quest.description = generated.start` ([adventure.service.ts:356-363](../../../apps/api/src/adventure/adventure.service.ts)) — o comentário na própria US-153 já documentou isso como INTENCIONALMENTE incompleto: *"`adventure.conclusion` não alimenta nenhum campo de `Quest` nesta story: usá-lo como descrição vazaria o desfecho antes do jogo começar; fica no artefato disponível pra consumo futuro"* (US-153, Questões em aberto #4). Esta story É esse consumo futuro.
- `Quest.status` ([schema.prisma:117](../../../apps/api/prisma/schema.prisma), enum `OPEN`/`COMPLETED`/`FAILED`) nunca é escrito em lugar nenhum de `apps/api/src` — confirmado por grep: o único uso é `quest.findMany({ where: { adventureId, status: 'OPEN' } })` em [ai.service.ts:415](../../../apps/api/src/ai/ai.service.ts). Toda quest fica `OPEN` para sempre; `completedAt` nunca é preenchido.
- O DM Agent não tem NENHUM tool de conclusão de quest. Os tools existentes (`updateScene`, `recordEntity`, `updateCharacterHp`, `updateInventory`, `rollDice`, `getSpell`, ver [ai.service.ts:554-813](../../../apps/api/src/ai/ai.service.ts)) cobrem estado de cena/personagem, nenhum cobre progresso de missão.
- `generateClosing` ([ai.service.ts:1383-1415](../../../apps/api/src/ai/ai.service.ts)) já roda DENTRO de `generateAdventure()` ([adventure.service.ts:162-170](../../../apps/api/src/adventure/adventure.service.ts)) com `locations`, `npcs`, `secrets`, `registry` e `complicacao` em mãos — é o único ponto do motor que já viu a aventura inteira antes dela começar. Hoje ele só devolve `conclusion`+`followUps`.

### O problema

Mesmo com um objetivo concreto sintetizado, não há como o Mestre AGIR sobre ele: sem tool, sem status gravável, sem o texto de `conclusion` acessível num turno qualquer (ele nasce em `generateAdventure()`, não sobrevive à criação — nem a `Quest`, nem a nenhuma outra tabela). O jogador pode cumprir o objetivo da aventura e o jogo nunca vai saber.

### A proposta

1. `generateClosing` ganha um campo novo no seu retorno — `objective: string` — um objetivo concreto e verificável, sintetizado a partir de `locations`/`npcs`/`secrets`/`complicacao`/`antagonist` (US-181 — `want`/`method`, não só `name`) (ex.: `"Impedir que Malvora drene a vila de Enseada Cinzenta pra alimentar seu ritual"`), na mesma chamada de IA que já produz `conclusion`/`followUps`/`antagonist` (nenhum round-trip novo).
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
- Novo tool `completeQuest` (`ai.service.ts`, mesma seção dos outros tools): parâmetros `{ outcome: 'success' | 'failure', reason?: string }`; localiza a quest `isPrimary: true` da aventura corrente, atualiza `status` (`COMPLETED`/`FAILED`) e `completedAt`, grava `EventLog` tipo `CHARACTER_UPDATE` (mesmo padrão de `updateScene`) com `reason` no `payload` (sem coluna nova em `Quest`), devolve `{ conclusion: quest.conclusionHint }`.
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

- [ ] `generateClosing` devolve `objective` além de `conclusion`/`followUps`, sintetizado a partir de `locations`/`npcs`/`secrets`/`complicacao` já disponíveis na chamada.
- [ ] **`objective` cita `antagonist.want`/`antagonist.method` (US-181), não só `antagonist.name`** — critério de aceite próprio, não só nota de implementação: teste de regressão falha se o texto de `objective` reduzir o antagonista ao nome (ex. rejeita `"Impedir Malvora"` sozinho como saída válida de fixture; aceita `"Impedir que Malvora drene a vila pra alimentar seu ritual"`, que referencia `want`/`method`). Sem este critério, a dependência da US-181 fica só documentada em prosa (ver *Notas de implementação*) e pode ser esquecida na implementação.
- [ ] `GeneratedAdventureSchema.parse` exige `objective` — falha o gate (US-150) se ausente, mesmo tratamento de reseed que qualquer outro campo obrigatório.
- [ ] `Quest` (schema.prisma) ganha `objective String?` e `conclusionHint String?`; migração aplicada.
- [ ] `createForCharacter` grava os dois campos na criação da quest primária.
- [ ] Tool `completeQuest` existe, aceita `outcome: 'success' | 'failure'` (desistência/fuga/abandono do objetivo conta como `failure`) e `reason?: string` opcional, atualiza `status`/`completedAt` da quest primária da aventura corrente, grava `EventLog` (com `reason` no `payload`, se enviado), devolve `conclusionHint`.
- [ ] `## Main quest` no turn state block mostra `objective`.
- [ ] Instrução de ofício no system prompt diz ao modelo pra chamar `completeQuest` ao reconhecer o objetivo cumprido/fracassado, e usar o `conclusion` devolvido como base (não verbatim) da narração de fecho.
- [ ] **Eval:** ação do jogador cumpre o `objective` → `completeQuest` chamado, `Quest.status = COMPLETED` no banco, narração referencia o `conclusion` sem repeti-lo literalmente.
- [ ] **Eval:** objetivo ainda não cumprido → `completeQuest` NÃO chamado (sem falso positivo).
- [ ] `pnpm eval` passa (mudança em prompt do DM Agent).

---

## Notas de implementação

- `objective` deve nascer JÁ referenciando nomes concretos do artefato gerado (o NPC pelo nome, o vilão/facção pelo nome) — senão vira só uma paráfrase de `summary` e não resolve o problema original (ex.: "Ajudar Marta" é melhor que "Ajudar uma NPC").
- **Depende de US-181 (decisão de ordem, 2026-08-20):** `objective` deve citar `antagonist.want`/`antagonist.method` — não só `antagonist.name` — desde a primeira implementação ("Impedir que Malvora drene a vila pra alimentar seu ritual" é melhor que só "Impedir Malvora"). Implementar US-169 antes da US-181 produziria um `objective` mais pobre (só nome) que precisaria de retrabalho de prompt assim que `antagonist` existisse — mais barato inverter a ordem agora do que reabrir esta story depois. `generateClosing` já monta `antagonist` e `objective` na MESMA chamada (nenhum custo extra de round-trip por causa da dependência).
- Migração do `Quest`: `objective`/`conclusionHint` são `String?` opcionais — confirmado no Neon (2026-08-20): 6 quests já existem, todas `status = OPEN`, sem valor óbvio pra preencher retroativamente. NOT NULL exigiria placeholder fictício nessas 6 linhas; opcional evita isso.
- `completeQuest`, ao devolver `conclusionHint`, pode receber `null` pra essas 6 quests legadas (criadas antes desta story) — o Mestre não tem desfecho pré-escrito pra elas; tratar como "sem hint disponível", não como erro.
- `completeQuest` segue o MESMO padrão de idempotência que `recordEntity`: se chamado duas vezes (ex.: o modelo "confirma" a conclusão em dois turnos seguidos por engano), o segundo `update` é inofensivo (mesmo `status`, `completedAt` reescrito) — não precisa de guarda especial.
- Cuidado com o texto de `conclusionHint` na resposta do tool: ele SÓ deve chegar ao modelo depois de `completeQuest` ser chamado, nunca antes (nem em `buildTurnStateBlock`, nem em nenhum bloco passivo) — é exatamente o vazamento que a US-153 (Questões em aberto #4) evitou de propósito ao não gravar `conclusion` em `Quest.description`.
- Arquivo principal: [ai.service.ts](../../../apps/api/src/ai/ai.service.ts) — `generateClosing` (~1383), novo tool `completeQuest` (ao lado de `updateScene`, ~681).
- Segundo arquivo: [dm-system.ts](../../../packages/ai-engine/src/prompts/dm-system.ts) — `buildTurnStateBlock` (~591-599, bloco `## Main quest`).
- Terceiro arquivo: [adventure.service.ts](../../../apps/api/src/adventure/adventure.service.ts) — `tx.quest.create` (~356-363).
- Mudança em prompt do DM Agent — rodar `pnpm eval` depois (custa chamadas reais de LLM, ver `AGENTS.md`).

---

## Questões em aberto

1. ~~`completeQuest` deve aceitar UM `outcome` só (sucesso/fracasso), ou também um `reason: string` livre pro modelo registrar COMO terminou?~~ **Decidido (mantenedora, 2026-08-20): sim, adicionar `reason: string` opcional.** Custo é baixo — não vai em coluna nova de `Quest` (evita migração pra campo que ninguém lê ainda), vai no `payload` (`Json`, já livre) do `EventLog` que `completeQuest` grava. Sem leitura em runtime hoje, mas fica pronto pro dia que `followUps` for consumido por uma aventura futura sem precisar reabrir esta story.
2. ~~Existe caso onde a aventura deveria encerrar SEM o jogador "vencer" explicitamente (ex.: ele foge, abandona) — isso conta como `failure` ou precisa de um terceiro outcome?~~ **Decidido (mantenedora, 2026-08-20): desistência conta como `failure`.** Sem `ABANDONED` no schema — `outcome: 'failure'` cobre tanto derrota quanto abandono/fuga do objetivo. `completeQuest` deve ser chamado também quando o jogador claramente desiste do objetivo primário (foge, recusa continuar, muda de rumo de forma irreversível), não só quando é derrotado na fábula.
3. ~~Migração de dados — depende de quantas aventuras já existem no Neon com `Quest` sem os campos novos.~~ **Decidido (checado no Neon, 2026-08-20): 6 quests existentes, todas `OPEN`.** `objective`/`conclusionHint` viram `String?` opcionais — sem migração de dados fictícia.

---

## Referências no código

- [packages/shared/src/types/adventure-generation.ts:47-61](../../../packages/shared/src/types/adventure-generation.ts) — `GeneratedAdventureSchema`, ganha `objective`.
- [apps/api/src/ai/ai.service.ts:1383-1415](../../../apps/api/src/ai/ai.service.ts) — `generateClosing`, função que sintetiza `objective` junto de `conclusion`/`followUps`.
- [apps/api/src/adventure/adventure.service.ts:162-170](../../../apps/api/src/adventure/adventure.service.ts) — `generateAdventure`, chamada a `generateClosing` dentro do motor.
- [apps/api/src/adventure/adventure.service.ts:353-363](../../../apps/api/src/adventure/adventure.service.ts) — `tx.quest.create`, onde `objective`/`conclusionHint` passam a ser gravados; comentário existente já cita a US-153 #4.
- [apps/api/prisma/schema.prisma:111-126](../../../apps/api/prisma/schema.prisma) — `model Quest`/`enum QuestStatus`, ganha as duas colunas novas.
- [apps/api/src/ai/ai.service.ts:415](../../../apps/api/src/ai/ai.service.ts) — único lugar que lê `Quest.status` hoje (`findMany` com filtro `OPEN`); prova de que nada grava `COMPLETED`/`FAILED` ainda.
- [apps/api/src/ai/ai.service.ts:443-446](../../../apps/api/src/ai/ai.service.ts) — `mainQuest`/`activeQuests` montados por turno a partir de `Quest`.
- [apps/api/src/ai/ai.service.ts:554-813](../../../apps/api/src/ai/ai.service.ts) — `const tools = {...}`, onde `completeQuest` entra ao lado de `updateScene`/`recordEntity`.
- [packages/ai-engine/src/prompts/dm-system.ts:591-599](../../../packages/ai-engine/src/prompts/dm-system.ts) — bloco `## Main quest`/`## Active quests` no turn state.
- [US-153, Questões em aberto #4](./US-153-aventura-deixa-de-ser-derivada-da-classe.md) — decisão original de NÃO gravar `conclusion` em `Quest`, precedente direto desta story.
