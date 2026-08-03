# US-51 — Kits iniciais derivados do SRD (equipamento de classe)

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** [US-47](./US-47-ingestao-srd-como-dado.md) (pipeline `sync`+`ingest`, artefato, overlay pt-BR) · [US-21](./US-21-sistemas-como-dado.md) (`config.startingKits` + `StartingKitItemSchema`) · [US-99](./US-99-config-do-sistema-no-locale-ativo.md) (dois artefatos, um por locale)
**Relacionado:** [US-02](./US-02-inventario-do-personagem.md) (tabela de kits autorais, superada por esta story) · [US-38](./US-38-rolagens-ancoradas-na-ficha.md) (rolagens ancoradas no inventário) · [ADR 004](../../adr/004-origem-do-dado-de-sistema.md)
**Gera ADR:** não. Só uma **nota** no [ADR 004](../../adr/004-origem-do-dado-de-sistema.md) registrando que o kit passou a caber na fronteira CC-BY (ver §Decisão de arquitetura).
**Criada em:** 2026-07-14
**Revisada em:** 2026-08-03 — a premissa de licença caiu; ver a nota abaixo.

---

## História

> **Como** desenvolvedora,
> **quero** derivar os **kits iniciais de classe** do dataset SRD, pelo mesmo pipeline da [US-47](./US-47-ingestao-srd-como-dado.md), **nos dois locales**,
> **para que** o equipamento inicial deixe de ser flavor digitado à mão e passe a ser dado versionado da mesma fonte de regra que o resto do `config` — e para que quem joga em inglês pare de receber um inventário em português.

---

## Contexto e motivação

### Nota de 03/08/2026 — a OGL saiu da story

A versão anterior desta story dizia que *"o Open5e não expõe equipamento inicial"* e, por isso, montava a derivação em cima de uma **segunda fonte** (`5e-bits/5e-database`, **OGL 1.0a**), com texto integral de licença + Section 15 versionados no repo.

**A afirmação estava certa sobre o modelo errado.** `CharacterClass` de fato não tem campo de equipamento — traz `caster_type`, `document`, `hit_dice`, `name`, `primary_abilities`, `saving_throws`, `subclass_of`. Mas o equipamento inicial existe no Open5e, em **outro modelo**: `ClassFeature`, nas entradas de `feature_type: "CORE_TRAITS_TABLE"` — que a US-47 **já baixa e já ingere**.

Consequência: a story inteira cabe numa fonte só, **CC-BY-4.0**. Cai a segunda dependência, cai o pin `v5.10.0`, cai a OGL, cai a "licença dupla" e cai a decisão de licença que motivava um ADR próprio. O preço é parsear **texto livre** em vez de caminhar uma árvore de `counted_reference` — ver §Regra do kit.

### Onde o dado mora

Arquivo já sincronizado: `scripts/srd/_data/ClassFeature.json` (Open5e `v2.1.0`, ver [sync.mjs](../../../scripts/srd/sync.mjs)).

```
pk:      srd-2024_cleric_core-traits
fields:  { parent: "srd-2024_cleric", feature_type: "CORE_TRAITS_TABLE", desc: "|||\n|---|---|\n|Primary Ability|Wisdom|\n…\n|Starting Equipment|Choose A or B: (A) Chain Shirt, Shield, Mace, Holy Symbol, Priest's Pack, and 7 GP; or (B) 110 GP|" }
```

O `desc` é uma tabela markdown; o kit é a linha `|Starting Equipment|…|`. **Cobertura verificada: 12/12 classes base** têm a entrada `*_core-traits` com essa linha.

### O que muda no jogo

Os kits de hoje **não são SRD** — são flavor autoral do MVP, alguns com itens que nem existem em 5e:

| Classe | Kit de hoje ([seed.ts](../../../apps/api/prisma/seed.ts)) | Kit do SRD 2024 (opção A) |
|---|---|---|
| Mago | Cajado arcano, Grimório, Vestes de mago, **Poção de mana**, Cantil | 2× Adaga, Foco Arcano (Bordão), Túnica, Grimório, Mochila de Erudito |
| Guerreiro | Espada longa, Escudo, Armadura de couro, Mochila, Cantil | Cota de Malha, Espada Grande, Mangual, 8× Azagaia, Mochila de Masmorra |
| Patrulheiro | Arco longo, Aljava (20 flechas), Adaga, Armadura de couro leve, Cantil | Armadura de Couro Batido, Cimitarra, Espada Curta, Arco Longo, 20× Flecha, Aljava, Foco Druídico (ramo de visco), Mochila de Explorador |

