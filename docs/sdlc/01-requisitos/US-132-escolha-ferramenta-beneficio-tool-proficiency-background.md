# US-132 — Escolha da ferramenta concedida pelo benefício `tool_proficiency` do background

**Épico:** 1 — Personagem
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** [US-121](./US-121-catalogo-backgrounds-a5e-adventurers-guide.md) (catálogo `config.backgrounds`, benefit `type: "tool_proficiency"` já extraído, sem mecanização) · [US-134](./US-134-catalogo-de-ferramentas-do-sistema.md) (catálogo `config.tools` — implementada, esta story está desbloqueada)
**Relacionado:** [US-123](./US-123-integracao-mecanica-background-pointbuy.md)/[US-131](./US-131-integracao-mecanica-background-proficiency.md) (mecanizaram `ability_score`/`skill_proficiency` dos mesmos 21 backgrounds e excluíram `language`/`tool_proficiency` explicitamente por essa mesma falta de catálogo — §Fora do escopo de cada uma) · [US-129](./US-129-escolha-idioma-beneficio-language-background.md) (mesmo formato de story — benefício de background bloqueado por catálogo ainda inexistente; `tool_proficiency` é o segundo caso, texto mais irregular que `language`) · [US-122](./US-122-escolha-background-catalogo-na-criacao.md) (escolha de origem — é o `origin.key` que decide se o benefício `tool_proficiency` existe pra este personagem)
**Criada em:** 2026-08-13

---

## História

> **Como** jogador,
> **quero** escolher (ou ver concedida automaticamente) a ferramenta quando a origem que selecionei dá proficiência em uma,
> **para que** esse benefício vire mecânica real na ficha — hoje ele só aparece como texto no cartão da origem (US-122), sem nenhum lugar pra eu de fato registrar essa proficiência.

---

## Contexto e motivação

### O que o dataset diz (medido em 13/08/2026, `scripts/srd/_data/BackgroundBenefit.json`)

13 dos 21 backgrounds do catálogo A5E têm um benefit com `type: "tool_proficiency"` — mais que os 5 de `language` (US-129), texto bem menos uniforme:

| Background (`pk`) | `desc` | Forma |
|---|---|---|
| `artisan` | "One type of artisan's tools or smith's tools." | escolha dentro de categoria aberta |
| `charlatan` | "Disguise kit, forgery kit." | 2 fixas, item concreto |
| `criminal` | "Gaming set, thieves' tools." | 2 fixas, item concreto |
| `farmer` | "Land vehicles." | 1 fixa, categoria (não item concreto) |
| `folk-hero` | "One type of artisan's tools, one vehicle." | 1 escolha de categoria + 1 categoria fixa |
| `guildmember` | "Either one type of artisan's tools, musical instrument, or vehicle." | escolha entre 3 categorias |
| `hermit` | "Herbalism kit." | 1 fixa, item concreto |
| `marauder` | "One type of artisan's tools or vehicle." | escolha entre 2 categorias |
| `noble` | "One gaming set." | 1 fixa, categoria (qual gaming set?) |
| `sailor` | "Navigator's tools, water vehicles." | 2 fixas, mistura item concreto + categoria |
| `soldier` | "One type of gaming set." | 1 fixa, categoria |
| `trader` | "One vehicle." | 1 fixa, categoria |
| `urchin` | "Disguise kit, thieves' tools." | 2 fixas, item concreto |

Ao contrário de `language` (sempre "One of your choice.", US-129) e de `skill_proficiency` (2 formatos regulares, US-131), `tool_proficiency` mistura **três formas diferentes de indeterminação** na mesma tabela: item concreto já resolvido (`Herbalism kit`), categoria aberta sem enumerar as opções (`artisan's tools` — qual tipo? o texto não diz), e escolha entre categorias (`musical instrument` vs `vehicle` vs `artisan's tools`). Um catálogo de ferramentas pra isso não é uma lista plana como `config.skills` — precisaria de pelo menos dois níveis (categoria → item), e o dataset A5E não enumera os itens de cada categoria em lugar nenhum consultado até agora.

### Por que isso não era mecanizável antes (histórico — resolvido pela US-134)

