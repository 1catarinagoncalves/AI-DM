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
- **Toda ação do LLM que altera estado passa pela tool correspondente** (`updateCharacterHp`,
  `updateInventory`, `updateScene`, `recordEntity` — lista viva em *Tools disponíveis para o
  DM Agent*). O LLM só narra; o Game Server decide e persiste.
- **Typescript estrito em todo o codebase.** Sem `any` explícito sem justificativa em comentário.
- **Sem segredos no código.** Chaves, tokens e senhas via variáveis de ambiente; nunca
  hardcoded, nunca commitados.

---

## Stack e convenções

### Geral
- Linguagem: TypeScript 5.x, strict mode
- Gerenciador de pacotes: pnpm (workspace monorepo)
- Análise estática: `pnpm typecheck` (`tsc --noEmit`) e `pnpm dead` (knip — arquivo sem
  importador, dep declarada e nunca importada, export de contrato sem consumidor; US-89).
  **Não há ESLint nem Prettier no projeto** — os scripts existiam desde o scaffold mas nunca
  tiveram dependência nem config, e foram removidos. Adotar um linter é story própria.
- Exceção nova no `knip.jsonc` exige comentário com o motivo ao lado. Símbolo exportado e
  usado só dentro do próprio arquivo NÃO é achado (`ignoreExportsUsedInFile`); em
  `packages/shared`, tipo sem consumidor ou é apagado ou ganha comentário com a US que vai usá-lo.
- Commits: mensagem de agente é `US-NN — título` (travessão em dash), assunto livre quando não
  há story. Commit manual da mantenedora é livre. Sem gate automático — ver `CLAUDE.md` e US-96.

### Frontend (`apps/web`)
- Next.js 15 App Router, React Server Components onde possível
- Tailwind CSS + shadcn/ui para componentes
- Estado local de UI em `useState` (`apps/web/src/components/game/GameView.tsx:204`) — **não há Zustand** no projeto
- Estado de jogo vem do servidor por **SSE** (`text/event-stream`, `apps/web/src/app/api/chat/route.ts:28`), **não** por WebSocket: não existe `socket.io` nem `ws` no repo
- Streaming de narração token-a-token por `fetch` + leitura manual do body
  (`res.body.getReader()`, `apps/web/src/components/game/GameView.tsx:311`) — **não** pelo hook
  useChat: `@ai-sdk/react` está no `package.json` do `apps/web` e nunca é importado.
  Verificado em 28/07/2026 (US-88).
- **Mensagem de erro da API nunca vai para a tela.** O cliente propaga o corpo cru
  (`throw new Error(await res.text())`, `apps/web/src/lib/api.ts:24`) e a API lança em
  português (`apps/api/src/adventure/adventure.service.ts:39`) — esse texto é para quem
  opera, não para quem joga. Todo `catch` do front **descarta** o erro e mostra uma chave do
  dicionário: `setError(t('setup.error.create'))`
  (`apps/web/src/components/setup/SetupWizard.tsx:170`),
  `t('game.error.connect')` (`apps/web/src/components/game/GameView.tsx:458`).
  Um `catch (e) { setError(String(e)) }` põe português na tela de um jogador inglês, e
  **nenhum gate pega**: não há literal, é variável (US-102 → *Notas de implementação*).
  Verificado em 04/08/2026.

### Backend (`apps/api`)
- NestJS com um módulo por domínio. **A lista viva são as pastas de `apps/api/src/`** — leia a
  pasta; esta linha não as transcreve de propósito. Não há camada de repositório: zero
  `*.repository.ts` no repo, o service usa o `PrismaService` por DI
- Prisma ORM sobre PostgreSQL; schema, migrações e seed em `apps/api/prisma/`
- **Não há fila nem worker** no repo: zero `bullmq` no `package.json` e no código. A ingestão
  de livros é da fase 3 do roadmap e não existe ainda
- Transporte é **REST + SSE** (`text/event-stream`), **não** WebSocket — mesma medição da
  seção *Frontend* acima. Não existe `socket.io`, `ws` nem `@nestjs/websockets` como
  dependência do projeto
- **`nest start` não carrega `.env`**: a API não tem `ConfigModule` nem dependência `dotenv`,
  lê `process.env` cru. Em dev os secrets vêm do `.env` da **raiz**, via o wrapper
  `dotenv -e .env` do script `dev` (mesmo padrão dos `db:*`). `apps/api/.env` não é lido —
  não use. Antes de escrever "coloque em `.env`" numa spec ou US, confirme no código como
  aquele env var é lido.

