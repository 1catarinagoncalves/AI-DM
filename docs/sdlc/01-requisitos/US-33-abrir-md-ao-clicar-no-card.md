# US-33 — Abrir o arquivo .md ao clicar no card do Kanban

**Épico:** 5 — Ferramentas de projeto / SDLC
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** [US-31](./US-31-quadro-kanban-de-user-stories.md) — o quadro Kanban e o servidor local
**Criada em:** 2026-07-07

---

## História

> **Como** desenvolvedora / dona do produto,
> **quero** clicar num card do quadro Kanban e ter o arquivo `.md` daquela story aberto no meu editor,
> **para que** eu vá do painel de progresso pro detalhe da story num clique, sem procurar o arquivo na pasta.

---

## Contexto e motivação

### O problema observado

No quadro da [US-31](./US-31-quadro-kanban-de-user-stories.md) o card mostra código, título, épico e o **nome do arquivo** — mas o nome não é clicável. Pra ler ou editar a story, tenho que sair do quadro, abrir a pasta `docs/sdlc/01-requisitos` e caçar o `.md` pelo nome. O quadro me diz *onde estou*, mas não me leva *até lá*.

### Por que a solução atual não basta

- O card exibe `arquivo` como texto morto.
- O navegador, sozinho, não abre um caminho local a partir de um clique (segurança do `file://`) — foi por isso que a US-31 tirou o "link pro `.md`" do escopo.
- Mas a US-31 já roda um **servidor local** (`kanban-server.js`) com acesso ao disco. Ele *pode* abrir o arquivo no app padrão do sistema — o navegador só precisa pedir.

### A proposta

Clicar no corpo do card dispara um `GET /open/:codigo` ao servidor local, que abre o `.md` correspondente no editor/app padrão do sistema (via o comando de "abrir" do SO). Um clique no card = o arquivo aberto.

---

## Escopo

### Dentro do escopo

- Clique no **título do card** (não no card inteiro, não nas setas ◀ ▶) chama `GET /open/:codigo`.
- O título é estilizado como link (cursor `pointer`, sublinhado no hover) pra sinalizar que é clicável; o resto do card não.
- Novo endpoint no `kanban-server.js`: `GET /open/:codigo` → localiza o `.md` da story e abre no app padrão do SO.
- Suporte a Windows (`start`), macOS (`open`) e Linux (`xdg-open`) via detecção de plataforma.
- Feedback rápido na barra de status ("abrindo US-XX…" / erro).

### Fora do escopo

- Escolher *qual* editor abre — usa o padrão do SO pra `.md`.
- Abrir numa linha/âncora específica dentro do arquivo.
- Renderizar/editar o `.md` dentro do próprio quadro (continua sendo o editor externo).
- Reabrir o arquivo se já estiver aberto (delega ao SO).

---

## Modelo de dados proposto

> Sem dados novos. Reusa o `codigo` e o `arquivo` que a US-31 já parseia de cada story.

**Novo endpoint:**

- `GET /open/:codigo` — valida `codigo`, resolve o caminho absoluto do `.md` dentro de `docs/sdlc/01-requisitos`, e dispara o comando de abrir do SO. Responde `{ ok: true }` ou erro.

**Comando por plataforma:**

| SO (`process.platform`) | Comando |
|---|---|
| `win32` | `start "" "<arquivo>"` |
| `darwin` | `open "<arquivo>"` |
| resto (Linux) | `xdg-open "<arquivo>"` |

---

## Critérios de aceite

- [ ] Clicar no **título** de um card abre o `.md` daquela story no app padrão do SO.
- [ ] Clicar fora do título (área vazia do card, épico, nome do arquivo) **não** abre nada; clicar nas setas ◀ ▶ só move a story.
- [ ] O título tem cursor `pointer` e destaque no hover (link); o resto do card não sinaliza clique.
- [ ] Arrastar o card (inclusive começando pelo título) move a story e **não** abre o arquivo.
- [ ] `GET /open/:codigo` só abre arquivos dentro de `docs/sdlc/01-requisitos`; um `codigo` inexistente devolve 404 e não executa comando nenhum.
- [ ] O caminho passado ao comando é o do arquivo real da story (sem concatenar entrada não validada — evita injeção de comando).
- [ ] **Eval / teste de regressão:** `GET /open/US-31` resolve para `US-31-quadro-kanban-de-user-stories.md` e dispara o comando de abrir; `GET /open/US-999` devolve 404 sem executar nada.

---

## Notas de implementação

> *Dicas, não especificação obrigatória.*

- Reusar a função que a US-31 já tem pra achar o arquivo por `codigo` (a mesma do `PATCH`).
- Abrir com `child_process`. **Segurança:** não montar a string do caminho com o `codigo` cru da URL — resolver o `arquivo` a partir da lista de stories já parseada e passar **só esse caminho**. No Windows, preferir `execFile('cmd', ['/c', 'start', '', arquivo])` ou passar o caminho como argumento, não interpolado numa shell string.
- Confirmar que o caminho resolvido continua dentro de `REQ_DIR` (`path.resolve` + checagem de prefixo) antes de abrir — defesa contra path traversal.
- No cliente: `addEventListener('click')` **no elemento do título**, chamando `fetch('/open/' + codigo)`. Como o alvo é só o título, as setas (que já dão `stopPropagation`) e o resto do card não disparam abertura.
- Distinguir clique de arraste fica quase de graça: o `click` nativo **não dispara após um `drop`** (drag real), só num clique parado. Restringir ao título já remove a ambiguidade de afordância; um flag `dragstart`/`dragend` é opcional (cinto e suspensório).

---

## Questões em aberto

1. ~~Distinguir clique de fim-de-arraste?~~ **Resolvido: clique só no título** (afordância clara) + `click` nativo não dispara após `drop`. Flag opcional se algum navegador alvo divergir.
2. ~~App padrão de `.md` ou "abrir no VS Code"?~~ **Resolvido: app padrão do SO** (`start`/`open`/`xdg-open`). VS Code fica como possível story futura.

---

## Referências no código

- `tools/kanban/kanban-server.js` — servidor local (US-31); ganha o endpoint `GET /open/:codigo`.
- `tools/kanban/kanban.html` — o card ganha o handler de clique que chama `/open/:codigo`.
- `docs/sdlc/01-requisitos/US-*.md` — arquivos que o clique abre.