**"Poção de mana" não existe em D&D 5e.** Derivar do SRD corrige isso — e muda o inventário inicial de **todo personagem novo**. É mudança de produto deliberada.

### O kit está no locale errado hoje

`startingKits` mora em `dnd5eProductFields` (no [seed.ts](../../../apps/api/prisma/seed.ts), antes desta story), objeto que os **dois** configs espalham: o `config` do sistema (base `en-US`) e o `configLocales['pt-BR']` recebem o **mesmo** kit, em português. O comentário logo acima diz isso de propósito — "os campos de produto são os MESMOS nos dois locales" ([US-99](./US-99-config-do-sistema-no-locale-ativo.md) "Fora do escopo").

Resultado: quem joga com `locale = en-US` cria um mago e ganha *Cajado arcano, Grimório, Vestes de mago, Poção de mana, Cantil*. Kit em PT numa ficha em EN.

Isso não é bug de outra story para consertar depois: é **consequência de o kit ser autoral**. No dia em que ele vira dado derivado, ele passa pelo mesmo caminho dos outros 6 campos — artefato por locale, overlay pt-BR, `configForLocale` na leitura — e o problema some junto. Por isso o locale entra no escopo **desta** story, não de uma seguinte.

---

## Escopo

### Dentro do escopo

- **`sync.mjs` não muda.** `ClassFeature.json` já está na lista de arquivos (US-47).
- **Estender `scripts/srd/ingest.mjs`** com `buildStartingKits(overlay, data.features, resolve)`: lê as entradas `CORE_TRAITS_TABLE`, extrai a linha `|Starting Equipment|`, parseia a **opção A** e devolve `{ [classe]: [{ name, qty }] }`.
- **`startingKits` sai do `STUB`** ([ingest.mjs:109](../../../scripts/srd/ingest.mjs:109)) e entra no **artefato**, nos dois locales (`srd-5e.config.en-US.json` e `srd-5e.config.pt-BR.json`), como qualquer outro campo derivado.
- **Novo domínio `kitItems` no overlay** `scripts/srd/locale/pt-BR.json` — os **42 itens distintos** (40 das 12 classes + 2 do kit `default`), em português. Forma de string crua (`"Chain Shirt": "Camisa de Malha"`), igual a `attributes`/`skills`, porque item só tem nome, não tem `description`.
- **`kitItems` fica FORA do `MT_DOMAINS`** (tradução automática da [US-52](./US-52-traducao-automatica-do-srd.md)): são 42 nomes fixos de equipamento, vocabulário de jogo — curadoria à mão, pelo mesmo motivo de `attributes` e `skills`. Item sem entrada cai no fallback EN e o `--strict` grita.
- **O kit `default` também é derivado**, em EN, dentro do ingest — ver §O kit `default`.
- **`seed.ts` para de declarar `dnd5eKits`**: `startingKits` passa a vir do `readSrdArtifact(locale)` junto com os outros campos derivados, e sai do `dnd5eProductFields`.
- **Base EN de verdade:** o artefato `en-US` sai com os nomes crus do dataset (`Chain Shirt`, `2× Dagger`), sem passar por overlay — é o que a [ADR 005](../../adr/005-locale-como-dimensao.md) chama de base nativa. O `pt-BR` é o overlay por cima.

### Fora do escopo

- **A alternativa em ouro** — o kit é "(A) itens **ou** (B) N PO". O projeto não tem modelo de dinheiro; o parser pega **sempre a opção A** e descarta o ouro (ver Regra do kit).
- **Kits de background/espécie** — só equipamento de classe. Sem consumidor para o resto.
- **Retroagir aventuras em andamento** — o kit é materializado em `CharacterState.inventory` quando a aventura começa; nenhuma partida já iniciada muda (ver §Inventário é congelado no início da aventura).
- **Escolha de kit pelo jogador** — a opção A é imposta pelo pipeline, não oferecida na criação de personagem.

