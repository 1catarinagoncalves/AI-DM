# US-194 — Abertura e encontro 1 competem como cena inicial

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** [US-193](./US-193-encontros-sem-cadeia-causal-entre-si.md) (é ela que torna o encontro 1 a porta de entrada da trilha — sem a cadeia, tirar `start` só troca uma cena solta por outra) · [US-166](./US-166-motor-gera-multiplos-encontros.md) (`drafts[0]` — o encontro 1 já vem com local e NPCs resolvidos) · [US-34](./US-34-qualidade-da-narracao-do-dm.md)/[US-168](./US-168-abertura-narra-gancho-fixo-nao-aventura-gerada.md) (`generateOpeningNarration` + a fagulha de `buildOpeningInstruction` — é lá que a abertura de verdade nasce)
**Reverte parte de:** [US-172](./US-172-abertura-gerada-nao-copia-gancho-fixo.md) (criou `generateOpeningBeat`) · [US-180](./US-180-abertura-ignora-vinculos-do-personagem.md) (ancoragem em `background`/`origin` + estilos Enraizada/Confronto) · [US-182](./US-182-abertura-mira-apelo-de-recompensa-heroismo-descoberta.md) (2 dos 3 apelos) — as três investiram no `start` como beat pronto; esta story move o que sobrevive para `buildOpeningInstruction` e nomeia o que morre
**Relacionado:** [US-169](./US-169-quest-gerada-ganha-objetivo-e-conclusao-acionavel.md) (`objective` é o que a `Quest` passa a carregar como alvo, no lugar da cena de abertura) · [US-190](./US-190-antagonista-vira-passo-proprio-entre-segredos-e-encontros.md)/[US-191](./US-191-antagonista-vira-occupant-do-local-do-confronto-final.md) (o antagonista chega à abertura hoje via `generateOpeningBeat`) · [US-150](./US-150-gate-antes-de-persistir-aventura-gerada.md) (`start` continua no schema, o gate não muda)

**Criada em:** 2026-08-24 — levantada durante a revisão da US-193: se o `goal` do encontro 1 passa a nascer da premissa/complicação (a trilha começa ali), `start` fica escrevendo a MESMA cena inicial por um caminho paralelo, sem saber que o encontro 1 existe.

---

## História

> **Como** jogadora,
> **quero** que a primeira cena narrada seja o primeiro encontro da aventura,
> **para que** eu não seja apresentada a um local e uma tensão que a aventura depois ignora, e para que a trilha comece de fato no turno 1.

---

## Contexto e motivação

### O problema observado

Duas coisas decidem "onde a aventura começa", e elas não se falam:

1. **`generateOpeningBeat`** ([ai.service.ts](../../../apps/api/src/ai/ai.service.ts), `OPENING_BEAT_SCHEMA`) escreve `start`: 1-2 parágrafos *in medias res*, ancorados em UMA das `locations` recebidas — qualquer uma.
2. **O encontro 1** ([US-166](./US-166-motor-gera-multiplos-encontros.md)) tem local próprio, decidido pela distribuição temática ([US-187](./US-187-distribuicao-tematica-de-locationid-baseada-em-registry.md)), e com a [US-193](./US-193-encontros-sem-cadeia-causal-entre-si.md) passa a ter um `goal` ancorado na premissa/complicação — que é literalmente a função de uma cena de abertura.

As duas rodam em `Promise.all` ([adventure.service.ts:311](../../../apps/api/src/adventure/adventure.service.ts)), então nenhuma pode ver a outra. Nada garante que o local de `start` seja o local do encontro 1 — nem que a tensão que ele planta tenha continuidade em qualquer um dos 8.

### `start` não é o texto que a jogadora lê

Importante pro dimensionamento: a primeira narração é `generateOpeningNarration` ([US-34](./US-34-qualidade-da-narracao-do-dm.md)). `start` tem dois consumidores, ambos internos:

