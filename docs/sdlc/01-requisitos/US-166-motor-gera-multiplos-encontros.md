# US-166 — Motor gera 8 encontros como situações completas (location, inhabitants, behaviors, goal, complications)

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** [US-164](./US-164-orquestrador-motor-monta-aventura-gerada.md) (`generateAdventure` — estende o array de 1 elemento pra 8) · [US-152](./US-152-statblocks-papel-orcamento.md)/[US-160](./US-160-composer-encontro-usa-limiar-de-soma.md)/[US-161](./US-161-jogador-escolhe-nivel-de-desafio-do-encontro.md) (`composeEncounterRoles`/`buildEncounterNpcs`, ✅, reusadas nos slots `combat`) · [US-144](./US-144-schema-aventura-shared.md) (`AdventureEncounterSchema` MUDA) · [US-158](./US-158-locais-npcs-prosa-motor.md) (`generateLocationsAndNpcs`, ✅ — fonte de `location.occupants`) · [US-149](./US-149-segredos-40-prompts-lgmrd.md) (`generateSecrets`, ✅ — `secrets[]` já chega em `generateClosing`) · [US-181](./US-181-antagonista-ganha-want-e-method-estruturados.md) (`antagonist`, 📋 **NÃO implementada** — bloqueia: posição 8 precisa dele pra existir de verdade) · [US-170](./US-170-locais-gerados-entram-no-ledger.md) (`seedLedgerFromGeneratedAdventure`, ✅) · [US-114](./US-114-modelo-utilitario-para-extracao-e-fecho.md) (modelo barato, molde de `generateClosing`)
**Relacionado:** [US-150](./US-150-gate-antes-de-persistir-aventura-gerada.md) (gate, verificação 3 — já filtra por role em `MONSTER_ROLE_CR`, efeito equivalente a "só `combat`") · [US-171](./US-171-encontros-de-combate-entram-no-ledger.md) (`encounterNpcEntities` ganha filtro `type === 'combat'`) · [US-163](./US-163-jogador-escolhe-tamanho-da-aventura.md) (`N=8` é constante desta story, não preferência do jogador) · [US-187](./US-187-distribuicao-tematica-de-locationid-baseada-em-registry.md) (distribuição temática de `locationId`, depende desta story primeiro) · [US-190](./US-190-antagonista-vira-passo-proprio-entre-segredos-e-encontros.md) (`antagonist` já chega pronto de `generateAntagonist`, chamada própria ANTES do `Promise.all` — implementado)

**Criada em:** 2026-08-18 — questão em aberto #3 da US-164 ("um encontro ou 4-5?"), virou story própria.
**Decisões fechadas (2026-08-20 a 21):** 8 encontros fixos. Cada um vira uma SITUAÇÃO completa (framework Sly Flourish — ver *Referências externas*), não uma perícia amarrada (`testedSkill` foi tentado e abandonado). `type` sorteado por seed determinístico nas posições 1-7 (multiset `{combat×2, skill×3, social×2}`, sem repetição adjacente); posição 8 sempre `combat`, fixa — confronto final com o antagonista. `behaviors`/`goal`/`complications` entram como campos extras no MESMO `generateClosing` que a US-181 já estende com `antagonist` (não função nova) — roda dentro do `Promise.all([generateClosing, generateOpeningBeat])` já existente, sem round-trip a mais. Piso de locais fixado em 8.
**2026-08-22:** soma sinal de orientação em runtime — `nextUnrevealedEncounterLocation` (puro, sem IA) aponta o encontro de menor `id` cujo local ainda não é `revelado`; `buildTurnStateBlock` ganha bloco opcional autorizando (não obrigando) o Mestre a apontar rumo, sem citar `behaviors`/`goal`/`complications`.
**2026-08-22 (correção pós-revisão):** prosa antiga dizia "`type` continua existindo" — falso, checado no schema atual: campo não existe, é NOVO nesta story (o bloco `Modelo de dados proposto` já estava certo). Riscos de implementação em *Notas de implementação*.

---

## História

