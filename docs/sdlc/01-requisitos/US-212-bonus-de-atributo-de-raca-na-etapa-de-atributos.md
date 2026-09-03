# US-212 — Integração mecânica: bônus de atributo de raça na etapa de atributos

**Épico:** 1 — Personagem
**Fase:** 1 — MVP single-player
**Status:** 🚧 Em progresso
**Depende de:** [US-123](./US-123-integracao-mecanica-background-pointbuy.md) (precedente direto e idêntico em espírito — mecaniza o bônus de atributo do *background*; esta story faz o mesmo para o bônus de *raça*, reusando `AbilityBonusBadge` e o par find/apply) · [US-142](./US-142-tracos-mecanicos-subespecie-srd-5-1.md) (`raceFeatures` já mescla raiz+subespécie e já contém o traço `ability-score-increase` resolvido — o parser `parseAbilityScoreIncrease`/`buildRaceBonuses` em [`scripts/srd/race-bonus.mjs`](../../../scripts/srd/race-bonus.mjs) já lê esse traço, só descarta a estrutura numa frase de texto) · [US-207](./US-207-atributos-e-pericias-com-orcamento-visivel.md) (etapa `attributes` atual — orçamento, `remaining`, layout por linha que esta story estende)
**Relacionado:** [US-140](./US-140-catalogo-subracas-srd-5-1.md) (subespécie — raiz+variante já mescladas em `raceFeatures`, mesma fonte que esta story consome) · [US-211](./US-211-ancestralidade-draconica-do-dragonborn.md) (mais recente da linha de raça; nomeou explicitamente "não reabre ASI de raça em geral" como fora do próprio escopo — esta story é esse reabrir) · [ADR 004](../../adr/004-origem-do-dado-de-sistema.md) (dado vem do SRD ingerido, não é regra hardcoded como a tabela da US-211)

**Criada em:** 2026-09-03

---

## História

> **Como** jogadora que cria um personagem,
> **quero** que o bônus de atributo da raça que escolhi (ex. "+2 Destreza" do Elfo, "+1 em todos" do Humano) realmente some no valor final do atributo,
> **para que** minha escolha de raça pese na mecânica da ficha — hoje ela só aparece como texto no cartão de espécie, e eu preciso somar o bônus de cabeça na hora de alocar o point-buy.

---

## Contexto e motivação

### O problema observado

`config.races[].bonus` (e `.variantBonus`, para subespécie) já existe, e já é **derivado corretamente** de `raceFeatures` — `buildRaceBonuses` ([`race-bonus.mjs:85`](../../../scripts/srd/race-bonus.mjs:85)) lê o traço `ability-score-increase`, parseia a frase do SRD (`parseAbilityScoreIncrease`, [`race-bonus.mjs:14`](../../../scripts/srd/race-bonus.mjs:14)) e já resolve corretamente os casos de raiz+subespécie mescladas (comentário em `race-bonus.mjs:67-84` documenta a mecânica de `bonuses`/`rootBonuses`/`variantBonuses`). O problema é que o resultado dessa análise **vira só uma frase formatada** (`"+2 Destreza, +1 outro atributo à sua escolha"`) e para nesse ponto — `formatAsiPhrase` ([`race-bonus.mjs:48`](../../../scripts/srd/race-bonus.mjs:48)) calcula a estrutura (`merged: Map<atributo, quantidade>` + `choice: {count, amount}`) internamente e **descarta** os dois assim que monta a string.

Esse texto aparece só no cartão de raça do wizard (`raceRoots`/`raceVariants`, [`SetupWizard.tsx:830-841`](../../../apps/web/src/components/setup/SetupWizard.tsx:830), campo `bonus` do `CatalogCardEntry`) e em nenhum outro lugar — `grep -rn "rootBonuses\|variantBonuses\|buildRaceBonuses"` fora de `scripts/srd/` não retorna nenhum consumidor. A etapa `attributes` do wizard (`SetupWizard.tsx:870-927`) não sabe que raça existe: `finalAttributes` no service ([`character.service.ts:78`](../../../apps/api/src/character/character.service.ts:78)) soma apenas o `abilityGrant` do **background** (US-123) por cima do point-buy — o bônus de raça nunca chega em `baseAttributes`.

### É exatamente a mesma lacuna que a US-123 fechou, só que do outro lado

