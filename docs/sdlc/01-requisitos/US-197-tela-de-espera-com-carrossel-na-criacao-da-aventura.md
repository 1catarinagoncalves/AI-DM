# US-197 — Tela de espera com carrossel de mensagens na criação da aventura

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** [US-157](./US-157-tela-de-mundo-depois-da-revisao.md) (passo `world`, estado `starting`, `createWorldAdventure`)
**Criada em:** 2026-08-24

---

## História

> **Como** jogador que acabou de terminar a criação do personagem,
> **quero** ver uma tela dedicada com mensagens variando enquanto a aventura é gerada,
> **para que** eu saiba que o sistema está trabalhando e a espera não pareça travada ou vazia.

---

## Contexto e motivação

### O problema observado

Hoje, ao clicar em "Criar aventura" no passo `world`, o único feedback de carregamento é o
próprio botão trocar de rótulo: `starting ? t('setup.world.starting') : t('setup.world.start')`
([SetupWizard.tsx:1096-1099](../../../apps/web/src/components/setup/SetupWizard.tsx)), com o
texto fixo "Criando aventura..." (`setup.world.starting`, [pt-BR.ts:77](../../../apps/web/src/messages/pt-BR.ts)).
O resto da tela `world` — os três `WorldOptionGroup`, o `ChallengeOptionGroup` — continua visível
e parado atrás do botão desabilitado.

### Por que a solução atual não basta

`createWorldAdventure` ([SetupWizard.tsx:473-486](../../../apps/web/src/components/setup/SetupWizard.tsx))
faz uma chamada a `api.createAdventure`, que no servidor dispara o motor de geração —
múltiplas chamadas de LLM em sequência (abertura, encontros, segredos; ver
[US-153 §Achado](./US-153-aventura-deixa-de-ser-derivada-da-classe.md)). Isso não é uma espera de
rede curta: é da ordem de dezenas de segundos. Um rótulo de botão estático, com o formulário
ainda visível atrás, não comunica progresso nem ocupa a atenção do jogador por esse tempo —
lê como uma tela travada, não como trabalho em andamento.

### A proposta

Quando `starting` fica `true`, a etapa `world` deixa de mostrar o formulário e passa a mostrar
uma tela de espera dedicada: uma mensagem de um conjunto fixo, trocando por outra do mesmo
conjunto a cada intervalo, até a chamada resolver e o `router.push` navegar para `/play/:id`.

---

## Escopo

### Dentro do escopo

- **Novo componente** (ex.: `AdventureLoadingScreen`) renderizado no lugar do formulário do
  passo `world` quando `starting === true` — não um estado extra dentro do JSX atual, substitui
  a `div` do formulário e o footer de botões daquele passo (nenhuma ação possível durante a
  espera; não há "Voltar" nem outro clique).
- **Carrossel de mensagens**: um array de 6 strings genéricas/atmosféricas (tema "o mestre está
  preparando sua aventura", inspiradas nas etapas reais do motor — mundo, locais/NPCs, segredos,
  antagonista, encontros, fecho — sem prometer progresso literal; ver *Copy das mensagens*
  abaixo para o texto final nos dois locales), uma visível por vez, trocando em intervalo fixo
  (2,5-4s) via `setInterval`/`useEffect`, com `aria-live="polite"` no contêiner de texto para
  leitores de tela acompanharem a troca.
- **Ordem das mensagens**: sequencial ou embaralhada uma vez no mount — não precisa ser
  determinística. Cíclico por design: ao trocar depois da última mensagem do array, volta pra
  primeira (`(i + 1) % length`, sem índice fora do array) — não para nem fica em branco se a
  geração demorar mais que o array inteiro.
- **Chaves de i18n novas em `setup.world.loading.*`** (o array de mensagens), nos dois locales
  (pt-BR/en-US), mesma disciplina de dicionário do resto do wizard — nenhuma string literal solta.
- **Limpeza do intervalo** no unmount (a troca de rota em `createWorldAdventure` desmonta o
  wizard; o `useEffect` do carrossel precisa `clearInterval` no cleanup, senão o teste acusa
  warning de state update pós-unmount).