---

## Regra do kit: sempre a opção A

`|Starting Equipment|Choose A or B: (A) …; or (B) 110 GP|`. Sem modelo de dinheiro no jogo, **só a opção A existe** para o pipeline: a alternativa em ouro é descartada, e as moedas soltas de dentro da própria opção A (`and 7 GP`) também.

### Etapas do parser

1. Achar a entrada `feature_type === 'CORE_TRAITS_TABLE'`; classe = `CLASS_MAP[fields.parent]`.
2. Da `desc`, pegar a linha que começa com `|Starting Equipment` e a 3ª célula.
3. **Reparar as palavras quebradas** (ver tabela abaixo) — antes de qualquer split.
4. Cortar o prefixo `Choose …:` e tudo a partir do primeiro `; ` (isso descarta B e, no guerreiro, B e C). Tirar o `(A) ` da frente.
5. Split por vírgula; de cada parte, tirar o `and ` inicial.
6. Descartar a parte que casa `/^\d+\s*GP$/`.
7. Cortar a escolha em prosa: tudo a partir de ` or `, ` of your choice` ou ` chosen for` — a primeira alternativa vence, coerente com "sempre a A".
8. Numeral líder vira `qty` (`8 Javelins` → `{ qty: 8 }`); sem numeral, `qty: 1`.
9. **Singularizar só quando havia numeral** (`Javelins` → `Javelin`). Sem essa condição, `Thieves' Tools` e `Artisan's Tools` — que são plural no singular — viram `Tool`.
10. Resolver o nome pelo overlay `kitItems`; sem entrada, fallback EN + registro em `fallbacks`.

### Armadilhas do dataset (todas medidas em 03/08/2026)

| Armadilha | Onde | Exemplo cru |
|---|---|---|
| Palavra partida por espaço (resíduo de extração de PDF) | druida, patrulheiro, bruxo | `Leather Ar mor`, `20 Ar rows`, `Ar cane Focus` |
| Três opções, não duas | guerreiro | `Choose A, B, or C:` |
| Quantidade prefixada, nome no plural | 6 classes | `4 Handaxes`, `8 Javelins`, `20 Arrows` |
| Plural que não é quantidade | ladino, monge | `Thieves' Tools`, `Artisan's Tools` |
| Parêntese faz parte do nome | druida, mago, feiticeiro, bruxo, patrulheiro | `Arcane Focus (crystal)`, `Book (occult lore)` |
| Escolha em prosa dentro da opção A | bardo, monge | `Musical Instrument of your choice`; `Artisan's Tools or Musical Instrument chosen for the tool proficiency above` |
| Ouro no fim da opção A | 12/12 | `…, and 7 GP` |

O reparo do item 3 é um **mapa fixo e explícito** (`Ar mor`→`Armor`, `Ar rows`→`Arrows`, `Ar cane`→`Arcane`), não uma heurística de "junta letra solta": heurística engole nome legítimo em silêncio num bump, mapa explícito falha alto. Um bump que traga uma quebra nova aparece como item órfão no overlay ou como fallback EN — os dois relatórios que a US-47 já imprime.

### Resultado esperado (12/12, opção A, ouro descartado)

| Classe | Kit derivado |
|---|---|
| barbarian | Greataxe, 4× Handaxe, Explorer's Pack |
| bard | Leather Armor, 2× Dagger, Musical Instrument, Entertainer's Pack |
| cleric | Chain Shirt, Shield, Mace, Holy Symbol, Priest's Pack |
| druid | Leather Armor, Shield, Sickle, Druidic Focus (Quarterstaff), Explorer's Pack, Herbalism Kit |
| fighter | Chain Mail, Greatsword, Flail, 8× Javelin, Dungeoneer's Pack |
| monk | Spear, 5× Dagger, Artisan's Tools, Explorer's Pack |
| paladin | Chain Mail, Shield, Longsword, 6× Javelin, Holy Symbol, Priest's Pack |
| ranger | Studded Leather Armor, Scimitar, Shortsword, Longbow, 20× Arrow, Quiver, Druidic Focus (sprig of mistletoe), Explorer's Pack |
| rogue | Leather Armor, 2× Dagger, Shortsword, Shortbow, 20× Arrow, Quiver, Thieves' Tools, Burglar's Pack |
| sorcerer | Spear, 2× Dagger, Arcane Focus (crystal), Dungeoneer's Pack |
| warlock | Leather Armor, Sickle, 2× Dagger, Arcane Focus (orb), Book (occult lore), Scholar's Pack |
| wizard | 2× Dagger, Arcane Focus (Quarterstaff), Robe, Spellbook, Scholar's Pack |

