# US-124 — Exibir os benefícios narrativos da origem (`adventures_and_advancement`, `connection_and_memento`)

**Épico:** 1 — Personagem
**Fase:** 1 — MVP single-player
**Status:** 🚧 Em progresso
**Depende de:** [US-121](./US-121-catalogo-backgrounds-a5e-adventurers-guide.md) (catálogo `config.backgrounds`, `benefits[].description` já traz o texto cru) · [US-122](./US-122-escolha-background-catalogo-na-criacao.md) (escolha de origem — é o `origin.key` selecionado que decide o que mostrar)
**Relacionado:** [US-39](./US-39-identidade-narrativa-background-ideais.md) (`Character.background.bonds`/`story` — onde o jogador pode copiar à mão uma conexão/memento, sem automação, ver US-121 §Nomenclatura) · [US-123](./US-123-integracao-mecanica-background-pointbuy-proficiency.md) (mecaniza os OUTROS dois tipos de benefício; estes dois ficam de fora de propósito lá)
**Criada em:** 2026-08-08

---

## História

> **Como** jogador,
> **quero** ler o texto completo dos benefícios "Adventures and Advancement" e "Connection and Memento" da origem que escolhi,
> **para que** eu tenha os ganchos narrativos (conexão pessoal, item de memento, como a origem evolui em jogo) para me inspirar ao escrever minha história — hoje esses dois tipos só aparecem como um nome de linha no cartão, sem o texto em si em lugar nenhum.

---

## Contexto e motivação

### O problema observado

A US-122 resume cada cartão de origem com `benefits.map(b => b.name).join(' · ')` — só o **nome** do benefício ("Adventures and Advancement", "Connection and Memento"), nunca o `description`. A decisão foi deliberada (US-122, nota do cartão: "não renderizar `description` no cartão... descrição completa fica para uma story de detalhe, se a UX pedir depois") — mas para estes dois tipos especificamente, o nome sozinho não serve pra nada: são os únicos dois tipos que a US-123 **não mecaniza** (ver lá, §Fora do escopo — sem catálogo de conexões/mementos no sistema) e que a US-121 **não pré-preenche** na identidade (§Nomenclatura — catálogo e prosa livre convivem distintos). Sem esta story, `adventures_and_advancement`/`connection_and_memento` de qualquer uma das 21 origens ficam **inacessíveis** — o dado existe no `config`, mas nenhuma tela mostra o texto.

### O que o dataset realmente contém (medido em 08/08/2026; 3 armadilhas adicionais achadas em produção 12/08/2026, ao validar contra as 21 entradas reais de `scripts/srd/_data/BackgroundBenefit.json` — não só o Acolyte)

**`adventures_and_advancement`** é prosa corrida — parágrafo único, sem estrutura interna (mesmo tratamento de `hook.openingNarration` já renderizado em `SetupWizard.tsx`).

**`connection_and_memento`** é **Markdown com tabelas d10**, não prosa. Forma real do Acolyte (`a5e-ag_acolyte_connection-and-memento`, medido direto do dataset — `\r\n`, não `\n`, e uma linha **em branco** entre o heading e a tabela):

```
Roll 1d10, choose, or make up your own.\r\n
\r\n
#### Acolyte Connections\r\n
\r\n
|d10|Connection|\r\n
|---|---|\r\n
|1|A beloved high priest or priestess awaiting your return to the temple...|\r\n
...(9 linhas)
\r\n
### Acolyte Memento\r\n
\r\n
|d10|Memento|\r\n
|---|---|\r\n
|1|The timeworn holy symbol bequeathed to you by your beloved mentor...|\r\n
...(9 linhas)
```

Dois blocos — um de **conexões** (NPC/gancho pessoal), um de **mementos** (objeto) — cada um com uma tabela de 10 linhas (`d10 → texto`), precedidos de "Roll 1d10, choose, or make up your own." Nível do heading **varia** (`####` na primeira tabela, `###` na segunda — medido no Acolyte).

