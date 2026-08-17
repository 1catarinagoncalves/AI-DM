# US-149 — Segredos pelos 40 prompts do LGMRD

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** [US-147](./US-147-rolagem-registro-conteudo.md) (conteúdo bruto já rolado) · [US-148](./US-148-perfil-personagem-entrada-motor.md) (perfil do personagem) · [US-158](./US-158-locais-npcs-prosa-motor.md) (`locations`/`npcs` com `id` real e prosa — a entrada estruturada que esta story consome, não o conteúdo bruto direto da US-147) · [US-114](./US-114-modelo-utilitario-para-extracao-e-fecho.md) (**bloqueante** — `extractionModel` ainda não existe no código, status 🗂️ Backlog; critério de aceite desta story exige usá-lo)
**Relacionado:** [Backlog — Motor de geração de aventuras one-shot](./backlog-motor-de-geracao-de-aventuras.md) (US-149) · [ADR 012](../../adr/012-aventura-gerada-como-dado.md) (resolve rótulos `GEN-N` do backlog para número de story) · [US-114](./US-114-modelo-utilitario-para-extracao-e-fecho.md) (`extractionModel`, o modelo barato que esta story usa) · [US-75](./US-75-dimensao-de-proveniencia-no-ledger.md) (padrão de `generateObject` server-side para extração estruturada)
**Criada em:** 2026-08-15

---

## História

> **Como** mantenedora,
> **quero** que o motor escreva os ~11 segredos da aventura a partir dos 40 prompts de segredo do LGMRD, com locais e NPCs já decididos e `background.story`/`bonds`/`flaws`, `origin.connection`/`memento` e `hookSeed` no contexto,
> **para que** a aventura gerada tenha quebra-cabeça — pistas que apontam para entidades que existem e se conectam ao personagem — em vez de lista de fatos soltos.

---

## Contexto e motivação

### O problema observado

É a única chamada de modelo do caminho crítico do motor (as outras camadas são determinísticas ou prosa de apoio) — e é, nas palavras do backlog, *"a tarefa que decide se a aventura gerada tem quebra-cabeça ou lista"*. Sem ela, o motor produziria só a matéria-prima rolada (US-147) e statblocks ([US-152](./US-152-statblocks-papel-orcamento.md)): nenhum segredo, nenhuma pista, nenhum gancho de investigação. A aventura ficaria mecanicamente completa e narrativamente vazia.

### Por que a solução atual não basta

Não existe hoje nenhuma chamada de modelo que escreva conteúdo de aventura ancorado em `background` — `generateOpeningNarration` usa `background` para a **prosa de abertura**, não para estruturar segredos ligados a locais e NPCs específicos. E gerar segredos **antes** de locais e NPCs existirem (a ordem errada) produz exatamente a *"sopa de pista genérica"* que o [backlog irmão](./backlog-aventuras-autorais-lazygm.md) nomeia como o defeito central de aventura gerada sem disciplina de ordem.

### A proposta

Uma chamada `generateSecrets` que usa os 40 prompts de segredo do LGMRD como moldes, recebe locais e NPCs já rolados (US-147) mais `background.story`/`bonds`/`flaws`, `origin.connection`/`memento` e `hookSeed` (US-148) no contexto, roda no **modelo barato** (`extractionModel`, [US-114](./US-114-modelo-utilitario-para-extracao-e-fecho.md)) — geração de aventura não é turno de jogo: não tem streaming, não tem jogador esperando, não paga o teto de 60s do proxy SSE.

---

## Escopo

### Dentro do escopo

