# US-170 — Locais gerados entram no ledger e chegam ao Mestre

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** ✅ Concluída
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

**Achado adicional (revisão desta US):** `mergeEntities` ([entities.ts:54-64](../../../packages/ai-engine/src/entities.ts)) casa entidade por `norm(nome)` — lowercase + sem acento — SEM considerar `tipo`. Hoje `npcEntities` usa `nome: npc.name` e `secretEntities` usa `nome: secret.id` (slug, nunca colide com nome humano); esta US introduz `locationEntities` com `nome: location.title` NO MESMO namespace de nome que NPC. Nada no `adventure-gate.ts` ([adventure-gate.ts:56-90](../../../apps/api/src/adventure-generation/adventure-gate.ts)) garante `title` de local ≠ `name` de NPC — o gate só confere `id`/`locationId` resolverem, não texto. Se colidir (ex.: local "O Bruxo" e NPC "O Bruxo" — comum em aventura onde o local É nomeado pelo ocupante), o primeiro `recordEntity` que casar por esse nome funde as duas entidades numa linha só, silenciosamente. Esta US amplia o escopo pra fechar isso: ver bullet de `mergeEntities` abaixo.

---

## Escopo

### Dentro do escopo

- `seedLedgerFromGeneratedAdventure` (`seed-ledger.ts`) ganha `locationEntities`, terceiro array concatenado no retorno junto de `secretEntities`/`npcEntities`.
- `nota` do `WorldEntity` de local: `boxedText` como frase de abertura + `aspects.join(', ')` como detalhes de apoio (formato exato a decidir na implementação — ver Notas).
- `revelado: false` por padrão para TODO local, sem exceção — nenhum é "conhecido" antes do personagem chegar lá na fábula (resolvido na Questão #1: schema não marca local inicial hoje).
- `WorldEntity` de local NÃO seta seu próprio campo `local` — fica `undefined`. Contrato do tipo ([character.ts:52-53](../../../packages/shared/src/types/character.ts)): "Onde a entidade está agora (para NPC/objeto móvel). Local em si não tem `local`." Mesmo padrão do NPC sem `occupants` (`orfao?.local` undefined, [seed-ledger.test.ts:73](../../../apps/api/src/adventure-generation/seed-ledger.test.ts)) — risco era copiar o padrão de `npcEntities` (que seta `local`) por hábito.
- Teste de regressão em `seed-ledger.test.ts`: confirma que `locations[]` gera `WorldEntity[]` de `tipo: 'local'`, um por local, com `nota` não vazio. **Isso EDITA o assert existente** `toHaveLength(5)` ([seed-ledger.test.ts:37-41](../../../apps/api/src/adventure-generation/seed-ledger.test.ts)) — a fixture já tem 2 `locations`, então o total sobe de 5 pra 7; não é só teste novo adicionado ao lado.
- Eval/teste de regressão: cenário onde o personagem entra num local gerado e a narração do Mestre reflete `boxedText`/`aspects` daquele local (não uma descrição genérica inventada).
- `mergeEntities` (`packages/ai-engine/src/entities.ts`) passa a casar por `(tipo, nome)` quando o patch trouxer `tipo`; patch SEM `tipo` (atualização parcial comum, ex. `{ nome: 'Marta', estado: 'ferida' }`) continua casando só por nome — preserva o contrato "campos omitidos preservam" pros ~20 patches de teste existentes que não enviam `tipo`. Só desambigua quando o modelo informa o tipo, o que já é esperado "no momento que introduz" a entidade (descrição da tool, `ai.service.ts:814`).
- Teste de regressão em `entities.test.ts`: duas entidades com mesmo `nome` normalizado e `tipo` diferente (`npc` vs `local`) — patch com `tipo` atualiza só a entidade certa; sem `tipo`, comportamento antigo (primeira colisão por nome) documentado, não corrigido (ambiguidade real quando o próprio modelo não diz qual quer).

### Fora do escopo

- Mudar `WorldEntity`/`recordEntity`/o schema do ledger — `tipo: 'local'` já existe, nenhuma mudança de schema.
- Mudar `GeneratedAdventureSchema.locations` ou o motor que gera `boxedText`/`description`/`aspects` (US-158) — o texto já está bom, só não circula.
- Revelar automaticamente o local de abertura (`revelado: true` só para o local onde a aventura começa) — `GeneratedAdventure` não tem campo "local inicial" explícito (`start` é prosa livre do gancho, `encounters[0].locationId` é local de COMBATE, não necessariamente de abertura); decidido na Questão #1 que não vale schema novo pra isso agora.
- `occupants[]` — já é redundante com o `local:` que `npcEntities` já preenche via `findOccupiedLocationTitle` (US-151); nada muda aí.
- `description` vs `boxedText` como campos SEPARADOS no ledger (`WorldEntity.nota` é um campo só) — resolvido nesta story combinando os dois num texto único; se no futuro o Mestre precisar dos dois separados, é story nova.

---

## Critérios de aceite

- [x] `seedLedgerFromGeneratedAdventure` emite um `WorldEntity` de `tipo: 'local'` por item de `adventure.locations`.
- [x] `nota` do local carrega `boxedText` + `aspects` (formato definido na implementação, não vazio).
- [x] `revelado: false` por padrão em todo local semeado.
- [x] Teste de regressão em `seed-ledger.test.ts` cobre a nova entrada.
- [x] **Eval:** narração do Mestre ao entrar num local gerado usa o `boxedText`/`aspects` daquele local especificamente (não descrição genérica). Caso estático `evals/cases/us-170-eval-local-no-ledger.ts`, mesmo padrão sem chamada de modelo do caso US-154 (harness de N turnos reais fica com a US-94, em backlog).
- [x] `pnpm eval` passa (mudança no ledger muda o que o Mestre vê no prompt todo turno).
- [x] `mergeEntities` casa por `(tipo, nome)` quando o patch traz `tipo`; sem `tipo` no patch, casa só por nome (comportamento preservado).
- [x] Teste de regressão em `entities.test.ts` cobre colisão de nome entre `tipo` diferentes (NPC vs local).

---

## Notas de implementação

- Formato de `nota` sugerido: `` `${location.boxedText}` `` como frase principal, aspectos como lista curta anexada — mas é decisão de implementação, não de aceite; o critério é só "não vazio, contém o texto gerado".
- `findOccupiedLocationTitle` (US-151) já faz o reverse-lookup `locations[].occupants[]` → nome pra NPCs; a função nova de locais não precisa dessa lógica, é mapeamento direto `locations.map(...)`.
- Arquivo principal: [seed-ledger.ts](../../../apps/api/src/adventure-generation/seed-ledger.ts).
- Segundo arquivo (achado nesta revisão, fix de colisão): [entities.ts](../../../packages/ai-engine/src/entities.ts) — `mergeEntities`, linha 64 (`findIndex`) ganha condição de `tipo`. Não muda `WorldEntity`/schema, só a chave de busca dentro da função.
- Descrição da tool `recordEntity` ([ai.service.ts:814](../../../apps/api/src/ai/ai.service.ts)) já diz "Matching is by `nome`" — considerar (não obrigatório pro critério de aceite) acrescentar uma frase avisando o modelo que `tipo` desambigua quando dois nomes colidem, já que é ele quem decide se manda `tipo` no patch.
- Sem mudança em `ai.service.ts`/`dm-system.ts` — o ledger já é lido e renderizado por turno ([ai.service.ts:533](../../../apps/api/src/ai/ai.service.ts), `entitiesSection` em [dm-system.ts:573](../../../packages/ai-engine/src/prompts/dm-system.ts)); esta story só alimenta a fonte.
- Mudança indireta em prompt do DM Agent (mais entidades no ledger todo turno) — rodar `pnpm eval` depois (AGENTS.md).

---

## Questões em aberto

1. ~~O local onde a aventura COMEÇA deveria nascer `revelado: true`?~~ **Resolvido:** não. Confirmado no schema ([adventure-generation.ts:49-61](../../../packages/shared/src/types/adventure-generation.ts)) que `GeneratedAdventure` não marca local inicial — `start` é prosa livre do gancho de abertura (sem `locationId`, ver [adventure.service.test.ts:851](../../../apps/api/src/adventure/adventure.service.test.ts)), e `encounters[0].locationId` é o local do ENCONTRO de combate, não necessariamente onde a cena abre. Sem sinal confiável de qual `locations[]` é o inicial, todos nascem `revelado: false` — o Mestre revela o local via `recordEntity` normalmente na abertura, mesmo comportamento hoje já existente para outras entidades (US-151). Não abre story nova pra "local inicial" explícito no schema: seria mudança especulativa sem consumidor definido: enquanto ninguém propõe COMO essa marcação seria preenchida na geração (US-158) nem que dor concreta ela resolve além dessa story, abrir schema novo é complexidade sem sinal real de necessidade.
2. ~~Local com 0 `occupants` mas presente em `encounters[]`~~ **Resolvido:** funciona sem ajuste. Confirmado em `seed-ledger.ts` ([seed-ledger.ts:13-38](../../../apps/api/src/adventure-generation/seed-ledger.ts)) que a função nova é `adventure.locations.map(...)` direto — não passa por `occupants` nem `encounters`, ao contrário de `findOccupiedLocationTitle` (linha 43-45, usado só por `npcEntities`). Local de combate sem NPC narrativo recebe `WorldEntity` de `tipo: 'local'` normalmente.
3. **Risco monitorado (não bloqueia implementação):** local nasce `revelado: false` e é renderizado com `⚠ OCULTO` igual segredo — mas a regra do prompt ([dm-system.ts:600](../../../packages/ai-engine/src/prompts/dm-system.ts)) diz *"NEVER reveal it... until the fiction makes the character discover it"* pensada pro caso de segredo (descoberta por investigação). Local é descoberto só de o personagem CHEGAR lá — a regra não nomeia "chegar num lugar" como gatilho de descoberta explicitamente, é inferência por analogia. Se o Mestre tratar o local como oculto demais e não narrar `boxedText`/`aspects` na chegada (ou não chamar `recordEntity` com `revelado: true` no mesmo turno), o critério de aceite eval falha — não por falta de dado no ledger, mas por leitura conservadora demais da regra OCULTO. Não resolvido por leitura de código (é comportamento de modelo); é exatamente o que o critério eval "narração usa `boxedText`/`aspects` na chegada" (linha 65) existe pra pegar. Se falhar no `pnpm eval`, o ajuste é na REDAÇÃO da regra OCULTO (dm-system.ts:600), não no `seed-ledger.ts`.
4. ~~Colisão de nome entre local e NPC no merge do ledger~~ **Resolvido, dentro do escopo desta US** (decisão explícita, não empurrado pra story separada): `mergeEntities` casa por nome só, sem `tipo` — ver achado em "A proposta" acima e bullets de escopo/critérios/notas. Amplia o arquivo tocado por esta US de `seed-ledger.ts` pra também `entities.ts` (`packages/ai-engine`), fora do que "Notas de implementação" original apontava — decisão tomada porque o bug É gerado por esta US (novo namespace de nome), não preexistente isolado.

---

## Referências no código

- [packages/shared/src/types/adventure-generation.ts:27-34](../../../packages/shared/src/types/adventure-generation.ts) — `AdventureLocationSchema`, campos que ficam órfãos hoje.
- [apps/api/src/adventure-generation/seed-ledger.ts:13-39](../../../apps/api/src/adventure-generation/seed-ledger.ts) — `seedLedgerFromGeneratedAdventure`, função a estender.
- [apps/api/src/ai/ai.service.ts:746](../../../apps/api/src/ai/ai.service.ts) — `recordEntity`, prova que `tipo: 'local'` já é um valor válido do enum.
- [packages/ai-engine/src/prompts/dm-system.ts:573](../../../packages/ai-engine/src/prompts/dm-system.ts) — `entitiesSection`, já renderiza qualquer `WorldEntity` do ledger, sem mudança necessária.
- [docs/sdlc/01-requisitos/US-168-abertura-narra-gancho-fixo-nao-aventura-gerada.md](./US-168-abertura-narra-gancho-fixo-nao-aventura-gerada.md) — aponta o gap original, delega pra story própria (esta).
