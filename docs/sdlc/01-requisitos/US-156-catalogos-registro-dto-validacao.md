# US-156 — Catálogos de registro (setting/tone/areaType), DTO e validação

> ⚠️ **Parcialmente retirada por [US-173](./US-173-registro-fica-so-com-tone.md) (2026-08-19).** US-173 remove os catálogos `settings`/`areaTypes` (e os campos correspondentes de `CreateAdventureDto`/`GeneratedAdventureSchema`) — só `tones` continua vivo. A história abaixo descreve os TRÊS catálogos como foram implementados originalmente; é histórica pros dois que saem. Não reescrita aqui (convenção US-02/US-105) — ver US-173 para o estado atual.

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada (2026-08-18) — `settings`/`areaTypes` retirados por US-173 (2026-08-19)
**Depende de:** [US-144](./US-144-schema-aventura-shared.md) (schema da aventura, campos `setting`/`tone`/`areaType`)
**Bloqueia:** [US-157](./US-157-tela-de-mundo-depois-da-revisao.md)
**Relacionado:** [Backlog — Motor de geração de aventuras one-shot](./backlog-motor-de-geracao-de-aventuras.md) (US-156) · [ADR 012](../../adr/012-aventura-gerada-como-dado.md) (resolve rótulos `GEN-N` do backlog para número de story) · [US-105](./US-105-raca-e-classe-por-chave-do-srd.md) (contrato de chave canônica + rótulo por locale, copiado aqui) · [US-102](./US-102-gate-de-string-literal-no-jsx.md) (gate que reprova texto solto no JSX)
**Criada em:** 2026-08-15

---

## História

> **Como** jogador,
> **quero** escolher `setting`, `tone` e `areaType` da minha aventura — ou deixar cada um no aleatório —,
> **para que** a aventura gerada reflita o tipo de história que eu quero jogar, sem ser obrigado a aceitar tudo sorteado.

---

## Contexto e motivação

### O problema observado

A [US-144](./US-144-schema-aventura-shared.md) já declara `setting`/`tone`/`areaType` como campos de `GeneratedAdventureSchema`, guardando a **chave**, nunca o rótulo. Mas não existe hoje nenhum catálogo de valores possíveis para esses três campos — sem ele, a [US-147](./US-147-rolagem-registro-conteudo.md) não tem de onde sortear quando o jogador não escolhe, e não há como validar uma escolha do jogador contra algo.

### Por que a solução atual não basta

`SystemConfigSchema` ([system.ts](../../../packages/shared/src/types/system.ts)) já tem o padrão exato necessário — `SystemCatalogEntrySchema` (`{key, label}`), usado por `races`/`classes` desde a US-105 — mas não tem entradas de `settings`/`tones`/`areaTypes`. Sem elas, qualquer validação de "o jogador escolheu uma chave válida" teria que inventar uma lista paralela, correndo o risco do mesmo defeito que a US-105 já resolveu uma vez para raça/classe: catálogo divergindo entre frontend e backend.

### A proposta

`settings`, `tones`, `areaTypes` entram no `SystemConfig` como `SystemCatalogEntry[]` — o mesmo contrato de `races`/`classes`. "Aleatório" não é entrada de catálogo — é **ausência de escolha**: campo omitido no DTO, e a rolagem (US-147) sorteia pelo seed. A escolha é por campo (três opcionais independentes) e vive na aventura (`CreateAdventureDto`), não no personagem — sem migração de `Character`.

---

## Escopo

### Dentro do escopo

- **`config.settings`, `config.tones`, `config.areaTypes`** — três novos campos opcionais em `SystemConfigSchema`, cada um `z.array(SystemCatalogEntrySchema).optional()`, mesmo padrão de `races`/`classes`/`backgrounds`.
- **Conteúdo dos catálogos:** dez rótulos por eixo, copiados do dataset `dhorions/DnDGenerate` (`static/data/CampaignTones.json`, `Settings.json`, `areaType.json`, MPL-2.0 — licença permite reuso, rótulo genérico de uma palavra/expressão, sem prosa autoral a atribuir). Decisão revista: o backlog original previa rótulos curados à parte para o panteão do projeto (ver *Questões em aberto*, resolvida); a mantenedora optou por usar o conteúdo de origem diretamente em vez de inventar dez sinônimos. Lista completa e chaves em *Modelo de dados proposto*.
- **`CreateAdventureDto`** (já com `setting?`/`tone?`/`areaType?` desde a [US-153](./US-153-aventura-deixa-de-ser-derivada-da-classe.md)) valida cada campo presente contra o catálogo correspondente — mesmo `validateCatalogKey` que `character.service.ts` já usa para raça/classe/origem, reaplicado aqui do lado da aventura.
- **"Aleatório" nunca é uma chave de catálogo.** Campo omitido no DTO ⇒ [US-147](./US-147-rolagem-registro-conteudo.md) sorteia pelo seed. Nenhuma chave `random` entra nas listas — ausência já significa isso, e uma chave `random` obrigaria todo consumidor (prompt, artefato, resolução de rótulo, gate) a tratá-la como caso especial.
- **Validação no servidor, não só na tela** (fronteira de confiança): chave fora do catálogo do sistema é 400, mesmo molde da validação de classe e raça da US-105.

