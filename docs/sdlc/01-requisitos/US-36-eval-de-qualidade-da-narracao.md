# US-36 — Eval de qualidade da narração do DM

**Épico:** 2 — Aventura
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
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

A [US-34](./US-34-qualidade-da-narracao-do-dm.md) coloca a barra de qualidade da narração num **prompt** (a seção de ofício). Prompt é frágil a regressão silenciosa: qualquer edição no `dm-system.ts`, troca de modelo ou acionamento do fallback (`gpt-oss-120b` → `llama-3.3-70b`) pode fazer a narração cair de nível sem quebrar nenhum teste. Hoje, o único jeito de perceber é **jogando e lendo** — lento, subjetivo e inconsistente.

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
- **LLM-as-judge**: um modelo juiz pontua cada dimensão (escala definida em `scorer.ts`), com **justificativa por dimensão** registrada no log.
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
- **Relatório persistido (opcional).** Como a rubrica gera texto de justificativa útil para comparar versões de prompt, gravar um relatório por execução (ex.: `evals/reports/us-36-<timestamp>.md` ou `.json`) com narração + notas + justificativas. Fica fora do caminho obrigatório; útil para revisar histórico sem rerodar. (Ver Questão em aberto 3.)

---

## Abordagem técnica

- **Caso de eval:** seguir o padrão de `evals/cases/` — objeto exportado com `id`, `description`, `story`, `input` (contexto + ação) e `assertions`. A diferença é que a assertion principal é uma **pontuação por juiz**, não uma verificação de tool.
- **Juiz:** função que recebe a narração gerada + a rubrica e chama um LLM juiz com `generateObject` (schema Zod: `{ [dimensão]: { nota, justificativa } }`) para saída estruturada e determinística de parsear. Modelo do juiz idealmente diferente/mais capaz que o narrador, para reduzir viés de auto-avaliação.
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
- [ ] **(regressão real)** Degradar deliberadamente o prompt de ofício (remover a seção da US-34) faz o eval de qualidade **reprovar**, comprovando que ele detecta queda de qualidade.

---

## Notas de implementação

- **Local dos casos:** `evals/cases/us-36-qualidade-narracao.ts` (ou nomes por dimensão), incluídos automaticamente pela suíte.
- **Juiz com `generateObject`:** schema Zod das dimensões; modelo juiz configurável (não precisa ser o narrador). Temperatura baixa.
- **Scorer:** adicionar métrica "qualidade da narração" + mínimo em `scorer.ts`; refletir na tabela de thresholds.
- **Reuso da US-34:** os casos devem exercitar o caminho real — `buildDmSystemPrompt` (com a seção de ofício) + geração — para que o eval meça exatamente o que o jogador recebe.
- **Custo:** cada caso = 1 geração + 1 (ou N) julgamento(s) de LLM. Manter o conjunto enxuto para o eval não ficar caro/lento no CI.
- **ai-engine dist:** se juiz/rubrica viverem no pacote, exportar no `index` e lembrar do rebuild (`pnpm --filter @ai-dm/ai-engine build`).

---

## Questões em aberto

1. **Qual modelo juiz?** Um modelo mais capaz que o narrador reduz viés, mas custa mais. Um modelo barato basta para *regressão* (detectar queda relativa) mesmo que não seja preciso em termos absolutos? Decidir medindo a estabilidade do juiz.
2. **Escala e threshold.** Nota por dimensão binária (passa/não passa) ou graduada (0–5)? Qual mínimo evita tanto falso-positivo (reprovar prosa boa) quanto falso-negativo (aprovar prosa fraca)? Calibrar com exemplos rotulados à mão.
3. **Relatório persistido.** Vale gravar um relatório por execução (`evals/reports/…`) com narração + notas + justificativas para comparar versões de prompt ao longo do tempo, ou o log de terminal/CI basta no MVP?
4. **Não-determinismo do narrador.** A própria narração varia entre execuções. Fixar seed/temperatura na geração dos casos, ou aceitar variância e confiar na média do juiz?

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
