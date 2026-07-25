# US-75 — Dimensões de conhecimento no ledger (canon consistente + o NPC e o jogador só sabem o que deviam)

**Épico:** 3 — Narração e mecânica
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** [US-35](./US-35-cena-estruturada-na-abertura.md) (extração estruturada da prosa de abertura — o padrão reusado para semear o ledger) · o ledger de entidades (`Adventure.entities` / `recordEntity`, introduzido junto da [US-71](./US-71-simplificar-localizacao-do-personagem.md) e reusado pela [US-73](./US-73-reconciliador-de-cena-em-background.md)).
**Relacionada a:** [US-73](./US-73-reconciliador-de-cena-em-background.md) (mesma arquitetura de extração pós-LLM em background; aquela reconcilia a CENA, esta semeia e escopa o LEDGER) · [US-67](./US-67-edicao-de-turno.md) (por isso a semeadura e os gates NÃO logam `CHARACTER_UPDATE`).
**Criada em:** 2026-07-24

---

## História

> **Como** jogador,
> **quero** que o Mestre respeite onde as coisas e as pessoas do mundo realmente ficam, que cada NPC só saiba o que teria como saber, e que o mundo não me entregue revelações antes de eu as descobrir,
> **para que** a estalajadeira não invente que o herborista morava no moinho, nem fale de capangas que só eu vi, nem alguém me diga que o arboreto era de Morvath antes de eu ligar os pontos.

---

## Contexto e motivação

### Os três erros observados (com dado de produção)

Sessão real (`narração equivocada ou que sabe demais.md`, aventura de Andreas, estalajadeira Marta):

1. **O Mestre contradiz o canon.** Marta afirma sobre o herborista Morvath: *"todo mundo sabia que **Morvath morava lá**"* — **lá = o moinho ao norte**. Mas o jogador visitou o **arboreto de Morvath**. O Mestre deu ao NPC um lar diferente do já estabelecido.

2. **Um NPC sabe o que não teria como saber.** Marta sugere procurar *"algo que **os capangas** do comprador não encontraram"*. Marta **nunca viu esses capangas** — quem esbarrou neles foi o jogador, sozinho, no moinho, e **não contou a ela**. Um fato da visão global vazou para a boca de uma NPC sem acesso a ele.

3. **O mundo entrega uma revelação cedo demais.** Quando o jogador visitou o arboreto, ele **não sabia que era de Morvath** — essa ligação é descoberta muito depois. O fato *"o arboreto é de Morvath"* é **verdade do mundo desde sempre** (os locais sabem), mas **o jogador ainda não sabe**. Se o Mestre tratar essa verdade como já conhecida pelo personagem, ele queima o reveal — narra "o arboreto de Morvath" antes de o jogador ter como saber de quem era.

### A causa-raiz: o ledger mistura eixos de conhecimento que são independentes

O sistema tem UM armazém de "o que é verdade no mundo" — o ledger `Adventure.entities` (+ cena + resumo), reinjetado íntegro todo turno. Ele guarda **se um fato é verdade**, mas não **quem tem direito de saber desse fato**. E "quem sabe" tem DOIS eixos ortogonais:

- **Eixo A — proveniência no mundo:** o fato é conhecimento **comum** (a vila, a estalajadeira, o herborista local e onde mora) ou é **restrito**, algo que só quem esteve lá conhece (os capangas no moinho abandonado)? Sem essa marca, o Mestre põe qualquer fato na boca de qualquer NPC → **Erro 2**.
- **Eixo B — descoberta do jogador:** o personagem-jogador **já descobriu** esse fato, ou é uma verdade do mundo que ele **ainda não ligou**? Sem essa marca, o Mestre entrega ao jogador coisas que o mundo sabe mas o personagem não → **Erro 3**.

Os dois eixos são independentes: *"o arboreto é de Morvath"* é **comum no mundo** (Eixo A = público) **e** **não-descoberto pelo jogador** (Eixo B = oculto). Um único campo binário não expressa esse cruzamento — por isso são **dois** campos.

E o ledger ainda **nasce vazio**: a abertura (`generateOpeningNarration`) roda **tool-free** de propósito e estabelece cenário e NPCs **só em prosa**; `extractOpeningScene` (US-35) captura só a **cena** (local/presentes/objetos), não entidades duráveis. Sem uma âncora estruturada do que a abertura estabeleceu, o Mestre fica livre para contradizer depois (**Erro 1**) — *guard sem dado é guard morto.*

