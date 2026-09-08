# US-221 — Proficiências de arma, armadura e ferramenta por classe

**Épico:** 1 — Personagem
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** [US-105](./US-105-raca-e-classe-por-chave-do-srd.md) (`CLASS_MAP`/`buildClasses` — base que esta story estende) · [US-41](./US-41-features-traits-de-classe.md) (`buildClassFeatures`/`getClassFeatures` — hoje inclui a feature `<classe>_proficiencies` como texto cru, que esta story substitui) · [US-134](./US-134-catalogo-de-ferramentas-do-sistema.md) (`config.tools[].category` — pool de escolha de ferramenta desta story lê essa categoria) · [US-215](./US-215-proficiencias-de-arma-e-ferramenta-fixa-de-raca.md) (`Character.tools`/`Character.weapons`, `config.weapons` — precedente direto do par fixo/escolha e do merge no array) · [US-220](./US-220-pericias-proficientes-por-raca.md) (`RACE_SKILL_PROFICIENCY_CHOICES` — precedente do padrão "N à escolha de um pool", e o mesmo tipo de lacuna: traço já existe como texto awareness, nunca virou mecânica)
**Relacionado:** [US-209](./US-209-hit-dice-e-salvaguardas-de-classe-no-config.md) (também estende `ClassCatalogEntrySchema`/`buildClasses` — landing em paralelo colide no mesmo arquivo; ver §Notas de implementação) · [backlog-classe-de-armadura-e-ataque.md](./backlog-classe-de-armadura-e-ataque.md) (futuro consumidor: penalidade de armadura/arma sem proficiência exige exatamente este dado — bloqueado lá por falta de catálogo de item de armadura, D1)
**Criada em:** 2026-09-08

---

## História

> **Como** jogador,
> **quero** ver na minha ficha em quais armaduras, armas e ferramentas minha classe me torna proficiente,
> **para que** eu saiba o que posso vestir/empunhar sem penalidade e quais ferramentas eu sei usar — hoje essa informação existe só como bloco de texto cru, sem formatação, dentro da aba de traços.

---

## Contexto e motivação

### O dado já está no dataset — como PROSA, nunca estruturado

`scripts/srd/_data/ClassFeature.json` traz, para cada uma das 13 classes base (as 12 do `srd-2014` + `a5e_marshal`), uma feature de nível 1 chamada **"Proficiencies"** (`feature_type: "PROFICIENCIES"`) com `desc` em Markdown regular. Medido em 2026-09-08, as 13 entradas:

| Classe (`pk` sem prefixo) | Armadura | Arma | Ferramenta |
|---|---|---|---|
| `barbarian` | Leve, média, escudos | Simples, marciais | Nenhuma |
| `bard` | Leve | Simples + besta de mão, espada longa, rapieira, espada curta | **3 instrumentos musicais à escolha** |
| `cleric` | Leve, média, escudos | Simples | Nenhuma |
| `druid` | Leve, média, escudos (nota: "não de metal") | Lista nomeada (clava, adaga, dardo, azagaia, maça, bordão, cimitarra, foice, funda, lança) — **sem** categoria "simples" | Kit de herbalismo (fixa) |
| `fighter` | **Todas**, escudos | Simples, marciais | Nenhuma |
| `monk` | Nenhuma | Simples + espada curta | **1 ferramenta de artesão OU 1 instrumento musical, à escolha** |
| `paladin` | **Todas**, escudos | Simples, marciais | Nenhuma |
| `ranger` | Leve, média, escudos | Simples, marciais | Nenhuma |
| `rogue` | Leve | Simples + besta de mão, espada longa, rapieira, espada curta | Ferramentas de ladrão (fixa) |
| `sorcerer` | Nenhuma | Lista nomeada (adaga, dardo, funda, bordão, besta leve) — sem categoria | Nenhuma |
| `warlock` | Leve | Simples | Nenhuma |
| `wizard` | Nenhuma | Lista nomeada (mesma do sorcerer) — sem categoria | Nenhuma |
| `marshal` (a5e-ag) | Leve, média, **pesada**, escudos | Simples, marciais | Nenhuma |

