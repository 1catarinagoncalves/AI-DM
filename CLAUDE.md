# AI Dungeon Master — CLAUDE.md
# Regras específicas para Claude Code neste projeto

## O que é este projeto

AI DM é um mestre de RPG narrativo movido a IA, full-stack TypeScript.
Leia `AGENTS.md` para as regras completas do projeto antes de começar qualquer tarefa.

## Estrutura do repositório

```
apps/
  web/          # Next.js 15 App Router (frontend)
  api/          # NestJS (Game Server + REST + WebSocket)
    prisma/     # Schema, migrações e seed do banco
packages/
  ai-engine/    # DM Agent: Vercel AI SDK + tools + prompts
  shared/       # Tipos TypeScript compartilhados (contrato client-server)
docs/
  prd.md
  adr/
  sdlc/         # Artefatos por fase do SDLC
evals/          # Suite de avaliação do DM Agent
```

## Comandos principais

```bash
pnpm install              # instalar dependências
pnpm dev                  # rodar todos os apps em modo dev
pnpm build                # build de produção
pnpm test                 # rodar testes unitários e de integração
pnpm eval                 # rodar suite de evals do DM Agent
pnpm db:migrate           # aplicar migrações Prisma
pnpm db:studio            # abrir Prisma Studio
pnpm typecheck            # tsc --noEmit (não há lint: ver AGENTS.md)
pnpm docs:links           # links quebrados em docs/ + .md da raiz (--list, --only-md, --naive, --fix)
```

## Regras de trabalho para o Claude Code

- Sempre leia o user story e critérios de aceite antes de implementar uma feature.
- Escreva os testes antes do código de produção (TDD).
- Ao modificar o DM Agent ou qualquer tool, rode `pnpm eval` e confirme que passa.
- Nunca use `any` sem um comentário explicando por quê é necessário.
- Prefira editar arquivos existentes a criar novos.
- Não adicione dependências sem verificar se já existe algo equivalente no projeto.
- Commits seguem Conventional Commits. Exemplos:
  - `feat(ai-engine): add rollDice tool`
  - `fix(game): correct HP calculation on damage`
  - `chore(deps): update @ai-sdk/groq`
- Antes de escrever "coloque em `.env`" numa spec/US, **verifique no código** como aquele env var é lido (`grep process.env`, checar ConfigModule/dotenv/wrapper). Não assuma auto-load.

## Padrões de código

Regras completas em `AGENTS.md` → "Padrões de código" (estilo, comentários, testes,
dependências, estrutura, formatação, logging). Leia antes de escrever código.

Os que mais pegam neste repo:
- Função 4–20 linhas; arquivo abaixo de 500. Passou disso, divida por responsabilidade.
- Nomes que retornem menos de 5 hits no grep. Nada de `data`, `handler`, `Manager`.
- Early return; máximo 2 níveis de indentação.
- **Não apague comentários existentes** em refactor. Comentário diz o PORQUÊ, com número
  de US/SHA quando a linha existe por causa de um bug.
- Mensagem de exceção inclui o valor ofensor e o formato esperado.
- Toda função nova ganha teste; todo bug fix ganha teste de regressão. I/O externo mockado
  com fake class nomeada, não stub inline.
- Sem formatter no projeto: siga o estilo do arquivo vizinho, não reformate código alheio.

## Env em dev (IMPORTANTE)

A API (`apps/api`) **não** tem `ConfigModule` nem `dotenv`: `nest start` não carrega
`.env` sozinho. Em dev, os env vars vêm do **`.env` da RAIZ do repo**, carregado pelo
wrapper `dotenv -e .env` no script `dev` (mesmo padrão dos scripts `db:*`).

- **Secrets de runtime da API** (`DATABASE_URL`, `AUTH_SECRET`, etc.) vão no `.env` da raiz.
- `apps/api/.env` **não é lido** — não use.
- `apps/web/.env.local` é lido nativo pelo Next (frontend).
- Os `.env` são gitignored e negados ao Claude Code — configuração de secrets é manual.

## Contexto de fase atual

Fase 1 — MVP single-player. Foco em:
- DM Agent funcional com tool calling básico
- Ficha de personagem persistida no banco
- Dados rolados deterministicamente no Game Server
- Narração em streaming via Vercel AI SDK
- Sistema D&D 5e via SRD (sem upload de livro ainda)
