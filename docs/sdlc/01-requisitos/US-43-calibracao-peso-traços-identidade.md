# US-43 — Calibração do peso dos traços de identidade no prompt (A/B de redação)

**Épico:** 3 — Narração e mecânica
**Fase:** 2 — Memória / continuidade espacial (Fase B)
**Status:** 🗂️ Backlog
**Depende de:** [US-39](./US-39-identidade-narrativa-background-ideais.md) (campos de identidade + redação default) · [US-17](./US-17-comparacao-modelos-eval.md) (harness do bake-off + **modelo já escolhido**)
**Criada em:** 2026-07-09

---

## História

> **Como** desenvolvedora do AI DM,
> **quero** medir qual redação da instrução de identidade faz o mestre honrar as fraquezas/ideais sem virar caricatura,
> **para que** o peso desses traços no prompt seja calibrado por dado, não por chute.

---

## Contexto e motivação

### O problema observado

A [US-39](./US-39-identidade-narrativa-background-ideais.md) injeta background/ideais/vínculos/fraquezas no prompt com uma **redação default** ("deixe colorir quando a cena pedir…"). Mas o peso certo tem dois extremos ruins e o meio **não é legível no texto** — só no comportamento:

- **Fraco:** o mestre ignora a fraqueza → identidade desperdiçada, narração genérica.
- **Forte:** o mestre caricatura → toda cena vira sobre o traço, quebra a imersão.

"Equilíbrio" é uma propriedade do **comportamento medido**, não da frase. Logo, não dá pra fechar no olho — precisa A/B.

### Por que separar da US-39

Calibrar redação é **experimento de tuning**, não feature: precisa de um **modelo já direcionado** (o que o bake-off da [US-17](./US-17-comparacao-modelos-eval.md) escolher), de um cenário que **pressione** a fraqueza, e de rodar variantes de prompt. Acoplar isso à US-39 travaria a entrega dos campos num alvo móvel (o modelo ainda nem foi escolhido). Por isso é US própria, posterior à decisão de modelo.

### A proposta

Um A/B de redação no harness do bake-off: **modelo fixo**, variável = a redação da instrução de identidade. Rodar 2–3 variantes (fraca / equilíbrio-default / forte) num cenário que tenta quebrar a fraqueza, ler **Coerência** (pega "ignorou") vs **Imersão/Voz de NPC** (pega "caricatura"), e promover a vencedora como default no `buildDmSystemPrompt`.

---

## Escopo

### Dentro do escopo

- 2–3 variantes de redação da instrução de identidade (fraca, equilíbrio-default da US-39, forte).
- Um **cenário que pressiona a fraqueza** (ex.: NPC implora à paladina que minta a um guarda para salvar uma criança) — força a escolha entre honrar o voto e o resultado fácil.
- Rodar o bake-off com **modelo fixo** (o escolhido pela [US-17](./US-17-comparacao-modelos-eval.md)) e a redação como variável; ler as notas por eixo.
- Promover a redação vencedora (melhor em Coerência **e** Imersão) como default no builder.

### Fora do escopo

- Adicionar campos de identidade novos — é a [US-39](./US-39-identidade-narrativa-background-ideais.md).
- Comparar **modelos** — é a [US-17](./US-17-comparacao-modelos-eval.md); aqui o modelo é fixo.
- Parametrização de variante de prompt no harness como feature permanente — para um tuning pontual, editar a redação à mão entre execuções basta (YAGNI). Só vale um knob mínimo se a calibração virar recorrente.
- Calibrar o peso de features/divindade ([US-40](./US-40-divindade-do-personagem.md)/[US-41](./US-41-features-traits-de-classe.md)) — mesmo método, mas outra passada; abrir se precisar.

---

## Critérios de aceite

- [ ] Existem ≥2 variantes de redação da instrução de identidade rodáveis no bake-off com modelo fixo.
- [ ] Existe um cenário que pressiona a fraqueza (a escolha "honrar o voto vs resultado fácil" aparece no input).
- [ ] A execução produz uma tabela **redação × eixo** (com Coerência e Imersão em destaque) que distingue as variantes.
- [ ] A redação vencedora é promovida a default no `buildDmSystemPrompt` (commit separado, com o número que justifica).
- [ ] **Eval / regressão:** rodar as variantes no cenário de tentação produz notas que separam "ignorou a fraqueza" (Coerência baixa) de "caricatura" (Imersão baixa).

---

## Notas de implementação

- Reusa o harness do bake-off da [US-17](./US-17-comparacao-modelos-eval.md); só troca a variável de "modelo" para "redação" (modelo fixo). Editar a redação à mão entre execuções é suficiente para um tuning único.
- O cenário de tentação pode entrar como mais um cenário no bake-off ou viver só aqui — decidir na hora; não precisa poluir a matriz de comparação de modelos da US-17.
- Ler os **dois** eixos juntos: um sobe às custas do outro nos extremos; o meio é onde ambos ficam altos.

---

## Questões em aberto

1. **Quantas variantes:** 3 (fraca/meio/forte) basta para achar a direção, ou vale uma 4ª de refino depois? Sugestão: 3 primeiro, refinar só se o meio ficar ambíguo.
2. **Cenário de tentação:** reusar o "Dilema moral" da US-17 (que já pressiona escolha) ou criar um dedicado que tente **quebrar o voto** explicitamente? O dedicado mede melhor a fraqueza; decidir no começo.

---

## Referências no código

- `packages/ai-engine/src/prompts/dm-system.ts` — a instrução de identidade cuja redação está sendo calibrada.
- `packages/ai-engine/src/narrative-bakeoff.test.ts` — harness reaproveitado (variável = redação, modelo fixo).
- `docs/sdlc/01-requisitos/US-39-identidade-narrativa-background-ideais.md` — origem da redação default.
- `docs/sdlc/01-requisitos/US-17-comparacao-modelos-eval.md` — harness + escolha de modelo que esta US pressupõe.
