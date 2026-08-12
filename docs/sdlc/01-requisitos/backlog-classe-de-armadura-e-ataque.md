# Backlog — Classe de armadura e resolução de ataque

**Objetivo:** um ataque passa a ter **número-alvo**. Hoje o d20 tem alvo em tudo menos no ataque:
as US-108…111 deram modificador, bônus circunstancial, tabela de teste e tabela de CD — e o
ataque continua sem nada contra o que comparar.

**Decisão de produto pendente:** é **a mesma** do [backlog de economia de
recursos](./backlog-economia-de-recursos-do-personagem.md) — narrador permissivo vs árbitro de
regra. Aqui pesa mais, porque acertar ou errar um golpe é a coisa que o jogador mais sente. Ver
*Decisões abertas* #1.

**Criado em:** 2026-08-12
**Atualizado em:** 2026-08-12 (mesmo dia) — a triagem do `blakewatson/minimal-character-sheet`
**inverteu o default do DEF-2**: CA armazenada, derivação como ajudante. Ver *Referências externas*.

Este documento **não é uma user story**. É a sequência de tarefas até o objetivo, com dependências
e o que já existe. Cada item vira um `US-*.md` próprio quando entrar em execução.

> **Rótulos, não números de story.** `DEF-1`…`DEF-6` são identificadores **internos deste
> documento**. O número real (`US-NNN`) é atribuído no dia em que a story for escrita.

---

## O estado verificado

Levantado em 12/08/2026 em `packages/shared/src`, `packages/ai-engine/src`, `apps/api/src` e
`schema.prisma`. Três achados, e o terceiro muda o enquadramento do backlog inteiro.

**1. CA não existe.** Um único hit de `armorClass`/`armadura`/`armor` em todo o código-fonte, e é
uma string de fixture num teste de bake-off. `CharacterState`
([`schema.prisma:46`](../../../apps/api/prisma/schema.prisma)) tem `hp`, `maxHp`, `attributes`,
`inventory`, `conditions`, `sceneState`.

**2. Não há de onde derivar.** [`character.ts:1`](../../../packages/shared/src/types/character.ts):

```ts
export interface InventoryItem {
  name: string
  qty: number
}
```

Nome e quantidade. *"Armadura de placas"* é uma string. Não há tipo de armadura, valor de CA, teto
de Destreza nem marca de escudo — e os `startingKits` da US-51 vêm de parsear uma tabela markdown
de texto livre, então nasceram assim na origem.

**3. O ataque não é resolvido mecanicamente — e isso é o padrão da casa, não um bug.**
`rollDice` ([`ai.service.ts:349`](../../../apps/api/src/ai/ai.service.ts)) recebe
`reason`/`skill`/`ability`/`dice` — **não recebe CD nem alvo** — e devolve
`{ rolls, modifier, total, reason, skill }`, **sem veredito**. Quem decide se acertou é o modelo.

Não é descuido: é a mesma escolha que as US-110/111 fizeram. A tabela de CD do SRD 2024 entra no
**prompt** via `abilityCheckTable`
([`dm-system.ts:183`](../../../packages/ai-engine/src/prompts/dm-system.ts), chamada em `:308`),
não numa tool. Número é *awareness*; o modelo arbitra. E `updateCharacterHp` recebe `newHp` já
calculado pelo modelo.

> Registrado porque eu mesma levantei a hipótese contrária antes de verificar: **não é o caso de
> "o modelo inventa a CA do alvo"**, irmão do `stripFabricatedRolls`. É que não existe CA nenhuma
> para inventar, e a arbitragem é model-side por desenho em todo o d20. Este backlog propõe mudar
> isso **só para ataque**, e a *Decisão aberta* #2 é sobre a inconsistência que isso cria.

---

## A assimetria que define a ordem

As duas CAs não custam a mesma coisa nem pagam a mesma coisa.

| | CA do **monstro** | CA do **personagem** |
|---|---|---|
| De onde vem | do statblock — **GEN-9** do [backlog do motor](./backlog-motor-de-geracao-de-aventuras.md), que está no **caminho crítico da fase 1** | de derivação sobre o item equipado, que hoje é só um nome |
| Custo | quase zero: usar um campo de um artefato que já vai existir | alto: exige chave canônica de item e dado de armadura no artefato |
| O que desbloqueia | **o ataque do jogador** — o caso comum, todo turno de combate | o ataque do monstro contra o jogador, hoje 100% narrado |

