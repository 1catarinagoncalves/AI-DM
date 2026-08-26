# US-199 — O antagonista chega ao Mestre já revelado, e o Mestre puxa a mesa pra ele

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** [US-194](./US-194-abertura-e-encontro-1-competem-como-cena-inicial.md) (fecha o TERCEIRO canal — a instrução explícita de nomear o vilão na abertura; sem ela, esta story tapa duas portas de três) · [US-193](./US-193-encontros-sem-cadeia-causal-entre-si.md) (é a cadeia `unlocks` que dá ao Mestre o momento certo de revelar — sem trilha, esconder o nome só adia o vazio) · [US-189](./US-189-antagonista-entra-no-ledger.md)/[US-191](./US-191-antagonista-vira-occupant-do-local-do-confronto-final.md) (criaram as duas entradas do antagonista no ledger)
**Reverte parte de:** [US-191](./US-191-antagonista-vira-occupant-do-local-do-confronto-final.md) Parte 2 — a decisão de deixar o vilão "reconhecível por nome desde a abertura", implementada como `antagonistPublicEntity` com `revelado: true`
**Relacionado:** [US-169](./US-169-quest-gerada-ganha-objetivo-e-conclusao-acionavel.md) (`objective` cita `want`/`method` por exigência de prompt — este story não muda o que é GERADO, só quando é EXPOSTO) · [US-75](./US-75-dimensao-de-proveniencia-no-ledger.md) (os dois eixos `sabido`/`revelado`, que já são o mecanismo aqui) · [US-115](./US-115-reconciliacao-de-entidades-pos-turno.md) (mede a omissão de `recordEntity`, que vira risco de verdade quando a revelação passa a depender dela)

**Criada em:** 2026-08-25 — observação de jogo da mantenedora: "a narração sempre começa falando sobre o antagonista, e isso faz com que o personagem seja levado direto para ele pelo Mestre". A investigação achou TRÊS canais que entregam o vilão ao Mestre no turno 1; a US-194 fecha um.

---

## História

> **Como** jogadora,
> **quero** descobrir quem é o antagonista jogando a aventura, não na primeira frase da primeira cena,
> **para que** os 8 encontros tenham o que revelar e o confronto final valha alguma coisa.

---

## Contexto e motivação

### Os três canais

O Mestre não "decide" falar do vilão no turno 1: ele recebe o vilão três vezes antes de escrever a primeira palavra.

1. **Instrução explícita no prompt da abertura.** `generateOpeningBeat` ([ai.service.ts](../../../apps/api/src/ai/ai.service.ts)) manda, literalmente: *"O antagonista já está decidido (nome/method/trait abaixo) — pode nomeá-lo e deixar sinal de sua presença/método na cena"*. É a US-191 Parte 2 escrita em prompt.
   **Este canal é da [US-194](./US-194-abertura-e-encontro-1-competem-como-cena-inicial.md)**, que apaga a função inteira. Fora do escopo daqui.
2. **O ledger entrega nome e endereço, sem gate.** `antagonistPublicEntity` nasce `revelado: true` ([seed-ledger.ts:107](../../../apps/api/src/adventure-generation/seed-ledger.ts)), com `local` = o local do encontro **8**. `formatEntities` ([entities.ts:118](../../../packages/ai-engine/src/entities.ts)) renderiza a linha SEM o marcador `⚠ OCULTO`:

   ```
   - [NPC] Malvora — em Ruína do Farol
   ```

   Isso vai ao bloco `## Registro de entidades` do system prompt ([dm-system.ts:622](../../../packages/ai-engine/src/prompts/dm-system.ts)) — e o mesmo array `seededEntities` é passado à abertura ([adventure.service.ts:495](../../../apps/api/src/adventure/adventure.service.ts)) antes de ser persistido ([:546](../../../apps/api/src/adventure/adventure.service.ts)). O Mestre sabe o nome do vilão e onde ele mora desde a criação do personagem, com permissão explícita de usar (é o que `revelado: true` significa no contrato do bloco).
3. **`objective` repete o vilão todo turno.** `generateClosing` exige *"SEMPRE o `want`/`method` do antagonista"* (US-169), e `mainQuest` é remontado como `title + description + objective` a cada turno ([ai.service.ts:628](../../../apps/api/src/ai/ai.service.ts)). Ou seja: no turno 1 e no turno 40, o bloco `## Main quest` diz ao Mestre "o alvo desta aventura é impedir que Malvora drene a vila pra alimentar o ritual".

### Por que os canais 2 e 3 são a MESMA story

