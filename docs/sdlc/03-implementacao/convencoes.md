# Convenções de Implementação — AI Dungeon Master

**Atualizado em:** 2026-06-27

---

## Estrutura do monorepo

```
apps/
  web/                  # Next.js 15 App Router
  api/                  # NestJS Game Server
packages/
  ai-engine/            # DM Agent (Vercel AI SDK + tools + prompts)
  shared/               # Tipos TypeScript compartilhados
prisma/
  schema.prisma
  migrations/
evals/                  # Suite de avaliação do DM Agent
docs/
```

---

## TypeScript

- `strict: true` em todos os `tsconfig.json`
- Sem `any` explícito; use `unknown` e narrowing
- Tipos de domínio definidos em `packages/shared/src/types/`
- Importações absolutas configuradas via `paths` no `tsconfig`

---

## Módulos NestJS (apps/api)

Cada módulo é responsável por um domínio e contém:
- `*.module.ts` — declaração do módulo
- `*.controller.ts` — endpoints REST
- `*.service.ts` — lógica de negócio
- `*.repository.ts` — acesso ao banco via Prisma

Módulos principais: `game`, `campaign`, `character`, `adventure`, `ai`, `ingestion`

---

## AI Engine (packages/ai-engine)

### Estrutura de arquivos

```
src/
  tools/
    roll-dice.ts        — uma tool por arquivo
    get-rule.ts
    update-character-sheet.ts
    advance-quest.ts
    recall-memory.ts
    get-character-state.ts
    add-event-log.ts
    index.ts            — exporta todas as tools
  prompts/
    dm-system.ts        — system prompt do DM Agent
    memory-summarizer.ts — prompt para geração de resumo de aventura
  agent.ts              — loop principal do DM Agent
  context-builder.ts    — monta o contexto (estado + RAG) para cada turno
```

### Regra de tools

Toda tool deve ter:
1. Schema Zod para validação de input
2. Tipo de retorno TypeScript explícito
3. Handler que chama o Game Server (nunca acessa o banco diretamente)

---

## Banco de dados

- ORM: Prisma com migrations versionadas
- Nunca use SQL raw sem comentário justificando
- Migrations são imutáveis após aplicadas em produção
- Seeds em `prisma/seed.ts` (inclui System D&D 5e SRD)

---

## Rolagem de dados

- Implementada em `apps/api/src/game/dice.service.ts`
- Usa `crypto.getRandomValues` (RNG criptográfico)
- Toda rolagem é registrada no EventLog com seed para auditoria
- Fórmula suportada: `XdY+Z` (ex: `2d6+3`, `1d20`, `4d6`)

---

## Variáveis de ambiente

```
# apps/api
DATABASE_URL=
REDIS_URL=
S3_BUCKET=
S3_ENDPOINT=
ANTHROPIC_API_KEY=

# apps/web
NEXT_PUBLIC_API_URL=
NEXT_PUBLIC_WS_URL=
```

Nunca commitar `.env`. O arquivo `.env.example` é a referência de variáveis necessárias.

---

## Commits e PRs

- Conventional Commits obrigatório: `feat:`, `fix:`, `chore:`, `test:`, `docs:`
- PRs que tocam o AI Engine requerem que `pnpm eval` passe
- PRs que alteram o schema Prisma requerem migration incluída
- Descrição do PR deve referenciar o user story (ex: "Implementa US-08")
