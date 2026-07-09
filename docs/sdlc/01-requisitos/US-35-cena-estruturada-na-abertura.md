# US-35 — Estado de cena estruturado já na abertura da aventura

**Épico:** 2 — Aventura
**Fase:** 1 — MVP single-player
**Status:** 🗂️ Backlog
**Depende de:** [US-34](./US-34-qualidade-da-narracao-do-dm.md) (primeira narração gerada por IA), [US-11b](./US-11b-estado-de-cena-estruturado.md) (estado de cena estruturado) e [US-28](./US-28-aventura-inicial-baseada-na-classe.md) (criação da aventura).
**Criada em:** 2026-07-07

---

## História

> **Como** jogador,
> **quero** que o DM já conheça de forma estruturada o cenário da primeira cena (onde estou, quem está comigo, que horas são),
> **para que** a resposta ao meu primeiro comando continue a abertura sem me teletransportar, trocar a hora do dia ou esquecer os personagens que acabaram de aparecer.

---

## Contexto e motivação

### O problema observado

A [US-11b](./US-11b-estado-de-cena-estruturado.md) criou o `sceneState` — o estado de cena **estruturado** (`local`, `ambiente`, `periodo`, `presentes`, `objetos_em_cena`). Ele é a **fonte de verdade** da continuidade espacial: o DM o relê a cada turno (via `formatSceneState` no system prompt) e não deve contradizê-lo.

A [US-34](./US-34-qualidade-da-narracao-do-dm.md) faz a primeira narração ser gerada por IA, com cena rica (chuva, estrada, vila ao anoitecer, um velho ajoelhado). Mas essa cena vive **só na prosa**. O campo `sceneState` fica **nulo** na abertura, porque:

- o `CharacterState` nasce na mesma transação da criação da aventura (ainda não existe para receber a cena);
- a geração da abertura roda **sem tools**, então não chama `updateScene` para preencher os campos estruturados.

### A janela de inconsistência

No **primeiro turno** do jogador, o DM recebe:
- a prosa da abertura como mensagem `assistant` no histórico;
- um `sceneState` **vazio** — nenhuma fonte de verdade estruturada.

Como o system prompt manda o DM confiar no `sceneState` acima de qualquer inferência da prosa, um `sceneState` vazio deixa a continuidade da primeira cena **sem âncora**. O DM pode, no primeiro turno:

- relocar o personagem (colocar dentro de uma casa quem estava na estrada);
- trocar o período (virar dia quando a abertura era anoitecer);
- esquecer NPCs recém-introduzidos (o velho ajoelhado some);
- inventar objetos/lugares que contradizem a abertura.

A partir do primeiro `updateScene` normal, a continuidade se estabiliza — mas o **primeiro turno** é justamente o mais frágil, e é a primeira impressão da aventura.

### A proposta

Preencher o `sceneState` **a partir da abertura gerada**, na própria criação da aventura, para que a fonte de verdade estruturada bata com a prosa desde o turno 1.

Logo depois de gerar a narração de abertura (US-34), o Game Server faz uma **extração estruturada** da cena — `local`, `ambiente`, `periodo`, `presentes`, `objetos_em_cena` — a partir do texto da abertura, e grava o resultado no `CharacterState` inicial, na mesma transação. Se a extração falhar, o `sceneState` fica nulo (comportamento atual da US-34) — nunca bloqueia a criação da aventura.

---

## Escopo

### Dentro do escopo

- **Extração estruturada da cena** a partir da narração de abertura gerada (US-34), produzindo um `ScenePatch` (`local`, `ambiente`, `periodo`, `presentes`, `objetos_em_cena`).
- Persistir esse estado no `CharacterState` inicial criado por `AdventureService.createForCharacter`, via `mergeSceneState(null, patch)`.
- **Fallback seguro:** se a extração falhar, vier vazia ou estourar erro, o `sceneState` fica nulo — idêntico ao comportamento da US-34, sem bloquear a criação.
- A extração roda **fora da transação** (é uma chamada de LLM), junto da geração da abertura; só o resultado entra na transação.
- Coerência com o fluxo normal: os campos extraídos usam o mesmo vocabulário do `updateScene`/`SceneState` (ex.: `ambiente` ∈ {`externo`, `interno`}, `periodo` em linguagem natural como "anoitecer").

### Fora do escopo

- Mudar o formato ou o contrato do `SceneState` (US-11b) — reusado como está.
- Extrair cena de **turnos** de chat (isso já é feito deterministicamente pelo `updateScene` que o DM chama). Esta US cobre só a **abertura**, que não passa por tools.
- Corrigir retroativamente aventuras já criadas com `sceneState` nulo. Vale só para aventuras novas.
- Streaming ou apresentação — segue igual à US-34.

---

## Abordagem técnica

A extração encaixa como um passo a mais no mesmo ponto onde a US-34 gera a abertura, antes da transação.

### 1. Extração estruturada da cena

Novo método no `AiService` (ex.: `extractOpeningScene(openingText): Promise<ScenePatch | null>`):

- Usa `generateObject` (Vercel AI SDK) com um schema Zod espelhando o `ScenePatch` (`local`, `ambiente` enum, `periodo`, `presentes[]`, `objetos_em_cena[]`), para saída **estruturada e validada** — sem parsing de texto livre.
- Modelo barato/rápido (a tarefa é extração, não criação — candidato ao `summaryModel` ou similar).
- Prompt de sistema curto: "extraia o estado de cena atual desta narração de abertura; use apenas o que está no texto; não invente".
- `try/catch → null`, com log. Nunca lança.