> **Como** jogadora,
> **quero** que a aventura gerada me leve por 8 situações — combate, interação social e desafio de perícia — cada uma com moradores, comportamento, um objetivo que explica por que estou ali e uma complicação que pode virar o jogo de cabeça pra baixo,
> **para que** cada encontro pareça um lugar vivo com gente fazendo alguma coisa, não uma lista de monstros ou uma pergunta de quiz de perícia.

---

## Contexto e motivação

A versão anterior previa "encontros (4-5)" sem tipo — mas `composeEncounterRoles`/`buildEncounterNpcs` só sabem montar **combate**. Uma aventura toda-combate contradiz o resto do artefato: locais/NPCs/segredos já cobrem exploração e interação social em prosa, mas nada disso vira **encontro estruturado**.

Cada um dos 8 `AdventureEncounter` passa a responder as cinco perguntas de uma situação (Sly Flourish):

| Pergunta | Campo | Como é decidido |
|---|---|---|
| **Location** — onde acontece? | `locationId` | Round-robin sobre `locations[]` |
| **Inhabitants** — quem mora ali? | `npcIds` | `combat`: composer. `social`: `location.occupants`, fallback round-robin. `skill`: `[]` |
| **Behaviors** — o que estão fazendo? | `behaviors` | Prosa curta, modelo (US-114) |
| **Goal** — por que o personagem foi lá? | `goal` | Prosa curta, modelo (US-114) |
| **Complications** — o que pode virar o jogo? | `complications` | Prosa curta, modelo (US-114) |

`type` direciona o QUE o modelo escreve (`skill`→obstáculo físico/ambiental, `social`→negociação, `combat`→ameaça e cerco) mas não trava perícia — a perícia rolada no turno continua 100% emergente. `behaviors`/`goal`/`complications` nascem na mesma chamada que já recebe `secrets[]` e `antagonist` — contexto de prompt, nunca vínculo estrutural (nenhum `secretId`/`antagonistId` novo no schema).

---

## Escopo

### Dentro do escopo

- `AdventureEncounterSchema` ganha `type: z.enum(['combat', 'skill', 'social'])`, `behaviors`, `goal`, `complications` (`z.string().min(1)`) — todos NOVOS, presentes nos 8 encontros.
- `generateAdventure` monta exatamente 8 encontros. Posição 8 = `combat` fixo; posições 1-7 = shuffle seedado (`shuffleEncounterTypes`) do multiset `{combat×2, skill×3, social×2}`, retry até não ter dois tipos iguais adjacentes (incluindo contra a posição 8).
- `locationId`: round-robin `locations[i % locations.length]`. Prompt de locais ganha instrução de piso 8.
- `npcIds`: `combat` via `composeEncounterRoles`/`buildEncounterNpcs` (cumulativo entre chamadas — ver *Notas de implementação*); `social` via `location.occupants`, fallback round-robin; `skill` sempre `[]`.
- `generateClosing` ganha `encounterSkeleton` (entrada: 8 encontros com `id`/`type`/location/npcs resolvidos) e `encounterSituations` (saída: array `.length(8)` posicional) — mesmo contrato que a US-181 já estende com `antagonist`. Posição 8 instruída a ecoar `antagonist.want`/`method` diretamente; as outras 7 só PODEM.
- Continua dentro do `Promise.all([generateClosing, generateOpeningBeat])` já existente — `encounterSkeleton` precisa estar pronto antes.
- `id` de cada encontro: `encounter-1`..`encounter-8`.
- `encounterNpcEntities` (seed-ledger.ts) ganha filtro `type === 'combat'` — sem ele, NPC de `social` duplica no ledger.
- `locationEntities`: `nota` de cada local ganha um segmento por encontro que o referencia: `"{type} — objetivo: {goal}; comportamento: {behaviors}; complicação: {complications}"`, separados por `" | "`.
- `nextUnrevealedEncounterLocation` (novo arquivo `next-encounter-hint.ts`): função pura, devolve o encontro de menor `id` cujo local ainda não é `revelado` no ledger, ou `null`. Sem IA, sem campo novo.
- `buildTurnStateBlock` ganha bloco opcional `## Situação em aberto mais próxima`, só quando a função acima devolve um encontro — aponta `location.title`, nunca `behaviors`/`goal`/`complications`.
- Testes de regressão: 8 encontros, tipo alternando sem repetição adjacente, posição 8 sempre `combat`, sequência estável por `characterId`+`order`, `behaviors`/`goal`/`complications` presentes em todos, `seedLedgerFromGeneratedAdventure` inclui os três campos no local certo.

