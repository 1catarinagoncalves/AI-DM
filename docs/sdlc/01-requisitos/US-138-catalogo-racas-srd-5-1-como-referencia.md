# US-138 — Catálogo de raças re-derivado com o SRD 5.1 (2014) como fonte de referência

**Épico:** 1 — Personagem
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada
**Depende de:** [US-105](./US-105-raca-e-classe-por-chave-do-srd.md) (**obrigatória e anterior**: constrói `buildRaces` e o mecanismo de fusão 2014+2024 que esta story só reconfigura — não reescreve) · [ADR 009 §8](../../adr/009-uniao-dos-srd-5-1-e-5-2.md) (a decisão que esta story implementa: o SRD 5.1 vira fonte de referência, o 5.2 sai de escopo)
**Relacionado:** [ADR 004](../../adr/004-origem-do-dado-de-sistema.md) (pipeline pinado, licença única) · [US-139](./US-139-catalogo-classes-marshal-a5e-adventurers-guide.md) (mesma revisão de precedência aplicada a `classes`, na mesma leva)
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

### O que a inversão custa: Goliath e Orc perdem fonte

A união atual (US-105) tem 11 raízes porque o 5.2 contribui `goliath` e `orc` (exclusivas dele) e o 5.1 contribui `half-elf`/`half-orc` (exclusivas dele). O [ADR 009 §8](../../adr/009-uniao-dos-srd-5-1-e-5-2.md) deixou em aberto se o 5.2 sai **de vez** (sem união nenhuma do lado WotC) ou se continua entrando só para preencher o que o 5.1 não tem (união invertida: 5.1 vence, 5.2 tapa buraco). A diferença é concreta: **se o 5.2 sai de vez, Goliath e Orc desaparecem do catálogo** — ninguém os re-adiciona, porque nenhuma das fontes novas os tem. Ver *Questões em aberto* #1.

---

## Escopo

### Dentro do escopo

- **`buildRaces`** ([`ingest.mjs:238-244`](../../../scripts/srd/ingest.mjs:238)): a chamada de fusão troca de ordem — carrega o `srd-2014` inteiro primeiro; o `srd-2024` participa só na forma que a *Questão em aberto* #1 decidir (união invertida) ou não participa (5.1 puro). O `SRD_EQUIVALENTS` ([ADR 009 D3](../../adr/009-uniao-dos-srd-5-1-e-5-2.md)) continua existindo — vazio para espécie hoje, mas o comentário que a US-105 deixou (*"não conclua daí que é dispensável"*) segue valendo.
- **`CharacterClass.json`** não muda de fonte para o campo `races` (ele nunca foi usado por `buildRaces`) — nenhuma mudança aqui, só registrado para não confundir com US-139.
- **`System.version`**: revisar se `'5.2'` (D5 do ADR 009, mantido até aqui) ainda faz sentido como "edição de referência" com o 5.1 sendo a fonte primária de `races`. Não precisa mudar nesta story se `classes` (US-139) continuar batendo entre as duas edições — mas o valor tem que refletir a decisão real, não ficar por inércia.
- **`NOTICE-open5e.md`**: o parágrafo que descreve `races` como "união dos dois SRD, 5.2 vencendo" passa a descrever a nova precedência.
- **Teste em `ingest.test.mjs`**: o teste que a US-105 deixou ("as 7 espécies comuns saem do 5.2… falha se a precedência inverter") passa a afirmar o oposto — as 7 comuns saem do 5.1.
- **Migração/reseed**: `config.races` muda de conteúdo (a fonte do rótulo de cada raça comum pode divergir entre 5.1 e 5.2 em texto, mesmo com chave idêntica) — reexecutar `pnpm srd:ingest` e `pnpm db:seed`/`db:migrate:race-class` como a US-105 já documentou; nenhuma migração de **chave** nova, porque as 7 comuns têm o mesmo `pk` normalizado nas duas edições.

### Fora do escopo

- **Subespécies do SRD 5.1** (`high-elf`, `hill-dwarf`, `lightfoot`, `rock-gnome`) — continuam filtradas fora do catálogo, mesmo corte que a US-105 já aplicava (`subspecies_of !== null`). Esta story não reabre essa decisão.
- **Traços mecânicos de raça** (`SpeciesTrait`) — `config.races` continua `{key, label}`, sem traço. Story própria, se algum dia retomada (era o escopo do US-126 apagado).
- **`a5e-ddg`, `a5e-gpg`, *Spells That Don't Suck*** — confirmados sem conteúdo de raça (ver §Contexto). Nada a fazer aqui além de registrar a checagem.
- **Catálogo de classes** — é a [US-139](./US-139-catalogo-classes-marshal-a5e-adventurers-guide.md), mesma revisão de precedência, arquivo de dataset diferente.

