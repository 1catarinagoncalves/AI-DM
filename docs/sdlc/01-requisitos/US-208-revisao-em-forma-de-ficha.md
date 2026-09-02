# US-208 — A revisão lê como ficha do personagem, não como lista de campos

**Épico:** 1 — Personagem
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** [US-204](./US-204-wizard-em-duas-colunas-com-ficha-viva.md) — o cálculo de preview
extraído para um lugar só, que esta story consome.
**Criada em:** 2026-09-01

**Relacionada a:**
- [backlog-redesenho-criacao-de-personagem.md](./backlog-redesenho-criacao-de-personagem.md) — o mapa; esta é a última story dele.
- [US-127](./US-127-revisao-espelha-ficha-completa.md) — a revisão atual: o conteúdo está certo, a forma é que não.
- [US-45](./US-45-background-na-ficha-da-interface.md) — o `BackgroundPanel` da ficha em jogo, partilhado com a revisão desde a US-127.
- [US-157](./US-157-tela-de-mundo-depois-da-revisao.md) — o passo `world`, que continua **depois** desta etapa.
- [US-98](./US-98-i18n-da-interface-web.md)/[US-66](./US-66-telas-mobile-friendly.md) — locale e telemóvel.

---

## História

> **Como** jogadora prestes a confirmar,
> **quero** ver o personagem como uma ficha, com os números agrupados como numa ficha,
> **para que** a última tela antes de confirmar se pareça com o que eu vou usar em jogo — e um
> erro me salte à vista.

---

## Contexto e motivação

### O problema observado

A revisão mostra tudo o que precisa (US-127) numa `<dl>` de rótulo à esquerda e valor à direita:
`Atributos` é uma linha só com os seis valores concatenados por `·`, `Perícias` é outra linha do
mesmo tipo, `Kit` é outra. É legível como confirmação de formulário e ilegível como ficha — para
conferir se a Destreza ficou onde se queria é preciso ler uma frase de seis pares.

### Por que a solução atual não basta

- **O conteúdo já está completo.** A US-127 pôs ali o kit, as features, as magias, o background
  por extenso e as perícias com modificador. Não falta dado; falta forma.
- **A ficha em jogo já tem a forma certa** — [`GameView.tsx`](../../../apps/web/src/components/game/GameView.tsx)
  mostra os atributos numa `grid grid-cols-3` com o modificador por baixo, e agrupa o resto em
  seções de `SheetHeading` — e a revisão não se parece nada com ela. A jogadora confirma numa
  forma e recebe outra.
- **Depois da US-204, a ficha viva na coluna já mostra um resumo.** Se a revisão continuar a ser a
  mesma lista, a etapa vira uma repetição pior do que o cartão que está ao lado dela.

### A proposta

A revisão passa a ser a **ficha de nível 1** do personagem: nome e subtítulo em destaque, grade de
seis atributos com modificador, e o resto agrupado em seções nomeadas (proficiências, kit,
origem, história, features e magias). Mesmo dado, mesma fonte de cálculo, forma de ficha.

---

## Escopo

### Dentro do escopo

- **Cabeçalho**: nome, e subtítulo `raça · classe · nível 1` — mais a origem quando houver.
- **Grade de atributos**: seis células com sigla, total e modificador, no lugar da linha
  concatenada.
- **Seções nomeadas** com `SheetHeading`, reusando o que já existe: perícias proficientes com
  modificador, ferramentas (US-132), kit inicial completo (classe + origem + memento, US-128),
  origem com conexão e memento (US-124), história (`BackgroundPanel`, US-39/US-40) e features e
  magias (`FeaturesPanel`, US-41/US-42).
- **PV inicial** em destaque junto dos atributos — é o número que a jogadora vai ver no primeiro
  turno.
- **Mesma fonte de cálculo da ficha viva** (US-204). Nenhum segundo `10 + conMod`, nenhum segundo
  `buildSkillSheet` no arquivo.
- **Enquadramento no padrão da US-204** e o rodapé com o botão de confirmar, que continua a criar
  o personagem e a avançar para o passo `world` (US-157).
- **i18n** dos textos novos nos dois locales.

### Fora do escopo

- **Acrescentar dado que a revisão ainda não mostra** — CA, salvaguardas, deslocamento, sentidos.
  Não existem no produto (verificado, 01/09/2026); a CA tem
  [backlog próprio](./backlog-classe-de-armadura-e-ataque.md).
- **Editar a partir da revisão.** Corrigir continua a ser voltar à etapa, que a trilha permite.
  Edição em linha é outra tela e outra história.
- **Retrato na ficha.** Espaço reservado com monograma, como na ficha viva (US-204).
- **Mudar o que é enviado a `createCharacter`.** Nem um campo a mais, nem um a menos.
- **Mexer no passo `world`.** Ele continua depois desta etapa, com o conteúdo que tem (US-157,
  US-161, US-184).
