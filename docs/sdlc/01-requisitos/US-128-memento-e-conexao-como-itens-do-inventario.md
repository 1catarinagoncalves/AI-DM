# US-128 — Memento e conexão da origem como itens do inventário, identificados como tais

**Épico:** 1 — Personagem
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** [US-124](./US-124-exibir-beneficios-narrativos-origem.md) (`Character.origin.memento` e `Character.origin.connection` — os textos escolhidos nos dois `<select>`; sem eles não há o que colocar no inventário) · [US-02](./US-02-inventario-do-personagem.md) (seção "Inventário" na ficha, agrupamento por nome, limite de 9999) · [US-51](./US-51-kits-iniciais-do-srd.md) (kit inicial materializado em `CharacterState.inventory` quando a **aventura** começa — é nesse mesmo ponto que o memento entra)
**Relacionado:** [US-122](./US-122-escolha-background-catalogo-na-criacao.md) (`origin.key`, campo irmão) · [US-125](./US-125-beneficios-origem-no-system-prompt.md) (benefícios da origem no prompt do Mestre — o memento chega ao prompt por esta story só como item de inventário, ver §Fora do escopo) · [US-127](./US-127-revisao-espelha-ficha-completa.md) (preview do kit na revisão do wizard, que passa a ter um item a mais)
**Criada em:** 2026-08-12

---

## História

> **Como** jogador,
> **quero** que o memento e a conexão da minha origem apareçam como itens do meu inventário, cada um marcado com o que é,
> **para que** o que a origem me deu seja uma coisa que eu carrego de verdade (e que o Mestre vê na lista de itens), e não uma frase que só existe numa aba da ficha — e que eu consiga distinguir, olhando o inventário, qual linha é o memento e qual é a conexão.

---

## Contexto e motivação

### O problema observado

A US-124 fez o jogador escolher um memento e uma conexão na criação (`origin.memento`/`origin.connection`, textos das linhas sorteadas/escolhidas nas tabelas d10) e os grava em `Character.origin`. Mas o memento **é um objeto** ("o símbolo sagrado gasto pelo tempo que seu mentor lhe deixou") e hoje ele vive só como texto na aba "Background" da ficha ([BackgroundPanel](../../../apps/web/src/components/character/BackgroundPanel.tsx), US-124). O inventário do personagem (US-02), que é a lista do que ele carrega, **não sabe que esse objeto existe**: o kit inicial vem só de `getStartingInventory(config, character.class)` ([adventure.service.ts:107](../../../apps/api/src/adventure/adventure.service.ts:107)), que é dirigido por **classe**, não por origem.

Consequência prática: o jogador escolhe um objeto na criação e ele não está entre as coisas que ele tem. O Mestre também não o vê — o que vai ao prompt é a lista de inventário ([ai.service.ts:363](../../../apps/api/src/ai/ai.service.ts:363)), não o campo `origin`.

**A conexão entra pelo mesmo caminho, por decisão de produto (12/08/2026).** Ressalva registrada: uma conexão é uma pessoa/gancho ("a sacerdotisa que espera seu retorno ao templo"), não um objeto que se carrega — colocá-la no inventário mistura "o que tenho" com "quem me liga ao mundo", e o Mestre passa a ver um NPC na lista de itens. A decisão é da mantenedora e está tomada; a marca por procedência (`memento` × `connection`) é o que evita que as duas linhas fiquem indistinguíveis do resto do kit, e é por isso que ela é obrigatória e não decorativa.

### Por que a solução atual não basta

Nada além de exibir texto foi feito na US-124 — e foi deliberado lá (§Fora do escopo: "copiar a opção escolhida para `background.bonds`/`story`" ficou de fora, o campo é próprio). Esta story não desfaz aquilo: `origin.memento`/`origin.connection` continuam sendo a fonte de verdade da escolha; o que muda é que a **materialização** do inventário passa a considerá-las, do mesmo jeito que já considera o kit de classe.

### A proposta

No mesmo ponto em que o kit inicial é materializado (`AdventureService.createForCharacter`), acrescentar até dois itens a mais — um por campo preenchido (`origin.memento`, `origin.connection`) —, cada um com uma marca no próprio item dizendo o que ele é, e a ficha exibir essa marca ao lado do nome.

---

## Escopo

### Dentro do escopo

