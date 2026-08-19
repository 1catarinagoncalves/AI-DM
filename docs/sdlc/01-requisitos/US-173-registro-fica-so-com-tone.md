# US-173 — Registro da aventura fica só com `tone`; `settings` e `areaTypes` saem do catálogo

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** nenhuma
**Bloqueia:** [US-168](./US-168-abertura-narra-gancho-fixo-nao-aventura-gerada.md) (`buildDmSystemPrompt`/`streamChat` só ganham `tone`, não os três campos — story já atualizada assumindo esta rodar antes) · [US-172](./US-172-abertura-gerada-nao-copia-gancho-fixo.md) (`registry` que a geração de `start` consome já é só `tone` — story já atualizada)
**Relacionado:** [US-156](./US-156-catalogos-registro-dto-validacao.md) (✅, dona dos três catálogos — parcialmente retirada por esta story, ver nota no topo daquele documento) · [US-153](./US-153-aventura-deixa-de-ser-derivada-da-classe.md) (✅, dona do `CreateAdventureDto` — nota de retirada parcial adicionada lá) · [US-157](./US-157-tela-de-mundo-depois-da-revisao.md) (✅, dona da UI — nota de retirada parcial adicionada lá)
**Criada em:** 2026-08-19 — decisão da mantenedora ao investigar o padrão de divergência do `registry` (`areaType`↔`locations`; extensão pra `tone`/`setting` e o achado de `generateSecrets` não receber `registry` nenhum, correção aplicada na US-168): em vez de reforçar prompt-a-prompt três eixos com o mesmo problema estrutural, reduzir o registro ao único eixo que hoje tem consumidor real fora da geração de conteúdo (`tone`, usado — ou a usar, via US-168 — para moldar COMO o Mestre narra).

---

## História

> **Como** mantenedora,
> **quero** que o registro da aventura gerada (`registry`) tenha só `tone`, sem `setting`/`areaType`,
> **para que** a superfície de campos que podem divergir do conteúdo gerado pare de crescer, e o único eixo que sobra seja o que efetivamente muda alguma coisa perceptível (COMO o Mestre narra), não só sabor de prompt sem consumidor de verdade.

---

## Contexto e motivação

### O problema observado

`registry` tem hoje três eixos (`setting`/`tone`/`areaType`, US-156) sorteados em seeds independentes ([roll-registry.ts:32-38](../../../apps/api/src/adventure-generation/roll-registry.ts)) e citados como frase solta nos prompts de `generateLocationsAndNpcs`/`generateClosing` ([ai.service.ts:1302](../../../apps/api/src/ai/ai.service.ts), [:1408](../../../apps/api/src/ai/ai.service.ts)) — sem gate, sem schema que force coerência entre o eixo sorteado e o conteúdo gerado.

**Achado concreto (2026-08-19) sobre `areaType`↔`locations`:** `registry.areaType` é sorteado num eixo de seed separado (`roll-registry.ts:36`) do conteúdo bruto que vira `locations[]` (`roll-content.ts:59`, tabela LGMRD `locationsmonumentsanditems`) — os dois nunca se falam na rolagem, e `generateLocationsAndNpcs` só cita `areaType` como cláusula final de uma frase de sistema, sem instrução de reconciliação. Investigado se dava pra filtrar a tabela por `areaType` na raiz: `locationsmonumentsanditems` (`scripts/lazygm/lgmrd-tables.json`) tem só 20 linhas genéricas (`d20`/`location`/`monument`/`item`, ex. `"Tower"`/`"Crypts"`/`"Keep"`) sem qualquer coluna de categoria — categorizá-las por `AREA_TYPES` seria julgamento editorial subjetivo (uma `"Tower"` cabe tanto numa masmorra quanto numa floresta, reenquadrada), não fix de código. Descartado como caminho de correção pontual — motivo a mais pra remover o eixo em vez de reforçá-lo campo a campo (ver *Por que a solução atual não basta*).

`tone`/`setting` têm o MESMO gap estrutural do `areaType` (nunca reforçado nos dois), e `generateSecrets` nem RECEBE `registry` — os segredos são gerados cegos aos três eixos (achado corrigido na US-168, *Terceiro achado*).

