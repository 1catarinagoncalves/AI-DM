# Design System "Grimório Vivo" — AI Dungeon Master

**Atualizado em:** 2026-07-29
**Status:** ✅ Implementado nas quatro superfícies (login, hub, wizard, mesa)
**Relacionado:** [Direção Visual Anti-Slop](direcao-visual-anti-slop.md) (o *porquê* de cada escolha) · [US-46](../01-requisitos/US-46-acessibilidade-wcag-aa.md) (contraste, foco, movimento) · [US-66](../01-requisitos/US-66-telas-mobile-friendly.md) (responsividade) · [ADR 006](../../adr/006-deploy-custo-zero.md) (orçamento de peso)

> A [direção visual](direcao-visual-anti-slop.md) fixa a **intenção**. Este documento fixa o **contrato**:
> os tokens, as primitivas e as regras que qualquer tela nova tem de seguir para o app continuar
> a parecer um só produto.

---

## Regra de ouro

**Nenhuma tela escreve cor literal.** `bg-amber-600`, `text-stone-400`, `dark:bg-stone-900` estão banidos
do `apps/web/src`. Tudo passa pelos tokens de [globals.css](../../../apps/web/src/app/globals.css) e pelas
primitivas de [components/ui/dm.tsx](../../../apps/web/src/components/ui/dm.tsx). O motivo é operacional:
o app tem dois temas, e a paleta antiga obrigava a escrever cada cor duas vezes (`X dark:Y`) em cada
elemento — foi assim que a interface derivou para "coerente mas genérica" na auditoria anterior.

Se falta um token, **acrescenta-se um token** (nos dois temas, com o contraste verificado) — não se
escapa para a paleta do Tailwind.

---

## 1. Tokens de cor

Definidos em `:root` (claro) e `.dark` (escuro) e expostos ao Tailwind pelo bloco `@theme inline`.
O nome da utility segue o token: `--primary` → `bg-primary` / `text-primary` / `border-primary`.

| Token | Papel | Claro (pergaminho) | Escuro (mesa à noite) |
|---|---|---|---|
| `--background` | fundo da página | `oklch(0.95 0.018 85)` | `oklch(0.17 0.018 55)` |
| `--foreground` | texto corrente | `oklch(0.28 0.03 50)` | `oklch(0.9 0.02 75)` |
| `--card` | superfície elevada | `oklch(0.98 0.012 85)` | `oklch(0.22 0.022 55)` |
| `--sidebar` | coluna da ficha | `oklch(0.93 0.022 84)` | `oklch(0.2 0.02 55)` |
| `--primary` | **acento único** (CTA, foco, ativo) | `oklch(0.44 0.15 42)` | `oklch(0.68 0.16 55)` |
| `--ember` | brasa — só no gradiente do CTA e da barra de HP | `oklch(0.48 0.18 35)` | `oklch(0.62 0.19 45)` |
| `--accent` | rótulos de secção, ênfase secundária | `oklch(0.45 0.11 60)` | `oklch(0.72 0.15 70)` |
| `--parchment` | texto de maior ênfase (nomes, valores) | `oklch(0.24 0.035 50)` | `oklch(0.92 0.04 85)` |
| `--muted-foreground` | texto de apoio | `oklch(0.44 0.03 55)` | `oklch(0.72 0.03 70)` |
| `--destructive` | erro, deletar, HP crítico | `oklch(0.45 0.19 25)` | `oklch(0.68 0.17 25)` |
| `--success` | estado válido (orçamento fechado) | `oklch(0.45 0.12 150)` | `oklch(0.75 0.14 150)` |
| `--border` · `--input` | traço de moldura · traço de campo | `oklch(0.55 0.04 60 / 45%)` · `oklch(0.62 0.04 65)` | `oklch(0.4 0.05 60 / 45%)` · `oklch(0.3 0.03 55)` |
| `--ring` · `--focus` | anel de foco de teclado | `= --primary` | `= --primary` |
| `--gold` | reserva de destaque raro (ainda sem consumidor) | `oklch(0.52 0.12 75)` | `oklch(0.82 0.14 80)` |

**Um acento só.** Nenhum CTA usa cor diferente de `--primary`/`--ember`. Verde e vermelho aparecem
**apenas** quando comunicam estado real (orçamento fechado, HP baixo, erro) — nunca como decoração.

### Contraste medido (não estimado)

Medido no browser sobre os tokens compilados, com a fórmula WCAG 2.1 (sanidade: preto/branco = 21:1).
Todos os pares passam AA (4.5:1); a maioria passa AAA (7:1).

