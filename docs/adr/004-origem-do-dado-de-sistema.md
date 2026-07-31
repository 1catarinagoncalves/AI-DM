# ADR 004 — Origem do dado de sistema: ingestão do SRD por pipeline pinado

**Status:** Aceito (implementado — US-47)
**Data:** 2026-07-15
**Decisores:** Time de Produto e Engenharia
**Relacionado:** [ADR 003 — Sistemas como dado](./003-sistemas-como-dado.md) (o `config` como **destino**; segue inteiro) · [ADR 005 — Locale como dimensão](./005-locale-como-dimensao.md) (o overlay pt-BR é **um locale**) · [US-47](../sdlc/01-requisitos/US-47-ingestao-srd-como-dado.md) · [US-51](../sdlc/01-requisitos/US-51-kits-iniciais-do-srd.md) (kits, fonte/licença próprias) · [US-52](../sdlc/01-requisitos/US-52-traducao-automatica-do-srd.md) (tradução automática do conteúdo novo)

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

Pipeline de dois passos, sem código de app novo, alimentando **só o `system-dnd5e`**:

- **`scripts/srd/sync.mjs`** — baixa `open5e/open5e-api` **pinado na tag `v2.1.0`** para
  `scripts/srd/_data/` (gitignored). Reprodutibilidade > frescor; `main` nunca.
- **`scripts/srd/ingest.mjs`** — mapeia o dataset → 4 campos do `SystemConfig`
  (`attributes`, `skills`, `classFeatures`, `classSpells`), aplica o overlay pt-BR, valida com
  `SystemConfigSchema.parse()` e grava os artefatos versionados **`scripts/srd/srd-5e.config.<locale>.json`**
  (a US-99 desdobrou o artefato único em base EN + localização pt-BR).
- O **`seed.ts` importa o artefato** só para o D&D; o `system-free` ficou **congelado** em literais
  próprias (ver §3, decisão 6). `System.version` do D&D passou de `'5.1'` → **`'5.2'`**.

**Fonte:** Open5e (SRD 5.2), **CC-BY-4.0** — a mesma licença do SRD publicado pela WotC. Atribuição
numa linha ([NOTICE-open5e.md](../../scripts/srd/NOTICE-open5e.md)), **sem OGL 1.0a**.

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
| 4 | Ingest deriva **4 campos**; kits/point-buy/proficiência/aventuras ficam no seed | A fronteira é "regra do SRD numa fonte CC". Orçamento de point-buy e faixa de atributo são decisão de produto; kit inicial é regra, mas a fonte é OGL (US-51). |
| 5 | Overlay por **chave canônica**, não pela chave do Open5e | Desamarra o overlay do formato `srd-2024_*` da fonte; trocar dataset reescreve só o mapper, não o `pt-BR.json`. |
| 6 | **Desacoplar o `freeConfig`** dos 4 campos substituídos | Antes o Free *referenciava* os mesmos objetos do D&D; trocar por artefato faria o Free herdar o SRD sem ninguém pedir, e nenhum teste pegaria (fixtures próprias). Agora tem literais `free*` congeladas. |
| 7 | **Fidelidade ao 5.2 vence** onde o dataset diverge do seed curado | Ver §4 — o objetivo da US é derivar do SRD versionado; órfãos e lacunas são **relatados**, não escondidos. |
| 8 | Ingest valida via `SystemConfigSchema.parse()` (com stub dos campos não-derivados) | Dataset de forma inesperada quebra o ingest com erro claro, sem gravar config inválido. |

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

---

## 6. Consequências

**Positivas**
- Regra nova de sistema deixa de ser digitação: `sync` + `ingest` derivam de fonte versionada.
- Bump de dataset vira PR com diff de artefato — revisão exata do que mudou.
- O Free virou **guarda-costas do desacoplamento**: se um dado do SRD aparecer num personagem do
  Free, o pipeline vazou.
- Licença única (CC-BY-4.0) auditável no repo, sem depender de ler uma user story.

**Negativas / riscos**
- O overlay pt-BR é **dívida viva**: cada regra nova precisa de tradução (automatizada na US-52,
  sinalizada pelo `--strict` até lá). No primeiro ingest, 64 chaves caem no fallback EN.
- O 5.2 **mudou conteúdo observável** vs. o seed anterior (features/magias por classe) — é a troca
  consciente por fidelidade à edição, não regressão acidental.
- Nenhuma marca da WotC é licenciada: o produto **não** pode se chamar "D&D".
- O `ingest` exige o `@ai-dm/shared` buildado (`dist`) — o script `srd:ingest` já o builda antes.

---

## 7. Implementação (referência)

- `scripts/srd/sync.mjs` — download pinado (`v2.1.0`) → `scripts/srd/_data/`.
- `scripts/srd/ingest.mjs` — mapper + overlay + relatórios (órfãos / fallback EN) + `--strict` + escrita determinística.
- `scripts/srd/locale/pt-BR.json` — overlay curado (chave canônica), semeado do seed.
- `scripts/srd/srd-5e.config.en-US.json` / `srd-5e.config.pt-BR.json` — artefatos derivados versionados (US-99).
- `scripts/srd/NOTICE-open5e.md` — atribuição CC-BY-4.0.
- `apps/api/prisma/seed.ts` — `free*` congelado; D&D importa o artefato; `version '5.2'`.
- `package.json` — scripts `srd:sync` e `srd:ingest`.
