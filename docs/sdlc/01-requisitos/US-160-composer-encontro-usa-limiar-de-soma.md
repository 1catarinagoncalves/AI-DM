# US-160 — Composer de encontro usa o limiar de soma, não só o teto de monstro único

**Épico:** 3 — Narração e mecânica
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** [US-152](./US-152-statblocks-papel-orcamento.md) (`composeEncounterRoles`, ✅ implementada — o orçamento que esta story corrige) · [US-159](./US-159-orcamento-de-encontro-lgmrd.md) (`encounterDeadlyThreshold`/`singleMonsterCrCap`, ✅ implementada, fórmulas inalteradas)
**Relacionado:** [US-150](./US-150-gate-antes-de-persistir-aventura-gerada.md) (consumidor — verificação 3 do gate rejeitava sistematicamente todo encontro composto antes desta correção)
**Criada em:** 2026-08-17

---

## História

> **Como** mantenedora,
> **quero** que `composeEncounterRoles` empacote monstros contra `encounterDeadlyThreshold` (soma de CR) em vez de `singleMonsterCrCap` (teto de monstro único),
> **para que** a verificação 3 do gate ([US-150](./US-150-gate-antes-de-persistir-aventura-gerada.md)) não rejeite todo encontro gerado pra personagem solo de nível 1–4 — o público inteiro da fase 1.

---

## Contexto e motivação

### O problema observado

Ao planejar a verificação 3 do gate (US-150) contra a implementação real da US-152, os números não fecham. `composeEncounterRoles(level)` ([monster-roles.ts:35](../../../apps/api/src/adventure-generation/monster-roles.ts)) empacota papéis até `singleMonsterCrCap(level)`. Para nível 1: `singleMonsterCrCap(1) = 1`, `encounterDeadlyThreshold(1) = 0`. O composer produz `[Soldier, Minion, Minion, Minion]`, soma de CR `0.875`. A verificação 3 da US-150 falha um encontro quando a soma **excede** (`>`) `encounterDeadlyThreshold` — `0.875 > 0` é verdadeiro, então esse encontro falha o gate. Isso vale pra **todo** encontro que o composer produz em nível 1–4: `singleMonsterCrCap` é estruturalmente maior que `encounterDeadlyThreshold` em qualquer nível (nível 5: teto 7.5 vs limiar 2; nível 12: teto 18 vs limiar 6), então empacotar contra o teto sempre estoura o limiar de soma. Como `composeEncounterRoles` é função pura de `level` (sem aleatoriedade), reseed (`seed + 1`) não muda o resultado — o gate esgotaria o teto de tentativas sempre, pra sempre, pra qualquer personagem de nível 1–4.

### Por que a solução atual não basta

O comentário do próprio `composeEncounterRoles` ([monster-roles.ts:26-28](../../../apps/api/src/adventure-generation/monster-roles.ts)) já registrava a tensão e escolheu o lado errado pro gate: usa `singleMonsterCrCap` "não o `encounterDeadlyThreshold` de soma de grupo: aquele já nasce 0 até nível 3 e não sobra composição alguma pra caber nele". A frase é só meio verdadeira — `encounterDeadlyThreshold` só é `0` em nível 1–3; em nível 4 já vale `1`, e cabe composição não vazia. `monster-roles.test.ts` confirma o desalinhamento: nenhum teste ali compara contra `encounterDeadlyThreshold`, só contra `singleMonsterCrCap` — a US-152 nunca validou contra o limiar que a US-150 realmente cobra.

### A proposta

Trocar o orçamento do loop guloso de `singleMonsterCrCap(level)` para `encounterDeadlyThreshold(level)`. Como o segundo é sempre menor que o primeiro em qualquer nível, empacotar sob ele já garante o teto de monstro único de graça — nenhuma checagem dupla necessária. Em nível 1–3, `encounterDeadlyThreshold = 0` e o composer devolve array vazio: **resultado matematicamente correto do LGMRD**, não um bug a disfarçar — o texto-fonte já registra (US-159, nota de implementação) que o benchmark é "alarme sensível, não teto folgado" nesses níveis.

---

## Escopo

### Dentro do escopo

