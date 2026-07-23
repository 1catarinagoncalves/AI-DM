# US-36 — Eval de qualidade da narração do DM

**Épico:** 2 — Aventura
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada (2026-07-23)
**Depende de:** [US-34](./US-34-qualidade-da-narracao-do-dm.md) (barra de ofício + abertura gerada) e da suíte de evals existente (`evals/`, `pnpm eval`).
**Criada em:** 2026-07-07

---

## História

> **Como** desenvolvedor do DM Agent,
> **quero** um eval automatizado que pontue a qualidade da narração por uma rubrica,
> **para que** mudanças no prompt, no modelo ou no fallback não degradem a narração sem que ninguém perceba antes de chegar ao jogador.

---

## Contexto e motivação

### O problema observado

A [US-34](./US-34-qualidade-da-narracao-do-dm.md) coloca a barra de qualidade da narração num **prompt** — hoje a seção `## Narrative craft (the quality bar…)` + `### Onomastics` em `dm-system.ts` (montada por `buildDmSystemPrompt`). Prompt é frágil a regressão silenciosa: qualquer edição nessa seção, troca de modelo ou queda pela escada de fallback da narração pode fazer a narração cair de nível sem quebrar nenhum teste. A escada de narração hoje (`model.ts`, `narrationModels`) é: **`deepseek-v4-flash`** (primário, OpenRouter) → **`deepseek-v4-pro`** (fallback, OpenRouter) → **`llama-3.3-70b-versatile`** (3º nível, Groq — outro provider, sobrevive a outage do OpenRouter). Hoje, o único jeito de perceber uma regressão é **jogando e lendo** — lento, subjetivo e inconsistente.

A suíte de evals atual (`evals/cases/`) mede **comportamento e correção** — tools corretas, ausência de alucinação de regras, state persistido. Ela **não** mede **qualidade literária** da prosa. Ou seja: um turno pode passar em todos os evals atuais e ainda assim narrar de forma genérica e sem vida.

### A proposta

Adicionar um eval que pontua a **qualidade da narração** por uma rubrica derivada da barra de ofício da US-34, usando **LLM-as-judge**. Cada caso roda uma narração (abertura e/ou turno) e um modelo juiz atribui nota por dimensão; abaixo de um threshold, o eval falha no CI, do mesmo jeito que os evals de comportamento.

O objetivo é **não regredir** a qualidade — o eval é rede de segurança, não a fonte da qualidade (essa vem do prompt da US-34).

---

## Escopo

### Dentro do escopo

- Novo(s) eval case(s) em `evals/cases/` para qualidade da narração, cobrindo pelo menos: **abertura gerada** (US-34) e **um turno de continuação**.
- **Rubrica** derivada da barra de ofício **atual** (`## Narrative craft` + `### Onomastics` de `dm-system.ts`), com as dimensões pontuáveis:
  - **Sentidos:** abre pelos sentidos (chuva, frio, luz), não pela exposição.
  - **Concretude & nomeação:** nomeia coisas específicas (a montaria, a espada, o símbolo sagrado, o NPC) em vez do genérico.
  - **Onomástica:** nomes próprios **originais** (sem os clichês de AI-fantasy — Elara/Kael/Lyra/Aria/Thorne…), com o **registro cultural** certo para raça/classe/ambiente (paladino soa greco-clássico; bárbaro do gelo, nórdico; etc.), consistentes dentro da aventura, com a frase ao redor em pt-BR natural.
  - **Classe/identidade como lente:** raça, classe, equipamento e habilidades afloram por ação e sensação — nunca como lista de stats (o paladino *sente* o mal como um arrepio, não como número).
  - **Tensão antes da explicação:** mostra a tensão (o silêncio errado de uma aldeia) antes de explicá-la.
  - **Voz e corpo dos NPCs:** NPC com voz, movimento, emoção e stakes — sobretudo os inocentes/vulneráveis (quando há NPC).
  - **Ritmo & concisão:** mistura frases curtas e longas; 3–5 parágrafos curtos; imersivo ≠ prolixo.
  - **Gancho vivo + opções:** fecha chamando o personagem pelo nome e então apresenta as opções.
  - **Língua natural pt-BR:** pt-BR fluente e contemporâneo — usa "você", evita "tu/vós" e construções lusitanas/traduzidas ("a fitar-te", "estás", "no teu encalço"). Não avaliar quando o jogador narra em inglês.
