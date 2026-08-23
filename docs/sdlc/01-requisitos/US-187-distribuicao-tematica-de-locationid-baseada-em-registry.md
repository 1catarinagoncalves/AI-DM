# US-187 — Distribuição de `locationId` nos encontros passa a ser temática, não só round-robin

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada (2026-08-23)
**Depende de:** [US-166](./US-166-motor-gera-multiplos-encontros.md) (`generateAdventure`, monta os 8 `AdventureEncounter` — esta story substitui o MECANISMO de escolha de `locationId` que aquela introduz; ✅ **implementada** em 22/08/2026 — dependência liberada, esta story pode entrar) · [US-158](./US-158-locais-npcs-prosa-motor.md) (`generateLocationsAndNpcs`/`LOCATIONS_AND_NPCS_SCHEMA`, ✅ implementada — ganha o campo novo e o insumo de `registry` que faltava) · [US-144](./US-144-schema-aventura-shared.md) (`AdventureLocationSchema`, ganha `vibe`)
**Relacionado:** [US-156](./US-156-catalogos-registro-dto-validacao.md)/[US-157](./US-157-tela-de-mundo-depois-da-revisao.md) (jogador escolhe `setting`/`tone`/`areaType` do registro — esta story é o primeiro consumidor real de `setting`/`areaType` além do DTO) · [US-173](./US-173-registro-fica-so-com-tone.md) (histórico: `setting`/`areaType` saíram do registro por falta de consumidor fora da rolagem — revertido no código em 21/08/2026; esta story dá a `setting`/`areaType` o primeiro consumidor real na geração de conteúdo) · [US-186](./US-186-decisao-rollcontent-nao-recebe-setting-areatype.md) (✅ implementada 22/08/2026 — cobriu o MESMO fix `setting`/`areaType` nos outros 4 consumidores de prosa, `generateLocationsAndNpcs` ficou de fora de propósito, reservado a esta story)
**Criada em:** 2026-08-21 — a partir do item "Distribuição temática de `locationId`" na seção *Fora do escopo* da US-166 (*"Round-robin é a opção barata"*), levantado pela mantenedora como story própria depois de o registro (`setting`/`tone`/`areaType`) ter sido restaurado em `AdventureRegistry`/`GeneratedAdventureSchema` no mesmo dia.
**Atualizada em:** 2026-08-23 — conferido contra o código atual (US-166 e US-186 já implementadas desde então). Nenhuma mudança de escopo: `AdventureLocationSchema` continua sem `vibe`, `generateLocationsAndNpcs`/`buildLocationsAndNpcsPrompt` continuam sem `registry.setting`/`.areaType`, `locationId` continua round-robin cego — exatamente o gap que esta story descreve. Só os números de linha mudaram (código andou por baixo com US-166/US-181/US-183/US-186/US-188/US-190); refeitas as referências abaixo e identificado o mecanismo REAL de round-robin, que não é "encounterSkeleton" como a nota antiga dizia — é `AdventureService.buildEncounterDraft` ([adventure.service.ts:144-175](../../../apps/api/src/adventure/adventure.service.ts)), linha 152 especificamente.

---

## História

> **Como** jogadora,
> **quero** que o encontro de combate aconteça num local que parece um lugar de combate, o de negociação social num local que parece social, coerente com o cenário/tipo de área que eu escolhi (ou que foi sorteado),
> **para que** a aventura pareça desenhada, não uma lista de 8 locais e 8 encontros emparelhados por sorte de índice.

---

## Contexto e motivação

### O que existe hoje

