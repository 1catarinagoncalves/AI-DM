# US-46 — Acessibilidade da aplicação web (WCAG 2.2 AA)

**Épico:** 4 — Onboarding e navegação
**Fase:** 2 — Qualidade da interface
**Status:** ✅ Implementada
**Relacionado:** [US-25](./US-25-boas-vindas-adaptativa.md) (hub) · [US-26](./US-26-criacao-personagem-em-etapas.md) (wizard de criação) · [US-45](./US-45-background-na-ficha-da-interface.md) (abas na ficha — já entrega abas acessíveis, este é o padrão a espalhar)
**Criada em:** 2026-07-09

---

## História

> **Como** jogador que usa teclado, leitor de tela, ou tem baixa visão / sensibilidade a movimento,
> **quero** que toda a aplicação web (hub, criação de personagem e tela de jogo) seja operável e legível sem depender de mouse, cor ou visão apurada,
> **para que** eu consiga criar um personagem e jogar de ponta a ponta sem barreiras.

---

## Contexto e motivação

### O problema observado

A interface cresceu feature a feature (US-25, US-26, US-34…) sem um passe de acessibilidade. Uma auditoria manual das três superfícies principais — hub ([HomeHero.tsx](../../../apps/web/src/components/HomeHero.tsx)), wizard de criação ([SetupWizard.tsx](../../../apps/web/src/components/setup/SetupWizard.tsx)) e jogo ([GameView.tsx](../../../apps/web/src/components/game/GameView.tsx)) — encontrou barreiras concretas e **sistêmicas**, não pontuais:

1. **Sem indicador de foco de teclado consistente.** [globals.css](../../../apps/web/src/app/globals.css) é só `@import "tailwindcss"` — não há `:focus-visible` global. A caixa de texto do jogo remove o contorno (`focus:outline-none`) e troca por mudança sutil de borda de 1px ([GameView.tsx](../../../apps/web/src/components/game/GameView.tsx)), abaixo do esperado por WCAG 2.4.7. Navegar por Tab é adivinhação.
2. **Contraste de texto abaixo de AA.** Rótulos e texto secundário usam `text-stone-400`/`stone-500`/`stone-600` sobre fundos claros/escuros. Ex.: labels de atributo `text-stone-500` sobre `bg-stone-200` na ficha ≈ **3.8:1** (mínimo AA para texto pequeno é 4.5:1); "Ver todos os personagens" em `text-stone-400 dark:text-stone-600` ([HomeHero.tsx](../../../apps/web/src/components/HomeHero.tsx)); rótulos de etapa `text-[10px] text-stone-400` e placeholders `placeholder-stone-400` no wizard ([SetupWizard.tsx](../../../apps/web/src/components/setup/SetupWizard.tsx)).
3. **Narração em streaming não é anunciada.** O `GameView` acrescenta o texto do mestre token a token, mas o container de mensagens não tem `aria-live`. Leitor de tela não fala nada enquanto a história aparece — o conteúdo central do app é silencioso. Idem rolagens, mudança de HP e mensagens de erro.
4. **Botão de tema sem nome acessível.** [ThemeToggle.tsx](../../../apps/web/src/components/ThemeToggle.tsx) tem só o emoji `☀`/`🌙` como conteúdo e um `title` — `title` não é nome acessível confiável; falta `aria-label`.
5. **Emojis decorativos lidos como conteúdo.** O `⚔` do herói ([HomeHero.tsx](../../../apps/web/src/components/HomeHero.tsx)) e afins não têm `aria-hidden`; o leitor de tela anuncia "espadas cruzadas".
6. **Faltam landmark `<main>` e skip link.** O hub e o wizard renderizam direto no `<body>` ([layout.tsx](../../../apps/web/src/app/layout.tsx)), sem `<main>`. Não há "pular para o conteúdo". (A `GameView` já usa `<main>`/`<aside>`.)
7. **Movimento não respeita `prefers-reduced-motion`.** `animate-pulse` (loading do hub, cursor de streaming do jogo, loading do wizard) e `transition-*` em toda parte, sem degradar para estático. Nenhum bloco `@media (prefers-reduced-motion: reduce)`.
8. **Campos sem label visível persistente.** Inputs do wizard têm `aria-label` (bom para leitor de tela) mas usam **placeholder como rótulo visível** ([SetupWizard.tsx](../../../apps/web/src/components/setup/SetupWizard.tsx) etapa Raça/Classe e Background) — some ao digitar e tem contraste baixo.
9. **Tema ignora `prefers-color-scheme`.** O script inline default-a-escuro a menos que o `localStorage` diga `light` ([layout.tsx](../../../apps/web/src/app/layout.tsx)); não lê a preferência do sistema.