### Fora do escopo

- Perícia estruturada testada pelo encontro — removida; perícia rolada no turno é 100% emergente (SRD).
- Vínculo estrutural (`secretId`/`antagonistId`) entre encontro e segredo/antagonista — sobreposição fica só na prosa.
- `background`/`origin` como insumo de `generateClosing` — não pedido; candidato futuro se eval mostrar situação genérica.
- Antagonista virar NPC estruturado no `npcIds` do combate final — vínculo é só narrativo.
- Sortear a PROPORÇÃO das posições 1-7 (não só a ordem) — herdada, sortear só ordem é mais barato.
- Diálogo novo pro NPC do `social` / `interactions[].encounterId` — reescrever custa mais que o ganho.
- Priorizar NPC amarrado a `background.bonds` na escolha do `social` — enriquecimento futuro.
- Tornar `N=8` parametrizável ou ligado ao dial de NPCs da US-163 — eixos diferentes.
- Distribuição temática de `locationId` — round-robin é a opção barata (US-187 substitui depois).
- Reabrir US-152/US-160/US-161 — funções de combate usadas como estão.

---

## Modelo de dados proposto

```ts
// packages/shared/src/types/adventure-generation.ts
export const AdventureEncounterSchema = z.object({
  id: z.string().min(1),
  locationId: z.string().min(1),
  npcIds: z.array(z.string()),
  type: z.enum(['combat', 'skill', 'social']),
  // As 5 perguntas de "situação" (Sly Flourish): location=locationId, inhabitants=npcIds,
  // as 3 abaixo fecham o resto. Prosa curta escrita pelo modelo (US-114), nunca pelo código.
  behaviors: z.string().min(1),
  goal: z.string().min(1),
  complications: z.string().min(1),
})
```

```ts
// apps/api/src/adventure-generation/shuffle-encounter-types.ts (NOVO)
// Posição 8 sempre 'combat' (fixo, fora do shuffle). Posições 1-7: shuffle seedado do
// multiset {combat×2, skill×3, social×2}, retry até não ter dois tipos iguais adjacentes.
// Sub-seed próprio: deriveAdventureSeed(`${characterId}:encounter-types`, order, attempt).
export function shuffleEncounterTypes(
  characterId: string,
  order: number,
  attempt?: number,
): Array<'combat' | 'skill' | 'social'> // length 8, [7] === 'combat'
```

```ts
// apps/api/src/ai/ai.service.ts — generateClosing (US-181 já acrescenta `antagonist`;
// esta story acrescenta `encounterSkeleton`/`encounterSituations` ao MESMO contrato)
async generateClosing(params: {
  locations: AdventureLocation[]
  npcs: AdventureNpc[]
  secrets: AdventureSecret[]
  registry: AdventureRegistry
  complicacao: { condition: string; description: string; origin: string }
  premissa: string
  locale?: Locale
  encounterSkeleton: Array<{
    id: string
    type: 'combat' | 'skill' | 'social'
    location: AdventureLocation
    npcs: AdventureNpc[] // resolvidos a partir de npcIds, [] se skill
  }>
}): Promise<{
  conclusion: string
  followUps: string[]
  antagonist: { name: string; want: string; method: string }
  encounterSituations: Array<{ behaviors: string; goal: string; complications: string }> // posicional
}>
```

```ts
// apps/api/src/ai/ai.service.ts — CLOSING_SCHEMA
const CLOSING_SCHEMA = z.object({
  conclusion: z.string().min(1),
  followUps: z.array(z.string()).min(1),
  antagonist: z.object({
    name: z.string().min(1),
    want: z.string().min(1),
    method: z.string().min(1),
  }),
  encounterSituations: z.array(z.object({
    behaviors: z.string().min(1),
    goal: z.string().min(1),
    complications: z.string().min(1),
  })).length(8),
})
```