<!-- US-91 (29/07/2026): este bloco foi reescrito inteiro, não numa linha só. Ele afirmava
     três coisas inexistentes: (1) a lista de módulos citava `campaign` e `ingestion`, que
     NÃO EXISTEM em apps/api/src e nunca existiram, e omitia quatro módulos reais; (2) BullMQ
     para filas — zero hits no package.json e no código, não há fila nenhuma; (3) Socket.IO
     para salas em tempo real — zero hits, e contradizia o CLAUDE.md e a seção Frontend logo
     acima, que já diziam SSE. Nenhuma das três acende no gate da US-88 (não são camelCase),
     e a lista de módulos era a mesma transcrição podre do convencoes.md, corrigida junto.
     Desenho que não foi adiante, escrito no presente, num arquivo que todo agente lê antes
     de escrever a primeira linha. -->

### AI Engine (`packages/ai-engine`)
- Vercel AI SDK (`ai` package) como camada de abstração de provedor
- Provedores: Groq (`@ai-sdk/groq`) para modelos rápidos e baratos; OpenRouter (`@ai-sdk/openai-compatible`) para acesso a modelos variados — roteável por custo/qualidade via Vercel AI SDK
- **Não há tool neste pacote.** As 6 tools vivas são inline em `apps/api/src/ai/ai.service.ts`
  (ver *Tools disponíveis para o DM Agent*); a pasta `packages/ai-engine/src/tools/` foi apagada
  em 27/07/2026 por só conter código morto
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
- **Caminho de doc citado em comentário não é vigiado por nada.** O `pnpm docs:links` varre
  link markdown de `docs/` mais os `.md` da raiz; um `// ver evals/PROMPT-ANCHORS.md` dentro
  de `.ts` é texto solto para o gate. Ponteiro por bloco continua sendo o padrão (US-77) — o
  que não existe é rede para o dia em que o alvo mudar de casa. Antes de mover ou renomear
  um `.md`, `git grep` pelo basename: em 29/07/2026 eram 9 citações de `PROMPT-ANCHORS.md`
  em 5 arquivos de código, e nenhuma delas reprovaria o gate depois do move (US-90,
  *Questão em aberto #3*).
- **Roadmap não vira código.** Nada de export comentado como `// Future tool`, arquivo
  placeholder, nem função cujo corpo só faz `throw new Error('... must be bound to ...')`.
  Plano mora em `docs/sdlc/01-requisitos/`, com checkbox e número de US. Em doc, a mesma
  regra: tabela que descreve código lista **só o que existe hoje**, com `file:line` e data de
  verificação; o planejado vai marcado como inexistente e com link para a US.
  Nasceu do `// Future tools` de `packages/ai-engine/src/tools/index.ts` — 5 tools que nunca
  existiram, comentadas ao lado de um `rollDiceTool` morto. O comentário virou tabela no
  `AGENTS.md`, que virou tabela no `README.md`, e as três se citavam como prova uma da outra.
  Pasta apagada em 27/07/2026. Comentário desse tipo é indistinguível de código vigente para
  quem lê rápido — e para agente, é interface pronta para escrever código em cima.

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
- Caminhos previsíveis: `src/`, módulo por domínio.

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

- **`pnpm --filter` que não casa com ninguém sai 0.** O pnpm imprime `No projects matched
  the filters` e devolve exit 0 — comando "verde" que não rodou nada. Foi assim que o
  `pnpm build` da raiz passou a mentir no Windows: o filtro estava com aspas simples
  (`'./packages/*'`), que o shell do Windows não remove, então nenhum projeto casava e o
  build inteiro virava no-op silencioso (29/07/2026). Dois cuidados, os dois já aplicados
  em `package.json`, `ci.yml`, `render.yaml` e `vercel.json`: **aspas duplas** em filtro com
  glob (funciona nos dois shells) e **`--fail-if-no-match` em todo `--filter`**.
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
- **`pnpm db:migrate` não funciona contra a Neon, e o erro mente.** O script é
  `prisma migrate dev`, que cria um **shadow database** para detectar drift; a Neon derruba a
  conexão nisso e o Prisma devolve `P1017 Server has closed the connection` — que se lê como
  "banco fora do ar" e faz perder a sessão a acordar compute (04/08/2026: falhou duas vezes
  seguidas com o compute comprovadamente ativo). Contra banco hospedado: `prisma migrate status`
  para ler (é o que responde "Database schema is up to date!") e `prisma migrate deploy` para
  aplicar — sem shadow, sem checagem de drift. É o que o `render.yaml:35` já usa.
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
   - **Evidência de um lado da interface não prova nada do outro.** Dado medido, fresco e
     correto ainda pode ser sobre o lado errado: capacidade anunciada pelo servidor ≠ conteúdo
     do request que o nosso cliente manda; título no índice ≠ nome do arquivo; doc do
     fornecedor ≠ versão instalada; opção existe ≠ opção está setada. Antes de afirmar,
     pergunte de que lado veio o dado e leia o artefato do OUTRO lado — `ls` para nome de
     arquivo, `node_modules/.pnpm/**/dist` para o que o cliente envia. Para afirmação sobre o
     NOSSO comportamento, o pacote instalado e o fonte ganham de qualquer doc de fornecedor.
     Nasceu da [ADR 008](docs/adr/008-pin-de-roteamento-no-openrouter.md) §3 (01/08/2026): a
     lista `supported_parameters` do OpenRouter mostrava que o first-party da DeepSeek não
     anuncia `structured_outputs`, e daí saiu a conclusão de que os `generateObject` eram
     desviados para outro endpoint. Eles nem mandam `json_schema` — o `@ai-sdk/openai-compatible`
     força modo tool na geração de objeto. A afirmação atravessou uma ADR, um commit e duas US
     antes de alguém tentar testá-la.
   - **Escreva como derrubar a afirmação, não só a afirmação.** Para cada fato que vai entrar
     em ADR/US: *o que eu rodaria para provar isso falso?* Se for barato (`grep`, `ls`, `curl`),
     rode agora. Marcar "deduzido, não observado" salva o conserto depois, mas não substitui
     dois minutos de verificação: questão em aberto que um `grep` responde é dívida, não
     documentação. Fica legitimamente aberta só a que precisa de dado de produção ou de tempo
     (hit-rate de cache, latência, frequência de falha).
2. **Antes de gerar código:** crie ou atualize os testes/evals primeiro — eles são o
   contrato com o agente.
3. **Ao modificar o DM Agent:** teste contra o eval suite em `evals/` antes de abrir PR.
4. **Ao adicionar uma nova tool:** declare o schema, implemente o handler e cite a tool no prompt
   do sistema. **Onde, na prática:** todas as 6 tools vivas são definidas inline no objeto `tools`
   de `apps/api/src/ai/ai.service.ts` (`:349-585`), porque cada uma fecha sobre `this.prisma` (ou,
   no caso do `getSpell`, sobre o contexto do turno) — extrair para o pacote exigiria inverter a
   dependência, não mover arquivo. Siga o arquivo vizinho. (Havia aqui uma convenção "uma tool
   por arquivo"; foi apagada em 27/07/2026 por não ter nenhum caso vigente — ver [US-83](docs/sdlc/01-requisitos/US-83-readme-com-arquitetura-alto-nivel.md),
   corolário da camada 1. Se um dia o `ai.service.ts` for dividido, a regra volta com a story que o fizer.)
5. **Ao alterar o schema do banco:** crie uma migração Prisma versionada; nunca edite
   migrações existentes.
   - **`Status` de US não carrega estado de banco.** Nada de "falta rodar `db:migrate`/`db:seed`":
     o `render.yaml:35-36` roda `prisma migrate deploy && db:seed` — os dois idempotentes — em
     **todo** deploy, então a pendência se resolve sozinha e a frase fica mentindo num arquivo que
     ninguém revisita. Medido em 04/08/2026: a US-97 anunciava uma migração pendente que a US-99
     já tinha aplicado semanas antes (o Prisma aplica em ordem — a migração da US-99 não entraria
     sem a da US-97 antes), e a US-101 tinha duas linhas de "pendente de re-seed". A informação
     certa já existia em US-59, sem ninguém a ler. Se algo precisa acontecer **antes** do próximo
     deploy, isso é ação daquele dia, não linha de documento.
     Nenhum gate pega isto: o CI usa `DATABASE_URL` fictícia (`ci.yml:16`) e nenhum teste toca
     banco — verificar estado de banco em CI é impossível aqui, de propósito.
6. **Antes de abrir a PR:** mexeu em módulo de `apps/api/src/`, pasta de topo, tool do Mestre
   ou topologia de produção → atualize a seção **Arquitetura** do `README.md` na MESMA PR.
   O `pnpm docs:shape` (US-83, camada 3) falha até alguém reolhar o diagrama e colar o hash
   novo à mão — colar o hash *é* a revisão, não uma formalidade a contornar.
7. **Code review:** todo PR que toca o AI Engine precisa de revisão de um humano,
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

Respond terse like smart caveman. All technical substance stay. Only fluff die.

Rules:
- Drop: articles (a/an/the), filler (just/really/basically), pleasantries, hedging
- Fragments OK. Short synonyms. Technical terms exact. Code unchanged.
- Pattern: [thing] [action] [reason]. [next step].
- Not: "Sure! I'd be happy to help you with that."
- Yes: "Bug in auth middleware. Fix:"

Switch level: /caveman lite|full|ultra|wenyan
Stop: "stop caveman" or "normal mode"

Auto-Clarity: drop caveman for security warnings, irreversible actions, user confused. Resume after.

Boundaries: code/commits/PRs written normal.
