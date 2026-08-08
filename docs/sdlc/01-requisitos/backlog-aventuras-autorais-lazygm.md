# Backlog — Aventuras autorais a partir do Lazy GM's Resource Document

**Objetivo:** jogar *O Lamento* — primeira aventura da campanha de **Pegāna** — dentro do AI DM.
**Decisão de produto:** **todas as classes seguem para a mesma campanha**, e *O Lamento* é
a **primeira de uma sequência que vai até o nível 20**. Não há seleção de aventura — há ordem.
Ver *Uma campanha só para todas as classes* e *Horizonte: sequência até o nível 20*.
**Fontes, três e distintas:**
- **Método de prep e geradores:** The Lazy GM's Resource Document (Michael E. Shea,
  SlyFlourish.com), CC-BY-4.0. É daqui que saem os Eight Steps, os 40 prompts de segredo,
  as 135 tabelas e os statblocks por papel.
- **Mundo:** *The Gods of Pegāna* (1905) e *Time and the Gods* (1906), de Lord Dunsany —
  **domínio público**. Panteão, cosmologia, topônimos e tom.
- **Texto da aventura:** **autoral**. Não há aventura pronta para copiar.

**Criado em:** 2026-08-06
**Atualizado em:** 2026-08-07 — *The Night Blade* / Whitesparrow saiu; Pegāna entrou.
Ver *Por que Pegāna no lugar do Night Blade*.
**Atualizado em:** 2026-08-07 (segunda vez, mesmo dia) — o
[motor de geração](./backlog-motor-de-geracao-de-aventuras.md) passou à frente deste backlog.
Cinco tarefas mudaram de dono e o corte mínimo encolheu. Ver *A inversão de 07/08/2026*.
**Atualizado em:** 2026-08-07 (terceira vez, mesmo dia) — este backlog **sai da fase 1**. Ver
*Adiado para a fase 4*.
**Fase:** 4 — multiplayer (era 1 — MVP single-player)
**Status:** 📋 Proposta adiada — nenhuma tarefa iniciada, e nenhuma inicia antes do multiplayer

Este documento **não é uma user story**. É a sequência de tarefas até a meta acima, com
dependências e o que já está pronto. Cada item vira um `US-*.md` próprio quando entrar em
execução — escrever os onze agora seria planejar em cima de decisões que a **GEN-0** (era a
ADR-AV) ainda não tomou.

> **Rótulos, não números de story.** `AV-1`…`AV-10` e `ADR-AV` são identificadores **internos
> deste documento**, para as dependências se referenciarem. O número real (`US-NNN`, `ADR NNN`)
> é atribuído **no dia em que a story for escrita**, com o próximo livre da época — outras
> stories entram no repo antes destas. Ao criar o arquivo, substitua o rótulo aqui pelo número
> atribuído; enquanto isso, `AV-N` não corresponde a nenhuma story existente.
>
> **Desde 07/08/2026 cinco rótulos migraram** para o
> [backlog do motor](./backlog-motor-de-geracao-de-aventuras.md): AV-1→GEN-1, AV-2→GEN-2,
> AV-3→GEN-10, AV-4→GEN-8, AV-6→GEN-9, e a ADR-AV foi absorvida pela GEN-0. As seções datadas
> (*Por que Pegāna*, *Por que este material*, *A fonte de método*) **não foram reescritas** — o
> raciocínio delas é de antes da inversão e vale como registro. Ler os `AV-N` de lá pela tabela
> de *A inversão de 07/08/2026*.

---

## Adiado para a fase 4

Decidido em **07/08/2026**, horas depois da inversão, e **absorve a inversão**: não há mais duas
ordens possíveis para comparar. Este backlog inteiro — Pegāna, quatro atos, nível 1 ao 20 — só
entra quando houver **multiplayer**, a **fase 4** de seis no roadmap do `AGENTS.md`. A fase atual
é a 1.

O motivo é o formato: campanha longa com atos é coisa de grupo. Um arco de vinte níveis escrito
para um jogador solo é a forma mais cara possível de descobrir que o produto é jogado em sessões
avulsas.

**O que passa a valer na fase 1:** o
[motor de geração](./backlog-motor-de-geracao-de-aventuras.md) é o único caminho de aventura, e
gera **todas**, inclusive a primeira.

### O que o adiamento resolve aqui

- **A decisão aberta 7** (*a campanha única sobrevive à inversão?*) morre respondida: na fase 1
  não há campanha única porque não há campanha autoral. A pergunta volta na fase 4, com
  multiplayer — que é onde ela sempre fez sentido, já que "todas as classes na mesma campanha" é
  uma frase sobre um grupo.
- **A tensão entre os dois backlogs acaba.** Não competem por ordem; estão em fases diferentes.

### O que o adiamento não muda

- **As decisões de 06 e 07/08 continuam registradas e válidas para quando este backlog voltar.**
  Pegāna, os Eight Steps, a densidade-alvo da AV-0, a licença — nada disso foi revisto.
- **D1** (progressão) e **D2** (dado de classe acima do nível 1) continuam sem dono. A **D1**
  perdeu o motivador junto com o arco: one-shot não precisa de progressão. Se ela vai acontecer na
  fase 1 por outro motivo, é decisão de outro backlog.

### O que não fica proibido

**Escrever *O Lamento* é prosa, e prosa não depende de multiplayer.** A AV-0 é a tarefa mais longa
daqui e é a única sem dependência técnica nenhuma. Se o arco é para acontecer na fase 4, começar a
escrita antes é a única forma de ela não ser descoberta como a tarefa mais longa **na** fase 4.
Registrado como observação — o backlog segue adiado, e nada no motor depende disto.

---

## A inversão de 07/08/2026

Decidido no mesmo dia da troca por Pegāna, com o backlog ainda em proposta e **zero código
escrito** — de novo, a única hora em que isso é barato.

O [motor de geração de aventuras](./backlog-motor-de-geracao-de-aventuras.md) **roda antes deste
backlog**. O motivo é de calendário, não de mérito: o caminho crítico daqui passa pela **AV-0**,
que é escrita — não paralelizável, não delegável, sem teste que a destrave. O corte mínimo do
motor é só código, e responde antes se o desenho de aventura estruturada se sustenta.

### Cinco tarefas mudam de dono

Elas não morrem: mudam de documento, porque agora são pré-requisito **daquele** caminho.

