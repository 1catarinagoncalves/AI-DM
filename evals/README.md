# Evals — AI Dungeon Master

Suite de avaliação do DM Agent. Mede qualidade, correção e comportamento do agente de IA.

## Por que evals existem

Seguindo o novo SDLC: evals são escritos *antes* do código de produção.
São o contrato formal do que "correto" significa para o DM Agent.
Sem evals passando, nenhum PR que toca o AI Engine pode ser mergeado.

## Estrutura

```
evals/
  cases/          — eval cases por user story
    us-08-streaming.ts
    us-09-dice-roll.ts
    us-10-rules.ts
    us-11-natural-language.ts
  fixtures/       — dados de teste reutilizáveis (personagens, aventuras, estados)
  runner.ts       — executor dos evals
  scorer.ts       — lógica de pontuação e threshold
```

## Comandos

```bash
pnpm eval                    # todos os casos
pnpm eval --filter us-09     # filtrar por story
pnpm eval --ci               # modo CI (exit 1 se abaixo do threshold)
pnpm eval --verbose          # exibe detalhes de cada caso
```

## Adicionando um novo eval case

1. Crie `evals/cases/<story-id>-<descricao>.ts`
2. Exporte um objeto `EvalCase` com: `id`, `description`, `story`, `input`, `expectedTools`, `assertions`
3. Rode `pnpm eval --filter <story-id>` para validar localmente
4. O novo caso é incluído automaticamente no CI

## Thresholds mínimos

| Métrica | Mínimo | Onde |
|---------|--------|------|
| Tools corretas chamadas | 90% | asserts dos cases |
| Ausência de alucinação de regras | 95% | asserts dos cases |
| State persistido corretamente | 100% | asserts dos cases |
| **Qualidade da narração (US-36)** | **MÉDIA ≥ 3.5** (escala 1–5) | `QUALITY_THRESHOLD` em `packages/ai-engine/src/rubric.ts` |
| **Piso por dimensão (US-70)** | **sensorial/tensão/concretude/língua pt-BR ≥ 3** | `DIMENSION_FLOORS` em `packages/ai-engine/src/rubric.ts` |
| **Taxa de slop de onomástica (US-70)** | **report-only** (aviso > 50% das reps; não reprova) | `SLOP_RATE_MAX` em `packages/ai-engine/src/rubric.ts` |

Ver estratégia completa em `docs/sdlc/04-testes/estrategia-de-testes.md`.

## Eval de qualidade da narração (US-36)

`evals/cases/us-36-qualidade-narracao.ts` — LLM-as-judge contra regressão silenciosa
da prosa. Gera pela escada de produção (`narrationModels[0]` + mesmo sampling do
`ai.service.ts`) e pontua pela rubrica `DIMENSIONS` (espelho da barra de ofício
`NARRATIVE_CRAFT_SECTION` de `dm-system.ts`) com o juiz externo Gemini. MÉDIA
abaixo do threshold reprova (exit ≠ 0).

- **Gated por chave:** precisa de `OPENROUTER_API_KEY` (narração) + `GEMINI_API_KEY`
  (juiz). Sem elas o caso é PULADO — como o bake-off/bench. Para o portão valer no
  CI, o job precisa exportar as duas chaves.
- **Rodar só estes casos:** `pnpm eval us-36`.
- **Relatório:** cada execução grava `evals/reports/us-36-<timestamp>.md` (narração
  + notas por dimensão + justificativas + metadados: git HEAD/branch, modelo que
  serviu, sampling, finishReason/tokens, juiz). `evals/reports/` é gitignored.
- **Guard de drift:** `packages/ai-engine/src/rubric-drift.test.ts` falha (no
  `pnpm test`) se a barra de ofício mudar sem a rubrica ser revista — força
  atualizar `DIMENSIONS` e o hash a cada edição da barra.
- **Ao vivo em dev:** com `DM_LIVE_EVAL` ligado, cada turno real é pontuado pelo
  mesmo juiz, async/fire-and-forget no `onFinish` (nunca em produção; nunca atrasa
  o stream). Ver `apps/api/src/ai/ai.service.ts` (`liveEvalTurn`).

## Robustez do gate (US-70)

A US-36 gateava só pela **MÉDIA** — mas com 11 dimensões e um modelo base forte, uma
queda cirúrgica (só onomástica, só sensorial) some na média (degradar a barra ainda
tirava 4.45). E o slop de onomástica é **intermitente** (~3/4 samples), então gatear
1 tiro seria *flaky*. A US-70 fecha os dois furos:

- **Piso por dimensão** (`DIMENSION_FLOORS`): cada eixo-chave tem um mínimo próprio;
  um eixo abaixo do piso **reprova mesmo com média alta**.
- **N repetições** (`JUDGE_REPS`, default **3**; `1` no smoke local): cada caso roda N
  vezes, agrega com `aggregateReps`, e o gate opera sobre a **média das reps** — não um
  tiro. Uma rep que falha (stall/timeout do provider) é **pulada**, não derruba o eval.
- **Slop = report-only (por ora):** o `slopRate` é medido sobre as reps e **avisado**, mas
  **não reprova**. A taxa-base de slop do modelo (~40% nos casos com muitos nomes) cola no
  `SLOP_RATE_MAX`, então gatear a REPS=3 seria *flaky*. Vira gate quando a produção reduzir
  o slop (US irmã de enforcement no `onFinish`) — o encanamento já está pronto (uma linha).
- **`gateQuality({ perDim, media })`**: função **pura** (sem API) que decide aprovação por
  **média + pisos**. O `pnpm test` a prova em `rubric.test.ts` — média 4.6 + `sensorial: 2`
  **reprova** —, provando de graça que o piso pega o que a média deixava passar.
- **Anchor set**: um punhado de narrações rotuladas boas/ruins; um caso gated reprova
  se o juiz **não** pontuar as boas acima das ruins por margem (detecta deriva do juiz).
- **Casos novos**: baixo HP, NPC vulnerável, turno em inglês (`língua pt-BR` vira *n/a*,
  sem penalizar) e sistema Free. Todos de **narração pura** — combate/rolagem ficam de
  fora (o eval julga a prosa, não a trajetória de tool calling; isso é a US-08/09).

| Threshold | Default | Onde |
|-----------|---------|------|
| `DIMENSION_FLOORS` | 3 (sensorial, tensão, concretude, língua pt-BR) | `rubric.ts` |
| `SLOP_RATE_MAX` | 0.5 (aviso; report-only) | `rubric.ts` |
| `JUDGE_REPS` | 3 (env; `1` no smoke) | eval case |

> **Onomástica não é piso, e slop não é gate (por ora).** O slop de nome é intermitente
> por amostra (a nota de onomástica do juiz oscila; a taxa-base ~40% cola no limiar), então
> nem um piso por-dimensão nem um gate de taxa a REPS=3 são estáveis — reintroduziriam a
> flakiness que a US-70 existe para matar. Enquanto a produção não reduz o slop (US irmã de
> enforcement, fora de escopo), o `slopRate` é **medido e avisado, não gateado**. O gate real
> é **média + pisos de qualidade** (estáveis). Vira gate de slop quando o base cair.
