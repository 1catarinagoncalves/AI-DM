# US-151 — Semear o ledger com os segredos e NPCs gerados

**Épico:** 3 — Narração e mecânica
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** [US-144](./US-144-schema-aventura-shared.md) (schema da aventura) · [US-164](./US-164-orquestrador-motor-monta-aventura-gerada.md) (`generateAdventure`, quem produz o artefato) · [US-150](./US-150-gate-antes-de-persistir-aventura-gerada.md) (artefato já validado)
**Relacionado:** [Backlog — Motor de geração de aventuras one-shot](./backlog-motor-de-geracao-de-aventuras.md) (US-151) · [ADR 012](../../adr/012-aventura-gerada-como-dado.md) (resolve rótulos `GEN-N` do backlog para número de story) · [US-75](./US-75-dimensao-de-proveniencia-no-ledger.md) (`sabido`/`revelado`, os eixos que esta story usa) · [US-71](./US-71-simplificar-localizacao-do-personagem.md) (o defeito de produção que esta story ataca — 9 de 24 viagens sem `updateScene`) · [US-153](./US-153-aventura-deixa-de-ser-derivada-da-classe.md) (`order` calculado antes da transação — empurra pra trás o momento em que o artefato, e portanto esta função, fica disponível)
**Criada em:** 2026-08-15

---

## História

> **Como** jogador,
> **quero** que os segredos e NPCs que o motor gerou já entrem no ledger da aventura como entidades duráveis,
> **para que** o Mestre saiba o que fazer quando eu ando pelo mundo, em vez de ter só uma quest principal e nada para ancorar a cena.

---

## Contexto e motivação

### O problema observado

O caminho de semear entidades ao criar uma aventura **já roda** — `extractOpeningEntities` ([ai.service.ts:1112](../../../apps/api/src/ai/ai.service.ts)), chamado em `createForCharacter` ([adventure.service.ts:169](../../../apps/api/src/adventure/adventure.service.ts)), extrai por LLM o que a prosa de abertura estabelece. Mas essa extração é sobre **texto livre gerado sem tools** — ela infere entidades a partir de prosa, com todas as limitações de precisão que uma extração pós-hoc tem (a US-75 já documenta: *"pode perder um NPC secundário ou inferir um vínculo indevido"*). O orquestrador do motor ([US-164](./US-164-orquestrador-motor-monta-aventura-gerada.md), `generateAdventure`) produz um artefato **estruturado**, com `id`s e vínculos declarados — a fonte correta para popular o ledger deixa de ser "extrair da prosa" e passa a ser "ler o artefato".

### Por que a solução atual não basta

Sem esta story, o motor geraria uma `GeneratedAdventure` completa (locais, NPCs, ~11 segredos com `revelado: false`) mas o jogo continuaria vendo só a prosa de abertura e a quest primária — os ~11 segredos ficariam presos dentro do artefato, nunca virando `WorldEntity` no ledger que o Mestre lê a cada turno. É exatamente o defeito medido na [US-71](./US-71-simplificar-localizacao-do-personagem.md): 9 de 24 viagens sem `updateScene`, porque o Mestre não tinha pistas soltas suficientes para saber o que fazer quando o jogador anda.

### Achado ao planejar a implementação (2026-08-18, contra o código real da US-164)

Três achados corrigem a proposta abaixo (*Modelo de dados proposto*), que foi escrita antes de `generateAdventure` existir:

1. **`npcs[].interactions[]` nunca é populado por nenhum gerador atual — a linha 3 da tabela original (`interactions[].encounterId → encounter.locationId`) não tem dado nenhum pra ler.** `generateLocationsAndNpcs` grava `interactions: []` fixo ([ai.service.ts:1281](../../../apps/api/src/ai/ai.service.ts)); `buildEncounterNpcs` idem ([monster-roles.ts:83](../../../apps/api/src/adventure-generation/monster-roles.ts)). Nem `generateSecrets` nem `generateClosing` escrevem nesse campo depois. O caminho real pra resolver `local` do NPC é OUTRO, por reverse-lookup, e depende de qual das duas populações de `npcs[]` (US-164 junta as duas em `allNpcs`) o NPC veio:
   - **NPC narrativo** (de `generateLocationsAndNpcs`, `role` = descrição livre tipo `"herborista suspeita"`): `local` resolve achando a `location` cujo `occupants[]` contém o `npc.id` ([ai.service.ts:1293](../../../apps/api/src/ai/ai.service.ts) já resolve nome→id no `occupants`).
   - **NPC de combate** (de `buildEncounterNpcs`, `role` ∈ `Minion`/`Soldier`/`Brute`): nunca aparece em `occupants` — `buildEncounterNpcs` não toca `locations`. `local` resolveria achando o `encounter` cujo `npcIds[]` contém o `npc.id`, e usando `encounter.locationId` — MAS ver achado 2.
