# US-27 — Perícias do personagem (proficiências na criação + modificadores na ficha)

**Épico:** 1 — Personagem
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** [US-21](./US-21-sistemas-como-dado.md) (perícias vêm do `System.config`, não hardcoded) · [US-26](./US-26-criacao-personagem-em-etapas.md) (entrega o *slot* da etapa "Perícias"; esta story preenche o conteúdo) · [US-32](../../../packages/shared/src/ability.ts) (modificador de atributo — `abilityModifier`, reusado no cálculo)
**Alimenta:** [US-02](./US-02-inventario-do-personagem.md) / [US-19](./US-19-estado-de-ficha-via-api.md) (ficha exibe todas as perícias com modificador) · [US-23](./US-23-dm-ciente-da-ficha.md) (todas as perícias com modificador injetadas no DM)
**Criada em:** 2026-07-08

---

## História

> **Como** jogador,
> **quero** escolher, na criação, duas perícias como **proficientes** (dentro do orçamento do sistema), e ver na ficha **todas** as perícias com o modificador certo — derivado do modificador de atributo e da proficiência,
> **para que** o personagem tenha competências concretas que o mestre leve em conta na narração e nos testes.

---

## Contexto e motivação

### O problema observado

A etapa de **Perícias** entregue pela [US-26](./US-26-criacao-personagem-em-etapas.md) é **interina**: três `<input>` de texto livre onde o jogador digita nomes soltos ("escalar", "mentir bem"). Consequências:

- **Não é dado do sistema.** As perícias não vêm do `System.config` — contrariam a [US-21](./US-21-sistemas-como-dado.md) ("sistema como dado"). Não há lista fechada nem vínculo com atributo.
- **Não têm mecânica.** Texto livre não vira modificador. O mestre não sabe se "escalar" é bom ou ruim, nem em que atributo se apoia.
- **Não aparecem na ficha com número.** A ficha ([US-02](./US-02-inventario-do-personagem.md)/[US-19](./US-19-estado-de-ficha-via-api.md)) não mostra perícias, muito menos o modificador de cada uma.

### A regra (D&D 5e, aplicável ao Free)

