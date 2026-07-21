# US-63 — Acesso do Claude ao Render via MCP (deploy e logs operáveis pelo agente)

**Épico:** Deploy e operação (custo zero) — [ADR 006](../../adr/006-deploy-custo-zero.md)
**Fase:** 1 — MVP single-player
**Depende de:** [US-59](./US-59-api-em-producao-render.md) (Web Service da API no Render, `render.yaml`)
**Status:** ✅ Implementada
**Criada em:** 2026-07-21

---

## História

> **Como** operador do AI DM que usa o Claude Code,
> **quero** que o Claude tenha acesso ao meu serviço Render via MCP (status de deploy, logs, métricas, env vars),
> **para que** eu possa depurar deploy quebrado e checar a saúde da API em produção direto no agente, em vez de abrir o dashboard e transcrever logs.

---

## Contexto e motivação

### O problema observado

A API está no Render (US-59, `https://ai-dm-api.onrender.com`). Quando um deploy falha ou a narração SSE corta, hoje eu abro o dashboard do Render, leio os logs no navegador e colo pedaços no chat para o Claude analisar. O agente tem o plugin Render instalado (skills `render:*`, agent `render-assistant`), mas **sem credencial** essas ferramentas não leem nada do meu serviço real.

### Por que a solução atual não basta

O `render.yaml` versionado (US-59) é *infra as code* — descreve o serviço, mas não dá ao agente **leitura** do estado em produção (deploy status, logs de runtime, métricas, valores de env). O plugin `render:*` e o `render-assistant` existem, porém dependem do Render MCP autenticado com uma `RENDER_API_KEY` que ainda não foi configurada.

### A proposta

Configurar o **Render MCP** no Claude Code com uma API key da conta dona do serviço, dando ao agente capacidade de consultar deploys, ler logs, inspecionar env vars e disparar/monitorar deploy — fechando o loop de diagnóstico sem sair do chat.

---

## Escopo

### Dentro do escopo

- Render MCP registrado e autenticado com `RENDER_API_KEY`.
- Agente consegue: listar serviços, ver status do último deploy, ler logs de build e runtime, listar env vars (chaves; valores de segredo mascarados).
- Verificação contra o Web Service real da API (`ai-dm-api`).
- Documentar o procedimento de setup (segredo fora do repo).

### Fora do escopo

- **Criar/configurar o serviço** — US-59 (esta US conecta o agente ao que já roda).
- **Deploy do web** — é Vercel (US-60/US-64), não Render.
- **Plano pago / escala / observabilidade avançada** — fora da Fase 1 (ADR 006).
- **Rotacionar segredos de runtime** (`OPENROUTER_API_KEY`, `GROQ_API_KEY`) — o agente pode *ver que existem*, mas girar chave de LLM é ação manual.

---

## Passo a passo (procedimento)

> Rodar numa sessão **interativa** do Claude (`claude` no terminal).

### Comando pronto (script)

Script versionado: [`scripts/mcp/setup-mcp.ps1`](../../../scripts/mcp/setup-mcp.ps1) (Windows) / [`.sh`](../../../scripts/mcp/setup-mcp.sh) (bash). Registra só o Render (exige a key no ambiente):

```powershell
$env:RENDER_API_KEY = "rnd_xxxxxxxxxxxxxxxx"   # Render Dashboard -> Account Settings -> API Keys
./scripts/mcp/setup-mcp.ps1 -Service render
```

Equivale, na mão, a:

```bash
claude mcp add --transport http render https://mcp.render.com/mcp \
  --header "Authorization: Bearer rnd_xxxxxxxxxxxxxxxx"
```

### Caminho A — Render MCP remoto com API key (recomendado)

1. Render Dashboard → canto superior direito (avatar) → **Account Settings → API Keys → Create API Key**. Copiar o valor (`rnd_xxxxxxxx`), mostrado uma vez.
2. Registrar o Render MCP:
   ```bash
   claude mcp add --transport http render https://mcp.render.com/mcp \
     --header "Authorization: Bearer rnd_xxxxxxxxxxxxxxxx"
   ```
