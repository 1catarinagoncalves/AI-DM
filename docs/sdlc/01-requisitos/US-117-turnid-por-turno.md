# US-117 — `turnId` por turno: correlação de log (ADR 011, Camada 1)

**Épico:** Deploy e operação (observabilidade) — [ADR 011](../../adr/011-observabilidade-em-camadas.md)
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** nenhuma (só toca `ai.controller.ts`, onde o turno começa)
**Relacionada a:** [ADR 011](../../adr/011-observabilidade-em-camadas.md) — Camada 1 · [US-116](./US-116-observabilidade-da-cena-nao-avancada.md) — primeiro sinal JSON, hoje sem `turnId` · [Checklist de Deploy](../05-deploy/checklist.md) → *Desejado, não implementado* (`traceId` ligando ação → tools → narração → estado persistido)
**Criada em:** 2026-08-08

---

## História

> **Como** mantenedora,
> **quero** um id único por turno propagado a todo log que aquele turno emite,
> **para que** eu consiga reconstruir a sequência ação → tools → narração → persistência de um turno específico sem adivinhar por timestamp aproximado.

---

## Contexto e motivação

Hoje, logs de um mesmo turno (guard de `rollDice`, resumo do `onFinish`, `reconcileScene`) não têm nenhum campo em comum — só dá pra corroborar por timestamp aproximado e pela ordem no stream. O [Checklist de Deploy](../05-deploy/checklist.md) já lista isso como desejo não implementado.

A [US-116](./US-116-observabilidade-da-cena-nao-avancada.md) já estabelece o formato JSON para um sinal (`arc_signal`), mas sem `turnId` — cada linha fica isolada, sem como amarrar ao resto do que aconteceu no mesmo turno. Esta US é a Camada 1 do [ADR 011](../../adr/011-observabilidade-em-camadas.md): o campo que liga os sinais que já existem (US-116) e os que vão migrar para JSON depois ([US-118](./US-118-eventos-json-do-controller.md), [US-119](./US-119-eventos-json-do-ai-service.md), [US-120](./US-120-erro-de-llm-estruturado.md)).

---

## Escopo

### Dentro do escopo

- Gerar `turnId` (`crypto.randomUUID()`, nativo — sem dependência nova) uma vez por turno em `ai.controller.ts`, no ponto onde o turno começa.
- Propagar `turnId` como parâmetro pelas funções que o mesmo turno já chama internamente (o handler principal do turno em `ai.service.ts`, `reconcileScene`).
- Reroll/escalação dentro do mesmo turno (`ai.controller.ts:210` e `:215` — re-amostragem por degeneração) **reusa o mesmo `turnId`**: é a mesma ação do jogador sendo tentada de novo, não um turno novo.
- Se a [US-116](./US-116-observabilidade-da-cena-nao-avancada.md) já estiver implementada quando esta rodar, o campo `turnId` entra na linha `arc_signal` existente.
- Disponibilizar `turnId` como parâmetro pronto para quando os logs de texto livre migrarem (US-118/119/120) — esta US não força essa migração.

### Fora do escopo

- Migrar qualquer `console.warn`/`error` de texto para JSON (isso é Camada 2 — US-118, US-119, US-120).
- Persistir `turnId` no banco (isso é Camada 4 do ADR 011, não decidida).
- Propagar `turnId` como header HTTP entre `web` e `api` — o front não consome; a correlação é só entre logs internos do `api` (ver ADR 011 §3, alternativa rejeitada).

---

## Critérios de aceite

- [x] `turnId` gerado uma vez por turno em `ai.controller.ts`, tipo `string` (UUID v4).
- [x] `turnId` passado como parâmetro pelas funções chamadas dentro do mesmo turno (handler principal de `ai.service.ts`, `reconcileScene`).
- [x] Reroll/escalação do mesmo turno (`ai.controller.ts:210`, `:215`) reusa o `turnId` original — não gera um novo.
- [x] Se `arc_signal` (US-116) já existir no código, ganha o campo `turnId`. — N/A: US-116 ainda não implementada (status "📋 Planejada") quando esta US rodou; nenhum `arc_signal` existe no código para ganhar o campo. `reconcileScene` já recebe `turnId` pronto para quando existir.
- [x] Teste unitário cobre: (a) dois turnos consecutivos geram `turnId` diferentes; (b) o mesmo `turnId` chega a pelo menos duas funções chamadas durante o mesmo turno (via spy/mock).
- [x] `pnpm typecheck` passa.

---

## Notas de implementação

> *Dicas. O implementador pode divergir com boa justificativa.*

- `crypto.randomUUID()` é global no Node ≥ 14.17 — sem `import` de lib externa.
- Conferir se há mais de um ponto de entrada de turno em `ai.controller.ts` (turno normal vs. fluxo de abertura de aventura) — a abertura não é um "turno" no mesmo sentido (não passa por `rollDice`/guards de turno) e pode ficar fora do escopo de `turnId` por esta US; a [US-120](./US-120-erro-de-llm-estruturado.md) trata separadamente os `logLlmFailure` de abertura, que não têm `turnId`.

---

## Questões em aberto

1. **Abertura de aventura conta como "turno" para efeito de `turnId`?** `ai.service.ts` chama `logLlmFailure` tanto na abertura (`:945`, `:950`, `:989`, `:1027`) quanto durante turnos reais (`:845`, `:1074`, `:1173`). Proposta: não — `turnId` nasce só no fluxo de turno (`ai.controller.ts`); chamadas de abertura ficam sem `turnId` (campo opcional/ausente), decidido na prática pela US-120 quando migrar `logLlmFailure`.

---

## Referências no código

- [`apps/api/src/ai/ai.controller.ts`](../../../apps/api/src/ai/ai.controller.ts) — onde o turno começa; `:210`/`:215` são o reroll que reusa o `turnId`.
- [`apps/api/src/ai/ai.service.ts:804-805`](../../../apps/api/src/ai/ai.service.ts) — `cenaTocada`/`arc_signal` da US-116, primeiro consumidor do `turnId`.
- [`apps/api/src/ai/ai.service.ts:1047`](../../../apps/api/src/ai/ai.service.ts) — `reconcileScene`, chamado dentro do turno.
- [ADR 011](../../adr/011-observabilidade-em-camadas.md) — Camada 1, decisão que esta US implementa.
