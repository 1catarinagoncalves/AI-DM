# US-201 — Token de desenvolvimento para agentes testarem a API e os fluxos de tela

**Épico:** 5 — Ferramentas de projeto / SDLC
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada (01/09/2026). Verificado ao vivo: `pnpm dev:token` cria a conta via
`/auth/sync` e o token passa em `GET /characters/mine` (200; sem token, 401); botão "Authorize"
funcional em `/api/docs` com o esquema `bearer`; botão de login de dev em `/login` só aparece com
`DEV_LOGIN=1` e leva a `/setup` sem OAuth do Google; `providers` de `auth.ts` não traz o provider
`dev` sem a porta dupla (teste de regressão). `pnpm test`, `pnpm typecheck` e `i18n:literals`
verdes nos dois apps; `auth.service.int.test.ts` cobre o risco 1 mas exige Postgres local
(`TEST_DATABASE_URL`) não disponível neste ambiente — não executado aqui.
**Depende de:** [US-61](./US-61-login-do-jogador.md) (AuthGuard, JWT HS256 com `AUTH_SECRET` compartilhado)
**Criada em:** 2026-09-01

**Relacionada a:**
- [US-99](./US-99-config-do-sistema-no-locale-ativo.md) — `OptionalAuthGuard`: a única rota hoje alcançável sem token.
- [US-93](./US-93-gates-baratos-de-migracao-dependencia-e-smoke.md) — mesma família: gate barato que impede um risco conhecido de sair do dev.

---

## História

> **Como** agente do Claude Code trabalhando neste repo,
> **quero** obter um token de autenticação de desenvolvimento com um comando,
> **para que** eu consiga exercitar os endpoints em `/api/docs` e percorrer os fluxos de tela do web sem depender de um login Google feito à mão pela mantenedora.

---

## Contexto e motivação

### O problema observado

Duas portas estão fechadas para um agente, pelo mesmo motivo.

**1. O Swagger não tem sequer o botão "Authorize".** O `DocumentBuilder` em
[`main.ts:22-27`](../../../apps/api/src/main.ts) chama `setTitle`, `setDescription`, `setVersion`
e `build()` — **nunca** `.addBearerAuth()`. Os controllers todos decoram com `@ApiBearerAuth()`
(`auth.controller.ts:22`, `character.controller.ts:10`, `adventure.controller.ts:22`,
`ai.controller.ts:22`), mas esse decorator só *referencia* um esquema de segurança que não foi
registrado no documento. Resultado: a UI em `http://localhost:3001/api/docs` não expõe campo
nenhum para colar um token, e todo "Try it out" numa rota de dados sai sem header
`Authorization` e volta `401 Token de autenticação ausente`
([`auth.guard.ts:19`](../../../apps/api/src/auth/auth.guard.ts)). A doc está publicada e é
inoperante — serve como leitura, não como banco de testes.

**2. Mesmo com o botão, não há de onde tirar um token.** O único emissor no repo é o web:
`signApiToken` ([`apps/web/src/auth.ts`](../../../apps/web/src/auth.ts)) assina HS256 com `jose`
dentro do callback `jwt` do Auth.js, e esse callback só roda depois de um redirect OAuth do
Google concluído num navegador com sessão humana. Um agente não faz OAuth do Google (e não deve
fazer). O token existe apenas dentro do cookie de sessão do navegador da mantenedora.

**3. As telas do web também estão trancadas.** O middleware
([`apps/web/src/middleware.ts`](../../../apps/web/src/middleware.ts)) exporta `auth` do Auth.js
sobre o matcher `/((?!api|_next/static|_next/image|favicon.ico|login|.*\..*).*)`, e o callback
`authorized` só aprova sessão com `userId`. Qualquer página que um agente abra em
`localhost:3000` — `/`, `/setup`, `/play/:id` — redireciona para `/login`, que oferece um único
botão: Google. Testar um fluxo de tela ponta a ponta (criar personagem → criar aventura →
jogar um turno) é hoje impossível sem intervenção manual em cada sessão.

### Por que a solução atual não basta

