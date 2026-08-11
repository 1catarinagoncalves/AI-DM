# US-122 — Escolha de origem (catálogo de background) na criação de personagem

**Épico:** 1 — Personagem
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** [US-121](./US-121-catalogo-backgrounds-a5e-adventurers-guide.md) (catálogo `SystemConfig.backgrounds`, ainda não implementada) · [US-105](./US-105-raca-e-classe-por-chave-do-srd.md) (precedente: catálogo fechado por chave na criação, `validateCatalogKey`) · [US-26](./US-26-criacao-personagem-em-etapas.md) (etapa `background` do wizard)
**Relacionado:** [US-39](./US-39-identidade-narrativa-background-ideais.md) (`Character.background` — prosa livre; **não** é o campo que esta story mexe, ver §Nomenclatura) · [US-41](./US-41-features-traits-de-classe.md) (precedente "awareness apenas, sem mecânica" — mesmo tratamento dado aqui aos benefícios do background)
**Criada em:** 2026-08-08

---

## História

> **Como** jogador,
> **quero** escolher uma **origem** de uma lista, na etapa `background` da criação, em vez de só ter campos de texto livre,
> **para que** eu veja as opções do sistema (pelo nome) antes de escrever minha identidade — e minha ficha guarde qual origem é a minha, não só a prosa que descrevo dela.

---

## Nomenclatura: por que "origem" e não "background"

`Character.background` **já existe** (US-39) e é prosa livre — história, ideais, vínculos, fraquezas, divindade. Guardar a chave do catálogo dentro desse mesmo objeto (`background.key`) misturaria duas coisas com nomes iguais e naturezas diferentes: uma é texto que o jogador escreve, a outra é uma chave que trava contra um catálogo fechado.

**Decisão (08/08/2026): a escolha do catálogo vive num campo próprio, `Character.origin`, distinto de `Character.background`.** Os dois **convivem sem se tocar** — escolher uma origem do catálogo não pré-preenche nem substitui a prosa de `background` (ver US-121 §Fora do escopo). Em português, "Origem" é o rótulo exibido ao jogador; em inglês, `origin` (não reaproveita a palavra "Background" da tela de identidade).

---

## Contexto e motivação

### O problema observado

A etapa `background` do wizard ([SetupWizard.tsx:445-482](../../../apps/web/src/components/setup/SetupWizard.tsx:445)) só tem quatro textareas + um input (história, ideais, vínculos, fraquezas, divindade) — tudo texto livre, sem nenhuma lista para escolher de onde partir. Race e classe **já não são assim**: a US-105 fechou os dois em `<select>` sobre o catálogo do `config` (`raceCatalog`/`classCatalog`, [SetupWizard.tsx:361-377](../../../apps/web/src/components/setup/SetupWizard.tsx:361)), com `key` persistida e rótulo resolvido no locale de quem lê. Background ficou para trás porque, quando a US-39 foi escrita, **não havia catálogo de background** — ela mesma registrou isso como "fora do escopo, extensão futura".

### Por que a solução atual não basta

A US-121 fecha a lacuna de dado (o catálogo passa a existir em `config.backgrounds`), mas não toca em UI nem em criação — entrega só o artefato. Sem esta story, o catálogo fica **sem consumidor**: 21 backgrounds derivados do `a5e-ag` e nenhuma tela que os mostre.

### A proposta

Adicionar, na etapa `background`, um campo **`<select>`** rotulado **"Origem"** — mesmo padrão visual de Raça/Classe (US-105) — listando os backgrounds do `config.backgrounds` só pelo **nome** (sem benefícios na opção). Selecionar uma entrada grava a **chave** em `Character.origin.key`, campo novo e distinto; os quatro campos de texto livre de `Character.background` **continuam existindo, intactos, e independentes** da escolha — a story soma um dado novo (qual origem), não substitui o que já há (a prosa de identidade).

