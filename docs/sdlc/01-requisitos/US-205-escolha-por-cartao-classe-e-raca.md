# US-205 — Escolha por cartão no lugar dos selects de classe e raça

**Épico:** 1 — Personagem
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada (02/09/2026)
**Depende de:** [US-203](./US-203-prosa-de-catalogo-classe-e-raca.md) — sem `kicker`/`blurb` o
cartão não tem o que mostrar. [US-204](./US-204-wizard-em-duas-colunas-com-ficha-viva.md) — o
layout de duas colunas em que a grade cabe. [US-141](./US-141-catalogo-subclasses-srd-5-1-e-marshal.md)
(**obrigatória e anterior**) — sem `config.subclasses` não há o que listar na subgrade de
subclasse. **Duas decisões de 2026-09-02** (ver *Contexto*): subclasse deixou de ser fora do
escopo, e `race-class` deixou de ser etapa única — vira `class` + `race`.
**Criada em:** 2026-09-01

**Relacionada a:**
- [backlog-redesenho-criacao-de-personagem.md](./backlog-redesenho-criacao-de-personagem.md) — o mapa, atualizado com a divisão `class`/`race`.
- [US-105](./US-105-raca-e-classe-por-chave-do-srd.md) — catálogo por chave; o cartão guarda a chave, mostra o rótulo. O `validateCatalogKey` que ele introduz é o padrão que a validação de subclasse reusa.
- [US-140](./US-140-catalogo-subracas-srd-5-1.md)/[US-142](./US-142-tracos-mecanicos-subespecie-srd-5-1.md) — raiz e subespécie: o `<optgroup>` que a grade tem de reproduzir sem `<optgroup>`.
- [US-141](./US-141-catalogo-subclasses-srd-5-1-e-marshal.md) — catálogo de subclasse; a subgrade que esta story acrescenta é a "story separada" de wiring que a US-141 previa e não nomeava.
- [US-98](./US-98-i18n-da-interface-web.md) — gênero continua com `value` em pt-BR e rótulo traduzido.
- [US-46](./US-46-acessibilidade-wcag-aa.md) — a grade continua sendo um grupo de rádio de verdade.
- [Design System](../02-design/design-system.md) — cor, borda de acento e tipografia do cartão não
  são decisão desta story: o protótipo usa os mesmos tokens `oklch` e a mesma Cinzel do produto
  (verificado ao vivo, ver *Identidade visual* no [backlog](./backlog-redesenho-criacao-de-personagem.md)). `optionCardClass` já implementa isso — a novidade aqui é a anatomia do cartão, não a cor dele.

---

## História

> **Como** jogadora na etapa de raça e classe,
> **quero** ver as opções lado a lado, com uma frase sobre cada uma,
> **para que** eu compare antes de escolher, em vez de abrir uma lista suspensa de treze palavras.

---

## Contexto e motivação

### O problema observado

A etapa `race-class` é hoje um formulário de quatro campos: nome, gênero e dois `<select>`
([`SetupWizard.tsx`](../../../apps/web/src/components/setup/SetupWizard.tsx)). Escolher `Bruxo`
não diz nada sobre jogar de bruxo; escolher `Meio-Orc` não diz o que muda. E a lista suspensa,
no telemóvel, é o seletor nativo do sistema operativo — fora da direção visual e sem espaço para
uma linha de descrição.

### Por que a solução atual não basta

- **O `<select>` não comporta prosa.** `<option>` é texto e nada mais: nem duas linhas, nem selo,
  nem espaço reservado para arte. A US-203 põe o texto no catálogo; o `<select>` não tem onde o
  mostrar.
- **A etapa `system` já provou a forma.** Ela usa `optionCardClass` — cartão com nome e uma linha
  de dica, exatamente o desenho que classe e raça precisam. A materialidade já existe no arquivo;
  o que falta é aplicá-la onde há treze opções em vez de duas.