Essa feature já é ingerida por `buildClassFeatures` ([scripts/srd/ingest.mjs:438](../../../scripts/srd/ingest.mjs:438)) — o filtro `isNoise` só descarta `desc` vazio ou `[Column data]`, então "Proficiencies" passa — e chega a `Character.features` via `getClassFeatures` ([starting-kit.ts:133](../../../packages/shared/src/starting-kit.ts:133)). Só que ninguém faz *parse* do Markdown: `FeaturesPanel` ([FeaturesPanel.tsx:70](../../../apps/web/src/components/character/FeaturesPanel.tsx:70)) joga `f.description` cru num `<p>` — o jogador vê literalmente `**Armor:** All armor, shields\n**Weapons:** Simple weapons...` sem negrito, sem quebra de linha, com asteriscos visíveis. É a mesma lacuna que a US-142/US-220 encontraram para traço de raça (texto awareness, sem mecânica), só que aqui nem a EXIBIÇÃO está decente.

### Achado: não existe catálogo de categoria de arma/armadura no dataset

Diferente de US-215 (arma NOMEADA de raça, resolvida contra os 44 itens `category: 'weapon'` de `Item.json`), a categoria "Simple weapons"/"Martial weapons" **não tem campo correspondente** em `Item.json` — cada item de arma só tem `name`/`cost`/`weight`/`desc` (`"A longsword."`, sem dado de dano, propriedade, nem tag simples/marcial). Confirmado por leitura direta dos 44 itens (2026-09-08): nenhum campo `weapon_category`/`simple`/`martial`. Armadura é pior ainda: não existe `category: 'armor'` no dataset baixado, nenhum item de armadura ingerido — mesmo achado que o [backlog-classe-de-armadura-e-ataque.md](./backlog-classe-de-armadura-e-ataque.md) já registrou (D1, "sem chave canônica de item" de armadura).

Isso significa: **proficiência de categoria (simples/marcial, leve/média/pesada/escudo/todas) só pode ser texto/enum fechado — nunca um array de chaves de item**, porque não existe catálogo de item por trás dela. Já as listas NOMEADAS (druid, sorcerer, wizard, e o adicional de bard/monk/rogue) resolvem, sim, contra `config.weapons` (US-215) — as 15 armas citadas nessas listas (`longsword`, `shortsword`, `rapier`, `hand_crossbow`, `dagger`, `dart`, `sling`, `quarterstaff`, `light_crossbow`, `club`, `javelin`, `mace`, `scimitar`, `sickle`, `spear`) **todas existem** nos 44 itens `Item.json` com esse formato de chave (confirmado 2026-09-08).

### Ferramenta é o único dos três com pool de ESCOLHA — e o catálogo já existe

`config.tools[].category` (US-134) já classifica cada ferramenta em `artisan`/`musical-instrument`/`kit`/`vehicle`/chave própria. O texto do dataset usa exatamente essas categorias: bard escolhe 3 de `musical-instrument` (10 itens no catálogo), monk escolhe 1 de `artisan` ∪ `musical-instrument` (27 itens). Rogue (`thieves_tools`) e druid (`herbalism_kit`) são fixas, mesmo padrão de `RACE_TOOL_PROFICIENCIES`.

---

## Escopo

### Dentro do escopo

- **`buildClassProficiencies`** (novo, `scripts/srd/ingest.mjs`, ao lado de `buildClassFeatures`): faz *parse* do `desc` da feature `<classe>_proficiencies` (4 linhas `**Armor:**`/`**Weapons:**`/`**Tools:**`/o resto — `Saving Throws`/`Skills` já são US-131/US-209/US-207, ignorados aqui) em 3 campos estruturados:
  - `armorProficiencies: ('light'|'medium'|'heavy'|'shields'|'all')[]` — cada fragmento separado por vírgula casa contra uma tabela fixa de 5 rótulos (`"All armor"→'all'`, `"Light armor"→'light'`, etc.). Fragmento fora da tabela falha alto — mesmo padrão de erro alto de `CLASS_MAP`/`ABILITY_MAP`. O parêntese de ressalva do druid (`"(druids will not wear armor..."`) é descartado — texto de sabor, não modelado em nenhum outro traço da ficha (ver §Questões em aberto).
  - `weaponProficiencies: { categories: ('simple'|'martial')[], weapons: string[] }` — fragmento `"Simple weapons"`/`"Martial weapons"` vira categoria; qualquer outro fragmento (`"shortswords"`, `"hand crossbows"`, `"daggers"`...) é normalizado (plural→singular, espaço→`_`, minúsculo) e resolvido contra `config.weapons` já construído — chave inexistente falha alto.
  - `toolProficiencies: { fixed: string[], choice?: { count: number, categories: string[] } }` — `"None"` vira `{ fixed: [] }`. Nome próprio (`"Thieves' Tools"`, `"Herbalism kit"`) resolve contra `config.tools` por rótulo, igual ao `weapons` acima. `"N <tipo> de sua escolha"`/`"Choose one type of X or Y"` vira `choice: { count: N, categories: [...] }`, categorias batendo com `config.tools[].category`.
