# US-148 — Perfil do personagem como entrada do motor

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** nenhuma
**Relacionado:** [Backlog — Motor de geração de aventuras one-shot](./backlog-motor-de-geracao-de-aventuras.md) (US-148, bloqueia [US-149](./US-149-segredos-40-prompts-lgmrd.md)) · [ADR 012](../../adr/012-aventura-gerada-como-dado.md) (resolve rótulos `GEN-N` do backlog para número de story) · [US-39](./US-39-identidade-narrativa-background-ideais.md)/[US-40](./US-40-divindade-do-personagem.md) (`Character.background`) · [US-121](./US-121-catalogo-backgrounds-a5e-adventurers-guide.md)/[US-122](./US-122-escolha-background-catalogo-na-criacao.md)/[US-124](./US-124-exibir-beneficios-narrativos-origem.md)/[US-125](./US-125-beneficios-origem-no-system-prompt.md) (`Character.origin`, campo **distinto** de `background` — schema.prisma:41-43) · [starting-inventory.ts](../../../apps/api/src/character/starting-inventory.ts) (`resolveInitialHook`, fonte do `hookSeed`)
**Criada em:** 2026-08-15

---

## História

> **Como** mantenedora,
> **quero** montar, a partir do personagem, o perfil que o motor de geração recebe — nível, chave de classe, `background`, `origin` (gancho de origem do catálogo, [US-124](./US-124-exibir-beneficios-narrativos-origem.md)/[US-125](./US-125-beneficios-origem-no-system-prompt.md)) e o `hookSeed` do gancho de classe —,
> **para que** os 40 prompts de segredo ([US-149](./US-149-segredos-40-prompts-lgmrd.md)) tenham `story`/`bonds`/`flaws`/`origin` no contexto, e um personagem com `background`/`origin` vazios ainda gere uma aventura completa.

**Atualização 2026-08-20:** `origin` no perfil do motor passou a carregar só `adventuresAndAdvancement` (gancho fixo do catálogo). `connection`/`memento` (texto livre escolhido no wizard, US-124) saíram do perfil — continuam intactos em `Character.origin`, mas alimentam só a narração de turno ao vivo ([ai.service.ts:344-356](../../../apps/api/src/ai/ai.service.ts)), não o motor de geração. Ver *Modelo de dados proposto* e *Notas de implementação* abaixo.

---

## Contexto e motivação

### O problema observado

`Character.background` (Json, `{story?, ideals?, bonds?, flaws?, deity?}`) já chega ao modelo hoje — `createForCharacter` o passa a `generateOpeningNarration` ([adventure.service.ts:144](../../../apps/api/src/adventure/adventure.service.ts)). O que **não** existe é ele decidir a **estrutura** da aventura: quem é o antagonista, que NPC está amarrado a qual `bond`, qual `flaw` a aventura cobra. Sem um perfil explícito montado para o motor, cada story consumidora ([US-149](./US-149-segredos-40-prompts-lgmrd.md) em diante) reimplementaria sua própria leitura de `Character`, arriscando divergir em como trata `background` vazio.

`Character.origin` (Json, `{key?, connection?, memento?}`) é o **segundo** dado narrativo de criação do personagem — campo próprio, distinto de `background` (schema.prisma:41-43, US-122 §Nomenclatura), com o mesmo problema: hoje só alimenta o system prompt de **turno** ([ai.service.ts:344-356](../../../apps/api/src/ai/ai.service.ts)) e a resolução de equipamento inicial ([adventure.service.ts:116-120](../../../apps/api/src/adventure/adventure.service.ts)), nunca a **geração** da aventura. `connection` (a quem o personagem está ligado) e `memento` (o objeto e sua história) são o mesmo tipo de gancho que `bonds` — um vínculo concreto que um NPC ou segredo pode ancorar — só que vêm de catálogo (US-121) em vez de prosa livre.

### Por que a solução atual não basta

`background` é `Json @default("{}")` no [schema.prisma](../../../apps/api/prisma/schema.prisma) — criar personagem sem preencher nada é caminho válido, e hoje nada no repo testa explicitamente "motor com background vazio ainda funciona", porque o motor não existe. `Character.level` é `Int @default(1)` e nada no repo o incrementa — a assinatura do motor precisa aceitar nível desde já (para não precisar de retrabalho quando a progressão existir), mesmo que hoje só produza nível 1.

### A proposta

