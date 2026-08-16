# US-141 — Catálogo de subclasses do SRD 5.1 e do Marshal (`a5e-ag`)

**Épico:** 1 — Personagem
**Fase:** 1 — MVP single-player
**Status:** 🗂️ Backlog
**Depende de:** [US-139](./US-139-catalogo-classes-marshal-a5e-adventurers-guide.md) (**obrigatória e anterior**: é ela que aponta o `CLASS_MAP` para o `srd-2014` e traz `a5e_marshal → marshal` — esta story reusa o mesmo mapa para resolver a classe-mãe de cada subclasse) · [US-41](./US-41-features-traits-de-classe.md) (formato `{key, label}` reusado)
**Relacionado:** [ADR 009 §4](../../adr/009-uniao-dos-srd-5-1-e-5-2.md) (mediu a divergência de subclasse entre edições — moot depois que o 5.2 saiu de escopo, US-139) · [US-140](./US-140-catalogo-subracas-srd-5-1.md) (mesmo tipo de extensão — variante de entidade já catalogada —, story irmã com desenho diferente por razão explicada abaixo)

**Criada em:** 2026-08-15

---

## História

> **Como** desenvolvedora,
> **quero** um catálogo de subclasses (`config.subclasses`, agrupado por classe-mãe) derivado do SRD 5.1 e do Marshal do `a5e-ag`,
> **para que** o jogo saiba que arquétipos existem por classe — mesmo sem aplicar a escolha na criação de personagem ainda.

---

## Contexto e motivação

### O que existe, medido em 15/08/2026 (tag `v2.1.0`)

`srd-2014/CharacterClass.json` tem **12 subclasses**, uma por classe base — o SRD 2014 só libera uma opção de arquétipo por classe como conteúdo aberto:

| `pk` | `name` | classe-mãe |
|---|---|---|
| `srd_path-of-the-berserker` | Path of the Berserker | `barbarian` |
| `srd_college-of-lore` | College of Lore | `bard` |
| `srd_life-domain` | Life Domain | `cleric` |
| `srd_circle-of-the-land` | Circle of the Land | `druid` |
| `srd_champion` | Champion | `fighter` |
| `srd_way-of-the-open-hand` | Way of the Open Hand | `monk` |
| `srd_oath-of-devotion` | Oath of Devotion | `paladin` |
| `srd_hunter` | Hunter | `ranger` |
| `srd_thief` | Thief | `rogue` |
| `srd_draconic-bloodline` | Draconic Bloodline | `sorcerer` |
| `srd_the-fiend` | The Fiend | `warlock` |
| `srd_school-of-evocation` | School of Evocation | `wizard` |

Somadas às 3 do Marshal já medidas na US-139 (`Gambling General`, `Swift Strategist`, `Talented Tactician`) — **15 subclasses no total**, cobrindo as 13 classes que existirão em `config.classes` depois da US-139.

### O que fica moot: a divergência de nome entre edições

O [ADR 009 §4](../../adr/009-uniao-dos-srd-5-1-e-5-2.md) media 4 pares renomeados entre 5.1 e 5.2 (`draconic-bloodline` → `draconic-sorcery`, `school-of-evocation` → `evoker`, `the-fiend` → `fiend-patron`, `way-of-the-open-hand` → `warrior-of-the-open-hand`) — a razão de existir do `SRD_EQUIVALENTS`. Com o 5.2 totalmente fora desde a US-139, essa deduplicação não se aplica aqui: só o nome do 5.1 entra, sem par a casar.

### `CharacterClass.desc` continua vazio — catálogo é `{key, label}`, igual a `classes`/`races`

Confirmado nas 12 entradas do 5.1 e nas 3 do Marshal: `fields.desc` vem vazio (mesmo comportamento já documentado para classe base, US-105). Nenhuma descrição de subclasse vem daqui — só nome.

### O dataset TEM feature de subclasse — mas fica fora desta story

`ClassFeature.json` (5.1) tem entradas com `parent` = pk de subclasse (ex.: `srd_champion` tem 5 — *Additional Fighting Style*, *Improved Critical*, *Remarkable Athlete*, *Superior Critical*, *Survivor*). O mecanismo existe no dataset; `buildClassFeatures` (US-139) simplesmente nunca olha para `parent`s que não estão em `CLASS_MAP` como classe base, então essas linhas já são ignoradas hoje, silenciosamente. Esta story **não** as processa — mesmo corte de disciplina que a US-105/US-138 aplicaram a traço de raça: catalogar identidade primeiro, mecânica é story separada (ver *Fora do escopo*).

### Por que `Record<classKey, …>` e não achatado em `config.classes` (diferente da US-140)