- `composeEncounterRoles` usa `encounterDeadlyThreshold(level)` como orçamento do loop guloso, no lugar de `singleMonsterCrCap(level)`.
- Nível 1–3 (`encounterDeadlyThreshold = 0`): a função devolve array vazio — comportamento esperado, coberto por teste explícito, não silenciado.
- Nível 4+: a função continua devolvendo composição não vazia, agora com soma estritamente menor que `encounterDeadlyThreshold(level)`.
- `singleMonsterCrCap` deixa de ser lido dentro de `composeEncounterRoles` (o novo orçamento já é sempre mais apertado) — a garantia "nenhum papel individual alcança o teto de monstro único" vira consequência matemática, testada por regressão, não checagem de código nova.
- Atualizar o comentário de `composeEncounterRoles` (linhas 23-33) que hoje justifica a escolha antiga — o raciocínio se inverte.
- Reescrever `monster-roles.test.ts`: os testes que hoje comparam a composição contra `singleMonsterCrCap` como orçamento (linhas 21-32) passam a comparar contra `encounterDeadlyThreshold`; adicionar caso de array vazio pra nível 1–3.

### Fora do escopo

- **A verificação do gate em si** — é [US-150](./US-150-gate-antes-de-persistir-aventura-gerada.md); esta story só corrige o dado que a verificação 3 vai consumir.
- **Reabrir as fórmulas de `encounterDeadlyThreshold`/`singleMonsterCrCap`** — [US-159](./US-159-orcamento-de-encontro-lgmrd.md) permanece intacta, texto-fonte do LGMRD sem alteração.
- **Decidir se encontro vazio (nível 1–3) é aceitável narrativamente** — se o motor deve pular a seção de combate inteira ou se o produto quer barrar geração de aventura abaixo de nível 4. Produto, não mecânica; ver *Questões em aberto*.
- **Alterar critérios de aceite já marcados da US-152** — story fechada; esta é uma correção de acompanhamento, registrada como story própria, não uma reabertura retroativa.

---

## Modelo de dados proposto

Sem schema novo — mesma decisão de forma das stories irmãs (US-152/US-159). Só o orçamento interno de `composeEncounterRoles` muda; o shape de `MonsterRole[]`/`AdventureNpc[]` que ela devolve é o mesmo.

---

## Critérios de aceite

- [x] `composeEncounterRoles(level)` empacota contra `encounterDeadlyThreshold(level)`, nunca mais contra `singleMonsterCrCap(level)`.
- [x] Nível 1, 2 e 3: `composeEncounterRoles` devolve array vazio.
- [x] Nível 4 e acima: `composeEncounterRoles` devolve array não vazio, com `totalCr(roles)` estritamente menor que `encounterDeadlyThreshold(level)`.
- [x] Para todo nível testado, nenhum papel individual da composição tem CR que alcança `singleMonsterCrCap(level)` — verificado por teste de regressão, não por checagem nova em código de produção.
- [x] `monster-roles.test.ts` não compara mais a composição contra `singleMonsterCrCap` como orçamento; compara contra `encounterDeadlyThreshold`.
- [x] `pnpm typecheck` e testes do módulo passam.
- [x] `pnpm dead` (knip) não acusa import morto de `singleMonsterCrCap` em `monster-roles.ts`, caso o import saia do arquivo de produção.
- [x] **Eval / teste de regressão:** fixture nível 1 → array vazio; fixture nível 4 → não vazio, soma `< 1`; fixture nível 5 → soma `< 2`; fixture nível 8 → nenhum papel individual com CR `>= singleMonsterCrCap(8)`.

---

## Notas de implementação

- **Arquivo principal:** [`apps/api/src/adventure-generation/monster-roles.ts`](../../../apps/api/src/adventure-generation/monster-roles.ts) — troca de uma linha (`composeEncounterRoles`, hoje `const budget = singleMonsterCrCap(level)`), mais o comentário acima que justifica a escolha antiga.

### Diff pronto (referência de implementação, TDD: aplicar o teste primeiro)

`monster-roles.test.ts` — trocar o describe `composeEncounterRoles (US-152)` por:

```ts
import { encounterDeadlyThreshold, singleMonsterCrCap } from './lazy-encounter-benchmark'
// ...

describe('composeEncounterRoles (US-152/US-160)', () => {
  it('nível 1 nunca recebe um Brute sozinho — CR 2 já estoura o teto de monstro único (1)', () => {
    const roles = composeEncounterRoles(1)
    expect(roles).not.toEqual(['Brute'])
    expect(roles.filter((r) => r === 'Brute')).toHaveLength(0)
  })

  it('nível 1, 2 e 3 devolvem array vazio — encounterDeadlyThreshold é 0 nesses níveis, resultado correto do LGMRD, não bug', () => {
    for (const level of [1, 2, 3]) {
      expect(composeEncounterRoles(level)).toEqual([])
    }
  })

  it('nível 4+ devolve composição não vazia com soma estritamente menor que encounterDeadlyThreshold', () => {
    for (const level of [4, 5, 8, 12]) {
      const roles = composeEncounterRoles(level)
      expect(roles.length).toBeGreaterThan(0)
      expect(totalCr(roles)).toBeLessThan(encounterDeadlyThreshold(level))
    }
  })

  it('empacotar sob encounterDeadlyThreshold nunca alcança o teto de monstro único (regressão)', () => {
    for (const level of [4, 5, 8, 12]) {
      const roles = composeEncounterRoles(level)
      expect(totalCr(roles)).toBeLessThan(singleMonsterCrCap(level))
    }
  })

  it('não multiplica por tamanho de grupo — mesmo nível produz sempre a mesma composição (determinístico)', () => {
    expect(composeEncounterRoles(5)).toEqual(composeEncounterRoles(5))
  })
})
```