Um **método privado** `buildAdventureProfile(character, config)` (dentro de `AdventureService`, não função livre) que monta `{ level, classKey, background, origin, hookSeed }`, com `hookSeed` sempre presente como rede de segurança para quando `background` e `origin` estão vazios. `origin` é resolvido com o **mesmo padrão** já usado em `ai.service.ts:352-356` (`resolveAdventuresAndAdvancement(config.backgrounds, origin.key)`) — esta story reusa a função existente, não a reimplementa. (Atualização 2026-08-20: `connection`/`memento` deixaram de entrar no perfil — só o gancho de catálogo alimenta o motor.)

`hookSeed` é o `openingNarration` **resolvido** (placeholders `{characterName}`/`{characterClass}` já substituídos), não o texto cru de `resolveInitialHook`. Motivo: o perfil alimenta um prompt de LLM (US-149) — texto cru vazaria `{characterName}` literal no contexto. Resolvido via `this.resolveHook(rawHook, character.name, className)`, já existente ([adventure.service.ts:64-74](../../../apps/api/src/adventure/adventure.service.ts)) e usado com o mesmo objetivo em `createForCharacter` (linha 142) — motivo pelo qual `buildAdventureProfile` precisa ser método da classe (acesso a `this.resolveHook`), não função livre.

---

## Escopo

### Dentro do escopo

- **`buildAdventureProfile(character, config): AdventureProfile`** — **método privado de `AdventureService`** (precisa de `this.resolveHook`, não função livre). Monta o perfil: `level` (de `Character.level`), `classKey` (de `Character.class`, já chave canônica desde a [US-105](./US-105-raca-e-classe-por-chave-do-srd.md)), `background` (de `Character.background`, tipado como `CharacterBackground` de `@ai-dm/ai-engine`, já usado por `generateOpeningNarration`), `origin` (de `Character.origin`, resolvido para `OriginNarrative` de `@ai-dm/ai-engine` — só `adventuresAndAdvancement` via `resolveAdventuresAndAdvancement(config.backgrounds, origin.key)`; **`connection`/`memento` de propósito FORA do perfil desde 2026-08-20** — continuam em `Character.origin`, mas só a narração de turno ao vivo os lê), `hookSeed` (`resolveInitialHook(config, classKey)`, com placeholders resolvidos via `this.resolveHook(rawHook, character.name, className)` — mesmo padrão de `createForCharacter:142` — `className` vem de `catalogLabel(config.classes, classKey)`). `character` precisa expor `name` além de `level`/`class`/`background`/`origin`.
- **Critério que não pode faltar:** personagem com `background` vazio (`{}`) **e** `origin` vazio (`{}`) gera perfil válido, caindo no `hookSeed` da classe como única fonte de contexto narrativo — nunca lança nem devolve perfil incompleto.
- **Assinatura recebe nível desde já**, com valor 1 enquanto a D1 (progressão de nível, sem dono, ver *Depende de* no backlog) não existir — o motor não é bloqueado por progressão ausente, só limitado a gerar para nível 1 até ela chegar.
- **Local:** dentro de `adventure.service.ts` (301 linhas hoje, longe do teto de 500) — não arquivo próprio. Precedente já no mesmo arquivo: leitura de `origin` pra equipamento (linhas 116-120) também é inline. Sem consumidor externo além da própria criação de aventura, arquivo dedicado (`adventure-profile.ts`) fica prematuro. Consumido pela [US-149](./US-149-segredos-40-prompts-lgmrd.md).

### Fora do escopo

- **A chamada ao modelo que usa este perfil** — é a [US-149](./US-149-segredos-40-prompts-lgmrd.md); esta story só monta o objeto de entrada.
- **Progressão de nível (D1)** — fora do escopo deste backlog inteiro (ver *Depende de* no documento-pai); esta story só garante que a assinatura aceita nível diferente de 1 quando a D1 existir, sem reescrever a função.
- **Resolução de `hookSeed` para classe sem gancho** — já resolvido por `resolveInitialHook` (devolve `null` só quando o sistema não tem catálogo algum, caso que `SystemConfigSchema` já cobre com `initialAdventures` opcional); esta story não muda esse comportamento, só consome.
- **Equipamento derivado de `origin.key`** (`getBackgroundEquipment`, US-128) — já resolvido em `adventure.service.ts:116-120` para o `CharacterState.inventory`; esta story só lê os campos **narrativos** de `origin` (`connection`, `memento`, gancho resolvido), não toca em equipamento.

---

## Modelo de dados proposto

```ts
// apps/api/src/adventure/adventure.service.ts
export interface AdventureProfile {
  level: number
  classKey: string
  background: CharacterBackground // {story?, ideals?, bonds?, flaws?, deity?}, de @ai-dm/ai-engine
  origin: OriginNarrative // tipo permite {adventuresAndAdvancement?, connection?, memento?}, mas o perfil só popula adventuresAndAdvancement (2026-08-20)
  hookSeed: string
}
```

