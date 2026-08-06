# Backlog — Aventuras autorais a partir do Lazy GM's Resource Document

**Objetivo:** jogar *The Night Blade* na vila de Whitesparrow dentro do AI DM.
**Decisão de produto:** **todas as classes seguem para a mesma campanha**, e *The Night Blade* é
a **primeira de uma sequência que vai até o nível 20**. Não há seleção de aventura — há ordem.
Ver *Uma campanha só para todas as classes* e *Horizonte: sequência até o nível 20*.
**Fonte:** The Lazy GM's Resource Document (Michael E. Shea, SlyFlourish.com), CC-BY-4.0.
**Criado em:** 2026-08-06
**Status:** 📋 Proposta — nenhuma tarefa iniciada

Este documento **não é uma user story**. É a sequência de tarefas até a meta acima, com
dependências e o que já está pronto. Cada item vira um `US-*.md` próprio quando entrar em
execução — escrever os onze agora seria planejar em cima de decisões que a **ADR-AV** ainda
não tomou.

> **Rótulos, não números de story.** `AV-1`…`AV-10` e `ADR-AV` são identificadores **internos
> deste documento**, para as dependências se referenciarem. O número real (`US-NNN`, `ADR NNN`)
> é atribuído **no dia em que a story for escrita**, com o próximo livre da época — outras
> stories entram no repo antes destas. Ao criar o arquivo, substitua o rótulo aqui pelo número
> atribuído; enquanto isso, `AV-N` não corresponde a nenhuma story existente.

---

## Depende de

Três subsistemas que **não existem no repo** (verificado em 06/08/2026) e sem os quais este
backlog não fecha:

| #      | Dependência                         | Estado hoje                                                                                                                                                                              | Onde dói                                                                                                                                                                                                                                            |
| ------ | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **D1** | **Progressão de nível**             | `Character.level` é `Int @default(1)` em [schema.prisma](../../../apps/api/prisma/schema.prisma) e **nada no repo o incrementa**. Sem XP, sem marco, sem level-up — o campo é decorativo | Sem ela não há aventura 2, e AV-7 calibra contra um nível que nunca muda                                                                                                                                                                            |
| **D2** | **Dado de classe acima do nível 1** | No artefato do SRD, `classFeatures` é lista plana **sem campo `level`**; `classSpells` idem. É a fronteira que a [US-41](./US-41-features-traits-de-classe.md) fixou                     | Subir de nível sem isto incrementa um número que não muda nada na ficha nem no prompt. Exige voltar ao pipeline da [US-47](./US-47-ingestao-srd-como-dado.md) e re-ingerir com progressão, não somar um campo                                       |
| **D3** | **Conteúdo para as aventuras 2..N** | Do livro do Sly Flourish, **só a vila e o *Night Blade* saíram sob CC** — o próprio documento diz que o resto de *Fantastic Adventures* não está sob a licença                           | Whitesparrow é o hub "for the adventures in this book", mas essas aventuras não vêm junto. Saem de: **(a)** autorais, **(b)** geradas pelas 135 tabelas + os 40 prompts de segredo, **(c)** outra fonte aberta. **(b)** é o que o material favorece |

Cada uma é backlog próprio — nenhuma é construída aqui. **D1** e **D2** são pré-requisito de
qualquer aventura além da primeira; **D3** é trabalho contínuo.

> **Ressalva de sequenciamento.** O *Night Blade* é aventura de nível 1: o **corte mínimo roda
> sem nenhuma das três**. Elas travam a *sequência*, não a primeira aventura. Tratá-las como
> bloqueio duro do backlog inteiro adia a única entrega que responde se o material vale o
> esforço. Recomendação: manter as três registradas como dependência da **meta** (nível 20) e
> deixar o corte mínimo correr antes delas.

---

## Por que este material

O documento tem quatro camadas distintas, e só duas interessam agora:

| Camada | Exemplo | Destino |
|---|---|---|
| **Método de prep** | Eight Steps, Secrets and Clues, Fantastic Locations | Modelo de dado da aventura |
| **Geradores aleatórios** | `1d20 Quests`, `1d20 Chambers`, NPC Generator, 100 Monument Structures | Gerador determinístico no Game Server |
| **Conteúdo pronto** | Whitesparrow + *The Night Blade* | **A meta deste backlog** |
| **Ajuste 5e** | CR, encounter benchmark, monster templates | Fora — `config` é *awareness*, não motor |

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

