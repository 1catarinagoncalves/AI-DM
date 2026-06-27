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
packages/
  ai-engine/    # DM Agent: Vercel AI SDK + tools + prompts
  shared/       # Tipos TypeScript compartilhados (contrato client-server)
docs/
  prd.md
  adr/
  sdlc/         # Artefatos por fase do SDLC
evals/          # Suite de avaliação do DM Agent
prisma/         # Schema e migrações do banco
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
pnpm lint                 # ESLint + Prettier check
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
  - `chore(deps): update @ai-sdk/anthropic`

## Contexto de fase atual

Fase 1 — MVP single-player. Foco em:
- DM Agent funcional com tool calling básico
- Ficha de personagem persistida no banco
- Dados rolados deterministicamente no Game Server
- Narração em streaming via Vercel AI SDK
- Sistema D&D 5e via SRD (sem upload de livro ainda)
