# US-51 — Kits iniciais derivados do SRD (equipamento de classe)

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** 🗂️ Backlog
**Depende de:** [US-47](./US-47-ingestao-srd-como-dado.md) (pipeline `sync`+`ingest`, artefato, overlay pt-BR, desacoplamento do Free) · [US-21](./US-21-sistemas-como-dado.md) (`config.startingKits` + `StartingKitItemSchema`)
**Relacionado:** [US-02](./US-02-inventario-do-personagem.md) (tabela de kits autorais, superada por esta story) · [US-38](./US-38-rolagens-ancoradas-na-ficha.md) (rolagens ancoradas no inventário) · [ADR 003](../../adr/003-sistemas-como-dado.md)
**Gera ADR:** acrescenta a seção "segunda fonte / licença dupla" ao **ADR 004** (ou ADR 005 se a decisão de licença crescer — ver §Decisão de arquitetura)
**Criada em:** 2026-07-14

---

## História

> **Como** desenvolvedora,
> **quero** derivar os **kits iniciais de classe** do dataset SRD, pelo mesmo pipeline da [US-47](./US-47-ingestao-srd-como-dado.md),
> **para que** o equipamento inicial deixe de ser flavor digitado à mão e passe a ser dado versionado de uma fonte de regra — assumindo, de forma explícita e isolada, a licença que essa fonte exige.

---

## Contexto e motivação

### Por que uma story separada da US-47

A [US-47](./US-47-ingestao-srd-como-dado.md) deriva atributos, perícias, features e magias do **Open5e** (SRD 5.2, **CC-BY-4.0**). Os kits **não couberam nela** por um motivo de licença, não de esforço:

- **O Open5e não expõe equipamento inicial.** Verificado: `CharacterClass` traz `hit_dice`, `saving_throws`, `features`, `caster_type` — nenhum campo de equipment; o `desc` da classe vem vazio.
- **A única fonte estruturada é o `5e-bits/5e-database`** (`starting_equipment_options`, 12/12 classes de 2024). Mas ele é **OGL 1.0a** — copyleft, com obrigação de incluir o texto integral da licença + Section 15 no repo.

Puxar os kits para dentro da US-47 arrastaria a OGL para uma story que é CC-BY puro, e misturaria no mesmo `config` (e no mesmo commit) dois materiais de licenças diferentes. **Isolar a decisão de licença numa story própria** é o que permite pesá-la sozinha: dá para shippar a US-47 sem OGL e decidir a US-51 (com OGL) depois, ou nunca.

### O que muda no jogo

Os kits de hoje **não são SRD** — são flavor autoral do MVP, alguns com itens que nem existem em 5e:

| Classe | Kit de hoje ([seed.ts](../../../apps/api/prisma/seed.ts)) | Kit do SRD 2024 (opção *a*) |
|---|---|---|
| Mago | Cajado arcano, Grimório, Vestes de mago, **Poção de mana**, Cantil | 2× Adaga, Bordão, Robe, Grimório, Mochila de Erudito |
| Guerreiro | Espada longa, Escudo, Armadura de couro, Mochila, Cantil | Cota de Malha, Espada Grande, Mangual, 8× Azagaia, Mochila de Masmorra |
| Patrulheiro | Arco longo, Aljava (20 flechas), Adaga, Armadura de couro leve, Cantil | Armadura de Couro Batido, Cimitarra, Espada Curta, Arco Longo, 20× Flecha, Aljava, Ramo de Visco, Mochila de Explorador |

**"Poção de mana" não existe em D&D 5e.** Derivar do SRD corrige isso — e muda o inventário inicial de **todo personagem novo** do `system-dnd5e`. É mudança de produto deliberada, que é justamente por que ela merece decisão própria e não um efeito colateral da US-47.

---

## Escopo

### Dentro do escopo

- **Estender `scripts/srd/sync.ts`** para baixar também `5e-bits/5e-database` @ **`v5.10.0`**, **só** o arquivo `src/2024/en/5e-SRD-Classes.json` (o repo inteiro tem monstros/itens/SRD 5.1 — nada disso é consumido, e puxar tudo só amplia a superfície OGL).
- **Estender `scripts/srd/ingest.ts`** para mapear `starting_equipment_options` → `config.startingKits` (`{ name, qty }`), aplicando o overlay pt-BR nos nomes de item.
- **Bloco de kit no overlay** `scripts/srd/locale/pt-BR.json` — os **37 itens distintos** das 12 classes, em português.
- **Alvo único `system-dnd5e`** (mesma regra da US-47): o kit derivado **não** entra no `system-free`. Isso exige **desacoplar `startingKits` do `freeConfig`** — a US-47 já desacoplou os outros campos; esta story fecha o último (hoje `freeConfig.startingKits` referencia `dnd5eKits`).
- **Licença OGL 1.0a versionada:** texto integral + Section 15 (cadeia de atribuição: nossa + `5e-database` + WotC), ao lado do artefato, **identificando que só os `startingKits` derivam de material OGL** — o resto do `config` segue CC-BY-4.0.

### Fora do escopo

