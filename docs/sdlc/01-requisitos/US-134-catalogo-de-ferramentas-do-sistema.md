# US-134 — Catálogo de ferramentas e veículos do sistema (`config.tools`)

**Épico:** 1 — Personagem
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** [US-47](./US-47-ingestao-srd-como-dado.md) (pipeline `sync`+`ingest`, artefato por locale) · [US-99](./US-99-config-do-sistema-no-locale-ativo.md) (dois artefatos, um por locale)
**Relacionado:** [US-132](./US-132-escolha-ferramenta-beneficio-tool-proficiency-background.md) (consumidor bloqueado — é a story-base que ela pede em sua *Questão em aberto 1*; esta story fecha exatamente essa lacuna) · [US-133](./US-133-catalogo-de-idiomas-do-sistema.md) (catálogo irmão, mesma investigação, mesmo dia — a *Questão em aberto 2* de ambas as stories bloqueadas perguntava se valia investigar as duas lacunas juntas; a resposta foi sim) · [US-130](./US-130-culture-engineering-catalogo-pericias.md) (mesmo formato: fechar lacuna de catálogo que bloqueia mecanização de um benefício de background) · [US-105](./US-105-raca-e-classe-por-chave-do-srd.md) (`SystemCatalogEntrySchema`, contrato `key`/`label` que esta story estende)
**Criada em:** 2026-08-13

---

## História

> **Como** desenvolvedora,
> **quero** derivar um catálogo de **ferramentas e veículos** do documento `wizards-of-the-coast/srd-2024` (já pinado, arquivo `Item.json` ainda não sincronizado) pelo pipeline `sync`+`ingest` da US-47,
> **para que** `SystemConfig` tenha uma lista contra a qual a US-132 possa validar a escolha do benefício `tool_proficiency` do background — hoje essa lista não existe em lugar nenhum do projeto.

---

## Contexto e motivação

### O problema observado

A US-132 (criada 2026-08-13) ficou registrada com a dependência explícita: *"uma story ainda não escrita que crie `config.tools` — não existe hoje, nem como US nem como campo"*, e afirma na *Contexto*: *"não existe `Tool.json` no dataset Open5e pinado (`scripts/srd/_data/` não tem esse arquivo — só `Skill.json`, sem equivalente pra ferramentas)"* — essa afirmação foi checada contra o `_data/` local sincronizado, não contra o dataset Open5e completo.

### Investigação (13/08/2026)

Consultei `open5e/open5e-api` na tag já pinada (`v2.1.0`) via `gh api repos/open5e/open5e-api/contents/data/v2/wizards-of-the-coast/srd-2024?ref=v2.1.0`. Não existe `Tool.json` dedicado — mas existe **`Item.json`**, no mesmo documento `srd-2024` que já fornece `AbilityDescription.json`/`CharacterClass.json`/etc ([sync.mjs:15](../../../scripts/srd/sync.mjs:15), const `SRD`), só que **esse arquivo específico não está na lista `FILES` hoje**. Não é preciso pinar tag nova nem abrir licença nova — é um arquivo do mesmo documento já coberto pelo `NOTICE-open5e.md`.

`Item.json` tem **203 entradas**, `{pk, fields: {category, cost, desc, document, name, weight, ...}}`. O campo `category` resolve exatamente a estrutura categoria→item que a *Questão em aberto 1* da US-132 deixou pendente:

| `category` | Itens | Cobre o texto do benefício |
|---|---:|---|
| `tools` | **39** | "artisan's tools", "gaming set", "musical instrument", ferramentas/kits nomeados |
| `land-vehicle` | **5** | "land vehicles" (Farmer), "one vehicle" (Trader/Marauder/Guildmember/Folk Hero) |
| `waterborne-vehicle` | **6** | "water vehicles" (Sailor), "one vehicle" (idem acima) |

As outras 9 categorias do arquivo (`weapon`, `armor`, `potion`, `ammunition`, `adventuring-gear`, `mount`, `spellcasting-focus`, `equipment-pack`, `scroll`, `wondrous-item`) não correspondem a proficiência de ferramenta — fora do escopo.