**Armadilhas reais no dataset** (as 3 exigem o parser degradar sem quebrar — nunca assumir 2 blocos, nunca assumir tabela pipe, nunca assumir `\n` puro):

1. **Sailor** (`a5e-ag_sailor_connection-and-memento`) tem **dois blocos IDÊNTICOS** — a tabela "Sailor Mementos" repetida, com as mesmas 10 linhas, e a seção "Sailor Connections" **não existe**. (Correção 12/08/2026: a redação anterior desta armadilha dizia "só tem um bloco", o que fez a implementação tratar o caso com um `tables.length === 1` que **nunca dispara** — na prática o parser via 2 blocos e a 2ª cópia ia parar no `<select>` de "Conexão", oferecendo mementos como se fossem conexões. Medido nos dois artefatos e no dataset cru.) O parser **deduplica bloco idêntico ao anterior, comparando CONTEÚDO** (heading é traduzido, conteúdo não), e só então sobra 1 bloco — que a curadoria `SINGLE_BLOCK_IS_MEMENTO` mapeia para memento.
2. **CRLF + linha em branco entre heading e tabela**, em TODAS as 21 entradas (não só o Acolyte) — `#### Acolyte Connections\r\n\r\n|d10|...`. Achada em produção depois do primeiro deploy desta story: um parser que fecha o "bloco atual" na primeira linha em branco (lido do §Notas de implementação original) mata o bloco ANTES de qualquer linha de dado ser lida — produzia 2 blocos com 0 linhas cada em 20 das 21 origens, sem lançar exceção (silencioso, não pegou nos testes com fixture sintética sem essa linha em branco). Fix: linha em branco nunca fecha bloco; só heading novo (ou fim do texto) fecha.
3. **Gambler** (`a5e-ag_gambler_connection-and-memento`) usa **lista numerada** (`1. texto`), não tabela pipe (`|1|texto|`) — mesmo heading, formato de LINHA diferente, único caso entre as 21. Parser precisa reconhecer as duas formas por linha (pipe primeiro, lista numerada como fallback).

4. **O `norm()` do ingest achata TUDO — e é essa a forma que a tela lê.** `scripts/srd/ingest.mjs:141` (`(s) => (s || '').replace(/\s+/g, ' ').trim()`) transforma a descrição numa **linha só** antes de gravar em `srd-5e.config.<locale>.json` — o artefato que o `seed.ts` grava no banco e que a criação de personagem consome. Verificado nos dois locales: `description.includes('\n') === false`. Consequência: parser que faça `split('\n')` vê 1 linha, nenhum heading, **0 tabelas** — era a causa raiz do bug relatado (nenhum `<select>` aparecia, mesmo com `adventures_and_advancement`, que é prosa, aparecendo normalmente ao lado). Por isso o parser é **por marcador (regex sobre a string inteira), não por linha**: funciona nas duas formas, sem depender de o ingest mudar.
5. **A tradução pt-BR come o pipe de fechamento do último item.** Em `a5e-ag_criminal` e `a5e-ag_cultist` o item 10 chega como `|10|texto.` (sem `|` final) — exigir o pipe de fechamento descartava a 10ª linha dessas duas origens. Medido no artefato pt-BR real; é a Questão em aberto 1 se materializando de forma mais sutil do que "quebra a tabela".

**Por que só a 4 explica o bug em produção, e por que as outras passaram despercebidas:** as armadilhas 2 e 3 foram achadas rodando o parser contra o **dataset cru**; a 4 e a 5 só apareceram rodando contra o **artefato de config** — a forma realmente consumida. Fixture prova a forma que se assume; dataset cru prova o que o ingest recebe; só o artefato prova o que a tela lê. `parseD10Tables.artifacts.test.ts` fecha isso de vez: roda o parser sobre as 21 origens dos **dois** artefatos de locale **e** sobre o dataset cru, exigindo 2 blocos de 10 linhas (1 no Sailor, pós-dedupe). `parseD10Tables.test.ts` mantém as fixtures pontuais das 5 armadilhas.

