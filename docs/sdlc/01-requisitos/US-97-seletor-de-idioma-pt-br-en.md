# US-97 — Jogador escolhe o idioma da partida (PT-BR ou inglês)

**Épico:** 4 — Onboarding e navegação
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada (30/07/2026) — código completo e verde; falta rodar `pnpm db:migrate` para aplicar a coluna `User.locale` no banco
**Depende de:** [ADR 005](../../adr/005-locale-como-dimensao.md) (fixa a forma: preferência mutável no `User`, EN nativo, guardrail parametrizado) · [US-61](./US-61-login-do-jogador.md) (existe `User` no banco e guard que deriva `userId` do token — é onde a preferência passa a morar)
**Relacionada a:** [US-47](./US-47-ingestao-srd-como-dado.md) (o overlay `locale/pt-BR.json` é a localização de *um* locale sobre a base EN) · [US-55](./US-55-prompt-caching-do-dm.md) / [US-85](./US-85-fronteira-de-camadas-do-prompt.md) (onde a instrução de idioma entra no prompt sem quebrar o cache) · [US-17](./US-17-comparacao-modelos-eval.md) (o guardrail de idioma nasceu lá, cravado em PT)
**Criada em:** 2026-07-30

---

## História

> **Como** jogador anglófono — que não fala português e hoje não consegue usar o produto —,
> **quero** escolher inglês antes de criar o personagem, e trocar de idioma depois se quiser,
> **para que** eu consiga jogar: a aventura começa e continua na minha língua, sem depender de eu adivinhar escrevendo em inglês e torcer.

---

## Contexto e motivação

### O problema observado

**O AI DM só atende quem fala português. Um jogador que fala inglês não tem como jogar.**

Ele abre o site e a barreira aparece antes de qualquer decisão de jogo: a tela de login está em português, a home está em português, o wizard de criação pede raça, classe e perícias em português, e o convite da aventura chega em português. Não existe em lugar nenhum um lugar para dizer *"quero jogar em inglês"* — o produto nunca faz essa pergunta, porque não tem onde guardar a resposta.

O jogo é **texto**: um RPG narrativo é lido do começo ao fim. Ler numa língua que não se fala não é uma fricção de usabilidade, é a impossibilidade de jogar. Hoje **o público do AI DM é, por construção, só o falante de português** — e o mercado de RPG de mesa é majoritariamente anglófono.

A ironia é que **a metade cara já está pronta**. O modelo narra em inglês nativamente e o prompt já manda narrar *"in the same language the player uses"* ([dm-system.ts:279](../../../packages/ai-engine/src/prompts/dm-system.ts) e `:295`) — não falta capacidade de gerar inglês, falta o produto perguntar ao jogador qual é a língua dele e levar essa resposta até o Mestre.

### Por que a solução atual não basta

**"É só escrever em inglês" não é uma solução — é um acidente.** O espelhamento do prompt entrega inglês para quem digita em inglês, mas:

- **não vale para a abertura**, que é a primeira coisa que o jogador lê e nasce antes de ele escrever qualquer coisa;
- **não persiste** — não é preferência, é reação à última mensagem; uma ação curta e ambígua ("attack", "sim") devolve o Mestre ao português no meio da cena;
- **não chega a mais nada** — nenhuma outra parte do sistema pode ler essa "escolha", porque ela não existe como dado. Medido em 30/07/2026: `User` ([schema.prisma:12](../../../apps/api/prisma/schema.prisma)) tem seis campos e nenhum de preferência; `apps/api/src` tem **zero** ocorrência de `locale` fora de uma descrição de tool. O servidor nunca soube em que língua a mesa joga.

O resultado, para quem tenta assim mesmo, é um jogo meio-inglês: narração em inglês cercada de botões, ficha e convite de aventura em português (a jornada completa está na seção abaixo).

E a **medição de qualidade reprova o inglês**: `detectLanguageDrift` ([guardrails.ts:78](../../../packages/ai-engine/src/guardrails.ts)) crava PT — `drift = enScore > ptScore && enScore >= 3` — e é chamado sem alvo em [run-bakeoff.mjs:77](../../../packages/ai-engine/run-bakeoff.mjs) e [narrative-bakeoff.test.ts:297](../../../packages/ai-engine/src/narrative-bakeoff.test.ts). Confirmado por grep: **ele não roda em produção** (nenhuma chamada em `apps/api/src`), então não bloqueia o jogador — mas qualquer bake-off ou eval de narração EN sai como falha de idioma, o que impede até de *medir* se o inglês está bom. Nos termos do ADR 005: *EN hoje não está ausente — está proibido.*

### A proposta

