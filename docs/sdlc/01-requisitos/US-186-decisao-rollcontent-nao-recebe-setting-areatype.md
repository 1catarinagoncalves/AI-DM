# US-186 — `setting`/`areaType` somam ao `tone` nos 4 consumidores de prosa que faltavam; `rollContent` segue sem `registry`

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** Nenhuma — os quatro `registry: AdventureRegistry` já chegam como parâmetro em `generateSecrets`/`generateAntagonist`/`generateClosing`/`generateOpeningBeat`, só faltam ser lidos. **Relacionado:** [US-185](./US-185-mestre-recebe-setting-areatype-em-todo-turno.md) (mesmo padrão de fix, aplicado à narração de turno — precedente direto desta story) · [US-187](./US-187-distribuicao-tematica-de-locationid-baseada-em-registry.md) (mesmo achado, aplicado a `generateLocationsAndNpcs` — esta story cobre os OUTROS quatro, de propósito não sobrepõe) · [US-147](./US-147-rolagem-registro-conteudo.md) (`rollContent`/`rollRegistry`, decisão original que esta story reafirma) · [US-156](./US-156-catalogos-registro-dto-validacao.md) (catálogo real dos três eixos) · [US-190](./US-190-antagonista-vira-passo-proprio-entre-segredos-e-encontros.md) (criou `generateAntagonist` COM o mesmo gap depois desta story ter sido redigida — a 4ª função entrou no escopo aqui em 2026-08-22, não é mais só conflito de merge) · **Conflito de merge, sem dependência técnica** (mesma região de código que várias stories do cluster antagonista mexem ao mesmo tempo — nenhuma trava esta, mas sequenciar por perto evita retrabalho de linha): [US-166](./US-166-motor-gera-multiplos-encontros.md) (`generateClosing` ganha `encounterSkeleton`/`encounterSituations`) · [US-169](./US-169-quest-gerada-ganha-objetivo-e-conclusao-acionavel.md) (`generateClosing` ganha `objective`) · [US-183](./US-183-antagonista-ganha-conexao-pessoal-com-personagem.md) (`generateClosing` ganha `background`/`origin`)
**Criada em:** 2026-08-21 — pedido da mantenedora pra "ligar `setting`/`areaType`/`tone` a `rollContent`/às tabelas LGMRD". Investigação encontrou o `rollContent` real intocável (ver *Nota histórica*) e localizou o gancho certo: os 3 consumidores de prosa que ainda só liam `registry.tone`, apontados sem story própria pela US-185 (*Fora do escopo*) e pela US-187 (Questão em aberto #3).
**Atualizada em:** 2026-08-22 — `generateAntagonist` (US-190, criada 2026-08-21 DEPOIS desta story) tem o mesmo gap (`registry` obrigatório, `system` só cita `Tom:`) e não estava listada nem em Escopo nem em Fora do escopo. Checado com a mantenedora: entra como 4ª função, mesmo padrão. Substitui a nota anterior de "só conflito de merge, sem dependência técnica" com `generateClosing`/`generateOpeningBeat` para essa função específica.
**Implementada em:** 2026-08-22, mesmo dia — as 4 funções somam `Cenário`/`Tipo de área` ao lado do `Tom` já citado. 4 testes de regressão novos em `ai.service.test.ts` (95 passando). `pnpm typecheck` limpo. `pnpm eval` verde (67 passed, 2 skipped — `us-36-qualidade-narracao.ts`, condicional a `DM_LIVE_EVAL`, esperado).

**Nota histórica.** Esta story chegou a documentar duas versões descartadas antes desta: (1) a decisão original — `rollContent` NÃO recebe `registry` — e (2) uma proposta de sorteio ponderado por afinidade dentro de `rollContent`. A investigação de código (abaixo) mostrou que (1) estava certa e não precisava mudar, e que o pedido real ("torre estilo steampunk em ambiente desértico em tom de terror") é frase de PROSA, não de tabela — nasce de estender o `system` prompt dos geradores, não de mexer no sorteio da US-147. (2) foi descartada por resolver um problema que não existe (o sorteio da tabela nunca precisou de viés — a coerência sempre foi trabalho da camada de prosa).

---

## História

> **Como** jogadora,
> **quero** que a escrita da aventura (segredos, fecho, abertura) respeite o cenário e o tipo de área que escolhi — não só o tom —,
> **para que** o mesmo eixo completo do registro (`setting`+`areaType`+`tone`) apareça em toda peça da aventura gerada, não só nos locais e na narração de turno.

---

## Contexto e motivação

### O que existe hoje

`registry: AdventureRegistry` (`setting`/`tone`/`areaType`, [roll-registry.ts](../../../apps/api/src/adventure-generation/roll-registry.ts)) já é parâmetro OBRIGATÓRIO em **5** funções de geração de prosa em [ai.service.ts](../../../apps/api/src/ai/ai.service.ts) — `generateLocationsAndNpcs` ([linha 1376](../../../apps/api/src/ai/ai.service.ts)), `generateSecrets` ([linha 1474](../../../apps/api/src/ai/ai.service.ts)), `generateAntagonist` ([linha 1532](../../../apps/api/src/ai/ai.service.ts), criada pela US-190 DEPOIS desta story), `generateClosing` ([linha 1581](../../../apps/api/src/ai/ai.service.ts)), `generateOpeningBeat` ([linha 1640](../../../apps/api/src/ai/ai.service.ts)). As 5 citam `` `Tom: ${params.registry.tone}.` `` no `system` — **nenhuma cita `.setting`/`.areaType`**, confirmado por `grep -rn "registry\.setting\|registry\.areaType" apps/api/src` (só acha uso em `dm-system.ts`/turno, US-185, e no objeto exposto ao front, `adventure.service.ts:334-335`). `rollContent` ([roll-content.ts](../../../apps/api/src/adventure-generation/roll-content.ts)) segue sem `registry` — decisão original desta story, ver *Por que `rollContent` continua fora*.

`generateLocationsAndNpcs` (a 5ª função) **já tem story própria pra este mesmo fix**: [US-187](./US-187-distribuicao-tematica-de-locationid-baseada-em-registry.md), *Escopo*, item 1 ("`registry.setting`/`registry.areaType` entram no `system`/prompt de `generateLocationsAndNpcs`") — ainda não implementada (📋 Planejada, bloqueada por US-166). As outras 3 originais ficaram só como observação nas duas stories vizinhas: US-185, *Fora do escopo* ("mesmo problema, MOMENTO diferente [...] fica como Questão em aberto da própria US-187"); US-187, Questão em aberto #3 ("Adiado [...] decisão story a story, não em lote aqui"). Nenhuma das duas assumiu o fix pras 3 — é o que esta story fecha. `generateAntagonist` (4ª função desta story) não existia quando nenhuma das duas foi escrita — entrou no escopo aqui em 2026-08-22, mesmo gap confirmado por leitura direta do código.

### Por que `rollContent` continua fora

A investigação original (21/08/2026) dumpou as 4 tabelas do LGMRD que `rollContent` lê (`1d20quests`, `locationsmonumentsanditems`, `conditiondescriptionandorigin`, `patronsandnpcs`) e confirmou: nenhuma tem coluna de bioma/tom — `location`/`monument` são substantivos genéricos de propósito ("Tower", "Sarcophagus"), o LGMRD desenhou assim pro MESTRE (humano na mesa original, o modelo aqui) reinterpretar. Ligar `registry` ao SORTEIO exigiria filtrar (degenera o pool de 20 linhas) ou re-taggear à mão (curadoria fora do "não há parser" da US-145) — sem necessidade: a MESMA coerência que o exemplo "torre steampunk/deserto/terror" pede já é alcançável no `system` prompt de quem escreve a prosa a partir da linha crua, sem tocar a rolagem. `rollAdventure` ([roll-adventure.ts](../../../apps/api/src/adventure-generation/roll-adventure.ts)) já rola `registry` ANTES de `content` (ordem da US-147) — a ordem existe justamente pra `registry` alimentar a ESCRITA que vem depois, não a tabela.

### Por que a solução atual não basta

`tone` sozinho não garante coerência de CENÁRIO/ÁREA. `generateSecrets` pode escrever um segredo "grimdark" perfeito e ainda ancorá-lo num tropo alienígena de space-opera numa aventura que o jogador escolheu `historical-fiction`; `generateOpeningBeat` pode abrir *in medias res* certo no tom e narrar uma masmorra quando o `areaType` sorteado foi `coastal-area`. Mesmo problema que a US-185 resolveu pra narração de turno — aqui é a mesma lacuna, na geração do artefato, em 3 das 4 chamadas que faltavam.

### A proposta

Mesmo padrão da US-185 (`buildDmSystemPrompt`) e do item 1 da US-187 (`generateLocationsAndNpcs`): somar `` `Cenário: ${params.registry.setting}. Tipo de área: ${params.registry.areaType}.` `` ao lado do `` `Tom: ${params.registry.tone}.` `` já existente, nas 4 funções que ainda faltam — `generateSecrets`, `generateAntagonist`, `generateClosing`, `generateOpeningBeat`. Sem mudança de schema (nenhuma delas tem schema de saída que dependa do registro — é só instrução de contexto pro modelo).

---

## Escopo

### Dentro do escopo

- `generateSecrets` ([ai.service.ts:1501](../../../apps/api/src/ai/ai.service.ts)): soma `Cenário`/`Tipo de área` ao lado do `Tom` já citado.
- `generateAntagonist` ([ai.service.ts:1557](../../../apps/api/src/ai/ai.service.ts)): idem (4ª função, US-190 criou depois desta story — mesmo gap).
- `generateClosing` ([ai.service.ts:1601](../../../apps/api/src/ai/ai.service.ts)): idem.
- `generateOpeningBeat` ([ai.service.ts:1675](../../../apps/api/src/ai/ai.service.ts)): idem.
- Mesma condicional/frase que `tone` já usa em cada função (nenhuma das 4 tem caso de `registry` ausente — é `AdventureRegistry` obrigatório no parâmetro, não `string | undefined` como o `tone` de `buildDmSystemPrompt` na US-185) — não precisa de fallback condicional novo.
- Testes de regressão em `ai.service.test.ts`: as 4 funções citam `setting`/`areaType` no `system` enviado ao modelo (mesmo padrão dos testes de `tone` existentes para essas funções).
- `pnpm typecheck`, `pnpm test`, `pnpm eval` (muda prompt de 4 chamadas de geração de aventura).

### Fora do escopo

- **`generateLocationsAndNpcs`.** Já é escopo formal da US-187 (item 1) — não duplicar aqui; esta story documenta a existência da US-187 mas não implementa a parte dela.
- **`rollContent`/tabelas LGMRD.** Decisão mantida: sorteio continua uniforme, sem `registry`. Ver *Por que `rollContent` continua fora*.
- **`vibe`/distribuição temática de `locationId`.** Escopo da US-187, item 2 — não relacionado a este fix.
- **Mudar a redação da instrução de `tone` já existente** nas 4 funções. Só soma `Cenário`/`Tipo de área` ao lado.
- **Narração de turno (`buildDmSystemPrompt`/`streamChat`/`generateOpeningNarration`).** Já implementada pela US-185 — não é este momento (criação do artefato, não turno ao vivo).
- **Validar/gate coerência entre o que o modelo escreve e `setting`/`areaType`.** Sem mecanismo automático — fica com `pnpm eval`/QA manual, mesma disciplina do resto do motor (US-180/US-182/US-185).

---

## Critérios de aceite

- [x] `generateSecrets`: `system` cita `registry.setting`/`registry.areaType`, ao lado de `registry.tone` já citado.
- [x] `generateAntagonist`: idem.
- [x] `generateClosing`: idem.
- [x] `generateOpeningBeat`: idem.
- [x] `generateLocationsAndNpcs` **não muda nesta story** — confirma que o fix fica com a US-187.
- [x] `rollContent`/`rollAdventure` **não mudam nesta story** — assinatura idêntica à atual, sem `registry` como parâmetro.
- [x] **Teste de regressão:** `ai.service.test.ts` cobre as 4 funções citando `setting`/`areaType` no `system`.
- [x] `pnpm typecheck` e `pnpm test` passam.
- [x] `pnpm eval` passa (muda prompt das 4 chamadas).

---

## Notas de implementação

- **Reusa o padrão exato de `Tom: ${params.registry.tone}.`** em cada uma das 4 funções — mesma linha, mesmo estilo de frase curta, só somando `Cenário`/`Tipo de área` ao lado (mesmo espírito da US-185, Notas de implementação: "não introduzir um segundo estilo de instrução condicional no mesmo arquivo").
- **`setting`/`areaType` guardam a chave canônica** (`'steampunk'`, `'desert'`, não rótulo pt-BR) — mesmo contrato que `tone` já segue nas 5 funções e que a US-185 documentou pra `dm-system.ts`.
- **Sem condicional de ausência** — diferente da US-185 (onde `tone`/`setting`/`areaType` são opcionais em `buildDmSystemPrompt` por causa de aventuras sem motor de geração), aqui `registry: AdventureRegistry` já é campo obrigatório do parâmetro das 4 funções — sempre presente, sem `if`.
- **Sem sub-seed nem RNG novo** — mesmo caso da US-185: os três campos já chegam prontos no `registry` recebido, só faltava a linha extra no `system`.
- **`generateAntagonist` entrou depois** (US-190, 2026-08-21) — mesma disciplina das outras 3: `registry` obrigatório, sem fallback, mesma frase.

---

## Questões em aberto

1. **Frase combinada (`Cenário: X. Tipo de área: Y.`) ou frases separadas?** Segue o precedente da US-185 (uma frase só combinando os dois, por serem par correlato) — não reabrir essa escolha aqui, só reaplicar.
2. **Se o eval mostrar que alguma das 4 funções não se beneficia do eixo** (ex.: `generateClosing` já ancora tanto em locais/segredos reais que `setting`/`areaType` seriam redundantes) — remover só daquela função é ajuste de implementação, não motivo pra reabrir esta story antes de rodar o eval.

---

## Referências no código

- [`apps/api/src/ai/ai.service.ts:1474-1513`](../../../apps/api/src/ai/ai.service.ts) — `generateSecrets`, `system` na linha 1501.
- [`apps/api/src/ai/ai.service.ts:1532-1565`](../../../apps/api/src/ai/ai.service.ts) — `generateAntagonist`, `system` na linha 1557.
- [`apps/api/src/ai/ai.service.ts:1581-1610`](../../../apps/api/src/ai/ai.service.ts) — `generateClosing`, `system` na linha 1601.
- [`apps/api/src/ai/ai.service.ts:1640-1683`](../../../apps/api/src/ai/ai.service.ts) — `generateOpeningBeat`, `system` na linha 1675.
- [`apps/api/src/ai/ai.service.ts:1376-1432`](../../../apps/api/src/ai/ai.service.ts) — `generateLocationsAndNpcs`, referência (não alterada aqui — escopo da US-187).
- [`apps/api/src/adventure-generation/roll-content.ts`](../../../apps/api/src/adventure-generation/roll-content.ts) — `rollContent`; confirma que não muda nesta story.
- [`apps/api/src/adventure-generation/roll-registry.ts`](../../../apps/api/src/adventure-generation/roll-registry.ts) — `AdventureRegistry`/`rollRegistry`, fonte dos três campos.
- [`apps/api/src/adventure-generation/registry-catalog.ts`](../../../apps/api/src/adventure-generation/registry-catalog.ts) — `SETTINGS`/`TONES`/`AREA_TYPES`, os três eixos fechados.
- [US-145](./US-145-sync-lgmrd-notice.md) — "não há parser"; garantia que `rollContent` continuar sem `registry` preserva sem esforço extra.
- [US-185](./US-185-mestre-recebe-setting-areatype-em-todo-turno.md) — precedente direto: mesmo fix, aplicado à narração de turno.
- [US-187](./US-187-distribuicao-tematica-de-locationid-baseada-em-registry.md) — mesmo achado, aplicado a `generateLocationsAndNpcs`; Questão em aberto #3 é a origem direta desta story.
