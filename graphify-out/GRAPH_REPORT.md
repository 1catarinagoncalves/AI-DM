# Graph Report - .  (2026-07-28)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 1336 nodes · 1645 edges · 146 communities (98 shown, 48 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.64)
- Token cost: 197,484 input · 2,642 output

## Graph Freshness
- Built from commit: `da6ff404`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Character Controller & Auth
- Entity Merging & ADR Docs
- Web App Dependencies
- Ability Scores & Narration Utils
- System Config Schema
- Location Bake-off Script
- Bake-off Runner Script
- Root Layout & Theme
- Narrative Bake-off Test Fixtures
- Judge Rubric Logic
- Doc Link Checker Script
- US-36 Eval Cases
- Prompt A/B Bake-off Script
- Onomastics Bake-off Script
- NestJS App Modules
- AI Service & Controller
- GameView Frontend Component
- API Package Dependencies (Runtime)
- Auth Service & Prisma
- Kanban Server Script
- Character Setup Wizard
- DnD5e Seed Data
- System Controller/Module
- Auth Guard & Controllers
- Adventure Controller/Service
- User Controller
- Home Page & Hero
- Root Scripts Config
- Guardrails & Slop Detection
- API Package Dependencies
- Shared Package Config
- US-11b Scene State Spec
- Character/Adventure Service Logic
- AI Engine Dependencies
- User Story Template
- Test Strategy Doc
- Web TSConfig
- Rubric Quality Gate Tests
- AI Engine TSConfig
- Shared Package TSConfig
- Root TSConfig
- PRD Doc
- Auth Controller
- Web Auth Providers/API Client
- Docs Meta (AGENTS/CLAUDE/README)
- API Build TSConfig
- US-01 Attributes Spec
- System Catalog User Stories
- Seraphine Reference Adventure
- Doc Link Checker Tests
- Acceptance Criteria Doc
- API Contracts Doc
- Deploy Infra User Stories
- Nest CLI Config
- API TSConfig/Prisma
- SRD Ingestion User Stories
- Docs Vault/CI User Stories
- Character Service Tests
- Character Service
- Character/Adventure Controllers & Schemas
- NextAuth Type Defs
- TTFT Benchmark Test
- MCP Setup Script (PS)
- MCP Setup Script (sh)
- NextAuth Route & Middleware
- Deploy Checklist Doc
- Chat Route & Play Page
- Bake-off README
- Narration Quality User Stories
- Spells Seed Data
- README Shape Test
- Sync Script
- Kanban File Actions
- Vercel Config
- Prompt Layers ADR/US
- Character Identity User Stories
- ADR 004/005 Docs
- Paladin Features Seed
- Adventure Service Tests
- Data Model Doc
- DM Prompt Rules Doc
- Next.js Config
- Next Env Types
- PostCSS Config
- Hub/Delete User Stories
- Kanban Board User Stories
- Prompt Caching User Stories
- Narration Guard User Stories
- Prompt Anchors Convention
- Dead Export Cleanup Story
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
- US-38 Sheet-Anchored Rolls
- US-45 Character Background
- ADR 006 Deploy Doc
- US-50 Character Spells
- US-53 Prisma Config Migration
- US-57 Server Warm-up
- US-65 Google Login Prod Setup
- US-67 Edit Sent Action
- US-68 Fantasy Name Generation
- US-70 Eval Dimension Floors
- US-71 Character Location Simplification
- US-72 Rewrite-Resistant Evals
- US-73 Background Scene Reconciler
- US-75 Knowledge Ledger Dimensions
- US-76 US-75 Test Fake Fix
- US-87 Entity Block Prompt Fix
- Default Model Config
- Summary Model Config
- Kanban User Stories

## God Nodes (most connected - your core abstractions)
1. `PrismaService` - 31 edges
2. `AiService` - 22 edges
3. `AuthUser` - 18 edges
4. `CurrentUser` - 14 edges
5. `scripts` - 14 edges
6. `CharacterController` - 13 edges
7. `CharacterService` - 13 edges
8. `AdventureService` - 12 edges
9. `AdventureController` - 11 edges
10. `compilerOptions` - 11 edges

## Surprising Connections (you probably didn't know these)
- `main()` --references--> `SystemConfigSchema`  [EXTRACTED]
  scripts/srd/ingest.mjs → packages/shared/src/types/system.ts
