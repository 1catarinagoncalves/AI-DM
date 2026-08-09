# ADR 004 — Origem do dado de sistema: ingestão do SRD por pipeline pinado

**Status:** Aceito (implementado — US-47) · **decisão 6 revista em 02/08/2026** (o Free herda o SRD — ver §3.1) · **nota §3.3 em 09/08/2026** (segundo publisher — US-121)
**Data:** 2026-07-15
**Decisores:** Time de Produto e Engenharia
**Relacionado:** [ADR 003 — Sistemas como dado](./003-sistemas-como-dado.md) (o `config` como **destino**; segue inteiro) · [ADR 005 — Locale como dimensão](./005-locale-como-dimensao.md) (o overlay pt-BR é **um locale**) · [US-47](../sdlc/01-requisitos/US-47-ingestao-srd-como-dado.md) · [US-51](../sdlc/01-requisitos/US-51-kits-iniciais-do-srd.md) (kits, fonte/licença próprias) · [US-52](../sdlc/01-requisitos/US-52-traducao-automatica-do-srd.md) (tradução automática do conteúdo novo) · [US-121](../sdlc/01-requisitos/US-121-catalogo-backgrounds-a5e-adventurers-guide.md) (segundo publisher, `a5e-ag`, ver §3.3)

---

## 1. Contexto

O [ADR 003](./003-sistemas-como-dado.md) fixou o **destino** do dado de sistema: `System.config`
(`Json` validado por Zod), consumido por endpoints genéricos. Mas a **origem** era digitação
manual no [seed.ts](../../apps/api/prisma/seed.ts) — perícias, features de nível 1 e magias
transcritas classe por classe. Isso não escala (cada regra nova é digitação) e não sobrevive a
uma revisão do SRD (é retrabalho). O custo real não é o volume de texto, é a **ligação**: saber
que `Arcane Recovery` é feature de nível 1 do Mago, que `Cure Wounds` é magia de 1º do Paladino.

Este ADR decide a **procedência** do dado — uma camada acima do 003: de onde vem, pinado em quê,
sob qual licença, em qual idioma. Não revoga nada do 003; ele só é barato *porque* o 003 valeu.

---

## 2. Decisão

Pipeline de dois passos, sem código de app novo, alimentando **os dois sistemas seed**
(até 02/08/2026, só o `system-dnd5e` — ver a decisão 6, revista):

- **`scripts/srd/sync.mjs`** — baixa `open5e/open5e-api` **pinado na tag `v2.1.0`** para
  `scripts/srd/_data/` (gitignored). Reprodutibilidade > frescor; `main` nunca.
- **`scripts/srd/ingest.mjs`** — mapeia o dataset → 4 campos do `SystemConfig`
  (`attributes`, `skills`, `classFeatures`, `classSpells`), aplica o overlay pt-BR, valida com
  `SystemConfigSchema.parse()` e grava os artefatos versionados **`scripts/srd/srd-5e.config.<locale>.json`**
  (a US-99 desdobrou o artefato único em base EN + localização pt-BR).
- O **`seed.ts` importa o artefato** para o D&D **e para o Free** — este último por **seleção de
  chaves**, não por cópia de texto (ver §3, decisão 6, revista em 02/08/2026).
  `System.version` do D&D passou de `'5.1'` → **`'5.2'`**.

**Fonte:** Open5e (SRD 5.2), **CC-BY-4.0** — a mesma licença do SRD publicado pela WotC. Atribuição
numa linha ([NOTICE-open5e.md](../../scripts/srd/NOTICE-open5e.md)), **sem OGL 1.0a**.

> **Atualizado em 02/08/2026 pelo [ADR 009](./009-uniao-dos-srd-5-1-e-5-2.md).** A fonte deixou de ser
> um documento e passou a ser a **união** de `srd-2024` (5.2) e `srd-2014` (5.1), do **mesmo tag pinado**,
> com o 5.2 vencendo sempre que os dois descreverem a mesma coisa. O pipeline, o pin e a regra de licença
> única continuam valendo: o 5.1 entra pela via **CC-BY-4.0** do seu dual-licenciamento, e OGL 1.0a segue
> barrado. `System.version` continua `'5.2'` (é a edição de referência, não o inventário).

