# US-70 — Piso por dimensão e robustez do eval de qualidade da narração

**Épico:** 2 — Aventura
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada (critérios de execução ao vivo dependem da run gated no CI com chaves)
**Depende de:** [US-36](./US-36-eval-de-qualidade-da-narracao.md) (eval de qualidade + rubrica + `detectSlopName`) e [US-34](./US-34-qualidade-da-narracao-do-dm.md) (barra de ofício).
**Criada em:** 2026-07-23

---

## História

> **Como** desenvolvedor do DM Agent,
> **quero** que o eval de qualidade reprove quando **uma dimensão crítica** despenca (não só quando a **média** cai) e que ele seja **estável** diante de falhas **intermitentes**,
> **para que** regressões pontuais — um nome de slop, uma abertura sem sentidos, uma queda só na onomástica — não passem escondidas atrás de uma média alta nem virem um CI *flaky*.

---

## Contexto e motivação

A [US-36](./US-36-eval-de-qualidade-da-narracao.md) entregou o eval de qualidade (LLM-as-judge, 11 dimensões, `MÉDIA ≥ 3.5`). A execução real dele em 2026-07-23 expôs **dois furos** que esta US corrige.

### Furo 1 — a média dilui uma queda pontual

Degradar deliberadamente a barra de ofício (remover `NARRATIVE_CRAFT_SECTION` de `dm-system.ts`) **não reprovou** o eval: a narração degradada ainda tirou **média 4.45/5**. Com 11 dimensões, um eixo colapsando some na média — o modelo base é forte e o resto do prompt (formatação, consistência) segura os outros eixos. Ou seja, o critério de aceite "regressão real" da US-36 **não se sustenta** com `MÉDIA` sozinha. Uma queda cirúrgica (só onomástica, ou só sensorial) é exatamente o que a média esconde.

### Furo 2 — falha intermitente vira gate *flaky* ou report-only

A investigação mostrou que o modelo emite nomes de slop ("Elara") em **~3 de 4 amostras** — intermitente, não determinístico. O detector `detectSlopName` (US-36) é determinístico, mas a **entrada varia**: como gate de **1 tiro** ele reprova só na amostra que calhou de dar slop, ficando *flaky* — o que a US-36 proíbe. Por isso hoje ele é **report-only** e **não protege**. Falhas intermitentes precisam ser medidas por **taxa sobre N repetições**, não por um único tiro.

### A proposta

1. **Piso por dimensão** além da média: cada dimensão-chave tem um mínimo próprio; um eixo abaixo do piso reprova mesmo com média alta.
2. **N repetições + taxa** para o que é intermitente: agrega N amostras (reusa `aggregateReps`), gateia dimensões pela **média das reps** (estável) e sinais binários (slop) pela **taxa** (`slop em > X% das reps`).
3. **Meta-teste da lógica de gate** (determinístico, sem API): prova que "uma dim abaixo do piso reprova mesmo com média alta" — o teste do próprio scorer, que roda no `pnpm test`/CI sem custo.
4. **Validação do juiz** (anchor set rotulado): garante que o juiz **rankeia** boa acima de ruim; se ele inverter, o eval inteiro é ruído.
5. **Mais casos/locales** para exercitar dimensões hoje sub-cobertas.

---

## Escopo

### Dentro do escopo

- **Piso por dimensão.** Além de `MÉDIA ≥ QUALITY_THRESHOLD`, cada dimensão-chave `≥ FLOOR`. Const nova em `rubric.ts`: `DIMENSION_FLOORS: Partial<Record<Dimension['key'], number>>` (só as chaves com piso; ausência = sem piso próprio). Dims-chave iniciais — as que a barra dirige e a média esconde: **onomástica, sensorial, tensão, concretude, língua pt-BR**. Valores calibrados (proposta inicial `3`), ajustáveis.
- **Repetições + agregação.** Rodar cada caso `N` vezes (`N` pequeno, ex. 3; env `JUDGE_REPS` como no bake-off) e agregar com o `aggregateReps` **já existente** (dá `perDim` = média por dimensão + `spread`). O gate de piso e o de média usam o `perDim`/`media` agregados, não um tiro — mata a flakiness.
- **Gate determinístico de slop por TAXA.** Contar reps com `detectSlopName().slop`; `slopRate = fails/N`. Reprova se `slopRate > SLOP_RATE_MAX` (proposta `0.5`); abaixo disso, avisa. Promove o detector de report-only (US-36) a **gate real, mas não-flaky**.
- **Meta-teste puro da lógica de gate.** Extrair a decisão de aprovação para uma função pura `gateQuality({ perDim, media, slopRate })` e testá-la **sem API** (`pnpm test`): um `perDim` com **média alta mas uma dim abaixo do piso** deve **reprovar**. É o "detector do detector" — prova, de graça e determinístico, que o piso pega o que a média deixa passar (fecha o Furo 1 sem depender de rodar o juiz).
- **Validação do juiz (anchor set).** Um punhado de narrações **rotuladas à mão** (2–3 claramente boas, 2–3 claramente ruins/genéricas) que o juiz deve pontuar na ordem certa (boas > ruins por margem). Roda no caminho gated (precisa de chave). Detecta **deriva do juiz** (troca de slug/modelo, mudança de comportamento) — sem isso, uma regressão no juiz passa por regressão na narração.
- **Mais casos e locales.** Adicionar cenários que exercitam dimensões hoje sub-cobertas: **combate** (com `rollDice`), **baixo HP** (tom/stakes), **NPC vulnerável** (voz de NPC), **turno em inglês** (verifica que `língua pt-BR` vira *n/a*, não penaliza), **sistema Free**. Reusa fixtures da US-36.
- **Documentar os novos thresholds** (`DIMENSION_FLOORS`, `SLOP_RATE_MAX`, `JUDGE_REPS`) em `evals/README.md` e na estratégia de testes.

