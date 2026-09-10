# US-229 — Escolha específica de arma no equipamento inicial

**Épico:** 1 — Personagem
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** [US-226](./US-226-equipamento-inicial-a-escolha-por-classe.md) (`equipmentChoices`, `<select>` por slot em [SetupWizard.tsx:1138-1152](../../../apps/web/src/components/setup/SetupWizard.tsx:1138), `getStartingInventory` — o mecanismo de escolha que esta story estende) · [US-228](./US-228-categoria-simples-marcial-no-catalogo-de-armas.md) (`config.weapons[].category`/`weaponType` — o catálogo de onde vem o pool da sub-escolha) · [US-221](./US-221-proficiencias-de-arma-armadura-e-ferramenta-por-classe.md) (`weaponProficiencies.categories`/`.weapons` — o filtro que decide QUAIS armas do pool a classe pode realmente escolher, ver §Contexto "achado crítico")
**Relacionado:** [US-230](./US-230-arma-generica-composta-e-em-dobro.md) (achado pós-merge: Guerreiro/Paladino/Patrulheiro têm 2 formas de texto genérico — composto "arma + escudo" e "duas armas X" — que a varredura desta story não alcançou; `GENERIC_WEAPON_ITEMS`/`parseGenericWeaponItem` continuam os mesmos, US-230 só acrescenta chaves)

**Criada em:** 2026-09-09 (reescrita — ver nota abaixo)

---

## Nota sobre esta versão

Este número (US-229) tinha antes outro escopo: "proficiência de arma legível no painel de detalhe da classe" — expandir a categoria simples/marcial numa lista de nomes de arma no painel da etapa `class`, ideia nascida de [US-228](./US-228-categoria-simples-marcial-no-catalogo-de-armas.md) §Questões em aberto #2. Reescrita em 2026-09-09 a pedido da mantenedora para o escopo abaixo. A pergunta original volta a ficar **sem story dedicada** — corrigido no mesmo commit em US-228 (§Questões em aberto #2 e "Relacionado").

---

## História

> **Como** jogadora escolhendo uma classe (etapa de equipamento inicial),
> **quero** que, ao selecionar uma alternativa genérica de arma — "Qualquer Arma Marcial Corpo a Corpo", "Qualquer Arma Simples" etc. —, eu escolha A ARMA específica dentro daquela categoria,
> **para que** meu personagem comece o jogo empunhando uma arma de verdade (ex. "Machado de Batalha"), não o texto genérico da categoria.

---

## Contexto e motivação

O bárbaro (`config.classes.barbarian.startingEquipmentChoices`, [srd-5e.config.pt-BR.json:3514-3555](../../../scripts/srd/srd-5e.config.pt-BR.json:3514)) tem 2 slots de escolha:

- **Slot 0:** "Machado Grande" OU "Qualquer Arma Marcial Corpo a Corpo"
- **Slot 1:** "Duas Machadinhas" OU "Qualquer Arma Simples"

O `<select>` por slot (US-226, [SetupWizard.tsx:1138-1152](../../../apps/web/src/components/setup/SetupWizard.tsx:1138)) já deixa escolher ENTRE essas duas alternativas — mas quando a jogadora escolhe a alternativa genérica, o item persistido no inventário continua sendo o texto "Qualquer Arma Marcial Corpo a Corpo" ad-verbatim (`getStartingInventory`, [starting-kit.ts:31-42](../../../packages/shared/src/starting-kit.ts:31)). Não existe hoje nenhum passo que resolva esse balde numa arma de verdade: a ficha final do bárbaro pode dizer que ele "empunha Qualquer Arma Marcial Corpo a Corpo", o que não é um item jogável — não casa com nenhum `config.weapons[].key`, não tem `label` de exibição própria, não pode ser referenciado por uma tool do DM Agent.

**Decisão de UI (2026-09-09):** nada de `<select>` aninhado/segundo controle. A `<option>` genérica é SUBSTITUÍDA, dentro do MESMO `<select>` do slot, por uma `<option>` para cada arma do catálogo que casa a categoria/tipo — "Machado Grande" continua uma opção, "Qualquer Arma Marcial Corpo a Corpo" vira "Machado de Guerra", "Espada Longa" etc., cada uma sua própria `<option>`, todas no mesmo `<select>` do slot. Escolher já resolve a arma; não há passo 2.

