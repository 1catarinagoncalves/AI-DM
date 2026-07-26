# US-31 — Quadro Kanban visual das user stories

**Épico:** 5 — Ferramentas de projeto / SDLC
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** nenhuma
**Criada em:** 2026-07-07

---

## História

> **Como** desenvolvedora / dona do produto,
> **quero** ver todas as user stories da pasta `01-requisitos` num quadro Kanban visual, organizadas por status (Backlog / A fazer / Em progresso / Feito),
> **para que** eu enxergue de relance o andamento do backlog sem abrir cada arquivo `.md` um por um.

---

## Contexto e motivação

### O problema observado

As user stories vivem como arquivos `.md` soltos em `docs/sdlc/01-requisitos`. Pra saber o que está feito e o que falta, tenho que abrir cada arquivo e ler a linha `**Status:**`. Já são ~15 stories; a lista em [`user-stories.md`](./user-stories.md) agrupava por épico mas **não mostrava status** — era um índice, não um painel de progresso. *(A [US-78](./US-78-vault-obsidian-para-os-docs.md) recriou esse índice como bloco DataviewJS, que hoje **mostra** o status; o quadro continua sendo o único que o edita por arraste.)*

### Por que a solução atual não basta

- `user-stories.md` era mantido à mão e não refletia o campo `Status` de cada arquivo. *(Desde a [US-78](./US-78-vault-obsidian-para-os-docs.md) ele é gerado por Dataview e reflete — mas só renderiza dentro do Obsidian, e continua sendo leitura. O quadro segue sendo o único jeito de **editar** status.)*
- Não há visão "coluna por estado". Pra montar essa visão hoje eu leio 15 arquivos de cabeça.
- Os próprios status estão **inconsistentes** entre arquivos (`Feito`, `✅ Implementada`, `✅ Pronta para desenvolvimento`, `📋 Planejada (não iniciada)`), então nem um `grep` resolve limpo.

### A proposta

Um **servidor local minúsculo** (`kanban-server.js`, Node puro, zero dependências) que serve uma página `kanban.html` e expõe a pasta `docs/sdlc/01-requisitos`. Um arquivo **`kanban.bat`** liga tudo com duplo-clique: sobe o servidor e abre o navegador. Funciona em **qualquer navegador** (Firefox incluído), porque quem toca o disco é o Node — o navegador só faz `fetch`.

A página lê os `US-*.md`, extrai número/título/status/épico, normaliza o status em quatro colunas (**Backlog**, **A fazer**, **Em progresso**, **Feito**) e renderiza um quadro Kanban. **Backlog** recolhe as stories cujo status não casa com nenhum dos outros três (fallback). Cada card mostra o código (US-XX), o título e o épico.

Os cards são **arrastáveis entre colunas**. Arrastar um card pra outra coluna **muda o status da story**: o navegador manda um `PATCH` ao servidor, que reescreve a linha `**Status:**` do `.md` de origem com o status canônico daquela coluna. O `.md` continua sendo a fonte de verdade; o quadro é uma interface de edição sobre ele.

---

## Escopo

### Dentro do escopo

- **Servidor local `kanban-server.js`** — Node puro (só `http` + `fs` + `path`), zero dependências, zero build.
- **Launcher `kanban.bat`** — duplo-clique sobe o servidor (`node kanban-server.js`) e abre o navegador na URL.
- **Página `kanban.html`** servida pelo servidor — HTML + CSS + JS inline.
- `GET /stories` — servidor lê todos os `US-*.md` de `docs/sdlc/01-requisitos` (ignora `US-TEMPLATE.md`), extrai `código`/`título`/`status`/`épico`, normaliza em 4 colunas e devolve JSON.
- Renderizar o quadro com colunas e cards a partir do JSON.
- Contador de cards por coluna.
- **Arrastar cards entre colunas** (drag-and-drop).
- Ao soltar numa coluna, `PATCH /stories/:codigo` faz o servidor **reescrever a linha `**Status:**`** do `.md` de origem com o status canônico.
- Botão "Recarregar" que refaz `GET /stories`.
- Funciona em qualquer navegador (Chrome, Edge, Firefox).

