# US-109 — Espaço para bônus/penalidade circunstancial no teste de d20

**Épico:** 3 — Narração e mecânica
**Fase:** 1 — MVP single-player
**Status:** 🗂️ Backlog
**Depende de:** [US-38](./US-38-rolagens-ancoradas-na-ficha.md) (é a resolução do modificador dela que ganha um termo a mais) · [US-108](./US-108-tabela-de-modificadores-do-srd-2024.md) (o `Rule.json` do SRD 2024 já entrou no `sync`; o texto normativo do d20 test já está baixado)
**Relacionado:** [US-27](./US-27-pericias-do-personagem.md) (o modificador da ficha, que continua sendo o outro termo) · [US-29](./US-29-saneamento-de-rolagens-ficticias.md) (o bloco de rolagem exibido antes da narração) · [US-75](./US-75-dimensao-de-proveniencia-no-ledger.md) (proveniência no ledger — é a mesma disciplina aplicada à rolagem) · [US-48](./US-48-getrule-corpus-de-regras.md) (o corpus que um dia dará vocabulário fechado de circunstância) · [ADR 003](../../adr/003-sistemas-como-dado.md) (sistema como dado)
**Criada em:** 2026-08-06

---

## História

> **Como** mantenedora do sistema de regras,
> **quero** que a soma de um teste de d20 tenha um **termo separado e nomeado** para bônus/penalidade circunstancial — mesmo que hoje **nenhuma fonte o alimente**,
> **para que** a primeira fonte real (condição, item, magia, cobertura) entre por um lugar previsto e auditável, em vez de ser somada por dentro do modificador da ficha.

---

## Contexto e motivação

### O problema observado

O SRD 2024 define o **D20 Test** como uma soma de termos de origens diferentes: o d20, o modificador de habilidade, o bônus de proficiência quando se aplica, e **bônus/penalidades circunstanciais**. O ruleset `srd-2024_d20-tests` (já baixado no `Rule.json` pela [US-108](./US-108-tabela-de-modificadores-do-srd-2024.md), tag `v2.1.0`) tem as quatro regras:

| `pk` | Nome |
|---|---|
| `srd-2024_d20-tests_ability-checks` | Ability Checks |
| `srd-2024_d20-tests_saving-throw` | Saving Throws |
| `srd-2024_d20-tests_attack-rolls` | Attack Rolls |
| `srd-2024_d20-tests_advantage-disadvantage` | Advantage/Disadvantage |

No código, a soma é **um número só**. [`resolveRollModifier`](../../../packages/shared/src/roll.ts) devolve `{ modifier, unresolved, label }`, e esse `modifier` é definido pela [US-38](./US-38-rolagens-ancoradas-na-ficha.md) como *"vem SEMPRE da ficha"*. A tool `rollDice` monta `1d20+3`, o [`DiceService`](../../../apps/api/src/game/dice.service.ts) soma, e o `EventLog` grava `modifier: 3`. **Não existe onde pôr um `+2` que não seja da ficha.**

### Por que a solução atual não basta

Não é um bug hoje: hoje não há fonte de circunstância nenhuma. É a forma como a primeira fonte vai entrar que é o problema.

Quando alguém implementar a primeira (uma condição que impõe penalidade, um item que dá bônus, uma bênção), o caminho de menor esforço é somar dentro de `modifier`. Aí três coisas quebram de uma vez:

1. **O bloco de rolagem passa a mentir.** [`formatDiceBreakdown`](../../../packages/shared/src/narration.ts) exibe `1d20+5: [14] +5 = 19` ao lado do rótulo da perícia. Se `+5` for `+3 de Percepção +2 de tocha`, a ficha e o bloco discordam e o jogador não tem como saber por quê.
2. **O `EventLog` perde a razão do número.** O payload do `DICE_ROLL` grava `modifier` e `skill` — com os dois termos fundidos, o ledger deixa de reconstruir a conta, que é justamente o que a [US-75](./US-75-dimensao-de-proveniencia-no-ledger.md) pede do resto do ledger.
3. **O guard da US-38 fica cego.** A invariante *"o modelo nunca fornece um número"* só é verificável enquanto todo número tiver origem declarada. Um `modifier` que às vezes é da ficha e às vezes é "da ficha mais outra coisa" não é mais uma invariante testável.

O campo `CharacterState.conditions` (`Json @default("[]")`, [`schema.prisma`](../../../apps/api/prisma/schema.prisma)) mostra o tamanho da lacuna: ele existe, é lido em [`ai.service.ts`](../../../apps/api/src/ai/ai.service.ts) e vai para o bloco de estado do turno **como texto para o modelo ler** — mas nada escreve nele e nada o converte em número. Condição, hoje, é prosa.

### A proposta