`monster-roles.ts` — trocar o import e o corpo de `composeEncounterRoles`:

```ts
import { encounterDeadlyThreshold } from './lazy-encounter-benchmark' // era: singleMonsterCrCap

export function composeEncounterRoles(level: number): MonsterRole[] {
  const budget = encounterDeadlyThreshold(level) // era: singleMonsterCrCap(level)
  const roles: MonsterRole[] = []
  let sum = 0
  // resto do loop guloso não muda
```

Rodar depois: `pnpm --filter api test -- monster-roles` e `pnpm typecheck`.
- **`singleMonsterCrCap` sai do caminho de produção de `composeEncounterRoles`.** Se não sobrar nenhum outro uso em `monster-roles.ts`, o import deve migrar pra `monster-roles.test.ts` (só a comparação de regressão o usa) — evita import morto sob o gate do US-89 (`pnpm dead`).
- **`buildEncounterNpcs` não muda** — só o tamanho/composição do array `roles[]` de entrada varia (pode chegar vazio agora, o que já é um caso válido de `roles.map(...)` devolvendo `[]`).
- **Nenhum caller liga `composeEncounterRoles`/`buildEncounterNpcs` num encontro real ainda** (nem a US-152 nem esta story mudam isso) — a troca é isolada ao módulo, sem efeito em wiring de geração.
- **Prova por que a checagem dupla vira redundante:** `encounterDeadlyThreshold(L) < singleMonsterCrCap(L)` pra todo `L`, nas duas faixas da fórmula (`L<5`: `floor(L/4) < L`; `L>=5`: `floor(L/2) < 1.5L`) — empacotar sob o primeiro nunca permite ultrapassar o segundo.

---

## Questões em aberto

1. ~~Encontro vazio em nível 1–3: o motor pula a seção de encontro da aventura inteira nesses casos, ou o produto prefere barrar geração de aventura pra personagem abaixo de nível 4?~~ **Resolvido por [US-161](./US-161-jogador-escolhe-nivel-de-desafio-do-encontro.md): nenhum dos dois.** Nem pular a seção nem barrar geração — jogador escolhe, por aventura gerada, entre "modo aventura" (`encounterDeadlyThreshold`, pode zerar em nível 1–3, é o comportamento desta story) e "modo desafio" (`singleMonsterCrCap`, sempre não vazio). Array vazio continua sendo a saída correta do modo aventura nesses níveis — a US-161 não desfaz isso, só dá ao jogador uma segunda opção.
2. Se algum dia "todo personagem precisa de ao menos um encontro" virar requisito duro (o LGMRD "Eight Steps" nominalmente inclui um), isso reabre discussão sobre a fórmula em si (US-159) — hipótese não confirmada, não tratar como pendência real agora. (US-161 já cobre o caso prático — jogador que quer combate garantido escolhe "modo desafio" — sem precisar reabrir a fórmula.)

---

## Referências no código

- [`apps/api/src/adventure-generation/monster-roles.ts`](../../../apps/api/src/adventure-generation/monster-roles.ts) — `composeEncounterRoles`, a função corrigida por esta story.
- [`apps/api/src/adventure-generation/monster-roles.test.ts`](../../../apps/api/src/adventure-generation/monster-roles.test.ts) — testes hoje calibrados contra o orçamento errado.
- [`apps/api/src/adventure-generation/lazy-encounter-benchmark.ts`](../../../apps/api/src/adventure-generation/lazy-encounter-benchmark.ts) — `encounterDeadlyThreshold`/`singleMonsterCrCap`, fórmulas fonte, inalteradas por esta story.
- [US-150](./US-150-gate-antes-de-persistir-aventura-gerada.md) — verificação 3 do gate, o consumidor que expôs o problema.
- [US-152](./US-152-statblocks-papel-orcamento.md) — story original do composer, cujo orçamento esta story corrige.
- [US-159](./US-159-orcamento-de-encontro-lgmrd.md) — origem das duas fórmulas, texto-fonte do LGMRD.
