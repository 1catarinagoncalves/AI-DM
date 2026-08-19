# US-172 — Abertura gerada deixa de copiar o gancho fixo, passa a ser escrita para o tom sorteado

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
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
- `start` passa a vir de uma chamada de IA que recebe `registry` + `premissa` + `locations`/`npcs` já gerados — **`hookSeed` NÃO entra nos parâmetros desta chamada**, nem no `prompt`, nem no `system`. Ver Questão em aberto #1 para a decisão de função dedicada vs. reuso de `ai.generateClosing`.
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

- [ ] `generateAdventure` não atribui mais `start: profile.hookSeed` direto.
- [ ] `start` é produzido por uma chamada de modelo cujos parâmetros **não incluem `hookSeed`** — verificação estrutural (assinatura da função/objeto de params), não só de prompt.
- [ ] `hookSeed` não aparece em nenhum `system`/`prompt` da chamada que gera `start` — grep/teste garante que a string de `hookSeed` do fixture não é passada a essa chamada.
- [ ] Teste com `hookSeed` de tom X e `registry.tone` sorteado Y (claramente distintos) confirma que `start` gerado reflete Y e não contém elemento específico de X (nome de item/cenário/personagem do gancho fixo).
- [ ] `GeneratedAdventureSchema.parse()` continua passando (`start` ainda string não vazia).
- [ ] `pnpm typecheck` e `pnpm test` passam.
- [ ] `pnpm eval` passa (mudança em geração/prompt do DM Agent — regra do projeto, AGENTS.md).

---

## Notas de implementação

- Ponto exato a mudar: [adventure.service.ts:183](../../../apps/api/src/adventure/adventure.service.ts), dentro de `generateAdventure` (US-164).
- **`ai.generateClosing` NÃO é candidata neutra a reuso.** `buildClosingPrompt` ([ai.service.ts:200-215](../../../apps/api/src/ai/ai.service.ts)) já cravam `` `Gancho da aventura: ${params.hookSeed}` `` na primeira linha do prompt ([ai.service.ts:212](../../../apps/api/src/ai/ai.service.ts)) — propositalmente, para o antagonista da US-164 #2. Estender essa função pra também devolver `start` deixaria `hookSeed` no MESMO prompt que produz `start`, ainda que instruído a ignorá-lo — risco real de vazamento (o modelo lê o gancho de qualquer forma, só é instruído a não usá-lo). Isso pesa contra o reuso, ver Questão em aberto #1.
- `CLOSING_SCHEMA` ([ai.service.ts:195](../../../apps/api/src/ai/ai.service.ts)) é o molde de schema de chamada a seguir para o método novo — mesmo padrão (`z.object`, campo de string mínima).
- Custo/latência: um método dedicado soma uma 4ª chamada de IA síncrona ao fluxo — a US-164 já registrou essa preocupação com as 3 chamadas encadeadas de hoje (Notas de implementação daquela story, "Custo/latência").

---

## Questões em aberto

1. **Método dedicado (`ai.generateOpeningBeat`, por exemplo) — não reuso de `ai.generateClosing`.** Dado que `buildClosingPrompt` já injeta `hookSeed` no prompt (achado acima), reusar essa função pra `start` violaria o requisito de "zero influência, nem como inspiração" mesmo com instrução textual em contrário — o `hookSeed` estaria fisicamente no contexto do modelo. Um método novo, com assinatura que nunca aceita `hookSeed`, é a única forma de garantir a ausência estruturalmente. Custo: uma chamada de IA a mais no fluxo (ver Notas) — risco já registrado pela US-164 (decisão 5 do backlog, gerar na criação do personagem ou em background?), não resolvido aqui.
2. ~~Com `start` deixando de carregar qualquer traço de `hookSeed`, vale `buildOpeningInstruction` (US-168) citar `hookSeed` separado como pano de fundo de personagem/classe?~~ **RESOLVIDO (2026-08-19), decisão da mantenedora: não — gancho de classe some da narração de vez.** Quando `mainQuest` existe, a abertura narrada não cita `hookSeed` em grau nenhum — nem como spark (já era a proposta da US-168), nem como pano de fundo/flavor secundário. `buildOpeningInstruction` não precisa de lógica nova pra isso: já não recebe `hookSeed` como insumo desta chamada (ver Escopo). O gancho de classe permanece vivo SÓ no caminho de fallback da US-168 (sem `mainQuest` — sistema sem motor de geração, ex. Free) — esse comportamento já está coberto lá, intocado por esta story.

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
