# US-45 — Background visível na ficha do personagem (interface)

**Épico:** 3 — Narração e mecânica
**Fase:** 2 — Memória / continuidade espacial (Fase B)
**Status:** ✅ Implementada
**Depende de:** [US-39](./US-39-identidade-narrativa-background-ideais.md) (campo `Character.background` persistido — já entregue)
**Relacionado:** [US-23](./US-23-dm-ciente-da-ficha.md) (o mestre já conhece o background; esta US é sobre o JOGADOR o ver) · [US-19](./US-19-estado-de-ficha-via-api.md) (ficha servida pela API)
**Criada em:** 2026-07-09

---

## História

> **Como** jogador,
> **quero** ver o background do meu personagem (história, ideais, vínculos e fraquezas) numa aba própria da ficha, na interface,
> **para que** eu me lembre de quem ele é durante o jogo — sem que a história dispute espaço com HP, atributos e perícias, e não só o mestre.

---

## Contexto e motivação

### O problema observado

A [US-39](./US-39-identidade-narrativa-background-ideais.md) faz o personagem ter background e o **mestre** o conhece (injetado no prompt). Mas o **jogador** não o vê: a sidebar "Ficha do personagem" no [GameView.tsx:215](../../apps/web/src/components/game/GameView.tsx) mostra HP, condições, atributos, perícias e inventário — **nada de background**. O jogador preenche a história na criação e depois ela some da vista.

Além disso, hoje a ficha é uma **pilha vertical única** que rola: HP, condições, atributos, perícias e inventário empilhados na sidebar, sem qualquer separação por aba. Empurrar a história (que pode ser um parágrafo longo, mais ideais/vínculos/fraquezas) para o fim dessa mesma pilha afundaria o dado mecânico (HP, atributos) que o jogador consulta a cada turno. Prosa longa e dado de referência rápido têm ritmos de leitura diferentes e não deviam competir pelo mesmo scroll.

### Por que a solução atual não basta

O dado já existe e já é servido: `Character.background` é persistido (US-39) e o endpoint `findOne` já o devolve (é um scalar do `Character`, sem `select` que o exclua — [character.service.ts](../../apps/api/src/character/character.service.ts) `findOne`). Falta **passar** o campo à `GameView` e **renderizar** — mas renderizar numa pilha única mistura mecânica e narrativa. A ficha precisa ganhar **abas**: um eixo de navegação que separe "o que meu personagem consegue fazer" (mecânica) de "quem meu personagem é" (background).

### A proposta

Introduzir **abas na ficha** (sidebar da `GameView`) e colocar o **background numa aba própria**, separada da mecânica:

- **Aba "Ficha"** (padrão/inicial) — o conteúdo mecânico de hoje: condições, atributos, perícias e inventário.
- **Aba "Background"** — read-only: história (prosa), ideais, vínculos e fraquezas, quando presentes.

A identidade do topo (nome, raça, classe) e a barra de **HP** ficam **fixas acima das abas** — são referência constante e não devem sumir ao trocar de aba. As abas trocam só o conteúdo abaixo delas.

---

## Escopo

### Dentro do escopo

- **Abas na ficha** (sidebar da [GameView.tsx](../../apps/web/src/components/game/GameView.tsx)): pelo menos duas — **"Ficha"** (mecânica) e **"Background"** (narrativa). Uma aba ativa por vez; a "Ficha" é a inicial.
- Nome/raça/classe e a barra de **HP** ficam **fixos acima das abas** (sempre visíveis, não pertencem a nenhuma aba).
- Aba **"Ficha"**: condições, atributos, perícias e inventário (o conteúdo mecânico de hoje, movido para dentro da aba).
- Aba **"Background"**, read-only: história (prosa) + ideais + vínculos + fraquezas.
- A aba **"Background" é sempre visível** (não aparece/some conforme o dado). Sem background (`{}`), a aba mostra um **empty state** — ex.: "Este personagem ainda não tem história.".
- Thread do campo `background` da API (`findOne`) → página de jogo (`app/play/[adventureId]/page.tsx`) → prop da `GameView`.
- Render **por iteração/condicional** dos *blocos internos* da aba Background: campo vazio não vira linha; eixo vazio não vira bloco (mesmo padrão de condições/perícias). O que some quando vazio são os blocos — **não** a aba.
- Read-only, coerente com o resto da ficha.
- Acessibilidade das abas: `role="tab"`/`role="tabpanel"`, `aria-selected` na ativa, navegação por teclado (setas + Enter/Espaço), estado ativo visualmente distinto e alvo de toque ≥44px.

