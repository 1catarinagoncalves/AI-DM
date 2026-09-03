# US-211 — Ancestralidade dracônica do Dragonborn (escolha de tipo de dragão)

**Épico:** 1 — Personagem
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada (03/09/2026)
**Depende de:** [US-142](./US-142-tracos-mecanicos-subespecie-srd-5-1.md) (**obrigatória e anterior**: é ela que emite `config.raceFeatures['dragonborn']` com os 4 traços-prosa que esta story finalmente resolve — `draconic-ancestry-table`, `draconic-ancestry`, `breath-weapon`, `damage-resistance`; e que cortou explicitamente "motor de regra que consome o traço… resistência mecânica" do escopo, prometendo story própria) · [US-140](./US-140-catalogo-subracas-srd-5-1.md) (`dragonborn` é uma das 5 raízes SEM subespécie — o card de variante já existente em `SetupWizard.tsx` não serve pra este caso) · [US-205](./US-205-escolha-por-cartao-classe-e-raca.md) (`CatalogCardGroup`, reusado aqui; `subclass` como precedente direto de campo `Character.<escolha>` opcional, condicionado por outra chave já escolhida)
**Relacionado:** [US-138](./US-138-catalogo-racas-srd-5-1-como-referencia.md) (fonte `srd-2014`, mesma raça) · [ADR 004](../../adr/004-origem-do-dado-de-sistema.md) (pipeline pinado — nota abaixo sobre por que a tabela de ancestralidade NÃO vem dele)

**Criada em:** 2026-09-03

---

## História

> **Como** jogadora que cria um personagem Dragonborn,
> **quero** escolher o tipo de dragão da minha ancestralidade dracônica (Negro, Azul, Latão, Bronze, Cobre, Ouro, Verde, Vermelho, Prata ou Branco),
> **para que** minha ficha grave o tipo de dano da minha arma de sopro e da minha resistência a dano, em vez de só me entregar a tabela inteira como texto solto que eu tenho que ler e decidir sozinha por fora do sistema.

---

## Contexto e motivação

### O traço existe, mas é só prosa que aponta pra uma escolha nunca feita

`config.raceFeatures['dragonborn']` ([`scripts/srd/srd-5e.config.pt-BR.json:3571-3632`](../../../scripts/srd/srd-5e.config.pt-BR.json:3571)) tem, hoje, 4 entradas relacionadas à ancestralidade dracônica:

| `key` | `name` | Conteúdo | Nesta story |
|---|---|---|---|
| `draconic-ancestry-table` | Tabela de Ancestralidade Dracônica | A tabela do PHB inteira despejada como markdown pipe-table dentro de `description` — 10 linhas, `Dragão \| Tipo de Dano \| Arma de Sopro` | **sai** do painel — vira os cards da grade nova |
| `draconic-ancestry` | Ancestralidade Dracônica | "Escolha um tipo de dragão da tabela… sua arma de sopro e resistência a dano são determinadas pelo tipo" | **sai** do painel — vira a própria ação de escolher um card |
| `breath-weapon` | Arma de Sopro | Fórmula de dano/CD, mas "sua ancestralidade dracônica determina o tamanho, a forma e o tipo de dano" — sem dizer qual | fica — não é explicado em nenhum outro lugar da tela |
| `damage-resistance` | Resistência a Dano | "Você tem resistência ao tipo de dano associado à sua ancestralidade dracônica" — idem | fica — idem |

Nenhuma das 4 pergunta a escolha. No wizard ([`SetupWizard.tsx:774-787`](../../../apps/web/src/components/setup/SetupWizard.tsx:774)) isso vira um card de "Traços raciais" com a tabela crua — pipes e tudo — como texto de um parágrafo, ilegível como card e inútil como mecânica: a jogadora sai da criação de personagem sem saber que tipo de dano ela resiste.

### Por que é lacuna, não decisão de produto represada de propósito

US-142 cortou "motor de regra que consome o traço (…, resistência mecânica)" do escopo dela, no mesmo corte que deixou Darkvision e Ability Score Increase como só-texto — mas nomeou a resistência explicitamente como exemplo do que ficaria de fora. Esta story é esse retomar, só que restrita à ancestralidade dracônica (não reabre ASI de raça em geral, nem Darkvision — ver §Fora do escopo).