**Idioma:** nenhuma fonte traduz o SRD. O pt-BR é **overlay curado do projeto**
(`scripts/srd/locale/pt-BR.json`), indexado por **chave canônica nossa** (`paladino_lay-on-hands`,
não `srd-2024_paladin_lay-on-hands`), semeado do `seed.ts` de hoje. Nasce locale-aware
([ADR 005](./005-locale-como-dimensao.md)): `en` é a base nativa (dataset cru, sem overlay);
`pt-BR` é a localização de um locale por cima, com **fallback para o EN do dataset** e `--strict`
que barra qualquer chave só-EN.

---

## 3. Decisões-chave e justificativas

| # | Decisão | Por quê |
|---|---------|---------|
| 1 | **Open5e**, não `5e-database` | O `5e-database` **não tem** spells 2024 (só SRD 5.1) e é **OGL 1.0a** (copyleft, contamina o repo). O Open5e tem as magias 2024 nativas e é CC-BY-4.0. |
| 2 | Tag pinada (`v2.1.0`), não `main` | Reprodutível. Bump vira PR com diff do artefato mostrando exatamente o que mudou. |
| 3 | Artefato versionado (`srd-5e.config.<locale>.json`), não submodule | O `seed` não depende de rede; o diff do artefato é a revisão de cada bump. |
| 4 | Ingest deriva **4 campos**; ~~kits~~/point-buy/proficiência/aventuras ficam no seed → **kit revisto em 03/08/2026, ver §3.2** | A fronteira é "regra do SRD numa fonte CC". Orçamento de point-buy e faixa de atributo são decisão de produto; ~~kit inicial é regra, mas a fonte é OGL (US-51)~~ — a premissa da fonte estava errada, ver §3.2. |
| 5 | Overlay por **chave canônica**, não pela chave do Open5e | Desamarra o overlay do formato `srd-2024_*` da fonte; trocar dataset reescreve só o mapper, não o `pt-BR.json`. |
| 6 | ~~**Desacoplar o `freeConfig`** dos 4 campos substituídos~~ → **revista em 02/08/2026: o Free herda o artefato, por seleção de chaves** | Ver §3.1. |
| 7 | **Fidelidade ao 5.2 vence** onde o dataset diverge do seed curado | Ver §4 — o objetivo da US é derivar do SRD versionado; órfãos e lacunas são **relatados**, não escondidos. |
| 8 | Ingest valida via `SystemConfigSchema.parse()` (com stub dos campos não-derivados) | Dataset de forma inesperada quebra o ingest com erro claro, sem gravar config inválido. |

---

## 3.1 Revisão da decisão 6 (02/08/2026): o Free herda o SRD

**O que mudou de fato.** A decisão 6 original nasceu de uma armadilha de *implementação*: o
`freeConfig` **referenciava os mesmos objetos** do D&D, então trocar as constantes por artefato
teria feito o Free herdar o SRD **sem ninguém decidir**. Congelar literais `free*` resolveu isso —
mas transformou um acidente evitado em política permanente, e o preço apareceu depois:

- O `freeConfig` é literal **em pt-BR gravado na coluna `config`**, que a [ADR 005](./005-locale-como-dimensao.md)
  define como a **base EN**. O Free não tem `configLocales`, então serve PT nos dois locales:
  trocar o idioma não muda nada na ficha de um personagem do Free.
- Feature e magia do Free **não têm chave** — só `{name, description}`. Sem chave, a resolução por
  locale da [US-100](../sdlc/01-requisitos/US-100-ficha-do-personagem-no-locale-ativo.md) não tem
  onde se pendurar: ficha do Free ficaria com texto congelado para sempre.
- Traduzir o snapshot do Free à mão (ou por MT própria) seria manter **um segundo catálogo bilíngue
  de 5e** ao lado do artefato — a mesma digitação que este ADR existe para eliminar.

**Nova decisão:** o Free herda o artefato, mas **por seleção de chaves, não por cópia de texto** — e
**herdar não quer dizer depender só** dele: o que o Free tem e o SRD não continua sendo dele, agora
com procedência declarada (6f).
Implementada pela [US-106](../sdlc/01-requisitos/US-106-catalogo-com-chave-e-free-herdando-o-srd.md);
a consumidora é a [US-100](../sdlc/01-requisitos/US-100-ficha-do-personagem-no-locale-ativo.md).

