# US-196 — Narração usa vocabulário que o personagem não teria como conhecer

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
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

**A regra é relativa ao registro (`registry-catalog.ts` → `SETTINGS`), não fixa em medieval-fantasia — mas o PADRÃO, na ausência de registry, continua sendo medieval-fantasia.** O que o personagem "teria como nomear" depende do `setting`/`areaType` daquela aventura: "ozônio" ou "moléculas" quebram imersão em `high-fantasy`/`dark-fantasy`/`mythological`, mas são vocabulário normal em `sci-fi-space-opera` ou `cyberpunk`. `CRAFT_CORE_SECTION` é string estática compartilhada por todos os registries (US-176/US-185 já mostram esse padrão — regra genérica na barra, grounding específico via interpolação de `tone`/`setting`/`areaType` em `buildDmSystemPrompt`, `dm-system.ts:414`), então a frase nova não pode citar "medieval" como se fosse a única opção: tem que dizer algo como "nomeie o que faz sentido no registro desta aventura — se nenhum registro foi definido, assuma fantasia medieval", deixando o julgamento de época a cargo do LLM: registry setado → segue o registry; registry ausente (`setting`/`areaType` undefined, ex. modo Free sem geração de aventura) → cai no default medieval-fantasia que já é a suposição do resto da barra de ofício.

---

## Escopo

### Dentro do escopo

- Nova regra em `CRAFT_CORE_SECTION` (`dm-system.ts`) — vocabulário deve refletir o que o personagem/mundo saberia nomear; nada de termos modernos/científicos/técnicos sem equivalente no registro DAQUELA aventura (a regra referencia o registro da aventura, não hardcoda "medieval-fantasia" — mesmo termo pode ser válido em `sci-fi-space-opera` e inválido em `high-fantasy`).
- **Ajustar `NARRATIVE_CRAFT_SECTION` (`dm-system.ts:228`)** — a linha de LANGUAGE hoje diz "Keep the medieval-fantasy tone, but it must never read like a dubbed or literal translation." Isso é hardcoded e compartilhado por TODOS os registries; contradiz a regra nova (vocabulário condicionado ao `setting`) sempre que a aventura não é `high-fantasy`/`dark-fantasy`. Reescrever pra algo como "keep the tone of this world's register (medieval-fantasy when no registry is set)" — preserva o default atual (medieval-fantasia quando `setting`/`areaType` não vêm, ex. modo Free), só deixa de ser fixo quando um registry explícito diz outra coisa. A parte sobre não soar traduzido/dublado fica igual.
- `DIMENSIONS` em `rubric.ts` ganha eixo novo (`vocabulario`) espelhando a regra, seguindo o padrão dos outros eixos da US-36.
- `REVIEWED_CRAFT_HASH` em `rubric-drift.test.ts` atualizado (a barra muda → o guard de drift exige isso) e a lista de keys obrigatórias do segundo teste ganha `vocabulario`.
- `pnpm --filter @ai-dm/ai-engine build` (dist) e `pnpm eval` verdes.

### Fora do escopo

- **Piso próprio (`DIMENSION_FLOORS`) para `vocabulario`.** Mesma cautela da onomástica (US-70): sem dado de taxa-base ainda, um piso corre risco de flakiness. Fica report-only (só entra na média) até haver sinal de que precisa de piso.
- **Lista fechada de palavras proibidas.** A regra é sobre REGISTRO/registry, não uma blocklist — "ozônio" é normal em `sci-fi-space-opera` e quebra imersão em `high-fantasy`; "obsidiana" é válida num registro (mineral conhecido desde a Antiguidade) e inválida noutro (personagem sem vocabulário geológico); só o juiz/instrução qualitativa cobre isso, não um filtro de string.
- **Sanitizer/guard determinístico pós-geração.** Diferente do guard de números de dado (`:419` do dm-system.ts), não há como detectar "palavra fora de registro" com regex sem falsos positivos constantes. Fica só na instrução + eval, mesmo tratamento do resto da barra de ofício.

---

## Critérios de aceite

