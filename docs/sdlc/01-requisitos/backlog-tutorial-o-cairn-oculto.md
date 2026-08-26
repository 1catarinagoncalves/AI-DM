# Backlog — Tutorial "O Cairn Oculto"

**Objetivo:** toda personagem nova, de **qualquer classe**, joga uma aventura curta, fixa e
idêntica antes da sua própria aventura gerada. Essa aventura é *The Hidden Cairn*
(RedRaggedFiend), um dungeon introdutório de nível 1 cuja função declarada não é a história — é
**apresentar as convenções de RPG** uma a uma, cada cena ancorada numa mecânica.

**Criado em:** 2026-08-25, a partir do PDF `The_Hidden_Cairn_An_RPG_Beginners_Adventure.pdf`
trazido pela mantenedora.

Este documento **não é uma user story**. É a sequência de tarefas até o objetivo, com dependências
e o que já existe. Cada item vira um `US-*.md` próprio quando entrar em execução.

> **Rótulos, não números de story.** `CAIRN-0`…`CAIRN-10` são identificadores **internos deste
> documento**. O número real (`US-NNN`) é atribuído no dia em que a story for escrita.

---

## Aviso de direitos — leia antes de CAIRN-1

**Confirmado pela mantenedora (2026-08-25): The Hidden Cairn é produto comercial de Red Ragged
Fiend, publicado no DriveThruRPG, sob direitos autorais padrão do autor.** O PDF em si não carrega
nenhuma string de licença nos metadados nem no texto extraível — só o rodapé
`RedRaggedFiend.com | The Hidden Cairn` — mas isso já era esperado de um produto comercial: a
licença de uso vive na página de venda, não no arquivo. Copiar a prosa dela para dentro do repo é
redistribuição de obra comercial de terceiro sem licença. **Não é ambíguo — não entra no repo.**

A separação que resolve: **estrutura de mecânica não é o que se protege, prosa é.** CDs, ordem das
salas, "3 testes de Atletismo em sequência", "morcegos no teto" — isso é procedimento de jogo (fatos
e regras de sistema, não protegidos por copyright) e sai direto do SRD. Os textos de leitura em voz
alta e as notas de mestre são a expressão autoral — esses não saem do PDF sob nenhuma hipótese.
CAIRN-0 deixa de ser uma escolha entre reescrever e pedir permissão: **é reescrever.**

---

## O que a aventura é

Cinco cenas em sequência linear, cada uma existindo para ensinar algo. Da leitura do PDF:

| # | Cena | Mecânica que a cena existe para ensinar |
|---|---|---|
| 1 | **Chegada e acampamento** | gestão de recursos (2 dias de ração riscados), descanso longo, montar vigia, preparar magias |
| 2 | **Entrada escondida** | mecânica central do d20, teste de perícia (Sabedoria > Percepção CD 13), diferença Percepção × Investigação (CD 18), armadilha |
| 3 | **Escalada do penhasco** | vantagem/desvantagem, luz e visão, uso e **perda** de equipamento (corda de 50 pés), ação Ajudar, desafio estendido (CD 16 → 14 → 12), teste de resistência (Força CD 8, 1d6 de queda), combate (morcegos), dividir o grupo, espaço em 3D |
| 4 | **Passagem bloqueada** | teste de atributo puro (sem perícia): Força CD 6 → 13 → 15; exaustão na falha; descanso curto |
| 5 | **Câmara mortuária** | investigação mágica (Detectar Magia nas runas, Arcanismo para lê-las), condições de combate, resistência/imunidade/vulnerabilidade, porta secreta. Morto-vivo escalável: carniçal se o grupo veio fácil, zumbi/esqueleto se sofreu |
| 6 | **Tesouro secreto** | espólio, venda de tesouro, gancho plantado (a **chave de prata lavrada**, semente da aventura seguinte) |

O tesouro à vista na câmara é **isca**: ladrilhos pintados, lingotes de chumbo pintados de ouro. O
tesouro real está atrás do sarcófago. A aventura também sugere momentos de interpretação (como as
personagens se conhecem, comprar o mapa, a conversa da viagem, vender o espólio na taverna).

