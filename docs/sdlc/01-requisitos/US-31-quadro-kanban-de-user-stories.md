# US-31 — Quadro Kanban visual das user stories

**Épico:** 5 — Ferramentas de projeto / SDLC
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** nenhuma
**Criada em:** 2026-07-07

---

## História

> **Como** desenvolvedora / dona do produto,
> **quero** ver todas as user stories da pasta `01-requisitos` num quadro Kanban visual, organizadas por status (A fazer / Em progresso / Feito),
> **para que** eu enxergue de relance o andamento do backlog sem abrir cada arquivo `.md` um por um.

---

## Contexto e motivação

### O problema observado

As user stories vivem como arquivos `.md` soltos em `docs/sdlc/01-requisitos`. Pra saber o que está feito e o que falta, tenho que abrir cada arquivo e ler a linha `**Status:**`. Já são ~15 stories; a lista em [`user-stories.md`](./user-stories.md) agrupa por épico mas **não mostra status** — é um índice, não um painel de progresso.

### Por que a solução atual não basta

- `user-stories.md` é mantido à mão e não reflete o campo `Status` de cada arquivo.
- Não há visão "coluna por estado". Pra montar essa visão hoje eu leio 15 arquivos de cabeça.
- Os próprios status estão **inconsistentes** entre arquivos (`Feito`, `✅ Implementada`, `✅ Pronta para desenvolvimento`, `📋 Planejada (não iniciada)`), então nem um `grep` resolve limpo.

### A proposta

Uma **página viva** no `apps/web` que lê os arquivos `US-*.md`, extrai o número, título e status de cada um, normaliza o status em três colunas (**A fazer**, **Em progresso**, **Feito**) e renderiza um quadro Kanban. Cada card mostra o código (US-XX), o título e o épico, e linka pro arquivo `.md` de origem.

A página tem um botão **"Atualizar status"** que re-lê os arquivos no servidor e re-renderiza o quadro com os status atuais — sem precisar reiniciar o app ou editar código. Assim, depois de mudar o `**Status:**` de uma story, um clique reflete a mudança.

---

## Escopo

### Dentro do escopo

- Ler todos os `US-*.md` de `docs/sdlc/01-requisitos` (ignorar `US-TEMPLATE.md`).
- Extrair `código`, `título` (primeira linha `# US-XX — …`), `status` e `épico` do cabeçalho.
- Normalizar o texto livre de status em 3 colunas.
- Renderizar um quadro com colunas e cards; card linka pro `.md`.
- Contador de cards por coluna.

### Fora do escopo

- Arrastar cards pra mudar status (isso escreveria de volta no `.md` — vira story futura).
- Autenticação / permissões — é ferramenta interna de projeto.
- Sincronizar com issues do GitHub ou board externo.
- Editar a story pela interface.

---

## Modelo de dados proposto

Sem schema novo no banco. A fonte de verdade continua sendo os arquivos `.md`. Cada story é derivada em tempo de leitura:

```json
{
  "codigo": "US-30",
  "titulo": "Deletar personagem pela interface",
  "epico": "4 — Onboarding e navegação",
  "statusBruto": "✅ Pronta para desenvolvimento",
  "coluna": "todo",
  "arquivo": "US-30-deletar-personagem.md"
}
```

| Campo | Tipo | Descrição |
|---|---|---|
| `codigo` | string | Código `US-XX` extraído do nome/título. |
| `titulo` | string | Título curto após o `—` na linha `#`. |
| `epico` | string | Valor da linha `**Épico:**`. |
| `statusBruto` | string | Texto original da linha `**Status:**`. |
| `coluna` | `"todo" \| "doing" \| "done"` | Status normalizado. |
| `arquivo` | string | Nome do `.md` de origem, pra link. |

**Mapa de normalização (status bruto → coluna):**

| Contém… | Coluna |
|---|---|
| `Feito`, `✅ Implementada` | `done` |
| `Em progresso`, `Em desenvolvimento`, `WIP` | `doing` |
| `📋 Planejada`, `Pronta para desenvolvimento`, resto | `todo` |

**Persistência:** nenhuma. Derivado dos arquivos a cada carga.

---

## Critérios de aceite

- [ ] Existe uma página/quadro que lista todas as stories de `01-requisitos` exceto `US-TEMPLATE.md`.
- [ ] O quadro tem 3 colunas (**A fazer**, **Em progresso**, **Feito**) e cada card cai na coluna certa conforme o mapa de normalização.
- [ ] Cada card mostra código, título e épico, e clicar abre/linka o `.md` de origem.
- [ ] Cada coluna mostra a contagem de cards.
- [ ] Adicionar um novo `US-XX.md` faz o card aparecer sem editar código do quadro.
- [ ] **Eval / teste de regressão:** dado o conjunto atual de arquivos, o parser coloca `US-01` (`Feito`) em **Feito**, `US-17` (`📋 Planejada`) em **A fazer** e `US-25` (`✅ Pronta para desenvolvimento`) em **A fazer**; um status desconhecido cai em **A fazer** (default), nunca some.

---

## Notas de implementação

> *Dicas, não especificação obrigatória.*

- Opção mais barata: um **script de build** que gera um `board.html` (ou `KANBAN.md` com as 3 seções) a partir dos `.md` — zero runtime, roda no `pnpm` e abre no navegador. Preferir isto ao invés de subir rota/página no app se o objetivo é só visualizar.
- Se virar página no `apps/web`: ler os arquivos no server (App Router server component), não embutir no bundle.
- O parser é ~um regex por campo. Cuidado: o título usa em-dash `—`, não hífen.
- Normalização de status deve ser **case-insensitive** e por `includes`, com `todo` como fallback — nunca perder um card.

---

## Questões em aberto

1. Quadro estático gerado no build (`KANBAN.md` / `board.html`) **ou** página viva no `apps/web`? O gerado é bem mais barato e cobre o critério "visualizar".
2. Padronizar os textos de `Status:` nos arquivos existentes (hoje há 4 variações pra 2 estados reais)? Faria o parser mais simples, mas é mexer em 15 arquivos.
3. Coluna "Em progresso" tem fonte hoje? Nenhum arquivo usa esse status atualmente — a coluna pode nascer vazia.

---

## Referências no código

- `docs/sdlc/01-requisitos/US-*.md` — fonte de verdade das stories (título, status, épico).
- `docs/sdlc/01-requisitos/user-stories.md` — índice atual por épico, sem status; o quadro complementa isto.
- `docs/sdlc/01-requisitos/US-TEMPLATE.md` — molde do cabeçalho que o parser lê; deve ser excluído do quadro.