**Decisão (11/08/2026):** a primeira versão desta story usava cartões (nome + benefícios resumidos, padrão da etapa `skills`); foi revertida para `<select>` — origem é escolha única e obrigatória quando há catálogo, o mesmo perfil de Raça/Classe, não o de perícias (múltiplas, contadas). Benefícios saem da tela de escolha; quem quiser vê-los faz parte de uma story de detalhe futura, se pedida.

**Onde fica na tela:** dentro do mesmo bloco `step === 'background'` ([SetupWizard.tsx:445-482](../../../apps/web/src/components/setup/SetupWizard.tsx:445)), o campo "Origem" entra **logo abaixo do subtítulo e acima dos quatro campos de texto** (`bg-story`, `bg-ideals`, `bg-bonds`, `bg-flaws`, `bg-deity`) — mesma etapa do wizard, sem tela/rota nova. Ordem de leitura: título da etapa → subtítulo → `<select>` "Origem" (escolha estruturada) → textareas de identidade (prosa livre), reforçando visualmente que a origem é o ponto de partida e o texto livre vem depois, por cima dela.

---

## Escopo

### Dentro do escopo

- **`<select>` "Origem"** dentro da etapa `background`, uma `<option>` por entrada de `config.backgrounds` (US-121): só o `name`, sem `benefits` na opção. Mesmo componente/estilo dos selects de Raça/Classe (US-105) — `selectClass` + `SELECT_ARROW`, não `optionCardClass`.
- **Seleção é obrigatória quando há catálogo**: `canAdvance('background')` passa a exigir `origin.key` preenchido se `config.backgrounds` existir — mesmo padrão de bloqueio que race/classe já têm (US-105). Sem catálogo no `config` (sistema sem `backgrounds`, ex. Free) a seção "Origem" **não aparece** e a etapa segue liberada como hoje — mesmo padrão condicional de `skillCatalog`/`raceCatalog` (`?? []` já cobre isso).
- **`CreateCharacterSchema`** ganha um campo **irmão** de `background`, não aninhado nele: `origin: z.object({ key: z.string().max(80).optional() }).optional()`.
- **`CharacterService.create`** valida a chave com o `validateCatalogKey` que já existe (US-105), contra `config.backgrounds` — mesmo tratamento de race/class, mas o campo continua opcional (chave ausente não valida nada).
- **`normalizeOrigin`** (nova função, espelha `normalizeBackground` mas para o objeto separado) persiste `{ key }` no campo `Character.origin`.
- **`Character.origin`** é campo **novo** no Prisma (`Json @default("{}")`), não uma extensão de `Character.background` — exige migração (ver §Modelo de dados).
- **Etapa de revisão**: mostra o nome da origem escolhida (resolvido do catálogo, no locale ativo — mesma função `catalogLabel`/padrão de `raceLabel`/`classLabel`) numa linha própria (`setup.review.origin`), **separada** da linha `setup.review.background` que já existe.
- **Chaves de mensagem novas** (`setup.origin.*`) nos dois locales (`apps/web/src/messages/{en-US,pt-BR}.ts`), mesmo padrão de `setup.skills.*`.

### Fora do escopo

- **Aplicar mecanicamente os benefícios** (marcar proficiência de perícia/ferramenta, somar atributo, adicionar idioma automaticamente a partir de `benefits[].type`) — os benefícios ficam **awareness apenas**, mesmo tratamento que `classFeatures`/`SystemClassFeature` já têm (comentário em [system.ts:32-34](../../../packages/shared/src/types/system.ts:32): "o que o personagem SABE FAZER... sem usos/custo/mecânica"). Aplicar de fato exigiria decidir como 8 tipos de benefício do A5E encaixam em `pointBuy`/`proficiency`/`skills` do sistema — decisão de produto que não cabe aqui (é a US-123).
- **Pré-preencher `background.story`/`ideals`/`bonds`/`flaws` a partir da origem escolhida** — decidido na US-121: os dois campos **convivem distintos**, sem um alimentar o outro. Os benefícios do `a5e-ag` são mecânicos/informativos, não prosa de identidade; não há tradução direta de "benefício" para "ideal" ou "vínculo".
- **Injetar os benefícios da origem no system prompt do Mestre** — hoje só `Character.background.{story,ideals,bonds,flaws,deity}` vai ao prompt (US-39/US-40). Levar `origin`/benefícios para lá é extensão separada, se algum dia fizer sentido narrativamente.
- **Os 4 backgrounds nativos do `srd-2024`** — a US-121 decidiu não trazê-los (só `a5e-ag`, 21 entradas); esta story consome o que `config.backgrounds` tiver, então nem depende dessa decisão continuar valendo.
- **Editar a origem depois de criado o personagem** — a ficha não tem editor pós-criação hoje (mesma exclusão da US-39); fora daqui também.

