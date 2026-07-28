# Graph Report - .  (2026-07-28)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 1137 nodes · 1470 edges · 148 communities (88 shown, 60 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.64)
- Token cost: 253,167 input · 2,625 output

## Graph Freshness
- Built from commit: `0ce511ad`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Adventure & Character Controllers
- World Entities & Model Fallback
- Web App Dependencies
- Ability & Skill Modifiers
- System Config Schemas
- Location Bake-off Script
- Narrative Bake-off Runner
- Auth Routes & Play Page
- Narrative Bake-off Test Cases
- Eval Rubric & Judge Prompt
- Doc Link Checker
- Narração Quality Eval Cases
- Prompt A/B Bake-off
- Onomastics Bake-off
- NestJS App Modules
- AI Chat Service & Controller
- Game View UI
- API Dependencies
- Auth Service & Prisma
- Kanban Server Script
- Character Setup Wizard
- DB Seed Data
- System Controller/Service
- Web Dev Dependencies
- Adventure Service Logic
- User Controller
- Home Page & Hero
- Root Package Scripts
- Narration Guardrails
- API Dev Dependencies
- Shared Package Config
- Dice Service & AI Tests
- Character Class Data
- AI Engine Package Config
- API Package Scripts
- AI Service Turn State
- Web TS Compiler Options
- Eval Rubric Dimensions
- AI Engine TS Config
- Shared TS Config
- Root TS Config
- AI Controller Tests
- Auth Controller
- Web Providers & API Client
- Project Docs & Conventions
- Prisma Config
- Web TS Config
- System & Character US Stories
- Root Package Metadata
- Doc Link Checker Tests
- TS/Vitest Dev Deps
- Node/TS Dev Deps
- Deploy Infra US Stories
- Nest CLI Config
- Nest TS Compiler Options
- SRD Ingestion US Stories
- Docs & CI Hygiene US Stories
- Character Service Tests
- API TS Config
- Setup Wizard Tests
- NextAuth Type Defs
- TTFT Benchmark Test
- MCP Setup PowerShell
- MCP Setup Shell Script
- API Package Metadata
- Web Lib Compiler Options
- Obsidian App Config
- Narration Quality US Stories
- Spell Data by Class
- README Shape Test
- Sync Script
- Kanban File Actions
- Vercel Deploy Config
- Prompt Layering ADR/US
- Character Identity US Stories
- Class Features/Spells US Stories
- Class Features Data
- Nest Express Platform Dep
- Nest Core Dep
- Prisma Client Dep
- Reflect Metadata Dep
- Zod-to-JSON-Schema Dep
- Next.js Config
- Next Env Type Defs
- PostCSS Config
- Hub & Character Deletion US Stories
- Kanban Board US Stories
- Prompt Caching US Stories
- Anti-Degeneration Guard US Stories
- Prompt Anchors Convention
- Dead Export Cleanup US Story
- Evals README US Story
- Scene State Test Fixture
- Character Sheet Test Fixture
- Deity Test Fixture
- ADR 001 Architecture
- ADR 002 Session Memory
- ADR 003 Systems as Data
- Prompt Layer Architecture
- GET/POST Route Handlers
- Open5e API Source
- SRD 5.2 Reference
- Narration Model Bake-off
- Turn History API
- Character Sheet Sync API
- Fictional Roll Sanitization
- Rolls Anchored to Sheet
- Character Background Display
- Web Accessibility WCAG
- Spells on Character Sheet
- Prisma Config Migration
- Server Warm-up on Entry
- Google Login Production Setup
- Mobile-Friendly Screens
- Editable DM Action
- Original Fantasy Names
- Eval Dimension Floors
- Character Locale Simplification
- Rewrite-Resistant Prompt Evals
- Background Scene Reconciler
- Knowledge Dimensions Ledger
- Ledger Test Fake Fix
- Entity Block Prompt Fix
- Default Model Config
- Summary Model Config
- Spell Lookup Tool
- Entity Recording Tool
- Dice Roll Tool
- HP Update Tool
- Inventory Update Tool
- Scene Update Tool
- User Story Kanban

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
- `exclude` --extends--> `node_modules`  [EXTRACTED]
  apps/api/tsconfig.build.json → apps/web/tsconfig.json