- **Exportar ou imprimir a ficha.**

---

## Critérios de aceite

- [ ] A revisão mostra os seis atributos numa grade, cada um com sigla, total e modificador — não
      numa linha concatenada.
- [ ] O cabeçalho mostra nome, raça, classe, nível e origem quando houver.
- [ ] Continuam presentes todas as seções que a US-127 garantiu: perícias com modificador,
      ferramentas quando a origem as concede, kit completo, conexão e memento quando existem,
      história por extenso e features/magias quando o sistema modela esse eixo.
- [ ] Os números da revisão e os da ficha viva são iguais em qualquer estado, porque saem da mesma
      função (US-204).
- [ ] Confirmar continua a chamar `createCharacter` com exatamente o mesmo corpo de antes e a
      avançar para o passo `world`; o botão continua desabilitado enquanto a chamada está em
      curso.
- [ ] Em 360 px a grade de atributos colapsa (2 ou 3 colunas) sem rolagem horizontal (US-66).
- [ ] Contraste AA nos rótulos das seções e nos modificadores (US-46).
- [ ] **Eval / teste de regressão:** teste que percorre o wizard até a revisão e afirma que (a) os
      seis atributos aparecem em elementos separados com o modificador correto, e (b) o corpo
      enviado a `createCharacter` é idêntico ao que o teste de hoje já espera. O (b) é o que
      impede que uma story de forma altere o contrato por acidente.

---

## Notas de implementação

> Dicas, não especificação. Quem implementa pode divergir com justificativa.

- **Esta story só é barata depois da US-204.** Se o cálculo de preview ainda estiver inline no
  `SetupWizard`, extraí-lo primeiro — caso contrário nascem duas cópias das mesmas contas, que é o
  problema que a US-127 já tinha resolvido.
- **`BackgroundPanel` e `FeaturesPanel` ficam.** São os mesmos painéis da ficha em jogo, e essa
  partilha é o que garante que a revisão prefigura o que a jogadora vai ver (US-127).
- **A grade de atributos é a mesma da ficha em jogo, se possível.** Se as duas divergirem no
  desenho, a promessa desta story ("a última tela parece a ficha") fica pela metade.
- **Ordem das seções: mecânica primeiro, história depois** — atributos, PV, perícias, kit, depois
  origem e história. É a ordem que o protótipo usa e a que a ficha em jogo já sugere.
- **Não apagar os comentários existentes** do bloco de revisão: eles explicam por que gênero é
  traduzido na leitura (US-98), por que a linha de origem é condicional (US-122) e por que o kit
  soma equipamento de origem e memento (US-128).

---

## Questões em aberto

1. **A ficha viva continua visível na etapa de revisão?** Mostrar as duas ao lado é redundância
   evidente; escondê-la faz a coluna direita desaparecer exatamente na última etapa. A proposta é
   escondê-la aqui, já que a revisão **é** a ficha.
2. **Cabe uma confirmação de "tudo certo?" antes de criar**, ou o botão basta? Criar personagem é
   reversível (o hub tem apagar, US-30) — provavelmente basta.

---

## Referências no código

- [`apps/web/src/components/setup/SetupWizard.tsx`](../../../apps/web/src/components/setup/SetupWizard.tsx) — o bloco `step === 'review'`: a `<dl>` que esta story substitui, e o `handleConfirm` que não muda.
- [`apps/web/src/components/game/GameView.tsx`](../../../apps/web/src/components/game/GameView.tsx) — a ficha em jogo: a grade de atributos e as seções que a revisão deve prefigurar.
- [`apps/web/src/components/character/BackgroundPanel.tsx`](../../../apps/web/src/components/character/BackgroundPanel.tsx) e [`FeaturesPanel.tsx`](../../../apps/web/src/components/character/FeaturesPanel.tsx) — os painéis partilhados com a ficha em jogo.
- [`packages/shared/src/ability.ts`](../../../packages/shared/src/ability.ts) — `buildSkillSheet`, `abilityModifier`, `formatModifier`.
- [`packages/shared/src/starting-kit.ts`](../../../packages/shared/src/starting-kit.ts) — `getStartingInventory`, `getBackgroundEquipment`, `getClassFeatures`: o kit e as features do preview.
- [`apps/web/src/components/setup/SetupWizard.test.tsx`](../../../apps/web/src/components/setup/SetupWizard.test.tsx) — os testes de revisão e do corpo enviado à API.
- [`wizard-criacao-personagem-referencia.html`](./wizard-criacao-personagem-referencia.html) — o protótipo: a etapa 7, com grade de atributos e seções nomeadas.
