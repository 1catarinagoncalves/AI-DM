# US-256 — Jogador entra na tela de chat antes do resto da aventura terminar de gerar

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** [US-255](./US-255-start-reordenado-apos-locais-nomeados.md) (`start` precisa já estar posicionado depois de `locations` — sem isso a fatia parcial liberada nem teria o gancho pronto) · [US-234](./US-234-gate-regenera-on-fail-com-saneamento.md) (gate + regenera-on-fail — a tensão central desta story) · [US-235](./US-235-gatilho-assincrono-tela-de-espera-erro-retry.md) (gatilho assíncrono + polling que esta story adianta)
**Relacionado:** [backlog-motor-de-geracao-de-aventuras.md](./backlog-motor-de-geracao-de-aventuras.md) (MA-1/MA-4/MA-5, o desenho que esta story evolui)
**Criada em:** 2026-09-17 — desmembrada da US-255 original a pedido da mantenedora, pra reordenação do campo (pronta pra implementar) não ficar presa atrás de uma decisão de arquitetura ainda em aberto.

---

## História

> **Como** jogadora,
> **quero** ver a abertura da minha aventura assim que o gancho (`start`) estiver pronto, sem esperar locais/desafios/encontros/objetivo/fecho ramificado terminarem de gerar,
> **para que** a espera entre criar o personagem e começar a jogar caia pro tempo de UMA fatia da autoria, não da autoria inteira + gate + narração de abertura + extração de cena.

---

## Contexto e motivação

### O caminho de espera hoje

`createForCharacter` já é assíncrono (US-235): a `Adventure` nasce em `GENERATING` e o controller devolve na hora; quem acompanha é o polling do frontend (`pollAdventureStatus`, [SetupWizard.tsx:1011](../../../apps/web/src/components/setup/SetupWizard.tsx)), que só sai do loop quando o status vira `ACTIVE`. Entre `GENERATING` e `ACTIVE` hoje cabe, em série:

1. `generateAdventure` → **uma** chamada bloqueante (`generateObject`, [ai.service.ts:1571](../../../apps/api/src/ai/ai.service.ts)) que só resolve quando o objeto INTEIRO (`world`…`followUps`, 11 campos) sai pronto — com escada de até 3 modelos se um falhar.
2. O gate (US-234, `generateWithGate`) pode **regenerar a CHAMADA 1 inteira** até `maxAttempts` vezes se `parse`/grafo/orçamento/saneamento reprovar.
3. `finalizeGeneratedAdventure` ainda faz MAIS duas chamadas de LLM em série — `generateOpeningNarration` ([adventure.service.ts:707](../../../apps/api/src/adventure/adventure.service.ts)) e `extractOpeningScene` ([adventure.service.ts:742](../../../apps/api/src/adventure/adventure.service.ts)) — antes de gravar e virar `ACTIVE`.

O jogador só vê a tela de chat depois de TODA essa cadeia. O `start` é conteúdo que já existe muito antes do fim dela — é só a chamada 1 que não expõe nada até acabar por inteiro.

### Por que reordenar o campo (US-255) não basta sozinho

`generateAdventureAuthoring` usa `generateObject` — chamada **atômica**: o SDK só devolve o `object` quando o JSON inteiro fecha. A US-255 muda a ORDEM em que o modelo escreve os campos, mas ninguém do lado de fora enxerga nada até a `Promise` inteira resolver. Pra realmente liberar o jogador assim que `start` existir, a chamada precisa **streamar** o objeto parcial (`streamObject`/`partialObjectStream` do AI SDK) e o backend precisa reagir no meio do stream, não só no fim.

---

## Escopo

> Todo o escopo abaixo está bloqueado até a Questão em aberto #1 ser decidida — é ela que determina o desenho de implementação, não só um detalhe dentro dele.

### Dentro do escopo

- Trocar `generateObject` por `streamObject` em `generateAdventureAuthoring`, consumindo `partialObjectStream` até os campos `world`…`start` estarem completos.
- Minting parcial: assim que `factions`/`npcs`/`locations`/`start` (+ `summary`/`story`/`world`) estiverem prontos no stream, mintar ids de facção/NPC/local **só dessa fatia** (mesma lógica de `generateAdventure`, [adventure.service.ts:267-300](../../../apps/api/src/adventure/adventure.service.ts), aplicada a um subconjunto) e semear o ledger (`seedLedgerFromGeneratedAdventure`, adaptado pra aceitar um artefato parcial).
- Rodar `generateOpeningNarration` + `extractOpeningScene` sobre essa fatia parcial, assim que ela estiver pronta — sem esperar o resto do stream.
- Um novo estado da `Adventure` (nome a definir — candidato `OPENING_READY`, ou o polling passa a aceitar `ACTIVE` mais cedo com um adendo de "resto ainda gerando") que o frontend trata como "pode entrar no chat".
- `runAdventureGeneration` continua rodando o resto do stream (`challenges`…`followUps`) e o gate completo (US-234) em background, depois do jogador já estar na tela de chat — sem bloquear a UI.

### Fora do escopo

