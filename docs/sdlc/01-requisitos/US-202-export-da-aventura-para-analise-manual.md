# US-202 — Export da aventura gerada para análise manual de criatividade e coerência

**Épico:** 5 — Qualidade e avaliação do DM Agent
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada (01/09/2026). Verificado ao vivo contra a Neon de dev (`DEV_EXPORT=1`,
porta alternativa pra não colidir com o `pnpm dev` já em execução): rota condicional aparece no
log de boot do Nest (`AdventureExportController {.../export}`); sem token → 401; token de dev
contra personagem de outro utilizador → 403; `characterId` inexistente → 404; contra uma aventura
real da Neon (28 `EventLog`, 1 `Quest`, `CharacterState` presente) o pipeline query→view→Markdown
roda ponta a ponta sem exceção e produz ~82KB de Markdown coerente, com `locationId`/`npcIds`
resolvidos para título/nome em toda referência. `pnpm typecheck` e os 2 testes de regressão do
critério de aceite (função pura de renderização + registro condicional via `Reflect.getMetadata`
sobre o módulo real) verdes; suite inteira de `apps/api` (488 testes) sem regressão; `pnpm dead`
sem achado novo. Não testado ao vivo: resposta 200 completa por HTTP (headers
`Content-Type`/`Content-Disposition`, `?format=json`) — o pipeline por trás foi validado
diretamente (ver acima) e os `res.setHeader`/`res.send` do controller são triviais, mas a rota
em si não recebeu uma chamada HTTP 200 de ponta a ponta nesta verificação (criar uma aventura
nova custaria uma geração real via LLM).
**Depende de:** [US-201](./US-201-token-de-desenvolvimento-para-agentes-testarem-api-e-telas.md) — o token de dev (`pnpm dev:token`), o `.addBearerAuth()` no Swagger e o padrão de porta dupla (`NODE_ENV !== 'production'` **e** env var explícita) que esta rota reusa. O artefato em si já é persistido desde a [US-168](./US-168-abertura-narra-gancho-fixo-nao-aventura-gerada.md) (`Adventure.generatedAdventure`).
**Criada em:** 2026-09-01

**Relacionada a:**
- [US-144](./US-144-schema-aventura-shared.md) — `GeneratedAdventureSchema`: a forma exata do que esta story despeja.
- [US-150](./US-150-gate-antes-de-persistir-aventura-gerada.md) — o gate mecânico (parse/grafo/orçamento). O que ele já garante é justamente o que a leitura manual **não** precisa reconferir.
- [US-154](./US-154-eval-aventura-gerada.md) — eval estático sobre um artefato fixture. Esta story dá o material real; o juiz automático continua sendo outra story.
- [US-36](./US-36-eval-de-qualidade-da-narracao.md) — LLM-judge da narração. Mesmo espírito, outro alvo (turno vs. aventura inteira) e outro custo (pago vs. leitura humana).
- [US-99](./US-99-config-do-sistema-no-locale-ativo.md) — `OptionalAuthGuard`: o precedente de rota com guard próprio neste repo.

---

## História

> **Como** mantenedora do motor de geração de aventuras,
> **quero** despejar num único arquivo tudo o que ficou gravado de uma aventura criada,
> **para que** eu consiga ler o material inteiro fora do jogo e julgar à mão se o modelo está sendo criativo e coerente — e onde ele não está.

---

## Contexto e motivação

### O problema observado

A aventura gerada é hoje um objeto grande e opaco. Uma execução do motor grava, espalhado
por cinco tabelas:

- o artefato inteiro (`Adventure.generatedAdventure`, US-168 — registro, sumário, NPCs,
  segredos, locais, os 8 encontros, antagonista, objetivo, conclusão, desdobramentos);
- o ledger derivado dele (`Adventure.entities`, semeado por `seedLedgerFromGeneratedAdventure`);
- as quests (`Quest.objective` / `Quest.conclusionHint`, US-169);
- o personagem que ancorou a geração (`Character.background`, `Character.origin`, classe e nível);
- o que de fato foi jogado por cima disso (`EventLog`).

