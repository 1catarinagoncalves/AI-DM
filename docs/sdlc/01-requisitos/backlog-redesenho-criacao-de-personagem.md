# Backlog — Redesenho da criação de personagem (protótipo de referência)

**Objetivo:** trazer o wizard de criação para o desenho do protótipo
[`wizard-criacao-personagem-referencia.html`](./wizard-criacao-personagem-referencia.html) —
escolha por **cartão com prosa** em vez de `<select>`, **ficha viva ao lado** das etapas,
pergunta como título, orçamento visível — **sem mexer na ordem das etapas que o produto já tem**,
salvo a divisão de `race-class` em `class` + `race` (exceção decidida em 2026-09-02, ver
*Mapeamento das etapas* abaixo) — e **sem perder** nenhum campo que o produto já grava, incluindo
os campos livres de história (US-39/US-40).

**Decisão de produto:** onde protótipo e produto discordam de **ordem** ou de **conteúdo**,
manda o produto. O protótipo é referência de **forma** (materialidade, densidade, hierarquia,
copy de enquadramento), não de sequência nem de modelo de dados. **Identidade visual (cor,
tipografia) não é decisão em aberto** — ver seção própria abaixo: o protótipo já usa os tokens do
[Design System](../02-design/design-system.md) do produto.

**Exceções de 2026-09-02 (duas):** a regra "sem mexer na ordem das etapas" ganha duas exceções
nomeadas. (1) `race-class` passa a seguir a sequência do protótipo (`1. Classe` → `2. Espécie`),
dividida em duas etapas do produto (`class`, `race`) — detalhe em
[US-205](./US-205-escolha-por-cartao-classe-e-raca.md) → *Contexto*. (2) Identidade (nome, gênero,
+ alinhamento novo) ganha etapa própria (`identity`), entre `system` e `class` — reabre a recusa que
a própria US-205 registrou no mesmo dia (ver *Segunda referência* abaixo e
[US-210](./US-210-identidade-como-etapa-propria.md) → *Contexto*). Fora dessas duas, todo o resto
do mapeamento abaixo continua sem mexer em ordem.

### Segunda referência (2026-09-02): a etapa Identidade

A US-210 parte de uma referência diferente do protótipo local citado acima —
`https://twirl-skate-47309606.figma.site/` (link fornecido pela mantenedora), inspecionada ao vivo
navegando o fluxo completo. Seis etapas — `Identidade · Raça · Classe · Atributos · Antecedente ·
Revisão` —, com `Identidade` **primeiro** (nome, pronomes, alinhamento), não no fim como o
protótipo local. As duas referências convivem: o protótipo local segue mandando na forma de
`class`/`race`/`background`/`attributes`/`skills`/`review` (US-203 a US-208); esta segunda manda
só na posição e no conteúdo da etapa `identity` (US-210). Onde citarem "o protótipo" sem qualificar,
as stories abaixo referem-se ao local; a US-210 é a única que cita a segunda.

**Status:** 📋 Proposta — nenhuma tarefa iniciada
**Criado em:** 2026-09-01

Este documento **não é uma user story**. É o mapa das diferenças e a sequência de stories.
Cada item já tem story própria em `US-*.md`.

---

## O protótipo, em uma linha

Sete etapas (`Classe · Espécie · Antecedente · Atributos · Perícias · Identidade · Revisão`),
cada uma com grade de **cartões** (chamada curta, resumo, "como é jogar", equipamento icônico,
traços) e filtro de busca, uma coluna fixa **"Ficha em construção"** que acumula o que já foi
escolhido e mostra PV/CA/deslocamento e os seis atributos com modificador **desde a etapa 1**,
antes de qualquer escolha (verificado ao vivo em 02/09/2026 — não há atraso até `attributes`, nem
percepção passiva nessa coluna; percepção passiva só aparece na etapa 7, na ficha final), e uma
trilha de **chips numerados** (`1. Classe`, `2. Espécie`, …) no topo. **Não há contador `Etapa X de
N` nenhum** — nem no topo nem no rodapé; a trilha de chips é a única indicação de posição.

## O produto hoje, em uma linha

