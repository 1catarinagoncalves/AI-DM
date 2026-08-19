# US-177 — `generateLocationsAndNpcs` ganha a regra de Onomástica (hoje inventa nome sem registro nenhum)

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** nenhuma — `registry.tone` já chega em `generateLocationsAndNpcs` ([ai.service.ts:1359](../../../apps/api/src/ai/ai.service.ts)), a seção de Onomástica já existe pronta em [dm-system.ts:180-201](../../../packages/ai-engine/src/prompts/dm-system.ts); é extração + reuso, não peça nova.
**Relacionado:** [US-158](./US-158-locais-npcs-prosa-motor.md) (dona de `generateLocationsAndNpcs`, onde o nome do NPC nasce hoje sem regra) · [US-176](./US-176-generatesecrets-recebe-tone-do-registro.md) (precedente recente do mesmo tipo de gap: chamada do motor cega a uma barra que as outras já seguem) · [US-34](./US-34-qualidade-da-narracao-do-dm.md) (origem da barra de ofício/Onomástica na narração ao vivo)
**Criada em:** 2026-08-19 — achado ao levantar, a pedido da mantenedora, quais boas práticas de nome de personagem existem no prompt hoje: a resposta é "só na narração ao vivo" (`buildDmSystemPrompt`); o motor de geração (`generateLocationsAndNpcs`, que já MINTA nome de NPC antes de qualquer turno acontecer) não usa nenhuma delas.

---

## História

> **Como** mantenedora,
> **quero** que `generateLocationsAndNpcs` siga a mesma regra de Onomástica (registro por cultura/cena, invenção do zero, proibição de nome genérico e de repetir nome) que já governa a narração ao vivo do Mestre,
> **para que** NPCs e locais nascidos no motor — que viram CANON imutável da aventura (ADR 012) antes mesmo da primeira cena — não sejam o elo fraco que solta um "Elara"/"Thorin" genérico numa aventura cujo Mestre, no mesmo jogo, está proibido de fazer exatamente isso.

---

## Contexto e motivação

### O problema observado

O `system` de `generateLocationsAndNpcs` ([ai.service.ts:1356-1359](../../../apps/api/src/ai/ai.service.ts)) hoje é:

```
'Você é o Mestre de um RPG vestindo de prosa o conteúdo bruto rolado de uma aventura one-shot (método Lazy GM Resource Document). ' +
'Para cada NPC, invente NOME e um ARQUÉTIPO DE FICÇÃO POPULAR a partir do comportamento/ancestralidade dados — nunca invente comportamento ou ancestralidade além do que foi rolado. ' +
`Tom: ${params.registry.tone}. ${bondsInstruction}`,
```

A única instrução sobre o nome inteiro é o verbo "invente NOME" — zero critério de registro/cultura, zero proibição de nome genérico, zero proibição de repetir nome entre NPCs/locais da mesma aventura. O mesmo vale para `locations[].title` (nome de vila, taverna, monumento — `AdventureLocationSchema`, [adventure-generation.ts:27-34](../../../packages/shared/src/types/adventure-generation.ts)): nenhuma seção do prompt toca nome próprio de lugar.

Compare com a seção `### Onomastics` que já existe para a narração ao vivo ([dm-system.ts:180-201](../../../packages/ai-engine/src/prompts/dm-system.ts)): 3 passos obrigatórios (escolher registro de propósito pela raça/classe/cenário, inventar do zero nesse som, nunca reaproveitar nome já dado a outra pessoa/lugar da aventura), cheat-sheet de 10+ registros culturais, proibição explícita de "generic default names" e de dar o mesmo som a culturas diferentes. Essa barra é reforçada de novo na abertura ([dm-system.ts:643](../../../packages/ai-engine/src/prompts/dm-system.ts)).

### Por que a solução atual não basta

`generateLocationsAndNpcs` e `buildDmSystemPrompt` são duas chamadas de IA completamente separadas, com dois `system` prompts escritos à mão em dois lugares do código — não há herança nem import entre eles hoje. A disciplina de Onomástica vive SÓ no segundo. Como `generateLocationsAndNpcs` roda ANTES de qualquer turno (os NPCs/locais que produz viram dado persistido, canon imutável da aventura pelo ADR 012), qualquer nome genérico que ele solte fica gravado — e a partir daí o próprio Mestre ao vivo, que é PROIBIDO de inventar nome genérico, é obrigado a repetir esse nome genérico toda vez que o NPC aparece, porque nomear de novo quebraria a continuidade. A regra de qualidade que a US-34 (e a barra de ofício) instituiu para a mesa é furada na origem, não na mesa.

