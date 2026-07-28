# US-88 — Doc que ordena deixa de citar API que não existe

**Épico:** 0 — Infra e documentação
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** [US-78](./US-78-vault-obsidian-para-os-docs.md) e [US-79](./US-79-consertar-links-quebrados-na-documentacao.md) — **satisfeitas**. Entregaram `scripts/check-doc-links.mjs` e o par `pnpm docs:links` / `docs:links:test`. Esta story **estende** esse script; não cria um segundo.
**Nasceu de:** sessão de 27/07/2026. Ao apagar o `rollDiceTool` morto do `ai-engine`, apareceu que as *Regras absolutas* do [`AGENTS.md`](../../../AGENTS.md) mandavam toda mutação de estado passar por `updateCharacterSheet` e `advanceQuest` — **nenhuma das duas existe**. Corrigido à mão na hora; a baseline por script veio depois e achou uma terceira que ninguém tinha visto (`useChat`).
**Relacionada a:** [US-86](./US-86-gate-de-caminhos-em-arvores-de-diretorio-nos-docs.md) (mesma família, outra classe: caminho em árvore), [US-82](./US-82-gate-de-convencao-de-nomes-de-arquivo-nos-docs.md) (gate mecânico sobre doc), [US-80](./US-80-ci-typecheck-testes-e-evals.md) (é lá que o gate ganha dentes), [US-83](./US-83-readme-com-arquitetura-alto-nivel.md) (auditou a tabela de 7 tools do README — o mesmo defeito, achado à mão).
**Criada em:** 2026-07-27

---

## História

> **Como** agente (ou dev) que lê o `AGENTS.md` para saber qual função chamar,
> **quero** que todo identificador citado em regra normativa exista no código-fonte,
> **para que** a doc não me mande chamar uma API inexistente — e eu não a invente para obedecer.

---

## Contexto e motivação

### O problema observado

[`AGENTS.md`](../../../AGENTS.md), seção *Regras absolutas (nunca violar)*, até 27/07/2026:

> **Toda ação do LLM que altera estado passa pela tool correspondente** (`updateCharacterSheet`, `advanceQuest`, `rollDice`, etc.)

Das três, só `rollDice` existe. As tools vivas que mutam estado são `updateCharacterHp`, `updateInventory`, `updateScene` e `recordEntity` ([`ai.service.ts:349-585`](../../../apps/api/src/ai/ai.service.ts)).

**A gravidade vem da seção, não do erro.** Uma tabela descritiva que erra vira ruído: o leitor confere e descarta. Uma regra marcada "nunca violar" que erra vira instrução: o agente procura `updateCharacterSheet`, não acha, e a saída natural é **escrever** a chamada — código novo para uma interface que não existe, em cima de uma regra que ele foi mandado obedecer. Doc que descreve envelhece; doc que ordena produz.

### Por que a solução atual não basta

Três classes de afirmação sobre o repo, três coberturas:

| Classe | Exemplo | Coberta por |
|---|---|---|
| Link para arquivo | `[ai.service.ts](../../../apps/api/...)` | US-78/79 — **existe** |
| Caminho nu em árvore | `prisma/` dentro de fence | [US-86](./US-86-gate-de-caminhos-em-arvores-de-diretorio-nos-docs.md) — planejada |
| **Identificador em prosa** | `` `updateCharacterSheet` `` | **nada** |

O `docs:links` não podia ter pego: ele resolve alvo de link no filesystem. `updateCharacterSheet` não é caminho, é nome — e o arquivo onde ele *deveria* estar existe e está linkado corretamente. Link verde, afirmação falsa.

### Baseline medida (27/07/2026)

Critério: token em backtick, **fora de bloco cercado**, casando `/^[a-z][a-z0-9]*[A-Z][A-Za-z0-9]*$/` (camelCase com pelo menos uma maiúscula), procurado como substring em `apps/*/src`, `packages/*/src`, `scripts/` e `evals/` (`.ts`, `.tsx`, `.mjs`, `.js`, `.prisma`, `.json`, `.yaml`), sem `node_modules/`, `dist/` nem `generated/`.

| Corpus | Arquivos | Identificadores cobrados | Não existem no fonte |
|---|---|---|---|
| `AGENTS.md`, `CLAUDE.md`, `README.md` | 3 | 13 | **7** |
| `docs/` recursivo | 97 | 210 | **49** (23%) |

Os 7 do primeiro corpus, todos no `AGENTS.md`: `rollDiceTool`, `getRule`, `advanceQuest`, `recallMemory`, `getCharacterState`, `addEventLog` — **seis são menções deliberadas**, na seção que diz que essas tools *não* existem — e `useChat`, que é bug vivo (abaixo).