| Campo | Tipo | Descrição |
|---|---|---|
| `level` | number | `Character.level`, hoje sempre 1 (D1 ausente). |
| `classKey` | string | `Character.class`, chave canônica EN (US-105). |
| `background` | `CharacterBackground` | `Character.background` bruto — pode ser `{}`. |
| `origin` | `OriginNarrative` | `Character.origin` resolvido: só `adventuresAndAdvancement`, vindo do catálogo (`resolveAdventuresAndAdvancement`) — opcional, `origin: {}` ou `origin.key` fora do catálogo produz `undefined`. `connection`/`memento` (texto escolhido no wizard, US-124) **não** entram aqui desde 2026-08-20 — ficam de fora do perfil de propósito, seguem servindo só a narração de turno ao vivo. |
| `hookSeed` | string | `resolveInitialHook(config, classKey)?.openingNarration`, **resolvido** via `this.resolveHook` (placeholders `{characterName}`/`{characterClass}` substituídos, nunca cru) — sempre presente quando o sistema tem catálogo de ganchos; rede de segurança para `background`/`origin` vazios. |

**Persistência:** nenhuma — objeto efêmero, montado dentro da chamada de criação da aventura, passado à [US-149](./US-149-segredos-40-prompts-lgmrd.md).

---

## Critérios de aceite

- [x] `buildAdventureProfile` existe como método privado de `AdventureService`, aceita `Character` (ou os campos relevantes: `level`, `class`, `background`, `origin`, `name`) + `SystemConfig`, devolve `AdventureProfile` com os cinco campos (`level`, `classKey`, `background`, `origin`, `hookSeed`).
- [x] `hookSeed` vem resolvido (via `this.resolveHook`) — nenhum placeholder `{characterName}`/`{characterClass}` sobrevive no valor devolvido.
- [x] Personagem com `background: {}` **e** `origin: {}` produz `AdventureProfile` válido — `hookSeed` presente, sem lançar exceção, sem campo `undefined` inesperado.
- [x] `origin.adventuresAndAdvancement` só aparece quando `origin.key` existe no catálogo (`config.backgrounds`) — mesma resolução de `resolveAdventuresAndAdvancement`, sem reimplementar o lookup.
- [x] **(Atualização 2026-08-20)** `origin.connection`/`origin.memento` NÃO aparecem no `AdventureProfile` — perfil carrega só `adventuresAndAdvancement`; os dois campos continuam em `Character.origin`, intactos, fora do perfil de propósito.
- [x] `level` reflete `Character.level` (hoje sempre 1); a assinatura não assume valor fixo internamente (aceita o campo, não hardcoda `1`).
- [x] `classKey` é a chave canônica de `Character.class`, sem passar por matcher de texto (mesmo lookup direto da US-105).
- [x] **Eval / teste de regressão:** teste unitário com personagem de `background`/`origin` totalmente preenchidos (story, bonds, flaws, deity, connection, memento, origin.key válido) e outro com `background: {}`/`origin: {}` — os dois produzem `AdventureProfile` válido, e o segundo tem `hookSeed` não-vazio mesmo sem nenhum campo de `background`/`origin`.

---

## Notas de implementação

