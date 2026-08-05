# US-93 — Três gates baratos: drift de migração, dependência vulnerável e smoke pós-deploy

**Épico:** 5 — Ferramentas de projeto / SDLC
**Fase:** 1 — MVP single-player
**Status:** 🚧 Em progresso
**Depende de:** [US-80](./US-80-ci-typecheck-testes-e-evals.md) (o workflow). O smoke depende também da [US-92](./US-92-deploy-espera-o-ci-verde.md) — mas **não** do jeito que esta story supunha quando foi escrita: a US-92 fechou com `autoDeployTrigger: checksPass` e descartou o job `deploy` do desenho original, então o smoke ganhou workflow próprio (ver *Notas de implementação*).
**Criada em:** 2026-07-30

---

## História

> **Como** mantenedora do AI DM,
> **quero** três verificações que o CI ainda não faz e que custam poucas linhas cada,
> **para que** schema fora de migração, dependência vulnerável e deploy morto parem de depender de alguém reparar por acaso.

---

## Contexto e motivação

### O problema observado

O CI cobre bem o que é código-fonte e documentação: `typecheck`, `test`, `eval`, `knip`, links, forma do README. Sobraram três lacunas de natureza diferente — nenhuma é sobre o TypeScript compilar.

**1. Schema Prisma pode divergir das migrações sem ninguém notar.** `apps/api/prisma/schema.prisma` e `apps/api/prisma/migrations/` são dois arquivos que precisam contar a mesma história, e nada compara os dois. O `prisma generate` do CI (`ci.yml:45`) lê **só o schema** — ele gera um client feliz para um banco que a migração nunca vai produzir. O erro aparece em produção, no `prisma migrate deploy` do `buildCommand` do `render.yaml`, ou pior: não aparece, e o client tipado promete uma coluna que o Postgres não tem.

**2. Nenhuma varredura de dependência.** Não existe `.github/dependabot.yml` (verificado em 30/07/2026) e nenhum passo roda `pnpm audit`. O repo tem lockfile congelado, o que é ótimo para reprodutibilidade e péssimo para atualização: uma dependência com CVE fica pinada indefinidamente, porque nada avisa.

**3. Deploy pode subir morto e ninguém sabe.** O `healthCheckPath: /api/v1/systems` do `render.yaml` é do **Render**, não do CI: ele decide se marca o deploy como live, e o resultado dessa decisão mora no painel. Depois da [US-92](./US-92-deploy-espera-o-ci-verde.md), o CI dispara o deploy e termina verde sem saber se o que ele disparou respondeu alguma coisa.

### Por que estão numa story só

