# US-216 — Escolher entre aventura pronta (gancho por classe) ou criar a própria história

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada (05/09/2026)
**Depende de:** [US-157](./US-157-tela-de-mundo-depois-da-revisao.md) (✅ — passo `world` existente, que esta story bifurca) · [US-153](./US-153-aventura-deixa-de-ser-derivada-da-classe.md) (✅ — motor de geração, que esta story NÃO reverte)
**Criada em:** 2026-09-05

---

> ⚠️ **Esta story reabre uma decisão de produto fechada duas vezes.**
> [backlog-aventuras-autorais-lazygm.md §Uma campanha só para todas as classes](./backlog-aventuras-autorais-lazygm.md)
> registra, em 06/08/2026 e reafirmado em 07/08/2026: *"Não existe US de seleção de aventura.
> Sem escolha, não há o que exibir."* Esta story pede exatamente essa escolha de volta. O pedido
> partiu da premissa de que os "13 aventuras por classe" da [US-28](./US-28-aventura-inicial-baseada-na-classe.md)
> ainda são aventuras completas e escolhíveis — não são: a [US-153](./US-153-aventura-deixa-de-ser-derivada-da-classe.md)
> (implementada 2026-08-18) e a [US-155](./US-155-aposentar-quest-fixa-por-classe.md) já reduziram
> cada gancho a `id`/`title`/`classKey`/`pitch`/`openingNarration`/`tags` — um parágrafo de abertura,
> sem quest, sem locais, sem NPCs. **O escopo abaixo reabre só a decisão de PRODUTO (existir uma
> tela de seleção)**, não a de ENGENHARIA da US-153 (aventura sempre gerada, por personagem,
> determinística) — ver *A proposta*.

---

## História

> **Como** jogador terminando a criação do personagem,
> **quero** escolher entre partir de uma abertura pronta (uma das ganchos por classe/tema já
> escritos) ou configurar cenário/tom/área do zero,
> **para que** eu possa jogar rápido com uma premissa testada ou moldar a história do meu jeito,
> sem as duas opções se misturarem numa tela só.

---

## Contexto e motivação

### O problema observado

O passo `world` do `SetupWizard` ([SetupWizard.tsx:1434-1465](../../../apps/web/src/components/setup/SetupWizard.tsx))
hoje é uma tela só: três grupos de rádio (Cenário/Tom/Tipo de Área) + o toggle de Desafio, todos
alimentando o mesmo `CreateAdventureDto` que sempre passa pelo motor de geração
([US-153](./US-153-aventura-deixa-de-ser-derivada-da-classe.md)). Não há atalho — quem só quer
começar a jogar com uma premissa pronta enfrenta a mesma tela de configuração de quem quer
desenhar cenário/tom/área nos mínimos detalhes.

### Por que a solução atual não basta

`buildAdventureProfile` ([adventure.service.ts:144](../../../apps/api/src/adventure/adventure.service.ts))
resolve o `hookSeed` chamando `resolveInitialHook(config, character.class)` — **sempre pela classe
do personagem**, sem opção do jogador. O gancho vira só o pano de fundo (`hookSeed`) da aventura
gerada; o jogador nunca vê nem escolhe qual dos 13 ganchos o define. Não existe caminho de "menos
cliques, premissa pronta" — o passo `world` é sempre o de configuração fina.

### A proposta

Bifurcar o passo `world` em duas escolhas no topo, antes dos grupos de opção existentes:

1. **"Aventura pronta"** — mostra, como cartão único, o gancho **da classe do personagem**
   (título + `pitch`, o mesmo que `resolveInitialHook(config, character.class)` já resolveria no
   backend) e pula direto para "Criar aventura" — sem tocar em Cenário/Tom/Área/Desafio, todos
   ficam Aleatório/`adventure` (comportamento padrão que a tela já tem quando nada é escolhido).
2. **"Criar minha história"** — é a tela `world` de hoje, sem mudança: os três grupos de opção +
   Desafio.