**Os 23% do `docs/` são o número que decide o escopo.** Amostra do que aparece lá: `createCampaign` e `joinCampaign` (US-22, proposta), `pontosRestantes` (US-26, proposta), `defineConfig`/`stopPropagation`/`readdirSync`/`packageManager` (API de terceiro ou de ferramenta), `sequenceDiagram` (palavra-chave de Mermaid), `strokeWidth` (SVG). Quase nada é defeito. **US propõe nome que não existe — é o gênero.** Gate ali reprova documento correto, e gate com falso positivo é gate que alguém desliga (a [US-86](./US-86-gate-de-caminhos-em-arvores-de-diretorio-nos-docs.md) chegou à mesma conclusão pelo caminho do `base=`).

### O achado vivo: `useChat`

[`AGENTS.md:54`](../../../AGENTS.md), seção *Frontend*: *"Streaming de narração token-a-token via `useChat` do Vercel AI SDK"*.

- Zero hits de `useChat` em `apps/web/src`.
- O streaming real é `fetch` + leitura manual em [`GameView.tsx:311`](../../../apps/web/src/components/game/GameView.tsx): `const reader = res.body!.getReader()`.
- `@ai-sdk/react` está em [`apps/web/package.json:14`](../../../apps/web/package.json) (`^1.2.12`) e **nunca é importado**.

Mesma família do `rollDiceTool`: dependência e doc de um desenho que não foi adiante, com o código tendo seguido outro caminho. Sobreviveu a todas as leituras manuais do `AGENTS.md` desta fase — inclusive às desta mesma sessão, que estavam olhando exatamente para este defeito.

---

## Escopo

### Dentro do escopo

- Checagem nova em [`scripts/check-doc-links.mjs`](../../../scripts/check-doc-links.mjs), rodando **só sobre `ROOT_MD`** (`AGENTS.md`, `CLAUDE.md`, `README.md`) — a constante já existe no script (`:36`).
- Extração: token em backtick simples, fora de fence (`stripCode()` já entrega isso), casando a regex de camelCase acima.
- Verificação: substring nos fontes listados na baseline. Índice lido uma vez em memória.
- `GHOST_ALLOW` no padrão do `NAME_ALLOW` que o script já tem (`:113`), **com o motivo por entrada** — as 6 menções deliberadas são citadas justamente como inexistentes.
- **Aviso quando entrada do `GHOST_ALLOW` voltar a existir no fonte.** Sem isso o allowlist vira o próximo fóssil, e a story reencena o problema um nível acima.
- Bucket próprio no relatório e exit ≠ 0 no gate.
- Teste de regressão em [`scripts/check-doc-links.test.mjs`](../../../scripts/check-doc-links.test.mjs), padrão `node:test` da US-79.
- **Corrigir o `useChat`:** trocar a linha do *Frontend* pelo que o código faz (`fetch` + `getReader()`), citando `file:line`.

### Fora do escopo

- **O corpus `docs/`.** 49 hits em 210, e a maioria é proposta legítima de US. Ver *Questões em aberto* #2 antes de reabrir.
- **Assinatura errada.** `updateCharacterHp` existe, então a linha passa mesmo que a doc descreva parâmetros que a tool não aceita — foi esse o defeito do `roll-dice.ts` apagado hoje (`formula: "2d6+3"` contra a real, que recebe `skill`). Não há gate barato para isso; o que existe é a convenção de citar `file:line` + data de verificação.
- **Identificador sem backtick.** Fora da convenção de escrita do repo, e sem backtick a ambiguidade com prosa é alta demais.
- **Modo `--fix`.** Nome inexistente pode ser rename, feature apagada ou nome planejado. É o bucket "reportar, não reescrever" da [US-79](./US-79-consertar-links-quebrados-na-documentacao.md) (`:99`).
- **Dependência instalada e nunca importada** (`@ai-sdk/react`, e o `ai` do `apps/web`). É a mesma raiz vista do outro lado, mas a ferramenta é outra (`knip`) e o custo é uma story própria — ver *Questões em aberto* #3.

---

## Critérios de aceite

- [ ] `pnpm docs:links` reporta bucket novo de identificador inexistente, com arquivo, linha e o nome, e sai ≠ 0 quando houver.
- [ ] A checagem roda **só** em `AGENTS.md`, `CLAUDE.md` e `README.md`; rodar o gate não reprova nenhum arquivo de `docs/`.
- [ ] **Zero falsos positivos na baseline atual:** com o `GHOST_ALLOW` das 6 menções deliberadas e a linha do `useChat` corrigida, os 13 identificadores cobrados saem todos verdes.
- [ ] Entrada do `GHOST_ALLOW` que voltou a existir no fonte aparece no relatório como aviso (não derruba o gate — a doc está certa; o allowlist é que está velho).
- [ ] `AGENTS.md` descreve o streaming do frontend como ele é (`fetch` + `res.body.getReader()` em `GameView.tsx:311`), sem citar `useChat`.
- [ ] **Teste de regressão:** fixture `.md` citando `` `naoExisteEmLugarNenhum` `` é reprovada; fixture citando um identificador real e outro do allowlist passa. Fixture apagada no `finally`, como a da US-79.
- [ ] **Nenhuma reescrita.** `git status` limpo depois de rodar o gate.
- [ ] Passo *Gate de docs* da [US-80](./US-80-ci-typecheck-testes-e-evals.md) continua verde sem mudança no workflow.

