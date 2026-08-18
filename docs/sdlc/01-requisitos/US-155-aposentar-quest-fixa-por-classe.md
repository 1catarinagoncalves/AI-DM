# US-155 — Aposentar a quest fixa por classe

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada (2026-08-18)
**Depende de:** [US-153](./US-153-aventura-deixa-de-ser-derivada-da-classe.md) (a quest primária já vem do artefato gerado, não mais do gancho)
**Relacionado:** [Backlog — Motor de geração de aventuras one-shot](./backlog-motor-de-geracao-de-aventuras.md) (US-155) · [ADR 012](../../adr/012-aventura-gerada-como-dado.md) (resolve rótulos `GEN-N` do backlog para número de story) · [US-89](./US-89-gate-de-codigo-morto-com-knip.md) (o gate que pegaria os campos se eles sobrevivessem mortos) · [initial-adventures.ts](../../../apps/api/prisma/initial-adventures.ts) (os 13 ganchos, onde os campos vivem)
**Criada em:** 2026-08-15

---

## História

> **Como** mantenedora,
> **quero** remover `primaryQuestTitle`/`primaryQuestDescription` dos 13 ganchos de classe depois que a quest primária passar a vir da aventura gerada,
> **para que** esses dois campos não sobrevivam como código morto que o gate da US-89 pegaria depois, e ninguém confunda o texto fixo com a fonte de verdade da quest.

---

## Contexto e motivação

### O problema observado

A [US-153](./US-153-aventura-deixa-de-ser-derivada-da-classe.md) troca a fonte de `Quest.title`/`Quest.description` do hook fixo para o artefato gerado — mas, sem esta story, `primaryQuestTitle`/`primaryQuestDescription` continuam existindo em `InitialAdventureHookSchema` e nos 13 ganchos de [initial-adventures.ts](../../../apps/api/prisma/initial-adventures.ts), sem nenhum consumidor. Campo morto que sobrevive é exatamente o defeito que o [gate de knip](./US-89-gate-de-codigo-morto-com-knip.md) foi criado para pegar — melhor removê-lo deliberadamente do que deixar o gate reclamar depois.

### Por que a solução atual não basta

`resolveHook` ([adventure.service.ts:64-74](../../../apps/api/src/adventure/adventure.service.ts)) hoje resolve os cinco campos do hook, incluindo os dois de quest, via `resolveHookTemplate` (substituição de `{characterName}`/`{characterClass}`). Depois da US-153, ninguém mais lê o resultado resolvido desses dois campos — mas o código de resolução continuaria rodando (trabalho descartado) e o dado continuaria nos 13 ganchos × 2 locales (26 entradas de texto morto, en-US + pt-BR).

### A proposta

Remover `primaryQuestTitle`/`primaryQuestDescription` de `InitialAdventureHookSchema` e dos 13 ganchos em cada locale, deixando o resto do gancho (`openingNarration`, `tags`) intacto — é entrada da [US-148](./US-148-perfil-personagem-entrada-motor.md), continua vivo.

---

## Escopo

### Dentro do escopo

- **`InitialAdventureHookSchema`** ([system.ts:136-146](../../../packages/shared/src/types/system.ts)) perde `primaryQuestTitle`/`primaryQuestDescription`.
- **Os 13 ganchos em `initial-adventures.ts`** (en-US e pt-BR, dois arquivos ou duas seções — confirmar estrutura real do arquivo) perdem os dois campos de cada entrada.
- **`resolveHook`** ([adventure.service.ts:64-74](../../../apps/api/src/adventure/adventure.service.ts)) para de resolver os dois campos removidos — só `title`, `pitch`, `openingNarration` continuam passando por `resolveHookTemplate`.
- **`getInitialAdventure`** (endpoint que expõe o hook resolvido à UI, [adventure.service.ts:45-62](../../../apps/api/src/adventure/adventure.service.ts)) para de devolver os dois campos — checar se algum componente web (`apps/web`) os lê antes de remover do DTO exposto.
- **Roda o gate de knip** ([US-89](./US-89-gate-de-codigo-morto-com-knip.md)) depois da remoção, confirmando que nenhuma referência morta sobrou.
- **Os 3 arquivos de teste que referenciam os dois campos** — fixtures tipadas contra `InitialAdventureHook`, quebram `pnpm typecheck` se não forem atualizadas junto:
  - [adventure.service.test.ts:57-64](../../../apps/api/src/adventure/adventure.service.test.ts) — fixtures de hook.
  - [starting-inventory.test.ts:12](../../../apps/api/src/character/starting-inventory.test.ts) — hook mínimo de teste.
  - [initial-adventures.test.ts:13](../../../apps/api/prisma/initial-adventures.test.ts) — `textFields` itera os dois campos.

### Fora do escopo

