# US-93 — Três gates baratos: drift de migração, dependência vulnerável e smoke pós-deploy

**Épico:** 5 — Ferramentas de projeto / SDLC
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
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

**Gate 3 — smoke pós-deploy.** Workflow `.github/workflows/smoke.yml`, disparo **manual** (`workflow_dispatch`, com input `sha` opcional): poll no `/api/v1/systems` público até o header `X-Commit` bater com o SHA pedido, com timeout, falhando se estourar. Inclui as 3 linhas em `apps/api/src/main.ts` que emitem o header — o único código de produção desta story, absorvido aqui pela decisão da *Questões em aberto* #2. Manual e não automático porque **qualquer** gatilho automático trava o deploy sob `autoDeployTrigger: checksPass`: o porquê e a medição estão nas *Notas de implementação*.

### Fora do escopo

- **`pnpm audit` como passo que reprova.** Audit em monorepo com transitivas costuma nascer vermelho e treinar a pessoa a ignorar vermelho — a mesma razão pela qual a US-80 entrou com `docs:links --only-md`. O Dependabot abre PR, que é sinal acionável; audit bloqueante entra depois, se a fila de PR mostrar que vale.
- **Auto-merge dos PRs do Dependabot.** Precisa de branch protection e de CI que morda, nenhum dos dois existe. Fica manual.
- **Usar o Postgres do gate 1 para rodar teste de verdade.** É a [US-95](./US-95-camada-de-integracao-com-banco-efemero.md), que herda este `services:` em vez de criar outro.
- **Monitoramento contínuo em produção** (uptime, alerta). Smoke é uma pergunta única depois do deploy, não observabilidade.

---

## Critérios de aceite

Todos medidos em 05/08/2026, nos commits `130fc51` (primeiro push), `167862e` (smoke manual, depois do deadlock) e `5cdfd85` (branch descartável do teste de drift). **7 de 7 fecharam**, sendo que o do gate 3 morder teve a redação trocada — está dito no próprio item.

- [x] O job `ci` tem um serviço Postgres e um passo de `migrate diff` que sai 0 na `main` de hoje. — Run `31029216684`, 21 passos verdes, `Gate de drift de migração: success` em 2 s (17:17:16 → 17:17:18). É a primeira execução do `--from-migrations` contra um Postgres de verdade; o que a *Questão* #3 tinha medido era o `--from-config-datasource` contra a Neon, outra fonte e outro caminho de código.
- [x] **Teste de regressão (gate 1 morde):** adicionar um campo em `schema.prisma` **sem** criar migração deixa o passo vermelho, nomeando a diferença. — Feito em 05/08/2026 no commit `5cdfd85`, campo `campoDeTesteDrift String?` no model `User`. Run `31038359160`, passo 8 `failure` e os passos 9-20 `skipped`:

  ```
  [*] Changed the `User` table
    [+] Added column `campoDeTesteDrift`
  ##[error]Process completed with exit code 2.
  ```

  Exit **2**, que é "há diferença", não 1, que seria erro do próprio comando — a distinção que as *Notas de implementação* avisam ser fácil de confundir no log. Rodou em **branch descartável** (`teste/us93-gate1-drift`, apagada local e remota depois), e não na `main` como fez a US-92: aqui o que se mede é o passo do CI, que roda em qualquer branch, então não há motivo para pôr um commit vermelho na branch default. `main` intocada, `schema.prisma` restaurado.
