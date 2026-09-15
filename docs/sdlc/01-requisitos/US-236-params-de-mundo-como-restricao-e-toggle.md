# US-236 — Params de mundo como restrição no prompt + toggle pronta×criar

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada — achada já feita dentro da US-232 (nenhum commit citava US-236 até este fechamento retroativo, 2026-09-15). Só faltava o teste do AC5 cobrindo os 3 eixos juntos + fallback "livre" (adicionado).
**Depende de:** [US-232](./US-232-schema-cresce-e-prompt-de-autoria-call-unico.md) (o prompt de autoria que recebe a restrição) · [US-156](./US-156-catalogos-registro-dto-validacao.md) (catálogos `settings`/`tones`/`areaTypes`, chave+rótulo) · [US-184](./US-184-jogador-escolhe-setting-e-areatype.md) (tela devolve os seletores de cenário/tipo de área — US-157 ficou só com `tone` depois da US-173)
**Relacionado:** [US-216](./US-216-escolher-aventura-pronta-ou-criar-propria-historia.md)/[US-217](./US-217-aventura-pronta-sem-motor-de-geracao.md) (toggle pronta×criar) · [US-161](./US-161-jogador-escolhe-nivel-de-desafio-do-encontro.md)/[US-165](./US-165-tela-escolhe-nivel-de-desafio.md) (desafio → orçamento, não autoria) · [US-105](./US-105-raca-e-classe-por-chave-do-srd.md) (chave canônica + rótulo por locale) · [Backlog — MA-6](./backlog-motor-de-geracao-de-aventuras.md)
**Criada em:** 2026-09-13

---

## História

> **Como** jogador,
> **quero** que minhas escolhas de cenário/tom/área **restrinjam** o mundo que o modelo inventa (em vez de indexar uma tabela), e um botão claro entre "Aventura pronta" e "Criar minha história" —
> **para que** eu dirija o gênero sem perder a autoria, e escolha se quero o motor ou o gancho fixo.

---

## Contexto e motivação

Sob a montagem-por-tabela, os quatro knobs da tela "O Mundo da Aventura" (US-157) **indexavam rolagens**. Sob a inversão (ADR 012 D5), eles **restringem o que o modelo autora**. Muda também a semântica de "Aleatório": na US-156 original, ausência = seed sorteava; com o `seed` morto (ADR 012 D1), ausência = **o modelo escolhe** (rédea livre nesse eixo). E o toggle "Aventura pronta × Criar minha história" (US-216/217) decide se o motor roda.

---

## Escopo

### Dentro do escopo

- **Knob vira restrição no prompt (US-232), não índice de tabela.** Mapeamento:
  - **Cenário** (`setting`) → linha "Cenário: <rótulo>" — o modelo inventa um mundo autoral **dentro** do gênero.
  - **Tom** (`tone`) → "Tom: <rótulo>", governa o registro emocional.
  - **Tipo de Área** (`areaType`) → "Tipo de área: <rótulo>", ancora a geografia.
- **Rótulo pt-BR (ou descrição), nunca a chave.** O artefato grava a chave (`grimdark`) pra eval/filtro; o prompt recebe o rótulo (resolução via catálogo `SystemCatalogEntry`, US-156/US-105).
- **"Aleatório" = campo OMITIDO do prompt** = modelo livre nesse eixo (muda a semântica da US-156: não é mais seed sorteando).
- **Toggle pronta×criar (US-216/217) roteia:** "Aventura pronta" = gancho de classe fixo (US-217), **não roda o motor**; "Criar minha história" = motor mundo-primeiro (US-232) com os três knobs.
- **Desafio (US-161/165) NÃO entra na autoria** — alimenta o orçamento do encontro (MA-3/US-233): `adventure` = `encounterDeadlyThreshold`, `challenge` = `singleMonsterCrCap`. Eixo de dificuldade, não de mundo.

### Fora do escopo

- **O prompt de autoria em si** — US-232 (esta story só decide o que entra nele e como).
- **O orçamento do encontro** — US-233/MA-3 (esta story só roteia o desafio pra lá).
- **A orquestração assíncrona / telas** — MA-5 (US-235).
- **A "Aventura pronta"** (gancho de classe) — US-217 (existe); aqui só o roteamento até ela.

---

## Critérios de aceite

