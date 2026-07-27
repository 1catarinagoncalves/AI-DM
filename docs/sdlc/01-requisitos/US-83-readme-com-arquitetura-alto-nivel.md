# US-83 — README com arquitetura de alto nível

**Épico:** 5 — Ferramentas de projeto / SDLC
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** nenhuma. Convive com a [US-79](./US-79-consertar-links-quebrados-na-documentacao.md) (os links novos do README precisam passar no `pnpm docs:links`) e com a [US-82](./US-82-gate-de-convencao-de-nomes-de-arquivo-nos-docs.md), mas não espera nenhuma das duas. Ganha dentes com a [US-80](./US-80-ci-typecheck-testes-e-evals.md) (CI) pela mesma razão da US-82: sem CI, o gate anti-drift é comando local.
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

| O que o README afirma | O que o repo tem | Onde verificar |
|---|---|---|
| `prisma/` na raiz | `apps/api/prisma/` (schema, migrations, seed) | `ls prisma` falha |
| Redis, BullMQ, pgvector, S3 | nenhum dos quatro nas dependências da API | `apps/api/package.json` |
| 7 tools do DM Agent (`getRule`, `advanceQuest`, `recallMemory`…) | **1** arquivo de tool: `roll-dice.ts` | `packages/ai-engine/src/tools/` |
| — (não menciona) | Neon, Render, Vercel, Auth.js/Google, evals com LLM-judge, ingestão de SRD (`srd:sync`/`srd:ingest`) | US-58 a US-61, `package.json` |

Ou seja: as três primeiras linhas de contexto que um agente lê são **roadmap escrito no presente**. O custo não é estético — é um agente propondo `prisma migrate` na pasta errada, ou "reaproveitar o worker BullMQ" que nunca existiu.

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

#### Camada 2 — todo caminho é link, e o README entra no gate (~2 linhas de código)

`scripts/check-doc-links.mjs` já resolve destino de link e falha se não existir. O `stripCode` (`:35-45`) apaga code span **antes** de procurar link — o que decide se uma afirmação é verificada ou invisível:

```md
`apps/api/prisma`                        <- invisível ao gate: backtick apagado em :43
[`apps/api/prisma`](apps/api/prisma)     <- MESMA renderização, e o alvo é verificado
```

Comportamento confirmado contra o `LINK_RE` e o `stripCode` reais: o backtick some do *texto* do link, os colchetes vazios continuam casando, e o destino é checado. Ou seja, **o custo de blindar um caminho é escrevê-lo como link** — não é disciplina nova, é hábito de Markdown.

Duas pegadinhas achadas escrevendo esta própria story, ambas relevantes para quem for linkar as ~10 pastas do README:

1. **Link de diretório não aceita barra final.** `](apps/api/prisma/)` falha no `existsSync`; o script acusa e sugere a versão sem barra.
2. **O exemplo acima precisa viver dentro de um code fence**, não numa tabela. Fence inteiro é neutralizado (`:38-41`); já o wrapper de backtick duplo numa célula de tabela **não** protege — o `stripCode` casa os pares de backtick e devolve um `](destino)` intacto, que o `LINK_RE` pega. Foi exatamente assim que a primeira versão desta seção quebrou o gate: link ilustrativo, caminho certo visto da **raiz**, errado visto de `docs/sdlc/01-requisitos/`.

Falta o README entrar no escopo: `:77` varre só `DOCS`.

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
  - camada 2 — todo caminho do README escrito como link relativo, e `README.md` da raiz incluído na varredura do `scripts/check-doc-links.mjs`;
  - camada 3 — teste de drift da forma do sistema, no idioma do `rubric-drift.test.ts`;
  - camada 4 — linha no *Definition of Done* do `AGENTS.md`.

### Fora do escopo

