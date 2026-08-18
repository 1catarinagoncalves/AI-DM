# US-164 — Orquestrador do motor: monta o `GeneratedAdventure` e gera o fecho ramificado

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** [US-146](./US-146-seed-deterministico-motor-aventura.md) (seed determinístico, ✅) · [US-147](./US-147-rolagem-registro-conteudo.md) (rolagem registro+conteúdo, ✅) · [US-158](./US-158-locais-npcs-prosa-motor.md) (locais+NPCs em prosa, ✅) · [US-149](./US-149-segredos-40-prompts-lgmrd.md) (segredos, ✅) · [US-152](./US-152-statblocks-papel-orcamento.md) (composer de encontro, ✅) · [US-159](./US-159-orcamento-de-encontro-lgmrd.md) (orçamento de encontro, ✅) · [US-160](./US-160-composer-encontro-usa-limiar-de-soma.md) (corrige o orçamento do composer — sem ela esta story monta encontro que estoura o gate em nível 1–4)
**Relacionado:** [US-144](./US-144-schema-aventura-shared.md) (o schema que esta story preenche) · [Backlog — Motor de geração de aventuras one-shot](./backlog-motor-de-geracao-de-aventuras.md) *§Ordem de geração*, passos 0-6
**Bloqueia:** [US-150](./US-150-gate-antes-de-persistir-aventura-gerada.md) (gate — precisa de um `GeneratedAdventure` montado pra validar) · [US-151](./US-151-semear-ledger-segredos-gerados.md) (semear o ledger — precisa do artefato pra extrair)
**Criada em:** 2026-08-18 — descoberta ao mapear o que falta pra integrar o motor ao prompt do AI DM: seis stories da *Ordem de geração* (US-145/146/147/149/152/158/159, todas ✅) produzem peças soltas, mas nenhuma função as junta num `GeneratedAdventure`.

---

## História

> **Como** mantenedora,
> **quero** uma função que rola registro+conteúdo, chama as gerações por modelo já existentes (locais/NPCs, segredos) na ordem certa, monta os encontros e escreve o fecho ramificado,
> **para que** exista, pela primeira vez, um `GeneratedAdventure` de verdade — hoje as peças (US-145/146/147/149/152/158/159/160) existem soltas, sem nada que as junte, e nada no motor produz `summary`, `encounters[]`, `conclusion` ou `followUps[]` prontos.

---

## Contexto e motivação

### O problema observado

`grep GeneratedAdventure apps/api/src` só acha o *import* do tipo — nenhuma função cria uma instância dele. Peças isoladas e sem elo:

- `rollAdventure` ([roll-adventure.ts](../../../apps/api/src/adventure-generation/roll-adventure.ts)) — registro + conteúdo bruto.
- `AiService.generateLocationsAndNpcs` ([ai.service.ts:1252](../../../apps/api/src/ai/ai.service.ts)) — locais/NPCs em prosa (US-158).
- `AiService.generateSecrets` ([ai.service.ts:1308](../../../apps/api/src/ai/ai.service.ts)) — segredos (US-149).
- `composeEncounterRoles`/`buildEncounterNpcs` ([monster-roles.ts](../../../apps/api/src/adventure-generation/monster-roles.ts)) — papéis de combate (US-152).

Nenhuma delas chama a próxima. Além disso:

- **O passo 6 do backlog (fecho ramificado + `followUps`) não tem NENHUM código** — nem prompt, nem schema de chamada, nem teste. É o único passo da *Ordem de geração* sem qualquer implementação, nem parcial.
- **`encounters[]` nunca vira um `AdventureEncounter` de verdade.** `composeEncounterRoles`/`buildEncounterNpcs` devolvem `MonsterRole[]`/`AdventureNpc[]` soltos — não o objeto `{ id, locationId, npcIds[] }` que `AdventureEncounterSchema` (US-144) exige.
- **`summary`, `start`, `id`, `levelRange` não têm dono.** Nenhuma função escreve nesses campos do schema.

Isto bloqueia US-150 (o gate precisa de algo pra validar) e US-151 (o ledger precisa de algo pra extrair) — e é o motivo de o motor, apesar de seis stories ✅ Implementada, ainda não gerar uma aventura completa ponta a ponta.

