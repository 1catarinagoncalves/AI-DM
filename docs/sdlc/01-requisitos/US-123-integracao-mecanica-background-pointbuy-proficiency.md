# US-123 — Integração mecânica: benefícios de background em `pointBuy`/`proficiency`

**Épico:** 1 — Personagem
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** [US-121](./US-121-catalogo-backgrounds-a5e-adventurers-guide.md) (catálogo `config.backgrounds`) · [US-122](./US-122-escolha-background-catalogo-na-criacao.md) (escolha do background, awareness apenas — esta story mecaniza dois dos benefícios que ela deixou só texto) · [US-27](./US-27-pericias-do-personagem.md) (`config.proficiency`/`validateSkills`) · [US-26](./US-26-criacao-personagem-em-etapas.md) (ordem das etapas do wizard, que esta story reordena)
**Relacionado:** [US-51](./US-51-kits-iniciais-do-srd.md) (precedente direto: parser de texto livre do dataset → dado estruturado, tabela de armadilhas medidas) · [ADR 004](../../adr/004-origem-do-dado-de-sistema.md) §4 (relatar em vez de esconder lacuna do dataset)
**Criada em:** 2026-08-08

---

## História

> **Como** jogador,
> **quero** que o background que escolhi (US-122) realmente aumente um atributo e me dê perícias proficientes — não só apareça como texto na ficha,
> **para que** minha escolha de background pese na mecânica do personagem, do mesmo jeito que classe já pesa em `startingKits`/`classFeatures`.

---

## Contexto e motivação

### O problema observado

A US-122 deixou os benefícios do background como **awareness apenas** — mesmo tratamento de `classFeatures`, texto que o jogador lê mas nada aplica. Só que `classFeatures` é awareness *de propósito* (são poderes narrativos, "o que o personagem sabe fazer", sem custo/uso mecânico — ver comentário em [system.ts:32-34](../../../packages/shared/src/types/system.ts:32)). Dois dos oito tipos de benefício do `a5e-ag` **não são disso**: `ability_score` e `skill_proficiency` são exatamente o que `pointBuy` (etapa `attributes`) e `proficiency` (etapa `skills`) já mecanizam para o resto do personagem. Deixá-los como texto é a mesma lacuna que a US-51 fechou para o kit inicial — dado que já existe, mecânica que já existe, faltando só a ligação.

### O que o dataset realmente diz (medido em 08/08/2026, as 21 entradas)

**`ability_score` — 100% regular, um padrão só:**

```
"+1 to Wisdom and one other ability score."
```

Todas as 21 entradas seguem `+1 to <Habilidade fixa> and one other ability score.` — um bônus fixo + um bônus livre à escolha do jogador em **qualquer outra** habilidade (não um subconjunto temático, diferente do PHB 2024 oficial). Regra 1:1, sem exceção medida.

**`skill_proficiency` — dois formatos:**

| Formato | Exemplo | Contagem |
|---|---|---|
| `<Fixas>, and either <opções, ou>.` | `"Religion, and either Insight or Persuasion."` (Acolyte) | 20/21 |
| `<N> of your choice.` | `"Two of your choice."` (Guildmember) | 1/21 |

Uma a três perícias fixas + escolha de 1 entre 2–4 opções (ou, no caso do Guildmember, escolha totalmente livre de 2).

**A lacuna real: duas perícias do `a5e-ag` não existem no catálogo do sistema.** O `config.skills` do projeto (`scripts/srd/locale/pt-BR.json:11-30`) tem as **18 perícias padrão do 5e**. O `a5e-ag` usa um catálogo de perícias **expandido**, com `Culture` e `Engineering` — que aparecem em 6 dos 21 backgrounds:

| Background | Onde aparece | Fixa ou opcional? |
|---|---|---|
| Noble | `"Culture, History, and either Animal Handling or Persuasion."` | **`Culture` é FIXA** — bloqueia mecanização total do Noble |
| Sage | `"...either Arcana, Culture, Engineering, or Religion."` | `Culture`/`Engineering` só no pool de escolha (ainda sobra Arcana/Religion) |
| Charlatan, Entertainer, Trader | `Culture` só no pool de escolha | idem — degrada, não bloqueia |