- `US-77 — Reancorar as assertivas de prompt restantes` --references--> `Prompt Anchors Convention`  [EXTRACTED]
  docs/sdlc/01-requisitos/US-77-reancorar-assertivas-de-prompt-e-guard-de-regressao.md → evals/PROMPT-ANCHORS.md
- `POST()` --calls--> `apiAuthHeader()`  [EXTRACTED]
  apps/web/src/app/api/chat/route.ts → apps/web/src/lib/server-auth.ts
- `PlayPage()` --calls--> `apiAuthHeader()`  [EXTRACTED]
  apps/web/src/app/play/[adventureId]/page.tsx → apps/web/src/lib/server-auth.ts
- `runTurn()` --calls--> `resolveModel()`  [EXTRACTED]
  packages/ai-engine/src/narrative-bakeoff.test.ts → packages/ai-engine/src/model.ts

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

## Communities (146 total, 48 thin omitted)

### Community 0 - "Character Controller & Auth"
Cohesion: 0.17
Nodes (14): AuthUser, CurrentUser, CharacterController, ApiBearerAuth, ApiBody, ApiOperation, ApiTags, Body (+6 more)

### Community 1 - "Entity Merging & ADR Docs"
Cohesion: 0.06
Nodes (41): ADR-0007, EntityPatch, formatEntities(), mergeEntities(), norm(), TIPO_LABEL, fallbackModel, google (+33 more)

### Community 2 - "Web App Dependencies"
Cohesion: 0.04
Nodes (47): @ai-sdk/react, dependencies, ai, @ai-dm/shared, @ai-sdk/react, jose, next, next-auth (+39 more)

### Community 3 - "Ability Scores & Narration Utils"
Cohesion: 0.08
Nodes (30): abilityModifier(), buildSkillSheet(), formatModifier(), ResolvedSkill, skillModifier(), detectDegeneration(), formatDiceBreakdown(), hasOptionsList() (+22 more)

### Community 4 - "System Config Schema"
Cohesion: 0.07
Nodes (31): buildCharacterAttributesSchema(), InitialAdventureHook, InitialAdventureHookSchema, StartingKitItemSchema, SystemAttribute, SystemAttributeSchema, SystemClassFeature, SystemClassFeatureSchema (+23 more)

### Community 5 - "Location Bake-off Script"
Cohesion: 0.07
Nodes (25): system, turnState, ARMS, body, dir, EXEMPLAR, genOnce(), judge (+17 more)

### Community 6 - "Bake-off Runner Script"
Cohesion: 0.07
Nodes (26): accum, CHARACTER, COHERENCE_TURN_STATE, DEFAULT_MODELS, dir, EX, genTurn(), guardrailHits (+18 more)

### Community 7 - "Root Layout & Theme"
Cohesion: 0.27
Nodes (5): metadata, viewport, AuthNav(), ThemeProvider(), ThemeToggle()

### Community 8 - "Narrative Bake-off Test Fixtures"
Cohesion: 0.09
Nodes (23): AMNESIA_ENTITIES, AMNESIA_TURN_STATE, CHARACTER, COHERENCE_TURN_STATE, DEFAULT_MODELS, EX_AMNESIA, EX_COHERENCE, EX_COMBAT (+15 more)

### Community 9 - "Judge Rubric Logic"
Cohesion: 0.10
Nodes (24): aggregateReps(), batchItemSchema, batchSchema, buildBatchPrompt(), buildJudgePrompt(), Dimension, dimScore, fmt() (+16 more)

### Community 10 - "Doc Link Checker Script"
Cohesion: 0.09
Nodes (18): argv, buckets, DOCS, exemptLinked, fixed, GHOST_ALLOW, ghostHits, ghostStale (+10 more)

### Community 11 - "US-36 Eval Cases"
Cohesion: 0.09
Nodes (20): ANCHOR_SET, AnchorItem, Case, CASES, CHARACTER, EN_CHARACTER, EN_SYSTEM, EX_CHILD (+12 more)

### Community 12 - "Prompt A/B Bake-off Script"
Cohesion: 0.09
Nodes (17): body, CHARACTER, dir, EXEMPLAR, judge, log(), MODEL, PACE_MS (+9 more)

### Community 13 - "Onomastics Bake-off Script"
Cohesion: 0.11
Nodes (15): body, CHARACTER, dir, EXEMPLAR, judge, log(), MODELS, PACE_MS (+7 more)

