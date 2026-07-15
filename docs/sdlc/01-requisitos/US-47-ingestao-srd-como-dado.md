# US-47 — Ingestão do SRD 5e (2024) como dado do sistema

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** 🚧 Em progresso
**Depende de:** [US-21](./US-21-sistemas-como-dado.md) (`System.config` + Zod em `packages/shared`) · [US-27](./US-27-pericias-do-personagem.md) (perícias no config) · [US-41](./US-41-features-traits-de-classe.md) (features de classe no config) · [US-42](./US-42-magias-conhecidas.md) (magias no config)
**Relacionado:** [US-48](./US-48-getrule-corpus-de-regras.md) (o mesmo dataset alimenta o corpus do `getRule`) · [US-51](./US-51-kits-iniciais-do-srd.md) (kits iniciais — extraídos para fonte/licença próprias) · [US-52](./US-52-traducao-automatica-do-srd.md) (tradução automática do conteúdo novo — extraída desta story) · [ADR 003](../../adr/003-sistemas-como-dado.md) (o `config` como dado — **destino**; segue valendo inteiro) · [ADR 005](../../adr/005-locale-como-dimensao.md) (locale como dimensão — o overlay pt-BR é **um locale**, não "o idioma")
**Gera ADR:** **ADR 004** — origem do dado de sistema (a criar; ver [Decisão de arquitetura](#decisão-de-arquitetura-criar-o-adr-004-não-emendar-o-003))
**Criada em:** 2026-07-11
**Revisada em:** 2026-07-14 — fonte fixada em **Open5e** (SRD 5.2, **CC-BY-4.0**); `startingKits` extraído para a [US-51](./US-51-kits-iniciais-do-srd.md) (ver Histórico de revisão)

---

## História

> **Como** desenvolvedora,
> **quero** popular o `config` do sistema D&D 5e a partir de um **dataset SRD estruturado**, por um script re-executável,
> **para que** perícias, features de classe e magias venham prontas de uma fonte versionada — sem digitar conteúdo à mão nem re-fazer o trabalho a cada revisão do SRD.

---

## Contexto e motivação

### O problema observado

A estrutura de "sistema como dado" já existe ([US-21](./US-21-sistemas-como-dado.md)): `System.config` guarda `attributes`, `skills`, `classFeatures`, `classSpells`, `startingKits`. Mas **os dados de D&D estão sendo semeados à mão** no [seed.ts](../../../apps/api/prisma/seed.ts) — as features de nível 1 da [US-41](./US-41-features-traits-de-classe.md) e as magias da [US-42](./US-42-magias-conhecidas.md) foram transcritas manualmente, classe por classe. Isso não escala: cada feature ou magia nova é digitação, e uma revisão do SRD é retrabalho.

O custo real não é o volume de texto — é a **ligação**. Saber que `Marca do Caçador` é uma magia de nível 1 do Patrulheiro, que `Arcane Recovery` é feature de nível 1 do Mago, que Acrobacia ancora em Destreza: isso é conhecimento de regra que hoje é digitado à mão e conferido de cabeça.

### Por que a solução atual não basta

O `config` é o destino certo (o código já o consome sem mudança — ADR 003), mas **a origem é manual**. Falta uma **fonte estruturada** e um **adaptador** que a mapeie para o `SystemConfigSchema` existente.

### A fonte: Open5e (SRD 5.2, CC-BY-4.0)

Duas fontes foram avaliadas ao vivo (jul/2026 — ver [Anexo: comparação de fontes](#anexo--comparação-de-fontes)). **Open5e é a escolhida**, por dois motivos decisivos:

1. **Tem as magias 2024 nativas** — 339 magias do SRD 5.2 com ligação `classes[]`. O `5e-bits/5e-database` **não tem** spells na pasta 2024 (só em `2014/`, SRD 5.1), o que obrigaria a misturar edições.
2. **É CC-BY-4.0** — a mesma licença do SRD 5.2 publicado pela WotC. Atribuição simples, uma linha num arquivo de aviso, **sem OGL 1.0a nem Section 15**. O `5e-database` é OGL 1.0a (copyleft), que contamina o repo inteiro.

> **Todo o dado desta story é CC-BY-4.0.** Nenhum material OGL entra no `config` pela US-47. (O equipamento inicial, que só o `5e-database`/OGL expõe estruturado, foi extraído para a [US-51](./US-51-kits-iniciais-do-srd.md) justamente para não arrastar essa licença para cá.)

### Idioma: nenhuma fonte resolve o português

O `config` inteiro é PT: `label: 'Força'`, `'Atletismo'`, `'Sentido Divino'`, chaves de classe `mago`/`paladino`. O Open5e é inglês puro; o `5e-database` só traduz três arquivos no 2024. **Um ingest ingênuo regrediria a ficha e o prompt do mestre para inglês.**

A saída separa o que o dataset sabe do que só nós sabemos:

- **O dataset dá a estrutura e a ligação** — quais features são de nível 1, quais magias pertencem a qual classe, qual atributo ancora qual perícia, o texto EN de record. É o trabalho caro, volumoso e sujeito a erro humano.
- **O pt-BR é um overlay versionado no repo** — um mapa `chave → texto PT`, mantido por nós, aplicado por cima do dataset no fim do `ingest`.

O overlay **não é trabalho novo**: os nomes PT já estão escritos e revisados no `seed.ts` de hoje (`'Sentido Divino'`, `'Curar Ferimentos'`, `'Atletismo'`). A US-47 os extrai do `seed.ts` para um arquivo de locale e os reaproveita — o que era tabela hardcoded vira tradução reutilizável.

> **Nasce locale-aware ([ADR 005](../../adr/005-locale-como-dimensao.md)).** O EN é a **base nativa** (o dataset cru); o pt-BR é a **localização de _um_ locale** sobre essa base — não "o idioma único". Portanto o overlay é **`locale/pt-BR.json`** (um por idioma não-nativo; `en` **não tem arquivo** — usa o dataset direto), e a regra de merge ganha o caso `locale = en → dataset cru, sem overlay`. Isso custa uma linha de design agora e evita um teardown quando o EN entrar (Fase 1, ADR 005). Esta story entrega o locale **pt-BR**; o `en` cai fora de graça por ser a base.

### A proposta

Pipeline em dois passos, zero código de app novo:

1. **`sync`** — baixa o dataset **pinado numa tag** (reprodutível), nunca em `main`.
2. **`ingest`** — mapeia o dataset → `SystemConfig`, aplica o overlay pt-BR, valida com `SystemConfigSchema.parse()` e grava o artefato. O `seed.ts` consome o artefato.

### O ingest é só do D&D. O Free não muda.

**O artefato do ingest popula exclusivamente o `System` `system-dnd5e`.** O sistema **`system-free` fica congelado nas regras de hoje** — mesmos atributos, perícias, features, magias e ganchos. Nenhum dado do SRD entra nele.

Motivo: o Free existe justamente para narrar **sem** seguir sistema oficial. Puxar o SRD para dentro dele seria trocar a natureza do sistema por efeito colateral de um pipeline de ingestão. Cada `System` é dado independente — é essa a promessa do [ADR 003](../../adr/003-sistemas-como-dado.md).

#### ⚠️ Armadilha: hoje o Free **compartilha as constantes** do D&D

No [seed.ts](../../../apps/api/prisma/seed.ts) atual, `freeConfig` **não copia** os dados do D&D — ele **referencia os mesmos objetos**:

```ts
const freeConfig: SystemConfig = {
  attributes: dnd5eAttributes,      // ← mesma referência
  skills: dnd5eSkills,              // ← mesma referência
  classFeatures: dnd5eClassFeatures,// ← mesma referência
  classSpells: dnd5eClassSpells,    // ← mesma referência
  …
}
```

Isso é invisível hoje (os dois sistemas *devem* ter o mesmo conteúdo), mas vira bug no dia do ingest: **trocar as constantes pelo artefato faria o Free herdar o SRD sem ninguém pedir** — features do SRD, magias do SRD — e nenhum teste pegaria, porque os testes usam fixtures próprias.

**O que a implementação precisa fazer:**

1. **Desacoplar o `freeConfig`** dos campos que o ingest substitui (`attributes`, `skills`, `classFeatures`, `classSpells`) — ele passa a ter **tabelas literais próprias**, com o conteúdo de hoje copiado *verbatim* (snapshot congelado). Deixa de referenciar essas constantes `dnd5e*`.
2. **O `seed.ts` importa o artefato só para o `system-dnd5e`** — o upsert do `system-free` continua lendo as literais do próprio arquivo, sem tocar no artefato.
3. Os dois sistemas passam a divergir de propósito: o D&D segue o SRD e evolui a cada bump de dataset; o Free é flavor autoral e só muda se alguém decidir mudá-lo.

> Bônus: a partir daqui, o Free vira o **guarda-costas do desacoplamento**. Se um dia um dado do SRD aparecer num personagem do Free, o pipeline vazou.

Além disso: o `System.version` do D&D hoje é `'5.1'` — com o SRD 5.2 ingerido, passa a **`'5.2'`**. O Free mantém `'1.0'`.

---

## Escopo

### Dentro do escopo

- **`scripts/srd/sync.ts`** — baixa `open5e/open5e-api` @ **`v2.1.0`** (`data/v2/wizards-of-the-coast/srd-2024/`), pinado em tag (registrada no repo; `main` nunca).
- **`scripts/srd/ingest.ts`** — mapeia o dataset → `SystemConfig`, aplica o overlay pt-BR, valida com `SystemConfigSchema.parse()`, grava `scripts/srd/srd-5e.config.json` (artefato versionado).
- **`scripts/srd/locale/pt-BR.json`** — overlay de tradução curado, semeado a partir do `seed.ts` atual (religado por chave). Preencher lacunas de conteúdo **novo** por tradução automática é a [US-52](./US-52-traducao-automatica-do-srd.md); aqui o overlay é manual.
- **Campos derivados (todos do Open5e):** `attributes` (6), `skills` (18, com âncora), `classFeatures` (nível 1), `classSpells` (níveis 0 e 1).
- **Alvo único: `system-dnd5e`.** O `system-free` fica congelado — exige desacoplar o `freeConfig` das constantes `dnd5e*` que o ingest substitui (ver [armadilha](#️-armadilha-hoje-o-free-compartilha-as-constantes-do-dd)).
- **Idempotência:** re-rodar o `ingest` produz byte-a-byte o mesmo artefato (chaves ordenadas na serialização).
- **Falha cedo:** `SystemConfigSchema.parse()` no fim do mapeamento. Dataset com forma inesperada quebra o ingest com erro claro, sem gravar config inválido.
- **Licença:** arquivo de atribuição **CC-BY-4.0** (WotC / SRD 5.2, via Open5e) versionado ao lado do artefato derivado. Licença única.

### Fora do escopo

- **`startingKits` — extraído para a [US-51](./US-51-kits-iniciais-do-srd.md).** O equipamento inicial não vem do Open5e (não expõe kit) e a única fonte estruturada é o `5e-database`, sob **OGL 1.0a** — outra licença, com obrigações próprias (Section 15). Misturar isso aqui contaminaria a US-47, que é CC-BY puro. Até a US-51 shippar, **os kits continuam manuais no `seed.ts`, como hoje** — a US-47 não os toca.
- **`pointBuy`, `min`/`max`/`default` de atributo** — decisão de produto (faixa 10–18, orçamento 27), não dado do SRD. Continuam no `seed.ts`.

> **A fronteira do ingest é "o que é regra do SRD e está numa fonte CC".** Feature e magia de nível 1: sim. Orçamento de point-buy e faixa de atributo: decisão nossa. Kit inicial: é regra, mas a fonte é OGL — por isso vai para uma story própria, não some do produto.

- **Features de nível > 1, subclasses, progressão** — Fase 1 é nível 1 (mesma fronteira da [US-41](./US-41-features-traits-de-classe.md)). O `gained_at[].level` do dataset deixa a extensão barata depois, mas não agora.
  - **Subclasses: o Open5e tem as 12** (uma por classe: Champion, Evoker, Thief…), ligadas por `subclass_of` e com features em `gained_at`. **Mas toda feature de subclasse começa no nível 3** — verificado nas 12, sem exceção (em 5e 2024 a subclasse é escolhida no nível 3). O filtro de nível 1 do ingest devolveria **lista vazia** para todas. No nível 1 a subclasse não existe.
  - ⚠️ **Quando a progressão chegar, um limite de licença aparece — e não tem fonte que resolva.** O PHB 2024 dá **4 subclasses por classe**; o **SRD 5.2 libera só 1**. Battle Master, Eldritch Knight, Psi Warrior e companhia **não foram licenciados** — não estão em fonte aberta nenhuma. Caminhos: só o SRD (1 por classe, sem escolha real) · SRD + terceiros (o Open5e tem 125 subclasses, mas 76 são Kobold Press / *Tome of Heroes* — não é D&D, licença própria) · autoral. Decisão para a fase da progressão.
- **Magias de nível > 1** — a [US-42](./US-42-magias-conhecidas.md) é awareness de nível 1 (truques + magias de 1º). Sem motor de spellcasting, magia de 3º nível não tem consumidor.
- **Corpus textual do `getRule`** ([US-48](./US-48-getrule-corpus-de-regras.md)) — o mesmo `sync` serve o corpus, mas o destino é outro (não o `config`, que é carregado a cada criação de personagem). Condições, ações e descrições longas vão para lá.
- **Upload de sistema pela UI** (Fase 3) — este pipeline é o sistema SRD embutido; `sourceType: UPLOAD` é outro caminho.
- **Monstros, itens mágicos, feats, espécies** — sem consumidor. YAGNI.

---

## Modelo de dados proposto

Sem schema novo. O pipeline escreve no `System.config` já definido (`SystemConfigSchema` em [system.ts](../../../packages/shared/src/types/system.ts)).

```
open5e/open5e-api @ v2.1.0            (CC-BY-4.0)
  data/v2/wizards-of-the-coast/srd-2024/
    ├─ AbilityDescription.json  → config.attributes[]   { key, label }  + min/max/default do seed
    ├─ (skills, doc `core`)     → config.skills[]       { key, label, ability }
    ├─ CharacterClass.json      → config.classFeatures{} (features[] com gained_at.level === 1)
    │  + ClassFeature.json         { name, description }
    └─ Spell.json               → config.classSpells{}  (classes[].key + level <= 1)
                                                        { name, level, description }
         │
         ▼
  locale/pt-BR.json  (overlay: labels, nomes e descrições PT)
         │
         ▼
  SystemConfigSchema.parse()  →  srd-5e.config.json  →  seed.ts  →  System(system-dnd5e).config

  ( config.startingKits → NÃO é tocado pela US-47; permanece manual no seed
    até a US-51, que o deriva do 5e-database/OGL )
```

**Persistência:** `System.config` (Prisma, `Json`), como hoje. O que muda é a **origem** dos campos derivados. O `seed.ts` deixa de carregar as tabelas hardcoded de perícias/features/magias e passa a importar o artefato.

### Normalização de chaves

Dois mapas pequenos, explícitos, no mapper:

| De (Open5e) | Para (`config`) | Nota |
|---|---|---|
| `srd-2024_wizard` | `mago` | **Mapa explícito de 12 classes.** *Não* reusa o `CLASS_SYNONYMS` de [starting-inventory.ts](../../../apps/api/src/character/starting-inventory.ts): aquele casa **entrada do usuário em PT** contra a chave canônica (`normalize()` só tira acento/caixa) — nunca transformaria `Wizard` em `mago`. São dois problemas diferentes; o mapa do dataset é novo. |
| `dex` → `dexterity` · `sleight-of-hand` → `sleight_of_hand` | — | Atributo abreviado e perícia com hífen → underscore. As outras 17 chaves de perícia já batem. |

As chaves canônicas de classe do `config` (`mago`, `paladino`, `patrulheiro`, `bruxo`…) **não mudam** — o mapa converte o dataset para elas, e o `CLASS_SYNONYMS` continua fazendo o seu trabalho (entrada do usuário) sem alteração.

> ⚠️ O arquivo de perícias do Open5e traz 20 registros: as 18 do 5e mais `a5e-ag_culture` e `a5e-ag_engineering` (Advanced 5e, outro sistema). O filtro por documento **não** as remove — o mapper precisa descartar chaves prefixadas por `a5e-ag_` explicitamente. As 18 restantes são as certas.

### Overlay pt-BR

Um JSON por domínio de chave, semeado com o conteúdo PT que já existe no `seed.ts`. **Chaves canônicas nossas** (não as do Open5e — ver [Questões em aberto](#questões-em-aberto), resolvida): o mapper converte `srd-2024_paladin_lay-on-hands → paladino_lay-on-hands` antes do merge, e o overlay é escrito contra a forma canônica.

```jsonc
{
  "attributes": { "strength": "Força", "dexterity": "Destreza", … },
  "skills":     { "athletics": "Atletismo", "sleight_of_hand": "Prestidigitação", … },
  "features":   { "paladino_lay-on-hands": { "name": "Impor as Mãos", "description": "…" }, … },
  "spells":     { "cure-wounds": { "name": "Curar Ferimentos", "description": "…" }, … }
}
```

(O mapa `classes` some do overlay — a conversão `srd-2024_wizard → mago` é do mapper, não tradução de texto. As chaves de feature já embutem a classe canônica.)

**Regra de merge (por locale, [ADR 005](../../adr/005-locale-como-dimensao.md)):**
- **`locale = en`** → o **dataset cru**. Sem overlay, sem tradução. É a base nativa.
- **`locale = pt-BR`** → por campo: PT quando existe no overlay e não é vazio; senão, **fallback para o texto EN do dataset** — nunca chave crua nem string vazia. O `ingest` relata as chaves que caíram no EN, e `--strict` **falha o build** se houver qualquer uma.

Esta story implementa o locale **pt-BR** (o overlay); o **`en` é a base e sai sem esforço**. Novos locales seguem o mesmo molde: `locale/{xx}.json` + o pipeline da [US-52](./US-52-traducao-automatica-do-srd.md).

**O overlay curado semeia a camada.** O conteúdo de hoje já é ~73 traduções revisadas no [seed.ts](../../../apps/api/prisma/seed.ts): 6 atributos, 18 perícias, 15 features de nível 1 (9 classes; Clérigo/Feiticeiro/Bruxo caem em `default: []`), 34 truques + 4 magias de nível 1 (Paladino/Patrulheiro). **No primeiro `ingest`, toda chave do SRD 5.2 que o MVP consome já tem PT curado** — nada cai no fallback, e a US-47 não depende de tradução automática nenhuma para shipar.

⚠️ **Semear não é copiar — é religar por chave, e há órfãos.** O texto está pronto, mas hoje está indexado por *nome PT* numa lista, não por chave do dataset. Cada entrada é religada à chave do Open5e (`srd-2024_wizard_arcane-recovery`) — casamento manual, uma vez. A lista de truques do seed veio da *wiki 2024*, e ~12 estão marcados `†` como "a verificar" (Estrondo, Elementalismo…): material que **pode não estar no SRD 5.2**, deixando a tradução curada **órfã** (sem chave para casar). O `ingest` **relata órfãs**, não as descarta em silêncio.

### Conteúdo novo (num bump futuro) → tradução automática é a [US-52](./US-52-traducao-automatica-do-srd.md)

O fallback EN acima é rede de segurança, não plano. Ele só é acionado quando um **bump futuro** do dataset traz uma chave que o overlay curado ainda não cobre — o que **não acontece no primeiro ingest** (tudo já traduzido). Encher essa lacuna automaticamente (traduzir por `gemini-3.1-flash-lite` no `ingest`, gravar rascunho `_mt` revisável, validar contra glossário) é um mecanismo próprio, com payoff só no segundo bump e superfície de decisão própria (qual gate de revisão, como validar a tradução) — por isso foi extraído para a **[US-52](./US-52-traducao-automatica-do-srd.md)**.

Até a US-52, a lacuna de um bump é preenchida à mão (adicionar a chave ao overlay) ou barrada pelo `--strict`. A US-47 fecha sem LLM.

---

## Critérios de aceite

- [ ] `scripts/srd/sync.ts` baixa `open5e/open5e-api` **pinado na tag `v2.1.0`** (versão registrada no repo; `main` não é usado).
- [ ] `scripts/srd/ingest.ts` mapeia o SRD 2024 → `SystemConfig`, aplica o overlay pt-BR e grava `srd-5e.config.json`.
- [ ] O config gerado passa em `SystemConfigSchema.parse()`; um dataset de forma inesperada faz o ingest **falhar com erro claro**, sem gravar artefato inválido.
- [ ] Rodar o `ingest` duas vezes produz artefato **byte-a-byte idêntico** (idempotente).
- [ ] **Sem regressão de idioma:** os 6 atributos, as 18 perícias, as features de nível 1 e as magias de nível 0–1 saem **em português** no artefato — iguais aos do `seed.ts` de hoje (via overlay curado). No primeiro `ingest`, **nada cai no fallback EN**.
- [ ] **Overlay + fallback + `--strict`:** PT do overlay quando existe; senão, EN do dataset (nunca vazio, nunca chave crua); `--strict` **falha o build** se sobrar qualquer chave só-EN. A tradução automática dessas lacunas é a [US-52](./US-52-traducao-automatica-do-srd.md) — a US-47 não depende dela.
- [ ] **Traduções órfãs são relatadas:** ao semear o overlay do `seed.ts`, uma tradução PT sem chave correspondente no dataset (ex.: truque da wiki 2024 que não está no SRD 5.2 — os `†` do seed) entra num relatório de órfãos, **não é descartada em silêncio**. Decide-se caso a caso se a chave sumiu, mudou de nome, ou o item não é SRD.
- [ ] **`--strict` barra EN em produção:** com a flag, qualquer chave que caísse no fallback EN **falha o build**; sem ela, cai no `desc` EN (nunca vazio, nunca a chave crua) e entra no relatório. O fallback EN é rede de segurança, não caminho normal.
- [ ] **Sem regressão de conteúdo:** o `seed.ts` passa a consumir o artefato e o comportamento observável não muda — paladino continua com Sentido Divino + Impor as Mãos ([US-41](./US-41-features-traits-de-classe.md)); patrulheiro continua com Marca do Caçador ([US-42](./US-42-magias-conhecidas.md)); as 18 perícias seguem no config ([US-27](./US-27-pericias-do-personagem.md)).
- [ ] **`startingKits` intocado pela US-47** — continua exatamente como hoje no `seed.ts` (kits autorais manuais). Sua derivação é a [US-51](./US-51-kits-iniciais-do-srd.md); nenhum personagem muda de inventário por causa desta story.
- [ ] **O sistema Free não muda em nada.** O `config` do `system-free` **não contém nenhum dado derivado do SRD** — verificável comparando o `System.config` do Free antes e depois do ingest: **idêntico**.
- [ ] `freeConfig` **não referencia mais** as constantes `dnd5e*` que o ingest substitui (`attributes`, `skills`, `classFeatures`, `classSpells`) no [seed.ts](../../../apps/api/prisma/seed.ts) — passa a ter literais próprias. Os dois sistemas viram dados independentes de fato, não por coincidência.
- [ ] `System.version` do D&D passa a **`'5.2'`** (hoje `'5.1'`); o Free segue `'1.0'`.
- [ ] O mapa de classes cobre as 12 classes do SRD; classe do dataset sem entrada no mapa **falha o ingest** (não é silenciosamente descartada).
- [ ] O aviso de **licença CC-BY-4.0** (WotC / SRD 5.2, via Open5e) está versionado junto ao artefato derivado. **Licença única — nenhum material OGL.**
- [ ] **Eval / regressão:** os asserts existentes da [US-41](./US-41-features-traits-de-classe.md)/[US-42](./US-42-magias-conhecidas.md)/[US-27](./US-27-pericias-do-personagem.md) passam com o config derivado, sem alteração nos testes.
- [ ] **ADR 004 escrito ao final da implementação** (`docs/adr/004-origem-do-dado-de-sistema.md`) — registra o pipeline **como ficou**: fonte Open5e/CC-BY, artefato versionado, overlay pt-BR. O [ADR 003](../../adr/003-sistemas-como-dado.md) ganha só o ponteiro em `Relacionado`, sem ter D1/D2 alteradas. Ver [Decisão de arquitetura](#decisão-de-arquitetura-criar-o-adr-004-não-emendar-o-003).
  - **Não confundir com o arquivo de licença** (atribuição CC-BY-4.0): é obrigação de distribuição e entra **junto com o dado derivado**, no commit em que o artefato aparecer — não espera o ADR.

---

## Notas de implementação

- **Pin, não `main`:** tarball da tag `v2.1.0`. Reprodutibilidade > frescor. Bump de tag é um PR, com o diff do artefato mostrando exatamente o que mudou.
- **Artefato versionado:** `srd-5e.config.json` entra no repo. O `seed` não depende de rede, e o diff do artefato é a revisão de cada bump.
- **Ordem determinística:** serializar com chaves ordenadas, senão a idempotência quebra no diff e o critério de aceite vira ruído.
- **Filtro de nível 1 (features):** `features[].gained_at[].some(g => g.level === 1)`. Verificado no `srd-2024_wizard`: rende `Arcane Recovery`, `Ritual Adept`, `Spellcasting`.
- **Filtro de magias:** `Spell.json` → `classes[].key` dá a classe, `level <= 1` dá o corte (truques = `level: 0`). Bate exatamente com o formato do `SystemSpellSchema` (`{ name, level, description }`).
- **`seed.ts` — dois sistemas, dois destinos:**
  - **`system-dnd5e`** perde as constantes `dnd5eSkills`, `dnd5eClassFeatures`, `dnd5eClassSpells` (passam a vir do artefato) e **mantém** `dnd5eAttributes` (min/max/default — o overlay só traduz o label), `dnd5eProficiency`, `pointBuy`, `dnd5eKits` (a US-47 não toca em kit) e `dnd5eInitialAdventures`.
  - **`system-free`** ganha **cópias literais próprias** dos campos que o ingest substitui. Trabalho mecânico de uma vez: copiar as tabelas atuais para constantes `free*` **antes** de o artefato substituir as `dnd5e*`. Feito nessa ordem, o Free nunca chega a ver o dado novo.
- **Descrições:** o `desc` do Open5e é o texto de record do SRD, longo. O `SystemClassFeature.description` vai ao prompt do mestre a cada criação de personagem — as descrições de hoje são **resumos de uma linha**, escritas para caber no prompt. **O overlay é a fonte da descrição PT curta**; o `desc` EN longo é fallback de emergência, não o alvo. Não inflar o `config` com texto de record: isso é trabalho do corpus da [US-48](./US-48-getrule-corpus-de-regras.md).

---

## Decisão de arquitetura: **criar o ADR 004** (não emendar o 003)

Esta story precisa de registro em ADR, e a recomendação é **um ADR novo**.

**Por que não emendar o [ADR 003](../../adr/003-sistemas-como-dado.md):** ele decide **forma e destino** do dado — `System.config` como `Json` validado por Zod, consumido por endpoints genéricos ("integrar um sistema = inserir um `System` + config"). A US-47 **não revoga nada disso**; pelo contrário, ela só é barata *porque* o 003 valeu. O 003 está `Aceito` e implementado; reescrever ADR aceito apaga o registro histórico de por que se decidiu assim, que é a razão de o documento existir.

**Por que um ADR novo:** a US-47 decide **procedência**, uma camada acima — de onde o dado vem, pinado em quê, sob qual licença, com qual idioma. Tem alternativas próprias (Open5e × 5e-database × transcrição manual) e **consequências que o 003 nunca pesou**:

- **Obrigação de licença no repo** (atribuição CC-BY-4.0). Quem for auditar licença do projeto não pode depender de ler uma user story para saber a procedência do dado.
- **Fonte externa pinada** vira dependência de build (`sync` + `ingest`), com política de bump.
- **Idioma como camada de projeto** (overlay pt-BR), não como campo de dataset.

> O ADR 004 cobre **origem do dado** em geral. Quando a [US-51](./US-51-kits-iniciais-do-srd.md) (kits via `5e-database`/OGL) shippar, ela **acrescenta** ao ADR 004 a seção de segunda fonte e a licença dupla — ou, se a decisão de lá for grande o bastante, gera o ADR 005. Definir na US-51, não aqui.

### Quando: **depois da implementação**, não antes

O ADR 004 é escrito **ao final da US-47, com o pipeline já rodando** — não como pré-requisito. Motivo: metade do que este documento decidiu foi descoberta *cutucando o dataset*, não planejando (o `pt-BR` que não existe, o `desc` de classe vazio no Open5e, as perícias do A5e a descartar). ADR escrito antes registraria intenção; escrito depois, registra o que de fato se sustentou. O 003 seguiu esse mesmo padrão — o status dele é `Aceito (D1 e D2 implementadas)`.

⚠️ **O arquivo de licença NÃO espera pelo ADR.** A atribuição CC-BY-4.0 é obrigação de distribuição — vai no repo **junto com o primeiro commit que trouxer o dado derivado**, não no fim. O ADR documenta a decisão; o arquivo de licença *cumpre* a licença.

### O que o ADR 004 deve conter

- **Título sugerido:** `ADR 004 — Origem do dado de sistema: ingestão do SRD por pipeline pinado`
- **Contexto:** o `config` do 003 é o destino certo, mas a origem é digitação manual ([seed.ts](../../../apps/api/prisma/seed.ts)); não escala e não sobrevive a uma revisão do SRD.
- **Decisão:** `sync` + `ingest` sobre **Open5e** (SRD 5.2, **CC-BY-4.0**) pinado em tag, para atributos/perícias/features/magias. Artefato `srd-5e.config.json` versionado; `seed.ts` consome o artefato. pt-BR como **overlay curado do projeto** (nenhuma fonte traduz), semeado do `seed.ts`, com fallback EN + `--strict`. Só o `system-dnd5e`; o Free fica congelado. *(Tradução automática do conteúdo novo é a [US-52](./US-52-traducao-automatica-do-srd.md) — o ADR 004 pode registrá-la como evolução ou deixar para um ADR próprio, conforme o peso.)*
- **Alternativas rejeitadas:** `5e-database` como fonte (não tem magias 2024, obrigaria a misturar SRD 5.1, e é OGL 1.0a — contamina o repo) · manter digitação manual (o problema) · submodule em vez de artefato versionado (põe rede no caminho do `seed`).
- **Consequências:** atribuição CC-BY-4.0 no repo (licença única) · bump de dataset vira PR com diff de artefato · o overlay pt-BR é dívida viva (cada regra nova precisa de tradução — automatizada na [US-52](./US-52-traducao-automatica-do-srd.md), sinalizada pelo `--strict` até lá) · nenhuma marca da WotC é licenciada (não se pode chamar o produto de "D&D").
- **Ponteiro no ADR 003:** acrescentar uma linha em `Relacionado` — *"[ADR 004] — de onde vem o dado que popula este `config`"*. Sem alterar as decisões D1/D2.

---

## Questões em aberto

*Nenhuma em aberto.*

**Resolvida — 2026-07-15: overlay indexado por chave canônica nossa** (não pela chave do Open5e). A chave do overlay estranha o prefixo de edição da fonte: `srd-2024_paladin_lay-on-hands` vira `paladino_lay-on-hands` — classe pela chave canônica do `config` (`paladino`, o mesmo mapa de classes que o mapper já usa), acrescida do slug EN estável da feature/magia (sem o `srd-2024_`). O overlay deixa de carregar a marca da fonte; uma troca de dataset futura reescreve só o mapper, não o `pt-BR.json`. Custo aceito: o mapa `dataset → canônica` roda **no mapper** (converte o dado antes do merge), e o overlay é escrito já contra a chave canônica — não há dois mapas a sincronizar, há um mapa e um overlay que falam a mesma língua. (Rejeitada a chave do dataset: mais barata de escrever hoje, mas amarra cada entrada ao formato `srd-2024_*` da fonte.)

*(A tradução automática de conteúdo novo, e as questões de qual gate de revisão / como validar a tradução, saíram para a [US-52](./US-52-traducao-automatica-do-srd.md).)*

---

## Anexo — comparação de fontes

Verificado ao vivo em **2026-07-14** (GitHub API + `api.open5e.com`).

**`5e-bits/5e-srd-api` não é fonte de dado** — é o servidor que serve o `5e-bits/5e-database`. Mesmo dado; a escolha real era entre `5e-database` e Open5e.

**Open5e** (`open5e/open5e-api`, dados em `data/v2/`, tag `v2.1.0`) — **escolhida**:
- `srd-2024` (System Reference Document 5.2): **339 magias**, 24 classes+subclasses com features e `gained_at`, 9 espécies, 331 criaturas, 440 itens, 17 feats.
- Classes trazem `features[]`, `hit_dice`, `saving_throws`, `caster_type`. **Não trazem equipamento inicial** (por isso os kits são outra story/fonte — [US-51](./US-51-kits-iniciais-do-srd.md)).
- Magias trazem `classes[]`, `level`, `desc` — ligação magia→classe pronta.
- Perícias trazem `ability` (`"dex"`), 18 do 5e + 2 do Advanced 5e a descartar.
- Licença: **CC-BY-4.0** (a mesma do SRD 5.2 publicado pela WotC).

**`5e-bits/5e-database`** (release `v5.10.0`, 2026-07-05) — **rejeitada como fonte da US-47**:
- `src/2024/en` — 24 arquivos JSON. **Sem `Spells.json`.** Magias só em `src/2014/` (SRD 5.1) — obrigaria a misturar edições.
- `src/2024/pt-BR` — **3 arquivos** (`Ability-Scores`, `Alignments`, `Damage-Types`). Não resolve o idioma.
- **Tem** `starting_equipment_options` nas 12 classes — é a razão de a [US-51](./US-51-kits-iniciais-do-srd.md) usá-lo *só* para kits.
- Licença: **OGL 1.0a** — copyleft, exige texto integral + Section 15 no repo. É o custo que a US-47 evita ao não usá-lo.

---

## Histórico de revisão

**2026-07-14 (manhã) — fonte fixada em Open5e.** A versão original escolhia o `5e-bits/5e-database` com dois argumentos que a verificação derrubou:

- *"Inclui traduções pt-BR."* **Falso na prática:** o `2024/pt-BR` só traduz atributos, alinhamentos e tipos de dano — nada do que a story ingere. Corrigido: pt-BR vira **overlay versionado**, semeado do `seed.ts`.
- *"Não há spells em 2024 → usar o stopgap de `2014/` (SRD 5.1)."* **Desnecessário:** o Open5e tem 339 magias 2024 nativas. A "Ressalva de dados" foi removida — sem stopgap, e a [US-42](./US-42-magias-conhecidas.md)/[US-48](./US-48-getrule-corpus-de-regras.md) não herdam dívida de edição.

**2026-07-14 (tarde) — `startingKits` extraído para a [US-51](./US-51-kits-iniciais-do-srd.md).** Houve uma oscilação registrada: descobriu-se que o `5e-database` **tem** equipamento inicial (`starting_equipment_options`, 12/12 classes) e o Open5e não; por um momento a US-47 absorveu os kits como **segunda fonte**, aceitando trazer a **OGL 1.0a** de volta ao repo (licença dupla). **Decisão final: separar.** A US-47 fica **CC-BY puro** (só Open5e); os kits — que exigem a fonte OGL — viram a **US-51**, com a decisão de licença isolada onde ela pode ser pesada por conta própria. Consequências da separação:

- A US-47 não muda mais os kits: **nenhum personagem troca de inventário** por causa dela. A troca dos kits autorais (incl. a fictícia "Poção de mana") pelos do SRD passa a ser decisão da US-51.
- O repo continua com **uma licença** (CC-BY-4.0) enquanto a US-51 não shippar. A OGL entra — se entrar — num commit rastreável e isolado.
- O desacoplamento do `freeConfig` (a armadilha das constantes compartilhadas) **continua nesta story**, mas restrito aos campos que o ingest substitui; `startingKits` do Free segue como hoje até a US-51 tratar disso.

**Outras correções da revisão:**

- **Magias no `config`:** a versão original as punha *fora* do escopo; obsoleto — a [US-42](./US-42-magias-conhecidas.md) shipou `classSpells` **dentro** do `SystemConfigSchema`. Magias entraram no escopo do ingest.
- **Reuso do `starting-inventory.ts`:** a nota original mandava reusar a normalização de classe de lá. **Não serve:** o `CLASS_SYNONYMS` casa entrada do usuário em PT contra a chave canônica; não converte `Wizard` em `mago`. O mapper tem mapa próprio.
- **`docs/rules/srd/_source/`:** a versão original citava um PDF SRD "versionado" ali. **O diretório não existe no repo.** Referência removida.

---

## Referências no código

- [packages/shared/src/types/system.ts](../../../packages/shared/src/types/system.ts) — `SystemConfigSchema` (destino do mapeamento; forma fixa).
- [apps/api/prisma/seed.ts](../../../apps/api/prisma/seed.ts) — perícias/features/magias hoje **manuais**; passam a vir do artefato. Atributos, `pointBuy`, `proficiency`, **`startingKits`** e `initialAdventures` **ficam** no seed (kits até a US-51).
- [apps/api/src/character/starting-inventory.ts](../../../apps/api/src/character/starting-inventory.ts) — `CLASS_SYNONYMS` (entrada do usuário → chave canônica). **Inalterado** por esta story; o mapper do dataset é um mapa à parte.
- [apps/api/prisma/schema.prisma](../../../apps/api/prisma/schema.prisma) — `System.config` (`Json`), sem alteração.
- [docs/adr/003-sistemas-como-dado.md](../../adr/003-sistemas-como-dado.md) — decisão D1 que esta story torna escalável (dado deixa de ser digitado).
