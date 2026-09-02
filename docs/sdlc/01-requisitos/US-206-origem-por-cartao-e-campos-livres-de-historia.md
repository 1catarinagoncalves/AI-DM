# US-206 — Origem por cartão, com os campos livres de história no mesmo desenho

**Épico:** 1 — Personagem
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** [US-204](./US-204-wizard-em-duas-colunas-com-ficha-viva.md) — o layout.
[US-205](./US-205-escolha-por-cartao-classe-e-raca.md) — o componente de grade de cartões, que
esta story reusa em vez de escrever um segundo. Desde 2026-09-02 a US-205 também cataloga
subclasse (subgrade aninhada, condicional a `config.subclasses[classKey].length > 1`) — esta
story usa só o modo simples (uma grade plana), sem a variante aninhada: origem não tem
equivalente de subespécie/subclasse (ver *Contexto*), então o componente reusado aqui é o mesmo
caso já coberto pela grade de raça-sem-subespécie, não o caso novo.
**Criada em:** 2026-09-01

**Relacionada a:**
- [backlog-redesenho-criacao-de-personagem.md](./backlog-redesenho-criacao-de-personagem.md) — o mapa; esta é a story onde a diferença entre protótipo e produto é maior.
- [US-121](./US-121-catalogo-backgrounds-a5e-adventurers-guide.md)/[US-122](./US-122-escolha-background-catalogo-na-criacao.md) — o catálogo de origem e o `<select>` que esta story substitui.
- [US-123](./US-123-integracao-mecanica-background-pointbuy.md)/[US-131](./US-131-integracao-mecanica-background-proficiency.md)/[US-132](./US-132-escolha-ferramenta-beneficio-tool-proficiency-background.md)/[US-135](./US-135-feature-de-origem-na-criacao-e-ficha.md) — os quatro benefícios que a origem concede. Nenhum se perde aqui.
- [US-124](./US-124-exibir-beneficios-narrativos-origem.md) — conexão e memento, com o sorteio d10.
- [US-39](./US-39-identidade-narrativa-background-ideais.md)/[US-40](./US-40-divindade-do-personagem.md) — **os campos livres de história**: o que o protótipo não tem e o produto não abre mão.

---

## História

> **Como** jogadora na etapa de origem,
> **quero** escolher a origem lendo o que ela concede, e escrever a história do meu personagem na
> mesma tela,
> **para que** a origem do catálogo e a história que eu invento se apoiem uma na outra em vez de
> viverem em blocos que não conversam.

---

## Contexto e motivação

### O problema observado

A etapa `background` é hoje a mais carregada do wizard e a mais desorganizada visualmente: um
`<select>` de origem, até quatro avisos de benefício em parágrafos soltos, um a dois `<select>` de
ferramenta, dois `<select>` de conexão/memento com botão de dado, e **cinco campos de texto
livre** por baixo. Tudo empilhado, tudo com o mesmo peso, sem nada que diga o que é escolha
mecânica e o que é escrita livre.

### Por que a solução atual não basta

- **O `<select>` de origem esconde justamente o que decide a escolha.** As 21 origens do A5E têm
  `benefits[].description` — perícia, ferramenta, atributo, feature, conexão e memento —, e nada
  disso aparece até depois de escolher.
- **O protótipo não resolve isto sozinho.** O antecedente dele é um cartão com quatro linhas
  (`blurb`, `feature`, perícias, equipamento) e **nenhum campo de escrita livre**: não tem
  ideais, vínculos, fraquezas nem divindade. Copiar o protótipo tal e qual **apagaria cinco
  campos que já viajam para a API e para o prompt do Mestre** (US-39/US-40).
- **A ordem também não bate.** No protótipo a escrita livre vive numa etapa `Identidade` entre
  perícias e revisão. No produto ela vive aqui, junto da origem — e é aqui que fica.

**Origem não tem subespécie nem subclasse.** Raça ganhou `parentKey` (US-140) e classe ganhou
`config.subclasses` (US-141) porque o dado do SRD tem essa forma — uma raiz com variantes, uma
classe com arquétipos. O catálogo de origem (`SystemBackgroundSchema`, US-121) é **plano**: 21
entradas do A5E, nenhuma com "origem-mãe". Não há aninhamento a reproduzir aqui — a grade desta
story usa o componente da US-205 no modo simples, o mesmo caso das 5 raízes de raça sem
subespécie.

### A proposta

