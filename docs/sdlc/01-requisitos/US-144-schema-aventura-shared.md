# US-144 — Schema da aventura gerada em `@ai-dm/shared`

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** [US-143](./US-143-adr-aventura-como-dado-gerado.md) (ADR: regenerável/congelada e onde o artefato mora — decide a forma de persistência antes desta story desenhar o schema)
**Relacionado:** [Backlog — Motor de geração de aventuras one-shot](./backlog-motor-de-geracao-de-aventuras.md) (GEN-1, bloqueia quase tudo abaixo dele) · [US-105](./US-105-raca-e-classe-por-chave-do-srd.md) (chave canônica EN, nunca rótulo — mesmo contrato para `tone`/`setting`/`areaType`) · [US-121](./US-121-catalogo-backgrounds-a5e-adventurers-guide.md) (`SystemBackgroundSchema`, molde de schema Zod de catálogo derivado)
**Criada em:** 2026-08-15

---

## História

> **Como** desenvolvedora implementando o motor de geração,
> **quero** um schema Zod único para "o que uma aventura tem" — locais, NPCs, segredos, encontros, ganchos de continuidade — com referência cruzada por `id` e não por texto repetido,
> **para que** os dois produtores (motor gerado e, na fase 4, aventura escrita à mão) emitam o mesmo formato e o gate da [GEN-7](./US-150-gate-antes-de-persistir-aventura-gerada.md) tenha o que verificar.

---

## Contexto e motivação

### O problema observado

Hoje não existe representação de "uma aventura" além do que já está espalhado em `Adventure` (`title`), `Quest` (`title`/`description`/`isPrimary`) e o ledger `WorldEntity[]` de `Adventure.entities` (US-75). Não há local, encontro, segredo ou gancho de continuidade como tipo — só a quest primária derivada do gancho de classe ([initial-adventures.ts](../../../apps/api/prisma/initial-adventures.ts)) e o texto livre gerado pela narração de abertura. O motor de geração (GEN-4 em diante) precisa de algo para escrever, e sem esse "algo" ser um schema explícito, cada passo do motor inventaria sua própria forma ad-hoc.

### Por que a solução atual não basta

`SystemConfigSchema` ([system.ts](../../../packages/shared/src/types/system.ts)) modela o **sistema de regras** (raças, classes, perícias) — não modela **uma aventura**. `WorldEntity` ([character.ts](../../../packages/shared/src/types/character.ts)) modela entidades soltas do ledger, sem a estrutura de locais/encontros/segredos que compõem uma aventura coesa, e sem vínculo declarado entre eles (nome repetido em duas seções não é referência verificável). Não há molde no repo para "isto é uma aventura completa" — só para os pedaços que ela alimenta depois de gerada.

### A proposta

Um schema Zod, `GeneratedAdventureSchema`, em `@ai-dm/shared`, com os campos que os *Eight Steps* do Lazy GM Resource Document exigem — não os que o motor sabe produzir. Três decisões de forma tomadas a partir do `dhorions/DnDGenerate` (ver o backlog, seção *O que o DnDGenerate acrescenta*) separam este schema de "oito listas paralelas": referência cruzada por `id`, fala do NPC como campo próprio (`narrative`), e `followUps[]` como campo obrigatório de continuidade.

---

## Escopo

### Dentro do escopo