3. Reabrir o Claude; rodar `/mcp` e confirmar **render** como *connected*.
4. Verificar: pedir "liste meus serviços no Render" → deve aparecer o Web Service `ai-dm-api`. Depois "mostre o status do último deploy da API".

### Caminho B — Skill do plugin (`render:render-mcp`)

O plugin Render já traz a skill de setup. Numa sessão interativa:
1. Ter a `RENDER_API_KEY` em mãos (passo 1 do Caminho A).
2. Invocar `/render:render-mcp` (ou pedir ao Claude para rodar a skill de configuração do Render MCP) e seguir o prompt, colando a key quando pedido.
3. Confirmar via `/mcp`.

### Caminho C — Fallback via Render CLI

Se o MCP não subir, o mesmo diagnóstico sai pela CLI, com o Claude gerando comandos:
- `render login` (abre navegador) e depois `render services` para listar.
- `render logs <service-id>` para logs de runtime.
- `render deploys list <service-id>` para histórico de deploy.
- Para o build específico que falhou, o agente `render-assistant` + skill `render:render-debug` interpretam a saída colada.

> **Segurança:** a `RENDER_API_KEY` dá acesso à conta Render inteira. Não commitar. Ela vive na config local do Claude (`~/.claude`) ou no keychain da CLI — nunca no repo nem no `render.yaml`.

---

## Critérios de aceite

- [ ] O Render MCP aparece *connected* no `/mcp` de uma sessão interativa.
- [ ] O agente lista serviços e identifica o Web Service `ai-dm-api` (Free, região do US-59).
- [ ] O agente retorna o **status do último deploy** (ex.: `Deployed`/`Build failed`) sem eu abrir o dashboard.
- [ ] O agente lê **logs** de build ou runtime do serviço (ex.: última linha de erro de um deploy quebrado).
- [ ] O agente lista as **env vars** do serviço por chave (`DATABASE_URL`, `FRONTEND_URL`, `OPENROUTER_API_KEY`, `GROQ_API_KEY`) com os valores de segredo mascarados.
- [ ] Nenhuma `RENDER_API_KEY` foi commitada; procedimento documentado, segredo não.
- [ ] **Regressão:** simular/analisar um deploy que falha por env var faltando — o Claude identifica a causa a partir dos logs lidos via MCP (skill `render:render-debug`), não de suposição.

---

## Notas de implementação

- **Plano Free e sleep (~15 min):** aceito por decisão (ADR 006, D2). O MCP consulta a API do Render, que responde mesmo com o serviço dormindo — logs e deploy status não dependem do processo estar acordado.
- **Env vars são `sync: false`:** no `render.yaml` os segredos de runtime têm `sync: false` (preenchidos no dashboard). O MCP deve mostrá-los como *set* mas mascarados — confere a memória `us59-render-deploy`.
- **`migrate deploy` vive no buildCommand:** se um deploy falhar na migração (Free não tem Pre-Deploy), o log de **build** é onde o erro aparece — orientar o `render-debug` a olhar o build, não só o runtime.
- **Alternativa de host:** se um dia migrar para Fly.io/Koyeb (ADR 006, D2), esta US é substituída pelo MCP/CLI do provedor equivalente; o padrão (API key → MCP → logs/deploy) se mantém.

---

## Questões em aberto

1. MCP remoto (Caminho A) ou skill do plugin (Caminho B) como padrão? O remoto é explícito; a skill encapsula o passo a passo mas depende do plugin estar sempre carregado.
2. Dar ao agente permissão de **disparar** deploy (não só ler) vale a pena na Fase 1, ou manter deploy como ação humana no dashboard/git push?

---

## Referências no código

- `render.yaml` — definição do Web Service; env vars com `sync: false`.
- `apps/api/package.json` — scripts que o build do Render executa.
- `docs/sdlc/01-requisitos/US-59-api-em-producao-render.md` — serviço consumido aqui.
- `docs/adr/006-deploy-custo-zero.md` — D2 (host de processo), contexto do Free.
