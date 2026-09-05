# US-215 — Proficiências de arma e ferramenta fixa de raça (Anão, Alto-elfo, Gnomo das Rochas) na ficha e na revisão

**Épico:** 1 — Personagem
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** [US-134](./US-134-catalogo-de-ferramentas-do-sistema.md) (`config.tools`/`tinkers_tools` — catálogo contra o qual o Tinker do gnomo resolve, sem precisar de entrada nova) · [US-142](./US-142-tracos-mecanicos-subespecie-srd-5-1.md) (`raceFeatures` por chave jogável — as 3 chaves com esses traços vêm de lá)
**Relacionado:** [US-132](./US-132-escolha-ferramenta-beneficio-tool-proficiency-background.md) (mesmo raciocínio de soma cumulativa em `Character.tools`, mais de uma fonte independente) · [US-211](./US-211-ancestralidade-draconica-do-dragonborn.md) (mesmo padrão de tabela fixa do PHB 2014 em `packages/shared`, fora do pipeline `sync`/`ingest`) · [US-214](./US-214-idiomas-fixos-de-raca-e-escolha-do-idioma-extra.md) (mesmo formato de problema: traço racial que só existe como prosa em `raceFeatures`, sem chave estruturada)
**Criada em:** 2026-09-05

---

## História

> **Como** jogadora que cria ou já tem um personagem Anão da Colina, Alto-elfo ou Gnomo das Rochas,
> **quero** ver na ficha (e já na tela de revisão, antes de confirmar) as proficiências de arma e de ferramenta que minha raça concede de graça — machado de batalha/machadinha/martelo leve/martelo de guerra para o Anão, espada longa/curta/arco curto/longo para o Alto-elfo, ferramentas de funileiro para o Gnomo das Rochas,
> **para que** eu saiba com o que meu personagem já sabe lutar ou trabalhar sem precisar abrir a descrição em prosa do traço racial, que hoje fica escondida da ficha.

---

## Contexto e motivação

### O problema observado (três traços, uma causa)

1. **"Dwarven Combat Training" (`dwarven-combat-training`, fonte `dwarf`)** — *"You have proficiency with the battleaxe, handaxe, light hammer, and warhammer."* Herdado por `hill-dwarf`, único anão jogável do catálogo hoje.
2. **"Elf Weapon Training" (`elf-weapon-training`, fonte `high-elf`)** — *"You have proficiency with the longsword, shortsword, shortbow, and longbow."*
3. **"Tinker" (`tinker`, fonte `rock-gnome`)** — concede proficiência fixa com ferramentas de funileiro (`tinkers_tools`, já uma chave existente em `config.tools`, US-134). **Não é "Gnome Cunning"** — esse é outro traço do gnomo (vantagem em salvaguardas de INT/SAB/CAR contra magia, `scripts/srd/srd-5e.config.en-US.json:4056-4061`), sem nenhuma proficiência associada; o próprio comentário de `dwarf-tool-proficiency.ts:5-6` já registra essa distinção ao descartar Tinker como "não é o caso de escolha" do anão.

**Causa única:** os três traços existem em `raceFeatures` (`scripts/srd/srd-5e.config.en-US.json:3862-3867`, `:3912-3917`, `:4074-4079`) só como **prosa em inglês** dentro de `description` — o Open5e não estrutura "proficiência concedida" em campo próprio, mesmo problema já registrado em `dwarf-tool-proficiency.ts` e `race-languages.ts` para os traços de ferramenta-à-escolha e idioma. E `FeaturesPanel.tsx:38` filtra **todo** traço com `origin === 'race'` da aba Features desde 2026-08-20 (commit `a96a2b1`) — então essa prosa, hoje, não aparece em lugar nenhum da ficha nem da revisão. `GameView.tsx` só lê `Character.tools`/`Character.languages` (`apps/web/src/app/play/[adventureId]/page.tsx:49,52`), nunca `raceFeatures`, para montar as seções "Proficiências"/"Idiomas".

### Por que não dá para extrair isso do dataset ingerido

