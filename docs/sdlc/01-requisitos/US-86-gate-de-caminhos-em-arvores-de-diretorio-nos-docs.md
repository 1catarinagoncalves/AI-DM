# US-86 — Árvore de diretórios na documentação deixa de mentir sobre onde o arquivo está

**Épico:** 0 — Infra e documentação
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** [US-78](./US-78-vault-obsidian-para-os-docs.md) e [US-79](./US-79-consertar-links-quebrados-na-documentacao.md) — **satisfeitas**. Entregaram `scripts/check-doc-links.mjs` e o par `pnpm docs:links` / `docs:links:test`. Esta story **estende** esse script com uma checagem nova; não cria um segundo.
**Nasceu de:** sessão de 27/07/2026. O `prisma/` aparecia como diretório de **raiz** em 4 arquivos; o real é `apps/api/prisma/`. Três foram corrigidos à mão na hora ([`AGENTS.md`](../../../AGENTS.md), [`CLAUDE.md`](../../../CLAUDE.md), [`README.md`](../../../README.md)); o quarto ([`convencoes.md:16`](../03-implementacao/convencoes.md)) só apareceu quando a baseline foi medida por script — ninguém o tinha visto em 4 leituras manuais.
**Relacionada a:** [US-80](./US-80-ci-typecheck-testes-e-evals.md) (é lá que o gate ganha dentes), [US-82](./US-82-gate-de-convencao-de-nomes-de-arquivo-nos-docs.md) (mesma família: gate mecânico sobre doc), [US-83](./US-83-readme-com-arquitetura-alto-nivel.md) — **implementada em 28/07/2026, e deletou a árvore do README**. O desfecho preferido pelas duas aconteceu: esta story não tem mais nada a cobrir lá, e a baseline encolheu (ver *Rebaseline*).
**Criada em:** 2026-07-27
**Atualizada em:** 2026-07-28 — remedida contra o repo depois da US-83.

---

## História

> **Como** dev (ou agente) que lê a documentação para se orientar no repo,
> **quero** que uma árvore de diretórios num bloco de código aponte para caminhos que existem,
> **para que** procurar um arquivo onde a doc diz que ele está não termine em `No such file or directory`.

---

## Contexto e motivação

### O problema observado

`prisma/` foi documentado como diretório de raiz em 4 arquivos. Não existe: o schema, as migrations e o seed vivem em `apps/api/prisma/`. As quatro cópias eram idênticas em forma:

```
apps/
  web/          # Next.js (frontend)
  api/          # NestJS (Game Server + REST + WebSocket)
packages/
  ...
prisma/         # Schema e migrações      <- mentira
```

> **Este bloco é o segundo falso positivo da story, e ele foi escrito pela própria story.** A varredura de 28/07 acusa a linha `prisma/` **acima** — uma US que documenta o bug citando-o é indistinguível, para uma regex, de uma US que o comete. Ver *Rebaseline* e a decisão de opt-in.

A [US-83](./US-83-readme-com-arquitetura-alto-nivel.md) já tinha auditado esse caso no README (é uma das 4 "mentiras" da tabela dela, `:27`) — o que prova que **achar** não é o gargalo. O erro sobreviveu à auditoria porque nada o reprova continuamente. E a US-83 fechou o caso do README **deletando a árvore** em 28/07 (sobraram dois `mermaid` e um `bash`): o `prisma/` não foi corrigido lá, foi apagado o lugar onde ele podia mentir.

### Por que a solução atual não basta

O gate de docs existe e **não podia** ter pego. `stripCode()` ([`check-doc-links.mjs:46`](../../../scripts/check-doc-links.mjs)) zera todo conteúdo dentro de bloco cercado, de propósito e com razão documentada: uma spec que ilustra sintaxe de link não deve ser cobrada por ela. Árvore de diretórios mora dentro de fence.

Ou seja, não é furo do checker — é **classe de erro fora do contrato dele**:

| O que é verificado hoje | O que não é |
|---|---|
| `[texto](caminho)` fora de fence | Caminho nu dentro de fence |
| Alvo de link existe em disco | Entrada de árvore existe em disco |
| Profundidade relativa correta | — |

E é a classe que mais engana: link quebrado dá 404 visível no GitHub; caminho errado em árvore só falha quando alguém tenta usar, e o custo cai em quem confiou.

