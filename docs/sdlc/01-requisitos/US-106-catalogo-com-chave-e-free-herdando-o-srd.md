# US-106 — O catálogo carrega chave e procedência; o Free monta o dele de mais de uma fonte

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** [US-47](./US-47-ingestao-srd-como-dado.md) ✅ (o pipeline `sync`+`ingest` e o overlay já existem — esta story só para de jogar fora o que ele calcula) · [US-99](./US-99-config-do-sistema-no-locale-ativo.md) ✅ (são **dois** artefatos por locale e um `configLocales` para servi-los; sem isso o Free não tem onde guardar o pt-BR) · [US-105](./US-105-raca-e-classe-por-chave-do-srd.md) ✅ (**anterior**: é ela que construiu a união do [ADR 009](../../adr/009-uniao-dos-srd-5-1-e-5-2.md) — mas **só no domínio `races`**, então 2 features do Free continuam fora do artefato e entram aqui como autorais, ver *Questões em aberto* #1. Ela também deixou uma ponta para cá: os `races`/`classes` do Free vieram do artefato **pt-BR**, porque o Free ainda não tem `configLocales`)
**Implementa:** [ADR 004 §3.1](../../adr/004-origem-do-dado-de-sistema.md) — a revisão de 02/08/2026 da decisão 6 (o Free herda o SRD), decisões **6a** a **6h**, **estendida** aqui para o conteúdo que não vem do SRD (ver *A proposta*).
**Relacionada a:** [US-100](./US-100-ficha-do-personagem-no-locale-ativo.md) (**é a consumidora**: sem `key` no artefato a ficha não tem o que guardar — esta story é pré-requisito dela) · [US-52](./US-52-traducao-automatica-do-srd.md) (o pipeline de tradução que esta story torna bidirecional) · [US-51](./US-51-kits-iniciais-do-srd.md) (os kits **não** entram: fonte OGL, fora da fronteira CC) · [US-27](./US-27-pericias-do-personagem.md) (as perícias do Free já são chave — só o rótulo estava preso) · [ADR 009](../../adr/009-uniao-dos-srd-5-1-e-5-2.md) (D5 já prevê "um campo de origem no próprio catálogo") · [ADR 003](../../adr/003-sistemas-como-dado.md) (catálogo é dado) · [ADR 005](../../adr/005-locale-como-dimensao.md) (D3 — EN é a base, pt-BR é overlay)
**Criada em:** 2026-08-02

---

## História

> **Como** jogador do sistema Free que trocou o idioma para inglês,
> **quero** que o meu personagem também troque — inclusive nos truques que o Free tem e o SRD não,
> **para que** "Free" não seja justamente o sistema em que o seletor de idioma não faz nada.

---

## Contexto e motivação

### Defeito 1 — a chave é calculada e descartada

O `ingest` conhece a chave de cada feature (`${classe}_${slug}`, ex.: `paladin_lay-on-hands`) e de cada magia (o slug do dataset). Usa-a para casar o overlay, para detectar órfãos e para ordenar — e **remove o campo antes de gravar**:

- [`ingest.mjs:168`](../../../scripts/srd/ingest.mjs) — `.map(({ _slug, ...e }) => e)` nas features; `:190` — o mesmo nas magias.
- [`system.ts:27`](../../../packages/shared/src/types/system.ts) — `SystemClassFeatureSchema` é `{name, description}`; `:36` — `SystemSpellSchema` é `{name, level?, description?}`.

O artefato sai sem identificador. Quem consome o `config` só tem o texto de um idioma — que é exatamente o buraco que a [US-100](./US-100-ficha-do-personagem-no-locale-ativo.md) não consegue tapar sozinha.

### Defeito 2 — o Free é monolíngue por construção

O `freeConfig` ([`seed.ts:375`](../../../apps/api/prisma/seed.ts)) é literal **em pt-BR**, gravado na coluna `config` — que a [ADR 005](../../adr/005-locale-como-dimensao.md) (D3) define como a **base EN** — e o upsert do Free **não passa `configLocales`** (`:422-429`). O comentário no próprio seed registra a decisão de então: *"o Free é um snapshot PT escrito à mão, não tem base EN de onde sair — a leitura cai no `?? config` e serve o PT nos dois locales"*.

| Campo do Free | Estado hoje | Efeito na tela |
|---|---|---|
| `attributes`, `skills` | chave certa, **rótulo PT congelado** | jogador em EN escolhe "Atletismo" e "Força" |
| `classFeatures`, `classSpells` | **sem chave**, texto PT | ficha nunca acompanha o idioma — nem depois da US-100 |
| `startingKits`, ganchos | literais de produto | fora desta story (e da US-100) |

### Defeito 3 — "herdar o SRD" não cobre o Free inteiro

A [revisão da decisão 6](../../adr/004-origem-do-dado-de-sistema.md) resolveu o defeito 2 mandando o Free herdar o artefato. Só que **parte do catálogo do Free não tem de onde herdar** — e isso é fato medido, não hipótese:

| Domínio do Free | Total | Vem do SRD | Não vem de SRD nenhum |
|---|---:|---:|---:|
| Features de classe | 16 | 14 | **2** (`paladin_divine-sense`, `ranger_natural-explorer` — existem no 5.1, mas a união do [ADR 009](../../adr/009-uniao-dos-srd-5-1-e-5-2.md) só chegou em `races`; ver *Questões em aberto* #1) |
| Truques (`CANTRIP_CATALOG`) | 34 | 27 | **7** |
| Magias de 1º (paladino/patrulheiro) | 4 | 4 | 0 |

Os 7 são `friends`, `thorn-whip`, `toll-the-dead`, `mind-sliver`, `thunderclap`, `blade-ward` e `word-of-radiance` — "Amizade", "Chicote de Espinhos", "Dobre dos Mortos", "Estilhaço Mental", "Estrondo", "Guarda de Lâmina" e "Palavra Radiante". São as mesmas 7 órfãs do overlay pt-BR que o [ADR 009 §4](../../adr/009-uniao-dos-srd-5-1-e-5-2.md) verificou **uma a uma**: não estão no `srd-2024` nem no `srd-2014`. Vieram de livros que não são SRD.

Ou seja: **o Free já é multi-fonte hoje** — o que falta é um lugar no dado para dizer isso. Uma seleção que só sabe apontar para o artefato ou perde 7 truques e 2 features, ou os deixa como texto congelado ao lado dos herdados, reencenando o defeito 2 num canto do catálogo.

E não é caso isolado do Free: o `System.sourceType` já prevê `UPLOAD` ([`schema.prisma`](../../../apps/api/prisma/schema.prisma)), e o [ADR 009](../../adr/009-uniao-dos-srd-5-1-e-5-2.md) (D5) **já antecipou a necessidade**, ao escrever que a proveniência de cada entrada fica "onde o domínio pedir, num campo de origem no próprio catálogo". Esta story é o domínio pedindo.

### Por que herdar, e não traduzir o snapshot

A decisão 6 original do [ADR 004](../../adr/004-origem-do-dado-de-sistema.md) congelou o Free para ele não herdar o SRD **por acidente** (antes, o `freeConfig` referenciava os mesmos objetos do D&D). Virou política permanente, e o preço apareceu na US-100. As duas alternativas foram pesadas e rejeitadas no §3.1 do ADR: **overlay bilíngue próprio para o Free** (dois catálogos 5e para revisar a cada bump — a digitação que o ADR existe para eliminar) e **herdar o artefato inteiro** (Free e D&D viram o mesmo sistema com nomes diferentes).

O que sobra é o meio-termo, agora com a ressalva do defeito 3: **o texto do que é SRD vem do artefato; a curadoria continua do Free; e o que não é SRD tem lugar próprio, declarado.** Traduzir 7 entradas autorais não é mesma coisa que manter um segundo catálogo de 5e — é o mínimo irredutível de quem tem conteúdo próprio.

### O que a medição mostrou (02/08/2026)

- `freeAttributes` e `freeSkills` são **idênticos** ao artefato pt-BR: 6/6 atributos e 18/18 perícias, mesmas chaves, mesmos rótulos, mesmos atributos-âncora. **Zero diferença de texto** — herdar esses dois campos é no-op em pt-BR e ganho puro em en-US.
- O catálogo do Free é um **subconjunto** de verdade: 16 entradas de feature (o artefato tem 24), 34 truques + 4 magias de 1º (o artefato tem 211 entradas / 84 nomes distintos). A curadoria é o que faz o Free ser o Free, e é ela que a seleção por chave preserva.
- 27 dos 34 truques e **14 das 16** features existem no artefato de hoje. As outras 2 existem no SRD 5.1, mas o artefato ainda não as tem: a união do ADR 009 foi aplicada só em `races` (ver *Questões em aberto* #1).

---

## A proposta

Quatro movimentos, nesta ordem — a ordem importa, porque a seleção só resolve contra um artefato que já tenha chave.

1. **A chave sobrevive ao ingest.** `SystemClassFeature` e `SystemSpell` ganham `key`; o `_slug` deixa de ser campo temporário e vira campo do artefato, nos dois domínios e nos dois locales.
2. **A entrada declara procedência.** Os dois schemas ganham `source` — de onde veio *aquele texto*. O `ingest` carimba o que produz (`'srd'`); entrada escrita por nós é `'authored'`. É o campo que o [ADR 009 D5](../../adr/009-uniao-dos-srd-5-1-e-5-2.md) já previa e que torna a licença auditável **por entrada**, não só por repositório.
3. **O catálogo de um sistema é montado de referências e entradas próprias.** Referência (`{ from: 'srd', key }`) resolve contra o artefato do locale; entrada própria é literal, bilíngue, com `source: 'authored'`. O Free usa as duas: 27 truques + 14 features por referência, 7 truques + 2 features por entrada própria.
4. **O Free passa a ter os dois locales:** `config` = base **en-US** (artefato EN + o EN das entradas próprias), `configLocales['pt-BR']` = a mesma seleção no pt-BR.

O EN das 9 entradas próprias não existe hoje (elas nasceram em PT). Sai da mesma esteira da [US-52](./US-52-traducao-automatica-do-srd.md), com `translateSrd` ganhando alvo de idioma: rascunho `_mt: true`, revisão no diff do PR. Nove entradas curtas, uma rodada.

---

## Escopo

### Dentro do escopo

- **`key` obrigatória e `source` obrigatória** em `SystemClassFeatureSchema` e `SystemSpellSchema` ([`system.ts:27`](../../../packages/shared/src/types/system.ts) e `:36`). Schema valida: entrada sem chave ou sem origem falha o `parse` do próprio ingest.
- **Ingest preserva a chave e carimba a origem** ([`ingest.mjs:168`](../../../scripts/srd/ingest.mjs) e `:190`) — o `_slug` vira `key`, e toda entrada derivada do dataset sai com `source: 'srd'`. A ordenação continua por chave (idempotência preservada).
- ~~**`translateSrd` bidirecional:**~~ **não implementado — divergência consciente (03/08/2026).** O plano era dar alvo de idioma ao `translateSrdToPtBr` ([`translate-srd.ts`](../../../packages/ai-engine/src/translate-srd.ts)) para gerar o EN das 9 entradas autorais. Mas o pipeline dele grava no **overlay** (`scripts/srd/locale/pt-BR.json`), e a decisão 6h pôs a entrada autoral no `seed.ts`: o rascunho teria de ser colado à mão de qualquer jeito. Uma chamada paga de LLM e um parâmetro novo num função de um consumidor só, para 9 frases de uma linha. O EN foi escrito direto em [`free-catalog.ts`](../../../apps/api/prisma/free-catalog.ts), revisável no mesmo diff do PR — que era o gate previsto. Quando a entrada autoral virar overlay (gatilho da 6h), o alvo de idioma volta à mesa junto.
- **Montagem do `config` do Free por referências + entradas próprias** no [`seed.ts`](../../../apps/api/prisma/seed.ts): `freeClassFeatures`, `freeClassSpells` e `CANTRIP_CATALOG` deixam de guardar texto herdável e passam a declarar o que é referência (`{ from: 'srd', key }`) e o que é entrada própria (literal bilíngue, `source: 'authored'`).
- **`races` e `classes` do Free trocam de lado** ([`seed.ts`](../../../apps/api/prisma/seed.ts)): a [US-105](./US-105-raca-e-classe-por-chave-do-srd.md) deu ao Free os dois catálogos que ele nunca teve (as listas viviam no `SetupWizard`), herdando-os do artefato **pt-BR** — porque naquele momento o Free só falava PT e um catálogo EN deixaria os selects em inglês para todo mundo. Com `configLocales`, a herança passa a ser a normal: `config` = `readSrdArtifact('en-US')`, `configLocales['pt-BR']` = o pt-BR. É **uma linha**, e é o mesmo movimento que `attributes`/`skills` fazem nesta story — some junto com elas ou não some nunca.
- **Upsert do Free com `configLocales`**, espelhando o do D&D. O comentário do seed que documenta a decisão antiga é **reescrito**, não apagado (ele explica um PORQUÊ que mudou de valor — regra do `AGENTS.md`).
- **Guard da decisão 6d, restrita a referências:** referência SRD cuja chave não existe no artefato **falha o `seed`**, nomeando a chave e o domínio. Entrada própria **não** passa por essa guard — ela não tem o que resolver. Essa distinção é o coração da story: sem ela, ou os 7 truques quebram o seed, ou a guard vira decorativa.
- Testes: artefato tem `key` e `source` nos dois domínios e locales; config do Free resolve nos dois locales, tanto num item herdado (`'Fúria'`/`'Rage'`) quanto num autoral (`'Estrondo'`/`'Thunderclap'`); referência inexistente falha o seed; entrada própria com chave fora do artefato **não** falha; `attributes`/`skills` do Free depois da herança são iguais aos de hoje em pt-BR.

### Fora do escopo

- **A ficha** (`Character.features`/`spells` por chave, resolvedor, migração de dados, `getSpell` bilíngue) — é a [US-100](./US-100-ficha-do-personagem-no-locale-ativo.md), que depende desta.
- **`startingKits` do Free** — a fonte dos kits do SRD é **OGL 1.0a** ([US-51](./US-51-kits-iniciais-do-srd.md)) e a fronteira do ADR 004 é "regra do SRD numa fonte **CC**". Ter um campo `source` **não** afrouxa isso: a fronteira é de licença, e a story que trouxer OGL decide isso de frente, não de lado.
- **Ganchos de aventura, point-buy e proficiência** do Free — decisão de produto, não regra de SRD (ADR 004, decisão 4, mantida na 6c).
- **Sistema `UPLOAD`** — o `source` deixa a porta com dobradiça, mas ingerir livro do usuário é outra fase. Nada aqui presume esse caminho além do campo.
- **Equilibrar o registro dos dois locales.** A descrição pt-BR tem mediana de 57 caracteres e a en-US de 426 (medido em 02/08/2026): o pt-BR do artefato é a paráfrase curta herdada deste mesmo seed, e o EN é o texto de regra cru do dataset. Assimetria registrada no [ADR 004 §3.1](../../adr/004-origem-do-dado-de-sistema.md); resolvê-la é decisão de conteúdo.

---

## Consequências observáveis

O Free **muda de conteúdo** — troca consciente, não regressão acidental. O que um jogador vê:

| Mudança | Onde | Nota |
|---|---|---|
| Ficha e wizard em inglês para o Free | atributos, perícias, features, magias | é o objetivo da story |
| Rótulos pt-BR **inalterados** | atributos e perícias | medido: 6/6 e 18/18 idênticos |
| Raça e classe do Free deixam de ser PT no `config` | wizard e ficha | hoje o Free serve "Anão" a um jogador em inglês (US-105 herdou o artefato pt-BR por falta de `configLocales`); em pt-BR nada muda, o rótulo passa a vir do locale |
| Os 7 truques de fora do SRD **continuam no Free**, agora bilíngues | catálogo de magias | é o defeito 3 resolvido; sem entrada própria, eles sumiriam ou congelariam |
| Descrição em inglês fica longa nos itens herdados | ficha e prompt do Mestre | consequência do registro do dataset (ver *Fora do escopo*) |
| Bump do dataset passa a alcançar o Free | itens com `source: 'srd'` | é o que a guard 6d torna barulhento em vez de silencioso; o autoral fica imune por construção |

---

## Critérios de aceite

- [x] `SystemClassFeature` e `SystemSpell` têm `key` e `source` **obrigatórias**, e os dois artefatos (`en-US` e `pt-BR`) as trazem em todas as entradas, com `source: 'srd'`.
- [x] O `ingest` continua **idempotente**: duas rodadas seguidas produzem artefatos byte-a-byte iguais, agora com chave e origem.
- [x] `freeClassFeatures`/`freeClassSpells`/`CANTRIP_CATALOG` **não guardam mais texto herdável**: o que existe no SRD é referência; só as entradas autorais têm texto no `seed.ts`.
- [x] **As 9 entradas de fora do artefato sobrevivem e falam os dois idiomas:** os 7 truques ("Estrondo"/"Thunderclap") e as 2 features (`paladin_divine-sense`, `ranger_natural-explorer`) resolvem nos dois locales, com `source: 'authored'`.
- [x] `system-free.config` é a base **EN** e `system-free.configLocales['pt-BR']` existe, com os mesmos itens em português — mesma forma do `system-dnd5e`. Vale para o config **inteiro**, `races`/`classes` inclusive: hoje eles são o artefato pt-BR dentro da base EN (US-105), e é este critério que fecha isso.
- [x] **Sem regressão em pt-BR:** `attributes` e `skills` do Free depois da herança são idênticos aos de hoje (6 e 18 entradas, mesmas chaves, rótulos e âncoras); features e magias mostram o mesmo texto pt-BR de hoje, herdadas ou autorais.
- [x] **Guard 6d, só para referência:** referência SRD com chave inexistente **falha o seed** com a chave e o domínio na mensagem; entrada autoral com chave que o artefato não conhece **não falha** (é o caso normal das 9).
- [x] Os kits, ganchos, point-buy e proficiência do Free **não mudam** — `startingKits` do Free idêntico antes e depois.
- [x] O comentário do `seed.ts` que documentava "o Free é snapshot PT sem base EN" foi **reescrito** apontando para o [ADR 004 §3.1](../../adr/004-origem-do-dado-de-sistema.md), não removido.

---

## Notas de implementação

> *Dicas e decisões técnicas para quem vai implementar. Não é especificação obrigatória — o implementador pode divergir com boa justificativa.*

- **Ordem de execução:** `pnpm srd:ingest` (com chave e origem) **antes** de trocar o `seed.ts`. Invertido, o Free falha pela guard 6d por um motivo que não é o real e você vai depurar a coisa errada.
- **`source` é do dado, não do sistema.** Duas entradas do mesmo `config` podem ter origens diferentes — é justamente o caso do Free. Não coloque a origem no `System`; ela já existe lá como `sourceType`, e significa outra coisa (de onde o *sistema* nasceu, não cada entrada).
- **Dois valores bastam hoje** (`'srd'`, `'authored'`). Não invente taxonomia para fonte que ninguém ingeriu ainda; um `z.string()` com esses dois em uso resolve, e o dia em que houver upload o valor novo é uma linha.
- **`readSrdArtifact`** ([`seed.ts:394`](../../../apps/api/prisma/seed.ts)) já lê o artefato por locale e é o ponto de entrada natural da resolução. Ele é leitura por `fs` de propósito (o comentário no arquivo explica: um `import` de JSON quebraria o `rootDir` do tsc e o `nest start`) — **não** troque por import.
- **A montagem filtra, não reordena:** mantenha a ordem do artefato para o diff do config seguir estável entre bumps; entradas autorais entram em posição determinística (ordenadas por chave, como as outras).
- **Chave de feature é prefixada pela classe** (`fighter_weapon-mastery`) e a de magia não (`light` é a mesma no mago e no clérigo). As listas do Free refletem isso: features por classe, magias podendo repetir chave entre classes.
- **A chave da entrada autoral é do mesmo espaço das outras** (`thunderclap`, não `free:thunderclap`). Chave é identificador do catálogo; quem diz de onde veio é o `source`. Prefixar por fonte espalha a procedência por dentro da chave, e aí toda comparação precisa saber desmontá-la.
- Lembre do `dist`: mexeu em `packages/shared` ou `packages/ai-engine`, rebuild antes de rodar ingest ou seed (o `srd:ingest` já builda; o `db:seed` não).

### Como ficou (03/08/2026)

- A montagem vive em [`free-catalog.ts`](../../../apps/api/prisma/free-catalog.ts) (curadoria por chave + entradas próprias + guard), fora do `seed.ts`: o seed roda `main()` ao importar e não seria testável. O `seed.ts` caiu de **461 para 332 linhas**.
- **`key` e `source` são obrigatórias no schema, e o `parse` roda na LEITURA** ([`character.service.ts:26`](../../../apps/api/src/character/character.service.ts), [`adventure.service.ts:55`](../../../apps/api/src/adventure/adventure.service.ts)) — um row de `System` semeado antes desta story **falha o parse**. Re-seed é obrigatório em toda base, dev e produção, antes de subir a API.
- **A ordem das listas mudou** (herdada do artefato, por chave EN; antes era alfabética por nome PT). Não é regressão de conteúdo e a ficha já reordena por nível e nome na exibição ([`GameView`](../../../apps/web/src/components/game/GameView.tsx)) — mas é diff visível no `config`.
- 21 é o número de pares classe×magia autorais (7 truques repetidos entre classes), contra 70 pares por referência. Quem for conferir contagem, é esse o denominador.

---

## Questões em aberto

1. ~~**Esta story vai antes ou depois da [US-105](./US-105-raca-e-classe-por-chave-do-srd.md)?**~~ **Resolvida em 03/08/2026 — a pergunta tinha premissa errada, e a medição a virou:** a US-105 está ✅, mas aplicou a união do [ADR 009](../../adr/009-uniao-dos-srd-5-1-e-5-2.md) **só em `races`** ([`ingest.mjs:180`](../../../scripts/srd/ingest.mjs), `buildRaces` com `species2014`); [`buildClassFeatures`](../../../scripts/srd/ingest.mjs) lê só o 5.2 — o documento 2014 nem é buscado para features. Conferido no artefato en-US: paladino tem `["Lay On Hands","Weapon Mastery"]` e patrulheiro `["Favored Enemy","Weapon Mastery"]`. Ou seja, **`paladin_divine-sense` e `ranger_natural-explorer` não estão no artefato mesmo com a US-105 pronta**, e a ordem das duas stories não muda nada. Elas entram como **`authored`**, com o PT que o overlay já guarda (são dois dos órfãos propositais do [`locale/pt-BR.json`](../../../scripts/srd/locale/pt-BR.json)) e o EN saindo da mesma rodada de `translateSrd` dos truques — **9 entradas autorais, não 7**. Viram referência no dia em que alguém estender a união ao domínio de feature, que é trabalho de outra story: exige buscar o documento 2014 de features **e** preencher o `SRD_EQUIVALENTS`, porque o [ADR 009 §4](../../adr/009-uniao-dos-srd-5-1-e-5-2.md) mediu que 12 das 14 features "exclusivas do 5.1" são renomeação — fundir sem o mapa **duplica** o conceito em vez de deduplicá-lo. A troca depois é barata por construção: `source` vira referência e a guard 6d passa a valer para elas.
2. ~~**O Free precisa de `version` própria por bump?**~~ **Resolvida em 03/08/2026 — [ADR 004, decisão 6g](../../adr/004-origem-do-dado-de-sistema.md):** não se amarra. O `version` do Free continua `'1.0'` e passa a significar **curadoria** (sobe quando a seleção de chaves muda, não quando o dataset bumpa); no D&D continua sendo a versão do dataset (`'5.2'`). A proveniência do dado se lê no `source` da entrada e no [NOTICE](../../../scripts/srd/NOTICE-open5e.md). Decidiu o empate: `version` é servido em [`system.service.ts:16`](../../../apps/api/src/system/system.service.ts) mas **nenhum consumidor lê** — nada em `apps/web` renderiza nem compara, então amarrar seria manter sincronia de um campo que ninguém usa. Sem efeito no código desta story.
3. ~~**Entrada autoral cresce para onde?**~~ **Resolvida em 03/08/2026 — [ADR 004, decisão 6h](../../adr/004-origem-do-dado-de-sistema.md):** literal no `seed.ts`, sem overlay próprio. O overlay do SRD ([`scripts/srd/locale/pt-BR.json`](../../../scripts/srd/locale/pt-BR.json)) é máquina para conteúdo que um bump traz e leva — 42 KB, `_mt`, `--strict`, relatório de órfão; as 9 autorais não são ingeridas, não mudam no bump e traduzem uma vez só (US-52). Overlay para elas custaria arquivo novo + base EN + um irmão do `readSrdArtifact` + teste. Gatilho para mudar de ideia: entrada autoral passar de ~20 itens ou entrar um terceiro locale — e aí `key` + `source: 'authored'` já dizem o que move. Medido: o `seed.ts` tem **461 linhas** (teto de 500 no `AGENTS.md`) e esta story o **encolhe**, porque 27 truques e 16 features trocam texto por chave.

---

## Referências no código

- [`packages/shared/src/types/system.ts:27`](../../../packages/shared/src/types/system.ts) e `:36` — os dois schemas que ganham `key` e `source`.
- [`scripts/srd/ingest.mjs:163`](../../../scripts/srd/ingest.mjs) — onde o `_slug` é calculado; `:168` e `:190` — onde ele é removido hoje; `:206` — a detecção de órfãos, que é como as 7 magias de fora do SRD foram parar no relatório.
- [`apps/api/prisma/seed.ts:261`](../../../apps/api/prisma/seed.ts) — `freeClassFeatures`; `:312` — `CANTRIP_CATALOG` (os 34, dos quais 7 são autorais); `:352` — `freeClassSpells`; `:375` — `freeConfig`; `:394` — `readSrdArtifact`; `:422-429` — o upsert do Free, hoje sem `configLocales`.
- [`packages/ai-engine/src/translate-srd.ts`](../../../packages/ai-engine/src/translate-srd.ts) — `translateSrdToPtBr`, que ganha alvo de idioma.
- [`apps/api/src/system/system-locale.ts`](../../../apps/api/src/system/system-locale.ts) — `configForLocale`, que já cai em `?? config` quando não há locale (é por aí que o Free serve PT para todo mundo hoje).
- [`apps/api/prisma/schema.prisma`](../../../apps/api/prisma/schema.prisma) — `SourceType` (`FREE`/`SRD`/`UPLOAD`), a origem do **sistema**, que é coisa diferente do `source` da **entrada**.
