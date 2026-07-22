# US-66 — Todas as telas mobile-friendly (layout responsivo)

**Épico:** 4 — Onboarding e navegação
**Fase:** 2 — Qualidade da interface
**Status:** ✅ Implementada
**Depende de:** [US-46](./US-46-acessibilidade-wcag-aa.md) (passe de acessibilidade nas mesmas superfícies — padrão a espalhar) · [US-60](./US-60-web-em-producao-vercel.md) (o site já é público — é de celular que o jogador vai abrir)
**Relacionado:** [Direção Visual Anti-Slop](../02-design/direcao-visual-anti-slop.md) (passe irmão — trata a *aparência*; esta US trata o *layout responsivo*; escopos separados de propósito)
**Criada em:** 2026-07-22

---

## História

> **Como** jogador que abre o AI DM no celular,
> **quero** que todas as telas (hub, login, criação de personagem e mesa de jogo) se adaptem à largura do aparelho,
> **para que** eu crie um personagem e jogue de ponta a ponta sem zoom, corte de conteúdo, ou rolagem horizontal.

---

## Contexto e motivação

### O problema observado

O `apps/web` está público na Vercel (US-60) e o jogador chega por link — a maioria abre pelo **celular**. Mas a interface foi construída pensando em desktop: uma auditoria das superfícies mostra que a responsividade é **pontual e desigual**, não sistêmica.

Só a mesa de jogo tem breakpoints. Contagem de classes responsivas (`sm:`/`md:`/`lg:`) por componente:

- [GameView.tsx](../../apps/web/src/components/game/GameView.tsx) — **11** ocorrências (único que trata mobile).
- [HomeHero.tsx](../../apps/web/src/components/HomeHero.tsx) — **0**.
- [SetupWizard.tsx](../../apps/web/src/components/setup/SetupWizard.tsx) — **0**.
- [login/page.tsx](../../apps/web/src/app/login/page.tsx) — **0**.

Problemas concretos encontrados:

1. **Trilha de etapas do wizard esmaga em tela estreita.** A `<nav>` de progresso ([SetupWizard.tsx:227](../../apps/web/src/components/setup/SetupWizard.tsx)) põe **7 etapas lado a lado** com `flex-1` e rótulo `text-[10px]`. Num celular de 375px (com `max-w-md` + `p-4`, sobram ~343px úteis), cada rótulo ganha ~49px — "Atributos", "Background", "Perícias" não cabem: quebram linha ou estouram. Além de ser texto de 10px, abaixo do confortável (choca com o espírito da US-46).
2. **A ficha vira faixa horizontal apertada na mesa.** No mobile a `<aside>` da `GameView` colapsa para `flex md:flex-col` com `overflow-x-auto` ([GameView.tsx:383](../../apps/web/src/components/game/GameView.tsx)) — a ficha inteira (atributos em `grid grid-cols-3`, HP, perícias) vira uma tira que rola de lado no topo. Conteúdo denso espremido numa faixa; o jogador rola horizontalmente para ver a própria ficha.
3. **Altura da lista de mensagens é fixa e assume chrome de desktop.** O container de narração usa `style={{ maxHeight: 'calc(100vh - 120px)' }}` inline ([GameView.tsx:551](../../apps/web/src/components/game/GameView.tsx)). O `120px` é um chute do cabeçalho de desktop; no mobile a `aside` horizontal + a caixa de ação empurram o layout e o cálculo desalinha (área de rolagem sob a barra de digitação, ou sob a URL bar do navegador móvel que muda de altura).
4. **Títulos grandes sem escala.** `text-5xl`/`text-4xl` fixos no herói ([HomeHero.tsx:11](../../apps/web/src/components/HomeHero.tsx)) — grandes num aparelho estreito, sem `text-3xl sm:text-5xl` para respirar.
5. **Grids de coluna fixa.** `grid-cols-2` em Raça/Classe e Atributos ([SetupWizard.tsx:286](../../apps/web/src/components/setup/SetupWizard.tsx)) e `grid-cols-3` na ficha da mesa — nunca degradam para 1 coluna no aparelho mais estreito, arriscando corte/aperto dos campos.

### Por que a solução atual não basta

`max-w-md`/`max-w-lg` + centralização (o que o hub, o wizard e o login fazem hoje) resolve o **caso fácil**: um bloco estreito centralizado num viewport largo. Não resolve o **caso mobile**, onde a largura da tela é menor que o conteúdo interno — trilha de 7 colunas, grids de coluna fixa, ficha densa. Falta o passe de breakpoints que só a `GameView` recebeu, e generalizá-lo com o mesmo rigor da US-46 (que tratou o eixo acessibilidade nas mesmas três telas, mas não o eixo layout responsivo).

