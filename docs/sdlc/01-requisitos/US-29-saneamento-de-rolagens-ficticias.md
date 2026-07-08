# US-29 — Saneamento de rolagens fictícias (o sistema é a única fonte de dados)

**Épico:** 3 — Narração e mecânica
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** [US-09](#) (rolagem transparente — a `rollDice` do Game Server é a ÚNICA fonte legítima de resultado; esta story protege esse contrato) · [US-34](./US-34-qualidade-da-narracao-do-dm.md) (o prompt do DM já proíbe inventar números — `dm-system.ts:81,127,138`; esta story adiciona a rede de segurança que garante quando o modelo desobedece)
**Alimenta:** [US-18](./US-18-historico-servido-pela-api.md) (o histórico persistido não realimenta rolagens inventadas nos turnos seguintes) · [US-23](./US-23-dm-ciente-da-ficha.md) (a ficha injetada continua sendo a única mecânica; a prosa não vira fonte paralela)
**Criada em:** 2026-07-08

---

## História

> **Como** jogador,
> **quero** ver a rolagem **real do sistema** exibida com clareza (fórmula + resultado) **antes** da narração do mestre, e que a prosa apenas interprete esse resultado de forma narrativa — nunca um número inventado pelo LLM,
> **para que** eu confie que todo número veio do sistema, e nunca fique confuso com um "total 20 no teste de Percepção" que a máquina nunca rolou nem com uma rolagem forçada para abrir uma porta destrancada.

---

## Contexto e motivação

### O problema observado

O `rollDice` (Game Server, `DiceService`, RNG criptográfico) é a **única entidade autorizada** a rolar dados. O prompt já é enfático sobre isso:

- `dm-system.ts:81` — "any outcome left to chance still REQUIRES a real roll: call `rollDice` and WAIT".
- `dm-system.ts:127` — "It is FORBIDDEN to write a result such as *'Com um total de 20 no teste de Percepção...'* unless that EXACT number was returned to you by `rollDice`".
- `dm-system.ts:138` — "Roll ONLY when the player's CHOSEN action genuinely has an uncertain outcome … Do NOT spontaneously inject ability checks — especially Perception".

Mesmo assim, um LLM **desobedece o prompt** com frequência. Dois sintomas concretos, observados em sessão:

1. **Resultado fictício na prosa.** O mestre escreve *"Você rola 1d20 e tira 17 no teste de Furtividade, esgueirando-se sem ruído…"* — **sem** ter chamado `rollDice`. O número é alucinado. O jogador vê um resultado mecânico que não existe no log de dados (US-09), e o painel lateral não mostra rolagem nenhuma → **confusão** ("de onde veio esse 17?").
2. **Rolagem para trivialidade.** O mestre injeta um teste onde não há desafio ("role para caminhar até a taverna", "role Percepção" sem o jogador ter procurado nada), quebrando o fluxo e treinando o jogador a esperar dado a cada passo.

### Por que a solução atual não basta

Hoje a defesa é **100% prompt** — é uma instrução, não uma garantia. Não há **nenhum** pós-processamento da narração no código: em `ai.service.ts` (`onFinish`, `:308-336`) o `finalText` é persistido cru, e no `GameView.tsx` (`:136-141`) o cliente só desescapa `\n`/`\"` do stream. Se o modelo vaza um resultado inventado, ele:

- é **mostrado** ao jogador (stream direto),
- é **persistido** como `NARRATION` (`ai.service.ts:331`),
- **realimenta** os turnos seguintes (vira histórico/`memorySummary` — US-18) e reforça o padrão.

Nenhuma verificação confronta a prosa com a verdade do Game Server. A `rollDice` até registra um evento `DICE` por rolagem real (`ai.service.ts:145`), então o sistema **sabe** exatamente quais rolagens aconteceram no turno — mas esse conhecimento **nunca chega ao cliente**: o stream só carrega texto (`0:`), reset (`R`), inventário (`I:`) e HP (`H:`), e `getTurns` (US-18) só mapeia `NARRATION`/`ACTION`. A rolagem real é **invisível na UI**. Resultado: o único número que o jogador chega a ver é justamente o que o LLM inventa na prosa — o vácuo que causa a confusão.

### A proposta

Uma **rede de segurança determinística** (defesa em profundidade, não substituição do prompt): depois que o modelo termina, **remover da narração qualquer frase que declare um resultado numérico de rolagem/teste**. O contrato é simples e à prova de alucinação:

> **Números de rolagem NUNCA pertencem à prosa.** A transparência mecânica (o breakdown "2d6+3: [4,2] +3 = 9") é entregue pelo evento `DICE`/painel (US-09), não pelo narrador. O narrador só interpreta o resultado **qualitativamente** ("sua lâmina encontra a brecha"). Logo, qualquer resultado numérico de teste no texto é, por definição, ou ruído duplicado ou alucinação → **removido**.

Isso dispensa o casamento frágil "número da prosa ↔ rolagem real": não é preciso saber se o "17" é verdadeiro, porque **nenhum** número de teste deveria estar na prosa. Some as duas fontes de confusão de uma vez.

E — o que fecha o ciclo — a rolagem real passa a ser **exibida com clareza no chat, num bloco próprio, IMEDIATAMENTE ANTES da narração** do mestre: `🎲 Teste de Furtividade — 1d20+5: [14] +5 = 19`. A ordem do turno já garante isso: a `rollDice` resolve **antes** do texto (`dm-system.ts:138`), então o evento `DICE` é emitido no stream antes do primeiro token de prosa. O jogador lê primeiro o número **do sistema**, depois a narração que o interpreta ("sua lâmina encontra a brecha") — sem número, mas coerente com o resultado. Nada de "de onde veio esse 17": o 19 está ali em cima, rotulado, vindo do Game Server.

A segunda metade — **rolar só para desafio real, nunca para trivialidade** — é a lógica de rolagem manual: a rolagem é executada **pelo mestre, para o jogador**, via `rollDice` (transparente, US-09), e **somente** quando a ação escolhida tem desfecho genuinamente incerto. Esta story endurece o gate (já esboçado em `dm-system.ts:138`) e o cobre com eval.

---

## Escopo

### Dentro do escopo

- **Bloco de rolagem antes da narração**: o evento `DICE` (fórmula, `rolls`, `modifier`, `total` — o breakdown de US-09) é emitido no stream do chat (novo frame `D:`) e renderizado como um **bloco mecânico distinto imediatamente antes** da bolha de narração do mestre. A `reason` da rolagem vira o rótulo ("Teste de Furtividade"). Vários dados no turno → vários blocos, em ordem.
- **Persistência/replay do bloco (US-18)**: `getTurns` passa a incluir os eventos `DICE` na sequência, para que os blocos de rolagem sobrevivam a um reload e fiquem na posição certa (antes da narração daquele turno), não só no stream ao vivo.
- **Função pura de saneamento** `stripFabricatedRolls(text): { clean, removed }` em `packages/shared` — detecta e remove trechos que declaram resultado numérico de rolagem/teste. Retorna também o que removeu (para telemetria/teste). Testada com casos PT-BR e EN.
- **Aplicação no servidor**: em `ai.service.ts` `onFinish`, sanear `finalText` **antes** de persistir a `NARRATION` (`:323-333`) e antes de alimentar o resumo (US-18). O histórico nunca guarda rolagem inventada.
- **Aplicação no cliente**: em `GameView.tsx`, passar o buffer acumulado (`dmText`) pelo mesmo `stripFabricatedRolls` ao renderizar, para que um vazamento no stream não chegue aos olhos do jogador (granularidade de frase — ver Notas).
- **Telemetria de vazamento**: quando o saneador remove algo, logar (`console.warn` + contador) para medir com que frequência cada modelo desobedece — insumo para US-17 (comparação de modelos).
- **Gate de rolagem manual (desafio real ≠ trivialidade)**: reforço explícito no prompt (`dm-system.ts`) de que só ações de desfecho incerto **escolhidas pelo jogador** disparam `rollDice`; atividades triviais (andar, falar, olhar um item que já carrega) não rolam. Coberto por eval de comportamento.
- **Rolagem iniciada pelo jogador**: quando o jogador pede explicitamente ("quero rolar 1d20", "rolo Percepção"), o mestre roteia pela `rollDice` — **nunca** narra um número de próprio bico. O resultado vem do Game Server e aparece no evento `DICE`/painel (US-09). É a mesma garantia da metade automática vista do outro lado: **todo** número que o jogador vê é rolagem real do sistema, inclusive as que ele mesmo pediu. Reforço no prompt + eval.
- **Eval**: caso `evals/cases/us-29-rolagens.ts` que (a) testa o saneador de forma determinística (entra prosa com "total de 20", sai sem) e (b) alimenta um cenário-isca ("o jogador só atravessa a praça") e afirma que a saída não contém resultado de rolagem.

### Fora do escopo

- **Casar o número da prosa com a rolagem real** (validar que o "17" bate com o `DICE` do turno) — desnecessário: a regra é remover **todo** número de teste da prosa, não auditá-lo. Mais simples e mais robusto.
- **Impedir o modelo de chamar `rollDice`** para uma trivialidade — se ele chamar, a rolagem é real e transparente (US-09); o custo é um dado a mais, não confusão. O gate é por prompt + eval de comportamento, não por bloqueio de tool (bloquear exigiria classificar "trivialidade" no servidor — heurística frágil, story futura se virar problema).
- **UI dedicada de "botão de rolar"** (o jogador clicar num dado em vez de digitar) — a Fase 1 cobre o pedido em linguagem natural via `rollDice`; um controle visual de dados é story futura de UX. Aqui garantimos só que o pedido do jogador vira rolagem **real**, não um número inventado.
- **Stripping token-a-token em tempo real** — o vazamento é sempre uma frase inteira; sanear por frase quando a linha fecha basta (ver Notas).

---

## Design do bloco de rolagem

O evento `DICE` já existe (`DiceResult = { formula, rolls, modifier, total }` + a `reason`, logado em `ai.service.ts:145`). Falta só **transportá-lo e renderizá-lo**:

- **Stream**: novo frame `D:<json>` emitido quando a `rollDice.execute` resolve, antes dos tokens `0:` daquele step. Payload: `{ label, formula, rolls, modifier, total }` (`label` = `reason`).
- **Render** (bloco antes da bolha de narração):

  ```
  🎲 Teste de Furtividade
  1d20+5: [14] +5 = 19
  ```

  Visualmente separado da prosa (não é fala, não é opção). Mono/tabular para o breakdown.
- **Histórico**: `getTurns` intercala os eventos `DICE` do turno antes da `NARRATION` correspondente, para o replay pós-reload manter a mesma ordem.
- **Modelo de mensagem no cliente**: `Message` ganha um tipo `roll` (além de `user`/`dm`), com os campos do `DiceResult`. Sem novo estado de servidor — o `EventLog` `DICE` já é a fonte.

---

## Design da detecção

`stripFabricatedRolls` remove uma frase/linha quando ela **declara um resultado numérico de teste ou rolagem**. Sinais (regex, case-insensitive, PT-BR + EN), removendo a frase inteira que os contém:

| Padrão (exemplos) | Por quê |
|---|---|
| `total de <n>` / `total of <n>` num teste/rolagem | resultado declarado |
| `tira <n>` / `rola(gem) … <n>` / `you roll(ed) … <n>` | ato de rolar com número |
| `<n>d<n>` seguido de `:` ou `=` com resultado | breakdown na prosa (pertence ao painel, US-09) |
| `teste de <Perícia> … <n>` / `<Skill> check … <n>` | resultado de teste |
| `resultado: <n>` / `result: <n>` em contexto de rolagem | idem |

Regra de corte: **remover a frase** (do início até o `.`/`!`/`?`/quebra de linha delimitador), não o texto todo — preservar a narração ao redor. Se a remoção esvaziar um parágrafo, colapsar linhas em branco duplicadas.

> **Falsos positivos:** números que não são rolagem (HP, "3 goblins", "duas moedas", ano, hora) **não** casam — os padrões exigem vocabulário de rolagem/teste perto do número. Casos de fronteira ("levou 8 de dano") ficam **de fora** do escopo desta story: dano é resultado de mecânica já resolvida por tool, não uma rolagem narrada; só filtramos o vocabulário de *rolagem/teste*. Cada padrão nasce com um caso no teste.

**Onde vive (fonte única):** `packages/shared/src/narration/strip-rolls.ts`, exportado pelo índice do pacote. Servidor (`ai.service.ts`) e cliente (`GameView.tsx`) chamam **a mesma** função — um saneador, dois pontos de chamada.

---

## Critérios de aceite

- [ ] Uma rolagem real (`rollDice`) aparece como um **bloco de rolagem distinto ANTES** da narração do mestre daquele turno, com rótulo (`reason`) e breakdown (`1d20+5: [14] +5 = 19` — mesmo dado de US-09). (`GameView.tsx` + frame `D:` em `ai.service.ts`)
- [ ] O número no bloco é **exatamente** o `total`/`rolls` do evento `DICE` do Game Server — não um valor da prosa. (o bloco lê o `DiceResult`, não o texto)
- [ ] Após reload, o bloco de rolagem persiste e reaparece na posição certa (antes da narração daquele turno). (`getTurns` inclui eventos `DICE` — US-18)
- [ ] Existe `stripFabricatedRolls(text)` puro em `packages/shared`, sem dependência de runtime, exportado pelo índice do pacote. (`packages/shared/src/narration/strip-rolls.ts`)
- [ ] Dada a prosa `"Com um total de 20 no teste de Percepção, você nota a sombra."`, a saída **não** contém `20`, nem `total`, nem `teste de Percepção`, mas preserva a frase seguinte se houver. (teste unitário PT-BR)
- [ ] Idem para EN: `"You roll a 17 on your Stealth check and slip past."` → removido. (teste unitário EN)
- [ ] Um breakdown na prosa (`"1d20+5: [14] +5 = 19"`) é removido do texto exibido — o breakdown legítimo vem do evento `DICE`/painel (US-09), nunca da narração.
- [ ] Números que **não** são rolagem sobrevivem: `"Três goblins bloqueiam a ponte; você tem 8 de HP."` passa **intacto**. (teste de falso-positivo)
- [ ] O saneador roda no servidor **antes** de persistir a `NARRATION` e de alimentar o resumo: um turno em que o modelo vazou um resultado grava no `EventLog` o texto **já limpo**. (`ai.service.ts` `onFinish` + teste)
- [ ] O saneador roda no cliente sobre o buffer renderizado: um vazamento no stream não permanece na tela após a linha fechar. (`GameView.tsx`)
- [ ] Quando o saneador remove algo, há um log/contador de vazamento (para US-17). (verificável no console/telemetria)
- [ ] O prompt do DM deixa explícito que **só** ações de desfecho incerto escolhidas pelo jogador disparam `rollDice`; trivialidades (andar, falar, inspecionar item carregado) **não** rolam. (`dm-system.ts`)
- [ ] Quando o jogador **pede** uma rolagem ("quero rolar 1d20"), o mestre chama `rollDice` e o número exibido é o do evento `DICE` do Game Server — não um valor narrado à parte. O prompt instrui isso explicitamente. (`dm-system.ts` + eval de comportamento)
- [ ] **Eval / teste de regressão (saneador):** tabela de casos `(prosa com resultado inventado) → (prosa sem número de teste)` passa, incluindo PT-BR, EN e o caso de falso-positivo. (`evals/cases/us-29-rolagens.ts`)
- [ ] **Eval / teste de regressão (gate):** um cenário-isca em que o jogador apenas atravessa a praça (ação trivial) não produz, na saída final saneada, nenhum resultado de rolagem. (`evals/cases/us-29-rolagens.ts`)

---

## Notas de implementação

- **Frame `D:` no stream** (`ai.service.ts`): emitir na `rollDice.execute`, no mesmo ponto onde o `DICE` é logado (`:143-158`), antes dos tokens de texto do step. O cliente (`GameView.handleLine`) ganha um ramo `line.startsWith('D:')` que injeta uma `Message` de tipo `roll` antes da bolha `dm` corrente — espelho dos ramos `I:`/`H:` já existentes (`:125-135`).
- **`getTurns` intercala `DICE`** (US-18): hoje o mapa só trata `NARRATION`/`ACTION`; incluir `DICE` como uma mensagem `roll` na ordem do `EventLog` para o replay bater com o ao vivo.
- **`Message` ganha tipo `roll`** no `GameView`: `{ role: 'roll', ...DiceResult, label }`. Render dedicado (não reusa a bolha de prosa). Ordem natural: dado resolve antes do texto → bloco antes da narração, sem lógica de ordenação extra.
- **Uma função, dois chamadores** (evita divergência): `stripFabricatedRolls` em `packages/shared`; `ai.service.ts` a aplica em `finalText` (`:323`) antes dos dois `eventLog.create` e do `summarizeOldTurns`; `GameView.tsx` a aplica no `dmText` acumulado no ponto onde já pós-processa o stream (`:136-142`). Não reimplementar de nenhum lado.
- **Granularidade de frase, não de token** (`ponytail`): o vazamento é sempre uma sentença inteira. Sanear quando uma linha/frase fecha (servidor: texto completo no `onFinish`; cliente: ao encontrar `\n` ou fim de frase no buffer) é suficiente e simples. Stripping mid-token fica de fora — sem ganho real.
- **Regex conservadora:** exigir vocabulário de rolagem/teste **perto** do número (`\b(total|tira|rola|roll|teste|check|d\d+|resultado|result)\b` numa janela) para não comer números legítimos. Cada padrão adicionado ganha um caso de teste no mesmo commit.
- **Não tocar em `rollDice`:** a rolagem real e seu evento `DICE` (US-09) continuam iguais — o saneador só mexe em **texto de narração**, nunca em mecânica.
- **Ordem no `onFinish`:** sanear **depois** de reconstruir o `shown`/`finalText` (`:316-323`) e **antes** de persistir (`:327-333`), para que histórico e resumo nasçam limpos.
- **Narração pós-rolagem (qualitativa):** o prompt deve instruir que, depois de uma `rollDice`, a prosa interprete o resultado **sem citar o número** (o número está no bloco `D:` acima) — "alto = sucesso, baixo = falha", como `dm-system.ts:82` já esboça para o modo Free. O jogador lê o bloco (número real) e a narração (sentido) lado a lado; o saneador garante que nenhum número escape para a prosa mesmo que o modelo insista.
- **Gate no prompt:** a regra já existe em `dm-system.ts:138` ("Roll ONLY when… genuinely uncertain… Do NOT spontaneously inject ability checks"). Reforçar com a palavra "manual/desafio real vs. trivial" e um exemplo WRONG ("role para caminhar até a taverna") ao lado dos exemplos já presentes. Sem novo campo de dado.

---

## Questões em aberto (resolvidas)

1. **Saneador remove a frase inteira ou só o trecho numérico?**
   **Decisão:** a frase inteira até o delimitador (`.`/`!`/`?`/quebra) — "Com um total de 20 no teste de Percepção, você nota a sombra" sem o número vira gramática quebrada. Remove a oração do resultado e mantém o restante do parágrafo. Reavaliar só se aparecer caso em que a frase mistura resultado e narração essencial.
2. **`console.warn` basta para a telemetria de vazamento, ou já persistir num contador por modelo?**
   **Decisão:** `console.warn` + contador em memória na Fase 1. Quando US-17 precisar do número por modelo, promover para métrica persistida. YAGNI até lá.
3. **O gate de trivialidade deve virar bloqueio no servidor (recusar `rollDice` para ação trivial) algum dia?**
   **Decisão:** não na Fase 1 — classificar "trivial" no servidor é heurística frágil e uma rolagem trivial real ainda é transparente (só um dado a mais, não confusão). Fica no prompt + eval. Vira story se a eval mostrar reincidência alta.

---

## Referências no código

- `packages/shared/src/narration/strip-rolls.ts` — **novo**: `stripFabricatedRolls` (função pura + teste ao lado).
- `apps/api/src/ai/ai.service.ts` — `onFinish` (`:308-336`); aplicar o saneador em `finalText` antes de persistir a `NARRATION` e de `summarizeOldTurns`. Também o binding de `rollDice` (`:136-158`) e o evento `DICE` (`:145`) — fonte legítima que a story protege.
- `apps/web/src/components/game/GameView.tsx` — `handleLine` (`:113-147`, ramos `I:`/`H:`); adicionar ramo `D:` e o tipo de mensagem `roll` + render do bloco; aplicar o saneador no buffer de narração. `loadHistory`/`getTurns` (`:68-72`) devem trazer os eventos `DICE`.
- `apps/api/src/adventure/adventure.service.ts` (ou onde vive `getTurns`) — mapa de `EventLog`; incluir `DICE` na sequência de turnos servida (hoje só `NARRATION`/`ACTION`).
- `packages/ai-engine/src/prompts/dm-system.ts` — regras anti-fake-roll já existentes (`:81`, `:127`, `:138`); reforçar o gate "desafio real vs. trivial" com exemplo.
- `apps/api/src/game/dice.service.ts` — `DiceService` (RNG criptográfico); a ÚNICA autoridade de rolagem — inalterada.
- `evals/cases/us-29-rolagens.ts` — **novo**: eval determinístico do saneador + cenário-isca do gate.

### Referências externas (regras)

- [US-09 — Rolagem de dados transparente](./user-stories.md) — o breakdown (`2d6+3: [4,2] +3 = 9`) é entregue pelo evento `DICE`/painel, nunca pela prosa; base do contrato "número de teste não pertence à narração".