### Fora do escopo

- **Editar** o background pela ficha — a captura é na criação (US-39). Um editor pós-criação é story própria (futura).
- Injeção no prompt do mestre — já é a [US-39](./US-39-identidade-narrativa-background-ideais.md).
- Divindade/features/magias na ficha — quando existirem ([US-40](./US-40-divindade-do-personagem.md)/[US-41](./US-41-features-traits-de-classe.md)/[US-42](./US-42-magias-conhecidas.md)), aproveitam o padrão de abas (nova aba ou seção na aba "Ficha"); não é escopo desta.

---

## Critérios de aceite

- [ ] A ficha na sidebar da `GameView` tem **abas**, com **"Ficha"** (mecânica) e **"Background"** (narrativa) como abas distintas; a **"Ficha" abre por padrão**.
- [ ] Nome/raça/classe e a barra de **HP** ficam **fixos acima das abas** e continuam visíveis ao trocar de aba.
- [ ] A aba **"Background"** mostra história, ideais, vínculos e fraquezas quando presentes, e é **read-only** (sem edição na ficha).
- [ ] A aba **"Background" está sempre presente**; com `background` `{}` ela abre e mostra um **empty state** (não desaparece nem fica em branco).
- [ ] Cada eixo do background só aparece se preenchido; personagem com background vazio (`{}`) **não** gera blocos vazios dentro da aba (sem conteúdo fantasma) — só o empty state.
- [ ] Trocar de aba **não perde estado** do jogo (mensagens, HP corrente, inventário) — a troca é só de vista, não remonta a ficha.
- [ ] As abas são **acessíveis**: aba ativa distinta visualmente, `aria-selected`, e navegáveis por teclado.
- [ ] O campo `background` é lido do que a API já devolve (`findOne`), sem novo endpoint.
- [ ] **Eval / regressão:** renderizar `GameView`, clicar na aba **Background** e ver a história e uma fraqueza; com `background` `{}`, a aba **Background** continua clicável e mostra o **empty state** (não some, não fica em branco). A aba **Ficha** mantém atributos/perícias (`GameView.test.tsx` ou equivalente).

---

## Notas de implementação

