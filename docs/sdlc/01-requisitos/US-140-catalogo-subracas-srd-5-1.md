# US-140 — Catálogo de subespécies (subraças) do SRD 5.1

**Épico:** 1 — Personagem
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada
**Depende de:** [US-138](./US-138-catalogo-racas-srd-5-1-como-referencia.md) (**obrigatória e anterior**: é ela que faz `buildRaces` derivar só do `srd-2014` — esta story estende o mesmo builder, sem reabrir a fonte) · [US-105](./US-105-raca-e-classe-por-chave-do-srd.md) (o filtro `subspecies_of === null` que esta story remove)
**Relacionado:** [ADR 009 §8](../../adr/009-uniao-dos-srd-5-1-e-5-2.md) (fonte de referência) · [US-141](./US-141-catalogo-subclasses-srd-5-1-e-marshal.md) (mesmo tipo de extensão — variante de entidade já catalogada —, story irmã com desenho diferente por razão explicada abaixo)

**Criada em:** 2026-08-15

---

## História

> **Como** jogador que cria um personagem élfico, anão, halfling ou gnomo,
> **quero** poder escolher a variante que o SRD 5.1 já documenta (Alto-elfo, Anão da Colina, Halfling Pés-Leves, Gnomo das Rochas), não só a raça-raiz,
> **para que** o catálogo de raças (US-138) pare de descartar em silêncio um dado que o próprio dataset pinado já tem.

---

## Contexto e motivação

### O filtro já descarta o dado — não é escopo novo, é escopo represado

`buildRaces` ([`ingest.mjs:238-244`](../../../scripts/srd/ingest.mjs:238)) filtra `subspecies_of === null` desde a US-105, que documentou a decisão explicitamente: *"Subespécies… se a #1 fechar na união, elas entram como fora do catálogo… oferecer subespécie é escolha de produto, não consequência da fonte"*. A US-138 não mexeu nesse filtro — só trocou a fonte de `races` para o 5.1. Esta story é a "escolha de produto" que a US-105 deixou em aberto, agora que a fonte já está decidida.

### O que existe, medido em 15/08/2026 (tag `v2.1.0`)

`srd-2014/Species.json` tem **13 registros**: 9 raízes + 4 subespécies.

| `pk` | `name` | `subspecies_of` |
|---|---|---|
| `srd_high-elf` | High Elf | `srd_elf` |
| `srd_hill-dwarf` | Hill Dwarf | `srd_dwarf` |
| `srd_lightfoot` | Lightfoot | `srd_halfling` |
| `srd_rock-gnome` | Rock Gnome | `srd_gnome` |

`srd-2024/Species.json` tem **zero subespécies** (as 9 são todas raiz, `subspecies_of: null` em todas) — confirmado hoje. Isso não é uma questão de "qual edição vence": o 5.2 nunca teve esse dado, em nenhuma das duas precedências que a US-138 considerou. Não há nenhuma fonte adicional do [ADR 009 §8](../../adr/009-uniao-dos-srd-5-1-e-5-2.md) com subespécie — `a5e-ag` não tem `Species.json` (confirmado na US-138).

Só 4 das 9 raízes têm subespécie no dataset pinado — `dragonborn`, `half-elf`, `half-orc`, `human`, `tiefling` não têm nenhuma variante aqui (mesmo corte do PHB 2014: essas cinco nunca tiveram subespécie oficial de graça).

### Por que entrar no catálogo achatado (`config.races`), e não num campo novo

Uma subespécie do SRD é uma **identidade jogável completa** — "eu sou um Alto-elfo" é uma resposta válida e final para "qual é a sua raça?", não um adendo a uma escolha de raça já feita. Isso é diferente do par classe/subclasse (US-141): "eu sou um Campeão" não faz sentido sem "eu sou um Guerreiro" por trás. Por essa razão, a subespécie entra como **mais uma entrada de `config.races`**, com um campo novo (`parentKey`) apontando para a raiz — não um catálogo `Record<raceKey, …>` separado, que é o desenho que a US-141 usa para subclasse, por um motivo estrutural diferente. `Character.race` continua sendo uma chave só, contra o mesmo catálogo fechado da US-105 — nenhuma mudança de schema em `Character`.

