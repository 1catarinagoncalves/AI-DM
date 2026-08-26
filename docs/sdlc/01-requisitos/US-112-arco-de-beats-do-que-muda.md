# US-112 — O arco da aventura em beats: o Mestre sabe o que MUDA a seguir

**Épico:** 3 — Narração e mecânica
**Fase:** 1 — MVP single-player
**Status:** 🗂️ Backlog
**Depende de:** [US-35](./US-35-cena-estruturada-na-abertura.md) (extração estruturada da abertura — o padrão reusado para semear o arco) · [US-75](./US-75-dimensao-de-proveniencia-no-ledger.md) (o ledger de entidades que o arco referencia)
**Relacionada a:** [US-71](./US-71-simplificar-localizacao-do-personagem.md) e [US-73](./US-73-reconciliador-de-cena-em-background.md) (as duas tentativas anteriores no mesmo sintoma, por outro eixo) · [backlog-aventuras-autorais-lazygm.md](./backlog-aventuras-autorais-lazygm.md) (aventura AUTORAL com conteúdo pronto; esta US é o arco GERADO da aventura improvisada — ver *Fora do escopo*) · [US-144](./US-144-schema-aventura-shared.md) (schema da aventura gerada pelo motor — candidato a segunda fonte de beat, ver *Questões em aberto* #5; **não funde com este schema**)
**Criada em:** 2026-08-12

---

## História

> **Como** jogador,
> **quero** que a história tenha uma direção comprometida que o Mestre conheça e persiga,
> **para que** quando eu digo "vou para o moinho" a cena avance para o moinho em vez de o Mestre redescrever a praça onde eu já estava.

---

## Contexto e motivação

### O problema observado

Bug aberto, com dado de produção: **o Mestre ignora um deslocamento pedido e redescreve o local atual.** A medição da [US-71](./US-71-simplificar-localizacao-do-personagem.md) contou **9 de 24 viagens sem `updateScene`** — o jogador pediu para ir a outro lugar, a narração não moveu a cena, e o `sceneState` congelou.

Duas correções já foram aplicadas neste sintoma, **por outro eixo**:

- **US-71** — sinal de continuidade no prompt, hoje em [`dm-system.ts:402`](../../../packages/ai-engine/src/prompts/dm-system.ts): *"never replay a journey, an arrival, or a greeting that already happened"*. É uma **proibição**.
- **US-73** — [`reconcileScene`](../../../apps/api/src/ai/ai.service.ts) (`ai.service.ts:1047`), rede de segurança que reconstrói o `sceneState` a partir da narração quando o modelo não chamou `updateScene` (`ai.service.ts:804`). É uma **limpeza depois do fato**.

O fix de 28/07/2026 foi aplicado mas **nunca reproduzido em A/B** — não há evidência de que o sintoma tenha morrido, só de que dois anteparos foram postos.

### Por que a solução atual não basta

As duas correções tratam o mesmo eixo: **onde a personagem está**. Nenhuma responde **para onde a história vai**.

O que o Mestre recebe hoje no bloco do turno é inteiramente retrospectivo e estático:

| Bloco | O que diz | Pressão que exerce |
|---|---|---|
| `Cena atual` ([`dm-system.ts:481`](../../../packages/ai-engine/src/prompts/dm-system.ts)) | onde você está, quem está presente | nenhuma — descreve o parado |
| `Entidades do mundo` (`dm-system.ts:517`) | o que existe e é verdade | nenhuma — canon é restrição, não motor |
| Resumo da memória | o que já aconteceu | nenhuma — passado |
| `Quest` ([`schema.prisma:103`](../../../apps/api/prisma/schema.prisma)) | `title` + `description` + `status` | frouxa — uma frase de objetivo, sem etapas nem "o que muda" |

**Hipótese** (não fato medido — ver *Questões em aberto* #1): sem nada que diga o que deve **mudar** a seguir, a continuação mais barata que o modelo pode gerar é reafirmar o presente. Redescrever a praça é sempre coerente com todos os blocos acima; mover-se ao moinho não é *exigido* por nenhum deles. A proibição da US-71 diz ao modelo o que **não** fazer e deixa o vácuo do que fazer no lugar.

### A proposta

Dar à aventura um **arco comprometido em beats**, semeado na criação e reexibido no turno. Um beat declara **o que MUDA no mundo quando ele acontece** — nunca a cena em que acontece, nunca a ação do jogador. Três atos, dois beats por ato.

A distinção é o valor todo, e é ela que preserva a improvisação: *"o Mestre chega ao moinho e encontra a forja fria"* é roteiro (prescreve a rota, morre se o jogador for para o norte); *"o jogador descobre que o comprador chegou primeiro"* é beat (sobrevive a qualquer rota, e **exige** que o mundo avance). O modelo ganha um alvo que a redescrição do local não satisfaz.

Ideia lida em [neuralinitiative/claude-dnd-skill](https://github.com/neuralinitiative/claude-dnd-skill) (arco de três atos em seis beats, *"beats define what changes, not what happens"*). **AGPL-3.0: nada dali pode ser copiado para este repo.** O que atravessa é o desenho, reimplementado do zero neste modelo de dados e neste prompt.

---

## Escopo

### Dentro do escopo

- **Tipo `StoryBeat` e coluna `Adventure.arc Json?`.** Mesmo padrão de `Adventure.entities` (`schema.prisma:77`): coluna `Json` nullable, tipo em `@ai-dm/shared`, sem tabela nova. Aventura sem arco (`null`) se comporta exatamente como hoje.
- **Semeadura do arco na criação da aventura.** `extractOpeningArc(openingText, questContext)` em `ai.service.ts`, irmão de `extractOpeningScene` e `extractOpeningEntities`: `generateObject` produzindo 6 beats a partir da abertura + do gancho. Roda em `adventure.service.ts`, **antes da transação**, no mesmo `Promise.all` das outras duas extrações. Falha/vazio ⇒ `arc: null`; **nunca derruba a criação** (mesmo contrato da US-75).
- **Instrução dura ao gerador:** cada beat descreve **uma mudança de estado do mundo**, não um evento de cena. Proibido citar local de acontecimento, rota, ou ação do jogador. Verbo no que muda ("o comprador revela-se", "a vila fecha os portões"), não no que o jogador faz.
- **Bloco `Arco da história` no turn-state.** Emitido por `buildTurnStateBlock` ao lado do ledger de entidades, com o beat **ativo** em destaque e os cumpridos/pendentes em uma linha cada. Cabeçalho com a regra: *o beat ativo é o que a história DEVE avançar; se o turno não mexeu nele, a cena tem de mudar de outra forma — nunca reafirme o presente.*
- **Tool `advanceBeat({ id, estado })`.** Dois parâmetros. O Mestre marca `cumprido` quando a ficção o realiza, e o beat seguinte do ato vira `ativo`. Persiste só a coluna `arc`; **NÃO loga `CHARACTER_UPDATE`** (mesma razão do `recordEntity`, `ai.service.ts:608` — o evento marcaria o turno como mutação e o guard da [US-67](./US-67-editar-acao-enviada-ao-dm.md) desativaria a edição).
- **Retrocompat:** aventura com `arc: null` não emite o bloco, o prompt não cita o bloco ausente (a regra da [US-87](./US-87-bloco-de-entidades-ausente-citado-no-prompt.md)) e a tool `advanceBeat` devolve no-op.

### Fora do escopo

- **Aventura autoral com beats escritos à mão.** É o [backlog de aventuras autorais](./backlog-aventuras-autorais-lazygm.md), que desde 07/08/2026 escreve *O Lamento*, na campanha de Pegāna, pelo método do Lazy GM (antes trazia *The Night Blade* pronto sob CC-BY). Esta US gera o arco da aventura **improvisada**; se aquele backlog entrar, o artefato autoral **alimenta** a mesma coluna `arc` em vez de ser gerado — a leitura do prompt não muda. As duas não colidem, mas a ordem importa: quem implementar primeiro fixa o formato. A troca de cenário **aumenta** a chance de esta US chegar primeiro: com o conteúdo pronto o backlog só precisava de código, e agora precisa de ~15 mil palavras escritas antes.
- **Beat como gate determinístico** (bloquear/regenerar a narração que não avançou o beat ativo). Análogo à [US-69](./US-69-guard-anti-degeneracao-narracao.md), e prematuro: primeiro medir se o bloco por prompt basta. Ver *Questões em aberto* #3.
- **Ramificação** (beats alternativos por escolha do jogador, arcos em árvore). Seis beats lineares com **o que muda** já absorvem rota livre; ramificar é modelo de dado inteiramente outro.
- **Progressão de nível amarrada a beat.** É a dependência **D1** do backlog do Lazy GM (`Character.level` não é incrementado por nada no repo). Backlog próprio.
- **Re-semear o arco no meio da aventura** quando o jogador o abandona por completo. Limitação conhecida da v1: os 6 beats nascem na criação e não são regerados.

---

## Modelo de dados proposto

`packages/shared/src/types/character.ts`:

```ts
export interface StoryBeat {
  /** "b1".."b6" — estável, é a chave que `advanceBeat` recebe. */
  id: string
  /** Ato ao qual o beat pertence. Dois beats por ato. */
  ato: 1 | 2 | 3
  /**
   * O QUE MUDA no mundo quando este beat acontece. NUNCA onde acontece, nunca
   * a ação do jogador — é isso que faz o arco sobreviver a qualquer rota que o
   * jogador escolha, e é a diferença entre um beat e um roteiro.
   */
  muda: string
  /** Condição de ficção que torna o beat elegível. Opcional: sem ela, o beat fica elegível assim que o anterior cumpre. */
  gatilho?: string
  estado: 'pendente' | 'ativo' | 'cumprido'
  cumpridoEm?: string
}
```

```json
{
  "arc": [
    { "id": "b1", "ato": 1, "muda": "o jogador descobre que o herborista sumiu há três dias", "estado": "cumprido", "cumpridoEm": "2026-08-07T12:00:00.000Z" },
    { "id": "b2", "ato": 1, "muda": "o comprador do arboreto revela-se um interessado, não um curioso", "gatilho": "o jogador pergunta a qualquer NPC sobre o arboreto", "estado": "ativo" }
  ]
}
```

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | `string` | Chave do beat; o que `advanceBeat` recebe. |
| `ato` | `1 \| 2 \| 3` | Ato. Dois beats por ato. |
| `muda` | `string` | A mudança de estado do mundo. Contrato central da US. |
| `gatilho` | `string?` | Condição de elegibilidade. Ausente ⇒ elegível quando o anterior cumpre. |
| `estado` | enum | `pendente` / `ativo` / `cumprido`. Exatamente um `ativo` por vez. |
| `cumpridoEm` | `string?` | ISO. Só para diagnóstico. |

**Persistência:** coluna nova `arc Json?` no model `Adventure` ([`schema.prisma:63`](../../../apps/api/prisma/schema.prisma)), ao lado de `entities`. **Exige migração Prisma** (diferente da US-75, que só mudou o tipo de uma coluna `Json` existente). Na Neon, `migrate deploy` — `pnpm db:migrate` (`migrate dev`) falha com P1017/shadow DB (AGENTS.md → *Armadilhas*).

---

## Critérios de aceite

- [ ] `StoryBeat` existe em `@ai-dm/shared`; `Adventure.arc` é coluna `Json?` com migração aplicada.
- [ ] Ao criar uma aventura, `Adventure.arc` nasce com 6 beats, 2 por ato, com `b1` em `ativo` e o resto `pendente` (teste com `extractOpeningArc` mockado).
- [ ] Nenhum beat gerado cita local de acontecimento nem ação do jogador — verificável por eval do gerador contra uma abertura fixture, e é o critério que separa beat de roteiro.
- [ ] `buildTurnStateBlock` emite o bloco `Arco da história` com o beat ativo em destaque; o nome do bloco vem de constante compartilhada, como `SCENE_BLOCK`/`ENTITIES_BLOCK` ([US-84](./US-84-nomes-de-bloco-do-turn-state-compartilhados.md), `dm-system.ts:22`).
- [ ] Aventura com `arc: null` não emite o bloco **e** o prompt não o cita (regra da US-87); o jogo roda idêntico ao de hoje.
- [ ] `advanceBeat` marca o beat `cumprido`, promove o seguinte a `ativo`, persiste em `Adventure.arc` e **não** cria `EventLog` do tipo `CHARACTER_UPDATE` (teste de regressão do guard da US-67).
- [ ] `advanceBeat` com `id` inexistente ou aventura sem arco devolve no-op sem lançar.
- [ ] Falha/timeout de `extractOpeningArc` não derruba nem atrasa a criação da aventura; a aventura nasce com `arc: null`.
- [ ] **Eval / teste de regressão (o alvo da US):** cenário de viagem — cena registrada em A, jogador pede explicitamente para ir a B, com beat ativo pendente. A narração **chega em B** (ou `updateScene`/`reconcileScene` grava B) e **não** redescreve A. É o mesmo cenário que a US-71 mediu em 9/24; medir **antes e depois**, com e sem o bloco de arco, no mesmo par de fixtures. Sem esse A/B a US repete o erro do fix de 28/07/2026 — aplicado e nunca reproduzido.
- [ ] `pnpm eval` e `pnpm typecheck` passam.

---

## Notas de implementação

> *Dicas. O implementador pode divergir com boa justificativa.*

- **Reimplementar, nunca copiar.** A ideia vem de um repo **AGPL-3.0**. Ler para entender o desenho é livre; colar arquivo, trecho de prompt ou schema contamina o repo inteiro. O `StoryBeat` acima já é escrita própria em PT-BR sobre o modelo de dados desta casa — parta dele.
- **`extractOpeningArc`** espelha `extractOpeningEntities` (`ai.service.ts:1020`): `generateObject` + `EXTRACTION_PROVIDER_OPTIONS` (`model.ts:282` — `reasoning: { enabled: false }`; trocar isso derruba a chamada com 400 e **em silêncio**, cada `catch` devolve `null`).
- **Onde plugar na criação:** `adventure.service.ts`, no mesmo `Promise.all` de `extractOpeningScene` + `extractOpeningEntities`, antes da transação. A abertura roda **sem tools** de propósito (`adventure.service.ts:145`), então nenhuma tool pode semear o arco — tem de ser extração.
- **Camada do prompt:** o bloco vai na **camada 3** (`buildTurnStateBlock`), junto do ledger. É pequeno (6 linhas) e muda raramente, mas pô-lo na camada 2 estouraria o cache do system prompt a cada beat cumprido — o que a [US-55](./US-55-prompt-caching-do-dm.md)/US-104 mediram. Ver [ADR 007](../../adr/007-camadas-do-prompt-por-volatilidade.md) antes de decidir contra.
- **Onde escrever a regra do bloco:** no cabeçalho do bloco em `dm-system.ts`, **não** em `NARRATIVE_CRAFT_SECTION` — dentro da barra de ofício dispara o guard de drift da rubrica (`rubric-drift.test.ts`), exigindo atualizar `DIMENSIONS`/`REVIEWED_CRAFT_HASH` (US-36).
- **`ai-engine` roda de `dist`:** mexer em `dm-system.ts`/tipos exige `pnpm --filter @ai-dm/ai-engine build` para a API pegar.
- **Migração na Neon:** `migrate deploy`, não `pnpm db:migrate`.

---

## Questões em aberto

1. **A hipótese causal está certa?** "Sem alvo de mudança o modelo redescreve o presente" é raciocínio, não medição. O dado que existe é o sintoma (9/24 viagens sem `updateScene`), não a causa. O A/B do critério de aceite é o que responde — e se responder que não, a US morre com um achado, o que já vale mais que o fix não-reproduzido de 28/07/2026.

   **Encaminhamento:** medir antes de construir o resto da US. `reconcileScene` (`ai.service.ts:1047`) já é o sinal de que `updateScene` falhou — instrumentar sua taxa de disparo em prod (log ou contador simples) por um período curto, **antes** de escrever `extractOpeningArc`. Se a taxa já caiu sozinha desde o fix de 28/07/2026, a hipótese enfraquece e a US pode ser repriorizada sem custo de implementação. Se não caiu, o A/B do critério de aceite segue como planejado, agora com baseline melhor que o "9/24" datado.

2. **Seis beats é o número certo?** Três atos × dois é o que o material de origem usa. Para uma aventura de MVP pode ser demais (arco nunca fecha) ou de menos (arco fecha e sobra sessão). Medir em sessão real antes de fixar.

   **Encaminhamento:** não parametrizar agora — não há segunda contagem testada para justificar um valor configurável. Fixar 6 (3 atos × 2) na v1, com comentário no código apontando o teto e a condição de revisão (`// 6 beats fixo — revisar após medir 1+ sessão real, US-112 #2`). Ajustar para configurável só se uma sessão real medida confirmar o problema (arco fecha cedo ou nunca fecha).

3. **`advanceBeat` precisa de gate determinístico?** Se o Mestre nunca chamar a tool, o beat ativo congela e o bloco vira ruído — exatamente como `updateScene` foi ignorada em 9/24 turnos, que é o precedente ruim. O anteparo análogo ao da US-73 seria reconciliar o arco pós-turno a partir da narração. Não construir antes de medir a taxa de chamada.

   **Encaminhamento:** não construir o reconciler nesta US (mantém o *Fora do escopo*). Em vez disso, logar quando um turno termina com beat `ativo` pendente e `advanceBeat` não foi chamado — mesma métrica que a US-71 já mediu para `updateScene` (9/24), aplicada ao beat. Dá dado real para decidir #3 numa US futura sem escrever reconciliação às cegas.
4. **Colisão com `advanceQuest` (AV-5 do backlog do Lazy GM) — decidido em 12/08/2026: NÃO fundir as tools.** As duas avançam progressão, mas **a autoridade de decidir o avanço é de dono diferente**, e é essa a fronteira que este repo protege em toda tool (`rollDice`: *"o modelo diz **o quê** testar; o modificador vem da ficha, nunca do LLM"*, AGENTS.md → *Tools disponíveis*).
   - **`advanceBeat` é juízo do modelo.** Se a ficção realizou *"o comprador revela-se um interessado"* só o narrador sabe; não há regra de servidor que decida.
   - **`advanceQuest` é decisão do servidor.** A AV-5 já traz o gatilho determinístico (Lazy Solo 5e: rola ao entrar em câmara, 4–7 avançam, 4º avanço traz o desafio final) e diz textualmente *"roda no servidor, o modelo só narra o que ela decidiu"*.

   Uma tool só precisaria de uma `description` que ensinasse o modelo quando ele decide e quando não decide — e essa `description` vai ao modelo **todo turno** (o cuidado que a própria AV-5 registra). Fundir troca uma tool a mais por uma ambiguidade de autoridade no caminho quente.

   **O que se funde é o DADO, não a tool:** as 6 fases do *Night Blade* têm a forma de 6 beats. Se a aventura autoral entrar, o artefato preenche a mesma coluna `Adventure.arc` e o mesmo bloco de prompt que o gerador desta US preenche — dois escritores, um leitor, sem segundo bloco disputando espaço no turno.

   **Continua aberto, e é de quem escrever a AV-5:** se o avanço de fase é determinístico e disparado por *entrar em câmara*, `updateScene` já reporta a mudança de `local` — a máquina de estados pode pendurar-se ali e a AV-5 pode não precisar de tool nenhuma. Decidir lá, não aqui.

5. **A aventura gerada pelo motor (US-144) é fonte melhor de beat que a prosa da abertura?** Esta US foi escrita em 12/08/2026, antes do schema do motor ([US-144](./US-144-schema-aventura-shared.md), 15/08/2026) existir. `extractOpeningArc` lê texto livre; o artefato do motor já tem `secrets[]`, `encounters[]` e `npcs[]` com `id` real e vínculo verificável entre si (`locationId`, `npcIds[]`) — em tese, matéria-prima melhor pra derivar `muda` com `locationId`/`npcId` reais em vez da string solta que o modelo proposto acima produz.

   **Encaminhamento:** não decidir agora. Quando esta US for implementada, se `Adventure.generatedAdventure` existir pra aquela aventura (aventura nascida do motor, US-153+), considerar derivar os beats do artefato em vez de rodar `extractOpeningArc` sobre a prosa. **Sem tocar `GeneratedAdventureSchema`:** ele continua congelado — [ADR 012](../../adr/012-aventura-gerada-como-dado.md) D2 já rejeitou misturar dado mutável (o beat muda de `estado` a cada `advanceBeat`) em coluna imutável, foi a mesma pergunta feita e respondida pro ledger. `extractOpeningArc` continua sendo o caminho pra aventura sem artefato — gancho de classe hoje, aventura autoral na fase 4.

---

## Referências no código

- [`apps/api/prisma/schema.prisma:63`](../../../apps/api/prisma/schema.prisma) — model `Adventure`; `entities Json?` em `:77` é o precedente da coluna nova. `Quest` em `:103` — por que ela não serve (sem ordem, sem "o que muda").
- [`apps/api/src/ai/ai.service.ts`](../../../apps/api/src/ai/ai.service.ts) — `:565` tool `recordEntity` (molde de tool que persiste em `Adventure` sem logar `CHARACTER_UPDATE`, ver o comentário em `:608`); `:1020` `extractOpeningEntities` (molde da extração); `:1047` `reconcileScene` (a rede da US-73); `:804` a checagem `cenaTocada`.
- [`apps/api/src/adventure/adventure.service.ts:145`](../../../apps/api/src/adventure/adventure.service.ts) — a abertura roda sem tools; por isso o arco tem de ser extraído, não registrado.
- [`packages/ai-engine/src/prompts/dm-system.ts`](../../../packages/ai-engine/src/prompts/dm-system.ts) — `:22`/`:23` `SCENE_BLOCK`/`ENTITIES_BLOCK` (o padrão do nome de bloco compartilhado); `:402` a regra de continuidade da US-71 (*"never replay a journey"*); `:517` o cabeçalho do ledger, molde do cabeçalho do arco.
- [`packages/ai-engine/src/model.ts:282`](../../../packages/ai-engine/src/model.ts) — `EXTRACTION_PROVIDER_OPTIONS`, obrigatório na extração nova.
- [`docs/adr/007-camadas-do-prompt-por-volatilidade.md`](../../adr/007-camadas-do-prompt-por-volatilidade.md) — decide em que camada o bloco de arco vive.
- [backlog-aventuras-autorais-lazygm.md](./backlog-aventuras-autorais-lazygm.md) — AV-5 (`advanceQuest`) e a fronteira entre arco gerado e aventura autoral.
