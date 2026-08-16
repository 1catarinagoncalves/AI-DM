# US-151 — Semear o ledger com os segredos e NPCs gerados

**Épico:** 3 — Narração e mecânica
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** [US-144](./US-144-schema-aventura-shared.md) (schema da aventura) · [US-150](./US-150-gate-antes-de-persistir-aventura-gerada.md) (artefato já validado)
**Relacionado:** [Backlog — Motor de geração de aventuras one-shot](./backlog-motor-de-geracao-de-aventuras.md) (US-151) · [ADR 012](../../adr/012-aventura-gerada-como-dado.md) (resolve rótulos `GEN-N` do backlog para número de story) · [US-75](./US-75-dimensao-de-proveniencia-no-ledger.md) (`sabido`/`revelado`, os eixos que esta story usa) · [US-71](./US-71-simplificar-localizacao-do-personagem.md) (o defeito de produção que esta story ataca — 9 de 24 viagens sem `updateScene`)
**Criada em:** 2026-08-15

---

## História

> **Como** jogador,
> **quero** que os segredos e NPCs que o motor gerou já entrem no ledger da aventura como entidades duráveis,
> **para que** o Mestre saiba o que fazer quando eu ando pelo mundo, em vez de ter só uma quest principal e nada para ancorar a cena.

---

## Contexto e motivação

### O problema observado

O caminho de semear entidades ao criar uma aventura **já roda** — `extractOpeningEntities` ([ai.service.ts:1112](../../../apps/api/src/ai/ai.service.ts)), chamado em `createForCharacter` ([adventure.service.ts:169](../../../apps/api/src/adventure/adventure.service.ts)), extrai por LLM o que a prosa de abertura estabelece. Mas essa extração é sobre **texto livre gerado sem tools** — ela infere entidades a partir de prosa, com todas as limitações de precisão que uma extração pós-hoc tem (a US-75 já documenta: *"pode perder um NPC secundário ou inferir um vínculo indevido"*). O motor de geração ([US-144](./US-144-schema-aventura-shared.md) a [US-150](./US-150-gate-antes-de-persistir-aventura-gerada.md)) produz um artefato **estruturado**, com `id`s e vínculos declarados — a fonte correta para popular o ledger deixa de ser "extrair da prosa" e passa a ser "ler o artefato".

### Por que a solução atual não basta

Sem esta story, o motor geraria uma `GeneratedAdventure` completa (locais, NPCs, ~11 segredos com `revelado: false`) mas o jogo continuaria vendo só a prosa de abertura e a quest primária — os ~11 segredos ficariam presos dentro do artefato, nunca virando `WorldEntity` no ledger que o Mestre lê a cada turno. É exatamente o defeito medido na [US-71](./US-71-simplificar-localizacao-do-personagem.md): 9 de 24 viagens sem `updateScene`, porque o Mestre não tinha pistas soltas suficientes para saber o que fazer quando o jogador anda.

### A proposta

Trocar a **fonte** de `extractOpeningEntities` (extração por LLM da prosa) pelo **artefato gerado** (leitura direta e determinística), mantendo o resto do pipeline de semeadura (`tx.adventure.create({ data: { entities } })`) intacto. Os ~11 segredos entram como `WorldEntity` com `revelado: false`; os ~7 NPCs, com `revelado: true`.

---

## Escopo

### Dentro do escopo

- **`seedLedgerFromGeneratedAdventure(adventure: GeneratedAdventure): WorldEntity[]`** — mapeia `adventure.secrets[]` → `WorldEntity` com `tipo: 'outro'` (ou o tipo mais apropriado por segredo), `sabido: 'publico'` (padrão salvo indicação contrária), `revelado: false` (o jogador ainda não descobriu — é a razão de existir do segredo). Mapeia `adventure.npcs[]` → `WorldEntity` com `tipo: 'npc'`, `revelado: true` (o jogador já pode encontrá-los desde o início), `local` resolvido do `locationId` do encontro/interação mais próximo.
- **Substitui a fonte em `createForCharacter`** ([adventure.service.ts](../../../apps/api/src/adventure/adventure.service.ts)): quando a aventura vem do motor ([US-153](./US-153-aventura-deixa-de-ser-derivada-da-classe.md) troca o caminho), `seedLedgerFromGeneratedAdventure` substitui `extractOpeningEntities` como fonte de `tx.adventure.create({ data: { entities } })`. O `map()` em si é o mesmo padrão — só a fonte muda de "extração por LLM" para "leitura do artefato validado".
- **Reusa a US-75 inteira.** O Mestre já sabe não revelar segredo com `revelado: false` (regras de prompt já escritas naquela story) e já reinjeta sem comprimir (ledger nunca é resumido) — esta story só popula o ledger de outra fonte, não muda nenhuma regra de prompt de leitura.
- **Teste de mapeamento:** artefato com 3 segredos e 2 NPCs produz exatamente 5 `WorldEntity`, com os campos `revelado`/`sabido` corretos por tipo.

### Fora do escopo

