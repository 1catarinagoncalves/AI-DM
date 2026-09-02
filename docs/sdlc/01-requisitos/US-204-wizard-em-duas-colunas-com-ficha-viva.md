# US-204 — Wizard em duas colunas: a ficha viva "Seu personagem" ao lado das etapas

**Épico:** 1 — Personagem
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** nenhuma. É a story de **esqueleto** do redesenho — as outras assumem este layout.
**Criada em:** 2026-09-01

**Relacionada a:**
- [backlog-redesenho-criacao-de-personagem.md](./backlog-redesenho-criacao-de-personagem.md) — o mapa; esta é a story que muda o chrome, e por isso vem antes das que mudam cada etapa.
- [US-26](./US-26-criacao-personagem-em-etapas.md) — a trilha de progresso que esta story substitui.
- [US-66](./US-66-telas-mobile-friendly.md) — o rótulo único "Etapa X de N" no telemóvel; a coluna nova tem de respeitar a mesma fronteira.
- [US-127](./US-127-revisao-espelha-ficha-completa.md) — o preview da revisão: a ficha viva é o **mesmo cálculo**, mostrado mais cedo.
- [US-107](./US-107-voltar-ao-hub-de-personagens.md) — a saída da criação, que continua acima da trilha.
- [US-46](./US-46-acessibilidade-wcag-aa.md) — foco, rótulo e contraste do chrome novo.
- [Design System](../02-design/design-system.md)/[direção visual anti-slop](../02-design/direcao-visual-anti-slop.md)
  — já ✅ implementados; esta story não escolhe cor nem fonte nova para a ficha viva, só a compõe
  com o que existe. O protótipo confirma o mesmo sistema (mesmos tokens `oklch`, mesma Cinzel,
  verificado ao vivo — ver *Identidade visual* no [backlog](./backlog-redesenho-criacao-de-personagem.md)).

---

## História

> **Como** jogadora a meio da criação,
> **quero** ver o personagem que estou montando enquanto escolho,
> **para que** eu perceba o efeito de cada escolha antes de chegar à revisão — e não descubra na
> última tela que a combinação não era o que eu queria.

---

## Contexto e motivação

### O problema observado

O wizard é uma coluna só (`max-w-2xl`), e o que já foi escolhido **desaparece da tela** assim que
a etapa passa. Na etapa `attributes` não há como ver que classe se escolheu; na `skills` não há
como ver os atributos que acabaram de ser distribuídos — e é exatamente aí que a escolha de
perícia importa. O primeiro momento em que as peças aparecem juntas é a etapa `review`, que é
tarde: corrigir dali custa voltar quatro etapas.

### Por que a solução atual não basta

- **A trilha de progresso** ([`SetupWizard.tsx`](../../../apps/web/src/components/setup/SetupWizard.tsx))
  são sete barras de `0.5px` com um rótulo pequeno por baixo. Diz **onde** você está, não **o
  que** você já decidiu.
- **O preview da revisão (US-127) já calcula tudo o que faria falta** — `buildSkillSheet`,
  `abilityModifier`, `getStartingInventory`, `resolveCharacterFeatures`, PV inicial — e é código
  que já vive dentro do componente. Só está renderizado num lugar só, no fim.
- **O `Panel`** (quase opaco, `--panel-top/bottom` a ~94% de alfa) embrulha o formulário inteiro.
  Enquanto o conteúdo for uma lista de campos, tudo bem; no momento em que as etapas passam a ser
  **grades de cartão** ([US-205](./US-205-escolha-por-cartao-classe-e-raca.md)), vira
  `Panel > cartão > conteúdo` — o box-in-box que a
  [direção visual](../02-design/direcao-visual-anti-slop.md) §4 manda reduzir.

### A proposta

Layout de duas colunas: as etapas à esquerda, uma **ficha viva** fixa à direita que acumula o que
já foi escolhido e mostra o que já dá para calcular. Trilha vira **chips numerados clicáveis**, o
título de cada etapa vira **pergunta**, e o rodapé ganha `Etapa X de 7` ao lado do botão de
avançar. No telemóvel a coluna direita colapsa para uma faixa resumida.

---

## Escopo

### Dentro do escopo

- **Grelha de duas colunas** a partir de `lg:`: etapa à esquerda (peso 2), ficha à direita
  (peso 1, `position: sticky`). Abaixo de `lg:` continua uma coluna.
