# US-269 — Acessibilidade do wizard: alvo da trilha, erros anunciados, foco na troca de etapa e texto pequeno

**Épico:** 4 — Onboarding e navegação
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** [US-46](./US-46-acessibilidade-wcag-aa.md) (✅ — régua WCAG 2.2 AA) · [US-66](./US-66-telas-mobile-friendly.md) (✅ — alvo ≥44px, trilha mobile)
**Relacionada a:** [US-204](./US-204-wizard-em-duas-colunas-com-ficha-viva.md) (📋 — troca a trilha por chips; se entrar antes, o item da trilha é atendido lá) · [US-265](./US-265-tela-de-espera-do-mundo-nao-diz-o-que-acontece-ao-sair.md) · [US-268](./US-268-atribuir-bonus-de-origem-e-raca-com-controle-explicito.md) (alvo do selo de +1)
**Criada em:** 2026-09-18
**Origem:** crítica de design do fluxo de criação (2026-09-18), lida do código. Alvos e tamanhos são **inferidos das classes CSS**, não medidos no navegador; o contraste `muted-foreground` foi medido em [design-system.md](../02-design/design-system.md) (6.81 claro, 7.71 escuro) e passa AA.

---

## História

> **Como** jogadora que usa teclado, leitor de tela ou celular,
> **quero** navegar pelas etapas, ouvir os erros e não perder o foco quando a etapa muda,
> **para que** criar um personagem funcione sem depender de mouse e de boa visão.

---

## Contexto e motivação

### O problema observado

1. **Alvo da trilha.** No mobile, cada botão da trilha contém só uma barra `h-0.5` (o rótulo é `hidden sm:block`, [SetupWizard.tsx:1259](../../../apps/web/src/components/setup/SetupWizard.tsx)) — altura próxima de 2px. A [US-66](./US-66-telas-mobile-friendly.md) manteve as barras de propósito, mas pede ≥44px para "interativos-chave".
2. **Erro sem anúncio, longe do botão.** `errorBox` ([:1207](../../../apps/web/src/components/setup/SetupWizard.tsx)) não tem `role="alert"` nem `aria-live` e aparece no topo do painel; o botão que falhou (revisão, "Criar personagem") está no rodapé de uma tela longa. Não encontrei `role="alert"` em nenhum arquivo não-teste de `apps/web/src` (grep literal), embora a [US-46](./US-46-acessibilidade-wcag-aa.md) liste "erros anunciados como alerta" como cumprido — **verificar** se o critério foi atendido de outro jeito.
3. **Foco e rolagem na troca de etapa.** Nenhum `scrollTo` nem `.focus()` no arquivo (grep). Ao clicar em "Próximo", o foco fica no botão (agora no meio de outra tela) e a página não volta ao topo.
4. **`<label>` órfão** na linha de atributos ([:1649](../../../apps/web/src/components/setup/SetupWizard.tsx)): sem `htmlFor` e sem controle associado.
5. **Texto de 10–11px** carregando informação: kicker de cartão (`text-[10px]`), bônus "+2 Destreza" (`text-[11px]`, [CatalogCardGroup.tsx:23-26](../../../apps/web/src/components/setup/CatalogCardGroup.tsx)), selos. O contraste passa; o tamanho é o problema (legibilidade, não critério AA).
6. **Carrossel de espera** com `aria-live="polite"` trocando a cada 3 s ([AdventureLoadingScreen.tsx:56](../../../apps/web/src/components/setup/AdventureLoadingScreen.tsx)): um leitor de tela fala uma frase nova a cada 3 s por até cinco minutos.

---

## Escopo

### Dentro do escopo

- Área de toque da trilha ≥44px de altura (padding no botão, mantendo a barra visual fina).
- `role="alert"` no `errorBox`; ao definir `error`, rolar até ele (ou renderizá-lo junto ao rodapé).
- Ao mudar de etapa: rolar ao topo do painel e mover o foco para o título da etapa (`tabIndex={-1}`), **exceto** na montagem inicial.
- Linha de atributo como `role="group"` com `aria-labelledby`; o `<label>` órfão vira texto.
- Texto que carrega informação sobe para ≥12px (kicker, bônus, selos).
- Carrossel de espera: anunciar só uma vez ("Preparando sua aventura") e trocar as frases sem `aria-live`.

### Fora do escopo

- **Alvo do selo de +1** (~18px) — resolvido na [US-268](./US-268-atribuir-bonus-de-origem-e-raca-com-controle-explicito.md), que troca o controle.
- **Recolorir tokens.** Contraste medido passa; não mexer.

---

## Critérios de aceite

