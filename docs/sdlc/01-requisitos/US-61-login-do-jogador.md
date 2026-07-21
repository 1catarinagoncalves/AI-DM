# US-61 — Login do jogador (conta persistente, sessão que sobrevive ao dispositivo)

**Épico:** Contas e identidade — [ADR 006](../../adr/006-deploy-custo-zero.md) (custo zero) · [ADR 002](../../adr/002-memoria-de-sessao.md) (sessão)
**Fase:** 2 — Multi-dispositivo / contas (fora do MVP single-player da Fase 1)
**Status:** 🚧 Em progresso
**Depende de:** [US-58](./US-58-banco-postgres-neon.md) (Postgres público) · [US-60](./US-60-web-em-producao-vercel.md) (web público na Vercel)
**Habilita:** warm-up no submit do login (futuro); **por ora** o warm-up vive na criação e na seleção de personagem (ver [US-57](./US-57-warmup-do-servidor-na-entrada.md) e a discussão da US-60)
**Criada em:** 2026-07-20

---

## História

> **Como** jogador,
> **quero** entrar com uma conta minha,
> **para que** meus personagens e aventuras me sigam em qualquer navegador ou dispositivo, sem depender do `localStorage` daquela máquina.

---

## Contexto e motivação

### O problema observado

Hoje **não há login**. O [SetupWizard](../../apps/web/src/components/setup/SetupWizard.tsx) cria um `User` anônimo com `randomGuestId()` como e-mail e `'Jogador'` como nome, e guarda o `userId` no `localStorage` do navegador ([session.ts](../../apps/web/src/lib/session.ts)). Consequências:

- **Identidade presa ao dispositivo.** Trocar de navegador, limpar o storage ou abrir no celular = perde-se o acesso aos personagens. Não há como "voltar à minha conta".
- **A API confia em `userId` do corpo da requisição.** O `userId` viaja no body ([api.ts](../../apps/web/src/lib/api.ts), `createCharacter`, etc.) e a API o aceita sem verificar. É **spoofável**: qualquer cliente pode enviar o `userId` de outro e ler/escrever a ficha alheia. Tolerável enquanto tudo é anônimo e single-player; inaceitável assim que "conta" passa a significar algo.

### Por que o modelo atual já quase acomoda login

O `User` no [schema.prisma](../../apps/api/prisma/schema.prisma) já tem `email @unique` e `name`. Um login OAuth entrega exatamente esses dois campos. O trabalho não é remodelar dados — é **trocar a origem da identidade**: de "um `userId` inventado no cliente" para "um `userId` derivado de um token verificado".

### A proposta

Adicionar login por provedor externo (OAuth), fazer *upsert* do `User` por e-mail no primeiro acesso (substituindo o `randomGuestId()`), e passar a **API a derivar o `userId` de um token verificado** em vez de confiar no corpo. A escolha central desta US é **qual solução de autenticação** usar — avaliada abaixo.

---

## Decisão de arquitetura — qual autenticação

### A restrição que define a escolha

O login mora naturalmente no **web** (Next.js na Vercel: renderiza UI, recebe o redirect do OAuth, guarda o cookie de sessão). Mas quem é dono do banco e precisa **autorizar** cada operação é a **API** (NestJS no Render). Portanto, qualquer opção tem de deixar a **API verificar a identidade do chamador** — um JWT que ela valide, ou uma sessão que ela consiga conferir. Sem isso, o login é decorativo: a API continua confiando no `userId` do corpo.

Second: o [ADR 006](../../adr/006-deploy-custo-zero.md) manda **custo zero** e **desacoplamento** ("a decisão é o papel, não a marca"). Uma solução que amarre a identidade a um fornecedor específico contraria o princípio que mantém web/api/db trocáveis.

### Opções avaliadas