- **LLM-as-judge**: um modelo juiz (Gemini 3.5 Flash Lite) pontua cada dimensão numa **escala 1–5**, com **justificativa por dimensão** registrada no log.
- **Threshold** mínimo de qualidade configurado junto dos demais (`scorer.ts` / `docs/sdlc/04-testes/estrategia-de-testes.md`); abaixo dele, `pnpm eval --ci` sai com código ≠ 0.
- Casos de **regressão de formatação** que a rubrica também cobre (as regras de `## MANDATORY TEXT FORMATTING RULES` do prompt atual): opções em lista vertical com `-` + emoji (**nunca** `—`), diálogo com `—`, sem seções de status/stats nem tags de controle (`[WORLD_STATE_UPDATE…]`/JSON) na prosa, sem texto grudado (pontuação terminal + espaço), concordância de gênero conforme o world-state, e opções consistentes com o último parágrafo da narração.
- **Avaliação ao vivo em dev (async, por turno).** Em desenvolvimento, pontuar **cada turno real** com o mesmo juiz da rubrica, de forma **assíncrona** (fire-and-forget depois de responder ao jogador) — ver seção "Avaliação ao vivo em dev" abaixo. Só dev; nunca em produção.

### Fora do escopo

- Garantir um valor **absoluto** de "qualidade cinematográfica". O eval mede regressão contra uma barra e um conjunto de casos, não certifica excelência universal.
- Avaliar **consistência de cena/continuidade** entre turnos — isso é comportamento, coberto por evals de cena (US-11b) e pela US-35.
- **Avaliação ao vivo em produção.** O juiz por turno é **só de desenvolvimento**. Em produção não roda: sem custo de LLM extra por jogada, sem latência, sem risco de RPM. Monitoramento de qualidade em prod (async amostrado, painel/telemetria) seria uma US própria de eval online.
- Fine-tuning ou troca de modelo de narração. O eval **informa** decisões de modelo; não as executa.

---

## Onde os logs do eval são vistos

- **Terminal (principal).** O eval roda sobre **vitest** (`pnpm eval` = `vitest run --config vitest.eval.config.ts`). O resultado por caso — pass/fail, nota por dimensão e nota total — aparece na saída do terminal, como qualquer teste vitest.
- **`pnpm eval --verbose`** — imprime, por caso, a narração avaliada, a nota de cada dimensão da rubrica e a **justificativa do juiz**, para inspecionar *por que* um caso caiu.
- **`pnpm eval --filter us-36`** — roda só os casos de qualidade da narração, útil ao iterar no prompt da US-34.
- **CI.** No pipeline, `pnpm eval --ci` falha o job (exit ≠ 0) quando a nota fica abaixo do threshold; o log do job de CI mostra quais dimensões/casos reprovaram. É o mesmo portão já descrito no `evals/README.md` ("sem evals passando, nenhum PR que toca o AI Engine pode ser mergeado").
- **Relatório persistido.** A rubrica gera justificativa útil para comparar versões de prompt; gravar um relatório por execução em `evals/reports/us-36-<timestamp>.md` (ou `.json`) com narração + notas + justificativas. Fora do caminho obrigatório do CI, mas gerado sempre — permite revisar histórico sem rerodar. (Decisão 3.)

---

## Avaliação ao vivo em dev (async, por turno)

Além dos casos fixos rodados por `pnpm eval`, em **desenvolvimento** o mesmo juiz pontua **cada turno real** enquanto se joga — para ver a qualidade cair na hora, sem esperar o CI nem montar um caso.