| # | Decisão decorrente | Por quê |
|---|---|---|
| 6a | O Free define o catálogo por **lista de chaves** (`freeFeatureKeys`, `freeSpellKeys`), resolvida contra o artefato no `seed.ts`. Texto (`name`, `description`) vem do artefato; **quais** itens entram continua sendo curadoria do Free | Preserva o que o Free é — um 5e enxuto — sem manter um segundo texto. A curadoria vira dado revisável (uma lista de chaves), não prosa duplicada. |
| 6b | O Free ganha `configLocales['pt-BR']`; `config` passa a ser a **base EN**, como o D&D | Corrige a violação da ADR 005 (PT na coluna da base EN). O Free passa a acompanhar o idioma sem código novo. |
| 6c | Campos **não-SRD** do Free (~~kits~~, ganchos, point-buy, proficiência) **seguem literais próprios** → **kit revisto em 03/08/2026, ver §3.2** | A decisão 4 não muda: a fronteira continua sendo "regra do SRD numa fonte CC". ~~Kit inicial é OGL (US-51) e não entra por esta porta.~~ O kit **está** numa fonte CC — entra pela mesma porta dos outros campos herdados. |
| 6d | **Chave selecionada que sumir do artefato falha o `seed`** | Substitui o guarda-costas perdido (ver §6). Um bump que retire conteúdo usado pelo Free passa a ser erro alto, não descoberta em produção. |
| 6e | A atribuição CC-BY-4.0 ([NOTICE](../../scripts/srd/NOTICE-open5e.md)) passa a cobrir **o produto inteiro**, não só o `system-dnd5e` | Licença única continua valendo; muda o alcance, não a regra. Nenhuma marca da WotC entra junto (§6). |
| 6f | **Herdar não é depender só.** A entrada do catálogo declara **procedência** (`source`), e o catálogo de um sistema é montado de **referências ao artefato + entradas próprias**. A guard da 6d vale só para referência | Medido em 02/08/2026: **7 dos 34 truques do Free não estão no 5.1 nem no 5.2** (`friends`, `thorn-whip`, `toll-the-dead`, `mind-sliver`, `thunderclap`, `blade-ward`, `word-of-radiance` — os mesmos órfãos que o [ADR 009 §4](./009-uniao-dos-srd-5-1-e-5-2.md) verificou um a um). Uma seleção que só sabe apontar para o artefato ou perde esses 7, ou os deixa congelados ao lado dos herdados — reencenando o defeito que a 6b conserta. O campo de origem é o que o [ADR 009 D5](./009-uniao-dos-srd-5-1-e-5-2.md) já previa, e é o que torna a licença auditável **por entrada** num catálogo de fontes misturadas. Somam-se a elas **2 features** (`paladin_divine-sense`, `ranger_natural-explorer`), que existem no 5.1 mas ainda não no artefato: a união do ADR 009 foi aplicada só ao domínio `races` (`buildRaces` no [`ingest.mjs`](../../scripts/srd/ingest.mjs)). São autorais por ora e viram referência quando a união alcançar feature — **9 entradas próprias no total**. |
| 6g | **`System.version` do Free descreve a curadoria, não o conteúdo.** Fica `'1.0'` e só sobe quando a *seleção* muda; bump do dataset que altere o texto herdado **não** mexe nela. A procedência do dado se lê no `source` da entrada (6f) e no [NOTICE](../../scripts/srd/NOTICE-open5e.md) | Com o texto vindo do artefato, o número do Free deixa de descrever o conteúdo de qualquer jeito. Amarrá-lo ao dataset (`'1.0+srd5.2'`) daria churn de versão por motivo que não é de produto — e para nada: `version` é servido em [`system.service.ts:16`](../../apps/api/src/system/system.service.ts) mas **nenhum consumidor lê** (nada em `apps/web` renderiza ou compara). O campo passa a significar coisa diferente em cada sistema — no D&D é a versão do dataset, no Free é a da curadoria — e é isso mesmo que se quer dizer. |
| 6h | **Entrada autoral mora literal no `seed.ts`, não em overlay próprio.** O bilíngue das 9 entradas fica ao lado da curadoria que já vive lá; overlay tipo `scripts/free/locale/pt-BR.json` só quando doer — entrada autoral passar de ~20 itens, ou entrar um terceiro locale | O overlay do SRD existe para conteúdo que **um bump traz e leva**: 42 KB / 211 entradas geradas por script, com marca `_mt`, `--strict` e relatório de órfão. A entrada autoral não tem nada disso — ninguém a ingere, bump nenhum a toca, e a tradução é uma rodada só (a US-52 gera o EN, revisão no diff do PR, congela). Overlay para elas seria arquivo novo + base EN + um irmão do `readSrdArtifact` + teste, para 9 entradas que não mudam sozinhas. E esperar não custa: `key` + `source: 'authored'` (6f) já marcam exatamente o que mudaria de casa. Medido em 03/08/2026: o `seed.ts` tem 461 linhas (teto de 500 no `AGENTS.md`) e esta mudança o **encolhe** — 27 dos 34 truques e as 16 features trocam texto por chave. |

