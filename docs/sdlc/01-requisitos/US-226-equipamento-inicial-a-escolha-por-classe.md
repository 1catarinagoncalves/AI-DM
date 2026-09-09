# US-226 — Equipamento inicial à escolha por classe (arma, armadura e pacote de aventura)

**Épico:** 1 — Personagem
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** [US-51](./US-51-kits-iniciais-do-srd.md) (`buildStartingKits`/`parseSrdEquipmentBullets`/`firstAlternative`/`toKitItem` — o parser que hoje resolve TODA alternativa `(*a*) X or (*b*) Y` para a opção A e descarta o resto; esta story para de descartar) · [ADR 009 §8](../../adr/009-uniao-dos-srd-5-1-e-5-2.md) (SRD 5.1/`srd-2014` é a fonte de referência desde 15/08/2026 — é dele que vem a feature `STARTING_EQUIPMENT` com bullets `(*a*)/(*b*)/(*c*)`, não da `CORE_TRAITS_TABLE` do 5.2 que a versão original da US-51 descrevia) · [US-221](./US-221-proficiencias-de-arma-armadura-e-ferramenta-por-classe.md) (`toolProficiencies: { fixed, choice }` — a forma que `startingEquipmentChoices` espelha — e o `<select>` por slot da etapa `class`, mesmo componente de UI que esta story reusa)
**Relacionado:** [US-128](./US-128-memento-e-equipamento-da-origem-como-itens-do-inventario.md) (equipamento da ORIGEM, mecanismo irmão — item físico resolvido em `AdventureService.create` — mas escopo diferente; esta story não toca `backgroundEquipment`) · [US-127](./US-127-revisao-espelha-ficha-completa.md) (`getStartingInventory` é a MESMA função que o preview do wizard e a criação de aventura chamam — o preview nunca pode divergir do que a API grava) · [dwarf-tool-proficiency.ts](../../../packages/shared/src/dwarf-tool-proficiency.ts) (precedente de traço com poucas alternativas fixas + coluna própria no `Character` para materializar o item físico)

**Criada em:** 2026-09-08

---

## História

> **Como** jogadora na etapa de Classe,
> **quero** escolher entre as alternativas de arma, armadura e pacote de aventura que a MINHA classe oferece — como um Guerreiro escolhendo cota de malha OU armadura de couro com arco longo —,
> **para que** o equipamento inicial reflita uma escolha real de criação de personagem, do jeito que o 5e joga de verdade, em vez de todo Guerreiro novo receber sempre a mesma opção A porque o pipeline decide por mim.

---

## Contexto e motivação

### O que o dataset diz (medido em 2026-09-08, `STARTING_EQUIPMENT` de `scripts/srd/_data/ClassFeature.json`, srd-2014, as 12 classes base)

A feature que a US-51 já lê (`ClassFeature.STARTING_EQUIPMENT`, `document: 'srd-2014'`) não é um kit fixo — é uma lista de bullets, e cada bullet **com marcador `(*a*)…(*b*)…`** é uma escolha independente entre 2 ou 3 alternativas. Exemplo cru (Guerreiro, 4 bullets, todos com escolha):

```
* (*a*) chain mail or (*b*) leather armor, longbow, and 20 arrows
* (*a*) a martial weapon and a shield or (*b*) two martial weapons
* (*a*) a light crossbow and 20 bolts or (*b*) two handaxes
* (*a*) a dungeoneer’s pack or (*b*) an explorer’s pack
```

Contando bullets com `(*a*)…or (*b*)…` real (2+ alternativas) contra bullets sem marcador (item fixo, sem escolha) nas 12 classes:

| Classe | Slots de escolha | Alternativas por slot | Item(ns) fixo(s) (sem escolha) |
|---|---|---|---|
| `barbarian` | 2 | 2, 2 | Explorer's Pack, 4× Javelin |
| `bard` | 3 | **3**, 2, 2 | Leather Armor, Dagger |
| `cleric` | 4 | 2, **3**, 2, 2 | Shield, Holy Symbol |
| `druid` | 2 | 2, 2 | Leather Armor, Explorer's Pack, Druidic Focus |
| `fighter` | 4 | 2, 2, 2, 2 | — (nenhum) |
| `monk` | 2 | 2, 2 | 10× Dart |
| `paladin` | 3 | 2, 2, 2 | Chain Mail, Holy Symbol |
| `ranger` | 3 | 2, 2, 2 | Longbow, Quiver of 20 Arrows |
| `rogue` | 3 | 2, 2, **3** | Leather Armor, 2× Dagger, Thieves' Tools |
| `sorcerer` | 3 | 2, 2, 2 | 2× Dagger |
| `warlock` | 3 | 2, 2, 2 | Leather Armor, Simple Weapon, 2× Dagger |
| `wizard` | 3 | 2, 2, 2 | Spellbook |

**35 slots de escolha no total**, quase todos binários — só bardo (arma: florete/espada longa/arma simples), clérigo (armadura: cota de escamas/couro/malha) e ladino (pacote: arrombador/masmorra/explorador) têm 3 alternativas. Nenhuma classe tem escolha em ouro dentro destes bullets (isso é `CORE_TRAITS_TABLE`, do 5.2, fora de escopo desde a revisão de precedência do ADR 009 §8 — ver §Fora do escopo).

### Por que a solução atual não basta

`parseSrdEquipmentBullets` ([ingest.mjs:555](../../../scripts/srd/ingest.mjs:555)) já enxerga os 35 slots — mas `firstAlternative` ([ingest.mjs:547](../../../scripts/srd/ingest.mjs:547)) resolve cada um para a opção A e **descarta** B (e C, quando existe) antes mesmo de `toKitItem` rodar. O comentário do próprio código já registra a regra ([ingest.mjs:531](../../../scripts/srd/ingest.mjs:531)): *"sem modelo de dinheiro no jogo, só a primeira alternativa existe"* — verdadeiro para a alternativa em OURO (que de fato não existe nestes bullets, só na `CORE_TRAITS_TABLE`), mas aplicado por engano também às alternativas que **não envolvem dinheiro nenhum**, como cota de malha vs. couro-e-arco. Resultado: toda Guerreira nova recebe cota de malha, nunca a alternativa; todo Bardo recebe florete, nunca espada longa ou "qualquer arma simples". `config.startingKits[classKey]` ([types/system.ts:261](../../../packages/shared/src/types/system.ts:261)) é hoje uma lista JÁ achatada, sem rastro de quais itens vieram de um bullet com alternativa e quais eram fixos — não dá pra oferecer escolha em cima dela sem re-derivar do texto cru.

### A proposta

Estender o ingest com um parser irmão de `parseSrdEquipmentBullets` que, em vez de descartar as alternativas não-A, devolve as duas (ou três) por slot — produzindo `config.classes[].startingEquipmentChoices: { fixed, choices }`, mesma forma `{ fixed, choice }` que `toolProficiencies` ([system.ts:121](../../../packages/shared/src/types/system.ts:121)) já usa para "parte obrigatória + parte à escolha". A etapa `class` do wizard ganha um `<select>` por slot — mesmo componente que `classToolGrant` já usa para a ferramenta à escolha da classe ([SetupWizard.tsx:1091-1117](../../../apps/web/src/components/setup/SetupWizard.tsx:1091)) — e `Character` ganha uma coluna para persistir qual alternativa foi escolhida em cada slot, resolvida em item físico no mesmo momento que hoje (`AdventureService.create`, início da aventura).

---

## Escopo

### Dentro do escopo

