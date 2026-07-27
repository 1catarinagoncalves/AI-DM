# US-79 — Consertar links quebrados da documentação para o código-fonte

**Épico:** 0 — Infra e documentação
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** [US-78](./US-78-vault-obsidian-para-os-docs.md) — **satisfeita** (commit `720c452`). Eram irmãs de escopo independente (ela, os 16 links de alvo `.md`; esta, os 82 de profundidade), mas ela acabou entregando `scripts/check-doc-links.mjs`, a varredura que esta story ia construir. Esta agora **estende** o script existente com o modo de escrita, em vez de criar o seu. Ver *A proposta*.
**Criada em:** 2026-07-26

---

## História

> **Como** dev (ou agente) do AI DM que lê uma user story,
> **quero** que os links `](caminho)` para arquivos de código abram o arquivo certo,
> **para que** a US sirva de mapa do código em vez de mandar para caminhos que não existem.

---

## Contexto e motivação

### O problema observado

Varredura dos **83 arquivos `.md` versionados** em `docs/` encontrou **634 links relativos** (excluindo `http(s):`, `#`, `mailto:`, `tel:` e caminhos absolutos). Destes, **101 apontam para um caminho que não existe em disco**.

> **Correção de contagem (26/07/2026).** Este parágrafo dizia **79 arquivos** e **620 links** quando medido à mão. A contagem usou `git ls-tree --name-only | grep '\.md$'`, e o git **põe entre aspas** todo path com espaço ou byte não-ASCII (`core.quotePath`) — o `$` do grep deixa de casar e o arquivo some do total sem aviso. Os 4 perdidos: `US-02-inventário personagem.md`, `US-43-calibracao-peso-traços-identidade.md`, `trecho correcao dplicação e rolagem.md`, `trecho duuplicação 2.md`. Os **101 quebrados não mudaram** — os 14 links dos 4 arquivos perdidos são todos válidos. Reproduzível com `pnpm docs:links --naive` num checkout de `2ac79f6`. Mesma correção registrada na [US-78](./US-78-vault-obsidian-para-os-docs.md).

Os **82** consertáveis estão **todos** em `docs/sdlc/01-requisitos/` e **todos** com o mesmo prefixo `../../`:

```
docs/sdlc/01-requisitos/US-45-...md
  [GameView.tsx](../../apps/web/src/components/game/GameView.tsx)
```

`docs/sdlc/01-requisitos/` está **três** níveis abaixo da raiz, então `../../` resolve para `docs/apps/web/...` — que não existe. O correto é `../../../`. Provável origem: cópia de links de docs que viviam em `docs/sdlc/` (dois níveis) ou geração por analogia com outra US já errada — o erro se propagou por replicação.

### Por que a solução atual não basta

O erro é silencioso: no GitHub o link vira 404 e no editor não abre nada. Como o AGENTS.md e as USs são o principal mecanismo de contexto para agentes, link quebrado = contexto perdido.

> **Correção (27/07/2026).** Este parágrafo abria com *"Não há checagem de links no repo (nem lint de markdown, nem CI)"*. Deixou de ser verdade: a [US-78](./US-78-vault-obsidian-para-os-docs.md) entregou `scripts/check-doc-links.mjs` (`pnpm docs:links`) e a [US-80](./US-80-ci-typecheck-testes-e-evals.md) o ligou no workflow. O que continua sem dono é o **conserto**, não a detecção.

### A proposta

Um script de varredura que (1) encontra links relativos quebrados em `docs/`, (2) resolve o alvo pretendido por correspondência de sufixo de caminho a partir da raiz do repo, e (3) reescreve o link com a profundidade correta.

