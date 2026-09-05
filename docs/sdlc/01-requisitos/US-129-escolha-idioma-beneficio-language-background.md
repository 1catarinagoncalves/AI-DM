# US-129 — Escolha do idioma concedido pelo benefício `language` do background

**Épico:** 1 — Personagem
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** [US-121](./US-121-catalogo-backgrounds-a5e-adventurers-guide.md) (catálogo `config.backgrounds`, benefit `type: "language"` já extraído, sem mecanização) · [US-133](./US-133-catalogo-de-idiomas-do-sistema.md) (catálogo `config.languages`) · [US-214](./US-214-idiomas-fixos-de-raca-e-escolha-do-idioma-extra.md) (mecaniza a PRIMEIRA escolha real de idioma do projeto, do lado da raça — `raceLanguageChoice`, pool que exclui `secret` + idioma já concedido, `Character.languages` como união; **implementação nesta ordem: US-214 antes desta** — o filtro do pool aqui precisa de `raceLanguages`/`raceLanguageChoice` já calculados no escopo de `CharacterService.create`, e o resultado soma ao MESMO array em vez de abrir campo próprio)
**Relacionado:** [US-123](./US-123-integracao-mecanica-background-pointbuy.md)/[US-131](./US-131-integracao-mecanica-background-proficiency.md) (mecanizaram `ability_score`/`skill_proficiency` dos mesmos 21 backgrounds e excluíram `language`/`tool_proficiency` explicitamente por essa mesma falta de catálogo — §Fora do escopo de cada uma) · [US-122](./US-122-escolha-background-catalogo-na-criacao.md) (escolha de origem — é o `origin.key` que decide se o benefício `language` existe pra este personagem)
**Criada em:** 2026-08-12

---

## História

> **Como** jogador,
> **quero** escolher um idioma quando a origem que selecionei concede um ("One of your choice"),
> **para que** esse benefício vire uma escolha real na ficha — hoje ele só aparece como texto no cartão da origem (US-122), sem nenhum lugar pra eu de fato escolher qual idioma meu personagem fala.

---

## Contexto e motivação

### O que o dataset diz (medido em 12/08/2026, `scripts/srd/_data/BackgroundBenefit.json`)

5 dos 21 backgrounds do catálogo A5E têm um benefit com `type: "language"`, sempre com o mesmo `desc`:

| Background (`pk`) | `desc` |
|---|---|
| `a5e-ag_acolyte` | "One of your choice." |
| `a5e-ag_cultist` | "One of your choice." |
| `a5e-ag_guard` | "One of your choice." |
| `a5e-ag_noble` | "One of your choice." |
| `a5e-ag_soldier` | "One of your choice." |

Sempre 1 idioma, sempre escolha livre — nenhuma entrada fixa (diferente de `skill_proficiency`, que tem perícias fixas + pool, US-131). Não há lista de idiomas no `desc`; o `a5e-ag` pressupõe um catálogo de idiomas do 5e que o dataset em si não embute.

### Por que isso não era mecanizável — e o que a US-214 muda

A US-123/US-131 mecanizaram `ability_score`/`skill_proficiency` dos mesmos 21 backgrounds e excluíram `language`/`tool_proficiency` de propósito, com a razão registrada: *"o projeto não tem catálogo de ferramentas nem de idiomas (`config` não tem `tools`/`languages`); mecanizar exigiria um subsistema novo do zero"*. Essa razão morreu em duas etapas: a US-133 (13/08/2026) criou o catálogo cru (`config.languages`); e a [US-214](./US-214-idiomas-fixos-de-raca-e-escolha-do-idioma-extra.md) — a ser implementada ANTES desta — mecaniza a primeira escolha real de idioma do projeto (o idioma extra de Alto-elfo/Humano/Meio-elfo), estabelecendo exatamente o padrão que faltava: campo irmão de `origin` no DTO, `validateCatalogKey` contra `config.languages` filtrado (exclui `secret` e o que já é concedido de graça), `<select>` na etapa certa do wizard, e `Character.languages` como união de idioma fixo + escolhido. Esta story deixa de ser "esperar um subsistema nascer" e vira "replicar, do lado da origem, o mecanismo que a US-214 já constrói do lado da raça" — inclusive precisa **evitar duplicar** com ele: o pool desta story tem que excluir os mesmos idiomas que a US-214 já concedeu (fixos de raça + a escolha extra, quando o personagem for Alto-elfo/Humano/Meio-elfo), senão a jogadora escolhe pela origem um idioma que o personagem já sabe.

### A proposta

Mesmo mecanismo que a US-214 estabelece do lado da raça, replicado para o benefício `language` do background: `buildBackgrounds` reconhece `type === 'language'` como `grant: { kind: 'language', chooseCount: 1 }` (os 5 casos medidos são sempre `chooseCount: 1`, sem fixo); `origin.languageChoice` no DTO, validado com o mesmo `validateCatalogKey` contra `config.languages` filtrado por `secret` **e** pelos idiomas que a raça já concedeu (`raceLanguages`/`raceLanguageChoice`, já calculados antes na mesma função pela US-214); o resultado soma ao **mesmo** array `Character.languages` — resolvendo a pergunta de persistência que esta story deixava em aberto antes de existir um precedente concreto.