A etapa passa a ter **duas metades declaradas**: em cima, *o que a origem te dá* (cartão escolhido
+ benefícios + escolhas mecânicas que dependem dela); em baixo, *o que você inventa* (os cinco
campos livres). Origem vira cartão, com a mesma anatomia da US-205. Nada é removido do modelo de
dados.

---

## Escopo

### Dentro do escopo

- **Grade de cartões de origem** reusando o componente da US-205. Cada cartão mostra o nome e, do
  que já existe no catálogo (US-121), a **feature** e as **perícias concedidas** — sem `blurb`
  novo: `Background.desc` vem vazio nas 21 entradas e toda a prosa está em `benefits`.
- **Bloco "O que esta origem te dá"** sob a grade, agrupando os benefícios que hoje são parágrafos
  soltos: bônus de atributo (US-123, aviso), perícias (US-131, aviso), ferramenta (US-132,
  **escolha**, que continua a acontecer aqui), feature (US-135) e `adventures_and_advancement`
  (US-124).
- **Conexão e memento** (US-124) continuam nesta etapa, com o `<select>` e o botão de sorteio d10
  intactos — são tabelas de dez linhas de texto longo, caso em que a lista suspensa é a forma
  certa e o cartão não é.
- **Bloco "O que você inventa"**, com os cinco campos livres de sempre — `story`, `ideals`,
  `bonds`, `flaws` (US-39) e `deity` (US-40) —, com rótulo visível persistente (US-46) e o mesmo
  parsing de sempre (um item por linha; divindade partida na primeira vírgula).
- **Enquadramento de etapa** no padrão da US-204: chamada, pergunta, frase de apoio.
- **Ficha viva** (US-204) passa a mostrar a origem escolhida assim que ela é escolhida.
- **i18n** dos textos novos nos dois locales.

### Fora do escopo

- **Remover, renomear ou fundir qualquer um dos cinco campos livres.** É o motivo pelo qual esta
  story existe em separado. `Character.background` continua exatamente
  `{story?, ideals?, bonds?, flaws?, deity?}`.
- **Acrescentar `appearance` e `personality`** (os campos que o protótipo tem e o produto não).
  Seriam colunas novas em `Character.background`, com migração, com efeito no prompt do Mestre e
  numa tela que já tem cinco caixas de texto. Story própria, com o seu próprio "para quê".
- **Assistência de IA para escrever a história.** Ver *Fora do escopo* do backlog: é custo por
  clique, não layout.
- **Mudar qualquer regra de `grant`.** Fixo continua pré-marcado e não-clicável; escolhido continua
  limitado a `chooseCount`; trocar de origem continua a limpar `connectionRoll`, `mementoRoll`,
  `abilityChoice`, `skillChoice` e `toolChoice`.
- **Mover a escolha de perícia da origem para cá.** Ela acontece na etapa `skills` de propósito
  (US-131), e mover é mudança de ordem.
- **Prosa autoral por origem.** As 21 já trazem texto do A5E; escrever mais 21 resumos não é o
  gargalo desta tela.
- **Busca por rótulo na grade.** A US-205 tira busca das grades de classe, raça e subclasse pelo
  mesmo argumento que vale aqui: filtrar por rótulo pressupõe já saber o nome, e quem está
  escolhendo origem pela primeira vez não sabe. Com 21 cartões é a grade mais comprida do wizard
  — nem a de raça (9) nem a subgrade de subclasse (no máximo 3, só quando `marshal`) chegam perto
  — motivo a mais para não empurrar a decisão pra um campo de texto; story própria se a rolagem
  provar ser o problema, não a leitura.

---

## Critérios de aceite

- [ ] A etapa `background` não tem `<select>` de origem; tem grade de cartões, sem campo de busca,
      com as 21 opções todas no DOM.
- [ ] Cada cartão de origem mostra o nome e, quando o catálogo os traz, a feature e as perícias
      concedidas — e continua utilizável para uma origem sem nenhum benefício estruturado.
- [ ] Os cinco campos livres (`story`, `ideals`, `bonds`, `flaws`, `deity`) continuam presentes,
      nesta etapa, com os mesmos rótulos e o mesmo comportamento de parsing; um personagem criado
      só com eles preenchidos (sem origem escolhida) grava exatamente o que gravava antes.
- [ ] A etapa distingue visualmente as duas metades — o que a origem concede e o que a jogadora
      escreve — sem que nenhuma das duas fique atrás de um acordeão fechado por omissão.
- [ ] Os quatro benefícios continuam a funcionar: aviso de bônus de atributo (US-123), aviso de
      perícias (US-131), **escolha** de ferramenta com `chooseCount` (US-132) e feature (US-135).
