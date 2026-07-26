# US-77 — Reancorar as assertivas de prompt restantes + guard para a quebra não passar despercebida

**Épico:** 5 — Qualidade e avaliação do DM Agent
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** [US-72](./US-72-evals-de-prompt-resistentes-a-reescrita.md) (definiu a convenção anti-drift e o método de prova; esta US a generaliza).
**Recomendada depois de:** [US-80](./US-80-ci-typecheck-testes-e-evals.md) — era o "P1" desta story e foi separada. Não é dependência técnica: as reancoragens funcionam sem CI. Mas o CI é a rede de segurança das 19 mudanças de assertiva, e entrega valor mesmo se esta US atrasar.
**Relacionada a:** [US-29](./US-29-saneamento-de-rolagens-ficticias.md) (o eval que quebrou primeiro), [US-36](./US-36-eval-de-qualidade-da-narracao.md) (precedente de guard por hash), [US-71](./US-71-simplificar-localizacao-do-personagem.md) (renomeou cabeçalho de seção — prova de que cabeçalho também é volátil).
**Criada em:** 2026-07-26

---

## História

> **Como** mantenedor do DM Agent,
> **quero** que **todas** as assertivas que grepam o system prompt casem a intenção (e não a prosa), e que uma quebra apareça **no commit que a causou**,
> **para que** a reescrita semanal do prompt pare de produzir vermelhos silenciosos, e para que um eval vermelho volte a significar "o contrato quebrou".

---

## Contexto e motivação

### O problema observado