- **`InventoryItem` ganha campo opcional de procedência** (`packages/shared/src/types/character.ts`): `origin?: 'memento' | 'connection'`. Ausente = item comum (todo inventário que já existe hoje continua válido, sem migração e sem backfill).
- **Materialização junto do kit.** `AdventureService.createForCharacter` acrescenta ao `startingInventory` um item por campo preenchido: `{ name: <texto do memento>, qty: 1, origin: 'memento' }` e `{ name: <texto da conexão>, qty: 1, origin: 'connection' }`. Mesmo momento e mesma transação do kit de classe (linhas 107/190) — não é uma escrita nova, são até dois itens a mais na lista que já é gravada em `CharacterState.inventory`. **Ordem fixa:** kit da classe, depois memento, depois conexão (a US-02 não ordena o inventário, mas uma ordem estável é o que torna o teste determinístico).
- **Cada campo entra independente do outro.** Só memento preenchido → 1 item a mais; só conexão → 1 item a mais; os dois → 2; nenhum → nada. Não existe caso em que a ausência de um bloqueia o outro (o Sailor, cuja origem só tem bloco de memento — US-124 §Contexto, armadilha 1 —, nasce sem a linha de conexão e isso não é erro).
- **O nome do item é o texto escolhido, como está.** Sem resumir, sem cortar, sem gerar rótulo curto — é o texto que o jogador escolheu na US-124 e é ele que aparece na linha do inventário (ver §Notas de implementação para a consequência visual e a Questão em aberto 1).
- **`updateInventory` preserva campos além de `name`/`qty`.** O `execute` da tool ([ai.service.ts:472-486](../../../apps/api/src/ai/ai.service.ts:472)) hoje reduz o inventário a um `Map<string, number>` e **reconstrói** cada item como `{name, qty}` — qualquer campo extra é apagado no primeiro turno em que o Mestre mexer no inventário, mesmo mexendo em **outro** item. Sem esta correção as duas marcas duram até o primeiro `updateInventory` da aventura. O mapa passa a guardar o item inteiro; só a `qty` é recalculada.
- **Marca visível na ficha.** Seção "Inventário" do `GameView` ([GameView.tsx:531-540](../../../apps/web/src/components/game/GameView.tsx:531)): item com `origin` definido mostra uma marca ao lado do nome, **distinta por valor** — chave i18n própria para cada um (ex. `game.inventoryMemento`/`game.inventoryConnection`), nos dois locales, sem string nova hardcoded no JSX (gate da US-102). Item sem `origin` renderiza exatamente como hoje.
- **Contagem e agrupamento não mudam.** Memento e conexão contam no `Inventário (n)` como qualquer linha e no limite de 9999 (US-02). Entram com `qty: 1` e, por serem textos longos e únicos, na prática não colidem de nome com item do kit — mas se colidirem, o agrupamento por nome da US-02 vale igual, sem exceção (ver Questão em aberto 2).
- **São itens comuns depois de criados.** O Mestre pode removê-los (`updateInventory` com delta negativo) se a ficção pedir — perder o memento, ou a conexão deixar de acompanhar o personagem, é coisa que pode acontecer em jogo. Não são itens travados nem protegidos.
- **Preview do kit na revisão do wizard** ([US-127](./US-127-revisao-espelha-ficha-completa.md), `apps/web`): a lista de itens da etapa `review` mostra memento e conexão junto do kit, com as mesmas marcas — o preview não pode divergir do que a API vai gravar (é a razão de a US-127 ter movido `getStartingInventory` para `packages/shared`).
- **Tipo do payload no cliente**: `states[].inventory` em [apps/web/src/lib/api.ts:75](../../../apps/web/src/lib/api.ts:75) ganha o campo opcional. O `findOne` do `CharacterService` devolve o `CharacterState` inteiro (JSON cru), então o campo já viaja sem mudança no serializer — só o tipo TS precisa acompanhar.
- **Testes:** `adventure.service.test.ts` — as 4 combinações (só memento, só conexão, os dois, nenhum) produzem exatamente as linhas esperadas além do kit, sem item vazio e sem linha `undefined`; teste de regressão do `updateInventory` — adicionar/remover um item **qualquer** não apaga o `origin` de nenhum dos dois.

### Fora do escopo