### Fora do escopo

- **Enforcement em produção** (regenerar a narração quando `detectSlopName` pega). É uma US irmã — decisão de custo/latência própria. Aqui só medição/gate **no eval**; produção segue com a **observabilidade** passiva da US-36 (log no `onFinish`).
- **Reescrita da barra de ofício** (US-34/US-43). A US-36 já mostrou que o reword do prompt **não elimina** o slop (prior forte); o lever é código, não prompt. Fora daqui.
- **Fine-tuning ou troca do modelo de narração.** O eval informa; não executa.
- **Monitoramento online amostrado em produção** (painel/telemetria de qualidade em prod). US própria de eval online.

---

## Abordagem técnica

- **Piso:** no caso da US-36, além do `expect(media ≥ QUALITY_THRESHOLD)`, iterar `DIMENSION_FLOORS` e `expect(perDim[k] ≥ floor)` por chave. `perDim` vem do `aggregateReps` (média das reps). Mensagem de erro nomeia a dimensão e o valor — o relatório já mostra a justificativa do juiz para aquele eixo.
- **Reps:** `JUDGE_REPS` (default 3) como o bake-off; loop por caso, coletar `RubricScore[]`, `aggregateReps` → `perDim`+`media`. Custo `N×` gerações+juízes — manter `N` e o conjunto de casos **enxutos** (a US-36 já alerta o custo do CI).
- **Taxa de slop:** contar `detectSlopName` sobre as `N` narrações de cada caso; comparar `slopRate` a `SLOP_RATE_MAX`. Determinístico por narração; a taxa suaviza a intermitência.
- **`gateQuality` puro:** função sem API que recebe `{ perDim, media, slopRate }` + as consts e devolve `{ passed, reasons }`. O caso gated a chama com dados reais; o `pnpm test` a chama com dados **sintéticos** (média 4.6 + `onomastica: 2` → deve reprovar por piso). Zero custo, determinístico.
- **Anchor set:** fixtures `{ narration, expectRange: 'alta'|'baixa' }`; assert que a média do juiz das "alta" > das "baixa" por uma margem. Reusa `judgeTurn`.
- **Determinismo/flakiness:** o piso opera sobre a **média de N reps** (não 1 tiro) e o juiz roda com temperatura baixa (US-36) — o alvo é um eval que não alterna pass/fail no limiar. Um caso exatamente no piso é o risco; calibrar o piso com folga dos exemplos rotulados.

---

## Critérios de aceite