Dar ao jogador um **seletor de idioma** (PT-BR / EN) visível desde a home, antes de existir personagem, persistido como preferência da conta; e fazer essa preferência chegar ao Mestre, de modo que a narração — abertura inclusive — nasça no idioma escolhido e o guardrail meça a deriva **em relação a ele**, não em relação ao PT.

---

## Jornada do usuário e onde o inglês entra

A jornada do MVP hoje (verificada no código, 30/07/2026): **login → home → wizard de 6 etapas → gancho → mesa**. Cada tela abaixo diz **de onde vem o texto** que o jogador lê e **o que muda** quando ele escolhe English *nesta* story.

| # | Tela / etapa | Fonte do texto que o jogador lê | Com `locale = 'en-US'` **depois desta US** | O que falta e em que story |
|---|---|---|---|---|
| 0 | **Seletor** (todas as telas) | Componente novo — no `<header>` do `SceneFrame`; na mesa, no cabeçalho da ficha (ver *Onde o seletor fica em cada tela*) | **Entra aqui.** Escolhe antes do login (guardado em `localStorage`) e depois dele (`User.locale`). Trocável a qualquer momento | — |
| 1 | **Login** ([`/login`](../../../apps/web/src/app/login/page.tsx)) | String PT à mão + botão do Google | Continua PT | i18n da UI |
| 2 | **Home** ([`HomeHero.tsx`](../../../apps/web/src/components/HomeHero.tsx)) — "Você ainda não tem nenhum personagem" ou o card do herói + *Continuar* | Strings PT à mão; nome/raça/classe do personagem vêm da API | Continua PT | i18n da UI (chrome) · ficha por chave (raça/classe) |
| 3 | **Wizard, etapas 1–4** ([`SetupWizard.tsx`](../../../apps/web/src/components/setup/SetupWizard.tsx): sistema, raça/classe, atributos, perícias) | Rótulos das etapas em PT à mão **+ labels do `config`** vindas de `listSystems` (`seed.ts:17` — `'Força'`, `'Atletismo'`) | Continua PT | i18n da UI (chrome) · dados por locale: base EN crua vs. overlay `pt-BR` ([US-47](./US-47-ingestao-srd-como-dado.md)) |
| 4 | **Wizard, etapa 5** (background: história, ideais, vínculos, falhas) | **Texto autoral do jogador** | Fica como ele escreveu — em qualquer locale | Nunca muda (ADR 005, D2: sem chave, não há o que re-derivar) |
| 5 | **Wizard, etapa 6** (revisão) + **gancho** (`getInitialAdventure`: `title`, `pitch`, `openingNarration` exibidos antes de começar) | Texto autoral em PT no seed (`seed.ts:152` em diante) | **Continua PT** — é a costura mais visível: o jogador lê o convite da aventura em português e recebe a primeira cena em inglês | [US-101](./US-101-ganchos-de-aventura-em-ingles.md) — ganchos em EN |
| 6 | **Abertura da mesa** ([`/play/[adventureId]`](../../../apps/web/src/app/play/%5BadventureId%5D/page.tsx), primeira cena) | **LLM**, via `buildOpeningInstruction` | **Entra aqui.** Nasce em inglês, sem o jogador ter escrito nada ainda | — |
| 7 | **Turnos** (ação do jogador → narração em streaming) | **LLM**, via `buildDmSystemPrompt` | **Entra aqui.** Alvo explícito: o Mestre narra em inglês mesmo que a ação seja digitada em português (hoje o prompt só espelha o que o jogador escreveu) | — |
| 8 | **Ficha lateral** (`getCharacter`: features, magias, HP, inventário) | `features`/`spells` **materializados em texto PT** na criação; rótulos de UI à mão | Continua PT ("Fúria", não "Rage") | Ficha por chave — fase "Ficha" do ADR 005 |
| 9 | **Voltar depois** (histórico de turnos, `getTurns`) | `EventLog` | Fica na língua em que nasceu; trocar o idioma **não** reescreve o passado | Nunca muda (ADR 002) |

Lendo a coluna do meio: **o inglês entra em três pontos — o seletor (0), a abertura (6) e os turnos (7)** — mais o guardrail que mede esses turnos. Tudo que é *chrome* (1, 2, 3), *dado de sistema* (3) e *ficha* (8) segue em português até as stories citadas na última coluna; texto autoral (4) e histórico (9) ficam em PT **por decisão**, não por pendência.

**Consequência honesta:** entregue sozinha, esta story dá uma **mesa em inglês numa interface em português** — e o jogador anglófono nem chega à mesa, porque o wizard (linha 3) é onde ele trava. Por isso ela não vai a produção sozinha: ver *Ordem de entrega*.

---

