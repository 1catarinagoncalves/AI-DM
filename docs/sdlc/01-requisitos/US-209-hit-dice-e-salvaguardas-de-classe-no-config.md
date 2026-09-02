# US-209 — Trazer `hit_dice` e `saving_throws` do dataset para `config.classes`

**Épico:** 1 — Personagem
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** [US-139](./US-139-catalogo-classes-marshal-a5e-adventurers-guide.md) (`CLASS_MAP` aponta as 13 classes para `srd-2014` + Marshal — `buildClasses` já itera exatamente essas 13 entradas) · [US-105](./US-105-raca-e-classe-por-chave-do-srd.md) (`buildClasses` original, formato `{key,label}` que esta story estende)
**Relacionado:** [US-203 §Fora do escopo](./US-203-prosa-de-catalogo-classe-e-raca.md) (nomeou esta story: "mecânica, não copy de escolha — story própria") · [US-207 §Fora do escopo](./US-207-atributos-e-pericias-com-orcamento-visivel.md) (seção "Salvaguardas" do wizard depende de `saving_throws` existir no config) · [US-127 §Fora do escopo](./US-127-revisao-espelha-ficha-completa.md) (PV fixo `10 + mod CON` em `adventure.service.ts` — consumidor futuro do `hitDice`, **não mudado aqui**) · [US-141](./US-141-catalogo-subclasses-srd-5-1-e-marshal.md) (`RaceCatalogEntrySchema` — precedente direto de estender `SystemCatalogEntrySchema` por catálogo)

**Criada em:** 2026-09-02

---

## História

> **Como** desenvolvedora,
> **quero** que `config.classes` traga `hitDice` e `savingThrows` de cada classe, derivados do dataset SRD já baixado,
> **para que** stories futuras (PV real por dado de vida, seção "Salvaguardas" da criação de personagem) tenham de onde ler sem reingerir nada novo.

---

## Contexto e motivação

### O dado já está baixado — só nunca foi emitido

`scripts/srd/_data/CharacterClass.json` (`srd-2014`) e `CharacterClass.a5e-ag.json` (Marshal) trazem, por classe base (`subclass_of: null`), exatamente os campos que faltam. Medido em 02/09/2026, as 13 entradas:

| `pk` | `hit_dice` | `saving_throws` |
|---|---|---|
| `srd_barbarian` | `D12` | `["con","str"]` |
| `srd_bard` | `D8` | `["cha","dex"]` |
| `srd_cleric` | `D8` | `["cha","wis"]` |
| `srd_druid` | `D8` | `["int","wis"]` |
| `srd_fighter` | `D10` | `["con","str"]` |
| `srd_monk` | `D8` | `["dex","str"]` |
| `srd_paladin` | `D10` | `["cha","wis"]` |
| `srd_ranger` | `D10` | `["dex","str"]` |
| `srd_rogue` | `D8` | `["dex","int"]` |
| `srd_sorcerer` | `D6` | `["cha","con"]` |
| `srd_warlock` | `D8` | `["cha","wis"]` |
| `srd_wizard` | `D6` | `["int","wis"]` |
| `a5e_marshal` | `D10` | `["wis","con"]` |

