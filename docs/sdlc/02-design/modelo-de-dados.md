# Modelo de Dados — AI Dungeon Master

**Atualizado em:** 2026-07-29

> **Fonte de verdade é [`apps/api/prisma/schema.prisma`](../../../apps/api/prisma/schema.prisma).**
> Este documento é o mapa de leitura — divergiu, o schema ganha.
>
> D1 e D2 da [ADR 003 — Sistemas como dado](../../adr/003-sistemas-como-dado.md) estão implementadas:
> `System.config` + `Character.systemId` ([US-21](../01-requisitos/US-21-sistemas-como-dado.md))
> e a fusão `Campaign`+`Adventure` ([US-22](../01-requisitos/US-22-fusao-campanha-aventura.md)).
> Diagrama conferido campo a campo contra o schema em 29/07/2026 ([US-89](../01-requisitos/US-89-gate-de-codigo-morto-com-knip.md)).

---

## Diagrama de entidades (núcleo)

Hierarquia: **System → Character → Adventure** — o personagem pertence a um sistema, e é o fio de
continuidade entre aventuras seguidas (ficha + memória, [ADR 002](../../adr/002-memoria-de-sessao.md)).

Valor de enum aparece **MAIÚSCULO** porque é assim que sai do Prisma e da API (`ACTIVE`,
não `active`).

```
User
  id, email (unique), name, createdAt

System                  ← sistema de regras (Free, D&D SRD, customizado via upload)
  id, name, version
  sourceType (FREE | SRD | UPLOAD)
  config (JSON?)        ← D1: atributos + perícias + kits iniciais (SystemConfigSchema, Zod em shared)
  ragIndexId (String?)  ← reservado para o índice do RAG de regras; NADA escreve nele hoje
                          (o corpus é a US-48, não implementada)

Character               ← pertence a UM sistema (systemId conhecido na criação)
  id, userId, systemId, name, gender, race, class, level
  baseAttributes (JSON) ← validado contra System.config.attributes
  skills (JSON)         ← US-27: keys das perícias proficientes (string[])
  features (JSON)       ← US-41: features de classe de nível 1
  spells (JSON)         ← US-42: magias conhecidas (fonte do getSpell)
  background (JSON)     ← US-39/US-40: story, ideals, bonds, flaws, deity
  createdAt

CharacterState          ← estado vivo do personagem em uma aventura
  id, characterId, adventureId
  hp, maxHp
  attributes (JSON)     ← pode evoluir com level-up
  inventory (JSON)
  conditions (JSON)     ← envenenado, incapacitado, etc.
  sceneState (JSON?)    ← continuidade espacial (ADR 002 / US-11b)
  updatedAt

Adventure               ← a história (campanha e aventura FUNDIDAS; 1 missão principal)
  id, systemId, creatorId (userId), title, order
  status (ACTIVE | COMPLETED | ARCHIVED)
  memorySummary (text?) ← resumo acumulado (ADR 002)
  entities (JSON?)      ← ledger durável de NPCs/locais/objetos (US-75). FORA do EventLog:
                          a sumarização nunca o comprime nem apaga
  createdAt, completedAt

AdventureParticipant    ← N:M personagem ↔ aventura (ex-CharacterSlot; multiplayer-ready)
  id, adventureId, characterId
  joinedAt

Quest
  id, adventureId, title, description
  isPrimary (bool)      ← a missão principal; móvel (o mestre reaponta)
  status (OPEN | COMPLETED | FAILED)
  completedAt
  (escrita só na criação da aventura; lida a cada turno para o prompt.
   Nada a AVANÇA hoje — não há rota nem tool de quest)

EventLog                ← append-only; base da memória de longo prazo
  id, adventureId, characterId (nullable)
  type (ACTION | NARRATION | DICE_ROLL | QUEST_UPDATE | CHARACTER_UPDATE)
  payload (JSON)
  summarized (bool)     ← fronteira da janela de memória (ADR 002)
  createdAt
```

