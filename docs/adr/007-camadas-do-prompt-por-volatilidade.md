# ADR 007 — Camadas do prompt por volatilidade: o que é cacheável, o que é recomputado e onde fica a fronteira

**Status:** Aceito
**Data:** 2026-07-27
**Decisores:** Time de Produto e Engenharia
**Relacionado:** [ADR 002 — Memória de sessão](./002-memoria-de-sessao.md) (o `EventLog` e o resumo são o que a camada 3 carrega) · [ADR 001 — Arquitetura](./001-arquitetura.md) (o Game Server é a fonte do estado que entra na camada 3) · [US-55](../sdlc/01-requisitos/US-55-prompt-caching-do-dm.md) (Fase A: ordenou o system por volatilidade) · [US-56](../sdlc/01-requisitos/US-56-estado-do-turno-na-mensagem.md) (Fase B: tirou a camada 3 do system) · [US-84](../sdlc/01-requisitos/US-84-nomes-de-bloco-do-turn-state-compartilhados.md) e [US-85](../sdlc/01-requisitos/US-85-fronteira-de-camadas-do-prompt.md) (consertam e protegem a fronteira que este ADR define)

---

## 1. Contexto

Todo turno do DM Agent reenvia o prompt inteiro. A parede de regras — ofício narrativo, formatação, ordem de resolução do turno — é o pedaço mais pesado e **100% invariante**; o estado do turno (HP, cena, inventário) é o mais leve e muda **sempre**. Provider com prompt caching cobra uma fração pelo prefixo repetido, mas o cache é **prefixal**: ele vale até o primeiro byte que muda. Um único campo volátil no meio da parede invalida tudo que vem depois.

Era exatamente o estado anterior à [US-55](../sdlc/01-requisitos/US-55-prompt-caching-do-dm.md): o conteúdo volátil ficava encravado no meio do system, então a parede de regras caía **depois** do primeiro byte instável e nunca era cacheada.

Duas stories corrigiram isso em duas fases:

- **[US-55](../sdlc/01-requisitos/US-55-prompt-caching-do-dm.md) (Fase A)** — reordenou o system por volatilidade: regras primeiro, dado do personagem depois, estado do turno no fim.
- **[US-56](../sdlc/01-requisitos/US-56-estado-do-turno-na-mensagem.md) (Fase B)** — tirou o estado do turno do system e o prefixou à **última mensagem do jogador**. Assim `system` + todo o `history` (append-only) viram um prefixo estável; só o bloco de estado e a ação crua são recomputados.

O desenho está certo e em produção. **O que nunca foi escrito é a regra que ele criou.** Ela vive hoje em dois comentários de código ([`dm-system.ts:175-178`](../../packages/ai-engine/src/prompts/dm-system.ts) e `:375-378`) e nas duas US. Quem edita a cena não passa pelo comentário da ficha; quem edita o system não passa pelo da camada 3.

O custo disso já apareceu: a camada 2 cita blocos da camada 3 **pelo nome, em prosa** (`:314`, `:349`, `:359`), com o literal repetido dos dois lados. As duas metades vivem em funções diferentes e, desde a US-56, em **mensagens diferentes**. Renomear um lado não quebra teste nem `typecheck` — o modelo simplesmente passa a receber uma instrução para confiar num bloco que não existe mais com aquele nome. A otimização de custo comprou distância; distância é onde string duplicada dessincroniza.

---

## 2. Decisão

**O prompt do DM Agent é dividido em três camadas por volatilidade — não por tema — e a fronteira entre elas é contrato.**

| Camada | O que é | Volatilidade | Onde vive | Quem produz |
|---|---|---|---|---|
| **1 — Regras** | Papel do mestre, barra de ofício, regras do sistema, regras críticas, ordem de resolução do turno, formatação | Invariante para **todo jogador** (varia só por sistema) | `system`, no topo | `buildDmSystemPrompt` |
| **2 — Personagem** | Nome, gênero, raça, classe, nível, atributos, perícias, background, features, magias conhecidas | Invariante **por aventura** (muda em level-up, raro) | `system`, no fim | `buildDmSystemPrompt` |
| **3 — Turno** | HP/condições, cena atual, entidades do mundo, quests, inventário, resumo da história | Muda **quase todo turno** | prefixo da **última mensagem** do jogador | `buildTurnStateBlock` |

Três regras derivam disso:

1. **Classificação por volatilidade, não por tema.** A ficha do personagem é dividida ao meio de propósito: nível/atributos/perícias são camada 2; HP/condições são camada 3. São "a mesma ficha" tematicamente e camadas diferentes por comportamento. Dado novo entra pela pergunta *"com que frequência isso muda?"* — nunca por *"isso é sobre o personagem?"*.

2. **A camada 2 nunca nomeia conteúdo da camada 3 por literal.** Precisou citar um bloco do turno (`"Cena atual"`, `"Current inventory"`), cita através do registro compartilhado. É a regra que faltava e que a [US-84](../sdlc/01-requisitos/US-84-nomes-de-bloco-do-turn-state-compartilhados.md) implementa. Vale nos dois sentidos, mas a direção perigosa é esta: a camada 3 é reescrita com frequência e a camada 2, cacheada, é quem fica apontando para o passado.

3. **Nada volátil sobe; nada estável desce.** Campo volátil na camada 1 ou 2 invalida o cache de tudo o que vem depois — é o defeito original que a US-55 consertou. Texto estável na camada 3 é reenviado a preço cheio todo turno — é desperdício silencioso, o oposto exato do que se comprou.

---

