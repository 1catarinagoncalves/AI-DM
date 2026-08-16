# US-149 — Segredos pelos 40 prompts do LGMRD

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** [US-147](./US-147-rolagem-registro-conteudo.md) (locais e conteúdo já rolados) · [US-148](./US-148-perfil-personagem-entrada-motor.md) (perfil do personagem)
**Relacionado:** [Backlog — Motor de geração de aventuras one-shot](./backlog-motor-de-geracao-de-aventuras.md) (US-149) · [ADR 012](../../adr/012-aventura-gerada-como-dado.md) (resolve rótulos `GEN-N` do backlog para número de story) · [US-114](./US-114-modelo-utilitario-para-extracao-e-fecho.md) (`extractionModel`, o modelo barato que esta story usa) · [US-75](./US-75-dimensao-de-proveniencia-no-ledger.md) (padrão de `generateObject` server-side para extração estruturada)
**Criada em:** 2026-08-15

---

## História

> **Como** mantenedora,
> **quero** que o motor escreva os ~11 segredos da aventura a partir dos 40 prompts de segredo do LGMRD, com locais e NPCs já decididos e `background.story`/`bonds`/`flaws`/`hookSeed` no contexto,
> **para que** a aventura gerada tenha quebra-cabeça — pistas que apontam para entidades que existem e se conectam ao personagem — em vez de lista de fatos soltos.

---

## Contexto e motivação

### O problema observado

É a única chamada de modelo do caminho crítico do motor (as outras camadas são determinísticas ou prosa de apoio) — e é, nas palavras do backlog, *"a tarefa que decide se a aventura gerada tem quebra-cabeça ou lista"*. Sem ela, o motor produziria só a matéria-prima rolada (US-147) e statblocks ([US-152](./US-152-statblocks-papel-orcamento.md)): nenhum segredo, nenhuma pista, nenhum gancho de investigação. A aventura ficaria mecanicamente completa e narrativamente vazia.

### Por que a solução atual não basta

Não existe hoje nenhuma chamada de modelo que escreva conteúdo de aventura ancorado em `background` — `generateOpeningNarration` usa `background` para a **prosa de abertura**, não para estruturar segredos ligados a locais e NPCs específicos. E gerar segredos **antes** de locais e NPCs existirem (a ordem errada) produz exatamente a *"sopa de pista genérica"* que o [backlog irmão](./backlog-aventuras-autorais-lazygm.md) nomeia como o defeito central de aventura gerada sem disciplina de ordem.

### A proposta

Uma chamada `generateSecrets` que usa os 40 prompts de segredo do LGMRD como moldes, recebe locais e NPCs já rolados (US-147) mais `background.story`/`bonds`/`flaws` e `hookSeed` (US-148) no contexto, roda no **modelo barato** (`extractionModel`, [US-114](./US-114-modelo-utilitario-para-extracao-e-fecho.md)) — geração de aventura não é turno de jogo: não tem streaming, não tem jogador esperando, não paga o teto de 60s do proxy SSE.

---

## Escopo

### Dentro do escopo

- **`generateSecrets(profile, locations, npcs, secretPrompts)`** — chamada `generateObject` (mesmo padrão de `extractOpeningEntities`, [ai.service.ts:1112](../../../apps/api/src/ai/ai.service.ts)), schema = `AdventureSecretSchema[]` (de [US-144](./US-144-schema-aventura-shared.md)), instruída a produzir ~11 segredos usando os 40 prompts do LGMRD como moldes de pergunta ("o que o vilão esconde?", "que engano o NPC comete?", etc. — formato exato a confirmar no artefato da US-145).
- **Contexto obrigatório na chamada:** locais e NPCs já decididos (com `id`), `background.story`/`bonds`/`flaws` (US-148), `hookSeed`. Sem locais e NPCs, a chamada não roda — dependência de ordem, não sugestão.
- **`secret.locationId` referencia um `id` real** dos locais recebidos — a chamada é instruída a **escolher entre os `id`s dados**, nunca inventar um novo.
- **Modelo barato, não o da narração** — usa `extractionModel` ([US-114](./US-114-modelo-utilitario-para-extracao-e-fecho.md)), com as mesmas ressalvas de provider/pin que aquela story documenta (sem herdar `DEEPSEEK_ROUTE` se o modelo escolhido não for DeepSeek).
- **Teste com fixture:** perfil de personagem com `bonds` preenchido produz ao menos um segredo referenciando esse vínculo (verificação de conteúdo, não só de forma).

### Fora do escopo