**Não existe no banco:** o modelo `Book` (upload de livro, Fase 3) já foi desenhado aqui como
se estivesse no schema. Nunca entrou — nem tabela, nem migração. Saiu em 29/07/2026: o
desenho volta quando a fase chegar, com a US que o criar.

---

## Índices e constraints principais

No schema (`@@unique` / `@@index`):

```sql
-- Um personagem entra uma vez por aventura (join multiplayer-ready)
UNIQUE (adventure_id, character_id) ON adventure_participant

-- Um estado por personagem por aventura — é a chave do upsert de todas as tools
UNIQUE (character_id, adventure_id) ON character_state

-- Email de utilizador
UNIQUE (email) ON "User"

-- A leitura quente do turno: histórico da aventura filtrado por tipo e por
-- fronteira de sumarização
INDEX (adventure_id, character_id, type, summarized) ON event_log
```

Invariantes que o banco **não** garante — vivem na aplicação, e só valem enquanto o código
as respeitar:

- Só entra na aventura quem é do mesmo sistema (`character.systemId == adventure.systemId`).
- No máximo uma quest primária por aventura. Hoje isso se sustenta porque só a criação da
  aventura escreve `Quest`, com uma única `isPrimary: true` — não há código que promova outra.
- `EventLog` é append-only **no caminho do turno**: o `payload` nunca é reescrito, e o único
  campo mutado é a flag `summarized` (pela sumarização). Duas exceções deliberadas, as duas
  apagando linha inteira, nunca editando: a reexecução de turno da US-67 apaga o rastro do
  último turno antes de refazê-lo ([`ai.service.ts:207`](../../../apps/api/src/ai/ai.service.ts)),
  e apagar o personagem (US-30) apaga os dependentes em transação
  ([`character.service.ts:155`](../../../apps/api/src/character/character.service.ts)).

---

## Notas de design

- **Hierarquia pós-D2 (implementada):** `Campaign` e `CharacterSlot` não existem mais; a `Adventure`
  é a história, pertence a um `System` e liga personagens via `AdventureParticipant`.
- **`System.config` (ADR 003, D1 — implementado):** guarda os atributos (nomes, min/max, default) e os
  kits iniciais do sistema. Integrar um sistema novo = inserir um `System` + `config`, sem tocar em
  controller/serviço. `Character.systemId` é conhecido na criação e valida `baseAttributes` contra o
  `config` do sistema escolhido.
- `EventLog` serve como fonte para a sumarização de memória ([ADR 002](../../adr/002-memoria-de-sessao.md)).
  Nunca reescrever `payload`; só a flag `summarized` é mutada (exceções de deleção acima).
- `CharacterState` é o estado "ao vivo" do personagem na aventura ativa. O estado ao fim de cada aventura
  é preservado antes da criação da próxima; a continuidade entre aventuras mora no personagem.
- `memorySummary` em `Adventure` é o resumo acumulado da própria aventura ([ADR 002](../../adr/002-memoria-de-sessao.md)).
  No MVP (Fase 1), pode ser nulo.
- `System` para Free e D&D 5e SRD vem do seed (`apps/api/prisma/seed.ts`), não de upload. O
  seed é **manual** (`pnpm db:seed`): o deploy do Render roda `migrate deploy`, não o seed
  ([`render.yaml`](../../../render.yaml)) — banco novo sem seed sobe com a tabela `System` vazia.
- **Nem todo campo `JSON` tem tipo TypeScript.** Têm, em `packages/shared/src/types/`:
  `CharacterState.inventory` (`InventoryItem[]`), `CharacterState.sceneState` (`SceneState`),
  `Adventure.entities` (`WorldEntity[]`) e `System.config` (`SystemConfigSchema`, Zod).
  **Não têm** — são lidos como `Json` cru e moldados no ponto de uso: `attributes`,
  `baseAttributes`, `conditions`, `skills`, `features`, `spells` e `background`. Antes de
  escrever "todos têm", confira: a afirmação já esteve aqui e era falsa.