Não há atalho de dev nenhum: o `AuthGuard` é o mesmo objeto em dev e em produção, e a única
frouxidão existente — `OptionalAuthGuard` (US-99) — cobre exclusivamente `GET /systems`, que é o
`healthCheckPath` do Render. Ela não ajuda: devolve 200 anônimo, sem identidade, e todas as rotas
que importam para um teste de fluxo (`/characters`, `/adventures`, `/ai/*`) exigem `userId` real.

Falsificar o token à mão também não é caminho utilizável: o `verifyJwt`
([`apps/api/src/auth/jwt.ts`](../../../apps/api/src/auth/jwt.ts)) confere HMAC-SHA256 contra
`AUTH_SECRET`, e o `assertUserExists` do guard (`auth.guard.ts:39`) ainda exige que o `sub` tenha
linha em `User` — token com `sub` inventado leva 401 desde 25/08/2026. Ou seja: o token tem de ser
assinado com o segredo real **e** apontar para uma conta que existe no banco de dev.

### A proposta

Um comando de desenvolvimento que imprime um Bearer válido para uma conta de dev garantida no
banco, mais o registro do esquema `bearer` no documento OpenAPI para o botão "Authorize" existir.
Para as telas, um caminho de login sem OAuth **apenas em dev**, que produz a mesma sessão que o
Google produziria.

---

## Escopo

### Dentro do escopo

- **`.addBearerAuth()` no `DocumentBuilder`** de [`main.ts`](../../../apps/api/src/main.ts),
  com o nome de esquema que os `@ApiBearerAuth()` existentes referenciam (o default do Nest é
  `'bearer'` dos dois lados — confirmar que batem antes de inventar nome). Uma linha; vale em
  produção também, porque só desenha o campo na UI, não afrouxa guard nenhum.
- **Comando `pnpm dev:token`**: com a API de pé, faz o mesmo par de passos que o web faz no
  primeiro login — assina um token de bootstrap (`{ email, name }`, sem `sub`) com o
  `AUTH_SECRET` do `.env` da raiz, chama `POST /api/v1/auth/sync` com ele, e usa o `id`
  devolvido para assinar o token final (`{ sub, email }`, `exp` curto). Imprime o token cru numa
  linha, pronto para colar no "Authorize" ou para usar num header `Authorization` de `curl`.
- **Conta de dev garantida como efeito do `/auth/sync`** (decisão 2 abaixo): o upsert por email
  já é o que aquele endpoint faz, então não há acesso a banco no comando — sem Prisma, sem
  `DATABASE_URL`, sem client gerado. Sem a conta, o `assertUserExists` do guard reprova e o
  token seria válido e inútil.
- **Login de dev no web**, sem Google, atrás de porta dupla (`NODE_ENV !== 'production'` **e**
  uma env var explícita, ex. `DEV_LOGIN=1`): produz uma sessão Auth.js com `userId` igual ao
  `sub` do token acima, para o middleware liberar as páginas.
- **Conta de dev neutra na reivindicação de órfãos do `sync`** — fora da contagem de contas reais
  **e** barrada de reivindicar. Sem as duas, ela leva os personagens da era anônima e queima a
  reivindicação da mantenedora (risco 1; é a única mudança que esta story faz em código de
  produção fora do `main.ts`).
- **Gate automatizado** de que esse caminho não existe fora de dev (ver *Critérios de aceite*).
- **Documentação** em `AGENTS.md` → seção de comandos, na forma **"API → `pnpm dev:token`;
  telas → botão no `/login`"** (a separação que evita o 302 do risco 4), mais o aviso de que o
  token nunca vai para o repo nem para a mensagem de commit.

### Fora do escopo

- **Qualquer emissão de token em produção ou no Render/Vercel.** Isto é ferramenta de bancada;
  se um dia precisar de conta de serviço em produção, é outra story, com outro modelo de ameaça.
- **Contas de dev múltiplas / troca de persona.** Uma conta fixa cobre o caso de uso. Vira story
  quando um teste de propriedade cruzada (usuário A não vê ficha de B) precisar de duas.
- **Suíte de testes de fluxo pronta.** Esta story entrega a chave; escrever os roteiros de
  navegação é uso da chave, não a chave.
