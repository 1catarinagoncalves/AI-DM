# US-124 — Exibir os benefícios narrativos da origem (`adventures_and_advancement`, `connection_and_memento`)

**Épico:** 1 — Personagem
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
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

### O que o dataset realmente contém (medido em 08/08/2026)

**`adventures_and_advancement`** é prosa corrida — parágrafo único, sem estrutura interna (mesmo tratamento de `hook.openingNarration` já renderizado em `SetupWizard.tsx`).

**`connection_and_memento`** é **Markdown com tabelas d10**, não prosa. Medido no Acolyte (`a5e-ag_acolyte_connection-and-memento`, 2117 caracteres):

```
Roll 1d10, choose, or make up your own.

#### Acolyte Connections
|d10|Connection|
|---|---|
|1|A beloved high priest or priestess awaiting your return to the temple...|
...(9 linhas)

### Acolyte Memento
|d10|Memento|
|---|---|
|1|The timeworn holy symbol bequeathed to you by your beloved mentor...|
...(9 linhas)
```

Dois blocos — um de **conexões** (NPC/gancho pessoal), um de **mementos** (objeto) — cada um com uma tabela de 10 linhas (`d10 → texto`), precedidos de "Roll 1d10, choose, or make up your own." Nível do heading **varia** (`####` na primeira tabela, `###` na segunda — medido no Acolyte).

**Armadilha real no dataset:** `a5e-ag_sailor_connection-and-memento` só tem **um** bloco — "Sailor Mementos" **duplicado duas vezes**, a seção "Sailor Connections" não existe nessa entrada (verificado direto no dataset, não é erro de leitura). O parser desta story precisa **degradar sem quebrar**: renderizar quantos blocos existirem (0, 1 ou 2), nunca assumir exatamente dois.

### Por que a solução atual não basta

Nenhuma tela do wizard renderiza Markdown hoje — os campos de texto (`openingNarration`, `pitch`) são prosa simples com `whitespace-pre-wrap`. `connection_and_memento` tem tabela de verdade; mostrar como texto corrido despejaria os `|d10|Connection|` crus na tela.

### A proposta

Um parser pequeno e só de front-end (sem tocar ingest/schema — o texto cru já está em `benefits[].description` desde a US-121) que separa blocos `heading + tabela` de um Markdown conhecido, e uma seção de detalhe na etapa `background`/"Origem" (US-122) que aparece quando uma origem está selecionada: `adventures_and_advancement` como parágrafo, `connection_and_memento` como tabela(s) HTML.

---

## Escopo

### Dentro do escopo

- **`parseD10Tables(desc: string)`** (novo utilitário, `apps/web`, só front-end): recebe a `description` crua, devolve `{ preamble: string, tables: { heading: string, rows: { roll: string, text: string }[] }[] }`. Detecta heading por regex `^#{2,4}\s+(.+)$` (não fixa em `###`/`####` — os dois níveis aparecem) e a tabela markdown logo abaixo (`|d10|...|`, `|---|---|`, linhas `|N|texto|`). Nº de blocos encontrados **não é assumido fixo** — cobre o caso de 2 (padrão), 1 (Sailor) e, defensivamente, 0 (texto sem tabela nenhuma, se algum bump vier diferente).
- **Seção de detalhe** na etapa `background`, visível só quando `origin.key` (US-122) aponta para uma origem com esses benefícios: `adventures_and_advancement` renderizado como parágrafo (`whitespace-pre-wrap`, mesmo padrão de `hook.openingNarration`); `connection_and_memento` renderizado como o preâmbulo + uma tabela HTML por bloco do parser, com o heading do próprio dataset como título da tabela.
- **Seleção da conexão e do memento.** Cada bloco (`Connections`, `Mementos`) ganha uma caixa de seleção própria (`<select>`, mesmo padrão do select de Raça/Classe/Origem, US-105/US-122) com as 10 linhas da tabela daquele bloco como opções (`value` = `roll`, texto exibido = `text`), e um botão "aleatório" ao lado que sorteia um índice e seta o `<select>` pra aquela opção. O jogador pode trocar a opção manualmente a qualquer momento, antes ou depois de clicar "aleatório" — o botão só pré-preenche, não trava a escolha.
- Sem opção "outra"/campo livre na caixa de seleção — o catálogo são as 10 linhas do dataset; texto livre pra conexão/memento fora dessas 10 continua sendo `bg.story`/`bonds` (US-39), como já era.
- **Persistência.** `origin.connection`/`origin.memento` viajam no `POST /characters` junto com `origin.key` (mesmo payload, US-122) e são gravados no `Character.origin` (Json, ver §Modelo de dados proposto) — só no submit final do wizard, mesmo momento em que `background` é persistido, sem autosave intermediário (mesmo padrão de risco que `bg.story` já tinha, ver Questão 3 resolvida abaixo).
- **Tela de revisão do wizard** (`step: 'review'`): nova linha (ou sublinha da linha de Origem já existente, US-122) mostrando a conexão e o memento escolhidos, mesmo padrão das outras linhas de revisão (`dt`/`dd`); "—" quando o jogador não selecionou nada.
- **Ficha do personagem** (`GameView.tsx`/`BackgroundPanel`, aba "Background", US-45): nova seção mostrando `origin.connection`/`origin.memento` quando presentes — requer o fetch do personagem (rota GET consumida por `apps/web/src/app/play/[adventureId]/page.tsx`) devolver `origin`, hoje não devolve nenhum campo de `origin` pra tela de jogo (só o wizard lê `System.config.backgrounds`). Checar o endpoint/serializer de personagem antes de assumir que o campo já chega no client.
- **Teste do parser** (`apps/web`, unitário): fixture com 2 blocos (caso comum), fixture com 1 bloco só (reproduz a anomalia do Sailor), fixture com heading em nível diferente (`###` vs `####`) — os três **não podem lançar exceção** nem produzir tabela vazia quando há conteúdo.