- **Gatilho:** apenas em dev e atrás de flag (ex.: `DM_LIVE_EVAL`). Em produção **não roda** — nem carrega o juiz. (A API não auto-carrega `.env`; a flag vem do `.env` da raiz / env do Windows, como os demais secrets — ver "API env em dev".)
- **Assíncrono, não-bloqueante:** dispara **depois** que a narração do turno terminou de ser transmitida ao jogador — no `onFinish` do `streamText` (`apps/api/src/ai/ai.service.ts`), com o `finalText` já pronto. Fire-and-forget: **não** dar `await` no caminho do SSE. O jogador nunca espera o juiz; a nota chega ao log depois.
- **Reuso total:** chama o mesmo `judgeModel()` + rubrica dos casos de eval sobre o `finalText` do turno. Zero lógica de pontuação nova — só um ponto de chamada diferente.
- **Saída:** loga nota por dimensão + justificativa no terminal da API (e, se ligado, no relatório `evals/reports/`). Em dev é **observabilidade**, não portão: nota baixa avisa, não altera nem re-gera o que o jogador viu.
- **Falha isolada:** erro/timeout/quota do juiz não pode derrubar o turno — o fire-and-forget engole a exceção e loga um aviso. O turno já foi entregue; o juiz é opcional.
- **Ponytail:** sem amostragem nem fila no MVP — em dev o volume é 1 jogador. Se ficar barulhento/caro, amostrar (1 a cada N) depois.

## Metadados no relatório

Cada entrada do relatório grava, junto da narração + notas + justificativas, os **fatores que podem ter mudado entre duas execuções** — para que comparar dois relatórios responda *o que* mudou, não só *que* a nota caiu. Campos:

- **Timestamp** (já no nome do arquivo) + **git HEAD** (commit curto) e **branch** — o sinal mais forte de "o que mudou": prompt, código ou config vieram de um commit específico.
- **Modelo de narração que EFETIVAMENTE serviu:** slug + qual nível da escada (`narrationModels`: primário / fallback / 3º Groq) + provider. Uma queda ao fallback já explica a queda de qualidade sozinha (`onFinish` → `response.modelId`; o índice da escada vem do `attempt` do controller).
- **Sampling e limites:** `maxTokens` (hoje 4000), `frequencyPenalty` (hoje 0.3), `temperature` (default do provider se não setado), e `providerOptions` ativos (`NARRATION_PROVIDER_OPTIONS`). Mudar qualquer um mexe na prosa.
- **finishReason + `usage`** (tokens in/out) do turno — `length` sinaliza corte/degeneração (ver US-69), não queda de ofício; distinguir os dois ao ler a nota.
- **Versão do prompt de ofício:** o commit do git já cobre; opcionalmente um hash curto da seção `## Narrative craft` de `dm-system.ts` para detectar edição local não commitada.
- **Juiz:** slug do Gemini (o que `judgeModel()` resolveu) + temperatura do juiz — para não confundir mudança no juiz com mudança na narração.
- **Locale** do personagem (PT-BR / EN) e **id do caso/turno** avaliado.

Fonte: quase tudo sai do `onFinish` (`finishReason`, `usage`, `response`) + da config de `model.ts`/`ai.service.ts` no momento da run. Ponytail: gravar o que já está à mão no `onFinish`; não instrumentar coleta nova só para o relatório.

## Abordagem técnica

- **Caso de eval:** seguir o padrão de `evals/cases/` — objeto exportado com `id`, `description`, `story`, `input` (contexto + ação) e `assertions`. A diferença é que a assertion principal é uma **pontuação por juiz**, não uma verificação de tool.
- **Reusar `rubric.ts` (US-17), não recomeçar.** `packages/ai-engine/src/rubric.ts` já traz o juiz (`judgeTurn` + `generateObject` + schema Zod), a agregação, o custo e o render do relatório. A US-36 **estende `DIMENSIONS`** para a barra atual, em vez de criar rubrica nova. Hoje `DIMENSIONS` tem 6 eixos de antes da barra atual (`imersao`, `sensorial`, `agencia`, `vozNpc`, `ritmo`, `coerencia`) e **não** cobre onomástica, classe-como-lente, tensão-antes-da-explicação nem língua pt-BR — adicionar esses. `label`/`pergunta` de cada dimensão viram o texto que o juiz responde.
  - **Escala 1–5 (alinhada ao `rubric.ts`).** `rubricSchema` já é `nota` inteiro **1–5** (`z.number().int().min(1).max(5)`); a US-36 adota a mesma escala — zero mudança de schema e comparação histórica do bake-off da US-17 preservada.