Sete etapas também — `system · race-class · background · attributes · skills · review · world`
([`SetupWizard.tsx`](../../../apps/web/src/components/setup/SetupWizard.tsx)) — mas a escolha é
por `<select>`, o resumo do personagem só existe na etapa `review` (US-127), e o enquadramento de
cada etapa é um título nominal (`SectionTitle`) sem a pergunta.

---

## Identidade visual: o protótipo já usa os nossos tokens

Não é semelhança de estilo — **é o mesmo CSS**. Inspecionado ao vivo em 02/09/2026 (DevTools na
URL do protótipo, não no arquivo local): as variáveis `:root`/`.dark` do protótipo têm os mesmos
nomes **e os mesmos valores `oklch`** dos tokens do produto
([`globals.css`](../../../apps/web/src/app/globals.css), documentados no
[Design System §1](../02-design/design-system.md)):

| Token | Produto (`globals.css`, dark) | Protótipo (inspecionado, dark) |
|---|---|---|
| `--primary` | `oklch(0.68 0.16 55)` | `oklch(68% .16 55)` — igual |
| `--accent` | `oklch(0.72 0.15 70)` | `oklch(72% .15 70)` — igual |
| `--ember` | `oklch(0.62 0.19 45)` | `oklch(62% .19 45)` — igual |
| `--gold` | `oklch(0.82 0.14 80)` | `oklch(82% .14 80)` — igual |
| `--parchment` | `oklch(0.92 0.04 85)` | `oklch(92% .04 85)` — igual |

O logotipo do protótipo (`Criação de Personagem`) renderiza em **Cinzel** — o mesmo serif de
display que o [Design System §2](../02-design/design-system.md) já define para título de tela e
nome de personagem. O CSS do protótipo também define a classe `.dm-vignette`, o nome exato da
utility do produto ([direção visual §4](../02-design/direcao-visual-anti-slop.md),
[Design System §4](../02-design/design-system.md)).

**Conclusão prática: esta é uma decisão já tomada, não uma pendência.** Nenhuma story deste
backlog precisa de escolher cor, fonte ou nome de token — a US-46/direção visual já fixou isso
([direção visual anti-slop](../02-design/direcao-visual-anti-slop.md), status ✅ implementado) e o
protótipo confirma o mesmo sistema, não propõe um diferente. "Materialidade" na *Decisão de
produto* acima quer dizer **anatomia de cartão, densidade, hierarquia** — não cor nem tipografia:
essas duas já são as do produto, no cartão como em qualquer outra tela. Onde uma story abaixo cita
"a materialidade do protótipo", leia-se `optionCardClass`/tokens do Design System, nunca uma paleta
nova a introduzir.

---

## Mapeamento das etapas (a ordem que fica é a do produto, com a exceção de 2026-09-02 abaixo)

| # | Etapa do produto | Etapa do protótipo | O que o redesenho faz |
|---|---|---|---|
| 1 | `system` | *(não existe)* | Fica. Já é escolha por cartão; ganha o mesmo enquadramento das outras. |
| 2 | `identity` | *(não existe no protótipo local — `1. Identidade` na 2ª referência)* | **Nova etapa (decisão de 2026-09-02, ver US-210), antes de `class`.** Nome, gênero e alinhamento (campo novo) — sai de dentro de `class`, ganha etapa própria. |
| 3 | `class` | `1. Classe` | **Nova etapa (decisão de 2026-09-02, ver US-205), antes metade de `race-class`.** Grade de cartão de classe, com a subgrade de subclasse aninhada (`marshal`); nome e gênero **saíram** daqui para `identity` (US-210 reabre a recusa que a US-205 registrou no mesmo dia). |
| 4 | `race` | `2. Espécie` | **Nova etapa, a outra metade de `race-class`.** Grade de cartão de raça; ~~raiz com subespécie agrupada sem virar cartão próprio (US-142 preservada)~~ **correção de 2026-09-02 (ver nota abaixo): raiz virou cartão selecionável, com uma segunda grade de variante condicional.** |
| 5 | `background` | `3. Antecedente` | Origem vira cartão; benefícios (US-123/131/132/135), conexão/memento (US-124) e **os campos livres de história (US-39/US-40) continuam aqui**. |
| 6 | `attributes` | `4. Atributos` | Selo de pontos restantes, selo `Principal`, modificador e bônus de origem na mesma linha. |
| 7 | `skills` | `5. Perícias` | Selo `X / Y escolhidas`. Sem o pacote de equipamento do protótipo (ver *Fora do escopo*). |
| 8 | `review` | `7. Revisão` | Revisão passa a ler como **ficha**, não como lista de `dt`/`dd`. |
| 9 | `world` | *(não existe)* | Fica ao final (US-157). Ganha o mesmo enquadramento; nada mais muda. |

