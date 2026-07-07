# US-25 — Boas-vindas adaptativa (hub do jogador)

**Épico:** 4 — Onboarding e navegação
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** nenhuma **hard**. O `userId` já é criado (`api.createUser`) e guardado no `localStorage` hoje, então esta story é buildável sem login. A US-24 só é necessária para o caso *cross-device* (ver critério marcado com ⤷US-24). O endpoint de listagem de personagens é **entregue por esta própria story**.
**Criada em:** 2026-07-03

---

## História

> **Como** jogador que acabou de entrar,
> **quero** uma tela de boas-vindas que reflita o meu estado real no servidor — se não tenho personagem, ela me convida a criar o primeiro; se já tenho, mostra meus personagens e a aventura em andamento com "Continuar jogando" e "Criar novo personagem",
> **para que** eu caia sempre no próximo passo certo sem ter de lembrar onde parei.

---

## Contexto e motivação

### O problema observado

O hub atual (`HomeHero`) decide o que mostrar a partir do `localStorage` (`loadSession`), não do servidor. Isso tem duas consequências no fluxo de design **2a, tela 2** ("Boas-vindas com personagem existente"):

- Quem entra de outro navegador/dispositivo — ou depois de limpar o `localStorage` — cai no estado "sem personagem" mesmo tendo personagens salvos. O hub não sabe da existência deles.
- Só existe **um** `characterId`/`adventureId` na sessão. O design 2a mostra o jogador com **um ou vários** personagens ("Ver todos os personagens") e com uma aventura **em andamento** destacada — nada disso é derivável de um único blob de sessão.

Nas telas do design:
- **1a / tela 2** (estado vazio): "Olá, Aventureiro" · "Você ainda não tem nenhum personagem" · "Crie seu primeiro personagem para começar a jogar." · botão **Criar meu personagem**.
- **2a / tela 2** (com personagem): "Bem-vinda de volta, Lyra" · card do personagem ("Lyra Silvermoon · Elfa · Maga · Nv.1") · aventura em andamento ("Aventura: A Mina Perdida") · botões **Continuar jogando** e **Criar novo personagem**; com vários personagens, um atalho **Ver todos os personagens**.

### Por que a solução atual não basta

`HomeHero` renderiza a partir de `session?.adventureId` vindo do `localStorage`. Não há chamada de API que responda "quais personagens este usuário tem e qual é a aventura em aberto de cada um". O `api.ts` só expõe `getCharacter(id)` — busca **um** personagem por id conhecido, não *lista* os do usuário. Ou seja, o hub não tem como pintar o estado 2a corretamente, e o estado vazio é um falso negativo sempre que a sessão local some.

### A proposta

Tornar o hub **orientado a dados**: ao entrar, buscar do servidor os personagens do usuário logado (com a aventura em andamento de cada um) e ramificar a UI a partir dessa resposta — vazio → convite de criação; com personagem(ns) → lista + aventura em andamento + ações. Uma única tela cobre o estado vazio (1a/2) e o estado com personagem (2a/2).

---

## Escopo

### Dentro do escopo

- **Endpoint `GET /users/:userId/characters`** — lista os personagens do usuário com a aventura em andamento embutida (`currentAdventure`), num único request (sem N+1). É entregável desta story.
- **Cliente `api.listCharacters(userId)`** em `apps/web/src/lib/api.ts`, tipando a resposta.
- Ao montar, o hub busca os personagens do usuário logado via API (não do `localStorage`).
- **Estado vazio** (nenhum personagem): saudação genérica, mensagem "Você ainda não tem nenhum personagem" e botão **Criar meu personagem** → US-26.
- **Estado com personagem(ns):** saudação com o nome do jogador; para o personagem em foco, mostra nome + resumo (raça · classe · nível) e, se houver, a **aventura em andamento** (título).
  - Botão **Continuar jogando** → retoma a aventura em andamento (US-29).
  - Botão **Criar novo personagem** → US-26 (reentra a partir da etapa de Sistema).
- **Múltiplos personagens:** o **último jogado** entra em foco por padrão; há atalho **Ver todos os personagens** para escolher outro. Trocar o foco atualiza qual aventura "Continuar jogando" retoma.
- Estados de **carregamento** e **erro** da busca (spinner/skeleton; mensagem em vez de tela vazia silenciosa se a API falhar).

### Fora do escopo

- **Login / criar conta** (US-24) — pré-requisito; aqui assume-se que já se sabe quem é o jogador.
- O **assistente de criação** em si (US-26/27) e a **retomada** da aventura (US-29) — o hub só navega para eles.
- Uma **página de listagem dedicada** ("todos os personagens") com busca/filtro — o design menciona ("adicionar filtro/busca na lista"), mas fica como story futura; aqui basta trocar o personagem em foco.
- Excluir/renomear personagem, gerir várias aventuras por personagem.

---

## Modelo de dados proposto

Sem tabela nova. Esta story cria **um endpoint de leitura** que lista os personagens do usuário logado com a aventura em andamento de cada um. Resposta de `GET /users/:userId/characters`:

```json
[
  {
    "id": "char-1",
    "name": "Lyra Silvermoon",
    "race": "Elfo",
    "class": "Mago",
    "level": 1,
    "currentAdventure": { "id": "adv-1", "title": "A Mina Perdida" }
  }
]
```

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | string | Id do personagem (para "Continuar jogando" e navegação). |
| `name` | string | Nome exibido no card. |
| `race` / `class` / `level` | string / string / number | Resumo "Elfa · Maga · Nv.1". |
| `currentAdventure` | `{ id, title }` \| `null` | Aventura em andamento; `null` se o personagem ainda não iniciou nenhuma. |

