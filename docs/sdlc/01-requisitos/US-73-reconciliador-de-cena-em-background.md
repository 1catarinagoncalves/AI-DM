# US-73 — Reconciliador de cena em background (o `sceneState` para de apodrecer)

**Épico:** 3 — Narração e mecânica
**Fase:** 1 — MVP single-player
**Status:** 🚧 Em progresso
**Depende de:** [US-11b](./US-11b-estado-de-cena-estruturado.md) (`sceneState`), [US-35](./US-35-cena-estruturada-na-abertura.md) (extração de cena da prosa — reusada aqui), [US-71](./US-71-simplificar-localizacao-do-personagem.md) (sinal de continuidade que **depende** da cena estar fresca).
**Relacionada a:** [US-67](./US-67-edicao-de-turno.md) (por isso o reconciliador NÃO loga `CHARACTER_UPDATE`), [US-69](./US-69-guard-anti-degeneracao-narracao.md) (a rede determinística em runtime — abordagem alternativa/complementar).
**Criada em:** 2026-07-24

---

## História

> **Como** jogador,
> **quero** que, quando o Mestre me leva a um lugar novo dentro de uma narração de viagem, o estado da cena acompanhe a prosa — sem eu precisar torcer para o modelo lembrar de registrar,
> **para que** no turno seguinte o Mestre saiba onde eu realmente estou e continue dali, em vez de rebobinar a viagem inteira.

---

## Contexto e motivação

### O problema observado (com dado do banco)

Sessão real (`erro narração 2.md`, aventura de Anetra Ulkas). A jogadora já tinha saído da forja rumo ao Pântano de Ossos. Nos **três turnos seguintes** o Mestre narrou: sentir o "coração de musgo", caminhar pela névoa, **chegar à árvore negra** e **encontrar o semeador** — e no terceiro turno, ao continuar a conversa, **re-narrou a viagem inteira + a chegada + a saudação idêntica** do semeador. O replay de transição que a US-71 tentou matar.

O `EventLog` mostra a causa-raiz, sem ambiguidade:

- `14:41:22` — último `updateScene` → `local = "estrada velha, entrada do Pântano de Ossos"`.
- `14:43:50` NARRATION (sente o coração de musgo) — **sem `updateScene`**.
- `14:45:07` NARRATION (chega à árvore, semeador aparece) — **sem `updateScene`**.
- `14:47:34` NARRATION (o replay) — **sem `updateScene`**.

E o `CharacterState.sceneState` no fim: `local = "estrada velha, entrada do Pântano de Ossos"`, `presentes = ["Anetra Ulkas"]` — **o semeador nem está lá, e o local é a ENTRADA do pântano, três turnos atrás.** O snapshot congelou.

### Por que a US-71 não basta (e piorou este caso)

A US-71 adicionou um **sinal de continuidade** ao bloco do turno: *"You are ALREADY at «{local}»; a chegada já foi narrada; continue daqui."* Ele **confia** no `sceneState.local`. Com o `local` três turnos velho, o sinal afirmou — **duro** — *"você está na ENTRADA do pântano, chegada já narrada"*. O modelo então "corretamente" re-narrou andar da entrada até a árvore. **O sinal apontou para trás e alimentou o replay.**

A premissa da US-71 — *"a cena é a fonte única e está sempre fresca"* — **é falsa em turnos de viagem→chegada**, porque o `sceneState` só avança se o modelo chamar `updateScene`, e nesses turnos ele não chama. A defesa via prompt (*"call `updateScene` when the character MOVES"*) já existe e foi **ignorada 3× seguidas** — mais prosa não resolve.

### A proposta

Parar de depender da disciplina do modelo. Após cada narração, um **reconciliador de cena** roda **em background** (fire-and-forget, como o resumo e o live-eval já fazem) e **sincroniza o `sceneState` com a prosa** que acabou de ser narrada — extraindo o local/presentes/objetos do FIM da narração e persistindo. Assim a cena nunca fica mais de um turno atrasada, e o sinal de continuidade da US-71 volta a apontar para frente.

