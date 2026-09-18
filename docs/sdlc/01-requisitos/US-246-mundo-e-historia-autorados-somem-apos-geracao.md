# US-246 — `world` e `story` autorados somem depois da geração, o Mestre nunca os lê em jogo

**Épico:** 3 — Narração e mecânica
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada (18/09/2026)
**Depende de:** nenhuma — `GeneratedAdventure.world`/`.story` já existem e já são gravados; é questão de PASSAR o que já existe pra outro lugar, não gerar dado novo.
**Relacionado:** [US-151](./US-151-semear-ledger-segredos-gerados.md) (`seedLedgerFromGeneratedAdventure`, o mesmo padrão de "ler o artefato e semear o ledger" que esta story estende) · [US-157](./US-157-tela-de-mundo-depois-da-revisao.md) (hoje o ÚNICO consumidor de `world`, e é tela — não IA) · [US-232](./US-232-schema-cresce-e-prompt-de-autoria-call-unico.md) (introduziu `world`/`story` no schema) · [US-75](./US-75-dimensao-de-proveniencia-no-ledger.md) (regras de provenance/oculto que qualquer entrada nova no ledger precisa respeitar)
**Criada em:** 2026-09-16 — achado ao mapear quais campos de `GeneratedAdventure` o DM Agent lê em jogo (ver conversa que originou esta story).

---

## História

> **Como** jogadora numa campanha que já passou da abertura,
> **quero** que o Mestre lembre da geografia e da história do mundo que a própria autoria escreveu para esta aventura,
> **para que** ele nunca contradiga um fato do mundo (um lugar citado como âncora, um evento do pano de fundo) só porque esse texto nunca chegou até ele.

---

## Contexto e motivação

### O problema observado

`AUTHORING_SCHEMA` ([ai.service.ts:115-121](../../../apps/api/src/ai/ai.service.ts)) pede à autoria dois campos de prosa rica:

```
world: { name, description: '2-3 parágrafos de worldbuilding sensorial', anchors: string[] }
story: 'A seção Story: o que está errado + as forças (facções dissolvidas na prosa)'
```

Esse texto é escrito com a mesma barra de qualidade do resto do artefato (`CRAFT_CORE_SECTION`/onomástica), sobrevive ao gate (só passa por `sanitizeProse`, [adventure-gate.ts:207-208](../../../apps/api/src/adventure-generation/adventure-gate.ts)) e é gravado em `GeneratedAdventure.world`/`.story` ([adventure.service.ts:339-340](../../../apps/api/src/adventure/adventure.service.ts)).

Depois disso, os dois campos têm exatamente UM consumidor no repo inteiro: a tela de setup do frontend (`SetupWizard.tsx`, `AdventureLoadingScreen.tsx` — grep confirma, nenhum arquivo de `apps/api/src/ai` ou `packages/ai-engine` toca `.world`/`.story`). O DM Agent que narra os 40+ turnos da campanha:

- Na abertura, só recebe `mainQuest = \`${generated.summary}\n${generated.start}\`` ([adventure.service.ts:641](../../../apps/api/src/adventure/adventure.service.ts)) — `summary` é 1 linha, `start` é só o gancho final da Story. Nenhum dos dois carrega o worldbuilding (`world.description`) nem o conflito completo (`story`).
- Em todo turno, `buildTurnStateBlock` ([dm-system.ts:548](../../../packages/ai-engine/src/prompts/dm-system.ts)) reinjeta `entities` (NPCs/locais/facções do ledger) e `mainQuest`, mas nunca `world`/`story`.

Concretamente: `world.anchors` é uma lista de localidades-âncora nomeadas pela autoria (ex.: no artefato de referência, `"Thurnhavn — a cidade-porto no fiorde oriental, sede do trono"`) que **não** viram necessariamente `locations[]` — são pano de fundo geográfico. Se a jogadora perguntar sobre Thurnhavn no meio da campanha, o Mestre não tem esse dado em lugar nenhum do prompt e precisa inventar do zero, arriscando contradizer o que a própria autoria já decidiu (nome, natureza do lugar).

### Por que a solução atual não basta

