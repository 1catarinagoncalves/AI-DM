# US-111 — Classe de Dificuldade do SRD 2024 decide o quão difícil é o teste

**Épico:** 3 — Narração e mecânica
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** [US-110](./US-110-tabela-de-testes-de-habilidade-do-srd-2024.md) (a tabela *Typical Difficulty Classes* já sai extraída no artefato `d20-tests.srd-2024.json`, e o padrão de bloco derivado no prompt já existe) · [US-38](./US-38-rolagens-ancoradas-na-ficha.md) (o total do teste já vem da ficha; falta contra o quê comparar) · [US-29](./US-29-saneamento-de-rolagens-ficticias.md) (o bloco de rolagem e o sanitizador que apagam número da prosa)
**Relacionado:** [US-108](./US-108-tabela-de-modificadores-do-srd-2024.md) (o mesmo `Rule.json`, o mesmo pipeline) · [US-109](./US-109-bonus-circunstancial-no-teste-de-d20.md) (o outro termo da soma do d20 test) · [US-75](./US-75-dimensao-de-proveniencia-no-ledger.md) (proveniência no ledger — a mesma disciplina aplicada ao número) · [US-55](./US-55-prompt-caching-do-dm.md) / [ADR 007](../../adr/007-camadas-do-prompt-por-volatilidade.md) (camadas do prompt por volatilidade) · [ADR 003](../../adr/003-sistemas-como-dado.md) (sistema como dado)
**Criada em:** 2026-08-06

---

## História

> **Como** jogadora,
> **quero** que o Mestre escolha uma **Classe de Dificuldade da escala do SRD 2024** antes de rolar um teste, e que **o Game Server** diga se o total alcançou essa CD,
> **para que** "difícil" signifique a mesma coisa em todos os turnos e o sucesso não seja decidido pela impressão do modelo sobre o número que ele acabou de receber.

---

## Contexto e motivação

### O problema observado

A [US-110](./US-110-tabela-de-testes-de-habilidade-do-srd-2024.md) ancorou **qual** teste a situação chama. Ficou de fora, declarado como sibling dela, **quão difícil** ele é. A tabela normativa já está extraída — o artefato [`d20-tests.srd-2024.json`](../../../packages/ai-engine/src/prompts/d20-tests.srd-2024.json) traz `difficultyClasses` com as 6 linhas de *Typical Difficulty Classes* (texto verbatim do dataset, ruleset `srd-2024_d20-tests`, tag `v2.1.0`):

| Task | DC |
|---|---|
| Very easy | 5 |
| Easy | 10 |
| Medium | 15 |
| Hard | 20 |
| Very hard | 25 |
| Nearly impossible | 30 |

Mas **nada no sistema usa esse campo**. O `d20-tests.srd-2024.json` é importado por [`dm-system.ts`](../../../packages/ai-engine/src/prompts/dm-system.ts) e só `abilityChecks` é lido (`:184`); `difficultyClasses` entrou no artefato "de graça" e segue sem consumidor. Na prática, hoje:

1. O modelo pede `rollDice`, o Game Server soma `1d20 + modificador da ficha` e devolve `{ formula, rolls, modifier, total }` — **nenhuma noção de alvo**.
2. O prompt manda interpretar o resultado (`:306` *"Narrate AFTER all mechanical tools have resolved"*; no ramo `Free`, explicitamente *"high = success, low = failure"*).
3. Quem decide se 13 passou é **o modelo, no momento da narração** — sem alvo declarado antes da rolagem, sem alvo registrado depois.

O efeito é assimétrico e invisível: o mesmo total de 13 vira sucesso quando a cena quer avançar e falha quando a cena quer tensão. E como a CD nunca é escrita em lugar nenhum, **não existe nem como reclamar**: nem o `EventLog`, nem o bloco de rolagem, nem o log de servidor dizem contra o quê o total foi comparado.

### Por que a solução atual não basta

A US-38 fechou metade da invariante — "o modelo nunca fornece um número" — mas ela vale só para o **lado esquerdo** da comparação. O lado direito não é fornecido por ninguém: ele não existe. Um teste sem alvo não é um teste ancorado com alvo implícito; é um teste cujo veredito é prosa.