- **Filtrar por rótulo não resolve o problema desta story, em nenhuma grade.** Quem
  nunca jogou 5e não sabe que nome procurar: digitar `bárbaro` ou `anão` pressupõe já ter
  escolhido. A varredura das opções é o próprio ato de escolher, e é o `kicker`/`blurb` da US-203
  que a torna possível — não um campo de busca.

### A proposta

Substituir os dois `<select>` por duas grades de cartão em **duas etapas** do wizard — `class`
(grade de cartões de classe, mais a subgrade de subclasse aninhada dentro do cartão de classe
quando a classe escolhida tem mais de uma opção) e `race` (grade de cartões de raça) —, cada uma
com seu painel de detalhe da opção selecionada e o espaço da arte reservado. Sem campo de busca em
nenhuma delas — ver *Fora do escopo*. Nome e gênero continuam na etapa `class`, a primeira das
duas, acima da grade — não migram para uma etapa `Identidade` no fim.

### Duas decisões de 2026-09-02

- **`race-class` vira `class` + `race`.** A versão original mantinha `race-class` como etapa
  única — regra-âncora do [backlog](./backlog-redesenho-criacao-de-personagem.md), "sem mexer na
  ordem das etapas". Essa regra ganha uma exceção nomeada: `race-class` vira `class` seguida de
  `race`, ordem do protótipo. As etapas seguintes só deslocam uma posição, sem mudar de conteúdo.
- **Subclasse sai de "fora do escopo".** O corte original citava "catálogo não existe" (US-141 em
  backlog), confundindo **catálogo** (`{key,label}`) com **wiring** (`Character` grava a chave,
  service valida) — distinção que a US-105 já fazia para raça/classe e que o protótipo resolve
  para as duas (`subclassCards`, `selectSubclass`). Reabre `Character.subclass`, inexistente até
  aqui: [`seed.ts:31-32`](../../../apps/api/prisma/seed.ts) documenta o YAGNI de subclasse como
  decisão da Fase 1 ("sem sistema de progressão para modelar contra ainda") — fica desatualizado
  a partir desta story (progressão em si continua sem existir; nível fixo em 1). Daí a seção
  *Modelo de dados proposto* abaixo, que a versão anterior não tinha.

---

## Escopo

### Dentro do escopo

- **`race-class` divide em duas etapas do wizard: `class` e `race`**, nessa ordem. `Step`/`steps`
  ([`SetupWizard.tsx:28-29`](../../../apps/web/src/components/setup/SetupWizard.tsx)) trocam
  `'race-class'` pelas duas chaves; etapas seguintes só deslocam uma posição no array.
- **Grade de cartões de classe**, na etapa `class` — `kicker`, nome, `blurb` (US-203) e o espaço
  reservado da arte. Seleção acende a borda de acento (`optionCardClass`, já existente).
- **Grade de cartões de raça**, na etapa `race`, mesma anatomia.
- **Subgrade de cartões de subclasse, aninhada dentro do cartão de classe escolhido** — mesma
  anatomia (`kicker`, nome, `blurb` de US-203), fonte é `config.subclasses[classKey]` (US-141).
  Duas regras de exibição, análogas à raiz/subespécie de raça mas invertidas (lá a maioria das
  raízes NÃO tem subespécie; aqui a maioria das classes TEM exatamente uma):
  - **Classe com 1 subclasse só** (12 das 13 — todas menos `marshal`): sem grade visível.
    `subclass` é preenchido com a única chave disponível, sem interação da jogadora. Forçar uma
    tela de "escolha" com uma opção só não é escolha.
  - **Classe com mais de uma subclasse** (`marshal`, 3): grade aparece, mesma anatomia de
    cartão/rádio das outras duas, seleção obrigatória para avançar.
- **`Character.subclass` (campo novo) grava a chave** — automática ou escolhida, mesma disciplina
  de chave-não-rótulo da US-105. Ver *Modelo de dados proposto*.
