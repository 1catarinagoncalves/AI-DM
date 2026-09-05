# US-217 — "Aventura pronta" pula o motor de geração (revert pontual da US-153/US-155)

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada (2026-09-05)
**Depende de:** [US-216](./US-216-escolher-aventura-pronta-ou-criar-propria-historia.md) (✅ — cria o ramo "Aventura pronta" que esta story corrige)
**Reabre:** [US-153](./US-153-aventura-deixa-de-ser-derivada-da-classe.md) (✅ — motor de geração; esta story só o desliga no ramo "pronta", "criar minha história" continua 100% nele) · [US-155](./US-155-aposentar-quest-fixa-por-classe.md) (✅ — removeu `primaryQuestTitle`/`primaryQuestDescription`; esta story reintroduz os dois campos)
**Criada em:** 2026-09-05

---

> ⚠️ **Esta story reabre, de forma estreita, duas decisões já fechadas.** A US-153 e a
> US-155 continuam corretas para o ramo "Criar minha história" (US-216) — nada muda lá. O
> que muda é só o ramo "Aventura pronta": ele deixa de passar pelo motor de geração e volta
> a funcionar como a US-28 funcionava, antes de a US-153 existir.

---

## História

> **Como** jogador que clicou "Aventura pronta",
> **quero** que a aventura comece na hora, sem nenhuma chamada de IA rodando por baixo,
> **para que** "pronta" signifique realmente pronta — não "zero configuração, mas ainda
> esperando o motor gerar tudo".

---

## Contexto e motivação

### O problema observado

A US-216 implementou a bifurcação "Aventura pronta" / "Criar minha história" no passo
`world`, mas manteve deliberadamente o motor de geração (US-153) rodando idêntico nos dois
ramos — só a *escolha* de Cenário/Tom/Área/Desafio era pulada em "pronta". Ao testar, a
mantenedora clicou "Aventura pronta" e viu os logs do `apps/api dev` disparando
`[AiService][generatePremissa]`/`[AiService][generateLocationsAndNpcs]` normalmente — o
motor inteiro (premissa, locais, NPCs, segredos, antagonista, fecho) continuava rodando.
Pedido explícito: reverter para como a criação funcionava **antes da US-153 existir**
(US-28) — zero chamada de IA, gancho fixo por classe.

### Investigação: o que "como era antes" significa de verdade

`git log`/`git show` confirmam que a US-28 (`25a9127`) foi o **único commit da história do
repo** com criação de aventura 100% síncrona. No dia seguinte, a US-34 (`d3ef9f2`) já
introduziu a primeira chamada de IA (abertura gerada, com fallback estático no gancho). A
US-28 persistia, sem nenhuma IA: `Adventure` (title = `hook.title`), `Quest`
(title/description = `hook.primaryQuestTitle`/`primaryQuestDescription`, `isPrimary: true`)
e um `EventLog` de abertura com `hook.openingNarration` — todos com `{characterName}`/
`{characterClass}` resolvidos por template, sem locations/npcs/encounters/antagonista (esse
conceito não existia ainda). É exatamente essa foto que esta story recria.

### Por que isso é seguro de reintroduzir hoje

O pipeline de turno (`apps/api/src/ai/ai.service.ts`) já trata `Adventure.generatedAdventure
=== null` e `Quest.objective === null` como casos de primeira classe, testados e
documentados como "Free/legado" (US-199): sem `generatedAdventure`, o antagonista é
considerado sempre revelado (`ai.service.ts` ~L692-696), `tone`/`setting`/`areaType` somem
do system prompt sem quebrar nada (~L779-783), e `composeMainQuestText` já tinha o guard
para `objective: null` desde a US-169. Reativar o caminho "sem motor" não é um estado novo
e frágil — é reaproveitar um fallback que já existe, já é testado e já roda em produção
para sistemas sem `initialAdventures`/`generatedAdventure`.

### A proposta

