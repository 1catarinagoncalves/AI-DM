# US-82 — Gate de convenção de nomes de arquivo em `docs/sdlc/`

**Épico:** 5 — Ferramentas de projeto / SDLC
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** [US-81](./US-81-higiene-de-nomes-e-placeholders-nos-docs.md) — **satisfeita** (commit `720c452`). Ela renomeou os 3 arquivos fora da convenção; ligar o gate antes disso seria entregar um check vermelho no primeiro dia. Nasceu da *Questão em aberto 2* daquela story. Ganha dentes com a [US-80](./US-80-ci-typecheck-testes-e-evals.md) (CI), mas não depende dela: sem CI o gate é um comando local, exatamente como o `pnpm docs:links` é hoje.
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

Estado **pós-US-81** (`docs/`, 91 arquivos `.md`, auditado em 2026-07-26):

| | Antes da US-81 | Hoje | Onde |
|---|---:|---:|---|
| `.md` com espaço ou byte não-ASCII no nome | 9 | **5** | todos em `docs/prompts/` |
| `US-*.md` fora de `^US-[0-9]+[a-z]?-[a-z0-9-]+\.md$` | 4 | **2** | `US-TEMPLATE.md` e `US-76-…extractOpeningEntities.md` — as duas exceções deliberadas |
| `.md` fora de `docs/sdlc/` violando espaço/não-ASCII | — | **0** | `docs/adr/` (6/6 limpos), `docs/prd.md`, `docs/README.md` |

Ou seja: **fora de `docs/prompts/`, `docs/` inteiro já está em conformidade.** É o momento exato de congelar — o custo de ligar um gate é mínimo quando ele já nasce verde.

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

1. **Sem espaço, sem byte não-ASCII** — vale para **todo** `.md` de `docs/`, exceto `docs/prompts/` (ver decisão seguinte). É a regra com custo medido.
2. **`^US-[0-9]+[a-z]?-[a-z0-9-]+\.md$`** — vale só para os arquivos que começam com `US-`. É a convenção descritiva da US-81, não uma invenção desta story.

A regra 2 sozinha não cobre `modificadores atributos.md` (não é `US-*`); a regra 1 sozinha deixaria passar `US-83-Nome_Estranho.md`. As duas juntas custam duas linhas.

### Regra 1 vale para `docs/` inteiro, não só `docs/sdlc/` — *resolve a Questão em aberto 1*

A versão original desta story escopava as duas regras a `docs/sdlc/`, para não nascer vermelha por causa de `docs/prompts/`. A auditoria mostrou que essa precaução é grande demais: **`docs/prompts/` é a única pasta que viola a regra 1**. `docs/adr/` (6 arquivos), `docs/prd.md` e `docs/README.md` já passam.

Então a exclusão certa é `docs/prompts/`, não "tudo que não é `docs/sdlc/`". Escopar a regra 1 a `docs/` menos `docs/prompts/` custa o mesmo filtro de uma linha, nasce igualmente verde, e cobre o `docs/adr/007-…` que ainda não existe — que é exatamente o arquivo que esta story existe para pegar. Um gate que ignora a pasta onde o próximo arquivo vai nascer não é gate.

**A regra 2 não é estendida.** Ela codifica uma convenção `US-NN` que só existe em `docs/sdlc/01-requisitos/`; `docs/adr/` tem outra (`NNN-titulo`) e `docs/prd.md` não tem nenhuma. Cobrar regex de nome em pasta sem convenção escrita é inventar regra, não congelar hábito — ver *Alternativas* 6.

### `docs/prompts/` é dívida registrada, não exceção invisível — *resolve a Questão em aberto 2*

Os 5 arquivos com espaço lá continuam válidos: são despejos de prompt ad-hoc e a US-81 já decidiu não arrumá-los. O que **muda** em relação à US-81 é que a isenção deixa de ser silenciosa. Duas implementações, ambas baratas:

1. **A isenção é contada e impressa** em toda execução — `isentos (docs/prompts/) : 5`, fora do gate. Uma pasta que aparece toda vez no resumo é dívida; uma pasta que o `readdir` pula em silêncio é buraco. O número também vira sensor: se virar 6, alguém criou mais um.
2. **A isenção tem trip-wire.** Ela se justifica por *"ninguém linka aquilo"* — hoje verdade, **0 links** relativos de `docs/` apontam para `docs/prompts/` (os hits de `prompts/` no repo são todos `packages/ai-engine/src/prompts/`). Se um `.md` de fora passar a linkar um arquivo de lá, a premissa caiu e o gate **falha**, mandando renomear (US-78) e remover a isenção. Sem isso, a condição da decisão vive só na prosa desta story e ninguém a revisita.