- **`ClassCatalogEntrySchema`** ([types/system.ts](../../../packages/shared/src/types/system.ts)) ganha os 3 campos acima, opcionais — mesmo padrão de extensão que US-209 propôs para `hitDice`/`savingThrows` (ver §Notas de implementação sobre landing em paralelo).
- **A feature `<classe>_proficiencies` para de entrar em `config.classFeatures`** — `buildClassFeatures` ganha um filtro (`feature_type !== 'PROFICIENCIES'`, o campo já vem em `f.fields.feature_type` conforme medido) para não duplicar a mesma informação em dois formatos (card de texto cru + seção estruturada nova). `retiredFeatures` ([US-100](./US-100-ficha-do-personagem-no-locale-ativo.md)) recebe a chave para ficha antiga que já persistiu essa feature continuar resolvendo.
- **Ficha — reaproveita as 3 seções flat que `GameView.tsx` já tem para arma/ferramenta/idioma de raça (US-215), não painel novo.** Design critique 2026-09-08: um componente `ProficienciesPanel`/cartão `rounded-md border` (estilo do `FeaturesPanel`, feito pra traço com descrição em prosa) seria padrão visual novo — arma/ferramenta/armadura de classe é rótulo só, sem prosa, exatamente a forma que raça já resolve. Concretamente:
  - **Seção "Armadura" nova** ([GameView.tsx:545-565](../../../apps/web/src/components/game/GameView.tsx:545), mesmo molde de `SheetHeading` + `<ul className="scrollbar-thin max-h-40 overflow-y-auto">` + `<li className="px-1.5 py-1 text-[13px]">` que as seções "Proficiências"/"Armas"/"Idiomas" já usam), condicional a `length > 0`, rótulo localizado por categoria (chave `sheet.proficiency.armor.<cat>`, PT-BR/EN).
  - **Seção "Armas" existente** ganha as chaves NOMEADAS de classe (druid/sorcerer/wizard, e o extra de bard/monk/rogue) **na mesma lista** que já mostra a arma fixa de raça (US-215) — fonte composta em `page.tsx` (`config.classes[classKey].weaponProficiencies.weapons` resolvido via `weaponLabel`, ao lado de `Character.weapons` resolvido via `catalogLabel`), sem que `Character.weapons` ganhe essas chaves (continua reservado à concessão de raça — ver §Fora do escopo). **Categoria pura (`Simples`/`Marcial`) NÃO entra na `<ul>` junto dos itens nomeados** — misturar rótulo de categoria (substantivo genérico) com nome de arma específica na mesma lista de bullets confunde o jogador (não dá pra saber se "Marcial" é um item ou um grupo). Categoria vai pro `SheetHeading` da própria seção, como sufixo: `t('game.weapons')` vira `"Armas — Marcial"`/`"Armas — Simples, Marcial"` (join por `, `) quando `categories.length > 0`; a `<ul>` abaixo do heading continua só com nomes resolvidos (arma de raça + nomeadas de classe). Bardo (`categories: ["simple"]`, 4 armas nomeadas) fica: heading `"Armas — Simples"`, lista com as 4 armas. Guerreiro (`categories: ["simple","martial"]`, `weapons: []`, sem arma de raça) fica: heading `"Armas — Simples, Marcial"`, lista vazia — a seção passa a renderizar com `categories.length > 0 || weapons.length > 0` (hoje é só `weapons.length > 0`; guerreiro/paladino/bárbaro/etc. não têm nenhuma arma nomeada, então sem esse ajuste a seção inteira some e a categoria nunca aparece). Classe sem categoria e sem nomeada (druid/sorcerer/wizard têm nomeada, mas nenhuma classe fica 100% sem as duas) mantém heading sem sufixo, como hoje.
  - **Seção "Proficiências" (tools) existente**: ferramenta FIXA/escolhida de classe soma direto em `Character.tools` (bullet de merge abaixo) — zero UI nova, mesmo comportamento do Tinker do gnomo (US-215).
  - **Revisão** ([SetupWizard.tsx:1602-1614](../../../apps/web/src/components/setup/SetupWizard.tsx:1602)): mesmo padrão `<dt>/<dd>` já usado por `setup.review.tools`/`setup.review.weapons` — linha nova `setup.review.armor`. `<dt>` de `setup.review.weapons` ganha o mesmo sufixo de categoria do heading da ficha (`"Armas — Simples, Marcial"`) quando a classe tiver `categories`; a `<dd>` (valores unidos por `·`) continua só com os nomes (arma de raça + nomeadas de classe), sem `<dl>` novo.
