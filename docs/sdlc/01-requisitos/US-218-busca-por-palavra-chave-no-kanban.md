# US-218 — Busca por palavra-chave no quadro Kanban

**Épico:** 5 — Ferramentas de projeto / SDLC
**Fase:** 1 — MVP single-player
**Status:** ✅ Feito
**Depende de:** [US-31](./US-31-quadro-kanban-de-user-stories.md)
**Criada em:** 2026-09-05

---

## História

> **Como** desenvolvedora / dona do produto,
> **quero** filtrar os cards do quadro Kanban por palavra-chave do título ou pelo código (US-XX),
> **para que** eu ache uma story específica sem rolar as 4 colunas procurando de olho.

---

## Contexto e motivação

### O problema observado

O quadro (US-31) já passa de 200 stories. Achar uma story específica hoje é rolar coluna por coluna lendo título por título — sem busca, sem atalho.

### Por que a solução atual não basta

`kanban.html` não tem nenhum campo de texto nem lógica de filtro; `render()` (`tools/kanban/kanban.html:90`) sempre desenha todos os itens de `stories`. Não há solução parcial a estender — falta o campo inteiro.

### A proposta

Um campo de busca no `header`, ao lado do botão "Recarregar". Digitar filtra os cards em tempo real pelo título **ou** pelo código (substring, case-insensitive, casa qualquer um dos dois); colunas ficam só com os cards que casam, sem chamada ao servidor.

---

## Escopo

### Dentro do escopo

- Campo `<input type="search">` no `header` de `kanban.html`.
- Filtro por substring case-insensitive no **título** (`s.titulo`) **ou** no **código** (`s.codigo`) da story — casa se o termo aparecer em qualquer um dos dois.
- Atualização em tempo real (`input` event), sem debounce — lista já está em memória, `filter()` é instantâneo.
- Contador de cada coluna reflete o resultado filtrado, não o total.
- Coluna sem match nenhum mostra o `.empty` existente ("vazio").
- Campo vazio volta a mostrar todos os cards (comportamento atual).

### Fora do escopo

- Busca por épico ou nome de arquivo — só título e código. Pode virar story futura se sentir falta.
- Busca no servidor / backend — filtro é 100% client-side sobre o array `stories` já carregado.
- Persistir o termo buscado entre reloads (localStorage, querystring).
- Highlight do trecho encontrado no título.

---

## Critérios de aceite

- [x] Existe um campo de busca visível no cabeçalho do quadro.
- [x] Digitar um termo esconde, em cada coluna, os cards cujo título **e** código não contêm o termo (case-insensitive).
- [x] Buscar por um código parcial (ex.: `"31"` ou `"us-31"`) acha a story pelo `codigo`, mesmo que o termo não apareça no título.
- [x] O contador de cada coluna mostra a contagem filtrada, não o total da coluna.
- [x] Limpar o campo mostra todos os cards de novo, nas colunas originais.
- [x] Uma coluna que fica sem nenhum card por causa do filtro mostra "vazio", igual a uma coluna genuinamente vazia.
- [x] Arrastar um card enquanto o filtro está ativo continua funcionando (`mover()` não depende da lista filtrada).
- [x] **Eval / teste de regressão:** com o termo `"kanban"`, aparece o card US-31 (título contém "Kanban") e não aparece um card cujo título não contém a substring; com o termo `"US-31"`, aparece só o card de código `US-31` mesmo que outro título contenha a palavra "kanban"; termo vazio restaura todos os cards.

---

## Notas de implementação

> *Dicas, não especificação obrigatória.*

- `render()` (`tools/kanban/kanban.html:90`) hoje itera `stories` direto por coluna (`stories.filter((s) => s.coluna === col.id)`). Adicionar um filtro por termo antes: `const termo = buscaEl.value.trim().toLowerCase();` e `itens.filter((s) => s.titulo.toLowerCase().includes(termo) || s.codigo.toLowerCase().includes(termo))`, com `termo === ''` pulando o filtro.
- Guardar o termo numa variável de módulo (ex.: `let termo = ''`) e chamar `render()` no listener do `input`, mesmo padrão do `reload` atual.
- `mover()` (`tools/kanban/kanban.html:155`) já opera sobre `stories` (lista completa), não sobre o DOM filtrado — não deve precisar de mudança.
- CSS: reaproveitar os estilos de `button`/`header` já existentes; um `input[type=search]` com a mesma paleta de variáveis (`--panel2`, `--border`, `--text`).

---

## Questões em aberto

Resolvida: busca cobre título e código juntos (ver Escopo). Épico e arquivo ficam de fora por ora — ampliar depois se sentir falta.

---

## Referências no código

- `tools/kanban/kanban.html:90` — `render()`, itera `stories` por coluna; ponto onde o filtro entra.
- `tools/kanban/kanban.html:56` — `<header>`, onde o campo de busca é inserido.
- `tools/kanban/kanban.html:76` — `carregar()`, popula `stories`; filtro atua sobre esse array já carregado.
- [US-31](./US-31-quadro-kanban-de-user-stories.md) — story original do quadro Kanban.
