# US-94 — O gate de qualidade da narração passa a rodar de verdade, num job noturno

**Épico:** 5 — Qualidade e avaliação do DM Agent
**Fase:** 1 — MVP single-player
**Status:** 🗂️ Backlog
**Depende de:** [US-80](./US-80-ci-typecheck-testes-e-evals.md) (workflow), [US-36](./US-36-eval-de-qualidade-da-narracao.md) (rubrica e juiz), [US-70](./US-70-piso-por-dimensao-e-robustez-do-eval.md) (pisos, reps, anchor set)
**Criada em:** 2026-07-30

---

## História

> **Como** mantenedora do AI DM,
> **quero** que os eval cases que chamam modelo de verdade rodem num job agendado com as chaves,
> **para que** o threshold de qualidade da narração seja um gate que dispara, e não um número escrito num doc.

---

## Contexto e motivação

### O problema observado

`pnpm eval` roda no CI (`ci.yml:65`). Mas o job roda **sem nenhum secret** — é critério de aceite #3 da [US-80](./US-80-ci-typecheck-testes-e-evals.md), e é uma decisão boa para o job de PR. O efeito colateral é que todo caso que depende de LLM se auto-pula: `evals/cases/us-36-qualidade-narracao.ts` é gated por `OPENROUTER_API_KEY` + `GEMINI_API_KEY`, e sem elas o Vitest marca `skip` e a suíte fica verde.

Logo: o `QUALITY_THRESHOLD` (≥ 3.5) e os `DIMENSION_FLOORS` (≥ 3 por dimensão-chave) de `packages/ai-engine/src/rubric.ts` — o gate mais caro de construir do repo, três stories de trabalho ([US-36](./US-36-eval-de-qualidade-da-narracao.md), [US-70](./US-70-piso-por-dimensao-e-robustez-do-eval.md), [US-72](./US-72-evals-de-prompt-resistentes-a-reescrita.md)) — **nunca foram avaliados por nenhuma execução automática**. A própria estratégia de testes registra isso sem rodeio: *"o portão só vale no CI quando o job exporta as duas chaves"* ([estratégia de testes](../04-testes/estrategia-de-testes.md), seção *Threshold de qualidade (CI)*).

O que o `pnpm eval` do CI de fato protege hoje é a camada determinística: assertivas de prompt (US-72/US-77), `gateQuality()` puro, saneadores. Valioso, e não é o que a tabela de threshold promete.

### Por que a solução atual não basta

Rodar o eval vivo **no job de PR** foi rejeitado com razão e continua rejeitado: cada caso roda `JUDGE_REPS` vezes (default 3), chama narração e juiz, e cobra dinheiro por push. Um repo que gasta a cada commit ensina a pessoa a evitar commitar.

Mas "não a cada push" nunca implicou "nunca". A qualidade do Mestre não muda só quando o prompt muda: o provedor troca de peso do modelo por baixo (a memória do repo registra que slugs mudam com frequência), o juiz Gemini deriva, o fornecedor de fallback entra em cena numa quota. Nenhum desses eventos tem commit associado — e portanto nenhum gate atrelado a commit jamais os pegaria. É exatamente o caso de uma execução **por calendário**.

### A proposta

Um workflow separado, agendado uma vez por dia e disparável à mão, com as duas chaves, rodando os casos vivos. Vermelho lá é a única forma de descobrir deriva de qualidade sem alguém abrir o jogo e sentir que "está estranho".

---

## Escopo

### Dentro do escopo

- `.github/workflows/eval-live.yml`:
  - `on: schedule` (uma vez por dia) + `workflow_dispatch` (botão manual);
  - mesmos passos de preparo do `ci.yml` (checkout, pnpm, Node 22.23.0, install, build dos pacotes) — o eval não precisa do `prisma generate` (US-80 mediu: o eval lê o `src` por alias, não o `dist`, e não toca banco);
  - `env:` com `OPENROUTER_API_KEY` e `GEMINI_API_KEY` vindos de `secrets`;
  - `pnpm eval`.
- Os dois secrets configurados no repo.
- Uma linha no `README.md` de `evals/` dizendo onde o eval vivo roda e como disparar à mão.

### Fora do escopo