- **Imagem de fundo em pixel arte**: durante a espera, o fundo troca para
  `/scenes/arboretum-moonlit.png` — asset já existe em
  [apps/web/public/scenes](../../../apps/web/public/scenes), hoje sem nenhuma tela que o use
  (`tavern.png` já é o fundo do hub/wizard, `gate-entrance.png` já é o do login; este é o único
  dos três livre). Jardim de alquimista à noite, sob lua cheia — combina com o tom "algo está
  sendo preparado nos bastidores" da story, sem gerar asset novo. **Não** é um `SceneFrame`
  aninhado dentro do componente novo — `SceneFrame` ([dm.tsx:109-166](../../../apps/web/src/components/ui/dm.tsx))
  já renderiza cabeçalho/logo/toggle por inteiro; aninhar duplicaria esse cabeçalho. A troca é na
  prop `scene` do `SceneFrame` que já envolve o `SetupWizard` inteiro
  ([SetupWizard.tsx:556](../../../apps/web/src/components/setup/SetupWizard.tsx)):
  `scene={starting ? '/scenes/arboretum-moonlit.png' : '/scenes/tavern.png'}`. **Correção
  pós-implementação**: `dim` NÃO fica fixo em `"heavy"` — vira `dim={starting ? 'medium' :
  'heavy'}`. A ideia original era manter `"heavy"` porque o `Panel` (quase opaco,
  `--panel-top`/`--panel-bottom` em ~94% alfa) continuaria por baixo do texto; na prática, com
  o Panel por baixo, `"heavy"` (overlay de 88%) apagava a cena quase por inteiro — o fundo
  trocado não aparecia. A tela de espera saiu de dentro do `Panel` (ver nota abaixo) e passou a
  usar `dim="medium"`, o mesmo que `app/page.tsx` (home) e `app/login/page.tsx` já usam quando
  o texto fica direto sobre a arte de cena, sem card por baixo.

### Fora do escopo

- **Barra de progresso real / percentual** — o servidor não expõe progresso incremental da
  geração (é uma chamada HTTP síncrona); esta story não pede isso ao backend, só melhora o
  feedback visual do lado do cliente enquanto a promise não resolve.
- **Mudar `createWorldAdventure` ou o contrato de `api.createAdventure`** — a chamada e o
  `router.push` no sucesso continuam exatamente como estão; esta story só troca o que é
  renderizado enquanto `starting` é `true`.
- **Erro de geração** — `catch { setError(...); setStarting(false) }` já existe
  ([SetupWizard.tsx:485](../../../apps/web/src/components/setup/SetupWizard.tsx)) e volta pro
  formulário com a mensagem de erro; esta story não muda esse caminho, só a tela do caminho feliz
  enquanto aguarda.
- **Ilustração ou ícone animado** — a tela de espera é só texto (mensagem + `aria-live`); nenhum
  asset visual novo nesta story.

---

## Critérios de aceite

- [ ] Ao clicar em "Criar aventura" (`setup.world.start`), o formulário do passo `world`
      (grupos de rádio + footer de botões) desaparece e dá lugar à tela de espera.
- [ ] A tela de espera mostra uma mensagem por vez, de um conjunto de pelo menos 4 mensagens
      distintas vindas de `setup.world.loading.*`, nos dois locales.
- [ ] A mensagem visível troca automaticamente em intervalo fixo, sem interação do jogador.
- [ ] Ao trocar depois da última mensagem do array, a próxima é a primeira (loop, não para/branco).
- [ ] O contêiner da mensagem tem `aria-live="polite"` (auditável por teste de acessibilidade).
- [ ] Enquanto `starting === true`, o fundo do `SceneFrame` é `/scenes/arboretum-moonlit.png`
      (não `tavern.png`); volta a `tavern.png` se `starting` voltar a `false` (caminho de erro).