- **Juiz:** o `judgeTurn` de `rubric.ts` chama **Gemini 3.5 Flash Lite pela API do Gemini** (via `judgeModel()` de `model.ts`, que usa `@ai-sdk/google` + `GEMINI_API_KEY`) com `generateObject` para saída estruturada e determinística de parsear. Juiz externo ao stack de narração (OpenRouter/Groq) reduz viés de auto-avaliação; temperatura baixa. Não usar OpenRouter para o juiz.
- **Scorer/threshold:** estender `scorer.ts` com a métrica de qualidade e seu mínimo; documentar na tabela de thresholds do `evals/README.md` e em `docs/sdlc/04-testes/estrategia-de-testes.md`.
- **Determinismo:** LLM-as-judge tem ruído. Mitigar com temperatura baixa no juiz, rubrica objetiva (critérios binários/graduados claros) e, se preciso, média de N julgamentos. Evitar transformar o eval em teste "flaky".
- **Fixtures:** reusar personagens/estados de `evals/fixtures/` para gerar as narrações avaliadas (ex.: um paladino para a abertura, um caso com NPC vulnerável, um turno de baixo HP).

---

## Manutenção da rubrica (sincronia com o prompt)

O prompt (barra de ofício em `dm-system.ts`) e a rubrica (`DIMENSIONS` em `rubric.ts`) são **duas fontes de verdade** para a mesma "barra de qualidade". Se o prompt ganha uma exigência nova e a rubrica não acompanha, o eval passa a medir uma barra velha — regressão silenciosa da própria rede de segurança. Duas defesas, ambas baratas:

### 1. Guard de drift (teste que falha quando a barra muda sem a rubrica ser revista)

Extrair a barra para uma **const exportada** e testar que seu hash não mudou desde a última revisão da rubrica. Quando a barra muda de propósito, o dev revê `DIMENSIONS` e só então atualiza o hash — a atualização do hash É o "eu revisei".

```ts
// dm-system.ts — extrair a seção de ofício para uma const (o buildDmSystemPrompt interpola ${NARRATIVE_CRAFT_SECTION})
// PONTEIRO: editou esta barra? Revise DIMENSIONS em rubric.ts e o hash em rubric-drift.test.ts.
export const NARRATIVE_CRAFT_SECTION = `## Narrative craft (the quality bar …)
… Onomastics …`
```

```ts
// evals/rubric-drift.test.ts
import { createHash } from 'node:crypto'
import { NARRATIVE_CRAFT_SECTION } from '@ai-dm/ai-engine'

// hash congelado da ÚLTIMA vez que DIMENSIONS foi conferida contra a barra.
// Ao mudar a barra: (1) revise DIMENSIONS, (2) cole o novo hash aqui.
const REVIEWED_CRAFT_HASH = '<sha256 atual>'

test('barra de ofício não mudou sem revisão da rubrica', () => {
  const cur = createHash('sha256').update(NARRATIVE_CRAFT_SECTION).digest('hex')
  expect(cur, 'A barra de ofício mudou. Revise DIMENSIONS em rubric.ts e atualize REVIEWED_CRAFT_HASH.')
    .toBe(REVIEWED_CRAFT_HASH)
})
```

- **Const explícita, não snapshot do vitest.** `toMatchSnapshot` convida ao reflexo `-u` (regrava sem pensar) — justamente o que se quer impedir. Um hash hardcoded com mensagem de erro força a revisão consciente.
- **Não prova correção, força atenção.** O guard não sabe se a rubrica ficou *certa*; garante que ninguém mexe na barra sem *olhar* a rubrica. É o mesmo princípio da US-36: não confiar em disciplina humana, pôr um teste que falha.

### 2. Ponteiro cruzado (comentário em cada lado apontando o outro)

Grátis, complementa o guard:
- Em `dm-system.ts`, no topo da seção de ofício: `// editou a barra? atualize DIMENSIONS em rubric.ts e o hash em rubric-drift.test.ts`.
- Em `rubric.ts`, sobre `DIMENSIONS`: `// espelha a barra de ofício de dm-system.ts (NARRATIVE_CRAFT_SECTION). Mudou lá? Reveja aqui.`

