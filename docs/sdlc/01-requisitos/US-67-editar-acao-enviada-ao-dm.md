# US-67 — Editar a ação enviada ao Mestre

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** US-18 (histórico servido pela API) — o turno precisa existir no `EventLog` para ser reescrito.
**Criada em:** 2026-07-22

---

## História

> **Como** jogador,
> **quero** editar a última ação que enviei ao Mestre e receber uma nova narração,
> **para que** um erro de digitação, uma frase ambígua ou uma ideia que mudei de última hora não me obriguem a viver com um desfecho que não era o que eu quis dizer.

---

## Contexto e motivação

### O problema observado

Hoje a ação do jogador é definitiva no instante em que ele aperta Enter. O
`GameView` (`sendMessage`) faz `POST /api/chat` com o texto cru e o `streamChat`
grava o par `ACTION`+`NARRATION` no `EventLog` assim que a narração termina
(`onFinish`, `ai.service.ts`). Não há como corrigir.

Cenário concreto: o jogador escreve *"ataco o guarda"* querendo dizer *"finto o
guarda"*, o Mestre narra um combate sangrento, a cena avança — e a única saída é
escrever uma ação nova tentando desfazer verbalmente o que já aconteceu, o que
raramente colа na narrativa. Um typo (*"abro a porta com a chava"*) tem o mesmo
peso de uma decisão de enredo: irreversível.

### Por que a solução atual não basta

O `EventLog` é **append-only** e a interface só sabe **acrescentar** turnos. Não
existe endpoint nem ação de UI para reescrever uma ação já enviada. Mesmo que o
jogador editasse o texto no `localStorage`, a narração que o Mestre já produziu
continuaria lá, incoerente com o novo texto — e o histórico que volta como
contexto nos próximos turnos (US-18) realimentaria a versão antiga.

Editar de verdade não é trocar uma string: é **descartar a narração que seguiu
aquela ação e gerar uma nova** a partir do texto corrigido.

### A proposta

Permitir editar **apenas a última ação não-resumida — e apenas quando esse turno
não mudou o estado da personagem** (HP, inventário ou cena). Ao confirmar a
edição, o servidor descarta o turno atual (a `NARRATION` e as rolagens que ele
gerou) e re-executa o turno com o texto novo, transmitindo a nova narração em
streaming — o mesmo caminho de um turno normal, só que sem duplicar a ação no
histórico.

Restringir a turnos sem mutação de estado **elimina o problema de reverter
efeitos colaterais**: se o turno não alterou HP/inventário/cena, não há o que
desfazer, e a re-execução roda por cima de um `CharacterState` idêntico ao que
existia antes da ação editada. Turnos de "conversa" e exploração (a maioria) são
editáveis; um turno que causou dano ou pegou um item não é.

---

## Escopo

### Dentro do escopo

- Controle de **editar** na última bolha de ação do jogador no `GameView`, que
  recoloca o texto no campo de entrada em modo edição, com "Salvar edição" e
  "Cancelar" (ver *Fluxo de edição pelo jogador*).
- Endpoint que **regenera o último turno**: recebe o texto editado, remove os
  eventos do turno atual e re-roda `streamChat` com a nova ação.
- A nova narração chega em streaming e substitui a anterior na tela, sem criar um
  segundo turno no histórico.
- O `localStorage` (cache do `GameView`) reflete o turno reescrito.

### Fora do escopo

- **Editar qualquer turno anterior ao último.** Só a última ação não-resumida é
  editável. Turnos mais antigos já influenciaram várias narrações seguintes;
  reescrevê-los exigiria refazer toda a cadeia — vira story futura (ramificação /
  "time travel" da campanha).
- **Editar turnos já resumidos** (`summarized: true`): o texto já foi fundido no
  `memorySummary` e o evento original não é mais a fonte de verdade. Se o último
  turno visível já caiu no resumo, a edição fica indisponível.
- **Reverter efeitos colaterais das tools** (HP, inventário, cena). Em vez de
  reverter, a US **bloqueia a edição** de qualquer turno que tenha mudado o estado
  (gerou evento `CHARACTER_UPDATE`). Só turnos sem mutação são editáveis, então não
  há efeito a desfazer.
- Editar a **narração do Mestre** (isso é reescrita do conteúdo dele, não da ação
  do jogador).
- Histórico de versões / "editado" com diff. Basta o texto final valer.

---

## Fluxo de edição pelo jogador (interface)

Passo a passo do que o jogador faz e vê, na tela de jogo (`GameView`):