Uma subclasse **não** é uma identidade jogável sozinha: "eu sou um Campeão" pressupõe "eu sou um Guerreiro" — é um refinamento da classe já escolhida, tipicamente adquirido num nível específico (1 para Clérigo/Feiticeiro/Bruxo, 3 para a maioria das outras), não uma alternativa a ela. Misturar subclasse em `config.classes` faria `Character.class = 'champion'` implicar perder a informação "é Guerreiro" — errado. Por isso o catálogo entra separado, `config.subclasses: Record<classKey, {key,label}[]>` — mesmo formato de `Record` já usado por `classFeatures`/`backgroundFeatures` (US-41/US-135), agrupado pela classe-mãe.

---

## Escopo

### Dentro do escopo

- **`buildSubclasses`** (nova função em `ingest.mjs`, ao lado de `buildClasses`): filtra `CharacterClass` com `subclass_of !== null` (o oposto do filtro que `buildClasses` já aplica), resolve a classe-mãe pelo `CLASS_MAP` (já apontando pro 5.1 + Marshal desde a US-139) e agrupa por chave canônica da classe. Falha alto se uma subclasse referenciar um `subclass_of` sem entrada no `CLASS_MAP` (mesmo padrão de erro alto que `buildClassFeatures` já tem para `parent` órfão).
- **Fonte de dado**: o mesmo `CharacterClass.json` (`srd-2014`) e `a5e-ag/CharacterClass.json` que a US-105/US-139 já baixam — nenhum arquivo novo no `sync.mjs`.
- **`SystemConfigSchema`** ganha `subclasses: z.record(z.string(), z.array(SystemCatalogEntrySchema)).optional()` — reusa o schema `{key,label}` já nomeado (`SystemCatalogEntrySchema`, mesmo usado por `races`/`classes`) dentro de um `Record` por classe-mãe, em vez de duplicar a forma como objeto literal solto (mesmo instinto de schema nomeado que a US-140 aplicou ao separar `RaceCatalogEntrySchema`).
- **Overlay pt-BR**: 15 labels novas curadas à mão (12 do SRD + 3 do Marshal), mesmo padrão manual de `classes`/`races` (não entra em `MT_DOMAINS` — nome próprio curto, não prosa).
- **`NOTICE-open5e.md`**: nenhuma atribuição nova — mesmos dois documentos (`srd-2014`, `a5e-ag`) já atribuídos pela US-105/US-121/US-139.
- **Teste em `ingest.test.mjs`**: `buildSubclasses` com fixture sintética cobrindo uma classe com subclasse, uma sem (chave ausente ou array vazio — decidir e testar um dos dois, não os dois formatos ao mesmo tempo) e uma subclasse com `subclass_of` órfão (deve falhar o ingest, não ser descartada).

### Fora do escopo

- **Features mecânicas de subclasse** (`ClassFeature` com `parent` = pk de subclasse, confirmado existente no dataset) — mesmo corte que a US-139 aplicou a feature de classe base: catálogo de identidade agora, mecânica é story própria.
- **Escolha de subclasse na criação de personagem** — nenhuma mudança em `Character`, `character.service.ts` ou no wizard. Catálogo pronto para consumo, wiring é story separada (mesmo corte que a US-121 fez para background, a US-138/140 para raça).
- **Nível em que a subclasse é escolhida** (1 para Clérigo/Feiticeiro/Bruxo, 3 para a maioria) — não modelado; o jogo não rastreia nível de personagem hoje. YAGNI: não há sistema de progressão para modelar contra ainda; a story que implementar a escolha decide isso quando o cenário existir.
- **As 4 divergências de nome entre edições** (`SRD_EQUIVALENTS` do ADR 009 §4) — moot, o 5.2 não é consultado (US-139).
- **Catálogo de subespécie** — é a [US-140](./US-140-catalogo-subracas-srd-5-1.md), desenho de dado diferente (ver §Contexto).

---

## Modelo de dados proposto

Nenhum tipo novo além do `Record` — reusa o `SystemCatalogEntrySchema` já nomeado, o mesmo `{key, label}` usado por `classes`/`races` (US-140 aplicou o mesmo instinto: schema nomeado em vez de literal duplicado):

```ts
// packages/shared/src/types/system.ts — dentro de SystemConfigSchema
subclasses: z.record(
  z.string(),                            // chave da classe-mãe
  z.array(SystemCatalogEntrySchema),     // reuso direto — mesma forma de classes/races, sem parentKey
).optional(),
```

Exemplo:

```jsonc
{
  "fighter": [{ "key": "champion", "label": "Campeão" }],
  "cleric":  [{ "key": "life-domain", "label": "Domínio da Vida" }],
  "marshal": [
    { "key": "gambling-general", "label": "…" },
    { "key": "swift-strategist", "label": "…" },
    { "key": "talented-tactician", "label": "…" }
  ]
  // … as outras 10 classes SRD
}
```

| Campo | Antes | Depois |
|---|---|---|
| `config.subclasses` | inexistente | `Record<classKey, {key,label}[]>` — 15 entradas no total (12 SRD + 3 Marshal), uma lista por classe-mãe |

**Persistência:** mesmo artefato `srd-5e.config.<locale>.json` — sem migração de schema em `Character`, sem coluna nova. Nenhum campo de `Character` referencia subclasse ainda.

---

## Critérios de aceite

- [ ] `buildSubclasses` deriva `config.subclasses` com **13 chaves** de classe-mãe (as 12 SRD + `marshal`), cada uma com sua(s) subclasse(s) — 1 por classe SRD, 3 para `marshal`.
- [ ] Subclasse com `subclass_of` sem entrada no `CLASS_MAP` falha o ingest (erro alto, não descarte silencioso).
- [ ] `SystemConfigSchema` valida `subclasses` opcional; config sem o campo (artefato pré-US-141) continua válido.
- [ ] `config.classes` (US-139) **não muda** — subclasse não aparece na lista de classes selecionáveis.
- [ ] `NOTICE-open5e.md` não precisa de entrada nova (mesmos documentos já atribuídos).
- [ ] Ambos os artefatos (`en-US`, `pt-BR`) trazem as 15 subclasses.
- [ ] **Eval / teste de regressão:** `ingest.test.mjs` cobre `buildSubclasses` com fixture sintética: classe com subclasse, classe sem, e subclasse com `subclass_of` órfão (falha esperada).

---

## Notas de implementação

- **Reuse o `CLASS_MAP` sem alteração** — ele já resolve tanto `srd_<classe>` (US-139) quanto `a5e_marshal` (US-139) para a mesma chave canônica que `buildClasses` usa; `buildSubclasses` só precisa do mesmo mapa para o lado `subclass_of`.
- **Decida o formato de "classe sem subclasse" antes de escrever o teste** — array vazio (`fighter: []` mesmo se não tivesse) ou chave ausente do `Record`. Como as 13 classes catalogadas (US-139) **têm** exatamente 1 subclasse cada, esse caso só aparece na fixture sintética do teste — mas o formato importa para quem for consumir depois.
- **Cure as 15 labels pt-BR** — nenhuma delas foi traduzida ainda; nomes de arquétipo (`Champion`, `Life Domain`) têm precedente direto nas 12 classes já traduzidas (US-105), seguir o mesmo tom.

---

## Questões em aberto

1. **A subclasse do Marshal usa o mesmo rótulo em `config.subclasses.marshal` que a US-139 já previa excluir?** A US-139 tinha marcado as três subclasses do Marshal como fora de escopo dela — esta story as importa pelo catálogo de subclasse, não pelo de classe. Confirmar que não há conflito de expectativa com quem revisar a US-139 depois desta.

---

## Referências no código

- [scripts/srd/ingest.mjs:34](../../../scripts/srd/ingest.mjs:34) — `CLASS_MAP`, reusado sem alteração para resolver a classe-mãe.
- [scripts/srd/ingest.mjs:248-257](../../../scripts/srd/ingest.mjs:248) — `buildClasses`, molde direto para `buildSubclasses` (mesmo filtro invertido: `subclass_of !== null`).
- [scripts/srd/ingest.mjs:740](../../../scripts/srd/ingest.mjs:740) — `buildConfig`, onde `buildSubclasses` entra ao lado de `buildClasses`.
- [packages/shared/src/types/system.ts](../../../packages/shared/src/types/system.ts) — `SystemConfigSchema`, onde `subclasses` entra; reusa `SystemCatalogEntrySchema` (mesmo já usado por `races`/`classes`) em vez de objeto literal novo.
- [scripts/srd/locale/pt-BR.json](../../../scripts/srd/locale/pt-BR.json) — onde as 15 labels novas entram.
- [docs/adr/009-uniao-dos-srd-5-1-e-5-2.md](../../adr/009-uniao-dos-srd-5-1-e-5-2.md) §4 — medição da divergência de nome entre edições, moot depois da US-139.
- [US-139](./US-139-catalogo-classes-marshal-a5e-adventurers-guide.md) — `CLASS_MAP` apontando pro 5.1 + Marshal, dependência direta.
- [US-140](./US-140-catalogo-subracas-srd-5-1.md) — story irmã, desenho de dado diferente (campo `parentKey` achatado, não `Record` por pai).