### Baseline medida (27/07/2026)

Varredura dos mesmos 98 `.md` que o `docs:links` já cobre (`docs/` recursivo + `AGENTS.md`, `CLAUDE.md`, `README.md`), contando entradas de árvore na **coluna 0** (`^nome/`) dentro de bloco cercado:

| Métrica | Valor |
|---|---|
| Blocos cercados | 125 |
| Entradas de nível 0 | **14** |
| Não existem em disco | **2** |

Os 2: [`convencoes.md:16`](../03-implementacao/convencoes.md) (`prisma/` — a 4ª cópia da mentira) e [`convencoes.md:51`](../03-implementacao/convencoes.md) (`src/`).

**O segundo era falso positivo, e era o achado que decidia o desenho.** Aquela árvore está sob o cabeçalho `## AI Engine (packages/ai-engine)` — o `src/` dela seria `packages/ai-engine/src/`, que existe. A base não é a raiz do repo; é implícita na prosa acima do bloco. Um gate que assume "nível 0 = raiz do repo" reprova documentação correta, e gate com falso positivo é gate que alguém desliga.

**Em 28/07 esse caso virou do avesso — ver *Rebaseline*.**

### Rebaseline (28/07/2026, depois da US-83)

Mesma varredura, repo depois da [US-83](./US-83-readme-com-arquitetura-alto-nivel.md):

| Métrica | 27/07 | 28/07 |
|---|---|---|
| `.md` varridos | 98 | 103 |
| Blocos cercados | 125 | 131 |
| Entradas de nível 0 | 14 | **13** |
| Não existem em disco | 2 | **3** |

Os 3: [`convencoes.md:16`](../03-implementacao/convencoes.md) (`prisma/`), [`convencoes.md:51`](../03-implementacao/convencoes.md) (`src/`) e **esta própria US**, no bloco de *O problema observado*. As entradas do README saíram da conta porque a árvore inteira saiu do arquivo.

> **Endereços medidos em 28/07 antes das edições desta story.** Os dois blocos de `convencoes.md` foram apagados no mesmo dia — os números ficam como registro da medição, não como ponteiro navegável. Depois das edições restam **3** entradas de nível 0 no repo inteiro, e são as deste bloco ilustrativo.

Três coisas mudaram o desenho, e nenhuma é cosmética:

1. **A árvore do README não existe mais.** Estava em *Fora do escopo* esperando a US-83 decidir; decidiu por deletar. O corpus real do gate hoje são **dois arquivos**: [`CLAUDE.md`](../../../CLAUDE.md) (4 entradas) e [`convencoes.md`](../03-implementacao/convencoes.md) (7, em duas árvores).
2. **O falso positivo do `src/` inverteu de sinal.** `packages/ai-engine/src/tools/` **foi apagada** pela US-83 (só continha código morto — ver a US-83 `:84`); o guard de forma dela hasheia a pasta como a string `(ausente)`. A árvore de `convencoes.md:50-60` listava `tools/` com **7 arquivos**, dos quais existiam **zero** (apagada ainda em 28/07 — ver *Decisão final*). Ou seja: declarar `base=packages/ai-engine` deixaria aquele bloco **verde** enquanto todo o conteúdo dele é ficção. Um gate de nível 0 ali não é neutro — dá selo de aprovado a uma árvore inteiramente falsa.
3. **Apareceu uma segunda classe de falso positivo: a doc que cita o erro.** Esta US é acusada por conter o bloco que ela existe para documentar. A US-82 e a US-79 vão ter o mesmo problema no dia em que ilustrarem uma árvore. Não é caso de exceção por arquivo — é sinal de que **auto-detectar árvore em qualquer fence é a premissa errada**.

E o arquivo é pior do que a métrica sugere: [`convencoes.md`](../03-implementacao/convencoes.md) ainda diz *"uma tool por arquivo"* (`:53`) — a frase que a US-83 apagou do [`AGENTS.md`](../../../AGENTS.md) por ter 0 casos vigentes — e lista módulos NestJS (`:42`) que não existem (`campaign`, `ingestion`; os reais são `adventure`, `ai`, `auth`, `character`, `game`, `system`, `user`). O gate desta story não pega nada disso. É o argumento da Questão #1 ganhando peso: aquele arquivo precisa de reescrita, não de `base=`.