Logo: **monstro primeiro.** Fazer a CA do personagem antes é pagar a parte cara para destravar o
caso raro.

---

## Depende de

| # | Dependência | Estado | Onde dói |
|---|---|---|---|
| **D1** | **Chave canônica de item** | `InventoryItem.name` é **rótulo**, não chave — o mesmo problema que a [US-105](./US-105-raca-e-classe-por-chave-do-srd.md) resolveu para raça e classe, ainda não resolvido para item | Bloqueia DEF-1 e DEF-2. Sem chave, propriedade de armadura teria de casar por string traduzida, e o repo é bilíngue ([ADR 005](../../adr/005-locale-como-dimensao.md)) |
| **D2** | **GEN-9 — statblocks por papel** | No **caminho crítico** do backlog do motor (Minion/Soldier/Brute, do `5e_Monster_Builder.json`; *"não precisa ingerir monstro do SRD"*) | Bloqueia DEF-3 e DEF-5 — mas é fase 1 e já planejado, não é dependência remota |
| **D3** | **A decisão árbitro vs narrador** | Aberta, compartilhada com o backlog de economia de recursos | Bloqueia o backlog inteiro. Ver *Decisões abertas* #1 |

---

## Tarefas

**✱ DEF-0 — confirmar que o statblock traz CA**
Uma leitura do `5e_Monster_Builder.json`, antes de qualquer código. A tabela da AV-6 no backlog do
Lazy GM cita PV e perícia (*"o stirge do Gardren: 10 PV, Furtividade +5"*) — **não cita CA**. Se o
artefato não trouxer, DEF-3 deixa de ser barata e a assimetria acima se inverte.
Meia hora. É o item que decide a ordem do resto.
Depende de: nada.

**✱ DEF-3 — CA do monstro, vinda do statblock**
Expor a CA do papel (Minion/Soldier/Brute) onde o turno a alcance. O trabalho é de encanamento,
não de modelagem: o número já existe no artefato da GEN-9.
Depende de: DEF-0, D2.

**✱ DEF-4 — o ataque ganha número-alvo**
Hoje `rollDice` devolve total sem veredito. Para o ataque resolver, ou a tool passa a aceitar alvo
e devolver sucesso/falha, ou nasce tool separada.
⚠ Mexer na `description` do `rollDice` toca **âncora de eval** —
[`evals/PROMPT-ANCHORS.md`](../../../evals/PROMPT-ANCHORS.md) registra que nomes de tool e trechos
de `description` são âncoras. Reancorar junto.
⚠ Conflita com a trava da US-38 (*"um teste ancorado por turno"*, `ai.service.ts:369`): ataque e
teste de perícia no mesmo turno são dois testes legítimos, e a trava reusa o primeiro. A US-38 já
previu isso — *"se um dia um turno precisar de dois testes distintos legítimos, trocar por regra
mais fina"*. É aqui.
Depende de: DEF-3.

**DEF-1 — o item deixa de ser só nome**
`InventoryItem` ganha identidade e propriedade: chave canônica + dado de armadura (valor de CA,
categoria leve/média/pesada, teto de Destreza, marca de escudo). Fonte: o mesmo Open5e pinado
([ADR 004](../../adr/004-origem-do-dado-de-sistema.md) / [ADR 009](../../adr/009-uniao-dos-srd-5-1-e-5-2.md)).
Seguir o padrão da US-105/106: o `Character` guarda a **chave**, a tela e o prompt resolvem o
rótulo na leitura — não duplicar propriedade dentro do inventário do personagem.
Custo real desta tarefa é a **migração de rótulo para chave** nos inventários já gravados, não o
campo novo.
Depende de: D1.

**DEF-2 — CA do personagem: campo armazenado, com derivação como ajudante**
A árvore de regra, tal como o parser de importação do
[nisakson2000/dnd-tracker](https://github.com/nisakson2000/dnd-tracker) a codifica (lido em
12/08/2026, ver *Referências externas*):

- base `10 + mod. Destreza`;
- armadura equipada **substitui** a base;
- leve soma a Destreza inteira; média capa em `+2`; pesada não soma nada;
- escudo soma `+2`.

