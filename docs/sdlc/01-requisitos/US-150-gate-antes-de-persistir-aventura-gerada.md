# US-150 — Gate antes de persistir a aventura gerada

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** [US-164](./US-164-orquestrador-motor-monta-aventura-gerada.md) (✅ implementada 2026-08-18 — `AdventureService.generateAdventure`, [adventure.service.ts](../../../apps/api/src/adventure/adventure.service.ts), monta o `GeneratedAdventure` que este gate valida) · [US-149](./US-149-segredos-40-prompts-lgmrd.md) · [US-159](./US-159-orcamento-de-encontro-lgmrd.md) (a régua de orçamento de encontro que a verificação 3 compara) · [US-160](./US-160-composer-encontro-usa-limiar-de-soma.md) (corrige o orçamento de `composeEncounterRoles` — sem ela, a verificação 3 rejeita todo encontro gerado pra nível 1–4)
**Relacionado:** [Backlog — Motor de geração de aventuras one-shot](./backlog-motor-de-geracao-de-aventuras.md) (US-150, critério de saída do corte mínimo) · [ADR 012](../../adr/012-aventura-gerada-como-dado.md) (resolve rótulos `GEN-N` do backlog para número de story) · [US-144](./US-144-schema-aventura-shared.md) (o `parse()` que o gate roda) · [US-153](./US-153-aventura-deixa-de-ser-derivada-da-classe.md) (calcula `order` antes da transação — o gate recebe, não computa)
**Criada em:** 2026-08-15

---

## História

> **Como** mantenedora,
> **quero** que toda aventura gerada passe por quatro verificações antes de ser persistida — schema válido, grafo de referências fechado, orçamento de encontro compatível com um personagem, piso de quantidade por seção —, com reseed em vez de conserto quando falha,
> **para que** nenhuma aventura com pista órfã, NPC sem função ou encontro letal para um personagem solo chegue ao jogador.

---

## Contexto e motivação

### O problema observado

Sem gate, o motor entregaria diretamente ao jogador o que quer que [US-149](./US-149-segredos-40-prompts-lgmrd.md) tenha produzido — incluindo os defeitos que um LLM instruído a "referenciar locais e NPCs por id" comete de vez em quando: um `locationId` que não existe, um NPC declarado que nenhum segredo ou encontro menciona, um encontro cujo orçamento mataria um personagem de nível 1 solo. Com a inversão de ordem do backlog (motor roda **antes** de qualquer aventura escrita à mão existir), não há piso de qualidade humano por baixo — o gate é a única rede.

### Por que a solução atual não basta

`GeneratedAdventureSchema.parse()` (US-144) verifica **forma** — que os campos existem e têm o tipo certo. Não verifica **conteúdo**: um `secret.locationId` sintaticamente válido (`"loc-3"`) mas que não corresponde a nenhum `location.id` real passa no `.parse()` e falha na mesa. É exatamente a lacuna que a integridade referencial do DnDGenerate (citada no backlog) resolve — mas só se alguém a verificar depois da geração, não confiando que o modelo sempre obedeceu a instrução.

### Achado ao planejar a implementação (2026-08-18)

`deriveAdventureSeed(characterId, order)` ([adventure-seed.ts](../../../packages/shared/src/adventure-seed.ts)) hasheia só `characterId:order` — nenhuma função da cadeia (`rollRegistry`, `rollContent`, `rollAdventure`, `generateAdventure`, todas ✅) recebe um terceiro parâmetro de tentativa. "Reseed com `seed + 1`" (proposta original desta story) não tem onde plugar: chamar `generateAdventure` de novo com o mesmo `characterId`+`order` repete IDÊNTICO o registro e o conteúdo bruto rolado — é o próprio ponto da US-146 (determinismo), e o efeito colateral é que "a próxima tentativa" reciclaria exatamente o mesmo material.

Duas consequências, gravidade diferente — e é por isso que a solução (abaixo) trata as quatro verificações em dois grupos, não uma lista uniforme:

1. **Verificações 1 e 2 (parse, grafo fecha) reseedam "por acidente" hoje.** `generateLocationsAndNpcs`/`generateSecrets`/`generateClosing` não são seedadas — cada chamada amostra o modelo de novo, então repetir `generateAdventure` já produz locais/NPCs/segredos/fecho diferentes, mesmo com o conteúdo rolado idêntico. Funciona, mas o material de base (premissa/locais/complicação) fica fixo entre tentativas — viés de repetir o mesmo erro quando a causa é o material, não a amostragem do modelo.
2. **Verificação 3 (orçamento do encontro) NUNCA muda com reseed.** `composeEncounterRoles(level)` é função pura, sem entrada aleatória nenhuma — mesmo nível, mesmo resultado, sempre. Hoje é seguro porque a US-160 já garante que o composer nunca estoura `encounterDeadlyThreshold`; mas se algum dia estourar (regressão, nível fora do range calibrado), reseed vira loop idêntico até o teto de tentativas — falha estrutural mascarada de falha transitória.

Achado relacionado, descoberto na [US-153](./US-153-aventura-deixa-de-ser-derivada-da-classe.md): `order` não é algo que o gate resolve sozinho — chega já calculado de quem chama (`createForCharacter`, ANTES de abrir a transação do banco, porque `generateAdventure` faz chamadas LLM e não pode segurar lock). O gate desta story não recebe só `attempt` — recebe `characterId`+`order`+`attempt`, os três repassados intactos pra `generateAdventure` a cada tentativa; `order` nunca muda entre tentativas do mesmo gate, só `attempt`.

### A proposta

Quatro verificações, na ordem certa, e **re-seed em vez de conserto**: nunca se pede ao modelo para consertar a própria saída (mesma disciplina de "nunca fabricar número" da rolagem de jogo, aplicada aqui à estrutura da aventura).

---

## Escopo

### Dentro do escopo

1. **O artefato passa no `parse()` da [US-144](./US-144-schema-aventura-shared.md).** Primeira verificação, mais barata.
2. **O grafo fecha.** Todo `locationId`, `npcId` e `encounterId` referenciado existe na seção correspondente, e nenhuma locação ou NPC declarado fica órfão — sem encontro, sem segredo, sem interação apontando para ele. Substitui a checagem mais fraca de "ao menos três segredos referenciam entidade que existe" (que só media um lado da relação).
3. **O orçamento do encontro cabe em um personagem** daquele nível — comparado contra o *Lazy Encounter Benchmark* da [US-159](./US-159-orcamento-de-encontro-lgmrd.md) (✅ implementada: `encounterDeadlyThreshold(level)` e `singleMonsterCrCap(level)`, [`apps/api/src/adventure-generation/lazy-encounter-benchmark.ts`](../../../apps/api/src/adventure-generation/lazy-encounter-benchmark.ts)) e os papéis de statblock da [US-152](./US-152-statblocks-papel-orcamento.md). Falha se a soma de CR dos monstros do encontro **excede** (`>`) `encounterDeadlyThreshold`, **ou** se algum monstro único tem CR que **alcança ou passa** (`>=`) `singleMonsterCrCap` — as duas checagens da US-159, operadores diferentes de propósito.
4. **Piso de quantidade por seção** (locais, NPCs, segredos, encontros) — verificado **no prompt** da [US-149](./US-149-segredos-40-prompts-lgmrd.md), não aqui em código (molde do DnDGenerate: pedir "se houver menos de N, escreva mais" é mais barato que re-rolar a aventura inteira por falta de um NPC). Este gate só confirma que o piso foi atingido, não o impõe via retry de prompt.
- **Re-seed, teto explícito — com `attempt` de verdade.** Falha nas verificações 1 ou 2 → gera de novo chamando `generateAdventure` com `attempt` incrementado (novo 5º parâmetro opcional, default `0`, threading `generateAdventure` → `rollAdventure` → `rollRegistry`/`rollContent` → `deriveAdventureSeed`; ver *Achado* acima e *Notas de implementação*). Teto de tentativas explícito (ex. 3), com falha **registrada** (log estruturado com o motivo da última falha) — gerador que re-rola sem limite trava a criação de personagem.
- **Falha na verificação 3 (orçamento) não entra no mesmo loop de reseed.** Como `composeEncounterRoles` é puro em `level` (sem `attempt`, sem seed), reseed nunca muda o resultado dela — se acontecer (não deveria, US-160 garante o contrário), é bug estrutural, não falha transitória: registra e falha imediatamente (mesmo formato de erro do teto esgotado), sem gastar tentativas repetindo um encontro idêntico.
- **Critério de saída do corte mínimo, não automatizável:** um seed pinado, jogado à mão ponta a ponta — critério humano, não substituível por `pnpm test` verde. Vira rotina: um seed novo jogado a cada mudança no prompt de segredos ([US-149](./US-149-segredos-40-prompts-lgmrd.md)).

