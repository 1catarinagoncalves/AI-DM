# US-233 — Números dos encontros (PASSO 2, 5e determinístico)

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** 📋 Proposta
**Depende de:** [US-232](./US-232-schema-cresce-e-prompt-de-autoria-call-unico.md) (a CHAMADA 1 emite `encounters[].fiction`, a matéria-prima) · [US-152](./US-152-statblocks-papel-orcamento.md) (statblock por papel Minion/Soldier/Brute, do `5e_Monster_Builder.json`) · [US-159](./US-159-orcamento-de-encontro-lgmrd.md)/[US-160](./US-160-composer-encontro-usa-limiar-de-soma.md) (orçamento *Lazy Encounter Benchmark* pro nível) · [US-237](./US-237-remove-seed-rebaixa-lgmrd-mantem-monster-builder.md) (metade Monster Builder do `sync` fica)
**Relacionado:** [US-161](./US-161-jogador-escolhe-nivel-de-desafio-do-encontro.md) (modo desafio escolhe o orçamento) · [ADR 012](../../adr/012-aventura-gerada-como-dado.md) (D5 — "números = código, ficção = modelo", abordagem A) · [Backlog — MA-3](./backlog-motor-de-geracao-de-aventuras.md)
**Criada em:** 2026-09-13

---

## História

> **Como** desenvolvedora do motor,
> **quero** um passo determinístico que pega a **ficção** de cada encontro (que o modelo escreveu) e preenche a **mecânica 5e** — papel de statblock e orçamento pro nível do personagem —
> **para que** o número nunca venha do modelo (que inventa HP/CD errados, US-29), e o encontro caiba num personagem solo do nível certo.

---

## Contexto e motivação

A abordagem A ([ADR 012](../../adr/012-aventura-gerada-como-dado.md) D5) separa: **ficção do encontro = modelo** (US-232, `encounter.fiction`: onde, quem, situação — sem números), **números = código**. O Spike mostrou o modelo escrevendo "teste de Sabor" e HP fictício quando deixado por conta própria — daí a mecânica sair do modelo e ir pro código determinístico. Esta story é esse PASSO 2.

Já existe o material: US-152 dá o statblock por papel (do `5e_Monster_Builder.json`), US-159/160 dão o orçamento *Lazy Encounter Benchmark* por nível. Falta a peça que **casa** a ficção da CHAMADA 1 com esse material.

---

## Escopo

### Dentro do escopo

- **Preencher a camada mecânica de cada `encounters[]`** a partir da `fiction` que a US-232 emitiu: para cada inimigo/grupo descrito, atribuir **papel** (Minion/Soldier/Brute, US-152) e resolver o **statblock** correspondente.
- **Orçamento pro nível do personagem solo** (US-159/160): a soma dos papéis cabe no limiar do nível (`encounterDeadlyThreshold`). O **modo desafio** (US-161) escolhe qual limiar (`adventure` vs `challenge`, `singleMonsterCrCap`).
- **Determinístico sem `seed`:** as funções de statblock/orçamento já são **puras** por `level`/`challenge` — mesma entrada, mesma saída, sem RNG. O `seed` está morto (ADR 012 D1); este passo não o ressuscita.
- **Encaixe no schema:** os campos mecânicos do encontro (papel por inimigo, referência de statblock, orçamento resolvido) entram em `encounters[]` — a forma exata é a que a US-152 definir (ver *Questões em aberto* #2 da US-144).
- **Sinaliza estouro:** quando a ficção pede mais do que o orçamento do nível aguenta, este passo **não conserta** — reporta pro gate (MA-4/US-234), que regenera a CHAMADA 1.

### Fora do escopo

- **Escrever a ficção do encontro** — US-232 (CHAMADA 1).
- **O gate** (grafo fecha, regenera-on-fail) — [US-150](./US-150-gate-antes-de-persistir-aventura-gerada.md)/MA-4. Este passo só **preenche** e **sinaliza** estouro; a decisão de regenerar é do gate.
- **A forma do statblock em si** — [US-152](./US-152-statblocks-papel-orcamento.md).
- **Escalar acima do nível 1 / grupo > 1** — fase 1 é solo, nível travado (ressalva do backlog inalterada).

---

## Critérios de aceite

- [ ] Dado um `encounters[].fiction` (inimigo + situação, sem números), o passo atribui papel (Minion/Soldier/Brute) e resolve o statblock de cada inimigo, sem pedir número nenhum ao modelo.
- [ ] A soma dos papéis de cada encontro respeita o limiar do nível do personagem (US-159/160); o modo desafio (US-161) troca o limiar aplicado.
- [ ] Mesmo `level`/`challenge` produz os mesmos números (função pura, sem `seed`/RNG) — testável por igualdade.
- [ ] Encontro cuja ficção excede o orçamento do nível é **marcado como estouro** e reportado ao gate (MA-4), não silenciosamente cortado nem persistido.
- [ ] **Eval / regressão:** teste com uma ficção de encontro fixa em 2 níveis diferentes — o orçamento resolvido difere corretamente por nível; um encontro deliberadamente grande demais dispara a marcação de estouro.
- [ ] `pnpm typecheck` e `pnpm test` passam.

---

## Notas de implementação

- Reusar direto US-152 (statblock por papel) e US-159/160 (limiar por nível) — esta story é a **cola** entre a ficção e essas funções, não reimplementa nenhuma.
- Sem RNG: se aparecer tentação de "sortear qual monstro", parar — a variedade veio da ficção do modelo (US-232); aqui é só resolver papéis/orçamento de forma determinística.
- ai-engine roda de `dist` — `pnpm --filter @ai-dm/ai-engine build` depois de editar `src`.

---

## Questões em aberto

1. **Campos mecânicos do encontro no schema** — a forma exata (papel por inimigo, ref de statblock, orçamento) é herdada da decisão da US-152 (ver US-144 *Questões em aberto* #2). Fechar quando a US-152 escrever contra o schema crescido.

---

## Referências no código

- [packages/shared/src/types/adventure-generation.ts](../../../packages/shared/src/types/adventure-generation.ts) — `AdventureEncounterSchema` (ganha `fiction` na US-232; camada mecânica aqui).
- [US-152](./US-152-statblocks-papel-orcamento.md) — statblock por papel, fonte `5e_Monster_Builder.json`.
- [US-159](./US-159-orcamento-de-encontro-lgmrd.md)/[US-160](./US-160-composer-encontro-usa-limiar-de-soma.md) — orçamento *Lazy Encounter Benchmark*.
- [Backlog — MA-3](./backlog-motor-de-geracao-de-aventuras.md).
