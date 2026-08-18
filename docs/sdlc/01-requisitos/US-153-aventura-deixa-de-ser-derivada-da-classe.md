# US-153 — A aventura deixa de ser derivada da classe

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** [US-164](./US-164-orquestrador-motor-monta-aventura-gerada.md) (`generateAdventure`, a função que esta story chama) · [US-150](./US-150-gate-antes-de-persistir-aventura-gerada.md) (artefato validado) · [US-151](./US-151-semear-ledger-segredos-gerados.md) (ledger semeado do artefato)
**Relacionado:** [Backlog — Motor de geração de aventuras one-shot](./backlog-motor-de-geracao-de-aventuras.md) (US-153) · [ADR 012](../../adr/012-aventura-gerada-como-dado.md) (resolve rótulos `GEN-N` do backlog para número de story) · [US-28](./US-28-aventura-inicial-baseada-na-classe.md) (o mecanismo que esta story substitui) · [starting-inventory.ts](../../../apps/api/src/character/starting-inventory.ts) (`resolveInitialHook`, que continua vivo como porta de entrada)
**Criada em:** 2026-08-15

---

## História

> **Como** jogador,
> **quero** que minha aventura inicial venha do motor de geração — ancorada no meu personagem específico, não numa entre 13 aventuras fixas por classe —,
> **para que** dois personagens da mesma classe, com histórias diferentes, recebam aventuras diferentes, e o mesmo personagem regenerado receba sempre a mesma.

---

## Contexto e motivação

### O problema observado

Hoje `createForCharacter` resolve a aventura por `resolveInitialHook(config, character.class)` ([adventure.service.ts:97](../../../apps/api/src/adventure/adventure.service.ts)) — toda aventura vem de um catálogo de 13 ganchos fixos, um por classe base (mais um `default`). Dois bárbaros recebem exatamente a mesma premissa (*"A Ascensão na Tribo"*), independente de `background.story`, `bonds` ou `deity` serem completamente diferentes. A validação atual **rejeita** explicitamente qualquer `initialHookId` diferente do da classe ([adventure.service.ts:99-101](../../../apps/api/src/adventure/adventure.service.ts)) — o acoplamento não é acidental, é reforçado por código.

### Por que a solução atual não basta

A [US-28](./US-28-aventura-inicial-baseada-na-classe.md) resolveu bem o problema que tinha: aventura inicial sem depender de aventura autoral escrita para todas as classes. Mas ela é, por desenho, **campanha única com aberturas diferentes** — o mesmo raciocínio que o [backlog irmão](./backlog-aventuras-autorais-lazygm.md) descreve para a AV-3 original (*"personagens de classes diferentes recebem a mesma campanha, com aberturas diferentes"*). O motor de geração inverte esse critério: não é mais campanha única com 13 variações de entrada — é uma aventura **por personagem**.

### A proposta

`createForCharacter` para de resolver a aventura por `resolveInitialHook(config, character.class)` e passa a chamar `generateAdventure` ([US-164](./US-164-orquestrador-motor-monta-aventura-gerada.md) — o orquestrador que junta as peças de US-143 a US-152/159/160). O gancho **continua vivo** como porta de entrada: `openingNarration` do hook vira o `hookSeed` que a [US-148](./US-148-perfil-personagem-entrada-motor.md) consome, explicando por que *aquele* personagem está *nesta* aventura — mas deixa de ser a aventura inteira.

---

## Escopo

### Dentro do escopo