### Por que a solução atual não basta

Nenhuma tela do wizard renderiza Markdown hoje — os campos de texto (`openingNarration`, `pitch`) são prosa simples com `whitespace-pre-wrap`. `connection_and_memento` tem tabela de verdade; mostrar como texto corrido despejaria os `|d10|Connection|` crus na tela.

### A proposta

Um parser pequeno e só de front-end (sem tocar ingest/schema — o texto cru já está em `benefits[].description` desde a US-121) que separa blocos `heading + tabela` de um Markdown conhecido, e uma seção de detalhe na etapa `background`/"Origem" (US-122) que aparece quando uma origem está selecionada: `adventures_and_advancement` como parágrafo, `connection_and_memento` como tabela(s) HTML.

---

## Escopo

### Dentro do escopo

- **`parseD10Tables(desc: string)`** (novo utilitário, `apps/web`, só front-end): recebe a `description` crua, devolve `{ tables: { rows: { roll: string, text: string }[] }[] }`. **Heading e preâmbulo do dataset NÃO são extraídos nem retornados** — servem só de marcador interno pro parser achar onde cada tabela começa (regex `^#{2,4}\s+(.+)$` acha a linha, mas o texto do heading é descartado, não vira dado do retorno); o preâmbulo ("Roll 1d10, choose...") também é descartado, não faz parte do resultado. Nº de blocos encontrados **não é assumido fixo** — cobre o caso de 2 (padrão), 1 (Sailor) e, defensivamente, 0.
- **Título e subtítulo fixos na UI**, não importados do dataset: cada bloco (`tables[0]` = Conexão, `tables[1]` = Memento, por **posição**, não por texto de heading) ganha um título fixo (chave de mensagem i18n, ex. `setup.origin.connection`/`setup.origin.memento`) e um subtítulo fixo (chave própria, substitui o "Roll 1d10, choose, or make up your own." do dataset — ex. "Escolha na lista ou sorteie"), nos dois locales. Isso mata de vez o risco de tradução automática (US-52, `MT_DOMAINS`) quebrar heading/preâmbulo (Questões 1/2 antigas): não dependemos mais desse texto pra nada visível.
- **Seção de detalhe** na etapa `background`, visível só quando `origin.key` (US-122) aponta para uma origem com esses benefícios: `adventures_and_advancement` renderizado como parágrafo (`whitespace-pre-wrap`, mesmo padrão de `hook.openingNarration`); `connection_and_memento` renderizado como título+subtítulo fixos + `<select>` por bloco do parser (linhas = `text` de cada `roll`).
- **Seleção da conexão e do memento.** Cada bloco (`Connections`, `Mementos`) ganha uma caixa de seleção própria (`<select>`, mesmo padrão do select de Raça/Classe/Origem, US-105/US-122) com as 10 linhas da tabela daquele bloco como opções (`value` = `roll`, texto exibido = `text`), e um botão "aleatório" ao lado que sorteia um índice e seta o `<select>` pra aquela opção. O jogador pode trocar a opção manualmente a qualquer momento, antes ou depois de clicar "aleatório" — o botão só pré-preenche, não trava a escolha.
- Sem opção "outra"/campo livre na caixa de seleção — o catálogo são as 10 linhas do dataset; texto livre pra conexão/memento fora dessas 10 continua sendo `bg.story`/`bonds` (US-39), como já era.
- **Persistência.** `origin.connection`/`origin.memento` viajam no `POST /characters` junto com `origin.key` (mesmo payload, US-122) e são gravados no `Character.origin` (Json, ver §Modelo de dados proposto) — só no submit final do wizard, mesmo momento em que `background` é persistido, sem autosave intermediário (mesmo padrão de risco que `bg.story` já tinha, ver Questão 3 resolvida abaixo).
- **Tela de revisão do wizard** (`step: 'review'`): nova linha (ou sublinha da linha de Origem já existente, US-122) mostrando a conexão e o memento escolhidos, mesmo padrão das outras linhas de revisão (`dt`/`dd`); "—" quando o jogador não selecionou nada.
- **Ficha do personagem** (`GameView.tsx`/`BackgroundPanel`, aba "Background", US-45): nova seção mostrando `origin.connection`/`origin.memento` quando presentes — requer o fetch do personagem (rota GET consumida por `apps/web/src/app/play/[adventureId]/page.tsx`) devolver `origin`, hoje não devolve nenhum campo de `origin` pra tela de jogo (só o wizard lê `System.config.backgrounds`). Checar o endpoint/serializer de personagem antes de assumir que o campo já chega no client.
- **Teste do parser** (`apps/web`, unitário): fixture com 2 blocos (caso comum), fixture com 1 bloco só (reproduz a anomalia do Sailor), fixture com heading em nível diferente (`###` vs `####`) — os três **não podem lançar exceção** nem produzir tabela vazia quando há conteúdo.

