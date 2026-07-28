# US-91 — Convenções de Implementação (e o bloco Backend do AGENTS.md) deixam de descrever um projeto que não é este

**Épico:** 0 — Infra e documentação
**Fase:** 1 — MVP single-player
**Status:** 🚧 Em progresso
**Depende de:** nenhuma. A [US-88](./US-88-gate-de-identificadores-inexistentes-nos-docs-normativos.md) entrou em 28/07/2026 e **não cobriu nada daqui**: o gate dela só acende em camelCase, e os achados deste arquivo são minúscula (`campaign`), PascalCase (`BullMQ`, `Socket.IO`) ou prosa semântica. Ela corrigiu o bloco *Frontend* do `AGENTS.md`, vizinho ao *Backend* que esta story trata — ver *A mesma lista mentindo em dois arquivos*.
**Nasceu de:** sessão de 28/07/2026, durante a [US-86](./US-86-gate-de-caminhos-em-arvores-de-diretorio-nos-docs.md). Ao apagar as duas árvores de diretório de [`convencoes.md`](../03-implementacao/convencoes.md), ficou visível que **o resto do arquivo tem o mesmo defeito das árvores** — e que o gate daquela story não pegaria nenhum deles. A US-86 registrou a dívida em *Fora do escopo* e a promoveu a esta story.
**Relacionada a:** [US-83](./US-83-readme-com-arquitetura-alto-nivel.md) (mesmo defeito no README, mesmo antídoto — camada 1: não escrever o fato), [US-90](./US-90-readme-de-evals-com-mapa-do-subsistema.md) (mesmo padrão: doc de subsistema que apodreceu sozinha), [US-88](./US-88-gate-de-identificadores-inexistentes-nos-docs-normativos.md) (o gate que pegaria os identificadores inventados).
**Criada em:** 2026-07-28

---

## História

> **Como** dev (ou agente) que abre *Convenções de Implementação* para saber como escrever código neste repo,
> **quero** que cada regra ali descreva o repo que existe,
> **para que** obedecer à doc não produza o único arquivo do projeto naquele formato.

---

## Contexto e motivação

### O problema observado

[`convencoes.md`](../03-implementacao/convencoes.md) está marcado **"Atualizado em: 2026-06-27"** — um mês e ~30 user stories atrás. Auditoria de 28/07/2026, cada linha medida contra o código:

| O que o arquivo afirma | O que o repo tem | Onde verificar | Estado |
|---|---|---|---|
| Módulos contêm `*.repository.ts` (acesso ao banco) | **0 arquivos** `*.repository.ts` no repo; serviço fala com `PrismaService` direto | [`apps/api/src`](../../../apps/api/src) | ❌ |
| Módulos principais: `game`, `campaign`, `character`, `adventure`, `ai`, `ingestion` | `campaign` e `ingestion` **não existem**; faltam `auth`, `system`, `user` | [`apps/api/src`](../../../apps/api/src) | ❌ |
| Regra de tools #3: *"handler chama o Game Server (nunca acessa o banco diretamente)"* | As 6 tools **são** o Game Server e usam `this.prisma` — o comentário do código diz isso com todas as letras | [`ai.service.ts:348`](../../../apps/api/src/ai/ai.service.ts) | ❌ |
| Regra de tools #2: tipo de retorno TypeScript explícito | Nenhum `execute` anota retorno; todos inferem | [`ai.service.ts:359`](../../../apps/api/src/ai/ai.service.ts) | ❌ |
| Seeds em `prisma/seed.ts` | [`apps/api/prisma/seed.ts`](../../../apps/api/prisma/seed.ts) — **5ª cópia** da mentira do `prisma/` na raiz | — | ❌ |
| *"Toda rolagem é registrada no EventLog **com seed** para auditoria"* | Registro sim (`DICE_ROLL`); **seed não existe** — nem no payload nem no schema, e `crypto.getRandomValues` não tem seed por construção | [`ai.service.ts:378`](../../../apps/api/src/ai/ai.service.ts), [`schema.prisma:117`](../../../apps/api/prisma/schema.prisma) | ❌ |
| Bloco de env: `REDIS_URL`, `S3_BUCKET`, `S3_ENDPOINT`, `NEXT_PUBLIC_WS_URL` | Nenhuma das 4 é lida em lugar nenhum. Faltam as vivas: `AUTH_SECRET`, `DATABASE_URL`, as 5 chaves de provedor, `DM_CACHE_SPIKE`, `DM_LIVE_EVAL`, `JUDGE_*` | `grep process.env` | ❌ |
| O bloco de env é rotulado `# apps/api` | `apps/api/.env` **não é lido** — a API não tem `ConfigModule` nem `dotenv`; em dev os vars vêm do `.env` da **raiz** | [`CLAUDE.md`](../../../CLAUDE.md) → *Env em dev* | ❌ |
| Importações absolutas via `paths` no `tsconfig` | Só [`apps/web/tsconfig.json`](../../../apps/web/tsconfig.json) declara `paths`; api e os dois pacotes, não | — | ⚠️ parcial |
| *"Sem `any` explícito"* | [`CLAUDE.md`](../../../CLAUDE.md) e o [`AGENTS.md`](../../../AGENTS.md) permitem `any` **com comentário justificando** | — | ⚠️ conflito entre docs normativos |
| `strict: true` em todos os `tsconfig.json` | Verdade **por herança**: só a [raiz](../../../tsconfig.json) declara; os 4 fazem `extends` | — | ✅ |
| Tipos de domínio em `packages/shared/src/types/` | Existe | [`packages/shared/src/types`](../../../packages/shared/src/types) | ✅ |
| Regra de tools #1: schema Zod | As 6 tools usam `parameters: z.object(...)` | [`ai.service.ts:353`](../../../apps/api/src/ai/ai.service.ts) | ✅ |
| Rolagem em `dice.service.ts`, com `crypto.getRandomValues`, fórmula `XdY+Z` | Confere, as três | [`dice.service.ts`](../../../apps/api/src/game/dice.service.ts) | ✅ |
| Commits/PRs (Conventional Commits, `pnpm eval`, migration junto, PR cita a US) | Confere; `pnpm eval` inclusive roda no CI | [`ci.yml`](../../../.github/workflows/ci.yml) | ✅ |

**Placar: 8 erradas, 2 parciais, 5 certas.** E o arquivo é *normativo* — ele não descreve, ele **manda**.

### Por que a solução atual não basta

Nenhum dos três gates existentes pega o que sobrou, e isso não é falha deles:

| Gate | O que cobre | Por que não pega |
|---|---|---|
| `pnpm docs:links` ([US-79](./US-79-consertar-links-quebrados-na-documentacao.md)) | destino de link relativo | `campaign` e `*.repository.ts` não são caminho, são nome em prosa |
| `pnpm docs:shape` ([US-83](./US-83-readme-com-arquitetura-alto-nivel.md)) | forma do sistema vs. README | vigia o README, não este arquivo |
| Gate de árvore ([US-86](./US-86-gate-de-caminhos-em-arvores-de-diretorio-nos-docs.md)) | entrada de árvore em fence | as árvores daqui já foram apagadas; o resto é prosa |

| Gate de identificador ([US-88](./US-88-gate-de-identificadores-inexistentes-nos-docs-normativos.md)) | nome camelCase em backtick, nos 3 `.md` da raiz | `campaign`, `ingestion`, `*.repository.ts`, `BullMQ`, `Socket.IO`: nenhum é camelCase; e o corpus é `AGENTS.md`/`CLAUDE.md`/`README.md`, não `docs/` |