De 3 itens (bárbaro) a 8 (patrulheiro, ladino). **40 itens distintos** — é o tamanho do bloco `kitItems` no overlay.

**Chave de classe:** o `fields.parent` é `srd-2024_cleric`, exatamente a chave do **`CLASS_MAP` que já existe** no ingest ([ingest.mjs:50](../../../scripts/srd/ingest.mjs:50)). Nada de mapa novo, e nada de "segunda forma de chave": desde a [US-54](./US-54-chaves-canonicas-em-ingles.md) a chave canônica já é EN (`cleric`, não `clerigo`), então kit e features do mesmo clérigo pousam na mesma entrada sem tradução de chave.

---

## Os dois locales

O kit segue exatamente o caminho que a [US-99](./US-99-config-do-sistema-no-locale-ativo.md) já abriu para os outros campos derivados. Nada de mecanismo novo:

| Etapa | `en-US` | `pt-BR` |
|---|---|---|
| `buildConfig` | overlay `{}` → nome cru do dataset | overlay `kitItems` → nome PT, fallback EN por item |
| Artefato | `srd-5e.config.en-US.json` | `srd-5e.config.pt-BR.json` |
| Seed | `dnd5eConfig` → coluna `config` | `dnd5eConfigPtBr` → `configLocales['pt-BR']` |
| Leitura | `configForLocale(system, locale)`, locale do dono | idem |
| Início de aventura | `getStartingInventory(config, classKey)` recebe o config **já resolvido** no locale do dono ([adventure.service.ts:85](../../../apps/api/src/adventure/adventure.service.ts:85)) e o resultado vai para `CharacterState.inventory` | idem |

**`getStartingInventory` não muda.** Ele já recebe o `SystemConfig` do locale certo — o mecanismo é locale-aware desde a US-99; era o *dado* que estava fixo em PT.

### Fallback por item, não por kit

O `resolve` do ingest é por chave. Item sem entrada em `kitItems` cai no nome EN **sozinho**, e o kit sai misto (*"Cota de Escamas, Escudo, Mace"*). Consequências assumidas:

- Os 42 itens entram no overlay **na mesma mudança** que liga o `buildStartingKits`. Um kit misto em produção é regressão visível na ficha, não um "TODO de tradução".
- `pnpm srd:ingest --strict` barra o build enquanto faltar item — é o guarda que garante o de cima.
- O relatório de órfãos da US-47 pega o inverso: entrada em `kitItems` que nenhum item do dataset consome (típico de bump que renomeia item).

### Inventário é congelado no início da aventura

> **Correção de 03/08/2026 (pós-implementação).** A versão anterior desta seção — e a linha equivalente na [US-02](./US-02-inventario-do-personagem.md), de onde ela veio — dizia que *"o inventário é materializado no `Character` na criação"*. **Não é.** `Character` não tem coluna `inventory` (verificado no banco); o kit é resolvido em `AdventureService.create` e gravado em **`CharacterState.inventory`**, quando a **aventura** começa.

O que isso muda de verdade:

- **Quem congela é a aventura, não o personagem.** Um personagem criado antes desta story que inicie uma aventura **nova** recebe o kit do SRD. O kit velho sobrevive só nos `CharacterState` que já existem.
- **O locale do congelamento é o do início da aventura**, resolvido em [adventure.service.ts:85](../../../apps/api/src/adventure/adventure.service.ts:85). Trocar de idioma depois não re-traduz o inventário daquela partida — mesmo comportamento que a US-99 aceita para o resto do dado materializado.

Não há migração e não há re-tradução na leitura.

---

## O kit `default`

`SystemConfigSchema` exige a chave `default` em `startingKits`, e o dataset não tem "classe padrão" para derivar: o `default` de hoje é autoral (*Adaga, Armadura de couro, Mochila, Cantil*, no [seed.ts](../../../apps/api/prisma/seed.ts) até esta story) e cobre sistema custom ou classe fora do catálogo.