Todas as 13 têm os dois campos preenchidos, e `saving_throws` sempre com exatamente 2 entradas — nenhum caso vazio ou parcial neste dataset. Mesmo assim, `buildClasses` ([scripts/srd/ingest.mjs:269-278](../../../scripts/srd/ingest.mjs:269)) só lê `c.pk` e `c.fields.name`; `hit_dice`/`saving_throws` nunca entram no objeto retornado. A própria [US-47](./US-47-ingestao-srd-como-dado.md#Contexto) já registrava a existência dos dois campos no dataset — só nunca virou trabalho de ingest.

### Quem está esperando este dado

- [US-207 §Fora do escopo](./US-207-atributos-e-pericias-com-orcamento-visivel.md) verificou em produto que "Salvaguardas… não existem no config" e apontou esta lacuna como bloqueio explícito.
- [US-203 §Fora do escopo](./US-203-prosa-de-catalogo-classe-e-raca.md) cortou o mesmo escopo da story de prosa por ser "mecânica, não copy de escolha", prometendo story própria — esta é ela.
- [US-127 §Fora do escopo](./US-127-revisao-espelha-ficha-completa.md) documenta a simplificação atual de PV — `10 + mod CON` fixo para qualquer classe, em `adventure.service.ts` — como algo que só uma story com `hitDice` real no config poderia substituir. Esta story disponibiliza o dado; **não** toca a fórmula.

### Por que não precisa de curadoria pt-BR (diferente de `kicker`/`blurb`, US-203)

`hitDice` (notação de dado) e `savingThrows` (chaves de atributo) não são texto — são o mesmo tipo de valor mecânico que `config.attributes[].key` e `skills[].ability` já são hoje, resolvidos para rótulo na tela por `catalogLabel`/lookup existente. Não há overlay novo, não há string para traduzir, os dois locales (`en-US`, `pt-BR`) recebem o dado idêntico.

---

## Escopo

### Dentro do escopo

- **`buildClasses`** ganha os dois campos:
  - `hitDice`: normaliza `c.fields.hit_dice` (`"D12"`) para a notação de dado já usada no resto do projeto (`"1d12"`, minúscula — mesma convenção de [`packages/shared/src/roll.ts:57`](../../../packages/shared/src/roll.ts:57), que já normaliza dado para `NdM` minúsculo). Falha alto se o valor não casar `/^D\d+$/i` — mesmo padrão de erro alto que `CLASS_MAP` já tem para chave desconhecida.
  - `savingThrows`: mapeia cada abreviação de `c.fields.saving_throws` (`"con"`, `"str"`) para a chave canônica de atributo via o `ABILITY_MAP` **já existente** ([scripts/srd/ingest.mjs:97](../../../scripts/srd/ingest.mjs:97)) — o mesmo mapa que `skills[].ability` já usa, sem duplicar. Falha alto se alguma abreviação não estiver no `ABILITY_MAP` ou se o array vier vazio.
  - **Ordem preservada, não ordenada.** O dataset não segue ordem alfabética consistente (`marshal` chega `["wis","con"]`, as outras 12 chegam predominantemente `[C,*]`/alfabética) — reordenar seria inventar uma opinião de produto que a fonte não tem. `savingThrows` sai na mesma ordem em que `saving_throws` chegou.
- **`ClassCatalogEntrySchema`** novo em `packages/shared/src/types/system.ts`, estendendo `SystemCatalogEntrySchema` com `hitDice` e `savingThrows` opcionais — mesmo padrão que `RaceCatalogEntrySchema` (US-140) já aplicou para `parentKey`. `SystemConfigSchema.classes` passa de `z.array(SystemCatalogEntrySchema)` para `z.array(ClassCatalogEntrySchema)`.
- **Campos opcionais**: config sem eles (artefato pré-US-209, sistema `Free`, um futuro `UPLOAD`) continua válido — mesma disciplina de `kicker`/`blurb` (US-203).
- **Teste em `ingest.test.mjs`**: `buildClasses` com fixture cobrindo a normalização de dado (`D12` → `1d12`), o mapeamento de `saving_throws` (abreviação → chave canônica, ordem preservada) e as duas falhas altas (dado fora do formato, abreviação desconhecida/array vazio).
- **Re-seed do artefato** (`pnpm db:seed`) após a mudança, para os dois locales — mesmo passo manual que ingests anteriores já exigem antes de considerar a story pronta em produção.

### Fora do escopo

- **Mudar a fórmula de PV.** `10 + mod CON` continua fixo em `adventure.service.ts` (US-127). Esta story só põe o dado disponível; aplicá-lo é story separada.
- **Seção "Salvaguardas" do wizard e tool de teste de salvaguarda.** [US-110](./US-110-tabela-de-testes-de-habilidade-do-srd-2024.md) e [US-111](./US-111-classe-de-dificuldade-do-srd-2024.md) já registraram que `rollDice` não tem `kind` de teste — ensinar a UI/o Mestre sobre salvaguarda sem a tool executar é a mesma armadilha que aquelas stories evitaram. Story própria.
- **`primary_abilities`.** Campo curado à parte pela US-203 (`primary`, vindo de `[]` no dataset — nada a ver com `hit_dice`/`saving_throws`).
- **`config.subclasses` (US-141) ganhar os mesmos campos.** O dataset não tem `hit_dice`/`saving_throws` próprios para subclasse (regra 5e: são da classe-mãe); quem precisar lê `config.classes` pela chave da classe-mãe que `config.subclasses` já indexa.
- **Sistema `Free`.** Não vem do ingest — não ganha os campos nesta story (schema opcional garante que isso não quebra nada).

---

## Modelo de dados proposto

```ts
// packages/shared/src/types/system.ts
export const ClassCatalogEntrySchema = SystemCatalogEntrySchema.extend({
  hitDice: z.string().min(1).optional(),        // notação "NdM", ex. "1d12"
  savingThrows: z.array(z.string().min(1)).optional(), // chaves canônicas de atributo, ordem do dataset
})

// dentro de SystemConfigSchema:
classes: z.array(ClassCatalogEntrySchema).optional(),
```

Exemplo (`barbarian` e `marshal`, ilustrando a ordem preservada):

```jsonc
{
  "classes": [
    { "key": "barbarian", "label": "Bárbaro", "hitDice": "1d12", "savingThrows": ["constitution", "strength"] },
    { "key": "marshal",   "label": "Marechal", "hitDice": "1d10", "savingThrows": ["wisdom", "constitution"] }
    // … as outras 11 classes
  ]
}
```

| Campo | Antes | Depois |
|---|---|---|
| `config.classes[].hitDice` | inexistente | `"1d12"` etc., 13 valores |
| `config.classes[].savingThrows` | inexistente | 2 chaves de atributo por classe, 13 entradas |

**Persistência:** mesmo artefato `srd-5e.config.<locale>.json` — sem migração em `Character`, sem coluna nova.

---

## Critérios de aceite

- [ ] `buildClasses` emite `hitDice` (notação `NdM` minúscula) e `savingThrows` (2 chaves canônicas de atributo, ordem do dataset preservada) para as 13 classes.
- [ ] `SystemConfigSchema` valida com `ClassCatalogEntrySchema`; config sem os campos (artefato pré-US-209) continua válido.
- [ ] `hit_dice` fora do formato `/^D\d+$/i`, ou `saving_throws` vazio/com abreviação fora do `ABILITY_MAP`, falha o ingest (erro alto, não descarte silencioso).
- [ ] `config.subclasses` (US-141) não ganha os campos — sem mudança.
- [ ] Ambos os artefatos (`en-US`, `pt-BR`) trazem os mesmos 13 `hitDice`/`savingThrows` — dado idêntico nos dois locales, sem overlay.
- [ ] **Eval/teste de regressão:** `ingest.test.mjs` cobre normalização de dado, mapeamento de ability (ordem preservada) e as duas falhas altas.

---

## Notas de implementação

- `ABILITY_MAP` ([scripts/srd/ingest.mjs:97](../../../scripts/srd/ingest.mjs:97)) já resolve abreviação → chave canônica — é o mesmo mapa que `skills[].ability` usa; não criar um segundo.
- Normalização de dado: `/^D(\d+)$/i` sobre `hit_dice`, produzindo `` `1d${sides}` ``. Mesma convenção de notação que `packages/shared/src/roll.ts` já usa para `1d20`.
- Não ordenar `savingThrows` — a ordem do dataset não é alfabética de forma confiável (`marshal` quebra o padrão que as outras 12 sugerem), então "preservar" é a única regra que não inventa opinião sobre um dado que já vem pronto.

---

## Referências no código

- [scripts/srd/ingest.mjs:269-278](../../../scripts/srd/ingest.mjs:269) — `buildClasses`, onde os dois campos entram.
- [scripts/srd/ingest.mjs:97](../../../scripts/srd/ingest.mjs:97) — `ABILITY_MAP`, reusado sem alteração.
- [packages/shared/src/roll.ts:57](../../../packages/shared/src/roll.ts:57) — convenção de notação de dado (`NdM` minúsculo) que `hitDice` segue.
- [packages/shared/src/types/system.ts:36-38](../../../packages/shared/src/types/system.ts:36) — `RaceCatalogEntrySchema`, precedente direto de `extend()` sobre `SystemCatalogEntrySchema`.
- [docs/sdlc/01-requisitos/US-127-revisao-espelha-ficha-completa.md:61](./US-127-revisao-espelha-ficha-completa.md) — fórmula de PV fixa, consumidor futuro do `hitDice`.
