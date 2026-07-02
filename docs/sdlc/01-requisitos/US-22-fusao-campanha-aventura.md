# US-22 — Fusão de campanha e aventura numa entidade só

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player (estrutural)
**Status:** 📋 Planejada (não iniciada)
**Depende de:** [US-21](./US-21-sistemas-como-dado.md) — o personagem já precisa carregar `systemId`
**Criada em:** 2026-07-01
**Relacionado:** [ADR 003 — Sistemas como dado](../../adr/003-sistemas-como-dado.md) (decisão D2)

---

## História

> **Como** desenvolvedora,
> **quero** que "campanha" e "aventura" sejam uma única entidade (a história com uma missão principal), com o personagem como fio de continuidade,
> **para que** o modelo de dados reflita o domínio real e some a entidade-casca que só duplicava o sistema.

---

## Contexto e motivação

### O problema observado

O schema carrega **duas entidades** — `Campaign` e `Adventure` — para o que o produto enxerga como **um conceito só**: a história com uma missão principal. A `Campaign` só faz três coisas: segurar `systemId`, dar um nome, e agrupar `Adventure`s ordenadas via `CharacterSlot`. Toda a substância (missão, memória, estado, eventos) já vive na `Adventure`. Resultado: mais joins, `systemId` em lugar ambíguo, e um vocabulário ("campanha" vs "aventura") que confunde.

### Por que a solução atual não basta

Enquanto `Campaign` existir separada, o `systemId` fica nela (não no personagem), e a criação de personagem não sabe o sistema (ver [US-21](./US-21-sistemas-como-dado.md)). E o `ai.service` precisa navegar `adventure.campaign.system` para algo que deveria vir direto do personagem/aventura.

### A proposta

Fundir `Campaign` em `Adventure`. A aventura passa a ser a história (título, missão principal, memória, estado, eventos), pertencente a um `System`, com os personagens ligados por um join. A continuidade entre aventuras seguidas mora no **personagem** (ficha + memória, [ADR 002](../../adr/002-memoria-de-sessao.md)), não num agrupador acima dele. Ver [ADR 003](../../adr/003-sistemas-como-dado.md), decisão D2.

---

## Escopo

### Dentro do escopo

- Fundir `Campaign` + `Adventure` numa entidade só (**mantém o nome `Adventure`**; `Campaign` é removida).
- `Adventure.systemId` (a história pertence a um sistema).
- **Join mantido** `AdventureParticipant` (personagem ↔ aventura), substituindo `CharacterSlot` — pronto para multiplayer (vários personagens por aventura na Fase 4).
- Invariante: um personagem só entra numa aventura do **mesmo sistema** (`Character.systemId == Adventure.systemId`).
- Missão principal via `Quest.isPrimary` — **móvel**: o mestre pode reapontar qual quest é a principal conforme a história avança.
- Remoção de `Campaign` e `CharacterSlot`; **migração por reseed destrutivo** (ambiente de dev, sem dados de produção).
- Reescrita dos pontos acoplados: `ai.service` (`adventure.campaign.system` → `adventure.system`), rotas, setup, `api.ts`.

### Fora do escopo

- `System.config` e validação dinâmica de atributos — é a [US-21](./US-21-sistemas-como-dado.md) (D1), pré-requisito desta.
- **Ferramenta/tool para o mestre criar e reapontar quests** — pertence à gestão de missões ([US-07](./user-stories.md)). Aqui entra só o campo `isPrimary` e a invariante; quem o alterna é a US-07.
- Multiplayer de fato (salas, limite, turnos) — Fase 4 (US-14/15/16). O join já fica pronto, mas o MVP usa um participante por aventura.
- Persistência da memória entre aventuras (snapshot) — inalterada; já coberta por [ADR 002](../../adr/002-memoria-de-sessao.md).

---

## Modelo de dados proposto

Hierarquia-alvo:

```
User 1─* Character ── systemId            (personagem pertence a um sistema; US-21)
                   └─* AdventureParticipant *─1 Adventure ── systemId
                                                    ├─* Quest (uma com isPrimary)
                                                    ├─* CharacterState (por personagem×aventura)
                                                    └─* EventLog
```

**`Adventure` (fundida):**

| Campo | Origem | Descrição |
|---|---|---|
| `systemId` | novo (era `Campaign.systemId`) | Sistema da história; join exige participante do mesmo sistema. |
| `title` | `Adventure.title` (+ absorve `Campaign.name`) | Nome único da história. |
| `order` | `Adventure.order` | Agora sequência das aventuras **do personagem**. |
| `status`, `memorySummary` | inalterados | — |
| `creatorId` | novo (era `Campaign.creatorId`) | Usuário dono da aventura (útil no multiplayer). |

**`AdventureParticipant` (novo, ex-`CharacterSlot`):** `adventureId`, `characterId`, `joinedAt`, `UNIQUE(adventureId, characterId)`.

**`Quest`:** ganha `isPrimary Boolean @default(false)`. Invariante: no máximo uma `isPrimary = true` por aventura.

**Removidos:** `Campaign`, `CharacterSlot`.