- **Renovar/revogar token.** `exp` curto e re-rodar o comando resolvem em dev.

---

## Modelo de dados proposto

Nenhuma tabela nova. Uma linha em `User`, criada por upsert, com email de domínio reservado para
não colidir com conta real do Google:

| Campo | Tipo | Valor |
|---|---|---|
| `email` | string (`@unique`) | `dev@ai-dm.invalid` — o TLD `.invalid` é reservado (RFC 2606), nunca vira conta Google de verdade. |
| `name` | string | `Agente de desenvolvimento` |
| `locale` | string | default do schema |

**Persistência:** tabela `User` do Postgres de dev
([`schema.prisma`](../../../apps/api/prisma/schema.prisma)), escrita pelo `POST /auth/sync`
existente ([`auth.service.ts`](../../../apps/api/src/auth/auth.service.ts)) — **não** pelo seed
(decisão 2). O upsert é por email e idempotente: rodar o comando dez vezes deixa uma linha.

---

## Critérios de aceite

- [x] Em `http://localhost:3001/api/docs` existe o botão **Authorize** e um campo de Bearer token.
      Verificado ao vivo: as 9 rotas com `@ApiBearerAuth()` mostram o cadeado (unlocked → locked
      após Authorize); `/users` (sem o decorator) não mostra.
- [x] Colado o token do comando, um "Try it out" em `GET /api/v1/characters/mine` responde **200**
      (hoje responde 401), e o mesmo request sem o token continua respondendo 401. Verificado ao
      vivo (curl direto: 200 com token, 401 sem; "Try it out" no Swagger: 200, corpo `[]`).
- [x] `pnpm dev:token` imprime **só** o token na saída padrão (sem cabeçalho, sem log), de modo que
      a saída possa ser interpolada direto num header `Authorization`. Verificado ao vivo e por
      teste (`dev-token.test.mjs`).
- [x] Rodar `pnpm dev:token` num banco vazio funciona: a conta de dev nasce pelo `/auth/sync`, e o
      token gerado atravessa o `assertUserExists`. Com a API fora do ar, o comando falha com
      mensagem que diz para subir a API — não imprime token inválido nem stack trace cru.
      Verificado ao vivo contra o Postgres de dev real (primeira execução criou a conta) e por
      teste (API fora do ar / `AUTH_SECRET` ausente, com servidor HTTP falso).
- [x] A conta de dev **não** aparece no `db:seed`: `grep` por `ai-dm.invalid` em
      [`prisma/seed.ts`](../../../apps/api/prisma/seed.ts) não casa (decisão 2 — o `render.yaml`
      roda o seed em toda build de produção).
- [x] **Não destrutivo (risco 1), nas duas ordens.** Teste de integração, não unitário — o bug
      mora na transação, e cada ordem exerce uma das duas condições:
      - *dev primeiro:* banco com personagens de convidado e nenhum login real → `pnpm dev:token`
        não move nenhum `Character.userId` nem apaga linha de `User`, e o login Google **depois**
        ainda reivindica os órfãos normalmente.
      - *dev depois:* banco com uma conta real já sincronizada e convidados órfãos → `pnpm
        dev:token` não leva nada para a conta de dev.
      Coberto em `apps/api/src/auth/auth.service.int.test.ts` (Postgres real, `pnpm test:int`) e
      espelhado como unitário em `auth.service.test.ts` (fakePrisma). O `.int.test.ts` não rodou
      neste ambiente por falta de `TEST_DATABASE_URL` local — passa no typecheck, não na execução.
- [ ] **Fonte única do segredo (risco 3):** `apps/web/.env.local` não define `AUTH_SECRET`; o
      valor vem só do `.env` da raiz. Verificado uma vez pela mantenedora — é o que faz o token do
      script e o do login de dev serem verificáveis pelo mesmo guard.
      Não verificável pelo agente: `apps/web/.env.local` é gitignored e negado à leitura — pendente
      da mantenedora (`grep -c AUTH_SECRET apps/web/.env.local`, esperado 0).