- **`GeneratedAdventureSchema`** em `packages/shared/src/types/adventure-generation.ts` (arquivo novo — nenhum dos existentes em `types/` modela aventura como entidade): `id`, `levelRange`, `setting`, `tone`, `areaType`, `summary`, `npcs[]`, `secrets[]`, `locations[{id, title, aspects[], boxedText, description, occupants[]}]`, `encounters[]`, `start`, `conclusion`, `followUps[]`.
- **Referência cruzada é `id`, nunca texto livre.** `secret.locationId`, `encounter.locationId`, `encounter.npcIds[]`, `npc.interactions[].encounterId` — cada seção referencia outra por chave estável, nunca por nome repetido (nome batendo por acaso não é vínculo verificável pelo gate da GEN-7).
- **`npc.interactions[].narrative`** — a fala escrita do NPC na interação, não a descrição de personalidade. Campo por interação.
- **`followUps[]`** — cada gancho com história suficiente para virar cenário da próxima aventura (a semente que o motor **emite**, sem planejar entre aventuras — ver *O que o motor não produz* no backlog).
- **Registro é propriedade da aventura, não da rolagem:** `setting`, `tone`, `areaType` entram no schema como campos da aventura (guardam a **chave**, nunca o rótulo — mesmo contrato de `races`/`classes` desde a [US-105](./US-105-raca-e-classe-por-chave-do-srd.md)), não como parte de uma tabela de rolagem à parte. A aventura escrita à mão (fase 4) também declara os três, em vez de sortear.
- **Teste que protege a inversão do backlog:** uma locação e dois segredos **escritos à mão** passam em `GeneratedAdventureSchema.parse()`, nos dois locales (en-US/pt-BR), antes de o motor existir. Garante que o schema não nasce moldado no que o gerador sabe produzir.
- **Exporta os tipos inferidos** (`GeneratedAdventure`, `AdventureNpc`, `AdventureSecret`, `AdventureLocation`, `AdventureEncounter`) do jeito que `system.ts` já faz (`export type X = z.infer<typeof XSchema>`).

### Fora do escopo

- **Onde o artefato persiste** — decidido pela [US-143](./US-143-adr-aventura-como-dado-gerado.md), consumido aqui só como constraint de forma (se a decisão for reusar `Adventure.entities`, o schema não pode colidir com `WorldEntity[]`).
- **A rolagem que preenche o schema** (GEN-4/[US-147](./US-147-rolagem-registro-conteudo.md)) e a chamada ao modelo que escreve os segredos (GEN-6/[US-149](./US-149-segredos-40-prompts-lgmrd.md)) — esta story só define a forma, não o preenchimento.
- **Statblocks de encontro** (papéis Minion/Soldier/Brute) — `encounter.npcIds[]`/orçamento entram no schema como referência; a forma do statblock em si é [GEN-9](./US-152-statblocks-papel-orcamento.md).
- **Validação de que o grafo fecha** (toda referência aponta para algo que existe) — isso é o gate, [GEN-7](./US-150-gate-antes-de-persistir-aventura-gerada.md); esta story só declara os campos de `id`, não a verificação cruzada.
- **Tradução/overlay pt-BR do conteúdo gerado** — schema é bilíngue por natureza (mesma chave, texto no idioma que o motor gerou); política de tradução de segredo/local gerado é decisão de GEN-6/GEN-11, não desta story.

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

| Campo | Tipo | Descrição |
|---|---|---|
| `setting`/`tone`/`areaType` | string (chave) | Registro da aventura — chave canônica, resolvida a rótulo pelo catálogo de [GEN-13](./US-156-catalogos-registro-dto-validacao.md), mesmo contrato de `catalogLabel` (US-105). |
| `secrets[].locationId` | string | `id` de uma entrada em `locations[]` — vínculo verificável, não nome repetido. |
| `npcs[].interactions[].encounterId` | string, opcional | `id` de `encounters[]` quando a interação acontece dentro de um encontro; ausente para interação fora de combate. |
| `followUps[]` | string[] | Ganchos que a próxima aventura herda — a única continuidade entre one-shots (ver backlog, *O adiamento do arco para a fase 4*). |

**Persistência:** decidida pela [US-143](./US-143-adr-aventura-como-dado-gerado.md) — este schema é o contrato de forma, independente de onde o JSON valida acabe gravado.

---

## Critérios de aceite