**Escopo real, confirmado por varredura no dataset** (script ad-hoc sobre `srd-5e.config.en-US.json`, 2026-09-09): **8 das 13 classes** têm ao menos um item genérico de arma no kit — barbarian, bard, cleric, druid, monk, paladin, sorcerer, warlock. Só 3 padrões de texto aparecem, sempre da forma "Any {Simple|Martial}[ {Melee|Ranged}] Weapon": `Any Martial Melee Weapon`, `Any Simple Weapon`, `Any Simple Melee Weapon` — nunca "ranged" sozinho, nunca "martial" sem qualificador de tipo.

**Achado que muda o escopo:** nem todo item genérico está dentro de `choices[].options` (uma alternativa entre outras — o caso do bárbaro). O warlock tem "Any Simple Weapon" também dentro de `startingEquipmentChoices.fixed` — item GARANTIDO, sem alternativa, sem passar por `<select>` nenhum hoje ([SetupWizard.tsx:1133-1136](../../../apps/web/src/components/setup/SetupWizard.tsx:1133), hoje só texto corrido, nenhum picker). Esta story precisa cobrir os dois casos: genérico dentro de uma alternativa de `choices`, e genérico dentro de `fixed`.

**Achado crítico (2026-09-09, em resposta a pergunta da mantenedora "pode uma classe escolher arma sem proficiência?"):** filtrar o pool só por `category`/`weaponType` do catálogo NÃO garante que a classe seja proficiente na arma. Confirmado nos dados — cruzando `weaponProficiencies` (US-221) de cada classe contra os itens genéricos do próprio kit (script ad-hoc, 2026-09-09):

- **Druida:** kit oferece "Qualquer Arma Simples" e "Qualquer Arma Simples Corpo a Corpo", mas `weaponProficiencies.categories` do druida é `[]` — proficiência vem só de `weaponProficiencies.weapons`, uma lista NOMEADA de 10 armas (Clava, Adaga, Dardo, Azagaia, Maça, Bordão, Cimitarra, Foice, Funda, Lança). O pool "simples" completo do catálogo tem 14. Filtrar só por categoria ofereceria Clava Grande, Machadinha, Besta Leve e Arco Curto — nenhuma delas na lista do druida.
- **Feiticeiro:** mesmo padrão — `categories = []`, proficiência nomeada em só 5 armas (Adaga, Dardo, Funda, Bordão, Besta Leve). Filtrar por categoria ofereceria as outras 9 armas simples do catálogo, fora da proficiência.
- **Os outros 6** (barbarian, bard, cleric, monk, paladin, warlock) têm `weaponProficiencies.categories` NÃO-vazio cobrindo a mesma categoria do item genérico do kit — proficiência em categoria cobre TODAS as armas daquela categoria, então filtrar só por `category`/`weaponType` já dá exatamente o pool certo. O problema é só das duas classes com proficiência 100% nomeada.

Conclusão: o pool da `<option>` expandida tem que cruzar `config.weapons` filtrado por categoria/tipo **com** `classProficiencyEntry.weaponProficiencies` da própria classe — usa `.categories` quando não-vazio (dá o catálogo inteiro daquela categoria, mesmo filtro de antes), cai pra `.weapons` (lista nomeada, resolvida contra `config.weapons[].key`) quando `.categories` é `[]`. Nunca só `category`/`weaponType` sozinho.

---

## Escopo

### Dentro do escopo