Não é tema comum — é **custo comum**. As três são de poucas linhas e nenhuma sozinha justifica o overhead de uma story. O único código de produção é o header `X-Commit` de 3 linhas de que o gate 3 precisa para distinguir deploy novo de velho (ver *Questões em aberto* #2). Se qualquer uma delas crescer (ver *Questões em aberto* #1), ela sai desta e vira story própria.

---

## Escopo

### Dentro do escopo

**Gate 1 — drift de migração.** Passo novo no job `ci`, depois do `prisma generate`:

```
# cwd = apps/api (ver Notas de implementação: prisma.config.ts resolve o schema
# relativo a si mesmo).
prisma migrate diff \
  --from-migrations prisma/migrations \
  --to-schema prisma/schema.prisma \
  --shadow-database-url "$SHADOW_DATABASE_URL" \
  --exit-code
```

Exit 2 = há diferença = schema editado sem migração. **Isto exige um Postgres de verdade**: `--from-migrations` replica as migrações num shadow database para comparar. Entra como `services:` do job (imagem oficial `postgres`), que roda no runner e não custa nada — é o oposto de "banco de teste em produção".

**Gate 2 — dependências.** `.github/dependabot.yml` com dois ecossistemas:
- `npm` na raiz (o pnpm workspace é lido pelo Dependabot como npm), semanal, PRs agrupados;
- `github-actions`, semanal — as actions do workflow também envelhecem.

**Gate 3 — smoke pós-deploy.** Workflow `.github/workflows/smoke.yml`, disparado por `workflow_run` do CI concluído com sucesso na `main`: poll no `/api/v1/systems` público até o header `X-Commit` bater com o SHA do run, com timeout, falhando se estourar. Inclui as 3 linhas em `apps/api/src/main.ts` que emitem o header — o único código de produção desta story, absorvido aqui pela decisão da *Questões em aberto* #2. **Não** é um job do `ci.yml`: o porquê está nas *Notas de implementação*, e é um deadlock, não estilo.

### Fora do escopo

- **`pnpm audit` como passo que reprova.** Audit em monorepo com transitivas costuma nascer vermelho e treinar a pessoa a ignorar vermelho — a mesma razão pela qual a US-80 entrou com `docs:links --only-md`. O Dependabot abre PR, que é sinal acionável; audit bloqueante entra depois, se a fila de PR mostrar que vale.
- **Auto-merge dos PRs do Dependabot.** Precisa de branch protection e de CI que morda, nenhum dos dois existe. Fica manual.
- **Usar o Postgres do gate 1 para rodar teste de verdade.** É a [US-95](./US-95-camada-de-integracao-com-banco-efemero.md), que herda este `services:` em vez de criar outro.
- **Monitoramento contínuo em produção** (uptime, alerta). Smoke é uma pergunta única depois do deploy, não observabilidade.

---

## Critérios de aceite

Código escrito em 05/08/2026 e ainda **não commitado** quando esta seção foi atualizada. Nenhum critério fecha antes do primeiro push: todos medem comportamento de runner ou de produção, não a existência do arquivo. Cada item abaixo diz o que já foi medido e o que falta, para o próximo passe não remedir o que já está de pé.

- [ ] O job `ci` tem um serviço Postgres e um passo de `migrate diff` que sai 0 na `main` de hoje.
  **Feito:** `services: postgres:16-alpine` com health check `pg_isready`, `SHADOW_DATABASE_URL` no `env:` do job e o passo *Gate de drift de migração* com `working-directory: apps/api` (`ci.yml`); `datasource.shadowDatabaseUrl` no `prisma.config.ts`.
  **Falta:** rodar. Não há Docker na máquina de desenvolvimento, então o `--from-migrations` nunca executou contra um Postgres de verdade. O que a *Questão* #3 mediu foi o `--from-config-datasource` contra a Neon — outra fonte, outro caminho de código.
- [ ] **Teste de regressão (gate 1 morde):** adicionar um campo em `schema.prisma` **sem** criar migração deixa o passo vermelho, nomeando a diferença. Campo removido depois (`git diff` limpo), com a saída colada aqui.
  **Falta inteiro** — depende do critério acima estar verde primeiro, senão não dá para distinguir "mordeu" de "quebrou".
- [ ] Existe `.github/dependabot.yml` com `npm` e `github-actions`, e o painel *Insights → Dependency graph → Dependabot* mostra os dois ecossistemas ativos.
  **Feito:** o arquivo, com os dois ecossistemas, semanais, agrupados por `dependency-type` (`producao`/`desenvolvimento`) e `patterns: ['*']` nas actions.
  **Falta:** o painel. O GitHub só lê o arquivo depois de ele existir na branch default.
- [ ] `/api/v1/systems` de produção responde o header `X-Commit` com o SHA do deploy vivo, sem mudar o corpo tipado de `packages/shared`.
  **Feito, metade:** medido em 05/08/2026 com a API em `localhost:3001` — `HTTP/1.1 200` + `X-Commit: dev`, e o mesmo `curl -sS -o /dev/null -D - | tr -d '\r' | awk` do `smoke.yml` extraiu `dev`. Ou seja: o middleware registra, o header sai, e o parse do workflow funciona contra uma resposta real. `packages/shared` não foi tocado.
  **Falta:** a metade que só produção responde — se `RENDER_GIT_COMMIT` existe em runtime. É o experimento da *Questão* #2.
- [ ] O workflow `smoke` só fica verde depois de o `X-Commit` de produção bater com o SHA do run — não basta `200`.
  **Feito:** `.github/workflows/smoke.yml`, `on: workflow_run` do CI concluído com sucesso na `main`, poll de 40 × 15 s (10 min, cobre build do Render + cold start), comparando com `github.event.workflow_run.head_sha`.
  **Falta:** rodar uma vez. E, junto com ele, o risco do `workflow_run` descrito nas *Notas de implementação* — se o Render parar de deployar, o problema é este arquivo.
- [ ] **Teste de regressão (gate 3 morde):** com o serviço do Render suspenso à mão, o passo de smoke fica vermelho por timeout em vez de verde por omissão.
  **Falta inteiro.** Custa 10 min de espera do timeout; fazer depois do caminho feliz.
- [ ] O acréscimo de tempo de cada gate está medido e registrado — o `services: postgres` é o único com custo real de startup.
  **Falta inteiro**, e é o que decide a *Questão* #1: acima de 30 s de acréscimo, o `migrate diff` sai para um job `db` paralelo.

### Já verificado no repo (não é critério de aceite, mas evita remedir)

Em 05/08/2026, com todas as mudanças aplicadas: `pnpm typecheck` verde nos 4 projetos, `pnpm test` com 142 testes em 16 arquivos passando, `pnpm docs:links` (gate completo, sem `--only-md`) com `Quebrados: 0`.

---

## Notas de implementação

- **O Render Free dorme.** O serviço hiberna por inatividade e o primeiro request paga cold start; a [US-57](./US-57-warmup-do-servidor-na-entrada.md) existe por causa disso. O smoke tem que ser **poll com retry** (ex.: `curl --fail --retry 10 --retry-all-errors --retry-delay 15 --max-time 30`), nunca um `curl` único: um `curl` seco vai falhar por cold start e ensinar que o passo é flaky.
- **Deploy é assíncrono.** O Deploy Hook da US-92 responde na hora; o build do Render leva minutos. O smoke precisa esperar o *novo* deploy, não responder 200 do processo **antigo** que ainda está no ar. Por isso o header `X-Commit` foi absorvido por esta story (ver *Questões em aberto* #2): o poll compara com `${{ github.sha }}` e só fica verde quando a API **nova** responde, sem consultar a API do Render. A ressalva antiga — "o smoke prova apenas que há uma API viva" — deixou de valer junto com a story irmã.
- **Flags do `migrate diff` mudaram no Prisma 7.** `--from-schema-datasource` e
  `--to-schema-datamodel` foram **removidas** (medido em 05/08/2026, prisma 7.8.0):
  `--from-schema-datasource` was removed. Please use `--[from/to]-config-datasource`.
  Os nomes atuais são `--from-config-datasource` / `--to-schema`. Qualquer receita de
  `migrate diff` copiada de blog ou de doc do Prisma 6 sai com exit 1 e mensagem de
  usage — que é vermelho por sintaxe, não por drift, e engana quem for ler o log.
- **O passo roda com cwd `apps/api`.** `prisma.config.ts` mora lá e faz
  `schema: path.join('prisma', 'schema.prisma')`, relativo a si mesmo. Rodando da raiz,
  ou se usa `--config apps/api/prisma.config.ts`, ou o CLI não acha o schema. Os caminhos
  do bloco acima são relativos a `apps/api` por causa disto.
- **`--shadow-database-url` não existe mais no Prisma 7.** A flag saiu junto com as outras; o `migrate diff --help` do 7.8.0 lista só `--from-*`/`--to-*`, `--script`, `--exit-code`, `--config` e `-o`. O valor passou a vir do `prisma.config.ts`, em `datasource.shadowDatabaseUrl`. Lá foi escrito como `process.env['SHADOW_DATABASE_URL']` cru e **não** com o helper `env()`: a assinatura é `env(name: string): string`, ou seja, exige a variável — e todo comando Prisma local, onde o shadow não existe, quebraria no carregamento do config.
- **`SHADOW_DATABASE_URL` não é secret:** aponta para o serviço do próprio runner (`postgresql://postgres:postgres@localhost:5432/shadow`). O job `ci` continua sem secret, como a US-80 exige. O `POSTGRES_DB: shadow` do `services:` existe para casar com o nome no fim dessa URL.
- **O smoke não pode ser um job do `ci.yml` — é deadlock.** O GitHub cria um check run **por job**, e a US-92 pôs o Render em `autoDeployTrigger: checksPass`, que espera *todos* os checks do commit. Um job `smoke` com `needs: ci` ficaria pendente esperando o deploy, e o Render esperaria o smoke concluir para deployar. Resultado: nenhum dos dois anda e a `main` para de deployar em silêncio — exatamente a armadilha "falha fechada por ausência de check" que a US-92 já documentou. Daí o workflow separado com `on: workflow_run`, que roda **depois** do run que o Render observa.
- **Risco assumido do `workflow_run` (medir no primeiro push):** se o GitHub anexar o check run do `smoke` ao mesmo commit, o Render pode voltar a esperá-lo e o deadlock reaparece por outro caminho. A corrida é favorável — o smoke só nasce depois de o CI concluir, quando o Render já avaliou os checks — mas não foi medida. Sinal de que deu errado: push verde na `main` e nenhum deploy criado no Render. Conserto: apagar `.github/workflows/smoke.yml` (diff de 1 arquivo, reversível), e o plano B é o smoke virar disparo manual (`workflow_dispatch`) ou consultar a API do Render em vez de depender de check.
- **A `DATABASE_URL` fictícia de `ci.yml:16` continua fictícia.** O shadow é uma variável à parte; nada nesta story faz teste tocar banco.
- **Dependabot e o pnpm workspace:** o Dependabot lê `pnpm-lock.yaml`, mas a granularidade dos PRs em monorepo é irritante sem `groups:`. Agrupar por `dependency-type` desde o começo.

---

## Questões em aberto

1. **O gate 1 justifica um serviço Postgres no job?** É o único item desta story com custo de infraestrutura, e a US-80 tirou banco do runner de propósito.

   **Decisão: nasce dentro do job `ci`, com gatilho de saída escrito** — se o `services:` somar **mais de 30s** ao tempo do job, o `migrate diff` sai para um job paralelo `db` com `needs: []`. Usar `postgres:16-alpine`, não `postgres:16`: o container de serviço sobe *antes* do primeiro step, então o pull está no caminho crítico de verdade.

   O split não é de graça e por isso não vem primeiro: um job separado precisa repetir `checkout` + `pnpm install` só para ter o CLI do Prisma no PATH. Trocar ~1 min de runner por um custo de startup que ainda não foi medido é otimizar antes de medir. A medição já está nos critérios de aceite; o split depois é diff de 5 linhas.

2. **Vale expor a versão/SHA para o smoke distinguir o deploy novo do velho?** Sim — e a forma barata é **header de resposta, não campo no corpo**.

   O corpo de `/api/v1/systems` é contrato tipado em `packages/shared` e consumido pelo front: meter `version` lá é mudar contrato de produto por causa de CI. Header não é contrato de ninguém, e o Render injeta `RENDER_GIT_COMMIT` sozinho no ambiente do serviço (verificado só na documentação — ver abaixo por que não dá para verificar no serviço):

   ```ts
   // apps/api/src/main.ts, depois do enableCors
   app.use((_req, res, next) => {
     res.setHeader('X-Commit', process.env['RENDER_GIT_COMMIT'] ?? 'dev')
     next()
   })
   ```

   O smoke vira poll até `curl -sI` devolver `X-Commit: ${{ github.sha }}` — o que resolve de uma vez as duas metades do problema: prova que a API **nova** está viva *e* dispensa consultar a API do Render para saber que o deploy assíncrono terminou.

   **Fica nesta story — a irmã `US-XX — Deploy identificável pelo SHA` foi cancelada antes de existir (decidido em 05/08/2026).** O motivo é que o gate "confirmar antes de implementar" saiu mais caro que a coisa que ele ia proteger: não existe caminho para observar `RENDER_GIT_COMMIT` sem antes fazer um deploy que o leia.

   Medido em 05/08/2026, contra o serviço `srv-d9f50kjrjlhs73dimceg` (`ai-dm-api`, `plan: free`, oregon):

   - **O painel não mostra.** A aba *Environment* lista só as env vars que a mantenedora definiu. `RENDER_GIT_COMMIT` é *default environment variable* injetada pela plataforma e não aparece lá. A API REST e o Render MCP têm a mesma limitação: devolvem só as user-set.
   - **SSH não é opção no plano Free.** `render ssh srv-d9f50kjrjlhs73dimceg -- printenv RENDER_GIT_COMMIT` sai com `Failed to SSH (...) exit status 255`. A tabela de compatibilidade de <https://render.com/docs/ssh> marca `Free web service ❌ ❌` para shell e para SSH; só instance type pago abre. O picker de instância do CLI abrir **não** é sinal de que dá — ele lista antes de tentar conectar.
   - **`echo` no `buildCommand` prova a coisa errada.** Confirmaria a var no ambiente de *build*, e o header lê em *runtime*.

   O `?? 'dev'` do snippet é o próprio experimento, e é por isso que implementar direto é seguro: se a var não existir em runtime, o header responde `X-Commit: dev`, nada quebra, e a resposta aparece no primeiro `curl -sI`. Consequência: o critério de aceite do header pode falhar na primeira execução — isso é o resultado da medição, não um bug a esconder.

3. ~~**Existe migração pendente hoje?**~~ **Respondida em 05/08/2026: não há. O gate 1 nasce verde, liga direto.**

   Verificado sem Docker e sem shadow database, read-only contra a Neon de produção, em duas perguntas que juntas fecham a cadeia:

   - `prisma migrate status` → `13 migrations found` / `Database schema is up to date!`, sem aviso de migração modificada (checksum bate).
   - `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code` → `No difference detected.`, exit 0.

   Como o Postgres de produção foi construído pelas próprias migrações (o `migrate deploy` do `buildCommand`), migrações ≡ banco ≡ schema. Não se aplica o precedente da US-82 esperando a US-81: não há dívida a extrair antes de ligar o gate.

   Isto **não substitui** o gate: o que foi medido é o estado de hoje contra um banco que existe, e o gate mede toda `main` futura contra um shadow database efêmero, sem depender de produção estar de pé.

---

## Referências no código

- `apps/api/prisma/schema.prisma` e `apps/api/prisma/migrations/` — os dois lados que o gate 1 compara.
- `.github/workflows/ci.yml` (`:44-45`) — o `prisma generate`, que lê só o schema e por isso não detecta drift.
- `render.yaml` (`buildCommand`) — o `prisma migrate deploy`, hoje o primeiro lugar onde o drift aparece; e `healthCheckPath: /api/v1/systems`, o endpoint que o smoke reusa.
- `apps/api/src/main.ts` (depois do `enableCors`) — onde entram as 3 linhas do header `X-Commit` (questão #2).
- **Ausência de `.github/dependabot.yml`** — a lacuna do gate 2.
