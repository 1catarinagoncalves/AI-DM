# US-139 — Catálogo de classes com o SRD 5.1 como referência, e o Marshal do A5E Adventurer's Guide

**Épico:** 1 — Personagem
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada
**Depende de:** [US-105](./US-105-raca-e-classe-por-chave-do-srd.md) (**obrigatória e anterior**: constrói o `CLASS_MAP`/`buildClassFeatures`/`buildClassSpells` que esta story estende) · [ADR 009 §8](../../adr/009-uniao-dos-srd-5-1-e-5-2.md) (a decisão que esta story implementa: SRD 5.1 como referência, `a5e-ag` em escopo) · [US-121](./US-121-catalogo-backgrounds-a5e-adventurers-guide.md) (precedente direto: primeiro dado do `a5e-ag`, licença CC-BY-4.0 já resolvida e atribuída)
**Relacionado:** [ADR 004 §3.3](../../adr/004-origem-do-dado-de-sistema.md) (regra de licença única, segundo publisher) · [US-41](./US-41-features-traits-de-classe.md) (`SystemClassFeatureSchema`, reusado sem alteração) · [US-51](./US-51-kits-iniciais-do-srd.md) (`parseStartingKit`, precedente de parser de equipamento inicial a partir de texto de feature) · [US-138](./US-138-catalogo-racas-srd-5-1-como-referencia.md) (mesma revisão de precedência aplicada a `races`, na mesma leva)
**Criada em:** 2026-08-15

---

## História

> **Como** desenvolvedora,
> **quero** que `config.classes` derive do SRD 5.1 como fonte de referência (revisando a precedência do ADR 009) e ganhe a classe **Marshal** do *Level Up: Advanced 5th Edition — Adventurer's Guide* (`a5e-ag`),
> **para que** o catálogo de classes siga o [ADR 009 §8](../../adr/009-uniao-dos-srd-5-1-e-5-2.md) e o jogador tenha, pela primeira vez, uma classe que não é uma das 12 do SRD.

---

## Contexto e motivação

### A parte que já não muda nada: as 12 bases são idênticas

O [ADR 009 §4](../../adr/009-uniao-dos-srd-5-1-e-5-2.md) mediu, em 02/08/2026, que `CharacterClass` (base) tem **12 em cada edição, todas idênticas** — nenhuma diferença de conteúdo entre 5.1 e 5.2 nas 12 classes centrais. Inverter a precedência (como o [ADR 009 §8](../../adr/009-uniao-dos-srd-5-1-e-5-2.md) manda) não muda **quais** classes existem — só qual documento fornece o texto de cada uma, e o `CLASS_MAP` ([`ingest.mjs:34`](../../../scripts/srd/ingest.mjs:34)) já normaliza os dois `pk` para a mesma chave. É a metade barata desta story.

### A parte nova: `a5e-ag` tem uma 13ª classe

Medido em 15/08/2026 contra `open5e/open5e-api`, tag `v2.1.0` (mesmo tag pinado da US-121): `en-publishing/a5e-ag/CharacterClass.json` tem **4 entradas** — não 21 como `Background.json` (US-121). Filtrando por `subclass_of`:

| `pk` | `name` | `subclass_of` |
|---|---|---|
| `a5e_marshal` | Marshal | `None` (classe base) |
| `a5e_gambling-general` | Gambling General | `a5e_marshal` |
| `a5e_swift-strategist` | Swift Strategist | `a5e_marshal` |
| `a5e_talented-tactician` | Talented Tactician | `a5e_marshal` |