- [ ] Nenhuma string literal solta no JSX do componente novo (gate US-102).
- [ ] Ao resolver `api.createAdventure` com sucesso, a navegação para `/play/:id` acontece
      normalmente e o intervalo do carrossel é limpo (sem warning de update pós-unmount em teste).
- [ ] Em caso de erro na criação, a tela volta a mostrar o formulário do passo `world` com a
      mensagem de erro — mesmo comportamento de hoje, não regride.
- [ ] A tela responde ao layout mobile ([US-66](./US-66-telas-mobile-friendly.md)) e passa nos
      critérios de contraste/foco da [US-46](./US-46-acessibilidade-wcag-aa.md).
- [ ] `pnpm typecheck` e `pnpm test` (web) passam.
- [ ] **Eval / teste de regressão:** teste de componente que dispara `createWorldAdventure`,
      avança os timers (`vi.useFakeTimers`/`act`) e confirma que a mensagem visível muda entre
      pelo menos duas do conjunto antes da promise resolver; teste que confirma `clearInterval`
      é chamado no unmount (mock de `clearInterval` ou spy no cleanup do efeito).

---

## Notas de implementação

- **Ponto de inserção real** (correção pós-implementação — não é dentro do bloco `world` como
  planeado): o `Panel` inteiro vira condicional, ANTES de abrir — `{step === 'world' &&
  starting ? <div className="flex flex-1 flex-col"><AdventureLoadingScreen /></div> :
  <Panel>...formulário de todas as etapas, incluindo `world`, e o footer de botões...</Panel>}`.
  O bloco `{step === 'world' && (...)}` original (dentro do `Panel`) volta a mostrar só o
  formulário, sem ternário — `starting` nunca é `true` quando esse bloco renderiza, porque o
  `Panel` inteiro já não existe nesse caso. O footer some junto (fica dentro do `Panel`, que
  não renderiza).
- **`SceneFrame` continua envolvendo tudo, `Panel` NÃO** (correção pós-implementação) — a tela
  de espera é conteúdo interno, não uma rota nova nem um layout próprio, mas fica FORA do
  `Panel` (o cartão quase opaco que envolve o formulário nas outras etapas). Dentro do `Panel`
  o fundo trocado ficava invisível atrás do cartão — mesmo problema do `dim="heavy"` acima.
  `{step === 'world' && starting ? <AdventureLoadingScreen /> : <Panel>...</Panel>}` decide,
  antes do `Panel` abrir, se ele renderiza ou se a tela de espera toma o lugar inteiro.
- **Nenhum `text-shadow-fantasy` na mensagem** — utilitário reservado a títulos serif
  (`SectionTitle`), nunca em texto corrido (comentário no próprio `globals.css`); a legibilidade
  da mensagem vem do `dim="medium"` acima, não de sombra no texto do parágrafo.
- **Mensagem usa `font-serif`** — `text-lg text-parchment` sozinho (sem `font-serif`) destoava
  da tipografia do resto do wizard; o padrão de mensagem única ambiente sobre arte de cena
  (`GameView.tsx` `game.empty.title`, `HomeHero.tsx`) é sempre `font-serif text-lg text-parchment`.
- **Intervalo do carrossel**: `useEffect` local ao componente novo (não ao `SetupWizard`), criado
  só quando montado (ou seja, só quando `starting` vira `true`) — assim o cleanup é automático no
  unmount por troca de `step`/desmonte do wizard inteiro, sem precisar coordenar com `starting`
  manualmente.
- **Reaproveitar `SectionTitle`/tipografia existente** do resto do wizard para a mensagem
  principal, em vez de estilo novo — mesma linguagem visual das outras telas.

---

## Copy das mensagens

Decisão da questão em aberto #1: **genéricas/atmosféricas**, não progresso literal — cada
mensagem evoca uma etapa real da *Ordem de geração* do motor ([US-164](./US-164-orquestrador-motor-monta-aventura-gerada.md)
passos 0-6: rolagem → locais/NPCs → segredos → antagonista → encontros → fecho), mas nenhuma
promete estar "naquela fase agora" — só ambienta. Evita o acoplamento apontado na questão original:
se a ordem do motor mudar (ex.: [US-190](./US-190-antagonista-vira-passo-proprio-entre-segredos-e-encontros.md)
moveu o antagonista para entre segredos e encontros), a lista não desalinha porque não afirma
sequência, é embaralhada ou cíclica (`% length`) por design.

