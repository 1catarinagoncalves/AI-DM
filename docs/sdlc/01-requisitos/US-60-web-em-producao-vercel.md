# US-60 — Web em produção na Vercel (Next.js + proxy SSE apontado à API)

**Épico:** Deploy e operação (custo zero) — [ADR 006](../../adr/006-deploy-custo-zero.md)
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** [US-59](./US-59-api-em-producao-render.md) (API pública + URL) · [ADR 006](../../adr/006-deploy-custo-zero.md) (D1: web na Vercel)
**Criada em:** 2026-07-19

---

## História

> **Como** jogador,
> **quero** abrir o AI DM numa URL pública que fale com a API,
> **para que** eu jogue pelo navegador sem rodar nada localmente.

---

## Contexto e motivação

### O problema observado

O [ADR 006](../../adr/006-deploy-custo-zero.md) (D1) coloca o `apps/web` na **Vercel** (Hobby, grátis). Hoje o front só roda em `localhost:3000` e aponta para `localhost:3001`; não há site público nem `NEXT_PUBLIC_API_URL` de produção.

### Por que a solução atual não basta

O web já está pronto para outra origem — [api.ts](../../apps/web/src/lib/api.ts) e o proxy [route.ts](../../apps/web/src/app/api/chat/route.ts) leem `NEXT_PUBLIC_API_URL`, com fallback para `localhost`. Falta hospedar e apontar a env var para a API do Render (US-59).

### A proposta

Subir o `apps/web` na Vercel (Hobby), com `NEXT_PUBLIC_API_URL` apontando para a API pública, cuidando do build do monorepo (o web depende de `@ai-dm/shared`).

---

## Escopo

### Dentro do escopo

- **Projeto Vercel (Hobby)** a partir deste repositório, root do projeto em `apps/web`.
- **Build do monorepo:** o web importa `@ai-dm/shared` (workspace) — o build tem de resolver e compilar esse pacote (install na raiz + filtro do web).
- **Env var:** `NEXT_PUBLIC_API_URL` = URL pública da API (US-59), consumida por [api.ts](../../apps/web/src/lib/api.ts) e [route.ts](../../apps/web/src/app/api/chat/route.ts).
- **Streaming pelo proxy:** a rota `/api/chat` (Next) repassa o corpo SSE da API ao browser; garantir que o runtime da rota **não** bufferiza nem corta o stream.
- **CORS casado:** o domínio final da Vercel é o `FRONTEND_URL` do Render (US-59) — fechar o par.
- **Verificação:** abrir o site público, criar personagem, jogar um turno com narração em streaming.

### Fora do escopo

- **API e banco** — US-59 / US-58 (o web só consome a URL da API).
- **Domínio custom / SSL próprio** — o subdomínio `*.vercel.app` basta para o MVP.
- **SSR de dados sensíveis / auth** — não há login nesta fase; a sessão é local (`session.ts`).
- **Warm-up** — US-57 (já implementado no `GameView`).

---

## Critérios de aceite

- [x] O `apps/web` está público numa URL da Vercel e carrega a home sem erro. — `https://ai-dm-web.vercel.app` (verificado 2026-07-21).
- [x] O build resolve `@ai-dm/shared` (workspace) — nenhuma falha de módulo não encontrado. — `vercel.json` builda o pacote antes do `next build` (commit `18f8eb6`).
- [x] `NEXT_PUBLIC_API_URL` aponta para a API do Render; as chamadas de [api.ts](../../apps/web/src/lib/api.ts) atingem a API pública (não `localhost`). — `https://ai-dm-api.onrender.com`; sistemas carregam no `/setup`.
- [x] Um turno completo funciona no site público: ação enviada, narração chega em **streaming** pelo proxy `/api/chat`. — verificado 2026-07-21 contra `https://ai-dm-web.vercel.app/api/chat`.
- [x] O CORS da API aceita o domínio da Vercel (par `FRONTEND_URL` ↔ `NEXT_PUBLIC_API_URL` fechado). — verificado: sistemas carregam cross-origin sem erro de CORS; par fechado.
- [x] **Regressão:** o proxy SSE entrega os tokens incrementalmente (não em bloco no fim). — verificado 2026-07-21: frames `0:"…"` chegam ~150 ms cada pelo proxy (timestamps por linha). **Exigiu fix** — ver D3 abaixo.