- [adventure.service.ts:457](../../../apps/api/src/adventure/adventure.service.ts) — `mainQuest = summary + "\n" + start`, insumo da abertura;
- [adventure.service.ts:564](../../../apps/api/src/adventure/adventure.service.ts) — `Quest.description`.

Ou seja: uma chamada de LLM inteira produz uma cena que só serve de semente pra OUTRA chamada de LLM escrever a cena de verdade.

### Defeito de brinde: a cena de abertura volta pro Mestre todo turno

`Quest.description` é relido a cada turno — [ai.service.ts:621](../../../apps/api/src/ai/ai.service.ts) remonta `mainQuest = title + description + objective` e injeta no prompt. Uma cena *in medias res*, que por natureza acontece uma vez, é reapresentada ao Mestre como "a quest principal" no turno 40. Isso já é defeito hoje, independente da US-193, e some junto com `start`.

### Por que não foi resolvido "fazendo a abertura ler o encontro 1"

A US-193 considerou e descartou serializar `generateOpeningBeat` depois de `generateClosing` (custa um round-trip inteiro no `Promise.all`). Remover a chamada é estritamente mais barato: não há o que ordenar quando não há chamada.

---

## Escopo

### Dentro do escopo

- **Apagar** `generateOpeningBeat`, `OPENING_BEAT_SCHEMA` e `buildOpeningBeatPrompt` ([ai.service.ts](../../../apps/api/src/ai/ai.service.ts)). `Promise.all` de `generateAdventure` fica com duas pernas (`generateClosing` + `generateAntagonistLocationProse`).
- **`start` continua no `GeneratedAdventureSchema`** — o campo não sai, o gate não muda, nenhuma fixture de artefato muda. O que muda é a ORIGEM: passa a ser composto por código a partir do encontro 1 (`drafts[0]`), sem IA.
  **Formato: briefing ROTULADO, não parágrafo colado.** `start` nunca foi lido pela jogadora (é semente de `generateOpeningNarration`, ver acima), e colar `boxedText` + `goal` numa prosa só herda o pior dos dois: lê como narração, não é narrável. Campo nomeado o narrador consome melhor, e a proibição `do NOT quote it verbatim` ([dm-system.ts:695](../../../packages/ai-engine/src/prompts/dm-system.ts)) fica trivial de obedecer quando a semente obviamente não é prosa pronta.
  **Rótulos em INGLÊS**, não em português: `start` vira `mainQuest`, consumido por `buildOpeningInstruction` — arquivo escrito inteiro em inglês e compartilhado por `pt-BR` + `en-US` (ver *Notas de implementação*). Rótulo PT numa mesa em inglês é o mesmo vazamento que os commits `996a41a` (`Connection`/`Memento` na narração da origem) e `ac9bea5` (palavra-semente EN como nome de local) já corrigiram uma vez. EN fixo também dispensa mapa por locale: o valor de `Scene type` já É a chave crua em inglês.
  Quatro linhas. Três saem do `EncounterDraft` ([adventure.service.ts:45](../../../apps/api/src/adventure/adventure.service.ts)); **`goal` NÃO** — ele vem de `encounterSituations[0].goal`, retorno de `generateClosing`, e portanto só existe DEPOIS do `Promise.all` (ver o bullet da função pura, abaixo):
  - `Location:` — `drafts[0].location.title` + o `boxedText` dele (prosa já escrita por `generateLocationsAndNpcs`, já no tom sorteado);
  - `Situation:` — `goal` do encontro 1 (por que a personagem está ali — a US-193 garante que ele nasce da premissa/complicação);
  - `Scene type:` — `drafts[0].type` (`combat`/`skill`/`social`) verbatim, o que faz a instrução ramificar (bullet do `buildOpeningInstruction` abaixo);
  - `Present:` — nomes de `drafts[0].npcs`, e **`none` quando a lista é vazia**. Não é borda: `type: 'skill'` devolve `npcs: []` SEMPRE ([`buildEncounterDraft`](../../../apps/api/src/adventure/adventure.service.ts)) e o multiset das posições 1-7 tem 3 `skill`, então encontro 1 sem NPC é frequente. `none` explícito segue o padrão do mesmo prompt (`Conditions: ... : 'none'`, [dm-system.ts:562](../../../packages/ai-engine/src/prompts/dm-system.ts)) e diz ao Mestre que não há com quem falar; omitir a linha deixaria a etiqueta ausente e o critério de aceite com duas formas válidas.
  - **`complications` fica de fora**: é a virada da cena, e `start` é persistido. Mesma disciplina do `conclusionHint` (US-169), que existe mas nunca é exposto em turno passivo.
