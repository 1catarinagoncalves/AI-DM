# Direção Visual Anti-Slop — AI Dungeon Master

**Atualizado em:** 2026-07-22
**Status:** 📋 Proposta (direção fixada; implementação não iniciada)
**Relacionado:** [US-46](../01-requisitos/US-46-acessibilidade-wcag-aa.md) (vitórias de acessibilidade a preservar) · [US-66](../01-requisitos/US-66-telas-mobile-friendly.md) (responsividade — passe irmão, escopo separado) · [ADR 005](../../adr/005-locale-como-dimensao.md) (bilíngue PT/EN)

> Direção de arte para o redesign visual das quatro superfícies (hub, login, wizard de criação, mesa de jogo).
> **Objetivo:** sair do look "app de fantasia AI-default" para uma identidade própria, sem regredir acessibilidade nem reescrever a arquitetura de informação.

---

## Leitura do brief

Isto é um **redesign de app-produto**, não uma landing page. As superfícies dividem-se por natureza, e a direção aplica-se de forma diferente a cada uma:

| Superfície | Natureza | Alcance deste redesign |
|---|---|---|
| **Hub** (`page.tsx` / `HomeHero`) + **Login** | quase-landing | Total: hero, tipografia, imagem, composição |
| **Wizard** de criação (`SetupWizard`) | formulário multi-etapa | Só linguagem visual: fonte, cor, ícone, materialidade, textura |
| **Mesa** (`GameView`) | UI de produto / chat | Idem — linguagem visual, **não** recomposição de layout |

O wizard e a mesa **não** são tratados como landing. Recebem o mesmo *sistema* (fonte, paleta, ícones, textura), mas o layout deles é responsabilidade da [US-66](../01-requisitos/US-66-telas-mobile-friendly.md), não deste documento.

**Modo:** Redesign-Overhaul do *visual*, preservando IA, rotas, copy e acessibilidade.

**Diais de direção** (adaptados a app-produto, não a landing):

- `DESIGN_VARIANCE: 5` — produto quer previsibilidade legível, não caos artístico.
- `MOTION_INTENSITY: 3` — a narração em streaming já é o movimento-herói; acessibilidade sensível a movimento.
- `VISUAL_DENSITY: 4` — a mesa é naturalmente densa (ficha + narração).

---

## Auditoria do estado atual

A interface é coerente e funcional, mas **genérica** — o "app de fantasia AI-default". Tells concretos encontrados:

1. **Fonte-sistema default.** [layout.tsx](../../../apps/web/src/app/layout.tsx) **não usa `next/font`**; a app roda na sans-serif de sistema do Tailwind. Zero identidade tipográfica — é a maior parcela do "cheiro de template".
2. **Emoji como ícone de UI.** `⚔` (hub e mesa), `☀`/`🌙` ([ThemeToggle](../../../apps/web/src/components/ThemeToggle.tsx)), `✕`/`−`/`+` (wizard, hub). Emoji-como-ícone é um tell clássico.
3. **Zero imagem, zero atmosfera.** Nenhuma arte ou textura em nenhuma tela. Num RPG narrativo, ausência de atmosfera é o tell *central* do género.
4. **Paleta âmbar+stone default.** Coerente, mas é *o* reach automático para fantasia. `bg-amber-600` arredondado + card `bg-white/50 dark:bg-stone-900/50` = estética Dribbble-fantasia.
5. **Materialidade box-in-box.** `rounded-lg` uniforme, borda stone, sem hierarquia real de elevação; card sobre card.

### A preservar (não regredir)

Vitórias da [US-46](../01-requisitos/US-46-acessibilidade-wcag-aa.md) e contratos estáveis:

- Anel de foco `:focus-visible` (`#d97706`, ≥2px), skip link, contraste AA nos dois temas.
- `@media (prefers-reduced-motion: reduce)`, alvos de toque ≥44px, atributos ARIA (`aria-live`, `aria-label`, abas da US-45).
- Rotas / slugs, ordem e nomes de campos do wizard (autofill + analytics), default dark + `prefers-color-scheme`, voz de copy em PT.

---

## Direção por alavanca

Ordem de risco/retorno (menor risco, maior ganho primeiro).

### 1. Tipografia — o maior ganho

Matar a fonte-sistema via `next/font`. Um RPG narrativo tem uma voz: um mestre a *contar uma história*. A tipografia carrega isso.

**Direção fixada — "grimório vivo":** este é o caso raro em que um serif de display é justificado (brief genuinamente editorial / manuscrito / heritage). Regra dura: **não** `Fraunces` nem `Instrument_Serif` (os dois serifs-favoritos-de-LLM). Da pool sancionada:

- **Títulos + narração do mestre:** `PP Editorial New` (1ª escolha) ou `GT Sectra Display`.
- **Corpo / UI / botões / labels:** sans limpo — `Geist` (1ª escolha) ou `Söhne`.
- **Números (HP, atributos, rolagens, nível):** mono — `Geist Mono`. Dá peso de "ficha de personagem" aos valores.

**Alternativa considerada — "tabletop moderno":** grotesk de display (`Cabinet Grotesk` / `PP Neue Montreal`) sem serif nenhum. Mais seguro, menos "luz de vela". Rejeitada como primária por entregar menos identidade de género, mas é o fallback se o serif ficar difícil de licenciar/auto-hospedar.

