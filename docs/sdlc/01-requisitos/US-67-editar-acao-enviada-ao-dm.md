# US-67 — Editar a ação enviada ao Mestre

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
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

Permitir editar **apenas a última ação não-resumida** da aventura. Ao confirmar a
edição, o servidor descarta o turno atual (a `NARRATION` e os eventos de rolagem/
estado que ele gerou) e re-executa o turno com o texto novo, transmitindo a nova
narração em streaming — o mesmo caminho de um turno normal, só que sem duplicar a
ação no histórico.

---

## Escopo

### Dentro do escopo

- Botão/gesto de **editar a última mensagem do jogador** no `GameView`, que
  recoloca o texto no campo de entrada em modo edição.
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
- **Reverter efeitos colaterais das tools** (HP, inventário, cena) aplicados no
  turno editado — ver Questões em aberto. O MVP aceita a re-execução por cima do
  estado atual.
- Editar a **narração do Mestre** (isso é reescrita do conteúdo dele, não da ação
  do jogador).
- Histórico de versões / "editado" com diff. Basta o texto final valer.

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

- [ ] No `GameView`, a **última** mensagem do jogador tem uma ação de "editar" que
      recarrega o texto no campo de entrada.
- [ ] Só a última ação **não-resumida** é editável; ações anteriores e turnos já
      `summarized` não expõem o botão de editar.
- [ ] Ao confirmar a edição, a narração antiga **desaparece** e a nova é
      transmitida em streaming no lugar dela.
- [ ] Depois de editar, o histórico tem **exatamente um** turno para aquela
      posição — a ação não é duplicada e a narração antiga não sobra.
- [ ] Abrir a aventura noutro navegador (via US-18) mostra o turno **reescrito**,
      não o original.
- [ ] Editar não permite escapar da posse de personagem: a autorização é a mesma
      do turno normal (US-61 — `assertCharacterOwner`).
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
  `createdAt` da última `ACTION` não-resumida (inclusive as `DICE_ROLL`/
  `CHARACTER_UPDATE` daquele turno). Cuidado com a ordem por `createdAt`.
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

1. **Efeitos colaterais das tools.** O turno descartado pode ter mudado HP,
   inventário ou cena via tool. Reverter exige um snapshot do `CharacterState`
   antes do turno (não temos hoje). Opções: (a) MVP aceita o drift e re-roda por
   cima do estado atual; (b) capturar snapshot pré-turno para restaurar; (c) só
   permitir editar quando o último turno não disparou nenhuma tool de mutação.
   Recomendação inicial: (a), documentando a limitação.
2. **Reaproveitar a `ACTION` ou apagar+recriar?** Reusar mantém `createdAt` e
   posição; apagar+recriar é mais simples de raciocinar. Decidir na implementação.
3. **Janela para editar.** Só o turno imediatamente anterior, sempre? Ou qualquer
   turno enquanto não-resumido (o que reabre a cadeia de coerência)? O escopo atual
   trava no último; confirmar que basta para o MVP.

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