---

## Modelo de dados proposto

`origin` é dado novo, mesma regra de extensão da US-23 (campo novo entra como grupo, renderizado por iteração/opcional) — **não** um campo a mais dentro de `background` (US-39), que continua exatamente como é.

```ts
// character.schema.ts — CreateCharacterSchema, campo IRMÃO de `background`
origin: z.object({
  key: z.string().max(80).optional(), // chave do catálogo (US-121), ex. "a5e-ag_acolyte"
}).optional(),
```

```prisma
// schema.prisma — Character, campo NOVO, irmão de `background`
origin  Json  @default("{}")  // US-122: {key?} — origem escolhida do catálogo (US-121).
                               // Distinto de `background` (US-39, prosa livre): os dois não se
                               // alimentam um do outro, ver US-122 §Nomenclatura.
```

**Persistência:** coluna nova (`Character.origin`, Json) — **exige migração Prisma**, diferente de uma extensão dentro de um Json já existente.

| Campo | Tipo | Descrição |
|---|---|---|
| `origin.key` | string (opcional) | Chave do `SystemBackgroundSchema` escolhido (US-121); ausente = nenhuma origem escolhida |

---

## Critérios de aceite

- [x] Migração Prisma adiciona `Character.origin` (`Json @default("{}")`), coluna nova, sem afetar `Character.background`.
- [x] Etapa `background` do wizard mostra um `<select>` rotulado **"Origem"** com uma opção por entrada de `config.backgrounds` (quando o sistema tiver o campo) — só o nome, mesmo estilo visual dos selects de Raça/Classe.
- [x] Sistema sem `config.backgrounds` (ex. Free) **não mostra** o campo "Origem" — etapa continua só os 4 campos de texto de `background`, exatamente como é hoje.
- [x] Escolher uma opção grava a origem; voltar ao placeholder vazio limpa a seleção (mesmo padrão de Raça/Classe — não é toggle de cartão, nem multi-escolha).
- [x] `canAdvance('background')` passa a exigir `origin.key` preenchido quando `config.backgrounds` existir — escolher uma origem do catálogo é **obrigatório** nesse caso (bloqueia avanço sem seleção, mesmo padrão de race/classe); sem catálogo no sistema, etapa segue liberada como hoje.
- [x] `CreateCharacterSchema.origin.key` aceito e validado no service: chave que não bate em `config.backgrounds` **rejeita a criação** com `BadRequestException` (mesmo comportamento de `validateCatalogKey` para raça/classe); chave ausente não dispara validação nenhuma.
- [x] `Character.origin` persistido **separado** de `Character.background`; um personagem criado sem escolher origem grava `origin: {}` e `background` como hoje — nenhum dos dois afeta o outro.
- [x] Etapa de revisão mostra o nome da origem escolhida (resolvido no locale ativo) numa linha própria, distinta da linha de `background`.
- [x] `apps/web/src/lib/api.ts` (`createCharacter`) espelha o campo `origin` (irmão de `background`) no tipo do payload — mesmo aviso do comentário do `character.schema.ts` ("o web é o único outro ponto e deve espelhar a forma").
- [x] Mensagens novas nos dois locales (`en-US.ts`, `pt-BR.ts`), namespace `setup.origin.*`; nenhuma string nova hardcoded no JSX (gate da US-102).
- [x] **Eval / teste de regressão:** `character.service.test.ts` cobre (a) criação com `origin.key` válido → persiste em `Character.origin`, `Character.background` intocado; (b) `origin.key` inexistente no catálogo → `BadRequestException`; (c) criação sem `origin` (ou sistema sem `config.backgrounds`) → `origin: {}`, comportamento de `background` idêntico a hoje.

