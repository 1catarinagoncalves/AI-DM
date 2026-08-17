# US-144 — Schema da aventura gerada em `@ai-dm/shared`

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** [US-143](./US-143-adr-aventura-como-dado-gerado.md) ✅ — [ADR 012](../../adr/012-aventura-gerada-como-dado.md) decidiu: artefato grava congelado em `Adventure.generatedAdventure Json?` (coluna nova), `seed` não persiste (recomputado de `Character.id`+`Adventure.order`, US-146)
**Relacionado:** [Backlog — Motor de geração de aventuras one-shot](./backlog-motor-de-geracao-de-aventuras.md) (US-144, bloqueia quase tudo abaixo dele) · [US-105](./US-105-raca-e-classe-por-chave-do-srd.md) (chave canônica EN, nunca rótulo — mesmo contrato para `tone`/`setting`/`areaType`) · [US-121](./US-121-catalogo-backgrounds-a5e-adventurers-guide.md) (`SystemBackgroundSchema`, molde de schema Zod de catálogo derivado) · [US-112](./US-112-arco-de-beats-do-que-muda.md) (arco de beats — coluna `Adventure.arc` separada e MUTÁVEL, não funde neste schema; ver *Questões em aberto* #3)
**Criada em:** 2026-08-15

---

## História

> **Como** desenvolvedora implementando o motor de geração,
> **quero** um schema Zod único para "o que uma aventura tem" — locais, NPCs, segredos, encontros, ganchos de continuidade — com referência cruzada por `id` e não por texto repetido,
> **para que** os dois produtores (motor gerado e, na fase 4, aventura escrita à mão) emitam o mesmo formato e o gate da [US-150](./US-150-gate-antes-de-persistir-aventura-gerada.md) tenha o que verificar.

---

## Contexto e motivação

### O problema observado

Hoje não existe representação de "uma aventura" além do que já está espalhado em `Adventure` (`title`), `Quest` (`title`/`description`/`isPrimary`) e o ledger `WorldEntity[]` de `Adventure.entities` (US-75). Não há local, encontro, segredo ou gancho de continuidade como tipo — só a quest primária derivada do gancho de classe ([initial-adventures.ts](../../../apps/api/prisma/initial-adventures.ts)) e o texto livre gerado pela narração de abertura. O motor de geração ([US-147](./US-147-rolagem-registro-conteudo.md) em diante) precisa de algo para escrever, e sem esse "algo" ser um schema explícito, cada passo do motor inventaria sua própria forma ad-hoc.

### Por que a solução atual não basta

`SystemConfigSchema` ([system.ts](../../../packages/shared/src/types/system.ts)) modela o **sistema de regras** (raças, classes, perícias) — não modela **uma aventura**. `WorldEntity` ([character.ts](../../../packages/shared/src/types/character.ts)) modela entidades soltas do ledger, sem a estrutura de locais/encontros/segredos que compõem uma aventura coesa, e sem vínculo declarado entre eles (nome repetido em duas seções não é referência verificável). Não há molde no repo para "isto é uma aventura completa" — só para os pedaços que ela alimenta depois de gerada.

### A proposta

Um schema Zod, `GeneratedAdventureSchema`, em `@ai-dm/shared`, com os campos que os *Eight Steps* do Lazy GM Resource Document exigem — não os que o motor sabe produzir. Três decisões de forma tomadas a partir do `dhorions/DnDGenerate` (ver o backlog, seção *O que o DnDGenerate acrescenta*) separam este schema de "oito listas paralelas": referência cruzada por `id`, fala do NPC como campo próprio (`narrative`), e `followUps[]` como campo obrigatório de continuidade.

---

## Escopo

### Dentro do escopo

- **`GeneratedAdventureSchema`** em `packages/shared/src/types/adventure-generation.ts` (arquivo novo — nenhum dos existentes em `types/` modela aventura como entidade): `id`, `levelRange`, `setting`, `tone`, `areaType`, `summary`, `npcs[]`, `secrets[]`, `locations[{id, title, aspects[], boxedText, description, occupants[]}]`, `encounters[]`, `start`, `conclusion`, `followUps[]`.
- **Referência cruzada é `id`, nunca texto livre.** `secret.locationId`, `encounter.locationId`, `encounter.npcIds[]`, `npc.interactions[].encounterId` — cada seção referencia outra por chave estável, nunca por nome repetido (nome batendo por acaso não é vínculo verificável pelo gate da [US-150](./US-150-gate-antes-de-persistir-aventura-gerada.md)).
- **`npc.interactions[].narrative`** — a fala escrita do NPC na interação, não a descrição de personalidade. Campo por interação.
- **`AdventureSecretSchema` tem só `text`, de propósito — não ganha `narrative`.** Segredo é fato/pista (os 40 prompts do LGMRD, [US-149](./US-149-segredos-40-prompts-lgmrd.md)), nunca fala de NPC; `narrative` é exclusivo de `npc.interactions[]` por desenho do backlog (*"as palavras exatas que o NPC fala"*, [backlog GEN-1](./backlog-motor-de-geracao-de-aventuras.md)). Segredo revelado vira `WorldEntity` no ledger ([US-151](./US-151-semear-ledger-segredos-gerados.md)) — o Mestre narra o fato, o segredo em si nunca fala.
- **`followUps[]`** — cada gancho com história suficiente para virar cenário da próxima aventura (a semente que o motor **emite**, sem planejar entre aventuras — ver *O que o motor não produz* no backlog).
- **Registro é propriedade da aventura, não da rolagem:** `setting`, `tone`, `areaType` entram no schema como campos da aventura (guardam a **chave**, nunca o rótulo — mesmo contrato de `races`/`classes` desde a [US-105](./US-105-raca-e-classe-por-chave-do-srd.md)), não como parte de uma tabela de rolagem à parte. A aventura escrita à mão (fase 4) também declara os três, em vez de sortear.
- **Teste que protege a inversão do backlog:** uma locação e dois segredos **escritos à mão** passam em `GeneratedAdventureSchema.parse()`, nos dois locales (en-US/pt-BR), antes de o motor existir. Garante que o schema não nasce moldado no que o gerador sabe produzir.
- **Exporta os tipos inferidos** (`GeneratedAdventure`, `AdventureNpc`, `AdventureSecret`, `AdventureLocation`, `AdventureEncounter`) do jeito que `system.ts` já faz (`export type X = z.infer<typeof XSchema>`).
- **Migração Prisma:** `Adventure.generatedAdventure Json?` (coluna nova, [ADR 012 D2](../../adr/012-aventura-gerada-como-dado.md)) — aplicada nesta story, que já é quem muda `@ai-dm/shared` primeiro. Não toca `Adventure.entities` (ledger `WorldEntity[]`, forma inalterada).

### Fora do escopo

- ~~Onde o artefato persiste~~ — **resolvido pelo [ADR 012](../../adr/012-aventura-gerada-como-dado.md):** coluna própria `Adventure.generatedAdventure Json?`, sem reuso de `Adventure.entities` (ver *Dentro do escopo*, migração desta story).
- **A rolagem que preenche o schema** ([US-147](./US-147-rolagem-registro-conteudo.md)) e a chamada ao modelo que escreve os segredos ([US-149](./US-149-segredos-40-prompts-lgmrd.md)) — esta story só define a forma, não o preenchimento.
- **Statblocks de encontro** (papéis Minion/Soldier/Brute) — `encounter.npcIds[]`/orçamento entram no schema como referência; a forma do statblock em si é [US-152](./US-152-statblocks-papel-orcamento.md).
- **Validação de que o grafo fecha** (toda referência aponta para algo que existe) — isso é o gate, [US-150](./US-150-gate-antes-de-persistir-aventura-gerada.md); esta story só declara os campos de `id`, não a verificação cruzada.
- **Tradução/overlay pt-BR do conteúdo gerado** — schema é bilíngue por natureza (mesma chave, texto no idioma que o motor gerou); política de tradução de segredo/local gerado é decisão de [US-149](./US-149-segredos-40-prompts-lgmrd.md)/[US-154](./US-154-eval-aventura-gerada.md), não desta story.

---

## Modelo de dados proposto

```ts
// packages/shared/src/types/adventure-generation.ts
export const AdventureNpcSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  role: z.string().min(1),
  interactions: z.array(z.object({
    encounterId: z.string().min(1).optional(),
    narrative: z.string().min(1),
  })),
})

export const AdventureSecretSchema = z.object({
  id: z.string().min(1),
  locationId: z.string().min(1),
  text: z.string().min(1),
})

export const AdventureLocationSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  aspects: z.array(z.string()),
  boxedText: z.string().min(1),
  description: z.string().min(1),
  occupants: z.array(z.string()),
})

export const AdventureEncounterSchema = z.object({
  id: z.string().min(1),
  locationId: z.string().min(1),
  npcIds: z.array(z.string()),
})

export const GeneratedAdventureSchema = z.object({
  id: z.string().min(1),
  levelRange: z.object({ min: z.number().int().min(1), max: z.number().int().min(1) }),
  setting: z.string().min(1),
  tone: z.string().min(1),
  areaType: z.string().min(1),
  summary: z.string().min(1),
  npcs: z.array(AdventureNpcSchema),
  secrets: z.array(AdventureSecretSchema),
  locations: z.array(AdventureLocationSchema),
  encounters: z.array(AdventureEncounterSchema),
  start: z.string().min(1),
  conclusion: z.string().min(1),
  followUps: z.array(z.string()),
})
```

```prisma
// apps/api/prisma/schema.prisma — campo novo dentro de model Adventure
generatedAdventure Json?
```

| Campo | Tipo | Descrição |
|---|---|---|
| `setting`/`tone`/`areaType` | string (chave) | Registro da aventura — chave canônica, resolvida a rótulo pelo catálogo de [US-156](./US-156-catalogos-registro-dto-validacao.md), mesmo contrato de `catalogLabel` (US-105). |
| `secrets[].locationId` | string | `id` de uma entrada em `locations[]` — vínculo verificável, não nome repetido. |
| `npcs[].interactions[].encounterId` | string, opcional | `id` de `encounters[]` quando a interação acontece dentro de um encontro; ausente para interação fora de combate. |
| `followUps[]` | string[] | Ganchos que a próxima aventura herda — a única continuidade entre one-shots (ver backlog, *O adiamento do arco para a fase 4*). |

**Persistência:** `Adventure.generatedAdventure Json?`, coluna nova ([ADR 012 D2](../../adr/012-aventura-gerada-como-dado.md)). `seed` não persiste — recomputado por `deriveAdventureSeed(characterId, order)` (US-146) a partir de `Character.id`+`Adventure.order`, já existentes.

---

## Critérios de aceite

- [x] `GeneratedAdventureSchema` existe em `packages/shared/src/types/adventure-generation.ts`, exportado junto dos tipos inferidos, no padrão de `system.ts` (`z.infer`).
- [x] Toda referência cruzada entre seções é por `id` (`secret.locationId`, `encounter.locationId`, `encounter.npcIds[]`, `npc.interactions[].encounterId`) — nenhum campo de vínculo é string livre repetindo um nome.
- [x] `npc.interactions[].narrative` existe e é obrigatório quando há interação — a fala escrita, não descrição de personalidade.
- [x] `followUps` é array obrigatório (pode ser vazio, mas o campo existe sempre — não é `.optional()`).
- [x] `setting`, `tone`, `areaType` são campos de `GeneratedAdventureSchema` (propriedade da aventura), não de uma tabela de rolagem separada.
- [x] **Teste que protege a inversão do backlog:** uma locação e dois segredos escritos à mão (fixture, sem motor nenhum rodando) passam em `GeneratedAdventureSchema.parse()` — nos textos em `pt-BR` e em `en-US`.
- [x] `Adventure.generatedAdventure Json?` existe no schema Prisma, migração aplicada — coluna decidida pelo [ADR 012](../../adr/012-aventura-gerada-como-dado.md), `Adventure.entities` sem alteração de forma.
- [x] `pnpm typecheck` e `pnpm test --filter @ai-dm/shared` passam.
- [x] **Eval / teste de regressão:** fixture com uma aventura mínima válida (1 local, 1 NPC, 1 segredo referenciando o local) passa em `.parse()`; a mesma fixture com `secret.locationId` apontando para um `id` inexistente **não** falha aqui (o schema não verifica existência cruzada — isso é o gate da [US-150](./US-150-gate-antes-de-persistir-aventura-gerada.md)) mas continua validando a forma, provando que a checagem de grafo é responsabilidade de outra camada.

---

## Notas de implementação

- **Arquivo novo, não extensão de `system.ts` ou `character.ts`.** `system.ts` modela regras do sistema (raça/classe/perícia), `character.ts` modela o personagem e o ledger — uma aventura gerada é uma terceira coisa, com ciclo de vida próprio (nasce na criação da aventura, não no personagem nem no sistema).
- **`id` na raiz do schema é intencional.** [ADR 012 D3](../../adr/012-aventura-gerada-como-dado.md) fechou a dúvida: `generatedAdventure.id` (campo dentro do `Json?`) e `Adventure.id` (PK da linha) são namespaces diferentes — sem colisão real. Não renomear pra `generationId`.
- **`Adventure.entities` (ledger `WorldEntity[]`) não muda de forma nesta story.** O artefato vai pra coluna separada ([ADR 012 D2](../../adr/012-aventura-gerada-como-dado.md)); o [US-151](./US-151-semear-ledger-segredos-gerados.md) deriva o ledger do artefato depois — não é escopo desta US.
- **Reusar o padrão de `SystemCatalogEntrySchema` para `setting`/`tone`/`areaType`** só na resolução de rótulo (via [US-156](./US-156-catalogos-registro-dto-validacao.md)/`SystemConfig.settings|tones|areaTypes`) — aqui, no schema da aventura, os três campos são só `z.string().min(1)` guardando a chave.
- **`levelRange` como objeto, não string**, para o gate da [US-150](./US-150-gate-antes-de-persistir-aventura-gerada.md) comparar numericamente contra o nível do personagem sem parsear texto.
- **Ordem de escrita sugerida pelo backlog:** este schema nasce ANTES do motor ([US-145](./US-145-sync-lgmrd-notice.md) em diante) — o teste de locação+segredos à mão é o que impede o schema de ficar moldado só no que o motor sabe produzir (ver *Um schema, dois produtores* no backlog).
- **Como criar a migração desta story (Neon não roda `migrate dev`, [AGENTS.md](../../../AGENTS.md) → *Armadilhas*, P1017/shadow DB):**
  1. Escrever `migration.sql` à mão numa pasta nova `apps/api/prisma/migrations/<timestamp>_us144_adventure_generated/`, timestamp só precisa ordenar depois da última (`20260814120000_us132_character_tools`) — mesmo padrão hand-authored já usado no repo. Conteúdo trivial, mesma forma de [`20260722223521_add_adventure_entities/migration.sql`](../../../apps/api/prisma/migrations/20260722223521_add_adventure_entities/migration.sql):
     ```sql
     -- AlterTable
     ALTER TABLE "Adventure" ADD COLUMN     "generatedAdventure" JSONB;
     ```
  2. Aplicar contra a Neon com `migrate deploy` (sem shadow): `npx dotenv -e .env -- pnpm --filter api db:migrate:deploy`.
  3. O gate de CI ([US-93](./US-93-gates-baratos-de-migracao-dependencia-e-smoke.md)) roda `migrate diff --shadow-database-url` contra um Postgres descartável do runner (não a Neon) — só quebra se o `migration.sql` não bater exatamente com `schema.prisma` commitado.
- **Teste bilíngue em `packages/shared/src/types/adventure-generation.test.ts`** (irmão de [`system.test.ts`](../../../packages/shared/src/types/system.test.ts)), sem arquivo de fixture separado — o pacote `shared` não tem `__fixtures__`/`fixtures/` em lugar nenhum, sempre objeto literal inline no próprio `.test.ts`. Dois `it()` (`pt-BR`, `en-US`), não `describe.each` — mesmo padrão de [`starting-kit.test.ts:77-82`](../../../packages/shared/src/starting-kit.test.ts) (`MEMENTO_ITEM_LABEL`), que já testa um par bilíngue lado a lado no mesmo arquivo. Cada `it` monta a locação + 2 segredos à mão (1 objeto `GeneratedAdventureSchema`-shaped completo) e chama `.parse()`.

---

## Questões em aberto

1. ~~Herdada da US-143: se a persistência escolhida for `Adventure.entities` reusado, este schema precisa conviver na mesma coluna que `WorldEntity[]`~~ — **resolvida pelo [ADR 012](../../adr/012-aventura-gerada-como-dado.md) (16/08/2026):** coluna própria `Adventure.generatedAdventure Json?`, sem reuso — não convive com `WorldEntity[]`.
2. O nível de detalhe de `AdventureEncounterSchema` (só `npcIds[]` e `locationId`, sem orçamento nem CR) é suficiente para a [US-150](./US-150-gate-antes-de-persistir-aventura-gerada.md) verificar "o orçamento cabe em um personagem"? A [US-152](./US-152-statblocks-papel-orcamento.md) pode exigir campos adicionais aqui (`budget`, `role` por NPC no encontro) — a decidir quando aquela story escrever contra este schema.

3. **Este schema deveria virar fonte de beat para a [US-112](./US-112-arco-de-beats-do-que-muda.md)?** Cogitado em 17/08/2026: os `id` de `locations[]`/`npcs[]`/`secrets[]`/`encounters[]` já são vínculo verificável — em tese, matéria-prima melhor pra um beat (`locationId`/`npcId` reais) que a extração livre (`extractOpeningArc`) que a US-112 propõe sobre a prosa da abertura. **Não é campo novo aqui.** `Adventure.arc` da US-112 é estado mutável por turno (`estado: pendente/ativo/cumprido`, escrito pelo `advanceBeat`); `generatedAdventure` é congelado por desenho ([ADR 012](../../adr/012-aventura-gerada-como-dado.md) D1/D2, que já rejeitou misturar ciclo mutável e imutável numa coluna só — foi a mesma pergunta feita e respondida pro ledger). Fica registrado pra quem implementar a US-112 decidir a fonte dos beats por produtor: motor deriva do artefato, gancho de classe/aventura autoral usa `extractOpeningArc`.

---

## Referências no código

- [packages/shared/src/types/system.ts](../../../packages/shared/src/types/system.ts) — `SystemCatalogEntrySchema`, `SystemBackgroundSchema`: molde de schema Zod de catálogo derivado e o padrão `export type X = z.infer<typeof XSchema>` a seguir.
- [packages/shared/src/types/character.ts](../../../packages/shared/src/types/character.ts) — `WorldEntity`, `EntityEdge`: a forma que já ocupa `Adventure.entities` hoje, sem alteração ([ADR 012](../../adr/012-aventura-gerada-como-dado.md) decidiu coluna separada).
- [apps/api/prisma/schema.prisma](../../../apps/api/prisma/schema.prisma) — `Adventure.entities` (`Json?`, inalterada) e `Adventure.generatedAdventure` (`Json?`, nova — aplicada por esta story).
- [docs/adr/012-aventura-gerada-como-dado.md](../../adr/012-aventura-gerada-como-dado.md) — ADR que decide persistência congelada, coluna própria e `id` mantido; esta story consome as três decisões.
- [Backlog — Motor de geração de aventuras one-shot §GEN-1](./backlog-motor-de-geracao-de-aventuras.md) (US-144) — texto de origem, incluindo a seção *O que o DnDGenerate acrescenta* (integridade referencial, `narrative`, `followUps`).
- [US-105](./US-105-raca-e-classe-por-chave-do-srd.md) — `catalogLabel`, o contrato de chave canônica + rótulo por locale que `setting`/`tone`/`areaType` seguem.