| Par | Claro | Escuro |
|---|---|---|
| `foreground` / `background` | 12.69 | 14.16 |
| `parchment` / `background` | 14.34 | 15.11 |
| `muted-foreground` / `background` | 6.81 | 7.71 |
| `muted-foreground` / `card` | 7.43 | 6.98 |
| `primary` (e `ring`) / `background` | 7.15 | 6.35 |
| `accent` / `background` | 6.68 | 7.49 |
| `destructive` / `background` | 6.96 | 6.16 |
| `success` / `background` | 6.07 | 9.06 |
| `primary-foreground` / `primary` | 7.80 | 6.35 |

Ao mexer num valor, **re-medir** antes de commitar. O `--muted-foreground` do escuro já foi subido de
`0.65` para `0.72` de lightness por causa disto.

---

## 2. Tipografia

Duas famílias, auto-hospedadas por `next/font` no [layout.tsx](../../../apps/web/src/app/layout.tsx)
(nunca `<link>` do Google Fonts).

| Família | Token | Onde |
|---|---|---|
| **Cinzel** (serif de display) | `--font-cinzel` → `font-serif` | títulos de tela, nome do personagem, valores da ficha, nome do sistema |
| **Geist** (sans) | `--font-geist` → `font-sans` | tudo o resto: corpo, narração, botões, rótulos, campos |

A escolha divergiu da direção original (`PP Editorial New`) por licença: Cinzel é livre, tem a voz de
lápide/grimório e resolve a questão em aberto nº 1 da [direção visual](direcao-visual-anti-slop.md).

**Regras:**
- Ênfase dentro de um título usa itálico/bold **da mesma família** — nunca injetar serif num título sans.
- `font-serif` nunca em texto corrido: cansa em bloco. Títulos, nomes e números — nada mais.
- Números de ficha usam `tabular-nums` para não dançar entre valores.
- Escala: título de tela `text-2xl sm:text-3xl`; corpo de narração `text-[15px] leading-relaxed`;
  UI `text-sm`; rótulo de secção `text-[11px] uppercase tracking-[0.15em]`.
- Campos de formulário usam `text-base sm:text-sm` — abaixo de 16px o iOS dá zoom ao focar.

---

## 3. Primitivas

Vivem em [components/ui/dm.tsx](../../../apps/web/src/components/ui/dm.tsx). Uma tela nova compõe estas;
não redesenha nenhuma.

| Primitiva | O que é | Notas |
|---|---|---|
| `SceneFrame` | moldura de cena: arte de fundo + scrim + vinheta + cabeçalho da marca | `<div>`, **nunca** `<main>` — o landmark vive no layout (US-46) |
| `Panel` | superfície emoldurada (`.dm-panel`) | a **única** unidade de card do sistema |
| `SectionTitle` | título de tela (serif + acento + `text-shadow-fantasy`) | um por tela |
| `SheetHeading` | rótulo de secção dentro de um painel | caixa alta, `text-accent`, tracking largo |
| `DmButton` / `dmButtonClass` | botão nas variantes `primary` \| `ghost` \| `danger` | a função é para quando o elemento tem de ser `<Link>` |
| `FieldLabel` | rótulo visível e persistente acima do campo | US-46: placeholder nunca é o único rótulo |
| `fieldClass(extra?)` | classe única de `input`/`select`/`textarea` | função, não componente — serve os três |
| `Logo` | marca (ícone `Swords` emoldurado) | substitui o emoji `⚔` |
| `cn(...)` | junta classes, ignora falsy | sem `clsx`/`tailwind-merge`: não há merge de conflito a resolver |

### Utilities CSS

| Classe | Efeito | Regra de uso |
|---|---|---|
| `.dm-panel` | gradiente + borda + anel + brilho interno + sombra tintada | sempre via `<Panel>` |
| `.dm-vignette` | `::after` que escurece as bordas | só no container `relative` da moldura de cena |
| `.text-shadow-fantasy` | glow do título sobre arte | **só** em título serif sobre cena — nunca em texto corrido |
| `.scrollbar-thin` | barra de rolagem discreta e tintada | qualquer região que rola por dentro |

A sombra do painel é **tintada ao fundo** (`--panel-drop`), nunca preto puro sobre claro.

---

## 4. Materialidade e layout

- **Um painel, não card-sobre-card.** Dentro de um `Panel`, agrupa-se com `divide-y divide-border` ou
  uma borda — não com outro card. Foi o tell nº 5 da auditoria.
