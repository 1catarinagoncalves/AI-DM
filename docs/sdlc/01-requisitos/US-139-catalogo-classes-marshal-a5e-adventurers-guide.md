# US-139 — Catálogo de classes com o SRD 5.1 como referência, e o Marshal do A5E Adventurer's Guide

**Épico:** 1 — Personagem
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** [US-105](./US-105-raca-e-classe-por-chave-do-srd.md) (**obrigatória e anterior**: constrói o `CLASS_MAP`/`buildClassFeatures`/`buildClassSpells` que esta story estende) · [ADR 009 §8](../../adr/009-uniao-dos-srd-5-1-e-5-2.md) (a decisão que esta story implementa: SRD 5.1 como referência, `a5e-ag` em escopo) · [US-121](./US-121-catalogo-backgrounds-a5e-adventurers-guide.md) (precedente direto: primeiro dado do `a5e-ag`, licença CC-BY-4.0 já resolvida e atribuída)
**Relacionado:** [ADR 004 §3.3](../../adr/004-origem-do-dado-de-sistema.md) (regra de licença única, segundo publisher) · [US-41](./US-41-features-traits-de-classe.md) (`SystemClassFeatureSchema`, reusado sem alteração) · [US-51](./US-51-kits-iniciais-do-srd.md) (`parseStartingKit`, precedente de parser de equipamento inicial a partir de texto de feature) · [US-138](./US-138-catalogo-racas-srd-5-1-como-referencia.md) (mesma revisão de precedência aplicada a `races`, na mesma leva) · [US-141](./US-141-catalogo-subclasses-srd-5-1-e-marshal.md) (estende o `CLASS_MAP` desta story com subclasse, incluindo as 3 do Marshal excluídas aqui)
**Criada em:** 2026-08-15

---

## História

> **Como** desenvolvedora,
> **quero** que `config.classes` derive do SRD 5.1 como fonte de referência (revisando a precedência do ADR 009) e ganhe a classe **Marshal** do *Level Up: Advanced 5th Edition — Adventurer's Guide* (`a5e-ag`),
> **para que** o catálogo de classes siga o [ADR 009 §8](../../adr/009-uniao-dos-srd-5-1-e-5-2.md) e o jogador tenha, pela primeira vez, uma classe que não é uma das 12 do SRD.

---

## Contexto e motivação

### A parte barata: o catálogo (`CharacterClass.json`) já bate

O [ADR 009 §4](../../adr/009-uniao-dos-srd-5-1-e-5-2.md) mediu, em 02/08/2026, que `CharacterClass` (base) tem **12 em cada edição, todas idênticas** — nenhuma diferença de conteúdo entre 5.1 e 5.2 nas 12 classes centrais. Trocar a fonte de `config.classes` (**quais** classes existem, com que nome) é só apontar o `CLASS_MAP` ([`ingest.mjs:34`](../../../scripts/srd/ingest.mjs:34)) para o `pk` do `srd-2014` — confirmado em 15/08/2026: `srd-2014/CharacterClass.json` tem 12 bases, `pk` no formato `srd_barbarian` (mesmo padrão de `Species.2014.json`, US-105).

### A parte que não é barata: `classFeatures` e `classSpells` são 100% 5.2 hoje, e divergem de verdade

`buildRaces` (US-105) já funde `srd-2024`+`srd-2014`. `buildClassFeatures` e `buildClassSpells` **não** — o comentário do próprio `sync.mjs` já avisava isso (*"as 12 classes base são idênticas… e feature/magia entram quando a story delas passar pela fusão"*, [`sync.mjs:29-32`](../../../scripts/srd/sync.mjs:29)). Conferido no código em 15/08/2026: `main()` ([`ingest.mjs:770`](../../../scripts/srd/ingest.mjs:770)) carrega `ClassFeature.json`, `ClassFeatureItem.json` e `Spell.json` **uma vez só**, do `srd-2024` — não existe `ClassFeature.2014.json` nem `Spell.2014.json` em lugar nenhum do pipeline. Diferente de `races`, aqui não há fusão para inverter: é uma fonte única, e essa fonte é o 5.2.

