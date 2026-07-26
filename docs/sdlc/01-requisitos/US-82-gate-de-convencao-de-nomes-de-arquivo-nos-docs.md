# US-82 — Gate de convenção de nomes de arquivo em `docs/sdlc/`

**Épico:** 5 — Ferramentas de projeto / SDLC
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** [US-81](./US-81-higiene-de-nomes-e-placeholders-nos-docs.md) — **bloqueante.** Ela renomeia os 3 arquivos fora da convenção; ligar o gate antes disso é entregar um check vermelho no primeiro dia. Nasceu da *Questão em aberto 2* daquela story. Ganha dentes com a [US-80](./US-80-ci-typecheck-testes-e-evals.md) (CI), mas não depende dela: sem CI o gate é um comando local, exatamente como o `pnpm docs:links` é hoje.
**Criada em:** 2026-07-26

---

## História

> **Como** desenvolvedora / dona do produto,
> **quero** que `pnpm docs:links` **falhe** quando um `.md` de `docs/sdlc/` tiver nome fora da convenção,
> **para que** o próximo `US-83-nome com espaço.md` seja pego no commit que o cria, e não numa auditoria seis meses depois.

---

## Contexto e motivação

### O problema observado

A [US-81](./US-81-higiene-de-nomes-e-placeholders-nos-docs.md) conserta **3 arquivos**. Não conserta o processo que os criou: nada no repo impede o quarto. A convenção `US-NN[a]-titulo-em-kebab-case-ascii.md` existe de fato — **62 dos 66** `US-*.md` já a seguem — mas existe só como hábito. Hábito não sobrevive a pressa.

Estado hoje (`docs/`, 90 arquivos `.md`):

| | Contagem | Onde |
|---|---:|---|
| `.md` com espaço ou byte não-ASCII no nome | 9 | 4 em `docs/sdlc/01-requisitos/`, 5 em `docs/prompts/` |
| `US-*.md` fora de `^US-[0-9]+[a-z]?-[a-z0-9-]+\.md$` | 4 | os 3 da US-81 + `US-76-…extractOpeningEntities.md` |

Depois da US-81 esses números viram **5** (todos em `docs/prompts/`, fora do escopo por decisão) e **1** (a exceção deliberada do `US-76`). É o momento certo para congelar: o custo de ligar um gate é mínimo quando ele já nasce verde.

### O custo não é estético

Nome com byte não-ASCII faz ferramenta engolir arquivo **em silêncio**. Já cobrou: a contagem manual da US-78 reportou **79** arquivos em vez de 83 porque `git ls-tree --name-only` põe esses paths entre aspas (`core.quotePath`) e o `grep '\.md$'` deixa de casar. Ninguém percebeu até alguém escrever um script.

Espaço no nome é mais barato mas mais frequente: obriga `%20` no link, e o encoding à mão é provavelmente a razão de `US-01` e `US-02` terem virado `[US-NN](#)` em vez de link de verdade (US-81, *Contexto*). Ou seja: **nome ruim vira link ruim**, que é o problema que a US-78 e a US-79 estão pagando para consertar.

### Por que o `pnpm docs:links` não pega

`scripts/check-doc-links.mjs` valida **destino de link**, não **nome de arquivo**. Um arquivo com nome errado ao qual ninguém aponta passa 100% limpo — e é justamente o caso perigoso, porque nome errado desencoraja o link.

O detalhe que torna esta story barata: o script **já tem a lista completa de nomes na mão**. `mdFiles()` varre `docs/` recursivamente (`check-doc-links.mjs:46-58`, pulando `node_modules` e pastas ocultas) e o resultado já está em `files` (`:73`). Falta só olhar para os nomes antes de olhar para os links.

---

## Decisões

### O check entra no script que já existe, não num script novo

`scripts/check-doc-links.mjs` já varre os arquivos, já tem `--list`, já tem gate com `process.exit(1)`, já é chamado por `pnpm docs:links` e já está documentado no `docs/README.md`. Um `check-doc-names.mjs` separado duplicaria a varredura, o formato de saída, a entrada no `package.json` e o passo de CI da [US-80](./US-80-ci-typecheck-testes-e-evals.md) — para ~15 linhas de lógica.

O nome do script fica como está. Renomear para `check-docs.mjs` custaria mais do que vale (script, `package.json`, `docs/README.md`, referências em 4 stories) e é exatamente o tipo de rename que a US-79 existe para limpar.

### Duas regras, escopos diferentes

1. **Sem espaço, sem byte não-ASCII** — vale para **todo** `.md` sob `docs/sdlc/`. É a regra com custo medido.
2. **`^US-[0-9]+[a-z]?-[a-z0-9-]+\.md$`** — vale só para os arquivos que começam com `US-`. É a convenção descritiva da US-81, não uma invenção desta story.