### A proposta: duas dimensões de conhecimento + semeadura da gênese

Dar a cada entidade do ledger **dois campos ortogonais**:

- `sabido: 'publico' | 'privado'` — **Eixo A**. `publico` = conhecimento comum (qualquer NPC local pode referenciar). `privado` = só o jogador e quem testemunhou; um NPC só menciona se o jogador lhe contou **nesta conversa**.
- `revelado: boolean` (default `true`) — **Eixo B**. `true` = o personagem-jogador já sabe; o Mestre pode narrar livremente. `false` (oculto) = verdade do mundo que o Mestre mantém **só para não se contradizer**, mas **NUNCA revela ao jogador** até a ficção merecer — então o Mestre re-registra `revelado: true`.

Os dois compõem os quatro estados que os três erros exigem:

| `sabido` | `revelado` | significado | exemplo |
|---|---|---|---|
| publico | true | todos sabem, o jogador também | a vila de Burwood, a estalajadeira Marta |
| privado | true | o jogador sabe, o mundo não | **os capangas no moinho** (Erro 2) |
| publico | false | os locais sabem, o jogador ainda não | **o arboreto é de Morvath** (Erro 3) |
| privado | false | segredo puro; nem o jogador ligou ainda | uma reviravolta que o Mestre pinou para si |

E como o ledger precisa **existir** para segurar canon, uma **passagem de semeadura** roda na criação da aventura (gêmea de `extractOpeningScene`): extrai as entidades que a **abertura de fato revelou ao jogador** e as grava `sabido: 'publico', revelado: true`. Ela **nunca infere** um vínculo que a prosa não afirmou (o arboreto anônimo é semeado como lugar, sem dono) — segredos emergentes entram depois, via `recordEntity`.

Como os três erros ficam cobertos:

- **Erro 1 (contradição):** o ledger passa a segurar o `local` das entidades — semeado quando a abertura estabelece, ou registrado via `recordEntity` quando o vínculo emerge no jogo. Uma regra de continuidade no gate proíbe inventar um `local` diferente do registrado. O anchor existe; o guard tem o que defender.
- **Erro 2 (onisciência do NPC):** o `sabido` é o gate do Eixo A. Fato `privado` fica fora dos lábios de um NPC que não o testemunhou e a quem o jogador não contou.
- **Erro 3 (reveal queimado):** o `revelado` é o gate do Eixo B. Fato `revelado: false` fica visível ao Mestre (para consistência) mas **proibido de vazar ao jogador** na prosa ou nas opções.

Barato e no padrão da casa: reusa `summaryModel` + `generateObject` + `mergeEntities`; a semeadura é fire-and-forget na criação (como a US-35); os campos são opcionais e retrocompatíveis (ausência ⇒ `publico` + `revelado: true`, o comportamento de hoje); `Adventure.entities` já é coluna `Json`, então **não há migração de schema de banco**.

---

## Escopo

### Dentro do escopo

