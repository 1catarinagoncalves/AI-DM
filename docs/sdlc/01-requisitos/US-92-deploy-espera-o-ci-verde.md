# US-92 — O deploy espera o CI ficar verde

**Épico:** Deploy e operação (custo zero) — [ADR 006](../../adr/006-deploy-custo-zero.md)
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
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

O terceiro gatilho de reabertura que a US-80 listou era "*um commit vermelho chegar em produção e custar rollback*". Esta story não espera o gatilho disparar: o gatilho é uma **certeza estrutural** do arranjo atual, não um azar. Esperar a primeira vez é pagar para aprender o que a leitura dos dois arquivos já diz.

### Por que a solução atual não basta

Não há solução atual. Não existe ordenação nenhuma entre os dois eventos: o CI não conhece o Render, o Render não conhece o CI, e `healthCheckPath: /api/v1/systems` só garante que o processo **subiu**, não que o código está correto — um `pnpm eval` reprovado sobe e responde 200 igual.

### A proposta

Inverter a direção do controle: o Render para de escutar o Git e passa a escutar o CI. `autoDeploy: false`, e um job de deploy no fim do workflow, que só roda com todos os gates verdes e só na `main`.

---

## Escopo

### Dentro do escopo

- `render.yaml`: `autoDeploy: false`, com o comentário explicando **quem** dispara agora.
- Job novo `deploy` em `.github/workflows/ci.yml`:
  - `needs: ci` — herda o verde de todos os passos do job existente;
  - `if: github.event_name == 'push' && github.ref == 'refs/heads/main'` — PR e branch não deployam;
  - dispara o Deploy Hook do Render via `curl --fail`, com a URL em `secrets.RENDER_DEPLOY_HOOK_URL`.
- O job `ci` continua **sem nenhum secret**, como manda o critério de aceite #3 da US-80. O secret novo vive só no job `deploy`.

### Fora do escopo

- **Branch protection / required status checks.** Continua respondida como "não" pela US-80 (*Questão em aberto* #1) e pelo mesmo motivo: sem PR, não há o que trancar. Esta story resolve a **ordenação do deploy**, que é um problema diferente e não precisa de PR nenhum para ser resolvido. Se um dia o fluxo virar PR, a tranca entra por outra story.
- **Rollback automatizado.** Deploy parado antes de sair é mais barato que deploy desfeito depois. Rollback manual pelo painel do Render continua sendo o plano B.
- **Smoke test pós-deploy.** É a [US-93](./US-93-gates-baratos-de-migracao-dependencia-e-smoke.md).
- **Espelhar isso na Vercel.** Ver *Questões em aberto* #1 — o frontend tem gate próprio (`next build`) e um modo de falha diferente; entra só se a resposta for sim.

---

## Critérios de aceite

- [ ] `render.yaml` tem `autoDeploy: false`.
- [ ] Existe um job `deploy` em `ci.yml` com `needs: ci` e a guarda de `push` na `main`.
- [ ] **Teste de regressão (o gate morde):** um commit propositalmente vermelho (mesmo protocolo da US-80: quebrar uma assertiva de `dm-system.ts`, medir, restaurar) empurrado numa branch descartável **não** dispara deploy nenhum no Render. Registrar o print do painel mostrando o último deploy inalterado.
- [ ] **Teste do caminho feliz:** um commit verde na `main` dispara exatamente **um** deploy, e o CI mostra o job `deploy` verde depois do job `ci`.
- [ ] O secret `RENDER_DEPLOY_HOOK_URL` está configurado no repo e **não** aparece em nenhum arquivo versionado.
- [ ] O tempo entre o push e o início do deploy está registrado na descrição do PR/commit — é o custo que esta story cobra (hoje ~0 s; passa a ser o tempo do job `ci`, ~29 s + install, pela linha de base da US-80).

---

## Notas de implementação

- **Deploy Hook do Render:** URL por serviço, gerada no painel (`Settings → Deploy Hook`). Confirmar que o plano Free expõe o hook **antes** de desligar o `autoDeploy` — se não expuser, a alternativa é a API do Render com `RENDER_API_KEY` + `serviceId`, e o critério de aceite não muda.
- **`curl --fail`** (ou `-f`): sem ele, um 4xx do hook devolve exit 0 e o job fica verde sem ter disparado nada. Mesma armadilha do `--fail-if-no-match` que o `ci.yml:43` documenta.
- **Ordem:** ligar o job `deploy` **antes** de desligar o `autoDeploy` deixa o repo com dois disparadores por um push (duplo deploy, inofensivo). Desligar o `autoDeploy` antes deixa a `main` sem deploy nenhum até o job existir. A segunda ordem é a segura: o pior caso é ter que apertar "Deploy" à mão uma vez.
- **`prisma migrate deploy` continua no `buildCommand`.** Esta story não mexe nele. Mas note o efeito colateral bom: com o deploy atrás do CI, uma migração quebrada para de ser aplicada por um commit que o `pnpm test` reprovaria.

---

## Questões em aberto

1. **A Vercel entra junto?** Hoje ela builda a cada push ([US-60](./US-60-web-em-producao-vercel.md)) e o `next build` dela é, na prática, o único typecheck completo do `apps/web` (US-80, *Questão* #4). Desligar o auto-deploy do frontend **remove** esse sinal sem repor nada. Provavelmente a resposta é "não agora" — mas medir antes de decidir: se o `next build` da Vercel já falha em vermelho e não promove, o problema do frontend já está resolvido e a story não tem trabalho lá.
2. **O que acontece com um push na `main` enquanto o CI de um push anterior ainda roda?** Dois jobs `deploy` podem disparar fora de ordem e o segundo deploy pode ser o do commit mais velho. `concurrency: { group: deploy-main, cancel-in-progress: true }` resolve; confirmar que é isso mesmo antes de escrever.

---

## Referências no código

- `render.yaml` (`:11`) — `autoDeploy: true`, a linha que esta story inverte.
- `render.yaml` (`buildCommand`) — o que já roda hoje sem esperar gate: `pnpm build` e `prisma migrate deploy`.
- `.github/workflows/ci.yml` (`:6`) — `on: [push, pull_request]`, o mesmo evento que o Render escuta.
- `.github/workflows/ci.yml` (`:43`) — o comentário do `--fail-if-no-match`, precedente da armadilha "passo verde que não rodou nada".
