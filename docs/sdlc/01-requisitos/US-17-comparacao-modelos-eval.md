# US-17 — Comparação de modelos de narração via evals de coerência

**Épico:** 3 — Narração e mecânica
**Fase:** 2 — Memória / continuidade espacial (Fase B)
**Status:** 📋 Planejada (não iniciada)
**Depende de:** Suite de evals existente (`evals/` + `pnpm eval`, vitest) — já implementada
**Criada em:** 2026-06-30

---

## História

> **Como** desenvolvedora do AI DM,
> **quero** rodar a mesma bateria de cenários de coerência contra vários modelos candidatos e ver o resultado lado a lado (acerto + custo),
> **para que** eu escolha o modelo de narração com base em dado objetivo, e não em "achei que narrou melhor".

---

## Contexto e motivação

### O problema observado

A escolha do modelo de narração hoje é por sensação. O `model.ts` aponta para `minimaxai/minimax-m2.7` como primário e `gpt-oss-120b` como fallback, mas essa decisão nunca foi medida. Existe uma lista de 10 candidatos no NVIDIA NIM (`docs/sdlc/02-design/modelos LLM.md` / `modelos LLM.md`) e nenhuma forma de comparar sem trocar a env var, jogar à mão uns minutos, e adivinhar.

A qualidade que mais distingue um bom DM — **coerência de longo prazo** (lembrar que o NPC mentiu, não teletransportar o personagem, não inventar resultado de dado) — é exatamente a que não dá para julgar em 5 minutos de jogo manual.

### Por que a solução atual não basta

A suite `evals/` (vitest, `runner`/`scorer` por trás de `pnpm eval`) já valida comportamento do DM Agent, **mas roda contra um único modelo** — o `defaultModel` fixo em `model.ts`. Não há como:

1. Apontar a mesma bateria para uma lista de modelos numa só execução.
2. Produzir um comparativo lado a lado (qual modelo acerta mais cada métrica).
3. Pôr custo/latência na mesma tabela para o trade-off "coerência vs preço".

Sem isso, cada troca de modelo é manual e não reaproveita os cenários já escritos.

### A proposta

Parametrizar a suite de evals por **modelo**, adicionar 2–3 **eval cases de coerência** (os casos que só falham se o modelo for incoerente), e gerar um **relatório comparativo** (matriz modelo × métrica + custo). O output é a base objetiva para decidir o `narrationModels` em `model.ts`.

---

## Escopo

### Dentro do escopo

- Capacidade de rodar a suite de evals contra **uma lista de modelos** numa execução (ex.: `pnpm eval --models minimax-m2.7,qwen3.5-397b-a17b,gpt-oss-120b`).
- 2–3 eval cases novos focados em **coerência** (ver abaixo).
- Relatório comparativo: matriz modelo × métrica (acerto por cenário) + coluna de custo/latência aproximados.
- Reuso do `runner`/`scorer` existentes — sem reescrever a suite.

### Fora do escopo

- Trocar o modelo de produção em `model.ts` — isto é a **decisão** que a US habilita, não a entrega. (Pode virar commit separado depois de ver o relatório.)
- Fine-tuning ou ajuste de prompt por modelo. Aqui compara-se o mesmo prompt em todos.
- Avaliação de custo exata por billing real — basta uma estimativa por preço de tabela / contagem de tokens.
- LLM-as-judge sofisticado com rubrica multi-eixo. Começar com o critério mais simples que distingue os modelos (ver Questões em aberto).

---

## Eval cases de coerência (o coração da US)

| Caso | Input (cenário fixo) | Como avalia | Tipo |
|---|---|---|---|
| **NPC consistente** | Histórico onde um NPC mente no turno ~3; jogador confronta no turno ~20 | A resposta reconhece/é coerente com a mentira anterior | LLM-judge |
| **Não rola dados sozinho** | Jogador tenta ação arriscada ("ataco o goblin") | Chamou a tool `rollDice` em vez de inventar o número | Determinístico |
| **Não teletransporta** (reuso US-11b) | "praça (externo) → recebe mapa → olhar o mapa" | Mantém `ambiente=externo`, não inventa mesa/sala, não move o personagem | Determinístico + judge |