Os dois usam dado que o script já tem: a lista de arquivos e o caminho absoluto já resolvido de cada link.

### Duas exceções nomeadas, com comentário

- `US-TEMPLATE.md` — maiúscula proposital; o Kanban já a exclui por nome (`kanban-server.js:50`).
- `US-76-consertar-fake-teste-extractOpeningEntities.md` — o camelCase é o nome real da função; achatar perderia informação.

Allowlist literal de 2 strings no script, com o porquê em comentário. Nada de arquivo de configuração para duas linhas.

### `--only-md` não muda de significado

Os buckets `nome` e `isento-linkado` entram no **gate default** e na saída do `--list`, mas **fora** do `--only-md`. Aquela flag é o critério de aceite da [US-78](./US-78-vault-obsidian-para-os-docs.md), já dado como cumprido; mudar o que ela cobre reescreveria retroativamente um aceite de outra story. O contador de isentos é informativo e não entra em gate nenhum.

---

## Escopo

### Dentro do escopo

- Novo bucket `nome` em `scripts/check-doc-links.mjs`, alimentado a partir de `files` — sem segunda varredura de disco.
- **Regra 1** (espaço / não-ASCII) escopada a `docs/` **menos** `docs/prompts/`; **regra 2** (`^US-…`) só nos arquivos `US-*`, com a allowlist de 2 exceções.
- Linha no resumo do console, no mesmo formato das outras (`nome fora da convenção : N`), e entrada no `--list` dizendo **qual regra** o arquivo viola.
- **Contador de isentos** — linha `isentos (docs/prompts/) : N` no resumo, fora do gate. Torna a dívida visível a cada execução.
- **Trip-wire da isenção** — bucket `isento-linkado`: link relativo, partindo de um `.md` fora de `docs/prompts/`, cujo alvo resolvido cai dentro de `docs/prompts/`. Entra no gate default com mensagem apontando US-78 (rename) e a remoção da isenção. Hoje: 0.
- Buckets `nome` e `isento-linkado` somados ao gate default; **nenhum** dos dois somado ao `--only-md`.
- Atualizar a seção *Verificação de links* do `docs/README.md`: o comando agora cobre três coisas, e quem lê aquilo antes de criar um arquivo precisa ver a convenção e a isenção.

### Fora do escopo

- **Renomear qualquer arquivo.** É a [US-81](./US-81-higiene-de-nomes-e-placeholders-nos-docs.md); esta story assume aquele estado e o congela. Inclui os 5 de `docs/prompts/`: eles ficam como estão, só passam a ser contados.
- **Regra de nome para `docs/adr/` e `docs/prd.md`** além da regra 1 — ver *Decisões* e *Alternativas* 6.
- **Arquivos que não são `.md`** (imagens, `.json`, `.canvas` do Obsidian). O script coleta só `.md`; ampliar é mudar a varredura para pegar um caso que não existe hoje.
- **Auto-fix / rename automático.** Renomear reescrevendo links é o que o Obsidian faz (US-78). Um script que renomeia e deixa link para trás recria a US-79.
- **Hook de pre-commit.** Mesmo motivo que a US-80 registra: depende de configuração por máquina e é pulável com `--no-verify`. O gate é o CI.
- **Adicionar o passo ao workflow do CI.** O workflow é da [US-80](./US-80-ci-typecheck-testes-e-evals.md) e ainda não existe (`.github/workflows/` está ausente). Quando existir, é um passo `pnpm docs:links` — mas o gate default hoje ainda está vermelho pelos **85** links da US-79 (82 de profundidade + 3 de código, medido em 2026-07-26), então a ordem real é US-79 antes do passo no CI.

---

## Critérios de aceite