### Por que a solução atual não basta

Corrigir campo a campo (reforçar só o prompt de `areaType`, por exemplo) custa uma story por eixo, sem garantia de que reforço de prompt resolva de verdade — é instrução textual, o modelo pode não seguir, e a tabela-fonte de `locations` não dá pra filtrar na raiz (achado acima). E dos três eixos, só `tone` tem um consumidor fora da GERAÇÃO de conteúdo: é o único que a US-168 propõe levar até `buildDmSystemPrompt`, pra mudar COMO o Mestre narra (registo/mood) — `setting`/`areaType` moldam só O QUE é gerado (locais/segredos/fecho), nunca chegam à narração (US-168, *Terceiro achado*), e não têm validação nenhuma de que o gerado bate com eles.

### A proposta

`registry` encolhe para `{ tone }`. `setting`/`areaType` saem do catálogo (`SystemConfig`), do schema (`GeneratedAdventureSchema`), do DTO (`CreateAdventureDto`), dos prompts do motor, do seed literal e da UI de escolha (US-157). Menos dois campos que podem divergir, sem custo de reforçar prompt em três eixos.

---

## Escopo

### Dentro do escopo

**Schema/tipos (`packages/shared`):**
- `GeneratedAdventureSchema` ([adventure-generation.ts:47-61](../../../packages/shared/src/types/adventure-generation.ts)) perde `setting`/`areaType` (linhas 50 e 52); mantém `tone` (linha 51).
- `SystemConfigSchema` ([system.ts:211-216](../../../packages/shared/src/types/system.ts)) perde `settings`/`areaTypes` (linhas 214 e 216); mantém `tones` (linha 215).

**Backend — rolagem/registro:**
- `AdventureRegistry`/`AdventureRegistryOverrides` ([roll-registry.ts:4-14](../../../apps/api/src/adventure-generation/roll-registry.ts)) perdem `setting`/`areaType`; `rollRegistry` ([roll-registry.ts:32-38](../../../apps/api/src/adventure-generation/roll-registry.ts)) só sorteia `tone`.
- `registry-catalog.ts` ([registry-catalog.ts:8,12](../../../apps/api/src/adventure-generation/registry-catalog.ts)) perde `SETTINGS`/`AREA_TYPES`; mantém `TONES`. Ver achado em Notas de implementação — esta lista já estava desalinhada do catálogo real (US-156), então some sem deixar divergência órfã.

**Backend — DTO/validação:**
- `CreateAdventureSchema` (zod, [adventure.controller.ts:11-15](../../../apps/api/src/adventure/adventure.controller.ts)) perde `setting`/`areaType`; mantém `tone`. `ApiBody` de exemplo ([adventure.controller.ts:25](../../../apps/api/src/adventure/adventure.controller.ts)) troca `{ setting: 'coastal-area' }` por um exemplo de `tone`.
- `CreateAdventureDto` ([adventure.service.ts:15-20](../../../apps/api/src/adventure/adventure.service.ts)) perde `setting?`/`areaType?`.
- `createForCharacter` para de chamar `validateCatalogKey` para `setting`/`areaType` ([adventure.service.ts:262,264](../../../apps/api/src/adventure/adventure.service.ts)) — mantém a chamada para `tone`.

**Backend — geração/prompt:**
- `generateAdventure` para de escrever `setting`/`areaType` no `GeneratedAdventureSchema.parse(...)` ([adventure.service.ts:175,177](../../../apps/api/src/adventure/adventure.service.ts)).
- `generateLocationsAndNpcs`/`generateClosing` ([ai.service.ts:1302](../../../apps/api/src/ai/ai.service.ts), [:1408](../../../apps/api/src/ai/ai.service.ts)) perdem `Cenário: ${...setting}. Tipo de área: ${...areaType}.`; mantêm `Tom: ${...tone}.`.