- **A escolha de qual dos 40 prompts usar para cada segredo** — heurística de seleção (aleatória pelo seed? por locação?) é detalhe de implementação, não critério de aceite formal desta story; o que importa é o resultado ter `locationId` válido e usar o contexto de personagem.
- **O gate que verifica se o grafo fecha** (todo `locationId` referenciado existe) — é [US-150](./US-150-gate-antes-de-persistir-aventura-gerada.md); esta story produz o melhor esforço, a verificação formal é da story seguinte.
- **Prosa das locações e *area aspects*** — mencionada no backlog na mesma camada ("modelo, uma chamada por peça"), mas é conteúdo diferente (descrição de lugar, não segredo) — trabalho de story separada se o corte mínimo do backlog exigir (não está listada como GEN própria; a decidir se cabe aqui ou em [US-147](./US-147-rolagem-registro-conteudo.md)).
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
- [ ] `background.bonds`/`flaws`/`story` (quando presentes) e `hookSeed` (sempre) são passados no contexto da chamada — verificável no prompt montado.
- [ ] Personagem com `background` vazio ainda produz segredos válidos, usando só `hookSeed` como âncora narrativa (mesma garantia que a [US-148](./US-148-perfil-personagem-entrada-motor.md) já estabelece na entrada).
- [ ] Falha/timeout da chamada não deve travar a criação da aventura sem sinalização — mesmo padrão de falha silenciosa com log das extrações existentes (`extractOpeningScene`/`extractOpeningEntities`), a decidir se aqui a falha propaga para acionar o reseed da [US-150](./US-150-gate-antes-de-persistir-aventura-gerada.md) em vez de devolver vazio silenciosamente (ver *Questões em aberto*).
- [ ] **Eval / teste de regressão:** fixture com `background.bonds = ["deve favor a um contrabandista"]` produz ao menos um segredo cujo texto referencia esse vínculo (checagem por palavra-chave ou LLM-judge, no molde da rubrica da [US-36](./US-36-eval-de-qualidade-da-narracao.md)).

---

## Notas de implementação

- **Molde de `generateObject` server-side:** copiar a estrutura de `extractOpeningEntities` ([ai.service.ts:1112](../../../apps/api/src/ai/ai.service.ts)) — schema Zod, `providerOptions` do modelo escolhido, `catch` que devolve `null`/array vazio em vez de propagar exceção (mesma disciplina).
- **Os 40 prompts do LGMRD** vêm do artefato baixado pela [US-145](./US-145-sync-lgmrd-notice.md) — a forma exata (se é uma lista de perguntas-molde ou algo mais estruturado) só se confirma inspecionando `LGMRD.json` depois do sync; não assumir formato a partir desta story.
- **`extractionModel` tem restrições documentadas na US-114**: precisa suportar tool calling (`generateObject` usa modo tool), pode ter armadilha de `reasoning`/pin de rota se o modelo escolhido não for DeepSeek — reler aquela story antes de configurar o provider aqui.

---

## Questões em aberto

1. Falha desta chamada deve **travar** a geração (acionando reseed pela [US-150](./US-150-gate-antes-de-persistir-aventura-gerada.md)) ou **degradar** silenciosamente (aventura sem segredos, mas jogável)? O backlog não decide explicitamente para esta etapa — diferente das extrações de abertura existentes (que sempre degradam), aqui a ausência de segredos esvazia o propósito central do motor. Recomendação: tratar falha como motivo de reseed na [US-150](./US-150-gate-antes-de-persistir-aventura-gerada.md), não como degradação silenciosa — mas decidir com a [US-150](./US-150-gate-antes-de-persistir-aventura-gerada.md) sendo escrita junto.
2. Quantos segredos por prompt, e como os 40 prompts se distribuem entre locais/NPCs — decisão de prompt-engineering que só se resolve escrevendo e testando o system prompt real.

---

## Referências no código

- [apps/api/src/ai/ai.service.ts:1112](../../../apps/api/src/ai/ai.service.ts) — `extractOpeningEntities`, o molde de `generateObject` estruturado a espelhar.
- [US-114](./US-114-modelo-utilitario-para-extracao-e-fecho.md) — `extractionModel`, incluindo as armadilhas de `reasoning`/pin de rota a evitar aqui.
- [US-147](./US-147-rolagem-registro-conteudo.md) — locais e conteúdo rolados, entrada desta story.
- [US-148](./US-148-perfil-personagem-entrada-motor.md) — `AdventureProfile`, entrada desta story.
- [Backlog — Motor de geração de aventuras one-shot §GEN-6 e §O desenho: três camadas](./backlog-motor-de-geracao-de-aventuras.md) (US-149) — texto de origem.
