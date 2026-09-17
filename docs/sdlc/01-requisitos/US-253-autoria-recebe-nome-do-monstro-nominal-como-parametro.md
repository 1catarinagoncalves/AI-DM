# US-253 — Autoria recebe nome do monstro nominal como parâmetro, não escolhido depois da ficção

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** [US-250](./US-250-autoria-inventa-numero-de-inimigos-sem-orcamento-de-cr.md) (move o ORÇAMENTO de CR pra antes da autoria — esta story faz o mesmo movimento pro NOME do monstro; sem US-250, não existe contagem de inimigos pré-calculada pra escolher nome pra cada um) · [US-252](./US-252-papel-do-encontro-vira-monstro-nominal-nao-rotulo-generico.md) (a função de escolha de criatura nominal que esta story move de lugar no pipeline, não reimplementa)
**Relacionado:** [US-251](./US-251-bestiario-nominal-nao-existe-como-dado-do-sistema.md) (`bestiary-5e.json`) · [US-232](./US-232-schema-cresce-e-prompt-de-autoria-call-unico.md) (`buildAuthoringPrompt`/`AUTHORING_SCHEMA`, o prompt que ganha o parâmetro) · [evals/exemplars/cripta-do-veu-silencioso.md](../../../evals/exemplars/cripta-do-veu-silencioso.md) (o padrão-alvo: nome+nível do monstro já dados ANTES da prosa ser escrita)
**Criada em:** 2026-09-17 — terceira parte do pedido de bestiário nominal; fecha o padrão do exemplo de referência (`dndgenerate.md`/[open5e.com/monsters](https://open5e.com/monsters)) por completo: CR (US-250) E nome (esta story) como parâmetro de ENTRADA, nunca encaixe posterior.

---

## História

> **Como** jogadora,
> **quero** que a ficção do encontro de combate já seja escrita sobre o monstro real que vai lutar (nome, tipo, força relativa), não sobre um inimigo genérico que só ganha identidade depois,
> **para que** a narrativa e a criatura nominal nunca se contradigam (ex.: a prosa descrever "um lobo" onde a mecânica depois decide "um esqueleto").

---

## Contexto e motivação

### O problema observado

[US-252](./US-252-papel-do-encontro-vira-monstro-nominal-nao-rotulo-generico.md) resolve o nome — mas no MESMO ponto tardio do pipeline que hoje atribui `combatRole` (PASSO 2, depois que a autoria já escreveu a ficção inteira, US-233). A autoria continua livre pra descrever o inimigo do combate como quiser ("uma sombra rastejante", "um cavaleiro caído") sem saber, no momento de escrever, qual criatura nominal (US-252) vai ser efetivamente atribuída depois — o mesmo tipo de descompasso ficção/mecânica que a [US-250](./US-250-autoria-inventa-numero-de-inimigos-sem-orcamento-de-cr.md) já identificou pro CR, agora pro NOME.

### Por que a solução atual não basta

Encaixar o nome depois (US-252 sozinha) já é uma melhoria real (nome de verdade em vez de "Minion" cru), mas não fecha o padrão do exemplar de referência: lá, cada grupo de monstro é dado ANTES da prosa ("4x Orc Bárbaro nível 4") — a narrativa é escrita EM CIMA do monstro já escolhido, não o contrário.

### A proposta

Quando [US-250](./US-250-autoria-inventa-numero-de-inimigos-sem-orcamento-de-cr.md) landar (orçamento de CR vira `maxHostileCount` no prompt, ANTES da autoria escrever), esta story dá o passo seguinte: pra cada "slot" de inimigo que o orçamento permite, escolher a criatura nominal (reusando a função de [US-252](./US-252-papel-do-encontro-vira-monstro-nominal-nao-rotulo-generico.md), sem reimplementar) e incluir esse(s) nome(s) como parte da restrição do prompt de autoria (`buildAuthoringPrompt`) — a ficção do encontro `combat` passa a ser escrita sabendo, de antemão, que criatura(s) real(is) vai(ão) aparecer. `assignBudgetedCombatRoles`/PASSO 2 continuam existindo como defesa em profundidade (mesmo raciocínio da US-250), mas o caminho comum passa a ser: orçamento → criatura(s) escolhida(s) → prompt → ficção já casada.

---

## Escopo

### Dentro do escopo

- Depois que [US-250](./US-250-autoria-inventa-numero-de-inimigos-sem-orcamento-de-cr.md) calcula `combatBudget` (contagem máxima de inimigos + viabilidade), resolver os papéis prováveis (mesma régua de `assignCombatRoles`/`ROLES_BY_IMPACT`, aplicada sobre a contagem MÁXIMA, não sobre uma contagem que a ficção ainda não escreveu) e escolher a criatura nominal de cada posição (US-252).
- `buildAuthoringPrompt` ganha os nomes escolhidos como restrição — ex.: "Os inimigos deste encontro de combate são: 1 Ogre (mais forte, lidera) + 2 Goblin (mais fracos, apoio)" — instruindo a autoria a narrar ESSAS criaturas, não inventar outras, e podendo ADAPTAR/traduzir o nome pro idioma-alvo (mesmo tratamento de `questSeed`, [ai.service.ts:210](../../../apps/api/src/ai/ai.service.ts)) sem inventar espécie diferente.
- PASSO 2 (US-233) deixa de PRECISAR escolher `combatRole`/`nominalCreature` do zero — passa a CONFIRMAR que a ficção usou os inimigos já dados (ou, no mínimo, continua funcionando como fallback se a autoria desobedecer).
- Testes de regressão: prompt de autoria contém os nomes esperados pro orçamento calculado; fixture onde a autoria "obedece" produz `AdventureNpc[]` cujo `nominalCreature` bate com o que foi prometido no prompt.
- `pnpm eval` roda e passa.

### Fora do escopo

- **Garantir que o modelo SEMPRE obedece o nome sugerido** — LLM não é determinístico; desvio é coberto pelo PASSO 2/gate como fallback, não por esta story.
- **Tradução automatizada do nome da criatura pro pt-BR** — delegado ao prompt (mesmo padrão `questSeed`), não um catálogo traduzido novo.
- **Encontro Final e a reserva do antagonista** (`chooseAntagonistRole`/`reservedCr`, US-188) — herda a *Questão em aberto* #3 da US-250 (não decidida lá, não decidida aqui); tratar como capangas em volta do antagonista, cujo nome nominal segue a mesma régua.
- **Multiplayer / grupo > 1** — fora da fase 1 (mesma exclusão de todas as stories deste eixo).

---

## Modelo de dados proposto

> Sem schema Zod novo além do que a US-252 já propôs (`AdventureNpcSchema.nominalCreature?`). Só `buildAuthoringPrompt` ganha mais um parâmetro de texto — mesmo padrão de `worldLines`/`questSeedLines`.

```ts
// apps/api/src/ai/ai.service.ts — buildAuthoringPrompt ganha este parâmetro (soma o combatBudget da US-250)
combatCast?: Array<{ nominalCreature: string; strongerThanRest: boolean }>
```

---

## Critérios de aceite

- [ ] Quando `combatBudget.viable` (US-250) é verdadeiro, o prompt de autoria inclui os nomes das criaturas nominais escolhidas pra esse encontro, com indicação de qual é mais forte (lidera) e quais são mais fracas (apoio).
- [ ] Quando `combatBudget.viable` é falso (orçamento 0), nenhum nome de criatura é oferecido (consistente com a proibição de `type: 'combat'` que a US-250 já instrui).
- [ ] A escolha de criatura reusa a função da US-252 sem duplicar lógica — mesmo CR, mesmo bestiário.
- [ ] `AdventureNpc.nominalCreature`, quando a autoria seguiu a sugestão, bate com o nome oferecido no prompt (testável só no caminho de "autoria obediente"; desobediência é o caminho de fallback, não falha desta story).
- [ ] PASSO 2 (US-233) continua rodando sem quebrar quando a ficção já veio com o inimigo certo — vira no-op na maioria dos casos (mesmo critério que a US-250 já estabeleceu pro orçamento).
- [ ] `pnpm typecheck`, `pnpm test` e `pnpm eval` passam.
- [ ] **Eval / teste de regressão:** perfil pinado com orçamento viável → prompt de autoria contém os nomes esperados; perfil pinado com orçamento 0 → prompt não sugere nenhuma criatura de combate.

---

## Notas de implementação

- **Depende de fato de US-250 estar implementada** — sem `combatBudget`/`maxHostileCount` calculado antes da autoria, não há "quantos slots" pra escolher nome; esta story não pode adiantar-se à US-250.
- **Reusar a função de escolha de criatura da US-252 tal como está** — só muda O MOMENTO em que é chamada (antes da autoria, com uma contagem MÁXIMA hipotética, em vez de depois, com a contagem real que a ficção escreveu).
- **Força relativa no texto do prompt:** mesmo cuidado que a US-250 já registra (*Questões em aberto* #2) — calibrar redação pra soar como direção de cena, não como fórmula mecânica ("mais forte"/"lidera", nunca "CR 2").
- ai-engine roda de `dist` — `pnpm --filter @ai-dm/ai-engine build` depois de editar `src`, se a instrução entrar em prompt compartilhado.

---

## Questões em aberto

1. Herdada da US-250 (*Questão em aberto* #3): o Final (antagonista + capangas) usa o mesmo `combatCast` dos demais combates, ou um caso reservado que desconta o CR/nome já ocupado pelo antagonista?
2. Se a autoria trocar o nome sugerido por outro da mesma "família" (ex.: sugerido "Goblin", autoria escreve "Goblin Batedor") — isso conta como obediência (mesmo `type`/CR, nome primo) ou desvio a ser pego pelo PASSO 2? Calibrar tolerância antes de travar o teste de regressão em igualdade estrita de string.

---

## Referências no código

- [`apps/api/src/ai/ai.service.ts:220-276`](../../../apps/api/src/ai/ai.service.ts) — `buildAuthoringPrompt`, ganha o parâmetro `combatCast`.
- [`apps/api/src/adventure/adventure.service.ts:318-332`](../../../apps/api/src/adventure/adventure.service.ts) — PASSO 2, vira confirmação/fallback em vez de escolha primária.
- [US-250](./US-250-autoria-inventa-numero-de-inimigos-sem-orcamento-de-cr.md) — `combatBudget`, o parâmetro de contagem que esta story soma com nome.
- [US-252](./US-252-papel-do-encontro-vira-monstro-nominal-nao-rotulo-generico.md) — `chooseNominalCreature`, função reusada, não reimplementada.
- [evals/exemplars/cripta-do-veu-silencioso.md](../../../evals/exemplars/cripta-do-veu-silencioso.md) — o padrão-alvo desta story: nome+nível do monstro definidos junto da criação.