E a redação atual do prompt **empurra na direção errada**: `:305` proíbe *"never fabricate a specific number"*. Lida ao pé da letra, ela desencoraja o Mestre de fazer justamente o que o SRD manda o Mestre fazer — atribuir uma CD à tarefa. Hoje o modelo não tem como saber que essa é a exceção legítima, porque não há escala nenhuma no prompt de onde escolher.

Escrever a escala à mão no `dm-system.ts` seria regra autoral sem procedência — exatamente o defeito que a US-108 tirou da tabela de modificadores. A escala certa já está no repo, versionada, com licença CC-BY, **e já é conferida pelo `ingest`**.

### A proposta

Duas metades pequenas, e nenhuma nova extração:

1. **A escala vai para o prompt** (bloco derivado do artefato, dentro da seção `## Rules` do sistema nomeado, ao lado da tabela da US-110): antes de rolar, o Mestre **escolhe um degrau da escala** — não um número livre.
2. **A CD escolhida viaja na tool e o veredito volta do servidor**: `rollDice` ganha um `dc` opcional restrito aos 6 valores do artefato; o Game Server compara `total >= dc`, devolve `dc` e `success` ao modelo e grava os dois no `EventLog`.

O que muda no jogo é o veredito deixar de ser impressão: o modelo escolhe a dificuldade **antes** de ver o dado, e depois recebe o resultado do servidor em vez de julgá-lo. O que muda no repo é a comparação passar a existir e ficar auditável.

---

## Escopo

### Dentro do escopo

- **Bloco de CD no system prompt, só no ramo do sistema nomeado** — as 6 linhas de `difficultyClasses` renderizadas dentro do `rulesSection` de [`dm-system.ts`](../../../packages/ai-engine/src/prompts/dm-system.ts), logo depois do bloco da US-110 (primeiro *qual* teste, depois *quão difícil*), montadas **a partir do artefato**, nunca digitadas. O ramo `Free` **não** recebe (mesma decisão da US-110: o Free é deliberadamente antimecânico).
- **A regra de redação, explícita em três cláusulas** — (a) escolher **um degrau da escala**, nunca um número entre degraus; (b) escolher **antes** de chamar `rollDice`, e a partir da ficção (tarefa rotineira ≠ tarefa que quase ninguém consegue), nunca a partir do modificador da personagem — calibrar a CD pela ficha é o vício que transforma qualquer teste em 50%; (c) a CD **nunca** aparece na prosa nem no `reason` — o veredito chega do servidor e é narrado qualitativamente.
- **`dc` opcional na tool `rollDice`** ([`ai.service.ts`](../../../apps/api/src/ai/ai.service.ts) `:383`) — inteiro, validado contra os valores de `difficultyClasses`. Ausente → comportamento de hoje, byte a byte. Valor **fora da escala** → `warn` com o valor ofensor e a CD é **ignorada** (nunca arredondada para o degrau vizinho, nunca lançando no meio de um turno): mesma disciplina do `unresolved` da US-38 e da fonte não mapeada da US-109.
- **Comparação no Game Server** — `total >= dc` resolvido onde o total é montado, devolvido ao modelo como `{ dc, success }` junto do resultado. Com `dc` ausente, `success` também é ausente: nada de `false` implícito, que o modelo leria como falha.
- **Proveniência no `EventLog`** — o payload do `DICE_ROLL` (`ai.service.ts` `:413`) grava `dc` e `success`. Sem isso a story entrega uma comparação que continua não podendo ser auditada depois do turno.
- **Testes** — do prompt (o bloco renderiza as 6 linhas vindas do artefato, presente no sistema nomeado e **ausente** no `Free`, com âncora na convenção do [`PROMPT-ANCHORS.md`](../../../evals/PROMPT-ANCHORS.md)); da comparação (limite exato `total === dc` é sucesso; `dc` fora da escala é ignorado com `warn`; `dc` ausente não muda nada).
- **Um caso de eval determinístico** — contrato do prompt, no molde de [`us-110-tabela-de-testes.ts`](../../../evals/cases/us-110-tabela-de-testes.ts).

### Fora do escopo