- `main()` --references--> `SystemConfigSchema`  [EXTRACTED]
  scripts/srd/ingest.mjs → packages/shared/src/types/system.ts
- `US-77 — Reancorar as assertivas de prompt restantes` --references--> `Prompt Anchors Convention`  [EXTRACTED]
  docs/sdlc/01-requisitos/US-77-reancorar-assertivas-de-prompt-e-guard-de-regressao.md → evals/PROMPT-ANCHORS.md
- `exclude` --extends--> `prisma.config.ts`  [EXTRACTED]
  apps/api/tsconfig.build.json → apps/api/tsconfig.json
- `POST()` --calls--> `apiAuthHeader()`  [EXTRACTED]
  apps/web/src/app/api/chat/route.ts → apps/web/src/lib/server-auth.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **DM Agent Tools** — tool_rolldice, tool_updatescene, tool_updatecharacterhp, tool_updateinventory, tool_recordentity, tool_getspell [EXTRACTED 1.00]
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

## Communities (148 total, 60 thin omitted)

### Community 0 - "Adventure & Character Controllers"
Cohesion: 0.06
Nodes (38): AdventureController, CreateAdventureSchema, ApiBearerAuth, ApiBody, ApiOperation, ApiTags, Body, Controller (+30 more)

### Community 1 - "World Entities & Model Fallback"
Cohesion: 0.06
Nodes (41): ADR-0007, EntityPatch, formatEntities(), mergeEntities(), norm(), TIPO_LABEL, fallbackModel, google (+33 more)

### Community 2 - "Web App Dependencies"
Cohesion: 0.05
Nodes (41): @ai-sdk/google, @ai-sdk/groq, @ai-sdk/openai-compatible, @ai-sdk/react, @ai-dm/shared, @ai-dm/shared, dependencies, ai (+33 more)

### Community 3 - "Ability & Skill Modifiers"
Cohesion: 0.08
Nodes (30): abilityModifier(), buildSkillSheet(), formatModifier(), ResolvedSkill, skillModifier(), detectDegeneration(), formatDiceBreakdown(), hasOptionsList() (+22 more)

### Community 4 - "System Config Schemas"
Cohesion: 0.07
Nodes (31): buildCharacterAttributesSchema(), InitialAdventureHook, InitialAdventureHookSchema, StartingKitItemSchema, SystemAttribute, SystemAttributeSchema, SystemClassFeature, SystemClassFeatureSchema (+23 more)

### Community 5 - "Location Bake-off Script"
Cohesion: 0.07
Nodes (25): system, turnState, ARMS, body, dir, EXEMPLAR, genOnce(), judge (+17 more)

### Community 6 - "Narrative Bake-off Runner"
Cohesion: 0.07
Nodes (26): accum, CHARACTER, COHERENCE_TURN_STATE, DEFAULT_MODELS, dir, EX, genTurn(), guardrailHits (+18 more)

### Community 7 - "Auth Routes & Play Page"
Cohesion: 0.11
Nodes (14): POST(), metadata, viewport, PlayPage(), Props, { handlers, auth, signIn, signOut }, secretKey(), signApiToken() (+6 more)

### Community 8 - "Narrative Bake-off Test Cases"
Cohesion: 0.09
Nodes (23): AMNESIA_ENTITIES, AMNESIA_TURN_STATE, CHARACTER, COHERENCE_TURN_STATE, DEFAULT_MODELS, EX_AMNESIA, EX_COHERENCE, EX_COMBAT (+15 more)