Abrir **um termo a mais** na resolução de um teste — `circumstance`, separado do modificador da ficha — junto com o ponto único onde as fontes desse termo serão coletadas. A lista de fontes nasce **vazia**: o valor é sempre `0` até que alguma story mapeie a primeira.

O que a story entrega hoje é a **costura**, não o efeito: um lugar nomeado, com teste, com proveniência no log, e com a garantia de que o modelo continua sem conseguir injetar número. O que ela evita é a alternativa — a primeira fonte chegar e ser somada no lugar errado.

---

## Escopo

### Dentro do escopo

- **Termo separado no retorno de `resolveRollModifier`** — passa a devolver `sheet` (o modificador da ficha, o que hoje se chama `modifier`) e `circumstance`, com `modifier` mantido como **soma dos dois**. Chamadores existentes não mudam: `modifier` continua sendo o total que entra na fórmula.
- **Ponto único de coleta** — uma função em [`roll.ts`](../../../packages/shared/src/roll.ts) que recebe as fontes visíveis do turno (as `conditions` do `CharacterState`) e devolve `{ total, parts }`. Hoje devolve `{ total: 0, parts: [] }` porque **nenhuma fonte está mapeada** — mas é chamada em produção, então não é export morto para o `pnpm dead` ([US-89](./US-89-gate-de-codigo-morto-com-knip.md)).
- **Entrada desconhecida não vira número** — condição/fonte fora do mapa é ignorada com `warn`, nunca vira `+0` silencioso nem lança no meio de um turno. Mesma disciplina do `unresolved` da US-38.
- **Proveniência no `EventLog`** — o payload do `DICE_ROLL` grava `sheet` e `circumstance` (e as `parts` quando houver), não só o total.
- **O modelo continua sem número** — o schema Zod da tool `rollDice` **não** ganha campo numérico nem campo de circunstância. Critério de aceite explícito, porque é a tentação óbvia de quem implementar a primeira fonte.

### Fora do escopo

- **Vantagem/desvantagem.** Não é termo de soma: é um **segundo d20**, com regra própria de não-empilhamento e cancelamento mútuo (`srd-2024_d20-tests_advantage-disadvantage`). Enfiar isso no campo de bônus é o erro clássico. Story própria — e ela vai mexer no `DiceService`, que esta aqui não toca.
- **Qualquer fonte real de circunstância** — condições com efeito mecânico, itens mágicos, cobertura, magias de buff, Heroic Inspiration. É exatamente o que "ainda não tem nada que entre aí" quer dizer.
- **Os outros dois D20 Tests** — saving throw e attack roll não existem como tool hoje (a `rollDice` é sempre teste de perícia/atributo). Quando existirem, herdam o mesmo termo.
- **Comparação com CD/CA.** O Game Server devolve o total; quem julga sucesso é a narração. As tabelas de CD do SRD (`Very easy 5` … `Nearly impossible 30`) e o `Rolling 20 or 1` do attack roll ficam para as stories dos respectivos testes.
- **Mudança de interface.** Enquanto o termo for sempre `0`, o bloco de rolagem não tem o que mostrar a mais. O `formatDiceBreakdown` ganha o split junto com a primeira fonte, não antes.
- **Importar o texto das quatro regras do d20 test como artefato.** O `Rule.json` já está baixado; extrair/curar esse texto é da [US-48](./US-48-getrule-corpus-de-regras.md).

---

## Modelo de dados proposto

Sem migração: nada muda no schema. Muda o **retorno** da resolução e o **payload** do evento.

```json
{
  "formula": "1d20+3",
  "rolls": [14],
  "sheet": 3,
  "circumstance": 0,
  "circumstanceParts": [],
  "modifier": 3,
  "total": 17
}
```

| Campo | Tipo | Descrição |
|---|---|---|
| `sheet` | inteiro | Modificador vindo da ficha (atributo + proficiência) — o que a US-38 já resolvia. |
| `circumstance` | inteiro | Soma dos bônus/penalidades circunstanciais. **Sempre `0` até a primeira fonte existir.** |
| `circumstanceParts` | lista | `{ source, value }` de cada parcela, para o bloco e para o log. Vazia hoje. |
| `modifier` | inteiro | `sheet + circumstance`. Continua sendo o número que entra na fórmula e o que os chamadores atuais leem. |

**Persistência:** `payload` do `EventLog` do tipo `DICE_ROLL` (JSON, sem migração). O `DiceResult` do `DiceService` não muda — o split é montado na tool, acima dele.

---

## Critérios de aceite

