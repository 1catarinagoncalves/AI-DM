# US-72 — Evals de prompt resistentes à reescrita (assertivas por intenção, não por frase literal)

**Épico:** 5 — Qualidade e avaliação do DM Agent
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** [US-29](./US-29-saneamento-de-rolagens.md) (o eval que quebrou), [US-36](./US-36-eval-qualidade-narracao.md) (precedente do guard de drift por hash em `rubric-drift.test.ts`).
**Relacionada a:** [US-71](./US-71-simplificar-localizacao-do-personagem.md) (colapsou seções do prompt; expôs a fragilidade ao renomear `SPATIAL & SCENE CONTINUITY`).
**Criada em:** 2026-07-24

---

## História

> **Como** mantenedor do DM Agent,
> **quero** que os evals que checam o system prompt validem a **intenção** (o contrato de comportamento) e não a **frase decorativa exata**,
> **para que** reescrever o texto do prompt — algo que acontece toda semana — não derrube evals cujo comportamento continua correto, e para que uma falha de eval volte a significar "o contrato quebrou", não "a redação mudou".

---

## Contexto e motivação

### O problema observado

`pnpm eval` tem **2 testes vermelhos** em `evals/cases/us-29-rolagens.ts`, no bloco *"US-29 — prompt endurece o gate de rolagem"*:

1. **`us-29-rolagens.ts:58`** — `expect(prompt).toMatch(/sanitizer will DELETE/i)`.
   O prompt **hoje** diz: *"a sanitizer **DELETES** any number you write, breaking your sentence"* (`dm-system.ts:270`). A intenção — avisar que o saneador apaga números fabricados — **está lá**; só a conjugação mudou (`will DELETE` → `DELETES`).
2. **`us-29-rolagens.ts:63`** — `expect(prompt).toMatch(/quero rolar/i)`.
   O prompt **hoje** diz: *"If the PLAYER asks to roll (**"rolo Percepção"**), still route it through `rollDice`"* (`dm-system.ts:271`). A intenção — pedido de rolagem do jogador ainda passa por `rollDice` — **está lá**; só o exemplo em pt-BR mudou (`quero rolar` → `rolo Percepção`).

Ou seja: **nenhum dos dois é regressão de comportamento.** O gate de rolagem continua endurecido; a prosa foi reescrita.

### A causa-raiz (verificada)

`git log -S` nas duas frases, sobre `packages/ai-engine/src/prompts/dm-system.ts`:

- `08f9908 "US 29 Saneamento de rolagens"` **introduziu** `sanitizer will DELETE` e `quero rolar` no prompt — e o teste foi escrito casando essas frases **literais**.
- `e0a6817 "Atualizações prompt onomastica"` (o commit **imediatamente anterior** a este trabalho) reescreveu essas linhas para `sanitizer DELETES` e `rolo Percepção`. O prompt mudou; **o teste não acompanhou**. Vermelho desde então.

O antipadrão: a assertiva ancorou numa **frase de enfeite** (adjetivo/conjugação/exemplo em pt-BR), que é exatamente a parte do prompt que mais muda. Toda reescrita de prompt é uma bomba-relógio para esse tipo de teste.

### Por que a solução atual não basta

Não há convenção sobre **o que** uma assertiva de prompt pode casar. Hoje vários eval cases grepam texto verbatim do prompt (`us-23`, `us-38`, `us-39`, `us-40`, `us-41`, `us-42`, além de `dm-system.test.ts` e `guardrails.test.ts`). A maioria passa **por acaso** — porque a frase específica ainda não foi reescrita. A US-36 já reconheceu esse risco para **uma** seção (a barra de ofício) e criou um guard de drift por **hash** (`REVIEWED_CRAFT_HASH` em `rubric-drift.test.ts`) que força a rubrica a acompanhar a barra. Mas isso cobre só aquela seção; o resto dos evals de prompt não tem disciplina nenhuma.

### A proposta

**Reancorar** as 2 assertivas quebradas na **intenção estável**, não na frase:

- Âncoras estáveis = **tokens que o código/US possui**: nomes de tool (`rollDice`, `updateScene`), cabeçalhos de seção que são contrato, e o **conceito** (ex.: "saneador apaga número", "pedido do jogador roteia por rollDice") — casado com regex tolerante a reescrita.
- Âncoras proibidas = conjugação, adjetivo, exemplo em pt-BR, ordem de palavras — o enfeite.

E **documentar a convenção** (num comentário no topo do bloco de assertivas de prompt) para que a próxima reescrita **reancore**, em vez de colar uma nova frase literal frágil. Escopo deliberadamente **mínimo**: corrigir o que está vermelho + fixar a regra; **não** reescrever em massa os testes que hoje passam (YAGNI — churn sem sinal).

---

## Escopo

### Dentro do escopo

- **Corrigir as 2 assertivas** de `us-29-rolagens.ts` para casar a intenção:
  - (1) o prompt exige narração **qualitativa** E avisa que um **saneador apaga** o número fabricado. Âncora tolerante: `/QUALITATIVELY/i` (já estável) + o conceito saneador-apaga-número via regex que aceita `DELETE`/`DELETES`/`remove`.
  - (2) o **pedido de rolagem do jogador** ainda passa por `rollDice`. Âncora no contrato (`/PLAYER asks to roll/i` + `/rollDice/`), não no exemplo pt-BR.
