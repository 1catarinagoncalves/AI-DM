# US-231 — Features de classe e subclasse por nível, na criação e na ficha

**Épico:** 1 — Personagem
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** [US-41](./US-41-features-traits-de-classe.md) (mecanismo base: `Character.features` como chaves, `config.classFeatures`, `resolveCharacterFeatures` — esta story estende, não substitui) · [US-227](./US-227-nivel-inicial-pv-e-bonus-de-proficiencia-por-classe.md) (nível já é escolhido na criação — `levelValue` existe no `SetupWizard`, só não alimenta features ainda) · [US-205](./US-205-escolha-por-cartao-classe-e-raca.md) (subclasse já é escolhida/resolvida na criação — `Character.subclass`, automática quando a classe tem 1 opção, por cartão quando tem 2+) · [US-141](./US-141-catalogo-subclasses-srd-5-1-e-marshal.md) (catálogo `config.subclasses` por classe) · [US-136](./US-136-tag-origem-classe-nas-features.md) (padrão de `origin` por feature, ganha um 4º valor aqui)
**Relacionado:** [backlog-economia-de-recursos-do-personagem.md](./backlog-economia-de-recursos-do-personagem.md) (dependência **D2**, "dado de progressão no artefato" — esta story resolve D2 para features, destravando REC-4) · [backlog-aventuras-autorais-lazygm.md](./backlog-aventuras-autorais-lazygm.md) (mesma D2) · [US-142](./US-142-tracos-mecanicos-subespecie-srd-5-1.md) (precedente do parâmetro opcional que esta story repete para subclasse)
**Criada em:** 2026-09-11

---

## História

> **Como** jogador,
> **quero** ver as features de classe **e de subclasse** que meu personagem já tem em **cada nível** (Fúria no 1, Estilo de Luta no 1, Ataque Extra no 5, Discípulo da Vida no 1 pela subclasse, Frenesi no 3 pela trilha…), tanto ao criar o personagem quanto depois na ficha,
> **para que** eu saiba tudo que meu personagem pode fazer sem precisar consultar o livro, e o mestre narre esses poderes com o mesmo conhecimento.

---

## Contexto e motivação

### O problema observado

A [US-41](./US-41-features-traits-de-classe.md) resolveu awareness de features de classe, mas **hardcoded para nível 1** — cabia na Fase 1 porque, na época, todo personagem nascia nível 1 e ninguém escolhia subclasse. Duas coisas mudaram desde então: a [US-227](./US-227-nivel-inicial-pv-e-bonus-de-proficiencia-por-classe.md) deixou criar personagem em qualquer nível de 1 a 20, e a [US-205](./US-205-escolha-por-cartao-classe-e-raca.md) (com a US-141 por baixo) passou a resolver a subclasse de todo personagem na criação — hoje **as 13 classes têm subclasse resolvida** (12 automáticas, por terem só 1 opção no SRD 5.1; Marshal por cartão, com 3). Nenhuma das duas mudanças chegou nas features: um Clérigo de Domínio da Vida nível 8 não vê **Disciple of Life** nem **Divine Strike** em lugar nenhum (features de subclasse, nunca ingeridas) nem **Destroy Undead** (feature de nível 5 da classe-mãe, cortada pelo filtro de nível 1). Um Guerreiro Campeão nível 10 não vê **Ataque Extra** (classe, nível 5) nem **Remarkable Athlete** (subclasse Champion, nível 7).

### Por que a solução atual não basta

Duas lacunas distintas no mesmo pipeline (`scripts/srd/ingest.mjs`):