### Por que a solução atual não basta

Cada tela foi construída pensando em mouse + visão plena. O padrão certo já existe pontualmente — a US-45 entregou abas com `role="tab"`/`aria-selected`/teclado, e o wizard já acerta `aria-label` em botões de ícone (`−`/`+`, `✕`). Falta **generalizar** isso e cobrir os eixos que ninguém tratou (foco, contraste, `aria-live`, movimento reduzido, landmarks).

### A proposta

Um passe de **remediação de acessibilidade** nas três superfícies, com **WCAG 2.2 nível AA** como régua objetiva, tratando cada achado acima. Sem redesenhar a interface — ajustar tokens, atributos ARIA, foco e um punhado de estilos globais.

---

## Escopo

### Dentro do escopo

- **Foco visível global:** um `:focus-visible` consistente (anel âmbar de ≥2px com offset) em [globals.css](../../../apps/web/src/app/globals.css), aplicado a todos os interativos; remover o `focus:outline-none` "seco" da caixa de texto do jogo (ou substituí-lo por um anel real).
- **Contraste AA:** subir os cinzas de texto pequeno até ≥4.5:1 (texto normal) e ≥3:1 (texto grande ≥18px/negrito ≥14px) nos dois temas — labels, texto secundário, placeholders, rótulos de etapa. Regra aplicada em hub, wizard e ficha.
- **Narração anunciada:** `aria-live="polite"` (ou `role="log"`) no container de mensagens da `GameView`; erros com `role="alert"`; rolagens e mudança de HP anunciadas de forma discreta.
- **Nomes acessíveis:** `aria-label` no `ThemeToggle`; `aria-hidden` nos emojis decorativos (`⚔`, `☀`/`🌙` quando houver texto ao lado).
- **Landmarks + skip link:** `<main>` envolvendo o conteúdo de página (hub, wizard) e um link "Pular para o conteúdo" no topo do [layout.tsx](../../../apps/web/src/app/layout.tsx).
- **Movimento reduzido:** bloco `@media (prefers-reduced-motion: reduce)` que neutraliza `animate-pulse`/`transition` (loading, cursor de streaming) para quem pede menos movimento.
- **Labels de formulário:** rótulo visível persistente acima de cada input/textarea/select do wizard (mantendo o `aria-label`); placeholder deixa de ser o único rótulo.
- **`prefers-color-scheme`:** o default de tema respeita a preferência do sistema quando não há escolha salva.
- **Alvo de toque:** interativos pequenos (ex.: "Ver todos os personagens", `✕` de deletar) atingem alvo mínimo (≥24×24px, ideal 44×44px).

### Fora do escopo

- **Redesenho visual** ou nova identidade — é ajuste de acessibilidade sobre o layout atual.
- **WCAG AAA** (ex.: contraste 7:1 de corpo) — a régua desta US é **AA**.
- **CI de acessibilidade automatizada** (axe no pipeline, Lighthouse gate) — desejável, mas é story própria (ver Questões em aberto).
- **Auditoria de telas futuras** que ainda não existem (ex.: detalhe de personagem, kanban US-31) — cada uma acessível quando construída, seguindo o padrão fixado aqui.
- **Internacionalização / leitor de tela em outros idiomas** além do `lang="pt-BR"` já presente.

---

## Critérios de aceite

