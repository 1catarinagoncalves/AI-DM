# US-217 — "Aventura pronta" pula o motor de MUNDO, abertura continua gerada por IA (revert pontual da US-153/US-155)

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada (2026-09-05)
**Depende de:** [US-216](./US-216-escolher-aventura-pronta-ou-criar-propria-historia.md) (✅ — cria o ramo "Aventura pronta" que esta story corrige)
**Reabre:** [US-153](./US-153-aventura-deixa-de-ser-derivada-da-classe.md) (✅ — motor de geração; esta story só o desliga no ramo "pronta", "criar minha história" continua 100% nele) · [US-155](./US-155-aposentar-quest-fixa-por-classe.md) (✅ — removeu `primaryQuestTitle`/`primaryQuestDescription`; esta story reintroduz os dois campos)
**Criada em:** 2026-09-05

---

> ⚠️ **Esta story reabre, de forma estreita, duas decisões já fechadas.** A US-153 e a
> US-155 continuam corretas para o ramo "Criar minha história" (US-216) — nada muda lá. O
> que muda é só o ramo "Aventura pronta": ele deixa de rodar o motor de MUNDO (premissa,
> locais, NPCs, segredos, antagonista, fecho) e volta ao gancho fixo por classe que a US-28
> usava antes de a US-153 existir. A abertura (US-34) continua sendo escrita pela IA, como
> sempre foi — correção de percurso pedida ao testar (ver *Contexto*).

---

## História

> **Como** jogador que clicou "Aventura pronta",
> **quero** que a aventura comece sem esperar o mundo inteiro ser gerado (locais, NPCs,
> segredos, antagonista) — só a primeira cena, escrita na hora como sempre foi,
> **para que** "pronta" signifique realmente pronta, sem o motor pesado do "Criar minha
> história" rodando por baixo sem eu ter escolhido nada.

---

## Contexto e motivação

### O problema observado

A US-216 implementou a bifurcação "Aventura pronta" / "Criar minha história" no passo
`world`, mas manteve deliberadamente o motor de geração (US-153) rodando idêntico nos dois
ramos — só a *escolha* de Cenário/Tom/Área/Desafio era pulada em "pronta". Ao testar, a
mantenedora clicou "Aventura pronta" e viu os logs do `apps/api dev` disparando
`[AiService][generatePremissa]`/`[AiService][generateLocationsAndNpcs]` normalmente — o
motor inteiro (premissa, locais, NPCs, segredos, antagonista, fecho) continuava rodando.
Pedido inicial: reverter para como a criação funcionava **antes da US-153 existir** (US-28).

### Investigação: o que "como era antes" significa de verdade

`git log`/`git show` confirmam que a US-28 (`25a9127`) foi o **único commit da história do
repo** com criação de aventura 100% síncrona. No dia seguinte, a US-34 (`d3ef9f2`) já
introduziu a primeira chamada de IA — a abertura passou a ser escrita pelo Mestre na hora,
com fallback pro texto estático do gancho se a IA falhar/vier vazia. Ou seja: desde o 2º dia
de vida do projeto, a abertura NUNCA foi 100% estática em produção — só a quest
(`primaryQuestTitle`/`primaryQuestDescription`) e o resto do que a US-28 persistia eram.

**Correção de percurso (mesmo dia):** ao ver a implementação inicial (zero chamada de IA,
inclusive na abertura), a mantenedora pediu que a abertura continuasse "como a
[narração] se manteve" — ou seja, gerada pela IA, igual ao comportamento estável desde a
US-34, e não regredida para a foto exata (e mais curta) da US-28. O que esta story
efetivamente recria da US-28 é só a AUSÊNCIA do motor de mundo (US-153) — não a ausência
de IA na abertura, que nunca foi assim depois do 2º dia do projeto.

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
(`adventure.service.ts`) bifurcar ANTES do motor de mundo: resolve o gancho da classe
(`resolveInitialHook`, já existente) e seus `title`/`primaryQuestTitle`/
`primaryQuestDescription`/`openingNarration` (`resolveHookTemplate`, já existente),
chama `this.ai.generateOpeningNarration`/`extractOpeningScene` (a MESMA dupla de chamadas
que o ramo gerado já faz para a abertura, US-34/US-35 — sem `mainQuest`/`tone`/`setting`/
`areaType`/`entities`, porque não há motor gerado nesse ramo) e persiste
`Adventure`/`AdventureParticipant`/`CharacterState`/`Quest`/`EventLog` numa única
transação, **sem nenhuma chamada às 6 funções do motor de mundo** (`generatePremissa`,
`generateLocationsAndNpcs`, `generateSecrets`, `generateAntagonist`, `generateClosing`,
`generateAntagonistLocationProse`) nem ao `rollAdventure`/gate (US-150).
`generatedAdventure`/`entities`/`Quest.objective`/`conclusionHint` ficam ausentes (mesmo
formato "Free/legado" citado acima); `CharacterState.sceneState` fica presente ou ausente
dependendo só de a extração de cena ter respondido, exatamente como no ramo gerado. O ramo
"Criar minha história" não manda `preset` e continua idêntico ao motor de hoje.

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
- **Novo ramo em `createForCharacter`** — zero chamada às 6 funções do motor de MUNDO
  (locais/NPCs/segredos/antagonista/premissa/fecho) e ao gate (US-150); a abertura continua
  chamando `generateOpeningNarration`/`extractOpeningScene` (US-34/US-35), como sempre.
  Persiste `Adventure` sem `generatedAdventure`/`entities`, `Quest` sem `objective`/
  `conclusionHint`.