- **Mudar como o Mestre lê/respeita o ledger** — regras de gate (Eixo A/B) já existem da US-75, intocadas.
- **Locais e encontros como `WorldEntity`** — o backlog especifica só segredos e NPCs; locais podem entrar em story futura se a evidência pedir (não listado no escopo do US-151 original).
- **`extractOpeningEntities` deixa de existir.** Continua servindo o caminho de aventura **não** gerada pelo motor (se algum existir na transição, ou a aventura autoral da fase 4) — esta story só troca a fonte quando a aventura vem do motor.
- **A semeadura não loga `CHARACTER_UPDATE`** (mesma razão da US-75: não reativar o bloqueio de edição da [US-67](./US-67-editar-acao-enviada-ao-dm.md)) — comportamento herdado, não reimplementado.

---

## Modelo de dados proposto

> Sem schema novo — mapeia `GeneratedAdventure` (US-144) para `WorldEntity[]` (já existente, `character.ts`).

| De (`GeneratedAdventure`) | Para (`WorldEntity`) |
|---|---|
| `secrets[].text` | `nota`, `revelado: false`, `sabido: 'publico'` (padrão) |
| `npcs[].name` + `.role` | `nome`, `nota` (role), `tipo: 'npc'`, `revelado: true` |
| `npcs[].interactions[].encounterId` → `encounter.locationId` | `local` do NPC, resolvido por join |

**Persistência:** `Adventure.entities` (`Json?`), mesma coluna que `extractOpeningEntities` já popula hoje — sem migração.

---

## Critérios de aceite

- [ ] `seedLedgerFromGeneratedAdventure` mapeia todo `secrets[]` do artefato para `WorldEntity` com `revelado: false`.
- [ ] Mapeia todo `npcs[]` do artefato para `WorldEntity` com `revelado: true`.
- [ ] O `local` do NPC, quando resolvível pela interação/encontro, é preenchido — NPC sem encontro associado não quebra o mapeamento (campo fica ausente, não lança).
- [ ] Quando a aventura vem do motor gerado, `tx.adventure.create({ data: { entities } })` recebe o resultado desta função — não mais o de `extractOpeningEntities` (essa troca é condicionada pela [US-153](./US-153-aventura-deixa-de-ser-derivada-da-classe.md), que decide quando "a aventura vem do motor").
- [ ] A semeadura **não** gera evento `CHARACTER_UPDATE` (mesmo comportamento da US-75).
- [ ] `pnpm typecheck` e `pnpm test` passam.
- [ ] **Eval / teste de regressão:** fixture com artefato de 3 segredos + 2 NPCs produz ledger com exatamente 5 entidades, cada uma com `revelado`/`sabido`/`tipo` corretos; ausência de `entities` não quebra a criação (artefato vazio → ledger vazio, mesmo comportamento de fallback pré-US-75).

---

## Notas de implementação

- **Espelhar `extractOpeningEntities` na assinatura, não na implementação** — a função nova não é `async` (não chama LLM, só mapeia um objeto já validado pelo gate), então é síncrona e não precisa do padrão `Promise.all` que `createForCharacter` usa para as duas extrações hoje.
- **`WorldEntity.tipo` para segredo:** o tipo `'outro'` é o mais genérico do enum existente (`npc | local | objeto | faccao | outro`) — segredo não é bem nenhum dos quatro específicos; usar `'outro'` até haver evidência de que precisa de tipo próprio.
- **Onde plugar:** [adventure.service.ts:164-171](../../../apps/api/src/adventure/adventure.service.ts) — o `Promise.all` que hoje chama `extractOpeningScene` + `extractOpeningEntities` ganha um branch: aventura do motor usa `seedLedgerFromGeneratedAdventure` (síncrono) em vez de `extractOpeningEntities` (assíncrono).

---

## Questões em aberto

1. Como o `local` do NPC é resolvido quando o NPC participa de mais de um encontro em locais diferentes? O schema (US-144) não define "local primário" do NPC — decidir na implementação: primeiro encontro na ordem do array, ou campo explícito a acrescentar em `AdventureNpcSchema`.

---

## Referências no código

- [apps/api/src/ai/ai.service.ts:1112](../../../apps/api/src/ai/ai.service.ts) — `extractOpeningEntities`, a função cuja fonte esta story substitui (não remove).
- [apps/api/src/adventure/adventure.service.ts:164-171](../../../apps/api/src/adventure/adventure.service.ts) — `Promise.all` de extração pós-abertura, onde o branch novo entra.
- [packages/shared/src/types/character.ts](../../../packages/shared/src/types/character.ts) — `WorldEntity`, o tipo de destino do mapeamento.
- [US-75](./US-75-dimensao-de-proveniencia-no-ledger.md) — `sabido`/`revelado`, os eixos reusados sem mudança de semântica.
- [US-71](./US-71-simplificar-localizacao-do-personagem.md) — 9 de 24 viagens sem `updateScene`, o defeito de produção que esta story paga.
- [Backlog — Motor de geração de aventuras one-shot §GEN-8](./backlog-motor-de-geracao-de-aventuras.md) (US-151) — texto de origem.