- [x] **Teclado:** todo interativo (links, botões, inputs, abas, trilha do wizard) é alcançável e operável só por teclado, com **foco visível** claro (anel de contraste ≥3:1, ≥2px) — nenhum `outline: none` sem substituto equivalente.
- [x] **Contraste:** nenhum texto visível fica abaixo de **4.5:1** (normal) ou **3:1** (grande) contra o próprio fundo, em **modo claro e escuro** — inclui labels, texto secundário, placeholders e rótulos de etapa.
- [x] **Narração:** ao chegar texto do mestre em streaming, um leitor de tela **anuncia** o conteúdo novo (região `aria-live`); erros são anunciados como alerta.
- [x] **Nomes:** o botão de tema tem nome acessível ("Mudar para modo claro/noturno"); emojis puramente decorativos não são lidos.
- [x] **Estrutura:** hub e wizard têm landmark `<main>`; existe um **skip link** "Pular para o conteúdo" como primeiro foco tabável.
- [x] **Movimento:** com `prefers-reduced-motion: reduce`, animações contínuas (pulses, cursor de streaming) **param**; nada essencial depende de movimento.
- [x] **Formulários:** cada campo do wizard tem **rótulo visível persistente**; nenhum campo usa placeholder como único rótulo.
- [x] **Tema:** sem escolha salva, o tema inicial respeita `prefers-color-scheme`.
- [x] **Alvo:** interativos têm alvo de toque ≥24×24px.
- [x] **Eval / regressão:** um teste automatizado de acessibilidade (ex.: `vitest` + `axe-core`/`jest-axe`) roda sobre `HomeHero`, `SetupWizard` e `GameView` e **não acusa violações** de regras AA de cor, nome, rótulo e ARIA; um teste dirige a `GameView` por teclado até enviar uma ação.

---

## Notas de implementação

- **Foco global:** em [globals.css](../../../apps/web/src/app/globals.css), algo como `:focus-visible { outline: 2px solid var(--focus, #d97706); outline-offset: 2px; border-radius: inherit }`. Trocar `focus:outline-none` da textarea da `GameView` por um anel `focus-visible:ring-2 focus-visible:ring-amber-500`.
- **Contraste:** subir `text-stone-400/500` de texto para `text-stone-600`/`stone-700` (claro) e `text-stone-300`/`stone-400` (escuro), validando cada par. Ferramenta: qualquer checker WCAG; alvo 4.5:1 texto pequeno. Cuidar de superfícies tintadas (`bg-stone-200`, `bg-amber-50`).
- **`aria-live`:** envolver a lista de mensagens da `GameView` com `aria-live="polite"` `aria-atomic="false"`; o placeholder de streaming atualiza dentro dela. Erros de conexão com `role="alert"`. Evitar spam: anunciar o turno final, não cada token, se o `polite` ficar tagarela.
- **Reduced motion:** bloco global `@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important } }` — padrão consagrado; o cursor `animate-pulse` para naturalmente.
- **Skip link + main:** no [layout.tsx](../../../apps/web/src/app/layout.tsx), primeiro filho do `<body>` um `<a href="#conteudo" className="sr-only focus:not-sr-only …">Pular para o conteúdo</a>`; envolver `{children}` em `<main id="conteudo">` (a `GameView` já tem `<main>` interno — evitar aninhar dois `main`: usar `<div id="conteudo">` na `GameView` e `<main>` no layout, ou vice-versa — um `<main>` por página).
- **Labels do wizard:** manter o `aria-label`, adicionar `<label>` visível acima (padrão da própria US — label acima, `gap-2`).
- **Reaproveitar o padrão da US-45:** abas já saíram acessíveis; usar o mesmo rigor (roving `tabIndex`, `aria-*`) como referência.
- **`prefers-color-scheme`:** ajustar o script inline de [layout.tsx](../../../apps/web/src/app/layout.tsx) para, sem `localStorage`, cair em `window.matchMedia('(prefers-color-scheme: dark)')`.

---

## Questões em aberto

1. **CI de acessibilidade?** Rodar `axe`/Lighthouse no pipeline pegaria regressões futuras automaticamente. Vale como story separada (fora do escopo) — aqui entra só o teste unitário de regressão.
2. **Tokens semânticos de cor?** Subir os cinzas caso a caso resolve agora, mas um conjunto de tokens (`--text-secondary`, etc.) com contraste garantido evitaria a próxima regressão. Considerar como refinamento após este passe.

---

## Referências no código

- `apps/web/src/app/globals.css` — sem `:focus-visible` nem `prefers-reduced-motion`; ponto de entrada dos estilos globais.
- `apps/web/src/app/layout.tsx` — `<body>` sem `<main>`/skip link; script de tema ignora `prefers-color-scheme`.
- `apps/web/src/components/ThemeToggle.tsx` — botão de tema sem `aria-label`.
- `apps/web/src/components/HomeHero.tsx` — contraste de texto secundário; emoji `⚔` sem `aria-hidden`; alvos pequenos.
- `apps/web/src/components/setup/SetupWizard.tsx` — placeholder como rótulo; rótulos de etapa `text-[10px]` de baixo contraste.
- `apps/web/src/components/game/GameView.tsx` — `focus:outline-none` na textarea; lista de mensagens sem `aria-live`; cursor `animate-pulse`.
