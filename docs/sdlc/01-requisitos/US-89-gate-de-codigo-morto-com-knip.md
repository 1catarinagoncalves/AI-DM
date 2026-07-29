# US-89 — Export que ninguém importa para de sobreviver no repo

**Épico:** 0 — Infra e documentação
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** [US-80](./US-80-ci-typecheck-testes-e-evals.md) — **satisfeita**. É onde o gate ganha dentes (`pnpm typecheck`, `test` e `eval` já rodam em todo push e PR).
**Nasceu de:** sessão de 27/07/2026. `packages/ai-engine/src/tools/roll-dice.ts` exportava `rollDiceTool`, **nunca importado por ninguém**, com `execute` que só lançava exceção e uma interface (`formula: "2d6+3"`) que contradizia a `rollDice` viva. Estava lá desde o scaffold de 27/06/2026 — um mês, com `typecheck`, `test`, `eval` e gate de docs verdes o tempo todo. Achado à mão, apagado à mão.
**Relacionada a:** [US-88](./US-88-gate-de-identificadores-inexistentes-nos-docs-normativos.md) (mesmo buraco visto do lado da doc: lá a doc cita código que não existe, aqui o código existe e ninguém cita), [US-86](./US-86-gate-de-caminhos-em-arvores-de-diretorio-nos-docs.md) e [US-82](./US-82-gate-de-convencao-de-nomes-de-arquivo-nos-docs.md) (família de gate mecânico), [US-83](./US-83-readme-com-arquitetura-alto-nivel.md) (*"toda linha que reafirma um arquivo é dívida"* — o mesmo argumento aplicado a código).

**Criada em:** 2026-07-27
**Revisada em:** 2026-07-29 — escopo enxugado: a triagem símbolo a símbolo dos 32 exports saiu do trabalho e virou `ignoreExportsUsedInFile: true`, uma linha de config. Sobrou instalar, rodar, apagar 3 resíduos e pôr no CI.

---

## História

> **Como** dev (ou agente) que abre um arquivo do repo para entender como algo funciona,
> **quero** que código sem nenhum consumidor reprove no CI,
> **para que** eu não gaste leitura — nem escreva código novo — em cima de uma interface que o projeto abandonou.

---

## Contexto e motivação

### O problema observado

O `rollDiceTool` não era só código não usado. Era uma **segunda interface, contraditória, para uma tool viva**: recebia `formula: "2d6+3"` (o LLM monta a rolagem) enquanto a `rollDice` real recebe `skill`/`ability` e monta a fórmula no servidor, com a instrução explícita *"NEVER pass a modifier of your own"* ([`ai.service.ts:349`](../../../apps/api/src/ai/ai.service.ts)). Um agente que abrisse o arquivo do pacote — o caminho que o próprio `AGENTS.md` mandava seguir, com a convenção "uma tool por arquivo" — implementaria a tool errada, obedecendo.

Custo de código morto não é o byte. É que ele **responde perguntas**, e responde errado.

### Por que a solução atual não basta

`tsc` não pega, e não é configuração faltando: `noUnusedLocals` é análise **intra-arquivo**. Um símbolo exportado é, por definição, parte da API pública do módulo — o compilador não pode saber se alguém fora do programa o consome. `roll-dice.ts` compilava limpo, e continuaria compilando limpo para sempre.

| Ferramenta | O que pega | Pegaria o `rollDiceTool`? |
|---|---|---|
| `tsc --noEmit` | erro de tipo, símbolo local sem uso | ❌ |
| `pnpm test` | comportamento do que é testado | ❌ (código morto não tem teste) |
| `pnpm eval` | qualidade do DM Agent | ❌ |
| `pnpm docs:links` | link e caminho na doc | ❌ |
| Revisão humana | tudo, em teoria | ❌ — um mês, várias sessões |

Não há formatter nem linter no projeto (`AGENTS.md` → *Formatação*), então também não existe `no-unused-vars` de ESLint — que, de qualquer forma, teria o mesmo teto intra-arquivo.

### Baseline medida (27/07/2026)