A US-123/US-131 excluíram `tool_proficiency` de propósito, com a razão registrada: *"o projeto não tem catálogo de ferramentas nem de idiomas (`config` não tem `tools`/`languages`); mecanizar exigiria um subsistema novo do zero"*. A US-134 (13/08/2026, implementada) fechou essa lacuna: `wizards-of-the-coast/srd-2024/Item.json` (mesmo documento já pinado) tinha 203 itens não sincronizados, 50 deles (`category` em `tools`/`land-vehicle`/`waterborne-vehicle`) relevantes pra proficiência. `config.tools` agora existe — ver §O que `config.tools` entrega (US-134, medido no artefato real) abaixo.

### A proposta

Mesmo movimento que a US-129 fez para `language`: estender `buildBackgrounds` para reconhecer `type === 'tool_proficiency'` como um `grant` estruturado contra `config.tools`, adicionar `origin.toolChoice` (ou `toolChoices`, plural — ver Modelo de dados) ao payload de criação, e um seletor na etapa `background` do wizard quando o benefício estiver presente.

### O que `config.tools` entrega (US-134, medido no artefato real em 14/08/2026)

`config.tools` é uma lista plana de **50** `{key, label, category}` (`SystemToolSchema`,
[types/system.ts](../../../packages/shared/src/types/system.ts)) — não uma árvore categoria→itens.
A categoria de proficiência já vem resolvida por item, contagem medida direto em
`scripts/srd/srd-5e.config.en-US.json`:

| `category` | Contagem | Cobre o texto do benefício (tabela acima) |
|---|---:|---|
| `artisan` | 17 | "one type of artisan's tools" |
| `musical-instrument` | 10 | "musical instrument" |
| `gaming-set` | 4 | "gaming set" |
| `kit` | 6 | "Herbalism kit", "Disguise kit", "Forgery kit" (item concreto) |
| `vehicle` | 11 | "vehicle"/"land vehicles"/"water vehicles" |
| `navigators_tools` (= a própria `key`) | 1 | "Navigator's tools" (item concreto) |
| `thieves_tools` (= a própria `key`) | 1 | "thieves' tools" (item concreto) |

**Achado não previsto pela US-134 §Modelo de dados, confirmado no artefato gerado**: `land-vehicle`
e `waterborne-vehicle` colapsam na MESMA `category: 'vehicle'` (11 chaves: `carriage`, `cart`,
`chariot`, `sled`, `wagon` = terrestres; `galley`, `keelboat`, `longship`, `rowboat`,
`sailing_ship`, `warship` = aquáticos) — nada no registro (`key`/`label`/`category`) marca qual é
qual. Isso importa porque `farmer` concede só *"Land vehicles"* e `sailor` só *"water vehicles"*
(tabela acima) — filtrar `config.tools` por `category === 'vehicle'` sozinho oferece os 11, terrestre
e aquático misturados, pros dois backgrounds. Ver §Notas de implementação.

---

## Escopo

### Dentro do escopo

- `buildBackgrounds` (`scripts/srd/ingest.mjs`, mesma função que a US-121/US-123/US-131/US-129 já estenderam) reconhece `type === 'tool_proficiency'` e parseia os 13 `desc` da tabela acima em `grant` estruturado — item(ns) fixo(s) resolvido(s) contra `config.tools` (por `key`, para item concreto, ou por `category`, para categoria aberta), e/ou escolha entre opções (categoria ou item) quando o texto usa "one/either ... or".
- **`farmer`/`sailor` precisam filtrar `config.tools` por `category === 'vehicle'` E por um segundo critério que distinga terrestre de aquático** (`config.tools` não guarda essa distinção, §O que `config.tools` entrega) — tabela fixa de 11 chaves classificadas manualmente (mesmo espírito de `NAMED_ALONE_TOOLS` em `ingest.mjs`), ou o ingest volta a olhar `land-vehicle`/`waterborne-vehicle` do `Item.json` bruto antes de reduzir pra `config.tools`. Decisão de implementação, não resolvida por esta atualização.
- **Item ou categoria sem entrada em `config.tools` é relatado como órfão e omitido do grant** — mesmo tratamento que a US-131 deu a `Culture`/`Engineering`, não bloqueia o resto do background.
- `origin.toolChoice?: string` (ou array, se algum background exigir mais de uma escolha — nenhum dos 13 exige hoje) no `CreateCharacterSchema.origin`, validado contra `config.tools`/o `grant` da origem escolhida.
- Etapa `background` do wizard mostra seletor com as opções do `grant` quando a origem escolhida concede ferramenta — a escolha em si acontece NESSA etapa, não numa etapa própria (ver §Onde aparece na criação e na ficha, que corrige a suposição de "mesmo padrão de perícia" — perícia adia a escolha pra etapa `skills`, ferramenta não tem etapa própria pra adiar).
- Persistência da ferramenta escolhida em `Character` — `config.tools` já tem forma definida (US-134), o que falta decidir é só o campo/coluna em `Character` (provável reaproveitamento de `skills`/array de chaves, mesmo padrão de `origin.skillChoice` persistido — não decidido nesta atualização).
- Tela de revisão do wizard e ficha do personagem mostram a ferramenta escolhida — local exato de cada uma em §Onde aparece na criação e na ficha.

