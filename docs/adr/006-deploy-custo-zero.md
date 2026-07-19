# ADR 006 — Deploy a custo zero (Fase 1)

**Status:** Proposto
**Data:** 2026-07-19
**Decisores:** Time de Produto e Engenharia
**Relacionado:** [ADR 001 — Arquitetura](./001-arquitetura.md) (define os dois runtimes e a persistência; Redis/worker/vector store são das Fases 2–3)

---

## 1. Contexto

A Fase 1 (MVP single-player) precisa sair do `localhost` e ficar acessível na internet — para demo, testes com jogadores reais e validação — **sem custo mensal**. O objetivo não é produção com SLA; é uma versão pública funcional cujo custo de hospedagem seja **US$ 0** enquanto o tráfego for baixo.

Ao mapear o que a aplicação exige do host, o desenho de hoje é mais simples do que o [ADR 001](./001-arquitetura.md) previa para as fases seguintes — e isso muda o que precisamos hospedar:

- **Dois runtimes, não seis.** O MVP tem só o **web** (Next.js 15, App Router) e o **api** (NestJS sobre Express). **Não há Redis, não há worker de ingestão (BullMQ), não há vector store** — esses entram nas Fases 2–3. Confirmado por varredura: nenhuma referência a `redis`/`ioredis`/`bullmq` em `apps/api`.
- **O api é um processo Node always-on, não serverless.** [main.ts](../../apps/api/src/main.ts) faz `app.listen(...)` — um servidor HTTP de longa duração. Mais decisivo: o endpoint do Mestre ([ai.controller.ts](../../apps/api/src/ai/ai.controller.ts)) responde em **SSE** (`text/event-stream`, `flushHeaders()`, `keep-alive`), mantendo a resposta HTTP **aberta por segundos a minutos** enquanto o LLM emite tokens. É a restrição que define o deploy.
- **O web só faz proxy do streaming.** [route.ts](../../apps/web/src/app/api/chat/route.ts) repassa o corpo SSE do api ao browser; [api.ts](../../apps/web/src/lib/api.ts) aponta para o api por `NEXT_PUBLIC_API_URL`. O web **não tem estado próprio** — é fronteira burra sobre o api.
- **O LLM já é externo e já é grátis.** A narração roda em OpenRouter (primário) com fallback Groq — provedores externos em free tier / pay-per-token. **Não é custo de hosting**; sai da conta de infraestrutura por completo.
- **Persistência é um Postgres.** Prisma 7 com adapter `pg` ([schema.prisma](../../apps/api/prisma/schema.prisma)). Nenhum recurso exótico — precisa de um Postgres gerenciado no free tier.

Três observações reenquadram o problema:

1. **O gargalo é o SSE, não o "backend" em abstrato.** A tentação é jogar tudo em Vercel (onde o Next.js é nativo e grátis). Mas Vercel Functions no Hobby têm **teto de tempo de execução** e são feitas para request-response curto — uma narração de Mestre que streama por 30–90s vive mal ali. O api **não pode** virar função serverless; precisa de um **host de processo persistente**. O web, por só fazer proxy, pode ficar em serverless sem dor.
2. **"Custo zero" tem uma moeda escondida: cold start.** Todo free tier de processo always-on (Render, Fly, Koyeb) **suspende o serviço após ociosidade** e o Postgres serverless (Neon) **autossuspende** a computação. O primeiro request depois de um período parado paga a latência de acordar tudo (dezenas de segundos). Custo zero em dólar, não em latência de primeira requisição.
3. **A topologia mais barata é a mais desacoplada.** Como web e api já falam só por HTTP/`NEXT_PUBLIC_API_URL`, eles podem morar em **plataformas diferentes**, cada uma no free tier que melhor serve seu runtime. Não há ganho em co-hospedar; há ganho em usar o tier certo para cada um.

Falta fixar **onde cada peça roda e o que se aceita em troca do zero**.

---

## 2. Decisão