- **`scripts/srd/ingest.mjs`:** `parseClassEquipmentChoices(desc)`, ao lado de `parseSrdEquipmentBullets`/`firstAlternative` — mesmo arquivo, mesma fonte (`STARTING_EQUIPMENT`, `document === 'srd-2014'`):
  - Linha com 2+ marcadores `(*a*)…(*b*)…` (e opcionalmente `(*c*)…`) → um slot `{ options: InventoryItem[][] }`, uma entrada por alternativa, cada alternativa passando pelo MESMO split-por-vírgula + `toKitItem` que `parseSrdEquipmentBullets` já usa (uma alternativa pode ter mais de um item — `"leather armor, longbow, and 20 arrows"` vira 3 `InventoryItem` na mesma opção).
  - Linha com **1 só** marcador (`(*a*) Leather armor, two daggers, and thieves’ tools`, ladino) ou **sem** marcador → item fixo, mesmo tratamento de hoje (`toKitItem` direto, sem slot). Contagem de marcadores decide, não a presença de marcador: o ladino tem `(*a*)` mas nenhum `(*b*)` — 1 marcador não é escolha.
  - Qualificador `(if proficient)` (clérigo, `warhammer`/`chain mail`) sobrevive como parte do nome do item resolvido — sem parsing especial; é texto de regra (proficiência condiciona o USO da arma, não se ela pode ser escolhida), fora do escopo de validação desta story (ver §Fora do escopo).
- **`buildStartingKits`** ([ingest.mjs:636](../../../scripts/srd/ingest.mjs:636)): ganha `startingEquipmentChoices[canon] = parseClassEquipmentChoices(f.fields.desc)` ao lado do `startingKits[canon]` que já calcula — **`startingKits[canon]` não muda de conteúdo** (continua fixed + opção A de cada slot, exatamente hoje), é o fallback de sempre para quem não tem escolha feita.
- **`ClassCatalogEntrySchema`** ([system.ts:113](../../../packages/shared/src/types/system.ts:113)): campo novo opcional, irmão de `toolProficiencies`:
  ```ts
  startingEquipmentChoices: z.object({
    fixed: z.array(StartingKitItemSchema),
    choices: z.array(z.object({
      options: z.array(z.array(StartingKitItemSchema)).min(2),
    })),
  }).optional(),
  ```
- **`getStartingInventory`** ([starting-kit.ts:22](../../../packages/shared/src/starting-kit.ts:22)): ganha 3º parâmetro opcional `equipmentChoices?: number[]`. Com `startingEquipmentChoices` presente na classe: devolve `fixed` +, para cada slot `i`, `choices[i].options[equipmentChoices?.[i] ?? 0]` (índice ausente ou fora do intervalo → opção 0, nunca lança). Sem `startingEquipmentChoices` na classe (artefato pré-ingest, ou `equipmentChoices` não passado): devolve exatamente `config.startingKits[classKey] ?? config.startingKits.default`, o comportamento de hoje, byte a byte.
- **`Character.equipmentChoices`** (schema Prisma + `character.schema.ts` + `CharacterService.create`): coluna `Json @default("[]")`, mesmo padrão de `skills`/`tools`/`weapons` — array de índices (`number[]`), um por slot, na ordem de `startingEquipmentChoices.choices`. Validado em `create()` perto de `classToolProficiencies`/`classSkillProficiencies` ([character.service.ts:71-78](../../../apps/api/src/character/character.service.ts:71)): índice fora de `[0, options.length)` para qualquer slot → `BadRequestException` citando classe, índice do slot e valor ofensor. Slot sem índice no DTO → assume `0` (opção A), nunca bloqueia a criação — mesma disciplina "nunca quebra" de `raceToolChoice`/US-224, embora o wizard (ver próximo item) não deva deixar a jogadora chegar nesse estado sem querer.
- **Etapa `class` do wizard** ([SetupWizard.tsx:1064-1118](../../../apps/web/src/components/setup/SetupWizard.tsx:1064)): quando `startingEquipmentChoices` existe para a classe escolhida, o bloco `previewKit` de texto corrido vira uma lista dos itens `fixed` + um `<select>` por slot (mesmo componente/estilo do `<select>` de `classToolGrant`, [SetupWizard.tsx:1104-1113](../../../apps/web/src/components/setup/SetupWizard.tsx:1104)), rótulo = os nomes das alternativas daquele slot unidos por "ou" (ex. "Cota de Malha ou Armadura de Couro, Arco Longo e 20 Flechas"). `canAdvance('class')` passa a exigir os `equipmentChoices.length === choices.length` preenchidos, mesmo padrão de `classToolChoice`. Resetar `equipmentChoices` ao trocar de classe (mesmo reset que `raceToolChoice` já tem ao trocar de raça).
- **Preview e persistência da aventura:** `previewKit`/`previewFullKit` ([SetupWizard.tsx:519-534](../../../apps/web/src/components/setup/SetupWizard.tsx:519)) e `AdventureService.create` ([adventure.service.ts:469](../../../apps/api/src/adventure/adventure.service.ts:469)) passam a chamar `getStartingInventory(config, classKey, character.equipmentChoices)` — mesma função, argumento a mais, sem novo mecanismo de resolução.
- **Testes:** `ingest.test.mjs` cobre `parseClassEquipmentChoices` nas armadilhas reais medidas (3 alternativas do bardo/clérigo/ladino, bundle de múltiplos itens numa alternativa como o `(*b*)` do guerreiro, linha de 1 marcador só do ladino tratada como fixa, `(if proficient)` do clérigo sobrevivendo no nome); `character.service.test.ts` cobre índice válido, índice fora do intervalo e slot ausente (cai em 0); `SetupWizard.test.tsx` cobre um `<select>` por slot bloqueando `canAdvance('class')` até todos preenchidos, e o payload de `createCharacter` recebendo os índices certos.