- **Ferramenta FIXA de classe** (rogue `thieves_tools`, druid `herbalism_kit`) soma a `Character.tools` incondicionalmente — nova constante lida do `config.classes[classKey].toolProficiencies.fixed`, somada na mesma linha de merge que já tem `raceTools`/`toolGrant` ([character.service.ts:151](../../../apps/api/src/character/character.service.ts:151)).
- **Ferramenta À ESCOLHA de classe** (bard 3, monk 1): campo novo `classToolChoice: string[]` no DTO, exigido apenas quando `config.classes[classKey].toolProficiencies.choice` existe, validado (contagem exata, cada chave em `config.tools` com `category` dentro de `choice.categories`, sem duplicata, sem colidir com ferramenta já concedida por raça/origem) — generalização de `validateCatalogKey` a N escolhas sobre um pool filtrado por categoria, mesmo desenho de `applyRaceSkillChoice` (US-220). Some ao merge de `tools` junto da fixa.
- **Etapa `tools` do wizard** ([SetupWizard.tsx:1340](../../../apps/web/src/components/setup/SetupWizard.tsx:1340), onde já existem slots `<select>` para `toolChoice` de origem): ganha slots adicionais para `classToolChoice` quando a classe escolhida tem `choice` — mesmo componente de slot, pool filtrado pela(s) categoria(s) da classe em vez do pool do background.
- **Testes:** `ingest.test.mjs` cobre o parser das 13 classes (categoria pura, lista nomeada, "None", fixa, e as 2 escolhas) mais as 2 falhas altas (fragmento de armadura/arma fora da tabela, nome de ferramenta sem match em `config.tools`); `character.service.test.ts` cobre bard/monk com `classToolChoice` válido e inválido (contagem errada, categoria errada, colisão com ferramenta de origem), e uma classe sem escolha (fighter) sem exigir o campo.

### Fora do escopo

- **Penalidade mecânica por falta de proficiência** (desvantagem em ataque com arma não-proficiente, sem somar bônus de proficiência à CA com armadura não-proficiente, regra 2024). Esta story só EXIBE o dado; aplicar penalidade em rolagem é o [backlog-classe-de-armadura-e-ataque.md](./backlog-classe-de-armadura-e-ataque.md), hoje bloqueado por falta de catálogo de item de armadura (D1) — que esta story também não resolve.
- **Expandir categoria em itens individuais.** A categoria "marcial" de um Guerreiro **não** vira 20+ chaves em `Character.weapons` — `Character.weapons` continua reservado para arma NOMEADA (US-215: concessão de raça). Categoria de classe mora só em `config.classes[].weaponProficiencies.categories`, lida na hora de renderizar a ficha, nunca mesclada no array.
- **Subclasses.** "Bonus Proficiencies" de subclasse (ex. `srd_college-of-lore_bonus-proficiencies`) é feature de nível ≥2, fora do recorte "nível 1, classe base" que `buildClassFeatures`/esta story herdam — mesmo corte que US-209 já fez para `hitDice`/`savingThrows` de subclasse.
- **Ressalva de material da druida** ("won't wear armor... made of metal") e qualquer outra nota de sabor dentro do texto de proficiência — descartada no parser, não modelada em campo novo (ver §Questões em aberto).
- **Retroagir personagens já criados.** Mecânica só para criação nova, mesmo corte de US-131/US-220.
- **Sistema `Free`.** Não vem do ingest — os 3 campos ficam ausentes, schema opcional garante que não quebra (mesma disciplina de US-209/US-203).

---

## Modelo de dados proposto

`packages/shared/src/types/system.ts` — extensão de `ClassCatalogEntrySchema` (a mesma que US-209 propõe para `hitDice`/`savingThrows`; ver §Notas de implementação sobre ordem de landing):