1. **Nível da classe-mãe descartado.** `buildClassFeatures` ([ingest.mjs:464](../../../scripts/srd/ingest.mjs:464)) já **lê** `featureItems[].fields.level` do Open5e — o dado de progressão completo existe na fonte (`ClassFeatureItem.json`: Ataque Extra do Bárbaro no nível 5, Melhoria de Atributo em 4/8/12/16/19 etc.) — mas descarta tudo que não é `level === 1` antes de gravar no artefato.
2. **Subclasse nunca entra no pipeline de features, em nenhum nível.** `buildClassFeatures` resolve `parent` só contra `CLASS_MAP` (chaves de **classe-mãe**). Feature cujo `parent` é pk de **subclasse** (`srd_life-domain`, `srd_path-of-the-berserker`, `srd_champion`…) cai fora do `CLASS_MAP` e é descartada — mesmo a de nível 1 (Bonus Proficiency e Disciple of Life do Domínio da Vida, por exemplo, já deveriam aparecer HOJE e não aparecem). **Verificado no dataset (2026-09-11):** isto não é falta de escolha — `Character.subclass` já guarda a subclasse resolvida desde a US-205 — é um pipeline de ingest que nunca foi escrito para o pk de subclasse.

Do artefato pra frente, `getClassFeatures`/`resolveCharacterFeatures` ([starting-kit.ts:288](../../../packages/shared/src/starting-kit.ts:288) e [:317](../../../packages/shared/src/starting-kit.ts:317)) e a UI (`SetupWizard.tsx`, `FeaturesPanel.tsx`) não têm **nenhum** conceito de nível nem de subclasse — só "features de nível 1 da classe-mãe".

### A proposta

Levar `level` e `subclass` até o fim da cadeia:

1. **Ingest (classe-mãe):** `buildClassFeatures` para de descartar `level > 1` e grava `level` em cada `SystemClassFeature`.
2. **Ingest (subclasse):** nova função `buildSubclassFeatures`, espelhando a de classe, mas iterando features cujo `parent` é pk de **subclasse** (mesma derivação de chave que `buildSubclasses` já usa) — grava em `config.subclassFeatures`, com `level`.
3. **Resolução:** `getClassFeatures` ganha parâmetro de nível; `getSubclassFeatures` (nova, mesmo contrato) resolve por chave de subclasse + nível; `resolveCharacterFeatures` ganha `subclassKey` opcional e um 4º valor de `origin`.
4. **Criação:** `SetupWizard` materializa e mostra, juntas e ordenadas por nível, as features da classe e da subclasse resolvida até `levelValue`.
5. **Ficha:** `FeaturesPanel` anota o nível de desbloqueio de cada feature (badge) e distingue feature de subclasse com badge próprio (ela aparece na aba — ao contrário de traço racial, que a US-136 já filtra daqui).

---

## Escopo

### Dentro do escopo

- `SystemClassFeatureSchema` ganha campo `level: number` (presente em `classFeatures` e `subclassFeatures`; ausente em `backgroundFeatures`/`raceFeatures`, que não têm progressão por nível).
- `buildClassFeatures` (`ingest.mjs`) itera **todos** os níveis de `featureItems`, não só `level === 1`; grava o nível de desbloqueio de cada feature (o menor nível em que o `pk` aparece em `featureItems`, quando uma feature tem múltiplas entradas de progressão).
- **Melhoria de Atributo** (`*_ability-score-improvement`) continua fora — é escolha mecânica do jogador (feat ou +2 em atributos), não uma feature narrável; mesmo tratamento que `isProficiencies`/`isSpellEngine` já dão a outro ruído do dataset.
- **Nova função `buildSubclassFeatures`** (`ingest.mjs`): mesma disciplina de `buildClassFeatures` (filtros de ruído, `resolve`, ordenação por chave), mas com a fonte de pks trocada — `classes.filter(c => c.fields.subclass_of !== null)`, chave derivada do mesmo jeito que `buildSubclasses` já faz (`stripDocument(c.pk)`, ex. `srd_life-domain` → `life-domain`). Grava em `config.subclassFeatures: Record<subclassKey, SystemClassFeature[]>` — mapa **plano** por chave de subclasse (mesmo padrão de `backgroundFeatures`/`raceFeatures`: não aninhado por classe, porque a chave de subclasse já é única no catálogo).
- Filtro de "tabela de magias de domínio" (`life-domain-spells-table` e equivalente): mesmo espírito do `isNoise`/`isSpellEngine` já existente — não é uma feature que o personagem "faz", é lista de magias (raia com US-42). Ver Notas de implementação.
- `getClassFeatures(config, classKey, level)`: novo parâmetro `level`, filtra `f.level <= level`; chamada sem o parâmetro é erro de compilação (força todo call site a decidir o nível), não um default silencioso.
- **Nova função `getSubclassFeatures(config, subclassKey, level)`**: espelha `getClassFeatures`; `subclassKey` `undefined` (classe sem subclasse resolvida — não deveria acontecer hoje, mas a função não assume) devolve `[]`, nunca lança.
- `resolveCharacterFeatures` ganha parâmetro `subclassKey?: string` (no fim da assinatura, mesmo lugar/disciplina do `raceKey?` que a US-142 já acrescentou — não quebra call site posicional existente); `CharacterFeature['origin']` ganha o valor `'subclass'`.
- `character.service.ts`: materialização na criação une `getClassFeatures(config, classKey, character.level)` **e** `getSubclassFeatures(config, character.subclass, character.level)` (já existe desde a US-205, só não é consultado por features ainda).
- `SetupWizard.tsx`: o preview de features (linha 584) usa `levelValue` e `resolvedSubclass` (ambos já existem no componente, US-227/US-205) nas duas chamadas.
- `FeaturesPanel.tsx`:
  - Cada feature de classe/subclasse mostra o nível de desbloqueio (badge, mesmo padrão visual do badge de origem da US-136).
  - `origin === 'subclass'` ganha rótulo de badge próprio — **não** cai na ternária binária atual `class`/`background` ([FeaturesPanel.tsx:65](../../../apps/web/src/components/character/FeaturesPanel.tsx:65)), e **não** é filtrada como `'race'` é hoje ([FeaturesPanel.tsx:38](../../../apps/web/src/components/character/FeaturesPanel.tsx:38)) — subclasse deve aparecer nesta aba, é onde o jogador vê o que a especialização dá.
  - Nova chave de i18n (`game.features.tag.subclass`) em `en-US.ts`/`pt-BR.ts`.
