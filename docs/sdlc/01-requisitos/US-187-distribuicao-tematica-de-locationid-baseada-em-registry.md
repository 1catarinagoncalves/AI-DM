# US-187 — Distribuição de `locationId` nos encontros passa a ser temática, não só round-robin

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** [US-166](./US-166-motor-gera-multiplos-encontros.md) (`generateAdventure`, monta os 8 `AdventureEncounter` — esta story substitui o MECANISMO de escolha de `locationId` que aquela introduz; US-166 **ainda não implementada**, esta story não pode entrar antes dela) · [US-158](./US-158-locais-npcs-prosa-motor.md) (`generateLocationsAndNpcs`/`LOCATIONS_AND_NPCS_SCHEMA`, ✅ implementada — ganha o campo novo e o insumo de `registry` que faltava) · [US-144](./US-144-schema-aventura-shared.md) (`AdventureLocationSchema`, ganha `vibe`)
**Relacionado:** [US-156](./US-156-catalogos-registro-dto-validacao.md)/[US-157](./US-157-tela-de-mundo-depois-da-revisao.md) (jogador escolhe `setting`/`tone`/`areaType` do registro — esta story é o primeiro consumidor real de `setting`/`areaType` além do DTO) · [US-173](./US-173-registro-fica-so-com-tone.md) (histórico: `setting`/`areaType` saíram do registro por falta de consumidor fora da rolagem — revertido no código em 21/08/2026; esta story dá a `setting`/`areaType` o primeiro consumidor real na geração de conteúdo)
**Criada em:** 2026-08-21 — a partir do item "Distribuição temática de `locationId`" na seção *Fora do escopo* da US-166 (*"Round-robin é a opção barata"*), levantado pela mantenedora como story própria depois de o registro (`setting`/`tone`/`areaType`) ter sido restaurado em `AdventureRegistry`/`GeneratedAdventureSchema` no mesmo dia.

---

## História

> **Como** jogadora,
> **quero** que o encontro de combate aconteça num local que parece um lugar de combate, o de negociação social num local que parece social, coerente com o cenário/tipo de área que eu escolhi (ou que foi sorteado),
> **para que** a aventura pareça desenhada, não uma lista de 8 locais e 8 encontros emparelhados por sorte de índice.

---

## Contexto e motivação

### O que existe hoje

`AdventureRegistry` (código, [roll-registry.ts](../../../apps/api/src/adventure-generation/roll-registry.ts)) tem três campos — `setting`, `tone`, `areaType` — e `GeneratedAdventureSchema` carrega o registro inteiro em `registry` (schema, [adventure-generation.ts](../../../packages/shared/src/types/adventure-generation.ts)). Mas **nenhuma chamada de geração além de `tone` lê os outros dois**: `grep -rn "registry\.setting\|registry\.areaType" apps/api/src` não acha nada. `generateLocationsAndNpcs` ([ai.service.ts:1368-1398](../../../apps/api/src/ai/ai.service.ts)) recebe `registry: AdventureRegistry` no parâmetro mas só usa `params.registry.tone` no `system` — `buildLocationsAndNpcsPrompt` ([ai.service.ts:141-153](../../../apps/api/src/ai/ai.service.ts)) nem recebe `registry`, só `rolled: RolledAdventureContent`.

`AdventureLocationSchema` ([adventure-generation.ts](../../../packages/shared/src/types/adventure-generation.ts)) não tem nenhum campo que classifique o TIPO de cena que o local sugere — só `title`/`aspects`/`boxedText`/`description`/`occupants`, prosa e ocupação, nada estrutural.

A US-166 (📋 planejada, não implementada) propõe distribuir `locationId` dos 8 `AdventureEncounter` por **round-robin cego**: `locations[i % locations.length]` — o encontro de combate na posição 8 pode cair em qualquer local, inclusive um que a prosa descreve como uma sala de chá. A própria US-166 nomeia a alternativa e a descarta por custo, na seção *Fora do escopo*: *"Distribuição temática de `locationId`. Round-robin é a opção barata."*

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

- `AdventureLocationSchema` (US-144, `adventure-generation.ts`) ganha `vibe: z.enum(['combat', 'skill', 'social'])` — mesmos três valores de `AdventureEncounterSchema.type` (US-166), presente em toda location gerada.
- `LOCATIONS_AND_NPCS_SCHEMA` ([ai.service.ts:117-137](../../../apps/api/src/ai/ai.service.ts)) ganha o campo espelhado em cada item de `locations[]`, com `.describe(...)` explicando ao modelo o que rotular (que tipo de cena esse local puxa melhor, dado o que ele mesmo já escreveu em `aspects`/`boxedText`/`description`).
- `generateLocationsAndNpcs`/`buildLocationsAndNpcsPrompt` passam a receber e citar `registry.setting`/`registry.areaType` no `system`, ao lado do `tone` que já é citado ([ai.service.ts:1392](../../../apps/api/src/ai/ai.service.ts)) — `buildLocationsAndNpcsPrompt` ganha `registry: AdventureRegistry` no parâmetro (hoje só recebe `rolled`).
- A montagem de `encounterSkeleton`/`encounters[]` da US-166 (`locationId` de cada um dos 8) troca `locations[i % locations.length]` por: round-robin dentro do subconjunto `locations.filter(l => l.vibe === type)`; subconjunto vazio → round-robin sobre `locations` inteiro (fallback idêntico ao mecanismo original da US-166, nunca removido).
- Testes de regressão: fixture com locais de `vibe` variado → cada `type` de encontro recebe local do `vibe` compatível quando existe; fixture sem local do `vibe` pedido → cai no fallback round-robin; mesmo `characterId`+`order` produz a mesma distribuição (parte 100% código, `vibe` é prosa mas a escolha de índice sobre ela não é).
- `pnpm typecheck`, `pnpm test` e `pnpm eval` passam (muda schema e prompt de geração).