**Uma classe base — Marshal — com três subclasses.** Nenhuma das outras 11 classes do A5E (Berserker, Champion, Ranger…) está modelada aqui: o Open5e só estruturou o que é exclusivo do A5E, não o remake completo do PHB. `a5e-ag/ClassFeature.json` tem **34 entradas** com `parent = 'a5e_marshal'` — proficiências, tabela de progressão (`CLASS_TABLE_DATA`, `PROFICIENCY_BONUS`), equipamento inicial (`STARTING_EQUIPMENT`) e as features de fato (`Rallying Surge`, `Combat Maneuvers`, `Marshal Archetype`…), o mesmo tipo de mistura que o [ADR 004 §4](../../adr/004-origem-do-dado-de-sistema.md) já descreveu para o SRD (a US-47 descarta linha de tabela, mantém feature). Não há `Spell.json`/`SpellCastingOption.json` referenciando `marshal` — é uma classe marcial, sem conjuração (a confirmar durante o `sync`, ver *Notas de implementação*).

### Por que é a mesma story que a precedência, e não duas

O `CLASS_MAP` é um mapa único de `pk` → chave canônica, consultado por `buildClasses`, `buildClassFeatures` e `buildStartingKits` ([ADR 004 §3.2](../../adr/004-origem-do-dado-de-sistema.md)). Adicionar `a5e_marshal → marshal` ao mesmo mapa que passa a apontar `srd_*` (5.1) em vez de `srd-2024_*` (5.2) para as 12 classes SRD é uma edição no mesmo arquivo, no mesmo formato — separar em duas stories duplicaria o "onde mexer" sem separar risco de verdade.

---

## Escopo

### Dentro do escopo

- **`CLASS_MAP`** ([`ingest.mjs:34`](../../../scripts/srd/ingest.mjs:34)): as 12 entradas SRD passam a apontar para o `pk` do `srd-2014` (`srd_barbarian`, não `srd-2024_barbarian`); ganha a 13ª entrada, `a5e_marshal → marshal`.
- **`sync.mjs`**: baixa `en-publishing/a5e-ag/CharacterClass.json` (já baixado indiretamente? não — só `Background.json`/`BackgroundBenefit.json` de `a5e-ag` estão no `FILES` hoje, US-121) e o `ClassFeature.json`/`ClassFeatureItem.json` do mesmo documento, ao lado do par que `Background`/`BackgroundBenefit` já usa.
- **`buildClasses`** (o builder de `config.classes`, dentro de `buildRaces`/sibling em `ingest.mjs`): passa a incluir `marshal` na lista, com `label` do overlay pt-BR (nova entrada curada à mão, mesmo padrão das 21 labels de `races`/`classes` da US-105).
- **`buildClassFeatures`**: estende para ler `a5e-ag/ClassFeature.json` + `ClassFeatureItem.json` (mesmo par de arquivos que já processa para o SRD) e filtrar `parent = 'a5e_marshal'`, nível 1, excluindo `feature_type` de tabela/proficiência (`CLASS_TABLE_DATA`, `PROFICIENCY_BONUS`, `PROFICIENCIES`) — mesmo corte que já aplica às 12 classes SRD. Resultado em `config.classFeatures.marshal`, formato `SystemClassFeatureSchema` (US-41), sem tipo novo. `source: 'a5e-ag'`.
- **`buildStartingKits`**: `a5e_marshal_starting-equipment` (`feature_type: STARTING_EQUIPMENT`) alimenta `config.startingKits.marshal` — **o formato do texto pode não ser o de `parseStartingKit`** (US-51 foi escrito para o `CORE_TRAITS_TABLE` do SRD); inspecionar o `desc` real após o `sync` antes de decidir se reusa o parser ou precisa de um variante (ver *Notas de implementação*).
- **`NOTICE-open5e.md`**: o parágrafo que já atribui `a5e-ag` (US-121, escopado a "backgrounds") passa a dizer também "classes" — mesmo documento, mesma licença CC-BY-4.0, nenhuma atribuição nova a escrever.
- **`classes`/`classFeatures`/`startingKits` entram em `MT_DOMAINS`** para `marshal` — já estão (US-105/US-51), só a entrada nova soma volume, sem mudança de mecanismo.
- **Wizard / criação de personagem**: `marshal` aparece no `select` de classe assim que `config.classes` o lista — nenhuma mudança de código no `SetupWizard`, porque a lista já vem do `config` (US-105).
- **Teste em `ingest.test.mjs`**: `buildClasses`/`buildClassFeatures`/`buildStartingKits` com fixture sintética para `a5e_marshal` (feature presente, tabela/proficiência excluída) e para as 12 classes SRD confirmando que a origem virou `srd-2014`.