Mesmo raciocínio já registrado em `draconic-ancestry.ts`, `dwarf-tool-proficiency.ts` e `race-languages.ts`: é regra fixa do PHB 2014, não conteúdo que muda com um re-ingest do SRD. A rota já pavimentada no projeto é uma tabela fixa em código.

`dwarf-tool-proficiency.ts:5-7` registra que o time decidiu **não generalizar um parser de `grant` estruturado por um caso só** (o traço "Tool Proficiency" do anão, com escolha real entre 3 ferramentas). Essa US não muda essa decisão: os três traços aqui — combate do anão, armas do elfo, Tinker do gnomo — são **todos fixos, sem escolha** (nenhum tem "à sua escolha" no texto do PHB), então cabem no formato mais simples já usado por `RACE_LANGUAGES` (raça → lista fixa), não no formato de escolha de `DWARF_TOOL_PROFICIENCY_CHOICES`. Não há necessidade de DTO novo, `<select>` novo nem validação de escolha do usuário — só soma incondicional por raça, no `create()`.

### Consequência: falta o catálogo de arma, ao contrário do precedente de idioma/ferramenta

US-214 (idioma) e o traço de ferramenta-à-escolha do anão reaproveitaram catálogo **já existente** (`config.languages`/`config.tools`). Para arma isso não existe: não há `config.weapons`, não há `Character.weapons`, e nenhum grep por `weapon` em `packages/shared/src` retorna nada. Os 44 itens de categoria `weapon` estão crus em `scripts/srd/_data/Item.json` (ex. `srd-2024_battleaxe`), nunca passados por um `build*` equivalente a `buildTools` (`ingest.mjs:887-900`). Esta US precisa criar esse catálogo, mínimo (`key`/`label`, sem `description`, mesmo corte de `SystemToolSchema`/US-134), antes de poder resolver a chave para rótulo no locale ativo. Já o lado do gnomo (Tinker) é mais barato: `tinkers_tools` já existe em `config.tools` (`srd-5e.config.en-US.json:5201-5205`) e nunca foi aplicado a nenhum personagem — só falta somá-lo em `Character.tools` na criação e ajustar a condição de exibição na revisão.

### Fora do escopo mecânico

O motor não modela rolagem de ataque (`docs/sdlc/01-requisitos/backlog-classe-de-armadura-e-ataque.md`: "Bônus de ataque escala com proficiência" listado como fora desse backlog). Proficiência de arma, como proficiência de ferramenta hoje (`GameView.tsx:50-51`: "proficiência de ferramenta não rola por atributo fixo no 5e"), é **puramente informativa** — não alimenta cálculo nenhum existente.

---

## Escopo

### Dentro do escopo

- **`scripts/srd/ingest.mjs`**:
  - Nova função `buildWeapons(overlay, itemsRaw, resolve)`, espelhando `buildTools` (`:887-900`): filtra `itemsRaw.filter(i => i.fields.category === 'weapon')` (44 itens), monta `{ key, label }` (sem `description`, mesmo corte do tools). Chamada em `buildConfig` (perto de `buildTools`), resultado exposto como `config.weapons` nos dois artefatos (`en-US`/`pt-BR`).
  - `buildRaceFeatures` (`:322-330`, mesmo bloco do skip de `languages`/`extra-language` da US-214): pular também os slugs `dwarven-combat-training`, `elf-weapon-training` e `tinker` — a prosa correspondente para de ser gerada em `raceFeatures`, evitando que `Character.features` acumule uma entrada morta (mesmo raciocínio da US-214 sobre `resolveSheetEntries` cair no fallback `{key, name: key}` se a chave sumir do config depois de já persistida).
