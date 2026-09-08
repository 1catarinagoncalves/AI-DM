# US-220 — Perícias proficientes concedidas por raça

**Épico:** 1 — Personagem
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** [US-131](./US-131-integracao-mecanica-background-proficiency.md) (par `findSkillGrant`/`applySkillGrant` + exclusão de perícia já concedida do pool de `skills`; esta story adiciona a raça como TERCEIRA fonte de perícia, o gatilho que a US-131 deixou explícito para revisitar a colisão — ver §Colisão) · [US-215](./US-215-proficiencias-de-arma-e-ferramenta-fixa-de-raca.md) (precedente direto: `RACE_TOOL_PROFICIENCIES` — grant FIXO de raça por mapa overlay em `@ai-dm/shared` + o padrão de ESCOLHA racial `raceToolChoice`/`DWARF_TOOL_PROFICIENCY_CHOICES`) · [US-142](./US-142-tracos-mecanicos-subespecie-srd-5-1.md) (`config.raceFeatures` — onde `keen-senses`/`menacing`/`skill-versatility` já vivem como texto awareness-only) · [US-27](./US-27-pericias-do-personagem.md) (`config.proficiency`/`validateSkills`/`buildSkillSheet`) · [US-205](./US-205-escolha-por-cartao-classe-e-raca.md) (etapa `race`, escolhida ANTES de `skills`) · [US-127](./US-127-revisao-espelha-ficha-completa.md) (revisão espelha a ficha — a perícia aparece nas duas de graça se entrar em `Character.skills`)
**Relacionado:** [US-100](./US-100-ficha-do-personagem-no-locale-ativo.md) (a ficha lê CHAVES resolvidas no locale ativo — perícia de raça segue o mesmo caminho, sem texto novo por idioma) · [ADR 004](../../adr/004-origem-do-dado-de-sistema.md) (origem do dado de sistema)
**Criada em:** 2026-09-07

---

## História

> **Como** jogador,
> **quero** que a raça que escolhi conceda de fato as perícias proficientes que ela dá no 5e (o Alto-elfo vê em Percepção, o Meio-orc intimida, o Meio-elfo é versátil),
> **para que** essa proficiência apareça marcada na etapa de Perícias da criação, e depois na revisão e na ficha — do mesmo jeito que a perícia do background (US-131) e a ferramenta de raça (US-215) já pesam na mecânica.

---

## Contexto e motivação

### O que o dataset realmente diz (medido em 2026-09-07, `config.raceFeatures` das 9 raças jogáveis)

Só **3** das 9 raças jogáveis concedem perícia. Os traços já existem em `config.raceFeatures` (US-142) como texto awareness-only — esta story mecaniza os três:

| Raça (chave) | Traço (`key`) | Texto do dataset | Forma |
|---|---|---|---|
| `high-elf` | `keen-senses` | "You have proficiency in the Perception skill." | **FIXA** — 1 perícia (`perception`) |
| `half-orc` | `menacing` | "You gain proficiency in the Intimidation skill." | **FIXA** — 1 perícia (`intimidation`) |
| `half-elf` | `skill-versatility` | "You gain proficiency in two skills of your choice." | **ESCOLHA** — 2 de qualquer perícia do catálogo |

As outras 6 (`dragonborn`, `hill-dwarf`, `human`, `lightfoot`, `rock-gnome`, `tiefling`) não têm traço de perícia — ignoram esta story por completo.

### Por que a solução atual não basta

`getRaceFeatures` ([character.service.ts:110](../../../apps/api/src/character/character.service.ts:110)) já materializa `keen-senses`/`menacing`/`skill-versatility` em `Character.features` — mas só como AWARENESS (nome + descrição na ficha). Nada soma essas perícias a `Character.skills`, então `buildSkillSheet` ([ability.ts:56](../../../packages/shared/src/ability.ts:56)) nunca marca Percepção/Intimidação como proficientes para um Alto-elfo/Meio-orc, e o Meio-elfo não tem onde escolher suas 2 perícias. A ficha diz "Keen Senses" na seção de traços e, logo abaixo, mostra Percepção **sem** o bônus de proficiência — contradição visível.

`validateSkills` ([character.service.ts:198](../../../apps/api/src/character/character.service.ts:198)) já sabe excluir do pool as perícias concedidas por background (US-131), mas não tem noção de perícia concedida por RAÇA.