Julgar "o modelo está criativo?" ou "o antagonista tem a ver com os segredos?" exige ver essas
peças **juntas e na ordem em que foram produzidas**. Hoje isso significa abrir o Prisma Studio,
achar a linha, expandir uma célula `Json` de milhares de caracteres numa caixa de texto, e fazer
a junção `locationId` → local, `npcIds[]` → NPC, `secrets[].locationId` → local, à mão, no olho.
Na prática a avaliação não acontece: o custo de montar o material é maior que o de ler.

### Por que a solução atual não basta

- **`pnpm db:studio`** mostra linha por linha, sem seguir referência entre JSONs, e degrada com
  blob grande. É inspetor de banco, não visão de leitura.
- **O gate da US-150** já reprova o que é mecanicamente quebrado (schema inválido, referência
  cruzada órfã, orçamento de encontro estourado). Toda aventura persistida passou por ele — logo
  o que sobra para avaliar é exatamente o que gate nenhum vê: NPCs que se repetem com nomes
  diferentes, segredos que não são segredo, `unlocks` que não encadeiam, antagonista genérico
  colado no fim, prosa de `boxedText` parecida em oito locais. Isso é leitura humana.
- **A eval da US-154** roda contra um fixture escrito à mão dentro do próprio arquivo de teste —
  ela protege o Mestre de vazar `revelado: false`, não mede a qualidade do que o modelo escreveu.
- **A rota de turnos** ([`adventure.controller.ts`](../../../apps/api/src/adventure/adventure.controller.ts))
  devolve só o histórico de turnos, e de propósito: é rota de jogo, alcançável pelo navegador da
  jogadora. Segredo, fraqueza do antagonista e conclusão não podem sair por ali — o que esta
  story precisa é de uma rota **de bancada**, viva só em dev, não de mais um campo naquela.

### A proposta

Um endpoint de desenvolvimento que devolve a aventura inteira como **arquivo `.md`** para
download: tudo o que ficou gravado, ordenado pelo pipeline de geração, pronto para abrir no
editor e ler de cima a baixo. Autenticado com o token de dev da US-201, atrás da mesma porta
dupla que a US-201 estabeleceu — em produção a rota não existe.

---

## Escopo

### Dentro do escopo

- **Endpoint `GET /characters/:characterId/adventures/:adventureId/export`**, no
  [`AdventureController`](../../../apps/api/src/adventure/adventure.controller.ts) que já existe —
  mesmo `AuthGuard`, mesmo `assertOwner` da rota de turnos. Aventura de outro utilizador continua
  403; inexistente, 404. O token é o do `pnpm dev:token` (US-201), colável no **Authorize** do
  Swagger que a mesma story acende.
- **Resposta é arquivo `.md` para download:** `Content-Type: text/markdown; charset=utf-8` e
  `Content-Disposition: attachment; filename="aventura-<adventureId>.md"`. Abre no editor, não
  na aba do navegador.
- **`?format=json`** devolve o mesmo conteúdo como JSON (`application/json`), para diff entre
  duas aventuras e para alimentar um juiz automático no futuro. Sem o parâmetro, `.md`.
- **Porta dupla, regra da US-201:** a rota só é registrada com `NODE_ENV !== 'production'`
  **e** `DEV_EXPORT=1`. As duas condições, nunca alternativas. Em produção a rota não existe
  (404), mesmo com a env var definida — ela carrega segredo, fraqueza do antagonista e conclusão,
  conteúdo que a jogadora não pode alcançar (decisão 1).
- **Conteúdo do export:** as seis fontes da tabela de *Modelo de dados* abaixo, com as referências
  por id **resolvidas** no Markdown (encontro mostra o local e os NPCs pelo nome, segredo mostra
  em que local está) — a junção que hoje se faz no olho.
- **Ordem do Markdown = ordem do pipeline:** registro → sumário → antagonista → NPCs → segredos →
  locais → os 8 encontros na sequência, cada um com o seu `unlocks` → objetivo → conclusão →
  desdobramentos → o log de jogo. Ler de cima a baixo é reconstituir a geração.
- **Cabeçalho de rubrica** no Markdown: lista curta e fixa do que olhar (repetição entre NPCs,
  segredo que não é segredo, encadeamento de `unlocks`, antagonista ancorado nos segredos,
  variedade de `boxedText`, `connection` com o personagem real). Texto estático, sem nota e sem
  chamada de modelo — é o roteiro de leitura, não um avaliador.
