# Backlog — Mapa em tempo real

**Objetivo:** campanha multiplayer ganha um mapa visual compartilhado — token, posição, e o que
cada jogador enxerga, atualizado ao vivo para todos os conectados.

**Decisão de produto pendente — mais fundamental que a dos três backlogs irmãos.** REC, DEF e
[INI](./backlog-combate-por-turno.md) travam em "árbitro ou narrador" — uma pergunta sobre
*mecânica*. Este backlog trava em algo anterior: **isto é o produto?**
O [roadmap de fases](../../../AGENTS.md#contexto-do-projeto) (`AGENTS.md:14-20`) tem seis fases,
e a fase 4 já é explícita — *"Multiplayer — WebSocket, limite de 10, turnos e iniciativa"*. Mapa,
token, grid ou tabuleiro **não aparecem em nenhuma das seis**. Isto não é "ainda não chegou a
vez" (como é o caso do INI, que a própria fase 4 já nomeia via "turnos e iniciativa") — é escopo
que hoje não existe em documento nenhum de produto. Ver *Decisões abertas* #1.

**Criado em:** 2026-08-12, a pedido explícito da mantenedora, depois da análise de
[CheekyChinchilla/CozyVTT](https://github.com/CheekyChinchilla/CozyVTT) (AGPL-3.0 — ver
*Referências externas*), sobre como funciona o mapa em tempo real lá.

Este documento **não é uma user story**. É a sequência de tarefas até o objetivo, com dependências
e o que já existe. Cada item vira um `US-*.md` próprio quando entrar em execução.

> **Rótulos, não números de story.** `MAP-0`…`MAP-4` são identificadores **internos deste
> documento**. O número real (`US-NNN`) é atribuído no dia em que a story for escrita.

---

## O estado verificado

Levantado em 12/08/2026 em `apps/web/src`, `apps/api/prisma/schema.prisma`, `docs/prd.md` e
`AGENTS.md`.

**1. Zero conceito de mapa, token, grid ou posição espacial em qualquer camada.** Grep por
`map`/`token`/`canvas`/`grid` em `apps/web/src` bate em 20 arquivos — todos falso positivo:
`Array.map`, ou `token` de JWT (Auth.js). Nenhum resultado é mapa de jogo.

**2. `docs/prd.md` nunca menciona mapa, tabuleiro ou grid.** O objetivo do produto (seção 2) é
*"criar um AI Dungeon Master... com o agente fazendo o papel de mestre — entendendo as regras,
narrando a aventura e acompanhando a ficha"*. Narração é texto. A seção 4.2 já promete multiplayer
(*"até 10 personagens de jogador por campanha"*), mas nada ali fala de visualização compartilhada.

**3. O transporte de tempo real hoje é unidirecional, e é deliberado.** `AGENTS.md:67` e `:90`:
*"Transporte é REST + SSE... não WebSocket... não existe `socket.io` nem `ws` no repo"*. SSE serve
para narração fluir do servidor pro cliente. Mapa em tempo real, como o CozyVTT mostra, é
**bidirecional por natureza** — o jogador arrasta um token e o servidor precisa saber a posição
antes de poder retransmitir. SSE não cobre isso; seria uma segunda tecnologia de transporte
inteira, não extensão da atual.

**4. Nenhum registro do schema tem coordenada.** `CharacterState.sceneState`
([`schema.prisma:46`](../../../apps/api/prisma/schema.prisma)) e `Adventure.entities` (US-75) são
texto e ledger de fato — não X/Y, não dimensão de mapa, não posição de token.

---

## Depende de

| # | Dependência | Estado | Onde dói |
|---|---|---|---|
| **D1** | **A decisão de identidade de produto** (*Decisões abertas* #1) | Aberta, e mais cara que as dos irmãos: se "não", este backlog inteiro é descartado, não adiado | Bloqueia tudo |
| **D2** | **Multiplayer existir** | Fase 4 do roadmap, ainda não construída | Mapa compartilhado sem mais de um espectador ao vivo tem valor mínimo — ver *Decisões abertas* #3 |
| **D3** | **Canal WebSocket no servidor** | Roadmapado na fase 4 (`AGENTS.md:18`), zero linha escrita | Broadcast de posição a 60fps não roda sobre SSE |
| **D4** | **Modelo de Mapa e Token no schema** | Não existe | Ao contrário de REC/DEF/INI, que reaproveitam `CharacterState` já existente, aqui não há registro-base nenhum para estender |

---

## Tarefas

**✱ MAP-0 — confirmar que a fase 4 tem data**
Não é código: checagem de roadmap. Sem a fase 4 encaminhada, este backlog não tem quando — depende
de D1 e D2 estarem resolvidas antes de qualquer linha.
Depende de: nada, mas trava tudo abaixo.

**MAP-1 — canal WebSocket no servidor**
Infraestrutura nova, não extensão do SSE existente. Autenticação por socket reaproveitando o JWT
do Auth.js (US-61) no handshake — o par `authenticateSocket`/`authenticateCampaign` do CozyVTT é o
desenho de referência (AGPL, reimplementar). Sala por campanha, não por usuário solto.
Depende de: D2, D3.

**MAP-2 — schema de mapa e token**
Modelo novo: `Map` (dimensão, imagem de fundo, `campaignId`) e a posição de cada token. Mesma
tensão piso/modelo-rico que já apareceu em REC (*Decisão aberta* #4) e em INI (*A pergunta de
schema*) — JSON solto no precedente de `sceneState`/`arc`, ou tabela `Token` relacional.
Depende de: D4.

**MAP-3 — mover token: broadcast em três fases**
`move.start` / `move` (posição durante o arraste, taxa limitada) / `move.end` (persistido). O
desenho verificado no CozyVTT: permissão por papel (DM move qualquer token; jogador só o que
controla), limite de vazão por socket além do throttle de taxa, posição validada contra os limites
do mapa no servidor antes de gravar.
Depende de: MAP-1, MAP-2.

**MAP-4 — visibilidade por jogador (fog of war em tempo real)**
Recalcular, a cada movimento, o que cada jogador enxerga — geometricamente (raycasting contra
paredes do mapa), não narrativamente. É o análogo multiplayer e espacial do que
`WorldEntity.revelado` (US-75) já resolve single-player e textual: mesmo problema — "o que esta
pessoa específica já pode ver" — noutra forma.
**Fora do corte mínimo.** É a parte mais cara do que o CozyVTT implementa.
Depende de: MAP-3.

---

## Corte mínimo

**MAP-0 + MAP-1 + MAP-2 + MAP-3**, sem MAP-4 — visibilidade uniforme, todo jogador vê todo token.
Ainda assim são quatro stories de infraestrutura **nova por inteiro**: ao contrário de REC, DEF e
INI, nenhuma reaproveita um registro que já existe no schema. É o corte mínimo mais caro dos quatro
backlogs de mecânica/infra escritos até aqui.

---

## O que fica de fora deste backlog

- **Luz dinâmica real** (raycasting fino contra paredes) e a camada "spirit"/oculta do CozyVTT —
  MAP-4 já é o corte do fog of war; a versão fina dele nem entra aqui.
- **Atmosfera, tema visual, áudio ambiente.** Decoração, não mecânica.
- **Import/export de campanha como arquivo portátil.** Feature própria do CozyVTT, sem análogo
  aqui.
- **Ficha multi-sistema (D&D/Pathfinder/Call of Cthulhu).** Não é mapa; se um dia entrar, é
  extensão do que [ADR 003](../../adr/003-sistemas-como-dado.md) já resolve para sistema-como-dado.
- **Turnos e iniciativa.** É o [backlog de combate por turno](./backlog-combate-por-turno.md) —
  ele já é nomeado na fase 4 do roadmap; este documento não é.

---

## Decisões abertas

1. **Isto é o produto?** A pergunta que decide se o resto deste documento é relevante algum dia.
   O PRD define o AI DM pela narração em texto; um mapa visual compartilhado é a mesma virada de
   categoria que a própria análise do CozyVTT nomeou — *"não é Mestre por IA, é ferramenta de mesa
   visual"*. Diferente de REC/DEF/INI, que fecham lacunas dentro do produto já definido, este
   backlog **propõe adicionar uma camada que o produto nunca teve**.
2. **SSE e WebSocket convivem?** A API passaria a ter dois transportes de tempo real — SSE para
   narração (o proxy de streaming da US-60 já resolveu o caso dela), WebSocket para mapa. Dobra a
   superfície de infraestrutura de tempo real, com os dois canais precisando concordar sobre o
   mesmo estado de campanha.
3. **Faz sentido sem multiplayer de verdade rodando?** O valor inteiro do mapa em tempo real é
   **mais de uma pessoa vendo a mesma mudança ao vivo**. Sem a fase 4 construída, MAP-3 e MAP-4 não
   têm quem observar — o corte mínimo deste backlog não tem por que existir isolado da fase 4
   inteira, ao contrário de INI, que tem valor mesmo em single-player (um personagem contra
   monstros do GEN-9 já usa ordem de turno).

---

## Referências no código

- [`AGENTS.md:14-20`](../../../AGENTS.md) — o roadmap de seis fases; a fase 4 nomeia WebSocket,
  multiplayer, turnos e iniciativa, e não nomeia mapa.
- [`AGENTS.md:67`](../../../AGENTS.md) e [`:90`](../../../AGENTS.md) — o transporte é REST+SSE,
  não WebSocket, e é escolha deliberada, não lacuna.
- [`docs/prd.md`](../../prd.md) — seção 2 (objetivo do produto, narração em texto) e seção 4.2
  (multiplayer já prometido, mapa nunca mencionado).
- [`apps/api/prisma/schema.prisma:46`](../../../apps/api/prisma/schema.prisma) — `CharacterState`,
  onde se confirma a ausência de qualquer coordenada espacial.
- [backlog-combate-por-turno.md](./backlog-combate-por-turno.md) — irmão mais próximo: mesma
  origem (openfray/CozyVTT), mesma fase 4, mas já nomeado no roadmap — diferença que justifica o
  tratamento mais cauteloso deste documento.

### Referências externas

Lido por README, metadados da API do GitHub e leitura direta de `backend/src/websocket/` (permitido
sob AGPL — **ler para entender, nunca copiar**; ver [registro de
repositórios](../referencia/repositorios-de-referencia.md)). Nenhuma decisão aqui se apoia na
autoridade da referência: o que sustenta cada item é a verificação no código e nos documentos deste
repo, em *O estado verificado*.

| Repositório | Licença | Rendeu |
|---|---|---|
| [CheekyChinchilla/CozyVTT](https://github.com/CheekyChinchilla/CozyVTT) | **AGPL-3.0** | o protocolo de três fases (`move.start`/`move`/`move.end`), o par autenticação-por-socket + sala-por-campanha, o recálculo de visibilidade por jogador a cada movimento (MAP-4), o alerta de que SSE não serve pra isso. Nada do TypeScript atravessa — só a estrutura, reimplementada do zero se e quando este backlog entrar em execução |