`dto.preset: true` (novo campo em `CreateAdventureDto`) faz `createForCharacter`
(`adventure.service.ts`) bifurcar ANTES de chamar o motor: resolve o gancho da classe
(`resolveInitialHook`, já existente) e seus `title`/`primaryQuestTitle`/
`primaryQuestDescription`/`openingNarration` (`resolveHookTemplate`, já existente) e
persiste `Adventure`/`AdventureParticipant`/`CharacterState`/`Quest`/`EventLog`
diretamente, numa única transação, **sem nenhuma chamada a `this.ai.*`**.
`generatedAdventure`/`entities`/`sceneState`/`Quest.objective`/`conclusionHint` ficam
ausentes (mesmo formato "Free/legado" citado acima). O ramo "Criar minha história" não
manda `preset` e continua idêntico ao motor de hoje.

---

## Escopo

### Dentro do escopo

- **`primaryQuestTitle`/`primaryQuestDescription` de volta em `InitialAdventureHookSchema`**
  ([system.ts](../../../packages/shared/src/types/system.ts)) — os mesmos dois campos que a
  US-155 removeu, agora `required` de novo (o ramo "pronta" precisa de uma quest fixa).
- **Conteúdo dos 13 ganchos** ([initial-adventures.ts](../../../apps/api/prisma/initial-adventures.ts)):
  título + descrição de quest curtos, coerentes com `pitch`/`openingNarration` já existentes,
  nos dois locales (26 pares de string).
- **`dto.preset?: boolean`** em `CreateAdventureDto`/`CreateAdventureSchema` — `true` pula o
  motor inteiro; ausente/`false` mantém o comportamento de hoje. `tone`/`setting`/`areaType`/
  `challenge` são ignorados quando `preset` é `true` (o ramo "pronta" nunca os envia).
- **Novo ramo síncrono em `createForCharacter`** — zero chamada a `this.ai.*`; persiste
  `Adventure` sem `generatedAdventure`/`entities`, `CharacterState` sem `sceneState`, `Quest`
  sem `objective`/`conclusionHint`.
- **`SetupWizard.tsx`** — `createWorldAdventure` manda `{ preset: true }` quando
  `worldMode === 'ready'`, em vez do dto vazio de antes.

### Fora do escopo

- **Qualquer mudança no ramo "Criar minha história".** Continua 100% no motor de geração
  (US-153), sem nenhuma alteração de comportamento — `dto.preset` ausente é o mesmo
  `createForCharacter` de sempre.
- **Locations/NPCs/encounters/antagonista fixos.** Esse conceito não existia na US-28 e não
  volta agora — "pronta" é gancho + quest + abertura, do jeito que sempre foi antes da
  US-153. Não é uma versão reduzida do `GeneratedAdventureSchema`, é a ausência dele.
- **Endpoint novo.** `POST /characters/:id/adventures` continua sendo o único caminho —
  `preset` é só mais um campo do mesmo DTO.
- **Mudar a UI da bifurcação em si** (cartões, cartão de prévia) — isso já é US-216; esta
  story só troca o que acontece no backend quando "pronta" é confirmada.

---

## Modelo de dados

```ts
// packages/shared/src/types/system.ts
export const InitialAdventureHookSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  classKey: z.string().min(1),
  pitch: z.string().min(1),
  primaryQuestTitle: z.string().min(1),        // reintroduzido (era da US-28, removido na US-155)
  primaryQuestDescription: z.string().min(1),  // idem
  openingNarration: z.string().min(1),
  tags: z.array(z.string()).default([]),
})
```

```ts
// apps/api/src/adventure/adventure.service.ts
export interface CreateAdventureDto {
  tone?: string
  setting?: string
  areaType?: string
  challenge?: 'adventure' | 'challenge'
  preset?: boolean // true = pula o motor inteiro (ramo "Aventura pronta")
}
```

Sem migração de banco — `Adventure.generatedAdventure`/`entities` e
`CharacterState.sceneState` e `Quest.objective`/`conclusionHint` já eram todos opcionais no
schema Prisma (o caminho "Free/legado" já existia).

---

## Critérios de aceite

- [x] `dto.preset: true` não dispara nenhuma chamada a `AiService` (`generatePremissa`,
      `generateLocationsAndNpcs`, `generateSecrets`, `generateAntagonist`, `generateClosing`,
      `generateOpeningNarration`, `extractOpeningScene`, `generateAntagonistLocationProse`).
