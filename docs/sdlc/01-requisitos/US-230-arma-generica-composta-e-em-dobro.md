# US-230 — Arma genérica composta ("e um escudo") e em dobro ("duas armas") no equipamento inicial

**Épico:** 1 — Personagem
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** [US-229](./US-229-escolha-especifica-de-arma-no-equipamento-inicial.md) (`resolveEquipmentSlots`/`flattenWeaponOptions`/`parseGenericWeaponItem` em [starting-kit.ts:43-129](../../../packages/shared/src/starting-kit.ts:43) — o mecanismo que esta story estende, não substitui) · [US-228](./US-228-categoria-simples-marcial-no-catalogo-de-armas.md) (`config.weapons[].category`/`weaponType`, catálogo de onde vem o pool)

**Criada em:** 2026-09-10

---

## Nota sobre esta story

Aberta a partir de um bug reportado pela mantenedora logo após o merge da US-229: a etapa
`class` do Guerreiro, Paladino e Patrulheiro ainda mostra texto genérico cru no `<select>` de
equipamento (`"Arma Marcial e Um Escudo"`, `"Duas Armas Marciais"`, `"Duas Armas Simples Corpo
a Corpo"`) em vez de uma `<option>` por arma. A US-229 **não regrediu** — ela nunca cobriu esses
3 textos; o §Contexto dela documentou só 3 padrões ("varredura ad-hoc... só 3 padrões de texto
aparecem"), mas essa varredura não alcançou `choices` fora do formato "item único, nome
idêntico a um dos 3 padrões". Esta story fecha a lacuna com uma segunda varredura, mais ampla.

---

## História

> **Como** jogadora criando um Guerreiro, Paladino ou Patrulheiro,
> **quero** que o slot "arma marcial e escudo", "duas armas marciais" ou "duas armas simples
> corpo a corpo" também vire uma `<option>` por arma de verdade — a mesma resolução que a
> US-229 já deu pra "qualquer arma simples"/"qualquer arma marcial corpo a corpo",
> **para que** meu personagem nunca comece o jogo com o texto cru "Duas Armas Marciais" no
> inventário, e eu escolha a arma real (ex. "Machado de Batalha e Machado de Batalha") como já
> escolho nos outros slots genéricos.

---

## Contexto e motivação

Varredura completa (script ad-hoc, 2026-09-10) sobre `startingEquipmentChoices` das 13 classes
em `srd-5e.config.en-US.json`/`.pt-BR.json`, listando TODO item de `fixed`+`choices` (não só os
que já batiam com os 3 padrões da US-229) — achou 3 textos que `parseGenericWeaponItem`
([starting-kit.ts:58-60](../../../packages/shared/src/starting-kit.ts:58)) não reconhece, em 3
classes:

| Classe | Slot | Texto EN | Texto PT | Alternativa nomeada (irmã, já funciona) |
|---|---|---|---|---|
| Guerreiro (`fighter`) | `choices[1]` (correção: `choices[0]` do Guerreiro é o slot de armadura, "Chain Mail"/"Leather Armor + Longbow" — confirmado direto no JSON) | `Martial Weapon and a Shield` | `Arma Marcial e Um Escudo` | nenhuma nomeada — a outra alternativa deste MESMO slot é `Two Martial Weapons` (também quebrada, ver linha abaixo) |
| Guerreiro (`fighter`) | `choices[1]` (2ª alternativa do mesmo slot) | `Two Martial Weapons` | `Duas Armas Marciais` | — |
| Paladino (`paladin`) | `choices[0]` | `Martial Weapon and a Shield` | `Arma Marcial e Um Escudo` | `Two Martial Weapons` (mesma coluna acima) |
| Paladino (`paladin`) | `choices[0]` (2ª alternativa do mesmo slot) | `Two Martial Weapons` | `Duas Armas Marciais` | — |
| Patrulheiro (`ranger`) | `choices[1]` | `Two Simple Melee Weapons` | `Duas Armas Simples Corpo a Corpo` | `Two Shortswords` / `Duas Espadas Curtas` (nomeada, já funciona — é literal, não genérica) |

Confirmado nas duas capturas de tela da mantenedora: o `<select>` do Paladino mostra
"Arma Marcial e Um Escudo" / "Duas Armas Marciais" como as DUAS únicas opções (nenhuma arma
expandida); o do Patrulheiro mostra "Duas Espadas Curtas" / "Duas Armas Simples Corpo a Corpo"
do mesmo jeito — o segundo caso prova que o bug não é "slot inteiro ignorado" (a alternativa
nomeada ao lado renderiza normal), é especificamente estes 3 textos não baterem no parser.

**Por que `parseGenericWeaponItem` não reconhece:** o mapa `GENERIC_WEAPON_ITEMS`
([starting-kit.ts:49-56](../../../packages/shared/src/starting-kit.ts:49)) só tem as 3 chaves
que a varredura da US-229 achou (`Any Simple Weapon`, `Any Simple Melee Weapon`,
`Any Martial Melee Weapon`, e os 3 equivalentes PT) — comparação é `===` exato contra o `name`
inteiro do item. Os 3 textos novos não são só "categoria+tipo faltando no mapa", são **duas
formas estruturais diferentes** que a US-229 nunca modelou:

1. **Composto com item NÃO-genérico embutido** — `"Martial Weapon and a Shield"` é UM item de
   texto só (`{name, qty: 1}`), mas descreve DOIS objetos: uma arma marcial à escolha + um
   escudo fixo. `config.weapons` não tem chave nenhuma pra "escudo" (é armadura, não arma —
   confirmado: `cfg.weapons.find(w => /escudo|shield/i.test(w.label))` devolve `undefined`).
   Resolver certo significa separar as duas partes: a arma vira N `<option>`, o escudo
   permanece o MESMO texto literal em toda opção (não existe catálogo pra resolvê-lo contra).
2. **Quantidade embutida no texto, não no campo `qty`** — `"Two Martial Weapons"`/
   `"Duas Armas Marciais"` é `{name: "Two Martial Weapons", qty: 1}`: o `qty: 1` é do BALDE
   (uma alternativa), não da arma. O "duas" mora dentro do `name`. Resolver certo significa a
   option expandida virar `[{name: arma.label, qty: 2}]` — dobro da MESMA arma escolhida, não
   duas armas diferentes.

**Correção a uma afirmação da US-229 §Contexto:** aquela story documentou "nunca 'martial' sem
qualificador de tipo" — verdade só pro formato QUE ELA cobria (alternativa solo, item único
igual a um dos 3 padrões). `"Martial Weapon and a Shield"` e `"Two Martial Weapons"` SÃO
`category: 'martial'` sem `weaponType` (nem melee nem ranged) — a REGRA 5e real permite
qualquer arma marcial (as duas mãos, à distância, tanto faz) nesses dois casos específicos.
Não é regressão da US-229, é escopo que ela nunca alcançou.

