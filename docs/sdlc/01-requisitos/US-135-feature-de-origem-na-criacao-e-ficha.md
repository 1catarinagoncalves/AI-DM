# US-135 — Feature de origem (benefício `feature` do background) na criação e na ficha, como as features de classe

**Épico:** 1 — Personagem
**Fase:** 1 — MVP single-player
**Status:** 🚧 Em progresso
**Depende de:** [US-121](./US-121-catalogo-backgrounds-a5e-adventurers-guide.md) (catálogo `config.backgrounds`, benefit `type: "feature"` já extraído, sem mecanização) · [US-122](./US-122-escolha-background-catalogo-na-criacao.md) (escolha de origem — é o `origin.key` que decide se o benefício `feature` existe pra este personagem) · [US-41](./US-41-features-traits-de-classe.md) (precedente direto: `SystemClassFeature`/`getClassFeatures`/`resolveSheetEntries`/`FeaturesPanel` — esta story aplica o MESMO mecanismo à origem)
**Relacionado:** [US-100](./US-100-ficha-do-personagem-no-locale-ativo.md) (`Character.features` guarda CHAVES, resolvidas no locale de quem lê — esta story precisa seguir a mesma regra, não materializar texto cru) · [US-106](./US-106-catalogo-com-chave-e-free-herdando-o-srd.md) (chave canônica EN sobrevivendo à tradução) · [US-123](./US-123-integracao-mecanica-background-pointbuy.md)/[US-131](./US-131-integracao-mecanica-background-proficiency.md)/[US-129](./US-129-escolha-idioma-beneficio-language-background.md)/[US-132](./US-132-escolha-ferramenta-beneficio-tool-proficiency-background.md)/[US-128](./US-128-memento-e-equipamento-da-origem-como-itens-do-inventario.md) (mecanizam os outros 5 tipos de benefício estruturado ou semi-estruturado do background — `feature` é o único dos 8 tipos do a5e-ag que ainda não tem NENHUM tratamento no código, nem awareness nem mecânico) · [US-125](./US-125-beneficios-origem-no-system-prompt.md) (📋 Planejada — hoje injeta `feature` cru no prompt dentro de `## Origin benefits`; depois desta story, `feature` fica redundante lá, ver §Fora do escopo)
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

- **`ingest.mjs`**: `buildBackgrounds` ganha um terceiro retorno, `backgroundFeatures` — para cada benefício `type === 'feature'`, gera `{ key: '<originKey>_<slug-do-name>', name, description, source: 'a5e-ag' }` (mesmo padrão de slug/`key` canônico de `ClassFeature`, US-106). Origem sem benefício `feature` (só o Acolyte, hoje) → sem entrada no map, não `[]` vazio explícito (mesma convenção de `classFeatures`/`startingKits` — `map[key] ?? []` no consumidor cobre a ausência).
- **`SystemConfigSchema`** (`packages/shared/src/types/system.ts`) ganha `backgroundFeatures: z.record(z.string(), z.array(SystemClassFeatureSchema)).optional()` — reusa o schema de `classFeatures` (mesma forma `{key,name,description,source}`), sem tipo novo.
- **`packages/shared/src/starting-kit.ts`**: `getBackgroundFeatures(config, originKey): string[]`, espelhando `getClassFeatures` — `config.backgroundFeatures?.[originKey] ?? []`, mapeado para `.key`. Sem fallback `default` (origem é opcional; sem origem escolhida, sem feature de origem — diferente de classe, que é sempre obrigatória).
- **`character.service.ts`** (criação): `Character.features` passa a ser a UNIÃO das chaves de classe (`getClassFeatures`, já existente) com as chaves de origem (`getBackgroundFeatures(config, originKey)`, novo), no mesmo array — mesmo campo, sem coluna nova no Prisma. Sem origem escolhida (`originKey` ausente) → só as features de classe, comportamento idêntico ao de hoje.
- **Resolução na leitura** (`ai.service.ts`, `apps/web/src/app/play/[adventureId]/page.tsx`, preview do `SetupWizard.tsx`): as chaves de `Character.features` passam a resolver contra a UNIÃO de `config.classFeatures[classKey]` (ou `default`) **e** `config.backgroundFeatures[originKey]`, não só a primeira — ver §Notas de implementação para uma forma concreta de fazer isso sem alterar a assinatura de `resolveSheetEntries`.
- **`FeaturesPanel`**: nenhuma mudança — a aba "Features" já é uma lista `{name,description}[]` sem distinguir origem do item; a feature da origem aparece na MESMA lista das features de classe, na ordem em que `Character.features` as materializa (classe primeiro, origem depois — decisão simples, sem critério de ordenação adicional a inventar).
- **Preview da revisão do wizard** (`SetupWizard.tsx`, mesmo bloco que já monta `previewFeatures` para classe): passa a incluir a feature da origem quando `charData.origin?.key` está preenchido — mesma função `resolveSheetEntries`/`getBackgroundFeatures`, sem componente novo (US-127 já garante que revisão e ficha em jogo consomem o mesmo `FeaturesPanel`).
- **Teste em `ingest.test.mjs`**: `buildBackgrounds` com fixture sintética cobrindo background com benefício `feature` (chave gerada, presente em `backgroundFeatures`) e background sem ele (ausente do map, sem crash) — mesmo padrão dos testes de `backgroundEquipment`/grants da US-123/US-128/US-131.
- **Teste em `character.service.test.ts`**: personagem criado com origem que tem `feature` → chave de origem presente em `Character.features` junto da de classe; origem sem `feature` (Acólito) ou sem origem escolhida → só chaves de classe, sem entrada fantasma.

