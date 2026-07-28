# Convenções de Implementação — AI Dungeon Master

**Atualizado em:** 2026-06-27

---

## Estrutura do monorepo

Fonte única: [CLAUDE.md](../../../CLAUDE.md) → *Estrutura do repositório*, e o diagrama de
componentes do [README.md](../../../README.md) → *Arquitetura*.

<!-- A árvore que ficava aqui era a 3ª cópia da mesma estrutura e afirmava
     `prisma/` na raiz (o real é apps/api/prisma). Deletada na US-86: estrutura
     duplicada em N arquivos dessincroniza em N-1 deles. -->

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

Inventário vivo: [packages/ai-engine/src](../../../packages/ai-engine/src).

<!-- A árvore que ficava aqui desenhava `src/tools/` com 7 arquivos. A pasta foi
     apagada na US-83 (só tinha código morto) e 0 dos 7 arquivos jamais
     existiram: as 5 tools "futuras" saíram de um comentário `// Future tools`
     que três documentos transcreveram como se fosse inventário. Deletada na
     US-86 em vez de corrigida — árvore transcrita reafirma o filesystem e
     apodrece sozinha. -->

> **Onde as tools vivem hoje:** inline em
> [apps/api/src/ai/ai.service.ts](../../../apps/api/src/ai/ai.service.ts), não neste pacote.
> Elas fecham sobre o `PrismaService` do NestJS, e o `packages/ai-engine` não tem DI.

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
GROQ_API_KEY=
OPENROUTER_API_KEY=

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