- **`createForCharacter` chama `generateAdventure`** ([US-164](./US-164-orquestrador-motor-monta-aventura-gerada.md)) em vez de `resolveInitialHook` sozinho — o gancho é resolvido (continua existindo), mas só alimenta `hookSeed` ([US-148](./US-148-perfil-personagem-entrada-motor.md)), não decide mais a estrutura inteira.
- **Sai a validação que rejeita `initialHookId` diferente do da classe** ([adventure.service.ts:99-101](../../../apps/api/src/adventure/adventure.service.ts)) — não há mais um `initialHookId` escolhido pelo cliente para validar contra; a aventura é sempre gerada.
- **`CreateAdventureDto`** (hoje `{ initialHookId: string }`, [adventure.service.ts:9-11](../../../apps/api/src/adventure/adventure.service.ts)) perde esse campo e ganha os três campos de registro opcionais da [US-156](./US-156-catalogos-registro-dto-validacao.md) (`setting?`, `tone?`, `areaType?`), todos opcionais.
- **Critério central:** dois personagens da mesma classe, com `background` diferentes, recebem aventuras diferentes; o mesmo personagem regenerado (mesmo `characterId` + `order`) recebe a mesma — a garantia de determinismo da [US-146](./US-146-seed-deterministico-motor-aventura.md) verificada ponta a ponta neste fluxo.
- **A abertura narrada continua existindo** — `generateOpeningNarration` ([adventure.service.ts:133](../../../apps/api/src/adventure/adventure.service.ts)) segue rodando, mas agora com `mainQuest` derivado do artefato gerado (`adventure.summary`/`start`), não mais de `hook.primaryQuestTitle`/`Description` fixos.

### Fora do escopo

- **Remover o campo de gancho do config.** `openingNarration`/`tags` continuam existindo em `InitialAdventureHookSchema` — só os dois campos de quest fixa saem, e isso é escopo da [US-155](./US-155-aposentar-quest-fixa-por-classe.md), não desta story.
- **A geração em si ([US-143](./US-143-adr-aventura-como-dado-gerado.md) a [US-164](./US-164-orquestrador-motor-monta-aventura-gerada.md)).** Esta story só troca o **caminho de chamada** de `createForCharacter` — a US-164 já entrega `generateAdventure` pronto para ser chamado.
- **A tela de escolha de registro** ([US-157](./US-157-tela-de-mundo-depois-da-revisao.md)) — esta story consome `setting`/`tone`/`areaType` opcionais no DTO, mas a UI que os envia é story separada.

---

## Modelo de dados proposto

```ts
// apps/api/src/adventure/adventure.service.ts
export interface CreateAdventureDto {
  // initialHookId REMOVIDO — a aventura é sempre gerada, não escolhida pelo cliente.
  setting?: string  // US-156: chave do catálogo, ou ausente = sorteado pelo seed
  tone?: string
  areaType?: string
}
```

| Campo | Antes (US-28) | Depois |
|---|---|---|
| `CreateAdventureDto.initialHookId` | obrigatório, validado contra a classe | **removido** |
| `CreateAdventureDto.setting/tone/areaType` | não existiam | novos, todos opcionais ([US-156](./US-156-catalogos-registro-dto-validacao.md)) |

**Persistência:** sem migração de schema Prisma nesta story — `Adventure`/`Quest` continuam com os mesmos campos; o que muda é a **fonte** de `title`/`Quest.title`/`Quest.description` (do artefato gerado, não do hook fixo).

---

## Critérios de aceite

- [ ] `createForCharacter` chama `generateAdventure` ([US-164](./US-164-orquestrador-motor-monta-aventura-gerada.md)) para produzir a `GeneratedAdventure`, em vez de resolver só `resolveInitialHook`.
- [ ] `resolveInitialHook` continua sendo chamado — seu resultado alimenta `hookSeed` ([US-148](./US-148-perfil-personagem-entrada-motor.md)), não a estrutura da aventura.
- [ ] A validação que rejeita `initialHookId` diferente do da classe é removida — não existe mais `initialHookId` no DTO.
- [ ] `CreateAdventureDto` não tem mais `initialHookId`; tem `setting?`, `tone?`, `areaType?`, todos opcionais.
- [ ] Dois personagens da mesma classe, com `background` diferentes, recebem `GeneratedAdventure` com conteúdo diferente (locais, NPCs, segredos distintos) — verificável em teste com dois personagens fixture.
- [ ] O mesmo personagem, recriando a aventura com o mesmo `order`, recebe a mesma `GeneratedAdventure` — determinismo ponta a ponta.
- [ ] `Adventure.title` e `Quest.title`/`Quest.description` derivam do artefato gerado (`adventure.summary`, `adventure.start`/`conclusion`), não mais dos campos fixos do hook.
- [ ] `generateOpeningNarration` continua rodando, com `mainQuest` vindo do artefato gerado.
- [ ] `pnpm typecheck` e `pnpm test` passam.
- [ ] **Eval / teste de regressão:** teste de integração criando aventura para dois personagens da mesma classe com `bonds` diferentes — confirma que o texto de `Quest.description` (ou o artefato subjacente) difere entre os dois; teste de regeneração confirma paridade byte a byte para o mesmo personagem.

