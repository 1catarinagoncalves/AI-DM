# US-81 — Higiene de nomes de arquivo e placeholders `(#)` na documentação

**Épico:** 5 — Ferramentas de projeto / SDLC
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** [US-78](./US-78-vault-obsidian-para-os-docs.md) — **recomendada antes, não bloqueante.** É o rename com atualização automática de links que torna este trabalho seguro; fazer antes é reescrever à mão exatamente o que a US-78 automatiza. Não confundir com [US-79](./US-79-consertar-links-quebrados-na-documentacao.md), que conserta links **quebrados** — nenhum link desta story está quebrado.
**Criada em:** 2026-07-26

---

## História

> **Como** desenvolvedora / dona do produto,
> **quero** que todo link `[US-NN](#)` que tenha alvo aponte para o alvo, e que nenhum `.md` tenha espaço ou acento no nome,
> **para que** eu pare de encontrar links que não levam a lugar nenhum e ferramentas que engolem arquivos em silêncio por causa do nome.

---

## Contexto e motivação

### O problema observado

Levantado durante a [US-78](./US-78-vault-obsidian-para-os-docs.md), investigando os links órfãos do índice apagado. Duas classes, nenhuma delas coberta pelo `pnpm docs:links`.

**1. O placeholder `(#)` não distingue "não existe" de "não linkei".** 11 ocorrências, 6 códigos:

| Código | Ocorrências | Onde | Tem alvo? |
|---|---:|---|---|
| `US-02` | 3 | `US-27:7`, `US-27:28`, `US-27:59` | ✅ `US-02-inventário personagem.md` |
| `US-09` | 3 | `US-29:6`, `US-29:179`, `US-38:6` | ✅ definida em `criterios-de-aceite.md:36`; **entregue** por US-29/US-38/US-18 |
| `US-18` | 2 | `US-55:6`, `US-56:6` | ✅ `US-18-historico-servido-pela-api.md` |
| `US-01` | 1 | `US-26:6` | ✅ `US-01-atritbutos personagem.md` |
| `US-24` | 1 | `US-30:109` | ✅ **é a [US-61](./US-61-login-do-jogador.md)** — mesmo escopo, renumerado ao virar Fase 2 |
| `US-07` | 1 | `US-22:51` | ❌ nenhum — nem arquivo, nem critério, nem código |

**10 das 11 apontam para o vazio tendo alvo para apontar.** Só o `US-07` está correto: `(#)` é a forma honesta de citar escopo que de fato não existe (`US-22:94` confirma que *"não existe hoje nenhuma rota que crie/altere quests"*).

> **Correção sobre a versão inicial desta story.** A tabela original listava 9 ocorrências e 5 códigos, dava `US-09` e `US-24` como "❌ nenhum" e omitia `US-07`. Os números vieram de contagem manual; a varredura com neutralização de code span devolve 11/6. E a auditoria da *Questão 1* mostrou que `US-09` e `US-24` não são escopo inexistente — são **escopo entregue sob outro número**. Ver *Questões em aberto* #1.

**2. Três nomes de arquivo fora da convenção**, um deles com erro de digitação no próprio nome:

| Arquivo | Problema |
|---|---|
| `US-01-atritbutos personagem.md` | espaço + typo (`atritbutos`) |
| `US-02-inventário personagem.md` | espaço + acento |
| `US-43-calibracao-peso-traços-identidade.md` | acento |

A convenção não é invenção desta story: **62 dos 66** `US-*.md` já seguem `US-NN-titulo-em-kebab-case-ascii.md`. Estes 3 são as únicas violações reais.

### Por que a solução atual não basta

