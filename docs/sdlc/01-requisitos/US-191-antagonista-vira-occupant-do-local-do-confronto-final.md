# US-191 — Antagonista vira occupant do local do confronto final

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada
**Depende de:** [US-188](./US-188-antagonista-vira-npc-rastreavel.md) (antagonista precisa ter `id` como `AdventureNpc` — parte 1 desta story só adiciona esse `id` a um `occupants[]`, não mina o NPC) · [US-190](./US-190-antagonista-vira-passo-proprio-entre-segredos-e-encontros.md) (`generateAntagonist`/`antagonist` precisa existir antes do patch de `occupants` e antes da chamada nova de prosa)
**Relacionado:** [US-158](./US-158-locais-npcs-prosa-motor.md) (`AdventureLocationSchema.occupants`, mesmo padrão reusado na parte 1) · [US-166](./US-166-motor-gera-multiplos-encontros.md) (posição 8, confronto final — o local cuja prosa/`occupants` esta story completa) · [US-153 #4](./US-153-aventura-deixa-de-ser-derivada-da-classe.md) (disciplina "não vaza antes de merecer" — a parte 2 desta story MUDA como essa disciplina se aplica ao NOME do antagonista, ver *Contexto*)
**Criada em:** 2026-08-22 — US-188, Questão em aberto #2, decidida pela mantenedora: vale o antagonista aparecer em `locations[].occupants` do local do confronto final, mesmo padrão que NPCs sociais já usam (US-158). Escopo ampliado no mesmo dia: a mantenedora decidiu também resolver aqui a prosa de `generateOpeningBeat`/`generateLocationsAndNpcs` referenciar o antagonista por NOME dentro do local — não só a referência estrutural.

---

## História

> **Como** jogadora,
> **quero** que o local onde enfrento o antagonista já o liste como `occupant` E que a prosa (abertura e descrição do local) possa nomeá-lo,
> **para que** o vilão tenha presença reconhecível antes do confronto — não só um `id` solto em `npcIds`, mas alguém que a mesa já ouviu nomear.

---

## Contexto e motivação

### O que existe hoje (planejado, US-188/US-190 — US-190 ✅ implementada, US-188 ainda não)

- `AdventureLocationSchema.occupants` ([adventure-generation.ts:33](../../../packages/shared/src/types/adventure-generation.ts)) é `string[]` — ids de NPC preenchidos por `generateLocationsAndNpcs` (US-158), que roda no **passo 2** do pipeline ([adventure.service.ts:204-209](../../../apps/api/src/adventure/adventure.service.ts)), antes de `generateAntagonist` (US-190, [adventure.service.ts:234-244](../../../apps/api/src/adventure/adventure.service.ts)) sequer existir. Mesma barreira de ordem que a US-188 já documentou pra `npcIds`.
- `generateOpeningBeat` (`ai.service.ts:1744-1787`) JÁ recebe `antagonist` como parâmetro (US-190) e JÁ pode insinuar `method`/`trait` na cena — mas `buildOpeningBeatPrompt` ([ai.service.ts:275-290](../../../apps/api/src/ai/ai.service.ts)) monta `antagonistLine` deliberadamente SEM `antagonist.name` (comentário na linha 287-289: *"nome e weakness NÃO entram aqui... a abertura não ter como citá-lo nem por acidente"*), e o `system` prompt (linha 1778) instrui explicitamente **"NUNCA o nomeie"**. Essa regra foi decidida na US-190, Questão em aberto #2 (*"Decidido: sempre insinuar... mesma disciplina de dosagem que já protege `conclusion`/`weakness`"*).

### O problema

Duas lacunas distintas, ambas sobre o antagonista não ter NOME reconhecível antes do confronto:

1. **`occupants` é estrutural, não prosa.** Mesmo com `antagonistNpc.id` em `occupants[]` (parte 1 desta story), nenhum texto lido pela jogadora muda — `occupants` é consumido por lógica (ledger, US-189; futuros consumidores), não por narração.
2. **`generateOpeningBeat` está proibido de nomear o antagonista.** A regra "nunca nomeie" (US-190) foi decisão deliberada de anti-spoiler, mas o produto agora quer o oposto: o vilão ter nome reconhecível cedo, não só method/trait insinuados sem identidade.
3. **`generateLocationsAndNpcs` nunca teve a opção de nomear o antagonista na prosa do local** (`boxedText`/`description`) — não por proibição, mas porque roda no passo 2, antes de `antagonist` existir. Sem o dado, não há o que nomear.

### A proposta (duas partes)

**Parte 1 — `occupants` estrutural** (já detalhada na versão anterior desta story): depois que US-188 minta `antagonistNpc`, adiciona `antagonistNpc.id` a `occupants[]` do local do encontro final. Sem mudança de schema, sem chamada de modelo nova.

**Parte 2 — prosa nomeando o antagonista** (escopo novo):

- **`generateOpeningBeat`:** reverte a proibição da US-190. `buildOpeningBeatPrompt` passa a incluir `antagonist.name` em `antagonistLine`; o `system` prompt troca *"NUNCA o nomeie"* por instrução que PERMITE nomear (mantendo a proibição de revelar `weakness` — essa parte da disciplina anti-spoiler continua). Esta story documenta e implementa a reversão; não precisa de story própria porque é a MESMA função/prompt, só a regra dentro dela muda.
- **`generateLocationsAndNpcs` (local do confronto final):** como o passo 2 roda antes do antagonista existir, não dá pra regenerar a chamada original. Em vez disso, uma chamada de modelo NOVA e pontual — `generateAntagonistLocationProse` (nome provisório) — roda em paralelo ao `Promise.all` existente (`generateClosing`/`generateOpeningBeat`), recebendo o `AdventureLocation` do encontro final (já conhecido antes do antagonista, via `drafts[drafts.length - 1].location`) e `antagonist` prontos, e devolve `boxedText`/`description` REESCRITOS pra esse local — mesmos dois campos, agora citando o antagonista pelo nome. `title`/`aspects`/`occupants` do local não mudam por essa chamada (occupants é a Parte 1, patch separado).

---

## Escopo

### Dentro do escopo

**Parte 1 — `occupants` estrutural:**
- `generateAdventure`: `.map` sobre `locations[]` injeta `antagonistNpc.id` em `occupants` do local com `id === draft.location.id` (último elemento de `drafts`), guardado por `!occupants.includes(antagonistNpc.id)`.
- Teste de regressão: `occupants` do local do encontro final contém `antagonistNpc.id`; nenhum outro local ganha.

**Parte 2 — prosa nomeando:**
- `buildOpeningBeatPrompt`/`generateOpeningBeat` (`ai.service.ts`): `antagonistLine` passa a incluir `antagonist.name`; `system` prompt reverte *"NUNCA o nomeie"* pra instrução que permite nome (weakness continua proibida — só a proibição de NOME é revertida).
- `generateAntagonistLocationProse` (NOVA função, `ai.service.ts`, molde de `generateOpeningBeat`): recebe `location: AdventureLocation` (o do encontro final), `antagonist: AdventureAntagonist`, `registry`, `locale?`. Devolve `{ boxedText: string; description: string }` — reescrita dos dois campos do local, citando `antagonist.name` em pelo menos um deles.
- `generateAdventure`: chama `generateAntagonistLocationProse` dentro do `Promise.all` existente (3ª entrada, ao lado de `generateClosing`/`generateOpeningBeat` — nenhuma depende da outra, todas só precisam de `antagonist` já pronto) e, depois que resolve, faz `.map` sobre `locations[]` substituindo `boxedText`/`description` do local do encontro final pelos novos valores.
- Teste de regressão: fixture com `generateAntagonistLocationProse` mockado → `boxedText`/`description` do local do encontro final mudam pro valor mockado; outros locais não mudam. Fixture de `generateOpeningBeat` → prompt/`antagonistLine` inclui `antagonist.name`.
- Nota no backlog/US-190 registrando que a proibição de nomear na abertura (Questão em aberto #2 daquela story) foi revertida por esta story.

### Fora do escopo

- **Antagonista ocupar mais de um local.** Só o local do confronto final ganha `occupants`/prosa reescrita — reaparições em locais anteriores é escopo já excluído por US-188.
- **Mudar o formato de `occupants` ou de `AdventureLocationSchema`.** `occupants` continua `string[]`; `boxedText`/`description` continuam `string` — só o VALOR muda em tempo de execução, sem mudança de schema.
- **`title`/`aspects` do local do encontro final.** `generateAntagonistLocationProse` só reescreve `boxedText`/`description` — o nome/tema do local e seus aspectos Fate ficam como `generateLocationsAndNpcs` já decidiu no passo 2.
- **Revelar `weakness` em qualquer prosa.** A reversão da US-190 é só sobre NOME — `weakness` continua fora de qualquer prompt de prosa antes do confronto (mesma disciplina que já protege `conclusion`).
- **Prosa de outros locais/NPCs mencionar o antagonista.** Só o local do encontro final ganha reescrita — os demais locais/NPCs continuam como `generateLocationsAndNpcs` os escreveu no passo 2, sem segunda passada.

---

## Modelo de dados proposto

Nenhuma mudança de schema em `AdventureLocationSchema`/`AdventureAntagonistSchema` — só valores gerados em tempo de execução mudam.

```ts
// apps/api/src/ai/ai.service.ts — ANTAGONIST_LOCATION_PROSE_SCHEMA (NOVO)
const ANTAGONIST_LOCATION_PROSE_SCHEMA = z.object({
  boxedText: z.string().min(1),
  description: z.string().min(1),
})

async generateAntagonistLocationProse(params: {
  location: AdventureLocation
  antagonist: AdventureAntagonist
  registry: AdventureRegistry
  locale?: Locale
}): Promise<{ boxedText: string; description: string }>
```

```ts
// apps/api/src/ai/ai.service.ts — buildOpeningBeatPrompt, diff da US-190
// ANTES (US-190): nome excluído de propósito
// const antagonistLine = `Antagonista já decidido (pode insinuar, NUNCA nomear nem revelar a
//   weakness): método: ${params.antagonist.method}; traço: ${params.antagonist.trait}.`
// DEPOIS (US-191): nome incluído, weakness continua fora
const antagonistLine =
  `Antagonista já decidido — nome: ${params.antagonist.name} (pode nomeá-lo na cena; NUNCA revele a weakness): ` +
  `método: ${params.antagonist.method}; traço: ${params.antagonist.trait}.`
```

```ts
// apps/api/src/adventure/adventure.service.ts — generateAdventure, dentro do Promise.all
// existente (mais a entrada de generateAntagonistLocationProse) e no patch depois que resolve
const finalDraft = drafts[drafts.length - 1]!
const [
  { objective, conclusion, followUps, encounterSituations },
  { start },
  { boxedText, description },
] = await Promise.all([
  this.ai.generateClosing({ /* ... */ }),
  this.ai.generateOpeningBeat({ /* ... */ }),
  this.ai.generateAntagonistLocationProse({ location: finalDraft.location, antagonist, registry, locale }),
])

// depois de antagonistNpc existir (US-188) + boxedText/description resolvidos:
const locationsWithAntagonist = locations.map((loc) => {
  if (loc.id !== finalDraft.location.id) return loc
  const occupants = loc.occupants.includes(antagonistNpc.id) ? loc.occupants : [...loc.occupants, antagonistNpc.id]
  return { ...loc, occupants, boxedText, description }
})
```

---

## Critérios de aceite

**Parte 1 — `occupants`:**
- [ ] `locations[<local do encontro final>].occupants` contém o `id` do `AdventureNpc` do antagonista; nenhum outro local ganha esse `id`.
- [ ] Sem duplicata se o patch rodar sobre array que já contém o `id`.

**Parte 2 — prosa:**
- [ ] `buildOpeningBeatPrompt`/`generateOpeningBeat`: `antagonist.name` aparece no prompt; `system` permite nomear o antagonista na cena; `weakness` continua fora de qualquer prompt.
- [ ] `generateAntagonistLocationProse` existe, roda em paralelo dentro do `Promise.all` de `generateAdventure`, devolve `boxedText`/`description` não-vazios.
- [ ] `locations[<local do encontro final>].boxedText`/`.description` no artefato final são os valores devolvidos por `generateAntagonistLocationProse` (não mais os originais de `generateLocationsAndNpcs`).
- [ ] Nenhum outro local tem `boxedText`/`description` alterados.
- [ ] **Teste de regressão:** fixture com `generateAntagonistLocationProse`/`generateOpeningBeat` mockados cobre os pontos acima.
- [ ] `pnpm typecheck`, `pnpm test` e `pnpm eval` passam (muda prompt de `generateOpeningBeat` e soma uma chamada de modelo nova).

**Ambas:**
- [ ] Gate (US-150, `checkReferencesResolve`) continua passando sem mudança.

---

## Notas de implementação

- Depende de US-188 pra parte 1 (`antagonistNpc.id`); parte 2 (prosa) depende só de US-190 (`antagonist` já existente antes do `Promise.all`) — pode ser implementada mesmo antes de US-188, se a ordem de entrega fizer mais sentido assim.
- `finalDraft = drafts[drafts.length - 1]` já é conhecido ANTES de `generateAntagonist` rodar ([adventure.service.ts:226](../../../apps/api/src/adventure/adventure.service.ts), `drafts` monta antes da chamada do antagonista na linha 234) — `generateAntagonistLocationProse` pode entrar no `Promise.all` sem esperar nada além do que `generateClosing`/`generateOpeningBeat` já esperam.
- **Reversão de decisão registrada:** a proibição de nomear o antagonista em `generateOpeningBeat` foi decisão explícita da US-190 (Questão em aberto #2). Esta story a reverte deliberadamente — registrar isso na US-190 (nota apontando pra esta story) pra quem ler o histórico não achar que as duas se contradizem por engano.
- Quando US-166 estiver implementada e a posição do encontro final mudar pra `encounters[7]`/`drafts[7]`, `drafts[drafts.length - 1]` continua correto sem mudança — mesma garantia que US-188 já documenta.
- Custo: uma chamada de modelo a mais no `Promise.all` (3 → 4 chamadas paralelas nesse ponto, sem custo de latência sequencial adicional — mesma lógica que US-190 já usou pra justificar `generateAntagonist` fora do `Promise.all` só pelo motivo de SER insumo dos outros, não pelo custo em si).

---

## Referências no código

- [packages/shared/src/types/adventure-generation.ts:26-33](../../../packages/shared/src/types/adventure-generation.ts) — `AdventureLocationSchema.occupants`/`boxedText`/`description`.
- [apps/api/src/adventure/adventure.service.ts:204-209](../../../apps/api/src/adventure/adventure.service.ts) — `generateLocationsAndNpcs`, onde `boxedText`/`description`/`occupants` nascem originalmente (passo 2, antes do antagonista existir).
- [apps/api/src/adventure/adventure.service.ts:226](../../../apps/api/src/adventure/adventure.service.ts) — `drafts`, onde `finalDraft.location` já é conhecido antes de `generateAntagonist`.
- [apps/api/src/adventure/adventure.service.ts:234-274](../../../apps/api/src/adventure/adventure.service.ts) — `generateAntagonist` e o `Promise.all` onde `generateAntagonistLocationProse` entra.
- [apps/api/src/ai/ai.service.ts:275-290](../../../apps/api/src/ai/ai.service.ts) — `buildOpeningBeatPrompt`, `antagonistLine` que perde a exclusão do nome.
- [apps/api/src/ai/ai.service.ts:1744-1787](../../../apps/api/src/ai/ai.service.ts) — `generateOpeningBeat`, `system` prompt que perde "NUNCA o nomeie".
- [US-158](./US-158-locais-npcs-prosa-motor.md) — origem de `occupants`/`boxedText`/`description`, mesmo padrão reusado aqui.
- [US-188, Questão em aberto #2](./US-188-antagonista-vira-npc-rastreavel.md) — decisão original que criou a parte 1 desta story.
- [US-190, Questão em aberto #2](./US-190-antagonista-vira-passo-proprio-entre-segredos-e-encontros.md) — decisão original ("nunca nomear") que a parte 2 desta story reverte.
