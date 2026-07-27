# US-77 — Reancorar as assertivas de prompt restantes + guard para a quebra não passar despercebida

**Épico:** 5 — Qualidade e avaliação do DM Agent
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
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
  - ⚠️ **A linha divisória não é uma partição.** Um mesmo token pode ser dado de fixture **e** aparecer dentro da prosa autoral — aí ancorar nele prova a existência do dado, não a da regra. Caso real: `feminino` é injetado pelo fixture (`- Gender: ${characterGender}`, `dm-system.ts:365`) **e** citado pela regra de concordância (`gender is "feminino"`, `:343`). A âncora só serve com um marcador sintático que separe os dois — as aspas. Ver *Notas de implementação* → *Controle negativo*.
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
| 🟡 MÉDIO | `dm-system.test.ts:151-154` | `/Gender Agreement/`, `/Narrative craft/`, `/SCENE CONTINUITY & OPTIONS/`, `/TURN RESOLUTION ORDER/` | cabeçalhos — a US-71 provou que são renomeados | **resolvido na Questão #2:** só `:151` reancora (`"gender"` é único da seção). `:153` e `:154` mantêm o cabeçalho — `updateScene`/`rollDice` aparecem em outras seções e virariam falso verde. `:152` já tem hash |
| 🟡 MÉDIO | `dm-system.test.ts:241,242,243` | `/No main quest set yet/`, `/No secondary quests yet/`, `/- Empty\./` | placeholders literais de saída estrutural | risco baixo (é saída do builder, não prosa autoral) — reancorar só se ficarem no caminho |

**Resistentes, fora do escopo:** `us-03`, `us-08`, `us-27`, `us-29` (já feito na US-72), `us-39`, e todas as assertivas de `us-23/40/41/42` que casam dado de fixture; `guardrails.test.ts:43`.

### Por que a solução atual não basta

A convenção anti-drift da US-72 existe como **comentário dentro de um único bloco** de `us-29-rolagens.ts`. Quem for editar `us-40` ou `dm-system.test.ts` não a vê. E, sem CI, nem o autor da reescrita descobre que quebrou algo — descobre-se semanas depois, por acaso, como aconteceu.

---

## A proposta — três camadas, da mais barata à mais cara

**P1 — CI (prevenção primária). → separado na [US-80](./US-80-ci-typecheck-testes-e-evals.md).** Workflow GitHub Actions rodando `typecheck`, `test` e `eval` em push e PR. Não impede que alguém escreva uma âncora frágil; converte a quebra de "invisível por semanas" em "vermelho no ato", quando reancorar custa um minuto para quem tem o contexto da reescrita na cabeça. Era o item de maior valor — por isso saiu, para não ficar preso atrás de 19 edições de teste.

**P2 — Convenção num lugar só.** Mover a taxonomia de âncoras da US-72 para `evals/PROMPT-ANCHORS.md`. Cada bloco de assertiva de prompt ganha um comentário de uma linha apontando para lá, em vez de repetir o parágrafo. O conteúdo:

- **Permitida:** nome de tool, dado do fixture, conceito com regex tolerante — **desde que o token seja único no prompt RENDERIZADO.** A condição de unicidade não é detalhe: `rollDice` aparece em 5 seções, `updateScene` em 3, e `feminino` é ao mesmo tempo dado de fixture e palavra da regra de concordância. Sem ela, "nome de tool é âncora estável" (regra herdada da US-72) leva direto ao falso verde.
- **Proibida:** conjugação, adjetivo, exemplo em pt-BR, texto decorativo de cabeçalho.
- **Método de prova dos dois lados:** reescrita fica verde, remoção fica vermelha — **mais o controle negativo** (ver *Notas de implementação*).
- **Assertiva negativa (`not.toMatch`) tem regra própria:** literal fechado, nunca conceito tolerante. Ver *Questões em aberto* #3.

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

