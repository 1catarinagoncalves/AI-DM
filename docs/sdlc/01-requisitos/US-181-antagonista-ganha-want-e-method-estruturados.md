# US-181 — Antagonista ganha `want`/`method` estruturados no artefato gerado

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** [US-164](./US-164-orquestrador-motor-monta-aventura-gerada.md) (`generateAdventure`, orquestrador que monta o objeto final — esta story acrescenta um campo a ele) · [US-175](./US-175-generateclosing-perde-hookseed-antagonista-so-premissa.md) (estado atual de `generateClosing`: antagonista já é só prosa dentro de `conclusion`, ancorado em `premissa` — esta story parte exatamente desse ponto) · [US-144](./US-144-schema-aventura-shared.md) (`GeneratedAdventureSchema`, ganha o campo `antagonist`)
**Relacionado:** [US-169](./US-169-quest-gerada-ganha-objetivo-e-conclusao-acionavel.md) (`objective`, ainda não implementada — quando implementada, deve referenciar `antagonist.want`/`antagonist.method`/`antagonist.weakness`, não só o nome; ver nota cruzada no próprio documento) · [US-164, Questão em aberto #2](./US-164-orquestrador-motor-monta-aventura-gerada.md) (decisão original — *"antagonista vira só cor narrativa... se produto quiser antagonista rastreável de verdade, abre US própria depois"* — esta story É essa US, mas só no eixo ESTRUTURA/CAMPO, não no eixo ENTIDADE, ver *Fora do escopo*) · [US-153, Questão em aberto #4](./US-153-aventura-deixa-de-ser-derivada-da-classe.md) (disciplina "`conclusion` não vaza antes de merecer" — mesma cautela se aplica ao campo novo) · [US-166](./US-166-motor-gera-multiplos-encontros.md) (**bloqueada por esta story**, atualizado 2026-08-21: o encontro final dos 8 gerados é o confronto com o antagonista — `behaviors`/`goal`/`complications` dele DEVEM ecoar `antagonist.want`/`method`/`trait`/`weakness`. US-166 estende o MESMO `generateClosing`/`CLOSING_SCHEMA` que esta story cria — soma `encounterSkeleton` de entrada e `encounterSituations` de saída, não chamada nova; sem esta story implementada primeiro, `CLOSING_SCHEMA` não tem `antagonist` pra US-166 ecoar) · [US-183](./US-183-antagonista-ganha-conexao-pessoal-com-personagem.md) (desmembrada desta story em 2026-08-21 — soma o eixo de conexão pessoal, que pede `characterAnchors` como insumo novo e por isso não entra aqui) · [US-188](./US-188-antagonista-vira-npc-rastreavel.md) (desmembrada desta story em 2026-08-21 — resolve o eixo ENTIDADE que a *Fora do escopo* original deixou de fora) · [US-189](./US-189-antagonista-entra-no-ledger.md) (desmembrada desta story em 2026-08-21 — resolve a Questão em aberto #2, exposição no ledger)
**Criada em:** 2026-08-20 — a partir de notas de design trazidas pela mantenedora sobre estrutura de aventura (LGMRD-adjacente): "decidir o que o vilão QUER" e "o que ele FAZ pra conseguir" como dois passos distintos de "o vilão existe". O motor hoje só cobre o segundo nível (antagonista existe, como prosa) — nunca declara motivo nem método, então segredos/NPCs gerados antes dele (US-149/US-158) não têm mecanismo nenhum pra ancorar, só a `premissa` solta.
**Atualizada em:** 2026-08-21 — a partir de leitura de material de design de vilões de RPG trazido pela mantenedora (ver *Artigos-fonte* nas Referências): dois eixos aparecem repetidos em praticamente toda a literatura além de motivo/método — um **traço reconhecível** (maneirismo, marca, comportamento que faz o antagonista ser lembrado na narração) e uma **fraqueza explorável** (ponto cego que dá alavanca pra `objective`/US-169 e `complications`/US-166 citarem, não só o nome). Os dois entram no escopo desta story porque nascem da MESMA chamada, sem insumo novo — mesma disciplina de `want`/`method`. Um terceiro eixo igualmente repetido — **conexão pessoal do antagonista com o personagem** — pede insumo novo (`characterAnchors`, hoje só consumido por `generateOpeningBeat`/US-180) e por isso vira story própria (US-183), não é somado aqui.

---

## História

> **Como** jogadora,
> **quero** que a aventura gerada declare o que o antagonista QUER e COMO age pra conseguir — não só que ele exista como parágrafo de fechamento —,
> **para que** a aventura tenha um mecanismo por trás da ameaça, reconhecível na narração, em vez de um vilão que só ganha forma na última cena.

---

## Contexto e motivação

### O que existe hoje

`generateClosing` ([ai.service.ts:1492-1520](../../../apps/api/src/ai/ai.service.ts)) escreve `conclusion` a partir de `premissa`/`complicacao`/`locations`/`npcs`/`secrets` já decididos. O `system` instrui: *"Se a premissa sugerir um antagonista, ele aparece só como PROSA no fecho, não precisa ser um NPC já listado"* ([ai.service.ts:1510](../../../apps/api/src/ai/ai.service.ts)) — decisão deliberada da [US-164, Questão em aberto #2](./US-164-orquestrador-motor-monta-aventura-gerada.md): `background.deity` foi descartado como fonte (é a divindade que o PERSONAGEM venera, não um vilão — confundiria fé do herói com oposição da trama) e `premissa` (a linha crua da tabela `1d20quests`, ex. `"Kill a villain"`) não tem entidade nenhuma atrás. A opção adotada foi a mais barata: antagonista vira só cor narrativa dentro do `conclusion`, sem campo próprio no schema (US-144).

### O problema

`GeneratedAdventureSchema` ([adventure-generation.ts](../../../packages/shared/src/types/adventure-generation.ts)) não tem NENHUM campo de antagonista — nem nome, nem motivo, nem método. Tudo que existe está dissolvido dentro do texto de `conclusion`, que por sua vez é informação que o Mestre só deve revelar quando a ficção merecer (mesma disciplina que [US-153, Questão em aberto #4](./US-153-aventura-deixa-de-ser-derivada-da-classe.md) já protege). Consequência: nenhum outro consumidor do artefato — nem a [US-169](./US-169-quest-gerada-ganha-objetivo-e-conclusao-acionavel.md) (`objective`, ainda não implementada), nem uma eventual entrada de ledger — tem como referenciar "o que o vilão quer" ou "como ele age", porque esse dado não existe como campo, só como prosa enterrada no fecho.

### Por que a solução atual não basta

A própria proposta original desta trilha de stories (LGMRD *Eight Steps*/DnDGenerate, ver [backlog do motor](./backlog-motor-de-geracao-de-aventuras.md)) trata "decidir o que o vilão quer" e "decidir como ele age pra conseguir" como dois passos de design distintos — não um parágrafo de fechamento improvisado. Sem os dois como campo, a aventura pode ter um antagonista coerente no `conclusion` e ainda assim nenhum outro texto gerado (segredo, NPC, `objective` futuro) referenciar o MESMO motivo/método — porque não há nada estruturado pra referenciar.

### A proposta

`generateClosing` ganha um objeto novo no retorno — `antagonist: { name, want, method, trait, weakness }` — sintetizado na MESMA chamada que já produz `conclusion`/`followUps` (nenhum round-trip novo, mesmo argumento de custo já usado pela [US-169](./US-169-quest-gerada-ganha-objetivo-e-conclusao-acionavel.md) pra `objective`). `want` é o que o antagonista busca (poder, vingança, recurso, ritual); `method` é o que ele está fazendo pra chegar lá (reunir um exército, um ritual em curso, espalhar um boato); `trait` é um maneirismo/marca reconhecível (fala de um jeito específico, um tique, um símbolo que carrega) que a narração pode ecoar sem precisar reexplicar quem é o antagonista; `weakness` é o ponto cego ou vício que dá alavanca — pra um `objective` (US-169) ou `complication` de encontro (US-166) citarem algo mais específico que só o nome. Todos os quatro continuam ancorados só em `premissa`/`complicacao`/`locations`/`npcs`/`secrets` já decididos — **nenhum insumo novo**, mesma disciplina de "antagonista não reabre `LOCATIONS_AND_NPCS_SCHEMA`" que a US-164 #2 já fixou.

---

## Escopo

### Dentro do escopo

- `CLOSING_SCHEMA` ([ai.service.ts:240](../../../apps/api/src/ai/ai.service.ts)) ganha `antagonist: z.object({ name: z.string().min(1), want: z.string().min(1), method: z.string().min(1), trait: z.string().min(1), weakness: z.string().min(1) })`.
- `generateClosing` ([ai.service.ts:1492](../../../apps/api/src/ai/ai.service.ts)) devolve `antagonist` junto de `conclusion`/`followUps` — mesma chamada de modelo, sem parâmetro novo de entrada.
- `system` de `generateClosing` ganha instrução: nomear o antagonista e declarar `want` (o que busca), `method` (o que faz pra conseguir), `trait` (maneirismo/marca reconhecível) e `weakness` (ponto cego/vício explorável) — todos ancorados só no que já foi decidido (`premissa`/`complicacao`/`locations`/`npcs`/`secrets`) — nunca inventando local/NPC/fato fora da lista recebida, mesma disciplina de `generateSecrets`.
- `GeneratedAdventureSchema` (US-144, `adventure-generation.ts`) ganha `antagonist: AdventureAntagonistSchema`, mesma forma (`name`/`want`/`method`/`trait`/`weakness`).
- `adventure.service.ts` (`generateAdventure`, dentro do `Promise.all` que já chama `generateClosing`) passa `antagonist` ao objeto final do `.parse()`.
- Nota cruzada no documento da [US-169](./US-169-quest-gerada-ganha-objetivo-e-conclusao-acionavel.md): quando aquela story for implementada, `objective` deve poder citar `antagonist.want`/`antagonist.method`, não só o nome — ex. *"Impedir que Malvora drene a vila pra alimentar seu ritual"*, não só *"Impedir Malvora"*.
- Teste de regressão: fixture com `AiService.generateClosing` mockado → artefato final (`GeneratedAdventureSchema.parse`) tem `antagonist.name`/`want`/`method`, todos não vazios.

### Fora do escopo

- **Conexão pessoal do antagonista com o personagem** (ex. citar `background.story`/`origin.adventuresAndAdvancement` no `want`/`method`). Pede `characterAnchors` como insumo novo em `generateClosing` — hoje só `generateOpeningBeat` recebe isso (US-180). Reabrir a assinatura de `generateClosing` pra insumo novo é decisão maior que esta story protege ("nenhum insumo novo") — vira [US-183](./US-183-antagonista-ganha-conexao-pessoal-com-personagem.md), que reusa `characterAnchors` no mesmo padrão que US-180 já validou.
- **Antagonista como entidade rastreável** (NPC com `id`, referenciado em `encounters[]`/`npcIds`). A decisão da US-164 #2 continua valendo: reabrir `LOCATIONS_AND_NPCS_SCHEMA` (US-158) pra isso é escopo de outra story, se algum dia for pedido. Esta story só estrutura o CAMPO textual, não promove o antagonista a entidade do grafo. **Virou [US-188](./US-188-antagonista-vira-npc-rastreavel.md) (2026-08-21).**
- **`background.deity` como fonte.** Decisão da US-164 #2 permanece — `deity` é fé do personagem, não vilão. Não revisitada aqui.
- **Exposição ao Mestre durante o turno** (ledger, `buildTurnStateBlock`). `antagonist.want`/`method` nascem no artefato mas não são injetados em nenhum bloco de prompt de turno nesta story — mesma disciplina que já protege `conclusion` de vazar antes da hora (US-153 #4). Se o produto quiser dosar isso como pista (ex. `revelado: false` no ledger), é story própria.
- **Implementar `objective` (US-169).** Esta story só deixa `antagonist` disponível como insumo melhor; a implementação de `objective` em si continua sendo escopo exclusivo daquela story.
- **Mudar `generateSecrets`/`generateLocationsAndNpcs`/`generateOpeningBeat`.** Nenhuma dessas chamadas recebe `antagonist` como insumo novo — ele nasce por ÚLTIMO, na mesma posição de pipeline que `conclusion` já ocupa hoje, sem alterar a ordem que o backlog do motor protege.

---

## Modelo de dados proposto

```ts
// packages/shared/src/types/adventure-generation.ts
export const AdventureAntagonistSchema = z.object({
  name: z.string().min(1),
  want: z.string().min(1), // o que busca — poder, vingança, recurso, ritual...
  method: z.string().min(1), // o que faz pra conseguir — reunir exército, ritual em curso...
  trait: z.string().min(1), // maneirismo/marca reconhecível — fala de um jeito, um tique, um símbolo
  weakness: z.string().min(1), // ponto cego/vício explorável — vaidade, lealdade cega, obsessão...
})

export const GeneratedAdventureSchema = z.object({
  // ...campos existentes
  antagonist: AdventureAntagonistSchema,
})
```

```ts
// apps/api/src/ai/ai.service.ts — CLOSING_SCHEMA
const CLOSING_SCHEMA = z.object({
  conclusion: z.string().min(1),
  followUps: z.array(z.string()).min(1),
  antagonist: z.object({
    name: z.string().min(1),
    want: z.string().min(1),
    method: z.string().min(1),
    trait: z.string().min(1),
    weakness: z.string().min(1),
  }),
})
```

---

## Critérios de aceite

- [ ] `CLOSING_SCHEMA` exige `antagonist.name`/`want`/`method`/`trait`/`weakness`, todos strings não vazias.
- [ ] `generateClosing` devolve `antagonist` junto de `conclusion`/`followUps`, na mesma chamada (sem round-trip novo).
- [ ] `GeneratedAdventureSchema.parse` exige `antagonist` — falha o gate (US-150) se ausente, mesmo tratamento de reseed que qualquer outro campo obrigatório.
- [ ] `generateAdventure` (`adventure.service.ts`) preenche `antagonist` no objeto final.
- [ ] `system` de `generateClosing` instrui `want`/`method`/`trait`/`weakness` ancorados só em `premissa`/`complicacao`/`locations`/`npcs`/`secrets` recebidos — nunca insumo novo.
- [ ] **Teste de regressão:** fixture com `generateClosing` mockado → artefato final tem `antagonist` com os cinco campos não vazios; `.parse()` passa.
- [ ] `pnpm typecheck` e `pnpm test` passam.
- [ ] `pnpm eval` passa (mudança de prompt do motor de geração).

---

## Notas de implementação

- Pontos exatos: [ai.service.ts:240](../../../apps/api/src/ai/ai.service.ts) (`CLOSING_SCHEMA`), [ai.service.ts:1492-1520](../../../apps/api/src/ai/ai.service.ts) (`generateClosing`), [adventure.service.ts:168-177](../../../apps/api/src/adventure/adventure.service.ts) (chamada dentro do `Promise.all`), [adventure.service.ts:191-203](../../../apps/api/src/adventure/adventure.service.ts) (montagem final do `.parse()`).
- **Nenhuma chamada anterior no pipeline ganha `antagonist` como insumo.** `generateLocationsAndNpcs`, `generateSecrets` e `generateOpeningBeat` continuam exatamente como estão — o antagonista estruturado nasce na mesma posição (última) que a prosa de `conclusion` já ocupava, só ganha forma.
- `want`/`method`/`trait`/`weakness` sempre presentes, mesmo quando `premissa` não sugere vilão óbvio (ex. `"Rescue an NPC"`) — o modelo infere uma oposição plausível (o motivo do sequestro, por exemplo) em vez do campo ficar opcional. Mesma disciplina de robustez do resto do motor: campo opcional que às vezes falta é pior consumidor a jusante do que campo sempre presente.
- A instrução do `system` deve deixar claro que os quatro campos **não** liberam o modelo a inventar entidade nova fora de `locations`/`npcs`/`secrets` recebidos — mesma regra que já vale para `generateSecrets` (nunca invente local/NPC fora da lista).
- `trait` e `weakness` são frase curta (1 sentença), mesmo formato direto de `want`/`method` — não viram bloco de personalidade longo; se o eval mostrar prosa genérica ("é cruel", "quer poder"), ajuste é de prompt, não do schema.
- `weakness` não é convite a `generateClosing` escrever a DERROTA do antagonista — é só o dado estrutural (ponto cego). Como/quando essa fraqueza é explorada continua sendo decisão de US-166 (`complications`)/US-169 (`objective`)/mesa, não desta story.

---

## Questões em aberto

1. `want`/`method`/`trait`/`weakness` sempre existem mesmo quando `premissa` não aponta vilão claro? Decisão adotada nesta story: sim, sempre gerar (ver *Notas de implementação*) — não medido contra qualidade, só contra presença estrutural. Se o eval mostrar campos genéricos demais nesses casos, ajuste de prompt é retrabalho local, não reabre o schema.
2. ~~O antagonista estruturado deve virar pista dosada no ledger (`revelado: false`, mesmo padrão de segredos/combatentes — US-151/US-171), ou fica só disponível a `conclusion`/`objective` (US-169)?~~ **Decidido (2026-08-21): sim, vira pista dosada no ledger, mesmo padrão `revelado: false`.** Virou [US-189](./US-189-antagonista-entra-no-ledger.md) — depende de US-188 (`antagonist.npcId`) pra evitar duplicata no ledger.
3. `trait`/`weakness` merecem `enum` fechado no futuro (catálogo fixo de traços/fraquezas, estilo taxonomia de Foe Foundry) em vez de string livre, pra permitir variedade anti-repetição medida entre aventuras geradas? Não decidido — string livre é suficiente pro escopo desta story; enum é retrabalho de story própria se o eval acusar repetição.

---

## Referências no código

- [apps/api/src/ai/ai.service.ts:240](../../../apps/api/src/ai/ai.service.ts) — `CLOSING_SCHEMA`, ganha `antagonist`.
- [apps/api/src/ai/ai.service.ts:1492-1520](../../../apps/api/src/ai/ai.service.ts) — `generateClosing`, função que passa a sintetizar `antagonist` junto de `conclusion`/`followUps`.
- [apps/api/src/adventure/adventure.service.ts:168-203](../../../apps/api/src/adventure/adventure.service.ts) — `generateAdventure`, monta o objeto final que esta story estende.
- [packages/shared/src/types/adventure-generation.ts](../../../packages/shared/src/types/adventure-generation.ts) — `GeneratedAdventureSchema`, ganha `antagonist: AdventureAntagonistSchema`.
- [US-164, Questão em aberto #2](./US-164-orquestrador-motor-monta-aventura-gerada.md) — decisão original que rejeitou `background.deity` e a entidade rastreável, e previu explicitamente esta story ("abre US própria depois").
- [US-175](./US-175-generateclosing-perde-hookseed-antagonista-so-premissa.md) — estado atual de `generateClosing` (antagonista só via `premissa`, sem `hookSeed`), ponto de partida desta story.
- [US-169](./US-169-quest-gerada-ganha-objetivo-e-conclusao-acionavel.md) — `objective`, ainda não implementada; consumidora natural de `antagonist.want`/`method` quando for escrita.
- [US-153, Questão em aberto #4](./US-153-aventura-deixa-de-ser-derivada-da-classe.md) — disciplina "`conclusion` não vaza antes de merecer", mesma cautela vale pro campo novo (ver *Fora do escopo*).
- [US-183](./US-183-antagonista-ganha-conexao-pessoal-com-personagem.md) — desmembrada desta story em 2026-08-21: soma conexão pessoal (`characterAnchors`) ao antagonista, insumo novo que esta story deliberadamente não recebe.
- Artigos-fonte (convergência usada pra `trait`/`weakness`): [*The Anatomy of a Villain*](https://www.dndbeyond.com/posts/1895-the-anatomy-of-a-villain-crafting-compelling) (D&D Beyond) — quebra vilão em intenção/objetivo/arquétipo/trope/presença; [*Foe Foundry — Villains*](https://foefoundry.com/families/villains/) (foefoundry.com) — taxonomia com campos `goals`/`personality traits`/`flaws`/`mannerisms`/`relationships` separados; [*100 Creepy Villainous Traits*](https://www.dndspeak.com/2023/10/01/100-creepy-villainous-traits/) (dndspeak.com) — catálogo de maneirismos/marcas reconhecíveis; [*Villains Die*](https://www.rjd20.com/2021/01/villains-die.html) (rjd20.com) — motivação/personalidade/conexão/ferramentas como quatro eixos independentes.