### Adiante (fora do escopo agora): fonte única

Quando a barra passar a mudar com frequência, unificar num só array `CRAFT_BAR` que o prompt e a rubrica consomem (cada item com a frase imperativa do prompt + a pergunta do juiz) — aí drift vira impossível por construção. Hoje é otimização prematura: a barra não churna o bastante para pagar o refactor do prompt. O guard de drift (#1) é a ponte até lá.

---

## Critérios de aceite

- [ ] Existe pelo menos um eval case de qualidade de narração cobrindo a **abertura** (US-34) e um cobrindo um **turno de continuação**.
- [ ] A rubrica pontua, no mínimo, as dimensões: sentidos, concretude & nomeação, **onomástica** (originalidade + âncora cultural), classe-como-lente, tensão-antes-da-explicação, voz de NPC, ritmo & concisão, gancho/opções e **língua natural pt-BR**.
- [ ] O juiz produz **nota por dimensão + justificativa** em saída estruturada validada por schema.
- [ ] Há um threshold de qualidade configurado; `pnpm eval --ci` sai com código ≠ 0 quando a nota fica abaixo dele.
- [ ] `pnpm eval --verbose` mostra, por caso, a narração avaliada, as notas por dimensão e as justificativas do juiz.
- [ ] `pnpm eval --filter us-36` roda apenas os casos desta story.
- [ ] O eval é estável (não-flaky) numa faixa razoável de execuções — temperatura baixa no juiz e rubrica objetiva; um caso no limiar não deve alternar pass/fail a cada rodada.
- [ ] **(guard de drift)** A barra de ofício está numa const exportada (`NARRATIVE_CRAFT_SECTION`) e um teste falha quando ela muda sem o hash revisado ser atualizado — forçando revisão da rubrica a cada edição da barra. Há ponteiros cruzados entre `dm-system.ts` e `rubric.ts`.
- [ ] Os thresholds novos estão documentados no `evals/README.md` e na estratégia de testes.
- [ ] **(regressão real)** Degradar deliberadamente o prompt de ofício (remover a seção `## Narrative craft` + `### Onomastics` de `dm-system.ts`) faz o eval de qualidade **reprovar**, comprovando que ele detecta queda de qualidade.
- [ ] **(ao vivo em dev)** Com `DM_LIVE_EVAL` ligado em dev, jogar um turno loga nota por dimensão + justificativa **depois** da narração, sem atrasar o streaming; com a flag desligada (e em produção) o juiz não roda.
- [ ] **(ao vivo — falha isolada)** Um erro do juiz (ex.: quota/timeout) durante a avaliação ao vivo **não** derruba nem atrasa o turno — só loga um aviso.
- [ ] **(metadados)** Cada entrada do relatório inclui git HEAD/branch, o modelo de narração que efetivamente serviu (slug + nível da escada), sampling (`maxTokens`/`frequencyPenalty`/`temperature`), `finishReason` + tokens, e o slug do juiz — o bastante para atribuir uma mudança de nota entre duas execuções a um fator.

---

## Notas de implementação

- **Local dos casos:** `evals/cases/us-36-qualidade-narracao.ts` (ou nomes por dimensão), incluídos automaticamente pela suíte.
- **Juiz com `generateObject`:** schema Zod das dimensões (`nota` inteiro 1–5 + `justificativa`, já em `rubricSchema`); juiz = Gemini 3.5 Flash Lite pela API do Gemini (`judgeModel()` / `@ai-sdk/google` + `GEMINI_API_KEY`), temperatura baixa. `GEMINI_API_KEY` vive no `.env` da raiz (mesmo padrão dos demais secrets de eval).
- **Scorer:** adicionar métrica "qualidade da narração" (escala 1–5) + mínimo em `scorer.ts`; refletir na tabela de thresholds.
- **Relatório:** escrever `evals/reports/us-36-<timestamp>.md` a cada execução (narração + notas + justificativas); adicionar `evals/reports/` ao `.gitignore`.
- **Reuso da US-34:** os casos devem exercitar o caminho real — `buildDmSystemPrompt` (com a seção `## Narrative craft` + `### Onomastics`) + geração pela escada `narrationModels` (deepseek-v4-flash primário) — para que o eval meça exatamente o que o jogador recebe.
- **Custo:** cada caso = 1 geração + 1 (ou N) julgamento(s) de LLM. Manter o conjunto enxuto para o eval não ficar caro/lento no CI.
- **ai-engine dist:** se juiz/rubrica viverem no pacote, exportar no `index` e lembrar do rebuild (`pnpm --filter @ai-dm/ai-engine build`).

---

## Decisões (questões resolvidas em 2026-07-23)

1. **Modelo juiz — Gemini 3.5 Flash Lite, via API do Gemini.** Acessar pela **API direta do Google Gemini** com `@ai-sdk/google` (`createGoogleGenerativeAI`) + `GEMINI_API_KEY` — **não** via OpenRouter. Reusar o helper `judgeModel()` já em `packages/ai-engine/src/model.ts`, que roteia para o provider Google por padrão. Barato, externo ao stack de narração (OpenRouter/Groq), sem viés de auto-avaliação; temperatura baixa para estabilidade. (Mesmo caminho do juiz da US-17.)
   - **Slug a confirmar:** `judgeModel()` hoje usa default `gemini-3.1-flash-lite`. Fixar o slug do 3.5 Flash Lite via `JUDGE_MODEL` **só depois de verificar** o nome exato no catálogo do Gemini e que a chave/projeto tem acesso a ele; senão o eval quebra na primeira chamada.
2. **Escala 1–5 por dimensão.** Graduada, não binária — captura queda parcial de qualidade que um passa/não-passa esconderia. Alinhada ao `rubricSchema` já existente (US-17), sem escala nova. Threshold mínimo calibrado com exemplos rotulados à mão (ver critério de aceite de regressão real).
3. **Relatório persistido — sim, com metadados do modelo.** Gravar por execução em `evals/reports/us-36-<timestamp>.md` (ou `.json`) com narração + notas por dimensão + justificativas **e os fatores que podem explicar uma mudança de qualidade entre atualizações** (ver "Metadados no relatório" abaixo), para comparar duas execuções e saber *o que mudou* — prompt, modelo, sampling — não só *que* a nota caiu.
4. **Aceitar variância do narrador.** Não fixar seed; confiar na média do juiz sobre a rubrica objetiva + temperatura baixa no juiz para manter o eval não-flaky. A variância da narração é parte do que se mede.

---

## Referências no código

- `evals/cases/` — onde entram os novos casos de qualidade (`us-36-…`).
- `evals/scorer.ts` — lógica de pontuação e threshold; adicionar a métrica de qualidade.
- `packages/ai-engine/src/rubric.ts` — rubrica + juiz LLM já existentes (US-17): `DIMENSIONS`, `rubricSchema` (escala 1–5), `judgeTurn`, render do relatório. **Base a estender** (só dimensões novas; escala mantida).
- `evals/fixtures/` — personagens/estados reusados para gerar as narrações avaliadas.
- `evals/README.md` — documentação da suíte e tabela de thresholds; atualizar.
- `packages/ai-engine/package.json` — script `eval` (`vitest run --config vitest.eval.config.ts`).
- `packages/ai-engine/src/prompts/dm-system.ts` — `buildDmSystemPrompt` com a seção de ofício (US-34), exercitado pelos casos.
- `packages/ai-engine/src/model.ts` — `judgeModel()` (juiz Gemini via `@ai-sdk/google`) e `narrationModels` (escada de narração avaliada).
- `apps/api/src/ai/ai.service.ts` — `onFinish` do `streamText` (com `finalText`): ponto de chamada do juiz na **avaliação ao vivo em dev** (fire-and-forget, atrás de `DM_LIVE_EVAL`).
- `docs/sdlc/04-testes/estrategia-de-testes.md` — estratégia e thresholds mínimos.
- `docs/sdlc/01-requisitos/US-34-qualidade-da-narracao-do-dm.md` — origem da barra de qualidade que esta US mede.
