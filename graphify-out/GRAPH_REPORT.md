# Graph Report - .  (2026-07-28)

## Corpus Check
- 279 files · ~297,003 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1049 nodes · 1417 edges · 75 communities (62 shown, 13 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 3 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- NestJS Module Wiring
- World Entity Registry
- AI Chat Controller
- Web App Dependencies
- Ability & Skill Math
- SRD System Schema
- Character & Adventure DTOs
- Location Scene Bakeoff
- AI Engine Dependencies
- API Dev Dependencies
- Narrative Bakeoff Runner
- API Runtime Dependencies
- Next.js App Routes
- Narrative Bakeoff Tests
- Eval Judge Rubric
- Doc Link Checker
- Adventure Controller
- Web TypeScript Config
- Root Workspace Manifest
- US-36 Narration Eval Case
- Prompt A/B Bakeoff
- Character Controller & Auth
- Onomastics Bakeoff
- Game View Component
- Shared Package Manifest
- Kanban Tool Server
- Auth Guard & Controllers
- Setup Wizard Flow
- Prisma Seed Catalog
- Home Page & A11y Tests
- Narration Guardrails
- API TypeScript Config
- AI Engine TS Config
- Shared TS Config
- Rubric Drift Gate
- Root TypeScript Config
- Auth Sync Controller
- API Build Config
- Web API Client & Providers
- Doc Link Checker Tests
- NestJS CLI Config
- JWT Sign & Verify
- Adventure Service Tests
- Setup Wizard Tests
- NextAuth Type Augmentation
- TTFT Benchmark
- MCP Setup (PowerShell)
- MCP Setup (Bash)
- Obsidian Vault Config
- US-42 Spells Eval Case
- README Shape Test
- SRD Sync Script
- Vercel Build Config
- US-41 Features Eval Case
- Next.js Config
- Next Env Types
- PostCSS Config
- US-03 Scene State Case
- US-23 Sheet Awareness Case
- US-40 Deity Eval Case
- NextAuth Route Handlers
- Default Narration Model
- Summary Model

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
- `POST()` --calls--> `apiAuthHeader()`  [EXTRACTED]
  apps/web/src/app/api/chat/route.ts → apps/web/src/lib/server-auth.ts
- `PlayPage()` --calls--> `apiAuthHeader()`  [EXTRACTED]
  apps/web/src/app/play/[adventureId]/page.tsx → apps/web/src/lib/server-auth.ts
- `runTurn()` --calls--> `resolveModel()`  [EXTRACTED]
  packages/ai-engine/src/narrative-bakeoff.test.ts → packages/ai-engine/src/model.ts
- `build()` --calls--> `buildDmSystemPrompt()`  [EXTRACTED]
  packages/ai-engine/src/prompts/dm-system.test.ts → packages/ai-engine/src/prompts/dm-system.ts

## Import Cycles
- None detected.

## Communities (75 total, 13 thin omitted)

### Community 0 - "NestJS Module Wiring"
Cohesion: 0.05
Nodes (38): AdventureModule, Module, AiModule, Module, AppModule, Module, AuthModule, Module (+30 more)

### Community 1 - "World Entity Registry"
Cohesion: 0.06
Nodes (41): ADR-0007, EntityPatch, formatEntities(), mergeEntities(), norm(), TIPO_LABEL, fallbackModel, google (+33 more)

### Community 2 - "AI Chat Controller"
Cohesion: 0.06
Nodes (29): AiController, ChatBodySchema, ApiBearerAuth, ApiBody, ApiOperation, ApiTags, Body, Controller (+21 more)

### Community 3 - "Web App Dependencies"
Cohesion: 0.04
Nodes (47): @ai-sdk/react, dependencies, ai, @ai-dm/shared, @ai-sdk/react, jose, next, next-auth (+39 more)

### Community 4 - "Ability & Skill Math"
Cohesion: 0.08
Nodes (30): abilityModifier(), buildSkillSheet(), formatModifier(), ResolvedSkill, skillModifier(), detectDegeneration(), formatDiceBreakdown(), hasOptionsList() (+22 more)

### Community 5 - "SRD System Schema"
Cohesion: 0.07
Nodes (31): buildCharacterAttributesSchema(), InitialAdventureHook, InitialAdventureHookSchema, StartingKitItemSchema, SystemAttribute, SystemAttributeSchema, SystemClassFeature, SystemClassFeatureSchema (+23 more)

### Community 6 - "Character & Adventure DTOs"
Cohesion: 0.10
Nodes (17): CreateAdventureDto, base, CreateCharacterDto, CreateCharacterSchema, CharacterService, config, Injectable, CLASS_SYNONYMS (+9 more)

### Community 7 - "Location Scene Bakeoff"
Cohesion: 0.07
Nodes (25): system, turnState, ARMS, body, dir, EXEMPLAR, genOnce(), judge (+17 more)

### Community 8 - "AI Engine Dependencies"
Cohesion: 0.06
Nodes (30): @ai-sdk/google, @ai-sdk/groq, @ai-sdk/openai-compatible, dependencies, ai, @ai-dm/shared, @ai-sdk/google, @ai-sdk/groq (+22 more)

### Community 9 - "API Dev Dependencies"
Cohesion: 0.06
Nodes (30): devDependencies, @nestjs/cli, @nestjs/testing, prisma, ts-node, @types/express, @types/pg, typescript (+22 more)

### Community 10 - "Narrative Bakeoff Runner"
Cohesion: 0.07
Nodes (26): accum, CHARACTER, COHERENCE_TURN_STATE, DEFAULT_MODELS, dir, EX, genTurn(), guardrailHits (+18 more)

### Community 11 - "API Runtime Dependencies"
Cohesion: 0.07
Nodes (29): @ai-dm/ai-engine, dependencies, ai, @ai-dm/ai-engine, @ai-dm/shared, @nestjs/common, @nestjs/core, @nestjs/platform-express (+21 more)

### Community 12 - "Next.js App Routes"
Cohesion: 0.11
Nodes (14): POST(), metadata, viewport, PlayPage(), Props, { handlers, auth, signIn, signOut }, secretKey(), signApiToken() (+6 more)

### Community 13 - "Narrative Bakeoff Tests"
Cohesion: 0.09
Nodes (23): AMNESIA_ENTITIES, AMNESIA_TURN_STATE, CHARACTER, COHERENCE_TURN_STATE, DEFAULT_MODELS, EX_AMNESIA, EX_COHERENCE, EX_COMBAT (+15 more)

### Community 14 - "Eval Judge Rubric"
Cohesion: 0.10
Nodes (24): aggregateReps(), batchItemSchema, batchSchema, buildBatchPrompt(), buildJudgePrompt(), Dimension, dimScore, fmt() (+16 more)

### Community 15 - "Doc Link Checker"
Cohesion: 0.09
Nodes (18): argv, buckets, DOCS, exemptLinked, fixed, GHOST_ALLOW, ghostHits, ghostStale (+10 more)

### Community 16 - "Adventure Controller"
Cohesion: 0.13
Nodes (14): AdventureController, CreateAdventureSchema, ApiBearerAuth, ApiBody, ApiOperation, ApiTags, Body, Controller (+6 more)

### Community 17 - "Web TypeScript Config"
Cohesion: 0.09
Nodes (22): compilerOptions, allowJs, incremental, isolatedModules, jsx, lib, module, moduleResolution (+14 more)

### Community 18 - "Root Workspace Manifest"
Cohesion: 0.09
Nodes (22): dotenv-cli, devDependencies, dotenv-cli, typescript, typescript, name, packageManager, private (+14 more)

### Community 19 - "US-36 Narration Eval Case"
Cohesion: 0.09
Nodes (20): ANCHOR_SET, AnchorItem, Case, CASES, CHARACTER, EN_CHARACTER, EN_SYSTEM, EX_CHILD (+12 more)

### Community 20 - "Prompt A/B Bakeoff"
Cohesion: 0.09
Nodes (17): body, CHARACTER, dir, EXEMPLAR, judge, log(), MODEL, PACE_MS (+9 more)

### Community 21 - "Character Controller & Auth"
Cohesion: 0.16
Nodes (13): AuthUser, CharacterController, ApiBearerAuth, ApiBody, ApiOperation, ApiTags, Body, Controller (+5 more)

### Community 22 - "Onomastics Bakeoff"
Cohesion: 0.11
Nodes (15): body, CHARACTER, dir, EXEMPLAR, judge, log(), MODELS, PACE_MS (+7 more)

### Community 23 - "Game View Component"
Cohesion: 0.15
Nodes (14): ATTR_LABELS, CharacterBackground, ClassFeature, GameView(), historyKey(), InventoryItem, loadHistory(), Message (+6 more)

### Community 24 - "Shared Package Manifest"
Cohesion: 0.11
Nodes (17): dependencies, zod, devDependencies, typescript, vitest, typescript, vitest, zod (+9 more)

### Community 25 - "Kanban Tool Server"
Cohesion: 0.17
Nodes (15): abrirArquivo(), acharArquivo(), campo(), CANONICO, { execFile }, fs, gravarStatus(), HTML_FILE (+7 more)

### Community 26 - "Auth Guard & Controllers"
Cohesion: 0.29
Nodes (5): AuthGuard, Injectable, CurrentUser, payloadToUser(), zodBody()

### Community 27 - "Setup Wizard Flow"
Cohesion: 0.16
Nodes (12): { listSystems, getTurns }, CLASSES, GENDERS, parseDeity(), POINT_COST, RACES, SetupWizard(), SOURCE_TYPE_HINT (+4 more)

### Community 28 - "Prisma Seed Catalog"
Cohesion: 0.13
Nodes (13): CANTRIP_CATALOG, CANTRIP_CLASSES, dnd5eConfig, dnd5eInitialAdventures, dnd5eKits, dnd5eProficiency, freeAttributes, freeClassFeatures (+5 more)

### Community 29 - "Home Page & A11y Tests"
Cohesion: 0.18
Nodes (7): AXE_OPTIONS, gameProps, { listCharacters, getTurns, listSystems }, HomeHero(), HubCharacter, { listCharacters, deleteCharacter }, api

### Community 30 - "Narration Guardrails"
Cohesion: 0.25
Nodes (12): checkNoSelfRoll(), DENIAL_PATTERNS, detectCanonDenial(), detectInventedRoll(), detectLanguageDrift(), detectReasoningLeak(), detectSlopName(), GuardrailResult (+4 more)

### Community 31 - "API TypeScript Config"
Cohesion: 0.15
Nodes (12): compilerOptions, emitDecoratorMetadata, experimentalDecorators, module, moduleResolution, outDir, extends, include (+4 more)

### Community 32 - "AI Engine TS Config"
Cohesion: 0.18
Nodes (10): compilerOptions, declaration, declarationMap, module, moduleResolution, outDir, extends, include (+2 more)

### Community 33 - "Shared TS Config"
Cohesion: 0.18
Nodes (10): compilerOptions, declaration, declarationMap, module, moduleResolution, outDir, extends, include (+2 more)

### Community 34 - "Rubric Drift Gate"
Cohesion: 0.22
Nodes (7): DIMENSION_FLOORS, DIMENSIONS, estimateCost(), gateQuality(), dims(), perDim(), WEIGHTS

### Community 35 - "Root TypeScript Config"
Cohesion: 0.20
Nodes (9): compilerOptions, esModuleInterop, module, moduleResolution, noUncheckedIndexedAccess, resolveJsonModule, skipLibCheck, strict (+1 more)

### Community 36 - "Auth Sync Controller"
Cohesion: 0.22
Nodes (7): AuthController, ApiBearerAuth, ApiOperation, ApiTags, Controller, Post, UseGuards

### Community 37 - "API Build Config"
Cohesion: 0.22
Nodes (8): exclude, extends, node_modules, prisma, prisma.config.ts, ./tsconfig.json, dist, **/*.test.ts

### Community 38 - "Web API Client & Providers"
Cohesion: 0.36
Nodes (7): AuthTokenBridge(), Providers(), authHeaders(), del(), get(), post(), setAuthToken()

### Community 39 - "Doc Link Checker Tests"
Cohesion: 0.25
Nodes (4): ANTES, DEPOIS, ROOT, SCRIPT

### Community 40 - "NestJS CLI Config"
Cohesion: 0.33
Nodes (5): collection, compilerOptions, deleteOutDir, $schema, sourceRoot

### Community 41 - "JWT Sign & Verify"
Cohesion: 0.47
Nodes (3): b64urlToBuffer(), JwtPayload, verifyJwt()

### Community 43 - "Setup Wizard Tests"
Cohesion: 0.50
Nodes (3): configWithBudget(), configWithSkills(), { listSystems, createCharacter, getInitialAdventure, createAdventure }

### Community 44 - "NextAuth Type Augmentation"
Cohesion: 0.40
Nodes (4): JWT, next-auth, next-auth/jwt, Session

### Community 45 - "TTFT Benchmark"
Cohesion: 0.50
Nodes (3): measureTTFT(), MODELS, nvidia

### Community 46 - "MCP Setup (PowerShell)"
Cohesion: 0.70
Nodes (4): Add-Neon(), Add-Render(), Add-Vercel(), Test-ClaudeCli()

### Community 47 - "MCP Setup (Bash)"
Cohesion: 0.70
Nodes (4): setup-mcp.sh script, add_neon(), add_render(), add_vercel()

### Community 48 - "Obsidian Vault Config"
Cohesion: 0.50
Nodes (3): alwaysUpdateLinks, newLinkFormat, useMarkdownLinks

### Community 49 - "US-42 Spells Eval Case"
Cohesion: 0.50
Nodes (3): base, clerigoSpells, paladinoSpells

### Community 50 - "README Shape Test"
Cohesion: 0.67
Nodes (3): entries(), ROOT, shape()

## Knowledge Gaps
- **458 isolated node(s):** `$schema`, `collection`, `sourceRoot`, `deleteOutDir`, `name` (+453 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `SystemConfigSchema` connect `SRD System Schema` to `Adventure Controller`, `AI Chat Controller`, `Character & Adventure DTOs`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **Why does `PrismaService` connect `NestJS Module Wiring` to `AI Chat Controller`, `Auth Sync Controller`, `Character & Adventure DTOs`, `Adventure Service Tests`, `Adventure Controller`, `Character Controller & Auth`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Why does `AuthUser` connect `Character Controller & Auth` to `Adventure Controller`, `Auth Guard & Controllers`, `AI Chat Controller`, `Auth Sync Controller`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **What connects `$schema`, `collection`, `sourceRoot` to the rest of the system?**
  _458 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `NestJS Module Wiring` be split into smaller, more focused modules?**
  _Cohesion score 0.052884615384615384 - nodes in this community are weakly interconnected._
- **Should `World Entity Registry` be split into smaller, more focused modules?**
  _Cohesion score 0.05656565656565657 - nodes in this community are weakly interconnected._
- **Should `AI Chat Controller` be split into smaller, more focused modules?**
  _Cohesion score 0.05587808417997097 - nodes in this community are weakly interconnected._