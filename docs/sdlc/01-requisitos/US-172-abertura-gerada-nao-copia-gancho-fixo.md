# US-172 — Abertura gerada deixa de copiar o gancho fixo, passa a ser escrita para o tom sorteado

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** [US-164](./US-164-orquestrador-motor-monta-aventura-gerada.md) (✅ — dona de `generateAdventure`, a função que esta story altera) · [US-173](./US-173-registro-fica-so-com-tone.md) (bloqueia — reduz `registry` a `{ tone }` antes desta story rodar; ver notas abaixo)
**Relacionado:** [US-153](./US-153-aventura-deixa-de-ser-derivada-da-classe.md) (aposentou o gancho fixo como *a aventura*) · [US-168](./US-168-abertura-narra-gancho-fixo-nao-aventura-gerada.md) (sintoma relacionado do lado da instrução de prompt — `buildOpeningInstruction` ignora `mainQuest`; esta story ataca a FONTE do dado, não a instrução)
**Criada em:** 2026-08-19 — nasceu da Questão em aberto #1 da US-168 (`hookSeed`/`mainQuest` podem divergir em tom) ao investigar até a raiz: a divergência é estrutural, não um edge case — `start` sempre é o texto de classe cru, nunca adaptado ao `registry` sorteado.

---

## História

> **Como** jogador que gera uma aventura nova,
> **quero** que a linha de abertura (`start`) da aventura seja escrita para *esta* aventura especificamente — sem depender do gancho de classe, nem como texto copiado, nem como inspiração —,
> **para que** uma aventura sorteada com tom diferente do gancho de classe (ex.: Bardo cortesão, aventura sorteada de terror) não carregue uma abertura que destoa do resto do conteúdo gerado.

---

## Contexto e motivação

### O problema observado

`AdventureService.generateAdventure` ([adventure.service.ts:183](../../../apps/api/src/adventure/adventure.service.ts)) atribui `start: profile.hookSeed` — cópia literal, sem chamada de modelo. Todo o resto do artefato (`locations`, `npcs`, `secrets`, `conclusion`) passa por uma chamada de IA que recebe `registry` (`tone`, sorteado ou escolhido na US-157) e adapta o conteúdo a ele. `start` é o único campo do `GeneratedAdventure` que não é gerado — é copiado do catálogo fixo por classe, e nunca vê o `registry` desta aventura específica.

> **Nota (2026-08-19):** [US-173](./US-173-registro-fica-so-com-tone.md) bloqueia esta story — `registry` já é `{ tone }` (sem `setting`/`areaType`) quando esta story roda. Todo `registry` citado neste documento é só `tone`.

Consequência concreta: personagem Bardo com `hookSeed` sobre um baile na corte Eladrin; o motor sorteia `tone: 'terror'` para esta aventura. `locations`/`npcs`/`secrets`/`conclusion` são gerados respeitando o terror — `start` continua sendo a prosa da corte élfica, sem qualquer adaptação.

### Por que a solução atual não basta

