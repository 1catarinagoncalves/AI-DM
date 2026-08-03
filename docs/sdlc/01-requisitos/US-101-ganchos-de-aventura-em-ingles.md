# US-101 — Ganchos de aventura inicial em inglês

**Épico:** 2 — Aventura
**Fase:** 1 — MVP single-player
**Status:** 🚧 Em progresso
**Depende de:** [US-97](./US-97-seletor-de-idioma-pt-br-en.md) (é de `User.locale` que sai o idioma) · [US-99](./US-99-config-do-sistema-no-locale-ativo.md) (**dá o transporte**: `configLocales` carrega o `SystemConfig` inteiro, e `initialAdventures` faz parte dele — esta story não inventa mecanismo, escreve conteúdo)
**Relacionada a:** [US-28](./US-28-aventura-inicial-baseada-na-classe.md) ✅ (criou os 13 ganchos, todos autorais em PT) · [US-98](./US-98-i18n-da-interface-web.md) (a tela que exibe o gancho; sem esta story, moldura EN com miolo PT) · [US-52](./US-52-traducao-automatica-do-srd.md) (traduz o **dataset**, não conteúdo autoral — mecanismo diferente, ver *Por que não cabe na US-52*) · [Direção Visual Anti-Slop](../02-design/direcao-visual-anti-slop.md) e [US-68](./US-68-nomes-de-fantasia-originais.md) (a barra de qualidade que a prosa EN tem de passar)
**Criada em:** 2026-07-30

---

## História

> **Como** jogador anglófono que acabou de criar o personagem,
> **quero** ler o convite da minha primeira aventura em inglês,
> **para que** a última tela antes da mesa não seja a única que eu não entendo — e para que a minha missão principal não fique em português dentro de um jogo em inglês.

---

## Contexto e motivação

### O problema observado

Os 13 ganchos de aventura inicial ([US-28](./US-28-aventura-inicial-baseada-na-classe.md) — 12 classes + `default`) são **texto autoral em português**, escrito à mão no [`seed.ts:148`](../../../apps/api/prisma/seed.ts) em diante. Cada um tem **cinco campos de texto** (`title`, `pitch`, `primaryQuestTitle`, `primaryQuestDescription`, `openingNarration` — ver [`InitialAdventureHookSchema`](../../../packages/shared/src/types/system.ts)), e as `openingNarration` têm cerca de 150 palavras cada. **São 65 strings, na ordem de 2.000 palavras de prosa.**

**E o gancho não é só uma tela.** Ele se espalha por quatro lugares duráveis quando a aventura começa ([`adventure.service.ts`](../../../apps/api/src/adventure/adventure.service.ts)):

| Onde vai | Linha | Consequência de ficar em PT |
|---|---|---|
| `Adventure.title` | `:153` | o nome da campanha, em toda tela que a lista |
| `Quest.title` / `.description` | `:180-181` | a **missão principal persistida** |
| `mainQuest` passado ao Mestre | `:110` | quest em português dentro do prompt de um jogo em inglês, **turno após turno** |
| `hookSeed` da abertura gerada | `:113` | o LLM escreve a primeira cena em inglês **a partir de uma semente em português** |
| Fallback da abertura | `:121` | falhou a geração? o jogador recebe 150 palavras em português |

O jogador não escolhe entre ganchos: `resolveInitialHook` casa pela classe (`:52`) e mostra um só. Não é uma lista que dá para ignorar — é *a* apresentação da aventura dele.

### Por que a solução atual não basta

**A [US-99](./US-99-config-do-sistema-no-locale-ativo.md) não alcança este texto.** Ela desdobra o artefato do `ingest` (os 4 campos derivados do SRD); os ganchos são decisão de produto e vivem no `seed`, fora do artefato — a própria US-99 os declara fora do escopo. O que ela entrega é o **transporte**: `System.configLocales` guarda um `SystemConfig` por locale, e `initialAdventures` faz parte do `SystemConfig`. Depois dela, existe onde pôr o gancho em inglês; falta **escrever o gancho em inglês**.

