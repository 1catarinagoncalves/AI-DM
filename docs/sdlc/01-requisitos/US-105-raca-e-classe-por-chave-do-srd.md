# US-105 — Raça e classe vêm do catálogo do SRD e são guardadas por chave

**Épico:** 1 — Personagem
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** [US-99](./US-99-config-do-sistema-no-locale-ativo.md) (**obrigatória e anterior**: o wizard e a ficha resolvem a label a partir do `config` do locale) · [US-47](./US-47-ingestao-srd-como-dado.md) (é o pipeline `sync`+`ingest` que passa a derivar os dois catálogos) · [US-54](./US-54-chaves-canonicas-em-ingles.md) ✅ (a chave de classe já é EN — esta story só a leva para dentro do `Character`) · [ADR 009](../../adr/009-uniao-dos-srd-5-1-e-5-2.md) (**esta story é o primeiro cliente**: é ela que constrói a fusão dos dois SRD que a regra exige)
**Relacionada a:** [US-100](./US-100-ficha-do-personagem-no-locale-ativo.md) (**é a *Questão em aberto* #2 dela**, separada por recomendação da própria story — mesmo padrão "chave na ficha, label na leitura", conteúdo diferente) · [US-98](./US-98-i18n-da-interface-web.md) (foi ela que deixou as listas literais em pt-BR no wizard, com o motivo escrito) · [US-27](./US-27-pericias-do-personagem.md) (`validateSkills` é o modelo de validação contra catálogo) · [US-28](./US-28-aventura-inicial-baseada-na-classe.md), [US-41](./US-41-features-traits-de-classe.md), [US-42](./US-42-magias-conhecidas.md) (os três consumidores do `CLASS_SYNONYMS`) · [ADR 003](../../adr/003-sistemas-como-dado.md) (catálogo é dado, não código) · [ADR 004](../../adr/004-origem-do-dado-de-sistema.md) (o dado vem do Open5e por pipeline pinado) · [ADR 005](../../adr/005-locale-como-dimensao.md) (D2 — o ADR afirmava que raça/classe já eram chave; **errado, corrigido em 30/07/2026**)
**Criada em:** 2026-08-02

---

## História

> **Como** jogador que trocou o idioma para inglês,
> **quero** que a ficha diga "Dwarf" e "Wizard" em vez de "Anão" e "Mago",
> **para que** a última linha em português não fique cravada no cabeçalho de uma mesa inglesa — e para que a lista de raças que escolho seja a do SRD que o jogo usa, não uma cópia manual desatualizada.

---

## Contexto e motivação

### O defeito

`Character.race` e `Character.class` guardam **o texto cru do jogador**, e nada o re-deriva depois:

- [`character.service.ts:42-43`](../../../apps/api/src/character/character.service.ts) — `race: dto.race, class: dto.class`, direto do DTO para o banco.
- [`character.schema.ts:24`](../../../apps/api/src/character/character.schema.ts) e `:25` — `z.string().min(1).max(40)` nos dois. O contrato aceita qualquer texto; não há catálogo contra o que validar.
- [`page.tsx:52-53`](../../../apps/web/src/app/play/%5BadventureId%5D/page.tsx) — a ficha exibe esse texto cru.
- [`ai.service.ts:318`](../../../apps/api/src/ai/ai.service.ts) e [`adventure.service.ts:115`](../../../apps/api/src/adventure/adventure.service.ts) — o prompt do Mestre recebe esse texto cru.

Um personagem criado como "Paladino" continua "Paladino" na ficha e na narração depois de trocar para inglês. É exatamente o defeito que a [US-100](./US-100-ficha-do-personagem-no-locale-ativo.md) conserta para feature e magia, no campo que ela deixou de fora.

### A camada que existe hoje é um matcher, não um catálogo

`CLASS_SYNONYMS` ([`starting-inventory.ts:29`](../../../apps/api/src/character/starting-inventory.ts)) casa trecho normalizado do texto livre contra a chave canônica (`'mag'` → `wizard`) em tempo de **leitura**, e alimenta quatro consumidores: `getStartingInventory` (`:54`), `getClassFeatures` (`:71`), `getClassSpells` (`:88`) e `resolveInitialHook` (`:106`). Ele resolve a **mecânica** — nada nele reescreve `Character.class`.

Para **raça não existe equivalente nenhum**. Uma varredura por `character.race` acha só o prompt, a ficha e a listagem do hub ([`character.service.ts:130`](../../../apps/api/src/character/character.service.ts)): raça hoje é puramente decorativa, o que explica por que o buraco passou despercebido.

### Por que a fonte tem de ser o SRD

O `config` do D&D 5e inteiro já vem do Open5e por pipeline pinado ([ADR 004](../../adr/004-origem-do-dado-de-sistema.md)), e catálogo de espécie e de classe é precisamente o tipo de coisa que o [ADR 003](../../adr/003-sistemas-como-dado.md) classifica como **dado, não código**. Só que hoje ele é código: duas listas literais dentro de um componente React.

```ts
// apps/web/src/components/setup/SetupWizard.tsx:21-22
const RACES = ['Anão', 'Meio-Orc', 'Elfo', 'Halfling', 'Humano', 'Dragonborn', 'Gnomo', 'Meio-Elfo', 'Tiefling'] as const
const CLASSES = ['Bárbaro', 'Bardo', 'Clérigo', 'Druida', 'Guerreiro', 'Monge', 'Paladino', 'Patrulheiro', 'Ladino', 'Feiticeiro', 'Bruxo', 'Mago'] as const
```

O comentário acima delas ([US-98](./US-98-i18n-da-interface-web.md)) explica por que ficaram em português mesmo depois da i18n: **o valor PT viaja para a API** porque o `CLASS_SYNONYMS` só conhece palavras portuguesas, e mandar o rótulo traduzido faria a classe cair no kit `default` sem erro à vista. Ou seja: a lista está em PT por causa do matcher, e o matcher existe por causa do texto livre. Trocar as duas coisas por um catálogo com chave resolve as três de uma vez.

### E as listas estão erradas

`Species.json` do Open5e `v2.1.0` (medido em 02/08/2026) tem **9 espécies**; `CharacterClass.json` com `subclass_of: null` tem **12 classes**.

| Wizard (`RACES`) | SRD 2024 (`srd-2024/Species.json`) |
|---|---|
| Anão, Elfo, Halfling, Humano, Dragonborn, Gnomo, Tiefling | ✅ `dwarf`, `elf`, `halfling`, `human`, `dragonborn`, `gnome`, `tiefling` |
| **Meio-Orc**, **Meio-Elfo** | ❌ a edição 2024 os retirou |
| *(ausentes do wizard)* | ⚠️ `goliath`, `orc` |

**7 das 9 casam.** Hoje o jogador não pode criar um Goliath que o SRD tem. As 12 classes, essas, batem 1:1 (`Barbarian`…`Wizard`).

### A segunda fonte está no mesmo tag

Meio-Elfo e Meio-Orc **não são invenção do wizard**: são espécies do SRD 5.1 (2014), e o Open5e as serve no **mesmo repositório, no mesmo tag pinado**, em `data/v2/wizards-of-the-coast/srd-2014/` — irmão do `srd-2024/` que o `sync` já usa. `srd-2014/Species.json` tem **13 registros: 9 raiz + 4 subespécies** (`high-elf`, `hill-dwarf`, `lightfoot`, `rock-gnome`).

| | SRD 5.1 (2014) | SRD 5.2 (2024) | União das raízes |
|---|---|---|---|
| Comuns às duas | dragonborn, dwarf, elf, gnome, halfling, human, tiefling (7) | idem | 7 |
| Só nesta edição | **half-elf**, **half-orc** | **goliath**, **orc** | +4 |
| Raízes | 9 | 9 | **11** |

> **Decidido: a união das 11**, e a regra foi generalizada para todo domínio no **[ADR 009](../../adr/009-uniao-dos-srd-5-1-e-5-2.md)**. O resto desta seção é o levantamento que sustentou a decisão.

Três fatos que a decisão levou em conta (medidos em 02/08/2026, tag `v2.1.0`):

- **Licença: compatível.** `srd-2014/Document.json` declara `licenses: ["cc-by-40", "ogl-10a"]` — dual, e a via CC-BY-4.0 é a que interessa. Puxar de lá **não** viola a regra de licença única do [`NOTICE-open5e.md`](../../../scripts/srd/NOTICE-open5e.md) ("nenhum material OGL 1.0a entra aqui"); exige apenas somar o SRD 5.1 à atribuição.
- **Colisão de chave, e ela é útil.** O `pk` do 2014 é `srd_dwarf`; o do 2024, `srd-2024_dwarf`. Tirando o prefixo, as 7 comuns colapsam sozinhas na mesma chave — só as 4 exclusivas precisam de regra de precedência.
- **As mecânicas divergem, e isso é a dívida futura.** `srd-2014/SpeciesTrait.json` tem 93 traços contra 51 do 2024, e o traço `Ability Score Increase` (o half-elf ganha +2 Carisma) **existe só no 2014** — a edição 2024 moveu o bônus de atributo para o antecedente. Enquanto esta story trata só de **rótulo**, misturar as edições não custa nada. Quando a story de traços chegar, um catálogo misto vira duas mecânicas incompatíveis no mesmo sistema.

---

## Escopo

### Dentro do escopo

- **A fusão dos dois SRD no `ingest`** ([ADR 009](../../adr/009-uniao-dos-srd-5-1-e-5-2.md)): normalizar o `pk` por documento (`srd_x` / `srd-2024_x` → `x`), aplicar o `SRD_EQUIVALENTS`, e fundir com o 5.2 tendo precedência. É esta story que constrói o mecanismo; os outros domínios o herdam.
- **`sync.mjs` baixa `Species.json` dos dois documentos** do mesmo tag pinado (`TAG = 'v2.1.0'`), ao lado dos 6 arquivos atuais. `CharacterClass.json` já é baixado (do `srd-2024`) — hoje só serve para validar o `CLASS_MAP`; passa a ser fonte do catálogo também. As 12 classes base são idênticas nas duas edições, então classe **não** precisa do par 2014.
- **`NOTICE-open5e.md` atribui os dois documentos**, pela via CC-BY-4.0 de cada um — junto com o commit que traz o dado 5.1, nunca antes.
- **`ingest.mjs` deriva dois campos novos** do `SystemConfig`: `races` e `classes`, cada um `{key, label}[]` ordenado por `key` (idempotência byte-a-byte, critério da [US-47](./US-47-ingestao-srd-como-dado.md)). A chave da classe sai do `CLASS_MAP` que já existe; a da espécie, do `pk` sem o prefixo `srd-2024_`.
- **Labels no overlay pt-BR**, no mesmo formato de `attributes`/`skills` (mapa chave → string): `"dwarf": "Anão"`, `"wizard": "Mago"`. 21 entradas, curadas à mão.
- **`SystemConfig` ganha `races` e `classes`**, opcionais como `skills` — config legado sem eles não pode ficar inválido.
- **O wizard perde as listas literais** e lê o catálogo do `config` do sistema escolhido, que já chega no locale ativo pela [US-99](./US-99-config-do-sistema-no-locale-ativo.md). Some o motivo documentado no comentário da US-98: o `value` do select passa a ser a **chave**, e a label é o texto localizado.
- **`Character.race` e `Character.class` passam a guardar a chave.**
- **Validação contra o catálogo no service**, espelhando `validateSkills` ([`character.service.ts:82`](../../../apps/api/src/character/character.service.ts)): chave fora do catálogo é `BadRequestException`, não gravação silenciosa, **e não há caminho alternativo** — o catálogo é fechado (*Questões em aberto* #2). O `max(40)` do schema continua como guarda de trust boundary.
- **Resolução na leitura** nos quatro consumidores: ficha (`page.tsx:52-53`), hub (`character.service.ts:130`), prompt (`ai.service.ts:318`) e criação de aventura (`adventure.service.ts:115`).
- **Os quatro consumidores do `CLASS_SYNONYMS` recebem a chave direta.** O matcher deixa de ser o caminho normal (ver *Questões em aberto* #3).
- **Migração de dados** das fichas existentes: o texto PT vira chave. Classe tem o `CLASS_SYNONYMS` para reaproveitar; raça precisa de um mapa novo, e "Meio-Orc"/"Meio-Elfo" não têm destino no SRD 2024 (*Questões em aberto* #1).
- Testes: mesma ficha lida em `pt-BR` e `en-US` devolve `'Anão'`/`'Dwarf'`; criação rejeita chave fora do catálogo; migração de ficha PT legada não perde personagem.

### Fora do escopo

- **Traços de espécie.** `srd-2024/SpeciesTrait.json` tem 51 traços das 9 espécies (`Size`, `Speed`, `Darkvision`…). É mecânica de personagem, não rótulo — story própria, e a primeira que faria raça deixar de ser decorativa. É também onde a divergência entre as edições passa a doer (ver acima).
- **Subespécies.** As 9 do SRD 2024 são todas raiz. O SRD 2014 traz 4 (`high-elf`, `hill-dwarf`, `lightfoot`, `rock-gnome`) — se a #1 fechar na união, elas entram como **fora do catálogo**, filtradas por `subspecies_of !== null`, do mesmo jeito que o `ingest` já filtra subclasse em `buildClassFeatures`. Oferecer subespécie é escolha de produto, não consequência da fonte.
- **`Background.json` / `BackgroundBenefit.json` do SRD.** O background deste projeto é texto autoral do jogador, por decisão da [US-39](./US-39-identidade-narrativa-background-ideais.md); catálogo de antecedente é outra conversa.
- **Tradução automática das 21 labels.** `races`/`classes` guardam **string crua** no overlay, igual a `attributes`/`skills` — e por isso ficam fora do `MT_DOMAINS` da [US-52](./US-52-traducao-automatica-do-srd.md) pelo mesmo motivo que elas: string crua não tem onde carregar a marca `_mt`. São 21 rótulos de uma palavra, traduzidos uma vez.
- **`name`, `background` e `EventLog`** — congelam por decisão ([ADR 005](../../adr/005-locale-como-dimensao.md) D2 e [ADR 002](../../adr/002-memoria-de-sessao.md)), não por pendência.
- **Campo de escape para raça ou classe fora do catálogo** (chave `custom` + texto livre). Decidido em 03/08/2026 que não existe (*Questões em aberto* #2): o catálogo é fechado ao jogador, e conteúdo novo entra pelo catálogo do sistema ([US-106](./US-106-catalogo-com-chave-e-free-herdando-o-srd.md)), com chave e label nos dois locales.
- **Gênero.** `GENDERS` ([`SetupWizard.tsx:20`](../../../apps/web/src/components/setup/SetupWizard.tsx)) também é lista literal em PT, mas não é dado de SRD — não tem catálogo de onde vir. Fica como está.

---

## Modelo de dados proposto

```jsonc
// Character.race / Character.class — antes
{ "race": "Anão", "class": "Mago" }
// depois
{ "race": "dwarf", "class": "wizard" }

// SystemConfig — campos novos
"races":   [{ "key": "dragonborn", "label": "Draconato" }, { "key": "dwarf", "label": "Anão" }, …],
"classes": [{ "key": "barbarian",  "label": "Bárbaro"   }, { "key": "bard",  "label": "Bardo" }, …]
```

| Campo | Antes | Depois |
|---|---|---|
| `Character.race` | texto livre em PT | chave (`dwarf`) |
| `Character.class` | texto livre em PT | chave (`wizard`) |
| `SystemConfig.races` | — | `{key, label}[]` (9 no SRD 2024) |
| `SystemConfig.classes` | — | `{key, label}[]` (12) |
| `SetupWizard.RACES/CLASSES` | literais em PT no componente | apagados; vêm do `config` |

**Persistência:** `race` e `class` já são `String` no Prisma — muda o **conteúdo**, não o tipo. Não há migração de schema; há migração de dados, o passo caro (igual à [US-100](./US-100-ficha-do-personagem-no-locale-ativo.md)). Nenhum campo novo no `Character`: a ficha continua sem locale próprio, porque fala o do `User` ([ADR 005](../../adr/005-locale-como-dimensao.md), decisão 5).

---

## Critérios de aceite

- [x] `sync.mjs` baixa `Species.json` dos dois documentos do tag pinado, e o `ingest` deriva `races` (**11**) e `classes` (12) no `config`, com label do overlay e ordenação estável (artefato idempotente byte-a-byte).
- [x] **A fusão obedece ao [ADR 009](../../adr/009-uniao-dos-srd-5-1-e-5-2.md):** as 7 espécies comuns saem do 5.2 (não do 5.1), e `half-elf`/`half-orc` entram só porque não existem no 5.2. Teste que falha se a precedência inverter.
- [x] O [`NOTICE-open5e.md`](../../../scripts/srd/NOTICE-open5e.md) cita o SRD 5.1 junto do 5.2, pela via **CC-BY-4.0** — e continua verdadeiro que nenhum material OGL 1.0a entrou.
- [x] `SystemConfig` aceita config **sem** `races`/`classes` (campos opcionais) — nenhum config legado fica inválido.
- [x] O wizard não tem mais lista literal de raça nem de classe; as opções vêm do `config` do sistema escolhido, no idioma ativo, e o `value` enviado é a chave.
- [x] Personagem novo grava **chave** em `race` e `class`; chave fora do catálogo é rejeitada com `BadRequestException` (não gravada) — **sem caminho de escape**: não existe chave `custom` nem campo de texto livre para raça ou classe.
- [x] A mesma ficha, lida com `locale = 'pt-BR'` e com `locale = 'en-US'`, mostra `'Anão'`/`'Dwarf'` e `'Mago'`/`'Wizard'` — sem tocar no banco entre as duas leituras.
- [x] O prompt do Mestre e o hub recebem o nome no locale ativo, pela mesma resolução.
- [x] Kit inicial, features, magias e gancho de aventura continuam corretos com a chave direta — sem regressão em nenhuma das 12 classes.
- [x] Fichas existentes migram: nenhuma perde raça ou classe em silêncio; o que não casar tem destino explícito e registrado (*Questões em aberto* #1). O script é [`prisma/migrate-race-class-keys.ts`](../../../apps/api/prisma/migrate-race-class-keys.ts) — **contagem por padrão**, escreve só com `--write`, e ficha sem destino é relatada e **não** tocada.
- [x] **Teste de regressão:** ficha com raça e classe lida nos dois locales, afirmando os quatro nomes; criação com chave inválida; ficha PT legada passada pela migração, afirmando que virou chave e resolve de volta para o mesmo texto PT. Falha se o texto voltar a ser gravado cru.

---

## O que a implementação decidiu (03/08/2026)

Três coisas que a spec não fixava e o código teve de resolver:

- **O Free herda `races`/`classes` do artefato pt-BR.** Ele nunca teve catálogo próprio dos dois
  — as listas viviam no wizard e valiam para todo sistema —, e com o wizard lendo do `config` ele
  ficaria com dois selects vazios. Duplicar 23 literais no `seed.ts` seria recriar no dado o
  problema que a story tirou do componente. A herança dos domínios curados (features, magias)
  continua sendo a [US-106](./US-106-catalogo-com-chave-e-free-herdando-o-srd.md).
- **Fallback quando o config não tem catálogo.** `races`/`classes` são opcionais, então a validação
  do service **aceita o que vier** quando o catálogo está ausente, e `catalogLabel` devolve a
  própria chave. É o que impede um banco ainda não re-semeado de parar de criar personagem; some
  no primeiro `db:seed`. Não é escape de catálogo (*Questões em aberto* #2): com catálogo presente,
  chave desconhecida é rejeitada sem alternativa.
- **A migração exige o seed antes, e falha alto dizendo isso.** Sem `races`/`classes` no
  `System.config`, toda ficha sairia como "sem destino" e o relatório viraria ruído.

**Ordem de execução em cada ambiente:**

```bash
pnpm db:seed && pnpm db:migrate:race-class && pnpm db:migrate:race-class --write
```

---

## Notas de implementação

> *Dicas e decisões técnicas para quem vai implementar. Não é especificação obrigatória — o implementador pode divergir com boa justificativa.*

- **Copie `skills`, ponta a ponta.** Perícia já faz tudo o que esta story precisa: catálogo `{key, label}` no config, chave no `Character`, validação contra o catálogo no service (`validateSkills`), resolução na leitura. Não invente um caminho novo para raça e classe.
- **O `CLASS_MAP` do ingest já é o catálogo de classes** ([`ingest.mjs:34`](../../../scripts/srd/ingest.mjs)) — falta só emitir `{key, label}` em vez de usá-lo apenas para validar. A label EN vem de `CharacterClass.json` (`fields.name`), a PT do overlay, pelo mesmo `resolve()` que `attributes` e `skills` usam.
- **`Species.json` é minúsculo** (1,5 KB / 9 registros no 2024; 3,8 KB / 13 no 2014) e tem **`desc` vazio** — não espere descrição de espécie de lá; ela está no `SpeciesTrait.json`, que está fora do escopo.
- **A precedência é 2024 primeiro** ([ADR 009](../../adr/009-uniao-dos-srd-5-1-e-5-2.md) D2). Carregue o `srd-2024` e só então some do `srd-2014` a chave que ainda não existe. As 7 comuns ficam com o registro da edição corrente sem nenhum caso especial, e só `half-elf`/`half-orc` entram pela porta dos fundos.
- **Em espécie o `SRD_EQUIVALENTS` fica vazio — não conclua daí que é dispensável.** As 7 comuns têm slug idêntico nas duas edições, então a fusão de espécies funcionaria sem mapa nenhum. Mas o mecanismo que você escreve aqui vai servir `Spell` e `ClassFeature`, onde **12 das 14 features de classe base "exclusivas do 5.1" são renomeação** (ADR 009 §4). Deixe o mapa existir vazio, com o comentário, em vez de descobrir isso na story seguinte.
- **Faça a contagem da migração antes de escrever**, como a US-100 recomenda: quantas fichas têm cada raça e cada classe, quantas não casam. É esse número que decide a *Questão em aberto* #1.
- **Reordene as duas etapas do wizard com cuidado:** hoje a etapa `race-class` não depende do sistema escolhido; depois passa a depender (é o `config` que traz as opções). O passo `system` já vem antes na lista de `steps`, então a ordem serve — mas o estado precisa limpar raça/classe se o jogador voltar e trocar de sistema.
- **Lembre do `dist`:** mexeu em `packages/shared`, rebuild antes de testar pela API. E mexeu no ingest, rode `pnpm srd:ingest` e revise o diff do artefato.

---

## Questões em aberto

1. **Catálogo só-2024 (9 espécies), ou união 2014+2024 (11)?** Meio-Elfo e Meio-Orc saíram na edição 2024, mas **têm fonte CC-BY no mesmo tag pinado** (`srd-2014/Species.json`) — não é preciso escolher entre "SRD" e "manter as opções que os jogadores já têm".

   | | Só 2024 (9) | União das raízes (11) |
   |---|---|---|
   | Opções que o jogador perde | Meio-Elfo, Meio-Orc | nenhuma |
   | Opções que ganha | Goliath, Orc | Goliath, Orc |
   | Fichas legadas sem destino | as com Meio-Elfo/Meio-Orc | nenhuma |
   | `sync` | 1 `Species.json` | 2, com precedência de chave |
   | `NOTICE` | como está | soma o SRD 5.1 à atribuição |
   | Coerência com `System.version = '5.2'` | ✅ íntegra | ⚠️ catálogo de espécie mistura edições |
   | Dívida na story de traços | nenhuma | duas mecânicas (o ASI por raça só existe no 2014) |

   Sugestão: **união**, com a origem registrada por espécie no catálogo. O custo hoje é uma linha de precedência no `ingest` e um parágrafo no `NOTICE`; o custo de sair só-2024 é quebrar fichas existentes e tirar do jogador duas raças clássicas por um detalhe de edição que ele não pediu. A incoerência com o `5.2` é real mas contida: **enquanto o catálogo for só rótulo, não há mecânica para divergir.** A story de traços é que precisa decidir de verdade — e é melhor que decida com as 11 na mesa do que redescubra as duas depois.

   > **Decidido em 02/08/2026: união das 11.** E a regra foi generalizada para além de espécie — virou o **[ADR 009](../../adr/009-uniao-dos-srd-5-1-e-5-2.md)**: a fonte do dado 5e passa a ser a união do `srd-2024` e do `srd-2014` do mesmo tag pinado, **em todos os domínios**, com o 5.2 vencendo sempre que os dois descreverem a mesma coisa.
   >
   > Duas consequências que caem nesta story, porque ela é o **primeiro cliente** da regra:
   >
   > - **Ela constrói a fusão**, não só o catálogo de espécies. A normalização de `pk` por documento, o `SRD_EQUIVALENTS` e a precedência entram no `ingest` aqui; os outros domínios os herdam.
   > - **O `SRD_EQUIVALENTS` é obrigatório desde o primeiro commit.** A medição do ADR 009 mostrou que conceito idêntico mudou de slug entre as edições (`draconic-bloodline` → `draconic-sorcery`, `bard_cantrips-known` → `bard_cantrips`): precedência por chave crua **duplicaria** o conceito em vez de deduplicá-lo. Em espécies isso não morde (as 7 comuns têm slug idêntico), mas a fusão nasce servindo `Spell` e `ClassFeature` também.
2. ~~**Raça fora do catálogo continua possível?**~~ Se sim, seria preciso um campo de escape (chave `custom` + texto), e esse texto **nunca** acompanharia o idioma. Se não, e caso a #1 tivesse fechado só-2024, seria perda dura. As duas se decidiam juntas.

   > **Decidido em 03/08/2026: não. O catálogo é fechado.** `race` e `class` só aceitam chave do catálogo do sistema — não há campo de escape, nem chave `custom`, nem texto livre ao lado. Quatro consequências:
   >
   > - **A validação do service é a única porta, e não tem exceção.** Chave fora do catálogo é `BadRequestException` sempre — não existe caminho "grava como custom". O `select` do wizard fica fechado, sem campo livre ao lado.
   > - **Não é perda dura, porque a #1 fechou na união das 11.** Meio-Elfo e Meio-Orc continuam no catálogo pelo `srd-2014` ([ADR 009](../../adr/009-uniao-dos-srd-5-1-e-5-2.md)). As duas decisões só eram acopladas no cenário só-2024, que não é o que ficou.
   > - **O "meio-elfo do norte" da [US-100](./US-100-ficha-do-personagem-no-locale-ativo.md) não some — muda de campo.** A raça é `half-elf`; "do norte" é procedência, e procedência é texto autoral do jogador, que já tem lugar: o `background`, que congela por decisão ([ADR 005](../../adr/005-locale-como-dimensao.md) D2). Raça responde *o quê*; background responde *de onde*. Guardar as duas coisas no mesmo campo é o que produziu o texto cru que esta story conserta.
   > - **Fechado ao jogador, não à curadoria.** Raça nova entra pelo **catálogo do sistema**, não pela ficha: a [US-106](./US-106-catalogo-com-chave-e-free-herdando-o-srd.md) já dá o mecanismo (entrada própria bilíngue, `source: 'authored'`), e ela nasce com chave e label nos dois locales — que é exatamente o que o campo de escape não teria.
   >
   > Efeito na migração: ficha legada que não casar **não** tem para onde escapar. O destino de cada texto é explícito ou o registro é tratado à mão — é por isso que a contagem prévia (*Notas de implementação*) vem antes do código.
3. **O `CLASS_SYNONYMS` sobrevive?** Com a chave gravada na ficha, os quatro consumidores fazem lookup direto e o matcher de substring perde o cliente principal. Ele ainda serviria como camada de migração (rodar uma vez) e como tolerância a sistema custom que não use as chaves do SRD. Sugestão: **manter só para a migração**, e apagar do caminho de leitura — matcher de substring que casa `'mag'` é dívida esperando um sistema com uma classe chamada "Magistrado".

---

## Referências no código

- [`apps/web/src/components/setup/SetupWizard.tsx:21`](../../../apps/web/src/components/setup/SetupWizard.tsx) e `:22` — as duas listas literais que esta story apaga; o comentário em `:15-19` explica por que estão em PT.
- [`apps/api/src/character/character.service.ts:42-43`](../../../apps/api/src/character/character.service.ts) — grava `race`/`class` crus; `:82` — `validateSkills`, o modelo a copiar; `:130` — o hub, terceiro consumidor.
- [`apps/api/src/character/character.schema.ts:24`](../../../apps/api/src/character/character.schema.ts) e `:25` — o contrato de texto livre.
- [`apps/api/src/character/starting-inventory.ts:29`](../../../apps/api/src/character/starting-inventory.ts) — `CLASS_SYNONYMS`; `:54`, `:71`, `:88` e `:106` — os quatro consumidores dele.
- [`packages/shared/src/types/system.ts`](../../../packages/shared/src/types/system.ts) — `SystemConfigSchema`, onde `races` e `classes` entram (e `SystemSkillSchema` é o formato a espelhar).
- [`scripts/srd/sync.mjs`](../../../scripts/srd/sync.mjs) — a lista `FILES`, que ganha `Species.json`.
- [`scripts/srd/ingest.mjs:34`](../../../scripts/srd/ingest.mjs) — o `CLASS_MAP`, que vira catálogo.
- [`scripts/srd/locale/pt-BR.json`](../../../scripts/srd/locale/pt-BR.json) — onde entram as 21 labels PT.
- [`apps/web/src/app/play/[adventureId]/page.tsx:52-53`](../../../apps/web/src/app/play/%5BadventureId%5D/page.tsx) — a ficha exibindo o texto cru.
- [`apps/api/src/ai/ai.service.ts:318`](../../../apps/api/src/ai/ai.service.ts) e [`apps/api/src/adventure/adventure.service.ts:115`](../../../apps/api/src/adventure/adventure.service.ts) — o texto cru chegando ao prompt.