### Community 9 - "Eval Rubric & Judge Prompt"
Cohesion: 0.10
Nodes (24): aggregateReps(), batchItemSchema, batchSchema, buildBatchPrompt(), buildJudgePrompt(), Dimension, dimScore, fmt() (+16 more)

### Community 10 - "Doc Link Checker"
Cohesion: 0.09
Nodes (18): argv, buckets, DOCS, exemptLinked, fixed, GHOST_ALLOW, ghostHits, ghostStale (+10 more)

### Community 11 - "Narração Quality Eval Cases"
Cohesion: 0.09
Nodes (20): ANCHOR_SET, AnchorItem, Case, CASES, CHARACTER, EN_CHARACTER, EN_SYSTEM, EX_CHILD (+12 more)

### Community 12 - "Prompt A/B Bake-off"
Cohesion: 0.09
Nodes (17): body, CHARACTER, dir, EXEMPLAR, judge, log(), MODEL, PACE_MS (+9 more)

### Community 13 - "Onomastics Bake-off"
Cohesion: 0.11
Nodes (15): body, CHARACTER, dir, EXEMPLAR, judge, log(), MODELS, PACE_MS (+7 more)

### Community 14 - "NestJS App Modules"
Cohesion: 0.16
Nodes (12): AdventureModule, Module, AiModule, Module, AppModule, Module, AuthModule, Module (+4 more)

### Community 15 - "AI Chat Service & Controller"
Cohesion: 0.16
Nodes (9): ChatBodySchema, ApiBody, ApiOperation, Body, Post, AiService, Injectable, HttpCode (+1 more)

### Community 16 - "Game View UI"
Cohesion: 0.15
Nodes (14): ATTR_LABELS, CharacterBackground, ClassFeature, GameView(), historyKey(), InventoryItem, loadHistory(), Message (+6 more)

### Community 17 - "API Dependencies"
Cohesion: 0.12
Nodes (17): @ai-dm/ai-engine, dependencies, ai, @ai-dm/ai-engine, @nestjs/common, @nestjs/swagger, pg, @prisma/adapter-pg (+9 more)

### Community 18 - "Auth Service & Prisma"
Cohesion: 0.18
Nodes (7): AuthService, A, C, U, Injectable, PrismaService, Injectable

### Community 19 - "Kanban Server Script"
Cohesion: 0.17
Nodes (15): abrirArquivo(), acharArquivo(), campo(), CANONICO, { execFile }, fs, gravarStatus(), HTML_FILE (+7 more)

### Community 20 - "Character Setup Wizard"
Cohesion: 0.16
Nodes (12): { listSystems, getTurns }, CLASSES, GENDERS, parseDeity(), POINT_COST, RACES, SetupWizard(), SOURCE_TYPE_HINT (+4 more)

### Community 21 - "DB Seed Data"
Cohesion: 0.13
Nodes (13): CANTRIP_CATALOG, CANTRIP_CLASSES, dnd5eConfig, dnd5eInitialAdventures, dnd5eKits, dnd5eProficiency, freeAttributes, freeClassFeatures (+5 more)

### Community 22 - "System Controller/Service"
Cohesion: 0.19
Nodes (9): SystemController, ApiOperation, ApiTags, Controller, Get, SystemModule, Module, SystemService (+1 more)

### Community 23 - "Web Dev Dependencies"
Cohesion: 0.13
Nodes (15): devDependencies, axe-core, happy-dom, @tailwindcss/postcss, @testing-library/react, @types/react, @types/react-dom, vitest (+7 more)

### Community 24 - "Adventure Service Logic"
Cohesion: 0.18
Nodes (7): AdventureService, CreateAdventureDto, config, Recorded, Injectable, resolveHookTemplate(), ADR-0002

### Community 25 - "User Controller"
Cohesion: 0.16
Nodes (10): CreateUserSchema, ApiBody, ApiOperation, ApiTags, Body, Controller, Post, UserController (+2 more)