### A proposta — mesma dupla de padrões que a US-215 já estabeleceu para ferramenta de raça

1. **Perícia FIXA (`high-elf`, `half-orc`):** mapa overlay em `@ai-dm/shared`, `RACE_SKILL_PROFICIENCIES`, somado a `Character.skills` incondicionalmente — cópia exata de `RACE_TOOL_PROFICIENCIES` ([race-tool-proficiency.ts:5](../../../packages/shared/src/race-tool-proficiency.ts:5)), só que o alvo é `skills` em vez de `tools`.
2. **Perícia à ESCOLHA (`half-elf`, 2 de qualquer):** `raceSkillChoices: string[]` no DTO, validado contra `config.skills` — irmão de `raceToolChoice`/`DWARF_TOOL_PROFICIENCY_CHOICES` ([character.service.ts:47](../../../apps/api/src/character/character.service.ts:47)), mas com **2** escolhas em vez de 1, e o pool é o catálogo inteiro de perícias em vez de uma tabela fixa.
3. **Merge no `skills` final** ([character.service.ts:124](../../../apps/api/src/character/character.service.ts:124)): as perícias de raça (fixas + escolhidas) entram na união junto das de origem, e `validateSkills` exclui todas elas do catálogo que valida a etapa `skills` — o mesmo par não pode ser escolhido duas vezes nem sobrar de fora.

Como tudo desemboca em `Character.skills`, a **revisão** (US-127, espelha a ficha) e a **ficha** (US-100, `buildSkillSheet`) mostram a proficiência de graça — sem código de exibição novo.

---

## Escopo

### Dentro do escopo

- **`@ai-dm/shared`:** dois mapas overlay novos (regra fixa do PHB 2014, não catálogo do sistema — mesmo raciocínio da US-215):
  - `RACE_SKILL_PROFICIENCIES: Record<string, readonly string[]>` = `{ 'high-elf': ['perception'], 'half-orc': ['intimidation'] }` — perícia fixa, chaves já existentes em `config.skills` (US-27), sem catálogo novo.
  - `RACE_SKILL_PROFICIENCY_CHOICES: Record<string, number>` = `{ 'half-elf': 2 }` — quantas perícias à escolha a raça concede. Mapa (não constante) para o caso de um bump/upload trazer outra raça versátil.
- **`CreateCharacterSchema`** ([character.schema.ts](../../../apps/api/src/character/character.schema.ts)): campo novo `raceSkillChoices: z.array(z.string().max(60)).optional()` — as perícias escolhidas do traço `skill-versatility`. Irmão de `raceToolChoice` (single) e de `raceLanguageChoice`, mas array.
- **`CharacterService.create`:**
  - `raceSkills = RACE_SKILL_PROFICIENCIES[race] ?? []` — soma incondicional, igual a `raceTools`/`raceLanguages`/`raceWeapons`.
  - Perícia à escolha: quando `RACE_SKILL_PROFICIENCY_CHOICES[race]` existe, exigir `dto.raceSkillChoices` com **exatamente** aquela contagem, cada chave validada contra `config.skills`, sem duplicata entre si nem colisão com `raceSkills`/`originSkills`/as `choices` da etapa. Chave inválida, contagem errada ou colisão → `BadRequestException` com o valor ofensor na mensagem (mesmo padrão de `validateCatalogKey`/`applyAbilityGrant`). Raça sem escolha (as 8 outras) que mande o campo → ignora, mesmo tratamento de `raceToolChoice`/`draconicAncestry` fora de contexto.
  - Linha do merge ([character.service.ts:124](../../../apps/api/src/character/character.service.ts:124)) passa a unir `raceSkills` + `raceChosenSkills` + `originSkills` + `validateSkills(config, dto.skills, [todas as anteriores])`, sem duplicata.
  - `validateSkills` ([character.service.ts:198](../../../apps/api/src/character/character.service.ts:198)) ganha as perícias de raça no conjunto de exclusão do catálogo (hoje só recebe `originSkills`).
