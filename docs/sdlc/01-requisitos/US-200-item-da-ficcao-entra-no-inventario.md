# US-200 — Motor que sincroniza item pego ou largado pela personagem com o inventário

**Épico:** 3 — Narração e mecânica
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Criada em:** 2026-08-25

**Relacionada a:**
- [US-115](./US-115-reconciliacao-de-entidades-pos-turno.md) — mesma família de reconciliação pós-turno, aplicada a entidades do mundo.
- [US-73](./US-73-reconciliador-de-cena-em-background.md) / `reconcileScene` — o molde direto desta engine: extração por LLM que compara estado atual com a narração e funde.
- [US-128](./US-128-memento-e-equipamento-da-origem-como-itens-do-inventario.md) — `InventoryItem.origin` e `applyInventoryDeltas`, reusados aqui.
- [US-74](./US-74-guard-turno-truncado-narracao.md) — gate + re-amostragem; fora desta entrega, mas é o mecanismo se um dia a engine precisar barrar turno.
- [backlog-economia-de-recursos-do-personagem.md](./backlog-economia-de-recursos-do-personagem.md) — mesma pergunta "árbitro ou narrador?", aplicada a slots.

---

## História

> **Como** jogadora,
> **quero** que o item que eu pego ou largo na ficção entre ou saia da minha ficha sozinho,
> **para que** o Mestre nunca me ofereça, nem negue, um item que já não bate com o que a narração fez.

---

## O problema

Sessão de 25/08/2026, paladina no porão do culto. Dois turnos seguidos, o mesmo item:

- **Turno N** — opção escrita pelo próprio Mestre: *"Ir pelo corredor escuro com a Afogadora, a lâmina pronta e o símbolo **Lúcivis** na outra mão"*.
- **Turno N+1** — três parágrafos depois: *"O símbolo **Lúcivis** não está mais com você; ficou no poço"*.

O símbolo nunca entrou em `CharacterState.inventory` ([`schema.prisma:59`](../../../apps/api/prisma/schema.prisma)), então nada podia confirmá-lo nem desmenti-lo. `updateInventory` ([`ai.service.ts:805`](../../../apps/api/src/ai/ai.service.ts)) é a única porta de entrada hoje, e depende inteiramente de o modelo lembrar de chamá-la — a mesma disciplina que falhou em 9 de 24 viagens com `updateScene` ([US-71](./US-71-simplificar-localizacao-do-personagem.md)). Do lado da saída não existe porta nenhuma: item tirado da personagem evapora, porque `objetos_em_cena` é explicitamente "nunca itens carregados no inventário" (`ai.service.ts:89`).

## A proposta

Uma reconciliação pós-turno — mesmo molde do `reconcileScene` ([`ai.service.ts:1870`](../../../apps/api/src/ai/ai.service.ts)): extração por LLM compara o estado atual com a narração do turno e devolve o estado no fim dela. Fire-and-forget, não bloqueia o turno, não nega nada que o Mestre escreveu — só anota.

Dois sentidos:

- **Entrada:** item que a narração diz que a personagem pegou, recebeu ou ganhou, e que ainda não está no inventário, entra.
- **Saída:** item que a narração diz que a personagem largou, deu, perdeu ou teve roubado sai do inventário — e não desaparece: migra para `objetos_em_cena` (se continua visível, à mão) ou vira entidade do ledger via `recordEntity` (se foi para outro lugar do mundo, como o símbolo no poço).

**Decisão sobre árbitro-vs-narrador:** a engine nunca impede o Mestre de narrar, nunca edita a prosa, nunca descarta turno. Ela só sincroniza a ficha com o que já foi escrito. Bloquear ou re-amostrar turno com item inconsistente é o mecanismo da [US-74](./US-74-guard-turno-truncado-narracao.md) — fica de fora, para depois.

---

## Escopo

### Dentro

