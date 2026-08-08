# US-120 — `logLlmFailure` em JSON estruturado (ADR 011, Camada 2 — Grupo B)

**Épico:** Deploy e operação (observabilidade) — [ADR 011](../../adr/011-observabilidade-em-camadas.md)
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** [US-117](./US-117-turnid-por-turno.md) — `turnId`, opcional aqui (ver *Questões em aberto*)
**Relacionada a:** [ADR 011](../../adr/011-observabilidade-em-camadas.md) — Camada 2, Grupo B do inventário · Camada 4 do ADR 011 (`errorOccurred` por turno depende de um sinal estruturado de erro)
**Criada em:** 2026-08-08

---

## História

> **Como** mantenedora,
> **quero** que `logLlmFailure` emita um `event` JSON em vez de texto livre com stack,
> **para que** eu filtre falha de LLM por `scope`/`statusCode` numa linha só, e todo `catch` de LLM do serviço ganhe o formato de graça — sem editar cada `catch` individualmente.

---

## Contexto e motivação

`logLlmFailure` (`llm-error.ts`) é chamada por 7 pontos de `ai.service.ts` (`:845`, `:945`, `:950`, `:989`, `:1027`, `:1074`, `:1173`) — abertura de aventura, turno em andamento e reconciliação de cena. As duas chamadas de `console.error` vivem **dentro da função**, não em cada `catch`: migrar a função por si só já cobre todos os 7 call sites, sem tocar em nenhum deles. É o caso do inventário do [ADR 011](../../adr/011-observabilidade-em-camadas.md) onde a regra "conserta na raiz, não em cada sintoma" (`AGENTS.md`/ponytail) se aplica direto — 1 edição, 7 pontos corrigidos.

A função já distingue 4xx (bug nosso, recusa do provider, não-transitório) de 5xx/rede (degradação esperada, fallback existe) — essa distinção vira campo (`recoverable`), não se perde na migração.

---

## Escopo

### Dentro do escopo

- Migrar as 2 chamadas de `console.error` dentro de `logLlmFailure` (`llm-error.ts:31` e `:39`) para `console.error(JSON.stringify({...}))`.
- `event`: `llm_call_failed`.
- Campos: `scope`, `consequence` (os 2 parâmetros que a função já recebe), `statusCode` (quando disponível), `recoverable` (`false` para 4xx — "falha sempre", `true` para 5xx/rede — degradação esperada), `model` (só no ramo 4xx, onde já é extraído hoje), `errorMessage`.
- O ramo 5xx (`:39`) hoje loga `err` inteiro (stack) como segundo argumento do `console.error` — manter o objeto `err`/stack **fora** do JSON principal (como hoje, segundo argumento do `console.error`) ou como campo `stack` truncado — decisão de implementação, não de critério de aceite, contanto que a stack não se perca para quem debuga localmente.
- Atualizar `llm-error.test.ts` (3 testes existentes) para o novo formato.

### Fora do escopo

- Mudar a lógica de distinção 4xx/5xx ou o que cada `scope` faz — só o formato do log.
- Os 7 call sites em `ai.service.ts` que chamam `logLlmFailure` — nenhum precisa mudar, é o ponto central da US.
- Decidir a Camada 4 (persistir `errorOccurred` no banco) — esta US só deixa o sinal em JSON, pronto para quando/se a Camada 4 for priorizada.

---

## Critérios de aceite

- [ ] As 2 chamadas de `console.error` em `llm-error.ts` emitem JSON parseável com `event: 'llm_call_failed'`.
- [ ] Campo `recoverable` reflete corretamente o ramo (4xx → `false`; 5xx/rede → `true`).
- [ ] `scope` e `consequence` (parâmetros já existentes da função) aparecem como campos, não interpolados em string.
- [ ] Nenhum dos 7 call sites em `ai.service.ts` precisa de alteração — a assinatura de `logLlmFailure(scope, consequence, err)` não muda (ou, se `turnId` opcional entrar — ver *Questões em aberto* — é o único parâmetro novo, com default).
- [ ] `llm-error.test.ts` atualizado e passando com o novo formato.
- [ ] `pnpm typecheck` passa.

---

## Notas de implementação

> *Dicas. O implementador pode divergir com boa justificativa.*

- Mesmo padrão de `JSON.stringify` das demais USs desta série — zero dependência nova.
- O comentário de topo do arquivo (`llm-error.ts:3-24`) explica a motivação original (dois tipos de falha com a mesma cara, caso do 400 `Thinking mode does not support this tool_choice` que sobreviveu dias sem ninguém notar) — **não apagar o comentário** ao editar (regra do `AGENTS.md`/`CLAUDE.md`: comentário existente carrega intenção e proveniência).

---

## Questões em aberto

1. **`turnId` (US-117) entra aqui ou fica de fora?** `logLlmFailure` é chamada tanto durante a abertura de aventura (`:945`, `:950`, `:989`, `:1027` — sem turno, sem `turnId`) quanto durante turnos reais (`:845`, `:1074`, `:1173` — com `turnId`, se US-117 já estiver implementada).

   **Encaminhamento:** `turnId` vira parâmetro **opcional** (`turnId?: string`) de `logLlmFailure`, `undefined` nos call sites de abertura. Os 3 call sites de turno passam o valor quando a US-117 já existir; os 4 de abertura seguem sem passar nada. Não bloqueia esta US esperar a US-117 terminar primeiro — o campo pode nascer opcional e ser preenchido depois nos 3 call sites de turno, em PR separado se for mais simples.

---

## Referências no código

- [`apps/api/src/ai/llm-error.ts`](../../../apps/api/src/ai/llm-error.ts) — a função inteira, os 2 call sites internos desta US.
- [`apps/api/src/ai/llm-error.test.ts`](../../../apps/api/src/ai/llm-error.test.ts) — testes a atualizar.
- [`apps/api/src/ai/ai.service.ts:845,945,950,989,1027,1074,1173`](../../../apps/api/src/ai/ai.service.ts) — os 7 chamadores, nenhum precisa mudar.
- [ADR 011](../../adr/011-observabilidade-em-camadas.md) — Camada 2, Grupo B do inventário, decisão que esta US implementa.
