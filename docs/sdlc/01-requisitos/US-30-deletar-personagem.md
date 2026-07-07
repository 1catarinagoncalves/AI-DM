# US-30 — Deletar personagem pela interface

**Épico:** 4 — Onboarding e navegação
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** [US-25](./US-25-boas-vindas-adaptativa.md) (hub que lista os personagens e é onde a ação de deletar aparece). O endpoint `DELETE` é entregue por esta própria story.
**Criada em:** 2026-07-03

---

## História

> **Como** jogadora,
> **quero** deletar pela interface um personagem que criei,
> **para que** eu possa remover fichas de teste, duplicadas ou que não quero mais, mantendo meu hub limpo.

---

## Contexto e motivação

### O problema observado

A US-25 tornou o hub orientado a dados: ele lista os personagens do usuário via `GET /characters/user/:userId`. Mas a lista só cresce — não há como remover um personagem. Quem cria uma ficha para testar, erra o nome, ou acumula duplicados fica preso com elas no hub ("Ver todos os personagens") para sempre.

O escopo da US-25 marcou explicitamente **"Excluir/renomear personagem"** como fora do escopo. Esta story fecha a metade "excluir".

### Por que a solução atual não basta

Nem o cliente (`api.ts`) nem a API expõem exclusão. O `CharacterController` só tem `create`, `findByUser` e `findOne` — não há `DELETE`. E deletar um `Character` não é um `delete` solto: o schema tem três relações filhas **sem `onDelete: Cascade`** apontando para `Character` (`CharacterState`, `AdventureParticipant`, `EventLog`). Um `prisma.character.delete` cru estoura violação de foreign key se o personagem já jogou qualquer aventura.

### A proposta

- Um endpoint `DELETE /characters/:id` que remove o personagem **e seus dependentes** numa transação.
- No hub (US-25), uma ação de deletar por personagem, com **confirmação** antes de executar (é destrutivo e irreversível), e a lista se atualiza sem o item removido.

---

## Escopo

### Dentro do escopo

- **Endpoint `DELETE /characters/:id`** — apaga o personagem e todos os registros que dependem dele, numa única transação. Idempotente na prática: id inexistente → `404`.
- **Cliente `api.deleteCharacter(id)`** em `apps/web/src/lib/api.ts`, tipando a resposta.
- **Ação de deletar no hub:** botão/ícone de excluir por personagem (na lista "Ver todos os personagens" e/ou no card em foco).
- **Diálogo de confirmação** nomeando o personagem ("Deletar Lyra Silvermoon? Esta ação não pode ser desfeita.") — nada é apagado sem o segundo clique.
- **Atualização otimista/refetch:** após confirmar, a lista do hub reflete a remoção sem recarregar a página.
- Se o personagem deletado era o **em foco**, o hub re-foca o próximo (mesmo critério de "último jogado" da US-25) ou cai no estado vazio se era o último.
- Estados de **erro** da exclusão (falha de rede/servidor → mensagem, personagem permanece na lista).

### Fora do escopo

- **Renomear/editar** personagem — a outra metade que a US-25 adiou; fica para story própria.
- **Soft delete / lixeira / desfazer** — no MVP a exclusão é definitiva (ver Questões em aberto).
- **Autorização** (garantir que o usuário só apaga os próprios personagens) — depende de US-24; enquanto não há sessão autenticada, vale o `userId` local. Ver Notas.
- Deletar **aventuras** avulsas de forma independente (aqui as aventuras do personagem são apagadas *junto com ele* — ver modelo de dados). No MVP single-player cada aventura tem um único participante, então a aventura pertence a esse personagem.

---

## Modelo de dados proposto

Sem tabela nova e **sem migração**. O trabalho é a **ordem de exclusão**, já que não há `onDelete: Cascade` em lugar nenhum do schema. Apagar o personagem apaga também as **aventuras dele** (para não deixá-las órfãs) — e cada aventura tem seus próprios filhos. A exclusão, numa transação:

**1. Descobrir as aventuras do personagem** — os `adventureId` distintos em `AdventureParticipant`/`CharacterState` onde `characterId = :id`. (No MVP single-player são as aventuras que pertencem só a ele.)

**2. Apagar os filhos de cada aventura, depois a aventura:**

| Registro | Como se liga | Ordem |
|---|---|---|
| `EventLog` | `adventureId` | apagar (`deleteMany` por `adventureId`) |
| `Quest` | `adventureId` | apagar (`deleteMany` por `adventureId`) |
| `CharacterState` | `adventureId` | apagar (`deleteMany` por `adventureId`) |
| `AdventureParticipant` | `adventureId` | apagar (`deleteMany` por `adventureId`) |
| `Adventure` | `id` | apagar (`deleteMany` por `id` nas aventuras achadas no passo 1) |

**3. Apagar os filhos do personagem que sobraram e o personagem:**

| Registro | Como se liga | Ordem |
|---|---|---|
| `CharacterState` / `AdventureParticipant` / `EventLog` | `characterId` | apagar quaisquer remanescentes (limpa registros do personagem não cobertos pelo passo 2) |
| `Character` | `id` | apagar por último |

