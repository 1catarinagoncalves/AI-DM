# User Stories — AI Dungeon Master

**Fase atual:** Fase 1 — MVP single-player  
**Atualizado em:** 2026-06-27

---

## Épicos e stories

### Épico 1: Personagem

**US-01** — Criar personagem  
Como jogador, quero criar um personagem com nome, raça, classe e atributos para poder iniciar uma aventura.

**US-02** — Ver ficha do personagem  
Como jogador, quero ver a ficha completa do meu personagem (HP, atributos, inventário, status) a qualquer momento durante a aventura.

**US-03** — Personagem persiste entre aventuras  
Como jogador, quero que meu personagem lembre dos eventos da aventura anterior quando inicio uma nova aventura, para manter a continuidade da narrativa.

**US-04** — Duplicar personagem (multiverso)  
Como jogador, quero poder duplicar um personagem para participar de campanhas distintas ao mesmo tempo sem afetar o personagem original.

---

### Épico 2: Campanha e aventura

**US-05** — Criar campanha  
Como jogador, quero criar uma campanha associada a um sistema de regras para organizar minhas aventuras.

**US-06** — Listar e acessar histórico  
Como jogador, quero acessar o histórico completo de aventuras e campanhas anteriores para revisitar o que aconteceu.

**US-07** — Múltiplas missões dentro de uma aventura  
Como jogador, quero receber e acompanhar múltiplas missões dentro de uma mesma aventura para ter objetivos claros durante o jogo.

---

### Épico 3: Narração e mecânica

**US-08** — Narração em streaming  
Como jogador, quero que a narração do mestre apareça progressivamente na tela (token-a-token) para uma experiência imersiva.

**US-09** — Rolagem de dados transparente  
Como jogador, quero que toda rolagem de dados mostre o resultado e o breakdown (ex: "2d6+3: [4, 2] +3 = 9") para entender as mecânicas.

**US-10** — Consulta de regras  
Como jogador, quero que o mestre aplique as regras do sistema correto durante a narração sem que eu precise consultá-las manualmente.

**US-11** — Ação em linguagem natural  
Como jogador, quero descrever minhas ações em linguagem natural (ex: "ataco o goblin com minha espada") e o mestre resolve conforme as regras.

**US-11b** — Estado de cena estruturado (continuidade espacial) — *Fase B da memória*  
Como jogador, quero que o mestre mantenha um estado de cena explícito (local atual, personagens presentes, período do dia e objetos em cena) para que a narração nunca me teletransporte nem invente cenário que contradiz onde estou.

> Detalhamento completo (contexto, modelo de dados, critérios de aceite e questões em aberto) em [`US-11b-estado-de-cena-estruturado.md`](./US-11b-estado-de-cena-estruturado.md).

**US-17** — Comparação de modelos de narração via evals de coerência
Como desenvolvedora, quero rodar a mesma bateria de cenários de coerência contra vários modelos candidatos e ver o resultado lado a lado (acerto + custo) para escolher o modelo de narração com base em dado objetivo.

> Detalhamento completo em [`US-17-comparacao-modelos-eval.md`](./US-17-comparacao-modelos-eval.md).

---

### Épico 4: Upload de sistema (Fase 3)

**US-12** — Upload de livro de regras  
Como jogador ou mestre, quero fazer upload de um livro de RPG em PDF para criar um sistema customizado para minha campanha.

**US-13** — Isolamento de conteúdo  
Como jogador, quero que o conteúdo do meu livro upado seja privado e não acessível a outros usuários.

---

### Épico 5: Multiplayer (Fase 4)

**US-14** — Convidar jogadores  
Como criador de campanha, quero enviar convite para outros jogadores participarem da minha campanha.

**US-15** — Limite de jogadores  
Como criador de campanha, quero que a campanha aceite no máximo 10 personagens de jogador.

**US-16** — Sessão em tempo real  
Como jogador em uma campanha multiplayer, quero ver as ações dos outros jogadores e a narração do mestre em tempo real.

---

## Prioridade por fase

| Story | Fase |
|-------|------|
| US-01 a US-11 | Fase 1 — MVP |
| US-03, US-06 (memória) | Fase 2 — Memória entre aventuras |
| US-11b (estado de cena estruturado) | Fase 2 — Memória / continuidade espacial (Fase B) |
| US-12, US-13 | Fase 3 — Upload de livros |
| US-14, US-15, US-16 | Fase 4 — Multiplayer |
| US-04 | Fase 5 — Multiverso |