```ts
// apps/api/src/adventure-generation/next-encounter-hint.ts (NOVO)
// Sinal determinístico pro Mestre saber qual dos 8 encontros ainda não foi "descoberto"
// (proxy: local ainda não `revelado` no ledger). Sem IA, sem campo novo em WorldEntity.
export function nextUnrevealedEncounterLocation(
  encounters: AdventureEncounter[],
  entities: WorldEntity[],
): AdventureEncounter | null
```

---

## Critérios de aceite

- [ ] `generateAdventure` produz exatamente 8 `AdventureEncounter`.
- [ ] `type` dos 8 encontros: posição 8 sempre `combat`; posições 1-7 são o multiset `{combat×2, skill×3, social×2}` embaralhado, sem dois tipos iguais adjacentes (nem entre posição 7 e 8).
- [ ] Encontro da posição 8: `behaviors`/`goal`/`complications` referenciam `antagonist.want`/`method` diretamente — não é opcional como nos outros 7.
- [ ] `behaviors`, `goal` e `complications` presentes (não-vazios) em TODO encontro, incluindo `combat`.
- [ ] `locationId` de cada encontro referencia uma location real, distribuído round-robin.
- [ ] `npcIds` não-vazio e válido em `combat` (ids novos, sem colisão) e em `social` (`location.occupants` ou fallback round-robin); vazio em `skill`.
- [ ] `encounterNpcEntities` só gera `WorldEntity` pra encontros `type === 'combat'` — NPC de `social` não duplica no ledger.
- [ ] Mesmo `characterId`+`order` produz a mesma sequência de `type`/`locationId`/`npcIds`; personagens/aventuras diferentes produzem sequências de `type` diferentes. `behaviors`/`goal`/`complications` são prosa do modelo — **não** é critério exigir prosa idêntica entre execuções.
- [ ] Gate (US-150), verificação 3: compara orçamento só nos encontros `type === 'combat'`; `skill`/`social` não reprovam por ausência de orçamento.
- [ ] `nota` do local que hospeda QUALQUER encontro inclui `"{type} — objetivo: {goal}; comportamento: {behaviors}; complicação: {complications}"`, segmentos separados por `" | "`; local sem encontro fica igual ao que a US-170 já produz.
- [ ] `generateClosing` devolve `encounterSituations` com exatamente `encounterSkeleton.length` (8) itens — contagem errada falha o `parse()`, motivo de reseed (US-150).
- [ ] `GeneratedAdventureSchema.parse()` passa com o schema novo.
- [ ] `pnpm typecheck` e testes do módulo passam.
- [ ] **Eval / teste de regressão:** fixture com locations/npcs geradas → `generateAdventure` monta os 8 encontros válidos, `.parse()` passa, sem `npcId`/`id` duplicado.
- [ ] `nextUnrevealedEncounterLocation` é pura e determinística — devolve o encontro de menor `id` cujo local ainda não é `revelado: true`, `null` quando todos já foram revelados.
- [ ] `buildTurnStateBlock` inclui o bloco `## Situação em aberto mais próxima` só quando a função acima devolve um encontro; some quando devolve `null`, e nunca expõe `behaviors`/`goal`/`complications`.
- [ ] Guard de conjunto de blocos `## ` (US-85, `dm-system.test.ts`) atualizado com o bloco novo — senão falha.

---

## Notas de implementação