- **Somente leitura:** a rota consulta e serializa. Nenhuma escrita, nenhum `EventLog` novo.
- **Documentação** em `AGENTS.md`, ao lado do `pnpm dev:token` da US-201: como ligar `DEV_EXPORT`,
  a URL e o `curl -OJ` que salva o arquivo com o nome que o servidor mandou.

### Fora do escopo

- **Nota automática / LLM-judge da aventura.** É o passo seguinte e caro; esta story só entrega
  o material. Quando existir, ele consome o mesmo JSON (US-36 e US-154 são a família).
- **Comando de CLI equivalente.** Um `pnpm adventure:export` lendo o banco direto resolveria o
  mesmo problema, mas seria um segundo caminho para a mesma informação, com a sua própria
  consulta e a sua própria porta. A rota reusa `AuthGuard`, `assertOwner` e o token que a US-201
  já entrega; `curl -OJ` grava o arquivo. Uma porta, não duas.
- **Export em produção, por rota ou por qualquer outro meio.** É ferramenta de bancada. Se um dia
  uma tela de mestre precisar ver o material da campanha, é outra story, com o seu próprio modelo
  de ameaça e sem os campos de spoiler.
- **Reproduzir as rolagens.** `rollAdventure` é determinístico em `characterId`/`order`, mas o
  número de re-semeadas até o gate aprovar (US-150) **não é persistido** — nem o motivo das
  tentativas reprovadas, que hoje só vive em log estruturado. Recomputar a sequência exigiria
  persistir isso primeiro: story própria (ver *Questões em aberto*).
- **Comparar duas aventuras / relatório agregado.** `diff` de dois JSONs cobre o caso de hoje.
- **Exportar todas as aventuras de uma vez.** Uma por chamada; laço no shell cobre o resto.
- **Botão de export no web.** A rota é chamada por `curl`/Swagger, não por tela. Botão exigiria
  o material sair pelo navegador da jogadora — o oposto da decisão 1.

---

## Modelo de dados proposto

Nenhuma tabela nova, nenhuma migração — a story só **lê** o que já existe
([`schema.prisma`](../../../apps/api/prisma/schema.prisma)).

| Fonte | Campos levados | Por que importa para a avaliação |
|---|---|---|
| `Adventure` | `id`, `title`, `order`, `status`, `createdAt`, `memorySummary`, `entities`, `generatedAdventure` | O artefato é o objeto da avaliação; `entities` mostra o que virou canon; `memorySummary` mostra o que a sumarização preservou. |
| `Quest` | `title`, `description`, `status`, `isPrimary`, `objective`, `conclusionHint` | Confere se o objetivo prometido pelo artefato virou alvo concreto no jogo (US-169). |
| `Character` | `name`, `race`, `class`, `level`, `background`, `origin`, `locale` | São as âncoras que a geração recebeu — sem elas não dá para julgar se a `connection` do antagonista é ancorada ou genérica. |
| `CharacterState` | `hp`, `maxHp`, `inventory`, `conditions`, `sceneState` | Estado em que a aventura parou; contexto para ler o log. |
| `EventLog` | `type`, `payload`, `summarized`, `createdAt` | A aventura **jogada** por cima da gerada: onde a coerência quebra na prática. |
| `System` | `id`, `name`, `version`, `sourceType` | Identifica o sistema. `config`/`configLocales` ficam de fora: são o dataset inteiro do SRD, não têm a ver com esta aventura. |

**Redação:** `User.email` e `User.name` nunca entram no dump — o vínculo é `creatorId`. O conteúdo
exportado é material de jogo; o arquivo não precisa carregar identidade de conta.

**Persistência:** nenhuma. O `.md` é montado na resposta e vive onde quem baixou o guardou —
fora do repo (o arquivo tem spoiler da campanha inteira; não é material de commit).

---

## Critérios de aceite

