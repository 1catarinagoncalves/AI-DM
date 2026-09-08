# US-222 — Salvaguardas de classe na ficha do personagem

**Épico:** 1 — Personagem
**Fase:** 1 — MVP single-player
**Status:** 🚧 Em progresso
**Depende de:** [US-209](./US-209-hit-dice-e-salvaguardas-de-classe-no-config.md) (`config.classes[].savingThrows` — 2 chaves canônicas de atributo por classe, já ingeridas nos dois locales; esta story é o primeiro CONSUMIDOR do campo) · [US-27](./US-27-pericias-do-personagem.md) (`buildSkillSheet`/`skillModifier` em `packages/shared/src/ability.ts` — fórmula de modificador + proficiência que esta story espelha para salvaguarda) · [US-100](./US-100-ficha-do-personagem-no-locale-ativo.md) (a ficha lê chave e resolve rótulo no locale ativo — salvaguarda segue o mesmo caminho, sem texto novo por idioma) · [US-127](./US-127-revisao-espelha-ficha-completa.md) (revisão do wizard espelha a ficha — a seção aparece nas duas de graça)
**Relacionado:** [US-204](./US-204-wizard-em-duas-colunas-com-ficha-viva.md) (`GameView.tsx` — onde a seção "Perícias" já vive, precedente direto de layout) · [US-110](./US-110-tabela-de-testes-de-habilidade-do-srd-2024.md) e [US-111](./US-111-classe-de-dificuldade-do-srd-2024.md) (tool de TESTE de salvaguarda contra DC — **fora do escopo**, `rollDice` ainda não tem `kind` de teste, mesma lacuna que a US-209 já registrou)
**Criada em:** 2026-09-08

---

## História

> **Como** jogadora,
> **quero** ver na minha ficha quais salvaguardas minha classe torna proficientes, com o modificador já calculado,
> **para que** eu saiba de cabeça em quais testes de resistência meu personagem é bom, do mesmo jeito que já vejo isso pra perícias.

---

## Contexto e motivação

### O dado existe desde a US-209 — ninguém lê

`config.classes[].savingThrows` traz, para as 13 classes jogáveis, as 2 chaves canônicas de atributo em que a classe é proficiente (ex. `barbarian` → `["constitution","strength"]`). A US-209 deliberadamente só disponibilizou o dado no config — nenhum consumidor foi escrito. Hoje `savingThrows` não aparece em lugar nenhum do produto: nem na ficha (`GameView.tsx`), nem na revisão do wizard (`SetupWizard.tsx`), nem no prompt do Mestre.

### Diferença central para perícias (US-27): não há escolha, é sempre as 6 linhas

Perícia tem catálogo grande (18 no SRD) e o jogador ESCOLHE um subconjunto proficiente na etapa `skills`. Salvaguarda no 5e é sempre as **6 habilidades** (força, destreza, constituição, inteligência, sabedoria, carisma) — a classe fixa quais 2 são proficientes, sem escolha do jogador em nível 1. Isso simplifica o escopo: não há etapa de wizard nova, não há `CreateCharacterSchema` novo, não há `CharacterService` novo — `Character.class` já existe, e `config.classes` já traz `savingThrows` por classe. É leitura pura, o mesmo formato que `attributes` já resolve em `GameView.tsx` (seis blocos fixos), com a marca de proficiência que `skills` já resolve.

### Onde a ficha já faz as duas metades separadamente

- `GameView.tsx:506-523` — seção "Atributos": 6 blocos fixos (`ATTR_LABELS`), mostrando `formatModifier(abilityModifier(value))` por atributo. Sem proficiência.
- `GameView.tsx:525-543` — seção "Perícias": lista de `ResolvedSkill` (`buildSkillSheet`, `packages/shared/src/ability.ts:56`), com bolinha de proficiência + modificador.
- Salvaguarda é o cruzamento das duas: 6 linhas fixas como Atributos, com a marca de proficiência + bônus como Perícias.

---

## Escopo

### Dentro do escopo