**Achado que simplifica o escopo (2026-09-05):** decidido que o ramo "pronta" mostra só o gancho
da classe do jogador (não o catálogo inteiro de 12 classes + `default`) — então o gancho mostrado
é **exatamente o mesmo** que `resolveInitialHook(config, character.class)` já produz sempre, hoje,
para os dois ramos — o `hookSeed` do motor de geração **nunca dependeu** de nada que
o passo `world` envia; ele já vem só da classe, em `buildAdventureProfile`
([adventure.service.ts:144](../../../apps/api/src/adventure/adventure.service.ts)), antes desta
story e depois dela. Logo: **nenhum campo novo no `CreateAdventureDto`, nenhuma mudança de
backend.** "Aventura pronta" e "Criar minha história" chegam ao mesmo `createAdventure` com o
mesmo formato de payload — a diferença inteira é a experiência do passo `world`: um cartão de
prévia + atalho vs. a tela de configuração completa. O motor de geração
([US-153](./US-153-aventura-deixa-de-ser-derivada-da-classe.md)) continua rodando idêntico nos
dois casos, aventura sempre gerada e determinística por `characterId` + `order`.

---

## Escopo

### Dentro do escopo

- **Sub-passo de bifurcação no início de `world`**: dois cartões — "Aventura pronta" /
  "Criar minha história" — como o primeiro conteúdo do passo, antes de qualquer grupo de opção.
  Estado local novo (ex.: `worldMode: 'ready' | 'custom' | null`), inicia sem seleção — o jogador
  precisa escolher um dos dois antes de ver o resto da tela (nenhum padrão pré-selecionado, ao
  contrário dos grupos internos que já defendem "Aleatório" como padrão).
- **Ramo "Aventura pronta"**: mostra um cartão único de prévia com o gancho da classe do
  personagem — `title` + `pitch` resolvidos de `system.config.initialAdventures.hooks` (já chega
  ao client via `GET /systems`, [api.ts:94](../../../apps/web/src/lib/api.ts); busca por
  `classKey === charData.class` com fallback `'default'`, mesma regra de
  `resolveInitialHook` — ver *Notas de implementação* sobre duplicar essa função no client).
  Nenhum grupo de Cenário/Tom/Área/Desafio aparece neste ramo — botão final ("Criar aventura")
  chama `api.createAdventure` com o payload já-vazio de sempre (nenhum campo enviado).
- **Ramo "Criar minha história"**: reaproveita a tela `world` atual sem alteração de comportamento
  — os três `WorldOptionGroup` + `ChallengeOptionGroup` já implementados.
- **Nenhum campo novo no `CreateAdventureDto`, nenhuma mudança de backend** — ver *Achado que
  simplifica o escopo* em *A proposta*. `resolveInitialHook(config, character.class)` já é o único
  caminho de resolução de `hookSeed`, hoje e depois desta story.
- **Chaves de i18n novas em `setup.world.mode.*`**, nos dois locales, seguindo o padrão do resto
  do wizard.
- Continua valendo [US-46](./US-46-acessibilidade-wcag-aa.md) (WCAG AA) e
  [US-66](./US-66-telas-mobile-friendly.md) (mobile) — sem exceção para o sub-passo novo.
- Nenhuma string literal solta no JSX ([US-102](./US-102-gate-de-string-literal-no-jsx.md)).

### Fora do escopo

- **Reverter a US-153.** A aventura continua sempre gerada pelo motor nos dois ramos — isto NÃO
  reintroduz nenhum caminho de aventura fixa/estática. Nada no `hookSeed` muda de fonte; ele
  sempre veio, e continua vindo, só da classe.
  **É por isso que esta reabertura é mais estreita que a decisão original do backlog** — a
  decisão fechada falava em não ter tela de seleção *de aventura*; o que existe pra ver aqui é só
  a *prévia do gancho já automático*, a aventura em si nunca deixa de ser gerada nem muda de fonte.