### Community 26 - "Home Page & Hero"
Cohesion: 0.18
Nodes (7): AXE_OPTIONS, gameProps, { listCharacters, getTurns, listSystems }, HomeHero(), HubCharacter, { listCharacters, deleteCharacter }, api

### Community 27 - "Root Package Scripts"
Cohesion: 0.14
Nodes (14): scripts, build, db:migrate, db:seed, db:studio, dev, docs:links, docs:links:test (+6 more)

### Community 28 - "Narration Guardrails"
Cohesion: 0.25
Nodes (12): checkNoSelfRoll(), DENIAL_PATTERNS, detectCanonDenial(), detectInventedRoll(), detectLanguageDrift(), detectReasoningLeak(), detectSlopName(), GuardrailResult (+4 more)

### Community 29 - "API Dev Dependencies"
Cohesion: 0.15
Nodes (13): devDependencies, @nestjs/cli, @nestjs/testing, ts-node, @types/express, @types/pg, vitest, vitest (+5 more)

### Community 30 - "Shared Package Config"
Cohesion: 0.15
Nodes (12): dependencies, zod, zod, main, name, private, scripts, build (+4 more)

### Community 31 - "Dice Service & AI Tests"
Cohesion: 0.23
Nodes (6): Evt, fakePrisma(), service(), DiceService, dice, Injectable

### Community 32 - "Character Class Data"
Cohesion: 0.35
Nodes (8): CLASS_SYNONYMS, getClassFeatures(), getClassSpells(), getStartingInventory(), normalize(), resolveInitialHook(), dnd5eConfig, ADR-0005

### Community 33 - "AI Engine Package Config"
Cohesion: 0.18
Nodes (10): main, name, private, scripts, build, dev, eval, test (+2 more)

### Community 34 - "API Package Scripts"
Cohesion: 0.20
Nodes (10): scripts, build, db:migrate, db:migrate:deploy, db:seed, db:studio, dev, start (+2 more)

### Community 35 - "AI Service Turn State"
Cohesion: 0.22
Nodes (9): AnchoredRoll, ChatInput, ExtractedScene, normName(), OPENING_ENTITIES_SCHEMA, OPENING_SCENE_SCHEMA, RollTurnState, SALVAGE_PROVIDER_OPTIONS (+1 more)

### Community 36 - "Web TS Compiler Options"
Cohesion: 0.20
Nodes (10): compilerOptions, allowJs, incremental, isolatedModules, jsx, module, moduleResolution, noEmit (+2 more)

### Community 37 - "Eval Rubric Dimensions"
Cohesion: 0.22
Nodes (7): DIMENSION_FLOORS, DIMENSIONS, estimateCost(), gateQuality(), dims(), perDim(), WEIGHTS

### Community 38 - "AI Engine TS Config"
Cohesion: 0.20
Nodes (9): compilerOptions, declaration, declarationMap, module, moduleResolution, outDir, extends, include (+1 more)

### Community 39 - "Shared TS Config"
Cohesion: 0.20
Nodes (9): compilerOptions, declaration, declarationMap, module, moduleResolution, outDir, extends, include (+1 more)

### Community 40 - "Root TS Config"
Cohesion: 0.20
Nodes (9): compilerOptions, esModuleInterop, module, moduleResolution, noUncheckedIndexedAccess, resolveJsonModule, skipLibCheck, strict (+1 more)

### Community 41 - "AI Controller Tests"
Cohesion: 0.22
Nodes (5): AiController, ApiBearerAuth, ApiTags, Controller, UseGuards

### Community 42 - "Auth Controller"
Cohesion: 0.22
Nodes (7): AuthController, ApiBearerAuth, ApiOperation, ApiTags, Controller, Post, UseGuards

### Community 43 - "Web Providers & API Client"
Cohesion: 0.36
Nodes (7): AuthTokenBridge(), Providers(), authHeaders(), del(), get(), post(), setAuthToken()