- **Reusar `CharacterBackground`** de `@ai-dm/ai-engine` ([adventure.service.ts:6](../../../apps/api/src/adventure/adventure.service.ts) já importa `type CharacterBackground` de lá) — não inventar tipo novo para o mesmo shape que `generateOpeningNarration` já consome.
- **Reusar `OriginNarrative` e `resolveAdventuresAndAdvancement`** de `@ai-dm/ai-engine` ([dm-system.ts:115-133](../../../packages/ai-engine/src/prompts/dm-system.ts)) — o padrão de montagem já existe em [ai.service.ts:344-356](../../../apps/api/src/ai/ai.service.ts) (turno) e é o mesmo que esta story precisa para o perfil de geração; copiar a forma, não a chamada (esta é síncrona/determinística, não depende de LLM).
- **`background` e `origin` são campos SEPARADOS** de `Character` (schema.prisma:40-43, US-122 §Nomenclatura) — o perfil os carrega como dois campos irmãos, nunca mesclados num objeto só.
- **`resolveInitialHook`** ([starting-inventory.ts](../../../apps/api/src/character/starting-inventory.ts)) já faz o lookup com fallback `default` — esta story só chama a função existente, não reimplementa a resolução de gancho.
- **`hookSeed` reusa `this.resolveHook`** ([adventure.service.ts:64-74](../../../apps/api/src/adventure/adventure.service.ts)) para substituir os placeholders do template — mesma chamada que `createForCharacter` já faz antes de mandar `openingNarration` pro LLM (linha 142). É o motivo de `buildAdventureProfile` ser método de `AdventureService`, não função livre: sem acesso a `this.resolveHook`, ou duplicaria `resolveHookTemplate` ou devolveria hookSeed com `{characterName}` cru — nenhum dos dois aceitável, já que o perfil alimenta prompt de LLM na US-149.
- **`background.deity` é o encaixe mais forte**, segundo o backlog: `{name, portfolio}` é uma divindade com domínio declarada pelo jogador, e é o eixo natural para o antagonista e o fecho da aventura saírem de quem o personagem é. Vale nota de implementação para quem escrever a [US-149](./US-149-segredos-40-prompts-lgmrd.md): o perfil carrega `deity` intacto dentro de `background`, sem desmontar o objeto.
- **Atualização 2026-08-20 — `origin.connection`/`memento` saíram do perfil.** Motivo: só `adventuresAndAdvancement` (gancho fixo do catálogo, "Aventura e Avanço") deve alimentar o motor de geração; `connection`/`memento` (vínculo/objeto escolhidos no wizard) continuam existindo em `Character.origin` e continuam sendo lidos pela narração de turno ao vivo ([ai.service.ts:344-356](../../../apps/api/src/ai/ai.service.ts), monta seu próprio `originNarrative` direto de `Character.origin`, independente deste perfil) — só param de chegar ao motor de geração (`buildAdventureProfile` → [US-149](./US-149-segredos-40-prompts-lgmrd.md)). `characterAnchors()` em `ai.service.ts` (compartilhada por `generateSecrets` e `generateOpeningBeat`) foi ajustada no mesmo commit para ler `origin.adventuresAndAdvancement` em vez de `connection`/`memento`.

---

## Questões em aberto

1. ~~Este perfil vive num arquivo próprio (`adventure-profile.ts`) ou como método privado de `AdventureService`?~~ Resolvido: dentro de `adventure.service.ts` (ver *Escopo* acima) — arquivo em 301 linhas, longe do teto de 500, e sem consumidor externo que justifique módulo próprio.
2. **`origin` foi adicionado a este perfil depois do backlog original** (a tabela de entradas do motor, [backlog §GEN-5](./backlog-motor-de-geracao-de-aventuras.md), lista só `Character.level` e `Character.background`) — a própria tabela do backlog ainda não foi atualizada. Já resolvido para a consumidora: a [US-149](./US-149-segredos-40-prompts-lgmrd.md) agora inclui `origin.connection`/`memento` no contexto obrigatório da chamada, ao lado de `background`.

---

## Referências no código

- [apps/api/prisma/schema.prisma](../../../apps/api/prisma/schema.prisma) — `Character.level` (`Int @default(1)`), `Character.background` (`Json @default("{}")`), `Character.origin` (`Json @default("{}")`, linhas 40-43, distinto de `background`), `Character.class`.
- [apps/api/src/adventure/adventure.service.ts:144](../../../apps/api/src/adventure/adventure.service.ts) — `generateOpeningNarration` já recebe `background` como `CharacterBackground`; o mesmo shape é reusado aqui.
- [apps/api/src/adventure/adventure.service.ts:116-120](../../../apps/api/src/adventure/adventure.service.ts) — leitura de `character.origin` para equipamento (US-128); mesma forma `{key?, connection?, memento?}` que esta story resolve para narrativa.
- [apps/api/src/ai/ai.service.ts:344-356](../../../apps/api/src/ai/ai.service.ts) — `originNarrative` montado por turno com `resolveAdventuresAndAdvancement` + `connection`/`memento` brutos; padrão a reusar aqui.
- [packages/ai-engine/src/prompts/dm-system.ts:59-133](../../../packages/ai-engine/src/prompts/dm-system.ts) — `CharacterBackground`, `OriginNarrative`, `resolveAdventuresAndAdvancement`.
- [apps/api/src/character/starting-inventory.ts](../../../apps/api/src/character/starting-inventory.ts) — `resolveInitialHook`, fonte de `hookSeed`.
- [Backlog — Motor de geração de aventuras one-shot §GEN-5 e §Ressalva do background vazio](./backlog-motor-de-geracao-de-aventuras.md) (US-148) — texto de origem; tabela de entradas ainda não lista `origin` (ver *Questões em aberto* #2).