---

## Uma campanha só para todas as classes

Decisão tomada em **06/08/2026**: bárbaro, bardo, clérigo, mago — todos entram em *The Night
Blade*. **Não há tela de seleção e não há aventura por classe.** A campanha é a mesma; o que
varia é quem a joga.

Três consequências que atravessam o backlog inteiro:

**1. O gancho por classe vira porta de entrada** *(decidido em 06/08/2026)*. A
[US-28](./US-28-aventura-inicial-baseada-na-classe.md) entregou 13 ganchos por locale
(12 classes + `default`) em [initial-adventures.ts](../../../apps/api/prisma/initial-adventures.ts).
Eles **não são apagados nem ficam mortos**: a cena é a mesma emboscada na estrada para todo
mundo, mas **por que** o personagem está naquela estrada muda por classe — o clérigo foi
mandado, o ladino fugia de alguém, o bárbaro escoltava. `resolveInitialHook` deixa de decidir
*qual aventura* e passa a decidir *como o personagem chega nela*.
Custo: zero schema novo. É o `hookSeed` que a AV-3 já passa ao `generateOpeningNarration`.
Os campos `primaryQuestTitle`/`primaryQuestDescription` do gancho, esses sim, deixam de ser
usados — a quest primária passa a vir da aventura.

**2. Não existe US de seleção de aventura.** Sem escolha, não há o que exibir. Com sequência
(ver *Horizonte*), o que a interface eventualmente mostra é **progresso**, não catálogo.

**3. Aparece um problema que aventura-por-classe não tinha: dimensionamento.** *The Night Blade*
foi escrita para um **grupo** — `Monsters: Bandits (6), shambling mound, guards (2), stirges (10),
thugs (2), swarm of rats, bandit captain`. O AI DM é single-player: **um** personagem de nível 1.
Seis bandidos na cena de abertura matam esse personagem. Isso não é detalhe de balanceamento —
é a diferença entre a campanha funcionar e não funcionar, e vale para *todas* as classes, uma
mais que a outra. Vira a AV-7.

O remédio está na mesma fonte, na seção **Monster Difficulty Dials**: quatro botões
(pontos de vida, número de monstros, dano, número de ataques) para calibrar encontro sem
reescrever statblock. E o documento avisa que o dial de *número de monstros* é o mais forte e o
mais visível ao jogador — mexer nele é decisão de ficção, não só de número.

---

## Horizonte: sequência até o nível 20

Decidido em **06/08/2026**: *The Night Blade* é a **aventura 1 de N**, e a intenção é levar o
personagem do nível 1 ao 20.

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
um *Night Blade*, e é o que degrada primeiro.

### O que muda **agora**, porque é barato agora e caro depois

- **AV-1:** o schema nasce com `id` de aventura e faixa de nível pretendida
  (`levelRange`), mesmo havendo uma aventura só. Duas linhas hoje, migração amanhã.
- **AV-3:** resolver "a próxima aventura deste personagem" via `Adventure.order`, e **não**
  referenciar *Night Blade* por constante no serviço. Com uma aventura na lista, a função
  devolve sempre a mesma — e continua correta quando houver duas.
- **AV-7:** os dials calibram contra **o nível do personagem**, não contra a constante 1.
  Assinatura certa desde o começo; o valor é 1 enquanto não houver progressão.

**O que não muda agora:** nada de XP, level-up, features de nível 2+ ou conteúdo adicional
entra neste backlog. Construir progressão antes de a primeira aventura rodar ponta a ponta é
pagar por uma escada antes de saber se o primeiro degrau aguenta.

---

## A fonte é JSON pronto

O material tem distribuição oficial multiformato em `https://github.com/crit-tech/LGMRD`
(CC-BY-4.0, atualizada automaticamente do site do autor). Verificado em **06/08/2026**:

- **`LGMRD.json`** (428 KB, `version` 3.8.0) — 37 seções, 150 parágrafos e **135 tabelas já
  normalizadas**, com a chave do dado por linha:
  ```json
  {"d20": "1", "location": "Tower", "monument": "Sarcophagus", "item": "Coin"}
  {"item_num": 1, "item": "Find an item"}
  ```