- **Campos `sabido` e `revelado` em `WorldEntity`.** `sabido: 'publico' | 'privado'` (ausente ⇒ `publico`); `revelado: boolean` (ausente ⇒ `true`). Ortogonais e retrocompatíveis — entidades já gravadas seguem públicas e reveladas, como hoje.
- **Semeadura do ledger na abertura (Erro 1).** Novo método `extractOpeningEntities(openingText, questContext)` em `ai.service.ts`, espelhando `extractOpeningScene`: `generateObject` com schema de `WorldEntity[]`, extraindo o que a prosa de abertura + o gancho estabelecem. Toda entidade semeada nasce `publico` + `revelado: true`. **Instrução dura ao extrator:** só extraia o que ESTE texto revela ao jogador; **nunca infira** um dono, uma identidade ou um segredo que a prosa não afirma explicitamente. Chamado em `adventure.service.ts` na criação, **antes da transação** (é LLM); resultado entra em `tx.adventure.create({ data: { entities } })`. Falha/vazio ⇒ ledger vazio (comportamento de hoje); nunca derruba a criação.
- **`sabido` e `revelado` na tool `recordEntity`.** Novos parâmetros opcionais no schema Zod. O prompt orienta: `privado` para o que o jogador descobriu sozinho, fora de cena; `revelado: false` para uma verdade do mundo que o Mestre pina para não se contradizer mas o jogador **ainda não** descobriu. `mergeEntities` propaga ambos com a semântica parcial dos demais campos (omitido preserva) — então o Mestre **promove** `revelado: false → true` (reveal ao jogador) e `privado → publico` (segredo que se espalha) re-registrando.
- **Render em `formatEntities`.** Fato `privado` e fato `oculto` (`revelado: false`) ganham marcadores curtos e distintos na linha (ex.: `(restrito — só quem viu)` e `⚠ OCULTO — verdade do mundo, NÃO revele ao jogador ainda`); o caso comum (`publico` + `revelado`) renderiza como hoje, sem ruído.
- **Gate do Eixo A no bloco de entidades (Erro 2).** Regra no cabeçalho: *um NPC em cena só menciona fatos `publico`, ou fatos `privado` que o jogador compartilhou com ele NESTA conversa; nunca faça um NPC referenciar um fato restrito que ele não testemunhou e o jogador não contou.*
- **Gate do Eixo B no bloco de entidades (Erro 3).** Regra no cabeçalho: *entidades marcadas OCULTO são para SUA consistência apenas; NUNCA as revele ao jogador — não as nomeie, não as insinue na narração nem nas opções — até a ficção fazer o personagem descobrir; então chame `recordEntity` para marcá-las reveladas.*
- **Regra de continuidade de `local` (reforço do Erro 1).** Linha no gate: *ao dizer onde uma entidade do ledger está/mora, use o `local` registrado; NUNCA invente um lugar diferente para uma entidade que já tem `local`.*

### Fora do escopo