### Por que não cabe na US-52

A [US-52](./US-52-traducao-automatica-do-srd.md) traduz **EN→pt-BR** o conteúdo do dataset Open5e, casando cada item por slug e gravando no overlay `locale/pt-BR.json`. Os ganchos:

- não têm contraparte no dataset (são autorais — não há slug a casar);
- vão na direção **oposta** (pt-BR→EN);
- não passam pelo overlay, porque não passam pelo `ingest`.

Mesma razão pela qual a US-52 foi extraída da [US-47](./US-47-ingestao-srd-como-dado.md): traduzir conteúdo é trabalho de outra natureza que encanar dado. Aqui, ainda por cima, é **escrita criativa** — a prosa EN tem de passar pela mesma barra da [direção visual anti-slop](../02-design/direcao-visual-anti-slop.md) que a versão PT passou, não só ser compreensível.

### A proposta

Escrever a versão inglesa dos 13 ganchos e servi-la pelo locale ativo, usando o transporte que a US-99 monta.

---

## Escopo

### Dentro do escopo

- **Versão `en-US` dos 13 ganchos** — os 5 campos de cada um, com a qualidade narrativa da versão PT, não tradução literal.
- **Seed grava os ganchos por locale**, dentro do `configLocales` da [US-99](./US-99-config-do-sistema-no-locale-ativo.md) (`initialAdventures` já faz parte do `SystemConfig` — nenhum campo novo).
- **Placeholders preservados:** `{characterName}` e `{characterClass}` continuam intactos e são interpolados por `resolveHook` ([`adventure.service.ts:58-66`](../../../apps/api/src/adventure/adventure.service.ts)); a ordem na frase muda entre os idiomas, o nome do placeholder não.
- **`id` e `classKey` NÃO mudam** — são chave, não texto. `barbaro-ascensao-na-tribo` continua sendo o `id` do gancho do bárbaro em qualquer idioma; traduzir o `id` quebraria a resolução.
- Teste: pedir o gancho inicial nos dois locales para o mesmo personagem devolve o mesmo `id` com textos diferentes, e nenhum placeholder sobra por interpolar.

### Fora do escopo

- **Ganchos novos.** Esta story traduz os 13 que existem; inventar aventura inicial nova é outra conversa.
- **Narração dos turnos** — já nasce no idioma-alvo pela [US-97](./US-97-seletor-de-idioma-pt-br-en.md).
- **Aventuras já em andamento.** Uma `Adventure` criada em PT guarda título e quest em português no banco; re-traduzi-los seria reescrever a campanha em curso, o que o [ADR 005](../../adr/005-locale-como-dimensao.md) rejeita para conteúdo já produzido. Vale só para aventura nova.
- **Kits iniciais, point-buy e proficiência** — outros campos de produto do `seed`, sem texto exposto ao jogador na mesma medida.
- **Um terceiro idioma.** A forma (um `initialAdventures` por locale) aceita; escrever é por conta de quem pedir.

---

## Critérios de aceite

- [ ] Existem 13 ganchos em `en-US`, um para cada `classKey` de hoje (12 classes + `default`), com os 5 campos preenchidos.
- [ ] Com `locale = 'en-US'`, a tela do convite mostra título, pitch e abertura em inglês; com `pt-BR`, mostra exatamente o texto de hoje.
- [ ] `Adventure.title` e a quest principal de uma aventura criada em `en-US` nascem em inglês — e é o texto inglês que vai ao Mestre no `mainQuest`.
- [ ] A abertura gerada usa a semente inglesa (`hookSeed`); se a geração falhar, o fallback exibido também está em inglês.
- [ ] `id` e `classKey` são idênticos nos dois locales; nenhum gancho perde a resolução por classe.
- [ ] Nenhum `{characterName}`/`{characterClass}` aparece cru na tela em nenhum dos idiomas.
- [ ] A prosa EN passa pela mesma barra da versão PT: nada de nome genérico de fantasia ([US-68](./US-68-nomes-de-fantasia-originais.md)), nada de abertura que soe a tradução literal.
- [ ] **Eval / teste de regressão:** buscar o gancho inicial do mesmo personagem nos dois locales e afirmar (a) mesmo `id`, (b) textos diferentes, (c) zero placeholder remanescente. Falha se o locale for ignorado ou se a tradução quebrar os placeholders.