**Persistência:** nenhuma nova — leitura sobre `Character` + `Adventure` já existentes. A "aventura em andamento" é a mais recente do personagem (ou uma marcada como ativa — ver Questões em aberto). A lista vem **ordenada por último jogado** (atividade mais recente primeiro), para o hub focar o primeiro item sem lógica extra.

---

## Critérios de aceite

- [ ] Existe `GET /users/:userId/characters` que devolve os personagens do usuário, cada um com `currentAdventure` (`{ id, title }` ou `null`), num único request.
- [ ] Ao entrar, o hub decide o que mostrar a partir da **resposta da API** (personagens do usuário), não do `localStorage`.
- [ ] Sem personagens, o jogador vê o convite de criação e o botão **Criar meu personagem** leva ao assistente (US-26).
- [ ] Com pelo menos um personagem, o jogador vê nome + resumo (raça · classe · nível) e, se houver, o título da **aventura em andamento**.
- [ ] **Continuar jogando** retoma a aventura em andamento do personagem em foco (US-29); fica desabilitado/oculto se esse personagem não tem aventura aberta.
- [ ] **Criar novo personagem** leva ao assistente (US-26) a partir da etapa de Sistema.
- [ ] Com mais de um personagem, o **último jogado** entra em foco por padrão, existe **Ver todos os personagens** e trocar o foco muda qual aventura "Continuar jogando" retoma.
- [ ] Se a busca falhar, o jogador vê uma mensagem de erro (com opção de tentar de novo), não uma tela vazia que parece "sem personagem".
- [ ] ⤷US-24 — Entrar de um navegador **sem** `localStorage` da sessão, mas com personagens no servidor, mostra o estado 2a (com personagem) — não o estado vazio. *(Só alcançável com login; sem US-24 o hub identifica o usuário pelo `userId` local.)*
- [ ] **Eval / teste de regressão (endpoint):** para um usuário com um personagem que iniciou uma aventura, `GET /users/:userId/characters` devolve esse personagem com `currentAdventure` preenchido; para um usuário sem personagens, devolve `[]`.
- [ ] **Eval / teste de regressão (hub):** para um usuário com um personagem que tem aventura em andamento, o hub renderiza o nome do personagem e o título da aventura e o botão **Continuar jogando** aponta para essa aventura; para um usuário sem personagens, renderiza o convite de criação.

---

## Notas de implementação

- **Endpoint:** adicionar em `campaign.controller.ts`/serviço um `findCharactersByUser(userId)` que faz um `findMany` de `Character` com `include` da(s) `Adventure` (a mais recente → `currentAdventure`). Uma query só, sem loop por personagem.
- **"Último jogado"** = maior `CharacterState.updatedAt` do personagem (`@updatedAt`, bumpa a cada turno). Ordenar por ele desc; personagem sem estado (nunca jogou) cai por último, ordenado por `createdAt` desc. Um `orderBy` na relação resolve — sem cache local.
- **"Aventura em andamento"** = a `Adventure` do personagem com `status = ACTIVE` (o enum já existe). No MVP é uma só; se houver mais de uma ACTIVE, desempata pela **mais recente** (mesmo critério de "último jogado": maior `CharacterState.updatedAt`, caindo em `Adventure.createdAt` desc).
- Substituir a lógica de `HomeHero` que lê `loadSession()` por um `useEffect` que chama o novo cliente `api.listCharacters(userId)` e guarda em `useState` (mesmo padrão do `useEffect` proposto na US-20 para `listSystems`).
- Reusar os estilos/estrutura já existentes em `HomeHero.tsx` (saudação, botão primário âmbar, botão secundário contornado); as ramificações de UI já estão quase todas lá, muda a **fonte** dos dados.
- O `userId` vem da sessão autenticada de US-24; enquanto US-24 não existir, dá para pontuar com o `userId` que já é gravado no `localStorage` hoje — mas o *branch vazio/preenchido* deve vir da API, não do blob local.
- `localStorage` pode continuar como **cache/atalho** (último personagem em foco), nunca como fonte de verdade do "tenho ou não personagem".
- Ficha (US-19) e histórico (US-18) **não** são carregados aqui — só ao entrar na aventura (US-29).

---

## Questões em aberto

Nenhuma pendente. (Desempate de múltiplas aventuras ACTIVE por personagem → mais recente; relaciona com US-22 mas não bloqueia esta story.)

---

## Referências no código

- `apps/web/src/components/HomeHero.tsx` — hub atual; hoje ramifica por `session?.adventureId` do `localStorage`. É o arquivo principal a tocar.
- `apps/web/src/lib/session.ts` — `loadSession`/`saveSession`; passa a cache opcional, deixa de ser fonte de verdade.
- `apps/web/src/lib/api.ts` — só tem `getCharacter(id)`; falta um `listCharacters(userId)` (a criar).
- `apps/web/src/app/page.tsx` — monta `HomeHero`.
- `apps/api/src/campaign/campaign.controller.ts` — onde entraria o endpoint de listagem de personagens do usuário.
- [`Fluxo de criação de personagem RPG - standalone.html`](./Fluxo%20de%20cria%C3%A7%C3%A3o%20de%20personagem%20RPG%20-%20standalone.html) — protótipo do design; telas **1a/2** (vazio) e **2a/2** (com personagem) são as cobertas por esta story.
