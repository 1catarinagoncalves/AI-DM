# US-148 — Perfil do personagem como entrada do motor

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** nenhuma
**Relacionado:** [Backlog — Motor de geração de aventuras one-shot](./backlog-motor-de-geracao-de-aventuras.md) (GEN-5, bloqueia GEN-6) · [US-39](./US-39-identidade-narrativa-background-ideais.md)/[US-40](./US-40-divindade-do-personagem.md) (`Character.background`) · [starting-inventory.ts](../../../apps/api/src/character/starting-inventory.ts) (`resolveInitialHook`, fonte do `hookSeed`)
**Criada em:** 2026-08-15

---

## História

> **Como** mantenedora,
> **quero** montar, a partir do personagem, o perfil que o motor de geração recebe — nível, chave de classe, `background` e o `hookSeed` do gancho de classe —,
> **para que** os 40 prompts de segredo ([GEN-6](./US-149-segredos-40-prompts-lgmrd.md)) tenham `story`/`bonds`/`flaws` no contexto, e um personagem com `background` vazio ainda gere uma aventura completa.

---

## Contexto e motivação

### O problema observado

`Character.background` (Json, `{story?, ideals?, bonds?, flaws?, deity?}`) já chega ao modelo hoje — `createForCharacter` o passa a `generateOpeningNarration` ([adventure.service.ts:144](../../../apps/api/src/adventure/adventure.service.ts)). O que **não** existe é ele decidir a **estrutura** da aventura: quem é o antagonista, que NPC está amarrado a qual `bond`, qual `flaw` a aventura cobra. Sem um perfil explícito montado para o motor, cada story consumidora (GEN-6 em diante) reimplementaria sua própria leitura de `Character`, arriscando divergir em como trata `background` vazio.

### Por que a solução atual não basta

`background` é `Json @default("{}")` no [schema.prisma](../../../apps/api/prisma/schema.prisma) — criar personagem sem preencher nada é caminho válido, e hoje nada no repo testa explicitamente "motor com background vazio ainda funciona", porque o motor não existe. `Character.level` é `Int @default(1)` e nada no repo o incrementa — a assinatura do motor precisa aceitar nível desde já (para não precisar de retrabalho quando a progressão existir), mesmo que hoje só produza nível 1.

### A proposta

Uma função `buildAdventureProfile(character, config)` que monta `{ level, classKey, background, hookSeed }`, com `hookSeed` sempre presente (vindo de `resolveInitialHook`) como rede de segurança para quando `background` está vazio.

---

## Escopo

### Dentro do escopo

- **`buildAdventureProfile(character, config): AdventureProfile`** — monta o perfil: `level` (de `Character.level`), `classKey` (de `Character.class`, já chave canônica desde a [US-105](./US-105-raca-e-classe-por-chave-do-srd.md)), `background` (de `Character.background`, tipado como `CharacterBackground` de `@ai-dm/ai-engine`, já usado por `generateOpeningNarration`), `hookSeed` (de `resolveInitialHook(config, character.class)?.openingNarration`).
- **Critério que não pode faltar:** personagem com `background` vazio (`{}`) gera perfil válido, caindo no `hookSeed` da classe como única fonte de contexto narrativo — nunca lança nem devolve perfil incompleto.
- **Assinatura recebe nível desde já**, com valor 1 enquanto a D1 (progressão de nível, sem dono, ver *Depende de* no backlog) não existir — o motor não é bloqueado por progressão ausente, só limitado a gerar para nível 1 até ela chegar.
- **Local:** `apps/api/src/adventure/adventure-profile.ts` (ou dentro de `adventure.service.ts`, a decidir pela implementação) — consumido por [GEN-6](./US-149-segredos-40-prompts-lgmrd.md).

### Fora do escopo

- **A chamada ao modelo que usa este perfil** — é [GEN-6](./US-149-segredos-40-prompts-lgmrd.md); esta story só monta o objeto de entrada.
- **Progressão de nível (D1)** — fora do escopo deste backlog inteiro (ver *Depende de* no documento-pai); esta story só garante que a assinatura aceita nível diferente de 1 quando a D1 existir, sem reescrever a função.
- **Resolução de `hookSeed` para classe sem gancho** — já resolvido por `resolveInitialHook` (devolve `null` só quando o sistema não tem catálogo algum, caso que `SystemConfigSchema` já cobre com `initialAdventures` opcional); esta story não muda esse comportamento, só consome.

