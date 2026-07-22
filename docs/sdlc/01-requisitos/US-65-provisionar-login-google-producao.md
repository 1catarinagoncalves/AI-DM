# US-65 — Provisionar o login Google em produção (OAuth client + segredos nos três painéis)

**Épico:** Contas e identidade — [ADR 006](../../adr/006-deploy-custo-zero.md) (custo zero, "papel, não marca")
**Fase:** 2 — Multi-dispositivo / contas
**Status:** ✅ Implementada
**Depende de:** [US-61](./US-61-login-do-jogador.md) (código do login já implementado) · [US-59](./US-59-api-em-producao-render.md) (API no Render) · [US-60](./US-60-web-em-producao-vercel.md) (web na Vercel) · [US-58](./US-58-banco-postgres-neon.md) (Postgres na Neon)
**Criada em:** 2026-07-21

---

## História

> **Como** dona do projeto,
> **quero** criar o OAuth client no Google e distribuir os segredos de autenticação pelos três painéis (Vercel, Render, local),
> **para que** o login por Google implementado na US-61 funcione de ponta a ponta em produção e em desenvolvimento.

---

## Contexto e motivação

A US-61 entregou **todo o código** do login: Auth.js no web, guard HS256 na API, `/auth/sync` com reivindicação de órfãos, propagação do token. **Falta só a configuração** — e ela é 100% manual, fora do alcance do Claude Code por dois motivos:

1. **Google Cloud Console** é uma UI de terceiros; criar o OAuth client é ponto-e-clique humano.
2. Os arquivos `.env`/`.env.local` e os painéis de secrets (Vercel/Render) guardam **credenciais** — o agente não deve nem consegue escrevê-los (o diretório dos `.env` está negado).

Sem esta US, o login está "montado mas desligado": qualquer tentativa de entrar cai em `401`, porque a API valida o JWT com um `AUTH_SECRET` que ainda não existe, e o web nem consegue iniciar o fluxo OAuth sem `AUTH_GOOGLE_ID`/`SECRET`.

### A invariante que define tudo

O **mesmo `AUTH_SECRET`** tem de existir na Vercel (web assina o JWT) **e** no Render (API verifica o JWT). É um segredo simétrico HS256 (US-61, decisão D2). Se os dois valores divergirem, a assinatura nunca confere e **todo** request autenticado falha. Rotação = trocar nos dois ao mesmo tempo.

---

## Escopo

### Dentro do escopo

- Criar um **OAuth 2.0 Client ID** (tipo "Web application") no Google Cloud, com as **Authorized redirect URIs** de localhost e produção.
- Gerar um **`AUTH_SECRET`** forte e distribuí-lo: Vercel, Render, `.env.local` (web), `.env` (api).
- Colocar **`AUTH_GOOGLE_ID`** e **`AUTH_GOOGLE_SECRET`** na Vercel e no `.env.local` do web (a API **não** precisa deles — ela nunca fala com o Google).
- Configurar a **OAuth consent screen** o mínimo para "Testing" (ou "In production" se quiser público).
- **Verificar** o fluxo completo: login em localhost, login em produção, e a reivindicação única dos órfãos (US-61 D1).

### Fora do escopo

- Qualquer mudança de **código** — a US-61 já entregou tudo. Se algo de código precisar mudar, é bug da US-61, não desta.
- **Domínio próprio / verificação de marca** no Google (só necessário para sair do modo Testing com muitos usuários).
- Rotação automática de segredos — continua manual (o ADR 006 já aceita "env vars espalhadas à mão").

---

## Pré-requisitos