### Fora do escopo

- **Dado mecânico de verdade (Game Server, determinístico, logado)** — o "aleatório" desta story é sorteio de **texto de flavor**, sem consequência de regra; não é um roll de personagem e não passa pelo Game Server (ver §Notas de implementação, contraste com "Dados rolados deterministicamente no Game Server" do CLAUDE.md, que vale para mecânica de jogo, não para esta escolha narrativa).
- **Copiar a opção escolhida para `Character.background.bonds`/`story`** — `origin.connection`/`memento` é campo próprio, distinto de `background` (mesma separação de US-122 §Nomenclatura); a US-121 decidiu que catálogo e prosa livre não se **misturam num campo só**, não que o catálogo não possa ter seu próprio campo persistido. Se o jogador quiser o texto também em `bonds`/`story` (prosa livre, editável), copia à mão.
- **Corrigir a anomalia do Sailor no dataset** — é dado do `a5e-ag` upstream (Open5e), não algo que este projeto edita; o parser só precisa não quebrar com ela (coberto pelo teste acima).
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
- Mapeamento heading → campo: `heading.toLowerCase().includes('connection')` → `connection`; `includes('memento')` → `memento`. Cobre a anomalia do Sailor de graça (só bloco "Mementos" existe → só `memento` é preenchido, `connection` fica `undefined`).
- Precisa espelhar em 3 lugares (mesmo padrão de `origin.key`, US-122): `CreateCharacterSchema` (`apps/api/src/character/character.schema.ts`), `normalizeOrigin` (`character.service.ts`), tipo do payload em `apps/web/src/lib/api.ts`.
- **Não entra em `background.bonds`/`story`** — continuam campos distintos (US-121 §Nomenclatura); `origin.connection`/`memento` é o valor escolhido do catálogo, não prosa livre do jogador.

---

## Critérios de aceite