### Fora do escopo

- **A tela que envia a escolha** — é [US-157](./US-157-tela-de-mundo-depois-da-revisao.md); esta story só entrega catálogo + validação server-side, consumível por DTO mesmo sem UI.
- **O sorteio em si quando o campo está ausente** — já é escopo da [US-147](./US-147-rolagem-registro-conteudo.md); esta story só garante que o catálogo existe para o sorteio escolher de dentro dele.
- **Tradução dos dez rótulos por eixo para os dois locales** — segue o mesmo padrão de `races`/`classes`: `configLocales['pt-BR']` traz o rótulo em português, `config` (base EN) traz em inglês. Não é overlay novo de tradução automática (US-52); os dez rótulos por eixo são curtos o bastante para curadoria manual direta como literal em `dnd5eProductFields(locale)` (não no artefato JSON do ingest — ver *Onde as três listas entram no artefato* acima).

---

## Modelo de dados proposto

```ts
// packages/shared/src/types/system.ts — SystemConfigSchema, campos novos
export const SystemConfigSchema = z.object({
  // ... campos existentes ...
  settings: z.array(SystemCatalogEntrySchema).optional(),
  tones: z.array(SystemCatalogEntrySchema).optional(),
  areaTypes: z.array(SystemCatalogEntrySchema).optional(),
})
```

```ts
// apps/api/src/adventure/adventure.service.ts — CreateAdventureDto (já com os 3 campos desde a US-153)
export interface CreateAdventureDto {
  setting?: string
  tone?: string
  areaType?: string
}
```

| Campo | Antes | Depois |
|---|---|---|
| `config.settings/tones/areaTypes` | não existem | `SystemCatalogEntry[]`, opcionais, mesmo contrato de `races`/`classes` |
| `CreateAdventureDto.setting/tone/areaType` | opcionais, sem validação (US-153) | validados contra o catálogo quando presentes |

**Persistência:** `System.config`/`configLocales` (Json) — sem migração Prisma. `Character` **não** ganha coluna (a escolha vive na aventura, não no personagem — o mesmo personagem pode ter aventuras de tons diferentes).

**Onde as três listas entram no artefato:** NÃO em `buildConfig()` ([ingest.mjs:778](../../../scripts/srd/ingest.mjs)) — essa função monta o artefato inteiro a partir de dataset SRD (`data.abilities/skillsRaw/classes/...`), e `settings`/`tones`/`areaTypes` não têm fonte SRD nenhuma; forçar por lá exigiria simular resolver/overlay/`draftMissing` (US-52) para um dado que já nasce com os dois rótulos prontos. Elas entram como literal em `dnd5eProductFields(locale)` ([seed.ts:60](../../../apps/api/prisma/seed.ts)), ao lado de `proficiency`/`pointBuy`/`initialAdventures` — mesmo perfil: decisão de produto, não regra herdada do SRD.

**Sistema Free:** `buildFreeConfig()` ([seed.ts:79](../../../apps/api/prisma/seed.ts)) já espalha `...dnd5eProductFields(locale)` (linha 95) por cima do artefato herdado por chave. Colocar as três listas dentro de `dnd5eProductFields` faz o Free herdar de graça, sem código extra — mesmo catálogo, mesmas chaves, para os dois sistemas. Sem isso, aventura Free com `tone`/`setting`/`areaType` presente tomaria 400 sempre (catálogo ausente ≠ campo omitido).

### Conteúdo dos catálogos

Chave e rótulo EN copiados de `dhorions/DnDGenerate` (`static/data/`, commit `main` em 2026-08-18); rótulo pt-BR é tradução direta, sem overlay de tradução automática (fora de escopo, ver acima). Chave em `kebab-case`, mesmo padrão de `sleight-of-hand`/`land-vehicle` já usado nos catálogos de skill/tool.

**`config.tones`** (origem: `CampaignTones.json`)

