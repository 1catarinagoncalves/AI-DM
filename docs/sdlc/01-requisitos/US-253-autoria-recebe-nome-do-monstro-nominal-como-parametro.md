# US-253 — Autoria recebe nome do monstro nominal como parâmetro, não escolhido depois da ficção

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
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

`counts.encounters` (hoje `3`, [adventure.service.ts:203](../../../apps/api/src/adventure/adventure.service.ts)) já é fixo ANTES da autoria escolher qual posição vira `combat` — por isso o elenco nominal pode (e deve) ser calculado por POSIÇÃO de encontro (slot 0, 1, 2, ...), não uma lista única repetida pra qualquer combate da aventura. Sem isso, dois encontros `combat` com a mesma contagem de inimigo cairiam no mesmo papel por posição (`assignCombatRoles`/`ROLES_BY_IMPACT` cicla igual pra qualquer chamada com o mesmo `count`) e `chooseNominalCreature` — pura, mesma entrada sempre mesma saída — devolveria o MESMO nome pros dois, contradizendo o exemplar de referência (Encontro 1 = Orc Bárbaro, Encontro 2 = Esqueleto, [cripta-do-veu-silencioso.md:52,70](../../../evals/exemplars/cripta-do-veu-silencioso.md)). Ver *Modelo de dados proposto* e *Notas de implementação* pro índice exato.

---

## Escopo

### Dentro do escopo

- Depois que [US-250](./US-250-autoria-inventa-numero-de-inimigos-sem-orcamento-de-cr.md) calcula `combatBudget` (contagem máxima de inimigos + viabilidade), resolver os papéis prováveis (mesma régua de `assignCombatRoles`/`ROLES_BY_IMPACT`, aplicada sobre a contagem MÁXIMA, não sobre uma contagem que a ficção ainda não escreveu) e escolher a criatura nominal de cada posição (US-252) — **uma vez POR SLOT de encontro** (`counts.encounters`, hoje 3), não uma vez só pra aventura inteira, pra que dois encontros `combat` na mesma aventura não recebam o mesmo elenco.
- `buildAuthoringPrompt` ganha os nomes escolhidos como restrição, um trecho por posição de encontro — ex.: "Se o Encontro 1 for de combate, os inimigos são: 1 Ogre (mais forte, lidera) + 2 Goblin (mais fracos, apoio). Se o Encontro 2 for de combate, os inimigos são: ..." — instruindo a autoria a narrar ESSAS criaturas pra CADA posição, não inventar outras, e podendo ADAPTAR/traduzir o nome pro idioma-alvo (mesmo tratamento de `questSeed`, [ai.service.ts:210](../../../apps/api/src/ai/ai.service.ts)) sem inventar espécie diferente.
- PASSO 2 (US-233) deixa de PRECISAR escolher `combatRole`/`nominalCreature` do zero — passa a CONFIRMAR que a ficção usou os inimigos já dados (ou, no mínimo, continua funcionando como fallback se a autoria desobedecer).
- Testes de regressão: prompt de autoria contém os nomes esperados pro orçamento calculado; fixture onde a autoria "obedece" produz `AdventureNpc[]` cujo `nominalCreature` bate com o que foi prometido no prompt.
- `pnpm eval` roda e passa.

### Fora do escopo