- [x] O botão da trilha tem ≥44px de altura de área clicável em 375px de largura. **Medido** no navegador (24/09/2026, `getBoundingClientRect`, 1ª etapa, onde a trilha tem 10 botões): 44px de altura, barra visual de 2px, **27px de largura** — a largura não chega a 44 (a trilha divide 343px entre todas as etapas), mas passa o mínimo de 24px do WCAG 2.5.8 (AA). Com o sistema escolhido a trilha passa a 9 botões (~31px, calculado: (343 − 8×8) ÷ 9).
- [x] Quando `createCharacter` ou `createAdventure` falha, o leitor de tela anuncia o erro e o erro está visível sem rolar (`role="alert"` no rodapé, colado ao botão que falhou).
- [x] Ao avançar de etapa, o foco está no título da nova etapa e a página está no topo. Medido: rolagem em 2747px antes de "Próximo" → `scrollY` 0 e `document.activeElement` = `<h1>` depois.
- [x] `axe` sobre cada etapa (não só a inicial) sem violações — [SetupWizard.a11y.test.tsx](../../../apps/web/src/components/setup/SetupWizard.a11y.test.tsx) percorre da escolha do sistema até o mundo. O `a11y.test.tsx` original segue só na inicial.
- [x] Nenhum texto informativo do wizard abaixo de 12px.
- [x] O carrossel não anuncia frase nova a cada 3 s.
- [x] **Teste de regressão:** falha de `createCharacter` afirma `role="alert"` com o texto de `setup.error.create`; troca de etapa afirma `document.activeElement` = título da etapa.

---

## Notas de implementação

- **Erro no rodapé, não no topo** (decide a *Questão em aberto* nº 1). O `errorBox` saiu do topo do `Panel` e foi para o rodapé, antes do "Voltar/Próximo", com `role="alert"`. Trocar de etapa apaga o erro (`changeStep`): antes ele ficava velho no topo da etapa anterior.
- **Foco na troca de etapa** vive em `changeStep` (`SetupWizard.tsx`): um `ref` marca "a jogadora pediu a troca" e um efeito de `step` faz `scrollTo(0, 0)` + `.focus()` no `<h1>` do contêiner da etapa. `Próximo`, `Voltar`, trilha, `goTo`, escolha do sistema e o salto para `world` passam por ele; **`restoreDraft` (US-261) e a montagem usam `setStep` cru** — não roubam o foco. O `SectionTitle` ganhou `tabIndex={-1}` (sem `ref`: o título mora em nove ramos condicionais, e um `querySelector('h1')` no contêiner é uma linha) e `globals.css` apaga o anel só nele, como já fazia com `<main>`.
- **Trilha:** `min-h-[44px] justify-center` no botão; a barra `h-0.5` segue fina. Não mexi no `gap` — com 10 etapas a largura nunca chegaria a 44px de qualquer jeito.
- **Linha de atributo:** o `<label>` órfão virou `<span id>` e a linha é `role="group"` com `aria-labelledby`. Os testes que localizavam a linha por `getByText(..., { selector: 'label' })` agora usam `getByRole('group', { name })`.
- **Texto ≥12px:** `text-[10px]`/`text-[11px]` → `text-xs` em `SetupWizard`, `CatalogCardGroup`, `SheetHeading` (`dm.tsx`) e `FeaturesPanel` (badges de origem/nível, montado dentro do wizard). `SheetHeading` também é usado na ficha do jogo (`GameView`): lá o rótulo sobe 1px junto. Um teste lê o fonte desses arquivos e falha em qualquer `text-[9–11px]`, porque o walk de axe usa um config enxuto e não renderiza todos os ramos.
- **Carrossel:** o `<p>` do carrossel perdeu o `aria-live`; uma região `role="status"` só-leitor recebe "Preparando sua aventura" (`setup.world.loading.announce`) num efeito pós-montagem. O aviso de demora da US-265 continua `aria-live="polite"` (aparece uma vez).
- **Achado que não estava na US — `heading-order`.** Ao rodar o axe na etapa `class` com classe escolhida, `SheetHeading` era `<h3>` logo abaixo do `<h1>`, sem `h2` no meio. A US-46 só rodava o axe na 1ª etapa e nunca viu isso. `SheetHeading` virou `<h2>`.
- **O item 2 do contexto se confirma, e a classe do defeito era maior.** `role="alert"` só existia em `AdventureReadinessNotice`. Além do `errorBox`, ficavam mudos três textos de erro: catálogo de sistemas do wizard (`setup.system.error`) e, no hub, `home.error.load` e `home.error.delete` (`HomeHero.tsx`). Os três ganharam `role="alert"` com teste de regressão. O erro de conexão da `GameView` (`game.error.connect`) entra na lista de mensagens, que já é `aria-live="polite"` — falado, sem mudança.

---

## Questões em aberto

Nenhuma. As duas originais: (1) o erro de `handleConfirm` vive no rodapé (ver *Notas*); (2) a US-204 não entrou antes — o item da trilha entrou aqui como padding e a US-204 herda.

---

## Referências no código

Verificadas em 24/09/2026.

- [SetupWizard.tsx](../../../apps/web/src/components/setup/SetupWizard.tsx) — `changeStep` (:1022), trilha (:1399-1420), contêiner da etapa (:1448), linha de atributo (:1853), erro no rodapé (:2520)
- [CatalogCardGroup.tsx](../../../apps/web/src/components/setup/CatalogCardGroup.tsx) — texto de 12px (:34-42)
- [AdventureLoadingScreen.tsx](../../../apps/web/src/components/setup/AdventureLoadingScreen.tsx) — região `role="status"` e carrossel sem `aria-live` (:73-74)
- [SetupWizard.a11y.test.tsx](../../../apps/web/src/components/setup/SetupWizard.a11y.test.tsx) — axe por etapa, foco, erro, texto pequeno
- [a11y.test.tsx](../../../apps/web/src/components/a11y.test.tsx) — axe sobre o wizard (só a etapa inicial)
