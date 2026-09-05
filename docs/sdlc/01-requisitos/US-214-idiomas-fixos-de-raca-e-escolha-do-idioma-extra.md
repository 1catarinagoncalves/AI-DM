# US-214 — Idiomas fixos de raça na ficha, e escolha do idioma extra (Alto-elfo, Humano, Meio-elfo)

**Épico:** 1 — Personagem
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada (04/09/2026)
**Depende de:** [US-133](./US-133-catalogo-de-idiomas-do-sistema.md) (`config.languages` — catálogo contra o qual toda escolha de idioma valida, e contra o qual as duas tabelas fixas desta story referenciam suas chaves) · [US-142](./US-142-tracos-mecanicos-subespecie-srd-5-1.md) (`raceFeatures`, chave por subespécie jogável — é a lista de 9 chaves que as tabelas precisam cobrir)
**Relacionado:** [US-211](./US-211-ancestralidade-draconica-do-dragonborn.md) (`DRACONIC_ANCESTRY_TABLE` — mesmo padrão de tabela fixa do PHB 2014 em `packages/shared`, fora do pipeline `sync`/`ingest`) · [US-212](./US-212-bonus-de-atributo-de-raca-na-etapa-de-atributos.md) (mesmo padrão de campo condicional por raça no `character.service.ts`) · [US-213](./US-213-etapa-magias-e-escolha-de-truque-do-alto-elfo.md) (mesmo formato de problema: traço racial que só existe como prosa em `raceFeatures`, sem mecânica nem dado estruturado)
**Criada em:** 2026-09-04

---

## História

> **Como** jogadora que cria um personagem,
> **quero** ver na ficha os idiomas que minha raça já concede de graça (ex.: Anão da Colina sabe Comum e Anão) — e, se joguei Alto-elfo, Humano ou Meio-elfo, escolher ali mesmo o idioma extra que minha raça me dá, sem conseguir escolher de novo um que ela já concede,
> **para que** a seção "Idiomas" da ficha mostre a verdade completa sobre o que meu personagem fala, sem repetir a mesma informação como card de traço na aba Features, e a escolha do idioma extra sempre ofereça algo que ele ainda não sabe.

---

## Contexto e motivação

### O problema observado (três sintomas, uma causa)

1. **A ficha não mostra idioma fixo de raça.** A seção "Idiomas" da ficha (`GameView.tsx:552-561`) lê só `Character.languages` — hoje populado **apenas** pela escolha de idioma extra do Alto-elfo (`raceLanguageChoice`, `character.service.ts:113`). Um Anão, Elfo, Meio-orc, Gnomo das Rochas, Halfling ou Tiefling não tem escolha nenhuma de idioma — então `Character.languages` fica `[]` para eles, a seção some da ficha, e o idioma que a raça concede (`raceFeatures[raça]`, chave `languages`) fica **escondido em prosa** dentro de um card de traço na aba Features.
2. **A escolha do Alto-elfo não exclui os idiomas que ele já sabe.** O filtro do pool (backend `character.service.ts:56-58`, front `SetupWizard.tsx:403`) é só `!l.secret` — oferece os 16 idiomas não-secretos inteiros, **incluindo `Common` e `Elvish`**, que o Alto-elfo já sabe de graça pelo traço `languages` herdado da raiz `elf`.
3. **Humano e Meio-elfo têm o mesmíssimo traço, sem select nenhum.** `raceFeatures['human']` e `raceFeatures['half-elf']` trazem a mesma frase do Alto-elfo antes do commit `d5a4118` — *"you can speak, read, and write [...] one extra language of your choice"* — mas nenhum dos dois ganhou campo, DTO nem `<select>`. É a mesma lacuna que o Alto-elfo tinha, nunca fechada para os outros dois.

**Causa única dos três sintomas:** não existe, em lugar nenhum do código, uma estrutura que amarre "raça X → concede as chaves de idioma Y, Z de `config.languages`" nem "raça X tem direito a escolher mais um". O traço `languages` de cada raça (verificado nas 9 chaves jogáveis de `scripts/srd/srd-5e.config.en-US.json`) é **só prosa em inglês**, nunca uma chave.

### Por que não dá para extrair isso do dataset ingerido

Mesmo raciocínio já registrado em `draconic-ancestry.ts` e `dwarf-tool-proficiency.ts`: o Open5e não estrutura esse traço — é prosa livre dentro de um `desc`, sem campo próprio. A rota já pavimentada no projeto é uma **tabela fixa em código**, porque é regra do PHB 2014, não conteúdo que muda com um re-ingest do SRD.

