# US-248 — `followUps` da aventura anterior somem quando a próxima aventura do personagem é gerada

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** nenhuma — `followUps` já é gerado e gravado; `order` (Nª aventura do personagem) já existe. É questão de LER o artefato anterior na hora de gerar o próximo, não peça nova de schema.
**Relacionado:** [US-232](./US-232-schema-cresce-e-prompt-de-autoria-call-unico.md) (introduziu `followUps`, "um gancho pós-aventura por rumo do fecho") · [US-241](./US-241-summary-formula-lgmrd-macguffin.md) (a semente atual da autoria — `questSeed`, por comparação, é sorteio puro, sem relação com aventuras anteriores) · [US-153](./US-153-aventura-deixa-de-ser-derivada-da-classe.md)/[US-239](./US-239-motor-em-createforcharacter-ledger-e-aposenta-gancho.md) (aventura deixou de derivar da classe; esta story é sobre ela também deixar de ignorar a aventura anterior do mesmo personagem)
**Criada em:** 2026-09-16 — achado ao mapear quais campos de `GeneratedAdventure` o DM Agent lê em jogo (ver conversa que originou esta story).

---

## História

> **Como** jogadora que termina uma aventura e começa outra com o mesmo personagem,
> **quero** que a aventura seguinte tenha alguma chance de puxar o fio que a anterior deixou pendurado (`followUps`),
> **para que** minha campanha pareça uma continuação, não uma sequência de one-shots sem memória de que houve uma aventura antes.

---

## Contexto e motivação

### O problema observado

O produto já suporta múltiplas aventuras sequenciais por personagem: `order` é calculado como `(count de AdventureParticipant do personagem) + 1` ([adventure.service.ts:439](../../../apps/api/src/adventure/adventure.service.ts)), e `rollQuestSeed(characterId, order, attempt)` ([adventure.service.ts:191](../../../apps/api/src/adventure/adventure.service.ts)) já varia a semente da autoria por `order` — ou seja, o código já sabe distinguir "esta é a 2ª aventura deste personagem" da 1ª.

Ao mesmo tempo, `AUTHORING_SCHEMA.followUps` ([ai.service.ts:171](../../../apps/api/src/ai/ai.service.ts)) pede à autoria "um gancho pós-aventura por rumo do fecho" — exatamente o gancho que deveria alimentar a PRÓXIMA aventura. No artefato de referência usado para mapear este comportamento, os 4 `followUps` eram ganchos completos e específicos (ex.: *"Torleik, agora rei, envia um corvo desesperado: os jarls rivais se aliaram a algo que veio das montanhas..."*) — prontos pra virar o `questSeed` de uma aventura 2.

Hoje, `followUps` é gravado em `GeneratedAdventure.followUps` ([adventure.service.ts:349](../../../apps/api/src/adventure/adventure.service.ts)) e depois disso só é: sanitizado (`adventure-gate.ts`), validado pelo gate (contagem == `factionCount`) e exportado pro dump humano (`adventure-export.ts`). Quando a jogadora gera a aventura 2 do mesmo personagem, `rollQuestSeed(characterId, order=2, attempt)` sorteia uma semente nova, sem NENHUMA leitura da aventura 1 — nem do artefato completo, nem de `followUps` especificamente.

### Por que a solução atual não basta

`rollQuestSeed` é determinístico por `characterId`+`order`, então a variação entre aventura 1 e aventura 2 do mesmo personagem já existe hoje — mas é variação ALEATÓRIA, não CAUSAL. A jogadora que terminou "silenciar o Hjartasteinn e libertar a Voz Celeste" (um dos 4 rumos possíveis no exemplo) pode começar a aventura 2 numa premissa que não tem relação nenhuma com esse fecho, mesmo a autoria já tendo escrito, na aventura 1, exatamente o gancho que deveria vir a seguir.

### A restrição a respeitar: o Mestre não sabe qual rumo aconteceu