- Conta Google com acesso ao [Google Cloud Console](https://console.cloud.google.com).
- Acesso de admin aos projetos **Vercel** (`ai-dm-web`) e **Render** (`ai-dm-api`).
- `openssl` disponível no terminal local (ou outra fonte de aleatoriedade forte).
- As URLs de produção já conhecidas (US-59/US-60):
  - Web: `https://ai-dm-web.vercel.app`
  - API: `https://ai-dm-api.onrender.com`

---

## Passos

### Passo 1 — Gerar o `AUTH_SECRET`

No terminal local:

```bash
openssl rand -base64 32
```

Copie a saída (ex.: `k7Jf2...=`). **Este é o único `AUTH_SECRET`** — o mesmo valor vai para os quatro lugares (Vercel, Render, `.env.local`, `.env`). Guarde-o num gerenciador de senhas até terminar a distribuição.

> Alternativa sem openssl: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.

### Passo 2 — Criar o projeto e a OAuth consent screen no Google

1. Abra o [Google Cloud Console](https://console.cloud.google.com) → crie (ou selecione) um projeto, ex.: **AI Dungeon Master**.
2. Menu → **APIs & Services** → **OAuth consent screen**.
3. **User type:** `External` → **Create**.
4. Preencha o mínimo:
   - **App name:** `AI Dungeon Master`
   - **User support email:** o seu email.
   - **Developer contact information:** o seu email.
5. **Scopes:** não adicione nada além dos padrões (`openid`, `email`, `profile` já bastam — o Auth.js pede esses por padrão). **Save and Continue**.
6. **Test users:** enquanto o app estiver em "Testing", só emails aqui listados conseguem entrar. Adicione o(s) seu(s) email(s) de teste (ex.: `catarinagoncalves2005@gmail.com`). **Save and Continue**.

> Deixe em **Testing**. Só publique ("In production") se for abrir para qualquer conta Google — aí o Google pode exigir verificação da marca.

### Passo 3 — Criar o OAuth Client ID

1. **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth client ID**.
2. **Application type:** `Web application`.
3. **Name:** `ai-dm-web` (só rótulo interno).
4. **Authorized JavaScript origins** (opcional, mas recomendável):
   - `http://localhost:3000`
   - `https://ai-dm-web.vercel.app`
5. **Authorized redirect URIs** — **exatamente** estes dois (o path do callback do Auth.js v5 é `/api/auth/callback/google`):
   - `http://localhost:3000/api/auth/callback/google`
   - `https://ai-dm-web.vercel.app/api/auth/callback/google`
6. **Create**. O Google mostra o **Client ID** e o **Client secret** — copie os dois.

> ⚠️ A redirect URI precisa bater **caractere a caractere** com a que o Auth.js envia. Sem barra final, `https` em produção, `http` em localhost. Erro aqui = `redirect_uri_mismatch` na tela do Google.

> Se usar um domínio próprio depois (US futura), adicione a redirect URI dele aqui também.

### Passo 4 — Configurar o web na Vercel

Painel Vercel → projeto `ai-dm-web` → **Settings** → **Environment Variables**. Adicione (marque os três ambientes: Production, Preview, Development):

| Nome | Valor |
|---|---|
| `AUTH_SECRET` | a saída do Passo 1 |
| `AUTH_GOOGLE_ID` | o Client ID do Passo 3 |
| `AUTH_GOOGLE_SECRET` | o Client secret do Passo 3 |

- `NEXT_PUBLIC_API_URL` já deve existir da US-60 (`https://ai-dm-api.onrender.com`). Confirme.
- **Não** é preciso `AUTH_URL` — o `auth.ts` usa `trustHost: true` e a Vercel injeta o host.
- Depois de salvar, **redeploy** o web (env vars novas só valem em builds novos).

### Passo 5 — Configurar a API no Render

Painel Render → serviço `ai-dm-api` → **Environment** → **Add Environment Variable**:

| Nome | Valor |
|---|---|
| `AUTH_SECRET` | **o MESMO valor** do Passo 1 (idêntico ao da Vercel) |

- A API **não** recebe `AUTH_GOOGLE_ID`/`SECRET` — ela nunca fala com o Google, só verifica o JWT.
- Salvar dispara um redeploy do Render. Espere ficar `live`.

> Confirmação da invariante D2: o `AUTH_SECRET` da Vercel e o do Render têm de ser **byte a byte iguais**. Cole do mesmo lugar (gerenciador de senhas), não redigite.

### Passo 6 — Configurar o ambiente local

Dois arquivos (fora do git; o diretório é ignorado):

**`apps/web/.env.local`** — adicione:

```
AUTH_SECRET=<mesmo valor do Passo 1>
AUTH_GOOGLE_ID=<Client ID do Passo 3>
AUTH_GOOGLE_SECRET=<Client secret do Passo 3>
NEXT_PUBLIC_API_URL=http://localhost:3001
```

**`apps/api/.env`** — adicione (mantendo `DATABASE_URL`, `OPENROUTER_API_KEY`, `GROQ_API_KEY` que já existem):

```
AUTH_SECRET=<mesmo valor do Passo 1>
```

> Em local, `AUTH_SECRET` também tem de ser igual entre web e api pela mesma razão. Pode ser o mesmo valor de produção ou um segredo separado só de dev — desde que web-local e api-local combinem entre si.

### Passo 7 — Verificar em localhost

```bash
pnpm dev
```

1. Abra `http://localhost:3000` → deve **redirecionar para `/login`** (login obrigatório, D3).
2. Clique **Entrar com Google** → fluxo do Google → volta autenticado ao hub.
3. Crie um personagem → inicie a aventura → jogue um turno (ação → narração streaming → HP/inventário). Regressão da US-61.
4. Clique **Sair** (canto superior) → volta a `/login`.

Checagem da **reivindicação de órfãos (D1)**, se houver personagens anônimos no banco local:
- Antes do primeiro login, havia personagens criados na era anônima (dono `guest_*@aidm.local`).
- Após o **primeiro** login Google, o hub deve mostrar **esses** personagens (foram absorvidos).
- Um **segundo** login (outra conta Google) deve começar **vazio** — não herda os órfãos.

### Passo 8 — Verificar em produção

1. Abra `https://ai-dm-web.vercel.app` → redireciona para `/login`.
2. **Entrar com Google** (use um email que esteja na lista de Test users do Passo 2.6).
3. Repita o smoke test: criar personagem, jogar um turno, sair.
4. **Multi-dispositivo:** entre com a **mesma** conta noutro navegador → deve ver **os mesmos** personagens (a identidade seguiu a conta, não o dispositivo — o coração da US-61).

> Lembrete da US-61: os bancos de **local e produção são projetos Neon diferentes**. Personagens anônimos criados em localhost **não** aparecem em produção (vivem noutro banco). A reivindicação de órfãos em produção só alcança órfãos do banco de produção.

---

## Critérios de aceite

- [ ] Existe um OAuth Client ID (Web application) no Google com as duas redirect URIs (localhost + produção) corretas.
- [ ] `AUTH_SECRET` está na Vercel **e** no Render com **valor idêntico**; `AUTH_GOOGLE_ID`/`SECRET` estão só na Vercel.
- [ ] `apps/web/.env.local` e `apps/api/.env` têm os segredos, com `AUTH_SECRET` local combinando entre web e api.
- [ ] Em localhost: acessar `/` sem sessão redireciona para `/login`; "Entrar com Google" completa e volta autenticado.
- [ ] Em produção: mesma conta Google em dois navegadores vê os mesmos personagens.
- [ ] Um turno completo (ação → narração streaming → HP/inventário) funciona autenticado, com o token propagado pelo proxy `/api/chat`.
- [ ] Primeiro login absorve os órfãos do banco daquele ambiente; segundo login (conta diferente) começa vazio.
- [ ] Sair (`signOut`) devolve o utilizador a `/login`.

---

## Notas de implementação / troubleshooting

- **`redirect_uri_mismatch`** (tela do Google): a redirect URI cadastrada não bate. Confira `http` vs `https`, porta `3000`, path `/api/auth/callback/google`, sem barra final.
- **`401` em todo request após login**: `AUTH_SECRET` diferente entre Vercel e Render (ou entre web-local e api-local). Recopie o mesmo valor e redeploy os dois.
- **"Access blocked: app not verified" / só o dono entra**: app em Testing e o email não está na lista de Test users (Passo 2.6). Adicione o email ou publique o app.
- **Env var nova não pega**: Vercel e Render só aplicam env vars em **builds novos** — force um redeploy após salvar.
- **Cold start**: o primeiro `/auth/sync` acorda Render + Neon (warm-up da US-57). Pode demorar alguns segundos no free tier.
- **Rotação do `AUTH_SECRET`**: gere novo, troque na Vercel e no Render **ao mesmo tempo**, redeploy os dois. Sessões antigas caem (têm de relogar) — esperado.
- **Endpoint `/users` órfão (herança da US-61):** o `POST /users` antigo (upsert anônimo) continua montado e **sem guard**. Não é um buraco de dados do jogador (as rotas de dados estão guardadas), mas é um endpoint de criação de utilizador aberto. Decidir se remove o `UserModule` nesta US ou noutra de limpeza.

---

## Referências no código

- `apps/web/src/auth.ts` — config do Auth.js; lê `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`.
- `apps/api/src/auth/auth.guard.ts` + `jwt.ts` — verifica o JWT com `AUTH_SECRET`.
- `apps/web/src/middleware.ts` — login obrigatório (redireciona para `/login`).
- `docs/adr/006-deploy-custo-zero.md` — segredos espalhados nos três painéis (baliza esta US).
