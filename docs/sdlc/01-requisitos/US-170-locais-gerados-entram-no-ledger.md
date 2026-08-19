# US-170 — Locais gerados entram no ledger e chegam ao Mestre

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** nenhuma
**Relacionado:** [US-151](./US-151-semear-ledger-segredos-gerados.md) (dona de `seedLedgerFromGeneratedAdventure` — já implementada, ✅, mas só emite `npc`/`outro`; esta story fecha o `tipo: 'local'` que faltou) · [US-168](./US-168-abertura-narra-gancho-fixo-nao-aventura-gerada.md) (aponta o gap explicitamente como fora do seu escopo: *"`seedLedgerFromGeneratedAdventure` não emite `WorldEntity` de tipo `'local'` para `adventure.locations` (só NPCs e segredos) — gap real, mas de outra story"*)
**Criada em:** 2026-08-18 — achado ao mapear, campo a campo, o que de `GeneratedAdventure` chega ao Mestre em runtime: `locations[].title` sobrevive só como o campo `local` (string) de um NPC/segredo; `boxedText`/`description`/`aspects` — a prosa do LOCAL em si — nunca é lida por ninguém depois de gerada.

---

## História

> **Como** jogador explorando uma aventura gerada,
> **quero** que o Mestre narre os locais com a atmosfera e os detalhes que o motor de geração escreveu para eles,
> **para que** a cena que eu vejo bata com o que foi de fato gerado, em vez do Mestre improvisar um local genérico porque não tem acesso à prosa pronta.

---

## Contexto e motivação

### O que existe hoje

`GeneratedAdventureSchema.locations[]` ([adventure-generation.ts:27-34](../../../packages/shared/src/types/adventure-generation.ts)) tem `title`, `aspects[]`, `boxedText`, `description`, `occupants[]` — texto escrito especificamente pra aquele local (US-158, motor gera locais+NPCs em prosa). `seedLedgerFromGeneratedAdventure` ([seed-ledger.ts:13-39](../../../apps/api/src/adventure-generation/seed-ledger.ts)) usa `adventure.locations` só pra resolver NOME (`locationTitleById`, linha 15) — o `title` vira o campo `local` (string solta) de um `WorldEntity` de NPC ou segredo. Nenhum `WorldEntity` de `tipo: 'local'` é emitido. `aspects`/`boxedText`/`description` nunca são lidos fora do teste (`seed-ledger.test.ts`) e do gate (`adventure-gate.ts`, que só confere `id`/`locationId` fecham, não lê o texto).

`WorldEntity` (o formato do ledger, `## Entidades` no turn state) já suporta `tipo: 'local'` nativamente — é uma das 5 opções do enum que `recordEntity` já aceita (`npc/local/objeto/faccao/outro`, [ai.service.ts:746](../../../apps/api/src/ai/ai.service.ts)). Não precisa de tipo novo, schema novo, nem bloco novo no prompt — só falta a FUNÇÃO ALIMENTAR essa entrada.

### O problema

O Mestre recebe o NOME do local (via `local:` de outro entity) mas nunca a DESCRIÇÃO — ele inventa a cena do zero toda vez que o personagem chega lá, mesmo o motor já tendo escrito `boxedText` (o texto de entrada, "leia isto quando o grupo chegar") e `description`/`aspects` (detalhes pra sustentar a cena depois). Duplo desperdício: o motor gasta uma chamada de IA pra escrever isso (US-158) e o resultado nunca é usado.

### A proposta

`seedLedgerFromGeneratedAdventure` ganha um terceiro mapa: `adventure.locations.map(...)` → `WorldEntity` com `tipo: 'local'`, `nome: location.title`, `nota` combinando `boxedText`+`aspects` (o que o Mestre precisa pra narrar a chegada e sustentar a cena), `revelado: false` por padrão (local ainda não visitado — mesma disciplina de `⚠ OCULTO` que já existe pros segredos, o Mestre só narra quando o personagem chega lá).

---

## Escopo

### Dentro do escopo

- `seedLedgerFromGeneratedAdventure` (`seed-ledger.ts`) ganha `locationEntities`, terceiro array concatenado no retorno junto de `secretEntities`/`npcEntities`.
- `nota` do `WorldEntity` de local: `boxedText` como frase de abertura + `aspects.join(', ')` como detalhes de apoio (formato exato a decidir na implementação — ver Notas).
- `revelado: false` por padrão para TODO local — nenhum é "conhecido" antes do personagem chegar lá na fábula. Exceção: ver Questão em aberto #1.
- Teste de regressão em `seed-ledger.test.ts`: confirma que `locations[]` gera `WorldEntity[]` de `tipo: 'local'`, um por local, com `nota` não vazio.
- Eval/teste de regressão: cenário onde o personagem entra num local gerado e a narração do Mestre reflete `boxedText`/`aspects` daquele local (não uma descrição genérica inventada).