### Fora do escopo

- **Página no `apps/web`.** É um script solto (`kanban-server.js` + `kanban.html` + `kanban.bat`), não parte do app de produção.
- **Detectar automaticamente se a story está implementada** (ler código/git e inferir "Feito"). O status vem do campo `**Status:**` escrito no `.md` e é mudado pelo arraste — a fonte de verdade é o arquivo, não o estado do código. Auto-detecção é story futura.
- Reescrever qualquer outra parte do `.md` além da linha `**Status:**` (título, corpo, etc.).
- Reordenar cards dentro da mesma coluna (posição não é persistida).
- Expor o servidor na rede — escuta só em `127.0.0.1`, ferramenta local de dev.
- Autenticação / permissões — é ferramenta interna de projeto.

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
| `coluna` | `"backlog" \| "todo" \| "doing" \| "done"` | Status normalizado. |
| `arquivo` | string | Nome do `.md` de origem (o servidor usa pra localizar e reescrever). |

**Mapa de normalização (status bruto → coluna) — na leitura:**

| Contém… | Coluna |
|---|---|
| `Feito`, `✅ Implementada` | `done` |
| `Em progresso`, `Em desenvolvimento`, `WIP` | `doing` |
| `📋 Planejada`, `Pronta para desenvolvimento` | `todo` |
| qualquer outro / vazio / não reconhecido | `backlog` |

**Mapa canônico (coluna → status escrito) — na gravação, ao arrastar:**

| Coluna | Texto gravado na linha `**Status:**` |
|---|---|
| `backlog` | `🗂️ Backlog` |
| `todo` | `📋 Planejada (não iniciada)` |
| `doing` | `🚧 Em progresso` |
| `done` | `✅ Implementada` |

> Efeito colateral bom: arrastar **normaliza** os status hoje inconsistentes para um dos quatro textos canônicos.

**Persistência:** o status vive na linha `**Status:**` do próprio `.md`. Leitura deriva o quadro; o arraste reescreve **só essa linha** do arquivo de origem. Nenhum banco.

**Servidor local (`kanban-server.js`, Node puro):**
- Escuta em `http://127.0.0.1:<porta>`.
- `GET /` → serve `kanban.html`.
- `GET /stories` → `fs.readdir` da pasta, lê e parseia cada `US-*.md`, devolve o array de stories já normalizado.
- `PATCH /stories/:codigo` (body `{ coluna }`) → valida `coluna` e `codigo`, lê o `.md`, `replace` só na linha `**Status:**` com o texto canônico, `fs.writeFile`, devolve a story atualizada.
- No cliente: drop → `fetch(PATCH)`; em falha, o card volta pra coluna original (rollback otimista).

---

## Critérios de aceite

- [ ] Duplo-clique no `kanban.bat` sobe o servidor e abre o quadro no navegador, listando todas as stories exceto `US-TEMPLATE.md`.
- [ ] O quadro tem 4 colunas (**Backlog**, **A fazer**, **Em progresso**, **Feito**) e cada card cai na coluna certa conforme o mapa de normalização; status não reconhecido cai em **Backlog**.
- [ ] Cada card mostra código, título, épico e nome do arquivo.
- [ ] Cada coluna mostra a contagem de cards.
- [ ] É possível **arrastar um card** de uma coluna pra outra.
- [ ] Ao soltar o card numa coluna, o servidor reescreve a linha `**Status:**` do `.md` daquela story no disco com o texto canônico da coluna, e **só essa linha** muda (resto do arquivo intacto).
- [ ] O botão "Recarregar" refaz `GET /stories` e mostra o card na nova coluna (mudança persistiu em disco).
- [ ] Se o `PATCH` falhar, o card volta pra coluna de origem (sem estado fantasma).
- [ ] Adicionar um novo `US-XX.md` na pasta e "Recarregar" faz o card aparecer sem editar código.
- [ ] Funciona em Chrome, Edge **e Firefox** (o navegador só faz `fetch`; o disco é tocado pelo Node).
- [ ] O servidor escuta só em `127.0.0.1` (não exposto na rede).
- [ ] **Eval / teste de regressão (leitura):** dado o conjunto atual de arquivos, o parser coloca `US-01` (`Feito`) em **Feito**, `US-17` (`📋 Planejada`) em **A fazer** e `US-25` (`✅ Pronta para desenvolvimento`) em **A fazer**; um status inventado (ex.: `Rascunho`) cai em **Backlog**, nunca some.
- [ ] **Eval / teste de regressão (gravação):** arrastar `US-17` pra **Feito** deixa o arquivo com `**Status:** ✅ Implementada` e nenhuma outra linha alterada.