## Onde o seletor fica em cada tela

### O que já ocupa o canto superior

Duas famílias de cabeçalho convivem no app hoje:

| Superfície | Quem monta | Telas | Espaço livre |
|---|---|---|---|
| `<header>` da marca ([`dm.tsx:136`](../../../apps/web/src/components/ui/dm.tsx)) — `Logo` + "AI Dungeon Master", `relative z-10`, no fluxo | `SceneFrame` | login, home, wizard (6 etapas), gancho | **Toda a metade direita** — nada é renderizado depois do `<span>` |
| Controles **fixos** sobrepostos — `ThemeToggle` em `top-4 right-4` (44px) e `AuthNav` em `top-4 right-16` | [`layout.tsx:55-57`](../../../apps/web/src/app/layout.tsx) | todas | Ocupado; a folga `right-16` foi calculada à mão na [US-66](./US-66-telas-mobile-friendly.md) |
| Sem cabeçalho de marca: sidebar da ficha + coluna de narração ([`GameView.tsx:446`](../../../apps/web/src/components/game/GameView.tsx)) | `GameView` | mesa (`/play/[adventureId]`) | Nenhum no topo — ver abaixo |

**A tela de jogo é o caso apertado, e o próprio código já registra por quê.** No mobile, a barra "Ficha — {nome}" reserva `pr-40` (160px) e `min-h-[76px]` **à mão** para os dois controles fixos não taparem o nome do personagem ([`GameView.tsx:456-462`](../../../apps/web/src/components/game/GameView.tsx)). Um terceiro controle fixo de ~64px empurraria essa reserva para ~224px: num aparelho de 375px sobrariam ~150px para "Ficha — {nome}" e o chevron — o nome do personagem viraria reticências. **Adicionar mais um `fixed top-4 right-*` não é opção;** é a terceira vez que alguém recalcula offsets à mão.

### Recomendação

**Duas casas, não uma flutuante a mais:**

**1. Telas com `SceneFrame` (login, home, wizard, gancho) — dentro do `<header>` da marca, empurrado com `ml-auto`.**
Um único ponto de edição serve as quatro telas (o `SceneFrame` já é o cabeçalho do sistema), o controle entra **no fluxo** — sem `fixed`, sem cálculo de offset, sem sobrepor conteúdo — e cai na mesma banda visual dos controles de tema/sessão, então lê-se como um grupo. No mobile o `<span>` do nome do produto já some (`hidden sm:inline`), o que libera ainda mais largura.

**2. Mesa (`GameView`) — no cabeçalho da ficha, não no topo.**
Desktop: junto do bloco `Logo` + nome + raça/classe ([`GameView.tsx:469`](../../../apps/web/src/components/game/GameView.tsx)). Mobile: dentro do painel recolhível da ficha, que já rola e já tem alvos de 44px. Racional de produto, não só de espaço: **trocar de idioma no meio de uma mesa é raro e tem consequência** (a próxima cena muda de língua e o histórico não), então esse controle não deve competir por atenção com a caixa de ação — mas também não pode sumir, porque o ADR 005 (D1) exige preferência mutável a qualquer momento.

**Prioridade de visibilidade: o login é a tela que mais importa.** É onde o anglófono decide se o produto é para ele, e é a única tela cujo texto ("Entra com a tua conta para os teus personagens te seguirem em qualquer dispositivo") ele não vai entender. O seletor precisa estar visível **antes** do botão do Google, sem rolagem.

### Forma do controle

- **Segmentado `PT | EN`, não `<select>`.** Com dois idiomas, o segmentado mostra ao mesmo tempo o estado atual e a alternativa — um toque, sem abrir menu. Um `<select>` (com o `fieldClass` que já existe) passa a valer a partir do terceiro idioma.
- **Rótulo textual, não só ícone de globo.** Quem não lê a língua da interface reconhece "EN"/"PT"; ícone mudo obriga a tentar. Se couber (a partir de `sm:`), o rótulo por extenso no próprio idioma — *Português* / *English*, nunca "Inglês".
- **Nada de bandeira.** Bandeira é país, não idioma — inglês não é a bandeira dos EUA nem do Reino Unido, e português não é só o Brasil.
- **44px de alvo** em cada metade ([US-46](./US-46-acessibilidade-wcag-aa.md); o `BUTTON_BASE` do design system já traz `min-h-[44px]`), `role="group"` com `aria-label`, e `aria-pressed` na opção ativa.
- **Estilo:** variante `ghost` do design system (`border-border bg-card/60 backdrop-blur`) — é o mesmo tratamento do `ThemeToggle` e do "Sair", então o grupo do cabeçalho fica coerente sem cor nova. Nenhuma cor literal: regra do [design system](../02-design/design-system.md).
- **Efeito colateral obrigatório:** trocar o idioma atualiza o atributo `lang` do `<html>`, hoje cravado em `pt-BR` ([`layout.tsx:41`](../../../apps/web/src/app/layout.tsx)). Sem isso, o leitor de tela lê inglês com voz portuguesa.

