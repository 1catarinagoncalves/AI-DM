# US-233 — Números dos encontros (PASSO 2, 5e determinístico)

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** [US-232](./US-232-schema-cresce-e-prompt-de-autoria-call-unico.md) (a CHAMADA 1 emite `encounters[].fiction`, a matéria-prima) · [US-152](./US-152-statblocks-papel-orcamento.md) (statblock por papel Minion/Soldier/Brute, do `5e_Monster_Builder.json`) · [US-159](./US-159-orcamento-de-encontro-lgmrd.md)/[US-160](./US-160-composer-encontro-usa-limiar-de-soma.md) (orçamento *Lazy Encounter Benchmark* pro nível) · [US-237](./US-237-remove-seed-rebaixa-lgmrd-mantem-monster-builder.md) (metade Monster Builder do `sync` fica)
**Relacionado:** [US-161](./US-161-jogador-escolhe-nivel-de-desafio-do-encontro.md) (modo desafio escolhe o orçamento) · [ADR 012](../../adr/012-aventura-gerada-como-dado.md) (D5 — "números = código, ficção = modelo", abordagem A) · [Backlog — MA-3](./backlog-motor-de-geracao-de-aventuras.md) · [US-234](./US-234-gate-regenera-on-fail-com-saneamento.md) (📋 Proposta — risco de sequenciamento, ver *Notas de implementação*)
**Criada em:** 2026-09-13
**2026-09-15:** 3 dúvidas de implementação fechadas (ver *Modelo de dados proposto*, *Notas de implementação* e *Questões em aberto*) — schema ganha `AdventureNpcSchema.combatRole?`, `checkEncounterBudget` lê do campo errado hoje (bug pré-existente que esta story corrige), regra de atribuição de papel por posição decidida.

---

## História

> **Como** desenvolvedora do motor,
> **quero** um passo determinístico que pega a **ficção** de cada encontro (que o modelo escreveu) e preenche a **mecânica 5e** — papel de statblock e orçamento pro nível do personagem —
> **para que** o número nunca venha do modelo (que inventa HP/CD errados, US-29), e o encontro caiba num personagem solo do nível certo.

---

## Contexto e motivação

A abordagem A ([ADR 012](../../adr/012-aventura-gerada-como-dado.md) D5) separa: **ficção do encontro = modelo** (US-232, `encounter.fiction`: onde, quem, situação — sem números), **números = código**. O Spike mostrou o modelo escrevendo "teste de Sabor" e HP fictício quando deixado por conta própria — daí a mecânica sair do modelo e ir pro código determinístico. Esta story é esse PASSO 2.

Já existe o material: US-152 dá o statblock por papel (do `5e_Monster_Builder.json`), US-159/160 dão o orçamento *Lazy Encounter Benchmark* por nível. Falta a peça que **casa** a ficção da CHAMADA 1 com esse material.

---

## Escopo

### Dentro do escopo