### Consequência: resolver os 3 sintomas cria repetição na aba Features

Depois de `RACE_LANGUAGES`/`RACE_EXTRA_LANGUAGE_CHOICE` mecanizarem o traço, a entrada de prosa que `buildRaceFeatures` já gera pra ela (`raceFeatures[raça]`, chave `languages`, e `extra-language` só pro Alto-elfo) passa a **duplicar** a mesma informação: a mesma frase ("Você fala Comum e Anão...") continua aparecendo como card na aba Features **e**, agora, também como item estruturado na seção "Idiomas". Isso já tem precedente resolvido no próprio `ingest.mjs`: o traço `alignment` (Tendência) foi descartado na fonte por ser "fluff sem mecânica" (`ingest.mjs:320-326`, pedido de 2026-09-03). Aqui o motivo é o oposto — não é fluff, é mecânica — mas o efeito colateral é o mesmo: uma vez mecanizado em outro lugar, o card de prosa não soma informação, só repete.

### A proposta

Duas tabelas fixas em `packages/shared` (mesmo lugar de `DRACONIC_ANCESTRY_TABLE`/`DWARF_TOOL_PROFICIENCY_CHOICES`):

- `RACE_LANGUAGES`: raça → idioma(s) fixo(s). Some a `Character.languages` na criação, **para toda raça**, resolvendo o sintoma 1.
- `RACE_EXTRA_LANGUAGE_CHOICE`: as raças que têm direito a escolher mais um idioma (`high-elf`, `human`, `half-elf`). O campo `raceLanguageChoice`/`<select>` que hoje só liga para `race === 'high-elf'` passa a ligar para qualquer uma das três, e o pool de escolha passa a excluir `RACE_LANGUAGES[raça]` — resolvendo os sintomas 2 e 3 com a mesma generalização.

Mais uma linha em `buildRaceFeatures` (`ingest.mjs`), no mesmo bloco do skip de `alignment`, pulando os slugs `languages` e `extra-language` — a prosa correspondente para de ser gerada, e a aba Features para de repetir o que a seção "Idiomas" já mostra estruturado.

---

## Escopo

### Dentro do escopo

- **`packages/shared/src/race-languages.ts`** novo:
  - `RACE_LANGUAGES: Record<string, readonly string[]>` — as 9 chaves jogáveis de `raceFeatures` (`dragonborn`, `half-elf`, `half-orc`, `high-elf`, `hill-dwarf`, `human`, `lightfoot`, `rock-gnome`, `tiefling`) apontando para as chaves de `config.languages` que cada uma concede fixo.
  - `RACE_EXTRA_LANGUAGE_CHOICE: readonly string[]` — `['high-elf', 'human', 'half-elf']`, as únicas 3 chaves cujo traço de idioma inclui "um extra à escolha" no dataset ingerido.
  - Ambas exportadas em `packages/shared/src/index.ts`, mesmo padrão de `draconic-ancestry`/`dwarf-tool-proficiency`.
- **`character.service.ts`**: `raceLanguages = RACE_LANGUAGES[race] ?? []`, somado a `Character.languages` para **toda** raça. A condição de `raceLanguageChoice` generaliza de `race === 'high-elf'` para `RACE_EXTRA_LANGUAGE_CHOICE.includes(race)`; o pool de validação continua excluindo `secret` **e**, agora por qualquer uma das 3 raças, `raceLanguages` (não só as de `high-elf`).
- **Escolha obrigatória nas 3 raças**: Alto-elfo, Humano e Meio-elfo sem `raceLanguageChoice` (ou com um valor já concedido fixo, ou fora do catálogo) são rejeitados — mesmo `validateCatalogKey`, sem código novo de validação.
- **`SetupWizard.tsx`**, generalizar os 4 pontos hoje hardcoded em `charData.race === 'high-elf'`:
  - `:956` — exibição do `<select>` (mostrar para as 3 raças de `RACE_EXTRA_LANGUAGE_CHOICE`, não só Alto-elfo).
  - `:498` (`reviewLanguages`) — mostrar o idioma escolhido na etapa de revisão para as 3.
  - `:586` (`canAdvance`) — bloquear avanço enquanto a escolha, quando exigível, estiver vazia — para as 3, sem bloquear as outras 6.
  - `:658` (payload de `createCharacter`) — enviar `raceLanguageChoice` para as 3, não só Alto-elfo.
  - Pool do `<select>` (`:403`, hoje `elfLanguageCards`): renomear para algo genérico (ex. `extraLanguageCards`) e trocar o filtro fixo por `!l.secret && !(RACE_LANGUAGES[charData.race] ?? []).includes(l.key)` — cada raça exclui só o que ELA já sabe (Humano exclui só `common`; Meio-elfo e Alto-elfo excluem `common`+`elvish`).
