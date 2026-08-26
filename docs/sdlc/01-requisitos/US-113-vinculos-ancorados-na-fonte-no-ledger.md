# US-113 — Vínculos entre entidades, ancorados em quem os estabeleceu

**Épico:** 3 — Narração e mecânica
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** [US-75](./US-75-dimensao-de-proveniencia-no-ledger.md) (o ledger `Adventure.entities`, os eixos `sabido`/`revelado`, `mergeEntities`/`formatEntities` e a tool `recordEntity` — esta US estende os quatro)
**Relacionada a:** [US-112](./US-112-arco-de-beats-do-que-muda.md) (mesma família: dar ao Mestre estrutura em vez de proibição) · [US-87](./US-87-bloco-de-entidades-ausente-citado-no-prompt.md) (o prompt não cita bloco que o turn-state não emitiu)
**Criada em:** 2026-08-12

---

## História

> **Como** jogador,
> **quero** que o Mestre saiba **como** as pessoas e os lugares da campanha se ligam entre si, e de onde ele tirou cada ligação,
> **para que** ele não invente que a estalajadeira é irmã do herborista num turno e a esqueça no seguinte, nem me entregue um vínculo que eu ainda não descobri.

---

## Contexto e motivação

### O problema observado

Esta US fecha uma lacuna que a própria [US-75](./US-75-dimensao-de-proveniencia-no-ledger.md) documentou e deixou aberta. *Questões em aberto* #1 daquela story, verbatim no repo:

> *"Se surgir um fato oculto que não se alinhe a nenhuma entidade (ex.: uma relação entre dois locais já revelados), a granularidade por-entidade não o segura — precisaria de um 'fato' como unidade própria no ledger."*

O ledger de hoje é um **conjunto plano de entidades**. Cada `WorldEntity` guarda `nome`, `tipo`, `local`, `estado`, `nota` — tudo **sobre si mesma**. Um vínculo entre duas entidades não tem casa:

- *"Marta é irmã de Morvath"* — vive na `nota` da Marta, ou na do Morvath, ou nas duas em cópias que divergem no turno seguinte.
- *"o arboreto é de Morvath"* — a US-75 resolveu pondo `local: arboreto` na entidade Morvath, e a própria story admite que isso é modelagem torta: o vínculo é a informação, não a posição.
- *"a Sibil deve dinheiro à guilda"* — não é `local`, não é `estado`, não é `tipo`. Só cabe em `nota`, texto livre que nenhum gate consegue defender.

**`nota` é onde o vínculo vai morrer.** É prosa: `mergeEntities` a sobrescreve inteira, não há como marcá-la `revelado: false` separadamente da entidade, e o Mestre não distingue "isto foi estabelecido na abertura" de "isto eu improvisei há dois turnos". Foi exatamente o **Erro 1** da US-75 (Marta afirmando que Morvath morava no moinho): o Mestre tratou uma invenção sua com o mesmo peso do canon.

### Por que a solução atual não basta

Os dois eixos da US-75 (`sabido`, `revelado`) são **por entidade**. Isso cobre "quem pode saber que a Marta existe", mas não "quem pode saber que a Marta é irmã do Morvath" — e os dois são independentes: as duas entidades podem estar `publico`+`revelado` e o vínculo entre elas ser o segredo da campanha inteira.

E falta o eixo que a US-75 nem tocou: **de onde veio**. Hoje toda linha do ledger tem o mesmo peso, seja ela semeada da abertura, registrada porque um NPC a disse em cena, ou improvisada pelo Mestre num turno qualquer. Sem essa marca, um vínculo inventado vira canon indistinguível do estabelecido no turno seguinte, e nunca há como o Mestre — ou quem lê o log — saber qual é qual.

### A proposta

Dar a cada entidade uma lista de **vínculos** (`relacoes`): aresta dirigida para outra entidade do ledger, com três coisas que a `nota` não tem — um **verbo de relação** legível, uma **âncora de fonte** (onde este vínculo foi estabelecido) e os **mesmos dois eixos de conhecimento da US-75**, aplicados ao vínculo, não às pontas.