- **`packages/shared/src/types/system.ts`**: `SystemWeaponSchema` (`key`/`label`, mesmo contrato mínimo de `SystemToolSchema` menos `category` — arma não tem subcategoria de proficiência), `SystemConfigSchema.weapons: z.array(SystemWeaponSchema).optional()` (opcional, mesmo motivo de `tools` — config legado sem o campo não fica inválido), tipo `SystemWeapon` exportado.
- **`packages/shared/src/race-weapon-proficiency.ts`** novo: `RACE_WEAPON_PROFICIENCIES: Record<string, readonly string[]>` — `hill-dwarf` e `high-elf`, cada uma com as 4 chaves de `config.weapons` que o traço concede. Exportado em `packages/shared/src/index.ts`.
- **`packages/shared/src/race-tool-proficiency.ts`** novo: `RACE_TOOL_PROFICIENCIES: Record<string, readonly string[]>` — `rock-gnome: ['tinkers_tools']`. Nome deliberadamente distinto de `DWARF_TOOL_PROFICIENCY_CHOICES` (comentário explicando a diferença: aquela é escolha do jogador validada contra `raceToolChoice`; esta é concessão fixa, sem campo de DTO, mesmo formato de `RACE_LANGUAGES`). Exportado em `packages/shared/src/index.ts`.
- **`apps/api/prisma/schema.prisma`**: nova coluna `weapons Json @default("[]")` no `Character`, comentário citando `RACE_WEAPON_PROFICIENCIES` e US-215, sem coluna própria de proveniência (mesmo corte de `languages` — nenhum consumidor downstream precisa saber que a proficiência veio da raça). Migração Prisma nova.
- **`apps/api/src/character/character.service.ts`**:
  - `raceWeapons = RACE_WEAPON_PROFICIENCIES[race] ?? []`, calculado incondicionalmente (mesmo padrão de `raceLanguages`, `:55`), incluído em `data.weapons` no `create()`.
  - `raceTools = RACE_TOOL_PROFICIENCIES[race] ?? []`, somado ao array `tools` já existente (`:116`) ao lado de `raceToolChoice`.
  - Nenhum campo novo de DTO, nenhuma chamada nova a `validateCatalogKey` — os três traços são fixos, sem escolha do jogador.
- **`apps/web/src/components/game/GameView.tsx`**: nova prop `weapons?: string[]` (mesmo padrão de `tools`/`languages`, `:49-56`), nova seção "Armas" condicional (`weapons.length > 0`), mesmo bloco JSX de "Proficiências" (`:541-550`), posicionada entre "Proficiências" e "Idiomas".
- **`apps/web/src/app/play/[adventureId]/page.tsx`**: `const weapons = ((character.weapons ?? []) as string[]).map((key) => catalogLabel(config?.weapons, key))` (mesmo padrão de `tools`/`languages`, `:49,52`), passado ao `GameView`.
- **`apps/web/src/components/setup/SetupWizard.tsx`**:
  - `reviewWeaponKeys`/`reviewWeapons` novos (mesmo padrão de `reviewToolKeys`/`reviewLanguageKeys`, `:492-505`): `RACE_WEAPON_PROFICIENCIES[charData.race] ?? []`, resolvido pro rótulo via `weaponLabel` (novo, mesma forma de `toolLabel`/`languageLabel`, a partir de `system?.config?.weapons`).
  - Linha de revisão nova "Proficiências de arma" (`setup.review.weapons`), condicional a `reviewWeapons.length > 0`, mesmo formato do bloco de idiomas (`:1370-1379`).
  - `reviewToolKeys` (`:492-495`) ganha `...(RACE_TOOL_PROFICIENCIES[charData.race] ?? [])`.
  - Condição de exibição da linha "Proficiências" (`:1362`, hoje `toolGrant || (charData.race === 'hill-dwarf' && raceToolChoice)`) passa a incluir `|| charData.race === 'rock-gnome'` — Tinker soma na mesma linha existente, mesmo espírito "genérico" do comentário já ali (US-132).
- **i18n**: `game.weapons`/`setup.review.weapons` em `apps/web/src/messages/pt-BR.ts` (perto de `:248-249`/`:289-290`, rótulo "Armas") e `apps/web/src/messages/en-US.ts` (perto de `:223-224`/`:259-260`, rótulo "Weapons").
- **Testes**: `ingest.test.mjs` (`buildWeapons` cobre os 44 itens categoria `weapon`; `buildRaceFeatures` não emite mais `dwarven-combat-training`/`elf-weapon-training`/`tinker`, mesmo formato dos testes de US-142/US-214 já existentes ali), `character.service.test.ts` (criar `hill-dwarf` → `weapons` tem as 4 chaves do combate anão; criar `high-elf` → `weapons` tem as 4 chaves de arma élfica; criar `rock-gnome` → `tools` inclui `tinkers_tools` mesmo sem `toolGrant` de origem; as outras 6 raças → `weapons` vazio, `tools` sem `tinkers_tools`), `SetupWizard.test.tsx` (linha "Proficiências de arma" aparece só para `hill-dwarf`/`high-elf`; linha "Proficiências" mostra Ferramentas de Funileiro para `rock-gnome` mesmo sem ferramenta de origem).