- **Detecção do item genérico:** reconhecer o padrão "Qualquer Arma {categoria}[ {tipo}]" (ou o equivalente em EN, antes da tradução, no ingest) e resolvê-lo pra `{ weaponCategory: 'simple'|'martial', weaponType?: 'melee'|'ranged' }`. Onde essa marcação nasce (regex no componente contra o `name` já traduzido vs. campo estrutural escrito pelo `ingest.mjs`) é decisão de implementação — ver *Notas de implementação*, não é critério de aceite.
- **Achatamento (flatten) da opção genérica no MESMO `<select>` do slot:** nenhum segundo controle. A alternativa genérica ("Qualquer Arma Marcial Corpo a Corpo") é expandida, no momento de montar a lista de `<option>` do `<select>` já existente (US-226, [SetupWizard.tsx:1138-1152](../../../apps/web/src/components/setup/SetupWizard.tsx:1138)), em uma `<option>` por arma que casa `category`/`weaponType` **E** a proficiência da PRÓPRIA classe (`classProficiencyEntry.weaponProficiencies`, US-221) — ver §Contexto "Achado crítico": `categories` não-vazio filtra por categoria normalmente, `categories` vazio (druida, feiticeiro) restringe ao `.weapons` nomeado. As alternativas nomeadas (ex. "Machado Grande") continuam cada uma sua própria `<option>`, lado a lado com as opções expandidas.
- **Cobre os dois lugares onde o balde genérico aparece:** dentro de uma alternativa de `choices[slotIndex].options[optIndex]` (bárbaro, slots 0 e 1) E dentro de `fixed` (warlock) — o item genérico de `fixed` vira um slot sintético de 1 alternativa (só ela, genérica), passando pelo MESMO mecanismo de achatamento, não um componente à parte.
- **Persistência:** a arma específica escolhida substitui o texto genérico no que `getStartingInventory` devolve — o inventário final do personagem tem o `label` da arma real, não o rótulo da categoria.
- **Etapa `review` (linha "Kit"):** não é código novo — `previewFullKit` ([SetupWizard.tsx:546-551](../../../apps/web/src/components/setup/SetupWizard.tsx:546)) já espalha `previewKit`/`getStartingInventory` na linha `setup.review.kit` ([SetupWizard.tsx:1856-1861](../../../apps/web/src/components/setup/SetupWizard.tsx:1856)), então herda o fix junto. Listado aqui como critério de aceite próprio porque é tela que a jogadora vê antes de confirmar — precisa ser VERIFICADA, não só inferida do código-fonte.
- **Testes:** cobrir os 3 padrões de texto da varredura, os dois locais (`choices`/`fixed`), a classe-exemplo dos critérios de aceite (bárbaro) ponta a ponta — escolher qualquer `<option>` expandida do slot 0 e confirmar que só existem armas marciais corpo a corpo entre as opções expandidas (nenhuma arma simples ou à distância aparece misturada no mesmo `<select>`) — **e** druida/feiticeiro, cobrindo o caso `categories: []` do "Achado crítico": pool restrito ao `.weapons` nomeado, nunca ao catálogo inteiro da categoria.

### Fora do escopo

- **Mudar o dataset/catálogo da US-228** (`category`/`weaponType` em `config.weapons`). Esta story só CONSOME o que aquela já entrega, não altera schema/ingest dela.
- **Fundo (`background`) e equipamento racial.** A varredura cobriu só `classes[].startingEquipmentChoices`/`startingKits` — não confirmado se `backgroundEquipment` (US-128) tem o mesmo padrão de item genérico. Se tiver, é story separada; esta não amplia escopo sem confirmar.
- **A pergunta original deste número de story** (expandir categoria de PROFICIÊNCIA — não de equipamento — no painel de detalhe da classe, texto legível tipo o bloco de `review`). Fora de escopo aqui — ver "Nota sobre esta versão" no topo.

---

## Critérios de aceite

