# US-257 — Introdução narrada pelo Mestre, antes da cena de abertura, apresenta personagem e mundo

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** [US-125](./US-125-beneficios-origem-no-system-prompt.md) (✅ — dona do tipo `OriginNarrative`, reusado pelo cálculo desta story) · [US-39](./US-39-identidade-narrativa-background-ideais.md) (✅ — dona de `CharacterBackground`) · [US-34](./US-34-qualidade-da-narracao-do-dm.md) (✅ — dona de `generateOpeningNarration`/a cena de abertura atual, que esta story NÃO altera, só precede)
**Relacionado:** [US-172](./US-172-abertura-gerada-nao-copia-gancho-fixo.md) (heurística *in medias res* da cena de abertura — o motivo desta story existir como beat SEPARADO, não como mudança da cena) · [US-168](./US-168-abertura-narra-gancho-fixo-nao-aventura-gerada.md) (`Promise.all` como precedente de 2 chamadas de IA paralelas na criação da aventura)
**Criada em:** 2026-09-18
**Atualizada em:** 2026-09-18 — reescrita após correção da mantenedora: a versão original propunha ESTENDER a cena de abertura existente (`buildOpeningInstruction`) para narrar identidade; a decisão correta é uma mensagem NOVA e SEPARADA, narrada pelo Mestre ANTES da cena de abertura — a cena em si (`generateOpeningNarration`, `buildOpeningInstruction`, `extractOpeningScene`) fica intocada.
**Implementada em:** 2026-09-18 — todos os critérios de código/teste/migração fechados. Pendente: o critério de eval qualitativa dedicada (bake-off US-17, item "amarra raça/classe/background/origem ao mundo/gancho") não foi escrito nesta rodada — `pnpm eval` (regressão estrutural) passa, mas nenhum fixture novo cobre a qualidade da PROSA da introdução via juiz-LLM.

---

## História

> **Como** jogadora que acabou de criar um personagem,
> **quero** que o Mestre me dê uma introdução — quem meu personagem é (raça, classe, background, origem) e o mundo/gancho da aventura que vou jogar — como uma mensagem própria, ANTES da cena de abertura,
> **para que** eu entenda meu personagem e o mundo antes de a ação começar, sem que a cena de abertura em si precise virar exposição estática.

---

## Contexto e motivação

### O problema observado

Hoje a criação de personagem produz UMA única mensagem do Mestre antes do primeiro turno: a cena de abertura (`AiService.generateOpeningNarration`, [ai.service.ts:1386-1462](../../../apps/api/src/ai/ai.service.ts), persistida como `EventLog.type = 'NARRATION'` em [adventure.service.ts:588](../../../apps/api/src/adventure/adventure.service.ts) e [:793](../../../apps/api/src/adventure/adventure.service.ts)). Essa cena é deliberadamente *in medias res* (US-172: "something is already in motion, never a static arrival") e cita raça/classe só de passagem — `buildOpeningInstruction` ([dm-system.ts:736](../../../packages/ai-engine/src/prompts/dm-system.ts)) pede para usar "`${characterName}`'s race and class as a lens on the world", uma frase dentro do craft bar, nunca uma apresentação de fato. Background/origem não são sequer citados na instrução da abertura (embora `background` já chegue como dado ao system prompt dessa chamada — `origin`/`originNarrative` nem isso: **nenhum** dos dois call sites de `generateOpeningNarration` passa `originNarrative`, então a seção `## Origin narrative` do system prompt fica ausente na própria cena de abertura, só aparecendo a partir do 2º turno via `streamChat`).

Não existe, em lugar nenhum do fluxo, um momento dedicado a apresentar o personagem e o mundo ao jogador antes de a história começar.

### Por que a solução atual não basta

Estender a PRÓPRIA cena de abertura para fazer essa apresentação (a versão anterior desta story) colide de frente com a US-172: aquela story decidiu conscientemente que a abertura abre em ação, nunca em exposição estática de cenário/personagem — citando o LGMRD ("a strong start kicks your game off in the middle of the action"). Colocar uma introdução de identidade DENTRO da cena reabriria essa decisão sem necessidade.

