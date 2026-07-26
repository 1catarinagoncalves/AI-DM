# `docs/` — vault Obsidian do AI DM

Esta pasta é um **vault do Obsidian** ([US-78](./sdlc/01-requisitos/US-78-vault-obsidian-para-os-docs.md)).
Funciona normalmente como markdown no GitHub; abrir no Obsidian só acrescenta backlinks,
grafo, autocomplete de link e **reescrita automática dos links ao renomear um arquivo**.

O vault é `docs/`, **não a raiz do repo** — a raiz tem centenas de `.md` dentro de
`node_modules/` e o Obsidian não tem ignore de verdade. Consequência: `CLAUDE.md` e
`AGENTS.md` ficam fora do grafo, de propósito.

## Setup numa máquina nova

1. **Instalar o app:**

   ```bash
   winget install --exact --id Obsidian.Obsidian --accept-package-agreements --accept-source-agreements
   ```

   Instala por usuário em `%LOCALAPPDATA%\Programs\Obsidian\` — sem UAC.

2. **Abrir `docs/` como vault:** *Open folder as vault* → selecionar a pasta `docs` do repo.

3. **Ligar plugins de comunidade:** se o Obsidian abrir em *Restricted Mode*,
   **Settings → Community plugins → Turn on community plugins**. Um clique, uma vez por vault.
   É um diálogo de confiança sobre rodar código de terceiro — por isso não é automatizado.

4. **Instalar o Dataview** (Settings → Community plugins → Browse → `Dataview`).
   O código do plugin é **gitignored** (`docs/.obsidian/plugins/`), então não vem no clone.

5. **Ligar JavaScript Queries:** Settings → Dataview → *Enable JavaScript Queries*.
   Sem isso o índice em [`sdlc/01-requisitos/user-stories.md`](./sdlc/01-requisitos/user-stories.md)
   renderiza como bloco de código cru em vez de tabela.
   *(Equivalente por arquivo: `enableDataviewJs: true` em
   `docs/.obsidian/plugins/dataview/data.json`, com o Obsidian **fechado**.)*

O que **é** versionado: `app.json` (formato de link), `core-plugins.json`,
`community-plugins.json`. O que não é: `workspace.json` (estado de UI) e `plugins/`
(código de terceiro).

## Regra dos dois escritores — Kanban × Obsidian

O quadro Kanban ([US-31](./sdlc/01-requisitos/US-31-quadro-kanban-de-user-stories.md))
reescreve a linha `**Status:**` dos mesmos `US-*.md` que o Obsidian edita, e faz
read-modify-write sem lock (`tools/kanban/kanban-server.js:87-91`).

> **Não arraste um card enquanto o mesmo `.md` está aberto com edição não salva no Obsidian.**
> O buffer do Obsidian pode sobrescrever a linha recém-gravada pelo Kanban.

Na prática o Obsidian recarrega mudança externa e converge — a regra é barata e evita o caso ruim.

Divisão: **o Kanban escreve status** (arraste), **o índice Dataview só lê**.

## Convenção de nome de arquivo

`US-NN[a]-titulo-em-kebab-case-ascii.md` — minúsculas, sem espaço, sem acento
([US-81](./sdlc/01-requisitos/US-81-higiene-de-nomes-e-placeholders-nos-docs.md)).
Espaço obriga `%20` no link; byte não-ASCII faz `git ls-tree | grep` engolir o
arquivo em silêncio (`core.quotePath`). Exceções deliberadas: `US-TEMPLATE.md`
e `US-76-consertar-fake-teste-extractOpeningEntities.md` (camelCase = nome real
da função).

`[US-NN](#)` é reservado para escopo que **não existe** — nem arquivo, nem seção
em [`criterios-de-aceite.md`](./sdlc/01-requisitos/criterios-de-aceite.md), nem
story posterior que o absorveu. "Não tem arquivo `US-NN-*.md`" não basta.

## Verificação de links

```bash
pnpm docs:links            # falha se houver qualquer link relativo quebrado
pnpm docs:links --list     # mostra cada quebrado, com a correção sugerida
pnpm docs:links --only-md  # falha só nos que apontam para .md
```

Node puro, sem dependência. Rode antes de commitar documentação.