Perícias em 5e são um conjunto fixo de **18**, cada uma **ancorada num atributo** (fonte: [Wargamer — D&D skills](https://www.wargamer.com/dnd/skills)). O bônus de uma perícia é:

```
mod(perícia) = abilityModifier(valor do atributo-âncora)
             + (proficiente ? bônus de proficiência : 0)
```

- **`abilityModifier`** já existe no projeto (`floor((valor − 10) / 2)`, [US-32](../../../packages/shared/src/ability.ts)) — a mesma regra para D&D e Free.
- **Bônus de proficiência = +2** no nível 1 (é o que a Fase 1 usa; em 5e ele escala com o nível, mas todo personagem é criado no nível 1 — ver [US-26 Q#5](./US-26-criacao-personagem-em-etapas.md)).
- Na criação, o jogador marca **2** perícias como proficientes (orçamento do sistema).

O mapeamento perícia → atributo é **idêntico** nos dois sistemas (Free reusa o config do D&D, como já faz com atributos/kits/point-buy — `seed.ts:206-214`). Constituição não tem perícia associada.

### A proposta

Modelar as perícias como **dado no `System.config`** (lista fechada `{ key, label, ability }` + orçamento de proficiências), exatamente como atributos e point-buy já são. A etapa de Perícias troca os 3 inputs livres por essa lista com seleção de **exatamente 2** proficientes; a ficha renderiza **todas** as 18 com o modificador calculado; o DM recebe as proficientes via o mecanismo dirigido por dados da [US-23](./US-23-dm-ciente-da-ficha.md).

---

## Escopo

### Dentro do escopo

- **Perícias como dado no `SystemConfig`**: campo novo `skills: { key, label, ability }[]` + `proficiency: { choices, bonus }`, seedados no D&D 5e **e** no Free com as mesmas 18 perícias, `choices: 2`, `bonus: 2`.
- **Etapa de Perícias (US-26) real**: substitui os 3 inputs livres por uma lista das perícias do config, cada uma mostrando o atributo-âncora; o jogador marca **exatamente `proficiency.choices` (2)** como proficientes. "Próximo" bloqueado enquanto ≠ 2.
- **Persistência**: `Character.skills` (lista das *keys* proficientes) gravado por `createCharacter`. Perícias não-proficientes **não** se persistem — derivam da lista do config.
- **Cálculo de modificador**: helper puro `skillModifier(abilityScore, isProficient, proficiencyBonus)` em `packages/shared` (reusa `abilityModifier`), com teste.
- **Ficha ([US-02](./US-02-inventario-do-personagem.md)/[US-19](./US-19-estado-de-ficha-via-api.md))**: mostra **todas** as 18 perícias agrupadas/rotuladas, cada uma com seu modificador formatado (`formatModifier`) e um marcador visual de proficiência.
- **Injeção no DM ([US-23](./US-23-dm-ciente-da-ficha.md))**: **todas** as 18 perícias, com o modificador de cada uma e a marca de proficiência, entram no bloco read-only da ficha, pela iteração dirigida por dados já existente (sem novo `if` no builder). O mestre precisa da tabela completa para decidir qualquer teste (não só onde o personagem é proficiente).

### Fora do escopo

- **Rolagem de teste de perícia** (o mestre pedir "role Percepção" e o Game Server somar o modificador) — mecânica de turno, story futura. Esta só entrega o *dado* (o modificador correto na ficha e no prompt).
- **Proficiências vindas de raça/classe/background** (5e concede algumas automaticamente). Fase 1: só as 2 escolhidas manualmente. Config já permite evoluir (`proficiency.choices` por-sistema).
- **Escala do bônus de proficiência por nível** — fixo em +2 (nível 1). Quando houver level-up, vira função do nível; hoje é constante no config.
- **Expertise / meia-proficiência** (dobrar o bônus) — não existe na Fase 1.

---

## Modelo de dados proposto

### `SystemConfig` (novo, opcional — `packages/shared/src/types/system.ts`)

```ts
export const SystemSkillSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  ability: z.string().min(1), // chave de um atributo do próprio config (ex.: 'dexterity')
})

// dentro de SystemConfigSchema:
skills: z.array(SystemSkillSchema).optional(),
proficiency: z.object({
  choices: z.number().int().min(0), // quantas proficiências o jogador escolhe na criação
  bonus:   z.number().int(),        // bônus somado a uma perícia proficiente (+2 na Fase 1)
}).optional(),
```

- **Ausente → sem etapa de perícias** (compatível com sistemas/uploads futuros sem perícias). A etapa some ou fica read-only, como o point-buy ausente cai no modo livre ([US-26](./US-26-criacao-personagem-em-etapas.md)).
- `ability` deve referenciar uma `key` existente em `attributes` (validável num `.refine`; sem match → modificador cai para o atributo cru/0, nunca crasha — mesma tolerância da [US-23](./US-23-dm-ciente-da-ficha.md) §"rótulos").

### `Character` (Prisma — `apps/api/prisma/schema.prisma`)

```prisma
model Character {
  // ...
  skills Json @default("[]")   // string[] de keys de perícia proficientes
}
```

Só as **proficientes** são persistidas (2 keys). As demais são derivadas do `config` no momento de exibir/injetar. Migração aditiva com default `[]` — não invalida personagens existentes.

### As 18 perícias (seed, compartilhado Free + D&D 5e)

| Perícia (label) | key | Atributo-âncora (`ability`) |
|---|---|---|
| Atletismo | `athletics` | `strength` |
| Acrobacia | `acrobatics` | `dexterity` |
| Prestidigitação | `sleight_of_hand` | `dexterity` |
| Furtividade | `stealth` | `dexterity` |
| Arcanismo | `arcana` | `intelligence` |
| História | `history` | `intelligence` |
| Investigação | `investigation` | `intelligence` |
| Natureza | `nature` | `intelligence` |
| Religião | `religion` | `intelligence` |
| Adestrar Animais | `animal_handling` | `wisdom` |
| Intuição | `insight` | `wisdom` |
| Medicina | `medicine` | `wisdom` |
| Percepção | `perception` | `wisdom` |
| Sobrevivência | `survival` | `wisdom` |
| Enganação | `deception` | `charisma` |
| Intimidação | `intimidation` | `charisma` |
| Atuação | `performance` | `charisma` |
| Persuasão | `persuasion` | `charisma` |

Constituição não ancora nenhuma perícia (regra 5e). Total: **18**.

---

## Critérios de aceite

- [x] `SystemConfig` aceita `skills[]` (`key`/`label`/`ability`) e `proficiency` (`choices`/`bonus`); Free e D&D 5e são seedados com as **18 perícias**, `choices: 2`, `bonus: 2`. (`system.ts`, `seed.ts`)
- [x] A etapa de **Perícias** ([US-26](./US-26-criacao-personagem-em-etapas.md)) lista as perícias do config (com o atributo-âncora visível) e deixa marcar proficientes; **Próximo** só libera com **exatamente 2** marcadas. (verificado no browser: 0/2 bloqueado → 2/2 libera)
- [x] A antiga entrada de **3 perícias em texto livre** (interina da US-26) é removida.
- [x] `createCharacter` persiste `Character.skills` = as 2 keys proficientes; recarregar o personagem devolve as mesmas 2. (`character.service.ts` + teste)
- [x] Existe `skillModifier(abilityScore, isProficient, proficiencyBonus)` puro em `packages/shared`, reusando `abilityModifier`, com teste unitário. (`ability.ts`, `ability.test.ts`)
- [x] A **ficha** exibe **todas** as 18 perícias, cada uma com o modificador formatado (`+3`, `0`, `-1`) e um marcador de proficiência nas 2 escolhidas. (verificado no browser: Furtividade +5●, Percepção +2●)
- [x] O modificador de uma perícia **proficiente** = `abilityModifier(atributo) + 2`; de uma **não-proficiente** = `abilityModifier(atributo)`. (Ex.: Destreza 16 → Acrobacia proficiente = +5; não-proficiente = +3.)
- [x] **Todas** as 18 perícias, com modificador e marca de proficiência, aparecem no bloco read-only da ficha injetado no DM ([US-23](./US-23-dm-ciente-da-ficha.md)), sem editar a lógica de render do `buildDmSystemPrompt`. (`dm-system.ts` + eval `us-27-pericias.ts`)
- [x] `skills`/`proficiency` **ausentes** no config → a etapa de Perícias não bloqueia e a ficha não quebra (sistema sem perícias é válido). (`skillChoices === 0` → etapa livre; `skills` undefined → linha omitida)
- [x] **Eval / teste de regressão (cálculo):** tabela de casos `(atributo, proficiente?) → modificador esperado` passa, incluindo valores ímpares (13 → +1) e proficiência (13 proficiente → +3). (`ability.test.ts`)
- [x] **Eval / teste de regressão (criação):** marcar 1 ou 3 perícias mantém **Próximo** bloqueado; marcar exatamente 2 libera e persiste as duas keys. (`SetupWizard.test.tsx` + `character.service.test.ts`)

---

## Notas de implementação

- **Fonte única do mapa perícia→atributo:** o array de 18 vive no `seed.ts` (como `dnd5eAttributes`), reusado por `freeConfig` e `dnd5eConfig` — não duplicar. `key` em `snake_case` estável (é identificador persistido); `label` em PT-BR (é exibição).
- **Cálculo:** um helper ao lado de `abilityModifier` (`packages/shared/src/ability.ts`):

  ```ts
  export function skillModifier(abilityScore: number, proficient: boolean, proficiencyBonus: number): number {
    return abilityModifier(abilityScore) + (proficient ? proficiencyBonus : 0)
  }
  ```

  Formatar com o `formatModifier` já existente. Não persistir o número — derivar sempre do atributo atual (que pode mudar com level-up).
- **Etapa de Perícias (US-26):** trocar o `useState<string[]>` de 3 textos por um `Set<string>` de keys marcadas; `canAdvance('skills')` = `marcadas.size === config.proficiency.choices`. Renderizar a lista agrupada por atributo (ou plana com o atributo-âncora ao lado). Remover o `// TODO US-27` deixado no passo.
- **Ficha:** para cada perícia do `config.skills`, ler o valor do atributo `skill.ability` do estado (`characterState.attributes` → fallback `character.baseAttributes`) e calcular via `skillModifier`. `character.skills.includes(skill.key)` decide proficiência. Sem perícia proficiente com atributo faltante → `abilityModifier(undefined)` deve ser tratado (0), não crash.
- **Injeção no DM (US-23):** montar no `DmCharacterSheet` um grupo `skills` com as **18** já computadas — `{ label, modifier, proficient }` — e deixá-lo ser renderizado pela iteração genérica. Render compacto: uma linha só, `Skills: Percepção +5*, Furtividade +3, Atletismo +1, …` (`*` = proficiente), com o modificador já formatado. As 18 numa linha custam pouco e dão ao mestre a base de qualquer teste — o inverso da mitigação de bloat da [US-23 Q#3](./US-23-dm-ciente-da-ficha.md) vale aqui porque a tabela inteira é a informação útil, não ruído.
- **Validação `ability` órfão:** um `.refine` no `SystemConfigSchema` garantindo que todo `skill.ability` existe em `attributes[].key` pega erro de seed cedo. Em runtime, degradar para 0 se faltar (nunca derrubar a ficha).

---

## Questões em aberto (resolvidas)

1. **Guardar a lista completa de perícias na ficha ou só as proficientes?**
   **Decisão:** só as proficientes (2 keys) em `Character.skills`. As 18 e o mapa perícia→atributo são dado do sistema (`config`), derivados na hora de exibir/injetar. Persistir as 18 duplicaria o config em cada personagem.

2. **Injetar as 18 perícias com modificador no prompt do DM, ou só as proficientes?**
   **Decisão:** **todas as 18, com o modificador de cada uma.** O mestre pede testes de qualquer perícia (Percepção, Furtividade, Intuição…), não só das 2 proficientes — sem a tabela completa, ele não sabe o bônus de uma perícia não-proficiente e chuta. Injetar só as proficientes deixaria as outras 16 invisíveis para a decisão de dificuldade/resultado. Custo controlado: **uma linha** com todas as perícias e o modificador já formatado (`Percepção +5*, …`), não 18 linhas — barato e determinístico, e a proficiência vai marcada (`*`) na mesma string.

3. **`choices` e `bonus` no config ou constantes no código?**
   **Decisão:** no `config` (`proficiency.choices`/`bonus`), como o `pointBuy.budget` da [US-26](./US-26-criacao-personagem-em-etapas.md). Mantém "sistema como dado" ([US-21](./US-21-sistemas-como-dado.md)): um sistema com regra diferente (3 proficiências, bônus +3) é só outro seed, sem tocar em UI/serviço.

4. **Bônus de proficiência escala com o nível?**
   **Decisão:** não na Fase 1 — fixo em +2 (todo personagem é nível 1, [US-26 Q#5](./US-26-criacao-personagem-em-etapas.md)). Quando houver progressão, `skillModifier` recebe o bônus derivado do nível em vez do valor fixo do config; a assinatura já isola isso.

---

## Referências no código

- `packages/shared/src/types/system.ts` — `SystemConfigSchema`; onde entram `skills[]` e `proficiency`.
- `packages/shared/src/ability.ts` — `abilityModifier`/`formatModifier` (US-32); adicionar `skillModifier` ao lado.
- `apps/api/prisma/seed.ts` — `dnd5eAttributes`/`freeConfig`/`dnd5eConfig` (`:7-214`); adicionar o array das 18 perícias e o bloco `proficiency`.
- `apps/api/prisma/schema.prisma` — `model Character` (`:19-35`); campo `skills Json @default("[]")` + migração.
- `apps/web/src/components/setup/SetupWizard.tsx` — etapa `skills` interina (3 textos livres); substituir pela seleção fechada.
- `packages/ai-engine/src/prompts/dm-system.ts` — `buildDmSystemPrompt`, bloco "Character sheet" ([US-23](./US-23-dm-ciente-da-ficha.md)); recebe o grupo `skills` (as 18, com modificador + marca de proficiência) no `sheet`.
- `apps/api/src/ai/ai.service.ts` — monta o `DmCharacterSheet`; computa as 18 perícias (via `skillModifier`) e as passa ao builder.

### Referências externas (regras)

- [Wargamer — D&D 5e skills](https://www.wargamer.com/dnd/skills) — as 18 perícias e o atributo-âncora de cada uma; base do mapa perícia→atributo.
- [Ability Scores explained — Runic Dice](https://www.runicdice.com/blogs/news/dnd-5e-ability-scores-explained) — modificador de atributo e bônus de proficiência (regra reusada por `abilityModifier`/`skillModifier`).
