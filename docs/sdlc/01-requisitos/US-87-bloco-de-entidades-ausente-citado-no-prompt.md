# US-87 — O bloco de entidades passa a ser emitido em todo turno, inclusive vazio

**Épico:** 5 — Qualidade e avaliação do DM Agent
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** nenhuma. Pode rodar antes ou depois da [US-84](./US-84-nomes-de-bloco-do-turn-state-compartilhados.md) — as duas tocam as mesmas linhas, mas por motivos independentes. Se as duas entrarem, a US-84 primeiro (refactor puro, `diff` vazio no texto renderizado), esta depois (muda o que o modelo lê).
**Nasceu de:** [US-84](./US-84-nomes-de-bloco-do-turn-state-compartilhados.md) → *Questões em aberto #2*. Aquela story identificou o defeito e o deixou de fora por incompatibilidade de prova: ela se valida com comparação byte a byte, esta muda o texto renderizado.
**Relacionada a:** [US-75](./US-75-dimensao-de-proveniencia-no-ledger.md) (dona do ledger e do corpo do bloco), [US-56](./US-56-estado-do-turno-na-mensagem.md) (separou as camadas — é o que torna a camada 3 barata de mexer), [US-55](./US-55-prompt-caching-do-dm.md) (a camada 2 é cacheada — é o que torna a camada 2 cara de mexer, e por isso esta story não a toca), [US-35](./US-35-cena-estruturada-na-abertura.md) (mesmo condicional na cena, fora do escopo).
**Criada em:** 2026-07-27
**Reescopada em:** 2026-07-28 — de *eval A/B/C entre três variantes* para *implementar a variante B direto*. A justificativa da mudança está em [Por que sem eval](#por-que-sem-eval); as variantes descartadas ficam registradas em [Alternativas descartadas](#alternativas-descartadas).

---

## História

> **Como** mantenedor do DM Agent,
> **quero** que o prompt nunca mande o Mestre confiar num bloco que não está no contexto daquele turno,
> **para que** a instrução da camada 2 e o texto da camada 3 nunca se contradigam.

---

## Contexto e motivação

### O problema observado

A camada 2 (system prompt, estática, cacheada) afirma **incondicionalmente** que o bloco de entidades existe:

```
dm-system.ts:331   …This ledger is your PERMANENT memory — re-shown in full every turn under "${ENTITIES_BLOCK}"…
dm-system.ts:366   The "${SCENE_BLOCK}" and "${ENTITIES_BLOCK}" blocks in the turn-state are the SOURCE OF TRUTH…
```

> Números de linha revistos em 2026-07-28. Os originais desta story (`:314`, `:349`, `:428-440`) eram pré-[US-84](./US-84-nomes-de-bloco-do-turn-state-compartilhados.md): os nomes eram literais escritos à mão dos dois lados e hoje são interpolados das constantes `SCENE_BLOCK`/`ENTITIES_BLOCK` (`dm-system.ts:17-18`). **O defeito descrito aqui não mudou** — a citação continua incondicional e a emissão continua condicional; só o mecanismo de nomear o bloco é que passou a ser compartilhado.

A camada 3 (turn-state, recomputada por turno) o emite **condicionalmente**:

```ts
// dm-system.ts:454-455
const entitiesText = formatEntities(entities, sceneState?.presentes)
const entitiesSection = entitiesText ? `## ${ENTITIES_BLOCK} (FONTE DE VERDADE — …)` : ''
```

E `formatEntities` retorna `''` para ledger vazio (`entities.ts:74`).

Resultado com ledger vazio: o modelo lê "re-shown in full every turn" e "SOURCE OF TRUTH", e o bloco não está em lugar nenhum do contexto.

### Quando o ledger fica vazio — de fato

Duas vias, ambas deliberadas, mas com frequências **muito** diferentes. A distinção foi apurada em 2026-07-28 e corrige o que a versão anterior desta story afirmava:

1. **Semeadura da abertura falhou ou não achou nada.** `adventure.service.ts:130-135` chama `extractOpeningEntities`, que é best-effort — o comentário é explícito: *"Falha/vazio → ledger vazio (pré-US-75)"*. Mas olhando o extrator (`ai.service.ts:945-965`), ele só devolve `null` em três casos: texto de abertura vazio, `throw` do provedor, ou a abertura genuinamente não estabelecer nenhuma entidade durável. A abertura da [US-34](./US-34-qualidade-da-narracao-do-dm.md) — citada assim em `ai.service.ts:933` — por construção estabelece NPC e local. **Ledger vazio no turno 1 é caminho de falha, não estado normal de campanha nova.**
2. **`recordEntity` é discricionário do modelo.** Verdade, mas só governa entidades *novas*: os turnos seguintes já herdam o ledger semeado no passo 1. Esta via não produz ledger vazio sozinha — ela só o mantém vazio depois que o passo 1 falhou.

Ou seja, a afirmação original — *"uma campanha nova pode rodar vários turnos com o ledger vazio"* — é verdadeira, mas condicionada à falha da semeadura. Isso **rebaixa a urgência** (o caso é raro) sem tocar na correção do diagnóstico: quando acontece, a instrução órfã está lá em todo turno. É exatamente o perfil de defeito que se conserta com um diff barato e não com uma campanha de medição.

### Por que a solução atual não basta

O teste `dm-system.test.ts:293` (`it('sem entidades → nenhuma seção de Entidades')`) **codifica a emissão condicional como comportamento esperado**:

```ts
expect(buildState()).not.toMatch(/## Entidades do mundo/)
```

Ele prova o lado emissor e está certo no que prova. Ninguém testa o par: que a prosa da camada 2 só afirma o que a camada 3 vai de fato emitir. Não há defeito visível em `pnpm test`, `pnpm typecheck` nem em log.

---

## A mudança

`entitiesSection` deixa de ser condicional. Com ledger vazio, emite o cabeçalho e uma linha que converte a ausência em instrução:

```
## Entidades do mundo (FONTE DE VERDADE — canon permanente da campanha; NUNCA esqueça nem negue)
(nenhuma entidade registrada ainda — registre com `recordEntity` ao introduzir NPC, local ou objeto durável)
```

Três decisões de conteúdo, cada uma com motivo:

- **O cabeçalho é byte a byte o mesmo do caso cheio.** É o cabeçalho que a camada 2 promete; mudá-lo reabriria o eixo *nome*, que é da US-84.
- **O bloco KNOWLEDGE GATES (US-75) NÃO é emitido no caso vazio.** As três regras (provenance, `⚠ OCULTO`, continuidade de `local`) governam entradas que não existem — emiti-las com zero entidades é prosa morta que o Mestre lê todo turno. O corpo do bloco no caso **cheio** fica intacto, byte a byte.
- **A redação da linha vazia importa.** "(vazio)" seco convida o modelo a comentar a ausência na narração; algo que reafirme a ação (`registre com recordEntity`) transforma a ausência no gatilho da tool. Se aparecer sintoma de o Mestre "narrar em volta" da linha, a redação é o primeiro lugar a mexer — não a condição de emissão.

### Custo

**Zero de cache.** A camada 3 vai prefixada à última mensagem desde a [US-56](./US-56-estado-do-turno-na-mensagem.md), fora da fronteira de cache da [US-55](./US-55-prompt-caching-do-dm.md). Nenhuma linha da camada 2 muda, então o prefixo cacheado é idêntico e não há reaquecimento.

**Tokens:** ~2 linhas a mais, e só nos turnos de ledger vazio — que a seção anterior mostrou serem raros.

### Por que sem eval

A versão anterior desta story pedia um eval A/B/C antes de decidir. Descartado por três razões:

1. **O custo da medição excede o da mudança.** Eval de três braços com juiz e repetições, para autorizar um diff de duas linhas cujo custo de cache é zero e cuja reversão é um `git revert`. Eval se justifica quando a mudança é cara ou dolorosa de desfazer; esta não é nenhuma das duas.
2. **A própria story previa resultado nulo.** A Questão #2 original: *"cenário provável: o modelo simplesmente ignora a referência órfã e nada muda"*. Um experimento cujo desfecho esperado é "sem diferença" não decide nada — no empate, a escolha volta a ser por custo, e por custo B já ganha.
3. **A comparação seria contra um alvo em movimento.** O braço C mexe nas mesmas duas linhas da camada 2 que a investigação de travamento de deslocamento (2026-07-28) apontou como co-responsáveis; aquela área recebeu emenda na `continuityLine` no mesmo dia. Medir C contra um prompt que está sendo mexido produz número que não transfere. Como C está descartado (ver abaixo), o problema some junto.

A troca aceita: **não teremos número** sobre o impacto narrativo da instrução órfã. O que ganhamos é que a contradição entre as camadas deixa de existir, que é uma propriedade verificável por teste — e é o que a US-84 pediu.

---

## Alternativas descartadas

Registradas porque a análise custou caro e não deve ser refeita.

| | O que faria | Camada | Custo de cache | Por que descartada |
|---|---|---|---|---|
| **A — não fazer nada** | mantém o estado de hoje | — | — | a instrução órfã permanece; e o custo de consertar é baixo demais para justificar conviver com ela |
| **C — frasear com ressalva** | `:331` e `:366` passariam a qualificar ("quando presente" / "se listado") | 2 | invalida o cache uma vez, depois reaquece | **enfraquece em TODO turno uma regra hoje absoluta**, inclusive nos turnos com ledger cheio, que são a maioria. O custo cai sobre o caso comum para consertar o caso raro. Pior: são exatamente as duas linhas que a investigação de deslocamento de 2026-07-28 apontou como co-responsáveis por o Mestre não mover a personagem — enquanto `updateScene` não é chamado, narrar a personagem noutro lugar contradiz um bloco declarado fonte de verdade, e o modelo resolve o conflito ficando parado. Afrouxar "fonte de verdade" por um motivo sem relação empurraria a mesma corda que a emenda da `continuityLine` já empurrou, sem ninguém saber onde o prompt para. |
| **D — só o cabeçalho, sem a linha explicativa** | isolaria "o cabeçalho existir" de "o Mestre saber que está vazio" | 3 | zero | era o quarto braço hipotético do eval original. Cabeçalho seguido de nada é convite mais forte a comentário na narração do que uma linha que diz o que fazer. Fica como fallback se a linha explicativa der problema. |

---

## Escopo

### Dentro do escopo

- Tornar `entitiesSection` incondicional em `buildTurnStateBlock`, com corpo distinto para o caso vazio (cabeçalho + linha de instrução, sem KNOWLEDGE GATES).
- Reescrever `dm-system.test.ts:293`, que hoje afirma o comportamento oposto.
- Teste novo do par camada 2 ↔ camada 3: o nome citado no system aparece no turn-state **com e sem** entidades.

### Fora do escopo

- **O eixo *nome*** — é a [US-84](./US-84-nomes-de-bloco-do-turn-state-compartilhados.md). Aqui o nome não muda.
- **Qualquer alteração na camada 2.** `:331` e `:366` ficam byte a byte iguais. É isso que mantém o custo de cache em zero e o afastamento da área de deslocamento em fluxo.
- **A metade da cena.** `sceneSection` (`dm-system.ts:440`) tem o mesmo condicional, mas a [US-35](./US-35-cena-estruturada-na-abertura.md) confinou o caso vazio ao turno de abertura, onde ele é causalmente inevitável (a abertura é o que *gera* a cena). Do turno 1 em diante o campo está preenchido.
- **Reescrever as regras do ledger** (knowledge gates, provenance, ocultos). São da [US-75](./US-75-dimensao-de-proveniencia-no-ledger.md) e ficam intactas no caso cheio.
- **Garantir que o ledger nunca fique vazio** (ex.: tornar `extractOpeningEntities` obrigatório). É mudar o comportamento do sistema para acomodar o prompt — inversão de causa; e derruba a criação de aventura quando a extração falha.
- **Investigar por que a semeadura falha.** Se os logs mostrarem `[AiService] Falha ao semear entidades da abertura` com frequência, isso é defeito próprio e merece story própria — esta story torna a falha inofensiva para o prompt, não a elimina.

---

## Critérios de aceite

- [ ] `buildTurnStateBlock` emite o cabeçalho `## ${ENTITIES_BLOCK}` em **todo** turno, com e sem entidades.
- [ ] Com ledger vazio, o bloco traz a linha de instrução apontando para `recordEntity`, e **não** traz o bloco KNOWLEDGE GATES.
- [ ] Com ledger cheio, o texto renderizado é **byte a byte idêntico** ao de hoje (nenhuma regressão no caso comum).
- [ ] `dm-system.test.ts:293` foi **reescrito** para afirmar o novo contrato — não deletado. Localize pelo nome do caso (`'sem entidades → nenhuma seção de Entidades'`), não pelo número: esta é a terceira vez que estes ponteiros envelhecem.
- [ ] Existe teste que falha se a citação da camada 2 e a emissão da camada 3 voltarem a divergir.
- [ ] Nenhum diff em `dm-system.ts:331` e `:366`.
- [ ] A *Questão #2* da [US-84](./US-84-nomes-de-bloco-do-turn-state-compartilhados.md) foi fechada apontando para esta story.
- [ ] `pnpm test` verde. `pnpm eval` verde.

---

## Notas de implementação

- **A API roda `packages/ai-engine/dist`.** Editar `src` sem `pnpm --filter @ai-dm/ai-engine build` não tem efeito nenhum em teste manual.
- **O teste do caso cheio já existe** (`it('injeta o bloco de Entidades do mundo como FONTE DE VERDADE quando há entidades')`, `dm-system.test.ts:282`) e deve continuar passando sem edição. Se ele quebrar, o corpo do caso cheio foi alterado — o que esta story proíbe.
- **`formatEntities` (`entities.ts:74`) não muda.** Continua devolvendo `''` para ledger vazio; quem passa a tratar o `''` como "emita a variante vazia" em vez de "não emita nada" é `buildTurnStateBlock`. Manter a decisão no chamador evita que `formatEntities` tenha que conhecer o texto do cabeçalho.
- **`evals/PROMPT-ANCHORS.md`:** verificar se há assertiva ancorada na *ausência* do bloco. Não deveria haver (o registro cobre prosa do system, e o system não muda), mas a checagem é barata.

---

## Questões em aberto

1. **A linha vazia vira tema de narração?** Risco aceito, não medido. Sintoma a vigiar em uso manual: o Mestre mencionar que "nada foi registrado" ou narrar em volta disso. Se acontecer, a ordem de tentativa é (a) reescrever a linha, (b) cair para a alternativa D (só cabeçalho). A condição de emissão não volta a ser condicional.
2. **Com que frequência a semeadura falha, afinal?** Determina se o caso vazio é raridade de laboratório ou algo que jogadores encontram. Responde-se contando `[AiService] Falha ao semear entidades da abertura` nos logs de produção — e o resultado alimenta a decisão de abrir a story de defeito citada em *Fora do escopo*.

---

## Referências no código

- `packages/ai-engine/src/prompts/dm-system.ts` — `:17-18` (as constantes de nome), `:331` e `:366` (as citações incondicionais, que NÃO mudam), `:454-455` (a emissão condicional — é aqui que a story mexe), `:440` (o mesmo condicional na cena, fora do escopo). Linhas revistas em 2026-07-28; ver a ressalva no *Problema observado*.
- `packages/ai-engine/src/entities.ts` — `:74`: `if (!entities || entities.length === 0) return ''`, a origem do bloco ausente. Não muda.
- `apps/api/src/adventure/adventure.service.ts` — `:130-135`: a semeadura best-effort.
- `apps/api/src/ai/ai.service.ts` — `:945-965`: `extractOpeningEntities`, o extrator cujo `null` é a via real do ledger vazio.
- `packages/ai-engine/src/prompts/dm-system.test.ts` — `:282` (caso cheio, deve continuar verde) e `:293` (caso vazio, a ser reescrito).
- `evals/PROMPT-ANCHORS.md` — o registro de assertivas ancoradas em prosa do prompt.
