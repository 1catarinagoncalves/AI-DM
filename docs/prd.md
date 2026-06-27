# PRD — AI Dungeon Master

**Status:** Aprovado  
**Data:** 2026-06-27

---

## 1. Declaração do problema

Muitos jogadores de RPG narrativo querem poder jogar seus sistemas favoritos mas enfrentam
dois obstáculos principais:

1. Têm amigos que jogam, mas eles já estão ocupados demais com outras campanhas ou não têm tempo.
2. Não conhecem outras pessoas que jogam para jogar junto.

Além disso, o trabalho de mestre de RPG exige bastante dedicação, de modo que o número de
pessoas que executam essa função é bem mais reduzido do que o número de jogadores.

---

## 2. Objetivos e critério de aceite

**Objetivo:** Criar um AI Dungeon Master que os jogadores possam usar sozinhos ou em grupo.
Pode também ser usado por mestres humanos que querem apoio nas suas narrativas.

**Critério de aceite:** AI DM em que os jogadores possam jogar qualquer sistema ou aventura
de RPG narrativo, com o agente fazendo o papel de mestre — entendendo as regras, narrando a
aventura e acompanhando a ficha do personagem.

---

## 3. Usuários alvo

- **Jogadores** de RPG narrativo (solo ou em grupo)
- **Mestres humanos** que querem apoio na narração

---

## 4. Casos de uso

### 4.1 Personagens e campanhas

- Um jogador pode criar múltiplos personagens para participar de várias campanhas.
- Regra: 1 personagem por jogador por campanha.
- Um personagem pode ser usado em várias aventuras consecutivas (não simultaneamente).
- Um personagem pode ser **duplicado** para jogar campanhas distintas ao mesmo tempo (multiverso).
- Um personagem **lembra** dos acontecimentos da aventura anterior ao avançar para uma nova aventura.
- Dentro de uma aventura, o(s) jogador(es) podem ter várias missões.

### 4.2 Multiplayer

- Um jogador ou mestre pode convidar outros jogadores para a campanha.
- Limite de **até 10 personagens de jogador** por campanha.

### 4.3 Sistemas e aventuras

- Um jogador ou mestre pode jogar D&D ou outro sistema ao fazer o upload do livro para criar
  um novo sistema ou aventura.
- Um jogador ou mestre pode acessar o **histórico de aventuras e campanhas** a qualquer momento.

---

## 5. Fora do escopo (v1)

- Narração em áudio pelo AI DM
- Mundo aberto em 3D
- Escrita de sistemas e campanhas por mestres (interface de criação de conteúdo)

---

## 6. Questões em aberto

| Questão | Decisão provisória |
|---------|-------------------|
| Como evitar pirataria no upload de livros? | Upload como conteúdo privado por usuário; RAG isolado por campanha; aviso de responsabilidade ao usuário. Ver ADR seção 4. |
| Como integrar o SDK oficial de D&D? | Adaptador plugável via interface `RuleSystemProvider`. Ver ADR seção 4. |