- **`pnpm docs:links` ignora alvo `#` de propósito** — é âncora, não caminho (`check-doc-links.mjs:86`). Nenhum dos 11 placeholders é link quebrado, então nem o gate desta ferramenta nem a US-79 os enxergam.
- **Nome com byte não-ASCII faz ferramenta engolir arquivo calada.** Já custou: a contagem manual da US-78 reportou 79 arquivos em vez de 83 porque `git ls-tree --name-only` põe esses paths entre aspas (`core.quotePath`) e o `grep '\.md$'` deixa de casar. O erro só apareceu quando alguém escreveu um script.
- **Espaço no nome exige `%20` no link.** Provável razão de `US-01` e `US-02` terem virado `(#)`: os dois têm espaço, e ninguém quis escrever o encoding à mão. Note que `US-18` tem nome limpo e virou `(#)` de todo jeito — então descuido também conta, não é só o encoding.

### A proposta

Repontar os 10 placeholders que têm alvo, renomear os 3 arquivos para a convenção que os outros 62 já seguem, e registrar a convenção onde alguém a leia antes de criar o próximo arquivo.

---

## Decisões

### A convenção é descritiva, não nova

`US-NN[a]-titulo-em-kebab-case-ascii.md` — minúsculas, sem espaço, sem acento. Derivada de 62/66 arquivos, não decidida aqui. Duas exceções **ficam como estão**:

- `US-TEMPLATE.md` — maiúscula proposital, e o Kanban a exclui por nome (`kanban-server.js:50`).
- `US-76-consertar-fake-teste-extractOpeningEntities.md` — o camelCase é o nome real da função. Achatar para `extractopeningentities` perderia informação; o nome está certo.

### `(#)` fica reservado para escopo que não existe

Depois desta story, `(#)` passa a ter um significado só: *o código foi citado no planejamento, e não há nada — nem arquivo, nem seção, nem código — para onde apontar*. Sobra **um** caso: `US-07` (gestão de missões).

Note que "não tem arquivo `US-NN-*.md`" **não** é mais critério suficiente para `(#)`. A `US-09` não tem arquivo e mesmo assim tem alvo: os critérios dela estão escritos em `criterios-de-aceite.md:36` e o comportamento está em produção. Placeholder é sobre existir alvo, não sobre existir arquivo.

### `docs/prompts/` fica fora

5 arquivos com espaço no nome (`modelos LLM.md`, `prompt AI DM.md`, `trecho para corrigir.md`, `trecho correcao dplicação e rolagem.md`, `trecho duuplicação 2.md`). **Nenhum é linkado por nenhum documento** — verificado. São despejos de prompt, ad-hoc por natureza. Renomear não conserta link nenhum e não previne bug nenhum; é arrumação por arrumação.

---

## Escopo

### Dentro do escopo

- **Repontar 10 placeholders** para o alvo real:
  - **7 para o arquivo da story:** `US-27:7`, `US-27:28`, `US-27:59` (→ `US-02`), `US-55:6`, `US-56:6` (→ `US-18`), `US-26:6` (→ `US-01`), `US-30:109` (→ **`US-61-login-do-jogador.md`**).
  - **3 para a definição da `US-09`:** `US-29:6`, `US-29:179`, `US-38:6` → `./criterios-de-aceite.md` (seção `## US-09 — Rolagem de dados transparente`). Não existe arquivo `US-09-*.md` e esta story **não cria um** — o alvo certo é onde os critérios estão escritos.
  - Junto com `US-30:109`, ajustar a frase que o cerca: *"registrar como dívida ligada a US-24"* descreve uma dívida **paga** — a US-61 está `✅ Implementada`. Trocar por uma verificação ("confirmar se o `DELETE` já valida o dono via sessão da US-61"), não por uma afirmação de que valida.
- **Renomear 3 arquivos** pelo Obsidian, para o rename reescrever os links que apontam para eles:
  - `US-01-atritbutos personagem.md` → `US-01-atributos-do-personagem.md`
  - `US-02-inventário personagem.md` → `US-02-inventario-do-personagem.md`
  - `US-43-calibracao-peso-traços-identidade.md` → `US-43-calibracao-peso-tracos-identidade.md`