---

## O estado verificado

Levantado em 25/08/2026 em `apps/api/src`, `apps/api/prisma`, `packages/shared/src` e
`schema.prisma`.

**1. Não existe caminho estático de aventura — só o motor.**
[`createForCharacter()`](../../../apps/api/src/adventure/adventure.service.ts) (L429) sempre chama
`generateGatedAdventure`, e o comentário é explícito: *"teto de tentativas esgotado → sem fallback
estático (ao contrário de `generateOpeningNarration`, não existe aventura fixa pra cair)"*. O
tutorial é exatamente esse caminho que hoje não existe.

**2. Mas o formato para uma aventura fixa já existe, pronto.** `Adventure.generatedAdventure Json?`
guarda um artefato congelado no formato `GeneratedAdventureSchema`
([`packages/shared/src/types/adventure-generation.ts`](../../../packages/shared/src/types/adventure-generation.ts),
US-144 / [ADR-012](../../adr/012-aventura-gerada-como-dado.md)): `locations` (com `boxedText` para
leitura em voz alta e `description` como nota do mestre), `encounters` (`type: combat|skill|social`,
`behaviors`, `goal`, `complications`), `npcs`, `secrets`, `antagonist`, `start`, `objective`,
`conclusion`, `followUps`. **O Cairn cabe aí inteiro, sem migração de schema.** É a diferença entre
este backlog e os irmãos de mecânica: aqui o dado já tem casa.

**3. Tudo a jusante já consome o artefato, não o motor.** `seedLedgerFromGeneratedAdventure`
(US-151) semeia as entidades, `mainQuest` sai de `summary` + `start`, `Quest.objective` e
`Quest.conclusionHint` saem de `objective`/`conclusion` (US-169), e a abertura é narrada pelo mesmo
Mestre a partir desse ledger (US-168). Um artefato escrito à mão entra em todos esses pontos sem
tocar em nenhum deles.

**4. O gancho por classe continua vivo, e é justamente o que o tutorial contradiz.**
`initialAdventuresByLocale` ([`apps/api/prisma/initial-adventures.ts`](../../../apps/api/prisma/initial-adventures.ts),
L188) tem 13 ganchos — um por classe + `default` — resolvidos por
[`resolveInitialHook`](../../../apps/api/src/character/starting-inventory.ts) (L15). Desde a US-153
/ US-155 ele **não** decide mais a aventura: só semeia a abertura (`profile.hookSeed`). O Cairn é
class-agnostic por definição, então na primeira aventura o `hookSeed` deixa de ser o gancho da
classe e passa a ser o gancho do Cairn. Ver *CAIRN-2*.

**5. O Mestre tem 7 tools, e nenhuma cobre metade do que o Cairn ensina.** Em
[`ai.service.ts`](../../../apps/api/src/ai/ai.service.ts): `rollDice` (L729), `updateCharacterHp`
(L773), `updateInventory` (L805), `updateScene` (L855), `recordEntity` (L906), `completeQuest`
(L983), `getSpell` (L1030).

**6. `rollDice` não recebe CD e não faz veredito.** Parâmetros: `reason`, `skill`, `ability`,
`dice`. O modificador vem sempre da ficha (US-38); a CD e o "passou ou não" ficam com o modelo, na
prosa. O Cairn é uma lista de CDs (16, 14, 12, 13, 18, 8, 6, 15). Ver *CAIRN-6*.

**7. `rollDice` deduplica: um teste ancorado por turno (US-38).** O segundo teste com `skill`/
`ability` no mesmo turno **reusa o resultado do primeiro** (`rolls.first`, L742). Os dois desafios
estendidos do Cairn (3 escaladas em sequência, 3 empurrões de entulho) não podem acontecer num
turno só. Ver *CAIRN-5*.