- **`5e_Monster_Builder.json`** (164 KB, `version` 3.1.0) — statblocks genéricos por papel e CR.
- **`markdown_separate/`** — 37 arquivos, um por seção (`36-villageofwhitesparrow.md`,
  `37-thenightblade.md`), caso se queira só as duas.
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

### Licença

CC-BY-4.0 — **a mesma do Open5e**, então cabe no regime que
[NOTICE-open5e.md](../../../scripts/srd/NOTICE-open5e.md) já descreve, sem introduzir uma
segunda licença no repo. Três cuidados:

- A frase de atribuição é **verbatim, não parafraseável** — e vem no campo `attribution`,
  então o NOTICE se **gera**, não se copia à mão.
- A atribuição é **tripla**: Sly Flourish + Monster Builder (Teos Abadía, Scott Fitzgerald
  Gray) + SRD 5.1.
- O documento avisa que **só a vila e esta aventura** saíram sob CC — *o resto de Fantastic
  Adventures não*. Registrar isso no NOTICE impede alguém puxar mais material depois achando
  que é aberto.

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
   classe. Com campanha única, esse acoplamento tem de sair do caminho: *The Night Blade* não é
   a aventura de nenhuma classe, é a de todas.
2. **Aventura hoje são sete campos de texto.** *Night Blade* tem 7 NPCs, 11 segredos, 7 locais
   com *area aspects*, ~28 inimigos em 5 encontros e ramificação (Ralavaz vive / morre / é
   julgado). Não há schema para isso.
3. **Quest nasce e nunca avança.** Só a primária é criada, e `advanceQuest` **não existe** —
   ver [contratos-de-api.md](../02-design/contratos-de-api.md), onde ela foi apagada como
   roadmap morto pela [US-89](./US-89-gate-de-codigo-morto-com-knip.md).

---

## Tarefas

Caminho crítico marcado ✱.

### Fundação

**✱ ADR-AV — aventura autoral como dado**
Decide a forma antes de existir schema: aventura escrita à mão é um `initialAdventures`
estendido, ou entidade própria? Recomendação: **entidade própria**. `initialAdventures` é *por
classe* por definição da US-28; forçar Whitesparrow lá dentro distorce os dois.
Depende de: nada. Bloqueia: AV-1.

**✱ AV-1 — `AuthoredAdventureSchema` em `@ai-dm/shared`**
Zod para o que a aventura realmente tem: `id`, `levelRange`, `summary`, `npcs[]`, `secrets[]`,
`locations[{title, aspects[], boxedText, description, occupants[]}]`, `start`, `conclusion`,
`expansion`. Sem migração — reusa `Adventure.entities` (`Json`) e `Quest`. Teste: o *Night
Blade* inteiro passa em `parse()`.
`id` e `levelRange` entram **apesar de haver uma aventura só** — ver *Horizonte*.
Depende de: ADR-AV.

**AV-2 — `sync` pinado + NOTICE gerado**
Baixa `LGMRD.json` e `5e_Monster_Builder.json` por commit SHA para `scripts/lazygm/`, e gera
`NOTICE-lazygm.md` a partir do campo `attribution`. Artefato versionado, escrita determinística
(idempotente byte-a-byte), como na US-47. **O NOTICE entra no mesmo commit que o primeiro dado
derivado.**
Depende de: nada (pode ir em paralelo com AV-1).

### Destravar o modelo

**✱ AV-3 — campanha única no lugar do gancho por classe**
`createForCharacter` deixa de resolver a aventura pela classe e passa a resolver **a próxima
aventura do personagem** por `Adventure.order` — que com uma aventura na lista devolve sempre o
*Night Blade*, e continua correta quando houver a segunda. **Não** referenciar a aventura por
constante no serviço, e **não** entra `authoredAdventureId` no DTO: não há o que escolher, e um
parâmetro com um valor possível é configuração falsa.
O gancho da classe continua vivo como **porta de entrada**: o `Start` da aventura é o mesmo
texto para as 12 classes, e o `hookSeed` do gancho é o que explica por que *aquele* personagem
está naquela estrada. Ambos vão ao `generateOpeningNarration` — senão a primeira cena vira a
única que ignora quem é o personagem, e com campanha compartilhada seria idêntica para todos.
Critério que não pode faltar: personagens de classes diferentes recebem a **mesma** campanha,
com aberturas **diferentes**.
Depende de: AV-1.