**Backend — seed:**
- `dnd5eProductFields` ([seed.ts:85-96](../../../apps/api/prisma/seed.ts) e o bloco equivalente de `areaTypes` logo abaixo) perde `registrySettings`/`registrySettingsPtBr` e os dois arrays de `areaTypes`; mantém `registryTones`/`registryTonesPtBr` ([seed.ts:61-84](../../../apps/api/prisma/seed.ts)).

**Frontend (US-157):**
- `SetupWizard.tsx`: remove estado `setting`/`areaType` ([SetupWizard.tsx:223,225](../../../apps/web/src/components/setup/SetupWizard.tsx)), `settingCatalog`/`areaTypeCatalog` ([:247,249](../../../apps/web/src/components/setup/SetupWizard.tsx)), as duas entradas do payload ([:448,450](../../../apps/web/src/components/setup/SetupWizard.tsx)) e os dois `WorldOptionGroup` de cenário/tipo de área ([:1035-1036](../../../apps/web/src/components/setup/SetupWizard.tsx), [:1039-1040](../../../apps/web/src/components/setup/SetupWizard.tsx)); mantém `tone`.
- `apps/web/src/lib/api.ts:72` — tipo inline de `createAdventure` perde `setting?`/`areaType?`.
- `messages/en-US.ts`/`pt-BR.ts` — remove `setup.world.setting`/`setup.world.areaType`; mantém `setup.world.tone`/`setup.world.random`.

**Testes:** atualizar fixtures que hoje incluem `setting`/`areaType` — grep confirma pelo menos `adventure.service.test.ts`, `ai.service.test.ts`, `roll-registry.test.ts`, `roll-adventure.test.ts`, `adventure-gate.test.ts`, `seed-ledger.test.ts`, `adventure-generation.test.ts` (packages/shared), `system.test.ts` (packages/shared), `SetupWizard.test.tsx`.

### Fora do escopo

- Migrar `Adventure`s já persistidas cujo `generatedAdventure` (coluna ainda não escrita em produção, ver US-168 *Terceiro achado*) teria `setting`/`areaType` — não há dado histórico a migrar hoje; a coluna só passa a ser escrita depois da própria US-168.
- Reescrever a US-156 (✅ implementada) — só uma nota de retirada parcial no topo, convenção já usada em US-02/US-105 (não reescrever história já implementada).
- Filtrar/categorizar a tabela `locationsmonumentsanditems` por `AREA_TYPES` — julgamento editorial subjetivo sobre 20 linhas, não é fix de código (achado acima); é justamente por isso que esta story remove o eixo em vez de tentar consertar essa rota.
- Adicionar novo eixo de registro no lugar dos removidos — não pedido.
- Migrar sistemas já semeados (`System.config` com `settings`/`areaTypes` do JSON antigo) — zod (`SystemConfigSchema`, sem `.strict()`) ignora chaves desconhecidas ao fazer parse; nenhum re-seed obrigatório só por causa desta story (ver Notas).

---

## Modelo de dados proposto

```ts
// packages/shared/src/types/adventure-generation.ts — GeneratedAdventureSchema
export const GeneratedAdventureSchema = z.object({
  id: z.string().min(1),
  levelRange: z.object({ min: z.number().int().min(1), max: z.number().int().min(1) }),
  tone: z.string().min(1),
  // setting/areaType REMOVIDOS
  summary: z.string().min(1),
  // ... resto sem mudança
})
```

```ts
// apps/api/src/adventure/adventure.service.ts — CreateAdventureDto
export interface CreateAdventureDto {
  tone?: string
  // setting/areaType REMOVIDOS
}
```

| Campo | Antes (US-153/US-156) | Depois |
|---|---|---|
| `GeneratedAdventureSchema.setting`/`.areaType` | `z.string().min(1)`, obrigatórios | **removidos** |
| `SystemConfigSchema.settings`/`.areaTypes` | `SystemCatalogEntry[]`, opcionais | **removidos** |
| `CreateAdventureDto.setting`/`.areaType` | opcionais, validados contra catálogo | **removidos** |
| `AdventureRegistry.setting`/`.areaType` | `string`, sorteados por seed próprio | **removidos** |