`completeQuest` ([ai.service.ts:990-1027](../../../apps/api/src/ai/ai.service.ts)) grava só `outcome: 'success'|'failure'` + `reason` livre — **deliberadamente** não captura qual entrada de `branchedResolution` a jogadora escolheu (comentário em `ai.service.ts:986-989`: "o Mestre escreve o fecho a partir da própria ficção do turno", não de um rumo pré-mapeado). `followUps[i]` é pareado por índice com `branchedResolution[i]` (o prompt de autoria pede exatamente `factionCount` de cada, um por rumo — `ai.service.ts:272`), mas **não existe hoje nenhum dado que diga qual índice aconteceu**. Resolver isso exigiria reabrir aquela decisão (US-232), o que esta story não propõe.

### A proposta

Em vez de tentar rastrear QUAL rumo aconteceu (o que reabriria a decisão acima), a aventura seguinte do mesmo personagem passa a receber o CONJUNTO de `followUps` da aventura anterior como inspiração livre na autoria (CHAMADA 1) — o modelo escolhe organicamente qual gancho (ou nenhum, ou uma síntese) puxar, com a mesma disciplina de "ficção, não fato mecânico" que já rege o resto do prompt de autoria. Isso dá continuidade sem exigir rastrear o rumo escolhido.

---

## Escopo

### Dentro do escopo

- `generateAdventure`/`generateGatedAdventure` ([adventure.service.ts:179](../../../apps/api/src/adventure/adventure.service.ts)), quando `order > 1`, busca a aventura anterior do mesmo personagem (`AdventureParticipant` + `Adventure`, `order - 1`) e lê seu `generatedAdventure.followUps` (coluna JSON já existente).
- `buildAuthoringPrompt`/`buildAuthoringSystem` ([ai.service.ts:114-276](../../../apps/api/src/ai/ai.service.ts)) ganha um parâmetro opcional (`previousFollowUps?: string[]`) — quando presente, uma seção do prompt de autoria apresenta esses ganchos como PISTAS de continuidade que a nova aventura PODE (não deve obrigatoriamente) puxar, deixando explícito que são só inspiração, não fato obrigatório da nova premissa.
- `order === 1` (primeira aventura do personagem) continua exatamente como hoje — sem `previousFollowUps`, sem mudança de comportamento.
- Teste cobrindo: `order > 1` busca e passa `previousFollowUps` corretamente; `order === 1` não busca nada (sem query desnecessária); aventura anterior sem `generatedAdventure` (ex.: falhou na geração, ou é do caminho Free) não quebra — `previousFollowUps` fica ausente.
- `pnpm eval` roda e passa (mudança em prompt de autoria).

### Fora do escopo

- Rastrear QUAL entrada de `branchedResolution` efetivamente aconteceu — reabriria a decisão deliberada da US-232 (ver acima). Esta story usa o CONJUNTO de `followUps`, não um único gancho "correto".
- Forçar a nova aventura a puxar obrigatoriamente um `followUp` — vira inspiração livre, mesma filosofia de "tábula rasa com tempero leve" que já rege `characterStory`/`deity`/`flaws` na autoria (US-232, "background como TOM").
- Mudar `rollQuestSeed`/o sistema de sementes determinísticas — `previousFollowUps` é um insumo A MAIS no prompt, não substitui a semente existente.
- Aventuras de personagens DIFERENTES influenciando umas às outras — o encadeamento é só `characterId` → sua própria aventura anterior.
- Multiplayer / continuidade entre personagens de uma mesma mesa — fora da fase 1 (ver `backlog-aventuras-autorais-lazygm.md`, adiado pra fase 4).

---

## Critérios de aceite

- [ ] Ao gerar a aventura de `order === 2` (ou maior) de um personagem cuja aventura anterior tem `generatedAdventure.followUps` preenchido, o prompt de autoria enviado ao modelo contém esses `followUps` como pistas de continuidade.
- [ ] Ao gerar a aventura de `order === 1`, nenhuma busca por aventura anterior acontece e o prompt de autoria é idêntico ao de hoje (sem regressão).
- [ ] Aventura anterior sem `generatedAdventure` (nula/ausente) não impede a geração da nova aventura — `previousFollowUps` fica ausente, sem erro.
- [ ] Os `followUps` anteriores aparecem no prompt como PISTAS, não como fato obrigatório — a instrução usa linguagem de "pode", não "deve" (mesmo padrão de `nextEncounterSection`, dm-system.ts:645-650, que já usa esse tom pra sinais opcionais).
- [ ] **Eval / teste de regressão:** personagem com aventura 1 cujo `followUps = ["X invade a capital"]`, ao gerar aventura 2, o prompt de autoria contém "X invade a capital"; sem esta story, o prompt da aventura 2 não menciona nada da aventura 1.
- [ ] `pnpm typecheck`, `pnpm test` e `pnpm eval` passam.