> **Metade já existe (27/07/2026).** Os itens (1) e (2) são `scripts/check-doc-links.mjs`, entregue pela [US-78](./US-78-vault-obsidian-para-os-docs.md) (commit `720c452`) porque os critérios de aceite das duas stories dependiam da mesma varredura. **Falta o item (3): o modo de escrita.** O script hoje é somente-leitura — 217 linhas, sem nenhuma função de reescrita.
>
> **Não existe flag `--check`.** A interface real é `pnpm docs:links` (gate, `process.exit(1)` por padrão) mais `--list`, `--naive` e `--only-md`. O nome `--check` só existiu nesta proposta e nos critérios de aceite abaixo, ambos escritos antes de o script nascer; foram corrigidos. Quando esta story adicionar a escrita, ela ganha uma flag nova (`--fix` ou equivalente) — **o padrão continua sendo checar, nunca reescrever**, senão o passo de CI da US-80 passa a editar arquivos sozinho.
>
> **Baseline de hoje** (27/07/2026, `main` com a US-78 e a US-82 aplicadas): 92 `.md`, 722 links relativos, **85 quebrados** = 82 de profundidade + 3 de alvo inexistente. Os 16 de `.md` que constavam da baseline original estão em zero.
>
> **Ampliada no mesmo dia para os três `.md` da raiz** (`AGENTS.md`, `CLAUDE.md`, `README.md`): 95 `.md`, 743 links, **os mesmos 85 quebrados** — a raiz não trouxe nenhum. O total de links sobe a cada edição de doc (as próprias linhas desta atualização contam); o contrato são os **buckets**, não ele. Ver *Questões em aberto* #3.
>
> **Fechada em 27/07/2026.** O item (3) virou a flag `--fix`: 82 links reescritos numa passada, 10 arquivos tocados, `git diff --numstat` `N N` em todos — troca no lugar, zero reformatação. Os 3 de alvo inexistente saíram à mão (ver a nota na tabela dos 19). `pnpm docs:links` sai `OK` com **0 quebrados** nos quatro buckets, e o passo do CI apertou para o gate completo.

---

## Escopo

### Dentro do escopo