`AdventureRegistry` (código, [roll-registry.ts](../../../apps/api/src/adventure-generation/roll-registry.ts)) tem três campos — `setting`, `tone`, `areaType` — e `GeneratedAdventureSchema` carrega o registro inteiro em `registry` (schema, [adventure-generation.ts](../../../packages/shared/src/types/adventure-generation.ts)). Mas **nenhuma chamada de geração além de `tone` lê os outros dois PARA LOCAIS**: `generateLocationsAndNpcs` ([ai.service.ts:1495-1551](../../../apps/api/src/ai/ai.service.ts)) recebe `registry: AdventureRegistry` no parâmetro mas só usa `params.registry.tone` no `system` (linha 1519) — `buildLocationsAndNpcsPrompt` ([ai.service.ts:142-154](../../../apps/api/src/ai/ai.service.ts)) nem recebe `registry`, só `rolled: RolledAdventureContent`. (Os outros 4 consumidores de prosa — `generateSecrets`/`generateAntagonist`/`generateClosing`/`generateOpeningBeat` — já citam `setting`/`areaType` desde a US-186, ✅ implementada 22/08/2026; `generateLocationsAndNpcs` ficou de fora de propósito, reservada a esta story.)

`AdventureLocationSchema` ([adventure-generation.ts:27-34](../../../packages/shared/src/types/adventure-generation.ts)) não tem nenhum campo que classifique o TIPO de cena que o local sugere — só `title`/`aspects`/`boxedText`/`description`/`occupants`, prosa e ocupação, nada estrutural.

A US-166 (✅ implementada 22/08/2026) distribui `locationId` dos 8 `AdventureEncounter` por **round-robin cego**: `locations[index % locations.length]!` em `AdventureService.buildEncounterDraft` ([adventure.service.ts:144-175](../../../apps/api/src/adventure/adventure.service.ts), linha 152) — o encontro de combate na posição 8 pode cair em qualquer local, inclusive um que a prosa descreve como uma sala de chá. A própria US-166 nomeou a alternativa e a descartou por custo, na seção *Fora do escopo*: *"Distribuição temática de `locationId`. Round-robin é a opção barata."*

### O problema

Dois problemas com raiz comum — falta de sinal estrutural ligando local a tipo de cena e registro a conteúdo:

1. **`locationId` não tem relação com `type` do encontro.** Um local com `aspects: ['livraria empoeirada', 'chá quente']` pode virar o encontro `combat` final contra o antagonista, e um local com `aspects: ['covil escuro', 'ossos no chão']` pode virar o `social` de negociação. `boxedText`/`description` já escritos pelo modelo ficam narrativamente desconexos do que a mecânica (`type`) pede ali.
2. **`setting`/`areaType` nunca chegam à geração de locais.** O jogador (ou o sorteio) escolhe um `areaType` como `'dungeon'` ou `'coastal'`, mas `generateLocationsAndNpcs` nunca vê esse valor — os ~8 locais nascem sem nenhuma pressão textual coerente com o que foi escolhido/sorteado para a aventura. O design original da US-158 já previa isso (*"recebendo o conteúdo bruto da US-147 [...] registro `setting`/`tone`/`areaType`"*, [US-158, linha 33](./US-158-locais-npcs-prosa-motor.md)) — a implementação real só levou `tone` adiante, e a lacuna nunca foi fechada.

### Por que a solução atual não basta

Round-robin resolve "todo `locationId` referencia um local que existe" (grafo fecha, gate da US-150 passa) mas não resolve "o local faz sentido pro que acontece nele". É piso estrutural, não coerência temática — os dois problemas acima ficam invisíveis pra qualquer teste que só verifique referência válida.

### A proposta

Duas mudanças, uma pré-requisito da outra:

1. **`registry.setting`/`registry.areaType` entram no `system`/prompt de `generateLocationsAndNpcs`**, ao lado do `tone` que já entra — os locais nascem coerentes com o eixo completo do registro, não só o tom.
2. **`AdventureLocationSchema` ganha `vibe: 'combat' | 'skill' | 'social'`** — o próprio modelo, na mesma chamada que já escreve `aspects`/`boxedText`/`description`, rotula qual tipo de cena aquele local puxa melhor (ele já decidiu o conteúdo; só está tornando explícito o que a prosa já sugere). A distribuição de `locationId` da US-166 deixa de ser `locations[i % locations.length]` cego e passa a: agrupar locais por `vibe`, e para cada posição do encontro (com `type` já decidido pelo shuffle da US-166) fazer round-robin **dentro do subconjunto de locais daquele `vibe`**. Sem local daquele `vibe` disponível → cai no round-robin original sobre todos os locais (nunca bloqueia, nunca falha o `parse()`).

---

## Escopo

### Dentro do escopo

- `AdventureLocationSchema` (US-144, `adventure-generation.ts:27-34`) ganha `vibe: z.enum(['combat', 'skill', 'social'])` — mesmos três valores de `AdventureEncounterSchema.type` (US-166), presente em toda location gerada.
- `LOCATIONS_AND_NPCS_SCHEMA` ([ai.service.ts:118-138](../../../apps/api/src/ai/ai.service.ts)) ganha o campo espelhado em cada item de `locations[]`, com `.describe(...)` explicando ao modelo o que rotular (que tipo de cena esse local puxa melhor, dado o que ele mesmo já escreveu em `aspects`/`boxedText`/`description`).
- `generateLocationsAndNpcs`/`buildLocationsAndNpcsPrompt` passam a receber e citar `registry.setting`/`registry.areaType` no `system`, ao lado do `tone` que já é citado ([ai.service.ts:1519](../../../apps/api/src/ai/ai.service.ts)) — `buildLocationsAndNpcsPrompt` ganha `registry: AdventureRegistry` no parâmetro (hoje só recebe `rolled`).
- `AdventureService.buildEncounterDraft` ([adventure.service.ts:144-175](../../../apps/api/src/adventure/adventure.service.ts)), chamado do loop de `generateAdventure` ([adventure.service.ts:234-236](../../../apps/api/src/adventure/adventure.service.ts)) — a linha 152 (`locations[index % locations.length]!`) troca por: round-robin dentro do subconjunto `locations.filter(l => l.vibe === type)`; subconjunto vazio → round-robin sobre `locations` inteiro (fallback idêntico ao mecanismo original da US-166, nunca removido).
- Testes de regressão: fixture com locais de `vibe` variado → cada `type` de encontro recebe local do `vibe` compatível quando existe; fixture sem local do `vibe` pedido → cai no fallback round-robin; mesmo `characterId`+`order` produz a mesma distribuição (parte 100% código, `vibe` é prosa mas a escolha de índice sobre ela não é).
- `pnpm typecheck`, `pnpm test` e `pnpm eval` passam (muda schema e prompt de geração).

### Fora do escopo

- **Mudar o shuffle de `type` da US-166** (`shuffleEncounterTypes`, quais posições são `combat`/`skill`/`social`). Esta story só muda COMO `locationId` é escolhido pra um `type` já decidido, nunca o `type` em si.
- **`npcIds`/`occupants`.** Lógica de US-158/US-166 pra NPCs fica intocada — só `locationId` muda de mecanismo.
- **Garantir distribuição mínima de `vibe` por aventura** (ex.: "pelo menos 2 locais de cada `vibe`"). Sem instrução de piso no prompt — se o modelo gerar 6 `social` e 1 de cada outro, o fallback round-robin absorve o desequilíbrio sem falhar; qualidade da distribuição fica com o eval, não com validação de código (ver *Questões em aberto*).
- **`seedLedgerFromGeneratedAdventure`/`nota` do local (US-170/171).** `vibe` não entra no ledger nem no bloco de entidades do turno — é sinal só de montagem do artefato, não informação que o Mestre narra.
- **Validar coerência entre `vibe` e `areaType`/`setting`** (ex. rejeitar um `combat` de taverna num `areaType: 'dungeon'`). Estrutura é gate (US-150); coerência temática é qualidade, medida por `pnpm eval`/QA manual — mesma disciplina que o resto do motor já segue (US-180/US-182).
- **Outros consumidores de `registry.setting`/`registry.areaType`** (`generateSecrets`, `generateAntagonist`, `generateClosing`, `generateOpeningBeat`). Já resolvidos pela [US-186](./US-186-decisao-rollcontent-nao-recebe-setting-areatype.md) (✅ implementada 22/08/2026), story irmã aberta a partir da Questão em aberto #3 abaixo — esta story resolve só `generateLocationsAndNpcs`, o único que sobrou.
- **Reabrir `AdventureRegistrySchema`** ou o catálogo `SETTINGS`/`TONES`/`AREA_TYPES` (`registry-catalog.ts`). Já existem, intocados.