- [ ] `parseD10Tables` extrai corretamente os 2 blocos (`Connections`/`Mementos`) do texto do Acolyte, com 10 linhas cada, `roll`/`text` preenchidos.
- [ ] `parseD10Tables` extrai só 1 bloco do texto do Sailor (anomalia real do dataset), sem lançar exceção e sem inventar um segundo bloco vazio.
- [ ] `parseD10Tables` reconhece heading `###` **e** `####` (os dois níveis aparecem no dataset real) — nenhum bloco é perdido por causa do nível do heading.
- [ ] Seção de detalhe aparece na etapa `background` quando (e só quando) uma origem está selecionada (US-122) — sem origem selecionada, a seção não renderiza (nem vazia, nem com placeholder).
- [ ] `adventures_and_advancement`: texto completo visível, sem truncar, com quebras de linha preservadas.
- [ ] `connection_and_memento`: preâmbulo ("Roll 1d10, choose, or make up your own.") + uma tabela HTML por bloco, cada linha mostrando o número do d10 e o texto — nenhuma barra `|` de Markdown crua aparece na tela.
- [ ] Origem sem nenhum dos dois tipos de benefício (hipotético, nenhuma das 21 hoje) não quebra a seção — ela só não aparece.
- [ ] Cada bloco (`Connections`, `Mementos`) tem caixa de seleção própria (`<select>`, 10 opções = as 10 linhas) + botão "aleatório"; clicar no botão seleciona uma opção sorteada **daquele bloco específico** (nunca mistura opção de Connections com botão de Mementos).
- [ ] Sorteio usa `Math.random()` no cliente — sem chamada de rede, sem passar pelo Game Server (não é dado de mecânica).
- [ ] Trocar a opção no `<select>` depois de clicar "aleatório" sobrescreve a seleção sorteada sem travar nem restaurar sozinho.
- [ ] `POST /characters` grava `origin.connection`/`origin.memento` (quando selecionados) em `Character.origin` — confirmado por teste de `character.service.ts` (mesmo padrão dos testes de `origin.key`, US-122).
- [ ] Tela de revisão do wizard mostra a conexão e o memento escolhidos antes do submit; "—" se nada foi selecionado.
- [ ] Ficha do personagem (aba Background) mostra `origin.connection`/`origin.memento` depois de criado, quando presentes; endpoint de leitura de personagem devolve `origin` completo (não só o que o wizard já usava).
- [ ] Nenhuma string nova hardcoded no JSX (gate da US-102); rótulos (preâmbulo pode ficar em EN, é conteúdo do dataset, não string de interface) e título da seção têm chave de mensagem nos dois locales.
- [ ] **Eval / teste de regressão:** `parseD10Tables.test.ts` cobre as três fixtures do §Escopo (2 blocos, 1 bloco, heading level misto) e confirma que o preâmbulo é extraído separado das tabelas.

---

## Notas de implementação

- **Parser por linha, não regex único** — mais fácil de acompanhar e testar que uma regex multiline gigante: percorrer as linhas, acumular preâmbulo até o primeiro heading, depois por heading abrir um bloco novo e consumir linhas `|N|texto|` até a próxima linha vazia/heading/fim.
- **`d10` é literal no header da tabela** (`|d10|Connection|`) — não precisa virar dado, é só a primeira coluna, ignorável no parse (o "roll" que interessa é o número de cada linha, `|1|...|`, `|2|...|`, não o cabeçalho).
- **`benefits[].description` já traduzido pt-BR (US-121, `MT_DOMAINS`)** — o parser roda sobre o texto no locale ativo, então precisa funcionar igual em EN e PT. Ver Questão em aberto sobre risco de tradução automática quebrar a tabela.
- **Sorteio = `setSelected(rows[Math.floor(Math.random() * rows.length)].roll)`, um índice, sem dependência nova.** Não precisa de seed, não precisa de endpoint, não precisa de `rollDiceTool` (removido do `ai-engine`) nem de nada no Game Server: é texto de flavor sem efeito de regra, então a solução mais simples (`Math.random` puro no componente, setando o `value` do `<select>`) já cobre o critério de aceite.

---

## Questões em aberto

1. **Tradução automática (US-52, `MT_DOMAINS`) preserva a tabela Markdown?** `backgrounds` entrou em `MT_DOMAINS` na US-121 — o texto pt-BR de `connection_and_memento` é gerado por LLM a partir do EN. Um parser que espera `|d10|...|`/`|---|---|` literais quebra se a tradução reformular a tabela (reordenar colunas, trocar `|` por outro separador, resumir uma linha). Precisa de teste específico rodando `parseD10Tables` sobre o artefato pt-BR real antes desta story fechar, não só sobre fixture EN sintética.
2. **Heading/preâmbulo ficam em inglês mesmo no locale pt-BR?** "Roll 1d10, choose, or make up your own." e os headings (`Acolyte Connections`) são conteúdo do dataset, sujeitos à mesma tradução da questão 1 — se a tradução mantiver a estrutura, isso resolve sozinho; se não, pode precisar de curadoria manual pontual (como o overlay `kitItems` da US-51), fora do escopo original desta story.
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