**8. `CharacterState.conditions` é lido e nunca escrito.** O prompt recebe as condições
(`ai.service.ts:650`) e a abertura as passa vazias (`adventure.service.ts:517`) — mas **nenhuma
tool escreve nesse campo**. Exaustão, condições de combate e resistências, que são 3 das lições do
Cairn, não têm mecânica nenhuma no repo.

**9. Parte das mecânicas que faltam já tem dono, parte não tem dono nenhum.** Ração/descanso →
[backlog de economia de recursos](./backlog-economia-de-recursos-do-personagem.md) — vira
**pré-requisito** deste backlog (decisão de 25/08, ver *A tensão central*), não relacionado
opcional. Vantagem/desvantagem, luz/visão e exaustão não têm dono em backlog nenhum — nascem aqui
(CAIRN-11/12/13). Ordem de turno segue sem relação com o tutorial. Ver a tabela de CAIRN-7.

**10. Fase 1 é single-player.** O Cairn é escrito para grupo: *"nº de morcegos = nº de personagens
jogadoras"*, dividir o grupo, ação Ajudar, alguém segurando a corda no alto para dar vantagem a quem
sobe. Ver *CAIRN-8*.

---

## A tensão central

O Cairn é um **módulo**: cenas fixas, CDs fixas, ordem fixa. O Mestre deste repo é um **narrador
generativo** que hoje improvisa em cima de um artefato gerado. Rodar um módulo é pedir obediência a
um sistema construído para inventar.

Isso não é novo aqui — é a mesma pergunta árbitro × narrador dos três backlogs de mecânica, só que
aplicada à *estrutura* em vez da *regra*. E tem uma resposta barata que os irmãos não têm: o
artefato de aventura **já é** o contrato entre "o que está escrito" e "o que o Mestre narra". O
tutorial não precisa de um modo novo de execução; precisa de um artefato escrito à mão em vez de
gerado, mais aferição de que o Mestre não pula cena. Aferir é CAIRN-10.

**Decisão fechada (2026-08-25): o tutorial ensina de verdade, não de fachada.** Se uma cena existe
para ensinar vantagem/desvantagem, exaustão ou visão no escuro, e o repo não tem mecânica nenhuma
por trás — a lição vira teatro sem consequência, e um tutorial que finge é pior que nenhum. As
mecânicas que faltam (CAIRN-7) deixam de ser "não bloqueia" e passam a ser construídas como parte
deste backlog, com uma exceção: dividir o grupo / ação Ajudar é multiplayer, fora da Fase 1 por
limite de fase (não por lacuna) — segue resolvido narrativamente por CAIRN-8, reescrevendo a cena
para uma personagem só.

---

## A sequência

### CAIRN-0 — Reescrever a prosa do zero (decisão fechada)

**Depende de:** nada. **Bloqueia:** CAIRN-1.

Sem código. Obra comercial confirmada (ver *Aviso de direitos*) fecha a decisão: o repo fica com um
artefato **original** que preserva a estrutura (5 cenas, as CDs, os morcegos, o morto-vivo
escalável, a chave de prata) e escreve toda a prosa do zero, em pt-BR e en-US, na voz do projeto.
Nenhum trecho do PDF é copiado, parafraseado de perto ou usado como referência ao redigir — só a
lista de fatos mecânicos (CDs, ordem, criaturas) desta tabela e do backlog acima.

A prosa é onde a qualidade do projeto mora de qualquer forma — este não é trabalho perdido por não
copiar, é o trabalho real da story.

### CAIRN-1 — O artefato do Cairn escrito à mão, validado por schema

**Depende de:** CAIRN-0.

Um arquivo novo em `apps/api/prisma/` (precedente exato de `initial-adventures.ts`: mora ali para
poder ser **afirmado por teste** — nada dentro de `seed.ts` pode, porque o `seed.ts` chama `main()`
no import), exportando um mapa `Record<Locale, GeneratedAdventure>`.

Conteúdo mínimo, mapeando 1:1 a tabela de cenas:

- 5–6 `locations`, cada uma com `boxedText` (voz alta) e `description` (nota do mestre, **onde vão
  as CDs e a lição da cena**);