A seção `## Character identity` do system prompt ([dm-system.ts:328-329](../../../packages/ai-engine/src/prompts/dm-system.ts)) também não serve: ela existe para colorir QUALQUER turno "quando a cena pedir", e explicitamente instrui "do NOT force where the scene doesn't ask" — o oposto de uma apresentação deliberada.

### A proposta

Uma mensagem NOVA, gerada por uma chamada de IA dedicada, roda em PARALELO à geração da cena de abertura (mesmo padrão de `Promise.all` da US-168, decisão #2) — sem adicionar latência sequencial. Essa mensagem é uma introdução curta, fora do modo *in medias res*: situa o mundo/gancho da aventura e amarra a ele quem `${characterName}` é (raça, classe, background, origem), sem citar cena, local ou NPC algum. É persistida como um `EventLog` de um tipo novo, ANTES do `EventLog` da cena de abertura (que continua exatamente como hoje) — o jogador vê duas mensagens do Mestre em sequência: primeiro a introdução, depois a cena.

---

## Escopo

### Dentro do escopo

- **Novo `EventType.INTRODUCTION`** no schema Prisma (ver §Modelo de dados) — distinto de `NARRATION` de propósito (ver Notas de implementação, por que não reusar `NARRATION`).
- **`buildIntroInstruction(params)`** nova função em `dm-system.ts`, paralela a `buildOpeningInstruction` — MESMO formato de parâmetros (`characterName`, `hookSeed`, `mainQuest?`, `locale?`), mas instrução de conteúdo oposta: um prólogo curto, NÃO *in medias res*, sem cena/local/NPC, sem lista de opções de ação (não é um turno) — situa o mundo/premissa da aventura e amarra a ele raça, classe, background e origem de `${characterName}`. Preserva a regra de PROVENÂNCIA de `connection`/`memento` (US-125): a introdução pode expressar o que o PERSONAGEM sente/carrega, nunca o que um NPC já saberia (não há NPC nesta mensagem).
- **`AiService.generateIntroNarration(params)`** novo método em `ai.service.ts` — mesma disciplina de resiliência de `generateOpeningNarration` (escada de `narrationModels`, timeout, nunca lança, retorna `string | null`). Monta seu PRÓPRIO `system` via `buildDmSystemPrompt`, já incluindo `originNarrative` calculado como em `streamChat` ([ai.service.ts:669-673](../../../apps/api/src/ai/ai.service.ts)) — sem depender de nenhuma mudança em `generateOpeningNarration`.
- Nos dois pontos de `adventure.service.ts` que hoje chamam `generateOpeningNarration` (ramo preset, [:530](../../../apps/api/src/adventure/adventure.service.ts); ramo com motor de geração, [:707](../../../apps/api/src/adventure/adventure.service.ts)): disparar `generateIntroNarration` em `Promise.all` junto da chamada existente — a chamada/parâmetros/comportamento de `generateOpeningNarration` não mudam em nada.
- Na transação de criação: quando `generateIntroNarration` devolve texto (não falhou), inserir um `EventLog` `type: 'INTRODUCTION'` ANTES do `EventLog` `NARRATION` já existente, com `createdAt` explícito e distinto entre os dois (ver Notas de implementação — armadilha do `now()` fixo por transação).
- Falha/timeout/`null` de `generateIntroNarration`: nenhuma linha é inserida — a criação da aventura segue IDÊNTICA ao comportamento de hoje (a abertura nunca espera nem depende da introdução).
- `AdventureService.getTurns` ([adventure.service.ts:832](../../../apps/api/src/adventure/adventure.service.ts)) passa a incluir `INTRODUCTION` no filtro de tipos e a mapear para `role: 'dm'` — vira uma bolha do Mestre a mais no histórico, antes da cena.
- `renderEventLine` ([adventure-export.ts:205](../../../apps/api/src/adventure/adventure-export.ts)) ganha um branch para `INTRODUCTION` (mesmo formato `**Mestre** (ts): texto` de `NARRATION`).
- Eval/teste de regressão: fixture com `originNarrative`/background preenchidos confirma que o texto gerado da introdução reflete raça/classe/background/origem e o gancho da aventura, sem citar cena/local/NPC e sem lista de opções.

### Fora do escopo

- **Qualquer mudança em `generateOpeningNarration`, `buildOpeningInstruction` ou `extractOpeningScene`** — a cena de abertura, seu conteúdo e sua heurística *in medias res* ficam exatamente como estão. Este é o ponto central da correção desta story (ver §Atualizada em).
- **Incluir a introdução em `history`/`summarizeOldTurns`** (`ai.service.ts:599` e `:1859`, ambos filtram só `type: { in: ['ACTION', 'NARRATION'] }`) — `INTRODUCTION` fica DE FORA desse filtro de propósito: como não está na lista, nunca entra nas mensagens que o modelo relê turno a turno, nem na sumarização de longo prazo. Isso evita duas mensagens `assistant` consecutivas sem um `user` entre elas no array enviado ao modelo (intro + cena de abertura, ambas antes da 1ª ação do jogador) — risco real de quebra de alternância estrita de papéis em alguns provedores. Ver Notas de implementação.
- **Consertar a ausência de `originNarrative` em `generateOpeningNarration`** (achado da versão anterior desta story) — deixa de ser necessário: a introdução nova já nasce com `originNarrative` correto num caminho de código novo, sem precisar tocar na função existente.
- **Texto estático de fallback para a introdução** — não existe equivalente ao `hookSeed`/`hookOpening` pré-autorado por classe para este conteúdo novo; falha de geração = aventura nasce sem introdução, não um texto genérico.
- **Mudança de UI/frontend** — `getTurns` já devolve qualquer linha do Mestre como uma bolha `role: 'dm'` genérica ([GameView.tsx](../../../apps/web/src/components/game/GameView.tsx) não faz nenhum tratamento especial da 1ª mensagem); duas mensagens seguidas do Mestre renderizam sem trabalho novo.
- **Extração de `sceneState`** a partir do texto da introdução — `extractOpeningScene` continua recebendo só o texto da cena de abertura; a introdução nunca tem local/cena para extrair.

---

## Modelo de dados proposto

```prisma
enum EventType {
  ACTION
  NARRATION
  DICE_ROLL
  QUEST_UPDATE
  CHARACTER_UPDATE
  INTRODUCTION // US-257: mensagem do Mestre ANTES da cena de abertura — fora de history/summarizeOldTurns de propósito
}
```

| Campo | Tipo | Descrição |
|---|---|---|
| `EventLog.type` | `EventType` | Ganha o valor `INTRODUCTION` — mesma tabela/modelo, sem coluna nova. `payload` segue `{ text: string }`, igual a `NARRATION`. |

**Persistência:** mesma tabela `EventLog` já existente ([schema.prisma:182](../../../apps/api/prisma/schema.prisma)) — só um valor novo no enum. Requer `pnpm db:migrate` (`migrate dev` local; `migrate deploy` em produção — ver [US-58](./US-58-banco-postgres-neon.md), a Neon não roda `migrate dev`).

---

## Critérios de aceite

- [ ] `EventType` ganha `INTRODUCTION`; migração aplicada sem quebrar dados existentes (enum é aditivo).
- [ ] `buildIntroInstruction` existe em `dm-system.ts`, com o mesmo formato de parâmetros de `buildOpeningInstruction`, e a instrução NÃO pede *in medias res* nem lista de opções de ação.
- [ ] `AiService.generateIntroNarration` existe, nunca lança (mesma disciplina de `generateOpeningNarration`), e monta um `system` com `originNarrative` preenchido a partir de `character.origin` + `config.backgrounds`.
- [ ] Os dois call sites em `adventure.service.ts` disparam `generateIntroNarration` em `Promise.all` com a chamada existente a `generateOpeningNarration` — teste confirma que nenhum parâmetro passado a `generateOpeningNarration` mudou.
- [ ] Com `generateIntroNarration` retornando texto, a transação de criação grava um `EventLog` `INTRODUCTION` com `createdAt` ANTERIOR ao `EventLog` `NARRATION` da cena — teste de regressão cobre que os dois timestamps são distintos (não confia no `now()`/`CURRENT_TIMESTAMP` do Postgres, fixo por transação).
- [ ] Com `generateIntroNarration` retornando `null` (falha/timeout), nenhum `EventLog` `INTRODUCTION` é criado e a aventura nasce idêntica ao comportamento anterior a esta story.
- [ ] `getTurns` inclui `INTRODUCTION` no filtro e mapeia para `role: 'dm'` — teste confirma que a introdução aparece ANTES da cena de abertura na lista ordenada.
- [ ] `history`/`summarizeOldTurns` (`ai.service.ts:599`, `:1859`) continuam filtrando só `ACTION`/`NARRATION` — teste de regressão confirma que uma `INTRODUCTION` fixture NÃO aparece no array de mensagens enviado ao modelo em nenhum turno.
- [ ] `renderEventLine` (export) formata `INTRODUCTION` como `**Mestre**: texto`, não como o fallback genérico `[TIPO] JSON`.
- [ ] `pnpm typecheck`, `pnpm test` e `pnpm db:migrate` passam.
- [ ] **Eval / teste de regressão (qualitativa, bake-off US-17):** fixture com origem/background distintos entre personagens confirma que a introdução gerada amarra raça/classe/background/origem ao mundo/gancho da aventura, sem citar local, NPC ou ação — e que a cena de abertura gerada em paralelo continua idêntica ao comportamento pré-existente (nenhuma regressão de conteúdo nela).
- [ ] `pnpm eval` passa (prompt novo do DM Agent — regra do projeto, `AGENTS.md`) — rodar antes de fechar a story.

---

## Notas de implementação

- **Por que `INTRODUCTION` novo em vez de reusar `NARRATION`:** reusar `NARRATION` para as duas mensagens (intro + cena) faria a introdução cair automaticamente nos filtros `type: { in: ['ACTION', 'NARRATION'] }` de `history` (`ai.service.ts:609-617`) e `summarizeOldTurns` (`:1868-1873`) — produzindo DUAS mensagens `assistant` consecutivas (intro, depois cena) sem `user` entre elas no array enviado ao modelo no 1º turno real. Alguns provedores exigem alternância estrita de papéis; mesclar as duas mensagens em uma só no builder de histórico é possível, mas um tipo de evento novo resolve por CONSTRUÇÃO (a introdução nunca entra na lista filtrada) sem tocar em código de turno já estável. Trade-off aceito: uma migração de enum a mais.
- **Armadilha do `now()`/`CURRENT_TIMESTAMP` fixo por transação:** `EventLog.createdAt` usa `@default(now())` ([schema.prisma:193](../../../apps/api/prisma/schema.prisma)), que o Postgres resolve para o INÍCIO da transação, igual em TODOS os `INSERT`s dela — não por statement. Duas `tx.eventLog.create` na mesma `$transaction` (intro e cena) sairiam com `createdAt` IDÊNTICO, e `orderBy: { createdAt: 'asc' }` (usado por `getTurns` e pelo export) não garante ordem estável entre empates. Precisa de `createdAt` explícito nas duas chamadas (ex.: capturar `const now = new Date()` e usar `now` na introdução, `new Date(now.getTime() + 1)` na cena) — mesma classe de armadilha de timing que motivou o reordenamento manual por tipo em `getTurns` (US-38, comentário em [adventure.service.ts:855-859](../../../apps/api/src/adventure/adventure.service.ts)).
- `Promise.all` para rodar `generateIntroNarration`/`generateOpeningNarration` em paralelo — mesmo padrão e mesma justificativa de custo/latência aceito na US-172 (Decisão #2: nenhuma das duas depende do resultado da outra).
- `ai-engine` roda de `dist` — `pnpm --filter @ai-dm/ai-engine build` depois de editar `dm-system.ts`, senão a função nova não aparece nem em dev nem em teste de `api`.
- Mudança em prompt do DM Agent — rodar `pnpm eval` depois (custa chamadas reais de LLM, ver `AGENTS.md`).

---

## Questões em aberto

1. Falha silenciosa de `generateIntroNarration` (sem introdução nesta aventura) é aceitável sem mais nada, ou merece um `logLlmFailure` (mesmo padrão de `generateOpeningNarration`) para dar visibilidade em produção de quanto essa geração falha na prática? Recomendação: logar do mesmo jeito, sem bloquear — mesma disciplina já usada em toda chamada de IA best-effort deste arquivo.
2. A introdução deve citar o `tone` sorteado da aventura explicitamente na instrução (`buildIntroInstruction`), ou basta o `tone` já estar na camada 2 do system prompt (US-168) sem precisar repetir? Recomendação: não repetir — evita instrução redundante que o modelo já vê no system.
3. Nome exato do valor de enum — `INTRODUCTION` vs `INTRO` vs `PROLOGUE` — decisão de nomenclatura sem impacto funcional, resolver na implementação.

---

## Referências no código

- [`apps/api/src/ai/ai.service.ts:1386-1462`](../../../apps/api/src/ai/ai.service.ts) — `generateOpeningNarration`, molde de resiliência a seguir para `generateIntroNarration` (função IRMÃ, não alterada).
- [`apps/api/src/ai/ai.service.ts:669-673`](../../../apps/api/src/ai/ai.service.ts) — cálculo de `originNarrative` em `streamChat`, o molde a replicar para a introdução.
- [`apps/api/src/ai/ai.service.ts:599-617`](../../../apps/api/src/ai/ai.service.ts) e [`:1856-1873`](../../../apps/api/src/ai/ai.service.ts) — `history`/`summarizeOldTurns`, filtros `ACTION`/`NARRATION` que `INTRODUCTION` deve continuar fora.
- [`apps/api/src/adventure/adventure.service.ts:530`](../../../apps/api/src/adventure/adventure.service.ts) e [`:707`](../../../apps/api/src/adventure/adventure.service.ts) — call sites de `generateOpeningNarration`, onde `generateIntroNarration` entra em paralelo.
- [`apps/api/src/adventure/adventure.service.ts:588`](../../../apps/api/src/adventure/adventure.service.ts) e [`:793`](../../../apps/api/src/adventure/adventure.service.ts) — `tx.eventLog.create` da cena de abertura, onde o `INTRODUCTION` novo entra ANTES.
- [`apps/api/src/adventure/adventure.service.ts:832-892`](../../../apps/api/src/adventure/adventure.service.ts) — `getTurns`, ganha `INTRODUCTION` no filtro e no mapeamento de papel.
- [`apps/api/src/adventure/adventure-export.ts:205-210`](../../../apps/api/src/adventure/adventure-export.ts) — `renderEventLine`, ganha branch para `INTRODUCTION`.
- [`apps/api/prisma/schema.prisma:182-204`](../../../apps/api/prisma/schema.prisma) — `EventLog`/`EventType`, o enum que ganha o valor novo.
- [`packages/ai-engine/src/prompts/dm-system.ts:702-741`](../../../packages/ai-engine/src/prompts/dm-system.ts) — `buildOpeningInstruction`, molde de formato de parâmetros para `buildIntroInstruction` (função IRMÃ, não alterada).
- [`packages/ai-engine/src/prompts/dm-system.ts:328-333`](../../../packages/ai-engine/src/prompts/dm-system.ts) e [`:386-393`](../../../packages/ai-engine/src/prompts/dm-system.ts) — `backgroundSection`/`originNarrativeSection`, dados já modelados que a introdução consome via `buildDmSystemPrompt`.
- [US-172](./US-172-abertura-gerada-nao-copia-gancho-fixo.md) — decisão *in medias res* que motivou esta story existir como beat separado.
- [US-168](./US-168-abertura-narra-gancho-fixo-nao-aventura-gerada.md) — precedente de `Promise.all` para 2 chamadas de IA paralelas na criação da aventura.
