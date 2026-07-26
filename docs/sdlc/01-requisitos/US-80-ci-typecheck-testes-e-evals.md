# US-80 — CI: `typecheck`, testes e evals em todo push e PR

**Épico:** 5 — Qualidade e avaliação do DM Agent
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** nenhuma. Fatiada da [US-77](./US-77-reancorar-assertivas-de-prompt-e-guard-de-regressao.md) (era o "P1" dela), que passa a recomendar esta story como pré-requisito prático.
**Criada em:** 2026-07-26

---

## História

> **Como** mantenedor do AI DM,
> **quero** que `typecheck`, testes e evals rodem sozinhos em cada push e PR,
> **para que** uma quebra apareça no commit que a causou, e não semanas depois por acaso.

---

## Contexto e motivação

### O problema observado

**Não existe `.github/workflows/`.** Nada roda `pnpm test` nem `pnpm eval` automaticamente, apesar de o repo ter remote no GitHub e deploy contínuo a partir de `main` (Render para a API, Vercel para o web — [US-59](./US-59-api-em-producao-render.md) e [US-60](./US-60-web-em-producao-vercel.md)). Hoje o único gate entre um commit vermelho e produção é alguém lembrar de rodar os testes na própria máquina.

O custo já foi medido, na auditoria da [US-77](./US-77-reancorar-assertivas-de-prompt-e-guard-de-regressao.md):

- `e0a6817 "Atualizações prompt onomastica"` quebrou 2 assertivas de eval. Ficaram vermelhas desse commit até a [US-72](./US-72-evals-de-prompt-resistentes-a-reescrita.md) — **semanas**, sem ninguém saber.
- O mesmo commit reescreveu a seção de onomástica, em que outras 4 assertivas ancoram. Sobreviveu por sorte.

Como a US-77 resume: **a fragilidade custou pouco; a invisibilidade custou o tempo todo.**

### Por que é o item de maior valor

Nenhuma das defesas do repo — evals ancorados por intenção, guard de rubrica por hash, testes de unidade — vale nada se o vermelho não é visto. Detecção é o multiplicador: com CI, reancorar uma assertiva custa um minuto para quem acabou de reescrever o prompt e tem o contexto na cabeça. Sem CI, custa uma investigação arqueológica semanas depois.

Foi por isso que a US-77 colocou o CI como P1 e mandou fazê-lo primeiro. Esta story é esse P1, separado para poder ser entregue sem esperar as 19 reancoragens.

---

## Escopo

### Dentro do escopo

- `.github/workflows/ci.yml`, disparado em `push` e `pull_request`.
- Passos, nesta ordem:
  1. `actions/checkout`
  2. `pnpm/action-setup` com a versão **pinada** do `packageManager` (`pnpm@11.9.0`)
  3. `actions/setup-node` com **Node 22.23.0** (mesma do `render.yaml`) e cache do store do pnpm
  4. `pnpm install --frozen-lockfile`
  5. `prisma generate` do `apps/api` — o client é gerado em `apps/api/src/generated/` e é **gitignored**, então o `typecheck` da API não compila sem ele
  6. `pnpm build` dos pacotes (`pnpm --filter './packages/*' build`) — `evals/cases/*` importa `@ai-dm/ai-engine` do **`dist`**, não do `src`
  7. `pnpm typecheck`
  8. `pnpm test`
  9. `pnpm eval`
- `DATABASE_URL` fictícia no ambiente do job (ver *Notas*), o suficiente para o `prisma.config.ts` resolver.

### Fora do escopo