- **README por pacote** (`apps/web/README.md`, `packages/ai-engine/README.md`). Um README bom na raiz resolve 90% do problema de onboarding; quatro READMEs criam quatro fontes para dessincronizar. Se depois de pronto ainda faltar, vira story própria.
- **ADR nova.** Esta story *documenta* decisões já tomadas e registradas; não toma nenhuma. Se a escrita revelar uma decisão sem ADR, o entregável é uma questão em aberto, não uma ADR escrita de improviso.
- **Gerar o README a partir do código.** Elimina o drift e mata o valor junto: um README é útil porque escolhe *o que não contar*. Gerador não sabe que `@nestjs/platform-socket.io` pode ser dependência dormente — só sabe que está no `package.json`, e reintroduz exatamente a mentira que esta story existe para consertar.
- **Linter que parseia prosa** atrás de afirmações sobre o código. Falso positivo caro, ninguém confia, todo mundo desliga. As camadas 2 e 3 cobrem o que dá para cobrir mecanicamente; o resto é o critério de "cada afirmação verificável na revisão".
- **Traduzir o README para inglês.** O repo é pt-BR (ver [`locale`](./US-71-simplificar-localizacao-do-personagem.md) — bilíngue é dado de jogo, não de documentação).
- Reescrever `docs/README.md` (é o índice do vault Obsidian da [US-78](./US-78-vault-obsidian-para-os-docs.md), escopo diferente).

---

## Critérios de aceite