### Fora do escopo

- **Escolha entre múltiplas features de origem** — não existe hoje: 20 das 21 origens têm exatamente 1 `feature`, nenhuma tem mais de 1 (medido em 13/08/2026). Se o dataset mudar isso num bump futuro, o modelo já suporta (`SystemClassFeature[]` é array), mas não há UI de escolha a construir agora — mesma decisão de "sem editor" que a US-41 tomou para features de classe.
- **Resolução mecânica da feature** (usos, custo, recuperação em descanso) — awareness apenas, mesmo corte da US-41. *Thieves' Cant* vira "o personagem conhece esse código" no prompt, não um sistema de cifra.
- **Atualizar `US-125`** (injeção genérica de `feature`/`tool_proficiency`/`language`/`equipment` cru como `## Origin benefits`) — depois desta story, `feature` fica **duplicado** no prompt (uma vez estruturado via `## Class features`-equivalente, outra vez cru via `## Origin benefits`, caso a US-125 seja implementada sem ajuste). A correção certa é a US-125 adicionar `'feature'` ao seu `EXCLUDED_BENEFIT_TYPES` quando ela for implementada (ela já faz exatamente isso para `ability_score`/`skill_proficiency`, mecanizados por outras stories) — mudança de 1 linha *nela*, não desta story, porque a US-125 ainda não foi implementada (Status: Planejada) e pode nascer já com a lista certa se as duas forem sequenciadas (ver §Questões em aberto).
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

Exemplo de entrada derivada pelo ingest (Criminoso):

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
| `backgroundFeatures[origin][].key` | string | `<originKey>_<slug-do-name>`, canônica EN (US-106) |

**Persistência:** mesmo artefato `srd-5e.config.<locale>.json` (US-47/US-99), sem migração Prisma — `Character.features` (já existe, US-41) passa a poder conter chaves com prefixo `a5e-ag_*` além de `<classe>_*`.

---

## Critérios de aceite

- [ ] `ingest.mjs` deriva `backgroundFeatures` a partir do benefício `type === 'feature'`: as 20 origens medidas com esse benefício ganham 1 entrada cada; o Acólito (única sem `feature`) não gera entrada no map.
- [ ] `SystemConfigSchema` valida `backgroundFeatures` opcional; config sem o campo continua válido (compatibilidade com artefato anterior a esta story).
- [ ] `getBackgroundFeatures(config, originKey)` devolve as chaves da origem; `originKey` ausente ou sem entrada no map → `[]`, sem lançar.
- [ ] **Criação:** personagem com origem que tem `feature` (ex. Criminoso) tem, em `Character.features`, a chave de classe **e** a chave de origem juntas. Origem sem `feature` (Acólito) ou sem origem escolhida → só as chaves de classe, idêntico ao comportamento pré-story.
- [ ] **Ficha (UI):** a aba "Features" mostra a feature da origem (nome + descrição, no locale ativo de quem lê — US-100) junto das features de classe, sem aba nova, sem componente novo.
- [ ] **Revisão do wizard:** o preview da etapa `review` mostra a feature da origem assim que `origin.key` está selecionado, mesmo `FeaturesPanel` que a ficha em jogo usa (US-127).
- [ ] Trocar a origem escolhida na criação (antes do submit) atualiza o preview da feature correspondente, sem misturar a feature de uma origem anterior.
- [ ] Nenhuma string nova hardcoded no JSX (gate da US-102) — a aba "Features" já tem suas chaves de mensagem (US-41); nenhuma nova é necessária.
- [ ] **Eval / teste de regressão:** `ingest.test.mjs` cobre `buildBackgrounds` com fixture de origem com/sem benefício `feature`. `character.service.test.ts` cobre criação com origem com `feature` (chave presente) e sem (Acólito ou sem origem, chave ausente).

