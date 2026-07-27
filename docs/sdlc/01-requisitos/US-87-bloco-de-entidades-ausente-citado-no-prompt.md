# US-87 — O prompt para de afirmar que existe um bloco de entidades que o turn-state não emitiu

**Épico:** 5 — Qualidade e avaliação do DM Agent
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** nenhuma. Pode rodar antes ou depois da [US-84](./US-84-nomes-de-bloco-do-turn-state-compartilhados.md) — as duas tocam as mesmas linhas, mas por motivos independentes. Se as duas entrarem, a US-84 primeiro (refactor puro, `diff` vazio no texto renderizado), esta depois (muda o que o modelo lê).
**Nasceu de:** [US-84](./US-84-nomes-de-bloco-do-turn-state-compartilhados.md) → *Questões em aberto #2*. Aquela story identificou o defeito e o deixou de fora por incompatibilidade de prova: ela se valida com comparação byte a byte, esta só se valida com eval.
**Relacionada a:** [US-75](./US-75-dimensao-de-proveniencia-no-ledger.md) (dona do ledger e do texto do bloco), [US-56](./US-56-estado-do-turno-na-mensagem.md) (separou as camadas — é o que torna a camada 3 barata de mexer), [US-55](./US-55-prompt-caching-do-dm.md) (a camada 2 é cacheada — é o que torna a camada 2 cara de mexer), [US-36](./US-36-eval-de-qualidade-da-narracao.md) (a infra de eval que mede o resultado).
**Criada em:** 2026-07-27

---

## História

> **Como** mantenedor do DM Agent,
> **quero** que o prompt nunca mande o Mestre confiar num bloco que não está no contexto daquele turno,
> **para que** uma campanha recém-criada não gaste todo turno lendo uma instrução que aponta para o vazio.

---

## Contexto e motivação

### O problema observado

A camada 2 (system prompt, estática, cacheada) afirma **incondicionalmente** que o bloco de entidades existe:

```
dm-system.ts:314   …This ledger is your PERMANENT memory — re-shown in full every turn under "Entidades do mundo"…
dm-system.ts:349   The "Cena atual" and "Entidades do mundo" blocks in the turn-state are the SOURCE OF TRUTH…
```

A camada 3 (turn-state, recomputada por turno) o emite **condicionalmente**:

```ts
// dm-system.ts:428-440
const entitiesText = formatEntities(entities, sceneState?.presentes)
const entitiesSection = entitiesText ? `## Entidades do mundo (FONTE DE VERDADE — …)` : ''
```

E `formatEntities` retorna `''` para ledger vazio (`entities.ts:74`).

Resultado com ledger vazio: o modelo lê "re-shown in full every turn" e "SOURCE OF TRUTH", e o bloco não está em lugar nenhum do contexto.

### Ledger vazio não é falha

É estado normal, por duas vias, ambas deliberadas:

1. **A semeadura da abertura é best-effort.** `adventure.service.ts:130-135` — o comentário é explícito: *"Falha/vazio → ledger vazio (pré-US-75)"*. `extractOpeningEntities` nunca derruba a criação da aventura.
2. **`recordEntity` é discricionário do modelo.** Ele chama quando julga que a entidade é durável. Nada obriga.

Ou seja: uma campanha nova pode rodar vários turnos com o ledger vazio, e cada um desses turnos carrega a instrução órfã.

### Por que a solução atual não basta

O teste `dm-system.test.ts:284` **codifica a emissão condicional como comportamento esperado** (`expect(buildState()).not.toMatch(/## Entidades do mundo/)`). Ele prova o lado emissor e está certo no que prova. Ninguém testa o par: que a prosa da camada 2 só afirma o que a camada 3 vai de fato emitir.

Não há defeito visível em `pnpm test`, `pnpm typecheck` nem em log. O único observável é a narração — e por isso a decisão precisa de medição, não de palpite.

### A proposta

Medir o impacto com um eval A/B/C em campanha de ledger vazio, escolher a variante vencedora e implementá-la. Se o eval não distinguir as três, a decisão é documentada e nada muda — resultado válido, story fechada.

---

## As três variantes

| | O que faz | Camada tocada | Custo de cache | Risco |
|---|---|---|---|---|
| **A — controle** | nada; estado de hoje | — | — | instrução órfã permanece |
| **B — emitir sempre** | `entitiesSection` deixa de ser condicional; com ledger vazio emite o cabeçalho + linha tipo `(nenhuma entidade registrada ainda — registre com \`recordEntity\`)` | 3 (`buildTurnStateBlock`) | **zero** — a camada 3 vai prefixada à última mensagem desde a [US-56](./US-56-estado-do-turno-na-mensagem.md), fora da fronteira de cache | dizer ao Mestre que a memória permanente está vazia pode virar ruído, ou pior, tema de narração |
| **C — frasear com ressalva** | `:314` e `:349` passam a qualificar ("quando presente" / "se listado") | 2 (`buildDmSystemPrompt`) | invalida o cache **uma vez**, depois reaquece | enfraquece em TODO turno uma regra hoje absoluta, inclusive nos turnos em que o bloco existe — o custo cai sobre o caso comum para consertar o caso raro |

A hipótese a bater é que **B** ganha: paga menos e converte a ausência em informação útil (o Mestre passa a ver que o ledger está vazio, o que é exatamente o gatilho de `recordEntity`). Mas é hipótese; o eval decide.

---

## Escopo

### Dentro do escopo

- Eval com campanha de ledger vazio comparando A, B e C nas dimensões da [US-36](./US-36-eval-de-qualidade-da-narracao.md), mais uma verificação específica: o Mestre menciona ou "narra em volta" da ausência do bloco?
- Implementação da variante vencedora.
- Atualização de `dm-system.test.ts:284`, que hoje afirma o comportamento oposto ao da variante B.

### Fora do escopo

- **O eixo *nome*** — é a [US-84](./US-84-nomes-de-bloco-do-turn-state-compartilhados.md). Aqui o nome não muda.
- **A metade da cena.** `sceneSection` (`:414`) tem o mesmo condicional, mas a [US-35](./US-35-cena-estruturada-na-abertura.md) confinou o caso vazio ao turno de abertura, onde ele é causalmente inevitável (a abertura é o que *gera* a cena). Do turno 1 em diante o campo está preenchido.
- **Reescrever as regras do ledger** (knowledge gates, provenance, ocultos). São da [US-75](./US-75-dimensao-de-proveniencia-no-ledger.md) e ficam intactas em qualquer variante.
- **Garantir que o ledger nunca fique vazio** (ex.: tornar `extractOpeningEntities` obrigatório). É mudar o comportamento do sistema para acomodar o prompt — inversão de causa; e derruba a criação de aventura quando a extração falha.

---

## Critérios de aceite

- [ ] Existe um caso de eval que roda com ledger vazio e produz números comparáveis para A, B e C.
- [ ] A variante escolhida está implementada, e a escolha está registrada no documento com o número que a sustenta.
- [ ] Se a variante for B: o bloco é emitido em todo turno, e `dm-system.test.ts:284` foi reescrito para afirmar o novo contrato (não deletado).
- [ ] Se a variante for C: o texto renderizado da camada 2 mudou de propósito e o `PROMPT-ANCHORS.md` foi atualizado, já que assertivas ancoradas nessa prosa vão mexer.
- [ ] Se nenhuma variante se distinguir do controle: nada muda no código, e a *Questão #2* da US-84 é fechada apontando para o resultado.
- [ ] `pnpm test` verde. `pnpm eval` verde.

---

## Notas de implementação

- **Onde o eval vive:** `evals/cases/`, no padrão dos demais. **Armadilha conhecida (US-36):** importar `ai` direto de um arquivo em `evals/cases/` quebra — a geração vive no pacote, em `packages/ai-engine/src/narration-gen.ts`, e o caso importa de `@ai-dm/ai-engine`.
- **A API roda `packages/ai-engine/dist`.** Editar `src` sem `pnpm --filter @ai-dm/ai-engine build` não tem efeito nenhum em teste manual.
- **Cenário do eval:** aventura recém-criada, `entities: []`, cena preenchida (para isolar a variável — só a ausência do bloco de entidades muda entre os braços).
- **Para a variante B, o texto da linha vazia importa.** "(vazio)" seco convida o modelo a comentar; algo que reafirme a ação (`registre com recordEntity`) transforma a ausência em instrução. Vale testar as duas redações se o braço B ganhar por margem estreita.
- **Não mexer no bloco por dentro.** Qualquer variante altera só a condição de emissão ou a qualificação da citação; o corpo do bloco (knowledge gates da US-75) fica byte a byte igual.

---

## Questões em aberto

1. **Quantas repetições o eval precisa para distinguir os braços?** A [US-36](./US-36-eval-de-qualidade-da-narracao.md) já tem agregação por repetições (`aggregateReps`); a pergunta é se o efeito aqui é grande o bastante para sair do ruído do juiz com o número de reps de hoje, ou se este caso precisa de mais.
2. **A ausência do bloco tem efeito mensurável, afinal?** Cenário provável: o modelo simplesmente ignora a referência órfã e nada muda. Nesse caso o resultado da story é o registro da medição — e a Questão #2 da US-84 morre com resposta em vez de morrer por esquecimento.
3. **Vale um quarto braço que emite o bloco vazio SEM a linha explicativa** (só o cabeçalho)? Isolaria "o cabeçalho existir" de "o Mestre saber que está vazio". Só entra se B e C empatarem.

---

## Referências no código

- `packages/ai-engine/src/prompts/dm-system.ts` — `:314` e `:349` (as citações incondicionais), `:428-440` (a emissão condicional).
- `packages/ai-engine/src/entities.ts` — `:74`: `if (!entities || entities.length === 0) return ''`, a origem do bloco ausente.
- `apps/api/src/adventure/adventure.service.ts` — `:130-135`: a semeadura best-effort que torna o ledger vazio um estado normal.
- `packages/ai-engine/src/prompts/dm-system.test.ts` — `:272` e `:284`: os testes do lado emissor; o `:284` é o que a variante B contradiz.
- `evals/cases/us-36-qualidade-narracao.ts` — o padrão de eval com juiz a ser reaproveitado.
- `evals/PROMPT-ANCHORS.md` — o registro de assertivas ancoradas em prosa do prompt; relevante se a variante C vencer.
