# Backlog — Motor de geração de aventuras one-shot

**Objetivo:** gerar a aventura de um personagem a partir de **nível, classe e história de
fundo**, mais fatores de mundo, em vez de servir texto fixo escrito por classe.

**Decisão de produto:** na **fase 1 este backlog é o único caminho de aventura**. A campanha com
arco de história do [backlog do Lazy GM](./backlog-aventuras-autorais-lazygm.md) foi adiada para a
**fase 4 (multiplayer)** do roadmap do `AGENTS.md`. Toda aventura que um jogador solo recebe —
inclusive a primeira — é gerada. Ver *O adiamento do arco para a fase 4*.

**Criado em:** 2026-08-07
**Atualizado em:** 2026-08-07 — invertida a ordem: o motor deixa de depender da aventura autoral
e passa a precedê-la.
**Atualizado em:** 2026-08-07 (terceira vez, mesmo dia) — o `dhorions/DnDGenerate` saiu da lista
de descartados. Integridade referencial, `narrative`, `followUps` e o eixo de registro entraram na
US-144, US-147 e US-150. Ver *O que o DnDGenerate acrescenta*.
**Atualizado em:** 2026-08-07 (quarta vez, mesmo dia) — o registro deixa de ser só sorteado: o
jogador escolhe `setting`, `tone` e `areaType`, ou deixa cada um no aleatório. Entram US-156
(catálogo, DTO e validação) e US-157 (a tela, depois da revisão).
**Atualizado em:** 2026-08-07 (quinta vez, mesmo dia) — o backlog irmão foi adiado para a **fase
4 (multiplayer)** do roadmap. Não é mais "este roda primeiro": é **este roda sozinho na fase 1**.
Ver *O adiamento do arco para a fase 4*.
**Atualizado em:** 2026-08-18 — ao mapear a integração do motor com o prompt do AI DM,
confirmado que US-145/146/147/149/152/158/159 (✅ implementadas) produzem peças soltas: nenhuma
função as junta num `GeneratedAdventure`, e o passo 6 (fecho ramificado + `followUps`) não tem
código nenhum. Nova story no caminho crítico: **US-164**, o orquestrador.
**Status:** 📋 Proposta — nenhuma tarefa iniciada

Este documento **não é uma user story**. É a sequência de tarefas até a meta acima. Cada item
já tem story própria em `US-*.md`.

> **Numeração atualizada em 17/08/2026.** Os rótulos internos `GEN-0`…`GEN-14` foram substituídos
> pelo número real da story, na mesma ordem: `US-143`…`US-157`. As duas lacunas descobertas depois
> do texto original — `GEN-4½` e `GEN-9½` — viraram `US-158` e `US-159`, fora da sequência porque
> foram escritas por último. Os rótulos `AV-N` citados aqui são do **backlog irmão**, não deste.

---

## Um schema, dois produtores

A decisão que economiza o motor inteiro: ele **não tem saída própria**.

```
Schema da aventura (US-144)
  ├── produtor A — este motor                            (fase 1)
  └── produtor B — O Lamento, escrito à mão (AV-0)       (fase 4, multiplayer)
```

Tudo a jusante é escrito uma vez contra esse schema e **não sabe qual produtor rodou**: a
semeadura de `WorldEntity`, as quests, os dials de dificuldade e a eval. O motor é uma função
`(perfil, seed) => Aventura`, não uma arquitetura.

