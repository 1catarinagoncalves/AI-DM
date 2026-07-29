# Evals — AI Dungeon Master

Como o DM Agent é avaliado: o que reprova um PR, como rodar cada modo, e onde mexer
na barra. O subsistema mora em quatro lugares — o mapa está no fim.

## O que reprova o seu PR

**Dois comandos, não um.** [ci.yml](../.github/workflows/ci.yml) roda os dois:

- **`pnpm eval`** — os eval cases de [cases](cases), um arquivo vitest por user story.
  É `vitest run` com [vitest.eval.config.ts](../packages/ai-engine/vitest.eval.config.ts),
  que inclui `evals/cases/**` e aliasa os pacotes `@ai-dm/*` para o `src` (não depende
  de build prévio).
- **`pnpm test`** — carrega os gates que moram dentro do pacote e ninguém lembra:
  [rubric-drift.test.ts](../packages/ai-engine/src/rubric-drift.test.ts) falha se a barra
  de ofício do system prompt mudar sem a rubrica ser revista, e
  [rubric.test.ts](../packages/ai-engine/src/rubric.test.ts) prova o `gateQuality`
  (média + pisos por dimensão) sem gastar uma chamada de API.

**Um eval pode passar sem ter rodado.** Caso que depende de chave de API é *pulado*
quando ela falta — não fica vermelho, não avisa. O CI hoje roda **sem nenhum secret
configurado** ([ci.yml](../.github/workflows/ci.yml)), então o eval de qualidade da
narração é pulado lá: para o portão valer, o job precisa exportar as chaves. Leia a
contagem de *skipped* do vitest antes de confiar num verde.

## Os quatro modos

| Modo | Comando | Gateia? | Chaves | Relatório |
|---|---|---|---|---|
| Suite de eval cases | `pnpm eval` (ou `pnpm eval us-36` para um só) | **sim**, no CI | a maioria não usa; o de qualidade da narração exige `OPENROUTER_API_KEY` (narração) + `GEMINI_API_KEY` (juiz), senão **pula** | só o de narração grava, ver abaixo |
| Guard de drift da rubrica | `pnpm test` | **sim**, no CI | nenhuma (compara hash) | nenhum |
| Bake-off / A-B de modelos | `node --env-file=..\..\.env run-bakeoff.mjs`, de dentro de [packages/ai-engine](../packages/ai-engine) | não | varia por runner; sempre `GEMINI_API_KEY` para o juiz | `evals/reports/<data>-<tag>.md` |
| Live eval em dev | `DM_LIVE_EVAL` ligada, jogando um turno normal | não | `GEMINI_API_KEY` | log da API |

`evals/reports/` é gitignored.

## Onde mexo se quero mudar a barra

[rubric.ts](../packages/ai-engine/src/rubric.ts) — dimensões, threshold de média, pisos
por dimensão, limite de slop e o `gateQuality`. Os valores **não** são copiados para cá
de propósito: tabela de threshold duplicada é tabela que envelhece mentindo.

## Qualidade da narração (US-36 + US-70)

LLM-as-judge contra regressão silenciosa da prosa: gera pela escada de produção (mesmo
modelo e mesmo sampling do [ai.service.ts](../apps/api/src/ai/ai.service.ts)) e pontua
pela rubrica, com juiz externo Gemini. Média abaixo do threshold reprova.

A US-70 fechou dois furos da versão original, que gateava só pela média:

- **Piso por dimensão** — com muitas dimensões e um modelo base forte, uma queda
  cirúrgica (só sensorial, só onomástica) some na média. Um eixo abaixo do piso reprova
  **mesmo com média alta**.
- **N repetições** — cada caso roda N vezes (`JUDGE_REPS`, `1` no smoke local) e o gate
  opera sobre a média das reps, não sobre um tiro. Rep que falha por stall do provider é
  pulada, não derruba o eval.
- **Slop de onomástica é medido e avisado, não gateado.** A taxa-base do modelo cola no
  limiar e a falha é intermitente por amostra: gatear a REPS=3 reintroduziria a
  flakiness que a US-70 existe para matar. Vira gate quando a produção reduzir o slop —
  o encanamento já está pronto.
- **Anchor set** — narrações rotuladas boas/ruins; o caso reprova se o juiz não separar
  as boas das ruins por margem. Detecta deriva do próprio juiz.

Cada execução grava `evals/reports/us-36-<timestamp>.md`: narração, notas por dimensão,
justificativas e metadados (git HEAD/branch, modelo que serviu, sampling, tokens, juiz).

## Ao vivo em dev (`DM_LIVE_EVAL`)

Com a flag ligada, cada turno real de jogo é pontuado pelo mesmo juiz, async e
fire-and-forget no `onFinish` — `liveEvalTurn` em
[ai.service.ts](../apps/api/src/ai/ai.service.ts). Nunca roda em produção e nunca atrasa
o stream: é medição de campo, não gate. A API não auto-carrega `.env`, então a flag vem
do ambiente (ver [AGENTS.md](../AGENTS.md)).

## Adicionando um eval case

Crie um arquivo vitest em [cases](cases) nomeado `us-NN-descricao.ts` — `describe`/`it`/
`expect` comuns, sem interface própria. O `include` da
[config](../packages/ai-engine/vitest.eval.config.ts) pega o arquivo novo sozinho; não há
registro para atualizar.

**Não importe `ai` direto no caso.** O par `streamText` + vitest pendura e estoura o
timeout — foi por isso que o bake-off virou runner standalone
([README-bakeoff.md](../packages/ai-engine/README-bakeoff.md)). A geração de narração vive
em [narration-gen.ts](../packages/ai-engine/src/narration-gen.ts) **dentro do pacote**, e o
caso a importa por `@ai-dm/ai-engine`.

Se o caso grepa o system prompt, ancore a assertiva conforme
[PROMPT-ANCHORS.md](PROMPT-ANCHORS.md): o prompt é reescrito quase toda semana, e assertiva
presa em prosa autoral fica vermelha sem nenhuma regressão de comportamento.

## As quatro casas do subsistema

1. **[evals](.)** — os eval cases em [cases](cases), a convenção de âncora em
   [PROMPT-ANCHORS.md](PROMPT-ANCHORS.md), e `reports/` (gitignored).
2. **[packages/ai-engine/src](../packages/ai-engine/src)** — onde a lógica de avaliação de
   fato vive: [rubric.ts](../packages/ai-engine/src/rubric.ts),
   [guardrails.ts](../packages/ai-engine/src/guardrails.ts),
   [narration-gen.ts](../packages/ai-engine/src/narration-gen.ts),
   [overlap.ts](../packages/ai-engine/src/overlap.ts), mais os testes que são gate de
   verdade (drift da rubrica, `gateQuality`, bake-off, bench de TTFT).
3. **Raiz de [packages/ai-engine](../packages/ai-engine)** — os runners `.mjs` de bake-off
   e A-B, com os `.bat` de atalho e os snapshots. **Nada disso roda por `pnpm eval`**: é
   ferramenta de investigação ad-hoc, documentada em
   [README-bakeoff.md](../packages/ai-engine/README-bakeoff.md). Use quando suspeitar de
   regressão e quiser comparar modelos ou duas versões de prompt.
4. **[apps/api/src/ai/ai.service.ts](../apps/api/src/ai/ai.service.ts)** — o `liveEvalTurn`,
   único pedaço da pipeline que roda dentro do produto.

Estratégia de testes do projeto:
[estrategia-de-testes.md](../docs/sdlc/04-testes/estrategia-de-testes.md).