**Correção de 28/07/2026, medida com o gate já implementado.** Esta seção afirmava que a US-88 *"pegaria três achados (`*.repository.ts`, `campaign`, `ingestion`) se estendida a este arquivo"*. **Falso, e por construção:** a regex do gate é `/^[a-z][a-z0-9]*[A-Z][A-Za-z0-9]*$/` — exige maiúscula interna, justamente para matar o ruído de `pnpm`/`tsc`/caminho. `campaign` e `ingestion` não têm; `*.repository.ts` tem ponto e asterisco. **A US-88 cobre zero achados deste arquivo.** Todos os 8 são afirmação semântica ou nome fora da regex — *"nunca acessa o banco diretamente"*, *"com seed para auditoria"* — que só uma pessoa lendo o código reprova. Fica registrado como o erro que era: previsão sobre gate não escrito, feita antes de existir a regex.

### A mesma lista mentindo em dois arquivos (achado de 28/07/2026, durante a US-88)

A lista de módulos não está só no `convencoes.md`. O [`AGENTS.md:61`](../../../AGENTS.md), seção *Backend*, tem a **mesma transcrição, igualmente podre**:

| Arquivo | O que lista | Inexistentes | Reais que faltam |
|---|---|---|---|
| [`convencoes.md`](../03-implementacao/convencoes.md) | `game`, `campaign`, `character`, `adventure`, `ai`, `ingestion` | `campaign`, `ingestion` | `auth`, `system`, `user` |
| [`AGENTS.md:61`](../../../AGENTS.md) | `game`, `campaign`, `character`, `ai`, `ingestion` | `campaign`, `ingestion` | `adventure`, `auth`, `system`, `user` |

Reais em [`apps/api/src`](../../../apps/api/src), medidos hoje: `adventure`, `ai`, `auth`, `character`, `game`, `system`, `user`.

**E não é só a linha da lista: o bloco inteiro está podre** (medido em 28/07/2026, depois da US-88 entregue). As duas linhas seguintes afirmam infraestrutura que não existe:

| `AGENTS.md` → *Backend* | O que o repo tem | Onde verificar |
|---|---|---|
| `:63` *"BullMQ para filas (ingestão de livros, sumarização de memória)"* | **Zero hits** de `bullmq` em `package.json` e `.ts` do repo, fora `node_modules`. Não há fila nenhuma — e "ingestão de livros" é o módulo `ingestion`, que também não existe | `grep -rni bullmq` |
| `:64` *"Socket.IO para salas de campanha em tempo real"* | **Zero hits** de `socket.io` nem `@nestjs/websockets`. O transporte é SSE (`text/event-stream`) — e o [`CLAUDE.md`](../../../CLAUDE.md) já diz isso, então os dois docs normativos se contradizem | [`api/chat/route.ts:28`](../../../apps/web/src/app/api/chat/route.ts) |

Mesmo gênero do `useChat` que a [US-88](./US-88-gate-de-identificadores-inexistentes-nos-docs-normativos.md) corrigiu poucas linhas acima: desenho que não foi adiante, com o código tendo seguido outro caminho. **Nenhuma das três acende no gate da US-88**, e por construção: `campaign`/`ingestion` são minúsculas sem maiúscula interna, `BullMQ` e `Socket.IO` são PascalCase/com ponto — todas fora da regex de camelCase. Por isso o escopo aqui é o **bloco** (`:61-64`), não a linha: corrigir a lista de módulos e deixar as duas de baixo intactas reencena o defeito dentro do mesmo parágrafo. É o mesmo argumento que a US-88 usou para cobrar o bloco *Frontend* em vez do token que acendeu.

**Por que entra aqui e não vira story nova.** É o mesmo fato transcrito duas vezes — corrigir um lado e deixar o outro reencena exatamente o defeito que originou a US-83: duas cópias da mesma afirmação se citando como prova uma da outra. E o `AGENTS.md` é o mais grave dos dois, porque é o arquivo que todo agente lê antes de escrever qualquer linha. A [US-88](./US-88-gate-de-identificadores-inexistentes-nos-docs-normativos.md) achou isso ao corrigir a linha vizinha e não podia absorver: nome de módulo é minúsculo, não acende no gate dela.

