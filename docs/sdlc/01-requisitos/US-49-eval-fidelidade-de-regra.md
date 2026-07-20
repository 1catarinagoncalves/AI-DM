# US-49 — Eval de fidelidade às regras do SRD

**Épico:** 3 — Narração e mecânica
**Fase:** 1 — MVP single-player
**Status:** 🗂️ Backlog
**Depende de:** [US-48](./US-48-getrule-corpus-de-regras.md) (tool `getRule` + corpus) · [US-47](./US-47-ingestao-srd-como-dado.md) (config populado)
**Relacionado:** [US-17](./US-17-comparacao-modelos-eval.md) (juiz LLM + rubrica do bake-off) · [US-36](./US-36-eval-de-qualidade-da-narracao.md) (suite de eval da narração) · [US-29](./US-29-saneamento-de-rolagens-ficticias.md) (saneamento de número na prosa)
**Criada em:** 2026-07-11

---

## História

> **Como** desenvolvedora,
> **quero** um eval que falhe quando o mestre **inventa regra** em vez de consultar o SRD,
> **para que** a fidelidade às regras seja uma trava de regressão, não uma esperança — do mesmo jeito que a qualidade narrativa já é ([US-36](./US-36-eval-de-qualidade-da-narracao.md)).

---

## Contexto e motivação

### O problema observado

A [US-48](./US-48-getrule-corpus-de-regras.md) dá ao mestre a tool `getRule`, e o prompt já proíbe inventar regra. Mas "não inventar" não é verificável sem um eval: nada impede uma regressão futura (mudança de prompt, troca de modelo, bump do dataset) de fazer o mestre voltar a alucinar o efeito de uma condição ou a área de uma magia.

### Por que a solução atual não basta

O CLAUDE.md exige rodar `pnpm eval` ao mexer no DM Agent ou em qualquer tool — e `getRule` é uma tool nova no agente. A suite de eval de hoje ([US-36](./US-36-eval-de-qualidade-da-narracao.md)) mede **qualidade narrativa**, não **fidelidade de regra**. Falta o cenário que assere: dada uma situação que exige regra, o mestre **consulta** e narra **coerente** — e não escreve número mecânico na prosa.

### A proposta

Casos de eval em `evals/` que montam turnos onde a regra é necessária (condição rara, magia de área, ação de combate) e verificam duas coisas: (1) o agente **chama `getRule`** em vez de inventar; (2) a narração fica **coerente com o SRD** e **sem número na prosa** (o número é do `rollDice`, saneado pela [US-29](./US-29-saneamento-de-rolagens-ficticias.md)). Reusa o juiz LLM + rubrica do bake-off da [US-17](./US-17-comparacao-modelos-eval.md).

---

## Escopo

### Dentro do escopo

- Casos em `evals/cases/us-49-fidelidade-regra.ts` (ou equivalente ao padrão da suite) cobrindo ao menos:
  - **Condição:** situação onde uma condição do SRD se aplica (ex.: "Enfeitiçado", "Caído") — o mestre consulta e narra o efeito certo.
  - **Magia de área:** jogador conjura uma magia com alcance/área definidos (ex.: "Bola de Fogo") — narração coerente com o SRD, **sem** número de dano na prosa.
  - **Ação de combate:** uma ação com regra (ex.: "Agarrar/Grapple") — consulta em vez de invenção.
- **Assert de comportamento da tool:** nos cenários acima, o trace do agente contém a chamada `getRule` com a consulta pertinente.
- **Assert de fidelidade:** rubrica ancorada no SRD, avaliada pelo **juiz externo ao Groq** (gemini-flash-latest, o mesmo que discrimina no bake-off — ver memória US-17).
- **Assert de saneamento:** a prosa não contém número de resultado de teste/dano (reusa a checagem da [US-29](./US-29-saneamento-de-rolagens-ficticias.md)).
- Roda em `pnpm eval` e entra no gate de "mexeu no agente/tool → eval passa" do CLAUDE.md.

### Fora do escopo

- **Cobrir todo o SRD** — o eval é uma amostra de regressão (algumas condições, uma magia de área, uma ação), não um teste exaustivo de cada regra.
- **Qualidade narrativa** — é a [US-36](./US-36-eval-de-qualidade-da-narracao.md)/[US-17](./US-17-comparacao-modelos-eval.md); aqui o foco é fidelidade de regra.
- **Correção do valor numérico** (dano exato) — é o `rollDice`/[US-38](./US-38-rolagens-ancoradas-na-ficha.md); a prosa é qualitativa por design.
- **Bake-off de modelos** — este eval é pass/fail de regressão num modelo; a comparação entre modelos é a [US-17](./US-17-comparacao-modelos-eval.md).

