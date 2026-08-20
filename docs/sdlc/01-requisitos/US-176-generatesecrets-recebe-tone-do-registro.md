# US-176 — `generateSecrets` recebe `tone` do registro (hoje gerado cego a ele)

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** nenhuma — `registry`/`registry.tone` já existem e já estão em escopo no chamador ([adventure.service.ts:137](../../../apps/api/src/adventure/adventure.service.ts)); é só encanamento.
**Relacionado:** [US-168](./US-168-abertura-narra-gancho-fixo-nao-aventura-gerada.md) (achou o gap — *Terceiro achado* — e listou como fora do próprio escopo, story dedicada) · [US-173](./US-173-registro-fica-so-com-tone.md) (✅, reduziu `registry` a `{ tone }`; esta story passa esse único campo) · [US-149](./US-149-segredos-40-prompts-lgmrd.md) (dona de `generateSecrets`) · [US-164](./US-164-orquestrador-motor-monta-aventura-gerada.md) (orquestrador — já busca `registry` no passo 1, só não repassa ao passo 3) · [US-174](./US-174-hookseed-sai-das-outras-chamadas-do-motor.md) (story irmã que também mexe em `generateSecrets`/`buildSecretsPrompt` — remove `hookSeed`; sobreposição de arquivo/função, não dependência real, ver Notas)
**Criada em:** 2026-08-19 — achado durante a investigação da US-168 (*Terceiro achado*, corrigido em 2026-08-19): a nota original listava `generateSecrets` entre os consumidores de `registry`/`tone`; checado contra o código, é falso — `generateSecrets` não recebe `tone`/`setting`/`areaType` em grau nenhum, nem como frase solta. Gap mais profundo que o do Mestre (US-168): lá o Mestre não usava `tone`; aqui uma das TRÊS chamadas do motor que já recebem `registry` simplesmente não inclui essa (`generateLocationsAndNpcs`/`generateClosing` recebem; `generateSecrets`, não).

---

## História

> **Como** jogador que gera uma aventura com um tom específico (grimdark, cômico, etc.),
> **quero** que os segredos gerados também reflitam esse tom,
> **para que** o conteúdo da aventura seja consistente ponta a ponta — locais/NPCs (US-158) e o fecho (US-164) já respeitam o tom sorteado; os segredos não podem ser o único elo cego a ele.

---

## Contexto e motivação

### O problema observado

`rollAdventure` devolve `{ registry, content }` logo no início de `generateAdventure` ([adventure.service.ts:137](../../../apps/api/src/adventure/adventure.service.ts)) — `registry` (hoje só `{ tone }`, pós-US-173) já está em escopo quando as três chamadas de IA do motor rodam. `generateLocationsAndNpcs` ([ai.service.ts:1283-1305](../../../apps/api/src/ai/ai.service.ts)) recebe `registry` e cita `` `Tom: ${params.registry.tone}. ...` `` no `system` (linha 1302). `generateClosing` ([ai.service.ts:1392-1416](../../../apps/api/src/ai/ai.service.ts)) recebe `registry` e cita a mesma linha (`Tom: ${params.registry.tone}.`, linha 1408). `generateSecrets` ([ai.service.ts:1339-1380](../../../apps/api/src/ai/ai.service.ts)) — a chamada do MEIO, entre as outras duas — não tem `registry` nos parâmetros, não tem `tone` em lugar nenhum do `system` ou do `prompt` (`buildSecretsPrompt`, [ai.service.ts:170-186](../../../apps/api/src/ai/ai.service.ts)). O segredo gerado é escrito sem nenhuma instrução de registro/mood — só ancorado em `locations`/`npcs`/`background`/`hookSeed`.

### Por que a solução atual não basta