A US-123 mecanizou `ability_score` de *background* (texto → `grant` estruturado → aplicado em `baseAttributes` → interação na etapa `attributes` com `AbilityBonusBadge`). O bônus de *raça* ficou de fora daquela story por escopo (US-123 é só sobre backgrounds) e a US-211, mais recente, nomeou isso explicitamente: "esta story… não reabre ASI de raça em geral" (§Contexto, US-211) — confirmando que é lacuna reconhecida e adiada, não decisão de produto. Esta story é esse reabrir, restrito ao bônus numérico de atributo (não mexe em Darkvision nem em outros traços texto-only, mesmo corte que a US-211 fez para o resto do Dragonborn).

### Por que não é uma cópia 1:1 do parser/UI da US-123

O padrão de *background* é regular: sempre `+1 fixo` + `+1 livre em qualquer outro atributo` (21/21 entradas, um formato só). O de *raça* tem **3 formas**, medidas no comentário já existente em `race-bonus.mjs:8-11`:

1. **Só fixo, um ou dois atributos, quantidade variável** — a maioria das raças (ex. Anão da Colina: CON+2 da raiz, SAB+1 da subespécie, já mesclados por `raceFeatures`; Elfo: DES+2). Sem escolha nenhuma.
2. **Todos os seis, +1 cada** — só o Humano (`"Your ability scores each increase by 1"`, tratado à parte em `parseAbilityScoreIncrease:15-19`).
3. **Um fixo + N atributos livres à escolha** — só o Meio-Elfo hoje (`"TWO other ability scores of your choice"`, `CHOICE_COUNT_WORDS` cobre só `"two"`). Diferente do background, aqui `count` pode ser >1.

Isso descarta reusar `grant.kind === 'ability'` (US-123, `{fixed: string, freeCount: number}`, sempre exatamente um par 1:1) como está — o modelo de dado de raça precisa de `fixed` como **lista** de `{attr, amount}` (0, 1 ou 6 entradas) e `choice` como `{count, amount}` **opcional** (ausente nas raças sem escolha, presente só no Meio-Elfo). Ver §Modelo de dados proposto.

### Duas fontes de bônus podem coexistir na mesma linha

Diferente da US-123 (só background), esta story cria um segundo "somador" independente sobre o mesmo `baseAttributes`. Um personagem pode ter **origem com `grant.kind === 'ability'` E raça com `grant` de atributo ao mesmo tempo**, possivelmente tocando o **mesmo atributo** (ex. background Acólito +1 Sabedoria + raça Anão da Colina +1 Sabedoria da subespécie) — os dois devem somar, sem um mascarar o outro, nem a UI colidir num badge só. Isso não é regra RAW especial (os dois bônus são de fontes diferentes, sempre cumulativos no 5e) — é só a primeira vez que o wizard precisa mostrar **dois** selos na mesma linha.

---

## Escopo

### Dentro do escopo

