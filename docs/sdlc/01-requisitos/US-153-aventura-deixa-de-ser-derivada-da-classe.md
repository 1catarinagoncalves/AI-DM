# US-153 — A aventura deixa de ser derivada da classe

> ⚠️ **`CreateAdventureDto.setting`/`.areaType` retirados por [US-173](./US-173-registro-fica-so-com-tone.md) (2026-08-19).** Esta story introduziu os três campos opcionais (`setting?`/`tone?`/`areaType?`); US-173 reduz o DTO a só `tone?`. Histórico abaixo descreve os três como implementados originalmente; não reescrito (convenção US-02/US-105).

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada (2026-08-18) — `setting`/`areaType` do DTO retirados por US-173 (2026-08-19)
**Depende de:** [US-164](./US-164-orquestrador-motor-monta-aventura-gerada.md) (✅ implementada 2026-08-18 — `AdventureService.generateAdventure`, a função que esta story chama) · [US-150](./US-150-gate-antes-de-persistir-aventura-gerada.md) (artefato validado) · [US-151](./US-151-semear-ledger-segredos-gerados.md) (ledger semeado do artefato)
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

Hoje `createForCharacter` resolve a aventura por `resolveInitialHook(config, character.class)` ([adventure.service.ts:208](../../../apps/api/src/adventure/adventure.service.ts)) — toda aventura vem de um catálogo de 13 ganchos fixos, um por classe base (mais um `default`). Dois bárbaros recebem exatamente a mesma premissa (*"A Ascensão na Tribo"*), independente de `background.story`, `bonds` ou `deity` serem completamente diferentes. A validação atual **rejeita** explicitamente qualquer `initialHookId` diferente do da classe ([adventure.service.ts:210-211](../../../apps/api/src/adventure/adventure.service.ts)) — o acoplamento não é acidental, é reforçado por código.

### Por que a solução atual não basta

A [US-28](./US-28-aventura-inicial-baseada-na-classe.md) resolveu bem o problema que tinha: aventura inicial sem depender de aventura autoral escrita para todas as classes. Mas ela é, por desenho, **campanha única com aberturas diferentes** — o mesmo raciocínio que o [backlog irmão](./backlog-aventuras-autorais-lazygm.md) descreve para a AV-3 original (*"personagens de classes diferentes recebem a mesma campanha, com aberturas diferentes"*). O motor de geração inverte esse critério: não é mais campanha única com 13 variações de entrada — é uma aventura **por personagem**.

### Achado ao planejar a implementação (2026-08-18, contra o código real da US-164)

`AdventureService.generateAdventure(profile, characterId, order, registryOverrides?)` ([adventure.service.ts:130](../../../apps/api/src/adventure/adventure.service.ts)) recebe `order` como PARÂMETRO — precisa dele antes de rodar — e faz três chamadas de modelo (LLM), então tem que rodar FORA de `$transaction`, mesma disciplina que o próprio arquivo já aplica a `generateOpeningNarration`/`extractOpeningScene`/`extractOpeningEntities` ("LLM é lento e não deve segurar locks", comentário em `createForCharacter`).

Conflito real com o código de hoje: `order` é calculado DENTRO da transação — `const order = (await tx.adventureParticipant.count(...)) + 1` ([adventure.service.ts:285](../../../apps/api/src/adventure/adventure.service.ts)). Não dá pra chamar `generateAdventure` antes de abrir a transação sem `order`, e não dá pra abrir a transação antes de chamar `generateAdventure` (violaria "LLM fora de lock"). Solução: mover o cálculo de `order` pra ANTES da transação (mesma contagem, só trocando `tx.adventureParticipant.count` por `this.prisma.adventureParticipant.count` — sem `tx`, já que ainda não existe transação aberta), chamar `generateAdventure` com esse `order`, e passar o MESMO valor pra dentro da transação em vez de recalcular — `tx.adventure.create({ data: { order, ... } })` usa o `order` já conhecido, não um novo `count()`.

### A proposta