- **Bloquear merge ou deploy em vermelho.** O CI reporta; branch protection é decisão separada, e hoje o fluxo é commit direto em `main`. Ver *Questões em aberto*.
- **Secrets de provedor de LLM.** Os evals que chamam modelo de verdade já são `skip` por design ([US-36](./US-36-eval-de-qualidade-da-narracao.md)). O job roda sem nenhuma chave; se algum eval **exigir** chave para passar, isso é bug do eval, não do CI — reportar, não contornar com secret.
- **Banco de dados de verdade no runner.** Se algum teste do `apps/api` precisar de Postgres para passar, ele sai desta story como achado (ver *Questões em aberto* #2), não vira um serviço no workflow.
- **As reancoragens de assertiva e o `PROMPT-ANCHORS.md`** — são a [US-77](./US-77-reancorar-assertivas-de-prompt-e-guard-de-regressao.md).
- **O `--check` de links da [US-79](./US-79-consertar-links-quebrados-na-documentacao.md).** Vira um passo a mais quando aquela story existir; não se antecipa aqui.
- Matriz de sistemas operacionais ou de versões de Node. Um runner `ubuntu-latest`, uma versão.

---

## Critérios de aceite

- [ ] Existe `.github/workflows/ci.yml` disparando em `push` e `pull_request`.
- [ ] A execução na `main` fica **verde**, com `typecheck`, `test` e `eval` todos executados (nenhum pulado por falha silenciosa de passo anterior).
- [ ] O job roda **sem nenhum secret configurado**.
- [ ] **Teste de regressão (o CI de fato pega quebra):** num branch descartável, remover uma linha de contrato do `dm-system.ts` que uma assertiva de eval cobre. O job fica **vermelho** e a saída nomeia a assertiva. Descartar o branch.
- [ ] **Teste de regressão (ordem de build):** confirmar que o `pnpm eval` do job usa o `dist` recém-buildado — apagar `packages/ai-engine/dist` localmente e rodar a mesma sequência do workflow reproduz verde.
- [ ] Nenhum código de produção alterado; o diff é o workflow (e, se preciso, ajuste de script no `package.json`).
- [ ] O tempo total do job está registrado na descrição do PR — é a linha de base para decidir sobre cache mais tarde.

---

## Notas de implementação

- **pnpm:** `packageManager: "pnpm@11.9.0"` no `package.json` da raiz. Usar essa versão no `pnpm/action-setup` em vez de `latest`, senão o lockfile pode ser rejeitado por `--frozen-lockfile`.
- **Node:** `render.yaml` fixa `NODE_VERSION: "22.23.0"` com o comentário *"casa com o node local"*. Usar a mesma. Não há `.nvmrc` no repo — se esta story adicionar um, ele passa a ser a fonte única e o `render.yaml` deve apontar para ele.
- **Prisma:** `apps/api/prisma.config.ts` faz `url: env('DATABASE_URL')` no carregamento do config. Definir uma `DATABASE_URL` fictícia (`postgresql://ci:ci@localhost:5432/ci`) no `env:` do job — `prisma generate` não conecta ao banco, mas o config precisa resolver a variável. Confirmar na primeira execução; se `generate` reclamar de outra coisa, é achado para a Questão #2.
- **Ordem build → eval é obrigatória.** `pnpm eval` roda `vitest --config vitest.eval.config.ts` no `ai-engine`, e os cases importam o pacote pelo `dist`. Sem build antes, o eval testa um `dist` velho (falso verde) ou inexistente (falha confusa). `pnpm --filter './packages/*' build` basta; não é preciso buildar os apps.
- **Cache:** `actions/setup-node` com `cache: 'pnpm'` corta a maior parte do `install`. Ligar desde o começo, mas medir o tempo do job sem otimizar mais que isso — otimização de CI antes de haver dor é o tipo de trabalho que a US-31 e a US-72 já evitaram por princípio.
- **Falha barulhenta.** Encadear os passos como passos separados do workflow (não `&&` numa linha só), para que a aba de checks mostre **qual** etapa caiu sem precisar abrir o log.

---

## Alternativas consideradas e rejeitadas

1. **Hook `pre-push` local em vez de CI.** Rejeitada como substituto (já registrada na US-77): depende de configuração por máquina e é pulável com `--no-verify`. Cabe como reforço opcional, nunca como o guard.
2. **Rodar só `test`, deixando `eval` de fora por ser lento.** Rejeitada: as duas quebras documentadas foram **de eval**. Tirar o eval do CI é remover exatamente o sinal que motivou a story.
3. **Rodar o CI só em `pull_request`.** Rejeitada enquanto o fluxo for commit direto em `main` — nesse regime, `pull_request` sozinho nunca dispara.

---

## Questões em aberto

1. **O CI bloqueia merge?** Fora do escopo aqui, mas precisa de resposta quando o fluxo deixar de ser commit direto em `main`. (Herdada da US-77, questão 3.)
2. **`pnpm test` do `apps/api` passa num runner limpo, sem banco?** A US-77 levantou a dúvida e ninguém verificou. Se algum teste exigir Postgres, o achado sai desta story — a decisão (mockar, marcar `skip`, ou subir um serviço) é de outra.
3. **O `--check` de links da US-79 e o check do vault da US-78 entram aqui depois?** As duas stories têm essa pergunta em aberto apontando para o CI. Com o workflow existindo, a resposta natural é "sim, um passo a mais" — mas quem decide é a story que traz o script.

---

## Referências no código

- **Ausência de `.github/workflows/`** — a lacuna que esta story fecha.
- `package.json` (raiz) — `packageManager: pnpm@11.9.0`; scripts `typecheck`, `test`, `eval`, `build`.
- `packages/ai-engine/package.json` — `eval: vitest run --config vitest.eval.config.ts`.
- `apps/api/package.json` — `typecheck: tsc --noEmit`, que depende do client Prisma gerado.
- `apps/api/prisma.config.ts` — `url: env('DATABASE_URL')`, motivo da variável fictícia no job.
- `render.yaml` — `NODE_VERSION: "22.23.0"`, a versão que o job deve espelhar.
- `.gitignore` — `apps/api/src/generated/`, o client Prisma que obriga o `prisma generate` no CI.