- **`shuffleEncounterTypes`**: sub-seed próprio, não compartilha stream com outra rolagem. Retry com contador local e teto ~20 — precisa `throw` EXPLÍCITO se estourar (não confiar só em "espaço de shuffles válidos é grande"), senão um bug de índice na checagem de adjacência vira loop infinito, não falha visível. Posição 8 nunca entra no shuffle, é atribuída direto.
- **Nível 1-3 em modo `'adventure'`**: `composeEncounterRoles` pode devolver `[]` — encontro `combat` sem `npcIds` é válido (situação sem morador, não encontro vazio).
- **`buildEncounterNpcs` precisa `existingNpcs` CUMULATIVO** entre os 3 slots `combat` (2 sorteados + posição 8) — resetar gera `id` duplicado, que corrompe silenciosamente o `Map(npcId→role)` do gate (verificação 3, sobrescreve role sem avisar) e o `.find` do seed-ledger (pega só o primeiro match, ledger do segundo encontro fica errado). Bug só aparece testando os 8 encontros completos, não em fixture de 1.
- **Ledger é chaveado por `nome`/título, não por `id`** (`locationTitleById`) — dois locais com título igual colapsam na mesma `WorldEntity`, afetando `nota` e `nextUnrevealedEncounterLocation`. Risco sobe com 8 locais obrigatórios; sem mitigação nesta story.
- **Fallback de `social` sem occupant** usa contador próprio (`socialIndex`), só nos 2 slots `social`; `npcs.length === 0` (defensivo) devolve `npcIds: []`.
- **Ordem em `generateAdventure`**: `generateLocationsAndNpcs` → `generateSecrets` → monta `encounterSkeleton` → `Promise.all([generateClosing(..., encounterSkeleton), generateOpeningBeat])` → junta com `encounterSituations`.
- **`CRAFT_CORE_SECTION` reusado verbatim** pra `encounterSituations` — seção dedicada só se eval acusar prosa genérica.
- **Bloco novo em `buildTurnStateBlock` precisa se declarar no guard de conjunto `## `** (US-85, `dm-system.test.ts`) — comentário em `dm-system.ts:539` avisa disso.
- **Ordem de sugestão é por `id` crescente**, não proximidade geográfica real — motor não tem grafo de distância entre locais.
- **`revelado` é proxy de "visitado"**, não de "situação resolvida" — pode virar `true` só por MENÇÃO (NPC falou do local). Aceito; rastrear resolução de verdade exigiria tool novo (fora do escopo).

---

## Referências no código

- [`apps/api/src/adventure/adventure.service.ts`](../../../apps/api/src/adventure/adventure.service.ts) — `generateAdventure` (US-164), monta `encounterSkeleton` e passa pro `Promise.all`.
- [`apps/api/src/ai/ai.service.ts`](../../../apps/api/src/ai/ai.service.ts) — `generateClosing` (estendida junto da US-181), `buildClosingPrompt`, `buildLocationsAndNpcsPrompt` (precedente de instrução de quantidade-alvo).
- [`apps/api/src/adventure-generation/monster-roles.ts`](../../../apps/api/src/adventure-generation/monster-roles.ts) — `composeEncounterRoles`/`buildEncounterNpcs`.
- [`packages/shared/src/adventure-seed.ts`](../../../packages/shared/src/adventure-seed.ts) — `deriveAdventureSeed`/`createSeededRandom` (US-146), reusados por `shuffleEncounterTypes`.
- [`apps/api/src/adventure-generation/roll-content.ts`](../../../apps/api/src/adventure-generation/roll-content.ts) — `tableSeed`, padrão de sub-seed que `shuffleEncounterTypes` copia.
- [`apps/api/src/adventure-generation/seed-ledger.ts`](../../../apps/api/src/adventure-generation/seed-ledger.ts) — `seedLedgerFromGeneratedAdventure` (`locationEntities`/`encounterNpcEntities`).
- [`packages/ai-engine/src/prompts/dm-system.ts`](../../../packages/ai-engine/src/prompts/dm-system.ts) — `buildTurnStateBlock`, ganha o bloco novo.
- [Backlog — Motor de geração de aventuras one-shot §Ordem de geração](./backlog-motor-de-geracao-de-aventuras.md) — passo 5, intenção original substituída.

### Referências externas

- [Sly Flourish — Building Situations](https://slyflourish.com/building_situations.html) / [Situation Checklist](https://slyflourish.com/situation_checklist.html) — framework Location/Inhabitants/Behaviors/Goal/Complications, núcleo do redesign.
- [Sly Flourish — Anatomy of a Situation: Castle Orzelbirg](https://slyflourish.com/anatomy_of_a_situation_castle_orzelbirg.html) — exemplo aplicado, base do formato de prosa curta e concreta.
- [Sly Flourish — Running Investigations and Mysteries](https://slyflourish.com/running_investigations_and_mysteries.html) — "build situations, not mystery novels": `goal`+`complications` bem escritos já convidam mais de uma abordagem.
