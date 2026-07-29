# US-88 — Doc que ordena deixa de citar API que não existe

**Épico:** 0 — Infra e documentação
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** [US-78](./US-78-vault-obsidian-para-os-docs.md) e [US-79](./US-79-consertar-links-quebrados-na-documentacao.md) — **satisfeitas**. Entregaram `scripts/check-doc-links.mjs` e o par `pnpm docs:links` / `docs:links:test`. Esta story **estende** esse script; não cria um segundo.
**Nasceu de:** sessão de 27/07/2026. Ao apagar o `rollDiceTool` morto do `ai-engine`, apareceu que as *Regras absolutas* do [`AGENTS.md`](../../../AGENTS.md) mandavam toda mutação de estado passar por `updateCharacterSheet` e `advanceQuest` — **nenhuma das duas existe**. Corrigido à mão na hora; a baseline por script veio depois e achou uma terceira que ninguém tinha visto (`useChat`).
**Relacionada a:** [US-86](./US-86-gate-de-caminhos-em-arvores-de-diretorio-nos-docs.md) (mesma família, outra classe: caminho em árvore), [US-82](./US-82-gate-de-convencao-de-nomes-de-arquivo-nos-docs.md) (gate mecânico sobre doc), [US-80](./US-80-ci-typecheck-testes-e-evals.md) (é lá que o gate ganha dentes), [US-83](./US-83-readme-com-arquitetura-alto-nivel.md) (auditou a tabela de 7 tools do README — o mesmo defeito, achado à mão).
**Criada em:** 2026-07-27

---

## História

> **Como** agente (ou dev) que lê o `AGENTS.md` para saber qual função chamar,
> **quero** que todo identificador citado em regra normativa exista no código-fonte,
> **para que** a doc não me mande chamar uma API inexistente — e eu não a invente para obedecer.

---

## Contexto e motivação

### O problema observado

[`AGENTS.md`](../../../AGENTS.md), seção *Regras absolutas (nunca violar)*, até 27/07/2026:

> **Toda ação do LLM que altera estado passa pela tool correspondente** (`updateCharacterSheet`, `advanceQuest`, `rollDice`, etc.)

Das três, só `rollDice` existe. As tools vivas que mutam estado são `updateCharacterHp`, `updateInventory`, `updateScene` e `recordEntity` ([`ai.service.ts:349-585`](../../../apps/api/src/ai/ai.service.ts)).

**A gravidade vem da seção, não do erro.** Uma tabela descritiva que erra vira ruído: o leitor confere e descarta. Uma regra marcada "nunca violar" que erra vira instrução: o agente procura `updateCharacterSheet`, não acha, e a saída natural é **escrever** a chamada — código novo para uma interface que não existe, em cima de uma regra que ele foi mandado obedecer. Doc que descreve envelhece; doc que ordena produz.

### Por que a solução atual não basta

Três classes de afirmação sobre o repo, três coberturas:

| Classe | Exemplo | Coberta por |
|---|---|---|
| Link para arquivo | `[ai.service.ts](../../../apps/api/...)` | US-78/79 — **existe** |
| Caminho nu em árvore | `prisma/` dentro de fence | [US-86](./US-86-gate-de-caminhos-em-arvores-de-diretorio-nos-docs.md) — planejada |
| **Identificador em prosa** | `` `updateCharacterSheet` `` | **nada** |

O `docs:links` não podia ter pego: ele resolve alvo de link no filesystem. `updateCharacterSheet` não é caminho, é nome — e o arquivo onde ele *deveria* estar existe e está linkado corretamente. Link verde, afirmação falsa.

### Baseline medida (remedida em 28/07/2026)

Critério: token em backtick, **fora de bloco cercado**, casando `/^[a-z][a-z0-9]*[A-Z][A-Za-z0-9]*$/` (camelCase com pelo menos uma maiúscula), procurado como substring em `apps/*/src`, `packages/*/src`, `scripts/` e `evals/` (`.ts`, `.tsx`, `.mjs`, `.js`, `.prisma`, `.json`, `.yaml`), sem `node_modules/`, `dist/` nem `generated/`.