| Tarefa | Vira | Onde está o texto agora |
|---|---|---|
| AV-1 — `AuthoredAdventureSchema` | **GEN-1** | Quem chega primeiro escreve o schema |
| AV-2 — `sync` pinado + NOTICE | **GEN-2** | Já era independente daqui (*"pode ir em paralelo"*) |
| AV-3 — campanha única no lugar do gancho por classe | **GEN-10** | Muda de motivo — ver abaixo |
| AV-4 — semear entidades e segredos | **GEN-8** | O `map()` é o mesmo; a fonte é o artefato gerado |
| AV-6 — statblocks por papel | **GEN-9** | Vêm do mesmo artefato da GEN-2 |

### O que este backlog ganha

A **AV-0 passa a escrever contra um schema que já existe e já rodou**, em vez de contra um schema
proposto — e o teste dela (*"uma locação e dois segredos passam em `parse()`"*) vira pré-requisito
da GEN-1, não trabalho da AV-1.

### O que este backlog perde

**A decisão de 06/08 — campanha única para todas as classes — deixa de ser fundacional.** Ela foi
tomada porque havia **uma** aventura escrita para servir a todos. Com uma aventura gerada por
personagem, *O Lamento* passa a ser uma aventura **entre** as geradas, não a aventura de todos, e
a AV-3 (agora GEN-10) inverte o próprio critério de aceite: em vez de *"classes diferentes recebem
a mesma campanha com aberturas diferentes"*, passa a ser *"backgrounds diferentes recebem
aventuras diferentes"*.

**Isto está reaberto, não decidido** — ver *Decisões abertas*, item 7. O que continua certo em
qualquer cenário: os 13 ganchos da US-28 seguem vivos como porta de entrada, e o `hookSeed`
continua sendo o que explica por que *aquele* personagem está *naquela* aventura.

---

## Depende de

Três subsistemas que **não existem no repo** (verificado em 06/08/2026) e sem os quais este
backlog não fecha:

| #      | Dependência                         | Estado hoje                                                                                                                                                                              | Onde dói                                                                                                                                                                                                                                            |
| ------ | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **D1** | **Progressão de nível**             | `Character.level` é `Int @default(1)` em [schema.prisma](../../../apps/api/prisma/schema.prisma) e **nada no repo o incrementa**. Sem XP, sem marco, sem level-up — o campo é decorativo | Sem ela não há aventura 2, e AV-7 calibra contra um nível que nunca muda                                                                                                                                                                            |
| **D2** | **Dado de classe acima do nível 1** | No artefato do SRD, `classFeatures` é lista plana **sem campo `level`**; `classSpells` idem. É a fronteira que a [US-41](./US-41-features-traits-de-classe.md) fixou                     | Subir de nível sem isto incrementa um número que não muda nada na ficha nem no prompt. Exige voltar ao pipeline da [US-47](./US-47-ingestao-srd-como-dado.md) e re-ingerir com progressão, não somar um campo                                       |
| **D3** | **Conteúdo para as aventuras 2..N** | Nenhuma linha escrita. Pegāna dá **mundo** (Dunsany, domínio público) e o LGMRD dá **método + geradores**; o texto das aventuras é autoral em qualquer cenário                           | Trabalho contínuo, e **sem teto de licença** — que é o motivo da troca de 07/08/2026. Saem de: **(a)** autorais, **(b)** geradas pelas 135 tabelas + os 40 prompts de segredo com Dunsany como corpus de tom. **(b)** é o que o material favorece |

Cada uma é backlog próprio — nenhuma é construída aqui. **D1** e **D2** são pré-requisito de
qualquer aventura além da primeira; **D3** é trabalho contínuo.

> **A D3 ganhou dono em 07/08/2026.** É exatamente o que o
> [motor de geração](./backlog-motor-de-geracao-de-aventuras.md) resolve — o caminho **(b)** da
> tabela acima, que a *Decisão aberta 4* registrava como "o caminho provável". Deixa de ser
> trabalho contínuo sem endereço e passa a ser aquele backlog. **D1** e **D2** seguem sem dono.

> **Ressalva de sequenciamento.** *O Lamento* é aventura de nível 1–3: o **corte mínimo roda
> sem nenhuma das três**. Elas travam a *sequência*, não a primeira aventura. Tratá-las como
> bloqueio duro do backlog inteiro adia a única entrega que responde se o material vale o
> esforço. Recomendação: manter as três registradas como dependência da **meta** (nível 20) e
> deixar o corte mínimo correr antes delas.

---

## Por que Pegāna no lugar do Night Blade

Decidido em **07/08/2026**, com o backlog ainda em proposta e **zero código escrito** — que é a
única hora em que essa troca é barata.

### O que a troca ganha

1. **A D3 perde o teto.** Do livro do Sly Flourish só a vila e uma aventura saíram sob CC; o
   resto de *Fantastic Adventures* não. A meta do nível 20 (decidida em 06/08) era **inalcançável
   com aquele conteúdo** — as aventuras 2..N já iam ter de vir de outro lugar. Dunsany é domínio
   público e a campanha é autoral: não há segunda aventura bloqueada por licença.
2. **A AV-9 vira de lado.** Traduzir ~15 mil palavras da prosa de outro autor era *"a tarefa mais
   cara da lista e a mais fácil de subestimar"*. Escrever pt-BR nativo e depois o en-US da mesma
   cena é o arranjo que os 13 ganchos da US-28 já usam
   ([initial-adventures.ts:16-19](../../../apps/api/prisma/initial-adventures.ts)) e que
   funcionou. Continua caro; deixa de ser **dívida de tradução**.
3. **A AV-7 encolhe.** *The Night Blade* foi escrita para grupo e o AI DM é solo — dimensionar era
   retrofit obrigatório no corte mínimo. Aventura autoral **nasce solo**: os dials viram guia de
   escrita, não passe de reescrita.
4. **O gancho por classe encaixa melhor.** A porta de entrada da consequência 1 era "por que este
   personagem está nesta estrada". Em Pegāna a abertura é um navio-prisão, e a pergunta vira
   "**que crime ou tragédia pôs este personagem a bordo**" — que é exatamente o que os 13 ganchos
   já descrevem: o ladino roubou a Lágrima de Solane, o bruxo invadiu o arboreto, o bárbaro falhou
   na prova. Deixam de ser cenas desempregadas e viram o passado do personagem.
5. **A [ADR 010](../../adr/010-upload-de-livro-como-lore.md) ganha corpus de graça.** Ela decide
   que livro enviado é lore recuperável, e deixa em aberto (*questão 2*) o chunking de PDF de RPG
   com duas colunas, statblock e caixa de texto. Dunsany é **prosa corrida em texto puro,
   domínio público** — o caso mais fácil que existe, e o que valida o pipeline sem pisar na
   questão jurídica (*questão 3*). O mundo da campanha e o primeiro acervo de lore passam a ser
   o mesmo texto.

