# US-119 — Sinais de `ai.service.ts` em JSON estruturado (ADR 011, Camada 2 — Grupo A parte 2 + Grupo C)

**Épico:** Deploy e operação (observabilidade) — [ADR 011](../../adr/011-observabilidade-em-camadas.md)
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** [US-117](./US-117-turnid-por-turno.md) — `turnId` por turno, campo obrigatório em toda linha desta US
**Relacionada a:** [ADR 011](../../adr/011-observabilidade-em-camadas.md) — Camada 2, Grupos A e C do inventário · [US-116](./US-116-observabilidade-da-cena-nao-avancada.md) — mesmo formato JSON, `arc_signal` no mesmo arquivo · Camada 4 do ADR 011 (persistência de custo/duração), que depende do campo `turn_summary` desta US antes de poder ser decidida

**Criada em:** 2026-08-08

---

## História

> **Como** mantenedora,
> **quero** os 10 guards de `ai.service.ts` e o resumo do `onFinish` (`:694`) em JSON com `turnId`,
> **para que** eu filtre degeneração/saneamento/reconciliação por `event` em vez de grep de texto livre, e tenha o dado de tokens/duração por turno pronto para uma futura decisão sobre alerta (Camada 4).

---

## Contexto e motivação

`ai.service.ts` concentra 10 dos 23 call sites do inventário da Camada 2 (guards de `rollDice`, saneador de narração, descarte de turno degenerado/truncado, slop de nome, reconciliação de cena, juiz do live-eval) mais a linha `:694` (`onFinish`, resumo do turno com `tokens=`/`finishReason=`), que o [ADR 011](../../adr/011-observabilidade-em-camadas.md) marca como **pré-requisito da Camada 4** — é de onde viriam `tokensCost`/`durationMs` se um dia a persistência por turno entrar. Migrar essa linha agora, mesmo sem a Camada 4 decidida, não é trabalho perdido: é o mesmo dado, só em formato que a Camada 4 (se vier) já consegue ler.

---

## Escopo

### Dentro do escopo

Migrar as 11 linhas a seguir, mantendo o comportamento — nenhuma lógica de guard, saneamento ou reconciliação muda, só o formato do log:

| Local | `event` | Cuidado ao migrar |
|---|---|---|
| `ai.service.ts:394` | `roll_dedup` | `skill`, `ability` |
| `ai.service.ts:403` | `roll_unresolved_skill` | `skill`, `ability`, `reason` |
| `ai.service.ts:694` | `turn_summary` | `finishReason`, `model`, `tokens` (objeto `usage`, não string interpolada), `steps` |
| `ai.service.ts:740` | `leak_reasoning_stripped` | **não perder** o array `leaked` (trechos removidos) — vira campo `leaked: string[]` (truncado, mesmo limite de 120 chars já usado) |
| `ai.service.ts:751` | `leak_fake_roll_stripped` | **não perder** o array `removed` |
| `ai.service.ts:759` | `leak_state_tag_stripped` | **não perder** o array `stateTags` |
| `ai.service.ts:766` | `turn_discarded_degenerate` | referência à US-69 vira campo `reason`, não string solta |
| `ai.service.ts:775` | `turn_discarded_truncated` | referência à US-74 vira campo `reason`, não string solta |
| `ai.service.ts:793` | `slop_name` | `match` (nome detectado) |
| `ai.service.ts:1072` | `scene_reconciled` | `local`, `presentes` (array, hoje já é `next.presentes.join(', ')` — parar de fazer `join`, manter array) |
| `ai.service.ts:1105` | `live_eval_judge_failed` | `error` (mensagem), fire-and-forget continua igual |

Todas as linhas carregam os campos fixos da Camada 0: `event`, `turnId` (US-117), `timestamp`.

### Fora do escopo

- `ai.service.ts:146`, `:638`, `:709`, `:1100` — Grupo D do inventário do ADR 011, fora desta migração (redundantes com `:694` ou temporários — ver ADR §Camada 2).
- Qualquer decisão sobre a Camada 4 (persistir `tokensCost`/`durationMs` em banco, alertar) — esta US só deixa o dado em formato JSON; não cria tabela nem serviço.
- `logLlmFailure` (`llm-error.ts`) — Grupo B, é a [US-120](./US-120-erro-de-llm-estruturado.md).

---

## Critérios de aceite

- [ ] As 11 linhas emitem `console.log`/`warn`(`JSON.stringify({ event, turnId, timestamp, ...campos }))`, parseável.
- [ ] Nenhum array hoje logado (`removed`, `leaked`, `stateTags`, `presentes`) vira string concatenada no JSON — permanece array.
- [ ] `tokens=${JSON.stringify(usage)}` (`:694`) vira campo `tokens` como objeto real dentro do JSON da linha, não string aninhada duas vezes serializada.
- [ ] Nenhuma mudança de comportamento — guards, saneador e reconciliação continuam agindo igual; testes existentes de `ai.service.ts` passam sem alteração de asserção sobre a lógica.
- [ ] `pnpm typecheck` passa.

---

## Notas de implementação

> *Dicas. O implementador pode divergir com boa justificativa.*

- Mesmo padrão da US-116/US-118: `console.log(JSON.stringify({...}))`, zero dependência.
- `:694` hoje serializa `tokens=${JSON.stringify(usage)}` **dentro** de uma template string — ao migrar para JSON, `usage` vira campo direto do objeto (`tokens: usage`), não precisa de `JSON.stringify` aninhado (o `JSON.stringify` externo já cobre).
- `:1072` hoje já faz `next.presentes.join(', ')` para caber na string de texto — a migração é a oportunidade de voltar a mandar o array (`presentes: next.presentes`), sem perda de estrutura.
- Se esta US rodar **depois** da US-118, seguir exatamente o mesmo formato de campo já estabelecido lá (`event`/`turnId`/`timestamp` como chaves, nessa ordem, por consistência de leitura — não é requisito técnico, é legibilidade).

---

## Referências no código

- [`apps/api/src/ai/ai.service.ts`](../../../apps/api/src/ai/ai.service.ts) — todos os 11 call sites desta US (linhas na tabela acima).
- [ADR 011](../../adr/011-observabilidade-em-camadas.md) — Camada 2 (Grupos A e C) e Camada 4 (dependência do campo `turn_summary`), decisões que esta US implementa.
- [US-117](./US-117-turnid-por-turno.md) — `turnId`, campo obrigatório aqui.
- [US-116](./US-116-observabilidade-da-cena-nao-avancada.md) — `ai.service.ts:792` (`detectSlopName`), precedente do mesmo arquivo.
