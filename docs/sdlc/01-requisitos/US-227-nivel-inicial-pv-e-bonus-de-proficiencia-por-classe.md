# US-227 — Nível inicial à escolha na criação, com PV e bônus de proficiência derivados de classe+nível

**Épico:** 1 — Personagem
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** [US-209](./US-209-hit-dice-e-salvaguardas-de-classe-no-config.md) (`config.classes[].hitDice`, notação `NdM` — hoje sem NENHUM consumidor no código, é o dado que esta story finalmente lê) · [US-27](./US-27-pericias-do-personagem.md) (`config.proficiency.bonus`, hoje fixo — esta story adiciona a fonte alternativa por nível, sem remover o fallback)
**Relacionado:** [US-127 §Fora do escopo](./US-127-revisao-espelha-ficha-completa.md) (documentou a fórmula `10 + mod CON` como provisória, à espera de um `hitDice` real no config — US-209 entregou o dado, esta story entrega o consumidor) · [US-219](./US-219-xp-por-evento-narrativo.md) (XP por evento narrativo — evolução de nível DURANTE o jogo; esta story é só a escolha MANUAL do nível na criação, as duas não se tocam ainda) · [US-42](./US-42-magias-conhecidas.md) (motor de conjuração/slots de magia declarado fora do escopo desde então — continua fora aqui)
**Criada em:** 2026-09-08

---

## História

> **Como** jogadora criando um personagem,
> **quero** escolher o nível inicial dele (não só a classe), com os Pontos de Vida e o bônus de proficiência calculados a partir da MINHA combinação de classe+nível,
> **para que** eu possa começar uma campanha em qualquer ponto da história (nível 1 para uma origem, nível 5 para retomar um personagem "mais experiente") sem todo Bárbaro nascer com o mesmo PV de todo Mago.

---

## Contexto e motivação

### O problema observado

Hoje **todo** personagem nasce nível 1 — não por regra, mas porque não existe outro caminho:

- `CharacterService.create` grava `level: 1` como literal fixo ([character.service.ts:201](../../../apps/api/src/character/character.service.ts:201)); `CreateCharacterSchema` ([character.schema.ts:19](../../../apps/api/src/character/character.schema.ts:19)) não tem campo `level` — não dá para mandar outro valor mesmo direto pela API.
- A etapa de revisão do wizard mostra o rótulo **"1" hardcoded**, não uma variável ([SetupWizard.tsx:1672](../../../apps/web/src/components/setup/SetupWizard.tsx:1672)): `[t('setup.review.level'), '1']`.

E os dois números que deveriam variar por classe+nível são **fixos e idênticos para as 13 classes**:

- **PV:** `maxHp = 10 + conMod` — mesma fórmula para Bárbaro (`1d12`) e Mago (`1d6`) — em DOIS lugares que não se falam: `AdventureService.create` ([adventure.service.ts:465](../../../apps/api/src/adventure/adventure.service.ts:465)) grava o `CharacterState.maxHp` de verdade; `SetupWizard` ([SetupWizard.tsx:581](../../../apps/web/src/components/setup/SetupWizard.tsx:581)) calcula o MESMO número, com a MESMA fórmula fixa, só para o preview da revisão (`previewHp`).
- **Bônus de proficiência:** `config.proficiency?.bonus ?? 2` — sempre +2, em TODOS os locais que hoje resolvem perícia/salvaguarda (`adventure.service.ts:498`, [play/[adventureId]/page.tsx:44](../../../apps/web/src/app/play/[adventureId]/page.tsx:44), `buildSkillSheet`/`buildSavingThrowSheet` em [ability.ts](../../../packages/shared/src/ability.ts)).

### Por que a solução atual não basta

Isto não é uma lacuna nova — já foi medida e documentada três vezes, sempre como item explicitamente adiado:

1. US-127 §Fora do escopo: *"PV fixo `10 + mod CON` em `adventure.service.ts` — consumidor futuro do `hitDice`, **não mudado aqui**"*.
2. US-209 §Contexto: *"`hitDice` ... **só uma story com `hitDice` real no config poderia substituir**"* a fórmula fixa — US-209 só entregou o DADO (`config.classes[].hitDice`, ex. `"1d12"`), deliberadamente sem tocar o consumidor.
3. `ability.ts:60` (`buildSkillSheet`) e `page.tsx:38-40`, os dois com o MESMO comentário: *"bônus de proficiência FIXO em `config.proficiency.bonus` (+2, nível 1). Quando houver level-up (Fase futura), o bônus 5e escala com o nível (+2→+6) — derivar de `character.level` (ex.: `2 + floor((level-1)/4)`)"*.

Ou seja: o dado (`hitDice`) já existe desde a US-209 e nunca foi lido; a fórmula do bônus de proficiência já está escrita em comentário há pelo menos duas stories, só nunca virou código; e o campo `Character.level` já existe na coluna do Prisma (`@default(1)`) sem que NADA além do valor padrão jamais o escreva. As três peças estão no lugar, faltando só a jogadora poder escolher e o código parar de fixar o resultado.

### A proposta

A etapa `class` do wizard ganha um seletor de nível inicial (1 a 20); `CreateCharacterSchema` passa a aceitar `level`; `CharacterService.create` grava o valor escolhido. PV e bônus de proficiência deixam de ser fórmula fixa e passam a derivar de `character.class` (via `config.classes[].hitDice`) e `character.level`, nos mesmos pontos que já os calculam hoje — sem tool nova, sem etapa de "level up" durante o jogo (isso seguirá sendo trabalho futuro, ver §Fora do escopo).

---

## Escopo

### Dentro do escopo

- **`packages/shared/src/ability.ts`** (ou arquivo irmão novo no mesmo pacote, ao lado de `roll.ts`): duas funções puras novas, mesmo estilo de `abilityModifier`/`skillModifier` (comentário com a regra 5e, teste de unidade):
  - `proficiencyBonusForLevel(level: number): number` — `2 + Math.floor((level - 1) / 4)`, a fórmula que os 3 comentários (`ability.ts:60`, `page.tsx:38-40`) já apontam. `level` fora de 1–20 lança, mesmo padrão de `abilityModifier` para valor fora de faixa.
  - `maxHpForLevel(hitDice: string, level: number, conMod: number): number` — regra 5e "PV médio" (sem RNG, mesma disciplina de "dados rolados deterministicamente" que o resto do Game Server já segue): nível 1 = valor MÁXIMO do dado + `conMod`; cada nível adicional soma `Math.ceil(sides / 2) + 1 + conMod` (a "média arredondada para cima" que o PHB usa como alternativa a rolar). `hitDice` fora do formato `NdM` (ex. config legado sem US-209) cai num fallback: `10 + conMod * level` não faz sentido — cai para a fórmula fixa de hoje só no nível 1 (`10 + conMod`) e loga aviso; não há como extrapolar PV de nível 5+ sem saber o dado da classe.