- [x] **Gates verdes (riscos 2 e 5):** `pnpm i18n:literals`, `pnpm dead` e `pnpm test` passam com
      o botão de dev e o script novo no repo — a isenção do rótulo está no `LITERAL_ALLOW` com
      motivo escrito, e o `.mjs` e seu teste têm par de scripts no `package.json`.
      `i18n:literals` e `test` (129 web + 479 api) verdes. `pnpm dead` reprova por 18 arquivos de
      `.design-sync/` sem relação com esta story (pré-existente, commit "Configurar design-sync");
      nenhum arquivo novo desta story aparece na lista.
- [x] Com `DEV_LOGIN=1` em dev, um agente chega a `/setup` no `localhost:3000` sem passar por
      Google, e a sessão do cliente traz o mesmo `userId` do token. Verificado ao vivo: clique no
      botão de dev → sessão autenticada ("Olá, Aventureiro") → link "Criar meu personagem" aponta
      para `/setup`.
- [x] **Segurança:** com `NODE_ENV=production`, o caminho de login de dev responde 404/401
      **mesmo com `DEV_LOGIN=1` definido** — as duas condições são exigidas, não alternativas.
      Verificado por teste de regressão (`auth-providers.test.ts`) contra o array `providers` real;
      não verificado com um build `next build`/`next start` completo em produção neste ambiente.
- [x] **Segurança:** o `AUTH_SECRET` nunca aparece na saída do comando nem em log; o que sai é só
      o JWT assinado.
- [x] **Eval / teste de regressão:** teste unitário que (a) o token emitido pelo comando é aceito
      por `verifyJwt` com o mesmo segredo e rejeitado com segredo diferente; (b) o provider/rota de
      login de dev não é registrado quando `NODE_ENV === 'production'`. O (b) é o teste que falha
      se alguém remover a porta dupla num refactor.
      (a) em `scripts/dev-token.test.mjs`; (b) em `apps/web/src/lib/auth-providers.test.ts`.

---

## Notas de implementação

> Dicas, não especificação. Quem implementa pode divergir com justificativa.

- **Assinar sem dependência nova.** A API já verifica HS256 com `node:crypto` à mão
  (`jwt.ts` → `createHmac`). Assinar é o mesmo caminho ao contrário: `base64url(header)` +
  `'.'` + `base64url(payload)` + `'.'` + `base64url(hmac)`. Não puxar `jose` para a API só
  para isto — o web já tem `jose`, a API deliberadamente não tem.
- **Onde o comando vive.** `scripts/dev-token.mjs`, `node` puro a partir da raiz, no molde de
  `srd/` e `lazygm/`. Com o upsert delegado ao `/auth/sync` (decisão 2), o script não importa
  Prisma nem o client gerado: precisa só de `node:crypto`, `fetch` e `AUTH_SECRET`. Não é
  `pnpm --filter api` — não toca banco.
- **`AUTH_SECRET` não se carrega sozinho.** A API não tem `ConfigModule` nem `dotenv`: o script
  precisa do wrapper `dotenv -e .env --` no `package.json` da raiz, exatamente como `db:migrate`,
  `db:seed` e `srd:ingest` fazem. Sem ele, `process.env['AUTH_SECRET']` é `undefined` e o `jwt.ts`
  lança `AUTH_SECRET ausente na API`.
- **Nome do esquema no Swagger.** `.addBearerAuth()` sem argumento registra `'bearer'`;
  `@ApiBearerAuth()` sem argumento referencia `'bearer'`. Devem bater — se não baterem, o botão
  aparece e mesmo assim o header não é enviado, que é o modo de falha mais confuso possível.
  Verificar clicando "Authorize" e olhando o request real, não só a UI.
- **Login de dev no web.** Provider `Credentials` adicionado condicionalmente ao array de
  `NextAuth({ providers: [...] })` em [`auth.ts`](../../../apps/web/src/auth.ts) (decisão 1) —
  assim toda a maquinaria de cookie/sessão continua sendo a do Auth.js, e nada de sessão é
  reimplementado.