**Efeito colateral que só apareceu medindo o artefato:** o pt-BR do artefato **já é o texto do Free**
— o overlay foi semeado do próprio `seed.ts`, então a descrição pt-BR de feature tem mediana de
**57 caracteres** ("Entra em fúria, ganhando ímpeto e resistência no combate."), enquanto a EN é o
texto de regra cru do dataset, mediana **426**. Em pt-BR o Free recebe de volta exatamente a prosa
que já exibia hoje; em en-US ele estreia com texto longo. Os dois locales do artefato **não estão no
mesmo registro** — assimetria que este ADR só registra; equilibrá-la é decisão de conteúdo, não de
procedência.

---

## 3.2 Correção de procedência (03/08/2026): o kit inicial é CC-BY, não OGL

**O que estava errado.** As decisões 4 e 6c mantinham o kit inicial fora da fronteira "regra do SRD
numa fonte CC" apoiadas num fato medido: o modelo `CharacterClass` do Open5e não tem campo de
equipamento (traz `caster_type`, `document`, `hit_dice`, `name`, `primary_abilities`,
`saving_throws`, `subclass_of`). A conclusão tirada dali — *"a única fonte estruturada é o
`5e-bits/5e-database`, que é OGL 1.0a"* — **não seguia**: a medição cobria um modelo, não o dataset.

**Onde o dado estava o tempo todo.** No modelo `ClassFeature`, nas 12 entradas de
`feature_type: "CORE_TRAITS_TABLE"` (uma por classe base), como uma linha de tabela markdown dentro
do `desc`: `|Starting Equipment|Choose A or B: (A) Chain Shirt, Shield, Mace, …; or (B) 110 GP|`.
O arquivo já era baixado pela US-47 — a fonte nunca precisou mudar.

**Consequências para este ADR:**

| # | Decisão | Por quê |
|---|---|---|
| 9 | O ingest deriva **`startingKits`** também; o `seed.ts` para de declarar `dnd5eKits` | Kit inicial é regra do SRD, e a fonte é a mesma CC-BY-4.0 do resto. O motivo de excluí-lo era a licença da segunda fonte, e não há segunda fonte. |
| 10 | **Nenhuma dependência nova, nenhuma licença nova.** A decisão 1 (Open5e, não `5e-database`) e a §2 (licença única, sem OGL 1.0a) valem **sem exceção** | Era esta a exceção que a US-51 ia abrir. Ela não existe mais: o repo segue CC-BY puro. |
| 11 | O kit sai do **artefato por locale**, com overlay `kitItems` (42 itens) — e o Free o **herda**, como herda os outros campos CC | Enquanto era autoral, o kit vivia num objeto compartilhado pelos dois locales: o `config` en-US servia *"Cajado arcano"*. Derivar corrige o locale de graça, e a 6c deixa de valer para ele. |
| 12 | O kit `default` (classe fora do catálogo) é literal **em EN dentro do `ingest.mjs`**, não no seed | Não vem do SRD — o dataset não tem "classe padrão" —, mas precisa atravessar o mesmo overlay: no seed ele seria PT nos dois locales, reencenando o defeito da 11. |

**Preço aceito:** este é o único campo derivado de **texto livre**. O parser está isolado em
`parseStartingKit` ([`ingest.mjs`](../../scripts/srd/ingest.mjs)), com as armadilhas do dataset
cobertas por teste — inclusive palavras que a extração de PDF partiu no meio (`Leather Ar mor`),
reparadas por mapa explícito. A alternativa era importar a OGL para evitar ~10 linhas de parsing.

Implementada pela [US-51](../sdlc/01-requisitos/US-51-kits-iniciais-do-srd.md).

---

## 3.3 Segundo publisher no config (09/08/2026): `a5e-ag` entra sob a mesma regra de licença única

**O que muda.** A [US-121](../sdlc/01-requisitos/US-121-catalogo-backgrounds-a5e-adventurers-guide.md)
deriva `backgrounds` de *Level Up: Advanced 5th Edition — Adventurer's Guide* (`a5e-ag`), publicado
por **EN Publishing** — o primeiro dado do `SystemConfig` que não vem de `wizards-of-the-coast/`.
O SRD 5.2 da WotC só libera 4 backgrounds como CC-BY; o `a5e-ag` cobre o mesmo papel de "background
genérico de fantasia" com 21.