- **O resto do gancho** (`id`, `title`, `classKey`, `pitch`, `openingNarration`, `tags`) — permanece. `openingNarration` é entrada da [US-148](./US-148-perfil-personagem-entrada-motor.md) (`hookSeed`); os outros continuam servindo a resolução de gancho por classe (que não desaparece, só para de decidir a quest).
- **Migração de dados.** `initialAdventures` vive dentro de `System.config`/`configLocales` (Json), regenerado por seed — não há coluna de banco para migrar, só o artefato de config a re-semear (`pnpm db:seed`).
- **A UI que exibia a quest primária antes de a aventura começar** (se existir) — ajuste de UI para não quebrar visualmente é escopo de quem descobrir o consumidor ao rodar o gate desta story, não pré-planejado aqui.

---

## Modelo de dados proposto

```ts
// packages/shared/src/types/system.ts — InitialAdventureHookSchema, DEPOIS
export const InitialAdventureHookSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  classKey: z.string().min(1),
  pitch: z.string().min(1),
  // primaryQuestTitle e primaryQuestDescription REMOVIDOS — a quest vem do artefato gerado (US-153).
  openingNarration: z.string().min(1),
  tags: z.array(z.string()).default([]),
})
```

**Persistência:** `System.config`/`configLocales` (Json) — sem migração Prisma; requer `pnpm db:seed` para re-materializar o config sem os dois campos.

---

## Critérios de aceite

- [x] `InitialAdventureHookSchema` não tem mais `primaryQuestTitle`/`primaryQuestDescription`.
- [x] Os 13 ganchos em `initial-adventures.ts`, nos dois locales, não têm mais os dois campos.
- [x] `resolveHook` não resolve mais os dois campos removidos.
- [x] `getInitialAdventure` não expõe mais os dois campos no DTO devolvido à UI.
- [x] Nenhum consumidor morto (web ou API) referencia `primaryQuestTitle`/`primaryQuestDescription` depois da remoção — verificado pelo gate de knip ([US-89](./US-89-gate-de-codigo-morto-com-knip.md)).
- [x] `pnpm db:seed` roda sem erro e o config resultante não tem os dois campos — confirmado nos dois sistemas (Free, D&D 5e SRD) via query direta pós-seed.
- [x] `pnpm typecheck` e `pnpm test` passam.
- [x] **Eval / teste de regressão:** teste que valida `InitialAdventureHookSchema.parse()` de um gancho **sem** os dois campos ([initial-adventures.test.ts](../../../apps/api/prisma/initial-adventures.test.ts)); `pnpm dead` (knip) não acusa nenhum item novo na área tocada (os 2 achados pré-existentes — `RaceCatalogEntry`, `SystemBackgroundBenefit` — não são desta story).

---

## Notas de implementação

- **Ordem de execução:** esta story só faz sentido **depois** da US-153 trocar a fonte de `Quest.title`/`description` — remover os campos antes quebraria a criação de aventura (que ainda os leria).
- **`pnpm db:seed` precisa rodar** depois da mudança para o banco de dev/staging refletir o schema novo — mesma disciplina de qualquer mudança em `initial-adventures.ts` (US-101 documenta o mesmo requisito).
- **Confirmar consumidor na web antes de remover do DTO** — `getInitialAdventure` alimenta "a etapa Aventura inicial da UI antes de iniciar" (comentário em [adventure.service.ts:26-28](../../../apps/api/src/adventure/adventure.service.ts)); se algum componente exibir a quest ali, a remoção precisa de um ajuste correspondente na tela (fora do escopo desta story documentar qual, mas dentro do escopo não quebrar o build).

---

## Questões em aberto

1. ~~Existe hoje algum componente em `apps/web` que exibe `primaryQuestTitle`/`primaryQuestDescription` antes da aventura começar (ex.: uma prévia na tela de revisão)?~~ **Respondido:** não. `grep -i "primaryQuestTitle|primaryQuestDescription"` em `apps/web` não retorna nenhum resultado — os dois campos só aparecem em `apps/api`, `packages/shared` e docs. Remoção do DTO em `getInitialAdventure` não exige ajuste de tela.

---

## Referências no código

- [packages/shared/src/types/system.ts:136-146](../../../packages/shared/src/types/system.ts) — `InitialAdventureHookSchema`, os dois campos a remover.
- [apps/api/prisma/initial-adventures.ts](../../../apps/api/prisma/initial-adventures.ts) — os 13 ganchos, en-US e pt-BR.
- [apps/api/src/adventure/adventure.service.ts:45-74](../../../apps/api/src/adventure/adventure.service.ts) — `getInitialAdventure`, `resolveHook`, os pontos que param de resolver os campos removidos.
- [apps/api/src/adventure/adventure.service.test.ts:57-64](../../../apps/api/src/adventure/adventure.service.test.ts) — fixtures de hook a atualizar.
- [apps/api/src/character/starting-inventory.test.ts:12](../../../apps/api/src/character/starting-inventory.test.ts) — hook mínimo de teste a atualizar.
- [apps/api/prisma/initial-adventures.test.ts:13](../../../apps/api/prisma/initial-adventures.test.ts) — `textFields` a atualizar.
- [US-89](./US-89-gate-de-codigo-morto-com-knip.md) — gate que verifica ausência de referência morta.
- [Backlog — Motor de geração de aventuras one-shot §GEN-12](./backlog-motor-de-geracao-de-aventuras.md) (US-155) — texto de origem.