- [x] Com `docs/` no estado atual, o bucket `nome` reporta **0** e o bucket `isento-linkado` reporta **0**.
- [x] **Teste de regressão (o gate morde):** criar `docs/sdlc/01-requisitos/US-99-nome com espaço.md` vazio, rodar `pnpm docs:links`, obter **exit code 1** com o arquivo nomeado na saída. Repetir com `US-99-acentuação.md` e com `US-99-Nome_Errado.md`. Apagar os três.
- [x] **Teste de regressão (o gate morde fora de `docs/sdlc/`):** criar `docs/adr/007-nome com espaço.md` vazio → **exit code 1**, arquivo nomeado, violação apontada como regra 1. Apagar.
- [x] **Teste de regressão (o gate não morde à toa):** `US-TEMPLATE.md`, `US-76-consertar-fake-teste-extractOpeningEntities.md`, `US-11b-estado-de-cena-estruturado.md` (sufixo de letra), `criterios-de-aceite.md` (não-`US-*`), os 6 `docs/adr/NNN-*.md` e `docs/prd.md` **não** aparecem no bucket `nome`.
- [x] Os 5 arquivos de `docs/prompts/` com espaço no nome **não** aparecem no bucket `nome` — aparecem no contador de isentos, com o número **5**.
- [x] **Trip-wire:** adicionar num `.md` de `docs/sdlc/` um link relativo para um arquivo de `docs/prompts/` faz o bucket `isento-linkado` reportar 1 e o gate default falhar, com mensagem citando US-78 e a remoção da isenção. Um link *dentro* de `docs/prompts/` apontando para outro arquivo de lá **não** dispara. Desfazer.
- [x] `pnpm docs:links --only-md` reporta o **mesmo** resultado de antes desta story — mesmos números, mesmo exit code. O aceite da US-78 continua valendo.
- [x] Os buckets de link existentes (`depth`, `code`, `md`, `ambig`) saem com os **mesmos números** de antes: 82 / 3 / 0 / 0, total 85.
- [x] `pnpm docs:links --list` mostra, para cada arquivo do bucket `nome`, qual das duas regras foi violada, e para cada `isento-linkado`, origem e alvo.
- [x] O script continua **sem dependência externa** (Node puro), como o `docs/README.md` promete.
- [x] `docs/README.md` diz qual é a convenção, que `pnpm docs:links` a cobra, e que `docs/prompts/` é isento **enquanto ninguém linkar de lá**.

---

## Notas de implementação

> *Dicas, não especificação obrigatória.*