**Nome único ≠ hit de relatório.** A primeira medição (27/07) contava nomes distintos; o gate reporta por linha. As duas colunas estão aqui porque `rollDiceTool` aparece em dois lugares do `AGENTS.md` (`:111` e `:231`) e sai duas vezes no bucket.

| Corpus | Arquivos | Nomes únicos | Ocorrências | Ghosts (únicos) | Ghosts (hits) |
|---|---|---|---|---|---|
| `AGENTS.md`, `CLAUDE.md`, `README.md` | 3 | 14 | 26 | **7** | **8** |
| `docs/` recursivo | 101 | 220 | 1372 | **46** (21%) | 147 |

Os 7 do primeiro corpus, todos no `AGENTS.md`: `rollDiceTool` (`:111`, `:231`), `getRule`, `advanceQuest`, `recallMemory`, `getCharacterState`, `addEventLog` (`:227`) — **seis são menções deliberadas**, na seção que diz que essas tools *não* existem — e `useChat` (`:54`), que é bug vivo (abaixo). O `README.md` entrou verde nesta remedição: os 5 nomes de tool que sobraram lá depois da [US-83](./US-83-readme-com-arquitetura-alto-nivel.md) (`b026b44`) existem todos no fonte.

**Os 21% do `docs/` são o número que decide o escopo.** Amostra do que aparece lá: `createCampaign` e `joinCampaign` (US-22, proposta), `pontosRestantes` (US-26, proposta), `defineConfig`/`stopPropagation`/`readdirSync`/`packageManager` (API de terceiro ou de ferramenta), `sequenceDiagram` (palavra-chave de Mermaid), `strokeWidth` (SVG). Quase nada é defeito. **US propõe nome que não existe — é o gênero.** Gate ali reprova documento correto, e gate com falso positivo é gate que alguém desliga (a [US-86](./US-86-gate-de-caminhos-em-arvores-de-diretorio-nos-docs.md) chegou à mesma conclusão pelo caminho do `base=`).

### O achado vivo: `useChat`

[`AGENTS.md:54`](../../../AGENTS.md), seção *Frontend*: *"Streaming de narração token-a-token via `useChat` do Vercel AI SDK"*.

- Zero hits de `useChat` em `apps/web/src`.
- O streaming real é `fetch` + leitura manual em [`GameView.tsx:311`](../../../apps/web/src/components/game/GameView.tsx): `const reader = res.body!.getReader()`.
- `@ai-sdk/react` está em [`apps/web/package.json:14`](../../../apps/web/package.json) (`^1.2.12`) e **nunca é importado**.

Mesma família do `rollDiceTool`: dependência e doc de um desenho que não foi adiante, com o código tendo seguido outro caminho. Sobreviveu a todas as leituras manuais do `AGENTS.md` desta fase — inclusive às desta mesma sessão, que estavam olhando exatamente para este defeito.

### A vizinhança da linha acesa (medida em 28/07/2026)

Ao abrir o `AGENTS.md` para escrever a correção, a **linha de cima** mentia também — e a de cima dela:

| `AGENTS.md` → *Frontend* | O que o repo tem | Onde verificar |
|---|---|---|
| `:53` *"Zustand para estado local de UI"* | **Zero hits** de `zustand` — nem no [`package.json`](../../../apps/web/package.json) nem em `apps/web/src`. Estado é `useState` | [`GameView.tsx:204`](../../../apps/web/src/components/game/GameView.tsx) |
| `:53` *"estado de jogo vem do servidor via WebSocket"* | **Zero hits** de `WebSocket`, `socket.io` ou `ws://` em `apps/web/src` e `apps/api/src`. O transporte é SSE (`text/event-stream`) — e o [`CLAUDE.md`](../../../CLAUDE.md) já diz isso, então os dois docs normativos se contradizem | [`api/chat/route.ts:28`](../../../apps/web/src/app/api/chat/route.ts) |
| `:54` *"via `useChat`"* | `fetch` + `res.body.getReader()` | [`GameView.tsx:311`](../../../apps/web/src/components/game/GameView.tsx) |

