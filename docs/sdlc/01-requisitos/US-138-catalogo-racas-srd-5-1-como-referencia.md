# US-138 — Catálogo de raças re-derivado com o SRD 5.1 (2014) como fonte de referência

**Épico:** 1 — Personagem
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** [US-105](./US-105-raca-e-classe-por-chave-do-srd.md) (**obrigatória e anterior**: constrói `buildRaces` e o mecanismo de fusão 2014+2024 que esta story só reconfigura — não reescreve) · [ADR 009 §8](../../adr/009-uniao-dos-srd-5-1-e-5-2.md) (a decisão que esta story implementa: o SRD 5.1 vira fonte de referência, o 5.2 sai de escopo)
**Relacionado:** [ADR 004](../../adr/004-origem-do-dado-de-sistema.md) (pipeline pinado, licença única) · [US-139](./US-139-catalogo-classes-marshal-a5e-adventurers-guide.md) (mesma revisão de precedência aplicada a `classes`, na mesma leva) · [US-140](./US-140-catalogo-subracas-srd-5-1.md) (estende este `buildRaces` com subespécie, story separada)
**Criada em:** 2026-08-15

---

## História

> **Como** desenvolvedora,
> **quero** que `config.races` derive do SRD 5.1 (2014) como fonte de referência, em vez do 5.2 (2024) que o ADR 009 usava até aqui,
> **para que** o catálogo de raças siga a decisão registrada no [ADR 009 §8](../../adr/009-uniao-dos-srd-5-1-e-5-2.md) — a edição de 2014 é a que concentra o conteúdo de terceiros compatível no Open5e, e a US-105 ainda deriva com o 5.2 vencendo.

---

## Contexto e motivação

### O que o ADR 009 §8 decidiu e o que ainda não foi feito

O [ADR 009 §8](../../adr/009-uniao-dos-srd-5-1-e-5-2.md) (15/08/2026) inverteu a precedência que o próprio ADR 009 havia fixado em 02/08/2026: o SRD 5.1 passa a ser a fonte de referência, e o 5.2 sai de escopo "por hora — não é mais consultado nem para preencher lacuna". É uma decisão registrada, não implementada: `buildRaces` ([`ingest.mjs:238-244`](../../../scripts/srd/ingest.mjs:238)) continua carregando o `srd-2024` inteiro e só completando com o `srd-2014` (D2 original da US-105/ADR 009), o oposto do que a revisão pede.

### Verificado nas fontes novas do ADR 009 §8: nenhuma tem raça