### Community 14 - "NestJS App Modules"
Cohesion: 0.16
Nodes (12): AdventureModule, Module, AiModule, Module, AppModule, Module, AuthModule, Module (+4 more)

### Community 15 - "AI Service & Controller"
Cohesion: 0.06
Nodes (29): AiController, ChatBodySchema, ApiBearerAuth, ApiBody, ApiOperation, ApiTags, Body, Controller (+21 more)

### Community 16 - "GameView Frontend Component"
Cohesion: 0.14
Nodes (15): ATTR_LABELS, CharacterBackground, ClassFeature, GameView(), historyKey(), InventoryItem, loadHistory(), Message (+7 more)

### Community 17 - "API Package Dependencies (Runtime)"
Cohesion: 0.07
Nodes (29): @ai-dm/ai-engine, dependencies, ai, @ai-dm/ai-engine, @ai-dm/shared, @nestjs/common, @nestjs/core, @nestjs/platform-express (+21 more)

### Community 18 - "Auth Service & Prisma"
Cohesion: 0.20
Nodes (7): AuthService, A, C, U, Injectable, PrismaService, Injectable

### Community 19 - "Kanban Server Script"
Cohesion: 0.17
Nodes (15): abrirArquivo(), acharArquivo(), campo(), CANONICO, { execFile }, fs, gravarStatus(), HTML_FILE (+7 more)

### Community 20 - "Character Setup Wizard"
Cohesion: 0.13
Nodes (14): CLASSES, GENDERS, parseDeity(), POINT_COST, RACES, SetupWizard(), SOURCE_TYPE_HINT, Step (+6 more)

### Community 21 - "DnD5e Seed Data"
Cohesion: 0.13
Nodes (13): CANTRIP_CATALOG, CANTRIP_CLASSES, dnd5eConfig, dnd5eInitialAdventures, dnd5eKits, dnd5eProficiency, freeAttributes, freeClassFeatures (+5 more)

### Community 22 - "System Controller/Module"
Cohesion: 0.17
Nodes (9): SystemController, ApiOperation, ApiTags, Controller, Get, SystemModule, Module, SystemService (+1 more)

### Community 23 - "Auth Guard & Controllers"
Cohesion: 0.21
Nodes (6): AuthGuard, Injectable, payloadToUser(), b64urlToBuffer(), JwtPayload, verifyJwt()

### Community 24 - "Adventure Controller/Service"
Cohesion: 0.13
Nodes (14): AdventureController, CreateAdventureSchema, ApiBearerAuth, ApiBody, ApiOperation, ApiTags, Body, Controller (+6 more)

### Community 25 - "User Controller"
Cohesion: 0.16
Nodes (10): CreateUserSchema, ApiBody, ApiOperation, ApiTags, Body, Controller, Post, UserController (+2 more)

### Community 26 - "Home Page & Hero"
Cohesion: 0.18
Nodes (7): AXE_OPTIONS, gameProps, { listCharacters, getTurns, listSystems }, HomeHero(), HubCharacter, { listCharacters, deleteCharacter }, api

### Community 27 - "Root Scripts Config"
Cohesion: 0.09
Nodes (22): dotenv-cli, devDependencies, dotenv-cli, typescript, typescript, name, packageManager, private (+14 more)

### Community 28 - "Guardrails & Slop Detection"
Cohesion: 0.25
Nodes (12): checkNoSelfRoll(), DENIAL_PATTERNS, detectCanonDenial(), detectInventedRoll(), detectLanguageDrift(), detectReasoningLeak(), detectSlopName(), GuardrailResult (+4 more)

### Community 29 - "API Package Dependencies"
Cohesion: 0.06
Nodes (30): devDependencies, @nestjs/cli, @nestjs/testing, prisma, ts-node, @types/express, @types/pg, typescript (+22 more)

### Community 30 - "Shared Package Config"
Cohesion: 0.11
Nodes (17): dependencies, zod, devDependencies, typescript, vitest, typescript, vitest, zod (+9 more)

### Community 31 - "US-11b Scene State Spec"
Cohesion: 0.12
Nodes (16): A proposta, Como o `sceneState` é alimentado (determinístico), Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História (+8 more)

### Community 32 - "Character/Adventure Service Logic"
Cohesion: 0.25
Nodes (11): CreateAdventureDto, CLASS_SYNONYMS, getClassFeatures(), getClassSpells(), getStartingInventory(), normalize(), resolveHookTemplate(), resolveInitialHook() (+3 more)