**Por que só 3 classes, e por que Guerreiro não apareceu na US-229:** a US-226/US-229 sempre
usaram Guerreiro como exemplo em TESTE (`starting-kit.test.ts`, `character.service.test.ts`),
mas com fixtures SIMPLIFICADOS ("Cota de Malha"/"Arma Marcial" — texto que não existe no
dataset real). O Guerreiro de VERDADE no config gerado pelo ingest usa os mesmos 2 textos
quebrados do Paladino — o bug sempre esteve nele também, só não apareceu em teste nenhum
porque nenhum teste usou o dataset real pra essa classe. Bardo/Clérigo/Druida/Monge/
Feiticeiro/Bruxo/Bárbaro não têm nenhum dos 2 padrões (confirmado na varredura completa,
tabela acima é exaustiva); Ladino e Mago não têm item genérico de arma nenhum no kit (US-229
§Contexto já tinha essa lista, sem mudança).

**Adição (mantenedora, 2026-09-10) — alternativa NOMEADA "Duas <Arma>" ganha o mesmo rótulo
"(2)" das opções expandidas.** Não é mais só os 3 textos genéricos quebrados: pelo mockup desta
story (Patrulheiro), a mantenedora decidiu que a alternativa NOMEADA irmã (`Two Shortswords`/
`Duas Espadas Curtas` — já resolvia certo, só o RÓTULO ficava cru) também deve virar
"Espada Curta (2)", pro mesmo padrão visual das opções expandidas dos 2 novos parsers. Achado
ao aplicar essa regra: 2 outras alternativas nomeadas no MESMO formato "Two `<Arma
concreta>`", fora da tabela original (não são texto genérico — não precisavam de
`parseGenericWeaponItem`, sempre resolveram certo, só o RÓTULO era o texto SRD cru):

| Classe | Slot | Texto EN | Texto PT | Alternativa irmã no mesmo slot |
|---|---|---|---|---|
| Bárbaro (`barbarian`) | `choices[1]` | `Two Handaxes` | `Duas Machadinhas` | `Any Simple Weapon`/`Qualquer Arma Simples` (genérica, já resolvida pela US-229) |
| Guerreiro (`fighter`) | `choices[2]` | `Two Handaxes` | `Duas Machadinhas` | `Light Crossbow and 20 Bolts`/`Besta Leve e 20 Virotes` (nomeada, concreta, sem genérico neste slot) |

Diferença importante pro parser: aqui NÃO tem categoria/tipo pra casar contra `config.weapons`
— a arma já é conhecida (`handaxe`/`shortsword`). É troca de RÓTULO de uma opção já concreta,
não expansão de genérico em N `<option>`. Ver §Escopo e §Notas de implementação.

---

## Escopo

### Dentro do escopo

- **Padrão composto ("arma + item fixo não-catalogado"):** reconhecer
  `"Martial Weapon and a Shield"`/`"Arma Marcial e Um Escudo"` (as únicas 2 ocorrências no
  dataset, Guerreiro e Paladino — mesmo texto exato nos dois) e expandir em uma `<option>` por
  arma marcial (sem filtro de `weaponType` — nenhum qualificador no texto) + o escudo, como
  companheiro FIXO em toda opção expandida (nunca resolvido contra catálogo — não existe um).
- **Padrão em dobro ("duas armas X"):** reconhecer `"Two Martial Weapons"`/`"Duas Armas
  Marciais"` (Guerreiro, Paladino) e `"Two Simple Melee Weapons"`/`"Duas Armas Simples Corpo a
  Corpo"` (Patrulheiro) e expandir em uma `<option>` por arma da categoria/tipo casada, cada
  opção com **2 unidades da MESMA arma** (`qty: 2`), cruzado com `weaponProficiencies` da
  classe — mesmo filtro de proficiência que a US-229 já aplica (nenhuma das 3 classes aqui tem
  `categories: []`, então na prática é só filtro de categoria+tipo, sem lista nomeada — mas a
  função não deve assumir isso, deve reusar o MESMO cruzamento de `matchingWeapons`).