- **A prosa vem de `drafts[0].location`, NUNCA de `locationsWithAntagonist`.** O local do encontro 1 pode ser o MESMO do encontro 8 (`pickLocationIdForType` é round-robin sobre `locations[]`, e o schema exige só UM local `vibe:'combat'`, [ai.service.ts:1612](../../../apps/api/src/ai/ai.service.ts)) — e `generateAntagonistLocationProse` reescreve o `boxedText` desse local citando o antagonista **pelo nome** ([adventure.service.ts:344](../../../apps/api/src/adventure/adventure.service.ts)). Compor `start` a partir do array patcheado faria a primeira cena que a jogadora lê nomear o vilão, matando no turno 1 a revelação que os 8 encontros deveriam construir. Hoje isso não acontece por construção — `drafts[i].location` guarda a referência PRÉ-patch, e o `.map` do patch cria array novo — mas é frágil o bastante (o array patcheado é o que vai pro artefato; procurar o local por `id` nele é a implementação óbvia e errada) pra merecer o comentário no ponto da composição, com número desta US — e, sobretudo, a assinatura do bullet seguinte.
- **A composição é função pura de assinatura restritiva: `composeStartBriefing(draft: EncounterDraft, goal: string): string`.** Não é preciosismo: é o que torna o erro do bullet acima impossível de COMPILAR. Como `goal` só chega depois do `Promise.all`, a composição cai fatalmente no trecho onde `locationsWithAntagonist` e `encounters[]` já estão em escopo; uma função que não aceita array de locais fecha a porta que um comentário só consegue sinalizar. Recebe o `EncounterDraft` inteiro (que carrega a referência PRÉ-patch em `.location`), nunca um `locationId`.
- **O local do encontro 1 sai do hint de orientação da US-166.** `nextUnrevealedEncounterLocation` ([next-encounter-hint.ts](../../../apps/api/src/adventure-generation/next-encounter-hint.ts)) devolve o encontro de menor `id` cujo local ainda não é `revelado` no ledger — e `seedLedgerFromGeneratedAdventure` semeia TODO local com `revelado: false` ([seed-ledger.ts:63](../../../apps/api/src/adventure-generation/seed-ledger.ts)). Resultado: o bloco `## Situação em aberto mais próxima` ([dm-system.ts:642](../../../packages/ai-engine/src/prompts/dm-system.ts)) afirma *"The party has not yet discovered «X» ... never describe what's there before the party arrives"* sobre o local onde a abertura ACABOU de narrar a personagem. Hoje isso é acidente de ~1 em 8 (o beat escolhe local qualquer); com esta story vira 100% e persiste até o Mestre chamar `recordEntity` por conta própria. Correção: `nextUnrevealedEncounterLocation` pula `encounter-1`, uma linha na função pura.
  **Não** resolver por `revelado: true` no ledger: a `nota` do local acumula `objetivo/comportamento/complicação` de todos os encontros hospedados ali ([seed-ledger.ts:63](../../../apps/api/src/adventure-generation/seed-ledger.ts)), então revelar tira o `⚠ OCULTO` da complicação do encontro 1 — e, no caso de colisão encontro 1 × encontro 8, entrega junto o segmento do encontro final e o `boxedText` reescrito com o nome do antagonista. É a opção que parece mais correta semanticamente e é a que vaza.