---

## Notas de implementação

- **A máscara existente serve direto.** Ao contrário da [US-86](./US-86-gate-de-caminhos-em-arvores-de-diretorio-nos-docs.md), que precisa do conteúdo que o `stripCode()` (`:46`) joga fora, aqui o que interessa é justamente o que sobra depois dele: prosa. Sem refactor do parser de fence.
- **Match por substring, não por AST.** `getRule` casa com `getRules` e com um comentário que só mencione o nome. Falso-negativo assumido: o inimigo é o falso positivo, que desliga o gate. Teto conhecido — TypeScript compiler API custa uma ordem de grandeza a mais para pegar um caso que ninguém observou.
- **Excluir `dist/` e `generated/` do índice.** `dist/` é build do próprio `src` (só duplica), e `apps/api/src/generated/prisma` é código gerado com milhares de nomes — um identificador que só existe lá não é API do projeto, e incluí-lo criaria falso-negativo silencioso.
- **A maiúscula obrigatória é o que mata o ruído.** `/^[a-z][a-z0-9]*[A-Z]/` exclui `pnpm`, `tsc`, `nest`, `dotenv` e todo caminho/flag (têm `/`, `.` ou `-`). Foi ela que trouxe o corpus normativo para 13 tokens cobrados.
- **Não configurar a lista de diretórios de fonte por arquivo externo.** Config global vira lista de exceções que ninguém revisa (mesmo argumento do `base=` opt-in da US-86). Constante no topo do script, ao lado de `ROOT_MD`.
- O script roda sobre **disco**, não `git ls-files` — motivo registrado na US-79 (`:142`): `core.quotePath` faz arquivo com byte não-ASCII sumir da listagem sem aviso.

---

## Questões em aberto

1. **13 tokens cobrados justificam o gate?** O corpus normativo é minúsculo — a checagem cobra pouca coisa. O argumento a favor é o valor por unidade, não o volume: são os 3 arquivos que todo agente lê antes de escrever qualquer linha, e o erro que eles produzem é código, não confusão. Se depois de uma fase o bucket nunca mais acender, é candidato legítimo a ser apagado — e apagar gate morto é a mesma regra que apagou o `rollDiceTool`.
2. **Estender para `docs/sdlc/03-implementacao/`?** `convencoes.md` também **ordena**, e não é proposta como US é. É o próximo corpus a medir; não abrir sem medir (a baseline aqui existe justamente porque o palpite de FP era outro).
3. **Nome de API de terceiro.** `useChat` **é** de biblioteca, e reprovar foi o comportamento certo: o repo afirmava usá-lo e não usava. Mas se algum dia o `AGENTS.md` citar uma API externa que legitimamente não aparece no fonte, o `GHOST_ALLOW` absorve — com motivo escrito, que é o que impede o allowlist de virar depósito.
4. **Ordem com a US-83.** Ela quer deletar a tabela de 7 tools do README. Se rodar antes, 5 dos hits desta baseline somem sozinhos e o `GHOST_ALLOW` nasce menor. Desfecho preferido: linha apagada não precisa de gate.

---

## Referências no código

- [scripts/check-doc-links.mjs](../../../scripts/check-doc-links.mjs) — `ROOT_MD` (`:36`), `stripCode()` (`:46`), `NAME_ALLOW` (`:113`) e a estrutura de buckets do relatório.
- [scripts/check-doc-links.test.mjs](../../../scripts/check-doc-links.test.mjs) — padrão de fixture temporária com `try/finally`.
- [AGENTS.md](../../../AGENTS.md) — *Regras absolutas* (o defeito de origem), *Frontend* `:54` (o `useChat`), e a regra "roadmap não vira código" em *Padrões de código → Comentários*.
- [apps/api/src/ai/ai.service.ts](../../../apps/api/src/ai/ai.service.ts) — objeto `tools` (`:349-585`), fonte de verdade dos nomes de tool.
- [apps/web/src/components/game/GameView.tsx](../../../apps/web/src/components/game/GameView.tsx) — `:311`, o streaming real do frontend.
- [.github/workflows/ci.yml](../../../.github/workflows/ci.yml) — passos *Gate de docs* e *Teste do gate de docs*.