- **Reaproveitar `resolveEquipmentSlots`/`flattenWeaponOptions`/`matchingWeapons` (US-229):**
  esta story ESTENDE o parser e o achatamento existentes — não cria um mecanismo paralelo.
  Patrulheiro (`choices[1]`, só 1 das 2 alternativas é genérica) mantém 1 slot/`<select>` só,
  igual ao padrão da US-229. **Guerreiro e Paladino são exceção:** o slot original (2
  alternativas, AMBAS genéricas — "arma+escudo" e "em dobro") tem 2 RESPOSTAS possíveis, mas a
  UI mostra **1 radio (modo) + 1 `<select>` de arma compartilhado**, não 2 `<select>` repetindo
  a mesma lista de 23 armas marciais duas vezes (decisão do mockup, 2026-09-10 — ver §Referência
  à origem) — resolve §Questões em aberto #2. Trocar o radio NÃO reseta a arma escolhida no
  select (mesmo valor serve pros dois modos); só o texto do resultado muda ("`<Arma>`, Escudo"
  vs. "`<Arma>` (2)"). Por baixo, `resolveEquipmentSlots` continua com 2 alternativas genéricas
  nesse `choices[]` original — fica pra implementação decidir se isso persiste como 2
  `EquipmentChoiceSlot` (radio escolhe QUAL índice de `equipmentChoices` vale, o outro é
  ignorado) ou como 1 slot novo com um campo de modo — nos dois casos, sem 2 `<select>` visíveis
  ao mesmo tempo (ver §Referências no código).