O caso "não rola dados sozinho" é determinístico e deve ser o primeiro a implementar — é o mais barato de avaliar e já distingue modelos com tool calling fraco.

---

## Critérios de aceite

- [ ] A suite de evals aceita uma **lista de modelos** e roda os mesmos casos contra cada um numa única execução (flag tipo `--models a,b,c`; sem flag, usa o `defaultModel` como hoje).
- [ ] Existe pelo menos o eval case **determinístico** "não rola dados sozinho" (verifica que `rollDice` foi chamada, não que o resultado foi inventado na prosa).
- [ ] Existe pelo menos um eval case de **coerência narrativa** ("NPC consistente"), avaliado por critério explícito (LLM-judge ou regra de presença).
- [ ] A execução produz um **relatório comparativo** legível: linha por modelo, coluna por métrica/cenário, com acerto (ex.: 8/10) e uma coluna de custo/latência estimados.
- [ ] O relatório é determinístico em estrutura (mesma tabela sempre); só os números variam por causa do não-determinismo do LLM.
- [ ] Rodar a suite **sem** a flag de modelos continua a funcionar exatamente como antes (não quebra `pnpm eval` nem o CI).
- [ ] **Eval / teste de regressão:** rodar `pnpm eval --models <atual>,<um candidato>` produz uma tabela com as duas colunas preenchidas e o caso "não rola dados sozinho" pontuado para ambos.

---

## Notas de implementação

- Parametrizar o modelo no `runner` em vez de importar `defaultModel` fixo — provavelmente injetar o modelo no `EvalCase`/contexto de execução. Os modelos vêm de `packages/ai-engine/src/model.ts` (mesma fábrica `createOpenAICompatible`).
- Reaproveitar `nvidia(...)` / `openrouter(...)` de `model.ts` para instanciar candidatos por id; não duplicar a config de provider.
- Custo/latência: medir tokens via resposta do SDK + tabela de preço estática num pequeno mapa `model → $/1M tokens`. Estimativa basta (ver Escopo).
- Cuidado com o **não-determinismo**: rodar cada caso N vezes (ex.: 3) e reportar a média evita decisão por um único sample com sorte/azar.
- O caso "NPC consistente" precisa de um fixture de histórico longo — guardar em `evals/fixtures/`.
- Custo de API real: rodar contra muitos modelos × N repetições gasta tokens pagos. Manter a lista de candidatos curta (2–3) por execução.

---

## Questões em aberto

1. **Critério do "NPC consistente":** LLM-as-judge (outro modelo pontua 1–5) vs regra de presença (a resposta menciona a mentira/o NPC)? O judge é mais fiel mas adiciona custo e mais um modelo na malha.
2. **Quantas repetições** por caso para a média ser estável sem explodir o custo? (Sugestão inicial: 3.)
3. **Onde mora a tabela de preços** dos modelos? Hardcoded no eval, ou um pequeno JSON em `evals/`?
4. O relatório fica só no stdout, ou também grava um artefato (ex.: `evals/reports/<data>.md`) para comparar execuções ao longo do tempo?

---

## Referências no código

- `packages/ai-engine/src/model.ts` — fábrica de modelos (`createOpenAICompatible`), `narrationModels`, `defaultModel`, `summaryModel`.
- `evals/runner.ts` / `evals/scorer.ts` — executor e pontuação a parametrizar por modelo.
- `evals/cases/us-09-dice-roll.ts` (ou equivalente) — base para o caso determinístico "não rola dados sozinho".
- `evals/cases/us-03-scene-state.ts` — caso de cena já existente, reaproveitável para "não teletransporta".
- `evals/README.md` — estrutura da suite e thresholds atuais.
- `docs/sdlc/02-design/modelos LLM.md` — lista dos 10 candidatos NVIDIA NIM em avaliação.
