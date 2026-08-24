# US-193 — Os 8 encontros nascem sem cadeia causal entre si

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Desdobrada em:** [US-195](./US-195-eval-de-embaralhamento-da-cadeia-causal.md) (eval de embaralhamento — extraída durante a implementação, não bloqueia o resto desta story)
**Depende de:** [US-166](./US-166-motor-gera-multiplos-encontros.md) (`encounterSkeleton`/`encounterSituations`, `AdventureEncounterSchema` — esta story estende os três) · [US-144](./US-144-schema-aventura-shared.md) (`AdventureEncounterSchema` MUDA de novo) · [US-114](./US-114-modelo-utilitario-para-extracao-e-fecho.md) (modelo barato, mesma chamada) · [US-190](./US-190-antagonista-vira-passo-proprio-entre-segredos-e-encontros.md)/[US-181](./US-181-antagonista-ganha-want-e-method-estruturados.md) (`antagonist` chega pronto — é o alvo pra onde a cadeia converge)
**Relacionado:** [US-150](./US-150-gate-antes-de-persistir-aventura-gerada.md) (gate — `.parse()` do array novo falha ⇒ re-seed; a cadeia SEMÂNTICA fica fora do gate, ver *Fora do escopo*) · [US-170](./US-170-locais-gerados-entram-no-ledger.md)/[US-171](./US-171-encontros-de-combate-entram-no-ledger.md) (`nota` do local **não** muda — `unlocks` fica fora do ledger, ver *Fora do escopo*) · [US-153](./US-153-aventura-deixa-de-ser-derivada-da-classe.md) (item #4, "não vaza antes de merecer" — a disciplina que motiva manter `unlocks` fora do runtime) · [US-169](./US-169-quest-gerada-ganha-objetivo-e-conclusao-acionavel.md) (`objective` é o alvo que a cadeia persegue) · [US-187](./US-187-distribuicao-tematica-de-locationid-baseada-em-registry.md) (distribuição temática de `locationId` — já implementada, esta story não mexe nela) · [Backlog — Motor de geração de aventuras one-shot §O que o motor não produz](./backlog-motor-de-geracao-de-aventuras.md) (**cadeia causal entre pistas**, o primeiro dos quatro — é exatamente este)

**Criada em:** 2026-08-24 — a pedido da mantenedora, aplicando o passo 3 do guia *How to Write a D&D Adventure* (The Arcane Library / Kelsey Dionne) ao passo 6 do motor. O guia desenha os 8 encontros por **hurdles-based design**: identifica o encontro final primeiro e caminha PRA TRÁS, perguntando a cada passo o que o personagem faria naturalmente e qual obstáculo o trava. A regra de corte do artigo é o que o motor hoje não tem como aplicar: *"Does what I'm describing help move the characters closer to the adventure's solution? If not, do not write it."*

---

## História

> **Como** jogadora,
> **quero** que cada um dos 8 encontros exista por causa do anterior — que o que eu descubro ou conquisto num deles seja a razão de o próximo estar aberto —,
> **para que** a aventura seja uma trilha até o antagonista e não 8 cenas boas soltas na mesma pasta.

---

## Contexto e motivação

### O problema observado

A [US-166](./US-166-motor-gera-multiplos-encontros.md) fez cada encontro virar uma **situação completa** (Sly Flourish: location / inhabitants / behaviors / goal / complications) e isso funcionou: cada cena tem gente fazendo alguma coisa. O que ela não fez — e não se propôs a fazer — foi ligar uma cena na outra.

Três coisas no código atual dizem isso:

1. **Nada no `system` de `generateClosing` pede encadeamento.** A instrução dos 8 é *"para CADA um dos 8 encontros listados abaixo (na MESMA ordem), escreva `behaviors`/`goal`/`complications`"* ([ai.service.ts:1806](../../../apps/api/src/ai/ai.service.ts)) — 8 problemas independentes resolvidos em paralelo, não uma trilha. O único vínculo exigido é vertical (posição 8 ecoa `antagonist.want`/`method`), nunca horizontal.
2. **O prompt entrega os 8 como lista chapada.** `encounterLines` é `"{i}. {id} ({type}) — local: {title}; moradores: {label}"` ([ai.service.ts:377-384](../../../apps/api/src/ai/ai.service.ts)). O modelo vê a ORDEM, mas nada afirma que a ordem significa consequência.
3. **`goal` é definido como motivo isolado.** *"`goal` é por que o personagem foi até lá"* — sem exigir que a resposta venha do encontro anterior, "por que foi lá" pode nascer do nada oito vezes seguidas.

O backlog já nomeia isso como buraco conhecido, em *O que o motor não produz*: **cadeia causal entre pistas**, e é explícito sobre o limite do que já existe — *"Grafo que fecha garante que a pista aponta para uma locação que existe; não garante que as três pistas componham um mecanismo. Estrutura é piso, não teto."*

### Teste que expõe o defeito hoje

Troque de lugar dois encontros vizinhos de uma aventura gerada. Se a aventura continua fazendo o mesmo sentido, não há cadeia — é lista. Hoje passa nesse teste em quase toda troca, porque `type` alternado e `locationId` temático (US-187) são as únicas coisas que a posição carrega.

### O que o artigo acrescenta que a US-166 não cobre

| Peça do artigo | US-166 | Falta |
|---|---|---|
| Encontro final decidido primeiro | ✅ posição 8 fixa, ancorada no antagonista | — |
| Tipos alternados, sem repetição adjacente | ✅ `shuffleEncounterTypes` | — |
| Cada encontro é um **obstáculo**, não uma cena | ✅ `complications` | — |
| **Escrever de trás pra frente** | ❌ | instrução de raciocínio |
| **Saída de um = entrada do seguinte** | ❌ | campo + instrução |
| Regra de corte ("não aproxima da solução ⇒ não escreva") | ❌ | instrução, ancorada no `objective` |

---

## Escopo

### Dentro do escopo

- `AdventureEncounterSchema` ganha **`unlocks: z.string().min(1)`** — o que ESTE encontro entrega (informação, acesso, aliado, recurso, permissão) que torna o próximo possível. Na posição 8, `unlocks` descreve o que a vitória resolve, não um próximo encontro.
- `CLOSING_SCHEMA.encounterSituations` ganha `unlocks` **e `encounterId`** no mesmo objeto — continua `.length(8)`, continua posicional. `encounterId` é ECO do id da lista do prompt, existe só pra conferir pareamento e morre no `.map` de `adventure.service.ts` (não entra em `AdventureEncounterSchema`, não é vínculo semântico — ver *Fora do escopo*, `unlocksEncounterId`).
- `adventure.service.ts` ([:349](../../../apps/api/src/adventure/adventure.service.ts)) confere `encounterSituations[i].encounterId === drafts[i].id` antes de montar o encontro e **lança** quando difere, com o valor ofensor e o esperado na mensagem. Exceção cai em `runGateAttempt` como `stage: 'parse'` ⇒ reseed (US-150). Sem isso, array emitido de trás pra frente passa silencioso: os 4 campos são prosa livre e o gate só olha id/grafo/CR.
- `system` de `generateClosing` ganha três instruções, todas na chamada que já existe:
  - **Raciocine de trás pra frente**: comece pela posição 8 (o confronto já ancorado no antagonista) e, para cada anterior, pergunte o que o personagem faria naturalmente em seguida e o que o trava. Emitir o array na ordem 1→8 mesmo assim.
  - **`goal[i]` responde `unlocks[i-1]`**: o motivo de o personagem estar no encontro `i` tem que ser o que o encontro `i-1` entregou. A posição 1 é a exceção — o `goal` dela nasce da premissa/complicação, não de um encontro anterior.
  - **Regra de corte**: se a situação escrita não aproxima do `objective` (US-169), reescreva — nenhuma das 8 é cena de passagem.
- `buildClosingPrompt`: `encounterLines` ganha um cabeçalho dizendo que a lista é uma TRILHA (o encontro `i` só acontece por causa do `i-1`), não um conjunto. Sem campo novo no `encounterSkeleton` — a ordem já está lá.
- **Baseline da eval de embaralhamento, ANTES de qualquer código** (ver *Ordem de implementação*): duas aventuras geradas pelo código de hoje (sem `unlocks`) congeladas como fixture em `evals/`, e a eval nova tem que **reprovar** as duas. Se aprovar, o juiz não discrimina e a eval não mede nada — conserta a rubrica antes de escrever a story.
- Testes de regressão: `unlocks` presente e não-vazio nos 8; `.parse()` de `GeneratedAdventureSchema` passa; `CLOSING_SCHEMA` rejeita array com item sem `unlocks`; `generateAdventure` lança quando `encounterId` não bate com o esqueleto (mock com os 8 itens em ordem invertida); guard de posição 1 presente no `system`.

### Fora do escopo

- **Verificar a cadeia no gate (US-150).** O gate valida estrutura (schema, grafo fecha, orçamento) — casar `goal[i]` com `unlocks[i-1]` é semântica, e casamento por texto é frágil o bastante pra reprovar aventura boa. Fica como critério de **eval**, não de gate. É a mesma fronteira que o backlog já desenha ("estrutura é piso, não teto").
- **`unlocks` na `nota` do ledger (US-170).** Versão anterior desta story escrevia `"; abre: {unlocks}"` no segmento do encontro. Retirado: a `nota` do local vai ao prompt do Mestre TODO turno ([entities.ts:137](../../../packages/ai-engine/src/entities.ts), `formatEntities`), e o gate que protege esse texto é o marcador `⚠ OCULTO` de `revelado: false` — que **some assim que o local é revelado**. `goal`/`complications` descrevem a cena atual e sobrevivem a isso; `unlocks` descreve a cena SEGUINTE, então vazaria como spoiler exatamente quando o jogador chega ao local. O rumo em runtime já é `nextUnrevealedEncounterLocation` ([next-encounter-hint.ts](../../../apps/api/src/adventure-generation/next-encounter-hint.ts)), que não precisa de `unlocks`. O campo é elo de AUTORIA: vive no artefato `generatedAdventure` (revisável à mão, lido pela eval), não no runtime. Consequência: nenhum código de runtime lê `unlocks`, e o custo por turno do bloco de entidades não muda.
- **Backfill das aventuras já persistidas.** `Adventure.generatedAdventure` é `Json` e a leitura só faz cast — ninguém re-parseia, então artefatos anteriores a esta story continuam funcionando com `unlocks` ausente. Eles **não revalidam** contra o `AdventureEncounterSchema` novo, e reparse de artefato antigo não é caminho suportado (comentário no schema registra isso). Sem migração de dados, sem `.optional()`, sem placeholder.
- **Retry isolado de `generateClosing` quando `unlocks` falha o schema.** Hoje a exceção do `generateObject` vira `stage: 'parse'` em `runGateAttempt` e re-semeia a aventura INTEIRA (registry, locations/npcs, secrets, antagonista, abertura). Esta story acrescenta 8 campos `min(1)` obrigatórios num modelo utilitário barato (US-114), então a superfície de falha cresce — mas construir retry parcial antes de ter número é especulação. Medir primeiro (ver *Notas de implementação*), decidir depois, story própria se doer.
- **Campo estrutural de dependência (`unlocksEncounterId`, DAG entre encontros).** A trilha é linear e a ordem já é o vínculo; um id a mais só seria verificável se o gate fosse checar, o que a linha acima descarta. Não confundir com o `encounterId` de eco do *Dentro do escopo*: aquele não liga encontro a encontro, só confere que o item `i` responde ao esqueleto `i`, e é descartado logo depois.
- **`generateOpeningBeat` consumir o encontro 1.** O artigo quer que o gancho jogue o personagem direto na primeira cena, mas `generateOpeningBeat` roda em `Promise.all` com `generateClosing` ([US-166](./US-166-motor-gera-multiplos-encontros.md), *Notas de implementação*) — serializar as duas custa um round-trip inteiro. Existe saída mais barata que serializar: **apagar** `generateOpeningBeat` e compor `start` a partir do encontro 1, sem IA — é a [US-194](./US-194-abertura-e-encontro-1-competem-como-cena-inicial.md). Ela depende desta e roda depois: a eval de embaralhamento aqui tem que passar ANTES de a abertura mudar, senão a leitura vem contaminada.
- **Ramificação / caminhos alternativos entre encontros.** O artigo fala em salas com conexões circulares (passo 4, mapa) — o motor não tem mapa, e a trilha linear é o que os 8 slots posicionais já suportam.
- **Mexer em `shuffleEncounterTypes` ou na distribuição de `locationId`.** Tipo e local continuam como estão (US-166/US-187); esta story só acrescenta o fio entre eles.
- **Só instrução de prompt, sem campo novo.** Considerado e rejeitado: a cadeia ficaria implícita dentro da prosa de `goal`, impossível de revisar na mão no seed que a US-150 exige jogar e invisível pra eval de embaralhamento, que precisa de um campo separado pra ler. (O argumento "invisível pro Mestre em runtime" NÃO vale mais — `unlocks` também não chega ao Mestre, de propósito.)

---

## Modelo de dados proposto

```ts
// packages/shared/src/types/adventure-generation.ts
export const AdventureEncounterSchema = z.object({
  id: z.string().min(1),
  locationId: z.string().min(1),
  npcIds: z.array(z.string()),
  type: z.enum(['combat', 'skill', 'social']),
  behaviors: z.string().min(1),
  goal: z.string().min(1),
  complications: z.string().min(1),
  // US-193: o elo da trilha (hurdles-based design, The Arcane Library). O que este encontro
  // ENTREGA — informação, acesso, aliado, recurso — que faz o próximo existir. Na posição 8
  // descreve o que a vitória resolve, não um próximo encontro. Sem id: o vínculo é a ordem.
  // Campo de AUTORIA: nenhum código de runtime o lê (fica fora do ledger, ver Fora do escopo).
  // Aventuras geradas antes desta story não têm `unlocks` e NÃO revalidam contra este schema —
  // reparse de artefato antigo não é caminho suportado; não há backfill.
  unlocks: z.string().min(1),
})
```

```ts
// apps/api/src/ai/ai.service.ts — CLOSING_SCHEMA
  encounterSituations: z.array(z.object({
    // US-193: eco do id da lista do prompt, só pra conferir pareamento posicional em
    // adventure.service.ts — descartado logo depois, nunca chega em AdventureEncounterSchema.
    encounterId: z.string().min(1),
    behaviors: z.string().min(1),
    goal: z.string().min(1),
    complications: z.string().min(1),
    unlocks: z.string().min(1),
  })).length(8),
```

```ts
// apps/api/src/adventure/adventure.service.ts — dentro do .map dos drafts
    const situation = encounterSituations[i]!
    // US-193: o array é posicional (contrato da US-166) e todos os campos são prosa livre —
    // se o modelo emitir de trás pra frente, nada mais detecta (o gate só olha id/grafo/CR).
    // Eco do id é a única verificação mecânica possível sem DAG entre encontros.
    if (situation.encounterId !== draft.id) {
      throw new Error(
        `encounterSituations[${i}].encounterId "${situation.encounterId}" != esqueleto "${draft.id}" (array fora de ordem)`,
      )
    }
```

`generateClosing` mantém a assinatura — `encounterSkeleton` entra igual, `encounterSituations` sai com dois campos a mais. Nenhuma chamada nova, nenhum round-trip novo.

---

## Critérios de aceite

- [ ] ~~A eval de embaralhamento reprova as duas fixtures geradas pelo código de hoje~~ — **extraído para [US-195](./US-195-eval-de-embaralhamento-da-cadeia-causal.md)**. As duas fixtures baseline (`evals/fixtures/us-193-baseline-{1,2}.json`) foram geradas e congeladas ANTES de qualquer mudança de código; a heurística determinística que deveria reprová-las não discriminou de forma confiável (achado documentado na US-195), então a eval em si fica pendente lá.
- [x] `unlocks` presente e não-vazio nos 8 encontros de toda aventura gerada; `GeneratedAdventureSchema.parse()` passa.
- [x] `CLOSING_SCHEMA` rejeita `encounterSituations` com qualquer item sem `unlocks` — falha de `.parse()` é motivo de re-seed (US-150), não de conserto pelo modelo. `unlocks` **nunca** vira `.optional()` para fazer fixture antiga passar: fixture desatualizada se atualiza.
- [x] `generateAdventure` lança quando `encounterSituations[i].encounterId` não bate com `drafts[i].id`, e a mensagem carrega os dois valores. Teste: mock devolvendo os 8 itens em ordem invertida.
- [ ] `goal` dos encontros 2 a 8 referencia o que o `unlocks` do encontro anterior entregou; o encontro 1 ancora na premissa/complicação. Verificado por **eval** (US-195) — a instrução está no `system` e a fixture real `evals/fixtures/us-193-chain-1.json` mostra o padrão funcionando (goal[2] cita o grimório de unlocks[1], goal[4] cita a Ember de unlocks[3] etc.), mas não há verificação automática ainda.
- [ ] `unlocks` do encontro 8 fecha no `objective`/`antagonist.want` — não aponta pra um nono encontro. Instrução presente no `system` (reaproveita o guard pré-existente do encontro final); sem teste de conteúdo automatizado — só inspeção manual da fixture real.
- [x] `encounterLines` de `buildClosingPrompt` declara a lista como trilha ordenada, não como conjunto.
- [x] `nota` do local sai desta story **byte a byte igual** ao que a US-170/US-171 já produzem — nenhum consumidor de runtime lê `unlocks` (grep vazio fora de `adventure-generation.ts`, `adventure.service.ts` — o único ponto de escrita — e dos testes).
- [x] Determinismo preservado: `type`/`locationId`/`npcIds` continuam estáveis por `characterId`+`order`. `unlocks` é prosa do modelo — **não** se exige texto idêntico entre execuções.
- [x] `pnpm typecheck` e testes dos módulos tocados passam; `pnpm eval` verde.
- [ ] ~~Eval nova (embaralhamento)~~ — **extraído para [US-195](./US-195-eval-de-embaralhamento-da-cadeia-causal.md)**, ver *Achado* naquela story.
- [ ] Seed jogado à mão (exigência da US-150) — não executado em turno real de jogo. Substituído parcialmente por leitura manual de 2 aventuras reais geradas pelo motor (`evals/fixtures/us-193-baseline-*.json` pré-mudança, `us-193-chain-1.json` pós-mudança), que confirma a trilha na segunda e a ausência dela na primeira. `unlocks` não chega ao prompt do Mestre por construção (fica fora do ledger), então não há o que vazar em runtime.

---

## Notas de implementação

- **Um campo, uma chamada.** `generateClosing` já recebe `secrets[]`, `antagonist` e o esqueleto dos 8 — a cadeia é o único insumo que faltava e não custa round-trip. Passo novo no pipeline foi descartado pelo mesmo motivo que a US-166 recusou função nova.
- **Raciocínio de trás pra frente ≠ saída de trás pra frente.** O array é posicional (`encounterSituations[i]` ↔ `encounterSkeleton[i]`, contrato da US-166). A instrução manda pensar do 8 pro 1 e emitir do 1 pro 8 — inverter o array quebraria o pareamento posicional silenciosamente.
- **Posição 1 é exceção explícita no prompt.** Sem isso o modelo tende a inventar um "encontro zero" pra justificar o `goal` do primeiro, criando referência a cena que não existe — mesma classe de erro que a US-166 previne exigindo `npcIds` real em `combat`.
- **`unlocks` não é lido pelo Mestre em runtime — nem pelo ledger.** Diferente de `goal`/`behaviors`/`complications`, ele NÃO entra na `nota`: ver *Fora do escopo*. O bloco `## Situação em aberto mais próxima` (US-166) continua expondo só `location.title`, e o rumo continua saindo de `nextUnrevealedEncounterLocation`.
- **Medir a taxa de falha do schema antes de otimizar.** Depois de implementado, rodar ~10 gerações e contar quantas quebram em `encounterSituations` — `logGateFailure` já grava o caminho do campo (`schema inválido em "encounterSituations.3.unlocks"`), nada novo a instrumentar. Acima de ~1/10, a conversa de retry isolado de `generateClosing` vira story com número na mão; abaixo, o reseed do gate resolve e não se escreve código nenhum.
- **Fixtures: campo literal em cada arquivo, sem factory compartilhada.** Os helpers que constroem `AdventureEncounter` estão em 4 lugares (`adventure-gate.test.ts:8`, `seed-ledger.test.ts:6`, `next-encounter-hint.test.ts:5`, `fakeAi` de `adventure.service.test.ts`), mais `packages/shared/src/types/adventure-generation.test.ts` e `evals/cases/us-154-eval-aventura-gerada.ts`. São 6 arquivos, não 60 — extrair factory comum custa mais do que economiza e piora a leitura local do teste.
- **Fallback de combate inviável não muda nada aqui.** Nível 1-3 em modo `'adventure'` já vira `{social×4, skill×3}` + posição 8 `social` (US-166); a trilha é ortogonal ao tipo.
- **`CRAFT_CORE_SECTION` continua reusado verbatim** — seção dedicada só se a eval acusar `unlocks` genérico ("o personagem descobre uma pista").

### Riscos e sugestões para a implementação

Como testar os riscos já descritos acima:

- **Pareamento posicional** (risco descrito na nota *"Raciocínio de trás pra frente ≠ saída de trás pra frente"* acima). Dois testes, dois alvos diferentes: (a) `ai.service.test.ts`, mock do model devolvendo os 8 itens com `unlocks` marcado por índice (`"unlock-1"`…`"unlock-8"`), confirma que o CÓDIGO não embaralha até chegar no `adventure.service`; (b) `adventure.service.test.ts`, mock devolvendo os 8 em ordem invertida, confirma que `generateAdventure` LANÇA pelo eco de `encounterId`. Só (a) — o teste que a versão anterior desta story descrevia — prova que o código está certo, nunca que o MODELO não inverteu, que é o risco real. A eval de embaralhamento é a defesa semântica: caso real em `evals/`, com o baseline do *Dentro do escopo* provando que discrimina.
- **Guard da posição 1** (risco descrito na nota *"Posição 1 é exceção explícita no prompt"* acima). Teste espelha o padrão já usado pros outros guards do `system` em `ai.service.test.ts` (assert de substring sobre o prompt capturado do mock) — confirma que a string do guard está de fato no `system`, não só documentada aqui.
- **`CLOSING_SCHEMA` deve rejeitar item sem `unlocks`.** Teste em `ai.service.test.ts`, ao lado dos outros testes de schema: montar os 8 itens, remover `unlocks` de um, `CLOSING_SCHEMA.safeParse(...).success === false`. Mesmo teste vale pra `encounterId`.
- **`seed-ledger.ts` não é tocado.** A versão anterior desta story acrescentava `; abre: ${e.unlocks}` ao segmento do encontro em [seed-ledger.ts:60](../../../apps/api/src/adventure-generation/seed-ledger.ts:60). Retirado pelo risco de vazamento descrito em *Fora do escopo* — o `⚠ OCULTO` que protege a `nota` cai quando o local é revelado, que é exatamente quando o jogador chega lá. Fixture da US-170 fica intacta; o teste é o inverso: `unlocks` não aparece em nenhuma `WorldEntity` produzida.

### Ordem de implementação

1. **Baseline da eval** (fixtures congeladas do código atual + eval de embaralhamento reprovando as duas). É ela que diz se a story faz sentido; se o juiz não discrimina, para aqui e conserta a rubrica.
2. **Schema**: `unlocks` em `AdventureEncounterSchema`, `unlocks` + `encounterId` em `CLOSING_SCHEMA`, guard do eco em `adventure.service.ts`.
3. **Prompt**: as três instruções do `system` + cabeçalho de trilha em `encounterLines`.
4. **Fixtures** dos 6 arquivos, `pnpm typecheck`, testes dos módulos tocados.
5. **Medição** da taxa de falha do schema (~10 gerações) + `pnpm eval` + seed jogado à mão.

---

## Referências no código

- [`apps/api/src/ai/ai.service.ts`](../../../apps/api/src/ai/ai.service.ts) — `CLOSING_SCHEMA`, `buildClosingPrompt` (`encounterLines`), `generateClosing` (`system`).
- [`packages/shared/src/types/adventure-generation.ts`](../../../packages/shared/src/types/adventure-generation.ts) — `AdventureEncounterSchema`.
- [`apps/api/src/adventure/adventure.service.ts`](../../../apps/api/src/adventure/adventure.service.ts) — `generateAdventure`, junta `encounterSituations` no esqueleto; é onde entra o guard do eco de `encounterId`.
- [`apps/api/src/adventure-generation/adventure-gate.ts`](../../../apps/api/src/adventure-generation/adventure-gate.ts) — `runGateAttempt` converte exceção de `generate` em `stage: 'parse'` (é assim que o guard vira reseed); `runAdventureGate` continua sem olhar a cadeia.
- [`apps/api/src/adventure-generation/seed-ledger.ts`](../../../apps/api/src/adventure-generation/seed-ledger.ts) — `locationEntities`; **não muda** nesta story (ver *Fora do escopo*).
- [`packages/ai-engine/src/entities.ts`](../../../packages/ai-engine/src/entities.ts) — `formatEntities`: por onde a `nota` chega ao prompt do Mestre, e o motivo de `unlocks` ficar fora dela.
- [`apps/api/src/adventure-generation/next-encounter-hint.ts`](../../../apps/api/src/adventure-generation/next-encounter-hint.ts) — sinal de rumo em runtime, não muda.

### Referências externas

- [The Arcane Library — How to Write a D&D Adventure: The Complete Guide](https://www.thearcanelibrary.com/blogs/news/how-to-write-a-d-d-adventure-the-complete-guide) — passo 3, *hurdles-based design*: encontro final primeiro, caminhar pra trás, regra de corte pela solução. Origem desta story.
- [Sly Flourish — Building Situations](https://slyflourish.com/building_situations.html) — as 5 perguntas que a US-166 implementou; `unlocks` é o eixo entre situações, que o checklist não cobre.
- [Sly Flourish — Running Investigations and Mysteries](https://slyflourish.com/running_investigations_and_mysteries.html) — "build situations, not mystery novels": a trilha é o fio, não um roteiro fechado; `complications` continua podendo virar o jogo.
