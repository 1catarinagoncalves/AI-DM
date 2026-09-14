# US-242 — NPC perde `interactions`: fala pré-escrita nunca chega ao turno ao vivo

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** [US-232](./US-232-schema-cresce-e-prompt-de-autoria-call-unico.md) ✅ (`AUTHORING_SCHEMA`/`buildAuthoringPrompt`/backstop de local órfão em `adventure.service.ts` — esta story edita os mesmos pontos) · [US-144](./US-144-schema-aventura-shared.md) (origem de `npc.interactions[].narrative` e `AdventureNpcInteractionSchema` — esta story remove o que a US-144 introduziu) · [US-150](./US-150-gate-antes-de-persistir-aventura-gerada.md) (`checkNoOrphanNpcs`/`checkInteractionReferences` — o gate muda de regra)
**Relacionado:** [US-158](./US-158-locais-npcs-prosa-motor.md) (precedente de "backstop determinístico" que esta story estende) — o comentário em `adventure.service.ts:243` ("NPC ocupar 2 locais não é problema: continuidade é rastreada no ledger por revelado/nome") já documenta a disciplina que o backstop novo reaproveita
**Criada em:** 2026-09-14 — a pedido da mantenedora.

---

## História

> **Como** mantenedora do motor de geração de aventuras,
> **quero** que `npcs[].interactions` saia do `GeneratedAdventureSchema` (e do `speech` correspondente no schema bruto de autoria),
> **para que** a autoria não gaste tokens de geração escrevendo falas pré-escritas que o Mestre ao vivo nunca lê — a narração de diálogo continua 100% emergente, decidida no turno, como já é hoje pra tudo o mais.

---

## Contexto e motivação

### O problema observado

`AdventureNpcSchema.interactions` ([adventure-generation.ts:20](../../../packages/shared/src/types/adventure-generation.ts)) guarda falas EXATAS escritas na autoria (`AdventureNpcInteractionSchema.narrative`, linha 6-9). A cadeia que produz esse campo:

1. `AUTHORING_SCHEMA.npcs[].speech` ([ai.service.ts:132](../../../apps/api/src/ai/ai.service.ts)) — pede ao modelo "fala de abertura (palavras EXATAS) — preencha em pelo menos 3 NPCs", na MESMA chamada única de autoria (US-232).
2. `AdventureService.generateAdventure` ([adventure.service.ts:198](../../../apps/api/src/adventure/adventure.service.ts)) — minta `interactions: n.speech?.trim() ? [{ narrative: n.speech.trim() }] : []`.
3. O gate (`adventure-gate.ts`) valida a forma: `checkInteractionReferences` (linha 99-108, `encounterId` resolve) e `checkNoOrphanNpcs` (linha 131-142, um NPC com `interactions.length > 0` escapa da checagem de órfão mesmo sem estar em nenhum `encounter.npcIds`/`location.occupants`).

Rastreando quem LÊ `npc.interactions` depois disso, no runtime de jogo (não geração): **ninguém**. Os dois únicos consumidores fora do gate são `adventure-export.ts:301` (bullet de texto no markdown de download, feature cosmética pra jogadora) e os próprios testes/fixtures. O ledger que ALIMENTA o Mestre ao vivo (`seed-ledger.ts:39-47`, [Registro de entidades do mundo]) usa `npc.role`/`npc.want`/`npc.factionId` — nunca `npc.interactions`. O system prompt do turno (`dm-system.ts`) e o `buildTurnStateBlock` (US-56) também não referenciam o campo. A fala do NPC que a jogadora efetivamente ouve é gerada FRESCA a cada turno pelo Mestre (mesmo motor de narração emergente usado pra tudo), nunca a linha congelada na autoria.

### Por que a solução atual não basta

O campo custa em dois lugares sem devolver nada em troca:

- **Tokens de geração**: `speech` é mais um campo que a chamada única de autoria (`generateAdventureAuthoring`, US-232) precisa escrever pra ~7 NPCs, competindo por espaço/atenção do modelo com campos que IMPORTAM pro jogo (`want`, `role`, a ficção dos encontros).
- **Superfície de validação**: `checkInteractionReferences` existe só pra checar que `interactions[].encounterId`, quando presente, resolve — uma verificação inteira dedicada a um campo que nunca é lido depois. `checkNoOrphanNpcs` usa `interactions.length > 0` como VÁLVULA DE ESCAPE da checagem de órfão — um NPC sem local nem encontro passa hoje só porque tem uma fala solta, mesmo que essa fala nunca apareça em jogo.

### A proposta

Remover `interactions`/`AdventureNpcInteractionSchema` do schema compartilhado, `speech` do schema bruto de autoria, e toda a cadeia de minting/validação/export que os sustenta. A checagem de órfão de NPC (`checkNoOrphanNpcs`) PERDE a válvula de escape de `interactions` — pra não regredir a taxa de sucesso do gate (menos NPCs "sobram" órfãos hoje só por terem fala), o backstop determinístico que já existe pra locais órfãos ([adventure.service.ts:239-259](../../../apps/api/src/adventure/adventure.service.ts)) ganha um segundo passo: depois de cobrir os locais sem âncora, qualquer NPC AINDA sem ocupação (não é `occupant` de nenhum local nem `npcIds` de nenhum encontro) é distribuído round-robin entre os locais existentes — mesmo padrão de "NPC pode ocupar 2 locais, não é problema" já documentado ali. Isso fecha o grafo por CONSTRUÇÃO em vez de depender de um campo de conteúdo que nunca era garantido (o prompt só pede fala em "pelo menos 3" NPCs, nunca em todos).

---

## Escopo

### Dentro do escopo

- **`packages/shared/src/types/adventure-generation.ts`**: remove `AdventureNpcInteractionSchema` (linha 3-9) e o campo `interactions` de `AdventureNpcSchema` (linha 20). `AdventureNpc` (tipo inferido) perde o campo.
- **`apps/api/src/ai/ai.service.ts`**: remove `speech` de `AUTHORING_SCHEMA.npcs[]` (linha 132); ajusta a linha de ordem de emissão do `buildAuthoringPrompt` (linha 275, "locais/NPCs (com fala e o que cada um quer)" → "locais/NPCs (e o que cada um quer)").
- **`apps/api/src/adventure/adventure.service.ts`**: remove a linha `interactions: n.speech?.trim() ? [...] : []` (198) do mapeamento de `npcs`. Estende o backstop determinístico (239-259): segundo laço round-robin que garante TODO NPC em `occupants` de pelo menos um local — cobre o caso que a válvula de `interactions` cobria antes.
- **`apps/api/src/adventure-generation/adventure-gate.ts`**: remove `checkInteractionReferences` (99-108) e sua chamada em `checkReferencesResolve` (64); remove o disjunto `npc.interactions.length === 0` de `checkNoOrphanNpcs` (137) — a checagem vira só "NPC está em `encounters[].npcIds` ou `locations[].occupants`".
- **`apps/api/src/adventure-generation/monster-roles.ts`**: remove `interactions: []` do objeto retornado por `buildEncounterNpcs` (109) — função já sem chamador vivo desde a US-232 (comentário na própria linha 107), só ajusta pra tipar contra o schema novo.
- **`apps/api/src/adventure/adventure-export.ts`**: remove o laço `for (const it of npc.interactions) lines.push(...)` (301) da seção `## NPCs` do export.
- **Fixtures/testes que citam `interactions`** (remover o campo dos objetos literais, sem reescrever a asserção que já não depende dele):
  `packages/shared/src/types/adventure-generation.test.ts`,
  `apps/api/src/adventure-generation/adventure-gate.test.ts` (inclui reescrever/remover a asserção de `checkInteractionReferences` que deixa de existir),
  `apps/api/src/adventure/adventure.service.test.ts:426` (`expect(marta.interactions)...` sai; o teste continua cobrindo o resto do minting),
  `apps/api/src/adventure/adventure-export.test.ts`,
  `apps/api/src/adventure-generation/monster-roles.test.ts`,
  `apps/api/src/adventure-generation/seed-ledger.test.ts`,
  `evals/cases/us-154-eval-aventura-gerada.ts`, `evals/cases/us-170-eval-local-no-ledger.ts`, `evals/cases/us-171-eval-combatente-no-ledger.ts`.