- `encounters`: escalada (`skill`), morcegos (`combat`), entulho (`skill`), morto-vivo (`combat`),
  runas (`skill`);
- `secrets`: o mecanismo da porta, as runas que despertam o morto-vivo, o sarcófago que desliza;
- `antagonist`: o morto-vivo. O schema exige um só `name`/`want`/`method`/`trait`/`weakness`/
  `connection`/`npcId` — não três variantes. A escalada (Decisão aberta 5, fechada) não é campo
  novo: uma frase em `description`/`behaviors` instrui o Mestre a ler a ficha da personagem (nível,
  classe, atributos) e decidir ali, antes da cena, se o morto-vivo é carniçal, zumbi ou esqueleto —
  igual o Mestre já faz para tudo o mais que não está travado em CD fixa;
- `followUps`: a chave de prata.

Teste: `GeneratedAdventureSchema.parse(artefato)` não lança, para **cada** locale, e o grafo fecha
(todo `locationId`/`npcId` citado existe) — a mesma verificação que
[US-150](./US-150-gate-antes-de-persistir-aventura-gerada.md) faz no gerado.

### CAIRN-2 — A primeira aventura da personagem é o tutorial

**Depende de:** CAIRN-1.

Em `createForCharacter()`: quando `order === 1`, usar o artefato fixo em vez de chamar
`generateGatedAdventure`. Todo o resto do método — `mainQuest`, `seedLedgerFromGeneratedAdventure`,
persistência de `Quest`, `generatedAdventure`, `CharacterState` — continua igual, porque já opera
sobre o artefato.

Dois detalhes que não são óbvios:

- **O gate não roda.** Ele existe para desconfiar do LLM; o artefato é validado em teste, no build.
- **`hookSeed`.** Hoje sai de `resolveInitialHook(config, character.class)`. Na aventura tutorial
  passa a ser o gancho do Cairn (o mapa comprado na última aldeia, a viagem de dois dias, a colina),
  igual para toda classe. O gancho de classe **não morre**: volta a valer da segunda aventura em
  diante.

O ramo não é automático em `order === 1` — depende da escolha explícita da jogadora (CAIRN-3). Sem
escolha de tutorial, `order === 1` segue o caminho de sempre (`generateGatedAdventure`, gancho de
classe). `createForCharacter` ganha um parâmetro (`playTutorial: boolean`, vindo do DTO) que decide
o ramo; não é lido de config nem de heurística.

### CAIRN-3 — Tela de escolha: tutorial ou aventura própria

**Depende de:** CAIRN-2.

Opcional e **opt-in** (Decisão aberta 2, fechada): a jogadora escolhe explicitamente, não há default
silencioso. `/setup`, depois de criar a personagem e antes de chamar `createForCharacter`, para numa
tela com duas opções lado a lado — "Jogar o tutorial" (explica em 1–2 frases o que é: introdução às
mecânicas, curta, vale para qualquer classe) e "Ir direto para a aventura" (segue o fluxo atual,
seletores de tom/cenário/tipo de área do US-184 aparecem normalmente). Nenhuma das duas é
pré-marcada.

A escolha é **por personagem**, feita uma vez no fluxo de criação — não é uma preferência de conta
nem aparece de novo depois. Quem pula não vê a tela outra vez para aquela personagem; quem cria uma
segunda personagem escolhe de novo, porque a pergunta é sempre "esta personagem quer o tutorial",
não "esta conta já viu o tutorial" (mantém a Decisão aberta 4 — `order === 1` — coerente: só existe
tutorial se a escolha em CAIRN-3 disse sim).

### CAIRN-4 — A camada didática: o Mestre ensina sem sair da ficção

**Depende de:** CAIRN-2.

É o ponto inteiro da aventura e o mais fácil de perder. Cada cena tem uma lição; se o Mestre só
narrar bonito e resolver tudo sozinho, o tutorial vira uma aventura curta qualquer.