**Persistência:** sem migração Prisma — `Adventure.generatedAdventure`/`System.config` continuam `Json?`; o schema TypeScript que valida o conteúdo é quem muda.

---

## Critérios de aceite

- [x] `GeneratedAdventureSchema` não tem mais `setting`/`areaType`; `tone` continua obrigatório.
- [x] `SystemConfigSchema` não tem mais `settings`/`areaTypes`; `tones` continua opcional.
- [x] `rollRegistry`/`AdventureRegistry`/`AdventureRegistryOverrides` só produzem/aceitam `tone`.
- [x] `CreateAdventureSchema` (controller) e `CreateAdventureDto` (service) só aceitam `tone?`.
- [x] `generateLocationsAndNpcs`/`generateClosing`: `system` do `generateObject` cita só `Tom: ${tone}.`, sem `Cenário`/`Tipo de área`.
- [x] `dnd5eProductFields`/`buildFreeConfig` (seed) não exportam mais `settings`/`areaTypes`; `tones` continua presente nos dois sistemas.
- [x] `SetupWizard` não renderiza mais seletor de cenário nem de tipo de área; só tom (+ aleatório).
- [x] Config já semeado com `settings`/`areaTypes` antigos no `System.config` (JSON persistido) continua validando contra o `SystemConfigSchema` novo — chaves desconhecidas são ignoradas no parse, sem 500 nem exigir re-seed imediato (zod sem `.strict()`, comportamento padrão confirmado nas Notas de implementação, não exercitado por teste de integração novo).
- [x] `pnpm typecheck` e `pnpm test` passam (fixtures de `setting`/`areaType` atualizados em todos os arquivos listados em Escopo).
- [x] `pnpm eval` passa (mudança em prompt de geração do DM Agent — regra do projeto, AGENTS.md).

---

## Notas de implementação

- **Ordem sugerida:** schema (`packages/shared`) primeiro — todo o resto depende do tipo — depois backend (`controller` → `service` → `ai.service` → `seed.ts`), depois frontend (`SetupWizard`/`messages`/`lib/api.ts`), por último testes.
- **`registry-catalog.ts` já estava desalinhado do catálogo real** (achado desta investigação, 2026-08-19): o comentário do próprio arquivo ([registry-catalog.ts:1-7](../../../apps/api/src/adventure-generation/registry-catalog.ts)) diz que é lista PROVISÓRIA "até a US-156 (catálogo real) existir" — mas `rollRegistry` nunca foi migrado pra ler de `SystemConfig.settings`/`.areaTypes` depois que a US-156 implementou o catálogo real. `SETTINGS` aqui tem 6 chaves (`fantasy`/`urban`/`wilderness`/`underdark`/`coastal`/`planar`), diferentes das 10 do catálogo real (`high-fantasy`/`dark-fantasy`/...). `AREA_TYPES` tem 4 (`dungeon`/`settlement`/`wilderness`/`ruins`), também diferentes das 10 reais. Ou seja: sorteio aleatório (sem override) usava uma lista; escolha explícita do jogador (validada contra `SystemConfig`) usava outra — divergência PRÉ-EXISTENTE, que esta story remove de graça (o código morto some junto com os dois eixos, sem precisar resolver a divergência em si).
- **Zod strip silencioso confirmado.** Nem `SystemConfigSchema` ([system.ts:113-217](../../../packages/shared/src/types/system.ts)) nem `GeneratedAdventureSchema` ([adventure-generation.ts:47-61](../../../packages/shared/src/types/adventure-generation.ts)) usam `.strict()` — o único `.strict()` do arquivo é `buildCharacterAttributesSchema` ([system.ts:274](../../../packages/shared/src/types/system.ts)), schema não relacionado. Comportamento padrão do zod: `z.object(...).parse()` remove chaves desconhecidas do resultado, não lança erro — dado antigo com `setting`/`areaType` sobrevive ao parse novo, só perde os dois campos no objeto resultante.
- Terceiro arquivo de seed a conferir além de `dnd5eProductFields`: `buildFreeConfig` ([seed.ts:95](../../../apps/api/prisma/seed.ts)) espalha `...dnd5eProductFields(locale)` — herda a remoção automaticamente, sem edição própria (mesmo mecanismo que a US-156 documentou para a inclusão original).
- Se `areaType` (ou equivalente) voltar um dia ao registro: reler o achado sobre `locationsmonumentsanditems` acima antes de propor filtrar a tabela por categoria — já investigado e descartado nesta story, não reabrir sem novo motivo.