### Por que a solução atual não basta

`validateSkills` ([character.service.ts:106-124](../../../apps/api/src/character/character.service.ts:106)) exige **exatamente** `config.proficiency.choices` perícias, escolhidas contra `config.skills` — não tem noção de "perícia já concedida por outra fonte". `buildCharacterAttributesSchema` ([system.ts:169](../../../packages/shared/src/types/system.ts:169)) valida `baseAttributes` contra min/max do config — não tem noção de "bônus aplicado depois do point-buy". As duas mecânicas existem, mas nenhuma sabe que background existe.

### A proposta

1. **No ingest** (estende US-121): parsear `ability_score`/`skill_proficiency` em dado estruturado, no mesmo espírito do `parseStartingKit` da US-51 — texto do dataset é frágil, dado estruturado é o que o service consome.
2. **No wizard**: mover a etapa `background` para **antes** de `attributes`/`skills` (ordem hoje é `system → race-class → attributes → skills → background → review`; passa a `system → race-class → background → attributes → skills → review`) — é a mesma ordem do PHB 2024 (background decide o bônus de atributo *antes* de você alocar pontos) e evita reabrir uma etapa já "fechada".
3. **No service**: aplicar o bônus de atributo por cima do `baseAttributes` e mesclar as perícias do background com as da escolha de classe, sem estourar `proficiency.choices`.

---

## Escopo

### Dentro do escopo

- **Ingest (`scripts/srd/ingest.mjs`, estende `buildBackgrounds` da US-121):** para benefícios `type === 'ability_score'`, parsear `+1 to (\w+) and one other ability score\.` → `{ fixed: '<chave do atributo>', freeCount: 1 }`, usando o `ABILITY_MAP`/`ATTR_ORDER` que já existe no ingest. Para `type === 'skill_proficiency'`, parsear os dois formatos da tabela acima → `{ fixed: string[], chooseFrom: string[], chooseCount: number }`, resolvendo cada nome de perícia contra `config.skills` (chave canônica, case/espaço normalizado).
- **Perícia sem entrada no catálogo (`Culture`, `Engineering`) é relatada como órfã** (mesmo relatório de órfãos que a US-47/US-51 já imprimem) e **omitida do grant estruturado daquele background** — o benefício continua existindo como texto (US-122), só não vira mecânica para a(s) perícia(s) que o catálogo não tem. Noble perde a mecanização de `Culture` (fica só `History` fixa + a escolha); Sage perde as duas opções extras do pool, mas mantém `Arcana`/`Religion`. Por não entrar em `fixed`/`chooseFrom`, a perícia órfã **também não aparece como card selecionável na etapa `background`** (linha abaixo) — o jogador só a vê no texto corrido do benefício, nunca como opção clicável.
- **`SystemBackgroundBenefitSchema`** (US-121, `packages/shared`) ganha um campo opcional `grant`, discriminado por `type`, só presente quando o parser reconhece o padrão:
  ```ts
  grant: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('ability'), fixed: z.string(), freeCount: z.number().int().min(0) }),
    z.object({ kind: z.literal('skills'), fixed: z.array(z.string()), chooseFrom: z.array(z.string()), chooseCount: z.number().int().min(0) }),
  ]).optional()
  ```
