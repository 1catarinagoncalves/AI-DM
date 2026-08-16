# US-156 — Catálogos de registro (setting/tone/areaType), DTO e validação

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** [US-144](./US-144-schema-aventura-shared.md) (schema da aventura, campos `setting`/`tone`/`areaType`)
**Bloqueia:** [US-157](./US-157-tela-de-mundo-depois-da-revisao.md)
**Relacionado:** [Backlog — Motor de geração de aventuras one-shot](./backlog-motor-de-geracao-de-aventuras.md) (GEN-13) · [US-105](./US-105-raca-e-classe-por-chave-do-srd.md) (contrato de chave canônica + rótulo por locale, copiado aqui) · [US-102](./US-102-gate-de-string-literal-no-jsx.md) (gate que reprova texto solto no JSX)
**Criada em:** 2026-08-15

---

## História

> **Como** jogador,
> **quero** escolher `setting`, `tone` e `areaType` da minha aventura — ou deixar cada um no aleatório —,
> **para que** a aventura gerada reflita o tipo de história que eu quero jogar, sem ser obrigado a aceitar tudo sorteado.

---

## Contexto e motivação

### O problema observado

A [US-144](./US-144-schema-aventura-shared.md) já declara `setting`/`tone`/`areaType` como campos de `GeneratedAdventureSchema`, guardando a **chave**, nunca o rótulo. Mas não existe hoje nenhum catálogo de valores possíveis para esses três campos — sem ele, a [US-147/GEN-4](./US-147-rolagem-registro-conteudo.md) não tem de onde sortear quando o jogador não escolhe, e não há como validar uma escolha do jogador contra algo.

### Por que a solução atual não basta

`SystemConfigSchema` ([system.ts](../../../packages/shared/src/types/system.ts)) já tem o padrão exato necessário — `SystemCatalogEntrySchema` (`{key, label}`), usado por `races`/`classes` desde a US-105 — mas não tem entradas de `settings`/`tones`/`areaTypes`. Sem elas, qualquer validação de "o jogador escolheu uma chave válida" teria que inventar uma lista paralela, correndo o risco do mesmo defeito que a US-105 já resolveu uma vez para raça/classe: catálogo divergindo entre frontend e backend.

### A proposta

`settings`, `tones`, `areaTypes` entram no `SystemConfig` como `SystemCatalogEntry[]` — o mesmo contrato de `races`/`classes`. "Aleatório" não é entrada de catálogo — é **ausência de escolha**: campo omitido no DTO, e a rolagem (US-147) sorteia pelo seed. A escolha é por campo (três opcionais independentes) e vive na aventura (`CreateAdventureDto`), não no personagem — sem migração de `Character`.

---

## Escopo

### Dentro do escopo

- **`config.settings`, `config.tones`, `config.areaTypes`** — três novos campos opcionais em `SystemConfigSchema`, cada um `z.array(SystemCatalogEntrySchema).optional()`, mesmo padrão de `races`/`classes`/`backgrounds`.
- **Conteúdo dos catálogos:** dez rótulos genéricos por eixo (o eixo em si é o que se copia do DnDGenerate, não a lista literal — ver backlog). Escritos/curados para este projeto, não copiados verbatim de fonte externa (sem licença a atribuir, são rótulos genéricos: Heroico, Sombrio, Mistério, etc.).
- **`CreateAdventureDto`** (já com `setting?`/`tone?`/`areaType?` desde a [US-153](./US-153-aventura-deixa-de-ser-derivada-da-classe.md)) valida cada campo presente contra o catálogo correspondente — mesmo `validateCatalogKey` que `character.service.ts` já usa para raça/classe/origem, reaplicado aqui do lado da aventura.
- **"Aleatório" nunca é uma chave de catálogo.** Campo omitido no DTO ⇒ [US-147/GEN-4](./US-147-rolagem-registro-conteudo.md) sorteia pelo seed. Nenhuma chave `random` entra nas listas — ausência já significa isso, e uma chave `random` obrigaria todo consumidor (prompt, artefato, resolução de rótulo, gate) a tratá-la como caso especial.
- **Validação no servidor, não só na tela** (fronteira de confiança): chave fora do catálogo do sistema é 400, mesmo molde da validação de classe e raça da US-105.

### Fora do escopo