Sem instalar nada: script descartável (mini-knip) sobre `apps/*/src`, `packages/*/src`, `scripts/` e `evals/`, casando `export const|function|class|type|interface|enum` e `export { … }`, e procurando cada nome em todos os outros arquivos.

| Métrica | Valor |
|---|---|
| Exports nomeados | 165 |
| Sem uso fora do próprio arquivo | **32** |
| Deps declaradas e nunca importadas (heurística crua) | 9 |
| Arquivos sem nenhum importador | 17 |

**Os três números medem coisas diferentes, e só o primeiro é sinal quase puro.** Verificação por amostra dos 32:

| Classe | Exemplo verificado | Quantos | O que fazer |
|---|---|---|---|
| **Ponto cego do probe** | `judgeBatch` — usado por `packages/ai-engine/run-bakeoff.mjs`, que está na raiz do pacote e não em `src/` | poucos | nada: é uso legítimo, o probe é que era estreito |
| **Exportado sem consumidor externo** | `PRICES` (`rubric.ts:176`), `ChatInput` (`ai.service.ts:35`), `primaryModel` (`model.ts:76`) — usados só dentro do arquivo que os define | maioria | nada: `ignoreExportsUsedInFile: true` cala a classe inteira em uma linha de config |
| **Morto de verdade** | `EventLogEntry` e `CharacterStatePatch` ([`packages/shared/src/types/game.ts`](../../../packages/shared/src/types/game.ts)) — zero ocorrências em qualquer lugar | poucos | apagar |

O segundo achado é o irônico: `EventLogEntry` é o tipo da tool `addEventLog` — uma das 5 "Future tools" que nunca existiram e que a [US-83](./US-83-readme-com-arquitetura-alto-nivel.md) já tinha caçado na doc. O contrato do fantasma sobreviveu ao fantasma.

Os outros dois números são quase só falso positivo da heurística crua, e é isso que dimensiona o trabalho de configuração:

- **Deps:** dos 9, `react-dom`, `tailwindcss`, `@nestjs/platform-express`, `@prisma/client`, `pg` e `rxjs` são runtime/build que ninguém importa por nome. **O único verdadeiro é `@ai-sdk/react`** (`apps/web/package.json:14`) — instalado, nunca importado, e é a origem da mentira do `useChat` que a [US-88](./US-88-gate-de-identificadores-inexistentes-nos-docs-normativos.md) registra.
- **Arquivos:** os 17 são entrypoint — `middleware.ts` e `next-auth.d.ts` (convenção do Next), os `scripts/*.mjs` (CLI), e os 12 `evals/cases/*.ts` (carregados pela suíte). **Zero achados reais.**

Ou seja: a ferramenta certa aqui não é a que acha mais, é a que **sabe o que é entrypoint**. É exatamente o que o `knip` traz de pronto (plugins de Next.js, NestJS, Vitest), e é por isso que a story é "adotar `knip`" e não "escrever nosso checker" — o gate de docs a gente escreveu porque não havia nada; aqui há.

---

## Escopo

### Dentro do escopo