A US-72 corrigiu **2** assertivas em `evals/cases/us-29-rolagens.ts` e registrou o resto como risco conhecido (Questão em aberto #1). A auditoria completa mostra que o risco é maior do que o registrado: **30 assertivas em 6 arquivos** ancoram em prosa do prompt e passam hoje só porque aquela frase específica ainda não foi reescrita.

Duas quebras já aconteceram, sem regressão de comportamento nenhuma:

- `e0a6817 "Atualizações prompt onomastica"` reescreveu `sanitizer will DELETE` → `DELETES` e `quero rolar` → `rolo Percepção`. Quebrou 2 assertivas da US-29. **O mesmo commit** reescreveu a seção de onomástica — em que `dm-system.test.ts:165-169` ancora com 4 regex de prosa (`/invent every proper name from scratch/`, `/generic default name/`, `/OPEN PALETTE/`, `/not just NPCs/`). Sobreviveu por sorte.
- `US-71` renomeou o cabeçalho `SPATIAL & SCENE CONTINUITY`. `dm-system.test.ts:153` ancora em `/SCENE CONTINUITY & OPTIONS/` — ou seja, nem cabeçalho de seção é âncora estável neste repo.

### A segunda causa-raiz: **não existe CI** — virou a [US-80](./US-80-ci-typecheck-testes-e-evals.md)

Não há `.github/workflows/`. Nada roda `pnpm test` nem `pnpm eval` automaticamente, apesar de o repo ter remote no GitHub e deploy contínuo (Render/Vercel a partir de `main`). Foi por isso que as 2 assertivas da US-29 ficaram vermelhas de `e0a6817` até a US-72 — **a fragilidade custou pouco; a invisibilidade custou o tempo todo.** Reancorar sem fechar essa lacuna só reduz a frequência da dor, não o tempo de detecção.

> Esta causa-raiz saiu para a **[US-80](./US-80-ci-typecheck-testes-e-evals.md)**, porque não depende de nada daqui: é um arquivo de workflow, entregável sozinho, e era o item de maior valor de uma story que de resto são 19 edições de teste. Fica registrada aqui porque explica *por que* reancorar sozinho não basta.

### Auditoria — o que é frágil e o que não é

Nem toda assertiva que grepa o prompt é frágil. A linha divisória:

- **Resistente (não tocar):** a assertiva casa um **dado que o próprio teste injetou** no fixture — `Level: 3`, `Atletismo +5*`, `Divindade: Solariel (…)`, `- Chama Sagrada (truque)`, `Nobre menor que perdeu a família`. Se a prosa em volta for reescrita, o dado continua lá; se o dado sumir do prompt, é regressão de verdade. Idem `/rollDice/` (`guardrails.test.ts:43`): nome de tool é token que o código possui.
- **Frágil (escopo desta US):** a assertiva casa uma **frase escrita à mão no prompt** — adjetivo, conjugação, exemplo em pt-BR, ou o texto decorativo dentro do parêntese de um cabeçalho.

| Risco | Arquivo:linha | Âncora atual | Por que quebra | Âncora proposta (intenção) |
|---|---|---|---|---|
| 🔴 ALTO | `us-40:53` | `/faith color invocations\|invocations, omens/` | prosa pura, duas variantes já sinalizam instabilidade | conceito: divindade influencia a narração — `/divindade\|deity/i` + verbo de influência tolerante |
| 🔴 ALTO | `us-41:33,34` | `/offer and narrate/`, `/never resolve/` | texto dentro do parêntese do cabeçalho `## Class features (read-only — …)` | contrato: features são oferecidas, o custo/efeito NÃO é resolvido no prompt — regex tolerante ligando `feature` a `never resolve\|não resolv` |
| 🔴 ALTO | `us-23:56,57` | `/source of truth\|fonte de verdade/`, `/not the player speaking/` | prosa do preâmbulo do turn-state (`dm-system.ts:455`) | contrato: blocos do turn-state têm precedência sobre a prosa — âncora no conceito precedência/autoridade |
| 🔴 ALTO | `dm-system.test.ts:206,207,208` | as 2 acima + `/precedence/` | mesma frase, duplicada em 2 arquivos | idem (e considerar deduplicar: o mesmo contrato testado 2× em lugares diferentes) |
| 🔴 ALTO | `dm-system.test.ts:92,93` | `/flaw\|fraqueza/`, `/when the scene\|quando a cena/` | prosa; o `\|` já é remendo de reescrita anterior | conceito: a seção de identidade instrui o uso do defeito em cena |
| 🔴 ALTO | `dm-system.test.ts:165,166,168,169` | `/invent every proper name from scratch/`, `/generic default name/`, `/OPEN PALETTE/`, `/not just NPCs/` | 4 frases da seção reescrita em `e0a6817` | contrato: nomes próprios são inventados e nomes-padrão são proibidos — âncora nos nomes proibidos já testados (`Elara`, `Kael`, `:163-164`) + 1 regex de conceito |
| 🔴 ALTO | `dm-system.test.ts:233,234` | `/before the recent messages above/` | preposição literal (`above`/`below`) — o teste existe justamente porque isso já inverteu | manter o par positivo/negativo (é o ponto do teste), mas ancorar em `/recent messages (above)/` isolado do resto da frase |
| 🔴 ALTO | `dm-system.test.ts:266,267,268` | `/is ALREADY at/`, `/arrival here were narrated on earlier turns/`, `/Do NOT re-narrate the trip, the arrival, or the greeting/` | 3 frases longas; a US-71 mexeu exatamente nessa área | contrato: personagem já está no local e a chegada não se re-narra — 1 regex de conceito (`re-narrate\|não re-narr`) + o local do fixture (dado, já em `:266`) |
| 🟡 MÉDIO | `us-38:45,46,50` | `/skill.*NAME/i`, `/NEVER pass a modifier/i`, `/ONE action.*ONE check/i` | CAPS-contrato — mais estável, mas ainda frase | manter as 2 em CAPS (são contrato); reancorar `/skill.*NAME/i` que é prosa |
| 🟡 MÉDIO | `us-42:46` | `/call getspell/` | mistura tool (estável) com verbo (volátil) | só `/getSpell/` — o nome da tool é o contrato |
| 🟡 MÉDIO | `dm-system.test.ts:151-154` | `/Gender Agreement/`, `/Narrative craft/`, `/SCENE CONTINUITY & OPTIONS/`, `/TURN RESOLUTION ORDER/` | cabeçalhos — a US-71 provou que são renomeados | decidir: ou aceitar cabeçalho como contrato **e** protegê-lo com o guard (ver P3), ou reancorar no conteúdo da seção |
| 🟡 MÉDIO | `dm-system.test.ts:241,242,243` | `/No main quest set yet/`, `/No secondary quests yet/`, `/- Empty\./` | placeholders literais de saída estrutural | risco baixo (é saída do builder, não prosa autoral) — reancorar só se ficarem no caminho |

**Resistentes, fora do escopo:** `us-03`, `us-08`, `us-27`, `us-29` (já feito na US-72), `us-39`, e todas as assertivas de `us-23/40/41/42` que casam dado de fixture; `guardrails.test.ts:43`.

### Por que a solução atual não basta

A convenção anti-drift da US-72 existe como **comentário dentro de um único bloco** de `us-29-rolagens.ts`. Quem for editar `us-40` ou `dm-system.test.ts` não a vê. E, sem CI, nem o autor da reescrita descobre que quebrou algo — descobre-se semanas depois, por acaso, como aconteceu.

---

## A proposta — três camadas, da mais barata à mais cara

**P1 — CI (prevenção primária). → separado na [US-80](./US-80-ci-typecheck-testes-e-evals.md).** Workflow GitHub Actions rodando `typecheck`, `test` e `eval` em push e PR. Não impede que alguém escreva uma âncora frágil; converte a quebra de "invisível por semanas" em "vermelho no ato", quando reancorar custa um minuto para quem tem o contexto da reescrita na cabeça. Era o item de maior valor — por isso saiu, para não ficar preso atrás de 19 edições de teste.

**P2 — Convenção num lugar só.** Mover a taxonomia de âncoras da US-72 para `evals/PROMPT-ANCHORS.md` (âncora permitida: nome de tool, dado do fixture, conceito com regex tolerante; proibida: conjugação, adjetivo, exemplo em pt-BR, texto decorativo de cabeçalho; e o método de prova dos dois lados — reescrita fica verde, remoção fica vermelha). Cada bloco de assertiva de prompt ganha um comentário de uma linha apontando para lá, em vez de repetir o parágrafo.

**P3 — Guard de reescrita por hash (reusa padrão existente).** Estender o padrão do `REVIEWED_CRAFT_HASH` (`rubric-drift.test.ts`, US-36) para as seções-contrato do prompt: um mapa `seção → hash revisado`. Reescreveu a seção, o teste fica vermelho com a mensagem *"você reescreveu a seção X; revise as assertivas ancoradas nela e atualize o hash"*. Ataca a causa-raiz de verdade — força a revisão **no momento da reescrita** — mas cobra o pedágio de re-hashear a cada edição de prompt, que neste projeto é semanal.

**Recomendação:** **P2 + reancoragem 🔴 nesta US**; P1 na [US-80](./US-80-ci-typecheck-testes-e-evals.md), de preferência antes. P3 fica **proposto e adiado**, com gatilho explícito (ver Questões em aberto #1): se, com o CI ligado, mais de uma reescrita quebrar assertiva num intervalo de ~1 mês, a disciplina por comentário não está pegando e o hash passa a valer o pedágio.

---

## Escopo

### Dentro do escopo

- **P2:** `evals/PROMPT-ANCHORS.md` com a taxonomia + método de prova; comentário de 1 linha em cada bloco de assertiva de prompt tocado, apontando para o doc; o comentário longo de `us-29-rolagens.ts:56-60` encolhe para o ponteiro.
- **Reancorar as 19 assertivas 🔴 ALTO** da tabela, uma a uma, aplicando o método da US-72: **reescrita mantém verde, remoção da regra fica vermelha**. Cada uma prova os dois lados.
- `pnpm eval` e `pnpm test` verdes no fim.

### Fora do escopo

- **Reescrever o prompt.** Nenhuma edição em `dm-system.ts` — como na US-72, o defeito é do teste.
- **As 11 assertivas 🟡 MÉDIO.** Ficam documentadas na tabela e são reancoradas oportunisticamente (quem tocar no arquivo por outro motivo, reancora). Reescrever teste verde de risco médio é churn — mesma lente da US-72.
- **P3 (hash guard).** Adiado com gatilho definido. Ver Questões em aberto #1.
- **O CI (P1) e tudo que o cerca** — workflow, versões de runner, `prisma generate`, gate de merge. É a [US-80](./US-80-ci-typecheck-testes-e-evals.md).

---

## Critérios de aceite

- [ ] Existe `evals/PROMPT-ANCHORS.md` com: âncoras permitidas, âncoras proibidas, e o método de prova dos dois lados.
- [ ] As **19 assertivas 🔴 ALTO** da tabela não casam mais prosa autoral; cada bloco tocado tem o comentário-ponteiro para `PROMPT-ANCHORS.md`.
- [ ] **Eval / teste de regressão (prova dos dois lados, por assertiva reancorada):** com o prompt real, (a) reescrever a frase mantendo a intenção **não** derruba a assertiva; (b) remover a linha de contrato do prompt **derruba** a assertiva. Resultado registrado no PR como a tabela da US-72.
- [ ] `dm-system.ts` intocado — o diff é só em testes e docs.
- [ ] `pnpm test` e `pnpm eval` verdes.

---

## Notas de implementação

- **Ordem sugerida:** [US-80](./US-80-ci-typecheck-testes-e-evals.md) primeiro. O CI ligado antes de mexer nos testes é a rede de segurança das 19 reancoragens — cada uma vira teste de si mesma no push.
- **Rodar o eval local corretamente:** `evals/cases/*` importa `@ai-dm/ai-engine` do **`dist`**, não do `src`. Sem `pnpm --filter './packages/*' build` antes, o `pnpm eval` valida um `dist` velho e a prova dos dois lados dá falso verde.
- **Método de prova (reuso direto da US-72):** script descartável que carrega `buildDmSystemPrompt` do `dist`, aplica `.replace()` para simular a reescrita e um filtro de linhas para simular a remoção, e roda as regex nos dois textos. Não precisa virar teste permanente — é validação de implementador.
- **Cuidado com a regex tolerante demais.** `/deity/i` sozinho casa qualquer menção; a assertiva precisa continuar **falhando** quando a regra sai. Prender os dois conceitos na mesma frase (`[^.]{0,40}` entre eles, como em `us-29-rolagens.ts:64`) é o padrão que já funcionou.
- **Duplicação `us-23` × `dm-system.test.ts`:** o mesmo contrato do turn-state é testado nos dois arquivos com as mesmas frases. Reancorar os dois de uma vez, ou consolidar num só — decidir na hora, sem inventar helper compartilhado antes de haver terceiro caso.

---

## Alternativas consideradas e rejeitadas

1. **Exportar os contratos do prompt como constantes e os testes casarem a constante.** Rejeitada: o eval passaria a testar a si mesmo — se a prosa perder a regra, a constante perde junto e o teste continua verde. Perde o sinal que justifica o eval.
2. **Lint/regra custom que proíbe `toMatch` de string longa de prosa.** Rejeitada por ora (já era a Questão #2 da US-72): ferramenta nova, dor ainda pontual, e não distingue prosa de dado de fixture — geraria falso-positivo nas assertivas resistentes.
3. **Snapshot do prompt inteiro.** Rejeitada: snapshot convida ao reflexo `vitest -u`, que aprova a quebra em vez de revisá-la — o mesmo motivo já registrado em `rubric-drift.test.ts:12`.
4. **Hook `pre-push` local em vez de CI.** Rejeitada como substituto: depende de configuração por máquina e é pulável com `--no-verify`. Registrada na [US-80](./US-80-ci-typecheck-testes-e-evals.md), que ficou com o tema do CI.

---

## Questões em aberto

1. **Gatilho para o P3 (hash guard).** Com o CI ligado, medir por ~1 mês quantas reescritas de prompt quebram assertiva. Mais de uma → a disciplina por comentário não pegou, implementar o mapa `seção → hash` no padrão da US-36. Zero ou uma → manter adiado.
2. **Cabeçalhos de seção são contrato ou enfeite?** `dm-system.test.ts:151-154` os trata como contrato; a US-71 renomeou um. Ou se assume que cabeçalho é interface estável (e aí ele entra no guard do P3), ou os testes param de ancorar neles. Decidir antes de mexer nas 🟡 MÉDIO.
3. ~~CI bloqueia merge?~~ **Movida** para a [US-80](./US-80-ci-typecheck-testes-e-evals.md), junto com o resto do tema de CI.

---

## Referências no código

- `evals/cases/us-29-rolagens.ts` — `:56-72` o padrão a replicar (convenção + 5 âncoras por intenção, entregue pela US-72).
- `evals/cases/us-40-divindade.ts:53`, `us-41-features.ts:33-34`, `us-23-dm-ciente-da-ficha.ts:56-57`, `us-38-rolagens-ancoradas.ts:45`, `us-42-magias.ts:46` — as assertivas frágeis dos eval cases.
- `packages/ai-engine/src/prompts/dm-system.test.ts` — `:92-93`, `:151-154`, `:165-169`, `:206-208`, `:233-234`, `:241-243`, `:266-268` — a maior concentração de âncoras em prosa.
- `packages/ai-engine/src/prompts/dm-system.ts` — `:180`, `:217`, `:237`, `:455` as linhas de prompt em que essas assertivas ancoram. **Fonte de verdade do texto atual — não muda nesta US.**
- `packages/ai-engine/src/rubric-drift.test.ts` — `REVIEWED_CRAFT_HASH` e o comentário `:12` (por que hash e não snapshot): o padrão que o P3 reusaria.
- Ausência de `.github/workflows/` — a lacuna que a [US-80](./US-80-ci-typecheck-testes-e-evals.md) fecha; é o que faz uma quebra aqui passar semanas sem ser vista.
