# Graph Report - AI DM  (2026-08-19)

## Corpus Check
- 458 files · ~929,718 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 3431 nodes · 4693 edges · 282 communities (229 shown, 53 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 8 edges (avg confidence: 0.59)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d591d0d1`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- ingest.mjs
- dm-system.ts
- devDependencies
- narration.ts
- system.ts
- Location Bake-off Script
- Bake-off Runner Script
- [adventureId]/page.tsx
- narrative-bakeoff.test.ts
- rubric.ts
- check-doc-links.mjs
- US-36 Eval Cases
- Prompt A/B Bake-off Script
- Onomastics Bake-off Script
- US-125 — Adventures & Advancement, conexão e memento da origem no prompt do Mestre
- AdventureService
- GameView.tsx
- ai.int.test.ts
- US-97 — Jogador escolhe o idioma da partida (PT-BR ou inglês)
- Kanban Server Script
- US-141 — Catálogo de subclasses do SRD 5.1 e do Marshal (`a5e-ag`)
- seed.ts
- US-128 — Memento e equipamento da origem como itens do inventário, identificados como tais
- lgmrd-tables.ts
- ApiBearerAuth
- check-jsx-literals.mjs
- messages/index.ts
- scripts
- guardrails.ts
- scripts
- shared/package.json
- US-11b Scene State Spec
- Backlog — Motor de geração de aventuras one-shot
- ai-engine/package.json
- User Story Template
- US-102 — Tela nova nasce traduzida
- Web TSConfig
- US-116 — Observabilidade da cena não avançada, em dev e produção, e spike de A/B do arco
- compilerOptions
- compilerOptions
- Root TSConfig
- PRD — AI Dungeon Master
- Endpoints (Fase 1 — MVP)
- ApiBody
- ADR 010 — Upload de livro: lore recuperável, nunca fonte de regra
- API Build TSConfig
- US-01 Attributes Spec
- System Catalog User Stories
- Seraphine Reference Adventure
- Doc Link Checker Tests
- Acceptance Criteria Doc
- model.ts
- Deploy Infra User Stories
- Nest CLI Config
- API TSConfig/Prisma
- SRD Ingestion User Stories
- Docs Vault/CI User Stories
- US-95 — O loop `ação → tool → persistir → estado` ganha teste de integração
- US-100 — A ficha do personagem acompanha o idioma ativo (features e magias por chave)
- move-ab.mjs
- NextAuth Type Defs
- TTFT Benchmark Test
- MCP Setup Script (PS)
- MCP Setup Script (sh)
- dependencies
- AuthController
- next.config.ts
- Bake-off README
- US-129 — Escolha do idioma concedido pelo benefício `language` do background
- Spells Seed Data
- README Shape Test
- sync.mjs
- Kanban File Actions
- Vercel Config
- Prompt Layers ADR/US
- Backlog — Aventuras autorais a partir do Lazy GM's Resource Document
- US-02 — Inventário do personagem e equipamento inicial
- Paladin Features Seed
- US-105 — Raça e classe vêm do catálogo do SRD e são guardadas por chave
- US-106 — O catálogo carrega chave e procedência; o Free monta o dele de mais de uma fonte
- DM Prompt Rules Doc
- ADR 009 — Regra de uso do SRD: união do 5.1 e do 5.2, com o 5.2 vencendo
- Next Env Types
- PostCSS Config
- SetupWizard.tsx
- Hub/Delete User Stories
- Kanban Board User Stories
- Prompt Caching User Stories
- US-103 — Saber qual endpoint serviu o turno
- ingest.test.mjs
- US-105-raca-e-classe-por-chave-do-srd.md
- Evals README User Story
- Scene State Seed
- Character Sheet Awareness Seed
- Deity Seed Data
- ADR 001 Architecture
- ADR 002 Session Memory
- ADR 003: Dice as Systems
- ADR 007: Prompt Layers
- API Route Handler
- Open5e API Integration
- SRD 5.2 Dataset
- US-17 Narration Model Bake-off
- US-18 Turn History API
- US-19 Character Sheet Sync
- US-29 Fictional Roll Sanitization
- US-101 — Ganchos de aventura inicial em inglês
- adventure-generation.ts
- Direção por alavanca
- US-50 Character Spells
- US-53 Prisma Config Migration
- US-57 Server Warm-up
- US-65 Google Login Prod Setup
- migrate-feature-spell-keys.test.ts
- US-99 — O `config` do sistema é servido no locale ativo (EN cru ou overlay pt-BR)
- US-92 — O deploy espera o CI ficar verde
- d20-tests.mjs
- US-94 — O gate de qualidade da narração passa a rodar de verdade, num job noturno
- US-111 — Classe de Dificuldade do SRD 2024 decide o quão difícil é o teste
- US-112 — O arco da aventura em beats: o Mestre sabe o que MUDA a seguir
- US-76 US-75 Test Fake Fix
- US-96 — A convenção de mensagem de commit passa a descrever este repo
- US-174 — `hookSeed` deixa de ser insumo das outras chamadas do motor de geração
- Summary Model Config
- US-108 — Tabela de modificadores do SRD 2024 como fonte da regra
- PrismaService
- Design System "Grimório Vivo" — AI Dungeon Master
- Kanban User Stories
- check-jsx-literals.test.mjs
- LocaleProvider.tsx
- 2. Decisão
- Camadas de teste
- US-109 — Espaço para bônus/penalidade circunstancial no teste de d20
- US-110 — Tabela de testes de habilidade do SRD 2024 escolhe o teste da situação
- US-104 — O cache de prompt vira número
- US-120 — `logLlmFailure` em JSON estruturado (ADR 011, Camada 2 — Grupo B)
- norm
- US-98 — Interface web em inglês (i18n das strings do front)
- ADR 005 — Locale como dimensão (PT-BR / EN): preferência mutável + ficha por idioma
- CharacterService
- US-113 — Vínculos entre entidades, ancorados em quem os estabeleceu
- US-115 — O ledger recolhe a entidade que o Mestre esqueceu de registrar
- ADR 008 — Pin de roteamento no OpenRouter: o endpoint faz parte do modelo
- US-114 — As extrações e o fecho saem do modelo da narração
- ApiOperation
- us-110-tabela-de-testes.ts
- 2. Decisão
- ADR 004 — Origem do dado de sistema: ingestão do SRD por pipeline pinado
- entities.ts
- ability.ts
- US-117 — `turnId` por turno: correlação de log (ADR 011, Camada 1)
- US-138 — Catálogo de raças re-derivado com o SRD 5.1 (2014) como fonte de referência
- US-118 — Sinais de `ai.controller.ts` em JSON estruturado (ADR 011, Camada 2 — Grupo A parte 1)
- US-119 — Sinais de `ai.service.ts` em JSON estruturado (ADR 011, Camada 2 — Grupo A parte 2 + Grupo C)
- US-107 — Sair da criação ou da mesa e voltar ao hub de personagens
- starting-kit.ts
- AuthUser
- HomeHero.tsx
- ApiBody
- ApiTags
- ApiOperation
- US-166 — Motor gera múltiplos encontros (4-5), não só um
- ApiTags
- Body
- Body
- ApiBearerAuth
- Controller
- Post
- UseGuards
- US-130 — `Culture`/`Engineering` no catálogo de perícias (`config.skills`)
- adventure.service.test.ts
- US-133 — Catálogo de idiomas do sistema (`config.languages`)
- US-132 — Escolha da ferramenta concedida pelo benefício `tool_proficiency` do background
- US-139 — Catálogo de classes com o SRD 5.1 como referência, e o Marshal do A5E Adventurer's Guide
- US-124 — Exibir os benefícios narrativos da origem (`adventures_and_advancement`, `connection_and_memento`)
- US-140 — Catálogo de subespécies (subraças) do SRD 5.1
- US-121 — Catálogo de backgrounds do A5E Adventurer's Guide (Open5e)
- US-122 — Escolha de origem (catálogo de background) na criação de personagem
- shared/src/index.ts
- US-134 — Catálogo de ferramentas e veículos do sistema (`config.tools`)
- US-142 — Traços mecânicos de subespécie (raça-base + subespécie combinados)
- ai-engine/src/index.ts
- US-127 — Revisão da criação espelha a ficha completa (kit, features, magias, PV)
- Backlog — Economia de recursos do personagem
- US-131 — Integração mecânica: perícias do background em `proficiency`
- SetupWizard.test.tsx
- US-123 — Integração mecânica: bônus de atributo do background em `pointBuy`
- parseD10Tables.ts
- Backlog — Combate por turno
- Backlog — Classe de armadura e resolução de ataque
- Backlog — Mapa em tempo real
- US-159 — Orçamento de encontro do LGMRD (Lazy Encounter Benchmark) para um personagem
- ai.service.ts
- Controller
- US-93 — Três gates baratos: drift de migração, dependência vulnerável e smoke pós-deploy
- migrate-race-class-keys.test.ts
- US-135 — Feature de origem (benefício `feature` do background) na criação e na ficha, como as features de classe
- int-db.ts
- US-144 — Schema da aventura gerada em `@ai-dm/shared`
- US-136 — Tag origem/classe nas features da revisão e da ficha
- US-175 — `generateClosing` deixa de receber `hookSeed`; antagonista vive só na `premissa`
- US-145 — `sync` pinado do Lazy GM Resource Document + NOTICE gerado
- US-146 — Seed determinístico do motor de aventuras
- US-147 — Rolagem do motor: registro primeiro, conteúdo depois
- US-148 — Perfil do personagem como entrada do motor
- US-149 — Segredos pelos 40 prompts do LGMRD
- US-150 — Gate antes de persistir a aventura gerada
- extract-tables.mjs
- US-151 — Semear o ledger com os segredos e NPCs gerados
- US-152 — Statblocks por papel e orçamento de encontro para um personagem
- @prisma/client
- US-153 — A aventura deixa de ser derivada da classe
- US-154 — Eval da aventura gerada
- US-155 — Aposentar a quest fixa por classe
- US-156 — Catálogos de registro (setting/tone/areaType), DTO e validação
- US-157 — A tela de mundo, depois da revisão
- US-110-tabela-de-testes-de-habilidade-do-srd-2024.md
- US-143 — ADR: aventura gerada é regenerável ou congelada, e onde ela mora
- ADR 012 — Aventura gerada: artefato congelado, seed recomputável, coluna própria
- extract-monster-roles.mjs
- buildConfig
- US-158 — Locais e NPCs com prosa (camada 2, antes dos segredos)
- backlog-motor-de-geracao-de-aventuras.md
- Injectable
- extract-benchmark.mjs
- US-176 — `generateSecrets` recebe `tone` do registro (hoje gerado cego a ele)
- translate-srd.ts
- lazygm/sync.mjs
- Atribuição — Lazy GM Resource Document + Lazy GM's 5e Monster Builder
- SystemController
- backlog-aventuras-autorais-lazygm.md
- US-102-gate-de-string-literal-no-jsx.md
- US-160 — Composer de encontro usa o limiar de soma, não só o teto de monstro único
- US-161 — Jogador escolhe o nível de desafio do encontro
- US-162 — Jogador escolhe a quantidade de segredos ativos
- roll-adventure.ts
- US-163 — Jogador escolhe o tamanho da aventura (locais e NPCs)
- US-164 — Orquestrador do motor: monta o `GeneratedAdventure` e gera o fecho ramificado
- US-165 — Tela: jogador escolhe o nível de desafio do encontro
- Get
- Param
- character.schema.ts
- UserController
- adventure-gate.ts
- Post
- layout.tsx
- US-167 — Motor consome o `challenge` escolhido pelo jogador na geração real
- UseGuards
- adventure.service.ts
- monster-roles.ts
- US-168 — Abertura narrada expande o gancho fixo, não a aventura gerada
- 011-observabilidade-em-camadas.md
- us-154-eval-aventura-gerada.ts
- character.service.test.ts
- sheet.test.ts
- US-173 — Registro da aventura fica só com `tone`; `settings` e `areaTypes` saem do catálogo
- Repositórios de referência — registro e regra de uso
- US-169 — Quest gerada ganha objetivo concreto e o Mestre passa a poder concluí-la
- US-170 — Locais gerados entram no ledger e chegam ao Mestre
- US-171 — Encontros de combate entram no ledger e chegam ao Mestre
- US-172 — Abertura gerada deixa de copiar o gancho fixo, passa a ser escrita para o tom sorteado

## God Nodes (most connected - your core abstractions)
1. `scripts` - 29 edges
2. `PrismaService` - 27 edges
3. `AiService` - 24 edges
4. `US-47 — Ingestão do SRD 5e (2024) como dado do sistema` - 22 edges
5. `CharacterService` - 21 edges
6. `useT()` - 18 edges
7. `Backlog — Motor de geração de aventuras one-shot` - 16 edges
8. `Backlog — Aventuras autorais a partir do Lazy GM's Resource Document` - 16 edges
9. `AuthUser` - 16 edges
10. `AdventureService` - 15 edges

## Surprising Connections (you probably didn't know these)
- `buildConfig()` --references--> `SystemConfigSchema`  [EXTRACTED]
  scripts/srd/ingest.mjs → packages/shared/src/types/system.ts
- `US-77 — Reancorar as assertivas de prompt restantes` --references--> `Prompt Anchors Convention`  [EXTRACTED]
  docs/sdlc/01-requisitos/US-77-reancorar-assertivas-de-prompt-e-guard-de-regressao.md → evals/PROMPT-ANCHORS.md
- `build()` --calls--> `buildDmSystemPrompt()`  [EXTRACTED]
  packages/ai-engine/src/prompts/dm-system.test.ts → packages/ai-engine/src/prompts/dm-system.ts
- `rollAdventure()` --calls--> `rollContent()`  [EXTRACTED]
  apps/api/src/adventure-generation/roll-adventure.ts → apps/api/src/adventure-generation/roll-content.ts
- `main()` --references--> `@prisma/client`  [EXTRACTED]
  apps/api/prisma/migrate-feature-spell-keys.ts → apps/api/package.json

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Character Creation Flow** — docs_sdlc_01_requisitos_us_20, docs_sdlc_01_requisitos_us_21, docs_sdlc_01_requisitos_us_26, docs_sdlc_01_requisitos_us_27, docs_sdlc_01_requisitos_us_28 [EXTRACTED 0.90]
- **API Synchronization Mechanics** — docs_sdlc_01_requisitos_us_18, docs_sdlc_01_requisitos_us_19, docs_sdlc_01_requisitos_us_23 [INFERRED 0.80]
- **Narrative Quality and Evaluation Flow** — docs_sdlc_01_requisitos_us_34_qualidade_da_narracao_do_dm, docs_sdlc_01_requisitos_us_36_eval_de_qualidade_da_narracao, docs_sdlc_01_requisitos_us_37_nivel_cinematografico_em_todos_os_turnos [EXTRACTED 0.90]
- **Character Identity and Background System** — docs_sdlc_01_requisitos_us_39_identidade_narrativa_background_ideais, docs_sdlc_01_requisitos_us_40_divindade_do_personagem, docs_sdlc_01_requisitos_us_45_background_na_ficha_da_interface [EXTRACTED 0.90]
- **Class Mechanics Awareness System** — docs_sdlc_01_requisitos_us_41_features_traits_de_classe, docs_sdlc_01_requisitos_us_42_magias_conhecidas, docs_sdlc_01_requisitos_us_47_ingestao_srd_como_dado [EXTRACTED 0.85]
- **SRD Ingestion Pipeline** — docs_sdlc_01_requisitos_us_47, docs_sdlc_01_requisitos_us_51, docs_sdlc_01_requisitos_us_52, docs_sdlc_01_requisitos_us_54 [EXTRACTED 1.00]
- **Deploy Infrastructure Stack (Custo Zero)** — docs_sdlc_01_requisitos_us_58, docs_sdlc_01_requisitos_us_59, docs_sdlc_01_requisitos_us_60 [EXTRACTED 1.00]
- **Claude MCP Operations** — docs_sdlc_01_requisitos_us_62, docs_sdlc_01_requisitos_us_63, docs_sdlc_01_requisitos_us_64 [EXTRACTED 1.00]
- **Narrative Quality & Anti-Degeneration Flow** — docs_sdlc_01_requisitos_us_68_nomes_de_fantasia_originais, docs_sdlc_01_requisitos_us_69_guard_anti_degeneracao_narracao, docs_sdlc_01_requisitos_us_74_guard_turno_truncado_narracao [EXTRACTED 0.95]
- **Eval Robustness & Prompt Anchoring** — docs_sdlc_01_requisitos_us_70_piso_por_dimensao_e_robustez_do_eval, docs_sdlc_01_requisitos_us_72_evals_de_prompt_resistentes_a_reescrita, docs_sdlc_01_requisitos_us_77_reancorar_assertivas_de_prompt_e_guard_de_regressao [EXTRACTED 0.95]
- **World State & Scene Consistency** — docs_sdlc_01_requisitos_us_71_simplificar_localizacao_do_personagem, docs_sdlc_01_requisitos_us_73_reconciliador_de_cena_em_background, docs_sdlc_01_requisitos_us_75_dimensao_de_proveniencia_no_ledger [EXTRACTED 0.95]
- **Kanban API Interaction Flow** — tools_kanban_carregar, tools_kanban_mover, tools_kanban_abrir [EXTRACTED 0.90]

## Communities (282 total, 53 thin omitted)

### Community 0 - "ingest.mjs"
Cohesion: 0.08
Nodes (35): A5E_SKILLS, ABILITY_MAP, applyDrafts(), ATTR_ORDER, ATTR_RANGE, buildAttributes(), capitalize(), CLASS_MAP (+27 more)

### Community 1 - "dm-system.ts"
Cohesion: 0.10
Nodes (22): ADR-0003, ADR-0005, abilityCheckTable(), BACKGROUND_LABELS, backgroundFieldText(), buildDmSystemPrompt(), buildOpeningInstruction(), buildTurnStateBlock() (+14 more)

### Community 2 - "devDependencies"
Cohesion: 0.04
Nodes (45): dependencies, @ai-dm/shared, jose, lucide-react, next, next-auth, react, react-dom (+37 more)

### Community 3 - "narration.ts"
Cohesion: 0.20
Nodes (13): detectDegeneration(), formatDiceBreakdown(), hasOptionsList(), NUM, ROLL_CUES, ROLL_SENTENCE, stripFabricatedRolls(), stripReasoningLeak() (+5 more)

### Community 4 - "system.ts"
Cohesion: 0.08
Nodes (23): buildCharacterAttributesSchema(), InitialAdventureHook, InitialAdventureHookSchema, RaceCatalogEntry, RaceCatalogEntrySchema, StartingKitItemSchema, SystemAttribute, SystemAttributeSchema (+15 more)

### Community 5 - "Location Bake-off Script"
Cohesion: 0.07
Nodes (25): system, turnState, ARMS, body, dir, EXEMPLAR, genOnce(), judge (+17 more)

### Community 6 - "Bake-off Runner Script"
Cohesion: 0.07
Nodes (26): accum, CHARACTER, COHERENCE_TURN_STATE, DEFAULT_MODELS, dir, EX, genTurn(), guardrailHits (+18 more)

### Community 7 - "[adventureId]/page.tsx"
Cohesion: 0.16
Nodes (9): POST(), Props, { handlers, auth }, secretKey(), signApiToken(), ADR-0006, localeFromCookie(), apiAuthHeader() (+1 more)

### Community 8 - "narrative-bakeoff.test.ts"
Cohesion: 0.06
Nodes (26): AMNESIA_ENTITIES, AMNESIA_TURN_STATE, CHARACTER, COHERENCE_TURN_STATE, DEFAULT_MODELS, EX_AMNESIA, EX_COHERENCE, EX_COMBAT (+18 more)

### Community 9 - "rubric.ts"
Cohesion: 0.08
Nodes (34): aggregateReps(), batchItemSchema, batchSchema, buildBatchPrompt(), buildJudgePrompt(), Dimension, DIMENSION_FLOORS, DIMENSIONS (+26 more)

### Community 10 - "check-doc-links.mjs"
Cohesion: 0.08
Nodes (21): argv, buckets, DOCS, exemptLinked, fixed, GHOST_ALLOW, GHOST_MD, ghostHits (+13 more)

### Community 11 - "US-36 Eval Cases"
Cohesion: 0.09
Nodes (20): ANCHOR_SET, AnchorItem, Case, CASES, CHARACTER, EN_CHARACTER, EN_SYSTEM, EX_CHILD (+12 more)

### Community 12 - "Prompt A/B Bake-off Script"
Cohesion: 0.09
Nodes (17): body, CHARACTER, dir, EXEMPLAR, judge, log(), MODEL, PACE_MS (+9 more)

### Community 13 - "Onomastics Bake-off Script"
Cohesion: 0.11
Nodes (15): body, CHARACTER, dir, EXEMPLAR, judge, log(), MODELS, PACE_MS (+7 more)

### Community 14 - "US-125 — Adventures & Advancement, conexão e memento da origem no prompt do Mestre"
Cohesion: 0.20
Nodes (10): Critérios de aceite, Dentro do escopo, Escopo desta story, Fora do escopo, História, Modelo de dados proposto, Notas de implementação, Por que não injetar `benefits[].description` cru para conexão/memento (+2 more)

### Community 15 - "AdventureService"
Cohesion: 0.08
Nodes (19): ApiBearerAuth, ApiBody, ApiOperation, ApiTags, AdventureController, CreateAdventureSchema, AdventureService, Injectable (+11 more)

### Community 16 - "GameView.tsx"
Cohesion: 0.12
Nodes (20): CharacterBackground, ClassFeature, FeaturesPanel(), ATTR_LABELS, GameView(), historyKey(), loadHistory(), LocaleTurn (+12 more)

### Community 17 - "ai.int.test.ts"
Cohesion: 0.20
Nodes (11): assinarToken(), chamaTool(), dm, fim(), Mesa, montarMesa(), texto(), ADR-0011 (+3 more)

### Community 18 - "US-97 — Jogador escolhe o idioma da partida (PT-BR ou inglês)"
Cohesion: 0.09
Nodes (23): A proposta, Alternativas consideradas, Aviso de troca de idioma no chat, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo (+15 more)

### Community 19 - "Kanban Server Script"
Cohesion: 0.17
Nodes (15): abrirArquivo(), acharArquivo(), campo(), CANONICO, { execFile }, fs, gravarStatus(), HTML_FILE (+7 more)

### Community 20 - "US-141 — Catálogo de subclasses do SRD 5.1 e do Marshal (`a5e-ag`)"
Cohesion: 0.12
Nodes (16): `CharacterClass.desc` continua vazio — catálogo é `{key, label}`, igual a `classes`/`races`, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Modelo de dados proposto (+8 more)

### Community 21 - "seed.ts"
Cohesion: 0.06
Nodes (32): AUTHORED_FEATURES, AUTHORED_SPELLS, AuthoredEntry, authoredIn(), buildFreeClassFeatures(), buildFreeClassSpells(), classKeys(), freeFeatureRefs (+24 more)

### Community 22 - "US-128 — Memento e equipamento da origem como itens do inventário, identificados como tais"
Cohesion: 0.13
Nodes (15): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Modelo de dados proposto (+7 more)

### Community 23 - "lgmrd-tables.ts"
Cohesion: 0.18
Nodes (14): LgmrdSubsectionId, LgmrdTable, LgmrdTableRow, LgmrdTables, readLgmrdTables(), readSecretPrompts(), SECRET_PROMPT_CATEGORIES, SecretPromptCategory (+6 more)

### Community 25 - "check-jsx-literals.mjs"
Cohesion: 0.19
Nodes (15): bucketOf(), files, hasLetter(), hits, isCharged(), isDataUri(), isProse(), isTailwind() (+7 more)

### Community 26 - "messages/index.ts"
Cohesion: 0.22
Nodes (10): config, { listSystems, setLocale }, LOCALE_STORAGE_KEY, enUS, DICTIONARIES, fill(), translate, ADR-0005 (+2 more)

### Community 27 - "scripts"
Cohesion: 0.05
Nodes (39): dotenv-cli, knip, devDependencies, dotenv-cli, knip, typescript, name, packageManager (+31 more)

### Community 28 - "guardrails.ts"
Cohesion: 0.22
Nodes (15): checkNoSelfRoll(), DENIAL_PATTERNS, detectCanonDenial(), detectInventedRoll(), detectLanguageDrift(), detectReasoningLeak(), detectSlopName(), detectUnledgeredName() (+7 more)

### Community 29 - "scripts"
Cohesion: 0.06
Nodes (33): devDependencies, @nestjs/cli, prisma, @swc/core, ts-node, @types/express, typescript, unplugin-swc (+25 more)

### Community 30 - "shared/package.json"
Cohesion: 0.11
Nodes (18): dependencies, zod, devDependencies, typescript, vitest, typescript, vitest, zod (+10 more)

### Community 31 - "US-11b Scene State Spec"
Cohesion: 0.12
Nodes (16): A proposta, Como o `sceneState` é alimentado (determinístico), Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História (+8 more)

### Community 32 - "Backlog — Motor de geração de aventuras one-shot"
Cohesion: 0.07
Nodes (27): 1. Determinístico, no Game Server, 2. Modelo, uma chamada por peça, 3. Gate, antes de persistir, A inversão e o que ela custa, As entradas já existem no repo, Backlog — Motor de geração de aventuras one-shot, Corte mínimo, Decisões abertas (+19 more)

### Community 33 - "ai-engine/package.json"
Cohesion: 0.06
Nodes (31): @ai-sdk/google, @ai-sdk/groq, @ai-sdk/openai-compatible, dependencies, ai, @ai-dm/shared, @ai-sdk/google, @ai-sdk/groq (+23 more)

### Community 34 - "User Story Template"
Cohesion: 0.13
Nodes (14): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Modelo de dados proposto (+6 more)

### Community 35 - "US-102 — Tela nova nasce traduzida"
Cohesion: 0.13
Nodes (15): A periferia: medida em 31/07, remedida em 04/08, A proposta, Baseline medida (31/07/2026), Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo (+7 more)

### Community 36 - "Web TSConfig"
Cohesion: 0.09
Nodes (22): compilerOptions, allowJs, incremental, isolatedModules, jsx, lib, module, moduleResolution (+14 more)

### Community 37 - "US-116 — Observabilidade da cena não avançada, em dev e produção, e spike de A/B do arco"
Cohesion: 0.13
Nodes (15): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Notas de implementação (+7 more)

### Community 38 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, declaration, declarationMap, module, moduleResolution, outDir, exclude, extends (+4 more)

### Community 39 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, declaration, declarationMap, module, moduleResolution, outDir, exclude, extends (+4 more)

### Community 40 - "Root TSConfig"
Cohesion: 0.20
Nodes (9): compilerOptions, esModuleInterop, module, moduleResolution, noUncheckedIndexedAccess, resolveJsonModule, skipLibCheck, strict (+1 more)

### Community 41 - "PRD — AI Dungeon Master"
Cohesion: 0.18
Nodes (10): 1. Declaração do problema, 2. Objetivos e critério de aceite, 3. Usuários alvo, 4.1 Personagens e campanhas, 4.2 Multiplayer, 4.3 Sistemas e aventuras, 4. Casos de uso, 5. Fora do escopo (v1) (+2 more)

### Community 42 - "Endpoints (Fase 1 — MVP)"
Cohesion: 0.20
Nodes (10): Aventuras, Contratos de API — AI Dungeon Master, Convenções, DM Agent (streaming), Endpoints (Fase 1 — MVP), Multiplayer (Fase 4), Personagens — dono derivado do token, Sistemas — público (+2 more)

### Community 44 - "ADR 010 — Upload de livro: lore recuperável, nunca fonte de regra"
Cohesion: 0.12
Nodes (17): 1. Contexto, 2. Decisão, 3. Decisões-chave e justificativas, 4. O que foi verificado, 5. Alternativas rejeitadas, 6. Consequências, 7. Questões em aberto, 8. Implementação (referência) (+9 more)

### Community 45 - "API Build TSConfig"
Cohesion: 0.22
Nodes (8): exclude, extends, node_modules, prisma, prisma.config.ts, ./tsconfig.json, dist, **/*.test.ts

### Community 46 - "US-01 Attributes Spec"
Cohesion: 0.18
Nodes (10): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, O problema observado (+2 more)

### Community 47 - "System Catalog User Stories"
Cohesion: 0.32
Nodes (8): US-20 — Catálogo de sistemas servido pela API, US-21 — Sistema de regras como dado reutilizável pelas APIs, US-22 — Fusão de campanha e aventura numa entidade só, US-23 — DM ciente da ficha completa (injeção dirigida por dados), US-26 — Criação de personagem em etapas com trilha de progresso, US-27 — Perícias do personagem, US-28 — Aventura inicial baseada na classe do personagem, US-32 — Modificadores de atributo do personagem

### Community 48 - "Seraphine Reference Adventure"
Cohesion: 0.18
Nodes (10): Apêndice — Ficha da personagem (contexto que o DM deveria ler), Aventura de referência — Lady Seraphine Valthor, Paladina de Solariel, ⚠️ Como usar (e como NÃO usar), Exemplar 1 — Turno de abertura (imersão + gancho + agência), Exemplar 2 — Coleta de informação (voz de NPC + lore sem despejo), Exemplar 3 — Confronto e revelação (ritmo + cliffhanger), Exemplar 4 — Dilema moral e coro de aliados (voz de NPC múltipla + peso), Nota de proveniência (+2 more)

### Community 49 - "Doc Link Checker Tests"
Cohesion: 0.25
Nodes (4): ANTES, DEPOIS, ROOT, SCRIPT

### Community 50 - "Acceptance Criteria Doc"
Cohesion: 0.20
Nodes (9): Critérios de Aceite — AI Dungeon Master, Critérios de aceite transversais (todos os stories), US-01 — Criar personagem, US-02 — Ver ficha do personagem, US-03 — Personagem persiste entre aventuras, US-08 — Narração em streaming, US-09 — Rolagem de dados transparente, US-10 — Consulta de regras (+1 more)

### Community 51 - "model.ts"
Cohesion: 0.11
Nodes (24): DEEPSEEK_ALLOWED_PROVIDERS, DEEPSEEK_ROUTE, DEEPSEEK_ROUTE_ORDER, EXTRACTION_PROVIDER_OPTIONS, extractionModel, fallbackModel, formatProvenance(), groq (+16 more)

### Community 52 - "Deploy Infra User Stories"
Cohesion: 0.29
Nodes (7): US-58 — Banco Postgres gerenciado na Neon, US-59 — API em produção no Render, US-60 — Web em produção na Vercel, US-61 — Login do jogador, US-62 — Acesso do Claude à Neon via MCP, US-63 — Acesso do Claude ao Render via MCP, US-64 — Acesso do Claude à Vercel via MCP

### Community 53 - "Nest CLI Config"
Cohesion: 0.33
Nodes (5): collection, compilerOptions, deleteOutDir, $schema, sourceRoot

### Community 54 - "API TSConfig/Prisma"
Cohesion: 0.15
Nodes (12): compilerOptions, emitDecoratorMetadata, experimentalDecorators, module, moduleResolution, outDir, extends, include (+4 more)

### Community 55 - "SRD Ingestion User Stories"
Cohesion: 0.33
Nodes (6): US-47 — Ingestão do SRD como dado, US-48 — Tool getRule e corpus de regras, US-49 — Eval de fidelidade às regras do SRD, US-51 — Kits iniciais derivados do SRD, US-52 — Tradução automática do SRD, US-54 — Chaves canônicas de classe em inglês

### Community 56 - "Docs Vault/CI User Stories"
Cohesion: 0.40
Nodes (5): US-78 — Vault Obsidian sobre docs/, US-79 — Consertar links quebrados na documentação, US-80 — CI: typecheck, testes e evals, US-81 — Higiene de nomes de arquivo e placeholders (#), US-82 — Gate de convenção de nomes de arquivo

### Community 57 - "US-95 — O loop `ação → tool → persistir → estado` ganha teste de integração"
Cohesion: 0.09
Nodes (23): A proposta, Alternativas consideradas e rejeitadas, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fluxo 1 — rolagem ancorada na ficha ([US-38](./US-38-rolagens-ancoradas-na-ficha.md)), Fluxo 2 — dano persiste (+15 more)

### Community 58 - "US-100 — A ficha do personagem acompanha o idioma ativo (features e magias por chave)"
Cohesion: 0.10
Nodes (21): 1. O índice cobre os **dois** locales, não só o pt-BR, 2. O casamento é **escopado pela classe**, 3. Todo item legado tem destino — o `retired` é a rede para o próximo bump, 4. Rodar como script conferível antes de escrever, A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo (+13 more)

### Community 59 - "move-ab.mjs"
Cohesion: 0.16
Nodes (12): CHARACTER, corte, fimDaLinha, log(), makeTools(), REPS, resultado, RODADAS (+4 more)

### Community 60 - "NextAuth Type Defs"
Cohesion: 0.40
Nodes (4): JWT, next-auth, next-auth/jwt, Session

### Community 61 - "TTFT Benchmark Test"
Cohesion: 0.50
Nodes (3): measureTTFT(), MODELS, nvidia

### Community 62 - "MCP Setup Script (PS)"
Cohesion: 0.70
Nodes (4): Add-Neon(), Add-Render(), Add-Vercel(), Test-ClaudeCli()

### Community 63 - "MCP Setup Script (sh)"
Cohesion: 0.70
Nodes (4): setup-mcp.sh script, add_neon(), add_render(), add_vercel()

### Community 64 - "dependencies"
Cohesion: 0.08
Nodes (25): ai, @ai-dm/ai-engine, @ai-dm/shared, dependencies, ai, @ai-dm/ai-engine, @ai-dm/shared, @nestjs/common (+17 more)

### Community 65 - "AuthController"
Cohesion: 0.13
Nodes (14): AuthController, SetLocaleSchema, SyncSchema, ApiBearerAuth, ApiBody, ApiOperation, ApiTags, Body (+6 more)

### Community 67 - "Bake-off README"
Cohesion: 0.33
Nodes (5): Bake-off narrativo (US-17) — como rodar, Notas, Pré-requisitos, Rodar (PowerShell), Variáveis

### Community 68 - "US-129 — Escolha do idioma concedido pelo benefício `language` do background"
Cohesion: 0.14
Nodes (14): A proposta (condicional), Contexto e motivação, Critérios de aceite, Dentro do escopo (só depois que `config.languages` existir), Escopo, Fora do escopo, História, Modelo de dados proposto (+6 more)

### Community 69 - "Spells Seed Data"
Cohesion: 0.50
Nodes (3): base, clerigoSpells, paladinoSpells

### Community 70 - "README Shape Test"
Cohesion: 0.67
Nodes (3): entries(), ROOT, shape()

### Community 71 - "sync.mjs"
Cohesion: 0.33
Nodes (4): FILES, ADR-0004, ADR-0009, OUT

### Community 74 - "Prompt Layers ADR/US"
Cohesion: 1.00
Nodes (3): ADR 007 — Camadas do prompt por volatilidade, US-84 — Nomes de bloco do turn-state compartilhados, US-85 — A fronteira entre as camadas do prompt

### Community 75 - "Backlog — Aventuras autorais a partir do Lazy GM's Resource Document"
Cohesion: 0.06
Nodes (36): A fonte de mundo é Dunsany, e ela não é JSON, A fonte de método é JSON pronto, A inversão de 07/08/2026, Adiado para a fase 4, Armadilha: a fonte se move sozinha, Backlog — Aventuras autorais a partir do Lazy GM's Resource Document, Cinco tarefas mudam de dono, Conteúdo (+28 more)

### Community 76 - "US-02 — Inventário do personagem e equipamento inicial"
Cohesion: 0.14
Nodes (13): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Equipamentos iniciais por classe, Escopo, Fora do escopo, História (+5 more)

### Community 78 - "US-105 — Raça e classe vêm do catálogo do SRD e são guardadas por chave"
Cohesion: 0.12
Nodes (17): A camada que existe hoje é um matcher, não um catálogo, A segunda fonte está no mesmo tag, Contexto e motivação, Critérios de aceite, Dentro do escopo, E as listas estão erradas, Escopo, Fora do escopo (+9 more)

### Community 79 - "US-106 — O catálogo carrega chave e procedência; o Free monta o dele de mais de uma fonte"
Cohesion: 0.11
Nodes (18): A proposta, Como ficou (03/08/2026), Consequências observáveis, Contexto e motivação, Critérios de aceite, Defeito 1 — a chave é calculada e descartada, Defeito 2 — o Free é monolíngue por construção, Defeito 3 — "herdar o SRD" não cobre o Free inteiro (+10 more)

### Community 80 - "DM Prompt Rules Doc"
Cohesion: 0.50
Nodes (3): ⚠️ REGRA ABSOLUTA - NUNCA confunda opções com diálogo:, ⚠️ REGRA DE CONSISTÊNCIA NARRATIVA (CRÍTICO):, REGRAS RÍGIDAS DE FORMATAÇÃO DE TEXTO (OBRIGATÓRIO):

### Community 83 - "ADR 009 — Regra de uso do SRD: união do 5.1 e do 5.2, com o 5.2 vencendo"
Cohesion: 0.12
Nodes (16): 10. Fechamento do §8 pro trio que sobrava — US-139 implementada (15/08/2026), 1. Contexto, 2. Decisão, 3. Decisões-chave e justificativas, 4. O que a medição mostrou, 5. Alternativas rejeitadas, 6. Consequências, 7. Implementação (referência) (+8 more)

### Community 86 - "SetupWizard.tsx"
Cohesion: 0.09
Nodes (29): BackgroundPanel(), GENDERS, groupToolsByCategory(), lines(), optionCardClass(), parseDeity(), POINT_COST, rollRandom() (+21 more)

### Community 90 - "US-103 — Saber qual endpoint serviu o turno"
Cohesion: 0.15
Nodes (13): Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Notas de implementação, O problema observado (+5 more)

### Community 91 - "ingest.test.mjs"
Cohesion: 0.07
Nodes (18): ATTACKS_DESC, ATTR_KEYS, CHECKS_DESC, d20Rules(), ADR-0009, MOD_ROWS, modifiersDesc(), OVERLAY_PATH (+10 more)

### Community 92 - "US-105-raca-e-classe-por-chave-do-srd.md"
Cohesion: 0.23
Nodes (6): US-39 — Identidade narrativa do personagem, US-41 — Features de classe conhecidas pelo mestre, US-42 — Magias conhecidas pelo mestre, US-43 — Calibração do peso dos traços de identidade, US-45 — Background visível na ficha do personagem, US-47 — Ingestão do SRD 5e (2024) como dado do sistema

### Community 112 - "US-101 — Ganchos de aventura inicial em inglês"
Cohesion: 0.14
Nodes (14): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Notas de implementação (+6 more)

### Community 113 - "adventure-generation.ts"
Cohesion: 0.15
Nodes (12): ADR-0012, AdventureEncounter, AdventureEncounterSchema, AdventureLocation, AdventureLocationSchema, AdventureNpc, AdventureNpcInteractionSchema, AdventureNpcSchema (+4 more)

### Community 114 - "Direção por alavanca"
Cohesion: 0.14
Nodes (14): 1. Tipografia — o maior ganho, 2. Recalibração de cor (paleta travada), 3. Iconografia, 4. Materialidade + textura, 5. Imagem — o tell central por resolver, 6. Movimento, A preservar (não regredir), Auditoria do estado atual (+6 more)

### Community 120 - "migrate-feature-spell-keys.test.ts"
Cohesion: 0.20
Nodes (11): allConfigs(), buildNameIndex(), main(), NameIndex, normalize(), enUS, featureIndex, ptBR (+3 more)

### Community 121 - "US-99 — O `config` do sistema é servido no locale ativo (EN cru ou overlay pt-BR)"
Cohesion: 0.14
Nodes (14): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Modelo de dados proposto (+6 more)

### Community 122 - "US-92 — O deploy espera o CI ficar verde"
Cohesion: 0.14
Nodes (14): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Notas de implementação (+6 more)

### Community 123 - "d20-tests.mjs"
Cohesion: 0.28
Nodes (13): assertCoversRange(), parseAbilityModifiers(), parseModifier(), parseSpan(), requireRule(), tableRows(), toAscii(), abilityRows() (+5 more)

### Community 124 - "US-94 — O gate de qualidade da narração passa a rodar de verdade, num job noturno"
Cohesion: 0.15
Nodes (13): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Notas de implementação (+5 more)

### Community 125 - "US-111 — Classe de Dificuldade do SRD 2024 decide o quão difícil é o teste"
Cohesion: 0.14
Nodes (14): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Modelo de dados proposto (+6 more)

### Community 126 - "US-112 — O arco da aventura em beats: o Mestre sabe o que MUDA a seguir"
Cohesion: 0.14
Nodes (14): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Modelo de dados proposto (+6 more)

### Community 128 - "US-96 — A convenção de mensagem de commit passa a descrever este repo"
Cohesion: 0.14
Nodes (14): A proposta, Contexto e motivação, Critérios de aceite, Decisão (03/08/2026), Dentro do escopo, Escopo, Fora do escopo, História (+6 more)

### Community 135 - "US-174 — `hookSeed` deixa de ser insumo das outras chamadas do motor de geração"
Cohesion: 0.15
Nodes (13): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Notas de implementação (+5 more)

### Community 141 - "US-108 — Tabela de modificadores do SRD 2024 como fonte da regra"
Cohesion: 0.14
Nodes (14): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Modelo de dados proposto (+6 more)

### Community 145 - "PrismaService"
Cohesion: 0.07
Nodes (30): AdventureModule, Module, AiModule, Module, AppModule, Module, AuthModule, Module (+22 more)

### Community 146 - "Design System "Grimório Vivo" — AI Dungeon Master"
Cohesion: 0.17
Nodes (12): 1. Tokens de cor, 2. Tipografia, 3. Primitivas, 4. Materialidade e layout, 5. Movimento, 6. Acessibilidade (invariantes da US-46 embutidas no sistema), 7. Checklist de tela nova, Contraste medido (não estimado) (+4 more)

### Community 149 - "LocaleProvider.tsx"
Cohesion: 0.20
Nodes (14): LocaleContext, LocaleContextValue, LocaleProvider(), rememberLocale(), storedLocale(), AuthTokenBridge(), Providers(), api (+6 more)

### Community 150 - "2. Decisão"
Cohesion: 0.14
Nodes (14): 1. Contexto, 2.1 Topologia, 2. Decisão, 3. Decisões-chave e justificativas, 4. Alternativas rejeitadas, 5. Consequências, 6. Implementação (referência), ADR 006 — Deploy a custo zero (Fase 1) (+6 more)

### Community 151 - "Camadas de teste"
Cohesion: 0.17
Nodes (12): 1. Testes unitários (todos os workspaces), 2. Testes de integração — não existem ainda, 3. Testes de componente (apps/web), 4. Evals do DM Agent (evals/), Camadas de teste, Estratégia de Testes e Evals — AI Dungeon Master, Estrutura de um eval case (evals/cases/), Flywheel de qualidade (após MVP) (+4 more)

### Community 152 - "US-109 — Espaço para bônus/penalidade circunstancial no teste de d20"
Cohesion: 0.14
Nodes (14): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Modelo de dados proposto (+6 more)

### Community 153 - "US-110 — Tabela de testes de habilidade do SRD 2024 escolhe o teste da situação"
Cohesion: 0.14
Nodes (14): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Modelo de dados proposto (+6 more)

### Community 154 - "US-104 — O cache de prompt vira número"
Cohesion: 0.15
Nodes (13): Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Notas de implementação, O número que decide (+5 more)

### Community 155 - "US-120 — `logLlmFailure` em JSON estruturado (ADR 011, Camada 2 — Grupo B)"
Cohesion: 0.20
Nodes (10): Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Notas de implementação, Questões em aberto (+2 more)

### Community 156 - "norm"
Cohesion: 0.17
Nodes (17): buildBackgrounds(), buildStartingKits(), buildToolCategories(), firstAlternative(), localizeKitItems(), norm(), normalizeSkillKey(), normalizeToolName() (+9 more)

### Community 157 - "US-98 — Interface web em inglês (i18n das strings do front)"
Cohesion: 0.15
Nodes (13): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Notas de implementação (+5 more)

### Community 158 - "ADR 005 — Locale como dimensão (PT-BR / EN): preferência mutável + ficha por idioma"
Cohesion: 0.17
Nodes (12): 1. Contexto, 2.1 Faseamento, 2. Decisão, 3. Decisões-chave e justificativas, 4. Alternativas rejeitadas, 5. Consequências, 6. Implementação (referência), ADR 005 — Locale como dimensão (PT-BR / EN): preferência mutável + ficha por idioma (+4 more)

### Community 159 - "CharacterService"
Cohesion: 0.10
Nodes (14): CharacterController, ApiBearerAuth, ApiBody, ApiOperation, ApiTags, Body, Controller, Get (+6 more)

### Community 160 - "US-113 — Vínculos entre entidades, ancorados em quem os estabeleceu"
Cohesion: 0.14
Nodes (14): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Modelo de dados proposto (+6 more)

### Community 161 - "US-115 — O ledger recolhe a entidade que o Mestre esqueceu de registrar"
Cohesion: 0.14
Nodes (14): A proposta, Contexto e motivação, Critérios de aceite, Escopo, Fase A — medir (dentro do escopo, custo zero), Fase B — agir (dentro do escopo, condicionada), Fora do escopo, História (+6 more)

### Community 162 - "ADR 008 — Pin de roteamento no OpenRouter: o endpoint faz parte do modelo"
Cohesion: 0.25
Nodes (8): 1. Contexto, 2. Decisão, 3. Decisões-chave e justificativas, 4. Alternativas rejeitadas, 5. Consequências, 6. Implementação (referência), 7. Questões em aberto, ADR 008 — Pin de roteamento no OpenRouter: o endpoint faz parte do modelo

### Community 163 - "US-114 — As extrações e o fecho saem do modelo da narração"
Cohesion: 0.14
Nodes (14): A proposta, Consumidores novos: US-149 e US-158 (2026-08-16), Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História (+6 more)

### Community 167 - "2. Decisão"
Cohesion: 0.18
Nodes (11): 1. Contexto, 2. Decisão, 3. Alternativas rejeitadas, 4. Consequências, 5. Próximos passos, ADR 011 — Observabilidade em camadas: convenção antes de infraestrutura, Camada 0 — Formato: JSON estruturado, zero lib, Camada 1 — Correlação: `turnId` por turno (+3 more)

### Community 168 - "ADR 004 — Origem do dado de sistema: ingestão do SRD por pipeline pinado"
Cohesion: 0.17
Nodes (12): 1. Contexto, 2. Decisão, 3.1 Revisão da decisão 6 (02/08/2026): o Free herda o SRD, 3.2 Correção de procedência (03/08/2026): o kit inicial é CC-BY, não OGL, 3.3 Segundo publisher no config (09/08/2026): `a5e-ag` entra sob a mesma regra de licença única, 3.4 Exceção pontual (13/08/2026): `ability` de `Culture`/`Engineering` não vem do Open5e, 3. Decisões-chave e justificativas, 4. A descoberta que só apareceu cutucando o dataset (+4 more)

### Community 169 - "entities.ts"
Cohesion: 0.36
Nodes (8): EdgePatch, EntityPatch, formatEdge(), formatEntities(), mergeEdges(), mergeEntities(), norm(), TIPO_LABEL

### Community 170 - "ability.ts"
Cohesion: 0.32
Nodes (9): abilityModifier(), buildSkillSheet(), formatModifier(), ResolvedSkill, skillModifier(), SRD_TABLE, norm(), normalizeDie() (+1 more)

### Community 171 - "US-117 — `turnId` por turno: correlação de log (ADR 011, Camada 1)"
Cohesion: 0.20
Nodes (10): Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Notas de implementação, Questões em aberto (+2 more)

### Community 172 - "US-138 — Catálogo de raças re-derivado com o SRD 5.1 (2014) como fonte de referência"
Cohesion: 0.14
Nodes (14): Contexto e motivação, Critérios de aceite, Decidido: o 5.2 sai de vez — Goliath e Orc perdem fonte, Dentro do escopo, Escopo, Fora do escopo, História, Modelo de dados proposto (+6 more)

### Community 173 - "US-118 — Sinais de `ai.controller.ts` em JSON estruturado (ADR 011, Camada 2 — Grupo A parte 1)"
Cohesion: 0.22
Nodes (9): Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Notas de implementação, Referências no código (+1 more)

### Community 174 - "US-119 — Sinais de `ai.service.ts` em JSON estruturado (ADR 011, Camada 2 — Grupo A parte 2 + Grupo C)"
Cohesion: 0.22
Nodes (9): Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Notas de implementação, Referências no código (+1 more)

### Community 175 - "US-107 — Sair da criação ou da mesa e voltar ao hub de personagens"
Cohesion: 0.13
Nodes (15): A proposta, Como ficou (04/08/2026), Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História (+7 more)

### Community 176 - "starting-kit.ts"
Cohesion: 0.17
Nodes (16): CharacterFeature, getBackgroundEquipment(), getBackgroundFeatures(), getClassFeatures(), getClassSpells(), getRaceFeatures(), getStartingInventory(), MEMENTO_ITEM_LABEL (+8 more)

### Community 177 - "AuthUser"
Cohesion: 0.20
Nodes (10): AuthGuard, OptionalAuthGuard, Injectable, AuthUser, CurrentUser, payloadToUser(), b64urlToBuffer(), JwtPayload (+2 more)

### Community 178 - "HomeHero.tsx"
Cohesion: 0.19
Nodes (9): AXE_OPTIONS, gameProps, { listCharacters, getTurns, listSystems }, emptyState(), HomeHero(), HubCharacter, { listCharacters, deleteCharacter }, DmButton() (+1 more)

### Community 182 - "US-166 — Motor gera múltiplos encontros (4-5), não só um"
Cohesion: 0.14
Nodes (14): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Modelo de dados proposto (+6 more)

### Community 190 - "US-130 — `Culture`/`Engineering` no catálogo de perícias (`config.skills`)"
Cohesion: 0.15
Nodes (13): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Modelo de dados proposto (+5 more)

### Community 191 - "adventure.service.test.ts"
Cohesion: 0.28
Nodes (7): AdventureProfile, config, fakeAi(), fakePrisma(), Recorded, service(), ADR-0012

### Community 192 - "US-133 — Catálogo de idiomas do sistema (`config.languages`)"
Cohesion: 0.13
Nodes (15): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Investigação (13/08/2026) (+7 more)

### Community 193 - "US-132 — Escolha da ferramenta concedida pelo benefício `tool_proficiency` do background"
Cohesion: 0.10
Nodes (20): 1. Etapa `background` do wizard — aviso E escolha, no mesmo lugar, 2. Etapa `review` do wizard — linha própria no resumo, 3. Ficha do personagem (`GameView`) — bloco próprio, não dentro do `BackgroundPanel`, 4. Prompt do DM Agent — junta a `SKILLS_LINE`, não o `INVENTORY_BLOCK`, A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo (+12 more)

### Community 194 - "US-139 — Catálogo de classes com o SRD 5.1 como referência, e o Marshal do A5E Adventurer's Guide"
Cohesion: 0.13
Nodes (15): A parte barata: o catálogo (`CharacterClass.json`) já bate, A parte nova: `a5e-ag` tem uma 13ª classe, A parte que não é barata: `classFeatures` e `classSpells` são 100% 5.2 hoje, e divergem de verdade, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo (+7 more)

### Community 195 - "US-124 — Exibir os benefícios narrativos da origem (`adventures_and_advancement`, `connection_and_memento`)"
Cohesion: 0.13
Nodes (15): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Modelo de dados proposto (+7 more)

### Community 196 - "US-140 — Catálogo de subespécies (subraças) do SRD 5.1"
Cohesion: 0.13
Nodes (15): Como aparece na criação de personagem, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Modelo de dados proposto (+7 more)

### Community 197 - "US-121 — Catálogo de backgrounds do A5E Adventurer's Guide (Open5e)"
Cohesion: 0.14
Nodes (14): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Modelo de dados proposto (+6 more)

### Community 198 - "US-122 — Escolha de origem (catálogo de background) na criação de personagem"
Cohesion: 0.14
Nodes (14): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Modelo de dados proposto (+6 more)

### Community 199 - "shared/src/index.ts"
Cohesion: 0.17
Nodes (10): createSeededRandom(), deriveAdventureSeed(), isLocale(), Locale, localeLabel(), LOCALES, resolveLocale(), ADR-0005 (+2 more)

### Community 200 - "US-134 — Catálogo de ferramentas e veículos do sistema (`config.tools`)"
Cohesion: 0.13
Nodes (15): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Investigação (13/08/2026) (+7 more)

### Community 201 - "US-142 — Traços mecânicos de subespécie (raça-base + subespécie combinados)"
Cohesion: 0.14
Nodes (14): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Modelo de dados proposto (+6 more)

### Community 202 - "ai-engine/src/index.ts"
Cohesion: 0.32
Nodes (4): overlapRatio(), tokens(), trigrams(), SummaryTurn

### Community 203 - "US-127 — Revisão da criação espelha a ficha completa (kit, features, magias, PV)"
Cohesion: 0.15
Nodes (13): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Modelo de dados proposto (+5 more)

### Community 204 - "Backlog — Economia de recursos do personagem"
Cohesion: 0.17
Nodes (12): A segunda referência, A terceira referência, Backlog — Economia de recursos do personagem, Corte mínimo, Decisões abertas, Depende de, O achado que muda o custo, O que fica de fora deste backlog (+4 more)

### Community 205 - "US-131 — Integração mecânica: perícias do background em `proficiency`"
Cohesion: 0.13
Nodes (15): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Modelo de dados proposto (+7 more)

### Community 206 - "SetupWizard.test.tsx"
Cohesion: 0.24
Nodes (14): configWithAbilityGrant(), configWithBackgroundFeature(), configWithBackgrounds(), configWithBudget(), configWithCam(), configWithClassKit(), configWithRaceSubspecies(), configWithSkillGrant() (+6 more)

### Community 207 - "US-123 — Integração mecânica: bônus de atributo do background em `pointBuy`"
Cohesion: 0.14
Nodes (14): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Modelo de dados proposto (+6 more)

### Community 208 - "parseD10Tables.ts"
Cohesion: 0.29
Nodes (8): check(), SINGLE_BLOCK, SRD, D10Row, D10Table, parseD10Tables(), rowsOf(), signature()

### Community 209 - "Backlog — Combate por turno"
Cohesion: 0.18
Nodes (11): A pergunta de schema que os dois irmãos não tiveram que responder, Backlog — Combate por turno, Corte mínimo, Decisões abertas, Depende de, O estado verificado, O que fica de fora deste backlog, Referências externas (+3 more)

### Community 210 - "Backlog — Classe de armadura e resolução de ataque"
Cohesion: 0.20
Nodes (10): A assimetria que define a ordem, Backlog — Classe de armadura e resolução de ataque, Corte mínimo, Decisões abertas, Depende de, O estado verificado, O que fica de fora deste backlog, Referências externas (+2 more)

### Community 211 - "Backlog — Mapa em tempo real"
Cohesion: 0.22
Nodes (9): Backlog — Mapa em tempo real, Corte mínimo, Decisões abertas, Depende de, O estado verificado, O que fica de fora deste backlog, Referências externas, Referências no código (+1 more)

### Community 212 - "US-159 — Orçamento de encontro do LGMRD (Lazy Encounter Benchmark) para um personagem"
Cohesion: 0.14
Nodes (14): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Modelo de dados proposto (+6 more)

### Community 213 - "ai.service.ts"
Cohesion: 0.05
Nodes (33): AiService, AnchoredRoll, applyInventoryDeltas(), buildClosingPrompt(), buildLocationsAndNpcsPrompt(), buildSecretsPrompt(), ChatInput, CLOSING_SCHEMA (+25 more)

### Community 215 - "US-93 — Três gates baratos: drift de migração, dependência vulnerável e smoke pós-deploy"
Cohesion: 0.15
Nodes (13): Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Já verificado no repo (não é critério de aceite, mas evita remedir), Notas de implementação (+5 more)

### Community 216 - "migrate-race-class-keys.test.ts"
Cohesion: 0.18
Nodes (10): CLASS_SYNONYMS, main(), normalize(), RACE_ALIASES, enUS, ptBR, ADR-0009, toKey() (+2 more)

### Community 217 - "US-135 — Feature de origem (benefício `feature` do background) na criação e na ficha, como as features de classe"
Cohesion: 0.14
Nodes (14): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Modelo de dados proposto (+6 more)

### Community 218 - "int-db.ts"
Cohesion: 0.23
Nodes (10): HOSTS_LOCAIS, makeTestPrisma(), readTestDatabaseUrl(), requireLocalTestDatabaseUrl(), TABELAS_DE_JOGO, apiDir, setup(), DATABASE_URL (+2 more)

### Community 219 - "US-144 — Schema da aventura gerada em `@ai-dm/shared`"
Cohesion: 0.14
Nodes (14): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Modelo de dados proposto (+6 more)

### Community 220 - "US-136 — Tag origem/classe nas features da revisão e da ficha"
Cohesion: 0.14
Nodes (14): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Modelo de dados proposto (+6 more)

### Community 221 - "US-175 — `generateClosing` deixa de receber `hookSeed`; antagonista vive só na `premissa`"
Cohesion: 0.15
Nodes (13): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Notas de implementação (+5 more)

### Community 222 - "US-145 — `sync` pinado do Lazy GM Resource Document + NOTICE gerado"
Cohesion: 0.14
Nodes (14): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Modelo de dados proposto (+6 more)

### Community 223 - "US-146 — Seed determinístico do motor de aventuras"
Cohesion: 0.14
Nodes (14): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Modelo de dados proposto (+6 more)

### Community 224 - "US-147 — Rolagem do motor: registro primeiro, conteúdo depois"
Cohesion: 0.14
Nodes (14): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Modelo de dados proposto (+6 more)

### Community 225 - "US-148 — Perfil do personagem como entrada do motor"
Cohesion: 0.14
Nodes (14): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Modelo de dados proposto (+6 more)

### Community 226 - "US-149 — Segredos pelos 40 prompts do LGMRD"
Cohesion: 0.14
Nodes (14): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Modelo de dados proposto (+6 more)

### Community 227 - "US-150 — Gate antes de persistir a aventura gerada"
Cohesion: 0.13
Nodes (15): A proposta, Achado ao planejar a implementação (2026-08-18), Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História (+7 more)

### Community 228 - "extract-tables.mjs"
Cohesion: 0.24
Nodes (7): DATA_PATH, extractTables(), HERE, main(), OUT_PATH, SECTIONS, FIXTURE

### Community 229 - "US-151 — Semear o ledger com os segredos e NPCs gerados"
Cohesion: 0.12
Nodes (16): A proposta, Achado ao planejar a implementação (2026-08-18, contra o código real da US-164), Achados adicionais, conferidos contra o código real (2026-08-18, antes de codar), Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo (+8 more)

### Community 230 - "US-152 — Statblocks por papel e orçamento de encontro para um personagem"
Cohesion: 0.14
Nodes (14): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Modelo de dados proposto (+6 more)

### Community 231 - "@prisma/client"
Cohesion: 0.67
Nodes (3): @prisma/client, truncateGameTables(), @prisma/client

### Community 232 - "US-153 — A aventura deixa de ser derivada da classe"
Cohesion: 0.13
Nodes (15): A proposta, Achado ao planejar a implementação (2026-08-18, contra o código real da US-164), Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História (+7 more)

### Community 233 - "US-154 — Eval da aventura gerada"
Cohesion: 0.14
Nodes (14): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Modelo de dados proposto (+6 more)

### Community 234 - "US-155 — Aposentar a quest fixa por classe"
Cohesion: 0.14
Nodes (14): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Modelo de dados proposto (+6 more)

### Community 235 - "US-156 — Catálogos de registro (setting/tone/areaType), DTO e validação"
Cohesion: 0.13
Nodes (15): A proposta, Contexto e motivação, Conteúdo dos catálogos, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História (+7 more)

### Community 236 - "US-157 — A tela de mundo, depois da revisão"
Cohesion: 0.13
Nodes (15): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fluxo de criação: `review` → `world` → aventura, Fora do escopo, História (+7 more)

### Community 237 - "US-110-tabela-de-testes-de-habilidade-do-srd-2024.md"
Cohesion: 0.17
Nodes (14): Modificadores de atributo — tabela do SRD 2024, O que cada faixa de pontuação significa (SRD 2024), Onde isto é usado, Regra de cálculo, Tabela de modificadores (SRD 2024), US-34 — Qualidade cinematográfica da narração do AI DM, US-35 — Estado de cena estruturado já na abertura da aventura, US-36 — Eval de qualidade da narração do DM (+6 more)

### Community 238 - "US-143 — ADR: aventura gerada é regenerável ou congelada, e onde ela mora"
Cohesion: 0.15
Nodes (13): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Notas de implementação (+5 more)

### Community 239 - "ADR 012 — Aventura gerada: artefato congelado, seed recomputável, coluna própria"
Cohesion: 0.18
Nodes (11): 1. Contexto, 2. Decisão, 3. Decisões-chave e justificativas, 4. Alternativas rejeitadas, 5. Consequências, 6. Implementação (referência), ADR 012 — Aventura gerada: artefato congelado, seed recomputável, coluna própria, D1 — Artefato grava congelado; `seed` não ganha coluna, é sempre recomputável (+3 more)

### Community 240 - "extract-monster-roles.mjs"
Cohesion: 0.24
Nodes (7): DATA_PATH, extractMonsterRoles(), HERE, main(), OUT_PATH, SUBSECTION_IDS, FIXTURE

### Community 241 - "buildConfig"
Cohesion: 0.21
Nodes (12): buildClasses(), buildClassFeatures(), buildClassSpells(), buildConfig(), buildRaceFeatures(), buildRaces(), buildSkills(), buildTools() (+4 more)

### Community 242 - "US-158 — Locais e NPCs com prosa (camada 2, antes dos segredos)"
Cohesion: 0.14
Nodes (14): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Modelo de dados proposto (+6 more)

### Community 245 - "extract-benchmark.mjs"
Cohesion: 0.24
Nodes (7): DATA_PATH, extractBenchmark(), HERE, main(), OUT_PATH, SUBSECTION_IDS, FIXTURE

### Community 246 - "US-176 — `generateSecrets` recebe `tone` do registro (hoje gerado cego a ele)"
Cohesion: 0.15
Nodes (13): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Notas de implementação (+5 more)

### Community 247 - "translate-srd.ts"
Cohesion: 0.29
Nodes (8): google, translateModel(), DraftsSchema, GlossaryTerm, pickRequested(), SrdEntry, systemPrompt(), translateSrdToPtBr()

### Community 248 - "lazygm/sync.mjs"
Cohesion: 0.36
Nodes (6): buildNotice(), FILES, main(), NOTICE_PATH, OUT, quoteBlock()

### Community 249 - "Atribuição — Lazy GM Resource Document + Lazy GM's 5e Monster Builder"
Cohesion: 0.29
Nodes (6): Atribuição exigida, Atribuição — Lazy GM Resource Document + Lazy GM's 5e Monster Builder, Escopo e limites, Lazy GM Resource Document, Lazy GM's 5e Monster Builder, Licença

### Community 250 - "SystemController"
Cohesion: 0.25
Nodes (6): SystemController, ApiOperation, ApiTags, Controller, Get, UseGuards

### Community 252 - "backlog-aventuras-autorais-lazygm.md"
Cohesion: 0.28
Nodes (7): US-67 — Editar a ação enviada ao DM, US-69 — Guard anti-degeneração da narração, US-71 — Simplificar a localização do personagem, US-73 — Reconciliador de cena em background, US-74 — Guard de turno truncado, US-75 — Dimensões de conhecimento no ledger, US-87 — O prompt para de afirmar que existe um bloco de entidades que o turn-state não emitiu

### Community 253 - "US-102-gate-de-string-literal-no-jsx.md"
Cohesion: 0.20
Nodes (7): US-46 — Acessibilidade da aplicação web (WCAG 2.2 AA), US-66 — Todas as telas mobile-friendly, US-68 — Nomes de fantasia originais, US-83 — README com arquitetura de alto nível, US-86 — Árvore de diretórios na documentação deixa de mentir sobre onde o arquivo está, US-88 — Doc que ordena deixa de citar API que não existe, US-91 — Convenções de Implementação (e o bloco Backend do AGENTS.md) deixam de descrever um projeto que não é este

### Community 254 - "US-160 — Composer de encontro usa o limiar de soma, não só o teto de monstro único"
Cohesion: 0.13
Nodes (15): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Diff pronto (referência de implementação, TDD: aplicar o teste primeiro), Escopo, Fora do escopo, História (+7 more)

### Community 255 - "US-161 — Jogador escolhe o nível de desafio do encontro"
Cohesion: 0.14
Nodes (14): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Modelo de dados proposto (+6 more)

### Community 256 - "US-162 — Jogador escolhe a quantidade de segredos ativos"
Cohesion: 0.14
Nodes (14): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Modelo de dados proposto (+6 more)

### Community 257 - "roll-adventure.ts"
Cohesion: 0.28
Nodes (8): TONES, rollAdventure(), RolledAdventure, RolledAdventureContent, AdventureRegistry, AdventureRegistryOverrides, pickCandidate(), rollRegistry()

### Community 258 - "US-163 — Jogador escolhe o tamanho da aventura (locais e NPCs)"
Cohesion: 0.14
Nodes (14): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Modelo de dados proposto (+6 more)

### Community 259 - "US-164 — Orquestrador do motor: monta o `GeneratedAdventure` e gera o fecho ramificado"
Cohesion: 0.14
Nodes (14): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Modelo de dados proposto (+6 more)

### Community 260 - "US-165 — Tela: jogador escolhe o nível de desafio do encontro"
Cohesion: 0.14
Nodes (14): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Modelo de dados proposto (+6 more)

### Community 263 - "character.schema.ts"
Cohesion: 0.50
Nodes (3): base, CreateCharacterDto, CreateCharacterSchema

### Community 264 - "UserController"
Cohesion: 0.20
Nodes (8): CreateUserSchema, ApiBody, ApiOperation, ApiTags, Body, Controller, Post, UserController

### Community 265 - "adventure-gate.ts"
Cohesion: 0.19
Nodes (16): checkAdventureGraph(), checkEncounterBudget(), checkEncounterReferences(), checkInteractionReferences(), checkNoOrphanLocations(), checkNoOrphanNpcs(), checkNoOrphans(), checkOccupantReferences() (+8 more)

### Community 267 - "layout.tsx"
Cohesion: 0.19
Nodes (13): activeLocale(), cinzel, geist, generateMetadata(), RootLayout(), viewport, LoginPage(), AuthNav() (+5 more)

### Community 268 - "US-167 — Motor consome o `challenge` escolhido pelo jogador na geração real"
Cohesion: 0.14
Nodes (14): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Modelo de dados proposto (+6 more)

### Community 271 - "adventure.service.ts"
Cohesion: 0.21
Nodes (8): CreateAdventureDto, ADR-0012, GateResult, findOccupiedLocationTitle(), seedLedgerFromGeneratedAdventure(), resolveHookTemplate(), resolveInitialHook(), ADR-0002

### Community 273 - "monster-roles.ts"
Cohesion: 0.29
Nodes (9): encounterDeadlyThreshold(), singleMonsterCrCap(), buildEncounterNpcs(), composeEncounterRoles(), EncounterChallenge, MONSTER_ROLE_CR, MonsterRole, ROLES_BY_IMPACT (+1 more)

### Community 275 - "US-168 — Abertura narrada expande o gancho fixo, não a aventura gerada"
Cohesion: 0.15
Nodes (13): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Notas de implementação (+5 more)

### Community 276 - "011-observabilidade-em-camadas.md"
Cohesion: 0.12
Nodes (11): US-89 — Export que ninguém importa para de sobreviver no repo, Diagrama de entidades (núcleo), Modelo de Dados — AI Dungeon Master, Notas de design, Índices e constraints principais, Antes de abrir PR, Antes de merge para main, Checklist de Deploy — AI Dungeon Master (+3 more)

### Community 277 - "us-154-eval-aventura-gerada.ts"
Cohesion: 0.38
Nodes (5): adventure, block(), MONSTER_NPC_IDS, seedEntities(), sheet

### Community 278 - "character.service.test.ts"
Cohesion: 0.25
Nodes (4): catalogEn, catalogPt, config, systemRow

### Community 279 - "sheet.test.ts"
Cohesion: 0.29
Nodes (6): featuresEn, featuresPtBr, spellsEn, spellsPtBr, SystemClassFeature, SystemSpell

### Community 281 - "US-173 — Registro da aventura fica só com `tone`; `settings` e `areaTypes` saem do catálogo"
Cohesion: 0.14
Nodes (14): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Modelo de dados proposto (+6 more)

### Community 282 - "Repositórios de referência — registro e regra de uso"
Cohesion: 0.33
Nodes (6): A regra em cinco linhas, Como citar numa US, ADR ou backlog, Portão de licença, Quando re-triar, Registro, Repositórios de referência — registro e regra de uso

### Community 283 - "US-169 — Quest gerada ganha objetivo concreto e o Mestre passa a poder concluí-la"
Cohesion: 0.15
Nodes (13): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Notas de implementação (+5 more)

### Community 284 - "US-170 — Locais gerados entram no ledger e chegam ao Mestre"
Cohesion: 0.15
Nodes (13): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Notas de implementação (+5 more)

### Community 285 - "US-171 — Encontros de combate entram no ledger e chegam ao Mestre"
Cohesion: 0.15
Nodes (13): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Notas de implementação (+5 more)

### Community 286 - "US-172 — Abertura gerada deixa de copiar o gancho fixo, passa a ser escrita para o tom sorteado"
Cohesion: 0.15
Nodes (13): A proposta, Contexto e motivação, Critérios de aceite, Decisões (questões em aberto resolvidas), Dentro do escopo, Escopo, Fora do escopo, História (+5 more)

## Knowledge Gaps
- **1906 isolated node(s):** `config`, `Recorded`, `ADR-0012`, `CreateAdventureDto`, `ADR-0002` (+1901 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **53 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `SystemConfigSchema` connect `system.ts` to `buildConfig`, `CharacterService`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Why does `ADR-0005` connect `dm-system.ts` to `ingest.mjs`, `seed.ts`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Why does `US-47 — Ingestão do SRD 5e (2024) como dado do sistema` connect `US-105-raca-e-classe-por-chave-do-srd.md` to `US-02 — Inventário do personagem e equipamento inicial`, `US-110-tabela-de-testes-de-habilidade-do-srd-2024.md`, `backlog-motor-de-geracao-de-aventuras.md`, `backlog-aventuras-autorais-lazygm.md`, `US-102-gate-de-string-literal-no-jsx.md`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **What connects `config`, `Recorded`, `ADR-0012` to the rest of the system?**
  _1906 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `ingest.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.08412698412698413 - nodes in this community are weakly interconnected._
- **Should `dm-system.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.10256410256410256 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.043478260869565216 - nodes in this community are weakly interconnected._