### Fora do escopo

- **Escolha entre itens e ouro.** Este dataset (`STARTING_EQUIPMENT`, srd-2014) não tem essa alternativa nos 35 slots medidos — ela existe só na `CORE_TRAITS_TABLE` do 5.2, fonte que o ADR 009 §8 tirou de escopo em 15/08/2026. Sem modelo de dinheiro no projeto (mesmo corte da US-51), continua sem entrada.
- **Pacote de equipamento do `marshal` (a5e-ag).** `parseA5ePackageEquipment` ([ingest.mjs:568](../../../scripts/srd/ingest.mjs:568)) já resolve um formato TOTALMENTE diferente — pacotes inteiros alternativos com custo em PO, escolha "monte seu próprio equipamento com 200 PO OU escolha um pacote" — que depende de modelo de dinheiro para fazer sentido de verdade. Fica com o comportamento de hoje (sempre o primeiro pacote); reabrir isso é story separada se/quando o projeto ganhar economia de recursos.
- **Equipamento de ORIGEM (`backgroundEquipment`, US-128).** Sistema de escolha diferente (benefício `type === 'equipment'` do background), sem os bullets `(*a*)/(*b*)` — `parseBackgroundEquipment` já pega a primeira opção de escolhas em prosa por um motivo textual diferente (medida/quantidade, não item). Não tocado.
- **Validar proficiência antes de mostrar a alternativa.** `(*a*) a mace or (*b*) a warhammer (if proficient)` — o clérigo do SRD só é proficiente em maça por padrão (arma simples); a versão do guerreiro do dataset não tem esse qualificador porque toda arma marcial já é dele. Checar proficiência de arma antes de oferecer a alternativa cruzaria com `weaponProficiencies` (US-221) e é refinamento de UX, não bloqueio de dado — a US mostra as duas opções sempre, o qualificador fica só como texto informativo no nome.
- **Retroagir personagens já criados.** Mesmo corte de US-51/US-128/US-220/US-221/US-224: mecânica só para criação nova; aventura já iniciada mantém o inventário congelado.

---

## Modelo de dados proposto

`packages/shared/src/types/system.ts` — extensão de `ClassCatalogEntrySchema` (mesmo objeto que US-209/US-221/US-224 já estendem):