### Community 33 - "AI Engine Dependencies"
Cohesion: 0.06
Nodes (30): @ai-sdk/google, @ai-sdk/groq, @ai-sdk/openai-compatible, dependencies, ai, @ai-dm/shared, @ai-sdk/google, @ai-sdk/groq (+22 more)

### Community 34 - "User Story Template"
Cohesion: 0.13
Nodes (14): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Modelo de dados proposto (+6 more)

### Community 35 - "Test Strategy Doc"
Cohesion: 0.15
Nodes (12): 1. Testes unitários (apps/api, packages/ai-engine), 2. Testes de integração (apps/api), 3. Testes de componente (apps/web), 4. Evals do DM Agent (evals/), Camadas de teste, Estratégia de Testes e Evals — AI Dungeon Master, Estrutura de um eval case (evals/cases/), Flywheel de qualidade (após MVP) (+4 more)

### Community 36 - "Web TSConfig"
Cohesion: 0.09
Nodes (22): compilerOptions, allowJs, incremental, isolatedModules, jsx, lib, module, moduleResolution (+14 more)

### Community 37 - "Rubric Quality Gate Tests"
Cohesion: 0.22
Nodes (7): DIMENSION_FLOORS, DIMENSIONS, estimateCost(), gateQuality(), dims(), perDim(), WEIGHTS

### Community 38 - "AI Engine TSConfig"
Cohesion: 0.18
Nodes (10): compilerOptions, declaration, declarationMap, module, moduleResolution, outDir, extends, include (+2 more)

### Community 39 - "Shared Package TSConfig"
Cohesion: 0.18
Nodes (10): compilerOptions, declaration, declarationMap, module, moduleResolution, outDir, extends, include (+2 more)

### Community 40 - "Root TSConfig"
Cohesion: 0.20
Nodes (9): compilerOptions, esModuleInterop, module, moduleResolution, noUncheckedIndexedAccess, resolveJsonModule, skipLibCheck, strict (+1 more)

### Community 41 - "PRD Doc"
Cohesion: 0.18
Nodes (10): 1. Declaração do problema, 2. Objetivos e critério de aceite, 3. Usuários alvo, 4.1 Personagens e campanhas, 4.2 Multiplayer, 4.3 Sistemas e aventuras, 4. Casos de uso, 5. Fora do escopo (v1) (+2 more)

### Community 42 - "Auth Controller"
Cohesion: 0.22
Nodes (7): AuthController, ApiBearerAuth, ApiOperation, ApiTags, Controller, Post, UseGuards

### Community 43 - "Web Auth Providers/API Client"
Cohesion: 0.36
Nodes (7): AuthTokenBridge(), Providers(), authHeaders(), del(), get(), post(), setAuthToken()

### Community 44 - "Docs Meta (AGENTS/CLAUDE/README)"
Cohesion: 0.25
Nodes (4): US-83 — README com arquitetura de alto nível, US-86 — Árvore de diretórios na documentação deixa de mentir sobre onde o arquivo está, US-88 — Doc que ordena deixa de citar API que não existe, US-91 — Convenções de Implementação (e o bloco Backend do AGENTS.md) deixam de descrever um projeto que não é este

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

### Community 51 - "API Contracts Doc"
Cohesion: 0.20
Nodes (9): Aventuras e missões, Contratos de API — AI Dungeon Master, Convenções, DM Agent (streaming), Endpoints principais (Fase 1 — MVP), Eventos WebSocket (Fase 4 — Multiplayer), Personagens, Sistemas (+1 more)

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

### Community 58 - "Character Service"
Cohesion: 0.31
Nodes (3): CreateCharacterDto, CharacterService, Injectable

### Community 59 - "Character/Adventure Controllers & Schemas"
Cohesion: 0.39
Nodes (3): base, CreateCharacterSchema, zodBody()

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

### Community 64 - "NextAuth Route & Middleware"
Cohesion: 0.29
Nodes (5): { handlers, auth, signIn, signOut }, secretKey(), signApiToken(), config, ADR-0006

### Community 65 - "Deploy Checklist Doc"
Cohesion: 0.25
Nodes (7): Antes de abrir PR, Antes de merge para main, Checklist de Deploy — AI Dungeon Master, Deploy para produção, Deploy para staging, Guardrails automáticos (Harness), Observability em produção

