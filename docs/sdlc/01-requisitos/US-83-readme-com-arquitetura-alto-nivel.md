# US-83 — README com arquitetura de alto nível

**Épico:** 5 — Ferramentas de projeto / SDLC
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** nenhuma. Convive com a [US-79](./US-79-consertar-links-quebrados-na-documentacao.md) (os links novos do README precisam passar no `pnpm docs:links`) e com a [US-82](./US-82-gate-de-convencao-de-nomes-de-arquivo-nos-docs.md), mas não espera nenhuma das duas. Ganha dentes com a [US-80](./US-80-ci-typecheck-testes-e-evals.md) (CI) pela mesma razão da US-82: sem CI, o gate anti-drift é comando local.
**Relacionada a:** [US-86](./US-86-gate-de-caminhos-em-arvores-de-diretorio-nos-docs.md) — as duas mexem no bloco de árvore de diretórios do README. Esta quer **encolhê-lo ou deletá-lo** (*Notas de implementação*); a US-86 põe gate no que sobrar, em qualquer `.md`. Sem conflito e sem ordem obrigatória: se esta rodar primeiro, sobra menos para a outra cobrir — que é o desfecho preferido pelas duas.
**Criada em:** 2026-07-26

---

## História

> **Como** desenvolvedora e como agente de IA entrando no repo pela primeira vez,
> **quero** um `README.md` que descreva o *shape* real do sistema — quem chama quem, onde o estado vive, o que roda em produção — com um diagrama,
> **para que** entender a arquitetura custe uma leitura de dois minutos em vez de uma varredura de vinte arquivos.

---

## Contexto e motivação

### O problema observado

O `README.md` da raiz existe, mas **descreve um sistema que não é este**. Auditoria de 2026-07-26 contra o código:

| O que o README afirma | O que o repo tem | Onde verificar | Estado |
|---|---|---|---|
| `prisma/` na raiz | `apps/api/prisma/` (schema, migrations, seed) | `ls prisma` falha | ✅ 27/07 |
| Redis, BullMQ, pgvector, S3 | nenhum dos quatro nas dependências da API; pgvector também não está no banco | `apps/api/package.json`, `apps/api/prisma/migrations/` | ✅ 27/07 |
| Tailwind **+ shadcn/ui**, **Zustand** *(achado novo)* | nenhum dos dois: sem `components.json`, sem `@radix-ui/*`, sem `zustand` — nem em deps nem em `apps/web/src` | `apps/web/package.json` | ✅ 27/07 |
| 7 tools do DM Agent (`getRule`, `advanceQuest`, `recallMemory`…) | **6 tools**, nenhuma onde a linha original procurou — ver reverificação abaixo | `apps/api/src/ai/ai.service.ts:349-585` | ✅ 27/07 |
| `pnpm typecheck` roda "hoje: `api`" *(achado novo)* | `api` **e** `web` declaram o script | `apps/*/package.json` | ✅ 27/07 |
| — (não menciona) | Neon, Render, Vercel, Auth.js/Google, evals com LLM-judge, ingestão de SRD (`srd:sync`/`srd:ingest`) | US-58 a US-61, `package.json` | 📋 **é o corpo desta story** |

Ou seja: as três primeiras linhas de contexto que um agente lê são **roadmap escrito no presente**. O custo não é estético — é um agente propondo `prisma migrate` na pasta errada, ou "reaproveitar o worker BullMQ" que nunca existiu.

> **Todas as afirmações FALSAS da tabela foram corrigidas à mão em 27/07/2026.** A tabela fica inteira, com coluna de estado em vez de linhas apagadas: ela é a evidência que sustenta as camadas 2 e 3 abaixo, e apagá-la destruiria o dado. Duas leituras dela:
>
> - **Auditar não conserta.** Esta story documentou as mentiras em 26/07 e todas sobreviveram intactas ao dia seguinte, porque nada as reprovava. O `prisma/` vivia em **4 cópias** (`README.md`, `AGENTS.md`, `CLAUDE.md`, [`convencoes.md`](../03-implementacao/convencoes.md)) e a 4ª não apareceu em quatro leituras manuais — só saiu quando a baseline da [US-86](./US-86-gate-de-caminhos-em-arvores-de-diretorio-nos-docs.md) foi medida por script.
> - **A auditoria de 26/07 estava incompleta, e num caso errada.** A reverificação achou **2 mentiras novas** (shadcn/Zustand, `typecheck`) e mostrou que a linha das tools acertava o diagnóstico e errava a correção. Uma auditoria manual encontra o que procura.
>
> **O que sobra desta tabela é a última linha** — as ausências. Elas não se consertam com edição de uma linha: são a seção de Arquitetura, o diagrama e a seção de Produção que esta story existe para escrever. **O escopo da story não encolheu; o ruído em volta dele saiu.**

