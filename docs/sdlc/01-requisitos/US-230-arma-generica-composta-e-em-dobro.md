# US-230 — Arma genérica composta ("e um escudo") e em dobro ("duas armas") no equipamento inicial

**Épico:** 1 — Personagem
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
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
| Guerreiro (`fighter`) | `choices[0]` | `Martial Weapon and a Shield` | `Arma Marcial e Um Escudo` | `Chain Mail` / `Cota de Malha` — não é bem "irmã", é outro slot; a alternativa NOMEADA deste MESMO slot é `Two Martial Weapons` (também quebrada, ver linha abaixo) |
| Guerreiro (`fighter`) | `choices[0]` (2ª alternativa do mesmo slot) | `Two Martial Weapons` | `Duas Armas Marciais` | — |
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
  esta story ESTENDE o parser e o achatamento existentes — não cria um mecanismo paralelo. O
  `<select>` continua o mesmo, a lista achatada continua indexada por `equipmentChoices[i]`.
- **Persistência:** `getStartingInventory` devolve a arma (ou arma+escudo, ou arma×2) real,
  nunca o texto composto/em-dobro cru — mesmo critério de aceite da US-229, estendido aos 2
  padrões novos.
- **Etapa `review` e ficha (`GameView`):** herdam o fix pelo mesmo caminho que a US-229 já
  ligou (`previewFullKit` → `getStartingInventory`) — sem código novo nessas telas, só
  verificação (mesma disciplina da US-229 §Escopo).
- **Testes:** Guerreiro e Paladino (`choices[0]`, os dois com AS MESMAS 2 alternativas
  quebradas) e Patrulheiro (`choices[1]`) — os 3 casos reais da tabela acima, contra dataset
  real ou fixture fiel a ele (não simplificado, pra não repetir o motivo do Guerreiro ter
  escapado da US-229).

### Fora do escopo

- **Reabrir a US-229** (já implementada e mesclada) — esta story só adiciona 2 formas novas ao
  parser dela, não questiona o que já funciona (os 3 padrões solo continuam intactos).
- **Decidir a regra 5e de "duas armas marciais"** — se a jogadora deveria poder escolher DUAS
  armas DIFERENTES em vez de 2 cópias da mesma (ver §Questões em aberto #1). Fora de escopo
  aqui; a interpretação "2 cópias da mesma arma" é a proposta desta story, não um critério de
  aceite fechado — ver nota na tabela de critérios.
- **Fundo (`background`) e equipamento racial** — mesmo corte da US-229 (não confirmado se
  `backgroundEquipment` tem qualquer um dos 2 padrões; se tiver, é story separada).
- **Vasculhar TODO texto de equipamento por outras formas ainda não achadas.** A varredura desta
  story listou item por item as 13 classes (tabela completa em §Contexto) — não é uma garantia
  formal de que não existe um 4º padrão, mas é exaustiva sobre os dados atuais do SRD 5e.

---

## Critérios de aceite

- [ ] Guerreiro, slot 0: o `<select>` lista uma `<option>` por arma marcial do catálogo (sem
      filtro de `weaponType` — nem melee nem ranged exclui nada), cada opção mostrando a arma
      MAIS "Escudo" (ex. "Machado de Batalha, Escudo") — nunca o texto "Arma Marcial e Um
      Escudo" — **E** uma `<option>` por arma marcial mostrando a MESMA arma em dobro (ex.
      "Machado de Batalha (2)") — nunca o texto "Duas Armas Marciais".
- [ ] Paladino, slot 0: mesmo comportamento do Guerreiro acima (texto-fonte idêntico nos dois).
- [ ] Patrulheiro, slot 1: o `<select>` lista "Duas Espadas Curtas" (nomeada, já funciona) MAIS
      uma `<option>` por arma simples corpo a corpo do catálogo em dobro (ex. "Adaga (2)") —
      nunca o texto "Duas Armas Simples Corpo a Corpo".
- [ ] Escolher a option "arma + escudo" resolve os DOIS itens no inventário final (arma real +
      "Escudo"), nunca só um dos dois.
- [ ] Escolher a option "em dobro" resolve com `qty: 2` no inventário final — nunca dois itens
      separados de `qty: 1` cada, nunca `qty: 1` só.