### Fora do escopo

- **Cálculo de bônus de ataque ou qualquer mecânica de rolagem** usando essas proficiências — o motor não modela ataque hoje (ver *Fora do escopo mecânico* acima); o traço fica só informativo, mesmo corte já feito para proficiência de ferramenta.
- **Proficiência de arma de CLASSE** (ex.: guerreiro com proficiência em todas as armas simples e marciais) — só os três traços RACIAIS pedidos por esta story entram. Proficiência de arma de classe é outra fonte independente, sem infraestrutura hoje; abre US própria se/quando o backlog de ataque cobrir isso.
- **Badge de proveniência** ("traço racial" vs. outra fonte) na seção "Armas" — mesmo corte que US-213/US-214 já fizeram para truque e idioma extra do Alto-elfo. `Character.weapons` é lista só, sem campo de origem.
- **Escolha (`<select>`) de arma ou ferramenta** — os três traços desta US são fixos, sem "à sua escolha" no PHB 2014 (ao contrário do traço "Tool Proficiency" do próprio anão, já coberto por `DWARF_TOOL_PROFICIENCY_CHOICES`/`raceToolChoice`, inalterado por esta US). Nenhum campo novo de DTO.
- **Descrição/regra de uso de cada arma na ficha** — mesmo corte de `SystemToolSchema` (US-134 §Fora do escopo): `SystemWeaponSchema` só tem `key`/`label`.
- **Backfill de personagens já existentes** — ao contrário da US-214 (que precisava reescrever um campo já persistido com dado incompleto), aqui o dado nunca existiu: personagens Anão da Colina/Alto-elfo/Gnomo das Rochas criados antes desta US simplesmente não têm `weapons` populado nem `tinkers_tools` em `tools`, e as seções correspondentes não aparecem para eles até recriar o personagem. Sem script de migração de dados.
- **Migração de `Character.features` já persistido** — diferente da US-214 (que precisou de backfill para remover chaves órfãs de `features`), aqui a prosa dos três traços nunca teve consumidor visível (`FeaturesPanel` já filtra `origin === 'race'` desde 2026-08-20); parar de gerá-la no `ingest.mjs` não deixa resíduo em fichas já persistidas.

---

## Modelo de dados proposto

```ts
// packages/shared/src/race-weapon-proficiency.ts
// Proficiência de arma concedida por raça (PHB 2014) — mesmo raciocínio de race-languages.ts:
// raceFeatures['<raça>'] traz a entrada como PROSA em inglês, sem chave de config.weapons.
// Tabela fixa, fora do pipeline sync/ingest, porque é regra do livro. As duas raças abaixo são
// as únicas do catálogo jogável com traço de arma no PHB 2014 — nenhuma tem escolha.
export const RACE_WEAPON_PROFICIENCIES: Record<string, readonly string[]> = {
  'hill-dwarf': ['battleaxe', 'handaxe', 'light_hammer', 'warhammer'],
  'high-elf': ['longsword', 'shortsword', 'shortbow', 'longbow'],
}
```

```ts
// packages/shared/src/race-tool-proficiency.ts
// Ferramenta FIXA concedida por raça (traço "Tinker" do gnomo das rochas, PHB 2014) — distinto
// de DWARF_TOOL_PROFICIENCY_CHOICES: aquela é escolha do jogador (raceToolChoice, validada no
// DTO); esta é concessão sem escolha, mesmo formato de RACE_LANGUAGES. Chave já existe em
// config.tools (US-134) — sem catálogo novo, só soma direta em Character.tools.
export const RACE_TOOL_PROFICIENCIES: Record<string, readonly string[]> = {
  'rock-gnome': ['tinkers_tools'],
}
```