### Fora do escopo

- **Criar `config.tools`** — entregue pela US-134 (implementada), não esta.
- **Mudar a forma de `config.tools`** (por exemplo, dar a `vehicle` um terceiro nível terrestre/aquático dentro do próprio catálogo) — se a distinção land/water virar campo do catálogo em vez de tabela fixa no parser desta story, é mudança na US-134, não nesta.
- **Os outros 8 backgrounds sem benefit `tool_proficiency`** — nada muda para eles.
- **Uso narrativo/mecânico da ferramenta** (testes de perícia com a ferramenta, regras de craft) — mecânica de jogo, não desta story, que é só criação de personagem.

---

## Modelo de dados proposto

Esqueleto por analogia com `grant.kind === 'skills'` (US-131), agora ancorado na forma REAL de
`config.tools` entregue pela US-134 (`{key, label, category}`, §O que `config.tools` entrega —
não mais hipotética):

```ts
// em SystemBackgroundGrantSchema (US-123/US-131/US-129), um novo membro da union:
z.object({
  kind: z.literal('tools'),
  fixed: z.array(z.string()),      // config.tools[].key já resolvidos (item concreto: kit, navigators_tools, thieves_tools)
  chooseFrom: z.array(z.string()), // config.tools[].key das opções, quando o desc usa "one/either ... or"
  chooseCount: z.number().int().min(0),
})
```

`fixed`/`chooseFrom` guardam `key` de itens individuais, não `category` — mesmo quando o `desc`
fala de categoria aberta ("one type of artisan's tools"), o parser expande pra todas as `key` de
`config.tools` com aquele `category` (17 chaves pra `artisan`, por exemplo) e o `grant` já sai com
a lista resolvida. Farmer/Sailor são o caso especial: a lista de `vehicle` que entra em
`fixed`/`chooseFrom` precisa vir pré-filtrada terrestre/aquático (tabela fixa no parser, §Escopo),
não o `category === 'vehicle'` inteiro.

```ts
// em CreateCharacterSchema.origin (US-122/US-123/US-131/US-129):
toolChoice: z.string().max(60).optional(),
```

---

## Onde aparece na criação e na ficha

Medido em 13/08/2026 contra o precedente real de `ability_score` (US-123) e `skill_proficiency`
(US-131) no código atual — não suposição.

### 1. Etapa `background` do wizard — aviso E escolha, no mesmo lugar

Os steps do wizard são `system`/`race-class`/`background`/`attributes`/`skills`/`review`
([SetupWizard.tsx:25-26](../../../apps/web/src/components/setup/SetupWizard.tsx:25)).
`ability_score` e `skill_proficiency` só **avisam** na etapa `background` (texto cru do
benefit) e adiam a **escolha** para a etapa dona do eixo — `attributes`
([SetupWizard.tsx:718-722](../../../apps/web/src/components/setup/SetupWizard.tsx:718)) e
`skills` ([SetupWizard.tsx:637-660](../../../apps/web/src/components/setup/SetupWizard.tsx:637))
respectivamente, com comentário explícito no código: *"a ESCOLHA em si acontece na etapa
`skills`"* ([SetupWizard.tsx:726](../../../apps/web/src/components/setup/SetupWizard.tsx:726)).