**Nenhum dos dois primeiros é pegável por este gate:** `WebSocket` é PascalCase (a regex exige inicial minúscula) e `Zustand` idem. Corrigir só o token que acendeu deixaria o bloco *Frontend* descrevendo um estado e um transporte que não existem — por isso o critério de aceite cobra o **bloco**, não a linha. O gate é detector de fumaça, não inventário: quando o bucket acender, lê-se o parágrafo.

O mesmo vale para a seção *Backend* logo abaixo (`:57`), que lista módulos inexistentes (`campaign`, `ingestion`) e omite quatro reais. Esse achado é o mesmo do `convencoes.md` e foi para a [US-91](./US-91-auditar-convencoes-de-implementacao.md), que passou a cobrir os dois arquivos — fora do escopo daqui.

---

## Escopo

### Dentro do escopo

- Checagem nova em [`scripts/check-doc-links.mjs`](../../../scripts/check-doc-links.mjs), rodando **só sobre `ROOT_MD`** (`AGENTS.md`, `CLAUDE.md`, `README.md`) — a constante já existe no script (`:36`).
- Extração: token em backtick simples, fora de fence (`stripCode()` já entrega isso), casando a regex de camelCase acima.
- Verificação: substring nos fontes listados na baseline. Índice lido uma vez em memória.
- `GHOST_ALLOW` ao lado do `NAME_ALLOW` que o script já tem (`:113`), **com o motivo por entrada** — as 6 menções deliberadas são citadas justamente como inexistentes. Forma e conteúdo em *Notas de implementação*.
- **Aviso quando entrada do `GHOST_ALLOW` voltar a existir no fonte.** Sem isso o allowlist vira o próximo fóssil, e a story reencena o problema um nível acima.
- Bucket próprio no relatório e exit ≠ 0 no gate.
- Teste de regressão em [`scripts/check-doc-links.test.mjs`](../../../scripts/check-doc-links.test.mjs), padrão `node:test` da US-79.
- **Corrigir o bloco *Frontend* do `AGENTS.md` (`:50-54`), não só a linha do `useChat`:** estado (`useState`, não Zustand), transporte (SSE, não WebSocket) e streaming (`fetch` + `getReader()`, não `useChat`), cada um com `file:line`. Escopo por bloco porque dois dos três defeitos não acendem no gate — ver *A vizinhança da linha acesa*.

### Fora do escopo

- **O corpus `docs/`.** 46 nomes ghost em 220 (147 hits), e a maioria é proposta legítima de US. Ver *Questões em aberto* #2 antes de reabrir.
- **Assinatura errada.** `updateCharacterHp` existe, então a linha passa mesmo que a doc descreva parâmetros que a tool não aceita — foi esse o defeito do `roll-dice.ts` apagado hoje (`formula: "2d6+3"` contra a real, que recebe `skill`). Não há gate barato para isso; o que existe é a convenção de citar `file:line` + data de verificação.
- **Identificador sem backtick.** Fora da convenção de escrita do repo, e sem backtick a ambiguidade com prosa é alta demais.
- **Modo `--fix`.** Nome inexistente pode ser rename, feature apagada ou nome planejado. É o bucket "reportar, não reescrever" da [US-79](./US-79-consertar-links-quebrados-na-documentacao.md) (`:99`).
- **Dependência instalada e nunca importada** (`@ai-sdk/react`, e o `ai` do `apps/web`). É a mesma raiz vista do outro lado, mas a ferramenta é outra (`knip`) e o custo é uma story própria.

---

## Critérios de aceite