- [ ] Bárbaro, slot 0: o `<select>` do slot lista "Machado Grande" MAIS uma `<option>` por arma marcial corpo a corpo do catálogo (`config.weapons` filtrado por `category === 'martial' && weaponType === 'melee'`) — nunca a opção literal "Qualquer Arma Marcial Corpo a Corpo", nunca um segundo `<select>`.
- [ ] Bárbaro, slot 1: mesmo comportamento — `<select>` lista "Duas Machadinhas" MAIS uma `<option>` por arma simples do catálogo (pool = `category === 'simple'`, sem filtro de `weaponType`).
- [ ] Escolher qualquer `<option>` do slot (nomeada ou expandida) resolve o item de uma vez — nenhuma etapa/controle adicional depois da escolha.
- [ ] Warlock: o item genérico dentro de `fixed` ("Qualquer Arma Simples") também vira um `<select>` de uma `<option>` por arma simples do catálogo — mesmo mecanismo dos slots de `choices`, mesmo não fazendo parte de nenhuma alternativa nomeada.
- [ ] Druida: o `<select>` do slot "Qualquer Arma Simples" lista SÓ as 10 armas de `weaponProficiencies.weapons` do druida (Clava, Adaga, Dardo, Azagaia, Maça, Bordão, Cimitarra, Foice, Funda, Lança) — Clava Grande, Machadinha, Besta Leve e Arco Curto (as outras 4 do catálogo "simples") NÃO aparecem, a classe não é proficiente nelas.
- [ ] Feiticeiro: mesmo `<select>` de `choices` lista SÓ as 5 armas nomeadas do feiticeiro (Adaga, Dardo, Funda, Bordão, Besta Leve) — nenhuma das outras 9 armas simples do catálogo aparece.
- [ ] Sem escolher uma `<option>` (valor vazio), a confirmação de personagem fica bloqueada — mesmo padrão de obrigatoriedade que `equipmentChoices`/`classToolChoice` já têm ([SetupWizard.tsx:759](../../../apps/web/src/components/setup/SetupWizard.tsx:759)).
- [ ] Etapa `review` (`setup.review.kit`, [SetupWizard.tsx:1856-1861](../../../apps/web/src/components/setup/SetupWizard.tsx:1856)) mostra a arma específica escolhida na linha "Kit" — nunca o texto "Qualquer Arma...". Não é código novo (`previewFullKit` já consome `previewKit`/`getStartingInventory`, linhas 536-551, então herda o fix automaticamente) — é CRITÉRIO DE VERIFICAÇÃO: testar a tela, não assumir que "a função mudou" é o mesmo que "a tela mudou".
- [ ] Etapa `review` do druida e do feiticeiro (o par crítico desta story, ver §Contexto "Achado crítico"): a arma que aparece na linha "Kit" é sempre uma das armas de `weaponProficiencies.weapons` da classe — nunca uma arma simples de fora da lista nomeada (Clava Grande/Machadinha/Besta Leve/Arco Curto pro druida; qualquer uma das 9 fora da lista do feiticeiro). Mesmo item que o `<select>` da etapa `class` ofereceu, sem re-derivar de outro lugar.
- [ ] Inventário final do personagem (ficha, `GameView`) mostra o nome da arma específica escolhida — nunca o texto "Qualquer Arma...".
- [ ] Classe sem nenhum item genérico no kit (5 das 13) não muda de comportamento — nenhuma `<option>` nova aparece onde não existia antes desta story, e a linha "Kit" da etapa `review` continua idêntica à de antes desta story.

---

## Notas de implementação (proposta, não vinculante)

- **Onde marcar o item como genérico:** duas opções. **(a)** regex em `ingest.mjs`, junto de `parseClassEquipmentChoices`/`buildStartingKits`, gravando `{ name, qty, weaponCategory?, weaponType? }` no item do config — estrutural, mesmo espírito de `category`/`weaponType` em `SystemWeaponSchema` (US-228). **(b)** regex no componente, contra o `name` já traduzido pt-BR. (a) é mais robusto (não quebra se o overlay de tradução mudar o texto exibido) e consistente com o resto do pipeline, onde toda categoria estruturada nasce no ingest, nunca no componente — recomendado, mas não trava o critério de aceite.
- **Achatar a alternativa genérica em N `<option>`, não em um controle novo:** uma função `flattenSlotOptions(slot, weapons, weaponProficiencies)` (nome ilustrativo — recebe a proficiência da classe, não só o catálogo) substitui, na hora de montar `slot.options` pro `<select>`, qualquer alternativa `{ weaponCategory, weaponType }` por uma alternativa por arma que casa o filtro de categoria/tipo **E** está coberta pela proficiência da classe (ver §Contexto "Achado crítico" — `weaponProficiencies.categories` não-vazio filtra `config.weapons` normalmente; vazio restringe ao `.weapons` nomeado, resolvido contra `config.weapons[].key`) — devolvendo a MESMA forma de lista plana que `slot.options.map(...)` já usa em [SetupWizard.tsx:1147-1149](../../../apps/web/src/components/setup/SetupWizard.tsx:1147), só que mais comprida. `equipmentChoices[slotIndex]` (US-226) continua sendo só um índice — agora um índice na lista JÁ ACHATADA, não precisa de campo novo no `Character`. Índice tem que ser estável entre o preview do wizard e a criação real: a MESMA função de achatamento roda dos dois lados (mesma disciplina do comentário em `getStartingInventory`, linhas 18-20, sobre os dois nunca poderem divergir) — nunca calcular a lista achatada de dentro do JSX sem extrair pra função compartilhada.
- **Item genérico de `fixed` vira slot sintético:** um "slot" de `choices` com uma alternativa só (a genérica) — passa pelo MESMO `flattenSlotOptions` e pelo MESMO `<select>` de sempre, só a origem do dado (`fixed[j]` em vez de `choices[i]`) muda. `classEquipmentChoices` ganha esses slots sintéticos concatenados aos de `choices` antes de renderizar (ou o componente itera os dois com a mesma função de render) — sem view nova, sem obrigatoriedade nova a inventar.
- **`getStartingInventory`** ([starting-kit.ts:31-42](../../../packages/shared/src/starting-kit.ts:31)) resolve `equipmentChoices[i]` contra a MESMA lista achatada (chama `flattenSlotOptions` internamente) pra devolver o item com o `label` da arma escolhida — a mesma função alimenta o preview do wizard E a criação real, os dois têm que enxergar a lista achatada idêntica.

