# Modelo de Dados — AI Dungeon Master

**Atualizado em:** 2026-06-27

---

## Diagrama de entidades (núcleo)

```
User
  id, email, name, createdAt

Character
  id, userId, name, race, class, level
  baseAttributes (JSON)
  createdAt

CharacterState          ← estado vivo do personagem em uma aventura
  id, characterId, adventureId
  hp, maxHp
  attributes (JSON)     ← pode evoluir com level-up
  inventory (JSON)
  conditions (JSON)     ← envenenado, incapacitado, etc.
  updatedAt

Campaign
  id, creatorId (userId), name, systemId
  maxPlayers (default: 10)
  createdAt

CharacterSlot           ← N:M entre Campaign e Character
  id, campaignId, characterId
  joinedAt

Adventure
  id, campaignId, title, order
  status (active | completed | archived)
  memorySummary (text)  ← resumo gerado ao final da aventura
  createdAt, completedAt

Quest
  id, adventureId, title, description
  status (open | completed | failed)
  completedAt

EventLog                ← append-only; base da memória de longo prazo
  id, adventureId, characterId (nullable)
  type (action | narration | dice_roll | quest_update | character_update)
  payload (JSON)
  createdAt

System                  ← sistema de regras (D&D SRD, customizado via upload)
  id, name, version
  sourceType (srd | upload)
  ragIndexId            ← referência ao índice no vector store

Book                    ← livro upado pelo usuário (Fase 3)
  id, userId, campaignId
  filename, storagePath
  status (processing | ready | failed)
  systemId (nullable)   ← populado após ingestão
  uploadedAt
```

---

## Índices e constraints principais

```sql
-- Um personagem por jogador por campanha
UNIQUE (campaign_id, character_id) ON character_slot

-- EventLog imutável
-- sem UPDATE ou DELETE; apenas INSERT

-- CharacterState atualizado por adventure
UNIQUE (character_id, adventure_id) ON character_state
```

---

## Notas de design

- `EventLog` é append-only e serve como fonte para o worker de sumarização (Fase 2).
  Nunca deletar ou atualizar registros do EventLog.
- `CharacterState` é o estado "ao vivo" do personagem na aventura ativa.
  O estado ao fim de cada aventura é preservado via snapshot antes da criação da próxima.
- `memorySummary` em `Adventure` é gerado pelo worker de sumarização ao final da aventura
  e injetado como contexto no início da próxima. No MVP (Fase 1), pode ser nulo.
- `System` para D&D 5e SRD é seed no banco no deploy; não depende de upload.
- Todos os campos `JSON` terão tipos TypeScript definidos em `packages/shared/src/types/`.