- **Painel de detalhe da opção escolhida, um por etapa**, abaixo da grade: na etapa `class`, as
  `classFeatures` de nível 1 (US-41), o kit inicial (US-51) e a subclasse resolvida (nome +
  `blurb`, mesmo quando preenchida automaticamente — a jogadora vê o que ganhou mesmo sem ter
  escolhido); na etapa `race`, os `raceFeatures` (US-142). É informação que **já existe no config**
  (subclasse por chave-mãe desde a US-141) e que hoje a jogadora só vê na revisão — subclasse nem
  isso, hoje não existe em lugar nenhum da ficha.
- **Raiz e subespécie sem `<optgroup>`:** raiz **com** subespécies não é cartão selecionável —
  vira cabeçalho de um subgrupo de cartões (a regra da US-142 preservada, noutra forma). Raiz
  **sem** subespécie é cartão normal.
- **Nome e gênero ficam na etapa `class`**, a primeira das duas, acima da grade — não migram para
  a etapa `Identidade` que o protótipo põe no fim; a ordem do produto manda (decisão do backlog).
- **Grupo de rádio de verdade** (`<fieldset>` + `<legend>` + `<input type="radio" class="sr-only">`
  dentro de `<label>`), o padrão que `WorldOptionGroup` já usa no passo `world` — não `div`
  clicável. Vale para as três grades; a de subclasse só existe fisicamente quando `marshal` está
  selecionado (as outras 12 não renderizam grade, ver acima).
- **Mobile:** uma coluna, cartão de altura livre. A subgrade de subclasse (quando existe) também
  colapsa para uma coluna.
- **i18n:** `legend` de cada grade com chave nos dois locales, incluindo a de subclasse.

### Fora do escopo

- **Nível real em que a subclasse é obtida por regra oficial (1 ou 3, varia por classe).** Fora
  de escopo por decisão de produto, não por lacuna: toda subclasse é tratada como escolhida no
  **nível 1**, para as 13 classes sem exceção (US-141 §Fora do escopo). Coerente com
  `Character.level` fixo em 1 nesta fase — escolher subclasse na criação **é** escolher no nível
  em que a personagem está, não uma antecipação. Quando a progressão existir, essa simplificação é
  quem decide se some.
- **Variantes de espécie** no sentido do protótipo. O produto modela isso como subespécie no mesmo
  catálogo (US-140); traduzir um desenho de dado no outro é mudança de modelo, não de tela.
- **Arte por classe/raça/subclasse.** Espaço reservado; produzir os assets é outra story (backlog,
  *Fora do escopo*).
- **Cartão para o gênero.** São três valores sem prosa; o `<select>` continua adequado e o `value`
  em pt-BR (US-98) não muda.
- **Busca em qualquer das três grades.** O protótipo tem `Buscar classe…`/`Buscar espécie…`; o
  produto não. Filtrar por rótulo é atalho para quem já sabe o que quer, e esconde as outras
  opções de quem não sabe — o oposto do que esta story existe para fazer. A grade de raça tem hoje
  9 cartões selecionáveis (4 raízes com subespécie agrupada + 5 sem), a de subclasse no máximo 3
  (só `marshal` renderiza); se a US-140 ou um sistema de `UPLOAD` crescer isso o bastante para
  precisar de busca, é story própria, com o mesmo argumento do `kicker`/`blurb` revisitado — não
  reintroduzida de graça porque "já existia no protótipo".

---

## Modelo de dados proposto

Raça e classe já tinham wiring pronto (US-105): `Character.race`/`.class` gravam chave,
`validateCatalogKey` valida contra o catálogo. Subclasse não tinha nada — esta story constrói o
mesmo caminho, copiando o padrão que `origin.key` já usa para "chave opcional, validada só quando
presente" ([`character.service.ts:45-47`](../../../apps/api/src/character/character.service.ts)).