`seedLedgerFromGeneratedAdventure` ([seed-ledger.ts:20](../../../apps/api/src/adventure-generation/seed-ledger.ts)) já é o mecanismo que decide o que do artefato vira memória durável (`WorldEntity[]`) — mas hoje só lê `factions`/`npcs`/`locations`/`encounters`/`challenges`. `world`/`story` nunca entram nessa função, então nunca entram no ledger, que é a única estrutura que `buildTurnStateBlock` reinjeta todo turno.

### A proposta

Estender `seedLedgerFromGeneratedAdventure` para semear o ledger também com o que `world`/`story` estabelecem — sem duplicar a prosa inteira a cada turno (custo de tokens): `world.anchors[]` vira entidades `tipo: 'local'` (mesmo padrão dos locais autorados, `revelado: false`), e um resumo curto de `world.description`/`story` (não o texto de 2-3 parágrafos inteiro) fica disponível como uma entidade única de referência (ex.: `tipo: 'outro'`, nome = `world.name`) — o bastante para o Mestre não contradizer geografia/história sem inflar o bloco todo turno.

---

## Escopo

### Dentro do escopo

- `seedLedgerFromGeneratedAdventure` ganha uma terceira fonte: `world.anchors[]` vira `WorldEntity[]` (`tipo: 'local'`, `nota` = o próprio texto do anchor, `revelado: false` — mesma disciplina "nada nasce conhecido" das demais entradas).
- Uma entidade adicional (nome = `world.name`, `tipo: 'outro'` — decidido, ver Notas de implementação) carrega uma síntese do `world.description` + `story` — não o texto integral (ver Notas de implementação sobre custo).
- Teste cobrindo: anchors viram entidades; a entidade de mundo aparece com `revelado: false`; ausência de `world`/`story` (não deveria acontecer, mas o parse já exige os dois — sem novo guard).
- `pnpm eval` roda e passa (mudança no que chega ao prompt do DM Agent via ledger).

### Fora do escopo

- Mudar `AUTHORING_SCHEMA.world`/`.story` ou o prompt de autoria — o texto já sai bem escrito; esta story muda o que é CONSUMIDO depois, não como é produzido.
- Injetar `world.description`/`story` PALAVRA POR PALAVRA em qualquer bloco do prompt — custo de cache/tokens todo turno; a síntese por truncamento resolve o mesmo problema mais barato (decidido, ver Notas de implementação).
- Mudar a tela de setup (`SetupWizard.tsx`) que já exibe `world` à jogadora — continua sendo o consumidor de apresentação, sem relação com esta story.
- Resolver colisão entre um `anchor` e uma `location` que descreve o mesmo lugar por nome ligeiramente diferente (ex.: "Thurnhavn" no anchor vs. uma location chamada "Thurnhavn — Salão do Trono") — heurística de dedupe fica de fora; pior caso hoje é uma entidade redundante no ledger, não uma contradição.

---

## Critérios de aceite

- [x] Depois de gerar uma aventura, cada string de `world.anchors[]` aparece como uma `WorldEntity` (`tipo: 'local'`) no ledger semeado.
- [x] Existe no ledger semeado uma entidade que sintetiza `world.description`+`story` (não o texto integral, ver Notas de implementação), acessível ao Mestre em `buildTurnStateBlock` como qualquer outra entidade.
- [x] Todas as entidades novas nascem `revelado: false` — mesma disciplina das demais (US-151).
- [x] O Mestre, ao ser perguntado sobre um `anchor` ainda não visitado, tem no ledger o nome e a nota necessários para responder sem inventar do zero (verificável por teste do formato do ledger, não por QA de narração — ver eval).
- [x] **Eval / teste de regressão:** artefato com `world.anchors` = `["Thurnhavn — sede do trono"]` gera uma entidade `nome: "Thurnhavn"` (ou equivalente) no ledger; sem esta story, essa entidade não existe e o teste falha.
- [x] `pnpm typecheck`, `pnpm test` e `pnpm eval` passam.

---

## Notas de implementação

> *Dicas. O implementador pode divergir com boa justificativa.*