- **Cartão "Seu personagem"**, presente em **todas as sete etapas**:
  - **monograma** com as iniciais de raça e classe enquanto não houver arte (o espaço da imagem
    fica reservado — ver *Fora do escopo*);
  - **nome** — `Sem nome ainda` enquanto vazio;
  - **linhas de escolha** — sistema, raça, classe, origem: aparecem à medida que são preenchidas,
    nunca como linha vazia com traço;
  - **números** — atributos com modificador, PV inicial e perícias proficientes, a partir da
    etapa `attributes` (antes disso não há o que mostrar, e mostrar `8 8 8 8 8 8` é ruído).
- **Um só cálculo, dois consumidores.** O bloco de preview que hoje vive dentro do `SetupWizard`
  (US-127) sai para um componente/hook próprio; a ficha viva e a revisão
  ([US-208](./US-208-revisao-em-forma-de-ficha.md)) leem dali. Se divergirem, é bug, não
  duplicação aceitável.
- **Trilha em chips numerados** (`1. Sistema`, `2. Raça e classe`, …) — etapa atual sólida,
  concluída clicável, pendente inerte. Mantém a regra da US-26: só se navega para trás.
- **Pergunta como título de etapa.** Cada etapa passa a ter três linhas de enquadramento: chamada
  em caixa alta (o que se está a fazer), pergunta como `SectionTitle`, e uma frase de apoio. As
  perguntas são as sete do protótipo, adaptadas às etapas do produto.
- **Rodapé com `Etapa X de 7`** entre o botão *Voltar* e o de avançar.
- **Mobile (US-66):** a ficha vira uma **faixa resumida** no topo (monograma + nome + raça/classe),
  expansível por `<details>`; o rótulo único `Etapa X de N — Label` continua.
- **`Panel` afinado no wizard.** Onde a etapa é grade de cartão, o cartão é a superfície e o
  `Panel` deixa de ser a moldura opaca — sem `Panel > cartão`.
- **i18n (US-98):** todo texto novo (perguntas, chamadas, rótulos da ficha, `Sem nome ainda`) é
  chave de mensagem nos dois locales.

### Fora do escopo

- **CA, deslocamento, sentidos e salvaguardas na ficha.** O protótipo mostra os quatro; o produto
  **não os calcula em lugar nenhum** — não há `armorClass`, `speed` nem `passivePerception` em
  `@ai-dm/shared` (verificado, 01/09/2026), e a classe de armadura tem backlog próprio
  ([backlog-classe-de-armadura-e-ataque.md](./backlog-classe-de-armadura-e-ataque.md)). A ficha
  mostra o que existe: atributos, modificadores, PV e perícias. Inventar números na tela de
  criação seria pior do que não os mostrar.
- **Retrato do personagem** (gerado ou carregado). O espaço fica reservado, preenchido pelo
  monograma. Ver *Fora do escopo* do backlog.
- **Mudar a ordem das etapas, ou criar/remover etapa.** É decisão de produto do backlog.
- **Mudar o conteúdo de cada etapa.** Esta story move e enquadra; quem redesenha o miolo é a
  US-205 a US-208.
- **Persistir o rascunho da criação.** A ficha viva é estado do componente, como hoje: recarregar
  a página continua a recomeçar. Story própria se um dia doer.

---

## Critérios de aceite

- [ ] Em `lg:` e acima, o cartão "Seu personagem" está visível nas sete etapas e acompanha a
      rolagem da coluna esquerda.
- [ ] Escolher raça, classe ou origem atualiza a ficha **na mesma interação**, sem avançar de
      etapa.
- [ ] Antes da etapa `attributes`, a ficha não mostra bloco de números; a partir dela, mostra
      atributos com modificador, PV inicial e perícias proficientes.
- [ ] Os valores da ficha e os da revisão saem da **mesma função** — mudar a fórmula de PV num
      lugar muda nos dois, e não existe um segundo `10 + conMod` no componente.
- [ ] A trilha mostra chips numerados; a etapa concluída navega ao ser clicada e a pendente não
      (regra da US-26 preservada), com `aria-current="step"` na atual.
- [ ] O rodapé mostra `Etapa X de 7` e o botão de avançar continua desabilitado exatamente
      quando `canAdvance` é falso — nenhuma regra de avanço muda nesta story.
- [ ] Abaixo de `lg:`, a ficha aparece como faixa resumida no topo e o layout não gera rolagem
      horizontal em 360 px de largura (US-66).
- [ ] Nenhum `Panel` embrulha uma grade de cartão (`Panel > cartão`) depois desta story.
- [ ] Todo texto novo tem chave em `pt-BR.ts` e `en-US.ts`; nenhuma string literal de UI no
      componente (US-98).
- [ ] Contraste AA no chip pendente e no texto secundário da ficha; a ficha é `<aside>` com
      rótulo acessível, não uma pilha de `<div>` (US-46).
