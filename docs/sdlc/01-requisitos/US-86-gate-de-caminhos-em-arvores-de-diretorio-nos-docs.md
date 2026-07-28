# US-86 — Árvore de diretórios na documentação deixa de mentir sobre onde o arquivo está

**Épico:** 0 — Infra e documentação
**Fase:** 1 — MVP single-player
**Status:** 🚧 Em progresso
**Depende de:** [US-78](./US-78-vault-obsidian-para-os-docs.md) e [US-79](./US-79-consertar-links-quebrados-na-documentacao.md) — **satisfeitas**. Entregaram `scripts/check-doc-links.mjs` e o par `pnpm docs:links` / `docs:links:test`. Esta story **estende** esse script com uma checagem nova; não cria um segundo.
**Nasceu de:** sessão de 27/07/2026. O `prisma/` aparecia como diretório de **raiz** em 4 arquivos; o real é `apps/api/prisma/`. Três foram corrigidos à mão na hora ([`AGENTS.md`](../../../AGENTS.md), [`CLAUDE.md`](../../../CLAUDE.md), [`README.md`](../../../README.md)); o quarto ([`convencoes.md:16`](../03-implementacao/convencoes.md)) só apareceu quando a baseline foi medida por script — ninguém o tinha visto em 4 leituras manuais.
**Relacionada a:** [US-80](./US-80-ci-typecheck-testes-e-evals.md) (é lá que o gate ganha dentes), [US-82](./US-82-gate-de-convencao-de-nomes-de-arquivo-nos-docs.md) (mesma família: gate mecânico sobre doc), [US-83](./US-83-readme-com-arquitetura-alto-nivel.md) (quer **deletar** a árvore do README — ver *Escopo*).
**Criada em:** 2026-07-27

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

A [US-83](./US-83-readme-com-arquitetura-alto-nivel.md) já tinha auditado esse caso no README (é uma das 4 "mentiras" da tabela dela, `:27`) — o que prova que **achar** não é o gargalo. O erro sobreviveu à auditoria porque nada o reprova continuamente.

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

**O segundo é falso positivo, e é o achado que decide o desenho.** Aquela árvore está sob o cabeçalho `## AI Engine (packages/ai-engine)` — o `src/` dela é `packages/ai-engine/src/`, que existe. A base não é a raiz do repo; é implícita na prosa acima do bloco. Um gate que assume "nível 0 = raiz do repo" reprova documentação correta, e gate com falso positivo é gate que alguém desliga.

### A proposta

Duas coisas, nessa ordem — a segunda só cobre o que a primeira não apagar:

1. **Deletar árvore que só repete o filesystem.** Linha apagada não envelhece. É o argumento que a [US-83](./US-83-readme-com-arquitetura-alto-nivel.md) já faz (`:56` — *"toda linha que reafirma um arquivo é dívida"*), aplicado às cópias em `CLAUDE.md` e `convencoes.md`.
2. **Checar o que sobrar**, no script que já existe, com a base declarada no *info string* do fence.

---

## Escopo

### Dentro do escopo

