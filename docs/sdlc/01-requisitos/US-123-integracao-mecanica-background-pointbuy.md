# US-123 — Integração mecânica: bônus de atributo do background em `pointBuy`

**Épico:** 1 — Personagem
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** [US-121](./US-121-catalogo-backgrounds-a5e-adventurers-guide.md) (catálogo `config.backgrounds`) · [US-122](./US-122-escolha-background-catalogo-na-criacao.md) (escolha do background, awareness apenas — esta story mecaniza um dos dois benefícios que ela deixou só texto) · [US-26](./US-26-criacao-personagem-em-etapas.md) (ordem das etapas do wizard, que esta story reordena)
**Relacionado:** [US-131](./US-131-integracao-mecanica-background-proficiency.md) (spinoff desta story: mecaniza o OUTRO benefício, `skill_proficiency`, em `proficiency` — separado por ter dois formatos de texto e lacuna de catálogo, `ability_score` não tem nenhum dos dois) · [US-51](./US-51-kits-iniciais-do-srd.md) (precedente direto: parser de texto livre do dataset → dado estruturado, tabela de armadilhas medidas) · [ADR 004](../../adr/004-origem-do-dado-de-sistema.md) §4 (relatar em vez de esconder lacuna do dataset)
**Criada em:** 2026-08-08

---

## História

> **Como** jogador,
> **quero** que o background que escolhi (US-122) realmente aumente um atributo — não só apareça como texto na ficha,
> **para que** minha escolha de background pese na mecânica do personagem, do mesmo jeito que classe já pesa em `startingKits`/`classFeatures`.

---

## Contexto e motivação

### O problema observado

A US-122 deixou os benefícios do background como **awareness apenas** — mesmo tratamento de `classFeatures`, texto que o jogador lê mas nada aplica. Só que `classFeatures` é awareness *de propósito* (são poderes narrativos, "o que o personagem sabe fazer", sem custo/uso mecânico — ver comentário em [system.ts:32-34](../../../packages/shared/src/types/system.ts:32)). `ability_score` **não é disso**: é exatamente o que `pointBuy` (etapa `attributes`) já mecaniza para o resto do personagem. Deixá-lo como texto é a mesma lacuna que a US-51 fechou para o kit inicial — dado que já existe, mecânica que já existe, faltando só a ligação.

Esta story cobre só `ability_score`. O irmão `skill_proficiency` virou [US-131](./US-131-integracao-mecanica-background-proficiency.md): os dois têm formato de texto e regra de aplicação totalmente diferentes (um bônus fixo 1:1 sem exceção vs. dois formatos de lista + lacuna de catálogo em `Culture`/`Engineering`), e misturar os dois numa story só inflava o escopo sem ganho — nenhuma das duas metades depende do dado da outra, só compartilham infraestrutura (reorder do wizard, união `SystemBackgroundGrantSchema`, campo `origin`).

### O que o dataset realmente diz (medido em 08/08/2026, as 21 entradas)

**`ability_score` — 100% regular, um padrão só:**

```
"+1 to Wisdom and one other ability score."
```

Todas as 21 entradas seguem `+1 to <Habilidade fixa> and one other ability score.` — um bônus fixo + um bônus livre à escolha do jogador em **qualquer outra** habilidade (não um subconjunto temático, diferente do PHB 2024 oficial). Regra 1:1, sem exceção medida, sem lacuna de catálogo (`config.attributes` já cobre as 6 habilidades padrão, nenhuma delas fora do sistema).

### Por que a solução atual não basta

`buildCharacterAttributesSchema` ([system.ts:169](../../../packages/shared/src/types/system.ts:169)) valida `baseAttributes` contra min/max do config — não tem noção de "bônus aplicado depois do point-buy". A mecânica existe, mas não sabe que background existe.

### A proposta

1. **No ingest** (estende US-121): parsear `ability_score` em dado estruturado, no mesmo espírito do `parseStartingKit` da US-51 — texto do dataset é frágil, dado estruturado é o que o service consome.
2. **No wizard**: mover a etapa `background` para **antes** de `attributes`/`skills` (ordem hoje é `system → race-class → attributes → skills → background → review`; passa a `system → race-class → background → attributes → skills → review`) — é a mesma ordem do PHB 2024 (background decide o bônus de atributo *antes* de você alocar pontos) e evita reabrir uma etapa já "fechada". A US-131 reaproveita este reorder — `skills` já fica depois de `background` por transitividade, sem precisar mexer de novo.
3. **No service**: aplicar o bônus de atributo por cima do `baseAttributes`.

---

## Escopo

### Dentro do escopo

