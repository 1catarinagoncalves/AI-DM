# US-60 — Web em produção na Vercel (Next.js + proxy SSE apontado à API)

**Épico:** Deploy e operação (custo zero) — [ADR 006](../../adr/006-deploy-custo-zero.md)
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
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

- [ ] O `apps/web` está público numa URL da Vercel e carrega a home sem erro.
- [ ] O build resolve `@ai-dm/shared` (workspace) — nenhuma falha de módulo não encontrado.
- [ ] `NEXT_PUBLIC_API_URL` aponta para a API do Render; as chamadas de [api.ts](../../apps/web/src/lib/api.ts) atingem a API pública (não `localhost`).
- [ ] Um turno completo funciona no site público: ação enviada, narração chega em **streaming** pelo proxy `/api/chat`, HP/inventário atualizam.
- [ ] O CORS da API aceita o domínio da Vercel (par `FRONTEND_URL` ↔ `NEXT_PUBLIC_API_URL` fechado).
- [ ] **Regressão:** o proxy SSE entrega os tokens incrementalmente (não em bloco no fim) — o efeito de "digitação" do Mestre aparece no site público.

---

## Notas de implementação

- **Proxy não pode bufferizar:** [route.ts](../../apps/web/src/app/api/chat/route.ts) devolve `upstream.body` com `Content-Type: text/event-stream`. Confirmar que o runtime escolhido na Vercel faz streaming de resposta (Node runtime serve; conferir que nada no meio acumula o corpo).
- **`NEXT_PUBLIC_` é build-time:** a var entra no bundle no build — mudar a URL da API exige **rebuild** do web, não só trocar a env em runtime.
- **Monorepo na Vercel:** setar o Root Directory como `apps/web` e garantir install/`build` a partir da raiz do workspace (o `@ai-dm/shared` precisa existir). Se o autodetect falhar, um `vercel.json` com o build command explícito resolve.
- **Ordem com a US-59:** a URL da API tem de existir antes; e o domínio da Vercel realimenta o `FRONTEND_URL` do Render (fechar o CORS depois do primeiro deploy do web).

---

## Questões em aberto

1. A rota `/api/chat` roda em Edge ou Node runtime na Vercel? Edge tem streaming nativo, mas o comportamento de proxy de `ReadableStream` difere — validar qual mantém o SSE fluido no Hobby.
2. Vale um health check leve na home que dispare o warm-up (US-57) antes ainda do jogo, ou o aquecimento na entrada da mesa basta? Provavelmente basta para o MVP.

---

## Referências no código

- `apps/web/src/lib/api.ts` — consome `NEXT_PUBLIC_API_URL` (fallback `localhost:3001`).
- `apps/web/src/app/api/chat/route.ts` — proxy SSE para a API; repassa `upstream.body`.
- `apps/web/next.config.ts` — config de build do Next.
- `docs/adr/006-deploy-custo-zero.md` — D1 (web na Vercel) e a topologia web↔api.