- Arquivo principal: [apps/api/src/adventure-generation/seed-ledger.ts](../../../apps/api/src/adventure-generation/seed-ledger.ts) — `seedLedgerFromGeneratedAdventure`, mesmo padrão de `factionEntities`/`npcEntities`/`locationEntities` já ali.
- **Síntese, não cópia integral (decidido):** truncamento determinístico, não chamada de LLM — `seedLedgerFromGeneratedAdventure` é síncrona por design ("leitura determinística de um objeto estruturado, não extração por LLM" — comentário no topo do arquivo); uma chamada de extração quebraria esse contrato, tornaria a função assíncrona, e somaria mais um ponto de falha/timeout à escada de autoria que já precisou de correção recente (commit "Timeout por tentativa na escada de autoria e abertura"). Heurística: primeira frase de `world.description` + primeira frase de `story`, concatenadas, cortadas em ~300 caracteres (arredondar pra fim de frase, não no meio). Colar `world.description` cru injetaria esse texto todo turno via `entitiesSection` (dm-system.ts:625) — mesmo custo de cache que a US-56 (camadas por volatilidade) já evitou deslocando estado volátil pra fora do system. Se a perda de fidelidade se mostrar problema real em produção, revisitar como story separada — não bloquear esta.
- `WorldEntity.tipo` hoje é `'npc' | 'local' | 'objeto' | 'faccao' | 'outro'` (character.ts) — **decidido: usar `'outro'`**, sem novo valor de enum. Um tipo `'mundo'` dedicado exigiria mudança de schema (`packages/shared`) propagada a `formatEntities` (entities.ts) e `pnpm --filter @ai-dm/shared build` para uma única entidade por aventura — custo que não se paga aqui.
- `findOccupiedLocationTitle` (seed-ledger.ts:90) não se aplica a anchors — eles não têm `occupants`; a entidade nasce sem `local`.
- **Gap achado na revisão:** `AdventureWorldSchema.anchors` é `z.array(z.string()).optional()` ([adventure-generation.ts:31](../../../packages/shared/src/types/adventure-generation.ts)) — pode vir `undefined`, diferente de `world`/`story` no nível do artefato (esses sim exigidos pelo parse, `min(1)`). **Decidido: tratar como array vazio** — usar `adventure.world.anchors ?? []` antes do `.map`; zero anchors gera zero `WorldEntity` de local, sem lançar. Sem esse guard quebra em runtime pra artefato sem anchors. Não introduz novo campo obrigatório no schema (fora de escopo desta story).
- **`anchors[]` nunca referenciados em `locations[]`/`encounters[]` entram no ledger mesmo assim? Decidido: sim, semear TODOS.** Mesmo padrão já usado para facções/NPCs/locais em `seedLedgerFromGeneratedAdventure` — nenhum deles é filtrado por "será que isso vai ser usado depois". Construir uma heurística de referência cruzada agora é resolver um problema de ruído hipotético (YAGNI); medir em produção depois de ir ao ar, com dado real, é mais barato que adivinhar agora.
- **Vale a pena o Mestre "descobrir" um anchor (`recordEntity` com `revelado: true`) quando a ficção chega lá? Decidido: fora do escopo.** Depende de profundidade de uso, não da existência do dado — só faz sentido avaliar depois que a entidade de anchor já existir no ledger (esta story) e houver caso real de jogadora chegando lá. Não abrir story nova até isso acontecer.

---

## Referências no código

- [apps/api/src/ai/ai.service.ts:115-121](../../../apps/api/src/ai/ai.service.ts) — `AUTHORING_SCHEMA.world`/`.story`, os campos que somem.
- [apps/api/src/adventure/adventure.service.ts:339-340](../../../apps/api/src/adventure/adventure.service.ts) — `world: authored.world, story: authored.story`, gravação sem transformação.
- [apps/api/src/adventure-generation/adventure-gate.ts:205-210](../../../apps/api/src/adventure-generation/adventure-gate.ts) — `sanitizeProse`, único tratamento que `world`/`story` recebem hoje.
- [apps/api/src/adventure-generation/seed-ledger.ts:20-87](../../../apps/api/src/adventure-generation/seed-ledger.ts) — `seedLedgerFromGeneratedAdventure`, a função a estender.
- [packages/ai-engine/src/prompts/dm-system.ts:548-628](../../../packages/ai-engine/src/prompts/dm-system.ts) — `buildTurnStateBlock`/`entitiesSection`, onde a entidade nova passa a aparecer todo turno.
- [packages/shared/src/types/character.ts](../../../packages/shared/src/types/character.ts) — `WorldEntity`, enum `tipo`.
- [apps/web/src/components/setup/SetupWizard.tsx](../../../apps/web/src/components/setup/SetupWizard.tsx) — único consumidor atual de `world`, apresentação pura.