---

## Questões em aberto

1. `US-156` fica com 1/3 do escopo original (`tones`) — vale editar aquela story ✅ já implementada além da nota de retirada no topo, ou a nota basta (convenção US-02/US-105: não reescrever história já implementada)? Recomendação: a nota basta; reescrever a história de uma story implementada apaga o registro de como/por que ela foi feita na época.

---

## Referências no código

- [packages/shared/src/types/adventure-generation.ts:47-61](../../../packages/shared/src/types/adventure-generation.ts) — `GeneratedAdventureSchema`, perde `setting`(:50)/`areaType`(:52).
- [packages/shared/src/types/system.ts:211-217](../../../packages/shared/src/types/system.ts) — `SystemConfigSchema`, perde `settings`(:214)/`areaTypes`(:216).
- [apps/api/src/adventure-generation/roll-registry.ts](../../../apps/api/src/adventure-generation/roll-registry.ts) — `AdventureRegistry`/`AdventureRegistryOverrides`/`rollRegistry`, os três eixos de sorteio.
- [apps/api/src/adventure-generation/registry-catalog.ts](../../../apps/api/src/adventure-generation/registry-catalog.ts) — `SETTINGS`/`TONES`/`AREA_TYPES`, lista provisória desalinhada do catálogo real (achado, ver Notas).
- [apps/api/src/adventure-generation/roll-content.ts:59](../../../apps/api/src/adventure-generation/roll-content.ts) — `locationRow`, conteúdo bruto de `locations[]`, sorteado em eixo separado de `areaType` (achado).
- [scripts/lazygm/lgmrd-tables.json](../../../scripts/lazygm/lgmrd-tables.json) (tabela `locationsmonumentsanditems`) — 20 linhas sem categoria de área, motivo de não filtrar a rolagem por `areaType`.
- [apps/api/src/adventure/adventure.controller.ts:11-15,25](../../../apps/api/src/adventure/adventure.controller.ts) — `CreateAdventureSchema` (zod) + exemplo do `ApiBody`.
- [apps/api/src/adventure/adventure.service.ts:15-20](../../../apps/api/src/adventure/adventure.service.ts) — `CreateAdventureDto`.
- [apps/api/src/adventure/adventure.service.ts:172-186](../../../apps/api/src/adventure/adventure.service.ts) — `generateAdventure`, monta o `GeneratedAdventureSchema.parse(...)` com `setting`(:175)/`areaType`(:177).
- [apps/api/src/adventure/adventure.service.ts:261-265](../../../apps/api/src/adventure/adventure.service.ts) — `validateCatalogKey` chamado para os três campos do DTO.
- [apps/api/src/ai/ai.service.ts:1302](../../../apps/api/src/ai/ai.service.ts) e [:1408](../../../apps/api/src/ai/ai.service.ts) — prompts de `generateLocationsAndNpcs`/`generateClosing` que citam `registry.setting`/`.areaType`.
- [apps/api/prisma/seed.ts:61-96](../../../apps/api/prisma/seed.ts) — `registryTones`/`registrySettings` (+ bloco de `areaTypes` logo abaixo, não mostrado no trecho lido) em `dnd5eProductFields`.
- [apps/web/src/components/setup/SetupWizard.tsx](../../../apps/web/src/components/setup/SetupWizard.tsx) — estado (223-225), catálogos (247-249), payload (448-450), UI (1035-1040) dos três campos.
- [apps/web/src/lib/api.ts:72](../../../apps/web/src/lib/api.ts) — tipo inline de `createAdventure`.
- [US-156](./US-156-catalogos-registro-dto-validacao.md) — história original dos três catálogos, parcialmente retirada.