- **`SetupWizard.tsx`** — `createWorldAdventure` manda `{ preset: true }` quando
  `worldMode === 'ready'`, em vez do dto vazio de antes.

### Fora do escopo

- **Qualquer mudança no ramo "Criar minha história".** Continua 100% no motor de geração
  (US-153), sem nenhuma alteração de comportamento — `dto.preset` ausente é o mesmo
  `createForCharacter` de sempre.
- **Locations/NPCs/encounters/antagonista fixos.** Esse conceito não existia na US-28 e não
  volta agora — "pronta" é gancho + quest + abertura (gerada por IA), do jeito que sempre
  foi. Não é uma versão reduzida do `GeneratedAdventureSchema`, é a ausência dele.
- **Abertura estática (zero IA).** Tentativa inicial desta story, corrigida no mesmo dia
  (ver *Contexto*) — a abertura sempre foi gerada pela IA desde a US-34, e continua sendo
  neste ramo. Só o motor de MUNDO (US-153) fica ausente.
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

Sem migração de banco — `Adventure.generatedAdventure`/`entities`,
`CharacterState.sceneState` e `Quest.objective`/`conclusionHint` já eram todos opcionais no
schema Prisma (o caminho "Free/legado" já existia).

---

## Critérios de aceite

- [x] `dto.preset: true` não dispara nenhuma chamada às 6 funções do motor de MUNDO
      (`generatePremissa`, `generateLocationsAndNpcs`, `generateSecrets`,
      `generateAntagonist`, `generateClosing`, `generateAntagonistLocationProse`) nem ao
      gate (US-150)/`rollAdventure`.
- [x] `dto.preset: true` CONTINUA chamando `generateOpeningNarration`/`extractOpeningScene`
      (US-34/US-35) para a abertura — mesma dupla de chamadas do ramo gerado, com fallback
      pro texto estático do gancho se a IA falhar/vier vazia.
- [x] `Adventure.title` e `Quest.title`/`description` vêm do gancho da classe do personagem
      (`resolveInitialHook`), com `{characterName}`/`{characterClass}` resolvidos — mesma
      regra de fallback `default` de sempre.
- [x] `Adventure.generatedAdventure`/`entities` ficam ausentes; `Quest.objective`/
      `conclusionHint` ficam ausentes; `CharacterState.sceneState` fica presente quando a
      extração de cena responde, ausente quando não — mesmo comportamento do ramo gerado.
- [x] `dto.preset` ausente/`false` mantém o comportamento gerado de hoje, sem regressão —
      `git diff` sem nenhuma mudança de lógica no ramo `!dto.preset`.
- [x] `SetupWizard.tsx`: selecionar "Aventura pronta" e confirmar chama
      `api.createAdventure(charId, { preset: true })` — nenhum outro campo.
- [x] Schema de `InitialAdventureHookSchema` volta a EXIGIR `primaryQuestTitle`/
      `primaryQuestDescription`; os 13 ganchos (12 classes + `default`) têm os dois campos
      preenchidos nos dois locales.
- [x] `pnpm typecheck` e `pnpm test` passam (repo inteiro).
- [x] **Eval / teste de regressão:** teste que confirma zero chamada às 6 funções do motor
      de mundo quando `preset: true`; teste que confirma a abertura usa o texto da IA quando
      ela responde; teste que confirma o fallback pro texto estático quando a IA falha/vem
      vazia; teste que confirma `sceneState` populado quando a extração de cena responde;
      teste que confirma `generatedAdventure`/`entities`/`objective`/`conclusionHint`
      ausentes; teste que confirma fallback para o hook `default` quando a classe não tem
      gancho próprio; teste de regressão do ramo gerado (sem `preset`) inalterado.

---

## Notas de implementação

- `resolveInitialHook`/`resolveHookTemplate` ([starting-inventory.ts](../../../apps/api/src/character/starting-inventory.ts))
  já existiam e já eram usados pelo ramo gerado (só para o `hookSeed`) — o ramo preset
  reusa as MESMAS duas funções, sem duplicar regra.
- O fork em `createForCharacter` acontece logo depois do `order` ser calculado E do bloco
  que monta `labelPairs`/`skills`/`features`/`knownSpells` (hoisted pra antes do `if
  (dto.preset)` — os dois ramos precisam dele pra `generateOpeningNarration`). Só a partir
  daí um ramo chama o motor de mundo e o outro não; a chamada de abertura em si é
  praticamente idêntica nos dois (o ramo preset só não tem `mainQuest`/`tone`/`setting`/
  `areaType`/`entities` vindos de um artefato gerado — usa a quest estática no lugar de
  `mainQuest` e omite os outros 4).
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