- **Renomear o que ficou datado**: variável `elfLanguageCards`, id do campo `char-elf-language`, chave i18n `setup.race.elfLanguage.legend` (pt-BR/en-US) — o texto das duas traduções já é genérico ("Escolha o idioma adicional"/"Choose your extra language"), só a CHAVE carrega "elf" indevidamente agora que Humano e Meio-elfo usam o mesmo campo.
- **`ingest.mjs` (`buildRaceFeatures`)**: pular os slugs `languages` e `extra-language` na montagem de `raceFeatures` — mesmo bloco e mesmo padrão do skip já existente de `alignment` (`ingest.mjs:326`). Evita repetir, na aba Features, a mesma informação que a seção "Idiomas" passa a mostrar estruturada (ver *Consequência: resolver os 3 sintomas cria repetição na aba Features*). Exige rodar `pnpm srd:ingest` de novo para os dois artefatos (`en-US`/`pt-BR`) pararem de emitir essas entradas.
- **Backfill dos personagens já existentes**: script único (`scripts/`, Node + PrismaClient, não migração de schema) que, por `Character`: (1) soma `RACE_LANGUAGES[character.race]` ao `languages` já persistido, sem duplicar, e (2) remove as chaves `'languages'`/`'extra-language'` de `Character.features` já persistido. O passo 2 não é cosmético: sem ele, uma ficha antiga aponta pra uma chave que `raceFeatures` não tem mais (depois do `ingest.mjs` mudar), e `resolveSheetEntries` (`system.ts:314-330`) cai no fallback `{key, name: key}` — um card vazio tipo "languages" sem nome nem descrição, pior do que a repetição que esta story está resolvendo. Cobre só o idioma FIXO — ver *Fora do escopo* sobre o extra à escolha de fichas antigas.
- **Atualizar os comentários que ficam errados**: `character.service.ts:52-59,111-113` e `schema.prisma:51-55` (afirmam "Alto-elfo, única fonte de `languages` hoje").
- **Testes**: `character.service.test.ts` (idioma fixo para as 9 raças em pelo menos 3 famílias distintas; escolha válida e rejeição — duplicada, ausente, fora do catálogo — para as 3 raças com traço de escolha), `SetupWizard.test.tsx` (select aparece/some por raça; pool exclui o certo por raça; `canAdvance` por raça) e `ingest.test.mjs` (`buildRaceFeatures` não emite `languages` nem `extra-language`, mesmo formato dos testes já existentes de US-142).

### Fora do escopo

- **Preencher retroativamente o idioma EXTRA de fichas já existentes** (Humano/Meio-elfo criados antes desta story, ou o próprio Alto-elfo se algum dia tivesse ficha sem escolha) — impossível inferir o que a jogadora teria escolhido. O backfill (acima) soma só o idioma FIXO, determinístico pela raça; o campo de escolha fica vazio nessas fichas antigas, mesmo corte de qualquer campo de criação que não é editável depois.
- **Nenhuma mudança para as outras 6 raças jogáveis** (`dragonborn`, `half-orc`, `hill-dwarf`, `lightfoot`, `rock-gnome`, `tiefling`) além de ganharem o idioma fixo — nenhuma delas tem traço de "idioma à escolha" no PHB 2014.
- **Exibir a PROVENIÊNCIA do idioma na ficha** (badge "traço racial" vs. "escolha") — mesmo corte que a US-213 já fez para o truque do Alto-elfo. `Character.languages` continua uma lista só, sem campo de origem.
- **Editar a escolha depois de criado o personagem** — mesmo corte de qualquer campo de criação.
- **Migração de schema Prisma** — `languages` já é `Json`; o backfill é dado, não estrutura.

---

## Modelo de dados proposto

