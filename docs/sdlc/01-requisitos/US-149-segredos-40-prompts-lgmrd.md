# US-149 — Segredos pelos 40 prompts do LGMRD

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** [US-147](./US-147-rolagem-registro-conteudo.md) (conteúdo bruto já rolado) · [US-148](./US-148-perfil-personagem-entrada-motor.md) (perfil do personagem) · [US-158](./US-158-locais-npcs-prosa-motor.md) (✅ Implementada 2026-08-17 — `AiService.generateLocationsAndNpcs`, [ai.service.ts:1196](../../../apps/api/src/ai/ai.service.ts), entrega `locations`/`npcs` com `id` real e prosa, a entrada estruturada que esta story consome, não o conteúdo bruto direto da US-147) · [US-114](./US-114-modelo-utilitario-para-extracao-e-fecho.md) (**não bloqueia mais** — `extractionModel` existe no código desde 2026-08-16, [model.ts:314](../../../packages/ai-engine/src/model.ts), `qwen/qwen3.7-flash`, sem `provider` pin; US-114 segue 🚧 Em progresso só pelos critérios de fidelidade/latência/custo, que não afetam esta story)
**Relacionado:** [Backlog — Motor de geração de aventuras one-shot](./backlog-motor-de-geracao-de-aventuras.md) (US-149) · [ADR 012](../../adr/012-aventura-gerada-como-dado.md) (resolve rótulos `GEN-N` do backlog para número de story) · [US-114](./US-114-modelo-utilitario-para-extracao-e-fecho.md) (`extractionModel`, o modelo barato que esta story usa) · [US-75](./US-75-dimensao-de-proveniencia-no-ledger.md) (padrão de `generateObject` server-side para extração estruturada)
**Criada em:** 2026-08-15

---

## História

> **Como** mantenedora,
> **quero** que o motor escreva os ~11 segredos da aventura a partir dos 40 prompts de segredo do LGMRD, com locais e NPCs já decididos e `background.story`/`bonds`/`flaws`, `origin.adventuresAndAdvancement` e `hookSeed` no contexto,
> **para que** a aventura gerada tenha quebra-cabeça — pistas que apontam para entidades que existem e se conectam ao personagem — em vez de lista de fatos soltos.

**Atualização 2026-08-20:** o contexto de `origin` passado a `generateSecrets` (e a `generateOpeningBeat`, US-180, mesma função `characterAnchors`) deixou de incluir `connection`/`memento` — só `origin.adventuresAndAdvancement` (gancho fixo do catálogo) ancora segredo/abertura. Motivo: `connection`/`memento` (texto livre do wizard) ficam reservados à narração de turno ao vivo; o motor de geração usa só o gancho de catálogo como elemento de origem. Critérios de aceite e notas abaixo mantidos como registro histórico, com a ressalva assinalada onde relevante.

---

## Contexto e motivação

### O problema observado

É a única chamada de modelo do caminho crítico do motor (as outras camadas são determinísticas ou prosa de apoio) — e é, nas palavras do backlog, *"a tarefa que decide se a aventura gerada tem quebra-cabeça ou lista"*. Sem ela, o motor produziria só a matéria-prima rolada (US-147) e statblocks ([US-152](./US-152-statblocks-papel-orcamento.md)): nenhum segredo, nenhuma pista, nenhum gancho de investigação. A aventura ficaria mecanicamente completa e narrativamente vazia.

### Por que a solução atual não basta

Não existe hoje nenhuma chamada de modelo que escreva conteúdo de aventura ancorado em `background` — `generateOpeningNarration` usa `background` para a **prosa de abertura**, não para estruturar segredos ligados a locais e NPCs específicos. E gerar segredos **antes** de locais e NPCs existirem (a ordem errada) produz exatamente a *"sopa de pista genérica"* que o [backlog irmão](./backlog-aventuras-autorais-lazygm.md) nomeia como o defeito central de aventura gerada sem disciplina de ordem.

### A proposta