#### Reverificação das outras 3 linhas (27/07/2026)

Medidas contra o código, não relidas da auditoria de 26/07:

- **Redis / BullMQ / pgvector / S3 — confirmado ausente.** Nenhum em `apps/api/package.json` (sem `redis`, `ioredis`, `bullmq`, `@nestjs/bull`, `@aws-sdk/*`), e **nenhuma migration menciona `vector`** — pgvector não está nem no banco, então não bastava olhar dependência. ~~**Ressalva: Socket.IO não pertence a essa lista** — `@nestjs/platform-socket.io` e `@nestjs/websockets` **estão** instalados.~~ **A ressalva caiu em 28/07/2026:** as duas eram dependência morta (0 gateways, 0 adapters, streaming é SSE) e foram removidas — ver *Questão em aberto #1*. Socket.IO entrou na mesma vala de Redis/BullMQ: afirmado, nunca usado.
- **As 7 tools — a linha estava certa no diagnóstico e errada na correção.** O README lista 7 tools das quais 5 não existem (`getRule`, `advanceQuest`, `recallMemory`, `getCharacterState`, `addEventLog`). Mas a coluna "o que o repo tem" dizia **1 tool**, olhando só `packages/ai-engine/src/tools/`. O DM Agent tem **6 tools vivas**, todas inline em `apps/api/src/ai/ai.service.ts`: `rollDice` (`:349`), `updateCharacterHp` (`:393`), `updateInventory` (`:425`), `updateScene` (`:483`), `recordEntity` (`:534`), `getSpell` (`:585`).

  **A pasta que a auditoria consultou não tem tool viva nenhuma.** O `rollDiceTool` de `roll-dice.ts` é exportado, **nunca importado** (grep no repo todo fora de `dist/`), tem `execute` que só lança exceção, e recebe `formula: "2d6+3"` — interface que nem bate com a `rollDice` real (teste de d20 por `skill`, modificador vindo da ficha). E `tools/index.ts:2-8` lista as 5 tools fantasmas comentadas como `// Future tools`: **é dali que a tabela de 7 nasceu**, em três documentos que pareciam se confirmar e descendiam todos desse comentário.

  **Consequência para o escopo:** a story não vai "corrigir 7 para 1". A tabela do README já foi trocada em 27/07 por lista curta + link para o código (a coluna "Descrição" duplicava a `description` de cada tool, que é o contrato real lido pelo modelo — camada 1). O que a story herda é decidir se documenta a divergência: `AGENTS.md` → *"uma tool por arquivo no pacote"*, seguida por **0 de 6**. As 6 fecham sobre `this.prisma` (ou, no `getSpell`, sobre o contexto do turno), então extrair é inverter dependência, não mover arquivo.
- **O que o README não menciona — confirmado, e é o que sobra para a story.** Sem seção de produção, sem `srd:sync`/`srd:ingest` na tabela de comandos. (`pnpm eval` aparece; o *que* ele faz, não.)
- **Dois achados novos, fora da tabela original.** (a) `README.md:55` dizia que `pnpm typecheck` roda "hoje: `api`" — `apps/web` também declara o script. (b) A linha de stack do **frontend** afirmava **shadcn/ui** e **Zustand**: não há `components.json`, nenhum `@radix-ui/*`, nenhum `zustand` em `apps/web/package.json` nem em `apps/web/src`. Em compensação, `next-auth` (Auth.js, a [US-61](./US-61-login-do-jogador.md) rodando em produção) **não** constava da stack e passou a constar. A auditoria de 26/07 conferiu `apps/api/package.json` — onde a tese apontava — e não abriu o do `web`.
- **A mesma tabela de 7 tools está no [`AGENTS.md`](../../../AGENTS.md)**, seção *Tools disponíveis para o DM Agent*. Mesma mentira, segundo arquivo — e o `AGENTS.md` é o que mais agente lê. Fora do escopo desta story (que é sobre o README), mas registrado aqui porque foi achado na mesma varredura.

### A lacuna que sobra mesmo depois de corrigir os fatos

