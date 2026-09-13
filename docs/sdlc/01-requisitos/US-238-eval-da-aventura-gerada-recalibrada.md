# US-238 — Eval da aventura gerada, recalibrada

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** 📋 Proposta (fora do corte mínimo)
**Depende de:** [US-232](./US-232-schema-cresce-e-prompt-de-autoria-call-unico.md) (o artefato a avaliar) · [US-239](./US-239-motor-em-createforcharacter-ledger-e-aposenta-gancho.md) (motor no caminho de criação, pro live eval opcional) · [US-154](./US-154-eval-aventura-gerada.md) (eval original — esta story **recalibra**)
**Relacionado:** [US-36](./US-36-eval-de-qualidade-da-narracao.md) (LLM-judge + rubrica) · [ADR 012](../../adr/012-aventura-gerada-como-dado.md) (D7 — âncora de eval) · [Arquitetura — §Âncora de eval](../../arquitetura-motor-aventuras-autorais.md) · [Backlog — MA-8](./backlog-motor-de-geracao-de-aventuras.md)
**Criada em:** 2026-09-13

---

## História

> **Como** desenvolvedora,
> **quero** medir a qualidade da aventura gerada contra exemplares reais e por asserts sobre o artefato, não só pela nota de um juiz que satura —
> **para que** regressão de qualidade seja pega de verdade, e não escondida atrás de um "5/5" automático.

---

## Contexto e motivação

O determinismo byte-a-byte morreu (ADR 012 D1). "Regressão" agora é medir **rubrica sobre amostra** a partir de perfis pinados. Duas descobertas do Spike moldam esta story: (1) o **juiz LLM satura** nesta tarefa (quase tudo 5/5 — inútil pra ranquear), então a nota não pode ser o sinal decisivo; (2) agora existem **exemplares** solo/pt-BR/autorais — a lacuna que o backlog velho lamentava está preenchida: *O Olho de Iremet* (prosa) e *A Cripta do Véu Silencioso* (estrutura das 8 seções). A rubrica ancora em **asserts sobre o artefato**, verificáveis, não na nota do juiz.

---

## Escopo

### Dentro do escopo

- **Exemplares de referência:** *O Olho de Iremet* (prosa/densidade) + *A Cripta do Véu Silencioso* ([evals/exemplars/](../../../evals/exemplars/cripta-do-veu-silencioso.md), estrutura das 8 seções + Challenges/Objective).
- **Asserts sobre o artefato** (o sinal duro, não a nota do juiz): grafo fecha (toda ref por `id` existe); `secretId` marcado oculto continua oculto; NPC referenciado existe; orçamento de cada encontro cabe no nível; exatamente 3 facções com `want` distintos; `objective` com `reward`; ≥N `challenges[]` não-combate; nenhum número de mecânica na prosa (reusa o saneamento da US-234).
- **Rubrica (US-36/154) sobre amostra pinada** como sinal **secundário** — roda, mas a decisão de regressão é dos asserts (juiz satura).
- **Quase-determinismo pra testar pipeline** (não criatividade): `temperature: 0` + versão de modelo pinada sobre os perfis fixos.
- **Live eval opcional** no caminho de criação (mesmo molde do `DM_LIVE_EVAL` da US-36).

### Fora do escopo

- **O juiz como gate** — ele satura; nunca bloqueia persistência (isso é o gate de grafo/orçamento, US-234).
- **Gate de presunção "tábula rasa" automatizado** — hoje é olho (o achado do spike foi visual); um assert robusto pra "nenhum NPC já conhece o personagem" é trabalho futuro, não desta story.
- **A geração em si** (US-232) e o gate (US-234) — esta story mede, não gera nem valida-pra-persistir.

---

## Critérios de aceite

- [ ] A suite roda sobre um conjunto **pinado de perfis** e produz asserts sobre o artefato (grafo fecha, `secretId` oculto, NPC existe, orçamento cabe, 3 facções, `objective.reward`, `challenges[]` não-combate, prosa sem número).
- [ ] Os dois exemplares (*O Olho de Iremet*, *A Cripta do Véu Silencioso*) são as referências da rubrica; a de estrutura vem de `evals/exemplars/`.
- [ ] A nota do juiz é registrada mas **não** é o critério de aprovação/reprovação (documentado que satura).
- [ ] Quase-determinismo (`temperature: 0` + modelo pinado) disponível pro teste de pipeline, separado da variedade de produção.
- [ ] **Regressão:** rodar a suite contra um artefato deliberadamente quebrado (grafo órfão, ou número na prosa) **falha** nos asserts; artefato bom passa.

---

## Notas de implementação

- Reusar o runner/rubrica da US-36 (`gemini` judge) — mas o peso decisório vai pros asserts, mesma lição do bake-off (juiz que satura não discrimina; US-17).
- Reusar o saneamento da US-234 pra o assert "sem número na prosa" — não escrever um segundo detector.
- Exemplar de estrutura já existe em [evals/exemplars/cripta-do-veu-silencioso.md](../../../evals/exemplars/cripta-do-veu-silencioso.md); *O Olho de Iremet* é o artefato de prosa (referência externa).

---

## Questões em aberto

1. **Automatizar o assert de tábula rasa?** Hoje a presunção de passado (NPC que já conhece o personagem, dívida pré-jogo) é pega a olho. Um assert confiável exigiria detectar referência a `bonds`/`story` na saída — trabalho futuro; registrado.

---

## Referências no código

- [US-154](./US-154-eval-aventura-gerada.md) — eval original que esta recalibra.
- [US-36](./US-36-eval-de-qualidade-da-narracao.md) — LLM-judge + rubrica, runner a reusar.
- [evals/exemplars/cripta-do-veu-silencioso.md](../../../evals/exemplars/cripta-do-veu-silencioso.md) — exemplar de estrutura.
- [Backlog — MA-8](./backlog-motor-de-geracao-de-aventuras.md).