**A primeira versão deste item dizia "derivar na leitura, não armazenar", e estava errada.** A
correção veio do [blakewatson/minimal-character-sheet](https://github.com/blakewatson/minimal-character-sheet)
(MIT, mantido, último push 11/08/2026), cujo modelo guarda `ac: 10` como valor direto — e derivar
proficiência, ali, vem **com** `proficiencyOverride` por cima.

O motivo é de regra, não de arquitetura: derivar CA em 5e corretamente exige o catálogo de itens
**mais** tudo que a altera — Defesa sem Armadura do bárbaro (`10 + DES + CON`) e do monge
(`10 + DES + SAB`), Armadura Arcana, armadura natural, bônus de feito. A derivação acerta o caso
comum e erra os interessantes; e ela erra **em silêncio**, devolvendo um número plausível.

Então: **o campo é armazenado e é a fonte de verdade.** A derivação vira ajudante que o preenche
na criação e ao trocar de item, não a autoridade que o substitui na leitura.
Consequência de ordem: isto **funde DEF-2 e DEF-6** — o "override" deixa de ser escotilha e passa
a ser o caminho normal. Ver DEF-6.
Depende de: DEF-1 (só para o ajudante; o campo armazenado sozinho não depende do inventário).

**DEF-5 — o monstro ataca o jogador**
Fecha o laço: bônus de ataque do statblock (D2) contra a CA do personagem (DEF-2). É onde a parte
cara paga. Hoje é inteiramente narrado.
Depende de: DEF-2, DEF-3.

**DEF-6 — absorvido pelo DEF-2**
Nasceu como "override manual, escotilha de escape sobre a derivação". Com a inversão do DEF-2 não
há o que sobrepor: o valor **é** o campo. O que sobra deste item é uma pergunta de UI — se a tela
mostra que aquele número veio do ajudante ou foi escrito à mão — e isso não é backlog de mecânica.

Mantido como rótulo para as dependências não quebrarem, e **fechado**. Se a inversão do DEF-2 for
revertida, este item volta a existir com o texto original.
Depende de: —

---

## Corte mínimo

Para o **jogador acertar ou errar** um golpe: **DEF-0 + DEF-3 + DEF-4** — três stories, e nenhuma
delas toca o inventário.

**A inversão do DEF-2 barateou o segundo laço.** Enquanto a CA do personagem era derivada, ela
arrastava DEF-1 e a D1 inteira; como campo armazenado, ela é um `Int` no `CharacterState` e um
passo na criação de personagem. Então **DEF-2 (só o campo) + DEF-5** entram no corte por um custo
que antes era proibitivo, e o monstro passa a poder atacar de volta — que é metade do combate.

Fica de fora: propriedade de item, chave canônica de item, e o **ajudante** que preenche a CA a
partir da armadura equipada. Isto é, fica de fora tudo que depende da D1 — mas agora isso é bem
menos que antes.

Responde a pergunta que decide o resto: **um combate em que o d20 do jogador é comparado a um
número real joga melhor do que um em que o Mestre decide?**

---

## O que fica de fora deste backlog

- **Economia de recursos** (slot, Ki, pontos de feitiçaria, descanso). Backlog irmão, já escrito:
  [backlog-economia-de-recursos-do-personagem.md](./backlog-economia-de-recursos-do-personagem.md).
  Compartilha a D3 e nada mais.
- **Iniciativa e ordem de turno.** Combate estruturado é outra camada; aqui só o número-alvo de um
  golpe. Backlog próprio, já escrito:
  [backlog-combate-por-turno.md](./backlog-combate-por-turno.md).
- **Dano e resistência.** `updateCharacterHp` continua recebendo o valor calculado pelo modelo.
  Mudar isso é a mesma discussão de arbitragem, num terceiro eixo.
- **Cobertura, vantagem/desvantagem, ataque desprevenido.** Modificadores situacionais de ataque.
  A [US-109](./US-109-bonus-circunstancial-no-teste-de-d20.md) já abriu espaço para bônus
  circunstancial no d20 — reusar aquilo antes de inventar eixo novo.
- **Progressão de nível.** Bônus de ataque escala com proficiência, que escala com nível. É a D1
  do backlog do Lazy GM, compartilhada e de dono próprio.

---

## Decisões abertas

1. **Árbitro ou narrador?** Idêntica à #1 do backlog de economia de recursos, e responder uma
   responde as duas. Se a resposta for "narrador", **nenhum dos dois backlogs se constrói** — e
   isso é resultado, não desperdício: torna explícita uma escolha de produto que hoje está
   implícita em comentários de código.
2. **Arbitrar ataque e não arbitrar teste de perícia é incoerente?** Provavelmente sim. As
   US-110/111 puseram a tabela de CD no prompt de propósito: o modelo escolhe a CD porque a
   dificuldade de uma ação é julgamento de ficção. Já a CA de um monstro **não é julgamento** — é
   um número do statblock. O corte defensável é esse: **arbitra-se o que é dado; segue julgamento
   o que é ficção.** Escrever essa regra antes de construir, ou o próximo eixo reabre a discussão.
3. **A trava de "um teste por turno" (US-38) sobrevive?** Ataque + perícia no mesmo turno são dois
   testes legítimos e a trava atual reusaria o primeiro. A própria US-38 previu o dia. Decidir se
   a regra mais fina é por tipo de teste, por âncora, ou por contagem.
4. **O modelo vai passar o alvo certo?** Mesma dúvida de disciplina de sempre — `updateScene`
   ignorada em 9 de 24 viagens (US-71). Aqui o erro é pior que silencioso: um ataque comparado
   contra um alvo errado **parece** que funcionou. Diferente da economia de recursos, aqui há
   verificação determinística barata: a CA usada tem de casar com a do statblock em cena. Vale
   medir antes de confiar.

---

## Referências no código

- [`packages/shared/src/types/character.ts:1`](../../../packages/shared/src/types/character.ts) —
  `InventoryItem`, o `{ name, qty }` que bloqueia a derivação.
- [`apps/api/prisma/schema.prisma:46`](../../../apps/api/prisma/schema.prisma) — `CharacterState`,
  sem CA e sem dado de vida.
- [`apps/api/src/ai/ai.service.ts`](../../../apps/api/src/ai/ai.service.ts) — `:349` `rollDice`
  (sem CD, sem veredito) e `:369` a trava de um teste por turno da US-38; `updateCharacterHp` e o
  `newHp` calculado pelo modelo.
- [`packages/ai-engine/src/prompts/dm-system.ts:183`](../../../packages/ai-engine/src/prompts/dm-system.ts) —
  `abilityCheckTable`, a tabela de CD como *prompt* e não como tool: a escolha que a *Decisão
  aberta* #2 discute.
- [`packages/shared/src/starting-kit.ts`](../../../packages/shared/src/starting-kit.ts) e a US-51 —
  por que o inventário nasceu como texto: veio de parsear tabela markdown de `desc`.
- [`evals/PROMPT-ANCHORS.md`](../../../evals/PROMPT-ANCHORS.md) — por que mexer na `description` do
  `rollDice` não é edição de texto solta.
- [backlog-motor-de-geracao-de-aventuras.md](./backlog-motor-de-geracao-de-aventuras.md) — **GEN-9**
  (statblocks por papel e orçamento), a D2 deste backlog, no caminho crítico da fase 1.
- [backlog-economia-de-recursos-do-personagem.md](./backlog-economia-de-recursos-do-personagem.md) —
  backlog irmão; a D3 é a mesma decisão.

### Referências externas

Lidas por README e metadados da API do GitHub — **código não executado nem auditado**. Nenhuma
decisão aqui se apoia na autoridade delas; o que sustenta cada item é a verificação no código
deste repo, em *O estado verificado*.

| Repositório | Licença | Rendeu |
|---|---|---|
| [nisakson2000/dnd-tracker](https://github.com/nisakson2000/dnd-tracker) | "Other" (não-padrão) | a árvore de regra do DEF-2 (base, substituição por armadura, teto de Destreza por categoria, escudo) e a precedência `override > derivado` do DEF-6. Stack Tauri/Rust — **nada de código atravessa**, só a regra, que é SRD |
| [vietts/dm-dashboard-oss](https://github.com/vietts/dm-dashboard-oss) | MIT | levantou a lacuna junto com as três do backlog irmão |
| [blakewatson/minimal-character-sheet](https://github.com/blakewatson/minimal-character-sheet) | MIT | **inverteu o DEF-2** (`ac: 10` armazenado; `proficiencyOverride` sobre a tabela de nível) e com isso fechou o DEF-6 e barateou o corte mínimo. Vue/PHP, mantido, último push 11/08/2026 — a referência mais viva do lote, e a única cuja divergência mudou uma decisão |