Barato e invisível: reusa a extração estruturada da **US-35** (`extractOpeningScene`/`OPENING_SCENE_SCHEMA`), roda **só quando o modelo NÃO chamou `updateScene` naquele turno** (rede de segurança — custo zero nos turnos em que o modelo foi disciplinado), e **depois** do stream já ter ido ao jogador (nenhuma latência visível).

---

## Escopo

### Dentro do escopo

- **Reconciliador de cena pós-turno.** No `onFinish` do `streamChat`, quando a narração foi produzida **e nenhum step chamou `updateScene`**, disparar (sem `await`) uma extração estruturada da narração final e fundir no `sceneState` via `mergeSceneState`.
- **Reuso da US-35.** Mesma `generateObject` + `OPENING_SCENE_SCHEMA` + `summaryModel`; só muda o system/prompt (dá a cena atual como base e pede o estado no FIM da narração) e o fato de FUNDIR com a cena corrente em vez de extrair do zero.
- **Persistência sem evento.** Grava só a coluna `CharacterState.sceneState` — **NÃO** loga `CHARACTER_UPDATE` (mesma razão do `recordEntity`: um evento marcaria todo turno como mutação e o guard da US-67 desativaria a edição de turnos de conversa).
- **Guarda contra apagar.** Campos escalares vazios da extração (local/ambiente/período) **não** sobrescrevem o valor corrente (turno só-diálogo não zera o local).
- **Robustez.** Nunca derruba o turno: qualquer erro/timeout da extração é engolido com log (o turno já foi entregue).

### Fora do escopo