- **Mostrar a CD ao jogador.** O bloco de rolagem (`formatDiceBreakdown`, [`narration.ts`](../../../packages/shared/src/narration.ts) `:218`) e o frame `D:` não mudam. Confirmado no código: o frame é montado **campo por campo** em [`ai.controller.ts`](../../../apps/api/src/ai/ai.controller.ts) `:136`, então campo novo no retorno da tool **não** vaza para o cliente por acidente — e o `DiceResult` de [`game.ts`](../../../packages/shared/src/types/game.ts) segue com os mesmos 4 campos. Exibir "CD 15 — sucesso" é decisão de produto (e de spoiler), story própria.
- **Salvaguardas, ataques e CA.** `savingThrows` e `attackRolls` estão no mesmo artefato e continuam sem consumidor: a tool não tem `kind` de teste, e CA não é CD. É a mesma story que a US-110 já apontou — a que dá tipo à tool.
- **Vantagem/desvantagem** (regra `srd-2024_d20-tests_advantage-disadvantage`, do mesmo ruleset) — é um segundo d20, não um alvo. Story própria, e ela mexe no [`dice.service.ts`](../../../apps/api/src/game/dice.service.ts), que esta não toca.
- **CD passiva** (Percepção passiva = 10 + modificador) — regra de outra seção do SRD, e depende de decidir se o Mestre pode testar sem rolar.
- **Consequência mecânica do sucesso/falha** (dano, condição, progresso de quest). O servidor devolve o veredito; o que acontece na ficção continua sendo narração.
- **CD escolhida pelo servidor.** Um mapa "arrombar porta → 15" seria pior que o modelo em ficção real, pelo mesmo motivo que a US-110 recusou o classificador determinístico situação → perícia. A escala é **guia no prompt**; o servidor **valida e compara**, não escolhe.
- **Sucesso/falha por grau** (*degrees of success*, "falhou por 1"). Não está no SRD 2024 como regra geral; inventar aqui é regra autoral.
- **O ramo `Free`.** Continua com *"high = success, low = failure"* (`dm-system.ts` `:302`).
- **Tradução dos rótulos** (`Very easy`…`Nearly impossible`). O system prompt é escrito em inglês; só a saída segue o `targetLanguage`. Traduzir segue a disciplina da [US-52](./US-52-traducao-automatica-do-srd.md), se um dia a escala for exibida a gente.
- **Eval vivo da obediência do modelo.** Medir se a CD escolhida é coerente com a ficção exige inspecionar a trajetória de tool calling, e o gerador dos evals é deliberadamente sem tools ([US-70](./US-70-piso-por-dimensao-e-robustez-do-eval.md)) — é a mesma lacuna registrada na questão 3 da US-110, e o mesmo harness a resolve para as duas.

---

## Modelo de dados proposto

Sem migração: nada muda no schema, nada muda no `DiceResult`. Muda o **retorno da tool** (que o modelo lê) e o **payload do evento**.

```json
{
  "formula": "1d20+3",
  "rolls": [14],
  "modifier": 3,
  "total": 17,
  "dc": 15,
  "success": true
}
```

| Campo | Tipo | Descrição |
|---|---|---|
| `dc` | inteiro \| ausente | A CD escolhida pelo Mestre, **obrigatoriamente um dos 6 valores** de `difficultyClasses`. Ausente = teste sem alvo (comportamento de hoje). Fora da escala = ignorado com `warn`, e o retorno sai como se fosse ausente. |
| `success` | booleano \| ausente | `total >= dc`. **Ausente quando `dc` é ausente** — `false` implícito seria lido como falha narrada. |

**Persistência:** `payload` do `EventLog` do tipo `DICE_ROLL` (JSON, sem migração), junto de `formula`/`reason`/`skill`/`rolls`/`modifier`/`total`. A escala em si não vai para o banco nem para o `System.config`: o único consumidor é o prompt, que importa o artefato como módulo do próprio pacote.

---

## Critérios de aceite