- **Backfill de aventura já em andamento.** O inventário é materializado quando a aventura começa (US-02, nota de 03/08/2026); `CharacterState` já existente não é reescrito. Personagem que já jogava só ganha o memento numa aventura **nova** — mesma regra que valeu para a mudança de kit da US-51.
- **Marcar as duas linhas no prompt do Mestre.** Elas entram na lista de inventário que já vai ao prompt (`inventory.map(...)` em [ai.service.ts:363](../../../apps/api/src/ai/ai.service.ts:363) e [adventure.service.ts:126](../../../apps/api/src/adventure/adventure.service.ts:126)) como itens comuns, sem sufixo nem seção própria. Dar significado narrativo à origem no prompt é o trabalho da [US-125](./US-125-beneficios-origem-no-system-prompt.md); duplicar aqui um rótulo de "memento"/"conexão" no texto do prompt criaria dois lugares dizendo a mesma coisa, em dois idiomas.
- **Registrar a conexão no ledger de entidades** (`Adventure.entities`, US-75/US-113). A conexão nomeia uma pessoa do mundo e o lugar natural dela seria lá, não no inventário — mas isto é outra story: exige extrair o NPC de uma frase em prosa e casá-lo com o `recordEntity`. Esta story só coloca a linha no inventário, como pedido.
- **Nome curto/curado para memento ou conexão.** Ver Questão em aberto 1 — hoje o texto do dataset é o nome, e nenhuma curadoria manual entra nesta story.
- **Editar ou trocar memento/conexão depois da criação.** São escolhidos no wizard e não têm tela de edição (mesmo estado de `background.story`, US-39). Se o item sair do inventário em jogo, `Character.origin` continua com o texto — são coisas distintas de propósito: um é a escolha da criação, o outro é o que o personagem carrega agora.
- **Procedências além de `memento`/`connection`.** O campo aceita esses dois valores e mais nada. Marcar item de kit de classe, item comprado ou item achado em jogo é generalização que ninguém pediu — quando um terceiro valor aparecer, o tipo aceita o terceiro valor.

---

## Modelo de dados proposto

Sem migração. `CharacterState.inventory` já é Json — o item ganha um campo opcional:

```ts
export interface InventoryItem {
  name: string
  qty: number
  /** US-128: procedência do item. Ausente = item comum (kit, achado em jogo). */
  origin?: 'memento' | 'connection'
}
```

- **Retrocompat total**: inventário gravado antes desta story não tem o campo e continua lendo/gravando igual; a ficha não mostra marca nenhuma nesses itens.
- **Fonte do texto**: `Character.origin.memento` e `Character.origin.connection` (US-124), sem transformação — nem `trim` extra (o `normalizeOrigin` já fez), nem truncagem.
- **O valor de `origin` no item espelha o NOME DO CAMPO de onde o texto veio**, não uma classificação do conteúdo. É o mapeamento posicional da US-124 (`tables[0]` → `connection`, `tables[1]` → `memento`, com o override `SINGLE_BLOCK_IS_MEMENTO` do Sailor) chegando até aqui sem reinterpretação: se aquele mapeamento estiver errado para alguma origem, a marca no inventário erra junto — e o lugar de corrigir continua sendo lá, não aqui.
- **`Character.origin` não muda de forma.** Continua `{ key?, connection?, memento? }`; o inventário passa a **derivar** dele na criação da aventura, não a substituí-lo.

---

## Critérios de aceite

- [ ] Personagem criado com memento e conexão escolhidos (US-124) entra na primeira aventura com **duas** linhas próprias no inventário, `qty` 1 cada, além do kit da classe.
- [ ] O nome de cada linha é exatamente o texto escolhido no wizard — sem corte, sem reticências, sem reescrita.
- [ ] Cada uma aparece na ficha com uma marca identificando o que é, ao lado do nome, e as duas marcas são **distintas entre si** (memento não é rotulado como conexão nem vice-versa); nenhuma outra linha do inventário ganha marca.
- [ ] As duas marcas têm chave de mensagem nos dois locales (pt-BR e en-US) — nenhuma string nova hardcoded no JSX (gate da US-102).
- [ ] Personagem com só um dos dois preenchido entra com só a linha correspondente (caso real: origem sem bloco de conexão, US-124 §Sailor); personagem sem nenhum entra com o kit da classe e nada mais — nenhum item vazio, nenhuma linha extra.
- [ ] O título continua contando linhas como antes: kit de 4 linhas + memento + conexão exibe `Inventário (6)`.
- [ ] **Regressão do `updateInventory`:** com as duas linhas no inventário, o Mestre adicionar ou remover **outro** item qualquer não apaga marca nenhuma — depois do turno, os dois itens continuam com seu `origin` gravado em `CharacterState.inventory`.
- [ ] O Mestre consegue remover memento ou conexão (delta negativo) como qualquer item; a linha some do inventário e `Character.origin` **não** é alterado.
- [ ] A etapa `review` do wizard (US-127) mostra memento e conexão junto dos itens do kit, com as mesmas marcas — o que o preview mostra é o que a API grava.
- [ ] Aventura já em andamento não muda de inventário por causa desta story (sem backfill); uma aventura **nova** do mesmo personagem nasce com as duas linhas.
- [ ] **Eval / teste de regressão:** teste de `adventure.service` cobrindo as 4 combinações (só memento, só conexão, ambos, nenhum) e teste do `updateInventory` provando que as marcas sobrevivem a uma alteração de inventário.

