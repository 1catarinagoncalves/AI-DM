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
- Prisma ORM sobre PostgreSQL; schema, migrações e seed em `apps/api/prisma/`
- BullMQ para filas (ingestão de livros, sumarização de memória)
- Socket.IO para salas de campanha em tempo real
- **`nest start` não carrega `.env`**: a API não tem `ConfigModule` nem dependência `dotenv`,
  lê `process.env` cru. Em dev os secrets vêm do `.env` da **raiz**, via o wrapper
  `dotenv -e .env` do script `dev` (mesmo padrão dos `db:*`). `apps/api/.env` não é lido —
  não use. Antes de escrever "coloque em `.env`" numa spec ou US, confirme no código como
  aquele env var é lido.

### AI Engine (`packages/ai-engine`)
- Vercel AI SDK (`ai` package) como camada de abstração de provedor
- Provedores: Groq (`@ai-sdk/groq`) para modelos rápidos e baratos; OpenRouter (`@ai-sdk/openai-compatible`) para acesso a modelos variados — roteável por custo/qualidade via Vercel AI SDK
- ~~Tools tipadas em `packages/ai-engine/src/tools/` — uma tool por arquivo~~ **Convenção sem
  nenhum caso vigente**: as 6 tools vivas são inline em `apps/api/src/ai/ai.service.ts`, e a pasta
  `tools/` foi apagada em 27/07/2026 por só conter código morto (ver *Tools disponíveis para o
  DM Agent*)
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
- `pnpm eval` é `vitest run --config vitest.eval.config.ts` dentro de `packages/ai-engine`.
  Filtro é **posicional** (`pnpm eval us-36`), não `--filter`, e o gate é um `expect` dentro
  do case — não há flag de CLI para isso.
- **Não importe de `'ai'` dentro de `evals/cases/`.** A resolução falha a partir da raiz
  (`Cannot find package '@ai-sdk/provider-utils'`). Código que chama o SDK vive dentro do
  pacote (ex.: `packages/ai-engine/src/narration-gen.ts`) e o case importa de
  `@ai-dm/ai-engine`.
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

## Armadilhas do repo (falham em silêncio)

Cada item já queimou uma sessão. Nenhum dá erro claro na hora: o comando passa verde e o
comportamento é o antigo.

- **A API roda o `dist/` do ai-engine, não o `src/`.** `@ai-dm/ai-engine` resolve para
  `./dist/index.js`, e o `pnpm dev` da raiz só põe `api` e `web` em watch. Editar
  `packages/ai-engine/src/` sem rebuild deixa a API executando código antigo **sem erro
  nenhum** — já custou um debug inteiro de troca de modelo que "não fazia efeito". Ao mexer
  no pacote: `pnpm --filter ai-engine build` + reiniciar a API, ou deixar
  `pnpm --filter ai-engine dev` (`tsc --watch`) em paralelo.
- **O client do Prisma é gerado e gitignored** em `apps/api/src/generated/prisma`
  (`.gitignore:14`). Depois de clonar ou trocar de branch, rode `prisma generate` antes de
  `build`/`test`. O caminho é acoplado ao `exclude: [..., "prisma", ...]` do
  `apps/api/tsconfig.build.json`: gerar fora de `src/` mantém o build verde e quebra só em
  runtime.
- **Provider do AI SDK é pinado.** O projeto é AI SDK **v4** (`ai@^4.3.16`,
  `LanguageModelV1`) e todo `@ai-sdk/*` precisa resolver para `@ai-sdk/provider@1.1.x`.
  `@ai-sdk/openai-compatible` fica em `^0.2.16` — as versões `1.0.x`/`3.x` saltam para
  provider `2.x` (AI SDK v5) e o `tsc` quebra com *"Property 'defaultObjectGenerationMode'
  is missing"*. Slug de modelo **não** se documenta aqui: muda com frequência, a fonte viva
  é `packages/ai-engine/src/model.ts`.
