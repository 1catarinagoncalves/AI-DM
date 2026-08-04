# US-107 — Sair da criação ou da mesa e voltar ao hub de personagens

**Épico:** 4 — Onboarding e navegação
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** [US-98](./US-98-i18n-da-interface-web.md) — texto novo nasce no dicionário, não no JSX; o gate da [US-102](./US-102-gate-de-string-literal-no-jsx.md) reprova o contrário.
**Relacionada a:** [US-26](./US-26-criacao-personagem-em-etapas.md) (é ela que desenha a trilha e o rodapé *Voltar/Próximo* do wizard), [US-30](./US-30-deletar-personagem.md) e [US-61](./US-61-login-do-jogador.md) (o hub que é o destino), [US-66](./US-66-telas-mobile-friendly.md) (alvo de toque de 44px e a faixa de controlos fixos no topo direito, que restringe onde o controlo pode ficar no mobile), [US-46](./US-46-acessibilidade-wcag-aa.md) (nome acessível do controlo).
**Criada em:** 2026-08-04

---

## História

> **Como** jogador que está a criar um personagem ou numa mesa com o Mestre,
> **quero** um caminho visível de volta ao hub de personagens,
> **para que** eu possa trocar de personagem, começar outra criação ou apagar uma ficha sem editar a URL nem recarregar a página.

---

## Contexto e motivação

### O problema observado

As duas telas são becos sem saída dentro da própria interface. Verificado em 04/08/2026:

| Tela | Controlos de navegação que existem | Caminho de volta ao hub |
|---|---|---|
| `/setup` — [`SetupWizard.tsx`](../../../apps/web/src/components/setup/SetupWizard.tsx) | rodapé *Voltar/Próximo* (`:521`) e trilha de etapas (`:270`) | **nenhum.** O *Voltar* anda entre etapas (`back()`, `:154`) e some na primeira: o bloco inteiro está sob `step !== 'system'` (`:521`) |
| `/play/[adventureId]` — [`GameView.tsx`](../../../apps/web/src/components/game/GameView.tsx) | nenhum. `grep` por `Link`/`useRouter`/`href=` no arquivo dá **zero** ocorrências de navegação | **nenhum** |

O único controlo global das duas telas é o *Sair* da [`AuthNav.tsx`](../../../apps/web/src/components/AuthNav.tsx), que faz `signOut({ redirectTo: '/login' })` — encerra a sessão. Quem quer só trocar de personagem tem de sair da conta e entrar outra vez, ou saber escrever `/` na barra de endereços.

O botão *voltar* do navegador cobre parte dos casos, mas não o caso normal: no wizard ele desfaz uma etapa de rota, não de estado (o `step` vive em `useState`, `:71`, não na URL), e quem entra na mesa por link direto ou por recarregar a página não tem histórico para onde voltar.

### Por que a solução atual não basta

O hub existe e é bom — [`HomeHero.tsx`](../../../apps/web/src/components/HomeHero.tsx) lista personagens, foca um, continua a aventura (`:126`), cria outro (`:137`) e apaga (`:141`). **Todas as saídas apontam para lá e nenhuma volta.** É uma árvore de navegação de sentido único: `/` → `/setup` → `/play/...` e fim.

Nada no código tenta cobrir isto — não é um mecanismo que ficou aquém, é um controlo que nunca foi desenhado. O `SceneFrame` ([`dm.tsx:145`](../../../apps/web/src/components/ui/dm.tsx)) tem cabeçalho de marca com `Logo` + `BrandName`, e o logo **não** é link em tela nenhuma; o `GameView` nem usa `SceneFrame` (layout próprio, `:484`).

### A proposta