---

## Notas de implementação

- **`character.origin` já está disponível no ponto de materialização.** O `findUnique` de `createForCharacter` ([adventure.service.ts:77](../../../apps/api/src/adventure/adventure.service.ts:77)) não usa `select` — todos os campos escalares do `Character` vêm, `origin` incluído; o `include` só acrescenta `system` e `user`. Não precisa de query nova.
- **A correção do `updateInventory` é a parte que não pode ser esquecida.** O `Map<string, number>` daquele `execute` é a razão de qualquer campo extra do item ser volátil; o fix é o mapa guardar o item (`Map<string, InventoryItem>`) e a soma mexer só na `qty`. É correção na função compartilhada por todos os itens, não um caso especial de memento.
- **Linha longa no inventário.** O texto de memento/conexão é uma frase inteira (as tabelas d10 do `a5e-ag` têm linhas de ~10-25 palavras) — a linha vai quebrar em várias, ao contrário de "Adaga (2)". A ficha precisa aguentar isso sem estourar a coluna (o painel já usa texto de 13px com quebra normal); não é caso de `truncate`, porque o texto é o conteúdo, não um rótulo.
- **`getStartingInventory` continua dirigido por classe.** Memento e conexão são acrescentados **fora** dela, no chamador — a função é a que a US-127 compartilhou entre o preview e a API, e "kit da classe" continua sendo o que ela responde. Quem monta a lista final (API e preview) é que soma os dois, com a mesma regra dos dois lados.

---

## Questões em aberto

1. **O texto inteiro como nome de item é bom o bastante?** A alternativa seria um nome curto (curado ou extraído das primeiras palavras) com o texto completo como detalhe. Não entra aqui: extrair nome curto de prosa livre é heurística que erra (as linhas do dataset começam com artigo, não com o substantivo), e curadoria manual seria 420 entradas (21 origens × 10 linhas × 2 blocos). Se na prática a linha longa incomodar na ficha, a solução mais barata é visual (limitar a altura, com o texto completo no `title`), não mudar o dado.
2. **Colisão de nome entre memento/conexão e item do kit, ou entre os dois.** Se um dos textos for idêntico ao nome de um item do kit — ou, mais preocupante, ao do outro campo (improvável, mas nenhuma regra do dataset impede) —, o agrupamento por nome da US-02 junta os dois numa linha só, e o item resultante carrega só uma marca. Não se protege contra isso nesta story; vale medir contra as 21 origens antes de considerar necessário.
3. **Repetição numa aventura seguinte.** Personagem que começa uma aventura nova recebe o kit de novo, e agora memento/conexão também — é o comportamento correto (cada aventura materializa o estado inicial do zero), mas nunca foi exercitado com item vindo de `origin`. Vale um teste de que a segunda aventura tem exatamente um item de cada, não dois.

---

## Referências no código

- [apps/api/src/adventure/adventure.service.ts:107](../../../apps/api/src/adventure/adventure.service.ts:107) — `getStartingInventory`, onde a lista inicial é montada; linha 190, onde ela é gravada em `CharacterState.inventory`.
- [apps/api/src/ai/ai.service.ts:472](../../../apps/api/src/ai/ai.service.ts:472) — `updateInventory`, o `Map<string, number>` que hoje apaga campos extras do item.
- [packages/shared/src/types/character.ts:1](../../../packages/shared/src/types/character.ts:1) — `InventoryItem`, onde entra `origin?: 'memento' | 'connection'`.
- [packages/shared/src/starting-kit.ts:20](../../../packages/shared/src/starting-kit.ts:20) — `getStartingInventory`, compartilhada entre API e preview da revisão (US-127); não muda.
- [apps/web/src/components/game/GameView.tsx:531](../../../apps/web/src/components/game/GameView.tsx:531) — seção "Inventário" da ficha, onde a marca aparece.
- [apps/web/src/lib/api.ts:75](../../../apps/web/src/lib/api.ts:75) — tipo de `states[].inventory` no cliente.
- [apps/api/src/character/character.service.ts:75](../../../apps/api/src/character/character.service.ts:75) — `normalizeOrigin` (US-124), fonte de `origin.memento`/`origin.connection`; sem alteração nesta story.