### Aviso de troca de idioma no chat

Trocar o idioma no meio de uma mesa muda a língua da **próxima** cena. Sem sinal nenhum, isso lê-se como o Mestre ter enlouquecido — e o jogador não tem como saber se a troca pegou. O chat já tem o vocabulário certo para isso: **o bloco de rolagem de dados** ([`GameView.tsx:674-684`](../../../apps/web/src/components/game/GameView.tsx)) é uma pílula centrada entre as falas — `rounded-full`, `border-primary/40`, `bg-primary/10`, `text-xs`, ícone `Dices` à esquerda —, o formato que o sistema usa para dizer algo **sobre** a mesa sem fingir que é narração.

**A troca de idioma ganha uma pílula da mesma família**, no ponto da conversa em que aconteceu:

| Trocou para | Texto da pílula |
|---|---|
| `pt-BR` | 🌐 *Idioma alterado para Português* |
| `en-US` | 🌐 *Language changed to English* |

Decisões que acompanham:

- **Escrita no idioma NOVO.** É o que confirma que a troca pegou: quem escolheu English lê a confirmação em inglês.
- **Ícone diferente do dado** (`Languages`/`Globe` do lucide, que a UI já usa), mesma pílula. Mesma família, sinais distintos.
- **É marcador de sessão, não turno de jogo.** Entra na lista de mensagens da tela, **não** no `EventLog` e **não** no histórico que vai ao Mestre — o Mestre não precisa saber que houve troca, precisa só narrar no idioma-alvo. Some ao recarregar a página, como qualquer aviso de interface. Atenção ao cache local do histórico (`saveHistory` em [`GameView.tsx:85`](../../../apps/web/src/components/game/GameView.tsx)): se o marcador for gravado ali, ele ressuscita fora de hora.
- **Anunciado por leitor de tela** (`role="status"`, `aria-live="polite"`) sem roubar o foco — a mudança de língua da interface é justamente o que um usuário de leitor de tela precisa ouvir ([US-46](./US-46-acessibilidade-wcag-aa.md)).
- **Diz apenas o idioma novo** (decidido em 30/07/2026). Nada sobre as cenas anteriores continuarem na língua original: o histórico está logo acima, visível, e explicar o óbvio numa pílula de uma linha só a transforma em aviso legal. A pílula responde "trocou para quê?", nada além.

### Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Terceiro controle `fixed top-4 right-28` ao lado dos outros | Menor diff no papel, mas quebra a barra da ficha no mobile (`pr-40` → `pr-56` em 375px) e mantém o padrão de recalcular offsets à mão que a US-66 já pagou uma vez |
| Só dentro do wizard (etapa "sistema") | Chega tarde: o jogador já passou por login e home em português, e trocar depois exigiria voltar ao wizard |
| Menu/gaveta de "Configurações" com tema + idioma + sair | Provavelmente o destino certo quando houver uma quarta preferência; hoje seriam três itens escondidos atrás de um clique — e o idioma é justamente o que precisa estar **visível** para quem não entende a tela |
| Só na home, ausente da mesa | Contraria o D1 do ADR 005 (mutável a qualquer momento); e o cabeçalho da ficha resolve sem custo de layout |
| Detectar o idioma do browser e não oferecer seletor | Erra com quem usa SO em inglês e joga em português (e vice-versa), e não permite trocar. O default do browser entra como *palpite inicial*, não como decisão |

---

## Escopo

### Dentro do escopo