- Varrer todo `.md` sob `docs/` na forma markdown `](caminho)`, ignorando `http:`, `https:`, `#`, `mailto:`, `tel:` e caminhos absolutos.
- **Ignorar o que está dentro de bloco cercado (` ``` `, `~~~`) ou de code span (crase).** Ali o `](caminho)` é exemplo escrito *sobre* links, não um link — não é renderizado como link pelo GitHub nem pelo Obsidian, e reescrevê-lo corrompe a documentação.
- Para cada link quebrado, resolver por sufixo de caminho a partir da raiz (ignorando `node_modules/`, `.git/`, `dist/`, `.next/`, `src/generated/`).
- Reescrever com o caminho relativo correto **apenas quando a resolução for única**.
- Deixar intocado e **reportar** qualquer caso ambíguo (>1 candidato) ou sem candidato.
- Relatório antes/depois com contagem de quebrados.

### Fora do escopo

- **Os 19 links de alvo inexistente** (lista abaixo). É problema de *rename*, não de profundidade — o alvo não existe em lugar nenhum, então resolver por sufixo não acha candidato. Divisão:
  - **16 apontam para `.md`** → [US-78](./US-78-vault-obsidian-para-os-docs.md), que abre `docs/` como vault Obsidian e conserta esses alvos com autocomplete, impedindo a reincidência via atualização automática de link no rename.
  - **3 apontam para código** (`ingest.ts` → provavelmente `ingest.mjs`; `session.ts` → alvo desconhecido) → ~~continuam sem dono, exigem decisão humana caso a caso~~ **resolvidos à mão em 27/07/2026** porque o gate completo os conta e o aperto do CI é critério de aceite daqui. Continuam fora do `--fix`: decisão humana, não automação. Ver a nota na tabela.
- Links `http(s)` mortos (link rot externo) — outro problema, outra ferramenta.
- Adicionar lint de markdown. ~~ou hook de CI~~ — o passo de CI já existe: a [US-80](./US-80-ci-typecheck-testes-e-evals.md) roda `pnpm docs:links` no workflow. Ver *Questões em aberto* #1.
- **A varredura em si** (detecção, resolução por sufixo, máscara de código, gate). Entregue pela [US-78](./US-78-vault-obsidian-para-os-docs.md). Esta story consome o script existente e acrescenta o modo de escrita — não reimplementa nem cria um segundo script.
- ~~Arquivos `.md` fora de `docs/` (`AGENTS.md`, `CLAUDE.md`, `README`)~~ — **entraram na varredura em 27/07/2026** (ver *Questões em aberto* #3). A ressalva original ("ampliar só se a varredura de verificação acusar") foi resolvida na direção oposta: não acusaram nada, mas passam a ser cobertos para não voltarem a divergir sem aviso. **`docs/adr/` nunca esteve fora**: está *dentro* de `docs/`, logo já era varrido.
- `.md` de dentro de `apps/`, `packages/`, `scripts/` e afins. A raiz entra por **lista explícita de três nomes**, não por glob — o gate de nome da US-82 reprovaria rascunho solto na raiz, e um `README` de pacote não é documentação de projeto.

---

## Os 19 links fora do escopo (alvo inexistente)

As linhas de `.md` desta tabela eram o escopo da [US-78](./US-78-vault-obsidian-para-os-docs.md); as de código (`ingest.ts`, `session.ts`) seguem sem dono.

> **A US-78 rodou em 26/07/2026 e fechou todas as linhas `.md` desta tabela.** Ficam registradas por dois motivos: são a explicação de por que a contagem da US-79 caiu, e a tabela é a prova de que os dois escopos não se sobrepunham. **Nada aqui precisa ser refeito** — `pnpm docs:links --only-md` sai 0. O que resta para esta story são as **3 linhas de código**, marcadas `pendente`.

| Arquivo | Link | Nota | |
|---|---|---|---|
| US-22, US-26 (×5), US-29, US-31 | `./user-stories.md` | Índice antigo, não existe mais. | ✅ US-78: índice recriado como bloco Dataview; 7 dos 8 links repontados para a story real ou `(#)`, porque o texto deles nomeava uma story específica |
| US-41 (×3) | `./US-45-background-visivel-na-ficha.md` | Renomeada para `US-45-background-na-ficha-da-interface.md`. | ✅ US-78 |
| US-72 | `./US-29-saneamento-de-rolagens.md` | Renomeada para `US-29-saneamento-de-rolagens-ficticias.md`. | ✅ US-78 (também na US-77, que apontava para o mesmo alvo morto) |
| US-72 | `./US-36-eval-qualidade-narracao.md` | Arquivo não existe com esse nome. | ✅ US-78 → `US-36-eval-de-qualidade-da-narracao.md` (idem US-77) |
| US-73, US-75 | `./US-67-edicao-de-turno.md` | Renomeada para `US-67-editar-acao-enviada-ao-dm.md`. | ✅ US-78 |
| US-17 | `../../../evals/reports/2026-07-10.md` | Relatório nunca commitado; `evals/reports/` só tem datas de 2026-07-16 em diante. | ✅ US-78: virou code span sem link — é artefato gerado e gitignored, não existe alvo para apontar |
| US-51, US-52 | `../../../scripts/srd/ingest.ts` | O arquivo real é `ingest.mjs` (extensão errada, não profundidade). | ✅ US-79 → `ingest.mjs`, texto do link junto |
| US-61 | `../../apps/web/src/lib/session.ts` | Não existe; `apps/web/src/lib/` tem `api.ts` e `server-auth.ts`. | ✅ US-79: virou code span sem link — `git log` mostra que o alvo foi apagado pelo commit `c78d724`, a implementação da própria US-61 |

> Casos como `ingest.ts`→`ingest.mjs` e `session.ts`→? **parecem** consertáveis, mas exigem decisão humana sobre qual arquivo o autor quis citar. Por isso caem no bucket "reportar, não reescrever".

> **Os 3 foram resolvidos à mão em 27/07/2026, e continuam fora do `--fix`.** A distinção da linha acima segue de pé: nada disso é automatizável, e o script não tocou em nenhum deles. Mas o critério de apertar o gate do CI tornou o "sem dono" insustentável — `pnpm docs:links` conta esses 3 e sairia vermelho para sempre. Duas naturezas diferentes, dois desfechos:
>
> - **`ingest.ts` → `ingest.mjs`** (US-51, US-52): verificado em disco. Trocado no destino **e no texto** do link — texto de link que mente é a mesma falha do índice órfão que a US-78 recusou consertar por resolução cega.
> - **`session.ts`** (US-61): não é rename, é **arquivo apagado**. `git show --stat c78d724` mostra `apps/web/src/lib/session.ts | 28 ----` no commit que implementou a própria US-61 — o parágrafo descreve o mundo *antes* do login, e o login matou o arquivo. Não existe alvo, hoje nem depois. Virou code span, mesmo tratamento que a US-78 deu ao relatório de eval gitignored.
>
> Se a lista tivesse um caso genuinamente indecidível, o certo seria deixá-lo quebrado e manter o CI em `--only-md` — gate verde comprado com link mentiroso é pior que gate vermelho.

---

## Nota: links com sufixo `:linha`

6 links em `US-54` usam a convenção clicável do Claude Code, ex.:

```
[ingest.mjs:122](../../../scripts/srd/ingest.mjs:122)
```

O caminho **sem** o `:122` existe. Decidir na implementação: o script deve **tirar o sufixo `:NN` antes de testar existência** (tratando-os como válidos — é o padrão do repo e o CLAUDE.md incentiva `file:line`). Contados como quebrados numa varredura ingênua, sobem o total de 101 para 107.

---

## Critérios de aceite

> **Os quatro primeiros já estavam satisfeitos pela [US-78](./US-78-vault-obsidian-para-os-docs.md) quando esta story foi reavaliada em 27/07/2026** — ela construiu a varredura para poder provar os próprios números. Ficam marcados, com a evidência, porque continuam sendo contrato: quem mexer no script não pode quebrá-los. O trabalho que resta a esta story começa no critério do **modo de escrita**.

- [x] Existe um script de varredura que reporta: total de links relativos, quebrados, auto-consertáveis, ambíguos e sem candidato. *(`scripts/check-doc-links.mjs`, `pnpm docs:links`. A saída separa os buckets por story dona.)*
- [x] O script trata sufixo `:NN` como não-quebrado (ver nota acima). *(`--naive` existe justamente para exibir a contagem alternativa que os conta.)*
- [x] O script ignora `](caminho)` dentro de bloco cercado e de code span. **Teste de regressão obrigatório: rodar o script sobre esta própria US não reporta nem reescreve nada.** Ela contém 5 ocorrências em exemplos, uma delas (`../../apps/web/src/components/game/GameView.tsx`, bloco da seção *O problema observado*) sintaticamente idêntica ao bug que a story conserta. *(27/07/2026: `pnpm docs:links --list` não lista nenhuma linha deste arquivo — os únicos hits de "US-79" na saída são os rótulos de bucket. Depois do `--fix`, o "nem reescreve" também está verificado: o exemplo `../../apps/web/src/components/game/GameView.tsx` do bloco cercado não aparece no `git diff` deste arquivo, enquanto os 82 links de verdade foram reescritos na mesma passada.)*
- [x] Rodar o gate num `.md` com link `../../apps/...` sabidamente errado retorna exit code ≠ 0 e nomeia o arquivo. *(É o comportamento padrão hoje: exit 1 com os 82; `--list` nomeia arquivo e linha.)*
- [x] **O script ganha um modo de escrita** (flag explícita, ex. `--fix`). Sem a flag o comportamento não muda: checa e sai, nunca edita. É o que impede o passo de CI da [US-80](./US-80-ci-typecheck-testes-e-evals.md) de reescrever arquivos sozinho. *(`--fix`. Sem a flag, `writeFileSync` nem é alcançado: o `canWrite` que alimenta a lista de `edits` já testa `has("--fix")`. Coberto pelo teste "sem --fix o script não escreve nada".)*
- [x] Após rodar: **0 links quebrados por profundidade errada** em `docs/`. **Invariante, independente da ordem em relação à [US-78](./US-78-vault-obsidian-para-os-docs.md):** nenhum quebrado restante tem candidato único por sufixo de caminho. Quebrados de alvo inexistente não contam aqui. (Para conferência: se a US-78 ainda não rodou, restam 19 quebrados no total; se já rodou, restam 3.) *(82 reescritos numa passada; o bucket `depth` foi a 0. Os 3 de alvo inexistente também caíram — ver o critério novo abaixo.)*
- [x] Nenhum link ambíguo foi reescrito; a lista de não-consertados sai no relatório. *(Por construção: só o bucket `depth` gera `edits`; `ambig` nunca chega lá. Vazio nesta execução — 0 ambíguos, como a nota de implementação previa ao resolver por sufixo do caminho inteiro.)*
- [x] Nenhum arquivo fora de `docs/` **e dos três de `ROOT_MD`** (`AGENTS.md`, `CLAUDE.md`, `README.md`) foi modificado; nenhum código de produção tocado. *(A fronteira era só `docs/` até 27/07/2026, quando a raiz entrou na varredura — ver Questões em aberto #3. Quem varre, conserta.)* *(Guard `isWritable()`, com teste próprio que aponta o `--fix` a um `.md` sob `packages/shared/` e exige que o arquivo saia intacto.)*
- [x] **Teste de regressão do modo de escrita:** rodar `--fix` sobre um `.md` de fixture com um link `../../apps/...` sabidamente errado reescreve **só** aquele link — `git diff --numstat` do fixture mostra `1 1`. Nenhuma reformatação de corpo, nenhum EOL alterado. *(`scripts/check-doc-links.test.mjs`, `pnpm docs:links:test`, 3 testes. Compara o corpo inteiro em vez do numstat: prova a mesma coisa e ainda cobre as cópias no fence e no code span, que têm de continuar `../../`. Fixture em CRLF de propósito. No repo real, `git diff --numstat` saiu `N N` em todos os 10 arquivos tocados.)*
- [x] **O gate do CI aperta junto:** com os 82 consertados, o passo da [US-80](./US-80-ci-typecheck-testes-e-evals.md) passa de `pnpm docs:links --only-md` para `pnpm docs:links` (gate completo). É o critério que fecha a *Questão em aberto #3* daquela story. *(Feito, mais um passo `pnpm docs:links:test` — teste de regressão que ninguém roda é teste morto, e o `pnpm test` da raiz é recursivo pelos workspaces e não alcança `scripts/`.)*
- [x] **Os 3 links de código de alvo inexistente foram resolvidos.** Estavam *fora do escopo* por exigirem decisão humana, mas o gate completo os conta — sem resolvê-los, o critério acima era inalcançável. Ver *Os 19 links fora do escopo*.

---

## Notas de implementação

- Baseline medida em 2026-07-26 (`git` em `main`, commit `2ac79f6`): 83 `.md`, 634 links relativos, **101** quebrados = **82** com prefixo `../../` em `docs/sdlc/01-requisitos/` + **19** sem alvo. Zero ambíguos. *(Os totais de arquivo/link foram corrigidos de `79`/`620` — ver a correção de contagem no Contexto. O `pnpm docs:links` varre o **disco**, não `git ls-files`, justamente para não repetir esse bug.)*
- A varredura deve rodar sobre arquivos versionados. Incluir os untracked mistura links de exemplo (`](caminho)`, `./US-XX-....md`) em US ainda não commitadas e infla o total de quebrados.
- O conserto real é mecânico: nesses 82, `../../` → `../../../`. Ainda assim, **resolver por sufixo de caminho** em vez de aplicar sed cego — o sed não detecta o caso em que o arquivo também foi movido.
- Resolver por sufixo do **caminho inteiro**, não por `basename`. `basename` sozinho dá 4 candidatos para `page.tsx` (App Router); com o sufixo completo `apps/web/src/app/play/[adventureId]/page.tsx` a resolução é única. Com sufixo completo os casos ambíguos vão a **zero**.
- Cuidado com colchetes em rotas dinâmicas (`[adventureId]`) — não tratar o caminho como glob/regex.
- **Máscara de código, medida em 26/07/2026:** nos 83 `.md` versionados há **0** ocorrências de `](caminho)` dentro de código — a baseline de 634/101 não muda com a máscara. Incluindo as 3 US novas ainda untracked (77, 78, 79), aparecem **8 falsos positivos, 5 deles nesta própria US**. Ou seja: a máscara não altera o conserto de hoje, mas sem ela o script se auto-sabota assim que alguém documenta o problema que ele resolve.
- Implementar a máscara **preservando o comprimento** do texto (trocar o trecho por espaços, não removê-lo), para que os offsets das ocorrências continuem válidos na hora de reescrever o arquivo. Ordem: primeiro os blocos cercados, depois os code spans — um bloco cercado pode conter crases soltas que quebrariam a varredura inversa.
- Regex de code span tem que casar a cerca por comprimento (`` ` `` vs ` `` `): usar backreference ao delimitador de abertura, senão um `` `código com ` dentro` `` fecha no lugar errado.
- ~~Script pode viver em `scripts/`~~ — **já vive**: `scripts/check-doc-links.mjs`, Node `.mjs` sem dependência, no padrão de `scripts/srd/*.mjs`, como esta nota previa. As notas de máscara acima descrevem código que **já existe**; ficam registradas porque explicam o PORQUÊ de o script ser assim, e quem for acrescentar o modo de escrita precisa delas — em especial a de preservar o comprimento do texto na máscara, que existe exatamente para os offsets continuarem válidos na hora de reescrever.
- O modo de escrita reaproveita o que a varredura já calcula: `depthCandidates()` (`check-doc-links.mjs:65`) já devolve o candidato único que viraria a substituição. Falta aplicar, não descobrir. *(Foi isso mesmo: o `--fix` não descobriu nada novo, só passou a aplicar.)*

### O que o `--fix` acabou exigindo (27/07/2026)

- **A máscara preserva comprimento, mas não em toda linha.** A nota acima previu metade do problema. `stripCode()` troca code span por espaços do mesmo tamanho (offset intacto), mas troca a **linha de fence inteira por `""`** — ali o comprimento *não* se preserva. Por isso o offset de cada linha é calculado sobre as linhas **originais**, não sobre as mascaradas: a máscara decide *o que é link*, quem localiza no arquivo é o array de offsets. Trocar um pelo outro corrompe todo arquivo que tenha um bloco cercado antes do primeiro link — que é quase todo `.md` deste repo.
- **Substituir de trás para frente.** Reescrever o link *n* muda o comprimento do arquivo e invalida o offset de *n+1*. Aplicar as substituições em ordem decrescente evita recalcular.
- **EOL sobrevive porque o arquivo nunca é remontado.** Só o trecho do destino é fatiado do conteúdo original; corpo, indentação e CRLF ficam byte a byte. Um `lines.join("\n")` no fim teria convertido silenciosamente todo `.md` CRLF do repo — diff de 700 linhas escondendo a mudança de 82.
- **Sufixo `:NN` e âncora `#secao` voltam ao fim do destino reescrito.** São exatamente as duas partes que a varredura tira antes de testar existência; se não voltarem, o `--fix` conserta a profundidade e apaga a linha citada.
- **Argumento posicional (`... --fix docs/foo.md`)** existe para o teste de regressão: sem ele, rodar o `--fix` num teste reescreveria os 743 links do repo em vez do arquivo de mentira. `depthCandidates()` só aceita candidato sob a raiz, então a fixture tem de nascer dentro do repo — daí o `try/finally` que a apaga.
- **A fronteira de escrita é um guard próprio (`isWritable()`)**, não um efeito colateral de qual arquivo foi varrido: com o posicional, dá para apontar o `--fix` a um `.md` de `packages/`. Varre e reporta; escrever, não.

---

## Questões em aberto

1. ~~O script vira etapa de CI/pre-commit ou é one-shot?~~ **Resolvida em 27/07/2026: etapa de CI.** A [US-80](./US-80-ci-typecheck-testes-e-evals.md) roda ~~`pnpm docs:links --only-md`~~ **`pnpm docs:links`** no workflow, em todo push e PR — o gate apertou no fecho desta story, junto com um passo `pnpm docs:links:test`. Sem `--fix` no CI, de propósito: gate que edita arquivo sozinho não é gate, e o `--fix` deixaria o build verde reescrevendo a doc sem ninguém revisar a substituição.

   A intuição registrada aqui se confirmou nas três camadas, e cada uma pega o que a outra não pega: o vault Obsidian ([US-78](./US-78-vault-obsidian-para-os-docs.md)) previne o link quebrado *na escrita*; o gate de CI pega quem editar fora do Obsidian; o gate de nome de arquivo ([US-82](./US-82-gate-de-convencao-de-nomes-de-arquivo-nos-docs.md)) pega o arquivo mal nomeado a que ninguém aponta — o caso que nenhum checador de link vê. Nada de pre-commit: mesma razão que a US-80 registrou para o `pre-push`, é pulável com `--no-verify` e depende de configuração por máquina.
2. ~~Vale uma US irmã para os 19 links de rename?~~ **Resolvido:** os 16 de `.md` são a [US-78](./US-78-vault-obsidian-para-os-docs.md). ~~Restam os 3 de código (`ingest.ts` ×2, `session.ts`) — consertar caso a caso quando alguém encostar no arquivo, ou abrir uma US mínima se incomodarem.~~ **Os 3 saíram aqui mesmo, em 27/07/2026, sem US nova**: apertar o gate do CI é critério de aceite desta story e o gate completo conta esses 3. "Quando alguém encostar no arquivo" não é plano quando o CI fica vermelho até lá. Ver a nota na tabela dos 19.
3. ~~Ampliar a varredura para `AGENTS.md` / `README` / `docs/adr/`?~~ **`docs/adr/` já está dentro dela desde a US-78** (verificado em 27/07/2026): `mdFiles()` (`scripts/check-doc-links.mjs:50`) desce recursivo em tudo sob `docs/`, e os 6 ADRs entram nos 92 arquivos da baseline. Prova: um `.md` de fixture com `[x](../apps/web/src/lib/api.ts)` criado em `docs/adr/` sai listado no bucket `depth` (`docs/adr/zz-fixture-temp.md:1 ... -> apps/web/src/lib/api.ts`); removido depois.

   Os ADRs saem com **0 quebrados** por um motivo estrutural, não por sorte: `docs/adr/` está **dois** níveis abaixo da raiz, então o `../../apps/...` que eles usam resolve certo — é o mesmo prefixo que, copiado para `docs/sdlc/01-requisitos/` (três níveis), virou os 82 desta story. Reforça a nota de implementação de resolver por sufixo em vez de `sed ../../ → ../../../`: o sed consertaria as USs e quebraria os ADRs.

   **Os três da raiz também entraram, em 27/07/2026** (`AGENTS.md`, `CLAUDE.md`, `README.md`). Antes a varredura tinha `DOCS` como raiz fixa; agora `files` soma `docs/` recursivo + a constante `ROOT_MD` (`scripts/check-doc-links.mjs:27`). **Lista explícita, não glob de `*.md` na raiz**: o glob varreria qualquer rascunho solto ali, e o gate de nome da US-82 (espaço/byte não-ASCII) reprovaria um arquivo que nunca foi documentação — CI vermelho por causa de bloco de notas. O resto do repo (`apps/`, `packages/`, `scripts/`) segue fora: `README` de pacote é outra coisa.

   Custo real: **0 quebrados**. A baseline foi de 92 para 95 `.md` e ganhou 3 links (os `docs/` que os três da raiz já citavam, todos válidos); os buckets não mudaram (82 depth + 3 code) e `--only-md` continua saindo `OK`, então o passo de CI da [US-80](./US-80-ci-typecheck-testes-e-evals.md) não quebra com a ampliação. Prova de que a raiz é de fato varrida (fixture temporária, revertida com `git checkout --`): um link `./apps/web/src/lib/naoexiste-fixture.ts` acrescentado ao `README.md` sai listado como `README.md:90` no bucket `code`.

   > **Cuidado ao implementar o `--fix`:** o critério de aceite abaixo dizia "nenhum arquivo fora de `docs/` foi modificado". Com a raiz varrida, a fronteira do modo de escrita passa a ser **`docs/` + os três nomes de `ROOT_MD`** — foi corrigido lá. Continua valendo que nenhum código de produção é tocado.

---

## Referências no código

- [scripts/check-doc-links.mjs](../../../scripts/check-doc-links.mjs) — a varredura (US-78) mais o modo de escrita desta story: `isWritable`, o array de offsets por linha e a aplicação reversa das substituições.
- [scripts/check-doc-links.test.mjs](../../../scripts/check-doc-links.test.mjs) — regressão do `--fix` em `node:test`, sem dependência. `pnpm docs:links:test`.
- [.github/workflows/ci.yml](../../../.github/workflows/ci.yml) — passos *Gate de docs* (apertado para `pnpm docs:links`) e *Teste do gate de docs*.
- [docs/README.md](../../README.md) — documentação do `--fix` e do que ele recusa reescrever.
- `docs/sdlc/01-requisitos/US-45-background-na-ficha-da-interface.md` — exemplo típico do bug (`../../apps/web/...`); 4 links reescritos aqui.
- `docs/sdlc/01-requisitos/US-54-chaves-canonicas-em-ingles.md` — caso do sufixo `:linha`.
- `scripts/srd/sync.mjs` — padrão de script `.mjs` standalone já usado no repo.
- `CLAUDE.md` — convenção de referenciar código como `file_path:line_number`.
