# US-207 — Atributos e perícias: orçamento visível, atributo principal e modificador na tela

**Épico:** 1 — Personagem
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** [US-204](./US-204-wizard-em-duas-colunas-com-ficha-viva.md) — o layout e a ficha
viva. [US-203](./US-203-prosa-de-catalogo-classe-e-raca.md) — o campo `primary`, única fonte do
selo `Principal`.
**Criada em:** 2026-09-01

**Relacionada a:**
- [backlog-redesenho-criacao-de-personagem.md](./backlog-redesenho-criacao-de-personagem.md) — o mapa.
- [US-27](./US-27-pericias-do-personagem.md) — o catálogo de perícias e o orçamento de proficiências.
- [US-123](./US-123-integracao-mecanica-background-pointbuy.md) — o `+1` da origem: linha fixa sólida, linha escolhida clicável. Continua exatamente assim.
- [US-131](./US-131-integracao-mecanica-background-proficiency.md) — as perícias da origem, escolhidas nesta etapa.
- [US-46](./US-46-acessibilidade-wcag-aa.md) — alvo de toque de 44 px nos botões de `+`/`−`, já respeitado hoje (`size-11`).

---

## História

> **Como** jogadora a distribuir pontos,
> **quero** ver quanto me resta, para que serve cada atributo na minha classe e qual modificador
> cada valor produz,
> **para que** eu distribua com intenção em vez de empurrar números até o contador zerar.

---

## Contexto e motivação

### O problema observado

A etapa `attributes` mostra seis linhas com `−  valor  +` e uma frase com o saldo. Não diz que
Força e Constituição importam para o bárbaro, nem que 14 dá `+2` e 15 dá o mesmo `+2` — a
informação que decide se vale gastar os dois últimos pontos. A etapa `skills` mostra uma contagem
no meio de uma frase, sem peso visual, e não mostra o modificador que cada perícia vai ter.

### Por que a solução atual não basta

- **O modificador já é calculado no arquivo** (`abilityModifier`, usado no preview da revisão e no
  PV inicial) e simplesmente não é mostrado onde a decisão acontece.
- **`primary` não existe hoje** — nem no config, nem no dataset (`primary_abilities` vem `[]` nas
  24 entradas de `CharacterClass.json`, verificado). Por isso o selo `Principal` depende da
  US-203; sem ela, esta story entrega o resto e o selo fica de fora.
- **O saldo e a contagem são texto corrido.** O protótipo usa selo (`Pontos restantes: 7 / 27`,
  `2 / 4 escolhidas`) que muda de cor ao fechar — o mesmo sinal, com peso proporcional à
  importância.
- **O `+1` da origem já tem desenho resolvido** (US-123: selo sólido na linha fixa, fantasma
  tracejado nas elegíveis). Esse desenho **fica**; o que muda é o que está à volta dele.

### A proposta

Cada atributo passa a ser uma linha com nome, selo `Principal` quando for da classe, valor total
(base + bônus de origem/raça) e o **modificador** por baixo. Saldo e contagem de perícias viram
selo. A etapa `skills` mostra o modificador resultante de cada perícia marcada.

---

## Escopo

### Dentro do escopo

- **Selo de orçamento** na etapa `attributes` (`Pontos restantes: X / Y`), com estado visual
  distinto quando chega a zero.
- **Selo `Principal`** nas linhas dos atributos que a classe escolhida lista em `primary`
  (US-203). Sem `primary` no catálogo, nenhuma linha o mostra e o resto da etapa não muda.
- **Modificador visível** por atributo, no formato de `formatModifier` (`+2`, `−1`), atualizado a
  cada clique.
- **Total explícito** = base + bônus da origem (US-123) — o número grande é o total, e o bônus
  aparece como `+1` ao lado, não somado em silêncio.
- **Selo de contagem** na etapa `skills` (`X / Y escolhidas`), com o mesmo tratamento visual do
  selo de pontos.
- **Modificador por perícia** na etapa `skills`, calculado com `buildSkillSheet` — a mesma função
  que a revisão e a ficha em jogo usam.
- **Enquadramento no padrão da US-204**: chamada, pergunta, frase de apoio, nas duas etapas.
- **i18n** dos textos novos nos dois locales.

### Fora do escopo

- **Mudar o point-buy.** `POINT_COST`, o orçamento vindo de `config.pointBuy.budget`, os limites
  `min`/`max` por atributo e o custo relativo ao default continuam idênticos. Esta story mostra o
  que já se calcula.
- **Mudar `canAdvance`** em qualquer das duas etapas.
- **Mudar o desenho do `+1` da origem** (US-123) ou o lugar onde a perícia da origem é escolhida
  (US-131).
- **Recomendar uma distribuição** ("sugerir para bárbaro"). O selo `Principal` informa; escolher
  continua com a jogadora.
- **Escolha do pacote de equipamento inicial** que o protótipo põe nesta etapa. O produto deriva o
  kit da classe (US-51); dar a escolher é mudança de regra (ver backlog).