- **Persistência:** `getStartingInventory` devolve a arma (ou arma+escudo, ou arma×2) real,
  nunca o texto composto/em-dobro cru — mesmo critério de aceite da US-229, estendido aos 2
  padrões novos.
- **Etapa `review` e ficha (`GameView`):** herdam o fix pelo mesmo caminho que a US-229 já
  ligou (`previewFullKit` → `getStartingInventory`) — sem código novo nessas telas, só
  verificação (mesma disciplina da US-229 §Escopo).
- **Testes:** Guerreiro (`choices[1]`) e Paladino (`choices[0]`) — os dois com AS MESMAS 2
  alternativas quebradas, agora esperando 2 slots resolvidos, não 1 — e Patrulheiro
  (`choices[1]`, 1 slot só) — os 3 casos reais da tabela acima, contra dataset real ou fixture
  fiel a ele (não simplificado, pra não repetir o motivo do Guerreiro ter escapado da US-229).
- **Rótulo "(2)" na alternativa nomeada "Duas `<Arma>`":** `Two Shortswords`/`Duas Espadas
  Curtas` (Patrulheiro), `Two Handaxes`/`Duas Machadinhas` (Bárbaro `choices[1]`, Guerreiro
  `choices[2]`) passam a exibir "Espada Curta (2)"/"Machadinha (2)" — rótulo da arma (via
  `config.weapons`) + "(2)", nunca o texto SRD cru. Mesma mudança na PERSISTÊNCIA:
  `getStartingInventory` grava `{name: 'Espada Curta', qty: 2}`, não `{name: 'Two Shortswords',
  qty: 1}`. Guerreiro `choices[2]` (besta leve/duas machadinhas) é slot 100% nomeado, sem
  alternativa genérica — não precisa dividir em 2 slots (§Escopo acima), só troca o RÓTULO de
  uma das 2 opções já existentes.

### Fora do escopo

- **Reabrir a US-229** (já implementada e mesclada) — esta story só adiciona 2 formas novas ao
  parser dela, não questiona o que já funciona (os 3 padrões solo continuam intactos).
- **Escolher duas armas diferentes no padrão "em dobro"** — confirmado pela mantenedora
  (2026-09-10): as duas armas são a mesma. "Duas Armas Marciais"/"Two Simple Melee Weapons" viram
  1 `<select>`, `qty: 2` da mesma arma escolhida — não 2 armas diferentes, não 2 `<select>`. Ver
  §Questões em aberto #1 (resolvida).
- **Fundo (`background`) e equipamento racial** — mesmo corte da US-229 (não confirmado se
  `backgroundEquipment` tem qualquer um dos 2 padrões; se tiver, é story separada).
- **Vasculhar TODO texto de equipamento por outras formas ainda não achadas.** A varredura desta
  story listou item por item as 13 classes (tabela completa em §Contexto) — não é uma garantia
  formal de que não existe um 4º padrão, mas é exaustiva sobre os dados atuais do SRD 5e.

---

## Critérios de aceite