```ts
export const ClassCatalogEntrySchema = SystemCatalogEntrySchema.extend({
  // ...hitDice/savingThrows/armorProficiencies/weaponProficiencies/toolProficiencies/skillProficiencies...
  startingEquipmentChoices: z.object({
    fixed: z.array(StartingKitItemSchema),
    choices: z.array(z.object({
      options: z.array(z.array(StartingKitItemSchema)).min(2),
    })),
  }).optional(),
})
```

Exemplo (`fighter`, 0 itens fixos, 4 slots — ilustra bundle multi-item numa alternativa; `bard`, slot de 3 alternativas):

```jsonc
{
  "classes": [
    {
      "key": "fighter", "label": "Guerreiro",
      "startingEquipmentChoices": {
        "fixed": [],
        "choices": [
          { "options": [
            [{ "name": "Chain Mail", "qty": 1 }],
            [{ "name": "Leather Armor", "qty": 1 }, { "name": "Longbow", "qty": 1 }, { "name": "Arrow", "qty": 20 }]
          ] },
          { "options": [
            [{ "name": "Martial Weapon", "qty": 1 }, { "name": "Shield", "qty": 1 }],
            [{ "name": "Martial Weapon", "qty": 2 }]
          ] },
          { "options": [
            [{ "name": "Light Crossbow", "qty": 1 }, { "name": "Bolt", "qty": 20 }],
            [{ "name": "Handaxe", "qty": 2 }]
          ] },
          { "options": [
            [{ "name": "Dungeoneer's Pack", "qty": 1 }],
            [{ "name": "Explorer's Pack", "qty": 1 }]
          ] }
        ]
      }
    },
    {
      "key": "bard", "label": "Bardo",
      "startingEquipmentChoices": {
        "fixed": [{ "name": "Leather Armor", "qty": 1 }, { "name": "Dagger", "qty": 1 }],
        "choices": [
          { "options": [
            [{ "name": "Rapier", "qty": 1 }],
            [{ "name": "Longsword", "qty": 1 }],
            [{ "name": "Simple Weapon", "qty": 1 }]
          ] },
          { "options": [ [{ "name": "Diplomat's Pack", "qty": 1 }], [{ "name": "Entertainer's Pack", "qty": 1 }] ] },
          { "options": [ [{ "name": "Lute", "qty": 1 }], [{ "name": "Musical Instrument", "qty": 1 }] ] }
        ]
      }
    }
  ]
}
```

**Persistência:** `Character.equipmentChoices` (coluna nova, `Json @default("[]")`, mesmo padrão de `skills`/`tools`/`weapons`) — `number[]`, um índice por slot, na ordem de `config.classes[].startingEquipmentChoices.choices`. Resolvido em item físico só no início da aventura, por `getStartingInventory(config, classKey, character.equipmentChoices)` dentro de `AdventureService.create` — mesmo momento e mesmo mecanismo que já materializa o kit hoje (US-51 §Inventário é congelado no início da aventura).

---

## Critérios de aceite