`createForCharacter` para de resolver a aventura por `resolveInitialHook(config, character.class)` e passa a chamar `generateAdventure` ([US-164](./US-164-orquestrador-motor-monta-aventura-gerada.md) — o orquestrador que junta as peças de US-143 a US-152/159/160). O gancho **continua vivo** como porta de entrada: `openingNarration` do hook vira o `hookSeed` que a [US-148](./US-148-perfil-personagem-entrada-motor.md) consome, explicando por que *aquele* personagem está *nesta* aventura — mas deixa de ser a aventura inteira.

---

## Escopo

### Dentro do escopo

- **`createForCharacter` chama `generateAdventure`** ([US-164](./US-164-orquestrador-motor-monta-aventura-gerada.md)) em vez de `resolveInitialHook` sozinho — o gancho é resolvido (continua existindo), mas só alimenta `hookSeed` ([US-148](./US-148-perfil-personagem-entrada-motor.md)), não decide mais a estrutura inteira.
- **`order` sai de dentro da transação** (achado 2026-08-18 acima) — calculado antes, via `this.prisma.adventureParticipant.count` (sem `tx`), pra `generateAdventure` poder rodar fora do lock; a transação passa a RECEBER `order` já pronto, não recalcular.
- **Sai a validação que rejeita `initialHookId` diferente do da classe** ([adventure.service.ts:210-211](../../../apps/api/src/adventure/adventure.service.ts)) — não há mais um `initialHookId` escolhido pelo cliente para validar contra; a aventura é sempre gerada.
- **`CreateAdventureDto`** (hoje `{ initialHookId: string }`, [adventure.service.ts:13-16](../../../apps/api/src/adventure/adventure.service.ts)) perde esse campo e ganha os três campos de registro opcionais da [US-156](./US-156-catalogos-registro-dto-validacao.md) (`setting?`, `tone?`, `areaType?`), todos opcionais.
- **Critério central:** dois personagens da mesma classe, com `background` diferentes, recebem aventuras diferentes; o mesmo personagem regenerado (mesmo `characterId` + `order`) recebe a mesma — a garantia de determinismo da [US-146](./US-146-seed-deterministico-motor-aventura.md) verificada ponta a ponta neste fluxo.
- **A abertura narrada continua existindo** — `generateOpeningNarration` ([adventure.service.ts:244](../../../apps/api/src/adventure/adventure.service.ts)) segue rodando, mas agora com `mainQuest` derivado do artefato gerado (`adventure.summary`/`start`), não mais de `hook.primaryQuestTitle`/`Description` fixos.

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

