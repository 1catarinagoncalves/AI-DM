# US-269 — Acessibilidade do wizard: alvo da trilha, erros anunciados, foco na troca de etapa e texto pequeno

**Épico:** 4 — Onboarding e navegação
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
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

- [ ] O botão da trilha tem ≥44px de altura de área clicável em 375px de largura (medido, não presumido).
- [ ] Quando `createCharacter` ou `createAdventure` falha, o leitor de tela anuncia o erro e o erro está visível sem rolar.
- [ ] Ao avançar de etapa, o foco está no título da nova etapa e a página está no topo.
- [ ] `axe` sobre cada etapa (não só a inicial) sem violações — [a11y.test.tsx](../../../apps/web/src/components/a11y.test.tsx) já roda `SetupWizard`.
- [ ] Nenhum texto informativo do wizard abaixo de 12px.
- [ ] O carrossel não anuncia frase nova a cada 3 s.
- [ ] **Teste de regressão:** simula falha de `createCharacter` e afirma `role="alert"` com o texto de `setup.error.create`; simula troca de etapa e afirma `document.activeElement` = título da etapa.

---

## Notas de implementação

- Medir a trilha com `resize_window` (preset `mobile`) e `getBoundingClientRect` — hoje é inferência.
- Foco no título: `SectionTitle` precisa aceitar `ref`/`tabIndex` (ver [dm.tsx](../../../apps/web/src/components/ui/dm.tsx)) ou o título é envolvido por um wrapper focável.
- Foco na troca de etapa é o item mais fácil de errar: não roube o foco ao restaurar rascunho ([US-261](./US-261-rascunho-do-wizard-sobrevive-a-recarregar.md)) nem na montagem.

---

## Questões em aberto

1. **Onde vive o erro de `handleConfirm`?** No rodapé (junto do botão) ou no topo com rolagem? Rodapé é mais simples; topo mantém o padrão atual do `Panel`.
2. **US-204 antes?** Se os chips substituírem a trilha, o item 1 some daqui. Recomendação: este item pequeno entra independente (é padding), a US-204 herda.

---

## Referências no código

- [SetupWizard.tsx](../../../apps/web/src/components/setup/SetupWizard.tsx) — trilha (:1243-1265), `errorBox` (:1207, :1280), label órfão (:1649)
- [CatalogCardGroup.tsx](../../../apps/web/src/components/setup/CatalogCardGroup.tsx) — texto de 10–11px (:23-26)
- [AdventureLoadingScreen.tsx](../../../apps/web/src/components/setup/AdventureLoadingScreen.tsx) — `aria-live` (:56)
- [a11y.test.tsx](../../../apps/web/src/components/a11y.test.tsx) — axe sobre o wizard