### Community 44 - "Project Docs & Conventions"
Cohesion: 0.25
Nodes (4): US-83 — README com arquitetura de alto nível, US-86 — Árvore de diretórios na documentação deixa de mentir sobre onde o arquivo está, US-88 — Doc que ordena deixa de citar API que não existe, US-91 — Convenções de Implementação (e o bloco Backend do AGENTS.md) deixam de descrever um projeto que não é este

### Community 45 - "Prisma Config"
Cohesion: 0.29
Nodes (8): prisma, exclude, include, prisma.config.ts, src, prisma, dist, **/*.test.ts

### Community 46 - "Web TS Config"
Cohesion: 0.25
Nodes (7): exclude, extends, include, node_modules, src, next.config.ts, .next/types/**/*.ts

### Community 47 - "System & Character US Stories"
Cohesion: 0.32
Nodes (8): US-20 — Catálogo de sistemas servido pela API, US-21 — Sistema de regras como dado reutilizável pelas APIs, US-22 — Fusão de campanha e aventura numa entidade só, US-23 — DM ciente da ficha completa (injeção dirigida por dados), US-26 — Criação de personagem em etapas com trilha de progresso, US-27 — Perícias do personagem, US-28 — Aventura inicial baseada na classe do personagem, US-32 — Modificadores de atributo do personagem

### Community 48 - "Root Package Metadata"
Cohesion: 0.25
Nodes (7): dotenv-cli, devDependencies, dotenv-cli, typescript, name, packageManager, private

### Community 49 - "Doc Link Checker Tests"
Cohesion: 0.25
Nodes (4): ANTES, DEPOIS, ROOT, SCRIPT

### Community 50 - "TS/Vitest Dev Deps"
Cohesion: 0.29
Nodes (7): typescript, typescript, typescript, devDependencies, typescript, vitest, vitest

### Community 51 - "Node/TS Dev Deps"
Cohesion: 0.29
Nodes (7): @types/node, @types/node, devDependencies, @types/node, typescript, vitest, vitest

### Community 52 - "Deploy Infra US Stories"
Cohesion: 0.29
Nodes (7): US-58 — Banco Postgres gerenciado na Neon, US-59 — API em produção no Render, US-60 — Web em produção na Vercel, US-61 — Login do jogador, US-62 — Acesso do Claude à Neon via MCP, US-63 — Acesso do Claude ao Render via MCP, US-64 — Acesso do Claude à Vercel via MCP

### Community 53 - "Nest CLI Config"
Cohesion: 0.33
Nodes (5): collection, compilerOptions, deleteOutDir, $schema, sourceRoot

### Community 54 - "Nest TS Compiler Options"
Cohesion: 0.33
Nodes (6): compilerOptions, emitDecoratorMetadata, experimentalDecorators, module, moduleResolution, outDir

### Community 55 - "SRD Ingestion US Stories"
Cohesion: 0.33
Nodes (6): US-47 — Ingestão do SRD como dado, US-48 — Tool getRule e corpus de regras, US-49 — Eval de fidelidade às regras do SRD, US-51 — Kits iniciais derivados do SRD, US-52 — Tradução automática do SRD, US-54 — Chaves canônicas de classe em inglês

