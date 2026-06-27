# Contratos de API — AI Dungeon Master

**Atualizado em:** 2026-06-27

---

## Convenções

- REST para operações CRUD (campanhas, personagens, aventuras)
- **POST /api/ai/chat** — endpoint de streaming para o DM Agent (Vercel AI SDK)
- WebSocket (Socket.IO) para eventos de sala multiplayer (Fase 4)
- Autenticação: JWT Bearer token em todos os endpoints
- Prefixo de versão: `/api/v1/`

---

## Endpoints principais (Fase 1 — MVP)

### Personagens

```
POST   /api/v1/characters           — criar personagem
GET    /api/v1/characters           — listar personagens do usuário
GET    /api/v1/characters/:id       — buscar personagem
GET    /api/v1/characters/:id/state — estado atual do personagem na aventura ativa
```

### Campanhas

```
POST   /api/v1/campaigns            — criar campanha
GET    /api/v1/campaigns            — listar campanhas do usuário
GET    /api/v1/campaigns/:id        — detalhes da campanha
POST   /api/v1/campaigns/:id/join   — entrar na campanha com um personagem
```

### Aventuras e missões

```
POST   /api/v1/campaigns/:id/adventures          — iniciar nova aventura
GET    /api/v1/campaigns/:id/adventures          — listar aventuras da campanha
GET    /api/v1/adventures/:id                    — detalhes da aventura
GET    /api/v1/adventures/:id/quests             — missões da aventura
GET    /api/v1/adventures/:id/log                — EventLog (histórico)
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
