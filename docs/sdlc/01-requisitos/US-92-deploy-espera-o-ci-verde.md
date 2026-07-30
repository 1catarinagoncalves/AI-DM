# US-92 — O deploy espera o CI ficar verde

**Épico:** Deploy e operação (custo zero) — [ADR 006](../../adr/006-deploy-custo-zero.md)
**Fase:** 1 — MVP single-player
**Status:** 🚧 Em progresso
**Depende de:** [US-80](./US-80-ci-typecheck-testes-e-evals.md) (o CI que esta story passa a usar como pré-condição). Fecha o buraco que a *Questão em aberto* #1 da US-80 **não** cobriu.
**Criada em:** 2026-07-30

---

## História

> **Como** mantenedora do AI DM,
> **quero** que um push na `main` só chegue a produção depois dos gates do CI passarem,
> **para que** o vermelho seja visto **antes** de o usuário ver, e não junto com ele.

---

## Contexto e motivação

### O problema observado

`render.yaml:11` tem `autoDeploy: true` na branch `main`. `.github/workflows/ci.yml:6` tem `on: [push, pull_request]`. As duas coisas escutam **o mesmo evento** e **não se conhecem**.

Consequência: um push na `main` dispara CI e deploy **em paralelo**. Quando o passo `pnpm eval` fica vermelho, o build do Render já rodou `pnpm build` e `prisma migrate deploy` (`render.yaml`, `buildCommand`) e o processo já está no ar. O check vermelho não é um gate — é uma nota de rodapé sobre uma coisa que já aconteceu.

Isto **não** é o que a *Questão em aberto* #1 da [US-80](./US-80-ci-typecheck-testes-e-evals.md) respondeu. Aquela análise é sobre *branch protection* — trancar o botão de merge de um PR — e a conclusão dela continua correta: com 108 commits, um único autor e zero merge commits (medido em 30/07/2026: `git log --merges` devolve vazio), não há botão de merge a trancar, e *restrict pushes* seria cerimônia. Mas ela fechou com "*o e-mail de falha do GitHub já chega a quem pode consertar*", e essa frase supõe que o estrago ainda não foi feito quando o e-mail chega. Com `autoDeploy: true`, foi.

O terceiro gatilho de reabertura que a US-80 listou era "*um commit vermelho chegar em produção e custar rollback*". **Já disparou — duas vezes, em 29/07/2026** (medido em 30/07/2026 cruzando a Checks API do GitHub com a lista de deploys do Render):

| commit | check `ci` | deploy no Render | trigger |
|---|---|---|---|
| `c0a1b17` | `failure` | `dep-d9l5l8942hec73fvboe0` → `deactivated` | `new_commit` |
| `2f487a8` | `failure` (3 runs) | `dep-d9l5hbdckfvc73e3i7qg` → `deactivated` | `new_commit` |

`deactivated` significa que o deploy **esteve live** e só saiu quando o seguinte entrou. Os dois commits vermelhos serviram tráfego. Não é risco projetado, é histórico.

### Por que a solução atual não basta

Não há solução atual. Não existe ordenação nenhuma entre os dois eventos: o CI não conhece o Render, o Render não conhece o CI, e `healthCheckPath: /api/v1/systems` só garante que o processo **subiu**, não que o código está correto — um `pnpm eval` reprovado sobe e responde 200 igual.

### A proposta

Inverter a direção do controle: o Render para de escutar o commit e passa a escutar os checks do commit. Isso é uma opção nativa da plataforma, `autoDeployTrigger: checksPass` — **não** precisa de job de deploy, secret nem webhook.

