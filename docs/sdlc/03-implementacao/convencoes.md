# Convenções de Implementação — AI Dungeon Master

**Auditado contra o código em:** 2026-07-28 ([US-91](../01-requisitos/US-91-auditar-convencoes-de-implementacao.md))

> **Este arquivo não é a fonte de verdade das convenções.** O canônico é o
> [AGENTS.md](../../../AGENTS.md) → *Padrões de código*. Aqui ficam só as convenções que
> **não** cabem lá e que têm caso vigente no repo hoje. Se os dois divergirem, o `AGENTS.md`
> manda — e a divergência é bug de doc, não escolha.
>
> Regra que gerou este arquivo (camada 1 da [US-83](../01-requisitos/US-83-readme-com-arquitetura-alto-nivel.md)):
> **se manter a frase verdadeira exigir editar dois lugares, a frase vira ponteiro ou some.**

---

## Estrutura do monorepo

Fonte única: [CLAUDE.md](../../../CLAUDE.md) → *Estrutura do repositório*, e o diagrama de
componentes do [README.md](../../../README.md) → *Arquitetura*.

<!-- A árvore que ficava aqui era a 3ª cópia da mesma estrutura e afirmava
     `prisma/` na raiz (o real é apps/api/prisma). Deletada na US-86: estrutura
     duplicada em N arquivos dessincroniza em N-1 deles. -->

---

## TypeScript

- Tipos de domínio compartilhados em [`packages/shared/src/types/`](../../../packages/shared/src/types)
  — é o contrato client-server; tipo usado pelos dois lados mora ali, não duplicado.
- `strict: true` vale para todos os pacotes **por herança**: só o [`tsconfig.json`](../../../tsconfig.json)
  da raiz declara, e os quatro `tsconfig.json` de app/pacote fazem `extends`. Ao criar pacote
  novo, herde — não recopie a flag.
- Importações absolutas via `paths` são convenção **do [`apps/web`](../../../apps/web/tsconfig.json)**,
  o único que declara `paths`. `apps/api` e os dois pacotes usam caminho relativo / nome de
  workspace. Siga o vizinho do diretório em que você está.

<!-- US-91: a regra "sem `any` explícito" saiu daqui. Ela contradizia o AGENTS.md e o
     CLAUDE.md, que permitem `any` COM comentário justificando. Três documentos normativos
     dizendo a mesma regra com palavras diferentes é de onde nasce o conflito de norma:
     agora a regra de `any` vive num lugar só (AGENTS.md → Regras absolutas). -->

---

## Módulos NestJS (apps/api)

Cada módulo é um domínio e contém `*.module.ts` (declaração), `*.controller.ts` (endpoints
REST) e `*.service.ts` (lógica de negócio).

**Não há camada de repositório.** Zero arquivos `*.repository.ts` no repo: o serviço fala com
o [`PrismaService`](../../../apps/api/src/prisma.service.ts) direto, por DI. Introduzir
repositório é refactor com story própria, não convenção vigente.

**Inventário vivo de módulos: as pastas de [`apps/api/src`](../../../apps/api/src).** Leia a
pasta — esta linha não lista os módulos de propósito.

<!-- US-91: a lista de módulos transcrita ficou um mês desatualizada sem ninguém notar.
     Ela citava dois módulos que NÃO EXISTEM no repo — `campaign` e `ingestion`, nunca
     criados — e omitia três reais. Lista de pasta é ponteiro, não transcrição. A mesma
     lista podre estava no AGENTS.md:61 e saiu junto. -->

---

## AI Engine (packages/ai-engine)

Inventário vivo: [packages/ai-engine/src](../../../packages/ai-engine/src).

<!-- A árvore que ficava aqui desenhava `src/tools/` com 7 arquivos. A pasta foi
     apagada na US-83 (só tinha código morto) e 0 dos 7 arquivos jamais
     existiram: as 5 tools "futuras" saíram de um comentário `// Future tools`
     que três documentos transcreveram como se fosse inventário. Deletada na
     US-86 em vez de corrigida — árvore transcrita reafirma o filesystem e
     apodrece sozinha. -->

> **Onde as tools vivem hoje:** inline em
> [apps/api/src/ai/ai.service.ts](../../../apps/api/src/ai/ai.service.ts), não neste pacote.
> Elas fecham sobre o `PrismaService` do NestJS, e o `packages/ai-engine` não tem DI.

**As tools são o Game Server, e acessam o banco direto.** Cada `execute` chama `this.dice` e
`this.prisma` — por exemplo, `rollDice` grava o `EventLog` do tipo `DICE_ROLL` com
`this.prisma.eventLog.create` dentro do próprio handler. Escrever tool que "delega ao Game
Server" seria inverter a dependência contra as 6 vigentes.