- **Mudar o job `ci`.** Ele continua sem secret e continua rodando `pnpm eval` na variante que se auto-pula. Não há duplicação a remover: são dois recortes da mesma suíte.
- **Mexer no threshold, na rubrica ou nos pisos.** Esta story **executa** o gate que a US-36 e a US-70 escreveram; se ele reprovar, o achado vira story de correção do Mestre, não afrouxamento do número.
- **Ligar o `slopRate` como gate.** Continua report-only pela decisão medida da US-70 (taxa-base ~40% cola no `SLOP_RATE_MAX`, gatear seria flaky). Esta story não reabre isso.
- **Abrir issue automática no vermelho.** Notificação de workflow agendado que falha já chega por e-mail. Automação de issue entra quando houver mais de uma pessoa para atribuir.
- **Eval vivo em produção** (`DM_LIVE_EVAL` no `onFinish`, US-36) — mecanismo diferente, mede tráfego real, não muda aqui.

---

## Critérios de aceite

- [ ] Existe `.github/workflows/eval-live.yml` com `schedule` e `workflow_dispatch`.
- [ ] Numa execução manual, a saída mostra os casos gated **executando** (nenhum `skip` por chave ausente) — colar a linha de resumo do Vitest aqui.
- [ ] **O custo de uma execução completa está medido e registrado nesta story** (tokens e/ou USD, por provedor), antes de o `schedule` ser ligado. Se o custo diário for desproporcional, a cadência cai para semanal na mesma story — mas com número, não com palpite.
- [ ] **Teste de regressão (o gate morde):** baixar `QUALITY_THRESHOLD` é o teste errado (afrouxa o gate). O certo é o inverso — subir o threshold temporariamente acima da média medida e confirmar que o job fica **vermelho** nomeando a dimensão. Valor restaurado (`git diff` limpo).
- [ ] O job **não** roda em `push` nem em `pull_request` — verificado tentando um push e confirmando que só o `ci` disparou.
- [ ] Os secrets não aparecem em log nenhum (o mascaramento do GitHub cobre, mas confirmar que nenhum passo faz `echo` de env).

---

## Notas de implementação

- **Chaves:** `OPENROUTER_API_KEY` (narração, primário + fallback) e `GEMINI_API_KEY` (juiz). São as mesmas do `.env` da raiz — ver [a nota de env em dev](../../../AGENTS.md) sobre a API não carregar `.env` sozinha; no runner isso não se aplica, `env:` do job basta.
- **`GROQ_API_KEY` provavelmente não é necessária:** é o 3º degrau da escada, alcançado só quando os dois primeiros falham. Ligar sem ela primeiro; se um run cair no degrau 3 e pular caso, aí sim entra — e o fato de ter caído já é informação.
- **Flakiness é o risco número um.** Um job noturno que fica vermelho por quota ou 503 do provedor, e não por qualidade, queima a credibilidade do sinal em uma semana. Separar as duas causas na saída: falha de infraestrutura do provedor deve dizer isso na mensagem, não virar "qualidade caiu". A US-70 já ataca metade disso com `JUDGE_REPS`/`aggregateReps`; o que falta é o erro de transporte não se disfarçar de nota baixa.
- **O anchor set da US-70 é o detector de deriva do juiz.** Se ele reprovar, o problema é o juiz, não o Mestre — e a leitura do vermelho começa por aí.
- **Horário:** rodar de madrugada em UTC não ajuda ninguém se a pessoa lê o e-mail de manhã em Lisboa. Escolher a hora pelo fuso de quem vai ler.

---

## Questões em aberto

1. **Diário ou semanal?** Depende do custo medido (critério de aceite #3) e da frequência real de mudança de prompt. Diário pega deriva de provedor; semanal é 7× mais barato. Decidir com o número na mão.
2. **O que fazer quando o vermelho for do provedor e não da qualidade?** `continue-on-error` mataria o sinal inteiro. Provavelmente é uma distinção no código do eval (erro de transporte lança tipo próprio), o que empurraria trabalho para `packages/ai-engine` — fora do escopo desta story, mas é o primeiro candidato a virar irmã.
3. **A média medida é quanto, hoje?** Ninguém sabe: nunca rodou automatizado. A primeira execução manual é também a primeira linha de base — se ela vier **abaixo** de 3.5, esta story entrega o job e abre a story de correção, sem baixar o número.

---

## Referências no código

- `packages/ai-engine/src/rubric.ts` — `DIMENSIONS`, `QUALITY_THRESHOLD`, `DIMENSION_FLOORS`, `gateQuality()`, `aggregateReps`.
- `evals/cases/us-36-qualidade-narracao.ts` — o caso gated pelas duas chaves.
- `packages/ai-engine/vitest.eval.config.ts` — alias dos pacotes para o `src`; é por isso que este job não precisa do `prisma generate`.
- `.github/workflows/ci.yml` (`:65`) — o `pnpm eval` sem secret, que continua como está.
- [Estratégia de testes](../04-testes/estrategia-de-testes.md), seção *Threshold de qualidade (CI)* — a tabela cujo enforcement esta story liga.