**Regra de ênfase:** destacar uma palavra num título usa itálico/bold *da mesma família*, nunca injetar um serif solto num título sans (ou vice-versa). Em itálico de display com descendente (`y g j p q`), reservar `leading-[1.1]` + `pb-1` para não cortar.

### 2. Recalibração de cor (paleta travada)

Manter **dark-first** (encaixa no clima de mesa à noite). **Um único acento**, travado em todas as telas (nenhum CTA de cor diferente aparece na secção 7).

- **Base dark:** tinta profunda, nunca `#000` puro — o `stone-950` atual serve.
- **Base light:** pergaminho quente com leve tinta — **evitar** o beige-AI default puro.
- **Acento único — brasa/oxblood desaturado:** trocar o amber-glow por um tom de brasa (fogo de tocha), não néon. Dá calor sem o "glow AI".
- **Semântico:** vermelho destrutivo mantém-se; verde/estado só quando comunica estado real.

> Os valores hex exatos ficam por fixar como tokens (`--surface`, `--surface-elevated`, `--text-primary`, `--text-secondary`, `--accent`) na implementação, validando cada par contra WCAG AA — ver Questões em aberto.

### 3. Iconografia

Substituir **todo** emoji por uma família de ícones — `@phosphor-icons/react` (tem espada, lua, sol, x, dado). Uma só família, `strokeWidth` global consistente. Zero SVG desenhado à mão.

### 4. Materialidade + textura

O género pede atmosfera. Grão de pergaminho (light) / vellum-tinta (dark) numa camada `fixed inset-0 pointer-events-none z-[...]` — **nunca** num container que rola (repaint de GPU mata FPS no mobile). Reduzir box-in-box: agrupar com `divide`/borda em vez de card-sobre-card; sombras **tintadas ao fundo**, nunca preto puro sobre claro.

### 5. Imagem — o tell central por resolver

Introduzir arte real, enquadrada em proporções estáveis:

- **Hub / login:** arte de herói / atmosfera de entrada.
- **Wizard:** arte de classe/raça na etapa correspondente.
- **Mesa:** camada de atmosfera de cena atrás da narração (discreta, sob scrim para legibilidade).

Fonte: ferramenta de geração de imagem, ou `picsum.photos/seed/{descritivo}/{w}/{h}` como placeholder rotulado. Um RPG sem imagem não é minimalismo — é trabalho incompleto.

### 6. Movimento

Manter baixo (`MOTION 3`). A narração token-a-token já é o movimento principal. Entradas discretas em foco/hover de CTA; nada de scroll-hijack ou parallax. Honrar `prefers-reduced-motion` (já implementado).

---

## Fronteira com a US-66 (não confundir)

Este documento trata **como fica bonito** (fonte, cor, ícone, textura, imagem). A [US-66](../01-requisitos/US-66-telas-mobile-friendly.md) trata **como cabe no telemóvel** (breakpoints, trilha de etapas, ficha-em-faixa, altura da narração). São passes separados de propósito:

- A US-66 diz explicitamente "redesenho visual" fora de escopo — é aqui.
- Este doc diz "layout / responsividade" fora de escopo — é lá.

A ordem sugerida: **primeiro a US-66** (estrutura responsiva sólida), **depois este passe visual** por cima da estrutura já correta. Trocar a ordem faz repintar telas duas vezes.

---

## Questões em aberto

1. **Fonte serif: licença + auto-hospedagem.** `PP Editorial New` e `GT Sectra` são comerciais. Confirmar licença de webfont; se inviável, cair na alternativa grotesk (`Cabinet Grotesk`). Auto-hospedar via `next/font` (nunca `<link>` do Google Fonts em produção).
2. **Hex exatos do acento brasa/oxblood.** Fixar a rampa e validar contraste AA (texto e UI) nos dois temas antes de travar os tokens. O anel de foco atual (`#d97706`) pode precisar de reharmonização com o novo acento sem perder contraste.
3. **Custo de imagem no plano grátis.** Arte gerada/hospedada pesa em LCP e banda (Vercel Hobby, [ADR 006](../../adr/006-deploy-custo-zero.md)). Definir orçamento de peso e usar `next/image` com `priority` só no above-the-fold.
4. **Textura vs. legibilidade.** O grão não pode competir com o texto da narração; calibrar opacidade e testar com `prefers-reduced-transparency`.

---

## Referências no código

- `apps/web/src/app/layout.tsx` — sem `next/font`; ponto de entrada para registar a família tipográfica.
- `apps/web/src/app/globals.css` — tokens de cor e camada de textura entram aqui; já contém o foco/reduced-motion da US-46 a preservar.
- `apps/web/src/components/HomeHero.tsx` — emoji `⚔`, botões âmbar, cards `bg-white/50`; superfície-piloto sugerida.
- `apps/web/src/components/ThemeToggle.tsx` — emoji `☀`/`🌙` a trocar por ícones Phosphor.
- `apps/web/src/components/setup/SetupWizard.tsx` · `apps/web/src/components/game/GameView.tsx` — recebem o sistema visual, não recomposição (essa é a US-66).