- Checagem nova em `scripts/check-doc-links.mjs`: para cada bloco cercado, entradas na coluna 0 terminando em `/` têm de existir em disco como diretório.
- **Base declarável** no info string: ```` ```tree base=packages/ai-engine ````. Sem `base=`, a base é a raiz do repo.
- Bucket próprio no relatório (o script já separa por story dona) e exit ≠ 0 no gate.
- Teste de regressão em `scripts/check-doc-links.test.mjs`, no padrão `node:test` da [US-79](./US-79-consertar-links-quebrados-na-documentacao.md).
- Corrigir os 2 achados da baseline: `prisma/` de `convencoes.md`, e declarar a base da árvore de `packages/ai-engine`.
- Decidir, por arquivo, entre **deletar** a árvore e **mantê-la sob o gate** (ver *Questões em aberto* #1).

### Fora do escopo

- **A árvore do `README.md`.** É escopo da [US-83](./US-83-readme-com-arquitetura-alto-nivel.md), que quer deletá-la junto com as outras 3 duplicações. Esta story não decide por ela; se a US-83 rodar antes, sobra menos para o gate cobrir — e tudo bem, é o desfecho preferido.
- **Modo `--fix`.** Não há conserto mecânico aqui: um caminho que não existe pode ser rename, arquivo apagado ou base implícita. É exatamente o bucket que a US-79 classificou como "reportar, não reescrever" (`:99`).
- **Entradas aninhadas** (`  api/` sob `apps/`). Exigem pilha de indentação e reconstrução de caminho; o nível 0 pega o caso real observado com uma regex. Teto conhecido — ver *Questões em aberto* #2.
- **Arquivos citados dentro da árvore** (`schema.prisma`, `roll-dice.ts`). Mesmo motivo: são entradas aninhadas.
- Bloco cercado que não é árvore (código, saída de terminal, JSON). A regex de coluna 0 + `/` já os ignora — 14 hits em 125 fences.

---

## Critérios de aceite

- [ ] `pnpm docs:links` reporta bucket novo de caminho de árvore inexistente, com arquivo e linha, e sai ≠ 0 quando houver.
- [ ] Fence com ```` base=<caminho> ```` resolve as entradas a partir dele; sem `base=`, a partir da raiz do repo.
- [ ] **Zero falsos positivos na baseline atual:** com a base declarada em `convencoes.md`, os 14 hits de nível 0 saem todos verdes. Um gate que reprova doc correta não entra no CI.
- [ ] Os 2 achados corrigidos: `prisma/` → sob `apps/api/`, e a árvore de `packages/ai-engine` com base declarada (ou ambas deletadas, se a Questão #1 for por aí).
- [ ] **Teste de regressão:** fixture `.md` com árvore contendo um diretório inexistente é reprovada, e uma com `base=` válida passa. Fixture apagada no `finally`, como a da US-79.
- [ ] **Nenhuma reescrita.** Sem `--fix` para este bucket; o script só reporta. `git status` limpo depois de rodar o gate.
- [ ] Passo de CI da [US-80](./US-80-ci-typecheck-testes-e-evals.md) continua verde — o gate já roda `pnpm docs:links` completo, então a checagem nova entra sem mudar o workflow.

---

## Notas de implementação

- **Reaproveitar a máquina de fence que já existe.** `stripCode()` já sabe onde cada bloco começa e termina; hoje ele descarta o conteúdo. A checagem nova precisa do que ele joga fora — separar "detectar fence" de "mascarar fence" é o refactor mínimo, não escrever um segundo parser.
- **A regra dos offsets da US-79 não se aplica aqui**, porque não há reescrita: basta arquivo + número de linha para o relatório. Isso é metade do custo do `--fix` que aquela story pagou.
- **Regex de entrada de árvore:** `^([A-Za-z0-9_.@-]+)/(\s|$)` na coluna 0. Casa `prisma/` e `apps/`; não casa linha indentada, comentário, nem `https://`. Medida em 14 hits nos 98 arquivos — se subir muito, o desenho está errado.
- **Confirmar que é diretório**, não só que o caminho existe (`statSync().isDirectory()`): a árvore escreve `prisma/` com barra, e um arquivo de mesmo nome não satisfaz a afirmação.
- **`base=` é opt-in por bloco, não configuração global.** Config global viraria lista de exceções que ninguém revisa; no info string, a base fica ao lado da árvore que ela descreve e some junto quando a árvore for deletada.
- O script roda sobre **disco**, não `git ls-files` — a US-79 registrou o porquê (`:142`): `core.quotePath` faz arquivo com byte não-ASCII sumir da listagem sem aviso.

---

## Questões em aberto

1. **Quais árvores sobrevivem?** A opção 1 da proposta (deletar) é mais barata que qualquer gate, mas nem toda árvore é pura duplicação: as do `CLAUDE.md` e do `convencoes.md` carregam **anotações** que `ls` não dá (`ai-engine/ # DM Agent: Vercel AI SDK + tools + prompts`). O que é dívida é a *estrutura de caminhos*, não o comentário. Uma saída é converter em lista em prosa (`apps/api` — NestJS Game Server), que descreve sem desenhar hierarquia e some do escopo do gate. Decidir por arquivo, não por regra geral.
2. **Nível 0 basta?** Pega o caso observado 4 vezes e custa uma regex. Entrada aninhada errada (`apps/  prisma/`) escapa. Medir antes de ampliar: se a árvore certa é rara depois da Questão #1, o gate cobre pouca coisa e vira candidato a ser deletado junto.
3. **Vale um gate para caminho nu em prosa?** Fora de fence, `apps/api/prisma/` numa frase também pode mentir e ninguém verifica. É a mesma classe, um corpus muito maior e ambiguidade alta (`docs/` no meio de uma frase não é afirmação de existência). Não abrir sem medir.

---

## Referências no código

- [scripts/check-doc-links.mjs](../../../scripts/check-doc-links.mjs) — `stripCode()` (a máscara que hoje descarta o conteúdo do fence) e a estrutura de buckets do relatório.
- [scripts/check-doc-links.test.mjs](../../../scripts/check-doc-links.test.mjs) — padrão de fixture temporária com `try/finally`.
- [docs/sdlc/03-implementacao/convencoes.md](../03-implementacao/convencoes.md) — os 2 achados da baseline (`:16` e `:51`).
- [.github/workflows/ci.yml](../../../.github/workflows/ci.yml) — passos *Gate de docs* e *Teste do gate de docs*.
- [AGENTS.md](../../../AGENTS.md) — seção *Armadilhas do repo* e a regra de que afirmação vinda de doc é hipótese até ser verificada no código.