`tool_proficiency` não tem eixo próprio no wizard — não existe etapa `tools`/`equipment`. Por
isso o seletor (`<select>` ou cartões, a depender de `chooseCount`) fica na PRÓPRIA etapa
`background`, mesmo padrão dos selects de conexão/memento (US-124), não do de perícia/atributo.
Local exato: dentro de `step === 'background'`
([SetupWizard.tsx:687](../../../apps/web/src/components/setup/SetupWizard.tsx:687)), logo após
o bloco de aviso de `skillBenefit`
([SetupWizard.tsx:723-731](../../../apps/web/src/components/setup/SetupWizard.tsx:723)) e antes
do bloco de conexão/memento
([SetupWizard.tsx:742](../../../apps/web/src/components/setup/SetupWizard.tsx:742)). Trocar de
origem precisa resetar a escolha, mesmo padrão de `setSkillChoice([])`/`setAbilityChoice(undefined)`
no `onChange` do `<select>` de origem
([SetupWizard.tsx:700-709](../../../apps/web/src/components/setup/SetupWizard.tsx:700)).

### 2. Etapa `review` do wizard — linha própria no resumo

Perícia da origem tem linha própria no `<dl>` de resumo
(`setup.review.skills`, [SetupWizard.tsx:842-849](../../../apps/web/src/components/setup/SetupWizard.tsx:842)),
não fica dentro do `BackgroundPanel` — o comentário no código é explícito que o painel **não**
repete o que já tem linha ali
([SetupWizard.tsx:856-858](../../../apps/web/src/components/setup/SetupWizard.tsx:856)). Ferramenta
segue o mesmo padrão: linha nova (`setup.review.tools`) no mesmo `<dl>`, condicionada a
`grant.kind === 'tools'` existir na origem escolhida — mesmo `if` condicional que envolve
`connectionTable`/`mementoTable`
([SetupWizard.tsx:867-878](../../../apps/web/src/components/setup/SetupWizard.tsx:867)).

### 3. Ficha do personagem (`GameView`) — bloco próprio, não dentro do `BackgroundPanel`

`BackgroundPanel` é só narrativa — origem/conexão/memento/história/ideais/vínculos/defeitos/divindade
([BackgroundPanel.tsx:9-96](../../../apps/web/src/components/character/BackgroundPanel.tsx:9));
não tem noção de mecânica. Perícia mecânica vive num bloco próprio dentro do `GameView`, condicional
a ter conteúdo (`skills && skills.length > 0`), com `SheetHeading` + lista com marca de proficiência
([GameView.tsx:510-528](../../../apps/web/src/components/game/GameView.tsx:510)). Ferramenta segue
o mesmo padrão — bloco próprio (`game.tools`), não uma prop nova do `BackgroundPanel`.

Precisa de prop nova em `GameView` (`tools?: string[]`, análoga a `skills`) e no que
`apps/web/src/app/play/[adventureId]/page.tsx` monta e passa pro `GameView`, ao lado de
`skills={skills}`/`background={character.background}`
([page.tsx:82-83](../../../apps/web/src/app/play/[adventureId]/page.tsx:82)).

### 4. Prompt do DM Agent — junta a `SKILLS_LINE`, não o `INVENTORY_BLOCK`

A ficha web não é o único lugar que "lê" a ferramenta — o Mestre também precisa dela no prompt.
`packages/ai-engine/src/prompts/dm-system.ts` já separa perícia de inventário em duas camadas de
cache DIFERENTES (US-55/US-56), de propósito:

- `SKILLS_LINE` fica dentro de `sheetStateSection`, a ficha ESTÁVEL
  ([dm-system.ts:219-232](../../../packages/ai-engine/src/prompts/dm-system.ts:219)) — antes da
  fronteira de cache, muda só quando o personagem sobe de nível.
- `INVENTORY_BLOCK` fica no estado do TURNO
  ([dm-system.ts:546-548](../../../packages/ai-engine/src/prompts/dm-system.ts:546)) — depois da
  fronteira, recomputado/reenviado todo turno (US-55/US-56 — camada 3 saiu do system pro prefixo
  da última mensagem exatamente pra manter isso fora do cache).