### O que a troca perde, e é real

1. **O conteúdo deixa de existir.** O *Night Blade* estava escrito, publicado e testado por um
   profissional; a AV-1 tinha o teste pronto (*"o Night Blade inteiro passa em `parse()`"*).
   Agora **escrever a aventura é tarefa** — a AV-0, que antes não existia, e que é a mais longa
   do backlog.
2. **Perde-se o controle experimental.** O corte mínimo respondia *"o material do Lazy GM roda no
   AI DM?"*. Passa a responder *"a minha aventura roda no AI DM?"* — duas variáveis mexendo ao
   mesmo tempo. Mitigação barata: a AV-0 escreve contra os **Eight Steps**, então o que está
   sendo testado continua sendo o formato, não só o texto.
3. **A primeira mordida é maior.** *Night Blade* é uma aventura de nível 1 fechada; o Ato 1 de
   Pegāna cobre níveis 1–5. Por isso o escopo aqui é **só *O Lamento*** (níveis 1–3), não o ato.

### O que a troca não muda

ADR-AV, AV-1 (forma do schema), AV-3, AV-4, AV-5 e AV-10 seguem palavra por palavra. O método
de prep, os 40 prompts de segredo, as 135 tabelas e o Monster Builder continuam vindo do LGMRD —
**a troca é da camada de conteúdo, não da de método**.

---

## Por que este material

O documento tem quatro camadas distintas, e três interessam agora:

| Camada | Exemplo | Destino |
|---|---|---|
| **Método de prep** | Eight Steps, Secrets and Clues, Fantastic Locations | Modelo de dado da aventura (AV-1) e molde de escrita (AV-0) |
| **Geradores aleatórios** | `1d20 Quests`, `1d20 Chambers`, NPC Generator, 100 Monument Structures | Gerador determinístico no Game Server; insumo das aventuras 2..N |
| **Conteúdo pronto** | Whitesparrow + *The Night Blade* | **Fora desde 07/08/2026** — ver *Por que Pegāna no lugar do Night Blade*. Fica como **exemplar de tom e de densidade**: é a referência de "aventura bem escrita neste formato" contra a qual a AV-0 se mede |
| **Ajuste 5e** | CR, encounter benchmark, monster templates | Statblocks por papel entram (AV-6); o resto é *awareness*, não motor |

O achado que orienta o desenho: **"Creating Secrets and Clues" não é tabela.** São 40
perguntas em 4 categorias, e o próprio documento diz que elas não geram segredos — geram a
pergunta que faz alguém escrever um. Pergunta que inspira escrita **é prompt de LLM**. E dá
para verificar que funciona na própria aventura publicada: de *NPC and Villain Secrets* sai
*"What NPC who the character thinks is dead still lives?"* — que é, literalmente, o Gardren
do *Night Blade*.

Divisão que cai naturalmente no projeto: tabela `d20` rola no Game Server (mesmo argumento
dos dados); os 40 prompts de segredo vão ao modelo, com Whitesparrow como exemplar de tom.

### O que o gerador **não** produz

Vale registrar antes de alguém prometer "aventuras infinitas":

1. **Encadeamento causal entre pistas.** No *Night Blade*: testemunha viu bandidos mijando nas
   botas → urina repele o tangleweed → dá para atravessar. Três pistas, um mecanismo, virando
   quebra-cabeça. Tabela produz itens soltos, não cadeia. É onde saída de LLM degrada em sopa
   de pista genérica, e onde a eval (AV-10) tem que morder.
2. **Subversão do template.** *Night Blade* é o template 1 (*Kill the Boss*) que se revela
   template 3 (*Rescue Someone*): mandam trazer Ralavaz à justiça, encontra-se Ralavaz preso na
   lama, e o chefe verdadeiro é o irmão dado por morto. O `d10` gera a premissa, não a virada.
3. **Semente plantada e não colhida.** A mão ciclópica de Whitesparrow não é resolvida no
   *Night Blade* — é gancho para outras aventuras do livro. Gerador não planeja entre aventuras.

> **Isto deixou de ser observação e virou o critério de aceite da AV-0.** Com o *Night Blade*,
> as três vinham prontas na compra; escrevendo a aventura, elas são o que separa *O Lamento* de
> uma premissa genérica. Os três equivalentes, para a AV-0 não ter de redescobri-los:
>
> 1. **Cadeia causal.** As correntes enferrujaram só onde tocaram a pele de um prisioneiro → o
>    fragmento queima **frio**, não quente → o rombo no casco foi aberto **de dentro** → alguém
>    a bordo já acordou o dele antes de você. Três pistas, um mecanismo, um quebra-cabeça.
> 2. **Subversão de template.** A premissa é *fugir do navio*. A virada é que o casco de ferro
>    é a única coisa que esconde o fragmento de Mung, e **fugir é o que marca o personagem** —
>    o objetivo óbvio é a armadilha.
> 3. **Semente não colhida.** O tambor de Skarl sai do compasso uma vez durante a aventura e
>    **não é explicado**. É gancho da campanha inteira, plantado na aventura 1.

---

## Uma campanha só para todas as classes

> **Reaberta em 07/08/2026 pela inversão.** A seção continua descrevendo o raciocínio de 06/08 e
> as três consequências, que seguem válidas *se* a campanha única sobreviver. O que a inversão
> retirou é a premissa: com o motor gerando uma aventura por personagem, não há mais **uma**
> aventura escrita para servir a todos. Ver *A inversão de 07/08/2026* e a *Decisão aberta 7*.
> Nada aqui foi apagado — a decisão pode ser reafirmada, e nesse caso o motor gera as aventuras
> 2..N e *O Lamento* segue sendo a primeira para todo mundo.

Decisão tomada em **06/08/2026**: bárbaro, bardo, clérigo, mago — todos entram na mesma
campanha, e desde 07/08/2026 essa campanha é **Pegāna**, começando por *O Lamento*. **Não há
tela de seleção e não há aventura por classe.** A campanha é a mesma; o que varia é quem a joga.

Três consequências que atravessam o backlog inteiro:

**1. O gancho por classe vira porta de entrada** *(decidido em 06/08/2026)*. A
[US-28](./US-28-aventura-inicial-baseada-na-classe.md) entregou 13 ganchos por locale
(12 classes + `default`) em [initial-adventures.ts](../../../apps/api/prisma/initial-adventures.ts).
Eles **não são apagados nem ficam mortos**: a cena é a mesma — o porão do *Lamento*, a corrente
que arrebenta — para todo mundo, mas **por que aquele personagem está a bordo** muda por classe.
Com Pegāna a pergunta fica mais afiada do que era com a emboscada na estrada: o navio-prisão
pede um **crime ou tragédia**, e os 13 ganchos já são exatamente isso. O ladino subiu a torre de
Corvane atrás da Lágrima de Solane; o bruxo foi pego no arboreto; o bárbaro falhou na prova
diante da tribo. `resolveInitialHook` deixa de decidir *qual aventura* e passa a decidir *como o
personagem chega nela* — e o `hookSeed` deixa de ser uma justificativa de trânsito para ser o
passado que a campanha inteira vai cobrar.
Custo: zero schema novo. É o `hookSeed` que a AV-3 já passa ao `generateOpeningNarration`.
Os campos `primaryQuestTitle`/`primaryQuestDescription` do gancho, esses sim, deixam de ser
usados — a quest primária passa a vir da aventura.

**2. Não existe US de seleção de aventura.** Sem escolha, não há o que exibir. Com sequência
(ver *Horizonte*), o que a interface eventualmente mostra é **progresso**, não catálogo.

**3. Aparece um problema que aventura-por-classe não tinha: dimensionamento.** O AI DM é
single-player — **um** personagem, nível 1, sem ninguém para segurar a linha de frente e sem
clérigo para levantá-lo. Aventura escrita no default da hobby (grupo de 4–5) mata esse
personagem no primeiro encontro, e vale para *todas* as classes, umas mais que outras.

Com a aventura autoral isso deixa de ser **retrofit** e passa a ser **regra de escrita**: a AV-0
escreve os encontros solo desde a primeira linha. A AV-7 sobrevive por dois motivos, menores mas
reais — o combate escrito para nível 1 ainda precisa valer no nível 3 quando **D1** existir, e
uma classe sem cura sofre onde outra passa.

O remédio está na mesma fonte, na seção **Monster Difficulty Dials**: quatro botões
(pontos de vida, número de monstros, dano, número de ataques) para calibrar encontro sem
reescrever statblock. E o documento avisa que o dial de *número de monstros* é o mais forte e o
mais visível ao jogador — mexer nele é decisão de ficção, não só de número. Escrevendo do zero,
esse aviso é de graça: em vez de sumir com quatro dos seis bandidos, escreve-se **dois
carcereiros** e a ficção já explica onde estão os outros.

---

## Horizonte: sequência até o nível 20

Decidido em **06/08/2026**: a primeira aventura é a **1 de N**, e a intenção é levar o
personagem do nível 1 ao 20. Com a troca de 07/08/2026 a meta ganhou **destino escrito**: o arco
de Pegāna já vai do nível 1 à ascensão divina, dividido em quatro atos (1–5, 6–10, 11–15, 16–20).
*O Lamento* é a primeira aventura do Ato 1 — não o ato inteiro. O que este backlog entrega é a
primeira aventura; os atos ficam registrados só para as decisões de hoje não fecharem porta.

**Este backlog não entrega isso, e não deve tentar.** Ele entrega a primeira aventura. O que a
meta do nível 20 muda aqui é pequeno; o que ela exige *fora* daqui é grande, e vale estar
escrito para ninguém descobrir no meio.

### O que já existe e serve

- **`Adventure.order`** e o fechamento da aventura ativa anterior em `createForCharacter`
  ([ADR 002](../../adr/002-memoria-de-sessao.md)) — o sequenciamento **já está pronto**.
  Aventura 2 não precisa de modelo novo.

### O que falta

As três dependências do topo: **D1** (progressão), **D2** (dado de classe acima do nível 1) e
**D3** (conteúdo para as aventuras 2..N). Nenhuma é construída aqui.

Sobre **D3** vale um acréscimo que não cabia na tabela: se o caminho for **(b)** — gerar as
próximas aventuras com as 135 tabelas e os 40 prompts de segredo —, então a seção
*O que o gerador não produz* deixa de ser observação e vira **critério de eval**. Encadeamento
causal entre pistas e subversão de template são exatamente o que separa a aventura 2 gerada de
*O Lamento* escrito à mão, e é o que degrada primeiro.

O caminho **(b)** ganha um insumo que aventura autocontida não daria: os quatro
**relógios de deus** (Mung, Dorozhand, Sirami, Hoodrazai) são estado de campanha que atravessa
aventuras, então a aventura 2 não parte do zero — parte de qual relógio avançou na 1. É a
resposta ao item 3 de *O que o gerador não produz* ("gerador não planeja entre aventuras"):
o planejamento entre aventuras vira dado, não geração. Onde esse estado mora é decisão em
aberto (questão 5).

### O que muda **agora**, porque é barato agora e caro depois

- **AV-1 → GEN-1:** o schema nasce com `id` de aventura e faixa de nível pretendida
  (`levelRange`), mesmo havendo uma aventura só. Duas linhas hoje, migração amanhã.
- **AV-3 → GEN-10:** resolver "a próxima aventura deste personagem" via `Adventure.order`, e
  **não** referenciar *O Lamento* por constante no serviço. Com uma aventura na lista, a função
  devolve sempre a mesma — e continua correta quando houver duas. Com o motor à frente, a
  ressalva vale ainda mais: a lista deixa de ter uma entrada só.
- **AV-7:** os dials calibram contra **o nível do personagem**, não contra a constante 1.
  Assinatura certa desde o começo; o valor é 1 enquanto não houver progressão.

**O que não muda agora:** nada de XP, level-up, features de nível 2+ ou conteúdo adicional
entra neste backlog. Construir progressão antes de a primeira aventura rodar ponta a ponta é
pagar por uma escada antes de saber se o primeiro degrau aguenta.

---

## A fonte de método é JSON pronto

> Desde 07/08/2026 esta seção descreve o que a AV-2 baixa para ter **método, tabelas e
> statblocks** — não conteúdo de aventura. O mundo vem de Dunsany (subseção abaixo) e o texto da
> aventura é autoral.

O material tem distribuição oficial multiformato em `https://github.com/crit-tech/LGMRD`
(CC-BY-4.0, atualizada automaticamente do site do autor). Verificado em **06/08/2026**:

- **`LGMRD.json`** (428 KB, `version` 3.8.0) — 37 seções, 150 parágrafos e **135 tabelas já
  normalizadas**, com a chave do dado por linha:
  ```json
  {"d20": "1", "location": "Tower", "monument": "Sarcophagus", "item": "Coin"}
  {"item_num": 1, "item": "Find an item"}
  ```
- **`5e_Monster_Builder.json`** (164 KB, `version` 3.1.0) — statblocks genéricos por papel e CR.
- **`markdown_separate/`** — 37 arquivos, um por seção. `36-villageofwhitesparrow.md` e
  `37-thenightblade.md` continuam sendo os dois melhores **exemplares de formato** do documento:
  não entram no jogo, servem para a AV-0 ver densidade de segredo e formato de *area aspect*
  escritos por quem inventou o método.
- Campo **`attribution`** no topo do próprio JSON, com a frase de licença verbatim.

**Consequência:** não existe pipeline de ingestão aqui. `sync` é baixar dois arquivos.
O molde da [US-47](./US-47-ingestao-srd-como-dado.md) entra só pela parte de **pinagem e
artefato versionado**, não pela de parser.

### Armadilha: a fonte se move sozinha

O repo tem workflow *nightly* que re-exporta do site diariamente às 00:00 UTC. As versões
publicadas **não batem entre si** (verificado em 06/08/2026):

| Onde | Versão | Data |
|---|---|---|
| `LGMRD.json` no repo | 3.8.0 | — |
| pacote npm `@crit-tech/lgmrd` | **3.5.0** | 2024-05-28 |
| `metadata/updates.json` | — | 2025-03-21 |
| `pushed_at` do repo | — | 2026-05-08 |

**Não usar o npm** — está três *minors* atrás e parado. Pinar o JSON bruto por **commit SHA**,
nunca por `main`. Mesmo princípio da US-47: a página corrente não é seguida às cegas.

### A fonte de mundo é Dunsany, e ela não é JSON

O panteão, a cosmologia e a toponímia de Pegāna vêm de dois livros de Lord Dunsany:

| Livro | Ano | O que dá |
|---|---|---|
| *The Gods of Pegāna* | 1905 | MĀNA-YOOD-SUSHĀĪ, Skarl, os pequenos deuses (Kib, Sish, Mung, Slid, Dorozhand, Hoodrazai, Sirami, Roon…), Trogool, os mil deuses do lar |
| *Time and the Gods* | 1906 | Sequência direta: brigas entre os deuses, o Tempo, a vingança dos homens. É de onde saem eventos e dilemas para as aventuras 2..N |

Texto integral em `sacred-texts.com/neu/dun/gope/` e no Projeto Gutenberg. **Prosa corrida em
texto puro** — sem duas colunas, sem statblock, sem caixa de texto. Registrar isso porque é
exatamente o caso fácil da *questão 2* da [ADR 010](../../adr/010-upload-de-livro-como-lore.md),
que se preocupa com PDF de livro de RPG: o primeiro acervo de lore do projeto pode ser este, e
ele não esbarra no problema de chunking que a ADR deixou em aberto.

**Não há AV para isso neste backlog.** Ingerir Dunsany como lore é trabalho da ADR 010; o que
*O Lamento* precisa cabe no artefato autoral da AV-1. Fica registrado para as duas metas não
serem construídas duas vezes.

### Licença

Duas licenças distintas, e elas não se misturam.

**LGMRD (método, tabelas, statblocks):** CC-BY-4.0 — **a mesma do Open5e**, então cabe no regime que
[NOTICE-open5e.md](../../../scripts/srd/NOTICE-open5e.md) já descreve, sem introduzir uma
segunda licença no repo. Três cuidados:

- A frase de atribuição é **verbatim, não parafraseável** — e vem no campo `attribution`,
  então o NOTICE se **gera**, não se copia à mão.
- A atribuição é **tripla**: Sly Flourish + Monster Builder (Teos Abadía, Scott Fitzgerald
  Gray) + SRD 5.1.
- O documento avisa que **só a vila e esta aventura** saíram sob CC — *o resto de Fantastic
  Adventures não*. Registrar isso no NOTICE impede alguém puxar mais material depois achando
  que é aberto. Continua valendo mesmo agora que essas duas ficaram fora do jogo: elas são
  exemplar de formato, e citar trecho delas num doc ainda é uso da obra sob CC-BY.

**Dunsany (mundo):** domínio público — mas **não na mesma data em todo lugar**, e a diferença
cai dentro do horizonte deste projeto. Aqui a afirmação é aritmética, não parecer jurídico:

- **Estados Unidos:** obra publicada antes de 1929 é domínio público sem ressalva. 1905 e 1906
  passam com folga.
- **Jurisdições de vida + 70 anos, incluindo o Brasil** (Lei 9.610, art. 41 — 70 anos a contar
  de 1º de janeiro do ano seguinte ao da morte): Dunsany morreu em **1957**, o que põe a entrada
  em domínio público em **1º de janeiro de 2028**. Hoje é 07/08/2026. **Ainda faltam ~17 meses.**

A distinção que resolve quase tudo: **nome de deus e conceito mitológico não são expressão
protegida.** Usar MĀNA-YOOD-SUSHĀĪ, Mung, Skarl, Trogool, o Mar de Slid e as Portas de Pegāna
numa aventura autoral é usar o *panteão*, não o texto — e é isso que a AV-0 faz. O que depende
da data é **reproduzir a prosa**: ingerir os dois livros inteiros como acervo de lore (ADR 010)
é cópia da obra, e cai na questão jurídica que a
[ADR 010 §5 questão 3](../../adr/010-upload-de-livro-como-lore.md) já deixou explicitamente
em aberto.

**Consequência prática:** o backlog inteiro roda sem tocar nisso — a AV-0 escreve prosa própria
num panteão que ninguém detém. O corpus de Dunsany como lore recuperável é a parte que espera,
seja pela data, seja pela revisão que a ADR 010 já pediu. Registrado aqui para não ser
descoberto no meio da AV-0.

---

## O que já existe no repo

Três peças encurtam muito a lista:

| Pronto | Onde | Por quê importa |
|---|---|---|
| `WorldEntity.revelado?: boolean` | [character.ts](../../../packages/shared/src/types/character.ts) (US-75) | É *exatamente* o "secret abstract from its place of discovery": verdade do mundo que o Mestre guarda e só revela quando a ficção merecer |
| Semeadura de `entities` na criação | [adventure.service.ts](../../../apps/api/src/adventure/adventure.service.ts) (`extractOpeningEntities`) | O caminho de semear ledger ao criar aventura já roda — falta ser autoral em vez de extraído por LLM |
| `Quest` com `status` + `isPrimary` | [schema.prisma](../../../apps/api/prisma/schema.prisma) | Modelo de múltiplas quests já existe |

