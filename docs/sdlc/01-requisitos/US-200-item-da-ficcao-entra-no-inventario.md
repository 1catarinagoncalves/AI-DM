# US-200 — O item que a ficção entrega existe no servidor (e o que ela tira vai para algum lugar)

**Épico:** 3 — Narração e mecânica
**Fase:** 1 — MVP single-player
**Status:** 🗂️ Backlog
**Relacionada a:** [US-115](./US-115-reconciliacao-de-entidades-pos-turno.md) (**o molde exato**: detector puro na fase A, rede condicionada à medição na fase B — esta aplica o mesmo desenho ao inventário) · [US-73](./US-73-reconciliador-de-cena-em-background.md) (a mesma família de rede pós-turno, aplicada à cena) · [US-128](./US-128-memento-e-equipamento-da-origem-como-itens-do-inventario.md) (`InventoryItem.origin` e `applyInventoryDeltas`) · [US-74](./US-74-guard-turno-truncado-narracao.md) (o mecanismo de gate + re-amostragem, se um dia a fase B virar porteiro) · [backlog-economia-de-recursos-do-personagem.md](./backlog-economia-de-recursos-do-personagem.md) (a mesma pergunta *árbitro ou narrador?*, aplicada a slots)
**Criada em:** 2026-08-25

---

## História

> **Como** jogadora,
> **quero** que o item que o Mestre me deu na ficção exista na minha ficha,
> **para que** ele não possa me oferecer uma opção com um item que já não está comigo — nem dizer, no turno seguinte, que eu nunca o tive.

---

## Contexto e motivação

### O problema observado

Sessão de 25/08/2026 (paladina, porão do culto). Dois turnos consecutivos, o mesmo item:

- **Turno N**, na lista de opções escrita pelo próprio Mestre: *"Ir pelo corredor escuro com a Afogadora, a lâmina pronta e o símbolo **Lúcivis** na outra mão"*.
- **Turno N+1**, terceiro parágrafo: *"O símbolo **Lúcivis** não está mais com você; ficou no poço"*.

O Mestre contradiz, um turno depois, a opção que ele mesmo ofereceu. O símbolo nunca esteve em `CharacterState.inventory` ([`schema.prisma:59`](../../../apps/api/prisma/schema.prisma)): nasceu na prosa, viveu na prosa e foi renegado na prosa. Nenhuma parte do servidor sabia que ele existia — nem para confirmá-lo, nem para negá-lo.

### Por que a solução atual não basta

O bloco de inventário **já é autoritativo**. O cabeçalho do turn-state diz ao modelo que os blocos são a verdade do Game Server e que ele nunca deve contradizê-los ([`dm-system.ts:658`](../../../packages/ai-engine/src/prompts/dm-system.ts)), e o bloco `Current inventory` (`dm-system.ts:668`) é marcado *read-only — managed by the Game Server*. Não há linha de prompt a acrescentar: a regra existe e é forte.

O que falta é o **conteúdo** do bloco. Ele só desmente a improvisação sobre itens que estão nele, e o buraco tem duas metades:

| Metade | O que devia acontecer | O que acontece hoje |
|---|---|---|
| **Entrada** | item nomeado que a ficção entrega vira linha do inventário | `updateInventory` ([`ai.service.ts:799`](../../../apps/api/src/ai/ai.service.ts)) depende inteiramente da disciplina do modelo — a mesma disciplina que falhou em **9 de 24 viagens** com `updateScene` ([US-71](./US-71-simplificar-localizacao-do-personagem.md)) |
| **Saída** | item que a ficção tira fica em algum lugar do mundo | evapora: `objetos_em_cena` é explicitamente *"NUNCA itens carregados no inventário"* (`ai.service.ts:89` e `:857`), e o ledger só recebe o que `recordEntity` registrar |

Evaporado, o item fica **livre**: nada no turno seguinte contradiz quem o reinventa na mão da personagem, nem quem o declara perdido no poço.

A regra §4 do prompt (`dm-system.ts:506`, *"Choice options MUST match the last paragraph of your narration"*) cobre a coerência da opção com a prosa **do mesmo turno**. Não há regra que case a opção com a ficha.

### A proposta

A escada da [US-115](./US-115-reconciliacao-de-entidades-pos-turno.md), aplicada ao inventário: **a fase A mede com detector puro, a fase B só se constrói se o número justificar.** A US-115 é precedente vivo e não só desenho — `detectUnledgeredName` já existe em [`guardrails.ts:244`](../../../packages/ai-engine/src/guardrails.ts) e já loga em produção (`ai.service.ts:1226`), com a fase B ainda por construir.

Aqui a medição é ainda mais necessária porque a hipótese tem duas leituras que o transcript **não** separa: ou o símbolo nunca entrou (falha de entrada), ou entrou, saiu por `updateInventory` e o Mestre escreveu uma opção contra o próprio bloco (falha de leitura). O log da fase A distingue as duas — construir a rede antes disso é escolher a metade errada do buraco por chute.

