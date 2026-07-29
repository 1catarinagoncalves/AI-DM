# US-90 — README de evals com o mapa do subsistema

**Épico:** 5 — Ferramentas de projeto / SDLC
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** nenhuma.
**Nasceu de:** [US-83](./US-83-readme-com-arquitetura-alto-nivel.md) → *Questão em aberto #3* — "vale um terceiro diagrama para a pipeline de evals?". Resposta: **vale um mapa, e ele não cabe no README da raiz.** Esta story é esse mapa. A US-83 mantém no README da raiz só a linha que diz que evals existem e o link para cá.
**Relacionada a:** [US-79](./US-79-consertar-links-quebrados-na-documentacao.md) e [US-82](./US-82-gate-de-convencao-de-nomes-de-arquivo-nos-docs.md) (o gate que este README precisa passar a ter), [US-86](./US-86-gate-de-caminhos-em-arvores-de-diretorio-nos-docs.md) (a árvore de diretórios errada abaixo é exatamente o alvo dela), [US-80](./US-80-ci-typecheck-testes-e-evals.md) (é o que tornou verdadeira a frase "sem evals passando nada é mergeado").
**Criada em:** 2026-07-28

---

## História

> **Como** desenvolvedora ou agente de IA prestes a mexer no DM Agent,
> **quero** um `README` em [`evals/`](../../../evals) que diga onde cada peça da avaliação vive, o que reprova um PR e como rodar cada modo,
> **para que** eu não descubra por tentativa e erro que metade do subsistema mora noutro pacote e que os comandos documentados não existem.

---

## Contexto e motivação

### O problema observado

[`evals/README.md`](../../../evals/README.md) **já existe** — e é o mesmo caso do README da raiz que gerou a [US-83](./US-83-readme-com-arquitetura-alto-nivel.md): escrito certo um dia, o código andou por baixo, nada avisou. Auditoria de 28/07/2026 contra o repo:

| O que o README de evals afirma | O que o repo tem | Onde verificar |
|---|---|---|
| `evals/runner.ts` e `evals/scorer.ts` (bloco de estrutura) | **nenhum dos dois existe.** Não há runner nem scorer próprios: `pnpm eval` é `vitest run --config vitest.eval.config.ts` | [`evals/`](../../../evals), [`vitest.eval.config.ts`](../../../packages/ai-engine/vitest.eval.config.ts) |
| `evals/fixtures/` — "dados de teste reutilizáveis" | a pasta existe e está **vazia** | [`evals/fixtures`](../../../evals/fixtures) |
| 4 casos: `us-08-streaming.ts`, `us-09-dice-roll.ts`, `us-10-rules.ts`, `us-11-natural-language.ts` | **11 casos, e nenhum com esses nomes.** O de us-08 é `us-08-chat.ts`; us-09/10/11 não existem. Reais: us-03, 08, 23, 27, 29, 36, 38, 39, 40, 41, 42 | [`evals/cases`](../../../evals/cases) |
| `pnpm eval --filter us-09`, `--ci`, `--verbose` | **nenhuma das três é flag do vitest.** Não há `--filter` nem `--ci`; verbose é `--reporter verbose` | `npx vitest --help` |
| "Exporte um objeto `EvalCase` com `id`, `description`, `story`, `input`, `expectedTools`, `assertions`" | **0 de 11 casos têm essa forma.** São arquivos vitest comuns: `describe`/`it`/`expect` | [`us-29-rolagens.ts`](../../../evals/cases/us-29-rolagens.ts) |
| Thresholds: tools corretas 90%, ausência de alucinação 95%, state 100% — "onde: asserts dos cases" | **não há mecanismo.** Sem scorer, nada agrega percentual; os asserts são booleanos por caso. As outras 3 linhas da tabela (US-36/US-70) são reais e apontam para [`rubric.ts`](../../../packages/ai-engine/src/rubric.ts) | [`rubric.ts`](../../../packages/ai-engine/src/rubric.ts) |

Duas leituras, as mesmas da US-83:

- **O documento contradiz a si mesmo e ninguém percebeu.** A seção *Comandos* ensina `pnpm eval --filter us-09`; 33 linhas abaixo, a seção da US-36 usa a forma **correta** (`pnpm eval us-36`, positional do vitest). As duas convivem há semanas porque nada compara documento com código.
- **As seções recentes estão certas.** Tudo que a [US-36](./US-36-eval-de-qualidade-da-narracao.md) e a [US-70](./US-70-piso-por-dimensao-e-robustez-do-eval.md) escreveram (linhas 54–113) confere. O apodrecimento é **por idade**, não por descuido: as partes velhas descrevem um design que foi abandonado antes de existir.

### A lacuna maior: o subsistema não tem mapa

Corrigir as 6 linhas acima ainda deixa o problema principal. **A pipeline de evals mora em quatro lugares e nenhum documento os junta:**

1. **[`evals/`](../../../evals)** — os 11 casos vitest, `fixtures/` (vazia), `reports/` (gitignored, [`.gitignore:20`](../../../.gitignore)) e [`PROMPT-ANCHORS.md`](../../../evals/PROMPT-ANCHORS.md), que o README **não menciona**.
2. **[`packages/ai-engine/src/`](../../../packages/ai-engine/src)** — onde a lógica de avaliação de fato vive: `rubric.ts` (rubrica, `DIMENSIONS`, `QUALITY_THRESHOLD`, `DIMENSION_FLOORS`, `gateQuality`), `guardrails.ts`, `narration-gen.ts`, `overlap.ts`, mais os testes que são gates de verdade ([`rubric-drift.test.ts`](../../../packages/ai-engine/src/rubric-drift.test.ts), `rubric.test.ts`, `narrative-bakeoff.test.ts`, `bench-ttft.test.ts`).
3. **Raiz de [`packages/ai-engine/`](../../../packages/ai-engine)** — **6 runners `.mjs` standalone** (`run-bakeoff.mjs`, `onomastica-bakeoff.mjs`, `prompt-ab-bakeoff.mjs`, `location-ab-bakeoff.mjs`, `location-scene.mjs`, `capture-old-location.mjs`), 5 `.bat` de bake-off, dois snapshots, e um segundo README ([`README-bakeoff.md`](../../../packages/ai-engine/README-bakeoff.md)). **Nada disso roda por `pnpm eval`** e nada disso é citado no README de evals.
4. **[`apps/api/src/ai/ai.service.ts`](../../../apps/api/src/ai/ai.service.ts)** — o `liveEvalTurn` (`:1026`), que pontua turnos reais em dev atrás de `DM_LIVE_EVAL`. É o único ponto da pipeline que roda dentro do produto.

Um agente que precise responder *"o que reprova meu PR se eu mexer no prompt?"* tem hoje que abrir os quatro. A resposta real — [`ci.yml:50`](../../../.github/workflows/ci.yml) roda `pnpm eval`, que é vitest sobre `evals/cases/**`, mais o `pnpm test` que carrega o drift guard da rubrica — não está escrita em lugar nenhum.

### Por que a solução atual não basta

O README existente é **estrutura + comandos**, o mesmo formato que falhou na raiz: descreve *onde os arquivos estão* (e erra) em vez de *como o subsistema decide aprovar ou reprovar*. Nenhuma das quatro casas acima é derivável das outras, e a mais surpreendente (os `.mjs` fora do vitest) tem uma razão técnica não óbvia registrada só em [`README-bakeoff.md:3`](../../../packages/ai-engine/README-bakeoff.md): o par `streamText` + vitest pendurava e estourava o timeout.

### A proposta

Reescrever [`evals/README.md`](../../../evals/README.md) como **o mapa do subsistema de avaliação**: quais são os modos de eval, o que cada um gateia, onde cada peça vive e qual chave de API cada modo exige. Todo fato afirmado verificável no repo hoje; o resto sai.

---

## Decisões

### O README de evals responde 3 perguntas, não 30

Ordem fixa, porque é a ordem em que as perguntas aparecem:

1. **O que reprova meu PR?** — `pnpm eval` no CI + os gates que moram no `pnpm test` (drift da rubrica). Nomear os dois; a maioria só conhece o primeiro.
2. **Como rodo, e o que preciso de chave para cada modo?** — os 4 modos (suite vitest, live eval, bake-off `.mjs`, guard de drift) com o comando exato e as env vars exigidas. Modo gated por chave que **pula silenciosamente** sem ela é a pegadinha nº 1 do subsistema.
3. **Onde mexo se quero mudar a barra?** — ponteiro para [`rubric.ts`](../../../packages/ai-engine/src/rubric.ts), não transcrição dos valores.