```ts
// packages/shared/src/race-languages.ts
// Idiomas fixos concedidos por raça (PHB 2014) — mesmo raciocínio de draconic-ancestry.ts:
// raceFeatures['<raça>'] traz a entrada `languages` só como PROSA em inglês, sem chave de
// config.languages. Tabelas fixas, fora do pipeline sync/ingest, porque são regra do livro.
export const RACE_LANGUAGES: Record<string, readonly string[]> = {
  dragonborn: ['common', 'draconic'],
  'half-elf': ['common', 'elvish'],
  'half-orc': ['common', 'orc'],
  'high-elf': ['common', 'elvish'],
  'hill-dwarf': ['common', 'dwarvish'],
  human: ['common'],
  lightfoot: ['common', 'halfling'],
  'rock-gnome': ['common', 'gnomish'],
  tiefling: ['common', 'infernal'],
}

// Raças cujo traço de idioma inclui "um extra à sua escolha" (PHB 2014) — as 3 concedem
// exatamente 1. Generaliza o raceLanguageChoice/<select> que hoje só liga pra 'high-elf'.
export const RACE_EXTRA_LANGUAGE_CHOICE: readonly string[] = ['high-elf', 'human', 'half-elf']
```

```js
// scripts/srd/ingest.mjs — buildRaceFeatures, mesmo bloco do skip de 'alignment' (:326)
if (slug === 'alignment') continue
// US-214: idioma fixo/extra agora mecanizado (RACE_LANGUAGES/RACE_EXTRA_LANGUAGE_CHOICE,
// @ai-dm/shared) — manter a prosa aqui duplicaria a mesma informação que a seção "Idiomas"
// da ficha já mostra estruturada.
if (slug === 'languages' || slug === 'extra-language') continue
```

```ts
// apps/api/src/character/character.service.ts — substitui o cálculo atual
const raceLanguages = RACE_LANGUAGES[race] ?? []
const raceLanguageChoice = RACE_EXTRA_LANGUAGE_CHOICE.includes(race)
  ? this.validateCatalogKey(
      (config.languages ?? []).filter((l) => !l.secret && !raceLanguages.includes(l.key)),
      dto.raceLanguageChoice ?? '', 'Idioma racial',
    )
  : undefined
// ...
const languages = [...raceLanguages, ...(raceLanguageChoice ? [raceLanguageChoice] : [])]
```

| Raça | Idioma fixo | Tem escolha extra? | Pool do `<select>` (de 16 não-secretos) |
|---|---|---|---|
| `high-elf` | common, elvish | sim | 14 (exclui common, elvish) |
| `human` | common | sim | 15 (exclui só common) |
| `half-elf` | common, elvish | sim | 14 (exclui common, elvish) |
| outras 6 | conforme `RACE_LANGUAGES` | não | sem `<select>` |

**Persistência:** sem migração de schema; backfill é `UPDATE` de dados nas linhas existentes.

---

## Critérios de aceite