- **`CreateCharacterSchema`** ([character.schema.ts:19](../../../apps/api/src/character/character.schema.ts:19)): campo novo `level: z.number().int().min(1).max(20).optional()` — opcional para não quebrar clientes existentes (fallback 1, mesmo espírito de `subclass`/`alignment` opcionais no mesmo schema).
- **`CharacterService.create`** ([character.service.ts:201](../../../apps/api/src/character/character.service.ts:201)): `level: dto.level ?? 1` no lugar do literal `1`.
- **`AdventureService.create`** ([adventure.service.ts:465](../../../apps/api/src/adventure/adventure.service.ts:465)): `maxHp = maxHpForLevel(hitDice, character.level, conMod)`, com `hitDice = config.classes?.find(c => c.key === character.class)?.hitDice`. Mesmo ponto, `498`: `proficiency?.bonus ?? 2` vira `proficiencyBonusForLevel(character.level)` (com fallback ao valor do config quando `character.level` estiver ausente — artefato pré-migração).
- **`play/[adventureId]/page.tsx:44`**: mesma troca de `config.proficiency?.bonus ?? 2` por `proficiencyBonusForLevel(character.level ?? 1)` — remove o comentário `ponytail:` que já apontava exatamente esta mudança.
- **Etapa `class` do wizard** ([SetupWizard.tsx](../../../apps/web/src/components/setup/SetupWizard.tsx), próximo ao seletor de subclasse em `:1069`): campo novo de nível inicial — um `<select>`/stepper numérico 1–20, default 1. Estado novo `level` (mesmo padrão de `subclass`, `:283`), incluído no payload de criação (`:840`, ao lado de `subclassPayload`).
- **Revisão** ([SetupWizard.tsx:1672](../../../apps/web/src/components/setup/SetupWizard.tsx:1672)): `[t('setup.review.level'), String(level)]` no lugar do literal `'1'`. `previewHp` (`:581`) troca `10 + conMod` por `maxHpForLevel(hitDiceDoPersonagem, level, conMod)`, mesma função compartilhada que o backend usa — preview nunca diverge do que a API grava (mesma disciplina que US-127 já exige de todo preview do wizard).
- **Testes:** `ability.test.ts` cobre `proficiencyBonusForLevel` (fronteiras 1/4/5/8/9/…/20, valor fora de faixa lança) e `maxHpForLevel` (nível 1 = máximo do dado, nível 2+ = incremento fixo, `1d12` vs `1d6` dando resultados diferentes no MESMO nível, `hitDice` ausente cai no fallback nível-1). `character.service.test.ts` cobre `level` persistido do DTO e fallback a 1 quando ausente. `adventure.service.test.ts` cobre `maxHp` variando por classe (Bárbaro nível 5 ≠ Mago nível 5) e por nível (mesma classe, níveis diferentes).

### Fora do escopo

- **Features de classe desbloqueadas por nível.** `config.classFeatures` hoje só tem as features de NÍVEL 1 — decisão deliberada do ingest (`ingest.mjs:463`, comentário: *"classFeatures: nível 1, só classe base, sem ruído de tabela"*). Expor um seletor de nível 1–20 sem preencher a ficha com as features dos níveis 2+ é uma lacuna visível, mas corrigi-la exige re-ingerir `ClassFeature.json` inteiro com nível por entrada — escopo de uma story própria (schema `SystemClassFeatureSchema` ganharia `level`, `buildClassFeatures` pararia de filtrar só nível 1). Até lá, a ficha mostra as mesmas features de nível 1 independente do nível escolhido — um personagem nível 10 aparece com a mesma lista de traços de um nível 1, só com PV/bônus de proficiência corretos.
- **Magias e espaços de magia por nível.** Motor de conjuração inteiro é corte da Fase 1 desde a US-42 (*"awareness apenas... slots/preparação/componentes fora"*) — continua fora, nível não muda isso.
- **Ability Score Improvement (ASI).** 5e concede +2 de atributo (ou feat) em níveis fixos (4, 8, 12…) — não modelado aqui; `baseAttributes` do personagem não muda com o nível escolhido nesta story.
- **Subir de nível DURANTE o jogo.** Esta story é só a escolha MANUAL na CRIAÇÃO. Progressão de nível via XP (US-219) ou por evento narrativo é mecanismo separado, futuro — nenhuma tool do DM Agent muda `Character.level` depois de criado.
- **PV rolado (vs. "PV médio").** O 5e oferece as duas opções (rolar o dado ou usar a média fixa); esta story usa só a fórmula "média arredondada para cima" — mesma disciplina de "dados rolados deterministicamente" que o resto do sistema já segue (nenhum RNG na criação de ficha).
- **Multiclasse.** `Character.class` continua sendo uma classe só; PV por multiclasse (somar dados de classes diferentes) não existe no modelo de dados hoje.

---

## Modelo de dados proposto