### A proposta

Extrair a seção `### Onomastics` de `NARRATIVE_CRAFT_SECTION` para uma const própria e exportada em `dm-system.ts` (mantendo-a interpolada de volta no mesmo lugar dentro de `NARRATIVE_CRAFT_SECTION`, texto renderizado idêntico), e importar essa const no `system` de `generateLocationsAndNpcs`, ancorada em `registry.tone` (já disponível ali).

---

## Escopo

### Dentro do escopo

- Nova const exportada em `dm-system.ts` (ex.: `ONOMASTICS_SECTION`) contendo exatamente o texto hoje entre `### Onomastics` (linha 180) e o fim do parágrafo "OPEN PALETTE" (linha 201) de `NARRATIVE_CRAFT_SECTION`.
- `NARRATIVE_CRAFT_SECTION` passa a interpolar `${ONOMASTICS_SECTION}` no mesmo ponto — texto final **byte-idêntico** ao atual (ver Notas: guard de drift da US-36/rubric.ts depende disso).
- `generateLocationsAndNpcs` ([ai.service.ts:1353-1362](../../../apps/api/src/ai/ai.service.ts)) importa `ONOMASTICS_SECTION` de `@ai-dm/ai-engine` e acrescenta ao `system`, na mesma chamada, mesmo formato de concatenação já usado ali.
- `locations[].title`/`boxedText`/`description` e `npcs[].name` ficam sob a regra (é a mesma seção que já cobre "NPCs, villages, inns, rivers, swords, ships" no prompt de narração — nenhuma redação nova, só reuso).
- Teste de regressão em `ai.service.test.ts`: o `system` passado ao `generateObject` mockado em `generateLocationsAndNpcs` contém o texto/marcador da seção de Onomástica.
- `pnpm eval` roda e passa (mudança em prompt do motor de geração — regra do projeto, `AGENTS.md`).

### Fora do escopo

- **`generateSecrets`/`generateClosing`** — não cunham nome próprio novo hoje (segredos referenciam `locationId`/NPC já existentes por `id`; o fecho narra em cima do que já foi decidido). Se um eval futuro mostrar que algum deles inventa nome próprio solto, vira story própria — não presumir aqui.
- **Passar `characterRace`/`characterClass` para `generateLocationsAndNpcs` como âncora extra de registro** — a seção de Onomástica na narração ao vivo ancora o registro em "raça/classe do personagem + cenário"; `generateLocationsAndNpcs` hoje só tem `registry.tone` (não recebe raça/classe do personagem, ver `adventure.service.ts:139`). **Decidido: não precisa.** `tone` + o LGMRD rolado (`premissa`/`locais`/`monumentos` como pista de cenário) bastam de âncora. Ver Questão em aberto #1.
- **Backfill de aventuras já geradas** com nomes genéricos — esta story só corrige o prompt daqui pra frente.
- **Schema (`AdventureNpcSchema`/`AdventureLocationSchema`)** — não muda; a regra vive só no texto do `system`, não vira campo novo.

---

## Critérios de aceite

- [ ] `ONOMASTICS_SECTION` existe como const exportada em `dm-system.ts`.
- [ ] `NARRATIVE_CRAFT_SECTION` interpola `ONOMASTICS_SECTION` e o texto renderizado final é idêntico ao de hoje — `rubric-drift.test.ts` (`REVIEWED_CRAFT_HASH`) continua passando SEM precisar trocar o hash.
- [ ] `system` de `generateLocationsAndNpcs` inclui o texto de `ONOMASTICS_SECTION`.
- [ ] Teste novo/atualizado em `ai.service.test.ts` verifica que o `system` recebido pelo `generateObject` mockado contém a seção de Onomástica.
- [ ] `pnpm typecheck`, `pnpm test` e `pnpm eval` passam.

---

## Notas de implementação