---

## Modelo de dados proposto

```ts
// apps/api/src/adventure/adventure-profile.ts
export interface AdventureProfile {
  level: number
  classKey: string
  background: CharacterBackground // {story?, ideals?, bonds?, flaws?, deity?}, de @ai-dm/ai-engine
  hookSeed: string
}
```

| Campo | Tipo | Descrição |
|---|---|---|
| `level` | number | `Character.level`, hoje sempre 1 (D1 ausente). |
| `classKey` | string | `Character.class`, chave canônica EN (US-105). |
| `background` | `CharacterBackground` | `Character.background` bruto — pode ser `{}`. |
| `hookSeed` | string | `resolveInitialHook(config, classKey)?.openingNarration` — sempre presente quando o sistema tem catálogo de ganchos; rede de segurança para background vazio. |

**Persistência:** nenhuma — objeto efêmero, montado dentro da chamada de criação da aventura, passado a GEN-6.

---

## Critérios de aceite

- [ ] `buildAdventureProfile` existe, aceita `Character` (ou os campos relevantes) + `SystemConfig`, devolve `AdventureProfile` com os quatro campos.
- [ ] Personagem com `background: {}` produz `AdventureProfile` válido — `hookSeed` presente, sem lançar exceção, sem campo `undefined` inesperado.
- [ ] `level` reflete `Character.level` (hoje sempre 1); a assinatura não assume valor fixo internamente (aceita o campo, não hardcoda `1`).
- [ ] `classKey` é a chave canônica de `Character.class`, sem passar por matcher de texto (mesmo lookup direto da US-105).
- [ ] **Eval / teste de regressão:** teste unitário com personagem de `background` totalmente preenchido (story, bonds, flaws, deity) e outro com `background: {}` — os dois produzem `AdventureProfile` válido, e o segundo tem `hookSeed` não-vazio mesmo sem nenhum campo de `background`.

---

## Notas de implementação

- **Reusar `CharacterBackground`** de `@ai-dm/ai-engine` ([adventure.service.ts:6](../../../apps/api/src/adventure/adventure.service.ts) já importa `type CharacterBackground` de lá) — não inventar tipo novo para o mesmo shape que `generateOpeningNarration` já consome.
- **`resolveInitialHook`** ([starting-inventory.ts](../../../apps/api/src/character/starting-inventory.ts)) já faz o lookup com fallback `default` — esta story só chama a função existente, não reimplementa a resolução de gancho.
- **`background.deity` é o encaixe mais forte**, segundo o backlog: `{name, portfolio}` é uma divindade com domínio declarada pelo jogador, e é o eixo natural para o antagonista e o fecho da aventura saírem de quem o personagem é. Vale nota de implementação para quem escrever GEN-6: o perfil carrega `deity` intacto dentro de `background`, sem desmontar o objeto.

---

## Questões em aberto

1. Este perfil vive num arquivo próprio (`adventure-profile.ts`) ou como método privado de `AdventureService`? A escolha não muda o contrato, só a organização — decidir olhando o tamanho real de `adventure.service.ts` na hora (regra do projeto: arquivo abaixo de 500 linhas, função 4–20).

---

## Referências no código

- [apps/api/prisma/schema.prisma](../../../apps/api/prisma/schema.prisma) — `Character.level` (`Int @default(1)`), `Character.background` (`Json @default("{}")`), `Character.class`.
- [apps/api/src/adventure/adventure.service.ts:144](../../../apps/api/src/adventure/adventure.service.ts) — `generateOpeningNarration` já recebe `background` como `CharacterBackground`; o mesmo shape é reusado aqui.
- [apps/api/src/character/starting-inventory.ts](../../../apps/api/src/character/starting-inventory.ts) — `resolveInitialHook`, fonte de `hookSeed`.
- [Backlog — Motor de geração de aventuras one-shot §GEN-5 e §Ressalva do background vazio](./backlog-motor-de-geracao-de-aventuras.md) — texto de origem.