- [x] Existe [`evals/PROMPT-ANCHORS.md`](../../../evals/PROMPT-ANCHORS.md) com: âncoras permitidas, âncoras proibidas, e o método de prova dos dois lados.
- [x] As **19 assertivas 🔴 ALTO** da tabela não casam mais prosa autoral; cada bloco tocado tem o comentário-ponteiro para `PROMPT-ANCHORS.md`.
- [x] **Eval / teste de regressão (prova dos dois lados, por assertiva reancorada):** com o prompt real, (a) reescrever a frase mantendo a intenção **não** derruba a assertiva; (b) remover a linha de contrato do prompt **derruba** a assertiva; (c) **controle negativo** — a candidata mais simples que foi rejeitada **sobrevive** à remoção, provando que o endurecimento tem função. Resultado registrado abaixo, em *Resultado da prova*.
- [x] `dm-system.ts` intocado — o diff é só em testes e docs.
- [x] `pnpm test` e `pnpm eval` verdes (77 + 52 testes; 0 falhas).

---

## Resultado da prova

Script descartável contra o **`dist`** (`buildDmSystemPrompt` / `buildTurnStateBlock`), três
textos por âncora — **base**, **reescrito** (`.replace()` na frase **e no cabeçalho**) e
**removido** (filtro de linhas) — rodando as **duas** candidatas em cada um.

Contrato: escolhida ✅✅❌ · rejeitada útil = sobrevive à remoção (falso verde que o
endurecimento comprou) **ou** quebra na reescrita (fragilidade que ele comprou).

**16 âncoras · 0 fora do contrato · 0 sem controle negativo útil.** As 19 assertivas viram 16
entradas porque `us-23:56,57` e `dm-system.test.ts:206,207` são o mesmo contrato duplicado nos
dois arquivos (reancorados iguais nos dois, com comentário cruzado), e a negativa
`:234` é literal fechado — prova simétrica trivial (adicionar a string fica vermelho; a
reescrita simulada, que mantém "…above", fica verde).

| Assertiva | Âncora escolhida | Rejeitada (controle) | O que o controle mostrou |
|---|---|---|---|
| `us-40:53` | `/(faith\|fé)[^.]{0,60}(invocation\|omen\|presságio)/` | `/divindade\|deity/` | rejeitada **sobrevive à remoção** — casa a linha de dado `Divindade: Solariel` do fixture |
| `us-41:33` | `/(offer\|present\|ofereç\|apresent)[^.]{0,80}narrat/` | `/offer and narrate/` | rejeitada quebra na reescrita (era texto do parêntese do cabeçalho) |
| `us-41:34` | `/(never\|not\|não)\s+resolv[ea]r?[^.]{0,80}(cost\|effect\|charge\|cooldown\|custo\|efeito)/` | `/never resolve/` | idem — a conjugação `NEVER`→`do not` já basta para quebrá-la |
| `us-23:56` = `dm-system.test:206` | `/(precedence\|precedência)[^.]{0,80}(infer\|prose\|prosa)/` | `/source of truth\|fonte de verdade/` | **sobrevive à remoção** do preâmbulo — `## Estado atual` (`:401`) também diz *source of truth* |
| `us-23:57` = `dm-system.test:207` | `/\b(not\|não)\s+(the\s+)?(player\|jogador)[^.]{0,30}(speak\|talk\|fala\|input\|voice)/` | `/not the player speaking/` | quebra na reescrita (`speaking`→`talking`) |
| `dm-system.test:208` | `/(authoritative\|ground truth\|fonte de verdade)[^.]{0,80}(this turn\|deste turno\|game server)/` | `/authoritative/` | **sobrevive à remoção** — a seção de inventário (`:467`) também é *authoritative* |
| `dm-system.test:92` | `/(flaw\|fraqueza)s?[^.]{0,60}(dilemma\|dilema)/` | `/flaw\|fraqueza/` | **sobrevive à remoção** — casa a linha de dado `- Fraquezas: …` do fixture |
| `dm-system.test:93` | `/\b(not\|never\|não\|nunca)\s+for[çc][ae]r?\b[^.]{0,60}(scene\|cena)/` | `/when the scene\|quando a cena/` | quebra na reescrita (`WHEN the scene calls`→`every time the scene asks`) |
| `dm-system.test:165` | `/invent[^.]{0,60}(from scratch\|fresh\|do zero)/i` | `/invent every proper name from scratch/` | quebra na reescrita |
| `dm-system.test:166` | `/(generic\|genérico)[^.]{0,30}(default\|fallback\|off-the-shelf\|padrão)/i` | `/(generic\|genérico)[^.]{0,40}(default\|name\|nome)/i` | **sobrevive à remoção** — casa `"a generic AND a named-skill version"` da regra de rolagem (`:273`) |
| `dm-system.test:168` | `/invent[^.]{0,80}(coherent register\|register of its own\|registro (próprio\|coerente))/i` | `/invent[^.]{0,80}register/i` | **sobrevive à remoção** — casa o passo 2 (`INVENT the name fresh in that register's sound`) |
| `dm-system.test:169` | `/\b(everything\|all\|tudo)\b[^.]{0,60}proper name/i` | `/not just NPCs/` | quebra na reescrita |
| `dm-system.test:233` | `/messages[^.]{0,20}\babove\b/i` | `/before the recent messages above/` | quebra na reescrita (a preposição literal já inverteu uma vez) |
| `dm-system.test:266` | `/(already\|já)[^.]{0,20}«Praça da vila ao anoitecer»/i` | `/Praça da vila ao anoitecer/` | **sobrevive à remoção** — `formatSceneState` também emite o local (`- local: …`); as guillemets são o marcador estrutural |
| `dm-system.test:267` | `/(arrival\|chegada)[^.]{0,60}(earlier turns\|turnos anteriores\|já (foi )?narrad)/i` | `/arrival here were narrated on earlier turns/` | quebra na reescrita |
| `dm-system.test:268` | `/\b(not\|never\|não\|nunca)\b[^.]{0,20}re-narrat/i` | `/Do NOT re-narrate the trip, the arrival, or the greeting/` | quebra na reescrita |

