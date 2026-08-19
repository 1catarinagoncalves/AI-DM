# US-175 — `generateClosing` deixa de receber `hookSeed`; antagonista vive só na `premissa`

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** nenhuma — mesma disciplina técnica de US-172/US-174, função isolada (`generateClosing`); sobreposição de arquivo com US-174 é possível (merge), não dependência real.
**Relacionado:** [US-174](./US-174-hookseed-sai-das-outras-chamadas-do-motor.md) (esta story resolve a Questão em aberto #1 dela) · [US-164](./US-164-orquestrador-motor-monta-aventura-gerada.md) (revisita parcialmente a decisão #2 — antagonista via `hookSeed` no fecho) · [US-172](./US-172-abertura-gerada-nao-copia-gancho-fixo.md) (mesma disciplina já aplicada a `start`) · [US-153](./US-153-aventura-deixa-de-ser-derivada-da-classe.md) (comentário-fonte da intenção "gancho só ancora a abertura")
**Criada em:** 2026-08-19 — resolve a Questão em aberto #1 da US-174.

---

## História

> **Como** jogador que gera uma aventura nova,
> **quero** que o fecho (`conclusion`/`followUps`) do motor de geração pare de receber `hookSeed` como insumo,
> **para que** o motor inteiro — abertura à parte, já coberta por US-172/US-174 — dependa só do que É desta aventura (`premissa`/`registry`/`locations`/`npcs`/`secrets`), sem viés residual do gancho fixo por classe.

---

## Contexto e motivação

### O problema observado

`buildClosingPrompt` injeta incondicionalmente `` `Gancho da aventura: ${hookSeed}` `` como primeira linha do prompt ([ai.service.ts:212](../../../apps/api/src/ai/ai.service.ts)). Diferente de `generateLocationsAndNpcs`/`generateSecrets` (US-174 — ali `hookSeed` só era rede de segurança condicional), aqui é insumo direto e sempre presente: decisão deliberada da US-164 Questão em aberto #2, que resolveu "onde colocar o antagonista" ancorando-o também no gancho de classe, ao lado da `premissa`.

### Por que a solução atual não basta

O próprio comentário de `generateClosing` ([ai.service.ts:1388](../../../apps/api/src/ai/ai.service.ts)) já diz: *"Antagonista não é entidade rastreável aqui... só cor narrativa via `premissa`"* — ou seja, `premissa` já é documentada como a fonte primária de cor pro antagonista. `hookSeed` no prompt de fecho é redundante com essa função, e é o único ponto restante — depois de US-172 remover de `start` e US-174 remover de `generateLocationsAndNpcs`/`generateSecrets` — em que o motor de geração ainda depende do catálogo fixo por classe. Isso mantém aberta a inconsistência com a garantia que `buildAdventureProfile` e o comentário US-153 já prometem: "gancho só ancora a abertura".

### A proposta

`generateClosing`/`buildClosingPrompt` param de receber `hookSeed`. `premissa` — já rolada deterministicamente por personagem+ordem (US-146/US-147) — passa a ser a única âncora de antagonista/cor narrativa do fecho: papel que ela já cumpre hoje, só que ao lado de `hookSeed`, não sozinha.

---

## Escopo

### Dentro do escopo

- `generateClosing` ([ai.service.ts:1392-1416](../../../apps/api/src/ai/ai.service.ts)) para de receber `hookSeed` nos parâmetros.
- `buildClosingPrompt` ([ai.service.ts:200-222](../../../apps/api/src/ai/ai.service.ts)) perde o parâmetro `hookSeed` e a linha `` `Gancho da aventura: ${hookSeed}` ``.
- `adventure.service.ts:161-169` — a chamada dentro de `generateAdventure` para de passar `hookSeed: profile.hookSeed` a `generateClosing`.
- Comentário de `generateClosing` ([ai.service.ts:1382-1391](../../../apps/api/src/ai/ai.service.ts)) atualizado — hoje cita `hookSeed` (US-148) como um dos insumos; deixa de ser verdade.
- Teste de regressão: fixture com `hookSeed` de um tom claramente distinto de `premissa`/`registry.tone` — confirma que `conclusion`/`followUps` gerados não citam nenhum elemento específico do `hookSeed` do fixture, e a chamada não falha nem produz prompt vazio na ausência dele.

### Fora do escopo

- `start`/`generateOpeningBeat` — já resolvido pela US-172, intocado aqui.
- `generateLocationsAndNpcs`/`generateSecrets` — já resolvidos pela US-174, intocado aqui.
- `profile.hookSeed` em si (US-148) — continua existindo. Depois desta story, os únicos consumidores restantes são `buildOpeningInstruction` (caminho sem `mainQuest`, sistemas sem motor de geração, ex. Free) e o fallback estático `openingText = generatedOpening ?? profile.hookSeed` (US-101/US-172).
- Rastreabilidade do antagonista (reabrir `LOCATIONS_AND_NPCS_SCHEMA`/`CLOSING_SCHEMA` pra virar NPC real) — decisão da US-164 #2 sobre ESSE eixo permanece intocada; esta story só remove um insumo textual redundante, o antagonista segue só prosa em `conclusion`, nunca entidade listada.

---

## Critérios de aceite

- [ ] `generateClosing` não recebe mais `hookSeed` nos parâmetros — verificação estrutural (assinatura da função).
- [ ] `buildClosingPrompt` não recebe `hookSeed` nem produz a linha "Gancho da aventura" no `prompt` gerado.
- [ ] Teste: `hookSeed` de fixture claramente distinto de `premissa`/`registry.tone` — `conclusion`/`followUps` gerados não citam elemento específico do `hookSeed` (nome de item/cenário/personagem do gancho fixo).
- [ ] `adventure.service.ts` (`generateAdventure`) não passa mais `hookSeed` a `generateClosing`.
- [ ] `pnpm typecheck` e `pnpm test` passam.
- [ ] `pnpm eval` passa (mudança em prompt do motor de geração — regra do projeto, AGENTS.md).

---

## Notas de implementação

- Pontos exatos: [ai.service.ts:200-222](../../../apps/api/src/ai/ai.service.ts) (`buildClosingPrompt`), [ai.service.ts:1392-1416](../../../apps/api/src/ai/ai.service.ts) (`generateClosing`), [adventure.service.ts:161-169](../../../apps/api/src/adventure/adventure.service.ts) (chamada).
- Depois desta story **e** da US-174, `profile.hookSeed` só é consumido em dois lugares: `buildOpeningInstruction` (caminho sem `mainQuest`) e o fallback estático `openingText`. Vale atualizar o comentário de `buildAdventureProfile` ([adventure.service.ts:88-94](../../../apps/api/src/adventure/adventure.service.ts)) se ele ainda descrever `hookSeed` como insumo de "outras chamadas do motor" no plural — depois desta story elas não existem mais.
- Testes existentes de `generateClosing` ([ai.service.test.ts:462-511](../../../apps/api/src/ai/ai.service.test.ts)) já não fazem nenhuma asserção sobre a string `hookSeed`/"gancho" aparecer no `prompt` — só passam `hookSeed` como parâmetro. Atualizar essas chamadas pra não passar mais `hookSeed` é o essencial da migração de teste, baixo risco de quebrar asserção existente.

---

## Questões em aberto

Nenhuma — esta story resolve a Questão em aberto #1 da US-174.

---

## Referências no código

- [apps/api/src/ai/ai.service.ts:200-222](../../../apps/api/src/ai/ai.service.ts) — `buildClosingPrompt`, a mudar.
- [apps/api/src/ai/ai.service.ts:1382-1416](../../../apps/api/src/ai/ai.service.ts) — `generateClosing` + seu comentário, a mudar.
- [apps/api/src/adventure/adventure.service.ts:161-169](../../../apps/api/src/adventure/adventure.service.ts) — a chamada dentro de `generateAdventure` que esta story altera.
- [apps/api/src/adventure/adventure.service.ts:88-94](../../../apps/api/src/adventure/adventure.service.ts) — comentário de `buildAdventureProfile`, candidato a atualização (ver Notas de implementação).
- [apps/api/src/ai/ai.service.test.ts:462-511](../../../apps/api/src/ai/ai.service.test.ts) — testes existentes de `generateClosing`, a migrar.
- [US-174](./US-174-hookseed-sai-das-outras-chamadas-do-motor.md) — story irmã, dona da Questão em aberto #1 que esta story resolve.
- [US-164](./US-164-orquestrador-motor-monta-aventura-gerada.md) — decisão #2, revisitada parcialmente (só o eixo `hookSeed`, não o eixo rastreabilidade).
- [US-153](./US-153-aventura-deixa-de-ser-derivada-da-classe.md) — comentário fonte da intenção "gancho só ancora a abertura".
- [US-148](./US-148-perfil-personagem-entrada-motor.md) — `buildAdventureProfile`, dono de `hookSeed`.