- **Preencher a camada mecânica de cada `encounters[]`** a partir da `fiction` que a US-232 emitiu: para cada inimigo/grupo descrito, atribuir **papel** (Minion/Soldier/Brute, US-152) e resolver o **statblock** correspondente.
- **Orçamento pro nível do personagem solo** (US-159/160): a soma dos papéis cabe no limiar do nível (`encounterDeadlyThreshold`). O **modo desafio** (US-161) escolhe qual limiar (`adventure` vs `challenge`, `singleMonsterCrCap`).
- **Determinístico sem `seed`:** as funções de statblock/orçamento já são **puras** por `level`/`challenge` — mesma entrada, mesma saída, sem RNG. O `seed` está morto (ADR 012 D1); este passo não o ressuscita.
- **Encaixe no schema (decidido, ver *Modelo de dados proposto*):** `AdventureNpcSchema` ganha `combatRole?: 'Minion' | 'Soldier' | 'Brute'` — NÃO em `encounters[]`. Orçamento resolvido não persiste (mesmo precedente da US-152, *Questões em aberto* #1: valor transiente, calculado na mesma execução que o gate consome).
- **Sinaliza estouro:** quando a ficção pede mais do que o orçamento do nível aguenta, este passo **não conserta** — reporta pro gate (MA-4/US-234), que regenera a CHAMADA 1.

### Fora do escopo

- **Escrever a ficção do encontro** — US-232 (CHAMADA 1).
- **O gate** (grafo fecha, regenera-on-fail) — [US-150](./US-150-gate-antes-de-persistir-aventura-gerada.md)/MA-4. Este passo só **preenche** e **sinaliza** estouro; a decisão de regenerar é do gate.
- **A forma do statblock em si** — [US-152](./US-152-statblocks-papel-orcamento.md).
- **Escalar acima do nível 1 / grupo > 1** — fase 1 é solo, nível travado (ressalva do backlog inalterada).

---

## Modelo de dados proposto

```ts
// packages/shared/src/types/adventure-generation.ts
// NOVO campo, opcional — ausente pra NPC narrativo e pra combatente de encontro skill/social
// (que não existe hoje, mas o campo não pressupõe isso). Valores espelham MonsterRole
// (apps/api/src/adventure-generation/monster-roles.ts) por VALOR LITERAL, não por import —
// shared não pode depender de apps/api (camada errada). Mesmo risco de drift que
// AdventureLocationSchema.vibe já aceita (2 enums espelhados, comentário nos dois lados).
export const AdventureNpcSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  role: z.string().min(1), // narrativo (US-232) — NÃO é o papel de statblock, ver combatRole
  want: z.string().min(1),
  factionId: z.string().min(1).optional(),
  combatRole: z.enum(['Minion', 'Soldier', 'Brute']).optional(), // US-233
})
```

```ts
// apps/api/src/adventure-generation/monster-roles.ts
// Exportar a constante que já existe (privada) — reusada pela função nova, sem duplicar a lista.
export const ROLES_BY_IMPACT: MonsterRole[] = ['Brute', 'Soldier', 'Minion']

// US-233: papel por POSIÇÃO, não por orçamento — direção oposta de composeEncounterRoles
// (que monta lista de papéis A PARTIR do orçamento, sem saber quantos inimigos a ficção já
// escreveu). Aqui o número de inimigos já é fixo (encounter.npcIds.length, decidido pela
// autoria/US-232) — só falta decidir QUEM é o quê. Cicla Brute→Soldier→Minion por índice:
// inimigo 0 é sempre o mais forte, o resto degrada. Determinístico puro (sem seed/RNG),
// mesma constante ROLES_BY_IMPACT que chooseAntagonistRole já usa.
export function assignCombatRoles(count: number): MonsterRole[] {
  return Array.from({ length: count }, (_, i) => ROLES_BY_IMPACT[i % ROLES_BY_IMPACT.length]!)
}
```

```ts
// apps/api/src/adventure/adventure.service.ts — generateAdventure, depois que `npcs`/
// `encounters` estão montados (linha ~230, antes do GeneratedAdventureSchema.parse final).
// PASSO 2 propriamente dito: casa fiction (npcIds já resolvidos) com mecânica.
for (const encounter of encounters) {
  if (encounter.type !== 'combat') continue
  const roles = assignCombatRoles(encounter.npcIds.length)
  encounter.npcIds.forEach((npcId, i) => {
    const npc = npcs.find((n) => n.id === npcId)
    if (npc) npc.combatRole = roles[i]
  })
}
```

---

## Critérios de aceite

- [ ] Dado um `encounters[].fiction` (inimigo + situação, sem números), o passo atribui papel (Minion/Soldier/Brute) e resolve o statblock de cada inimigo, sem pedir número nenhum ao modelo.
- [ ] A soma dos papéis de cada encontro respeita o limiar do nível do personagem (US-159/160); o modo desafio (US-161) troca o limiar aplicado.
- [ ] Mesmo `level`/`challenge` produz os mesmos números (função pura, sem `seed`/RNG) — testável por igualdade.
- [ ] Encontro cuja ficção excede o orçamento do nível é **marcado como estouro** e reportado ao gate (MA-4), não silenciosamente cortado nem persistido.
- [ ] **Eval / regressão:** teste com uma ficção de encontro fixa em 2 níveis diferentes — o orçamento resolvido difere corretamente por nível; um encontro deliberadamente grande demais dispara a marcação de estouro.
- [ ] `pnpm typecheck` e `pnpm test` passam.

---

## Notas de implementação

- Reusar direto US-152 (statblock por papel) e US-159/160 (limiar por nível) — esta story é a **cola** entre a ficção e essas funções, não reimplementa nenhuma.
- Sem RNG: se aparecer tentação de "sortear qual monstro", parar — a variedade veio da ficção do modelo (US-232); aqui é só resolver papéis/orçamento de forma determinística.
- ai-engine roda de `dist` — `pnpm --filter @ai-dm/ai-engine build` depois de editar `src`.

- **Bug pré-existente que esta story corrige, não introduz:** [`checkEncounterBudget`](../../../apps/api/src/adventure-generation/adventure-gate.ts) (verificação 3 do gate, linha ~144) já lê `npc.role` esperando `'Minion'|'Soldier'|'Brute'` literal — herdado de quando US-166 chamava `buildEncounterNpcs` (que escrevia isso em `role`) direto em `generateAdventure`. Desde a reescrita mundo-primeiro (US-232), `AdventureNpcSchema.role` é texto narrativo livre (`"contrabandista"`, `"guarda-costas"`) — a checagem hoje é **no-op silencioso** pra todo encontro de autoria, porque `role in MONSTER_ROLE_CR` quase nunca bate. `composeEncounterRoles`/`buildEncounterNpcs` (monster-roles.ts) ficaram sem chamador em `adventure.service.ts` na mesma reescrita (comentário em `buildEncounterNpcs` já credita "cleanup em MA-7" — na prática é este PASSO 2 quem religa, não um cleanup de remoção). Trocar `roleByNpcId` pra ler `npc.combatRole` (campo novo, ver *Modelo de dados proposto*) fecha o buraco.
- **Regra de atribuição por posição (calibração desta story, mesmo espírito da régua que US-152 calibrou pra `composeEncounterRoles`):** `assignCombatRoles` cicla `ROLES_BY_IMPACT` (`Brute→Soldier→Minion`) pelo ÍNDICE do `npcIds[]`, não pelo orçamento — a contagem de inimigos já vem fixa da autoria (`npcIndices` no schema de autoria, US-232), então não existe "escolher quantos", só "escolher quem é o quê". Primeiro inimigo listado é sempre o mais forte (padrão "líder + capangas" comum em ficção de combate); resto degrada. Puramente posicional e determinístico — mesmo `npcIds.length` produz sempre a mesma sequência de papéis, testável por igualdade (AC). Se calibração futura mostrar padrão melhor (ex.: todo grupo de 3+ vira maioria Minion), trocar só esta função — `checkEncounterBudget` e `assignCombatRoles` não conhecem um ao outro.
- **Risco de sequenciamento com [US-234](./US-234-gate-regenera-on-fail-com-saneamento.md) (ainda 📋 Proposta):** hoje `generateWithGate` ([adventure-gate.ts:193-199](../../../apps/api/src/adventure-generation/adventure-gate.ts)) **nunca re-semeia na falha de orçamento** (`stage === 'budget'` retorna `ok:false` na hora, sem tentar de novo) — só US-234 troca isso por regenerar. `encounterDeadlyThreshold(level)` é **0** pra `level` 1-3 em modo `'adventure'` ([lazy-encounter-benchmark.ts:11-13](../../../apps/api/src/adventure-generation/lazy-encounter-benchmark.ts)) — ou seja, QUALQUER encontro `type: 'combat'` com pelo menos 1 inimigo nesses níveis, nesse modo, sempre estoura (`sum > 0` é inevitável com `combatRole` atribuído). Diferente da US-166 (pipeline antigo), a autoria mundo-primeiro (US-232) não tem mais o `combatViable` que evitava gerar `combat` nesses níveis — o modelo escolhe `type` livre. **Consequência prática: até US-234 landar, ligar esta checagem faz geração falhar (não regenerar) toda vez que a autoria escrever um `combat` em personagem nível 1-3 modo `'adventure'`.** Não é bug desta story (o gate documenta a decisão — *Fora do escopo* acima), mas testar isso antes de habilitar em produção — considerar rodar behind flag ou só depois da US-234, não junto.

---

## Questões em aberto

1. ~~**Campos mecânicos do encontro no schema** — a forma exata (papel por inimigo, ref de statblock, orçamento) é herdada da decisão da US-152 (ver US-144 *Questões em aberto* #2). Fechar quando a US-152 escrever contra o schema crescido.~~ **Resolvida em 2026-09-15:** US-152 (✅ implementada) nunca decidiu essa forma — só entregou as funções puras. Decisão é desta story: `AdventureNpcSchema.combatRole?` (novo campo, não em `encounters[]`), sem persistir orçamento (ver *Modelo de dados proposto*).
2. ~~`checkEncounterBudget` funciona hoje?~~ **Resolvida em 2026-09-15:** não — lê `npc.role`, campo que virou texto narrativo na US-232. É um no-op silencioso pra encontro de autoria atual; esta story corrige lendo `npc.combatRole` (ver *Notas de implementação*).
3. ~~Regra de atribuição de papel por inimigo, dado que a contagem já vem fixa da ficção (`npcIds.length`)?~~ **Resolvida em 2026-09-15:** `assignCombatRoles` cicla `Brute→Soldier→Minion` por posição (índice em `npcIds[]`), sem orçamento nem RNG — ver *Modelo de dados proposto*. Calibração aberta a revisão futura se o eval mostrar composição ruim.

---

## Referências no código

- [packages/shared/src/types/adventure-generation.ts](../../../packages/shared/src/types/adventure-generation.ts) — `AdventureNpcSchema` (L8-14, ganha `combatRole?` aqui), `AdventureEncounterSchema` (L82-98, ganhou `fiction` na US-232, sem campo mecânico novo nesta story).
- [apps/api/src/adventure-generation/monster-roles.ts](../../../apps/api/src/adventure-generation/monster-roles.ts) — `MONSTER_ROLE_CR`, `composeEncounterRoles`, `chooseAntagonistRole` (reusados); `ROLES_BY_IMPACT` (exportar), `assignCombatRoles` (função nova desta story).
- [apps/api/src/adventure-generation/adventure-gate.ts](../../../apps/api/src/adventure-generation/adventure-gate.ts) — `checkEncounterBudget` (L140-159, corrige leitura de `npc.role` → `npc.combatRole`); `generateWithGate` (L186-201, risco de sequenciamento com US-234, ver *Notas de implementação*).
- [apps/api/src/adventure/adventure.service.ts](../../../apps/api/src/adventure/adventure.service.ts) — `generateAdventure` (L147-292), ponto de encaixe do PASSO 2 (depois de `encounters`/`npcs` montados, antes do `.parse()` final).
- [US-152](./US-152-statblocks-papel-orcamento.md) — statblock por papel, fonte `5e_Monster_Builder.json`.
- [US-159](./US-159-orcamento-de-encontro-lgmrd.md)/[US-160](./US-160-composer-encontro-usa-limiar-de-soma.md) — orçamento *Lazy Encounter Benchmark*.
- [US-234](./US-234-gate-regenera-on-fail-com-saneamento.md) — 📋 Proposta, regenera-on-fail que hoje falta na verificação 3.
- [Backlog — MA-3](./backlog-motor-de-geracao-de-aventuras.md).