- [ ] `GeneratedAdventureSchema` existe em `packages/shared/src/types/adventure-generation.ts`, exportado junto dos tipos inferidos, no padrão de `system.ts` (`z.infer`).
- [ ] Toda referência cruzada entre seções é por `id` (`secret.locationId`, `encounter.locationId`, `encounter.npcIds[]`, `npc.interactions[].encounterId`) — nenhum campo de vínculo é string livre repetindo um nome.
- [ ] `npc.interactions[].narrative` existe e é obrigatório quando há interação — a fala escrita, não descrição de personalidade.
- [ ] `followUps` é array obrigatório (pode ser vazio, mas o campo existe sempre — não é `.optional()`).
- [ ] `setting`, `tone`, `areaType` são campos de `GeneratedAdventureSchema` (propriedade da aventura), não de uma tabela de rolagem separada.
- [ ] **Teste que protege a inversão do backlog:** uma locação e dois segredos escritos à mão (fixture, sem motor nenhum rodando) passam em `GeneratedAdventureSchema.parse()` — nos textos em `pt-BR` e em `en-US`.
- [ ] `pnpm typecheck` e `pnpm test --filter @ai-dm/shared` passam.
- [ ] **Eval / teste de regressão:** fixture com uma aventura mínima válida (1 local, 1 NPC, 1 segredo referenciando o local) passa em `.parse()`; a mesma fixture com `secret.locationId` apontando para um `id` inexistente **não** falha aqui (o schema não verifica existência cruzada — isso é o gate da GEN-7) mas continua validando a forma, provando que a checagem de grafo é responsabilidade de outra camada.

---

## Notas de implementação

- **Arquivo novo, não extensão de `system.ts` ou `character.ts`.** `system.ts` modela regras do sistema (raça/classe/perícia), `character.ts` modela o personagem e o ledger — uma aventura gerada é uma terceira coisa, com ciclo de vida próprio (nasce na criação da aventura, não no personagem nem no sistema).
- **Reusar o padrão de `SystemCatalogEntrySchema` para `setting`/`tone`/`areaType`** só na resolução de rótulo (via [GEN-13](./US-156-catalogos-registro-dto-validacao.md)/`SystemConfig.settings|tones|areaTypes`) — aqui, no schema da aventura, os três campos são só `z.string().min(1)` guardando a chave.
- **`levelRange` como objeto, não string**, para o gate da GEN-7 comparar numericamente contra o nível do personagem sem parsear texto.
- **Ordem de escrita sugerida pelo backlog:** este schema nasce ANTES do motor (GEN-2 em diante) — o teste de locação+segredos à mão é o que impede o schema de ficar moldado só no que o motor sabe produzir (ver *Um schema, dois produtores* no backlog).

---

## Questões em aberto

1. Herdada da [US-143](./US-143-adr-aventura-como-dado-gerado.md): se a persistência escolhida for `Adventure.entities` reusado, este schema precisa conviver na mesma coluna que `WorldEntity[]` — provavelmente como um campo irmão dentro de um envelope maior, não a própria coluna. Decisão de forma final fica para quando a US-143 fechar.
2. O nível de detalhe de `AdventureEncounterSchema` (só `npcIds[]` e `locationId`, sem orçamento nem CR) é suficiente para a GEN-7 verificar "o orçamento cabe em um personagem"? A [GEN-9](./US-152-statblocks-papel-orcamento.md) pode exigir campos adicionais aqui (`budget`, `role` por NPC no encontro) — a decidir quando aquela story escrever contra este schema.

---

## Referências no código

- [packages/shared/src/types/system.ts](../../../packages/shared/src/types/system.ts) — `SystemCatalogEntrySchema`, `SystemBackgroundSchema`: molde de schema Zod de catálogo derivado e o padrão `export type X = z.infer<typeof XSchema>` a seguir.
- [packages/shared/src/types/character.ts](../../../packages/shared/src/types/character.ts) — `WorldEntity`, `EntityEdge`: a forma que já ocupa `Adventure.entities` hoje; ponto de atenção para a US-143 não colidir.
- [apps/api/prisma/schema.prisma](../../../apps/api/prisma/schema.prisma) — `Adventure.entities` (`Json?`).
- [Backlog — Motor de geração de aventuras one-shot §GEN-1](./backlog-motor-de-geracao-de-aventuras.md) — texto de origem, incluindo a seção *O que o DnDGenerate acrescenta* (integridade referencial, `narrative`, `followUps`).
- [US-105](./US-105-raca-e-classe-por-chave-do-srd.md) — `catalogLabel`, o contrato de chave canônica + rótulo por locale que `setting`/`tone`/`areaType` seguem.