- [ ] O `README.md` da raiz tem uma seção **Arquitetura** contendo pelo menos um diagrama Mermaid de componentes e um `sequenceDiagram` do fluxo de um turno.
- [ ] Os diagramas renderizam no GitHub (bloco ` ```mermaid `, sem dependência externa) e continuam legíveis como texto puro para quem lê via `cat` — nomes de nó = nomes reais de diretório/serviço.
- [ ] **Zero afirmações não verificáveis:** toda tecnologia citada como presente aparece em um `package.json` do repo, e todo caminho citado existe. As 4 linhas da tabela de "O problema observado" estão corrigidas.
- [ ] Existe seção que responde, sem o leitor abrir outro arquivo: *onde o estado de jogo vive* e *o que o LLM tem permissão de alterar*.
- [ ] Existe seção **Produção** nomeando os três provedores em uso e o que cada um hospeda.
- [ ] O que ainda não existe aparece **apenas** no Roadmap, em tempo futuro — nunca na Stack nem na Arquitetura.
- [ ] `pnpm docs:links` passa **e inclui o `README.md` da raiz** na contagem de arquivos varridos.
- [ ] Nenhum caminho de arquivo/pasta do README aparece só entre backticks: todos são link relativo (senão o gate da camada 2 não os enxerga).
- [ ] O README não transcreve nenhuma lista que já existe no repo (dependências, tools, scripts): aponta para a fonte.
- [ ] Existe teste que falha quando a forma do sistema muda (pasta de topo, módulo em `apps/api/src/`, arquivo em `packages/ai-engine/src/tools/`), com mensagem mandando revisar a seção Arquitetura do README.
- [ ] **Teste de regressão / eval:** um agente sem contexto, lendo **só** o `README.md`, responde corretamente: (a) em que pasta fica o `schema.prisma`; (b) qual componente rola os dados; (c) qual comando roda os evals. Hoje o README erra (a) e induz erro em (b).
- [ ] **Regressão do próprio antídoto:** mover ou renomear `apps/api/prisma/` faz `pnpm docs:links` falhar apontando a linha do README. É o cenário exato que passou despercebido e produziu esta story.

---

## Notas de implementação

> Dicas para quem implementa. Não é especificação obrigatória.

- **Verifique antes de escrever cada linha.** As fontes vivas, em ordem: `apps/api/package.json` e `apps/web/package.json` (stack real), `packages/ai-engine/src/tools/` (tools reais), `package.json` da raiz (scripts reais), `apps/api/src/` (módulos reais: `adventure`, `ai`, `auth`, `character`, `game`, `system`, `user`), `render.yaml` e `apps/web/vercel.json` (topologia de produção).
- **O README novo canibaliza a árvore de diretórios existente**, não a duplica: se o diagrama Mermaid já mostra `apps/api`, o bloco ASCII de estrutura pode encolher ou sair.
- **Cuidado com o `packages/ai-engine/dist`**: a API consome o build, não o `src`. É armadilha que já custou tempo — vale uma linha no README, não um parágrafo.
- Fontes secundárias para o *porquê* das setas do diagrama: `AGENTS.md`, `docs/prd.md`, `docs/adr/`. Prefira **linkar** a resumir.
- Mermaid: mantenha o `flowchart` abaixo de ~12 nós. Diagrama que não cabe numa tela não é diagrama de alto nível, é planta baixa — e é o primeiro a apodrecer.
- Estilo: o README é a porta de entrada. Frase curta, nada de "robusto/escalável/moderno". Se uma seção não muda uma decisão de quem lê, corte.

### Camada 2, concretamente

A varredura em `check-doc-links.mjs:77` é `const files = (await mdFiles(DOCS)).sort();`. Basta acrescentar o README da raiz à lista — `join(ROOT, "README.md")`, com `join` e `ROOT` já importados no topo do arquivo.

Efeitos colaterais já conferidos, não precisa investigar de novo:

- **Gate de nome (US-82):** `README.md` não começa com `US-`, não tem espaço nem byte não-ASCII → passa nas duas regras. Nenhuma entrada nova em `NAME_ALLOW`.
- **Isenção de `docs/prompts/`:** `isPrompts()` resolve o README da raiz para `..\README.md`, que não começa com `prompts` → não entra na isenção nem no trip-wire.
- **Links do README de hoje** (`AGENTS.md`, `CLAUDE.md`, `docs/prd.md`) resolvem a partir da raiz e já passariam.

Cuidado ao escolher o que virar link: caminho que **não existe de propósito** (exemplo ilustrativo, arquivo que a story vai criar) tem que ficar em backtick, senão o gate acusa com razão.

### Camada 3, concretamente

Copie a estrutura de [`rubric-drift.test.ts`](../../../packages/ai-engine/src/rubric-drift.test.ts), inclusive o comentário explicando **por que não é `toMatchSnapshot`** — a resposta é a mesma aqui: `vitest -u` regrava sem ninguém olhar, e "olhar" é o produto inteiro do teste. O hash cobre a *forma*: liste os diretórios com `readdirSync`, ordene, junte, hasheie. Não hasheie conteúdo de arquivo — muda toda semana e treina a pessoa a colar hash no automático, que é o fracasso do mecanismo.

---

## Questões em aberto

1. O `@nestjs/platform-socket.io` está nas dependências da API mas o multiplayer é Fase 4 — o WebSocket está **em uso hoje** (streaming? presença?) ou é dependência morta? A resposta muda o diagrama e pode gerar uma story de limpeza.
2. A seção **Produção** entra no README ou vira `docs/deploy.md` linkado? Argumento para README: é a pergunta nº 2 de quem chega. Argumento contra: é a seção que mais apodrece. Recomendação: fica no README, mas em 5 linhas, com os detalhes nas US-58/59/60.
3. Vale um terceiro diagrama para a pipeline de evals (`pnpm eval`, LLM-judge, live eval)? É subsistema real e não óbvio, mas talvez pertença a um README de `evals/` — que está fora de escopo aqui.

---

## Referências no código

- `README.md` — o alvo da story; hoje descreve stack e caminhos que não existem.
- `apps/api/prisma/schema.prisma` — o estado autoritativo; o README aponta para `prisma/` na raiz, que não existe.
- `packages/ai-engine/src/tools/` — apenas `roll-dice.ts` e `index.ts`; o README lista 7 tools.
- `apps/api/package.json` — sem Redis, BullMQ, pgvector ou S3, todos afirmados hoje no README.
- `apps/api/src/` — os módulos reais (`adventure`, `ai`, `auth`, `character`, `game`, `system`, `user`) são o esqueleto do diagrama de componentes.
- `render.yaml` — topologia de produção da API.
- `package.json` (raiz) — a lista real de scripts, incluindo `srd:sync` e `srd:ingest`, ausentes do README.
- [`scripts/check-doc-links.mjs`](../../../scripts/check-doc-links.mjs) — o gate. `:35-45` (`stripCode`, decide o que é verificado), `:77` (a varredura que precisa incluir o README), `:83` (isenção de `docs/prompts/`).
- [`packages/ai-engine/src/rubric-drift.test.ts`](../../../packages/ai-engine/src/rubric-drift.test.ts) — o molde da camada 3, comentário incluído.
- [`AGENTS.md`](../../../AGENTS.md) — onde entra a linha da camada 4.