- **Etapa `skills` do wizard** ([SetupWizard.tsx:1175](../../../apps/web/src/components/setup/SetupWizard.tsx:1175)):
  - Perícia FIXA de raça (`high-elf`/`half-orc`) aparece **pré-marcada como proficiente e não clicável**, junto das fixas de background (US-131) — o `skillCatalog` exibido já não a oferece como escolha da classe.
  - `half-elf`: um **segundo orçamento** de 2 perícias, com contador próprio (separado do `skillChoices` da classe), escolhidas de um pool que exclui as já concedidas (fixas de raça + fixas/escolhida de background). Mesmo desenho do toggle limitado da US-131 ([SetupWizard.tsx:776](../../../apps/web/src/components/setup/SetupWizard.tsx:776)), com teto = `RACE_SKILL_PROFICIENCY_CHOICES[race]`.
  - **Texto informativo** acima dos cards, chave nova `setup.skills.raceGrant` — mesmo padrão/posição de `setup.origin.skillGrant` (US-131) e `setup.skills.instructions` ([SetupWizard.tsx:1175](../../../apps/web/src/components/setup/SetupWizard.tsx:1175)). Ex.: `"Sua raça concede proficiência em {fixas}."` / `"Sua raça concede {n} perícia(s) à sua escolha."`
  - `canAdvance('skills')` ([SetupWizard.tsx:662](../../../apps/web/src/components/setup/SetupWizard.tsx:662)) passa a exigir também as `RACE_SKILL_PROFICIENCY_CHOICES[race]` escolhas do Meio-elfo, além das `skillChoices` da classe.
  - Payload do POST ([SetupWizard.tsx:733](../../../apps/web/src/components/setup/SetupWizard.tsx:733)): `raceSkillChoices` só viaja quando `RACE_SKILL_PROFICIENCY_CHOICES[charData.race]` existe — mesmo espírito condicional de `raceToolChoicePayload`. Resetar ao trocar de raça/raiz/sistema, igual a `raceToolChoice` ([SetupWizard.tsx:274](../../../apps/web/src/components/setup/SetupWizard.tsx:274)).
- **Revisão** ([SetupWizard.tsx:530](../../../apps/web/src/components/setup/SetupWizard.tsx:530)): `reviewSkills = buildSkillSheet(...)` recebe as perícias de raça (fixas + escolhidas) no array de proficientes, junto de `originSkillKeys` + `skills` — a revisão passa a mostrar Percepção/Intimidação/as 2 do Meio-elfo com o bônus de proficiência, espelhando a ficha (US-127).
- **Ficha** (US-100): nenhuma mudança de código — `buildSkillSheet` lê `Character.skills`, que já vem com as perícias de raça mescladas pelo service. Critério de aceite confere a exibição.
- **Testes:** `character.service.test.ts` cobre Alto-elfo (fixa `perception` em `skills`, sem exigir escolha), Meio-orc (fixa `intimidation`), Meio-elfo (2 escolhas válidas mescladas; contagem errada rejeitada; colisão com perícia de classe/background rejeitada), e raça sem traço de perícia (nenhuma perícia nova, sem regressão). `ability.test.ts` já cobre `buildSkillSheet` — sem teste novo lá.

### Fora do escopo

- **As 6 raças sem traço de perícia** — não têm o quê mecanizar; ignoram a story.
- **Fluxo RAW de "escolha uma substituta" quando duas fontes FIXAS dão a mesma perícia** — ver §Colisão. A exclusão-do-pool cobre toda colisão que envolve ESCOLHA; só a colisão fixa×fixa (rara) fica de fora, tratada como dedupe silencioso por ora.
- **Retroagir personagens já criados** — mecânica só para criação nova, mesmo corte da US-131/US-51.
- **Derivar os grants do texto de `raceFeatures` por parser no ingest** — ver §Questões em aberto: a US-215 já decidiu, para o caso irmão (ferramenta de raça), que 1–3 traços fixos não justificam parser; overlay é o padrão vigente. Fica registrado como alternativa, não como escopo.
- **`config.proficiency.bonus` derivado do nível** — o bônus de proficiência das perícias de raça usa o mesmo `+2` fixo (nível 1) de todas as outras; escalar com nível é a mesma pendência de sempre (`ponytail` em [ability.ts:61](../../../packages/shared/src/ability.ts:61)).

---

## Colisão (o gatilho que a US-131 deixou marcado)

A [US-131 §Fora do escopo](./US-131-integracao-mecanica-background-proficiency.md) decidiu, como YAGNI, **não** construir o fluxo RAW de "troque por outra perícia quando duas fontes dariam a mesma", justamente porque *"hoje só existem duas fontes de perícia (background e classe)... Revisitar se/quando outra fonte de concessão existir."* Esta story É essa terceira fonte. Decisão desta story, medindo o dataset em vez de assumir:

- **Colisão envolvendo ESCOLHA** (Meio-elfo escolhe uma perícia que a classe/background também dá, ou o pool de escolha da classe oferece a fixa de raça): resolvida por **exclusão-do-pool**, exatamente como a US-131 já faz — a perícia já concedida some das opções clicáveis, então não há como escolhê-la duas vezes. Sem fluxo de troca, sem escopo novo.
- **Colisão FIXA × FIXA** (perícia fixa de raça = perícia FIXA de background): a união dedupa e o personagem fica com **uma** proficiência onde a RAW concederia a segunda como substituta à escolha. É uma perda mecânica real, silenciosa. **Medido (2026-09-07, 21 backgrounds do a5e-ag, parte FIXA de cada `skill_proficiency`):**
  - `perception` fixa: **0/21** backgrounds → Alto-elfo (`keen-senses`) **nunca** colide fixa×fixa por background.
  - `intimidation` fixa: **1/21** → **Guard** (`"Intimidation, and either Athletics or Investigation."`). Um Meio-orc (`menacing`) com origem Guard É a única dupla fixa×fixa possível no catálogo atual.
  - **Decisão:** detectar a colisão no service e conceder **+1 perícia substituta à escolha** (orçamento extra de 1 na etapa `skills`, pool excluindo tudo já concedido) — o que a RAW manda, sem construir o subsistema generalizado de troca da US-131. É um guard sobre o par medido, não um fluxo aberto: `substituteCount = |raceFixed ∩ backgroundFixed|` (hoje 0 ou 1), some ao orçamento de escolha do jogador. Generaliza sozinho se um bump trouxer mais pares. Ver Critérios de aceite e Questão 1.

---

## Modelo de dados proposto

`@ai-dm/shared` (arquivo novo ou junto de `race-tool-proficiency.ts`):

```ts
// Perícia FIXA concedida por raça (Keen Senses do Alto-elfo, Menacing do Meio-orc) — mesmo
// formato de RACE_TOOL_PROFICIENCIES/RACE_LANGUAGES: soma direta em Character.skills, chaves
// já existentes em config.skills (US-27), sem catálogo novo.
export const RACE_SKILL_PROFICIENCIES: Record<string, readonly string[]> = {
  'high-elf': ['perception'],
  'half-orc': ['intimidation'],
}

// Quantas perícias À ESCOLHA a raça concede (Skill Versatility do Meio-elfo). Irmão de
// DWARF_TOOL_PROFICIENCY_CHOICES, mas o pool é config.skills inteiro, não tabela fixa.
export const RACE_SKILL_PROFICIENCY_CHOICES: Record<string, number> = {
  'half-elf': 2,
}
```

`CreateCharacterSchema.origin`/DTO — campo novo, irmão de `raceToolChoice`:

```ts
raceSkillChoices: z.array(z.string().max(60)).optional(), // perícias do traço skill-versatility
```

**Persistência:** sem coluna nova — as perícias de raça entram no `Character.skills` já existente (US-27), junto das de classe e background. `Character.race` (US-105) continua sendo o rastro de onde a proficiência veio.

---

## Critérios de aceite

