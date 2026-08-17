# US-158 — Locais e NPCs com prosa (camada 2, antes dos segredos)

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** [US-147](./US-147-rolagem-registro-conteudo.md) (conteúdo bruto rolado — locais/monumentos, `patronsandnpcs`) · [US-148](./US-148-perfil-personagem-entrada-motor.md) (perfil do personagem, para amarrar NPC a `bonds`) · [US-114](./US-114-modelo-utilitario-para-extracao-e-fecho.md) (`extractionModel` já existe no código, [model.ts:314](../../../packages/ai-engine/src/model.ts) — verificado 2026-08-17; doc do US-114 ainda mostra status 🚧 Em progresso, mas a peça que esta story precisa já foi entregue, não é mais bloqueio)
**Bloqueia:** [US-149](./US-149-segredos-40-prompts-lgmrd.md) (precisa de `locations`/`npcs` com `id` real como entrada)
**Relacionado:** [Backlog — Motor de geração de aventuras one-shot §O desenho: três camadas / §Ordem de geração](./backlog-motor-de-geracao-de-aventuras.md) (passos 2 "locais" e 3 "NPCs", camada 2 — nunca ganharam número `GEN-N` próprio) · [ADR 012](../../adr/012-aventura-gerada-como-dado.md) · [US-144](./US-144-schema-aventura-shared.md) (`AdventureLocationSchema`/`AdventureNpcSchema`, reusados sem mudança)
**Criada em:** 2026-08-16

---

## História

> **Como** mantenedora,
> **quero** que o motor vista de prosa os ~6 locais e gere os ~7 NPCs a partir do conteúdo bruto já rolado (US-147), atribuindo `id` real a cada um e amarrando ao menos um NPC a `background.bonds` do personagem,
> **para que** a [US-149](./US-149-segredos-40-prompts-lgmrd.md) tenha `locations`/`npcs` estruturados para os segredos referenciarem por `id`, em vez de strings soltas sem identidade.

---

## Contexto e motivação

### O problema observado

O backlog (`§O desenho: três camadas`, linha 299-306) lista a **camada 2** ("modelo, uma chamada por peça") com dois itens: *"os 40 prompts de segredo"* **e** *"prosa das locações e area aspects"*. `§Ordem de geração` (linha 317-326) é ainda mais explícito: passo 2 = locais (~6), passo 3 = NPCs (~7, *"gerador de NPC; >= 1 amarrado a `background.bonds`"*), passo 4 = segredos. Nenhum dos dois primeiros ganhou número `GEN-N` nem story própria — a numeração pula de `GEN-4` (rolagem crua, US-147) para `GEN-6` (segredos, US-149). A própria US-149 documenta a lacuna na sua seção *Fora do escopo*: *"não está listada como GEN própria; a decidir se cabe aqui ou em US-147"* — mas não resolve, só adia.

### Por que a solução atual não basta

`rollContent` (US-147, implementada) devolve só strings soltas sem identidade: `locais: string`, `monumentos: string`, uma linha cada — não um array de `AdventureLocationSchema` com `id`. NPC não é rolado de forma alguma hoje: `patronsandnpcs` está no `lgmrd-tables.json` (extraído pela US-147) mas nenhuma função o lê — dá só `behavior`/`ancestry` por linha, sem `name` nem `role`, então nem bastaria rolar para virar `AdventureNpcSchema`. `generateSecrets` (US-149) exige `locations`/`npcs` como parâmetro **obrigatório** ("a chamada não roda" sem eles, US-149 §Escopo) — sem esta story, essa entrada não existe em lugar nenhum do código.

### A proposta

Uma chamada `generateObject` (mesmo molde de `extractOpeningEntities`, [ai.service.ts:1112](../../../apps/api/src/ai/ai.service.ts), e o mesmo padrão que a US-149 usa para os segredos), recebendo o conteúdo bruto da US-147 (`locais`/`monumentos`/`premissa`/`complicacao`, registro `setting`/`tone`/`areaType`) e as linhas de `patronsandnpcs` roladas pelo seed, produzindo `locations: AdventureLocationSchema[]` (título, *aspects*, *boxed text*, descrição, ocupantes) e `npcs: AdventureNpcSchema[]` (nome, papel — `interactions` fica vazio aqui, populado depois por encontros/segredos). `id` de cada local/NPC é **atribuído no código**, nunca pelo modelo — esta story é a primeira a **mintar** esses `id`s; as stories seguintes (US-149, encontros) só os referenciam.

