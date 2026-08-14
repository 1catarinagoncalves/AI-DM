# US-135 — Feature de origem (benefício `feature` do background) na criação e na ficha, como as features de classe

**Épico:** 1 — Personagem
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** [US-121](./US-121-catalogo-backgrounds-a5e-adventurers-guide.md) (catálogo `config.backgrounds`, benefit `type: "feature"` já extraído, sem mecanização) · [US-122](./US-122-escolha-background-catalogo-na-criacao.md) (escolha de origem — é o `origin.key` que decide se o benefício `feature` existe pra este personagem) · [US-41](./US-41-features-traits-de-classe.md) (precedente direto: `SystemClassFeature`/`getClassFeatures`/`resolveSheetEntries`/`FeaturesPanel` — esta story aplica o MESMO mecanismo à origem)
**Relacionado:** [US-100](./US-100-ficha-do-personagem-no-locale-ativo.md) (`Character.features` guarda CHAVES, resolvidas no locale de quem lê — esta story precisa seguir a mesma regra, não materializar texto cru) · [US-106](./US-106-catalogo-com-chave-e-free-herdando-o-srd.md) (chave canônica EN sobrevivendo à tradução) · [US-123](./US-123-integracao-mecanica-background-pointbuy.md)/[US-131](./US-131-integracao-mecanica-background-proficiency.md)/[US-129](./US-129-escolha-idioma-beneficio-language-background.md)/[US-132](./US-132-escolha-ferramenta-beneficio-tool-proficiency-background.md)/[US-128](./US-128-memento-e-equipamento-da-origem-como-itens-do-inventario.md) (mecanizam os outros 5 tipos de benefício estruturado ou semi-estruturado do background — `feature` é o único dos 8 tipos do a5e-ag que ainda não tem NENHUM tratamento no código, nem awareness nem mecânico) · [US-125](./US-125-beneficios-origem-no-system-prompt.md) (📋 Planejada — escopo restrito a `adventures_and_advancement`/conexão/memento, nunca tocou `feature`: `feature` chega ao mestre só pela `## Class features` que esta story alimenta. **Sem dependência de ordem entre as duas.**)
**Criada em:** 2026-08-13

---

## História

