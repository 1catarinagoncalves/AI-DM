# US-146 — Seed determinístico do motor de aventuras

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** nenhuma
**Relacionado:** [Backlog — Motor de geração de aventuras one-shot](./backlog-motor-de-geracao-de-aventuras.md) (GEN-3, bloqueia GEN-4) · [US-47](./US-47-ingestao-srd-como-dado.md) (mesma propriedade de escrita determinística exigida dos artefatos do SRD) · [US-29](./US-29-saneamento-de-rolagens-ficticias.md) (rolagem nunca inventada pelo modelo — o mesmo princípio aplicado ao sorteio do motor)
**Criada em:** 2026-08-15

---

## História

> **Como** mantenedora,
> **quero** que toda rolagem do motor de geração de aventuras consuma um gerador de números pseudo-aleatórios derivado de `Character.id` + `Adventure.order`, nunca `Math.random`,
> **para que** a mesma ficha regenere a mesma aventura, a eval possa pinar um seed, e um bug relatado possa ser rerrodado byte a byte igual.

---

## Contexto e motivação

### O problema observado

Nenhuma rolagem do motor de geração existe ainda — mas as stories que dependem dela (GEN-4, rolagem de tabelas do LGMRD; GEN-9, seleção de statblock por papel) precisam de uma fonte de aleatoriedade **antes** de rolar a primeira tabela. Sem um gerador determinístico definido primeiro, cada consumidor inventaria sua própria chamada a `Math.random()`, e a garantia central do motor — "a mesma ficha regenera a mesma aventura" — nasceria quebrada por construção, um consumidor de cada vez.

### Por que a solução atual não basta

O repo já tem disciplina de **rolagem real, nunca inventada pelo modelo** — a [US-29](./US-29-saneamento-de-rolagens-ficticias.md) saneia números fabricados na narração, e o [DiceService](../../../apps/api/src/game/dice.service.ts) resolve fórmulas de dado server-side. Mas essa disciplina cobre a rolagem **de jogo** (o jogador testando uma perícia); ela não toca no sorteio de **geração de conteúdo** (qual local, qual monumento, qual complicação), que é uma categoria nova de aleatoriedade que o repo nunca precisou antes. Sem um gerador seedado dedicado a essa categoria, o caminho de menor esforço é `Math.random()` disperso, que não reproduz nada.

### A proposta

Uma função `deriveAdventureSeed(characterId, order)` que combina os dois em um `seed` numérico estável, e um gerador pseudo-aleatório seedado (PRNG determinístico, ex. mulberry32 ou xorshift — sem dependência nova, função pura) que todo consumidor do motor usa para qualquer sorteio. É o único empréstimo real do OneShotsmith citado no backlog: separa "gerador" de "roleta".

---

## Escopo

### Dentro do escopo

- **`deriveAdventureSeed(characterId: string, order: number): number`** — combina os dois em um seed estável (ex. hash simples dos dois valores concatenados). Determinístico: mesma entrada, mesma saída, sempre.
- **`createSeededRandom(seed: number): () => number`** — PRNG puro (sem dependência nova; um algoritmo de poucas linhas como mulberry32 é suficiente e já é padrão de mercado para este uso), devolvendo uma função que gera floats em `[0, 1)` de forma determinística e reproduzível a partir do seed.
- **Local:** `packages/shared/src/adventure-seed.ts` (ou `packages/ai-engine`, a decidir pela camada que consumir primeiro — ver *Questões em aberto*), exportado para GEN-4 e GEN-9 importarem.
- **Teste de determinismo:** o mesmo par `(characterId, order)` produz a mesma sequência de números **byte a byte** em duas execuções — mesma propriedade de escrita determinística que a [US-47](./US-47-ingestao-srd-como-dado.md) já exige dos artefatos do SRD (regenerar o artefato duas vezes produz o mesmo arquivo).
- **Nenhuma rolagem do motor consome `Math.random`** — critério de aceite verificável por grep/lint no código que a GEN-4 e a GEN-9 escreverem depois (esta story só entrega o gerador; a garantia de uso exclusivo é policiada pelas stories consumidoras, mas o contrato nasce aqui).

### Fora do escopo

- **O consumo do seed** — qual tabela rola em qual ordem é [GEN-4](./US-147-rolagem-registro-conteudo.md); a seleção de statblock é [GEN-9](./US-152-statblocks-papel-orcamento.md). Esta story só entrega a função geradora.
- **Persistir o seed no banco.** Decidido pela [US-143](./US-143-adr-aventura-como-dado-gerado.md) (ADR de GEN-0) — se a recomendação de "gravar os dois" for aceita, a coluna que guarda o seed é escopo daquela decisão, aplicada onde a persistência for implementada (GEN-1/US-144 ou a própria criação da aventura).
- **Reseed em caso de falha do gate** (`seed + 1`, GEN-7) — a mecânica de incrementar o seed e tentar de novo é da story do gate; esta story só garante que `seed + 1` produz uma sequência **diferente e igualmente determinística**.
- **"Aleatório" como opção do jogador** (GEN-13) — aquele conceito é sobre o jogador escolher não fixar `tone`/`setting`/`areaType`; o sorteio subjacente, quando o jogador não escolhe, ainda passa por este mesmo seed (consequência do backlog: *"aleatório" continua determinístico*).

