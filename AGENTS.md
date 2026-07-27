# AI Dungeon Master — AGENTS.md
# Harness: configuração e regras para todos os agentes de IA

## Contexto do projeto

AI DM é um mestre de RPG narrativo movido a IA. Jogadores podem jogar sozinhos ou em grupo
(até 10 personagens por campanha) com qualquer sistema de RPG — D&D (via SRD) ou qualquer
outro sistema via upload de livro. O agente de IA atua como narrador, árbitro de regras e
memória da campanha.

Stack: Next.js (App Router) + React + TypeScript no frontend; Node.js (NestJS) + TypeScript
no backend; PostgreSQL + pgvector; Redis; S3-compatível; Vercel AI SDK sobre Groq e OpenRouter.

Roadmap incremental (fase atual: MVP single-player):
1. MVP single-player — SRD aberto, ficha, dados em código, narração via LLM + tool calling
2. Memória entre aventuras — EventLog + sumarização + RAG
3. Upload de livros — worker de ingestão + RAG por campanha
4. Multiplayer — WebSocket, limite de 10, turnos e iniciativa
5. Multiverso — duplicação de personagem, históricos paralelos
6. Provider oficial D&D e refinamento de regras por sistema

---

## Regras absolutas (nunca violar)

- **Estado de jogo nunca vive no LLM.** Ficha de personagem, missões, inventário e resultado
  de dados são persistidos no banco pelo Game Server. O LLM recebe o estado como contexto
  de leitura, nunca como fonte de verdade.
- **Rolagem de dados é determinística, feita em código** (RNG criptográfico no Game Server),
  nunca delegada ao LLM. Use a tool `rollDice` para toda rolagem.
- **Nunca exponha texto bruto de livros upados** para outros usuários. O índice RAG de um
  livro é isolado por campanha/usuário.
- **Toda ação do LLM que altera estado passa pela tool correspondente** (`updateCharacterSheet`,
  `advanceQuest`, `rollDice`, etc.). O LLM só narra; o Game Server decide e persiste.
- **Typescript estrito em todo o codebase.** Sem `any` explícito sem justificativa em comentário.
- **Sem segredos no código.** Chaves, tokens e senhas via variáveis de ambiente; nunca
  hardcoded, nunca commitados.

---

## Stack e convenções

### Geral
- Linguagem: TypeScript 5.x, strict mode
- Gerenciador de pacotes: pnpm (workspace monorepo)
- Análise estática: `pnpm typecheck` (`tsc --noEmit`). **Não há ESLint nem Prettier no projeto** — os scripts existiam desde o scaffold mas nunca tiveram dependência nem config, e foram removidos. Adotar um linter é story própria.
- Commits: Conventional Commits (`feat:`, `fix:`, `chore:`, etc.)

### Frontend (`apps/web`)
- Next.js 15 App Router, React Server Components onde possível
- Tailwind CSS + shadcn/ui para componentes
- Zustand para estado local de UI; estado de jogo vem do servidor via WebSocket
- Streaming de narração token-a-token via `useChat` do Vercel AI SDK

### Backend (`apps/api`)
- NestJS com módulos por domínio: `game`, `campaign`, `character`, `ai`, `ingestion`
- Prisma ORM sobre PostgreSQL; migrações versionadas em `prisma/migrations/`
- BullMQ para filas (ingestão de livros, sumarização de memória)
- Socket.IO para salas de campanha em tempo real

### AI Engine (`packages/ai-engine`)
- Vercel AI SDK (`ai` package) como camada de abstração de provedor
- Provedores: Groq (`@ai-sdk/groq`) para modelos rápidos e baratos; OpenRouter (`@ai-sdk/openai-compatible`) para acesso a modelos variados — roteável por custo/qualidade via Vercel AI SDK
- Tools tipadas em `packages/ai-engine/src/tools/` — uma tool por arquivo
- Prompt do sistema em `packages/ai-engine/src/prompts/dm-system.ts`

### Persistência
- PostgreSQL: dados relacionais + pgvector para embeddings (MVP)
- Redis: sessões ativas, pub/sub de sala, filas leves
- S3: livros upados e artefatos de campanha

---

## Padrões de código

Fonte de verdade destas regras. `CLAUDE.md` aponta para cá — não duplique.

### Estilo
- Funções: 4–20 linhas. Passou disso, divida.
- Arquivos: abaixo de 500 linhas. Divida por responsabilidade.
- Uma coisa por função, uma responsabilidade por módulo (SRP).
- Nomes específicos e únicos. Evite `data`, `handler`, `Manager`. Prefira nomes que
  retornem menos de 5 hits no grep do repo.