O caminho barato **não** é um campo novo no schema: `location.description` já é nota de mestre que
nunca é lida em voz alta, e `aspects` já é lista de traços. A lição da cena mora ali, redigida como
instrução ("antes de resolver, nomeie o teste em voz alta e explique por que Percepção e não
Investigação"). Só medir (CAIRN-10) diz se basta.

### CAIRN-5 — Desafio estendido × um teste por turno

**Depende de:** CAIRN-1.

O Cairn quer 3 testes em sequência, com CD caindo (16/14/12) e falha com consequência. A US-38
proíbe o segundo teste ancorado no mesmo turno.

Caminho barato: **aceitar**. Cada trecho da escalada é um turno, com a jogadora decidindo entre eles
— o que é melhor pedagogia que 3 rolagens seguidas numa narração só. Nesse caso o artefato precisa
descrever o desafio como **três cenas**, não uma. A alternativa (tool de desafio estendido que rola
N vezes) mexe numa tool compartilhada por todas as aventuras para servir uma; só vale se a medição
mostrar o Mestre atropelando os três trechos.

### CAIRN-6 — CD explícita: quem decide se passou

**Depende de:** CAIRN-1. **Relacionado a:** o mesmo nó dos backlogs de CA e de recursos.

`rollDice` devolve o total e nada mais; o veredito é prosa do modelo. Um tutorial cuja lição é *"o
d20 mais o modificador contra uma CD"* fica frágil se a CD só existe como texto numa nota que o
modelo pode ignorar.

- **Barato:** CDs vivem em `location.description`; medir a taxa de veredito coerente (CAIRN-10).
- **Caro:** `dc?: number` em `rollDice`, devolvendo `success: boolean` calculado no Game Server.
  Vale para **toda** aventura, não só o tutorial, e é a mesma decisão árbitro × narrador dos
  irmãos — se for feito, é uma story própria, não um detalhe do tutorial.

### CAIRN-7 — O que a aventura ensina e o repo ainda não tem

**Depende de:** CAIRN-1.

| Lição da cena | Existe hoje? | Dono |
|---|---|---|
| Teste de perícia / atributo, d20 + modificador da ficha | **Sim** | `rollDice`, US-38 |
| Percepção × Investigação | **Sim** | perícias da ficha (US-27) |
| Dano e cura de HP (queda 1d6, morcegos) | **Sim** | `updateCharacterHp` |
| Perder equipamento (a corda arruinada) | **Sim** | `updateInventory` |
| Mudança de cena / porta secreta | **Sim** | `updateScene` |
| Espólio e tesouro | **Sim** | `updateInventory` |
| Gancho plantado (chave de prata) | **Sim** | `followUps` + `recordEntity` |
| Magia na investigação (Detectar Magia, Arcanismo) | **Sim** | `getSpell` + perícias |
| Teste de resistência | **Parcial** | `rollDice` com `ability` — sem CD, sem veredito (CAIRN-6) |
| Vantagem / desvantagem | **A construir, aqui** | CAIRN-11 |
| Luz e visão (interior escuro, lanterna desperta morcegos) | **A construir, aqui** | CAIRN-12 |
| Exaustão | **A construir, aqui** | CAIRN-13 (`conditions` existe no schema, nada escreve nele) |
| Resistência / imunidade / vulnerabilidade | **A construir, aqui — como tag, não como cálculo** | CAIRN-13 |
| Ração, fome, dois dias de viagem | **Pré-requisito externo** | [economia de recursos](./backlog-economia-de-recursos-do-personagem.md) |
| Descanso curto / longo, preparar magias, vigia | **Pré-requisito externo** | [economia de recursos](./backlog-economia-de-recursos-do-personagem.md) |
| Ação Ajudar, dividir o grupo | **Fora de fase, não é lacuna** | multiplayer, fase 4 — CAIRN-8 reescreve a cena p/ solo |

Três status, três tratamentos diferentes:

- **"A construir, aqui"** — sem dono em backlog nenhum, e pequeno o bastante para nascer direto
  deste backlog (CAIRN-11/12/13). Nenhum mexe em schema: `conditions Json` e o espaço de bônus
  circunstancial (US-109) já existem, só não são escritos.
- **"Pré-requisito externo"** — dono é um backlog irmão já escrito e maior que este. Este backlog
  **depende** deles em vez de duplicá-los; ver *Ordem de execução*.
- **Resistência/imunidade/vulnerabilidade é meio-termo deliberado.** O cálculo mecânico completo
  (dano de tipo X é dobrado/reduzido) é a mesma bifurcação árbitro × narrador ainda aberta nos três
  backlogs irmãos ([CA e ataque](./backlog-classe-de-armadura-e-ataque.md) declara isso
  explicitamente fora do seu próprio escopo — *"terceiro eixo"*). Resolver essa bifurcação aqui, só
  para uma cena de tutorial, seria o rabo abanando o cachorro. CAIRN-13 registra a condição como
  **tag visível na ficha e no prompt do Mestre** (ex.: "resistente a dano cortante") — o Mestre
  narra o efeito, igual faz hoje com todo o resto do combate. Vira cálculo de verdade no dia em que
  o backlog de CA resolver a bifurcação.

Nenhum item aqui bloqueia CAIRN-0/1 (redação do artefato) — bloqueiam CAIRN-2 (rodar de verdade),
porque rodar sem eles é o tutorial mentindo sobre a própria lição. Ver *Ordem de execução*.

### CAIRN-8 — Reescrever as cenas de grupo para uma personagem só

**Depende de:** CAIRN-1.

Quatro pontos do PDF assumem grupo: nº de morcegos = nº de jogadoras; alguém firma a corda no alto
para dar vantagem; ação Ajudar no primeiro teste de escalada; dividir o grupo entre topo e base.

Para uma personagem só: 1–2 morcegos (orçamento de encontro de 1 personagem, mesma disciplina do
motor), sem Ajudar, sem divisão. A vantagem da corda vira uma escolha de equipamento (cravar a corda
antes de subir custa tempo — ração, quando isso existir). O texto que sobra é o mesmo dungeon; o que
muda é a lista de participantes.

### CAIRN-9 — A ponte: a chave de prata abre a aventura própria

**Depende de:** CAIRN-2.

`followUps` do Cairn traz a chave de prata como "semente de aventura futura" — e a aventura seguinte
é, literalmente, a próxima que o motor gera. Fechar o laço: ao concluir o tutorial, a chave já está
no inventário e no ledger (`recordEntity`), e entra como `hookSeed` da aventura de `order === 2`.

É o que transforma o tutorial de *pré-jogo descartável* em **primeiro capítulo**. Sem isso, a
jogadora termina o Cairn e começa do zero, e a chave vira lixo de inventário.

### CAIRN-10 — Eval: o Mestre roda o módulo ou improvisa por cima dele

**Depende de:** CAIRN-2, CAIRN-4.

Caso em `evals/cases/`, no padrão dos existentes. O que precisa falhar quando quebrar:

1. A abertura narra a colina e o mapa comprado — não um gancho de classe.
2. Entrar sem procurar a alavanca **não** abre a porta: a cena 2 exige o teste.
3. O Mestre chama `rollDice` na escalada em vez de narrar sucesso de graça.
4. O Mestre não teleporta a jogadora da entrada para a câmara mortuária pulando penhasco e entulho.
5. Pelo menos N lições da cena aparecem explicadas na prosa (a medição da CAIRN-4).
6. O tesouro à vista é descrito como valioso e se revela bugiganga; o real está atrás do sarcófago.
7. A conclusão entrega a chave de prata.

Os itens 3–5 são os que dizem se CAIRN-4/5/6 ficaram no caminho barato ou precisam do caro.

### CAIRN-11 — Vantagem / desvantagem em `rollDice`

**Depende de:** nada (self-contained). **Bloqueia:** CAIRN-2 rodar de verdade.

`rollDice` ganha `advantage?: 'advantage' | 'disadvantage'`: rola 2d20, usa o maior ou o menor,
mantendo o modificador da ficha (US-38) intacto — o termo novo é só qual d20 conta. Devolve os dois
valores brutos no payload do `EventLog`, para o frame `D:` mostrar os dois dados riscando o que não
valeu. Vale para toda aventura, não só o tutorial — a cena da corda ("brace a rope... grants
advantage") é só o primeiro consumidor.

### CAIRN-12 — Luz e visão

**Depende de:** nada (self-contained). **Bloqueia:** CAIRN-2 rodar de verdade.

O Cairn depende de "tem luz ou não" duas vezes: a câmara inicial fica escura ao fechar a primeira
porta, e é *o light source chegando ao topo do penhasco* que acorda os morcegos — a causa do
combate é a luz, não a chegada da personagem. Caminho barato: uma entrada de inventário com
`origin: 'light'` (tocha, lanterna) mais um campo `sceneState.lit: boolean`, escrito por
`updateScene` (que já existe e já muda estado de cena) quando a personagem acende ou apaga a fonte.
Sem tool nova — `updateScene` ganha um campo opcional.

### CAIRN-13 — `updateConditions`: exaustão e tags de resistência/imunidade/vulnerabilidade

**Depende de:** nada (self-contained, mesmo padrão de `updateCharacterHp`). **Bloqueia:** CAIRN-2
rodar de verdade.

Tool nova, pequena: `updateConditions({ add: string[], remove: string[] })`, escrevendo em
`CharacterState.conditions` (coluna já existe, hoje só lida — `ai.service.ts:650`). Cobre exaustão
("Exaustão 1") e as tags de resistência/imunidade/vulnerabilidade do morto-vivo (ver CAIRN-7 — aqui
é tag narrativa, não cálculo de dano). O prompt do Mestre já injeta `conditions` na ficha; passa a
também poder escrevê-las.

---

## Ordem de execução

```
CAIRN-0 -> CAIRN-1 -+-> CAIRN-2* -+-> CAIRN-3
                    |             +-> CAIRN-4 --+
                    |             +-> CAIRN-9   |
                    +-> CAIRN-5                +-> CAIRN-10
                    +-> CAIRN-6                |
                    +-> CAIRN-7 --------------+
                    +-> CAIRN-8
                    +-> CAIRN-11 -+
                    +-> CAIRN-12  |-> (pré-requisito de CAIRN-2*)
                    +-> CAIRN-13 -+

  economia de recursos (backlog irmão) -> (pré-requisito de CAIRN-2*)
```

`CAIRN-2*`: o artefato pode ser escrito e o schema validado (CAIRN-0/1) sem as mecânicas novas —
mas **rodar** a aventura de ponta a ponta com as lições intactas espera CAIRN-11, CAIRN-12,
CAIRN-13 e o backlog de economia de recursos (ração, descanso, preparar magias). Sem eles a
primeira sessão jogável mente em pelo menos 4 das 6 cenas. Caminho mínimo até uma sessão que **não
mente**: CAIRN-0 → 1 → {11, 12, 13, economia de recursos} → 2. CAIRN-10 (eval) é o que confirma.

---

## Decisões abertas

1. ~~Reescrever ou pedir permissão?~~ **Fechada** (CAIRN-0): reescrever. Obra comercial de
   Red Ragged Fiend, confirmado pela mantenedora 2026-08-25.

2. ~~O tutorial é obrigatório?~~ **Fechada:** opcional, opt-in explícito. A jogadora escolhe numa
   tela dedicada (CAIRN-3) entre tutorial e aventura direta — nenhuma opção pré-marcada, nenhum
   default silencioso. Escolha por personagem, feita uma vez na criação.

3. ~~O tutorial ensina mecânica que o repo não tem?~~ **Fechada (2026-08-25):** nem cortar, nem
   fingir — constrói-se. Vantagem/desvantagem, luz/visão e exaustão nascem neste backlog
   (CAIRN-11/12/13, sem dono em lugar nenhum); ração/descanso vira pré-requisito do backlog de
   economia de recursos, já escrito. A única exceção que permanece narrativa é Ajudar/dividir o
   grupo — não por lacuna, mas porque é multiplayer, fora da Fase 1 (CAIRN-8 resolve reescrevendo a
   cena para uma personagem só, o que não é a mesma coisa que "ensinar de fachada").

4. ~~Uma personagem que já existe ganha o tutorial?~~ **Fechada por construção:** não é uma questão
   de `order`, é uma questão de escolha. `order` (`adventureParticipant.count() + 1`) continua só
   contando aventuras; o ramo do tutorial em CAIRN-2 dispara por `playTutorial === true` vindo de
   CAIRN-3, não por `order === 1`. Uma personagem já existente nunca passou pela tela de escolha —
   sua próxima aventura segue o caminho normal, porque não há escolha de tutorial registrada para
   ela.

5. ~~O morto-vivo escalável escala com quê?~~ **Fechada (2026-08-25):** pela **ficha da
   personagem**, não pelo desempenho na sessão. O PDF original propunha ler o quão sofrido o grupo
   chegou (proxy que exigiria estado de combate, que o repo não tem); aqui o Mestre olha nível,
   classe e atributos ANTES da cena — mais simples, sem estado novo, e coerente com como o Mestre já
   decide tudo que não está travado em CD fixa. Vira nota de mestre em `description`/`behaviors`
   (CAIRN-1); CAIRN-10 mede se o Mestre a respeita.

---

## Referências

- `The_Hidden_Cairn_An_RPG_Beginners_Adventure.pdf` — Red Ragged Fiend, DriveThruRPG, direitos
  autorais padrão do autor. Fonte de referência para estrutura/CDs apenas. **Não entra no repo em
  nenhuma hipótese** — ver *Aviso de direitos*.
- [`apps/api/src/adventure/adventure.service.ts`](../../../apps/api/src/adventure/adventure.service.ts)
  — `createForCharacter()` (L429), o método que ganha o ramo do tutorial.
- [`packages/shared/src/types/adventure-generation.ts`](../../../packages/shared/src/types/adventure-generation.ts)
  — `GeneratedAdventureSchema`, o formato em que o Cairn é escrito.
- [`apps/api/prisma/initial-adventures.ts`](../../../apps/api/prisma/initial-adventures.ts) —
  precedente de catálogo fixo por locale, e o gancho por classe que o tutorial substitui na 1ª
  aventura.
- [`apps/api/src/ai/ai.service.ts`](../../../apps/api/src/ai/ai.service.ts) — as 7 tools do Mestre;
  `rollDice` em L729.
- [ADR-012 — Aventura gerada como dado](../../adr/012-aventura-gerada-como-dado.md) — por que o
  artefato é dado congelado, que é o que torna um artefato escrito à mão possível.
- [US-153](./US-153-aventura-deixa-de-ser-derivada-da-classe.md),
  [US-155](./US-155-aposentar-quest-fixa-por-classe.md),
  [US-168](./US-168-abertura-narra-gancho-fixo-nao-aventura-gerada.md) — o que sobrou do gancho por
  classe depois que o motor assumiu.
- [Backlog do motor de geração](./backlog-motor-de-geracao-de-aventuras.md) — o caminho que o
  tutorial desvia.
- [Backlog de economia de recursos](./backlog-economia-de-recursos-do-personagem.md) —
  pré-requisito direto (ração, descanso, preparar magias); não relacionado opcional.
- [Backlog de classe de armadura e ataque](./backlog-classe-de-armadura-e-ataque.md) — por que
  resistência/imunidade/vulnerabilidade fica como tag em CAIRN-13 em vez de cálculo: o backlog
  declara esse cálculo fora do próprio escopo ("terceiro eixo").
- [US-109](./US-109-bonus-circunstancial-no-teste-de-d20.md) — espaço de bônus/penalidade
  circunstancial no d20 que CAIRN-11 (vantagem/desvantagem) reaproveita em vez de inventar eixo
  novo.
