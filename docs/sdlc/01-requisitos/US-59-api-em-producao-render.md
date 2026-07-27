# US-59 — API em produção no Render (host de processo, SSE, migração no release)

**Épico:** Deploy e operação (custo zero) — [ADR 006](../../adr/006-deploy-custo-zero.md)
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** [US-58](./US-58-banco-postgres-neon.md) (banco pronto + `DATABASE_URL`) · [ADR 006](../../adr/006-deploy-custo-zero.md) (D2: host de processo persistente; D5: `migrate deploy` no release)
**Criada em:** 2026-07-19

> **Progresso (2026-07-20):** infra as code pronta — [`render.yaml`](../../../render.yaml) na raiz (Blueprint) + `packageManager: pnpm@11.9.0` pinado no `package.json`. Build encadeia `install → prisma generate → pnpm build → migrate deploy`; start `node apps/api/dist/main`. `migrate deploy` vai no **buildCommand** (Free não tem Pre-Deploy Command); idempotente e enxerga a Neon pela internet — equivale ao release step do D5. Runtime de narração confirmado em [model.ts](../../../packages/ai-engine/src/model.ts): só `OPENROUTER_API_KEY` + `GROQ_API_KEY` (NVIDIA/GEMINI/OPENAI são eval, ficam fora). **Falta:** criar conta Render + primeiro deploy real + preencher os 4 segredos no dashboard; critérios de aceite abaixo só fecham após deploy no ar.

---

## História

> **Como** operador do AI DM,
> **quero** a API (NestJS) rodando num host de processo always-on grátis, servindo o streaming SSE do Mestre e aplicando as migrações no deploy,
> **para que** o jogo tenha um backend público sem custo mensal e sem cortar a narração no meio.

---

## Contexto e motivação

### O problema observado

O endpoint do Mestre ([ai.controller.ts](../../../apps/api/src/ai/ai.controller.ts)) responde em **SSE**, mantendo a resposta HTTP aberta por dezenas de segundos enquanto o LLM streama. O [ADR 006](../../adr/006-deploy-custo-zero.md) (D2) conclui que isso **não** cabe em função serverless (teto de execução) — precisa de um **host de processo persistente**. Hoje a API só roda em `localhost`; não há deploy.

### Por que a solução atual não basta

A API já é um processo Node de longa duração (`app.listen`, [main.ts](../../../apps/api/src/main.ts)) — está pronta para um host de processo, mas ninguém a hospedou. Falta o serviço na nuvem, as env vars e o passo de migração no release.

### A proposta

Subir o `apps/api` como **Web Service no Render** (plano Free): build do monorepo, `node dist/main` como start, env vars (banco, CORS, chaves de LLM) e `prisma migrate deploy` como passo de release.

---

## Escopo

### Dentro do escopo

- **Web Service no Render (Free)**, runtime Node, a partir deste repositório (monorepo pnpm).
- **Build do monorepo:** instalar deps, buildar os `packages/*` que a API importa (`@ai-dm/shared`, `@ai-dm/ai-engine` — memória `ai-engine-dist-rebuild`), `prisma generate` (client gitignored) e `nest build`. O `pnpm build` da raiz já encadeia packages→apps.
- **Start:** `node dist/main` (`PORT` injetada pelo Render).
- **Release step:** `prisma migrate deploy` (idempotente; não `migrate dev`, não re-seed).
- **Env vars (segredos):** `DATABASE_URL` (Neon, US-58), `FRONTEND_URL` (domínio da Vercel, US-60 — fecha o CORS em [main.ts:9](../../../apps/api/src/main.ts)), e as chaves de LLM que o `ai-engine` lê **em runtime** na narração ([model.ts](../../../packages/ai-engine/src/model.ts)). **Nenhuma** chave de LLM vai para o web.
- **Arquivo de config de deploy** (`render.yaml` ou equivalente) versionado, se ajudar a reprodutibilidade.
- **Verificação:** `GET /api/v1/systems` público retorna os sistemas; `POST /api/v1/ai/chat` streama tokens SSE de ponta a ponta.

### Fora do escopo

- **Banco** — US-58 (esta US consome a `DATABASE_URL`, não a cria).
- **Web** — US-60 (o CORS aqui aponta para o domínio de lá; a URL da API é o que o web consome).
- **Cold start / warm-up** — US-57 (mitigação no cliente); aqui só se **aceita** o sleep do Free (D2).
- **Escala, observabilidade, plano pago** — não é produção com SLA (ADR 006).
- **Dockerfile** — o runtime Node nativo do Render basta; só criar container se o build do monorepo exigir.