- **Reordenar `Step`/`steps`** em `SetupWizard.tsx` ([:13-14](../../../apps/web/src/components/setup/SetupWizard.tsx:13)): `background` passa para a posição 3 (depois de `race-class`, antes de `attributes`).
- **Etapa `background`:** quando o cartão escolhido tem `grant.kind === 'ability'`, mostra o `+1` fixo (texto) e um `<select>` para o `+1` livre (qualquer atributo do `config.attributes`); quando tem `grant.kind === 'skills'` com `chooseCount > 0`, mostra cartões do `chooseFrom` para escolher (toggle único ou múltiplo, conforme `chooseCount`).
- **Etapa `attributes`:** os dois `+1` do background (fixo + escolhido) somam **por cima** do valor de point-buy — não consomem `budget`/`remaining`. Mostrado como um selo `+1 (background)` ao lado do atributo afetado, mesmo padrão visual dos contadores já existentes.
- **Etapa `skills`:** `skillCatalog` exibido exclui as perícias já concedidas pelo background (fixas + a escolhida no passo anterior) — evita duplicar. `skillChoices`/`proficiency.choices` **não muda de valor**: continua sendo só a parte da classe/sistema, agora escolhida sobre um catálogo menor.
- **`CreateCharacterSchema.origin`** (US-122, campo irmão de `background`) ganha `skillChoice?: string` (a perícia escolhida do `chooseFrom`, quando `chooseCount > 0`) e `abilityChoice?: string` (a chave do atributo livre) — ficam junto de `origin.key`, nunca dentro de `background`.
- **`CharacterService.create`**: resolve o `grant` da origem escolhida (se houver `origin.key`), valida `abilityChoice`/`skillChoice` contra o `grant` (chave fora do `chooseFrom`, ou ausente quando `chooseCount > 0`, rejeita), aplica o bônus de atributo em `baseAttributes` e mescla as perícias da origem com `skills` antes de persistir — `validateSkills` passa a receber o catálogo **já sem** as perícias da origem.
- **Testes**: `ingest.test.mjs` cobre os dois formatos de `skill_proficiency` + o caso `ability_score` + o caso de perícia órfã (fixture sintética com um "Culture"-like); `character.service.test.ts` cobre bônus aplicado, perícia de background excluída do pool de escolha, escolha inválida rejeitada, e personagem **sem** background (comportamento idêntico ao de hoje, sem regressão).

### Fora do escopo

- **`tool_proficiency` e `language`** — o projeto não tem catálogo de ferramentas nem de idiomas (`config` não tem `tools`/`languages`); mecanizar exigiria um subsistema novo do zero. Ficam texto (US-122).
- **`equipment`, `feature`, `connection_and_memento`, `adventures_and_advancement`** — mesma exclusão já feita na US-122.
- **Estender `config.skills` com `Culture`/`Engineering`** para cobrir Noble/Sage por completo — decisão de produto separada (misturaria o catálogo de perícias do SRD 5.2 com o do A5E); ver Questões em aberto.
- **Fluxo de "troque por outra perícia" quando a concessão colide** — a regra RAW 2024 deixa escolher substituta quando duas fontes dariam a mesma perícia; esta story evita a colisão **excluindo do pool** em vez de resolver a troca (ver Questões em aberto).
- **Retroagir personagens já criados** — a mecânica vale só para criação nova, mesmo corte da US-51 (`baseAttributes`/`skills` de personagem existente não mudam).
- **Backgrounds do `srd-2024` nativo** — a US-121 decidiu não trazê-los; fora do escopo por não existirem no catálogo, não por decisão pendente.

---

## Modelo de dados proposto

Extensão de `SystemBackgroundBenefitSchema` (US-121):

```ts
export const SystemBackgroundGrantSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('ability'), fixed: z.string().min(1), freeCount: z.number().int().min(0) }),
  z.object({
    kind: z.literal('skills'),
    fixed: z.array(z.string()),      // chaves de config.skills já resolvidas
    chooseFrom: z.array(z.string()), // idem — só as que existem no catálogo
    chooseCount: z.number().int().min(0),
  }),
])

// em SystemBackgroundBenefitSchema:
grant: SystemBackgroundGrantSchema.optional(),
```

Extensão de `CreateCharacterSchema.origin` (US-122 — **não** `background`):

```ts
origin: z.object({
  key: z.string().max(80).optional(),
  skillChoice: z.string().max(60).optional(),   // perícia escolhida do grant.chooseFrom
  abilityChoice: z.string().max(40).optional(), // atributo escolhido para o +1 livre
}).optional(),
```

| Campo | Tipo | Descrição |
|---|---|---|
| `benefit.grant` | union (opcional) | Presente só quando o parser reconheceu o padrão E toda perícia envolvida existe no catálogo |
| `origin.skillChoice` | string (opcional) | Preenchido quando `grant.kind === 'skills'` e `chooseCount > 0` |
| `origin.abilityChoice` | string (opcional) | Preenchido quando `grant.kind === 'ability'` |

