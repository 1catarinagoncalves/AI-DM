# US-237 — Remove seed, rebaixa LGMRD, mantém Monster Builder

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** 📋 Proposta
**Depende de:** nada (limpeza). **Bloqueia:** [US-233](./US-233-numeros-dos-encontros-passo-2-5e.md) na parte do statblock (o `sync` do Monster Builder fica de pé).
**Relacionado:** [US-146](./US-146-seed-deterministico-motor-aventura.md) (seed a remover) · [US-147](./US-147-rolagem-registro-conteudo.md) (rolagem-espinha a remover) · [US-145](./US-145-sync-lgmrd-notice.md) (`sync` — metade Monster Builder fica, metade LGMRD rebaixa) · [ADR 012](../../adr/012-aventura-gerada-como-dado.md) (D1 — seed morto) · [Backlog — MA-7](./backlog-motor-de-geracao-de-aventuras.md)
**Criada em:** 2026-09-13

---

## História

> **Como** desenvolvedora,
> **quero** apagar o código de `seed`/rolagem que a inversão tornou morto e manter só o que o motor novo usa (statblocks do Monster Builder) —
> **para que** o repo não carregue duas espinhas de geração, e o gate de código morto (`pnpm dead`) fique limpo.

---

## Contexto e motivação

A inversão (ADR 012 D5) trocou "montar de tabela com `seed`" por "modelo autora". Isso deixa código órfão: `deriveAdventureSeed`/`createSeededRandom` (US-146) não têm mais o que semear (ADR 012 D1, seed morto), e a rolagem registro+conteúdo (US-147) foi substituída pela autoria. Mas nem tudo do `sync` (US-145) morre: a metade **Monster Builder** (`5e_Monster_Builder.json`) alimenta os statblocks do PASSO 2 (US-233) e **fica**. As 135 tabelas do LGMRD saem da espinha (o Spike gerou Khemsar-grade sem elas) — se viram inspiração no prompt ou saem de vez é decisão aberta.

---

## Escopo

### Dentro do escopo

- **Remover `deriveAdventureSeed` e `createSeededRandom`** ([packages/shared/src/adventure-seed.ts](../../../packages/shared/src/adventure-seed.ts)) — código morto pós-inversão (ADR 012 D1).
- **Remover a rolagem-espinha da US-147** (registro+conteúdo por rolagem) — o modelo autora, não rola tabela.
- **Passar no `pnpm dead`** (knip, US-89): nenhum export órfão sobra dessas remoções; grep confirma que nenhum consumidor lê `seed`.
- **Manter o `sync` do `5e_Monster_Builder.json`** (metade da US-145) — os statblocks que a US-233 consome.

### Fora do escopo

- **Se as 135 tabelas do LGMRD entram como inspiração no prompt ou saem de vez** — decisão aberta (ver *Questões em aberto*); esta story só as tira da **espinha** (não são mais roladas).
- **O PASSO 2 que usa o Monster Builder** — US-233/MA-3.
- **Migração de artefatos velhos** — não há (descartados, ADR 012 D6).

---

## Critérios de aceite

- [ ] `deriveAdventureSeed` e `createSeededRandom` removidos; `adventure-seed.ts` sai (ou fica vazio de exports vivos).
- [ ] A rolagem-espinha da US-147 removida; nenhum caminho de geração rola tabela pra montar registro/conteúdo.
- [ ] `pnpm dead` (knip) limpo — nenhum export/dep órfão das remoções.
- [ ] `pnpm typecheck` e `pnpm test` passam sem os símbolos removidos (nenhum call site esquecido).
- [ ] O `sync` do `5e_Monster_Builder.json` **continua** funcionando (statblocks disponíveis pra US-233).
- [ ] **Eval / regressão:** o suite existente que dependia de `seed` é removido ou reescrito (não há mais determinismo byte-a-byte a testar — repro vem do artefato congelado, ADR 012 D7).

---

## Notas de implementação

- Fazer as remoções **depois** que a US-232/233 não dependerem mais do caminho velho — ou o `pnpm dead` de outra story acusa antes da hora. É limpeza, roda quando o motor novo já produz.
- `Character.background` e o resto **não** dependem de `seed` — confirmar por grep antes de apagar (a remoção é segura só se nenhum consumidor vivo restar).
- shared roda de `dist` — buildar após remover.

---

## Questões em aberto

1. **As 135 tabelas do LGMRD: inspiração no prompt de autoria, ou saem de vez?** O Spike gerou Khemsar-grade **sem** elas. Medir se agregam antes de manter o `sync` da metade LGMRD (a metade Monster Builder fica de qualquer jeito). Decidir junto de US-232.

---

## Nota (US-241, 2026-09-14)

`readLgmrdTables`/[lgmrd-tables.ts](../../../apps/api/src/adventure-generation/lgmrd-tables.ts) **deixam de ser candidatos a remoção** neste MA-7: [US-241](./US-241-summary-formula-lgmrd-macguffin.md) reverte, só para `summary`, a exclusão total de tabela LGMRD (ADR 012 D5) e ganha um consumidor novo — `rollQuestSeed` ([roll-quest-seed.ts](../../../apps/api/src/adventure-generation/roll-quest-seed.ts)) lê direto as 4 tabelas de rolagem (`1d20quests`/`locationsmonumentsanditems`/`conditiondescriptionandorigin`/`patronsandnpcs`) pra compor a semente de gancho do prompt de autoria.

Continuam mortos e candidatos a remoção nesta story: `rollContent`/`rollPremissaCandidates`/`rollPatronsAndNpcs`/`generatePremissa` (US-192, [roll-content.ts](../../../apps/api/src/adventure-generation/roll-content.ts) — código antigo; `rollQuestSeed` lê as MESMAS tabelas com uma rolagem nova, não revive esse caminho) e os 40 prompts de segredo (US-149, `readSecretPrompts`).

---

## Referências no código

- [packages/shared/src/adventure-seed.ts](../../../packages/shared/src/adventure-seed.ts) — `deriveAdventureSeed`/`createSeededRandom`, código morto a remover.
- [US-145](./US-145-sync-lgmrd-notice.md) — `sync`; metade Monster Builder fica, metade LGMRD rebaixa.
- [US-146](./US-146-seed-deterministico-motor-aventura.md)/[US-147](./US-147-rolagem-registro-conteudo.md) — o que sai.
- [Backlog — MA-7](./backlog-motor-de-geracao-de-aventuras.md).
