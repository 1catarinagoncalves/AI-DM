# US-64 — Acesso do Claude à Vercel via MCP (deploys do web operáveis pelo agente)

**Épico:** Deploy e operação (custo zero) — [ADR 006](../../adr/006-deploy-custo-zero.md)
**Fase:** 1 — MVP single-player
**Depende de:** [US-60](./US-60-web-em-producao-vercel.md) (frontend Next.js na Vercel)
**Status:** ✅ Implementada
**Criada em:** 2026-07-21

---

## História

> **Como** operador do AI DM que usa o Claude Code,
> **quero** que o Claude tenha acesso ao meu projeto Vercel via MCP (deploys, preview URLs, logs de build, env vars, domínios),
> **para que** eu possa depurar build do frontend, checar preview de PR e conferir variáveis de ambiente direto no agente, sem abrir o dashboard da Vercel.

---

## Contexto e motivação

### O problema observado

O web (Next.js 15 App Router) roda na Vercel (US-60) e faz proxy do SSE para a API do Render (commit `14784ac`, `vercel.json`). Quando um build falha ou o streaming não passa pelo proxy, hoje eu abro o dashboard da Vercel, leio o log de build e transcrevo. O Claude tem o plugin Vercel instalado (skills `vercel:*`, agents `deployment-expert`, `ai-architect`), mas o **MCP `plugin:vercel:vercel` exige autorização OAuth** que ainda não foi feita — então nenhuma ferramenta lê o meu projeto real.

### Por que a solução atual não basta

As skills `vercel:*` e o `deployment-expert` sabem *como* operar a Vercel em teoria, mas sem o MCP autenticado não têm acesso ao **meu** projeto: não veem status de deploy, preview URLs, logs nem env vars. A `vercel.json` versionada configura o proxy, mas não dá leitura do runtime. E, ao contrário de Render/Neon (API key), a Vercel usa **OAuth** — que não roda em sessão não-interativa.

### A proposta

Autorizar o **Vercel MCP** (OAuth) no Claude Code, ou como alternativa registrar acesso via `VERCEL_TOKEN`, dando ao agente leitura de deploys, previews, logs de build, env vars e domínios do projeto do AI DM.

---

## Escopo

### Dentro do escopo

- Vercel MCP autorizado (OAuth) e *connected* no Claude Code.
- Agente consegue: listar deploys, obter a preview URL de um deploy, ler logs de build, listar env vars (mascaradas), ver domínio de produção.
- Verificação contra o projeto real do web do AI DM.
- Documentar o procedimento (nada de token/segredo no repo).

### Fora do escopo

- **Criar/configurar o projeto Vercel** — US-60 (esta US conecta o agente ao que já existe).
- **API no Render** — US-59/US-63 (a Vercel só faz proxy do SSE para lá).
- **Promoção a produção automática pelo agente** — na Fase 1 o deploy segue por git push; o MCP é para diagnóstico/preview.
- **Domínio custom pago** — fora do custo zero (ADR 006).

---

## Passo a passo (procedimento)

> **Importante:** o Vercel MCP é OAuth. O fluxo de autorização **não roda em sessão não-interativa** (como esta). Precisa ser feito num `claude` interativo no terminal, OU nas configurações de connectors do claude.ai.

### Comando pronto (script)

Script versionado: [`scripts/mcp/setup-mcp.ps1`](../../../scripts/mcp/setup-mcp.ps1) (Windows) / [`.sh`](../../../scripts/mcp/setup-mcp.sh) (bash). Registra só a Vercel:

```powershell
./scripts/mcp/setup-mcp.ps1 -Service vercel
# depois: Claude interativo -> /mcp -> vercel -> Authenticate (escolher o time do AI DM)
```

Equivale, na mão, a:

```bash
claude mcp add --transport http vercel https://mcp.vercel.com
```

> O script apenas **registra** o server; o OAuth em si é sempre manual no `/mcp`. Para os 3 serviços de uma vez: `./scripts/mcp/setup-mcp.ps1 -Service all`.

### Caminho A — Vercel MCP via OAuth (recomendado)

1. No terminal, registrar o server remoto:
   ```bash
   claude mcp add --transport http vercel https://mcp.vercel.com
   ```
2. Abrir o Claude interativo → `/mcp` → selecionar **vercel** → **Authenticate**. Abre o navegador para login na Vercel e autoriza o Claude (escolher o *scope*/time correto onde vive o projeto do AI DM).
3. Confirmar: "liste meus projetos Vercel" → deve aparecer o projeto do web. Depois "mostre o último deploy e a preview URL".

### Caminho B — Connector pelo claude.ai

Se estiver usando o Claude via claude.ai (não CLI):
1. Ir nas **configurações de connectors** do claude.ai.
2. Adicionar/conectar o connector **Vercel** e completar o OAuth no navegador.
3. Voltar ao chat e verificar com "liste meus projetos Vercel".

### Caminho C — Fallback via `VERCEL_TOKEN` / Vercel CLI (sem OAuth interativo)

Para ambiente headless, ou se o OAuth não for prático:
1. Vercel Dashboard → **Settings → Tokens → Create Token** (escopo no time do projeto). Copiar o valor.
2. Usar a Vercel CLI com o token no ambiente, o Claude gerando os comandos:
   ```bash
   export VERCEL_TOKEN=xxxxxxxx
   vercel ls              # deploys do projeto
   vercel inspect <url>   # detalhes/logs de um deploy
   vercel env ls          # env vars (chaves)
   ```