**Persistência / migração:** reseed destrutivo — a migração dropa `Campaign`/`CharacterSlot`, cria `AdventureParticipant`, adiciona `Adventure.systemId`/`creatorId` e `Quest.isPrimary`; o seed recria os sistemas e um exemplo. Sem backfill.

---

## Critérios de aceite

- [ ] `Campaign` e `CharacterSlot` não existem mais no schema; `Adventure` carrega `systemId` e `creatorId`.
- [ ] Existe `AdventureParticipant` ligando personagem↔aventura, com `UNIQUE(adventureId, characterId)`.
- [ ] Entrar numa aventura exige `Character.systemId == Adventure.systemId`; tentativa com sistema diferente é rejeitada com erro claro.
- [ ] `Quest` tem `isPrimary`; no máximo uma quest primária por aventura; marcar outra como primária desmarca a anterior.
- [ ] A missão principal (quest `isPrimary`) é reinjetada no system prompt como "missão principal", distinta das quests secundárias.
- [ ] `ai.service` obtém o sistema via `adventure.system` (não `adventure.campaign.system`); o `include` da query é ajustado.
- [ ] O setup segue *sistema → personagem → aventura*, sem passo de "criar campanha"; cria a aventura e adiciona o personagem como participante.
- [ ] `api.ts` não tem mais `createCampaign`/`joinCampaign`; criar aventura passa por `/characters/:id/adventures` (ou equivalente) que cria a aventura e liga o personagem.
- [ ] **Eval / teste de regressão:** um turno completo (ação → narração → rolagem → atualização de estado) funciona numa aventura criada pelo novo fluxo, sem nenhuma referência a `Campaign` no caminho.
- [ ] **Docs:** após a implementação, atualizar [`modelo-de-dados.md`](../02-design/modelo-de-dados.md) e [`contratos-de-api.md`](../02-design/contratos-de-api.md) removendo o aviso de "alvo/planejado" e a seção *Rotas atuais (legado)* referentes a D2 (fusão, `AdventureParticipant`, `Quest.isPrimary`), passando o alvo a estado atual.

---

## Notas de implementação

- **Ordem segura:** landar a [US-21](./US-21-sistemas-como-dado.md) antes (personagem já com `systemId`), depois esta fusão.
- `ai.service.ts:87` e o `findUnique` da aventura (`include: { campaign: { include: { system: true } } }`) passam a `include: { system: true }` direto na aventura.
- Rota sugerida: `POST /characters/:id/adventures` cria a aventura (com `systemId = character.systemId`) e insere o `AdventureParticipant` numa transação — cobre o caso single-player em uma chamada.
- `SetupWizard`: remover o passo "campanha"; o passo de sistema (ver [US-20](./US-20-catalogo-de-sistemas-via-api.md)) precede o de personagem.
- `Quest.isPrimary`: garantir a invariante "no máximo uma primária" em transação ao promover uma quest (desmarca as demais da aventura).
- `buildDmSystemPrompt` ganha um parâmetro `mainQuest` separado de `activeQuests`.

## Pontos de acoplamento a reescrever (checklist)

- `apps/api/prisma/schema.prisma` — remover `Campaign`/`CharacterSlot`; `Adventure.systemId`/`creatorId`; `AdventureParticipant`; `Quest.isPrimary`.
- `apps/api/src/campaign/*` — dissolver `campaign.controller/service/module`; realocar `createAdventure`/`join`/`listSystems`.
- `apps/api/src/ai/ai.service.ts` — leitura do sistema e das quests (primária vs secundárias).
- `apps/web/src/components/setup/SetupWizard.tsx` — remover passo de campanha.
- `apps/web/src/lib/api.ts` — remover `createCampaign`/`joinCampaign`; ajustar `createAdventure`.
- `apps/web/src/lib/session.ts` / `play/[adventureId]/page.tsx` — conferir se guardam `campaignId`.

---

## Questões em aberto

1. `listSystems` mora hoje em `CampaignController`. Com a fusão, vai para um `SystemController` próprio ou para o de aventura? (Recomendação: `SystemController` — é recurso de sistema, não de aventura.)
2. `Adventure.maxPlayers` (era `Campaign.maxPlayers`) entra já ou só na Fase 4? (Recomendação: só na Fase 4; MVP assume 1 participante.)
3. Manter `Adventure.creatorId` ou derivar o dono do primeiro participante (`participant.character.userId`)? (Recomendação: campo explícito, barato e útil no multiplayer.)

---

## Referências no código

- `apps/api/prisma/schema.prisma` — `Campaign`, `CharacterSlot`, `Adventure`, `Quest`.
- `apps/api/src/campaign/campaign.controller.ts` / `campaign.service.ts` — a dissolver.
- `apps/api/src/ai/ai.service.ts` — `adventure.campaign.system`, quests ativas.
- `apps/web/src/components/setup/SetupWizard.tsx` — fluxo de setup em dois passos.
- `apps/web/src/lib/api.ts` — `createCampaign`/`joinCampaign`/`createAdventure`.
- `docs/adr/003-sistemas-como-dado.md` — decisão D2 que esta story implementa.
