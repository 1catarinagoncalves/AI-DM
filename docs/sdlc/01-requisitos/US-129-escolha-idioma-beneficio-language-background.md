# US-129 — Escolha do idioma concedido pelo benefício `language` do background

**Épico:** 1 — Personagem
**Fase:** 1 — MVP single-player
**Status:** 🗂️ Backlog
**Depende de:** [US-121](./US-121-catalogo-backgrounds-a5e-adventurers-guide.md) (catálogo `config.backgrounds`, benefit `type: "language"` já extraído, sem mecanização) · [US-133](./US-133-catalogo-de-idiomas-do-sistema.md) (catálogo `config.languages` — a story-base que faltava, ver §Questões em aberto)
**Relacionado:** [US-123](./US-123-integracao-mecanica-background-pointbuy.md)/[US-131](./US-131-integracao-mecanica-background-proficiency.md) (mecanizaram `ability_score`/`skill_proficiency` dos mesmos 21 backgrounds e excluíram `language`/`tool_proficiency` explicitamente por essa mesma falta de catálogo — §Fora do escopo de cada uma) · [US-122](./US-122-escolha-background-catalogo-na-criacao.md) (escolha de origem — é o `origin.key` que decide se o benefício `language` existe pra este personagem)
**Criada em:** 2026-08-12

---

## História

> **Como** jogador,
> **quero** escolher um idioma quando o background que selecionei concede um ("One of your choice"),
> **para que** esse benefício vire uma escolha real na ficha — hoje ele só aparece como texto no cartão do background (US-122), sem nenhum lugar pra eu de fato escolher qual idioma meu personagem fala.

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

### Por que isso não é mecanizável agora

A US-123/US-131 mecanizaram `ability_score`/`skill_proficiency` dos mesmos 21 backgrounds e excluíram `language`/`tool_proficiency` de propósito, com a razão registrada: *"o projeto não tem catálogo de ferramentas nem de idiomas (`config` não tem `tools`/`languages`); mecanizar exigiria um subsistema novo do zero"*. Isso continua verdade hoje — não existe `config.languages`, não existe campo de idioma em `Character`, não existe nenhuma tela que mostre ou colete idioma falado. Escolher "um idioma à escolha" exige escolher **de algum catálogo**, e esse catálogo não existe.

### A proposta (condicional)

Esta story faz o mesmo que a US-131 fez para `skill_proficiency`, mas para `language`: quando `config.languages` existir (story-base, fora desta), estender `buildBackgrounds` para reconhecer `type === 'language'` como um `grant` estruturado (`{ kind: 'language', chooseCount: 1 }` — os 5 casos medidos são sempre `chooseCount: 1`, sem fixo), adicionar `origin.languageChoice` ao payload de criação (mesmo padrão de `origin.skillChoice`/`abilityChoice`, US-123/US-131), e um `<select>` na etapa `background` do wizard quando o benefício estiver presente.

---

## Escopo

### Dentro do escopo (só depois que `config.languages` existir)

- `buildBackgrounds` (`scripts/srd/ingest.mjs`, mesma função que a US-121/US-123/US-131 já estenderam) reconhece `type === 'language'` e produz `grant: { kind: 'language', chooseCount: 1 }` para os 5 backgrounds da tabela acima — sem parser de texto livre (o `desc` já é sempre "One of your choice.", não precisa de regex, diferente do parser de `ability_score`/`skill_proficiency`).
- `origin.languageChoice?: string` no `CreateCharacterSchema.origin` (US-122/US-123/US-131), validado contra `config.languages` quando o background escolhido tiver `grant.kind === 'language'`.
- Etapa `background` do wizard mostra um `<select>` com as opções de `config.languages` quando o background escolhido concede idioma — mesmo padrão visual do `<select>` de perícia da US-131.
- Persistência do idioma escolhido em `Character` — formato exato (campo próprio? lista? junto de `skills`?) depende da forma que `config.languages`/o campo de idioma em `Character` tomar na story-base; não decidido aqui.
- Tela de revisão do wizard e ficha do personagem mostram o idioma escolhido, mesmo padrão de `origin.connection`/`memento` (US-124) e `skillChoice` (US-131).

### Fora do escopo

- **Criar `config.languages`** — é a story-base bloqueante, não esta. Ver §Questões em aberto.
- **Idiomas raciais** (ex.: Elfo falar Élfico) — o 5e concede idioma por raça além de por background; esta story cobre só o benefício `language` do background, não um sistema geral de idiomas do personagem. Pode acabar sendo a mesma story-base, mas escopo aqui é só o benefício do background.
- **Os outros 16 backgrounds sem benefit `language`** — nada muda para eles.
- **Uso narrativo do idioma** (o Mestre saber que o personagem entende um NPC falando aquele idioma) — mecânica de jogo, não desta story, que é só criação de personagem.