- **Convenção anti-drift**: um comentário curto no bloco de assertivas de prompt de `us-29` declarando a regra ("ancore em tool/cabeçalho/conceito, nunca em conjugação/exemplo"), citável pelas próximas US.
- **Verde no CI**: `pnpm eval` sem falhas (fora as já `skip` por design).

### Fora do escopo

- **Reescrever o prompt.** O texto atual (`sanitizer DELETES` / `rolo Percepção`) está correto — o defeito é do teste, não do prompt.
- **Mudar o comportamento do saneador** (`stripFabricatedRolls`) ou o gate de rolagem. É só a assertiva.
- **Auditar/reescrever preventivamente** os outros eval cases que grepam verbatim (`us-23`, `us-38`, `us-39`…). Eles passam hoje; reescrever teste verde é churn. Fica **registrado como risco conhecido** (ver Questões em aberto #1), a endereçar quando/ se um deles quebrar.
- **Guard de drift por hash** genérico para todo o prompt. O da US-36 cobre a barra de ofício; estender para o prompt inteiro é peso morto até haver dor — YAGNI.

---

## Critérios de aceite

- [ ] `pnpm eval` roda **sem falhas** (as 2 vermelhas de `us-29-rolagens.ts` ficam verdes; nenhuma outra regride).
- [ ] As 2 assertivas corrigidas **não** contêm mais a conjugação/exemplo literal (`sanitizer will DELETE`, `quero rolar`); casam o **conceito** e sobrevivem a uma reescrita que troque conjugação/exemplo mantendo a intenção.
- [ ] Prova da resistência: reescrever localmente `DELETES`→`will remove` e `rolo Percepção`→`quero rolar` no prompt **não** derruba as assertivas corrigidas (validação manual do implementador, descrita no PR).
- [ ] O comportamento do prompt **não** mudou (nenhuma edição em `dm-system.ts`); o diff é só em `evals/cases/us-29-rolagens.ts`.
- [ ] A convenção anti-drift está escrita como comentário no bloco de assertivas de prompt de `us-29`.

---

## Notas de implementação

> *Dicas para quem implementar. Pode divergir com boa justificativa.*

- **A intenção de cada assertiva, por extenso:**
  - Teste "proíbe número de teste na prosa e pede narração qualitativa": o contrato é *narre qualitativamente; um saneador remove qualquer número que você escrever*. Âncoras: `QUALITATIVELY` + `/saniti[sz]e\w*\b[^.]*\b(delete|remove)/is` (tolera `DELETE(S)`/`will delete`/`removes`).
  - Teste "trivialidade não rola; pedido do jogador passa por rollDice": dois contratos — *ação trivial não rola* (âncora `TRIVIAL actions NEVER roll`, que é um cabeçalho-contrato estável) e *pedido do jogador roteia por `rollDice`* (âncora `/PLAYER asks to roll/i` + `/rollDice/`). O exemplo pt-BR (`rolo Percepção` vs `quero rolar`) **não** entra na assertiva.
- **Não sobre-endurecer.** Regex tolerante ≠ regex que casa qualquer coisa. Ainda deve **falhar** se a seção do saneador ou a regra de pedido-do-jogador for **removida** — é isso que o eval protege. Testar os dois lados: reescrita mantém verde; remoção da regra fica vermelha.
- **`ai-engine` roda do `dist`.** O eval importa `buildDmSystemPrompt` do pacote; se tocar em algo do builder (não deveria, aqui), `pnpm --filter @ai-dm/ai-engine build` antes. Para esta US, só o arquivo de eval muda — sem rebuild.
- **Rodar `pnpm eval`** e confirmar verde (regra do projeto).

---

## Questões em aberto

1. **Os outros eval cases verbatim** (`us-23`, `us-38`, `us-39`, `us-40`, `us-41`, `us-42`, `dm-system.test.ts`, `guardrails.test.ts`) têm a **mesma fragilidade** e passam só porque a frase ainda não foi reescrita. Endereçar agora = reescrever teste verde (churn sem sinal). **Decisão:** deixar como **risco conhecido documentado**; reancorar caso-a-caso quando um quebrar (mesma lente desta US). Reavaliar se a taxa de quebra por reescrita de prompt virar recorrente — aí vale um helper compartilhado de asserção por intenção.
2. **Guard automático** que detecte "assertiva ancorada em frase volátil" antes de quebrar (ex.: lint que proíbe `toMatch` de string longa de prosa no prompt). Fica aberto — é ferramenta nova para uma dor ainda pontual; só vale se a #1 provar recorrência.

---

## Referências no código

- `evals/cases/us-29-rolagens.ts` — `:56-64` o bloco *"prompt endurece o gate de rolagem"* com as 2 assertivas a reancorar.
- `packages/ai-engine/src/prompts/dm-system.ts` — `:270` linha do saneador (`a sanitizer DELETES any number…`); `:271` regra do pedido do jogador (`If the PLAYER asks to roll ("rolo Percepção")…`). **Fonte de verdade do texto atual — não muda nesta US.**
- `packages/ai-engine/src/rubric-drift.test.ts` — `REVIEWED_CRAFT_HASH`: o precedente da US-36 de guard de drift por hash, escopado a UMA seção (por que não se generaliza aqui — ver Fora do escopo).
- Commits: `08f9908` (introduziu prompt + teste com frase literal), `e0a6817` (reescreveu o prompt e quebrou o teste) — a evidência da causa-raiz.