- [x] `pnpm docs:links` reporta bucket novo de identificador inexistente, com arquivo, linha e o nome, e sai ≠ 0 quando houver.
- [x] A checagem roda **só** em `AGENTS.md`, `CLAUDE.md` e `README.md`; rodar o gate não reprova nenhum arquivo de `docs/`.
- [x] **Zero falsos positivos na baseline atual:** com o `GHOST_ALLOW` das 6 menções deliberadas e a linha do `useChat` corrigida, os 14 nomes cobrados (26 ocorrências) saem todos verdes.
- [x] Entrada do `GHOST_ALLOW` que voltou a existir no fonte aparece no relatório como aviso (não derruba o gate — a doc está certa; o allowlist é que está velho).
- [x] **Bloco *Frontend* do `AGENTS.md` (`:50-54`) descreve o que existe**, com `file:line` em cada afirmação: estado local em `useState` (`GameView.tsx:204`) e não Zustand; estado de jogo por SSE (`text/event-stream`, `api/chat/route.ts:28`) e não WebSocket; narração por `fetch` + `res.body.getReader()` (`GameView.tsx:311`) e não `useChat`.
- [x] A afirmação de transporte do `AGENTS.md` **não contradiz** a do [`CLAUDE.md`](../../../CLAUDE.md) (*"REST e streaming SSE (não é WebSocket)"*).
- [x] **Teste de regressão:** fixture `.md` citando `` `naoExisteEmLugarNenhum` `` é reprovada; fixture citando um identificador real e outro do allowlist passa. Fixture apagada no `finally`, como a da US-79.
- [x] **Nenhuma reescrita.** `git status` limpo depois de rodar o gate.
- [x] Passo *Gate de docs* da [US-80](./US-80-ci-typecheck-testes-e-evals.md) continua verde sem mudança no workflow.

---

## Notas de implementação

- **A máscara existente serve direto.** Ao contrário da [US-86](./US-86-gate-de-caminhos-em-arvores-de-diretorio-nos-docs.md), que precisa do conteúdo que o `stripCode()` (`:46`) joga fora, aqui o que interessa é justamente o que sobra depois dele: prosa. Sem refactor do parser de fence.
- **Match por substring, não por AST.** `getRule` casa com `getRules` e com um comentário que só mencione o nome. Falso-negativo assumido: o inimigo é o falso positivo, que desliga o gate. Teto conhecido — TypeScript compiler API custa uma ordem de grandeza a mais para pegar um caso que ninguém observou.
- **Excluir `dist/` e `generated/` do índice.** `dist/` é build do próprio `src` (só duplica), e `apps/api/src/generated/prisma` é código gerado com milhares de nomes — um identificador que só existe lá não é API do projeto, e incluí-lo criaria falso-negativo silencioso.
- **A maiúscula obrigatória é o que mata o ruído.** `/^[a-z][a-z0-9]*[A-Z]/` exclui `pnpm`, `tsc`, `nest`, `dotenv` e todo caminho/flag (têm `/`, `.` ou `-`). Foi ela que trouxe o corpus normativo para 14 nomes cobrados.
- **`GHOST_ALLOW` é `Map`, não `Set`.** O `NAME_ALLOW` (`:113`) é `Set` com os motivos num comentário acima — serve lá porque tem 2 entradas e o gate só precisa pular. Aqui o critério de aceite pede que o aviso de entrada obsoleta **diga por que a entrada existia**, e motivo em comentário não chega ao relatório. `Map<nome, motivo>` custa a mesma linha e faz o aviso sair legível:

  ```js
  // US-88: nomes citados na doc justamente por NÃO existirem. Chave = identificador,
  // valor = motivo. Entrada que voltar a existir no fonte vira aviso, não erro.
  const GHOST_ALLOW = new Map([
    ["rollDiceTool", "AGENTS.md :111 e :231 — tool morta apagada em 27/07/2026, citada como exemplo do defeito"],
    ["getRule", "AGENTS.md :227 — roadmap escrito no presente, declarado inexistente no próprio bloco"],
    ["advanceQuest", "AGENTS.md :227 — idem"],
    ["recallMemory", "AGENTS.md :227 — idem"],
    ["getCharacterState", "AGENTS.md :227 — idem"],
    ["addEventLog", "AGENTS.md :227 — idem"],
  ]);
  ```

  Seis entradas, todas no `AGENTS.md`, e `rollDiceTool` cobre os dois hits com uma linha. **`useChat` não entra** — é defeito, e sai pela correção da linha do *Frontend*.