- [x] `CRAFT_CORE_SECTION` contém a regra de vocabulário diegético.
- [x] `DIMENSIONS` inclui a chave `vocabulario` com pergunta cobrindo a regra.
- [x] `rubric-drift.test.ts`: `REVIEWED_CRAFT_HASH` bate com o hash atual de `NARRATIVE_CRAFT_SECTION`; teste de cobertura inclui `vocabulario` na lista de keys obrigatórias.
- [x] `pnpm --filter @ai-dm/ai-engine build` sem erros (ai-engine roda de dist).
- [x] **Eval / teste de regressão:** `pnpm eval` verde; adicionar (ou confirmar cobertura em) caso de eval que penaliza narração com termo anacrônico/científico óbvio (ex.: "ozônio", "moléculas") num registro `high-fantasy`/`dark-fantasy` e aprova a versão reescrita com vocabulário período-compatível.
- [x] **Eval de contraste por registry:** caso adicional confirmando que o MESMO termo (ex.: "ozônio") é aceito quando `setting` é `sci-fi-space-opera` ou `cyberpunk` — evita que a rubrica vire uma blocklist de palavras (contradiria a decisão de "Fora do escopo" abaixo).
- [x] **Eval do default sem registry:** caso confirmando que, SEM `setting`/`areaType` (ex. modo Free, sem aventura gerada), "ozônio"/"moléculas" continuam sendo penalizados — a rubrica não pode "relaxar" a regra só porque nenhum registry foi setado; ausência de registry = medieval-fantasia, mesmo comportamento de hoje.
- [x] `NARRATIVE_CRAFT_SECTION` não cita mais "medieval-fantasy" como tom ÚNICO/fixo — linha de LANGUAGE reescrita pra seguir o registry quando setado e cair em medieval-fantasia só como default (ver Notas de implementação).

---

## Notas de implementação

- **Implementada em 2026-08-26.** Bullet novo em `CRAFT_CORE_SECTION` (`dm-system.ts`); linha de LANGUAGE (`:228`) reescrita pra "keep the tone of this world's register (medieval-fantasy when no registry is set)"; `DIMENSIONS` ganhou `vocabulario` (`rubric.ts`); `REVIEWED_CRAFT_HASH` recolado com o hash impresso pelo teste após a mudança; 3 eixos novos de eval em `evals/cases/us-36-qualidade-narracao.ts` (julgamento direto, mesmo padrão do `ANCHOR_SET`: mesmo termo "ozônio/moléculas" em high-fantasy reprova, versão reescrita aprova, mesmo termo em sci-fi-space-opera aprova, sem registro definido reprova de novo). `pnpm --filter @ai-dm/ai-engine build`, `pnpm --filter @ai-dm/ai-engine test` e `pnpm eval` (caso novo pulado sem `OPENROUTER_API_KEY`/`GEMINI_API_KEY` locais, mesmo padrão dos outros casos LLM-judge do arquivo) rodados e verdes.
- Local exato da regra nova: `packages/ai-engine/src/prompts/dm-system.ts`, dentro de `CRAFT_CORE_SECTION` (reusada também pelo motor de geração via `generateLocationsAndNpcs`, então a regra vale para os dois, não só para a narração ao vivo).
- Ordem: mudar a barra primeiro, rodar `rubric-drift.test.ts` (falha e IMPRIME o hash novo na mensagem), colar em `REVIEWED_CRAFT_HASH` — não calcular o hash à mão.
- `pergunta` do eixo novo em `DIMENSIONS` deve citar exemplo concreto (ozônio) igual aos outros eixos fazem (onomástica cita "Elara/Kael/Lyra" como exemplo de slop) — mas o exemplo é ilustrativo, a pergunta não pode fixar "medieval" como registro correto (rubrica é avaliada em qualquer `setting` de `registry-catalog.ts`, incluindo `sci-fi-space-opera`/`cyberpunk`).
- Registro/`setting`/`areaType` já chegam ao juiz e ao DM Agent via interpolação em `buildDmSystemPrompt` (`dm-system.ts:414`), não via `CRAFT_CORE_SECTION` — a regra nova só precisa dizer "nomeie o que faz sentido no registro desta aventura", o prompt já injeta qual é esse registro.

---

## Questões em aberto

1. Vale a pena registrar exemplos de termos problemáticos observados em produção (além de "ozônio"/"obsidiana") antes de fechar a redação da regra e da pergunta da rubrica?
2. ~~Linha "Keep the medieval-fantasy tone" (`dm-system.ts:228`) contradiz regra registry-aware.~~ Resolvida — ver "Dentro do escopo" e critério de aceite novos: linha reescrita pra registro-agnóstica junto com esta US.

---

## Referências no código

- [`packages/ai-engine/src/prompts/dm-system.ts`](../../../packages/ai-engine/src/prompts/dm-system.ts) — `CRAFT_CORE_SECTION`, `NARRATIVE_CRAFT_SECTION`.
- [`packages/ai-engine/src/rubric.ts`](../../../packages/ai-engine/src/rubric.ts) — `DIMENSIONS`, `DIMENSION_FLOORS`.
- [`packages/ai-engine/src/rubric-drift.test.ts`](../../../packages/ai-engine/src/rubric-drift.test.ts) — guard de drift barra↔rubrica.