- **`modificadores atributos.md` → `modificadores-atributos.md`** (mesma pasta, tem link vivo em `US-32:65`). Não é `US-*`, mas o espaço no nome é o mesmo problema e o arquivo é referenciado. Nome escolhido para não colidir com `US-32-modificadores-de-atributo.md`.
- **5 links percent-encoded que os renames devem reescrever sozinhos:** `US-32:65`, `US-39:106`, `US-39:110`, `US-51:7`, `US-51:86`.
- **Uma linha de convenção no `docs/README.md`** (criado pela US-78).

### Fora do escopo

- **Criar a story `US-07`.** É o único código citado sem nada para onde apontar, e decidir se merece arquivo é produto, não higiene. Fica `(#)`.
- **Criar arquivo para `US-09` ou `US-24`.** A `US-09` já tem definição escrita (`criterios-de-aceite.md:36`) e implementação; a `US-24` já tem arquivo, chamado `US-61`. Criar arquivo agora seria duplicar documento existente — o oposto do que esta story faz.
- **Verificar se a `US-09` está de fato 100% entregue**, ou marcar os `- [ ]` dela em `criterios-de-aceite.md`. A auditoria da *Questão 1* achou os 4 critérios implementados no código, mas fechar checkbox de outra story é decisão dela. Achado registrado, não executado.
- **`docs/prompts/`** — ver *Decisões*.
- **`US-TEMPLATE.md` e `US-76-…extractOpeningEntities.md`** — exceções deliberadas, ver *Decisões*.
- **Os 103 links quebrados** — é a [US-79](./US-79-consertar-links-quebrados-na-documentacao.md). Nenhum link desta story está quebrado; todos resolvem, alguns resolvem para o lugar errado.
- **Renomear para tirar o `US-NN` do começo**, ou qualquer mudança de esquema de nomes. A convenção é a que 62 arquivos já usam.

---

## Critérios de aceite

- [x] **Nenhum `](#)` cujo código tenha alvo.** Sobra exatamente **1** ocorrência — `US-07` em `US-22:51`.
- [x] A verificação **não** é `ls US-NN-*.md`. Ausência de arquivo não prova ausência de alvo: a `US-09` não tem arquivo e tem alvo. Para cada `[US-NN](#)` restante, checar as três fontes — arquivo `US-NN-*.md`, seção `## US-NN` em `criterios-de-aceite.md`, e story posterior que absorveu o escopo (`grep -rn "US-NN" docs/`). Só `(#)` se as três derem vazio.
- [x] Os 3 arquivos renomeados casam `^US-[0-9]+[a-z]?-[a-z0-9-]+\.md$`. A varredura de não-conformes devolve só `US-TEMPLATE.md` e `US-76-consertar-fake-teste-extractOpeningEntities.md`.
- [x] Nenhum `.md` em `docs/sdlc/` tem espaço ou byte não-ASCII no nome.
- [x] **Teste de regressão (o rename não cria quebrado):** `pnpm docs:links` antes e depois reporta o **mesmo** número de quebrados em cada bucket. O rename tem que mover links, não perdê-los. Se o número de `.md` quebrados subir, um link ficou para trás. — antes e depois: `85 = 82 + 3 + 0 + 0`. Totais de link sobem de 698 para 710 (10 placeholders repontados + 2 links novos no `docs/README.md`).
- [x] Os 5 links percent-encoded (`US-32:65`, `US-39:106`, `US-39:110`, `US-51:7`, `US-51:86`) apontam para os nomes novos, **sem `%20`**, e o `git diff` desses arquivos mostra só a linha do link. — **uma linha a mais em `US-32`:** a seção *Referências no código* (`:99`) citava `modificadores atributos.md` em texto puro. Deixar o nome velho ali seria criar dado obsoleto no mesmo commit que o renomeia.
- [x] `git log --follow` no arquivo renomeado ainda mostra o histórico anterior ao rename — confirma que o rename foi rename, e não copiou-e-apagou. — `git diff --cached -M` registra os 4 como `R` com `0 insertions(+), 0 deletions(-)`; `--follow` fecha o elo depois do commit.
- [x] O Kanban (US-31) continua listando `US-01`, `US-02` e `US-43` nas mesmas colunas. Ele acha a story pelo conteúdo (`# US-NN — …`), não pelo nome do arquivo, então rename não deveria afetar — este critério é o que prova. — o filtro `^US-.*\.md$` (`kanban-server.js:50`) casa os nomes novos; `codigo`/`coluna` saem de `# US-NN — …` e `**Status:**`, que o rename não tocou.