```prisma
// apps/api/prisma/schema.prisma — model Character
race           String
class          String
subclass       String?   // novo: chave de config.subclasses[class]; null quando a classe/sistema
                          // não tem catálogo de subclasse, ou (hoje) nunca — as 13 classes do
                          // srd-5e sempre têm ao menos 1 entrada (US-141)
```

```ts
// apps/api/src/character/character.schema.ts — CreateCharacterSchema, irmão de `class`
subclass: z.string().max(40).optional(),
```

```ts
// apps/api/src/character/character.service.ts — mesmo padrão de origin.key (linha 45-47)
const subclassCatalog = config.subclasses?.[charClass]
const subclass = dto.subclass
  ? this.validateCatalogKey(subclassCatalog, dto.subclass, 'Subclasse')
  : subclassCatalog?.length === 1
    ? subclassCatalog[0].key // classe com 1 subclasse só: preenche mesmo sem o DTO mandar
    : undefined
```

| Campo | Antes | Depois |
|---|---|---|
| `Character.subclass` | inexistente | `String?` — chave de `config.subclasses[class]`, automática ou escolhida |
| `CreateCharacterSchema.subclass` | inexistente | `z.string().max(40).optional()` |

**Persistência:** migração Prisma nova (coluna nullable, sem backfill — nenhuma ficha existente
tem subclasse para inferir; todas migram com `subclass: null`). Sistema sem `config.subclasses`
(`Free`, `UPLOAD` sem catálogo) segue criando personagem normalmente, `subclass` fica `null` —
mesmo comportamento de fallback que `races`/`classes` ausentes já têm (US-105 §O que a
implementação decidiu).

**Onde vive o preenchimento automático (12 das 13 classes):** no **service**, não no wizard. O
DTO pode simplesmente nunca mandar `subclass` para essas 12 — o service resolve a única entrada do
catálogo sozinho, mesmo espírito de `originSkills`/`skillGrant` aplicando grant sem exigir round-
trip do cliente. O wizard só precisa saber "não mostrar grade quando `subclassCatalog.length <= 1`"
para decidir a UI; a gravação da chave não depende dele acertar isso.

---

## Critérios de aceite

- [x] As etapas `class` e `race` não têm nenhum `<select>` de classe ou de raça; cada uma tem sua
      grade de cartão — `class` mais a subgrade de subclasse aninhada quando a classe escolhida
      tem mais de uma.
- [x] `Step`/`steps` (`SetupWizard.tsx:28-29`) trocam `'race-class'` por `'class'` seguido de
      `'race'`, nessa ordem; nenhuma etapa depois de `race` muda de posição relativa às outras
      (`background` continua logo em seguida, agora na 4ª posição em vez da 3ª).
- [x] Cada cartão mostra `kicker`, rótulo e `blurb` quando o catálogo os traz, e continua legível
      e selecionável quando **não** os traz (sistema `Free`, sistema de `UPLOAD`).
- [x] Escolher um cartão grava a **chave**, não o rótulo — a mesma chave que o `<select>` gravava
      (US-105), verificável no corpo enviado à API. Vale para classe, raça **e subclasse**.
- [x] Raça raiz **com** subespécies não é selecionável e as suas subespécies aparecem agrupadas
      sob ela; raça raiz **sem** subespécie é selecionável (US-142 preservada).
- [x] Classe com **uma só** subclasse (12 das 13) não renderiza subgrade nenhuma, e
      `Character.subclass` grava a única chave disponível mesmo assim, sem interação da jogadora.
- [x] Classe com **mais de uma** subclasse (`marshal`) renderiza a subgrade, seleção obrigatória
      para avançar, mesma anatomia de cartão/rádio das outras grades.
- [x] Nenhuma das três grades tem campo de busca; todas as opções (13 classes, 9 raças
      selecionáveis, até 3 subclasses quando a subgrade existe) estão no DOM sem filtro nenhum.
- [x] Trocar de classe continua a limpar o que dela dependia (`skills`, kit) exatamente como hoje,
      **e agora também limpa `subclass`** — trocar de Guerreiro para Bárbaro não pode deixar
      `champion` gravado.