Sem coluna nova — `Character.level` já existe (`@default(1)`, [schema.prisma:47](../../../apps/api/prisma/schema.prisma:47)); esta story só passa a ESCREVER um valor diferente de 1 e a LER o campo nos dois cálculos derivados.

```ts
// packages/shared/src/ability.ts (ou level.ts irmão)
export function proficiencyBonusForLevel(level: number): number
export function maxHpForLevel(hitDice: string | undefined, level: number, conMod: number): number
```

**Persistência:** nenhuma mudança de schema. `CreateCharacterSchema.level` (Zod, `apps/api/src/character/character.schema.ts`) é o único contrato novo, espelhando a coluna que já existe.

---

## Critérios de aceite

- [ ] Etapa `class` do wizard tem um seletor de nível inicial (1–20, default 1) visível para qualquer classe escolhida.
- [ ] Criar um personagem com nível 5 → `Character.level` persiste `5` (verificável via `GET /characters/:id`).
- [ ] Criar um Bárbaro (`hitDice: "1d12"`) e um Mago (`hitDice: "1d6"`) no MESMO nível (ex. 5), mesmo CON → `CharacterState.maxHp` dos dois é DIFERENTE, maior no Bárbaro.
- [ ] Criar o MESMO Bárbaro em nível 1 e em nível 5 → `maxHp` do nível 5 é maior (5× a contribuição por nível do `1d12`, mais `conMod` por nível).
- [ ] Bônus de proficiência de uma perícia/salvaguarda de um personagem nível 5 mostra +3 (não +2); nível 9, +4; nível 17-20, +6 — em qualquer tela que resolva perícia (ficha em `/play`, prompt do Mestre).
- [ ] O `previewHp` da etapa de revisão do wizard bate exatamente com o `maxHp` que a API grava ao criar a aventura — não há divergência entre o número mostrado antes de confirmar e o número real da ficha.
- [ ] Personagem sem `level` no banco (artefato pré-migração, hipótese: nenhum existe hoje já que a coluna sempre teve `@default(1)`) ou classe sem `hitDice` no config (artefato pré-US-209) não crasha — cai no fallback nível 1 / `10 + conMod`.
- [ ] **Eval/teste de regressão:** `ability.test.ts` cobre as fronteiras de `proficiencyBonusForLevel` (1, 4, 5, 8, 9, 12, 13, 16, 17, 20) e `maxHpForLevel` para pelo menos 2 dados diferentes (`1d6`, `1d12`) em 3 níveis (1, 2, 5); `adventure.service.test.ts` cobre `maxHp` variando por classe+nível na criação real de uma aventura.

---

## Notas de implementação

- **Fórmula de PV por nível, forma exata:** nível 1 = `sides + conMod` (o dado no MÁXIMO, regra 5e para o primeiro nível de qualquer classe); cada nível de 2 a N soma `Math.ceil(sides / 2) + 1 + conMod`. Para `1d12`: nível 1 = `12 + conMod`; nível 5 = `12 + 4×(7) + 5×conMod` = `40 + 5×conMod`. Testar contra a tabela oficial do PHB (`1d12` nível 5 = 40 PV base, CON 14/+2 → 50) para pegar erro de off-by-one antes do merge.
- **Parse de `hitDice`:** `/^(\d+)d(\d+)$/i.exec(hitDice)` — string sempre `"1d<sides>"` (US-209 só normaliza para `NdM` com N=1; nenhuma classe do 5e tem hit die múltiplo). Não reusar `normalizeDie` de [roll.ts:55](../../../packages/shared/src/roll.ts:55) — aquela função existe para tolerar texto ruidoso vindo do MODELO (`"+1d20"` etc.), aqui a entrada é `config.classes[].hitDice`, já validado e confiável; um parser de 2 grupos é suficiente e mais simples.
- **Onde a resolução de `hitDice` acontece:** `config.classes?.find(c => c.key === character.class)?.hitDice` já é o padrão usado por `savingThrows`/`skillProficiencies` (US-222, US-224) — reusar a mesma forma de lookup, não inventar um índice novo.
- **Fallback de config sem `hitDice`:** sistema `Free` herda `config.classes` do artefato SRD (mesmo raciocínio já documentado em US-224 §Fora do escopo) — os 13 `hitDice` chegam de graça. Só um config MANUALMENTE editado sem passar pelo ingest ficaria sem o campo; tratar como "artefato legado", não como caso a otimizar.
- **Arquivo principal a tocar:** `packages/shared/src/ability.ts` (funções novas) → `apps/api/src/character/character.schema.ts` (DTO) → `apps/api/src/character/character.service.ts` (persistência) → `apps/api/src/adventure/adventure.service.ts` (PV real) → `apps/web/src/app/play/[adventureId]/page.tsx` (bônus de proficiência na ficha) → `apps/web/src/components/setup/SetupWizard.tsx` (seletor + preview). Nessa ordem: dado antes de consumidor, backend antes de frontend.