- **`Quest.description` passa a ser `generated.summary`** (a premissa), não mais a cena de abertura. O que o Mestre relê todo turno vira o que de fato é durável; o alvo já está em `objective` (US-169).
  **A duplicação que isso cria morre em `mainQuest`, não em `Quest.title`** (ver *Riscos*): [ai.service.ts:621](../../../apps/api/src/ai/ai.service.ts) para de concatenar `title` e `description` quando são o mesmo texto. Uma linha, backend puro, nada gravado muda de forma. A alternativa — inventar um título distinto da premissa — exige decidir (e talvez gerar) esse título e reescreve dado persistido. Nenhuma das duas quebra a UI: grep em `apps/web/src` não achou consumidor de `Quest.title`.
- **`mainQuest` da criação** ([adventure.service.ts:457](../../../apps/api/src/adventure/adventure.service.ts)) continua `summary + start` — a fagulha da PRIMEIRA cena permanece completa, só que agora ancorada no local do encontro 1. É one-time por construção: nasce no `create`, não é relida depois.
- **`buildOpeningInstruction`** ([dm-system.ts](../../../packages/ai-engine/src/prompts/dm-system.ts)): o texto atual manda *renderizar* uma cena pronta — comentário da US-168 é explícito sobre isso (*"`mainQuest` já chega como beat pronto (generateOpeningBeat, 1-2 parágrafos); pedir para RENDERIZAR essa cena, não para expandi-la"*). Com `start` composto e não mais narrado, a instrução volta a pedir **compor** a cena naquele local, *in medias res*, mantendo a régua de concisão do `NARRATIVE_CRAFT_SECTION`.
- **Migrar as instruções que sobrevivem** de `generateOpeningBeat` para `buildOpeningInstruction`, em uma linha cada: *in medias res* (US-172) e os 2 de 3 apelos — recompensa/heroísmo/descoberta (US-182). Só essas duas: ver a cláusula do antagonista em *Fora do escopo*.
- **`buildOpeningInstruction` ramifica o *in medias res* por `Tipo de cena`.** É aqui que a abertura ganha temperatura, não em `boxedText` — e é a única mudança desta story que altera a FORMA da cena que a jogadora lê. Uma linha por ramo, porque "no meio da ação" tem forma diferente em cada tipo:
  - `combat` — a ação já começou: a primeira frase é violência ou a iminência dela, não a chegada ao local;
  - `skill` — o obstáculo já bloqueia, com relógio correndo;
  - `social` — alguém já se dirigiu à personagem; abre no meio da conversa, não antes dela.

  Sem isso, a abertura fria é "você chega em X, X é assim, o que faz?" — nenhuma das opções oferecidas é mais atraente que outra e a primeira escolha da jogadora é arbitrária. Com o ramo, a primeira ação dela é uma REAÇÃO a algo já em curso, que é mais fácil de tomar e ancora a trilha da US-193 desde o turno 1. Custo: zero chamada de IA, zero latência — `type` já está decidido antes do `Promise.all`.
- **Testes:** os de `adventure.service.test.ts` que provam parâmetros de `generateOpeningBeat` (`:1115`, `:1121`, `:1135`, `:1210`, e a perna dele em `:1421`) são removidos junto com a função, cada remoção com nota de US no lugar certo. Entram no lugar: `start` cita/situa o local do encontro 1; `start` NÃO contém `complications`; `start` de um encontro 1 `type:'skill'` sai com `Present: none`; `Quest.description === generated.summary`; `mainQuest` não repete a premissa duas vezes; `nextUnrevealedEncounterLocation` nunca devolve `encounter-1`; `generateAdventure` faz duas chamadas no `Promise.all`, não três.
  Os fakes de `AiService` que declaram `generateOpeningBeat` ([:48](../../../apps/api/src/adventure/adventure.service.test.ts), [:471](../../../apps/api/src/adventure/adventure.service.test.ts), [:1527](../../../apps/api/src/adventure/adventure.service.test.ts)) são `as unknown as AiService` — a propriedade órfã NÃO quebra `typecheck` sozinha. Tirar mesmo assim, junto com a função; só não conte com o compilador pra lembrar.