- [ ] Com `DEV_EXPORT=1` em dev, `GET /characters/:characterId/adventures/:adventureId/export`
      com o Bearer do `pnpm dev:token` responde **200** com um `.md` contendo as seis fontes da
      tabela acima, para uma aventura criada pelo motor. Verificado indiretamente: o pipeline
      query→view→Markdown (o que o handler chama antes de `res.send`) rodou ponta a ponta contra
      uma aventura real da Neon e produziu as seis fontes — mas nenhuma chamada HTTP chegou a 200
      nesta verificação (precisaria de uma aventura nova sob a conta de dev, o que custaria uma
      geração real via LLM). Ver nota no Status.
- [ ] A resposta traz `Content-Type: text/markdown` e um `Content-Disposition: attachment` com
      `filename` que cita o `adventureId` — `curl -OJ` grava o arquivo direto, sem `-o` à mão. Os
      dois `res.setHeader` foram lidos, não curlados numa resposta 200 real (mesmo motivo acima).
- [x] O Markdown segue a ordem do pipeline e resolve as referências: nenhum id cru aparece no
      lugar de um nome de local ou de NPC. Confirmado pelo teste de regressão (a) e, ao vivo,
      contra uma aventura real (locations/npcs/secrets/encounters todos por nome, não por id).
- [x] O Markdown abre com a rubrica de leitura (itens fixos, sem nota atribuída). Confirmado ao
      vivo (topo do Markdown gerado contra a aventura real) e por teste.
- [ ] `?format=json` devolve `application/json` com o mesmo conteúdo. Não exercitado nesta
      verificação — o branch `format === 'json'` do controller nunca foi chamado.
- [x] Sem token, a rota responde 401; com token de outro utilizador, 403; `adventureId`
      inexistente (ou de outro personagem), 404 — o mesmo comportamento da rota de turnos, porque
      é o mesmo `assertOwner`. Os três confirmados ao vivo com `curl` contra a API real.
- [x] Aventura **sem** `generatedAdventure` (criada antes da US-168) exporta o resto e marca a
      seção do artefato como ausente, em vez de quebrar. Coberto pelo teste de regressão (a); não
      há, nesta Neon, uma aventura real pré-US-168 para testar ao vivo.
- [x] `User.email` não aparece em nenhum dos dois formatos. `AdventureExportCharacter` não tem
      campo `email`, e a query de `Character` só seleciona `user: { select: { locale: true } } }`
      — não há como o e-mail atravessar a `select`.
- [x] A rota não escreve em banco: nenhuma chamada de `create`/`update`/`delete`/`upsert` no
      caminho do export, e nenhum `EventLog` novo depois de uma chamada. `getExportData` só chama
      `findFirst`/`findMany`/`findUnique`/`findUniqueOrThrow`.
- [x] **Segurança:** com `NODE_ENV=production` a rota responde **404 mesmo com `DEV_EXPORT=1`
      definido** — as duas condições são exigidas, não alternativas (mesma regra da US-201).
      Confirmado pelo teste de regressão (b), que lê `Reflect.getMetadata` sobre a classe do
      módulo — o mesmo registro que o Nest usa para montar as rotas.
- [x] **Eval / teste de regressão:** dois testes no vitest de `apps/api`. (a) Função pura de
      renderização sobre um artefato de fixture com dois locais, dois NPCs e um encontro: falha
      se uma referência ficar sem resolver (id cru na saída) ou se um NPC declarado no artefato
      sumir do Markdown — é o que quebra quando o `GeneratedAdventureSchema` ganhar campo novo e
      ninguém o levar para a visão. (b) Registro condicional: com `NODE_ENV === 'production'` a
      rota **não** entra no controller. O (b) lê o registro de verdade, não uma cópia da condição
      — teste que reimplementa `NODE_ENV !== 'production' && DEV_EXPORT` continua passando depois
      de alguém apagar a porta dupla do código. `apps/api/src/adventure/adventure-export.test.ts`
      (5 casos) e `apps/api/src/adventure/adventure.module.test.ts` (4 casos), todos verdes.

---

## Notas de implementação

> Dicas, não especificação. Quem implementa pode divergir com justificativa.