- **Ingest (`scripts/srd/ingest.mjs`, estende `buildBackgrounds` da US-121):** para benefícios `type === 'ability_score'`, parsear `+1 to (\w+) and one other ability score\.` → `{ fixed: '<chave do atributo>', freeCount: 1 }`, usando o `ABILITY_MAP`/`ATTR_ORDER` que já existe no ingest.
- **`SystemBackgroundBenefitSchema`** (US-121, `packages/shared`) ganha um campo opcional `grant`, discriminado por `kind`, só presente quando o parser reconhece o padrão. Nesta story a união tem só o membro `'ability'` — a US-131 adiciona `'skills'` ao mesmo `SystemBackgroundGrantSchema`, sem reabrir o membro `'ability'`:
  ```ts
  grant: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('ability'), fixed: z.string(), freeCount: z.number().int().min(0) }),
  ]).optional()
  ```
- **Reordenar `Step`/`steps`** em `SetupWizard.tsx` ([:13-14](../../../apps/web/src/components/setup/SetupWizard.tsx:13)): `background` passa para a posição 3 (depois de `race-class`, antes de `attributes`).
- **Etapa `background`:** quando o cartão escolhido tem `grant.kind === 'ability'`, mostra um texto informativo do bônus — "+1 fixo em `<atributo>`, +1 à escolha em outro atributo" — avisando o jogador do que ele vai decidir na etapa seguinte. Nenhum `<select>` aqui; é só aviso, mesmo espírito do texto de benefício que já aparece no cartão (US-122).
- **Etapa `attributes`:** quando o background tem `grant.kind === 'ability'`, um banner no topo da etapa reforça o que já foi anunciado em `background` ("Acólito concede +1 fixo em Sabedoria e +1 bônus — escolha outro atributo abaixo"). A linha de `grant.fixed` ganha um selo sólido `+1 origem`, sempre visível, sem interação. Cada outra linha (`config.attributes` exceto `grant.fixed`) mostra um selo **fantasma** tracejado `+1 bônus` — mesma forma/posição do selo sólido, só vazado — enquanto nenhuma estiver escolhida; a linha inteira é a área de clique. Ao clicar, o selo daquela linha vira sólido `+1 origem` e os selos fantasma das **outras** linhas somem; clicar de novo na linha escolhida desmarca, e os selos fantasma **reaparecem** nas demais. O `+1` fixo e o `+1` do bônus somam **por cima** do valor de point-buy — não consomem `budget`/`remaining`.
- **`CreateCharacterSchema.origin`** (US-122, campo irmão de `background`) ganha `abilityChoice?: string` (a chave do atributo livre) — fica junto de `origin.key`, nunca dentro de `background`. (`skillChoice`, campo irmão para o benefício de perícia, é da US-131 — mesmo objeto `origin`, adicionado lá.)
- **`CharacterService.create`**: resolve o `grant` da origem escolhida (se houver `origin.key`), valida `abilityChoice` contra o `grant` (chave fora de `config.attributes`, ausente quando o grant exige, **ou igual a `grant.fixed`** — repetir o atributo fixo não é "outro atributo", rejeita nos três casos), aplica o bônus de atributo em `baseAttributes` antes de persistir: soma `+1` em `grant.fixed` e `+1` em `abilityChoice`, dois atributos sempre distintos.
- **Testes**: `ingest.test.mjs` cobre o parser de `ability_score`; `character.service.test.ts` cobre bônus aplicado, escolha inválida rejeitada (fora do catálogo, ausente, **e igual a `grant.fixed`**), e personagem **sem** background (comportamento idêntico ao de hoje, sem regressão).

### Fora do escopo

- **`skill_proficiency`** — vira [US-131](./US-131-integracao-mecanica-background-proficiency.md).
- **`tool_proficiency` e `language`** — o projeto não tem catálogo de ferramentas nem de idiomas (`config` não tem `tools`/`languages`); mecanizar exigiria um subsistema novo do zero. Ficam texto (US-122).
- **`equipment`, `feature`, `connection_and_memento`, `adventures_and_advancement`** — mesma exclusão já feita na US-122.
- **Retroagir personagens já criados** — a mecânica vale só para criação nova, mesmo corte da US-51 (`baseAttributes` de personagem existente não muda).
- **Backgrounds do `srd-2024` nativo** — a US-121 decidiu não trazê-los; fora do escopo por não existirem no catálogo, não por decisão pendente.

---

## Modelo de dados proposto

Extensão de `SystemBackgroundBenefitSchema` (US-121):

```ts
export const SystemBackgroundGrantSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('ability'), fixed: z.string().min(1), freeCount: z.number().int().min(0) }),
  // US-131 adiciona aqui um segundo membro, kind: 'skills' — mesma union, story separada.
])

// em SystemBackgroundBenefitSchema:
grant: SystemBackgroundGrantSchema.optional(),
```