- **Guard determinístico de replay em runtime** (overlapRatio da narração nova vs anterior, regenerando) — é a [US-69](./US-69-guard-anti-degeneracao-narracao.md). Esta US ataca a **causa** (cena que apodrece); a US-69 é a rede de *detecção* do sintoma. As duas somam; nenhuma some.
- **Forçar `updateScene` via tool_choice / saída estruturada obrigatória** na chamada de narração. Mudaria a arquitetura do turno; o reconciliador pós-turno entrega o mesmo resultado sem tocar no caminho quente.
- **Reescrever o sinal de continuidade da US-71.** Com a cena fresca, o sinal volta a estar correto. Suavizá-lo ("continue da sua última narração") fica como **fallback** só se o reconciliador se provar insuficiente (ver Questões em aberto #1).
- **Reconciliar entidades** (`Adventure.entities`) — o reconciliador cuida da CENA (o AGORA); o ledger durável é outra coisa.

---

## Modelo de dados proposto

**Sem mudança de schema.** Escreve na coluna `CharacterState.sceneState` (Json) já existente, com o mesmo formato do `updateScene`. Nenhum `EventLog` novo (de propósito — ver US-67 acima).

---

## Critérios de aceite

- [ ] Após uma narração que **move** a personagem para um lugar novo **sem** o modelo chamar `updateScene`, o `CharacterState.sceneState` reflete o **novo** local/presentes/objetos no fim do turno (verificável no banco / num teste com narração-fixture).
- [ ] Em turnos onde o modelo **chamou** `updateScene`, o reconciliador **não** roda (sem custo de LLM redundante).
- [ ] O reconciliador roda **em background** (sem `await` no caminho da resposta) — não adiciona latência perceptível ao stream do jogador.
- [ ] O reconciliador **não** cria evento `CHARACTER_UPDATE` — a edição de turno (US-67) continua funcionando em turnos de conversa.
- [ ] Turno só-diálogo (sem mudança de lugar) **não** zera `local`/`ambiente`/`período` da cena.
- [ ] Falha da extração (erro/timeout/quota) **não** derruba nem atrasa o turno — é engolida com log.
- [ ] **Regressão do bug do anexo:** dada a narração do turno "chega à árvore + semeador aparece" e o `sceneState` antigo (entrada do pântano), o reconciliador produz `local ≈ clareira/árvore` e `presentes` incluindo o semeador — de modo que o sinal de continuidade do turno seguinte aponta para frente (teste determinístico com a extração mockada OU eval com LLM real).

---

## Notas de implementação

> *Dicas para quem implementar. Pode divergir com boa justificativa.*

- **Onde entra:** `apps/api/src/ai/ai.service.ts`, no `onFinish` do `streamText` (perto de onde já persiste NARRATION e chama `summarizeOldTurns`/`liveEvalTurn`). O gate: `const cenaTocada = steps.some(s => (s.toolCalls ?? []).some(tc => tc.toolName === 'updateScene'))`; só reconcilia quando `finalText.length > 0 && !cenaTocada`. Disparar com `void this.reconcileScene(...)` (fire-and-forget, padrão do `liveEvalTurn`).
- **O método `reconcileScene(adventureId, characterId, narration)`:** re-lê o `sceneState` corrente do banco (o mais fresco — o modelo pode ter chamado `updateScene` numa tentativa anterior), monta um patch via `generateObject` (reuso de `OPENING_SCENE_SCHEMA` + `summaryModel`) passando a **cena atual como base** no prompt e pedindo *"o estado da cena no FIM desta narração; repita os campos que a narração não mudou"*, e persiste `mergeSceneState(atual, patch)`. Só campos escalares **não-vazios** entram no patch (guarda contra zerar `local`); `presentes`/`objetos_em_cena` a extração devolve a lista final (mesma semântica de substituição do `updateScene`).
- **Não loga `CHARACTER_UPDATE`.** Copia o padrão do `recordEntity`: escreve a coluna e pronto. Um evento aqui reativaria o bloqueio de edição da US-67 em quase todo turno.
- **`apps/api` roda TS direto** (Nest) — sem passo de `dist` como o `ai-engine`. Mas o schema/extrator reusados vivem no próprio `ai.service.ts`, então não há rebuild de pacote.
- **Rodar `pnpm eval`** e `pnpm typecheck` após a mudança (regra do projeto). O teste determinístico do critério de regressão pode mockar `generateObject` (ou testar `mergeSceneState` com o patch esperado) — sem gastar LLM no CI.

---

## Questões em aberto

1. **O reconciliador basta sozinho?** Ele mantém a cena fresca → o sinal da US-71 fica correto → (pelo A/B da US-71) o modelo não replica com cena correta. Se, mesmo assim, algum turno replicar (ex.: a extração falhou/atrasou), o **fallback** é suavizar o sinal da US-71 para ancorar na última narração em vez do local, e/ou ligar a rede determinística da US-69. Fica aberto até haver evidência de que a raiz não basta.
2. **Frequência/custo.** Rodar só quando `updateScene` não foi chamado já limita bem. Se ainda pesar, dá para condicionar a reconciliar apenas quando a narração **sugere movimento** (heurística barata de palavras-chave de deslocamento) — mas isso é otimização prematura até o custo doer (YAGNI).

---

## Referências no código

- `apps/api/src/ai/ai.service.ts` — `:546` `onFinish` (onde o reconciliador é disparado); `:414-459` tool `updateScene` (a semântica que o reconciliador espelha); `:465-502` `recordEntity` (o padrão de "persistir sem logar `CHARACTER_UPDATE`"); `:56` `OPENING_SCENE_SCHEMA` e `:717` `extractOpeningScene` (reuso da US-35).
- `packages/ai-engine/src/scene.ts` — `mergeSceneState` (merge parcial reusado).
- [US-35](./US-35-cena-estruturada-na-abertura.md) — introduziu a extração de cena da prosa; esta US a promove de "só na abertura" para "todo turno em que o modelo não manteve a cena".
- [US-71](./US-71-simplificar-localizacao-do-personagem.md) — o sinal de continuidade que depende da cena fresca; esta US conserta a entrada dele.
- `C:\Users\Catarina\Downloads\erro narração 2.md` + `EventLog` da aventura `cmrw565dt00021yjcvjxj65tw` — a evidência da causa-raiz.