- Ordenação: features de classe e subclasse aparecem **juntas**, ordenadas por nível crescente e, em empate (duas features no mesmo nível), por `key` — mantém a idempotência do artefato que a US-47 exige (não duas listas separadas, não mais só por chave alfabética como hoje).

### Fora do escopo

- **Recomputar features de personagem já existente ao subir de nível durante uma aventura.** Não há mecanismo de level-up em jogo na Fase 1 (nível é escolhido uma vez, na criação) — quando esse sistema existir, ele consome os mesmos `getClassFeatures`/`getSubclassFeatures` com o novo nível, mas o gatilho de recomputação é story futura.
- **Melhoria de Atributo** como escolha jogável (feat vs. +2/+2) — mecânica de progressão que não existe na Fase 1; ver Dentro do escopo.
- **Como a subclasse é escolhida** (cartão único vs. múltiplo, US-205) — esta story só **consome** `Character.subclass` já resolvido; não mexe no fluxo de escolha.
- **Resolução mecânica de recursos** (usos de Fúria por descanso, dados de Ataque Furtivo, cargas de Canalizar Divindade) — REC-4 do [backlog-economia-de-recursos-do-personagem.md](./backlog-economia-de-recursos-do-personagem.md), story separada; esta US só resolve a D2 (dado de progressão), não a economia de uso.
- **Detalhe textual de escalada dentro da mesma feature** (Crítico Brutal ganha +1 dado nos níveis 9/13/17 do Bárbaro; Divine Strike do Domínio da Vida também escala) — se o Open5e modela como `pk`s distintos, cada um vira uma entrada própria com seu nível; se modela como `detail` variável num único `pk`, materializa-se só a entrada base. Ver Notas de implementação.
- **Multiclasse** — fora do MVP (personagem é sempre uma classe só); a interação de progressão com multiclasse não se aplica.

---

## Modelo de dados proposto

```ts
export const SystemClassFeatureSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  source: z.string().min(1),
  level: z.number().int().min(1).optional(), // US-231: em classFeatures/subclassFeatures; ausente = origem/raça
})

// US-231: mapa plano por chave de SUBCLASSE (não aninhado por classe — a chave já é única,
// mesmo padrão de backgroundFeatures/raceFeatures).
subclassFeatures: z.record(z.string(), z.array(SystemClassFeatureSchema)).optional(),
```