### Fora do escopo

- **Ancoragem da abertura em `background`/`origin` como parâmetro dedicado (US-180).** `generateOpeningNarration` já recebe `background` e o system prompt já tem a seção dele ([dm-system.ts:315](../../../packages/ai-engine/src/prompts/dm-system.ts)) — o vínculo continua visível ao Mestre sem instrução nova. O que morre é a preferência EXPLÍCITA ("prefira ancorar a cena no local/NPC alinhado ao vínculo"), porque o local agora é decidido pelo encontro 1, não escolhido. `originNarrative` não é passado hoje a `generateOpeningNarration`; se a eval acusar perda, é story própria.
- **Instrução de nomear o antagonista na abertura (US-190/US-191).** A permissão da US-191 Parte 2 continua valendo, mas por onde já vale hoje: `seedLedgerFromGeneratedAdventure` cria `antagonistPublicEntity` com **`revelado: true`** ([seed-ledger.ts:105](../../../apps/api/src/adventure-generation/seed-ledger.ts)) — nome e local visíveis ao Mestre como qualquer NPC revelado — e `antagonistHiddenEntity` com `revelado: false` protege want/method/trait/weakness/connection sob o marcador `⚠ OCULTO`. Repetir "pode nomear, nunca a `weakness`" em `buildOpeningInstruction` é redundante com um gate mais forte que já roda. Pior: o `local` do antagonista no ledger é o local do encontro **8**, e a abertura agora acontece no local do encontro **1** — uma instrução nesse sentido vira empurrão pra citação forçada (rumor, marca, nome sussurrado) em TODA abertura, exatamente o que a trilha da US-193 deveria entregar aos poucos. Sem instrução: o nome aparece quando couber.
- **Os dois estilos nomeados Enraizada/Confronto (US-180).** Eles existiam pra escolher o TIPO da cena de abertura; agora o `type` do encontro 1 (`combat`/`skill`/`social`, US-166) já faz essa escolha, e de forma consistente com o resto da aventura.
- **Sistemas sem motor de geração (Free).** Sem `mainQuest`, `buildOpeningInstruction` cai no `hookSeed` (US-168) e `openingText` cai no `profile.hookSeed` estático ([adventure.service.ts:504](../../../apps/api/src/adventure/adventure.service.ts)). Nenhum desses caminhos muda.
- **Migrar as `Quest.description` já gravadas.** As que existem seguem com a cena de abertura antiga no campo — sem backfill, mesma decisão da US-193 para artefatos anteriores.
- **Os outros dois canais que entregam o antagonista ao Mestre no turno 1 — [US-199](./US-199-antagonista-publico-no-ledger-desde-o-turno-1.md).** Esta story mata a instrução explícita (*"pode nomeá-lo e deixar sinal de sua presença/método na cena"*, no prompt de `generateOpeningBeat`) e garante que o `boxedText` de `start` seja o PRÉ-`generateAntagonistLocationProse`. Sobrevivem: (a) `antagonistPublicEntity`, semeado `revelado: true` com o `local` do encontro 8 ([seed-ledger.ts:107](../../../apps/api/src/adventure-generation/seed-ledger.ts)) — nome e endereço do vilão no `## Registro de entidades` da abertura e de todo turno, sem `⚠ OCULTO`; (b) `objective`, que por exigência da US-169 cita `want`/`method` e volta ao Mestre a cada turno em `mainQuest`. **Consequência para o último critério de aceite (seed jogado à mão):** se o Mestre ainda puxar a mesa para o antagonista, isso é a US-199, não regressão desta story — o que se verifica aqui é que a primeira cena acontece no local do encontro 1.
- **A abertura consumir `complications` ou `unlocks` do encontro 1.** O Mestre já vê os dois pelo ledger, sob o gate `⚠ OCULTO` (US-170); a fagulha da abertura não é o lugar de repeti-los.

