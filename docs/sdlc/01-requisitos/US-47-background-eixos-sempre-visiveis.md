# US-47 — Background: todos os eixos sempre visíveis na ficha

**Épico:** 3 — Narração e mecânica
**Fase:** 2 — Memória / continuidade espacial (Fase B)
**Status:** 🗂️ Backlog
**Depende de:** [US-45](./US-45-background-na-ficha-da-interface.md) (aba Background na ficha — já entregue)
**Supersede:** [US-45](./US-45-background-na-ficha-da-interface.md) no ponto do **eixo vazio** — troca "eixo vazio some + empty state global" por "todos os eixos sempre visíveis, vazio mostra 'Nenhum…'".
**Criada em:** 2026-07-09

---

## História

> **Como** jogador olhando a aba Background do meu personagem,
> **quero** ver sempre os quatro eixos (História, Ideais, Vínculos, Fraquezas), com uma marca clara de "nenhum" quando algum está vazio,
> **para que** eu saiba que o eixo está **vazio de propósito** — e não que ele sumiu ou bugou.

---

## Contexto e motivação

### O problema observado

A [US-45](./US-45-background-na-ficha-da-interface.md) decidiu "eixo vazio não vira bloco": um eixo do background sem conteúdo simplesmente **some** da aba. Na prática isso é ambíguo. Exemplo real: a personagem **Lyra** tem História, Ideais e Fraquezas preenchidos, mas **não tem Vínculos** — e a aba mostra só três seções. Quem olha não sabe se a Lyra *não tem vínculos* ou se a seção *desapareceu por erro*. A ausência de um eixo comunica "bug", não "vazio".

### Por que a solução atual não basta

O modelo da US-45 tem duas camadas de "vazio":
- **Eixo vazio** → o bloco é omitido (a fonte da ambiguidade acima).
- **Background todo vazio (`{}`)** → um empty state global ("Este personagem ainda não tem história.").

O eixo omitido não distingue "não preenchido" de "não existe". E o empty state global só cobre o caso extremo (nada preenchido), deixando o caso comum — **parcialmente** preenchido, como a Lyra — sem sinalização por eixo.

### A proposta

Mostrar **sempre os quatro eixos**, com rótulos fixos, na ordem História → Ideais → Vínculos → Fraquezas. Eixo preenchido mostra o conteúdo; eixo vazio mostra um marcador esmaecido de "nenhum" (concordância de gênero: "Nenhuma história", "Nenhum ideal", "Nenhum vínculo", "Nenhuma fraqueza"). Com isso, **cada eixo se auto-descreve** e o empty state global da US-45 deixa de ser necessário (um personagem recém-criado sem nada mostra os quatro eixos, todos "Nenhum…").

---

## Escopo

### Dentro do escopo

- Aba **Background** ([GameView.tsx](../../apps/web/src/components/game/GameView.tsx), `BackgroundPanel`): renderizar **sempre os 4 eixos** com rótulos fixos ("História", "Ideais", "Vínculos", "Fraquezas").
- Eixo **preenchido**: como hoje (prosa com `whitespace-pre-wrap` para História; lista de itens para os demais).
- Eixo **vazio**: um marcador esmaecido "Nenhum…" com concordância de gênero, no lugar do conteúdo.
- **Remover o empty state global** da US-45 ("Este personagem ainda não tem história.") — os quatro eixos "Nenhum…" já cobrem o caso de background totalmente vazio.
- Atualizar o teste da US-45 ([GameView.test.tsx](../../apps/web/src/components/game/GameView.test.tsx)): o caso `background {}` passa a esperar os 4 eixos com "Nenhum…", não mais o empty state global.

### Fora do escopo

- **Editar** o background pela ficha — segue sendo captura na criação (US-39); editor pós-criação é story futura.
- Mudar a **aba** em si (a aba Background continua sempre visível, como na US-45 — o que muda é o conteúdo dentro dela).
- Reordenar ou renomear eixos além dos quatro atuais.

---

## Critérios de aceite

- [ ] A aba **Background** mostra **sempre os quatro eixos** (História, Ideais, Vínculos, Fraquezas), nessa ordem, independentemente de quais têm conteúdo.
- [ ] Eixo **preenchido** mostra seu conteúdo (História em prosa; Ideais/Vínculos/Fraquezas como lista).
- [ ] Eixo **vazio** mostra um marcador esmaecido com concordância de gênero: "Nenhuma história", "Nenhum ideal", "Nenhum vínculo", "Nenhuma fraqueza".
- [ ] Personagem da imagem (**Lyra**, sem Vínculos) mostra a seção **Vínculos** com "Nenhum vínculo" — não a omite.
- [ ] Personagem com background **totalmente vazio** (`{}`) mostra os quatro eixos, todos "Nenhum…"; **não** existe mais o empty state global "Este personagem ainda não tem história.".
- [ ] **Eval / regressão:** renderizar `GameView` com `background` parcial (História + Fraquezas, sem Vínculos) e ver "Nenhum vínculo"; com `{}`, ver os quatro marcadores "Nenhum…" ([GameView.test.tsx](../../apps/web/src/components/game/GameView.test.tsx)).

---

## Notas de implementação

- Mexer só no `BackgroundPanel` de [GameView.tsx](../../apps/web/src/components/game/GameView.tsx). Trocar o `if (!hasAny) return <empty state global>` + `items.length > 0 && …` por um render fixo dos quatro eixos, cada um decidindo entre conteúdo e marcador "Nenhum…".
- Estrutura sugerida: uma lista dos 4 eixos com `{ label, kind: 'prose' | 'list', value, emptyText }`; iterar sempre, e por eixo escolher o render (prosa / lista / "Nenhum…").
- O marcador "Nenhum…" usa o mesmo tom esmaecido do empty state anterior (`text-stone-400 dark:text-stone-500`) — atenção ao contraste (ver [US-46](./US-46-acessibilidade-wcag-aa.md); texto pequeno esmaecido tende a ficar abaixo de AA).
- Atualizar o teste do caso `{}` na `GameView.test.tsx` (o assert do empty state global sai; entram os quatro "Nenhum…").

---

## Referências no código

- `apps/web/src/components/game/GameView.tsx` — `BackgroundPanel`: hoje omite eixo vazio e tem empty state global; passa a render fixo dos 4 eixos.
- `apps/web/src/components/game/GameView.test.tsx` — teste do caso `background {}` a atualizar.
- `docs/sdlc/01-requisitos/US-45-background-na-ficha-da-interface.md` — decisão de eixo vazio que esta US supersede.