- **Pontos exatos a tocar:** [dm-system.ts:169-201](../../../packages/ai-engine/src/prompts/dm-system.ts) (extrair a const); [ai.service.ts:1353-1362](../../../apps/api/src/ai/ai.service.ts) (usar a const no `system` de `generateLocationsAndNpcs`).
- **Guard de drift (US-36):** `rubric-drift.test.ts:19` fixa `REVIEWED_CRAFT_HASH` como hash SHA-256 do VALOR de `NARRATIVE_CRAFT_SECTION` — não da posição do texto no arquivo. Splicar a Onomástica pra fora e interpolar de volta no mesmo ponto, com a MESMA string, mantém o hash igual (extração pura, sem reescrever uma vírgula). Se o hash mudar mesmo assim, é sinal de que o texto foi alterado sem querer no meio da extração — revisar caractere a caractere antes de atualizar o hash.
- **`system` de `generateLocationsAndNpcs` é concatenação de strings** (`+`), não um único template — inserir `ONOMASTICS_SECTION` como mais um termo concatenado, sem quebrar a frase final `` `Tom: ${params.registry.tone}. ${bondsInstruction}` ``.
- **Mistura de idioma já é o padrão do projeto**: `ONOMASTICS_SECTION` é em inglês (como o resto de `dm-system.ts`); o restante do `system` de `generateLocationsAndNpcs` é em português. `buildDmSystemPrompt` já mistura os dois hoje (instrução em inglês, saída no idioma do jogador) — não é inconsistência nova, é o mesmo padrão replicado.
- **`ai-engine` já é dependência de `apps/api`** (ai.service.ts importa `NARRATIVE_CRAFT_SECTION`-adjacent hoje via outros exports do pacote) — checar se precisa rebuild (`pnpm --filter @ai-dm/ai-engine build`) antes de rodar `apps/api` em dev, mesma armadilha de sempre do monorepo (dist vs src).

---

## Questões em aberto

1. **Decidido: não precisa.** `registry.tone` + o conteúdo já rolado (`premissa`/`locais`/`monumentos`) bastam de âncora de registro; `characterRace`/`characterClass` não entram como parâmetro novo na assinatura da função.
2. **Decidido: não precisa de eval dedicado.** Teste unitário (seção presente no `system`) já é sinal suficiente para esta story; eval qualitativo (LLM-judge, molde da US-36) fica para iteração futura se o problema persistir na prática.

---

## Referências no código

- [packages/ai-engine/src/prompts/dm-system.ts:169-201](../../../packages/ai-engine/src/prompts/dm-system.ts) — `NARRATIVE_CRAFT_SECTION`, onde a seção `### Onomastics` vive hoje, a extrair.
- [packages/ai-engine/src/prompts/dm-system.ts:643](../../../packages/ai-engine/src/prompts/dm-system.ts) — reforço da regra de Onomástica na instrução de abertura (`buildOpeningInstruction`), referência de como a regra já é citada em mais de um lugar da narração.
- [apps/api/src/ai/ai.service.ts:1340-1387](../../../apps/api/src/ai/ai.service.ts) — `generateLocationsAndNpcs`, `system` a alterar (linhas 1356-1359).
- [packages/shared/src/types/adventure-generation.ts:11-34](../../../packages/shared/src/types/adventure-generation.ts) — `AdventureNpcSchema`/`AdventureLocationSchema`, campos de nome próprio (`name`, `title`) que passam a ficar sob a regra.
- [packages/ai-engine/src/rubric-drift.test.ts](../../../packages/ai-engine/src/rubric-drift.test.ts) — guard de hash que trava se `NARRATIVE_CRAFT_SECTION` mudar de valor; verificar que continua verde após a extração.
- [docs/adr/012-aventura-gerada-como-dado.md](../../adr/012-aventura-gerada-como-dado.md) — por que NPC/local do motor viram canon imutável (motivo de esta story importar: o nome genérico, uma vez gerado, fica).
- [US-158](./US-158-locais-npcs-prosa-motor.md) — story original de `generateLocationsAndNpcs`, onde "invente NOME" entrou sem regra de registro.
- [US-176](./US-176-generatesecrets-recebe-tone-do-registro.md) — precedente do mesmo padrão de achado (chamada do motor cega a uma barra que as chamadas irmãs/a narração já seguem).
