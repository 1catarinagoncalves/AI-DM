# US-95 — O loop `ação → tool → persistir → estado` ganha teste de integração

**Épico:** 5 — Qualidade e avaliação do DM Agent
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** [US-93](./US-93-gates-baratos-de-migracao-dependencia-e-smoke.md) — o serviço Postgres no job de CI nasce lá; esta story o reusa em vez de criar outro.
**Criada em:** 2026-07-30

---

## História

> **Como** mantenedora do AI DM,
> **quero** um punhado de testes que atravessem HTTP → serviço → Prisma → Postgres de verdade,
> **para que** a costura entre as camadas — a parte que nenhum unitário toca — pare de ser verificada só jogando.

---

## Contexto e motivação

### O problema observado

A [estratégia de testes](../04-testes/estrategia-de-testes.md) declara a lacuna sem eufemismo, na seção *2. Testes de integração — não existem ainda*: o loop `ação → tool → persistir → estado` é coberto hoje só por unitário com Prisma falso.

Isso não é descuido, é consequência de uma decisão consciente e bem documentada. A [US-80](./US-80-ci-typecheck-testes-e-evals.md) (*Questão em aberto* #2) mediu e registrou: **nenhum teste do repo toca banco**, os 4 arquivos de teste da API que mencionam Prisma usam `import type` + `as unknown as PrismaService`, e o client real nunca é instanciado. 253 testes verdes sem `DATABASE_URL`. Esse é o desenho, e ele é rápido, determinístico e barato.

O preço dele é preciso: **os test doubles concordam com o código, não com o Postgres.** Um `fakePrisma()` nunca viola uma constraint, nunca falha um `@unique`, nunca devolve `null` num relacionamento que a migração deixou opcional, nunca reprova um `JSON` malformado numa coluna `Json`, e nunca revela que a transação que deveria envolver "aplicar dano + registrar entidade" na verdade não existe. Todo bug dessa família passa pelo `pnpm test` verde e chega no jogo.

A US-80 também deixou um aviso que envelhece sozinho: a disciplina do `import type` *"é uma disciplina, não uma garantia do compilador"* — trocar um deles por import de valor põe o client real no grafo e passa a exigir banco, sem nenhum teste ou typecheck reclamando.

### Por que a solução atual não basta

Não há solução parcial a melhorar: a camada é ausente por escolha. O que mudou desde a US-80 é o custo de fechá-la. A [US-93](./US-93-gates-baratos-de-migracao-dependencia-e-smoke.md) traz um Postgres para dentro do job de CI por outro motivo (drift de migração), e com ele em pé a objeção "banco no runner é peso" já foi paga por outra story.

### A proposta

Um projeto de teste separado, com Postgres efêmero do runner, migrações aplicadas de verdade e o app Nest de pé, cobrindo **poucos** fluxos — os que quebram silencioso.

---

## Escopo

### Dentro do escopo

- Projeto de teste à parte (config Vitest própria, como `vitest.eval.config.ts` é à parte do `vitest.config.ts`), para que `pnpm test` continue rápido e sem banco.
- Preparo: `prisma migrate deploy` + seed no banco do runner, uma vez por job.
- Nest de pé em memória (`Test.createTestingModule` + `app.init()`), request HTTP por cima.
- **Três fluxos**, não mais:
  1. **Rolagem ancorada na ficha** — um turno em que o Mestre chama `rollDice`; o modificador aplicado tem que vir da ficha no banco, não do LLM ([US-38](./US-38-rolagens-ancoradas-na-ficha.md)).
  2. **Dano persiste** — `updateCharacterHp` reduz o HP e o `GET` seguinte devolve o valor novo, do Postgres.
  3. **Entidade sobrevive** — `recordEntity` grava em `Adventure.entities` e o ledger reaparece no turno seguinte, incluindo o caso vazio ([US-87](./US-87-bloco-de-entidades-ausente-citado-no-prompt.md)).
- Passo próprio no `ci.yml`, separado do `pnpm test`, para a aba de checks dizer qual camada caiu.

### Fora do escopo

- **Chamar LLM de verdade.** O que está sob teste é a costura, não a narração — a qualidade da narração é a US-94. O modelo é substituído por um dublê que emite tool calls determinísticas (ver *Questões em aberto* #1).
- **Cobrir todos os endpoints.** Três fluxos. A tentação de virar suíte de contrato completa é como esta camada fica lenta e depois é desligada.
- **Migrar os unitários existentes para banco real.** Eles ficam como estão, com `fakePrisma()`. A pirâmide não inverte.
- **Testcontainers / Docker Compose no runner.** O `services:` nativo do GitHub Actions já dá um Postgres; a estratégia de testes registra Docker Compose como desenho que nunca foi construído, e esta story não o ressuscita.
- **Banco de teste hospedado (branch da Neon).** Ver *Alternativas rejeitadas*.

---

## Critérios de aceite

- [x] Existe um comando próprio (ex.: `pnpm test:int`) que sobe o app, aplica migrações e roda os três fluxos contra Postgres. — `pnpm test:int` (apps/api e raiz) sobe o app Nest com `NestFactory`, roda `migrate deploy` + seed no globalSetup e atravessa HTTP → serviço → Prisma → Postgres. **8 testes verdes em 08/08/2026**, ~12s.
- [x] O `pnpm test` continua **sem tocar banco** e sem exigir `DATABASE_URL` — a medição da US-80 (*Questão* #2) continua valendo depois desta story. Repetir a medição e colar o resultado. — Medido em 08/08/2026 rodando `pnpm test` com `DATABASE_URL`, `AUTH_SECRET` e as chaves de LLM **removidas do ambiente**:

  | projeto | arquivos | testes |
  |---|---:|---:|
  | `apps/api` | 16 | 142 |
  | `packages/shared` | 7 | 77 |
  | `packages/ai-engine` | 7 (+3 `skip`) | 110 (+6 `skip`) |
  | `apps/web` | 7 | 61 |
  | **total** | **37** | **390 verdes, exit 0** |

  Os 16 arquivos de `apps/api` são os mesmos de antes desta story: o `ai.int.test.ts` **não** entra, pelo `exclude` do `vitest.config.ts` novo.
- [~] O CI roda `test:int` num passo separado, reusando o serviço Postgres da US-93. — Passo `Testes de integração com banco` escrito no `ci.yml`, depois do `pnpm test`, com `TEST_DATABASE_URL` no `env:` DO PASSO (não do job) e apontando para o database `postgres` do serviço da US-93. **Configurado, ainda não observado num run real** do GitHub Actions — fecha quando um push exercitar o passo.
- [x] **Teste de regressão (a camada morde onde o unitário não morde):** introduzir um bug que **só** o banco pega — por exemplo, gravar em `Adventure.entities` um valor que viola a forma esperada, ou remover a leitura da ficha no cálculo do modificador — e mostrar `pnpm test` **verde** e `pnpm test:int` **vermelho**. Este critério é a razão de ser da story; sem ele ela não fecha. — Feito em 08/08/2026: trocado `skills: resolvedSkills` por `skills: undefined` no `resolveRollModifier` (`ai.service.ts:401`). `pnpm test` **verde** (142/142 na API), `pnpm test:int` **vermelho** — o fluxo 1 falhou porque o modificador gravado no `DICE_ROLL` deixou de bater com a ficha. Código restaurado depois (sem diff).
- [x] Cada teste limpa o que criou (ou roda em transação revertida): rodar a suíte duas vezes seguidas dá o mesmo resultado. — `TRUNCATE ... RESTART IDENTITY CASCADE` no `beforeEach` (preservando `System`). Rodada duas vezes seguidas: 8/8 nas duas.
- [x] Tempo total do passo registrado. Se passar de ~2 min, cortar fluxo em vez de aceitar. — **~12s** para os 8 testes (a seed no globalSetup domina; os fluxos somam ~4,6s). Bem abaixo do teto.

---

## Progresso de implementação

**08/08/2026 — implementada e VERDE contra um Postgres real.** Os 8 testes (3 fluxos) rodaram num container `pgvector/pgvector:pg16` local, em ~12s. Critérios #1, #2, #4, #5 e #6 fechados; #3 (o passo no CI) está escrito, mas ainda não foi visto num run do GitHub Actions.

Como rodar:

```bash
docker run -d --name ai-dm-pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16-alpine
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres pnpm test:int
```

**Arquivos:** `apps/api/vitest.config.ts` (só o `exclude`), `apps/api/vitest.int.config.ts`, `apps/api/test/int-db.ts`, `apps/api/test/int-setup.ts`, `apps/api/src/ai/ai.int.test.ts`, script `test:int` em `apps/api/package.json` e na raiz, passo `Testes de integração com banco` no `ci.yml`. **Zero código de produção alterado.** Duas devDeps novas na API (`unplugin-swc`, `@swc/core`) — motivo no desvio #5.

**Seis desvios do plano abaixo, todos com motivo:**

1. **O banco vem de `TEST_DATABASE_URL`, não de `dotenv -e .env`.** O plano dizia `dotenv -e .env -- vitest`, e isso é perigoso: o `.env` da raiz carrega a `DATABASE_URL` da Neon (US-58), e a limpeza entre testes é `TRUNCATE CASCADE` — apontada para lá, a suíte apagaria as personagens e aventuras reais. Agora a variável é separada, obrigatória, e o host tem de ser local; as duas recusas foram verificadas.
2. **`NestFactory.create` no lugar de `Test.createTestingModule`.** `@nestjs/testing` não está instalado, e nenhum provider é sobrescrito (o dublê entra pelo `vi.mock`) — instalar o pacote seria dependência nova para nada.
3. **Dublê escrito à mão, não o `MockLanguageModelV1` de `ai/test`.** Aquele entrypoint só resolve sob `moduleResolution` node16/bundler e a API está em node10; usá-lo custaria mexer no tsconfig do app inteiro por causa de um teste.
4. **O guard do banco não lança quando a variável está só ausente.** A primeira versão lançava no carregamento da config e deixava o `pnpm dead` vermelho — o knip carrega todo config do repo sem env nenhuma. Host remoto ainda morre no carregamento; ausência morre no globalSetup, que também roda antes de qualquer escrita.
5. **`unplugin-swc` + `@swc/core` como devDeps da API.** Não previsto no plano, descoberto ao rodar: o container de DI do Nest lê os tipos do construtor por `emitDecoratorMetadata`, que o esbuild (transpiler default do Vitest) NÃO emite — sem isso o Nest injeta `undefined` e o controller estoura com `Cannot read ... 'assertCharacterOwner'`. Os unitários nunca bateram nisso porque instanciam os controllers à mão (`new AiController(...)`). É a config oficial NestJS+Vitest, sem equivalente já instalado, e vive só no `vitest.int.config.ts`.
6. **Alias de `express` no config de integração.** O controller importa `Response` de 'express', mas o pnpm não hoista `express` para `apps/api` (em runtime ela resolve por dentro de `@nestjs/platform-express`), e o resolver do Vite não segue essa cadeia. Em vez de trocar o import do controller (produção), o config acha o `express` do store a partir da plataforma e aponta um `resolve.alias` para lá.

**Dois achados, ambos congelados em teste e candidatos a story própria:**

1. **`maxHp: 0` no upsert de `updateCharacterHp`** (`ai.service.ts:436`): sem `CharacterState` prévio, o `create` usa `characterState?.maxHp ?? 0` e o clamp de `:432` leva o HP a 0 — dano vira morte instantânea. O teste `CARACTERIZAÇÃO: sem CharacterState prévio…` **documenta**, não aprova.
2. **Race em tools repetidas no mesmo step.** Duas `rollDice` (ou duas `recordEntity`) emitidas no MESMO step do modelo rodam em paralelo (o AI SDK executa tool-calls concorrentemente), e o read-modify-write da trava da US-38 e do merge de `recordEntity` não é atômico: a segunda rolagem grava um 2º `DICE_ROLL`, e a 2ª entidade sobrescreve a 1ª. Descoberto porque a 1ª versão dos testes emitia as duas no mesmo step. Os testes agora usam steps SEQUENCIAIS (como o comentário `:594` descreve e como um modelo repetiria a tool), então provam a costura sem depender da race. A race em si não tem teste que a exponha — se um dia importar, é story própria.

**Gates verdes em 08/08/2026:** `pnpm typecheck`, `pnpm test` (390, sem banco), `pnpm test:int` (8, com banco), `pnpm dead`, `pnpm docs:links`.

---

## Plano de testes

Derivado da leitura do código em 08/08/2026, e dependente das três decisões das *Questões em aberto* (dublê por `vi.mock`, limpeza por truncate, passo no mesmo job). Nada aqui foi executado.

### Preparo — sem isto nenhum teste existe

1. **`apps/api/vitest.config.ts`** com `exclude: ['**/*.int.test.ts']`. O `apps/api` hoje **não tem config de Vitest**: `pnpm test` é `vitest run` com defaults, que varre `**/*.test.ts`. Sem esta config o arquivo de integração entra no `pnpm test`, exige banco e o critério de aceite #2 morre no mesmo commit que a story nasce.
2. **`apps/api/vitest.int.config.ts`** com `include: ['**/*.int.test.ts']` e `fileParallelism: false` — um banco, três testes que escrevem nas mesmas tabelas.
3. **Script `test:int`** = `dotenv -e .env -- vitest run -c vitest.int.config.ts`, em `apps/api` e espelhado na raiz (padrão dos `db:*`, que já usam o wrapper `dotenv`; a API não carrega `.env` sozinha).
4. **Setup global:** `prisma migrate deploy` + `db:seed` uma vez por execução. `migrate deploy`, não `migrate dev` — a armadilha da US-58 vale aqui igual.
5. **Dublê do modelo:** `MockLanguageModelV1` de `ai/test` (existe no `ai@4.3.19` já instalado), injetado pelo `vi.mock` da *Questão* #1.

### Fluxo 1 — rolagem ancorada na ficha ([US-38](./US-38-rolagens-ancoradas-na-ficha.md))

POST `/ai/chat`; o dublê chama `rollDice({ skill: 'Percepção' })`.

- Existe `EventLog` tipo `DICE_ROLL` no Postgres, e `payload.modifier` é o derivado de `baseAttributes`/`skills` da ficha semeada — **não** o que o modelo mandou.
- `payload.skillLabel` preenchido: é o rótulo canônico que a US-38 ancora.
- Segundo `rollDice` ancorado no mesmo turno **reusa o primeiro** (`ai.service.ts:393`): **um** `DICE_ROLL` gravado, não dois. Essa contagem é verificável só contra banco — o `fakePrisma()` não conta linhas.

### Fluxo 2 — dano persiste

O dublê chama `updateCharacterHp({ newHp: 6 })`.

- `CharacterState.hp` lido de volta do Postgres = 6, e `EventLog` `CHARACTER_UPDATE` gravado.
- **O caso que justifica a story:** personagem **sem** `CharacterState` prévio. O `create` do upsert (`ai.service.ts:436`) grava `maxHp: 0`, e o clamp de `:432` leva o HP a 0 junto — dano vira morte instantânea. Nenhum test double reprova isso, porque o double concorda com o código. Se o caminho for inalcançável em runtime (a criação de aventura sempre cria o state), o teste congela o comportamento; se for alcançável, achou um bug. Nos dois desfechos vale mais que os outros dois fluxos somados.

### Fluxo 3 — entidade sobrevive ([US-87](./US-87-bloco-de-entidades-ausente-citado-no-prompt.md))

Turno 1 com `recordEntity`, turno 2 sem tool nenhuma.

- `Adventure.entities` no Postgres contém a entidade, e no turno 2 o bloco aparece no prompt (observável pelo dublê, que recebe `system`/`messages`).
- **Caso vazio:** `entities` nulo → bloco ausente, sem crash. É o defeito exato da US-87.
- Duas chamadas de `recordEntity` no mesmo turno **acumulam**: o merge relê do banco, não do closure (`:596`). O re-read é literalmente uma query — unitário não o exercita.
- **Não** gravou `CHARACTER_UPDATE` (`:608`): regressão da trava de edição da [US-67](./US-67-editar-acao-enviada-ao-dm.md), que bloquearia turnos de conversa se essa linha voltasse.

### Teste de regressão — critério de aceite #4

O bug injetado tem de ser da família que **só** o banco pega. Dois candidatos, em ordem de honestidade:

1. Remover `resolvedSkills` do `resolveRollModifier` (`:401`) — o unitário passa porque o double concorda com o código; o banco entrega a ficha real e o modificador sai errado.
2. Gravar `Adventure.entities` com forma inválida (objeto em vez de array).

Colar no PR as duas saídas: `pnpm test` **verde**, `pnpm test:int` **vermelho**. Sem isso a story não fecha — e sem isso os três fluxos são só cerimônia que repete o que o unitário já dizia.

### Meta-critérios

- **#2 (`pnpm test` sem banco):** rodar com `DATABASE_URL` removida do ambiente e colar a saída, repetindo a medição da US-80.
- **#5 (idempotência):** `pnpm test:int` duas vezes seguidas, mesmo resultado. Limpeza pelo `TRUNCATE` da *Questão* #2.
- **#6 (tempo):** registrar. O custo dominante é a seed, não os três testes.

### Fora deste plano

`updateInventory`, `updateScene`, `getSpell`, suíte de contrato dos demais endpoints. Entram quando um bug de costura escapar por lá — não antes, sob pena de virar a suíte lenta que a seção *Fora do escopo* já recusou.

---

## Alternativas consideradas e rejeitadas

1. **Branch efêmera da Neon por execução de CI** ([US-58](./US-58-banco-postgres-neon.md) já dá o projeto, e o MCP da Neon já está acessível). Rejeitada como primeira escolha: exige secret no job (a US-80 manteve o `ci` sem nenhum), depende de rede e de ciclo de vida (criar/apagar branch, e branch órfã em falha de job), e paga latência de internet em cada query. Um `services: postgres` no runner é local, grátis e some sozinho. Reabrir se algum dia o teste precisar de uma extensão ou de um comportamento específico da Neon que o Postgres cru não reproduz.
2. **SQLite em memória.** Rejeitada: o provider do Prisma é `postgresql`; testar contra outro dialeto verifica um banco que não existe em produção — exatamente o defeito do `fakePrisma()`, com mais cerimônia.

---

## Notas de implementação

- **`AiService` é `@Injectable` e monta a lista de tools inline** (`apps/api/src/ai/ai.service.ts`, tools em `:349-585`, `streamChat` em `:233`). O ponto de substituição do LLM tem que ser escolhido com cuidado: substituir o serviço inteiro apaga justamente o código sob teste.
- **Já existe precedente de teste no nível do controller** (`apps/api/src/ai/ai.controller.test.ts`) — olhar como ele monta o módulo antes de inventar um jeito novo.
- **A seed importa.** Os três fluxos dependem de dados de sistema (SRD, [US-47](./US-47-ingestao-srd-como-dado.md)); rodar `db:seed` no preparo, não fabricar personagem à mão com dados que a seed contradiz.
- **Não usar MSW.** A estratégia de testes registra que ele não é usado no repo; o dublê do modelo é local.

---

## Questões em aberto

*As três foram respondidas em 08/08/2026 por **leitura do código**, não por execução: nada abaixo foi rodado contra um Postgres. O que a implementação medir manda sobre o que está escrito aqui.*

1. ~~**Onde entra o dublê do modelo?**~~ **Respondida: não há ponto de injeção — e não precisa haver. O dublê entra por `vi.mock` parcial de `@ai-dm/ai-engine`, sem tocar produção.**

   A hipótese do "provider Nest sobrescrito" não se sustenta: o construtor do `AiService` injeta só `PrismaService` e `DiceService` (`ai.service.ts:151-154`), e o modelo é escolhido dentro do método, lendo o array importado do pacote (`narrationModels`, importado em `:9`, usado em `:636`).

   ```ts
   vi.mock('@ai-dm/ai-engine', async (importOriginal) => ({
     ...(await importOriginal<typeof import('@ai-dm/ai-engine')>()),
     narrationModels: [dubleDeTurno()],
   }))
   ```

   Funciona porque `narrationModels` é um `const` exportado (`packages/ai-engine/src/model.ts:178`) lido a cada turno, não capturado no load do `AiService`. E o `importOriginal()` é seguro num runner sem secrets: os provedores são construídos no load com `apiKey: process.env[...]` (`model.ts:7-61`) e **não lançam** com chave ausente — a falta só apareceria numa requisição, que o dublê nunca faz. O CI segue sem nenhum secret, como a US-80 o deixou.

   **Não mockar `streamText`** (importado de `'ai'` em `:3`): isso apaga o loop de tool calling, que é o código sob teste — o erro contra o qual as *Notas de implementação* já avisam.

   Duas restrições que o dublê tem de honrar, ou o teste vira flake por um motivo que não é o testado:
   - `maxSteps: 5` (`:658`) — tool call num step, texto no seguinte; resposta diferente por chamada.
   - o texto **termina em lista de opções**, senão o guard da [US-74](./US-74-guard-turno-truncado-narracao.md) marca `incomplete`, o controller re-amostra, o turno roda duas vezes e a asserção de "um único `DICE_ROLL`" quebra.

   **Plano B, com gatilho:** se o `vi.mock` no specifier do workspace se provar frágil — o pacote resolve para `dist/`, não `src/` —, aí entra a mudança de produção: token Nest `NARRATION_MODELS`, com `narrationModels` como default no `AiModule`. Declarada no PR, como esta story exige. Só depois de o mock falhar de verdade, não preventivamente.

2. ~~**Transação por teste ou truncate entre testes?**~~ **Respondida: truncate. Nenhum dos três fluxos transaciona, e a transação revertida é impossível sem mudar produção.**

   A pergunta pedia para olhar se algum dos três fluxos abre transação própria: não abre. O único `$transaction` do serviço é a sumarização (`ai.service.ts:1161`), atrás do gate de 30 eventos não-resumidos (`SUMMARIZE_THRESHOLD`, `:54`) que três testes nunca alcançam.

   O impedimento real é outro: transação revertida exige que o código sob teste escreva pelo client **da transação**, e as tools usam `this.prisma` direto (`:408`, `:433`, `:603`) — o singleton que o Nest injetou. Entregar o `tx` a elas é exatamente a mudança de produção que a questão #1 acabou de evitar.

   ```sql
   TRUNCATE "EventLog","CharacterState","Quest","AdventureParticipant","Adventure","Character","User" RESTART IDENTITY CASCADE;
   ```

   `System` fica de fora: é o que a seed cara produz e os três fluxos só o leem. `User` e `Character` são recriados no `beforeEach` — o `AuthGuard` do controller (`ai.controller.ts:22`) exige dono real.

   **O risco de instabilidade não está na limpeza, está no `onFinish`.** Ação e narração são persistidas lá (`:683`), depois do fim do stream — fechar o SSE não garante que a escrita aconteceu. Ou o teste faz poll curto no `EventLog` até a `NARRATION` aparecer, ou as asserções que dependem dela ficam fora dos três fluxos. Acertar isto importa mais que a escolha entre truncate e transação.

3. ~~**O passo entra no caminho crítico do CI ou num job paralelo?**~~ **Respondida: mesmo job `ci`, passo separado depois do `pnpm test`** — e vale igual para a US-93, que deixou a mesma pergunta sobre o serviço que as duas compartilham.

   Job paralelo duplica a parte cara (`pnpm install --frozen-lockfile`, `prisma generate`, build dos pacotes) para economizar wall clock num repo de uma pessoa, e obriga a declarar o `services: postgres` duas vezes ou a mudar o gate de drift de job junto. Mesmo raciocínio — e mesmo gatilho de saída — com que a US-93 respondeu a sua *Questão* #1.

   **Duas armadilhas do `ci.yml` que a implementação tem de acertar:**

   - A `DATABASE_URL` real vai no `env:` **do passo**, nunca do job. Hoje o job carrega uma fictícia (`ci.yml:14`), e é ela que faz o `pnpm test` provar que roda sem banco; promovê-la a real mata o critério de aceite #2 em silêncio.
   - O banco do `test:int` **não** é o `shadow`. O serviço sobe com `POSTGRES_DB: shadow` (`ci.yml:32`) e o `migrate diff --from-migrations` derruba e recria esse database — compartilhar é corrida garantida. A imagem `postgres:16-alpine` sempre cria o database `postgres`, então `postgresql://postgres:postgres@localhost:5432/postgres` serve sem nenhum passo de `createdb`.

   **Gatilho para reabrir:** job `ci` passando de ~10 min. Nesse ponto o candidato natural a sair para um job paralelo é o `pnpm eval`, não o `test:int`.

---

## Referências no código

- `apps/api/src/ai/ai.service.ts` — `streamChat` (`:233`), objeto `tools` (`:349-585`), o loop sob teste.
- `apps/api/src/ai/ai.controller.test.ts` — precedente de montagem de módulo de teste.
- `apps/api/src/ai/ai.service.test.ts` — o `fakePrisma()` que esta story **não** substitui.
- `apps/api/prisma/schema.prisma` e `apps/api/prisma/migrations/` — o que o banco efêmero materializa.
- [Estratégia de testes](../04-testes/estrategia-de-testes.md), seção *2. Testes de integração* — a lacuna declarada que esta story fecha.