| Opção | O que é | Custo | Encaixe no stack | API (Render) verifica o token? | Risco / atrito |
|---|---|---|---|---|---|
| **A. Auth.js (NextAuth v5) + provedor Google** ✅ | Biblioteca de auth self-hosted **dentro** do `apps/web`; provider Google faz "entrar com Google". Sessão JWT ou via Prisma adapter na Neon | **US$ 0**, sem serviço novo | Nativo em Next 15 / Vercel; sem vendor extra | Sim — JWT (HS256 com segredo compartilhado, ou JWKS) repassado no `Authorization: Bearer`; guard no NestJS valida | Setup do OAuth client no Google Cloud (redirect URIs); plumbing do guard no NestJS |
| **B. Neon Auth** (Stack Auth gerenciado) | Auth gerenciado acoplado à Neon; usuários sincronizam para `neon_auth.users_sync`, que dá join direto com nosso `User` | US$ 0 no free tier da Neon | Bom no Next; SDK React pronto | Menos trivial — a API teria de validar tokens do Stack Auth (menos documentado fora do Next) | **Amarra a identidade ao fornecedor do banco** — contraria o "papel, não a marca" do ADR 006; um `neon_auth` schema + semântica de sync a mais para raciocinar |
| **C. Google OAuth "cru"** (sem biblioteca) | Implementar o fluxo OAuth2 na mão: troca de code, verificação de token, cookie de sessão, CSRF | US$ 0 | Só o que você escrever | Sim, mas tudo manual | **Mais trabalho e mais footguns de segurança** (CSRF, validação de token, rotação). Reinventa o que a opção A já resolve testada |
| **D. Clerk** (free tier ~10k MAU) | Auth-as-a-service hospedado, DX excelente, componentes prontos | US$ 0 até 10k MAU | Drop-in em Next | Sim (JWT verificável por JWKS) | **Mais um fornecedor/painel** e dependência SaaS; vai contra o espírito "três contas, desacoplado" do ADR 006. Fica como plano B se A custar caro em esforço |

> Outras da mesma família (**Better Auth**, **Supabase Auth**) foram descartadas de saída: Better Auth é TS-native e capaz, mas mais novo e sem ganho sobre o Auth.js aqui; Supabase Auth puxaria a plataforma Supabase que **não** usamos (banco é Neon).

### Recomendação: **Opção A — Auth.js (NextAuth v5) com provider Google**

Motivos:

1. **"Entrar com Google", feito certo.** É exatamente o login que se quer, mas através de uma biblioteca que já cuida de sessão, CSRF e verificação — em vez de escrever OAuth2 na mão (opção C).
2. **Zero serviço novo, zero fornecedor a mais.** Roda dentro do `apps/web` que já está na Vercel. Preserva o "custo zero / três contas / desacoplado" do ADR 006. Ao contrário da opção B, **não prende a identidade ao fornecedor do banco**; ao contrário da D, não adiciona um SaaS de auth.
3. **Encaixa no dado que já existe.** No primeiro login, *upsert* do `User` por `email @unique` — o campo já está no schema. O `randomGuestId()` sai; o e-mail real do Google entra.
4. **Provedor-agnóstico.** Adicionar GitHub, e-mail mágico ou outro provider depois é config, não re-arquitetura.
5. **Fecha o buraco de segurança de propósito.** O ponto do login é a API **parar de confiar** no `userId` do corpo e passar a derivá-lo de um JWT verificado. Auth.js emite esse JWT; um guard no NestJS o valida.

---

## Escopo

### Dentro do escopo

