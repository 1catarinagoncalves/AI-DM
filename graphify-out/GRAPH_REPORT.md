# Graph Report - AI DM  (2026-08-03)

## Corpus Check
- 315 files · ~634,145 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1810 nodes · 2381 edges · 171 communities (123 shown, 48 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 7 edges (avg confidence: 0.64)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `62854e15`
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
- layout.tsx
- narrative-bakeoff.test.ts
- rubric.ts
- check-doc-links.mjs
- US-36 Eval Cases
- Prompt A/B Bake-off Script
- Onomastics Bake-off Script
- PrismaService
- AuthUser
- GameView.tsx
- dependencies
- US-97 — Jogador escolhe o idioma da partida (PT-BR ou inglês)
- Kanban Server Script
- SetupWizard.tsx
- seed.ts
- adventure.service.ts
- ai.service.ts
- AiService
- AppModule
- messages/index.ts
- scripts
- guardrails.ts
- scripts
- shared/package.json
- US-11b Scene State Spec
- ai-engine/package.json
- User Story Template
- US-102 — Tela nova nasce traduzida
- Web TSConfig
- character.service.ts
- compilerOptions
- compilerOptions
- Root TSConfig
- PRD Doc
- Endpoints (Fase 1 — MVP)
- UserController
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
- AuthController
- next.config.ts
- Bake-off README
- character.service.test.ts
- Spells Seed Data
- README Shape Test
- sync.mjs
- Kanban File Actions
- Vercel Config
- Prompt Layers ADR/US
- Character Identity User Stories
- US-02 — Inventário do personagem e equipamento inicial
- Paladin Features Seed
- US-105 — Raça e classe vêm do catálogo do SRD e são guardadas por chave
- US-106 — O catálogo carrega chave e procedência; o Free monta o dele de mais de uma fonte
- DM Prompt Rules Doc
- ADR 009 — Regra de uso do SRD: união do 5.1 e do 5.2, com o 5.2 vencendo
- Next Env Types
- PostCSS Config
- dm.tsx
- Hub/Delete User Stories
- Kanban Board User Stories
- Prompt Caching User Stories
- ADR 008 — Pin de roteamento no OpenRouter: o endpoint faz parte do modelo
- Prompt Anchors Convention
- US-98-i18n-da-interface-web.md
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
- US-45 Character Background
- Direção por alavanca
- US-50 Character Spells
- US-53 Prisma Config Migration
- US-57 Server Warm-up
- US-65 Google Login Prod Setup
- US-67 Edit Sent Action
- US-99 — O `config` do sistema é servido no locale ativo (EN cru ou overlay pt-BR)
- US-92 — O deploy espera o CI ficar verde
- US-71 Character Location Simplification
- US-94 — O gate de qualidade da narração passa a rodar de verdade, num job noturno
- US-73 Background Scene Reconciler
- translate-srd.ts
- US-76 US-75 Test Fake Fix
- US-96 — A convenção de mensagem de commit passa a descrever este repo
- Summary Model Config
- US-93 — Três gates baratos: drift de migração, dependência vulnerável e smoke pós-deploy
- Design System "Grimório Vivo" — AI Dungeon Master
- Kanban User Stories
- api.ts
- 2. Decisão
- Camadas de teste
- US-95-camada-de-integracao-com-banco-efemero.md
- ai-engine/src/index.ts
- US-102-gate-de-string-literal-no-jsx.md
- US-99-config-do-sistema-no-locale-ativo.md
- US-98 — Interface web em inglês (i18n das strings do front)
- ADR 005 — Locale como dimensão (PT-BR / EN): preferência mutável + ficha por idioma
- rubric.test.ts
- AiController
- ADR 004 — Origem do dado de sistema: ingestão do SRD por pipeline pinado
- LocaleProvider.tsx
- ApiBearerAuth
- ApiOperation
- ApiTags
- Controller
- Post
- UseGuards
- entities.ts
- ApiOperation
- ApiTags
- Controller
- Get
- Modelo de Dados — AI Dungeon Master
- scene.ts
- overlap.ts

## God Nodes (most connected - your core abstractions)
1. `PrismaService` - 24 edges
2. `AiService` - 22 edges
3. `useT()` - 19 edges
4. `AuthUser` - 18 edges
5. `scripts` - 17 edges
6. `CharacterService` - 14 edges
7. `CurrentUser` - 14 edges
8. `GameView()` - 13 edges
9. `CharacterController` - 13 edges
10. `AdventureService` - 12 edges

## Surprising Connections (you probably didn't know these)
- `mergeEditions()` --indirect_call--> `row()`  [INFERRED]
  scripts/srd/ingest.mjs → scripts/srd/ingest.test.mjs
- `LoginPage()` --calls--> `useT()`  [EXTRACTED]
  apps/web/src/app/login/page.tsx → apps/web/src/components/LocaleProvider.tsx
- `US-77 — Reancorar as assertivas de prompt restantes` --references--> `Prompt Anchors Convention`  [EXTRACTED]
  docs/sdlc/01-requisitos/US-77-reancorar-assertivas-de-prompt-e-guard-de-regressao.md → evals/PROMPT-ANCHORS.md
- `toRace()` --calls--> `toKey()`  [EXTRACTED]
  apps/api/prisma/migrate-race-class-keys.test.ts → apps/api/prisma/migrate-race-class-keys.ts
- `toClass()` --calls--> `toKey()`  [EXTRACTED]
  apps/api/prisma/migrate-race-class-keys.test.ts → apps/api/prisma/migrate-race-class-keys.ts

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

## Communities (171 total, 48 thin omitted)

### Community 0 - "ingest.mjs"
Cohesion: 0.07
Nodes (47): ABILITY_MAP, applyDrafts(), ATTR_ORDER, ATTR_RANGE, buildAttributes(), buildClasses(), buildClassFeatures(), buildClassSpells() (+39 more)

### Community 1 - "dm-system.ts"
Cohesion: 0.15
Nodes (15): BACKGROUND_LABELS, backgroundFieldText(), buildDmSystemPrompt(), buildOpeningInstruction(), buildTurnStateBlock(), CharacterBackground, ClassFeature, DmCharacterSheet (+7 more)

### Community 2 - "devDependencies"
Cohesion: 0.04
Nodes (45): dependencies, @ai-dm/shared, jose, lucide-react, next, next-auth, react, react-dom (+37 more)

### Community 3 - "narration.ts"
Cohesion: 0.07
Nodes (31): abilityModifier(), buildSkillSheet(), formatModifier(), ResolvedSkill, skillModifier(), isLocale(), Locale, localeLabel() (+23 more)

### Community 4 - "system.ts"
Cohesion: 0.12
Nodes (16): buildCharacterAttributesSchema(), InitialAdventureHook, InitialAdventureHookSchema, StartingKitItemSchema, SystemAttribute, SystemAttributeSchema, SystemCatalogEntry, SystemCatalogEntrySchema (+8 more)

### Community 5 - "Location Bake-off Script"
Cohesion: 0.07
Nodes (25): system, turnState, ARMS, body, dir, EXEMPLAR, genOnce(), judge (+17 more)

### Community 6 - "Bake-off Runner Script"
Cohesion: 0.07
Nodes (26): accum, CHARACTER, COHERENCE_TURN_STATE, DEFAULT_MODELS, dir, EX, genTurn(), guardrailHits (+18 more)

### Community 7 - "layout.tsx"
Cohesion: 0.12
Nodes (17): POST(), activeLocale(), cinzel, geist, generateMetadata(), RootLayout(), viewport, Props (+9 more)

### Community 8 - "narrative-bakeoff.test.ts"
Cohesion: 0.09
Nodes (20): AMNESIA_ENTITIES, AMNESIA_TURN_STATE, CHARACTER, COHERENCE_TURN_STATE, DEFAULT_MODELS, EX_AMNESIA, EX_COHERENCE, EX_COMBAT (+12 more)

### Community 9 - "rubric.ts"
Cohesion: 0.09
Nodes (26): aggregateReps(), batchItemSchema, batchSchema, buildBatchPrompt(), buildJudgePrompt(), Dimension, dimScore, Exemplar (+18 more)

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

### Community 14 - "PrismaService"
Cohesion: 0.11
Nodes (20): AdventureModule, Module, AiModule, Module, AuthModule, Module, A, C (+12 more)

### Community 15 - "AuthUser"
Cohesion: 0.05
Nodes (40): AdventureController, CreateAdventureSchema, ApiBearerAuth, ApiBody, ApiOperation, ApiTags, Body, Controller (+32 more)

### Community 16 - "GameView.tsx"
Cohesion: 0.15
Nodes (16): ATTR_LABELS, CharacterBackground, ClassFeature, GameView(), historyKey(), InventoryItem, loadHistory(), LocaleTurn (+8 more)

### Community 17 - "dependencies"
Cohesion: 0.06
Nodes (39): ai, @ai-dm/ai-engine, @ai-dm/shared, dependencies, ai, @ai-dm/ai-engine, @ai-dm/shared, @nestjs/common (+31 more)

### Community 18 - "US-97 — Jogador escolhe o idioma da partida (PT-BR ou inglês)"
Cohesion: 0.09
Nodes (23): A proposta, Alternativas consideradas, Aviso de troca de idioma no chat, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo (+15 more)

### Community 19 - "Kanban Server Script"
Cohesion: 0.17
Nodes (15): abrirArquivo(), acharArquivo(), campo(), CANONICO, { execFile }, fs, gravarStatus(), HTML_FILE (+7 more)

### Community 20 - "SetupWizard.tsx"
Cohesion: 0.11
Nodes (15): AXE_OPTIONS, gameProps, { listCharacters, getTurns, listSystems }, GENDERS, optionCardClass(), parseDeity(), POINT_COST, SetupWizard() (+7 more)

### Community 21 - "seed.ts"
Cohesion: 0.08
Nodes (27): AUTHORED_FEATURES, AUTHORED_SPELLS, AuthoredEntry, authoredIn(), buildFreeClassFeatures(), buildFreeClassSpells(), classKeys(), freeFeatureRefs (+19 more)

### Community 22 - "adventure.service.ts"
Cohesion: 0.15
Nodes (11): AdventureService, CreateAdventureDto, config, Recorded, Injectable, getClassSpells(), getStartingInventory(), resolveHookTemplate() (+3 more)

### Community 23 - "ai.service.ts"
Cohesion: 0.12
Nodes (15): AnchoredRoll, ChatInput, ExtractedScene, OPENING_ENTITIES_SCHEMA, OPENING_SCENE_SCHEMA, RollTurnState, SALVAGE_PROVIDER_OPTIONS, Evt (+7 more)

### Community 24 - "AiService"
Cohesion: 0.12
Nodes (11): ChatBodySchema, ApiBody, ApiOperation, Body, Post, AiService, normName(), scenePatchFromExtraction() (+3 more)

### Community 26 - "messages/index.ts"
Cohesion: 0.24
Nodes (9): config, { listSystems, setLocale }, LOCALE_STORAGE_KEY, enUS, DICTIONARIES, fill(), translate, MessageKey (+1 more)

### Community 27 - "scripts"
Cohesion: 0.07
Nodes (27): dotenv-cli, knip, devDependencies, dotenv-cli, knip, typescript, typescript, name (+19 more)

### Community 28 - "guardrails.ts"
Cohesion: 0.23
Nodes (13): checkNoSelfRoll(), DENIAL_PATTERNS, detectCanonDenial(), detectInventedRoll(), detectLanguageDrift(), detectReasoningLeak(), detectSlopName(), GuardrailResult (+5 more)

### Community 29 - "scripts"
Cohesion: 0.07
Nodes (27): devDependencies, @nestjs/cli, prisma, ts-node, @types/express, typescript, vitest, typescript (+19 more)

### Community 30 - "shared/package.json"
Cohesion: 0.11
Nodes (18): dependencies, zod, devDependencies, typescript, vitest, typescript, vitest, zod (+10 more)

### Community 31 - "US-11b Scene State Spec"
Cohesion: 0.12
Nodes (16): A proposta, Como o `sceneState` é alimentado (determinístico), Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História (+8 more)

### Community 33 - "ai-engine/package.json"
Cohesion: 0.06
Nodes (31): @ai-sdk/google, @ai-sdk/groq, @ai-sdk/openai-compatible, dependencies, ai, @ai-dm/shared, @ai-sdk/google, @ai-sdk/groq (+23 more)

### Community 34 - "User Story Template"
Cohesion: 0.13
Nodes (14): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Modelo de dados proposto (+6 more)

### Community 35 - "US-102 — Tela nova nasce traduzida"
Cohesion: 0.13
Nodes (15): A proposta, Baseline medida (31/07/2026), Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História (+7 more)

### Community 36 - "Web TSConfig"
Cohesion: 0.09
Nodes (22): compilerOptions, allowJs, incremental, isolatedModules, jsx, lib, module, moduleResolution (+14 more)

### Community 37 - "character.service.ts"
Cohesion: 0.17
Nodes (9): ADR-0005, configForLocale(), LocaleMap, localeOfUser(), SystemRow, SystemService, enBase, ptBR (+1 more)

### Community 38 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, declaration, declarationMap, module, moduleResolution, outDir, exclude, extends (+4 more)

### Community 39 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, declaration, declarationMap, module, moduleResolution, outDir, exclude, extends (+4 more)

### Community 40 - "Root TSConfig"
Cohesion: 0.20
Nodes (9): compilerOptions, esModuleInterop, module, moduleResolution, noUncheckedIndexedAccess, resolveJsonModule, skipLibCheck, strict (+1 more)

### Community 41 - "PRD Doc"
Cohesion: 0.18
Nodes (10): 1. Declaração do problema, 2. Objetivos e critério de aceite, 3. Usuários alvo, 4.1 Personagens e campanhas, 4.2 Multiplayer, 4.3 Sistemas e aventuras, 4. Casos de uso, 5. Fora do escopo (v1) (+2 more)

### Community 42 - "Endpoints (Fase 1 — MVP)"
Cohesion: 0.18
Nodes (10): Aventuras, Contratos de API — AI Dungeon Master, Convenções, DM Agent (streaming), Endpoints (Fase 1 — MVP), Multiplayer (Fase 4), Personagens — dono derivado do token, Sistemas — público (+2 more)

### Community 43 - "UserController"
Cohesion: 0.20
Nodes (8): CreateUserSchema, ApiBody, ApiOperation, ApiTags, Body, Controller, Post, UserController

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
Cohesion: 0.20
Nodes (14): DEEPSEEK_ALLOWED_PROVIDERS, DEEPSEEK_ROUTE_ORDER, fallbackModel, google, groq, groqFallbackModel, judgeModel(), NARRATION_PROVIDER_OPTIONS (+6 more)

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
Cohesion: 0.14
Nodes (14): A proposta, Alternativas consideradas e rejeitadas, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História (+6 more)

### Community 58 - "US-100 — A ficha do personagem acompanha o idioma ativo (features e magias por chave)"
Cohesion: 0.10
Nodes (20): 1. O índice cobre os **dois** locales, não só o pt-BR, 2. O casamento é **escopado pela classe**, 3. Todo item legado tem destino — o `retired` é a rede para o próximo bump, 4. Rodar como script conferível antes de escrever, A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo (+12 more)

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

### Community 65 - "AuthController"
Cohesion: 0.12
Nodes (17): ApiBearerAuth, ApiBody, ApiOperation, ApiTags, AuthController, SetLocaleSchema, SyncSchema, AuthService (+9 more)

### Community 67 - "Bake-off README"
Cohesion: 0.33
Nodes (5): Bake-off narrativo (US-17) — como rodar, Notas, Pré-requisitos, Rodar (PowerShell), Variáveis

### Community 68 - "character.service.test.ts"
Cohesion: 0.25
Nodes (4): catalogEn, catalogPt, config, systemRow

### Community 69 - "Spells Seed Data"
Cohesion: 0.50
Nodes (3): base, clerigoSpells, paladinoSpells

### Community 70 - "README Shape Test"
Cohesion: 0.67
Nodes (3): entries(), ROOT, shape()

### Community 71 - "sync.mjs"
Cohesion: 0.40
Nodes (3): FILES, ADR-0009, OUT

### Community 74 - "Prompt Layers ADR/US"
Cohesion: 1.00
Nodes (3): ADR 007 — Camadas do prompt por volatilidade, US-84 — Nomes de bloco do turn-state compartilhados, US-85 — A fronteira entre as camadas do prompt

### Community 75 - "Character Identity User Stories"
Cohesion: 0.67
Nodes (3): US-39 — Identidade narrativa do personagem, US-40 — Divindade / patrono do personagem, US-43 — Calibração do peso dos traços de identidade

### Community 76 - "US-02 — Inventário do personagem e equipamento inicial"
Cohesion: 0.15
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
Cohesion: 0.15
Nodes (13): 1. Contexto, 2. Decisão, 3. Decisões-chave e justificativas, 4. O que a medição mostrou, 5. Alternativas rejeitadas, 6. Consequências, 7. Implementação (referência), ADR 009 — Regra de uso do SRD: união do 5.1 e do 5.2, com o 5.2 vencendo (+5 more)

### Community 86 - "dm.tsx"
Cohesion: 0.13
Nodes (19): LoginPage(), emptyState(), HomeHero(), HubCharacter, { listCharacters, deleteCharacter }, BtnProps, cn(), DIM_CLASS (+11 more)

### Community 90 - "ADR 008 — Pin de roteamento no OpenRouter: o endpoint faz parte do modelo"
Cohesion: 0.05
Nodes (41): 1. Contexto, 2. Decisão, 3. Decisões-chave e justificativas, 4. Alternativas rejeitadas, 5. Consequências, 6. Implementação (referência), 7. Questões em aberto, ADR 008 — Pin de roteamento no OpenRouter: o endpoint faz parte do modelo (+33 more)

### Community 92 - "US-98-i18n-da-interface-web.md"
Cohesion: 0.54
Nodes (3): US-46 — Acessibilidade da aplicação web (WCAG 2.2 AA), US-66 — Todas as telas mobile-friendly, US-68 — Nomes de fantasia originais

### Community 112 - "US-101 — Ganchos de aventura inicial em inglês"
Cohesion: 0.14
Nodes (14): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Notas de implementação (+6 more)

### Community 114 - "Direção por alavanca"
Cohesion: 0.14
Nodes (14): 1. Tipografia — o maior ganho, 2. Recalibração de cor (paleta travada), 3. Iconografia, 4. Materialidade + textura, 5. Imagem — o tell central por resolver, 6. Movimento, A preservar (não regredir), Auditoria do estado atual (+6 more)

### Community 121 - "US-99 — O `config` do sistema é servido no locale ativo (EN cru ou overlay pt-BR)"
Cohesion: 0.14
Nodes (14): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Modelo de dados proposto (+6 more)

### Community 122 - "US-92 — O deploy espera o CI ficar verde"
Cohesion: 0.14
Nodes (14): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Notas de implementação (+6 more)

### Community 124 - "US-94 — O gate de qualidade da narração passa a rodar de verdade, num job noturno"
Cohesion: 0.15
Nodes (13): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Notas de implementação (+5 more)

### Community 126 - "translate-srd.ts"
Cohesion: 0.33
Nodes (7): translateModel(), DraftsSchema, GlossaryTerm, pickRequested(), SrdEntry, systemPrompt(), translateSrdToPtBr()

### Community 128 - "US-96 — A convenção de mensagem de commit passa a descrever este repo"
Cohesion: 0.14
Nodes (14): A proposta, Contexto e motivação, Critérios de aceite, Decisão (03/08/2026), Dentro do escopo, Escopo, Fora do escopo, História (+6 more)

### Community 145 - "US-93 — Três gates baratos: drift de migração, dependência vulnerável e smoke pós-deploy"
Cohesion: 0.17
Nodes (12): Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Notas de implementação, O problema observado (+4 more)

### Community 146 - "Design System "Grimório Vivo" — AI Dungeon Master"
Cohesion: 0.17
Nodes (12): 1. Tokens de cor, 2. Tipografia, 3. Primitivas, 4. Materialidade e layout, 5. Movimento, 6. Acessibilidade (invariantes da US-46 embutidas no sistema), 7. Checklist de tela nova, Contraste medido (não estimado) (+4 more)

### Community 149 - "api.ts"
Cohesion: 0.29
Nodes (9): AuthTokenBridge(), Providers(), api, authHeaders(), del(), get(), patch(), post() (+1 more)

### Community 150 - "2. Decisão"
Cohesion: 0.14
Nodes (14): 1. Contexto, 2.1 Topologia, 2. Decisão, 3. Decisões-chave e justificativas, 4. Alternativas rejeitadas, 5. Consequências, 6. Implementação (referência), ADR 006 — Deploy a custo zero (Fase 1) (+6 more)

### Community 151 - "Camadas de teste"
Cohesion: 0.17
Nodes (12): 1. Testes unitários (todos os workspaces), 2. Testes de integração — não existem ainda, 3. Testes de componente (apps/web), 4. Evals do DM Agent (evals/), Camadas de teste, Estratégia de Testes e Evals — AI Dungeon Master, Estrutura de um eval case (evals/cases/), Flywheel de qualidade (após MVP) (+4 more)

### Community 153 - "ai-engine/src/index.ts"
Cohesion: 0.25
Nodes (3): narrationModels, GeneratedNarration, SummaryTurn

### Community 154 - "US-102-gate-de-string-literal-no-jsx.md"
Cohesion: 0.11
Nodes (13): US-70 — Piso por dimensão e robustez do eval, US-72 — Evals de prompt resistentes à reescrita, US-83 — README com arquitetura de alto nível, US-86 — Árvore de diretórios na documentação deixa de mentir sobre onde o arquivo está, US-88 — Doc que ordena deixa de citar API que não existe, US-89 — Export que ninguém importa para de sobreviver no repo, US-91 — Convenções de Implementação (e o bloco Backend do AGENTS.md) deixam de descrever um projeto que não é este, Antes de abrir PR (+5 more)

### Community 156 - "US-99-config-do-sistema-no-locale-ativo.md"
Cohesion: 0.59
Nodes (3): US-41 — Features de classe conhecidas pelo mestre, US-42 — Magias conhecidas pelo mestre, US-47 — Ingestão do SRD 5e (2024) como dado do sistema

### Community 157 - "US-98 — Interface web em inglês (i18n das strings do front)"
Cohesion: 0.15
Nodes (13): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Notas de implementação (+5 more)

### Community 158 - "ADR 005 — Locale como dimensão (PT-BR / EN): preferência mutável + ficha por idioma"
Cohesion: 0.17
Nodes (12): 1. Contexto, 2.1 Faseamento, 2. Decisão, 3. Decisões-chave e justificativas, 4. Alternativas rejeitadas, 5. Consequências, 6. Implementação (referência), ADR 005 — Locale como dimensão (PT-BR / EN): preferência mutável + ficha por idioma (+4 more)

### Community 159 - "rubric.test.ts"
Cohesion: 0.22
Nodes (8): DIMENSION_FLOORS, DIMENSIONS, estimateCost(), gateQuality(), RubricScore, dims(), perDim(), WEIGHTS

### Community 160 - "AiController"
Cohesion: 0.22
Nodes (5): AiController, ApiBearerAuth, ApiTags, Controller, UseGuards

### Community 161 - "ADR 004 — Origem do dado de sistema: ingestão do SRD por pipeline pinado"
Cohesion: 0.20
Nodes (10): 1. Contexto, 2. Decisão, 3.1 Revisão da decisão 6 (02/08/2026): o Free herda o SRD, 3.2 Correção de procedência (03/08/2026): o kit inicial é CC-BY, não OGL, 3. Decisões-chave e justificativas, 4. A descoberta que só apareceu cutucando o dataset, 5. Alternativas rejeitadas, 6. Consequências (+2 more)

### Community 162 - "LocaleProvider.tsx"
Cohesion: 0.16
Nodes (15): AuthNav(), BrandName(), BackgroundPanel(), FeaturesPanel(), gameProps, { getTurns, setLocale }, LocaleContext, LocaleContextValue (+7 more)

### Community 169 - "entities.ts"
Cohesion: 0.48
Nodes (5): EntityPatch, formatEntities(), mergeEntities(), norm(), TIPO_LABEL

### Community 175 - "Modelo de Dados — AI Dungeon Master"
Cohesion: 0.40
Nodes (4): Diagrama de entidades (núcleo), Modelo de Dados — AI Dungeon Master, Notas de design, Índices e constraints principais

### Community 176 - "scene.ts"
Cohesion: 0.40
Nodes (3): EMPTY, formatSceneState(), ScenePatch

### Community 178 - "overlap.ts"
Cohesion: 0.83
Nodes (3): overlapRatio(), tokens(), trigrams()

## Knowledge Gaps
- **913 isolated node(s):** `História`, `O problema observado`, `Por que isto importa mais do que parece`, `A proposta`, `Decisão (03/08/2026)` (+908 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **48 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `US-36 — Eval de qualidade da narração do DM` connect `ADR 008 — Pin de roteamento no OpenRouter: o endpoint faz parte do modelo` to `US-102-gate-de-string-literal-no-jsx.md`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **Why does `US-47 — Ingestão do SRD 5e (2024) como dado do sistema` connect `US-99-config-do-sistema-no-locale-ativo.md` to `US-95-camada-de-integracao-com-banco-efemero.md`, `US-98-i18n-da-interface-web.md`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **Why does `SystemConfigSchema` connect `system.ts` to `AiService`, `adventure.service.ts`, `AuthUser`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **What connects `História`, `O problema observado`, `Por que isto importa mais do que parece` to the rest of the system?**
  _913 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `ingest.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.070578231292517 - nodes in this community are weakly interconnected._
- **Should `dm-system.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.14619883040935672 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.043478260869565216 - nodes in this community are weakly interconnected._