Corrigir a tabela de stack não resolve o principal: **o README não tem arquitetura**. Ele tem uma árvore de diretórios (o *onde*) e uma lista de comandos (o *como rodar*), mas em nenhum lugar diz **como um turno de jogo atravessa o sistema** — que o browser fala com uma rota do Next que faz proxy de SSE para o NestJS, que o NestJS monta o prompt em 3 camadas e chama o provedor via escada de fallback, que a tool de dados executa **no servidor** e volta pro stream, que o estado persiste no Postgres e nunca no LLM.

Esse é exatamente o conhecimento que hoje só existe espalhado: parte no `AGENTS.md`, parte nas ADRs, parte em ~15 user stories, parte só no código. Um agente que não leu as 83 stories não tem como derivar isso — e a regra de ouro do projeto ("o estado nunca vive no LLM") vira slogan sem o diagrama que mostra *onde* ele vive.

### A proposta

Reescrever o `README.md` da raiz com uma seção de arquitetura de alto nível ancorada em **um diagrama Mermaid** (renderiza nativo no GitHub) mais um diagrama de sequência do fluxo de um turno. Todo fato afirmado tem que ser verificável no repo hoje; o que é futuro vai pro Roadmap, marcado como futuro.

E — a parte que decide se a story vale em 6 meses — **o README novo nasce com defesa contra o drift que matou o antigo.**

---

## Decisões

### O antídoto contra drift entra nesta story, não numa futura

Reescrever o README sem isso é pagar o conserto duas vezes: o README de hoje **não foi escrito errado**, foi escrito certo e o código andou por baixo. Nada no repo avisou. Quatro camadas, da mais barata à mais cara.

#### Camada 1 — não escrever o fato (custo zero)

Toda linha que **reafirma** um arquivo é dívida. As 4 mentiras auditadas acima eram todas duplicação: `prisma/` duplicava a árvore de diretórios, "Redis/BullMQ/pgvector/S3" duplicava `apps/api/package.json`, a tabela de 7 tools duplicava `packages/ai-engine/src/tools/`.

Regra: **se manter a frase verdadeira exige editar dois lugares, a frase já está errada — mesmo enquanto está certa.** Lista de dependências vira link para o `package.json`; tabela de tools vira link para a pasta. O README afirma *que existe uma API NestJS com o estado autoritativo*; a versão do Prisma é problema do `package.json`.

**Corolário decidido em 27/07/2026 — a camada 1 também apaga convenção sem caso vigente.** O `AGENTS.md` (*Padrões de código → Estrutura*) manda *"uma tool por arquivo"*. Nenhuma das 6 tools vivas segue: todas são inline em `apps/api/src/ai/ai.service.ts:349-585`, e a pasta `packages/ai-engine/src/tools/` que a regra pressupunha foi apagada no mesmo dia por só conter código morto. A regra passou a apontar para o vazio.

Convenção com 0 casos é a mesma dívida de uma lista transcrita: alguém a lê, escreve código para cumpri-la e produz o único arquivo do repo naquele formato. **Decisão: apagar a frase**, não marcá-la como aspiracional. Duas razões:

- *"Uma tool por arquivo"* e *"tool no pacote compartilhado"* eram duas regras coladas numa frase. A segunda morreu com a pasta (o `packages/ai-engine` não tem DI do NestJS, e as 6 tools fecham sobre `this.prisma` ou sobre o contexto do turno). A primeira continua **viável** — bastaria um arquivo por tool em `apps/api/src/ai/`, cada uma uma fábrica recebendo as dependências — mas viável não é o mesmo que decidido.
- O problema real por trás disso é o `ai.service.ts` com **1106 linhas**, contra o limite de 500 do próprio `AGENTS.md`. "Uma tool por arquivo" é uma solução parcial procurando justificativa: extrairia ~240 linhas e deixaria 860. Se o serviço for dividido algum dia, a regra volta junto com a story que a executar — e aí com um caso vigente.

#### Camada 2 — todo caminho é link, e o README entra no gate (~2 linhas de código)