**Correção de 2026-09-02 (a mesma data desta frase original — ver US-210 §Contexto):** a frase
abaixo, mantida por rastro de decisão, deixou de valer. `identity` **virou** etapa (a 2ª, antes de
`class`) — não a `6. Identidade` do protótipo local, que segue sem virar etapa (ela é a etapa **no
fim**, com aparência/personalidade/história em texto livre, ainda fora de escopo); a etapa nova
segue a posição e o conteúdo da **segunda referência** (`identity` primeiro, com alinhamento).
História narrativa (US-39/US-40) continua em `background`, sem mudar de etapa.

> ~~A etapa `6. Identidade` do protótipo não vira etapa. O produto pede nome e gênero na etapa
> `class` (2ª) e a história na etapa `background` (agora 4ª, era 3ª); mover isso para o fim continua
> sendo a mudança de ordem que esta decisão de produto proíbe — a exceção de 2026-09-02 cobre só a
> divisão `race-class` → `class`+`race`, nada além disso.~~

---

## O que o produto tem e o protótipo não — nada disto se perde

O protótipo é um mock offline: ele não conhece metade do modelo de dados que a criação já grava.
Qualquer story deste backlog que apague um destes itens está errada, mesmo que fique mais
parecida com o protótipo.

- **Escolha de sistema** (`system`) e a coluna `sourceType` — o wizard é multi-sistema.
- **Gênero** (US-98) — `value` em pt-BR, rótulo traduzido.
- ~~**Subespécie por `optgroup`** (US-140/US-142) — o protótipo tem "variantes de espécie", que é
  outro desenho de dado; o produto tem raiz + subespécie no mesmo catálogo.~~ **Correção de
  2026-09-02:** revertido — o produto passou a adotar o desenho de "variante de espécie" do
  protótipo (pedido explícito da mantenedora). A raiz virou cartão selecionável, com o PRÓPRIO
  bônus de atributo (`race-bonus.mjs` agora separa `bonus` da raiz do `variantBonus` da
  subespécie); uma segunda grade condicional, "escolha uma variante", aparece abaixo quando a
  raiz escolhida tem subespécie. `charData.race` continua gravando sempre a chave JOGÁVEL — a
  raiz-com-subespécie sozinha nunca é valor final (ver `character.service.ts`
  `validateCatalogKey`, que segue rejeitando-a). Código: `CatalogCardGroup.tsx`,
  `SetupWizard.tsx` (etapa `race`), `scripts/srd/race-bonus.mjs`,
  `RaceCatalogEntrySchema.variantBonus` (`@ai-dm/shared`).
- **Benefícios de origem com `grant`** — bônus de atributo (US-123), perícias (US-131),
  ferramentas (US-132), feature (US-135). O protótipo mostra texto; o produto **aplica**.
- **Conexão e memento** com sorteio d10 (US-124).
- **Campos livres de história**: `story`, `ideals`, `bonds`, `flaws` (US-39) e `deity` (US-40).
  O protótipo tem aparência/personalidade/história; o produto tem estes cinco, que já viajam para
  a API e para o prompt do Mestre. **Ficam, e ficam na etapa `background`.**
- **Registro da aventura** (`world`, US-157/US-161/US-184).
- **i18n** (US-98) e **mobile** (US-66): todo texto novo é chave de mensagem nos dois locales, e
  toda grade nova colapsa em coluna única no telemóvel.

---

## O que o protótipo tem e o produto não