Ferramenta é traço FIXO de nível 1 (mesmo perfil de `skills`, não muda turno a turno). Se entrar
no `INVENTORY_BLOCK`, vira conteúdo estável dentro da seção volátil — quebra a fronteira de cache
que a US-55 desenhou de propósito (cache miss todo turno, custo maior). Lugar certo: somar à
`SKILLS_LINE` (ex.: `Skills (modifier; * = proficient): ...` ganha as ferramentas na mesma linha,
ou uma linha irmã igualmente estável) — não ao inventário, mesmo a ferramenta muitas vezes
coincidindo com um item físico que TAMBÉM está no inventário (posse e proficiência continuam sendo
dados diferentes, agora por um motivo técnico a mais além do argumento de duplicação da ficha web).

---

## Critérios de aceite

- [x] `buildBackgrounds` deriva `grant` para os 13 backgrounds medidos, cobrindo as três formas da tabela (fixo/item concreto, fixo/categoria, escolha entre categorias) — com teste por formato.
- [x] `farmer` recebe só as chaves `vehicle` terrestres, `sailor` só as aquáticas — não as 11 misturadas de `category === 'vehicle'` (§O que `config.tools` entrega); teste que falha se algum dos dois vazar o tipo errado.
- [x] Item ou categoria sem entrada em `config.tools` sai do `grant` e entra no relatório de órfãos do ingest, sem falhar `--strict` (mesmo tratamento da US-131 pra `Culture`/`Engineering`).
- [x] Seletor oferece as opções do `grant` na PRÓPRIA etapa `background` (SetupWizard.tsx:687, entre o aviso de `skillBenefit` e o bloco de conexão/memento — §Onde aparece na criação e na ficha), não numa etapa própria; ausente para os outros 8.
- [x] `CharacterService.create` rejeita `origin.toolChoice` fora do `grant.chooseFrom`, e rejeita ausência dele quando o `grant` exige escolha.
- [x] Ferramenta escolhida visível como linha própria na etapa `review` (`setup.review.tools`, junto de connection/memento) e como bloco próprio na ficha (`GameView`, ao lado do bloco de perícias — não dentro do `BackgroundPanel`). Ver §Onde aparece na criação e na ficha.
- [x] Personagem com origem sem benefício `tool_proficiency`, ou sem origem nenhuma: nenhuma validação nova disparada, comportamento idêntico ao de hoje.
- [x] Ferramenta aparece no prompt do DM Agent junto de `SKILLS_LINE` (ficha estável, antes da fronteira de cache), nunca dentro de `INVENTORY_BLOCK` (estado do turno) — ver §Onde aparece, item 4.

---

## Notas de implementação

- **Parser mais irregular que os precedentes**: diferente do `desc` uniforme de `language` (sempre "One of your choice.") e dos 2 formatos regulares de `skill_proficiency` (US-131), os 13 `desc` de `tool_proficiency` variam em contagem de itens fixos (0 a 2), presença de escolha, e se o item é concreto ou uma categoria a resolver depois. Provável que precise de mais de uma função de reconhecimento de padrão, não uma regex só — seguir o mesmo espírito de "falhar alto se o formato não bater" que `parseStartingKit` (US-51) e o parser da US-131 já usam.
- **Tabela fixa terrestre/aquático não pode vir do `Item.json`**: a essa altura do ingest, `buildBackgrounds` só enxerga `config.tools` já resolvido (`category: 'vehicle'` para os 11, sem distinção) — não o array bruto `data.items` que `buildTools` consome ([ingest.mjs:606-619](../../../scripts/srd/ingest.mjs:606)). Ou `buildBackgrounds` passa a receber `data.items` bruto também (mesmo parâmetro que `buildTools` já recebe), ou a tabela fixa de 5 chaves terrestres/6 aquáticas fica hardcoded no parser desta story — a segunda opção quebra silenciosamente se um `Item.json` futuro trouxer um 12º veículo.
- Mesmo padrão de 3 lugares a espelhar que `origin.skillChoice`/`languageChoice` já exige (US-123/US-131/US-129): `CreateCharacterSchema`, `normalizeOrigin`/`CharacterService.create`, tipo do payload em `apps/web/src/lib/api.ts`.
- Exibição soma mais 2 lugares que não existem pra `skillChoice` hoje (perícia mostra na ficha via `skills`, que já existia antes da US-131; ferramenta é eixo novo): prop `tools?: string[]` em `GameView` + repasse em `page.tsx` (§Onde aparece, item 3), e linha nova `setup.review.tools` no `<dl>` da etapa `review` (§Onde aparece, item 2) — nenhum dos dois é reaproveitamento de campo existente.