---

## Notas de implementação

> *Dicas. O implementador pode divergir com boa justificativa.*

- Arquivo principal: [apps/api/src/adventure/adventure.service.ts:179-215](../../../apps/api/src/adventure/adventure.service.ts) — `generateAdventure`, ponto onde `order` já está disponível e onde a chamada a `generateAdventureAuthoring` é montada.
- **Busca da aventura anterior:** via `AdventureParticipant` ([schema.prisma:137-146](../../../apps/api/prisma/schema.prisma)) filtrando por `characterId`, ordenando `Adventure.order` decrescente, pegando a de `order` imediatamente anterior — não necessariamente `order - 1` numérico se alguma aventura falhou/foi descartada; usar a última por ordem, não por aritmética.
- **Custo:** 1 query a mais só quando `order > 1` — mesmo padrão de outras leituras condicionais já no arquivo (ex.: `registryOverrides`).
- O prompt de autoria (`buildAuthoringPrompt`, ai.service.ts:266-275) já lista instruções em ordem ("Emita na ordem: mundo → facções → ..."); a seção de `previousFollowUps` deve entrar como CONTEXTO antes dessa lista, não como mais um item a emitir — é insumo de leitura, não campo de saída do schema.
- Cuidado com o mesmo risco que motivou "tábula rasa" na 1ª aventura (US-232, achado do spike 10/09: um `bond` vazando como espinha de plot forçada): `previousFollowUps` deve ser oferecido como PISTA solta, com a mesma ressalva de "pode ignorar" — não repetir o erro de tratar semente de personagem/campanha como obrigação de enredo.

---

## Questões em aberto

1. Quando a aventura anterior terminou em `outcome: 'failure'` (fugiu/desistiu), ainda faz sentido oferecer `followUps` (que foram escritos pressupondo ALGUM rumo de `branchedResolution` ter acontecido, sucesso ou não)? Como `followUps` é pareado com `branchedResolution` que já cobre fracasso como rumo válido (ver exemplo: falha pode ser um dos 4 "choice/consequence"), a proposta atual (oferecer o conjunto todo, sem filtrar por outcome) deveria bastar — mas vale validar em QA manual se o resultado soa estranho quando a aventura anterior foi um fracasso.
2. Se no futuro `completeQuest` passar a capturar qual rumo aconteceu (reabrindo a US-232), esta story deveria migrar de "conjunto todo como inspiração" para "o followUp específico daquele rumo" — registrar como evolução natural, não implementar agora.

---

## Referências no código

- [apps/api/src/ai/ai.service.ts:171](../../../apps/api/src/ai/ai.service.ts) — `AUTHORING_SCHEMA.followUps`.
- [apps/api/src/ai/ai.service.ts:266-275](../../../apps/api/src/ai/ai.service.ts) — `buildAuthoringPrompt`, onde a seção de pistas de continuidade entraria.
- [apps/api/src/adventure/adventure.service.ts:179-215](../../../apps/api/src/adventure/adventure.service.ts) — `generateAdventure`, monta a chamada de autoria.
- [apps/api/src/adventure/adventure.service.ts:349](../../../apps/api/src/adventure/adventure.service.ts) — `followUps: authored.followUps`, gravação sem transformação.
- [apps/api/src/adventure/adventure.service.ts:439](../../../apps/api/src/adventure/adventure.service.ts) — cálculo de `order` a partir da contagem de `AdventureParticipant`.
- [apps/api/src/ai/ai.service.ts:986-989](../../../apps/api/src/ai/ai.service.ts) — comentário que documenta a decisão deliberada de `completeQuest` não capturar qual rumo de `branchedResolution` aconteceu.
- [apps/api/prisma/schema.prisma:106-146](../../../apps/api/prisma/schema.prisma) — `Adventure`, `AdventureParticipant`, relação usada para achar a aventura anterior.
- [apps/api/src/adventure-generation/adventure-gate.ts](../../../apps/api/src/adventure-generation/adventure-gate.ts) — validação de `followUps.length === factionCount`, inalterada por esta story.
