# US-185 — Mestre recebe `setting`/`areaType` em todo turno, não só `tone`

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada (21/08/2026). `pnpm typecheck` + `pnpm test` (128 shared, 148 ai-engine, 119 web, 347 api — todos verdes) + `pnpm eval` (67 passam, 2 skipped pré-existentes) verdes.
**Depende de:** Nenhuma story de código — `AdventureRegistry`/`GeneratedAdventureSchema.registry` já carregam `setting`/`areaType` (restaurados em 21/08/2026, ver [roll-registry.ts](../../../apps/api/src/adventure-generation/roll-registry.ts)/[adventure-generation.ts](../../../packages/shared/src/types/adventure-generation.ts)). Esta story só planeja o consumo que falta.
**Relacionado:** [US-187](./US-187-distribuicao-tematica-de-locationid-baseada-em-registry.md) (mesmo achado — `registry.setting`/`areaType` sem consumidor — endereçado num consumidor diferente: locais gerados, não narração de turno) · [US-186](./US-186-decisao-rollcontent-nao-recebe-setting-areatype.md) (mesma investigação, decisão de NÃO mexer na camada de rolagem de tabela) · [US-172](./US-172-abertura-gerada-nao-copia-gancho-fixo.md) (`generateOpeningBeat`, outro consumidor de `registry.tone` só) · [US-168, histórico] (`tone` chegou a `buildDmSystemPrompt`/`generateOpeningNarration`, sem `setting`/`areaType`)
**Criada em:** 2026-08-21 — levantado pela mantenedora ao perguntar "onde mais o registry precisa chegar pra a aventura fazer sentido tematicamente", depois de `setting`/`areaType` terem sido restaurados em `AdventureRegistry`/`GeneratedAdventureSchema` no mesmo dia.

---

## História

> **Como** jogadora,
> **quero** que o Mestre narre coerente com o cenário e o tipo de área que escolhi (ou que foi sorteado) pra esta aventura, em qualquer turno — não só no tom —,
> **para que** a aventura não contradiga o próprio mundo que ela mesma declarou (ex.: eu escolhi `underdark`, e o turno 5 descreve sol batendo numa praça).

---

## Contexto e motivação

### O que existe hoje

`buildDmSystemPrompt` ([dm-system.ts:275-277](../../../packages/ai-engine/src/prompts/dm-system.ts)) aceita `tone?: string` e injeta, [linha 403](../../../packages/ai-engine/src/prompts/dm-system.ts): *"Narrate in this register: ${tone}. Let it color mood, pacing and word choice **in every turn, not just the opening**."* — o comentário no próprio texto do prompt já declara a intenção de valer pro jogo inteiro, não só a abertura.

Dois pontos chamam `buildDmSystemPrompt`, os dois só passando `tone`:

1. **`streamChat`** ([ai.service.ts:577-600](../../../apps/api/src/ai/ai.service.ts)) — roda em TODO turno. `tone: (adventure.generatedAdventure as GeneratedAdventure | null)?.registry.tone` ([linha 599](../../../apps/api/src/ai/ai.service.ts)).
2. **`generateOpeningNarration`** ([ai.service.ts:1206-1244](../../../apps/api/src/ai/ai.service.ts)) — a abertura (turno 0), recebe `tone?: string` no parâmetro e repassa direto ([linha 1243](../../../apps/api/src/ai/ai.service.ts)). Alimentado por `createForCharacter` ([adventure.service.ts:323](../../../apps/api/src/adventure/adventure.service.ts)): `tone: generated.registry.tone`.

`setting`/`areaType` não aparecem em nenhum dos dois — `grep -rn "registry\.setting\|registry\.areaType" apps/api/src` não acha nada em todo o repo (confirmado na mesma investigação que abriu esta story e a US-187).

### O problema

O jogador (ou o sorteio) fixa `setting` (`fantasy`/`urban`/`wilderness`/`underdark`/`coastal`/`planar`) e `areaType` (`dungeon`/`settlement`/`wilderness`/`ruins`) — [registry-catalog.ts](../../../apps/api/src/adventure-generation/registry-catalog.ts) — mas esse valor só existe no banco (`GeneratedAdventureSchema.registry`), nunca chega ao texto que instrui o modelo a narrar. O Mestre sabe o TOM (`grimdark`, `heroic`...) em todo turno, mas não sabe se está narrando uma masmorra subterrânea ou uma cidade costeira — ele infere isso só da prosa já escrita na abertura/histórico, que pode se perder ou nunca ter sido explícita o bastante.

### Por que a solução atual não basta

`tone` sozinho não impede contradição de AMBIENTE. Um turno pode estar perfeitamente "grimdark" (tom certo) e ainda assim narrar luz de sol, gaivotas e maré baixa numa aventura que o jogador declarou `underdark`. `tone` e `setting`/`areaType` são eixos ortogonais do mesmo registro (US-147/US-156) — só um dos três chegar ao Mestre deixa os outros dois invisíveis pra narração ao vivo, apesar de existirem no artefato desde a criação da aventura.

### A proposta