| Campo | Tipo | Descrição |
|---|---|---|
| `level` | `number` (opcional) | Nível mínimo de personagem em que a feature é desbloqueada. Presente em `config.classFeatures[*][]` e `config.subclassFeatures[*][]`; ausente em `backgroundFeatures`/`raceFeatures`. |
| `subclassFeatures` | `Record<string, SystemClassFeature[]>` | Novo mapa no `SystemConfig`, chave = chave de subclasse (`life-domain`, `champion`, `thief`…), mesma forma de `classFeatures[*]`. |

`CharacterFeature['origin']` ([starting-kit.ts:273](../../../packages/shared/src/starting-kit.ts:273)) passa de `'class' | 'background' | 'race'` para `'class' | 'background' | 'race' | 'subclass'`.

**Persistência:** `Character.features` continua sendo `Json` — lista de **chaves** (US-100), sem mudança de forma. O que muda é **quantas** chaves entram na lista na criação: hoje só as de classe-mãe com `level === 1`; depois desta story, todas de classe-mãe **e** de subclasse com `level <= character.level`, usando `Character.subclass` (já existe, US-205) para saber qual subclasse consultar. Personagem nível 1 sem subclasse com feature nesse nível continua idêntico ao comportamento atual (sem regressão no caso majoritário anterior à US-205 já ter sido implementada).

---

## Critérios de aceite

- [x] `buildClassFeatures` grava `level` em cada `SystemClassFeature` de classe, lendo de `featureItems[].fields.level` (não mais hardcoded em `1`).
- [x] Feature de Melhoria de Atributo (`*_ability-score-improvement`) não entra no artefato, nos mesmos moldes de `isProficiencies`/`isSpellEngine`.
- [x] `getClassFeatures(config, classKey, level)` devolve todas as features de classe com `level <= level` informado, ordenadas por nível crescente; chamar sem o argumento de nível é erro de tipo.
- [x] Bárbaro nível 5 tem **Fúria**, **Defesa sem Armadura** (nível 1) e **Ataque Extra** (nível 5) na lista; Bárbaro nível 4 **não** tem Ataque Extra.
- [x] `config.subclassFeatures` existe no artefato, com entrada para cada subclasse hoje ingerida (`life-domain`, `path-of-the-berserker`, `champion`, `thief`, `draconic-bloodline`, `the-fiend`, `college-of-lore`, `circle-of-the-land`, `way-of-the-open-hand`, `oath-of-devotion`, `hunter`, `school-of-evocation`, e as 3 do Marshal), cada feature com o `level` correto (ex. `life-domain`: `bonus-proficiency` e `disciple-of-life` no 1, `channel-divinity-preserve-life` no 2, `blessed-healer` no 6, `divine-strike` no 8, `supreme-healing` no 17).
- [x] Tabela de magias de domínio (`life-domain-spells-table` e equivalentes) não entra como feature de subclasse.
- [x] `getSubclassFeatures(config, subclassKey, level)` espelha `getClassFeatures`; `subclassKey` `undefined` devolve `[]` sem lançar.
- [x] Clérigo nível 1 (Domínio da Vida, única subclasse do SRD, resolvida automaticamente) tem **3** features: Divine Domain (classe-mãe) + Bonus Proficiency + Disciple of Life (subclasse) — hoje tem só 1.
- [x] Clérigo nível 8 tem também Divine Strike (subclasse, nível 8) e Destroy Undead (classe-mãe, nível 5); Guerreiro Campeão nível 10 tem Ataque Extra (classe, nível 5) e Remarkable Athlete (subclasse Champion, nível 7).
- [x] `resolveCharacterFeatures` aceita `subclassKey` opcional (parâmetro final, compatível com call sites existentes que não o passam) e marca `origin: 'subclass'` corretamente.
- [x] **Criação (UI):** preview de features no `SetupWizard` muda ao mudar o nível e, nas classes com 2+ subclasses (Marshal), ao trocar a subclasse escolhida no cartão — sem reload.
- [x] **Ficha (UI):** `FeaturesPanel` mostra o nível de desbloqueio em cada feature; feature de subclasse aparece na aba (não é filtrada como traço racial é) com badge próprio, distinto de classe/origem.
- [x] Personagem criado nível 1 antes desta story (sem as features de subclasse que ainda não existiam) não quebra ao ser lido — chaves antigas continuam resolvendo normalmente contra o catálogo ampliado.
- [x] **Eval / teste de regressão:** `starting-kit.test.ts` cobrindo `getClassFeatures(config, 'barbarian', 5)` (inclui `barbarian_extra-attack`, exclui em nível 4) e `getSubclassFeatures(config, 'life-domain', N)` em 3 pontos de nível (1, 6, 8); `ingest.test.mjs` cobrindo que `ability-score-improvement` nunca aparece no artefato e que `config.subclassFeatures` tem todas as subclasses ingeridas.