- Tipos explícitos. Sem `any`, sem `Record<string, unknown>` genérico como desculpa,
  sem função sem tipo. (Exceção já vigente nas Regras absolutas: `any` só com
  comentário justificando.)
- Zero duplicação. Lógica repetida vira função/módulo compartilhado.
- Early return em vez de if aninhado. Máximo 2 níveis de indentação.
- Mensagem de exceção inclui o valor ofensor e o formato esperado.

### Comentários
- Não apague comentários existentes em refactor — eles carregam intenção e proveniência.
- Escreva o PORQUÊ, não o QUÊ. Nada de `// incrementa contador` acima de `i++`.
- Docstring em função pública: intenção + um exemplo de uso.
- Cite número de issue/US ou SHA quando a linha existe por causa de um bug específico
  ou restrição de upstream.

### Testes
- Comando único: `pnpm test` (evals do DM Agent: `pnpm eval`).
- Toda função nova ganha teste. Todo bug fix ganha teste de regressão.
- I/O externo (API, banco, filesystem) é mockado com fake class nomeada, não stub inline.
- F.I.R.S.T: fast, independent, repeatable, self-validating, timely.

### Dependências
- Injete dependências por construtor/parâmetro, não por global/import direto
  (o DI do NestJS já é o caminho no `apps/api`).
- Envolva libs de terceiros atrás de uma interface fina própria do projeto.

### Estrutura
- Siga a convenção do framework (Next.js App Router, módulos NestJS, etc.).
- Módulos pequenos e focados em vez de god files.
- Caminhos previsíveis: `src/`, módulo por domínio, uma tool por arquivo.

### Formatação
- **Não há formatter no projeto** (sem Prettier, sem ESLint — ver "Análise estática"
  acima). Até existir story para adotar um, siga o estilo do arquivo vizinho e não
  reformate código alheio no mesmo diff.

### Logging
- JSON estruturado para debugging/observabilidade.
- Texto plano só para saída de CLI voltada ao humano.

---

## Workflow de desenvolvimento

1. **Antes de implementar:** leia o user story relevante em `docs/sdlc/01-requisitos/`
   e os critérios de aceite correspondentes.
2. **Antes de gerar código:** crie ou atualize os testes/evals primeiro — eles são o
   contrato com o agente.
3. **Ao modificar o DM Agent:** teste contra o eval suite em `evals/` antes de abrir PR.
4. **Ao adicionar uma nova tool:** declare o schema TypeScript em `packages/ai-engine/src/tools/`,
   implemente o handler no Game Server, e adicione ao prompt do sistema.
5. **Ao alterar o schema do banco:** crie uma migração Prisma versionada; nunca edite
   migrações existentes.
6. **Code review:** todo PR que toca o AI Engine precisa de revisão de um humano,
   independentemente de aprovação automatizada.

---

## Tools disponíveis para o DM Agent

| Tool | Responsável | Descrição |
|------|-------------|-----------|
| `rollDice` | Game Server | Rola dados (ex: `2d6+3`); retorna resultado e breakdown |
| `getRule` | AI Engine / RAG | Recupera regra do sistema ativo via RAG |
| `updateCharacterSheet` | Game Server | Atualiza HP, status, inventário, atributos |
| `advanceQuest` | Game Server | Marca objetivo como completo, avança missão |
| `recallMemory` | AI Engine / RAG | Recupera memória de aventuras anteriores do personagem |
| `getCharacterState` | Game Server | Lê estado atual do personagem (somente leitura) |
| `addEventLog` | Game Server | Registra evento no EventLog (alimenta memória futura) |

---

## O que o DM Agent não pode fazer

- Persistir estado diretamente no banco (sempre via tool)
- Gerar números aleatórios para mecânicas de jogo
- Compartilhar conteúdo de livro upado entre campanhas/usuários
- Tomar decisões de deployment ou infraestrutura
- Modificar arquivos de configuração de ambiente

---

## Referências internas

- PRD completo: `docs/prd.md`
- ADR de arquitetura: `docs/adr/001-arquitetura.md`
- User stories: `docs/sdlc/01-requisitos/US-*.md` (um arquivo por story, fonte de verdade; quadro Kanban na US-31)
- Critérios de aceite: `docs/sdlc/01-requisitos/criterios-de-aceite.md`
- Modelo de dados: `docs/sdlc/02-design/modelo-de-dados.md`
- Estratégia de testes: `docs/sdlc/04-testes/estrategia-de-testes.md`
