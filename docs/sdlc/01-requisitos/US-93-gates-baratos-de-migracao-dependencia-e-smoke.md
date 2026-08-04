# US-93 — Três gates baratos: drift de migração, dependência vulnerável e smoke pós-deploy

**Épico:** 5 — Ferramentas de projeto / SDLC
**Fase:** 1 — MVP single-player
**Status:** 🚧 Em progresso
**Depende de:** [US-80](./US-80-ci-typecheck-testes-e-evals.md) (o workflow). O smoke depende também da [US-92](./US-92-deploy-espera-o-ci-verde.md), que cria o job `deploy` onde ele mora.
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

Não é tema comum — é **custo comum**. As três são de poucas linhas, nenhuma exige código de produção e nenhuma sozinha justifica o overhead de uma story. Se qualquer uma delas crescer (ver *Questões em aberto* #1), ela sai desta e vira story própria.

---

## Escopo

### Dentro do escopo

**Gate 1 — drift de migração.** Passo novo no job `ci`, depois do `prisma generate`:

```
prisma migrate diff \
  --from-migrations apps/api/prisma/migrations \
  --to-schema-datamodel apps/api/prisma/schema.prisma \
  --shadow-database-url "$SHADOW_DATABASE_URL" \
  --exit-code
```

Exit 2 = há diferença = schema editado sem migração. **Isto exige um Postgres de verdade**: `--from-migrations` replica as migrações num shadow database para comparar. Entra como `services:` do job (imagem oficial `postgres`), que roda no runner e não custa nada — é o oposto de "banco de teste em produção".

**Gate 2 — dependências.** `.github/dependabot.yml` com dois ecossistemas:
- `npm` na raiz (o pnpm workspace é lido pelo Dependabot como npm), semanal, PRs agrupados;
- `github-actions`, semanal — as actions do workflow também envelhecem.

**Gate 3 — smoke pós-deploy.** Passo no fim do job `deploy` da US-92: poll no `/api/v1/systems` público até `200`, com timeout, falhando o job se estourar.

### Fora do escopo

- **`pnpm audit` como passo que reprova.** Audit em monorepo com transitivas costuma nascer vermelho e treinar a pessoa a ignorar vermelho — a mesma razão pela qual a US-80 entrou com `docs:links --only-md`. O Dependabot abre PR, que é sinal acionável; audit bloqueante entra depois, se a fila de PR mostrar que vale.
- **Auto-merge dos PRs do Dependabot.** Precisa de branch protection e de CI que morda, nenhum dos dois existe. Fica manual.
- **Usar o Postgres do gate 1 para rodar teste de verdade.** É a [US-95](./US-95-camada-de-integracao-com-banco-efemero.md), que herda este `services:` em vez de criar outro.
- **Monitoramento contínuo em produção** (uptime, alerta). Smoke é uma pergunta única depois do deploy, não observabilidade.

---

## Critérios de aceite

- [ ] O job `ci` tem um serviço Postgres e um passo de `migrate diff` que sai 0 na `main` de hoje.
- [ ] **Teste de regressão (gate 1 morde):** adicionar um campo em `schema.prisma` **sem** criar migração deixa o passo vermelho, nomeando a diferença. Campo removido depois (`git diff` limpo), com a saída colada aqui.
- [ ] Existe `.github/dependabot.yml` com `npm` e `github-actions`, e o painel *Insights → Dependency graph → Dependabot* mostra os dois ecossistemas ativos.
- [ ] O job `deploy` só fica verde depois de o `/api/v1/systems` de produção responder `200`.
- [ ] **Teste de regressão (gate 3 morde):** com o serviço do Render suspenso à mão, o passo de smoke fica vermelho por timeout em vez de verde por omissão.
- [ ] O acréscimo de tempo de cada gate está medido e registrado — o `services: postgres` é o único com custo real de startup.

---

## Notas de implementação

- **O Render Free dorme.** O serviço hiberna por inatividade e o primeiro request paga cold start; a [US-57](./US-57-warmup-do-servidor-na-entrada.md) existe por causa disso. O smoke tem que ser **poll com retry** (ex.: `curl --fail --retry 10 --retry-all-errors --retry-delay 15 --max-time 30`), nunca um `curl` único: um `curl` seco vai falhar por cold start e ensinar que o passo é flaky.
- **Deploy é assíncrono.** O Deploy Hook da US-92 responde na hora; o build do Render leva minutos. O smoke precisa esperar o *novo* deploy, não responder 200 do processo **antigo** que ainda está no ar. Sem consultar a API do Render, a forma barata é fazer o endpoint devolver algo que identifique a versão (ver *Questões em aberto* #2). Enquanto isso não existir, o smoke prova "há uma API viva", não "a API nova está viva" — escrever isso no comentário do passo, para o gate não prometer mais do que entrega.
- **`SHADOW_DATABASE_URL` não é secret:** aponta para o serviço do próprio runner (`postgresql://postgres:postgres@localhost:5432/shadow`). O job `ci` continua sem secret, como a US-80 exige.
- **A `DATABASE_URL` fictícia de `ci.yml:16` continua fictícia.** O shadow é uma variável à parte; nada nesta story faz teste tocar banco.
- **Dependabot e o pnpm workspace:** o Dependabot lê `pnpm-lock.yaml`, mas a granularidade dos PRs em monorepo é irritante sem `groups:`. Agrupar por `dependency-type` desde o começo.

---

## Questões em aberto

1. **O gate 1 justifica um serviço Postgres no job?** É o único item desta story com custo de infraestrutura, e a US-80 tirou banco do runner de propósito. Se o startup do container pesar no tempo do job, a alternativa é mover o `migrate diff` para um job paralelo (`needs: []`), que roda ao lado e não atrasa o caminho crítico. Medir antes de otimizar.
2. **Vale expor a versão/SHA no `/api/v1/systems` (ou num `/health` novo) para o smoke distinguir o deploy novo do velho?** É código de produção, o que esta story evitou de propósito. Se a resposta for sim, sai daqui como story irmã.
3. **Existe migração pendente hoje?** A resposta ao rodar o gate 1 pela primeira vez decide se ele nasce verde (liga direto) ou vermelho (então a dívida vira story própria antes de ligar, mesmo precedente da US-82 esperando a US-81).

---

## Referências no código

- `apps/api/prisma/schema.prisma` e `apps/api/prisma/migrations/` — os dois lados que o gate 1 compara.
- `.github/workflows/ci.yml` (`:44-45`) — o `prisma generate`, que lê só o schema e por isso não detecta drift.
- `render.yaml` (`buildCommand`) — o `prisma migrate deploy`, hoje o primeiro lugar onde o drift aparece; e `healthCheckPath: /api/v1/systems`, o endpoint que o smoke reusa.
- **Ausência de `.github/dependabot.yml`** — a lacuna do gate 2.