---

## Notas de implementação

- Ao remover o filtro `lvl1` de `buildClassFeatures` ([ingest.mjs:469](../../../scripts/srd/ingest.mjs:469)), checar se alguma feature tem mais de um `pk` para a mesma capacidade em níveis diferentes — **não assumir**, rodar o `ingest` com log e olhar o `classFeatures`/`subclassFeatures` gerado antes de fechar a US. Se o Open5e usa `pk`s distintos por nível de escalada, cada um vira uma entrada própria (comportamento natural do loop já existente); se usa `detail` variável num `pk` único, materializar só a entrada-base.
- `buildSubclassFeatures` é função **nova e separada** de `buildClassFeatures` (não um branch dentro dela) — a fonte de pks é disjunta (`subclass_of !== null` vs. `=== null`), e separar simplifica o "falha alto se pk órfão" no mesmo espírito de `buildSubclasses` ([ingest.mjs:444](../../../scripts/srd/ingest.mjs:444)). Reusar a MESMA derivação de chave (`stripDocument(c.pk)`) para não inventar uma segunda forma de nomear subclasse; a chave da feature vira `${subclassKey}_${slug}` (ex. `life-domain_bonus-proficiency`), espelhando `${canon}_${slug}` da classe.
- `getClassFeatures`/`getSubclassFeatures` sem default de nível é proposital: todo call site (criação, sheet, testes) precisa decidir explicitamente qual nível está pedindo — um default de `1` esconderia call sites esquecidos silenciosamente (mesma cicatriz que motivou "nunca lançar, nunca inventar" da US-41).
- `resolveCharacterFeatures` ([starting-kit.ts:288](../../../packages/shared/src/starting-kit.ts:288)): o filtro por nível acontece antes, em `getClassFeatures`/`getSubclassFeatures`, no momento da materialização — ela só passa a resolver contra um catálogo combinado maior (classe + subclasse + origem + raça) e devolver `level` no objeto resolvido (já vem de `SystemClassFeatureSchema`), pro `FeaturesPanel` usar no badge.
- Badge de subclasse no `FeaturesPanel.tsx`: hoje `origin === 'race'` é **filtrado** ([FeaturesPanel.tsx:38](../../../apps/web/src/components/character/FeaturesPanel.tsx:38)) — `'subclass'` é o oposto, **precisa** aparecer nesta aba. Não copiar o filtro de raça.
- Rótulo do badge de subclasse: **genérico "Subclasse"** (nova chave i18n `game.features.tag.subclass`), decidido — mesmo padrão dos badges de Classe/Origem, que também são rótulo de categoria e não o nome da entidade (o badge de classe não diz "Guerreiro", diz "Classe"). Trocar por nome da subclasse quebraria essa consistência visual e ainda exigiria achar `config.subclasses[classKey]` no momento de render, sem ganho real — a subclasse do personagem já está visível em outro lugar da ficha (US-205).
- `SetupWizard.tsx:584` e `character.service.ts:132` são os dois call sites de `getClassFeatures` hoje (confirmado por grep); ambos precisam ganhar a chamada extra a `getSubclassFeatures` ao lado, com `resolvedSubclass`/`character.subclass` já disponíveis no escopo.

---

## Questões em aberto

Todas fechadas — nenhuma decisão pendente pra quem for implementar.