- **Armadilha do callback `jwt`, e como resolvê-la.** Ele hoje entra pelo
  `if (profile?.email && !token.userId)` ([`auth.ts`](../../../apps/web/src/auth.ts)), e
  `profile` só existe no fluxo OAuth — num sign-in por `Credentials` o Auth.js passa `user`, e
  `profile` é `undefined`. Sem tratar isso, `token.userId` nunca é povoado, o `authorized`
  reprova, e o navegador entra em laço `/setup` → `/login` com cara de bug de middleware.

  A correção **não** é um segundo ramo com uma cópia do bloco: o bloco do `/auth/sync` já é
  genérico, consome só `{ email, name }`, e `profile`/`user` são duas fontes do mesmo par.
  Alargar a fonte, em duas linhas:

  ```ts
  async jwt({ token, user, profile, trigger, session }) {
    // ... early return do trigger === 'update' intacto
    const identity = profile ?? user
    if (identity?.email && !token.userId) {
      const bootstrap = await signApiToken({ email: identity.email, name: identity.name ?? 'Jogador' })
      // ... resto do bloco inalterado
  ```

  `profile ?? user` deixa o caminho do Google idêntico (quando há `profile`, ele ganha). E com o
  callback fazendo o sync, o `authorize` do provider de dev não precisa de `fetch` nenhum —
  devolve `{ id, email, name }` e pronto. O `id` é descartado (o callback sobrescreve com o
  `userId` real da API), mas não pode ser vazio, ou o Auth.js recusa o sign-in.
- **O que essa mudança custa em garantia.** O comentário atual justifica o `/auth/sync` como
  *"prova que a chamada veio do nosso web com um email Google verificado"*. Com o `Credentials`
  ligado, o email deixa de ser verificado pelo Google: é uma constante que o web escolheu. A
  garantia cai de "email verificado" para "veio do nosso web". Aceitável em dev — e é a razão de
  a porta dupla não ser opcional. Ao alargar a condição, **atualizar aquele comentário**: uma
  linha que passou a dizer mais do que o código garante é pior que comentário nenhum.
- **`session.accessToken` sai de graça.** O callback `session` já assina um token de API fresco a
  partir de `token.userId`. Com o `userId` povoado, a ponte que o front usa para falar com a API
  passa a funcionar no login de dev sem uma linha a mais — o agente ganha os fluxos de tela
  completos, não só as páginas renderizadas.
- **`exp` curto.** Um token de bancada com 30 dias (o que o web usa) é um segredo de longa vida
  circulando em terminal e transcript de agente. Horas, não semanas.
- **Higiene de segredo.** O token impresso é credencial completa daquela conta. Não escrever em
  arquivo dentro do repo, não colar em `.md`, não deixar em mensagem de commit. Se algum passo
  precisar guardá-lo, que seja no diretório temporário da sessão, fora do repo.

---

## Riscos de implementação (achados na revisão da story)

Em ordem de dano. O primeiro é destrutivo e não dá erro — passa verde e o estrago aparece semanas
depois, no dia em que a mantenedora logar.

### 1. A conta de dev reivindica os órfãos e queima a reivindicação da mantenedora — **destrutivo**

`sync` ([`auth.service.ts`](../../../apps/api/src/auth/auth.service.ts)) decide o primeiro login
real por `isFirstRealLogin = !existing && realUserCount === 1`, onde `realUserCount` conta todo
email que **não** termina em `@aidm.local`. `dev@ai-dm.invalid` conta como real.

O primeiro `pnpm dev:token` num banco de dev sem login Google prévio, então: cria a conta,
`realUserCount === 1`, `!existing` verdadeiro → dispara a reivindicação. Um `updateMany` move
todos os `Character` e `Adventure` dos convidados para a conta de dev, e um `deleteMany`
**apaga as contas de convidado**.

O dano real é o segundo passo. A flag anti-roubo do D1 é de tiro único: no dia em que a
mantenedora logar com o Google dela, `realUserCount` já é 2, `isFirstRealLogin` é falso, e ela
recebe uma conta vazia — com a era anônima dela pertencendo permanentemente a
`dev@ai-dm.invalid`. O mecanismo funciona exatamente como projetado (D1); só protege a parte
errada.