### Verificado: a tabela não existe estruturada em nenhuma fonte do pipeline — precisa ser dado hardcoded

Diferente da [US-209](./US-209-hit-dice-e-salvaguardas-de-classe-no-config.md) (`hit_dice`/`saving_throws` já vêm estruturados no dataset, só nunca foram emitidos), medi `scripts/srd/_data/SpeciesTrait.2014.json` (Open5e, `srd-2014`, já sincronizado neste repo) e **todo** trait do `dragonborn` tem `"type": null` — inclusive o próprio `srd_dragonborn_draconic-ancestry-table`, cujo `desc` é a mesma string markdown que o `ingest` copia direto pro `pt-BR`. Não há campo latente pra só emitir: a tabela de 10 dragões existe *apenas* como prosa formatada, em inglês, dentro de um `desc`. Rodar `buildRaceFeatures` de novo, com qualquer ajuste, não resolve — o dado estruturado não está na fonte.

Consequência de design: a tabela de ancestralidade não é conteúdo do SRD ingerido (ao contrário de `races`/`classes`/`raceFeatures`) — é uma **regra fixa do PHB 2014** que precisa ser um dado hardcoded no próprio repositório, fora do pipeline `sync`/`ingest` (mesmo espírito de outras regras fixas já hardcoded no código, como a fórmula de CD "8 + modificador de Constituição + bônus de proficiência" que já está em `breath-weapon.description`, texto puro, nunca calculada).

### Referência visual: o protótipo já implementa a tela, com 5 ancestrais em vez de 10