1. ~~Ordenação de exibição: nível crescente, ou nível com desempate alfabético?~~ — **decidido:** nível crescente, empate por `key` (mantém a idempotência do artefato que a US-47 exige). Já refletido em Escopo e nos Critérios de aceite.
2. ~~Prompt do mestre precisa de critério de aceite próprio para passar a incluir features de nível mais alto e de subclasse?~~ — **decidido: não.** O prompt (US-41) já itera `Character.features` sem `if` por feature — é consequência automática da materialização mudar, mesma lista/mesmo consumidor, sem trabalho nem CA extra.
3. ~~Rótulo do badge de subclasse: genérico "Subclasse" ou nome da subclasse ("Domínio da Vida")?~~ — **decidido: genérico**, mesmo padrão dos badges de Classe/Origem (rótulo de categoria, não nome da entidade — consistência visual vence, sem custo de lookup extra). Ver Notas de implementação.
4. ~~Marshal (a5e-ag) com 3 subclasses: têm feature de nível 1 real ou caem no padrão martial-em-nível-3?~~ — **verificado no dataset (2026-09-11):** as 3 (`gambling-general`, `swift-strategist`, `talented-tactician`) seguem exatamente o padrão martial — primeira feature no **nível 3** (`daring-commander`/`make-haste`+`skirmisher`/`tactical-edge`), nada no 1. Mesmo formato de progressão de Bárbaro/Guerreiro/Ladino/Bardo (5 marcos: 3, 7, 11, 15, 18 — só desloca 14→18 em relação ao SRD). Sem caso especial: o Marshal não precisa de tratamento diferente no `buildSubclassFeatures` por ser a5e-ag em vez de srd (o `source` do dataset já distingue isso, US-139).

---

## Referências no código

- `scripts/srd/ingest.mjs:464` — `buildClassFeatures`, o filtro `lvl1` a remover.
- `scripts/srd/ingest.mjs:444` — `buildSubclasses`, padrão de derivação de chave (`stripDocument`) a reusar em `buildSubclassFeatures`.
- `scripts/srd/_data/ClassFeatureItem.json` / `ClassFeature.json` — dado cru do Open5e com `level` e `parent` (classe-mãe OU subclasse) por feature.
- `packages/shared/src/types/system.ts:191` — `SystemClassFeatureSchema`, onde `level` entra.
- `packages/shared/src/types/system.ts:310` — `subclasses` (catálogo, US-141), vizinho de onde `subclassFeatures` entra.
- `packages/shared/src/starting-kit.ts:317` — `getClassFeatures`, ganha parâmetro de nível.
- `packages/shared/src/starting-kit.ts:288` — `resolveCharacterFeatures`, ganha `subclassKey?` e `origin: 'subclass'`.
- `packages/shared/src/starting-kit.ts:273` — `CharacterFeature['origin']`, união a estender.
- `apps/api/prisma/schema.prisma:67` — `Character.features`, comentário já defasado (diz `{name, description}[]`, é `string[]` de chaves desde a US-100/US-135) — vale corrigir o comentário nesta story.
- `apps/api/prisma/schema.prisma` — `Character.subclass` (US-205), a chave que `getSubclassFeatures` consulta.
- `apps/api/src/character/character.service.ts:132` — materialização de features na criação, passa a incluir `character.level` e `character.subclass`.
- `apps/web/src/components/setup/SetupWizard.tsx:584` — preview de features na criação; linhas 445-451 (`subclassCatalog`/`resolvedSubclass`) já resolvem a subclasse efetiva, é só reusar.
- `apps/web/src/components/character/FeaturesPanel.tsx:14-18` — `ClassFeature.origin`, união a estender; linha 38 (filtro de `'race'`, não replicar para `'subclass'`); linha 65 (ternária de badge, vira lookup por `origin`).
- `apps/web/src/messages/en-US.ts` / `pt-BR.ts` — chaves `game.features.tag.*`, onde `subclass` entra.
- `docs/sdlc/01-requisitos/US-41-features-traits-de-classe.md` — mecanismo base que esta story estende (nota sobre Clérigo/Feiticeiro/Bruxo "sem features" está desatualizada desde a US-141/US-205).