## Os três bloqueios

1. **A aventura é derivada da classe.** `createForCharacter` faz
   `resolveInitialHook(config, character.class)` e **rejeita** `initialHookId` que não seja o da
   classe. Com campanha única, esse acoplamento tem de sair do caminho: *O Lamento* não é
   a aventura de nenhuma classe, é a de todas.
2. **Aventura hoje são sete campos de texto.** O alvo da AV-0 é a densidade do exemplar:
   ~7 NPCs, ~11 segredos, ~6 locais com *area aspects*, encontros dimensionados para um
   personagem e ramificação no fecho (quem sai do *Lamento* vivo, e quem sabe o quê ao sair).
   Não há schema para isso.
3. **Quest nasce e nunca avança.** Só a primária é criada, e `advanceQuest` **não existe** —
   ver [contratos-de-api.md](../02-design/contratos-de-api.md), onde ela foi apagada como
   roadmap morto pela [US-89](./US-89-gate-de-codigo-morto-com-knip.md).

---

## Tarefas

Caminho crítico marcado ✱.

### Fundação

**✱ AV-0 — escrever *O Lamento***
A tarefa que a troca de 07/08/2026 criou, e a mais longa do backlog. Não é código: é a aventura
escrita, pelos **Eight Steps**, com `36-villageofwhitesparrow.md` / `37-thenightblade.md` ao lado
como referência de densidade — não de conteúdo.

Entrega, com os números do exemplar como alvo e não como cota:

| Peça | Alvo | Observação |
|---|---|---|
| *Strong start* | 1 cena | A corrente que arrebenta no porão. Mesma para as 12 classes; o `hookSeed` explica o resto |
| NPCs | ~7 | Nome, desejo, método. Pelo menos um é um deus do lar sem domínio, disfarçado |
| Segredos e pistas | ~11 | Escritos com os **40 prompts** do LGMRD, não inventados soltos |
| Locais fantásticos | ~6 | 3 *aspects* cada |
| Encontros | 4–5 | **Solo, nível 1–3, desde a escrita** — não dimensionados depois |
| Fecho ramificado | 2–3 saídas | E o que cada uma deixa gravado para a aventura 2 |

Três critérios que não são contáveis e são o que separa isto de uma premissa genérica — os três
de *O que o gerador não produz*, com os equivalentes já escritos naquela seção: **cadeia causal**
entre pelo menos três pistas, **subversão do template** no meio da aventura, e **uma semente
plantada e não colhida**.

Escrever em **pt-BR primeiro**, en-US depois, no arranjo dos ganchos da US-28: mesma cena, prosa
escrita nas duas línguas, não traduzida ([initial-adventures.ts:16-19](../../../apps/api/prisma/initial-adventures.ts)).
Fazer as duas na AV-0 é mais barato que reabrir o texto na AV-9 — e é o que **desmonta** a
tarefa que era a mais cara da lista.
Depende de: nada — pode começar hoje, em paralelo com tudo. Bloqueia: GEN-1 (o teste da locação e
dos dois segredos), GEN-8.

**ADR-AV — aventura autoral como dado** — *absorvida pela GEN-0 em 07/08/2026*
Decidia a forma antes de existir schema: aventura escrita à mão é um `initialAdventures`
estendido, ou entidade própria? Recomendação registrada: **entidade própria**. `initialAdventures`
é *por classe* por definição da US-28; forçar a aventura autoral lá dentro distorce os dois.
É a mesma pergunta que a **GEN-0** responde, e duas ADRs sobre a mesma decisão é drift. A
recomendação atravessa intacta; o que muda é quem a escreve.

**AV-1 — `AuthoredAdventureSchema`** → **GEN-1**. Texto no
[backlog do motor](./backlog-motor-de-geracao-de-aventuras.md).
O que este backlog cobrava dela e continua valendo: a forma sai dos **Eight Steps**, não de uma
aventura específica; e a AV-0 entrega **uma locação e dois segredos primeiro**, contra os quais a
GEN-1 valida em vez de esperar a aventura fechar.

**AV-2 — `sync` pinado + NOTICE gerado** → **GEN-2**. Já era independente deste backlog
(*"pode ir em paralelo"*), então a mudança é só de endereço.

### Destravar o modelo

**AV-3 — a aventura deixa de ser derivada da classe** → **GEN-10**.
O critério de aceite **inverteu** com a inversão de 07/08: era *"personagens de classes diferentes
recebem a mesma campanha, com aberturas diferentes"*; passa a ser *"backgrounds diferentes recebem
aventuras diferentes"*. O resto atravessa intacto — o gancho da classe continua vivo como porta de
entrada, e `hookSeed` continua indo ao `generateOpeningNarration`, senão a primeira cena vira a
única que ignora quem é o personagem.

**AV-4 — semear entidades e segredos** → **GEN-8**. O `map()` é o mesmo e a
[US-75](./US-75-dimensao-de-proveniencia-no-ledger.md) continua sendo aproveitada inteira; o que
muda é a fonte — artefato gerado em vez de autoral. Continua sendo **a tarefa que paga a conta**:
~11 pistas soltas dão ao Mestre o que fazer quando o jogador anda, o defeito medido na
[US-71](./US-71-simplificar-localizacao-do-personagem.md) (9 de 24 viagens sem `updateScene`).
Quando *O Lamento* existir, ele entra pelo mesmo caminho — é o ponto de haver um schema só.

**AV-5 — quests em fases + tool `advanceQuest`**
*O Lamento* tem ~6 fases: a corrente arrebenta → o porão → o rombo aberto por dentro → o convés
e os carcereiros → quem mais a bordo já acordou → o fecho ramificado. Sem avanço registrado o
Mestre não sabe onde está e re-oferece o que já aconteceu. As fases saem da AV-0, então o número
exato é dela — o que esta tarefa fixa é o mecanismo.
Gatilho concreto disponível: a seção **Lazy Solo 5e** do próprio documento é uma máquina de
estados de ritmo (rola ao entrar em câmara; resultados 4–7 avançam a quest; no 4º avanço vem o
desafio final). Determinística, roda no servidor, o modelo só narra o que ela decidiu.
Cuidado: vira a 7ª tool, e a `description` vai ao modelo todo turno.
Depende de: GEN-10 (era AV-3).