> **Metade entregue pela [US-79](./US-79-consertar-links-quebrados-na-documentacao.md) em 27/07/2026.** O "~2 linhas de código" desta camada **já existe**: a varredura soma `docs/` recursivo + a constante `ROOT_MD` (`AGENTS.md`, `CLAUDE.md`, `README.md`) — [`check-doc-links.mjs:36`](../../../scripts/check-doc-links.mjs) e `:95-97`. O critério de aceite correspondente está marcado abaixo, e a subseção *Camada 2, concretamente* virou registro do que foi feito.
>
> **O que resta desta camada é a metade que não é código:** escrever cada caminho do README como link relativo em vez de backtick. Sem isso o gate existe e continua cego — é o critério "nenhum caminho aparece só entre backticks".
>
> **Números de linha desta seção estão velhos.** Foram medidos num script de ~217 linhas; o `--fix` da US-79 o levou a 279. Hoje: `stripCode` em `:46` (não `:35-45`), varredura em `:95-97` (não `:77`), isenção de `docs/prompts/` em `:108` (não `:83`). O *comportamento* descrito abaixo continua correto — só os endereços mudaram.

`scripts/check-doc-links.mjs` já resolve destino de link e falha se não existir. O `stripCode` (`:46`) apaga code span **antes** de procurar link — o que decide se uma afirmação é verificada ou invisível:

```md
`apps/api/prisma`                        <- invisível ao gate: backtick apagado em :43
[`apps/api/prisma`](apps/api/prisma)     <- MESMA renderização, e o alvo é verificado
```

Comportamento confirmado contra o `LINK_RE` e o `stripCode` reais: o backtick some do *texto* do link, os colchetes vazios continuam casando, e o destino é checado. Ou seja, **o custo de blindar um caminho é escrevê-lo como link** — não é disciplina nova, é hábito de Markdown.

Duas pegadinhas achadas escrevendo esta própria story, ambas relevantes para quem for linkar as ~10 pastas do README:

1. **Link de diretório não aceita barra final.** `](apps/api/prisma/)` falha no `existsSync`; o script acusa e sugere a versão sem barra.
2. **O exemplo acima precisa viver dentro de um code fence**, não numa tabela. Fence inteiro é neutralizado (`:38-41`); já o wrapper de backtick duplo numa célula de tabela **não** protege — o `stripCode` casa os pares de backtick e devolve um `](destino)` intacto, que o `LINK_RE` pega. Foi exatamente assim que a primeira versão desta seção quebrou o gate: link ilustrativo, caminho certo visto da **raiz**, errado visto de `docs/sdlc/01-requisitos/`.

~~Falta o README entrar no escopo: `:77` varre só `DOCS`.~~ **Entrou em 27/07/2026 pela [US-79](./US-79-consertar-links-quebrados-na-documentacao.md)** — ver a nota no início desta camada.

#### Camada 3 — drift guard por hash, para o que link nenhum pega (~15 linhas)

Link valida **caminho**, não valida **seta**. Se a API passar a falar com o provedor por outro caminho, ou nascer um módulo novo em `apps/api/src/`, todos os paths continuam existindo e o diagrama passa a mentir por omissão.

O repo já tem o idioma: [`rubric-drift.test.ts`](../../../packages/ai-engine/src/rubric-drift.test.ts) (US-36) hasheia uma const, hardcoded, com a justificativa certa — *snapshot convida ao reflexo `-u`, que regrava sem pensar*. Mesmo padrão aqui, hasheando a **forma** do sistema (lista ordenada de `apps/*`, `packages/*`, módulos de `apps/api/src/`, arquivos de `packages/ai-engine/src/tools/`). Mudou a forma → o teste falha → *"revise a seção Arquitetura do README"*. Colar o hash novo à mão **é** o ato de ter reolhado o diagrama.

É a única camada que pode ser cortada sem esvaziar a story. Se crescer além de um arquivo de teste, vira story própria.

#### Camada 4 — o gate só vale se rodar

`pnpm docs:links` no CI ([US-80](./US-80-ci-typecheck-testes-e-evals.md)), e uma linha no *Definition of Done* do `AGENTS.md`: mexeu em serviço, pasta de topo ou tool → README na mesma PR.

### As duas camadas complementares detectam erros opostos

Vale explicitar porque a redundância parece desperdício e não é: o **check de link** pega fato que *morreu* (arquivo saiu de baixo da afirmação); o **hash guard** pega fato que continua vivo mas ficou *incompleto* (módulo novo que ninguém contou ao diagrama). README apodrece pelos dois lados, e nenhuma das duas cobre o lado da outra.

---

## Escopo

### Dentro do escopo

- Seção **Arquitetura** nova no `README.md` da raiz, com:
  - diagrama de componentes em Mermaid (`flowchart`) — web, api, ai-engine, shared, Postgres, provedores de LLM;
  - diagrama de sequência (`sequenceDiagram`) de **um turno**: ação do jogador → proxy SSE → prompt → LLM → tool call → persistência → stream de volta;
  - parágrafo curto por componente dizendo **a responsabilidade e o que ele deliberadamente não faz**.