> **Como** jogador,
> **quero** que a feature nomeada da minha origem (ex.: *Thieves' Cant* do Criminoso, *Trade Mark* do Artesão, *Forbidden Lore* do Cultista) apareça na ficha e seja conhecida pelo mestre, do mesmo jeito que as features de classe (US-41) já aparecem,
> **para que** minha origem me dê um poder/traço concreto e visível, e não só bônus de atributo/perícia e prosa narrativa.

---

## Contexto e motivação

### O problema observado

O `a5e-ag` tem 8 tipos de benefício por background (`ability_score`, `skill_proficiency`, `tool_proficiency`, `language`, `equipment`, `feature`, `connection_and_memento`, `adventures_and_advancement` — catalogados na US-121). Sete já têm destino no código: `ability_score`→`pointBuy` (US-123), `skill_proficiency`→`proficiency` (US-131), `equipment`→inventário (US-128), `language`→escolha de idioma (US-129, bloqueada em US-133), `tool_proficiency`→escolha de ferramenta (US-132, bloqueada em US-134), `adventures_and_advancement`/`connection_and_memento`→seção de detalhe na criação (US-124).

**`feature` é o único tipo sem tratamento nenhum.** Medido em 13/08/2026 direto em `scripts/srd/_data/BackgroundBenefit.json`: **20 dos 21 backgrounds têm exatamente 1 benefício `type: "feature"`** (só o Acolyte não tem nenhum), com `name` curto e `desc` de 100–405 caracteres (média 235) — a mesma forma de `SystemClassFeature` (`name` + `description`), não um número nem uma escolha:

| Origem | `name` do benefício `feature` |
|---|---|
| Artesão (`artisan`) | *Trade Mark* |
| Charlatão (`charlatan`) | *Many Identities* |
| Criminoso (`criminal`) | *Thieves' Cant* |
| Cultista (`cultist`) | *Forbidden Lore* |
| Artista (`entertainer`) | *Pay the Piper* |
| … (mais 15 origens, 1 cada) | — |
| Acólito (`acolyte`) | *(nenhum — único caso sem `feature`)* |

`grep -rn "'feature'" apps/web apps/api packages` não retorna nenhum consumidor de código — o dado existe em `config.backgrounds[].benefits` desde a US-121, mas nenhuma tela, nenhum prompt, nenhuma persistência o toca.

### Por que a solução atual não basta

A US-41 já resolveu exatamente este problema para classe: `SystemClassFeature` (`key`/`name`/`description`/`source`), `getClassFeatures(config, classKey)` (retorna chaves), `resolveSheetEntries` (resolve chave→texto no locale de quem lê, US-100), `FeaturesPanel` (aba "Features" da ficha, reusada pela revisão do wizard via US-127). O mecanismo inteiro já existe e está testado — falta só estendê-lo à origem, no mesmo molde que a US-128 já usou para `backgroundEquipment` (estrutura paralela derivada de `benefits[].type === 'equipment'`, keyed por `SystemBackground.key`).

### A proposta

Derivar `config.backgroundFeatures: Record<originKey, SystemClassFeature[]>` do benefício `type === 'feature'` no `ingest.mjs` (mesmo padrão de `backgroundEquipment`, reusando o schema `SystemClassFeatureSchema` já existente — sem tipo novo). Na criação, somar as chaves da origem escolhida às features de classe já materializadas em `Character.features`. Na leitura (ficha, revisão do wizard, prompt do mestre), resolver as duas fontes e mostrar tudo na MESMA lista — a origem só acrescenta itens à aba "Features" que já existe, sem aba nova.

---

## Escopo

### Dentro do escopo

- **`ingest.mjs`**: `buildBackgrounds` ganha um terceiro retorno, `backgroundFeatures` — para cada benefício `type === 'feature'`, gera `{ key: b.pk, name, description, source: 'a5e-ag' }`. **Sem função de slug nova:** `b.pk` (`a5e-ag_artisan_trade-mark`) já É `<parent>_<slug>` no dataset cru — confirmado nos 20 benefícios `feature` medidos (13/08/2026, `b.pk.startsWith(b.fields.parent + '_')` bate 100%) — e já é a chave usada pelo `resolve('backgrounds', b.pk, …)` existente na função (linha 539) para traduzir `name`/`description`. `buildClassFeatures` (US-41/US-106) faz o mesmo tipo de derivação (`slice` do `pk` do filho pelo tamanho do `pk` do pai) por um motivo idêntico — não existe "slugify por nome" em lugar nenhum do ingest, sempre se aproveita o `pk` que o dataset já dá pronto. Origem sem benefício `feature` (só o Acolyte, hoje) → sem entrada no map, não `[]` vazio explícito (mesma convenção de `classFeatures`/`startingKits` — `map[key] ?? []` no consumidor cobre a ausência).
- **`SystemConfigSchema`** (`packages/shared/src/types/system.ts`) ganha `backgroundFeatures: z.record(z.string(), z.array(SystemClassFeatureSchema)).optional()` — reusa o schema de `classFeatures` (mesma forma `{key,name,description,source}`), sem tipo novo.
- **`packages/shared/src/starting-kit.ts`**: `getBackgroundFeatures(config, originKey): string[]`, espelhando `getClassFeatures` — `config.backgroundFeatures?.[originKey] ?? []`, mapeado para `.key`. Sem fallback `default` (origem é opcional; sem origem escolhida, sem feature de origem — diferente de classe, que é sempre obrigatória).
- **`character.service.ts`** (criação): `Character.features` passa a ser a UNIÃO das chaves de classe (`getClassFeatures`, já existente) com as chaves de origem (`getBackgroundFeatures(config, originKey)`, novo), no mesmo array — mesmo campo, sem coluna nova no Prisma. Sem origem escolhida (`originKey` ausente) → só as features de classe, comportamento idêntico ao de hoje.
- **`resolveCharacterFeatures(config, classKey, originKey, featureKeys)`** (nova função pura, `packages/shared/src/starting-kit.ts`, ao lado de `getClassFeatures`/`getBackgroundFeatures`): resolve as chaves de `Character.features` contra a UNIÃO de `config.classFeatures[classKey]` (ou `default`) **e** `config.backgroundFeatures[originKey]`, reusando `resolveSheetEntries` por trás (mapa sintético de uma entrada — ver §Notas de implementação, forma exata da função). Substitui a chamada direta a `resolveSheetEntries` para features nos 3 sites de leitura (`ai.service.ts`, `apps/web/src/app/play/[adventureId]/page.tsx`, preview do `SetupWizard.tsx`).
- **`FeaturesPanel`**: nenhuma mudança — a aba "Features" já é uma lista `{name,description}[]` sem distinguir origem do item; a feature da origem aparece na MESMA lista das features de classe, na ordem em que `Character.features` as materializa (classe primeiro, origem depois — decisão simples, sem critério de ordenação adicional a inventar).
- **Preview da revisão do wizard** (`SetupWizard.tsx`, mesmo bloco que já monta `previewFeatures` para classe): passa a incluir a feature da origem quando `charData.origin?.key` está preenchido — mesma função `resolveSheetEntries`/`getBackgroundFeatures`, sem componente novo (US-127 já garante que revisão e ficha em jogo consomem o mesmo `FeaturesPanel`).
- **Teste em `ingest.test.mjs`**: `buildBackgrounds` com fixture sintética cobrindo background com benefício `feature` (chave gerada, presente em `backgroundFeatures`) e background sem ele (ausente do map, sem crash) — mesmo padrão dos testes de `backgroundEquipment`/grants da US-123/US-128/US-131.
- **Teste em `character.service.test.ts`**: personagem criado com origem que tem `feature` → chave de origem presente em `Character.features` junto da de classe; origem sem `feature` (Acólito) ou sem origem escolhida → só chaves de classe, sem entrada fantasma.
- **Teste de `resolveCharacterFeatures`** (`starting-kit.test.ts`, ao lado dos testes de `getClassFeatures`/`getBackgroundFeatures`): chave de classe resolve pelo catálogo de classe, chave de origem resolve pelo catálogo de origem, chave em nenhum dos dois cai no `retiredFeatures` e por fim no fallback `{key, name: key}` (mesma cadeia de `resolveSheetEntries`, agora com 2 fontes na frente dela).

### Fora do escopo

- **Escolha entre múltiplas features de origem** — não existe hoje: 20 das 21 origens têm exatamente 1 `feature`, nenhuma tem mais de 1 (medido em 13/08/2026). Se o dataset mudar isso num bump futuro, o modelo já suporta (`SystemClassFeature[]` é array), mas não há UI de escolha a construir agora — mesma decisão de "sem editor" que a US-41 tomou para features de classe.
- **Resolução mecânica da feature** (usos, custo, recuperação em descanso) — awareness apenas, mesmo corte da US-41. *Thieves' Cant* vira "o personagem conhece esse código" no prompt, não um sistema de cifra.
- **Mudar `US-125`** — não é necessário: o escopo dela (`adventures_and_advancement`/conexão/memento) nunca incluiu `feature`, então não há duplicação no prompt nem dependência de qual das duas stories é implementada primeiro.
- **Renomear a aba "Features" da ficha** (para algo tipo "Features & Origem") — a aba já é genérica o bastante (US-41 não amarra o nome a "de classe"); adicionar itens de origem à mesma lista não exige renomear nada.
- **Traits raciais** — mesmo corte que a US-41 já fez (fonte de dados diferente, catálogo de raça não tem campo equivalente hoje).
- **Os 4 backgrounds do `srd-2024` nativo** (Acolyte, Criminal, Sage, Soldier) — não entram no catálogo (US-121 §Fora do escopo já decidiu isso); esta story só consome `a5e-ag`.

---

## Modelo de dados proposto

Nenhum tipo novo — reusa `SystemClassFeatureSchema` (US-41/US-106) para o novo campo:

```ts
// packages/shared/src/types/system.ts — dentro de SystemConfigSchema
backgroundFeatures: z.record(z.string(), z.array(SystemClassFeatureSchema)).optional(),
```

```ts
// packages/shared/src/starting-kit.ts
export function getBackgroundFeatures(config: SystemConfig, originKey?: string): string[] {
  if (!originKey) return []
  const map = config.backgroundFeatures
  if (!map) return []
  return (map[originKey] ?? []).map((f) => f.key)
}
```

Exemplo de entrada derivada pelo ingest (Criminoso — `key` é o `b.pk` cru do dataset, sem transformação):

```json
{
  "a5e-ag_criminal": [
    {
      "key": "a5e-ag_criminal_thieves-cant",
      "name": "Thieves' Cant",
      "description": "You know thieves' cant: a set of slang, hand signals, and code terms used by professional criminals...",
      "source": "a5e-ag"
    }
  ]
}
```

| Campo | Tipo | Descrição |
|---|---|---|
| `backgroundFeatures` | `Record<string, SystemClassFeature[]>` | Chave = `SystemBackground.key` (`a5e-ag_criminal`); valor = as features `type: 'feature'` daquela origem (hoje, sempre 0 ou 1 item) |
| `backgroundFeatures[origin][].key` | string | `b.pk` cru do `BackgroundBenefit` (`a5e-ag_criminal_thieves-cant`) — já canônico, sem slug a gerar |

**Persistência:** mesmo artefato `srd-5e.config.<locale>.json` (US-47/US-99), sem migração Prisma — `Character.features` (já existe, US-41) passa a poder conter chaves com prefixo `a5e-ag_*` além de `<classe>_*`.

---

## Critérios de aceite

- [x] `ingest.mjs` deriva `backgroundFeatures` a partir do benefício `type === 'feature'`: as 20 origens medidas com esse benefício ganham 1 entrada cada; o Acólito (única sem `feature`) não gera entrada no map.
- [x] `SystemConfigSchema` valida `backgroundFeatures` opcional; config sem o campo continua válido (compatibilidade com artefato anterior a esta story).
- [x] `getBackgroundFeatures(config, originKey)` devolve as chaves da origem; `originKey` ausente ou sem entrada no map → `[]`, sem lançar.
- [x] **Criação:** personagem com origem que tem `feature` (ex. Criminoso) tem, em `Character.features`, a chave de classe **e** a chave de origem juntas. Origem sem `feature` (Acólito) ou sem origem escolhida → só as chaves de classe, idêntico ao comportamento pré-story.
- [x] **Ficha (UI):** a aba "Features" mostra a feature da origem (nome + descrição, no locale ativo de quem lê — US-100) junto das features de classe, sem aba nova, sem componente novo.
- [x] **Revisão do wizard:** o preview da etapa `review` mostra a feature da origem assim que `origin.key` está selecionado, mesmo `FeaturesPanel` que a ficha em jogo usa (US-127).
- [x] Trocar a origem escolhida na criação (antes do submit) atualiza o preview da feature correspondente, sem misturar a feature de uma origem anterior.
- [x] Nenhuma string nova hardcoded no JSX (gate da US-102) — a aba "Features" já tem suas chaves de mensagem (US-41); nenhuma nova é necessária.
- [x] **Eval / teste de regressão:** `ingest.test.mjs` cobre `buildBackgrounds` com fixture de origem com/sem benefício `feature`. `character.service.test.ts` cobre criação com origem com `feature` (chave presente) e sem (Acólito ou sem origem, chave ausente).

---

## Notas de implementação

- **Precedente direto: `backgroundEquipment` (US-128).** Mesma forma — `buildBackgrounds` já devolve um segundo dado derivado de `benefits[].type`, keyed por `SystemBackground.key`; `backgroundFeatures` é o mesmo padrão com um terceiro tipo (`'feature'` em vez de `'equipment'`), sem inventar mecanismo novo.
- **O ponto delicado é a leitura, não a escrita.** `resolveSheetEntries(byClass, retired, classKey, keys)` hoje resolve TODAS as chaves contra `byClass[classKey] ?? byClass['default']` — um único mapa, uma única chave de lookup. Com `Character.features` misturando chaves de classe e de origem, um chamador não pode simplesmente passar `config.classFeatures` sozinho (a chave de origem cairia no fallback `{key, name: key}`, mostrando `a5e-ag_criminal_thieves-cant` cru na tela). **Sugestão que não exige mudar a assinatura de `resolveSheetEntries`:** no site de leitura, montar um mapa sintético de UMA entrada combinando as duas fontes antes de chamar a função já existente:
  ```ts
  const classList = config?.classFeatures?.[character.class] ?? config?.classFeatures?.default ?? []
  const originList = character.origin?.key ? (config?.backgroundFeatures?.[character.origin.key] ?? []) : []
  const features = resolveSheetEntries({ combined: [...classList, ...originList] }, config?.retiredFeatures, 'combined', character.features)
  ```
  **Extrair já** como função pura em `packages/shared` (mesmo arquivo de `getClassFeatures`/`getBackgroundFeatures`, `starting-kit.ts`), não deixar inline nos 3 sites:
  ```ts
  export function resolveCharacterFeatures(
    config: SystemConfig,
    classKey: string,
    originKey: string | undefined,
    featureKeys: string[],
  ): ClassFeature[] {
    const classList = config.classFeatures?.[classKey] ?? config.classFeatures?.default ?? []
    const originList = originKey ? (config.backgroundFeatures?.[originKey] ?? []) : []
    return resolveSheetEntries({ combined: [...classList, ...originList] }, config.retiredFeatures, 'combined', featureKeys)
  }
  ```
  Justificativa: são 3 chamadores conhecidos JÁ dentro desta story (não é abstração especulativa) repetindo a MESMA regra de negócio (ordem de merge classe→origem, fallback pra `retiredFeatures`) — se essa regra mudar (ex. origem passa a vir primeiro, ou entra uma terceira fonte), 3 cópias divergem em silêncio. Mesmo padrão que `getClassFeatures`/`getBackgroundFeatures` já seguem: função pura em `packages/shared`, chamadores em `apps/api`/`apps/web` só importam.
  Não há risco de colisão de chave entre as duas fontes: chaves de classe são `<classe>_<slug>` (`paladin_lay-on-hands`), chaves de origem são `a5e-ag_<slug-origem>_<slug-feature>` (`a5e-ag_criminal_thieves-cant`) — prefixos disjuntos.
- **`retiredFeatures` continua servindo as duas fontes** — é um único mapa achatado por chave (US-100), não importa se a chave aposentada era de classe ou de origem.
- **Não reabrir `SystemBackgroundBenefitSchema`/`SystemBackgroundGrantSchema`** (US-123/US-131) — o benefício `feature` **não** ganha um `grant` estruturado (não é bônus numérico nem escolha), fica só no `benefits[]` cru como hoje; o dado novo é o `backgroundFeatures` derivado, paralelo, não uma mudança nesses dois schemas.
- **`US-125` nunca cobre `'feature'`** — o escopo dela é só `adventures_and_advancement`/conexão/memento (`packages/ai-engine/src/prompts/dm-system.ts`, quando ela for implementada) — nenhuma coordenação de ordem é necessária entre as duas stories; implementar esta antes, depois, ou em paralelo da US-125 dá o mesmo resultado (sem duplicação no prompt).

---

## Questões em aberto

1. ~~Nome da chave gerada (`slugify`).~~ **Resolvida (13/08/2026):** não existe slug a gerar. Medido nos 20 benefícios `type: 'feature'` do dataset cru — `b.pk` (`a5e-ag_artisan_trade-mark`) já é `<parent-pk>_<slug>` (`b.pk.startsWith(b.fields.parent + '_')` bate 100%), a MESMA chave que `resolve('backgrounds', b.pk, …)` já usa dentro de `buildBackgrounds` para traduzir `name`/`description` desse benefício. `key: b.pk` direto, sem função nova (nem `buildClassFeatures` tem "slugify por nome" — deriva o slug fatiando o `pk` do dataset, mesmo princípio).
2. ~~Vale a pena extrair `resolveCharacterFeatures` como utilitário único já nesta story?~~ **Resolvida:** sim, extrair já — são 3 chamadores conhecidos (não hipotéticos) repetindo a mesma regra de merge (classe→origem, fallback `retiredFeatures`); ver assinatura proposta em §Notas de implementação.

---

## Referências no código

- [scripts/srd/ingest.mjs:513](../../../scripts/srd/ingest.mjs:513) — `buildBackgrounds`, onde `backgroundEquipment` já é derivado de `benefits[].type === 'equipment'` (US-128) — `backgroundFeatures` entra ao lado, mesmo `for` sobre `benefitsByParent`.
- [packages/shared/src/types/system.ts:42-47](../../../packages/shared/src/types/system.ts:42) — `SystemClassFeatureSchema`, reusado sem alteração.
- [packages/shared/src/types/system.ts:97-102](../../../packages/shared/src/types/system.ts:97) — `SystemBackgroundSchema`, onde `key` de origem já existe (fonte do prefixo da chave nova).
- [packages/shared/src/starting-kit.ts:58](../../../packages/shared/src/starting-kit.ts:58) — `getClassFeatures`, molde direto para `getBackgroundFeatures`.
- [packages/shared/src/types/system.ts:199](../../../packages/shared/src/types/system.ts:199) — `resolveSheetEntries`, usado sem mudar assinatura (ver §Notas de implementação sobre o mapa sintético combinado).
- [apps/api/src/character/character.service.ts:30-70](../../../apps/api/src/character/character.service.ts:30) — `create()`, onde `features`/`originKey` já são calculados; união entra aqui.
- [apps/api/src/ai/ai.service.ts:335](../../../apps/api/src/ai/ai.service.ts:335) — resolução de `features` para o prompt, um dos 3 sites de leitura a atualizar.
- [apps/web/src/components/setup/SetupWizard.tsx:233-243,888](../../../apps/web/src/components/setup/SetupWizard.tsx:233) — `previewFeatures`, segundo site de leitura.
- [apps/web/src/components/character/FeaturesPanel.tsx](../../../apps/web/src/components/character/FeaturesPanel.tsx) — consumidor final, sem alteração de código.
- `scripts/srd/_data/BackgroundBenefit.json` — dataset cru onde a medição de 13/08/2026 (20/21 origens, Acólito como exceção) foi feita.
- [US-41](./US-41-features-traits-de-classe.md) — precedente completo do mecanismo inteiro (schema, materialização, resolução, UI), aplicado aqui à origem.
- [US-125](./US-125-beneficios-origem-no-system-prompt.md) — escopo dela (`adventures_and_advancement`/conexão/memento) nunca incluiu `'feature'`; nenhuma coordenação de ordem entre as duas.
- [US-128](./US-128-memento-e-equipamento-da-origem-como-itens-do-inventario.md) — precedente direto de dado derivado paralelo (`backgroundEquipment`) a partir de outro `benefits[].type`.