---

## Escopo

### Dentro do escopo

- **Função que produz `locations: AdventureLocationSchema[]` (~6) e `npcs: AdventureNpcSchema[]` (~7)** a partir do conteúdo bruto da US-147 e do perfil da US-148 — nome exato a decidir na implementação. **Local: `AiService` (`ai.service.ts`), não `adventure-generation/`** — corrigido 2026-08-17, ver `Notas de implementação`.
- **`id` gerado no código** (`loc-1`, `npc-1`, ...), nunca deixado a cargo do modelo — diferente de `AdventureSecretSchema.locationId` (US-149), que **escolhe** entre `id`s já existentes, aqui é o primeiro passo que os cria.
- **`patronsandnpcs` rolado pelo seed** (US-146), mesmo padrão de sub-seed por tabela que `roll-content.ts` já usa (`tableSeed(characterId, order, 'npc-N')`) — `behavior`/`ancestry` de cada linha alimentam o prompt; `name`/`role` são gerados pelo modelo em cima disso, não copiados (diferente das extrações de abertura, que só copiam do texto).
- **Ao menos um NPC amarrado a `background.bonds`** quando presente (mesmo padrão de verificação de conteúdo da US-149) — quando `bonds` está vazio, cai no `hookSeed` como âncora (mesma garantia que US-148 já estabelece na entrada).
- **Modelo barato — `extractionModel`** ([US-114](./US-114-modelo-utilitario-para-extracao-e-fecho.md)), mesma ressalva de pin/`reasoning` que a US-149 já carrega — **nota:** `extractionModel` ainda não existe no código (`model.ts` só tem `primaryModel`/`summaryModel`); esta story e a US-149 compartilham essa dependência não-implementada.
- **Falha propaga erro estruturado**, não devolve array vazio silenciosamente — mesmo contrato fechado para a US-149: sem `locations`/`npcs`, nem os segredos nem o gate (US-150) têm o que consumir, então a falha aqui também é motivo de reseed pela US-150.

### Fora do escopo

- **Os segredos** — [US-149](./US-149-segredos-40-prompts-lgmrd.md), que consome o `locations`/`npcs` desta story.
- **O gate de integridade referencial** (`occupants`/`npcIds` batendo com `id`s reais) — [US-150](./US-150-gate-antes-de-persistir-aventura-gerada.md); esta story produz melhor esforço.
- **`AdventureNpcSchema.interactions`** — populado quando encontros (US-152) ou segredos referenciarem o NPC; aqui nasce `[]`.
- **Statblock/orçamento de encontro** — [US-152](./US-152-statblocks-papel-orcamento.md), tabela `5e_Monster_Builder.json`, não `patronsandnpcs`.

---

## Modelo de dados proposto

> Sem schema novo — reusa `AdventureLocationSchema`/`AdventureNpcSchema` de [US-144](./US-144-schema-aventura-shared.md) já como estão, sem alterar campos.

**Persistência:** nenhuma nesta story — `locations`/`npcs` alimentam o artefato completo que a [US-150](./US-150-gate-antes-de-persistir-aventura-gerada.md) valida e a [US-151](./US-151-semear-ledger-segredos-gerados.md) semeia.

---

## Critérios de aceite