- **Novo teste de regressão** pro backstop estendido: fixture com um NPC autoral que não aparece em nenhum `encounter.npcIds` nem `location.occupants` original passa por `generateAdventure` e sai com esse NPC presente em `occupants` de algum local (grafo fecha sem órfão, sem depender de `interactions`).
- `pnpm typecheck`, `pnpm test` e `pnpm eval` passam (mudança em `AUTHORING_SCHEMA`/prompt — regra do projeto, `AGENTS.md`).

### Fora do escopo

- **Falas de NPC na narração ao vivo.** Continuam 100% geradas pelo Mestre no turno, sem mudança — esta story só remove a versão pré-escrita que nunca chegava lá.
- **Reprocessar/backfill de aventuras já persistidas com `interactions` preenchido.** Artefato antigo não revalida contra o schema novo (mesma disciplina já documentada pra `unlocks`, [adventure-generation.ts:102-103](../../../packages/shared/src/types/adventure-generation.ts)) — campo extra em dado legado é só ignorado pelos consumidores atuais (nenhum deles lê `interactions` fora do que esta story remove).
- **`buildEncounterNpcs`/`monster-roles.ts` como um todo.** Só o literal `interactions: []` sai; a limpeza do código morto da função em si é MA-7 (fora desta story).
- **Mudar `want`/`role`/`factionId` ou qualquer outro campo de `AdventureNpcSchema`.** Só `interactions` sai.
- **Novo campo pra substituir `interactions` (ex. "ganchos de diálogo" em prosa livre dentro de `role`).** Não pedido; se a mantenedora sentir falta de uma pista de voz pro Mestre, isso é story nova, não parte desta remoção.

---

## Modelo de dados proposto

```ts
// packages/shared/src/types/adventure-generation.ts — ANTES
export const AdventureNpcSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  role: z.string().min(1),
  want: z.string().min(1),
  factionId: z.string().min(1).optional(),
  interactions: z.array(AdventureNpcInteractionSchema), // ← sai
})

// DEPOIS
export const AdventureNpcSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  role: z.string().min(1),
  want: z.string().min(1),
  factionId: z.string().min(1).optional(),
})
```

`AdventureNpcInteractionSchema` é removido por inteiro (nenhum outro schema o referencia). `AUTHORING_SCHEMA.npcs[]` perde `speech?: string`.

**Persistência:** `GeneratedAdventure` já é `Json` na tabela `Adventure` (sem coluna dedicada) — remover o campo do schema não exige migração. Registros antigos no banco mantêm `interactions` no JSON bruto (ignorado, ver *Fora do escopo*).

---

## Critérios de aceite

- [x] `AdventureNpcSchema` (shared) não tem mais o campo `interactions`; `AdventureNpcInteractionSchema` não existe mais no arquivo.
- [x] `AUTHORING_SCHEMA.npcs[]` (ai.service.ts) não tem mais `speech`.
- [x] `buildAuthoringPrompt` não instrui mais o modelo a escrever fala de NPC.
- [x] `AdventureService.generateAdventure` não minta mais `interactions` nos NPCs.
- [x] `checkInteractionReferences` não existe mais em `adventure-gate.ts`; `checkNoOrphanNpcs` não referencia `interactions`.
- [x] **Teste de regressão do backstop:** fixture com NPC autoral fora de todo `encounter.npcIds`/`location.occupants` original — depois de `generateAdventure`, esse NPC aparece em `occupants` de algum local (o gate não o marca órfão).
- [x] `adventure-export.ts` não imprime mais linhas de fala no bloco `## NPCs`.
- [x] `buildEncounterNpcs` (monster-roles.ts) compila contra o `AdventureNpc` sem `interactions`.
- [x] Nenhum teste/fixture/eval no repo referencia `interactions`/`speech` de NPC (`pnpm typecheck` pega qualquer sobra por erro de tipo).
- [x] `pnpm test` passa.
- [x] `pnpm eval` passa.