### A proposta

Um passe de **responsividade mobile-first** nas quatro superfícies (hub, login, wizard, mesa), com o **breakpoint mais estreito como base** (~360–375px) e o desktop como progressão. Sem redesenhar a identidade — ajustar layout, grids, tipografia fluida e a estratégia da ficha na mesa, tratando cada achado acima.

---

## Escopo

### Dentro do escopo

- **Trilha do wizard responsiva:** a `<nav>` de progresso deixa de espremer 7 rótulos; no mobile mostra a etapa atual de forma legível (ex.: só as barras + rótulo da etapa atual, ou "Etapa 3 de 7 — Atributos"), abrindo para a trilha completa a partir de `sm:`.
- **Ficha na mesa em mobile:** substituir a faixa horizontal por um **painel recolhível** (fechado por padrão, um toque para abrir — ver D1) em vez de `overflow-x-auto` numa tira. No desktop (`md:`) permanece a coluna lateral atual.
- **Altura da narração sem chute de chrome:** trocar o `calc(100vh - 120px)` inline por layout flex que preenche o espaço disponível (ex.: coluna flex com a lista em `flex-1 min-h-0` e a caixa de ação fora do fluxo de rolagem), robusto à URL bar móvel; considerar `100dvh` onde `100vh` for usado.
- **Tipografia fluida:** títulos e textos-chave escalam por breakpoint (ex.: `text-3xl sm:text-4xl md:text-5xl`) — sem títulos grandes demais no aparelho estreito.
- **Grids que degradam:** `grid-cols-2`/`grid-cols-3` ganham base de 1 coluna quando necessário (ex.: `grid-cols-1 sm:grid-cols-2`), garantindo que nenhum campo/atributo corte.
- **Sem rolagem horizontal de página:** nenhuma das quatro telas gera scroll horizontal em 360px de largura; conteúdo sempre dentro do viewport.
- **Alvos de toque no mobile:** interativos-chave mantêm alvo confortável (≥44×44px) também em telas pequenas — reaproveitando o que a US-46 já fez pontualmente ([HomeHero.tsx:161](../../apps/web/src/components/HomeHero.tsx) já usa `min-w-[44px] min-h-[44px]`).
- **Viewport meta explícito:** garantir `width=device-width, initial-scale=1` — via `export const viewport` no [layout.tsx](../../apps/web/src/app/layout.tsx) — em vez de depender só do default do Next.

### Fora do escopo

- **Redesenho visual** ou nova identidade — é adaptação de layout sobre o design atual. A troca de fonte, paleta, ícones, textura e imagem vive na [Direção Visual Anti-Slop](../02-design/direcao-visual-anti-slop.md); ordem sugerida: **primeiro esta US** (estrutura responsiva), **depois** o passe visual por cima.
- **App nativo / PWA instalável** (manifest, service worker, offline) — é story própria; aqui é só web responsiva.
- **Acessibilidade** (foco, contraste, `aria-live`, movimento reduzido) — já entregue pela US-46; esta US não a refaz, apenas não a regride.
- **Telas ainda inexistentes** (kanban US-31, detalhe de personagem) — cada uma responsiva quando construída, seguindo o padrão fixado aqui.
- **Otimização de imagem / performance mobile** (LCP, bundle) — desejável, mas não é o objeto desta US.

---

## Critérios de aceite

- [ ] **Sem scroll horizontal:** em 360px de largura, hub, login, wizard e mesa não produzem rolagem horizontal de página; todo conteúdo cabe no viewport.
- [ ] **Trilha do wizard legível:** num celular estreito, a trilha de progresso não sobrepõe nem trunca rótulos ilegíveis; a etapa atual é claramente identificável.
- [ ] **Ficha na mesa usável em mobile:** a ficha do personagem é acessível e legível no celular sem rolagem horizontal de uma tira; no desktop permanece a coluna lateral.
- [ ] **Narração ocupa o espaço certo:** a lista de mensagens preenche a altura disponível sem depender de um `calc` fixo de cabeçalho; a caixa de ação fica sempre visível e a área de rolagem não some sob a barra do navegador móvel.
- [ ] **Tipografia adaptada:** nenhum título estoura a largura no aparelho estreito; escala por breakpoint.
- [ ] **Grids degradam:** em 360px, nenhum grid corta ou espreme campos abaixo do usável.
- [ ] **Alvos de toque:** interativos-chave têm alvo ≥44×44px também no mobile.
- [ ] **Eval / regressão:** um teste automatizado renderiza `HomeHero`, `SetupWizard` e `GameView` num viewport estreito (ex.: `vitest` + jsdom com `window.innerWidth` de 360px, ou snapshot de classes responsivas) e **falha** se a trilha do wizard voltar a espremer 7 colunas fixas ou se a `aside` da mesa voltar ao `overflow-x-auto` sem alternativa mobile; verificação manual/`resize_window` cobre a ausência de scroll horizontal nas quatro telas em 360px.