### Fora do escopo

- **Consertar a saída do modelo** (pedir para ele corrigir um `id` inválido) — deliberadamente fora; o remédio é sempre reseed.
- **A cadeia causal entre pistas e a subversão do template** — o grafo fechar garante que a pista aponta para algo que existe, não que as pistas componham um mecanismo coerente. É piso, não teto (ver *O que o motor não produz* no backlog) — não é critério de aceite mecânico desta story.
- **Escolher os valores da régua de orçamento de encontro** — usa o que a [US-159](./US-159-orcamento-de-encontro-lgmrd.md)/[US-152](./US-152-statblocks-papel-orcamento.md) já definirem; esta story só compara, não define a escala. (Não é [US-111](./US-111-classe-de-dificuldade-do-srd-2024.md) — essa é a CD de teste de habilidade, um dado diferente; ver a nota de correção no cabeçalho da US-159.)

---

## Modelo de dados proposto

> Sem schema novo — a função de gate devolve um resultado de validação, não um novo tipo de dado persistido.

```ts
type GateResult =
  | { ok: true; adventure: GeneratedAdventure }
  | { ok: false; reason: string; attempt: number }
```

**Persistência:** o log de falha de reseed (motivo + tentativa) é candidato a log estruturado (console/observabilidade, [ADR 011](../../adr/011-observabilidade-em-camadas.md)), não a tabela nova.

---

## Critérios de aceite

- [x] Artefato que falha `.parse()` (US-144) é rejeitado antes das outras três verificações rodarem — ordem de custo crescente. [`runAdventureGate`](../../../apps/api/src/adventure-generation/adventure-gate.ts) roda `safeParse` → grafo → orçamento, nessa ordem, retorno antecipado no primeiro que falhar.
- [x] Toda referência cruzada (`locationId`, `npcId`, `encounterId`) do artefato é resolvida contra as seções correspondentes; artefato com referência para `id` inexistente falha o gate. `checkReferencesResolve` cobre `secret.locationId`, `encounter.locationId`, `encounter.npcIds`, `location.occupants` (inclusive o fallback "melhor esforço" do nome cru, ai.service.ts:1316-1317) e `npc.interactions[].encounterId`.
- [x] Nenhuma locação ou NPC declarado fica órfão — sem nenhum encontro, segredo ou interação apontando para ele — sob pena de falhar o gate. `checkNoOrphanLocations`/`checkNoOrphanNpcs`.
- [x] Orçamento de cada encontro é comparado contra `encounterDeadlyThreshold`/`singleMonsterCrCap` (US-159) para **um** personagem daquele nível; encontro fora do orçamento falha o gate. `checkEncounterBudget`, mesmos operadores (`>`/`>=`) do LGMRD.
- [x] Falha nas verificações 1 (parse) ou 2 (grafo fecha) aciona reseed via `generateAdventure(..., attempt: attempt + 1)` — o `attempt` chega a `deriveAdventureSeed` (US-146, emendada com parâmetro aditivo) e MUDA o conteúdo rolado da tentativa seguinte, não só reamostra o modelo. Até um teto explícito de tentativas; ao esgotar, a falha é registrada com o motivo da última tentativa, e a criação da aventura não trava indefinidamente. `generateWithGate` (default `maxAttempts = 3`) + `AdventureService.generateGatedAdventure`.
- [x] Falha na verificação 3 (orçamento do encontro) NÃO aciona reseed em loop — `composeEncounterRoles` é puro em `level`, reseed nunca muda o resultado; falha imediatamente como erro estrutural, registrada, sem consumir as demais tentativas. Coberto por teste (`generate` chamado 1 única vez).
- [x] Nenhuma tentativa de "consertar" a saída do modelo existe no código — só reseed inteiro. `generateWithGate` só chama `generate(attempt)` de novo; nenhum caminho de código muta o candidato retornado.
- [ ] **Critério de saída do corte mínimo (não automatizável):** um seed pinado, jogado à mão ponta a ponta, sem sopa de pista genérica — registrado como parte do relato desta story, não como teste automatizado. **Pendente** — exige rodar a app com um LLM real e julgamento humano da narrativa; não é algo que a implementação de código resolve sozinha.
- [x] **Eval / teste de regressão:** fixture de artefato com `secret.locationId` inválido falha o gate com o motivo correto; fixture com NPC órfão falha; fixture com encontro superorçado falha; fixture válida passa em todas as quatro verificações. [`adventure-gate.test.ts`](../../../apps/api/src/adventure-generation/adventure-gate.test.ts) (16 casos) + [`adventure.service.test.ts`](../../../apps/api/src/adventure/adventure.service.test.ts) (integração via `generateGatedAdventure`).