- **`User.locale`** (`'pt-BR' | 'en-US'`, default `'pt-BR'`) + migração Prisma.
- **Endpoint de preferência** na API: leitura junto do usuário corrente e escrita (`PATCH`) no módulo `auth` que já existe (`auth.controller.ts` tem só `@Post('sync')` hoje).
- **Seletor na UI**, disponível **sem personagem** e **antes do login** (visitante guarda em `localStorage`; ao autenticar, o valor sobe no `/auth/sync`). Duas casas, pelos motivos medidos em *Onde o seletor fica em cada tela*: no `<header>` do `SceneFrame` (login, home, wizard, gancho) e no cabeçalho da ficha do `GameView` (mesa). **Não** como terceiro controle `fixed` no canto.
- **Default do browser** na primeira visita, casando pela **subtag de idioma**, não pela string inteira: `navigator.language` começando com `pt` → `pt-BR`; qualquer outra coisa → `en-US`; `pt-BR` como fallback. (O browser devolve `en-GB`, `pt-PT`, `en` — comparar por igualdade erraria em quase todos.)
- **Idioma-alvo no prompt:** `buildDmSystemPrompt` e `buildOpeningInstruction` passam a receber o locale e emitir uma instrução de idioma **explícita**, no lugar do espelhamento implícito. A regra de pt-BR natural (`dm-system.ts:140`) passa a valer só quando o alvo é `pt-BR`.
- **Aviso de troca no chat:** trocar o idioma durante a partida insere uma pílula de sistema entre as falas, no mesmo formato do bloco de rolagem de dados, dizendo para qual idioma se trocou (ver *Aviso de troca de idioma no chat*).
- **Guardrail parametrizado:** `detectLanguageDrift(narration, targetLocale)` — alvo `pt-BR` mantém o critério de hoje; alvo `en-US` inverte (deriva quando PT supera EN). Os dois chamadores (bake-off e teste) passam o alvo.
- Testes: unitários do guardrail nos dois alvos, teste da resolução do locale no serviço, e regressão de que o prompt gerado com `locale: 'en-US'` contém a instrução EN e **não** contém a regra de pt-BR.

### Fora do escopo