Fechar só o canal 2 é teatro: esconder `Malvora` no ledger enquanto o `objective` a nomeia duas linhas acima, no mesmo prompt, não esconde nada. Fechar só o canal 3 deixa o nome e o endereço à mão. As duas mudanças só significam alguma coisa juntas — daí uma story, não duas.

### Por que isso é regressão de produto, não bug de implementação

A US-191 Parte 2 fez isso de propósito: *"o produto passou a querer o vilão reconhecível por nome desde a abertura"*. O que mudou entre lá e aqui é a US-193: antes dela os 8 encontros eram cenas soltas, e antecipar o vilão era a única coisa que dava direção à mesa. Com a cadeia causal (`unlocks` de um encontro é o `goal` do próximo), a revelação progressiva passa a ter por onde acontecer — e o vilão entregue de graça no turno 1 gasta, sem jogo, o que os 8 encontros deveriam construir.

---

## Escopo

### Dentro do escopo

- **`antagonistPublicEntity` nasce `revelado: false`** ([seed-ledger.ts:107](../../../apps/api/src/adventure-generation/seed-ledger.ts)). Uma linha. O Mestre continua vendo nome e local — precisa, pra ser consistente —, mas sob o marcador `⚠ OCULTO`, cujo contrato já está escrito no prompt ([dm-system.ts:616](../../../packages/ai-engine/src/prompts/dm-system.ts)): *"NEVER reveal it: do not name it, do not hint at it... until the fiction makes the character discover it, then call `recordEntity`"*. Nenhum mecanismo novo — é o eixo `revelado` da US-75 aplicado a quem faltava.
- **As DUAS entradas continuam existindo.** Colapsar em uma só é a simplificação óbvia e errada: o `recordEntity({ nome: 'Malvora', revelado: true })` que revela o NOME promoveria junto o `nota` da entrada oculta (`want`/`method`/`trait`/**`weakness`**/`connection`), entregando a fraqueza do vilão no turno em que a jogadora descobre que ele existe. As duas entradas são exatamente a defesa contra isso (US-191) e permanecem.
- **A ordem do array vira contrato, com teste.** `mergeEntities` casa por `nome` normalizado e patcheia a **primeira** ocorrência ([entities.ts](../../../packages/ai-engine/src/entities.ts), `findIndex`). Como `antagonistPublicEntity` é emitido ANTES de `antagonistHiddenEntity` no `return` ([seed-ledger.ts:134-135](../../../apps/api/src/adventure-generation/seed-ledger.ts)), a promoção acerta a pública e a oculta continua oculta — que é o comportamento desejado. Hoje isso funciona por acidente de ordem; com esta story vira o mecanismo de revelação, e ganha teste de regressão + comentário com número desta US no ponto do `return`.
  - **Onde fica o comentário:** só no `return` — estende o bloco US-189/191 já existente ([seed-ledger.ts:93-104](../../../apps/api/src/adventure-generation/seed-ledger.ts)) com o número desta story. A linha isolada `revelado: false` (`:111`) não ganha comentário próprio; o PORQUÊ dela é o mesmo do bloco, comentário duplicado nos dois pontos é redundância.
- **`objective` só entra no `## Main quest` depois da revelação.** Em [ai.service.ts:628](../../../apps/api/src/ai/ai.service.ts), `mainQuest` passa a concatenar `objective` apenas quando a entrada do antagonista no ledger já está `revelado: true`. Antes disso o bloco emite só a premissa — que, com a [US-194](./US-194-abertura-e-encontro-1-competem-como-cena-inicial.md), é o que `Quest.description` guarda.
  - **Identificação da entrada:** `generatedAdventure.antagonist.name` (o artefato já é lido no mesmo método, [:718](../../../apps/api/src/ai/ai.service.ts)) casado com `norm()` de [entities.ts](../../../packages/ai-engine/src/entities.ts) — a função já é exportada e já é reusada assim pela US-171. Nada de comparar string crua.
  - **Ordem no arquivo:** `const entities` é declarado hoje em [:719](../../../apps/api/src/ai/ai.service.ts), depois de `mainQuest`. Subir a declaração — não duplicar a leitura de `adventure.entities`.
  - **Forma do gate:** `composeMainQuestText` ([ai.service.ts:261](../../../apps/api/src/ai/ai.service.ts)) já tem o guard pra `objective: null` (evita vazar `"null"` no bloco, US-169). Gatear ANTES da chamada — `objective: antagonistRevealed ? primary.objective : null` — reusa esse guard de graça. Não mudar a assinatura da função: ela continua pura, testável isolada, só formata texto; a decisão de revelado é de quem chama.
  - **Check extraído em função própria.** Mesmo padrão de `composeMainQuestText` ("extraída só pra ser testável isolada"): `isAntagonistRevealed(antagonistName, entities)` — `false` se `antagonistName` ou `entities` ausentes, senão `entities.some(e => norm(e.nome) === norm(antagonistName) && e.revelado === true)`. Caller monta o bypass do caso Free por fora: `generatedAdventure ? isAntagonistRevealed(...) : true` — sem `generatedAdventure` a função nem é chamada, `objective` passa direto (ver *Fora do escopo*).