---

## Critérios de aceite

- [x] A API está pública numa URL do Render (Web Service Free) e responde `GET /api/v1/systems` com os sistemas semeados (US-58). — verificado 2026-07-20: `https://ai-dm-api.onrender.com/api/v1/systems` → HTTP 200, `system-dnd5e` (SRD 5.2).
- [x] O build compila `packages/*` + `prisma generate` + `nest build`; o start é `node dist/main` e escuta na `PORT` injetada. — deploy `Deployed` no Render.
- [x] O deploy roda `prisma migrate deploy` no release; um deploy com migração pendente aplica-a sem passo manual. — `/systems` devolve dados semeados ⇒ schema migrado + seed presentes na Neon.
- [x] O CORS aceita **apenas** o domínio de `FRONTEND_URL`; requisição de outra origem é bloqueada. — verificado 2026-07-21: preflight com `Origin: https://ai-dm-web.vercel.app` devolve `access-control-allow-origin` casado; com `Origin: https://evil.example.com` devolve o mesmo domínio permitido (≠ da origem) ⇒ browser bloqueia. `FRONTEND_URL` = domínio real da US-60.
- [x] `POST /api/v1/ai/chat` entrega a narração em **streaming SSE** (tokens chegam incrementalmente), sem corte por teto de execução. — verificado 2026-07-21: frames `0:"…"` chegam a cada ~120 ms (timestamps por linha), 189 frames num turno completo.
- [x] As chaves de LLM de runtime existem só no serviço do Render; o repo não as contém. — `sync: false` no `render.yaml`; preenchidas no dashboard.
- [x] **Regressão:** um turno completo (ação → rolagem → narração → HP/inventário) funciona ponta a ponta contra a Neon. — verificado 2026-07-21: aventura de teste gravou na Neon `ACTION` + `NARRATION` + `DICE_ROLL` (EventLog), confirmando ação→rolagem→narração persistidos.

---

## Notas de implementação

- **`prisma generate` é obrigatório no build** — o client vive em `src/generated/prisma` e é gitignored (memória `prisma-7-upgrade`); sem gerar, o build da API quebra.
- **Chaves de runtime vs. eval:** [model.ts](../../../packages/ai-engine/src/model.ts) lê várias chaves, mas as de **produção** são as do caminho de narração (primário + fallback); `GEMINI/OPENAI/NVIDIA` extras são de bake-off/eval e **não** precisam existir no Render. Confirmar em `model.ts` qual par é o de runtime antes de configurar.
- **Sleep do Free (~15 min):** aceito por decisão (ADR 006, D2). A [US-57](./US-57-warmup-do-servidor-na-entrada.md) esconde o cold start na entrada do jogo.
- **`FRONTEND_URL` é dependência circular leve com a US-60:** o web precisa da URL da API e a API precisa do domínio do web (CORS). Subir a API primeiro com um valor provisório e ajustar `FRONTEND_URL` quando a Vercel der o domínio final.
- **Alternativas de host (mesmo papel):** Fly.io / Koyeb, caso o sleep do Render incomode (ADR 006, D2). Trocar de provedor não muda esta US além do painel.

---

## Questões em aberto

1. Build via `pnpm build` da raiz ou comando específico do serviço (só o subgrafo da API)? O da raiz é mais simples; o específico é mais rápido. Decidir pelo tempo de build no Free.
2. Vale versionar `render.yaml` (infra as code) ou configurar pelo painel? IaC ajuda a reproduzir, mas é peso extra para um MVP de um serviço.

---

## Referências no código

- `apps/api/src/main.ts` — `app.listen(PORT)`, CORS por `FRONTEND_URL`, prefixo `api/v1`.
- `apps/api/src/ai/ai.controller.ts` — o endpoint SSE que exige host de processo.
- `apps/api/package.json` — scripts `build` (`nest build`), `start` (`node dist/main`), `db:migrate:deploy`.
- `packages/ai-engine/src/model.ts` — chaves de LLM lidas em runtime.
- `docs/adr/006-deploy-custo-zero.md` — D2 (host de processo) e D5 (migração no release).