Dentro de `category: "tools"` (39 itens), o **nome** já resolve o segundo nível (categoria de proficiência) sem precisar de mapeamento manual:

| Padrão de nome | Contagem | Exemplos | Categoria de proficiência (texto dos 13 backgrounds) |
|---|---:|---|---|
| `<Ofício>'s Tools/Supplies/Utensils (N GP)` | 17 | Smith's Tools, Alchemist's Supplies, Cook's Utensils | "one type of artisan's tools" |
| `Musical Instrument, <variante>` | 10 | Lute, Drum, Bagpipes | "musical instrument" |
| `<X> Kit` | 6 | Herbalism Kit, Disguise Kit, Forgery Kit | item concreto fixo (Hermit, Charlatan, Urchin) |
| `Gaming Set, <variante>` | 4 | Dice, Playing Cards | "gaming set" |
| Nomeado sozinho, sem sufixo de preço | 2 | Navigator's Tools, Thieves' Tools | item concreto fixo (Sailor, Criminal/Urchin) |

17+10+6+4+2 = 39, bate com a contagem medida.

### Por que a solução atual não basta

Sem catálogo, a US-132 não tem contra o que validar `origin.toolChoice` nem opções para o seletor da etapa `background` — ela mesma registra isso como bloqueio, não decisão de escopo.

### A proposta

Mesmo movimento da US-133 (catálogo irmão, idioma): estender `sync.mjs`/`ingest.mjs` para baixar `Item.json` e derivar `config.tools` com dois níveis (`category` de proficiência + `key`/`label` do item), filtrando só as 3 categorias relevantes do dataset. **Esta story entrega o catálogo, não a escolha na criação** (isso é a US-132, que passa a estar desbloqueada).

---

## Escopo

### Dentro do escopo

- **`sync.mjs`**: um arquivo novo, `${SRD}/Item.json` ([sync.mjs:15,37](../../../scripts/srd/sync.mjs:15) — mesma constante `SRD` que já baixa `AbilityDescription.json`/`CharacterClass.json`, mesmo `TAG` pinado, sem entrada nova em `NOTICE-open5e.md`).
- **`ingest.mjs`**: nova `buildTools(overlay, itemsRaw, resolve)` — filtra `fields.category` em `['tools', 'land-vehicle', 'waterborne-vehicle']`; para `category: 'tools'`, deriva a categoria de proficiência (`artisan` | `musical-instrument` | `gaming-set` | `kit` | item nomeado sozinho) a partir do **padrão do nome** medido acima (função pura, mesmo espírito de `parseStartingKit`/`parseSkillGrant`, tabela de padrões explícita — falha alto se um `Item.json` futuro trouxer um nome fora dos 5 padrões medidos); `land-vehicle`/`waterborne-vehicle` mapeiam direto para categoria `vehicle`.
- **`SystemToolSchema`** novo (`packages/shared/src/types/system.ts`), perto de `SystemLanguageSchema` (US-133) — `key`/`label` (mesmo contrato de `SystemCatalogEntrySchema`) mais `category: z.string().min(1)` (string livre, não enum — mesmo raciocínio de `SystemBackgroundBenefitSchema.type`: 5 valores observados hoje, taxonomia fechada cedo demais quebra no primeiro valor novo de um bump).
- **`SystemConfigSchema`** ganha `tools?: z.array(SystemToolSchema)` — opcional, mesmo tratamento de `languages`/`skills`/`races`/`classes`.
- **`tools` entra em `MT_DOMAINS`** ([ingest.mjs:55](../../../scripts/srd/ingest.mjs:55)): os nomes de item precisam de rótulo em pt-BR, mesmo perfil de `races`/`skills` (nome curto, sem prosa).
- **Teste em `ingest.test.mjs`** cobrindo `buildTools` com fixture sintética — um item por padrão de nome, mais um item de categoria não reconhecida (deve falhar alto, não engolir em silêncio).

### Fora do escopo