Hospedar cada runtime na plataforma cujo free tier casa com sua natureza, aceitando cold start como o preço do custo zero. **Três serviços, três contas, zero fatura.**

### D1 — Web (Next.js) → **Vercel Hobby**

O `apps/web` sobe na **Vercel**, tier Hobby (grátis, sem cartão). Next.js 15 é first-class ali: build, SSR/streaming e a rota de proxy [route.ts](../../apps/web/src/app/api/chat/route.ts) rodam sem configuração especial. O único ajuste é a env var `NEXT_PUBLIC_API_URL` apontando para a URL pública do api.

O proxy SSE do web repassa um stream que **ele não origina** (o api origina). Vercel suporta streaming de resposta em Edge/Node runtime; como o web só encaminha bytes, não esbarra no teto de execução que mataria a *geração* do LLM — essa mora no api.

### D2 — API (NestJS) → **Render Free Web Service** (host de processo persistente)

O `apps/api` sobe como **Web Service no Render**, plano Free. É um contêiner Node always-on de verdade — `app.listen` roda como em produção, e a resposta SSE de longa duração é servida sem teto de função serverless.

Preço do free tier, aceito explicitamente: **o serviço suspende após ~15 min de ociosidade** e acorda no próximo request com **cold start de ~30–60s**. Para demo e testes de MVP, aceitável. **Não é aceitável para produção** — subir de plano (ou migrar de plataforma) é decisão de outra fase.

Alternativas equivalentes no mesmo papel (host de processo, free tier): **Fly.io** e **Koyeb**. Render é o default por ter o caminho mais curto (deploy por Git, sem Dockerfile obrigatório para app Node). A decisão é o **papel** ("host de processo persistente no free tier"), não a marca — trocar de provedor não muda a arquitetura.

### D3 — Postgres → **Neon Free** (Postgres serverless)

O banco vai para a **Neon**, tier Free: Postgres gerenciado, serverless, compatível com o adapter `pg` do Prisma 7 sem mudança de código — só a `DATABASE_URL`. Free tier generoso para MVP (storage e compute suficientes para os volumes desta fase).

Mesma moeda escondida do D2: a compute do Neon **autossuspende** com ociosidade e leva alguns segundos para religar na primeira query. Somado ao cold start do Render, a **primeira** requisição depois de um vale de tráfego é lenta; as seguintes são normais. É o custo do zero, e o assumimos.

Alternativa equivalente: **Supabase** (Postgres free). Neon é o default por ser Postgres puro (sem plataforma acoplada que não usamos no MVP).

### D4 — LLM permanece externo (fora da conta de hosting)

Nada muda: OpenRouter (primário) + Groq (fallback), já em free tier / pay-per-token. As chaves entram como env vars **só no api** (nunca no web — o web não fala com o LLM direto). O deploy não hospeda modelo; consome API externa. **Custo de inferência não é custo de infraestrutura** e sai desta decisão.

### D5 — Migração de schema roda no deploy do api, não à parte

`prisma migrate deploy` roda como passo de build/release do serviço api no Render (não `migrate dev`, que é de desenvolvimento). Sem pipeline separado, sem serviço extra — o único runtime que fala com o banco é quem aplica a migração.

### D6 — O cold start é aquecido **na entrada do jogo**, não escondido no 1º turno

O free tier suspende (D2/D3), então a **primeira** requisição depois de ocioso é lenta. A decisão de produto é **onde** essa lentidão aparece: **não** no primeiro turno do Mestre (onde já se soma à latência do LLM e o jogador lê como "o jogo travou"), mas **ao abrir a mesa**, com o tempo de espera à vista.

O aquecimento **reusa a primeira chamada que o cliente já faz ao montar a tela de jogo** (`getTurns`, que carrega o histórico) — ela toca o Postgres, logo acorda o processo do api (Render) **e** a compute do Neon numa tacada. Enquanto não resolve, o input fica travado e um indicador mostra os segundos decorridos. Servidor já quente resolve em milissegundos e o indicador nem aparece.

