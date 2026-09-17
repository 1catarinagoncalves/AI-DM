# US-254 — Remover `chooseAntagonistRole`/`reservedCr`, código morto desde a autoria mundo-primeiro

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** nenhuma
**Relacionado:** [US-188](./US-188-antagonista-vira-npc-rastreavel.md) (introduziu `chooseAntagonistRole`/`reservedCr` — a decisão que ficou órfã) · [US-232](./US-232-schema-cresce-e-prompt-de-autoria-call-unico.md) (autoria mundo-primeiro, tirou a entidade única "antagonista" — o que tornou US-188 órfã sem ninguém perceber) · [US-250](./US-250-autoria-inventa-numero-de-inimigos-sem-orcamento-de-cr.md) (achado durante a resposta à Questão em aberto #3 dessa story) · [US-89](./US-89-gate-de-codigo-morto-com-knip.md) (`knip`, o gate de código morto que NÃO pegou este caso — ver *Por que o gate não pegou*)

**Criada em:** 2026-09-17 — achado ao resolver a Questão em aberto #3 da US-250: o orçamento do encontro Final descontaria a reserva do antagonista via `reservedCr`, mas `generateAntagonist` nem existe mais no código.

---

## História

> **Como** desenvolvedora do motor,
> **quero** que `monster-roles.ts` não carregue função/parâmetro que nenhum caminho de produção chama,
> **para que** quem ler o módulo não gaste tempo entendendo um mecanismo (reserva de CR do antagonista) que já não existe na aventura gerada.

---

## Contexto e motivação

### O problema observado

`monster-roles.ts` tem hoje:
- `chooseAntagonistRole(level, challenge)` ([monster-roles.ts:86-92](../../../apps/api/src/adventure-generation/monster-roles.ts)) — escolhe o papel do "antagonista" do encontro Final.
- `reservedCr` ([monster-roles.ts:56](../../../apps/api/src/adventure-generation/monster-roles.ts)), parâmetro de `composeEncounterRoles`, documentado como "usado só no encontro final, pra reservar o CR do antagonista... ANTES de encher o resto do orçamento com capangas".

Nenhum dos dois é chamado em `adventure.service.ts` ou em qualquer outro lugar do pipeline de produção — confirmado por grep em `apps/api/src` (17/09/2026): as únicas ocorrências fora de `monster-roles.ts` são comentários e o próprio `monster-roles.test.ts`, que testa a função isolada, sem integração com o resto do motor. `adventure.service.ts` só chama `assignBudgetedCombatRoles` (PASSO 2, papel por posição) — nunca `composeEncounterRoles` com `reservedCr`, nunca `chooseAntagonistRole`.

A causa: a US-232 (autoria mundo-primeiro) tirou a entidade única "o antagonista" do artefato gerado — `ai.service.ts:601-602` documenta a decisão explicitamente ("sem uma entidade única 'o antagonista', não há o que promover no ledger pra decidir se `objective` aparece"), e `generateAntagonist`, a função que `chooseAntagonistRole` documenta como seu chamador previsto ([monster-roles.ts:84](../../../apps/api/src/adventure-generation/monster-roles.ts): "calculável antes de `generateAntagonist` sequer rodar"), **não existe em lugar nenhum do código** — nem em `ai.service.ts`, nem em `adventure.service.ts`, nem em `adventure-generation/`.

### Por que o gate de código morto (`knip`, US-89) não pegou

`knip` (US-89) detecta export sem consumidor de PRODUÇÃO — mas `chooseAntagonistRole` tem consumidor: `monster-roles.test.ts` importa e testa a função diretamente. Teste unitário de uma função pura conta como "uso" pro `knip`, mesmo quando nenhum caminho de produção chama essa função. É o ponto cego do gate: código morto em produção continua "vivo" aos olhos da ferramenta enquanto o teste que o exercita isoladamente não for removido junto.

### A proposta

Remover `chooseAntagonistRole` e o parâmetro `reservedCr` de `composeEncounterRoles` (volta a receber só `level`/`challenge`), e os testes correspondentes em `monster-roles.test.ts`. `assignBudgetedCombatRoles` e o resto do módulo não mudam — só o mecanismo de reserva do antagonista, que não tem chamador.

---

## Escopo

### Dentro do escopo

- Remover `chooseAntagonistRole` de [`monster-roles.ts`](../../../apps/api/src/adventure-generation/monster-roles.ts).
- Remover o parâmetro `reservedCr` de `composeEncounterRoles` — assinatura volta a `(level: number, challenge?: EncounterChallenge)`.
- Remover os testes `describe('composeEncounterRoles — reservedCr (US-188)', ...)` e `describe('chooseAntagonistRole (US-188)', ...)` de `monster-roles.test.ts`.
- Atualizar o comentário de `composeEncounterRoles` (linhas 28-52) removendo o parágrafo sobre `reservedCr`.
- `pnpm typecheck` e `pnpm test` passam.

### Fora do escopo

- Reintroduzir qualquer forma de antagonista único/fixo — se um dia a autoria mundo-primeiro ganhar de volta uma entidade desse tipo (fora do horizonte desta fase), é story nova, com o desenho revisto pro schema atual, não um revert desta limpeza.
- `assignBudgetedCombatRoles`/PASSO 2 (US-233) — intocado, é o mecanismo que realmente está em uso.
- Qualquer mudança em `ROLES_BY_IMPACT`, `MONSTER_ROLE_CR`, ou nos três papéis (US-152) — vocabulário mecânico não reaberto.
- Consertar o ponto cego do `knip` em si (teste unitário conta como uso) — observação registrada aqui, não uma mudança de tooling proposta por esta story.

---

## Critérios de aceite

- [ ] `chooseAntagonistRole` não existe mais em `monster-roles.ts` nem em nenhum outro arquivo do repo.
- [ ] `composeEncounterRoles` aceita só `(level, challenge?)` — nenhum chamador (produção ou teste) passa um terceiro argumento.
- [ ] `monster-roles.test.ts` não contém mais os blocos de teste de `reservedCr`/`chooseAntagonistRole`.
- [ ] `pnpm typecheck`, `pnpm test` e `pnpm dead` (knip) passam.
- [ ] Nenhuma mudança de comportamento observável na aventura gerada (a função removida já não tinha chamador de produção).

---

## Notas de implementação

- Arquivo único: [`apps/api/src/adventure-generation/monster-roles.ts`](../../../apps/api/src/adventure-generation/monster-roles.ts) — remover linhas 48-51 (comentário `reservedCr`) e 78-92 (`chooseAntagonistRole` completo); simplificar assinatura/corpo de `composeEncounterRoles` (linhas 53-58) removendo o parâmetro e o desconto no `budget`.
- Teste: [`apps/api/src/adventure-generation/monster-roles.test.ts`](../../../apps/api/src/adventure-generation/monster-roles.test.ts) — remover os dois `describe` citados acima (linhas ~76-122, conferir no arquivo atual).
- Sem mudança em `adventure.service.ts` — já não chama nenhum dos dois.

---

## Referências no código

- [`apps/api/src/adventure-generation/monster-roles.ts:48-92`](../../../apps/api/src/adventure-generation/monster-roles.ts) — `reservedCr`/`chooseAntagonistRole`, o código a remover.
- [`apps/api/src/adventure-generation/monster-roles.test.ts`](../../../apps/api/src/adventure-generation/monster-roles.test.ts) — testes correspondentes.
- [`apps/api/src/ai/ai.service.ts:601-602`](../../../apps/api/src/ai/ai.service.ts) — comentário da US-232 confirmando a remoção da entidade única "antagonista".
- [US-250, Questões em aberto #3](./US-250-autoria-inventa-numero-de-inimigos-sem-orcamento-de-cr.md) — onde este achado apareceu.