| Falta | Vira story |
|---|---|
| Catálogo de subclasse (`config.subclasses`), pré-requisito de dado para as duas linhas abaixo | [US-141](./US-141-catalogo-subclasses-srd-5-1-e-marshal.md) |
| Chamada curta e resumo por classe/raça/**subclasse** (o texto do cartão) | [US-203](./US-203-prosa-de-catalogo-classe-e-raca.md) |
| Ficha viva ao lado das etapas, trilha numerada, pergunta como título | [US-204](./US-204-wizard-em-duas-colunas-com-ficha-viva.md) |
| Escolha por cartão (classe, raça **e subclasse**, esta aninhada na etapa de classe), sem busca | [US-205](./US-205-escolha-por-cartao-classe-e-raca.md) |
| Origem por cartão, com os campos livres de história no mesmo desenho | [US-206](./US-206-origem-por-cartao-e-campos-livres-de-historia.md) |
| Orçamento de pontos, atributo `Principal`, modificador, contador de perícias | [US-207](./US-207-atributos-e-pericias-com-orcamento-visivel.md) |
| Revisão em forma de ficha | [US-208](./US-208-revisao-em-forma-de-ficha.md) |
| Etapa `identity` própria (nome, gênero, alinhamento novo), antes de `class` — 2ª referência, não o protótipo local | [US-210](./US-210-identidade-como-etapa-propria.md) |

**Ordem de execução:** US-141 → US-203 → US-205 e US-206 (dependem do texto) · US-204 → US-207 →
US-208 (independentes entre si depois do chrome) · **US-210 depois de US-205** (move nome/gênero
para fora da etapa `class` que a US-205 acabou de montar — fazer antes obrigaria a US-205 a
escrever o bloco só para a US-210 arrancá-lo dias depois). A US-204 é a que muda o esqueleto: fazer
as outras antes dela obriga a refazer o layout de cada etapa duas vezes. **Decisão de 2026-09-02:**
US-141 estava em backlog separado ("catálogo não existe" bloqueava subclasse fora deste mapa);
subclasse entrou no escopo de US-203/US-205, o que puxa US-141 para dentro desta ordem, na frente.

---

## Fora do escopo deste backlog

- **Assistência de IA nos campos livres** ("Sugerir com IA" para nomes, "Ajudar a escrever" para
  aparência/personalidade/história) e **retrato gerado por IA**. **Correção de 02/09/2026:** ao
  verificar a referência ao vivo, nenhuma das duas existe nela — a etapa `Identidade` só tem quatro
  chips de nome estáticos (sem geração) e três `textarea` simples, sem botão de IA nem espaço de
  retrato em lugar nenhum do DOM. A menção original a isto como "a parte mais visível do protótipo"
  era baseada num arquivo de referência local mais antigo, não na URL atual — fica registrado aqui
  como hipótese descartada, não como corte de algo que existe. Se a equipe quiser assistência de IA
  no futuro, é trabalho novo sem precedente na referência nem no repo (não há geração de imagem em
  lado nenhum, e chamada de IA em campo de texto é custo por clique, escada de provedor e
  guardrail). Duas das três caixas de escrita (`appearance`, `personality`) nem existem no
  `Character.background` hoje, então entrariam junto com migração. **Story própria, decisão
  própria** — este backlog entrega a forma, não a conta.
- **Escolha do pacote de equipamento inicial.** O produto deriva o kit da classe
  (`getStartingInventory`, US-51); dar a escolher entre dois pacotes é mudança de regra, não de
  tela.
- **Arte por classe/raça no cartão.** A [direção visual](../02-design/direcao-visual-anti-slop.md)
  §5 pede exatamente isso ("Wizard: arte de classe/raça na etapa correspondente"), e o cartão é o
  lugar certo — mas gerar 9 raças × 12 classes de arte consistente é um trabalho de asset com
  orçamento próprio. As stories abaixo desenham o cartão com **espaço reservado** para a imagem;
  quem preencher é outra story.
- **Mudar a ordem das etapas**, além da exceção `race-class` → `class`+`race` de 2026-09-02
  (*Mapeamento das etapas*). Fora essa, é a decisão de produto no topo deste documento.