---

## Modelo de dados proposto

Não decidido — depende da forma que a story-base de `config.languages` tomar. Esqueleto por analogia direta com `grant.kind === 'skills'` (US-131), assumindo o mesmo padrão de catálogo chave→nome:

```ts
// em SystemBackgroundGrantSchema (US-123/US-131), um novo membro da union:
z.object({ kind: z.literal('language'), chooseCount: z.number().int().min(0) })
```

```ts
// em CreateCharacterSchema.origin (US-122/US-123/US-131):
languageChoice: z.string().max(60).optional(),
```

---

## Critérios de aceite

- [ ] **Bloqueado até `config.languages` existir** — nenhum critério abaixo pode ser implementado antes disso.
- [ ] `buildBackgrounds` deriva `grant: { kind: 'language', chooseCount: 1 }` para os 5 backgrounds medidos (`acolyte`, `cultist`, `guard`, `noble`, `soldier`).
- [ ] `<select>` na etapa `background` oferece as opções de `config.languages` quando o background escolhido tiver esse `grant`; ausente para os outros 16.
- [ ] `CharacterService.create` rejeita `origin.languageChoice` fora de `config.languages`, e rejeita ausência dele quando o `grant` exige escolha.
- [ ] Idioma escolhido visível na tela de revisão do wizard e na ficha do personagem, mesmo padrão de `origin.skillChoice` (US-131)/`connection`/`memento` (US-124).
- [ ] Personagem com background sem benefício `language`, ou sem background nenhum: nenhuma validação nova disparada, comportamento idêntico ao de hoje.

---

## Notas de implementação

- O parser é trivial comparado ao de `ability_score`/`skill_proficiency` (US-123/US-131): os 5 `desc` são idênticos ("One of your choice."), não precisa de regex — só checar `type === 'language'` e emitir `chooseCount: 1` fixo. Se um dado futuro do `a5e-ag` trouxer idioma fixo (nunca visto nos 21 atuais), o parser vai quebrar a suposição "sempre 1 livre" — tratar como os outros formatos inesperados do projeto (falhar alto, não engolir, mesmo espírito do `CLASS_MAP`/`ABILITY_MAP`).
- Mesmo padrão de 3 lugares a espelhar que `origin.skillChoice`/`abilityChoice` já exige (US-123/US-131): `CreateCharacterSchema`, `normalizeOrigin`/`CharacterService.create`, tipo do payload em `apps/web/src/lib/api.ts`.

---

## Questões em aberto

1. ~~De onde vem `config.languages`?~~ **Resolvida pela US-133** (13/08/2026): existe em `open5e/core/Language.json`, mesmo documento já usado por `Skill.json`, 18 entradas — não é `Culture`/`Engineering` (não precisou de literal hardcoded).
2. **Vale a pena uma story-base genérica de idiomas, ou só o suficiente pra estes 5 backgrounds?** A US-133 entregou o catálogo cru (`config.languages`, 18 entradas) sem decidir esse ponto — idioma racial continua fora do escopo de ambas. Um personagem também pode querer idioma racial (fora do escopo aqui, ver §Escopo) — se isso também estiver no roadmap, é extensão futura sobre o mesmo catálogo, não um catálogo novo.
3. **Esta story precisa de número novo quando a story-base existir, ou vira uma seção dela?** Resolvida na prática: a story-base (US-133) ficou com número próprio, e esta story permanece independente, agora desbloqueada.

---

## Referências no código

- [scripts/srd/_data/BackgroundBenefit.json](../../../scripts/srd/_data/BackgroundBenefit.json) — os 5 registros `type: "language"` (`a5e-ag_acolyte_languages`, `a5e-ag_cultist_languages`, `a5e-ag_guard_languages`, `a5e-ag_noble_languages`, `a5e-ag_soldier_languages`).
- [scripts/srd/ingest.mjs:359](../../../scripts/srd/ingest.mjs:359) — `buildBackgrounds`, função a estender (mesma que a US-123/US-131 já estenderam para `ability_score`/`skill_proficiency`).
- [US-123](./US-123-integracao-mecanica-background-pointbuy.md) / [US-131](./US-131-integracao-mecanica-background-proficiency.md) — exclusão original de `language`/`tool_proficiency`, origem direta desta story.
- [US-121](./US-121-catalogo-backgrounds-a5e-adventurers-guide.md) / [US-122](./US-122-escolha-background-catalogo-na-criacao.md) — dependências diretas.