- Seção **Onde o estado vive** — tabela: ficha/inventário/quests → Postgres; histórico da conversa → Postgres; nada autoritativo no LLM.
- Correção de **todos** os fatos desatualizados da tabela acima (caminho do Prisma, stack real, tools reais).
- Seção **Produção** curta: web na Vercel, api no Render, banco no Neon — com o que cada plano impõe (ex.: `maxDuration` do proxy SSE, migração no `buildCommand`).
- Links relativos para os documentos canônicos (`AGENTS.md`, `docs/prd.md`, `docs/adr/`, `docs/README.md`) em vez de reexplicar o conteúdo deles.
- Um "mapa de leitura" de 4–6 linhas: *quer mexer em X? leia Y*.
- **Antídoto contra drift** (as 4 camadas acima):
  - camada 1 — nenhuma lista de dependências ou de tools transcrita; só ponteiro;
  - camada 2 — todo caminho do README escrito como link relativo; ~~e `README.md` da raiz incluído na varredura do `scripts/check-doc-links.mjs`~~ **já feito pela [US-79](./US-79-consertar-links-quebrados-na-documentacao.md)**;
  - camada 3 — teste de drift da forma do sistema, no idioma do `rubric-drift.test.ts`;
  - camada 4 — linha no *Definition of Done* do `AGENTS.md`.
- ~~**Apagar a frase "uma tool por arquivo"** de `AGENTS.md` → *Padrões de código → Estrutura*.~~ **Feito em 27/07/2026, fora da story** (era edição de uma linha e não dependia do resto). Saiu junto o cross-reference do passo 4 do *Workflow*, que apontava para a regra apagada, e o bullet do *AI Engine*, que a citava riscada — regra removida deixa referência órfã em outros pontos do arquivo, e o `grep` do critério de aceite não pega isso.

### Fora do escopo

- **README por pacote** (`apps/web/README.md`, `packages/ai-engine/README.md`). Um README bom na raiz resolve 90% do problema de onboarding; quatro READMEs criam quatro fontes para dessincronizar. Se depois de pronto ainda faltar, vira story própria.
- **ADR nova.** Esta story *documenta* decisões já tomadas e registradas; não toma nenhuma. Se a escrita revelar uma decisão sem ADR, o entregável é uma questão em aberto, não uma ADR escrita de improviso.
- **Gerar o README a partir do código.** Elimina o drift e mata o valor junto: um README é útil porque escolhe *o que não contar*. Um gerador teria escrito "WebSocket" na stack até 28/07/2026, porque `@nestjs/platform-socket.io` estava no `package.json` — sem saber que não havia um gateway sequer. É exatamente a mentira que esta story existe para consertar, produzida por automação.
- **Linter que parseia prosa** atrás de afirmações sobre o código. Falso positivo caro, ninguém confia, todo mundo desliga. As camadas 2 e 3 cobrem o que dá para cobrir mecanicamente; o resto é o critério de "cada afirmação verificável na revisão".
- **Traduzir o README para inglês.** O repo é pt-BR (ver [`locale`](./US-71-simplificar-localizacao-do-personagem.md) — bilíngue é dado de jogo, não de documentação).
- Reescrever `docs/README.md` (é o índice do vault Obsidian da [US-78](./US-78-vault-obsidian-para-os-docs.md), escopo diferente).

---

## Critérios de aceite