---

## Questões em aberto

1. **`previewHp` do wizard precisa do `hitDice` da classe ainda não confirmada como card selecionado — de onde vem?** Mesmo padrão de `subclassCatalog`/`resolvedSubclass` (`:410`): `config.classes?.find(c => c.key === charClass)?.hitDice`, já disponível no `system.config` carregado no cliente — sem chamada de API nova.

---

## Referências no código

- [apps/api/prisma/schema.prisma:47](../../../apps/api/prisma/schema.prisma:47) — `Character.level`, coluna já existente, nunca escrita além do default.
- [apps/api/src/character/character.schema.ts:19](../../../apps/api/src/character/character.schema.ts:19) — `CreateCharacterSchema`, onde `level` entra como campo novo.
- [apps/api/src/character/character.service.ts:201](../../../apps/api/src/character/character.service.ts:201) — `level: 1` fixo, vira `dto.level ?? 1`.
- [apps/api/src/adventure/adventure.service.ts:463-465](../../../apps/api/src/adventure/adventure.service.ts:463) e [:498](../../../apps/api/src/adventure/adventure.service.ts:498) — PV e bônus de proficiência fixos, os dois consumidores reais.
- [apps/web/src/app/play/[adventureId]/page.tsx:37-44](../../../apps/web/src/app/play/[adventureId]/page.tsx:37) — comentário `ponytail:` que já descreve a fórmula exata do bônus de proficiência por nível.
- [packages/shared/src/ability.ts:56-74](../../../packages/shared/src/ability.ts:56) — `buildSkillSheet`, comentário `:60-61` com o mesmo aviso; onde `proficiencyBonusForLevel` deve morar ao lado.
- [packages/shared/src/roll.ts:55-58](../../../packages/shared/src/roll.ts:55) — `normalizeDie`, convenção de notação `NdM` (não reusar diretamente, ver §Notas de implementação).
- [apps/web/src/components/setup/SetupWizard.tsx:283](../../../apps/web/src/components/setup/SetupWizard.tsx:283), [:581](../../../apps/web/src/components/setup/SetupWizard.tsx:581), [:840](../../../apps/web/src/components/setup/SetupWizard.tsx:840), [:1069](../../../apps/web/src/components/setup/SetupWizard.tsx:1069), [:1672](../../../apps/web/src/components/setup/SetupWizard.tsx:1672) — estado de `subclass` (padrão a espelhar para `level`), preview de PV, payload de criação, UI da etapa `class`, revisão.
- [docs/sdlc/01-requisitos/US-209-hit-dice-e-salvaguardas-de-classe-no-config.md](./US-209-hit-dice-e-salvaguardas-de-classe-no-config.md) — origem do `hitDice`, dado sem consumidor até esta story.
- [scripts/srd/ingest.mjs:463](../../../scripts/srd/ingest.mjs:463) — comentário que documenta o corte de `classFeatures` em nível 1 (limite explícito desta story, ver §Fora do escopo).