- **Raio:** `--radius: 0.5rem`. `rounded-md` em controlos, `rounded-lg` em painéis, `rounded-full` em
  chips e barras. A bolha de ação do jogador é a exceção (`rounded-2xl rounded-br-sm` — forma de fala).
- **Coluna de leitura:** a narração vive em `max-w-3xl` centrado. Medida de linha ganha da largura do ecrã.
- **Fundo de cena por superfície:**

  | Tela | Arte | Scrim |
  |---|---|---|
  | `/login` | `gate-entrance.png` | `medium` |
  | `/` (hub) | `tavern.png` | `medium` |
  | `/setup` (wizard) | `tavern.png` | `heavy` |
  | `/setup` (aventura inicial) | `arboretum-moonlit.png` | `heavy` |
  | `/play` (mesa) | *sem arte* | — |

  Quanto mais texto a tela tem, mais escuro o scrim: legibilidade ganha sempre da atmosfera. A **mesa
  não tem arte de fundo** — é a tela de leitura longa, e ali qualquer imagem compete com a narração.

- **Peso das imagens.** As cenas são PNG de pixel art (~2 MB cada). São servidas por `next/image` com
  `fill`, `quality={60}` e `sizes="100vw"` — o Next redimensiona e converte, e o cliente recebe uma
  fração disso. `imageRendering: pixelated` preserva o look ao esticar. **Nunca** usar
  `background-image` numa cena: contorna o otimizador e paga o PNG inteiro (ADR 006).
  `next.config.ts` declara `images.qualities: [60]` (obrigatório a partir do Next 16).

- **Middleware.** O matcher exclui caminhos com extensão (`.*\..*`). Sem isso, o otimizador vai buscar
  `/scenes/*.png`, apanha o redirect de auth e devolve 400 "isn't a valid image".

---

## 5. Movimento

`MOTION_INTENSITY: 3`. A narração token-a-token já é o movimento-herói.

- Permitido: `transition-colors` / `transition-all` em hover e foco, `active:translate-y-px` nos botões,
  `animate-pulse` no cursor de streaming e nos estados de espera, `transition-[width]` na barra de HP.
- Proibido: parallax, scroll-hijack, entradas encenadas, qualquer animação decorativa.
- `prefers-reduced-motion: reduce` neutraliza tudo isto no `globals.css`. Não contornar.

---

## 6. Acessibilidade (invariantes da US-46 embutidas no sistema)

Estas regras não são recomendações — quebrá-las falha os testes de `a11y.test.tsx` e `responsive.test.tsx`.

- **Foco:** anel `:focus-visible` de 2px em `--focus`, com `outline-offset`. Não substituir por
  `box-shadow` (perde contraste sobre fundos tintados) nem remover.
- **Alvo de toque:** `min-h-[44px]` já vem no base do `DmButton`. Botões escritos à mão repetem-no.
- **Ícone é decoração.** Todo `lucide-react` leva `aria-hidden`; o nome acessível vem do texto ao lado
  ou de `aria-label` no botão. Um `<span>` puramente gráfico que precise de nome leva `role="img"` —
  `aria-label` num `<span>` sem papel é atributo proibido (axe: `aria-prohibited-attr`).
- **Rótulo persistente:** `FieldLabel` acima do campo. Placeholder é exemplo, nunca rótulo.
- **Landmark:** um `<main>` por página, no layout. `SceneFrame` é `<div>`.
- **Regiões vivas:** `role="log" aria-live="polite"` na narração; `aria-live` no HP; `role="status"` nos
  avisos de warm-up e edição.

### Iconografia

Uma família só: **lucide-react**, `strokeWidth` default, tamanhos `size-3`/`size-3.5`/`size-4`/`size-5`.
Zero emoji como ícone de UI (era o tell nº 2). Zero SVG desenhado à mão — a única exceção é a marca
do Google no login, que é logotipo de terceiro e por isso mantém as cores oficiais fora dos tokens.

---

## 7. Checklist de tela nova

1. Envolve em `SceneFrame` (com arte e scrim) ou usa `bg-background` liso se for tela de leitura longa.
2. Um `SectionTitle`; o conteúdo dentro de um `Panel`.
3. Campos com `FieldLabel` + `fieldClass()`; botões com `DmButton`.
4. Nenhuma cor literal — `grep -E "(amber|stone|slate|zinc|gray)-[0-9]"` no diff tem de vir vazio.
5. Ícones lucide com `aria-hidden`.
6. Testa nos dois temas (o `ThemeToggle` está sempre no canto) e a 375px de largura.
7. `pnpm test` e `pnpm typecheck` no `apps/web`.
