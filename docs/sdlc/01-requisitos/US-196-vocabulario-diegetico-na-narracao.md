# US-196 — Narração usa vocabulário que o personagem não teria como conhecer

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** nenhuma
**Relacionado:** [US-34](./US-34-qualidade-da-narracao-do-dm.md) (barra de ofício original — `NARRATIVE_CRAFT_SECTION`/`CRAFT_CORE_SECTION`) · [US-36](./US-36-eval-de-qualidade-da-narracao.md) (rubrica `DIMENSIONS` que espelha a barra + guard de drift) · [US-70](./US-70-piso-por-dimensao-e-robustez-do-eval.md) (pisos por dimensão e por que onomástica ficou report-only)

**Criada em:** 2026-08-24 — a pedido da mantenedora: narração via DeepSeek usa palavras como "ozônio" ou "obsidiana" mesmo quando o personagem não teria como conhecer o termo ou interpretá-lo.

---

## História

> **Como** jogadora,
> **quero** que a narração só use palavras e conceitos que o personagem, no mundo da aventura, teria como reconhecer,
> **para que** a prosa não quebre a imersão com vocabulário moderno/técnico fora do registro medieval-fantasia.

---

## Contexto e motivação

### O problema observado

A narração ocasionalmente emprega termos que pertencem ao vocabulário de QUEM ESCREVE (o modelo), não ao do personagem que vive a cena — por exemplo "ozônio" (conceito de química moderna) para descrever o cheiro depois de um raio, onde nenhum personagem de um mundo medieval-fantasia teria essa palavra ou o conceito por trás dela.

### Por que a solução atual não basta

`CRAFT_CORE_SECTION` (`packages/ai-engine/src/prompts/dm-system.ts:208`) já pede abertura pelos sentidos e concretude ("Be concrete and NAME things"), mas nada na barra de ofício restringe o REGISTRO do vocabulário — a instrução otimiza para "específico", e "ozônio" É específico, só que do lado errado da quarta parede. `ONOMASTICS_SECTION` cobre nomes próprios (pessoas/lugares/coisas), não vocabulário comum (substantivos, sensações, fenômenos).

### A proposta

Acrescentar à barra de ofício uma regra de vocabulário diegético: a prosa deve nomear o que o personagem NOMEARIA nesse mundo, preferindo a sensação crua ou o termo período-compatível a jargão moderno/científico. Medir isso na rubrica do eval de qualidade (US-36), do mesmo jeito que as outras exigências da barra já são medidas.

---

## Escopo

### Dentro do escopo

- Nova regra em `CRAFT_CORE_SECTION` (`dm-system.ts`) — vocabulário deve refletir o que o personagem/mundo saberia nomear; nada de termos modernos/científicos/técnicos sem equivalente no registro medieval-fantasia.
- `DIMENSIONS` em `rubric.ts` ganha eixo novo (`vocabulario`) espelhando a regra, seguindo o padrão dos outros eixos da US-36.
- `REVIEWED_CRAFT_HASH` em `rubric-drift.test.ts` atualizado (a barra muda → o guard de drift exige isso) e a lista de keys obrigatórias do segundo teste ganha `vocabulario`.
- `pnpm --filter @ai-dm/ai-engine build` (dist) e `pnpm eval` verdes.

### Fora do escopo

- **Piso próprio (`DIMENSION_FLOORS`) para `vocabulario`.** Mesma cautela da onomástica (US-70): sem dado de taxa-base ainda, um piso corre risco de flakiness. Fica report-only (só entra na média) até haver sinal de que precisa de piso.
- **Lista fechada de palavras proibidas.** A regra é sobre REGISTRO/época, não uma blocklist — "obsidiana" pode ser válida num contexto (mineral conhecido desde a Antiguidade) e inválida noutro (personagem sem vocabulário geológico); só o juiz/instrução qualitativa cobre isso, não um filtro de string.
- **Sanitizer/guard determinístico pós-geração.** Diferente do guard de números de dado (`:419` do dm-system.ts), não há como detectar "palavra fora de registro" com regex sem falsos positivos constantes. Fica só na instrução + eval, mesmo tratamento do resto da barra de ofício.

---

## Critérios de aceite

- [ ] `CRAFT_CORE_SECTION` contém a regra de vocabulário diegético.
- [ ] `DIMENSIONS` inclui a chave `vocabulario` com pergunta cobrindo a regra.
- [ ] `rubric-drift.test.ts`: `REVIEWED_CRAFT_HASH` bate com o hash atual de `NARRATIVE_CRAFT_SECTION`; teste de cobertura inclui `vocabulario` na lista de keys obrigatórias.
- [ ] `pnpm --filter @ai-dm/ai-engine build` sem erros (ai-engine roda de dist).
- [ ] **Eval / teste de regressão:** `pnpm eval` verde; adicionar (ou confirmar cobertura em) caso de eval que penaliza narração com termo anacrônico/científico óbvio (ex.: "ozônio", "moléculas") e aprova a versão reescrita com vocabulário período-compatível.

---

## Notas de implementação

- Local exato da regra nova: `packages/ai-engine/src/prompts/dm-system.ts`, dentro de `CRAFT_CORE_SECTION` (reusada também pelo motor de geração via `generateLocationsAndNpcs`, então a regra vale para os dois, não só para a narração ao vivo).
- Ordem: mudar a barra primeiro, rodar `rubric-drift.test.ts` (falha e IMPRIME o hash novo na mensagem), colar em `REVIEWED_CRAFT_HASH` — não calcular o hash à mão.
- `pergunta` do eixo novo em `DIMENSIONS` deve citar exemplo concreto (ozônio) igual aos outros eixos fazem (onomástica cita "Elara/Kael/Lyra" como exemplo de slop).

---

## Questões em aberto

1. Vale a pena registrar exemplos de termos problemáticos observados em produção (além de "ozônio"/"obsidiana") antes de fechar a redação da regra e da pergunta da rubrica?

---

## Referências no código

- [`packages/ai-engine/src/prompts/dm-system.ts`](../../../packages/ai-engine/src/prompts/dm-system.ts) — `CRAFT_CORE_SECTION`, `NARRATIVE_CRAFT_SECTION`.
- [`packages/ai-engine/src/rubric.ts`](../../../packages/ai-engine/src/rubric.ts) — `DIMENSIONS`, `DIMENSION_FLOORS`.
- [`packages/ai-engine/src/rubric-drift.test.ts`](../../../packages/ai-engine/src/rubric-drift.test.ts) — guard de drift barra↔rubrica.
