# US-19 — Estado de ficha legível e sincronizado via API

**Épico:** 1 — Personagem
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** nenhuma (o `CharacterState` já persiste hp/inventário)
**Criada em:** 2026-06-30

---

## História

> **Como** jogador,
> **quero** que a ficha na barra lateral (HP, inventário, condições) reflita o estado real persistido no servidor durante o jogo,
> **para que** o que vejo na ficha seja sempre verdade e não um valor preso do momento em que abri a tela.

---

## Contexto e motivação

### O problema observado

A barra lateral do `GameView` mostra HP, atributos e inventário, mas:

1. **O HP nunca muda na tela.** O `GameView` tem `currentHp`/`setCurrentHp` (`GameView.tsx:54`), mas `setCurrentHp` **nunca é chamado** — a barra de vida fica congelada no valor que veio no carregamento, mesmo que o personagem leve dano durante a narração.
2. **O inventário só muda por um canal lateral.** Ele é atualizado por linhas `I:` embutidas no stream de chat (`ai.controller.ts`), não por uma API de estado da ficha. O componente da ficha não tem uma API própria para ler/sincronizar o estado.

Resultado: a ficha não tem "relação direta com uma API". Ela é alimentada metade por props da carga inicial, metade por um efeito colateral do stream de IA.

### Por que a solução atual não basta

O dado correto **já existe** no `CharacterState` (`hp`, `maxHp`, `inventory`, `conditions`), e o `PlayPage` até o lê uma vez via `GET /characters/:id` ao montar. Mas durante o jogo o estado muda no servidor e o cliente nunca re-sincroniza, exceto pelo hack das linhas `I:` para inventário. Não há canal coerente: HP fica órfão, condições nem aparecem.

### A proposta

Tratar o `CharacterState` como a fonte de verdade única da ficha e dar à UI um canal coerente para o estado **mutável** (HP, inventário, condições) durante o turno — em vez de o HP depender de nada e o inventário depender de uma linha avulsa no stream.

---

## Escopo

### Dentro do escopo

- Um canal coerente de atualização do estado mutável da ficha (HP, inventário, condições) ao longo do turno, a partir do `CharacterState` no servidor.
- `GameView` reflete HP atualizado (a barra de vida muda quando o personagem toma dano/cura) e condições, além do inventário que já atualiza.
- Endpoint de leitura do estado por `(characterId, adventureId)`, se for o caminho escolhido para sincronizar.

### Fora do escopo

- Edição manual da ficha pelo jogador (mexer no HP à mão) — a fonte é a mecânica de jogo, não input livre.
- Atributos-base mutáveis (level up, ganho de atributo) — `baseAttributes` é estável no MVP.
- Renderização do `sceneState` (isso é US-11b).

### A decisão de canal (ver Questões em aberto)

Duas formas de fechar o gap, a escolher na implementação:

- **A — Estender o canal de stream já existente:** assim como o inventário já vai por linha `I:`, emitir HP e condições pelo mesmo mecanismo (ex.: linha `H:` / `C:`). Menor diff; mantém tudo num canal só durante o turno.
- **B — Endpoint de estado dedicado:** `GET /characters/:id/state?adventureId=` e o `GameView` re-busca ao fim de cada turno. Mais alinhado ao princípio "componente ↔ API", à custa de um round-trip por turno.

Recomendação: **A** para a sincronização ao vivo (já há infra), **mais** o endpoint de leitura de B para a carga inicial robusta e para qualquer reabertura da tela.

---

## Modelo de dados proposto

> Nenhum dado novo. Reaproveita o `CharacterState` existente (`hp`, `maxHp`, `inventory`, `conditions`).

| Campo | Tipo | Descrição |
|---|---|---|
| `hp` / `maxHp` | int | Vida atual e máxima — alimenta a barra de HP. |
| `inventory` | `{ name, qty }[]` | Já renderizado hoje; passa a vir pelo mesmo canal coerente. |
| `conditions` | string[] | Condições ativas (envenenado, atordoado…); hoje não aparecem na UI. |

**Persistência:** nenhuma nova — `CharacterState` já é a granularidade `(characterId, adventureId)` correta.

---

## Critérios de aceite

- [ ] Quando o personagem toma dano ou é curado durante a narração, a barra de HP no `GameView` atualiza sem recarregar a página.
- [ ] O inventário continua a atualizar ao longo do turno (sem regressão face ao comportamento atual).
- [ ] As condições ativas (`conditions`) do `CharacterState` ficam visíveis na ficha.
- [ ] Reabrir a tela de jogo (refresh / outro dispositivo) mostra HP, inventário e condições conforme o `CharacterState` persistido — não valores presos.
- [ ] O `setCurrentHp` deixa de ser código morto: ou é usado, ou o estado de HP é gerido por um único caminho coerente.
- [ ] **Eval / teste de regressão:** num turno em que a mecânica reduz o HP (ex.: tomar dano de um goblin), o valor de HP exibido após o turno é igual ao `CharacterState.hp` persistido no servidor.

---

## Notas de implementação

- O inventário já flui por `I:` no `ai.controller.ts` a partir do `tool-result` de `updateInventory`. O caminho de menor diff é emitir HP/condições do mesmo modo quando a tool de HP roda (ver `updateCharacterHp` em `ai.service.ts`).
- `currentHp` no `GameView` já existe; basta ligá-lo ao canal (hoje fica congelado).
- Se optar pelo endpoint dedicado, ele é um `findUnique` em `CharacterState` por `(characterId, adventureId)` — espelha o que o `PlayPage` já faz via `GET /characters/:id`.
- Evitar dois sistemas concorrentes de verdade: escolher um canal para o ao-vivo e não deixar HP atualizar por um lado e inventário por outro de formas divergentes.

---

## Questões em aberto

1. Canal A (estender o stream) vs B (endpoint + re-fetch por turno) vs ambos? (Recomendação: A para ao-vivo + B para carga/reabertura.)
2. As condições precisam de ícones/labels amigáveis na UI ou basta o texto cru por enquanto?

---

## Referências no código

- `apps/web/src/components/game/GameView.tsx` — `currentHp`/`setCurrentHp` (morto), tratamento da linha `I:`, sidebar da ficha.
- `apps/web/src/app/play/[adventureId]/page.tsx` — carga inicial via `GET /characters/:id`.
- `apps/api/src/ai/ai.controller.ts` — emissão da linha `I:` no stream; ponto de extensão para HP/condições.
- `apps/api/src/ai/ai.service.ts` — tool de atualização de HP / inventário.
- `apps/api/prisma/schema.prisma` — `CharacterState` (`hp`, `maxHp`, `inventory`, `conditions`).