---

## Notas de implementação

- **Precedente direto: `backgroundEquipment` (US-128).** Mesma forma — `buildBackgrounds` já devolve um segundo dado derivado de `benefits[].type`, keyed por `SystemBackground.key`; `backgroundFeatures` é o mesmo padrão com um terceiro tipo (`'feature'` em vez de `'equipment'`), sem inventar mecanismo novo.
- **O ponto delicado é a leitura, não a escrita.** `resolveSheetEntries(byClass, retired, classKey, keys)` hoje resolve TODAS as chaves contra `byClass[classKey] ?? byClass['default']` — um único mapa, uma única chave de lookup. Com `Character.features` misturando chaves de classe e de origem, um chamador não pode simplesmente passar `config.classFeatures` sozinho (a chave de origem cairia no fallback `{key, name: key}`, mostrando `a5e-ag_criminal_thieves-cant` cru na tela). **Sugestão que não exige mudar a assinatura de `resolveSheetEntries`:** no site de leitura, montar um mapa sintético de UMA entrada combinando as duas fontes antes de chamar a função já existente:
  ```ts
  const classList = config?.classFeatures?.[character.class] ?? config?.classFeatures?.default ?? []
  const originList = character.origin?.key ? (config?.backgroundFeatures?.[character.origin.key] ?? []) : []
  const features = resolveSheetEntries({ combined: [...classList, ...originList] }, config?.retiredFeatures, 'combined', character.features)
  ```
  Isso precisa ser repetido nos 3 sites que hoje chamam `resolveSheetEntries` para features (`ai.service.ts`, `page.tsx`, `SetupWizard.tsx` preview) — candidato a virar 1 função utilitária pequena em `packages/shared` (`resolveCharacterFeatures(config, character)`) se a duplicação incomodar na implementação; não é obrigatório, é chamada 3× hoje mesmo sem esta story.
  Não há risco de colisão de chave entre as duas fontes: chaves de classe são `<classe>_<slug>` (`paladin_lay-on-hands`), chaves de origem são `a5e-ag_<slug-origem>_<slug-feature>` (`a5e-ag_criminal_thieves-cant`) — prefixos disjuntos.
- **`retiredFeatures` continua servindo as duas fontes** — é um único mapa achatado por chave (US-100), não importa se a chave aposentada era de classe ou de origem.
- **Não reabrir `SystemBackgroundBenefitSchema`/`SystemBackgroundGrantSchema`** (US-123/US-131) — o benefício `feature` **não** ganha um `grant` estruturado (não é bônus numérico nem escolha), fica só no `benefits[]` cru como hoje; o dado novo é o `backgroundFeatures` derivado, paralelo, não uma mudança nesses dois schemas.
- **Se a US-125 for implementada depois desta:** já nasce com `'feature'` em `EXCLUDED_BENEFIT_TYPES` (evita a duplicação descrita em §Fora do escopo). Se for implementada ANTES, a implementação desta story precisa voltar lá e adicionar a exclusão — 1 linha, arquivo `packages/ai-engine/src/prompts/dm-system.ts`.

---

## Questões em aberto

1. **Ordem de sequenciamento com a US-125.** As duas mexem na mesma superfície (o que a origem "dá" ao personagem, exposto ao mestre) por caminhos diferentes (esta: estruturado, na ficha e no prompt via `## Class features`-equivalente; US-125: texto cru genérico no prompt). Sugestão: implementar esta story ANTES da US-125, e a US-125 já nasce excluindo `'feature'` — evita escrever a exclusão duas vezes.
2. **Nome da chave gerada (`slugify`).** O ingest já tem uma função de slug para `ClassFeature` (US-41/US-106) — reusar a mesma, não escrever uma segunda. Confirmar o nome exato da função existente antes de implementar (não medido nesta story).
3. **Vale a pena extrair `resolveCharacterFeatures` como utilitário único** (ver §Notas de implementação) já nesta story, ou deixar a duplicação nos 3 sites de leitura e extrair depois se incomodar? Sugestão: decidir na implementação, não é uma decisão de produto.

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
- [US-128](./US-128-memento-e-equipamento-da-origem-como-itens-do-inventario.md) — precedente direto de dado derivado paralelo (`backgroundEquipment`) a partir de outro `benefits[].type`.
