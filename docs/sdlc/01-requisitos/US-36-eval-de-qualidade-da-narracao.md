# US-36 — Eval de qualidade da narração do DM

**Épico:** 2 — Aventura
**Fase:** 1 — MVP single-player
**Status:** 🚧 Em progresso
**Depende de:** [US-34](./US-34-qualidade-da-narracao-do-dm.md) (barra de ofício + abertura gerada) e da suíte de evals existente (`evals/`, `pnpm eval`).
**Criada em:** 2026-07-07

---

## História

> **Como** desenvolvedor do DM Agent,
> **quero** um eval automatizado que pontue a qualidade da narração por uma rubrica,
> **para que** mudanças no prompt, no modelo ou no fallback não degradem a narração sem que ninguém perceba antes de chegar ao jogador.

---

## Contexto e motivação

### O problema observado

A [US-34](./US-34-qualidade-da-narracao-do-dm.md) coloca a barra de qualidade da narração num **prompt** — hoje a seção `## Narrative craft (the quality bar…)` + `### Onomastics` em `dm-system.ts` (montada por `buildDmSystemPrompt`). Prompt é frágil a regressão silenciosa: qualquer edição nessa seção, troca de modelo ou queda pela escada de fallback da narração pode fazer a narração cair de nível sem quebrar nenhum teste. A escada de narração hoje (`model.ts`, `narrationModels`) é: **`deepseek-v4-flash`** (primário, OpenRouter) → **`deepseek-v4-pro`** (fallback, OpenRouter) → **`llama-3.3-70b-versatile`** (3º nível, Groq — outro provider, sobrevive a outage do OpenRouter). Hoje, o único jeito de perceber uma regressão é **jogando e lendo** — lento, subjetivo e inconsistente.

A suíte de evals atual (`evals/cases/`) mede **comportamento e correção** — tools corretas, ausência de alucinação de regras, state persistido. Ela **não** mede **qualidade literária** da prosa. Ou seja: um turno pode passar em todos os evals atuais e ainda assim narrar de forma genérica e sem vida.

### A proposta

Adicionar um eval que pontua a **qualidade da narração** por uma rubrica derivada da barra de ofício da US-34, usando **LLM-as-judge**. Cada caso roda uma narração (abertura e/ou turno) e um modelo juiz atribui nota por dimensão; abaixo de um threshold, o eval falha no CI, do mesmo jeito que os evals de comportamento.

O objetivo é **não regredir** a qualidade — o eval é rede de segurança, não a fonte da qualidade (essa vem do prompt da US-34).

---

## Escopo

### Dentro do escopo

- Novo(s) eval case(s) em `evals/cases/` para qualidade da narração, cobrindo pelo menos: **abertura gerada** (US-34) e **um turno de continuação**.
- **Rubrica** derivada da barra de ofício da US-34, com dimensões pontuáveis, ex.:
  - abre pelos sentidos (não pela exposição);
  - concretude/nomeação de elementos específicos;
  - uso da classe/identidade como lente;
  - voz e corpo dos NPCs (quando há NPC);
  - concisão (3–5 parágrafos; não prolixo);
  - fecha num gancho vivo + opções bem formatadas.
- **LLM-as-judge**: um modelo juiz (Gemini 3.5 Flash Lite) pontua cada dimensão numa **escala 0–5**, com **justificativa por dimensão** registrada no log.
- **Threshold** mínimo de qualidade configurado junto dos demais (`scorer.ts` / `docs/sdlc/04-testes/estrategia-de-testes.md`); abaixo dele, `pnpm eval --ci` sai com código ≠ 0.
- Casos de **regressão de formatação** que a rubrica também cobre: opções com `-` + emoji (nunca `—`), diálogo com `—`, sem seções de status/stats na prosa.

### Fora do escopo

- Garantir um valor **absoluto** de "qualidade cinematográfica". O eval mede regressão contra uma barra e um conjunto de casos, não certifica excelência universal.
- Avaliar **consistência de cena/continuidade** entre turnos — isso é comportamento, coberto por evals de cena (US-11b) e pela US-35.
- Painel/telemetria de produção. Esta US é eval de desenvolvimento/CI, não monitoramento em produção.
- Fine-tuning ou troca de modelo de narração. O eval **informa** decisões de modelo; não as executa.