- [ ] Guerreiro (`choices[1]` original): 1 radio de modo ("Arma marcial e um escudo" / "Duas
      armas marciais") + **1 único `<select>`** com uma `<option>` por arma marcial do catálogo
      (sem filtro de `weaponType`), compartilhado pelos 2 modos — nunca 2 `<select>` repetindo a
      mesma lista de armas. Modo "escudo" resolve arma + "Escudo" (ex. "Machado de Batalha,
      Escudo") — nunca o texto "Arma Marcial e Um Escudo". Modo "em dobro" resolve a MESMA arma
      escolhida em dobro (ex. "Machado de Batalha (2)") — nunca o texto "Duas Armas Marciais".
      Trocar de modo preserva a arma já escolhida no select.
- [ ] Paladino (`choices[0]` original): mesmo comportamento do Guerreiro acima — 1 radio + 1
      `<select>` compartilhado (texto-fonte idêntico nos dois).
- [ ] Patrulheiro, slot 1: o `<select>` lista "Espada Curta (2)" (era "Duas Espadas Curtas" —
      já resolvia certo, rótulo agora no mesmo padrão) MAIS uma `<option>` por arma simples
      corpo a corpo do catálogo em dobro (ex. "Adaga (2)") — nunca "Duas Espadas Curtas" nem
      "Duas Armas Simples Corpo a Corpo" crus.
- [ ] Bárbaro, `choices[1]`: a opção nomeada mostra "Machadinha (2)" — era "Duas Machadinhas" —
      ao lado de "Qualquer Arma Simples" já expandida pela US-229. Nenhuma outra mudança nesse
      slot (a expansão genérica já funciona).
- [ ] Guerreiro, `choices[2]` (besta leve OU duas machadinhas — slot sem alternativa genérica,
      não se divide): a opção nomeada mostra "Machadinha (2)" — era "Duas Machadinhas".
- [ ] Escolher a option "arma + escudo" resolve os DOIS itens no inventário final (arma real +
      "Escudo"), nunca só um dos dois.
- [ ] Escolher a option "em dobro" resolve com `qty: 2` no inventário final — nunca dois itens
      separados de `qty: 1` cada, nunca `qty: 1` só.
- [ ] Etapa `review` (linha "Kit") e ficha (`GameView`) mostram o resultado resolvido nas 3
      classes — nunca "Arma Marcial e Um Escudo"/"Duas Armas Marciais"/"Duas Armas Simples
      Corpo a Corpo" cru. Mesma disciplina da US-229: verificar a TELA, não só a função.
  - Decidido (mantenedora, 2026-09-10): "duas armas marciais" é 2 cópias da MESMA arma
    escolhida, não duas armas diferentes — ver §Questões em aberto #1 (resolvida). Critério de
    aceite fechado.
- [ ] Nenhuma classe/slot que já funcionava (US-229: Bárbaro, Bardo, Clérigo, Druida, Monge,
      Feiticeiro, Bruxo) muda de comportamento.

---

## Notas de implementação (proposta, não vinculante)

- **`GenericWeaponItem` ganha 2 campos opcionais** — `qty?: number` (default 1, vira 2 pro
  padrão "Two X") e `companion?: string` (default nenhum, vira `"Escudo"`/`"Shield"` pro padrão
  composto) — ou uma forma equivalente que `flattenWeaponOptions` consiga ler pra montar a
  option expandida certa. `GENERIC_WEAPON_ITEMS` ganha as chaves novas:
  ```
  'Martial Weapon and a Shield'         → { category: 'martial', companion: 'Shield' }
  'Arma Marcial e Um Escudo'            → { category: 'martial', companion: 'Escudo' }
  'Two Martial Weapons'                 → { category: 'martial', qty: 2 }
  'Duas Armas Marciais'                 → { category: 'martial', qty: 2 }
  'Two Simple Melee Weapons'            → { category: 'simple', weaponType: 'melee', qty: 2 }
  'Duas Armas Simples Corpo a Corpo'    → { category: 'simple', weaponType: 'melee', qty: 2 }
  ```
  Repete a mesma disciplina "mapa, não regex" da US-229 (só 6 strings concretas a mais,
  confirmadas na varredura desta story).
- **`flattenWeaponOptions` muda a linha que monta a option expandida**
  ([starting-kit.ts:101](../../../packages/shared/src/starting-kit.ts:101), hoje
  `matchingWeapons(...).map((w) => [{ name: w.label, qty: option[0]!.qty }])`) pra montar
  `[{ name: w.label, qty: generic.qty ?? option[0]!.qty }, ...(generic.companion ? [{ name:
  generic.companion, qty: 1 }] : [])]` — sem tocar `matchingWeapons`/`parseGenericWeaponItem`
  no resto (o cruzamento com `weaponProficiencies` continua idêntico).
- **`companion` como STRING LITERAL, nunca resolvido contra catálogo** — não existe
  `config.armor`/`config.shields` neste projeto (armadura é só texto solto nos kits, como
  "Cota de Malha"); inventar um catálogo de armadura pra só 1 item (escudo) é escopo muito
  maior que esta story. Ver `MEMENTO_ITEM_LABEL` ([starting-kit.ts:61-64](../../../packages/shared/src/starting-kit.ts:61))
  como precedente de rótulo fixo por locale sem catálogo por trás — `companion` provavelmente
  precisa da MESMA forma (`Record<Locale, string>`) em vez de string única, já que o dado vem
  de configs pt-BR/en-US separados (confirmar se `flattenWeaponOptions` já sabe o locale ativo,
  ou se basta o texto vir PRONTO do próprio `config` sendo processado — cada locale já carrega
  seu próprio JSON, então talvez baste a chave do mapa cobrir os 2 idiomas com o `companion` já
  no idioma certo, sem precisar de `Record<Locale,_>` — confirmar ao implementar).
- **Rótulo "(2)" da alternativa NOMEADA** — mapa separado do `GENERIC_WEAPON_ITEMS` (não é
  categoria+tipo, é arma já concreta): `NAMED_WEAPON_DOUBLE_ITEMS: Record<string, string>`
  (nome do texto SRD → `key` de `config.weapons`), ex. `'Two Shortswords' → 'shortsword'`,
  `'Duas Espadas Curtas' → 'shortsword'`, `'Two Handaxes'/'Duas Machadinhas' → 'handaxe'`.
  `flattenWeaponOptions` (ou uma função irmã, já que aqui a option NÃO expande em N — continua
  1 alternativa só, só troca o rótulo) resolve a `key` contra `config.weapons`, monta
  `[{ name: weapon.label, qty: 2 }]` no lugar de `[{ name: 'Two Shortswords', qty: 1 }]`. Reusa
  o rótulo do CATÁLOGO (já no locale certo) em vez de hardcoded "Espada Curta"/"Shortsword" —
  evita duplicar string por locale, diferente do `companion` acima (que não tem catálogo pra
  puxar de).

---

## Questões em aberto

1. ~~**"Duas Armas Marciais" — 2 cópias da mesma arma, ou 2 armas diferentes?**~~ **Resolvida**
   (mantenedora, 2026-09-10): as duas armas são a mesma. `qty: 2` da MESMA arma escolhida, 1
   `<select>` por slot — sem controle novo, sem 2º `<select>`.
2. ~~**Ordem das 2 alternativas expandidas no mesmo slot**~~ **Resolvida** (mockup, 2026-09-10):
   nem 1 `<select>` mesclado com ~36 `<option>`, nem 2 `<select>` lado a lado repetindo a mesma
   lista de armas — **1 radio de modo + 1 `<select>` de arma compartilhado**. O radio escolhe
   "Arma marcial e um escudo" vs. "Duas armas marciais (em dobro)"; o select embaixo tem as 23
   armas marciais do catálogo (sem filtro de `weaponType`) e vale pros 2 modos — trocar de modo
   não reseta a arma escolhida, só muda o resultado exibido ("`<Arma>`, Escudo" ou "`<Arma>`
   (2)"). Ver mockup em [docs/mockups/us-230-arma-composta-dobro.html](../../mockups/us-230-arma-composta-dobro.html).

---

## Referências no código

- [packages/shared/src/starting-kit.ts:43-129](../../../packages/shared/src/starting-kit.ts:43) — `GENERIC_WEAPON_ITEMS`/`parseGenericWeaponItem`/`matchingWeapons`/`flattenWeaponOptions`/`resolveEquipmentSlots` (US-229), onde os 2 padrões novos entram, e onde `resolveEquipmentSlots` ganha o tratamento do caso Guerreiro/Paladino (2 alternativas genéricas no mesmo `choices[]` original).
- [scripts/srd/srd-5e.config.en-US.json](../../../scripts/srd/srd-5e.config.en-US.json) / [scripts/srd/srd-5e.config.pt-BR.json](../../../scripts/srd/srd-5e.config.pt-BR.json) — `classes[].startingEquipmentChoices` de `fighter`/`paladin`/`ranger`, os 3 textos quebrados (§Contexto tem a tabela completa com trecho de cada).
- [apps/web/src/components/setup/SetupWizard.tsx:1130-1161](../../../apps/web/src/components/setup/SetupWizard.tsx:1130) — `<select>` do slot (US-226/US-229). **Mudança esperada** pro Guerreiro/Paladino: o slot de arma marcial ganha um radio de modo ACIMA do `<select>` — não 2 `<select>` visíveis ao mesmo tempo (decisão do mockup, §Questões em aberto #2) — Patrulheiro e as demais classes, sem mudança.
- [apps/api/src/character/character.service.ts:83-90](../../../apps/api/src/character/character.service.ts:83) — `validateEquipmentChoices` contra `resolveEquipmentSlots(...).slots` (US-229). **A confirmar ao implementar** pro Guerreiro/Paladino: se o radio+select vira 2 índices em `equipmentChoices` (um por modo, só o do modo ativo importa) ou 1 índice novo com campo de modo à parte — nos dois casos, checar se algum personagem já criado com essas classes na Fase 1 precisa de migração de `equipmentChoices` persistido, ou se a validação solta (índice fora do intervalo cai em opção 0, nunca lança) já cobre sem migração.
- [packages/shared/src/starting-kit.test.ts](../../../packages/shared/src/starting-kit.test.ts) — testes da US-229 usam Bárbaro/Bruxo/Druida com fixtures fiéis ao dataset; Guerreiro só aparece com fixture SIMPLIFICADO ("Arma Marcial" genérico de mentira) em `character.service.test.ts`/`SetupWizard.test.tsx` — é onde o bug escapou, ver §Contexto.
- [docs/mockups/us-230-arma-composta-dobro.html](../../mockups/us-230-arma-composta-dobro.html) — mockup funcional (mesmo padrão de tokens do mockup da US-229): Guerreiro/Paladino com radio de modo + 1 `<select>` compartilhado, Patrulheiro com "Espada Curta (2)" no padrão novo — referência de design pra §Escopo e §Questões em aberto #2.

---

## Referência à origem

Aberta em 2026-09-10 pela mantenedora, a partir de 2 capturas de tela do wizard em produção
(Paladino e Patrulheiro) mostrando o `<select>` de equipamento inicial com o texto genérico cru
("Arma Marcial e Um Escudo"/"Duas Armas Marciais", "Duas Armas Simples Corpo a Corpo") em vez
de armas resolvidas — a US-229 ([US-229](./US-229-escolha-especifica-de-arma-no-equipamento-inicial.md))
resolveu os 3 padrões que a varredura dela alcançou; esta story fecha os 2 padrões que ficaram
de fora (composto com item fixo, e quantidade embutida no texto).
