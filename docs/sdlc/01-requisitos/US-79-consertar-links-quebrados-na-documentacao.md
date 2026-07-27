# US-79 — Consertar links quebrados da documentação para o código-fonte

**Épico:** 0 — Infra e documentação
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
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
  - **3 apontam para código** (`ingest.ts` → provavelmente `ingest.mjs`; `session.ts` → alvo desconhecido) → continuam sem dono, exigem decisão humana caso a caso. Ver *Questões em aberto*.
- Links `http(s)` mortos (link rot externo) — outro problema, outra ferramenta.
- Adicionar lint de markdown. ~~ou hook de CI~~ — o passo de CI já existe: a [US-80](./US-80-ci-typecheck-testes-e-evals.md) roda `pnpm docs:links --only-md` no workflow. Ver *Questões em aberto* #1.
- **A varredura em si** (detecção, resolução por sufixo, máscara de código, gate). Entregue pela [US-78](./US-78-vault-obsidian-para-os-docs.md). Esta story consome o script existente e acrescenta o modo de escrita — não reimplementa nem cria um segundo script.
- Arquivos `.md` fora de `docs/` (`AGENTS.md`, `CLAUDE.md`, `README`) — a varredura atual mostra que o problema está concentrado em `docs/sdlc/01-requisitos/`; ampliar só se a varredura de verificação acusar.

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
| US-51, US-52 | `../../../scripts/srd/ingest.ts` | O arquivo real é `ingest.mjs` (extensão errada, não profundidade). | ⏳ pendente |
| US-61 | `../../apps/web/src/lib/session.ts` | Não existe; `apps/web/src/lib/` tem `api.ts` e `server-auth.ts`. | ⏳ pendente |

> Casos como `ingest.ts`→`ingest.mjs` e `session.ts`→? **parecem** consertáveis, mas exigem decisão humana sobre qual arquivo o autor quis citar. Por isso caem no bucket "reportar, não reescrever".

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
- [x] O script ignora `](caminho)` dentro de bloco cercado e de code span. **Teste de regressão obrigatório: rodar o script sobre esta própria US não reporta nem reescreve nada.** Ela contém 5 ocorrências em exemplos, uma delas (`../../apps/web/src/components/game/GameView.tsx`, bloco da seção *O problema observado*) sintaticamente idêntica ao bug que a story conserta. *(27/07/2026: `pnpm docs:links --list` não lista nenhuma linha deste arquivo — os únicos hits de "US-79" na saída são os rótulos de bucket.)*
- [x] Rodar o gate num `.md` com link `../../apps/...` sabidamente errado retorna exit code ≠ 0 e nomeia o arquivo. *(É o comportamento padrão hoje: exit 1 com os 82; `--list` nomeia arquivo e linha.)*
- [ ] **O script ganha um modo de escrita** (flag explícita, ex. `--fix`). Sem a flag o comportamento não muda: checa e sai, nunca edita. É o que impede o passo de CI da [US-80](./US-80-ci-typecheck-testes-e-evals.md) de reescrever arquivos sozinho.
- [ ] Após rodar: **0 links quebrados por profundidade errada** em `docs/`. **Invariante, independente da ordem em relação à [US-78](./US-78-vault-obsidian-para-os-docs.md):** nenhum quebrado restante tem candidato único por sufixo de caminho. Quebrados de alvo inexistente não contam aqui. (Para conferência: se a US-78 ainda não rodou, restam 19 quebrados no total; se já rodou, restam 3.)
- [ ] Nenhum link ambíguo foi reescrito; a lista de não-consertados sai no relatório.
- [ ] Nenhum arquivo fora de `docs/` foi modificado; nenhum código de produção tocado.
- [ ] **Teste de regressão do modo de escrita:** rodar `--fix` sobre um `.md` de fixture com um link `../../apps/...` sabidamente errado reescreve **só** aquele link — `git diff --numstat` do fixture mostra `1 1`. Nenhuma reformatação de corpo, nenhum EOL alterado.
- [ ] **O gate do CI aperta junto:** com os 82 consertados, o passo da [US-80](./US-80-ci-typecheck-testes-e-evals.md) passa de `pnpm docs:links --only-md` para `pnpm docs:links` (gate completo). É o critério que fecha a *Questão em aberto #3* daquela story.

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
- O modo de escrita reaproveita o que a varredura já calcula: `depthCandidates()` (`check-doc-links.mjs:65`) já devolve o candidato único que viraria a substituição. Falta aplicar, não descobrir.

---

## Questões em aberto

1. ~~O script vira etapa de CI/pre-commit ou é one-shot?~~ **Resolvida em 27/07/2026: etapa de CI.** A [US-80](./US-80-ci-typecheck-testes-e-evals.md) roda `pnpm docs:links --only-md` no workflow, em todo push e PR. É `--only-md` porque o gate completo ainda conta os 82 quebrados **desta** story — o aperto para o gate completo é critério de aceite daqui.

   A intuição registrada aqui se confirmou nas três camadas, e cada uma pega o que a outra não pega: o vault Obsidian ([US-78](./US-78-vault-obsidian-para-os-docs.md)) previne o link quebrado *na escrita*; o gate de CI pega quem editar fora do Obsidian; o gate de nome de arquivo ([US-82](./US-82-gate-de-convencao-de-nomes-de-arquivo-nos-docs.md)) pega o arquivo mal nomeado a que ninguém aponta — o caso que nenhum checador de link vê. Nada de pre-commit: mesma razão que a US-80 registrou para o `pre-push`, é pulável com `--no-verify` e depende de configuração por máquina.
2. ~~Vale uma US irmã para os 19 links de rename?~~ **Resolvido:** os 16 de `.md` são a [US-78](./US-78-vault-obsidian-para-os-docs.md). Restam os 3 de código (`ingest.ts` ×2, `session.ts`) — consertar caso a caso quando alguém encostar no arquivo, ou abrir uma US mínima se incomodarem.
3. Ampliar a varredura para `AGENTS.md` / `README` / `docs/adr/`? (A baseline não acusou quebras lá, mas o CI checaria de graça.)

---

## Referências no código

- `docs/sdlc/01-requisitos/US-45-background-na-ficha-da-interface.md` — exemplo típico do bug (`../../apps/web/...`).
- `docs/sdlc/01-requisitos/US-54-chaves-canonicas-em-ingles.md` — caso do sufixo `:linha`.
- `scripts/srd/sync.mjs` — padrão de script `.mjs` standalone já usado no repo.
- `CLAUDE.md` — convenção de referenciar código como `file_path:line_number`.
