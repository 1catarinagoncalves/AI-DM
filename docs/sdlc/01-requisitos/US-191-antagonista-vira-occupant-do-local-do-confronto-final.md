# US-191 — Antagonista vira occupant do local do confronto final

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada (2026-08-23)
**Depende de:** [US-188](./US-188-antagonista-vira-npc-rastreavel.md) ✅ implementada — `antagonistNpc: AdventureNpc` já existe ([adventure.service.ts:262-267](../../../apps/api/src/adventure/adventure.service.ts)), parte 1 desta story só falta adicionar esse `id` a `occupants[]` · [US-190](./US-190-antagonista-vira-passo-proprio-entre-segredos-e-encontros.md) ✅ implementada — `generateAntagonist`/`antagonist` já roda antes do `Promise.all`
**Relacionado:** [US-158](./US-158-locais-npcs-prosa-motor.md) (`AdventureLocationSchema.occupants`, mesmo padrão reusado na parte 1) · [US-166](./US-166-motor-gera-multiplos-encontros.md) (posição 8, confronto final — o local cuja prosa/`occupants` esta story completa) · [US-153 #4](./US-153-aventura-deixa-de-ser-derivada-da-classe.md) (disciplina "não vaza antes de merecer" — a parte 2 desta story MUDA como essa disciplina se aplica ao NOME do antagonista, ver *Contexto*)
**Criada em:** 2026-08-22 — US-188, Questão em aberto #2, decidida pela mantenedora: vale o antagonista aparecer em `locations[].occupants` do local do confronto final, mesmo padrão que NPCs sociais já usam (US-158). Escopo ampliado no mesmo dia: a mantenedora decidiu também resolver aqui a prosa de `generateOpeningBeat`/`generateLocationsAndNpcs` referenciar o antagonista por NOME dentro do local — não só a referência estrutural.

---

## História

> **Como** jogadora,
> **quero** que o local onde enfrento o antagonista já o liste como `occupant` E que a prosa (abertura e descrição do local) possa nomeá-lo,
> **para que** o vilão tenha presença reconhecível antes do confronto — não só um `id` solto em `npcIds`, mas alguém que a mesa já ouviu nomear.

---

## Contexto e motivação

### O que existe hoje (US-188/US-190 ✅ implementadas)

- `AdventureLocationSchema.occupants` ([adventure-generation.ts:33](../../../packages/shared/src/types/adventure-generation.ts)) é `string[]` — ids de NPC preenchidos por `generateLocationsAndNpcs` (US-158), que roda no **passo 2** do pipeline ([adventure.service.ts:204-209](../../../apps/api/src/adventure/adventure.service.ts)), antes de `generateAntagonist` (US-190, [adventure.service.ts:244-254](../../../apps/api/src/adventure/adventure.service.ts)) rodar. Mesma barreira de ordem que a US-188 já resolveu pra `npcIds` (`antagonistNpc.id` entra em `finalDraft.npcs` → `npcIds` na montagem de `encounters`, [adventure.service.ts:262-271,306](../../../apps/api/src/adventure/adventure.service.ts)) — mas o patch da US-188 nunca tocou `occupants`, que continua com o valor original de `generateLocationsAndNpcs`, sem o antagonista.
- `antagonistNpc` e `finalDraft.location` (o local do confronto final) já estão os dois em mãos, sincronamente, logo depois da criação de `antagonistNpc` ([adventure.service.ts:269-271](../../../apps/api/src/adventure/adventure.service.ts)) — ANTES do `Promise.all` que hoje só tem `generateClosing`/`generateOpeningBeat` ([adventure.service.ts:277-301](../../../apps/api/src/adventure/adventure.service.ts)). Ou seja: o patch de `occupants` (Parte 1) não precisa esperar `generateAntagonistLocationProse` (Parte 2, chamada nova) — pode entrar logo ali, junto do resto do bloco US-188.
- `generateOpeningBeat` (`ai.service.ts:1744-1787`) JÁ recebe `antagonist` como parâmetro (US-190) e JÁ pode insinuar `method`/`trait` na cena — mas `buildOpeningBeatPrompt` ([ai.service.ts:275-290](../../../apps/api/src/ai/ai.service.ts)) monta `antagonistLine` deliberadamente SEM `antagonist.name` (comentário na linha 287-289: *"nome e weakness NÃO entram aqui... a abertura não ter como citá-lo nem por acidente"*), e o `system` prompt (linha 1778) instrui explicitamente **"NUNCA o nomeie"**. Essa regra foi decidida na US-190, Questão em aberto #2 (*"Decidido: sempre insinuar... mesma disciplina de dosagem que já protege `conclusion`/`weakness`"*).

### O problema

Duas lacunas distintas, ambas sobre o antagonista não ter NOME reconhecível antes do confronto:

1. **`occupants` é estrutural, não prosa.** Mesmo com `antagonistNpc.id` em `occupants[]` (parte 1 desta story), nenhum texto lido pela jogadora muda — `occupants` é consumido por lógica (ledger, US-189; futuros consumidores), não por narração.
2. **`generateOpeningBeat` está proibido de nomear o antagonista.** A regra "nunca nomeie" (US-190) foi decisão deliberada de anti-spoiler, mas o produto agora quer o oposto: o vilão ter nome reconhecível cedo, não só method/trait insinuados sem identidade.
3. **`generateLocationsAndNpcs` nunca teve a opção de nomear o antagonista na prosa do local** (`boxedText`/`description`) — não por proibição, mas porque roda no passo 2, antes de `antagonist` existir. Sem o dado, não há o que nomear.

### A proposta (duas partes)

**Parte 1 — `occupants` estrutural** (já detalhada na versão anterior desta story): depois que US-188 minta `antagonistNpc`, adiciona `antagonistNpc.id` a `occupants[]` do local do encontro final. Sem mudança de schema, sem chamada de modelo nova.

**Parte 2 — prosa nomeando o antagonista** (escopo novo):

- **`generateOpeningBeat`:** reverte a proibição da US-190. `buildOpeningBeatPrompt` passa a incluir `antagonist.name` em `antagonistLine`; o `system` prompt troca *"NUNCA o nomeie"* por instrução que PERMITE nomear (mantendo a proibição de revelar `weakness` — essa parte da disciplina anti-spoiler continua). Esta story documenta e implementa a reversão; não precisa de story própria porque é a MESMA função/prompt, só a regra dentro dela muda.
- **`generateLocationsAndNpcs` (local do confronto final):** como o passo 2 roda antes do antagonista existir, não dá pra regenerar a chamada original. Em vez disso, uma chamada de modelo NOVA e pontual — `generateAntagonistLocationProse` (nome provisório) — roda em paralelo ao `Promise.all` existente (`generateClosing`/`generateOpeningBeat`), recebendo o `AdventureLocation` do encontro final (já conhecido antes do antagonista, via `drafts[drafts.length - 1].location`) e `antagonist` prontos, e devolve `boxedText`/`description` REESCRITOS pra esse local — mesmos dois campos, agora citando o antagonista pelo nome. `title`/`aspects`/`occupants` do local não mudam por essa chamada (occupants é a Parte 1, patch separado).

---

## Escopo

### Dentro do escopo

**Parte 1 — `occupants` estrutural:**
- `generateAdventure`: `.map` sobre `locations[]` injeta `antagonistNpc.id` em `occupants` do local com `id === draft.location.id` (último elemento de `drafts`), guardado por `!occupants.includes(antagonistNpc.id)`.
- Teste de regressão: `occupants` do local do encontro final contém `antagonistNpc.id`; nenhum outro local ganha.

**Parte 2 — prosa nomeando:**
- `buildOpeningBeatPrompt`/`generateOpeningBeat` (`ai.service.ts`): `antagonistLine` passa a incluir `antagonist.name`; `system` prompt reverte *"NUNCA o nomeie"* pra instrução que permite nome (weakness continua proibida — só a proibição de NOME é revertida).
- `generateAntagonistLocationProse` (NOVA função, `ai.service.ts`, molde de `generateOpeningBeat`): recebe `location: AdventureLocation` (o do encontro final), `antagonist: AdventureAntagonist`, `registry`, `locale?`. Devolve `{ boxedText: string; description: string }` — reescrita dos dois campos do local, citando `antagonist.name` em pelo menos um deles.
- `generateAdventure`: chama `generateAntagonistLocationProse` dentro do `Promise.all` existente (3ª entrada, ao lado de `generateClosing`/`generateOpeningBeat` — nenhuma depende da outra, todas só precisam de `antagonist` já pronto) e, depois que resolve, faz `.map` sobre `locations[]` substituindo `boxedText`/`description` do local do encontro final pelos novos valores.
- Teste de regressão: fixture com `generateAntagonistLocationProse` mockado → `boxedText`/`description` do local do encontro final mudam pro valor mockado; outros locais não mudam. Fixture de `generateOpeningBeat` → prompt/`antagonistLine` inclui `antagonist.name`.
- **Teste de regressão — patch combinado:** UM único teste de `generateAdventure` (não dois separados) verifica, no MESMO local do encontro final, que `occupants` (Parte 1) E `boxedText`/`description` (Parte 2) mudaram simultaneamente. Dois testes independentes não pegariam um "last-write-wins" — se alguém implementar os dois `.map` a partir do `locations` original em vez de encadear (segundo `.map` em cima do resultado do primeiro), um patch apaga o outro sem que nenhum teste isolado note.
- **Teste de regressão — contradição de prompt:** verifica que nem `antagonistLine` nem o `system` de `generateOpeningBeat` contêm mais a frase de proibir o nome — falha se só um dos dois foi atualizado.
- **Teste de regressão — weakness não vaza:** fixture com `antagonist.weakness` preenchido → `boxedText`/`description` de `generateAntagonistLocationProse` não contêm a string de `weakness`. Reforça o `Pick<>` do tipo com verificação em runtime (o tipo impede escrever o código errado; o teste impede o modelo de "inventar" a weakness por conta própria no texto gerado).
- Nota no backlog/US-190 registrando que a proibição de nomear na abertura (Questão em aberto #2 daquela story) foi revertida por esta story.
- **`seedLedgerFromGeneratedAdventure` (US-189, `seed-ledger.ts`) ganha uma segunda `WorldEntity` pro antagonista** (Questão em aberto #1, decidida): a `antagonistEntity` existente perde `local`/`nota` de want/method/trait/weakness/connection do jeito atual e vira DUAS entradas — `antagonistPublicEntity` (`nome: antagonist.name`, `local` igual ao que já é hoje, `revelado: true`) e `antagonistHiddenEntity` (`nome: antagonist.name` também — `WorldEntity.nome` é `string` obrigatório, [character.ts:50](../../../packages/shared/src/types/character.ts:50), não dá pra omitir sem mudar schema, e mudar schema é fora de escopo — `nota` com `want`/`method`/`trait`/`weakness`/`connection`, `revelado: false`). Função devolve as duas no array final, no lugar da única de hoje.
- **Correção (2026-08-23):** a redação original desta parte previa `antagonistHiddenEntity` SEM `nome`, "pra não duplicar o que já é público" — inviável, `WorldEntity.nome` é obrigatório. Repetir `antagonist.name` nas duas entradas é o comportamento certo, não só o contorno do bloqueio de schema: o NOME nunca foi o segredo que esta story protege — Parte 2 explicitamente o torna nomeável desde a abertura. O que fica atrás de `revelado: false` é só `nota` (`want`/`method`/`weakness`/`connection`). Duplicar o nome não vaza nada que a Parte 2 já não tenha liberado.
- Teste de regressão em `seed-ledger.test.ts`: ledger final tem DUAS entradas do antagonista, mesmo `nome` nas duas — uma com `revelado: true` e sem `nota` (ou `nota` vazia/ausente), outra com `revelado: false` e `nota` com want/method/trait/weakness/connection.

### Fora do escopo

- **Antagonista ocupar mais de um local.** Só o local do confronto final ganha `occupants`/prosa reescrita — reaparições em locais anteriores é escopo já excluído por US-188.
- **Mudar o formato de `occupants` ou de `AdventureLocationSchema`.** `occupants` continua `string[]`; `boxedText`/`description` continuam `string` — só o VALOR muda em tempo de execução, sem mudança de schema.
- **`title`/`aspects` do local do encontro final.** `generateAntagonistLocationProse` só reescreve `boxedText`/`description` — o nome/tema do local e seus aspectos Fate ficam como `generateLocationsAndNpcs` já decidiu no passo 2.
- **Revelar `weakness` em qualquer prosa.** A reversão da US-190 é só sobre NOME — `weakness` continua fora de qualquer prompt de prosa antes do confronto (mesma disciplina que já protege `conclusion`).
- **Prosa de outros locais/NPCs mencionar o antagonista.** Só o local do encontro final ganha reescrita — os demais locais/NPCs continuam como `generateLocationsAndNpcs` os escreveu no passo 2, sem segunda passada.

---

## Modelo de dados proposto

Nenhuma mudança de schema em `AdventureLocationSchema`/`AdventureAntagonistSchema` — só valores gerados em tempo de execução mudam.

```ts
// apps/api/src/ai/ai.service.ts — ANTAGONIST_LOCATION_PROSE_SCHEMA (NOVO)
const ANTAGONIST_LOCATION_PROSE_SCHEMA = z.object({
  boxedText: z.string().min(1),
  description: z.string().min(1),
})

// `antagonist` tipado como Pick<>, NÃO AdventureAntagonist inteiro — `weakness`/`connection`
// literalmente não existem no parâmetro, o compilador recusa se algum prompt tentar ler
// `params.antagonist.weakness` aqui dentro. Mesma disciplina que `buildOpeningBeatPrompt` já
// aplica (weakness fora do prompt), mas garantida em tipo, não só em code review — função é
// NOVA, não herda a proteção da função existente automaticamente.
async generateAntagonistLocationProse(params: {
  location: AdventureLocation
  antagonist: Pick<AdventureAntagonist, 'name' | 'method' | 'trait'>
  registry: AdventureRegistry
  locale?: Locale
}): Promise<{ boxedText: string; description: string }>
// Falha da chamada (schema zod ou erro de rede) logada com `logExtractionEndpoint`
// ('generateAntagonistLocationProse', ...) ANTES de propagar — mesmo padrão das outras
// `generate*`, pra distinguir no log qual das 3 pernas do Promise.all falhou quando a
// geração inteira cair por causa desta chamada nova.
```

```ts
// apps/api/src/ai/ai.service.ts — buildOpeningBeatPrompt, diff da US-190
// ANTES (US-190): nome excluído de propósito
// const antagonistLine = `Antagonista já decidido (pode insinuar, NUNCA nomear nem revelar a
//   weakness): método: ${params.antagonist.method}; traço: ${params.antagonist.trait}.`
// DEPOIS (US-191): nome incluído, weakness continua fora
const antagonistLine =
  `Antagonista já decidido — nome: ${params.antagonist.name} (pode nomeá-lo na cena; NUNCA revele a weakness): ` +
  `método: ${params.antagonist.method}; traço: ${params.antagonist.trait}.`
```

**Mudança pareada, não independente:** a proibição "NUNCA o nomeie" existe em DOIS lugares hoje — `antagonistLine` acima ([ai.service.ts:290](../../../apps/api/src/ai/ai.service.ts)) E o `system` prompt de `generateOpeningBeat` (*"NUNCA o nomeie nem revele sua weakness"*, [ai.service.ts:1780](../../../apps/api/src/ai/ai.service.ts)). Editar só um dos dois deixa instrução contraditória pro modelo (uma parte do prompt permite nomear, a outra proíbe). Os dois entram no MESMO commit/diff — teste de regressão abaixo garante isso automaticamente, não depende de lembrar na hora do review.

```ts
// apps/api/src/adventure/adventure.service.ts — generateAdventure
// Parte 1: patch de occupants, logo após antagonistNpc/finalDraft existirem (linha 271 hoje),
// SEM esperar o Promise.all — antagonistNpc e finalDraft.location já estão os dois em mãos.
const locationsWithOccupant = locations.map((loc) => {
  if (loc.id !== finalDraft.location.id) return loc
  const occupants = loc.occupants.includes(antagonistNpc.id) ? loc.occupants : [...loc.occupants, antagonistNpc.id]
  return { ...loc, occupants }
})

// Parte 2: generateAntagonistLocationProse entra no Promise.all já existente (que hoje só tem
// generateClosing/generateOpeningBeat, adventure.service.ts:277-301), recebendo antagonistWithNpcId
// (mesma variável que os outros dois já recebem, não `antagonist` cru):
const [
  { objective, conclusion, followUps, encounterSituations },
  { start },
  { boxedText, description },
] = await Promise.all([
  this.ai.generateClosing({ /* ... */ antagonist: antagonistWithNpcId /* ... */ }),
  this.ai.generateOpeningBeat({ /* ... */ antagonist: antagonistWithNpcId /* ... */ }),
  this.ai.generateAntagonistLocationProse({ location: finalDraft.location, antagonist: antagonistWithNpcId, registry, locale }),
])

// depois que boxedText/description resolvem, patch final sobre locationsWithOccupant (não sobre
// locations original — já carrega o occupant da Parte 1):
const locationsWithAntagonist = locationsWithOccupant.map((loc) =>
  loc.id === finalDraft.location.id ? { ...loc, boxedText, description } : loc,
)
```

---

## Critérios de aceite

**Parte 1 — `occupants`:**
- [x] `locations[<local do encontro final>].occupants` contém o `id` do `AdventureNpc` do antagonista; nenhum outro local ganha esse `id`.
- [x] Sem duplicata se o patch rodar sobre array que já contém o `id`.

**Parte 2 — prosa:**
- [x] `buildOpeningBeatPrompt`/`generateOpeningBeat`: `antagonist.name` aparece no prompt; `system` permite nomear o antagonista na cena; `weakness` continua fora de qualquer prompt.
- [x] `generateAntagonistLocationProse` existe, roda em paralelo dentro do `Promise.all` de `generateAdventure`, devolve `boxedText`/`description` não-vazios.
- [x] `locations[<local do encontro final>].boxedText`/`.description` no artefato final são os valores devolvidos por `generateAntagonistLocationProse` (não mais os originais de `generateLocationsAndNpcs`).
- [x] Nenhum outro local tem `boxedText`/`description` alterados.
- [x] **Teste de regressão:** fixture com `generateAntagonistLocationProse`/`generateOpeningBeat` mockados cobre os pontos acima.
- [x] **Teste de regressão — patch combinado:** `occupants` e `boxedText`/`description` do local do encontro final mudam JUNTOS no mesmo teste (não dois testes isolados) — pega patch que sobrescreve o outro.
- [x] **Teste de regressão — prompt pareado:** nem `antagonistLine` nem `system` de `generateOpeningBeat` contêm mais a proibição de nomear; falha se só um dos dois mudou.
- [x] **Teste de regressão — weakness não vaza:** `generateAntagonistLocationProse` tipa `antagonist` como `Pick<AdventureAntagonist, 'name' | 'method' | 'trait'>` (sem `weakness`/`connection`); fixture com `weakness` preenchido confirma que não aparece no `boxedText`/`description` mockado.
- [x] `pnpm typecheck`, `pnpm test` e `pnpm eval` passam (muda prompt de `generateOpeningBeat` e soma uma chamada de modelo nova).
- [x] **Ledger (Questão em aberto #1, decidida; correção 2026-08-23):** `seedLedgerFromGeneratedAdventure` devolve DUAS `WorldEntity` pro antagonista, MESMO `nome` nas duas (`WorldEntity.nome` é obrigatório — não dá pra omitir) — uma com `revelado: true` e sem `want`/`method`/`trait`/`weakness`/`connection`; outra com `revelado: false` e `nota` contendo esses cinco campos. `pnpm test`/`pnpm eval` cobrem `seed-ledger.ts` sem regressão.

**Ambas:**
- [x] Gate (US-150, `checkReferencesResolve`) continua passando sem mudança.

---

## Notas de implementação

- **US-188 e US-189 já implementadas** (ambas ✅) — o bloqueio de release que a US-188 documentava (não fazer merge sem US-189 no mesmo release) já foi resolvido, os dois landaram juntos em 2026-08-23. Esta story (US-191) parte de cima dessas duas: `antagonistNpc`, `antagonistWithNpcId` (com `npcId`) e a exclusão do antagonista de `npcEntities`/`encounterNpcEntities` no ledger (US-189, `seed-ledger.ts`) já existem — nenhuma delas precisa de ajuste por causa desta story (US-189 lê `antagonist.want/method/trait/weakness/connection`, nunca `occupants`/`boxedText`/`description`, então Parte 1/2 desta story não interferem no ledger).
- `finalDraft = drafts[drafts.length - 1]` e `antagonistNpc` já são conhecidos juntos, sincronamente, em [adventure.service.ts:269-271](../../../apps/api/src/adventure/adventure.service.ts) — bem ANTES do `Promise.all` ([adventure.service.ts:277-301](../../../apps/api/src/adventure/adventure.service.ts)). Isso muda a proposta original: **Parte 1 (`occupants`) não precisa mais entrar depois do `Promise.all`** — pode ser um patch simples logo após a linha 271, no mesmo bloco que já monta `antagonistWithNpcId`, sem esperar `generateAntagonistLocationProse`. Só a Parte 2 (prosa) depende do `Promise.all` (precisa da chamada de modelo nova rodando em paralelo com `generateClosing`/`generateOpeningBeat`).
- `generateAntagonistLocationProse` (Parte 2) recebe `antagonist: antagonistWithNpcId` (a versão já com `npcId`, mesma variável que `generateClosing`/`generateOpeningBeat` já recebem em [adventure.service.ts:285,298](../../../apps/api/src/adventure/adventure.service.ts)) — não `antagonist` cru, que não tem `npcId`.
- **Reversão de decisão registrada:** a proibição de nomear o antagonista em `generateOpeningBeat` foi decisão explícita da US-190 (Questão em aberto #2). Esta story a reverte deliberadamente — registrar isso na US-190 (nota apontando pra esta story) pra quem ler o histórico não achar que as duas se contradizem por engano.
- Quando US-166 estiver implementada e a posição do encontro final mudar pra `encounters[7]`/`drafts[7]`, `drafts[drafts.length - 1]` continua correto sem mudança — mesma garantia que US-188 já documenta.
- Custo: uma chamada de modelo a mais no `Promise.all` (3 → 4 chamadas paralelas nesse ponto, sem custo de latência sequencial adicional — mesma lógica que US-190 já usou pra justificar `generateAntagonist` fora do `Promise.all` só pelo motivo de SER insumo dos outros, não pelo custo em si).
- **`GeneratedAdventureSchema.parse` precisa receber `locationsWithAntagonist`, não `locations`.** O `return` de `generateAdventure` hoje usa a forma curta `locations,` ([adventure.service.ts:320](../../../apps/api/src/adventure/adventure.service.ts)) — depois desta story, o binding que chega até ali precisa ser o resultado dos dois `.map` encadeados (occupants + prosa), não o array original. Mais simples reatribuir/renomear pra `locations` continuar sendo o nome usado no objeto final (`const locations = locationsWithAntagonist` ou já nomear a variável final `locations` desde o início) do que confiar em lembrar de trocar o shorthand no `return`.

---

## Questões em aberto

1. ~~`revelado: false` no ledger (US-189) continua fazendo sentido depois que Parte 2 nomeia o antagonista em `start`?~~ **Decidido (2026-08-23): opção (b) — separar a entidade em duas no ledger.** `seedLedgerFromGeneratedAdventure` passa a semear DUAS `WorldEntity` pro antagonista em vez de uma: uma pública (`nome`, `local`, `revelado: true` — o nome já não é segredo desde a abertura) e outra oculta (`nota` com `want`/`method`/`trait`/`weakness`/`connection`, `revelado: false` — o que ainda importa proteger até o confronto). Motivo: nomear e depois o Mestre evitar o nome (opção c) quebra imersão à toa; destravar tudo (opção a) daria spoiler grátis de `weakness`/`connection`, que é a parte que sustenta a tensão do confronto final. `WorldEntity` já suporta `revelado` por entidade — não precisa mudar o schema, só a função de seed em `seed-ledger.ts` passa a devolver duas entradas em vez de uma pro antagonista.
2. **Resolvida durante implementação (2026-08-23):** `antagonistHiddenEntity` tem `nome`? A redação original da questão #1 previa a oculta SEM `nome`. `WorldEntity.nome` é `string` obrigatório ([character.ts:50](../../../packages/shared/src/types/character.ts:50)) — omitir exigiria mudar o schema, fora de escopo desta story. **Decidido: as duas entidades repetem `antagonist.name`.** Não é fuga do bloqueio — é o certo: o nome nunca foi o segredo que Parte 2 protege (ela mesma libera nomeá-lo na abertura); só `nota` (want/method/weakness/connection) fica atrás de `revelado: false`.

---

## Referências no código

- [packages/shared/src/types/adventure-generation.ts:26-33](../../../packages/shared/src/types/adventure-generation.ts) — `AdventureLocationSchema.occupants`/`boxedText`/`description`.
- [apps/api/src/adventure/adventure.service.ts:204-209](../../../apps/api/src/adventure/adventure.service.ts) — `generateLocationsAndNpcs`, onde `boxedText`/`description`/`occupants` nascem originalmente (passo 2, antes do antagonista existir).
- [apps/api/src/adventure/adventure.service.ts:234-236](../../../apps/api/src/adventure/adventure.service.ts) — `drafts`, onde `finalDraft.location` já é conhecido antes de `generateAntagonist`.
- [apps/api/src/adventure/adventure.service.ts:244-254](../../../apps/api/src/adventure/adventure.service.ts) — `generateAntagonist` (US-190, ✅ implementada).
- [apps/api/src/adventure/adventure.service.ts:262-271](../../../apps/api/src/adventure/adventure.service.ts) — `antagonistNpc`/`antagonistWithNpcId` (US-188, ✅ implementada) — ponto onde o patch de `occupants` (Parte 1) entra.
- [apps/api/src/adventure/adventure.service.ts:277-301](../../../apps/api/src/adventure/adventure.service.ts) — `Promise.all` (`generateClosing`/`generateOpeningBeat`), onde `generateAntagonistLocationProse` entra (Parte 2).
- [apps/api/src/ai/ai.service.ts:275-290](../../../apps/api/src/ai/ai.service.ts) — `buildOpeningBeatPrompt`, `antagonistLine` que perde a exclusão do nome.
- [apps/api/src/ai/ai.service.ts:1744-1787](../../../apps/api/src/ai/ai.service.ts) — `generateOpeningBeat`, `system` prompt que perde "NUNCA o nomeie".
- [US-158](./US-158-locais-npcs-prosa-motor.md) — origem de `occupants`/`boxedText`/`description`, mesmo padrão reusado aqui.
- [US-188, Questão em aberto #2](./US-188-antagonista-vira-npc-rastreavel.md) — decisão original que criou a parte 1 desta story.
- [US-190, Questão em aberto #2](./US-190-antagonista-vira-passo-proprio-entre-segredos-e-encontros.md) — decisão original ("nunca nomear") que a parte 2 desta story reverte.
- [apps/api/src/adventure-generation/seed-ledger.ts:71-86](../../../apps/api/src/adventure-generation/seed-ledger.ts) — `seedLedgerFromGeneratedAdventure`, onde `antagonistEntity` (US-189) vira duas entidades (Questão em aberto #1 desta story, decidida).
- [US-189](./US-189-antagonista-entra-no-ledger.md) — cria `antagonistEntity` como entrada única no ledger; esta story a divide em pública/oculta.