### Fora do escopo

- **Dado mecânico de verdade (Game Server, determinístico, logado)** — o "aleatório" desta story é sorteio de **texto de flavor**, sem consequência de regra; não é um roll de personagem e não passa pelo Game Server (ver §Notas de implementação, contraste com "Dados rolados deterministicamente no Game Server" do CLAUDE.md, que vale para mecânica de jogo, não para esta escolha narrativa).
- **Copiar a opção escolhida para `Character.background.bonds`/`story`** — `origin.connection`/`memento` é campo próprio, distinto de `background` (mesma separação de US-122 §Nomenclatura); a US-121 decidiu que catálogo e prosa livre não se **misturam num campo só**, não que o catálogo não possa ter seu próprio campo persistido. Se o jogador quiser o texto também em `bonds`/`story` (prosa livre, editável), copia à mão.
- **Corrigir a anomalia do Sailor no dataset** — é dado do `a5e-ag` upstream (Open5e), não algo que este projeto edita; o parser só precisa não quebrar com ela (coberto pelo teste acima). A rotulagem `connection`/`memento` do bloco único **é** corrigida (por `SINGLE_BLOCK_IS_MEMENTO`, ver §Modelo de dados proposto) — o texto/conteúdo do dataset em si (a duplicação, o bloco "Connections" ausente) continua intocado.
- **Mostrar `description` completo dos outros 6 tipos de benefício** (`ability_score`, `skill_proficiency`, `tool_proficiency`, `language`, `equipment`, `feature`) — só os dois pedidos aqui. `ability_score`/`skill_proficiency` já ficam visíveis por outro caminho (a mecânica aplicada, US-123); os 4 restantes continuam só no resumo do cartão (US-122), sem mudança.
- **Um parser de Markdown genérico** (lib nova, suporte a todo o Markdown) — o formato é conhecido e fixo (heading + tabela pipe de 2 colunas); um parser dedicado de ~20 linhas cobre o que existe, no mesmo espírito do `parseStartingKit`/parsers de texto do dataset já usados (US-51, US-123). Sem dependência nova.
- **Mostrar `origin.key`/nome da origem inteira na ficha** (fora `connection`/`memento`) — US-122 ainda não decidiu exibir a origem escolhida na ficha de forma geral; esta story adiciona só os dois campos pedidos aqui, não uma seção "Origem" completa na aba Background. Extensão natural pra story futura, se pedida.

---

## Modelo de dados proposto

Sem migração nova. `Character.origin` já é `Json @default("{}")` (US-122, hoje só `{key?}`) — basta **estender o shape**, não o schema Prisma:

```
origin: { key?: string, connection?: string, memento?: string }
```