**Solução — duas mudanças, não uma.** Tirar a conta de dev da contagem resolve só metade: com ela
fora, o cenário *"a mantenedora já logou, e só depois alguém roda `pnpm dev:token`"* fica
`!existing` verdadeiro (a conta de dev é nova) e `realUserCount === 1` (ela) → reivindica na
mesma. As duas condições são necessárias e cobrem um cenário cada:

```ts
// US-201: sufixo da conta de bancada do `pnpm dev:token`. Não é conta de jogador.
const DEV_EMAIL_SUFFIX = '@ai-dm.invalid'
const RESERVED_EMAIL_SUFFIXES = [GUEST_EMAIL_SUFFIX, DEV_EMAIL_SUFFIX]

// (a) a conta de dev não INFLA a contagem: senão, a mantenedora logando depois dela
//     veria realUserCount === 2 e perderia a reivindicação que é dela.
const realUserCount = await tx.user.count({
  where: { NOT: { OR: RESERVED_EMAIL_SUFFIXES.map((s) => ({ email: { endsWith: s } })) } },
})

// (b) a conta de dev nunca REIVINDICA: sem isto ela leva os órfãos no cenário em que
//     nasce depois de já existir uma conta real.
const isDevAccount = user.email.endsWith(DEV_EMAIL_SUFFIX)
const isFirstRealLogin = !existing && !isDevAccount && realUserCount === 1
```

`GUEST_EMAIL_SUFFIX` e a lista de `guests` ficam intactos: a conta de dev não termina em
`@aidm.local`, então nunca entra no `deleteMany` nem tem os personagens dela reivindicados por
outra conta. É a única mudança que esta story faz em código de produção fora do `main.ts` — daí o
critério de aceite pedir teste de **integração**, com os dois cenários (conta de dev primeiro,
conta de dev depois), não um unitário.

### 2. O botão de login de dev reprova o gate de i18n

`pnpm i18n:literals` (US-102) barra texto visível escrito direto no JSX. Um botão de login de dev
tem rótulo, e o rótulo é literal. Pôr esse texto no dicionário está errado: viraria string
traduzida nos dois locales para algo que produção nunca mostra.

**Solução:** entrada no `LITERAL_ALLOW` de
[`check-jsx-literals.mjs`](../../../scripts/check-jsx-literals.mjs) — chave é o texto, valor é o
motivo, mesmo padrão da entrada `AUTH_SECRET ausente no web` que já vive lá:

```js
["Entrar como agente de desenvolvimento",
 "login/page.tsx — botão do login de dev (US-201); não é texto de produto, produção nunca o renderiza"],
```

O gate trata entrada que deixou de casar como **aviso**, não erro: se o botão sair um dia, a
linha vira ruído visível em vez de falha silenciosa.

### 3. `AUTH_SECRET` pode vir de duas fontes divergentes

O script lê o `.env` da raiz. O web lê `process.env.AUTH_SECRET`
([`auth.ts`](../../../apps/web/src/auth.ts)), que em dev chega pelo wrapper `dotenv -e .env` do
`pnpm dev` **ou** por `apps/web/.env.local`, que o Next carrega nativo. Valores diferentes nos
dois arquivos = token do script e token do login de dev assinados com segredos distintos, e um
401 no Swagger com cara de bug do script.

**Solução: fonte única, não regra de precedência.** Descobrir quem vence não resolve — resolve
não haver disputa. O `AUTH_SECRET` é segredo compartilhado entre web e API (US-61 D2), e o
`CLAUDE.md` já manda os secrets de runtime da API para o `.env` da raiz. Então: **o
`AUTH_SECRET` mora só no `.env` da raiz, e `apps/web/.env.local` não o define.** Rodando por
`pnpm dev`, o wrapper `dotenv -e .env` injeta nos dois processos filhos.

Verificação de uma vez, pela mantenedora (os dois arquivos são gitignored e negados a agente):

```bash
grep -c AUTH_SECRET apps/web/.env.local
```

Zero é o esperado. Se não for zero, apagar a linha de lá — não copiar o valor do outro, que só
adia o problema para a próxima rotação de segredo.

### 4. CSRF do sign-in por `Credentials`