- [ ] O system prompt do sistema SRD contém as 6 linhas de *Typical Difficulty Classes* com rótulo e valor (`Very easy 5` … `Nearly impossible 30`), montadas a partir do MESMO artefato que o prompt já importa — texto fixado à mão no `dm-system.ts` fica vermelho no primeiro bump de tag.
- [ ] O system prompt do sistema `Free` **não** contém a escala — as duas metades verificadas no mesmo teste.
- [ ] O prompt manda escolher a CD **antes** de chamar `rollDice`, **a partir da ficção** (não do modificador da personagem), e **proíbe** a CD na prosa e no `reason`.
- [ ] O bloco fica na **parte estática** do prompt (dentro do `rulesSection`), sem cabeçalho `## ` novo — a fronteira de cache da [US-55](./US-55-prompt-caching-do-dm.md) / [ADR 007](../../adr/007-camadas-do-prompt-por-volatilidade.md) e o guard de conjunto de blocos da [US-85](./US-85-fronteira-de-camadas-do-prompt.md) seguem intactos.
- [ ] `rollDice` aceita `dc` opcional; com `dc` na escala, o retorno traz `dc` e `success`, e `success` é `true` no limite exato (`total === dc`).
- [ ] `dc` **fora da escala** (13, 0, 100, negativo) é ignorado com `warn` contendo **o valor ofensor e a escala esperada** (`AGENTS.md`); o turno continua e o retorno não traz `success`.
- [ ] Com `dc` ausente, o retorno e o payload são **os de hoje** — sem `success: false`.
- [ ] O payload do `DICE_ROLL` grava `dc` e `success` quando houver.
- [ ] Nada muda no que o jogador vê: o frame `D:` e o bloco de rolagem são byte a byte os de hoje, com ou sem `dc`.
- [ ] **Eval / teste de regressão:** (a) teste do prompt ancorado no dado do artefato (o par rótulo+valor de um degrau), (b) teste da comparação com os três casos de limite (`total === dc`, CD fora da escala, CD ausente) e (c) o eval case determinístico. Guarda de vacuidade em (a): a assertiva monta a linha esperada a partir do JSON, então não pode passar com o bloco vazio.

---

## Notas de implementação

- **Não há extração nova.** A [US-110](./US-110-tabela-de-testes-de-habilidade-do-srd-2024.md) já grava `difficultyClasses` no artefato e o `ingest` já cobra as 6 linhas (e já tem teste para a CD **não** virar exemplo de habilidade). Esta story só passa a ler o campo. Não mexa em `scripts/srd/d20-tests.mjs`.
- **A escala vira também a validação.** A lista de valores aceitos por `dc` sai do artefato (`difficultyClasses.map(d => d.dc)`), não de uma constante paralela — senão o próximo bump de tag deixa prompt e validação discordando em silêncio. É a mesma razão pela qual a US-110 confere as chaves de habilidade contra o catálogo, não contra constante escrita à mão.
- **Onde a comparação mora.** O `total` é montado no `execute` da tool ([`ai.service.ts`](../../../apps/api/src/ai/ai.service.ts) `:405`–`:418`), depois do `this.dice.roll(formula)`. O [`DiceService`](../../../apps/api/src/game/dice.service.ts) **não muda**: ele resolve fórmula, não veredito, e o `DICE_FORMULA_RE` não tem onde carregar um alvo.
- **O `reason` é visível ao jogador.** O frame `D:` usa `label: p.result.reason` (`ai.controller.ts` `:137`), então uma CD escrita no `reason` (`"Atletismo, CD 15"`) chega ao bloco de rolagem e vira spoiler. A `description` do campo na tool tem de dizer isso; sanitizar o `reason` fica para se o sintoma aparecer.
- **A CD na prosa já cai no sanitizador — de raspão, não por desenho.** Os `ROLL_CUES` de [`narration.ts`](../../../packages/shared/src/narration.ts) removem a **frase inteira** que casa `\b(?:teste|test|check)\b` a até 40 caracteres de um número, então "a CD do teste é 15" desaparece com gramática e tudo. Não conte com isso como garantia: "o portão exige 15" não casa nada. A proibição tem de estar no prompt.
- **"Um teste por ação" já existe e continua valendo.** O reuso do 1º resultado (`ai.service.ts` `:393`) devolve a CD do **primeiro** teste — correto, e é o comportamento que impede o modelo de re-rolar contra uma CD mais macia depois de falhar. Vale um teste.
- **Ordem no prompt importa:** *qual* teste (US-110) antes de *quão difícil* (esta). Invertido, o modelo escolhe a dificuldade antes de saber o que está testando. E mantenha as duas separadas da regra de **QUANDO** rolar — fundi-las produz o efeito colateral clássico de o modelo passar a rolar mais.
- **Custo de token é pequeno e estático:** 6 linhas curtas na camada cacheada. Mexe uma vez no baseline medido pela [US-104](./US-104-baseline-de-cache-do-prompt-pos-pin.md).
- **Âncora do teste do prompt:** o dado injetado, não a prosa que o introduz ([`PROMPT-ANCHORS.md`](../../../evals/PROMPT-ANCHORS.md)). Cheque unicidade antes de escolher: números como `15` aparecem na linha `Attributes` da ficha renderizada — o par rótulo+valor (`Nearly impossible` + `30`) é o candidato estável.

