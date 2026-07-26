# Índice das user stories

## Todas as stories

Índice **vivo**: a tabela abaixo é gerada na hora a partir dos próprios `US-*.md`, lendo as
mesmas linhas `**Épico:**` e `**Status:**` que o quadro Kanban da
[US-31](./US-31-quadro-kanban-de-user-stories.md) lê — com os mesmos regexes
(`tools/kanban/kanban-server.js:43-44`). Não há nada mantido à mão aqui: o índice anterior
apodreceu por isso (ver [US-78](./US-78-vault-obsidian-para-os-docs.md)).

> **Só renderiza no Obsidian**, com o plugin Dataview e *JavaScript Queries* ligado.
> No GitHub aparece como bloco de código. Setup em [`docs/README.md`](../../README.md).
> Para **editar** status, use o Kanban (`tools/kanban/kanban.bat`) — esta view é leitura.

```dataviewjs
const files = dv.pages('"sdlc/01-requisitos"')
  .where(p => /^US-\d+/.test(p.file.name) && p.file.name !== "US-TEMPLATE");

const rows = [];
for (const p of files) {
  const raw = await dv.io.load(p.file.path);
  const pega = (re) => (raw.match(re) || [, ""])[1].trim();
  rows.push([
    p.file.link,
    pega(/^\*\*Épico:\*\*\s*(.+)$/m),
    pega(/^\*\*Status:\*\*\s*(.+)$/m),
  ]);
}

rows.sort((a, b) => b[0].path.localeCompare(a[0].path, undefined, { numeric: true }));
dv.table(["Story", "Épico", "Status"], rows);
```

## Critérios de aceite em aberto

Só as stories que ainda têm `- [ ]` no corpo, das que mais devem para as que menos devem.
O `**Status:**` é escrito à mão (ou pelo Kanban); os critérios são o que alguém marcou como
verificado. A coluna **Status** existe para você ler as duas coisas juntas.

> **Leia com esta ressalva.** Na primeira execução (26/07/2026) a tabela deu **44 stories** e
> **361 critérios abertos** — mas **31 dessas 44 estão `✅ Implementada` com *todos* os
> critérios desmarcados** (`21/21`, `17/17`, `15/15`…). Não é trabalho pendente: é que marcar
> a caixa nunca virou hábito. O sinal útil são as **13 restantes**, que não estão
> implementadas e têm critério aberto de verdade.
>
> Ou seja: a tabela mede hoje a **manutenção das caixas**, não o progresso. Vira medida de
> progresso no dia em que fechar uma story passar a incluir marcar os critérios.

```dataviewjs
const files = dv.pages('"sdlc/01-requisitos"')
  .where(p => /^US-\d+/.test(p.file.name) && p.file.name !== "US-TEMPLATE");

const rows = [];
for (const p of files) {
  const raw = await dv.io.load(p.file.path);
  // Só checkbox de item de lista no começo da linha: "- [ ]" / "- [x]".
  const abertos = (raw.match(/^[ \t]*- \[ \]/gm) || []).length;
  const feitos = (raw.match(/^[ \t]*- \[[xX]\]/gm) || []).length;
  if (!abertos) continue;
  const status = (raw.match(/^\*\*Status:\*\*\s*(.+)$/m) || [, ""])[1].trim();
  rows.push([p.file.link, abertos, abertos + feitos, status]);
}

rows.sort((a, b) => b[1] - a[1]);
dv.table(["Story", "Abertos", "Total", "Status"], rows);
dv.paragraph(`**${rows.length}** stories com critério em aberto · **${rows.reduce((s, r) => s + r[1], 0)}** critérios abertos no total.`);
```