- **`generateSecrets(profile, locations, npcs, secretPrompts)`** — chamada `generateObject` (mesmo padrão de `extractOpeningEntities`, [ai.service.ts:1112](../../../apps/api/src/ai/ai.service.ts)), schema = `AdventureSecretSchema[]` (de [US-144](./US-144-schema-aventura-shared.md)), instruída a produzir ~11 segredos usando os 40 prompts do LGMRD como moldes de pergunta ("o que o vilão esconde?", "que engano o NPC comete?", etc. — formato exato a confirmar no artefato da US-145).
- **Contexto obrigatório na chamada:** `locations`/`npcs` já decididos com `id` real e prosa — saída da [US-158](./US-158-locais-npcs-prosa-motor.md), não o conteúdo bruto (strings sem `id`) que a US-147 rola diretamente —, `background.story`/`bonds`/`flaws` (US-148), `origin.connection`/`memento` (US-148, distinto de `background` — schema.prisma:40-43), `hookSeed`. Sem `locations`/`npcs`, a chamada não roda — dependência de ordem, não sugestão.
- **`secret.locationId` referencia um `id` real** dos locais recebidos — a chamada é instruída a **escolher entre os `id`s dados**, nunca inventar um novo.
- **Modelo barato, não o da narração** — usa `extractionModel` ([US-114](./US-114-modelo-utilitario-para-extracao-e-fecho.md)), com as mesmas ressalvas de provider/pin que aquela story documenta (sem herdar `DEEPSEEK_ROUTE` se o modelo escolhido não for DeepSeek).
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