- **O aviso de entrada obsoleta compara contra o mesmo índice, não contra o disco de novo.** O índice de fontes já está em memória para a checagem principal; varrer `GHOST_ALLOW` contra ele é um `filter` no fim. Sai como aviso e **não derruba o gate**: a doc está certa, quem envelheceu foi o allowlist — derrubar CI por isso ensina a esvaziar o `GHOST_ALLOW` no susto, que é o oposto do que a entrada existe para fazer.
- **O gate se envenenava sozinho — achado na implementação (28/07/2026).** `scripts/` está no índice de fontes, e o próprio `check-doc-links.mjs` mora lá: as 6 chaves do `GHOST_ALLOW` são strings literais dentro do arquivo indexado, então a primeira execução acusou **as 6 entradas como "voltaram a existir no fonte"**. O teste tem o mesmo defeito de outra forma: `check-doc-links.test.mjs` contém o nome inventado da fixture (`naoExisteEmLugarNenhum`) como literal, e o gate passava exatamente no caso que a fixture existe para reprovar. Correção: `SRC_SELF` tira os dois arquivos do índice. **Teto conhecido:** identificador que só exista nesses dois arquivos é invisível ao gate — barato, porque nenhum deles exporta API do projeto.
- **Não configurar a lista de diretórios de fonte por arquivo externo.** Config global vira lista de exceções que ninguém revisa (mesmo argumento do `base=` opt-in da US-86). Constante no topo do script, ao lado de `ROOT_MD`.
- O script roda sobre **disco**, não `git ls-files` — motivo registrado na US-79 (`:142`): `core.quotePath` faz arquivo com byte não-ASCII sumir da listagem sem aviso.

---

## Questões em aberto

Todas resolvidas em 28/07/2026, com a remedição acima. Ficam registradas com o desfecho porque três delas fecham *por medição* — reabrir sem número novo é refazer o palpite.

1. **14 nomes cobrados justificam o gate?** ✅ **Sim, com data de morte.** O corpus normativo é minúsculo e continua sendo — o argumento a favor é o valor por unidade, não o volume: são os 3 arquivos que todo agente lê antes de escrever qualquer linha, e o erro que eles produzem é código, não confusão. O custo é uma checagem num script que já existe, não uma ferramenta nova.
   **Cláusula de morte, com data:** se ao fim da **Fase 1** o bucket nunca tiver acendido em CI, apagar a checagem e o `GHOST_ALLOW`. Sem data escrita, gate morto nunca é apagado — vira o `rollDiceTool` do `scripts/`, que é exatamente o defeito que originou esta story.
2. **Estender para `docs/sdlc/03-implementacao/`?** ❌ **Não — medido, cobre zero.** A pasta tem **1 arquivo** (`convencoes.md`) e **0 identificadores cobrados**: nenhum token em backtick fora de fence casa a regex de camelCase. Os defeitos reais dali são caminho (`prisma/`), nome de módulo (`campaign`, `ingestion`), env var (`REDIS_URL` — SCREAMING_CASE, fora da regex por construção) e prosa (*"registrada com seed"*). Rodar o gate ali dá **verde num arquivo comprovadamente podre**, que é pior que não rodar: cria a impressão de cobertura. O arquivo é tratado à mão pela [US-91](./US-91-auditar-convencoes-de-implementacao.md). Não reabrir sem baseline nova.
3. **Nome de API de terceiro.** ✅ **Reescrever a linha vem antes de allowlistar.** `useChat` reprovou pelo motivo certo: o repo *afirmava usá-lo* e não usava — e é justamente isso que a busca por substring testa, porque uma API externa realmente em uso deixa `import` no fonte. Doc normativa que cita API externa ausente do código está afirmando algo falso sobre o repo; a correção default é tirar a afirmação, não silenciar o gate. O `GHOST_ALLOW` fica para o resíduo, e entrada de API externa **cita o pacote no motivo** — sem isso não dá para saber depois se a linha envelheceu.
4. **Ordem com a US-83.** ✅ **Resolvida sozinha.** A US-83 entrou em `b026b44` e a tabela de 7 tools do README morreu antes desta story começar. O `README.md` sai verde na remedição de 28/07. O `GHOST_ALLOW` nasce com **6 entradas, todas no `AGENTS.md`, todas no mesmo bloco (`:227-235`)**. Desfecho preferido confirmado: linha apagada não precisou de gate.