---

## Questões em aberto

1. ~~De onde vem `config.tools`, e que estrutura ele precisa ter?~~ **Resolvida pela US-134** (13/08/2026): não existe `Tool.json` dedicado, mas `wizards-of-the-coast/srd-2024/Item.json` (mesmo documento já pinado, arquivo ainda não sincronizado) tem 203 itens com campo `category` — 50 relevantes (`tools`/`land-vehicle`/`waterborne-vehicle`), e o **nome** de cada item resolve o segundo nível (categoria de proficiência) sem mapa manual.
2. ~~Vale a pena uma story-base conjunta com `config.languages`?~~ Resolvida na prática: as duas lacunas foram investigadas no mesmo dia (US-133/US-134), mas viraram stories separadas — os dados-fonte são documentos diferentes (`open5e/core` vs. `srd-2024`) e as estruturas não têm nada em comum além de "resolvem um benefício de background".
3. **Esta story precisa de número novo quando a story-base existir, ou vira uma seção dela?** Resolvida na prática: a story-base (US-134) ficou com número próprio, e esta story permanece independente, agora desbloqueada.

---

## Referências no código

- `scripts/srd/_data/BackgroundBenefit.json` (não versionado — `pnpm srd:sync` baixa, US-47) — os 13 registros `type: "tool_proficiency"` (`a5e-ag_artisan_tool-proficiencies` até `a5e-ag_urchin_tool-proficiencies`).
- [scripts/srd/ingest.mjs:359](../../../scripts/srd/ingest.mjs:359) — `buildBackgrounds`, função a estender (mesma que a US-123/US-131/US-129 já estenderam).
- [scripts/srd/ingest.mjs:578-619](../../../scripts/srd/ingest.mjs:578) — `buildTools`/`toolCategory` (US-134, implementada): de onde `config.tools` vem, e onde a distinção terrestre/aquático se perde (`item.fields.category === 'tools' ? toolCategory(...) : 'vehicle'`, linha 612 — `land-vehicle` e `waterborne-vehicle` caem no mesmo `'vehicle'`).
- [packages/shared/src/types/system.ts](../../../packages/shared/src/types/system.ts) — `SystemToolSchema` (`key`/`label`/`category`) e `SystemConfigSchema.tools` (US-134).
- [US-134](./US-134-catalogo-de-ferramentas-do-sistema.md) — story-base que entrega `config.tools`, implementada; esta story é a consumidora que ela desbloqueou.
- [packages/ai-engine/src/prompts/dm-system.ts:219-232,546-548](../../../packages/ai-engine/src/prompts/dm-system.ts:219) — `SKILLS_LINE` (ficha estável) vs `INVENTORY_BLOCK` (estado do turno), a fronteira de cache que decide onde a ferramenta entra no prompt (§Onde aparece, item 4).
- [US-55](./US-55-prompt-caching-do-dm.md) / [US-56](./US-56-estado-do-turno-na-mensagem.md) — desenho da fronteira de cache que motiva a separação.
- [US-123](./US-123-integracao-mecanica-background-pointbuy.md) / [US-131](./US-131-integracao-mecanica-background-proficiency.md) — exclusão original de `language`/`tool_proficiency`, origem direta desta story.
- [US-129](./US-129-escolha-idioma-beneficio-language-background.md) — mesmo formato de story (benefício bloqueado por catálogo ausente), precedente estrutural direto.
- [US-121](./US-121-catalogo-backgrounds-a5e-adventurers-guide.md) / [US-122](./US-122-escolha-background-catalogo-na-criacao.md) — dependências diretas.