- [x] `RACE_LANGUAGES` cobre as 9 chaves jogáveis, cada uma com só chaves existentes em `config.languages`.
- [x] `RACE_EXTRA_LANGUAGE_CHOICE` = exatamente `['high-elf', 'human', 'half-elf']`.
- [x] Criar personagem de uma das outras 6 raças: idioma fixo entra em `Character.languages` sozinho, sem exigir nem aceitar `raceLanguageChoice`.
- [x] Criar Alto-elfo, Humano ou Meio-elfo **sem** `raceLanguageChoice`: `BadRequestException` para os 3.
- [x] Criar Alto-elfo com escolha válida (ex. `draconic`): `languages` = `['common', 'elvish', 'draconic']`.
- [x] Criar Humano com escolha válida (ex. `orc`): `languages` = `['common', 'orc']`.
- [x] Criar Meio-elfo com escolha válida (ex. `draconic`): `languages` = `['common', 'elvish', 'draconic']`.
- [x] Humano tentando escolher `common`: rejeitado. Meio-elfo ou Alto-elfo tentando escolher `common` ou `elvish`: rejeitado — mesmo formato de erro de `validateCatalogKey`.
- [x] Wizard: `<select>` de idioma extra aparece para as 3 raças (rótulo genérico, não mais "elf" na chave i18n), com pool excluindo exatamente `RACE_LANGUAGES[raça]` além dos secretos.
- [x] `canAdvance` bloqueia avanço nas 3 raças sem escolha feita; nunca bloqueia nas outras 6.
- [x] A ficha (seção "Idiomas") aparece para qualquer uma das 9 raças jogáveis, com rótulo resolvido no locale ativo — `GameView`/`page.tsx` já liam `Character.languages` incondicionalmente (US-133), sem mudança de código; passa a ter conteúdo pra toda raça porque o service agora popula.
- [x] `buildRaceFeatures` (`ingest.mjs`) não emite mais entrada com `key: 'languages'` nem `key: 'extra-language'`, em nenhuma das 9 raças jogáveis. Depois de `pnpm srd:ingest`, os dois artefatos (`srd-5e.config.en-US.json`/`pt-BR.json`) não têm essas chaves em `raceFeatures`. Rodado em 04/09/2026 — 0 ocorrências nos dois artefatos (verificado por script). O `srd:sync` reportou 10 chaves órfãs do overlay pt-BR (`dwarf_languages`, `high-elf_extra-language` etc.) — esperado, é o overlay que sobrou do skip novo, sem ação necessária.
- [x] Criar personagem novo de qualquer raça: `Character.features` não inclui `'languages'` nem `'extra-language'` — a aba Features não repete o que a seção "Idiomas" já mostra. `pnpm db:seed` rodado em 04/09/2026 contra o banco de dev (branch `dev`), config atualizado.
- [x] Script de backfill roda contra o banco de dev sem duplicar idioma já persistido em `languages`, remove `'languages'`/`'extra-language'` de `features` sem tocar as demais chaves do array, e é seguro rodar mais de uma vez (idempotente). Rodado em 04/09/2026 (`--write`): 2 de 3 fichas migradas (Ariel Moon/tiefling, Aelenor/high-elf); reexecução em modo contagem confirmou idempotência (0 fichas migrariam).
- [x] **Eval / teste de regressão (service):** `character.service.test.ts` cobre idioma fixo para pelo menos 3 raças sem escolha, e para as 3 com escolha — sucesso, idioma duplicado rejeitado, escolha ausente rejeitada, chave fora do catálogo rejeitada.
- [x] **Eval / teste de regressão (wizard):** `SetupWizard.test.tsx` cobre o `<select>` aparecendo/sumindo por raça, o pool certo por raça, e `canAdvance` por raça.
- [x] **Eval / teste de regressão (ingest):** `ingest.test.mjs` cobre `buildRaceFeatures` excluindo `languages`/`extra-language` de uma fixture sintética, mesmo formato dos testes de US-142 já existentes ali.

---

## Notas de implementação

> Dicas, não especificação. Quem implementa pode divergir com justificativa.

- **Confirmar as 9+3 chaves contra o config vigente antes de codar** — este documento reporta o que `scripts/srd/srd-5e.config.en-US.json` tinha em 2026-09-04.
- **4 pontos do `SetupWizard.tsx` a generalizar**, todos hoje `charData.race === 'high-elf'` — trocar por `RACE_EXTRA_LANGUAGE_CHOICE.includes(charData.race)`: exibição do `<select>` (`:956`), `reviewLanguages` (`:498`), `canAdvance` (`:586`), payload de `createCharacter` (`:658`). O reset de `raceLanguageChoice` ao trocar de raça (`:523`, `:561`) já é incondicional — não precisa mudar.
- **Import direto de `@ai-dm/shared`** no front para as duas tabelas, mesmo padrão de `DWARF_TOOL_PROFICIENCY_CHOICES` já importado ali — sem duplicar a lista de raças no componente.
- **Backfill como script, não como parte do `create()`** — `for` sobre `prisma.character.findMany()` + `update` condicionado a `RACE_LANGUAGES[c.race]` existir. Dedupe com `Set` na união para ser seguro rodar mais de uma vez.
- **`languages` no service passa a ser incondicional** — `raceLanguages` sai de dentro do `if` do `raceLanguageChoice` para ser calculado sempre, antes dele.
- **Ordem de trabalho do lado do ingest**: mudar `ingest.mjs` → rodar `pnpm srd:ingest` (regenera os 2 artefatos) → rodar `pnpm db:seed` (mesma disciplina de ordem que `migrate-feature-spell-keys.ts:105-120` já cobra: sem re-seed, o config em memória do sistema ainda tem a chave velha) → só então rodar o backfill de `Character.features`/`Character.languages`. Rodar o backfill antes do re-seed limparia as chaves da ficha mas deixaria o config do sistema ainda com a prosa duplicada.
- **O backfill de `features` filtra por posição, não por índice fixo**: `c.features.filter(k => k !== 'languages' && k !== 'extra-language')` — o array mistura chaves de classe/origem/raça (US-135/US-142) sem posição previsível.

---

## Questões em aberto

Nenhuma pendente.

---

## Referências no código