A US-164 decidiu deliberadamente `start = profile.hookSeed` (Questão em aberto #2 daquela story, **resolvida** em 2026-08-18) — decisão consciente para resolver **onde colocar o antagonista** (virou cor narrativa só no `conclusion`, via `ai.generateClosing`, sem exigir NPC rastreável nem reabrir o schema da US-158). Essa decisão resolveu bem o problema que tinha. Mas não tratou de um problema diferente: **tom**. `start` continuar sendo `hookSeed` cru significa que a abertura nunca é adaptada ao `registry` sorteado — nem quando o motor sorteia algo bem distante do gancho de classe.

Esta story **não reabre** a decisão sobre antagonista/`conclusion` da US-164 #2 — só a suposição implícita de que copiar `hookSeed` verbatim bastava. `hookSeed` deixa de influenciar `start` em qualquer grau — nem como texto final, nem como entrada de prompt. A geração de `start` passa a depender só do que É desta aventura (`registry`/`premissa`/`locations`/`npcs`), não do catálogo fixo por classe. `hookSeed` continua existindo e sendo usado normalmente nas OUTRAS chamadas do motor (`generateLocationsAndNpcs`, `generateSecrets`, `generateClosing`) e em `buildAdventureProfile` — nada disso muda; só a geração de `start` deixa de vê-lo.

### A proposta

`start` deixa de ser atribuição literal e passa a ser produzido por uma chamada de modelo que **não recebe `hookSeed`** — só `registry`/`premissa`/`locations`/`npcs` já decididos. `hookSeed` para de ser insumo desta chamada, não só deixa de ser copiado literal. Mesma disciplina das outras chamadas do motor (`generateLocationsAndNpcs`, `generateSecrets`, `generateClosing`): chamada de IA, `providerOptions: EXTRACTION_PROVIDER_OPTIONS`, nunca captura erro.

---

## Escopo

### Dentro do escopo

- `AdventureService.generateAdventure` para de atribuir `start: profile.hookSeed` direto ([adventure.service.ts:183](../../../apps/api/src/adventure/adventure.service.ts)).
- `start` passa a vir de uma chamada de IA que recebe `registry` + `premissa` + `locations`/`npcs`/`secrets` já gerados — **`hookSeed` NÃO entra nos parâmetros desta chamada**, nem no `prompt`, nem no `system`. `secrets` entra na lista de insumos (não estava no rascunho original desta story) porque o LGMRD trata strong start e secrets/clues como acoplados: "*second only in importance to the strong start*" (`LGMRD.json:234`, seção `definesecretsandclues`) — um dos lugares onde se planta a primeira pista é a própria abertura. Ver Decisão #1 para a decisão de função dedicada vs. reuso de `ai.generateClosing`.
- O prompt que gera `start` instrui abertura *in medias res* — cena já em ação/tensão, não descrição estática de cenário — espelhando a regra do LGMRD "*a strong start kicks your game off in the middle of the action*" (`LGMRD.json:530`, seção `strongstarts`) e o fallback "*when in doubt, start with a fight*" (`LGMRD.json:210`, seção `createastrongstart`): sem conflito óbvio no `registry`/`premissa`/`locations`/`npcs`/`secrets` recebidos, o prompt orienta abrir com confronto ou ameaça imediata.
- O prompt ancora `start` num elemento concreto já gerado — cita ou situa a cena em uma das `locations` (ou aponta pra ela), podendo insinuar (não revelar) um dos `secrets`. Sem isso, `start` fica coerente em tom mas solto do resto do artefato — mesmo problema de fundo desta story, só que no eixo "conteúdo" em vez de "tom".
- `hookSeed` deixa de ser insumo da chamada que produz `start` — zero influência, direta ou por prompt. Continua existindo no artefato só via `profile.hookSeed` passado às OUTRAS chamadas do motor (`generateLocationsAndNpcs`, `generateSecrets`, `generateClosing`) e a `buildAdventureProfile` — nenhuma delas muda nesta story.
- Determinismo: `registry`/conteúdo bruto continuam determinísticos por `characterId`+`order` (US-146); `start`, agora gerado por LLM, entra no mesmo regime que os demais campos gerados — fora da garantia de paridade byte a byte.
- Eval/teste de regressão: fixture com `hookSeed` de um tom (ex. festa cortesã) e `registry.tone` sorteado de outro (ex. terror) — confirma que `start` gerado reflete o `tone` sorteado e não contém nenhum elemento específico do `hookSeed` (nome de item, cenário, personagem do gancho fixo).

### Fora do escopo

- Antagonista/`conclusion` — decisão da US-164 Questão #2 permanece como está, não é reaberta aqui.
- Remover `hookSeed` das OUTRAS chamadas do motor (`generateLocationsAndNpcs`, `generateSecrets`, `generateClosing`) — elas continuam recebendo `hookSeed` exatamente como hoje; esta story mexe só na geração de `start`.
- `buildOpeningInstruction`/US-168 — aquela story corrige a instrução que consome `mainQuest` na narração; esta story corrige a **fonte** de um dos dois campos que compõem `mainQuest` (`summary`+`start`). As duas se complementam, nenhuma depende da outra para entregar valor isolado.
- Fallback estático (`openingText = generatedOpening ?? profile.hookSeed`, [adventure.service.ts:306](../../../apps/api/src/adventure/adventure.service.ts)) — comportamento correto quando a geração de abertura falha inteira (US-101), intocado.
- Reabrir `LOCATIONS_AND_NPCS_SCHEMA` (US-158) para antagonista rastreável — mesma decisão da US-164 #2, permanece fora.
- `resolveInitialHook`/`buildAdventureProfile` (US-148) — continuam intocados; só o consumo de `profile.hookSeed` dentro de `generateAdventure` muda.

---

## Critérios de aceite

- [x] `generateAdventure` não atribui mais `start: profile.hookSeed` direto.
- [x] `start` é produzido por uma chamada de modelo cujos parâmetros **não incluem `hookSeed`** — verificação estrutural (assinatura da função/objeto de params), não só de prompt. `AiService.generateOpeningBeat(params)` não tem campo `hookSeed` no tipo — excess property check do TS rejeita em compile-time; teste em `adventure.service.test.ts` confirma em runtime que os params recebidos não têm a chave.
- [x] `hookSeed` não aparece em nenhum `system`/`prompt` da chamada que gera `start` — teste em `ai.service.test.ts` força `hookSeed` via `as never` (simulando o pior caso) e confirma que nem `system` nem `prompt` contêm a string.
- [x] Teste com `hookSeed` de tom X e `registry.tone` sorteado Y confirma que `start` reflete Y, não X — como `generateOpeningBeat` nunca recebe `hookSeed` (item acima), a divergência de tom é estruturalmente impossível de vazar, não só testada por amostragem; validação semântica de tom fica com `pnpm eval`/QA manual (chamada real de modelo, fora do escopo de teste unitário mockado).
- [x] Teste confirma que `start` gerado cita ou situa a cena em pelo menos 1 `location`/`npc` já gerado (nome ou traço distintivo) — ancoragem factual no restante do artefato, não só compatibilidade de tom.
- [x] `GeneratedAdventureSchema.parse()` continua passando (`start` ainda string não vazia).
- [x] `pnpm typecheck` e `pnpm test` passam.
- [x] `pnpm eval` passa (mudança em geração/prompt do DM Agent — regra do projeto, AGENTS.md).

---

## Notas de implementação

- Ponto exato a mudar: [adventure.service.ts:183](../../../apps/api/src/adventure/adventure.service.ts), dentro de `generateAdventure` (US-164).
- **`ai.generateClosing` NÃO é candidata neutra a reuso.** `buildClosingPrompt` ([ai.service.ts:200-215](../../../apps/api/src/ai/ai.service.ts)) já cravam `` `Gancho da aventura: ${params.hookSeed}` `` na primeira linha do prompt ([ai.service.ts:212](../../../apps/api/src/ai/ai.service.ts)) — propositalmente, para o antagonista da US-164 #2. Estender essa função pra também devolver `start` deixaria `hookSeed` no MESMO prompt que produz `start`, ainda que instruído a ignorá-lo — risco real de vazamento (o modelo lê o gancho de qualquer forma, só é instruído a não usá-lo). Isso pesa contra o reuso, ver Decisão #1.
- `CLOSING_SCHEMA` ([ai.service.ts:195](../../../apps/api/src/ai/ai.service.ts)) é o molde de schema de chamada a seguir para o método novo — mesmo padrão (`z.object`, campo de string mínima).
- Custo/latência: um método dedicado soma uma 4ª chamada de IA síncrona ao fluxo — a US-164 já registrou essa preocupação com as 3 chamadas encadeadas de hoje (Notas de implementação daquela story, "Custo/latência").
- **Ordem invertida vs. LGMRD, aceita conscientemente.** No LGMRD, "Create a Strong Start" é o passo 1 de prep (`createastrongstart`, order 2 no documento fonte) — vem ANTES de outline de locations (order 5) e NPCs (order 6): o GM escreve o start primeiro, como âncora, e desenha o resto da aventura em torno dele. Nesta story `start` é gerado por ÚLTIMO na pipeline (depois de `locations`/`npcs`/`secrets`/`conclusion`, US-164), porque a arquitetura de 4 chamadas discretas não tem um autor único segurando o tom da aventura inteira antes de começar. A forma de recriar coerência sem reabrir a ordem de US-164 (fora do escopo) é fazer o prompt de `start` referenciar ativamente o que já foi gerado (`locations`/`npcs`/`secrets`) em vez de produzir algo genérico que só combina em tom — daí os dois insumos novos (`secrets`) e a exigência de ancoragem nos Critérios de aceite.
- Fonte de referência para o comportamento de `start` (heurística "in medias res", acoplamento com secrets/clues): `scripts/lazygm/_data/LGMRD.json`, seções `createastrongstart` (linha 204), `strongstarts` (linha 528) e `definesecretsandclues` (linha 228) — Lazy GM Resource Document, mesma fonte já usada por `lgmrd-tables.ts` e pelo backlog `backlog-aventuras-autorais-lazygm.md`.

---

## Decisões (questões em aberto resolvidas)

1. **Função dedicada `ai.generateOpeningBeat`, não reuso de `ai.generateClosing`.** `buildClosingPrompt` já injeta `hookSeed` no prompt ([ai.service.ts:212](../../../apps/api/src/ai/ai.service.ts)); reusar essa função pra `start` violaria "zero influência, nem como inspiração" mesmo com instrução textual em contrário — `hookSeed` estaria fisicamente no contexto do modelo. Assinatura nova: `ai.generateOpeningBeat(params)` com `params = { registry, premissa, locations, npcs, secrets }` (sem `hookSeed`) — `registry: AdventureRegistry` inteiro, não `tone` solto, mesmo padrão de assinatura de `generateClosing`/`generateSecrets`/`generateLocationsAndNpcs` — e `OPENING_BEAT_SCHEMA` no molde do `CLOSING_SCHEMA` (`start: z.string().min(1)`). `buildOpeningBeatPrompt` segue a estrutura de `buildClosingPrompt`, trocando a linha que crava `hookSeed` por uma citando a `location` escolhida + `tone`, e instrui abertura *in medias res* com fallback "sem conflito óbvio, abra com confronto/ameaça imediata" (heurísticas do LGMRD, ver Notas de implementação). Resolve tanto o eixo tom (motivo original desta story) quanto o eixo ancoragem/coerência com `locations`/`npcs`/`secrets` (ver Escopo e Critérios de aceite). Custo aceito: uma 4ª chamada de IA síncrona no fluxo (risco já registrado pela US-164, decisão 5 do backlog — gerar na criação do personagem ou em background —, não resolvido aqui).
2. **Chamada de `generateOpeningBeat` entra em paralelo com `generateClosing`, não serial depois dela.** Nenhuma das duas depende do resultado da outra — ambas só precisam de `locations`/`npcs`/`secrets`/`registry`/`premissa`, já prontos depois de `generateSecrets` (linha 153); `generateClosing` usa `complicacao`+`hookSeed` a mais, mas isso não cria dependência de `generateOpeningBeat` sobre ela nem vice-versa. `generateAdventure` dispara as duas com `Promise.all` no lugar do `await this.ai.generateClosing(...)` isolado — soma uma 4ª chamada de IA ao fluxo (custo já aceito na Decisão #1), mas paralela não adiciona latência de rede sequencial sobre o `await` que já existia.
3. **`buildOpeningInstruction` (US-168) não cita `hookSeed` separado como pano de fundo.** Quando `mainQuest` existe, a abertura narrada não cita `hookSeed` em grau nenhum — nem como spark (já era a proposta da US-168), nem como pano de fundo/flavor secundário. `buildOpeningInstruction` não precisa de lógica nova pra isso: já não recebe `hookSeed` como insumo desta chamada (ver Escopo). O gancho de classe permanece vivo SÓ no caminho de fallback da US-168 (sem `mainQuest` — sistema sem motor de geração, ex. Free) — esse comportamento já está coberto lá, intocado por esta story.

---

## Referências no código

- [apps/api/src/adventure/adventure.service.ts:183](../../../apps/api/src/adventure/adventure.service.ts) — `start: profile.hookSeed`, a linha a mudar.
- [apps/api/src/adventure/adventure.service.ts:131-187](../../../apps/api/src/adventure/adventure.service.ts) — `generateAdventure` inteira (US-164), o método que esta story altera.
- [apps/api/src/ai/ai.service.ts:195](../../../apps/api/src/ai/ai.service.ts) — `CLOSING_SCHEMA`, molde de schema de chamada.
- [apps/api/src/ai/ai.service.ts:1392-1416](../../../apps/api/src/ai/ai.service.ts) — `generateClosing`, molde de função nova (não candidata a reuso — ver achado abaixo).
- [apps/api/src/ai/ai.service.ts:200-215](../../../apps/api/src/ai/ai.service.ts) — `buildClosingPrompt`, injeta `hookSeed` literal no prompt (linha 212) — motivo de `generateClosing` não servir pra gerar `start` sem risco de vazamento.
- [US-164](./US-164-orquestrador-motor-monta-aventura-gerada.md) — Questão em aberto #2 (RESOLVIDA), a decisão original sobre `start = hookSeed` que esta story revisita parcialmente (só o eixo tom, não o eixo antagonista).
- [US-168](./US-168-abertura-narra-gancho-fixo-nao-aventura-gerada.md) — Questão em aberto #1, o sintoma relacionado do lado da instrução de prompt.
- [US-148](./US-148-perfil-personagem-entrada-motor.md) — `buildAdventureProfile`, dono de `hookSeed`, que continua servindo de input.
- [US-173](./US-173-registro-fica-so-com-tone.md) — bloqueia esta story; reduziu `registry` a `{ tone }` antes desta rodar (ver nota no topo de *Contexto*).