---

## Modelo de dados proposto

> Sem schema Zod, sem persistência nova — função pura.

```ts
// packages/shared/src/adventure-seed.ts
export function deriveAdventureSeed(characterId: string, order: number): number { /* ... */ }
export function createSeededRandom(seed: number): () => number { /* ... */ }
```

| Campo | Tipo | Descrição |
|---|---|---|
| `deriveAdventureSeed` | função | Combina `Character.id` (string) + `Adventure.order` (int) num seed numérico estável. |
| `createSeededRandom` | função | PRNG puro; cada chamada da função devolvida avança o estado internamente e devolve um float `[0, 1)`. |

**Persistência:** nenhuma nesta story — a decisão de gravar o seed (ou recomputá-lo sempre de `characterId + order`) é da [US-143](./US-143-adr-aventura-como-dado-gerado.md).

---

## Critérios de aceite

- [ ] `deriveAdventureSeed(characterId, order)` é determinística: mesma entrada, mesma saída, em chamadas repetidas e entre execuções do processo.
- [ ] `createSeededRandom(seed)` devolve uma função geradora cuja sequência completa (N chamadas) é **byte a byte idêntica** entre duas instâncias criadas com o mesmo `seed`.
- [ ] Seeds diferentes (`order` diferente, ou `characterId` diferente) produzem sequências diferentes — sem colisão trivial entre `order: 1` e `order: 2` do mesmo personagem.
- [ ] `seed + 1` (o incremento que a GEN-7 usa para reseed) produz uma sequência distinta da original, também determinística.
- [ ] Nenhuma chamada a `Math.random()` existe no módulo — grep confirma.
- [ ] `pnpm typecheck` e `pnpm test --filter @ai-dm/shared` (ou o pacote escolhido) passam.
- [ ] **Eval / teste de regressão:** teste que gera 100 números com `createSeededRandom(42)`, salva o array esperado como fixture, e falha se uma mudança futura no algoritmo alterar a sequência sem atualizar a fixture — protege contra uma refatoração silenciosa quebrar a reprodutibilidade que a eval (GEN-11) e o playtest manual (GEN-7) dependem.

---

## Notas de implementação

- **PRNG sem dependência nova.** mulberry32 é ~5 linhas, sem import, e é o algoritmo mais citado para este caso de uso (seed determinístico, qualidade suficiente para geração de conteúdo, não para criptografia). Evita abrir uma dependência nova só para isto (regra do projeto: não adicionar dependência sem verificar equivalente).
- **`deriveAdventureSeed` não precisa ser criptograficamente forte** — só estável e sem colisão óbvia entre personagens/ordens vizinhas. Um hash simples (ex. FNV-1a sobre a string `${characterId}:${order}`) basta.
- **Onde este módulo mora** decide quem primeiro precisa dele: se GEN-4 roda no Game Server (`apps/api`) e GEN-9 também, o módulo pode viver em `@ai-dm/shared` (consumido por ambos sem duplicar) — mesma lógica de por que `WorldEntity` mora lá.

---

## Questões em aberto

1. `@ai-dm/shared` ou `@ai-dm/ai-engine`? O motor de geração ainda não tem pacote definido — se GEN-4/GEN-9 rodam inteiramente no Game Server (`apps/api`, "roda no Game Server, pelo mesmo argumento dos dados: sorteio que o modelo faz não é sorteio" — texto do backlog), `@ai-dm/shared` é o lugar natural (mesmo pacote de `WorldEntity`, sem acoplar a `ai-engine`, que é sobre prompts).

---

## Referências no código

- [Backlog — Motor de geração de aventuras one-shot §GEN-3](./backlog-motor-de-geracao-de-aventuras.md) — texto de origem e a seção *O desenho: três camadas* (determinístico no Game Server).
- [US-47](./US-47-ingestao-srd-como-dado.md) — escrita determinística de artefato, mesma propriedade exigida aqui para a sequência do PRNG.
- [apps/api/src/game/dice.service.ts](../../../apps/api/src/game/dice.service.ts) — `DiceService`, a rolagem de jogo existente; categoria vizinha e não tocada por esta story (rolagem de jogo ≠ sorteio de geração de conteúdo).
- [US-29](./US-29-saneamento-de-rolagens-ficticias.md) — a disciplina de "número real, nunca inventado", aplicada aqui ao sorteio do motor em vez de à rolagem do jogador.