2. **NPC de combate não deveria virar `WorldEntity` — não é entidade nomeada durável.** `buildEncounterNpcs` grava `name: role` ([monster-roles.ts:81](../../../apps/api/src/adventure-generation/monster-roles.ts)) — o NPC de combate se chama literalmente `"Soldier"` ou `"Brute"`, sem nome próprio. O ledger existe pra entidades que "o Mestre não pode esquecer" ([character.ts:19-23](../../../packages/shared/src/types/character.ts)) — semear `"Brute"` com `revelado: true` não ajuda o Mestre a lembrar de nada, só polui o ledger com um combatente genérico que morre no próprio encontro. Proposta: filtrar fora de `seedLedgerFromGeneratedAdventure` todo NPC cujo `role` é chave de `MONSTER_ROLE_CR` (mesmo teste que o gate da US-150 usa pra achar CR, ver US-150 atualizada) — só NPC narrativo vira `WorldEntity`.
3. **`WorldEntity.nome` é campo OBRIGATÓRIO** ([character.ts:50](../../../packages/shared/src/types/character.ts), sem `?`) **e é a chave de merge do ledger** ("match tolerante a acento/caixa", comentário na própria interface) — mas `AdventureSecretSchema` não tem nome nenhum, só `id`/`locationId`/`text`. A tabela original (*Modelo de dados proposto*) mapeia `secrets[].text` → `nota` e nunca decide o que vira `nome`. Sem valor pra esse campo, `seedLedgerFromGeneratedAdventure` não compila contra `WorldEntity`. Proposta: `nome = secret.id` (`"secret-3"`) — não é nome de ficção, mas é estável e único, e segredo nunca é referenciado pelo nome em narração (é referenciado pelo `text`), então não precisa ser bonito, só servir de chave.

Consequência prática: com o filtro do achado 2, o caminho de "NPC de combate" do achado 1 nunca executa dentro desta story (o NPC filtrado nem chega a precisar de `local`) — mas fica registrado porque US-166 (múltiplos encontros) pode reabrir a pergunta se algum dia NPC de combate precisar de rastreio (não previsto hoje).

**Achado relacionado, herdado da [US-153](./US-153-aventura-deixa-de-ser-derivada-da-classe.md):** `order` passa a ser calculado ANTES da transação (`generateAdventure`/o gate da US-150 fazem chamada LLM, não podem segurar lock) — isso empurra pra trás TAMBÉM o momento em que o `GeneratedAdventure` fica pronto, e portanto o momento em que `seedLedgerFromGeneratedAdventure` PODE rodar. Não muda nada na função em si (`seedLedgerFromGeneratedAdventure` não usa `order`, só o artefato já pronto), mas muda ONDE ela pluga no `createForCharacter` — ver *Notas de implementação*, nota atualizada abaixo.

### Achados adicionais, conferidos contra o código real (2026-08-18, antes de codar)