A regra 2 sozinha não cobre `modificadores atributos.md` (não é `US-*`); a regra 1 sozinha deixaria passar `US-83-Nome_Estranho.md`. As duas juntas custam duas linhas.

### `docs/prompts/` fica de fora — como na US-81

Os 5 arquivos com espaço lá continuam válidos. São despejos de prompt ad-hoc, ninguém os linka, e a US-81 já decidiu não arrumá-los. **Consequência prática: o gate é escopado a `docs/sdlc/`, não a `docs/`** — se fosse a `docs/`, nasceria vermelho e a primeira reação de quem trombasse nele seria desligá-lo.

### Duas exceções nomeadas, com comentário

- `US-TEMPLATE.md` — maiúscula proposital; o Kanban já a exclui por nome (`kanban-server.js:50`).
- `US-76-consertar-fake-teste-extractOpeningEntities.md` — o camelCase é o nome real da função; achatar perderia informação.

Allowlist literal de 2 strings no script, com o porquê em comentário. Nada de arquivo de configuração para duas linhas.

### `--only-md` não muda de significado

O bucket de nomes entra no **gate default** e na saída do `--list`, mas **fora** do `--only-md`. Aquela flag é o critério de aceite da [US-78](./US-78-vault-obsidian-para-os-docs.md), já dado como cumprido; mudar o que ela cobre reescreveria retroativamente um aceite de outra story.

---

## Escopo

### Dentro do escopo

- Novo bucket `nome` em `scripts/check-doc-links.mjs`, alimentado a partir de `files` — sem segunda varredura de disco.
- As duas regras acima, escopadas a `docs/sdlc/`, com a allowlist de 2 exceções.
- Linha no resumo do console, no mesmo formato das outras (`nome fora da convenção : N`), e entrada no `--list` dizendo **qual regra** o arquivo viola.
- Bucket somado ao gate default; **não** somado ao `--only-md`.
- Atualizar a seção *Verificação de links* do `docs/README.md`: o comando agora cobre duas coisas, e quem lê aquilo antes de criar um arquivo precisa ver a convenção.

### Fora do escopo

- **Renomear qualquer arquivo.** É a [US-81](./US-81-higiene-de-nomes-e-placeholders-nos-docs.md); esta story assume aquele estado e o congela.
- **`docs/prompts/`** — ver *Decisões*.
- **Arquivos que não são `.md`** (imagens, `.json`, `.canvas` do Obsidian). O script coleta só `.md`; ampliar é mudar a varredura para pegar um caso que não existe hoje.
- **`docs/` fora de `docs/sdlc/`** — `docs/prd.md`, `docs/adr/`, `docs/README.md` já estão em kebab-case ASCII, mas não têm convenção escrita. Estendê-los é decisão à parte, não higiene.
- **Auto-fix / rename automático.** Renomear reescrevendo links é o que o Obsidian faz (US-78). Um script que renomeia e deixa link para trás recria a US-79.
- **Hook de pre-commit.** Mesmo motivo que a US-80 registra: depende de configuração por máquina e é pulável com `--no-verify`. O gate é o CI.
- **Adicionar o passo ao workflow do CI.** O workflow é da [US-80](./US-80-ci-typecheck-testes-e-evals.md) e ainda não existe (`.github/workflows/` está ausente). Quando existir, é um passo `pnpm docs:links` — mas o gate default hoje ainda está vermelho pelos 103 links da US-79, então a ordem real é US-79 → passo no CI.

---

## Critérios de aceite

- [ ] Com `docs/` no estado pós-US-81, o bucket `nome` reporta **0**.
- [ ] **Teste de regressão (o gate morde):** criar `docs/sdlc/01-requisitos/US-99-nome com espaço.md` vazio, rodar `pnpm docs:links`, obter **exit code 1** com o arquivo nomeado na saída. Repetir com `US-99-acentuação.md` e com `US-99-Nome_Errado.md`. Apagar os três.
- [ ] **Teste de regressão (o gate não morde à toa):** `US-TEMPLATE.md`, `US-76-consertar-fake-teste-extractOpeningEntities.md`, `US-11b-estado-de-cena-estruturado.md` (sufixo de letra) e `criterios-de-aceite.md` (não-`US-*`) **não** aparecem no bucket.
- [ ] Os 5 arquivos de `docs/prompts/` com espaço no nome **não** aparecem no bucket.
- [ ] `pnpm docs:links --only-md` reporta o **mesmo** resultado de antes desta story — mesmos números, mesmo exit code. O aceite da US-78 continua valendo.
- [ ] `pnpm docs:links --list` mostra, para cada arquivo do bucket, qual das duas regras foi violada.
- [ ] O script continua **sem dependência externa** (Node puro), como o `docs/README.md` promete.
- [ ] `docs/README.md` diz, em uma linha, qual é a convenção e que `pnpm docs:links` a cobra.

