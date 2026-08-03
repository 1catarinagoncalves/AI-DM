# US-02 — Inventário do personagem e equipamento inicial

**Épico:** Free
**Status:** Feito
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

> ⚠️ **Superada pela [US-51](./US-51-kits-iniciais-do-srd.md) (2026-07-14). A tabela abaixo é histórica.**
>
> Ela definiu os kits do MVP e foi transcrita para `config.startingKits` no [seed.ts](../../../apps/api/prisma/seed.ts) pela [US-21](./US-21-sistemas-como-dado.md). Mas **estes kits nunca foram SRD** — são flavor autoral, e alguns itens não existem em D&D 5e ("Poção de mana", "Pele de urso (armadura)").
>
> A [US-51](./US-51-kits-iniciais-do-srd.md) passa a **derivar os kits do SRD 2024** (Open5e, `ClassFeature` / `CORE_TRAITS_TABLE`, sempre a opção A), traduzidos por overlay pt-BR. O mago deixa de ter Poção de mana e passa a ter 2 adagas, foco arcano (bordão), túnica, grimório e mochila de erudito.
>
> *(Correção de 03/08/2026: esta nota dizia que o kit vinha do `5e-bits/5e-database` e que era story própria por causa da OGL 1.0a. O dado está no mesmo Open5e CC-BY-4.0 da [US-47](./US-47-ingestao-srd-como-dado.md) — nenhuma segunda fonte entrou. Ver [ADR 004 §3.2](../../adr/004-origem-do-dado-de-sistema.md).)*
>
> **O que continua valendo desta US:** o *mecanismo* — kit resolvido por classe na criação, com fallback tolerante para classe desconhecida (hoje `getStartingInventory` + `CLASS_SYNONYMS` + chave `default`). O que muda é só o **conteúdo** da tabela, e ele deixa de morar aqui: a fonte passa a ser o dataset.
>
> **Aventuras já iniciadas não mudam** — o inventário é materializado em `CharacterState.inventory` quando a **aventura** começa (`AdventureService.create`), não no `Character`. Personagem antigo que iniciar uma aventura nova recebe o kit novo. *(Correção de 03/08/2026: esta linha dizia "materializado no `Character` na criação"; `Character` não tem coluna `inventory`.)*

| Classe (histórico) | Equipamentos iniciais (MVP, substituídos pela US-51)                          |
| ------------- | ------------------------------------------------------------------------------ |
| Guerreiro(a)  | Espada longa, Escudo, Armadura de couro, Mochila, Cantil                       |
| Mago(a)       | Cajado arcano, Grimório, Vestes de mago, Poção de mana, Cantil                 |
| Arqueiro(a)   | Arco longo, Aljava (20 flechas), Adaga, Armadura de couro leve, Cantil         |
| Ladino/Ladina | Adaga ×2, Ferramentas de ladrão, Armadura de couro, Corda, Cantil              |
| Clérigo(a)    | Martelo, Símbolo sagrado, Armadura de malha, Kit de primeiros socorros, Cantil |
| Paladino(a)   | Espada longa, Escudo, Armadura de malha, Símbolo sagrado, Cantil               |
| Bárbaro(a)    | Machado grande, Pele de urso (armadura), Adaga, Cantil                         |
| Druida        | Cajado de carvalho, Símbolo druídico, Túnica de couro, Kit de ervas, Cantil    |
| Bardo         | Espada curta, Instrumento musical, Armadura de couro, Cantil                   |
| Feiticeiro(a) | Cajado, Foco arcano (cristal), Vestes ornamentadas, Poção de mana, Cantil      |