```ts
const ArmorCategorySchema = z.enum(['light', 'medium', 'heavy', 'shields', 'all'])
const WeaponCategorySchema = z.enum(['simple', 'martial'])

export const ClassCatalogEntrySchema = SystemCatalogEntrySchema.extend({
  // ...hitDice/savingThrows de US-209, se já landed...
  armorProficiencies: z.array(ArmorCategorySchema).optional(),
  weaponProficiencies: z.object({
    categories: z.array(WeaponCategorySchema),
    weapons: z.array(z.string()), // chaves de config.weapons
  }).optional(),
  toolProficiencies: z.object({
    fixed: z.array(z.string()), // chaves de config.tools
    choice: z.object({
      count: z.number().int().positive(),
      categories: z.array(z.string()), // valores de config.tools[].category
    }).optional(),
  }).optional(),
})
```

Exemplo (`fighter`, `bard`, `wizard`, ilustrando as 3 formas):

```jsonc
{
  "classes": [
    {
      "key": "fighter", "label": "Guerreiro",
      "armorProficiencies": ["all", "shields"],
      "weaponProficiencies": { "categories": ["simple", "martial"], "weapons": [] },
      "toolProficiencies": { "fixed": [] }
    },
    {
      "key": "bard", "label": "Bardo",
      "armorProficiencies": ["light"],
      "weaponProficiencies": { "categories": ["simple"], "weapons": ["hand_crossbow", "longsword", "rapier", "shortsword"] },
      "toolProficiencies": { "fixed": [], "choice": { "count": 3, "categories": ["musical-instrument"] } }
    },
    {
      "key": "wizard", "label": "Mago",
      "armorProficiencies": [],
      "weaponProficiencies": { "categories": [], "weapons": ["dagger", "dart", "sling", "quarterstaff", "light_crossbow"] },
      "toolProficiencies": { "fixed": [] }
    }
  ]
}
```

**DTO** (`CreateCharacterSchema`): `classToolChoice: z.array(z.string().max(60)).optional()` — irmão de `raceSkillChoices` (US-220), array porque bard escolhe 3.

**Persistência:** sem coluna nova para armadura/arma (derivado de `config.classes` na leitura, como `hitDice`). Ferramenta de classe (fixa + escolhida) entra no `Character.tools` já existente ([schema.prisma:50](../../../apps/api/prisma/schema.prisma)) — sem coluna dedicada tipo `raceToolChoice`, porque nenhum outro consumidor (kit inicial, etc.) precisa saber "isso veio da classe" separado de "isso é uma proficiência de ferramenta" (diferente do anão, cuja ferramenta escolhida também alimenta o kit de equipamento — ver `getRaceToolEquipment`).

---

## Critérios de aceite

- [x] `config.classes[].armorProficiencies`/`weaponProficiencies`/`toolProficiencies` preenchidos para as 13 classes, batendo com a tabela medida em §Contexto (fighter/paladin → `all`+`shields`; monk/wizard/sorcerer → `armorProficiencies: []`; etc.).
- [x] A feature `<classe>_proficiencies` não aparece mais como card de texto cru na aba de Traços — some de `config.classFeatures`, entra em `retiredFeatures` para ficha já persistida continuar resolvendo. (Achado de implementação: medido em 2026-09-08, a feature já NÃO entrava em `classFeatures` antes desta story — nenhuma `ClassFeatureItem` de nível 1 a referencia como `parent`, então o gate `lvl1` do `buildClassFeatures` já a excluía. O filtro explícito por `feature_type === 'PROFICIENCIES'` foi adicionado do mesmo jeito, como rede de segurança contra um bump futuro do dataset — `retiredFeatures` fica vazio porque não havia nada "ao vivo" para aposentar.)
- [x] Ficha (`GameView`) mostra: seção "Armadura" nova (categorias localizadas), seção "Armas" existente com as chaves nomeadas de classe somadas às de raça na `<ul>` (mesma lista, sem duplicar) e categoria pura (`Simples`/`Marcial`) só no sufixo do `SheetHeading` — **nunca como item da lista junto de arma nomeada** —, seção "Proficiências" existente com ferramenta fixa/escolhida de classe somada — mesmo molde `SheetHeading`+`<ul>` flat que arma/ferramenta de raça já usa (US-215), sem card novo, sem asterisco cru. Seção "Armas" passa a renderizar também quando só há categoria (sem nomeada nem arma de raça — caso guerreiro/paladino/bárbaro/etc.). Revisão (`SetupWizard`) espelha com as mesmas linhas `<dt>/<dd>` (`setup.review.armor` nova, `<dt>` de `setup.review.weapons` com o mesmo sufixo de categoria, `setup.review.tools` ganha a fonte de classe).
- [x] Ladra (`rogue`) → `Character.tools` contém `thieves_tools` sem exigir escolha; Druida → `herbalism_kit`, mesmo comportamento.
- [x] Bardo → etapa `tools` do wizard exige 3 escolhas dentro de `musical-instrument` (10 opções do catálogo); `canAdvance` bloqueia sem as 3; as 3 entram em `Character.tools`.
- [x] Monge → etapa `tools` exige 1 escolha dentro de `artisan` ∪ `musical-instrument` (27 opções); mesmo bloqueio/merge.
- [x] `CharacterService.create` rejeita (`BadRequestException`) `classToolChoice` com contagem ≠ a exigida pela classe, chave fora da(s) categoria(s) da classe, duplicata entre si, ou colisão com ferramenta já concedida por raça/origem.
- [x] Classe sem `toolProficiencies.choice` (11 das 13) → `classToolChoice` enviado por engano é ignorado, sem erro — mesmo tratamento de `raceToolChoice`/`raceSkillChoices` fora de contexto.
- [x] Categoria de arma/armadura de classe **não** aparece em `Character.weapons` — só as listas NOMEADAS (druid/sorcerer/wizard/o extra de bard/monk/rogue) resolvem contra `config.weapons`, e mesmo essas ficam em `config.classes[].weaponProficiencies.weapons` (leitura), não mescladas em `Character.weapons` (reservado a concessão de raça/mecânica futura).
- [x] **Eval/teste de regressão:** `ingest.test.mjs` cobre as 13 classes (fixture reduzida cobrindo os 3 formatos de arma: categoria pura, lista nomeada, mista) e as 2 falhas altas; `character.service.test.ts` cobre Bardo com 3 escolhas válidas, Monge com 1 escolha válida, e Guerreiro (sem `choice`) sem regressão.