**Por que não é exceção.** A fonte continua sendo **a mesma**: `open5e/open5e-api`, mesmo `TAG`
pinado (decisão 2). Muda só o *documento* dentro do repositório (`en-publishing/a5e-ag/` em vez de
`wizards-of-the-coast/srd-2024`), exatamente como o SRD 5.1 (ADR 009) já é um documento irmão no
mesmo repo. O `a5e-ag` é publicado sob **licença dupla** (CC-BY-4.0 ou OGL 1.0a) — entra pela via
**CC-BY-4.0**, o mesmo precedente que o ADR 009 já aplicou ao 5.1: licença única (§2) continua sem
exceção, sem OGL, sem dependência nova. Nenhuma marca **"Advanced 5th Edition"**, **"A5E"** ou do
publisher entra no produto (mesma regra de marca da decisão 6e/§6, agora valendo para um segundo
publisher). Atribuição em [NOTICE-open5e.md](../../scripts/srd/NOTICE-open5e.md).

**Fronteira do dado.** Só o catálogo mecânico (texto: nome, benefícios) — aplicar os benefícios de
fato num personagem (`ability_score`, `skill_proficiency`…) fica fora, mesma fronteira da decisão 4.
Os 4 backgrounds nativos do `srd-2024` não entram (colidiriam em nome sem ganho): `a5e-ag` é a
**única** fonte de background, não uma união como o ADR 009 fez com espécie.

Implementada pela [US-121](../sdlc/01-requisitos/US-121-catalogo-backgrounds-a5e-adventurers-guide.md).

---

## 4. A descoberta que só apareceu cutucando o dataset

A US-47 assumia que os dados de nível 1 do SRD 2024 bateriam com o conteúdo curado no `seed.ts`.
**Não batem** — o seed misturava sabor 2014 e a wiki 2024:

- **Fixtures Django, não a API agregada.** O dado cru separa em tabelas (`ClassFeature` +
  `ClassFeatureItem` para o nível; `Spell.classes[]` para a ligação) e traz **linhas de coluna de
  tabela** (`desc === "[Column data]"`: Proficiency Bonus, Rages, Slots…) que o ingest **descarta**,
  além do motor de conjuração (`*_spellcasting`, `*_pact-magic`), que é a US-42 (`classSpells`).
- **O 5.2 mudou os features de nível 1.** Paladino **não** ganha *Divine Sense* no nível 1 (ganha
  *Lay On Hands* + *Weapon Mastery*); Patrulheiro perdeu *Natural Explorer*. Entram features novas:
  *Weapon Mastery*, *Ritual Adept*, *Divine Order*, *Primal Order*, *Innate Sorcery*, *Eldritch
  Invocations*.
- **O 5.2 tem 27 truques** (o seed listava ~34; ~7 eram da wiki 2024, fora do SRD 5.2) e dá lista
  real de magias de 1º a todo conjurador + Paladino/Patrulheiro.

**Resolução (decidida com o produto):** *o dataset manda* (fidelidade ao 5.2), e a ingestão de
magias inclui **truques + todas as de nível 1**. As consequências são **relatadas**, não silenciadas:

- **Órfãos** (9) — PT curado sem chave no 5.2 (Sentido Divino, Explorador Nato, 7 truques `†`):
  ficam no overlay e o ingest os **relata** para decisão caso a caso.
- **Fallback EN** (64) — conteúdo novo do 5.2 sem PT (10 features + 54 magias de 1º): cai no texto
  EN do dataset e entra no relatório; a tradução curada é a [US-52](../sdlc/01-requisitos/US-52-traducao-automatica-do-srd.md).
  `--strict` barra isso em produção.

---

## 5. Alternativas rejeitadas