- **`race-bonus.mjs`:** `buildRaceBonuses` passa a devolver também um `grants: Record<raceKey, SystemRaceGrant>` estruturado, ao lado de `bonuses`/`variantBonuses`/`rootBonuses` — reaproveita o `merged`/`choice` que `formatAsiPhrase` já calcula internamente (hoje descartado após virar frase), sem duplicar o parse. Cobre as 3 formas medidas em §Contexto: fixo simples/múltiplo com quantidade própria, "+1 em todos" (Humano, 6 entradas em `fixed`, `choice` ausente), fixo+escolha (Meio-Elfo, `choice.count = 2`). Mesma junção raiz+subespécie que `bonuses` já faz (por chave jogável, via `raceFeatures`) — sem reabrir `buildRaceFeatures`.
- **`ingest.mjs` (`buildConfig`, [:892-896](../../../scripts/srd/ingest.mjs:892)):** grava `race.grant = grants[race.key]` ao lado de `race.bonus`, mesmo padrão de atribuição condicional (`if (grants[race.key]) race.grant = …`).
- **`RaceCatalogEntrySchema`** (`packages/shared/src/types/system.ts:55`) ganha `grant: SystemRaceGrantSchema.optional()`, novo schema (ver §Modelo de dados). Campo presente só quando o parser reconhece o traço `ability-score-increase` (hoje 100% das 13 raças jogáveis, mesma cobertura que `bonus` já tem).
- **`CreateCharacterSchema`** (`character.schema.ts:24`) ganha `raceAbilityChoice: z.array(z.string().max(40)).max(6).optional()` — sibling de `race` (não aninhado em `origin`: raça não é origem, mesma separação que a US-122 já fez entre `origin` e `background`). Array, não string única — `grant.choice.count` pode ser 2 (Meio-Elfo hoje, mais no futuro se o dataset mudar).
- **`character.service.ts`:** novo par `findRaceGrant`/`applyRaceGrant`, espelhando `findAbilityGrant`/`applyAbilityGrant` (US-123, `:178-211`) mas lendo `config.races` (não `config.backgrounds`) e aplicando **depois** do grant de background, sobre o `baseAttributes` já somado por ele — os dois somam independentemente, mesmo atributo pode receber os dois. `applyRaceGrant`: soma cada `grant.fixed[].amount` incondicionalmente (sem exigir escolha do jogador); se `grant.choice` presente, exige `raceAbilityChoice` com **exatamente** `grant.choice.count` chaves, todas de `config.attributes`, todas distintas entre si e distintas de qualquer `grant.fixed[].attr` — rejeita (`BadRequestException`, valor ofensor) nos três casos (contagem errada, chave fora do catálogo, repetição/colisão com fixo). Raça sem `grant` (config legado) ou sem `choice` (a maioria) não exige nada do DTO.
- **Etapa `race` do wizard:** o cartão continua igual (texto de `bonus`/`variantBonus` como aviso, mesmo espírito da US-123 §Escopo item 2), só que agora ele *implica* uma mecânica real na etapa seguinte, não é mais só prosa. O painel de traços raciais (`raceStepFeatures`, `SetupWizard.tsx:433-436`), porém, deixa de mostrar a entrada `ability-score-increase` ("Aumento no Valor de Habilidade") — para **todas** as raças, não só dragonborn: o texto vira redundante assim que o selo `+N raça` já mostra o mesmo bônus na etapa `attributes`, mesmo raciocínio que a US-211 já aplicou para `draconic-ancestry-table`/`draconic-ancestry` (`HIDDEN_DRAGONBORN_FEATURE_KEYS`, `SetupWizard.tsx:76`), só que incondicional em vez de restrito a uma raça. `breath-weapon`/`damage-resistance`/Darkvision/demais traços continuam aparecendo — só o traço de ASI some, porque é o único que passa a ter representação mecânica própria.
- **Etapa `attributes` do wizard:** generaliza o bloco de badge da US-123 (`SetupWizard.tsx:886-925`) para ler **dois** grants (background E raça) na mesma linha:
  - Atributo em `raceGrant.fixed[]`: selo sólido sempre visível, não-clicável, rótulo com a quantidade própria da linha (`+2 raça`, não sempre `+1` como o selo de origem — `AbilityBonusBadge` não muda, só o texto do `label` passado varia por linha).
  - Atributo elegível para `raceGrant.choice` (existe `choice` e a linha não é `fixed`): selo fantasma `+N raça` (N = `choice.amount`) enquanto o total de escolhas feitas for menor que `choice.count`; clique alterna a linha dentro/fora de `raceAbilityChoice` (array, não par único) — ao atingir `choice.count` escolhas, as linhas **não escolhidas** deixam de ser clicáveis (mesmo raciocínio de "linha inteira clicável" da US-123, adaptado de 1 para N escolhas) e seus selos fantasma somem; clicar numa linha já escolhida sempre desmarca, reabrindo uma vaga.
  - Raça "Humano" (`fixed` com as 6 chaves, sem `choice`): as 6 linhas mostram o selo sólido `+1 raça`, nenhuma interação — mesmo tratamento do selo fixo de background, só que em 6 linhas em vez de 1.
  - **Linha com bônus de background E de raça ao mesmo tempo:** os dois selos aparecem lado a lado (rótulos diferentes, `+1 origem` e `+N raça`, nunca se sobrescrevem); o valor numérico exibido (`(attrs[a.key] ?? a.default) + bonus`, `SetupWizard.tsx:911`) soma as duas fontes.
  - `canAdvance('attributes')` ganha a mesma condição que já tem para background (`SetupWizard.tsx:135` da US-123), espelhada para raça: `&& (!raceGrant?.choice || raceAbilityChoice.length === raceGrant.choice.count)`.