- `knip` como **devDependency da raiz** (`pnpm add -Dw knip`), com **`knip.jsonc`** versionado — JSONC porque aceita comentário nativo, e cada exceção precisa do motivo escrito ao lado.
- **`ignoreExportsUsedInFile: true` na config.** Uma linha, e a classe "exportado, usado só dentro do próprio arquivo" — a **maioria dos 32** — some do relatório sem ninguém editar arquivo nenhum. Responde a antiga questão #2 por omissão: não reprova, e não custa triagem.
- Script `pnpm dead` na raiz, no padrão dos outros gates (`docs:links`).
- **Rodar primeiro, configurar depois.** Os plugins de Next/Nest/Vitest já vêm de fábrica; `entry` só ganha entrada quando a saída real acusar falso positivo. O único ponto cego conhecido da baseline é `run-bakeoff.mjs` (fora de `src/`) — mesmo esse, confirmar no relatório antes de escrever config para ele.
- Apagar o resíduo confirmado: `EventLogEntry`/`CharacterStatePatch` em `packages/shared` e a dep `@ai-sdk/react`, se a [US-88](./US-88-gate-de-identificadores-inexistentes-nos-docs-normativos.md) não tiver chegado antes.
- Passo no workflow da [US-80](./US-80-ci-typecheck-testes-e-evals.md), depois de `pnpm test`, **falhando de verdade** — se sobrar resíduo, estreita-se o tipo de achado, não o exit code (ver *Decisões* #1).

### Fora do escopo

- **Triagem símbolo a símbolo dos 32 e remoção da palavra `export`.** Era o grosso do trabalho na primeira versão desta story, e `ignoreExportsUsedInFile` o dispensa. Zero arquivo de código tocado, zero risco de regressão, nada para `pnpm typecheck` re-verificar. Se um dia esses símbolos incomodarem, é ligar a opção de volta — decisão de uma linha, com o gate já de pé.
- **Config por workspace desenhada de antemão.** O repo tem 4 pacotes com contratos diferentes, mas escrever 4 blocos `workspaces` antes de ver o relatório é configurar contra fantasma. Bloco por workspace só quando a saída daquele workspace exigir.
- **`knip --fix`.** Deleção automática de export é o oposto de leitura, e o pouco que sobrar para decidir merece olho humano. Mesmo princípio do "reportar, não reescrever" da [US-79](./US-79-consertar-links-quebrados-na-documentacao.md) (`:99`).
- **Mover as 6 tools vivas para o pacote.** Elas fecham sobre `this.prisma` (ou, no `getSpell`, sobre o contexto do turno); extrair exige inverter a dependência. É decisão de design, não limpeza — e continua sem story.
- **Deps de runtime/build por heurística de import.** Se um plugin do `knip` não souber que `pg` é o adapter do Prisma, a entrada vai para o `ignoreDependencies` com motivo escrito, não para o `package.json` como remoção.
- **Adotar ESLint junto.** Tentação natural ("já que vamos instalar ferramenta de análise"), escopo diferente, e o `AGENTS.md` registra que a ausência de linter é estado conhecido e não acidente. Story própria se alguém quiser.
- **Cobertura de teste como sinal de código morto.** Outra ferramenta, outra conversa.

---

## Critérios de aceite

- [x] `knip` instalado como devDep da raiz (`knip@6.29.0`), com [`knip.jsonc`](../../../knip.jsonc) versionado e `pnpm dead` na raiz rodando ele.
- [x] `ignoreExportsUsedInFile: true` na config, com comentário apontando para esta US.
- [x] **Saída limpa:** `pnpm dead` sai com 0 achados e exit 0.
- [x] Cada entrada de `entry`/`ignore*` na config tem **comentário com o motivo** (por que aquele arquivo é entrypoint, ou por que aquela dep não aparece em import). Config sem motivo vira depósito.
- [x] `EventLogEntry` e `CharacterStatePatch` apagados de `packages/shared` — junto com mais 4 fósseis que o gate achou (ver *Resultado*).
- [x] `@ai-sdk/react` removido de `apps/web` — e `ai`, `pg`, `@types/pg`, `@nestjs/testing` junto, todos declarados e nunca importados.
- [x] Passo novo no [`ci.yml`](../../../.github/workflows/ci.yml), separado (não `&&` em cima de outro), para a aba de checks mostrar qual etapa caiu — convenção já registrada no topo do workflow.
- [x] O passo **reprova o build quando acha algo**: sem `continue-on-error`, sem `--no-exit-code`. Tipo de achado parcado com `--exclude` é aceitável e exige comentário nomeando o que ficou de fora.
- [x] `pnpm install` continua funcionando para quem clona: sem placeholder inválido no `pnpm-workspace.yaml` (ver *Notas*) — conferido logo após o `pnpm add -Dw knip`, o arquivo não foi tocado.
- [x] `pnpm typecheck` e `pnpm test` (259 testes) verdes depois de todas as remoções.

---

## Notas de implementação

- **⚠️ Instalar a dep pode travar todo comando `pnpm`.** Armadilha já registrada no `AGENTS.md` → *Armadilhas do repo*: o pnpm acrescenta pacote com build script ao `allowBuilds:` do `pnpm-workspace.yaml` com um placeholder literal (`'@scarf/scarf': set this to true or false`), e isso derruba o preflight de **qualquer** comando `pnpm` com `ERR_PNPM_IGNORED_BUILDS`. Depois do `pnpm add -Dw knip`, conferir o `pnpm-workspace.yaml` **antes** de rodar qualquer outra coisa.
- **Config mínima que passa, não config completa.** O caminho curto é `pnpm dead` → ler a saída → resolver **só o que ela reclamou**. `ignore` largo é o único atalho proibido: ele esconde exatamente a classe de achado que motivou a story. Preferir `entry` (declara o que é entrada) a `ignore` (manda calar).
- **`packages/shared` é caso especial e merece decisão explícita.** É pacote de contrato: um tipo exportado sem consumidor *hoje* pode ser o contrato de uma US da fila — ou um fóssil, como `EventLogEntry` provou ser. A regra que evita as duas dores: tipo sem consumidor ou é apagado, ou ganha comentário com o número da US que vai consumi-lo. Sem comentário, é fóssil.
- **A ordem importa:** configurar até zerar **antes** de pôr no CI. Gate que nasce vermelho é gate que nasce com `continue-on-error`, e aí não é gate.
- **Não versionar o probe desta baseline.** Ele foi instrumento de medição, não ferramenta: heurística de substring, cego para arquivo fora de `src/`. Os números acima valem como ordem de grandeza; a saída do `knip` configurado é que vira a linha de base real.

---

## Resultado (29/07/2026)

Implementada. `pnpm dead` sai limpo, e o passo `Gate de código morto` roda no CI entre `pnpm test` e `pnpm eval`.

**O que a primeira execução achou de verdade — 6 fósseis e 5 deps:**

| Achado | Onde | Veredito |
|---|---|---|
| `EventLogEntry`, `CharacterStatePatch` | `packages/shared/src/types/game.ts` | apagados — contrato das tools fantasma, como previsto |
| `Quest`, `CharacterState`, `Attributes` | `packages/shared/src/types/{game,character}.ts` | apagados — interfaces TS que duplicavam modelos do Prisma; o código sempre usou os tipos gerados. `Attributes` só apareceu depois de `CharacterState` sair (cascata) |
| `SystemSkill` | `packages/shared/src/types/system.ts` | apagado — único `z.infer` do bloco sem nenhum consumidor |
| `defaultModel` | `packages/ai-engine/src/model.ts` | apagado — alias "Compat:" de `primaryModel` que ninguém importava |
| `signIn`, `signOut` | `apps/web/src/auth.ts` | fora do destructuring — a UI usa os homônimos client-side de `next-auth/react` |
| `@ai-sdk/react`, `ai` | `apps/web/package.json` | removidas — as duas são o rastro do `useChat` que nunca existiu (US-88) |
| `pg`, `@types/pg` | `apps/api/package.json` | removidas — vêm como dependência do `@prisma/adapter-pg`, ninguém importa `pg` direto |
| `@nestjs/testing` | `apps/api/package.json` | removida — os testes são Vitest puro |

**Três achados da config que a story não previa:**

1. **Declarar `entry` num workspace SUBSTITUI a lista padrão do knip.** Pôr só `prisma.config.ts` em `apps/api` fez a API inteira (15 arquivos, incluindo `main.ts`) virar "arquivo sem importador". Todo bloco `entry` precisa relistar as entradas normais.
2. **O plugin do Prisma foi desligado** (`"prisma": false`): ele carrega `apps/api/prisma.config.ts`, que faz `env('DATABASE_URL')` no topo e explode fora do wrapper `dotenv -e .env`. O que ele acrescentava, o knip já acha pelos scripts do `package.json`.
3. **`includeEntryExports: true` em `packages/shared`** foi o que deu dentes ao gate no pacote de contrato. Sem isso, export de arquivo de entrada conta como usado — e o knip passava limpo por cima de `EventLogEntry`, exatamente o símbolo que motivou a story. Foi essa opção que revelou os outros 4 tipos mortos.

**Verificação de que o gate morde:** um arquivo `dead-probe.ts` com um export sem consumidor foi plantado em `packages/ai-engine/src/` e o `pnpm dead` reprovou com exit 1; o arquivo foi apagado em seguida.

**Fora do escopo, confirmado no caminho:** [`docs/sdlc/02-design/contratos-de-api.md`](../02-design/contratos-de-api.md) ainda descreve `rollDice(formula)`, `addEventLog(...)` e um bloco de eventos WebSocket que não existem, e [`estrategia-de-testes.md`](../04-testes/estrategia-de-testes.md) manda validar `CharacterStatePatch`. É doc citando código inexistente — o lado da [US-88](./US-88-gate-de-identificadores-inexistentes-nos-docs-normativos.md), não deste gate.

---

## Decisões

*Eram as duas questões em aberto da versão de 27/07/2026. Fechadas em 29/07/2026 — as outras duas (reprovar "exportado sem consumidor externo", e medir export morto em arquivo de teste) sumiram junto com a triagem, resolvidas por `ignoreExportsUsedInFile`.*

1. **CI desde o primeiro dia, com falha dura.** Gate que só roda local não roda: o `rollDiceTool` sobreviveu um mês num repo com 5 gates verdes justamente porque ninguém procura à mão.

   Se sobrar resíduo que não dá para resolver na hora, a saída **não** é `continue-on-error` nem `--no-exit-code` — os dois transformam gate em decoração. É **estreitar o que se checa, mantendo o que se checa vermelho**: o `knip` filtra por tipo de achado (`--include`/`--exclude` sobre `files`, `dependencies`, `unlisted`, `exports`, `types`, `duplicates`, …). Parcar um tipo, com comentário dizendo qual e por quê, é o precedente literal do `docs:links`, que entrou no CI com `--only-md` enquanto os 85 links quebrados da [US-79](./US-79-consertar-links-quebrados-na-documentacao.md) existiam, e apertou quando ela fechou.

   A pergunta que sobra é operacional, não de design: *quais tipos entram na primeira versão*. Responde-se com a saída na mão, em um commit, reversível.

2. **Vale a pena — e com critério de abandono escrito.** O argumento nunca foi volume (165 exports é pouco), é **tempo de sobrevivência**: um mês, 5 gates verdes, várias sessões lendo o repo, e o export morto continuou lá. Com o escopo enxugado o custo virou uma devDep e ~10 linhas de `knip.jsonc` — abaixo do preço de discutir de novo.

   Para não reabrir a discussão a cada release: **se ao fim da Fase 1 o `knip` não tiver pego nenhum achado real — só config crescendo para calar falso positivo — apaga-se a dep e o passo do CI.** Custo de sair: um commit.

---

## Referências no código

- [packages/shared/src/types/game.ts](../../../packages/shared/src/types/game.ts) — `EventLogEntry` (`:22`) e `CharacterStatePatch` (`:40`), os 2 achados mortos de verdade.
- [packages/ai-engine/src/model.ts](../../../packages/ai-engine/src/model.ts) — `primaryModel` (`:76`) e vizinhos: classe "exportado, usado só dentro do arquivo".
- [packages/ai-engine/src/rubric.ts](../../../packages/ai-engine/src/rubric.ts) — `PRICES` (`:176`, interno) e `judgeBatch` (`:379`, consumido por `run-bakeoff.mjs` na raiz do pacote — o ponto cego que a config precisa cobrir).
- [apps/web/package.json](../../../apps/web/package.json) — `@ai-sdk/react` (`:14`), a única dep declarada e nunca importada.
- [apps/api/src/ai/ai.service.ts](../../../apps/api/src/ai/ai.service.ts) — objeto `tools` (`:349-585`): a interface viva que o `rollDiceTool` morto contradizia.
- [.github/workflows/ci.yml](../../../.github/workflows/ci.yml) — onde o passo novo entra, e a convenção de um passo por gate.
- [AGENTS.md](../../../AGENTS.md) — *Armadilhas do repo* (o `@scarf/scarf`), *Formatação* (por que não há linter) e a regra "roadmap não vira código" em *Padrões de código → Comentários*.