- [ ] `config.classes[].startingEquipmentChoices` preenchido para as 12 classes base, batendo com a tabela medida em §Contexto (35 slots no total; bardo/clérigo/ladino com um slot de 3 alternativas cada, o resto binário; guerreiro sem item fixo).
- [ ] `config.startingKits[classKey]` continua idêntico a hoje (fixed + opção A de cada slot) — nenhuma regressão no fallback nem no artefato de quem não usa a escolha.
- [ ] Criar um Guerreiro e escolher "couro + arco longo + 20 flechas" no lugar da cota de malha (1º slot) → `Character.equipmentChoices[0] === 1`, e o inventário da aventura criada reflete a escolha, não a opção A.
- [ ] Criar um Bardo e escolher "espada longa" (não florete nem "arma simples") no slot de arma → índice correto gravado e resolvido.
- [ ] Tentar avançar da etapa `class` sem escolher todos os slots de uma classe com `startingEquipmentChoices` → bloqueado (`canAdvance('class')` false), mesmo padrão de `classToolChoice`.
- [ ] Trocar de classe no meio da criação (ex. Guerreiro → Bardo) limpa `equipmentChoices` — nunca deixa a etapa em um estado de "2 slots preenchidos, 3 exigidos" com índice que pertencia à classe anterior.
- [ ] Enviar um índice fora do intervalo de um slot direto pela API → `CharacterService.create` rejeita com `BadRequestException` citando a classe, o slot e o índice ofensor.
- [ ] Classe sem `startingEquipmentChoices` no config (artefato pré-ingest desta story) → sem seleção pedida no wizard, kit sai exatamente como hoje (`startingKits[classKey]`), sem crash, sem bloquear a criação.
- [ ] Personagem criado ANTES desta story, ou aventura já iniciada → inventário não muda (sem migração, mesmo corte de US-51). Personagem antigo que iniciar uma aventura NOVA sem `equipmentChoices` gravado cai no índice 0 de cada slot (opção A), nunca quebra.
- [ ] `previewKit`/`previewFullKit` do wizard (etapa `class` e `review`) mostram exatamente o que `AdventureService.create` vai gravar — nunca divergem.
- [ ] **Eval/teste de regressão:** `ingest.test.mjs` cobre `parseClassEquipmentChoices` nas 4 armadilhas medidas (3 alternativas, bundle multi-item numa alternativa, marcador único sem par tratado como fixo, `(if proficient)` sobrevivendo no nome); `character.service.test.ts` cobre índice válido/fora do intervalo/ausente; `SetupWizard.test.tsx` cobre o `<select>` por slot bloqueando avanço e o payload de criação recebendo os índices certos para uma classe com slots (`fighter`) e uma com slot de 3 alternativas (`bard`).

---

## Notas de implementação

- **Reusar, não reescrever:** `toKitItem` ([ingest.mjs:536](../../../scripts/srd/ingest.mjs:536)) e `localizeKitItems` ([ingest.mjs:629](../../../scripts/srd/ingest.mjs:629)) já fazem tudo que cada alternativa de cada slot precisa (split, singularização condicional, overlay pt-BR) — `parseClassEquipmentChoices` só precisa dividir a linha pelos marcadores `(*a*)/(*b*)/(*c*)` ANTES de aplicar o que já existe, em vez de `firstAlternative` cortar tudo menos o primeiro.
- **Contagem de marcadores, não presença.** O bullet do ladino (`(*a*) Leather armor, two daggers, and thieves' tools`, sem `(*b*)`) tem UM marcador — é resíduo de formatação do dataset, não uma escolha. `line.split(/\(\*[a-z]\*\)/i).length - 1 >= 2` é o teste certo (mesma lógica que `firstAlternative` já usa para contar segmentos, só que aqui a contagem decide fixed-vs-slot em vez de "pegar o segundo").
- **`toolProficiencies: { fixed, choice }` é o precedente estrutural direto** ([system.ts:121-127](../../../packages/shared/src/types/system.ts:121)) — mesma forma "parte obrigatória + parte à escolha", só que `choice` lá é singular (1 categoria com N escolhas) e aqui `choices` é plural (N slots independentes, cada um com suas próprias alternativas). Não achatar num só `choice` genérico — os slots do guerreiro não compartilham pool entre si.
- **`<select>` por slot, não checkbox nem cartão.** O painel de detalhe da classe já tem esse padrão pronto para `classToolGrant` ([SetupWizard.tsx:1094-1115](../../../apps/web/src/components/setup/SetupWizard.tsx:1094)) — um `<select key={slotIndex}>` por posição, `aria-label` numerado quando há mais de um slot. Reusar a MESMA anatomia visual em vez de inventar um componente de escolha de equipamento.
- **Índice como identificador do slot é uma decisão nova desta story, não um precedente copiado** — ao contrário de `raceToolChoice`/`classToolChoice`, que gravam a CHAVE do catálogo de ferramentas (`config.tools[].key`, estável entre bumps do dataset), um item de equipamento aqui é texto solto sem chave própria. Um bump do SRD que reordene os bullets de uma classe muda o SIGNIFICADO de um índice já gravado em personagem existente — risco aceito pelo mesmo motivo que justifica "sem migração, sem retroagir" em toda story de kit (US-51/US-128): o inventário já persistido nunca é relido contra o config novo, só o congelado em `CharacterState.inventory` importa. Ver §Questões em aberto item 1.