Ele **não pode ficar no seed** depois desta story: seria `startingKits` vindo de dois lugares, e o `default` voltaria a ser PT nos dois locales — exatamente o defeito que a story conserta.

**Decisão:** o `default` vira um literal **em EN** dentro do `ingest.mjs`, ao lado do `ATTR_RANGE` (mesmo precedente: valor de produto que mora no ingest só para compor o campo), e atravessa o overlay como qualquer outro item:

```js
// Fallback de classe fora do catálogo. Não vem do SRD (não há "classe padrão" no dataset);
// mora aqui, em EN, para passar pelo mesmo overlay dos outros itens — no seed ele seria PT
// nos dois locales. Nunca devolvemos inventário vazio.
const DEFAULT_KIT = [
  { name: 'Dagger', qty: 1 },
  { name: 'Leather Armor', qty: 1 },
  { name: 'Backpack', qty: 1 },
  { name: 'Waterskin', qty: 1 },
]
```

`Dagger` e `Leather Armor` já estão entre os 40 do SRD; `Backpack` e `Waterskin` são os **2 itens a mais** no overlay — daí 42.

---

## O kit e o sistema Free

Hoje o Free **compartilha** os kits do D&D: `buildFreeConfig` espalha `dnd5eProductFields`, que inclui `startingKits: dnd5eKits` (no [seed.ts](../../../apps/api/prisma/seed.ts), antes desta story). O comentário ali diz que os kits ficam de fora da fronteira CC "porque são OGL" — **essa justificativa morre com esta story** e o comentário precisa ser corrigido junto.

**Decisão: o Free herda o kit do SRD, como herda os outros campos do artefato.** É o que o [ADR 004 §3.1](../../adr/004-origem-do-dado-de-sistema.md) já estabeleceu para conteúdo CC-BY, é o comportamento que o `seed.ts` já tem hoje (os dois sistemas usam o mesmo kit), e mantém o diff no tamanho de trocar a origem do dado.

> **Alternativa registrada:** dar ao Free um kit literal próprio (os autorais de hoje) e deixar só o `system-dnd5e` com o do SRD. Era o plano da versão anterior desta story, quando o motivo era licença. Sem a OGL, o motivo restante seria de produto ("o Free é sistema sem regras, não deveria ter kit de 5e") — decisão separável, que não precisa desta story para acontecer.

---

## Critérios de aceite

- [x] `sync.mjs` **não muda** — nenhuma fonte nova, nenhum download novo.
- [x] `ingest` mapeia as 12 classes a partir de `ClassFeature` `CORE_TRAITS_TABLE`: cada `startingKits[classe]` vem da **opção A**, em `{ name, qty }`. Ouro (a alternativa e as moedas soltas) descartado.
- [x] As 7 armadilhas da tabela acima estão cobertas por teste em `ingest.test.mjs`, com o texto cru do dataset como entrada — em especial `Ar mor`, o `Choose A, B, or C` do guerreiro e o `Thieves' Tools` que **não** pode singularizar.
- [x] `startingKits` sai do `STUB` e entra no artefato **nos dois locales**; nomes em PT vêm do overlay `kitItems`, com fallback EN registrado como qualquer outro domínio.
- [x] **`srd-5e.config.en-US.json` traz os kits em inglês** (`Chain Shirt`, `Dagger`) e **`srd-5e.config.pt-BR.json` em português**, com as mesmas chaves de classe e as mesmas quantidades nos dois. Verificável: as 12 chaves e os `qty` são idênticos entre os artefatos; só os `name` diferem.
- [x] **Nenhum nome PT sobra no config `en-US`**: um personagem novo de mago criado com `locale = en-US` recebe *2× Dagger, Arcane Focus (Quarterstaff), Robe, Spellbook, Scholar's Pack* — não mais *Cajado arcano / Poção de mana*.
- [x] Os **42 itens** estão no `kitItems` na mesma mudança que liga a derivação: `pnpm srd:ingest --strict` passa, e nenhum kit sai misto EN/PT.
- [x] O kit `default` também sai nos dois locales, pelo mesmo caminho — não sobra literal PT no `seed.ts`.
- [x] Classe base sem entrada `CORE_TRAITS_TABLE`, ou entrada sem a linha `|Starting Equipment|`, **falha o ingest alto** (mesmo tratamento do `CLASS_MAP`).
- [x] `seed.ts` não declara mais `dnd5eKits`; `startingKits` vem do `readSrdArtifact(locale)` e **sai** do `dnd5eProductFields`, cujo comentário ("os campos de produto são os MESMOS nos dois locales") passa a valer só para os que sobraram. O comentário sobre "kits do SRD são OGL" é corrigido.
- [x] Os kits autorais de hoje (incl. "Poção de mana") **deixam de existir**; um personagem **novo** de mago recebe o kit do SRD.
- [x] **Aventuras já iniciadas não mudam de inventário** (sem migração) — inclusive as de quem trocar de locale depois. Personagem antigo que **começar** uma aventura nova recebe o kit do SRD.
- [x] Os dois artefatos seguem passando em `SystemConfigSchema.parse()` e **byte-a-byte idênticos** entre duas rodadas (idempotente).
- [x] `getStartingInventory` continua funcionando sem alteração — o kit muda de conteúdo e de locale, não de mecanismo de resolução.
- [x] Nota no [ADR 004](../../adr/004-origem-do-dado-de-sistema.md) registrando a correção de procedência (kit é CC-BY, não OGL; nenhuma segunda fonte entrou).
- [x] A tabela de kits da [US-02](./US-02-inventario-do-personagem.md) fica marcada como superada por esta story (já está marcada como histórica).