- [x] `Adventure.title`, `Quest.title`/`description` e o `EventLog` de abertura vêm do gancho
      da classe do personagem (`resolveInitialHook`), com `{characterName}`/`{characterClass}`
      resolvidos — mesma regra de fallback `default` de sempre.
- [x] `Adventure.generatedAdventure`/`entities` ficam ausentes; `CharacterState.sceneState`
      fica ausente; `Quest.objective`/`conclusionHint` ficam ausentes.
- [x] `dto.preset` ausente/`false` mantém o comportamento gerado de hoje, sem regressão —
      `git diff` sem nenhuma mudança de lógica no ramo `!dto.preset`.
- [x] `SetupWizard.tsx`: selecionar "Aventura pronta" e confirmar chama
      `api.createAdventure(charId, { preset: true })` — nenhum outro campo.
- [x] Schema de `InitialAdventureHookSchema` volta a EXIGIR `primaryQuestTitle`/
      `primaryQuestDescription`; os 13 ganchos (12 classes + `default`) têm os dois campos
      preenchidos nos dois locales.
- [x] `pnpm typecheck` e `pnpm test` passam (repo inteiro).
- [x] **Eval / teste de regressão:** teste que confirma zero chamada de IA quando
      `preset: true` (spy em todos os métodos de `AiService`); teste que confirma
      `generatedAdventure`/`entities`/`sceneState`/`objective`/`conclusionHint` ausentes;
      teste que confirma fallback para o hook `default` quando a classe não tem gancho
      próprio; teste de regressão do ramo gerado (sem `preset`) inalterado.

---

## Notas de implementação

- `resolveInitialHook`/`resolveHookTemplate` ([starting-inventory.ts](../../../apps/api/src/character/starting-inventory.ts))
  já existiam e já eram usados pelo ramo gerado (só para o `hookSeed`) — o ramo preset
  reusa as MESMAS duas funções, sem duplicar regra.
- O fork em `createForCharacter` acontece logo depois do `order` ser calculado (prefixo
  comum: carregar character/system/config, `resolveInitialHook`, inventário) — ambos os
  ramos compartilham essa parte; só a transação final diverge.
- `initial-adventures.ts` só alimenta `System.config` (JSON) no momento do `pnpm db:seed` —
  mudar o arquivo exige re-seed pra chegar ao banco (Neon, branch `dev`).

---

## Questões em aberto

_Nenhuma questão em aberto remanescente._

---

## Referências no código

- [apps/api/src/adventure/adventure.service.ts](../../../apps/api/src/adventure/adventure.service.ts) — `CreateAdventureDto.preset` e o ramo `if (dto.preset)` dentro de `createForCharacter`.
- [apps/api/src/adventure/adventure.controller.ts](../../../apps/api/src/adventure/adventure.controller.ts) — `CreateAdventureSchema.preset`.
- [packages/shared/src/types/system.ts](../../../packages/shared/src/types/system.ts) — `InitialAdventureHookSchema` com `primaryQuestTitle`/`primaryQuestDescription` de volta.
- [apps/api/prisma/initial-adventures.ts](../../../apps/api/prisma/initial-adventures.ts) — os 13 ganchos com quest fixa nos dois locales.
- [apps/api/src/adventure/adventure.service.test.ts](../../../apps/api/src/adventure/adventure.service.test.ts) — `describe('ramo "Aventura pronta" (dto.preset, US-217)')`.
- [apps/api/prisma/initial-adventures.test.ts](../../../apps/api/prisma/initial-adventures.test.ts) — schema volta a exigir os dois campos.
- [apps/web/src/components/setup/SetupWizard.tsx](../../../apps/web/src/components/setup/SetupWizard.tsx) — `createWorldAdventure`, dto `{ preset: true }` no ramo `'ready'`.
- [apps/api/src/ai/ai.service.ts](../../../apps/api/src/ai/ai.service.ts) — o caminho "Free/legado" (US-199) que este ramo reaproveita, sem mudança nenhuma nele.
- [US-216](./US-216-escolher-aventura-pronta-ou-criar-propria-historia.md) — cria a bifurcação que esta story corrige.
- [US-153](./US-153-aventura-deixa-de-ser-derivada-da-classe.md) / [US-155](./US-155-aposentar-quest-fixa-por-classe.md) — as duas decisões reabertas, de forma estreita (só o ramo "pronta").