3. As skills `vercel:*` (ex.: `vercel:deploy`, `vercel:env`, `vercel:status`) operam sobre a CLI autenticada por token.

> **Segurança:** o `VERCEL_TOKEN` dá acesso à conta/time. Não commitar; mantê-lo no ambiente ou keychain da CLI, nunca em `vercel.json` ou no repo. Preferir OAuth (Caminho A/B), que não deixa token em texto.

---

## Critérios de aceite

- [x] O Vercel MCP (ou connector) aparece *connected*/autorizado numa sessão interativa do Claude.
- [x] O agente lista projetos e identifica o projeto do web do AI DM.
- [x] O agente retorna o **status e a preview URL** do último deploy sem eu abrir o dashboard.
- [x] O agente lê **logs de build** de um deploy (ex.: erro de build do Next.js).
- [x] O agente lista **env vars** do projeto por chave (ex.: a URL da API do Render que o web consome), com valores mascarados. — via CLI+token (Caminho C): `NEXT_PUBLIC_API_URL` (Preview+Production, valor `Encrypted`).
- [x] Nenhum `VERCEL_TOKEN`/segredo foi commitado; procedimento documentado, segredo não.
- [ ] **Regressão:** analisar um deploy com build quebrado — o Claude aponta a causa a partir dos logs lidos via MCP/CLI (agent `deployment-expert`), não de suposição. — **PENDENTE** (nenhum build falho no histórico; validar na próxima falha real).

---

## Resultado da verificação (2026-07-21)

Testado via **Vercel MCP** (`plugin:vercel:vercel`), OAuth autorizado no time **AI DM** (`team_RoaBfZTdt0aPylLzEAr3iUoV`).

### Passou

- **MCP connected:** OAuth autorizado, time AI DM visível (`list_teams`).
- **Projeto identificado:** `ai-dm-web` (`prj_XcjhY5INtwiuHjnzPmA9Ku8oHmtY`), framework `nextjs`, Node `24.x`.
- **Status + preview URL:** último deploy `dpl_65RffMj5edQsg9V1Pm8AFjo7RVJP` — `READY`, production, `ai-dm-bbsfqya0v-ai-dm.vercel.app`, região `iad1`, commit `14784ac`. Domínio prod `ai-dm-web.vercel.app`.
- **Build logs:** lidos via `get_deployment_build_logs` — build Next.js OK, rotas `/`, `/api/chat`, `/play/[adventureId]`, `/setup`, "Build Completed [30s]".

### Bloqueado / pendente

1. **Env vars (RESOLVIDO via Caminho C):** o Vercel MCP **não expõe ferramenta de env var** — só `get_project`, `list/get_deployment`, `get_deployment_build_logs`, `list_projects/teams/deployments`. Fechado pela CLI: instalada global via `npm i -g vercel` (o `npx`/`pnpm dlx` quebrava com `ERR_MODULE_NOT_FOUND: xdg-app-paths` no Node 22), autenticada com token de escopo do time (Settings → Tokens), `vercel link` + `vercel env ls`. Resultado: `NEXT_PUBLIC_API_URL` (Preview+Production, valor mascarado). Token de vida curta, revogado após o uso.
2. **Regressão build quebrado (PENDENTE):** os 4 deploys no histórico estão todos `READY`. Sem build falho para o agente analisar. **Para fechar:** validar na próxima falha real de build, ou provocar uma falha controlada num preview.

### Notas técnicas descobertas

- `list_projects` retornou `[]` no time AI DM (quirk do endpoint em conta Hobby), mas `get_project` por slug/ID funciona — leitura direta é o caminho confiável.
- `get_deployment_build_logs` dá **401** quando `idOrUrl` é a **URL** do deploy; usar o **ID `dpl_`** funciona.

---

## Notas de implementação

- **OAuth ≠ sessão não-interativa:** deixar explícito para quem for executar — a autorização exige navegador; não dá para fazer numa run automatizada. Este é o motivo de o Vercel ficar na lista de *servers requiring authentication*.
- **Proxy do SSE:** o web faz proxy do streaming da API pela `vercel.json` (commit `14784ac` — "stream SSE through Vercel proxy without buffering"). Se o streaming cortar, cruzar os logs da Vercel (build/edge) com os do Render (US-63) para achar onde o buffer aparece.
- **Env var que amarra com o Render:** o web precisa da URL pública da API (Render), e a API precisa do domínio do web para o CORS (`FRONTEND_URL`, US-59). Ao inspecionar env vars via MCP, conferir que a URL da API está correta.
- **Escolher o time certo no OAuth:** se a conta tiver múltiplos times, autorizar o scope onde o projeto do AI DM realmente vive, senão `list projects` volta vazio.

---

## Questões em aberto

1. OAuth (Caminho A/B) ou `VERCEL_TOKEN` (Caminho C) como padrão? OAuth é mais seguro e integrado; o token funciona em headless/CI mas é mais um segredo para gerir.
2. Dar ao agente permissão de **promover a produção** (`vercel --prod`) ou manter produção só por git push com preview automático?

---

## Referências no código

- `vercel.json` — configuração do proxy SSE do web para a API.
- `apps/web/src/components/game/GameView.tsx` — cliente que consome o SSE via proxy.
- `docs/sdlc/01-requisitos/US-60-web-em-producao-vercel.md` — projeto Vercel consumido aqui.
- `docs/sdlc/01-requisitos/US-59-api-em-producao-render.md` — API cujo domínio o web referencia (`FRONTEND_URL`/CORS).