- **Decidir sozinho o que acontece se o gate reprovar DEPOIS do jogador já ter visto a abertura** — é exatamente a Questão em aberto #1; esta story não resolve, só levanta as opções.
- **Mudar o conteúdo/instrução de `generateOpeningNarration`** — ela continua recebendo o que já recebe hoje, só mais cedo.
- **Streaming da narração de abertura em si pro chat** (efeito "digitando") — discussão separada de UX de chat.
- **Multiplayer** — fora da fase 1.
- **Repartir a autoria em duas chamadas de LLM** (opção C da Questão em aberto #1) — se essa for a opção escolhida, vira story própria (reabre a decisão "call único" da US-232/MA-1 deliberadamente, não é ajuste incremental desta).

---

## Questões em aberto

1. **O que fazer quando o gate (US-234) reprova o resto do artefato DEPOIS que o jogador já viu a abertura gerada a partir da fatia parcial?** Três caminhos, nenhum escolhido ainda:
   - **(A) Aceitar o risco.** Libera cedo sempre; se o gate reprovar depois, o jogador já viu um hook que não vai bater 100% com a aventura final persistida (raro — telemetria da US-234 mostra reprovação como exceção, não regra — mas existe). Mais simples de implementar.
   - **(B) Gate parcial antes de liberar.** Roda uma fatia do gate (ex.: `checkNoOrphans`/`checkAdventureGraph` só sobre `factions`/`npcs`/`locations` recebidos) antes de liberar o jogador; o resto do gate (challenges/encounters/objective/branchedResolution, que dependem de `locationIndex` cruzando pra fora da fatia já vista) roda depois, sobre o stream completo. Reduz mas não elimina o risco do item A (a fatia early pode passar no gate parcial e o restante ainda reprovar, mas isso já congelou os locais/facções/NPCs que o jogador viu).
   - **(C) Duas chamadas de autoria.** Quebra a chamada 1 em duas (a fatia até `locations`/`start` primeiro, o resto depois usando a primeira como contexto fixo) — evita streaming, mas reabre a decisão deliberada "call único" da US-232/MA-1 e dobra round-trips de rede mesmo no caminho feliz.

   Decisão pendente da mantenedora antes de iniciar qualquer parte deste escopo.

2. **Nome e semântica do novo estado da `Adventure`.** Reaproveitar `ACTIVE` mais cedo (mais simples, mas o campo deixa de significar "aventura pronta por inteiro") ou criar um estado novo tipo `OPENING_READY` (mais claro, mas todo consumidor de `status` — polling, telas, talvez outras queries — precisa aprender o estado novo). Depende também da escolha do item 1 (se a opção for (A)/(B), faz sentido `OPENING_READY`; se (C), pode nem precisar de estado novo — a 1ª chamada já devolve algo "completo o bastante" pra ser tratado como um sub-artefato).

---

## Critérios de aceite

- [ ] Definidos depois da decisão da Questão em aberto #1 — não travar critérios em cima de um desenho ainda não escolhido.

---

## Notas de implementação

- **`generateObject` → `streamObject` não é drop-in.** A escada de modelos hoje (`for (const model of authoringModels)`, [ai.service.ts:1569](../../../apps/api/src/ai/ai.service.ts)) tenta o próximo arm inteiro só quando o `await` anterior lança. Com stream, uma falha no MEIO do stream (depois de já ter emitido `start` pro jogador) não pode simplesmente "cair pro próximo modelo" sem descartar o que o jogador já viu — o fallback de escada precisa de uma régua nova pra esse caso (abortar e reiniciar do zero silenciosamente perde a fatia já liberada; não abortar deixa a `Adventure` num estado parcial órfão).
- **`seedLedgerFromGeneratedAdventure`** ([apps/api/src/adventure-generation/seed-ledger.ts](../../../apps/api/src/adventure-generation/seed-ledger.ts)) hoje espera um `GeneratedAdventure` completo (schema `.parse()` já passou) — precisa de uma variante ou flexibilização pra aceitar a fatia parcial se a Questão em aberto #1 for resolvida como (A) ou (B).
- **`maxTokens: 16000`** no `generateObject` atual já existe por causa de truncamento em modelos verbosos (comentário [ai.service.ts:1544](../../../apps/api/src/ai/ai.service.ts)) — streaming não muda esse limite, mas o `AbortSignal.timeout(AUTHORING_TIMEOUT_MS)` da escada precisa ser revisto: hoje ele aborta a chamada inteira; com stream, um timeout no MEIO pode acontecer depois de `start` já ter sido consumido.
- ai-engine roda de `dist` — `pnpm --filter @ai-dm/ai-engine build` depois de editar `src`, se a instrução de prompt mudar junto.

---

## Referências no código

- [`apps/api/src/ai/ai.service.ts:1551-1590`](../../../apps/api/src/ai/ai.service.ts) — `generateAdventureAuthoring`, `generateObject` → candidato a `streamObject`.
- [`apps/api/src/adventure/adventure.service.ts:216-412`](../../../apps/api/src/adventure/adventure.service.ts) — `generateAdventure`, minting hoje só roda depois do objeto inteiro existir.
- [`apps/api/src/adventure/adventure.service.ts:666-756`](../../../apps/api/src/adventure/adventure.service.ts) — `runAdventureGeneration`/`finalizeGeneratedAdventure`, onde o novo estado intermediário entraria.
- [`apps/api/src/adventure-generation/adventure-gate.ts`](../../../apps/api/src/adventure-generation/adventure-gate.ts) — gate US-234, a tensão da Questão em aberto #1.
- [`apps/web/src/components/setup/SetupWizard.tsx:1011`](../../../apps/web/src/components/setup/SetupWizard.tsx) — `pollAdventureStatus`, onde o frontend passaria a aceitar o estado antecipado.
- [US-255](./US-255-start-reordenado-apos-locais-nomeados.md) — pré-requisito: posição do `start` no schema.