O Auth.js exige um token de CSRF no corpo do POST de sign-in. Pelo navegador o `signIn()` resolve
sozinho. Um agente que tente por `curl` leva um 302 silencioso de volta ao `/login`, que lê como
"o login de dev não funciona".

**Solução: não scriptar esse POST.** Os dois caminhos desta story são separados de propósito —
`pnpm dev:token` cobre a API sem navegador nenhum, e o login de dev existe **para** os fluxos de
tela, onde o agente já está dirigindo um navegador. Clicar o botão em `/login` usa o `signIn()`
do cliente, que trata o CSRF. A documentação em `AGENTS.md` deve dizer isso na forma
"API → `dev:token`; telas → botão no `/login`", para ninguém tentar a terceira via e perder uma
sessão de debug num 302.

### 5. `pnpm dead` e o arquivo de teste do script

Todo utilitário de `scripts/` tem par `x` / `x:test` no `package.json` da raiz — é por esses
scripts que o knip enxerga os `.mjs` (a config do workspace raiz em
[`knip.jsonc`](../../../knip.jsonc) só declara o servidor do kanban como `entry`). Um
`dev-token.test.mjs` sem script declarado vira arquivo sem importador e o gate fica vermelho.

**Solução:** declarar o par, no molde de `docs:links` / `docs:links:test`. Nada de exceção no
`knip.jsonc` — a config já avisa que exceção sem motivo escrito a transforma em depósito (US-89),
e aqui não há motivo: o script tem entrada de verdade.

```json
"dev:token": "dotenv -e .env -- node scripts/dev-token.mjs",
"dev:token:test": "node --test scripts/dev-token.test.mjs"
```

### 6. `/api/docs` é público em produção — pré-existente, mas a story toca a linha

`SwaggerModule.setup` roda sem gate de ambiente ([`main.ts`](../../../apps/api/src/main.ts)): a
doc está no ar no Render hoje. O `.addBearerAuth()` não afrouxa nada — desenha um campo, e o
guard continua sendo o mesmo. Mas a story edita justo essa linha, então a decisão fica registrada
aqui em vez de seguir implícita.

**Solução: nenhuma nesta story — e é uma escolha, não um esquecimento.** A doc pública já expõe a
mesma superfície hoje; o campo de token não muda o que um estranho consegue fazer, porque ele não
tem o `AUTH_SECRET`. Fechá-la exigiria decidir entre gate de ambiente, autenticação básica ou
domínio separado — decisão de operação, com o Render no meio, que não cabe carona numa story de
ferramenta de bancada. Fica registrada como candidata a story própria.

---

## Decisões (questões em aberto resolvidas)

### 1. Provider `Credentials`, não injeção de cookie — **decidido**

A alternativa era o agente forjar o cookie de sessão a partir do token do `pnpm dev:token`. Não
dá: o cookie do Auth.js não é o JWT HS256 da API, é um **JWE encriptado** com chave derivada por
HKDF do `AUTH_SECRET`, salgada com o próprio nome do cookie. Reproduzir isso significa importar
`encode` de `next-auth/jwt` — API interna de um pacote que está em `5.0.0-beta.29`
([`apps/web/package.json`](../../../apps/web/package.json)) — e acertar o salt à mão. Um bump de
beta quebra o caminho em silêncio, com sintoma de "login de dev parou de funcionar".

O provider `Credentials` é menos código e usa a porta que o próprio Auth.js abre para isto:
sessão, cookie, expiração e o callback `session` (que já assina o `accessToken`) continuam sendo
os do fluxo normal. O preço é a armadilha do `profile` vs `user` anotada nas *Notas de
implementação* — que é uma condição a mais no callback `jwt`, não um mecanismo novo.

### 2. A conta de dev **não** entra no `db:seed` — **decidido, e é questão de segurança**

O `render.yaml` roda `pnpm --fail-if-no-match --filter api db:seed` **dentro do `buildCommand`,
em toda build de produção** ([`render.yaml`](../../../render.yaml) — o passo 6 do comentário do
build, que existe desde a US-99 para semear o config por locale). Semear a conta de dev seria
criá-la na Neon de produção a cada deploy: uma conta cujo token qualquer um com o `AUTH_SECRET`
consegue assinar, existente no banco real, atravessando o `assertUserExists`. O seed está fora de
questão.