[`refined-wizard-glow.lovable.app`](https://refined-wizard-glow.lovable.app/) é o mesmo protótipo de referência que os commits recentes já seguem (o texto de `ESCOLHA UMA ESPÉCIE`/`De onde vem o seu sangue?` bate literalmente com `setup.race.eyebrow`/`setup.race.heading` em `pt-BR.ts`). Navegado em 03/09/2026: escolher "Draconato" na etapa Espécie revela, logo abaixo do painel "TRAÇOS" (mesma posição do `raceStepFeatures` atual), uma segunda grade **"ESCOLHA UMA VARIANTE"** — o mesmo heading e o mesmo componente visual já usados para a subespécie de Elfo/Anão/Halfling/Gnomo (US-142, correção de 2026-09-02). Cada card mostra nome ("Ancestral Negro"), uma linha em destaque de resistência ("Resistência a ácido") e uma linha de descrição do sopro ("Sopro em linha de ácido corrosivo.") — mapeamento 1:1 com os campos `label`/`bonus`/`blurb` que `CatalogCardGroup`/`CatalogCardEntry` já aceitam (`CatalogCardGroup.tsx:13`), zero campo novo no componente.

**Diferença que esta story NÃO copia do protótipo:** o mockup só implementa 5 ancestrais (Negro, Azul, Dourado, Verde, Vermelho) — faltam Latão, Bronze, Cobre, Prata e Branco. É simplificação de mockup visual, não decisão de produto: o resto deste documento assume as **10** entradas completas do PHB 2014 (mesma tabela que `draconic-ancestry-table` já expõe por inteiro em prosa), consistente com o viés já estabelecido no projeto contra descartar dado que a fonte tem de graça (mesma motivação da US-140 §Contexto, sobre o catálogo de raça silenciosamente descartando subespécie que já existia no dataset).

---

## Escopo

### Dentro do escopo

- **`DRACONIC_ANCESTRY_TABLE`** (novo, `packages/shared/src/draconic-ancestry.ts`, exportado em `packages/shared/src/index.ts` — mesmo padrão flat de `ability.ts`/`roll.ts`/`spell.ts`, sem subpasta `data/` nova): array fixo de 10 entradas, uma por tipo de dragão do PHB 2014 (`black`, `blue`, `brass`, `bronze`, `copper`, `gold`, `green`, `red`, `silver`, `white` — chaves em EN, mesmo padrão de `config.races`/`config.classes`, rótulo resolvido no locale de quem lê). Cada entrada: `{ key, damageType, breathShape, saveAttribute }` — sem `label` embutido (rótulo de dragão e de tipo de dano viram chave de tradução da UI, como `setup.race.*` já são, não overlay de SRD).
- **`Character.draconicAncestry String?`** (novo, `schema.prisma`) — nullable, chave de `DRACONIC_ANCESTRY_TABLE`. Precedente direto: `subclass String?` (US-205) — campo opcional, presente só quando a escolha existe, sem coluna condicional por raça. Migração Prisma nova.
- **`CreateCharacterSchema`**: `draconicAncestry: z.string().max(40).optional()` — mesmo padrão de `subclass` em `character.schema.ts:29`.
- **`character.service.ts`**: quando `race === 'dragonborn'`, `dto.draconicAncestry` é obrigatório e validado contra `DRACONIC_ANCESTRY_TABLE` (mesmo `validateCatalogKey`/`BadRequestException` com valor ofensor de `race`/`class`/`subclass`); para qualquer outra raça, campo é ignorado (fica `undefined` na criação) — sem validação, sem erro. Escolha inválida ou ausente em raça `dragonborn` bloqueia a criação (mesmo comportamento de `race`/`class` hoje, não o de `subclass` opcional).
- **`SetupWizard.tsx`**: novo `CatalogCardGroup` condicional, só quando `charData.race === 'dragonborn'` — logo abaixo da grade de raiz, ANTES do painel `raceStepFeatures` (correção de 03/09/2026; mesma posição da grade de variante de subespécie, US-142). 10 cards (um por tipo de dragão, os 5 que o protótipo não tem incluídos), `label` = nome do ancestral, `bonus` = tipo de dano de resistência (ex. "Resistência a Fogo"), `blurb` = forma da arma de sopro (ex. "Sopro em cone de fogo intenso.") — mesmos 3 campos que `CatalogCardEntry` já aceita, sem mudança no componente. `canAdvance('race')` passa a exigir `draconicAncestry` preenchido quando `charData.race === 'dragonborn'`, mesmo espírito da checagem de `subclass` em `canAdvance('class')`.
- **Painel de traços raciais do wizard** (`raceStepFeatures`, `SetupWizard.tsx:774-787`): as entradas `draconic-ancestry-table` (a tabela crua em markdown) e `draconic-ancestry` ("Escolha um tipo de dragão da tabela…") deixam de aparecer nesse painel quando a raça é `dragonborn` — as duas ficam redundantes com a grade de escolha nova (a tabela vira os cards; o texto "escolha um tipo" vira a própria ação de escolher). `breath-weapon` e `damage-resistance` continuam aparecendo normalmente — são regra mecânica (fórmula de dano/CD, existência da resistência), não explicadas em nenhum outro lugar da tela.
- **Ficha do personagem** (revisão/detalhe — mesmo lugar que já resolve `race`/`class`/`subclass` para rótulo): exibe o tipo de dragão escolhido (rótulo) e o tipo de dano resolvido, não só a chave crua.
- **Tradução do rótulo da raça**: `"dragonborn": { "name": "Dragonborn", … }` em [`scripts/srd/locale/pt-BR.json:34`](../../../scripts/srd/locale/pt-BR.json:34) fica em inglês, sem curadoria — as outras 8 raízes já têm `name` em pt-BR (Elfo, Anão, Meio-Elfo…), só esta ficou esquecida. Vira `"Draconato"` (mesmo termo do protótipo de referência, §Referência visual) — `pnpm srd:sync && pnpm srd:ingest` (ou o script de ingest equivalente) recompila `config.races[].label` no artefato `pt-BR` a partir do overlay, sem precisar editar `srd-5e.config.pt-BR.json` a mão.
- **Teste**: `character.service.test.ts` — `dragonborn` sem `draconicAncestry` bloqueia criação; chave inválida bloqueia com o valor ofensor na mensagem; chave válida persiste e aparece em `features`/campo próprio; raça não-`dragonborn` com `draconicAncestry` mandado por engano não quebra (campo ignorado). `SetupWizard.test.tsx` — grade de 10 cards só aparece pra `dragonborn`, bloqueia avanço sem escolha.

### Fora do escopo

- **Motor de combate que aplica a resistência de fato** (reduzir dano recebido pela metade num teste de dano real, aplicar a arma de sopro como ação). Fase 1 não tem combate por turno mecanizado ([combate-por-turno seguem no roadmap](../01-requisitos/backlog-combate-por-turno.md)) — esta story só grava e exibe o dado resolvido, mesmo corte que `classFeatures`/`raceFeatures` já fazem (US-142 §Fora do escopo: "nome + descrição vão para o prompt do mestre oferecer narrativamente, não há motor de regra automatizado").
- **Enum genérico de tipo de dano reutilizável por outras stories** (magias, armas). `DRACONIC_ANCESTRY_TABLE.damageType` nasce como string livre (`'fire' | 'acid' | ...`, as 5 que o PHB usa pra dragonborn) — não há hoje nenhum conceito de tipo de dano em `packages/shared` pra generalizar contra (verificado: nenhuma ocorrência de `damageType`/`DamageType` no pacote). Se uma story futura de magia precisar do mesmo conceito, ela decide se reusa ou refaz — não é escopo represado aqui, é observação.
- **Escolha dentro de traço de outras raças** (truque de mago do Alto-elfo, US-142 *Questão em aberto #3* já adiada) — não mexido; esta story é só a ancestralidade dracônica do `dragonborn`.
- **Migração de fichas existentes** — não se aplica: nenhuma ficha `dragonborn` existe hoje sem o campo (raça nova, sem ficha em produção que a use, mesmo corte de US-140/US-142).
- **Tradução dos nomes dos 10 dragões e dos tipos de dano para EN** — entram como chave de string de UI (`setup.race.*`), então **dentro** do escopo de tradução normal (arquivo `en-US.ts`/`pt-BR.ts`), não como overlay de SRD (`MT_DOMAINS`) — só registrando que não é a mesma mecânica de tradução que `raceFeatures` usa.

---

## Modelo de dados proposto

```ts
// packages/shared/src/draconic-ancestry.ts (novo arquivo, export flat em index.ts)
export type DraconicAncestryEntry = {
  key: string            // 'red' | 'blue' | 'black' | 'brass' | 'bronze' | 'copper' | 'gold' | 'green' | 'silver' | 'white'
  damageType: string      // 'fire' | 'lightning' | 'acid' | 'poison' | 'cold' — os 5 tipos do PHB 2014
  breathShape: 'line' | 'cone'
  saveAttribute: string   // chave de config.attributes, ex. 'dex' | 'con'
}

export const DRACONIC_ANCESTRY_TABLE: DraconicAncestryEntry[] = [
  { key: 'black',  damageType: 'acid',      breathShape: 'line', saveAttribute: 'dex' },
  { key: 'blue',   damageType: 'lightning', breathShape: 'line', saveAttribute: 'dex' },
  { key: 'brass',  damageType: 'fire',      breathShape: 'line', saveAttribute: 'dex' },
  { key: 'bronze', damageType: 'lightning', breathShape: 'line', saveAttribute: 'dex' },
  { key: 'copper', damageType: 'acid',      breathShape: 'line', saveAttribute: 'dex' },
  { key: 'gold',   damageType: 'fire',      breathShape: 'cone', saveAttribute: 'dex' },
  { key: 'green',  damageType: 'poison',    breathShape: 'cone', saveAttribute: 'con' },
  { key: 'red',    damageType: 'fire',      breathShape: 'cone', saveAttribute: 'dex' },
  { key: 'silver', damageType: 'cold',      breathShape: 'cone', saveAttribute: 'con' },
  { key: 'white',  damageType: 'cold',      breathShape: 'cone', saveAttribute: 'con' },
]
```

```prisma
// apps/api/prisma/schema.prisma — model Character
draconicAncestry String?  // US-211: chave de DRACONIC_ANCESTRY_TABLE, só relevante quando race === 'dragonborn'
```

| Campo | Antes | Depois |
|---|---|---|
| `Character.draconicAncestry` | não existe | novo, nullable — chave de `DRACONIC_ANCESTRY_TABLE`, obrigatório quando `race === 'dragonborn'` |
| `raceFeatures['dragonborn']` | 4 entradas de prosa, sem escolha | inalterado (US-142, não retocado por esta story) — a UI é que filtra a exibição da tabela crua |

**Persistência:** coluna nova em `Character`, sem tocar `raceFeatures`/`config` (a tabela é código, não dado de sistema — `System.config` continua sem saber de ancestralidade dracônica).

---

## Onde aparece na criação de personagem

Na etapa `race` do wizard, escolher `dragonborn` no `CatalogCardGroup` de raiz revela uma nova grade `CatalogCardGroup` de 10 cards logo abaixo dela — **correção de 03/09/2026**: ANTES do painel de traços raciais (`raceStepFeatures`), na mesma posição da grade de variante de subespécie (US-142), não mais abaixo dos traços:

```
Escolha uma variante                      ← mesmo heading já usado pra subespécie
[Ancestral Negro]    [Ancestral Azul]
Resistência a ácido  Resistência a raio
Sopro em linha…      Sopro em linha…

[Ancestral Latão]    [Ancestral Bronze]
…                     … (+ Cobre, Ouro, Verde, Vermelho, Prata, Branco)
```

Cada card mostra o tipo de dano (`bonus`, ex. "Resistência a Fogo") e a forma do sopro (`blurb`, ex. "Sopro em cone de fogo intenso.") — os mesmos dados que hoje só existem dentro do parágrafo de `draconic-ancestry-table`. A etapa não avança (`canAdvance('race')` volta `false`) enquanto `dragonborn` estiver selecionado sem um card de ancestralidade escolhido.

---

## Critérios de aceite

- [x] `DRACONIC_ANCESTRY_TABLE` existe em `packages/shared`, com as 10 entradas do PHB 2014, e é exportada do pacote.
- [x] `Character.draconicAncestry` existe no schema Prisma (nullable) e em `CreateCharacterSchema` (opcional).
- [x] Criar personagem com `race: 'dragonborn'` sem `draconicAncestry` é rejeitado (`BadRequestException`, valor ofensor + formato esperado na mensagem).
- [x] Criar personagem com `race: 'dragonborn'` e `draconicAncestry` inválido (fora das 10 chaves) é rejeitado, mesmo formato de erro.
- [x] Criar personagem com `race: 'dragonborn'` e `draconicAncestry` válido persiste a chave e a ficha resultante expõe o tipo de dano/forma de sopro resolvidos (não só a chave crua).
- [x] Criar personagem com qualquer outra raça ignora `draconicAncestry` se vier no DTO — sem erro, sem persistir valor incoerente.
- [x] `select`/grade `char-race` no wizard: escolher `dragonborn` revela a grade de 10 cards de ancestralidade; escolher outra raça não mostra a grade (nem deixa resíduo de uma escolha anterior).
- [x] Avançar da etapa `race` fica bloqueado enquanto `dragonborn` estiver selecionado sem ancestralidade escolhida.
- [x] Painel de traços raciais do wizard não mostra mais `draconic-ancestry-table` (a tabela crua) nem `draconic-ancestry` (o texto "escolha um tipo de dragão…") quando a raça é `dragonborn` — `breath-weapon` e `damage-resistance` continuam visíveis.
- [x] Ficha (tela de revisão/detalhe) mostra o tipo de dragão e o tipo de dano de resistência com rótulo, não a chave (`red`) crua.
- [x] `config.races` no artefato `pt-BR` mostra `"Draconato"` como label da raça `dragonborn` (wizard e ficha), não mais `"Dragonborn"` em inglês.
- [x] **Eval / teste de regressão:** `character.service.test.ts` cobre os 4 casos de validação acima; `SetupWizard.test.tsx` cobre a grade condicional e o bloqueio de avanço.

---

## Notas de implementação

- **Não mexa em `raceFeatures['dragonborn']` (US-142).** As 4 entradas de traço continuam existindo exatamente como estão — esta story consome o que já existe (pra decidir quando mostrar a grade nova e quando esconder a tabela crua), não reingere nem edita o SRD. `buildRaceFeatures`/`sync.mjs`/`ingest.mjs` ficam intocados.
- **`DRACONIC_ANCESTRY_TABLE` é regra de código, não config de sistema.** Ao contrário de `races`/`classFeatures`/`raceFeatures`, não vem de `System.config` nem varia por `systemId` — é fixo pro SRD 5e (mesmo raciocínio da fórmula de CD do sopro, já hardcoded em texto). Se o projeto um dia suportar sistema diferente de D&D 5e com dragonborn próprio, esta tabela precisaria virar dado de sistema — fora de escopo hoje (Fase 1 é só SRD D&D 5e).
- **Chaves de dragão em EN, rótulo por tradução de UI** — mesmo padrão de `race`/`class`/`subclass` (chave interna em inglês, label resolvido no locale de quem lê), mas a tradução aqui é `apps/web/src/messages/{en-US,pt-BR}.ts` (strings de UI), não overlay de SRD (`MT_DOMAINS`/`raceFeatures`) — a tabela não é conteúdo do dataset.
- **`saveAttribute` já existe como conceito** — `config.attributes[].key` (US-209 usa o mesmo formato pra `savingThrows`) — reusar a mesma chave (`'dex'`/`'con'`), não inventar formato próprio.
- **Verifique o nome do campo Prisma escolhido não colide com nada existente** antes de rodar a migração — `grep -rn "draconicAncestry"` deve retornar zero antes desta story.

---

## Questões em aberto

1. ~~**Onde exatamente a grade de 10 cards entra no layout da etapa `race`.**~~ — **Resolvida em 2026-09-03**, pelo protótipo de referência: logo abaixo do painel de traços raciais (`raceStepFeatures`), como grade "Escolha uma variante" (§Referência visual).
2. ~~**`damageType`/`breathShape` como string livre vs. union type estrito.**~~ — **Resolvida na implementação**: os dois viraram union estrito (`DraconicDamageType`/`DraconicBreathShape`, `packages/shared/src/draconic-ancestry.ts`) — o web usa `Record<DraconicDamageType, MessageKey>` para o rótulo de tipo de dano, e a exaustividade do union pega em tempo de compilação se uma das 5 chaves ficar sem tradução.

---

## Referências no código

- [scripts/srd/srd-5e.config.pt-BR.json:3571-3632](../../../scripts/srd/srd-5e.config.pt-BR.json:3571) — `raceFeatures['dragonborn']`, as 4 entradas de traço-prosa que motivam esta story.
- [scripts/srd/_data/SpeciesTrait.2014.json:452-461](../../../scripts/srd/_data/SpeciesTrait.2014.json:452) — `srd_dragonborn_draconic-ancestry-table`, `"type": null`, confirma que a tabela não existe estruturada na fonte.
- [apps/web/src/components/setup/SetupWizard.tsx:753-789](../../../apps/web/src/components/setup/SetupWizard.tsx:753) — etapa `race`, onde a grade nova entra (`raceVariants`/`raceStepFeatures` como precedente de layout condicional).
- [apps/web/src/components/setup/CatalogCardGroup.tsx](../../../apps/web/src/components/setup/CatalogCardGroup.tsx) — componente de grade de card reusado, sem mudança nele.
- [apps/api/src/character/character.schema.ts:26-29](../../../apps/api/src/character/character.schema.ts:26) — `subclass`, precedente direto de campo opcional condicionado por outra chave.
- [apps/api/src/character/character.service.ts:39-50](../../../apps/api/src/character/character.service.ts:39) — validação de `subclass`, mesmo padrão a espelhar para `draconicAncestry`.
- [apps/api/prisma/schema.prisma:24-51](../../../apps/api/prisma/schema.prisma:24) — `model Character`, onde `draconicAncestry String?` entra ao lado de `subclass String?`.
- [US-209](./US-209-hit-dice-e-salvaguardas-de-classe-no-config.md) — contraste direto: dado que JÁ existe estruturado na fonte (`hit_dice`/`saving_throws`), ao contrário da tabela de ancestralidade.
- [US-142 §Fora do escopo](./US-142-tracos-mecanicos-subespecie-srd-5-1.md) — nomeou "resistência mecânica" como fora de escopo dela, story própria — esta é ela.