- **Instalar dependência nova pode travar todos os comandos pnpm.** O pnpm acrescenta
  pacotes com build script ao `allowBuilds:` do `pnpm-workspace.yaml` com um placeholder
  literal (`'@scarf/scarf': set this to true or false`), e isso derruba o preflight de
  qualquer comando com `ERR_PNPM_IGNORED_BUILDS`. Fix: trocar o placeholder por `true`/`false`
  (telemetria pura como `@scarf/scarf` → `false`).

---

## Workflow de desenvolvimento

1. **Antes de implementar:** leia o user story relevante em `docs/sdlc/01-requisitos/`
   e os critérios de aceite correspondentes.
   - **Afirmação de defeito vinda de US/issue = hipótese, não fato.** Verificar não é achar
     uma linha compatível — é traçar o fluxo ponta a ponta (quem roda antes de quem) e
     procurar ativamente o código/comentário que EXPLICA o achado. Comentário adjacente que
     justifica o valor ofensor mata a hipótese. Citar `file:line` não prova nada se a linha
     foi escolhida por casar com a tese.
     Nasceu da US-84 (*Questões em aberto* #2): `ai.service.ts:863` passa `sceneState: null`,
     mas o comentário 6 linhas acima explica que na abertura **não pode** haver cena, e a
     US-35 preenche o campo a partir do texto da abertura para o turno 1 em diante.
2. **Antes de gerar código:** crie ou atualize os testes/evals primeiro — eles são o
   contrato com o agente.
3. **Ao modificar o DM Agent:** teste contra o eval suite em `evals/` antes de abrir PR.
4. **Ao adicionar uma nova tool:** declare o schema, implemente o handler e cite a tool no prompt
   do sistema. **Onde, na prática:** todas as 6 tools vivas são definidas inline no objeto `tools`
   de `apps/api/src/ai/ai.service.ts` (`:349-585`), porque cada uma fecha sobre `this.prisma` (ou,
   no caso do `getSpell`, sobre o contexto do turno) — extrair para o pacote exigiria inverter a
   dependência, não mover arquivo. A convenção "uma tool por arquivo no pacote" (*Estrutura*,
   abaixo) é seguida por **0 de 6**. Siga o arquivo vizinho até existir story que decida a questão.
5. **Ao alterar o schema do banco:** crie uma migração Prisma versionada; nunca edite
   migrações existentes.
6. **Code review:** todo PR que toca o AI Engine precisa de revisão de um humano,
   independentemente de aprovação automatizada.

---

## Tools disponíveis para o DM Agent

**Fonte de verdade:** o objeto `tools` de `apps/api/src/ai/ai.service.ts` (`:349-585`). Esta tabela
é resumo; se divergir, o código manda. Verificada em 27/07/2026.

| Tool | Onde é definida | O que faz |
|------|-----------------|-----------|
| `rollDice` | `:349` | Teste de d20. O modelo diz **o quê** testar (`skill`/`ability`); o modificador vem da ficha, nunca do LLM |
| `updateCharacterHp` | `:393` | Aplica dano ou cura |
| `updateInventory` | `:425` | Adiciona/remove itens (delta positivo ou negativo) |
| `updateScene` | `:483` | Atualiza o estado estruturado da cena (continuidade espacial). Só os campos que mudaram |
| `recordEntity` | `:534` | Registra/atualiza entidade durável da campanha (NPC, local, objeto, facção) — o ledger reexibido todo turno |
| `getSpell` | `:585` | Consulta magia conhecida antes de narrar o lançamento. Só leitura: não gasta slot nem rola dano |

> **Não existem** `getRule`, `advanceQuest`, `recallMemory`, `getCharacterState` nem `addEventLog`.
> Estavam nesta tabela como roadmap escrito no presente — um agente que planejasse em cima delas
> escreveria código para uma interface inexistente. Se voltarem, voltam com linha de código.
>
> **`packages/ai-engine/src/tools/` não existe mais.** A pasta guardava só um `rollDiceTool`
> exportado e nunca importado, com `execute` que só lançava exceção e interface
> (`formula: "2d6+3"`) que nem batia com a `rollDice` real (teste de d20 por `skill`), mais a
> lista das 5 tools acima comentada como `// Future tools`. Apagada em 27/07/2026.

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