- [x] `@ai-dm/shared` exporta `RACE_SKILL_PROFICIENCIES` (`high-elf`→`perception`, `half-orc`→`intimidation`) e `RACE_SKILL_PROFICIENCY_CHOICES` (`half-elf`→2).
- [x] Alto-elfo criado sem nenhuma escolha racial de perícia → `Character.skills` contém `perception` com bônus de proficiência na ficha; a etapa `skills` mostra Percepção pré-marcada não-clicável.
- [x] Meio-orc → `Character.skills` contém `intimidation`, mesmo comportamento.
- [x] **Colisão fixa×fixa (Meio-orc + origem Guard, único par medido):** o service detecta `intimidation` concedida por raça E por background, e a etapa `skills` ganha **+1 perícia substituta à escolha** (pool excluindo tudo já concedido); a substituta entra em `Character.skills`. Sem colisão (qualquer outra dupla) → nenhum orçamento extra, comportamento inalterado.
- [x] Meio-elfo: a etapa `skills` exige 2 escolhas de perícia de raça (contador próprio, separado do da classe); sem as 2, `canAdvance('skills')` bloqueia; as 2 entram em `Character.skills`.
- [x] `CharacterService.create` rejeita (`BadRequestException`) `raceSkillChoices` para Meio-elfo com contagem ≠ 2, chave fora de `config.skills`, duplicata entre si, ou colisão com perícia já concedida (raça fixa / background / classe).
- [x] Perícia de raça (fixa ou escolhida) é excluída do pool da etapa `skills` da classe — `skillChoices`/`config.proficiency.choices` **não muda de valor**, só passa a escolher sobre um catálogo menor.
- [x] `Character.skills` final = perícias de raça (fixas + escolhidas) ∪ perícias de origem (US-131) ∪ `choices` da etapa `skills`, **sem duplicata**.
- [x] Raça sem traço de perícia (as 6 restantes) → `skills` idêntico ao comportamento de hoje; `raceSkillChoices` enviado por engano é ignorado, sem erro.
- [x] A **revisão** ([SetupWizard.tsx:530](../../../apps/web/src/components/setup/SetupWizard.tsx:530)) e a **ficha** (US-100) mostram as perícias de raça com o bônus de proficiência — a revisão espelha a ficha (US-127), sem divergência.
- [x] Texto `setup.skills.raceGrant` presente nos dois locales (pt-BR/en-US), renderizado condicionalmente na etapa `skills` quando a raça concede perícia.
- [x] **Eval / teste de regressão:** `character.service.test.ts` cria um Meio-elfo com `raceSkillChoices: ['stealth','arcana']` (nenhuma concedida pela classe/background) e confere `skills` contendo as duas + as `choices` da classe, sem exigir mais perícias na etapa `skills`; e cria um Alto-elfo conferindo `perception` sem passar `raceSkillChoices`.

---

## Notas de implementação

- **Espelhar a US-215, não inventar padrão novo:** `raceSkills` incondicional (mapa overlay) para as fixas é uma linha ao lado de `raceTools`/`raceWeapons` ([character.service.ts:131](../../../apps/api/src/character/character.service.ts:131)/[:140](../../../apps/api/src/character/character.service.ts:140)); a escolha do Meio-elfo é o padrão de `raceToolChoice` ([:47](../../../apps/api/src/character/character.service.ts:47)) generalizado de 1 para N (loop de `validateCatalogKey` sobre `config.skills`, ou um helper `validateChoices` se ficar mais limpo que repetir).
- **Reusar a exclusão da US-131, não reescrever `validateSkills`:** o parâmetro de exclusão de `validateSkills` hoje recebe `originSkills`; passar `[...raceSkills, ...raceChosenSkills, ...originSkills]`. A regra `chosen.length !== choices` segue intacta.
- **`skill-versatility` continua em `Character.features`** (US-142/US-100) como awareness — esta story NÃO remove o traço da lista de features, só adiciona a mecânica em `skills`. As duas coisas coexistem (o traço explica o "porquê", as perícias são o "efeito"), igual a `keen-senses`/`menacing` para as raças fixas.
- **Chaves canônicas:** `perception`/`intimidation`/etc. são as chaves de `config.skills` (US-27), normalizadas (`toLowerCase` + espaço→`_`), não rótulos pt-BR — mesma disciplina de US-54/US-131.

---

## Questões em aberto

1. **Colisão fixa×fixa — MEDIDA (2026-09-07), resolvida.** Varredura das 21 origens do a5e-ag: `perception` fixa em **0**, `intimidation` fixa em **1** (Guard). Único par possível: **Meio-orc + Guard**. Decisão tomada (ver §Colisão): +1 substituta à escolha na colisão, sem subsistema generalizado. Aberto só o detalhe: a substituta sai do orçamento da etapa `skills` (mais simples) ou vira um mini-passo próprio? Recomendação: orçamento da etapa `skills` — é 1 perícia num par raríssimo, não paga UI própria.
2. **Overlay vs. parser no ingest:** a US-215 fixou overlay para 1–3 traços de ferramenta. Perícia tem exatamente 3 traços (2 fixos + 1 de escolha) e o texto (`"proficiency in the X skill"` / `"two skills of your choice"`) é regular o bastante para um `parseRaceSkillGrant` no estilo do `parseSkillGrant` da US-131. Vale a consistência com "dataset manda", ou o overlay (menos código, precedente da US-215) ganha? Recomendação desta story: **overlay** — 3 entradas não pagam um parser, e a US-215 já assumiu o custo dessa inconsistência para o caso irmão.