---

## Notas de implementação

- **Ordem sugerida**: schema shared → `AUTHORING_SCHEMA`/prompt (ai.service.ts) → minting + backstop estendido (adventure.service.ts) → gate (adventure-gate.ts) → export (adventure-export.ts) → `monster-roles.ts` → testes/evals por último, um `pnpm typecheck` depois de cada arquivo de produção pra pegar quebra de tipo cedo.
- **Backstop estendido**: reaproveitar exatamente o padrão já escrito em `adventure.service.ts:251-259` (`occupiedNpcIds`/`freeNpcs`/round-robin com `pool[rr % pool.length]`), só que a segunda passada itera sobre `locations` inteiro (não só as sem âncora) pra garantir que TODO `freeNpcs` restante ganhe pelo menos 1 `occupants`, não só os que cabem no número de locais órfãos.
- **`checkNoOrphanNpcs` pós-mudança**: vira `!referenced.has(npc.id)` sozinho (sem o `&& npc.interactions.length === 0`) — mais simples que antes.
- **Arquivos principais**: `packages/shared/src/types/adventure-generation.ts`, `apps/api/src/ai/ai.service.ts` (linhas 114-173 `AUTHORING_SCHEMA`, 249-277 `buildAuthoringPrompt`), `apps/api/src/adventure/adventure.service.ts` (147-278 `generateAdventure`), `apps/api/src/adventure-generation/adventure-gate.ts` (55-142), `apps/api/src/adventure/adventure-export.ts` (295-303), `apps/api/src/adventure-generation/monster-roles.ts` (94-111).

---

## Questões em aberto

Nenhuma — remoção mecânica de campo não lido em runtime, com um único ponto de design (o backstop estendido) já resolvido na proposta acima.

---

## Referências no código

- [packages/shared/src/types/adventure-generation.ts:1-21](../../../packages/shared/src/types/adventure-generation.ts) — `AdventureNpcInteractionSchema`/`AdventureNpcSchema.interactions`, o que esta story remove.
- [apps/api/src/ai/ai.service.ts:127-133](../../../apps/api/src/ai/ai.service.ts) — `AUTHORING_SCHEMA.npcs[].speech`.
- [apps/api/src/ai/ai.service.ts:275](../../../apps/api/src/ai/ai.service.ts) — linha de ordem de emissão do prompt que cita "fala".
- [apps/api/src/adventure/adventure.service.ts:192-259](../../../apps/api/src/adventure/adventure.service.ts) — minting de `npcs[]` e o backstop determinístico que ganha o segundo laço.
- [apps/api/src/adventure-generation/adventure-gate.ts:64,99-108,131-142](../../../apps/api/src/adventure-generation/adventure-gate.ts) — `checkInteractionReferences`/`checkNoOrphanNpcs`.
- [apps/api/src/adventure-generation/monster-roles.ts:94-111](../../../apps/api/src/adventure-generation/monster-roles.ts) — `buildEncounterNpcs` (já morta desde US-232, MA-7 cuida do resto).
- [apps/api/src/adventure/adventure-export.ts:295-303](../../../apps/api/src/adventure/adventure-export.ts) — bloco `## NPCs` do export.
- [apps/api/src/adventure-generation/seed-ledger.ts:39-47](../../../apps/api/src/adventure-generation/seed-ledger.ts) — consumidor real do NPC no ledger, confirma que só `role`/`want`/`factionId` alimentam o Mestre ao vivo.
- [US-144](./US-144-schema-aventura-shared.md) linhas 41-43, 68, 121, 131-132 — onde `interactions`/`AdventureNpcInteractionSchema` nasceram.
- [US-232](./US-232-schema-cresce-e-prompt-de-autoria-call-unico.md) linha 216 — onde a fala virou `npc.interactions[].narrative` mintado a partir de `speech`.