- **`reconcileInventory(adventureId, characterId, narration, playerName, turnId?)`**, método privado em `ai.service.ts`, chamado no `onFinish` do turno junto de `reconcileScene`.
- **Extração estruturada** (`generateObject`, mesmo `extractionModel` do `reconcileScene`) que recebe o inventário atual e a narração, e devolve dois arrays: itens **adquiridos** (nome, ainda não no inventário) e itens **perdidos** (nome, que estava no inventário e a narração tira).
- **Merge de entrada, insert-only:** todo nome em "adquiridos" que não casa (por `norm`, tolerando acento/caixa) com item já existente vira `+1` via `applyInventoryDeltas`. Nunca remove por engano — o mesmo cuidado da US-115: um extrator não distingue "pegou" de "só viu".
- **Merge de saída, com destino decidido por comparação, não por vibe.** Todo nome em "perdidos" que casa com item existente sai do inventário (`-qty` via `applyInventoryDeltas`). O destino é o mesmo critério que `reconcileEncounterLedger` ([`ai.service.ts:1920`](../../../apps/api/src/ai/ai.service.ts)) já usa pra NPC que sai de cena — comparar antes/depois:
  1. A extração já calcula o `local` da personagem no fim da narração (mesmo dado que alimenta `reconcileScene`).
  2. Cada item em "perdidos" também carrega o `local` onde ficou (largado/caiu/ficou), no schema de extração.
  3. `local` do item **== `local` final da personagem** → ainda visível → entra em `objetos_em_cena`. `local` do item **≠ `local` final** → fora do alcance → vira/atualiza entidade do ledger via `recordEntity`.
- **Saída exige evidência textual explícita — assimetria proposital com a entrada.** Entrada tolera ambiguidade (insert-only, pior caso é duplicar — barato). Saída não: pior caso é sumir item que a jogadora ainda tem — caro. Regra: quando em dúvida, o item fica. A extração só lista um item em "perdidos" se a narração contém verbo/ação explícita de remoção (largou, jogou fora, deu, entregou, perdeu, foi roubado, destruiu, vendeu) — nunca por inferência de "não foi mencionado esse turno". O schema de extração carrega um campo `evidencia` (trecho literal da narração) por item perdido, obrigando a extração a apontar o texto que justifica a remoção — mesmo grounding que outras extrações do projeto já exigem ("use apenas o que está no texto — não invente").
- **Sem novo evento no `EventLog`.** A reconciliação não grava `CHARACTER_UPDATE` — o evento marcaria o turno como mutação e desativaria o guard de edição de ação da [US-67](./US-67-editar-acao-enviada-ao-dm.md) (mesmo motivo do `recordEntity` e do `reconcileScene` hoje, `ai.service.ts:608`).
- **Fire-and-forget.** Falha na extração loga (`logLlmFailure`, mesmo padrão do `reconcileScene`) e não altera nada — o turno já foi entregue à jogadora antes disso rodar.
- **`updateInventory` continua existindo e tem prioridade.** A engine só reconcilia o que a tool não pegou; não reescreve nem duplica o que já foi aplicado nesse turno via tool call.

### Fora do escopo

- **Peso, carga e economia de recursos.** É o [backlog de economia de recursos](./backlog-economia-de-recursos-do-personagem.md).
- **Gate que descarta e re-amostra turno.** Mecanismo da US-74; só cabe depois de a engine estar em produção e mostrar quão bem ela cobre os casos.
- **`id` estável de item.** Ver Notas de implementação, "Risco residual de referência genérica".
- **Inventário de NPC ou terceiros.** `CharacterState` é da personagem-jogadora; item na mão de NPC é entidade do ledger, não linha de inventário.
- **Aviso preventivo na lista de opções** (o Mestre oferecer opção citando item que não está na ficha). Era o desenho anterior desta US (detector `detectPhantomItem` em `guardrails.ts`, medição antes de agir); com a engine mantendo o inventário sincronizado ao fim de cada turno, esse sintoma deve cair sozinho — se não cair, vira US própria de guardrail.

---

## Modelo de dados

Nenhuma coluna nova. `CharacterState.inventory` (`schema.prisma:59`), `SceneState.objetos_em_cena` e `Adventure.entities` já existem e são os três alvos da engine.

Tipo é o da [US-128](./US-128-memento-e-equipamento-da-origem-como-itens-do-inventario.md), em [`packages/shared/src/types/character.ts:1`](../../../packages/shared/src/types/character.ts):

```ts
export interface InventoryItem {
  name: string
  qty: number
  origin?: 'memento' | 'equipment'
}
```