- `GameView` recebe a ficha por props (`attributes`, `skills`, `conditions`, …) montadas na página de jogo. Adicionar `background?: { story?; ideals?; bonds?; flaws? }` às `Props`.
- **Abas via estado local:** `const [tab, setTab] = useState<'ficha' | 'background'>('ficha')` na `GameView`. É estado só de vista — **não** mexer no estado de jogo (`messages`, `currentHp`, `inventory`), para que trocar de aba não remonte nem perca nada. A sidebar (`<aside>` em [GameView.tsx:216](../../apps/web/src/components/game/GameView.tsx)) passa a ter: bloco fixo (nome/raça/classe + HP) → barra de abas → conteúdo da aba ativa.
- **Barra de abas:** renderizar a partir de uma **lista de abas** (ex.: `[{ id: 'ficha', label: 'Ficha' }, { id: 'background', label: 'Background' }]`), não dois botões hard-coded — assim uma futura aba (divindade/features/magias) entra acrescentando um item. Cada botão `role="tab"` + `aria-selected` + `aria-controls` num container `role="tablist"`; cada painel `role="tabpanel"`. Aba ativa com destaque (ex.: borda inferior âmbar + texto `text-amber-600 dark:text-amber-400`), inativa esmaecida. Alvo de toque ≥44px; navegação por teclado com setas.
- Mover o conteúdo mecânico atual (condições, atributos, perícias, inventário) para dentro do painel da aba **"Ficha"** — é recolocação, não reescrita das seções.
- Painel **"Background"**: render condicional dos blocos como as outras seções (`background?.story && …`); iterar os eixos com rótulos ("História", "Ideais", "Vínculos", "Fraquezas"), listas como itens. `story` longa com `whitespace-pre-wrap` (a sidebar rola). Se nenhum eixo tiver conteúdo, renderizar o **empty state** em vez dos blocos (ex.: um `<p>` esmaecido "Este personagem ainda não tem história.").
- A página `app/play/[adventureId]/page.tsx` já carrega o personagem para montar as props — passar `character.background` adiante (o `findOne` já o traz).
- Reaproveitar o tipo `CharacterBackground` de `@ai-dm/ai-engine` para a prop, ou um tipo estrutural local — não redefinir a forma.
- Cuidar do dark mode e do estilo das seções existentes (mesmos utilitários Tailwind da sidebar); manter a barra de abas legível nos dois temas.

---

## Decisões

- **Aba Background sempre visível (com empty state).** A aba **"Background" aparece sempre**, independente do dado. Sem background (`{}`), abre num empty state ("Este personagem ainda não tem história."). Descartada a alternativa de a aba só existir quando há dado — abas que aparecem/somem tornam a navegação imprevisível. O que some quando vazio são os *blocos internos*, não a aba.
  - ⚠️ **Superseded pela [US-47](./US-47-background-eixos-sempre-visiveis.md):** o comportamento de *eixo vazio* (bloco some) e o *empty state global* foram trocados por "sempre os 4 eixos, vazio mostra 'Nenhum…'". A aba continua sempre visível; muda só o conteúdo dentro dela.
- **Esta US entrega duas abas ("Ficha" e "Background").** Haverá **mais abas** no futuro (ex.: divindade/features/magias — [US-40](./US-40-divindade-do-personagem.md)/[US-41](./US-41-features-traits-de-classe.md)/[US-42](./US-42-magias-conhecidas.md)), mas cada nova aba é decidida e entregue **na sua própria US**, não aqui. O trabalho desta US é montar o **padrão de abas** (barra, estado, acessibilidade) de forma que acrescentar uma aba depois seja barato. A barra de abas deve, portanto, ser escrita para escalar além de duas (iterar sobre uma lista de abas, não hard-codar dois botões).
- **Alvo é a sidebar da `GameView` (em jogo).** As abas entram na sidebar "Ficha do personagem" da `GameView`, e só lá. Qualquer reuso noutra tela é outra US — fora do escopo desta.
- **Prosa longa mostrada inteira (sem truncar).** A `story`, mesmo longa, é renderizada por completo com `whitespace-pre-wrap`; a aba/sidebar rola. Sem "ver mais"/truncagem — numa aba dedicada a prosa não empurra a mecânica, então mostrar inteira não incomoda.

---

## Referências no código

- `apps/web/src/components/game/GameView.tsx` — sidebar "Ficha do personagem" (`:215`), onde entram as abas (estado `tab`), o bloco fixo (nome/HP), a aba "Ficha" (mecânica atual) e a aba "Background", além das `Props`.
- `apps/web/src/app/play/[adventureId]/page.tsx` — carrega o personagem e monta as props da `GameView`.
- `apps/api/src/character/character.service.ts` — `findOne` já devolve `Character.background`.
- `packages/ai-engine/src/prompts/dm-system.ts` — tipo `CharacterBackground` reaproveitável.
- `docs/sdlc/01-requisitos/US-39-identidade-narrativa-background-ideais.md` — origem do campo `background`.