Não é decisão de produto (ao contrário do `hookSeed` em `generateClosing`, ver [US-174](./US-174-hookseed-sai-das-outras-chamadas-do-motor.md) Questão em aberto #1, já resolvida a favor de manter lá o que é deliberado) — é assimetria não intencional entre três chamadas irmãs do mesmo motor, na mesma função orquestradora, no mesmo nível de acesso a `registry`. Nenhum comentário no código justifica a omissão; `generateSecrets` simplesmente nunca recebeu o parâmetro. Resultado prático: um segredo "histórico" ou "de personagem" escrito para uma aventura `tone: 'comedic'` pode sair com o mesmo registro sério que sairia para `tone: 'grimdark'` — inconsistência que o jogador nota ao ler o segredo revelado, mesmo que locais/NPCs/fecho estejam corretos.

### A proposta

`generateSecrets` ganha parâmetro `registry: AdventureRegistry` (mesmo tipo que `generateLocationsAndNpcs`/`generateClosing` já usam) e cita `` `Tom: ${params.registry.tone}.` `` no `system`, mesma posição/formato das outras duas chamadas (consistência de padrão, não invenção de instrução nova). `adventure.service.ts:146-153` passa `registry` (já em escopo desde a linha 137, sem query nem cálculo novo) na chamada.

---

## Escopo

### Dentro do escopo

- `generateSecrets` ([ai.service.ts:1426-1432](../../../apps/api/src/ai/ai.service.ts)) ganha parâmetro `registry: AdventureRegistry`.
- `system` de `generateSecrets` ([ai.service.ts:1444-1449](../../../apps/api/src/ai/ai.service.ts)) ganha `` `Tom: ${params.registry.tone}.` ``, mesmo formato/posição de `generateLocationsAndNpcs`/`generateClosing`.
- `adventure.service.ts:145-151` — a chamada dentro de `generateAdventure` passa `registry` (variável já desestruturada na linha 137).
- Teste de regressão: fixture com `registry.tone` no describe de `generateSecrets` confirma que a string do tom chega ao `system` — mesmo padrão que `generateClosing`/`generateOpeningBeat` já usam (um `const registry = { tone: '...' }` por describe block, tons diferentes ENTRE funções, não dois fixtures dentro do mesmo describe).

### Fora do escopo

- `buildSecretsPrompt` — `tone` vai no `system`, não no `prompt` (mesma separação system/prompt que as outras duas chamadas já mantêm: `system` carrega instrução de registro, `prompt` carrega o conteúdo referencial). Nenhuma mudança de assinatura em `buildSecretsPrompt`.
- Remover `hookSeed` de `generateSecrets` — é o escopo da [US-174](./US-174-hookseed-sai-das-outras-chamadas-do-motor.md), story irmã já planejada; esta story só ADICIONA `registry`, não mexe em `hookSeed`. Overlap de arquivo/função com a US-174 é esperado (ver Notas), não motivo pra fundir as stories.
- Mudar `generateLocationsAndNpcs`/`generateClosing` — já recebem `registry`/`tone` corretamente, nada a fazer ali.
- Qualquer mudança em `AdventureRegistry`/`rollRegistry`/o schema do registro — já resolvidos pela US-173; esta story só passa o campo adiante, não redefine o tipo.
- Instrução de registo/mood do MESTRE (narração, `buildDmSystemPrompt`) — isso é a US-168; esta story é só o motor de GERAÇÃO (conteúdo), não a narração.

---

## Critérios de aceite

- [x] `generateSecrets` aceita `registry: AdventureRegistry` nos parâmetros.
- [x] `system` de `generateSecrets` cita `Tom: ${registry.tone}.` — mesmo formato de `generateLocationsAndNpcs`/`generateClosing`.
- [x] `adventure.service.ts` passa `registry` na chamada a `generateSecrets` (linha ~145-151).
- [x] Teste: fixture com `registry.tone` no describe de `generateSecrets` confirma que a string do tom aparece no `system` recebido pelo modelo (padrão de `generateClosing`/`generateOpeningBeat`).
- [x] Assinatura de `buildSecretsPrompt` **não muda** — `tone` não entra no `prompt`.
- [x] `pnpm typecheck` e `pnpm test` passam (8 call sites de `generateSecrets` em `ai.service.test.ts` precisam do novo parâmetro obrigatório — contagem revista em 2026-08-20, doc original tinha 7).
- [x] `pnpm eval` passa (mudança em prompt de geração do motor — regra do projeto, AGENTS.md).

---

## Notas de implementação

- Pontos exatos (revisto 2026-08-20, código drift de US-174/177/180): [ai.service.ts:1426-1432](../../../apps/api/src/ai/ai.service.ts) (assinatura), [:1444-1449](../../../apps/api/src/ai/ai.service.ts) (`system`); [adventure.service.ts:145-151](../../../apps/api/src/adventure/adventure.service.ts) (chamada).
- `registry` já é `{ tone }` só (pós-US-173) — o parâmetro novo carrega um campo só, mesmo shape que `generateLocationsAndNpcs`/`generateClosing` já recebem hoje.
- **Overlap com US-174:** já resolvido — US-174 mergeou primeiro (commit `2816e05`), `hookSeed` já saiu de `generateSecrets`/`buildSecretsPrompt` antes desta story rodar. `generateSecrets` ([ai.service.ts:1426](../../../apps/api/src/ai/ai.service.ts)) já não tem `hookSeed` no schema; esta story só ADICIONA `registry` em cima do estado pós-US-174, sem rebase pendente.
- 8 call sites de `generateSecrets` em `ai.service.test.ts` (linhas 430, 438, 445, 452, 460, 468, 476, 483 — recontado em 2026-08-20; doc original tinha 7 porque o arquivo cresceu com US-174/US-177/US-180) precisam do novo parâmetro `registry`. A linha 468 é o teste do cast `{ ..., hookSeed } as never` (US-174) — também precisa de `registry`, além do `hookSeed` já ignorado.
- Padrão de teste real (checado em `generateClosing`/`generateOpeningBeat`, não em `generateSecrets` — que ainda não tem fixture de `registry`): um `const registry = { tone: '...' }` por describe block, tom fixo dentro do describe, mais um teste dedicado `'registry (tone) entra no system/prompt do modelo'`. A frase do AC ("dois fixtures com tone distinto") não corresponde a esse padrão — não há dois fixtures dentro do mesmo describe hoje; seguir o padrão real, não a frase literal do AC.
- Formato exato da string de tom já tem precedente nas outras duas chamadas (`` `Tom: ${params.registry.tone}.` ``) — copiar, não reinventar frase nova.

---

## Questões em aberto

Nenhuma — mudança mecânica (encanamento de parâmetro já existente e em escopo), padrão já estabelecido por duas chamadas irmãs.

---

## Referências no código

- [apps/api/src/ai/ai.service.ts:1426-1432](../../../apps/api/src/ai/ai.service.ts) — `generateSecrets`, assinatura a mudar.
- [apps/api/src/ai/ai.service.ts:1444-1449](../../../apps/api/src/ai/ai.service.ts) — `system` de `generateSecrets`, onde `Tom: ${...}` entra.
- [apps/api/src/ai/ai.service.ts:1366-1390](../../../apps/api/src/ai/ai.service.ts) — `generateLocationsAndNpcs`, referência de padrão (`Tom:` na linha 1385).
- [apps/api/src/ai/ai.service.ts:1475-1495](../../../apps/api/src/ai/ai.service.ts) — `generateClosing`, referência de padrão.
- [apps/api/src/ai/ai.service.ts:183-186](../../../apps/api/src/ai/ai.service.ts) — `buildSecretsPrompt`, NÃO muda (tom vai no `system`, não aqui).
- [apps/api/src/adventure/adventure.service.ts:137](../../../apps/api/src/adventure/adventure.service.ts) — `const { registry, content } = rollAdventure(...)`, prova que `registry` já está em escopo antes da chamada.
- [apps/api/src/adventure/adventure.service.ts:145-151](../../../apps/api/src/adventure/adventure.service.ts) — chamada a `generateSecrets` a alterar.
- [apps/api/src/ai/ai.service.test.ts:430,438,445,452,460,468,476,483](../../../apps/api/src/ai/ai.service.test.ts) — 8 call sites de teste que precisam do novo parâmetro (recontado 2026-08-20; linha 468 é o teste de cast `hookSeed` da US-174).
- [US-168](./US-168-abertura-narra-gancho-fixo-nao-aventura-gerada.md) — *Terceiro achado*, origem deste gap.
- [US-173](./US-173-registro-fica-so-com-tone.md) — reduziu `registry` ao único campo que esta story passa.
- [US-174](./US-174-hookseed-sai-das-outras-chamadas-do-motor.md) — story irmã, mesmo arquivo/função, parâmetro diferente (`hookSeed` sai, `registry` entra) — overlap sem dependência.