E ao contrário das 12 classes-catálogo, aqui o conteúdo **diverge de verdade** — é exatamente o que o [ADR 004 §4](../../adr/004-origem-do-dado-de-sistema.md) documentou como "a descoberta que só apareceu cutucando o dataset": Paladino não ganha *Divine Sense* no nível 1 no 5.2 (ganha *Lay On Hands* + *Weapon Mastery*), Patrulheiro perdeu *Natural Explorer*, e o 5.2 introduziu features que o 5.1 não tem (*Weapon Mastery*, *Ritual Adept*, *Divine Order*, *Primal Order*, *Innate Sorcery*, *Eldritch Invocations*). Medido fresco em 15/08/2026, no dataset bruto (antes do filtro `isNoise`/`isSpellEngine` do `buildClassFeatures` — a tabela mede fonte, não artefato, mesma ressalva do ADR 009 §4):

| | 5.1 (`srd-2014`) | 5.2 (`srd-2024`) |
|---|---:|---:|
| `ClassFeatureItem` nível 1 | 62 | 78 |
| `Spell` nível ≤ 1 | 73 | 84 |

**Trocar a fonte para o 5.1 (ADR 009 §8, 5.2 totalmente fora) reverte essa "descoberta"**: as features e magias que o 5.2 tinha introduzido saem do artefato, as que o 5.1 tinha e o 5.2 cortou voltam. Isso desfaz, na prática, a resolução que o próprio [ADR 004 §4](../../adr/004-origem-do-dado-de-sistema.md) registrou em 03/08/2026 ("*o dataset manda* (fidelidade ao 5.2)") — essa resolução falava do 5.2 como dataset de referência; o [ADR 009 §8](../../adr/009-uniao-dos-srd-5-1-e-5-2.md) mudou qual é a referência, e o conteúdo segue a nova regra. Esta story registra essa reversão nos dois ADRs (ver §Escopo).

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

O `CLASS_MAP` é um mapa único de `pk` → chave canônica, consultado por `buildClasses`, `buildClassFeatures`, `buildClassSpells` e `buildStartingKits` ([ADR 004 §3.2](../../adr/004-origem-do-dado-de-sistema.md)). Adicionar `a5e_marshal → marshal` ao mesmo mapa que passa a apontar `srd_*` (5.1) em vez de `srd-2024_*` (5.2) para as 12 classes SRD é uma edição no mesmo arquivo, no mesmo formato — separar em duas stories duplicaria o "onde mexer" sem separar risco de verdade. A troca de fonte de `classFeatures`/`classSpells` (acima) é maior em consequência, mas mexe no mesmo trio de funções (`buildClassFeatures`, `buildClassSpells`, `main()`) que a entrada do Marshal também toca — continuam sendo uma story só.

---

## Escopo

### Dentro do escopo

