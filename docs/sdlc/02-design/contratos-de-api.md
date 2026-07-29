# Contratos de API — AI Dungeon Master

**Atualizado em:** 2026-07-29

> **Fonte de verdade é o código, não este arquivo.** A API publica OpenAPI via Swagger em
> `/api/docs` ([`main.ts:16`](../../../apps/api/src/main.ts)) — decorado nos próprios
> controllers. Este documento é o mapa de leitura; divergiu, o controller ganha.
>
> Auditado contra `apps/api/src` em 29/07/2026 (US-89): a lista abaixo é o que existe.

---

## Convenções

- REST para operações CRUD (sistemas, personagens, aventuras)
- **POST /api/v1/ai/chat** — turno do Mestre, resposta em **streaming SSE** (Vercel AI SDK).
  **Não há WebSocket no projeto** — nem dependência de Socket.IO.
- Autenticação: JWT Bearer (`AuthGuard`) nos controllers de personagem, aventura, Mestre e
  `auth`. `GET /systems` e `POST /users` são **públicos** — o primeiro é o alvo do health
  check do Render (US-58).
- Prefixo de versão: `/api/v1/` (`setGlobalPrefix`), Swagger fora dele, em `/api/docs`.

---

## Endpoints (Fase 1 — MVP)

### Sistemas — público

```
GET    /api/v1/systems              — lista os sistemas com a config completa (atributos, kits)
```

### Utilizadores e sessão

```
POST   /api/v1/users                — upsert por email { email, name } (público)
POST   /api/v1/auth/sync            — sincroniza o utilizador do token e reclama órfãos (US-61)
```

### Personagens — dono derivado do token

```
POST   /api/v1/characters           — criar ficha (US-21). `userId` vem do TOKEN, não do corpo
Body: { systemId, name, gender, race, class, attributes: Record<string, number>, skills?: string[] }
                                      attributes validado com Zod dinâmico a partir de
                                      System.config.attributes (chaves fora do config = erro)
GET    /api/v1/characters/mine      — fichas do utilizador autenticado
GET    /api/v1/characters/:id       — ficha completa; de outro dono → 403
DELETE /api/v1/characters/:id       — apaga a ficha e dependentes (US-30); de outro dono → 403
```

### Aventuras

Aventura = a história (campanha e aventura fundidas, ADR 003 D2). Sempre sob o personagem —
não há rota `/adventures/:id` de topo.

```
GET    /api/v1/characters/:characterId/adventures/initial            — gancho inicial resolvido pela classe (US-28)
POST   /api/v1/characters/:characterId/adventures                    — inicia a aventura { initialHookId }
GET    /api/v1/characters/:characterId/adventures/:adventureId/turns — histórico de turnos (jogador/Mestre)
```

### DM Agent (streaming)

```
POST   /api/v1/ai/chat
Body: {
  adventureId: string
  characterId: string
  message: string        — ação do jogador em linguagem natural (1–1000 chars)
  edit?: boolean         — US-67: reexecuta o último turno, limpando o rastro antes
}
Response: text/event-stream (Vercel AI SDK format)
```

---

## Tools do DM Agent (contratos internos)

**Vivem inline** no objeto `tools` de
[`apps/api/src/ai/ai.service.ts`](../../../apps/api/src/ai/ai.service.ts) (`:349`), não num
arquivo por tool: cada uma fecha sobre `this.prisma`/`this.dice` e sobre o contexto do turno.
São 6, e a `description` de cada uma **é prompt** — vai inteira ao modelo todo turno.

```typescript
rollDice({ reason, skill?, ability?, dice? })
// Teste de d20. O modelo diz O QUE está sendo testado; o MODIFICADOR vem sempre da ficha
// ("NEVER pass a modifier of your own"). Um teste ancorado por turno — o 2º reusa o 1º (US-38).

updateCharacterHp({ newHp, reason })
// Clampa em [0, maxHp] e loga CHARACTER_UPDATE.

updateInventory({ changes: [{ name, delta }] })
// delta positivo adiciona, negativo remove. Teto de 9999 itens.

updateScene({ local?, ambiente?, periodo?, presentes?, objetos_em_cena? })
// Estado de cena estruturado (US-03/US-11b): continuidade espacial. Campos omitidos
// preservam o valor anterior; as listas são substituídas inteiras.

recordEntity({ entidades: [{ nome, tipo?, local?, estado?, nota?, sabido?, revelado? }] })
// Ledger durável de NPCs/locais/objetos no Adventure, FORA do EventLog — sobrevive à
// sumarização. Dois eixos independentes (US-75): `sabido` (o mundo) e `revelado` (o jogador).

getSpell({ name })
// Consulta magia conhecida da ficha → { known, level, description }. Awareness apenas:
// não gasta slot, não rola dano/cura (US-42).
```

Ainda **não existem** `getRule`, `advanceQuest`, `recallMemory`, `getCharacterState` nem
`addEventLog` — eram roadmap escrito no presente, apagado em 29/07/2026 junto com os tipos
órfãos que os acompanhavam (`EventLogEntry`, `CharacterStatePatch`) na
[US-89](../01-requisitos/US-89-gate-de-codigo-morto-com-knip.md).

---

## Multiplayer (Fase 4)

Sem contrato. A Fase 1 é single-player e o transporte de hoje é SSE; o desenho de sala —
transporte, formato de evento, autoridade sobre o estado — é decisão da fase, e escrevê-la
aqui antes da hora só criaria mais uma API que não existe.