O `render.yaml` hoje usa `autoDeploy: true`, que o [Blueprint spec](https://render.com/docs/blueprint-spec) marca como **deprecado**: *"replaces the deprecated `autoDeploy` field. If you include both, this field takes precedence."* Os três valores de `autoDeployTrigger`:

| valor | comportamento | equivale a |
|---|---|---|
| `commit` | deploy a cada commit na branch | `autoDeploy: true` (o de hoje) |
| `checksPass` | deploy só se os CI checks do commit passarem | — |
| `off` | sem auto-deploy | `autoDeploy: false` |

Estado confirmado no painel em 30/07/2026 (API do Render, serviço `srv-d9f50kjrjlhs73dimceg`): `plan: free`, `autoDeploy: "yes"`, `autoDeployTrigger: "commit"`, `branch: main`, repo GitHub. O plano Free não restringe o campo — a página *Platform features by plan* não lista auto-deploy nem deploy hooks entre os recursos pagos.

Fontes de check que o Render lê no GitHub: *"GitHub Actions"* e *"Tools that integrate with the GitHub checks API"*. O `ci.yml` é GitHub Actions, então conta. Um check é considerado passado com conclusão `success`, `neutral` ou `skipped`; o Render **não** deploya se algum check falhar **ou se zero checks forem detectados**.

---

## Escopo

### Dentro do escopo

- `render.yaml`: trocar `autoDeploy: true` por `autoDeployTrigger: checksPass`, com o comentário explicando que o gate agora é o `ci.yml`.
- Nada mais. Sem job novo, sem secret, sem `curl`. O `ci.yml` não muda uma linha e continua **sem nenhum secret**, como manda o critério de aceite #3 da US-80.

**O que esta versão da story descartou** (desenho anterior, guardado porque a alternativa volta se o `checksPass` decepcionar): job `deploy` com `needs: ci` + guarda de `push` na `main`, disparando o Deploy Hook do Render por `curl --fail` com a URL em `secrets.RENDER_DEPLOY_HOOK_URL`. Custava um secret, um job e duas questões em aberto (ordem entre runs concorrentes e qual commit o hook constrói — o hook aceita `?ref=<sha>`, mas o default não está documentado). O `checksPass` entrega a mesma garantia sem nenhum dos dois.

### Fora do escopo

- **Branch protection / required status checks.** Continua respondida como "não" pela US-80 (*Questão em aberto* #1) e pelo mesmo motivo: sem PR, não há o que trancar. Esta story resolve a **ordenação do deploy**, que é um problema diferente e não precisa de PR nenhum para ser resolvido. Se um dia o fluxo virar PR, a tranca entra por outra story.
- **Rollback automatizado.** Deploy parado antes de sair é mais barato que deploy desfeito depois. Rollback manual pelo painel do Render continua sendo o plano B.
- **Smoke test pós-deploy.** É a [US-93](./US-93-gates-baratos-de-migracao-dependencia-e-smoke.md).
- **Espelhar isso na Vercel.** Respondido como "não" — ver *Questões em aberto* #1.

---

## Critérios de aceite

- [ ] `render.yaml` tem `autoDeployTrigger: checksPass` e **não** tem mais `autoDeploy` (o campo deprecado sai junto; manter os dois só convida à divergência).
- [ ] O painel do Render mostra `autoDeployTrigger: checksPass` depois do sync do Blueprint — confirmar que o sync pegou, não só que o arquivo mudou.
- [ ] **Teste de regressão (o gate morde):** um commit propositalmente vermelho na `main` (mesmo protocolo da US-80: quebrar uma assertiva de `dm-system.ts`, medir, restaurar) **não** dispara deploy nenhum no Render. Registrar o `list_deploys` mostrando que o último deploy continua sendo o do commit anterior.
- [ ] **Teste do caminho feliz:** um commit verde na `main` dispara exatamente **um** deploy, e o `createdAt` desse deploy é posterior ao fim do check `ci`.
- [ ] **Nenhum secret novo** no repo. Este critério substitui o do Deploy Hook: se a implementação precisar de um secret, ela saiu do desenho.
- [ ] O tempo entre o push e o início do deploy está registrado na descrição do commit — é o custo que esta story cobra (hoje ~6 s pelos `createdAt` medidos; passa a ser o tempo do job `ci`, ~29 s + install, pela linha de base da US-80).

---

## Notas de implementação

- **Falha fechada por ausência de check.** "Zero checks detected" = não deploya. Se o `ci.yml` deixar de rodar num commit da `main` (um `paths:` filter futuro, um workflow que não inicia), a `main` para de deployar **em silêncio**. É o comportamento certo, mas é novo: hoje um push sempre deploya. Se um dia o `ci.yml` ganhar filtro de caminho, este campo vira uma armadilha.
- **`neutral` e `skipped` contam como passou.** Guard que se auto-pula vira gate que não morde — mesma família do `--fail-if-no-match` documentado em `ci.yml:43`. Relevante se o `ci.yml` ganhar passos condicionais.
- **A Vercel não entra na conta.** Medido em 30/07/2026 nos 5 commits mais recentes da `main`: a Vercel publica **commit status** (`Vercel=success`), não check run, e o Render lê só a Checks API. Ressalva: em `2f487a8` apareceu o check run `vercel/Vercel Preview Comments` (app `vercel`, conclusão `success`) — é o toolbar de comentários, não o build, mas **é** um check run e, se um dia concluir `failure`, segura o deploy da API. Se acontecer, o conserto é desligar os preview comments, não voltar atrás no `checksPass`.
- **Rollback fica mais barato, não mais caro.** Com o gate, um deploy ruim para de nascer; o plano B (rollback manual pelo painel) continua igual.
- **`prisma migrate deploy` continua no `buildCommand`.** Esta story não mexe nele. Mas note o efeito colateral bom: com o deploy atrás do CI, uma migração quebrada para de ser aplicada por um commit que o `pnpm test` reprovaria.

---

## Questões em aberto

1. ~~**A Vercel entra junto?**~~ **Respondida em 30/07/2026: não.** A Vercel já falha fechada — build vermelho fica em `ERROR` e o alias de produção não move. O `next build` dela continua sendo o único typecheck completo do `apps/web` (US-80, *Questão* #4), e desligar o auto-deploy do frontend removeria esse sinal sem repor nada.
   **Assimetria assumida:** depois desta story, um commit vermelho sobe a web e **não** sobe a API — frontend na frente do backend, com skew de contrato `@ai-dm/shared` até o commit verde seguinte. Aceito na Fase 1 (single-player, uma autora, minutos de janela).
   **Fecho barato se incomodar:** o `ci.yml` hoje **não** roda `next build`. Um passo `pnpm --filter web build` tornaria o CI superconjunto do gate da Vercel — aí o sinal exclusivo dela some e "espelhar na Vercel" vira decisão reversível. Não entra nesta story; é candidato a US própria.
2. ~~**Push na `main` com o CI anterior ainda rodando?**~~ **Dissolvida pelo desenho novo.** Ela só existia porque dois jobs `deploy` do GitHub podiam disparar fora de ordem. Com `checksPass` o Render avalia os checks **por commit**, então não há job a serializar — nem `concurrency`, nem `?ref=`.
3. **`blueprint_sync` respeita o `checksPass`?** *(nova, aberta)* O histórico mostra que `blueprint_sync` é um trigger de deploy **distinto** de `new_commit`: `b336bfd` gerou os dois (`dep-d9l4grve3alc73frghe0` e `dep-d9l4gr8ae00c73dkhcdg`, ambos `build_failed`). Não está documentado se um sync de Blueprint espera os checks ou deploya direto. Consequência prática: o próprio commit que ligar o `checksPass` pode disparar um deploy sem gate. Inofensivo se for verde — mas medir na hora e anotar o resultado aqui, porque toda mudança futura no `render.yaml` cai no mesmo caminho.

---

## Referências no código

- `render.yaml` (`:11`) — `autoDeploy: true`, a única linha que esta story troca.
- `render.yaml` (`buildCommand`) — o que já roda hoje sem esperar gate: `pnpm build` e `prisma migrate deploy`.
- `.github/workflows/ci.yml` (`:6`) — `on: [push, pull_request]`, o que garante um check em todo commit da `main` (pré-condição do `checksPass`).
- `.github/workflows/ci.yml` (`:43`) — o comentário do `--fail-if-no-match`, precedente da armadilha "passo verde que não rodou nada"; mesma família do `skipped` que conta como passou.
- `apps/web/vercel.json` — o `buildCommand` do frontend, o gate próprio dele (*Questão* #1).