---

## Escopo

Entrega em **duas fases**, e a fase A é o que decide se a fase B se constrói — e qual das duas fases B.

### Fase A — medir (dentro do escopo, custo zero)

- **Detector `detectPhantomItem(narration, inventory, sceneObjects, ledger, playerName)`** em [`guardrails.ts`](../../../packages/ai-engine/src/guardrails.ts), no molde de `detectUnledgeredName`: função **pura**, sem API, sem custo, testada no `pnpm test` normal. Acusa **nome próprio em negrito** (`**Lúcivis**`) que não casa com nenhum item do inventário, nenhum objeto em cena, nenhuma entidade do ledger e nem o nome da personagem.
- **Por que negrito:** é o estilo da casa para item nomeado nas opções, e é um recorte determinístico que dispensa análise sintática. Negrito de **ação** (`**Ajoelhar-se ao lado da Afogadora e colocar as mãos sobre a pulseira**`) sai pelo teto de palavras — candidato é span de até 3 palavras, com o mesmo `PROPER_NAME_RE` que o arquivo já usa.
- **Log `phantom_item` no `onFinish`**, ao lado do `unledgered_name` (`ai.service.ts:1226`), com **`calledUpdateInventory` no payload** — mesma razão que a US-115 carrega `calledRecordEntity`: a taxa real de omissão sai do log sem casar linhas por `turnId` depois.
- **Nada age.** Sem gate, sem re-amostragem, sem escrita nova. O turno sai igual ao de hoje.

### Fase B — condicionada ao número (fora desta entrega, decidida por ela)

- **B1 — entrada:** reconciliação **insert-only** do inventário pós-turno, no molde de `reconcileScene` (`ai.service.ts:1047`), inserindo o item nomeado que a ficção entregou. Insert-only pela mesma razão da US-115: um extrator não distingue *"a personagem pegou"* de *"a personagem viu"*, e remover por engano tira da jogadora algo que ela tem.
- **B2 — saída:** item removido do inventário pela ficção **migra** — vira `objetos_em_cena` quando fica à vista, ou entidade do ledger via `recordEntity` quando fica noutro lugar do mundo. Sem LLM novo: as duas estruturas já existem.
- **Preferência declarada:** se a medição mostrar que o buraco é de **saída**, B2 primeiro — é a metade barata, determinística, e é ela que impede o *"ficou no poço"* de virar canon inventado.

### Fora do escopo

- **Peso, carga e economia de recursos.** É o [backlog de economia de recursos](./backlog-economia-de-recursos-do-personagem.md).
- **Gate determinístico que descarta e re-amostra o turno com item fantasma.** O mecanismo existe e é o da [US-74](./US-74-guard-turno-truncado-narracao.md), mas só depois de medir, e só se o falso-positivo do detector for baixo. Detector de canon com falso-positivo vira turno bom descartado — custo alto, no caminho quente.
- **`id` estável de item.** Ver *Questões em aberto* #2.
- **Inventário de NPC ou de terceiros.** `CharacterState` é da personagem-jogadora; item na mão do NPC é entidade do ledger, não linha de inventário.

---

## Modelo de dados

**Nenhuma coluna nova em nenhuma das duas fases.** `CharacterState.inventory` (`schema.prisma:59`), `SceneState.objetos_em_cena` e `Adventure.entities` já existem, e a fase B usa os três como estão.

O tipo continua o da [US-128](./US-128-memento-e-equipamento-da-origem-como-itens-do-inventario.md), em [`packages/shared/src/types/character.ts:1`](../../../packages/shared/src/types/character.ts):

```ts
export interface InventoryItem {
  name: string
  qty: number
  origin?: 'memento' | 'equipment'
}
```