- **Aplicar o catálogo a um personagem** (`grant.kind: 'tools'`, `CreateCharacterSchema.origin.toolChoice`, seletor na etapa `background`, exibição na ficha, parser dos 13 `desc` de `tool_proficiency` que resolvem QUAIS itens cada background concede) — é inteiramente a [US-132](./US-132-escolha-ferramenta-beneficio-tool-proficiency-background.md), que esta story desbloqueia. Esta story só garante que, quando a US-132 rodar, `Smith's Tools`/`Gaming Set, Dice`/etc já existem como chave no catálogo.
- **As outras 9 categorias de `Item.json`** (`weapon`, `armor`, `potion`, `ammunition`, `adventuring-gear`, `mount`, `spellcasting-focus`, `equipment-pack`, `scroll`, `wondrous-item`) — não são proficiência de ferramenta; um catálogo de equipamento geral (armas, armaduras) é discussão separada, sem story hoje.
- **`cost`/`weight`/`desc`** do item (preço, peso, texto de regra da ferramenta) — não usados por proficiência; o projeto não tem sistema de dinheiro/carga (mesmo corte que `parseStartingKit`, US-51, já fez).
- **Gaming Set/Musical Instrument como escolha de sub-variante pelo jogador** ("qual instrumento?") — o catálogo lista as variantes conhecidas (10 instrumentos, 4 jogos), mas se a US-132 vai oferecer a escolha da variante específica ou só conceder "proficiência em um instrumento musical" de forma abstrata é decisão dela, não desta story.

---

## Modelo de dados proposto

```ts
// packages/shared/src/types/system.ts — perto de SystemLanguageSchema (US-133)
export const SystemToolSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  // Categoria de proficiência do 5e ('artisan' | 'musical-instrument' | 'gaming-set' | 'kit'
  // | 'vehicle' | item nomeado sozinho sem categoria - ver ingest). String livre, não enum:
  // mesmo raciocínio de SystemBackgroundBenefitSchema.type — 5 valores observados hoje.
  category: z.string().min(1),
})
```

No `SystemConfigSchema`:

```ts
tools: z.array(SystemToolSchema).optional(),
```

| Campo | Tipo | Descrição |
|---|---|---|
| `tools[].key` | string | Chave canônica, `pk` normalizado (`srd-2024_smiths-tools` → `smiths_tools`) |
| `tools[].label` | string | Nome exibível, sem o preço no rótulo (`"Smith's Tools"`, não `"Smith's Tools (20 GP)"` — preço fora do escopo) |
| `tools[].category` | string | `artisan`, `musical-instrument`, `gaming-set`, `kit`, `vehicle`, ou o próprio `key` para os 2 itens nomeados sozinhos (`Navigator's Tools`, `Thieves' Tools`) — decisão de nomenclatura exata fica com o implementador |

**Persistência:** mesmo artefato `scripts/srd/srd-5e.config.<locale>.json` da US-47/US-99 — sem coluna nova no Prisma.

---

## Critérios de aceite