---

## Critérios de aceite

- [ ] **Baseline da eval de narração ANTES de tocar em `dm-system.ts`:** aberturas geradas pelo código de hoje pontuadas pela eval da [US-36](./US-36-eval-de-qualidade-da-narracao.md); o mesmo caso roda depois da mudança e não regride. Sem o antes, "a abertura ficou melhor" é opinião.
  **Não feito nesta implementação** — `dm-system.ts` já foi editado antes de rodar o baseline; rodar agora não teria "antes" pra comparar. `DM_LIVE_EVAL` chama LLM de verdade (custo/tempo) — decisão de rodar fica com quem revisa. `pnpm eval` (suite estrutural, sem LLM) está verde.
- [x] `generateOpeningBeat`, `OPENING_BEAT_SCHEMA` e `buildOpeningBeatPrompt` não existem mais no repo (`pnpm dead` limpo, grep vazio).
- [x] `generateAdventure` faz **duas** chamadas no `Promise.all`, não três — uma chamada de LLM a menos por aventura gerada.
- [x] `start` cita ou situa o local do encontro 1 (`drafts[0].location.title`), sempre — verificação estrutural, não semântica: é composição por código.
- [x] `start` sai como briefing rotulado **em inglês**: as quatro etiquetas (`Location:`, `Situation:`, `Scene type:`, `Present:`) presentes, e `Scene type:` bate literalmente com `drafts[0].type`. Nenhum rótulo em português no texto composto (o `boxedText`/`goal` seguem no idioma da mesa — só as ETIQUETAS são fixas).
- [x] Encontro 1 `type:'skill'` (que nunca tem NPC): `start` sai com `Present: none`, não com etiqueta vazia.
- [x] `start` **não** contém o `complications` do encontro 1.
- [x] `composeStartBriefing` recebe `EncounterDraft` + `goal` e nada mais — não há caminho de tipo pra passar `locations`/`locationsWithAntagonist`/`locationId`.
- [x] **Encontro 1 e encontro 8 no MESMO local: `start` não contém o nome do antagonista.** Teste direto do caso de colisão (forçar `pickLocationIdForType` a devolver o mesmo `locationId` nas duas pontas) — o `boxedText` de `start` é o pré-`generateAntagonistLocationProse`, enquanto `locations[]` do artefato segue com a prosa reescrita. Os dois divergirem é o comportamento correto, não um bug de sincronia.
- [x] `buildOpeningInstruction` carrega os três ramos de *in medias res* (`combat`/`skill`/`social`) — teste de substring por ramo, mesmo padrão dos outros guards de prompt.
- [x] `Quest.description === generated.summary`; `objective`/`conclusionHint` seguem como a US-169 deixou.
- [x] O bloco `## Main quest` do turno não repete a premissa duas vezes: com `title === description`, `mainQuest` ([ai.service.ts:621](../../../apps/api/src/ai/ai.service.ts)) emite o texto UMA vez (+ `objective`).
- [x] `nextUnrevealedEncounterLocation` nunca devolve `encounter-1` — o bloco `## Situação em aberto mais próxima` jamais aponta pro local onde a abertura acontece. Teste direto: ledger recém-semeado (todos os locais `revelado: false`) devolve `encounter-2`, não `encounter-1`.
- [x] `GeneratedAdventureSchema.parse()` passa sem mudança no schema; gate (US-150) inalterado.
- [x] `buildOpeningInstruction` pede COMPOR a cena, não renderizar beat pronto, e carrega *in medias res* + os 2 de 3 apelos. Teste de substring, mesmo padrão dos outros guards de prompt.
- [x] Free (sem `mainQuest`) continua caindo no `hookSeed`, com teste que já existe verde.
- [x] `pnpm typecheck`, testes dos módulos tocados e `pnpm eval` verdes.
- [ ] Seed jogado à mão: a primeira cena narrada acontece no local do encontro 1, e o que a jogadora faz naturalmente ali é o `goal` daquele encontro.
  **Não feito nesta implementação** — exige rodar a API com secrets reais e criar um personagem de verdade. Verificação estrutural equivalente já cobre o mecanismo (ver critérios acima); falta a confirmação end-to-end de que a narração de fato honra o briefing.