- **`CLASS_MAP`** ([`ingest.mjs:34`](../../../scripts/srd/ingest.mjs:34)): as 12 entradas SRD passam a apontar para o `pk` do `srd-2014` (`srd_barbarian`, não `srd-2024_barbarian`); ganha a 13ª entrada, `a5e_marshal → marshal`.
- **`sync.mjs`**: soma três arquivos novos do `srd-2014` — `ClassFeature.2014.json`, `ClassFeatureItem.2014.json`, `Spell.2014.json` — ao lado do `Species.2014.json` que já existe (mesmo padrão de sufixo). E baixa `en-publishing/a5e-ag/CharacterClass.json` + `ClassFeature.json`/`ClassFeatureItem.json`, ao lado do par que `Background`/`BackgroundBenefit` já usa.
- **`ingest.mjs` `main()`** ([`:770`](../../../scripts/srd/ingest.mjs:770)): carrega os três arquivos novos do 5.1; `buildConfig` (`:740`) passa a chamar `buildClassFeatures`/`buildClassSpells` com o dataset do **5.1**, não mais o do 5.2 — troca de fonte, não união (mesma decisão da US-138 para `races`: 5.2 sai por completo, sem preencher lacuna).
- **`buildClassFeatures`**: os dados de entrada (`features`, `featureItems`) passam a ser os do `srd-2014`, **e** ganham as 34 entradas de `a5e-ag/ClassFeature.json` com `parent = 'a5e_marshal'` — nível 1, excluindo `feature_type` de tabela/proficiência (`CLASS_TABLE_DATA`, `PROFICIENCY_BONUS`, `PROFICIENCIES`), mesmo corte que já aplica às 12 classes SRD. `config.classFeatures.marshal` fica com `source: 'a5e-ag'`; as 12 classes SRD passam a ter `source: 'srd'` derivado do 5.1 (campo `source` não muda de valor, só a proveniência real).
- **`buildClassSpells`**: passa a ler `Spell.2014.json` para as 12 classes SRD. O `slug = String(s.pk).replace(/^srd-2024_/, '')` ([`ingest.mjs:294`](../../../scripts/srd/ingest.mjs:294)) precisa virar `replace(/^srd_/, '')` (ou um `stripDocument` genérico, se já existir um no arquivo — conferir antes de duplicar).
- **`buildStartingKits`**: `a5e_marshal_starting-equipment` (`feature_type: STARTING_EQUIPMENT`) alimenta `config.startingKits.marshal` — **o formato do texto pode não ser o de `parseStartingKit`** (US-51 foi escrito para o `CORE_TRAITS_TABLE` do SRD); inspecionar o `desc` real após o `sync` antes de decidir se reusa o parser ou precisa de um variante (ver *Notas de implementação*). O kit das 12 classes SRD também troca de fonte (`CORE_TRAITS_TABLE` do 5.1 em vez do 5.2) — conferir se o texto da tabela diverge entre edições antes de assumir que o parser existente cobre sem ajuste.
- **`NOTICE-open5e.md`**: o parágrafo que já atribui `a5e-ag` (US-121, escopado a "backgrounds") passa a dizer também "classes"; o parágrafo do SRD passa a descrever `classFeatures`/`classSpells` como vindos do 5.1, não mais do 5.2.
- **`classes`/`classFeatures`/`startingKits` entram em `MT_DOMAINS`** para `marshal` — já estão (US-105/US-51), só a entrada nova soma volume, sem mudança de mecanismo.
- **Wizard / criação de personagem**: `marshal` aparece no `select` de classe assim que `config.classes` o lista — nenhuma mudança de código no `SetupWizard`, porque a lista já vem do `config` (US-105).
- **Migração de fichas existentes com feature/magia exclusiva do 5.2** (`weapon-mastery`, `ritual-adept`, `divine-order`, `primal-order`, `innate-sorcery`, `eldritch-invocations`, e qualquer magia nível ≤1 só do 5.2) — essas chaves saem de `config.classFeatures`/`config.classSpells`. Mesma classe de problema que a US-138 já trata para `race = 'goliath'/'orc'`: contar fichas afetadas antes de decidir o tratamento (ver *Notas de implementação*).
- **Teste em `ingest.test.mjs`**: `buildClasses`/`buildClassFeatures`/`buildClassSpells`/`buildStartingKits` com fixture sintética para `a5e_marshal` (feature presente, tabela/proficiência excluída) e para as 12 classes SRD confirmando que a origem virou `srd-2014` em todos os três domínios, não só no catálogo.
- **[ADR 004](../../adr/004-origem-do-dado-de-sistema.md)**: §2 passa a registrar `System.version` `'5.1'` (era `'5.2'`, ver *Questões em aberto* #2); §4 ganha nota datada revertendo "*o dataset manda* (fidelidade ao 5.2)" para `classFeatures`/`classSpells` — mesmo padrão dos blockquotes de atualização já usados em §2 (02/08 e 15/08/2026).
- **[ADR 009 §8](../../adr/009-uniao-dos-srd-5-1-e-5-2.md)**: responde as duas primeiras perguntas de "O que fica em aberto" — `System.version` vira `'5.1'`; a precedência deixa de ser "5.1 vence, 5.2 preenche buraco" (D2) — o 5.2 sai por completo, o 5.1 vira única fonte WotC consultada, sem fallback. D2/D5 ganham nota de revisão apontando para esta story e para a [US-138](./US-138-catalogo-racas-srd-5-1-como-referencia.md) (mesma decisão, aplicada junto a `races`). A terceira pergunta em aberto (licença de `a5e-ddg`/`a5e-gpg`/Spells That Don't Suck) não é tocada aqui.
- **`apps/api/prisma/seed.ts:132,136`**: os dois literais `version: '5.2'` viram `'5.1'` — é o valor que o `System.version` grava de verdade no banco (D&D e Free). Sem esta troca, o ADR passaria a documentar `'5.1'` como decisão enquanto o seed continua gravando `'5.2'` — mesmo defeito que a ausência do arquivo do §Escopo original teria deixado passar.
- **`mergeEditions`/`SRD_EQUIVALENTS`** ([`ingest.mjs:96`](../../../scripts/srd/ingest.mjs:96), [`ingest.mjs:107`](../../../scripts/srd/ingest.mjs:107)): removidos. `buildRaces` (US-138) já não chama `mergeEditions` — vira single-source só de `srd-2014`; esta story faz o mesmo em `classFeatures`/`classSpells` ("troca de fonte, não união", acima). Depois desta story, nenhum domínio de produção funde edição — a função só sobrevivia em teste. `ingest.test.mjs` perde os três casos de `mergeEditions` ([`ingest.test.mjs:49-66`](../../../scripts/srd/ingest.test.mjs:49)).

### Fora do escopo

- **As três subclasses do Marshal** (`Gambling General`, `Swift Strategist`, `Talented Tactician`) — mesmo filtro `subclass_of !== null` que já exclui subclasse das 12 classes SRD. Marshal entra como classe base sem escolha de subclasse na criação (mesmo corte que as 12 SRD têm hoje — subclasse não é escolhida na criação, US-41).
- **As outras 11 classes do A5E** (Berserker, Champion…) — não modeladas no `a5e-ag/CharacterClass.json` (medido, ver §Contexto); não há dataset a importar.
- **Magia do Marshal**, se o `sync` revelar que a classe tem alguma forma de conjuração — vira *Questão em aberto* nova se acontecer; a hipótese de trabalho é classe não-conjuradora (ver §Contexto).
- **Kit/gancho de aventura inicial específico do Marshal** (`getStartingHook`, `resolveInitialHook`) além do equipamento — mesmo corte que classes SRD já têm hoje (`resolveInitialHook` usa `default` para classe fora do mapa; `marshal` passa a ter `startingKits` próprio, mas gancho de aventura customizado é decisão de conteúdo separada).
- **Catálogo de raças** — é a [US-138](./US-138-catalogo-racas-srd-5-1-como-referencia.md), mesma revisão de precedência, dataset diferente.
- **União/fallback com o 5.2** para `classFeatures`/`classSpells` — não existe. Uma vez trocada a fonte, o 5.2 não é consultado nem para preencher lacuna (mesma decisão da US-138 para `races`).
- **Terceira pergunta em aberto do ADR 009 §8** (licença de `a5e-ddg`/`a5e-gpg`/Spells That Don't Suck) — nenhum dos três é tocado por esta story; continua candidato para a story que os ligar.

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
| `config.classFeatures.<12 classes SRD>` | fonte `srd-2024` (78 itens nível 1 no dataset bruto) | fonte `srd-2014` (62 itens nível 1 no dataset bruto) — perde *Weapon Mastery*, *Ritual Adept*, *Divine Order*, *Primal Order*, *Innate Sorcery*, *Eldritch Invocations*; recupera *Divine Sense* (Paladino), *Natural Explorer* (Patrulheiro) |
| `config.classFeatures.marshal` | inexistente | `SystemClassFeature[]`, nível 1, `source: 'a5e-ag'` |
| `config.classSpells.<12 classes SRD>` | fonte `srd-2024` (84 magias nível ≤1 no dataset bruto) | fonte `srd-2014` (73 magias nível ≤1 no dataset bruto) |
| `config.startingKits.marshal` | inexistente | formato a confirmar (ver *Notas de implementação*) |
| `config.startingKits.<12 classes SRD>` | texto de `CORE_TRAITS_TABLE` do `srd-2024` | texto do mesmo campo no `srd-2014` — conferir divergência antes de assumir igual |

**Persistência:** mesmo artefato `srd-5e.config.<locale>.json` — sem migração de schema, sem coluna nova. Fichas existentes não têm `class = 'marshal'` (classe nova); nenhuma migração de dado necessária.

---

## Critérios de aceite

- [x] `CLASS_MAP` aponta as 12 classes SRD para `srd-2014`; `config.classes` tem **13** entradas (12 SRD + Marshal).
- [x] `config.classFeatures` das 12 classes SRD vem do `srd-2014` — `weapon-mastery`, `ritual-adept`, `divine-order`, `primal-order`, `innate-sorcery`, `eldritch-invocations` **não** aparecem; `paladin_divine-sense` e `ranger_natural-explorer` **voltam**.
- [x] `config.classSpells` das 12 classes SRD vem do `Spell.2014.json` — teste que falha se alguma entrada carregar o prefixo `srd-2024_`.
- [x] `config.classFeatures.marshal` tem as features de nível 1 do Marshal (proficiência/tabela excluídas, mesmo corte das 12 classes SRD), `source: 'a5e-ag'`.
- [x] `config.startingKits.marshal` existe e é consumível por `getStartingInventory` sem lançar, no formato que a inspeção do dataset real definiu.
- [x] `config.startingKits` das 12 classes SRD vem do `srd-2014` (mesma checagem de divergência de texto que a *Nota de implementação* pede).
- [x] As três subclasses do Marshal **não** aparecem em `config.classes` nem em `config.classFeatures` (mesmo filtro de subclasse das 12 SRD).
- [x] `NOTICE-open5e.md` cita `a5e-ag` como fonte também de classe, não só de background; o parágrafo do SRD descreve `classFeatures`/`classSpells` como vindos do 5.1.
- [x] O wizard oferece "Marshal" no select de classe, sem mudança de código no componente (a lista já vem do `config`).
- [x] Personagem `class: 'marshal'` passa pela mesma validação contra catálogo da US-105 (`BadRequestException` se a chave não existisse — aqui ela existe).
- [x] Contagem de fichas existentes com feature/magia exclusiva do 5.2 (ver §Escopo) registrada, mesmo que zero — tratamento decidido e implementado se houver alguma, não descoberto em produção.
- [x] `SystemConfigSchema` continua validando sem mudança de schema (reuso de `SystemClassFeatureSchema`).
- [x] **Eval / teste de regressão:** `ingest.test.mjs` cobre `CLASS_MAP`/`buildClassFeatures`/`buildClassSpells`/`buildStartingKits` para `marshal` com fixture sintética, e confirma que as 12 classes SRD saem com dado do 5.1 nos três domínios. `character.service.test.ts` cobre criação de personagem `class: 'marshal'` — kit, features e prompt do mestre não lançam.
- [x] ADR 004 §2/§4 e ADR 009 §8/D2/D5 atualizados com nota datada: `System.version = '5.1'`, reversão da fidelidade ao 5.2 (`classFeatures`/`classSpells`), 5.2 fora de escopo sem fallback.

---

## Notas de implementação

- **Meça `a5e-ag/ClassFeatureItem.json` e o `desc` de `a5e_marshal_starting-equipment` antes de escrever o parser.** O `feature_type: STARTING_EQUIPMENT` é um valor que o SRD não usa (lá é `CORE_TRAITS_TABLE` com uma linha de tabela markdown, US-51) — o formato do texto pode ser prosa direta, lista, ou outra tabela. Não assuma que `parseStartingKit` reusa sem adaptação; **meça primeiro**, mesma disciplina que a US-51 e a US-121 aplicaram às fontes delas.
- **Confirme ausência de conjuração** — nenhuma entrada de `SpellCastingOption.json`/`Spell.json` referenciou `marshal` na inspeção de 15/08/2026, mas essa inspeção foi rápida (não filtrou por classe formalmente); confira antes de fechar `classSpells.marshal` como "não aplicável".
- **`CLASS_SYNONYMS`** ([`starting-inventory.ts:29`](../../../apps/api/src/character/starting-inventory.ts)) não precisa de entrada para `marshal` — desde a US-105, a classe é selecionada por chave do catálogo, não por texto livre; o matcher só serve migração legada (US-105 *Questões em aberto* #3), e não há ficha legada com "Marshal" para migrar.
- ~~Faça a contagem de fichas com feature/magia exclusiva do 5.2 antes de escrever o tratamento de migração.~~ **Feito em 15/08/2026: 2 de 4 fichas afetadas — as duas druidas.** Primeira tentativa de query filtrou `Character.features`/`.spells` por `->>'name'` assumindo `{name, description}[]` (o comentário do schema, desatualizado desde a US-100) e deu zero — **falso negativo**: o schema real, confirmado direto no banco, é `string[]` de CHAVE crua (`"druid_primal-order"`, `"elementalism"`), não objeto. Query corrigida (`jsonb_array_elements_text` + `IN (...)` contra as 10 chaves de feature e as 11 de magia genuinamente exclusivas do 5.2 — as outras 7 chaves órfãs de magia, `friends`/`thorn-whip`/`toll-the-dead`/`mind-sliver`/`thunderclap`/`blade-ward`/`word-of-radiance`, já eram órfãs ANTES desta story, sem par nem no 5.2 antigo — não contam, não é regressão desta troca) achou: **Yasmin Cattleya** (druid) — `druid_primal-order` + magias `elementalism`/`starry-wisp`/`ice-knife`; **Luvia Davenport** (druid) — magias `elementalism`/`starry-wisp`. `SELECT` via Neon MCP, projeto `purple-wave-53471231`, banco de dev/teste (4 personagens).
  **Tratamento: nenhum código novo — o mecanismo já existe (`withRetired`, US-100) e já rodou.** `pnpm srd:ingest` desta story leu o artefato ANTERIOR (commit `973835a`) antes de sobrescrever; toda chave que sumiu do bump foi transportada pra `retiredFeatures`/`retiredSpells` do artefato novo — confirmado no `srd-5e.config.en-US.json` gerado: as 10 chaves de feature e as 11 de magia exclusivas do 5.2 estão todas lá, com os dois locales. A leitura (`resolveSheetEntries` em `ai.service.ts`, `adventure.service.ts`, `SetupWizard.tsx`, `play/[adventureId]/page.tsx`) já consulta `config.retiredSpells`/`retiredFeatures` como fallback antes de cair no `{key, name: key}` cru — as duas fichas continuam exibindo o nome/descrição corretos, sem crash, sem edição manual. Pendência real: isso só chega à produção quando o `seed.ts` rodar de novo contra o Neon prod com o artefato novo (fora do escopo de código desta story — é deploy).
- **Os 62 itens do `srd-2014` / 78 do `srd-2024` são contagem de dataset bruto (`ClassFeatureItem` nível 1), não de feature única** — `buildClassFeatures` deduplica por `parent`+slug e filtra ruído (`isNoise`/`isSpellEngine`); o número final por classe só se confirma rodando o `ingest` de verdade. Não trate os números desta story como critério de aceite exato — o critério é qualitativo (quais chaves aparecem/somem), não a contagem bruta.
- **`pnpm srd:sync` antes de `pnpm srd:ingest`**, ordem padrão (US-47); revise o diff dos dois artefatos — o de `en-US` deve ganhar a classe inteira mais o conteúdo revertido para 5.1, o de `pt-BR` com rascunho `_mt` até curadoria (o overlay pt-BR atual foi curado em cima de texto 5.2 — `paladino_lay-on-hands` etc. — conferir quais chaves ficam órfãs e quais precisam de tradução nova).
- **`main()` combina os arrays antes de repassar, sem mudar assinatura de função nenhuma.** `features`/`featureItems` viram `[...features2014, ...marshalFeatures]` / `[...featureItems2014, ...marshalFeatureItems]`, montados no próprio `main()` antes de chamar `buildConfig`. `buildClassFeatures`/`buildStartingKits` já filtram por `CLASS_MAP[parent]` ([`ingest.mjs:274`](../../../scripts/srd/ingest.mjs:274)) — o Marshal entra pelo mesmo mecanismo que as 12 SRD, sem lógica nova nem parâmetro novo.
- ~~`isNoise` não precisa de filtro por `feature_type`~~ **Revisado após medir o `a5e-ag/ClassFeature.json` real (15/08/2026): precisou de UM ajuste, não do que a nota anterior previa.** O 5.1 (`srd-2014`) confirma a previsão — `PROFICIENCY_BONUS`/`CLASS_TABLE_DATA` vêm com `desc: '[Column data]'`, igual ao 5.2, filtro de texto já cobre. O a5e-ag **não**: `a5e_marshal_proficiency-bonus`/`a5e_marshal_commanding-presence-range` (mesmos dois `feature_type`) vêm com `desc: ''` (string vazia), não `'[Column data]'` — sem ajuste, vazavam pro artefato. Fix aplicado foi mais simples que checar `feature_type`: `isNoise` passou a tratar `desc` vazio como ruído também (`d === '' || d === '[Column data]'`), única checagem, cobre as duas fontes — não precisou de `NOISE_FEATURE_TYPES` nem checar o campo. `a5e_marshal_proficiencies` (o `PROFICIENCIES` citado acima) nem chega a `isNoise`: não tem featureItem de nível 1, cai fora antes, pelo mesmo filtro que já exclui tabela/proficiência das 12 SRD.
- **Achado fora do escopo original: `feature_type` do kit inicial também mudou, nas 12 SRD, não só no Marshal.** O 5.1 usa `STARTING_EQUIPMENT` (não `CORE_TRAITS_TABLE` do 5.2) com texto em prosa/bullets (`(*a*) X or (*b*) Y`), igual ao a5e-ag — `parseStartingKit`/`startingEquipmentCell` (parser de tabela) não liam nem um nem outro; quebrariam nas 12 classes SRD, não só no Marshal, se reusados sem adaptação. Removidos (junto com `PDF_SPLITS`, que só eles usavam) e substituídos por dois parsers novos escolhidos por `fields.document`: `parseSrdEquipmentBullets` (bullets aditivos, `srd-2014`) e `parseA5ePackageEquipment` (pacotes alternativos inteiros, `a5e-ag`) — ambos reusam `toKitItem`. Conteúdo do kit MUDOU pras 12 classes (não só a fonte): "opção A" do 5.1 escolhe itens diferentes da tabela do 5.2 (ex.: mago sai com Quarterstaff em vez de Dagger×2) — reversão de conteúdo, mesma categoria do que já acontecia em features/magias, só que a story original não previu isso pra kit.
- **Consequência de conteúdo: `locale/pt-BR.json` → `kitItems` ficou com ~57 chaves órfãs/sem tradução.** O texto cru do equipamento inicial mudou de forma (linha de tabela → prosa) nas 13 classes — as traduções curadas pro formato antigo (`Greataxe`, `Chain Mail`…) não casam com as chaves novas (`a greataxe`, `chain mail`…). `kitItems` não é `MT_DOMAINS` (mesma decisão da US-134 pra `tools`: "curadoria manual, grande demais pra uma sentada só") — não ganha rascunho automático. Pendência de curadoria registrada, não bloqueia build normal (só `--strict`); ver nota no teste `ingest.test.mjs` ("artefato: en-US traz o kit em inglês").

---

## Questões em aberto

1. ~~O label pt-BR de "Marshal" é tradução ("Marechal") ou mantém o nome em inglês?~~ **Decidido: traduzir para "Marechal"**, mesmo padrão das 12 classes SRD (`Bárbaro`, `Paladino`…) — diferente das 21 labels de background (US-121), que mantiveram nome próprio em inglês (`Acolyte`).
2. ~~`System.version` continua `'5.2'`?~~ **Decidido: `'5.1'`.** Com `races` (US-138), `classFeatures` e `classSpells` todos vindos do 5.1 depois desta leva, resta só o texto normativo de `Rule.json`/`ability-modifiers.srd-2024.json` (US-108/US-110, fora do escopo das duas stories) ainda ancorado no 5.2 — campo sem consumidor hoje (US-105 §6g), não bloqueia. Decisão vale para as duas stories (US-138 e esta).

---

## Referências no código

- [scripts/srd/ingest.mjs:34](../../../scripts/srd/ingest.mjs:34) — `CLASS_MAP`, onde a troca de prefixo e a entrada nova entram.
- [scripts/srd/ingest.mjs:260](../../../scripts/srd/ingest.mjs:260) — `buildClassFeatures`, onde a fonte (`features`/`featureItems`) troca de 2024 para 2014 e o Marshal entra.
- [scripts/srd/ingest.mjs:290](../../../scripts/srd/ingest.mjs:290) — `buildClassSpells`, onde a fonte troca e o `replace(/^srd-2024_/, '')` precisa virar `srd_`.
- [scripts/srd/ingest.mjs:740](../../../scripts/srd/ingest.mjs:740) e [:770](../../../scripts/srd/ingest.mjs:770) — `buildConfig`/`main()`, onde os três arquivos novos do 5.1 são carregados e repassados.
- [scripts/srd/sync.mjs:29-52](../../../scripts/srd/sync.mjs:29) — comentário que já registrava "feature/magia entram quando a story delas passar pela fusão" — esta é essa story; `FILES`, onde `ClassFeature.2014.json`/`ClassFeatureItem.2014.json`/`Spell.2014.json` e os três arquivos do `a5e-ag` (`CharacterClass`, `ClassFeature`, `ClassFeatureItem`) entram.
- [scripts/srd/NOTICE-open5e.md](../../../scripts/srd/NOTICE-open5e.md) — parágrafo do `a5e-ag`, a estender de "backgrounds" para "backgrounds e classes"; parágrafo do SRD, a atualizar para descrever `classFeatures`/`classSpells` como 5.1.
- [apps/api/prisma/seed.ts:132,136](../../../apps/api/prisma/seed.ts:132) — `version: '5.2'` → `'5.1'`, os dois literais que gravam `System.version` de verdade (D&D e Free).
- [scripts/srd/ingest.mjs:96](../../../scripts/srd/ingest.mjs:96) e [:107](../../../scripts/srd/ingest.mjs:107) — `SRD_EQUIVALENTS`/`mergeEditions`, removidos: esta story é quem mata o último caller de produção (depois de `buildRaces`, US-138, já ter parado de chamar).
- [docs/adr/004-origem-do-dado-de-sistema.md](../../adr/004-origem-do-dado-de-sistema.md) §2/§4 — `System.version` e "o dataset manda (fidelidade ao 5.2)", ambos atualizados por esta story (ver §Escopo).
- [apps/api/src/character/starting-inventory.ts:29](../../../apps/api/src/character/starting-inventory.ts) — `CLASS_SYNONYMS`, sem mudança nesta story (ver *Notas de implementação*).
- [docs/adr/009-uniao-dos-srd-5-1-e-5-2.md](../../adr/009-uniao-dos-srd-5-1-e-5-2.md) §8/D2/D5 — a decisão que esta story implementa; §8 "O que fica em aberto" e D2/D5 atualizados por esta story (ver §Escopo).
- [US-105](./US-105-raca-e-classe-por-chave-do-srd.md) — `CLASS_MAP`/`buildClassFeatures`/`buildStartingKits` originais, estendidos aqui.
- [US-121](./US-121-catalogo-backgrounds-a5e-adventurers-guide.md) — precedente de licença e atribuição do `a5e-ag`, reusado sem mudança.
- [US-51](./US-51-kits-iniciais-do-srd.md) — `parseStartingKit`, ponto de partida (com adaptação a confirmar) para o kit do Marshal.