| `key` | `label` (EN) | `label` (pt-BR) |
|---|---|---|
| `heroic` | Heroic | Heroico |
| `grimdark` | Grimdark | Sombrio |
| `mystery` | Mystery | Mistério |
| `comedic` | Comedic | Cômico |
| `epic` | Epic | Épico |
| `romantic` | Romantic | Romântico |
| `horror` | Horror | Terror |
| `political-intrigue` | Political Intrigue | Intriga Política |
| `survival` | Survival | Sobrevivência |
| `slice-of-life` | Slice of Life | Cotidiano |

**`config.settings`** (origem: `Settings.json`)

| `key` | `label` (EN) | `label` (pt-BR) |
|---|---|---|
| `high-fantasy` | High Fantasy | Alta Fantasia |
| `dark-fantasy` | Dark Fantasy | Fantasia Sombria |
| `steampunk` | Steampunk | Steampunk |
| `urban-fantasy` | Urban Fantasy | Fantasia Urbana |
| `post-apocalyptic` | Post-Apocalyptic | Pós-Apocalíptico |
| `historical-fiction` | Historical Fiction | Ficção Histórica |
| `sci-fi-space-opera` | Sci-Fi Space Opera | Ópera Espacial |
| `mythological` | Mythological | Mitológico |
| `alternate-reality` | Alternate Reality | Realidade Alternativa |
| `cyberpunk` | Cyberpunk | Cyberpunk |

**`config.areaTypes`** (origem: `areaType.json`)

| `key` | `label` (EN) | `label` (pt-BR) |
|---|---|---|
| `city` | City | Cidade |
| `forest` | Forest | Floresta |
| `mountain-range` | Mountain Range | Cordilheira |
| `underground-caves` | Underground Caves | Cavernas Subterrâneas |
| `desert` | Desert | Deserto |
| `coastal-area` | Coastal Area | Região Costeira |
| `swamp` | Swamp | Pântano |
| `plains` | Plains | Planícies |
| `magical-realm` | Magical Realm | Reino Mágico |
| `ruins` | Ruins | Ruínas |

Nota: `Settings.json` da fonte reserva `Mythological` — para Pegāna (panteão próprio do projeto), este é o valor esperado como escolha natural/frequente, mas continua sendo **um item do catálogo, não o único valor válido**; os outros nove settings continuam disponíveis para aventuras fora do panteão padrão.

---

## Critérios de aceite

- [x] `SystemConfigSchema` aceita `settings`, `tones`, `areaTypes` como `SystemCatalogEntry[]` opcionais — config legado sem eles continua válido.
- [x] `config.tones` tem exatamente as dez chaves `heroic`, `grimdark`, `mystery`, `comedic`, `epic`, `romantic`, `horror`, `political-intrigue`, `survival`, `slice-of-life`, com `label` nos dois locales.
- [x] `config.settings` tem exatamente as dez chaves `high-fantasy`, `dark-fantasy`, `steampunk`, `urban-fantasy`, `post-apocalyptic`, `historical-fiction`, `sci-fi-space-opera`, `mythological`, `alternate-reality`, `cyberpunk`, com `label` nos dois locales.
- [x] `config.areaTypes` tem exatamente as dez chaves `city`, `forest`, `mountain-range`, `underground-caves`, `desert`, `coastal-area`, `swamp`, `plains`, `magical-realm`, `ruins`, com `label` nos dois locales.
- [x] `CreateAdventureDto` com `tone: "heroic"`, `setting: "mythological"` ou `areaType: "ruins"` (uma chave válida de cada catálogo) passa a validação sem 400.
- [x] `CreateAdventureDto` com `setting`/`tone`/`areaType` presente e fora do catálogo do sistema (ex.: `tone: "chave-inexistente"`) recebe 400, mesma mensagem-molde de `validateCatalogKey` (valor ofensor + formato esperado).
- [x] `CreateAdventureDto` com os três campos ausentes não gera erro — a ausência é caminho válido (aleatório).
- [x] Nenhuma chave `random`/`aleatorio` existe em `settings`/`tones`/`areaTypes` — ausência de escolha é sempre campo omitido, nunca valor especial.
- [x] A escolha não persiste em `Character` — sem migração de coluna nova naquela tabela.
- [x] `dnd5eConfig` e `freeConfig` (os dois sistemas semeados, [seed.ts:99-100](../../../apps/api/prisma/seed.ts)) têm as mesmas três listas — Free herda por já espalhar `dnd5eProductFields`, não por cópia manual.
- [x] `pnpm db:seed` roda antes de qualquer verificação manual dos critérios de 400 — `validateCatalogKey` no-opa (aceita qualquer chave) em `System.config` sem os catálogos ([character.service.ts:141-142](../../../apps/api/src/character/character.service.ts)), então banco não re-semeado não reprova.
- [x] `pnpm typecheck` e `pnpm test` passam.
- [x] **Eval / teste de regressão:** teste que cria aventura com `tone: "chave-inexistente"` recebe 400; teste com `tone: "heroic"`, `setting: "high-fantasy"` e `areaType: "city"` passa; teste com os três campos omitidos não recebe erro e segue para o motor sortear (US-147).