### Community 66 - "Chat Route & Play Page"
Cohesion: 0.48
Nodes (4): POST(), PlayPage(), Props, apiAuthHeader()

### Community 67 - "Bake-off README"
Cohesion: 0.33
Nodes (5): Bake-off narrativo (US-17) — como rodar, Notas, Pré-requisitos, Rodar (PowerShell), Variáveis

### Community 68 - "Narration Quality User Stories"
Cohesion: 0.50
Nodes (4): US-34 — Qualidade cinematográfica da narração do AI DM, US-35 — Estado de cena estruturado já na abertura da aventura, US-36 — Eval de qualidade da narração do DM, US-37 — Nível cinematográfico mantido em todos os turnos

### Community 69 - "Spells Seed Data"
Cohesion: 0.50
Nodes (3): base, clerigoSpells, paladinoSpells

### Community 70 - "README Shape Test"
Cohesion: 0.67
Nodes (3): entries(), ROOT, shape()

### Community 74 - "Prompt Layers ADR/US"
Cohesion: 1.00
Nodes (3): ADR 007 — Camadas do prompt por volatilidade, US-84 — Nomes de bloco do turn-state compartilhados, US-85 — A fronteira entre as camadas do prompt

### Community 75 - "Character Identity User Stories"
Cohesion: 0.67
Nodes (3): US-39 — Identidade narrativa do personagem, US-40 — Divindade / patrono do personagem, US-43 — Calibração do peso dos traços de identidade

### Community 76 - "ADR 004/005 Docs"
Cohesion: 0.05
Nodes (36): 1. Contexto, 2. Decisão, 3. Decisões-chave e justificativas, 4. A descoberta que só apareceu cutucando o dataset, 5. Alternativas rejeitadas, 6. Consequências, 7. Implementação (referência), ADR 004 — Origem do dado de sistema: ingestão do SRD por pipeline pinado (+28 more)

### Community 79 - "Data Model Doc"
Cohesion: 0.40
Nodes (4): Diagrama de entidades (núcleo), Modelo de Dados — AI Dungeon Master, Notas de design, Índices e constraints principais

### Community 80 - "DM Prompt Rules Doc"
Cohesion: 0.50
Nodes (3): ⚠️ REGRA ABSOLUTA - NUNCA confunda opções com diálogo:, ⚠️ REGRA DE CONSISTÊNCIA NARRATIVA (CRÍTICO):, REGRAS RÍGIDAS DE FORMATAÇÃO DE TEXTO (OBRIGATÓRIO):

### Community 114 - "ADR 006 Deploy Doc"
Cohesion: 0.06
Nodes (30): 1. Contexto, 2.1 Topologia, 2. Decisão, 3. Decisões-chave e justificativas, 4. Alternativas rejeitadas, 5. Consequências, 6. Implementação (referência), ADR 006 — Deploy a custo zero (Fase 1) (+22 more)

## Knowledge Gaps
- **651 isolated node(s):** `$schema`, `collection`, `sourceRoot`, `deleteOutDir`, `name` (+646 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **48 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `SystemConfigSchema` connect `System Config Schema` to `Adventure Controller/Service`, `Character Service`, `AI Service & Controller`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **Why does `PrismaService` connect `Auth Service & Prisma` to `Character/Adventure Service Logic`, `Adventure Service Tests`, `NestJS App Modules`, `AI Service & Controller`, `System Controller/Module`, `Adventure Controller/Service`, `Character Service Tests`, `Character Service`, `User Controller`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **Why does `AiService` connect `AI Service & Controller` to `Character/Adventure Service Logic`, `NestJS App Modules`, `Adventure Service Tests`, `Auth Guard & Controllers`, `Adventure Controller/Service`?**
  _High betweenness centrality (0.005) - this node is a cross-community bridge._
- **What connects `$schema`, `collection`, `sourceRoot` to the rest of the system?**
  _651 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Entity Merging & ADR Docs` be split into smaller, more focused modules?**
  _Cohesion score 0.05656565656565657 - nodes in this community are weakly interconnected._
- **Should `Web App Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.041666666666666664 - nodes in this community are weakly interconnected._
- **Should `Ability Scores & Narration Utils` be split into smaller, more focused modules?**
  _Cohesion score 0.07926829268292683 - nodes in this community are weakly interconnected._