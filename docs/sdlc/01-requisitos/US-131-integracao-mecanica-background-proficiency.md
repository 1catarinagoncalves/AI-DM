# US-131 — Integração mecânica: perícias do background em `proficiency`

**Épico:** 1 — Personagem
**Fase:** 1 — MVP single-player
**Status:** 🚧 Em progresso
**Depende de:** [US-121](./US-121-catalogo-backgrounds-a5e-adventurers-guide.md) (catálogo `config.backgrounds`) · [US-122](./US-122-escolha-background-catalogo-na-criacao.md) (escolha do background, awareness apenas — esta story mecaniza o segundo dos dois benefícios que ela deixou só texto) · [US-27](./US-27-pericias-do-personagem.md) (`config.proficiency`/`validateSkills`) · [US-26](./US-26-criacao-personagem-em-etapas.md) (ordem das etapas do wizard) · [US-123](./US-123-integracao-mecanica-background-pointbuy.md) (spinoff-mãe: fez o reorder do wizard e abriu a união `SystemBackgroundGrantSchema` que esta story estende com o segundo membro, `kind: 'skills'`) · [US-130](./US-130-culture-engineering-catalogo-pericias.md) (✅ implementada — `config.skills` já tem `culture`/`engineering`; a lacuna de catálogo que motivou a exclusão de órfãos abaixo está fechada antes desta story rodar)
**Relacionado:** [US-51](./US-51-kits-iniciais-do-srd.md) (precedente direto: parser de texto livre do dataset → dado estruturado, tabela de armadilhas medidas) · [ADR 004](../../adr/004-origem-do-dado-de-sistema.md) §4 (relatar em vez de esconder lacuna do dataset)
**Criada em:** 2026-08-13 (spinoff de [US-123](./US-123-integracao-mecanica-background-pointbuy.md))

---

## História

> **Como** jogador,
> **quero** que o background que escolhi (US-122) realmente me dê perícias proficientes — não só apareça como texto na ficha,
> **para que** minha escolha de background pese na mecânica do personagem, do mesmo jeito que classe já pesa em `startingKits`/`classFeatures`.

---

## Contexto e motivação

### Por que story separada da US-123

A US-123 mecanizou `ability_score` (bônus de atributo). `skill_proficiency` é o outro benefício "não-awareness" do `a5e-ag`, mas com uma forma de dado bem mais irregular: dois formatos de texto (não um só) e, até a [US-130](./US-130-culture-engineering-catalogo-pericias.md) fechar, uma lacuna real de catálogo (`Culture`/`Engineering` não existiam em `config.skills`) que `ability_score` não tinha. Separar as duas evita que a complexidade de uma contamine o escopo/critérios de aceite da outra — nenhuma das duas metades depende do *dado* da outra, só compartilham infraestrutura que a US-123 já deixou pronta: o reorder do wizard (`background` antes de `attributes`/`skills`) e a união `SystemBackgroundGrantSchema`.

### O que o dataset realmente diz (medido em 08/08/2026, as 21 entradas)

**`skill_proficiency` — dois formatos:**

| Formato | Exemplo | Contagem |
|---|---|---|
| `<Fixas>, and either <opções, ou>.` | `"Religion, and either Insight or Persuasion."` (Acolyte) | 20/21 |
| `<N> of your choice.` | `"Two of your choice."` (Guildmember) | 1/21 |

Uma a três perícias fixas + escolha de 1 entre 2–4 opções (ou, no caso do Guildmember, escolha totalmente livre de 2).

**A lacuna de catálogo que existia (fechada pela US-130, ✅ implementada em 13/08/2026).** Até a US-130, `config.skills` tinha só as **18 perícias padrão do 5e** — o `a5e-ag` usa um catálogo **expandido**, com `Culture` e `Engineering`, que aparecem em 6 dos 21 backgrounds:

| Background | Onde aparece | Fixa ou opcional? |
|---|---|---|
| Noble | `"Culture, History, and either Animal Handling or Persuasion."` | `Culture` é FIXA — sem catálogo, bloqueava mecanização total do Noble |
| Sage | `"...either Arcana, Culture, Engineering, or Religion."` | `Culture`/`Engineering` só no pool de escolha (ainda sobrava Arcana/Religion) |
| Charlatan, Entertainer, Trader | `Culture` só no pool de escolha | idem — degradava, não bloqueava |

A US-130 adicionou `culture`/`engineering` a `config.skills` (20 entradas, ambas `ability: intelligence`) **antes** desta story rodar — os 21 backgrounds medidos hoje batem 100% contra o catálogo atual, sem nenhuma perícia órfã. O parser/exclusão de órfãos desta story (ver Escopo) continua existindo como rede de segurança **defensiva** — para um formato/perícia novo que apareça num bump futuro do dataset — mas não é exercitado pelos 21 backgrounds de hoje: Noble mecaniza `Culture` + `History` (ambas fixas), Sage/Charlatan/Entertainer/Trader recuperam `Culture`/`Engineering` no `chooseFrom`.