- [packages/shared/src/draconic-ancestry.ts](../../../packages/shared/src/draconic-ancestry.ts) — precedente direto: tabela fixa do PHB 2014 em `packages/shared`.
- [packages/shared/src/dwarf-tool-proficiency.ts](../../../packages/shared/src/dwarf-tool-proficiency.ts) — segundo precedente, tabela mais simples.
- [packages/shared/src/index.ts:7-8](../../../packages/shared/src/index.ts:7) — onde `export * from './race-languages'` entra.
- [apps/api/src/character/character.service.ts:52-59](../../../apps/api/src/character/character.service.ts:52) — `raceLanguageChoice`, condição hoje presa a `'high-elf'`.
- [apps/api/src/character/character.service.ts:111-113](../../../apps/api/src/character/character.service.ts:111) — `languages`, única fonte hoje.
- [apps/api/src/character/character.service.ts:191-199](../../../apps/api/src/character/character.service.ts:191) — `validateCatalogKey`, reaproveitado sem alteração.
- [apps/web/src/components/setup/SetupWizard.tsx:259](../../../apps/web/src/components/setup/SetupWizard.tsx:259) — estado `raceLanguageChoice`.
- [apps/web/src/components/setup/SetupWizard.tsx:399-403](../../../apps/web/src/components/setup/SetupWizard.tsx:399) — `languageCatalog`/`elfLanguageCards`, filtro a generalizar e renomear.
- [apps/web/src/components/setup/SetupWizard.tsx:498](../../../apps/web/src/components/setup/SetupWizard.tsx:498) — `reviewLanguages`, condição a generalizar.
- [apps/web/src/components/setup/SetupWizard.tsx:523,561](../../../apps/web/src/components/setup/SetupWizard.tsx:523) — reset de `raceLanguageChoice`, já incondicional.
- [apps/web/src/components/setup/SetupWizard.tsx:586](../../../apps/web/src/components/setup/SetupWizard.tsx:586) — `canAdvance`, condição a generalizar.
- [apps/web/src/components/setup/SetupWizard.tsx:658](../../../apps/web/src/components/setup/SetupWizard.tsx:658) — payload de `createCharacter`, condição a generalizar.
- [apps/web/src/components/setup/SetupWizard.tsx:956-967](../../../apps/web/src/components/setup/SetupWizard.tsx:956) — `<select>`, condição de exibição a generalizar.
- [apps/web/src/messages/pt-BR.ts:132](../../../apps/web/src/messages/pt-BR.ts:132) / [en-US.ts:112](../../../apps/web/src/messages/en-US.ts:112) — chave `setup.race.elfLanguage.legend` a renomear.
- [apps/web/src/app/play/[adventureId]/page.tsx:51-52](../../../apps/web/src/app/play/%5BadventureId%5D/page.tsx:51) — `catalogLabel(config?.languages, key)`, resolução de chave para rótulo, reaproveitada sem mudança.
- [apps/web/src/components/game/GameView.tsx:54-56,552-561](../../../apps/web/src/components/game/GameView.tsx:54) — prop `languages` e a seção "Idiomas" da ficha.
- [apps/api/prisma/schema.prisma:51-55](../../../apps/api/prisma/schema.prisma:51) — coluna `languages`, comentário a atualizar.
- [scripts/srd/srd-5e.config.en-US.json](../../../scripts/srd/srd-5e.config.en-US.json) — `raceFeatures`, entradas `languages` das 9 raças jogáveis (fonte da tradução manual), e `languages` (catálogo, US-133).
- [scripts/srd/ingest.mjs:311-342](../../../scripts/srd/ingest.mjs:311) — `buildRaceFeatures`, incluindo o skip de `alignment` (`:326`) que serve de precedente direto pro skip de `languages`/`extra-language`.
- [scripts/srd/ingest.test.mjs:85-141](../../../scripts/srd/ingest.test.mjs:85) — testes existentes de `buildRaceFeatures` (US-142), molde para o teste novo desta story.
- [apps/api/prisma/migrate-feature-spell-keys.ts](../../../apps/api/prisma/migrate-feature-spell-keys.ts) — precedente de script de migração de dados sobre `Character.features` (contagem por padrão, `--write` para aplicar), molde de modo de operação para o backfill desta story.
- [packages/shared/src/types/system.ts:314-330](../../../packages/shared/src/types/system.ts:314) — `resolveSheetEntries`, o fallback `{key, name: key}` que o backfill de `features` existe para evitar.
- [US-142 §Modelo de dados](./US-142-tracos-mecanicos-subespecie-srd-5-1.md) — por que só as 9 chaves-folha importam.