---

## Onde os logs do eval são vistos

- **Terminal (principal).** O eval roda sobre **vitest** (`pnpm eval` = `vitest run --config vitest.eval.config.ts`). O resultado por caso — pass/fail, nota por dimensão e nota total — aparece na saída do terminal, como qualquer teste vitest.
- **`pnpm eval --verbose`** — imprime, por caso, a narração avaliada, a nota de cada dimensão da rubrica e a **justificativa do juiz**, para inspecionar *por que* um caso caiu.
- **`pnpm eval --filter us-36`** — roda só os casos de qualidade da narração, útil ao iterar no prompt da US-34.
- **CI.** No pipeline, `pnpm eval --ci` falha o job (exit ≠ 0) quando a nota fica abaixo do threshold; o log do job de CI mostra quais dimensões/casos reprovaram. É o mesmo portão já descrito no `evals/README.md` ("sem evals passando, nenhum PR que toca o AI Engine pode ser mergeado").
- **Relatório persistido.** A rubrica gera justificativa útil para comparar versões de prompt; gravar um relatório por execução em `evals/reports/us-36-<timestamp>.md` (ou `.json`) com narração + notas + justificativas. Fora do caminho obrigatório do CI, mas gerado sempre — permite revisar histórico sem rerodar. (Decisão 3.)

---

## Abordagem técnica

- **Caso de eval:** seguir o padrão de `evals/cases/` — objeto exportado com `id`, `description`, `story`, `input` (contexto + ação) e `assertions`. A diferença é que a assertion principal é uma **pontuação por juiz**, não uma verificação de tool.
- **Juiz:** função que recebe a narração gerada + a rubrica e chama **Gemini 3.5 Flash Lite pela API do Gemini** (via `judgeModel()` de `model.ts`, que usa `@ai-sdk/google` + `GEMINI_API_KEY`) com `generateObject` (schema Zod: `{ [dimensão]: { nota: 0–5, justificativa } }`) para saída estruturada e determinística de parsear. Juiz externo ao stack de narração (OpenRouter/Groq) reduz viés de auto-avaliação; temperatura baixa. Não usar OpenRouter para o juiz.
- **Scorer/threshold:** estender `scorer.ts` com a métrica de qualidade e seu mínimo; documentar na tabela de thresholds do `evals/README.md` e em `docs/sdlc/04-testes/estrategia-de-testes.md`.
- **Determinismo:** LLM-as-judge tem ruído. Mitigar com temperatura baixa no juiz, rubrica objetiva (critérios binários/graduados claros) e, se preciso, média de N julgamentos. Evitar transformar o eval em teste "flaky".
- **Fixtures:** reusar personagens/estados de `evals/fixtures/` para gerar as narrações avaliadas (ex.: um paladino para a abertura, um caso com NPC vulnerável, um turno de baixo HP).

---

## Critérios de aceite

- [ ] Existe pelo menos um eval case de qualidade de narração cobrindo a **abertura** (US-34) e um cobrindo um **turno de continuação**.
- [ ] A rubrica pontua, no mínimo, as dimensões: sentidos, concretude, classe-como-lente, voz de NPC, concisão e gancho/opções.
- [ ] O juiz produz **nota por dimensão + justificativa** em saída estruturada validada por schema.
- [ ] Há um threshold de qualidade configurado; `pnpm eval --ci` sai com código ≠ 0 quando a nota fica abaixo dele.
- [ ] `pnpm eval --verbose` mostra, por caso, a narração avaliada, as notas por dimensão e as justificativas do juiz.
- [ ] `pnpm eval --filter us-36` roda apenas os casos desta story.
- [ ] O eval é estável (não-flaky) numa faixa razoável de execuções — temperatura baixa no juiz e rubrica objetiva; um caso no limiar não deve alternar pass/fail a cada rodada.
- [ ] Os thresholds novos estão documentados no `evals/README.md` e na estratégia de testes.
- [ ] **(regressão real)** Degradar deliberadamente o prompt de ofício (remover a seção `## Narrative craft` + `### Onomastics` de `dm-system.ts`) faz o eval de qualidade **reprovar**, comprovando que ele detecta queda de qualidade.

