# US-250 — Autoria escreve quantidade e força de inimigos sem saber o orçamento de CR do personagem

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** [US-232](./US-232-schema-cresce-e-prompt-de-autoria-call-unico.md) (`buildAuthoringPrompt`/`AUTHORING_SCHEMA`, autoria mundo-primeiro — prompt que ganha o parâmetro novo) · [US-233](./US-233-numeros-dos-encontros-passo-2-5e.md) (PASSO 2, `assignBudgetedCombatRoles` — o encaixe posterior que esta story evita acionar no caminho comum, sem removê-lo) · [US-159](./US-159-orcamento-de-encontro-lgmrd.md)/[US-160](./US-160-composer-encontro-usa-limiar-de-soma.md) (*Lazy Encounter Benchmark*, `encounterDeadlyThreshold`/`composeEncounterRoles`) · [US-161](./US-161-jogador-escolhe-nivel-de-desafio-do-encontro.md)/[US-165](./US-165-tela-escolhe-nivel-de-desafio.md) (`challenge`, dial que escolhe qual orçamento)
**Relacionado:** [US-152](./US-152-statblocks-papel-orcamento.md) (`MONSTER_ROLE_CR`, papéis Minion/Soldier/Brute — vocabulário mecânico que não muda) · [US-166](./US-166-motor-gera-multiplos-encontros.md) (`combatViable`, a salvaguarda equivalente do pipeline ANTERIOR à reescrita mundo-primeiro, que não sobreviveu à US-232) · [US-238](./US-238-eval-da-aventura-gerada-recalibrada.md) (assert "orçamento de cada encontro cabe no nível" já verifica o SINTOMA depois de gerado; esta story ataca a causa, na entrada) · [evals/exemplars/cripta-do-veu-silencioso.md](../../../evals/exemplars/cripta-do-veu-silencioso.md) (exemplar de eval onde CR/nível de cada grupo de monstro já nasce junto da criação — o padrão que esta story leva pro motor real)
**Criada em:** 2026-09-16 — a jogadora trouxe `dndgenerate.md` (mesmo conteúdo do exemplar acima, formato [DnDGenerate](https://github.com/dhorions/DnDGenerate)) perguntando por que o CR dos encontros não é parâmetro de entrada da geração, "como no exemplo", pra evitar erro de CR.

---

## História

> **Como** jogadora,
> **quero** que a quantidade e a força dos inimigos de cada encontro de combate já nasçam dentro do orçamento de CR do meu personagem,
> **para que** a aventura gerada nunca prometa uma ameaça (N inimigos narrados) que a mecânica não sustenta (alguns sem CR real, ou o encontro inteiro reprovado no gate).

---

## Contexto e motivação

### O problema observado

Desde a reescrita "mundo-primeiro" (US-232), a autoria (chamada única de LLM) escreve `encounters[].npcIndices` — inclusive para `type: 'combat'` — **sem receber orçamento de CR nenhum como entrada**. O comentário do próprio código já documenta isso: "`challenge` (dial de dificuldade) NÃO entra na autoria" ([ai.service.ts:218](../../../apps/api/src/ai/ai.service.ts)).

Só DEPOIS, em código determinístico (PASSO 2, US-233), o motor tenta casar essa contagem já fixa com papel/CR **por posição** (`assignBudgetedCombatRoles`, [monster-roles.ts:118-132](../../../apps/api/src/adventure-generation/monster-roles.ts)): cicla `Brute→Soldier→Minion` pelos inimigos que a ficção já escreveu, e quando estoura o orçamento do nível, as posições excedentes ficam **sem `combatRole`** — viram "figurante" (comentário do código, [adventure.service.ts:318-332](../../../apps/api/src/adventure/adventure.service.ts)): a narrativa continua afirmando N inimigos perigosos, mas mecanicamente só alguns têm CR de verdade.

No caso extremo — personagem nível 1-3, modo `'adventure'` — o orçamento (`encounterDeadlyThreshold`) é **sempre 0**. Ou seja: **todo** encontro `type: 'combat'` que a autoria decidir escrever nesse caso estoura por construção, sempre, garantido. Esse comportamento foi achado e paliado HOJE (bugfix "Paladina nível 3, 16/09/2026", [monster-roles.ts:106-117](../../../apps/api/src/adventure-generation/monster-roles.ts)) — mas o paliativo é aplicar `assignBudgetedCombatRoles` por cima, não impedir a autoria de prometer o combate em primeiro lugar.

### Por que a solução atual não basta

O pipeline ANTERIOR à reescrita mundo-primeiro (US-166) já tinha resolvido esse exato problema: `combatViable = composeEncounterRoles(level, challenge).length > 0` decidia, ANTES de qualquer prosa, se `combat` podia existir — nível 1-3 modo aventura nunca recebia um slot `combat`. A própria US-233 registra que essa salvaguarda **não sobreviveu** à US-232: "a autoria mundo-primeiro não tem mais o `combatViable` que evitava gerar `combat` nesses níveis — o modelo escolhe `type` livre" ([US-233, Notas de implementação](./US-233-numeros-dos-encontros-passo-2-5e.md)).

O que existe hoje é rede de segurança tardia (`assignBudgetedCombatRoles` descarta posição; o gate, quando US-234 landar, regenera on-fail) — nunca uma restrição que impede a autoria de escrever um encontro que a mecânica já sabe, de antemão, que não vai caber.

### A proposta

Calcular o orçamento de CR disponível (via `composeEncounterRoles(profile.level, profile.challenge)`, já existente — nenhuma fórmula nova) **antes** da chamada de autoria, e expressá-lo no prompt (`buildAuthoringPrompt`) como restrição explícita: quantos inimigos cabem num encontro de combate, e a força relativa entre eles (chefe mais forte + capangas mais fracos) — sem vazar rótulo técnico (`Minion`/`Soldier`/`Brute`) pra prosa. Quando o orçamento é 0, a instrução proíbe `type: 'combat'` na aventura inteira — reintroduzindo o efeito do antigo `combatViable`, mas como restrição de prompt (mesmo veículo que `worldLines`/`questSeedLines` já usam), não como pipeline separado.

É exatamente o padrão do exemplar de referência que a jogadora trouxe e que já é âncora de eval no repo: cada grupo de monstro já vem com nível/CR definido **junto** da criação ("4x Orc Bárbaro nível 4", "6x Esqueleto Guardião nível 2") — nunca um número encaixado por cima depois que a prosa já decidiu quantos inimigos existem.

---

## Escopo

### Dentro do escopo

- Calcular o orçamento de CR (via `composeEncounterRoles(profile.level, profile.challenge)`, `monster-roles.ts`) **antes** de montar o prompt de autoria — mesmo ponto do pipeline onde `profile`/`level`/`challenge` já estão disponíveis ([adventure.service.ts](../../../apps/api/src/adventure/adventure.service.ts), chamador de `buildAuthoringPrompt`).
- `buildAuthoringPrompt` ganha novo parâmetro (`combatBudget`, nome a calibrar) derivado desse orçamento: quando > 0, uma linha de restrição com a contagem MÁXIMA de inimigos por encontro `combat` (só a contagem — prosa não precisa expressar força relativa entre os inimigos, ver *Questões em aberto* #2); quando o orçamento é 0 (nível 1-3, modo `'adventure'`), instrução explícita proibindo `type: 'combat'` em qualquer encontro desta aventura.
- PASSO 2 (US-233, `assignBudgetedCombatRoles`) **continua existindo e sendo chamado** — vira rede de segurança que deve, na prática, virar no-op na maioria das gerações (a ficção já nasce dentro do orçamento), não caminho comum de descarte.
- Testes de regressão: fixture nível 1-3/modo `'adventure'` → prompt de autoria contém a proibição de `combat`; fixture nível 5+/modo `'adventure'` ou `'challenge'` → prompt contém a contagem máxima correta pro orçamento daquele nível/modo.
- `pnpm eval` roda e passa (mudança em prompt do DM Agent).

### Fora do escopo

- Nomear monstro real do bestiário SRD, ou mudar os três papéis (Minion/Soldier/Brute) — decisão da US-152, não reaberta.
- Remover `assignBudgetedCombatRoles`/PASSO 2 — permanece como defesa em profundidade (a autoria pode ainda desobedecer a restrição do prompt; LLM não é determinístico).
- Trazer o exemplar `cripta-do-veu-silencioso.md` pro prompt de produção verbatim — decisão já tomada contra isso (US-232, evita convergência de motivo); esta story só leva o PADRÃO de "CR como entrada", não o texto do exemplar.
- Multiplayer / orçamento por tamanho de grupo — fora da fase 1 (US-152).
- Vazar CR numérico ou nome técnico de papel (`Minion`/`Soldier`/`Brute`) na prosa lida pela jogadora — o saneamento da US-29 continua intocado; a instrução MECÂNICA do system prompt ([ai.service.ts:194](../../../apps/api/src/ai/ai.service.ts)) não muda.
- Reabrir US-159/160/161 (fórmula/orçamento em si) — esta story só antecipa o resultado já calculado pro prompt, não recalibra o LGMRD.

---

## Modelo de dados proposto

> Sem schema Zod novo — `AUTHORING_SCHEMA`/`AdventureEncounterSchema` não mudam. Só a assinatura de `buildAuthoringPrompt` ganha um parâmetro novo, calculado, não persistido (mesmo precedente da US-152/US-233: orçamento é valor transiente).

```ts
// apps/api/src/ai/ai.service.ts — buildAuthoringPrompt ganha este parâmetro
combatBudget: {
  maxHostileCount: number   // composeEncounterRoles(profile.level, profile.challenge).length
  viable: boolean           // maxHostileCount > 0
}
```

---

## Critérios de aceite

- [ ] `profile.level`/`profile.challenge` com orçamento > 0 → o prompt de autoria inclui uma restrição explícita com a contagem MÁXIMA de inimigos por encontro `combat`, sem número de CR nem rótulo técnico (`Minion`/`Soldier`/`Brute`) na prosa (força relativa entre inimigos não é exigida na prosa — ver *Questões em aberto* #2, resolvida).
- [ ] `profile.level` 1-3 com `profile.challenge === 'adventure'` (orçamento 0) → o prompt de autoria proíbe explicitamente `type: 'combat'` em qualquer encontro.
- [ ] `composeEncounterRoles` continua sendo a ÚNICA fonte do orçamento — nenhuma fórmula nova, nenhuma duplicação da régua LGMRD.
- [ ] PASSO 2 (`assignBudgetedCombatRoles`) permanece chamado sem alteração de assinatura — continua sendo a defesa em profundidade caso a autoria desobedeça a restrição do prompt.
- [ ] `pnpm typecheck`, `pnpm test` e `pnpm eval` passam.
- [ ] **Eval / teste de regressão:** perfil pinado nível 1-3/modo `'adventure'` → aventura gerada não contém `encounter.type === 'combat'` (queda mensurável frente ao comportamento sem esta story, onde a autoria escrevia `combat` livre e todo NPC virava figurante sem `combatRole`); perfil pinado nível 5+ → nenhum `npcIds` de encontro `combat` fica sem `combatRole` no PASSO 2 (dentro da amostra pinada — desvio isolado de obediência do modelo não é falha desta story, é o que o gate/regenerate, US-234, já cobre).

---

## Notas de implementação

- **Arquivo principal:** [`apps/api/src/ai/ai.service.ts:220-276`](../../../apps/api/src/ai/ai.service.ts) — `buildAuthoringPrompt`. Reaproveitar o mesmo padrão de `worldLines`/`questSeedLines` (linha condicional, `.filter(Boolean)`) pra montar a linha de restrição de combate.
- **Fonte do orçamento:** `composeEncounterRoles(profile.level, profile.challenge)` já existe em [`monster-roles.ts:53-76`](../../../apps/api/src/adventure-generation/monster-roles.ts) — só precisa ser chamada um passo mais cedo no `adventure.service.ts` (antes de `buildAuthoringPrompt`, não só no PASSO 2 depois).
- **Sem "força relativa" na prosa (decidido 17/09/2026):** a restrição de combate desta story é só sobre a CONTAGEM máxima de inimigos — não exige que a autoria expresse força relativa entre eles (nem qualitativa, nem CR/rótulo técnico). `assignBudgetedCombatRoles` (PASSO 2) já resolve a distribuição de papel/força por posição depois; não precisa antecipar isso na prosa. A instrução MECÂNICA do system prompt continua proibindo número (CD/HP/CA) na ficção ([ai.service.ts:194](../../../apps/api/src/ai/ai.service.ts)), inalterada.
- **Encontro Final não tem tratamento especial (decidido 17/09/2026, ver *Questões em aberto* #3):** `chooseAntagonistRole`/`reservedCr` (US-188, [monster-roles.ts:48-51](../../../apps/api/src/adventure-generation/monster-roles.ts)) não são chamados no pipeline atual — a autoria mundo-primeiro (US-232) tirou a entidade única "antagonista". `combatBudget` do Final usa o mesmo `composeEncounterRoles(profile.level, profile.challenge)` cheio de qualquer outro `combat`, sem desconto de reserva.
- **`assignBudgetedCombatRoles` não muda de assinatura** ([adventure.service.ts:325-332](../../../apps/api/src/adventure/adventure.service.ts)) — continua rodando por cima do resultado da autoria; o objetivo desta story é fazer esse passo virar no-op na prática, não removê-lo.
- ai-engine roda de `dist` — `pnpm --filter @ai-dm/ai-engine build` depois de editar `src`, se a instrução entrar em prompt compartilhado.

---

## Questões em aberto

1. ~~Múltiplos encontros `combat` na mesma aventura~~ — **Resolvido (17/09/2026):** o LGMRD (`lazy-encounter-benchmark.ts:1-13`) já é definido "para 1 personagem", por ENCONTRO — não existe orçamento agregado por aventura na fórmula-fonte, nunca existiu. `combatBudget` desta story passa o mesmo teto repetido em cada encontro `combat`, sem nivelar/dividir entre eles — mesma unidade de medida da US-152/233, não reaberta. Múltiplos `combat` "cheios" no mesmo personagem é aceitável dentro do escopo desta story; teto agregado por aventura, se um dia for desejado, é mudança na régua LGMRD em si (US-159/160), fora do escopo aqui.
2. ~~Texto exato da restrição de "força relativa" sem vazar rótulo técnico~~ — **Resolvido (17/09/2026):** prosa não precisa dizer força relativa. Restrição do prompt leva só a contagem máxima de inimigos; distribuição de papel/força (Minion/Soldier/Brute) fica inteira com `assignBudgetedCombatRoles` (PASSO 2), que já faz isso hoje por posição. Nada de adjetivo qualitativo a calibrar/testar em eval.
3. ~~O orçamento do encontro Final (antagonista, `chooseAntagonistRole`/`reservedCr`, US-188) usa o mesmo `combatBudget` ou um valor à parte, descontando a reserva?~~ — **Resolvido (17/09/2026), pergunta não se aplica mais:** a autoria mundo-primeiro (US-232) tirou a entidade única "antagonista" (`ai.service.ts:601-602`: "sem uma entidade única 'o antagonista', não há o que promover no ledger"; `generateAntagonist` nem existe mais no código, só citado em comentário desatualizado de `monster-roles.ts:84`). `adventure.service.ts` hoje só chama `assignBudgetedCombatRoles` (PASSO 2, por posição) — `composeEncounterRoles(..., reservedCr)` e `chooseAntagonistRole` não são chamados em lugar nenhum do pipeline atual, só existem isolados em `monster-roles.ts` e testados em `monster-roles.test.ts` (candidato a código morto pós-US-232, fora do escopo desta story remover). O encontro Final não recebe tratamento especial: `combatBudget` desta story usa o mesmo teto cheio de qualquer outro `combat`, sem desconto.

---

## Referências no código

- [`apps/api/src/ai/ai.service.ts:114-276`](../../../apps/api/src/ai/ai.service.ts) — `AUTHORING_SCHEMA`, `buildAuthoringSystem`, `buildAuthoringPrompt` (linha 218: comentário explícito "`challenge` NÃO entra na autoria" — a decisão que esta story reverte).
- [`apps/api/src/adventure/adventure.service.ts:318-332`](../../../apps/api/src/adventure/adventure.service.ts) — PASSO 2 (US-233), `assignBudgetedCombatRoles`, onde o descarte silencioso ("figurante") acontece hoje.
- [`apps/api/src/adventure-generation/monster-roles.ts`](../../../apps/api/src/adventure-generation/monster-roles.ts) — `composeEncounterRoles`, `chooseAntagonistRole`, `ROLES_BY_IMPACT`, `MONSTER_ROLE_CR`; comentário do bugfix de hoje (linhas 105-117) documenta o sintoma que esta story ataca na causa.
- [`apps/api/src/adventure-generation/lazy-encounter-benchmark.ts`](../../../apps/api/src/adventure-generation/lazy-encounter-benchmark.ts) — `encounterDeadlyThreshold`/`singleMonsterCrCap`, a fonte do orçamento (nenhuma fórmula nova nesta story).
- [US-233](./US-233-numeros-dos-encontros-passo-2-5e.md) — bugfix de hoje (Paladina nível 3), a consequência real que motivou esta story.
- [US-166](./US-166-motor-gera-multiplos-encontros.md) — `combatViable`, a salvaguarda equivalente do pipeline anterior, perdida na reescrita mundo-primeiro (US-232).
- [`evals/exemplars/cripta-do-veu-silencioso.md`](../../../evals/exemplars/cripta-do-veu-silencioso.md) — exemplar de referência: CR/nível de cada grupo de monstro já nasce junto da criação, nunca encaixado depois.
- [US-238](./US-238-eval-da-aventura-gerada-recalibrada.md) — assert "orçamento de cada encontro cabe no nível" já verifica o sintoma pós-geração; esta story move a restrição pra entrada.
