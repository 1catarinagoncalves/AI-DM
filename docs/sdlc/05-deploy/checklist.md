# Checklist de Deploy — AI Dungeon Master

**Atualizado em:** 2026-07-29

> Auditado contra o repo em 29/07/2026 ([US-89](../01-requisitos/US-89-gate-de-codigo-morto-com-knip.md)).
> A versão anterior listava hooks, ambiente de staging, alertas e flags que nunca existiram
> — checklist com item que ninguém consegue marcar ensina a ignorar o checklist inteiro.
> O que é desejo está separado, no fim.

---

## Antes de abrir PR

Os mesmos comandos que o CI roda ([`ci.yml`](../../../.github/workflows/ci.yml)) — rodar
local é só antecipar a resposta:

- [ ] `pnpm typecheck`
- [ ] `pnpm test` (unitários; **não há suíte de integração** — ver [estratégia de testes](../04-testes/estrategia-de-testes.md))
- [ ] `pnpm eval` acima do threshold de qualidade
- [ ] `pnpm dead` (código/dep sem consumidor)
- [ ] `pnpm docs:links` + `pnpm docs:links:test` + `pnpm docs:shape`
- [ ] Migration Prisma incluída se o `schema.prisma` mudou
- [ ] Env var nova: adicionada aos painéis (Render/Vercel) **e** ao bloco *Env em dev* do
      [CLAUDE.md](../../../CLAUDE.md). Não há `.env.example` no repo — os `.env` são
      gitignored e a configuração é manual. Antes de escrever "coloque no `.env`", confira
      **como** a variável é lida: a API não tem `ConfigModule` nem `dotenv`.
- [ ] PR referencia a user story (ex.: "Implementa US-08")

## Antes de merge para main

- [ ] CI verde. Os passos são independentes na aba de checks: typecheck, test, eval, gate de
      código morto, gate de docs, teste do gate de docs, guard do README.
- [ ] O guard de frescor do grafo é **aviso**, não bloqueio: doc mudado sem rebuild do
      graphify acende warning. Consertar exige rodar `graphify extract` local (gasta chave).
- [ ] Segredo em diff é responsabilidade de quem revisa: **não há hook de pre-commit** —
      os únicos hooks do repo são `post-commit` e `post-checkout`, ambos do graphify.

## Deploy

Não há ambiente de staging. `main` é produção, nos dois serviços, por push:

- [ ] **API — Render** ([`render.yaml`](../../../render.yaml)): `autoDeploy: true` na `main`.
      O `buildCommand` roda `prisma migrate deploy` no fim — plano Free não tem
      `preDeployCommand`, então a migração acontece no build, antes do start.
- [ ] **Web — Vercel** ([`apps/web/vercel.json`](../../../apps/web/vercel.json)): build a
      partir de `apps/web`, com `@ai-dm/shared` construído antes.
- [ ] Smoke test manual: criar personagem → iniciar aventura → enviar ação → conferir bloco
      de rolagem e narração em streaming.
- [ ] Health check do Render bate em `/api/v1/systems` — endpoint público que **depende do
      seed**. US-99: o seed passou a rodar no próprio `buildCommand` (é idempotente), então
      banco novo já sobe semeado; antes disso, sem `pnpm db:seed` respondia lista vazia.
- [ ] Rollback: redeploy da versão anterior pelo painel (Render e Vercel guardam o
      histórico). Não há registry de container nem tag de versão nossa.

---

## Observabilidade — o que existe hoje

`console.log`/`console.warn` no serviço da IA, lidos pelo painel de logs do Render:

- escolha do modelo e número da tentativa a cada turno (`[AiService] turno attempt=…`)
- avisos de guard: rolagem repetida no turno, perícia não resolvida, degeneração, turno truncado

**Não existe:** `traceId` por turno, log estruturado em JSON, métrica de custo de token,
alerta automático de qualquer espécie. Diagnóstico de produção hoje é ler log à mão.

---

## Desejado, não implementado

Fica registrado como desejo, sem checkbox — nenhum destes tem código ou configuração:

- Hook de pre-commit varrendo segredo; pre-push rodando typecheck/test.
- Ambiente de staging separado, com migração ensaiada antes da produção.
- `traceId` ligando ação → tools → narração → estado persistido.
- Alertas: erro do AI Engine > 1%, p95 do chat > 10s, custo por sessão > 2× a média de 7 dias.
- Janela de baixo tráfego e aprovação de produto antes de migração — com um único ambiente
  e deploy automático no push, isso hoje é ficção.