**Persistência:** sem coluna nova além da que a US-122 já cria — o bônus de atributo é absorvido em `Character.baseAttributes` (soma aplicada antes de persistir); as perícias da origem entram no `Character.skills` já existente, junto das da classe. `Character.origin.key` (US-122) continua sendo o rastro de onde veio o bônus — `Character.background` (US-39) não é tocado por esta story.

---

## Critérios de aceite

- [ ] `buildBackgrounds` deriva `grant` para os 21 `ability_score` (padrão único, 100% de cobertura medida).
- [ ] `buildBackgrounds` deriva `grant` para `skill_proficiency`: os dois formatos (`fixas + either`, `N of your choice`) cobertos por teste com fixture sintética.
- [ ] Perícia sem entrada em `config.skills` (`Culture`, `Engineering`) sai do `grant` (excluída de `fixed`/`chooseFrom`) e entra no relatório de órfãos do ingest — **não falha o `--strict`**, só relata (mesmo tratamento de fallback EN/órfão da US-47).
- [ ] Etapa `background`: perícia órfã **não aparece como card selecionável** (nem fixa nem no `chooseFrom`) — a UI renderiza só a partir de `grant`, que já vem sem ela.
- [ ] Noble mecaniza `History` (fixa) + a escolha `Animal Handling`/`Persuasion`; `Culture` fica de fora do `grant`, mas continua no texto do benefício (US-122).
- [ ] Etapa `background` passa a ser a 3ª etapa do wizard (depois de `race-class`); trilha de progresso e `steps[]` refletem a nova ordem sem quebrar navegação (`goTo`/`canAdvance` continuam funcionando por índice).
- [ ] Background com `grant.kind === 'ability'` mostra o `+1` fixo e oferece `<select>` para o `+1` livre; sem selecionar, `abilityChoice` fica vazio e a criação é rejeitada **só se** o background tiver esse grant (background sem `ability_score` reconhecido, ou nenhum background escolhido, não exige nada).
- [ ] Os dois `+1` do background aparecem na etapa `attributes` somados ao valor de point-buy, **sem consumir `remaining`**.
- [ ] Etapa `skills` não lista mais as perícias já concedidas pelo background escolhido; `skillChoices` (contagem exigida) permanece igual ao `config.proficiency.choices` de hoje.
- [ ] `CharacterService.create` rejeita (`BadRequestException`) `origin.abilityChoice` fora de `config.attributes`, `origin.skillChoice` fora de `grant.chooseFrom`, ou ausência de qualquer um dos dois quando o `grant` os exige.
- [ ] `baseAttributes` final = point-buy + bônus fixo + bônus livre do background, dentro dos `min`/`max` do atributo (bônus que estourar o `max` é rejeitado, mesma regra de `buildCharacterAttributesSchema`).
- [ ] `Character.skills` final = perícias do background (fixas + escolhida) **união** as `choices` da etapa `skills`, sem duplicata.
- [ ] Personagem criado **sem** escolher background (US-122 continua opcional): `baseAttributes`/`skills` idênticos ao comportamento de hoje, nenhuma validação nova disparada.
- [ ] **Eval / teste de regressão:** `character.service.test.ts` cria um personagem com background `a5e-ag_acolyte` (fixed `Wisdom`, skills fixas `Religion` + escolha `Insight`/`Persuasion`) e confere `baseAttributes.wisdom` = default+1(point-buy se houver)+1(background) e `skills` contendo `religion` + a perícia escolhida, sem exigir 3 perícias na etapa `skills` (só as `choices` do sistema).

---

## Notas de implementação