- **Login com Google, obrigatório** via Auth.js (NextAuth v5) no `apps/web`, com tela de login própria. **Não há modo convidado** — a autenticação é a única porta; todo request tem dono verificado (decisão D3 abaixo).
- **Upsert do `User` por e-mail** no primeiro acesso; o fluxo anônimo (`randomGuestId()`) é **removido** — a identidade passa a nascer sempre do Google.
- **Reivindicação única dos personagens existentes.** O **primeiro login** absorve **todos** os personagens/aventuras órfãos (criados na era anônima) para a sua conta. Depois disso, cada personagem fica ligado à sua conta e nenhum login futuro herda órfãos (decisão D1 abaixo).
- **Guard de verificação na API:** o NestJS passa a derivar o `userId` de um JWT verificado (`Authorization: Bearer`), não do corpo. Rotas de `character`/`adventure`/`ai` exigem token válido.
- **Propagação do token:** [api.ts](../../apps/web/src/lib/api.ts) e o proxy [route.ts](../../apps/web/src/app/api/chat/route.ts) anexam o `Authorization` nas chamadas à API.
- **Sessão pós-login:** substituir o `session.ts` baseado em `localStorage` pela sessão do Auth.js (cookie httpOnly); manter o roteamento para `/play/[adventureId]`.
- **Warm-up (interino) na criação e na seleção de personagem.** Enquanto o login **não existe**, o aquecimento do cold start (US-57) dispara em dois pontos, ambos anteriores ao primeiro turno:
  - **Criação de personagem** — [SetupWizard](../../apps/web/src/components/setup/SetupWizard.tsx): o wizard já bate no banco ao montar (`listSystems`, `createUser`); garantir que esse toque acorde Render + Neon logo na entrada do fluxo, e não só no fim.
  - **Seleção de personagem** — [HomeHero](../../apps/web/src/components/HomeHero.tsx): o hub já chama `listCharacters(userId)` ao montar ([api.ts](../../apps/web/src/lib/api.ts)), o que toca o banco; confirmar que serve de warm-up efetivo enquanto o jogador escolhe a ficha.
  - **Quando o login entrar**, o ponto natural passa a ser o **submit do login** (janela de cold start ainda maior, coberta enquanto o jogador navega o pós-login). A criação/seleção continuam como reforço.

### Fora do escopo

- **Multiplayer / mesas compartilhadas** — continua single-player; login é sobre *recuperar minha conta*, não jogar junto.
- **Papéis/permissões finas** (admin, GM vs jogador) — só "dono do próprio dado" nesta US.
- **E-mail/senha próprios, magic link, outros providers** — só Google nesta primeira volta; a arquitetura deixa a porta aberta.
- **Modo convidado / anônimo** — removido; login é obrigatório (D3).
- **Reivindicação recorrente de órfãos** — só o **primeiro** login absorve órfãos; não há "reivindicar" em logins seguintes (D1).

---

## Critérios de aceite

> **Legenda (implementado 2026-07-21):** `[x]` = código pronto e verificado por teste automatizado/typecheck. `[ ]` marcado com _(ao vivo: US-65)_ = código pronto, mas a verificação de ponta a ponta depende dos segredos/OAuth client provisionados na [US-65](./US-65-provisionar-login-google-producao.md).