- **A alternativa em ouro dos kits** — `starting_equipment_options` é "(a) itens **ou** (b) N PO". O projeto não tem modelo de dinheiro; o mapper pega **sempre a opção (a)** e descarta o ouro (ver Regra do kit).
- **Kits de background/espécie** — só equipamento de classe. Sem consumidor para o resto.
- **Retroagir personagens existentes** — inventário é materializado no `Character` na criação; ninguém já criado muda.

---

## Regra do kit: sempre a opção (a)

`starting_equipment_options` é uma **escolha**, não uma lista: *"(a) 2 Adagas, Bordão, Robe, Grimório, Mochila de Erudito e 5 PO; **ou** (b) 55 PO"*. Sem modelo de dinheiro no jogo:

- O mapper pega **sempre a opção (a)** e **descarta a alternativa em ouro** e as moedas soltas da própria opção (a).
- Os itens vêm aninhados `options_array` → `multiple` → `counted_reference`. Caminhar a árvore da opção (a) e colher os `counted_reference` (`of.name` + `count`) → `{ name, qty }`. **Sem regex em texto livre.**
- Cobertura verificada nas 12 classes: de 3 itens (Bárbaro) a 8 (Patrulheiro, Ladino). **37 itens distintos** — é o tamanho do bloco de kit no overlay.

**Normalização de classe:** o `5e-database` nomeia a classe como `wizard`/`fighter`; o `config` usa `mago`/`guerreiro`. O mapa dataset→canônica da US-47 ganha **a segunda forma de chave** (`wizard → mago`), para que kit e features do mesmo mago pousem na mesma entrada do `config`.

---

## Critérios de aceite

- [ ] `sync` baixa `5e-bits/5e-database` @ `v5.10.0`, **apenas** `2024/en/5e-SRD-Classes.json` (versão registrada no repo; `main` não é usado).
- [ ] `ingest` mapeia as 12 classes: cada `startingKits[classe]` vem da **opção (a)** do `starting_equipment_options`, em `{ name, qty }`, com nomes em PT pelo overlay. Ouro e moedas descartados.
- [ ] Os kits autorais de hoje (incl. "Poção de mana") **deixam de existir** no `system-dnd5e`; um personagem **novo** de mago recebe o kit do SRD.
- [ ] **Personagens já criados não mudam de inventário** (sem migração).
- [ ] **O Free não muda:** `system-free.startingKits` continua com os kits autorais de hoje. `freeConfig` **não referencia mais** `dnd5eKits` — passa a ter kit literal próprio. Verificável: `config` do Free idêntico antes e depois do ingest.
- [ ] O mapa cobre as 12 classes na chave do `5e-database`; classe sem entrada **falha o ingest**.
- [ ] O artefato segue passando em `SystemConfigSchema.parse()` e **byte-a-byte idêntico** entre duas rodadas (idempotente).
- [ ] **Licença OGL 1.0a versionada:** texto integral + Section 15, com o arquivo dizendo explicitamente que **só `startingKits`** deriva de material OGL; o restante é CC-BY-4.0.
- [ ] A tabela de kits da [US-02](./US-02-inventario-do-personagem.md) fica marcada como superada por esta story (já está marcada como histórica).

---

## Decisão de arquitetura

A US-51 é a que **traz a OGL 1.0a para o repo** — decisão de licença de peso, que a US-47 deliberadamente empurrou para cá. Duas opções de registro:

1. **Acrescentar ao ADR 004** uma seção "segunda fonte e licença dupla" (por que a OGL entrou, o que ela obriga, como o material fica identificado). Preferível se o ADR 004 já existir e a decisão for tratada como extensão natural da procedência do dado.
2. **ADR 005 próprio** — se a discussão de licença (aceitar OGL vs. transcrever os 12 kits do PDF SRD 5.2 CC à mão vs. manter kits autorais) merecer um documento dedicado com suas alternativas rejeitadas.

Sugestão: **decidir ao planejar a US-51**, com o ADR 004 já escrito em mãos — se a seção couber em dois parágrafos, é extensão; se as alternativas exigirem tabela própria, é ADR 005.

**Alternativas de licença a registrar (seja onde for):**
- **Aceitar OGL 1.0a** (esta story) — kit é dado derivado e re-executável, ao custo do texto da OGL + Section 15 no repo.
- **Transcrever do PDF SRD 5.2 (CC)** — o SRD 5.2 *contém* os kits no texto; transcrever 12 × ~5 itens à mão mantém o repo CC-puro, ao custo de digitação (o que a story inteira tenta evitar) e de não ser re-executável.
- **Manter os kits autorais** — zero licença nova, mas o kit continua sendo invenção ("Poção de mana"), não SRD.

---

## Referências no código

- [apps/api/prisma/seed.ts](../../../apps/api/prisma/seed.ts) — `dnd5eKits` (hoje manual, alvo da derivação); `freeConfig.startingKits` (referência a desacoplar).
- [apps/api/src/character/starting-inventory.ts](../../../apps/api/src/character/starting-inventory.ts) — `getStartingInventory` + `CLASS_SYNONYMS`; **inalterado** (o kit muda de conteúdo, não de mecanismo de resolução).
- [packages/shared/src/types/system.ts](../../../packages/shared/src/types/system.ts) — `StartingKitItemSchema` (`{ name, qty }`), destino do mapeamento.
- [scripts/srd/ingest.mjs](../../../scripts/srd/ingest.mjs) — pipeline da US-47, estendido aqui.