### Fora do escopo

- **As três subclasses do Marshal** (`Gambling General`, `Swift Strategist`, `Talented Tactician`) — mesmo filtro `subclass_of !== null` que já exclui subclasse das 12 classes SRD. Marshal entra como classe base sem escolha de subclasse na criação (mesmo corte que as 12 SRD têm hoje — subclasse não é escolhida na criação, US-41).
- **As outras 11 classes do A5E** (Berserker, Champion…) — não modeladas no `a5e-ag/CharacterClass.json` (medido, ver §Contexto); não há dataset a importar.
- **Magia do Marshal**, se o `sync` revelar que a classe tem alguma forma de conjuração — vira *Questão em aberto* nova se acontecer; a hipótese de trabalho é classe não-conjuradora (ver §Contexto).
- **Kit/gancho de aventura inicial específico do Marshal** (`getStartingHook`, `resolveInitialHook`) além do equipamento — mesmo corte que classes SRD já têm hoje (`resolveInitialHook` usa `default` para classe fora do mapa; `marshal` passa a ter `startingKits` próprio, mas gancho de aventura customizado é decisão de conteúdo separada).
- **Catálogo de raças** — é a [US-138](./US-138-catalogo-racas-srd-5-1-como-referencia.md), mesma revisão de precedência, dataset diferente.

---

## Modelo de dados proposto

Nenhum tipo novo — reusa `SystemClassFeatureSchema` (US-41) e o formato `{key, label}[]` de `config.classes` (US-105):

```ts
// scripts/srd/ingest.mjs
const CLASS_MAP = {
  'srd_barbarian': 'barbarian',        // antes: 'srd-2024_barbarian'
  // … as outras 11, mesma troca de prefixo
  'a5e_marshal': 'marshal',            // novo
}
```

| Campo | Antes | Depois |
|---|---|---|
| `config.classes` | 12 entradas, fonte `srd-2024` | 13 entradas — 12 de `srd-2014`, 1 (`marshal`) de `a5e-ag` |
| `config.classFeatures.marshal` | inexistente | `SystemClassFeature[]`, nível 1, `source: 'a5e-ag'` |
| `config.startingKits.marshal` | inexistente | formato a confirmar (ver *Notas de implementação*) |

**Persistência:** mesmo artefato `srd-5e.config.<locale>.json` — sem migração de schema, sem coluna nova. Fichas existentes não têm `class = 'marshal'` (classe nova); nenhuma migração de dado necessária.

---

## Critérios de aceite

- [ ] `CLASS_MAP` aponta as 12 classes SRD para `srd-2014`; `config.classes` tem **13** entradas (12 SRD + Marshal).
- [ ] `config.classFeatures.marshal` tem as features de nível 1 do Marshal (proficiência/tabela excluídas, mesmo corte das 12 classes SRD), `source: 'a5e-ag'`.
- [ ] `config.startingKits.marshal` existe e é consumível por `getStartingInventory` sem lançar, no formato que a inspeção do dataset real definir.
- [ ] As três subclasses do Marshal **não** aparecem em `config.classes` nem em `config.classFeatures` (mesmo filtro de subclasse das 12 SRD).
- [ ] `NOTICE-open5e.md` cita `a5e-ag` como fonte também de classe, não só de background.
- [ ] O wizard oferece "Marshal" no select de classe, sem mudança de código no componente (a lista já vem do `config`).
- [ ] Personagem `class: 'marshal'` passa pela mesma validação contra catálogo da US-105 (`BadRequestException` se a chave não existisse — aqui ela existe).
- [ ] `SystemConfigSchema` continua validando sem mudança de schema (reuso de `SystemClassFeatureSchema`).
- [ ] **Eval / teste de regressão:** `ingest.test.mjs` cobre `CLASS_MAP`/`buildClassFeatures`/`buildStartingKits` para `marshal` com fixture sintética, e confirma que as 12 classes SRD saem com o `pk` do 5.1. `character.service.test.ts` cobre criação de personagem `class: 'marshal'` — kit, features e prompt do mestre não lançam.