- [ ] Existe uma tela de login; "entrar com Google" completa o fluxo OAuth e retorna ao app autenticado. _(tela e fluxo prontos — [login/page.tsx](../../apps/web/src/app/login/page.tsx), [auth.ts](../../apps/web/src/auth.ts); a conclusão do OAuth depende das credenciais — ao vivo: US-65)_
- [x] **Login é obrigatório:** sem sessão autenticada, o app não chega às telas de personagem/jogo (não há caminho de convidado). _(middleware [middleware.ts](../../apps/web/src/middleware.ts) redireciona para `/login`; guard da API barra as rotas de dados; fluxo anônimo removido — D3)_
- [ ] No primeiro login, um `User` é criado (ou reencontrado) por `email @unique`; o mesmo Google reentra na **mesma** conta em qualquer navegador/dispositivo. _(upsert por email em [auth.service.ts](../../apps/api/src/auth/auth.service.ts) via `/auth/sync`; reentrada cross-device — ao vivo: US-65)_
- [x] **Reivindicação única:** o primeiro login existente absorve **todos** os personagens/aventuras órfãos; um segundo login (conta diferente) **não** herda nada — começa vazio. _(D1 implementado e testado — [auth.service.test.ts](../../apps/api/src/auth/auth.service.test.ts))_
- [x] **Absorção da sessão local:** os personagens da era anônima (dono `guest_*@aidm.local`) são reatribuídos à conta Google no primeiro login, desde que estejam no mesmo banco. _(mesmo mecanismo do D1 — claim varre todos os `User` convidados do banco; o `localStorage` de identidade foi removido)_
- [x] A API valida o token via **HS256** (segredo `AUTH_SECRET` compartilhado web↔api) e **rejeita** requisições sem token válido nas rotas de dados do jogador; o `userId` usado é o do token, **não** o do corpo. _(verificação em [jwt.ts](../../apps/api/src/auth/jwt.ts)/[auth.guard.ts](../../apps/api/src/auth/auth.guard.ts), testada — [jwt.test.ts](../../apps/api/src/auth/jwt.test.ts), [auth.guard.test.ts](../../apps/api/src/auth/auth.guard.test.ts); controllers derivam o dono do token)_
- [ ] Um jogador em outro navegador, após login, vê **seus** personagens e aventuras (a identidade seguiu a conta, não o dispositivo). _(implementado; verificação multi-dispositivo — ao vivo: US-65)_
- [x] Enviar o `userId` de outra pessoa no corpo **não** dá mais acesso aos dados dela (o buraco spoofável está fechado). _(userId forçado a partir do token + checagem de posse em character/adventure/ai; corpo ignorado)_
- [x] **Por ora (sem login):** o warm-up (US-57) dispara na criação ([SetupWizard](../../apps/web/src/components/setup/SetupWizard.tsx)) e na seleção de personagem ([HomeHero](../../apps/web/src/components/HomeHero.tsx)). **Com login:** o `/auth/sync` no submit do login toca o banco e serve de warm-up adicional. _(chamadas de warm-up preservadas; `listSystems`/`listCharacters` no mount seguem tocando o banco)_
- [ ] **Regressão:** um turno completo (ação → narração em streaming → HP/inventário) continua funcionando autenticado, com o token propagado pelo proxy `/api/chat`. _(token propagado — [route.ts](../../apps/web/src/app/api/chat/route.ts) via [server-auth.ts](../../apps/web/src/lib/server-auth.ts); turno completo ao vivo: US-65)_

---

## Notas de implementação

- **A API precisa validar, não só receber.** O núcleo do trabalho é o guard no NestJS. **Decidido (D2): JWT HS256 com segredo compartilhado** — `AUTH_SECRET` como env var na Vercel **e** no Render; Auth.js emite, o guard verifica com o mesmo segredo. O `AUTH_SECRET` vira segredo crítico (rotação = reemitir em ambas as plataformas ao mesmo tempo).
- **`userId` sai do corpo.** Após o guard, `character`/`adventure`/`ai` derivam o dono do `req.user`. Ver [character.controller.ts](../../apps/api/src/character/character.controller.ts) e [ai.controller.ts](../../apps/api/src/ai/ai.controller.ts).
- **CORS + credenciais.** [main.ts:9](../../apps/api/src/main.ts) já lê `FRONTEND_URL`; se a sessão usar cookie cross-site, habilitar `credentials` no CORS e `SameSite`/`Secure` corretos. Se for `Bearer` puro, o CORS atual basta.
- **Upsert por e-mail.** Trocar o `randomGuestId()` do [SetupWizard](../../apps/web/src/components/setup/SetupWizard.tsx) por *upsert* pelo e-mail do Google; o `User.email @unique` já garante idempotência.
- **Reivindicação única dos órfãos (D1).** Órfão = `Character`/`Adventure` cujo dono é um `User` da era anônima (e-mail `randomGuestId()`). No **primeiro** login, reatribuir todos os órfãos ao `User` real (um `UPDATE` de `userId`/`creatorId`; considerar apagar os `User` anônimos esvaziados). Guardar uma flag de "reivindicação já feita" (ex.: primeira conta real criada, ou coluna/registro de controle) para os logins seguintes **não** varrerem órfãos — evita que a 2ª conta roube o que era da 1ª. Rodar dentro de transação.
- **Local e produção são projetos Neon DIFERENTES (verificado 2026-07-21).** O `DATABASE_URL` local usa host `*.neon.tech`, mas **não** o mesmo projeto que o Render (produção = `purple-wave-53471231`). Prova: uma consulta ao banco de produção retornou **0 `Character` / 0 `Adventure`** — os personagens criados em `localhost` **não estão lá**. Duas consequências: (1) os personagens locais **não** são reivindicáveis pelo login em produção — vivem noutro banco; a reivindicação (D1) só alcança órfãos que estejam no mesmo banco do serviço. (2) O critério "absorção da sessão local" só se aplica quando o personagem anônimo está no banco que o login usa. **Ação sugerida:** decidir se dev deve apontar para o banco de produção (um único banco, com o risco de dev escrever em prod) ou manter separados (então dados locais são descartáveis e não migram). Enquanto separados, "reivindicar personagens do localStorage" só funciona para quem os criou já contra o banco de produção.
- **Sem caminho de convidado (D3).** Remover o fluxo anônimo do [SetupWizard](../../apps/web/src/components/setup/SetupWizard.tsx) e proteger as rotas do app (middleware do Next redireciona não-autenticado para `/login`). O guard da API já barra o resto — as duas camadas se reforçam.
- **Segredos em três painéis.** O ADR 006 já alerta que env vars vivem espalhadas (Vercel/Render/Neon). `AUTH_SECRET`, `GOOGLE_CLIENT_ID`/`SECRET` entram nesse mesmo regime manual.
- **Warm-up interino reusa chamadas que já tocam o banco.** Nem SetupWizard nem HomeHero precisam de endpoint `/health` novo — ambos já disparam queries ao montar (`listSystems`/`createUser` e `listCharacters`). O trabalho é garantir que esse toque aconteça **cedo** (no mount da tela, não só ao confirmar) para acordar Render + Neon antes de o jogador chegar ao turno. Mesmo princípio da US-57: o aquecimento tem de tocar o Postgres, e essas chamadas já tocam.