### Por que a solução atual não basta

Não é regressão, é gap puro. `roll-adventure.ts` é o único ponto que já compõe duas peças (registro+conteúdo) — para aí porque a próxima etapa (US-158) é chamada de IA via `AiService`, e `adventure-generation/` é módulo do Game Server, sem acesso a `AiService` hoje. O orquestrador precisa viver onde os dois lados se encontram — mesmo problema que `AdventureService` já resolve para `generateOpeningNarration` (`adventure.service.ts:5` importa `AiService`).

### A proposta

Uma função `generateAdventure(profile, characterId, order, registryOverrides?)` que executa, na ordem do backlog (*Ordem de geração*, passos 0-6):

1. `rollAdventure` — registro (US-147/156) + conteúdo bruto (US-147).
2. `ai.generateLocationsAndNpcs` (US-158) — `locations[]`/`npcs[]` com `id` real.
3. `ai.generateSecrets` (US-149) — usa `locations`/`npcs` do passo 2.
4. `composeEncounterRoles(profile.level)` + `buildEncounterNpcs` (US-152, orçamento corrigido pela US-160) — esta story soma o passo que falta: embrulhar isso num `AdventureEncounter`.
5. **NOVO — `ai.generateClosing`**: chamada de modelo (molde `generateSecrets`/`generateLocationsAndNpcs`, US-114) que escreve `conclusion` (fecho ramificado) e `followUps[]`, a partir de `locations`/`npcs`/`secrets` já decididos + a `complicacao` rolada + a `premissa` (passo 1, ver *Questões em aberto* #2 — é onde o antagonista aparece, só como prosa) + `registry` (`tone`/`setting`/`areaType`, passo 0). `registry` entra no system prompt, mesma disciplina de `generateLocationsAndNpcs`/`generateSecrets` — sem ele o fecho pode destoar do tom fixado (corpo Grimdark, fecho neutro). Zero código hoje.
6. Monta o objeto final e roda `GeneratedAdventureSchema.parse()` — validação de FORMA; o grafo fechar continua sendo o gate da US-150, fora desta story.

---

## Escopo

### Dentro do escopo

- `generateAdventure()`: a função orquestradora, chamando as peças na ordem 1-6 acima.
- `ai.generateClosing()`: novo método em `AiService`, mesma disciplina de `generateSecrets`/`generateLocationsAndNpcs` (`providerOptions: EXTRACTION_PROVIDER_OPTIONS`, nunca captura erro — falha aqui é motivo de reseed na US-150, não degradação silenciosa).
- Montagem de `AdventureEncounter` a partir de `composeEncounterRoles`/`buildEncounterNpcs` — decide `locationId` (ver *Questões em aberto* #1) e `id` = `encounter-${índice + 1}` (`encounter-1`, único elemento nesta story), mesmo padrão de `loc-N`/`npc-N`/`secret-N` — mintado no código, nunca pelo modelo (peça 100% determinística, sem chamada de IA). US-166 (múltiplos encontros) herda o mesmo padrão pro loop.
- `summary`: preenchido com `rolled.content.premissa` — literal, sem chamada de modelo nova (a linha da tabela `1d20quests` já é prosa pronta).
- `start`: preenchido com `profile.hookSeed` — decidido, ver *Questões em aberto* #2 (antagonista NÃO entra aqui; fica só na prosa do `conclusion`).
- `id`/`levelRange` do `GeneratedAdventure`: gerados aqui (`id` = `${characterId}:${order}`; `levelRange = { min: profile.level, max: profile.level }` — fase 1 não tem progressão dentro de uma aventura, ver *Ressalva do nível* do backlog).
- `.parse()` da US-144 rodando no fim — só forma; grafo fechar/orçamento continuam na US-150.

### Fora do escopo

- **O gate (US-150).** Esta story devolve o artefato MONTADO, não validado contra grafo/orçamento/piso de quantidade. `generateAdventure` pode devolver um artefato com referência quebrada; quem rejeita e re-rola é a US-150.
- **Reseed em si (`seed + 1`).** A US-150 decide QUANDO chamar `generateAdventure` de novo; esta story só executa uma passada.
- **Seeding do ledger (US-151), wiring em `createForCharacter` (US-153), DTO/tela do jogador (US-156/157).** Todas consomem o retorno desta story; nenhuma é implementada aqui.
- **Múltiplos encontros (4-5, como o backlog cita no plural).** `composeEncounterRoles` hoje monta UM encontro por chamada. Gerar 4-5 encontros distintos (locais diferentes, orçamento por encontro) é decisão de produto não resolvida — ver *Questões em aberto* #3. Esta story monta **um** `AdventureEncounter`, array com um elemento.

---

## Modelo de dados proposto

Sem schema novo de persistência — `GeneratedAdventureSchema` (US-144) já existe. `ai.generateClosing()` ganha um schema de CHAMADA, mesmo padrão de `SECRETS_SCHEMA`/`LOCATIONS_AND_NPCS_SCHEMA` em `ai.service.ts`:

```ts
const CLOSING_SCHEMA = z.object({
  conclusion: z.string().min(1),
  followUps: z.array(z.string()).min(1),
})
```

---

## Critérios de aceite

- [x] `generateAdventure(profile, characterId, order, registryOverrides?)` executa os passos 1-6 na ORDEM do backlog e devolve um `GeneratedAdventure`.
- [x] `ai.generateClosing()` recebe `locations`/`npcs`/`secrets`/`complicacao`/`hookSeed`/`premissa`/`registry` e devolve `conclusion` (não vazio) + `followUps[]` (ao menos 1) — nunca captura erro (mesma disciplina de `generateSecrets`).
- [x] `encounters[]` do artefato final tem ao menos um `AdventureEncounter` válido (`id`, `locationId` referenciando uma location real, `npcIds[]` referenciando NPCs reais dos passos 2+4).
- [x] `GeneratedAdventureSchema.parse()` roda sobre o objeto final e não lança para uma execução com todas as peças presentes.
- [x] Mesmo `characterId`+`order` (mesmo seed) produz o mesmo `registry`/conteúdo bruto/`encounters[].npcIds` — a parte determinística da saída não muda entre execuções (a parte gerada por LLM não é coberta por este critério).
- [x] `pnpm typecheck` e testes do módulo passam.
- [x] **Eval / teste de regressão:** fixture com `AiService` mockado (locations/npcs/secrets/closing fixos) → `generateAdventure` monta um `GeneratedAdventure` que passa em `.parse()`.

---

## Notas de implementação

- **Onde mora — RESOLVIDO (2026-08-18): método de `AdventureService`.** `adventure-generation/` é deliberadamente o lado Game Server — todas as peças de lá hoje são puras/síncronas (`rollAdventure`, `composeEncounterRoles`, etc.), sem DI, sem `AiService`; enfiar o orquestrador ali quebraria essa fronteira (a própria story já argumenta isto em *Por que a solução atual não basta* — "o orquestrador precisa viver onde os dois lados se encontram — mesmo problema que `AdventureService` já resolve para `generateOpeningNarration`"). `AdventureService` (342 linhas) já injeta `AiService` por construtor (`adventure.service.ts:5`), já tem `buildAdventureProfile` (US-148) esperando um consumidor, e `createForCharacter` já é o precedente de "várias chamadas de IA encadeadas + montagem" no mesmo arquivo. Alternativa descartada — método de `AiService`: o arquivo já tem 1500 linhas (dívida pré-existente, estoura o teto de 500 do AGENTS.md); somar a orquestração lá pioraria, não é o lugar natural pra montagem que consome `AiService`, não é ela mesma.
- **`ai.generateClosing` é a ÚNICA peça nova de chamada de modelo desta story** — as outras quatro (locations/npcs, secrets, composer) já existem; esta story só as invoca em sequência.
- **`buildAdventureProfile` (US-148, [adventure.service.ts:95](../../../apps/api/src/adventure/adventure.service.ts)) hoje está órfão** — nada fora de teste o chama. `generateAdventure` é o primeiro consumidor real.
- **Custo/latência:** soma três chamadas de modelo síncronas (locations/npcs → secrets → closing, cada uma depende da anterior) a mais que o fluxo de hoje. Relevante para a decisão aberta 5 do backlog (*gerar na criação do personagem ou em background?* — risco de estourar o teto do proxy SSE); esta story não decide isso, só soma ao custo que a US-149 já mede.

---

## Questões em aberto

1. ~~**`locationId` do `AdventureEncounter`.**~~ **RESOLVIDO (2026-08-18):** primeira location do array (`locations[0]`). `complicacao` (`condition`/`description`/`origin`, roll-content.ts:13) não tem campo de location — ligar por mapeamento exigiria heurística de texto, não pedida em nenhuma AC. `complicacao` já chega em `generateLocationsAndNpcs` como flavor de prompt (ai.service.ts:131) — a LLM já pode tecer a complicação em QUALQUER location gerada; o link é só narrativo (via prosa), não estrutural. Efeito: `locations[0]` pode não ser a location que a LLM amarrou à complicação — o encontro perde o "por que aqui" temático, sem quebrar nada (gate da US-150 valida só que `locationId` referencia local real, não coerência temática). Risco baixo, isolado a UM componente (qual local hospeda o encontro). Se virar problema de qualidade percebida, fix é local — trocar `locations[0]` pela location que a LLM marcou como ligada à complicação (campo novo em `LOCATIONS_AND_NPCS_SCHEMA`) — não precisa reabrir US-158 pra isso, só ajusta o schema desta chamada.
2. ~~**Semântica de `start`.**~~ **RESOLVIDO (2026-08-18):** `start = profile.hookSeed`, sem antagonista — decisão da mantenedora. `background.deity` é a divindade que o PERSONAGEM venera (US-40), não um vilão; usar `deity` como fonte de antagonista (leitura literal do backlog original) confundia fé do herói com oposição da trama. `1d20quests` (a tabela de `premissa`) também não serve de fonte estruturada: é objetivo abstrato solto (`"Kill a villain"`, `"Rescue an NPC"`), sem entidade nenhuma atrás — nenhum id, nenhum NPC. Antagonista como ENTIDADE rastreável (NPC marcado `role: antagonist`, referenciado em `encounters[]`) exigiria mexer no contrato já fechado de US-158 (`generateLocationsAndNpcs`, ✅) ou no schema (US-144) — escopo de US nova, não desta story. Opção adotada, mais barata: antagonista vira só COR NARRATIVA dentro do `conclusion` — `ai.generateClosing` ganha `premissa` como input extra (já carrega o tipo de objetivo/antagonista quando a tabela sortear um, ex. `"Kill a villain"`) e resolve tematicamente na prosa, sem campo novo no schema, sem tocar US-158. Se produto quiser antagonista rastreável de verdade (aparece nos encounters, não só no texto), abre US própria depois — não antecipada aqui.
3. ~~**Um encontro ou 4-5?**~~ **RESOLVIDO (2026-08-18): 4-5, story própria.** Ver *Fora do escopo*. Vira contrato/custo maior do que cabe em US-164 (loop de N chamadas, `locationId` round-robin, `npcIds` cumulativo entre chamadas) — criada como [US-166](./US-166-motor-gera-multiplos-encontros.md), depende desta story.
---

## Referências no código

- [Backlog — Motor de geração de aventuras one-shot §Ordem de geração](./backlog-motor-de-geracao-de-aventuras.md) — os 7 passos que esta story executa.
- [`apps/api/src/adventure-generation/roll-adventure.ts`](../../../apps/api/src/adventure-generation/roll-adventure.ts) — `rollAdventure`, passos 0-2 (parcial).
- [`apps/api/src/ai/ai.service.ts:1252`](../../../apps/api/src/ai/ai.service.ts) — `generateLocationsAndNpcs` (US-158), passo 3.
- [`apps/api/src/ai/ai.service.ts:1308`](../../../apps/api/src/ai/ai.service.ts) — `generateSecrets` (US-149), passo 4.
- [`apps/api/src/adventure-generation/monster-roles.ts`](../../../apps/api/src/adventure-generation/monster-roles.ts) — `composeEncounterRoles`/`buildEncounterNpcs` (US-152/US-160), passo 5.
- [`packages/shared/src/types/adventure-generation.ts`](../../../packages/shared/src/types/adventure-generation.ts) — `GeneratedAdventureSchema`, o alvo desta story.
- [US-148](./US-148-perfil-personagem-entrada-motor.md) — `AdventureProfile`/`buildAdventureProfile`, a entrada que esta story consome.