```js
// scripts/srd/ingest.mjs — buildRaceFeatures, mesmo bloco do skip de 'languages'/'extra-language' (US-214)
if (slug === 'languages' || slug === 'extra-language') continue
// US-215: combate do anão / armas do elfo / Tinker do gnomo agora mecanizados
// (RACE_WEAPON_PROFICIENCIES/RACE_TOOL_PROFICIENCIES, @ai-dm/shared) — manter a prosa aqui
// duplicaria o que as seções "Armas"/"Proficiências" da ficha já mostram estruturado.
if (slug === 'dwarven-combat-training' || slug === 'elf-weapon-training' || slug === 'tinker') continue
```

```ts
// apps/api/src/character/character.service.ts — soma incondicional, sem DTO novo
const raceWeapons = RACE_WEAPON_PROFICIENCIES[race] ?? []
const raceTools = RACE_TOOL_PROFICIENCIES[race] ?? []
const tools = [...this.applyToolGrant(toolGrant, dto.origin?.toolChoice), ...(raceToolChoice ? [raceToolChoice] : []), ...raceTools]
// ...
// no data do prisma.character.create:
weapons: raceWeapons,
```

| Raça | Arma fixa (`weapons`) | Ferramenta fixa extra (`tools`) |
|---|---|---|
| `hill-dwarf` | battleaxe, handaxe, light_hammer, warhammer | — |
| `high-elf` | longsword, shortsword, shortbow, longbow | — |
| `rock-gnome` | — | tinkers_tools |
| outras 6 | `[]` | — |

**Persistência:** migração Prisma nova só para `weapons` (coluna inexistente); `tools` não muda de schema, só ganha mais uma fonte na união.

---

## Critérios de aceite

- [ ] `config.weapons` existe nos dois artefatos (`en-US`/`pt-BR`) depois de `pnpm srd:ingest`, com os 44 itens de categoria `weapon` de `Item.json`, cada um com `key`/`label` (sem `description`).
- [ ] `RACE_WEAPON_PROFICIENCIES` cobre `hill-dwarf` (4 chaves) e `high-elf` (4 chaves), cada uma existente em `config.weapons`.
- [ ] `RACE_TOOL_PROFICIENCIES` = `{ 'rock-gnome': ['tinkers_tools'] }`, chave existente em `config.tools`.
- [ ] Criar personagem `hill-dwarf`: `Character.weapons` = `['battleaxe', 'handaxe', 'light_hammer', 'warhammer']`, sem exigir campo novo no DTO.
- [ ] Criar personagem `high-elf`: `Character.weapons` = `['longsword', 'shortsword', 'shortbow', 'longbow']`.
- [ ] Criar personagem `rock-gnome`: `Character.tools` inclui `tinkers_tools`, mesmo sem ferramenta de origem escolhida (`toolGrant` ausente/vazio).
- [ ] Criar personagem de qualquer uma das outras 6 raças jogáveis: `Character.weapons` = `[]`; `Character.tools` não ganha `tinkers_tools`.
- [ ] A ficha (`GameView`) mostra a seção "Armas" só quando `weapons.length > 0`, com rótulo resolvido no locale ativo via `config.weapons`.
- [ ] A ficha mostra "Ferramentas de Funileiro"/"Tinker's Tools" na seção "Proficiências" para personagem `rock-gnome`, resolvido via `config.tools` existente — sem mudança na resolução de `tools` em `page.tsx` além da nova fonte no service.
- [ ] Revisão (`SetupWizard`) mostra a linha "Proficiências de arma" só para `hill-dwarf`/`high-elf`, com as mesmas chaves que a API vai persistir (mesmo princípio da US-127).
- [ ] Revisão mostra ferramenta de funileiro na linha "Proficiências" para `rock-gnome`, mesma condição estendida (`:1362`).
- [ ] `buildRaceFeatures` (`ingest.mjs`) não emite mais entrada com `key: 'dwarven-combat-training'`, `key: 'elf-weapon-training'` nem `key: 'tinker'`, em nenhuma raça jogável, depois de `pnpm srd:ingest`.
- [ ] Criar personagem novo de `hill-dwarf`/`high-elf`/`rock-gnome`: `Character.features` não inclui essas três chaves — a aba Features não guarda prosa morta que nenhuma UI mostra.
- [ ] **Eval / teste de regressão (ingest):** `ingest.test.mjs` cobre `buildWeapons` contra uma fixture sintética de `Item.json` e `buildRaceFeatures` excluindo as 3 chaves novas, mesmo formato dos testes de US-142/US-214 já existentes ali.
- [ ] **Eval / teste de regressão (service):** `character.service.test.ts` cobre `weapons` para as 2 raças com traço de arma, `tools` para `rock-gnome`, e ausência para as outras 6.
- [ ] **Eval / teste de regressão (wizard):** `SetupWizard.test.tsx` cobre a linha "Proficiências de arma" aparecendo/sumindo por raça, e a linha "Proficiências" incluindo Tinker's Tools para `rock-gnome`.

