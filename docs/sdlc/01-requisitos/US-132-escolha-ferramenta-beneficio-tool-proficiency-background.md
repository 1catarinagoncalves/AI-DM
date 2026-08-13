# US-132 — Escolha da ferramenta concedida pelo benefício `tool_proficiency` do background

**Épico:** 1 — Personagem
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
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

### Por que isso não é mecanizável agora

A US-123/US-131 excluíram `tool_proficiency` de propósito, com a razão registrada: *"o projeto não tem catálogo de ferramentas nem de idiomas (`config` não tem `tools`/`languages`); mecanizar exigiria um subsistema novo do zero"*. Isso continua verdade — não existe `config.tools`, não existe campo de ferramenta em `Character`, e **não existe `Tool.json`** no dataset Open5e pinado (`scripts/srd/_data/` não tem esse arquivo — só `Skill.json`, sem equivalente pra ferramentas). Diferente de `language` (US-129, onde o 5e padrão tem uma lista bem conhecida de idiomas que provavelmente existe em algum resource Open5e ainda não investigado), aqui a lacuna é maior: nem o dado bruto das opções de cada categoria (que ferramentas existem dentro de "artisan's tools"?) foi localizado ainda.

### A proposta (condicional)

Esta story faz o mesmo que a US-129 fez para `language`: quando `config.tools` existir (story-base, fora desta, e maior que a de idiomas — precisa resolver a estrutura categoria→item antes), estender `buildBackgrounds` para reconhecer `type === 'tool_proficiency'` como um `grant` estruturado, adicionar `origin.toolChoice` (ou `toolChoices`, plural — ver Modelo de dados) ao payload de criação, e um seletor na etapa `background` do wizard quando o benefício estiver presente.

---

## Escopo

### Dentro do escopo (só depois que `config.tools` existir)

- `buildBackgrounds` (`scripts/srd/ingest.mjs`, mesma função que a US-121/US-123/US-131/US-129 já estenderam) reconhece `type === 'tool_proficiency'` e parseia os 13 `desc` da tabela acima em `grant` estruturado — item(ns) fixo(s) resolvido(s) contra `config.tools`, e/ou escolha entre opções (categoria ou item) quando o texto usa "one/either ... or".
- **Item ou categoria sem entrada em `config.tools` é relatado como órfão e omitido do grant** — mesmo tratamento que a US-131 deu a `Culture`/`Engineering`, não bloqueia o resto do background.
- `origin.toolChoice?: string` (ou array, se algum background exigir mais de uma escolha — nenhum dos 13 exige hoje) no `CreateCharacterSchema.origin`, validado contra `config.tools`/o `grant` da origem escolhida.
- Etapa `background` do wizard mostra seletor com as opções do `grant` quando a origem escolhida concede ferramenta — a escolha em si acontece NESSA etapa, não numa etapa própria (ver §Onde aparece na criação e na ficha, que corrige a suposição de "mesmo padrão de perícia" — perícia adia a escolha pra etapa `skills`, ferramenta não tem etapa própria pra adiar).
- Persistência da ferramenta escolhida em `Character` — formato exato depende da forma que `config.tools`/o campo em `Character` tomar na story-base; não decidido aqui.
- Tela de revisão do wizard e ficha do personagem mostram a ferramenta escolhida — local exato de cada uma em §Onde aparece na criação e na ficha.

### Fora do escopo

- **Criar `config.tools`** (com a estrutura categoria→item que os 13 `desc` exigem) — era a story-base bloqueante; a US-134 já entrega, não esta. Ver §Questões em aberto.
- **Resolver o que cada categoria contém** (que ferramentas existem dentro de "artisan's tools", que jogos existem dentro de "gaming set") — pré-requisito da story-base, não desta.
- **Os outros 8 backgrounds sem benefit `tool_proficiency`** — nada muda para eles.
- **Uso narrativo/mecânico da ferramenta** (testes de perícia com a ferramenta, regras de craft) — mecânica de jogo, não desta story, que é só criação de personagem.

---

## Modelo de dados proposto

Não decidido — depende da forma que a story-base de `config.tools` tomar. Esqueleto por analogia com `grant.kind === 'skills'` (US-131) e `grant.kind === 'language'` (US-129), assumindo suporte a fixo + escolha (como `skills`, não só escolha livre como `language`):

```ts
// em SystemBackgroundGrantSchema (US-123/US-131/US-129), um novo membro da union:
z.object({
  kind: z.literal('tools'),
  fixed: z.array(z.string()),      // itens já resolvidos contra config.tools
  chooseFrom: z.array(z.string()), // opções de categoria/item, quando o desc usa "one/either ... or"
  chooseCount: z.number().int().min(0),
})
```

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

---

## Critérios de aceite