- **Salvaguardas.** Não existem no config (verificado); dependem da story que traz
  `saving_throws` do dataset.

---

## Critérios de aceite

- [ ] A etapa `attributes` mostra um selo com pontos restantes sobre o orçamento, que muda de
      estado ao chegar a zero.
- [ ] Cada linha de atributo mostra o modificador correspondente ao **total** (base + bônus), no
      formato `+N`/`−N`, e ele muda ao clicar em `+`/`−`.
- [ ] Com uma classe cujo catálogo traga `primary`, as linhas correspondentes mostram o selo
      `Principal`; com um catálogo sem `primary`, nenhuma linha o mostra e nada mais muda.
- [ ] O selo do `+1` da origem continua com o comportamento da US-123: fixo sólido e não-clicável,
      escolhido sólido e clicável (clique desmarca), elegíveis com fantasma tracejado enquanto
      nada estiver escolhido.
- [ ] A etapa `skills` mostra um selo `X / Y escolhidas` e o modificador resultante de cada
      perícia; as perícias concedidas pela origem continuam fora do catálogo desta etapa (US-131).
- [ ] Os limites do point-buy continuam a valer: `+` desabilita ao esgotar o orçamento ou ao
      chegar ao máximo, `−` desabilita no mínimo, e o saldo nunca fica negativo.
- [ ] Os botões `+`/`−` continuam com alvo de toque de 44 px e `aria-label` que cita o atributo
      (US-46).
- [ ] **Eval / teste de regressão:** teste que leva um atributo de 13 a 15 e afirma (a) que o
      saldo cai 2 e depois 2 (o custo **não** é linear), (b) que o modificador mostrado passa de
      `+1` a `+2`, e (c) que `+` fica desabilitado quando o custo seguinte não cabe no saldo. É o
      teste que falha quando alguém, ao mostrar o modificador, passa a calcular o custo a partir
      dele em vez de a partir de `POINT_COST`.

---

## Notas de implementação

> Dicas, não especificação. Quem implementa pode divergir com justificativa.

- **`abilityModifier` e `formatModifier` já estão importados** no `SetupWizard`. Nenhuma conta
  nova nesta story — só renderizar o que já se calcula.
- **`buildSkillSheet` é a fonte do modificador de perícia**, não uma soma local: é a mesma função
  da ficha em jogo, e é o que impede a etapa de mostrar um número que a ficha depois contradiz.
- **O custo do point-buy é acumulado, não linear** (`13→14` e `14→15` custam 2). O selo mostra o
  saldo; o `disabled` do `+` continua a olhar para o **custo do próximo ponto**, como hoje.
- **O bônus da origem entra no total mostrado, não no `attrs` do estado.** É assim hoje (`bonus`
  somado só na renderização) e tem de continuar: o que a API recebe é a base, e o backend aplica o
  grant.
- **Selo é o mesmo componente** do `AbilityBonusBadge` já existente ou um irmão dele — não uma
  terceira forma de "pílula" na mesma tela.
- **Reduzir box-in-box:** as linhas de atributo estão agrupadas por `divide` de propósito
  ([direção visual](../02-design/direcao-visual-anti-slop.md) §4, comentário no código). O
  protótipo usa um cartão por atributo; aqui o `divide` fica.

---

## Questões em aberto

1. **O selo `Principal` aparece também na etapa `skills`**, marcando as perícias ancoradas num
   atributo principal da classe? Ajuda a escolher; arrisca sugerir que existe escolha "certa".
2. **Mostrar o custo do próximo ponto no botão `+`** (`+2`) quando o custo deixa de ser 1? É a
   informação que falta para entender por que o saldo caiu 2 — e é ruído nas quatro primeiras
   subidas, em que o custo é 1.

---

## Referências no código

- [`apps/web/src/components/setup/SetupWizard.tsx`](../../../apps/web/src/components/setup/SetupWizard.tsx) — `POINT_COST`, `setAttr`, `spent`/`remaining`, `AbilityBonusBadge`, e os blocos `step === 'attributes'` e `step === 'skills'`.
- [`packages/shared/src/ability.ts`](../../../packages/shared/src/ability.ts) — `abilityModifier`, `formatModifier`, `buildSkillSheet`.
- [`packages/shared/src/types/system.ts`](../../../packages/shared/src/types/system.ts) — `SystemAttributeSchema` (`min`/`max`/`default`) e `SystemSkillSchema` (`ability`): os limites e a âncora do modificador.
- [`scripts/srd/_data/CharacterClass.json`](../../../scripts/srd/_data/CharacterClass.json) — `primary_abilities` vazio nas 24 entradas: a razão de o selo `Principal` depender da US-203.
- [`docs/sdlc/02-design/direcao-visual-anti-slop.md`](../02-design/direcao-visual-anti-slop.md) — §4: por que as linhas de atributo continuam agrupadas por `divide`.
- [`wizard-criacao-personagem-referencia.html`](./wizard-criacao-personagem-referencia.html) — o protótipo: selos de pontos e de perícias, selo `Principal`, `mod` sob o total.