### Por que a solução atual não basta

`validateSkills` ([character.service.ts:106-124](../../../apps/api/src/character/character.service.ts:106)) exige **exatamente** `config.proficiency.choices` perícias, escolhidas contra `config.skills` — não tem noção de "perícia já concedida por outra fonte". A mecânica existe, mas não sabe que background existe.

### A proposta

1. **No ingest** (estende US-121, sobre a mesma `buildBackgrounds` que a US-123 já estendeu): parsear `skill_proficiency` em dado estruturado, no mesmo espírito do `parseStartingKit` da US-51.
2. **No wizard**: a US-123 já moveu `background` para antes de `attributes`/`skills` — `skills` já fica depois de `background` por transitividade, nenhum reorder novo aqui.
3. **No service**: mesclar as perícias do background com as da escolha de classe, sem estourar `proficiency.choices`.

---

## Escopo

### Dentro do escopo

- **Ingest (`scripts/srd/ingest.mjs`, mesma `buildBackgrounds` que a US-123 estendeu):** para benefícios `type === 'skill_proficiency'`, parsear os dois formatos da tabela acima → `{ fixed: string[], chooseFrom: string[], chooseCount: number }`, resolvendo cada nome de perícia contra `config.skills` (chave canônica, case/espaço normalizado).
- **Perícia sem entrada no catálogo é relatada como órfã** (mesmo relatório de órfãos que a US-47/US-51 já imprimem) e **omitida do grant estruturado daquele background** — o benefício continua existindo como texto (US-122), só não vira mecânica para a(s) perícia(s) que o catálogo não tem. Por não entrar em `fixed`/`chooseFrom`, a perícia órfã **também não aparece como card selecionável na etapa `background`** (linha abaixo) — o jogador só a vê no texto corrido do benefício, nunca como opção clicável. Com a US-130 já implementada (`culture`/`engineering` em `config.skills`), os 21 backgrounds medidos hoje não geram nenhuma perícia órfã — este caminho é rede de segurança para um nome de perícia novo que apareça num bump futuro do dataset, não um caso vivo hoje.
- **`SystemBackgroundGrantSchema`** (US-123, `packages/shared`) ganha o segundo membro da união, `kind: 'skills'` — o primeiro membro (`kind: 'ability'`) não é tocado:
  ```ts
  z.object({ kind: z.literal('skills'), fixed: z.array(z.string()), chooseFrom: z.array(z.string()), chooseCount: z.number().int().min(0) })
  ```
- **Etapa `background`:** quando o cartão escolhido tem `grant.kind === 'skills'`, mostra as perícias de `grant.fixed` já marcadas como selecionadas (não clicáveis — vêm garantidas pelo background, sem escolha) e, se `chooseCount > 0`, cartões do `chooseFrom` para escolher (toggle único ou múltiplo, conforme `chooseCount`). Nesta story os únicos cartões possíveis nessa tela são os do `grant` do background — nenhuma perícia de raça ou classe aparece aqui (ver Fora do escopo).
- **Etapa `attributes`:** nenhuma mudança — o bônus de atributo é inteiramente da US-123.
- **Etapa `skills`:** `skillCatalog` exibido exclui as perícias já concedidas pelo background (fixas + a escolhida no passo anterior) — evita duplicar. `skillChoices`/`proficiency.choices` **não muda de valor**: continua sendo só a parte da classe/sistema, agora escolhida sobre um catálogo menor.
- **`CreateCharacterSchema.origin`** (US-122, mesmo objeto que a US-123 estendeu com `abilityChoice`) ganha `skillChoice?: string` (a perícia escolhida do `chooseFrom`, quando `chooseCount > 0`).
- **`CharacterService.create`**: resolve o `grant` de perícias da origem escolhida (se houver `origin.key`), valida `skillChoice` contra o `grant` (chave fora do `chooseFrom`, ou ausente quando `chooseCount > 0`, rejeita), mescla as perícias da origem com `skills` antes de persistir — `validateSkills` passa a receber o catálogo **já sem** as perícias da origem.
- **Testes**: `ingest.test.mjs` cobre os dois formatos de `skill_proficiency` + o caso de perícia órfã (fixture sintética com um "Culture"-like); `character.service.test.ts` cobre perícia de background excluída do pool de escolha, escolha inválida rejeitada, e personagem **sem** background (comportamento idêntico ao de hoje, sem regressão).

### Fora do escopo