### Conteúdo

**AV-6 — statblocks genéricos por papel e CR** → **GEN-9**.
O que continua sendo trabalho **deste** backlog: os três papéis (Minion CR 1/8, Soldier CR 1/2,
Brute CR 2) viram **restrição de escrita** da AV-0. Os inimigos de *O Lamento* mapeiam em 3–4
deles — carcereiro é Soldier, prisioneiro esfomeado é Minion, o que já acordou o fragmento é
Brute —, e o que precisar de mecânica própria (uma criatura do Rim, um deus do lar irritado)
carrega a própria nota no texto, que é o caminho da AV-8.
**Não precisa ingerir monstro do SRD**, o que evita um pipeline inteiro.
Informa: AV-0.

**AV-7 — dials de dificuldade por encontro**
Gravar os quatro **Monster Difficulty Dials** da fonte (pontos de vida, número de monstros,
dano, número de ataques) no artefato da aventura **por encontro** — não improvisados pelo Mestre
a cada turno, que é como se perde a consistência entre sessões.

A AV-0 escreve os encontros solo desde a primeira linha, então o dimensionamento **não** é
retrofit e esta tarefa fica fora do corte mínimo. Ela existe por dois problemas que escrever bem
não resolve:

- o encontro calibrado para o nível 1 precisa continuar valendo no nível 3 quando **D1** existir;
- classe sem cura sofre onde outra atravessa, e é o dial de PV que absorve isso.

Aviso da fonte que vale mesmo escrevendo do zero: o dial de *número de monstros* é o mais forte e
o mais visível ao jogador — mexer nele é decisão de ficção.
Calibrar contra **o nível do personagem**, não contra a constante 1 — assinatura certa desde o
começo, valor 1 enquanto **D1** não existir.
Depende de: GEN-9 (era AV-6).

**AV-8 — regras locais da aventura**
O custo de usar o fragmento (dor, marca permanente), o ferro do casco que esconde o portador de
Mung, a corrente que só enferruja onde tocou pele. Não existe conceito de "regra que vale só
nesta aventura". Caminho barato: `nota` da `WorldEntity` do local — awareness, sem motor.
Escrever regra local é grátis para quem escreve e caro para o Mestre, que recebe cada uma no
prompt. **Teto na AV-0: poucas, e cada uma tem de mudar uma decisão do jogador.**
Depende de: AV-0, GEN-8 (era AV-4).

**AV-9 — o en-US de *O Lamento***
Escreve-se em **pt-BR nativo** e o en-US é a **mesma cena escrita em inglês**, não tradução
literal — então o pt-BR não vira overlay nem dívida viva como no SRD
([ADR 005](../../adr/005-locale-como-dimensao.md)). É o arranjo dos 13 ganchos da US-28, e o
comentário que o descreve já está no repo
([initial-adventures.ts:16-19](../../../apps/api/prisma/initial-adventures.ts)): o que atravessa
sem mudar são `id`, chaves e nomes próprios; o texto é reescrito.

**Esta tarefa quase desaparece se a AV-0 entregar os dois locales de uma vez** — que é a
recomendação, porque reabrir prosa fria custa mais que escrever as duas versões com a cena na
cabeça. O que sobra aqui é o encaixe no `Record<Locale, …>` e o teste de paridade de chaves.
Continua sendo trabalho de escrita, e continua fácil de subestimar.
Depende de: AV-0, AV-8.

### Fechar

**AV-10 — eval e regressão**
Caso de fidelidade no molde da [US-49](./US-49-eval-fidelidade-de-regra.md) numa mesa a bordo do
*Lamento*: o Mestre não pode revelar segredo com `revelado: false` antes da ficção merecer,
nem inventar NPC quando há ~7 escritos. Aproveita a rubrica da
[US-36](./US-36-eval-de-qualidade-da-narracao.md).
Cuidado próprio de aventura autoral: a mantenedora escreveu a aventura **e** escreve a eval.
Ancorar os asserts no **artefato** (este `secretId` continua oculto, este NPC existe) e não na
impressão de quem escreveu — que é o que a US-49 já faz para regra.
Depende de: GEN-8 (era AV-4), AV-5. **Sobrepõe-se à GEN-11**, que roda antes com a mesma rubrica
contra saída gerada: o que esta acrescenta é o caso da aventura *escrita*, com o cuidado próprio
de a mantenedora ter escrito o texto **e** a eval.
A campanha única apertava este caso — o mesmo texto rodando para 12 classes fazia do Mestre
narrando bardo como guerreiro o modo padrão de falhar. Com a inversão isso vira condicional:
vale se a campanha única sobreviver (*Decisão aberta 7*).

---

## Corte mínimo

Para **jogar** *O Lamento*, não para shipá-lo: **AV-0**, mais o corte mínimo do
[motor](./backlog-motor-de-geracao-de-aventuras.md), que entrega o schema, o `sync`, os
statblocks e a semeadura do ledger. Sem quest em fases, sem dials, sem regras locais, sem en-US,
sem eval.

**Encolheu de seis stories mais a escrita para a escrita e nada mais** — não porque ficou menor,
mas porque cinco daquelas seis mudaram de documento na inversão de 07/08/2026. O que este backlog
tem de próprio no corte é **uma tarefa, e é a mais longa**: escrever a aventura, nos dois locales,
contra um schema que a GEN-1 já terá fixado.

Duas trocas no mesmo dia, e elas não são a mesma coisa: **Pegāna** foi feita porque a meta do
nível 20 não cabia na licença do material anterior; **a inversão** foi feita porque o caminho
crítico daqui é escrita e o do motor é código.

> **E o corte não roda na fase 1.** Com o adiamento, o que resta aqui não é "o próximo corte" — é
> o corte de quando o multiplayer existir. Ver *Adiado para a fase 4*.

A AV-7 **não** está no corte: ela só seria obrigatória se a aventura viesse escrita para grupo,
e a AV-0 escreve solo.

## Decisões tomadas

- **06/08/2026 — todas as classes na mesma campanha.** Sem seleção de aventura. Consequências
  em *Uma campanha só para todas as classes*.
- **06/08/2026 — os ganchos da US-28 viram porta de entrada.** Opção (c): mesma cena para todos,
  motivo diferente por classe. Detalhe na consequência 1 e na AV-3.
- **06/08/2026 — a sequência vai até o nível 20.** A primeira aventura é a 1 de N. O que isso
  muda agora e o que exige fora daqui está em *Horizonte*.