---

## Notas de implementação

> *Dicas, não especificação obrigatória.*

- **Onde ficam:** os três arquivos (`kanban-server.js`, `kanban.html`, `kanban.bat`) juntos, ex.: `tools/kanban/`. O servidor resolve a pasta `docs/sdlc/01-requisitos` por caminho relativo a partir do próprio `__dirname`.
- **`kanban.bat`:** `node "%~dp0kanban-server.js"` e depois `start http://127.0.0.1:<porta>` (o `%~dp0` garante que roda de qualquer lugar). Assume Node no PATH.
- **Servidor:** um `http.createServer` com 3 rotas (`GET /`, `GET /stories`, `PATCH /stories/:codigo`). Sem framework — `req.method` + `req.url` bastam. Servir o `kanban.html` com `fs.readFile`.
- **Gravação:** `content.replace(/^\*\*Status:\*\*.*$/m, `**Status:** ${canonico}`)`, depois `fs.writeFile`. Regex de linha única — não regerar o arquivo. Se a linha `**Status:**` não existir, não inventar: 422 e pular.
- Drag-and-drop: HTML5 nativo (`draggable` + `dragstart`/`dragover`/`drop`) — zero libs.
- **UI otimista:** mover o card no DOM na hora do drop e mandar o `PATCH` em background; reverter se a resposta não for 2xx.
- Parser: ~um regex por campo. Cuidado: o título usa em-dash `—`, não hífen.
- Normalização de status (leitura) deve ser **case-insensitive** e por `includes`, com `backlog` como fallback — nunca perder um card.

---

## Questões em aberto

Todas resolvidas:

1. ~~Como entregar o quadro?~~ **Servidor local Node puro (`kanban-server.js`) + `kanban.html` + launcher `kanban.bat`. Funciona em qualquer navegador.**
2. ~~Colunas "Em progresso"/"Backlog" nascem vazias?~~ **Ok.** Passam a ter fonte quando alguém arrasta um card pra lá; Backlog é rede pra status novos/errados.
3. ~~Textos canônicos servem?~~ **Sim:** `🗂️ Backlog` / `📋 Planejada (não iniciada)` / `🚧 Em progresso` / `✅ Implementada`. O arraste converge os status inconsistentes; não reescreve retroativamente os que ninguém arrastar.
4. ~~Suporte a Firefox?~~ **Sim** — como o disco é tocado pelo Node e o navegador só faz `fetch`, funciona em todos. Foi o motivo de trocar da File System Access API pro servidor.
5. ~~`file://` vs servidor?~~ **Servidor** (`kanban.bat` abre `http://127.0.0.1`).

---

## Referências no código

- `docs/sdlc/01-requisitos/US-*.md` — fonte de verdade das stories (título, status, épico); lidos e reescritos pelo servidor.
- `docs/sdlc/01-requisitos/user-stories.md` — índice; desde a US-78 é um bloco DataviewJS que lê os mesmos campos. Leitura; o quadro é quem escreve.
- `docs/sdlc/01-requisitos/US-TEMPLATE.md` — molde do cabeçalho que o parser lê; deve ser excluído do quadro.
- `tools/kanban/kanban-server.js` (a criar) — servidor Node puro: serve o HTML e lê/grava os `.md`.
- `tools/kanban/kanban.html` (a criar) — o quadro: HTML/CSS/JS inline, sem dependências.
- `tools/kanban/kanban.bat` (a criar) — launcher: sobe o servidor e abre o navegador.