- [ ] `resolveRollModifier` devolve `sheet` e `circumstance` além de `modifier`, e `modifier === sheet + circumstance` em todos os caminhos (inclusive no `unresolved`, onde `sheet` é `0`).
- [ ] Existe **um** ponto de coleta do termo circunstancial, chamado pelo caminho de produção da tool `rollDice`, que hoje devolve total `0` e lista vazia.
- [ ] Fonte não mapeada (condição desconhecida no `CharacterState.conditions`) é **ignorada com `warn`** — não vira número, não interrompe o turno.
- [ ] O payload do `DICE_ROLL` grava `sheet` e `circumstance` separados; o total continua conferindo com `rolls` + `modifier`.
- [ ] O schema Zod da tool `rollDice` **não** aceita número nem circunstância vindos do modelo — a invariante da [US-38](./US-38-rolagens-ancoradas-na-ficha.md) segue verificável.
- [ ] Nada muda no que o jogador vê: com `circumstance === 0`, o bloco de rolagem é byte a byte o de hoje.
- [ ] **Eval / teste de regressão:** com uma **fonte falsa** injetada no teste (classe/objeto nomeado, não stub inline — `AGENTS.md`) valendo `+2` e `-1`, o termo soma `+1`, `modifier` vira `sheet + 1` e a fórmula reflete o total. Guarda de vacuidade: o teste **não** pode usar a lista real de fontes (vazia), senão passa sem exercitar nada. Mais um caso com a lista real, provando que hoje o resultado é idêntico ao da US-38.

---

## Notas de implementação

- **O `DiceService` não muda.** O `DICE_FORMULA_RE` aceita **um único** `[+-]\d+`; a fórmula continua carregando o total (`1d20+3`). O split vive no retorno da tool e no payload, não na string.
- **Soma é comutativa** — a separação existe para proveniência e para o bloco, não para a matemática. Não invente ordem de aplicação que o SRD não define.
- **"Round Down" não se aplica** aqui: parcelas circunstanciais são inteiras. O arredondamento é da tabela de modificadores ([US-108](./US-108-tabela-de-modificadores-do-srd-2024.md)).
- **Onde a primeira fonte vai plugar:** `CharacterState.conditions` já existe no schema, já é lido no turno e já vai para o prompt como texto. É o candidato natural — e hoje é sempre `[]`, porque nenhuma tool escreve nele.
- **Não criar módulo novo.** O termo é da mesma unidade de trabalho de `resolveRollModifier`: fica em `roll.ts`, que tem 60 linhas.
- **Comentário do PORQUÊ obrigatório** no campo: sem ele, o próximo leitor vê um campo que é sempre `0` e apaga. O comentário cita esta US e diz que a lista de fontes é vazia **por decisão**, não por esquecimento.

---

## Questões em aberto

1. **Costura nomeada ou só o campo?** Um parâmetro opcional em `resolveRollModifier`, sem função de coleta, é menos código — mas aí o "espaço" fica invisível (nenhum chamador o passa) e não há lugar óbvio para a primeira fonte. **Recomendação:** a função de coleta, justamente porque ela é chamada em produção e nomeia o vazio.
2. **Teto e piso do termo?** O SRD não define limite para bônus circunstancial acumulado. Vale uma faixa de sanidade (ex.: `-10..+10`, lançando com o valor ofensor, no padrão do `AGENTS.md`) ou é regra inventada? Decidir antes da primeira fonte, não agora.
3. **O modelo pode *nomear* uma circunstância?** Um vocabulário fechado (`"escuridão"`, `"terreno difícil"`) em que o modelo escolhe o rótulo e o **servidor** resolve o número não viola a US-38 — mas depende de um vocabulário que não existe. Fica para depois do corpus de regras ([US-48](./US-48-getrule-corpus-de-regras.md)).

---

## Referências no código

- `packages/shared/src/roll.ts` — `resolveRollModifier`: onde o termo separado nasce e onde a coleta vai morar.
- `packages/shared/src/roll.test.ts` — os testes da US-38; a fonte falsa e a guarda de vacuidade entram por cima.
- `apps/api/src/ai/ai.service.ts` — a tool `rollDice` (monta a fórmula, grava o `DICE_ROLL`) e a leitura de `conditions` para o bloco de estado do turno.
- `apps/api/src/game/dice.service.ts` — `DICE_FORMULA_RE` aceita um único `[+-]\d+`: a razão de o split não ir para a fórmula.
- `packages/shared/src/narration.ts` — `formatDiceBreakdown`, o formato do bloco que **não** muda enquanto o termo for `0`.
- `packages/shared/src/types/game.ts` — `DiceResult` / `RollTurn`, o contrato que o frame `D:` carrega até o front.
- `apps/api/prisma/schema.prisma` — `CharacterState.conditions`, a fonte candidata que existe e está sempre vazia.
- `scripts/srd/_data/Rule.json` — as quatro regras do ruleset `srd-2024_d20-tests` (baixadas pela US-108, não versionadas).
