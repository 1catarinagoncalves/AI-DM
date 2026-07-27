# US-80 — CI: `typecheck`, testes e evals em todo push e PR

**Épico:** 5 — Qualidade e avaliação do DM Agent
**Fase:** 1 — MVP single-player
**Status:** 🚧 Em progresso
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
  10. `pnpm docs:links --only-md` — gate de links `.md` e de nome de arquivo ([US-78](./US-78-vault-obsidian-para-os-docs.md) e [US-82](./US-82-gate-de-convencao-de-nomes-de-arquivo-nos-docs.md)). Node puro, sem deps, roda em segundos. Por que `--only-md` e não o gate completo: *Questões em aberto* #3.
- `DATABASE_URL` fictícia no ambiente do job (ver *Notas*), o suficiente para o `prisma.config.ts` resolver.

### Fora do escopo

- **Bloquear merge ou deploy em vermelho.** O CI reporta; branch protection é decisão separada, e hoje o fluxo é commit direto em `main`. Ver *Questões em aberto*.
- **Secrets de provedor de LLM.** Os evals que chamam modelo de verdade já são `skip` por design ([US-36](./US-36-eval-de-qualidade-da-narracao.md)). O job roda sem nenhuma chave; se algum eval **exigir** chave para passar, isso é bug do eval, não do CI — reportar, não contornar com secret.
- **Banco de dados de verdade no runner.** Se algum teste do `apps/api` precisar de Postgres para passar, ele sai desta story como achado (ver *Questões em aberto* #2), não vira um serviço no workflow.
- **As reancoragens de assertiva e o `PROMPT-ANCHORS.md`** — são a [US-77](./US-77-reancorar-assertivas-de-prompt-e-guard-de-regressao.md).
- **O gate completo de links** (`pnpm docs:links` sem flag). Hoje sai vermelho por 85 quebrados que são da [US-79](./US-79-consertar-links-quebrados-na-documentacao.md). O job roda a variante `--only-md`, que já passa; a troca para o gate completo é critério de aceite daquela story. Ver *Questões em aberto* #3.
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

1. ~~**O CI bloqueia merge?**~~ **Respondida em 2026-07-27: não, e não há o que trancar.** (Herdada da US-77, questão 3.)

   Branch protection com *required status checks* age sobre o botão de merge de um **pull request**. O histórico do repo não tem nenhum: 82 commits, um único autor, zero merge commits, e a única branch de trabalho é `main` (há uma `vercel/install-and-configure-vercel-*` órfã no remote, criada pela integração da [US-60](./US-60-web-em-producao-vercel.md) e nunca mergeada). Sem PR, a regra não teria efeito algum.

   Para ela **ter** efeito no fluxo atual seria preciso ligar também *restrict pushes*, que proíbe `git push` direto em `main` — ou seja, obrigaria branch + PR + espera de CI a cada mudança. Isso é mudança de processo de trabalho, não de CI, e num repo de uma pessoa só é cerimônia sem contraparte: o e-mail de falha do GitHub já chega a quem pode consertar, porque é a mesma pessoa que empurrou. Bloqueio de merge resolve coordenação (impedir que alguém mergeie por cima do vermelho de outra pessoa); esse problema ainda não existe aqui.

   Há também um risco de ordem: ligar a tranca antes de a `main` ter uma execução verde comprovada (critério de aceite #2) tranca a mantenedora fora do próprio repo no primeiro falso vermelho.

   **Gatilho para reabrir** — qualquer um destes:
   - um segundo committer no repo;
   - o fluxo passar a usar PR por outro motivo;
   - um commit vermelho chegar em produção (`main` faz deploy contínuo para Render e Vercel) e custar rollback.

   Até lá, o CI **reporta e não bloqueia**, como já registrado em *Fora do escopo*.
2. **`pnpm test` do `apps/api` passa num runner limpo, sem banco?** A US-77 levantou a dúvida e ninguém verificou. Se algum teste exigir Postgres, o achado sai desta story — a decisão (mockar, marcar `skip`, ou subir um serviço) é de outra.
3. ~~**O `--check` de links da US-79 e o check do vault da US-78 entram aqui depois?**~~ **Respondida em 2026-07-27: sim, um passo — mas `--only-md`, e a decisão é desta story.**

   A pergunta foi escrita com três premissas erradas, todas corrigidas aqui:

   - **Não são dois checks, é um.** `scripts/check-doc-links.mjs` foi entregue pela [US-78](./US-78-vault-obsidian-para-os-docs.md) (commit `720c452`), que o construiu porque dois critérios de aceite dependiam da varredura — o dela e o da [US-79](./US-79-consertar-links-quebrados-na-documentacao.md). Um script, uma entrada `pnpm docs:links`, com os quebrados separados por dona na própria saída.
   - **Não existe flag `--check`.** As flags reais são `--list`, `--naive` e `--only-md`; o gate é o comportamento padrão (`process.exit(1)`, `check-doc-links.mjs:215`). `--check` era a redação da *proposta* da US-79, que segue planejada — o nome nunca chegou ao código.
   - **Falta a [US-82](./US-82-gate-de-convencao-de-nomes-de-arquivo-nos-docs.md)** (✅ implementada, criada depois desta). Ela pôs o gate de nome de arquivo **no mesmo script**, explicitamente para não duplicar este passo de CI. Um passo cobre links e nomes.

   **"Quem decide é a story que traz o script"** já apontou de volta para cá: a US-78 fechou a própria questão gêmea com *"ligar no workflow é da US-80; nada a decidir aqui"* (US-78, Questões em aberto #3). Não há terceira story a esperar.

   **Qual modo entra.** Medido em 27/07/2026, na `main` com a US-82 aplicada:

   ```
   node scripts/check-doc-links.mjs              → exit 1   (85 quebrados, todos da US-79)
   node scripts/check-doc-links.mjs --only-md    → exit 0
   ```

   Entra `pnpm docs:links --only-md`. O gate completo nasceria vermelho, e passo de CI que nasce vermelho treina a pessoa a ignorar o vermelho — mesmo raciocínio com que a US-82 esperou a US-81 antes de ligar o gate de nomes. Como o script já classifica os quebrados por dona, `--only-md` é exatamente "tudo que já foi consertado": vale como trava contra regressão sem cobrar dívida que outra story tem.

   **Troca para o gate completo** (`pnpm docs:links`, sem flag) quando a US-79 fechar — é critério de aceite dela, não desta.

---

## Referências no código

- **Ausência de `.github/workflows/`** — a lacuna que esta story fecha.
- `package.json` (raiz) — `packageManager: pnpm@11.9.0`; scripts `typecheck`, `test`, `eval`, `build`.
- `packages/ai-engine/package.json` — `eval: vitest run --config vitest.eval.config.ts`.
- `apps/api/package.json` — `typecheck: tsc --noEmit`, que depende do client Prisma gerado.
- `apps/api/prisma.config.ts` — `url: env('DATABASE_URL')`, motivo da variável fictícia no job.
- `render.yaml` — `NODE_VERSION: "22.23.0"`, a versão que o job deve espelhar.
- `.gitignore` — `apps/api/src/generated/`, o client Prisma que obriga o `prisma generate` no CI.