- **A tela que envia a escolha** — é [GEN-14/US-157](./US-157-tela-de-mundo-depois-da-revisao.md); esta story só entrega catálogo + validação server-side, consumível por DTO mesmo sem UI.
- **O sorteio em si quando o campo está ausente** — já é escopo da [US-147](./US-147-rolagem-registro-conteudo.md); esta story só garante que o catálogo existe para o sorteio escolher de dentro dele.
- **Tradução dos dez rótulos por eixo para os dois locales** — segue o mesmo padrão de `races`/`classes`: `configLocales['pt-BR']` traz o rótulo em português, `config` (base EN) traz em inglês. Não é overlay novo de tradução automática (US-52); os dez rótulos por eixo são curtos o bastante para curadoria manual direta nos dois artefatos.

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

---

## Critérios de aceite

- [ ] `SystemConfigSchema` aceita `settings`, `tones`, `areaTypes` como `SystemCatalogEntry[]` opcionais — config legado sem eles continua válido.
- [ ] Cada catálogo tem dez entradas (`key` canônica EN + `label` no locale do artefato), nos dois locales.
- [ ] `CreateAdventureDto` com `setting`/`tone`/`areaType` presente e fora do catálogo do sistema recebe 400, mesma mensagem-molde de `validateCatalogKey` (valor ofensor + formato esperado).
- [ ] `CreateAdventureDto` com os três campos ausentes não gera erro — a ausência é caminho válido (aleatório).
- [ ] Nenhuma chave `random`/`aleatorio` existe em `settings`/`tones`/`areaTypes` — ausência de escolha é sempre campo omitido, nunca valor especial.
- [ ] A escolha não persiste em `Character` — sem migração de coluna nova naquela tabela.
- [ ] `pnpm typecheck` e `pnpm test` passam.
- [ ] **Eval / teste de regressão:** teste que cria aventura com `tone: "chave-inexistente"` recebe 400; teste com os três campos omitidos não recebe erro e segue para o motor sortear (US-147).

---

## Notas de implementação

- **Copiar `validateCatalogKey`** ([character.service.ts:134-142](../../../apps/api/src/character/character.service.ts)) — mesma função, chamada do lado de `AdventureService` para os três campos novos, em vez de duplicar a lógica.
- **`SystemCatalogEntrySchema` já existe** ([system.ts:27-30](../../../packages/shared/src/types/system.ts)) — reusar diretamente, sem criar `SystemSettingSchema`/`SystemToneSchema`/`SystemAreaTypeSchema` redundantes (mesmo raciocínio que já vale para `classes` não ter schema próprio além do genérico).
- **Os dez rótulos por eixo não são copiados do DnDGenerate** — o backlog é explícito: "as listas em si não precisam ser copiadas: são dez rótulos genéricos e o projeto tem panteão próprio. O que se copia é haver o eixo." Escrever rótulos alinhados ao tom do projeto (fantasia com o panteão próprio citado no backlog), não traduzir a lista de exemplo do dataset de origem.
- **`pnpm docs:links`/gate US-102** não se aplicam a este backend em si — mas a [US-157](./US-157-tela-de-mundo-depois-da-revisao.md), que consome estes catálogos na UI, precisa (ela referencia o gate).

---

## Questões em aberto

1. Os dez rótulos por eixo (Setting, Tone, AreaType) — quem escreve o conteúdo final? O backlog cita exemplos do DnDGenerate (Heroic, Grimdark, Mystery... / High Fantasy, Dark Fantasy... / City, Forest, Ruins...) como referência de **forma**, não de conteúdo a copiar verbatim. Esta story precisa de uma lista concreta antes de implementar — a decidir no dia, alinhada ao panteão próprio do projeto citado no backlog.

---

## Referências no código

- [packages/shared/src/types/system.ts:27-30](../../../packages/shared/src/types/system.ts) — `SystemCatalogEntrySchema`, reusado sem alteração.
- [apps/api/src/character/character.service.ts:134-142](../../../apps/api/src/character/character.service.ts) — `validateCatalogKey`, a função copiada/reaplicada para os três campos novos.
- [US-105](./US-105-raca-e-classe-por-chave-do-srd.md) — contrato original de chave canônica + rótulo por locale.
- [US-153](./US-153-aventura-deixa-de-ser-derivada-da-classe.md) — `CreateAdventureDto` já com os três campos opcionais, sem validação (esta story adiciona a validação).
- [Backlog — Motor de geração de aventuras one-shot §GEN-13 e §O que o DnDGenerate acrescenta](./backlog-motor-de-geracao-de-aventuras.md) — texto de origem.