---

## Notas de implementação

- **Meça `a5e-ag/ClassFeatureItem.json` e o `desc` de `a5e_marshal_starting-equipment` antes de escrever o parser.** O `feature_type: STARTING_EQUIPMENT` é um valor que o SRD não usa (lá é `CORE_TRAITS_TABLE` com uma linha de tabela markdown, US-51) — o formato do texto pode ser prosa direta, lista, ou outra tabela. Não assuma que `parseStartingKit` reusa sem adaptação; **meça primeiro**, mesma disciplina que a US-51 e a US-121 aplicaram às fontes delas.
- **Confirme ausência de conjuração** — nenhuma entrada de `SpellCastingOption.json`/`Spell.json` referenciou `marshal` na inspeção de 15/08/2026, mas essa inspeção foi rápida (não filtrou por classe formalmente); confira antes de fechar `classSpells.marshal` como "não aplicável".
- **`CLASS_SYNONYMS`** ([`starting-inventory.ts:29`](../../../apps/api/src/character/starting-inventory.ts)) não precisa de entrada para `marshal` — desde a US-105, a classe é selecionada por chave do catálogo, não por texto livre; o matcher só serve migração legada (US-105 *Questões em aberto* #3), e não há ficha legada com "Marshal" para migrar.
- **`pnpm srd:sync` antes de `pnpm srd:ingest`**, ordem padrão (US-47); revise o diff dos dois artefatos — o de `en-US` deve ganhar a classe inteira, o de `pt-BR` com rascunho `_mt` até curadoria.

---

## Questões em aberto

1. **O label pt-BR de "Marshal" é tradução ("Marechal") ou mantém o nome em inglês?** Nenhum precedente direto — as 21 labels de background (US-121) mantiveram nome próprio em inglês (`Acolyte`, não traduzido); classes SRD sempre tiveram tradução (`Bárbaro`). Marshal está mais perto de nome de classe (traduzível) que de background (nome próprio-ish). Sugestão: traduzir, mesmo padrão das 12 classes SRD — mas cabe a quem curar o overlay decidir.

---

## Referências no código

- [scripts/srd/ingest.mjs:34](../../../scripts/srd/ingest.mjs:34) — `CLASS_MAP`, onde a troca de prefixo e a entrada nova entram.
- [scripts/srd/sync.mjs](../../../scripts/srd/sync.mjs) — `A5E_AG`, já define o documento; falta somar `CharacterClass.json`/`ClassFeature.json`/`ClassFeatureItem.json` à lista de arquivos baixados dele.
- [scripts/srd/NOTICE-open5e.md](../../../scripts/srd/NOTICE-open5e.md) — parágrafo do `a5e-ag`, a estender de "backgrounds" para "backgrounds e classes".
- [apps/api/src/character/starting-inventory.ts:29](../../../apps/api/src/character/starting-inventory.ts) — `CLASS_SYNONYMS`, sem mudança nesta story (ver *Notas de implementação*).
- [docs/adr/009-uniao-dos-srd-5-1-e-5-2.md](../../adr/009-uniao-dos-srd-5-1-e-5-2.md) §8 — a decisão que esta story implementa.
- [US-105](./US-105-raca-e-classe-por-chave-do-srd.md) — `CLASS_MAP`/`buildClassFeatures`/`buildStartingKits` originais, estendidos aqui.
- [US-121](./US-121-catalogo-backgrounds-a5e-adventurers-guide.md) — precedente de licença e atribuição do `a5e-ag`, reusado sem mudança.
- [US-51](./US-51-kits-iniciais-do-srd.md) — `parseStartingKit`, ponto de partida (com adaptação a confirmar) para o kit do Marshal.