Sem `id`: o casamento é por `name`, com a mesma normalização de acento/caixa que `detectUnledgeredName` usa. É o teto conhecido desta US (*Questões em aberto* #2), e não se conserta aqui.

---

## Critérios de aceite (fase A)

- [ ] `detectPhantomItem` existe em `guardrails.ts`, é **pura** (sem I/O, sem provedor) e roda no `pnpm test` normal.
- [ ] **Acusa o caso real:** opção citando `o símbolo **Lúcivis** na outra mão`, com inventário que não contém o símbolo ⇒ `phantom: true`, `match: 'Lúcivis'`.
- [ ] **Não acusa** item que ESTÁ no inventário, com tolerância a acento e caixa (`**lucivis**` casa `Lúcivis`).
- [ ] **Não acusa** nome que está em `objetos_em_cena`, no ledger, ou é o nome da personagem-jogadora.
- [ ] **Não acusa** negrito de ação: span com mais de 3 palavras nunca é candidato.
- [ ] O turno emite `phantom_item` no log com `match` e `calledUpdateInventory`, ao lado do `unledgered_name` existente.
- [ ] **Nada muda no jogo:** nenhuma escrita nova no banco, nenhum evento no `EventLog`, nenhum byte a mais no stream. Teste de regressão que prova a persistência do turno inalterada.
- [ ] `pnpm typecheck` e `pnpm test` passam.

A fase B ganha critérios próprios quando a medição decidir qual das duas se constrói.

---

## Notas de implementação

> *Dicas. O implementador pode divergir com boa justificativa.*

- **Reusar, não duplicar:** `norm` e `PROPER_NAME_RE` já vivem em `guardrails.ts` (`:226`/`:228`) e são exatamente a tolerância que este detector precisa.
- **O `**` aqui é outro assunto que o da narração truncada.** [`hasOptionsList`](../../../packages/shared/src/narration.ts) lê ênfase ABERTA como sinal de corte de stream; este detector lê ênfase FECHADA como sinal de item nomeado. Predicados separados, arquivos separados, e não se fundem: um decide se o turno está completo, o outro se o canon bate.
- **`ai-engine` roda de `dist`:** mexer em `guardrails.ts` exige `pnpm --filter @ai-dm/ai-engine build` para a API pegar.
- **Log e só log.** O `onFinish` da fase A não pode escrever `CHARACTER_UPDATE` — o evento marcaria o turno como mutação e o guard da [US-67](./US-67-editar-acao-enviada-ao-dm.md) desativaria a edição da ação (mesma razão do `recordEntity`, `ai.service.ts:608`).
- **Se a fase B mexer no cabeçalho do bloco de inventário:** editar em `dm-system.ts`, **fora** de `NARRATIVE_CRAFT_SECTION` — dentro da barra de ofício dispara o guard de drift da rubrica (`rubric-drift.test.ts`, US-36).

---

## Questões em aberto

1. **Qual metade do buraco produziu o bug observado?** O transcript não separa *"nunca entrou"* de *"entrou, saiu, e a opção citou o que já não estava lá"*. **Encaminhamento:** é exatamente o que `calledUpdateInventory` no log da fase A responde — nenhuma linha de fase B se escreve antes desse número.

2. **Casamento por `name` tem teto.** *"símbolo de Lúcivis"*, *"símbolo sagrado"* e *"o símbolo"* são o mesmo objeto para a jogadora e três strings diferentes para o detector. Dar `id` ao `InventoryItem` resolveria — e obrigaria `updateInventory` a passar `id`, mudando a superfície da tool em todo turno. **Encaminhamento:** não criar `id` agora; medir quantos `phantom_item` são variação de nome de um item que ESTÁ no inventário (o log traz o `match`, dá para contar à mão numa amostra pequena).

3. **Árbitro ou narrador?** Se a fase B passar a impedir que o Mestre entregue um item que o servidor não conhece, ele ganha o poder de **negar ficção que ele mesmo escreveu**. É a pergunta #1 do [backlog de economia de recursos](./backlog-economia-de-recursos-do-personagem.md), na escala do inventário. **Decidir antes da fase B** — e a resposta provavelmente é insert-only (B1) mais migração (B2), justamente porque nenhuma das duas nega nada: as duas apenas anotam o que a ficção já fez.

4. **Item largado: cena ou ledger?** Regra proposta para a B2 — fica em `objetos_em_cena` se a personagem ainda o vê de onde está; vira entidade do ledger se ficou noutro lugar do mundo (é o caso do símbolo no poço, com a personagem já no porão). A fronteira é a mesma que `updateScene` já declara: cena é o agora, ledger é o durável.

---

## Referências no código

- [`apps/api/prisma/schema.prisma:59`](../../../apps/api/prisma/schema.prisma) — `CharacterState.inventory`, a coluna que o bloco do turno lê.
- [`apps/api/src/ai/ai.service.ts`](../../../apps/api/src/ai/ai.service.ts) — `:799` a tool `updateInventory` (a única porta de entrada hoje); `:432` `applyInventoryDeltas`; `:89`/`:857` `objetos_em_cena` e o *"NUNCA itens carregados"* que fecha a porta de saída; `:1226` o log do `unledgered_name`, molde exato do log desta US; `:1047` `reconcileScene`, molde da rede da fase B1.
- [`packages/ai-engine/src/guardrails.ts:244`](../../../packages/ai-engine/src/guardrails.ts) — `detectUnledgeredName`, o detector-irmão (US-115 fase A); `:226`/`:228` `PROPER_NAME_RE` e `norm`, reusados aqui.
- [`packages/ai-engine/src/prompts/dm-system.ts`](../../../packages/ai-engine/src/prompts/dm-system.ts) — `:658` a autoridade dos blocos do turno; `:668` o bloco `Current inventory`; `:427` a regra de `updateInventory`; `:506` a regra das opções.
- [`packages/shared/src/types/character.ts:1`](../../../packages/shared/src/types/character.ts) — `InventoryItem`, e a ausência de `id`.