- **Parser isolado e testável**, mesmo padrão do `parseStartingKit` da US-51 ([ingest.mjs](../../../scripts/srd/ingest.mjs)): função pura `parseAbilityGrant(desc)` / `parseSkillGrant(desc, resolveSkillKey)`, entrada = string crua do dataset, saída = grant estruturado ou `undefined` (padrão não reconhecido — falha alto, igual ao `CLASS_MAP`, porque os 21 batem 100% hoje e um formato novo num bump merece ser visto, não engolido).
- **Resolver nome de perícia → chave**: `"Sleight of Hand"` → `sleight_of_hand`, mesma normalização (`toLowerCase` + espaço→`_`) que o `config.skills` já usa como chave — não precisa de mapa novo, só a função de normalização.
- **A ordem do wizard muda, mas `Step`/`steps` continuam sendo só um array** — `goTo`/`canAdvance`/`next`/`back` operam por índice ([SetupWizard.tsx:128-157](../../../apps/web/src/components/setup/SetupWizard.tsx:128)), então mover `'background'` de posição no array `steps` já reordena a trilha e a navegação sem tocar nessas funções.
- **`canAdvance('background')` precisa de uma condição nova**: hoje é `true` incondicional (US-39, opcional). Passa a `true` quando nenhum background está selecionado, **ou** quando está selecionado e (se `grant.kind === 'ability'`) `abilityChoice` preenchido e (se `grant.kind === 'skills' && chooseCount > 0`) `skillChoice` preenchido — mesma forma de `canAdvance('skills')`, que já condiciona ao catálogo.
- **`validateSkills`** ganha um parâmetro a mais (o `grant` de skills do background, ou `undefined`): filtra `catalog` removendo as chaves já concedidas antes de aplicar a regra `chosen.length !== choices`, e valida/inclui a `skillChoice` do background separadamente — não é uma reescrita, é a mesma função com um filtro a montante.

---

## Questões em aberto

1. **`Culture`/`Engineering` entram no `config.skills`?** Resolveria Noble por completo e devolveria as opções cortadas do Sage/Charlatan/Entertainer/Trader — mas mistura o catálogo de perícias do SRD 5.2 (18, `wizards-of-the-coast`) com o do `a5e-ag` (`en-publishing`), que não é mais "regra do SRD numa fonte CC" (ADR 004 §3, decisão 4) — é regra de OUTRO sistema. Decisão de produto, não técnica.
2. **Colisão de perícia (RAW deixa trocar por outra) vale a pena?** Esta story evita a colisão excluindo a perícia do background do pool de escolha da classe — mais simples, mas nunca deixa o jogador "[trocar por outra]" como o livro descreve. Fica assim ou vira story própria?
3. **`ability_score` do background pode estourar o `max` do atributo (18, `ATTR_RANGE`)?** Hoje o point-buy já impede passar de 18 sozinho; um jogador que for a 18 no point-buy e receber +1/+2 do background passaria. Rejeitar a combinação (força escolher outro atributo pro bônus livre) ou permitir estourar o teto de criação nesse caso específico?

---

## Referências no código

- [scripts/srd/ingest.mjs](../../../scripts/srd/ingest.mjs) — `parseStartingKit` (precedente de parser texto→estruturado, US-51), `ABILITY_MAP`/`ATTR_ORDER` (linha 111-112, reusar para resolver nome de atributo), `buildBackgrounds` (US-121, a estender).
- [packages/shared/src/types/system.ts](../../../packages/shared/src/types/system.ts) — `SystemBackgroundBenefitSchema` (US-121, a estender com `grant`), `buildCharacterAttributesSchema` (limite min/max a respeitar).
- [apps/api/src/character/character.service.ts:106-124](../../../apps/api/src/character/character.service.ts:106) — `validateSkills`, a estender com o filtro de perícias já concedidas.
- [apps/api/src/character/character.schema.ts](../../../apps/api/src/character/character.schema.ts) — `CreateCharacterSchema.origin` (US-122), `skillChoice`/`abilityChoice` novos ali dentro.
- [apps/web/src/components/setup/SetupWizard.tsx:13-14,128-157](../../../apps/web/src/components/setup/SetupWizard.tsx:13) — `Step`/`steps` (reordenar), `canAdvance` (nova condição da etapa `background`).
- [US-121](./US-121-catalogo-backgrounds-a5e-adventurers-guide.md) / [US-122](./US-122-escolha-background-catalogo-na-criacao.md) — dependências diretas.
- [US-51](./US-51-kits-iniciais-do-srd.md) — precedente completo de parser de texto do dataset com tabela de armadilhas medidas.