---

## Notas de implementação

> Dicas, não especificação. Quem implementa pode divergir com justificativa.

- **Confirmar as chaves de arma contra o `Item.json` vigente antes de codar** — este documento reporta o que `scripts/srd/_data/Item.json` tinha em 2026-09-05 (`pk` no formato `srd-2024_<slug>`, `stripDocument` já remove o prefixo `srd-2024_`/`srd_`, `buildTools`/`buildWeapons` trocam `-` por `_` na chave final — `light-hammer` vira `light_hammer`).
- **`buildWeapons` pode reaproveitar quase tudo de `buildTools`** (`ingest.mjs:887-900`) — a única diferença é o filtro de categoria (`weapon` em vez de `['tools', 'land-vehicle', 'waterborne-vehicle']`) e a ausência do campo `category` no retorno (arma não tem subcategoria de proficiência como ferramenta tem `artisan`/`musical-instrument`/etc.).
- **Ordem de trabalho do lado do ingest**: mudar `ingest.mjs` → rodar `pnpm srd:ingest` (regenera os 2 artefatos com `config.weapons` novo e sem as 3 chaves de `raceFeatures`) → rodar `pnpm db:seed` (mesma disciplina de ordem que a US-214 já cobrou, senão o config em memória do sistema ainda tem a prosa velha).
- **`RACE_TOOL_PROFICIENCIES` como tabela, mesmo com 1 entrada só hoje** — mesmo formato de `RACE_LANGUAGES`, deixa a porta aberta sem custo se uma raça futura ganhar outra ferramenta fixa; não é um `if (race === 'rock-gnome')` solto no meio do service.
- **Import direto de `@ai-dm/shared`** no front para as duas tabelas e `SystemWeapon`, mesmo padrão de `RACE_LANGUAGES`/`DWARF_TOOL_PROFICIENCY_CHOICES` já importados em `SetupWizard.tsx`.
- **`weaponLabel` no `SetupWizard`** pode seguir exatamente a forma de `languageLabel` (`:500`): `Object.fromEntries((system?.config?.weapons ?? []).map(w => [w.key, w.label]))`.

---

## Questões em aberto

Nenhuma pendente.

---

## Referências no código