### A proposta

Duas coisas, nessa ordem — a segunda só cobre o que a primeira não apagar:

1. **Deletar (ou reescrever) árvore que só repete o filesystem.** Linha apagada não envelhece. É o argumento que a [US-83](./US-83-readme-com-arquitetura-alto-nivel.md) já faz (`:80` — *"toda linha que reafirma um arquivo é dívida"*) e que ela **executou** no README. Sobram as cópias em `CLAUDE.md` e `convencoes.md`.
2. **Checar o que sobrar**, no script que já existe — **só nos blocos que se declararem árvore** no *info string*.

#### Decisão de 28/07: a checagem é opt-in por bloco

Não ` ``` ` genérico varrido por regex, e sim ` ```tree ` (com `base=` opcional):

````md
```tree base=packages/ai-engine
src/
  prompts/
```
````

Fence sem `tree` é invisível ao gate — como já é hoje. Custa uma palavra por árvore real e mata as **duas** classes de falso positivo de uma vez: a base implícita (item 2 acima) e a doc que cita o erro (item 3), incluindo esta própria US, que continua com o bloco ilustrativo intacto.

O preço, honesto: **árvore nova nasce fora do gate até alguém marcá-la.** A alternativa (auto-detectar e manter lista de exceções) troca esse buraco por uma lista que ninguém revisa e por reprovar doc correta — que é como gate morre. Com 2 arquivos no corpus, marcar 2 fences é mais barato que qualquer heurística, e um bloco marcado é uma afirmação de que aquela árvore **é** o filesystem, não um desenho ilustrativo.

### Decisão final de 28/07: o gate não chega a ser escrito

O desenho acima sobrevive como contrato para o futuro, mas **nenhuma linha dele foi implementada** — porque a resposta da Questão #1 esvaziou o corpus. As três árvores restantes saíram no mesmo dia:

| Bloco | O que foi feito | Por quê |
|---|---|---|
| [`convencoes.md`](../03-implementacao/convencoes.md) *Estrutura do monorepo* | deletado, com ponteiro para o [`CLAUDE.md`](../../../CLAUDE.md) | 3ª cópia da mesma estrutura, e a única ainda afirmando `prisma/` na raiz |
| [`convencoes.md`](../03-implementacao/convencoes.md) *AI Engine → Estrutura de arquivos* | deletado, com ponteiro para [`packages/ai-engine/src`](../../../packages/ai-engine/src) | desenhava `src/tools/` com 7 arquivos: a pasta morreu na US-83 e os 7 nunca existiram |
| [`CLAUDE.md`](../../../CLAUDE.md) *Estrutura do repositório* | convertido em **lista com link relativo** | os caminhos passam a ser verificados pelo `pnpm docs:links` **que já existe** |

**O achado que fechou a questão: o que apodrece na árvore não é o caminho, é a anotação.** As 9 entradas da árvore do `CLAUDE.md` existiam todas — e a linha da API dizia `# NestJS (Game Server + REST + WebSocket)`. A US-83 removeu `@nestjs/platform-socket.io` de [`apps/api/package.json`](../../../apps/api/package.json) em 28/07 por ser dependência morta (streaming é SSE). Um gate de nível 0 teria olhado exatamente a metade certa da linha e passado.

**E converter para link é subir um degrau em vez de escrever um.** [`stripCode()`](../../../scripts/check-doc-links.mjs) ignora fence de propósito; tirar o caminho de dentro do fence troca "implementar um checker de árvore" por escrever `[apps/api](apps/api)`. Mesmo movimento da camada 2 da [US-83](./US-83-readme-com-arquitetura-alto-nivel.md), aplicado ao último bloco que tinha escapado dela. Custo: 0 linha de script, 0 passo de CI, 0 falso positivo possível.

---

## Escopo

> **O escopo abaixo foi reescrito em 28/07/2026.** O original (checagem nova no script, bucket, teste de regressão) está preservado na *Decisão final* como contrato para quem trouxer uma árvore de volta — não foi implementado, e a razão é medida, não preferência.

### Dentro do escopo

