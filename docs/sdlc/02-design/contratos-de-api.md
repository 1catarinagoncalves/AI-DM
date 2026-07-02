# Contratos de API — AI Dungeon Master

**Atualizado em:** 2026-07-01

> ⚠️ **Reflete a ADR 003 (planejada).** As rotas de sistema/personagem/aventura abaixo já assumem a
> hierarquia decidida na [ADR 003](../../adr/003-sistemas-como-dado.md): sistema como dado
> ([US-21](../01-requisitos/US-21-sistemas-como-dado.md)) e fusão campanha+aventura
> ([US-22](../01-requisitos/US-22-fusao-campanha-aventura.md)). O código atual ainda expõe
> `/campaigns` e `/campaigns/:id/adventures` — ver seção *Rotas atuais (legado)* no fim.

---

## Convenções

- REST para operações CRUD (sistemas, personagens, aventuras)
- **POST /api/v1/ai/chat** — endpoint de streaming para o DM Agent (Vercel AI SDK)
- WebSocket (Socket.IO) para eventos de sala multiplayer (Fase 4)
- Autenticação: JWT Bearer token em todos os endpoints
- Prefixo de versão: `/api/v1/`

---

## Endpoints principais (Fase 1 — MVP)

### Sistemas

```
GET    /api/v1/systems              — listar sistemas disponíveis (Free, D&D 5e SRD, ...)
GET    /api/v1/systems/:id          — detalhes + config (atributos, kits) do sistema
```

### Personagens

```
POST   /api/v1/characters           — criar personagem (body inclui systemId; atributos
                                       validados contra System.config.attributes)
GET    /api/v1/characters           — listar personagens do usuário
GET    /api/v1/characters/:id       — buscar personagem
GET    /api/v1/characters/:id/state — estado atual do personagem numa aventura
```

### Aventuras e missões

Aventura = a história (campanha e aventura fundidas, ADR 003 D2). Criada sob o personagem, que é
adicionado como participante; herda `systemId` do personagem.

```
POST   /api/v1/characters/:id/adventures  — criar aventura e ligar o personagem (participante)
GET    /api/v1/characters/:id/adventures  — listar aventuras do personagem (em ordem)
GET    /api/v1/adventures/:id             — detalhes da aventura
GET    /api/v1/adventures/:id/turns       — histórico de turnos (EventLog: ACTION/NARRATION)
GET    /api/v1/adventures/:id/quests      — missões da aventura (a primária tem isPrimary)
GET    /api/v1/adventures/:id/log         — EventLog completo
```

### DM Agent (streaming)

```
POST   /api/v1/ai/chat
Body: {
  adventureId: string
  characterId: string
  message: string        — ação do jogador em linguagem natural
}
Response: text/event-stream (Vercel AI SDK format)
```

---

## Tools do DM Agent (contratos internos)

Definidas em `packages/ai-engine/src/tools/`. Chamadas pelo LLM via tool calling;
executadas no Game Server.

```typescript
rollDice(formula: string): DiceResult
// Exemplo: rollDice("2d6+3") → { formula, rolls: [4,2], modifier: 3, total: 9 }

getRule(query: string, systemId: string): RuleResult
// Busca RAG no índice do sistema ativo

updateCharacterSheet(characterId: string, patch: CharacterStatePatch): void
// Atualiza HP, inventário, condições, etc.

advanceQuest(questId: string, status: 'completed' | 'failed'): void

recallMemory(characterId: string, query: string): MemoryResult
// RAG no EventLog resumido de aventuras anteriores (Fase 2)

getCharacterState(characterId: string): CharacterState

addEventLog(adventureId: string, entry: EventLogEntry): void
```

---

## Eventos WebSocket (Fase 4 — Multiplayer)

```
// Servidor → Clientes da sala
dm:narration          { chunk: string, done: boolean }
game:state_update     { characterId, patch: CharacterStatePatch }
game:dice_roll        { characterId, result: DiceResult }
game:quest_update     { questId, status }
player:joined         { characterId, playerName }
player:left           { characterId }

// Cliente → Servidor
player:action         { characterId, message: string }
```

---

## Rotas atuais (legado — antes da ADR 003)

O código em `apps/api` ainda expõe a hierarquia antiga (campanha separada da aventura). Estas rotas
serão substituídas pelas de cima ao implementar [US-21](../01-requisitos/US-21-sistemas-como-dado.md) e
[US-22](../01-requisitos/US-22-fusao-campanha-aventura.md):

```
GET    /api/v1/campaigns/systems        — listar sistemas        → vira /systems
POST   /api/v1/campaigns                — criar campanha         → removido (fundido na aventura)
POST   /api/v1/campaigns/:id/join       — entrar com personagem  → vira AdventureParticipant
POST   /api/v1/campaigns/:id/adventures — criar aventura         → vira /characters/:id/adventures
POST   /api/v1/characters               — criar personagem (sem systemId; 6 atributos fixos de D&D)
```