O ADR 009 §8 também colocou em escopo três documentos novos (`a5e-ddg`, `a5e-gpg`, *Spells That Don't Suck*). Antes de escrever critério de aceite sobre eles, medi o conteúdo de cada um contra o repositório pinado (`open5e/open5e-api`, tag `v2.1.0`, consultado em 15/08/2026):

| Documento | Arquivos no diretório |
|---|---|
| `en-publishing/a5e-ddg` | `Background.json`, `BackgroundBenefit.json`, `Document.json` |
| `en-publishing/a5e-gpg` | `Background.json`, `BackgroundBenefit.json`, `Document.json` |
| `somanyrobots/spells-that-dont-suck` | `Document.json`, `Spell.json`, `SpellCastingOption.json` |
| `en-publishing/a5e-ag` | *(sem `Species.json`)* — tem `CharacterClass.json` (ver [US-139](./US-139-catalogo-classes-marshal-a5e-adventurers-guide.md)) |

**Nenhum dos quatro documentos novos em escopo tem `Species.json` ou qualquer outro modelo de raça.** `a5e-ddg`/`a5e-gpg` só têm background; *Spells That Don't Suck* só tem magia; `a5e-ag` tem classe (US-139), mas não espécie. Raça continua existindo só em `wizards-of-the-coast/srd-2014` e `srd-2024` — esta story é, na prática, **inverter a precedência dentro do par que já existe**, não somar fonte nova.

### Decidido: o 5.2 sai de vez — Goliath e Orc perdem fonte

**Decisão de 15/08/2026: o 5.2 não entra nem para preencher lacuna.** `config.races` passa a vir só do `srd-2014` — sem fusão, sem `SRD_EQUIVALENTS` ativo em espécie, sem segundo documento no `sync` para este domínio. Consequência aceita: **Goliath e Orc (exclusivas do 5.2) saem do catálogo**, e nenhuma das fontes novas do ADR 009 §8 os tem para recuperar (ver tabela acima). O catálogo cai de 11 raízes (US-105) para **9** — exatamente as do `srd-2014/Species.json`, incluindo `half-elf`/`half-orc`, que já eram exclusivas dele.

---

## Escopo

### Dentro do escopo

- **`buildRaces`** ([`ingest.mjs:238-244`](../../../scripts/srd/ingest.mjs:238)): deixa de fundir dois documentos — passa a derivar `config.races` só de `srd-2014/Species.json`, filtrado a `subspecies_of === null` (mesmo filtro de hoje). `mergeEditions`/`SRD_EQUIVALENTS` deixam de ser chamados para este domínio (continuam existindo, servindo `classes`/US-139 e domínios futuros).
- **`sync.mjs`**: `Species.json` do `srd-2024` deixa de ser baixado **para este propósito** — confirmar se algum outro domínio ainda depende dele antes de remover a linha (hoje não depende, ver *Notas de implementação*).
- **`CharacterClass.json`** não muda de fonte para o campo `races` (ele nunca foi usado por `buildRaces`) — nenhuma mudança aqui, só registrado para não confundir com US-139.
- **`System.version`**: **decidido `'5.1'` como valor final** (junto com [US-139](./US-139-catalogo-classes-marshal-a5e-adventurers-guide.md)) — mas só aplica **quando US-139 também landar**: `classFeatures`/`classSpells` ainda vêm do 5.2 até lá, e mudar o campo agora deixaria ele mentindo (`'5.1'` sem `races` ser a única coisa vinda de lá). **Esta story não mexe em [`seed.ts:132,136`](../../../apps/api/prisma/seed.ts:132)** — fica `'5.2'` até a leva fechar.
- **`NOTICE-open5e.md`**: o parágrafo que descreve `races` como "união dos dois SRD, 5.2 vencendo" passa a dizer que a fonte é só o SRD 5.1.
- **Teste em `ingest.test.mjs`**: o teste que a US-105 deixou ("as 7 espécies comuns saem do 5.2… falha se a precedência inverter") passa a afirmar que **todas** as 9 raças saem do 5.1, e que `goliath`/`orc` não aparecem.
- **Migração de fichas existentes com `race = 'goliath'` ou `race = 'orc'`**: essas duas chaves saem do catálogo. Se existir alguma ficha assim no banco, ela passa a referenciar uma chave que `config.races` não tem mais — mesma classe de problema que a US-105 resolveu para o texto livre legado, agora ao contrário (chave que já foi válida deixa de ser). Contar antes de decidir o tratamento (relatar e não tocar, como o script da US-105; ou congelar a label antiga como entrada `source: 'authored'`, mesmo mecanismo do [ADR 004 §6f](../../adr/004-origem-do-dado-de-sistema.md)) — ver *Critérios de aceite* e *Notas de implementação*.
- **Migração/reseed**: reexecutar `pnpm srd:ingest` e `pnpm db:seed`/`db:migrate:race-class` como a US-105 já documentou.

### Fora do escopo

- **Subespécies do SRD 5.1** (`high-elf`, `hill-dwarf`, `lightfoot`, `rock-gnome`) — continuam filtradas fora do catálogo, mesmo corte que a US-105 já aplicava (`subspecies_of !== null`). Esta story não reabre essa decisão.
- **Traços mecânicos de raça** (`SpeciesTrait`) — `config.races` continua `{key, label}`, sem traço. Story própria, se algum dia retomada (era o escopo do US-126 apagado).
- **`a5e-ddg`, `a5e-gpg`, *Spells That Don't Suck*** — confirmados sem conteúdo de raça (ver §Contexto). Nada a fazer aqui além de registrar a checagem.
- **Catálogo de classes** — é a [US-139](./US-139-catalogo-classes-marshal-a5e-adventurers-guide.md), mesma revisão de precedência, arquivo de dataset diferente.

---

## Modelo de dados proposto

Nenhum tipo novo — `SystemConfig.races` já existe (US-105), `{key, label}[]`. O que muda é que `buildRaces` deixa de fundir dois documentos:

```ts
// scripts/srd/ingest.mjs — buildRaces, antes (US-105/ADR 009 D2)
mergeEditions(species2024, species2014, SRD_EQUIVALENTS)   // união, 2024 vence

// depois (ADR 009 §8) — sem fusão, uma fonte só
buildFromSingleSource(species2014)                          // só 5.1
```

| Campo | Antes (US-105) | Depois |
|---|---|---|
| `config.races` | 11 raízes (`goliath`, `orc` do 5.2; `half-elf`, `half-orc` do 5.1; 7 comuns do 5.2) | **9 raízes**, todas do 5.1 — `goliath`/`orc` saem, `half-elf`/`half-orc` continuam |

**Persistência:** mesmo artefato `srd-5e.config.<locale>.json` — sem migração de schema. Migração de dados só se algum `pk` normalizado divergir entre 5.1/5.2 (não esperado nas 7 comuns, ver ADR 009 §4).

---

## Critérios de aceite

- [x] `buildRaces` deriva `config.races` só do `srd-2014` — **9 raízes**: `dragonborn`, `dwarf`, `elf`, `gnome`, `halfling`, `half-elf`, `half-orc`, `human`, `tiefling`.
- [x] `goliath` e `orc` **não** aparecem em `config.races` — teste que falha se eles voltarem (proteção contra reintrodução acidental via `srd-2024`).
- [x] `NOTICE-open5e.md` descreve `races` como derivado só do SRD 5.1, não mais "união dos dois SRD".
- [x] `SystemConfigSchema` continua validando `races` sem mudança de schema.
- [x] Ambos os artefatos (`en-US`, `pt-BR`) trazem as 9 raças, sem `goliath`/`orc`.
- [x] Contagem de fichas existentes com `race = 'goliath'` ou `race = 'orc'` registrada (mesmo que zero) — se houver alguma, o tratamento está decidido e implementado (relatório sem tocar, ou entrada autoral que preserva a chave), não descoberto em produção. **Contagem: 0** (query direta na Neon, 15/08/2026 — `migrate-race-class-keys.ts` não serve pra essa medição porque já rodou uma vez e é idempotente).
- [x] **Eval / teste de regressão:** `ingest.test.mjs` cobre `buildRaces` com fixture sintética confirmando 9 entradas, todas do 5.1, e ausência de `goliath`/`orc` mesmo que a fixture do `srd-2024` os contenha.

---

## Notas de implementação

- **É simplificação, não extensão.** `buildRaces` deixa de chamar `mergeEditions`/`SRD_EQUIVALENTS` para este domínio — vira leitura direta de um documento, mesmo padrão de builder single-source que outros campos do `config` já têm. Não generalizar de volta "por via das dúvidas": se um domínio futuro precisar de união, ele chama `mergeEditions` de novo, o mecanismo continua existindo para `classes` (US-139).
- **Confirme se `srd-2024/Species.json` ainda é baixado por outro motivo antes de tirar a linha do `sync.mjs`** — na data desta story, nenhum outro builder o consome, mas revalide (`grep -rn "species2024" scripts/srd`).
- **Faça a contagem de fichas com `race` em `{goliath, orc}` antes de escrever o tratamento de migração.** Zero fichas: só documentar. Alguma ficha: decidir entre "relatar e não tocar" (padrão da US-105) e "entrada autoral que preserva a chave" (padrão do [ADR 004 §6f](../../adr/004-origem-do-dado-de-sistema.md)) — não é uma decisão de código sem saber o número.
- **`pnpm srd:sync` antes de `pnpm srd:ingest`**, ordem padrão do pipeline (US-47).
- **Descoberto na implementação, fora da spec original:** o loop de órfãos de overlay ([`ingest.mjs:759`](../../../scripts/srd/ingest.mjs:759)) nunca incluía `races` — antes da união reverter, as 11 chaves do overlay sempre casavam com as 11 do catálogo, então não fazia diferença. Com o catálogo caindo pra 9, `goliath`/`orc` (curados em [`locale/pt-BR.json`](../../../scripts/srd/locale/pt-BR.json)) ficariam mortos e invisíveis sem entrar na lista. Adicionado `races` ao loop — as duas chaves agora aparecem no relatório `ÓRFÃOS` do `ingest`. As entradas em si **não foram apagadas** do overlay (decisão de curadoria, não de código); ficam pendentes de limpeza manual.

---

## Questões em aberto

Nenhuma pendente de decisão de fonte — **decidido em 15/08/2026: só 5.1, sem união** (o ADR 009 §8 tinha deixado em aberto entre "só 5.1" e "união invertida"; fechado nesta story a favor de "só 5.1"). Fica pendente só a execução da contagem de migração (*Notas de implementação*), que é operacional, não uma escolha de desenho.

---

## Referências no código

- [scripts/srd/ingest.mjs:238-244](../../../scripts/srd/ingest.mjs:238) — `buildRaces`, onde a chamada de `mergeEditions` é removida e substituída por leitura direta do `srd-2014`.
- [scripts/srd/sync.mjs:15-19](../../../scripts/srd/sync.mjs:15) — `SRD`/`SRD_2014`, os dois documentos que `buildRaces` já baixa.
- [scripts/srd/NOTICE-open5e.md](../../../scripts/srd/NOTICE-open5e.md) — parágrafo de proveniência de `races`, a atualizar.
- [docs/adr/009-uniao-dos-srd-5-1-e-5-2.md](../../adr/009-uniao-dos-srd-5-1-e-5-2.md) §8 — a decisão que esta story implementa.
- [US-105](./US-105-raca-e-classe-por-chave-do-srd.md) — mecanismo original (`mergeEditions`, `SRD_EQUIVALENTS`, `buildRaces`), reconfigurado aqui, não reescrito.
- [apps/api/prisma/seed.ts:132,136](../../../apps/api/prisma/seed.ts:132) — `System.version`, hardcoded `'5.2'`. Não muda nesta story (ver *Escopo* → `System.version`), fica marcado aqui pra US-139 achar sem precisar regrep.