---

## Notas de implementação

> *Dicas, não especificação obrigatória.*

- **Ordem:** renomear **antes** de repontar os placeholders. Repontar primeiro cria links com `%20` que o rename vai ter que reescrever de novo — trabalho dobrado, e uma janela em que o link certo tem o nome errado.
- **Renomeie pelo Obsidian, não pelo `git mv`.** O ganho da US-78 é a reescrita automática dos 5 links; `git mv` deixa todos apontando para o nome velho, o que é exatamente o buraco que criou a US-79.
- **`US-01` não tem link apontando para o arquivo hoje** — só o `[US-01](#)`. Então o rename dele não reescreve nada, e o repontar depois já usa o nome novo e limpo.
- **O typo `atritbutos` está só no nome do arquivo.** Conferir se o título dentro do arquivo (`# US-01 — …`) também tem erro antes de assumir que o rename resolve tudo.
- **Contar `(#)` com `grep` cru superestima muito.** Um `grep -ro '\](#)' docs/` devolve **18**; os reais são **11**. A diferença é prosa *sobre* placeholders, dentro de backticks — a US-78, a US-82 e esta própria story falam do assunto e se autoincluem na contagem. `check-doc-links.mjs` neutraliza code span justamente por isso (`stripCode`, `:31-41`), mas **não conta `(#)`**: alvo começando com `#` é descartado como âncora em `:86`. Para contar, reaproveitar `stripCode` num script de uma vez, ou descontar a prosa à mão.
- **A contagem de 9/5 da versão inicial estava errada** (faltou `US-29:179` e faltou `US-07` inteiro). Se for recontar, recontar com o code span neutralizado — foi assim que os 11/6 saíram.

---

## Questões em aberto

1. ~~`US-09` e `US-24` são citadas e nunca ganharam arquivo. Vale abrir as stories, ou o placeholder é registro honesto de escopo que não existe?~~ **Resolvida — e a pergunta tinha premissa falsa.** Nenhuma das duas alternativas se aplica: as duas são escopo **entregue**, sob outro número. `(#)` ali não é registro honesto — afirma "não existe" sobre coisa que roda em produção. A saída é a terceira: **repontar**, o mesmo tratamento dos outros placeholders (movido para *Dentro do escopo*).

   **`US-09` — Rolagem de dados transparente.** Definida em `criterios-de-aceite.md:36`, nunca virou arquivo, escopo absorvido pelas stories que a implementaram. Os 4 critérios, conferidos no código:

   | Critério da US-09 | Onde vive hoje | Entregue por |
   |---|---|---|
   | breakdown (fórmula, valores, modificadores, total) | `EventLog.payload` = `{formula, reason, rolls, modifier, total}`; `DICE_ROLL` é membro do enum `EventType` | [US-29](./US-29-saneamento-de-rolagens-ficticias.md) |
   | exemplo `1d20+5 → [14] +5 = 19` renderizado | frame `D:` em `ai.controller.ts:149` → bloco antes da narração no `GameView.tsx` | US-29 (critério já `[x]`) |
   | resultado no Game Server, não no LLM | `roll-dice.ts:14` — a tool **lança erro** se não estiver bound ao Game Server | US-29 |
   | histórico de rolagens acessível | `type: { in: [..., 'DICE_ROLL', ...] }` em `adventure.service.ts:210` | [US-18](./US-18-historico-servido-pela-api.md) + [US-38](./US-38-rolagens-ancoradas-na-ficha.md) (reordena o evento) |

   **`US-24` — Login / conta.** É a [US-61](./US-61-login-do-jogador.md), `✅ Implementada`: *"Login do jogador (conta persistente, sessão que sobrevive ao dispositivo)"*. Casa item por item com o que a `US-25:103` marcou como `⤷US-24` (o caso cross-device, `localStorage` × servidor). O número mudou quando login saiu da Fase 1 para a Fase 2.

   **A lição, que vale além destes dois códigos:** a numeração do repo cresce por ordem de escrita, não por ordem de plano. Número baixo sem arquivo é sinal de **plano antigo**, não de dívida — o escopo pode ter sido reemitido com outro número ou dissolvido nas stories que o implementaram. Por isso o critério de aceite deixou de ser `ls US-NN-*.md`.

   **Sobra aberta a parte que era de fato sobre escopo inexistente:** vale abrir a `US-07` (gestão de missões — criar/reapontar quests, promover `isPrimary`)? Aí sim não há arquivo, não há critério, e `US-22:94` confirma que não há rota. É pergunta de produto, e continua fora do escopo desta story.