1. **Afordância.** A **última bolha de ação do jogador** (a última mensagem com
   `role: 'user'`, alinhada à direita) exibe um controle de **editar** — um botão
   "✎ Editar" que aparece ao passar o mouse / focar a bolha (e é sempre visível/
   focável por teclado, para acessibilidade — US-46). Só essa bolha tem o controle;
   as ações anteriores, não.
2. **Indisponível.** Se o último turno mudou o estado (`CHARACTER_UPDATE`) ou já
   foi resumido (`summarized`), o controle **não aparece**. O jogador não vê a
   opção de editar um turno que não pode ser editado (nada de botão que dá erro ao
   clicar).
3. **Entrar em edição.** Ao clicar em "Editar", o texto da ação volta para o campo
   de entrada (o `textarea` existente), que entra em **modo edição**: o botão de
   enviar passa a "Salvar edição" e um "Cancelar" aparece. A bolha original fica
   marcada como "a editar" (esmaecida) para dar contexto.
4. **Confirmar.** O jogador ajusta o texto e confirma (botão ou Enter). A bolha de
   ação antiga, a **narração** que a seguia e as **rolagens** daquele turno somem
   da tela; a bolha de ação reaparece com o texto novo e a nova narração é
   **transmitida em streaming** logo abaixo, igual a um turno normal.
5. **Cancelar.** Cancelar esvazia o `textarea`, sai do modo edição e devolve a tela
   ao estado anterior, sem tocar no histórico.
6. **Bloqueios.** Como em `sendMessage`, não é possível iniciar ou confirmar uma
   edição enquanto o Mestre está a responder (`streaming`) ou a acordar
   (`warming`).

> A edição **não** é um segundo tipo de mensagem: é o mesmo campo de entrada e o
> mesmo fluxo de streaming do turno normal, com a diferença de que, ao confirmar,
> o cliente chama a rota de regeneração (que limpa o último turno) em vez da rota
> de turno novo.

---

## Modelo de dados proposto

> Nenhum campo novo. Reusa o `EventLog` existente; a edição **remove e recria**
> eventos do último turno, não adiciona colunas.

Regeneração do último turno (conceitual):

1. Localizar o último par `ACTION`+`NARRATION` **não-resumido** da aventura.
2. Apagar a `NARRATION` e os eventos `DICE_ROLL`/`CHARACTER_UPDATE` gerados **após
   aquela `ACTION`** (o rastro do turno que será refeito).
3. Apagar a `ACTION` antiga (ou reaproveitá-la — decisão de implementação).
4. Re-executar `streamChat` com o `message` editado, que grava o novo par no
   `onFinish` como um turno normal.

**Persistência:** as mesmas tabelas de hoje. O índice
`@@index([adventureId, characterId, type, summarized])` já cobre a busca do
último turno.

---

## Critérios de aceite

- [ ] No `GameView`, a **última** bolha de ação do jogador tem um controle de
      "editar" que recarrega o texto no campo de entrada em modo edição (com
      "Salvar edição" e "Cancelar"); "Cancelar" volta ao estado anterior sem mudar
      o histórico.
- [ ] O controle de editar é alcançável por teclado, não só no hover (US-46).
- [ ] Só a última ação **não-resumida** é editável; ações anteriores e turnos já
      `summarized` não expõem o botão de editar.
- [ ] Um turno que **mudou o estado** (gerou `CHARACTER_UPDATE` — HP, inventário ou
      cena) **não** é editável, mesmo sendo o último. A edição só aparece em turnos
      sem mutação.
- [ ] Ao confirmar a edição, a narração antiga **desaparece** e a nova é
      transmitida em streaming no lugar dela.
- [ ] Depois de editar, o histórico tem **exatamente um** turno para aquela
      posição — a ação não é duplicada e a narração antiga não sobra.
- [ ] Abrir a aventura noutro navegador (via US-18) mostra o turno **reescrito**,
      não o original.
- [ ] Editar não permite escapar da posse de personagem: a autorização é a mesma
      do turno normal (US-61 — `assertCharacterOwner`).
- [ ] Se a regeneração **falha** (todos os modelos caem, nenhuma narração nova é
      produzida), o turno original **não é perdido**: ou o par antigo permanece
      intacto, ou é restaurado. Nunca resta uma aventura com a ação apagada e sem
      narração.
- [ ] **Eval / teste de regressão:** dada uma aventura com N turnos, editar o
      último produz uma nova narração e o `EventLog` continua com N pares
      `ACTION`/`NARRATION` (não N+1), com o texto da ação atualizado.