---

## Questões em aberto

1. **Índice de slot como identificador é estável o bastante, ou vale a pena gastar mais numa chave textual normalizada por slot** (ex. hash do texto cru do bullet)? A vantagem de uma chave textual seria sobreviver a uma reordenação de bullets no dataset sem trocar silenciosamente o que um índice antigo significa — a desvantagem é complexidade nova (hash, ou nome de slot curado à mão por classe) para um risco que só se materializa em personagem que ainda não começou aventura E o dataset for atualizado nesse meio-tempo. Recomendação: manter índice simples agora (menor código, mesmo espírito "lazy" do restante do parser) — se um bump real do SRD reordenar bullets, o `ingest --strict` já teria numeros de slot mudando de contagem/conteúdo detectável em diff do artefato, e o passivo é só os personagens NÃO gravados em aventura ainda.
2. **Mostrar o qualificador `(if proficient)` (clérigo) como está, ou filtrar contra `weaponProficiencies` da própria classe e esconder a alternativa que a classe não pode usar de verdade?** Fora de escopo desta story (ver §Fora do escopo), mas fica registrado porque é a próxima pergunta óbvia que um code review vai fazer.

---

## Referências no código

- [scripts/srd/ingest.mjs:530-563](../../../scripts/srd/ingest.mjs:530) — `firstAlternative`/`toKitItem`/`parseSrdEquipmentBullets`, o parser que hoje descarta as alternativas e que `parseClassEquipmentChoices` complementa.
- [scripts/srd/ingest.mjs:636-649](../../../scripts/srd/ingest.mjs:636) — `buildStartingKits`, onde `startingEquipmentChoices` entra ao lado de `startingKits`.
- [packages/shared/src/types/system.ts:113-127](../../../packages/shared/src/types/system.ts:113) — `ClassCatalogEntrySchema`/`toolProficiencies`, forma `{fixed, choice}` que `startingEquipmentChoices` espelha.
- [packages/shared/src/starting-kit.ts:22-25](../../../packages/shared/src/starting-kit.ts:22) — `getStartingInventory`, função que ganha o 3º parâmetro `equipmentChoices`.
- [apps/api/prisma/schema.prisma:40-50](../../../apps/api/prisma/schema.prisma:40) — `Character.raceToolChoice`/`skills`/`tools`, precedentes de coluna para o `equipmentChoices` novo.
- [apps/api/src/character/character.service.ts:66-78](../../../apps/api/src/character/character.service.ts:66) — bloco de validação por-classe (`classToolProficiencies`/`classSkillProficiencies`) onde a validação de `equipmentChoices` entra.
- [apps/api/src/adventure/adventure.service.ts:469-484](../../../apps/api/src/adventure/adventure.service.ts:469) — momento de materialização do inventário, onde `character.equipmentChoices` passa a ser lido.
- [apps/web/src/components/setup/SetupWizard.tsx:1064-1118](../../../apps/web/src/components/setup/SetupWizard.tsx:1064) — painel de detalhe da etapa `class`, incluindo o `<select>` por slot de `classToolGrant` que esta story reusa como padrão visual.
- [apps/web/src/components/setup/SetupWizard.tsx:519-534](../../../apps/web/src/components/setup/SetupWizard.tsx:519) — `previewKit`/`previewFullKit`, preview que precisa receber `equipmentChoices`.