- **Três peças finas, um controller novo (não um módulo novo).** Renderização = função pura
  sobre o objeto já lido, em `apps/api/src/adventure/` (junto do domínio de aventura, testável
  pelo vitest que já roda); consulta = método do `AdventureService`, ao lado de `getTurns`; rota =
  `AdventureExportController` próprio, no mesmo módulo. `@Get()` do Nest registra rota no load do
  módulo — não há como "desligar" um método de um controller que já está no array `controllers`
  sem um `if` dentro do handler, que é exatamente o anti-padrão que este item evita. Controller
  separado é o preço de não mentir sobre a rota existir. Reusa `AuthGuard` e
  `adventureService.assertCharacterOwner` (já público — é o que `assertOwner` do
  `AdventureController` chama por baixo; não precisa duplicar nem tornar público um método
  privado). Sem módulo novo, sem `dev/` separado.
- **Registro condicional da rota.** `AdventureExportController` só entra no array `controllers`
  de [`adventure.module.ts`](../../../apps/api/src/adventure/adventure.module.ts) quando
  `NODE_ENV !== 'production' && DEV_EXPORT === '1'` — mesmo formato do array `providers`
  condicional em [`auth-providers.ts`](../../../apps/web/src/lib/auth-providers.ts) (US-201,
  lado web): condição calculada uma vez, spread condicional no array, nada de `if` dentro de
  handler. O teste (b) importa o array `controllers` do módulo (ou sobe o módulo de teste com
  cada valor de env) e afirma sobre o array real — não uma cópia da condição.
- **`Content-Disposition` com nome seguro.** `adventureId` é cuid (só `[a-z0-9]`), mas o
  `filename` monta com ele: se um dia o id vier de outra fonte, sanitizar. Aspas duplas no valor,
  como manda o header.
- **Tipar o artefato na leitura, não confiar no `Json`.** `Adventure.generatedAdventure` volta do
  Prisma sem tipo; passar por `GeneratedAdventureSchema.safeParse` dá o tipo e, de quebra, detecta
  artefato antigo que não revalida (o caso de `unlocks`, US-193 — reparse de artefato antigo
  **não** é caminho suportado). `safeParse` falho não devolve `data` tipado — não dá pra
  "renderizar parcialmente" um objeto que não existe. Falha de parse não deve abortar o export:
  cai para o JSON cru do `generatedAdventure` (sem resolução de referência, sem nomes) com um
  aviso no topo da seção dizendo que o artefato não revalida contra o schema atual. Sem parse
  tolerante campo-a-campo — não vale a complexidade para um caso que só existe em artefato
  pré-US-168/pré-US-193.
- **`DEV_EXPORT` não se carrega sozinho.** A API não tem `ConfigModule` nem `dotenv`: em dev os
  env vars vêm do `.env` da RAIZ, carregado pelo wrapper `dotenv -e .env --` do script `dev`
  ([`package.json`](../../../package.json)). A flag vai lá, junto de `DATABASE_URL` e
  `AUTH_SECRET` — não em `apps/api/.env`, que não é lido.
- **Cuidado com o banco apontado.** Em dev, `DATABASE_URL` aponta para a Neon: o export lê dados
  reais. Somente-leitura de propósito justamente por isso.
- **`EventLog.payload` é grande.** No Markdown, renderizar `ACTION`/`NARRATION` como diálogo
  legível e os demais tipos (`DICE_ROLL`, `QUEST_UPDATE`, `CHARACTER_UPDATE`) como uma linha
  compacta — o log é contexto para a leitura, não o objeto principal dela.
- **NPC de combate.** `role` ∈ `MONSTER_ROLE_CR` é combatente genérico, não personagem
  ([`seed-ledger.ts`](../../../apps/api/src/adventure-generation/seed-ledger.ts)). Marcá-los como
  tal na listagem evita que a leitura os conte como "NPCs sem personalidade" — eles são assim por
  decisão do motor, não por falha do modelo.
- **Sem dependência nova.** `JSON.stringify` e template string cobrem os dois formatos.

---

## Decisões (questões em aberto resolvidas)

### 1. A rota é de dev, atrás da porta dupla da US-201 — **decidido, e é questão de segurança**

O export carrega o que o jogo esconde de propósito: `secrets[]` (que o ledger nasce com
`revelado: false`), `antagonist.weakness`, `conclusion`, `Quest.conclusionHint` — este último
gravado justamente para **nunca** ser exposto em turno passivo (US-169). Uma rota autenticada
comum poria tudo isso a um `fetch` do navegador da própria jogadora: qualquer aba de devtools
aberta durante uma sessão vira spoiler da campanha inteira, e o `AuthGuard` não protege contra
isso — a jogadora **é** a dona do recurso.