- `connection`/`memento` guardam o `text` (não o `roll`) da linha escolhida no `<select>` de cada bloco — string simples, mesmo formato de `background.story`.
- **Mapeamento bloco → campo é por POSIÇÃO, não por texto de heading** (heading não é mais extraído, ver §Escopo): default `tables[0]` → `connection`, `tables[1]` → `memento`.
- **Exceção do Sailor via curadoria pontual, não por texto.** Bloco único do Sailor é semanticamente "Mementos" (duplicado, ver §Contexto), não "Connections" — cair no default posicional gravaria errado em `origin.connection`. Fix: mapa fixo de override, chaveado por `origin.key`, aplicado só quando `tables.length === 1`:
  ```ts
  const SINGLE_BLOCK_IS_MEMENTO = new Set(['sailor']) // curadoria manual, 1 entrada hoje
  ```
  Sem entrada no set → cai no default (`connection`). Mesmo espírito do overlay `kitItems` da US-51 (curadoria manual pontual pra anomalia conhecida do dataset, não regra geral). **Não usa texto de heading** (rodaria de novo o risco de tradução que a mudança de escopo anterior eliminou) — só a chave da origem, que não é traduzida.
- Precisa espelhar em 3 lugares (mesmo padrão de `origin.key`, US-122): `CreateCharacterSchema` (`apps/api/src/character/character.schema.ts`), `normalizeOrigin` (`character.service.ts`), tipo do payload em `apps/web/src/lib/api.ts`.
- **Não entra em `background.bonds`/`story`** — continuam campos distintos (US-121 §Nomenclatura); `origin.connection`/`memento` é o valor escolhido do catálogo, não prosa livre do jogador.

---

## Critérios de aceite

- [ ] `parseD10Tables` extrai corretamente os 2 blocos (`Connections`/`Mementos`) do texto do Acolyte, com 10 linhas cada, `roll`/`text` preenchidos.
- [ ] `parseD10Tables` extrai só 1 bloco do texto do Sailor (anomalia real do dataset), sem lançar exceção e sem inventar um segundo bloco vazio.
- [ ] `parseD10Tables` reconhece heading `###` **e** `####` (os dois níveis aparecem no dataset real) — nenhum bloco é perdido por causa do nível do heading.
- [ ] `parseD10Tables` funciona com `\r\n` (CRLF) e **linha em branco entre o heading e a tabela** — forma real medida no dataset inteiro (não só o Acolyte), armadilha 2 do §Contexto; linha em branco não pode fechar o bloco antes da primeira linha de dado.
- [ ] `parseD10Tables` reconhece lista numerada (`1. texto`) além de tabela pipe (`|1|texto|`) — anomalia do Gambler (armadilha 3 do §Contexto), único caso entre as 21 origens com esse formato.
- [ ] `parseD10Tables` rodado contra as **21 entradas reais** de `connection_and_memento` do dataset (não só fixture sintética) não produz nenhum bloco com 0 linhas — validação feita ad-hoc em 12/08/2026 depois do bug em produção (item acima existe por causa disso).
- [ ] Seção de detalhe aparece na etapa `background` quando (e só quando) uma origem está selecionada (US-122) — sem origem selecionada, a seção não renderiza (nem vazia, nem com placeholder).
- [ ] `adventures_and_advancement`: texto completo visível, sem truncar, com quebras de linha preservadas.
- [ ] `connection_and_memento`: título e subtítulo **fixos** (i18n, não vêm do dataset) + um `<select>` por bloco, opções = linhas da tabela — nenhuma barra `|` de Markdown crua aparece na tela, e nenhum heading/preâmbulo do dataset aparece na tela (substituídos pelos fixos).
- [ ] Origem sem nenhum dos dois tipos de benefício (hipotético, nenhuma das 21 hoje) não quebra a seção — ela só não aparece.
- [ ] Cada bloco (`Connections`, `Mementos`) tem caixa de seleção própria (`<select>`, 10 opções = as 10 linhas) + botão "aleatório"; clicar no botão seleciona uma opção sorteada **daquele bloco específico** (nunca mistura opção de Connections com botão de Mementos).
- [ ] Sorteio usa `Math.random()` no cliente — sem chamada de rede, sem passar pelo Game Server (não é dado de mecânica).
- [ ] Trocar a opção no `<select>` depois de clicar "aleatório" sobrescreve a seleção sorteada sem travar nem restaurar sozinho.
- [ ] `POST /characters` grava `origin.connection`/`origin.memento` (quando selecionados) em `Character.origin` — confirmado por teste de `character.service.ts` (mesmo padrão dos testes de `origin.key`, US-122).
- [ ] Tela de revisão do wizard mostra a conexão e o memento escolhidos antes do submit; "—" se nada foi selecionado.
- [ ] Ficha do personagem (aba Background) mostra `origin.connection`/`origin.memento` depois de criado, quando presentes; endpoint de leitura de personagem devolve `origin` completo (não só o que o wizard já usava).
- [ ] Nenhuma string nova hardcoded no JSX (gate da US-102); rótulos (preâmbulo pode ficar em EN, é conteúdo do dataset, não string de interface) e título da seção têm chave de mensagem nos dois locales.
- [ ] **Eval / teste de regressão:** `parseD10Tables.test.ts` cobre as fixtures do §Escopo/§Contexto — 2 blocos (Acolyte), 1 bloco (Sailor), heading level misto, CRLF + linha em branco entre heading e tabela (forma real do dataset), lista numerada (Gambler) — e confirma que o retorno **não contém** heading nem preâmbulo (só `tables[].rows`).