- [packages/shared/src/dwarf-tool-proficiency.ts](../../../packages/shared/src/dwarf-tool-proficiency.ts) — precedente direto: registra que Tinker é ferramenta FIXA (não escolha), e a decisão de não generalizar um parser de `grant` por um caso só.
- [packages/shared/src/race-languages.ts](../../../packages/shared/src/race-languages.ts) — precedente direto de tabela "raça → lista fixa", mesmo formato que `RACE_WEAPON_PROFICIENCIES`/`RACE_TOOL_PROFICIENCIES` seguem.
- [packages/shared/src/index.ts:7-11](../../../packages/shared/src/index.ts:7) — onde os dois `export * from` novos entram.
- [packages/shared/src/types/system.ts:95-106](../../../packages/shared/src/types/system.ts:95) — `SystemToolSchema`, contrato mínimo que `SystemWeaponSchema` espelha (menos `category`).
- [apps/api/src/character/character.service.ts:47-51](../../../apps/api/src/character/character.service.ts:47) — `raceToolChoice`, o traço de ESCOLHA do anão que esta US não toca.
- [apps/api/src/character/character.service.ts:55](../../../apps/api/src/character/character.service.ts:55) — `raceLanguages`, molde direto para `raceWeapons`/`raceTools` (soma incondicional por raça).
- [apps/api/src/character/character.service.ts:111-116](../../../apps/api/src/character/character.service.ts:111) — `tools`, onde `raceTools` entra na união.
- [apps/api/src/character/character.schema.ts](../../../apps/api/src/character/character.schema.ts) — DTO de criação; confirmação de que nenhum campo novo é necessário (os 3 traços são fixos).
- [apps/api/prisma/schema.prisma:47-56](../../../apps/api/prisma/schema.prisma:47) — `raceToolChoice`/`languages`, molde de comentário e ausência de coluna de proveniência para `weapons`.
- [apps/web/src/components/character/FeaturesPanel.tsx:12-13,38](../../../apps/web/src/components/character/FeaturesPanel.tsx:12) — filtro `origin !== 'race'` (desde commit `a96a2b1`, 2026-08-20) que hoje esconde os três traços de qualquer aba.
- [apps/web/src/components/game/GameView.tsx:49-56](../../../apps/web/src/components/game/GameView.tsx:49) — props `tools`/`languages`, molde direto para `weapons`.
- [apps/web/src/components/game/GameView.tsx:541-561](../../../apps/web/src/components/game/GameView.tsx:541) — seções "Proficiências"/"Idiomas", onde "Armas" entra no meio.
- [apps/web/src/app/play/[adventureId]/page.tsx:46-52](../../../apps/web/src/app/play/%5BadventureId%5D/page.tsx:46) — resolução chave→rótulo de `tools`/`languages`, molde para `weapons`.
- [apps/web/src/components/setup/SetupWizard.tsx:488-505](../../../apps/web/src/components/setup/SetupWizard.tsx:488) — `reviewToolKeys`/`reviewLanguageKeys`, molde direto para `reviewWeaponKeys`.
- [apps/web/src/components/setup/SetupWizard.tsx:1357-1379](../../../apps/web/src/components/setup/SetupWizard.tsx:1357) — linhas de revisão "Proficiências"/"Idiomas", onde "Proficiências de arma" entra e onde a condição do gnomo se soma.
- [apps/web/src/messages/pt-BR.ts:248-249,289-290](../../../apps/web/src/messages/pt-BR.ts:248) / [en-US.ts:223-224,259-260](../../../apps/web/src/messages/en-US.ts:223) — chaves i18n existentes de tools/languages, molde para `game.weapons`/`setup.review.weapons`.
- [scripts/srd/srd-5e.config.en-US.json:3862-3867,3912-3917,4074-4079](../../../scripts/srd/srd-5e.config.en-US.json) — `raceFeatures`, as três entradas de prosa que esta US mecaniza.
- [scripts/srd/srd-5e.config.en-US.json:5201-5205](../../../scripts/srd/srd-5e.config.en-US.json) — `tinkers_tools`, já existente em `config.tools` (US-134), reaproveitado sem catálogo novo.
- [scripts/srd/ingest.mjs:311-346](../../../scripts/srd/ingest.mjs:311) — `buildRaceFeatures`, incluindo os skips já existentes de `alignment`/`languages`/`extra-language`, precedente direto para os 3 novos.
- [scripts/srd/ingest.mjs:887-900](../../../scripts/srd/ingest.mjs:887) — `buildTools`, molde direto para `buildWeapons`.
- [scripts/srd/_data/Item.json](../../../scripts/srd/_data/Item.json) — fonte crua dos 44 itens `category: "weapon"` que `buildWeapons` vai transformar em catálogo.
- [scripts/srd/ingest.test.mjs:85-141](../../../scripts/srd/ingest.test.mjs:85) — testes existentes de `buildRaceFeatures` (US-142/US-214), molde para o teste novo desta story.
- [docs/sdlc/01-requisitos/backlog-classe-de-armadura-e-ataque.md](./backlog-classe-de-armadura-e-ataque.md) — confirma que bônus de ataque por proficiência está fora do motor hoje, base do corte em *Fora do escopo*.
