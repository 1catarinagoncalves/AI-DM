# US-02 — Inventário do personagem e equipamento inicial

**Épico:** Free
**Status:** Para desenvolvimento
**Depende de:** US-01 — Atributos do personagem
**Criada em:** 29-06-2026

---

## História

> **Como** jogador,
> **quero** ver o inventário do meu personagem na interface web,
> **para que** possa acompanhar os itens e equipamentos que o personagem possui, assim que eu termino de criar o personagem e possuo um equipamento inicial.

---

## Contexto e motivação

### O problema observado

O personagem do jogador não possui uma seção onde o jogador possa ver os itens e equipamentos que ele possui. Além disso, o personagem é criado sem nenhum equipamento inicial.

### Por que a solução atual não basta

O AI DM cita os itens ou equipamentos que o personagem possui ou adquire no texto conversacional, mas isso se perde conforme a conversa avança, o que dificulta o jogador acompanhar seu inventário.

### A proposta

Abaixo de onde fica os atributos, adicionar os equipamentos e itens do mesmo, com um título acima. Essa regra deve valer tanto para o sistema free quanto d&d.

---

## Escopo

### Dentro do escopo

- Inventário do personagem da página de chat com o mestre, abaixo dos atributos.
- Há um título para a seção inventário.
- O personagem pode ter até 9999 itens ou equipamentos no inventário.
- Itens com o mesmo nome devem ser agrupados na mesma linha, com uma indicação entre parenteses de qual é o numero de itens.
- Ao lado do título, colocar entre parenteses a quantidade todas de itens por linha que há no inventário.
- Quando o AI DM cita que o personagem do jogador recebeu ou pegou algum item/equipamento, este aparece no inventário do personagem.
- Quando o jogador narra que um item vai ser usado, dado ou destruido, esse item sai do inventário.
- Quando o personagem do jogador é criado, o backend popula automaticamente o inventário com os equipamentos iniciais correspondentes à classe escolhida, sem depender do AI DM.

### Fora do escopo

- Destruir itens do inventário sem o usuário narrar que vai fazer isso.
- Inventário separado entre itens e equipamentos.
- Organizar a ordem dos itens do inventário.

---

## Critérios de aceite

- [ ] A seção "Inventário" está visível na página de chat com o mestre, posicionada abaixo dos atributos do personagem, com um título identificável.
- [ ] Ao lado do título "Inventário", aparece entre parênteses o número de linhas distintas de itens — ex.: `Inventário (4)`. Inventário vazio exibe `Inventário (0)`.
- [ ] Itens com o mesmo nome são agrupados em uma única linha com a quantidade entre parênteses — ex.: `Poção de Cura (3)`. Quantidade 1 exibe apenas o nome, sem parênteses.
- [ ] O inventário suporta até 9999 itens no total (soma de todas as quantidades); ao atingir o limite, novos itens não são adicionados e uma mensagem de erro é exibida ao jogador informando que o item não foi adicionado ao inventário.
- [ ] Quando o AI DM narra que o personagem recebeu ou pegou um item/equipamento, esse item aparece no inventário automaticamente (nova linha se for novo, ou incremento de quantidade se já existir).
- [ ] Quando o jogador narra que um item vai ser usado, dado ou destruído, a quantidade é decrementada; se chegar a zero, o item é removido da lista.
- [ ] O inventário é atualizado via mecanismo interno — o jogador nunca vê blocos de metadados brutos na conversa (ex.: `[WORLD_STATE_UPDATE: {...}]`).
- [ ] Ao concluir a criação do personagem, o `CharacterService` popula o inventário com os equipamentos iniciais da classe escolhida — o jogador já os vê no inventário ao entrar no chat, sem nenhuma mensagem do AI DM ser necessária para isso.
- [ ] **Eval / teste de regressão:** Dado um inventário com 2× "Espada Curta" e 1× "Escudo", a interface exibe `Espada Curta (2)` e `Escudo` em linhas separadas, e o título exibe `Inventário (2)` (2 linhas distintas, não a soma 3).

---

## Notas de implementação

### Restrição técnica de narrativa

O AI DM atualiza o inventário via mecanismo interno — metadados brutos (ex.: `WORLD_STATE_UPDATE`) nunca devem aparecer visíveis na conversa para o jogador.

### Equipamentos iniciais por classe

O `CharacterService` deve usar a tabela abaixo ao criar o personagem. Para classes não listadas, usar bom senso baseado no arquétipo mais próximo.

| Classe | Equipamentos iniciais |
|---|---|
| Guerreiro(a) | Espada longa, Escudo, Armadura de couro, Mochila, Cantil |
| Mago(a) | Cajado arcano, Grimório, Vestes de mago, Poção de mana, Cantil |
| Arqueiro(a) | Arco longo, Aljava (20 flechas), Adaga, Armadura de couro leve, Cantil |
| Ladino/Ladina | Adaga ×2, Ferramentas de ladrão, Armadura de couro, Corda, Cantil |
| Clérigo(a) | Martelo, Símbolo sagrado, Armadura de malha, Kit de primeiros socorros, Cantil |
| Paladino(a) | Espada longa, Escudo, Armadura de malha, Símbolo sagrado, Cantil |
| Bárbaro(a) | Machado grande, Pele de urso (armadura), Adaga, Cantil |
| Druida | Cajado de carvalho, Símbolo druídico, Túnica de couro, Kit de ervas, Cantil |
| Bardo | Espada curta, Instrumento musical, Armadura de couro, Cantil |
| Feiticeiro(a) | Cajado, Foco arcano (cristal), Vestes ornamentadas, Poção de mana, Cantil |