---

## Notas de implementação

- **Ordem de troca no código:** `rawHook`/validação de `initialHookId` ([adventure.service.ts:97-101](../../../apps/api/src/adventure/adventure.service.ts)) é o bloco que sai; `hook.primaryQuestTitle`/`Description` usados na criação de `Quest` ([adventure.service.ts:211-217](../../../apps/api/src/adventure/adventure.service.ts)) trocam de fonte para o artefato gerado.
- **`hook.title` como `Adventure.title` também troca** — hoje `title: hook.title` ([adventure.service.ts:187](../../../apps/api/src/adventure/adventure.service.ts)); passa a vir de `adventure.summary` DIRETO, sem transformação (decidido, ver *Questões em aberto* #1 — resolvida).
- **`className`/`raceName` continuam resolvidos e passados ao motor** ([US-148](./US-148-perfil-personagem-entrada-motor.md) já usa `classKey`) — mas os rótulos (`catalogLabel`) continuam servindo só a mensagem de erro e o prompt de narração, mesma disciplina da US-105.
- **`GeneratedAdventureSchema` sem `title`** é a lacuna concreta que esta story descobre — se confirmado, é uma emenda pequena à US-144 (adicionar `title: z.string().min(1)`), não uma reabertura de escopo.

---

## Questões em aberto

1. ~~`GeneratedAdventureSchema` (US-144) não lista `title` entre os campos — confirmar se `summary` serve como título curto ou se falta um campo.~~ **RESOLVIDO (2026-08-18): `summary` serve como título, sem campo novo.** `summary = content.premissa` (US-164, `adventure.service.ts`) é a linha CRUA da tabela `1d20quests` do LGMRD ([roll-content.ts:57](../../../apps/api/src/adventure-generation/roll-content.ts)) — frases curtas tipo `"Kill a villain"`, `"Rescue an NPC"`, já no formato de título, não de resumo longo. `Adventure.title = adventure.summary`, direto, sem transformação — sem emendar a US-144, sem campo novo no schema.
2. O que acontece com o `id` do hook (`rawHook.id`, usado hoje em log/depuração)? Provavelmente nada — o `hookSeed` (texto) é o que sobrevive, o `id` do gancho deixa de ter consumidor fora da resolução interna.

---

## Referências no código

- [apps/api/src/adventure/adventure.service.ts:9-11](../../../apps/api/src/adventure/adventure.service.ts) — `CreateAdventureDto`, o tipo que perde `initialHookId`.
- [apps/api/src/adventure/adventure.service.ts:76-102](../../../apps/api/src/adventure/adventure.service.ts) — `createForCharacter`, resolução do hook e a validação que sai (`:99-101`).
- [apps/api/src/adventure/adventure.service.ts:187,211-217](../../../apps/api/src/adventure/adventure.service.ts) — `Adventure.title`, `Quest.title`/`Quest.description`, os pontos que trocam de fonte.
- [apps/api/src/character/starting-inventory.ts](../../../apps/api/src/character/starting-inventory.ts) — `resolveInitialHook`, que continua vivo como porta de entrada (`hookSeed`).
- [US-164](./US-164-orquestrador-motor-monta-aventura-gerada.md) — `generateAdventure`, a função que esta story passa a chamar.
- [US-28](./US-28-aventura-inicial-baseada-na-classe.md) — o mecanismo original que esta story substitui.
- [Backlog — Motor de geração de aventuras one-shot §GEN-10](./backlog-motor-de-geracao-de-aventuras.md) (US-153) — texto de origem.