| Alternativa | Motivo da rejeição |
|-------------|-------------------|
| `5e-database` como fonte | Sem spells 2024 (obrigaria a misturar SRD 5.1); OGL 1.0a contamina o repo. |
| Manter digitação manual no seed | É o problema — não escala, não sobrevive a revisão do SRD. |
| Submodule/fetch no `seed` em vez de artefato versionado | Põe rede no caminho do seed; perde o diff do artefato como revisão de bump. |
| Overlay indexado pela chave do Open5e | Amarra cada tradução ao formato `srd-2024_*`; um bump quebra o `pt-BR.json`. |
| "Seed manda" (preservar o conteúdo curado tal qual) | Tornaria o dataset quase cosmético e não traria o conteúdo novo do 5.2; contra o objetivo da US. |
| **Free herda o artefato inteiro** (os 4 campos, sem seleção) — rejeitada em 02/08/2026 | Free e D&D viram o mesmo sistema com nomes diferentes; a única diferença sobrando seriam kits e ganchos. A seleção por chave (6a) é o que mantém os dois distinguíveis. |
| **Free mantém literais e ganha overlay bilíngue próprio** — rejeitada em 02/08/2026 | Dois catálogos 5e bilíngues para manter, cada bump revisado duas vezes. É a digitação que este ADR eliminou, reintroduzida pela porta da tradução. |

---

## 6. Consequências

**Positivas**
- Regra nova de sistema deixa de ser digitação: `sync` + `ingest` derivam de fonte versionada.
- Bump de dataset vira PR com diff de artefato — revisão exata do que mudou.
- ~~O Free virou **guarda-costas do desacoplamento**~~ — caiu com a revisão da decisão 6. O papel
  de rede foi **substituído**, não abandonado: pela 6d, chave selecionada que sumir do artefato
  falha o `seed` (bump que retira conteúdo grita, em vez de vazar em silêncio).
- Licença única (CC-BY-4.0) auditável no repo, sem depender de ler uma user story — desde
  02/08/2026 cobrindo os **dois** sistemas seed.
- O Free deixa de ser um beco monolíngue: com chave e artefato, ele entra de graça na resolução por
  locale da US-100, sem catálogo próprio para traduzir.

**Negativas / riscos**
- O overlay pt-BR é **dívida viva**: cada regra nova precisa de tradução. A US-52 automatizou o
  rascunho (`"_mt": true`, revisável no diff), mas a **correção** continua sendo revisão humana —
  nem o schema nem o `--strict` a validam. No primeiro ingest, 64 chaves caem no fallback EN.
- O 5.2 **mudou conteúdo observável** vs. o seed anterior (features/magias por classe) — é a troca
  consciente por fidelidade à edição, não regressão acidental.
- Nenhuma marca da WotC é licenciada: o produto **não** pode se chamar "D&D".
- **O Free passa a depender do bump** (revisão da decisão 6): antes ele era imune ao dataset, agora
  uma retirada de conteúdo no 5.x o alcança. É a troca consciente por um catálogo só; a rede é a 6d.
- **Personagem existente do Free** tem feature/magia gravada como texto pt-BR — migra pela mesma
  rotina da [US-100](../sdlc/01-requisitos/US-100-ficha-do-personagem-no-locale-ativo.md), casando
  contra o catálogo. Medido em 02/08/2026: 14 das 16 features e 27 dos 34 truques do snapshot Free
  existem no artefato 5.2; *Sentido Divino* e *Explorador Nato* voltam pela união do
  [ADR 009](./009-uniao-dos-srd-5-1-e-5-2.md), e os 7 truques restantes viram **entradas próprias**
  pela 6f. Nenhum item fica sem destino.
- O `ingest` exige `@ai-dm/shared` e `@ai-dm/ai-engine` buildados (`dist`) — o script `srd:ingest`
  já os builda antes. O `ai-engine` entrou na US-52: é de lá que sai a chamada de tradução, porque
  `ai`/`@ai-sdk/google` não resolvem a partir da raiz do repo.

---

## 7. Implementação (referência)

- `scripts/srd/sync.mjs` — download pinado (`v2.1.0`) → `scripts/srd/_data/`.
- `scripts/srd/ingest.mjs` — mapper + overlay + relatórios (órfãos / fallback EN) + `--strict` + escrita determinística + rascunho `_mt` da US-52 (`--no-mt` desliga).
- `scripts/srd/locale/pt-BR.json` — overlay curado (chave canônica), semeado do seed.
- `scripts/srd/srd-5e.config.en-US.json` / `srd-5e.config.pt-BR.json` — artefatos derivados versionados (US-99).
- `scripts/srd/NOTICE-open5e.md` — atribuição CC-BY-4.0.
- `apps/api/prisma/seed.ts` — D&D importa o artefato; `version '5.2'`. Desde 02/08/2026 o Free
  também: `free*` deixa de ser texto congelado e vira **lista de chaves** resolvida contra o
  artefato (decisão 6a), com `configLocales['pt-BR']` (6b). Kits/ganchos seguem literais (6c).
- `package.json` — scripts `srd:sync` e `srd:ingest`.