---

## Notas de implementação

- **Ordem em relação à US-193 — gate original CAÍDO.** A intenção original era rodar e **passar** a eval de embaralhamento da US-193 antes desta story encostar em `dm-system.ts`, pra ler a eval de narração sem contaminação de uma abertura que também mudou. Essa eval virou [US-195](./US-195-eval-de-embaralhamento-da-cadeia-causal.md) — extraída DURANTE a implementação da US-193 porque a heurística determinística, testada com dados reais, não discriminou de forma confiável (ver *Achado* daquela story). Ela não existe hoje, e US-195 é "Planejada", não bloqueante.
  **Decidido em 2026-08-24: US-194 segue sem esperar por US-195.** US-193 já fechou schema/prompt/guard limpos sem essa eval bloquear o resto de si mesma — não faz sentido travar OUTRA story por uma eval que nem a própria origem exige mais. A rede de segurança que sobra é a mesma que a US-193 tem hoje: o último critério de aceite desta story (seed jogado à mão) mais o baseline da eval de narração (primeiro critério) — as duas mudanças continuam se provando por evals/verificações DIFERENTES (embaralhamento × qualidade de narração), só que a primeira é manual em vez de automática por ora.
- **`dm-system.ts` é compartilhado.** `buildDmSystemPrompt`/`buildOpeningInstruction` valem para Free + D&D e para `pt-BR` + `en-US` ao mesmo tempo — não há fork. Toda mesa existente sente a mudança da fagulha, não só as aventuras novas.
- **Uma chamada a menos é o ganho lateral, não o objetivo.** O objetivo é uma única autoridade sobre a primeira cena. Se a eval de narração acusar regressão, a resposta certa é o passo de reescrita de prosa descrito em *Riscos* (recebe o local, não escolhe) — não ressuscitar `generateOpeningBeat`, que reintroduz a colisão.
- **`start` composto é determinístico.** Diferente de todo o resto do artefato, ele deixa de depender do modelo: mesmo `characterId`+`order` ⇒ mesmo `start` (o `boxedText` de origem continua sendo prosa do modelo, mas já rolada em outro passo).

### Riscos e sugestões para a implementação

- **A abertura pode ficar mais fria.** `generateOpeningBeat` tinha um prompt inteiro dedicado a *in medias res*, estilo e apelos; `boxedText` foi escrito pra descrever um LUGAR, não pra abrir uma aventura. É o risco central desta story.
  **O eixo, porém, não é "prosa quente × prosa fria".** `start` não é lido pela jogadora nem hoje — é semente de `generateOpeningNarration` dos dois lados da mudança. O que se perde ao apagar `generateOpeningBeat` não é temperatura de prosa, é a SITUAÇÃO dramática (algo já em curso) que aquele prompt fabricava. E situação é justamente o que `drafts[0]` já tem em campo estruturado: `goal` (por que ela está ali) e `type` (que forma a ação tem). Daí as duas defesas de custo zero já no escopo — o briefing rotulado, que entrega esses campos sem fingir prosa, e o ramo por `Tipo de cena` em `buildOpeningInstruction`, que é o prompt dedicado do `generateOpeningBeat` reencarnado sem chamada de IA e, crucialmente, sem decidir o local.
  A defesa de MEDIÇÃO continua sendo o baseline da eval de narração no primeiro critério de aceite — não a leitura de uma abertura só.
