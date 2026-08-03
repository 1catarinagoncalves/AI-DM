# US-100 — A ficha do personagem acompanha o idioma ativo (features e magias por chave)

**Épico:** 1 — Personagem
**Fase:** 1 — MVP single-player
**Status:** 🚧 Em progresso
**Depende de:** [US-106](./US-106-catalogo-com-chave-e-free-herdando-o-srd.md) (**obrigatória e anterior**: é ela que põe `key` no artefato e faz o Free herdar o SRD — sem chave no `config` a ficha não tem o que guardar) · [US-97](./US-97-seletor-de-idioma-pt-br-en.md) (é de `User.locale` que sai o idioma) · [US-99](./US-99-config-do-sistema-no-locale-ativo.md) (**obrigatória e anterior**: a ficha resolve a label a partir do `config` do locale — sem `config` por locale não há de onde resolver) · [US-54](./US-54-chaves-canonicas-em-ingles.md) ✅ (as chaves de classe já são EN — o ADR 005 exigia essa ordem) · [US-52](./US-52-traducao-automatica-do-srd.md) ✅ (o pipeline de tradução que esta story reusa para o conteúdo aposentado)
**Relacionada a:** [US-41](./US-41-features-traits-de-classe.md) e [US-42](./US-42-magias-conhecidas.md) (foram elas que materializaram feature/magia como texto) · [US-27](./US-27-pericias-do-personagem.md) (as perícias **já** fazem certo — é o modelo a copiar) · [US-47](./US-47-ingestao-srd-como-dado.md) (é o `ingest` que calcula e descarta a chave) · [ADR 005](../../adr/005-locale-como-dimensao.md) (D2 e fase "Ficha") · [ADR 004 §3.1](../../adr/004-origem-do-dado-de-sistema.md) (**revisão de 02/08/2026**: o Free herda o SRD — é o que traz o `system-free` para dentro desta story) · [ADR 002](../../adr/002-memoria-de-sessao.md) (o `EventLog` congela por decisão, não entra aqui)
**Criada em:** 2026-07-30 · **Reescrita em:** 2026-08-02

---

## História

> **Como** jogador que trocou o idioma para inglês,
> **quero** que a ficha do meu personagem mostre "Rage" e "Lay on Hands",
> **para que** eu leia a ficha na mesma língua da narração — em vez de "Fúria" e "Impor as Mãos" no meio de um jogo em inglês.

---

## Contexto e motivação

### O problema observado

Metade da ficha já acompanha o idioma e a outra metade não — e a diferença é o **formato de armazenamento**, não uma decisão de produto.

**As perícias fazem certo.** `Character.skills` guarda **chaves** (US-27) e a label é resolvida na leitura, a partir do `config`: `buildSkillSheet(config.skills, ...)` em [`play/[adventureId]/page.tsx:43`](../../../apps/web/src/app/play/%5BadventureId%5D/page.tsx). Assim que a [US-99](./US-99-config-do-sistema-no-locale-ativo.md) servir o `config` em inglês, **as perícias saem em inglês sozinhas** — sem tocar em nenhuma ficha.

**As features e magias fazem errado.** São copiadas como **texto** na criação: `getClassFeatures(config, dto.class)` e `getClassSpells(config, dto.class)` devolvem os objetos do `config` e o serviço grava o resultado inteiro em `Character.features`/`Character.spells` ([`character.service.ts:31-34`](../../../apps/api/src/character/character.service.ts)). O que ficou gravado foi o texto do idioma vigente na hora da criação, e nada o re-deriva depois.

**A chave existe e é jogada fora.** O `ingest` conhece a chave de cada feature (`${classe}_${slug}`, ex.: `paladin_lay-on-hands`) e de cada magia (o slug do dataset), usa-a para casar o overlay e para ordenar — e então **remove** o campo antes de gravar o artefato: `.map(({ _slug, ...e }) => e)` ([`ingest.mjs:168`](../../../scripts/srd/ingest.mjs) e `:190`). O schema compartilhado confirma o buraco: `SystemClassFeatureSchema` é `{name, description}` e `SystemSpellSchema` é `{name, level?, description?}` — **nenhum dos dois tem chave** ([`system.ts:27`](../../../packages/shared/src/types/system.ts) e `:36`). A única chave que sobrevive no `config` é a da **classe**, não a da feature.