Lista das tools, contrato de cada uma e a regra de como adicionar a próxima:
[AGENTS.md](../../../AGENTS.md) → *Tools disponíveis para o DM Agent* e *Workflow de
desenvolvimento* (#4).

<!-- US-91: a "Regra de tools" que ficava aqui tinha 3 itens. #1 (schema Zod) é verdade mas
     já está no AGENTS.md; #2 ("tipo de retorno TypeScript explícito") nunca teve um caso —
     nenhum `execute` anota retorno, todos inferem; #3 ("handler chama o Game Server, nunca
     acessa o banco diretamente") é o oposto do que as 6 tools fazem. Um agente obediente
     escreveria a única tool do projeto naquele formato. Seção deletada, não corrigida. -->

---

## Banco de dados

- ORM: Prisma com migrations versionadas
- Nunca use SQL raw sem comentário justificando
- Migrations são imutáveis após aplicadas em produção
- Schema, migrations e seed vivem em [`apps/api/prisma/`](../../../apps/api/prisma) — o seed é
  [`apps/api/prisma/seed.ts`](../../../apps/api/prisma/seed.ts) (inclui o System D&D 5e SRD) e
  roda por `pnpm db:seed`. **Não existe `prisma/` na raiz do repo.**

<!-- US-91: "Seeds em `prisma/seed.ts`" era a 5ª cópia da mentira do prisma/ na raiz — as
     outras 4 foram corrigidas nas US-83/US-86. Caminho agora é link relativo: link
     quebrado o `pnpm docs:links` pega, prosa não. -->

---

## Rolagem de dados

- Implementada em [`apps/api/src/game/dice.service.ts`](../../../apps/api/src/game/dice.service.ts)
- Usa `crypto.getRandomValues` (RNG criptográfico), nunca `Math.random()`
- Fórmula suportada: `XdY+Z` (`DICE_FORMULA_RE`) — ex.: `2d6+3`, `1d20`, `4d6-1`
- Toda rolagem é registrada no `EventLog` com `type: 'DICE_ROLL'`. O payload guarda fórmula,
  dados individuais, modificador e total — **não há seed**: `getRandomValues` não tem seed por
  construção, e o `model EventLog` do [`schema.prisma`](../../../apps/api/prisma/schema.prisma)
  não tem o campo. Reproduzir uma rolagem antiga é impossível hoje; auditoria de rolagem, se
  virar requisito, é feature (e tira o `getRandomValues` junto), não conserto de doc.

---

## Variáveis de ambiente

Não há lista de env vars neste arquivo — ela apodrece mais rápido que qualquer outra coisa.

- **Quais existem:** `grep -rn "process.env\|env\[" --include=*.ts --include=*.mjs` no repo.
  A fonte viva de slug de modelo e chave de provedor é
  [`packages/ai-engine/src/model.ts`](../../../packages/ai-engine/src/model.ts).
- **Onde cada uma é lida (a armadilha):** [CLAUDE.md](../../../CLAUDE.md) → *Env em dev*. A API
  **não** tem `ConfigModule` nem `dotenv`; em dev os vars vêm do `.env` da **raiz**, via o
  wrapper `dotenv -e .env` do script `dev`. `apps/api/.env` não é lido.
- Nunca commitar `.env`. Antes de escrever "coloque em `.env`" numa spec ou US, confirme no
  código **como** aquele env var é lido.

<!-- US-91: o bloco que ficava aqui listava 6 vars sob o rótulo `# apps/api` — rótulo errado
     (apps/api/.env não é lido) e conteúdo errado: REDIS_URL, S3_BUCKET, S3_ENDPOINT e
     NEXT_PUBLIC_WS_URL não são lidas em lugar nenhum, e faltavam AUTH_SECRET, FRONTEND_URL,
     DM_CACHE_SPIKE, DM_LIVE_EVAL e as chaves de provedor. -->

---

## Commits e PRs

Regra completa: [AGENTS.md](../../../AGENTS.md) → *Workflow de desenvolvimento* (Conventional
Commits, `pnpm eval` ao tocar o AI Engine, migration junto com mudança de schema, PR citando a
US, `README.md` atualizado na mesma PR). O CI ([`ci.yml`](../../../.github/workflows/ci.yml))
roda `pnpm eval`.

<!-- US-91: esta seção repetia o AGENTS.md com outras palavras. Ficou o ponteiro; a lista
     mora num arquivo só. -->