`setup.world.starting` ("Criando aventura...") continua existindo para o rótulo do botão
([SetupWizard.tsx:1096-1099](../../../apps/web/src/components/setup/SetupWizard.tsx)) e dobra
como a primeira mensagem do carrossel — não duplica string.

| Chave | pt-BR | en-US |
|---|---|---|
| `setup.world.loading.1` | Povoando o mundo com seus primeiros habitantes... | Populating the world with its first inhabitants... |
| `setup.world.loading.2` | Semeando segredos pelos cantos do mapa... | Sowing secrets across the map... |
| `setup.world.loading.3` | Dando rosto a quem vai se opor a você... | Giving a face to whoever stands against you... |
| `setup.world.loading.4` | Escolhendo os primeiros perigos do caminho... | Choosing the first dangers on your path... |
| `setup.world.loading.5` | Amarrando os fios que vão puxar a história... | Tying the threads that will pull the story forward... |
| `setup.world.loading.6` | Afiando os detalhes antes de abrir a cortina... | Sharpening the details before the curtain opens... |

Nenhuma menciona nome de NPC, local ou segredo específico gerado — são atmosféricas por design,
reaproveitáveis em qualquer aventura, sem risco de destoar do conteúdo real que sai do motor.

---

## Questões em aberto

1. ~~As mensagens do carrossel devem ser específicas do que o motor está fazendo em cada fase...
   ou genéricas/atmosféricas?~~ **Resolvida** — ver *Copy das mensagens* acima.
2. ~~Ilustração ou ícone animado acompanhando o texto, ou só texto?~~ **Resolvida** — só texto.
   Sem ilustração/ícone animado nesta story; fica fora do escopo mínimo, não uma decisão de custo.

---

## Referências no código

- [apps/web/src/components/setup/SetupWizard.tsx:246](../../../apps/web/src/components/setup/SetupWizard.tsx) — estado `starting`.
- [apps/web/src/components/setup/SetupWizard.tsx:473-486](../../../apps/web/src/components/setup/SetupWizard.tsx) — `createWorldAdventure`, onde `starting` liga/desliga.
- [apps/web/src/components/setup/SetupWizard.tsx:1061-1080](../../../apps/web/src/components/setup/SetupWizard.tsx) — JSX do passo `world`, ponto de inserção da tela nova.
- [apps/web/src/components/setup/SetupWizard.tsx:1095-1099](../../../apps/web/src/components/setup/SetupWizard.tsx) — botão com rótulo `setup.world.starting`, hoje o único feedback de carregamento.
- [apps/web/src/messages/pt-BR.ts:77](../../../apps/web/src/messages/pt-BR.ts), [en-US.ts:73](../../../apps/web/src/messages/en-US.ts) — `setup.world.starting`, chave existente a manter (ou reaproveitar como uma das mensagens do carrossel).
- [apps/web/src/components/ui/dm.tsx:109-166](../../../apps/web/src/components/ui/dm.tsx) — `SceneFrame`, prop `scene`/`dim`; troca de fundo desta story é aqui, não um `SceneFrame` novo.
- [apps/web/public/scenes/arboretum-moonlit.png](../../../apps/web/public/scenes/arboretum-moonlit.png) — asset de fundo desta story (único dos três `scenes/*.png` ainda sem tela dona).
- [US-157](./US-157-tela-de-mundo-depois-da-revisao.md) — story que criou o passo `world` e o estado `starting` que esta story estende.
- [US-46](./US-46-acessibilidade-wcag-aa.md), [US-66](./US-66-telas-mobile-friendly.md), [US-102](./US-102-gate-de-string-literal-no-jsx.md) — disciplinas que toda tela nova do wizard segue.
