# US-213 — Etapa "Magias" no wizard, com escolha de truque do Alto-elfo

**Épico:** 1 — Personagem
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada (07/09/2026)
**Depende de:** [US-42](./US-42-magias-conhecidas.md) (`Character.spells`, `config.classSpells`, `getClassSpells` — a mecânica de magia por classe que esta story estende com uma fonte extra) · [US-142](./US-142-tracos-mecanicos-subespecie-srd-5-1.md) (traço `cantrip` do Alto-elfo, hoje só texto em `raceFeatures['high-elf']`, sem mecânica) · [US-212](./US-212-bonus-de-atributo-de-raca-na-etapa-de-atributos.md) (nomeou explicitamente este truque como *fora do escopo* — "Escolha dentro de traço de subclasse/raça além do ASI (ex. truque de mago do Alto-elfo — US-142 Questão em aberto #3, já adiada)" — esta story é esse reabrir)
**Relacionado:**
- [US-207](./US-207-atributos-e-pericias-com-orcamento-visivel.md) — etapa `skills` atual, logo antes de onde `spells` entra.
- [US-50](./US-50-magias-na-ficha-da-interface.md) — já mostra as magias conhecidas (nome + nível + descrição) na etapa `review`, via `FeaturesPanel`/`previewSpells`; esta story reusa a mesma leitura, não duplica a exibição.
- [US-210](./US-210-identidade-como-etapa-propria.md) — outra etapa nova, ainda não implementada (📋 Planejada); decisão de 2026-09-04 (ver *Questões em aberto* #1, resolvida): `identity` fica DEPOIS de `spells`, ambas antes de `review`.
- [US-140](./US-140-catalogo-subracas-srd-5-1.md) — só `high-elf` (Alto-elfo) é chave jogável hoje; a raiz `elf` sem subespécie não é opção no catálogo (US-142), então "o jogador escolheu elfo" na prática só pode significar Alto-elfo.

**Criada em:** 2026-09-04

---

## História

> **Como** jogador que cria um personagem,
> **quero** uma etapa própria de "Magias" no assistente, entre Perícias e Revisão, que mostre as magias que meu personagem já vai ter — e que, se eu escolhi Alto-elfo, me deixe escolher ali o truque de mago bônus da minha raça,
> **para que** eu veja minhas magias antes da revisão final e não perca o truque extra do Alto-elfo, que hoje nem aparece como escolha em lugar nenhum.

---

## Contexto e motivação

### O problema observado

O traço racial do Alto-elfo (`raceFeatures['high-elf']`, chave `cantrip`, "Truque de Mago" — US-142) concede **um truque à escolha da lista de magias do Mago**. Hoje ele só existe como **texto** no painel de traços da etapa `race` (`raceStepFeatures`, `SetupWizard.tsx:459-463`) — não há `<select>`, não há campo no DTO, não há validação. O jogador lê "você aprende um truque à sua escolha da lista de magias do mago" e não tem onde escolher; o personagem nasce sem esse truque.

A [US-212](./US-212-bonus-de-atributo-de-raca-na-etapa-de-atributos.md), ao mecanizar o bônus de atributo de raça, **nomeou essa lacuna explicitamente** e a deixou de fora do próprio escopo — confirmando que é dívida reconhecida, não decisão de produto. Esta story é esse reabrir.

### Por que não é só mais um campo dentro da etapa `race`

A etapa `race` (US-205) já acumula campo condicional por raça — ancestralidade dracônica do Dragonborn (US-211), ferramenta racial do Anão da Colina (US-142/US-212) — cada um resolvido **ali mesmo**, porque são escolhas sobre a própria identidade racial (que dragão, que ferramenta), fechadas antes de saber a classe. O truque do Alto-elfo é diferente: a lista de onde escolher é a do **Mago** (`config.classSpells['wizard']`), um catálogo de **classe**, não de raça. Colocar o `<select>` na etapa `race` obrigaria a etapa a conhecer o catálogo de magia de uma classe que o jogador pode nem ter escolhido ainda (a etapa `race` vem **antes** de `background`/`attributes`/`skills`, mas a classe já foi escolhida na etapa anterior, `class` — então o dado existe, só que semanticamente pertence à seção de magia, não à de raça).

Além disso, o personagem já tem magias de classe — 0 a 20 truques, mais as 2 magias fixas de Paladino/Patrulheiro (US-42) — que hoje só aparecem na **Revisão** (US-50), depois de todas as escolhas fechadas. Uma etapa própria de "Magias", entre Perícias e Revisão, dá ao jogador uma prévia do que ele vai ter **antes** da tela final, e é o lugar natural para hospedar a única escolha real que o sistema de magia tem hoje: o truque bônus do Alto-elfo.

### O que NÃO muda

O modelo de magia da US-42 continua **awareness apenas**: toda classe conjuradora recebe automaticamente **todos** os truques da sua lista, sem escolha nenhuma — isso não muda. A única escolha introduzida por esta story é a **exceção racial** do Alto-elfo, que é assim no PHB/SRD (a raça concede um truque *fora* da lista automática da classe do personagem, de uma lista *diferente* — a do Mago).

---

## Escopo

### Dentro do escopo

- **Nova etapa `spells`**, entre `skills` e `review`. `Step`/`steps` (`SetupWizard.tsx:34-35`) ganham a chave nova nessa posição; só `review` e `world` deslocam uma posição, mesma disciplina das inserções anteriores (US-205, US-211).
- **Lista somente-leitura das magias da classe**, reaproveitando `previewSpells`/`getClassSpells`/`resolveSheetEntries` já calculados (`SetupWizard.tsx:439-442`) — mesmo formato nome + rótulo de nível + descrição que a Revisão (US-50) já usa. Não recalcula, não duplica lógica.
- **Estado vazio** quando a classe não concede magia nenhuma (`spells.length === 0`) e a raça não é `high-elf` (ou é `high-elf` mas o catálogo de truque do Mago está vazio): mensagem explicativa ("Este personagem não tem magias."), sem bloquear avanço — mesmo espírito do empty state da US-50, adaptado de aba de ficha para etapa de wizard.
- **Escolha do truque do Alto-elfo**, visível só quando `charData.race === 'high-elf'` **e** `config.classSpells['wizard']` tem pelo menos um truque (nível 0): um `<select>` "Escolha um truque de mago" com as opções de `config.classSpells['wizard'].filter(s => s.level === 0)`, mesmo `fieldClass`/`SELECT_ARROW` dos demais `<select>` do wizard (padrão de `draconicAncestry`/`raceToolChoice`).
- **`canAdvance('spells')`** exige a escolha preenchida quando o `<select>` é exigível (high-elf + catálogo não vazio); nos demais casos, a etapa nunca bloqueia avanço.
- **Reset da escolha ao trocar de raça**: `selectRootCard`/`handleSelectSystem` ganham `setRaceCantripChoice(undefined)` ao lado dos resets já existentes de `draconicAncestry`/`raceToolChoice`/`raceAbilityChoice` — trocar de Alto-elfo para outra raça (ou vice-versa) não deixa escolha órfã.
- **`raceCantripChoice`** novo no DTO (`character.schema.ts`), sibling de `race`/`raceToolChoice`: `z.string().max(80).optional()`.
- **`character.service.ts`**: quando `race === 'high-elf'` e `config.classSpells?.['wizard']` tem truque(s), valida `dto.raceCantripChoice` contra essa lista (`validateCatalogKey`, mesma função já usada por `draconicAncestry`/`raceToolChoice`/`class`/`race`) e **soma** a magia escolhida a `Character.spells` — sem duplicar se a classe do personagem já concede o mesmo truque (ex.: um Mago Alto-elfo escolhendo um truque que já teria de qualquer forma).
- **Trilha de progresso**: chip "Magias" (`setup.step.spells`) entre "Perícias" e "Revisão", navegável de volta como as demais.
- **i18n**: `setup.step.spells`, rótulo da etapa, mensagem de estado vazio e rótulo do `<select>` nos dois locales (US-98).
- **Mobile**: etapa em coluna única (US-66) — é lista + um `<select>`, sem grade, layout de formulário simples já cobre.

### Fora do escopo

- **Motor de spellcasting** (slots, preparação, componentes, concentração, upcasting) — continua fora, mesmo corte da US-42.
- **Escolha de magias para qualquer outra classe/raça/traço.** Hoje o único traço de "escolha de magia" no dataset ingerido é o `cantrip` do Alto-elfo (confirmado pela US-142 §Modelo de dados e pela US-212 §Fora do escopo, que são as duas únicas stories a mencionar esse caso). Generalizar para um mecanismo genérico de "escolha de magia por traço" sem um segundo consumidor é abstração sem propósito (YAGNI) — se outra raça/feat com o mesmo formato aparecer num bump futuro do SRD, a etapa `spells` já existe para hospedar o segundo `<select>`.
- **Mudar o modelo "awareness apenas"** de truques de classe (US-42) — continuam 100% automáticos, sem escolha. Só o bônus **racial** do Alto-elfo é interativo.
- **Editar a escolha depois de criado o personagem** — mesmo corte de qualquer campo da criação (raça, classe, atributos): a ficha é read-only depois de criada.
- **Migração de personagens existentes** — nenhum Alto-elfo existe hoje sem essa story (chave `high-elf` é recente, US-140); não há ficha para retroagir.
- **Mostrar a proveniência do truque na ficha** (ex.: badge "traço racial" ao lado do truque do Alto-elfo, distinguindo-o dos truques normais da classe) — a magia entra em `Character.spells` como uma entrada igual às demais; diferenciar visualmente na aba Features (US-50) é UI nova, sem pedido nem precedente aqui.

---

## Modelo de dados proposto

```ts
// apps/api/src/character/character.schema.ts — CreateCharacterSchema, sibling de raceToolChoice
raceCantripChoice: z.string().max(80).optional(),
```

```ts
// apps/api/src/character/character.service.ts — logo após `const spells = getClassSpells(config, charClass)`
// `spells` já é `string[]` (chaves) — getClassSpells só devolve `.map((s) => s.key)` (US-100),
// não os objetos `SystemSpell` completos. Dedupe e merge são diretos sobre chave, sem `.find`.
const wizardCantrips = (config.classSpells?.['wizard'] ?? []).filter((s) => s.level === 0)
const raceCantripKey = race === 'high-elf' && wizardCantrips.length > 0
  ? this.validateCatalogKey(wizardCantrips, dto.raceCantripChoice ?? '', 'Truque do Alto-elfo')
  : undefined
const spellsWithRaceCantrip = raceCantripKey && !spells.includes(raceCantripKey)
  ? [...spells, raceCantripKey]
  : spells
```

| Campo | Antes | Depois |
|---|---|---|
| `CreateCharacterDto.raceCantripChoice` | não existe | novo, opcional — chave de `config.classSpells['wizard']` (nível 0). Exigido pelo `canAdvance` do wizard só quando `race === 'high-elf'` e há truque de mago no catálogo; validado no service com a mesma regra. |
| `Character.spells` (persistido) | chaves de truques/magias da classe (US-42, US-100) | idem + a chave do truque do Alto-elfo, quando aplicável — mesmo array de `string`, sem campo novo de proveniência. |

**Persistência:** sem migração Prisma — `Character.spells` já é `Json`; o truque extra só é mais um elemento do array existente, mesmo padrão de `applyRaceGrant`/`applyAbilityGrant` somando sobre um campo já persistido.

---

## Critérios de aceite

- [x] `Step`/`steps` ganham `'spells'` entre `'skills'` e `'review'`; só `'review'` e `'world'` deslocam uma posição.
- [x] A etapa `spells` mostra a lista somente-leitura das magias que a classe escolhida concede (nome, rótulo de nível, descrição), idêntica ao que a Revisão já mostra hoje.
- [x] Classe sem magia (`spells.length === 0`) e raça diferente de `high-elf` (ou `high-elf` sem truque de mago no catálogo): a etapa mostra um estado vazio explicativo, sem bloquear o avanço.
- [x] `charData.race === 'high-elf'` e `config.classSpells['wizard']` tem ao menos um truque (nível 0): a etapa mostra um `<select>` "Escolha um truque de mago" com essas opções.
- [x] `canAdvance('spells')` bloqueia o avanço enquanto o `<select>` do Alto-elfo, quando exigível, estiver vazio; nos demais casos (não é Alto-elfo, ou catálogo de truque do Mago vazio), a etapa nunca bloqueia.
- [x] Trocar de raça para fora de `high-elf` (ou de volta) limpa a escolha do truque — mesmo padrão de reset de `draconicAncestry`/`raceToolChoice`.
- [x] Trilha de progresso mostra um chip "Magias" entre "Perícias" e "Revisão", navegável de volta como as demais.
- [x] Criar personagem Alto-elfo com `raceCantripChoice` válido: o truque escolhido aparece em `Character.spells`, somado aos truques normais da classe (não substitui nenhum).
- [x] Criar personagem Alto-elfo **Mago** escolhendo um truque que a classe já concede automaticamente: `Character.spells` não tem entrada duplicada para esse truque.
- [x] Criar personagem Alto-elfo **sem** `raceCantripChoice` (quando o catálogo do Mago não é vazio), ou com uma chave que não existe em `config.classSpells['wizard']`, ou com uma magia de nível ≥ 1: rejeitado (`BadRequestException`, valor ofensor + formato esperado).
- [x] Criar personagem de raça diferente de `high-elf` com `raceCantripChoice` preenchido (campo indevido): o valor é ignorado, sem erro e sem persistir.
- [x] Sistema sem `config.classSpells['wizard']` (ou vazio): Alto-elfo é criado normalmente sem exigir nem validar o campo.
- [x] Em 360 px de largura, a etapa `spells` é coluna única, sem rolagem horizontal (US-66).
- [x] **Eval / teste de regressão (wizard):** `SetupWizard.test.tsx` cobre — Alto-elfo com Próximo bloqueado sem truque escolhido, liberado ao escolher; classe conjuradora não-Alto-elfo mostra a lista sem `<select>` nem bloqueio; classe não-conjuradora e raça não-Alto-elfo mostra o estado vazio.
- [x] **Eval / teste de regressão (service):** `character.service.test.ts` cobre — Alto-elfo com truque válido (soma a `spells`), truque inválido/nível≥1/ausente quando exigido (rejeitado nos três casos), truque duplicado com o da própria classe (sem duplicar), e raça não-Alto-elfo com o campo ignorado.

---

## Notas de implementação

> Dicas, não especificação. Quem implementa pode divergir com justificativa.

- **Reusar `previewSpells` tal como está** (`SetupWizard.tsx:439-442`) para a lista somente-leitura da nova etapa — é a mesma leitura que a Revisão (US-50) já faz; não recalcular nem reimplementar.
- **Novo estado `raceCantripChoice: string | undefined`**, mesma forma de `draconicAncestry`/`raceToolChoice` (`useState`, não dentro de `charData`) — resetado em `selectRootCard` (`SetupWizard.tsx:536-548`) e em `handleSelectSystem` (`SetupWizard.tsx:496-523`), ao lado dos resets já existentes desses dois campos.
- **`config.classSpells?.['wizard']?.filter(s => s.level === 0) ?? []`** é a fonte do `<select>` — **divergência da spec original**: a tabela "Mapa de classes" da US-42 (anterior à US-54) registrava `'mago'`, mas a US-54 (16/07/2026) renomeou as chaves de classe do catálogo para o canônico EN (`config.classes[].key`, `getClassSpells`) — `'mago'` é hoje só o `label` pt-BR, não uma chave válida. Confirmado em `scripts/srd/ingest.mjs:100` (`'srd_wizard': 'wizard'`) antes de implementar.
- **`validateCatalogKey` (`character.service.ts:179`) já serve sem alteração** — aceita `Array<{key: string}>`, rejeita com `BadRequestException` (valor ofensor + lista esperada) e trata catálogo vazio/ausente como passe-livre (não bloqueia). O `wizardCantrips` filtrado por nível 0 encaixa direto.
- **Dedupe por CHAVE, direto no array de strings** — `Character.spells` (como `Character.features`, US-100) é `string[]` de chaves, não array de objetos: `getClassSpells` já devolve só as chaves (`packages/shared/src/starting-kit.ts:145`). Dedupe é `!spells.includes(raceCantripKey)`, sem precisar resolver o objeto completo do truque — evita duplicar quando o Alto-elfo escolhido também é Mago (a classe já concede os 20 truques; escolher um deles de novo como "bônus" não duplica a entrada na ficha).
- **`api.ts` (`createCharacter`)** ganha `raceCantripChoice?: string` no tipo do payload, sibling de `raceToolChoice` (`apps/web/src/lib/api.ts:68`) — sem isso o campo nunca sai do cliente, mesmo aviso que `character.schema.ts` já registra para os campos irmãos.
- **Prisma:** nenhuma migração — `spells` já existe e já é `Json`.
- **Posição da etapa relativa a `identity` (US-210):** decisão de 2026-09-04 — `spells` fica ANTES de `identity`. Se `identity` já existir no array `steps` quando esta story rodar, `spells` entra entre `skills` e `identity` (não entre `identity` e `review`). Se `spells` for implementada primeiro (caso comum, já que esta story está pronta primeiro), `identity` entra depois dela quando a US-210 rodar — ver *Questões em aberto* #1.

---

## Questões em aberto

1. ~~**Ordem relativa a `identity` (US-210), quando ambas existirem.**~~ — **Resolvida em
   2026-09-04, por instrução direta da mantenedora:** `spells` fica ANTES de `identity`. Ordem final
   da trilha: `... → skills → spells → identity → review → world`. `identity` continua sendo a
   última etapa antes da revisão (US-210, *Revisão de posição (2026-09-04)*) — só o vizinho
   imediato muda, de `skills` para `spells`. Quem implementar `spells` antes de `identity` existir
   não precisa reservar nada; quem implementar `identity` antes de `spells` existir insere-a logo
   após `skills` como a própria US-210 já previa, e a implementação de `spells` (esta story) passa
   a inseri-la entre `skills` e `identity`, empurrando só `identity`/`review`/`world`.
2. **Nome de exibição da etapa.** Esta story usa "Magias" (pt-BR) / mesma chave `setup.step.spells` traduzida para "Spells" em en-US, seguindo o padrão de nome-de-domínio das demais etapas (`setup.step.skills` → "Perícias"/"Skills"). Se o produto quiser um nome diferente (ex. "Feitiçaria", "Grimório"), é troca de string, não de escopo.
3. **Se outro traço de "escolha de magia" aparecer num bump futuro do SRD** (outra subespécie, um feat), a etapa `spells` já existe para hospedar um segundo `<select>` condicional — mas o desenho de "um `<select>` por raça, gated por `charData.race === chave`" só vale para um caso a mais; um terceiro caso pediria generalizar (fora do escopo aqui, mesmo raciocínio "sem terceira fonte, generalizar cedo é abstração sem consumidor" da US-212).

---

## Referências no código

- [apps/web/src/components/setup/SetupWizard.tsx:34-35](../../../apps/web/src/components/setup/SetupWizard.tsx:34) — `type Step` e `const steps`: onde `'spells'` entra entre `'skills'` e `'review'`.
- [apps/web/src/components/setup/SetupWizard.tsx:439-442](../../../apps/web/src/components/setup/SetupWizard.tsx:439) — `previewSpellKeys`/`previewSpells`: a leitura reaproveitada pela nova etapa, hoje só consumida pela Revisão.
- [apps/web/src/components/setup/SetupWizard.tsx:459-463](../../../apps/web/src/components/setup/SetupWizard.tsx:459) — `raceStepFeatures`: onde o traço `cantrip` do Alto-elfo aparece hoje só como texto, sem mecânica.
- [apps/web/src/components/setup/SetupWizard.tsx:536-548](../../../apps/web/src/components/setup/SetupWizard.tsx:536) — `selectRootCard`: onde o reset de `raceCantripChoice` entra, ao lado de `draconicAncestry`/`raceToolChoice`/`raceAbilityChoice`.
- [apps/web/src/components/setup/SetupWizard.tsx:550-606](../../../apps/web/src/components/setup/SetupWizard.tsx:550) — `canAdvance`: onde o `case 'spells'` entra.
- [apps/web/src/lib/api.ts:65-71](../../../apps/web/src/lib/api.ts:65) — `createCharacter`: onde `raceCantripChoice` entra ao lado de `raceToolChoice`/`draconicAncestry`.
- [apps/api/src/character/character.schema.ts:30-39](../../../apps/api/src/character/character.schema.ts:30) — `CreateCharacterSchema`: onde `raceCantripChoice` entra como irmão opcional.
- [apps/api/src/character/character.service.ts:65-90,179-187](../../../apps/api/src/character/character.service.ts:65) — `spells = getClassSpells(...)`, `validateCatalogKey`: onde a validação e o merge do truque do Alto-elfo entram.
- [packages/shared/src/types/system.ts:132-138,259](../../../packages/shared/src/types/system.ts:132) — `SystemSpellSchema`, `classSpells`: a forma da entrada de magia e onde `classSpells['wizard']` vive.
- [US-42](./US-42-magias-conhecidas.md) — origem de `Character.spells`/`classSpells`/`getClassSpells`, o sistema que esta story estende.
- [US-142 §Modelo de dados](./US-142-tracos-mecanicos-subespecie-srd-5-1.md) — o traço `cantrip` do Alto-elfo, ainda texto puro.
- [US-212 §Fora do escopo](./US-212-bonus-de-atributo-de-raca-na-etapa-de-atributos.md) — nomeou esta lacuna e a adiou; esta story é o reabrir.
- [US-50](./US-50-magias-na-ficha-da-interface.md) — exibição de magias já existente (Revisão/ficha), reaproveitada aqui sem duplicar.
