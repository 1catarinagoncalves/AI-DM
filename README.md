# AI Dungeon Master (AI DM)

Mestre de RPG narrativo movido a IA. O agente atua como narrador, árbitro de regras e
memória da campanha — jogue sozinho ou em grupo, com D&D (via SRD) ou qualquer sistema
via upload de livro.

Regra de ouro do projeto: **o estado de jogo nunca vive no LLM.** Ficha, inventário,
missões e rolagem de dados são autoritativos no Game Server. O LLM só narra; toda
alteração de estado passa por uma tool.

> **Fase atual:** Fase 1 — MVP single-player (D&D 5e SRD, ficha persistida, dados em
> código, narração em streaming via tool calling).

## Stack

- **Frontend** (`apps/web`) — Next.js 15 App Router, React, Tailwind + shadcn/ui, Zustand
- **Backend** (`apps/api`) — NestJS, Prisma sobre PostgreSQL (+ pgvector), Redis, BullMQ, Socket.IO
- **AI Engine** (`packages/ai-engine`) — Vercel AI SDK; provedores Groq e OpenRouter
- **Shared** (`packages/shared`) — tipos TypeScript do contrato client-server
- **Monorepo** — pnpm workspaces, TypeScript 5.x strict, ESLint + Prettier

## Estrutura

```
apps/
  web/          # Next.js (frontend)
  api/          # NestJS (Game Server + REST + WebSocket)
packages/
  ai-engine/    # DM Agent: AI SDK + tools + prompts
  shared/       # Tipos compartilhados
docs/           # PRD, ADRs, artefatos do SDLC
evals/          # Suite de avaliação do DM Agent
prisma/         # Schema e migrações
```

## Começando

```bash
pnpm install        # instalar dependências
pnpm db:migrate     # aplicar migrações Prisma
pnpm dev            # rodar web + api em modo dev
```

Configure as variáveis de ambiente antes (chaves de provedor, `DATABASE_URL`, Redis, S3).
Nunca commite segredos — tudo via env.

## Comandos

| Comando | O que faz |
|---------|-----------|
| `pnpm dev` | Roda `web` e `api` em paralelo |
| `pnpm build` | Build de produção (packages → apps) |
| `pnpm test` | Testes unitários e de integração |
| `pnpm eval` | Suite de evals do DM Agent |
| `pnpm lint` | ESLint + Prettier |
| `pnpm db:migrate` / `db:studio` / `db:seed` | Prisma |

## Tools do DM Agent

| Tool | Responsável | Descrição |
|------|-------------|-----------|
| `rollDice` | Game Server | Rola dados (ex: `2d6+3`), determinístico via RNG no servidor |
| `getRule` | AI Engine / RAG | Recupera regra do sistema ativo |
| `updateCharacterSheet` | Game Server | Atualiza HP, status, inventário, atributos |
| `advanceQuest` | Game Server | Avança missão / marca objetivo |
| `recallMemory` | AI Engine / RAG | Recupera memória de aventuras anteriores |
| `getCharacterState` | Game Server | Lê estado do personagem (somente leitura) |
| `addEventLog` | Game Server | Registra evento no EventLog |

## Desenvolvimento

1. Leia o user story em `docs/sdlc/01-requisitos/` e os critérios de aceite.
2. Escreva o eval/teste antes do código de produção (TDD).
3. Ao mexer no DM Agent ou em qualquer tool, rode `pnpm eval` e confirme que passa.
4. Mudança de schema → migração Prisma versionada (nunca edite migrações existentes).
5. Commits em Conventional Commits (`feat:`, `fix:`, `chore:`…).

Regras completas em [`AGENTS.md`](AGENTS.md) e [`CLAUDE.md`](CLAUDE.md). PRD em
[`docs/prd.md`](docs/prd.md).

## Roadmap

1. **MVP single-player** ← atual
2. Memória entre aventuras (EventLog + RAG)
3. Upload de livros (worker de ingestão)
4. Multiplayer (WebSocket, até 10 personagens)
5. Multiverso (duplicação de personagem)
6. Provider oficial D&D