Extensão de `CreateCharacterSchema.origin` (US-122 — **não** `background`):

```ts
origin: z.object({
  key: z.string().max(80).optional(),
  abilityChoice: z.string().max(40).optional(), // atributo escolhido para o +1 livre
  // US-131 adiciona aqui skillChoice — mesmo objeto origin, story separada.
}).optional(),
```

| Campo | Tipo | Descrição |
|---|---|---|
| `benefit.grant` | union (opcional) | Presente só quando o parser reconheceu o padrão de `ability_score` |
| `origin.abilityChoice` | string (opcional) | Preenchido quando `grant.kind === 'ability'`; sempre **diferente** de `grant.fixed` (o segundo ponto é em "outro atributo", RAW) |

**Persistência:** sem coluna nova além da que a US-122 já cria — o bônus de atributo é absorvido em `Character.baseAttributes` (soma aplicada antes de persistir). `Character.origin.key` (US-122) continua sendo o rastro de onde veio o bônus — `Character.background` (US-39) não é tocado por esta story.

---

## Critérios de aceite

- [x] `buildBackgrounds` deriva `grant` para os 21 `ability_score` (padrão único, 100% de cobertura medida).
- [x] Etapa `background` passa a ser a 3ª etapa do wizard (depois de `race-class`); trilha de progresso e `steps[]` refletem a nova ordem sem quebrar navegação (`goTo`/`canAdvance` continuam funcionando por índice).
- [x] Etapa `background`: background com `grant.kind === 'ability'` mostra o texto do `+1` fixo + aviso do `+1` à escolha — sem `<select>` nesta etapa, só informativo.
- [x] Etapa `attributes`: background com `grant.kind === 'ability'` mostra o banner de reforço no topo, o selo sólido `+1 origem` fixo na linha de `grant.fixed`, e o selo fantasma `+1 bônus` nas demais linhas enquanto nada estiver escolhido; sem selecionar nenhuma, `abilityChoice` fica vazio e a criação é rejeitada **só se** o background tiver esse grant (background sem `ability_score` reconhecido, ou nenhum background escolhido, não exige nada). Os dois `+1` do background aparecem somados ao valor de point-buy, **sem consumir `remaining`**.
- [x] A linha de `grant.fixed` **nunca mostra o selo fantasma nem é clicável** (só o selo sólido) — Acolyte (`fixed: wisdom`) mostra `+1 bônus` fantasma nas outras 5 linhas, nunca em Sabedoria.
- [x] Clicar numa linha diferente move `abilityChoice` pra ela — o selo sólido migra e os selos fantasma somem das linhas não escolhidas; clicar na linha já escolhida desmarca (`abilityChoice` volta a vazio) e os selos fantasma **reaparecem** em todas as linhas elegíveis.
- [x] `CharacterService.create` rejeita (`BadRequestException`) `origin.abilityChoice` fora de `config.attributes`, ausente quando o `grant` exige, **e igual a `grant.fixed`** (escolher o mesmo atributo do bônus fixo pro bônus livre).
- [x] `baseAttributes` final = point-buy + bônus fixo + bônus livre do background. O `max` do `buildCharacterAttributesSchema` segue valendo pro valor **de point-buy puro** (antes do bônus de background); o bônus do background pode estourar esse teto — regra RAW (PHB 2024: bônus de origem soma depois do array/point-buy, sem cap adicional). Validação do bônus de background usa só `min` (não pode ficar negativo) e ignora `max`.
- [x] Personagem criado **sem** escolher background (US-122 continua opcional): `baseAttributes` idêntico ao comportamento de hoje, nenhuma validação nova disparada.
- [x] **Eval / teste de regressão:** `character.service.test.ts` cria um personagem com background `a5e-ag_acolyte` (fixed `Wisdom`, `abilityChoice: 'constitution'`) e confere `baseAttributes.wisdom` = default+1(point-buy se houver)+1(background) **e** `baseAttributes.constitution` = default+1(point-buy se houver)+1(background) — os dois pontos aplicados em atributos diferentes. Teste separado cobre `abilityChoice: 'wisdom'` (igual a `fixed`) rejeitado.

---

## Notas de implementação