**A forma do schema não sai do motor.** Sai dos **Eight Steps** do Lazy GM — que é o que o
backlog irmão já afirmava da AV-1 (*"a forma sai dos Eight Steps, não de uma aventura
específica"*). Esse argumento era conveniente lá e é **carga estrutural aqui**: é a única coisa
que impede um schema desenhado com só um gerador na frente de virar um schema que a aventura
escrita à mão não cabe.

> **Com o produtor B na fase 4, isto muda de natureza.** Deixa de ser dependência entre dois
> backlogs próximos e vira **seguro barato**: o teste de escrever uma locação e dois segredos à
> mão (US-144) custa uma tarde e é a única coisa que impede o schema de virar um blob com a forma
> do gerador. Três fases é tempo de sobra para ninguém lembrar por que o campo existia.
> **Não é o único motivo de o teste ficar:** um schema que só o gerador consegue preencher também
> não aceita conteúdo escrito à mão para *debug*, nem aventura corrigida à mão depois de gerada.

---

## A inversão e o que ela custa

A primeira versão deste backlog (07/08/2026, manhã) punha o motor **depois** da aventura autoral:
AV-1 dava o schema, AV-0 dava o exemplar de medição. A ordem foi invertida no mesmo dia. Registro
do que a inversão move, ganha e quebra — porque o que ela quebra é real e tem remédio.

### O que muda de dono

Cinco tarefas saem do backlog irmão e entram aqui, porque agora são pré-requisito **deste**
caminho e não daquele:

| Era | Vira | Por quê |
|---|---|---|
| AV-1 — schema da aventura | **US-144** | É a saída do motor. Quem chega primeiro escreve |
| AV-2 — `sync` pinado do LGMRD | **US-145** | São as 135 tabelas. Já era independente lá (*"pode ir em paralelo"*) |
| AV-4 — semear entidades e segredos | **US-151** | O `map()` é o mesmo; a fonte é o artefato gerado |
| AV-6 — statblocks por papel | **US-152** | Vêm do mesmo artefato da US-145 |
| AV-3 — tirar a aventura do acoplamento com a classe | **US-153** | Muda de motivo: não é campanha única, é aventura por personagem |

O backlog irmão fica com o que é dele: **escrever *O Lamento*** (AV-0), as regras locais (AV-8), o
en-US (AV-9) e as quests em fases (AV-5). E ganha uma vantagem que não tinha: **a AV-0 passa a
escrever contra um schema que já existe e já rodou**, em vez de contra um schema proposto.

### O que a inversão ganha

1. **A entrega que responde a pergunta chega antes.** O item mais longo do corte mínimo irmão é a
   AV-0, e é *escrita* — não paralelizável, não delegável, sem teste que a destrave. Pondo o motor
   na frente, o corte mínimo vira só código.
2. **As histórias fixas por classe saem agora.** Era o pedido de origem. Pela ordem anterior elas
   só sairiam depois de *O Lamento* estar escrito.
3. **A campanha única deixa de ser pré-condição.** A decisão de 06/08 (*todas as classes na mesma
   campanha*) foi tomada porque havia **uma** aventura escrita para servir a todos. Com o motor
   primeiro há uma aventura **por personagem**, e a decisão vira reversível em vez de fundacional.

### O que a inversão quebra, e é real

1. **A eval perde a âncora.** O plano anterior media a saída gerada contra *O Lamento*. Sem ele
   escrito, "a aventura gerada degradou" não é afirmável. **Remédio, e ele não custa nada:** os
   dois exemplares do próprio LGMRD — `36-villageofwhitesparrow.md` e `37-thenightblade.md` —
   chegam dentro do artefato que a US-145 baixa, são CC-BY, e o backlog irmão já os classifica como
   *"os dois melhores exemplares de formato do documento"*. Eles não entram no jogo: entram na
   eval como referência de densidade. O que se perde é o exemplar **solo** e **em pt-BR**; o que
   se mede com eles é estrutura e densidade, que é o que degrada primeiro.
2. **A primeira coisa que um jogador vê passa a ser gerada.** Não há mais piso escrito à mão
   debaixo da experiência inicial. O gate da US-150 é estrutura, não qualidade. **Remédio:** um
   seed pinado, jogado à mão ponta a ponta, é critério de saída do corte mínimo — não "os testes
   passam". Está na US-150.
3. **O schema nasce com um produtor só na frente.** Risco de fixar campos que servem à geração e
   descobrir na AV-0 que falta *boxed text*, *area aspect* ou fecho ramificado. **Remédio:** os
   Eight Steps ditam os campos (acima), e a US-144 tem de passar o teste de escrever **uma locação
   e dois segredos à mão** no schema antes de o motor existir — que é, invertido, exatamente o
   arranjo que a AV-1 já propunha.

---

## O adiamento do arco para a fase 4

Decidido em **07/08/2026**, horas depois da inversão, e ela **absorve** a inversão: não há mais
duas ordens possíveis para comparar. O
[backlog do arco de história](./backlog-aventuras-autorais-lazygm.md) — Pegāna, quatro atos, nível
1 ao 20 — **só entra quando houver multiplayer**, que é a **fase 4** de seis no roadmap do
`AGENTS.md`. A fase atual é a 1.

Campanha longa com atos é coisa de grupo. Um arco de vinte níveis para um jogador solo é a forma
mais cara possível de descobrir que o produto é jogado em sessões avulsas.

### O que isto resolve

1. **A decisão aberta 1 morre respondida.** Perguntava se o motor gera a aventura 1 ou só as
   2..N. Sem aventura autoral na fase 1, **o motor gera todas, inclusive a primeira**. E com ela
   morre a decisão aberta 7 do backlog irmão (*a campanha única sobrevive?*): na fase 1 não há
   campanha única porque não há campanha; a pergunta volta na fase 4, com multiplayer, que é onde
   ela sempre fez sentido.
2. **O nome deste backlog fica literalmente certo.** *One-shot* era descrição de formato; passa a
   ser o produto. Sem arco, cada aventura fecha em si, e os `followUps[]` da US-144 são **a única**
   continuidade entre elas — o que os promove de campo simpático a peça central.
3. **A escala solo deixa de ser condição temporária.** Ver US-152.

### O que isto custa, e não tem remédio grátis

**A eval fica sem exemplar solo em pt-BR, e agora é permanente.** A inversão já tinha trocado
*O Lamento* pelos dois exemplares do LGMRD como referência de densidade, e registrou aquilo como
provisório (*"enquanto ele não existe"*). Com a fase 4 no caminho, "enquanto" são três fases:
**os exemplares do LGMRD são a referência, ponto.** E as duas fraquezas deles deixam de ser
detalhe: são escritos **em inglês** e **para grupo**. Servem para medir estrutura e densidade;
não medem se a aventura funciona para um personagem só, nem se a prosa em pt-BR presta.

O que sobra para medir essas duas: o seed pinado jogado à mão (US-150) e a rubrica de narração da
[US-36](./US-36-eval-de-qualidade-da-narracao.md), que já roda em pt-BR. **Não é equivalente**, e
está registrado para não ser descoberto no meio.

> **O que o adiamento não proíbe:** escrever *O Lamento* é prosa, e prosa não depende de
> multiplayer. Se o arco é para acontecer na fase 4, começar a escrita antes é a única forma de a
> tarefa mais longa do outro backlog não ser descoberta como tal na fase 4. Registrado como
> observação — o backlog irmão segue adiado, e nada aqui depende disso.

---

## Triagem das sete referências

Levantadas em 07/08/2026. Quatro não acrescentam nada ao que o repo já tem.

> **Correção de 07/08/2026.** A primeira triagem descartou o `dhorions/DnDGenerate` com base no
> README, que não mostra o prompt — só diz que ele existe numa variável de ambiente. O prompt está
> em `src/main/resources/static/prompt/promptv9.txt` e **tem estrutura que nem o LGMRD nem o gist
> têm**. Ver *O que o DnDGenerate acrescenta*. A triagem abaixo já está corrigida.

| Referência                                                      | O que é                                                                                                                           | Veredito                                                                                                                                   |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **The Lazy GM's Resource Document** (SlyFlourish.com)           | Eight Steps, 135 tabelas, 40 prompts de segredo, Monster Difficulty Dials, Lazy Solo 5e                                           | **Entra — é a forma.** É a fonte que a US-145 baixa                                                                                         |
| **`gist.github.com/tock-dev/2f69b270394472bef9d2cfe39bcfd2b9`** | System prompt para o Claude Agent SDK: entrevista campo a campo, **valida o encontro antes de compilar**, só então emite o módulo | **Entra — é a ordem.** Ver *Ordem de geração* e US-150                                                                                      |
| **`carl-prewitt.com/oneshot/`** (OneShotsmith)                  | Gerador determinístico: **seed reproduzível**, math de XP contra orçamento, segredos e pistas nas locações                        | **Entra — é o determinismo.** Ver US-146                                                                                                    |
| **`github.com/dhorions/DnDGenerate`**                           | Java/Spring, ChatGPT + DALL-E + PDF. O que importa não é o app: é `promptv9.txt` e os JSONs de `static/data/`                     | **Entra — é a integridade referencial e o eixo de registro.** Ver a seção seguinte. O app em si (chamada única, PDF, imagens) fica de fora |
| `github.com/jwilferd10/Adventure-Alchemist`                     | Randomizador de masmorra client-side, sem tabelas documentadas                                                                    | Descartada                                                                                                                                 |
| `github.com/Hayawi/OneShotGenerator`                            | Flask, `Plots.txt` e monstros por CR, só nível 1                                                                                  | Descartada. O Monster Builder do LGMRD cobre melhor e no mesmo artefato (US-152)                                                            |
| `github.com/samkitkat/dnd-oneshot-generator`                    | React/Express/Supabase puxando 5e API e Open5e                                                                                    | Descartada. O repo ingere Open5e desde a [US-47](./US-47-ingestao-srd-como-dado.md)                                                        |

**O que a combinação é:** o LGMRD dá a **forma**, o gist dá a **ordem e o gate**, o OneShotsmith
dá o **determinismo**, o DnDGenerate dá a **integridade referencial e o registro**. As outras três
são a mesma ideia com stacks diferentes.

Uma ressalva sobre o gist, porque ele é o mais fácil de copiar errado: **a interação dele é o que
este projeto não precisa.** Ele entrevista o usuário campo a campo porque não conhece a mesa.
Aqui a ficha já respondeu — ver *As entradas já existem no repo*. O que se aproveita é a
*sequência* dos campos e o passo de validação antes de escrever prosa, não o diálogo.

### O que o DnDGenerate acrescenta

Quatro achados. Os três primeiros mudam o schema da US-144; o quarto muda a US-147.

**1. Integridade referencial entre seções — o achado.** Cada seção do prompt é obrigada a
**nomear entidades declaradas em outra seção**:

```
Objective  → Location    (tem de existir na seção Locations)
Challenge  → Location
Encounter  → Location + NPCs
NPC        → Interactions { Encounters, Location, Narrative }
```

Não são listas paralelas: é um **grafo declarado**. Locação, encontro e NPC não existem soltos —
cada um aponta para os outros pelo nome.

**O LGMRD não tem isto.** Os Eight Steps são oito listas, e nada obriga o segredo 7 a citar a
locação 3. E é justamente o antídoto da *"sopa de pista genérica"*: a US-150 pedia *"ao menos três
segredos referenciam entidade que existe"*, e isto generaliza para toda seção — o que torna o gate
verificável, porque toda referência cruzada é por nome dentro de seção nomeada.

**2. `narrative` — as palavras exatas que o NPC fala.** Campo por interação, com a fala escrita.
Barato, e alto retorno num motor de narração: o Mestre recebe **voz**, não descrição de
personalidade. O gerador de NPC do LGMRD dá nome, desejo e método, e para aí.

**3. `followUps` — semente como campo, não como esperança.** Seção obrigatória, cada gancho com
história suficiente para virar cenário. Não desmente *O que o motor não produz* (ele continua sem
planejar entre aventuras), mas é resposta parcial e grátis: ele não planeja, **emite**.

**4. Os JSONs de `static/data/` — o eixo que faltava.** `CampaignTones`, `Settings`, `areaType`,
`CampaignType` e `NPCRole`, dez valores cada, ortogonais:

```
Tone:     Heroic · Grimdark · Mystery · Horror · Political Intrigue · Survival · …
Setting:  High Fantasy · Dark Fantasy · Mythological · Post-Apocalyptic · …
AreaType: City · Forest · Underground Caves · Ruins · Swamp · …
```

Diferentes das 135 tabelas do LGMRD, e a diferença é a que importa: as tabelas do Lazy GM rolam
**conteúdo** (uma Torre, um Sarcófago); estas fixam **registro**. Registro não pode ser rolado por
peça — vale para a aventura inteira, senão sai Grimdark no primeiro ato e Comedic no fecho.

Para Pegāna, `Setting` é constante (mitológico) e `Tone` é o eixo vivo. As listas em si não
precisam ser copiadas: são dez rótulos genéricos e o projeto tem panteão próprio. **O que se
copia é haver o eixo, e ele ser sorteado uma vez.**

### O que fica de fora do DnDGenerate

- **A chamada única gerando tudo.** Sem ordem não há cadeia causal, e sem gate não há piso. Os
  defaults inline do prompt (faltando locação, invente cinco; faltando NPC, ponha quatro) servem
  como piso de **quantidade** e cabem no prompt; estrutura continua sendo gate com re-seed.
- **HP e AC inventados pelo modelo por NPC.** É a rolagem fictícia que a
  [US-29](./US-29-saneamento-de-rolagens-ficticias.md) já saneou, e a US-152 tem statblock por papel.
- **O catch-all final** ("qualquer outra informação útil ao mestre"). Saída ilimitada não passa em
  `parse()`.
- PDF, retratos por DALL-E e a fila de geração.

---

## As entradas já existem no repo

Verificado em 07/08/2026. Nenhuma coluna nova.

| Entrada | Onde vive | Estado |
|---|---|---|
| **Classe** | `Character.class` — chave canônica (`wizard`, `paladin`) desde a [US-105](./US-105-raca-e-classe-por-chave-do-srd.md), validada contra `config.classes` na criação | Pronto. Lookup direto, sem matcher de texto |
| **Nível** | `Character.level` em [schema.prisma](../../../apps/api/prisma/schema.prisma) | Campo existe; **nada o incrementa**. Ver *Ressalva do nível* |
| **História de fundo** | `Character.background` (Json): `{story, ideals, bonds, flaws, deity:{name, portfolio}}`, das [US-39](./US-39-identidade-narrativa-background-ideais.md) e [US-40](./US-40-divindade-do-personagem.md) | Pronto. Já vai ao prompt da abertura; **ainda não decide estrutura de aventura** |
| **Gancho de classe** | 13 ganchos × 2 locales em [initial-adventures.ts](../../../apps/api/prisma/initial-adventures.ts), resolvidos por `resolveInitialHook` | Pronto. Vira semente de entrada, não aventura |
| **Fatores de mundo** | As 135 tabelas do `LGMRD.json` | Chegam com a US-145 |
| **Registro escolhido** | `setting`, `tone`, `areaType` — escolha do jogador | **Não existe.** É a US-156, a única entrada com trabalho de dado novo |

`background.deity` é o encaixe mais forte e o menos óbvio: `{name, portfolio}` é uma divindade com
domínio declarada pelo jogador, e é o eixo natural para o antagonista e o fecho da aventura
saírem de quem o personagem é, não de uma tabela.

O `background` **já chega ao modelo** hoje — `createForCharacter` o passa a
`generateOpeningNarration`. O que não existe é ele **decidir a estrutura**: quem é o antagonista,
que NPC está amarrado a qual `bond`, qual `flaw` a aventura cobra. É essa a diferença que o motor
faz, e é por isso que ela não aparece como coluna nova.

**Ressalva do nível.** `Character.level` é `Int @default(1)` e nada no repo o muda (a **D1** do
backlog irmão). A assinatura do motor recebe nível desde o primeiro dia, mas o valor é 1 até
existir progressão. **Motor que só gera nível 1 entrega o que este backlog promete**, porque é o
único nível que o jogo alcança hoje.

**Ressalva do background vazio.** `background` é `Json @default("{}")`: criar personagem sem
preencher nada é caminho válido. O motor **não pode depender** de `story`, `bonds` ou `deity`
existirem — com o objeto vazio ele cai no `hookSeed` da classe, que sempre existe. Isto é
critério de aceite da US-148, não observação.

---

## O desenho: três camadas

A divisão é a mesma que o repo já usa para dados: **o que é sorteio roda no servidor, o que é
escrita vai ao modelo**, e nada é persistido sem passar num gate.

### 1. Determinístico, no Game Server

- `seed` derivado de `Character.id` + `Adventure.order`. Reproduzível: a mesma ficha regenera a
  mesma aventura, a eval pina um seed, e bug se rerroda igual. É o único empréstimo real do
  OneShotsmith, e é o que separa "gerador" de "roleta".
- Rolagem nas 135 tabelas com esse seed: premissa, locais, monumentos, complicação.
- Seleção de papel de statblock (Minion/Soldier/Brute) e orçamento do encontro, filtrados por
  nível e classe. A régua de dificuldade é a CD do SRD 2024 da
  [US-111](./US-111-classe-de-dificuldade-do-srd-2024.md).

### 2. Modelo, uma chamada por peça

- **Os 40 prompts de segredo**, com `background.story`, `bonds`, `flaws` e o `hookSeed` da classe
  no contexto. É a única camada que o próprio LGMRD desenhou para virar prompt.
- Prosa das locações e dos *area aspects*.
- **Modelo barato, não o da narração** — molde da
  [US-114](./US-114-modelo-utilitario-para-extracao-e-fecho.md). Geração de aventura não é turno:
  não tem streaming, não tem jogador esperando, não paga o teto de 60s do proxy SSE.

### 3. Gate, antes de persistir

Do gist: valida **antes** de compilar, nunca depois. Falhou, re-rola com `seed + 1` — **não** se
pede ao modelo para consertar a própria saída.

---

## Ordem de geração

```
0. registro                 ← tone + areaType, UMA vez, valem para tudo abaixo
1. objetivo                 ← tabela de quests
2. locais (~6)              ← tabelas de locais e monumentos, pelo seed
3. NPCs (~7)                ← gerador de NPC; >= 1 amarrado a background.bonds
4. segredos (~11)           ← modelo, os 40 prompts, com story/bonds/flaws no contexto
5. antagonista               ← modelo (US-190), ancorado em locais/NPCs/segredos já decididos
6. encontros (8, tipados)    ← US-166; situações podem ecoar o antagonista já decidido
7. fecho ramificado          ← e os followUps; recebe o antagonista pronto, não sintetiza mais
8. gate                      ← schema + grafo fecha + orçamento. Falha => re-seed
```

**Corrigido em 2026-08-21 (US-190).** O passo 1 original dizia *"objetivo + antagonista ←
tabela de quests + `background.deity`"* — nunca foi implementável como escrito: a US-164
(Questão em aberto #2) já tinha rejeitado `background.deity` como fonte de antagonista
(é a fé do PERSONAGEM, não um vilão) e apontado que `premissa` "não tem entidade nenhuma
atrás", ANTES de qualquer story de antagonista existir. US-181/US-183 resolveram a falta de
âncora ancorando `want`/`method`/`connection` em `locations`/`npcs`/`secrets` — só que dentro
de `generateClosing` (o ÚLTIMO passo), não logo depois que esses três existem. US-190 move a
síntese pro lugar que a lista acima já reflete: passo próprio, depois de segredos, antes de
encontros — cedo o bastante pra `generateOpeningBeat`/situações dos encontros poderem ecoar o
antagonista, tarde o bastante pra ter em que ancorá-lo.

**A ordem é a parte que importa, não a lista.** O passo 3 depende do 2 e o 4 depende dos dois:
gerar segredos antes de existirem locais e NPCs para ancorá-los produz exatamente a *"sopa de
pista genérica"* que o backlog irmão nomeia. Os números são os alvos que aquele backlog fixou
para a AV-0 — aqui servem para os dois produtores entregarem densidade comparável.

**Cada passo de 1 a 6 recebe os `id` do que já foi decidido**, e devolve referência por `id`, não
nome repetido. É o que faz o grafo do passo 7 ser verificável em vez de aspiracional — o passo 0
existe pela mesma razão, por outro eixo: tom decidido depois não retroage no que já foi escrito.

---

## O que o motor não produz

Os três do backlog irmão (*O que o gerador não produz*) valem aqui palavra por palavra, e agora
são critério de eval em vez de observação: **cadeia causal entre pistas**, **subversão do
template** e **semente plantada e não colhida**.

Um quarto, próprio deste backlog: **o motor não conhece a campanha.** Ele gera uma aventura de
cada vez. Estado que atravessa aventuras é entrada e saída dele, não invenção dele. Os
`followUps[]` da US-144 não desmentem isso — ele continua sem **planejar** entre aventuras; passa
a **emitir** as sementes, que é resposta parcial e custa um campo.

O primeiro dos três, a **cadeia causal**, é o que a integridade referencial da US-144 mais ataca —
e ainda assim não resolve. Grafo que fecha garante que a pista aponta para uma locação que existe;
não garante que as três pistas componham um mecanismo. Estrutura é piso, não teto.

Com a inversão, isto pesa mais do que pesava: **não há aventura escrita à mão debaixo da
experiência do jogador**, então estes quatro são o piso de qualidade e não o teto. É a razão de a
US-150 exigir um seed jogado à mão, e não só testes verdes.

---

## Depende de

| # | Dependência | Estado |
|---|---|---|
| Nenhuma story deste repo | — | **O corte mínimo roda sozinho.** É o ponto da inversão |
| D1 — progressão de nível | Não existe | Só para gerar acima do nível 1. Ver *Ressalva do nível*. **Perdeu o motivador** (o arco de 20 níveis foi para a fase 4); one-shot não precisa de progressão, mas a decisão não é deste documento |
| AV-0 — *O Lamento* | Não escrito, **fase 4** | Não é bloqueio nem horizonte próximo. A eval usa os exemplares do LGMRD — de forma permanente, não provisória |

---

## Tarefas

Caminho crítico marcado ✱.

**✱ US-143 — ADR: aventura como dado gerado**
Decide antes de existir schema: a aventura gerada é **regenerável pelo seed** ou **congelada no
banco**? Recomendação: **gravar os dois** — o artefato porque é o que a US-151 semeia, o seed
porque é o que a eval pina. Decide também onde o artefato mora: reusar `Adventure.entities`
(`Json`), como a AV-1 propunha, ou coluna própria.
Herda a decisão aberta 1 do backlog irmão (*aventura é dado de um sistema ou entidade reusável?*),
que a inversão torna urgente: quem escreve o schema primeiro responde primeiro.
Depende de: nada. Bloqueia: US-144.

**✱ US-144 — schema da aventura em `@ai-dm/shared`**
Zod para o que a aventura tem: `id`, `levelRange`, `setting`, `tone`, `areaType`, `summary`,
`npcs[]`, `secrets[]`, `locations[{title, aspects[], boxedText, description, occupants[]}]`,
`encounters[]`, `start`, `conclusion`, `followUps[]`.
**Os campos saem dos Eight Steps, não do que o motor sabe produzir** — ver *Um schema, dois
produtores*.

Três decisões de forma vindas do DnDGenerate, e são o que separa este schema de oito listas
paralelas:

- **Referência cruzada é `id`, nunca texto livre.** `secret.locationId`, `encounter.locationId`,
  `encounter.npcIds[]`, `npc.interactions[].encounterId`. Nome repetido em duas seções não é
  vínculo — é duas strings que por acaso batem, e o gate não consegue verificar.
- **`npc.interactions[].narrative`**: a fala escrita, não a descrição de personalidade.
- **`followUps[]`**: cada gancho com história bastante para virar cenário. É onde a "semente
  plantada e não colhida" vira campo.

Os três de registro entram aqui e não na US-147 porque são **propriedade da aventura, não da
rolagem**. A aventura escrita à mão também tem tom, e a AV-0 o declara em vez de sortear; e a
partir da US-156 quem os fixa pode ser o jogador. O campo guarda a **chave** (`grimdark`), nunca o
rótulo — mesmo contrato de `races`/`classes` desde a US-105, e é o que faz o artefato sobreviver
à troca de idioma.

Teste que protege a inversão: **uma locação e dois segredos escritos à mão** passam em `parse()`,
nos dois locales, antes de o motor existir. Sem isso o schema nasce moldado no gerador e a AV-0
não cabe nele.
Depende de: US-143. Bloqueia: quase tudo.

**✱ US-145 — `sync` pinado do LGMRD + NOTICE gerado**
Baixa `LGMRD.json` e `5e_Monster_Builder.json` por **commit SHA** (nunca por `main`: a fonte tem
workflow *nightly* e as versões publicadas não batem entre si) para `scripts/lazygm/`, e gera
`NOTICE-lazygm.md` a partir do campo `attribution` — verbatim, não parafraseado, com a atribuição
tripla. Artefato versionado e escrita determinística, molde da US-47; **não há parser**.
CC-BY-4.0, a mesma do Open5e — cabe no regime que
[NOTICE-open5e.md](../../../scripts/srd/NOTICE-open5e.md) já descreve.
O NOTICE entra no mesmo commit que o primeiro dado derivado.
Depende de: nada — pode ir em paralelo com US-143 e US-144.

**✱ US-146 — seed determinístico**
`seed` de `Character.id` + `Adventure.order`; toda rolagem do motor consome esse gerador, nenhuma
consome `Math.random`. Teste: o mesmo par regenera artefato **byte a byte** igual — mesma
propriedade de escrita determinística que a US-47 já exige dos artefatos do SRD.
Depende de: nada. Bloqueia: US-147.

**✱ US-147 — rolagem: registro primeiro, conteúdo depois**
Lê o artefato da US-145 e rola as tabelas pelo seed da US-146. Roda no Game Server, pelo mesmo
argumento dos dados: sorteio que o modelo faz não é sorteio. Saída ainda não é aventura — é a
lista de escolhas que os passos seguintes vestem de prosa.

**Duas rolagens de naturezas diferentes, e a ordem entre elas importa:**

1. **Registro — uma vez por aventura.** `setting`, `tone` e `areaType`, do eixo que o DnDGenerate
   expõe. Fixado uma vez e passado a **todas** as chamadas de modelo seguintes. Tom rolado por
   peça sai Grimdark no primeiro ato e Comedic no fecho.
2. **Conteúdo — por peça.** As 135 tabelas do LGMRD: premissa, locais, monumentos, complicação.

**Cada um dos três pode vir escolhido pelo jogador (US-156) ou não vir.** Quando não vem, é
sorteado aqui pelo seed da US-146 — e o sorteio é **por campo**, não tudo-ou-nada: escolher o tom e
deixar o local no aleatório é caminho normal.

Consequência que vale registrar: **"aleatório" continua determinístico.** Mesmo seed, mesmo
resultado — o jogador não pode re-rolar recarregando a página, e a eval continua podendo pinar
uma aventura inteira.

As listas de rótulos não são copiadas do DnDGenerate: são dez genéricos, e o projeto tem panteão
próprio. O que se copia é **haver o eixo, e ele ser fixado uma vez**.
Depende de: US-145, US-146. Consome, quando existir: US-156.

**✱ US-158 — locais e NPCs com prosa** *(descoberto em 2026-08-16, lacuna do texto original)*
O passo 2 (locais, ~6) e o passo 3 (NPCs, ~7; >= 1 amarrado a `background.bonds`) de *Ordem de
geração* estavam descritos em prosa desde o início (*O desenho: três camadas* já listava "prosa
das locações e area aspects" na camada 2), mas nunca ganharam número `GEN-N` nem story própria —
a numeração pulava direto de US-147 (rolagem crua) para US-149 (segredos). Sem eles, `locations[]`/
`npcs[]` com `id` real não existem em lugar nenhum do código para a US-149 referenciar.
Veste de prosa o conteúdo bruto da US-147 (`locais`/`monumentos` crus) e a tabela `patronsandnpcs`
(`behavior`/`ancestry`, sem `name`/`role` — invenção do modelo em cima disso, não cópia). `id` é
atribuído no código, nunca pelo modelo — é o primeiro passo que os minta; US-149 só os referencia.
Modelo barato (US-114), mesmo padrão da US-149.
Depende de: US-147. Bloqueia: US-149.

**✱ US-148 — perfil do personagem como entrada**
Monta o perfil que o motor recebe: nível, chave de classe, `background` e o `hookSeed` do gancho.
Critério que não pode faltar: **personagem com `background` vazio gera aventura completa**,
caindo no `hookSeed`. Assinatura recebe nível desde já, com valor 1 enquanto a D1 não existir.
Depende de: nada. Bloqueia: US-149.

**✱ US-149 — segredos pelos 40 prompts**
A chamada ao modelo do passo 4, com locais e NPCs já decididos no contexto (saída da US-158,
`locations[]`/`npcs[]` com `id` real — nunca o conteúdo bruto da US-147 direto) — nunca antes.
Modelo barato (US-114). É a tarefa que decide se a aventura gerada tem quebra-cabeça ou lista.
Depende de: US-158, US-148.

**✱ US-150 — gate antes de persistir**
Quatro verificações, e re-seed em vez de conserto:

1. O artefato passa no `parse()` da US-144.
2. **O grafo fecha.** Todo `locationId`, `npcId` e `encounterId` referenciado existe na seção
   correspondente, e nenhuma locação ou NPC declarado fica órfão — sem encontro, sem segredo,
   sem interação. É a verificação que a integridade referencial do DnDGenerate torna possível, e
   ela substitui o antigo "ao menos três segredos referenciam entidade que existe", que era a
   mesma ideia medindo só um lado.
3. O orçamento do encontro cabe em um personagem daquele nível.
4. Piso de quantidade por seção (locais, NPCs, segredos, encontros). Este vai **no prompt** e não
   aqui, no molde do DnDGenerate: pedir "se houver menos de N, escreva mais" é mais barato que
   re-rolar a aventura inteira por falta de um NPC.

Teto de tentativas explícito, com falha registrada — gerador que re-rola sem limite trava a
criação de personagem.
**Critério de saída do corte mínimo, e ele não é automatizável:** um seed pinado, jogado à mão
ponta a ponta. É o remédio do item 2 de *O que a inversão quebra*.
Depende de: US-149, US-159 (a régua da verificação 3).

**✱ US-151 — semear o ledger com os segredos gerados**
Os ~11 segredos entram como `WorldEntity` com `revelado: false`; os ~7 NPCs, com `revelado: true`.
Aproveita a [US-75](./US-75-dimensao-de-proveniencia-no-ledger.md) inteira — o Mestre já sabe não
revelar e já reinjeta sem comprimir. O caminho de semear ao criar aventura **já roda**
(`extractOpeningEntities` em [adventure.service.ts](../../../apps/api/src/adventure/adventure.service.ts)):
falta a fonte ser o artefato em vez de extração por LLM.
**É a tarefa que paga a conta:** ~11 pistas soltas dão ao Mestre o que fazer quando o jogador
anda, que é o defeito medido na
[US-71](./US-71-simplificar-localizacao-do-personagem.md) (9 de 24 viagens sem `updateScene`).
Depende de: US-144, US-150.

**✱ US-152 — statblocks por papel e orçamento para um personagem**
`5e_Monster_Builder.json` traz statblocks por função, não bestiário nominal — Minion (CR 1/8),
Soldier (CR 1/2), Brute (CR 2). **Não precisa ingerir monstro do SRD**, o que evita um pipeline
inteiro. O passo 5 povoa encontro com os papéis que existem, e o orçamento é medido contra o
*Lazy Encounter Benchmark* do próprio `5e_Monster_Builder.json` (US-159 — não a régua de CD de
teste de habilidade da US-111, que é outro dado do SRD), para **um** personagem.
Está no caminho crítico porque, sem ele, o gate da US-150 não tem o que verificar no encontro — e
encontro escrito no default de grupo mata um personagem solo de nível 1.

**Tamanho de grupo é 1, escrito como 1 — não como parâmetro.** Multiplayer é a fase 4; até lá,
multiplicador por número de personagens e limiar por grupo seriam configuração com um valor
possível, que é configuração falsa. O caminho de volta é conhecido e barato: quando a fase 4
chegar, o multiplicador entra num lugar só, aqui.
Note a assimetria com o **nível**, que *é* parâmetro desde já (*Ressalva do nível*): nível muda
dentro da fase 1 se a D1 existir; tamanho de grupo não muda antes da fase 4.
Depende de: US-145, US-147.

**✱ US-159 — orçamento de encontro do LGMRD** *(descoberto em 2026-08-17, corrige citação errada
da US-152/US-150 à US-111)*
A US-152 e a US-150 citavam "a régua de dificuldade do SRD 2024 (US-111)" como o que mede orçamento
de encontro — mas US-111 é CD de teste de habilidade (5/10/15/20/25/30), dado sem relação com
quantos monstros um personagem aguenta. Nenhum artefato do pipeline `scripts/srd` tem tabela de
orçamento de encontro. O `5e_Monster_Builder.json` (já baixado pela US-152/US-145) traz a própria:
o *Lazy Encounter Benchmark* — soma de CR contra nível do personagem, sem tabela de XP separada.
Duas funções puras, `encounterDeadlyThreshold(nível)` e `singleMonsterCrCap(nível)`, extraídas do
mesmo artefato, no molde committed/gitignored do `lgmrd-tables.json` (US-149).
Depende de: US-145 (parte da US-152). Bloqueia: US-152 (calibração de statblock), US-150 (verificação
3 do gate).

**✱ US-160 — composer de encontro usa o limiar de soma, não só o teto de monstro único**
*(descoberto em 2026-08-17, ao planejar a verificação 3 da US-150 contra a US-152 real)*
`composeEncounterRoles` (US-152) empacota contra `singleMonsterCrCap`, que é sempre maior que
`encounterDeadlyThreshold` em qualquer nível — empacotar contra o primeiro estoura o segundo
sempre. Em nível 1 isso reprova todo encontro gerado (`0.875 > 0`), e como a função é pura em
`level`, reseed (US-146) não muda nada: o gate esgotaria o teto de tentativas pra todo personagem
de nível 1–4, o público inteiro da fase 1. Correção: trocar o orçamento do loop guloso pra
`encounterDeadlyThreshold`; nível 1–3 (limiar `0`) devolve array vazio — resultado correto do
LGMRD, não bug.
Depende de: US-152, US-159. Bloqueia: US-150 (verificação 3 do gate).

**✱ US-164 — orquestrador: monta o `GeneratedAdventure` e gera o fecho ramificado**
*(descoberto em 2026-08-18, ao mapear o que falta pra integrar o motor ao prompt do AI DM)*
Seis stories da *Ordem de geração* chegaram a ✅ (US-145/146/147/149/152/158/159), mas nenhuma
função as chama em sequência. `grep GeneratedAdventure apps/api/src` só acha o import do tipo.
Falta: (1) a função que executa `rollAdventure` → `generateLocationsAndNpcs` → `generateSecrets`
→ `composeEncounterRoles`/`buildEncounterNpcs`, na ordem certa; (2) embrulhar a saída do
composer num `AdventureEncounter` de verdade (`id`, `locationId`, `npcIds[]`); (3) o passo 6
inteiro — fecho ramificado e `followUps[]` — que não tem prompt nem schema de chamada hoje.
Devolve um `GeneratedAdventure` que passa em `.parse()` (forma), não validado contra grafo —
isso é o gate da US-150, que consome o artefato desta story.
Depende de: US-146, US-147, US-149, US-152, US-158, US-159, US-160. Bloqueia: US-150, US-151.

**✱ US-166 — motor gera múltiplos encontros (4-5), não só um**
*(descoberta em 2026-08-18, questão em aberto #3 da US-164 — "um encontro ou 4-5?" — respondida
"4-5" e destacada como story própria)*
`generateAdventure` (US-164) monta `encounters[]` com UM elemento. Backlog original (passo 5,
acima) sempre foi plural. Esta story faz `composeEncounterRoles`/`buildEncounterNpcs` (US-152/
US-160/US-161, ✅, reusadas sem mudança) rodarem N vezes: papéis repetem (as funções são puras
por `level`/`challenge`, sem RNG — achado da US-160), `npcIds` cumulativo entre chamadas (evita
colisão de id), `locationId` round-robin pelas locations geradas. Sem schema novo — `encounters`
já é array (US-144). Gate (US-150) já compara orçamento de CADA encontro, plural-safe, sem
mudança necessária.
Depende de: US-164. Não entra no corte mínimo — motor roda com um encontro só (US-164) enquanto
esta story não entra.

**✱ US-161 — jogador escolhe o nível de desafio do encontro**
*(descoberto em 2026-08-17, discussão de produto sobre a US-160: array vazio em nível 1–3 é
resultado correto do LGMRD, mas fixa uma única resposta pra todo jogador, sem alternativa)*
`composeEncounterRoles` ganha segundo parâmetro `challenge: 'adventure' | 'challenge'` (chave
canônica EN, US-54): `'adventure'` (modo aventura, `encounterDeadlyThreshold`, default,
comportamento da US-160) ou `'challenge'` (modo desafio, `singleMonsterCrCap`, o orçamento
pré-US-160, que nunca saiu do repo — só reaproveitado, não recalibrado). Nenhuma fórmula nova;
US-159 permanece intacta. Decidido: a preferência é por aventura gerada, não campo em
`Character`; e precisa de tela já na fase 1 — story própria, **US-165**. Esta story entrega só a
função parametrizada.
Depende de: US-159, US-160. Não entra no corte mínimo — enhancement, motor roda sem ela
(default `'adventure'` preserva o comportamento da US-160).

**✱ US-165 — tela: jogador escolhe o nível de desafio do encontro**
*(descoberta em 2026-08-18, ao decidir que a US-161 precisa de tela já na fase 1)*
Quarto grupo de rádio no passo `world` (US-157) — Desafio, Modo aventura / Modo desafio — ao
lado de Cenário/Tom/Tipo de Área. Diferente daqueles três, não vem de catálogo (`challenge` é
enum fixo de dois valores, domínio de encontro, não registro de mundo). `CreateAdventureDto`
ganha `challenge?`. Fora desta story: consumir o campo na geração real (orquestrador, US-164,
segue sem esse parâmetro).
Depende de: US-161, US-157. Não entra no corte mínimo — enhancement sobre enhancement.

**✱ US-162 — jogador escolhe a quantidade de segredos ativos**
*(descoberto em 2026-08-17, mesma discussão de produto da US-161: que outros dials fazem
sentido pro jogador gerenciar)*
`SECRET_CATEGORY_COUNT` (`ai.service.ts:163-168`) é `Record` fixo — sempre 3+3+3+2=11 segredos,
mesmo split entre as 4 categorias do LGMRD, pra todo jogador. Vira função de uma preferência de
densidade, 2-3 níveis pré-definidos, teto de 10 por categoria (tamanho da seção-fonte). Nenhum
prompt-molde novo, nenhuma tabela do LGMRD muda — só quanto de cada categoria já existente é
pedido.
Depende de: US-149. Não entra no corte mínimo — enhancement, motor roda sem ela (default
reproduz o comportamento de hoje).

**✱ US-163 — jogador escolhe o tamanho da aventura (NPCs de história)**
*(descoberto em 2026-08-17, mesma discussão de produto da US-161/US-162; escopo de locais saiu
daqui em 20/08/2026)*
`NPC_ROLL_COUNT=7` (`roll-content.ts:20`) vira função da mesma preferência de tamanho —
parametrização direta, mesmo padrão dos dials irmãos.
Depende de: US-158. Não entra no corte mínimo — enhancement, motor roda sem ela (default
reproduz `NPC_ROLL_COUNT=7` de hoje).
Contagem de locais **não tem controle hoje** (`locais`/`monumentos` vêm de uma única linha
rolada, sem instrução de quantidade no prompt) — não é mais escopo desta story: virou piso fixo
(8, não preferência) na [US-166](./US-166-motor-gera-multiplos-encontros.md), que precisa dele
pra cobrir os 8 encontros sem repetição de local.

**✱ US-153 — a aventura deixa de ser derivada da classe**
`createForCharacter` para de resolver a aventura por `resolveInitialHook(config, character.class)`
e passa a chamar o motor. Sai também a validação que **rejeita** `initialHookId` diferente do da
classe. O gancho continua vivo como **porta de entrada**: `openingNarration` é o `hookSeed` que a
US-148 consome e que explica por que *aquele* personagem está *nesta* aventura.
Critério: dois personagens da mesma classe, com backgrounds diferentes, recebem aventuras
diferentes; o mesmo personagem regenerado recebe a mesma.
O `CreateAdventureDto` (hoje um campo só, `initialHookId`) perde esse campo e ganha os três de
registro da US-156, **todos opcionais**.
Depende de: US-150, US-151.

**US-154 — eval da aventura gerada**
Caso de fidelidade no molde da US-49, com a rubrica da
[US-36](./US-36-eval-de-qualidade-da-narracao.md), contra um seed pinado: o Mestre não revela
segredo com `revelado: false` antes da ficção merecer, nem inventa NPC quando há ~7 gerados.
Referência de densidade: os dois exemplares do LGMRD que a US-145 já baixou — e, com o arco na
fase 4, **de forma permanente e não provisória**. Ancorar assert no **artefato** (este `secretId`
continua oculto, este NPC existe), não na impressão de quem leu.
O que eles **não** medem, por serem em inglês e escritos para grupo: se a aventura funciona para
um personagem só, e se a prosa em pt-BR presta. Essas duas ficam com o seed jogado à mão (US-150) e
a rubrica da US-36. Ver *O adiamento do arco para a fase 4*.
Depende de: US-151, US-153.

**US-155 — aposentar a quest fixa por classe**
Remove `primaryQuestTitle`/`primaryQuestDescription` dos 13 ganchos quando a quest primária passar
a vir da aventura gerada, para não sobreviverem como campo morto que o gate da
[US-89](./US-89-gate-de-codigo-morto-com-knip.md) pega depois. O resto do gancho
(`openingNarration`, `tags`) **fica**: é entrada da US-148.
Depende de: US-153.

### O jogador escolhe o registro

**✱ US-156 — catálogos de registro, DTO e validação**
`settings`, `tones` e `areaTypes` entram no `SystemConfig` como `SystemCatalogEntry[]` — o mesmo
contrato de `races` e `classes` desde a US-105: **chave canônica EN + rótulo no locale do
config**. Não são texto solto no componente, e não podem ser: o gate de string literal no JSX da
[US-102](./US-102-gate-de-string-literal-no-jsx.md) reprova, e o
[seletor de idioma](./US-97-seletor-de-idioma-pt-br-en.md) pediria tradução em runtime de algo que
já é dado.

Três decisões que economizam o resto:

- **"Aleatório" não é entrada de catálogo.** É **ausência de escolha** — campo omitido no DTO, e a
  US-147 sorteia pelo seed. Pôr uma chave `random` na lista obrigaria todo consumidor a tratá-la
  como caso especial: o prompt, o artefato, a resolução de rótulo e o gate. Ausência já significa
  isso e não custa nada.
- **A escolha é por campo.** Três opcionais independentes, não um botão "surpreenda-me" global.
- **A escolha vive na aventura, não no personagem.** Vai no `CreateAdventureDto` e aterrissa nos
  campos de registro do artefato da US-144. **Sem migração** — o `Character` não ganha coluna, e o
  mesmo personagem pode ter aventuras de tons diferentes.

**Validação no servidor, não só na tela** (fronteira de confiança): chave fora do catálogo do
sistema é 400, no mesmo molde da validação de classe e raça que a US-105 já faz. Cliente não é a
fonte de verdade da lista.
Depende de: US-144. Bloqueia: US-157.

**✱ US-157 — a tela de mundo, depois da revisão**
Sétimo passo do `SetupWizard`, que hoje termina em `review`
(`'system' | 'race-class' | 'attributes' | 'skills' | 'background' | 'review'`). O novo passo entra
**depois**, e a ordem tem razão: a revisão fecha o **personagem**; esta tela abre a **aventura**.
São dois objetos, e misturá-los num passo só faria a revisão revisar coisa que ainda não foi
escolhida.

Três grupos, cada um com as opções do catálogo mais **Aleatório** — que na tela é uma opção
visível e no DTO é o campo omitido. Padrão: os três em Aleatório, então avançar sem tocar em nada
continua sendo um clique.

Chaves de i18n novas em `setup.world.*`, nos dois locales.
[US-46](./US-46-acessibilidade-wcag-aa.md) (WCAG AA) e
[US-66](./US-66-telas-mobile-friendly.md) (mobile) valem como em toda tela nova — grupo de rádio
com rótulo associado, não `div` clicável.
Depende de: US-156.

---

## Corte mínimo

**US-143 + US-144 + US-145 + US-146 + US-147 + US-158 + US-148 + US-149 + US-164 + US-150 + US-151 + US-152 + US-159 +
US-160 + US-153 + US-156 + US-157** — dezessete stories (US-158 somada em 2026-08-16, US-159 e
US-160 somadas em 2026-08-17, US-164 somada em 2026-08-18, todas lacunas nunca numeradas do texto
original), **nenhuma tarefa de escrita**, nenhuma dependência de outro backlog.

Fora: eval e limpeza dos ganchos. Fora também: seed compartilhável, PDF, mapa, quests em fases.

**A US-157 é a única do corte que o motor não precisa para rodar** — sem ela os três campos ficam
sempre omitidos e a US-147 sorteia tudo, que é produto funcionando. Está dentro porque é escopo
pedido, não porque destrava algo. Se o corte precisar encolher, é a primeira a sair, e sai sem
deixar buraco: o DTO já aceita os campos.

O corte é maior que o do backlog irmão em número de stories e menor em calendário: lá o caminho
crítico passava por escrever uma aventura inteira em dois idiomas. **Aqui não há nenhuma tarefa
que só uma pessoa consiga fazer.**

Critério de saída: um seed pinado, jogado ponta a ponta à mão (US-150). Se a aventura gerada for
sopa de pista genérica, o resto do backlog é trabalho jogado fora.

**Com o arco na fase 4, esse critério subiu de peso.** Antes ele era o portão do corte mínimo e a
saída de emergência era escrever *O Lamento* primeiro. Agora não há saída de emergência: não
existe aventura escrita à mão no horizonte da fase 1, e o playtest manual é a única medida de
qualidade que não vem de exemplar em inglês escrito para grupo. Ele deixa de ser evento único e
vira **rotina** — um seed novo jogado a cada mudança no prompt de segredos (US-149).

---

## O que isto torna obsoleto no backlog irmão

**Aplicado em 07/08/2026** no
[backlog das aventuras autorais](./backlog-aventuras-autorais-lazygm.md). As seções datadas de lá
(*Por que Pegāna*, *Por que este material*, *A fonte de método*) **não foram reescritas** — o
raciocínio delas é anterior e vale como registro.

1. O **corte mínimo** de lá listava AV-1, AV-2, AV-3, AV-4 e AV-6, que passaram a ser US-144,
   US-145, US-153, US-151 e US-152. O corte de lá encolheu para **AV-0**, e a ADR-AV foi absorvida
   pela US-143.
2. A **decisão de 06/08 — campanha única para todas as classes** — foi marcada como reaberta.
   **Com o adiamento para a fase 4 ela se resolve por consequência:** na fase 1 não há campanha
   autoral, então não há campanha única; a pergunta volta com o multiplayer.
3. A **AV-3** de lá dizia *"personagens de classes diferentes recebem a mesma campanha, com
   aberturas diferentes"*. A US-153 inverte o critério.
4. A **D3** (conteúdo para as aventuras 2..N) é exatamente o que este backlog resolve — era o
   caminho **(b)** que a decisão aberta 4 de lá registrava como *"o caminho provável"*. **D1** e
   **D2** continuam sem dono, e a D1 perdeu o motivador junto com o arco.

---

## Decisões tomadas

- **07/08/2026 — o motor é produtor do schema da aventura, não sistema paralelo.** *Um schema,
  dois produtores*.
- **07/08/2026 — quatro das sete referências ficam de fora.** *Triagem das sete referências*.
  Corrigido no mesmo dia: o `dhorions/DnDGenerate` tinha sido descartado a partir do README, que
  não mostra o prompt. Entrou com quatro achados — ver *O que o DnDGenerate acrescenta*.
- **07/08/2026 — este backlog roda primeiro.** Custos, ganhos e os três remédios em *A inversão e
  o que ela custa*. Cinco tarefas mudam de dono.
- **07/08/2026 — o jogador escolhe o registro, e "aleatório" é ausência de escolha.** Nem chave de
  catálogo, nem flag: campo omitido no DTO, sorteado pelo seed. Por campo, não global. US-156.
- **07/08/2026 — a tela de mundo vem depois da revisão.** A revisão fecha o personagem; a tela
  abre a aventura. Dois objetos, dois passos. US-157.
- **07/08/2026 — o arco de história vai para a fase 4 (multiplayer).** Este backlog passa a ser o
  único caminho de aventura da fase 1, o motor gera inclusive a primeira, e a referência de eval
  fica sendo permanentemente os exemplares do LGMRD. Custos em *O adiamento do arco para a fase 4*.
- **07/08/2026 — tamanho de grupo é 1, escrito como 1.** Não é parâmetro antes da fase 4. US-152.
- **17/08/2026 — a régua de orçamento da US-152 não é a US-111.** US-111 é CD de teste de
  habilidade (5/10/15/20/25/30); orçamento de encontro é outro dado do SRD, e o repo não tinha
  nenhum artefato com essa tabela ingerido. Achado: o `5e_Monster_Builder.json` (já baixado pela
  US-145) traz o *Lazy Encounter Benchmark* próprio do LGMRD — soma de CR contra nível do
  personagem, sem tabela de XP separada. Story nova no corte mínimo: **US-159**.
- **21/08/2026 — antagonista sai do passo 1, vira passo próprio entre segredos e encontros.**
  O passo 1 original ("objetivo + antagonista ← tabela de quests + `background.deity`") nunca foi
  implementável: a US-164 (Questão em aberto #2) já tinha rejeitado `background.deity`/`premissa`
  como fonte, antes de qualquer story de antagonista existir. US-181/183 ancoraram `want`/`method`/
  `connection` em `locations`/`npcs`/`secrets`, mas dentro de `generateClosing` (último passo) — a
  lacuna só apareceu ao notar que `generateOpeningBeat`, rodando em paralelo com `generateClosing`,
  nunca chegava a ver o antagonista. Story nova: **US-190**, move a síntese pro lugar que a *Ordem
  de geração* acima já reflete.
- **16/08/2026 — locais e NPCs com prosa viram US-158, story própria.** Estavam descritos em
  *O desenho: três camadas* desde o início mas nunca numerados nem escritos — a lacuna só apareceu
  ao detalhar a implementação da US-149, que assumia `locations[]`/`npcs[]` com `id` real
  como entrada já pronta.

## Decisões abertas

1. ~~**A campanha única de 06/08 sobrevive?**~~ **Respondida por consequência em 07/08/2026:** na
   fase 1 não há campanha única porque não há campanha autoral. O motor gera todas as aventuras,
   inclusive a primeira. A pergunta volta na **fase 4**, com multiplayer, que é onde ela sempre
   fez sentido. Ver *O adiamento do arco para a fase 4*.
2. **Aventura gerada é regenerável ou congelada?** Recomendação na US-143: gravar os dois.
3. **Quantas chamadas ao modelo por aventura, e a que custo?** O passo 4 é uma; locações e fecho
   podem ser mais. Não foi medido, e a baseline da
   [US-104](./US-104-baseline-de-cache-do-prompt-pos-pin.md) é de turno, não de geração.
4. **O motor usa os vínculos da [US-113](./US-113-vinculos-ancorados-na-fonte-no-ledger.md)?**
   NPC amarrado a `background.bonds` é exatamente um vínculo ancorado na fonte. Se a US-113
   entregar antes, o passo 3 grava vínculo em vez de texto solto.
5. **Gerar na criação do personagem ou em background?** A US-149 é chamada de modelo dentro de
   `createForCharacter`, que já espera pelo `generateOpeningNarration`. Somar uma segunda espera
   ao caminho síncrono da criação pode estourar o teto do proxy SSE. Medir na US-149.

## Referências no código

- [schema.prisma](../../../apps/api/prisma/schema.prisma) — `Character.level`, `Character.background`, `Adventure.order` e `Adventure.entities`: as quatro entradas/saídas do motor, todas existentes.
- [adventure.service.ts](../../../apps/api/src/adventure/adventure.service.ts) — `createForCharacter`: onde o gancho por classe é resolvido e validado hoje, e onde o motor entra na US-153. `extractOpeningEntities` é o caminho de semeadura que a US-151 reusa.
- [starting-inventory.ts](../../../apps/api/src/character/starting-inventory.ts) — `resolveInitialHook`: como a classe vira gancho. Desde a US-105 o lookup é direto pela chave canônica.
- [initial-adventures.ts](../../../apps/api/prisma/initial-adventures.ts) — os 13 ganchos. `openingNarration` vira entrada da US-148; os dois campos de quest são o que a US-155 aposenta.
- [character.ts](../../../packages/shared/src/types/character.ts) — `WorldEntity`, com os eixos `sabido` e `revelado` da US-75: é onde os segredos gerados aterrissam na US-151.
- [system.ts](../../../packages/shared/src/types/system.ts) — `SystemCatalogEntry` e `catalogLabel`: o contrato de chave+rótulo que a US-156 copia para `settings`, `tones` e `areaTypes`.
- [SetupWizard.tsx](../../../apps/web/src/components/setup/SetupWizard.tsx) — os seis passos de hoje; a US-157 acrescenta o sétimo depois de `review`.
- [sync.mjs](../../../scripts/srd/sync.mjs) — molde de pinagem e artefato versionado que a US-145 copia. O parser da US-47 **não** é reusado: aqui não há parser.
- [backlog-aventuras-autorais-lazygm.md](./backlog-aventuras-autorais-lazygm.md) — o produtor B, os Eight Steps e os alvos de densidade. Deixa de ser pré-requisito e passa a ser o que vem depois.