---

## Notas de implementação

- **Mobile-first é o padrão do Tailwind:** classes sem prefixo valem para a menor largura; `sm:`/`md:` progridem para cima. O trabalho é definir a **base estreita** e adicionar os breakpoints — não o contrário.
- **Trilha do wizard:** o mais simples é manter as barras (`h-1`) sempre visíveis e esconder os rótulos no mobile (`hidden sm:block` no `<span>` de label), somando um rótulo único "Etapa {idx+1} de {steps.length} — {STEP_LABEL[step]}" acima. Preserva a navegação por clique e o `aria-current` da US-46.
- **Ficha na mesa:** a `aside` já é `md:flex-col` / `md:w-64` — falta o comportamento mobile decente. Opção leve: no `< md`, tornar a ficha um `<details>`/painel recolhível (ou reaproveitar o padrão de abas da US-45) em vez de `overflow-x-auto`. Evitar recriar um drawer do zero se um `<details>` acessível resolve.
- **Altura sem `100vh` fixo:** o padrão robusto é a página em `flex flex-col` com `min-h-dvh`, a lista de mensagens `flex-1 min-h-0 overflow-y-auto`, e a caixa de ação como irmã fora da área de rolagem — dispensa o `calc(100vh - 120px)`. `min-h-0` é o detalhe que faz o filho flex rolar em vez de empurrar.
- **`dvh` vs `vh`:** `100dvh` acompanha a URL bar móvel que aparece/some; `100vh` não. Trocar onde o corte de altura importa.
- **Reaproveitar padrões existentes:** US-45 (abas acessíveis) e US-46 (foco, alvos, contraste) já fixaram convenções — seguir, não divergir. `min-w-[44px] min-h-[44px]` já existe no [HomeHero.tsx](../../apps/web/src/components/HomeHero.tsx).
- **Verificação:** `resize_window` (preset `mobile` 375×812) no preview + navegar as quatro telas; conferir ausência de scroll horizontal e a trilha/ficha legíveis.

---

## Decisões (resolvidas)

- **D1 — Ficha na mesa: painel recolhível.** No `< md`, a ficha vira um painel recolhível (`<details>` ou equivalente acessível), **fechado por padrão** — um toque para abrir. Escolhido sobre a ficha empilhada (sempre visível) porque em tela pequena a narração é o conteúdo principal; a ficha é consulta pontual, não deve empurrar a história para baixo da dobra. No desktop (`md:`) permanece a coluna lateral atual.
- **D2 — Piso de 360px.** O breakpoint-alvo mínimo é **360px** de largura (cobre a maioria dos Androids). 320px (iPhone SE 1ª geração) fica fora — mais agressivo do que o público justifica agora. Todos os critérios de "sem scroll horizontal / grids degradam" são verificados a 360px.
- **D3 — Tipografia fluida: escalar caso a caso.** Resolver agora com breakpoints por elemento (`text-3xl sm:text-4xl md:text-5xl`), sem introduzir tokens/`clamp()` centralizados. Um conjunto de utilidades de tipografia fluida evitaria a próxima regressão, mas é refinamento — fica como candidato a story futura, não bloqueia esta US.

_Nenhuma questão em aberto remanescente._

---

## Referências no código

- `apps/web/src/components/setup/SetupWizard.tsx` — trilha de 7 etapas em `flex-1`/`text-[10px]`; grids `grid-cols-2`; zero breakpoints.
- `apps/web/src/components/game/GameView.tsx` — único com breakpoints; `aside` como faixa `overflow-x-auto` no mobile; `maxHeight: calc(100vh - 120px)` inline; `grid grid-cols-3` da ficha.
- `apps/web/src/components/HomeHero.tsx` — `text-5xl`/`text-4xl` fixos; zero breakpoints; já tem alvo de toque de 44px no `✕`.
- `apps/web/src/app/login/page.tsx` — `max-w-sm` centralizado; zero breakpoints.
- `apps/web/src/app/layout.tsx` — sem `export const viewport` explícito (depende do default do Next).
- `docs/sdlc/01-requisitos/US-46-acessibilidade-wcag-aa.md` — passe irmão nas mesmas superfícies (eixo acessibilidade); padrão de rigor a seguir.