### Por que a solução atual não basta

Sem chave, não há como perguntar "como se chama esta feature em inglês?": o que a ficha guarda é a resposta em português, não a pergunta. Nem [US-97](./US-97-seletor-de-idioma-pt-br-en.md) nem [US-99](./US-99-config-do-sistema-no-locale-ativo.md) consertam isso — a primeira troca o idioma da narração, a segunda o do catálogo; nenhuma das duas alcança o texto já copiado para dentro da ficha.

Depois da US-99, o problema **encolhe mas não some**, e é bom ser preciso sobre o que sobra:

| Situação | Depois da US-99 | Depois desta story |
|---|---|---|
| Personagem **criado** com `locale = 'en-US'` | ✅ nasce com feature/magia em inglês (a criação copia do `config` EN) | igual |
| Personagem criado em PT, jogador **troca** para EN | ❌ ficha continua "Fúria" para sempre | ✅ passa a "Rage" |
| Personagem criado em EN, jogador **troca** para PT | ❌ ficha continua "Rage" | ✅ passa a "Fúria" |

Ou seja: **esta story é sobre a troca**, que é justamente o que o ADR 005 (D1) promete — preferência mutável a qualquer momento. Sem ela, "trocar de idioma" tem uma exceção silenciosa e permanente no meio da tela do jogo.

### O sistema Free entrou no escopo em 02/08/2026

A versão anterior desta story tratava só o `system-dnd5e`, porque o `system-free` era, por decisão, um snapshot congelado sem nenhum dado do SRD. Esse era o pior caso possível aqui: **o `config` do Free não tem chave nenhuma**, então nenhuma ficha do Free jamais acompanharia o idioma — e o `freeConfig` ainda é literal **em pt-BR gravado na coluna `config`**, que a ADR 005 define como a base EN, sem `configLocales`.

O [ADR 004 §3.1](../../adr/004-origem-do-dado-de-sistema.md) reviu essa decisão: **o Free herda o artefato do SRD, por seleção de chaves** (decisão 6a) e ganha `configLocales['pt-BR']` (6b). Com isso o Free entra nesta story pela porta da frente — mesmo caminho, mesmo resolvedor, mesma migração. Sem essa revisão, o critério "a mesma ficha lida nos dois locales" seria falso para metade dos sistemas do produto.

---

## A proposta

Guardar na ficha a **chave** da feature e da magia, como `skills` já faz, e resolver nome/descrição a partir do `config` do locale ativo no momento da leitura. Nada de campo de escape e nada de descarte: item que não casa por nome tem uma **origem identificável**, e cada origem tem conserto próprio (ver *Migração*).

---

## Escopo

### Dentro do escopo

- **Catálogo `retired` (rede, hoje sem ocupante):** o artefato passa a carregar `retiredFeatures`/`retiredSpells` (mapa `key → entrada`), alimentado pelo **carry-over do artefato anterior** — chave que existia no bump passado e sumiu neste é transportada, com os dois locales que ela já tinha. Resolve na leitura, **não** entra em personagem novo. Ver *Migração* §3 para por que a lista está vazia hoje e por que o mecanismo entra assim mesmo.
- **`Character.features` e `Character.spells` passam a guardar `string[]`** (chaves), mesma forma de `skills`.
- **Resolução na leitura**, espelhando `buildSkillSheet`: um resolvedor em `packages/shared` que recebe as chaves + o `config` do locale ativo e devolve `{name, description, level?}`, usado pelos **dois** consumidores — a ficha da web e o prompt do Mestre ([`ai.service.ts:322-325`](../../../apps/api/src/ai/ai.service.ts)). Chave não encontrada na lista da classe cai no `retired`.
- **A ficha do Free entra pelo mesmo caminho** — sem tratamento próprio. O que torna isso possível (chave no artefato, Free por seleção, `configLocales` do Free) é a [US-106](./US-106-catalogo-com-chave-e-free-herdando-o-srd.md); aqui só se colhe: a migração indexa o `config` do Free como o de qualquer sistema.
- **Migração de dados** das fichas existentes, casando o texto gravado contra o catálogo — ver a seção própria abaixo.
- **`getSpell` continua funcionando:** a tool procura a magia pelo **nome** que aparece na lista do prompt ([`ai.service.ts:592`](../../../apps/api/src/ai/ai.service.ts)). Com a resolução por locale, a lista e a busca precisam usar a mesma língua — a busca passa a resolver pela chave e comparar contra o nome do locale corrente.
- Testes: ficha lida nos dois locales devolve o par `'Rage'`/`'Fúria'` para a mesma chave; regressão da migração com uma ficha PT legada e com uma ficha que guardou fallback EN; `getSpell` acerta nos dois idiomas; ficha do Free resolve nos dois locales.