- **Modelo completo de conhecimento por NPC** (o que cada NPC específico testemunhou/ouviu — um grafo de crença por personagem). É o teto correto, pesado demais para a Fase 1. As duas faixas (mundo vs jogador) cobrem os casos observados; refinar por-NPC fica para uma US futura se a evidência pedir.
- **Reveal em granularidade de campo/fato.** `revelado` é por-ENTIDADE. O caso do arboreto se modela pondo o vínculo oculto na entidade Morvath (`revelado: false`, `local: arboreto`), não no arboreto (que o jogador conhece como lugar anônimo). Um fato oculto que não se alinhe a nenhuma entidade fica como limitação conhecida (ver Questões em aberto #1).
- **Filtrar o bloco de entidades por NPC/por reveal** (esconder do prompt os fatos restritos/ocultos). O Mestre PRECISA da visão global para rodar o mundo e não se contradizer; esconder quebraria a continuidade. Os campos mantêm a visão global e deixam o Mestre se auto-policiar — mesmo contrato "read-only, não vaze" de todos os outros campos.
- **Backstops determinísticos dos gates** (regenerar a narração se ela vazar um fato restrito na fala de um NPC, ou um fato oculto ao jogador). Análogo à US-69 para a cena; só se os gates por prompt se provarem insuficientes (ver Questões em aberto #2).
- **Reconciliar entidades pós-turno** (uma US-73 para o ledger, extraindo entidades novas da narração automaticamente). Esta US semeia na GÊNESE e adiciona as dimensões; a semeadura contínua turno-a-turno é trabalho à parte.

---

## Modelo de dados proposto

**Sem migração de banco.** `Adventure.entities` já é coluna `Json`; os campos novos entram no tipo, não no schema Prisma.

`packages/shared/src/types/character.ts` — `WorldEntity`:

```ts
export interface WorldEntity {
  nome: string
  tipo?: 'npc' | 'local' | 'objeto' | 'faccao' | 'outro'
  local?: string
  estado?: string
  nota?: string
  /**
   * Eixo A — proveniência no mundo (US-75): quem, no mundo, pode saber disto.
   * `publico` = conhecimento comum (qualquer NPC local pode referenciar).
   * `privado` = só o jogador e quem testemunhou; um NPC só menciona se o
   * jogador lhe contou em cena. Ausente ⇒ `publico` (retrocompat).
   */
  sabido?: 'publico' | 'privado'
  /**
   * Eixo B — descoberta do jogador (US-75): o personagem-jogador já sabe disto?
   * `true` (default) = já descobriu; o Mestre narra livremente.
   * `false` = verdade do mundo que o Mestre mantém só para não se contradizer,
   * mas NÃO revela ao jogador até a ficção merecer (então re-registra `true`).
   * Ausente ⇒ `true` (retrocompat).
   */
  revelado?: boolean
  atualizadoEm: string
}
```

`EntityPatch` (em `entities.ts`) segue `Omit<WorldEntity, 'atualizadoEm'>`, herdando os dois campos; `mergeEntities` ganha duas linhas no merge parcial (`sabido: patch.sabido ?? existing.sabido`, `revelado: patch.revelado ?? existing.revelado`).

---

## Critérios de aceite

- [ ] `WorldEntity.sabido` (`'publico' | 'privado'`) e `WorldEntity.revelado` (`boolean`) existem, opcionais e ortogonais; `mergeEntities` preserva cada um quando o patch o omite e o sobrescreve quando o traz (teste unitário em `entities.test.ts`).
- [ ] Entidade sem `sabido` é tratada como `publico`; sem `revelado`, como `true` — no render e nos gates (retrocompatibilidade: ledgers já gravados não mudam de comportamento).
- [ ] **Semeadura (Erro 1):** ao criar uma aventura cuja abertura estabelece um lugar/NPC, `Adventure.entities` nasce com ele, `sabido: 'publico'` e `revelado: true` (verificável no banco / teste com `extractOpeningEntities` mockado). A semeadura **não** cria vínculo (dono/identidade/segredo) que a prosa de abertura não afirmou.
- [ ] **Regressão do Erro 1:** com o ledger contendo `Morvath → local: arboreto` e o jogador perguntando por ele, a narração de um NPC local **não** afirma que Morvath mora em outro lugar (moinho). Cobrível por eval de aderência e/ou teste do prompt (o `local` do ledger e a regra de continuidade aparecem no bloco do turno).
- [ ] **Gate do Erro 2:** dado um fato `sabido: 'privado'` (os capangas) e o jogador NÃO tendo contado ao NPC em cena, a narração desse NPC **não** referencia o fato. Cobrível por eval; o bloco do turno mostra o marcador restrito e a regra do gate.
- [ ] **Gate do Erro 3:** dada uma entidade `revelado: false` (Morvath como dono do arboreto, antes do reveal), a narração e as opções apresentadas ao jogador **não** nomeiam nem insinuam esse vínculo. Cobrível por eval; o bloco do turno mostra o marcador OCULTO e a regra do gate.
- [ ] `recordEntity` aceita `sabido` e `revelado` no schema; o prompt orienta quando usar `privado` e quando usar `revelado: false`, e como promover ambos ao revelar/espalhar.
- [ ] `formatEntities` marca `privado` e `oculto` com rótulos distintos e deixa o caso comum (`publico` + `revelado`) sem ruído.
- [ ] Falha/timeout/quota de `extractOpeningEntities` **não** derruba nem atrasa a criação da aventura — engolida com log; a aventura nasce com ledger vazio (comportamento pré-US-75).
- [ ] A semeadura **não** cria evento `CHARACTER_UPDATE` (mesma razão do `recordEntity`/US-73 — não reativar o bloqueio de edição da US-67).
- [ ] `pnpm eval` e `pnpm typecheck` passam (regra do projeto).

---

## Notas de implementação

> *Dicas para quem implementar. Pode divergir com boa justificativa.*

- **`extractOpeningEntities(openingText, questContext)`** vive em `ai.service.ts`, ao lado de `extractOpeningScene`. Reusa `summaryModel` + `NARRATION_PROVIDER_OPTIONS`. Schema: `{ entidades: WorldEntity[]-sem-atualizadoEm }`. System: *"Extraia as entidades DURÁVEIS que esta abertura estabelece — NPCs nomeados, locais, objetos, facções — e ONDE cada um está, usando APENAS o texto. Não invente e NÃO INFIRA vínculos que o texto não afirma (dono, identidade secreta, parentesco): se a prosa mostra um arboreto sem dizer de quem é, extraia só 'arboreto (local)'. Tudo aqui é conhecimento comum já visto pelo jogador."* Force `sabido: 'publico'` e `revelado: true` em toda saída (a abertura É pública e já vivida). Vazio ⇒ `null`, como a US-35.
- **Onde plugar na criação:** `adventure.service.ts:127`, ao lado de `extractOpeningScene`. Rodar as duas extrações antes da transação, em paralelo (`Promise.all` — nenhuma depende da outra); o array de entidades entra em `tx.adventure.create({ data: { ..., entities: seeded } })`.
- **Default no `recordEntity`:** não force default no código; deixe o Mestre decidir pelas regras do prompt. *Opcional (backstop barato do Eixo A):* se `sabido` vier omitido E a cena corrente tiver `presentes` vazio (jogador sozinho), assumir `privado`. O Eixo B (`revelado`) **não** tem backstop automático — o Mestre é quem sabe se está pinando um segredo para depois. Ambos ficam como afinação (ver Questões em aberto #2).
- **Prompt dos gates** (bloco "Entidades do mundo" em `dm-system.ts` `buildTurnStateBlock`): acrescentar ao cabeçalho as três regras (gate Eixo A, gate Eixo B, continuidade de `local`). É o mesmo lugar onde o ledger já fala "FONTE DE VERDADE, nunca negue". **Preferir** este lugar a `NARRATIVE_CRAFT_SECTION` — fora da barra de ofício, não dispara o guard de drift da rubrica (`rubric-drift.test.ts`); dentro dela, atualizar `DIMENSIONS`/`REVIEWED_CRAFT_HASH`.
- **`ai-engine` roda de `dist`:** editar `entities.ts`/`dm-system.ts` exige `pnpm --filter @ai-dm/ai-engine build` para a API pegar. `apps/api` roda TS direto, então `ai.service.ts`/`adventure.service.ts` não precisam de rebuild de pacote.

---

## Questões em aberto

1. **Reveal por-entidade basta?** O caso do arboreto se resolve pondo o vínculo oculto na entidade Morvath (`revelado: false`), não no arboreto. Se surgir um fato oculto que não se alinhe a nenhuma entidade (ex.: uma relação entre dois locais já revelados), a granularidade por-entidade não o segura — precisaria de um "fato" como unidade própria no ledger. Fora de escopo até haver evidência.
2. **Os gates por prompt seguram sozinhos?** É disciplina do modelo — e a US-73 documentou o prompt sendo ignorado 3× num caso análogo. Se vazar, o backstop é determinístico no `onFinish`: checar se a narração cita `nome`/`nota` de uma entidade `privado` que o NPC não deveria conhecer (Eixo A) ou de uma entidade `oculto` (Eixo B), e regenerar (rede da US-69 aplicada ao ledger). Prematuro até medir.
3. **Precisão da semeadura.** A extração pode perder um NPC secundário ou inferir um vínculo indevido apesar da instrução. Não é regressão (hoje o ledger nasce 100% vazio) e o Mestre ainda registra ao vivo via `recordEntity`. Aceitável para v1; medir cobertura E vazamento de vínculo no eval.

---

## Referências no código

- `packages/shared/src/types/character.ts:44` — `WorldEntity` (campos `sabido` e `revelado` novos).
- `packages/ai-engine/src/entities.ts` — `mergeEntities` (`:32` merge parcial, +2 linhas) e `formatEntities` (`:65` render, marcadores de `privado` e `oculto`); `entities.test.ts` (testes do merge/retrocompat/ortogonalidade).
- `packages/ai-engine/src/prompts/dm-system.ts:430` — cabeçalho da seção "Entidades do mundo" em `buildTurnStateBlock` (gate Eixo A + gate Eixo B + continuidade de `local`).
- `apps/api/src/ai/ai.service.ts:802` — `extractOpeningScene` (o padrão a espelhar em `extractOpeningEntities`); `:497` tool `recordEntity` (novos params + orientação); `:56` `OPENING_SCENE_SCHEMA` (análogo do schema de entidades).
- `apps/api/src/adventure/adventure.service.ts:104-131` — criação da aventura: onde `generateOpeningNarration` + `extractOpeningScene` rodam; a semeadura entra aqui e alimenta `tx.adventure.create`.
- [US-35](./US-35-cena-estruturada-na-abertura.md) — extração estruturada da abertura (reusada). [US-73](./US-73-reconciliador-de-cena-em-background.md) — mesma família de extração pós-LLM em background.
- `C:\Users\Catarina\Downloads\narração equivocada ou que sabe demais.md` — as mensagens de produção (Erro 1: Morvath no moinho; Erro 2: os capangas de Marta; Erro 3: o arboreto era de Morvath, descoberto tarde).