---

## Decisões (resolvidas)

- **D1 — Reivindicação única dos órfãos.** O **primeiro** login absorve **todos** os personagens/aventuras da era anônima para a sua conta. A partir daí cada personagem fica ligado à sua conta e nenhum login posterior herda órfãos. Rejeitado o "merge só com sessão local ativa" (deixaria órfãos para trás em outros dispositivos) e o "descartar tudo" (perderia o histórico da demo). Detalhe de implementação e a flag anti-roubo nas notas acima.
- **D2 — HS256 (segredo compartilhado).** A API valida o JWT com `AUTH_SECRET` compartilhado entre Vercel e Render. Escolhido pela simplicidade no MVP; JWKS do Google fica como evolução se/quando o acoplamento pelo segredo incomodar.
- **D3 — Login obrigatório.** Não há modo convidado; a autenticação é a única porta. Simplifica a autorização (todo request tem dono verificado) ao custo de atrito na entrada — aceito para esta fase.

_Nenhuma questão em aberto remanescente._

---

## Referências no código

- `apps/web/src/lib/session.ts` — sessão local em `localStorage` (a ser substituída pela do Auth.js).
- `apps/web/src/components/setup/SetupWizard.tsx` — `randomGuestId()` + `api.createUser` (origem anônima da identidade, ~linha 84); tela de **criação** = ponto de warm-up interino.
- `apps/web/src/components/HomeHero.tsx` — hub de **seleção** de personagem; `listCharacters(userId)` no mount = ponto de warm-up interino.
- `apps/web/src/lib/api.ts` — chamadas que hoje mandam `userId` no corpo (a ganhar `Authorization`).
- `apps/web/src/app/api/chat/route.ts` — proxy SSE (a propagar o token).
- `apps/api/src/main.ts` — CORS por `FRONTEND_URL`; ponto onde entra o guard global/auth.
- `apps/api/prisma/schema.prisma` — `User.email @unique` + `name` (encaixe pronto para OAuth).
- `docs/adr/006-deploy-custo-zero.md` — custo zero + "papel, não marca" (baliza a escolha do provedor de auth).