- **`ability_score`** — mecanizado pela [US-123](./US-123-integracao-mecanica-background-pointbuy.md).
- **`tool_proficiency` e `language`** — o projeto não tem catálogo de ferramentas nem de idiomas (`config` não tem `tools`/`languages`); mecanizar exigiria um subsistema novo do zero. Ficam texto (US-122).
- **`equipment`, `feature`, `connection_and_memento`, `adventures_and_advancement`** — mesma exclusão já feita na US-122.
- **Estender `config.skills` com `Culture`/`Engineering`** — já feito pela [US-130](./US-130-culture-engineering-catalogo-pericias.md) (✅ implementada, literal hardcoded no ingest com `ability: intelligence`), fora do escopo desta story por já estar pronto quando ela começa a implementar.
- **Fluxo de "troque por outra perícia" quando a concessão colide** — a regra RAW 2024 deixa escolher substituta quando duas fontes dariam a mesma perícia; esta story evita a colisão **excluindo do pool** em vez de resolver a troca (ver Questões em aberto).
- **Retroagir personagens já criados** — a mecânica vale só para criação nova, mesmo corte da US-51 (`skills` de personagem existente não muda).
- **Backgrounds do `srd-2024` nativo** — a US-121 decidiu não trazê-los; fora do escopo por não existirem no catálogo, não por decisão pendente.
- **Perícias de raça/classe nos cartões da etapa `background`** — hoje o `grant.chooseFrom` renderizado ali vem só do background escolhido. O projeto não tem, ainda, concessão de perícia por raça nem por classe fora do pool de `skills` já coberto por `proficiency.choices`; quando (se) existir, a extensão natural é a mesma tela agregar os `grant`s de todas as fontes relacionadas (background + raça + classe) em vez de abrir uma etapa nova — mas isso fica para quando essa mecânica existir, não é implementado aqui.

---

## Modelo de dados proposto

Extensão de `SystemBackgroundGrantSchema` (US-123 — segundo membro da união):

```ts
export const SystemBackgroundGrantSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('ability'), fixed: z.string().min(1), freeCount: z.number().int().min(0) }), // US-123, inalterado
  z.object({
    kind: z.literal('skills'),
    fixed: z.array(z.string()),      // chaves de config.skills já resolvidas
    chooseFrom: z.array(z.string()), // idem — só as que existem no catálogo
    chooseCount: z.number().int().min(0),
  }),
])
```

Extensão de `CreateCharacterSchema.origin` (US-122/US-123 — mesmo objeto, `skillChoice` é o campo novo desta story):

```ts
origin: z.object({
  key: z.string().max(80).optional(),
  abilityChoice: z.string().max(40).optional(), // US-123, inalterado
  skillChoice: z.string().max(60).optional(),   // perícia escolhida do grant.chooseFrom
}).optional(),
```

| Campo | Tipo | Descrição |
|---|---|---|
| `benefit.grant` (`kind: 'skills'`) | union member (opcional) | Presente só quando o parser reconheceu o padrão E toda perícia envolvida existe no catálogo |
| `origin.skillChoice` | string (opcional) | Preenchido quando `grant.kind === 'skills'` e `chooseCount > 0` |

**Persistência:** sem coluna nova além da que a US-122 já cria — as perícias da origem entram no `Character.skills` já existente, junto das da classe. `Character.origin.key` (US-122) continua sendo o rastro de onde veio o bônus — `Character.background` (US-39) não é tocado por esta story.

---

## Critérios de aceite

- [ ] `buildBackgrounds` deriva `grant` para `skill_proficiency`: os dois formatos (`fixas + either`, `N of your choice`) cobertos por teste com fixture sintética.
- [ ] Perícia sem entrada em `config.skills` sai do `grant` (excluída de `fixed`/`chooseFrom`) e entra no relatório de órfãos do ingest — **não falha o `--strict`**, só relata (mesmo tratamento de fallback EN/órfão da US-47). Com a US-130 já implementada, nenhum dos 21 backgrounds de hoje deve cair nesse caminho — cobrir com fixture sintética, não com `Culture`/`Engineering` (já resolvidas no catálogo).
- [ ] Etapa `background`: perícia órfã **não aparece como card selecionável** (nem fixa nem no `chooseFrom`) — a UI renderiza só a partir de `grant`, que já vem sem ela.
- [ ] Noble mecaniza `Culture` + `History` (ambas fixas, catálogo já tem `culture` via US-130) + a escolha `Animal Handling`/`Persuasion` — background 100% mecanizado, nada de fora do `grant`.
- [ ] Background com `grant.kind === 'skills'` mostra `grant.fixed` já marcada como selecionada (não clicável) na etapa `background`, mesmo quando `chooseCount === 0`.
- [ ] Background com `grant.kind === 'skills'` e `chooseCount > 0` oferece cartões do `chooseFrom` para escolher; sem escolher, a criação é rejeitada **só se** o background tiver esse grant.
- [ ] Etapa `skills` não lista mais as perícias já concedidas pelo background escolhido; `skillChoices` (contagem exigida) permanece igual ao `config.proficiency.choices` de hoje.
- [ ] `CharacterService.create` rejeita (`BadRequestException`) `origin.skillChoice` fora de `grant.chooseFrom`, ou ausência dele quando o `grant` exige.
- [ ] `Character.skills` final = perícias do background (fixas + escolhida) **união** as `choices` da etapa `skills`, sem duplicata.
- [ ] Personagem criado **sem** escolher background (US-122 continua opcional): `skills` idêntico ao comportamento de hoje, nenhuma validação nova disparada.
- [ ] **Eval / teste de regressão:** `character.service.test.ts` cria um personagem com background `a5e-ag_acolyte` (skills fixas `Religion` + escolha `Insight`/`Persuasion`) e confere `skills` contendo `religion` + a perícia escolhida, sem exigir 3 perícias na etapa `skills` (só as `choices` do sistema).