- **07/08/2026 — Pegāna no lugar do Night Blade.** Motivos, custos e o que não mudou em
  *Por que Pegāna no lugar do Night Blade*. Tomada com zero código escrito.
- **07/08/2026 — o LGMRD fica.** Sai só a camada de conteúdo pronto; método, 135 tabelas e
  Monster Builder continuam sendo a fonte, e a AV-2 não muda. Descartá-los custaria um pipeline
  de monstro do SRD que a AV-6 evita.
- **07/08/2026 — o escopo é *O Lamento*, não o Ato 1.** Níveis 1–3, uma aventura. O Ato 1 de
  Pegāna vai até o nível 5 e não cabe numa primeira entrega.
- **07/08/2026 — o motor de geração roda primeiro.** Cinco tarefas mudam de dono, a ADR-AV é
  absorvida pela GEN-0 e o corte mínimo daqui encolhe para a AV-0. Motivos e custos em
  *A inversão de 07/08/2026*.
- **07/08/2026 — este backlog é adiado para a fase 4 (multiplayer).** Arco longo com atos é
  formato de grupo. Absorve a inversão e fecha a decisão aberta 7. Ver *Adiado para a fase 4*.

## Decisões abertas

1. **A aventura autoral é dado de um sistema ou entidade reusável entre sistemas?** *O Lamento*
   vai ter CD e CR de 5e, mas a estrutura (segredos, locais, NPCs) é agnóstica.
   Decidir na **GEN-0** (era a ADR-AV), porque muda o schema da GEN-1 — e agora é decisão de
   quem chega primeiro. **A sequência até o nível 20 pesa aqui:**
   uma lista de aventuras presa a um `System` não atravessa para outro sistema depois.
   Pegāna aperta a pergunta: o mundo é de Dunsany e não tem nada de 5e, então a tentação de
   pendurar a campanha num `System` chamado "D&D 5e" fica ainda mais errada do que já era.
2. **`Start` fixo × abertura gerada.** Ver GEN-10 (era AV-3). Recomendação já registrada lá;
   confirmar.
3. **Progressão: XP, marco, ou por aventura concluída?** Não é deste backlog, mas é a primeira
   decisão do backlog seguinte, e a mais barata das três é "sobe de nível ao fechar aventura" —
   que casa com `Adventure.order` e não exige rastrear XP em lugar nenhum. Registrada aqui só
   para não ser redescoberta.
4. ~~**Os geradores aleatórios entram neste backlog?**~~ **Respondida em 07/08/2026: não —
   entram no backlog próprio, e ele roda antes deste.** As 135 tabelas chegam de graça no JSON
   que a GEN-2 baixa; *usá-las* é o
   [motor de geração](./backlog-motor-de-geracao-de-aventuras.md). O registro original já dizia
   que, com a meta do nível 20, esse era "o caminho provável", porque escrever 19 níveis à mão
   não escala. A inversão só antecipou o dia.
5. **Onde mora o estado de campanha entre aventuras?** *(nova em 07/08/2026)* Pegāna tem quatro
   relógios de deus (Mung, Dorozhand, Sirami, Hoodrazai) que avançam numa aventura e precisam
   valer na seguinte — é o que dá à aventura 2 um ponto de partida em vez do zero (*Horizonte*).
   Candidatos, do mais barato ao mais
   caro: **(a)** `WorldEntity` no ledger, com a US-75 inteira de graça e nenhuma migração;
   **(b)** coluna nova; **(c)** a coluna `arc` que a
   [US-112](./US-112-arco-de-beats-do-que-muda.md) propõe — que é sobre o arco *de dentro* de
   uma aventura, então provavelmente não é o mesmo eixo. **Não decidir agora:** o corte mínimo
   é uma aventura só, e relógio que nunca atravessa fronteira não precisa de casa própria.
   Vira decisão no dia em que a aventura 2 for escrita.
6. **O acervo de Dunsany como lore entra, e quando?** Depende da ADR 010 e da data de domínio
   público fora dos EUA (*Licença*). O backlog roda sem ele; a pergunta é se vale esperar
   2028 para o Mestre poder citar o texto, ou se o panteão na aventura autoral já basta.
7. ~~**A campanha única de 06/08 sobrevive à inversão?**~~ *(aberta e fechada em 07/08/2026)*
   Ela foi decidida quando havia **uma** aventura escrita para servir a todas as classes, e as
   opções eram **(a)** o motor gera só as 2..N, ou **(b)** gera desde a primeira.
   **Resolvida por consequência pelo adiamento para a fase 4:** vale a **(b)** — na fase 1 não há
   campanha autoral, então o motor gera tudo e não há campanha única a preservar. A pergunta
   **volta na fase 4**, quando houver grupo, que é a única situação em que "todas as classes na
   mesma campanha" descreve uma mesa real. Ver *Adiado para a fase 4*.

## Referências no código

- [adventure.service.ts](../../../apps/api/src/adventure/adventure.service.ts) — `createForCharacter`: onde o acoplamento com a classe vive e de onde ele sai na GEN-10 (era AV-3).
- [character.ts](../../../packages/shared/src/types/character.ts) — `WorldEntity`, com os dois eixos (`sabido`, `revelado`) da US-75.
- [initial-adventures.ts](../../../apps/api/prisma/initial-adventures.ts) — os 13 ganchos por classe (× 2 locales). Com Pegāna eles não são desempregados: viram o crime ou a tragédia que pôs o personagem a bordo do *Lamento* (consequência 1). Os comentários de `:16-19` são o molde bilíngue que a AV-0 e a AV-9 seguem. **Não** deve virar o depósito da aventura autoral; destino na decisão 1.
- [ADR 010](../../adr/010-upload-de-livro-como-lore.md) — livro como lore recuperável. Dunsany é o candidato natural a primeiro acervo, e é texto puro, mas depende da data da *Licença* e da questão jurídica que a própria ADR deixou aberta.
- [contratos-de-api.md](../02-design/contratos-de-api.md) — as 6 tools existentes; `advanceQuest` da AV-5 é a 7ª.
- [scripts/srd/sync.mjs](../../../scripts/srd/sync.mjs) — molde de pinagem e artefato versionado. O parser da US-47 **não** é reusado: aqui não há parser.
- [backlog-motor-de-geracao-de-aventuras.md](./backlog-motor-de-geracao-de-aventuras.md) — o produtor A do mesmo schema, e o dono de GEN-1, GEN-2, GEN-8, GEN-9 e GEN-10 desde 07/08/2026. Roda antes deste.