---

## Notas de implementação

- **Ordem de verificação por custo:** `.parse()` primeiro (mais barato), grafo depois (percorrer arrays, ainda barato), orçamento por último (pode exigir os dados de statblock da [US-152](./US-152-statblocks-papel-orcamento.md) já carregados). Falhar cedo evita trabalho desperdiçado antes do reseed.
- **`encounterDeadlyThreshold`/`singleMonsterCrCap` (US-159) não leem arquivo em runtime** — fórmula hardcoded, dois `if`/ternário. O gate soma o CR dos monstros do encontro e compara contra o retorno dessas duas funções; não há parsing nem I/O extra nesta verificação.
- **Como o gate recupera o CR de um encontro — resolvido pela US-164 real, não mais hipotético.** `GeneratedAdventure.encounters[].npcIds` só tem `string[]` (ids). O papel de combate (`Minion`/`Soldier`/`Brute`) não está no encounter — está em `npc.role`, porque `buildEncounterNpcs` ([monster-roles.ts:77-85](../../../apps/api/src/adventure-generation/monster-roles.ts)) grava o `MonsterRole` DIRETO no campo `role` do `AdventureNpc` (`AdventureNpcSchema.role` é `z.string()` genérico — não distingue NPC de combate de NPC narrativo pelo tipo, só pelo VALOR). O gate precisa: para cada `npcId` em `encounter.npcIds`, achar o `AdventureNpc` correspondente em `npcs[]`, ler `.role`, e SÓ somar se `role` for uma chave de `MONSTER_ROLE_CR` (`Minion`/`Soldier`/`Brute`) — NPCs narrativos (role = descrição livre, ex. `"herborista suspeita"`) não têm CR e não entram na soma. `totalCr(roles: MonsterRole[])` ([monster-roles.ts:24-26](../../../apps/api/src/adventure-generation/monster-roles.ts)) já existe pronta pra somar depois de filtrar/mapear.
- **O grafo fecha é a verificação central desta story** — é o que a integridade referencial do schema (US-144) torna possível verificar de forma mecânica, ao contrário do LGMRD puro (oito listas sem obrigação de citação cruzada).
- **Teto de tentativas** — número exato (3? 5?) fica para a implementação decidir olhando o custo real por chamada ([US-149](./US-149-segredos-40-prompts-lgmrd.md) é a mais cara, uma chamada de modelo por tentativa de reseed inteira).
- **`attempt` é aditivo, não quebra US-146/US-164 já ✅.** `deriveAdventureSeed(characterId, order, attempt = 0)`: quando `attempt === 0` o input do hash continua `${characterId}:${order}` — idêntico a hoje, nenhum teste de determinismo já verde quebra (`adventure-seed.test.ts`, `roll-adventure.test.ts`, `roll-registry.test.ts`, `roll-content.test.ts`, os testes de `generateAdventure` da US-164). Só quando `attempt > 0` o input vira `${characterId}:${order}:${attempt}`. Mesmo padrão, parâmetro novo no fim da assinatura com default `0`, em `rollRegistry`/`rollContent`/`rollAdventure`/`generateAdventure`.
- **`GateResult.attempt` (*Modelo de dados proposto*) já antecipava isto** — o campo existe na proposta original desde 2026-08-15, só faltava a plumbing pra ele mudar alguma coisa de fato.
- **Esgotamento do teto de reseed:** o backlog não decide se a criação da aventura falha de vez ou cai num fallback (aventura mais simples, sem os quatro gates) — só cita "trava a criação de personagem" como risco a evitar, sem especificar o comportamento. Falhar explicitamente com erro estruturado (molde da [US-120](./US-120-erro-de-llm-estruturado.md)), nunca silenciar.