- **i18n das strings da UI web** (extração, mecanismo, arquivos de mensagem) — [**US-98**](./US-98-i18n-da-interface-web.md). É "o grosso do trabalho novo" pelo ADR 005: **com `locale: 'en-US'`, esta US entrega narração em inglês numa interface ainda em português.** Por isso as duas (mais a US-99) saem no mesmo release — ver *Ordem de entrega*. Recomendação de forma: [*Nota para a story de i18n*](#nota-para-a-story-de-i18n-da-ui), abaixo.
- **`config` do sistema no locale ativo** (atributos, perícias, classes, magias servidos em EN cru em vez do overlay pt-BR) — [**US-99**](./US-99-config-do-sistema-no-locale-ativo.md).
- **Ficha por idioma** (`features`/`spells` de texto materializado para chave + migração de dados) — [**US-100**](./US-100-ficha-do-personagem-no-locale-ativo.md), fase "Ficha" do ADR 005. Até lá, a ficha mostra o texto copiado na criação.
- **Ganchos de aventura em inglês** — [**US-101**](./US-101-ganchos-de-aventura-em-ingles.md). Os 13 ganchos da [US-28](./US-28-aventura-inicial-baseada-na-classe.md) são autorais em PT e continuam PT: o convite da aventura, o título da campanha, a quest principal e a semente da abertura.
- **Tradução automática do SRD** ([US-52](./US-52-traducao-automatica-do-srd.md)) e novos overlays de locale.
- Idiomas além de PT-BR e EN. O campo é `String` e o overlay é `locale/{xx}.json`, então um terceiro cabe sem redesenho — mas não entra aqui.

### Nota para a story de i18n da UI

> *Fora do escopo desta US — registrado aqui para não se perder, já que é a story que a segue.*

**i18n** (*internationalization*: i + 18 letras + n) é tirar o texto de dentro do componente e resolvê-lo por chave, num arquivo por idioma. Hoje a string está cravada no JSX:

```tsx
// apps/web/src/components/HomeHero.tsx:29
<p className="mt-3 text-sm text-muted-foreground">Você ainda não tem nenhum personagem.</p>
```

Com i18n, vira `{t('home.semPersonagem')}` + dois dicionários (`pt-BR` e `en-US`).

O trabalho tem três partes: **extrair** cada string visível dos componentes ([`SetupWizard.tsx`](../../../apps/web/src/components/setup/SetupWizard.tsx) — rótulos das 6 etapas, botões, erros de validação; [`GameView.tsx`](../../../apps/web/src/components/game/GameView.tsx); [`HomeHero.tsx`](../../../apps/web/src/components/HomeHero.tsx); [`AuthNav.tsx`](../../../apps/web/src/components/AuthNav.tsx); [`login/page.tsx`](../../../apps/web/src/app/login/page.tsx)); **escolher o mecanismo** que entrega a tradução e reage à troca de idioma; e **traduzir** — incluindo o que não é parágrafo: `aria-label`/`title` ([`ThemeToggle.tsx`](../../../apps/web/src/components/ThemeToggle.tsx) — "Mudar para modo claro"), `<title>` das páginas, mensagens de erro e o atributo `lang` do `<html>` (o leitor de tela usa para escolher a voz — regra da [US-46](./US-46-acessibilidade-wcag-aa.md)).

**Recomendação: dois objetos TS e um `t()` de uma linha, sem lib.** São 2 idiomas, sem plural complexo e sem formatação de data/moeda. `next-intl` e afins pagam roteamento por locale (`/en/...`, `/pt-BR/...`) e ICU MessageFormat — **nenhum dos dois serve aqui**, porque o idioma vem de `User.locale`, não da URL (D1 do [ADR 005](../../adr/005-locale-como-dimensao.md)). A lib entra quando aparecer um terceiro idioma ou plural de verdade; até lá é dependência e configuração para resolver um `Record<string, string>`.

**Não confundir com as outras duas frentes de idioma**, separadas de propósito: as labels do `config` (`'Força'`, [`seed.ts:17`](../../../apps/api/prisma/seed.ts)) são **dado**, resolvidas pelo overlay `locale/pt-BR.json` da [US-47](./US-47-ingestao-srd-como-dado.md); e a ficha (`features`/`spells`) é a fase "Ficha" do ADR 005. i18n da UI é só o texto escrito à mão no front.

---

## Ordem de entrega

> *Resolve a antiga Questão em aberto #1 ("expor a opção EN antes da i18n da UI?"), decidida em 30/07/2026.*

**A pergunta não era ordem de implementação — era gate de exposição.** A i18n **não** vem antes: sem `User.locale` e sem seletor, ela não tem o que ler para escolher o dicionário nem evento ao qual reagir. Esta story é o pré-requisito das outras duas.

**São três stories, não duas.** Além da interface, os dados de sistema também estão em português no banco: o `ingest` aplica o overlay pt-BR em build e grava um artefato só ([`ingest.mjs:169-170`](../../../scripts/srd/ingest.mjs)), que o `seed` grava em `System.config` ([`seed.ts:393`](../../../apps/api/prisma/seed.ts) e `:423`).

| Story | Entrega | Sem ela, o jogador EN vê |
|---|---|---|
| **US-97** (esta) | preferência + narração e abertura em inglês | não tem onde escolher o idioma |
| [**US-98**](./US-98-i18n-da-interface-web.md) — i18n da UI | strings do front | login, home, wizard e botões em PT — **não completa o onboarding** |
| [**US-99**](./US-99-config-do-sistema-no-locale-ativo.md) — `config` por locale | atributos, perícias, classes e magias em inglês | "Força" e "Atletismo" dentro de uma interface inglesa |
| [**US-101**](./US-101-ganchos-de-aventura-em-ingles.md) — ganchos em EN *(entrada no gate a decidir)* | convite da aventura, título da campanha e quest principal em inglês | a última tela antes da mesa em PT, e a quest em PT dentro do prompt do Mestre |

A US-101 é a única das quatro cujo custo é de **redação** (~2.000 palavras), não de código — por isso a entrada dela no gate fica em aberto na própria story (*Questões em aberto* #2). O argumento a favor é que ela é a única coisa entre o wizard traduzido e a mesa; o contra é que não impede jogar.

A [**US-100**](./US-100-ficha-do-personagem-no-locale-ativo.md) (ficha por chave) **não** entra nesse gate: depois da US-99, um personagem criado em inglês já nasce com feature e magia em inglês, porque a criação copia do `config` do momento. A US-100 conserta o caso da **troca** — ficha criada num idioma, lida noutro —, que é defeito real mas não impede ninguém de jogar. Fica para depois do lançamento do EN.

**Decisão: US-97, US-98 e US-99 entram no mesmo release, sem feature flag** (a US-101 fica pendente da decisão acima). Esta story é a primeira a implementar (as outras dependem dela), mas **não vai a produção sozinha com a opção EN visível** — um jogador que não lê português trava no wizard antes de chegar à mesa, e aí a narração inglesa não serve para nada. É ordem de release, não chaveamento em runtime: zero código de flag.

Corolário para o escopo: o que esta story entrega isoladamente é **fundação verificável por teste** (schema, endpoint, prompt, guardrail), não valor de tela para o jogador anglófono. Quem mede a story pelo que o jogador vê tem de medir as três juntas.

---

## Modelo de dados proposto

```prisma
model User {
  // ...campos atuais
  locale String @default("pt-BR") // US-97: 'pt-BR' | 'en-US' — preferência mutável (ADR 005)
}
```

| Campo | Tipo | Descrição |
|---|---|---|
| `User.locale` | `String` (default `"pt-BR"`) | Idioma ativo da conta. Aplica ao conteúdo **futuro**: narração nova e abertura. Mutável a qualquer momento. |

**Persistência:** coluna em `User` (Postgres/Neon). Migração com default — nenhuma linha existente muda de comportamento. **Nenhum campo novo no `Character`** (ADR 005, D2/decisão 5): a ficha não tem língua própria.

Antes do login o valor mora em `localStorage` (mesma chave-de-produto do tema, `ai-dm-locale`), e é enviado no primeiro `/auth/sync`.

---

## Critérios de aceite

- [ ] `User.locale` existe no schema com default `'pt-BR'` e migração aplicada; usuários existentes seguem em PT-BR sem ação nenhuma.
- [ ] Existe seletor de idioma com as duas opções (Português / English) e indicação de qual está ativa, presente em **todas** as telas: login, home, wizard, gancho e mesa — logo, **antes do login** e **antes de existir personagem**.
- [ ] No login o seletor está visível **sem rolagem**, em 375px de largura (é a tela que decide se o anglófono continua).
- [ ] O seletor **não** é um terceiro controle `fixed` no canto: nas telas de `SceneFrame` vive no `<header>` da marca, na mesa vive no cabeçalho da ficha. Em 375px, a barra "Ficha — {nome}" continua mostrando o nome do personagem sem truncar mais do que hoje.
- [ ] Cada opção tem alvo de 44px, o grupo tem `aria-label` e a opção ativa é anunciada ([US-46](./US-46-acessibilidade-wcag-aa.md)).
- [ ] Trocar o idioma atualiza o atributo `lang` do `<html>` (hoje cravado em `pt-BR`).
- [ ] Na primeira visita sem preferência salva, a opção ativa vem do idioma do browser, casado pela subtag: `pt`, `pt-PT` e `pt-BR` caem em `pt-BR`; `en`, `en-GB` e qualquer outra coisa caem em `en-US`.
- [ ] Trocar o idioma persiste: recarregar a página (ou entrar de outro dispositivo com a mesma conta) mantém a escolha.
- [ ] O cliente **não** manda o locale no turno: a API resolve pelo `userId` do token (padrão da [US-61](./US-61-login-do-jogador.md)).
- [ ] Com `locale = 'en-US'`, a **abertura** da aventura e os turnos seguintes vêm em inglês, sem o jogador ter escrito nada em inglês.
- [ ] Com `locale = 'pt-BR'`, a narração continua idêntica ao comportamento de hoje (incluindo a regra de pt-BR brasileiro natural do prompt).
- [ ] Trocar o idioma no meio de uma aventura afeta só a narração **nova**: o `EventLog` já gravado fica como está.
- [ ] Trocar o idioma com a mesa aberta mostra, entre as falas, uma pílula de sistema no formato do bloco de rolagem, nomeando **só** o idioma novo e escrita nele.
- [ ] Essa pílula **não** é persistida nem enviada ao Mestre: recarregar a página não a traz de volta, e o histórico que vai ao modelo não a contém.
- [ ] `detectLanguageDrift` recebe o idioma-alvo e acusa deriva na direção certa nos dois sentidos; nenhum chamador o invoca mais sem alvo.
- [ ] **Eval / teste de regressão:** (a) `detectLanguageDrift(narraçãoEN, 'en-US').drift === false` e `detectLanguageDrift(narraçãoPT, 'en-US').drift === true` — falha se o guardrail continuar cravado em PT; (b) o system prompt construído com `locale: 'en-US'` contém a instrução de narrar em inglês e não contém a seção de pt-BR — falha se o locale não chegar ao prompt.

---

## Notas de implementação

> *Dicas e decisões técnicas para quem vai implementar. Não é especificação obrigatória — o implementador pode divergir com boa justificativa.*

- **A instrução de idioma vai na camada estável do system prompt**, não no bloco de estado do turno ([US-55](./US-55-prompt-caching-do-dm.md)/[US-56](./US-56-estado-do-turno-na-mensagem.md)): o locale é estável por usuário. Trocar de idioma invalida o cache do prompt uma vez — aceitável, é evento raro.
- **Não deixe o espelhamento e o alvo brigarem.** `dm-system.ts:279` e `:295` mandam responder "na língua do jogador". Com alvo explícito, o jogador que digitar em português numa partida EN passa a receber inglês. É o comportamento pretendido (o alvo manda), mas precisa ser escolhido conscientemente ao editar as duas linhas.
- **Layout dos controles fixos:** `ThemeToggle` ocupa `top-4 right-4` e `AuthNav` `top-4 right-16` — o comentário na [`AuthNav.tsx`](../../../apps/web/src/components/AuthNav.tsx) registra que a folga foi calculada à mão na [US-66](./US-66-telas-mobile-friendly.md). Um terceiro controle no canto exige refazer essa conta (ou agrupar os três num só container).
- `ThemeToggle.tsx` é o padrão de toggle a copiar em forma/acessibilidade (`aria-label`, alvo de 44px), mas **não** em persistência: tema é só `localStorage`, idioma é conta.
- A escada de resolução do locale — `User.locale` → `localStorage` → `navigator.language` → `'pt-BR'` — deve existir **em um lugar só**; duas cópias divergem na primeira mudança de default.
- `detectLanguageDrift` já conta os dois lados (`PT_MARKERS` + diacríticos vs. `EN_MARKERS`): o alvo escolhe qual placar é o "certo", o piso de 3 marcadores fica como está.
- Arquivos principais: [`schema.prisma`](../../../apps/api/prisma/schema.prisma), [`auth.controller.ts`](../../../apps/api/src/auth/auth.controller.ts), [`ai.service.ts`](../../../apps/api/src/ai/ai.service.ts) (é quem monta o prompt e chama a abertura), [`dm-system.ts`](../../../packages/ai-engine/src/prompts/dm-system.ts), [`guardrails.ts`](../../../packages/ai-engine/src/guardrails.ts), [`AuthNav.tsx`](../../../apps/web/src/components/AuthNav.tsx).
- Lembrete do repo: mexeu em `packages/ai-engine/src`, rode `pnpm --filter @ai-dm/ai-engine build` — a API roda o `dist`.

---

## Questões em aberto

~~1. **Expor a opção EN antes da i18n da UI?**~~ — **Resolvida em 30/07/2026. Ver *Ordem de entrega*, abaixo.**

~~2. **Qual chave de locale para o inglês** — `'en'` ou `'en-US'`?~~ — **Resolvida em 30/07/2026: `en-US` e `pt-BR`.** Os dois locales passam a ter a mesma forma (`idioma-REGIÃO`), em vez de uma chave curta e uma longa convivendo. O ADR 005 usava `'en'` e foi corrigido junto. Consequências para quem implementa: a escada de resolução casa pela **subtag de idioma** (`navigator.language` devolve `en-GB`, `pt-PT`), e a base nativa continua **sem arquivo de overlay** — `en-US` é o dataset cru, não `locale/en-US.json`.
~~3. **Aventura em andamento:** vale um aviso ou troca silenciosa?~~ — **Resolvida em 30/07/2026: aviso, dizendo só o idioma novo.** Pílula de sistema no chat, no formato do bloco de rolagem — ver *Aviso de troca de idioma no chat*.

---

## Referências no código

- [`apps/api/prisma/schema.prisma:12`](../../../apps/api/prisma/schema.prisma) — `model User`; hoje sem nenhuma preferência. É o campo novo desta story.
- [`apps/api/src/auth/auth.controller.ts:19`](../../../apps/api/src/auth/auth.controller.ts) — `@Post('sync')`, único endpoint do módulo; ponto de entrada natural para ler/escrever a preferência.
- [`packages/ai-engine/src/prompts/dm-system.ts:140`](../../../packages/ai-engine/src/prompts/dm-system.ts) — regra `LANGUAGE`, hoje só sobre pt-BR brasileiro natural; passa a ser condicional ao alvo.
- [`packages/ai-engine/src/prompts/dm-system.ts:279`](../../../packages/ai-engine/src/prompts/dm-system.ts) e `:295` — as duas linhas que hoje espelham o idioma do jogador.
- [`packages/ai-engine/src/prompts/dm-system.ts:165`](../../../packages/ai-engine/src/prompts/dm-system.ts) — `buildDmSystemPrompt`, e `:524` `buildOpeningInstruction`: os dois que ganham o parâmetro de locale.
- [`packages/ai-engine/src/guardrails.ts:78`](../../../packages/ai-engine/src/guardrails.ts) — `detectLanguageDrift`, cravado em PT.
- [`packages/ai-engine/run-bakeoff.mjs:77`](../../../packages/ai-engine/run-bakeoff.mjs) e [`narrative-bakeoff.test.ts:297`](../../../packages/ai-engine/src/narrative-bakeoff.test.ts) — os dois chamadores do guardrail (nenhum em produção).
- [`apps/web/src/components/ThemeToggle.tsx`](../../../apps/web/src/components/ThemeToggle.tsx) e [`AuthNav.tsx`](../../../apps/web/src/components/AuthNav.tsx) — controles fixos do canto superior: forma a copiar e colisão de layout a resolver.
- [`apps/api/prisma/seed.ts:17`](../../../apps/api/prisma/seed.ts) — labels de atributo em PT literal, e `:152` em diante, `openingNarration` autoral em PT (ambos fora do escopo, citados para delimitar).
- [`scripts/srd/locale/pt-BR.json`](../../../scripts/srd/locale/pt-BR.json) — o overlay já existe como localização de *um* locale; `en-US` é a base sem arquivo.