- Deletar as duas árvores de [`convencoes.md`](../03-implementacao/convencoes.md), deixando ponteiro para a fonte viva.
- Converter a árvore do [`CLAUDE.md`](../../../CLAUDE.md) em lista com link relativo — e corrigir a anotação "WebSocket", que o gate planejado nunca pegaria.
- Registrar o desenho ` ```tree ` + `base=` como **contrato dormente**: árvore que voltar volta marcada, e aí com um caso vigente que justifique o script.
- Comentário no lugar de cada bloco apagado dizendo **por que** ele saiu (regra do repo: comentário guarda o porquê, com número de US).

### Fora do escopo

- **Escrever o checker de árvore.** Virou desnecessário: 0 árvore restante. Contrato preservado na *Decisão final*, a ser implementado junto com a primeira árvore que voltar.
- ~~**A árvore do `README.md`.** É escopo da [US-83](./US-83-readme-com-arquitetura-alto-nivel.md)...~~ **Resolvido em 28/07/2026: a US-83 deletou a árvore.** Nada a cobrir lá. Foi o desfecho preferido pelas duas stories, e derrubou ~4 das 14 entradas da baseline original.
- **Reescrever [`convencoes.md`](../03-implementacao/convencoes.md).** O arquivo tem mentira que este gate não pega (módulos NestJS inexistentes, *"uma tool por arquivo"* ressuscitada depois de apagada do `AGENTS.md`). Esta story mexe nas **árvores** dele; o resto é auditoria de conteúdo e virou a [US-91](./US-91-auditar-convencoes-de-implementacao.md) em 28/07/2026 — mesmo argumento que a US-83 usou para o `evals/README.md` (virou a [US-90](./US-90-readme-de-evals-com-mapa-do-subsistema.md)). A auditoria da US-91 achou **8 afirmações erradas** no que sobrou do arquivo.
- **Reimplementar o guard de forma.** [`scripts/readme-shape.test.mjs`](../../../scripts/readme-shape.test.mjs) (US-83, `pnpm docs:shape`) já falha quando nasce ou some pasta de topo, pacote ou módulo de `apps/api/src/`. Detecta o **oposto** deste gate: forma que ficou incompleta, não caminho que morreu. Não duplicar.
- **Modo `--fix`.** Não há conserto mecânico aqui: um caminho que não existe pode ser rename, arquivo apagado ou base implícita. É exatamente o bucket que a US-79 classificou como "reportar, não reescrever" (`:99`).
- **Entradas aninhadas** (`  api/` sob `apps/`). Exigem pilha de indentação e reconstrução de caminho; o nível 0 pega o caso real observado com uma regex. Teto conhecido — ver *Questões em aberto* #2.
- **Arquivos citados dentro da árvore** (`schema.prisma`, `roll-dice.ts`). Mesmo motivo: são entradas aninhadas.
- Bloco cercado que não é árvore (código, saída de terminal, JSON). A regex de coluna 0 + `/` já os ignora — 14 hits em 125 fences.

---

## Critérios de aceite

> Reescritos em 28/07/2026 junto com o escopo. Os critérios do gate que não foi escrito estão listados logo abaixo, como contrato dormente.

- [x] **Zero árvore de diretório em bloco cercado** nos 103 `.md` varridos, fora blocos ilustrativos de US. Medido: as entradas de nível 0 caíram de 13 para as 3 desta própria US, todas dentro do exemplo que ela documenta.
- [x] Todo caminho da estrutura do [`CLAUDE.md`](../../../CLAUDE.md) é link relativo — portanto verificado pelo `pnpm docs:links` a cada rodada, sem código novo.
- [x] A anotação errada saiu junto: a linha da API dizia "WebSocket" e a dependência não existe mais desde a US-83. Hoje diz SSE.
- [x] As duas árvores de [`convencoes.md`](../03-implementacao/convencoes.md) saíram, cada uma com comentário dizendo por quê e apontando a fonte viva.
- [x] `pnpm docs:links` sai 0 depois das edições.
- [x] **Nenhuma reescrita mecânica.** Nenhum `--fix` novo; as três edições foram feitas à mão, com revisão do conteúdo — que é justamente o que um `--fix` não saberia fazer aqui.
- [x] Passo de CI da [US-80](./US-80-ci-typecheck-testes-e-evals.md) continua verde, sem passo novo: o workflow não mudou ([`ci.yml`](../../../.github/workflows/ci.yml) `:56`, `:61`, `:66`).

**Contrato dormente — critérios do gate, para quando existir árvore que o justifique:**

- [ ] `pnpm docs:links` reporta bucket novo de caminho de árvore inexistente, com arquivo e linha, e sai ≠ 0 quando houver.
- [ ] Só bloco com info string ```` tree ```` é checado; fence sem `tree` fica invisível, como hoje.
- [ ] Fence com ```` base=<caminho> ```` resolve as entradas a partir dele; sem `base=`, a partir da raiz do repo.
- [ ] Teste de regressão em `scripts/check-doc-links.test.mjs`: fixture com bloco ```` tree ```` contendo diretório inexistente é reprovada; a mesma árvore sem `tree` passa. Fixture apagada no `finally`, como a da US-79.

---

## Notas de implementação

- **Reaproveitar a máquina de fence que já existe.** `stripCode()` já sabe onde cada bloco começa e termina; hoje ele descarta o conteúdo. A checagem nova precisa do que ele joga fora — separar "detectar fence" de "mascarar fence" é o refactor mínimo, não escrever um segundo parser.
- **A regra dos offsets da US-79 não se aplica aqui**, porque não há reescrita: basta arquivo + número de linha para o relatório. Isso é metade do custo do `--fix` que aquela story pagou.
- **A `stripCode` já lê o info string** — a regex dela é `/^\s*(?:```|~~~)/` ([`:46`](../../../scripts/check-doc-links.mjs)), que casa a abertura sem capturar o resto da linha. Capturar o sufixo da linha de abertura e guardá-lo até o fence fechar é o delta; nenhum estado novo além disso.
- **O script já aceita argumento posicional** (`node scripts/check-doc-links.mjs caminho.md`, `:90-93`), criado na US-79 para o teste do `--fix` rodar sobre fixture sem varrer o repo. O teste de regressão desta story usa o mesmo caminho — não precisa de flag nova.
- **Regex de entrada de árvore:** `^([A-Za-z0-9_.@-]+)/(\s|$)` na coluna 0. Casa `prisma/` e `apps/`; não casa linha indentada, comentário, nem `https://`. Medida em 13 hits nos 103 arquivos (28/07) — se subir muito, o desenho está errado. Com o opt-in, o número que importa passa a ser **quantos blocos `tree` existem**, não quantos fences têm cara de árvore.
- **Confirmar que é diretório**, não só que o caminho existe (`statSync().isDirectory()`): a árvore escreve `prisma/` com barra, e um arquivo de mesmo nome não satisfaz a afirmação.
- **`tree` e `base=` são opt-in por bloco, não configuração global.** Config global viraria lista de exceções que ninguém revisa; no info string, a marcação fica ao lado da árvore que ela descreve e some junto quando a árvore for deletada.
- **Onde o script mora.** Se algo virar arquivo novo, ele vai na raiz `scripts/`, não em workspace: `pnpm test` é recursivo pelos workspaces e não alcança a raiz — foi por isso que `docs:links:test` e, depois, `docs:shape` ganharam script próprio no [`package.json`](../../../package.json) e passo próprio no CI.
- O script roda sobre **disco**, não `git ls-files` — a US-79 registrou o porquê (`:142`): `core.quotePath` faz arquivo com byte não-ASCII sumir da listagem sem aviso.

---

## Questões em aberto

> **As três foram respondidas em 28/07/2026.** Ficam registradas com a resposta embaixo, não apagadas: a #2 é o motivo de a story fechar sem código, e a #3 tem número medido que alguém vai querer reconferir antes de reabrir o assunto.

1. ~~**Quais árvores sobrevivem?**~~ **Nenhuma — respondida em 28/07/2026.** Sobravam três blocos em dois arquivos; os três saíram (ver *Decisão final*). O julgamento por arquivo foi este:
   - [`CLAUDE.md`](../../../CLAUDE.md) *Estrutura do repositório* — parecia **a mais defensável**: anotações que `ls` não dá, e as 9 entradas existiam todas. Foi ela que derrubou a tese. A linha `api/ # NestJS (Game Server + REST + WebSocket)` estava errada num campo que **nenhum** gate de caminho lê. Virou lista com link: os caminhos ficam sob o gate que já existe e a anotação fica sob revisão humana, que é o único lugar onde ela podia estar.
   - [`convencoes.md`](../03-implementacao/convencoes.md) *Estrutura do monorepo* — duplicava a de cima com uma mentira a mais (`prisma/`). Deletada; ponteiro para o `CLAUDE.md`.
   - [`convencoes.md`](../03-implementacao/convencoes.md) *AI Engine → Estrutura de arquivos* — **não tinha o que gatear.** A pasta desenhada não existe desde a US-83 e os 7 arquivos nunca existiram. Deletada; ponteiro para [`packages/ai-engine/src`](../../../packages/ai-engine/src).

   O padrão da US-83 se confirmou e ficou mais forte: o que é dívida é a *estrutura de caminhos* transcrita — e a anotação em volta dela apodrece igual, só que invisível a qualquer script.
2. ~~**Nível 0 basta — e o gate ainda vale?**~~ **Não vale. Respondida em 28/07/2026 e é o motivo de a story fechar sem código.** Com a #1 resolvida o corpus foi a zero: script + teste + bucket protegeriam nenhuma linha de doc. O que resta coberto: `pnpm docs:links` pega caminho morto (agora inclusive os do `CLAUDE.md`, que viraram link), e [`readme-shape.test.mjs`](../../../scripts/readme-shape.test.mjs) pega forma incompleta. **Fica o buraco, declarado:** árvore nova mal escrita não é reprovada por nada. Aceito porque hoje ela repetiria o diagrama do README — e se aparecer, o contrato ` ```tree ` está escrito e com um caso vigente para justificar as ~40 linhas.
3. ~~**Vale um gate para caminho nu em prosa?**~~ **Não, e agora com número — respondida em 28/07/2026.** Varredura dos 103 `.md`, fora de fence **e** fora de backtick e de destino de link: **7 ocorrências, 0 quebradas**. O corpus é quase vazio porque a convenção do repo já manda caminho para backtick ou link — o gate teria população de 7 e taxa de erro histórica 0. **Ressalva que continua de pé:** as mentiras vivas de `convencoes.md` (módulos NestJS inexistentes, *"uma tool por arquivo"* ressuscitada depois de apagada do `AGENTS.md`) são prosa, não caminho. Não é gate que resolve — é a story de auditoria daquele arquivo, listada em *Fora do escopo*.

---

## Referências no código

- [scripts/check-doc-links.mjs](../../../scripts/check-doc-links.mjs) — 279 linhas. `stripCode()` em `:46` (a máscara que hoje descarta o conteúdo do fence, e que já detecta a abertura), `ROOT_MD` em `:36`, varredura em `:95-97`, argumento posicional em `:94`, buckets do relatório mais abaixo.
- [scripts/check-doc-links.test.mjs](../../../scripts/check-doc-links.test.mjs) — 90 linhas; padrão de fixture temporária com `try/finally`.
- [scripts/readme-shape.test.mjs](../../../scripts/readme-shape.test.mjs) — o guard de forma da US-83 (`pnpm docs:shape`). Detecta o erro **oposto**: forma incompleta, não caminho morto. Hasheia `packages/ai-engine/src/tools` como `(ausente)` — é ali que se lê, sem abrir o disco, que a pasta desenhada pela árvore apagada de `convencoes.md` não existe.
- [docs/sdlc/03-implementacao/convencoes.md](../03-implementacao/convencoes.md) — as duas árvores saíram em 28/07; sobraram as mentiras em **prosa**, fora do alcance de qualquer um dos gates (módulos NestJS `campaign`/`ingestion`, *"uma tool por arquivo"*, `prisma/seed.ts` na raiz). Auditadas e contadas na [US-91](./US-91-auditar-convencoes-de-implementacao.md): 8 erradas, 2 parciais, 5 certas.
- [.github/workflows/ci.yml](../../../.github/workflows/ci.yml) — `:56` *Gate de docs*, `:61` *Teste do gate de docs*, `:66` *Guard de drift do README* (novo na US-83).
- [README.md](../../../README.md) — sem árvore desde 28/07/2026; os únicos fences são dois `mermaid` e um `bash`.
- [AGENTS.md](../../../AGENTS.md) — seção *Armadilhas do repo* e a regra de que afirmação vinda de doc é hipótese até ser verificada no código.