Sem `id`: a extração recebe o inventário atual (lista de nomes) junto da narração, e é ela — não um match de string — quem resolve referência genérica ("o símbolo") contra o nome canônico já existente ("Lúcivis"). Mesmo padrão do `reconcileScene`, que já resolve continuidade de cena dando o estado atual como contexto. `norm` (`guardrails.ts:228`) entra só depois, como rede de segurança para variação de superfície (acento/caixa) no nome que a extração devolveu — não é o mecanismo principal de casamento. Teto residual — ver Notas de implementação, "Risco residual de referência genérica".

---

## Critérios de aceite

- [x] Item que a narração diz que a personagem **pegou** aparece em `CharacterState.inventory` ao fim do turno, mesmo sem chamada de `updateInventory`.
- [x] Item que a narração diz que a personagem **largou, deu ou teve roubado** some do inventário ao fim do turno.
- [x] Item com verbo explícito de perda ("jogou a corda no rio") **remove**; item com menção ambígua sem perda real ("guardou a espada na bainha") **não remove** — reposicionamento não é perda.
- [x] Item removido do inventário cujo `local` de saída **bate com o `local` final da personagem** aparece em `objetos_em_cena` (ex.: larga a espada na mesma sala onde continua parada).
- [x] Item removido do inventário cujo `local` de saída **difere do `local` final da personagem** (ex.: símbolo cai no poço enquanto ela segue pro porão) vira entidade do ledger via `recordEntity`, com o destino descrito.
- [x] Item já no inventário, citado de novo na narração sem indicar novo pickup, **não duplica** — tolerância a acento/caixa (`lucivis` casa com `Lúcivis`).
- [x] Narração que não menciona itens **não altera** o inventário (idempotência).
- [x] Falha do provedor de extração **não quebra o turno**: jogadora recebe a narração normalmente, erro só aparece no log.
- [x] Reconciliação **não grava** `CHARACTER_UPDATE` no `EventLog`.
- [x] `updateInventory` chamado pelo modelo no mesmo turno tem prioridade — a engine não duplica nem desfaz o que a tool já aplicou.
- [x] Testes (TDD, escritos antes do código): entrada simples, saída com destino cena, saída com destino ledger, saída com verbo explícito vs. menção ambígua, idempotência, falha do provedor mockada com fake class nomeada.
- [x] `pnpm typecheck` e `pnpm test` passam. `pnpm eval` roda limpo (a engine roda no caminho do DM Agent) — 71/72; a única falha é o teste de rede real da US-36/US-70 (`us-36-qualidade-narracao.ts`), estourando o teto de 900s da suíte por rate-limit da API Gemini (18 chamadas sequenciais vs. RPM=15 do free tier) — arquivo fora do escopo desta US, sem nenhuma mudança em `packages/ai-engine`.

---

## Notas de implementação

> *Dicas. O implementador pode divergir com boa justificativa.*