- [x] Função produz `locations: AdventureLocationSchema[]` e `npcs: AdventureNpcSchema[]`, cada item com `id` atribuído no código (nunca pelo modelo), rodando **depois** do conteúdo bruto da US-147 existir e **antes** da chamada de segredos da US-149 — ordem verificável pela assinatura exigir o conteúdo rolado como parâmetro obrigatório. (`AiService.generateLocationsAndNpcs`, [ai.service.ts](../../../apps/api/src/ai/ai.service.ts))
- [x] `patronsandnpcs` é rolado pelo seed determinístico (US-146), não pelo modelo — nenhuma chamada a `Math.random`. (`rollPatronsAndNpcs`, [roll-content.ts](../../../apps/api/src/adventure-generation/roll-content.ts))
- [x] Ao menos um NPC (papel ou nome) referencia `background.bonds` quando presente — checagem por palavra-chave ou LLM-judge, molde da rubrica US-36 (mesma disciplina que a US-149 aplica aos segredos). Aqui via instrução explícita no prompt (`bondsInstruction`); a checagem de qualidade da saída real do modelo é trabalho de eval, fora do escopo do teste unitário.
- [x] Personagem com `background`/`origin` vazios ainda produz `locations`/`npcs` válidos, usando só `hookSeed` como âncora.
- [x] Chamada usa `extractionModel` (US-114), não `primaryModel`.
- [x] Falha/timeout propaga erro estruturado — não devolve array vazio silenciosamente; aciona reseed pela US-150. Sem `try/catch`, ao contrário de `extractOpeningEntities`/`extractOpeningScene` — de propósito.
- [x] **Eval / teste de regressão:** [ai.service.test.ts](../../../apps/api/src/ai/ai.service.test.ts) (`AiService.generateLocationsAndNpcs`) cobre minting de `id`, resolução de `occupants` por nome, uso de `extractionModel`, `bonds` no prompt, fallback pro `hookSeed`, e propagação de erro. [roll-content.test.ts](../../../apps/api/src/adventure-generation/roll-content.test.ts) cobre fixture pinada de `patronsandnpcs` e não-degeneração por `order`.
- [ ] **Guard futuro, não desta entrega (dependência da US-152):** todo consumidor de `npcs[]` que gera prosa/elenco pro jogador filtra por `role` conhecido (`Minion`/`Soldier`/`Brute`) antes de tratar a entrada como NPC narrativo. Nenhum consumidor de prosa existe ainda — item fica pendente até a US-152 (que popula statblock em `npcs[]`) e o primeiro consumidor de narração existirem; não bloqueia o status ✅ desta story.

---

## Notas de implementação