---

## Referências no código

- [scripts/srd/srd-5e.config.pt-BR.json:3514-3555](../../../scripts/srd/srd-5e.config.pt-BR.json:3514) — `startingEquipmentChoices` do bárbaro, exemplo usado nos critérios de aceite.
- [scripts/srd/ingest.mjs:584-600](../../../scripts/srd/ingest.mjs:584) — `parseClassEquipmentChoices`, onde o texto genérico nasce (herdado do parser da SRD, nunca teve estrutura própria).
- [apps/web/src/components/setup/SetupWizard.tsx:1138-1152](../../../apps/web/src/components/setup/SetupWizard.tsx:1138) — `<select>` de `choices` (US-226), onde `slot.options.map(...)` (linhas 1147-1149) precisa passar pela lista já achatada em vez da crua.
- [apps/web/src/components/setup/SetupWizard.tsx:1133-1136](../../../apps/web/src/components/setup/SetupWizard.tsx:1133) — bloco de `fixed`, hoje só texto corrido — vira slot sintético reusando o mesmo `<select>` acima, para o caso do warlock.
- [packages/shared/src/starting-kit.ts:31-42](../../../packages/shared/src/starting-kit.ts:31) — `getStartingInventory`, onde o item genérico precisa virar item específico (mesma função de achatamento do componente).
- [packages/shared/src/types/system.ts:174-179](../../../packages/shared/src/types/system.ts:174) — `SystemWeaponSchema` (`category`/`weaponType`, US-228), catálogo que alimenta as `<option>` expandidas.
- [packages/shared/src/types/system.ts:117-120](../../../packages/shared/src/types/system.ts:117) — `weaponProficiencies` (`categories`/`weapons`, US-221) no `ClassCatalogEntrySchema` — o filtro que faltava (§Contexto "Achado crítico"), sem ele o pool expandido pode oferecer arma fora da proficiência da classe (druida, feiticeiro).
- [scripts/srd/ingest.mjs:1056-1073](../../../scripts/srd/ingest.mjs:1056) — `parseWeaponProficiencies` (US-221), onde `categories`/`weapons` nascem.
- [apps/web/src/components/setup/SetupWizard.tsx:406](../../../apps/web/src/components/setup/SetupWizard.tsx:406) — `classProficiencyEntry`, já disponível no componente no passo `class` (mesma variável que `flattenSlotOptions` precisa consumir).
- [apps/web/src/components/setup/SetupWizard.tsx:536-551](../../../apps/web/src/components/setup/SetupWizard.tsx:536) — `previewKit`/`previewFullKit`, onde `getStartingInventory` alimenta a etapa `review`.
- [apps/web/src/components/setup/SetupWizard.tsx:1856-1861](../../../apps/web/src/components/setup/SetupWizard.tsx:1856) — linha "Kit" (`setup.review.kit`) da etapa `review`, onde o critério de aceite precisa ser verificado na tela.

---

## Referência à origem

Reescrita a pedido da mantenedora (2026-09-09) — versão anterior deste número tratava de legibilidade de proficiência de arma no painel de classe, cortada de [US-228](./US-228-categoria-simples-marcial-no-catalogo-de-armas.md) §Questões em aberto #2. Ver "Nota sobre esta versão" no topo.