---

## Notas de implementação

- **Local dos casos:** `evals/cases/us-36-qualidade-narracao.ts` (ou nomes por dimensão), incluídos automaticamente pela suíte.
- **Juiz com `generateObject`:** schema Zod das dimensões (`nota` inteiro 0–5 + `justificativa`); juiz = Gemini 3.5 Flash Lite pela API do Gemini (`judgeModel()` / `@ai-sdk/google` + `GEMINI_API_KEY`), temperatura baixa. `GEMINI_API_KEY` vive no `.env` da raiz (mesmo padrão dos demais secrets de eval).
- **Scorer:** adicionar métrica "qualidade da narração" (escala 0–5) + mínimo em `scorer.ts`; refletir na tabela de thresholds.
- **Relatório:** escrever `evals/reports/us-36-<timestamp>.md` a cada execução (narração + notas + justificativas); adicionar `evals/reports/` ao `.gitignore`.
- **Reuso da US-34:** os casos devem exercitar o caminho real — `buildDmSystemPrompt` (com a seção `## Narrative craft` + `### Onomastics`) + geração pela escada `narrationModels` (deepseek-v4-flash primário) — para que o eval meça exatamente o que o jogador recebe.
- **Custo:** cada caso = 1 geração + 1 (ou N) julgamento(s) de LLM. Manter o conjunto enxuto para o eval não ficar caro/lento no CI.
- **ai-engine dist:** se juiz/rubrica viverem no pacote, exportar no `index` e lembrar do rebuild (`pnpm --filter @ai-dm/ai-engine build`).

---

## Decisões (questões resolvidas em 2026-07-23)

1. **Modelo juiz — Gemini 3.5 Flash Lite, via API do Gemini.** Acessar pela **API direta do Google Gemini** com `@ai-sdk/google` (`createGoogleGenerativeAI`) + `GEMINI_API_KEY` — **não** via OpenRouter. Reusar o helper `judgeModel()` já em `packages/ai-engine/src/model.ts`, que roteia para o provider Google por padrão. Barato, externo ao stack de narração (OpenRouter/Groq), sem viés de auto-avaliação; temperatura baixa para estabilidade. (Mesmo caminho do juiz da US-17.)
   - **Slug a confirmar:** `judgeModel()` hoje usa default `gemini-3.1-flash-lite`. Fixar o slug do 3.5 Flash Lite via `JUDGE_MODEL` **só depois de verificar** o nome exato no catálogo do Gemini e que a chave/projeto tem acesso a ele; senão o eval quebra na primeira chamada.
2. **Escala 0–5 por dimensão.** Graduada, não binária — captura queda parcial de qualidade que um passa/não-passa esconderia. Threshold mínimo calibrado com exemplos rotulados à mão (ver critério de aceite de regressão real).
3. **Relatório persistido — sim.** Gravar por execução em `evals/reports/us-36-<timestamp>.md` (ou `.json`) com narração + notas por dimensão + justificativas, para comparar versões de prompt ao longo do tempo sem rerodar.
4. **Aceitar variância do narrador.** Não fixar seed; confiar na média do juiz sobre a rubrica objetiva + temperatura baixa no juiz para manter o eval não-flaky. A variância da narração é parte do que se mede.

---

## Referências no código

- `evals/cases/` — onde entram os novos casos de qualidade (`us-36-…`).
- `evals/scorer.ts` — lógica de pontuação e threshold; adicionar a métrica de qualidade.
- `evals/fixtures/` — personagens/estados reusados para gerar as narrações avaliadas.
- `evals/README.md` — documentação da suíte e tabela de thresholds; atualizar.
- `packages/ai-engine/package.json` — script `eval` (`vitest run --config vitest.eval.config.ts`).
- `packages/ai-engine/src/prompts/dm-system.ts` — `buildDmSystemPrompt` com a seção de ofício (US-34), exercitado pelos casos.
- `docs/sdlc/04-testes/estrategia-de-testes.md` — estratégia e thresholds mínimos.
- `docs/sdlc/01-requisitos/US-34-qualidade-da-narracao-do-dm.md` — origem da barra de qualidade que esta US mede.