### A tese

Este arquivo apodreceu pelo mesmo motivo que o README da US-83 e o `evals/README.md` da US-90: **transcreveu o código em vez de apontar para ele**, e nada o reprovava. A diferença é que aqui o dano é maior — README desatualizado confunde quem chega; convenção desatualizada é obedecida. Um agente que lê *"handler nunca acessa o banco diretamente"* vai inverter dependência para cumprir uma regra que as 6 tools vivas já violam.

### A proposta

Auditar o arquivo inteiro contra o código e aplicar a **camada 1 da US-83** a cada linha: se manter a frase verdadeira exige editar dois lugares, a frase vira ponteiro ou some. O que sobrar é convenção **com caso vigente** — e o que não tiver caso vigente é apagado, não marcado como aspiracional (o precedente é a frase *"uma tool por arquivo"*, que a US-83 apagou do `AGENTS.md` e que **continua viva aqui**, na *Regra de tools*).

---

## Escopo

### Dentro do escopo

- Corrigir ou apagar as 8 afirmações erradas da tabela, uma decisão por linha (corrigir só quando a regra tem caso vigente; apagar quando é transcrição).
- Resolver as 2 parciais: alinhar a regra de `any` com o [`AGENTS.md`](../../../AGENTS.md) (que é o canônico) e dizer que `paths` é convenção do `apps/web`, não do repo.
- Substituir o bloco de env por ponteiro: quem quiser a lista real roda `grep process.env`, e a regra de *onde* o `.env` é lido já está no [`CLAUDE.md`](../../../CLAUDE.md).
- Atualizar o **"Atualizado em:"** — e, se a data não puder ser mantida honesta, apagar o campo em vez de deixá-lo mentir.
- Decidir o destino do arquivo (ver *Questões em aberto* #1): sobreviver enxuto, ou ser absorvido pelo `AGENTS.md`.
- **O bloco *Backend* do [`AGENTS.md`](../../../AGENTS.md) (`:61-64`)**, inteiro: a lista de módulos ganha o mesmo tratamento da lista do `convencoes.md` (ponteiro para [`apps/api/src`](../../../apps/api/src), não transcrição), e as afirmações de BullMQ (`:63`) e Socket.IO (`:64`) **saem** — descrevem infra que não existe, e a de Socket.IO ainda contradiz o [`CLAUDE.md`](../../../CLAUDE.md). Só esse bloco do `AGENTS.md`: o *Frontend* logo acima já foi corrigido pela [US-88](./US-88-gate-de-identificadores-inexistentes-nos-docs-normativos.md).

### Fora do escopo

- **Escrever gate novo.** Se a saída for mecanizável, ela é a [US-88](./US-88-gate-de-identificadores-inexistentes-nos-docs-normativos.md) — que já existe planejada e cobre a classe "identificador citado que não existe". Duas stories escrevendo checker sobre o mesmo corpus é o erro que a US-86 evitou fechando sem código.
- **Mudar o código para obedecer à doc.** Nenhuma linha de `apps/api` muda aqui. Onde doc e código divergem, **o código está certo por definição** — ele roda. Se alguma regra apagada merecer voltar como refactor (extrair repositório, anotar retorno das tools), vira story própria com caso vigente.
- **O resto do `AGENTS.md`.** Entra o bloco *Backend* (`:61-64`) porque a lista de módulos é a mesma transcrição auditada aqui e as outras duas linhas são o mesmo defeito no mesmo parágrafo — corrigir uma e deixar as vizinhas é o que esta story existe para não fazer. Nada além disso. Auditoria do arquivo inteiro é story própria, com baseline própria.
- **Auditar os outros arquivos de `docs/sdlc/03-implementacao`.** Mesmo argumento de sempre: medir antes de ampliar. Se esta auditoria mostrar que o vizinho tem a mesma taxa, aí sim.
- **Registrar seed de rolagem para auditoria.** A frase sai da doc porque não descreve o código; se auditoria de rolagem for requisito de produto, é feature (e `getRandomValues` teria de sair junto), não conserto de doc.

---

## Critérios de aceite

- [ ] Toda afirmação restante em [`convencoes.md`](../03-implementacao/convencoes.md) é verificável no repo **hoje**, e a revisão registra onde cada uma foi conferida.
- [ ] `grep -rn "repository.ts\|campaign\|ingestion" docs/sdlc/03-implementacao/convencoes.md AGENTS.md` não retorna nada — ou retorna só linha que diz explicitamente que aquilo **não** existe. **Os dois arquivos**, porque a lista de módulos está transcrita nos dois.
- [ ] A seção *Backend* do [`AGENTS.md`](../../../AGENTS.md) não transcreve a lista de módulos: aponta para [`apps/api/src`](../../../apps/api/src).
- [ ] `grep -niE "bullmq|socket\.io" AGENTS.md` não retorna nada — ou só linha que diz explicitamente que aquilo **não** existe. As duas afirmações são do mesmo bloco *Backend* e nenhum gate as pega.
- [ ] O bloco *Backend* do `AGENTS.md` **não contradiz** o [`CLAUDE.md`](../../../CLAUDE.md) quanto ao transporte (*"REST e streaming SSE (não é WebSocket)"*) — mesmo critério que a [US-88](./US-88-gate-de-identificadores-inexistentes-nos-docs-normativos.md) aplicou ao bloco *Frontend*.
- [ ] Nenhuma lista transcrita do código sobrevive no arquivo (módulos, env vars, arquivos de pasta): cada uma virou ponteiro para a fonte viva.
- [ ] A *Regra de tools* descreve as 6 tools reais — ou some, se o que sobrar dela for redundante com o [`AGENTS.md`](../../../AGENTS.md).
- [ ] Zero conflito normativo com o [`AGENTS.md`](../../../AGENTS.md) e o [`CLAUDE.md`](../../../CLAUDE.md): a regra de `any` diz a mesma coisa nos três, ou vive num só.
- [ ] `pnpm docs:links` e `pnpm docs:shape` continuam verdes.
- [ ] **Teste de regressão (humano, deliberado):** um agente sem contexto, lendo **só** o arquivo, responde certo: (a) onde fica o seed do Prisma; (b) uma tool pode chamar o Prisma direto; (c) quais módulos existem em `apps/api/src`. Hoje erra as três.

---

## Notas de implementação

> Dicas para quem implementa. Não é especificação obrigatória.

- **Ler o código antes de cada linha, não depois.** A auditoria acima já está feita e datada; o que ela não garante é o dia da implementação. As fontes vivas: [`apps/api/src`](../../../apps/api/src), [`ai.service.ts`](../../../apps/api/src/ai/ai.service.ts) (as 6 tools, `:349-600`), [`schema.prisma`](../../../apps/api/prisma/schema.prisma), `grep process.env`.
- **A regra do `.env` é armadilha conhecida e tem dono:** [`CLAUDE.md`](../../../CLAUDE.md) → *Env em dev*. Não reescrever ali — linkar. O `.env` e o `.env.example` são gitignored e negados ao agente; qualquer afirmação sobre o conteúdo deles é hipótese, não fato.
- **Apagar é o desfecho barato e frequente aqui.** Três seções (*TypeScript*, *Commits e PRs*, *Regra de tools*) repetem o [`AGENTS.md`](../../../AGENTS.md) com palavras diferentes — e é da divergência de palavras que nasce o conflito de norma.
- Ao apagar bloco, deixar comentário HTML dizendo **por quê** e com o número da US, como ficou nas duas árvores apagadas pela US-86. Comentário guarda o porquê; `git log` guarda o quando.

---

## Questões em aberto

1. **O arquivo deve existir?** Há **três** documentos normativos sobre como escrever código aqui: [`AGENTS.md`](../../../AGENTS.md) (canônico), [`CLAUDE.md`](../../../CLAUDE.md) (que já manda ler o AGENTS) e este. Foi a sobreposição que produziu o conflito da regra de `any`. Duas saídas: (a) absorver o que sobrar no `AGENTS.md` e apagar o arquivo, deixando ponteiro do índice do vault ([US-78](./US-78-vault-obsidian-para-os-docs.md)); (b) mantê-lo como o "como", com o `AGENTS.md` sendo o "o quê". Recomendação: **(a)** — o que sobrar depois da auditoria provavelmente cabe em 15 linhas, e um arquivo de 15 linhas que duplica outro é a próxima dívida.
2. **Ampliar a [US-88](./US-88-gate-de-identificadores-inexistentes-nos-docs-normativos.md) para `docs/sdlc/03-implementacao/`?** ❌ **Fechada na US-88 (questão #2), por medição:** a pasta tem 1 arquivo e **0 identificadores cobrados** — nenhum token em backtick fora de fence casa a regex de camelCase. Rodar o gate ali daria verde num arquivo comprovadamente podre, o que é pior que não rodar. A premissa desta questão (*"três dos 8 achados são da classe dela"*) estava errada; ver a correção em *Por que a solução atual não basta*. Este arquivo é tratado à mão, aqui.
3. **A data de "Atualizado em" tem valor?** Ela estava um mês velha e ninguém notou; data velha em doc errada é pior que data ausente, porque dá falsa precisão. Considerar apagar o campo de todos os artefatos de `docs/sdlc/03-implementacao` — mas isso é decisão do vault, não desta story.

---

## Referências no código

- [docs/sdlc/03-implementacao/convencoes.md](../03-implementacao/convencoes.md) — o alvo. As duas árvores de diretório já saíram na US-86; o que sobrou é o objeto desta story.
- [apps/api/src](../../../apps/api/src) — os módulos reais (`adventure`, `ai`, `auth`, `character`, `game`, `system`, `user`) e a ausência de qualquer `*.repository.ts`.
- [apps/api/src/ai/ai.service.ts](../../../apps/api/src/ai/ai.service.ts) — as 6 tools: `parameters: z.object` (`:353`), `execute` sem retorno anotado (`:359`), `this.prisma.eventLog.create` dentro da tool (`:378`), e o comentário de `:348` que contradiz a *Regra de tools* #3.
- [apps/api/src/game/dice.service.ts](../../../apps/api/src/game/dice.service.ts) — `DICE_FORMULA_RE` e `crypto.getRandomValues`: as afirmações da seção *Rolagem de dados* que estão certas. Nenhum seed em lugar nenhum.
- [apps/api/prisma/schema.prisma](../../../apps/api/prisma/schema.prisma) — `model EventLog` (`:117`) e o enum `EventType`: o payload é `Json` e não guarda seed.
- [apps/api/prisma/seed.ts](../../../apps/api/prisma/seed.ts) — o caminho real do seed, contra o `prisma/seed.ts` afirmado.
- [CLAUDE.md](../../../CLAUDE.md) — *Env em dev*: a regra real de carregamento, que o bloco `# apps/api` contradiz.
- [AGENTS.md](../../../AGENTS.md) — o documento canônico; é contra ele que os conflitos de norma se resolvem. Bloco *Backend* (`:61-64`): lista de módulos transcrita, `BullMQ` e `Socket.IO` inexistentes. O bloco *Frontend* logo acima (`:53-58`) já foi corrigido pela [US-88](./US-88-gate-de-identificadores-inexistentes-nos-docs-normativos.md) e serve de modelo do desfecho.
- [apps/web/src/app/api/chat/route.ts](../../../apps/web/src/app/api/chat/route.ts) — `:28`, o `text/event-stream` que desmente o Socket.IO.