## 3. Decisões-chave e justificativas

**Por que a fronteira é contrato, e não convenção.** Convenção sobrevive enquanto quem a criou está editando. Estas duas metades são produzidas por funções diferentes, em mensagens diferentes, e a única coisa que as liga é uma string escrita à mão duas vezes. Contrato aqui significa: nome de bloco tem uma definição só, e um teste falha quando aparece bloco fora do registro.

**Por que o estado do turno vira conteúdo de mensagem do usuário, e não instrução de sistema.** É o preço da Fase B, e foi tratado como o principal risco na [US-56](../sdlc/01-requisitos/US-56-estado-do-turno-na-mensagem.md): o modelo passa a ler o estado como fala do jogador. A mitigação é o cabeçalho do bloco **dobrar** a linguagem de "fonte de verdade / precedência sobre a prosa", validada em eval de aderência. Isso torna o texto do cabeçalho parte do contrato, não decoração — mais um motivo para o nome não ser literal solto.

**Por que a camada 2 fica no fim do system, e não no começo.** O cache é prefixal e a camada 1 é a maior e a mais estável: ela tem de vir primeiro para ser cacheada por **todos** os jogadores. A camada 2, invariante por aventura, cacheia por sessão. Ordem = volatilidade crescente.

**Custo — o que está medido e o que não está.** O mecanismo do ganho é conhecido e o cache é automático no DeepSeek/OpenRouter (não há parâmetro no `streamText`; o ganho vem 100% da ordem do conteúdo). A ordem de grandeza do cache hit é ~10% do custo normal do input. **O número medido neste repo não está registrado aqui**: a medição é o spike `DM_CACHE_SPIKE` ([`ai.service.ts:661`](../../apps/api/src/ai/ai.service.ts)), que loga `usage`/`providerMetadata` no `onFinish`. Quem rodar o spike registra o antes/depois **neste ADR** — decisão de custo sem número é decisão que ninguém consegue revisar depois.

---

## 4. Alternativas rejeitadas

1. **Deixar a regra nos comentários de código.** É o estado atual, e é o que produziu o acoplamento da US-84: o comentário está no lugar certo para quem edita *aquela* função e invisível para quem edita a outra ponta da mesma regra.
2. **Um só builder para as três camadas, com flag de "modo".** Junta de novo o que a US-56 separou e devolve o risco de conteúdo volátil vazar para o prefixo cacheado. A separação física em duas funções é o que torna o vazamento testável (`dm-system.test.ts:126-139`).
3. **Não citar blocos da camada 3 na camada 2 (proibir a referência).** Resolveria o acoplamento por eliminação, mas as citações existem por um motivo: a instrução ("confie na cena", "não re-adicione equipamento inicial") pertence às regras e o dado pertence ao turno. Separar instrução de dado é o desenho; a referência entre eles é consequência inevitável.
4. **Snapshot do prompt inteiro como guard da fronteira.** Mesmo motivo já registrado em `rubric-drift.test.ts:12` e reafirmado na [US-77](../sdlc/01-requisitos/US-77-reancorar-assertivas-de-prompt-e-guard-de-regressao.md): snapshot convida ao `vitest -u`, que aprova a quebra em vez de revisá-la.

---

## 5. Consequências

**Positivas**
- Existe um lugar canônico para decidir em que camada um dado novo entra — e o critério é objetivo (frequência de mudança), não gosto.
- A regra de fronteira dá nome ao defeito da [US-84](../sdlc/01-requisitos/US-84-nomes-de-bloco-do-turn-state-compartilhados.md) e justifica o guard da [US-85](../sdlc/01-requisitos/US-85-fronteira-de-camadas-do-prompt.md) sem que nenhuma das duas precise re-explicar o desenho.
- Produtor de contexto novo (ex.: o reconciliador da [US-73](../sdlc/01-requisitos/US-73-reconciliador-de-cena-em-background.md)) chega com a pergunta já respondida: qual camada, e pode citar o quê.

**Negativas / custo aceito**
- A prosa do prompt fica um pouco menos legível onde o nome do bloco vira interpolação (`The "${SCENE_BLOCK}" blocks…`). Aceito: a alternativa é vigiar duplicação para sempre.
- Mais um artefato a manter em dia. Mitigado por ser curto e por os comentários de `dm-system.ts` apontarem para cá em vez de repetirem a regra.
- A regra 3 (nada estável desce) fica **sem guard** por ora: não há teste barato para "isto devia estar na camada 2". Fica como convenção medida pelo `DM_CACHE_SPIKE`, não como asserção — ver [US-85](../sdlc/01-requisitos/US-85-fronteira-de-camadas-do-prompt.md), *Questões em aberto* #1.

---

## 6. Implementação (referência)

- [`packages/ai-engine/src/prompts/dm-system.ts`](../../packages/ai-engine/src/prompts/dm-system.ts) — `buildDmSystemPrompt` (camadas 1+2) e `buildTurnStateBlock` (camada 3). Comentários em `:175-178` e `:375-378` explicam o porquê local e apontam para cá.
- [`packages/ai-engine/src/prompts/dm-system.test.ts`](../../packages/ai-engine/src/prompts/dm-system.test.ts) — `:126-139`: guard de que nenhum campo volátil vaza para as camadas 1+2. É a regra 3, metade "nada volátil sobe".
- [`apps/api/src/ai/ai.service.ts`](../../apps/api/src/ai/ai.service.ts) — `:661`: o spike `DM_CACHE_SPIKE` que mede o ganho; composição de `messages` (`system` + `history` + bloco de estado prefixado à ação crua).