---

## Escopo

### Dentro do escopo

- **`buildRaces`** ([`ingest.mjs:238-244`](../../../scripts/srd/ingest.mjs:238)): para de filtrar `subspecies_of === null` — emite as 9 raízes **e** as 4 subespécies. Cada entrada de subespécie ganha `parentKey`, normalizado do mesmo jeito que a chave principal (`srd_high-elf` → `high-elf`, `parentKey: 'elf'`).
- **`SystemConfigSchema.races`** ([`packages/shared/src/types/system.ts`](../../../packages/shared/src/types/system.ts)): a entrada de raça ganha `parentKey: z.string().min(1).optional()`. Ausente = raiz (comportamento de hoje preservado); presente = subespécie da raiz referenciada.
- **Overlay pt-BR**: 4 labels novas curadas à mão, mesmo padrão das 9 já existentes (`races` não entra em `MT_DOMAINS` — string crua, tradução manual, US-105).
- **Validação/wizard**: nenhuma mudança de código — `Character.race` já aceita qualquer chave presente em `config.races` (catálogo fechado, US-105); as 4 chaves novas passam a existir, então passam a ser aceitas. O `select` do wizard lista as 13 entradas (agrupamento visual por `parentKey` é cosmético, ver *Fora do escopo*).
- **Teste em `ingest.test.mjs`**: `buildRaces` com fixture cobrindo uma raiz com subespécie (emite as duas, `parentKey` correto) e uma raiz sem (emite só a raiz, sem entrada fantasma).

### Fora do escopo