Por isso a rota reusa o padrão que a US-201 estabeleceu para ferramenta de bancada:
`NODE_ENV !== 'production'` **e** flag explícita, as duas, com o teste que verifica o registro
real. Em produção a rota não existe; em dev ela existe e ainda assim confere dono.

### 2. Flag própria `DEV_EXPORT`, não reuso do `DEV_LOGIN` — **decidido**

O `DEV_LOGIN` da US-201 abre o login sem Google no web. São riscos diferentes: um deixa entrar,
o outro deixa ler o material inteiro de uma campanha. Amarrar os dois na mesma flag significa
que ligar o login de dev acende o export sem ninguém pedir. Duas flags, um mecanismo (a mesma
porta dupla) — é uma linha de env a mais, não um mecanismo a mais.

---

## Questões em aberto

1. **A rubrica fica no output ou num `.md` do repo?** Colada no topo do export ela é lida no
   momento certo; num arquivo de `docs/` ela é versionável e evolui sem tocar em código. A
   proposta acima escolheu o output por ser um bloco de texto estático; se a rubrica crescer,
   migrar.
2. **Vale persistir o número de tentativas e os motivos de reprovação do gate** (hoje só em log)
   para uma story futura de "por que esta aventura saiu assim"? Fora do escopo aqui, mas é a
   informação que mais falta quando a leitura acha um resultado estranho.

---

## Referências no código

- [`apps/api/prisma/schema.prisma`](../../../apps/api/prisma/schema.prisma) — `Adventure.generatedAdventure`, `Adventure.entities`, `Quest.objective`, `EventLog`: tudo o que o dump lê.
- [`packages/shared/src/types/adventure-generation.ts`](../../../packages/shared/src/types/adventure-generation.ts) — `GeneratedAdventureSchema` e as partes (`AdventureNpcSchema`, `AdventureSecretSchema`, `AdventureLocationSchema`, `AdventureEncounterSchema`, `AdventureAntagonistSchema`): a ordem das seções do Markdown sai daqui.
- [`apps/api/src/adventure/adventure.service.ts`](../../../apps/api/src/adventure/adventure.service.ts) — onde `generatedAdventure` e o ledger são gravados; é o outro lado do que o export lê.
- [`apps/api/src/adventure-generation/adventure-gate.ts`](../../../apps/api/src/adventure-generation/adventure-gate.ts) — `runAdventureGate`: as três verificações mecânicas que a leitura manual **não** precisa repetir.
- [`apps/api/src/adventure-generation/seed-ledger.ts`](../../../apps/api/src/adventure-generation/seed-ledger.ts) — como `entities` deriva do artefato; explica divergências entre os dois no dump.
- [`apps/api/src/adventure-generation/roll-adventure.ts`](../../../apps/api/src/adventure-generation/roll-adventure.ts) — `rollAdventure` e o parâmetro de tentativa não persistido (questão 2).
- [`apps/api/src/adventure/adventure.controller.ts`](../../../apps/api/src/adventure/adventure.controller.ts) — onde a rota entra; `assertOwner` e o `AuthGuard` já montados, e a rota de turnos como molde.
- [`apps/api/src/auth/auth.guard.ts`](../../../apps/api/src/auth/auth.guard.ts) — `AuthGuard`: 401 sem Bearer, 401 com `sub` órfão. É o que o token de dev da US-201 atravessa.
- [`apps/api/src/main.ts`](../../../apps/api/src/main.ts) — `DocumentBuilder`: o `.addBearerAuth()` da US-201 é o que faz esta rota ser testável pelo Swagger.
- [`evals/cases/us-154-eval-aventura-gerada.ts`](../../../evals/cases/us-154-eval-aventura-gerada.ts) — fixture de artefato já pronto; molde para o fixture do teste desta story.
- [`package.json`](../../../package.json) — padrão `dotenv -e .env -- pnpm --fail-if-no-match --filter api ...` dos scripts que falam com o banco.