- **Reusar, não duplicar:** `applyInventoryDeltas` ([`ai.service.ts:438`](../../../apps/api/src/ai/ai.service.ts)) já existe e já é o que `updateInventory` usa — a engine chama a mesma função, não reimplementa o merge.
- **`applyInventoryDeltas` casa por nome EXATO, não por `norm`.** A função indexa o inventário num `Map` chaveado por `item.name` cru (`ai.service.ts:439`) — não normaliza acento/caixa. Se a engine passar o nome que a extração devolveu ("lucivis") direto pro delta sem antes resolvê-lo contra o nome canônico já no inventário ("Lúcivis"), `applyInventoryDeltas` cria uma segunda entrada em vez de casar — quebra a AC de não-duplicação. A resolução por `norm` (linha "Merge de entrada" acima) tem que acontecer ANTES da chamada, e o delta enviado precisa usar o `name` que já existe no inventário, nunca o nome cru da extração.
- **Dois call sites, não um.** `reconcileScene` — o molde direto desta engine — roda em dois lugares: `onFinish` do turno normal (`ai.service.ts:1259`, só quando `!cenaTocada`) e `completeTruncatedTurn` (`ai.service.ts:1333`, salvage de turno truncado da US-74). O comentário em `ai.service.ts:1327` registra que esse segundo call site já foi esquecido uma vez para `sceneState`. `reconcileInventory` precisa ser plugado nos dois — senão item pego/largado num turno truncado nunca sincroniza.
- **Prompt da extração precisa instruir resolução de referência, não só extração.** Dar o inventário atual como contexto não basta sozinho — o system prompt deve dizer explicitamente para casar referência genérica ("o símbolo") contra item já existente antes de listar algo como "adquirido" ou "perdido" com nome novo. É o mesmo cuidado que `reconcileScene` já toma com `presentes` (`ai.service.ts:1884`: "Se a narração NÃO muda um campo, repita o valor da cena atual").
- **Schema de "perdidos" carrega `evidencia` e `local`, não só `name`.** Cada entrada é `{ name: string, evidencia: string, local: string }`: `evidencia` é o trecho literal da narração que motivou a remoção; `local` é onde o item ficou, comparado contra o `local` final da personagem pra decidir cena vs. ledger (ver Escopo). Além de forçar grounding (a extração não pode remover "porque sim"), os dois campos ficam no log/teste como prova — mais fácil auditar falso positivo e destino errado depois.
- **`local` do item só faz sentido se calculado junto do `local` final da personagem, no mesmo turno.** Reforça o ponto abaixo: extrair inventário e cena em chamadas separadas arrisca os dois `local` virem de leituras diferentes da narração (drift). Se implementar como método próprio (em vez de fundir com `reconcileScene`), passar o `local` final já resolvido por `reconcileScene` como contexto da extração de inventário, não recalcular do zero.
- **Considerar fundir com `reconcileScene` em vez de nova chamada LLM.** `reconcileScene` já lê a narração inteira a cada turno; estender o schema dela com `inventario_adquirido`/`inventario_perdido` evita um segundo round-trip de API no caminho quente. Separar em método próprio é mais simples de testar isoladamente — decisão do implementador, com justificativa.
- **`ai-engine` roda de `dist`:** se algo mexer em `guardrails.ts` ou em tipos de `packages/shared`, rodar `pnpm --filter @ai-dm/ai-engine build` (e `--filter @ai-dm/shared build` se for o caso) para a API pegar a mudança.
- **`recordEntity` não loga `CHARACTER_UPDATE`** pelo mesmo motivo desta engine — usar como referência de como registrar o destino do item sem acionar o guard da US-67.
- **Erro inclui o valor ofensor.** Se a extração devolver um nome de item vazio ou malformado, a mensagem de log deve trazer o valor recebido e o formato esperado (convenção do projeto).
- **Risco residual de referência genérica:** mesmo com o prompt instruindo a extração a casar "o símbolo" contra o nome canônico já existente ("Lúcivis"), ela pode errar. Cobrir esse caso nos testes; se a taxa de erro ficar alta em produção, considerar `id` estável no `InventoryItem` — resolveria de vez, mas muda a superfície de `updateInventory` em todo turno.
- **Risco residual de `local` errado:** a extração pode errar o `local` de um item perdido quando a narração é ambígua sobre onde ele ficou (afeta a decisão cena-vs-ledger). Sem mitigação de design além de testar casos ambíguos e observar a taxa em produção.
- **Lista de verbos de perda é fechada por escolha, não por limitação.** Calibrar com uso real se aparecer caso legítimo de perda que nenhum verbo da lista (largou, jogou fora, deu, entregou, perdeu, foi roubado, destruiu, vendeu) cobre.

---

## Referências no código

- [`apps/api/prisma/schema.prisma:59`](../../../apps/api/prisma/schema.prisma) — `CharacterState.inventory`.
- [`apps/api/src/ai/ai.service.ts`](../../../apps/api/src/ai/ai.service.ts) — `:438` `applyInventoryDeltas`; `:805` tool `updateInventory`; `:89`/`:863` `objetos_em_cena`; `:608` por que `recordEntity` não loga `CHARACTER_UPDATE`; `:1870` `reconcileScene`, o molde direto desta engine.
- [`packages/ai-engine/src/guardrails.ts:226`](../../../packages/ai-engine/src/guardrails.ts) — `norm`, a normalização de acento/caixa reusada no casamento por nome.
- [`packages/shared/src/types/character.ts:1`](../../../packages/shared/src/types/character.ts) — `InventoryItem`, e a ausência de `id`.