---

## Notas de implementação

- **Parser por linha, não regex único** — mais fácil de acompanhar e testar que uma regex multiline gigante: percorrer as linhas, ignorar tudo até o primeiro heading (preâmbulo descartado, não acumulado), por heading abrir um bloco novo (heading em si também descartado, só serve de marcador de corte). **Linha em branco NUNCA fecha o bloco** (correção 12/08/2026, ver §Contexto armadilha 2) — só um heading novo ou o fim do texto fecha; qualquer linha que não seja uma linha de dado (em branco, cabeçalho `|d10|...|`, separador `|---|---|`, ou lixo qualquer) é só ignorada, o bloco continua aberto esperando a próxima linha de dado.
- **Duas regexes de linha de dado, testadas em sequência** (pipe primeiro, lista numerada como fallback — ver §Contexto armadilha 3): `ROW_PIPE = /^\|(\d+)\|(.*)\|$/` e `ROW_LIST = /^(\d+)\.\s+(.*)$/`. Não colidem (pipe começa com `|`, nunca dígito), então tentar as duas por linha é seguro e não precisa saber de antemão qual formato a origem usa.
- **`d10` é literal no header da tabela** (`|d10|Connection|`) — não precisa virar dado, é só a primeira coluna, ignorável no parse (o "roll" que interessa é o número de cada linha, `|1|...|`, `|2|...|`, não o cabeçalho). Mesmo raciocínio pro Gambler: o texto antes do `.` na lista numerada.
- **`benefits[].description` já traduzido pt-BR (US-121, `MT_DOMAINS`)** — o parser roda sobre o texto no locale ativo, então precisa funcionar igual em EN e PT. Ver Questão em aberto sobre risco de tradução automática quebrar a tabela.
- **Sorteio = `setSelected(rows[Math.floor(Math.random() * rows.length)].roll)`, um índice, sem dependência nova.** Não precisa de seed, não precisa de endpoint, não precisa de `rollDiceTool` (removido do `ai-engine`) nem de nada no Game Server: é texto de flavor sem efeito de regra, então a solução mais simples (`Math.random` puro no componente, setando o `value` do `<select>`) já cobre o critério de aceite.

---

## Questões em aberto