---

## Modelo de dados proposto

```ts
// packages/shared/src/types/adventure-generation.ts
export const AdventureLocationSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  aspects: z.array(z.string()),
  boxedText: z.string().min(1),
  description: z.string().min(1),
  occupants: z.array(z.string()),
  // NOVO (US-187): mesmos 3 valores de AdventureEncounterSchema.type (US-166) — qual tipo
  // de cena este local puxa melhor, decidido pelo modelo na mesma chamada que escreve o
  // resto da prosa. Consumido só pela distribuição de locationId, nunca pelo ledger.
  vibe: z.enum(['combat', 'skill', 'social']),
})
```

```ts
// apps/api/src/ai/ai.service.ts — LOCATIONS_AND_NPCS_SCHEMA, campo espelhado em locations[]
locations: z.array(
  z.object({
    // ...campos existentes (title/aspects/boxedText/description/occupants)
    vibe: z.enum(['combat', 'skill', 'social'])
      .describe('Que tipo de cena este local puxa melhor, dado o que você já escreveu acima'),
  }),
)
```

```ts
// apps/api/src/adventure-generation/assign-location-vibe.ts (NOVO, US-187)
// Round-robin DENTRO do subconjunto de locations com vibe === type; subconjunto vazio
// cai no round-robin original sobre locations inteiro (mesmo mecanismo da US-166, nunca
// removido). counters: contador por vibe (ou pelo índice global, no fallback), mantido
// pelo chamador ao longo do loop dos 8 encontros — determinístico, sem RNG.
// Retorna `usedFallback` (não só o `id`) pra quem chama saber, sem recalcular o filtro
// de subconjunto de novo — sem isso o log de fallback da posição 8 (ver Critérios de
// aceite) teria que repetir `locations.filter(l => l.vibe === type)` fora da função,
// duas cópias do mesmo filtro podendo divergir se só uma for editada depois.
export function pickLocationIdForType(
  locations: AdventureLocation[],
  type: 'combat' | 'skill' | 'social',
  matchedCount: number, // quantas vezes esse `type` já foi usado antes nesta aventura
  globalIndex: number,  // posição do encontro (0-7), para o fallback
): { id: string; usedFallback: boolean }
```

---

## Critérios de aceite

