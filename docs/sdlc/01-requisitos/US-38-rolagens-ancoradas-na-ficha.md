# US-38 — Rolagens ancoradas na ficha (modificador vem da perícia, um teste por ação)

**Épico:** 3 — Narração e mecânica
**Fase:** 1 — MVP single-player
**Status:** 🚧 Em progresso
**Depende de:** [US-27](./US-27-pericias-do-personagem.md) (o modificador de cada perícia — `buildSkillSheet`/`skillModifier` — é a fonte da verdade que a rolagem deve usar) · [US-09](#) (rolagem transparente do Game Server) · [US-29](./US-29-saneamento-de-rolagens-ficticias.md) (bloco de rolagem exibido antes da narração; um teste por ação reforça o "uma narração por turno")
**Alimenta:** [US-29](./US-29-saneamento-de-rolagens-ficticias.md) (o número do bloco passa a ser sempre coerente com a ficha) · [US-23](./US-23-dm-ciente-da-ficha.md) (a ficha injetada deixa de ser decorativa — vira a fonte real do modificador)
**Criada em:** 2026-07-08

---

## História

> **Como** jogador,
> **quero** que cada rolagem de teste use o modificador **real da minha ficha** (a perícia/atributo testado) e que uma ação gere **um único** teste,
> **para que** eu não veja um `+6` que nenhuma perícia minha dá, nem duas rolagens para a mesma coisa.

---

## Contexto e motivação

### O problema observado

Numa sessão real (Lyra seguindo pegadas na floresta), o turno produziu **duas** rolagens para a **mesma** ação:

```
🎲 Lyra tenta seguir as pegadas ...   1d20+6:  [9] +6 = 15
🎲 Percepção para seguir as pegadas   1d20 + 5: [17] +5 = 22
```

Dois defeitos:

1. **Modificador impossível (`+6`).** A ficha de Lyra tem no máximo `+5` (Furtividade proficiente: DES 16 → +3, +2 de proficiência). Nenhuma perícia dela dá `+6`. O `+6` foi **inventado** pelo modelo — não corresponde a atributo nem perícia nenhuma.
2. **Dois testes para uma ação.** "Seguir as pegadas" é **um** teste (Percepção/Sobrevivência). O modelo rolou uma versão genérica ("seguir as pegadas", +6) **e** a versão nomeada ("Percepção", +5) — redundante e contraditório (15 vs 22).

### Por que a solução atual não basta

A tool `rollDice` recebe a **fórmula como texto livre do modelo**:

```ts
// apps/api/src/ai/ai.service.ts
parameters: z.object({
  formula: z.string().describe('e.g. "1d20+5" or "2d6+3"'),
  reason: z.string().describe('Why this roll is happening'),
}),
execute: async ({ formula }) => this.dice.roll(formula) // ← +6 vem do modelo, não da ficha
```

O modificador é **o que o LLM escrever**. Nada o confronta com a ficha — o `DiceService` só faz o parse de `"1d20+6"` e rola. Ao mesmo tempo, o serviço **já tem** o modificador real de cada perícia no mesmo escopo (`buildSkillSheet(...)`, `ai.service.ts:106-109`) e os atributos (`ai.service.ts:104`), mas essa informação **não é usada** na hora de rolar — só é injetada no prompt como texto (US-27/US-23), que o modelo pode ignorar.

Sobre o número de rolagens: `maxSteps: 5` (`ai.service.ts:305`) permite várias tool calls por turno — necessário para casos legítimos (ataque + dano), mas nada impede o modelo de rolar **o mesmo teste duas vezes**.

A [US-29](./US-29-saneamento-de-rolagens-ficticias.md) tornou a rolagem **visível** e tirou os números inventados **da prosa** — mas o número dentro do **bloco de rolagem** continua vindo da fórmula livre do modelo. US-29 garante "o jogador só vê a rolagem do sistema"; US-38 garante "a rolagem do sistema usa o modificador certo, uma vez".

### A proposta

**Ancorar o modificador na ficha.** A `rollDice` deixa de aceitar um modificador livre para **testes**: o modelo diz **o que** está sendo testado (a `key` de uma perícia ou de um atributo), e o **Game Server** resolve o modificador real via `buildSkillSheet`/`abilityModifier` — os mesmos helpers da US-27. Um `+6` que nenhuma perícia dá deixa de ser representável.

**Um teste por ação.** Reforço no prompt (escolher **uma** perícia e rolar **uma** vez) + uma guarda no servidor que **deduplica** testes repetidos da mesma perícia/atributo no mesmo turno (o segundo reusa o resultado do primeiro, não rola de novo). Ataque + dano continuam válidos (perícias/dados diferentes), mas "Percepção" duas vezes vira uma.

---

## Escopo

### Dentro do escopo

- **Novo contrato de `rollDice` para testes**: parâmetros `{ skill?: string, ability?: string, dice?: string, reason: string }`.
  - `skill` = `key` de uma perícia do `config.skills`; `ability` = `key` de um atributo. O modelo passa **um** dos dois para um teste.
  - `dice` = só o **dado base** (default `'1d20'`), sem modificador. Qualquer `+N` que o modelo tente embutir no dado é **ignorado**.
  - O servidor calcula `modifier` a partir da ficha (perícia via `buildSkillSheet`; atributo via `abilityModifier(attributes[ability])`) e rola `dice + modifier` no `DiceService`. O `reason` continua como rótulo do bloco (US-29).
- **Modificador impossível deixa de existir**: como o `+N` nunca vem do modelo para um teste, não há como aparecer um bônus que a ficha não dá. Se o modelo não informar `skill`/`ability` (ou informar uma `key` inexistente), o modificador é **0** (rolagem "crua") — nunca um número inventado.
- **Uma rolagem por teste (dedupe no servidor)**: guarda por turno que coalesce chamadas de `rollDice` para a **mesma** `skill`/`ability` — a segunda devolve o resultado da primeira (não gera novo dado nem novo bloco). Ataque + dano (chaves diferentes / dado sem perícia) não são afetados.
- **Prompt**: instruir o modelo a (a) escolher **uma** perícia/atributo por teste e passar sua `key` (não uma fórmula), (b) rolar **uma** vez por ação — nunca uma versão "genérica" além da nomeada.
- **Coerência do bloco (US-29) e do log (`DICE_ROLL`)**: o modificador exibido e persistido é sempre o da ficha.
- **Eval**: casos determinísticos de que a resolução do modificador bate com `buildSkillSheet` (ex.: Furtividade DES 16 proficiente → +5; Percepção SAB 16 → +3) e de que rolar a mesma perícia duas vezes num turno produz **um** resultado.

### Fora do escopo

- **Rolagens que não são teste de perícia/atributo** (dano de arma `2d6+3`, dados de cura) — continuam por fórmula, pois o `+3` é um modificador de arma/efeito, não de ficha. A ancoragem vale para **testes** (d20 + perícia/atributo). Um dado que não é d20 e não traz `skill`/`ability` é tratado como rolagem crua.
- **Vantagem/desvantagem, inspiração, cobertura, dificuldade (CD) do teste** — mecânicas de resolução mais ricas; story futura. Aqui só garantimos o **modificador** e a **contagem**.
- **Escolher qual perícia se aplica a cada ação** (Percepção vs Sobrevivência para rastrear) — continua julgamento do mestre (prompt). US-38 garante que, escolhida a perícia, o modificador é o certo e o teste é único.
- **Bloqueio duro de "um dado por turno"** — quebraria ataque+dano. A guarda é por **mesma perícia/atributo**, não por contagem total.

---

## Design do novo contrato

```ts
// apps/api/src/ai/ai.service.ts — rollDice
parameters: z.object({
  reason: z.string().describe('Short label for the roll, e.g. "Percepção para seguir as pegadas"'),
  skill: z.string().optional().describe('Key of the tested skill (e.g. "perception"). The system supplies the modifier.'),
  ability: z.string().optional().describe('Key of the tested attribute (e.g. "dexterity") when no skill applies.'),
  dice: z.string().optional().describe('Base die only, default "1d20". Any modifier here is IGNORED.'),
}),
execute: async ({ reason, skill, ability, dice }) => {
  const base = normalizeDie(dice) // extrai só "NdM", descarta qualquer "+N"
  const modifier = resolveModifier({ skill, ability, skillSheet, attributes }) // ← ficha, não modelo
  // dedupe: mesma skill/ability já rolada neste turno → devolve o resultado anterior
  const result = this.dice.roll(`${base}${modifier >= 0 ? '+' : ''}${modifier}`)
  // ... log DICE_ROLL + retorno com reason (US-29)
}
```

- `resolveModifier`:
  - `skill` → `buildSkillSheet(config.skills, attributes, character.skills, bonus).find(s => s.key === skill)?.modifier`
  - senão `ability` → `abilityModifier(attributes[ability])`
  - senão → `0` (rolagem crua; nunca um `+N` do modelo)
  - `key` inexistente → `0` + `console.warn` (degradação tolerante, como US-27/US-23).
- **Dedupe**: um `Map<skill|ability, DiceResult>` no escopo do turno; chave repetida devolve o valor guardado (sem novo `DiceService.roll`, sem novo evento `DICE_ROLL`, sem novo frame `D:`).
- **`normalizeDie`**: aceita `NdM` (ex.: `1d20`, `2d6`); descarta qualquer sufixo `[+-]N`. Ausente/ inválido → `1d20`.

---

## Critérios de aceite

- [ ] `rollDice` **não** aceita mais um modificador livre para testes: recebe `skill`/`ability` (`key`) e, opcionalmente, o dado base; o modificador é resolvido pelo **Game Server** a partir da ficha. (`ai.service.ts`)
- [ ] O modificador de um teste de perícia é **exatamente** o de `buildSkillSheet` (US-27). Ex.: Furtividade com DES 16 proficiente → `+5`; Percepção com SAB 16 não-proficiente → `+3`. (eval)
- [ ] Um teste de atributo sem perícia usa `abilityModifier(attributes[ability])`. Ex.: DES 16 → `+3`. (eval)
- [ ] Um `+6` (ou qualquer bônus que a ficha não dá) é **impossível** de aparecer num teste: o modelo não fornece o modificador. Uma `key` inexistente ou ausente cai para modificador `0`, nunca um número inventado. (`ai.service.ts` + eval)
- [ ] Rolar a **mesma** perícia/atributo duas vezes no mesmo turno produz **um** resultado (um dado, um bloco, um evento `DICE_ROLL`); a 2ª chamada reusa a 1ª. (`ai.service.ts` + teste)
- [ ] Ataque + dano (perícias/dados diferentes) **não** são coalescidos — continuam duas rolagens legítimas. (teste)
- [ ] O bloco de rolagem (US-29) e o evento `DICE_ROLL` persistido mostram sempre o modificador da ficha. (verificável no chat + `EventLog`)
- [ ] O prompt instrui: escolher **uma** perícia/atributo por teste (passar a `key`, não uma fórmula) e rolar **uma** vez por ação — sem versão genérica além da nomeada. (`dm-system.ts`)
- [ ] **Eval / teste de regressão (modificador):** tabela `(perícia|atributo, atributos) → modificador esperado` bate com `buildSkillSheet`/`abilityModifier`, incluindo o caso da imagem (Percepção +5 real, nunca +6). (`evals/cases/us-38-rolagens-ancoradas.ts`)
- [ ] **Eval / teste de regressão (dedupe):** duas chamadas de `rollDice` com a mesma `skill` no turno → um único `DiceResult`. (teste)

---

## Notas de implementação

- **Reusar a ficha já montada** (`ai.service.ts:104-109`): `attributes` e o resultado de `buildSkillSheet` já vivem no escopo de `streamChat`, logo acima da definição das tools. Passar o **sheet completo** (com `key`) para o `resolveModifier` — hoje o `.map` descarta a `key` (`:108`); manter a versão com `key` para o lookup e derivar a versão sem `key` só para o prompt.
- **`bonus` de proficiência**: usar `config.proficiency?.bonus ?? 2`, o mesmo default da US-27. (Com level-up futuro, derivar do nível — a assinatura de `skillModifier` já isola isso.)
- **Dedupe por turno**: um `Map` local criado por chamada de `streamChat` (uma instância por turno), capturado no closure das tools. Chave = `skill ?? 'ability:' + ability`. Não persistir entre turnos.
- **`DiceService` inalterado**: continua recebendo `"1d20+5"` — só que o `+5` agora é sempre da ficha. A montagem da fórmula (base + modificador real) fica no `execute`.
- **Compatibilidade com US-29**: o frame `D:` e o `reason`/label não mudam; só a **origem** do número muda. O saneador de prosa (US-29) segue igual.
- **Degradação**: `skill`/`ability` inexistente → `0` + `console.warn` (telemetria de modelo passando chave errada, insumo para US-17), nunca crash.
- **Todo teste é ancorado (princípio):** um teste de d20 só acontece em **evento relevante para o personagem** e está **sempre** ligado a uma perícia ou atributo (é o que dá o modificador). Não existe "teste sem perícia": ação trivial não rola (US-29) e desafio real sempre mapeia numa perícia/atributo. O modelo **deve sempre** informar `skill` ou `ability`; uma chamada de teste sem anchor é **misfire** (modificador `0` + `console.warn`, para não travar um desfecho já prometido), nunca rolagem normal.
- **Dedupe é rede de proteção, não escolha de design:** rolar a mesma perícia duas vezes na mesma ação **não deveria acontecer** — a guarda só existe contra o modelo desobedecer (como na imagem que originou esta story) e nunca dispara em jogo normal. Comportamento fixo: a 2ª chamada da mesma `skill`/`ability` reusa silenciosamente o 1º resultado (um dado, um bloco).
- **`normalizeDie` não limita o catálogo de dados:** aceita `NdM` genérico (o `DiceService` já valida o formato); só descarta o sufixo `[+-]N`. Sem restrição a d4–d20.

---

## Referências no código

- `apps/api/src/ai/ai.service.ts` — `rollDice` (`:136-155`): novo contrato `{ skill, ability, dice, reason }` + `resolveModifier` + dedupe por turno. A ficha (`attributes` `:104`, `buildSkillSheet` `:106-109`) já está no escopo.
- `packages/shared/src/ability.ts` — `buildSkillSheet`/`skillModifier`/`abilityModifier` (US-27/US-32): a fonte do modificador, reusada sem duplicar.
- `apps/api/src/game/dice.service.ts` — `DiceService.roll` (RNG cripto): inalterado; recebe a fórmula já com o modificador da ficha.
- `packages/ai-engine/src/prompts/dm-system.ts` — regras de rolagem (US-29, `:127-138`): instruir `key` de perícia/atributo (não fórmula) e um teste por ação.
- `evals/cases/us-38-rolagens-ancoradas.ts` — **novo**: modificador ancorado na ficha + dedupe.

### Relação com US-29

US-29 garante que o jogador **só vê a rolagem do sistema** (nada inventado na prosa) e a exibe antes da narração. US-38 garante que **essa rolagem do sistema usa o modificador certo, uma vez**. Juntas: todo número que o jogador vê é do sistema **e** coerente com a ficha.