- **Se a eval acusar regressão mesmo assim, o fallback já tem forma — e não é `generateOpeningBeat`.** O padrão certo é o de `generateAntagonistLocationProse` ([ai.service.ts:1911](../../../apps/api/src/ai/ai.service.ts)): um passo que RECEBE o local pronto e só reescreve `boxedText`, aplicado a `drafts[0].location` pra aquecê-lo como abertura. Ele não reintroduz a colisão que esta story mata — a colisão eram duas autoridades sobre ONDE a aventura começa, e essa chamada não escolhe lugar nenhum. Custo: precisa rodar depois dos `drafts`, então serializa (ou vira 4ª perna de um `Promise.all` posterior) e soma espera na criação de personagem. Por isso fica FORA do escopo: só entra com número da eval na mão, como story própria.
- **`goal` é texto de Mestre, não de jogador.** Ele entra em `start` (que vira `mainQuest` na criação, prompt do Mestre) e nunca é narrado verbatim — `buildOpeningInstruction` já proíbe citar a fagulha (*"do NOT quote it verbatim"*). Confirmar que a proibição continua na frase reescrita.
- **Remoção de teste é perda de cobertura silenciosa.** Os 5 testes de `generateOpeningBeat` morrem; os 4 critérios novos de `start` entram no lugar. Contar antes e depois, pra não sair no vermelho.
- **`pnpm dead` (knip) é o verificador honesto da limpeza** — se `characterAnchors` ou algum helper ficar sem consumidor depois da remoção, é ele quem aponta.
- **`Quest.title` já é `generated.summary` hoje** ([adventure.service.ts:563](../../../apps/api/src/adventure/adventure.service.ts)). Trocar `Quest.description` para o mesmo `generated.summary` faz `title` e `description` ficarem idênticos — e `mainQuest` é remontado todo turno como `${title}\n${description}` ([ai.service.ts:621](../../../apps/api/src/ai/ai.service.ts)), o que duplica a premissa duas vezes seguidas no bloco `## Main quest` de todo prompt do Mestre. São TRÊS cópias, não duas: `Adventure.title` também é `generated.summary` ([adventure.service.ts:534](../../../apps/api/src/adventure/adventure.service.ts)). **Decidido: `mainQuest` para de concatenar quando `title === description`** (bullet no Escopo) — uma linha, backend puro, nada persistido muda de forma; a alternativa (dar um título próprio à quest) precisa inventar esse título e reescreve dado gravado.

---

## Referências no código

- [`apps/api/src/ai/ai.service.ts`](../../../apps/api/src/ai/ai.service.ts) — `OPENING_BEAT_SCHEMA`, `buildOpeningBeatPrompt`, `generateOpeningBeat` (apagados); `generateOpeningNarration` (fica); `:621`, onde `mainQuest` é remontado todo turno.
- [`apps/api/src/adventure/adventure.service.ts`](../../../apps/api/src/adventure/adventure.service.ts) — `:311` (`Promise.all`), `:457` (`mainQuest`), `:504` (fallback estático), `:564` (`Quest.description`).
- [`packages/ai-engine/src/prompts/dm-system.ts`](../../../packages/ai-engine/src/prompts/dm-system.ts) — `buildOpeningInstruction` (fagulha da primeira cena), seção de `background`.
- [`apps/api/src/adventure-generation/next-encounter-hint.ts`](../../../apps/api/src/adventure-generation/next-encounter-hint.ts) — `nextUnrevealedEncounterLocation`, que passa a pular `encounter-1`.
- [`apps/api/src/adventure-generation/seed-ledger.ts`](../../../apps/api/src/adventure-generation/seed-ledger.ts) — `:63`, os locais semeados `revelado: false` com `nota` acumulando objetivo/complicação por encontro (o motivo de NÃO revelar o local do encontro 1).
- [`packages/shared/src/types/adventure-generation.ts`](../../../packages/shared/src/types/adventure-generation.ts) — `GeneratedAdventureSchema.start`, que NÃO muda.

### Referências externas

- [The Arcane Library — How to Write a D&D Adventure: The Complete Guide](https://www.thearcanelibrary.com/blogs/news/how-to-write-a-d-d-adventure-the-complete-guide) — o gancho joga a personagem direto na primeira cena; a abertura não é uma cena a mais antes dela.