### Camada 1 da US-83 vale aqui inteira

**Nenhuma lista transcrita.** Não listar os 11 casos (a pasta é a lista), não listar as constantes de threshold com seus valores (o `rubric.ts` é a fonte), não redesenhar a árvore de `evals/`. A tabela de thresholds do README atual é o exemplo perfeito da dívida: 3 das 6 linhas nunca tiveram mecanismo, e sobreviveram porque duplicavam algo que não existia.

**Corolário:** as 3 linhas sem mecanismo (tools 90%, alucinação 95%, state 100%) **saem** em vez de virarem "aspiracional". Threshold sem código que o meça é um número que treina o leitor a não confiar na tabela.

### Um README, com ponteiro para o bake-off — não dois fundidos

[`README-bakeoff.md`](../../../packages/ai-engine/README-bakeoff.md) fica onde está. É documentação de **ferramenta de investigação ad-hoc** (rodar um bake-off de modelos quando se suspeita de regressão), com pré-requisitos de ambiente Windows específicos que não interessam a quem só quer saber o que reprova o PR. O README de evals **linka** e diz em uma linha quando usar. Fundir os dois recria o documento de 113 linhas que ninguém lê até o fim.

### Este README entra no gate de links

Mesma lógica da camada 2 da US-83: caminho escrito como link é caminho verificado; caminho em backtick é invisível. `evals/README.md` hoje **não** é varrido — [`check-doc-links.mjs:36`](../../../scripts/check-doc-links.mjs) varre `docs/` recursivo mais a constante `ROOT_MD`, que tem só `AGENTS.md`, `CLAUDE.md` e `README.md`. Era exatamente por isso que a estrutura com `runner.ts`/`scorer.ts` podia mentir por meses: nenhum daqueles caminhos estava num link.

---

## Escopo

### Dentro do escopo

- Reescrever [`evals/README.md`](../../../evals/README.md) respondendo as 3 perguntas acima, com:
  - **tabela dos 4 modos de eval**: comando, o que gateia (ou "não gateia"), env vars exigidas, onde grava relatório;
  - **mapa das 4 casas** do subsistema em 4 linhas, cada uma um link — sem árvore ASCII;
  - **1 parágrafo** sobre o live eval (`DM_LIVE_EVAL`), incluindo que nunca roda em produção e nunca atrasa o stream;
  - ponteiro para [`README-bakeoff.md`](../../../packages/ai-engine/README-bakeoff.md), [`PROMPT-ANCHORS.md`](../../../evals/PROMPT-ANCHORS.md) e [`estrategia-de-testes.md`](../04-testes/estrategia-de-testes.md).