**✱ AV-4 — semear entidades e segredos autorais**
Os 11 segredos entram como `WorldEntity` com `revelado: false`, `sabido: 'publico'`; os 7 NPCs,
com `revelado: true`. Aproveita a [US-75](./US-75-dimensao-de-proveniencia-no-ledger.md)
inteira — o Mestre já sabe não revelar e já reinjeta sem comprimir.
**É a tarefa que paga a conta:** 11 pistas soltas dão ao Mestre o que fazer quando o jogador
anda, que é o defeito medido na
[US-71](./US-71-simplificar-localizacao-do-personagem.md) (9 de 24 viagens sem `updateScene`).
Barata porque no JSON as pistas **já são tabela** — vira um `map()`.
Depende de: AV-1, AV-2.

**AV-5 — quests em fases + tool `advanceQuest`**
*Night Blade* tem 6 fases: emboscada → investigar na vila → contratada pela xerife → travessia
dos Tangles → torre → escolha final. Sem avanço registrado o Mestre não sabe onde está e
re-oferece o que já aconteceu.
Gatilho concreto disponível: a seção **Lazy Solo 5e** do próprio documento é uma máquina de
estados de ritmo (rola ao entrar em câmara; resultados 4–7 avançam a quest; no 4º avanço vem o
desafio final). Determinística, roda no servidor, o modelo só narra o que ela decidiu.
Cuidado: vira a 7ª tool, e a `description` vai ao modelo todo turno.
Depende de: AV-3.

### Conteúdo

**AV-6 — statblocks genéricos por papel e CR**
`5e_Monster_Builder.json` traz statblocks por função, não bestiário nominal:

| Statblock | CR | Cobre (texto da fonte) |
|---|---|---|
| Minion | 1/8 | *"ravenous rats, weak skeletons, shifty bandits, low-ranking cultists"* |
| Soldier | 1/2 | *"seasoned guards, trained soldiers, powerful bandits"* |
| Brute | 2 | veteranos, guarda-costas, humanoides poderosos |

Os ~28 inimigos do *Night Blade* mapeiam em 3–4 desses. **Não precisa ingerir monstro do SRD** —
o que evita um pipeline inteiro. Não coberto: stirge e shambling mound têm mecânica própria, mas
o texto da aventura já dá o que importa (o stirge do Gardren: 10 PV, Furtividade +5).
Awareness apenas — o Mestre já tem `rollDice` e `updateCharacterHp`.
Depende de: AV-2.

**✱ AV-7 — dimensionar os encontros para um personagem**
*The Night Blade* foi escrita para grupo; o AI DM roda solo. Seis bandidos na abertura, dez
stirges no andar de cima, um bandit captain com quatro capangas na sala do trono — contra **um**
personagem de nível 1. Sem isto a campanha única é intransitável, e o jogador morre no primeiro
encontro seja qual for a classe.
Usar os quatro **Monster Difficulty Dials** da própria fonte (pontos de vida, número de
monstros, dano, número de ataques), gravados no artefato da aventura **por encontro** — não
improvisados pelo Mestre a cada turno, que é como se perde a consistência entre sessões.
O dial de *número de monstros* é o mais forte e o mais visível ao jogador: reduzir 6 bandidos
para 2 precisa de ficção que explique (os outros quatro estão adiante na estrada), não de
sumiço silencioso.
Calibrar contra **o nível do personagem**, não contra a constante 1 — assinatura certa desde o
começo, valor 1 enquanto **D1** não existir.
Depende de: AV-6. **Está no corte mínimo** — sem ela não há o que jogar.

**AV-8 — regras locais da aventura**
Tangleweed (CD 13 CON, 2d6 veneno, urina nas botas anula), gargoyle falante, Nightculler
(+1, lança *darkness*). Não existe conceito de "regra que vale só nesta aventura". Caminho
barato: `nota` da `WorldEntity` do local — awareness, sem motor.
Depende de: AV-4.

**AV-9 — overlay pt-BR**
Aqui o JSON não ajuda em **nada**: a fonte é EN-only, então o pt-BR volta a ser overlay autoral,
dívida viva, como no SRD ([ADR 005](../../adr/005-locale-como-dimensao.md)). São ~15 mil
palavras de prosa narrativa, e prosa de aventura mal traduzida é pior que ausente.
**É a tarefa mais cara da lista e a mais fácil de subestimar.**
Depende de: AV-4, AV-8.