### 2. Persistência na criação da aventura

Em `AdventureService.createForCharacter`, após obter `openingText` (US-34):

```ts
const scenePatch = await this.ai.extractOpeningScene(openingText) // ScenePatch | null
const sceneState = scenePatch ? mergeSceneState(null, scenePatch) : null
```

E no `CharacterState.create` da transação, gravar `sceneState` quando não-nulo (a coluna já existe; ausente → nulo, como hoje).

### 3. Efeito no primeiro turno

No primeiro turno, `AiService.streamChat` já lê `characterState.sceneState` e o injeta via `formatSceneState`. Com o campo preenchido, o DM passa a ter a âncora estruturada da cena de abertura desde o turno 1 — sem mudança no `streamChat`.

---

## Critérios de aceite

- [ ] Após iniciar a aventura (US-34), o `CharacterState` inicial tem `sceneState` preenchido com os campos extraídos da narração de abertura, quando a extração é bem-sucedida.
- [ ] A extração usa saída estruturada validada (schema), não parsing de texto livre, e só usa informação presente na abertura (não inventa local/NPC/objeto).
- [ ] Se a extração falhar, vier vazia ou estourar erro, o `sceneState` fica **nulo** e a aventura é criada normalmente (fallback idêntico à US-34).
- [ ] A extração roda **fora da transação**; só o resultado entra na transação de criação.
- [ ] Os campos extraídos respeitam o vocabulário do `SceneState` (`ambiente` ∈ {`externo`, `interno`}; arrays para `presentes`/`objetos_em_cena`).
- [ ] No primeiro turno, o system prompt do DM já inclui a cena estruturada (via `formatSceneState`) coerente com a abertura — sem mudança em `streamChat`.
- [ ] **(regressão — continuidade)** Criar aventura de `Paladino` cuja abertura se passa numa estrada ao anoitecer com um NPC presente; enviar a primeira ação; verificar que o DM não relocaliza o personagem para ambiente interno, não troca o período nem descarta o NPC introduzido.
- [ ] **(regressão — fallback)** Com a extração mockada devolvendo `null`, a aventura é criada com `sceneState` nulo e nada quebra (comportamento US-34).

---

## Notas de implementação

- **AiService:** `extractOpeningScene(openingText)` com `generateObject` + schema Zod = `ScenePatch`. Reaproveitar o enum de `ambiente` já usado no `updateScene`. Modelo barato (extração).
- **Contrato/tipos:** `ScenePatch` já existe em `packages/ai-engine/src/scene.ts`; o schema Zod da extração deve espelhá-lo. Sem mudança no `SceneState` (US-11b).
- **AdventureService:** encadear a extração após a geração da abertura (ambas fora da transação); passar `sceneState` ao `CharacterState.create` quando não-nulo. Uma única falha (abertura OU cena) nunca deve derrubar a criação — ambas com fallback.
- **Ordem/custo:** são duas chamadas de LLM na criação (abertura + extração). Podem ser sequenciais (a extração depende do texto da abertura). Reforça a Questão em aberto de latência da US-34 — considerar indicador de carregamento na UI.
- **Testes:** estender `apps/api/src/adventure/adventure.service.test.ts` com fake de `AiService` cobrindo: extração devolvendo patch (grava `sceneState`) e extração devolvendo `null` (grava nulo, sem erro).
- **ai-engine:** se o schema/prompt de extração viverem no pacote, exportá-los no `index`; lembrar do rebuild do `dist` (`pnpm --filter @ai-dm/ai-engine build`).

---

## Questões em aberto

1. **Uma chamada ou duas?** A extração é uma segunda chamada de LLM após a abertura. Alternativa: fazer a própria geração da abertura (US-34) **também** devolver os campos de cena numa saída estruturada única (prosa + cena), economizando uma chamada. Custo: mistura criação e extração num só passo, o que pode degradar a qualidade da prosa. Decidir na implementação após medir.
2. **Objetos em cena vs. inventário.** `objetos_em_cena` é distinto do inventário carregado. A extração deve evitar listar itens que o personagem carrega (já no inventário) como objetos de cena. Precisa de regra explícita no prompt de extração.
3. **Precisão da extração.** Extração por LLM pode errar (marcar `interno` numa cena externa, inventar um NPC). Vale um piso de validação/heurística, ou o fallback para nulo já basta no MVP?

---

## Referências no código

- `apps/api/src/ai/ai.service.ts` — novo método `extractOpeningScene`; encadeado após a geração da abertura (US-34).
- `apps/api/src/adventure/adventure.service.ts` — persistir `sceneState` extraído no `CharacterState.create`.
- `packages/ai-engine/src/scene.ts` — `ScenePatch`, `mergeSceneState`, `formatSceneState` reusados; base do schema de extração.
- `packages/shared/src/types/character.ts` — `SceneState` (contrato, sem mudança).
- `apps/api/src/adventure/adventure.service.test.ts` — casos de extração-com-patch e extração-nula.
- `docs/sdlc/01-requisitos/US-11b-estado-de-cena-estruturado.md` — origem do `sceneState` e do `updateScene`.
- `docs/sdlc/01-requisitos/US-34-qualidade-da-narracao-do-dm.md` — gera a abertura da qual a cena é extraída.