- [x] Existe `DIMENSION_FLOORS` em `rubric.ts` e o eval reprova quando **uma dimensão-chave** fica abaixo do piso, **mesmo com a média acima do threshold**.
- [x] **(fecha o Furo 1)** Um teste **puro** (`pnpm test`, sem API) prova que `gateQuality` reprova um `perDim` de **média alta com uma dimensão abaixo do piso** — a lógica que a média sozinha deixava passar. (`rubric.test.ts` → "FECHA O FURO 1")
- [x] O eval roda cada caso `JUDGE_REPS` vezes e o gate de dimensão/média opera sobre a **agregação** (`aggregateReps`), não sobre um único tiro.
- [~] **(Furo 2 — mecanismo pronto, gate adiado)** `detectSlopName` é medido por **taxa** (`slopRate` sobre N reps) e **avisado**, mas **report-only por ora**: a matriz real mostrou taxa-base de slop ~40% colada no `SLOP_RATE_MAX`, então gatear a REPS=3 seria *flaky* (violaria a AC "não-flaky"). Vira gate — uma linha, encanamento pronto — quando a produção reduzir o slop (US irmã de enforcement, fora de escopo). Decisão de calibração registrada.
- [x] Há um **anchor set** rotulado e um caso (gated) que reprova se o juiz **não** pontuar as narrações "boas" acima das "ruins" por margem.
- [x] Novos casos cobrem: baixo HP, NPC vulnerável, **turno em inglês** (ação do jogador em inglês → `língua pt-BR` = *n/a*, sem penalizar) e sistema Free. Todos de **narração pura**. Combate/rolagem ficaram FORA (decisão): instrumentar `rollDice` no `generateNarration` abria uma trajetória tool-loop frágil (o modelo às vezes gastava os passos em tool calls e devolvia narração VAZIA) — a própria flakiness que a US quer matar. O eval julga a PROSA; a trajetória de tool calling é a US-08/09.
- [x] `DIMENSION_FLOORS`, `SLOP_RATE_MAX` e `JUDGE_REPS` documentados em `evals/README.md` e na estratégia de testes.
- [x] **(regressão real, agora com dente)** Degradar a barra de ofício (remover `NARRATIVE_CRAFT_SECTION`) **reprova** o eval — via piso de `sensorial`/`concretude`/`onomástica`, mesmo que a média continue acima de 3.5. *(mecanismo pronto; a comprovação exige a run gated com chaves.)*
- [x] O eval segue **não-flaky** numa faixa razoável de execuções: piso sobre a **média de N reps** (não tiro único); casos de **narração pura** (sem rolagem — combate/dados fora, que abriam a trajetória tool-loop que devolvia narração vazia, a maior fonte de flakiness achada rodando o eval); rep que falha é **pulada** (stall do provider não derruba o run); slop **report-only** (não cruza o limiar por azar de amostra).

---

## Notas de implementação

- **Reuso:** `aggregateReps`, `estimateCost`, `renderQualityReport`, `detectSlopName`, `judgeTurn` já existem (US-17/US-36). Esta US **estende os asserts e o relatório**, não recria o motor.
- **Custo:** `N` reps × M casos × (1 geração + 1 juiz). Cada caso novo multiplica; manter o conjunto enxuto e considerar `JUDGE_REPS=1` no *smoke* local e `3` no CI.
- **Relatório:** incluir por dimensão a nota agregada + `spread` (já disponível) e a `slopRate` do caso, para ler *qual* eixo/quantas reps caíram.
- **Calibração dos pisos:** derivar dos exemplos rotulados do anchor set (a mesma fonte que valida o juiz), não de chute — um piso mal calibrado é a maior fonte de flakiness.
- **ai-engine dist:** `gateQuality`/consts novas exportadas no `index` → rebuild (`pnpm --filter @ai-dm/ai-engine build`).

---

## Decisões em aberto (para o refinamento)

1. **Valores dos pisos e da taxa.** `FLOOR=3` por dimensão-chave e `SLOP_RATE_MAX=0.5` são propostas — calibrar com o anchor set antes de fixar. Piso alto demais = flaky; baixo demais = não morde.
2. **Quais dimensões ganham piso.** Começar pelas que a barra dirige e a média esconde (onomástica, sensorial, tensão, concretude, língua pt-BR); as demais só entram na média. Revisar após ver a matriz.
3. **`N` no CI.** `3` é o default do bake-off; subir dá estabilidade mas multiplica custo. Medir antes de aumentar.
4. **Pesos por dimensão.** `WEIGHTS` (hoje 1.0) fica como está até haver evidência de que um eixo deve pesar mais — não ponderar antes de ver a matriz (mesma decisão da US-17).

---

## Referências no código

- `evals/cases/us-36-qualidade-narracao.ts` — caso a estender (piso, reps, taxa, anchor).
- `packages/ai-engine/src/rubric.ts` — `QUALITY_THRESHOLD`, `aggregateReps`, `meanOfScore`; adicionar `DIMENSION_FLOORS` e `gateQuality`.
- `packages/ai-engine/src/guardrails.ts` — `detectSlopName` (vira gate por taxa).
- `packages/ai-engine/src/rubric-drift.test.ts` — guard de drift da barra (contexto).
- `evals/README.md` e `docs/sdlc/04-testes/estrategia-de-testes.md` — tabelas de thresholds a atualizar.
- `docs/sdlc/01-requisitos/US-36-eval-de-qualidade-da-narracao.md` — origem do eval e da investigação que motivou esta US.