- **Molde de `generateObject` server-side:** copiar a estrutura de `extractOpeningEntities` ([ai.service.ts:1112](../../../apps/api/src/ai/ai.service.ts)), mesmo padrão que a US-149 usa para os segredos.
- **Esta story preenche o buraco que a US-149 sinalizou e não resolveu** ("não está listada como GEN própria") — o backlog original nunca numerou os passos 2/3 de `§Ordem de geração`.
- **`patronsandnpcs` só dá `behavior`+`ancestry`, de propósito — não é buraco, é o método do LGMRD.** `name`/`role` do NPC são invenção do modelo em cima desses dois campos + registro (`tone`/`setting`), não cópia — mais parecido com `generateSecrets` (US-149) do que com as extrações de abertura que só copiam do texto. Confirmado na própria fonte (`LGMRD.json`, `eightsteps/outlineimportantnpcs`): *"outline those NPCs... focusing on a **name** and a **connection to the adventure**, then wrapping the NPC in a **character archetype from popular fiction**"* — o LGMRD nunca rola nome, o mestre (aqui, o modelo) inventa a partir do rolado. `coreadventuregenerators/patronsandnpcs` (intro): *"Use these tables to generate a patron or NPC... applying an NPC stat block to create villains, hirelings, rivals, or heralds"*. O prompt desta story deve pedir explicitamente nome + arquétipo de ficção popular + conexão com a aventura (`background.bonds`/`hookSeed`), na mesma língua do método original.
- **Uma chamada combinada (locais + NPCs), não duas separadas** — apesar de o backlog descrever a camada 2 literalmente como "uma por peça". Chamada combinada deixa o modelo amarrar `occupants` de local a NPC no mesmo contexto (mais barato, mais coerente); duas chamadas isolariam falha por peça, mas fragmentam a amarração. Locais primeiro no prompt interno; validar essa ordem testando o prompt real.
- **Rolar `patronsandnpcs` 7× com sub-seeds independentes**, mesmo padrão de `tableSeed` em `roll-content.ts` — uma linha por roll dá ~1 NPC, então ~7 NPCs exigem 7 rolls. Consistente com "sorteio que o modelo faz não é sorteio" (US-29); modelo inventar NPCs além do rolado contradiz essa disciplina. Modelo só veste de prosa o que já foi rolado.
- **Split correto: rolagem em `adventure-generation/`, prosa em `AiService`.** `adventure-generation/` (`roll-content.ts`, `roll-registry.ts`, `roll-adventure.ts`) é 100% puro hoje — zero import de `ai`/`generateObject`, só PRNG seedado. Toda chamada `generateObject` do repo (`extractOpeningEntities`, `extractOpeningScene`, `reconcileScene`) já vive em `ai.service.ts`, e a US-149 confirma o mesmo molde para `generateSecrets`. Portanto: estender `RolledAdventureContent`/`rollContent` (`roll-content.ts`) com as 7 linhas roladas de `patronsandnpcs`; o método novo que chama `generateObject` (prosa de locais+NPCs) entra em `AiService`, ao lado de `extractOpeningEntities` — não em `adventure-generation/`, ao contrário do que a seção `Escopo` original desta story dizia.
- **`npcs[]` vai ganhar entradas de combate mais tarde — não desta story, da US-152.** Os ~7 NPCs que esta story produz são 100% narrativos (`name`+`role`=personalidade+`interactions`). A [US-152](./US-152-statblocks-papel-orcamento.md) decidiu reusar o mesmo `AdventureNpcSchema`/`npcs[]` para instâncias de statblock de combate (Minion/Soldier/Brute) referenciadas por `encounter.npcIds[]`, com `role` guardando a chave do papel de combate em vez de personalidade, e `interactions: []`. Quem primeiro escrever um consumidor de `npcs[]` que renderiza prosa/elenco pro jogador (nenhum existe ainda — esta story só *produz* `npcs[]`, não narra) **precisa filtrar por `role` conhecido (`Minion`/`Soldier`/`Brute`)** antes de tratar a lista como elenco narrativo, ou statblock de combate vaza como personagem nomeado.
- **`AdventureProfile` (US-148) já dá acesso sem plumbing novo.** Vive em [adventure.service.ts:17](../../../apps/api/src/adventure/adventure.service.ts) (não em `@ai-dm/shared`); `AdventureService` já injeta `AiService` ([adventure.service.ts:5](../../../apps/api/src/adventure/adventure.service.ts)), então o método novo em `AiService` é chamável direto dali. `buildAdventureProfile` é privado na classe — não precisa expor, quem monta o profile é o próprio `AdventureService` antes de chamar `AiService`.

---

## Questões em aberto

Nenhuma pendente — as duas questões desta seção (chamada combinada vs. separada; quantas vezes rolar `patronsandnpcs`) foram decididas e movidas para `Notas de implementação` acima.

---

## Referências no código

- [apps/api/src/adventure-generation/roll-content.ts](../../../apps/api/src/adventure-generation/roll-content.ts) — `RolledAdventureContent`, padrão `tableSeed` a reusar para `patronsandnpcs`.
- [scripts/lazygm/lgmrd-tables.json](../../../scripts/lazygm/lgmrd-tables.json) — tabela `patronsandnpcs` (`behavior`/`ancestry`), ainda não lida por nenhuma função.
- [apps/api/src/ai/ai.service.ts:1112](../../../apps/api/src/ai/ai.service.ts) — `extractOpeningEntities`, molde de `generateObject` a espelhar.
- [packages/shared/src/types/adventure-generation.ts](../../../packages/shared/src/types/adventure-generation.ts) — `AdventureLocationSchema`, `AdventureNpcSchema` (US-144), reusados sem alteração.
- [US-147](./US-147-rolagem-registro-conteudo.md) — conteúdo bruto rolado, entrada desta story.
- [US-148](./US-148-perfil-personagem-entrada-motor.md) — `AdventureProfile`, entrada desta story.
- [US-149](./US-149-segredos-40-prompts-lgmrd.md) — consumidora de `locations`/`npcs`, e onde esta lacuna foi originalmente sinalizada sem resolução.
- [Backlog — Motor de geração de aventuras one-shot §O desenho: três camadas / §Ordem de geração](./backlog-motor-de-geracao-de-aventuras.md) — texto de origem dos passos 2/3, nunca numerados como `GEN-N`.