---

## Questões em aberto

1. **A CD podia ficar só no prompt, sem tocar na tool?** Sim, e seria menos código — mas aí a escolha do Mestre não existe em lugar nenhum: nada valida o degrau, nada compara, nada registra, e o único critério de aceite possível seria "a escala está no prompt". **Recomendação: manter o `dc` na tool**, que é o que torna a story verificável e transforma o veredito em dado. Se a decisão for prompt-only, a metade mecânica vira story própria e este documento se divide.
2. **Sem `dc`, o Mestre segue julgando por conta?** Hoje sim, e o campo é opcional de propósito (não quebra nenhum turno em produção). A pergunta é se, medida a adesão, o `dc` deve virar **obrigatório** em teste de perícia no ramo do sistema nomeado. Decidir com dado, não agora.
3. **O que o `success` autoriza na narração?** O SRD diz que alcançar a CD é sucesso, mas "sucesso" numa ficção não é binário (sucesso com custo, falha que avança a cena). Se o prompt tratar `success` como interruptor, a narração empobrece; se tratar como sugestão, a story não muda nada. A redação certa é a parte de risco desta US.
4. **Quanto vale de fato?** Mesma lacuna da questão 3 da US-110: a régua e a comparação ficam verificadas, a **coerência** da CD escolhida com a ficção não — o harness que mediria (trajetória de tool calling, com chave: [US-94](./US-94-eval-vivo-noturno-com-chaves.md)) não existe.

---

## Referências no código

- `packages/ai-engine/src/prompts/d20-tests.srd-2024.json` — `difficultyClasses`: as 6 linhas já extraídas, hoje sem consumidor.
- `packages/ai-engine/src/prompts/dm-system.ts` — `abilityCheckTable` (`:183`, o vizinho e o molde) e o `rulesSection` (`:297`) com os ramos `Free` / sistema nomeado; a linha `:305` (*"never fabricate a specific number"*) é a que precisa conviver com a nova instrução.
- `packages/ai-engine/src/prompts/dm-system.test.ts` — onde entram as assertivas do bloco novo (presente/ausente) e o guard de blocos da US-85.
- `apps/api/src/ai/ai.service.ts` — a tool `rollDice` (`:380`): o schema Zod que ganha `dc`, a comparação e o payload do `DICE_ROLL` (`:413`).
- `apps/api/src/ai/ai.controller.ts` — o frame `D:` montado campo por campo (`:136`): a prova de que campo novo no retorno da tool não vaza para o cliente.
- `apps/api/src/game/dice.service.ts` — `DICE_FORMULA_RE` e `roll()`: por que o alvo não entra na fórmula.
- `packages/shared/src/types/game.ts` — `DiceResult` / `RollTurn`: o contrato que **não** muda.
- `packages/shared/src/narration.ts` — `formatDiceBreakdown` (`:218`, inalterado) e os `ROLL_CUES` de `stripFabricatedRolls` (`:47`), que só cobrem a CD na prosa de raspão.
- `packages/shared/src/roll.ts` — `resolveRollModifier`: o lado esquerdo da comparação, já ancorado pela US-38.
- `scripts/srd/ingest.test.mjs` — os testes do parser da US-110, incluindo o que separa a tabela de CD da de exemplos.
- `evals/cases/us-110-tabela-de-testes.ts` — o caso vizinho, molde do desta story.
- `evals/PROMPT-ANCHORS.md` — convenção da âncora.
