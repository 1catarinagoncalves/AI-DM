# US-118 — Sinais de `ai.controller.ts` em JSON estruturado (ADR 011, Camada 2 — Grupo A parte 1)

**Épico:** Deploy e operação (observabilidade) — [ADR 011](../../adr/011-observabilidade-em-camadas.md)
**Fase:** 1 — MVP single-player
**Status:** ✅ Concluída
**Depende de:** [US-117](./US-117-turnid-por-turno.md) — `turnId` por turno, campo obrigatório em toda linha desta US
**Relacionada a:** [ADR 011](../../adr/011-observabilidade-em-camadas.md) — Camada 2, Grupo A, inventário completo · [US-116](./US-116-observabilidade-da-cena-nao-avancada.md) — mesmo formato JSON, primeiro exemplo
**Criada em:** 2026-08-08

---

## História

> **Como** mantenedora,
> **quero** que os 4 `console.warn` de guard em `ai.controller.ts` virem log JSON com campos fixos e `turnId`,
> **para que** eu filtre por `event` (fallback de modelo, degeneração, truncamento) em vez de grep de texto livre, e correlacione com o resto do turno.

---

## Contexto e motivação

`ai.controller.ts` tem 4 `console.warn` de texto livre, todos sinais de decisão do controlador de turno (fallback de modelo, re-roll por degeneração, escalação, truncamento recuperado) — nenhum é ruído, todos já carregam informação estruturável (`modelIndex`/`attempt`, contagem de reroll). O [ADR 011](../../adr/011-observabilidade-em-camadas.md) já mapeou os 4 sites e o `event` proposto para cada um (Grupo A do inventário da Camada 2); esta US é a implementação.

---

## Escopo

### Dentro do escopo

Migrar as 4 linhas, mantendo o comportamento (a lógica de fallback/reroll/escalação **não muda**, só o formato do log):

| Local | `event` | Campos específicos |
|---|---|---|
| `ai.controller.ts:194` | `model_fallback` | `modelIndex` |
| `ai.controller.ts:210` | `degeneration_reroll` | `modelIndex`, `sameModelRerolls`, `maxSameModelRerolls` |
| `ai.controller.ts:215` | `degeneration_escalate` | `modelIndex`, `sameModelRerolls` |
| `ai.controller.ts:239` | `turn_truncated_recovered` | `modelIndex` |

Todas as linhas carregam os campos fixos da Camada 0: `event`, `turnId` (US-117), `timestamp`.

### Fora do escopo

- Qualquer lógica de decisão (quando falla, quando escala) — só o formato do log muda.
- Os outros grupos do inventário (`ai.service.ts` — US-119; `logLlmFailure` — US-120).

---

## Critérios de aceite

- [x] As 4 linhas de `ai.controller.ts` emitem `console.log(JSON.stringify({ event, turnId, timestamp, ...campos }))`, parseável (`JSON.parse` direto, sem regex).
- [x] Nenhuma mudança de comportamento — os testes existentes do controller continuam passando sem alteração de asserção sobre a lógica (só sobre o formato do log, se houver).
- [x] `pnpm typecheck` passa.

---

## Notas de implementação

> *Dicas. O implementador pode divergir com boa justificativa.*

- Mesmo padrão de `console.log(JSON.stringify({...}))` que a [US-116](./US-116-observabilidade-da-cena-nao-avancada.md) já usa — sem lib nova.
- `event` como string literal fixa (não interpolada) — é o campo que a agregação filtra; nome não muda depois de definido (mesma regra da US-116).

---

## Referências no código

- [`apps/api/src/ai/ai.controller.ts:194,210,215,239`](../../../apps/api/src/ai/ai.controller.ts) — os 4 call sites desta US.
- [ADR 011](../../adr/011-observabilidade-em-camadas.md) — Camada 2, Grupo A do inventário, decisão que esta US implementa.
- [US-117](./US-117-turnid-por-turno.md) — `turnId`, campo obrigatório aqui.