### Fechar

**AV-10 — eval e regressão**
Caso de fidelidade no molde da [US-49](./US-49-eval-fidelidade-de-regra.md) numa mesa
Whitesparrow: o Mestre não pode revelar segredo com `revelado: false` antes da ficção merecer,
nem inventar NPC quando há 7 escritos. Aproveita a rubrica da
[US-36](./US-36-eval-de-qualidade-da-narracao.md).
Depende de: AV-4, AV-5. A campanha única aperta este caso: o mesmo texto roda para 12
classes, então o Mestre narrando bardo como guerreiro deixa de ser exceção e vira o modo
padrão de falhar.

---

## Corte mínimo

Para **jogar** o *Night Blade*, não para shipá-lo: **ADR-AV + AV-1 + AV-2 + AV-3 +
AV-4 + AV-6 + AV-7** — seis stories. Sem quest em fases, sem regras locais, sem pt-BR,
sem eval. Roda ponta a ponta e responde se o material vale o resto.

A AV-7 entrou no corte por causa da campanha única: quando existia uma aventura por classe,
encontro grande era problema de uma aventura só; agora é o único caminho que existe, e ele
mata o personagem no primeiro encontro.

## Decisões tomadas

- **06/08/2026 — todas as classes na mesma campanha.** Sem seleção de aventura. Consequências
  em *Uma campanha só para todas as classes*.
- **06/08/2026 — os ganchos da US-28 viram porta de entrada.** Opção (c): mesma cena para todos,
  motivo diferente por classe. Detalhe na consequência 1 e na AV-3.
- **06/08/2026 — a sequência vai até o nível 20.** *Night Blade* é a aventura 1 de N. O que isso
  muda agora e o que exige fora daqui está em *Horizonte*.

## Decisões abertas

1. **A aventura autoral é dado de um sistema ou entidade reusável entre sistemas?** O texto do
   *Night Blade* tem CD e CR de 5e, mas a estrutura (segredos, locais, NPCs) é agnóstica.
   Decidir na ADR-AV, porque muda o schema da AV-1. **A sequência até o nível 20 pesa aqui:**
   uma lista de aventuras presa a um `System` não atravessa para outro sistema depois.
2. **`Start` fixo × abertura gerada.** Ver AV-3. Recomendação já registrada lá; confirmar.
3. **Progressão: XP, marco, ou por aventura concluída?** Não é deste backlog, mas é a primeira
   decisão do backlog seguinte, e a mais barata das três é "sobe de nível ao fechar aventura" —
   que casa com `Adventure.order` e não exige rastrear XP em lugar nenhum. Registrada aqui só
   para não ser redescoberta.
4. **Os geradores aleatórios entram neste backlog?** As 135 tabelas estão no mesmo JSON que a
   AV-2 baixa, então o dado chega de graça — mas *usá-las* para gerar aventuras novas é outra
   meta, e outro backlog. Aqui elas ficam paradas no artefato de propósito. **Com a meta do
   nível 20 isso deixa de ser hipótese e vira o caminho provável** para as aventuras 2 em
   diante, já que só o *Night Blade* saiu sob CC.

## Referências no código

- [adventure.service.ts](../../../apps/api/src/adventure/adventure.service.ts) — `createForCharacter`: onde o acoplamento com a classe vive e de onde ele sai na AV-3.
- [character.ts](../../../packages/shared/src/types/character.ts) — `WorldEntity`, com os dois eixos (`sabido`, `revelado`) da US-75.
- [initial-adventures.ts](../../../apps/api/prisma/initial-adventures.ts) — os 13 ganchos por classe (× 2 locales) que a campanha única desemprega. **Não** deve virar o depósito da aventura autoral; destino na decisão 1.
- [contratos-de-api.md](../02-design/contratos-de-api.md) — as 6 tools existentes; `advanceQuest` da AV-5 é a 7ª.
- [scripts/srd/sync.mjs](../../../scripts/srd/sync.mjs) — molde de pinagem e artefato versionado. O parser da US-47 **não** é reusado: aqui não há parser.