---

## Modelo de dados proposto

> Sem dados novos. Casos de eval reusam a infraestrutura da suite existente (runner + juiz LLM).

Forma de um caso:

```ts
{
  name: 'condição — Enfeitiçado consultado, não inventado',
  setup: /* personagem + cena onde a condição se aplica */,
  playerAction: 'tento resistir ao encanto da criatura',
  asserts: {
    toolCalled: 'getRule',           // consultou a regra
    judgeRubric: 'efeito de Enfeitiçado coerente com o SRD',
    noDiceNumberInProse: true,       // reusa saneamento US-29
  },
}
```

---

## Critérios de aceite

- [ ] Existem casos de eval para **condição**, **magia de área** e **ação de combate** em `evals/`.
- [ ] Em cada caso, o eval verifica que o agente **chamou `getRule`** com a consulta pertinente (assert sobre o trace de tools).
- [ ] Um juiz LLM (externo ao Groq, padrão da [US-17](./US-17-comparacao-modelos-eval.md)) pontua a **coerência com o SRD** por rubrica ancorada.
- [ ] O eval falha se a prosa contiver número de resultado mecânico (reusa a checagem da [US-29](./US-29-saneamento-de-rolagens-ficticias.md)).
- [ ] `pnpm eval` roda esses casos; o comando é o gate do CLAUDE.md para mudanças no agente/tool.
- [ ] **Regressão negativa (controle):** um caso onde `getRule` está desligada/corpus vazio **falha** o eval — provando que o eval realmente pega invenção de regra, e não passa por acaso.

---

## Notas de implementação

- **Reusar o runner e o juiz** da suite existente (memória US-17: runner próprio `run-bakeoff.mjs`, não vitest; juiz `gemini-flash-latest` discrimina, `gpt-4o-mini` satura). Não montar infra nova de eval.
- **Assert sobre o trace, não só o texto:** a metade "consultou a regra" precisa olhar as tool calls do agente, não apenas a prosa final — narrar coerente por acaso não deve passar.
- **Ancorar a rubrica no SRD:** o juiz recebe o trecho do SRD como referência (o mesmo corpus da [US-48](./US-48-getrule-corpus-de-regras.md)), para pontuar contra o texto de record, não contra o conhecimento geral do juiz.
- **Cuidado com quota:** a suite de bake-off já bate em limites de quota (memória US-17) — manter o conjunto de casos pequeno e focado.
- **Determinismo do assert de tool:** a chamada `getRule` é observável e determinística; use-a como o sinal duro (pass/fail), e o juiz LLM como o sinal de qualidade (coerência).

---

## Questões em aberto

1. **Quantos casos?** Começar com 3 (condição, magia de área, ação) e crescer só quando uma regressão real escapar — a suite não deve virar catálogo do SRD. Sugestão: 3 no MVP.
2. **Modelo sob teste:** rodar o eval só no modelo primário (Groq `gpt-oss-120b`, memória do provider) ou em todos os candidatos? Sugestão: primário no gate de regressão; comparação entre modelos fica na [US-17](./US-17-comparacao-modelos-eval.md).
3. ~~**Spells 5.1 no eval.**~~ **Resolvida (2026-07-14).** A US-47 trocou a fonte para **Open5e**, que traz as magias 2024 nativas — não há mais stopgap de SRD 5.1. Toda rubrica ancora no **SRD 5.2 (2024)**, uma edição só, sem ressalva a registrar no caso.
4. **Regra em EN, narração em PT:** o corpus do `getRule` provavelmente fica em inglês ([US-48](./US-48-getrule-corpus-de-regras.md), questão 3) enquanto o mestre narra em português. O eval é o lugar certo para medir se isso degrada: a rubrica deve avaliar a **narração em PT** (saída), não o idioma do trecho consultado (insumo) — e um caso deve pegar justamente o risco de o mestre vazar termo em inglês na mesa.

---

## Referências no código

- `evals/` — suite e runner existentes (base para os novos casos).
- `packages/ai-engine/src/narrative-bakeoff.test.ts` — padrão de caso/juiz do bake-off da [US-17](./US-17-comparacao-modelos-eval.md).
- `packages/ai-engine/src/rubric.ts` — rubrica ancorada (reusar a forma para a rubrica de regra).
- `packages/ai-engine/src/guardrails.ts` — saneamento de número na prosa ([US-29](./US-29-saneamento-de-rolagens-ficticias.md)).
- `packages/ai-engine/src/tools/get-rule.ts` — tool cujo trace o eval observa (ver [US-48](./US-48-getrule-corpus-de-regras.md)).