### Fora do escopo

- **`race` e `class`.** Achado desta análise: o [ADR 005](../../adr/005-locale-como-dimensao.md) afirmava que "já são a entrada do jogador casada contra chaves canônicas" — **errado, corrigido no próprio ADR em 30/07/2026** (D2). O `CLASS_SYNONYMS` casa o texto em tempo de leitura, mas o código **grava o texto cru do jogador** (`race: dto.race`, `class: dto.class` em [`character.service.ts:42-43`](../../../apps/api/src/character/character.service.ts)) e a tela exibe esse texto. Story própria: [US-105](./US-105-raca-e-classe-por-chave-do-srd.md).
- **`name` e `background`** — texto autoral do jogador; congelam por decisão do ADR 005 (D2), não por pendência.
- **`EventLog`** — histórico imutável ([ADR 002](../../adr/002-memoria-de-sessao.md)). Re-traduzir transcrição seria reescrever o passado da mesa.
- **Inventário** (`CharacterState.inventory`) — itens ganhos em jogo são texto do Mestre, sem chave no `config`. Kits iniciais têm origem no `config`, mas a fonte deles é **OGL 1.0a** ([US-51](./US-51-kits-iniciais-do-srd.md)) e a fronteira do ADR 004 é "regra do SRD numa fonte CC": herdar conteúdo CC não abre a porta para conteúdo OGL. Fica fora (ver *Questões em aberto* #2).
- **Tradução de conteúdo faltante** — [US-52](./US-52-traducao-automatica-do-srd.md) para o catálogo vivo e [US-106](./US-106-catalogo-com-chave-e-free-herdando-o-srd.md) para o EN das entradas autorais do Free. Chave sem tradução no overlay cai no texto EN, comportamento herdado da [US-47](./US-47-ingestao-srd-como-dado.md). O `retired` desta story não precisa de tradução nova: o carry-over traz os dois locales que a entrada já tinha.

---

## Modelo de dados proposto

```jsonc
// Character.features / Character.spells — antes
[{ "name": "Fúria", "description": "Você entra em fúria…" }]
// depois
["barbarian_rage"]
```

| Campo | Antes | Depois |
|---|---|---|
| `Character.features` | `{name, description}[]` | `string[]` — chaves de feature |
| `Character.spells` | `{name, level?, description?}[]` | `string[]` — chaves de magia |
| `SystemClassFeature` | `{name, description}` | `{key, name, description}` |
| `SystemSpell` | `{name, level?, description?}` | `{key, name, level?, description?}` |
| `SystemConfig` | — | `+ retiredFeatures?`, `+ retiredSpells?`: `Record<key, entrada>` |
| `system-free.config` | literal pt-BR na coluna da base EN | artefato EN por seleção de chaves + `configLocales['pt-BR']` |

**Persistência:** as colunas do `Character` seguem `Json` — muda o **conteúdo**, não o tipo, então não há migração de schema; há **migração de dados** (o passo caro desta story). Nenhum campo novo no `Character`: a ficha continua sem locale próprio, porque fala o do `User` (ADR 005, decisão 5).

---

## Migração de dados

O texto gravado na ficha volta a ser chave casando por nome, normalizado, contra o catálogo. Quatro coisas precisam estar certas para nenhuma ficha perder item — as três primeiras são regra do algoritmo, a quarta é conteúdo.

### 1. O índice cobre os **dois** locales, não só o pt-BR

Ficha pt-BR nem sempre guarda texto PT. Entre a [US-47](./US-47-ingestao-srd-como-dado.md) e a [US-52](./US-52-traducao-automatica-do-srd.md), **64 chaves caíam no fallback EN** — quem criou um guerreiro nessa janela tem `"Weapon Mastery"` gravado, e o `config` pt-BR de hoje chama isso de `"Domínio de Armas"`. Ficha criada com `locale = 'en-US'` depois da US-99 tem texto EN inteiro.

Índice de migração = **união** de `System.config` (base EN) e de todos os `configLocales[*]`, normalizado, `nome → chave`. Tenta EN e pt-BR antes de declarar não-casamento. Isso não é escape: a tradução já existe (a US-52 a produziu), só faltava a migração procurar no lugar certo.

### 2. O casamento é **escopado pela classe**

Chave de feature é prefixada pela classe (`fighter_weapon-mastery`), e `"Domínio de Armas"` aparece em **5 classes** — casar por nome no catálogo inteiro escolhe a chave errada em silêncio. Ordem:

1. Escopo pela classe do personagem via `CLASS_SYNONYMS` — o mesmo caminho da criação, então reproduz a escolha original.
2. Classe não resolve (caiu no `default`): nome único no catálogo inteiro → aceita.
3. Nome ambíguo **e** classe irresolúvel: decide pela classe que contém **todas** as outras features da mesma ficha.

Magia não tem esse problema: a chave é o slug do dataset, então `"Luz"` do mago e do clérigo é a mesma chave `light`. Os **63 nomes de magia repetidos** entre classes são o mesmo item, não ambiguidade.

### 3. Todo item legado tem destino — o `retired` é a rede para o próximo bump

Era aqui que morava o medo desta story: ficha criada antes da [US-47](./US-47-ingestao-srd-como-dado.md) com item que o catálogo de hoje não tem. Medido em 02/08/2026 contra o snapshot legado do seed, **os dois casos que existiam ganharam dono por outras decisões**:

| Caso | Quantos | Destino | Por quê |
|---|---:|---|---|
| Feature legada fora do SRD 5.2 | 2 — `paladin_divine-sense`, `ranger_natural-explorer` | **volta ao catálogo vivo** | o [ADR 009](../../adr/009-uniao-dos-srd-5-1-e-5-2.md) une 5.1 e 5.2: as duas existem no 5.1 e reentram pela união, com a tradução curada que o overlay já tem |
| Truque legado que não é SRD nenhum | 7 — `friends`, `thorn-whip`, `toll-the-dead`, `mind-sliver`, `thunderclap`, `blade-ward`, `word-of-radiance` | **entrada autoral do Free** | não estão no 5.1 nem no 5.2 ([ADR 009 §4](../../adr/009-uniao-dos-srd-5-1-e-5-2.md), verificado um a um); a [US-106](./US-106-catalogo-com-chave-e-free-herdando-o-srd.md) lhes dá `key` + `source: 'authored'` no `config` do Free |
| Todo o resto | 14 features, 27 truques, 4 magias de 1º | catálogo vivo | casa direto |

> **Correção de 02/08/2026.** A versão anterior desta seção afirmava que "o catálogo de truques legado casa 100% com o artefato" e que os 7 órfãos não estavam em ficha nenhuma. **Errado**: o script que mediu isso fatiou o `seed.ts` na ordem errada e comparou uma lista vazia. Os 7 estão no `CANTRIP_CATALOG` do Free, e é por isso que a US-106 precisa de entrada autoral — não é completude, é conteúdo em uso.

**Então por que o `retired` entra assim mesmo?** Porque a lista estar vazia hoje é acidente de sorte, não propriedade do desenho: as 2 features só foram resgatadas porque alguém foi olhar o SRD anterior. O bump que retirar conteúdo da próxima vez encontra fichas apontando para uma chave que não existe mais, e sem carry-over o item some da tela sem erro nenhum. O mecanismo é barato (transportar do artefato anterior a chave que sumiu, com os dois locales que ela já tinha) e é a única coisa aqui que impede perda silenciosa.

Se a preferência for cortar escopo, este é o item cortável da story — com a consequência escrita: o próximo bump que retirar conteúdo mutila as fichas que o tinham.

### 4. Rodar como script conferível antes de escrever

Contar quantos itens casam e quantos não, **por classe e por origem** (locale do índice, escopo de classe, aposentado), antes de aplicar. Item que ficar fora das três origens acima é sinal de que o `config` mudou de um jeito que esta análise não previu — aí é caso novo, não escape.

---

## Critérios de aceite

- [ ] Personagem novo grava **chaves** em `features`/`spells`; nenhum `{name, description}` é escrito na criação.
- [ ] A mesma ficha, lida com `locale = 'pt-BR'` e com `locale = 'en-US'`, mostra `'Fúria'` e `'Rage'` — sem tocar no banco entre as duas leituras.
- [ ] Trocar o idioma com o jogo aberto atualiza os nomes de feature/magia na ficha; `name`, `background` e o histórico de narração **não** mudam.
- [ ] **Vale para os dois sistemas:** ficha do `system-free` acompanha o idioma pelo mesmo caminho e pelo mesmo código, sem ramo próprio — com o Free já montado pela [US-106](./US-106-catalogo-com-chave-e-free-herdando-o-srd.md).
- [ ] Fichas existentes migram e **nenhuma perde feature ou magia**: item com texto EM INGLÊS numa ficha pt-BR casa (índice dos dois locales); item de classe ambígua casa na classe certa (escopo por classe); os 9 itens legados de origem incomum casam nos destinos da *Migração* §3 (`Sentido Divino`/`Explorador Nato` no catálogo vivo pela união; os 7 truques nas entradas autorais do Free).
- [ ] **Carry-over do `retired`:** simulando um bump que retire uma chave que alguma ficha tem, a chave é transportada para `retiredFeatures`/`retiredSpells` com os dois locales e a ficha continua exibindo o item — em vez de perder a linha em silêncio.
- [ ] O prompt do Mestre recebe os nomes no locale ativo, e `getSpell` encontra a magia pelo nome que a lista mostra — nos dois idiomas.
- [ ] Chave sem tradução no overlay do locale exibe o texto EN em vez de campo vazio.
- [ ] **Eval / teste de regressão:** ficha com uma feature e uma magia lida nos dois locales, afirmando os dois pares de nomes; ficha PT legada e ficha com fallback EN passadas pela migração, afirmando que viraram chave e resolvem de volta para o texto do locale certo; ficha apontando para chave transportada pelo carry-over, afirmando que resolve pelo `retired` nos dois idiomas. Falha se o texto voltar a ser materializado ou se a migração perder itens.

---

## Notas de implementação

> *Dicas e decisões técnicas para quem vai implementar. Não é especificação obrigatória — o implementador pode divergir com boa justificativa.*

- **Copie o caminho das perícias, não invente outro.** `buildSkillSheet` (chaves + `config` → linhas prontas para a tela) é o padrão que esta story estende para feature/magia; o resolvedor vive em `packages/shared` porque tem **dois** consumidores (web e prompt), e duas cópias divergem.
- **Normalize antes de comparar:** o `normalize()` de [`starting-inventory.ts`](../../../apps/api/src/character/starting-inventory.ts) (lowercase + remove diacríticos) já existe para isso.
- **`configForLocale`** ([`system-locale.ts`](../../../apps/api/src/system/system-locale.ts)) é o ponto onde o locale vira config; a migração monta o índice a partir de `config` + `configLocales`, sem passar por ele (ela precisa dos dois ao mesmo tempo, não de um).
- `getClassFeatures`/`getClassSpells` mantêm a assinatura e o match tolerante por `CLASS_SYNONYMS`; muda só o que devolvem (chaves em vez dos objetos).
- **O `retired` não entra na criação:** `getClassFeatures` lê `classFeatures`, nunca `retiredFeatures`. Personagem novo não nasce com conteúdo aposentado.
- **Os dois locales não estão no mesmo registro:** medido em 02/08/2026, a descrição de feature tem mediana de **57 caracteres em pt-BR** (a paráfrase curta herdada do seed) e **426 em en-US** (o texto de regra cru do dataset). Trocar para EN aumenta a ficha e o prompt. É assimetria de conteúdo, registrada no [ADR 004 §3.1](../../adr/004-origem-do-dado-de-sistema.md); não tente resolvê-la aqui.
- Lembre do `dist`: mexeu em `packages/shared` ou `packages/ai-engine`, rebuild antes de testar pela API.

---

## Questões em aberto

1. ~~**Item que não casa na migração** — descartar, ou manter o texto num campo de escape?~~
   > **Decidido em 02/08/2026: nenhum dos dois.** A pergunta pressupunha uma categoria única de "item que não casa"; a análise achou **três origens distintas**, cada uma com conserto próprio e nenhuma precisando de escape: texto EN em ficha pt-BR é **bug de índice** (*Migração* §1), item de classe ambígua é **bug de escopo** (§2), e item legado de origem incomum tem **destino nomeado** (§3): as 2 features voltam pelo catálogo vivo com a união do [ADR 009](../../adr/009-uniao-dos-srd-5-1-e-5-2.md), os 7 truques viram entrada autoral do Free na [US-106](./US-106-catalogo-com-chave-e-free-herdando-o-srd.md). A quarta origem que a pergunta original previa, "o `config` do Free não tem chave", deixou de existir com o [ADR 004 §3.1](../../adr/004-origem-do-dado-de-sistema.md). Se a contagem prévia (§4) achar item fora dessas origens, aí sim é caso novo — e o certo é entendê-lo, não escapá-lo.
2. **Kits iniciais no inventário** seguem o mesmo defeito das features (texto copiado do `config`), mas com duas complicações que feature/magia não têm: misturam-se com itens ganhos em jogo, que não têm chave, e a fonte deles é **OGL 1.0a** ([US-51](./US-51-kits-iniciais-do-srd.md)), fora da fronteira CC do ADR 004. Vale separar as duas origens no inventário, ou é complexidade a mais para pouco ganho?
3. **`race`/`class` guardam texto cru** (o ADR 005 dizia o contrário; corrigido em 30/07/2026).
   > **Decidido: story separada — [US-105](./US-105-raca-e-classe-por-chave-do-srd.md)**, escrita em 02/08/2026. Ela vai além do que esta questão previa: o catálogo de raça e de classe passa a vir do **SRD** (`Species.json` do Open5e + o `CharacterClass.json` que o `sync` já baixa), apagando as listas literais em pt-BR do `SetupWizard`. Achado que motivou a ampliação: as listas do wizard **divergem do SRD 2024** — oferecem Meio-Orc e Meio-Elfo, que a edição retirou, e não oferecem Goliath nem Orc, que ela tem.

---

## Referências no código

- [`apps/api/src/character/character.service.ts:31-34`](../../../apps/api/src/character/character.service.ts) — materializa feature/magia como texto na criação; `:42-43` grava `race`/`class` crus.
- [`apps/api/src/character/starting-inventory.ts:71`](../../../apps/api/src/character/starting-inventory.ts) e `:88` — `getClassFeatures` / `getClassSpells`, que passam a devolver chaves; `:4` — o `normalize()` que a migração reusa.
- [`packages/shared/src/types/system.ts:27`](../../../packages/shared/src/types/system.ts) e `:36` — os dois schemas sem chave.
- [`scripts/srd/ingest.mjs:168`](../../../scripts/srd/ingest.mjs) e `:190` — onde a chave (`_slug`) é calculada e depois removida do artefato (a [US-106](./US-106-catalogo-com-chave-e-free-herdando-o-srd.md) a preserva); `:206` — a detecção de órfãos, que é como os 9 itens de origem incomum apareceram.
- [`scripts/srd/locale/pt-BR.json`](../../../scripts/srd/locale/pt-BR.json) — overlay curado; contém o PT dos 9 itens legados de origem incomum (2 features do 5.1 e 7 truques de fora do SRD).
- [`apps/api/prisma/seed.ts`](../../../apps/api/prisma/seed.ts) — `freeClassFeatures`/`freeClassSpells`/`CANTRIP_CATALOG`, que viram listas de chaves (ADR 004, 6a).
- [`apps/web/src/app/play/[adventureId]/page.tsx:43`](../../../apps/web/src/app/play/%5BadventureId%5D/page.tsx) — `buildSkillSheet`: o padrão de resolução na leitura que esta story copia.
- [`apps/api/src/ai/ai.service.ts:322-325`](../../../apps/api/src/ai/ai.service.ts) — segundo consumidor da ficha (o prompt); `:592` — a tool `getSpell`, que busca por nome.
- [`apps/api/src/system/system-locale.ts`](../../../apps/api/src/system/system-locale.ts) — `configForLocale`, o ponto onde o locale escolhe o artefato.