---

## Decisão de arquitetura

**Não gera ADR.** A decisão de licença que justificaria um — aceitar OGL 1.0a para ter os kits — **deixou de existir** quando o dado apareceu na fonte CC-BY que o projeto já usa. O que sobra é uma correção de procedência, que cabe em nota no ADR 004.

Alternativas descartadas, para o registro:

| Alternativa | Por que não |
|---|---|
| **Segunda fonte `5e-bits/5e-database` (OGL 1.0a)** — dá `starting_equipment_options` estruturado, sem parsing de texto | Traz a OGL 1.0a (texto integral + Section 15) e uma segunda dependência pinada, para obter um dado que a fonte CC-BY **já tem**. O parsing que ela evitaria são ~10 linhas com teste. |
| **Transcrever os 12 kits do PDF SRD 5.2 à mão** | Mantém o repo CC-puro, mas é digitação (o que a story tenta evitar) e não é re-executável num bump. |
| **Manter os kits autorais** | Zero trabalho, mas o kit segue sendo invenção ("Poção de mana"), não SRD. |

---

## Referências no código

- [scripts/srd/sync.mjs](../../../scripts/srd/sync.mjs) — `ClassFeature.json` já na lista; **inalterado**.
- [scripts/srd/ingest.mjs](../../../scripts/srd/ingest.mjs) — `CLASS_MAP` (chave `srd-2024_*`, reusada), `STUB` (de onde `startingKits` sai), `buildConfig` (onde `buildStartingKits` entra), `makeResolver`/`resolve` (fallback + relatório de órfãos).
- [scripts/srd/locale/pt-BR.json](../../../scripts/srd/locale/pt-BR.json) — novo bloco `kitItems` (42 entradas).
- [apps/api/prisma/seed.ts](../../../apps/api/prisma/seed.ts) — `dnd5eKits` (some), `dnd5eProductFields` (perde `startingKits`), `buildFreeConfig` (comentário da OGL a corrigir).
- [apps/api/src/character/starting-inventory.ts](../../../apps/api/src/character/starting-inventory.ts) — `getStartingInventory`; **inalterado**.
- [apps/api/src/character/character.service.ts](../../../apps/api/src/character/character.service.ts) — `configForLocale(system, locale)` na criação: é ele que já entrega o config no locale do dono. **Inalterado**.
- [apps/api/src/system/system-locale.ts](../../../apps/api/src/system/system-locale.ts) — `configForLocale` + `localeOfUser`. **Inalterado**.
- [packages/shared/src/types/system.ts](../../../packages/shared/src/types/system.ts) — `StartingKitItemSchema` (`{ name, qty }`), destino do mapeamento.