---

## Questões em aberto

Nenhuma.

---

## Referências no código

- [Backlog — Motor de geração de aventuras one-shot §GEN-7](./backlog-motor-de-geracao-de-aventuras.md) (US-150) — texto de origem, as quatro verificações e o critério de saída do corte mínimo.
- [`apps/api/src/adventure-generation/adventure-gate.ts`](../../../apps/api/src/adventure-generation/adventure-gate.ts) — ✅ implementado: `runAdventureGate` (as três verificações mecânicas) e `generateWithGate` (reseed/falha imediata/teto). [`adventure-gate.test.ts`](../../../apps/api/src/adventure-generation/adventure-gate.test.ts) tem os fixtures do critério de eval.
- [US-144](./US-144-schema-aventura-shared.md) — `GeneratedAdventureSchema.parse()`, primeira verificação.
- [US-146](./US-146-seed-deterministico-motor-aventura.md) — seed determinístico original; o mecanismo de reseed real NÃO é `seed + 1` (proposta descartada, ver *Achado ao planejar a implementação*), é o parâmetro `attempt` abaixo.
- [`packages/shared/src/adventure-seed.ts`](../../../packages/shared/src/adventure-seed.ts) — `deriveAdventureSeed(characterId, order, attempt = 0)`, ✅ ganhou o parâmetro aditivo que esta story consome, threaded por `rollRegistry`/`rollContent`/`rollAdventure`/`AdventureService.generateAdventure`.
- [US-159](./US-159-orcamento-de-encontro-lgmrd.md) — *Lazy Encounter Benchmark*, a régua de orçamento de encontro que a verificação 3 compara. ✅ Implementada: [`apps/api/src/adventure-generation/lazy-encounter-benchmark.ts`](../../../apps/api/src/adventure-generation/lazy-encounter-benchmark.ts) (`encounterDeadlyThreshold`, `singleMonsterCrCap`).
- [`apps/api/src/adventure-generation/monster-roles.ts`](../../../apps/api/src/adventure-generation/monster-roles.ts) — `MONSTER_ROLE_CR`, `totalCr`, e `buildEncounterNpcs` (grava o `MonsterRole` em `npc.role`) — o caminho real que o gate usa pra recuperar CR a partir de `encounter.npcIds` (ver *Notas de implementação*).
- [`apps/api/src/adventure/adventure.service.ts`](../../../apps/api/src/adventure/adventure.service.ts) — `AdventureService.generateAdventure` (US-164, ✅) e `generateGatedAdventure` (US-150, ✅) — o método que envolve o gate ao redor do orquestrador.
- [US-120](./US-120-erro-de-llm-estruturado.md) — molde de erro estruturado; `logGateFailure` em `adventure-gate.ts` segue o mesmo formato JSON de `logLlmFailure`.