A âncora é o que muda o comportamento: um vínculo com `fonte: "abertura"` é canon que o Mestre não pode contradizer; um com `fonte: "turno 12 — Marta disse em cena"` é canon que veio da ficção jogada; e o gate do prompt passa a poder dizer *não afirme relação que não está no ledger* — regra que hoje é impossível de escrever, porque não existe onde a relação estaria.

Ideia lida em [neuralinitiative/claude-dnd-skill](https://github.com/neuralinitiative/claude-dnd-skill) (*NPC relationship graph with source-anchored edges*). **AGPL-3.0: nada dali entra neste repo.** O que atravessa é o desenho — a implementação abaixo é escrita própria sobre a `WorldEntity` que já existe aqui.

---

## Escopo

### Dentro do escopo

- **Tipo `EntityEdge` e campo `WorldEntity.relacoes?: EntityEdge[]`.** **Sem migração de banco** — `Adventure.entities` já é coluna `Json` ([`schema.prisma:77`](../../../apps/api/prisma/schema.prisma)) e o campo é opcional: ledgers já gravados seguem funcionando sem tocar em nada, exatamente como a US-75 fez com `sabido`/`revelado`.
- **A aresta guarda a fonte.** `fonte: string` — como o vínculo entrou no ledger (`"abertura"`, `"turno: <eventLogId>"`, texto curto). É o campo que dá peso diferente a canon estabelecido e a improviso, e sem ele a US é só uma `nota` estruturada.
- **Eixos de conhecimento na aresta.** `sabido` e `revelado` com a **mesma semântica e os mesmos defaults** da US-75 (ausente ⇒ `publico` / `true`), mas **independentes das pontas**: duas entidades reveladas podem ter entre si um vínculo `revelado: false`. É o caso que a US-75 não segurava.
- **`recordEntity` ganha `relacoes` — sem tool nova.** Array opcional dentro de cada objeto de `entidades` no schema Zod (`ai.service.ts:572`). A contagem de tools do projeto não muda (AGENTS.md → *Tools disponíveis*), e o Mestre já chama `recordEntity` no momento em que introduz a entidade: registrar o vínculo ali é o turno certo.
- **Merge por chave `(relacao, para)`** em `mergeEntities` ([`entities.ts:16`](../../../packages/ai-engine/src/entities.ts)), com a mesma tolerância a acento/caixa do match por `nome` e a mesma semântica parcial: campo omitido preserva o anterior. Re-registrar promove `revelado: false → true` e `privado → publico`, como na US-75.
- **Render em `formatEntities`** (`entities.ts:70`): os vínculos saem indentados sob a entidade de origem, com a fonte entre parênteses e os marcadores de `privado`/`OCULTO` já definidos pela US-75. Entidade sem vínculo renderiza como hoje, sem ruído.
- **Gate de vínculo no cabeçalho do bloco de entidades** (`dm-system.ts:517`): *ao afirmar como duas entidades do ledger se ligam, use um vínculo registrado; se a ficção estabelecer um vínculo novo, registre-o com `recordEntity` no mesmo turno em que o narra.*
- **Aresta órfã não quebra nada.** `para` apontando para entidade que não está no ledger renderiza pelo nome cru; não é erro, não lança.

### Fora do escopo

- **Grafo de crença por NPC** (o que cada NPC específico testemunhou ou ouviu). A US-75 já o classificou como *"o teto correto, pesado demais para a Fase 1"* e continua sendo. Vínculo com `sabido` cobre "o mundo pode falar disto"; modelar a cabeça de cada NPC é outra ordem de grandeza.
- **Travessia do grafo** (caminho entre entidades, grau de separação, inferência transitiva). O ledger tem dezenas de entradas e é reexibido inteiro todo turno — o modelo faz a travessia lendo. Código de travessia seria peso sem consumidor.
- **Extração automática de vínculos da narração** (uma [US-73](./US-73-reconciliador-de-cena-em-background.md) para as arestas). O ledger de entidades ainda nem tem semeadura contínua turno-a-turno — a própria US-75 deixou isso fora. Registrar arestas via tool primeiro, medir se o Mestre chama, e só então considerar a rede.
- **Visualização do grafo na web.** Zero valor para o jogador na Fase 1; o grafo existe para o prompt.
- **Backstop determinístico do gate** (regenerar a narração que afirma vínculo não registrado). Mesma posição da US-75 *Questões em aberto* #2: prematuro até medir vazamento.

---

## Modelo de dados proposto

**Sem migração de banco.** Campo novo em `WorldEntity`, dentro da coluna `Json` que já existe.

`packages/shared/src/types/character.ts`:

```ts
export interface EntityEdge {
  /** Verbo do vínculo, legível na prosa: "irmã de", "deve dinheiro a", "serve", "fica dentro de". */
  relacao: string
  /** `nome` da entidade de destino. Match tolerante a acento/caixa, como o do ledger. */
  para: string
  /**
   * ONDE este vínculo foi estabelecido (US-113). É o que separa canon de improviso:
   * "abertura" = semeado da prosa de gênese, o Mestre não pode contradizer;
   * "turno: <eventLogId>" = estabelecido na ficção jogada.
   * Sem esta âncora a aresta é só uma `nota` com mais passos.
   */
  fonte: string
  /** Eixo A da US-75, aplicado AO VÍNCULO — independente do das pontas. Ausente ⇒ `publico`. */
  sabido?: 'publico' | 'privado'
  /** Eixo B da US-75, aplicado AO VÍNCULO. Ausente ⇒ `true`. Duas entidades reveladas podem ter vínculo oculto. */
  revelado?: boolean
  atualizadoEm: string
}

export interface WorldEntity {
  // ... campos da US-75 (nome, tipo, local, estado, nota, sabido, revelado, atualizadoEm)
  /**
   * Vínculos DIRIGIDOS desta entidade para outras do ledger (US-113). Moram na
   * entidade de origem — o ledger é pequeno e reexibido inteiro todo turno, então
   * não há coluna nem índice a pagar. Ausente ⇒ entidade sem vínculo (comportamento
   * pré-US-113).
   */
  relacoes?: EntityEdge[]
}
```

Render pretendido em `formatEntities`:

```
- Marta (npc) — estalajadeira do Javali Manco, em Burwood
    → irmã de: Morvath  (abertura)
    → deve dinheiro a: guilda dos moleiros  (turno: clx8…, restrito — só quem viu)
- Morvath (npc) — herborista, no arboreto
    → dono de: arboreto  (turno: clx4…, ⚠ OCULTO — verdade do mundo, NÃO revele ao jogador ainda)
```

A última linha é o caso do arboreto da US-75, agora modelado onde ele de fato mora: no **vínculo**, não em `local` da entidade.

---

## Critérios de aceite

- [x] `EntityEdge` existe em `@ai-dm/shared` e `WorldEntity.relacoes` é opcional; **nenhuma migração Prisma** é necessária.
- [x] Ledger gravado antes desta US (entidades sem `relacoes`) renderiza e funciona exatamente como hoje (teste de retrocompat em `entities.test.ts`).
- [x] `mergeEntities` casa arestas por `(relacao, para)` com tolerância a acento/caixa, preserva campo omitido pelo patch e sobrescreve o que o patch traz (teste unitário).
- [x] Aresta sem `sabido` é tratada como `publico`; sem `revelado`, como `true` — no render e nos gates.
- [x] Uma aresta pode ser `revelado: false` com **as duas pontas** `revelado: true`, e o render a marca como OCULTA (é o caso que a US-75 *Questões em aberto* #1 não segurava — este é o critério que fecha a lacuna).
- [x] `recordEntity` aceita `relacoes` no schema Zod; a `description` da tool orienta quando registrar vínculo e exige preencher `fonte`.
- [x] `formatEntities` imprime os vínculos indentados sob a origem, com a fonte e os marcadores de `privado`/`OCULTO`; entidade sem vínculo sai sem linha extra.
- [x] Aresta com `para` apontando para entidade ausente do ledger renderiza pelo nome cru e **não** lança (não há lookup — `para` é sempre texto cru).
- [x] `recordEntity` com `relacoes` continua **sem** criar `EventLog` do tipo `CHARACTER_UPDATE` (regressão do guard da [US-67](./US-67-editar-acao-enviada-ao-dm.md) — o comentário em `ai.service.ts:608` explica por quê; caminho de código inalterado por esta US, cobertura em `ai.service.test.ts`/`ai.controller.test.ts`).
- [x] **Eval / teste de regressão:** coberto pelo mesmo padrão da US-75 (Erro 3) — gate textual em `dm-system.ts` (regra "Links (US-113)") + `formatEntities` provando que `Morvath —dono de→ arboreto` com `revelado: false` renderiza `⚠ OCULTO` mesmo com as duas pontas reveladas. Medição de taxa em produção fica para *Questões em aberto* #1/#2 (decisão já registrada nesta US), como a própria seção *Fora do escopo* previu.
- [x] **Eval do gate:** mesma cobertura — regra textual adicionada ao cabeçalho de `Entidades do mundo`; taxa de invenção/chamada de `recordEntity` é medição de produção, não bloqueante deste ship (ver *Questões em aberto* #1/#2).
- [x] `pnpm eval` e `pnpm typecheck` passam.

---

## Notas de implementação

> *Dicas. O implementador pode divergir com boa justificativa.*

- **Reimplementar, nunca copiar.** A ideia vem de um repo **AGPL-3.0**. O modelo acima já é escrita própria sobre a `WorldEntity` desta casa; não abra o código de lá para "conferir a estrutura".
- **Aresta na origem, não em coluna própria.** A alternativa era uma coluna `Adventure.relations Json?`. Guardar em `WorldEntity.relacoes` evita a migração inteira e segue o precedente da US-75 (*"não há migração de schema de banco"*). O custo é que "quem aponta para B" exige varrer o ledger — irrelevante em dezenas de entradas que já são serializadas por inteiro todo turno.
- **`fonte` é o campo que justifica a US.** Sem ela isto é uma `nota` estruturada e não vale o schema. Preencher com `"abertura"` na semeadura e com o `id` do `EventLog` do turno quando vem de `recordEntity` — o `EventLog` do turno já existe (`ai.service.ts:783`).
- **Semeadura da abertura:** `extractOpeningEntities` (`ai.service.ts:1020`) pode passar a extrair vínculos que a prosa **afirma explicitamente**, com `fonte: "abertura"`. Mantém a instrução dura da US-75: *nunca INFIRA um vínculo que o texto não afirma* — que é precisamente o risco que arestas amplificam (ver *Questões em aberto* #1). Escopo opcional: dá para entregar a US só com registro via tool e semear depois.
- **Onde escrever o gate:** cabeçalho do bloco de entidades em `dm-system.ts:517`, ao lado dos gates da US-75. **Não** em `NARRATIVE_CRAFT_SECTION` — dispararia o guard de drift da rubrica (`rubric-drift.test.ts`, US-36).
- **Custo de prompt:** o ledger vai ao modelo inteiro todo turno, na camada 3. Arestas engordam o bloco. Manter o render de uma linha por vínculo e `relacao` curta; se o bloco crescer demais, o teto vem antes do valor — medir com a baseline de cache da US-104.
- **`ai-engine` roda de `dist`:** `entities.ts` e `dm-system.ts` exigem `pnpm --filter @ai-dm/ai-engine build` para a API pegar. `apps/api` roda TS direto.

---

## Questões em aberto

1. **Arestas convidam o modelo a inventar vínculo?** Um campo estruturado para relações é também um convite a preenchê-lo. A US-75 já observou o Mestre inferindo um vínculo que a prosa não afirmava (Erro 1) e teve de escrever instrução dura contra isso. O risco aqui é maior, não menor. Medir **taxa de vínculo inventado** no eval antes de semear arestas na abertura.

   **Resposta:** não semear `relacoes` em `extractOpeningEntities` neste ship. Entregar só via `recordEntity`, com a instrução dura de "nunca infira vínculo que a prosa não afirma" (mesmo texto da US-75, adaptado a aresta). Medir taxa de vínculo inventado no eval de regressão (comparar vínculo afirmado na narração vs vínculo presente no ledger) por um período antes de considerar semeadura na abertura. Decisão de semear fica para US futura, condicionada ao resultado dessa medição.

2. **O Mestre vai chamar `recordEntity` com `relacoes`?** Precedente ruim: `updateScene` foi ignorada em 9 de 24 viagens (US-71). Se a taxa for baixa, o campo fica vazio e o gate não tem o que defender — *guard sem dado é guard morto*, como a US-75 escreveu. Medir antes de construir qualquer rede de segurança.

   **Resposta:** medir com o mesmo método do spike de `updateScene` (US-71): contar, num lote de turnos de eval/sessão real, quantos turnos em que a narração estabelece vínculo novo resultam em chamada de `recordEntity` com `relacoes` preenchido. Sem backstop determinístico agora (já fora de escopo). Se a taxa sair baixa, primeiro reforço é a `description` da tool (lembrete explícito no momento em que a entidade é introduzida), não código novo.

3. **`relacao` deve ser texto livre ou enum?** Texto livre lê melhor na prosa e não precisa de manutenção; enum torna o merge e o gate confiáveis (hoje "irmã de" e "é irmã de" são duas arestas distintas). Começar com texto livre e normalizar no merge (trim, minúsculas, sem acento) é o meio-termo barato; enum só se a duplicação aparecer no dado.

   **Resposta:** texto livre + normalização no merge (trim, minúsculas, sem acento), como a nota de implementação já indica. Fechada — só reabrir se o dado real mostrar duplicação que a normalização não resolve (ex.: sinônimos tipo "irmã de" vs "parente de").

4. **Vínculo dirigido basta?** `Marta —irmã de→ Morvath` não implica a recíproca no ledger. Materializar a inversa dobra o dado e cria duas verdades para manter em sincronia; deixar ao modelo inferir a recíproca é o padrão barato e provavelmente suficiente. Reavaliar se aparecer contradição de direção em sessão real.

   **Resposta:** manter dirigido, sem materializar inversa. Fechada — reavaliar só se sessão real mostrar o modelo errando a direção inferida.

---

## Referências no código

- [`packages/shared/src/types/character.ts:44`](../../../packages/shared/src/types/character.ts) — `WorldEntity`; `EntityEdge` e `relacoes` entram aqui, ao lado de `sabido`/`revelado` da US-75.
- [`packages/ai-engine/src/entities.ts`](../../../packages/ai-engine/src/entities.ts) — `:16` `mergeEntities` (merge das arestas por `(relacao, para)`); `:70` `formatEntities` (render indentado); `entities.test.ts` (retrocompat, merge parcial, ortogonalidade dos eixos na aresta).
- [`packages/ai-engine/src/prompts/dm-system.ts:517`](../../../packages/ai-engine/src/prompts/dm-system.ts) — cabeçalho do bloco `Entidades do mundo`, onde os gates da US-75 já vivem e o de vínculo entra. `:23` `ENTITIES_BLOCK` (o nome que a `description` da tool promete).
- [`apps/api/src/ai/ai.service.ts`](../../../apps/api/src/ai/ai.service.ts) — `:565` tool `recordEntity` (schema Zod em `:572`, `description` em `:570`); `:608` o comentário que explica por que não se loga `CHARACTER_UPDATE`; `:783` o `EventLog` do turno, origem do `id` que vira `fonte`; `:1020` `extractOpeningEntities` (semeadura opcional de arestas).
- [`apps/api/prisma/schema.prisma:77`](../../../apps/api/prisma/schema.prisma) — `Adventure.entities Json?`, a coluna que absorve o campo novo sem migração.
- [US-75](./US-75-dimensao-de-proveniencia-no-ledger.md) — *Questões em aberto* #1 é a lacuna que esta US fecha; *Fora do escopo* explica por que o grafo de crença por-NPC continua fora.