- [ ] Etapa `review` (linha "Kit") e ficha (`GameView`) mostram o resultado resolvido nas 3
      classes — nunca "Arma Marcial e Um Escudo"/"Duas Armas Marciais"/"Duas Armas Simples
      Corpo a Corpo" cru. Mesma disciplina da US-229: verificar a TELA, não só a função.
  - Está aberto se "duas armas marciais" deveria virar duas armas DIFERENTES (2 `<select>` ou
    1 `<select>` com combinação) em vez de 2 cópias da mesma — ver §Questões em aberto #1;
    até decisão em contrário, o critério de aceite é "2 cópias da mesma arma escolhida".
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

---

## Questões em aberto

1. **"Duas Armas Marciais" — 2 cópias da mesma arma, ou 2 armas diferentes?** O texto do SRD
   ("two martial weapons") não deixa claro se a jogadora escolhe uma arma e leva duas, ou
   escolhe duas armas (potencialmente diferentes) da categoria. Esta story propõe "2 cópias da
   mesma" (mais simples — 1 `<select>`, sem controle novo) mas é decisão de design que a
   mantenedora precisa confirmar antes da implementação; se a resposta for "2 diferentes", o
   desenho muda pra 2 `<select>` por slot em vez de 1, escopo maior.
2. **Ordem das 2 alternativas expandidas no mesmo slot** (composto + em-dobro, caso do
   Guerreiro/Paladino) — a US-229 já decidiu "opções nomeadas + opções expandidas lado a lado,
   mesma ordem do JSON" pro caso de 1 alternativa genérica só; aqui são DUAS alternativas
   genéricas no MESMO slot (nenhuma nomeada) — a ordem provavelmente seria "todas as expansões
   da alternativa A, depois todas da alternativa B" (ordem do `options[]` original), mas vale
   confirmar que não fica confuso ter ~36 `<option>` no mesmo `<select>` (18 armas marciais ×
   2 padrões) sem nenhum separador visual.

---

## Referências no código

- [packages/shared/src/starting-kit.ts:43-129](../../../packages/shared/src/starting-kit.ts:43) — `GENERIC_WEAPON_ITEMS`/`parseGenericWeaponItem`/`matchingWeapons`/`flattenWeaponOptions`/`resolveEquipmentSlots` (US-229), onde os 2 padrões novos entram.
- [scripts/srd/srd-5e.config.en-US.json](../../../scripts/srd/srd-5e.config.en-US.json) / [scripts/srd/srd-5e.config.pt-BR.json](../../../scripts/srd/srd-5e.config.pt-BR.json) — `classes[].startingEquipmentChoices` de `fighter`/`paladin`/`ranger`, os 3 textos quebrados (§Contexto tem a tabela completa com trecho de cada).
- [apps/web/src/components/setup/SetupWizard.tsx:1130-1161](../../../apps/web/src/components/setup/SetupWizard.tsx:1130) — `<select>` do slot (US-226/US-229), sem mudança esperada (herda o fix de `resolveEquipmentSlots`).
- [apps/api/src/character/character.service.ts:83-90](../../../apps/api/src/character/character.service.ts:83) — `validateEquipmentChoices` contra `resolveEquipmentSlots(...).slots` (US-229), sem mudança esperada (índice continua validado contra `options.length` da lista achatada, que só cresce).
- [packages/shared/src/starting-kit.test.ts](../../../packages/shared/src/starting-kit.test.ts) — testes da US-229 usam Bárbaro/Bruxo/Druida com fixtures fiéis ao dataset; Guerreiro só aparece com fixture SIMPLIFICADO ("Arma Marcial" genérico de mentira) em `character.service.test.ts`/`SetupWizard.test.tsx` — é onde o bug escapou, ver §Contexto.

---

## Referência à origem

Aberta em 2026-09-10 pela mantenedora, a partir de 2 capturas de tela do wizard em produção
(Paladino e Patrulheiro) mostrando o `<select>` de equipamento inicial com o texto genérico cru
("Arma Marcial e Um Escudo"/"Duas Armas Marciais", "Duas Armas Simples Corpo a Corpo") em vez
de armas resolvidas — a US-229 ([US-229](./US-229-escolha-especifica-de-arma-no-equipamento-inicial.md))
resolveu os 3 padrões que a varredura dela alcançou; esta story fecha os 2 padrões que ficaram
de fora (composto com item fixo, e quantidade embutida no texto).