- [x] `createForCharacter` chama `generateGatedAdventure` ([US-150](./US-150-gate-antes-de-persistir-aventura-gerada.md), não `generateAdventure` direto — questão em aberto #3, resolvida) para produzir a `GeneratedAdventure`, em vez de resolver só `resolveInitialHook`.
- [x] Quando `GateResult.ok` é `false` (teto de tentativas esgotado), `createForCharacter` lança `new Error(result.reason)` — sem `BadRequestException` e sem fallback estático (#3).
- [x] `order` é calculado ANTES de abrir `$transaction` (não mais dentro dela) e passado tanto pra `generateGatedAdventure` quanto pra `tx.adventure.create` — mesmo valor nos dois lugares, sem recomputar (achado 2026-08-18).
- [x] `resolveInitialHook` continua sendo chamado — seu resultado alimenta `hookSeed` ([US-148](./US-148-perfil-personagem-entrada-motor.md)), não a estrutura da aventura.
- [x] A validação que rejeita `initialHookId` diferente do da classe é removida — não existe mais `initialHookId` no DTO.
- [x] `CreateAdventureDto` não tem mais `initialHookId`; tem `setting?`, `tone?`, `areaType?`, todos opcionais.
- [x] Dois personagens da mesma classe, com `background` diferentes, recebem `GeneratedAdventure` com conteúdo diferente (locais, NPCs, segredos distintos) — verificável em teste com dois personagens fixture.
- [x] O mesmo personagem, recriando a aventura com o mesmo `order`, recebe a mesma `GeneratedAdventure` — determinismo ponta a ponta.
- [x] `Adventure.title = adventure.summary`; `Quest.title = adventure.summary`; `Quest.description = adventure.start` — mapeamento exato (#4, resolvida); `adventure.conclusion` não alimenta nenhum campo de `Quest` nesta story.
- [x] `generateOpeningNarration.mainQuest` E o 2º argumento de `extractOpeningEntities` ([adventure.service.ts:275](../../../apps/api/src/adventure/adventure.service.ts) e [:305](../../../apps/api/src/adventure/adventure.service.ts)) trocam JUNTOS para `` `${adventure.summary}\n${adventure.start}` `` — mesma string derivada nos dois call sites (#5, resolvida).
- [x] Ordem de chamadas de IA dentro de `createForCharacter` muda: `generateGatedAdventure` roda ANTES de `generateOpeningNarration`/`extractOpeningEntities` (não depois) — a narração e a extração de entidades dependem do artefato gerado (#5).
- [x] `pnpm typecheck` e `pnpm test` passam.
- [x] **Eval / teste de regressão:** teste de integração criando aventura para dois personagens da mesma classe com `bonds` diferentes — confirma que o texto de `Quest.description` (ou o artefato subjacente) difere entre os dois; teste de regeneração confirma paridade byte a byte para o mesmo personagem.

---

## Notas de implementação

- **Ordem de troca no código (linhas reais pós-US-164, 2026-08-18):** `rawHook`/validação de `initialHookId` ([adventure.service.ts:210-211](../../../apps/api/src/adventure/adventure.service.ts)) é o bloco que sai; `hook.primaryQuestTitle`/`Description` usados na criação de `Quest` ([adventure.service.ts:322-329](../../../apps/api/src/adventure/adventure.service.ts)) trocam de fonte para o artefato gerado.
- **`hook.title` como `Adventure.title` também troca** — hoje `title: hook.title` ([adventure.service.ts:298](../../../apps/api/src/adventure/adventure.service.ts)); passa a vir de `adventure.summary` DIRETO, sem transformação (decidido, ver *Questões em aberto* #1 — resolvida).
- **`className`/`raceName` continuam resolvidos e passados ao motor** ([US-148](./US-148-perfil-personagem-entrada-motor.md) já usa `classKey`) — mas os rótulos (`catalogLabel`) continuam servindo só a mensagem de erro e o prompt de narração, mesma disciplina da US-105.
- **`generateAdventure` já vive em `AdventureService`** ([adventure.service.ts:130](../../../apps/api/src/adventure/adventure.service.ts), método público, logo acima de `createForCharacter` no arquivo) — chamada direta por `this.generateAdventure(...)`, sem DI nova, sem cruzar módulo.

---

## Questões em aberto

1. ~~`GeneratedAdventureSchema` (US-144) não lista `title` entre os campos — confirmar se `summary` serve como título curto ou se falta um campo.~~ **RESOLVIDO (2026-08-18): `summary` serve como título, sem campo novo.** `summary = content.premissa` (US-164, `adventure.service.ts`) é a linha CRUA da tabela `1d20quests` do LGMRD ([roll-content.ts:57](../../../apps/api/src/adventure-generation/roll-content.ts)) — frases curtas tipo `"Kill a villain"`, `"Rescue an NPC"`, já no formato de título, não de resumo longo. `Adventure.title = adventure.summary`, direto, sem transformação — sem emendar a US-144, sem campo novo no schema.
2. ~~O que acontece com o `id` do hook (`rawHook.id`, usado hoje em log/depuração)?~~ **RESOLVIDO (2026-08-18): nada — sem consumidor.** Checado contra o código real: `rawHook.id` só aparece em [adventure.service.ts:235](../../../apps/api/src/adventure/adventure.service.ts), dentro da própria validação `dto.initialHookId !== rawHook.id` que esta story remove. Nenhum log, nenhuma outra leitura. `hookSeed` (texto de `resolveHook(...).openingNarration`) é o único valor derivado do gancho que sobrevive; `rawHook.id` fica sem consumidor fora da resolução interna.
3. ~~`createForCharacter` chama `generateAdventure` direto, ou `generateGatedAdventure` (US-150)?~~ **RESOLVIDO (2026-08-18): `generateGatedAdventure`.** [adventure-gate.ts:196](../../../apps/api/src/adventure-generation/adventure-gate.ts) já comenta que o gate não tem "nenhum consumidor de persistência ainda" — US-153 é esse consumidor; persistir sem gate reabriria o buraco que a US-150 fechou. `createForCharacter` chama `generateGatedAdventure(profile, characterId, order, registryOverrides)` (`maxAttempts` fica no default = 3 da assinatura). Se `GateResult.ok` é `false` (teto de tentativas esgotado), lança `new Error(result.reason)` — não `BadRequestException` (não é erro de input do cliente, é falha de geração) e sem fallback estático (ao contrário do `openingNarration`, não existe aventura fixa pra cair). `generateWithGate` já loga cada tentativa via `logGateFailure`; o erro final carrega `reason`/`attempt` pro rastro da exceção não tratada.
4. ~~`Quest.title`/`Quest.description` mapeiam para quais campos exatos do artefato — `summary`, `start`, `conclusion` de qual jeito?~~ **RESOLVIDO (2026-08-18): `Quest.title = adventure.summary`, `Quest.description = adventure.start`.** `adventure.summary` é o mesmo valor de `Adventure.title` — não é duplicação espúria, é a premissa da tabela `1d20quests` (curta, tipo título) servindo os dois lugares que precisam do nome da missão. `adventure.start` é `profile.hookSeed` (o gancho/abertura) — dá contexto de por que a personagem está envolvida, sem spoiler. `adventure.conclusion` **não** alimenta nenhum campo de `Quest` nesta story: usá-lo como descrição vazaria o desfecho antes do jogo começar; fica no artefato disponível pra consumo futuro (ex.: tela de fecho), fora do escopo aqui.
5. ~~`generateOpeningNarration.mainQuest` ([adventure.service.ts:275](../../../apps/api/src/adventure/adventure.service.ts)) e o 2º argumento de `extractOpeningEntities` ([:305](../../../apps/api/src/adventure/adventure.service.ts)) hoje usam a MESMA string (`hook.primaryQuestTitle`+`Description`) — o critério de aceite só cita a narração, e o outro call site?~~ **RESOLVIDO (2026-08-18): os dois trocam juntos**, para a mesma string derivada — `` `${adventure.summary}\n${adventure.start}` `` (os mesmos dois campos do item #4 acima), usada tanto em `generateOpeningNarration` quanto em `extractOpeningEntities`. Consequência de ordem: `generateGatedAdventure` (e as três chamadas de IA dentro de `generateAdventure`) precisa rodar ANTES de `generateOpeningNarration` agora, não depois — a sequência de chamadas de IA dentro de `createForCharacter` era narração → extração; passa a ser geração+gate → narração → extração. Nota, não bloqueio: isso serializa uma 4ª chamada de IA atrás das 3 de `generateAdventure`, perdendo paralelismo que hoje existe entre narração e extração; sem otimização nesta story — medir latência depois se virar problema real.

---

## Referências no código

- [apps/api/src/adventure/adventure.service.ts:13-16](../../../apps/api/src/adventure/adventure.service.ts) — `CreateAdventureDto`, o tipo que perde `initialHookId`.
- [apps/api/src/adventure/adventure.service.ts:130](../../../apps/api/src/adventure/adventure.service.ts) — `generateAdventure` (US-164, ✅), a função que esta story passa a chamar.
- [apps/api/src/adventure/adventure.service.ts:187-329](../../../apps/api/src/adventure/adventure.service.ts) — `createForCharacter`; validação de `initialHookId` que sai (`:210-211`), `order` dentro da transação que sai (`:285`, achado 2026-08-18), `Adventure.title` (`:298`), `Quest.title`/`Quest.description` (`:322-329`).
- [apps/api/src/character/starting-inventory.ts](../../../apps/api/src/character/starting-inventory.ts) — `resolveInitialHook`, que continua vivo como porta de entrada (`hookSeed`).
- [US-28](./US-28-aventura-inicial-baseada-na-classe.md) — o mecanismo original que esta story substitui.
- [Backlog — Motor de geração de aventuras one-shot §GEN-10](./backlog-motor-de-geracao-de-aventuras.md) (US-153) — texto de origem.