4. **Números de linha do achado acima já ficaram desatualizados de novo** — US-164/US-153 mergeadas empurraram tudo mais uma vez. No `adventure.service.ts` atual: `mainQuest` é montado na linha 275 (logo após o gate devolver `generated`); o `Promise.all` de `extractOpeningScene` + `extractOpeningEntities` está nas linhas 318-324 (não 275-282); `generateOpeningNarration` roda na 287. O plug point (antes de `generateOpeningNarration`, fora do `Promise.all`) continua correto — só os números mudam. Ver *Notas de implementação* e *Referências no código* já corrigidos abaixo.
5. **`locations[].occupants[]` já guarda o `id` do NPC, não o nome** — `generateLocationsAndNpcs` ([ai.service.ts:1308-1325](../../../apps/api/src/ai/ai.service.ts)) resolve nome→id via `npcIdByName` (`Map` normalizado por `normName`) ANTES de gravar `occupants`; só cai pro nome cru se não achar match (US-158, Fora do escopo: integridade referencial é "melhor esforço", não descarta). Ou seja: o reverse-lookup do `local` do NPC narrativo compara `location.occupants` contra `npc.id` DIRETO — sem normalizar nome de novo, já vem resolvido. Um `occupants` com nome cru (sem match) simplesmente não bate com nenhum `id` — mesmo caso de "NPC sem location associada", já coberto pelo critério de aceite (não lança).
6. **`WorldEntity.atualizadoEm` é campo OBRIGATÓRIO** ([character.ts:75](../../../packages/shared/src/types/character.ts), sem `?`) e a tabela *Modelo de dados proposto* não lista de onde ele vem. `extractOpeningEntities` carimba `new Date().toISOString()` na própria função ([ai.service.ts:1263](../../../apps/api/src/ai/ai.service.ts)) — `seedLedgerFromGeneratedAdventure` precisa fazer o mesmo, por entidade, senão não compila contra `WorldEntity`.
7. **Depois desta story, `extractOpeningEntities` fica sem chamador em produção** — hoje o único caller é `createForCharacter` ([adventure.service.ts:323](../../../apps/api/src/adventure/adventure.service.ts), antes da troca), e desde a US-153 não existe mais caminho de aventura NÃO gerada pelo motor dentro dessa função. *Fora do escopo* já previa manter a função viva "pro caminho de aventura não gerada pelo motor", mas esse caminho não existe hoje — fica código morto na prática até Fase 4 (aventura autoral) ressuscitar um chamador. Não é regressão desta story, só registro pra não estranhar um `pnpm dead` futuro.

### A proposta

Trocar a **fonte** de `extractOpeningEntities` (extração por LLM da prosa) pelo **artefato gerado** (leitura direta e determinística), mantendo o resto do pipeline de semeadura (`tx.adventure.create({ data: { entities } })`) intacto. Os ~11 segredos entram como `WorldEntity` com `revelado: false`; os NPCs NARRATIVOS (não os de combate, achado 2 acima), com `revelado: true`.

---

## Escopo

### Dentro do escopo