- **`packages/shared/src/ability.ts`:** função nova `buildSavingThrowSheet`, irmã de `buildSkillSheet` — mesma fórmula (`abilityModifier(score) + (proficient ? proficiencyBonus : 0)`), mas iterando sobre `config.attributes` (sempre as 6, nunca um subconjunto escolhido) em vez de um catálogo de perícia:
  ```ts
  export interface ResolvedSavingThrow {
    key: string
    label: string
    modifier: number
    proficient: boolean
  }

  export function buildSavingThrowSheet(
    attributes: { key: string; label: string }[],
    scores: Record<string, number>,
    proficientKeys: string[] | undefined,
    proficiencyBonus: number,
  ): ResolvedSavingThrow[]
  ```
  Chave de atributo ausente de `scores` cai em 10 (mesma rede de segurança de `buildSkillSheet`, nunca crasha). `proficientKeys` ausente (classe sem `savingThrows` no config — artefato pré-US-209, ou sistema `Free`) devolve as 6 linhas com `proficient: false` em todas — nunca omite a seção.
- **`apps/web/src/app/play/[adventureId]/page.tsx`:** ao lado do cálculo de `skills` (linha ~44), calcula `savingThrows = buildSavingThrowSheet(config.attributes, attrs, config?.classes?.find(c => c.key === charClass)?.savingThrows, config?.proficiency?.bonus ?? 2)` e passa como prop nova pro `GameView`.
- **`GameView.tsx`:** prop `savingThrows?: ResolvedSavingThrow[]` nova; seção "Salvaguardas" nova, entre "Atributos" (linha 506) e "Perícias" (linha 525) — mesma ordem do PHB (atributo → salvaguarda → perícia) e mesmo componente visual de "Perícias" (bolinha de proficiência + `formatModifier`), sem grade de 3 colunas (a de Atributos) nem scroll (só 6 linhas, cabe sem `max-h`).
- **`SetupWizard.tsx` (revisão):** mesma adição que a US-220 fez para `reviewSkills` (linha ~561) — `reviewSavingThrows = buildSavingThrowSheet(...)` com os dados já disponíveis na tela (classe escolhida, atributos da etapa, `config.classes`), exibido na revisão espelhando a ficha (US-127).
- **Chaves de mensagem novas** (`pt-BR`/`en-US`): `game.savingThrows` (título da seção) — mesmo padrão de `game.skills`/`game.attributes`.
- **Testes:** `ability.test.ts` cobre `buildSavingThrowSheet` — classe com `savingThrows` (2 proficientes, 4 não), classe/config sem `savingThrows` (todas não-proficientes, sem crash), atributo ausente de `scores` (cai em 10).

### Fora do escopo

- **Tool de TESTE de salvaguarda contra DC** ([US-110](./US-110-tabela-de-testes-de-habilidade-do-srd-2024.md)/[US-111](./US-111-classe-de-dificuldade-do-srd-2024.md)) — `rollDice` não tem `kind` de teste; ensinar a ficha sobre o BÔNUS sem a tool poder ROLAR é exatamente a lacuna que a US-209 já apontou e não é fechada aqui. Esta story é leitura passiva, igual a como `skills` já mostra modificador sem ninguém poder "rolar Furtividade" pela ficha hoje.
- **Salvaguarda escalando com nível/subclasse/feature.** Nível 1 fixo, mesma simplificação de `proficiency.bonus` (+2 fixo) que `skillModifier` já assume — sem level-up nesta fase (ver `ponytail` em `ability.ts:60`).
- **Traço de subclasse/feição que adiciona salvaguarda extra** (ex. algumas subclasses de Fighter/`Diamond Soul` do Monk lendário). Nenhuma das 13 classes jogáveis do catálogo atual tem isso nas features já ingeridas — sem dado, sem story.
- **Prompt do Mestre (`packages/ai-engine`).** O Mestre já não rola salvaguarda hoje (sem a tool da US-110/111); não há motivo pra ele saber o bônus antes de poder usá-lo.
- **Sistema `Free`.** Sem `config.classes[].savingThrows`, cai no fallback "todas não-proficientes" — sem crash, sem seção especial.

---

## Modelo de dados proposto

Nenhuma mudança de schema — `config.classes[].savingThrows` (US-209) e `config.attributes` (existente) já bastam. Só função de leitura nova:

```ts
// packages/shared/src/ability.ts
export interface ResolvedSavingThrow {
  key: string
  label: string
  modifier: number
  proficient: boolean
}

export function buildSavingThrowSheet(
  attributes: { key: string; label: string }[],
  scores: Record<string, number>,
  proficientKeys: string[] | undefined,
  proficiencyBonus: number,
): ResolvedSavingThrow[] {
  const proficient = new Set(proficientKeys ?? [])
  return attributes.map((a) => {
    const isProficient = proficient.has(a.key)
    return {
      key: a.key,
      label: a.label,
      proficient: isProficient,
      modifier: skillModifier(scores[a.key] ?? 10, isProficient, proficiencyBonus),
    }
  })
}
```

**Persistência:** nenhuma. `Character.class` (já existe) + `config.classes[].savingThrows` (US-209) + `state.attributes`/`baseAttributes` (já existem) bastam para derivar a seção inteira em tempo de leitura — mesmo espírito de `buildSkillSheet`.

---

## Critérios de aceite

- [ ] `buildSavingThrowSheet` devolve as 6 salvaguardas (uma por `config.attributes`), com `proficient: true` nas 2 que `config.classes[].savingThrows` da classe do personagem lista, e modificador = `abilityModifier(atributo) + bônus de proficiência` quando proficiente.
- [ ] Classe sem `savingThrows` no config (artefato pré-US-209) ou sistema sem `config.classes` (`Free`) → as 6 linhas aparecem com `proficient: false`, sem erro, sem seção ausente.
- [ ] Atributo ausente de `attributes`/`state.attributes` cai em 10 no cálculo (mesma rede de `buildSkillSheet`), nunca lança.
- [ ] A ficha (`GameView.tsx`) mostra a seção "Salvaguardas" entre Atributos e Perícias, com bolinha de proficiência + modificador com sinal, para as 6 habilidades.
- [ ] A revisão do wizard (`SetupWizard.tsx`) mostra a mesma seção, espelhando a ficha (US-127) — mesmos valores que a ficha final vai exibir.
- [ ] Chave `game.savingThrows` presente nos dois locales (pt-BR/en-US).
- [ ] **Eval/teste de regressão:** `ability.test.ts` cobre classe com `savingThrows`, classe/config sem o campo, e atributo ausente do mapa de scores.

---

## Notas de implementação

- **Não duplicar `skillModifier`** ([ability.ts:39](../../../packages/shared/src/ability.ts:39)) — `buildSavingThrowSheet` reusa a mesma função que `buildSkillSheet` já usa; a única diferença é iterar `config.attributes` (6 fixas) em vez de um catálogo de perícia com proficiência selecionada pelo jogador.
- **Ordem da seção na ficha:** Atributos → Salvaguardas → Perícias, ordem canônica de ficha 5e (a salvaguarda deriva do atributo, a perícia deriva do atributo + tem catálogo próprio maior). `GameView.tsx` já tem as duas pontas (linhas 506 e 525); a seção nova entra no meio.
- **Sem `max-h`/scroll na lista nova** — ao contrário de Perícias (18 entradas, scrollável), Salvaguardas são sempre 6, cabem sem overflow.

---

## Referências no código

- [packages/shared/src/ability.ts:56](../../../packages/shared/src/ability.ts:56) — `buildSkillSheet`, precedente direto de `buildSavingThrowSheet`.
- [packages/shared/src/types/system.ts:113](../../../packages/shared/src/types/system.ts:113) — `ClassCatalogEntrySchema.savingThrows`, o dado já disponível desde a US-209.
- [apps/web/src/app/play/[adventureId]/page.tsx:41-45](../../../apps/web/src/app/play/[adventureId]/page.tsx:41) — onde `skills` é calculado hoje; `savingThrows` entra ao lado.
- [apps/web/src/components/game/GameView.tsx:506-543](../../../apps/web/src/components/game/GameView.tsx:506) — seções "Atributos" e "Perícias", entre as quais a seção nova se encaixa.
- [apps/web/src/components/setup/SetupWizard.tsx:561](../../../apps/web/src/components/setup/SetupWizard.tsx:561) — `reviewSkills`, precedente direto de `reviewSavingThrows` na revisão.