- [ ] `generateSecrets` produz um array de `AdventureSecret` (schema US-144), rodando **depois** de locais e NPCs já existirem no contexto da chamada — nunca antes (ordem verificável pela assinatura da função exigir os dois como parâmetro obrigatório).
- [ ] Todo `secret.locationId` no retorno corresponde a um `id` presente na lista de locais recebida (verificação de melhor esforço nesta story; a garantia formal é o gate da [US-150](./US-150-gate-antes-de-persistir-aventura-gerada.md)).
- [ ] A chamada usa `extractionModel` ([US-114](./US-114-modelo-utilitario-para-extracao-e-fecho.md)), não `primaryModel`/o modelo de narração.
- [ ] `background.bonds`/`flaws`/`story` (quando presentes), `origin.connection`/`memento` (quando presentes) e `hookSeed` (sempre) são passados no contexto da chamada — verificável no prompt montado.
- [ ] Personagem com `background` **e** `origin` vazios ainda produz segredos válidos, usando só `hookSeed` como âncora narrativa (mesma garantia que a [US-148](./US-148-perfil-personagem-entrada-motor.md) já estabelece na entrada).
- [ ] Falha/timeout da chamada propaga erro estruturado (não devolve array vazio silenciosamente, diferente de `extractOpeningScene`/`extractOpeningEntities`) — é esse erro que aciona o reseed da [US-150](./US-150-gate-antes-de-persistir-aventura-gerada.md) (ver *Questões em aberto* #1, resolvida).
- [ ] **Eval / teste de regressão:** fixture com `background.bonds = ["deve favor a um contrabandista"]` produz ao menos um segredo cujo texto referencia esse vínculo (checagem por palavra-chave ou LLM-judge, no molde da rubrica da [US-36](./US-36-eval-de-qualidade-da-narracao.md)). Segunda fixture com `origin.connection`/`memento` preenchidos (sem `background.bonds`) confirma que o vínculo de `origin` também ancora ao menos um segredo — não é só `background` que o motor honra.

---

## Notas de implementação

- **Molde de `generateObject` server-side:** copiar a estrutura de `extractOpeningEntities` ([ai.service.ts:1112](../../../apps/api/src/ai/ai.service.ts)) — schema Zod, `providerOptions` do modelo escolhido, `catch` que devolve `null`/array vazio em vez de propagar exceção (mesma disciplina).
- **Os 40 prompts do LGMRD** vêm do artefato baixado pela [US-145](./US-145-sync-lgmrd-notice.md) — a forma exata (se é uma lista de perguntas-molde ou algo mais estruturado) só se confirma inspecionando `LGMRD.json` depois do sync; não assumir formato a partir desta story.
- **Resolvido em 2026-08-16: `creatingsecrets` já está extraído para `scripts/lazygm/lgmrd-tables.json`.** `extract-tables.mjs` (US-147) lia só a seção `coreadventuregenerators`, hardcoded — estendido para uma lista `SECTIONS` e agora também recorta `creatingsecrets` → `charactersecrets`/`historicalsecrets`/`npcandvillainsecrets`/`plotandstorysecrets` (10 prompts cada, mesmo shape `item_num`/`item` de `1d20quests`, sem parser novo). `secretPrompts` desta story lê essas 4 chaves direto de `readLgmrdTables()` — não precisa reabrir `LGMRD.json` bruto (gitignored, ausente em CI/Render).
- **`extractionModel` tem restrições documentadas na US-114**: precisa suportar tool calling (`generateObject` usa modo tool), pode ter armadilha de `reasoning`/pin de rota se o modelo escolhido não for DeepSeek — reler aquela story antes de configurar o provider aqui.

---

## Questões em aberto

1. ~~Falha trava ou degrada silenciosamente?~~ **Resolvida.** US-150 já define o contrato: "falha em qualquer verificação aciona reseed (`seed + 1`)... até um teto explícito de tentativas... falha registrada com o motivo". `generateSecrets` deve **propagar erro estruturado** em vez de devolver array vazio (diferente do padrão de `extractOpeningEntities`/`extractOpeningScene`, que degradam silenciosamente) — é esse erro que aciona o reseed da [US-150](./US-150-gate-antes-de-persistir-aventura-gerada.md).
2. Quantos segredos por prompt, e como os 40 prompts se distribuem entre locais/NPCs — **parcialmente resolvida por inspeção de `scripts/lazygm/_data/LGMRD.json`** (não `lgmrd-tables.json`, que não contém segredos). A seção `creatingsecrets` tem 4 subseções × 10 prompts = 40: `charactersecrets` (liga a `bonds`/`flaws`/`origin`), `historicalsecrets` (liga a `locationId` — único grupo naturalmente locacional), `npcandvillainsecrets` (liga a NPC/vilão já rolado), `plotandstorysecrets` (liga a `hookSeed`/arco geral). Proposta: puxar os ~11 segredos proporcionalmente das 4 categorias (ex. 3+3+3+2) em vez de pool único de 40 prompts. Falta decidir só o número exato por categoria — resolve-se escrevendo e testando o system prompt real.

---

## Referências no código

- [apps/api/src/ai/ai.service.ts:1112](../../../apps/api/src/ai/ai.service.ts) — `extractOpeningEntities`, o molde de `generateObject` estruturado a espelhar.
- [apps/api/src/ai/ai.service.ts:344-356](../../../apps/api/src/ai/ai.service.ts) — `originNarrative` (`connection`/`memento`) montado por turno; mesmo shape que chega aqui via `AdventureProfile.origin`.
- [packages/ai-engine/src/prompts/dm-system.ts:59-133](../../../packages/ai-engine/src/prompts/dm-system.ts) — `CharacterBackground`, `OriginNarrative`.
- [US-114](./US-114-modelo-utilitario-para-extracao-e-fecho.md) — `extractionModel`, incluindo as armadilhas de `reasoning`/pin de rota a evitar aqui.
- [US-147](./US-147-rolagem-registro-conteudo.md) — conteúdo bruto rolado, entrada da US-158.
- [US-148](./US-148-perfil-personagem-entrada-motor.md) — `AdventureProfile` (`background` + `origin`), entrada desta story.
- [US-158](./US-158-locais-npcs-prosa-motor.md) — `locations`/`npcs` com `id` real e prosa, entrada direta desta story.
- [scripts/lazygm/extract-tables.mjs](../../../scripts/lazygm/extract-tables.mjs) — estendido em 2026-08-16 para extrair `creatingsecrets` além de `coreadventuregenerators`; `secretPrompts` desta story vem daqui.
- [scripts/lazygm/lgmrd-tables.json](../../../scripts/lazygm/lgmrd-tables.json) — artefato committed regenerado, agora com as 4 tabelas de segredo.
- [Backlog — Motor de geração de aventuras one-shot §GEN-6 e §O desenho: três camadas](./backlog-motor-de-geracao-de-aventuras.md) (US-149) — texto de origem.