- **Traços mecânicos da subespécie** (`SpeciesTrait` — Alto-elfo ganha truque de mago e +1 Inteligência, Halfling Pés-Leves ganha furtividade racial) — mesmo corte que a US-126 (apagada) já tinha isolado para traço de raça em geral; não reaberto aqui. Esta story é identidade catalogável, não mecânica.
- **Agrupamento visual no wizard** (indentar subespécie sob a raiz no select) — cosmético; o catálogo funciona plano, uma lista de 13.
- **Migração de fichas** — não se aplica; são chaves novas, nenhuma ficha existente as usa.
- **Outras fontes com subespécie** — nenhuma das em escopo do [ADR 009 §8](../../adr/009-uniao-dos-srd-5-1-e-5-2.md) tem (`a5e-ag`/`a5e-ddg`/`a5e-gpg`/*Spells That Don't Suck* não têm `Species.json`, confirmado na US-138).
- **Catálogo de subclasse** — é a [US-141](./US-141-catalogo-subclasses-srd-5-1-e-marshal.md), desenho de dado diferente (ver §Contexto).

---

## Modelo de dados proposto

```ts
// packages/shared/src/types/system.ts — dentro do schema de config.races
{
  key: z.string().min(1),
  label: z.string().min(1),
  parentKey: z.string().min(1).optional(),   // novo — ausente = raiz
}
```

| Campo | Antes (US-138) | Depois |
|---|---|---|
| `config.races` | 9 entradas, todas raiz | **13 entradas** — 9 raízes + 4 subespécies com `parentKey` |

Exemplo:

```jsonc
[
  { "key": "elf", "label": "Elfo" },
  { "key": "high-elf", "label": "Alto-elfo", "parentKey": "elf" },
  { "key": "dwarf", "label": "Anão" },
  { "key": "hill-dwarf", "label": "Anão da Colina", "parentKey": "dwarf" },
  // …
]
```

**Persistência:** mesmo artefato `srd-5e.config.<locale>.json` — sem migração de schema em `Character` (continua `race: String`). Sem migração de dado (chaves novas, nenhuma ficha existente as referencia).

---

## Critérios de aceite

- [ ] `buildRaces` deriva **13 entradas** em `config.races`: as 9 já existentes (US-138) mais `high-elf`, `hill-dwarf`, `lightfoot`, `rock-gnome`.
- [ ] As 4 entradas de subespécie têm `parentKey` apontando para a raiz correta (`elf`, `dwarf`, `halfling`, `gnome`); as 9 raízes não têm `parentKey`.
- [ ] `SystemConfigSchema` valida `races[].parentKey` opcional; config sem o campo (artefato pré-US-140) continua válido.
- [ ] Personagem com `race: 'high-elf'` passa pela mesma validação de catálogo da US-105 (chave presente = aceita, sem mudança de código no service).
- [ ] Ambos os artefatos (`en-US`, `pt-BR`) trazem as 13 entradas.
- [ ] **Eval / teste de regressão:** `ingest.test.mjs` cobre `buildRaces` com fixture sintética: raiz com subespécie (as duas aparecem, `parentKey` certo) e raiz sem (só a raiz, sem fantasma).

---

## Notas de implementação

- **Não reintroduza `mergeEditions` aqui.** O 5.2 não participa (decisão da US-138, sem exceção) — subespécie é filtro a menos dentro do mesmo `srd-2014`, não fusão a mais.
- **Cure as 4 labels pt-BR com o mesmo cuidado das 9 existentes** — a sugestão de tradução no §História/exemplo é só ilustrativa; confirmar com quem cura o overlay antes de gravar (ver *Questões em aberto* #2).
- **Confirme a normalização do `parentKey`** — `subspecies_of` vem como `pk` cru (`srd_elf`); precisa passar pelo mesmo `norm`/strip de prefixo que já gera a chave da raiz, não um valor cru diferente da chave real da raiz.

---

## Questões em aberto

1. **A raiz "pura" continua sendo opção válida ao lado da subespécie?** O SRD 2014 (RAW do PHB) exige escolher subespécie quando a raça tem uma — "Elfo" sem variante não é tecnicamente uma opção completa. Mas o dataset só documenta **uma** subespécie por raiz aplicável (não as 2-3 do PHB completo), então forçar a escolha empobrece em vez de enriquecer. **Sugestão:** manter as duas como opções independentes (raiz E subespécie selecionáveis) — mesmo espírito de "o catálogo é o que o SRD abre como conteúdo livre, não uma tentativa de paridade estrita com o PHB" que já guiou a US-121 para background. Decisão final cabe a quem aprovar.
2. **Tradução pt-BR das 4 labels novas** — as sugeridas no exemplo (`Alto-elfo`, `Anão da Colina`, `Halfling Pés-Leves`, `Gnomo das Rochas`) não foram revisadas por curadoria; confirmar antes de gravar no overlay.

---

## Referências no código

- [scripts/srd/ingest.mjs:233-244](../../../scripts/srd/ingest.mjs:233) — `buildRaces`, onde o filtro `subspecies_of === null` é removido e o `parentKey` passa a ser emitido.
- [packages/shared/src/types/system.ts](../../../packages/shared/src/types/system.ts) — schema de `config.races`, onde `parentKey` entra.
- [scripts/srd/locale/pt-BR.json](../../../scripts/srd/locale/pt-BR.json) — onde as 4 labels novas entram.
- [US-138](./US-138-catalogo-racas-srd-5-1-como-referencia.md) — fonte (`srd-2014` só) que esta story herda sem reabrir.
- [US-105](./US-105-raca-e-classe-por-chave-do-srd.md) — decisão original de deixar subespécie fora do catálogo, revertida aqui.
- [US-141](./US-141-catalogo-subclasses-srd-5-1-e-marshal.md) — story irmã, desenho de dado diferente (catálogo `Record<classKey, …>`, não campo `parentKey` achatado).
