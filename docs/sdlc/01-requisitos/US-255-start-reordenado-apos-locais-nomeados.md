# US-255 — `start` reordenado no schema de autoria: gancho escrito depois de locais nomeados

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** [US-232](./US-232-schema-cresce-e-prompt-de-autoria-call-unico.md) (`AUTHORING_SCHEMA`/`buildAuthoringPrompt`, o schema que esta story reordena)
**Relacionado:** [US-245](./US-245-abertura-narra-start-autorado-quase-verbatim.md) (a abertura narrada já é quase-verbatim do `start`) · [US-256](./US-256-jogador-entra-no-chat-antes-do-resto-da-aventura-gerar.md) (consome esta reordenação pra liberar o jogador mais cedo — story separada, não bloqueia esta)
**Criada em:** 2026-09-17 — decidida nesta conversa: ponto de reordenação do campo `start` no schema de autoria, separada da story de liberação antecipada (US-256) pra não bloquear uma coisa pronta atrás de uma decisão em aberto.

---

## História

> **Como** jogadora,
> **quero** que o gancho da aventura (`start`) seja escrito depois que o mundo, as facções, os NPCs e os locais já têm nome,
> **para que** o gancho cite gente e lugar concretos ("NPC X, na Torre de Ashra, pede ajuda contra a facção Y") em vez de ficar genérico, e não vaze o desfecho (objetivo/recompensa/fecho ramificado) que ainda nem foi escrito.

---

## Contexto e motivação

### Onde `start` está hoje

`AUTHORING_SCHEMA` ([ai.service.ts:114-172](../../../apps/api/src/ai/ai.service.ts)) declara os campos nesta ordem: `world` → `summary` → `story` → `factions` → `npcs` → `locations` → `challenges` → `encounters` → `objective` → `branchedResolution` → `start` → `followUps`. `start` (descrito como "SÓ o gancho — a última parte da Story") só é escrito depois de TODA a estrutura mecânica da aventura — inclusive `objective`/`branchedResolution`, que descrevem o desfecho.

### Por que a posição importa

`generateAdventureAuthoring` usa `generateObject` ([ai.service.ts:1571](../../../apps/api/src/ai/ai.service.ts)) — o modelo escreve os campos na ordem declarada do schema (a saída é gerada sequencialmente, mesmo saindo de uma vez só no fim). A posição de `start` decide QUANTO material nomeado o modelo já tem na mão quando escreve o gancho:

- **Logo após `story` (a posição mais cedo cogitada):** só existe `world.anchors` (locais-âncora nomeados) como nome concreto — nenhuma facção/NPC tem nome ainda. Gancho sai sem "quem pede"/"quem ameaça", só lugar — mais genérico.
- **Logo após `npcs` (antes de `locations`):** já tem facção (nome+want) e NPC (nome+want) — dá pra escrever "NPC X pede ajuda porque facção Y quer Z", mas ainda sem local nomeado.
- **Logo após `locations` (a posição escolhida):** tem facção, NPC E local nomeados — gancho pode citar os três. E ainda não viu `challenges`/`encounters`/`objective`/`branchedResolution` — zero risco do desfecho vazar pro texto de abertura.

A posição depois de `locations`, antes de `challenges`, é o ponto de equilíbrio: material suficiente pra não ser genérico, sem carregar o resto da estrutura mecânica que o gancho não precisa referenciar.

---

## Escopo

### Dentro do escopo

- Mover o campo `start` no `AUTHORING_SCHEMA` pra logo após `locations` (linha 141), antes de `challenges` (linha 142).
- Revisar a `describe()` do campo ("SÓ o gancho — a última parte da Story") — conferir se a instrução ainda faz sentido na nova posição ou se precisa de ajuste de redação (ex.: deixar claro que é a última parte da Story, mesmo sem ser o último campo do schema).
- Teste de regressão: ordem das chaves de `AUTHORING_SCHEMA` tem `start` entre `locations` e `challenges` (via `Object.keys(AUTHORING_SCHEMA.shape)` ou fixture).
- `pnpm typecheck`, `pnpm test` e `pnpm eval` passam sem regressão de qualidade da prosa gerada.

### Fora do escopo

- **Liberar o jogador pra tela de chat antes do resto da aventura terminar** — story separada, [US-256](./US-256-jogador-entra-no-chat-antes-do-resto-da-aventura-gerar.md). Esta story só reordena o campo; a chamada continua `generateObject` (bloqueante, devolve tudo de uma vez).
- **Trocar `generateObject` por `streamObject`** — só teria efeito prático combinado com US-256; sozinha, reordenar o campo não muda quando o app enxerga o resultado (a `Promise` só resolve com o objeto inteiro do mesmo jeito).
- **Mudar o conteúdo de `generateOpeningNarration`/`extractOpeningScene`** — não mexem no `AUTHORING_SCHEMA`.

---

## Critérios de aceite

- [ ] `start` aparece entre `locations` e `challenges` na definição de `AUTHORING_SCHEMA`.
- [ ] Teste de regressão cobre a ordem das chaves do schema.
- [ ] `pnpm typecheck`, `pnpm test` e `pnpm eval` passam.
- [ ] **Eval / teste de regressão:** perfil pinado gera aventura cujo `start` referencia pelo menos um nome próprio (facção, NPC ou local) já autorado — não um gancho genérico sem nome (ex.: "algo ameaça a região").

---

## Notas de implementação

- **Mudança de ordem de chave em `z.object`, não de tipo/shape** — nenhum código downstream depende da ordem das propriedades (minting em `adventure.service.ts` acessa `authored.start` por nome, não por posição); a troca é só de instrução ao modelo, sem risco de quebra de tipo.
- ai-engine roda de `dist` — `pnpm --filter @ai-dm/ai-engine build` depois de editar `src`, se algum trecho do prompt compartilhado mudar junto.

---

## Referências no código

- [`apps/api/src/ai/ai.service.ts:114-172`](../../../apps/api/src/ai/ai.service.ts) — `AUTHORING_SCHEMA`, campo a reordenar.
- [`apps/api/src/ai/ai.service.ts:170`](../../../apps/api/src/ai/ai.service.ts) — `start: z.string()...`, a linha que move de posição.
- [US-256](./US-256-jogador-entra-no-chat-antes-do-resto-da-aventura-gerar.md) — consome esta reordenação pra liberar o jogador mais cedo.
- [US-245](./US-245-abertura-narra-start-autorado-quase-verbatim.md) — por que `start` já é quase o texto que o jogador lê.