---

## Notas de implementação

> *Dicas e decisões técnicas para quem vai implementar. Não é especificação obrigatória — o implementador pode divergir com boa justificativa.*

- **Escrever à mão ou gerar com LLM + revisão humana?** 2.000 palavras é o volume onde a segunda opção começa a compensar, e o repo já tem o encanamento de geração (`model.ts`). O risco é conhecido e é justamente o que a direção anti-slop persegue: prosa gerada tende ao genérico, e a abertura é o primeiro texto que o jogador lê no produto. Se gerar, tratar a saída como rascunho — revisão humana obrigatória, gancho a gancho. Ver *Questões em aberto* #1.
- **Traduzir o `pitch` é diferente de traduzir a `openingNarration`.** O `pitch` é copy de produto (uma frase, vende a aventura); a `openingNarration` é prosa de mesa, com voz de Mestre. Barra de qualidade diferente, revisor possivelmente diferente.
- **Nomes próprios inventados** ("Willowdale", "Solariel") atravessam os idiomas sem tradução — são nomes, não palavras. Traduzi-los quebraria a continuidade com o registro de entidades da aventura.
- Os ganchos são um bloco literal grande dentro do [`seed.ts`](../../../apps/api/prisma/seed.ts), que já tem 438 linhas. Duplicá-lo inline dobra o arquivo: considerar mover o catálogo para um JSON por locale ao lado do seed, no mesmo espírito do artefato do SRD (que é lido por `fs`, não importado — ver o comentário no próprio `seed.ts` sobre por que não usar `import`).

---

## Questões em aberto

1. **Escrita humana, geração revisada, ou misto** (gerar o `pitch`, escrever à mão a `openingNarration`)? Decide o custo e o cronograma da story.
2. **Esta story entra no gate de release do inglês** (junto de US-97, US-98 e US-99) ou vem logo depois? Argumento a favor de entrar: o critério que a US-98 fixou é "o jogador EN atravessa o fluxo sem encontrar português", e o gancho é o último passo antes da mesa — além de contaminar o prompt com a quest em PT. Argumento contra: não impede jogar, e é a única das quatro cujo custo é de redação, não de código.
3. **Onde o catálogo passa a morar** — inline no `seed.ts` por locale, ou um JSON por locale carregado por `fs`? Questão de manutenção, não de comportamento; a segunda facilita revisar tradução sem ler TypeScript.

---

## Referências no código

- [`apps/api/prisma/seed.ts:141`](../../../apps/api/prisma/seed.ts) — comentário do catálogo de aventuras iniciais; `:148` em diante, os 13 ganchos em PT.
- [`packages/shared/src/types/system.ts`](../../../packages/shared/src/types/system.ts) — `InitialAdventureHookSchema`: quais campos são texto (5) e quais são chave (`id`, `classKey`, `tags`).
- [`apps/api/src/adventure/adventure.service.ts:52`](../../../apps/api/src/adventure/adventure.service.ts) — `resolveInitialHook` casa o gancho pela classe; `:58-66` interpola os placeholders; `:110` monta o `mainQuest` do Mestre; `:113` usa a abertura como semente; `:121` o fallback; `:153` o título da aventura; `:180-181` a quest persistida.
- [`apps/web/src/components/setup/SetupWizard.tsx:226-231`](../../../apps/web/src/components/setup/SetupWizard.tsx) — a tela que exibe `title`, `pitch` e `openingNarration` antes de começar.