`buildDmSystemPrompt` ganha `setting?: string`/`areaType?: string`, mesmo padrão opcional de `tone` — citados na mesma instrução, mesma disciplina de "vale todo turno, não só a abertura". Os dois pontos de chamada (`streamChat`, `generateOpeningNarration`) passam a repassar os três campos do registro, não só `tone`.

---

## Escopo

### Dentro do escopo

- `buildDmSystemPrompt` ([dm-system.ts:270-280](../../../packages/ai-engine/src/prompts/dm-system.ts) aprox., assinatura de `DmSystemPromptParams`) ganha `setting?: string` e `areaType?: string`.
- Instrução nova ao lado da linha do `tone` ([dm-system.ts:403](../../../packages/ai-engine/src/prompts/dm-system.ts)) — **uma frase só**, combinando `setting`+`areaType` numa condicional só (decidido, ver Questões em aberto #1), não irmã isolada de `tone`. Mesma condicional (`${x ? \`...\` : ''}`) que `tone` já usa, mesma promessa de "todo turno".
- `streamChat` ([ai.service.ts:599](../../../apps/api/src/ai/ai.service.ts)): passa `setting`/`areaType` de `adventure.generatedAdventure?.registry`, ao lado do `tone` já passado.
- `generateOpeningNarration` ([ai.service.ts:1206-1244](../../../apps/api/src/ai/ai.service.ts)): parâmetro ganha `setting?: string`/`areaType?: string` (mesmo padrão de `tone?`), repassados a `buildDmSystemPrompt`.
- `createForCharacter` ([adventure.service.ts:300-324](../../../apps/api/src/adventure/adventure.service.ts)): passa `generated.registry.setting`/`generated.registry.areaType` na chamada de `generateOpeningNarration`, ao lado de `tone: generated.registry.tone` já existente ([linha 323](../../../apps/api/src/adventure/adventure.service.ts)).
- Testes de regressão: `dm-system.test.ts` — `setting`/`areaType` presentes entram no `system`; ausentes (aventura sem motor de geração / sistema legado) não quebram nem deixam frase pela metade, mesmo comportamento condicional que `tone` já tem hoje. `ai.service.test.ts` — `streamChat`/`generateOpeningNarration` repassam os três campos do registro quando `generatedAdventure` existe.

### Fora do escopo

- **A regra de Onomástica** ("the scene's setting", [dm-system.ts:676](../../../packages/ai-engine/src/prompts/dm-system.ts)). É conceito genérico de registro de nomes, não referência literal a `AdventureRegistry.setting` — não reescrever, os dois convivem sem conflito.
- **Os quatro consumidores de geração** (`generateLocationsAndNpcs`, `generateSecrets`, `generateClosing`, `generateOpeningBeat`) — só citam `registry.tone` hoje, mesmo problema, MOMENTO diferente (criação da aventura, não narração de turno). `generateLocationsAndNpcs` é o escopo da [US-187](./US-187-distribuicao-tematica-de-locationid-baseada-em-registry.md); os outros três ficam como Questão em aberto da própria US-187 — não somados aqui de propósito, para não misturar "geração do artefato" com "narração ao vivo" na mesma story.
- **`rollContent`/tabelas LGMRD.** Decisão separada, ver [US-186](./US-186-decisao-rollcontent-nao-recebe-setting-areatype.md).
- **Validar/gate coerência entre o que o Mestre narra e `setting`/`areaType`.** Sem mecanismo pra medir isso automaticamente — fica com `pnpm eval`/QA manual, mesma disciplina do resto do motor.
- **Mudar a redação da instrução de `tone` já existente.** Só soma `setting`/`areaType` ao lado, não reescreve o que já funciona.

---

## Modelo de dados proposto

```ts
// packages/ai-engine/src/prompts/dm-system.ts
interface DmSystemPromptParams {
  // ...campos existentes
  tone?: string
  setting?: string   // NOVO (US-185)
  areaType?: string  // NOVO (US-185)
}
```

Nenhum schema Zod novo — `AdventureRegistry`/`GeneratedAdventureSchema.registry` já existem e já carregam os três campos (restaurados em 21/08/2026). Esta story só estende a assinatura de `buildDmSystemPrompt` e os dois pontos que a chamam.

---

## Critérios de aceite

- [x] `buildDmSystemPrompt` aceita `setting?`/`areaType?`; quando presentes, aparecem no texto do `system` numa frase só combinando os dois campos (decidido, Questões em aberto #1) — não frase irmã isolada de `tone`.
- [x] Instrução deixa explícito que vale **todo turno**, não só a abertura — mesma redação de intenção que `tone` já tem.
- [x] `setting`/`areaType` ausentes (aventura sem `generatedAdventure` — sistema legado, criação anterior à existência do motor): `system` sai igual ao comportamento de hoje, sem frase quebrada.
- [x] `streamChat` repassa `registry.setting`/`registry.areaType` de `adventure.generatedAdventure`, ao lado de `registry.tone` já repassado.
- [x] `generateOpeningNarration` aceita `setting?`/`areaType?` e repassa a `buildDmSystemPrompt`; `createForCharacter` os passa a partir de `generated.registry`.
- [x] **Teste de regressão:** `dm-system.test.ts` cobre presença/ausência dos dois campos novos, mesmo padrão dos testes de `tone` existentes; `ai.service.test.ts` cobre `generateOpeningNarration` repassando os três campos do registro. `streamChat` **não** ganhou teste direto — achado na implementação: nem `tone` tem ([ai.service.test.ts:216](../../../apps/api/src/ai/ai.service.test.ts), comentário explícito: exige montar personagem/aventura/quests inteiros pro `onFinish` rodar); `setting`/`areaType` seguem a mesma linha já passada sem teste dedicado, coberta por `typecheck`.
- [x] `pnpm typecheck` e `pnpm test` passam.
- [x] `pnpm eval` passa (muda prompt usado em todo turno — regra do projeto, `AGENTS.md`).

---

## Notas de implementação

- **Reusa o padrão condicional exato de `tone`** ([dm-system.ts:403](../../../packages/ai-engine/src/prompts/dm-system.ts), `${tone ? \`...\` : ''}`) — `setting`/`areaType` entram do mesmo jeito, sem introduzir um segundo estilo de instrução condicional no mesmo arquivo.
- **`setting`/`areaType` guardam a CHAVE canônica** (`underdark`, não "Undercomum"/rótulo) — mesmo contrato que `tone` já segue (`catalogLabel`, US-105). Se algum dia a instrução quiser o RÓTULO em vez da chave, é resolução de leitura no ponto de uso, não mudança de schema.
- **Sem sub-seed nem RNG novo** — os três campos já existem prontos em `GeneratedAdventure.registry`, só faltava o cano até `buildDmSystemPrompt`.
- **`setting`+`areaType` numa frase só, combinados** (decidido — Questões em aberto #1) — não uma instrução por campo. Os dois são par correlato (masmorra subterrânea vs. cidade costeira já embutem ambos) e vêm do mesmo `registry`, sem caso de só um presente; `tone` continua isolado por ser eixo ortogonal (US-147/US-156).
- **Sem exemplo negativo (o que EVITAR) por agora** (decidido — Questões em aberto #2) — implementa só a instrução afirmativa. Só volta a considerar exemplo negativo se `pnpm eval` mostrar contradição de ambiente de fato (ex.: sol num `underdark`), mesma cautela de US-180/US-182.

---

## Questões em aberto

1. ~~Uma frase só ou duas instruções separadas?~~ **Decidido: uma frase só**, combinando `setting`+`areaType` numa condicional (não irmã isolada de `tone`). Razão: os dois são par correlato — masmorra subterrânea vs. cidade costeira já embutem ambos —, enquanto `tone` é eixo ortogonal (US-147/US-156); os dois campos vêm do mesmo `registry`, sem caso de só um presente, então uma condicional combinada basta.
2. ~~Reforçar com exemplo negativo?~~ **Decidido: não, por agora.** Mesma cautela que US-180/US-182 registraram: cedo pra prescrever sem ver saída real. Implementa sem exemplo negativo, roda `pnpm eval`, só adiciona se o eval mostrar contradição de ambiente de fato (ex.: sol num `underdark`).

---

## Referências no código

- [`packages/ai-engine/src/prompts/dm-system.ts:275-277,403`](../../../packages/ai-engine/src/prompts/dm-system.ts) — `buildDmSystemPrompt`, assinatura e instrução de `tone`, ponto exato da extensão.
- [`apps/api/src/ai/ai.service.ts:577-600`](../../../apps/api/src/ai/ai.service.ts) — `streamChat`, chamada de `buildDmSystemPrompt` em todo turno.
- [`apps/api/src/ai/ai.service.ts:1206-1244`](../../../apps/api/src/ai/ai.service.ts) — `generateOpeningNarration`, chamada de `buildDmSystemPrompt` na abertura.
- [`apps/api/src/adventure/adventure.service.ts:300-324`](../../../apps/api/src/adventure/adventure.service.ts) — `createForCharacter`, ponto que hoje passa só `tone: generated.registry.tone` pra `generateOpeningNarration`.
- [`apps/api/src/adventure-generation/roll-registry.ts`](../../../apps/api/src/adventure-generation/roll-registry.ts) / [`registry-catalog.ts`](../../../apps/api/src/adventure-generation/registry-catalog.ts) — `AdventureRegistry`, `SETTINGS`/`AREA_TYPES`, fonte dos dois campos novos.
- [`packages/shared/src/types/adventure-generation.ts`](../../../packages/shared/src/types/adventure-generation.ts) — `AdventureRegistrySchema`/`GeneratedAdventureSchema.registry`, já carregam os três campos.
- [US-187](./US-187-distribuicao-tematica-de-locationid-baseada-em-registry.md) — mesmo achado, consumidor de geração (não narração).
- [US-186](./US-186-decisao-rollcontent-nao-recebe-setting-areatype.md) — mesma investigação, decisão de não mexer na rolagem de tabela.