- [ ] **Bloqueado até `config.tools` existir** — nenhum critério abaixo pode ser implementado antes disso.
- [ ] `buildBackgrounds` deriva `grant` para os 13 backgrounds medidos, cobrindo as três formas da tabela (fixo/item concreto, fixo/categoria, escolha entre categorias) — com teste por formato.
- [ ] Item ou categoria sem entrada em `config.tools` sai do `grant` e entra no relatório de órfãos do ingest, sem falhar `--strict` (mesmo tratamento da US-131 pra `Culture`/`Engineering`).
- [ ] Seletor oferece as opções do `grant` na PRÓPRIA etapa `background` (SetupWizard.tsx:687, entre o aviso de `skillBenefit` e o bloco de conexão/memento — §Onde aparece na criação e na ficha), não numa etapa própria; ausente para os outros 8.
- [ ] `CharacterService.create` rejeita `origin.toolChoice` fora do `grant.chooseFrom`, e rejeita ausência dele quando o `grant` exige escolha.
- [ ] Ferramenta escolhida visível como linha própria na etapa `review` (`setup.review.tools`, junto de connection/memento) e como bloco próprio na ficha (`GameView`, ao lado do bloco de perícias — não dentro do `BackgroundPanel`). Ver §Onde aparece na criação e na ficha.
- [ ] Personagem com origem sem benefício `tool_proficiency`, ou sem origem nenhuma: nenhuma validação nova disparada, comportamento idêntico ao de hoje.

---

## Notas de implementação

- **Parser mais irregular que os precedentes**: diferente do `desc` uniforme de `language` (sempre "One of your choice.") e dos 2 formatos regulares de `skill_proficiency` (US-131), os 13 `desc` de `tool_proficiency` variam em contagem de itens fixos (0 a 2), presença de escolha, e se o item é concreto ou uma categoria a resolver depois. Provável que precise de mais de uma função de reconhecimento de padrão, não uma regex só — seguir o mesmo espírito de "falhar alto se o formato não bater" que `parseStartingKit` (US-51) e o parser da US-131 já usam.
- Mesmo padrão de 3 lugares a espelhar que `origin.skillChoice`/`languageChoice` já exige (US-123/US-131/US-129): `CreateCharacterSchema`, `normalizeOrigin`/`CharacterService.create`, tipo do payload em `apps/web/src/lib/api.ts`.
- Exibição soma mais 2 lugares que não existem pra `skillChoice` hoje (perícia mostra na ficha via `skills`, que já existia antes da US-131; ferramenta é eixo novo): prop `tools?: string[]` em `GameView` + repasse em `page.tsx` (§Onde aparece, item 3), e linha nova `setup.review.tools` no `<dl>` da etapa `review` (§Onde aparece, item 2) — nenhum dos dois é reaproveitamento de campo existente.

---

## Questões em aberto

1. ~~De onde vem `config.tools`, e que estrutura ele precisa ter?~~ **Resolvida pela US-134** (13/08/2026): não existe `Tool.json` dedicado, mas `wizards-of-the-coast/srd-2024/Item.json` (mesmo documento já pinado, arquivo ainda não sincronizado) tem 203 itens com campo `category` — 50 relevantes (`tools`/`land-vehicle`/`waterborne-vehicle`), e o **nome** de cada item resolve o segundo nível (categoria de proficiência) sem mapa manual.
2. ~~Vale a pena uma story-base conjunta com `config.languages`?~~ Resolvida na prática: as duas lacunas foram investigadas no mesmo dia (US-133/US-134), mas viraram stories separadas — os dados-fonte são documentos diferentes (`open5e/core` vs. `srd-2024`) e as estruturas não têm nada em comum além de "resolvem um benefício de background".
3. **Esta story precisa de número novo quando a story-base existir, ou vira uma seção dela?** Resolvida na prática: a story-base (US-134) ficou com número próprio, e esta story permanece independente, agora desbloqueada.

---

## Referências no código

- [scripts/srd/_data/BackgroundBenefit.json](../../../scripts/srd/_data/BackgroundBenefit.json) — os 13 registros `type: "tool_proficiency"` (`a5e-ag_artisan_tool-proficiencies` até `a5e-ag_urchin_tool-proficiencies`).
- [scripts/srd/ingest.mjs:359](../../../scripts/srd/ingest.mjs:359) — `buildBackgrounds`, função a estender (mesma que a US-123/US-131/US-129 já estenderam).
- [US-123](./US-123-integracao-mecanica-background-pointbuy.md) / [US-131](./US-131-integracao-mecanica-background-proficiency.md) — exclusão original de `language`/`tool_proficiency`, origem direta desta story.
- [US-129](./US-129-escolha-idioma-beneficio-language-background.md) — mesmo formato de story (benefício bloqueado por catálogo ausente), precedente estrutural direto.
- [US-121](./US-121-catalogo-backgrounds-a5e-adventurers-guide.md) / [US-122](./US-122-escolha-background-catalogo-na-criacao.md) — dependências diretas.