**Duas âncoras que EU teria commitado quebradas, e o controle pegou** (é o argumento das
quatro execuções, não das duas):

1. `dm-system.test:166` — a primeira candidata `/(generic|genérico)[^.]{0,40}(default|name)/i`
   passava com a seção de onomástica **deletada**: casava `"Never roll a generic AND a
   named-skill version"` da regra de rolagem, a 100 linhas dali. Falso verde clássico.
2. `us-41:33` — a primeira candidata `/offer[^.]{0,80}narrat/` **quebrava** numa reescrita
   legítima (`Offer them as options`→`Present them as options`): o verbo do contrato tem
   sinônimo óbvio e a alternação precisava incluí-lo.

---

## Notas de implementação

- **Ordem sugerida:** [US-80](./US-80-ci-typecheck-testes-e-evals.md) primeiro. O CI ligado antes de mexer nos testes é a rede de segurança das 19 reancoragens — cada uma vira teste de si mesma no push.
- **Rodar o eval local corretamente:** `evals/cases/*` importa `@ai-dm/ai-engine` do **`dist`**, não do `src`. Sem `pnpm --filter './packages/*' build` antes, o `pnpm eval` valida um `dist` velho e a prova dos dois lados dá falso verde.
- **Método de prova (reuso direto da US-72):** script descartável que carrega `buildDmSystemPrompt` do `dist`, aplica `.replace()` para simular a reescrita e um filtro de linhas para simular a remoção, e roda as regex — **as duas candidatas** — nos dois textos. Não precisa virar teste permanente; é validação de implementador. A **reescrita tem de mexer no cabeçalho também**, senão a prova não cobre o caso que motivou a US-71.
- **Cuidado com a regex tolerante demais.** `/deity/i` sozinho casa qualquer menção; a assertiva precisa continuar **falhando** quando a regra sai. Prender os dois conceitos na mesma frase (`[^.]{0,40}` entre eles, como em `us-29-rolagens.ts:64`) é o padrão que já funcionou.
- **Controle negativo — rodar a candidata REJEITADA, não só a escolhida.** O método dos dois lados prova que a regex escolhida funciona; não prova que ela precisava ser aquela. Sem o controle, a próxima pessoa "simplifica" o endurecimento de volta porque nada registra o que ele comprava. Rode as **quatro** execuções e registre no PR.

  Exemplo trabalhado — reancoragem de `dm-system.test.ts:151` (`/Gender Agreement/` → âncora no campo + valor), executado contra o `dist`:

  | Regex | base | reescrito | **removido** |
  |---|---|---|---|
  | escolhida: `/gender[^.]{0,40}"feminino"/i` | ✅ | ✅ | **❌ (correto)** |
  | rejeitada: `/gender[^.]{0,40}feminino/i` | ✅ | ✅ | ⚠️ **passa** — falso verde |

  As duas são indistinguíveis nas colunas *base* e *reescrito*. A única coluna que as separa é a remoção — e o que separa é um **marcador sintático**: as aspas. Sem elas a regex casa `- Gender: ${characterGender}` da ficha (`dm-system.ts:365`), que o fixture injeta, e a assertiva passa a provar que o personagem tem gênero em vez de provar que a regra de concordância existe.
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
2. **Cabeçalhos de seção são contrato ou enfeite?** ~~Binário~~ — **resolvida: são três categorias, e o critério não é "cabeçalho vs prosa", é _quem possui a string_.** Mesmo critério que a taxonomia do P2 já usa para tool name e dado de fixture; faltava aplicá-lo a cabeçalho.

   | # | Categoria | Como reconhecer | Exemplos | Veredito |
   |---|---|---|---|---|
   | 1 | **Interface** — o cabeçalho é referenciado por nome por outra parte do sistema | O builder emite o cabeçalho **e** algo mais o cita literalmente (outra seção do prompt, o código, um teste de integração) | `## Cena atual` (`dm-system.ts:415`) e `## Entidades do mundo` (`:430`), citados em prosa inglesa em `:349` (*The "Cena atual" and "Entidades do mundo" blocks … are the SOURCE OF TRUTH*) | **Contrato. Não tocar.** Testes ancoram no cabeçalho porque é o acoplamento real. Remover o acoplamento (nome numa constante só) é a **[US-84](./US-84-nomes-de-bloco-do-turn-state-compartilhados.md)**. |
   | 2 | **Já protegido por hash** | O cabeçalho vive dentro de uma constante exportada com drift guard | `## Narrative craft` dentro de `NARRATIVE_CRAFT_SECTION` (`dm-system.ts:114`), coberto por `REVIEWED_CRAFT_HASH` (`rubric-drift.test.ts:23`) | **Questão não se aplica.** O P3 aqui já roda desde a US-36. |
   | 3 | **Título autoral** — ninguém referencia | Só existe para organizar a leitura humana do prompt | `## ⚠️ TURN RESOLUTION ORDER`, `## ⚠️ SCENE CONTINUITY & OPTIONS`, `### 8. Gender Agreement`, `## MANDATORY TEXT FORMATTING RULES` | **Prosa. Reescrevível** — mas só reancora se a seção tiver token único (ver tabela abaixo); senão o cabeçalho fica por falta de identificador melhor. |

   **Por que a categoria 1 não pode ser tratada como reescrevível:** `dm-system.ts:349` é prosa inglesa citando o nome pt-BR de um bloco gerado em `:415`/`:430`. Renomear um lado sem o outro manda o modelo confiar num bloco que não existe com aquele nome — bug silencioso que nenhum `typecheck` pega, porque o acoplamento é string cross-language. `dm-system.test.ts:132`, `:219`, `:239`, `:253`, `:259` são a única prova dele. Reancorar esses em "conceito" apagaria a prova.

   **Solução proposta (categoria 3) — a reancoragem só vale se o token for ÚNICO da seção.** `dm-system.test.ts:148-155` é um teste de **presença de seção**, não de existência de regra. Trocar o cabeçalho por um nome de tool parece seguir a taxonomia do P2, mas não segue: o prompt repete as tools de propósito em várias seções, então a assertiva passa a sobreviver à **deleção da seção inteira** — falso verde, a falha que esta US existe para eliminar. Contagem no prompt atual:

   | Assertiva | Âncora atual | Token da seção é único? | Ação |
   |---|---|---|---|
   | `:151` `/Gender Agreement/` | cabeçalho | ✅ `"gender"`, `feminino` só em `dm-system.ts:343` | **reancorar** — valores do campo, não adjetivo autoral |
   | `:153` `/SCENE CONTINUITY & OPTIONS/` | cabeçalho | ❌ `updateScene` também em `:313` (outra seção); `Cena atual` também é o bloco do builder (`:415`) | **manter o cabeçalho.** Alternativa só com os dois conceitos presos na mesma frase (`[^.]{0,40}`), o que não é mais barato nem mais legível |
   | `:154` `/TURN RESOLUTION ORDER/` | cabeçalho | ❌ `rollDice` em `:250`, `:269`, `:271`, `:272`, `:284` — a âncora sobreviveria à deleção da seção | **manter o cabeçalho** |
   | `:152` `/Narrative craft/` | cabeçalho | categoria 2 | deixar como está |

   **Por que manter cabeçalho não contradiz a US:** o risco é assimétrico e a própria tese desta story já o pesou (ver "a fragilidade custou pouco; a invisibilidade custou o tempo todo"). Cabeçalho renomeado = vermelho **visível**, uma linha de regex para consertar, e com o CI da [US-80](./US-80-ci-typecheck-testes-e-evals.md) o vermelho aparece no commit que renomeou. Âncora tolerante demais = verde **invisível** que esconde uma seção deletada. Entre ruído barato e silêncio caro, esta US escolhe ruído.

   **Consequência para o P2:** `PROMPT-ANCHORS.md` ganha **duas** perguntas de triagem, não a regra "cabeçalho é/não é âncora":
   1. *O cabeçalho é referenciado por nome por outra parte do sistema?* Sim → contrato (categoria 1), ancore nele.
   2. Não → *existe no corpo da seção um token que o código possui **e** que não aparece em nenhuma outra seção?* Sim → ancore nele. Não → mantenha o cabeçalho; é o único identificador único que a seção tem.
   A segunda pergunta é a que faltava: "nome de tool é âncora estável" vale para assertiva de **existência de regra**, e é armadilha para assertiva de **presença de seção**.

   **Consequência para o P3:** o hash ganha um alvo mais preciso — as seções da categoria 3 **sem token único** (`TURN RESOLUTION ORDER`, `SCENE CONTINUITY & OPTIONS`), que são exatamente as que ficam presas ao cabeçalho. Não muda o adiamento da Questão #1, mas se o gatilho disparar, é por aí que se começa: 2 seções, não o prompt inteiro.