Isso deixaria o upsert para o script — mas o script também não precisa falar com o banco: o
`POST /auth/sync` **já é** o upsert por email, e é exatamente o que o web chama no primeiro login
([`auth.controller.ts`](../../../apps/api/src/auth/auth.controller.ts)). O token de bootstrap
sem `sub` atravessa o guard de propósito (`assertUserExists` retorna cedo quando não há `userId`
— é o token que vai criar a conta). Resultado: o comando não importa Prisma, não lê
`DATABASE_URL`, não depende do client gerado — só de `AUTH_SECRET` e da API de pé. E, por não
existir caminho de criação fora do `/auth/sync`, a conta de dev só nasce onde alguém rodou o
comando.

### 3. Só teste unitário — o CI já roda — **decidido**

Nenhuma linha nova no `ci.yml`. O job `ci` já executa `pnpm test`
([`.github/workflows/ci.yml`](../../../.github/workflows/ci.yml)), que é `pnpm --recursive test` e
portanto inclui o vitest de `apps/web`. Um teste lá que afirme "com `NODE_ENV=production` o array
de providers não contém o de dev" roda em todo push sem configuração adicional — o gate mais
barato possível é o que já está ligado, que é o espírito da US-93. Um passo próprio no `ci.yml`
custaria um job a mais para verificar o mesmo `expect`.

Fica o cuidado de o teste ler o array de providers de verdade e não uma cópia da condição: um
teste que reimplementa `NODE_ENV !== 'production' && DEV_LOGIN` passa mesmo depois de alguém
apagar a condição do `auth.ts`.

---

## Referências no código

- [`apps/api/src/main.ts`](../../../apps/api/src/main.ts) — `DocumentBuilder` sem `.addBearerAuth()`; é a linha que falta para o botão existir.
- [`apps/api/src/auth/auth.guard.ts`](../../../apps/api/src/auth/auth.guard.ts) — `AuthGuard` (401 sem Bearer) e `assertUserExists` (401 com `sub` órfão).
- [`apps/api/src/auth/jwt.ts`](../../../apps/api/src/auth/jwt.ts) — `verifyJwt`: o formato exato que o token de dev tem de produzir, e o `AUTH_SECRET` que ele exige.
- [`apps/api/src/auth/current-user.decorator.ts`](../../../apps/api/src/auth/current-user.decorator.ts) — `payloadToUser`: quais claims viram identidade (`sub`, `email`, `name`).
- [`apps/api/src/auth/auth.controller.ts`](../../../apps/api/src/auth/auth.controller.ts) — `POST /auth/sync`, o upsert por email que o comando e o login de dev reusam (decisão 2).
- [`apps/api/src/auth/auth.service.ts`](../../../apps/api/src/auth/auth.service.ts) — o upsert em si (único caminho por onde a conta de dev nasce) e a reivindicação de órfãos do D1, que é o risco 1.
- [`scripts/check-jsx-literals.mjs`](../../../scripts/check-jsx-literals.mjs) — `LITERAL_ALLOW`: onde o rótulo do botão de dev tem de ser isentado (risco 2).
- [`knip.jsonc`](../../../knip.jsonc) — workspace raiz: por que o `.mjs` novo precisa de script no `package.json` (risco 5).
- [`render.yaml`](../../../render.yaml) — `db:seed` dentro do `buildCommand`: a razão pela qual a conta de dev não pode entrar no seed.
- [`.github/workflows/ci.yml`](../../../.github/workflows/ci.yml) — `pnpm test` recursivo: o gate onde o teste de porta dupla já roda, sem passo novo (decisão 3).
- [`apps/web/src/auth.ts`](../../../apps/web/src/auth.ts) — `signApiToken` e o callback `jwt`: o emissor atual, hoje só alcançável via OAuth do Google.
- [`apps/web/src/middleware.ts`](../../../apps/web/src/middleware.ts) — o matcher que tranca todas as páginas sem `userId` na sessão.
- [`package.json`](../../../package.json) — padrão `dotenv -e .env --` dos scripts que precisam do `.env` da raiz.