---

## Notas de implementação

- **Cuidado com `sorcerer`/`sorceror`:** a feature de proficiência do feiticeiro está gravada sob `pk: "srd_sorceror_proficiencies"` (erro de digitação do dataset upstream, `parent` continua correto: `"srd_sorcerer"`). `buildClassFeatures` já lida com isso corretamente porque tira o slug por **tamanho** (`f.pk.slice(f.fields.parent.length + 1)`), não por igualdade literal de prefixo — o novo `buildClassProficiencies` deve encontrar a feature do mesmo jeito (por `parent` + `feature_type === 'PROFICIENCIES'`), nunca assumindo `pk.startsWith(canon)`.
- **Ordem de landing com US-209:** as duas stories estendem `ClassCatalogEntrySchema` e tocam `buildClasses`/o mesmo objeto de retorno por classe. Se as duas estiverem em progresso ao mesmo tempo, uma delas reaplica o `.extend()` por cima da outra — sem conflito de merge real (campos diferentes), mas cabe rebase, não paralelismo cego.
- **Parser de fragmento nomeado → chave de arma/ferramenta:** singularizar (`"shortswords"` → `"shortsword"`, `"crossbows"` → depende do prefixo) e casar contra `config.weapons`/`config.tools` por rótulo em minúsculo. Os 15 fragmentos nomeados medidos em §Contexto cobrem os únicos casos hoje — tabela de exceção explícita (mesmo espírito de `ARTISAN_PATTERN`/`toolCategory`), não regex genérica de plural em inglês (ambíguo demais para um parser que falha alto).
- **`feature_type`** já vem no dataset (`"PROFICIENCIES"`, confirmado no registro de `srd_sorceror_proficiencies`) — mais confiável que casar pelo nome `"Proficiencies"` (que também poderia colidir com `"Bonus Proficiencies"` de subclasse).

---

## Questões em aberto

1. **Ressalva de material da druida — RESOLVIDA (2026-09-08), descartada.** Seguiu a recomendação: `parseArmorProficiencies` (ingest.mjs) remove o parêntese antes de separar por vírgula — a ficha continua sem modelar material/propriedade de item nenhum.
2. **Nome do painel novo — RESOLVIDA (2026-09-08), não é painel.** Descartada a ideia de `ProficienciesPanel`/estender `FeaturesPanel`: nem cartão nem componente novo — arma/ferramenta/armadura de classe reaproveita as 3 seções FLAT que `GameView.tsx` já usa para arma/ferramenta/idioma de raça (US-215: `SheetHeading` + `<ul>` de `<li>` só-rótulo), com a fonte de dado composta em `page.tsx` em vez de UI nova. Ver §Dentro do escopo.