2. ~~Vale um check no `pnpm docs:links` que **falhe** em nome de arquivo fora da convenção?~~ **Resolvida: virou a [US-82](./US-82-gate-de-convencao-de-nomes-de-arquivo-nos-docs.md).** Vale, mas é gate novo e escopo próprio — esta story resolve os 3 casos existentes, a US-82 fecha a porta para o próximo. A US-82 **depende desta**: ligar o gate antes dos renames é entregá-lo vermelho.

---

## Referências no código

- `docs/sdlc/01-requisitos/US-01-atritbutos personagem.md`, `US-02-inventário personagem.md`, `US-43-calibracao-peso-traços-identidade.md` — os 3 a renomear.
- `docs/sdlc/01-requisitos/modificadores atributos.md` — o 4º, não é `US-*` mas tem link vivo.
- `docs/sdlc/01-requisitos/US-27-pericias-do-personagem.md:7,28,59` · `US-55:6` · `US-56:6` · `US-26:6` · `US-30:109` — 7 dos 10 placeholders a repontar, todos para arquivo `US-NN-*.md`.
- `docs/sdlc/01-requisitos/US-29-saneamento-de-rolagens-ficticias.md:6,179` · `US-38:6` — os outros 3, que apontam para `criterios-de-aceite.md`, não para um arquivo de story.
- `docs/sdlc/01-requisitos/criterios-de-aceite.md:36` — `## US-09 — Rolagem de dados transparente`, alvo desses 3 e prova de que "sem arquivo" ≠ "sem alvo".
- `docs/sdlc/01-requisitos/US-61-login-do-jogador.md` — a `US-24` renumerada; alvo de `US-30:109`.
- `packages/ai-engine/src/tools/roll-dice.ts:14` · `apps/api/src/ai/ai.controller.ts:149` · `apps/api/src/adventure/adventure.service.ts:210` — a US-09 implementada; a auditoria da *Questão 1*.
- `docs/sdlc/01-requisitos/US-22-fusao-campanha-aventura.md:51,94` — o `[US-07](#)` que **fica**, e a confirmação de que não há rota de quest.
- `docs/sdlc/01-requisitos/US-32-modificadores-de-atributo.md:65` · `US-39:106,110` · `US-51:7,86` — os 5 links que o rename deve reescrever.
- `scripts/check-doc-links.mjs` — a varredura do teste de regressão; criada na [US-78](./US-78-vault-obsidian-para-os-docs.md).
- `tools/kanban/kanban-server.js:50` — filtro que exclui `US-TEMPLATE.md` por nome.
- `tools/kanban/kanban-server.js:41` — identifica a story pelo conteúdo, razão de o rename não afetar o Kanban.