- **Garantir que o modelo SEMPRE obedece o nome sugerido** — LLM não é determinístico; desvio é coberto pelo PASSO 2/gate como fallback, não por esta story.
- **Tradução automatizada do nome da criatura pro pt-BR** — delegado ao prompt (mesmo padrão `questSeed`), não um catálogo traduzido novo.
- **Reserva de CR pro antagonista** (`chooseAntagonistRole`/`reservedCr`, US-188) — não existe mais: US-250 (*Questão em aberto* #3) confirmou que o Final não tem tratamento especial, e US-254 removeu o mecanismo como código morto. O Final usa o mesmo `combatCast` de qualquer outro `combat`, sem antagonista único a descontar.
- **Multiplayer / grupo > 1** — fora da fase 1 (mesma exclusão de todas as stories deste eixo).

---

## Modelo de dados proposto

> Sem schema Zod novo além do que a US-252 já propôs (`AdventureNpcSchema.nominalCreature?`). Só `buildAuthoringPrompt` ganha mais um parâmetro de texto — mesmo padrão de `worldLines`/`questSeedLines`.

```ts
// apps/api/src/ai/ai.service.ts — buildAuthoringPrompt ganha este parâmetro (soma o combatBudget da US-250)
// Índice externo = posição do ENCONTRO (slot 0..counts.encounters-1), não da aventura inteira —
// cada posição tem seu próprio elenco, pra dois combates não saírem com o mesmo monstro.
combatCast?: Array<Array<{ nominalCreature: string; strongerThanRest: boolean }>>
```

---

## Critérios de aceite

- [x] Quando `combatBudget.viable` (US-250) é verdadeiro, o prompt de autoria inclui os nomes das criaturas nominais escolhidas pra esse encontro, com indicação de qual é mais forte (lidera) e quais são mais fracas (apoio).
- [x] Quando `combatBudget.viable` é falso (orçamento 0), nenhum nome de criatura é oferecido (consistente com a proibição de `type: 'combat'` que a US-250 já instrui).
- [x] A escolha de criatura reusa a função da US-252 sem duplicar lógica — mesmo CR, mesmo bestiário.
- [x] Com `combatBudget.viable` e pelo menos 2 slots de encontro (`counts.encounters` > 1), o elenco sugerido pra posição 0 difere do elenco da posição 1 quando o bestiário tem mais de um candidato no CR/papel em questão (índice varia por posição de encontro, não só por posição do inimigo dentro do encontro).
- [x] `AdventureNpc.nominalCreature`, quando a autoria seguiu a sugestão, bate com o nome oferecido no prompt OU é da mesma família (*Questão em aberto* #2, fechada: mesmo nome-base, ex. "Goblin Batedor" pra sugestão "Goblin") — testável só no caminho de "autoria obediente"; desobediência de `type`/CR é o caminho de fallback, não falha desta story.
- [x] PASSO 2 (US-233) continua rodando sem quebrar quando a ficção já veio com o inimigo certo — vira no-op na maioria dos casos (mesmo critério que a US-250 já estabeleceu pro orçamento).
- [x] `pnpm typecheck`, `pnpm test` e `pnpm eval` passam.
- [x] **Eval / teste de regressão:** perfil pinado com orçamento viável → prompt de autoria contém os nomes esperados; perfil pinado com orçamento 0 → prompt não sugere nenhuma criatura de combate.

---

## Notas de implementação

- **Depende de fato de US-250 estar implementada** — sem `combatBudget`/`maxHostileCount` calculado antes da autoria, não há "quantos slots" pra escolher nome; esta story não pode adiantar-se à US-250.
- **Reusar a função de escolha de criatura da US-252 tal como está** — só muda O MOMENTO em que é chamada (antes da autoria, com uma contagem MÁXIMA hipotética, em vez de depois, com a contagem real que a ficção escreveu).
- **Índice de `chooseNominalCreature` varia por posição de encontro** — `chooseNominalCreature(role, undefined, BESTIARY, slotIndex * combatBudget.maxHostileCount + i)`, onde `slotIndex` é a posição do encontro (0..`counts.encounters`-1) e `i` a posição do inimigo dentro do papel-por-posição daquele slot (mesmo `i` que hoje reseta a cada encontro, [adventure.service.ts:345](../../../apps/api/src/adventure/adventure.service.ts)). Sem o `slotIndex * maxHostileCount`, dois encontros combat com a mesma contagem de inimigo caem no mesmo `role` por posição e `chooseNominalCreature` — pura — devolve o MESMO nome pros dois (bug latente já presente no PASSO 2 de hoje, só invisível porque nominalCreature ainda não é lido por ninguém). PASSO 2 (fallback) precisa usar a MESMA fórmula, senão o nome que confirma/cai em fallback depois da ficção diverge do nome que foi prometido no prompt pra aquele slot.
- **Limite da correção:** se o bestiário só tiver 1 candidato pro CR/tipo daquele papel, `index % candidates.length` sempre cai no mesmo, e os dois slots recebem o mesmo nome mesmo com `slotIndex` diferente — aceitável (bestiário raso nesse CR, não bug desta story).
- **Força relativa no texto do prompt:** mesmo cuidado que a US-250 já registra (*Questões em aberto* #2) — calibrar redação pra soar como direção de cena, não como fórmula mecânica ("mais forte"/"lidera", nunca "CR 2").
- **Desvio do enunciado original — `buildCombatCast` usa `assignBudgetedCombatRoles`, não `assignCombatRoles` cru:** a nota acima (índice por slot) descrevia a régua como `assignCombatRoles`/`ROLES_BY_IMPACT` puro. Medido com `tsx` antes de fechar a story: `composeEncounterRoles` (greedy, decide `maxHostileCount`) e um ciclo reto Brute→Soldier→Minion do MESMO tamanho (`assignCombatRoles`) NÃO somam o mesmo CR — em nível 4+ (`adventure`), o ciclo reto estoura o orçamento em 1-2 posições que o PASSO 2 (`assignBudgetedCombatRoles`) descarta depois. Usar `assignCombatRoles` cru no `buildCombatCast` prometeria nome pra posição que o PASSO 2 confirma como figurante — quebra o critério de aceite #1 e #5. Fix: `buildCombatCast` chama `assignBudgetedCombatRoles(maxHostileCount, level, challenge)` — MESMA função que o PASSO 2 já usa — e só inclui no elenco as posições com role definido (`flatMap`, índice bruto preservado pro `chooseNominalCreature`). Checado que isso não zera o elenco em nenhum nível 1-20 nos dois modos (`challenge`) — sempre sobra pelo menos 1 papel afordável quando `viable` é `true`.
- ai-engine roda de `dist` — `pnpm --filter @ai-dm/ai-engine build` depois de editar `src`, se a instrução entrar em prompt compartilhado.

---

## Questões em aberto

1. ~~Herdada da US-250 (*Questão em aberto* #3): o Final usa o mesmo `combatCast`...~~ **Já fechada** — US-250 (*Questões em aberto* #3) confirmou que o Final não tem tratamento especial: não existe mais entidade única "antagonista" desde a autoria mundo-primeiro (US-232), e US-254 (implementada) removeu `chooseAntagonistRole`/`reservedCr` como código morto. O Final usa o mesmo `combatCast` de qualquer outro `combat`, sem desconto de reserva.
2. ~~Se a autoria trocar o nome sugerido por outro da mesma "família"...~~ **Fechada em 2026-09-17, a pedido da mantenedora:** nome da mesma família conta como obediência (ex.: sugerido "Goblin", autoria escreve "Goblin Batedor" — mesmo `type`/CR, nome primo — não é desvio). PASSO 2/gate só entra como fallback pra criatura de `type`/CR diferente do sugerido, não pra variação de nome dentro da família. Teste de regressão do caminho "autoria obediente" (critério de aceite abaixo) usa comparação tolerante a família (prefixo/substring do nome-base), não igualdade estrita de string.

---

## Referências no código

- [`apps/api/src/ai/ai.service.ts:220-276`](../../../apps/api/src/ai/ai.service.ts) — `buildAuthoringPrompt`, ganha o parâmetro `combatCast`.
- [`apps/api/src/adventure/adventure.service.ts:318-332`](../../../apps/api/src/adventure/adventure.service.ts) — PASSO 2, vira confirmação/fallback em vez de escolha primária.
- [US-250](./US-250-autoria-inventa-numero-de-inimigos-sem-orcamento-de-cr.md) — `combatBudget`, o parâmetro de contagem que esta story soma com nome.
- [US-252](./US-252-papel-do-encontro-vira-monstro-nominal-nao-rotulo-generico.md) — `chooseNominalCreature`, função reusada, não reimplementada.
- [evals/exemplars/cripta-do-veu-silencioso.md](../../../evals/exemplars/cripta-do-veu-silencioso.md) — o padrão-alvo desta story: nome+nível do monstro definidos junto da criação.