Uma chamada `generateSecrets` que usa os 40 prompts de segredo do LGMRD como moldes, recebe `locations`/`npcs` já gerados por `AiService.generateLocationsAndNpcs` (US-158, não o conteúdo bruto direto da US-147) mais `background.story`/`bonds`/`flaws`, `origin.adventuresAndAdvancement` e `hookSeed` (US-148) no contexto, roda no **modelo barato** (`extractionModel`, [US-114](./US-114-modelo-utilitario-para-extracao-e-fecho.md), já implementado — `qwen/qwen3.7-flash`) — geração de aventura não é turno de jogo: não tem streaming, não tem jogador esperando, não paga o teto de 60s do proxy SSE.

---

## Escopo

### Dentro do escopo

- **`generateSecrets(profile, locations, npcs, secretPrompts)`** — chamada `generateObject` (mesmo padrão de `extractOpeningEntities`, [ai.service.ts:1112](../../../apps/api/src/ai/ai.service.ts)), schema = `AdventureSecretSchema[]` (de [US-144](./US-144-schema-aventura-shared.md)), instruída a produzir ~11 segredos usando os 40 prompts do LGMRD como moldes de pergunta ("o que o vilão esconde?", "que engano o NPC comete?", etc. — formato exato a confirmar no artefato da US-145).
- **Contexto obrigatório na chamada:** `locations`/`npcs` já decididos com `id` real e prosa — saída de `AiService.generateLocationsAndNpcs` ([US-158](./US-158-locais-npcs-prosa-motor.md), [ai.service.ts:1196](../../../apps/api/src/ai/ai.service.ts)), não o conteúdo bruto (strings sem `id`) que a US-147 rola diretamente —, `background.story`/`bonds`/`flaws` (US-148), `origin.adventuresAndAdvancement` (US-148, distinto de `background` — schema.prisma:40-43), `hookSeed`. Sem `locations`/`npcs`, a chamada não roda — dependência de ordem, não sugestão. **(Atualização 2026-08-20: `origin.connection`/`memento` saíram do contexto — só `adventuresAndAdvancement` alimenta o motor, ver Notas de implementação.)**
- **`secret.locationId` referencia um `id` real** dos locais recebidos — a chamada é instruída a **escolher entre os `id`s dados**, nunca inventar um novo.
- **Modelo barato, não o da narração** — usa `extractionModel` ([US-114](./US-114-modelo-utilitario-para-extracao-e-fecho.md), [model.ts:314](../../../packages/ai-engine/src/model.ts)), já resolvido para `qwen/qwen3.7-flash`, sem `provider` pin — `DEEPSEEK_ROUTE` não se aplica, não há risco de herdar por engano. `EXTRACTION_PROVIDER_OPTIONS` já usa `reasoning: { enabled: false }`, confirmado por teste de ponta a ponta como a única config que não dá 400 nesse modelo — reusar sem reabrir a decisão.
- **Teste com fixture:** perfil de personagem com `bonds` preenchido produz ao menos um segredo referenciando esse vínculo (verificação de conteúdo, não só de forma).

### Fora do escopo

- **A escolha de qual dos 40 prompts usar para cada segredo** — heurística de seleção (aleatória pelo seed? por locação?) é detalhe de implementação, não critério de aceite formal desta story; o que importa é o resultado ter `locationId` válido e usar o contexto de personagem.
- **O gate que verifica se o grafo fecha** (todo `locationId` referenciado existe) — é [US-150](./US-150-gate-antes-de-persistir-aventura-gerada.md); esta story produz o melhor esforço, a verificação formal é da story seguinte.
- **Prosa das locações, *area aspects* e geração de NPC** — mencionada no backlog na mesma camada ("modelo, uma chamada por peça"), mas é conteúdo diferente (descrição de lugar/NPC, não segredo). **Resolvido em 2026-08-16:** vira [US-158](./US-158-locais-npcs-prosa-motor.md), story própria entre US-147 e esta — o backlog nunca numerou esses passos como `GEN` própria, e US-158 preenche essa lacuna.
- **Piso de quantidade por seção** (mínimo de segredos) — vai **no prompt**, não como validação de código aqui (molde do DnDGenerate: "pedir 'se houver menos de N, escreva mais' é mais barato que re-rolar" — decisão já tomada pelo backlog, aplicada pela [US-150](./US-150-gate-antes-de-persistir-aventura-gerada.md)).

