# US-79 — Consertar links quebrados da documentação para o código-fonte

**Épico:** 0 — Infra e documentação
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** nenhuma. Irmã da [US-78](./US-78-vault-obsidian-para-os-docs.md), que cobre a outra metade dos links quebrados (os 16 de alvo `.md`). Podem ser feitas em qualquer ordem.
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

Não há checagem de links no repo (nem lint de markdown, nem CI). O erro é silencioso: no GitHub o link vira 404 e no editor não abre nada. Como o AGENTS.md e as USs são o principal mecanismo de contexto para agentes, link quebrado = contexto perdido.

### A proposta

Um script de varredura que (1) encontra links relativos quebrados em `docs/`, (2) resolve o alvo pretendido por correspondência de sufixo de caminho a partir da raiz do repo, e (3) reescreve o link com a profundidade correta. O mesmo script roda em modo `--check` para verificação antes/depois.

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
- Adicionar lint de markdown ou hook de CI. Vale considerar depois; ver "Questões em aberto".
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

- [ ] Existe um script de varredura (`--check` e modo de escrita) que reporta: total de links relativos, quebrados, auto-consertáveis, ambíguos e sem candidato.
- [ ] O script trata sufixo `:NN` como não-quebrado (ver nota acima).
- [ ] O script ignora `](caminho)` dentro de bloco cercado e de code span. **Teste de regressão obrigatório: rodar o script sobre esta própria US não reporta nem reescreve nada.** Ela contém 5 ocorrências em exemplos, uma delas (`../../apps/web/src/components/game/GameView.tsx`, bloco da seção *O problema observado*) sintaticamente idêntica ao bug que a story conserta.
- [ ] Após rodar: **0 links quebrados por profundidade errada** em `docs/`. **Invariante, independente da ordem em relação à [US-78](./US-78-vault-obsidian-para-os-docs.md):** nenhum quebrado restante tem candidato único por sufixo de caminho. Quebrados de alvo inexistente não contam aqui. (Para conferência: se a US-78 ainda não rodou, restam 19 quebrados no total; se já rodou, restam 3.)
- [ ] Nenhum link ambíguo foi reescrito; a lista de não-consertados sai no relatório.
- [ ] Nenhum arquivo fora de `docs/` foi modificado; nenhum código de produção tocado.
- [ ] **Teste de regressão:** rodar o script em modo `--check` num arquivo `.md` de fixture com um link `../../apps/...` sabidamente errado retorna exit code ≠ 0 e nomeia o arquivo.

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
- Script pode viver em `scripts/` (Node `.mjs`, sem dependência nova — `node:fs`/`node:path` bastam), no padrão de `scripts/srd/*.mjs`.

---

## Questões em aberto

1. O script vira etapa de CI/pre-commit ou é one-shot? One-shot conserta hoje mas o erro volta na próxima US escrita por analogia. Um `--check` barato no CI é o que impede a reincidência.
   > **A mesma pergunta está aberta na [US-78](./US-78-vault-obsidian-para-os-docs.md) (questão 3).** Decidir uma vez, nas duas: o vault Obsidian previne o link quebrado *na escrita* (autocomplete + rename), o `--check` no CI pega quem editar fora do Obsidian. São camadas complementares, não alternativas.
2. ~~Vale uma US irmã para os 19 links de rename?~~ **Resolvido:** os 16 de `.md` são a [US-78](./US-78-vault-obsidian-para-os-docs.md). Restam os 3 de código (`ingest.ts` ×2, `session.ts`) — consertar caso a caso quando alguém encostar no arquivo, ou abrir uma US mínima se incomodarem.
3. Ampliar a varredura para `AGENTS.md` / `README` / `docs/adr/`? (A baseline não acusou quebras lá, mas o CI checaria de graça.)

---

## Referências no código

- `docs/sdlc/01-requisitos/US-45-background-na-ficha-da-interface.md` — exemplo típico do bug (`../../apps/web/...`).
- `docs/sdlc/01-requisitos/US-54-chaves-canonicas-em-ingles.md` — caso do sufixo `:linha`.
- `scripts/srd/sync.mjs` — padrão de script `.mjs` standalone já usado no repo.
- `CLAUDE.md` — convenção de referenciar código como `file_path:line_number`.