- **`seedLedgerFromGeneratedAdventure(adventure: GeneratedAdventure): WorldEntity[]`** — mapeia `adventure.secrets[]` → `WorldEntity` com `nome = secret.id` (chave de merge; segredo não tem nome de ficção, achado 2026-08-18 #3), `tipo: 'outro'` (ou o tipo mais apropriado por segredo), `sabido: 'publico'` (padrão salvo indicação contrária), `revelado: false` (o jogador ainda não descobriu — é a razão de existir do segredo), `local` = título da location de `secret.locationId` (campo nativo no segredo, sem lookup reverso). Mapeia `adventure.npcs[]` → `WorldEntity` só pros NPCs NARRATIVOS (filtra fora `role` ∈ `MONSTER_ROLE_CR`, achado 2026-08-18 acima) com `tipo: 'npc'`, `revelado: true` (o jogador já pode encontrá-los desde o início), `local` resolvido por reverse-lookup em `locations[].occupants[]` (não por `interactions[]` — achado acima).
- **Substitui a fonte em `createForCharacter`** ([adventure.service.ts](../../../apps/api/src/adventure/adventure.service.ts)): quando a aventura vem do motor ([US-153](./US-153-aventura-deixa-de-ser-derivada-da-classe.md) troca o caminho), `seedLedgerFromGeneratedAdventure` substitui `extractOpeningEntities` como fonte de `tx.adventure.create({ data: { entities } })`. O `map()` em si é o mesmo padrão — só a fonte muda de "extração por LLM" para "leitura do artefato validado".
- **Reusa a US-75 inteira.** O Mestre já sabe não revelar segredo com `revelado: false` (regras de prompt já escritas naquela story) e já reinjeta sem comprimir (ledger nunca é resumido) — esta story só popula o ledger de outra fonte, não muda nenhuma regra de prompt de leitura.
- **Teste de mapeamento:** artefato com 3 segredos e 2 NPCs narrativos produz exatamente 5 `WorldEntity`, com os campos `revelado`/`sabido` corretos por tipo (NPC de combate, se presente no artefato, não conta — ver achado 2026-08-18).

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
| `secrets[].id` | `nome` — chave de merge; segredo não tem nome de ficção, `id` serve porque nunca é citado pelo nome em narração (achado 2026-08-18 #3) |
| `secrets[].text` | `nota`, `revelado: false`, `sabido: 'publico'` (padrão) |
| `secrets[].locationId` → `location.title` | `local` do segredo — direto, sem reverse-lookup (o segredo já carrega o id nativo) |
| `npcs[].name` + `.role`, SÓ onde `role` ∉ `MONSTER_ROLE_CR` | `nome`, `nota` (role), `tipo: 'npc'`, `revelado: true` — NPC de combate (`role` ∈ `Minion`/`Soldier`/`Brute`) é FILTRADO, não vira `WorldEntity` (achado 2026-08-18, não é entidade nomeada durável) |
| `locations[].occupants[]` contém `npc.id` → essa `location.title` | `local` do NPC narrativo — reverse-lookup em `occupants`, NÃO em `npcs[].interactions[]` (achado 2026-08-18: `interactions[]` nunca é populado por nenhum gerador atual) |

**Persistência:** `Adventure.entities` (`Json?`), mesma coluna que `extractOpeningEntities` já popula hoje — sem migração.

---

## Critérios de aceite

- [x] `seedLedgerFromGeneratedAdventure` mapeia todo `secrets[]` do artefato para `WorldEntity` com `nome = secret.id`, `revelado: false`, `local` preenchido do título da location referenciada por `secret.locationId`.
- [x] Mapeia todo `npcs[]` NARRATIVO (role ∉ `MONSTER_ROLE_CR`) do artefato para `WorldEntity` com `revelado: true`; NPC de combate (role ∈ `Minion`/`Soldier`/`Brute`) NÃO vira `WorldEntity` (achado 2026-08-18).
- [x] O `local` do NPC narrativo é resolvido por reverse-lookup em `locations[].occupants[]` (não em `npcs[].interactions[]`, que nenhum gerador atual popula) — NPC sem location associada não quebra o mapeamento (campo fica ausente, não lança).
- [x] Quando a aventura vem do motor gerado, `tx.adventure.create({ data: { entities } })` recebe o resultado desta função — não mais o de `extractOpeningEntities` (essa troca é condicionada pela [US-153](./US-153-aventura-deixa-de-ser-derivada-da-classe.md), que decide quando "a aventura vem do motor").
- [x] A semeadura **não** gera evento `CHARACTER_UPDATE` (mesmo comportamento da US-75).
- [x] `pnpm typecheck` e `pnpm test` passam.
- [x] **Eval / teste de regressão:** fixture com artefato de 3 segredos + 2 NPCs narrativos + 1 NPC de combate (role `'Soldier'`) produz ledger com exatamente 5 entidades — o NPC de combate NÃO aparece — cada uma com `revelado`/`sabido`/`tipo`/`local` corretos; ausência de `entities` não quebra a criação (artefato vazio → ledger vazio, mesmo comportamento de fallback pré-US-75).

---

## Notas de implementação

- **Espelhar `extractOpeningEntities` na assinatura, não na implementação** — a função nova não é `async` (não chama LLM, só mapeia um objeto já validado pelo gate), então é síncrona e não precisa do padrão `Promise.all` que `createForCharacter` usa para as duas extrações hoje.
- **`WorldEntity.tipo` para segredo:** o tipo `'outro'` é o mais genérico do enum existente (`npc | local | objeto | faccao | outro`) — segredo não é bem nenhum dos quatro específicos; usar `'outro'` até haver evidência de que precisa de tipo próprio.
- **Onde plugar — corrigido contra o código real (2026-08-18, conferido de novo antes de codar):** o `Promise.all` que chama `extractOpeningScene` + `extractOpeningEntities` está em [adventure.service.ts:318-324](../../../apps/api/src/adventure/adventure.service.ts) (não `:275-282` — mergear US-164/US-153 empurrou tudo mais uma vez, achado adicional #4 acima). MAS `seedLedgerFromGeneratedAdventure` não precisa entrar nesse `Promise.all`: ele é síncrono e depende só do `GeneratedAdventure` (`generated`, pronto na linha 274, logo após o gate devolver), não do `openingText` — que só existe depois de `generateOpeningNarration` (linha 287) rodar. Plug-in melhor: logo após o gate devolver o artefato validado (linha 274-275, onde `mainQuest` já é montado), ANTES até de `generateOpeningNarration` (achado da US-153: `order` → gate/`generateAdventure` → aqui → `generateOpeningNarration` com `mainQuest` do artefato → `extractOpeningScene` sozinho, sem mais `Promise.all` com `extractOpeningEntities`, que esta story substitui).
- **Filtro de NPC de combate reusa o mesmo teste do gate da US-150** — `role in MONSTER_ROLE_CR` ([monster-roles.ts](../../../apps/api/src/adventure-generation/monster-roles.ts)), não uma constante nova duplicada aqui.
- **`nome = secret.id` é só até haver evidência contrária** (achado 2026-08-18 #3) — se algum dia o Mestre precisar CITAR um segredo pelo nome em prosa (hoje não cita, só age de acordo com ele), revisitar; `id` como `nome` funciona pro merge do ledger, não pra leitura humana.

---

## Questões em aberto

1. ~~Como o `local` do NPC é resolvido quando o NPC participa de mais de um encontro em locais diferentes?~~ **RESOLVIDO (2026-08-18), pela mecânica real da US-164:** NPC de combate (o único que `encounters[].npcIds` referencia hoje) é filtrado fora do ledger (achado 2 acima) — a pergunta original não se aplica a ele. NPC narrativo nunca aparece em `encounters[].npcIds` (só em `locations[].occupants[]`); se o mesmo nome aparecer nos `occupants` de mais de uma location (LLM repetindo, raro), primeiro match no array de `locations[]` vence — sem campo novo em `AdventureNpcSchema`. Fica registrado pra revisitar se a US-166 (múltiplos encontros) ou uma US futura decidir rastrear NPC de combate no ledger.

---

## Referências no código

- [US-164](./US-164-orquestrador-motor-monta-aventura-gerada.md) — ✅ implementada 2026-08-18. `AdventureService.generateAdventure`, quem entrega o `GeneratedAdventure` que esta story lê.
- [apps/api/src/adventure-generation/monster-roles.ts](../../../apps/api/src/adventure-generation/monster-roles.ts) — `MONSTER_ROLE_CR` (teste de "é NPC de combate?", achado 2026-08-18), `buildEncounterNpcs` (por que `interactions[]`/`occupants[]` ficam vazios pro NPC de combate).
- [apps/api/src/ai/ai.service.ts:1308-1325](../../../apps/api/src/ai/ai.service.ts) — `generateLocationsAndNpcs`, onde `occupants[]` resolve nome→id via `npcIdByName` (achado adicional #5: `occupants` já guarda `id`, não nome — reverse-lookup compara direto contra `npc.id`).
- [apps/api/src/ai/ai.service.ts:1247-1269](../../../apps/api/src/ai/ai.service.ts) — `extractOpeningEntities`, a função cuja fonte esta story substitui (não remove; fica sem chamador em produção após a troca, achado adicional #7).
- [apps/api/src/adventure/adventure.service.ts:318-324](../../../apps/api/src/adventure/adventure.service.ts) — `Promise.all` de extração pós-abertura (número real pós-US-164/US-153, conferido 2026-08-18; não é mais onde o branch novo entra — ver *Notas de implementação*, achado adicional #4).
- [packages/shared/src/types/character.ts](../../../packages/shared/src/types/character.ts) — `WorldEntity`, o tipo de destino do mapeamento.
- [US-75](./US-75-dimensao-de-proveniencia-no-ledger.md) — `sabido`/`revelado`, os eixos reusados sem mudança de semântica.
- [US-71](./US-71-simplificar-localizacao-do-personagem.md) — 9 de 24 viagens sem `updateScene`, o defeito de produção que esta story paga.
- [Backlog — Motor de geração de aventuras one-shot §GEN-8](./backlog-motor-de-geracao-de-aventuras.md) (US-151) — texto de origem.