- [x] O `README.md` da raiz tem uma seção **Arquitetura** contendo pelo menos um diagrama Mermaid de componentes e um `sequenceDiagram` do fluxo de um turno. *(7 nós no `flowchart`, abaixo do teto de ~12.)*
- [x] Os diagramas renderizam no GitHub (bloco ` ```mermaid `, sem dependência externa) e continuam legíveis como texto puro para quem lê via `cat` — nomes de nó = nomes reais de diretório/serviço.
- [x] **Zero afirmações não verificáveis:** toda tecnologia citada como presente aparece em um `package.json` do repo, e todo caminho citado existe. As 4 linhas da tabela de "O problema observado" estão corrigidas. *(A do `prisma/` saiu à mão em 27/07/2026; as outras 3 em 28/07 — inclusive o Socket.IO da linha de stack, cuja dependência tinha caído na mesma passada da Questão #1.)* **Achado novo:** o repo não é bilíngue — não existe campo `locale` no schema nem em `apps/web`; o overlay pt-BR vive no ingest do SRD ([`scripts/srd/locale/`](../../../scripts/srd/locale)). A frase "em pt-BR e en" foi escrita e apagada durante esta story, pelo mesmo motivo de todas as outras: memória de decisão (ADR 005) não é estado do código.
- [x] Existe seção que responde, sem o leitor abrir outro arquivo: *onde o estado de jogo vive* e *o que o LLM tem permissão de alterar*. *(Tabela "Onde o estado vive", uma linha por modelo do Prisma + a linha das rolagens, que não persistem.)*
- [x] Existe seção **Produção** nomeando os três provedores em uso e o que cada um hospeda. *(Questão em aberto #2 resolvida como recomendado: fica no README, em tabela de 3 linhas, com a restrição de plano em cada uma.)*
- [x] O que ainda não existe aparece **apenas** no Roadmap, em tempo futuro — nunca na Stack nem na Arquitetura. *(A seção "Stack" foi deletada: virou um parágrafo por componente dentro de Arquitetura, cada um dizendo também o que o componente deliberadamente não faz.)*
- [x] `pnpm docs:links` passa **e inclui o `README.md` da raiz** na contagem de arquivos varridos. *(Entregue pela [US-79](./US-79-consertar-links-quebrados-na-documentacao.md) em 27/07/2026: `ROOT_MD` em `check-doc-links.mjs:36`. Continua sendo contrato — quem mexer no script não pode quebrá-lo.)*
- [x] Nenhum caminho de arquivo/pasta do README aparece só entre backticks: todos são link relativo (senão o gate da camada 2 não os enxerga). *(Única exceção, deliberada: `.env`, que é gitignored e **não existe** — linkar faria o gate acusar com razão.)*
- [x] O README não transcreve nenhuma lista que já existe no repo (dependências, tools, scripts): aponta para a fonte. *(Saíram a tabela de comandos, a lista das 6 tools e a seção Stack. Os 3 comandos do "Começando" mais `test`/`eval`/`typecheck`/`docs:links` ficam em prosa, com a lista completa linkando o `package.json` — o critério do eval exige que o README responda "qual comando roda os evals".)*
- [x] `grep -n "uma tool por arquivo" AGENTS.md` não retorna nada. A convenção de 0 casos saiu de *Estrutura* — se voltar, volta com um caso vigente. *(27/07/2026. O único hit restante é a nota do passo 4 do Workflow que registra a remoção e o porquê.)*
- [x] Existe teste que falha quando a forma do sistema muda (pasta de topo, módulo em `apps/api/src/`, arquivo em `packages/ai-engine/src/tools/`), com mensagem mandando revisar a seção Arquitetura do README. *([`scripts/readme-shape.test.mjs`](../../../scripts/readme-shape.test.mjs), `pnpm docs:shape`, no CI. Mora na raiz porque `pnpm test` é recursivo pelos workspaces e não a alcança — mesma razão do `docs:links:test`. A pasta `tools/` entra no hash como a string `(ausente)`: se voltar, o hash muda.)*
- [x] **Teste de regressão / eval:** um agente sem contexto, lendo **só** o `README.md`, responde corretamente: (a) em que pasta fica o `schema.prisma`; (b) qual componente rola os dados; (c) qual comando roda os evals. Hoje o README erra (a) e induz erro em (b). *(a) linkado na tabela de estado e no mapa de leitura; (b) o `sequenceDiagram` mostra `dice.service` rolando dentro de `apps/api`, e a linha "Rolagens" da tabela diz "o LLM não gera número"; (c) `pnpm eval` no "Começando".*
- [x] **Regressão do próprio antídoto:** mover ou renomear `apps/api/prisma/` faz `pnpm docs:links` falhar apontando a linha do README. É o cenário exato que passou despercebido e produziu esta story. *(Verificado em 28/07/2026 renomeando a pasta: 3 links quebrados, todos do README, categoria "alvo não existe, aponta p/ código".)*

---

## Notas de implementação

> Dicas para quem implementa. Não é especificação obrigatória.

- **Verifique antes de escrever cada linha.** As fontes vivas, em ordem: `apps/api/package.json` e `apps/web/package.json` (stack real), `packages/ai-engine/src/tools/` (tools reais), `package.json` da raiz (scripts reais), `apps/api/src/` (módulos reais: `adventure`, `ai`, `auth`, `character`, `game`, `system`, `user`), `render.yaml` e `apps/web/vercel.json` (topologia de produção).
- **O README novo canibaliza a árvore de diretórios existente**, não a duplica: se o diagrama Mermaid já mostra `apps/api`, o bloco ASCII de estrutura pode encolher ou sair. Deletar é o desfecho preferido — a [US-86](./US-86-gate-de-caminhos-em-arvores-de-diretorio-nos-docs.md) existe justamente porque árvore que sobrevive precisa de gate, e foi numa dessas que o `prisma/` mentiu por um mês. Se sobrar árvore, ela nasce sob aquele gate.
- **Cuidado com o `packages/ai-engine/dist`**: a API consome o build, não o `src`. É armadilha que já custou tempo — vale uma linha no README, não um parágrafo.
- Fontes secundárias para o *porquê* das setas do diagrama: `AGENTS.md`, `docs/prd.md`, `docs/adr/`. Prefira **linkar** a resumir.
- Mermaid: mantenha o `flowchart` abaixo de ~12 nós. Diagrama que não cabe numa tela não é diagrama de alto nível, é planta baixa — e é o primeiro a apodrecer.
- Estilo: o README é a porta de entrada. Frase curta, nada de "robusto/escalável/moderno". Se uma seção não muda uma decisão de quem lê, corte.

### Camada 2, concretamente

> **Registro do que foi feito, não instrução.** A [US-79](./US-79-consertar-links-quebrados-na-documentacao.md) implementou isto em 27/07/2026 — inclusive a previsão de que os efeitos colaterais abaixo seriam inofensivos, que se confirmou (0 quebrados novos com a ampliação). A única diferença: entraram os **três** `.md` da raiz, não só o README, e por **lista explícita** (`ROOT_MD`) em vez de glob — um glob de `*.md` na raiz varreria rascunho solto e o gate de nome da [US-82](./US-82-gate-de-convencao-de-nomes-de-arquivo-nos-docs.md) o reprovaria.

~~A varredura em `check-doc-links.mjs:77` é `const files = (await mdFiles(DOCS)).sort();`. Basta acrescentar o README da raiz à lista~~ — hoje é `:95-97`, somando `mdFiles(DOCS)` e `ROOT_MD.map(...)`.

Efeitos colaterais já conferidos, não precisa investigar de novo:

- **Gate de nome (US-82):** `README.md` não começa com `US-`, não tem espaço nem byte não-ASCII → passa nas duas regras. Nenhuma entrada nova em `NAME_ALLOW`.
- **Isenção de `docs/prompts/`:** `isPrompts()` resolve o README da raiz para `..\README.md`, que não começa com `prompts` → não entra na isenção nem no trip-wire.
- **Links do README de hoje** (`AGENTS.md`, `CLAUDE.md`, `docs/prd.md`) resolvem a partir da raiz e já passariam.

Cuidado ao escolher o que virar link: caminho que **não existe de propósito** (exemplo ilustrativo, arquivo que a story vai criar) tem que ficar em backtick, senão o gate acusa com razão.

### Camada 3, concretamente

Copie a estrutura de [`rubric-drift.test.ts`](../../../packages/ai-engine/src/rubric-drift.test.ts), inclusive o comentário explicando **por que não é `toMatchSnapshot`** — a resposta é a mesma aqui: `vitest -u` regrava sem ninguém olhar, e "olhar" é o produto inteiro do teste. O hash cobre a *forma*: liste os diretórios com `readdirSync`, ordene, junte, hasheie. Não hasheie conteúdo de arquivo — muda toda semana e treina a pessoa a colar hash no automático, que é o fracasso do mecanismo.

---

## Questões em aberto

1. ~~O `@nestjs/platform-socket.io` está nas dependências da API mas o multiplayer é Fase 4 — o WebSocket está **em uso hoje** (streaming? presença?) ou é dependência morta?~~ **Respondida e limpa em 28/07/2026: era dependência morta.** Grep no repo (fora de `node_modules`, `dist` e lock): **0** ocorrências de `@WebSocketGateway`, `@SubscribeMessage`, `useWebSocketAdapter` ou `IoAdapter`; [`main.ts`](../../../apps/api/src/main.ts) só faz `NestFactory.create` + `listen`; nenhum `socket.io-client` em [`apps/web`](../../../apps/web). Os únicos hits eram as próprias duas linhas de dependência.

   **O streaming nunca foi WebSocket — é SSE puro sobre HTTP.** [`ai.controller.ts`](../../../apps/api/src/ai/ai.controller.ts) seta `Content-Type: text/event-stream` à mão e escreve no `@Res()`; o proxy do Next ([`route.ts`](../../../apps/web/src/app/api/chat/route.ts)) repassa o mesmo content-type. Não é preferência de estilo: o proxy da [US-60](./US-60-web-em-producao-vercel.md) sobrevive no plano Hobby porque SSE atravessa proxy HTTP comum — um upgrade de protocolo para WebSocket não sobreviveria ali.

   **Consequência para esta story:** o diagrama de componentes **não** desenha seta de WebSocket, e a limpeza não virou story própria — `@nestjs/platform-socket.io` e `@nestjs/websockets` saíram de [`apps/api/package.json`](../../../apps/api/package.json) na mesma passada (remoção de duas linhas, sem código a migrar). Quando o multiplayer da Fase 4 existir, elas voltam com um gateway junto.
2. A seção **Produção** entra no README ou vira `docs/deploy.md` linkado? Argumento para README: é a pergunta nº 2 de quem chega. Argumento contra: é a seção que mais apodrece. Recomendação: fica no README, mas em 5 linhas, com os detalhes nas US-58/59/60.
3. ~~Vale um terceiro diagrama para a pipeline de evals (`pnpm eval`, LLM-judge, live eval)? É subsistema real e não óbvio, mas talvez pertença a um README de `evals/` — que está fora de escopo aqui.~~ **Respondida em 28/07/2026 e promovida a story: [US-90](./US-90-readme-de-evals-com-mapa-do-subsistema.md).** Duas partes:

   - **Diagrama: não.** A auditoria da US-90 achou **4 modos independentes** (suite vitest gateada no CI, guard de drift da rubrica que roda no `pnpm test`, bake-offs `.mjs` fora do vitest, live eval no `onFinish`). Não se encadeiam — não formam fluxo, formam lista. Tabela de 4 linhas lê melhor e não apodrece por omissão, que é o defeito que a camada 3 desta story existe para pegar.
   - **README de `evals/`: sim, e ele já existia mentindo.** [`evals/README.md`](../../../evals/README.md) tem o mesmo apodrecimento que gerou esta story: afirma `runner.ts` e `scorer.ts` (não existem), `fixtures/` com dados (está vazia), 4 casos com nomes errados (são 11, outros nomes), 3 flags que o vitest não aceita, uma interface `EvalCase` que 0 de 11 casos usam, e 3 thresholds sem mecanismo que os meça. Ele também **não é varrido** pelo `pnpm docs:links` — `ROOT_MD` cobre só os três `.md` da raiz —, que é exatamente por que pôde mentir tanto tempo.

   **Consequência para o escopo desta story:** a seção de evals no README da raiz encolhe para ≤ 2 linhas + link para a US-90. Um subsistema com 4 casas não cabe na porta de entrada.

---

## Referências no código

- `README.md` — o alvo da story; hoje descreve stack e caminhos que não existem.
- `apps/api/prisma/schema.prisma` — o estado autoritativo; ~~o README aponta para `prisma/` na raiz, que não existe~~ **corrigido em 27/07/2026** no README e nas outras 3 cópias.
- `packages/ai-engine/src/tools/` — apenas `roll-dice.ts` e `index.ts`. **Não é o inventário de tools**: as outras 5 são definidas inline em `apps/api/src/ai/ai.service.ts:349-585`. Quem contar tools só por esta pasta erra por 5.
- `apps/api/package.json` — sem Redis, BullMQ, pgvector ou S3, todos afirmados hoje no README.
- `apps/api/src/` — os módulos reais (`adventure`, `ai`, `auth`, `character`, `game`, `system`, `user`) são o esqueleto do diagrama de componentes.
- `render.yaml` — topologia de produção da API.
- `package.json` (raiz) — a lista real de scripts, incluindo `srd:sync` e `srd:ingest`, ausentes do README.
- [`scripts/check-doc-links.mjs`](../../../scripts/check-doc-links.mjs) — o gate. Endereços atualizados em 27/07/2026 (o `--fix` da US-79 levou o arquivo de ~217 para 279 linhas): `:46` (`stripCode`, decide o que é verificado), `:36` + `:95-97` (a varredura, que **já inclui** os três `.md` da raiz), `:108` (isenção de `docs/prompts/`).
- [`packages/ai-engine/src/rubric-drift.test.ts`](../../../packages/ai-engine/src/rubric-drift.test.ts) — o molde da camada 3, comentário incluído.
- [`AGENTS.md`](../../../AGENTS.md) — onde entra a linha da camada 4.