- [x] `AdventureLocationSchema.parse()` exige `vibe` (`'combat' | 'skill' | 'social'`) em toda location.
- [x] `LOCATIONS_AND_NPCS_SCHEMA` exige `vibe` em cada item de `locations[]`.
- [x] `system`/`buildLocationsAndNpcsPrompt` de `generateLocationsAndNpcs` citam `registry.setting` e `registry.areaType`, não só `registry.tone`.
- [x] `locationId` de cada um dos 8 encontros (US-166): quando existe ao menos um local com `vibe === type`, o escolhido tem esse `vibe`.
- [x] Sem local do `vibe` pedido disponível: `locationId` cai no round-robin `i % locations.length` original — nunca falha `.parse()` nem reduz cobertura de locais.
- [x] Mesmo `characterId`+`order`: a distribuição de `locationId` é idêntica entre execuções (parte de código); `vibe`/prosa dos locais seguem a mesma disciplina de não-determinismo que `boxedText`/`description` já têm (US-158) — não é critério exigir `vibe` idêntico entre execuções, só a lógica de escolha de índice sobre o que veio.
- [x] Gate (US-150): nenhuma verificação nova; grafo continua fechando pelas mesmas regras (`locationId` sempre referencia local existente, agora com `vibe` a mais no local, campo que o gate não lê).
- [x] **Teste de regressão:** fixture com locais de `vibe` misto → distribuição respeita `vibe` quando possível; fixture com um único `vibe` presente entre os 8 locais → os `type` sem correspondência caem no fallback, sem erro.
- [x] **Fallback na posição 8 (encontro final) gera log/warn** quando cai no round-robin cego por ausência de local `vibe:'combat'` — é o encontro mais importante da aventura, fallback aí não pode ficar silencioso como nas outras 7 posições. Usa a flag `usedFallback` devolvida por `pickLocationIdForType` (ver *Modelo de dados proposto*), não recalcula o filtro de subconjunto separado. Não bloqueia geração, só dá visibilidade pro eval (ver Questão em aberto #1).
- [x] **Todo `AdventureLocation` literal já existente em testes/evals ganha `vibe`** — `adventure.service.test.ts`, `ai.service.test.ts`, `evals/cases/us-154-eval-aventura-gerada.ts` (grep `AdventureLocation` antes de codar pra achar todos). Campo passa a ser obrigatório no schema; qualquer literal sem ele quebra `.parse()`/typecheck.
- [x] `pnpm typecheck` e `pnpm test` passam.
- [x] `pnpm eval` passa (muda prompt de `generateLocationsAndNpcs`).

---

## Notas de implementação

- **US-166 já está implementada (22/08/2026)** — esta story muda o MESMO mecanismo de distribuição de `locationId` que a US-166 introduziu: `AdventureService.buildEncounterDraft` ([adventure.service.ts:144-175](../../../apps/api/src/adventure/adventure.service.ts)), chamado dentro de `generateAdventure` ([adventure.service.ts:234-236](../../../apps/api/src/adventure/adventure.service.ts)), ANTES da montagem de `drafts`/`encounterSkeleton` que alimenta `generateClosing` (linha 286) — `encounterSkeleton` é o RESULTADO já resolvido, não o mecanismo de escolha em si; esta story mexe em `buildEncounterDraft`, não em `encounterSkeleton`.
- **`vibe` é decidido pelo modelo, nunca inferido por keyword-matching no código.** O modelo já escreve `aspects`/`boxedText`/`description` — pedir pra ele rotular o que já decidiu é barato e mais confiável que casar palavras-chave em PT/EN contra texto livre (vocabulário instável, mesma armadilha que `occupants` por nome já teve antes de virar índice, [ai.service.ts:107-116](../../../apps/api/src/ai/ai.service.ts)).
- **Contador de round-robin por `vibe` é local ao loop dos 8 encontros**, não um novo sub-seed de `deriveAdventureSeed` — a escolha em si já é determinística porque itera sobre a lista de `locations`/`type` na ordem que o código já decidiu (ordem dos locais no array + sequência de `type` do shuffle seedado da US-166); não precisa de RNG próprio.
- **`registry.setting`/`areaType` em `generateLocationsAndNpcs` é aditivo ao `system`, mesmo padrão de `Tom: ${params.registry.tone}.`** ([ai.service.ts:1519](../../../apps/api/src/ai/ai.service.ts)) — uma linha a mais, não reescreve a instrução existente. Mesmo padrão que a US-186 já aplicou nos outros 4 consumidores de prosa — só falta este.
- **`state` de `buildEncounterDraft` ([adventure.service.ts:144-175](../../../apps/api/src/adventure/adventure.service.ts)) ganha um contador POR vibe, campo NOVO — não reusar `socialIndex`.** `socialIndex` é fallback de NPC quando `location.occupants` vem vazio (mecanismo da US-166, intocado); o contador de `vibe` é escolha de LOCAL, mecanismo desta story. São dois índices independentes andando dentro do mesmo objeto `state` — misturá-los produz distribuição errada silenciosa (typecheck não pega, só teste de regressão pega).
- **Fallback na posição 8 precisa de log próprio**, não só o teste de regressão do critério de aceite. `buildEncounterDraft` já recebe `index`/`globalIndex` — condicional `index === types.length - 1 && usedFallback` (flag devolvida por `pickLocationIdForType`, ver *Modelo de dados proposto*) loga:
  ```ts
  console.warn(
    "[AdventureService][buildEncounterDraft] encontro final (posição 8, type='combat') sem local vibe:'combat' disponível — caiu no round-robin cego (fallback)",
  )
  ```
  **Não reusar `logExtractionEndpoint`** ([ai.service.ts:441](../../../apps/api/src/ai/ai.service.ts)): é função privada (não exportada), assinatura presa a `(label, model, providerMetadata)` e vive em `ai.service.ts` — `buildEncounterDraft` roda em `adventure.service.ts` sem `model`/`providerMetadata` nesse ponto, e o arquivo hoje não tem nenhum `console.*` (grep confirma). É canal NOVO ali, mesmo mecanismo (`console.*`), formato próprio.
  **Sem `characterId`/`order` na mensagem** — não vale mudar a assinatura de `buildEncounterDraft` (hoje 5 parâmetros: `type`, `index`, `locations`, `combatRoles`, `state`) só pra correlacionar o log; quem roda `pnpm eval` já sabe qual case está em execução pelo output do harness ao redor. Se a Questão em aberto #1 for reaberta com sinal de produção precisando de correlação por personagem, é mudança de escopo pequena e isolada nessa hora — não precisa ser antecipada aqui.
- **Antes de mudar o schema, grep `AdventureLocation` em `apps/api/src/**/*.test.ts` e `evals/cases/`** — todo literal construído à mão (não vindo de `generateLocationsAndNpcs`) precisa ganhar `vibe` na mesma leva, senão `pnpm typecheck`/`pnpm test` quebram fora do escopo que os critérios de aceite descrevem.

---

## Questões em aberto

1. ~~Distribuição desigual de `vibe` entre os 8 locais é aceitável?~~ **Fechada: aceitar como está, sem piso mínimo no prompt.** Com 8 locais e 3 valores possíveis, o modelo pode gerar, por exemplo, 6 `social` e 1 de cada outro — os 2 encontros `combat` restantes (posições sorteadas + a posição 8 fixa) cairiam sempre no mesmo local único de `vibe: 'combat'`, sem round-robin de verdade dentro do subconjunto. Decisão: sem dado real de quantas aventuras geram vibe desbalanceado, piso mínimo no prompt é heurística especulativa — mesma disciplina que o resto do repo já segue (US-180/182/185), qualidade de prosa se mede com `pnpm eval`, não se trava com instrução preventiva. Mitigação que JÁ entra nesta story (ver Critérios de aceite): log quando a posição 8 especificamente cai no fallback — dá o sinal que falta pra reabrir esta questão com dado real, se o log mostrar repetição incômoda em produção.
2. ~~`vibe` deveria informar `occupants`/quantidade de NPCs por local?~~ **Fechada: não.** (ex. um local `vibe: 'social'` "merece" mais `occupants` que um `vibe: 'skill'`) Decisão: `buildEncounterDraft` ([adventure.service.ts:144-175](../../../apps/api/src/adventure/adventure.service.ts)) já tem fallback quando `location.occupants` vem vazio — round-robin sobre `state.npcs` cobre um local `social` sem NPC dedicado, sem quebrar nada. Sem risco de correção, só repetição ocasional de NPC entre locais — mesma categoria de "qualidade, não bug" que já existia antes desta story. Amarrar os dois eixos (vibe → occupants) é escopo novo sem pedido nenhum puxando ele; eixos ficam independentes.
3. ~~Os outros consumidores de `registry.tone` (`generateSecrets`, `generateClosing`, `generateOpeningBeat`, ver *Fora do escopo*) deveriam ganhar `setting`/`areaType` também, na mesma leva?~~ **Resolvido pela US-186** (✅ implementada 22/08/2026) — as 4 funções (as 3 originais + `generateAntagonist`, que nasceu depois) ganharam `setting`/`areaType`. `generateLocationsAndNpcs` ficou de fora daquela story de propósito, por já ser escopo formal desta.

---

## Referências no código

- [`apps/api/src/adventure-generation/roll-registry.ts`](../../../apps/api/src/adventure-generation/roll-registry.ts) — `AdventureRegistry`/`rollRegistry`, `setting`/`areaType` restaurados em 21/08/2026 (mesmo dia desta story).
- [`apps/api/src/adventure-generation/registry-catalog.ts`](../../../apps/api/src/adventure-generation/registry-catalog.ts) — `SETTINGS`/`AREA_TYPES`, catálogos que alimentam o sorteio quando o jogador não escolhe.
- [`packages/shared/src/types/adventure-generation.ts:27-34`](../../../packages/shared/src/types/adventure-generation.ts) — `AdventureLocationSchema` (ganha `vibe`), `AdventureRegistrySchema`/`GeneratedAdventureSchema.registry` (já existem, consumidos aqui pela primeira vez além de `tone`).
- [`apps/api/src/ai/ai.service.ts:118-138`](../../../apps/api/src/ai/ai.service.ts) — `LOCATIONS_AND_NPCS_SCHEMA`, ganha `vibe` por local.
- [`apps/api/src/ai/ai.service.ts:142-154`](../../../apps/api/src/ai/ai.service.ts) — `buildLocationsAndNpcsPrompt`, ganha `registry` como parâmetro.
- [`apps/api/src/ai/ai.service.ts:1495-1551`](../../../apps/api/src/ai/ai.service.ts) — `generateLocationsAndNpcs`, `system` ganha `setting`/`areaType` ao lado do `tone` já citado na linha 1519.
- [`apps/api/src/adventure/adventure.service.ts:144-175`](../../../apps/api/src/adventure/adventure.service.ts) — `buildEncounterDraft`, linha 152 (`locations[index % locations.length]!`) é o round-robin que esta story substitui pelo round-robin filtrado por `vibe`.
- [`apps/api/src/adventure/adventure.service.ts:234-236`](../../../apps/api/src/adventure/adventure.service.ts) — `generateAdventure`, loop que chama `buildEncounterDraft` para cada um dos 8 `types`.
- [US-166](./US-166-motor-gera-multiplos-encontros.md) — ✅ implementada; *Fora do escopo*, item *"Distribuição temática de `locationId`"*, origem desta story; introduziu o `buildEncounterDraft`/round-robin que esta story substitui.
- [US-186](./US-186-decisao-rollcontent-nao-recebe-setting-areatype.md) — ✅ implementada; mesmo fix `setting`/`areaType` nos outros 4 consumidores de prosa, `generateLocationsAndNpcs` deixado de fora de propósito para esta story.
- [US-158](./US-158-locais-npcs-prosa-motor.md), linha 33 — proposta original que já previa `setting`/`tone`/`areaType` como insumo de `generateLocationsAndNpcs`; nunca implementada além de `tone`, lacuna que esta story fecha.
- [US-144](./US-144-schema-aventura-shared.md) — `AdventureLocationSchema`, schema estendido por esta story.
- [US-150](./US-150-gate-antes-de-persistir-aventura-gerada.md) — gate, inalterado por esta story (grafo continua fechando pelas mesmas regras).