---

## Notas de implementação

- **Parser isolado e testável**, mesmo padrão do `parseStartingKit` da US-51 ([ingest.mjs](../../../scripts/srd/ingest.mjs)): função pura `parseSkillGrant(desc, resolveSkillKey)`, entrada = string crua do dataset, saída = grant estruturado ou `undefined` (padrão não reconhecido — falha alto, igual ao `CLASS_MAP`, porque os 21 batem 100% hoje e um formato novo num bump merece ser visto, não engolido).
- **Resolver nome de perícia → chave**: `"Sleight of Hand"` → `sleight_of_hand`, mesma normalização (`toLowerCase` + espaço→`_`) que o `config.skills` já usa como chave — não precisa de mapa novo, só a função de normalização.
- **`canAdvance('background')`**: a US-123 mostra só texto informativo nesta etapa (o `<select>` do `+1` de atributo vive em `attributes`, não aqui — ver US-123 §Escopo) e não mexe em `canAdvance('background')`, que segue `true` incondicional (US-39). Esta story é quem primeiro condiciona essa etapa: `true` quando nenhum background está selecionado, **ou** quando está selecionado e (se `grant.kind === 'skills' && chooseCount > 0`) `skillChoice` preenchido — porque o `chooseFrom` de perícia É escolhido aqui, na própria etapa `background` (diferente do atributo).
- **`validateSkills`** ganha um parâmetro a mais (o `grant` de skills do background, ou `undefined`): filtra `catalog` removendo as chaves já concedidas antes de aplicar a regra `chosen.length !== choices`, e valida/inclui a `skillChoice` do background separadamente — não é uma reescrita, é a mesma função com um filtro a montante.

---

## Questões em aberto

1. **Colisão de perícia (RAW deixa trocar por outra) vale a pena?** Esta story evita a colisão excluindo a perícia do background do pool de escolha da classe — mais simples, mas nunca deixa o jogador "[trocar por outra]" como o livro descreve. Fica assim ou vira story própria?

---

## Referências no código

- [scripts/srd/ingest.mjs](../../../scripts/srd/ingest.mjs) — `parseStartingKit` (precedente de parser texto→estruturado, US-51), `buildBackgrounds` (US-121/US-123, a estender de novo).
- [packages/shared/src/types/system.ts](../../../packages/shared/src/types/system.ts) — `SystemBackgroundGrantSchema` (US-123, a estender com o membro `'skills'`).
- [apps/api/src/character/character.service.ts:106-124](../../../apps/api/src/character/character.service.ts:106) — `validateSkills`, a estender com o filtro de perícias já concedidas.
- [apps/api/src/character/character.schema.ts](../../../apps/api/src/character/character.schema.ts) — `CreateCharacterSchema.origin` (US-122/US-123), `skillChoice` novo ali dentro.
- [apps/web/src/components/setup/SetupWizard.tsx](../../../apps/web/src/components/setup/SetupWizard.tsx) — `canAdvance('background')` (condição nova, primeira vez que essa etapa é bloqueada — US-123 só usa texto informativo aqui); reorder já feito pela US-123, não reabrir.
- [US-121](./US-121-catalogo-backgrounds-a5e-adventurers-guide.md) / [US-122](./US-122-escolha-background-catalogo-na-criacao.md) / [US-123](./US-123-integracao-mecanica-background-pointbuy.md) — dependências diretas.
- [US-51](./US-51-kits-iniciais-do-srd.md) — precedente completo de parser de texto do dataset com tabela de armadilhas medidas.
- [US-130](./US-130-culture-engineering-catalogo-pericias.md) — ✅ implementada; fechou a lacuna de catálogo (`Culture`/`Engineering`) antes desta story, ver [ingest.mjs:208-226](../../../scripts/srd/ingest.mjs:208) (`buildSkills`, 20 entradas).