---

## Notas de implementação

- **Reusar `streamChat`.** A regeneração é um turno normal precedido de uma limpeza
  do último turno. O ideal é um endpoint tipo `POST /api/chat/regenerate` (ou um
  flag `edit: true` no payload atual) que, antes de chamar `streamChat`, apaga o
  rastro do último turno numa transação.
- **Como achar o "rastro do último turno":** os eventos criados a partir do
  `createdAt` da última `ACTION` não-resumida. Cuidado com a ordem por `createdAt`.
- **Guarda de editabilidade:** se existe algum `CHARACTER_UPDATE` nesse rastro, o
  turno mudou o estado → edição bloqueada (não expor botão; e o endpoint deve
  rejeitar por segurança, não só a UI). Sem `CHARACTER_UPDATE`, o rastro é só
  `NARRATION` + eventuais `DICE_ROLL`, todos seguros de apagar. Isso também
  simplifica a limpeza: nunca há mutação de `CharacterState` para desfazer.
- **Janela de contexto:** como a nova execução reconstrói `history` do `EventLog`
  (só não-resumidos), apagar o turno antigo ANTES de re-rodar garante que a
  narração antiga não entre como contexto da nova.
- **Trava de rolagem (US-38):** cada execução de `streamChat` já cria seu próprio
  `RollTurnState`; a regeneração começa limpa, sem herdar o teste ancorado do turno
  descartado.
- **UI:** no `sendMessage`/`GameView`, um modo edição que remove localmente o par
  (ação + narração + rolagens) da lista antes de reenviar, espelhando o que o
  servidor faz. Reaproveitar o placeholder de streaming existente.
- **Não** permitir editar enquanto `streaming`/`warming` (mesma guarda do
  `sendMessage`).

---

## Questões em aberto

1. ~~**Efeitos colaterais das tools.**~~ **Decidido:** só é editável o turno que
   **não gerou `CHARACTER_UPDATE`**. Como o turno não mudou HP/inventário/cena, não
   há efeito colateral a reverter — a re-execução parte do mesmo `CharacterState`.
   Descartadas as alternativas de aceitar drift ou capturar snapshot pré-turno (mais
   caras e sujeitas a incoerência). Rolagens (`DICE_ROLL`) não são mutação de estado
   e não bloqueiam a edição — são apenas apagadas junto com o turno descartado.
2. ~~**Reaproveitar a `ACTION` ou apagar+recriar?**~~ **Decidido: apagar+recriar.**
   Apaga o par `ACTION`+`NARRATION` (e as `DICE_ROLL` do turno) e re-roda
   `streamChat`, que no `onFinish` grava o par novo — o mesmo caminho do turno
   normal, **sem tocar no hot path**. Reaproveitar a `ACTION` (manter a linha e só
   trocar o `payload.text`) obrigaria o `onFinish` a se ramificar em modo edição
   (não criar ACTION, só atualizar), acoplando a lógica de edição ao fluxo mais
   crítico do app e criando um estado órfão se todos os modelos falharem
   (`finalText` vazio → nada gravado, ACTION velha sem resposta). O custo de
   apagar+recriar é um `createdAt` novo na ação editada — **inobservável em
   single-player**, onde o turno editado é sempre o último da fila.
3. ~~**Janela para editar.**~~ **Decidido:** só o turno **imediatamente anterior**,
   sempre — nunca um turno arbitrário do meio do histórico, mesmo que não-resumido.
   Editar um turno do meio reabriria a cadeia de coerência (as narrações seguintes
   já reagiram a ele), o que é reescrita de campanha — fora do MVP. "Última ação
   não-resumida" e "turno imediatamente anterior" são a mesma posição: o topo do
   histórico vivo.

---

## Referências no código

- `apps/api/src/ai/ai.service.ts` — `streamChat`; `onFinish` grava o par
  `ACTION`/`NARRATION`; é aqui que a limpeza do turno antigo precisa acontecer antes
  de re-rodar.
- `apps/api/src/ai/ai.controller.ts` — onde entra o endpoint/flag de regeneração.
- `apps/web/src/components/game/GameView.tsx` — `sendMessage`, cache de
  `localStorage` (`saveHistory`), render das bolhas de mensagem; ponto da UI de
  edição.
- `apps/api/prisma/schema.prisma` — `EventLog`, enum `EventType`, flag `summarized`,
  índice existente.
- `docs/sdlc/01-requisitos/US-18-historico-servido-pela-api.md` — histórico servido
  pela API, que precisa refletir o turno reescrito.
