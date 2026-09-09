# US-228 — Categoria simples/marcial e corpo a corpo/distância no catálogo de armas

**Épico:** 1 — Personagem
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** [US-215](./US-215-proficiencias-de-arma-e-ferramenta-fixa-de-raca.md) (`buildWeapons`/`SystemWeaponSchema`/`config.weapons` — o catálogo de 44 armas que esta story estende com a categoria) · [US-221](./US-221-proficiencias-de-arma-armadura-e-ferramenta-por-classe.md) (`WeaponCategorySchema`/`weaponProficiencies.categories` — o enum `'simple'|'martial'` que a classe já concede POR NOME da categoria, sem o catálogo saber quais armas ela cobre)
**Relacionado:** [US-134](./US-134-catalogo-de-ferramentas-do-sistema.md) (`buildTools`/`toolCategory` — precedente direto de "campo de categoria dentro do catálogo de item", `buildWeapons` é hoje o único dos dois catálogos irmãos sem equivalente) · [US-223](./US-223-proficiencia-de-arma-legivel-na-revisao.md) (última story a mexer no bloco "Armas" da ficha/review — moveu a categoria pra `<li>` própria, mas continua mostrando só a palavra "Simples"/"Marcial") · [US-229](./US-229-proficiencia-de-arma-legivel-no-painel-de-classe.md) (mesmo dado, painel de detalhe da etapa `class` em vez do `review` — nasceu de §Questões em aberto #2 desta story)

**Criada em:** 2026-09-09

---

## História

> **Como** jogadora criando um personagem cuja classe concede proficiência em "armas simples" ou "armas marciais" (não uma arma nomeada),
> **quero** ver quais armas do catálogo pertencem a cada categoria — e quais delas são corpo a corpo ou à distância,
> **para que** eu saiba de verdade o que meu personagem pode empunhar e como vai lutar, em vez de ler a palavra "Simples" sem nenhuma lista por trás.

---

## Contexto e motivação

### O problema observado

A etapa `review` do wizard e a ficha do personagem (`GameView`) já mostram a proficiência de arma da classe — mas quando ela é uma CATEGORIA (não uma arma nomeada), o que aparece é só a palavra crua traduzida: "Simples" ou "Marcial" ([SetupWizard.tsx:1822-1828](../../../apps/web/src/components/setup/SetupWizard.tsx:1822), [GameView.tsx:619-628](../../../apps/web/src/components/game/GameView.tsx:619), ambos via `WEAPON_CATEGORY_LABEL`). Um Bardo vê "Simples" na ficha e não tem como saber, dentro do produto, que isso cobre adaga, maça, azagaia — precisa sair e consultar um livro de regras.

### Por que a solução atual não basta

`config.weapons` já existe desde a US-215 (44 armas, `{key, label}`) e já é usado pra resolver arma NOMEADA — mas o comentário da própria função é explícito sobre a lacuna ([ingest.mjs:1016-1019](../../../scripts/srd/ingest.mjs:1016)): *"sem `category`: arma não tem subcategoria de proficiência do 5e como ferramenta tem"*. Isso era verdade quando só existia a distinção artisan/musical-instrument/kit/vehicle de `config.tools` — mas simples/marcial É uma subcategoria real de arma no 5e, só nunca foi modelada no catálogo. `WeaponCategorySchema` ([system.ts:99](../../../packages/shared/src/types/system.ts:99)) já é o enum `'simple'|'martial'` certo — mas ele só aparece em `weaponProficiencies.categories` (o que a CLASSE concede), nunca em cada item de `config.weapons` (o que cada ARMA é). Não dá pra cruzar as duas coisas hoje: a UI sabe que a classe concede "simple", mas não tem onde perguntar "quais armas SÃO simple".

### O que falta no dataset (medido em 2026-09-09, tag Open5e `v2.1.0` já pinada pelo `sync.mjs`)

`Item.json` (já sincronizado) tem 44 registros `category: 'weapon'`, e cada um tem um campo `weapon` — chave estrangeira pro registro correspondente em `Weapon.json`, um documento do MESMO diretório `wizards-of-the-coast/srd-2024` que **ainda não está na lista `FILES` do `sync.mjs`** ([sync.mjs:46-69](../../../scripts/srd/sync.mjs:46)). `Weapon.json` tem 38 registros (as 6 armas de `Item.json` sem correspondência — Acid, Alchemist's Fire, Holy Water, Net, Oil, Torch — são item de aventura arremessável, sem ficha de combate, sem entrada aqui), cada um com `is_simple: boolean` (`false` = marcial) entre outros campos de combate:

```json
{
  "pk": "srd-2024_longsword",
  "fields": { "name": "Longsword", "damage_dice": "1d8", "damage_type": "slashing",
              "is_simple": false, "is_improvised": false, "range": 0, "long_range": 0, "distance_unit": null }
}
```

14 armas com `is_simple: true`, 24 com `is_simple: false` — bate com as 8 chaves que `RACE_WEAPON_PROFICIENCIES` ([race-weapon-proficiency.ts](../../../packages/shared/src/race-weapon-proficiency.ts)) já referencia (todas as 8 têm correspondência em `Weapon.json`, nenhuma cai nas 6 sem categoria).

### Corpo a corpo ou à distância — o sinal certo não é `range > 0`

`Weapon.json` também tem `range`/`long_range`/`distance_unit` por item — mas `range > 0` **não** separa corpo-a-corpo de distância: 7 das 29 armas corpo-a-corpo têm alcance porque são ARREMESSÁVEIS (adaga, machadinha, azagaia, lança, tridente, dardo, martelo leve — regra 2024, propriedade `Thrown`), sem deixar de ser arma corpo-a-corpo. `distance_unit` vem sempre vazio no dataset pinado — também não serve.

O sinal correto é outro documento do MESMO diretório `srd-2024`, também fora do `sync.mjs` hoje: `WeaponPropertyAssignment.json` (108 linhas, junção arma↔propriedade — 17 propriedades ao todo em `WeaponProperty.json`, ver §Fora do escopo). Uma arma com uma linha `property: "srd-2024_ammunition-wp"` é a ÚNICA marca confiável de arma à distância de verdade (besta, arco, funda, arma de fogo — precisa de munição pra atirar); arma com `property: "srd-2024_thrown-wp"` mas SEM `ammunition-wp` continua corpo-a-corpo (só pode ser arremessada). Medido no dataset pinado: **9 à distância** (blowgun, hand crossbow, heavy crossbow, light crossbow, longbow, musket, pistol, shortbow, sling) e **29 corpo a corpo** (as outras, 7 delas também arremessáveis) — soma 38, sem sobreposição, sem arma sem classificação.

### A proposta

`sync.mjs` passa a baixar `Weapon.json` e `WeaponPropertyAssignment.json` (mesmo doc `srd-2024`, mesmo tag — sem bump, sem entrada nova em `NOTICE-open5e.md`, mesmo padrão que a US-134/US-133 já registram pra arquivo novo dentro de doc já sincronizado). `buildWeapons` cruza `Item.fields.weapon` (a chave estrangeira) contra o `pk` de `Weapon.json` e anexa `category: 'simple'|'martial'` (via `is_simple`) e `weaponType: 'melee'|'ranged'` (via presença da propriedade `ammunition-wp`) a cada uma das 38 armas de combate — as 6 sem correspondência continuam sem os dois campos.
>
> **Decisão de 2026-09-09 (pós-implementação):** a UI (review + ficha) chegou a expandir a categoria pra lista de armas de `config.weapons` — tentado e revertido no mesmo dia, lista grande (38 nomes) demais pra caber legível numa linha da ficha. A UI continua mostrando só a palavra da categoria (comportamento da US-223); o dado `category`/`weaponType` no catálogo é o que esta story de fato entrega, pronto pra US-229 (painel de classe) usar num lugar com mais espaço.

---

## Escopo

### Dentro do escopo

- **`scripts/srd/sync.mjs`:** `Weapon.json` e `WeaponPropertyAssignment.json` na lista `FILES`, ao lado de `Item.json` — comentário explicando o motivo (US-228, mesmo doc de `Item.json`, sem tag nova).
- **`scripts/srd/ingest.mjs`, `buildWeapons`:** ganha um parâmetro novo, um `Map` já resolvido `pk → { category, weaponType }` (`buildWeapons(overlay, itemsRaw, weaponMeta, resolve)`) — montado por uma função irmã pequena que cruza `Weapon.json` (`is_simple` → `category`) com `WeaponPropertyAssignment.json` filtrado pra `property === 'srd-2024_ammunition-wp'` (presença → `weaponType: 'ranged'`, ausência → `'melee'`). Pra cada item com `fields.weapon` não-nulo, `buildWeapons` copia os dois campos do `Map`; item sem correspondência (as 6 de fora) não ganha nenhum dos dois campos no objeto retornado (mesmo idioma de "spread condicional" que `grant`/`startingEquipmentChoices` já usam no arquivo, não `category: undefined`).
- **`buildConfig`** ([ingest.mjs:1220](../../../scripts/srd/ingest.mjs:1220)) e **`main`** ([ingest.mjs:1260-1289](../../../scripts/srd/ingest.mjs:1260)): `Weapon.json` e `WeaponPropertyAssignment.json` entram no `Promise.all`/`load`/`data`, e a montagem do `Map` de metadado roda antes de `buildWeapons` (mesma ordem que `weaponKeys`/`toolsByKey` já são montados antes de `buildClassProficiencies`).
- **`SystemWeaponSchema`** ([system.ts:167-170](../../../packages/shared/src/types/system.ts:167)): ganha `category: WeaponCategorySchema.optional()` (reaproveita o enum da US-221, [system.ts:99](../../../packages/shared/src/types/system.ts:99)) e `weaponType: WeaponTypeSchema.optional()`, com `WeaponTypeSchema = z.enum(['melee', 'ranged'])` novo, ao lado de `WeaponCategorySchema`.
- ~~**Etapa `review` do wizard** ([SetupWizard.tsx:1822-1828](../../../apps/web/src/components/setup/SetupWizard.tsx:1822)): expandir a categoria nos nomes de `config.weapons.filter(w => w.category === cat)`.~~ **Revertido em 2026-09-09** — lista de até 24 nomes por categoria não coube legível na linha da revisão. A tela continua igual à US-223 (`WEAPON_CATEGORY_LABEL`, só a palavra da categoria).
- ~~**Ficha do personagem** ([GameView.tsx:619-628](../../../apps/web/src/components/game/GameView.tsx:619)): mesma expansão.~~ **Revertido junto** — mesma decisão, mesmo motivo.
- **Testes:** `ingest.test.mjs` — a suíte de `buildWeapons` ([ingest.test.mjs:1620-1653](../../../scripts/srd/ingest.test.mjs:1620)) muda de assinatura (novo parâmetro) e o teste que hoje afirma **"sem campo category no retorno"** ([ingest.test.mjs:1622](../../../scripts/srd/ingest.test.mjs:1622)) inverte pra afirmar `category`/`weaponType` certos por chave conhecida (`battleaxe` → `martial`/`melee`, `light_hammer` → `simple`/`melee`, `longbow` → `martial`/`ranged`); o teste contra o dataset pinado real ([ingest.test.mjs:1645](../../../scripts/srd/ingest.test.mjs:1645)) ganha as contagens 14/24 (`category`) e 9/29 (`weaponType`), e confere que as 6 sem correspondência ficam sem os dois campos.

### Fora do escopo

- **As outras 16 propriedades de arma** (finesse, versatile, heavy, reach, thrown, two-handed, light, loading, as 6 de maestria...). `WeaponPropertyAssignment.json` entra no sync só pra extrair o sinal `ammunition-wp` (corpo a corpo/à distância) — as outras 16 continuam sem modelar, sem virar campo de `config.weapons`, sem UI. `WeaponProperty.json` (catálogo com o NOME de cada propriedade) nem entra no sync: a story só compara contra o `pk` fixo `srd-2024_ammunition-wp`, nunca precisa do nome/label da propriedade. Story futura se/quando o produto precisar de alguma das outras 16 pra alguma mecânica.
- **Dano, alcance, peso e custo da arma** (`damage_dice`, `damage_type`, `range`, `long_range`, `weight`, `cost` — já em `Item.json`/`Weapon.json`, nenhum entra em `config.weapons` hoje). Não pedido, mesmo corte do item acima.
- **As 6 armas de `Item.json` sem correspondência em `Weapon.json`** (Acid, Alchemist's Fire, Holy Water, Net, Oil, Torch) ficarem sem `category`. Decisão consciente: não são "arma simples/marcial" no livro, são item de aventura usável em ataque — inventar uma categoria pra elas seria dado que o SRD não afirma.
- **Checar a proficiência REAL do personagem antes de listar** (ex.: "você só é proficiente nesta marcial se X"). A lista mostra TODA arma da categoria, sempre — cruzar contra o que o personagem específico pode usar de fato é refinamento de UX, não a pergunta desta story (mesmo corte que a US-226 já fez pro qualificador `(if proficient)`, ver §Questões em aberto #2 de lá).
- **Classe Marshal (`a5e-ag`).** Fonte diferente de `weaponProficiencies` (mesma feature `PROFICIENCIES`, mas dataset `a5e-ag`) — se ela usa categoria `simple`/`martial` da mesma forma, já se beneficia do catálogo estendido sem trabalho extra; não medido nem validado à parte aqui.

---

## Modelo de dados proposto

`packages/shared/src/types/system.ts` — extensão de `SystemWeaponSchema` (linha 167), reaproveitando `WeaponCategorySchema` que já existe na linha 99, mais o `WeaponTypeSchema` novo ao lado dele:

```ts
const WeaponTypeSchema = z.enum(['melee', 'ranged'])

export const SystemWeaponSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  category: WeaponCategorySchema.optional(),  // ausente só nas 6 sem ficha de combate no dataset
  weaponType: WeaponTypeSchema.optional(),     // idem — os dois campos vêm ou faltam juntos
})
```

Exemplo de `config.weapons` (três itens reais — uma simples corpo a corpo, uma marcial corpo a corpo arremessável, uma marcial à distância — e um dos 6 sem os dois campos):

```jsonc
{
  "weapons": [
    { "key": "dagger", "label": "Dagger", "category": "simple", "weaponType": "melee" },
    { "key": "javelin", "label": "Javelin", "category": "simple", "weaponType": "melee" },
    { "key": "longbow", "label": "Longbow", "category": "martial", "weaponType": "ranged" },
    { "key": "torch", "label": "Torch" }
  ]
}
```

**Persistência:** nenhuma nova — `config.weapons` já é campo derivado do artefato `srd-5e.config.<locale>.json` (US-215), gravado pelo `ingest.mjs`, sem tabela própria no banco.

---

## Critérios de aceite

- [ ] `config.weapons` (artefatos `en-US` e `pt-BR`) ganha `category: 'simple'|'martial'` **e** `weaponType: 'melee'|'ranged'` nas 38 armas com correspondência em `Weapon.json` — 14 `simple`/24 `martial` (batendo com `is_simple`) e 9 `ranged`/29 `melee` (batendo com a presença da propriedade `ammunition-wp`), medido em 2026-09-09.
- [ ] As 7 armas corpo-a-corpo TAMBÉM arremessáveis (dagger, dart, handaxe, javelin, light_hammer, spear, trident — propriedade `thrown-wp` sem `ammunition-wp`) saem com `weaponType: 'melee'`, nunca `'ranged'` — o alcance de arremesso não muda o tipo.
- [ ] As 6 armas de `Item.json` sem correspondência em `Weapon.json` (Acid, Alchemist's Fire, Holy Water, Net, Oil, Torch) continuam em `config.weapons`, sem as chaves `category`/`weaponType` — não viram erro, não ganham classificação inventada.
- [ ] As 8 chaves de `RACE_WEAPON_PROFICIENCIES` (anão + elfo) têm `category`/`weaponType` presentes e corretos: `battleaxe` marcial/corpo-a-corpo, `handaxe` simples/corpo-a-corpo, `light_hammer` simples/corpo-a-corpo, `warhammer` marcial/corpo-a-corpo (anão); `longsword` marcial/corpo-a-corpo, `shortsword` marcial/corpo-a-corpo, `shortbow` simples/à-distância, `longbow` marcial/à-distância (elfo) — nenhuma quebra de chave já consumida em produção.
- [x] ~~Etapa `review` do wizard: ... ver, no lugar da palavra crua "Simples", a lista das 14 armas simples do catálogo ...~~ **Revertido em 2026-09-09** (decisão da mantenedora): a revisão continua mostrando só "Armas simples"/"Armas marciais" (US-223) — a lista expandida ficou grande demais pra caber legível.
- [x] ~~Ficha do personagem (`GameView`, seção "Armas"): mesma expansão ...~~ **Revertido junto**, mesmo motivo.
- [ ] `buildConfig`/`main` seguem idempotentes (rodar o ingest duas vezes seguidas produz artefato byte-a-byte igual) — `Weapon.json`/`WeaponPropertyAssignment.json` somam no mesmo `Promise.all`, sem reordenar chaves do artefato.
- [ ] **Eval / teste de regressão:** `ingest.test.mjs` cobre a junção Item↔Weapon↔WeaponPropertyAssignment com fixture pequena (uma arma simples melee, uma marcial melee arremessável, uma marcial ranged, uma sem correspondência) e contra o dataset pinado real (14/24 de `category`, 9/29 de `weaponType`, mais a ausência dos dois campos nas 6 sem ficha) — o teste que hoje afirma "sem campo category no retorno" ([ingest.test.mjs:1622](../../../scripts/srd/ingest.test.mjs:1622)) precisa mudar de assertiva, não só passar por acaso.

---

## Notas de implementação

- **Reusar o enum de categoria, não duplicar.** `WeaponCategorySchema` ([system.ts:99](../../../packages/shared/src/types/system.ts:99)) já é `z.enum(['simple', 'martial'])` — é o MESMO valor que `is_simple` do dataset vira (`true → 'simple'`, `false → 'martial'`). `WeaponTypeSchema` (`'melee'|'ranged'`) é enum NOVO, sem precedente no arquivo — não confundir com `distance_unit`/`range` numérico do dataset, que não participam da conta (ver §Contexto, "o sinal certo não é `range > 0`").
- **Assinatura de `buildWeapons` muda** ([ingest.mjs:1020](../../../scripts/srd/ingest.mjs:1020)): de `(overlay, itemsRaw, resolve)` pra `(overlay, itemsRaw, weaponMeta, resolve)`, onde `weaponMeta` é um `Map<pk, {category, weaponType}>` já pronto — monte-o numa função pequena separada (`buildWeaponMeta(weaponsRaw, propertyAssignmentsRaw)`) pra não inchar `buildWeapons` com duas fontes cruas + a lógica de junção das duas. Todo call site (`buildConfig` e os testes) precisa do parâmetro novo — não é aditivo por posição como um campo opcional de objeto seria.
- **Join pela chave estrangeira, não pelo nome.** `Item.fields.weapon` já É o `pk` de `Weapon.json` (ex. `"srd-2024_longsword"`), e `WeaponPropertyAssignment.fields.weapon` usa o MESMO `pk` (ex. `"srd-2024_longbow"`, ver amostra em §Contexto) — não precisa normalizar nome nem repetir a lógica de `stripDocument`, é comparação direta de string entre os três datasets.
- **`ammunition-wp` é literal fixo, mesmo espírito de `ALIGNMENT_PK`.** Não carregar `WeaponProperty.json` (catálogo com o NOME/label das 17 propriedades) só pra resolver que `srd-2024_ammunition-wp` "é a propriedade Ammunition" — o `pk` já é auto-descritivo e estável (mesmo tag pinado), comparar a string direto evita sincronizar um dataset a mais que a story não usa por outro motivo nenhum.
- **`Weapon.json`/`WeaponPropertyAssignment.json` não têm `document` fora de `srd-2024`** (confirmado na inspeção do dataset pinado) — sem fusão 5.1/5.2 pra fazer aqui, ao contrário de `races`/`classes`.
- **`sync.mjs`:** comentário no estilo já usado por `Item.json`/`Language.json`/`Skill.json` — "mesmo documento X, sem tag nova, sem entrada nova em NOTICE-open5e.md" (ver [sync.mjs:49-50](../../../scripts/srd/sync.mjs:49) pro precedente exato).

---

## Questões em aberto

1. ~~Onde exatamente mostrar a lista expandida — texto corrido ou algo mais compacto (tooltip/popover)?~~ — **resolvido em 2026-09-09:** texto corrido foi tentado (recomendação original desta seção) e revertido pela mantenedora — 24 marciais numa linha só ficou ilegível mesmo em texto corrido. A revisão/ficha voltam a mostrar só a palavra da categoria (US-223); `config.weapons[].category`/`weaponType` continuam no catálogo pra US-229 usar num painel com mais espaço, onde um popover/tooltip pode fazer sentido se a lista ainda incomodar.
2. ~~Vale expor a lista também no painel de detalhe da etapa `class`~~ — **resolvido:** virou [US-229](./US-229-proficiencia-de-arma-legivel-no-painel-de-classe.md), separada porque toca bloco/arquivo diferente (painel de detalhe vs. bloco de review) e depende do dado que esta story entrega primeiro.

---

## Referências no código

- [scripts/srd/sync.mjs:46-69](../../../scripts/srd/sync.mjs:46) — lista `FILES`, onde `Weapon.json` e `WeaponPropertyAssignment.json` entram ao lado de `Item.json`.
- [scripts/srd/ingest.mjs:1016-1030](../../../scripts/srd/ingest.mjs:1016) — `buildWeapons`, função que ganha o cruzamento com `weaponMeta` e os campos `category`/`weaponType`.
- [scripts/srd/ingest.mjs:1260-1289](../../../scripts/srd/ingest.mjs:1260) — `main`, onde `Weapon.json`/`WeaponPropertyAssignment.json` entram no `Promise.all`/`data`.
- [scripts/srd/ingest.mjs:1056-1073](../../../scripts/srd/ingest.mjs:1056) — `parseWeaponProficiencies` (US-221), a função que já produz `weaponProficiencies.categories` — não muda nesta story, mas é o dado do outro lado do cruzamento que a UI precisa fazer.
- [scripts/srd/ingest.test.mjs:1620-1653](../../../scripts/srd/ingest.test.mjs:1620) — suíte atual de `buildWeapons`, incluindo o teste que afirma "sem campo category" e precisa inverter.
- [packages/shared/src/types/system.ts:99](../../../packages/shared/src/types/system.ts:99) — `WeaponCategorySchema`, o enum reaproveitado.
- [packages/shared/src/types/system.ts:164-170](../../../packages/shared/src/types/system.ts:164) — `SystemWeaponSchema`, onde `category` entra.
- [packages/shared/src/race-weapon-proficiency.ts](../../../packages/shared/src/race-weapon-proficiency.ts) — as 8 chaves que precisam continuar resolvendo `category` correta.
- [apps/web/src/components/setup/SetupWizard.tsx:1822-1828](../../../apps/web/src/components/setup/SetupWizard.tsx:1822) — bloco de review que hoje mostra só a palavra da categoria.
- [apps/web/src/components/game/GameView.tsx:44-46,619-628](../../../apps/web/src/components/game/GameView.tsx:619) — `WEAPON_CATEGORY_LABEL` e bloco "Armas" da ficha, mesmo tratamento a estender.