---

## Escopo

### Dentro do escopo (depois da US-214 implementada)

- `buildBackgrounds` (`scripts/srd/ingest.mjs`, mesma função que a US-121/US-123/US-131 já estenderam) reconhece `type === 'language'` e produz `grant: { kind: 'language', chooseCount: 1 }` para os 5 backgrounds da tabela acima — sem parser de texto livre (o `desc` já é sempre "One of your choice.", não precisa de regex, diferente do parser de `ability_score`/`skill_proficiency`).
- `origin.languageChoice?: string` no `CreateCharacterSchema.origin` (US-122/US-123/US-131), validado contra `config.languages` quando a origem escolhida tiver `grant.kind === 'language'`.
- **Pool do `<select>` exclui os idiomas já concedidos por raça** — mesmo `raceLanguages`/`raceLanguageChoice` que a US-214 calcula em `CharacterService.create` antes de chegar em `origin`, somados a `secret` no filtro. Um Alto-elfo com origem Acólito não vê `Common`/`Elvish` (raça) nem o idioma que já escolheu como extra no `<select>` da origem.
- Etapa `background` do wizard mostra um `<select>` com as opções filtradas de `config.languages` quando a origem escolhida concede idioma — mesmo padrão visual do `<select>` de perícia da US-131 (e do `<select>` de idioma da US-214).
- **Persistência: soma ao mesmo `Character.languages`** que a US-214 já popula (idioma fixo de raça + escolha extra) — sem campo próprio, sem coluna nova. Resolve o que a versão anterior desta story deixava em aberto.
- Tela de revisão do wizard e ficha do personagem mostram o idioma escolhido junto dos demais, na mesma seção "Idiomas" que a US-214 já faz aparecer — sem UI nova, mesmo padrão de `origin.connection`/`memento` (US-124) e `skillChoice` (US-131).

### Fora do escopo

- **Idiomas raciais** (ex.: Elfo falar Élfico, idioma extra de Alto-elfo/Humano/Meio-elfo) — coberto pela [US-214](./US-214-idiomas-fixos-de-raca-e-escolha-do-idioma-extra.md), mecanismo irmão desta que roda antes; esta story só consome o resultado dele (`raceLanguages`/`raceLanguageChoice`) para não duplicar.
- **Os outros 16 backgrounds sem benefit `language`** — nada muda para eles.
- **Uso narrativo do idioma** (o Mestre saber que o personagem entende um NPC falando aquele idioma) — mecânica de jogo, não desta story, que é só criação de personagem.

---

## Modelo de dados proposto

Por analogia direta com `grant.kind === 'skills'` (US-131), mais o filtro que a US-214 introduz do lado da raça:

```ts
// em SystemBackgroundGrantSchema (US-123/US-131), um novo membro da union:
z.object({ kind: z.literal('language'), chooseCount: z.number().int().min(0) })
```

```ts
// em CreateCharacterSchema.origin (US-122/US-123/US-131):
languageChoice: z.string().max(60).optional(),
```

```ts
// apps/api/src/character/character.service.ts — DEPOIS de raceLanguages/raceLanguageChoice
// (US-214) já calculados; findLanguageGrant é o mesmo par find/apply de findSkillGrant (US-131),
// sem "apply" de fixo porque os 5 backgrounds não têm idioma fixo, só escolha.
const knownLanguages = [...raceLanguages, ...(raceLanguageChoice ? [raceLanguageChoice] : [])]
const languageGrant = this.findLanguageGrant(config.backgrounds, originKey)
const originLanguageChoice = languageGrant
  ? this.validateCatalogKey(
      (config.languages ?? []).filter((l) => !l.secret && !knownLanguages.includes(l.key)),
      dto.origin?.languageChoice ?? '', 'Idioma da origem',
    )
  : undefined
const languages = [...knownLanguages, ...(originLanguageChoice ? [originLanguageChoice] : [])]
```

**Persistência:** mesmo `Character.languages` (`Json`, já existente pela US-214) — sem coluna nova, sem campo próprio de origem (mesmo raciocínio já registrado no schema: nenhum consumidor precisa saber QUAL fonte deu o idioma).

---

## Critérios de aceite