---

## Notas de implementação

- **Copiar `validateCatalogKey`** ([character.service.ts:134-142](../../../apps/api/src/character/character.service.ts)) — mesma função, chamada do lado de `AdventureService` para os três campos novos, em vez de duplicar a lógica.
- **`SystemCatalogEntrySchema` já existe** ([system.ts:27-30](../../../packages/shared/src/types/system.ts)) — reusar diretamente, sem criar `SystemSettingSchema`/`SystemToneSchema`/`SystemAreaTypeSchema` redundantes (mesmo raciocínio que já vale para `classes` não ter schema próprio além do genérico).
- **Os dez rótulos por eixo são copiados do DnDGenerate** (`CampaignTones.json`/`Settings.json`/`areaType.json`) — decisão revista em relação ao backlog original (que previa rótulos próprios); ver *Conteúdo dos catálogos* para a lista com chave EN + rótulo pt-BR já resolvidos.
- **Literal em `dnd5eProductFields(locale)`, não em `buildConfig()`/ingest.mjs.** As três listas não são SRD-derivadas — não têm dataset de origem para `resolve()`/overlay consumirem. Adicionar como retorno fixo de `dnd5eProductFields` ([seed.ts:60-66](../../../apps/api/prisma/seed.ts)), rótulo pt-BR direto na branch `locale === 'pt-BR'`, sem tocar `ingest.mjs`.
- **Free herda pelo spread existente, não por código novo.** `buildFreeConfig()` já faz `...dnd5eProductFields(locale)` ([seed.ts:95](../../../apps/api/prisma/seed.ts)) — colocar as listas ali resolve os dois sistemas de uma vez. Confirmar com teste que `freeConfig.tones`/`settings`/`areaTypes` existem, não só `dnd5eConfig`.
- **Re-seed depois do merge.** `validateCatalogKey` aceita qualquer chave quando o catálogo está ausente/vazio ([character.service.ts:141-142](../../../apps/api/src/character/character.service.ts)) — banco de dev/staging só passa a rejeitar chave inválida depois de `pnpm db:seed` (local) ou `migrate deploy` + reseed manual (Neon, [US-58](./US-58-banco-postgres-neon.md)).
- **`pnpm docs:links`/gate US-102** não se aplicam a este backend em si — mas a [US-157](./US-157-tela-de-mundo-depois-da-revisao.md), que consome estes catálogos na UI, precisa (ela referencia o gate).

---

## Questões em aberto

Nenhuma. A única questão aberta (conteúdo final dos dez rótulos por eixo) foi resolvida em 2026-08-18: copiar `CampaignTones.json`/`Settings.json`/`areaType.json` do `dhorions/DnDGenerate` diretamente (chave EN + tradução pt-BR), em vez de curar rótulos próprios — ver *Conteúdo dos catálogos*.

---

## Referências no código

- [packages/shared/src/types/system.ts:27-30](../../../packages/shared/src/types/system.ts) — `SystemCatalogEntrySchema`, reusado sem alteração.
- [apps/api/src/character/character.service.ts:134-142](../../../apps/api/src/character/character.service.ts) — `validateCatalogKey`, a função copiada/reaplicada para os três campos novos.
- [US-105](./US-105-raca-e-classe-por-chave-do-srd.md) — contrato original de chave canônica + rótulo por locale.
- [US-153](./US-153-aventura-deixa-de-ser-derivada-da-classe.md) — `CreateAdventureDto` já com os três campos opcionais, sem validação (esta story adiciona a validação).
- [Backlog — Motor de geração de aventuras one-shot §GEN-13 e §O que o DnDGenerate acrescenta](./backlog-motor-de-geracao-de-aventuras.md) (US-156) — texto de origem.
- [`dhorions/DnDGenerate` — `static/data/`](https://github.com/dhorions/DnDGenerate/tree/main/src/main/resources/static/data) (`CampaignTones.json`, `Settings.json`, `areaType.json`, MPL-2.0) — fonte literal dos dez rótulos por eixo.