1. **Tradução automática (US-52, `MT_DOMAINS`) preserva a tabela Markdown?** `backgrounds` entrou em `MT_DOMAINS` na US-121 — o texto pt-BR de `connection_and_memento` é gerado por LLM a partir do EN. Um parser que espera `|d10|...|`/`|---|---|` literais quebra se a tradução reformular a tabela (reordenar colunas, trocar `|` por outro separador, resumir uma linha). Precisa de teste específico rodando `parseD10Tables` sobre o artefato pt-BR real antes desta story fechar, não só sobre fixture EN sintética.
   **Sugestão (prevenção, não só teste):** `systemPrompt()` em [packages/ai-engine/src/translate-srd.ts:35](../../../packages/ai-engine/src/translate-srd.ts) hoje só instrui "preserve notação de regra" (dados, CD, distância) — **nada** sobre tabela Markdown, risco confirmado lendo o prompt atual, não hipótese. Adicionar 1 linha: instruir o modelo a preservar `|`, a linha de separador (`|---|---|`) e a ordem das linhas quando `description` tiver tabela, traduzindo só o texto de cada célula. Zero dependência nova, zero mudança de schema — reduz a chance de quebra na origem, mas não garante (por isso o teste sobre o artefato real continua necessário como rede de segurança, não fica dispensado).
2. ~~Heading/preâmbulo ficam em inglês mesmo no locale pt-BR?~~ **Resolvida (mudança de escopo):** heading e preâmbulo do dataset não são mais exibidos — título e subtítulo agora são fixos, com chave de mensagem própria nos dois locales (ver §Escopo). Risco de tradução automática quebrar esses dois textos deixou de existir porque eles não entram mais na UI. **Novo risco correlato, não este:** o mapeamento bloco→campo (`connection`/`memento`) virou posicional por causa disso, com efeito colateral no Sailor — ver §Modelo de dados proposto.
3. ~~A seleção (manual ou sorteada) de conexão/memento sobrevive a voltar de etapa ou recarregar a página?~~ **Resolvida:** persiste no submit final (`POST /characters`, `origin.connection`/`memento`, ver §Modelo de dados proposto), igual a `background`. F5 **no meio** do wizard (antes do submit) ainda perde tudo — `bg.story`/`bonds`/`origin.connection`/`memento` no mesmo barco, sem autosave; risco pré-existente, não é regressão desta story e não precisa de solução própria aqui.

---

## Referências no código

- [apps/web/src/components/setup/SetupWizard.tsx](../../../apps/web/src/components/setup/SetupWizard.tsx) — etapa `background`/seção "Origem" (US-122) onde a seção de detalhe entra; `whitespace-pre-wrap` já usado em `hook.openingNarration` como precedente de prosa simples; etapa `review` onde a nova linha de conexão/memento entra.
- `packages/shared/src/types/system.ts` — `SystemBackgroundBenefitSchema.description` (US-121), fonte do texto, sem alteração.
- [apps/api/src/character/character.schema.ts](../../../apps/api/src/character/character.schema.ts) — `origin` do `CreateCharacterSchema` (US-122), ganha `connection`/`memento` opcionais.
- [apps/api/src/character/character.service.ts](../../../apps/api/src/character/character.service.ts) — `normalizeOrigin`, onde `connection`/`memento` são normalizados junto com `key`.
- [apps/web/src/components/game/GameView.tsx](../../../apps/web/src/components/game/GameView.tsx) — `BackgroundPanel`, aba "Background" da ficha (US-45), onde `origin.connection`/`memento` entram; hoje não recebe `origin` nenhum, checar o fetch de personagem em `apps/web/src/app/play/[adventureId]/page.tsx` antes de assumir que o dado já chega.
- [US-121](./US-121-catalogo-backgrounds-a5e-adventurers-guide.md) — `MT_DOMAINS`, de onde vem o risco da Questão em aberto 1.
- [US-122](./US-122-escolha-background-catalogo-na-criacao.md) — `origin.key`, gatilho de quando a seção de detalhe aparece, e payload irmão de `connection`/`memento`.
- [US-51](./US-51-kits-iniciais-do-srd.md) / [US-123](./US-123-integracao-mecanica-background-pointbuy-proficiency.md) — precedentes de parser dedicado para texto irregular do dataset, com tabela de armadilhas medidas.