- [ ] `buildBackgrounds` deriva `grant: { kind: 'language', chooseCount: 1 }` para os 5 backgrounds medidos (`acolyte`, `cultist`, `guard`, `noble`, `soldier`).
- [ ] `<select>` na etapa `background` oferece as opções de `config.languages` quando a origem escolhida tiver esse `grant`; ausente para os outros 16.
- [ ] O pool do `<select>` exclui, além de `secret`, os idiomas já concedidos por raça (`RACE_LANGUAGES[raça]` e a escolha extra de raça, quando o personagem for Alto-elfo/Humano/Meio-elfo, US-214).
- [ ] `CharacterService.create` rejeita `origin.languageChoice` fora do catálogo filtrado, rejeita ausência dele quando o `grant` exige escolha, e rejeita um valor igual a um idioma já concedido por raça (mesmo tratamento de `validateCatalogKey`, chave fora do catálogo passado).
- [ ] Um personagem Alto-elfo/Humano/Meio-elfo com origem que concede idioma (ex. Acólito): as duas escolhas (raça + origem) não podem resultar no mesmo idioma repetido em `Character.languages`.
- [ ] Idioma escolhido pela origem aparece na MESMA seção "Idiomas" da ficha e da revisão do wizard que a US-214 já popula — sem seção nem componente novo.
- [ ] Personagem com origem sem benefício `language`, ou sem origem nenhuma: nenhuma validação nova disparada, comportamento idêntico ao de hoje.
- [ ] **Eval / teste de regressão:** `character.service.test.ts` cobre os 5 backgrounds com escolha válida, rejeição de escolha ausente/fora do catálogo, e rejeição de escolha igual a idioma já concedido por raça (incluindo o caso combinado: personagem Alto-elfo/Humano/Meio-elfo com uma dessas 5 origens).

---

## Notas de implementação

- **Ordem de implementação, não só de código:** esta story só começa depois da US-214 estar concluída — `raceLanguages`/`raceLanguageChoice` (nomes exatos das variáveis que a US-214 introduz em `character.service.ts`) precisam existir no escopo de `create()` antes do bloco desta story, porque o filtro do pool usa os dois. A ordem de execução da função já favorece isso: raça é resolvida bem antes de origem em `create()` hoje, não precisa mover nada.
- O parser é trivial comparado ao de `ability_score`/`skill_proficiency` (US-123/US-131): os 5 `desc` são idênticos ("One of your choice."), não precisa de regex — só checar `type === 'language'` e emitir `chooseCount: 1` fixo. Se um dado futuro do `a5e-ag` trouxer idioma fixo (nunca visto nos 21 atuais), o parser vai quebrar a suposição "sempre 1 livre" — tratar como os outros formatos inesperados do projeto (falhar alto, não engolir, mesmo espírito do `CLASS_MAP`/`ABILITY_MAP`).
- Mesmo padrão de 3 lugares a espelhar que `origin.skillChoice`/`abilityChoice` já exige (US-123/US-131): `CreateCharacterSchema`, `normalizeOrigin`/`CharacterService.create`, tipo do payload em `apps/web/src/lib/api.ts`.
- **Não importar `RACE_LANGUAGES` de novo aqui** — o filtro desta story usa as variáveis locais `raceLanguages`/`raceLanguageChoice` já calculadas pela US-214 no mesmo `create()`, não a tabela crua; reimportar duplicaria a fonte da verdade.

---

## Questões em aberto

1. ~~De onde vem `config.languages`?~~ **Resolvida pela US-133** (13/08/2026): existe em `open5e/core/Language.json`, mesmo documento já usado por `Skill.json`, 18 entradas — não é `Culture`/`Engineering` (não precisou de literal hardcoded).
2. ~~Vale a pena uma story-base genérica de idiomas, ou só o suficiente pra estes 5 backgrounds?~~ **Resolvida pela US-214** (04/09/2026): ela É essa generalização, do lado da raça — tabela `RACE_LANGUAGES`/`RACE_EXTRA_LANGUAGE_CHOICE`, `raceLanguageChoice`, `<select>`, tudo sobre `config.languages` da US-133. Esta story reaproveita o mesmo catálogo e o mesmo padrão de validação do lado da origem, sem abrir um subsistema paralelo.
3. ~~Esta story precisa de número novo quando a story-base existir, ou vira uma seção dela?~~ Resolvida na prática: a story-base (US-133) ficou com número próprio, e esta story permanece independente, agora desbloqueada.

Nenhuma pendente — pronta para implementar assim que a US-214 estiver concluída.

---

## Referências no código

- `scripts/srd/_data/BackgroundBenefit.json` (não versionado — `pnpm srd:sync` baixa, US-47) — os 5 registros `type: "language"` (`a5e-ag_acolyte_languages`, `a5e-ag_cultist_languages`, `a5e-ag_guard_languages`, `a5e-ag_noble_languages`, `a5e-ag_soldier_languages`).
- [scripts/srd/ingest.mjs:359](../../../scripts/srd/ingest.mjs:359) — `buildBackgrounds`, função a estender (mesma que a US-123/US-131 já estenderam para `ability_score`/`skill_proficiency`).
- [US-123](./US-123-integracao-mecanica-background-pointbuy.md) / [US-131](./US-131-integracao-mecanica-background-proficiency.md) — exclusão original de `language`/`tool_proficiency`, origem direta desta story.
- [US-121](./US-121-catalogo-backgrounds-a5e-adventurers-guide.md) / [US-122](./US-122-escolha-background-catalogo-na-criacao.md) — dependências diretas.
- [US-214 §Modelo de dados](./US-214-idiomas-fixos-de-raca-e-escolha-do-idioma-extra.md) — `raceLanguages`/`raceLanguageChoice`, o par de variáveis que o filtro desta story consome; mecanismo irmão do lado da raça que esta story replica do lado da origem.