Não se cria endpoint `/health` dedicado: um ping que só responde `ok` acordaria o processo mas deixaria a 1ª query pagar o cold start do Neon. O aquecimento **tem de tocar o banco** — e a chamada de histórico já toca.

O caso que fecha o buraco é o **jogador que volta com sessão salva** e cai direto em `/play/[adventureId]`, sem passar pelo setup (que já aqueceria antes). A implementação detalhada vive na [US-57](../sdlc/01-requisitos/US-57-warmup-do-servidor-na-entrada.md).

### 2.1 Topologia

```
Browser
   │  HTTPS
┌──────────────────────────┐
│  Vercel Hobby (web)      │   Next.js 15 — UI + proxy SSE
│  NEXT_PUBLIC_API_URL ────┼───┐
└──────────────────────────┘   │ HTTPS (SSE passa por aqui)
                                ▼
┌──────────────────────────┐
│  Render Free (api)       │   NestJS always-on — SSE, tools, regras
│  DATABASE_URL ───────────┼───┐
│  OPENROUTER/GROQ keys ───┼─► │  LLM externo (OpenRouter, Groq)
└──────────────────────────┘   │
                                ▼
┌──────────────────────────┐
│  Neon Free (Postgres)    │   Prisma 7 + adapter pg
└──────────────────────────┘
```

---

## 3. Decisões-chave e justificativas

| # | Decisão | Por quê |
|---|---------|---------|
| 1 | Web na Vercel Hobby | Next.js é nativo ali; grátis; o web só faz proxy, então não esbarra no teto de execução serverless |
| 2 | API em host de processo persistente (Render Free), não serverless | O endpoint do Mestre é SSE de longa duração; função serverless com teto de tempo cortaria a narração no meio |
| 3 | Postgres na Neon Free | Postgres puro, serverless, compatível com o adapter `pg` sem mudar código; free tier cobre o MVP |
| 4 | Três plataformas, não uma | Web e api já falam só por HTTP; cada runtime usa o free tier que casa com sua natureza — não há ganho em co-hospedar |
| 5 | LLM fora da conta de hosting | Já é externo e grátis; deploy consome API, não hospeda modelo |
| 6 | Cold start aceito como preço do zero | Todo free tier de always-on suspende com ociosidade; em dólar é zero, em latência de 1ª requisição não |
| 7 | Decisão é o **papel**, não a marca | "Host de processo no free tier" pode ser Render/Fly/Koyeb; trocar de provedor não muda a arquitetura |
| 8 | `migrate deploy` no release do api | O único runtime que fala com o banco aplica a migração; sem pipeline nem serviço extra |
| 9 | Cold start aquecido na entrada do jogo (D6) | Move a lentidão do free tier do 1º turno (onde soma com o LLM e parece travamento) para a abertura da mesa, com o tempo à vista; reusa o `getTurns` que já toca o banco ([US-57](../sdlc/01-requisitos/US-57-warmup-do-servidor-na-entrada.md)) |

---

## 4. Alternativas rejeitadas

| Alternativa | Motivo da rejeição |
|-------------|-------------------|
| **Tudo na Vercel** (api como Serverless/Edge Functions) | O SSE do Mestre streama por dezenas de segundos; funções Hobby têm teto de execução e são request-response curto. Reescrever o api para caber ali seria trabalho grande contra a natureza do NestJS always-on |
| **Postgres no Render** (free) | O Postgres free do Render **expira em ~90 dias** — vira custo obrigatório depois. Neon não expira |
| **Uma VPS única** (Oracle Cloud Free, e2-micro) com web+api+db | Mais barato ainda em teoria, mas troca "zero config" por administrar servidor, Postgres, TLS e reverse proxy à mão — custo de operação alto para uma demo. Fica como opção se os free tiers gerenciados apertarem |
| **Railway** para o api | Deixou de ter free tier real (virou crédito de trial que expira); não atende ao requisito de custo zero contínuo |
| **SQLite/Postgres embarcado** no contêiner do api | O disco do free tier do Render é efêmero — perde os dados a cada deploy/restart. Banco tem de ser gerenciado e externo |
| **Manter tudo em `localhost` / túnel (ngrok)** | Não é deploy; depende da máquina do dev ligada e do túnel de pé. Serve para debug, não para uma versão pública |

