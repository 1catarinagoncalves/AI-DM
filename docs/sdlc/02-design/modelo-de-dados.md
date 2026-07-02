# Modelo de Dados — AI Dungeon Master

**Atualizado em:** 2026-07-02

> D1 e D2 da [ADR 003 — Sistemas como dado](../../adr/003-sistemas-como-dado.md) estão implementadas
> no `schema.prisma`: `System.config` + `Character.systemId` ([US-21](../01-requisitos/US-21-sistemas-como-dado.md))
> e a fusão `Campaign`+`Adventure` ([US-22](../01-requisitos/US-22-fusao-campanha-aventura.md)). O
> diagrama abaixo reflete o schema atual.

---

## Diagrama de entidades (núcleo)

Hierarquia: **System → Character → Adventure** — o personagem pertence a um sistema, e é o fio de
continuidade entre aventuras seguidas (ficha + memória, [ADR 002](../../adr/002-memoria-de-sessao.md)).

```
User
  id, email, name, createdAt

System                  ← sistema de regras (Free, D&D SRD, customizado via upload)
  id, name, version
  sourceType (free | srd | upload)
  config (JSON)         ← D1: schema de atributos + kits iniciais (validado por Zod em shared)
  ragIndexId            ← referência ao índice no vector store

Character               ← pertence a UM sistema (systemId conhecido na criação)
  id, userId, systemId, name, race, class, level
  baseAttributes (JSON) ← validado contra System.config.attributes
  createdAt

CharacterState          ← estado vivo do personagem em uma aventura
  id, characterId, adventureId
  hp, maxHp
  attributes (JSON)     ← pode evoluir com level-up
  inventory (JSON)
  conditions (JSON)     ← envenenado, incapacitado, etc.
  sceneState (JSON)     ← continuidade espacial (ADR 002 / US-11b)
  updatedAt

Adventure               ← a história (campanha e aventura FUNDIDAS; 1 missão principal)
  id, systemId, creatorId (userId), title, order
  status (active | completed | archived)
  memorySummary (text)  ← resumo acumulado (ADR 002)
  createdAt, completedAt

AdventureParticipant    ← N:M personagem ↔ aventura (ex-CharacterSlot; multiplayer-ready)
  id, adventureId, characterId
  joinedAt

Quest
  id, adventureId, title, description
  isPrimary (bool)      ← a missão principal; móvel (o mestre reaponta)
  status (open | completed | failed)
  completedAt

EventLog                ← append-only; base da memória de longo prazo
  id, adventureId, characterId (nullable)
  type (action | narration | dice_roll | quest_update | character_update)
  payload (JSON)
  summarized (bool)     ← fronteira da janela de memória (ADR 002)
  createdAt

Book                    ← livro upado pelo usuário (Fase 3)
  id, userId, adventureId (nullable)
  filename, storagePath
  status (processing | ready | failed)
  systemId (nullable)   ← populado após ingestão
  uploadedAt
```

---

## Índices e constraints principais

```sql
-- Um personagem entra uma vez por aventura (join multiplayer-ready)
UNIQUE (adventure_id, character_id) ON adventure_participant

-- Só entra na aventura quem é do mesmo sistema
-- (regra de aplicação: character.system_id == adventure.system_id)

-- No máximo uma quest primária por aventura (invariante de aplicação)
-- promover uma quest a isPrimary desmarca as demais da aventura

-- EventLog imutável — sem UPDATE de payload/DELETE; apenas INSERT
-- (a flag `summarized` é o único campo mutado, pela sumarização)

-- CharacterState atualizado por adventure
UNIQUE (character_id, adventure_id) ON character_state
```

---

## Notas de design

- **Hierarquia pós-D2 (implementada):** `Campaign` e `CharacterSlot` não existem mais; a `Adventure`
  é a história, pertence a um `System` e liga personagens via `AdventureParticipant`.
- **`System.config` (ADR 003, D1 — implementado):** guarda os atributos (nomes, min/max, default) e os
  kits iniciais do sistema. Integrar um sistema novo = inserir um `System` + `config`, sem tocar em
  controller/serviço. `Character.systemId` é conhecido na criação e valida `baseAttributes` contra o
  `config` do sistema escolhido.
- `EventLog` é append-only e serve como fonte para a sumarização de memória ([ADR 002](../../adr/002-memoria-de-sessao.md)).
  Nunca deletar ou reescrever payload; só a flag `summarized` é mutada.
- `CharacterState` é o estado "ao vivo" do personagem na aventura ativa. O estado ao fim de cada aventura
  é preservado antes da criação da próxima; a continuidade entre aventuras mora no personagem.
- `memorySummary` em `Adventure` é o resumo acumulado da própria aventura ([ADR 002](../../adr/002-memoria-de-sessao.md)).
  No MVP (Fase 1), pode ser nulo.
- `System` para Free e D&D 5e SRD é seed no banco no deploy; não depende de upload.
- Todos os campos `JSON` têm tipos TypeScript definidos em `packages/shared/src/types/` (incluindo o schema
  Zod de `System.config`).