- **Correção dos 6 fatos falsos** da tabela de auditoria acima.
- **Remoção** do bloco de estrutura, da seção "Adicionando um novo eval case" (descreve uma API que não existe) e das 3 linhas de threshold sem mecanismo.
- Uma seção **"Adicionando um eval case"** curta e verdadeira: é um arquivo vitest em [`evals/cases`](../../../evals/cases) nomeado `us-NN-descricao.ts`, incluído automaticamente pelo `include` do [`vitest.eval.config.ts`](../../../packages/ai-engine/vitest.eval.config.ts) — com a armadilha do import de `ai` registrada (ver *Notas*).
- **Entrar no gate:** somar `evals/README.md` à varredura do [`check-doc-links.mjs`](../../../scripts/check-doc-links.mjs), e escrever todo caminho do README como link relativo.
- Trocar a linha do README da raiz que fala de evals por 1 frase + link para cá (fecha a *Questão #3* da US-83 sem inchar a raiz).

### Fora do escopo

- **Diagrama Mermaid da pipeline.** A US-83 perguntou se valia; a auditoria diz que não: 4 modos independentes que não se encadeiam não formam fluxo, formam lista. Uma tabela de 4 linhas é mais legível e não apodrece por omissão. Se a pipeline algum dia virar sequência real (gerar → julgar → agregar → gatear num só comando), aí vale o diagrama.
- **Consertar a pasta [`evals/fixtures`](../../../evals/fixtures) vazia.** Ou os casos passam a usá-la, ou ela é apagada — as duas são mudança de código, não de documentação. O README só não vai afirmar que ela tem conteúdo. Vira story se incomodar.
- **Mover os 6 `.mjs` e os 5 `.bat`** da raiz do `ai-engine` para um lugar melhor. É refactor com risco real (caminhos relativos de `.env` e de `dist/` hardcoded nos runners) e não é o que a story pede. O README documenta onde estão.
- **Transformar o slop de onomástica em gate.** Já decidido e justificado na [US-70](./US-70-piso-por-dimensao-e-robustez-do-eval.md); depende de a produção reduzir a taxa-base.
- **README por pacote.** Mesma justificativa da US-83: mais README, mais fontes para dessincronizar. Este existe porque `evals/` é um subsistema com 4 casas e regras próprias de gate, não porque todo diretório merece um.

---

## Critérios de aceite

- [x] `evals/README.md` responde, sem o leitor abrir outro arquivo: **o que reprova um PR** que toca o DM Agent, e que isso vem de dois comandos (`pnpm eval` e `pnpm test`), não de um.
- [x] Existe tabela dos **4 modos de eval** com comando, se gateia, e env vars exigidas por cada um.
- [x] **Zero afirmações não verificáveis:** todo caminho citado existe, todo comando citado roda, toda flag citada é aceita pela ferramenta. Especificamente: nenhuma menção a `runner.ts`, `scorer.ts`, `--filter`, `--ci`, `--verbose` ou à interface `EvalCase`.
- [x] O README **não transcreve** a lista de eval cases nem os valores dos thresholds: aponta para [`evals/cases`](../../../evals/cases) e [`rubric.ts`](../../../packages/ai-engine/src/rubric.ts).
- [x] As 4 casas do subsistema (`evals/`, `packages/ai-engine/src/`, runners `.mjs` na raiz do pacote, `liveEvalTurn` na API) estão nomeadas e linkadas.
- [x] Nenhum caminho de arquivo/pasta aparece só entre backticks — todos são link relativo, exceto caminhos que **deliberadamente não existem** (exemplo ilustrativo), que ficam em backtick.
- [x] `pnpm docs:links` passa **e inclui `evals/README.md`** na contagem de arquivos varridos.
- [x] **Regressão do antídoto:** renomear ou mover [`evals/cases`](../../../evals/cases) faz `pnpm docs:links` falhar apontando a linha do README de evals.
- [x] **Teste de regressão:** um agente sem contexto, lendo **só** `evals/README.md`, responde corretamente: (a) qual comando roda os eval cases; (b) por que um eval pode passar sem ter rodado de verdade (chave ausente ⇒ caso pulado); (c) onde fica a rubrica. Hoje o README erra (a) — ensina `--filter` — e não menciona (b).
- [x] `README.md` da raiz cita evals em ≤ 2 linhas e linka para `evals/README.md`, sem repetir comandos.

---

## Notas de implementação

> Dicas para quem implementa. Não é especificação obrigatória.

- **Os 4 modos, medidos em 28/07/2026** — confira antes de escrever, não copie daqui:

  | Modo | Comando | Gateia? | Chaves |
  |---|---|---|---|
  | Suite de eval cases | `pnpm eval` | **sim**, no CI ([`ci.yml:50`](../../../.github/workflows/ci.yml)) | maioria não usa; us-36 exige `OPENROUTER_API_KEY` + `GEMINI_API_KEY`, senão **pula** |
  | Guard de drift da rubrica | `pnpm test` | **sim** | nenhuma (hash puro) |
  | Bake-off / A-B | `node --env-file=..\..\.env run-bakeoff.mjs` | não | varia por runner |
  | Live eval em dev | `DM_LIVE_EVAL` ligado, turno normal | não | `GEMINI_API_KEY` |

- **Armadilha do import de `ai` nos eval cases.** Runner standalone existe porque `streamText` sob vitest pendurava até o timeout ([`README-bakeoff.md:3`](../../../packages/ai-engine/README-bakeoff.md)). Por isso a geração de narração vive em `narration-gen.ts` **dentro do pacote** e o caso a importa por `@ai-dm/ai-engine` — que o [`vitest.eval.config.ts`](../../../packages/ai-engine/vitest.eval.config.ts) aliasa para o `src`. Um caso novo que importe `ai` direto reintroduz o pendura. Vale 2 linhas no README.
- **Somar ao gate de links:** a constante é `ROOT_MD` em [`check-doc-links.mjs:36`](../../../scripts/check-doc-links.mjs). Duas verificações já feitas, não precisa repetir:
  - **Gate de nome (US-82) passa sem exceção nova.** As duas regras só disparam para nome com espaço/não-ASCII ou que comece com `US-`. `README.md`, `PROMPT-ANCHORS.md` e `README-bakeoff.md` passam nas três. Nenhuma entrada em `NAME_ALLOW`.
  - **Separador no Windows — decidido (29/07/2026): normalizar, não `join`.** O problema: a lista é comparada por `.includes(relative(ROOT, abs))` ([`check-doc-links.mjs:105`](../../../scripts/check-doc-links.mjs)) e `relative` devolve `evals\README.md` com barra invertida. Uma entrada escrita `"evals/README.md"` **é varrida** (o `join` da linha 100 normaliza) mas cai fora do `isWritable` — o `--fix` deixaria de reescrever esse arquivo, silenciosamente. `join("evals", "README.md")` conserta **esta** entrada; normalizar conserta a classe inteira, inclusive a próxima entrada que alguém escrever com barra normal. `posix` já está importado na linha 31:

    ```js
    const rel = (abs) => relative(ROOT, abs).split(sep).join(posix.sep);
    const isWritable = (abs) => abs.startsWith(DOCS + sep) || SCANNED_MD.includes(rel(abs));
    ```

    No mesmo commit, **renomear `ROOT_MD` para `SCANNED_MD`**: o nome vira mentira no instante em que `evals/README.md` entra, e o comentário da linha 102 ("os três nomes de `ROOT_MD`") junto com ele. Teste em `check-doc-links.test.mjs`: `isWritable` verdadeiro para o caminho absoluto de `evals/README.md` — falha hoje no Windows, passa depois, e passa nos dois sistemas operacionais.
- **Ordem sugerida:** entrar no gate **primeiro**, com o README velho. O gate acusa os caminhos mortos que ainda estiverem em link e dá a lista de conserto de graça. Escrever primeiro e gatear depois desperdiça essa medição.
- **Não conte casos no texto.** "11 casos" envelhece no próximo `pnpm eval`. Diga "um arquivo por user story em [`evals/cases`](../../../evals/cases)".
- Estilo: mesma regra da US-83 — se uma seção não muda uma decisão de quem lê, corte.

---

## Questões em aberto

1. ~~**`evals/fixtures/` está vazia — apagar ou povoar?**~~ **Resolvido (29/07/2026): apagar.** O argumento "deixar vazia mantém a intenção visível" é falso — `git ls-files evals/fixtures` devolve **0**: git não versiona diretório vazio, então a pasta só existe na máquina de quem a criou. Para quem clona, ela já não existe. A intenção continua registrada onde é versionada: [US-36](./US-36-eval-de-qualidade-da-narracao.md) (*Notas*, "reusar personagens/estados") e [US-70](./US-70-piso-por-dimensao-e-robustez-do-eval.md) ("reusa fixtures da US-36"); quem povoar cria a pasta no mesmo commit. Efeito no mapa: **uma linha a menos**, não uma linha diferente. Continua fora do escopo desta story — mas o commit que apagar a pasta precisa trocar por backtick os **3 links** para `evals/fixtures` que esta US tem (tabela de auditoria, *Fora do escopo*, *Referências*), senão quebra o próprio `pnpm docs:links`.
2. ~~**O gate de links deve varrer todo `*.md` fora de `docs/`, em vez de crescer `ROOT_MD` a cada story?**~~ **Resolvido (29/07/2026): sim, mas não nesta story.** Medido: como [`check-doc-links.mjs:69`](../../../scripts/check-doc-links.mjs) já pula `node_modules` e todo diretório iniciado por `.`, um glob repo-wide pegaria **7 arquivos desejados** (os 3 da raiz + [`evals/README.md`](../../../evals/README.md), [`evals/PROMPT-ANCHORS.md`](../../../evals/PROMPT-ANCHORS.md), [`README-bakeoff.md`](../../../packages/ai-engine/README-bakeoff.md), [`NOTICE-open5e.md`](../../../scripts/srd/NOTICE-open5e.md)) e **5 gerados** (4 em `evals/reports/` + [`GRAPH_REPORT.md`](../../../graphify-out/GRAPH_REPORT.md)). Ignore de 2 diretórios contra allowlist de 7 e crescendo: o glob ganha. O contra-argumento da [US-79](./US-79-consertar-links-quebrados-na-documentacao.md) (rascunho solto) só vale na raiz, e sobrevive mantendo a raiz explícita. **Pegadinha para quem implementar o glob:** `evals/reports/` está no [`.gitignore:19`](../../../.gitignore) **mas 4 `.md` continuam tracked** (entraram antes do ignore) — filtrar por `git ls-files` não basta, a ignore list tem que ser do script. Gatilho para a troca: o **terceiro** pedido de exceção, ou o primeiro link quebrado num `.md` fora da lista. Nesta story: soma-se a entrada e segue.
3. ~~**`PROMPT-ANCHORS.md` deveria estar em `docs/` em vez de `evals/`?**~~ **Resolvido (29/07/2026): fica em `evals/`.** Custo medido do movimento: **9 comentários em 5 arquivos** citam `evals/PROMPT-ANCHORS.md` em prosa ([`us-23`](../../../evals/cases/us-23-dm-ciente-da-ficha.ts), [`us-29`](../../../evals/cases/us-29-rolagens.ts), [`us-40`](../../../evals/cases/us-40-divindade.ts), [`us-41`](../../../evals/cases/us-41-features.ts) e 5× em [`dm-system.test.ts`](../../../packages/ai-engine/src/prompts/dm-system.test.ts)). Nenhum é link markdown — **o gate não pegaria nenhum deles quebrado**, então mover são 9 edições manuais sem rede. E o motivo de cogitar `docs/` era ser vigiado: com `evals/` entrando no gate, ele passa a ser vigiado onde está. Se um dia migrar, a ordem é trocar os 9 comentários por um ponteiro único **antes** de mover; a ordem inversa quebra em silêncio.

---

## Referências no código

- [`evals/README.md`](../../../evals/README.md) — o alvo da story. Linhas 11–52 são as que apodreceram; 54–113 (US-36/US-70) estão corretas e devem sobreviver, encolhidas.
- [`evals/cases`](../../../evals/cases) — um arquivo vitest por user story. **Não** exportam objetos `EvalCase`.
- [`evals/fixtures`](../../../evals/fixtures) — existe, vazia. Ver *Questão em aberto #1*.
- [`evals/PROMPT-ANCHORS.md`](../../../evals/PROMPT-ANCHORS.md) — anchor set do juiz; ausente do README atual.
- [`packages/ai-engine/vitest.eval.config.ts`](../../../packages/ai-engine/vitest.eval.config.ts) — o que `pnpm eval` de fato é: `include` de `evals/cases/**` + alias dos pacotes `@ai-dm/*` para o `src`.
- [`packages/ai-engine/src/rubric.ts`](../../../packages/ai-engine/src/rubric.ts) — rubrica e thresholds. A fonte que a tabela do README deve linkar em vez de copiar.
- [`packages/ai-engine/src/rubric-drift.test.ts`](../../../packages/ai-engine/src/rubric-drift.test.ts) — gate que roda no `pnpm test`, não no `pnpm eval`. É a metade esquecida da resposta "o que reprova meu PR".
- [`packages/ai-engine/run-bakeoff.mjs`](../../../packages/ai-engine/run-bakeoff.mjs) e [`README-bakeoff.md`](../../../packages/ai-engine/README-bakeoff.md) — a terceira casa, fora do vitest por razão técnica registrada.
- [`apps/api/src/ai/ai.service.ts`](../../../apps/api/src/ai/ai.service.ts) — `liveEvalTurn` em `:1026`, atrás de `DM_LIVE_EVAL`.
- [`scripts/check-doc-links.mjs`](../../../scripts/check-doc-links.mjs) — `ROOT_MD` em `:36`, varredura em `:95-97`. Onde `evals/README.md` precisa entrar.
- [`.github/workflows/ci.yml`](../../../.github/workflows/ci.yml) — `pnpm eval` em `:50`; é o que torna verdadeira a frase sobre PR bloqueado.