- **Nada gravado muda de forma.** `Quest.objective` continua persistido igual (US-169 intacta); o gate é na MONTAGEM do prompt. `GeneratedAdventureSchema` não muda, gate da US-150 não muda, nenhuma migração.
- **Testes:** entrada pública nasce `revelado: false`; as duas entradas continuam existindo, com a pública primeiro no array; `recordEntity({ nome, revelado: true })` promove a pública e deixa a oculta intacta (regressão da ordem); `mainQuest` omite `objective` com o antagonista não revelado e o inclui depois; quest legada sem `objective` (`null`) continua sem vazar `"null"` — o guard da US-169 fica.

### Fora do escopo

- **O canal 1 (instrução no prompt da abertura).** É a [US-194](./US-194-abertura-e-encontro-1-competem-como-cena-inicial.md).
- **`antagonistHiddenEntity`.** Não muda: `want`/`method`/`trait`/`weakness`/`connection` seguem sob `revelado: false` até o Mestre promovê-la — e a disciplina "weakness não vaza antes de merecer" (US-153 #4) continua sendo dela.
- **O encontro 8 ecoar `want`/`method`.** Regra de `generateClosing`, correta: o confronto final PRECISA ser sobre o vilão. O defeito é ele chegar no turno 1, não existir no turno 8.
- **Instrução nova mandando o Mestre revelar o antagonista em algum ponto.** A promoção por `recordEntity` já é regra geral do bloco de entidades ([dm-system.ts:616](../../../packages/ai-engine/src/prompts/dm-system.ts)); repetir por entidade é o mesmo tipo de redundância que a US-194 recusou. Se a medição mostrar que a revelação não acontece (ver *Riscos*), vira story própria com número na mão.
- **Backfill das aventuras em curso.** Ledger já gravado com `revelado: true` segue como está — mesma decisão da US-193/US-194 para artefatos anteriores. Aventura nova nasce corrigida.
- **Sistemas sem motor de geração (Free).** Sem `generatedAdventure` não há antagonista, não há gate: `mainQuest` cai no caminho de hoje, inclusive quests legadas com `objective: null`.

---

## Critérios de aceite

- [x] `antagonistPublicEntity` nasce `revelado: false` — ledger recém-semeado não tem NENHUMA entrada do antagonista com `revelado: true`.
- [x] O bloco `## Registro de entidades` do turno 1 renderiza a linha do antagonista COM `⚠ OCULTO` (teste de substring sobre `formatEntities`, mesmo padrão dos outros guards de prompt).
- [x] As duas entradas continuam existindo, e a **pública vem antes** da oculta no array devolvido — teste de índice, não de presença.
- [x] `recordEntity({ nome: <antagonista>, revelado: true })` promove a entrada pública e deixa a oculta com `revelado: false` e o `nota` (`want`/`method`/`trait`/`weakness`/`connection`) intocado.
- [x] Com o antagonista não revelado, o bloco `## Main quest` do prompt **não** contém `objective`; depois de revelado, contém.
- [x] O gate identifica a entrada por `generatedAdventure.antagonist.name` via `norm()` — nome com acento/caixa diferente no ledger continua casando.
- [x] Quest legada (`objective: null`) e mesa Free: `mainQuest` idêntico ao de hoje, testes existentes verdes sem alteração.
- [x] `Quest.objective` continua gravado igual; nenhuma migração, `GeneratedAdventureSchema` e o gate da US-150 inalterados.
- [x] `pnpm typecheck`, testes dos módulos tocados e `pnpm eval` verdes.
- [ ] Seed jogado à mão até o 3º ou 4º encontro: o nome do antagonista **não** aparece na abertura, e aparece em algum ponto da trilha — não só no encontro 8. (pendente — validação de mesa, não automatizável)

---

## Notas de implementação

- **Zero chamada de IA nova, zero latência.** As duas mudanças são determinísticas: um booleano na semeadura e um `if` na montagem do prompt.
- **Ordem em relação à US-194.** Podem entrar em qualquer ordem, mas o natural é DEPOIS: enquanto `generateOpeningBeat` existir, o prompt dele manda nomear o vilão e a abertura continua fazendo isso mesmo com o ledger fechado. Entrar antes fecha 2 canais de 3 e o defeito observado persiste.
- **A revelação passa a depender de `recordEntity`.** Hoje o Mestre pode citar o vilão sem chamar tool nenhuma; com esta story, citar sem promover é violação do gate `⚠ OCULTO`. É o mesmo contrato que já vale para segredos (US-151), locais (US-170) e ameaças (US-171) — o antagonista deixa de ser a exceção.

### Riscos e sugestões para a implementação

- **O risco central: a revelação pode nunca acontecer.** Se o Mestre não chamar `recordEntity`, o antagonista fica `⚠ OCULTO` até o encontro 8 e a jogadora chega ao confronto sem nunca ter ouvido o nome — troca um defeito por outro. A [US-115](./US-115-reconciliacao-de-entidades-pos-turno.md) fase A já detecta a omissão de `recordEntity` por turno; usar esse sinal, e o último critério de aceite (seed jogado à mão até o 3º/4º encontro), como a medição desta story. Se der ruim, o fallback é instrução dedicada — story própria, com o número da medição na mão.
- **O gate do `objective` deixa o Mestre sem alvo nos primeiros turnos.** Não fica sem direção: `Quest.description` é a premissa (US-194) e o `goal` de cada encontro vem da cadeia da US-193 — que é exatamente o alvo do turno atual, em vez do alvo do turno 8. Se a eval de narração acusar deriva, a resposta certa é emitir `objective` sem o trecho do vilão, não reabrir o gate.
- **`revelado: false` na entrada pública faz DUAS entradas ocultas com o mesmo nome.** Nenhum consumidor quebra (`formatEntities` renderiza as duas linhas, o Mestre lê nome+local numa e nome+local+nota noutra), mas a linha duplicada no prompt é ruído. Se incomodar na leitura do prompt real, a saída barata é a entrada oculta perder `local` (a pública já o carrega) — verificar no prompt renderizado antes de decidir, não por antecipação.
- **Não resolver por `sabido: 'privado'`.** É o outro eixo (quem no MUNDO pode saber), não o que está em jogo aqui — o vilão ser conhecido pelos NPCs é plausível e desejável; o defeito é a JOGADORA receber isso de graça. Trocar o eixo errado é o tipo de correção que passa no teste e não muda a mesa.
- **Verificado: não interfere no hint do US-166.** `nextUnrevealedEncounterLocation` ([next-encounter-hint.ts:21](../../../apps/api/src/adventure-generation/next-encounter-hint.ts)) casa `revealedTitles` por `entity.nome === location.title` — chave é TÍTULO DE LOCAL, não nome de NPC. `antagonistPublicEntity.nome` é o nome do vilão, nunca colide com título de local seedado à parte. Virar `revelado: false` não muda esse hint; confirmado por leitura, sem teste extra necessário.

---

## Referências no código

- [`apps/api/src/adventure-generation/seed-ledger.ts`](../../../apps/api/src/adventure-generation/seed-ledger.ts) — `:107` (`antagonistPublicEntity`), `:114` (`antagonistHiddenEntity`), `:134-135` (a ordem do `return` que vira contrato).
- [`packages/ai-engine/src/entities.ts`](../../../packages/ai-engine/src/entities.ts) — `formatEntities` (`:118`, o `⚠ OCULTO` em `:130`), `mergeEntities` (upsert por `nome`, primeira ocorrência), `norm` (já exportado).
- [`apps/api/src/ai/ai.service.ts`](../../../apps/api/src/ai/ai.service.ts) — `:628` (`mainQuest`, onde o gate entra), `:718-719` (`generatedAdventure` e `entities`, já lidos no mesmo método).
- [`packages/ai-engine/src/prompts/dm-system.ts`](../../../packages/ai-engine/src/prompts/dm-system.ts) — `:616` (contrato do `⚠ OCULTO`), `:622` (bloco `## Registro de entidades`).
- [`apps/api/src/adventure/adventure.service.ts`](../../../apps/api/src/adventure/adventure.service.ts) — `:474` (`seededEntities`), `:495` (o mesmo array vai à abertura), `:546` (persistido), `:578` (`Quest.objective`).