---

## Modelo de dados proposto

> Sem schema novo — reusa `AdventureSecretSchema` de [US-144](./US-144-schema-aventura-shared.md) como shape de saída do `generateObject`.

**Persistência:** nenhuma nesta story — o array de segredos gerado alimenta o artefato completo que [US-150](./US-150-gate-antes-de-persistir-aventura-gerada.md) valida e [US-151](./US-151-semear-ledger-segredos-gerados.md) semeia no ledger.

---

## Critérios de aceite

- [x] `generateSecrets` produz um array de `AdventureSecret` (schema US-144), rodando **depois** de locais e NPCs já existirem no contexto da chamada — nunca antes (ordem verificável pela assinatura da função exigir os dois como parâmetro obrigatório). `locations`/`npcs` são obrigatórios em `generateSecrets(params: { locations, npcs, ... })`, [ai.service.ts:1308](../../../apps/api/src/ai/ai.service.ts).
- [x] Todo `secret.locationId` no retorno corresponde a um `id` presente na lista de locais recebida (verificação de melhor esforço nesta story — instrução no system prompt + `locationId` do schema; a garantia formal é o gate da [US-150](./US-150-gate-antes-de-persistir-aventura-gerada.md)).
- [x] A chamada usa `extractionModel` ([US-114](./US-114-modelo-utilitario-para-extracao-e-fecho.md)), não `primaryModel`/o modelo de narração. Coberto por teste (`usa extractionModel, não primaryModel`, [ai.service.test.ts](../../../apps/api/src/ai/ai.service.test.ts)).
- [x] `background.bonds`/`flaws`/`story` (quando presentes), `origin.adventuresAndAdvancement` (quando presente) e `hookSeed` (sempre) são passados no contexto da chamada — verificável no prompt montado. Cobertos por teste dedicado cada. **(Atualização 2026-08-20: era `origin.connection`/`memento` na versão original desta AC — substituído por `adventuresAndAdvancement`; teste que confirma `connection`/`memento` NÃO entram no prompt adicionado em `ai.service.test.ts`.)**
- [x] Personagem com `background` **e** `origin` vazios ainda produz segredos válidos, usando só `hookSeed` como âncora narrativa (mesma garantia que a [US-148](./US-148-perfil-personagem-entrada-motor.md) já estabelece na entrada).
- [x] Falha/timeout da chamada propaga erro estruturado (não devolve array vazio silenciosamente, diferente de `extractOpeningScene`/`extractOpeningEntities`) — é esse erro que aciona o reseed da [US-150](./US-150-gate-antes-de-persistir-aventura-gerada.md) (ver *Questões em aberto* #1, resolvida). `generateSecrets` não tem `try/catch` — mesma disciplina de `generateLocationsAndNpcs`.
- [x] **Eval / teste de regressão:** cobertura por teste de wiring (`background.bonds presente entra no prompt do modelo`, `origin.connection/memento presentes entram no prompt do modelo`), no mesmo padrão usado por `generateLocationsAndNpcs` (US-158) — conteúdo real de saída depende do modelo em produção, fora do alcance de teste unitário com `generateObject` mockado; não há eval case dedicado em `evals/` para nenhuma das duas chamadas de `generateObject` estruturado hoje.

---

## Notas de implementação

- **Molde de `generateObject` server-side:** copiar a estrutura de `extractOpeningEntities` ([ai.service.ts:1112](../../../apps/api/src/ai/ai.service.ts)) — schema Zod, `providerOptions` do modelo escolhido, `catch` que devolve `null`/array vazio em vez de propagar exceção (mesma disciplina).
- **Os 40 prompts do LGMRD** vêm do artefato baixado pela [US-145](./US-145-sync-lgmrd-notice.md) — a forma exata (se é uma lista de perguntas-molde ou algo mais estruturado) só se confirma inspecionando `LGMRD.json` depois do sync; não assumir formato a partir desta story.
- **Resolvido em 2026-08-16: `creatingsecrets` já está extraído para `scripts/lazygm/lgmrd-tables.json`.** `extract-tables.mjs` (US-147) lia só a seção `coreadventuregenerators`, hardcoded — estendido para uma lista `SECTIONS` e agora também recorta `creatingsecrets` → `charactersecrets`/`historicalsecrets`/`npcandvillainsecrets`/`plotandstorysecrets` (10 prompts cada, mesmo shape `item_num`/`item` de `1d20quests`, sem parser novo). `secretPrompts` desta story lê essas 4 chaves direto de `readLgmrdTables()` — não precisa reabrir `LGMRD.json` bruto (gitignored, ausente em CI/Render).
- **Resolvido em 2026-08-17: `extractionModel` já existe e está testado.** `qwen/qwen3.7-flash` ([model.ts:314](../../../packages/ai-engine/src/model.ts)), suporta tool calling, sem `provider` pin (endpoint único, `DEEPSEEK_ROUTE` não se aplica), `reasoning: { enabled: false }` confirmado por teste de ponta a ponta. Não precisa nova decisão de provider aqui — só reusar `extractionModel`/`EXTRACTION_PROVIDER_OPTIONS` como estão.
- **Molde direto disponível: `AiService.generateLocationsAndNpcs`** ([ai.service.ts:1196](../../../apps/api/src/ai/ai.service.ts), US-158) é o `generateObject` mais recente do repo — mais próximo do que `generateSecrets` precisa fazer (mesmo par `AiService`/`extractionModel`, mesma disciplina de erro estruturado sem `try/catch`, mesmo `hookSeed` como âncora de fallback) do que `extractOpeningEntities`. Espelhar essa função, não só a mais antiga.
- **Atualização 2026-08-20 — `characterAnchors()` deixou de ler `origin.connection`/`memento`.** `characterAnchors()` ([ai.service.ts:222](../../../apps/api/src/ai/ai.service.ts)), função compartilhada por `generateSecrets` e `generateOpeningBeat` (US-180) que monta a lista de âncoras pessoais citada no `system`, agora lê só `origin.adventuresAndAdvancement`. Motivo: `connection`/`memento` (vínculo/objeto escolhidos no wizard, US-124) ficam reservados à narração de turno ao vivo, que monta seu próprio `originNarrative` direto de `Character.origin` ([ai.service.ts:344-356](../../../apps/api/src/ai/ai.service.ts), independente deste perfil) — o motor de geração usa só o gancho fixo do catálogo como elemento de origem. `AdventureProfile.origin` (US-148, `buildAdventureProfile`) já chega com `connection`/`memento` ausentes — a mudança em `characterAnchors()` só formaliza o tipo do parâmetro para o shape que já chegava.

---

## Questões em aberto

1. ~~Falha trava ou degrada silenciosamente?~~ **Resolvida.** US-150 já define o contrato: "falha em qualquer verificação aciona reseed (`seed + 1`)... até um teto explícito de tentativas... falha registrada com o motivo". `generateSecrets` deve **propagar erro estruturado** em vez de devolver array vazio (diferente do padrão de `extractOpeningEntities`/`extractOpeningScene`, que degradam silenciosamente) — é esse erro que aciona o reseed da [US-150](./US-150-gate-antes-de-persistir-aventura-gerada.md).
2. ~~Quantos segredos por prompt, e como os 40 prompts se distribuem entre locais/NPCs?~~ **Resolvida (2026-08-17).** A seção `creatingsecrets` (`scripts/lazygm/_data/LGMRD.json`, não `lgmrd-tables.json`) tem 4 subseções × 10 prompts = 40: `charactersecrets` (liga a `bonds`/`flaws`/`origin`), `historicalsecrets` (liga a `locationId` — único grupo naturalmente locacional), `npcandvillainsecrets` (liga a NPC/vilão já rolado), `plotandstorysecrets` (liga a `hookSeed`/arco geral). **Split fixado: 3 + 3 + 3 + 2 = 11**, com o 2 em `plotandstorysecrets` — é a única categoria cujo âncora (`hookSeed`) já é garantida em toda chamada por outra via (US-148 §fallback), então precisa de menos peso dedicado que as três que dependem de conteúdo específico (`bonds`/`locationId`/NPC) para não ficarem rasas. `charactersecrets`/`historicalsecrets`/`npcandvillainsecrets` empatam em 3 porque nenhuma tem fallback equivalente — cortar qualquer uma arrisca a AC de eval (bonds/`origin` e `locationId` válido). Vai no prompt como instrução fixa de quantidade por categoria, não como validação de código (consistente com *Fora do escopo* — heurística de seleção não é critério de aceite formal, mas o número agora é decisão tomada, não aberta).

---

## Referências no código

- [apps/api/src/ai/ai.service.ts:1196](../../../apps/api/src/ai/ai.service.ts) — `AiService.generateLocationsAndNpcs` (US-158, ✅ Implementada), o molde de `generateObject` mais próximo a espelhar — mesmo par `AiService`/`extractionModel`, mesma entrada (`AdventureProfile`), mesma disciplina de erro estruturado.
- [apps/api/src/ai/ai.service.ts:1112](../../../apps/api/src/ai/ai.service.ts) — `extractOpeningEntities`, molde mais antigo de `generateObject` estruturado.
- [apps/api/src/ai/ai.service.ts:344-356](../../../apps/api/src/ai/ai.service.ts) — `originNarrative` (`adventuresAndAdvancement`/`connection`/`memento`, os três) montado por turno, independente de `AdventureProfile.origin` — desde 2026-08-20, o perfil do motor só carrega `adventuresAndAdvancement`; `connection`/`memento` continuam vivos aqui, não no motor.
- [packages/ai-engine/src/prompts/dm-system.ts:59-133](../../../packages/ai-engine/src/prompts/dm-system.ts) — `CharacterBackground`, `OriginNarrative`.
- [packages/ai-engine/src/model.ts:314](../../../packages/ai-engine/src/model.ts) — `extractionModel` implementado (US-114), `qwen/qwen3.7-flash`, sem `provider` pin.
- [US-114](./US-114-modelo-utilitario-para-extracao-e-fecho.md) — `extractionModel`, já implementado; story segue 🚧 só pelos critérios de fidelidade/latência/custo, que não bloqueiam esta.
- [US-147](./US-147-rolagem-registro-conteudo.md) — conteúdo bruto rolado, entrada da US-158.
- [US-148](./US-148-perfil-personagem-entrada-motor.md) — `AdventureProfile` (`background` + `origin`), entrada desta story.
- [US-158](./US-158-locais-npcs-prosa-motor.md) — ✅ Implementada 2026-08-17; `locations`/`npcs` com `id` real e prosa via `AiService.generateLocationsAndNpcs`, entrada direta desta story.
- [apps/api/src/ai/ai.service.ts:1308](../../../apps/api/src/ai/ai.service.ts) — `AiService.generateSecrets`, implementação desta story.
- [apps/api/src/adventure-generation/lgmrd-tables.ts](../../../apps/api/src/adventure-generation/lgmrd-tables.ts) — `readSecretPrompts()`, novo nesta story; também corrigiu `LgmrdSubsectionId`/o teste de `readLgmrdTables`, que ainda listavam só as 4 subsections de rolagem (drift desde 2026-08-16, quando `creatingsecrets` entrou no JSON mas não no tipo).
- [scripts/lazygm/extract-tables.mjs](../../../scripts/lazygm/extract-tables.mjs) — estendido em 2026-08-16 para extrair `creatingsecrets` além de `coreadventuregenerators`; `secretPrompts` desta story vem daqui.
- [scripts/lazygm/lgmrd-tables.json](../../../scripts/lazygm/lgmrd-tables.json) — artefato committed regenerado, agora com as 4 tabelas de segredo.
- [Backlog — Motor de geração de aventuras one-shot §GEN-6 e §O desenho: três camadas](./backlog-motor-de-geracao-de-aventuras.md) (US-149) — texto de origem.