### Fora do escopo

- Mudar `WorldEntity`/`recordEntity`/o schema do ledger — `tipo: 'local'` já existe, nenhuma mudança de schema.
- Mudar `GeneratedAdventureSchema.locations` ou o motor que gera `boxedText`/`description`/`aspects` (US-158) — o texto já está bom, só não circula.
- Revelar automaticamente o local de abertura (`revelado: true` só para o local onde a aventura começa) — `GeneratedAdventure` não tem hoje um campo "local inicial" explícito; decidir isso é a Questão em aberto #1.
- `occupants[]` — já é redundante com o `local:` que `npcEntities` já preenche via `findOccupiedLocationTitle` (US-151); nada muda aí.
- `description` vs `boxedText` como campos SEPARADOS no ledger (`WorldEntity.nota` é um campo só) — resolvido nesta story combinando os dois num texto único; se no futuro o Mestre precisar dos dois separados, é story nova.

---

## Critérios de aceite

- [ ] `seedLedgerFromGeneratedAdventure` emite um `WorldEntity` de `tipo: 'local'` por item de `adventure.locations`.
- [ ] `nota` do local carrega `boxedText` + `aspects` (formato definido na implementação, não vazio).
- [ ] `revelado: false` por padrão em todo local semeado.
- [ ] Teste de regressão em `seed-ledger.test.ts` cobre a nova entrada.
- [ ] **Eval:** narração do Mestre ao entrar num local gerado usa o `boxedText`/`aspects` daquele local especificamente (não descrição genérica).
- [ ] `pnpm eval` passa (mudança no ledger muda o que o Mestre vê no prompt todo turno).

---

## Notas de implementação

- Formato de `nota` sugerido: `` `${location.boxedText}` `` como frase principal, aspectos como lista curta anexada — mas é decisão de implementação, não de aceite; o critério é só "não vazio, contém o texto gerado".
- `findOccupiedLocationTitle` (US-151) já faz o reverse-lookup `locations[].occupants[]` → nome pra NPCs; a função nova de locais não precisa dessa lógica, é mapeamento direto `locations.map(...)`.
- Arquivo principal: [seed-ledger.ts](../../../apps/api/src/adventure-generation/seed-ledger.ts).
- Sem mudança em `ai.service.ts`/`dm-system.ts` — o ledger já é lido e renderizado por turno ([ai.service.ts:533](../../../apps/api/src/ai/ai.service.ts), `entitiesSection` em [dm-system.ts:573](../../../packages/ai-engine/src/prompts/dm-system.ts)); esta story só alimenta a fonte.
- Mudança indireta em prompt do DM Agent (mais entidades no ledger todo turno) — rodar `pnpm eval` depois (AGENTS.md).

---

## Questões em aberto

1. O local onde a aventura COMEÇA deveria nascer `revelado: true` (o personagem já está lá na abertura)? Hoje `GeneratedAdventure` não marca qual `locations[]` é o inicial — `encounters[0].locationId` aponta um local, mas é o local do ENCONTRO de combate, não necessariamente onde a cena abre. Se ninguém souber qual é o local inicial, todos nascem `false` e o Mestre revela o primeiro via `recordEntity` normalmente na abertura (comportamento hoje já existente para outras entidades) — resolver como parte da implementação ou abrir story própria pra "local inicial" explícito no schema.
2. Local com 0 `occupants` mas presente em `encounters[]` (local de combate sem NPC narrativo) — o `WorldEntity` de local ainda é útil (dá cenário pro encontro), sem dependência de NPC associado. Confirmar que isso já funciona sem ajuste (parece que sim, é mapeamento independente).

---

## Referências no código

- [packages/shared/src/types/adventure-generation.ts:27-34](../../../packages/shared/src/types/adventure-generation.ts) — `AdventureLocationSchema`, campos que ficam órfãos hoje.
- [apps/api/src/adventure-generation/seed-ledger.ts:13-39](../../../apps/api/src/adventure-generation/seed-ledger.ts) — `seedLedgerFromGeneratedAdventure`, função a estender.
- [apps/api/src/ai/ai.service.ts:746](../../../apps/api/src/ai/ai.service.ts) — `recordEntity`, prova que `tipo: 'local'` já é um valor válido do enum.
- [packages/ai-engine/src/prompts/dm-system.ts:573](../../../packages/ai-engine/src/prompts/dm-system.ts) — `entitiesSection`, já renderiza qualquer `WorldEntity` do ledger, sem mudança necessária.
- [docs/sdlc/01-requisitos/US-168-abertura-narra-gancho-fixo-nao-aventura-gerada.md](./US-168-abertura-narra-gancho-fixo-nao-aventura-gerada.md) — aponta o gap original, delega pra story própria (esta).
