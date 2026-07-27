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
  6. `pnpm build` dos pacotes (`pnpm --filter './packages/*' build`) — o `typecheck` do `apps/api` resolve `@ai-dm/shared` e `@ai-dm/ai-engine` pelos `types` do **`dist`** (ver *Notas*; o eval **não** depende disto)
  7. `pnpm typecheck` — `apps/api` + `apps/web` (o script do `web` nasceu aqui; ver *Questões em aberto* #4)
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

- [x] Existe `.github/workflows/ci.yml` disparando em `push` e `pull_request`.
- [ ] A execução na `main` fica **verde**, com `typecheck`, `test` e `eval` todos executados (nenhum pulado por falha silenciosa de passo anterior). — *só a primeira execução no runner fecha; a sequência inteira do workflow roda verde local (ver abaixo).*
- [ ] O job roda **sem nenhum secret configurado**. — *o workflow não referencia `secrets.*`; confirmação empírica é a mesma primeira execução.*
- [x] **Teste de regressão (o CI de fato pega quebra):** feito em 27/07/2026, sobre a linha 197 do `dm-system.ts` (`## Character identity (read-only …`). `pnpm eval` fica **vermelho** e nomeia as assertivas:

  ```
  FAIL evals/cases/us-39-identidade-narrativa.ts > a seção é marcada read-only / roleplay …
  FAIL evals/cases/us-40-divindade.ts           > a divindade convive com os demais eixos …
  AssertionError: expected 'you are the dungeon master for a role…'
                  to match /character identity \(read-only/
  Tests  2 failed | 50 passed | 2 skipped
  ```

  Arquivo restaurado (`git diff` limpo). Rodado local em vez de branch descartável — o sinal testado é o do passo `pnpm eval`, que é idêntico nos dois lugares.
- [x] **Teste de regressão (ordem de build):** apagados `packages/ai-engine/dist` e `packages/shared/dist`, rodada a sequência do workflow: verde. Ela também **desmentiu a premissa** de que o eval lê o `dist` — quem quebra sem build é o `typecheck`. Detalhe e medição nas *Notas*.
- [x] Nenhum código de produção alterado; o diff é `.github/workflows/ci.yml`, uma linha de script em `apps/web/package.json` (o "ajuste de script" que este critério já previa, ver *Questões em aberto* #4) e este documento.
- [ ] O tempo total do job está registrado na descrição do PR — é a linha de base para decidir sobre cache mais tarde. **Linha de base local** (Windows, dependências já instaladas, 27/07/2026): `build` pacotes ~6 s · `typecheck` 8 s (2 projetos) · `test` 11 s · `eval` 3 s · `docs:links --only-md` 1 s ≈ **29 s** sem `install` nem `prisma generate`.

---

## Notas de implementação

- **pnpm:** `packageManager: "pnpm@11.9.0"` no `package.json` da raiz. Usar essa versão no `pnpm/action-setup` em vez de `latest`, senão o lockfile pode ser rejeitado por `--frozen-lockfile`.
- **Node:** `render.yaml` fixa `NODE_VERSION: "22.23.0"` com o comentário *"casa com o node local"*. Usar a mesma. Não há `.nvmrc` no repo — se esta story adicionar um, ele passa a ser a fonte única e o `render.yaml` deve apontar para ele.
- **Prisma:** `apps/api/prisma.config.ts` faz `url: env('DATABASE_URL')` no carregamento do config. Definir uma `DATABASE_URL` fictícia (`postgresql://ci:ci@localhost:5432/ci`) no `env:` do job — `prisma generate` não conecta ao banco, mas o config precisa resolver a variável. Confirmar na primeira execução; se `generate` reclamar de outra coisa, é achado para a Questão #2.
- **Ordem build → `typecheck` é obrigatória — mas não pelo motivo que esta story previa.** A premissa original ("os eval cases importam o pacote pelo `dist`") está **errada**: `packages/ai-engine/vitest.eval.config.ts` faz `resolve.alias` de `@ai-dm/ai-engine` e `@ai-dm/shared` para o **`src`**, e o próprio comentário do arquivo diz *"testa o source atual, sem depender de um build prévio"*. Medido em 27/07/2026, com `packages/*/dist` apagados:

  ```
  pnpm eval       → 52 passed, 2 skipped, exit 0   (não precisa de dist)
  pnpm typecheck  → exit 2: TS2307 "Cannot find module '@ai-dm/shared'
                    or its corresponding type declarations" (+ cascata de TS7006)
  ```

  Quem precisa do build é o `apps/api`: `package.json` dos dois pacotes aponta `types` para `dist/index.d.ts`, então sem build o `tsc --noEmit` não acha os tipos e a cascata de `implicitly has an 'any' type` esconde o erro real. `pnpm --filter './packages/*' build` basta; não é preciso buildar os apps. **Consequência para o CI:** o passo de build continua obrigatório e continua vindo antes — só o comentário do workflow mudou de dono. E não existe o risco de "falso verde por `dist` velho" no eval: ele lê sempre o `src`.
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
2. ~~**`pnpm test` do `apps/api` passa num runner limpo, sem banco?**~~ **Respondida em 2026-07-27: passa. Nenhum teste do repo toca banco ou provedor.**

   Medido rodando `pnpm test` com `DATABASE_URL`, `AUTH_SECRET` e todas as chaves de LLM **removidas do ambiente**:

   | projeto | arquivos | testes |
   |---|---:|---:|
   | `apps/api` | 10 | 82 |
   | `packages/shared` | 5 | 56 |
   | `packages/ai-engine` | 5 (+2 `skip`) | 77 (+2 `skip`) |
   | `apps/web` | 5 | 38 |
   | **total** | | **253 verdes, 2 `skip`, exit 0** |

   **Por que passa por construção, não por sorte.** Os 4 arquivos de teste da API que mencionam Prisma (`adventure`, `ai`, `auth`, `character` `.service.test.ts`) usam `import type { PrismaService }` — importação **de tipo**, apagada na transpilação — e montam um test double com `as unknown as PrismaService`. Como nenhum import de valor alcança `prisma.service.ts`, o client real nunca é instanciado: zero `new PrismaClient`, zero `$connect`, zero testcontainers.

   Isso é uma disciplina, não uma garantia do compilador: trocar um desses por `import` normal do mesmo símbolo põe o módulo real no grafo, constrói o `PrismaClient` no load e passa a exigir `DATABASE_URL` — sem teste novo e sem o `pnpm typecheck` reclamar, porque ele aceita as duas formas. Se um dia este passo do CI ficar vermelho pedindo banco, **este parágrafo é o primeiro lugar a olhar.**

   Os 2 `skip` são `bench-ttft.test.ts` e `narrative-bakeoff.test.ts` (ai-engine), pulados por design da [US-36](./US-36-eval-de-qualidade-da-narracao.md) — confirma na prática o *Fora do escopo* sobre secrets de provedor.

   **Consequência:** não há achado a repassar. A decisão que a questão previa ("mockar, marcar `skip`, ou subir um serviço") fica sem objeto, e o *Fora do escopo* sobre banco no runner deixa de ser só recorte: é desnecessário de fato.

   **O que a medição não cobre:** rodou em Windows, não num runner Ubuntu limpo. Resta a case-sensitivity de import (`from './Foo'` para `foo.ts` resolve aqui e quebra lá) — só a primeira execução do job resolve. A versão de Node já bate: `node -v` local é `v22.23.0`, a mesma de `render.yaml:35`. O `prisma generate` (passo 5) continua obrigatório, mas pelo `typecheck`, não pelos testes.
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
4. ~~**`pnpm typecheck` cobre um projeto só — `apps/web` não é typecheckado por ninguém no CI.**~~ **Achado de 27/07/2026, não previsto pela story. Fechado no mesmo dia.**

   `pnpm typecheck` é `pnpm --recursive typecheck`, e **só o `apps/api` tinha esse script** — a saída dizia `Scope: 4 of 5 workspace projects` e rodava um `tsc` apenas. Os pacotes escapam por acidente feliz: `pnpm --filter './packages/*' build` é literalmente `tsc`, então erro de tipo em `shared` ou `ai-engine` derruba o passo de build. **`apps/web` não tinha nem uma coisa nem outra** — nenhum `typecheck`, e o `next build` não está no job (a story recorta os apps do passo de build). O único gate era o `next build` da Vercel a cada push ([US-60](./US-60-web-em-producao-vercel.md)): sinal que chega pelo painel da Vercel, não pela aba de checks — a mesma invisibilidade que motivou esta story, uma casa adiante.

   **Fechado com uma linha:** `"typecheck": "tsc --noEmit -p tsconfig.json"` no `apps/web/package.json`, idêntico ao do `apps/api`. O `--recursive` da raiz passa a pegá-lo sozinho — **o workflow não mudou**. Agora `Scope: 4 of 5` roda dois `tsc`; o passo subiu de 4 s para 8 s.

   **O receio do `tsc` puro em Next não se confirmou.** Medido antes de escrever a linha:

   - `next-env.d.ts` **não** está no `include` do `apps/web/tsconfig.json` (`src`, `next.config.ts`, `.next/types/**/*.ts`) e o `tsc --noEmit` passa mesmo assim — nada no `src` depende dos globais que ele traz.
   - O runner não tem `.next/`, então o glob `.next/types/**/*.ts` casa zero arquivos. Rodado com o glob removido de propósito (tsconfig temporário, `include` só `src` + `next.config.ts`): **exit 0**. Não há `typedRoutes` no `next.config.ts` — só `transpilePackages: ['@ai-dm/shared']` — que é o que faria o `.next/types` ausente virar erro em vez de simplesmente checar menos.

   **Prova de que o passo morde** (mesmo protocolo do critério de regressão): `const ciSmokeTest: number = "quebra proposital"` no fim de `apps/web/src/lib/api.ts` →

   ```
   src/lib/api.ts(69,7): error TS2322: Type 'string' is not assignable to type 'number'.
   ELIFECYCLE  web@0.0.1 typecheck: Exit status 2
   ```

   Arquivo restaurado (`git diff` limpo).

   **O que continua descoberto:** o `tsc` do `apps/web` no CI checa menos que o local, porque sem `.next/types` as rotas geradas não entram. Erro que só o `next build` pega continua chegando pela Vercel. Fechar isso é pôr `next build` no job — outro custo, outra decisão, sem dor medida que a justifique.

---

## Referências no código

- **Ausência de `.github/workflows/`** — a lacuna que esta story fecha.
- `package.json` (raiz) — `packageManager: pnpm@11.9.0`; scripts `typecheck`, `test`, `eval`, `build`.
- `packages/ai-engine/package.json` — `eval: vitest run --config vitest.eval.config.ts`.
- `apps/api/package.json` — `typecheck: tsc --noEmit`, que depende do client Prisma gerado.
- `apps/api/prisma.config.ts` — `url: env('DATABASE_URL')`, motivo da variável fictícia no job.
- `render.yaml` — `NODE_VERSION: "22.23.0"`, a versão que o job deve espelhar.
- `.gitignore` — `apps/api/src/generated/`, o client Prisma que obriga o `prisma generate` no CI.
