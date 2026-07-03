# User Stories — AI Dungeon Master

**Fase atual:** Fase 1 — MVP single-player  
**Atualizado em:** 2026-07-02

---

## Épicos e stories

### Épico 1: Personagem

**US-01** — Criar personagem  
Como jogador, quero criar um personagem com nome, raça, classe e atributos para poder iniciar uma aventura.

**US-02** — Ver ficha do personagem  
Como jogador, quero ver a ficha completa do meu personagem (HP, atributos, inventário, status) a qualquer momento durante a aventura.

**US-19** — Estado de ficha legível e sincronizado via API  
Como jogador, quero que a ficha na barra lateral (HP, inventário, condições) reflita o estado real persistido no servidor durante o jogo, e não um valor preso da carga inicial.

> Detalhamento completo em [`US-19-estado-de-ficha-via-api.md`](./US-19-estado-de-ficha-via-api.md).

**US-03** — Personagem persiste entre aventuras  
Como jogador, quero que meu personagem lembre dos eventos da aventura anterior quando inicio uma nova aventura, para manter a continuidade da narrativa.

**US-26** — Criação de personagem em etapas com trilha de progresso  
Como jogador, quero criar o personagem num assistente com etapas (Sistema → Raça/Classe → Atributos → Perícias → Revisão), com uma trilha lateral mostrando onde estou e o que já concluí, para conseguir avançar e voltar sem perder o que preenchi.  
> Telas do design 1a: 3–6. Estende [US-01](#) e reusa [US-20](./US-20-catalogo-de-sistemas-via-api.md) para a etapa de Sistema.
> - Cada etapa tem **Voltar/Próximo**; avançar valida a etapa atual (raça e classe obrigatórias, etc.).
> - Atributos por **point-buy**: mostra "pontos restantes" e bloqueia confirmar se o orçamento estourar/sobrar.
> - Tela de **Revisão** resume tudo (nome, raça, classe, nível, atributos, perícias) antes de **Confirmar personagem**, que persiste via API.
> - O mesmo assistente é reusado pela ramificação "criar novo personagem" do fluxo 2a (a partir da etapa de Sistema).

**US-27** — Perícias na criação de personagem  
Como jogador, quero escolher perícias durante a criação (dentro do orçamento do sistema), para que o personagem tenha competências que o mestre leve em conta na narração.  
> Tela do design 1a: etapa "Perícias". Lista de perícias vem do `config` do sistema ([US-21](./US-21-sistemas-como-dado.md)); persistidas na ficha e injetadas no DM automaticamente ([US-23](./US-23-dm-ciente-da-ficha.md)).

---

### Épico 2: Aventura

**US-21** — Sistema de regras como dado reutilizável pelas APIs  
Como desenvolvedora, quero que atributos e kits iniciais venham de um `config` no `System`, para que integrar um sistema novo seja inserir um `System` + `config` sem tocar em controller/serviço.

> Detalhamento em [`US-21-sistemas-como-dado.md`](./US-21-sistemas-como-dado.md) · decisão em [ADR 003](../../adr/003-sistemas-como-dado.md).

**US-22** — Fusão de campanha e aventura numa entidade só  
Como desenvolvedora, quero que campanha e aventura sejam uma entidade só (a história com uma missão principal), com o personagem como fio de continuidade, para refletir o domínio e remover a duplicação de sistema.

> Detalhamento em [`US-22-fusao-campanha-aventura.md`](./US-22-fusao-campanha-aventura.md) · decisão em [ADR 003](../../adr/003-sistemas-como-dado.md) (D2). Depende de US-21.

**US-06** — Listar e acessar histórico  
Como jogador, quero acessar o histórico completo das aventuras anteriores do meu personagem para revisitar o que aconteceu.

**US-18** — Histórico de turnos servido pela API  
Como jogador, quero que o histórico da aventura seja carregado do servidor (não do `localStorage`) ao abrir a tela de jogo, para não perder a conversa ao trocar de navegador ou dispositivo.

> Detalhamento completo em [`US-18-historico-servido-pela-api.md`](./US-18-historico-servido-pela-api.md).

**US-20** — Catálogo de sistemas servido pela API  
Como jogador, quero escolher o sistema de regras a partir da lista real do servidor (`GET /campaigns/systems`), em vez de opções hardcoded no setup.

> Detalhamento completo em [`US-20-catalogo-de-sistemas-via-api.md`](./US-20-catalogo-de-sistemas-via-api.md).

**US-28** — Seleção de aventura inicial  
Como jogador, ao terminar de criar o personagem quero escolher uma aventura pré-pronta (ex.: "A Mina Perdida — Iniciante · masmorra") de uma lista, para começar a jogar sem montar a campanha do zero.  
> Tela do design 1a: 7 (última etapa do stepper). Cria a aventura ([US-22](./US-22-fusao-campanha-aventura.md)) a partir do módulo escolhido e leva para a tela de jogo.

**US-29** — Retomar aventura em andamento  
Como jogador com personagem existente, quero continuar a aventura de onde parei carregando o estado salvo (histórico + ficha), sem recriar nada, para voltar direto à ação.  
> Fluxo 2a → tela 3a ("Retomando 'A Mina Perdida'…" → Entrar na aventura). Carrega histórico via [US-18](./US-18-historico-servido-pela-api.md) e ficha via [US-19](./US-19-estado-de-ficha-via-api.md); acionado pelo "Continuar jogando" do hub (US-25).

---

### Épico 3: Narração e mecânica

**US-09** — Rolagem de dados transparente  
Como jogador, quero que toda rolagem de dados mostre o resultado e o breakdown (ex: "2d6+3: [4, 2] +3 = 9") para entender as mecânicas.

**US-23** — DM ciente da ficha completa (injeção dirigida por dados)  
Como jogador, quero que o mestre tenha ciência de tudo na minha ficha (atributos, HP, nível, condições e o que for adicionado no futuro), sem precisar reescrever o prompt a cada campo novo.

> Detalhamento em [`US-23-dm-ciente-da-ficha.md`](./US-23-dm-ciente-da-ficha.md).

**US-11b** — Estado de cena estruturado (continuidade espacial) — *Fase B da memória*  
Como jogador, quero que o mestre mantenha um estado de cena explícito (local atual, personagens presentes, período do dia e objetos em cena) para que a narração nunca me teletransporte nem invente cenário que contradiz onde estou.

> Detalhamento completo (contexto, modelo de dados, critérios de aceite e questões em aberto) em [`US-11b-estado-de-cena-estruturado.md`](./US-11b-estado-de-cena-estruturado.md).

**US-17** — Comparação de modelos de narração via evals de coerência
Como desenvolvedora, quero rodar a mesma bateria de cenários de coerência contra vários modelos candidatos e ver o resultado lado a lado (acerto + custo) para escolher o modelo de narração com base em dado objetivo.

> Detalhamento completo em [`US-17-comparacao-modelos-eval.md`](./US-17-comparacao-modelos-eval.md).

---

### Épico 4: Onboarding e navegação

**US-24** — Login / criar conta  
Como jogador, quero entrar com e-mail e senha (ou criar conta / recuperar senha), para que meus personagens e aventuras fiquem associados a mim e acessíveis em qualquer dispositivo.  
> Tela do design 1a: 1. Pré-requisito das telas personalizadas ("Olá, Lyra") do fluxo 2a.

**US-25** — Boas-vindas adaptativa (hub do jogador)  
Como jogador, ao entrar quero uma tela de boas-vindas que reflete meu estado: se **não tenho personagem**, ela me convida a criar o primeiro; se **já tenho**, mostra meus personagens, a aventura em andamento e os botões "Continuar jogando" e "Criar novo personagem".  
> Uma única tela orientada a dados, cobrindo o estado vazio do fluxo 1a (tela 2) e o estado com personagem do fluxo 2a (tela 2). "Continuar jogando" → US-29; "Criar novo personagem" → US-26; "Criar meu personagem" (estado vazio) → US-26.

---

## Cobertura dos fluxos de design 1a e 2a

Mapa tela → US (design "Fluxo de criação de personagem RPG"):

| Fluxo | Tela | US |
|-------|------|----|
| 1a | 1 Login | US-24 |
| 1a | 2 Boas-vindas (sem personagem) | US-25 |
| 1a | 3 Seleção de sistema | US-26 (etapa) + US-20 (catálogo) |
| 1a | 4–5 Raça/Classe · Atributos · Perícias | US-26 + US-27 (reusa US-01) |
| 1a | 6 Revisão / Confirmar personagem | US-26 |
| 1a | 7 Seleção de aventura | US-28 |
| 2a | 2 Boas-vindas (com personagem) | US-25 |
| 2a | 3a Retomando aventura | US-29 |
| 2a | 3b Criar novo personagem | US-26 (reentra na etapa de Sistema) |

---
