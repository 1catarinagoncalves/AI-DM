# US-184 — Jogador escolhe `setting`/`areaType` da aventura (revert do corte da US-173)

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada (21/08/2026). `pnpm typecheck` + `pnpm test` (338 testes api, 128 shared) verdes.
**Depende de:** [US-156](./US-156-catalogos-registro-dto-validacao.md) (catálogo/DTO original — esta story é o revert exato do corte que a [US-173](./US-173-registro-fica-so-com-tone.md) fez nela) · [AdventureRegistry](../../../apps/api/src/adventure-generation/roll-registry.ts)/[GeneratedAdventureSchema.registry](../../../packages/shared/src/types/adventure-generation.ts) (`setting`/`areaType` já restaurados no motor em 21/08/2026, código, sem US própria — esta story é o primeiro CONSUMIDOR de produto desse valor: o jogador escolhendo, não só o motor sorteando)
**Relacionado:** [US-157](./US-157-tela-de-mundo-depois-da-revisao.md) (a TELA que envia `setting`/`areaType` no `CreateAdventureDto` — reaberta em sessão seguinte a esta story, fora do escopo ORIGINAL desta US-184, ver *Fora do escopo* e *Questões em aberto* #2) · [US-187](./US-187-distribuicao-tematica-de-locationid-baseada-em-registry.md)/[US-185](./US-185-mestre-recebe-setting-areatype-em-todo-turno.md)/[US-186](./US-186-decisao-rollcontent-nao-recebe-setting-areatype.md) (mesma investigação/dia — "onde mais o registry precisa chegar pra a aventura fazer sentido tematicamente" — cada uma cobre um consumidor diferente de `setting`/`areaType`)
**Criada em:** 2026-08-21 — reversão do corte da US-173 (19/08/2026), retomando o desenho original da US-156: catálogo `settings`/`areaTypes` no `SystemConfig`, campos correspondentes no `CreateAdventureDto`, validação server-side e seed de dado.

---

## História

> **Como** jogadora,
> **quero** poder escolher o `setting` (cenário) e o `areaType` (tipo de área) da minha aventura ao criá-la, do mesmo jeito que já escolho o `tone` — ou deixar os dois no aleatório —,
> **para que** eu controle mais do que só o tom da aventura gerada, com a mesma liberdade "por campo, não tudo-ou-nada" que a US-156 original prometia.

---

## Contexto e motivação

### O que existia antes da US-173

A US-156 (implementada em 18/08/2026) desenhou os três eixos do registro — `tone`, `setting`, `areaType` — como `SystemCatalogEntry[]` opcionais no `SystemConfig`, com validação server-side (`validateCatalogKey`) e passagem por `CreateAdventureDto` até `rollRegistry` (US-147) como overrides. "Aleatório" nunca foi chave de catálogo: campo ausente no DTO é o sinal de sorteio pelo seed.

### O que a US-173 cortou, e por quê

Em 19/08/2026, a US-173 reduziu o registro a só `tone` — `settings`/`areaTypes` saíram do catálogo (`SystemConfig`), do DTO, do controller, do seed e de `AdventureRegistry`/`rollRegistry`. Motivo registrado na própria US-173: **nenhum consumidor fora da rolagem** — os dois valores existiam no registro mas nada além de `rollRegistry` os lia, e não havia gate de coerência entre eles e o conteúdo gerado.

### Por que o corte é revertido agora

Duas mudanças no mesmo dia (21/08/2026) tiram a premissa do corte: `AdventureRegistry`/`GeneratedAdventureSchema.registry` voltaram a carregar os três campos no motor (código já restaurado antes desta story), e a investigação que abriu esta story e as irmãs ([US-187](./US-187-distribuicao-tematica-de-locationid-baseada-em-registry.md)/[US-185](./US-185-mestre-recebe-setting-areatype-em-todo-turno.md)) mapeou consumidores REAIS pra `setting`/`areaType` além da rolagem (distribuição de `locationId`, prompt do Mestre em todo turno). Com consumidor real do lado do motor, falta o lado do PRODUTO: o jogador escolher, não só o sorteio decidir.

### A proposta

Revert exato do que a US-173 cortou: `SystemConfig.settings`/`areaTypes` (catálogo), `CreateAdventureDto.setting`/`areaType` (entrada), validação server-side (mesmo molde de `tone`), e o dado de seed (traduzido dos catálogos `SETTINGS`/`AREA_TYPES` de `registry-catalog.ts`, mesma fonte MPL-2.0 do `dhorions/DnDGenerate` que os `tones` já usam).

---

## Escopo

### Dentro do escopo

- `SystemConfigSchema` ([system.ts](../../../packages/shared/src/types/system.ts)) ganha `settings: z.array(SystemCatalogEntrySchema).optional()` e `areaTypes: z.array(SystemCatalogEntrySchema).optional()`, mesmo contrato de `tones`.
- `CreateAdventureDto`/`CreateAdventureSchema` ([adventure.service.ts](../../../apps/api/src/adventure/adventure.service.ts), [adventure.controller.ts](../../../apps/api/src/adventure/adventure.controller.ts)) ganham `setting?: string`/`areaType?: string`, mesmo contrato opcional de `tone`.
- `createForCharacter` valida `dto.setting`/`dto.areaType` contra `config.settings`/`config.areaTypes` via `validateCatalogKey` (mesmo molde de `tone` — catálogo fechado, config sem catálogo aceita o que vier) antes de repassar como `registryOverrides` a `generateGatedAdventure`.
- `apps/api/prisma/seed.ts` ganha `registrySettings`/`registrySettingsPtBr`/`registryAreaTypes`/`registryAreaTypesPtBr` — tradução direta dos mesmos catálogos que `SETTINGS`/`AREA_TYPES` (`registry-catalog.ts`) já usam pro sorteio, mesma origem/licença que `registryTones` já cita (`dhorions/DnDGenerate`, `CampaignTones.json`, MPL-2.0).
- `SystemConfigSchema` (`system.test.ts`), DTO/controller e o revert do seed testados — config legado sem os dois catálogos continua válido (mesma rede que já protegia `tones`).

### Fora do escopo

- **A tela** (`SetupWizard`, sétimo passo, US-157) — não reaberta NESTA story. O DTO já aceita os campos (mesmo estado que a US-157 original documentava: "o corte pode encolher sem deixar buraco, o DTO já aceita"); a UI pra escolher foi reaberta em sessão seguinte (ver *Questões em aberto* #2), fora do escopo original aqui registrado.
- **Consumo de `setting`/`areaType` na geração de conteúdo/narração** — já é escopo separado das stories irmãs desta investigação: [US-187](./US-187-distribuicao-tematica-de-locationid-baseada-em-registry.md) (locais/`locationId`), [US-185](./US-185-mestre-recebe-setting-areatype-em-todo-turno.md) (narração de turno). Esta story só resolve ENTRADA (jogador escolhe), não CONSUMO.
- **`rollContent`/tabelas LGMRD.** Decisão separada e já fechada — ver [US-186](./US-186-decisao-rollcontent-nao-recebe-setting-areatype.md).
- **Migração de dado.** `Character` não ganha coluna nova (a escolha vive na aventura, não no personagem — mesma decisão original da US-156); `SystemConfig` é JSON, sem migração Prisma.

---

## Critérios de aceite

- [x] `SystemConfigSchema.parse()` aceita `settings`/`areaTypes` como `SystemCatalogEntry[]` opcionais; config sem eles (legado) continua válido.
- [x] `CreateAdventureSchema`/`CreateAdventureDto` aceitam `setting?`/`areaType?`, mesmo contrato opcional de `tone`.
- [x] `createForCharacter`: `setting`/`areaType` fora do catálogo do sistema → 400 com o valor ofensor e as chaves esperadas (mesmo molde de `tone`, US-156).
- [x] `dto.setting`/`dto.areaType` validados chegam a `generateGatedAdventure` como `registryOverrides`, e daí a `rollRegistry` (fixado, não sorteado, quando presentes).
- [x] Seed (`pnpm db:seed`) grava `settings`/`areaTypes` nos dois locales (en-US/pt-BR), mesma origem/licença que `tones` já documenta.
- [x] `pnpm typecheck` e `pnpm test` passam (338 api, 128 shared, verificado nesta story).
- [x] `pnpm db:seed` rodado no banco real (21/08/2026, sessão seguinte) — `settings`/`areaTypes` gravados nos dois locales, confirmado via UI (ver §Questões em aberto #2).

---

## Notas de implementação

- Revert é literal ao desenho da US-156 — nenhuma decisão de forma nova, só as linhas que a US-173 removeu, reintroduzidas com os comentários atualizados pra citar esta story em vez da US-173.
- `registrySettings`/`registryAreaTypes` (seed) usam a MESMA fonte que `SETTINGS`/`AREA_TYPES` de `registry-catalog.ts` (chaves canônicas EN) — os dois catálogos (motor + produto) não podem divergir em chave, só em ORIGEM do dado (motor: constante hardcoded pro sorteio quando não há config; seed: `SystemConfig`, fonte de verdade pra validação/rótulo).

---

## Questões em aberto

1. ~~`pnpm db:seed` não foi rodado contra o banco real~~ — rodado em 21/08/2026 (sessão seguinte a esta story).
2. ~~A tela (US-157) permanece fora~~ — reaberta na mesma sessão do `db:seed` acima: `SetupWizard` (sétimo passo `world`) ganhou os grupos Cenário e Tipo de Área ao lado de Tom (`WorldOptionGroup`, mesmo componente), `createWorldAdventure` inclui `setting`/`areaType` no DTO com a mesma disciplina de omissão em Aleatório. Fora do escopo desta US-184 original, tratado como extensão direta — sem story própria (mesmo padrão de "revert literal" desta story, aplicado à camada visual).

---

## Referências no código

- [`packages/shared/src/types/system.ts`](../../../packages/shared/src/types/system.ts) — `SystemConfigSchema`, ganha `settings`/`areaTypes`.
- [`apps/api/src/adventure/adventure.service.ts`](../../../apps/api/src/adventure/adventure.service.ts) — `CreateAdventureDto`, `createForCharacter` (validação + `registryOverrides`).
- [`apps/api/src/adventure/adventure.controller.ts`](../../../apps/api/src/adventure/adventure.controller.ts) — `CreateAdventureSchema`, `@ApiBody` exemplo.
- [`apps/api/prisma/seed.ts`](../../../apps/api/prisma/seed.ts) — `registrySettings*`/`registryAreaTypes*`, dado de catálogo nos dois locales.
- [`apps/api/src/adventure-generation/roll-registry.ts`](../../../apps/api/src/adventure-generation/roll-registry.ts)/[`registry-catalog.ts`](../../../apps/api/src/adventure-generation/registry-catalog.ts) — `AdventureRegistry`/`SETTINGS`/`AREA_TYPES`, já restaurados no motor antes desta story.
- [US-173](./US-173-registro-fica-so-com-tone.md) — o corte que esta story reverte.
- [US-156](./US-156-catalogos-registro-dto-validacao.md) — o desenho original, revertido literalmente.
- [US-157](./US-157-tela-de-mundo-depois-da-revisao.md) — a tela, ainda fora do escopo.