- **Testes:** `ingest.test.mjs`/`race-bonus` cobre as 3 formas com raças reais do dataset (fixo simples, Humano, Meio-Elfo) e o merge raiz+subespécie (Anão da Colina: CON+2 raiz + SAB+1 variante, os dois em `fixed`). `character.service.test.ts` cobre bônus fixo aplicado sem exigir DTO, escolha de raça com `choice` (aceita `count` correto, rejeita contagem errada/chave inválida/colisão com fixo), e o caso combinado (background E raça no mesmo atributo, somando os dois). `SetupWizard.test.tsx` cobre o selo fixo por quantidade, a seleção múltipla até `choice.count`, o bloqueio de avanço, e a linha com dois selos simultâneos.

### Fora do escopo

- **Retroagir personagens já criados** — mesmo corte da US-123/US-51: a mecânica vale só para criação nova.
- **Reabrir Darkvision ou outros traços texto-only de raça** — US-211 §Contexto já isolou isso como decisão consciente (US-142 deixou como awareness *de propósito*); esta story é só o bônus numérico de atributo.
- **Escolha dentro de traço de subclasse/raça além do ASI** (ex. truque de mago do Alto-elfo — US-142 *Questão em aberto #3*, já adiada por aquela story). Não mexido aqui.
- **Sistema genérico de "múltiplas fontes de bônus de atributo" reutilizável** (ex. um item mágico futuro) — a solução aqui é dois somadores nomeados (`applyAbilityGrant` de origem, `applyRaceGrant` de raça), não uma lista genérica de modificadores. Sem terceira fonte hoje, generalizar cedo é abstração sem consumidor.
- **Mudar o teto (`max`) do `buildCharacterAttributesSchema`** — mesma regra já estabelecida pela US-123: o `max` vale só para o point-buy puro; o bônus (de origem ou de raça) soma por cima e pode estourá-lo, sem validação de teto adicional.

---

## Modelo de dados proposto

```ts
// packages/shared/src/types/system.ts — novo, ao lado de SystemBackgroundGrantSchema

// Bônus de atributo de raça (traço `ability-score-increase`, US-142), derivado pelo ingest.
// Ao contrário do grant de background (US-123, sempre 1 fixo + 1 livre), a raça tem 3 formas
// medidas no dataset: só fixo (1 ou 2 atributos, quantidade própria cada), "+1 em todos" (fixed
// com as 6 chaves, Humano) e fixo + N livres (Meio-Elfo, choice.count = 2). `fixed` cobre as
// duas primeiras; `choice` é ausente nas duas e presente só na terceira.
export const SystemRaceGrantSchema = z.object({
  fixed: z.array(z.object({ attr: z.string().min(1), amount: z.number().int().positive() })),
  choice: z.object({
    count: z.number().int().positive(),
    amount: z.number().int().positive(),
  }).optional(),
})
export type SystemRaceGrant = z.infer<typeof SystemRaceGrantSchema>

// RaceCatalogEntrySchema (system.ts:55) ganha:
//   grant: SystemRaceGrantSchema.optional(),
```

```ts
// character.schema.ts — CreateCharacterSchema ganha, sibling de `race` (não dentro de `origin`):
raceAbilityChoice: z.array(z.string().max(40)).max(6).optional(),
```

| Campo | Antes | Depois |
|---|---|---|
| `config.races[].grant` | não existe (só `.bonus`/`.variantBonus`, texto) | novo, opcional — estrutura numérica do mesmo bônus que `.bonus` já formata em texto |
| `CreateCharacterDto.raceAbilityChoice` | não existe | novo, opcional — array de chaves de `config.attributes`, preenchido quando `grant.choice` exige |
| `Character.baseAttributes` (persistido) | point-buy + bônus de background | point-buy + bônus de background + bônus de raça (dois somadores independentes, cumulativos) |

**Persistência:** sem coluna nova — igual à US-123, o bônus é absorvido em `baseAttributes` antes de persistir. `Character.race` (já existente) continua sendo o rastro de onde o bônus veio.

---

## Critérios de aceite

- [ ] `buildRaceBonuses` (`race-bonus.mjs`) devolve `grants` estruturado ao lado de `bonuses`/`variantBonuses`/`rootBonuses`, cobrindo as 13 raças jogáveis: fixo simples/múltiplo com a quantidade correta, Humano com as 6 chaves em `fixed` e `choice` ausente, Meio-Elfo com `choice = {count: 2, amount: 1}`.
- [ ] Subespécie com bônus próprio (ex. Anão da Colina) tem `grant.fixed` com o bônus da raiz **e** o da variante mesclados (CON+2 raiz + SAB+1 variante), mesmo merge que `bonuses[raceKey]` (texto) já faz hoje.
- [ ] `config.races[].grant` aparece no artefato ingerido para as 13 raças jogáveis; raça sem traço `ability-score-increase` reconhecido (config legado) fica sem `grant`, sem quebrar.
- [ ] Criar personagem com raça de bônus só-fixo (ex. Elfo) soma o bônus em `baseAttributes` automaticamente, sem exigir nada novo no DTO.
- [ ] Criar personagem com raça Humano soma +1 nos 6 atributos automaticamente, sem exigir escolha.
- [ ] Criar personagem com raça Meio-Elfo **sem** `raceAbilityChoice` (ou com contagem ≠ 2, ou com chave fora de `config.attributes`, ou com uma chave igual ao atributo fixo do Meio-Elfo) é rejeitado (`BadRequestException`, valor ofensor + formato esperado).
- [ ] Criar personagem com raça Meio-Elfo e `raceAbilityChoice` válido (2 chaves distintas, nenhuma igual ao fixo) soma corretamente: fixo +2, cada escolhida +1.
- [ ] Criar personagem com origem que concede `grant.kind === 'ability'` **e** raça com `grant` tocando o **mesmo** atributo: os dois bônus somam (não um sobrescreve o outro).
- [ ] Etapa `attributes` do wizard: linha de atributo fixo pela raça mostra selo sólido não-clicável com a quantidade certa (`+2 raça`, não sempre `+1`); linhas elegíveis à escolha (Meio-Elfo) mostram selo fantasma até `choice.count` escolhas feitas; ao atingir o limite, linhas não escolhidas param de ser clicáveis e o selo fantasma some delas.
- [ ] Linha com bônus de origem **e** de raça simultâneos mostra os dois selos (rótulos distintos), e o número exibido do atributo soma as duas fontes.
- [ ] `canAdvance('attributes')` bloqueia avanço enquanto uma raça com `grant.choice` não tiver o número certo de escolhas feitas; raça sem `choice` (a maioria) não bloqueia nada.
- [ ] Painel de traços raciais (etapa `race`) não mostra mais a entrada `ability-score-increase` ("Aumento no Valor de Habilidade") para **nenhuma** raça — nem Humano, nem Meio-Elfo, nem as demais. `breath-weapon`, `damage-resistance`, Darkvision e outros traços continuam visíveis normalmente.
- [ ] Personagem criado com raça sem `grant` reconhecido (config legado, sem o campo): comportamento idêntico ao de hoje, nenhuma validação nova disparada.
- [ ] **Eval / teste de regressão:** `character.service.test.ts` cobre os casos acima (fixo automático, Humano automático, Meio-Elfo válido/inválido nos 3 modos de rejeição, combinação com grant de origem no mesmo atributo); `SetupWizard.test.tsx` cobre o selo por quantidade, a seleção múltipla, o bloqueio de avanço e a linha com dois selos.

---

## Notas de implementação

- **Reaproveita `AbilityBonusBadge` (US-123, `SetupWizard.tsx:113`) sem mudar o componente** — ele já recebe `label` como string opaca; a quantidade (`+2 raça` em vez de sempre `+1 origem`) entra só como texto diferente por linha, não como prop nova.
- **`formatAsiPhrase` (`race-bonus.mjs:48`) já calcula `merged`/`choice` — só descarta depois de montar a frase.** Extraia essa estrutura para uma função irmã (ou faça `formatAsiPhrase` devolver os dois, texto e estrutura, numa única passada) em vez de rodar `parseAbilityScoreIncrease` de novo — evita duplicar o parse dos mesmos traços.
- **Ordem de aplicação em `character.service.ts` não importa matematicamente** (soma comuta), mas por clareza de leitura aplique `applyRaceGrant` **depois** de `applyAbilityGrant` (US-123) — mesma ordem que o wizard já mostra as etapas (`race-class` vem antes de `background` no fluxo atual só para escolha; a aplicação dos dois grants no service pode ficar sequencial, um por cima do resultado do outro).
- **`raceAbilityChoice` não entra em `origin`** — `origin` é exclusivamente do catálogo de *background* (US-122 §Nomenclatura já separou os dois conceitos). Fica sibling de `race` no DTO, mesmo nível hierárquico.
- **Validação de "atributo distinto do fixo" é por raça, não global** — um `raceAbilityChoice` pode coincidir com o atributo que o *background* concedeu (fontes diferentes, sem RAW que proíba), só não pode coincidir com o `grant.fixed` da **própria raça** (repetir o fixo da raça não é "outro atributo", mesmo raciocínio RAW que a US-123 já aplicou para background).
- **UI de seleção múltipla (`choice.count > 1`) é caso novo, não existia na US-123** (lá era sempre 1 escolha). Implemente como array de chaves selecionadas, não reaproveite a variável `abilityChoice: string | undefined` da US-123 — são dois estados independentes (`abilityChoice` de origem continua string única; `raceAbilityChoice` é array).
- **Filtro do painel de traços é por `key`, não por raça** (diferente de `HIDDEN_DRAGONBORN_FEATURE_KEYS`, que só se aplica quando `charData.race === 'dragonborn'`): `f.key !== 'ability-score-increase'` incondicional em `raceStepFeatures` (`SetupWizard.tsx:433-436`) cobre Humano, Meio-Elfo e as demais na mesma linha, sem `Set` por raça. O traço continua existindo em `config.raceFeatures` (não é removido do ingest/dataset) — só sai da exibição desse painel específico; qualquer outro consumidor de `raceFeatures` (prompt do Mestre, ficha) não é afetado.
- **Cobertura hoje é 13/13 raças jogáveis** (medido pelo comentário em `race-bonus.mjs:8-11`, 3 formas). Se um bump futuro do dataset trouxer uma 4ª forma de frase, o parser já falha alto (sem match nos regex, `fixed`/`choice` ficam vazios) — mesmo padrão de "falha visível, não engolida" que `parseAbilityScoreIncrease` já segue.

---

## Referências no código

- [scripts/srd/race-bonus.mjs](../../../scripts/srd/race-bonus.mjs) — `parseAbilityScoreIncrease` (`:14`), `formatAsiPhrase` (`:48`, tem a estrutura a extrair), `buildRaceBonuses` (`:85`, a estender com `grants`).
- [scripts/srd/ingest.mjs:892-896](../../../scripts/srd/ingest.mjs:892) — `buildConfig`, onde `race.bonus`/`race.variantBonus` são atribuídos; `race.grant` entra ao lado.
- [packages/shared/src/types/system.ts:55-63](../../../packages/shared/src/types/system.ts:55) — `RaceCatalogEntrySchema` (a estender), `:114-134` `SystemBackgroundGrantSchema` (precedente de forma a espelhar).
- [apps/api/src/character/character.schema.ts:24,59-74](../../../apps/api/src/character/character.schema.ts:24) — `race`, `origin.abilityChoice`/`skillChoice` (precedente de array vs. string única).
- [apps/api/src/character/character.service.ts:36-37,77-78,178-211](../../../apps/api/src/character/character.service.ts:36) — validação de `race`, `abilityGrant`/`finalAttributes` (onde `applyRaceGrant` entra), `findAbilityGrant`/`applyAbilityGrant` (US-123, par a espelhar).
- [apps/web/src/components/setup/SetupWizard.tsx:113,830-841,870-927](../../../apps/web/src/components/setup/SetupWizard.tsx:113) — `AbilityBonusBadge`, grade de raça/variante, etapa `attributes` (bloco a generalizar para dois grants).
- [US-123](./US-123-integracao-mecanica-background-pointbuy.md) — precedente completo, mesma infraestrutura (find/apply, badge, banner, `canAdvance`) para a fonte irmã (background).
- [US-142 §Fora do escopo](./US-142-tracos-mecanicos-subespecie-srd-5-1.md) — nomeou Ability Score Increase de raça como texto-only *de propósito*, mesma lacuna que esta story fecha.