### Fora do escopo

- **Mudar o shuffle de `type` da US-166** (`shuffleEncounterTypes`, quais posições são `combat`/`skill`/`social`). Esta story só muda COMO `locationId` é escolhido pra um `type` já decidido, nunca o `type` em si.
- **`npcIds`/`occupants`.** Lógica de US-158/US-166 pra NPCs fica intocada — só `locationId` muda de mecanismo.
- **Garantir distribuição mínima de `vibe` por aventura** (ex.: "pelo menos 2 locais de cada `vibe`"). Sem instrução de piso no prompt — se o modelo gerar 6 `social` e 1 de cada outro, o fallback round-robin absorve o desequilíbrio sem falhar; qualidade da distribuição fica com o eval, não com validação de código (ver *Questões em aberto*).
- **`seedLedgerFromGeneratedAdventure`/`nota` do local (US-170/171).** `vibe` não entra no ledger nem no bloco de entidades do turno — é sinal só de montagem do artefato, não informação que o Mestre narra.
- **Validar coerência entre `vibe` e `areaType`/`setting`** (ex. rejeitar um `combat` de taverna num `areaType: 'dungeon'`). Estrutura é gate (US-150); coerência temática é qualidade, medida por `pnpm eval`/QA manual — mesma disciplina que o resto do motor já segue (US-180/US-182).
- **Outros consumidores de `registry.setting`/`registry.areaType`** (`generateSecrets`, `generateClosing`, `generateOpeningBeat` também só usam `tone` hoje). Fora do escopo — candidato a stories próprias se o eval mostrar necessidade; esta story resolve só `generateLocationsAndNpcs`, o consumidor mais direto de `areaType`.
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
export function pickLocationIdForType(
  locations: AdventureLocation[],
  type: 'combat' | 'skill' | 'social',
  matchedCount: number, // quantas vezes esse `type` já foi usado antes nesta aventura
  globalIndex: number,  // posição do encontro (0-7), para o fallback
): string
```

---

## Critérios de aceite

- [ ] `AdventureLocationSchema.parse()` exige `vibe` (`'combat' | 'skill' | 'social'`) em toda location.
- [ ] `LOCATIONS_AND_NPCS_SCHEMA` exige `vibe` em cada item de `locations[]`.
- [ ] `system`/`buildLocationsAndNpcsPrompt` de `generateLocationsAndNpcs` citam `registry.setting` e `registry.areaType`, não só `registry.tone`.
- [ ] `locationId` de cada um dos 8 encontros (US-166): quando existe ao menos um local com `vibe === type`, o escolhido tem esse `vibe`.
- [ ] Sem local do `vibe` pedido disponível: `locationId` cai no round-robin `i % locations.length` original — nunca falha `.parse()` nem reduz cobertura de locais.
- [ ] Mesmo `characterId`+`order`: a distribuição de `locationId` é idêntica entre execuções (parte de código); `vibe`/prosa dos locais seguem a mesma disciplina de não-determinismo que `boxedText`/`description` já têm (US-158) — não é critério exigir `vibe` idêntico entre execuções, só a lógica de escolha de índice sobre o que veio.
- [ ] Gate (US-150): nenhuma verificação nova; grafo continua fechando pelas mesmas regras (`locationId` sempre referencia local existente, agora com `vibe` a mais no local, campo que o gate não lê).
- [ ] **Teste de regressão:** fixture com locais de `vibe` misto → distribuição respeita `vibe` quando possível; fixture com um único `vibe` presente entre os 8 locais → os `type` sem correspondência caem no fallback, sem erro.
- [ ] `pnpm typecheck` e `pnpm test` passam.
- [ ] `pnpm eval` passa (muda prompt de `generateLocationsAndNpcs`).

---

## Notas de implementação

- **Esta story só entra depois de a US-166 estar implementada** — ela muda o MESMO mecanismo de distribuição de `locationId` que a US-166 introduz (`encounterSkeleton`, montado antes do `Promise.all([generateClosing, generateOpeningBeat])`, [adventure.service.ts:158-189](../../../apps/api/src/adventure/adventure.service.ts) na numeração atual, sujeita a mudar quando a US-166 for escrita). Se o desenho da US-166 mudar antes de ser implementada, esta story se ajusta ao desenho final, não ao rascunho atual.
- **`vibe` é decidido pelo modelo, nunca inferido por keyword-matching no código.** O modelo já escreve `aspects`/`boxedText`/`description` — pedir pra ele rotular o que já decidiu é barato e mais confiável que casar palavras-chave em PT/EN contra texto livre (vocabulário instável, mesma armadilha que `occupants` por nome já teve antes de virar índice, [ai.service.ts:107-116](../../../apps/api/src/ai/ai.service.ts)).
- **Contador de round-robin por `vibe` é local ao loop dos 8 encontros**, não um novo sub-seed de `deriveAdventureSeed` — a escolha em si já é determinística porque itera sobre a lista de `locations`/`type` na ordem que o código já decidiu (ordem dos locais no array + sequência de `type` do shuffle seedado da US-166); não precisa de RNG próprio.
- **`registry.setting`/`areaType` em `generateLocationsAndNpcs` é aditivo ao `system`, mesmo padrão de `Tom: ${params.registry.tone}.`** ([ai.service.ts:1392](../../../apps/api/src/ai/ai.service.ts)) — uma linha a mais, não reescreve a instrução existente.

---

## Questões em aberto

1. **Distribuição desigual de `vibe` entre os 8 locais é aceitável?** Com 8 locais e 3 valores possíveis, o modelo pode gerar, por exemplo, 6 `social` e 1 de cada outro — os 2 encontros `combat` restantes (posições sorteadas + a posição 8 fixa) cairiam sempre no mesmo local único de `vibe: 'combat'`, sem round-robin de verdade dentro do subconjunto. Não decidido: aceitar como está (fallback já cobre o caso de zero) ou somar instrução de piso mínimo por `vibe` no prompt, se o eval mostrar repetição de local incômoda.
2. **`vibe` deveria informar `occupants`/quantidade de NPCs por local** (ex. um local `vibe: 'social'` "merece" mais `occupants` que um `vibe: 'skill'`)? Não pedido, não decidido — eixos tratados como independentes nesta story; abrir só se o eval mostrar local social vazio de NPC.
3. **Os outros consumidores de `registry.tone`** (`generateSecrets`, `generateClosing`, `generateOpeningBeat`, ver *Fora do escopo*) deveriam ganhar `setting`/`areaType` também, na mesma leva? Adiado — cada chamada tem seu próprio motivo pra citar (ou não) cada eixo do registro; decisão story a story, não em lote aqui.

---

## Referências no código

- [`apps/api/src/adventure-generation/roll-registry.ts`](../../../apps/api/src/adventure-generation/roll-registry.ts) — `AdventureRegistry`/`rollRegistry`, `setting`/`areaType` restaurados em 21/08/2026 (mesmo dia desta story).
- [`apps/api/src/adventure-generation/registry-catalog.ts`](../../../apps/api/src/adventure-generation/registry-catalog.ts) — `SETTINGS`/`AREA_TYPES`, catálogos que alimentam o sorteio quando o jogador não escolhe.
- [`packages/shared/src/types/adventure-generation.ts`](../../../packages/shared/src/types/adventure-generation.ts) — `AdventureLocationSchema` (ganha `vibe`), `AdventureRegistrySchema`/`GeneratedAdventureSchema.registry` (já existem, consumidos aqui pela primeira vez além de `tone`).
- [`apps/api/src/ai/ai.service.ts:117-137`](../../../apps/api/src/ai/ai.service.ts) — `LOCATIONS_AND_NPCS_SCHEMA`, ganha `vibe` por local.
- [`apps/api/src/ai/ai.service.ts:141-153`](../../../apps/api/src/ai/ai.service.ts) — `buildLocationsAndNpcsPrompt`, ganha `registry` como parâmetro.
- [`apps/api/src/ai/ai.service.ts:1368-1398`](../../../apps/api/src/ai/ai.service.ts) — `generateLocationsAndNpcs`, `system` ganha `setting`/`areaType` ao lado do `tone` já citado na linha 1392.
- [US-166](./US-166-motor-gera-multiplos-encontros.md) — *Fora do escopo*, item *"Distribuição temática de `locationId`"*, origem desta story; *Escopo*, item `locationId` round-robin, mecanismo que esta story substitui.
- [US-158](./US-158-locais-npcs-prosa-motor.md), linha 33 — proposta original que já previa `setting`/`tone`/`areaType` como insumo de `generateLocationsAndNpcs`; nunca implementada além de `tone`, lacuna que esta story fecha.
- [US-144](./US-144-schema-aventura-shared.md) — `AdventureLocationSchema`, schema estendido por esta story.
- [US-150](./US-150-gate-antes-de-persistir-aventura-gerada.md) — gate, inalterado por esta story (grafo continua fechando pelas mesmas regras).