Um controlo *Voltar ao hub* em cada uma das duas telas, apontando para `/`, em posição fixa (ver *Onde o controlo fica*). Sem rota nova, sem estado novo, sem diálogo de confirmação: nas duas telas nada por gravar se perde ao sair (ver *Questões em aberto* #1 para o único caso que precisa de medição).

---

## Onde o controlo fica

Três posições, uma por tela/breakpoint. **Nenhuma delas é condicional ao estado da tela** — o controlo não aparece e desaparece conforme a etapa do wizard ou a ficha aberta/fechada.

| # | Tela | Posição exata | Forma | Ponto de inserção |
|---|---|---|---|---|
| P1 | `/setup` (todos os breakpoints) | **Acima da trilha de etapas**, alinhado à esquerda, dentro da coluna `max-w-2xl` | `<Link href="/">` estilo *ghost*, ícone `ArrowLeft` + texto `setup.exit` | linha nova entre `<div className="mx-auto flex w-full max-w-2xl…">` e o `<nav>` ([`SetupWizard.tsx:264-270`](../../../apps/web/src/components/setup/SetupWizard.tsx)) |
| P2 | `/play/[id]` **desktop** (≥768px) | **Primeira linha do cabeçalho da ficha**, acima de `Logo` + nome + raça/classe, alinhado à esquerda | `<Link href="/">` *ghost*, `ArrowLeft` + texto `game.exit` | dentro do `<div className="hidden … md:block">` de [`GameView.tsx:507`](../../../apps/web/src/components/game/GameView.tsx), antes do `<div className="flex items-center gap-2.5">` |
| P3 | `/play/[id]` **mobile** (<768px) | **Extremo esquerdo da barra de toggle da ficha**, antes do nome do personagem | botão de ícone `ArrowLeft`, 44×44, só `aria-label={t('game.exit')}` | irmão do `<button>` do toggle em [`GameView.tsx:489`](../../../apps/web/src/components/game/GameView.tsx) — a barra passa a ser um `flex` com dois filhos |

```
P1 — /setup, qualquer etapa            P2 — /play desktop (sidebar 288px)
┌──────────────────────────────┐       ┌───────────────┬──────────────────┐
│ [logo] AI Dungeon Master     │       │ ← Voltar ao   │                  │
├──────────────────────────────┤       │   hub         │   narração       │
│ ← Voltar ao hub              │  ←P1  │ ─────────────  │                  │
│ ▁▁▁ ▁▁▁ ▁▁▁ ▁▁▁ ▁▁▁ ▁▁▁      │       │ [logo] Kaelen │                  │
│ sistema raça … revisão       │       │ Anão · Paladino│                 │
├──────────────────────────────┤       │ HP 12/12      │                  │
│  (etapa atual)               │       │ (abas)        ├──────────────────┤
│                              │       │               │ [ ação… ] [envia]│
│ [← Voltar]        [Próximo →]│       └───────────────┴──────────────────┘
└──────────────────────────────┘        ↑P2

P3 — /play mobile (375px)
┌─────────────────────────────────────┐
│ [←] Ficha de Kaelen  ⌄   [Sair][☾] │  ← [←] à esquerda; a faixa `pr-40`
├─────────────────────────────────────┤     da direita continua reservada
│ narração                            │     aos dois controlos fixos
```

**Por que estas e não outras:**

- **P1 acima da trilha, e não no rodapé.** Pôr no rodapé obriga o slot da esquerda a alternar entre *Voltar de etapa* e *Sair da criação* — dois destinos no mesmo pixel, que é exatamente a confusão que a story combate (é o que já acontece com o *Sair* do `AuthNav`). Acima da trilha o controlo tem lugar fixo, aparece nas seis etapas sem nenhuma condição nova, e o rodapé ([`:521`](../../../apps/web/src/components/setup/SetupWizard.tsx)) **não é tocado** — o `step !== 'system'` fica como está.
- **P2 acima da identidade, e não ao lado do `Logo`.** A linha `Logo` + nome + raça/classe já ocupa os 288px de `md:w-72`; enfiar um quarto elemento trunca o nome do personagem. Linha própria custa ~28px de altura numa coluna que rola.
- **P3 à esquerda, e não mais um `fixed` no canto.** O topo direito já tem dois controlos fixos posicionados por offset à mão (`right-16` e `right-4`, [US-66](./US-66-telas-mobile-friendly.md)); um terceiro exigiria recalcular os três e o `pr-40` da barra. O lado esquerdo está livre e não colide com nada.
- **Ícone sozinho só no P3.** É a única posição com orçamento de largura apertado. Nas outras duas o rótulo é visível, porque *voltar* com destino implícito é adivinhação.

---

## Escopo

### Dentro do escopo

- **Wizard (P1):** `<Link href="/">` acima da trilha, em todas as seis etapas. O rodapé *Voltar/Próximo* não muda.
- **Mesa (P2 + P3):** duas posições, porque o cabeçalho da ficha do desktop está sob `hidden md:block` e não existe no mobile. Ambas alcançáveis **sem abrir a ficha**.
- **Duas chaves novas nos dois dicionários** ([`pt-BR.ts`](../../../apps/web/src/messages/pt-BR.ts), [`en-US.ts`](../../../apps/web/src/messages/en-US.ts)), no padrão `setup.*` / `game.*` que já existe. Nome acessível no controlo de ícone (`aria-label`), não só o ícone.
- **Testes** nos arquivos que já cobrem as duas telas: [`SetupWizard.test.tsx`](../../../apps/web/src/components/setup/SetupWizard.test.tsx) e [`GameView.test.tsx`](../../../apps/web/src/components/game/GameView.test.tsx).

### Fora do escopo

- **Diálogo de confirmação ao sair.** Nada se perde: o wizard só grava no `handleConfirm` (`:184`, cria e só então navega), e a mesa persiste turno a turno na API ([US-18](./US-18-historico-servido-pela-api.md)). Confirmação para proteger nada é atrito. A única exceção possível está na *Questão em aberto* #1.
- **Trocar de personagem sem passar pelo hub** (seletor dentro da mesa). O hub já faz isso em dois cliques e é a tela desenhada para escolher — atalho é feature nova, não o buraco desta story.
- **Pôr o `step` do wizard na URL** para o *voltar* do navegador andar entre etapas. Resolve outro problema (histórico), custa serializar/validar estado na rota e não dá o caminho de saída que falta.
- **Fazer do `Logo` do `SceneFrame` um link global para `/`.** Parece a solução mais barata e não serve: o `GameView` não usa `SceneFrame`, e no `/login` o logo apontaria para uma tela que o [`middleware.ts`](../../../apps/web/src/middleware.ts) devolve ao login. Um controlo rotulado em duas telas é menos código do que um link global com duas exceções.
- **O estado sem `characterId`** de [`play/[adventureId]/page.tsx:24`](../../../apps/web/src/app/play/[adventureId]/page.tsx), que oferece `game.restart` → `/setup`. Já tem saída; que o destino melhor seja `/` é ajuste de uma linha para quem estiver no arquivo, não trabalho desta story.

---

## Critérios de aceite

- [x] **P1:** em `/setup`, nas **seis** etapas (incluindo `system`), existe acima da trilha um controlo com rótulo visível que leva a `/`. Entregue também na 7ª tela do wizard (o gancho pós-criação, `charId`) — ver *Notas*.
- [x] O rodapé do wizard não muda: *Voltar* continua a andar uma etapa para trás e continua ausente na etapa `system`. O bloco `step !== 'system'` não foi tocado.
- [x] **P2:** em `/play/[adventureId]` a ≥768px, o cabeçalho da ficha mostra o controlo com rótulo visível, e o nome do personagem continua sem truncar (linha própria, não disputa os 288px com o nome).
- [x] **P3:** a 375px, o controlo aparece à esquerda da barra de toggle e leva a `/` **com a ficha fechada** — o teste afirma que nenhuma das duas saídas está dentro de `#character-sheet`.
- [x] O controlo da mesa não se sobrepõe aos controlos fixos do topo direito (*Sair* em `right-16`, tema em `right-4`) nem ao nome/chevron do toggle: `pr-40` e `min-h-[76px]` mudaram do botão para a barra e continuam medidos em [`responsive.test.tsx`](../../../apps/web/src/components/responsive.test.tsx).
- [x] Nenhum `<button>` aninhado dentro de outro `<button>` na barra de toggle (o controlo é irmão, não filho) — e é `<a>`, não `<button>`, com teste dedicado.
- [x] Todo controlo novo tem alvo de toque ≥44px e nome acessível: P1/P2 herdam `min-h-[44px]` do `dmButtonClass`; o P3 traz `min-h-[44px] min-w-[44px]` + `aria-label`. `axe` sobre `GameView` e `SetupWizard` ([`a11y.test.tsx`](../../../apps/web/src/components/a11y.test.tsx)) continua sem violações.
- [x] Sair da mesa e voltar a entrar pelo hub reabre a aventura com o histórico intacto — a saída é navegação pura, não toca em nada da persistência (ver *Questões em aberto* #1).
- [x] Sair do wizard a meio **não** cria personagem nem aventura: `handleConfirm` continua o único ponto que chama `createCharacter`, coberto pelo teste *"cria o personagem uma única vez ao Confirmar"*.
- [x] Texto novo vem do dicionário nos dois idiomas: `pnpm i18n:literals` sai **0 achados nos quatro buckets** e o teste de paridade passa (`Voltar aos personagens` ≠ `Back to characters`, sem entrada de jargão).
- [x] **Eval / teste de regressão:** 3 casos novos — um em [`SetupWizard.test.tsx`](../../../apps/web/src/components/setup/SetupWizard.test.tsx) (saída na etapa 1, onde não há *Voltar*, e na etapa 2, onde há) e dois em [`GameView.test.tsx`](../../../apps/web/src/components/game/GameView.test.tsx) (as duas saídas com `href="/"` fora do painel recolhível; a do mobile irmã do toggle). Os três falharam antes da implementação; suíte do `apps/web` passou de 58 para **61 testes, todos verdes**.
- [ ] **Não verificado no navegador.** Todas as páginas estão atrás do `middleware` do Auth.js e o login é Google — não consigo abrir `/setup` nem `/play` sem a sessão da mantenedora. As três posições estão verificadas por teste (DOM + classes), não por captura de ecrã.

---

## Notas de implementação

- **P1 é uma linha nova, não uma edição do rodapé.** `<Link href="/">` com `dmButtonClass('ghost')` — o padrão do [`HomeHero.tsx:137`](../../../apps/web/src/components/HomeHero.tsx). `<Link>` e não `router.push` (o `useRouter` do wizard, `:4`/`:70`, é para a navegação pós-criação): link dá meio-clique, *abrir noutro separador* e foco de teclado de graça. Nada no rodapé (`:521`) nem no `back()` (`:154`) é tocado, então nenhuma etapa muda de comportamento.
- **P3, o aninhamento é a armadilha.** O toggle da ficha é um `<button>` ([`:489`](../../../apps/web/src/components/game/GameView.tsx)); o controlo de saída tem de ser **irmão** dele. `<button>` dentro de `<button>` é HTML inválido e o clique fica ambíguo. A barra passa a ser um wrapper `flex` com dois filhos, e o `min-h-[76px]`/`pr-40` do comentário de `:496` (que existe por causa dos controlos fixos da direita, US-66) muda de lugar para o wrapper — não some.
- **`ArrowLeft` já está importado** no wizard (`:524`); no `GameView` verificar o import de `lucide-react` antes de acrescentar.
- **Chaves:** `setup.exit` e `game.exit`. Escrever a de PT e a de EN no mesmo commit — valor idêntico nos dois dicionários derruba o teste de paridade da [US-102](./US-102-gate-de-string-literal-no-jsx.md).

### Como ficou (04/08/2026)

- **O rótulo não é "Voltar ao hub".** *Hub* é vocabulário interno: aparece em comentário nos dois dicionários e em **nenhum** texto de jogador (verificado por `grep`). Entregue como `Voltar aos personagens` / `Back to characters` — nomeia o destino, que é o que distingue esta saída do *Voltar* de rodapé. Os esboços acima mantêm a etiqueta curta por serem esboços.
- **P1 é uma expressão reutilizada, não duas cópias.** `const exitToHub = (…)` acima dos returns, usado no wizard **e** na 7ª tela (o gancho pós-criação, sob `if (charId)`). Essa tela não estava no levantamento inicial e é o mesmo beco: personagem já criado, e a única saída era *Iniciar aventura*. Custo de a cobrir: uma linha.
- **A barra do mobile virou wrapper e levou as medidas da US-66 consigo.** `md:hidden`, `min-h-[76px]` e `pr-40` saíram do `<button>` do toggle para o `<div>` que agora o contém junto com a saída. Isso reancorou **dois testes da [US-66](./US-66-telas-mobile-friendly.md)** em `responsive.test.tsx`, que afirmavam sobre `toggle.className`: passaram a afirmar sobre `toggle.parentElement`. A intenção (barra só-mobile, ≥60px de altura, `pr-40` de reserva) ficou intacta — nenhuma asserção foi relaxada.
- **P2 e P3 têm o mesmo nome acessível**, então `getAllByRole('link', …)` devolve 2 na árvore de teste (happy-dom não aplica CSS, logo `hidden`/`md:hidden` não escondem nada dele). O teste conta 2 de propósito: 1 significa que uma das posições se perdeu.
- **Não mexer no `AuthNav`.** *Sair da conta* e *sair da tela* são ações diferentes; juntá-las no mesmo canto é o que faz o jogador clicar em `signOut` para trocar de personagem — exatamente o defeito desta story.

---

## Questões em aberto

1. **Sair a meio do streaming perde o turno?** **Decidido por leitura do código, não por medição viva: não perde — e o controlo NÃO foi gateado por `streaming`.** A geração não está atada à ligação do cliente em nenhum ponto: `streamText` é chamada sem `abortSignal` (nenhuma ocorrência em [`ai.service.ts`](../../../apps/api/src/ai/ai.service.ts)), quem consome o `fullStream` é o laço do próprio servidor ([`ai.controller.ts:121`](../../../apps/api/src/ai/ai.controller.ts)), e `res.write` depois de o cliente desligar descarta em silêncio em vez de lançar. O `onFinish` corre e persiste ação + narração; ao voltar, o `getTurns` traz o turno. O que se perde é a **visualização** dos tokens, não o turno.

   **Ressalva honesta:** isto é o caminho de código, não um teste de ponta a ponta em produção (Vercel → Render), que exigiria uma sessão autenticada e uma chamada real ao provedor. Se algum dia se observar um turno desaparecido depois de sair a meio, o remédio mínimo continua a ser desativar a saída sob `streaming || warming` — a condição que já gateia os outros controlos ([`:829`, `:841`](../../../apps/web/src/components/game/GameView.tsx)) — e não um diálogo de confirmação.
2. **O `game.exit` do P3 precisa de rótulo curto próprio?** O P2 e o P3 partilham a chave, mas o P3 usa-a só como `aria-label` — se o texto do P2 crescer na tradução (*"Back to characters"*), continua a servir de nome acessível sem problema. Só vira questão se o desktop passar a querer um rótulo longo (*"Voltar à seleção de personagens"*): aí separam-se em duas chaves. Não separar antes disso.

---

## Referências no código

- [apps/web/src/components/setup/SetupWizard.tsx](../../../apps/web/src/components/setup/SetupWizard.tsx) — `:521` o rodapé sob `step !== 'system'`, `:154` o `back()` entre etapas, `:184` o único ponto que grava.
- [apps/web/src/components/game/GameView.tsx](../../../apps/web/src/components/game/GameView.tsx) — `:484` o layout próprio (sem `SceneFrame`), `:489` a barra de toggle do mobile, `:507` o cabeçalho da ficha no desktop.
- [apps/web/src/components/HomeHero.tsx](../../../apps/web/src/components/HomeHero.tsx) — o hub que é o destino; `:137` o padrão `<Link>` + `dmButtonClass` a copiar.
- [apps/web/src/components/AuthNav.tsx](../../../apps/web/src/components/AuthNav.tsx) — o *Sair* que hoje é confundido com sair da tela, e a razão do `pr-40` na barra do mobile.
- [apps/web/src/components/ui/dm.tsx](../../../apps/web/src/components/ui/dm.tsx) — `DmButton`/`dmButtonClass`/`SceneFrame` (`:145`, o cabeçalho de marca que o `GameView` não usa).
- [apps/web/src/messages/pt-BR.ts](../../../apps/web/src/messages/pt-BR.ts) e [apps/web/src/messages/en-US.ts](../../../apps/web/src/messages/en-US.ts) — onde as duas chaves entram.