- [x] Cada knob escolhido entra no prompt de autoria como **linha de restrição** com o **rótulo pt-BR** (nunca a chave); a chave segue gravada no artefato pra eval/filtro.
- [x] Knob em "Aleatório" ⇒ o eixo é **omitido** do prompt (modelo livre) — não há sorteio determinístico.
- [x] Toggle "Aventura pronta" ⇒ roteia pro gancho de classe (US-217), motor **não** roda; "Criar minha história" ⇒ roteia pro motor (US-232) com os knobs.
- [x] Desafio (US-161/165) vai pro orçamento do encontro (MA-3), **não** pro prompt de autoria.
- [x] **Eval / teste:** teste cobrindo (a) rótulo pt-BR chega ao prompt e chave ao artefato; (b) eixo "Aleatório" some do prompt; (c) toggle roteia pros dois caminhos; (d) desafio não aparece no prompt de autoria.

---

## Notas de implementação

- Achada implementada por inteiro dentro da US-232 (nenhum commit/comentário citava "US-236" — fechamento retroativo em 2026-09-15). Resolução chave→rótulo reusa `catalogLabel` (o mesmo padrão de `races`/`classes`, US-105/US-156), não uma segunda função.
- A tela hoje é a US-184 (devolveu os seletores de cenário/tipo de área que a US-173 tinha retirado de US-157) — a nota original apontava só pra US-157, que ficou só com `tone`. Doc/deps corrigidos.
- Único gap real encontrado: AC5 pedia teste cobrindo os 4 pontos junto; a cobertura existia espalhada (rótulo isolado por eixo, chave no artefato, `challenge` fora do `world` por match exato, toggle pulando `generateAdventureAuthoring`) mas faltava um teste dos 3 eixos rotulados + fallback "livre" juntos — adicionado em `ai.service.test.ts`.

---

## Questões em aberto

Nenhuma bloqueante — herdadas do backlog: quantas facções/NPCs/segredos pedir são dials do prompt (US-232, *Questões em aberto*), não desta story.

---

## Referências no código

- [`adventure.service.ts:161-183`](../../../apps/api/src/adventure/adventure.service.ts) — `generateAdventure`: monta `world` (rótulo por `catalogLabel`, `undefined` = Aleatório) a partir de `registryOverrides`.
- [`adventure.service.ts:494-498`](../../../apps/api/src/adventure/adventure.service.ts) — `createForCharacter`: DTO `tone`/`setting`/`areaType` validados por chave (`validateCatalogKey`) e repassados como `registryOverrides`; `challenge` vai só pro `profile` (orçamento), nunca pro `world`.
- [`adventure.service.ts:416`](../../../apps/api/src/adventure/adventure.service.ts) — ramo `dto.preset` ("Aventura pronta"): pula o motor inteiro, `tone`/`setting`/`areaType`/`challenge` do DTO são ignorados.
- [`ai.service.ts:216-256`](../../../apps/api/src/ai/ai.service.ts) — `buildAuthoringPrompt`: as 3 linhas "Cenário:"/"Tom:"/"Tipo de área:" só entram com rótulo presente; sem nenhuma, cai no fallback "Sem eixos de mundo fixados".
- [`adventure.service.test.ts:225-250`](../../../apps/api/src/adventure/adventure.service.test.ts) — DTO→`registryOverrides` (match exato, sem `challenge`) e `challenge`→`profile` isolado.
- [`adventure.service.test.ts:299-338`](../../../apps/api/src/adventure/adventure.service.test.ts) — ramo "Aventura pronta": `generateAdventureAuthoring` nunca chamado.
- [`ai.service.test.ts`](../../../apps/api/src/ai/ai.service.test.ts) — describe `AiService.generateAdventureAuthoring (US-232)`, teste "US-236" (3 eixos rotulados + fallback "livre").
- [US-156](./US-156-catalogos-registro-dto-validacao.md)/[US-184](./US-184-jogador-escolhe-setting-e-areatype.md) — catálogos e tela dos knobs.
- [US-232](./US-232-schema-cresce-e-prompt-de-autoria-call-unico.md) — o prompt que recebe a restrição.
- [US-216](./US-216-escolher-aventura-pronta-ou-criar-propria-historia.md)/[US-217](./US-217-aventura-pronta-sem-motor-de-geracao.md) — toggle e caminho pronto.
- [Backlog — MA-6](./backlog-motor-de-geracao-de-aventuras.md).
