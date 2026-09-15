# Graph Report - AI DM  (2026-09-15)

## Corpus Check
- 600 files · ~1,278,939 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 4830 nodes · 6715 edges · 388 communities (334 shown, 54 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 18 edges (avg confidence: 0.59)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `57173efe`
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
- US-219 — XP por evento narrativo
- narrative-bakeoff.test.ts
- rubric.ts
- check-doc-links.mjs
- us-36-qualidade-narracao.ts
- Prompt A/B Bake-off Script
- Onomastics Bake-off Script
- AuthUser
- a11y.test.tsx
- GameView.tsx
- ai.int.test.ts
- US-97 — Jogador escolhe o idioma da partida (PT-BR ou inglês)
- Kanban Server Script
- US-141 — Catálogo de subclasses do SRD 5.1 e do Marshal (`a5e-ag`)
- seed.ts
- US-128 — Memento e equipamento da origem como itens do inventário, identificados como tais
- US-228 — Categoria simples/marcial e corpo a corpo/distância no catálogo de armas
- US-240 — Um registro de nomenclatura sorteado pra aventura inteira (mundo, facções, locais, NPCs)
- check-jsx-literals.mjs
- US-215 — Proficiências de arma e ferramenta fixa de raça (Anão, Alto-elfo, Gnomo das Rochas) na ficha e na revisão
- scripts
- guardrails.ts
- US-199 — O antagonista chega ao Mestre já revelado, e o Mestre puxa a mesa pra ele
- shared/package.json
- US-11b Scene State Spec
- US-239 — Motor entra em createForCharacter, ledger do artefato, gancho fixo vira alternativa opcional
- ai-engine/package.json
- User Story Template
- US-102 — Tela nova nasce traduzida
- Web TSConfig
- US-116 — Observabilidade da cena não avançada, em dev e produção, e spike de A/B do arco
- compilerOptions
- compilerOptions
- Root TSConfig
- Backlog — Redesenho da criação de personagem (protótipo de referência)
- US-125 — Adventures & Advancement, conexão e memento da origem no prompt do Mestre
- roll-content.ts
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
- US-47 — Ingestão do SRD como dado
- Docs Vault/CI User Stories
- US-95 — O loop `ação → tool → persistir → estado` ganha teste de integração
- US-100 — A ficha do personagem acompanha o idioma ativo (features e magias por chave)
- move-ab.mjs
- NextAuth Type Defs
- TTFT Benchmark Test
- MCP Setup Script (PS)
- MCP Setup Script (sh)
- dependencies
- US-201 — Token de desenvolvimento para agentes testarem a API e os fluxos de tela
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
- Injectable
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
- US-177 — `generateLocationsAndNpcs` ganha a regra de Onomástica (hoje inventa nome sem registro nenhum)
- US-213 — Etapa "Magias" no wizard, com escolha de truque do Alto-elfo
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
- US-192 — Premissa nasce de rolagem simples, sem elaboração nem vínculo pessoal
- Direção por alavanca
- US-50 Character Spells
- US-53 Prisma Config Migration
- US-57 Server Warm-up
- US-65 Google Login Prod Setup
- migrate-feature-spell-keys.test.ts
- US-99 — O `config` do sistema é servido no locale ativo (EN cru ou overlay pt-BR)
- US-92 — O deploy espera o CI ficar verde
- d20-tests.mjs
- A sequência
- US-111 — Classe de Dificuldade do SRD 2024 decide o quão difícil é o teste
- US-112 — O arco da aventura em beats: o Mestre sabe o que MUDA a seguir
- US-76 US-75 Test Fake Fix
- US-96 — A convenção de mensagem de commit passa a descrever este repo
- US-174 — `hookSeed` deixa de ser insumo das outras chamadas do motor de geração
- Summary Model Config
- US-108 — Tabela de modificadores do SRD 2024 como fonte da regra
- US-93 — Três gates baratos: drift de migração, dependência vulnerável e smoke pós-deploy
- Design System "Grimório Vivo" — AI Dungeon Master
- Kanban User Stories
- check-jsx-literals.test.mjs
- Backlog — Motor de geração de aventuras autorais (mundo-primeiro)
- sheet.test.ts
- Camadas de teste
- US-109 — Espaço para bônus/penalidade circunstancial no teste de d20
- US-110 — Tabela de testes de habilidade do SRD 2024 escolhe o teste da situação
- US-229 — Escolha específica de arma no equipamento inicial
- US-120 — `logLlmFailure` em JSON estruturado (ADR 011, Camada 2 — Grupo B)
- buildStartingKits
- US-98 — Interface web em inglês (i18n das strings do front)
- ADR 005 — Locale como dimensão (PT-BR / EN): preferência mutável + ficha por idioma
- US-224 — Perícias à escolha seguem o catálogo e a contagem da classe
- US-113 — Vínculos entre entidades, ancorados em quem os estabeleceu
- US-115 — O ledger recolhe a entidade que o Mestre esqueceu de registrar
- ADR 008 — Pin de roteamento no OpenRouter: o endpoint faz parte do modelo
- US-114 — As extrações e o fecho saem do modelo da narração
- monster-roles.ts
- us-110-tabela-de-testes.ts
- 2. Decisão
- race-bonus.mjs
- entities.ts
- ability.ts
- US-117 — `turnId` por turno: correlação de log (ADR 011, Camada 1)
- US-138 — Catálogo de raças re-derivado com o SRD 5.1 (2014) como fonte de referência
- US-118 — Sinais de `ai.controller.ts` em JSON estruturado (ADR 011, Camada 2 — Grupo A parte 1)
- US-119 — Sinais de `ai.service.ts` em JSON estruturado (ADR 011, Camada 2 — Grupo A parte 2 + Grupo C)
- US-107 — Sair da criação ou da mesa e voltar ao hub de personagens
- starting-kit.ts
- US-220 — Perícias proficientes concedidas por raça
- dm.tsx
- US-241 — Summary nasce da fórmula do LGMRD: conceito primário + "because" + MacGuffin
- US-196 — Narração usa vocabulário que o personagem não teria como conhecer
- Endpoints (Fase 1 — MVP)
- US-166 — Motor gera 8 encontros como situações completas (location, inhabitants, behaviors, goal, complications)
- .create
- ApiBearerAuth
- US-233 — Números dos encontros (PASSO 2, 5e determinístico)
- PrismaService
- US-237 — Remove seed, rebaixa LGMRD, mantém Monster Builder
- free-catalog.ts
- adventure.service.ts
- US-130 — `Culture`/`Engineering` no catálogo de perícias (`config.skills`)
- useT
- US-133 — Catálogo de idiomas do sistema (`config.languages`)
- US-132 — Escolha da ferramenta concedida pelo benefício `tool_proficiency` do background
- US-139 — Catálogo de classes com o SRD 5.1 como referência, e o Marshal do A5E Adventurer's Guide
- US-124 — Exibir os benefícios narrativos da origem (`adventures_and_advancement`, `connection_and_memento`)
- US-140 — Catálogo de subespécies (subraças) do SRD 5.1
- US-121 — Catálogo de backgrounds do A5E Adventurer's Guide (Open5e)
- US-122 — Escolha de origem (catálogo de background) na criação de personagem
- locale.ts
- US-134 — Catálogo de ferramentas e veículos do sistema (`config.tools`)
- US-142 — Traços mecânicos de subespécie (raça-base + subespécie combinados)
- ai-engine/src/index.ts
- US-127 — Revisão da criação espelha a ficha completa (kit, features, magias, PV)
- Backlog — Economia de recursos do personagem
- US-131 — Integração mecânica: perícias do background em `proficiency`
- SetupWizard.test.tsx
- US-123 — Integração mecânica: bônus de atributo do background em `pointBuy`
- parseD10Tables.ts
- US-178 — `locale` do jogador chega ao motor de geração (hoje as 4 chamadas escrevem só em pt-BR)
- US-202 — Export da aventura gerada para análise manual de criatividade e coerência
- Backlog — Mapa em tempo real
- US-159 — Orçamento de encontro do LGMRD (Lazy Encounter Benchmark) para um personagem
- US-191 — Antagonista vira occupant do local do confronto final
- CharacterController
- LocaleProvider.tsx
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
- AdventureService
- US-153 — A aventura deixa de ser derivada da classe
- US-154 — Eval da aventura gerada
- US-155 — Aposentar a quest fixa por classe
- US-156 — Catálogos de registro (setting/tone/areaType), DTO e validação
- US-157 — A tela de mundo, depois da revisão
- US-190 — Antagonista vira passo próprio, entre segredos e encontros — não mais sintetizado dentro do fecho
- US-143 — ADR: aventura gerada é regenerável ou congelada, e onde ela mora
- 2. Decisão
- extract-monster-roles.mjs
- buildConfig
- US-158 — Locais e NPCs com prosa (camada 2, antes dos segredos)
- US-179 — Barra de ofício da narração chega ao motor de geração (prosa gerada sem regra de qualidade)
- AuthService
- extract-benchmark.mjs
- US-176 — `generateSecrets` recebe `tone` do registro (hoje gerado cego a ele)
- US-180 — `generateOpeningBeat` ignora vínculos do personagem e força abertura por combate quando nada se destaca
- lazygm/sync.mjs
- Decisões-chave
- Backlog — Combate por turno
- US-198 — Um resumo de uma frase para a aventura, não a premissa inteira
- devDependencies
- US-184 — Jogador escolhe `setting`/`areaType` da aventura (revert do corte da US-173)
- US-160 — Composer de encontro usa o limiar de soma, não só o teto de monstro único
- US-161 — Jogador escolhe o nível de desafio do encontro
- scripts
- Backlog — Classe de armadura e resolução de ataque
- US-47 — Ingestão do SRD 5e (2024) como dado do sistema
- US-164 — Orquestrador do motor: monta o `GeneratedAdventure` e gera o fecho ramificado
- US-165 — Tela: jogador escolhe o nível de desafio do encontro
- .mcp.json
- backlog-aventuras-autorais-lazygm.md
- draconic-ancestry.ts
- api.ts
- messages/index.ts
- 2. Decisão
- US-242 — NPC perde `interactions`: fala pré-escrita nunca chega ao turno ao vivo
- US-167 — Motor consome o `challenge` escolhido pelo jogador na geração real
- next-encounter-hint.test.ts
- Injectable
- character.service.test.ts
- adventure-gate.ts
- adventure-authoring-spike.mjs
- US-214 — Idiomas fixos de raça na ficha, e escolha do idioma extra (Alto-elfo, Humano, Meio-elfo)
- US-168 — Abertura narrada expande o gancho fixo, não a aventura gerada
- US-209 — Trazer `hit_dice` e `saving_throws` do dataset para `config.classes`
- us-154-eval-aventura-gerada.ts
- US-181 — Antagonista ganha `want`/`method` estruturados no artefato gerado
- ADR 004 — Origem do dado de sistema: ingestão do SRD por pipeline pinado
- adventure-export.ts
- US-173 — Registro da aventura fica só com `tone`; `settings` e `areaTypes` saem do catálogo
- US-169 — Quest gerada ganha objetivo concreto e o Mestre passa a poder concluí-la
- US-170 — Locais gerados entram no ledger e chegam ao Mestre
- US-171 — Encontros de combate entram no ledger e chegam ao Mestre
- US-172 — Abertura gerada deixa de copiar o gancho fixo, passa a ser escrita para o tom sorteado
- ai.service.ts
- us-171-eval-combatente-no-ledger.ts
- US-217 — "Aventura pronta" pula o motor de MUNDO, abertura continua gerada por IA (revert pontual da US-153/US-155)
- US-226 — Equipamento inicial à escolha por classe (arma, armadura e pacote de aventura)
- free-catalog.test.ts
- US-182 — Abertura gerada mira ao menos 2 de recompensa/heroísmo/descoberta, não só urgência
- US-183 — Antagonista ganha conexão pessoal com o personagem no artefato gerado
- US-185 — Mestre recebe `setting`/`areaType` em todo turno, não só `tone`
- US-186 — `setting`/`areaType` somam ao `tone` nos 4 consumidores de prosa que faltavam; `rollContent` segue sem `registry`
- US-187 — Distribuição de `locationId` nos encontros passa a ser temática, não só round-robin
- US-188 — Antagonista vira NPC rastreável, encontro final referencia por `id`
- us-170-eval-local-no-ledger.ts
- US-189 — Antagonista entra no ledger e chega ao Mestre durante o turno
- adventure-generation.ts
- US-223 — Proficiência de arma legível na revisão (categoria no valor, não no rótulo)
- translate-srd.ts
- US-216 — Escolher entre aventura pronta (gancho por classe) ou criar a própria história
- US-200 — Motor que sincroniza item pego ou largado pela personagem com o inventário
- ADR-0005
- US-193 — Os 8 encontros nascem sem cadeia causal entre si
- US-194 — Abertura e encontro 1 competem como cena inicial
- us-169-completar-quest.ts
- SystemController
- PRD — AI Dungeon Master
- US-222 — Salvaguardas de classe na ficha do personagem
- US-197 — Tela de espera com carrossel de mensagens na criação da aventura
- 011-observabilidade-em-camadas.md
- @prisma/client
- US-195 — Eval de embaralhamento da cadeia causal entre encontros
- US-231 — Features de classe e subclasse por nível, na criação e na ficha
- US-203 — Prosa curta de catálogo: chamada e resumo de classe e de raça
- US-236 — Params de mundo como restrição no prompt + toggle pronta×criar
- shuffle-encounter-types.ts
- design-sync — repo notes (apps/web)
- US-02 — Inventário do personagem e equipamento inicial
- paths
- dev-token.test.mjs
- bundle.mjs
- US-225 — Subclasse única aparece como cartão selecionado, não como texto solto
- conventions.md
- US-211 — Ancestralidade dracônica do Dragonborn (escolha de tipo de dragão)
- next-image.tsx
- next-link.tsx
- previews/HomeHero.tsx
- adventure.service.test.ts
- dev-token.mjs
- US-230 — Arma genérica composta ("e um escudo") e em dobro ("duas armas") no equipamento inicial
- US-234 — Gate: parse + grafo + orçamento + saneamento, regenera-on-fail
- US-212 — Integração mecânica: bônus de atributo de raça na etapa de atributos
- US-205 — Escolha por cartão no lugar dos selects de classe e raça
- US-110-tabela-de-testes-de-habilidade-do-srd-2024.md
- US-204 — Wizard em duas colunas: a ficha viva "Seu personagem" ao lado das etapas
- backlog-motor-de-geracao-de-aventuras.md
- seed-ledger.ts
- US-210 — Identidade como etapa própria (nome, gênero e alinhamento)
- US-121-catalogo-backgrounds-a5e-adventurers-guide.md
- US-206 — Origem por cartão, com os campos livres de história no mesmo desenho
- US-207 — Atributos e perícias: orçamento visível, atributo principal e modificador na tela
- US-208 — A revisão lê como ficha do personagem, não como lista de campos
- initial-adventures.ts
- auth.ts
- US-235 — Gatilho assíncrono + tela de espera + erro/retry
- shared/src/index.ts
- adventure-gate.test.ts
- US-127-revisao-espelha-ficha-completa.md
- Repositórios de referência — registro e regra de uso
- character/FeaturesPanel.tsx
- US-218 — Busca por palavra-chave no quadro Kanban
- ApiBody
- US-221 — Proficiências de arma, armadura e ferramenta por classe
- api/package.json
- check-ci-order.mjs
- @ai-dm/shared
- ApiOperation
- CharacterService
- @nestjs/common
- zod
- ApiTags
- A Cripta do Véu Silencioso
- US-227 — Nível inicial à escolha na criação, com PV e bônus de proficiência derivados de classe+nível
- Body
- Controller
- Get
- Param
- Post
- UseGuards

## God Nodes (most connected - your core abstractions)
1. `PrismaService` - 35 edges
2. `scripts` - 33 edges
3. `CharacterService` - 27 edges
4. `AiService` - 26 edges
5. `configWithBudget()` - 24 edges
6. `useT()` - 24 edges
7. `buildConfig()` - 24 edges
8. `US-47 — Ingestão do SRD 5e (2024) como dado do sistema` - 24 edges
9. `AdventureService` - 22 edges
10. `AuthUser` - 20 edges

## Surprising Connections (you probably didn't know these)
- `SystemConfigSchema` --references--> `buildConfig()`  [EXTRACTED]
  packages/shared/src/types/system.ts → scripts/srd/ingest.mjs
- `resolveArtifact()` --references--> `GeneratedAdventureSchema`  [EXTRACTED]
  apps/api/src/adventure/adventure-export.ts → packages/shared/src/types/adventure-generation.ts
- `seedLedgerFromGeneratedAdventure()` --indirect_call--> `encounter()`  [INFERRED]
  apps/api/src/adventure-generation/seed-ledger.ts → apps/api/src/adventure-generation/next-encounter-hint.test.ts
- `US-77 — Reancorar as assertivas de prompt restantes` --references--> `Prompt Anchors Convention`  [EXTRACTED]
  docs/sdlc/01-requisitos/US-77-reancorar-assertivas-de-prompt-e-guard-de-regressao.md → evals/PROMPT-ANCHORS.md
- `build()` --calls--> `buildDmSystemPrompt()`  [EXTRACTED]
  packages/ai-engine/src/prompts/dm-system.test.ts → packages/ai-engine/src/prompts/dm-system.ts

## Import Cycles
- None detected.

## Communities (388 total, 54 thin omitted)

### Community 0 - "ingest.mjs"
Cohesion: 0.06
Nodes (53): A5E_SKILLS, ABILITY_MAP, applyDrafts(), ARMOR_CATEGORY_MAP, ATTR_ORDER, ATTR_RANGE, buildAttributes(), buildBackgrounds() (+45 more)

### Community 1 - "dm-system.ts"
Cohesion: 0.10
Nodes (22): ADR-0003, abilityCheckTable(), BACKGROUND_LABELS, backgroundFieldText(), buildDmSystemPrompt(), buildOpeningInstruction(), buildTurnStateBlock(), CharacterBackground (+14 more)

### Community 2 - "devDependencies"
Cohesion: 0.04
Nodes (45): dependencies, @ai-dm/shared, jose, lucide-react, next, next-auth, react, react-dom (+37 more)

### Community 3 - "narration.ts"
Cohesion: 0.20
Nodes (13): detectDegeneration(), formatDiceBreakdown(), hasOptionsList(), NUM, ROLL_CUES, ROLL_SENTENCE, stripFabricatedRolls(), stripReasoningLeak() (+5 more)

### Community 4 - "system.ts"
Cohesion: 0.07
Nodes (29): ArmorCategorySchema, buildCharacterAttributesSchema(), ClassCatalogEntrySchema, InitialAdventureHook, InitialAdventureHookSchema, RaceCatalogEntrySchema, StartingKitItemSchema, SystemAttribute (+21 more)

### Community 5 - "Location Bake-off Script"
Cohesion: 0.07
Nodes (25): system, turnState, ARMS, body, dir, EXEMPLAR, genOnce(), judge (+17 more)

### Community 6 - "Bake-off Runner Script"
Cohesion: 0.07
Nodes (26): accum, CHARACTER, COHERENCE_TURN_STATE, DEFAULT_MODELS, dir, EX, genTurn(), guardrailHits (+18 more)

### Community 7 - "US-219 — XP por evento narrativo"
Cohesion: 0.14
Nodes (14): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Modelo de dados proposto (+6 more)

### Community 8 - "narrative-bakeoff.test.ts"
Cohesion: 0.07
Nodes (29): AMNESIA_ENTITIES, AMNESIA_TURN_STATE, CHARACTER, COHERENCE_TURN_STATE, DEFAULT_MODELS, EX_AMNESIA, EX_COHERENCE, EX_COMBAT (+21 more)

### Community 9 - "rubric.ts"
Cohesion: 0.09
Nodes (31): aggregateReps(), batchItemSchema, batchSchema, buildBatchPrompt(), buildJudgePrompt(), Dimension, DIMENSION_FLOORS, DIMENSIONS (+23 more)

### Community 10 - "check-doc-links.mjs"
Cohesion: 0.08
Nodes (21): argv, buckets, DOCS, exemptLinked, fixed, GHOST_ALLOW, GHOST_MD, ghostHits (+13 more)

### Community 11 - "us-36-qualidade-narracao.ts"
Cohesion: 0.08
Nodes (22): ANCHOR_SET, AnchorItem, Case, CASES, CHARACTER, EN_CHARACTER, EN_SYSTEM, EX_CHILD (+14 more)

### Community 12 - "Prompt A/B Bake-off Script"
Cohesion: 0.09
Nodes (17): body, CHARACTER, dir, EXEMPLAR, judge, log(), MODEL, PACE_MS (+9 more)

### Community 13 - "Onomastics Bake-off Script"
Cohesion: 0.11
Nodes (15): body, CHARACTER, dir, EXEMPLAR, judge, log(), MODELS, PACE_MS (+7 more)

### Community 14 - "AuthUser"
Cohesion: 0.14
Nodes (13): ADR-0011, AuthGuard, OptionalAuthGuard, FakeUserTable, Injectable, AuthUser, CurrentUser, payloadToUser() (+5 more)

### Community 15 - "a11y.test.tsx"
Cohesion: 0.33
Nodes (3): AXE_OPTIONS, gameProps, { listCharacters, getTurns, listSystems }

### Community 16 - "GameView.tsx"
Cohesion: 0.11
Nodes (23): POST(), PlayPage(), Props, CharacterBackground, ClassFeature, ARMOR_CATEGORY_LABEL, ATTR_LABELS, GameView() (+15 more)

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
Cohesion: 0.12
Nodes (17): buildFreeConfig(), dnd5eConfig, dnd5eConfigPtBr, dnd5eProductFields(), dnd5eProficiency, freeConfig, freeConfigPtBr, prisma (+9 more)

### Community 22 - "US-128 — Memento e equipamento da origem como itens do inventário, identificados como tais"
Cohesion: 0.13
Nodes (15): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Modelo de dados proposto (+7 more)

### Community 23 - "US-228 — Categoria simples/marcial e corpo a corpo/distância no catálogo de armas"
Cohesion: 0.12
Nodes (16): A proposta, Contexto e motivação, Corpo a corpo ou à distância — o sinal certo não é `range > 0`, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História (+8 more)

### Community 24 - "US-240 — Um registro de nomenclatura sorteado pra aventura inteira (mundo, facções, locais, NPCs)"
Cohesion: 0.13
Nodes (14): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Notas de implementação (+6 more)

### Community 25 - "check-jsx-literals.mjs"
Cohesion: 0.19
Nodes (15): bucketOf(), files, hasLetter(), hits, isCharged(), isDataUri(), isProse(), isTailwind() (+7 more)

### Community 26 - "US-215 — Proficiências de arma e ferramenta fixa de raça (Anão, Alto-elfo, Gnomo das Rochas) na ficha e na revisão"
Cohesion: 0.13
Nodes (15): Consequência: falta o catálogo de arma, ao contrário do precedente de idioma/ferramenta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, Fora do escopo mecânico, História (+7 more)

### Community 27 - "scripts"
Cohesion: 0.04
Nodes (44): dotenv-cli, knip, devDependencies, dotenv-cli, knip, typescript, typescript, name (+36 more)

### Community 28 - "guardrails.ts"
Cohesion: 0.20
Nodes (16): checkNoSelfRoll(), DENIAL_PATTERNS, detectCanonDenial(), detectInventedRoll(), detectLanguageDrift(), detectReasoningLeak(), detectSlopName(), detectUnledgeredName() (+8 more)

### Community 29 - "US-199 — O antagonista chega ao Mestre já revelado, e o Mestre puxa a mesa pra ele"
Cohesion: 0.15
Nodes (13): Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Notas de implementação, Os três canais (+5 more)

### Community 30 - "shared/package.json"
Cohesion: 0.11
Nodes (18): dependencies, zod, devDependencies, typescript, vitest, typescript, vitest, zod (+10 more)

### Community 31 - "US-11b Scene State Spec"
Cohesion: 0.12
Nodes (16): A proposta, Como o `sceneState` é alimentado (determinístico), Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História (+8 more)

### Community 32 - "US-239 — Motor entra em createForCharacter, ledger do artefato, gancho fixo vira alternativa opcional"
Cohesion: 0.18
Nodes (11): Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Notas de implementação, Precondições já entregues por outras stories (não é trabalho desta) (+3 more)

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

### Community 41 - "Backlog — Redesenho da criação de personagem (protótipo de referência)"
Cohesion: 0.22
Nodes (9): Backlog — Redesenho da criação de personagem (protótipo de referência), Fora do escopo deste backlog, Identidade visual: o protótipo já usa os nossos tokens, Mapeamento das etapas (a ordem que fica é a do produto, com a exceção de 2026-09-02 abaixo), O produto hoje, em uma linha, O protótipo, em uma linha, O que o produto tem e o protótipo não — nada disto se perde, O que o protótipo tem e o produto não (+1 more)

### Community 42 - "US-125 — Adventures & Advancement, conexão e memento da origem no prompt do Mestre"
Cohesion: 0.20
Nodes (10): Critérios de aceite, Dentro do escopo, Escopo desta story, Fora do escopo, História, Modelo de dados proposto, Notas de implementação, Por que não injetar `benefits[].description` cru para conexão/memento (+2 more)

### Community 43 - "roll-content.ts"
Cohesion: 0.09
Nodes (37): LgmrdSubsectionId, LgmrdTable, LgmrdTableRow, LgmrdTables, readLgmrdTables(), readSecretPrompts(), SECRET_PROMPT_CATEGORIES, SecretPromptCategory (+29 more)

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
Cohesion: 0.09
Nodes (32): ADR-0008, AUTHORING_PROVIDER_OPTIONS, authoringModels, DEEPSEEK_ALLOWED_PROVIDERS, DEEPSEEK_ENGINE_ROUTE, DEEPSEEK_ROUTE, DEEPSEEK_ROUTE_ORDER, ENGINE_PROVIDER_OPTIONS (+24 more)

### Community 52 - "Deploy Infra User Stories"
Cohesion: 0.29
Nodes (7): US-58 — Banco Postgres gerenciado na Neon, US-59 — API em produção no Render, US-60 — Web em produção na Vercel, US-61 — Login do jogador, US-62 — Acesso do Claude à Neon via MCP, US-63 — Acesso do Claude ao Render via MCP, US-64 — Acesso do Claude à Vercel via MCP

### Community 53 - "Nest CLI Config"
Cohesion: 0.33
Nodes (5): collection, compilerOptions, deleteOutDir, $schema, sourceRoot

### Community 54 - "API TSConfig/Prisma"
Cohesion: 0.15
Nodes (12): compilerOptions, emitDecoratorMetadata, experimentalDecorators, module, moduleResolution, outDir, extends, include (+4 more)

### Community 55 - "US-47 — Ingestão do SRD como dado"
Cohesion: 0.50
Nodes (4): US-47 — Ingestão do SRD como dado, US-51 — Kits iniciais derivados do SRD, US-52 — Tradução automática do SRD, US-54 — Chaves canônicas de classe em inglês

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
Cohesion: 0.10
Nodes (20): ai, @ai-dm/ai-engine, dependencies, ai, @ai-dm/ai-engine, @nestjs/core, @nestjs/platform-express, @nestjs/swagger (+12 more)

### Community 65 - "US-201 — Token de desenvolvimento para agentes testarem a API e os fluxos de tela"
Cohesion: 0.08
Nodes (24): 1. A conta de dev reivindica os órfãos e queima a reivindicação da mantenedora — **destrutivo**, 1. Provider `Credentials`, não injeção de cookie — **decidido**, 2. A conta de dev **não** entra no `db:seed` — **decidido, e é questão de segurança**, 2. O botão de login de dev reprova o gate de i18n, 3. `AUTH_SECRET` pode vir de duas fontes divergentes, 3. Só teste unitário — o CI já roda — **decidido**, 4. CSRF do sign-in por `Credentials`, 5. `pnpm dead` e o arquivo de teste do script (+16 more)

### Community 67 - "Bake-off README"
Cohesion: 0.33
Nodes (5): Bake-off narrativo (US-17) — como rodar, Notas, Pré-requisitos, Rodar (PowerShell), Variáveis

### Community 68 - "US-129 — Escolha do idioma concedido pelo benefício `language` do background"
Cohesion: 0.14
Nodes (14): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo (depois da US-214 implementada), Escopo, Fora do escopo, História, Modelo de dados proposto (+6 more)

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
Cohesion: 0.08
Nodes (25): CatalogCardEntry, CatalogCardGroup(), ARMOR_CATEGORY_LABEL, DRACONIC_ANCESTRY_COPY, DRACONIC_DAMAGE_TYPE_LABEL, GENDERS, groupToolsByCategory(), HIDDEN_DRAGONBORN_FEATURE_KEYS (+17 more)

### Community 90 - "US-103 — Saber qual endpoint serviu o turno"
Cohesion: 0.15
Nodes (13): Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Notas de implementação, O problema observado (+5 more)

### Community 91 - "ingest.test.mjs"
Cohesion: 0.05
Nodes (20): ATTACKS_DESC, ATTR_KEYS, ATTRS, CHECKS_DESC, d20Rules(), DWARF_RACES, ADR-0009, MOD_ROWS (+12 more)

### Community 92 - "US-177 — `generateLocationsAndNpcs` ganha a regra de Onomástica (hoje inventa nome sem registro nenhum)"
Cohesion: 0.15
Nodes (13): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Notas de implementação (+5 more)

### Community 93 - "US-213 — Etapa "Magias" no wizard, com escolha de truque do Alto-elfo"
Cohesion: 0.14
Nodes (14): Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Modelo de dados proposto, Notas de implementação (+6 more)

### Community 112 - "US-101 — Ganchos de aventura inicial em inglês"
Cohesion: 0.14
Nodes (14): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Notas de implementação (+6 more)

### Community 113 - "US-192 — Premissa nasce de rolagem simples, sem elaboração nem vínculo pessoal"
Cohesion: 0.14
Nodes (14): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Modelo de dados proposto (+6 more)

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

### Community 124 - "A sequência"
Cohesion: 0.09
Nodes (23): A sequência, A tensão central, Aviso de direitos — leia antes de CAIRN-1, Backlog — Tutorial "O Cairn Oculto", CAIRN-0 — Reescrever a prosa do zero (decisão fechada), CAIRN-10 — Eval: o Mestre roda o módulo ou improvisa por cima dele, CAIRN-11 — Vantagem / desvantagem em `rollDice`, CAIRN-12 — Luz e visão (+15 more)

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

### Community 145 - "US-93 — Três gates baratos: drift de migração, dependência vulnerável e smoke pós-deploy"
Cohesion: 0.15
Nodes (13): Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Já verificado no repo (não é critério de aceite, mas evita remedir), Notas de implementação (+5 more)

### Community 146 - "Design System "Grimório Vivo" — AI Dungeon Master"
Cohesion: 0.17
Nodes (12): 1. Tokens de cor, 2. Tipografia, 3. Primitivas, 4. Materialidade e layout, 5. Movimento, 6. Acessibilidade (invariantes da US-46 embutidas no sistema), 7. Checklist de tela nova, Contraste medido (não estimado) (+4 more)

### Community 149 - "Backlog — Motor de geração de aventuras autorais (mundo-primeiro)"
Cohesion: 0.22
Nodes (9): A migração: o que sobrevive, rebaixa, sai, nasce, Backlog — Motor de geração de aventuras autorais (mundo-primeiro), Corte mínimo, Decisões abertas, Decisões tomadas (2026-09-09, inversão), Depende de, O desenho (resumo — detalhe no doc de arquitetura), Referências no código (+1 more)

### Community 150 - "sheet.test.ts"
Cohesion: 0.29
Nodes (6): featuresEn, featuresPtBr, spellsEn, spellsPtBr, SystemClassFeature, SystemSpell

### Community 151 - "Camadas de teste"
Cohesion: 0.17
Nodes (12): 1. Testes unitários (todos os workspaces), 2. Testes de integração — não existem ainda, 3. Testes de componente (apps/web), 4. Evals do DM Agent (evals/), Camadas de teste, Estratégia de Testes e Evals — AI Dungeon Master, Estrutura de um eval case (evals/cases/), Flywheel de qualidade (após MVP) (+4 more)

### Community 152 - "US-109 — Espaço para bônus/penalidade circunstancial no teste de d20"
Cohesion: 0.14
Nodes (14): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Modelo de dados proposto (+6 more)

### Community 153 - "US-110 — Tabela de testes de habilidade do SRD 2024 escolhe o teste da situação"
Cohesion: 0.14
Nodes (14): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Modelo de dados proposto (+6 more)

### Community 154 - "US-229 — Escolha específica de arma no equipamento inicial"
Cohesion: 0.18
Nodes (11): Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Nota sobre esta versão, Notas de implementação (proposta, não vinculante) (+3 more)

### Community 155 - "US-120 — `logLlmFailure` em JSON estruturado (ADR 011, Camada 2 — Grupo B)"
Cohesion: 0.20
Nodes (10): Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Notas de implementação, Questões em aberto (+2 more)

### Community 156 - "buildStartingKits"
Cohesion: 0.23
Nodes (12): buildStartingKits(), firstAlternative(), localizeKitItems(), LOWERCASE_WORDS, parseA5ePackageEquipment(), parseClassEquipmentChoices(), parseSrdEquipmentBullets(), splitKitItems() (+4 more)

### Community 157 - "US-98 — Interface web em inglês (i18n das strings do front)"
Cohesion: 0.15
Nodes (13): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Notas de implementação (+5 more)

### Community 158 - "ADR 005 — Locale como dimensão (PT-BR / EN): preferência mutável + ficha por idioma"
Cohesion: 0.17
Nodes (12): 1. Contexto, 2.1 Faseamento, 2. Decisão, 3. Decisões-chave e justificativas, 4. Alternativas rejeitadas, 5. Consequências, 6. Implementação (referência), ADR 005 — Locale como dimensão (PT-BR / EN): preferência mutável + ficha por idioma (+4 more)

### Community 159 - "US-224 — Perícias à escolha seguem o catálogo e a contagem da classe"
Cohesion: 0.14
Nodes (14): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Modelo de dados proposto (+6 more)

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

### Community 164 - "monster-roles.ts"
Cohesion: 0.26
Nodes (11): encounterDeadlyThreshold(), singleMonsterCrCap(), assignCombatRoles(), buildEncounterNpcs(), chooseAntagonistRole(), composeEncounterRoles(), EncounterChallenge, MONSTER_ROLE_CR (+3 more)

### Community 167 - "2. Decisão"
Cohesion: 0.18
Nodes (11): 1. Contexto, 2. Decisão, 3. Alternativas rejeitadas, 4. Consequências, 5. Próximos passos, ADR 011 — Observabilidade em camadas: convenção antes de infraestrutura, Camada 0 — Formato: JSON estruturado, zero lib, Camada 1 — Correlação: `turnId` por turno (+3 more)

### Community 168 - "race-bonus.mjs"
Cohesion: 0.29
Nodes (9): attr(), ALL_ATTRS_PHRASE, buildRaceBonuses(), CHOICE_COUNT_WORDS, CHOICE_PHRASE, computeAsi(), formatAsiPhrase(), parseAbilityScoreIncrease() (+1 more)

### Community 169 - "entities.ts"
Cohesion: 0.36
Nodes (8): EdgePatch, EntityPatch, formatEdge(), formatEntities(), mergeEdges(), mergeEntities(), norm(), TIPO_LABEL

### Community 170 - "ability.ts"
Cohesion: 0.23
Nodes (14): abilityModifier(), buildSavingThrowSheet(), buildSkillSheet(), formatModifier(), maxHpForLevel(), parseHitDice(), proficiencyBonusForLevel(), ResolvedSavingThrow (+6 more)

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
Cohesion: 0.11
Nodes (31): DWARF_TOOL_PROFICIENCY_CHOICES, byLevelThenKey(), CharacterFeature, classFeatureList(), detectWeaponModePair(), EquipmentChoiceSlot, flattenWeaponOptions(), GENERIC_WEAPON_ITEMS (+23 more)

### Community 177 - "US-220 — Perícias proficientes concedidas por raça"
Cohesion: 0.14
Nodes (14): A proposta — mesma dupla de padrões que a US-215 já estabeleceu para ferramenta de raça, Colisão (o gatilho que a US-131 deixou marcado), Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História (+6 more)

### Community 178 - "dm.tsx"
Cohesion: 0.13
Nodes (19): emptyState(), HomeHero(), HubCharacter, { listCharacters, deleteCharacter }, LocaleToggle(), AdventureErrorScreen(), BtnProps, cn() (+11 more)

### Community 179 - "US-241 — Summary nasce da fórmula do LGMRD: conceito primário + "because" + MacGuffin"
Cohesion: 0.14
Nodes (14): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Modelo de dados proposto (+6 more)

### Community 180 - "US-196 — Narração usa vocabulário que o personagem não teria como conhecer"
Cohesion: 0.14
Nodes (13): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Notas de implementação (+5 more)

### Community 181 - "Endpoints (Fase 1 — MVP)"
Cohesion: 0.20
Nodes (10): Aventuras, Contratos de API — AI Dungeon Master, Convenções, DM Agent (streaming), Endpoints (Fase 1 — MVP), Multiplayer (Fase 4), Personagens — dono derivado do token, Sistemas — público (+2 more)

### Community 182 - "US-166 — Motor gera 8 encontros como situações completas (location, inhabitants, behaviors, goal, complications)"
Cohesion: 0.18
Nodes (11): Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Modelo de dados proposto, Notas de implementação (+3 more)

### Community 183 - ".create"
Cohesion: 0.33
Nodes (5): CreateUserSchema, ApiBody, ApiOperation, Body, Post

### Community 185 - "US-233 — Números dos encontros (PASSO 2, 5e determinístico)"
Cohesion: 0.18
Nodes (11): Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Modelo de dados proposto, Notas de implementação (+3 more)

### Community 186 - "PrismaService"
Cohesion: 0.06
Nodes (33): AdventureModule, loadControllerNames(), ORIGINAL_ENV, Module, AiModule, Module, AppModule, Module (+25 more)

### Community 187 - "US-237 — Remove seed, rebaixa LGMRD, mantém Monster Builder"
Cohesion: 0.18
Nodes (11): Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Nota (US-241, 2026-09-14), Notas de implementação (+3 more)

### Community 188 - "free-catalog.ts"
Cohesion: 0.21
Nodes (13): AUTHORED_FEATURES, AUTHORED_SPELLS, AuthoredEntry, authoredIn(), buildFreeClassFeatures(), buildFreeClassSpells(), classKeys(), freeFeatureRefs (+5 more)

### Community 189 - "adventure.service.ts"
Cohesion: 0.14
Nodes (13): AdventureOpeningContext, AdventureProfile, CreateAdventureDto, GENERATING_ADVENTURE_TITLE, configForLocale(), getSystemCached(), getSystemsCached(), LocaleMap (+5 more)

### Community 190 - "US-130 — `Culture`/`Engineering` no catálogo de perícias (`config.skills`)"
Cohesion: 0.15
Nodes (13): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Modelo de dados proposto (+5 more)

### Community 191 - "useT"
Cohesion: 0.16
Nodes (13): activeLocale(), cinzel, geist, generateMetadata(), RootLayout(), viewport, LoginPage(), AuthNav() (+5 more)

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

### Community 199 - "locale.ts"
Cohesion: 0.23
Nodes (8): isLocale(), Locale, localeLabel(), LOCALES, resolveLocale(), ADR-0005, SPELL_LEVEL_WORDS, spellLevelLabel()

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
Cohesion: 0.07
Nodes (35): configWithAbilityGrant(), configWithAlignments(), configWithBackgroundFeature(), configWithBackgrounds(), configWithBudget(), configWithCam(), configWithClassKit(), configWithClassToolChoice() (+27 more)

### Community 207 - "US-123 — Integração mecânica: bônus de atributo do background em `pointBuy`"
Cohesion: 0.14
Nodes (14): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Modelo de dados proposto (+6 more)

### Community 208 - "parseD10Tables.ts"
Cohesion: 0.29
Nodes (8): check(), SINGLE_BLOCK, SRD, D10Row, D10Table, parseD10Tables(), rowsOf(), signature()

### Community 209 - "US-178 — `locale` do jogador chega ao motor de geração (hoje as 4 chamadas escrevem só em pt-BR)"
Cohesion: 0.15
Nodes (13): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Notas de implementação (+5 more)

### Community 210 - "US-202 — Export da aventura gerada para análise manual de criatividade e coerência"
Cohesion: 0.12
Nodes (17): 1. A rota é de dev, atrás da porta dupla da US-201 — **decidido, e é questão de segurança**, 2. Flag própria `DEV_EXPORT`, não reuso do `DEV_LOGIN` — **decidido**, A proposta, Contexto e motivação, Critérios de aceite, Decisões (questões em aberto resolvidas), Dentro do escopo, Escopo (+9 more)

### Community 211 - "Backlog — Mapa em tempo real"
Cohesion: 0.22
Nodes (9): Backlog — Mapa em tempo real, Corte mínimo, Decisões abertas, Depende de, O estado verificado, O que fica de fora deste backlog, Referências externas, Referências no código (+1 more)

### Community 212 - "US-159 — Orçamento de encontro do LGMRD (Lazy Encounter Benchmark) para um personagem"
Cohesion: 0.14
Nodes (14): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Modelo de dados proposto (+6 more)

### Community 213 - "US-191 — Antagonista vira occupant do local do confronto final"
Cohesion: 0.14
Nodes (14): A proposta (duas partes), Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Modelo de dados proposto (+6 more)

### Community 214 - "CharacterController"
Cohesion: 0.12
Nodes (14): CharacterController, base, ApiBearerAuth, ApiBody, ApiOperation, ApiTags, Body, Controller (+6 more)

### Community 215 - "LocaleProvider.tsx"
Cohesion: 0.24
Nodes (8): gameProps, { getTurns, setLocale }, LOCALE_STORAGE_KEY, LocaleContext, LocaleContextValue, LocaleProvider(), rememberLocale(), storedLocale()

### Community 216 - "migrate-race-class-keys.test.ts"
Cohesion: 0.19
Nodes (12): CLASS_SYNONYMS, normalize(), RACE_ALIASES, enUS, ptBR, toClass(), toRace(), ADR-0009 (+4 more)

### Community 217 - "US-135 — Feature de origem (benefício `feature` do background) na criação e na ficha, como as features de classe"
Cohesion: 0.14
Nodes (14): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Modelo de dados proposto (+6 more)

### Community 218 - "int-db.ts"
Cohesion: 0.18
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

### Community 231 - "AdventureService"
Cohesion: 0.06
Nodes (32): ApiBearerAuth, ApiBody, ApiOperation, ApiQuery, ApiTags, AdventureController, CreateAdventureSchema, AdventureExportController (+24 more)

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

### Community 237 - "US-190 — Antagonista vira passo próprio, entre segredos e encontros — não mais sintetizado dentro do fecho"
Cohesion: 0.13
Nodes (15): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Modelo de dados proposto (+7 more)

### Community 238 - "US-143 — ADR: aventura gerada é regenerável ou congelada, e onde ela mora"
Cohesion: 0.15
Nodes (13): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Notas de implementação (+5 more)

### Community 239 - "2. Decisão"
Cohesion: 0.13
Nodes (15): 1. Contexto, 2. Decisão, 3. Decisões-chave e justificativas, 4. Alternativas rejeitadas, 5. Consequências, 6. Implementação (referência), ADR 012 — Aventura gerada: artefato autoral congelado, mundo-primeiro, coluna própria, D1 — Artefato grava congelado. `seed` não existe mais (+7 more)

### Community 240 - "extract-monster-roles.mjs"
Cohesion: 0.24
Nodes (7): DATA_PATH, extractMonsterRoles(), HERE, main(), OUT_PATH, SUBSECTION_IDS, FIXTURE

### Community 241 - "buildConfig"
Cohesion: 0.14
Nodes (24): buildAlignments(), buildClasses(), buildClassFeatures(), buildClassSpells(), buildConfig(), buildFeatureLevelMap(), buildLanguages(), buildRaceFeatures() (+16 more)

### Community 242 - "US-158 — Locais e NPCs com prosa (camada 2, antes dos segredos)"
Cohesion: 0.14
Nodes (14): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Modelo de dados proposto (+6 more)

### Community 243 - "US-179 — Barra de ofício da narração chega ao motor de geração (prosa gerada sem regra de qualidade)"
Cohesion: 0.17
Nodes (12): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Notas de implementação (+4 more)

### Community 244 - "AuthService"
Cohesion: 0.13
Nodes (14): AuthController, SetLocaleSchema, SyncSchema, ApiBearerAuth, ApiBody, ApiOperation, ApiTags, Body (+6 more)

### Community 245 - "extract-benchmark.mjs"
Cohesion: 0.24
Nodes (7): DATA_PATH, extractBenchmark(), HERE, main(), OUT_PATH, SUBSECTION_IDS, FIXTURE

### Community 246 - "US-176 — `generateSecrets` recebe `tone` do registro (hoje gerado cego a ele)"
Cohesion: 0.15
Nodes (13): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Notas de implementação (+5 more)

### Community 247 - "US-180 — `generateOpeningBeat` ignora vínculos do personagem e força abertura por combate quando nada se destaca"
Cohesion: 0.15
Nodes (13): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Notas de implementação (+5 more)

### Community 248 - "lazygm/sync.mjs"
Cohesion: 0.36
Nodes (6): buildNotice(), FILES, main(), NOTICE_PATH, OUT, quoteBlock()

### Community 249 - "Decisões-chave"
Cohesion: 0.10
Nodes (21): Abordagem recomendada, Abordagens consideradas, Arquitetura — Motor de aventuras autorais (mundo-primeiro), Artefatos do motor velho: descartados, sem migração, Camada de render: as 8 seções estilo módulo (DnDGenerate), Costura encontros ↔ mundo autorado (abordagem A), Decisões-chave, Derivação do personagem: gancho leve (não espinha) (+13 more)

### Community 250 - "Backlog — Combate por turno"
Cohesion: 0.18
Nodes (11): A pergunta de schema que os dois irmãos não tiveram que responder, Backlog — Combate por turno, Corte mínimo, Decisões abertas, Depende de, O estado verificado, O que fica de fora deste backlog, Referências externas (+3 more)

### Community 251 - "US-198 — Um resumo de uma frase para a aventura, não a premissa inteira"
Cohesion: 0.14
Nodes (14): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Modelo de dados proposto (+6 more)

### Community 252 - "devDependencies"
Cohesion: 0.11
Nodes (18): devDependencies, @nestjs/cli, prisma, @swc/core, ts-node, @types/express, typescript, unplugin-swc (+10 more)

### Community 253 - "US-184 — Jogador escolhe `setting`/`areaType` da aventura (revert do corte da US-173)"
Cohesion: 0.14
Nodes (14): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Notas de implementação (+6 more)

### Community 254 - "US-160 — Composer de encontro usa o limiar de soma, não só o teto de monstro único"
Cohesion: 0.13
Nodes (15): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Diff pronto (referência de implementação, TDD: aplicar o teste primeiro), Escopo, Fora do escopo, História (+7 more)

### Community 255 - "US-161 — Jogador escolhe o nível de desafio do encontro"
Cohesion: 0.14
Nodes (14): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Modelo de dados proposto (+6 more)

### Community 256 - "scripts"
Cohesion: 0.14
Nodes (14): scripts, build, db:migrate, db:migrate:deploy, db:migrate:feature-spell, db:migrate:race-class, db:migrate:race-languages, db:seed (+6 more)

### Community 257 - "Backlog — Classe de armadura e resolução de ataque"
Cohesion: 0.20
Nodes (10): A assimetria que define a ordem, Backlog — Classe de armadura e resolução de ataque, Corte mínimo, Decisões abertas, Depende de, O estado verificado, O que fica de fora deste backlog, Referências externas (+2 more)

### Community 258 - "US-47 — Ingestão do SRD 5e (2024) como dado do sistema"
Cohesion: 0.27
Nodes (4): US-46 — Acessibilidade da aplicação web (WCAG 2.2 AA), US-47 — Ingestão do SRD 5e (2024) como dado do sistema, US-66 — Todas as telas mobile-friendly, US-68 — Nomes de fantasia originais

### Community 259 - "US-164 — Orquestrador do motor: monta o `GeneratedAdventure` e gera o fecho ramificado"
Cohesion: 0.14
Nodes (14): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Modelo de dados proposto (+6 more)

### Community 260 - "US-165 — Tela: jogador escolhe o nível de desafio do encontro"
Cohesion: 0.14
Nodes (14): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Modelo de dados proposto (+6 more)

### Community 261 - ".mcp.json"
Cohesion: 0.67
Nodes (3): npx, shadcn, vp0

### Community 262 - "backlog-aventuras-autorais-lazygm.md"
Cohesion: 0.24
Nodes (6): US-67 — Editar a ação enviada ao DM, US-69 — Guard anti-degeneração da narração, US-71 — Simplificar a localização do personagem, US-73 — Reconciliador de cena em background, US-74 — Guard de turno truncado, US-87 — O prompt para de afirmar que existe um bloco de entidades que o turn-state não emitiu

### Community 263 - "draconic-ancestry.ts"
Cohesion: 0.40
Nodes (4): DRACONIC_ANCESTRY_TABLE, DraconicAncestryEntry, DraconicBreathShape, DraconicDamageType

### Community 264 - "api.ts"
Cohesion: 0.26
Nodes (10): AuthTokenBridge(), Providers(), api, assertOk(), authHeaders(), del(), get(), patch() (+2 more)

### Community 265 - "messages/index.ts"
Cohesion: 0.16
Nodes (12): config, { listSystems, setLocale }, AdventureLoadingScreen(), LOADING_KEYS, shuffled(), enUS, DICTIONARIES, fill() (+4 more)

### Community 266 - "2. Decisão"
Cohesion: 0.14
Nodes (14): 1. Contexto, 2.1 Topologia, 2. Decisão, 3. Decisões-chave e justificativas, 4. Alternativas rejeitadas, 5. Consequências, 6. Implementação (referência), ADR 006 — Deploy a custo zero (Fase 1) (+6 more)

### Community 267 - "US-242 — NPC perde `interactions`: fala pré-escrita nunca chega ao turno ao vivo"
Cohesion: 0.14
Nodes (14): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Modelo de dados proposto (+6 more)

### Community 268 - "US-167 — Motor consome o `challenge` escolhido pelo jogador na geração real"
Cohesion: 0.13
Nodes (15): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Descobertas na implementação (o escopo original não previa), Escopo, Fora do escopo, História (+7 more)

### Community 271 - "character.service.test.ts"
Cohesion: 0.22
Nodes (5): catalogEn, catalogPt, config, configWithAlignments, systemRow

### Community 272 - "adventure-gate.ts"
Cohesion: 0.15
Nodes (24): checkAdventureGraph(), checkChallengeLocationIds(), checkEncounterBudget(), checkEncounterReferences(), checkNoOrphanLocations(), checkNoOrphanNpcs(), checkNoOrphans(), checkOccupantReferences() (+16 more)

### Community 273 - "adventure-authoring-spike.mjs"
Cohesion: 0.11
Nodes (13): ARMS, body, dir, log(), PACE_MS, path, PO, PROFILE (+5 more)

### Community 274 - "US-214 — Idiomas fixos de raça na ficha, e escolha do idioma extra (Alto-elfo, Humano, Meio-elfo)"
Cohesion: 0.13
Nodes (15): A proposta, Consequência: resolver os 3 sintomas cria repetição na aba Features, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História (+7 more)

### Community 275 - "US-168 — Abertura narrada expande o gancho fixo, não a aventura gerada"
Cohesion: 0.15
Nodes (13): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Notas de implementação (+5 more)

### Community 276 - "US-209 — Trazer `hit_dice` e `saving_throws` do dataset para `config.classes`"
Cohesion: 0.15
Nodes (13): Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Modelo de dados proposto, Notas de implementação (+5 more)

### Community 277 - "us-154-eval-aventura-gerada.ts"
Cohesion: 0.38
Nodes (5): adventure, block(), MONSTER_NPC_IDS, seedEntities(), sheet

### Community 278 - "US-181 — Antagonista ganha `want`/`method` estruturados no artefato gerado"
Cohesion: 0.13
Nodes (15): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Modelo de dados proposto (+7 more)

### Community 279 - "ADR 004 — Origem do dado de sistema: ingestão do SRD por pipeline pinado"
Cohesion: 0.17
Nodes (12): 1. Contexto, 2. Decisão, 3.1 Revisão da decisão 6 (02/08/2026): o Free herda o SRD, 3.2 Correção de procedência (03/08/2026): o kit inicial é CC-BY, não OGL, 3.3 Segundo publisher no config (09/08/2026): `a5e-ag` entra sob a mesma regra de licença única, 3.4 Exceção pontual (13/08/2026): `ability` de `Culture`/`Engineering` não vem do Open5e, 3. Decisões-chave e justificativas, 4. A descoberta que só apareceu cutucando o dataset (+4 more)

### Community 280 - "adventure-export.ts"
Cohesion: 0.15
Nodes (17): AdventureExportAdventure, AdventureExportCharacter, AdventureExportCharacterState, AdventureExportData, AdventureExportEventLog, AdventureExportQuest, AdventureExportSystem, AdventureExportView (+9 more)

### Community 281 - "US-173 — Registro da aventura fica só com `tone`; `settings` e `areaTypes` saem do catálogo"
Cohesion: 0.14
Nodes (14): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Modelo de dados proposto (+6 more)

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

### Community 287 - "ai.service.ts"
Cohesion: 0.05
Nodes (39): ChatBodySchema, ApiBody, ApiOperation, Body, Post, Res, AiService, AnchoredRoll (+31 more)

### Community 288 - "us-171-eval-combatente-no-ledger.ts"
Cohesion: 0.40
Nodes (4): adventure, block(), seedEncounterEntities(), sheet

### Community 289 - "US-217 — "Aventura pronta" pula o motor de MUNDO, abertura continua gerada por IA (revert pontual da US-153/US-155)"
Cohesion: 0.13
Nodes (15): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Investigação: o que "como era antes" significa de verdade (+7 more)

### Community 290 - "US-226 — Equipamento inicial à escolha por classe (arma, armadura e pacote de aventura)"
Cohesion: 0.14
Nodes (14): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Modelo de dados proposto (+6 more)

### Community 292 - "US-182 — Abertura gerada mira ao menos 2 de recompensa/heroísmo/descoberta, não só urgência"
Cohesion: 0.13
Nodes (15): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Modelo de dados proposto (+7 more)

### Community 293 - "US-183 — Antagonista ganha conexão pessoal com o personagem no artefato gerado"
Cohesion: 0.13
Nodes (15): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Modelo de dados proposto (+7 more)

### Community 294 - "US-185 — Mestre recebe `setting`/`areaType` em todo turno, não só `tone`"
Cohesion: 0.13
Nodes (15): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Modelo de dados proposto (+7 more)

### Community 295 - "US-186 — `setting`/`areaType` somam ao `tone` nos 4 consumidores de prosa que faltavam; `rollContent` segue sem `registry`"
Cohesion: 0.14
Nodes (14): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Notas de implementação (+6 more)

### Community 296 - "US-187 — Distribuição de `locationId` nos encontros passa a ser temática, não só round-robin"
Cohesion: 0.13
Nodes (15): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Modelo de dados proposto (+7 more)

### Community 297 - "US-188 — Antagonista vira NPC rastreável, encontro final referencia por `id`"
Cohesion: 0.13
Nodes (15): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Modelo de dados proposto (+7 more)

### Community 298 - "us-170-eval-local-no-ledger.ts"
Cohesion: 0.40
Nodes (4): adventure, block(), seedEntities(), sheet

### Community 299 - "US-189 — Antagonista entra no ledger e chega ao Mestre durante o turno"
Cohesion: 0.12
Nodes (16): A proposta, Contexto e motivação, Critérios de aceite, Decisões fechadas, Dentro do escopo, Escopo, Fora do escopo, História (+8 more)

### Community 300 - "adventure-generation.ts"
Cohesion: 0.10
Nodes (18): resolveArtifact(), AdventureChallenge, AdventureChallengeSchema, AdventureEncounter, AdventureEncounterSchema, AdventureFactionSchema, AdventureLocation, AdventureLocationSchema (+10 more)

### Community 301 - "US-223 — Proficiência de arma legível na revisão (categoria no valor, não no rótulo)"
Cohesion: 0.14
Nodes (14): A linha logo abaixo já faz certo — na MESMA story, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Modelo de dados (+6 more)

### Community 302 - "translate-srd.ts"
Cohesion: 0.33
Nodes (7): DraftsSchema, GlossaryTerm, pickRequested(), SrdEntry, systemPrompt(), translateBatch(), translateSrdToPtBr()

### Community 303 - "US-216 — Escolher entre aventura pronta (gancho por classe) ou criar a própria história"
Cohesion: 0.14
Nodes (14): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Modelo de dados proposto (+6 more)

### Community 304 - "US-200 — Motor que sincroniza item pego ou largado pela personagem com o inventário"
Cohesion: 0.18
Nodes (11): A proposta, Critérios de aceite, Dentro, Escopo, Fora do escopo, História, Modelo de dados, Notas de implementação (+3 more)

### Community 306 - "US-193 — Os 8 encontros nascem sem cadeia causal entre si"
Cohesion: 0.12
Nodes (16): Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Modelo de dados proposto, Notas de implementação (+8 more)

### Community 307 - "US-194 — Abertura e encontro 1 competem como cena inicial"
Cohesion: 0.13
Nodes (15): Contexto e motivação, Critérios de aceite, Defeito de brinde: a cena de abertura volta pro Mestre todo turno, Dentro do escopo, Escopo, Fora do escopo, História, Notas de implementação (+7 more)

### Community 309 - "SystemController"
Cohesion: 0.25
Nodes (6): SystemController, ApiOperation, ApiTags, Controller, Get, UseGuards

### Community 310 - "PRD — AI Dungeon Master"
Cohesion: 0.20
Nodes (10): 1. Declaração do problema, 2. Objetivos e critério de aceite, 3. Usuários alvo, 4.1 Personagens e campanhas, 4.2 Multiplayer, 4.3 Sistemas e aventuras, 4. Casos de uso, 5. Fora do escopo (v1) (+2 more)

### Community 311 - "US-222 — Salvaguardas de classe na ficha do personagem"
Cohesion: 0.15
Nodes (13): Contexto e motivação, Critérios de aceite, Dentro do escopo, Diferença central para perícias (US-27): não há escolha, é sempre as 6 linhas, Escopo, Fora do escopo, História, Modelo de dados proposto (+5 more)

### Community 312 - "US-197 — Tela de espera com carrossel de mensagens na criação da aventura"
Cohesion: 0.14
Nodes (14): A proposta, Contexto e motivação, Copy das mensagens, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História (+6 more)

### Community 313 - "011-observabilidade-em-camadas.md"
Cohesion: 0.14
Nodes (11): US-89 — Export que ninguém importa para de sobreviver no repo, Diagrama de entidades (núcleo), Modelo de Dados — AI Dungeon Master, Notas de design, Índices e constraints principais, Antes de abrir PR, Antes de merge para main, Checklist de Deploy — AI Dungeon Master (+3 more)

### Community 314 - "@prisma/client"
Cohesion: 0.27
Nodes (8): @prisma/client, computeBackfill(), main(), STALE_FEATURE_KEYS, WRITE, main(), truncateGameTables(), @prisma/client

### Community 315 - "US-195 — Eval de embaralhamento da cadeia causal entre encontros"
Cohesion: 0.25
Nodes (8): Achado (o que já foi tentado, com números reais), Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Opções (para decidir no início desta story, não implementar as três), US-195 — Eval de embaralhamento da cadeia causal entre encontros

### Community 316 - "US-231 — Features de classe e subclasse por nível, na criação e na ficha"
Cohesion: 0.14
Nodes (14): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Modelo de dados proposto (+6 more)

### Community 317 - "US-203 — Prosa curta de catálogo: chamada e resumo de classe e de raça"
Cohesion: 0.12
Nodes (16): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Modelo de dados proposto (+8 more)

### Community 318 - "US-236 — Params de mundo como restrição no prompt + toggle pronta×criar"
Cohesion: 0.20
Nodes (10): Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Notas de implementação, Questões em aberto (+2 more)

### Community 319 - "shuffle-encounter-types.ts"
Cohesion: 0.23
Nodes (8): pickLocationIdForType(), COMBAT_INVIABLE_MULTISET, COMBAT_VIABLE_MULTISET, EncounterType, greedyNoAdjacentSequence(), hasAdjacentRepeat(), repairLastSlotCollision(), shuffleEncounterTypes()

### Community 320 - "design-sync — repo notes (apps/web)"
Cohesion: 0.12
Nodes (15): `cfg.srcDir: "src/components"` — NOT the default `src/`, `cssEntry` is a COMPILED file, not raw `globals.css`, `.design-sync/overrides/bundle.mjs` fork (`cfg.libOverrides`), design-sync — repo notes (apps/web), `extraEntries: ["next-auth/react"]`, Floor-card-only: GameView, SetupWizard, Font fidelity gap (see `conventions.md`), HomeHero scope decision (+7 more)

### Community 321 - "US-02 — Inventário do personagem e equipamento inicial"
Cohesion: 0.15
Nodes (13): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Equipamentos iniciais por classe, Escopo, Fora do escopo, História (+5 more)

### Community 322 - "paths"
Cohesion: 0.20
Nodes (9): compilerOptions, baseUrl, paths, @/messages, next/image, next/link, ./.design-sync-shims/next-image.tsx, ./.design-sync-shims/next-link.tsx (+1 more)

### Community 324 - "bundle.mjs"
Cohesion: 0.36
Nodes (5): bundleExportEvidence(), bundleToIife(), reactShim, sharedBuildOptions(), tsconfigPathsPlugin()

### Community 325 - "US-225 — Subclasse única aparece como cartão selecionado, não como texto solto"
Cohesion: 0.17
Nodes (12): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Notas de implementação (+4 more)

### Community 326 - "conventions.md"
Cohesion: 0.33
Nodes (5): Fonts, Helper functions — when to reach for them, Primitives — composition rules, Provider wrap (required for every composition), Token system — "nenhuma tela escreve cor literal"

### Community 327 - "US-211 — Ancestralidade dracônica do Dragonborn (escolha de tipo de dragão)"
Cohesion: 0.12
Nodes (16): Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Modelo de dados proposto, Notas de implementação (+8 more)

### Community 338 - "adventure.service.test.ts"
Cohesion: 0.24
Nodes (8): authored(), combatAuthored(), config, createAndGenerate(), fakeAi(), fakePrisma(), Recorded, service()

### Community 345 - "dev-token.mjs"
Cohesion: 0.73
Nodes (5): b64url(), main(), sign(), syncDevAccount(), withExp()

### Community 346 - "US-230 — Arma genérica composta ("e um escudo") e em dobro ("duas armas") no equipamento inicial"
Cohesion: 0.17
Nodes (12): Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Nota sobre esta story, Notas de implementação (proposta, não vinculante) (+4 more)

### Community 347 - "US-234 — Gate: parse + grafo + orçamento + saneamento, regenera-on-fail"
Cohesion: 0.20
Nodes (10): Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Notas de implementação, Questões em aberto (+2 more)

### Community 348 - "US-212 — Integração mecânica: bônus de atributo de raça na etapa de atributos"
Cohesion: 0.14
Nodes (14): Contexto e motivação, Critérios de aceite, Dentro do escopo, Duas fontes de bônus podem coexistir na mesma linha, Escopo, Fora do escopo, História, Modelo de dados proposto (+6 more)

### Community 349 - "US-205 — Escolha por cartão no lugar dos selects de classe e raça"
Cohesion: 0.14
Nodes (14): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Duas decisões de 2026-09-02, Escopo, Fora do escopo, História (+6 more)

### Community 350 - "US-110-tabela-de-testes-de-habilidade-do-srd-2024.md"
Cohesion: 0.21
Nodes (10): Modificadores de atributo — tabela do SRD 2024, O que cada faixa de pontuação significa (SRD 2024), Onde isto é usado, Regra de cálculo, Tabela de modificadores (SRD 2024), US-38 — Rolagens ancoradas na ficha, US-70 — Piso por dimensão e robustez do eval, US-72 — Evals de prompt resistentes à reescrita (+2 more)

### Community 351 - "US-204 — Wizard em duas colunas: a ficha viva "Seu personagem" ao lado das etapas"
Cohesion: 0.15
Nodes (13): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Notas de implementação (+5 more)

### Community 352 - "backlog-motor-de-geracao-de-aventuras.md"
Cohesion: 0.09
Nodes (15): US-34 — Qualidade cinematográfica da narração do AI DM, US-35 — Estado de cena estruturado já na abertura da aventura, US-36 — Eval de qualidade da narração do DM, US-75 — Dimensões de conhecimento no ledger, US-83 — README com arquitetura de alto nível, US-86 — Árvore de diretórios na documentação deixa de mentir sobre onde o arquivo está, US-88 — Doc que ordena deixa de citar API que não existe, US-90 — README de evals com o mapa do subsistema (+7 more)

### Community 353 - "seed-ledger.ts"
Cohesion: 0.39
Nodes (6): encounter(), findOccupiedLocationTitle(), seedLedgerFromGeneratedAdventure(), adventureFixture(), chal(), enc()

### Community 354 - "US-210 — Identidade como etapa própria (nome, gênero e alinhamento)"
Cohesion: 0.17
Nodes (12): A decisão da US-205 tinha uma exceção nomeada — esta story é a segunda, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Modelo de dados proposto (+4 more)

### Community 356 - "US-206 — Origem por cartão, com os campos livres de história no mesmo desenho"
Cohesion: 0.15
Nodes (13): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Notas de implementação (+5 more)

### Community 357 - "US-207 — Atributos e perícias: orçamento visível, atributo principal e modificador na tela"
Cohesion: 0.15
Nodes (13): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Notas de implementação (+5 more)

### Community 358 - "US-208 — A revisão lê como ficha do personagem, não como lista de campos"
Cohesion: 0.15
Nodes (13): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Notas de implementação (+5 more)

### Community 359 - "initial-adventures.ts"
Cohesion: 0.21
Nodes (7): dnd5eInitialAdventuresEnUs, dnd5eInitialAdventuresPtBr, InitialAdventures, initialAdventuresByLocale, textFields, resolveHookTemplate(), resolveInitialHook()

### Community 360 - "auth.ts"
Cohesion: 0.16
Nodes (8): { handlers, auth }, secretKey(), signApiToken(), ADR-0006, providers, loadProviders(), config, ADR-0006

### Community 361 - "US-235 — Gatilho assíncrono + tela de espera + erro/retry"
Cohesion: 0.17
Nodes (12): Contexto e motivação, Critérios de aceite, Decisões técnicas (achados resolvidos antes da implementação), Dentro do escopo, Escopo, Fora do escopo, História, Notas de implementação (+4 more)

### Community 362 - "shared/src/index.ts"
Cohesion: 0.11
Nodes (12): createSeededRandom(), deriveAdventureSeed(), RACE_EXTRA_LANGUAGE_CHOICE, RACE_LANGUAGES, RACE_SKILL_PROFICIENCIES, RACE_SKILL_PROFICIENCY_CHOICES, RACE_TOOL_PROFICIENCIES, RACE_WEAPON_PROFICIENCIES (+4 more)

### Community 364 - "adventure-gate.test.ts"
Cohesion: 0.60
Nodes (4): enc(), npc(), SKILL_CATALOG, validAdventure()

### Community 365 - "US-127-revisao-espelha-ficha-completa.md"
Cohesion: 0.43
Nodes (3): US-41 — Features de classe conhecidas pelo mestre, US-42 — Magias conhecidas pelo mestre, US-45 — Background visível na ficha do personagem

### Community 367 - "Repositórios de referência — registro e regra de uso"
Cohesion: 0.33
Nodes (6): A regra em cinco linhas, Como citar numa US, ADR ou backlog, Portão de licença, Quando re-triar, Registro, Repositórios de referência — registro e regra de uso

### Community 368 - "character/FeaturesPanel.tsx"
Cohesion: 0.60
Nodes (3): FeaturesPanel(), ORIGIN_TAG_KEY, useLocale()

### Community 369 - "US-218 — Busca por palavra-chave no quadro Kanban"
Cohesion: 0.14
Nodes (13): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Notas de implementação (+5 more)

### Community 371 - "US-221 — Proficiências de arma, armadura e ferramenta por classe"
Cohesion: 0.15
Nodes (13): Achado: não existe catálogo de categoria de arma/armadura no dataset, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Ferramenta é o único dos três com pool de ESCOLHA — e o catálogo já existe, Fora do escopo, História (+5 more)

### Community 372 - "api/package.json"
Cohesion: 0.50
Nodes (3): name, private, version

### Community 373 - "check-ci-order.mjs"
Cohesion: 0.33
Nodes (5): CI_YML, CONSTRAINTS, problems, stepNames, text

### Community 374 - "@ai-dm/shared"
Cohesion: 0.67
Nodes (3): @ai-dm/shared, @ai-dm/shared, @ai-dm/shared

### Community 376 - "CharacterService"
Cohesion: 0.19
Nodes (3): CreateCharacterDto, CharacterService, Injectable

### Community 378 - "zod"
Cohesion: 0.67
Nodes (3): zod, zod, zod

### Community 380 - "A Cripta do Véu Silencioso"
Cohesion: 0.20
Nodes (10): A Cripta do Véu Silencioso, Challenges, Encounters, Exemplar — A Cripta do Véu Silencioso, Follow Up Ideas, Locations, NPCs, Objective (+2 more)

### Community 381 - "US-227 — Nível inicial à escolha na criação, com PV e bônus de proficiência derivados de classe+nível"
Cohesion: 0.14
Nodes (14): A proposta, Contexto e motivação, Critérios de aceite, Dentro do escopo, Escopo, Fora do escopo, História, Modelo de dados proposto (+6 more)

## Knowledge Gaps
- **2731 isolated node(s):** `config`, `Recorded`, `CreateAdventureDto`, `GENERATING_ADVENTURE_TITLE`, `AdventureOpeningContext` (+2726 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **54 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ADR-0005` connect `ADR-0005` to `ingest.mjs`, `dm-system.ts`, `roll-content.ts`, `seed.ts`, `PrismaService`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **Why does `US-47 — Ingestão do SRD 5e (2024) como dado do sistema` connect `US-47 — Ingestão do SRD 5e (2024) como dado do sistema` to `backlog-motor-de-geracao-de-aventuras.md`, `US-121-catalogo-backgrounds-a5e-adventurers-guide.md`, `backlog-aventuras-autorais-lazygm.md`, `US-127-revisao-espelha-ficha-completa.md`, `US-221-proficiencias-de-arma-armadura-e-ferramenta-por-classe.md`, `US-105-raca-e-classe-por-chave-do-srd.md`, `US-110-tabela-de-testes-de-habilidade-do-srd-2024.md`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Why does `SystemConfigSchema` connect `system.ts` to `CharacterService`, `buildConfig`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **What connects `config`, `Recorded`, `CreateAdventureDto` to the rest of the system?**
  _2731 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `ingest.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.06079664570230608 - nodes in this community are weakly interconnected._
- **Should `dm-system.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.10256410256410256 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.043478260869565216 - nodes in this community are weakly interconnected._