### Extensão de escopo (29/07/2026, pela [US-89](./US-89-gate-de-codigo-morto-com-knip.md))

O escopo do gate deixou de ser só o `SCANNED_MD`: a lista `GHOST_MD` acrescentou
[`docs/sdlc/02-design/contratos-de-api.md`](../02-design/contratos-de-api.md) e
[`docs/sdlc/04-testes/estrategia-de-testes.md`](../04-testes/estrategia-de-testes.md).

Não contradiz a questão #2 — lá a medição mostrou **zero** identificadores cobrados em
`03-implementacao/`, e verde num arquivo podre é pior que ausência. Aqui a medição foi o
contrário: os dois arquivos descreviam `updateCharacterSheet`, `addEventLog`, `recallMemory`,
`advanceQuest` e `getCharacterState` — cinco tools apagadas (ou nunca escritas), citadas como
contrato vigente por um mês, sem nada acusar. Doc de design que descreve API de código é
normativa na prática: é o que o agente lê antes de implementar.

O resto de `docs/` continua fora, pelo mesmo motivo de sempre (21% de proposta legítima de US).
Guarda contra encolhimento silencioso da lista: um teste em `check-doc-links.test.mjs`.

### Registrado, não aberto

- **`GHOST_ALLOW` central vs. marcador inline.** As 6 menções deliberadas estão todas dentro do bloco que **diz** "Não existem" — daria para marcá-las na própria linha (`<!-- ghost-ok: citada como inexistente -->`) em vez de listá-las no script. Vantagem estrutural: o motivo mora ao lado da afirmação e **morre junto com a linha**, fechando o modo principal de allowlist virar fóssil (o critério de aceite do aviso continua necessário nos dois desenhos, para o outro modo: o nome voltar a existir). Escolhido o `GHOST_ALLOW` porque 6 entradas em 1 arquivo é menos código hoje. **Gatilho para inverter:** o allowlist passar de ~15 entradas, ou uma entrada sobreviver à linha que a justificava.

---

## Referências no código

- [scripts/check-doc-links.mjs](../../../scripts/check-doc-links.mjs) — `SCANNED_MD` (era `ROOT_MD`, renomeado pela US-90), `GHOST_MD` (escopo do gate de identificador), `stripCode()`, `NAME_ALLOW` e a estrutura de buckets do relatório.
- [scripts/check-doc-links.test.mjs](../../../scripts/check-doc-links.test.mjs) — padrão de fixture temporária com `try/finally`.
- [AGENTS.md](../../../AGENTS.md) — *Regras absolutas* (o defeito de origem), *Frontend* `:54` (o `useChat`), e a regra "roadmap não vira código" em *Padrões de código → Comentários*.
- [apps/api/src/ai/ai.service.ts](../../../apps/api/src/ai/ai.service.ts) — objeto `tools` (`:349-585`), fonte de verdade dos nomes de tool.
- [apps/web/src/components/game/GameView.tsx](../../../apps/web/src/components/game/GameView.tsx) — `:311`, o streaming real do frontend.
- [.github/workflows/ci.yml](../../../.github/workflows/ci.yml) — passos *Gate de docs* e *Teste do gate de docs*.