- **Onde plugar:** o check de nomes vai depois de `const files = await mdFiles(DOCS)` (`check-doc-links.mjs:73`), antes do laço de links. `files` já vem ordenado. O trip-wire vai **dentro** do laço, no ramo em que o link resolve (`:95`) — o alvo já foi resolvido ali, não precisa de segundo `resolve`.
- **Escopo por caminho:** um único predicado `isPrompts(abs)` = `relative(DOCS, abs)` começando com `prompts${sep}`, usado nos dois lugares (pular na regra 1, disparar no trip-wire). Comparar com `sep`, não com `/` literal, que quebra no Windows — o script já normaliza com `posix.join(...split(sep))` ao imprimir, pelo mesmo motivo.
- **Trip-wire, os dois lados:** dispara quando `isPrompts(alvo) && !isPrompts(origem)`. Sem a segunda metade, um link interno de `docs/prompts/` acusaria a própria pasta.
- **Contador de isentos:** é `files.filter(isPrompts).length`, não uma variável acumulada. Uma expressão, sem estado.
- **Forma dos buckets:** `buckets` hoje guarda só hits de link (`{ where, raw }`) e o `--list` itera `Object.entries(buckets)` presumindo esse formato (`:126-133`). Hits de nome têm outra forma — usar arrays separados e imprimir em blocos próprios sai mais barato que generalizar a impressão. `broken` já é soma explícita dos 4 buckets de link (`:114`), então os novos não o contaminam; o gate é que precisa somá-los.
- **Não-ASCII:** testar o **basename**, não o caminho inteiro — o repo vive em `C:\Users\Catarina\Desktop\AI DM\`, cujo próprio caminho tem espaço. Um teste sobre o path absoluto acusaria todos os 90 arquivos.
- **Espaço:** o `\x20` está dentro da faixa ASCII imprimível, então uma checagem só de não-ASCII **não** pega espaço. São dois testes, não um.
- **Sequência de composição Unicode:** `ç` pode vir como um code point ou como `c` + combining cedilla, dependendo de quem criou o arquivo (macOS normaliza em NFD). Os dois caem fora de `\x20-\x7E`, então a checagem de faixa pega os dois — não é preciso normalizar. Vale o comentário no código, porque o próximo leitor vai se perguntar.
- **`stripCode` não tem nada a ver com isto.** Aquilo neutraliza backtick no *conteúdo*; nome de arquivo não passa por lá.
- **Ordem de trabalho:** rodar `pnpm docs:links` **antes** de mexer no script e guardar os números. Todos os buckets existentes precisam sair idênticos depois — o único delta aceitável é a linha nova.

---

## Alternativas consideradas e rejeitadas

1. **Script separado `check-doc-names.mjs`.** Rejeitada: duplica varredura, saída, entrada de `package.json` e passo de CI para ~15 linhas de lógica. O script atual já tem a lista de arquivos na mão.
2. **Só a regra de espaço/não-ASCII, sem o regex de kebab-case.** Tentadora — é a regra com custo medido. Rejeitada porque a segunda regra custa uma linha e a story é justamente sobre o *próximo* arquivo: `US-83-Nome_Estranho.md` passa na regra 1 e mesmo assim quebra a convenção que 62 arquivos seguem.
3. **Aplicar o gate a `docs/` inteiro, `docs/prompts/` incluída.** Rejeitada: nasceria vermelho pelos 5 arquivos de lá, que a US-81 decidiu conscientemente não arrumar. Gate que nasce vermelho é gate que alguém desliga. Daí a isenção — mas contada e com trip-wire, não silenciosa.
4. **Ligar o gate antes da US-81.** Mesmo problema, versão pior: vermelho por 4 arquivos que outra story já está resolvendo.
5. **Auto-rename ao detectar violação.** Rejeitada: renomear sem reescrever os links que apontam para o arquivo é precisamente como a US-79 nasceu. Rename com reescrita é trabalho do Obsidian (US-78), não de um linter.
6. **Regex de nome próprio para `docs/adr/` (`^[0-9]{3}-[a-z0-9-]+\.md$`).** Tentadora: os 6 arquivos passariam hoje. Rejeitada porque `docs/adr/` nunca teve convenção **escrita** — 6 arquivos seguindo o mesmo formato é amostra pequena demais para virar gate, e a numeração de ADR já é cobrada por revisão humana (número duplicado é conflito de merge visível, coisa que regex não pega). A regra 1 lá cobre o dano medido — o byte não-ASCII que some da varredura. O resto é estética. Se um `docs/adr/CONVENTIONS.md` aparecer, reabrir.
7. **Manter `docs/prompts/` como exceção silenciosa (varredura simplesmente pula a pasta).** Rejeitada: a isenção depende de uma condição — "ninguém linka aquilo" — que ninguém teria como notar quando deixasse de valer. Exceção sem sensor vira permanente por inércia, não por decisão.

---

## Questões em aberto

Nenhuma. As duas da versão anterior viraram decisão **e** implementação nesta story:

1. ~~A convenção vale para `docs/adr/` e `docs/prd.md`?~~ **Sim, a regra 1; não, a regra 2.** Ver *Decisões* → *Regra 1 vale para `docs/` inteiro* e *Alternativas* 6.
2. ~~`docs/prompts/` fica permanentemente fora, ou vira dívida registrada?~~ **Dívida registrada**, com contador visível e trip-wire que falha o gate se a pasta passar a ser linkada. Ver *Decisões* → *`docs/prompts/` é dívida registrada*.

---

## Referências no código

- `scripts/check-doc-links.mjs:46-58` — `mdFiles()`, a varredura recursiva que já produz a lista.
- `scripts/check-doc-links.mjs:73` — `const files = …`, ponto de inserção do check de nomes e origem do contador de isentos.
- `scripts/check-doc-links.mjs:95` — ramo do link que resolve; ponto de inserção do trip-wire (o alvo absoluto já está calculado ali).
- `scripts/check-doc-links.mjs:114-142` — resumo no console, `--list` e o gate; os buckets novos entram no mesmo formato de resumo, mas com bloco de `--list` próprio.
- `scripts/check-doc-links.mjs:100` — normalização `posix.join(...relative(...).split(sep))`, padrão a seguir ao imprimir caminho.
- `docs/adr/` — 6 arquivos `NNN-titulo.md`, todos já em conformidade com a regra 1; passam a ser cobrados por ela.
- `docs/prompts/` — os 5 isentos; hoje sem nenhum link relativo apontando para lá, premissa que o trip-wire passa a vigiar.
- `package.json` (raiz) — `docs:links: node scripts/check-doc-links.mjs`.
- `docs/README.md` — seção *Verificação de links*, onde a convenção precisa aparecer.
- `tools/kanban/kanban-server.js:49-50` — filtro `/^US-.*\.md$/` que exclui `US-TEMPLATE.md`; mesma exceção, mesma razão.
- **Ausência de `.github/workflows/`** — o gate só roda sozinho quando a [US-80](./US-80-ci-typecheck-testes-e-evals.md) existir.