---

## Notas de implementação

- **Proxy não pode bufferizar:** [route.ts](../../apps/web/src/app/api/chat/route.ts) devolve `upstream.body` com `Content-Type: text/event-stream`. Confirmar que o runtime escolhido na Vercel faz streaming de resposta (Node runtime serve; conferir que nada no meio acumula o corpo).
- **`NEXT_PUBLIC_` é build-time:** a var entra no bundle no build — mudar a URL da API exige **rebuild** do web, não só trocar a env em runtime.
- **Monorepo na Vercel:** setar o Root Directory como `apps/web` e garantir install/`build` a partir da raiz do workspace (o `@ai-dm/shared` precisa existir). Se o autodetect falhar, um `vercel.json` com o build command explícito resolve.
- **Ordem com a US-59:** a URL da API tem de existir antes; e o domínio da Vercel realimenta o `FRONTEND_URL` do Render (fechar o CORS depois do primeiro deploy do web).

---

## Decisões (resolvidas)

- **D1 — Node runtime, explícito, na rota `/api/chat`.** Declarar `export const runtime = 'nodejs'` e `export const dynamic = 'force-dynamic'` em [route.ts](../../apps/web/src/app/api/chat/route.ts). Motivos: (a) é o comportamento que já roda em `localhost`, menos surpresa dev↔prod; (b) o Node runtime do Next 15 faz stream de `upstream.body` (`ReadableStream`); (c) `force-dynamic` impede qualquer coleta estática que segure o corpo; (d) o Node serverless tem folga de tempo maior que o Edge no Hobby para **esperar o upstream (Render) acordar** do cold start. **Implementado + deployado** (commit `14784ac`, 2026-07-21).
- **D3 — `maxDuration=60` + anti-buffer eram obrigatórios, não opcionais.** A primeira tentativa (só `runtime`/`dynamic`) **não bastou**: no ar, o proxy bufferizava e a função Hobby morria em ~19 s **sem enviar um byte** (`http_code=000`), exatamente a regressão que este documento previu. O fix que fez o SSE fluir: `export const maxDuration = 60` (Hobby corta em 10 s por padrão; a narração streama por dezenas de segundos), header `X-Accel-Buffering: no` (desliga buffer em proxies intermediários) e `Cache-Control: no-transform`, além de propagar `status: upstream.status`. Verificado ao vivo: tokens incrementais pelo proxy. **Lição:** streaming SSE na Vercel Hobby exige `maxDuration` explícito — o teto de 10 s mata qualquer narração longa antes de aparecer.
- **D2 — Sem health check na home; warm-up nas telas anteriores ao turno.** Rejeitado o ping na home: acordaria o dyno cedo demais (Render redorme após ~15 min, o ganho evapora se o jogador demora) e gastaria compute Free à toa em cada visita/bot/refresh. O aquecimento fica na **entrada da mesa** (US-57) e, por ora, também na **criação e na seleção de personagem** ([US-61](./US-61-login-do-jogador.md)) — pontos que já tocam o banco e ficam logo antes do primeiro turno. Regra: aquecer o mais tarde possível **antes** da primeira ação real, não na porta de entrada.

_Nenhuma questão em aberto remanescente._

---

## Referências no código

- `apps/web/src/lib/api.ts` — consome `NEXT_PUBLIC_API_URL` (fallback `localhost:3001`).
- `apps/web/src/app/api/chat/route.ts` — proxy SSE para a API; repassa `upstream.body`.
- `apps/web/next.config.ts` — config de build do Next.
- `docs/adr/006-deploy-custo-zero.md` — D1 (web na Vercel) e a topologia web↔api.