---

## Modelo de dados proposto

Nenhum tipo novo — `SystemConfig.races` já existe (US-105), `{key, label}[]`. O que muda é **qual documento vence** dentro de `buildRaces`, não o formato:

```ts
// scripts/srd/ingest.mjs — buildRaces, antes (US-105/ADR 009 D2)
mergeEditions(species2024, species2014, SRD_EQUIVALENTS)   // 2024 vence

// depois (ADR 009 §8) — forma exata depende da Questão em aberto #1
mergeEditions(species2014, species2024, SRD_EQUIVALENTS)   // 5.1 vence
```

| Campo | Antes (US-105) | Depois |
|---|---|---|
| `config.races` | 11 raízes, 2024 vence nas 7 comuns | 9 a 11 raízes (depende da *Questão em aberto* #1), 5.1 vence nas 7 comuns |

**Persistência:** mesmo artefato `srd-5e.config.<locale>.json` — sem migração de schema. Migração de dados só se algum `pk` normalizado divergir entre 5.1/5.2 (não esperado nas 7 comuns, ver ADR 009 §4).

---

## Critérios de aceite

- [ ] `buildRaces` deriva `config.races` com o SRD 5.1 vencendo nas raças comuns às duas edições — teste que falha se a precedência voltar a ser 2024.
- [ ] A *Questão em aberto* #1 está resolvida em código: ou `config.races` mantém 11 raízes (união invertida, 2024 tapa buraco), ou passa a ter 9 (só 5.1) — o número no teste bate com a decisão tomada, documentada aqui com data.
- [ ] `NOTICE-open5e.md` descreve a precedência corrente (qual edição vence), não a do ADR 009 original.
- [ ] `SystemConfigSchema` continua validando `races` sem mudança de schema.
- [ ] Ambos os artefatos (`en-US`, `pt-BR`) refletem a nova precedência.
- [ ] **Eval / teste de regressão:** `ingest.test.mjs` cobre `buildRaces` com fixture sintética confirmando que uma raça presente nas duas edições sai com o texto do 5.1, e que a raça exclusiva de cada edição entra ou não conforme a decisão da *Questão em aberto* #1.

---

## Notas de implementação

- **Não é fonte nova, é troca de argumento.** `mergeEditions`/`SRD_EQUIVALENTS` (US-105, ADR 009 D3) já existem e servem sem alteração de assinatura — só a ordem dos dois datasets na chamada muda. Resistir à tentação de generalizar o mecanismo "por via das dúvidas": ele já é genérico.
- **Faça a contagem antes de fechar a Questão em aberto #1**, mesma disciplina da US-105: quantas fichas existentes têm `race = 'goliath'` ou `race = 'orc'`, se o banco já tiver alguma. Se zero, o custo de perdê-las é só "opção a menos no wizard", não migração de ficha.
- **`pnpm srd:sync` antes de `pnpm srd:ingest`**, ordem padrão do pipeline (US-47).

---

## Questões em aberto

1. **A inversão é "só 5.1" ou "união invertida" (5.1 vence, 5.2 tapa buraco)?** O ADR 009 §8 registrou a pergunta sem resolver. Só 5.1 é mais simples (uma fonte, sem `SRD_EQUIVALENTS` ativo em espécie) mas **derruba Goliath e Orc do catálogo** sem nenhuma fonte em escopo para recuperá-los. União invertida preserva as 11 raízes de hoje, ao custo de manter os dois documentos no `sync` para `races` — o mesmo custo que a US-105 já paga hoje, só invertido. **Sugestão:** união invertida — o ADR 009 original já argumentou (§3.1) que tirar opção de raça por corte editorial de terceiro é o problema a evitar; a mesma lógica vale ao inverter. Decisão final cabe a quem aprovar esta story.

---

## Referências no código

- [scripts/srd/ingest.mjs:238-244](../../../scripts/srd/ingest.mjs:238) — `buildRaces`, onde a ordem dos argumentos muda.
- [scripts/srd/sync.mjs:15-19](../../../scripts/srd/sync.mjs:15) — `SRD`/`SRD_2014`, os dois documentos que `buildRaces` já baixa.
- [scripts/srd/NOTICE-open5e.md](../../../scripts/srd/NOTICE-open5e.md) — parágrafo de proveniência de `races`, a atualizar.
- [docs/adr/009-uniao-dos-srd-5-1-e-5-2.md](../../adr/009-uniao-dos-srd-5-1-e-5-2.md) §8 — a decisão que esta story implementa.
- [US-105](./US-105-raca-e-classe-por-chave-do-srd.md) — mecanismo original (`mergeEditions`, `SRD_EQUIVALENTS`, `buildRaces`), reconfigurado aqui, não reescrito.