### Community 56 - "Docs & CI Hygiene US Stories"
Cohesion: 0.40
Nodes (5): US-78 — Vault Obsidian sobre docs/, US-79 — Consertar links quebrados na documentação, US-80 — CI: typecheck, testes e evals, US-81 — Higiene de nomes de arquivo e placeholders (#), US-82 — Gate de convenção de nomes de arquivo

### Community 58 - "API TS Config"
Cohesion: 0.40
Nodes (3): extends, extends, ../../tsconfig.json

### Community 59 - "Setup Wizard Tests"
Cohesion: 0.50
Nodes (3): configWithBudget(), configWithSkills(), { listSystems, createCharacter, getInitialAdventure, createAdventure }

### Community 60 - "NextAuth Type Defs"
Cohesion: 0.40
Nodes (4): JWT, next-auth, next-auth/jwt, Session

### Community 61 - "TTFT Benchmark Test"
Cohesion: 0.50
Nodes (3): measureTTFT(), MODELS, nvidia

### Community 62 - "MCP Setup PowerShell"
Cohesion: 0.70
Nodes (4): Add-Neon(), Add-Render(), Add-Vercel(), Test-ClaudeCli()

### Community 63 - "MCP Setup Shell Script"
Cohesion: 0.70
Nodes (4): setup-mcp.sh script, add_neon(), add_render(), add_vercel()

### Community 64 - "API Package Metadata"
Cohesion: 0.50
Nodes (3): name, private, version

### Community 66 - "Web Lib Compiler Options"
Cohesion: 0.50
Nodes (4): lib, dom, dom.iterable, esnext

### Community 67 - "Obsidian App Config"
Cohesion: 0.50
Nodes (3): alwaysUpdateLinks, newLinkFormat, useMarkdownLinks

### Community 68 - "Narration Quality US Stories"
Cohesion: 0.50
Nodes (4): US-34 — Qualidade cinematográfica da narração do AI DM, US-35 — Estado de cena estruturado já na abertura da aventura, US-36 — Eval de qualidade da narração do DM, US-37 — Nível cinematográfico mantido em todos os turnos

### Community 69 - "Spell Data by Class"
Cohesion: 0.50
Nodes (3): base, clerigoSpells, paladinoSpells

### Community 70 - "README Shape Test"
Cohesion: 0.67
Nodes (3): entries(), ROOT, shape()

### Community 74 - "Prompt Layering ADR/US"
Cohesion: 1.00
Nodes (3): ADR 007 — Camadas do prompt por volatilidade, US-84 — Nomes de bloco do turn-state compartilhados, US-85 — A fronteira entre as camadas do prompt

### Community 75 - "Character Identity US Stories"
Cohesion: 0.67
Nodes (3): US-39 — Identidade narrativa do personagem, US-40 — Divindade / patrono do personagem, US-43 — Calibração do peso dos traços de identidade

### Community 76 - "Class Features/Spells US Stories"
Cohesion: 0.67
Nodes (3): US-41 — Features de classe conhecidas pelo mestre, US-42 — Magias conhecidas pelo mestre, US-47 — Ingestão do SRD 5e (2024) como dado do sistema

## Knowledge Gaps
- **503 isolated node(s):** `$schema`, `collection`, `sourceRoot`, `deleteOutDir`, `name` (+498 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **60 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `devDependencies` connect `API Dev Dependencies` to `API Package Metadata`, `TS/Vitest Dev Deps`, `Prisma Config`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **Why does `typescript` connect `TS/Vitest Dev Deps` to `Root Package Metadata`, `Node/TS Dev Deps`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Why does `PrismaService` connect `Auth Service & Prisma` to `Character Class Data`, `Adventure Creation Methods`, `Adventure & Character Controllers`, `AI Service Turn State`, `Auth Controller`, `NestJS App Modules`, `AI Chat Service & Controller`, `System Controller/Service`, `Adventure Service Logic`, `Character Service Tests`, `User Controller`, `Dice Service & AI Tests`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **What connects `$schema`, `collection`, `sourceRoot` to the rest of the system?**
  _503 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Adventure & Character Controllers` be split into smaller, more focused modules?**
  _Cohesion score 0.0554954954954955 - nodes in this community are weakly interconnected._
- **Should `World Entities & Model Fallback` be split into smaller, more focused modules?**
  _Cohesion score 0.05656565656565657 - nodes in this community are weakly interconnected._
- **Should `Web App Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.047619047619047616 - nodes in this community are weakly interconnected._