- [ ] `canAdvance('background')` continua a bloquear **apenas** por ferramenta não escolhida —
      origem, conexão, memento e os campos livres continuam opcionais.
- [ ] Trocar de origem limpa `connectionRoll`, `mementoRoll`, `abilityChoice`, `skillChoice` e
      `toolChoice`, como hoje.
- [ ] Conexão e memento continuam com `<select>` e botão de sorteio; sortear preenche o campo.
- [ ] Em 360 px a grade é uma coluna e as caixas de texto não geram rolagem horizontal (US-66).
- [ ] **Eval / teste de regressão:** teste em `SetupWizard.test.tsx` que preenche os cinco campos
      livres, escolhe uma origem **pelo cartão** e afirma que o corpo enviado a `createCharacter`
      traz `background` com os cinco campos parseados **e** `origin.key` — os dois juntos, no
      mesmo envio. É o teste que falha se o redesenho aproximar a tela do protótipo apagando os
      campos livres, que é o modo de falha mais provável desta story.

---

## Notas de implementação

> Dicas, não especificação. Quem implementa pode divergir com justificativa.

- **Reusar o componente de grade da US-205**, parametrizado — no modo simples (uma grade plana),
  não no modo aninhado que a US-205 acrescentou para subclasse. Se a origem precisar de um
  desenho de cartão diferente dos que já existem, o componente está mal parametrizado — não
  escrever um segundo.
- **`bg` e `origin` continuam estados separados.** A US-122 §Nomenclatura decidiu isso de
  propósito: são campos irmãos, um não alimenta o outro. Juntá-los "porque agora estão na mesma
  seção" é regressão de modelo.
- **A etapa é a mais comprida do wizard e vai crescer.** Extrair para `BackgroundStep.tsx` é parte
  do trabalho (teto de 500 linhas por arquivo, `AGENTS.md`).
- **Não apagar os comentários existentes.** O bloco desta etapa carrega o porquê de
  `SINGLE_BLOCK_IS_MEMENTO` (Sailor), do mapeamento posicional das tabelas d10 e do `<select>` por
  slot de ferramenta (design critique de 14/08/2026) — cada um existe por causa de um caso real.
- **O agrupamento de ferramenta por categoria (`groupToolsByCategory`) fica como está.** Foi a
  resposta a `chooseFrom` com 37 chaves; a grade de cartão não escala para isso, e por isso a
  ferramenta continua em `<select>` mesmo com a origem em cartão.
- **Verificar o protótipo antes de copiar a seção de escrita:** ele tem três caixas
  (aparência/personalidade/história) e o produto tem cinco de outra natureza. A forma do protótipo
  (rótulo + botão à direita + textarea) serve; o conteúdo não.

---

## Questões em aberto

1. **Os cinco campos livres ficam sempre abertos, ou os três de lista (`ideals`/`bonds`/`flaws`)
   colapsam sob "detalhar mais"?** Sempre abertos é mais honesto sobre o que existe; colapsar
   encurta uma tela já longa. A restrição é a do critério de aceite: nada essencial atrás de um
   acordeão fechado por omissão.
2. **O cartão de origem mostra o equipamento inicial que ela concede (US-128)?** Ajuda a comparar,
   e alonga o cartão numa grade de 21.

---

## Referências no código

- [`apps/web/src/components/setup/SetupWizard.tsx`](../../../apps/web/src/components/setup/SetupWizard.tsx) — o bloco `step === 'background'` inteiro: `<select>` de origem, avisos de benefício, `groupToolsByCategory`, tabelas d10 e os cinco campos livres.
- [`packages/shared/src/types/system.ts`](../../../packages/shared/src/types/system.ts) — `SystemBackgroundSchema` e `SystemBackgroundGrantSchema`: o que existe para pôr no cartão, e o comentário que explica por que não há `description` própria.
- [`apps/api/src/character/character.schema.ts`](../../../apps/api/src/character/character.schema.ts) — o schema de `background` que a tela alimenta; a prova de que os cinco campos são contrato, não decoração.
- [`apps/web/src/lib/parseD10Tables.ts`](../../../apps/web/src/lib/parseD10Tables.ts) — as tabelas de conexão/memento.
- [`apps/web/src/components/character/BackgroundPanel.tsx`](../../../apps/web/src/components/character/BackgroundPanel.tsx) — como os mesmos campos são lidos na ficha em jogo e na revisão.
- [`wizard-criacao-personagem-referencia.html`](./wizard-criacao-personagem-referencia.html) — o protótipo: cartão de antecedente (etapa 3) e a forma dos campos de escrita (etapa 6).