- [x] Navegar por teclado percorre os cartões como um grupo de rádio (setas), o foco é visível, e
      cada grade tem `legend` associada (US-46).
- [x] Em 360 px de largura a grade é uma coluna, sem rolagem horizontal (US-66).
- [x] `canAdvance('class')` exige nome, gênero e classe preenchidos e, quando a classe escolhida
      tem mais de uma subclasse, também `subclass` preenchido — condição nova, análoga à regra que
      hoje vive em `canAdvance('race-class')`. `canAdvance('race')` exige raça preenchida; nas 12
      classes com subclasse única, a condição de `subclass` já está satisfeita pelo preenchimento
      automático (não é visível pra jogadora — é a mesma regra "classe do catálogo" estendida).
- [x] Personagem criado com chave de subclasse que não pertence à classe escolhida (ex.: `class:
      'fighter'`, `subclass: 'life-domain'`) é rejeitado com `BadRequestException`, mesmo padrão
      de `validateCatalogKey` para raça/classe/origem — sem gravação parcial.
- [x] **Eval / teste de regressão:** teste em `SetupWizard.test.tsx` que seleciona classe **pelo
      cartão** na etapa `class`, avança para `race`, seleciona raça **pelo cartão** e afirma que
      `createCharacter` recebe as chaves canônicas (`wizard`, `hill-dwarf`), não os rótulos pt-BR.
      É o teste que falha se alguém, ao trocar `<select>` por cartão, passar a gravar o texto
      visível — o bug exato que a US-105 existiu para corrigir.
- [x] **Eval / teste de regressão (subclasse):** teste em `character.service.spec.ts` (ou
      equivalente) cobrindo três casos — classe com 1 subclasse sem DTO mandar `subclass` (grava
      a única chave sozinho), classe `marshal` com `subclass` válido do trio, e `subclass` que
      pertence a outra classe (rejeitado com `BadRequestException`, mensagem cita a chave e a
      classe, mesmo padrão de `validateCatalogKey`).

---

## Notas de implementação

> Dicas, não especificação. Quem implementa pode divergir com justificativa.

- **Dividir a etapa em duas mexe em `setStep`/`goNext`/`goBack`, não só em `Step`/`steps`.** Cada
  ramo que hoje testa `step === 'race-class'`
  ([`SetupWizard.tsx:397,403,629`](../../../apps/web/src/components/setup/SetupWizard.tsx)) vira
  dois ramos, um por `'class'` e outro por `'race'`. O avanço `class` → `race` é uma transição nova
  — dentro da etapa antiga não havia sub-navegação nenhuma, então não é troca mecânica de string.
- **Um componente de grade, dois usos.** Classe e raça têm a mesma anatomia; um
  `CatalogCardGroup` parametrizado por catálogo, valor e `onChange` evita escrever a grade duas
  vezes — e é o mesmo componente que a [US-206](./US-206-origem-por-cartao-e-campos-livres-de-historia.md)
  vai reusar para a origem.
- **`WorldOptionGroup` é o molde de acessibilidade**, não o de conteúdo: copiar dele o
  `<fieldset>`/`<legend>`/`sr-only` e acrescentar o corpo do cartão.
- **O agrupamento raiz→subespécie já está escrito** no `<select>` atual (o `filter(r => !r.parentKey)`
  seguido do `filter(r => r.parentKey === root.key)`): reaproveitar a lógica, trocar `<optgroup>`
  por cabeçalho de subgrupo.
- **O painel de detalhe não precisa de dado novo.** `getClassFeatures`, `getStartingInventory` e o
  catálogo de `raceFeatures` já estão importados no arquivo (o preview da revisão usa-os).
- **O arquivo já passa de 1100 linhas.** Extrair cada etapa para o seu componente é parte do
  trabalho, não um refactor opcional — o teto do `AGENTS.md` é 500.