- [ ] **Eval / teste de regressão:** teste em `SetupWizard.test.tsx` que escolhe raça e classe na
      etapa 2 e afirma que os rótulos aparecem na ficha **sem avançar de etapa**; e um segundo que
      afirma que o bloco de números não existe antes da etapa `attributes` e existe depois. O
      primeiro é o que quebra quando alguém volta a renderizar o resumo só na revisão.

---

## Notas de implementação

> Dicas, não especificação. Quem implementa pode divergir com justificativa.

- **Extrair o preview antes de mover qualquer coisa.** O bloco de `previewKit` / `previewFeatures`
  / `previewSpells` / `previewHp` / `reviewSkills` do `SetupWizard` é a ficha viva. Extrair para
  `useCharacterPreview(...)` (ou um módulo puro que recebe o estado) é o primeiro commit — a
  US-208 depende dele e o arquivo já passa de 1100 linhas, acima do teto de 500 do `AGENTS.md`.
- **A ficha é componente próprio** (`CharacterRail`/`LivePreviewCard`), não JSX inline: é o que
  torna possível renderizá-la em dois sítios (coluna e faixa mobile) sem duplicar.
- **`sticky top-…` na coluna direita, não `fixed`.** A textura do fundo é `fixed` (direção §4);
  uma segunda camada fixa a rolar por cima dela é o caminho para o repaint que essa mesma seção
  proíbe.
- **Reusar `optionCardClass`** para os chips e cartões — a materialidade já existe no componente,
  não inventar uma segunda.
- **As perguntas do protótipo servem quase todas.** `Como você enfrenta o perigo?` (classe) e
  `De onde vem o seu sangue?` (raça) caem numa etapa só no produto — precisam de uma pergunta
  guarda-chuva para `race-class`, e o protótipo não tem uma. É copy nova, não tradução.
- **Não tocar em `canAdvance`, `next`, `back` nem no array `steps`.** Eles operam por índice de
  propósito (comentário da US-123 no topo do arquivo); esta story não reordena nada.
- **Verificado ao vivo em 02/09/2026, não de memória:** a referência **não** esconde números —
  PV/CA/deslocamento e os seis atributos aparecem na coluna desde a etapa 1, com todo mundo em
  base 8. A regra "não mostrar `8 8 8 8 8 8`" **não vem do protótipo** — é decisão própria do
  produto, porque seis atributos idênticos sem contexto de classe/raça é ruído que a referência
  aceita e nós preferimos evitar. Não citar a referência como fonte desta regra em nenhum PR.

---

## Questões em aberto

1. **A ficha viva mostra features e magias da classe?** A revisão mostra (US-127), e no cartão a
   lista pode ficar longa. A proposta é mostrar só a contagem (`3 features · 2 truques`) e deixar
   o detalhe para a revisão. Decidir com a tela na frente.
2. **A faixa mobile fica fixa no topo ao rolar, ou rola com o conteúdo?** Fixa consome altura útil
   num formulário que já é comprido; rolar esconde a informação exatamente quando ela seria útil.

---

## Referências no código

- [`apps/web/src/components/setup/SetupWizard.tsx`](../../../apps/web/src/components/setup/SetupWizard.tsx) — o wizard inteiro: trilha, `Panel`, preview da revisão, rodapé. É o arquivo desta story.
- [`apps/web/src/components/ui/dm.tsx`](../../../apps/web/src/components/ui/dm.tsx) — `Panel`, `SectionTitle`, `SheetHeading`, `SceneFrame`, `DmButton`: as peças do chrome.
- [`apps/web/src/components/character/BackgroundPanel.tsx`](../../../apps/web/src/components/character/BackgroundPanel.tsx) e [`FeaturesPanel.tsx`](../../../apps/web/src/components/character/FeaturesPanel.tsx) — painéis já compartilhados entre criação e ficha em jogo; o molde de como a ficha viva deve ser fatiada.
- [`packages/shared/src/ability.ts`](../../../packages/shared/src/ability.ts) — `abilityModifier`, `buildSkillSheet`, `formatModifier`: os números da ficha.
- [`docs/sdlc/02-design/direcao-visual-anti-slop.md`](../02-design/direcao-visual-anti-slop.md) — §4 (box-in-box, textura `fixed`) e §5 (arte no wizard): as duas regras que este layout tem de respeitar.
- [`wizard-criacao-personagem-referencia.html`](./wizard-criacao-personagem-referencia.html) — o protótipo: coluna "Seu personagem" (números visíveis desde a etapa 1, sem gate), chips
  numerados. **Não tem** `Etapa X de N`; esse contador é proposta nossa, inspirada no rótulo
  mobile que a US-66 já usa no produto, não copiada da referência.