---

## Notas de implementação

> *Dicas, não especificação obrigatória.*

- **Onde plugar:** depois de `const files = await mdFiles(DOCS)` (`check-doc-links.mjs:73`), antes do laço de links. `files` já vem ordenado.
- **Escopo por caminho:** filtrar por `relative(DOCS, file)` começando com `sdlc${sep}` — não por string com `/`, que quebra no Windows (o script já normaliza com `posix.join(...split(sep))` ao imprimir, pelo mesmo motivo).
- **Não-ASCII:** testar o **basename**, não o caminho inteiro — o repo vive em `C:\Users\Catarina\Desktop\AI DM\`, cujo próprio caminho tem espaço. Um teste sobre o path absoluto acusaria todos os 90 arquivos.
- **Espaço:** o `\x20` está dentro da faixa ASCII imprimível, então uma checagem só de não-ASCII **não** pega espaço. São dois testes, não um.
- **Sequência de composição Unicode:** `ç` pode vir como um code point ou como `c` + combining cedilla, dependendo de quem criou o arquivo (macOS normaliza em NFD). Os dois caem fora de `\x20-\x7E`, então a checagem de faixa pega os dois — não é preciso normalizar. Vale o comentário no código, porque o próximo leitor vai se perguntar.
- **`stripCode` não tem nada a ver com isto.** Aquilo neutraliza backtick no *conteúdo*; nome de arquivo não passa por lá.
- **Ordem de trabalho:** rodar `pnpm docs:links` **antes** de mexer no script e guardar os números. Todos os buckets existentes precisam sair idênticos depois — o único delta aceitável é a linha nova.

---

## Alternativas consideradas e rejeitadas

1. **Script separado `check-doc-names.mjs`.** Rejeitada: duplica varredura, saída, entrada de `package.json` e passo de CI para ~15 linhas de lógica. O script atual já tem a lista de arquivos na mão.
2. **Só a regra de espaço/não-ASCII, sem o regex de kebab-case.** Tentadora — é a regra com custo medido. Rejeitada porque a segunda regra custa uma linha e a story é justamente sobre o *próximo* arquivo: `US-83-Nome_Estranho.md` passa na regra 1 e mesmo assim quebra a convenção que 62 arquivos seguem.
3. **Aplicar o gate a `docs/` inteiro.** Rejeitada: nasceria vermelho pelos 5 arquivos de `docs/prompts/`, que a US-81 decidiu conscientemente não arrumar. Gate que nasce vermelho é gate que alguém desliga.
4. **Ligar o gate antes da US-81.** Mesmo problema, versão pior: vermelho por 4 arquivos que outra story já está resolvendo.
5. **Auto-rename ao detectar violação.** Rejeitada: renomear sem reescrever os links que apontam para o arquivo é precisamente como a US-79 nasceu. Rename com reescrita é trabalho do Obsidian (US-78), não de um linter.

---

## Questões em aberto

1. **A convenção vale para `docs/adr/` e `docs/prd.md`?** Hoje todos já são kebab-case ASCII por acidente feliz. Estender o escopo é barato (uma linha no filtro), mas cobra uma convenção que ninguém escreveu para aquelas pastas. Decidir se `docs/adr/` merece a regra 1 (espaço/não-ASCII) mesmo sem a regra 2.
2. **`docs/prompts/` fica permanentemente fora, ou vira dívida registrada?** A US-81 decidiu "não arrumar"; esta story herda. Se a pasta um dia passar a ser linkada de dentro do SDLC, a decisão precisa ser revisitada — e aí é rename (US-78), não gate.

---

## Referências no código

- `scripts/check-doc-links.mjs:46-58` — `mdFiles()`, a varredura recursiva que já produz a lista.
- `scripts/check-doc-links.mjs:73` — `const files = …`, ponto de inserção do check.
- `scripts/check-doc-links.mjs:114-142` — resumo no console, `--list` e o gate; o bucket novo entra no mesmo formato.
- `scripts/check-doc-links.mjs:100` — normalização `posix.join(...relative(...).split(sep))`, padrão a seguir ao imprimir caminho.
- `package.json` (raiz) — `docs:links: node scripts/check-doc-links.mjs`.
- `docs/README.md` — seção *Verificação de links*, onde a convenção precisa aparecer.
- `tools/kanban/kanban-server.js:49-50` — filtro `/^US-.*\.md$/` que exclui `US-TEMPLATE.md`; mesma exceção, mesma razão.
- **Ausência de `.github/workflows/`** — o gate só roda sozinho quando a [US-80](./US-80-ci-typecheck-testes-e-evals.md) existir.