- [ ] `sync.mjs` baixa `Item.json` de `${SRD}` (mesmo documento de `AbilityDescription.json`), no `TAG` já pinado — sem tag nova, sem entrada nova em `NOTICE-open5e.md`.
- [ ] `ingest.mjs` deriva `tools`: 50 entradas (39 `category: 'tools'` + 5 `land-vehicle` + 6 `waterborne-vehicle`), cada uma com `key`, `label`, `category`.
- [ ] Os 17 itens de padrão `<Ofício>'s Tools/Supplies/Utensils` recebem `category: 'artisan'`; os 10 `Musical Instrument, X`, `category: 'musical-instrument'`; os 4 `Gaming Set, X`, `category: 'gaming-set'`; os 6 `<X> Kit` (Climber's/Disguise/Forgery/Healer's/Herbalism/Poisoner's), `category: 'kit'`; os 11 de veículo (5 `land-vehicle` + 6 `waterborne-vehicle`), `category: 'vehicle'`.
- [ ] Item de `Item.json` com `category: 'tools'` e nome fora dos 5 padrões medidos **falha o ingest alto** (mesmo tratamento de formato inesperado do `CLASS_MAP`/`parseStartingKit`) — coberto por fixture sintética no teste, não pelo dataset real (que bate 100% hoje).
- [ ] `SystemConfigSchema` valida `tools` opcional; config sem o campo continua válido.
- [ ] `tools` entra em `MT_DOMAINS`; `pnpm srd:ingest` produz `pt-BR` com `label` traduzido e marcado `_mt: true` onde não houver overlay curado.
- [ ] `pnpm srd:ingest --strict` passa sem chave `tools` no relatório de fallback EN pendente (50 nomes curados manualmente em `locale/pt-BR.json`).
- [ ] Os dois artefatos seguem passando em `SystemConfigSchema.parse()` e byte-a-byte idênticos entre duas rodadas (idempotência).
- [ ] **Eval / teste de regressão:** `ingest.test.mjs` cobre `buildTools` com fixture sintética contendo um item de cada um dos 5 padrões de nome + um item `category: 'tools'` com nome não reconhecido (deve lançar, não ser omitido em silêncio — diferente do tratamento de órfão de perícia da US-131, aqui o formato de NOME é contrato do parser, não um valor ausente no catálogo).

---

## Notas de implementação

- **Parser de categoria por nome, não por regex de preço**: o "(N GP)" no nome é ruído a descartar do `label`, não sinal de categoria — a categoria vem do **prefixo textual** (`"Musical Instrument, "`, `"Gaming Set, "`) ou da ausência de um desses prefixos + sufixo `" Kit"` (mesmo espírito de tabela de padrões explícita que `parseStartingKit`/`parseSkillGrant` (US-131) já usam, não heurística).
- **Reaproveitar `LOWERCASE_WORDS`/title case** ([ingest.mjs:353](../../../scripts/srd/ingest.mjs:353), US-128) se o `label` final precisar de normalização de capitalização — não é o caso hoje (os nomes do `Item.json` já vêm capitalizados corretamente), mas evita reinventar se algum item futuro vier diferente.
- **`land-vehicle`/`waterborne-vehicle` como uma única categoria `vehicle`**: os 13 `desc` de `tool_proficiency` (US-132) não distinguem terrestre de aquático no texto ("one vehicle" cobre os dois) — só `Farmer` ("Land vehicles") e `Sailor` ("water vehicles") são específicos, e mesmo esses filtram por `category` do `Item.json` (`land-vehicle` vs. `waterborne-vehicle`), não por um terceiro nível dentro de `vehicle`. Decisão de implementação, não uma restrição desta story.
- **Depois desta story, a US-132 deixa de estar bloqueada** — `**Depende de**` e `**Status**` dela devem ser atualizados para referenciar esta story quando ela for implementada.

---

## Questões em aberto

Nenhuma pendente do lado do catálogo. A US-132 mantém as próprias questões (3, sobre reabsorção da story) — não é resolvida por esta.

---

## Referências no código

- [scripts/srd/sync.mjs:15,37-49](../../../scripts/srd/sync.mjs:15) — const `SRD`, `FILES` (par `[url, nome]` de `AbilityDescription.json`, modelo direto para `Item.json`).
- [scripts/srd/ingest.mjs:55](../../../scripts/srd/ingest.mjs:55) — `MT_DOMAINS`.
- [scripts/srd/ingest.mjs:316-328](../../../scripts/srd/ingest.mjs:316) — `parseStartingKit` (US-51, precedente de parser texto→estruturado com tabela de padrões explícita, falha alto em formato desconhecido).
- [scripts/srd/ingest.mjs:353](../../../scripts/srd/ingest.mjs:353) — `LOWERCASE_WORDS` (US-128, normalização de título, reaproveitável se necessário).
- [packages/shared/src/types/system.ts:85-92](../../../packages/shared/src/types/system.ts:85) — `SystemBackgroundBenefitSchema.type` (precedente de campo `category`-like como string livre, não enum).
- [packages/shared/src/types/system.ts:118-140](../../../packages/shared/src/types/system.ts:118) — `SystemConfigSchema`, onde `tools` entra ao lado de `languages`/`skills`/`races`/`classes`.
- [US-132](./US-132-escolha-ferramenta-beneficio-tool-proficiency-background.md) — consumidor bloqueado, motivo direto desta story.
- [US-133](./US-133-catalogo-de-idiomas-do-sistema.md) — catálogo irmão, mesma investigação.
- [US-51](./US-51-kits-iniciais-do-srd.md) — precedente completo de domínio derivado com parser próprio e `MT_DOMAINS`.