> **Por que apagar por `adventureId` e depois por `characterId`?** `EventLog.characterId` é nullable e `CharacterState`/`AdventureParticipant` se ligam tanto à aventura quanto ao personagem. Apagar por `adventureId` (passo 2) remove o grosso; o `deleteMany` por `characterId` (passo 3) é a rede de segurança para qualquer registro do personagem fora das aventuras achadas. `deleteMany` não falha se não houver linhas.
>
> **`Adventure` referencia `creator` (User) e `System`** — esses são **pais**, não são tocados. Só a aventura e seus filhos somem.

---

## Critérios de aceite

- [ ] Existe `DELETE /characters/:id` que, numa transação, remove o personagem, **as aventuras dele** e todos os dependentes (`Quest`, `EventLog`, `CharacterState`, `AdventureParticipant`); id inexistente devolve `404`.
- [ ] Deletar um personagem que **já jogou** uma aventura funciona sem erro de foreign key.
- [ ] Após deletar, a(s) `Adventure`(s) do personagem **não existem mais** — nenhuma aventura órfã fica no banco.
- [ ] No hub, cada personagem tem uma ação de **deletar**.
- [ ] Clicar em deletar abre uma **confirmação** que nomeia o personagem; **cancelar** não apaga nada.
- [ ] Após confirmar, o personagem **some da lista do hub** sem recarregar a página.
- [ ] Se o personagem deletado estava **em foco**, o hub passa o foco para o próximo (critério de "último jogado" da US-25) ou mostra o **estado vazio** se era o único.
- [ ] Se a exclusão falhar (rede/servidor), o personagem **permanece** na lista e o jogador vê uma mensagem de erro.
- [ ] **Eval / teste de regressão (endpoint):** criar personagem, dar-lhe uma aventura com `CharacterState`/`EventLog`/`Quest`, `DELETE /characters/:id` → `2xx`; `findOne(id)` depois → `404`; e a `Adventure` e todos os seus filhos (`CharacterState`/`EventLog`/`Quest`/`AdventureParticipant`) daquele personagem não existem mais.
- [ ] **Eval / teste de regressão (hub):** com dois personagens, deletar um remove só ele da lista renderizada; deletar o último leva ao convite de criação (estado vazio).

---

## Notas de implementação

- **Serviço:** adicionar `remove(id)` em `character.service.ts` numa `prisma.$transaction(async (tx) => …)`: (1) `character.findUnique` — se não existir, `NotFoundException` (`404`); (2) achar os `adventureId` do personagem (`findMany` distinct em `AdventureParticipant`/`CharacterState`); (3) `deleteMany` dos filhos por `adventureId` na ordem da tabela do modelo de dados, depois `adventure.deleteMany`; (4) `deleteMany` remanescentes por `characterId`; (5) `character.delete`. Precisa da forma com callback (não o array) porque o passo 2 alimenta os passos seguintes.
- **Controller:** `@Delete(':id') remove(@Param('id') id: string)` no `CharacterController`, ao lado dos já existentes; documentar com `@ApiOperation`.
- **Cliente:** `deleteCharacter(id)` em `api.ts` (mesmo padrão dos outros fetch); no `HomeHero`, após sucesso, filtrar o item do `useState` da lista (ou refetch de `listCharacters`) e reavaliar o foco.
- **Confirmação:** reusar o padrão de diálogo/modal já existente na web se houver; senão, um `window.confirm` cobre o MVP (`// ponytail: window.confirm no MVP, trocar por modal se o design pedir`).
- **Autorização:** quando US-24 existir, o `DELETE` deve validar que o `Character.userId` bate com o usuário da sessão. Sem US-24, não há como impor isso server-side de forma confiável — registrar como dívida ligada a [US-24](#).
- Reusar estilos/estrutura de `HomeHero.tsx` (botão secundário/ícone) para a ação de deletar.

---

## Questões em aberto

- **Multiplayer (futuro):** a exclusão assume que a aventura pertence só a este personagem (single-player). Quando houver mais de um participante por aventura, apagar um personagem **não** pode apagar a aventura dos outros — nesse caso a regra vira "só remove o `AdventureParticipant`/`CharacterState` deste personagem e apaga a aventura apenas se ela ficar sem participantes". Reavaliar com o multiplayer; relaciona com US-22.
- **Soft delete / desfazer:** exclusão definitiva no MVP. Se surgir demanda de "lixeira/desfazer", vira story própria; não bloqueia esta.

---

## Referências no código

- `apps/api/src/character/character.controller.ts` — `create`/`findByUser`/`findOne`; onde entra o `@Delete(':id')`.
- `apps/api/src/character/character.service.ts` — onde entra `remove(id)` com a transação de exclusão em cascata manual.
- `apps/api/prisma/schema.prisma` — nenhuma relação tem `onDelete: Cascade`; por isso os filhos da `Adventure` (`Quest`, `EventLog`, `CharacterState`, `AdventureParticipant`) e do `Character` precisam ser apagados na ordem certa antes dos pais.
- `apps/web/src/lib/api.ts` — falta `deleteCharacter(id)` (a criar).
- `apps/web/src/components/HomeHero.tsx` — hub (US-25); onde entra a ação de deletar + confirmação + reavaliação de foco.
- [`Fluxo de criação de personagem RPG - standalone.html`](./Fluxo%20de%20cria%C3%A7%C3%A3o%20de%20personagem%20RPG%20-%20standalone.html) — telas **2a/2** (com personagem) e "Ver todos os personagens", onde a ação vive.