---

## 5. Consequências

**Positivas**
- **Custo mensal US$ 0** para o MVP, sem cartão de crédito em nenhuma das três plataformas.
- **Cada runtime no tier certo** — Next.js onde é nativo, NestJS num host de processo real, Postgres gerenciado que não expira.
- **Deploy por Git** nas três — push na branch dispara build; sem pipeline artesanal.
- **Zero mudança de código de aplicação** — só env vars (`NEXT_PUBLIC_API_URL`, `DATABASE_URL`, chaves de LLM). O adapter `pg` do Prisma já fala com a Neon; o SSE já funciona num host de processo.
- **Desacoplado por design** — trocar qualquer das três plataformas é mudar uma URL/DSN, não a arquitetura.

**Negativas / riscos**
- **Cold start em cascata** — Render (suspende ~15 min) + Neon (autossuspende) fazem a **primeira** requisição após ociosidade levar dezenas de segundos. **Mitigado (D6):** o aquecimento na entrada do jogo ([US-57](../sdlc/01-requisitos/US-57-warmup-do-servidor-na-entrada.md)) move essa espera para a abertura da mesa, com o tempo à vista, em vez de a esconder no 1º turno do Mestre. **Não resolve** o re-sleep se o jogador ficar >15 min ocioso *dentro* da mesa — a mensagem seguinte volta a pagar cold start (ver questão em aberto na US-57). Manter o servidor sempre acordado (ping periódico via cron externo) fica de fora: queimaria horas do free tier.
- **Free tier é movediço** — limites e existência dos planos gratuitos mudam sem aviso (Railway já mostrou). A decisão fixa o **papel** de cada peça justamente para absorver troca de provedor sem redesenho.
- **Não é produção** — sem SLA, sem escala horizontal, sem observabilidade além do log da plataforma. Subir de fase exige revisitar D2/D3 (plano pago ou VPS) e trazer Redis/worker/vector store das Fases 2–3, que este ADR **não** cobre.
- **Segredos em três painéis** — as env vars (chaves de LLM, `DATABASE_URL`) vivem espalhadas nas três plataformas; rotação e auditoria são manuais nesta fase.

---

## 6. Implementação (referência)

- **Vercel (web):** importar o repo, root em `apps/web`, framework Next.js autodetectado. Env: `NEXT_PUBLIC_API_URL` = URL pública do Render. Build padrão do monorepo (respeitar o pnpm workspace).
- **Render (api):** Web Service, runtime Node, build a partir de `apps/api` (com o build dos `packages/*` que ele importa — ver `pnpm build` no [package.json](../../package.json) raiz). Start: o `main.ts` compilado. Env: `DATABASE_URL` (Neon), `FRONTEND_URL` (URL da Vercel, para o CORS em [main.ts:9](../../apps/api/src/main.ts)), `OPENROUTER_API_KEY`/`GROQ_API_KEY`, `PORT` (o Render injeta). Release step: `prisma migrate deploy` + seed do SRD se o banco estiver vazio.
- **Neon (db):** criar projeto Postgres, copiar a connection string (com `?sslmode=require`) para `DATABASE_URL`. Rodar `pnpm db:migrate` (ou o `migrate deploy` do release) contra ela.
- **CORS:** [main.ts](../../apps/api/src/main.ts) já lê `FRONTEND_URL` — apontar para o domínio da Vercel fecha a origem.
- **Sem novos serviços:** nada de Redis/BullMQ/vector store — não fazem parte do MVP nem deste deploy.