---

## Notas de implementação

- **`<select>`, não cartão.** Origem é obrigatória quando há catálogo e é escolha única — mesmo perfil de Raça/Classe (US-105), que já usam `<select>` por isso. Perícias usam cartão porque são multi-escolha contada (`toggleSkill`, `skillChoices`); origem não é. `option value={key}` / texto `{name}`, igual a `raceCatalog.map`. Quem bloqueia o avanço sem seleção é `canAdvance('background')`, não o `<select>`.
- **Sem benefícios na tela de escolha.** `<option>` é texto puro — não cabe a lista de `benefits[].name` que o cartão mostrava. Descrição/benefícios completos ficam para uma story de detalhe/tooltip, se a UX pedir depois.
- **`validateCatalogKey` já existe e é genérico** ([character.service.ts:91](../../../apps/api/src/character/character.service.ts:91)) — reusar direto, não escrever validação nova. A chamada fica **condicional** (`dto.origin?.key ? validateCatalogKey(...) : undefined`), porque o campo é opcional.
- **`catalogLabel`** ([system.ts:135](../../../packages/shared/src/types/system.ts:135)) resolve o rótulo na revisão e em qualquer outro lugar que precise mostrar o nome a partir da chave — mesmo caminho de `raceLabel`/`classLabel` no `SetupWizard.tsx`.
- **Estado do wizard**: novo `useState` próprio (ex. `origin`), separado do `bg` que já guarda o texto livre — os dois não compartilham objeto, reforçando na própria implementação que são coisas distintas.

---

## Referências no código

- [apps/web/src/components/setup/SetupWizard.tsx:445-482](../../../apps/web/src/components/setup/SetupWizard.tsx:445) — etapa `background` estendida com o `<select>` "Origem"; selects de Raça/Classe ([SetupWizard.tsx:381-388](../../../apps/web/src/components/setup/SetupWizard.tsx:381)) como modelo.
- [apps/api/src/character/character.schema.ts](../../../apps/api/src/character/character.schema.ts) — `CreateCharacterSchema`, campo `origin` novo (irmão de `background`).
- [apps/api/src/character/character.service.ts:31-32,64,91](../../../apps/api/src/character/character.service.ts:31) — `validateCatalogKey` (reusar), `normalizeBackground` (modelo para a nova `normalizeOrigin`).
- [apps/api/prisma/schema.prisma:39](../../../apps/api/prisma/schema.prisma:39) — `Character.background` (referência de vizinho), `Character.origin` a criar logo abaixo, migração nova.
- [packages/shared/src/types/system.ts:27-30,135](../../../packages/shared/src/types/system.ts:27) — `SystemCatalogEntrySchema`/`catalogLabel`, e `SystemBackgroundSchema` da US-121 (dependência).
- [apps/web/src/lib/api.ts](../../../apps/web/src/lib/api.ts) — payload de `createCharacter` a espelhar.
- [apps/web/src/messages/en-US.ts](../../../apps/web/src/messages/en-US.ts) / [pt-BR.ts](../../../apps/web/src/messages/pt-BR.ts) — chaves `setup.origin.*` novas.
- [US-121](./US-121-catalogo-backgrounds-a5e-adventurers-guide.md) — de onde vem `config.backgrounds`, e onde a decisão "campos distintos" foi tomada.
- [apps/web/src/components/game/GameView.tsx](../../../apps/web/src/components/game/GameView.tsx) — `BackgroundPanel` mostra `originName` (prop `characterOrigin`) na aba "Background" da ficha em jogo, antes da `story` — mesma ordem da revisão da criação.
- [apps/web/src/app/play/[adventureId]/page.tsx](../../../apps/web/src/app/play/[adventureId]/page.tsx) — resolve `character.origin.key` contra `config.backgrounds` (por `name`, não `catalogLabel`) e passa `characterOrigin` à `GameView`.