- **Aventuras autorais completas (Pegāna/*O Lamento*)** — continuam adiadas para a fase 4
  ([backlog-aventuras-autorais-lazygm.md §Adiado para a fase 4](./backlog-aventuras-autorais-lazygm.md)).
  "Aventura pronta" aqui é "prévia do gancho da classe", não "campanha escrita à mão".
- **Mostrar ganchos de outras classes, ou permitir escolher um gancho diferente do da própria
  classe.** Decidido (2026-09-05): o ramo "pronta" mostra só o gancho da classe do personagem —
  catálogo completo/escolha livre de gancho fica fora.
- **Mostrar `openingNarration` completo no cartão de prévia.** Decidido (2026-09-05): só `pitch`
  (uma frase) — `openingNarration` fica reservado pra primeira cena narrada in-game, mostrá-lo
  antes seria spoiler.
- **Disponibilizar o toggle "Desafio" no ramo "pronta".** Decidido (2026-09-05): fica fora — fixo
  em `adventure`, sem aparecer. Desafio não se aplica às aventuras de classe; "pronta" é *zero*
  configuração, escolher risco de combate é parte de "criar minha história".
- **Mudar o mapeamento `Quest.title`/`Quest.description`** — continuam vindo do artefato gerado
  (`adventure.summary`/`adventure.start`, US-153), sem relação com este passo.

---

## Modelo de dados proposto

> Sem schema novo, sem campo novo no `CreateAdventureDto` — ver *Achado que simplifica o escopo*
> em *A proposta*. Esta story é só o passo `world` do `SetupWizard` ganhando um sub-estado de UI
> (`worldMode`) client-side; nada novo cruza a rede.

```ts
// apps/web/src/components/setup/SetupWizard.tsx — estado novo, só do client
type WorldMode = 'ready' | 'custom' | null
const [worldMode, setWorldMode] = useState<WorldMode>(null)
```

**Persistência:** nenhuma — `worldMode` vive só no componente, como `setting`/`tone`/`areaType`
já vivem hoje (US-157); nunca é enviado ao backend.

---

## Critérios de aceite

- [x] O passo `world` mostra, como primeiro conteúdo, dois cartões: "Aventura pronta" e "Criar minha história" — nenhum grupo de opção visível antes dessa escolha.
- [x] Selecionar "Aventura pronta" mostra um cartão de prévia com o gancho da classe do personagem (`title` + `pitch`, placeholders resolvidos) e o botão "Criar aventura" direto — nenhum grupo Cenário/Tom/Área/Desafio aparece neste ramo.
- [x] Confirmar no ramo "pronta" chama `api.createAdventure` com o mesmo payload vazio que o ramo "criar" envia hoje quando tudo fica em Aleatório — nenhum campo novo, nenhuma diferença de contrato entre os dois ramos.
- [x] Selecionar "Criar minha história" mostra exatamente a tela `world` de hoje (três grupos + Desafio) — comportamento idêntico ao pré-existente, sem regressão.
- [x] O gancho mostrado no cartão de prévia é o mesmo que `resolveInitialHook(config, character.class)` resolveria no backend (classe do personagem, com fallback `default`) — sem duplicar regra divergente no client.
- [x] A aventura continua sendo sempre gerada pelo motor (US-153) nos dois ramos, sem nenhuma mudança de comportamento do backend — confirmável por `git diff` não tocando `apps/api/src/adventure/`.
- [x] Todo texto novo vem de `setup.world.mode.*` (dicionário), nos dois locales — gate US-102.
- [x] Passa critérios de acessibilidade (US-46) e mobile (US-66) para o sub-passo novo.
- [x] `pnpm typecheck` e `pnpm test` passam.
- [x] **Eval / teste de regressão:** teste de componente que seleciona "Aventura pronta" e confirma que o cartão de prévia mostra `title`/`pitch` do gancho da classe atual do personagem (não de outra classe, não o catálogo inteiro); teste que confirma que o DTO final enviado por "pronta" é idêntico ao enviado por "criar" sem tocar em nenhum grupo.

---

## Notas de implementação

- **`resolveInitialHook` só existe em `apps/api/src/character/starting-inventory.ts`**, com o
  comentário explícito de que "web não importa de apps/api"
  ([starting-inventory.ts:5-7](../../../apps/api/src/character/starting-inventory.ts)). O cartão
  de prévia precisa da MESMA regra (`classKey === charData.class`, fallback `'default'`) rodando
  no client — duas opções: duplicar a função de 4 linhas localmente em `SetupWizard.tsx` (mais
  simples, risco de drift se a regra mudar num lado só) ou mover `resolveInitialHook` para
  `packages/shared` (sem risco de drift, toca um módulo que hoje é deliberadamente API-only).
  Recomendação: duplicar — a função é pequena e estável (não muda desde a US-54), e mover módulo
  de casa é escopo maior que esta story pede.
- **`resolveHookTemplate`** (mesmo arquivo, placeholders `{characterName}`/`{characterClass}`)
  tem o mesmo problema de fronteira — o cartão de prévia precisa exibir o `pitch` já com o nome
  do personagem, e `charData.name` já está disponível no componente (passo `background`/`review`
  já usa). Mesma recomendação: duplicar a função (troca de regex, 5 linhas).
- **`optionCardClass`** ([SetupWizard.tsx:74-80](../../../apps/web/src/components/setup/SetupWizard.tsx))
  é o precedente visual — mesmos cartões usados em `race-class`, reusar para o par
  "pronta"/"criar" e para o cartão de prévia do gancho.
- **`system.config.initialAdventures`** já chega pronto no client via `GET /systems`
  ([api.ts:94](../../../apps/web/src/lib/api.ts)) — não precisa de endpoint novo nem de mudança
  no shape do `SystemOption` já carregado em `system` ([SetupWizard.tsx:240](../../../apps/web/src/components/setup/SetupWizard.tsx)).

---

## Questões em aberto

_Nenhuma questão em aberto remanescente._

---

## Referências no código

- [apps/web/src/components/setup/SetupWizard.tsx:34-35](../../../apps/web/src/components/setup/SetupWizard.tsx) — `Step`/`steps`, sem mudança de posição — o passo `world` continua único, ganha sub-estado interno.
- [apps/web/src/components/setup/SetupWizard.tsx:1434-1465](../../../apps/web/src/components/setup/SetupWizard.tsx) — corpo atual do passo `world`, que vira o ramo "Criar minha história".
- [apps/web/src/components/setup/SetupWizard.tsx:240](../../../apps/web/src/components/setup/SetupWizard.tsx) — `system`, de onde `system.config.initialAdventures.hooks` é lido para o cartão de prévia.
- [apps/web/src/lib/api.ts:94](../../../apps/web/src/lib/api.ts) — `GET /systems`, já devolve `initialAdventures` dentro de `config` (sem endpoint novo).
- [apps/api/src/character/starting-inventory.ts:15-29](../../../apps/api/src/character/starting-inventory.ts) — `resolveInitialHook`/`resolveHookTemplate`, a regra que o cartão de prévia duplica no client (ver *Notas de implementação*).
- [apps/api/src/adventure/adventure.service.ts:144](../../../apps/api/src/adventure/adventure.service.ts) — `buildAdventureProfile`, prova de que `hookSeed` já vem só da classe, sem depender de nada que o passo `world` envia — a base do achado que zera as mudanças de backend desta story.
- [apps/api/prisma/initial-adventures.ts](../../../apps/api/prisma/initial-adventures.ts) — os 13 ganchos por locale, catálogo consumido pelo ramo "pronta" (só a entrada da classe do personagem é exibida).
- [packages/shared/src/types/system.ts:189-201](../../../packages/shared/src/types/system.ts) — `InitialAdventureHookSchema`, forma de cada gancho (sem quest primária desde a US-155).
- [US-153](./US-153-aventura-deixa-de-ser-derivada-da-classe.md) — decisão de engenharia que esta story preserva intacta (aventura sempre gerada, zero mudança de backend).
- [backlog-aventuras-autorais-lazygm.md §Uma campanha só para todas as classes](./backlog-aventuras-autorais-lazygm.md) — a decisão de produto que esta story reabre, e por que a reabertura é mais estreita do que parece.