3. **O método de prova só vale para assertiva positiva.** "Reescrita fica verde, remoção fica vermelha" pressupõe `toMatch`. Em `not.toMatch` o risco **inverte**: regex tolerante casa mais fácil, logo produz **falso vermelho**, não falso verde. `dm-system.test.ts:163-164` (`not.toMatch(/Elara/)`) só é seguro porque é literal fechado. Regra para o `PROMPT-ANCHORS.md`: **assertiva negativa ancora em literal fechado, nunca em conceito tolerante** — e o lado a provar é o simétrico (adicionar a string proibida fica vermelho; reescrever prosa em volta fica verde).
4. ~~CI bloqueia merge?~~ **Movida** para a [US-80](./US-80-ci-typecheck-testes-e-evals.md), junto com o resto do tema de CI.

---

## Referências no código

- [`evals/PROMPT-ANCHORS.md`](../../../evals/PROMPT-ANCHORS.md) — a convenção (P2), entregue por esta US. É para lá que apontam os comentários de uma linha nos blocos de assertiva.
- `evals/cases/us-29-rolagens.ts` — `:56-72` o padrão a replicar (convenção + 5 âncoras por intenção, entregue pela US-72; o parágrafo longo virou ponteiro para o doc acima).
- `evals/cases/us-40-divindade.ts:53`, `us-41-features.ts:33-34`, `us-23-dm-ciente-da-ficha.ts:56-57`, `us-38-rolagens-ancoradas.ts:45`, `us-42-magias.ts:46` — as assertivas frágeis dos eval cases.
- `packages/ai-engine/src/prompts/dm-system.test.ts` — `:92-93`, `:151-154`, `:165-169`, `:206-208`, `:233-234`, `:241-243`, `:266-268` — a maior concentração de âncoras em prosa.
- `packages/ai-engine/src/prompts/dm-system.ts` — `:180`, `:217`, `:237`, `:455` as linhas de prompt em que essas assertivas ancoram. **Fonte de verdade do texto atual — não muda nesta US.**
- `packages/ai-engine/src/rubric-drift.test.ts` — `REVIEWED_CRAFT_HASH` e o comentário `:12` (por que hash e não snapshot): o padrão que o P3 reusaria.
- Ausência de `.github/workflows/` — a lacuna que a [US-80](./US-80-ci-typecheck-testes-e-evals.md) fecha; é o que faz uma quebra aqui passar semanas sem ser vista.