- [x] Existe `.github/dependabot.yml` com `npm` e `github-actions`, e os dois ecossistemas estão ativos. — Prova mais forte que o painel: em ~20 min o Dependabot abriu **3 PRs**, um por grupo declarado. E o gate 2 já mordeu de verdade, com o CI reprovando dois deles: [#4](https://github.com/1catarinagoncalves/AI-DM/pull/4) (grupo `producao`, 18 updates) sobe o AI SDK para v5 e quebra em `'"ai"' has no exported member named 'LanguageModelV1'` + `promptTokens`/`completionTokens` fora de `LanguageModelUsage`; [#5](https://github.com/1catarinagoncalves/AI-DM/pull/5) (grupo `desenvolvimento`, 8 updates) sobe TypeScript para 6 e quebra em `Option 'moduleResolution=node10' has been removed`. Ou seja: o gate encontrou duas atualizações incompatíveis que o lockfile congelado escondia, e o CI as segurou — exatamente o desenho de "abre PR, não reprova build".
- [x] `/api/v1/systems` de produção responde o header `X-Commit` com o SHA do deploy vivo, sem mudar o corpo tipado de `packages/shared`. — Medido em 05/08/2026 no `167862e`: produção respondeu `X-Commit: 167862e7f7ac7f5201e6401401e2a320b336a3ac`. **É a resposta da *Questão* #2: `RENDER_GIT_COMMIT` existe em runtime.** Antes disso, local em `localhost:3001`: `HTTP/1.1 200` + `X-Commit: dev`, provando o fallback. `packages/shared` não foi tocado.
- [x] O workflow `smoke` só fica verde depois de o `X-Commit` de produção bater com o SHA pedido — não basta `200`. — Run `31038030320`, disparado à mão com o deploy já live: verde na **tentativa 1/40**, `X-Commit=167862e7f7ac… esperado=167862e7f7ac…`.
- [x] **Teste de regressão (gate 3 morde):** o smoke fica vermelho por timeout em vez de verde por omissão. — Fechado em 05/08/2026 com duas evidências, e **sem** suspender produção. A redação original pedia o serviço do Render suspenso à mão; foi trocada de propósito, porque um serviço suspenso responde uma página 503 e cairia no primeiro caso abaixo, custando ~10 min de produção fora do ar para medir o que já estava medido.

  1. **API no ar, sem o header** — run `31029412396`, o do deadlock: 40 tentativas, todas `X-Commit=<sem resposta> esperado=130fc51…`, vermelho por timeout. Aconteceu por acidente, contra o serviço real, com o processo antigo (sem o middleware) respondendo `200`.
  2. **Conexão recusada** — a mesma linha do workflow, rodada local sob `bash -e` contra uma porta morta: as 3 tentativas imprimiram `<sem resposta>` e o loop sobreviveu. Importa porque o step do GitHub roda em `bash -e`: se o `curl` com erro abortasse o script, o passo morreria na primeira tentativa com outra mensagem, em vez de fazer o poll até o timeout.

  **O que não foi testado:** o serviço de produção genuinamente fora do ar. As duas provas cobrem os dois desfechos do parse (resposta sem o header; nenhuma resposta), que é o que o passo tem de distinguir — mas nenhuma delas derrubou a API real.
- [x] O acréscimo de tempo de cada gate está medido e registrado — o `services: postgres` é o único com custo real de startup. — Job `ci` de **1m50s** (`59b6f57`, sem Postgres) para **2m15s** (`130fc51`): **+25s**, sendo 22s de `Initialize containers` e 2s do `migrate diff`. Gates 2 e 3 não tocam o job `ci` e custam 0. Ver *Questão* #1 para a consequência.

### Já verificado no repo (não é critério de aceite, mas evita remedir)

Em 05/08/2026, com todas as mudanças aplicadas: `pnpm typecheck` verde nos 4 projetos, `pnpm test` com 142 testes em 16 arquivos passando, `pnpm docs:links` (gate completo, sem `--only-md`) com `Quebrados: 0`. No `130fc51` o status do Vercel é `success` — os builds vermelhos do Vercel naquele dia são previews dos PRs do Dependabot, não da `main`.

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
- **O `workflow_run` também trava — medido no `130fc51` (05/08/2026).** O risco estava anotado aqui como "corrida favorável, não medida". Não é favorável: **o check run do `workflow_run` conta para o `checksPass`**. Sequência do commit `130fc51` — CI verde às 17:18:31, smoke rodando de 17:19 a 17:29 com as 40 tentativas em `X-Commit=<sem resposta>` (o código no ar era o antigo, sem o header), vermelho por timeout, e a lista de deploys do Render **parada em `dep-d9p3igufulvc73arftn0`**, do commit anterior. O smoke esperava o deploy; o Render esperava o smoke. Produção ficou servindo o código do dia anterior até o conserto.
- **Por isso o smoke é `workflow_dispatch`, disparo manual.** Foi a opção escolhida sobre as outras duas: apagar o `smoke.yml` (mata o gate e deixa o header sem consumidor) e voltar atrás no `checksPass` da US-92 (desfaz a garantia de que commit vermelho não chega em produção — reabrir story fechada para salvar um gate novo é a troca errada). Manual destrava o deploy, preserva o header e o poll, e ainda responde à *Questão* #2. **Armadilha que fica:** rodar o smoke **antes** de o deploy aparecer como live recria o deadlock, porque o run manual também vira check do commit. Está escrito no cabeçalho do workflow.
- **Custo do gate 1, medido no `130fc51`:** job `ci` foi de 1m50s (`59b6f57`, sem Postgres) para 2m15s — **+25s**, dos quais 22s são o `Initialize containers` e 2s o `migrate diff` em si. Abaixo do gatilho de 30s da *Questão* #1, então o passo fica no job `ci` e não sai para um job `db` paralelo.
- **A `DATABASE_URL` fictícia de `ci.yml:16` continua fictícia.** O shadow é uma variável à parte; nada nesta story faz teste tocar banco.
- **Dependabot e o pnpm workspace:** o Dependabot lê `pnpm-lock.yaml`, mas a granularidade dos PRs em monorepo é irritante sem `groups:`. Agrupar por `dependency-type` desde o começo.

---

## Questões em aberto

1. ~~**O gate 1 justifica um serviço Postgres no job?**~~ **Respondida em 05/08/2026: sim, e o split não é necessário.** Medido no `130fc51`: +25s no job `ci` (22s de `Initialize containers`, 2s do `migrate diff`), contra um gatilho de saída de 30s. O `migrate diff` fica onde está. O texto original do gatilho segue abaixo porque a régua continua valendo se o tempo subir.

   É o único item desta story com custo de infraestrutura, e a US-80 tirou banco do runner de propósito.

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

   O `?? 'dev'` do snippet é o próprio experimento, e é por isso que implementar direto é seguro: se a var não existir em runtime, o header responde `X-Commit: dev`, nada quebra, e a resposta aparece no primeiro `curl -sI`.

   **Resultado do experimento, 05/08/2026: `RENDER_GIT_COMMIT` existe em runtime.** Com o `167862e` live, `https://ai-dm-api.onrender.com/api/v1/systems` responde `X-Commit: 167862e7f7ac7f5201e6401401e2a320b336a3ac` — o SHA exato do commit deployado, não o fallback `dev`. A documentação do Render estava certa, e o caminho que sobrou (deployar e olhar) custou menos que os três que não existiam.

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