- **Parser isolado e testável**, mesmo padrão do `parseStartingKit` da US-51 ([ingest.mjs](../../../scripts/srd/ingest.mjs)): função pura `parseAbilityGrant(desc)`, entrada = string crua do dataset, saída = grant estruturado ou `undefined` (padrão não reconhecido — falha alto, igual ao `CLASS_MAP`, porque os 21 batem 100% hoje e um formato novo num bump merece ser visto, não engolido).
- **A ordem do wizard muda, mas `Step`/`steps` continuam sendo só um array** — `goTo`/`canAdvance`/`next`/`back` operam por índice ([SetupWizard.tsx:128-157](../../../apps/web/src/components/setup/SetupWizard.tsx:128)), então mover `'background'` de posição no array `steps` já reordena a trilha e a navegação sem tocar nessas funções. A US-131 herda este reorder — não reabre.
- **Esboço da etapa `attributes` com `grant.kind === 'ability'`:**
  1. **Banner** no topo da etapa (mesmo padrão visual dos avisos já usados no wizard, ícone + fundo `success`): reforça em uma linha o que a etapa `background` já anunciou — `"<Background> concede +1 fixo em <Atributo> e +1 bônus — escolha outro atributo abaixo."`
  2. **Selo fixo**: a linha de `grant.fixed` (ex.: Sabedoria pro Acolyte) ganha um selo `+1 origem` ao lado do contador de point-buy, sempre visível, sem nenhum controle — o jogador não interage com essa linha além do point-buy normal.
  3. **Selo fantasma nas demais linhas, linha inteira clicável**: cada linha de `config.attributes` que não é `grant.fixed` mostra um selo tracejado `+1 bônus` (mesmo componente do selo sólido `+1 origem`, variante vazada) enquanto `abilityChoice` estiver vazio — a linha inteira é a área de clique, alvo maior que um botão isolado. Ao clicar: `abilityChoice` recebe a chave daquela linha, o selo vira sólido `+1 origem`, e os selos fantasma das **outras** linhas somem (renderização condicional, não fica chrome disputando atenção com a linha escolhida). Clicar de novo na linha já escolhida zera `abilityChoice`, e os selos fantasma **reaparecem** em todas as linhas elegíveis. Nenhuma linha precisa de filtro pra excluir `grant.fixed` — ela nunca mostra o selo fantasma nem responde a clique, é a única sempre sólida.
  4. **Contador de point-buy** de cada linha (`−`/valor/`+`) mostra o total já somado (`base point-buy + selo`, se houver) — mesmo padrão visual que já existe, sem `<select>` nem botão novo, só o selo e a área de clique da linha.
- **`canAdvance('background')` continua sem condição própria** (US-39, `true` incondicional) — a etapa só mostra aviso, não bloqueia nada. **`canAdvance('attributes')` precisa de uma condição nova**: hoje é `budget === undefined || remaining === 0`. Ganha `&& (grant?.kind !== 'ability' || !!abilityChoice)` — só avança com `remaining === 0` **e** (se o background tiver `grant.kind === 'ability'`) alguma linha selecionada (`abilityChoice` preenchido). A US-131 estende a condição equivalente de `canAdvance('skills')` com a parte de `skillChoice` — mesmo padrão, etapa separada.

---

## Referências no código

- [scripts/srd/ingest.mjs](../../../scripts/srd/ingest.mjs) — `parseStartingKit` (precedente de parser texto→estruturado, US-51), `ABILITY_MAP`/`ATTR_ORDER` (linha 111-112, reusar para resolver nome de atributo), `buildBackgrounds` (US-121, a estender).
- [packages/shared/src/types/system.ts](../../../packages/shared/src/types/system.ts) — `SystemBackgroundBenefitSchema` (US-121, a estender com `grant`), `buildCharacterAttributesSchema` (`min`/`max` valem pro point-buy puro; bônus de background só respeita `min`, ver critério de aceite).
- [apps/api/src/character/character.schema.ts](../../../apps/api/src/character/character.schema.ts) — `CreateCharacterSchema.origin` (US-122), `abilityChoice` novo ali dentro.
- [apps/web/src/components/setup/SetupWizard.tsx:13-14,128-157](../../../apps/web/src/components/setup/SetupWizard.tsx:13) — `Step`/`steps` (reordenar), `canAdvance('attributes')` (nova condição — texto informativo fica em `background`, escolha e bloqueio ficam em `attributes`).
- [US-121](./US-121-catalogo-backgrounds-a5e-adventurers-guide.md) / [US-122](./US-122-escolha-background-catalogo-na-criacao.md) — dependências diretas.
- [US-131](./US-131-integracao-mecanica-background-proficiency.md) — spinoff, mecaniza `skill_proficiency` sobre a mesma infraestrutura (reorder, `SystemBackgroundGrantSchema`, `origin`).
- [US-51](./US-51-kits-iniciais-do-srd.md) — precedente completo de parser de texto do dataset com tabela de armadilhas medidas.