- **Não apagar os comentários existentes** ao mexer no bloco de raça: os que explicam US-140/US-142
  dizem por que a raiz some da lista, e essa regra continua a valer na grade.
- **`validateCatalogKey` já aceita `undefined` de catálogo** (`character.service.ts:145`: `if
  (!catalog || catalog.length === 0) return key`) — mas para subclasse a chamada só acontece
  quando `dto.subclass` **está presente**; o preenchimento automático das 12 classes de entrada
  única não passa por `validateCatalogKey` nenhuma, é `subclassCatalog[0].key` direto (ver
  *Modelo de dados proposto*). Não force as duas por um caminho só — são casos com regras
  diferentes (uma nunca falha, a outra pode rejeitar).
- **Atualize [`seed.ts:31-32`](../../../apps/api/prisma/seed.ts)** — o comentário que documenta o
  YAGNI de subclasse fica desatualizado por esta story; reescreve para dizer o que passa a ser
  verdade: a escolha deixou de ser YAGNI, e toda subclasse é tratada como nível 1 por decisão de
  produto (US-141 §Fora do escopo) — progressão de nível em si continua sem existir.
- **Migração Prisma:** coluna nova, nullable, sem dado a migrar (nenhuma ficha tem subclasse hoje)
  — mais simples que a migração de dados que a US-105 precisou.

---

## Referências no código

- [`apps/web/src/components/setup/SetupWizard.tsx:28-29`](../../../apps/web/src/components/setup/SetupWizard.tsx) — `type Step` e `const steps`: onde `'race-class'` vira `'class'` + `'race'`.
- [`apps/web/src/components/setup/SetupWizard.tsx`](../../../apps/web/src/components/setup/SetupWizard.tsx) — `optionCardClass`, `WorldOptionGroup`, os blocos `step === 'race-class'` (linhas 397, 403, 629) e o agrupamento raiz/subespécie do `<select>`.
- [`packages/shared/src/types/system.ts`](../../../packages/shared/src/types/system.ts) — `RaceCatalogEntrySchema.parentKey`: a regra de raiz e subespécie; `config.subclasses` (US-141) é onde a subgrade lê.
- [`packages/shared/src/starting-kit.ts`](../../../packages/shared/src/starting-kit.ts) — `getStartingInventory`: o "equipamento icônico" do cartão de classe, sem dado novo.
- [`apps/web/src/components/setup/SetupWizard.test.tsx`](../../../apps/web/src/components/setup/SetupWizard.test.tsx) — os testes que hoje interagem com os `<select>` e vão precisar de interagir com cartões.
- [`apps/api/prisma/schema.prisma`](../../../apps/api/prisma/schema.prisma) — `model Character`, `race`/`class` como `String`: onde `subclass String?` entra ao lado.
- [`apps/api/src/character/character.schema.ts`](../../../apps/api/src/character/character.schema.ts) — `CreateCharacterSchema`, `race`/`class`/`origin.key`: onde `subclass` entra.
- [`apps/api/src/character/character.service.ts:37-47`](../../../apps/api/src/character/character.service.ts) — `validateCatalogKey` (raça/classe) e o padrão `origin.key` opcional (linha 45-47): o molde direto para a validação de subclasse. `:144-152` é a própria função.
- [`apps/api/prisma/seed.ts:31-32`](../../../apps/api/prisma/seed.ts) — o comentário do YAGNI de subclasse que esta story torna desatualizado.
- [US-141](./US-141-catalogo-subclasses-srd-5-1-e-marshal.md) — `config.subclasses`, dependência direta desta story.
- [`wizard-criacao-personagem-referencia.html`](./wizard-criacao-personagem-referencia.html) — o protótipo: grade de cartões, `subclassCards`/`selectSubclass` (aninhado na etapa de classe), filtro (`classFilter`/`speciesFilter`) e painel de detalhe. Nenhum dos dois filtros é adotado.
