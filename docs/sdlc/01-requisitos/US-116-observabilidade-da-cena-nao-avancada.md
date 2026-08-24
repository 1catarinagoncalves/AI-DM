# US-116 — Observabilidade da cena não avançada, em dev e produção, e spike de A/B do arco

**Épico:** 3 — Narração e mecânica
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** [US-117](./US-117-turnid-por-turno.md) — ✅ implementada. `turnId` já existe por turno e chega como parâmetro em `streamChat` (`ai.service.ts:247`); `arc_signal` deve nascer com o campo pronto, não ganhá-lo depois
**Relacionada a:** [US-112](./US-112-arco-de-beats-do-que-muda.md) — responde a *Questões em aberto* #1 de lá; se a taxa observada não sustentar a hipótese, US-112 não deve prosseguir para schema/migração/extração/tool · [US-71](./US-71-simplificar-localizacao-do-personagem.md) e [US-73](./US-73-reconciliador-de-cena-em-background.md) — os dois fixes cujo efeito real esta US mede pela primeira vez · [US-59](./US-59-api-em-producao-render.md) — onde o log de produção vive · [ADR 011](../../adr/011-observabilidade-em-camadas.md) — formaliza esta US como o gatilho da convenção de observabilidade em camadas · [US-118](./US-118-eventos-json-do-controller.md), [US-119](./US-119-eventos-json-do-ai-service.md), [US-120](./US-120-erro-de-llm-estruturado.md) — ✅ implementadas; já migraram os outros 22 call sites de log de `apps/api` pro mesmo formato JSON que esta US propõe
**Criada em:** 2026-08-08

---

## História

> **Como** mantenedora,
> **quero** observabilidade real (dev e produção) da taxa de turnos em que a cena não avança, **e** um spike de A/B que isole se um bloco de arco muda esse resultado,
> **para que** a decisão de construir US-112 se apoie em dado medido — correlação **e** causa — não em raciocínio, e não repita o fix de 28/07/2026, aplicado e nunca reproduzido.

---

## Contexto e motivação

### O problema observado

US-112 propõe um mecanismo inteiro apoiado numa hipótese que a própria US marca como não medida (*Questões em aberto* #1). O único dado que existe é o sintoma antigo — **9 de 24 viagens sem `updateScene`**, medido pela US-71 **antes** dos fixes de 28/07/2026 entrarem. Ninguém mediu se esses fixes já mudaram esse número.

### Por que a solução atual não basta

[`ai.service.ts:830-831`](../../../apps/api/src/ai/ai.service.ts) já calcula o sinal exato — `cenaTocada`, "o modelo chamou `updateScene` neste turno" — mas hoje ele só decide se `reconcileScene` dispara; nada loga o resultado. Não existe hoje nenhuma taxa observável, nem em dev nem em produção. E mesmo com a taxa em mãos, ela só mostra **se** o sintoma persiste — não **por quê**: nenhum cenário hoje isola o efeito de um bloco de arco contra o mesmo turno sem ele. `narrative-bakeoff.test.ts` (`packages/ai-engine/src`) já é o harness que roda cenários fixos contra o modelo real (`pnpm eval` → `vitest run --config vitest.eval.config.ts`), com `SCENARIOS` de abertura, diálogo, combate, dilema, amnésia e coerência — nenhum de deslocamento pedido, que é o cenário que falhou 9/24 vezes.

### O que mudou desde a redação original (08/08/2026)

Esta US virou o gatilho do [ADR 011](../../adr/011-observabilidade-em-camadas.md) — formalizado no mesmo dia, decide observabilidade em camadas para os 23 call sites de log de `apps/api`. As Camadas 1 e 2 já saíram do papel e cobrem os **outros 22** sites:

- **[US-117](./US-117-turnid-por-turno.md)** (Camada 1, ✅) — `turnId` por turno já existe: gerado em `ai.controller.ts`, propagado a `streamChat` (`ai.service.ts:247`), `reconcileScene` (`:1074`), `completeTruncatedTurn`, `liveEvalTurn`. `arc_signal` nasce **com** o campo pronto, em vez de ganhá-lo depois.
- **[US-118](./US-118-eventos-json-do-controller.md)**, **[US-119](./US-119-eventos-json-do-ai-service.md)**, **[US-120](./US-120-erro-de-llm-estruturado.md)** (Camada 2, ✅) — os outros 22 `console.log`/`warn`/`error` de `ai.controller.ts`, `ai.service.ts` e `llm-error.ts` já viraram `console.log(JSON.stringify({ event, turnId, timestamp, ...campos }))`. Inclui `detectSlopName` (`ai.service.ts:818-819`, evento `slop_name`) — o precedente que a redação original desta US citava como "ainda em texto livre" não é mais verdade; hoje é o **padrão do arquivo**, não uma exceção isolada.

`cenaTocada` continua sem log — é o único sinal do inventário do ADR 011 que ainda não migrou. O `arc_signal` desta US fecha esse ponto, seguindo a convenção que as outras 4 USs já cravaram, não inventando uma nova.

### A proposta

Duas medições, uma correlacional e uma causal, sem tocar em schema, migração, extração ou tool da US-112:

1. **Observabilidade estruturada (correlacional).** Logar o desfecho de `cenaTocada` (verdadeiro **e** falso, não só a falha — falso sem o total não vira taxa) em todo turno, como log JSON de campos fixos, nos dois ambientes:
   - **Dev:** aparece no console ao rodar `pnpm dev` e jogar turnos manuais — a mesma linha JSON, só lida a olho ou com `jq`.
   - **Produção:** o mesmo `console.log` estruturado, capturado pelo log stream que a API já tem no Render desde a US-59 — sem serviço novo, mas agora filtrável por campo em vez de exigir grep de texto livre.
   Depois de uma janela real, agregar por campo e calcular a taxa, comparando com os 9/24 (37,5%) da US-71.

2. **Spike de A/B (causal).** Um cenário novo no bake-off (`viagem-pedida`): cena registrada em A, ação do jogador pedindo B, rodado em duas variantes de `turnState` — (a) a de hoje, sem bloco de arco; (b) a mesma + 1 bloco `Arco da história` **hardcoded como string do teste**, sem `StoryBeat`, sem `extractOpeningArc`, sem coluna `arc`. Mede se o bloco muda a taxa de chegada em B, isolado do resto.

A observabilidade responde "o sintoma ainda existe depois dos fixes de 28/07/2026?"; o spike responde "um bloco de arco mudaria isso?" — as duas juntas são o que a *Questão em aberto* #1 da US-112 pede.

### Resultado do spike A/B (medido em 08/08/2026)

Rodado contra o modelo de PRODUÇÃO (`~deepseek/deepseek-v4-flash-latest`, via OpenRouter — não os candidatos NVIDIA do bake-off principal, que respondem uma pergunta diferente), N=3 (`REPS` default): variante (a, sem arco) **3/3** chegou em B; variante (b, com arco) **3/3** chegou em B. Sem diferença observável, mas por **efeito-teto**, não por o bloco ser irrelevante — a variante (a) já chega a 100% sozinha neste cenário, então não sobra espaço pro bloco de arco melhorar o número. Por *Questões em aberto* #2 (abaixo), 3/3 vs 3/3 não é "perto de 50/50" — não há motivo, pelo critério que a própria US definiu, para subir `JUDGE_REPS` a esta altura.

Leitura preliminar: o fix de 28/07/2026 (`continuityLine`, `dm-system.ts:477-478`) já resolve este cenário de deslocamento pedido para o modelo de produção atual, pelo menos nas condições testadas (cena registrada, ação de viagem explícita, tool `updateScene` disponível). Isso pesa para o lado "taxa baixa → não constrói US-112" da *Questão em aberto* #4 — mas a peça que falta é a taxa REAL de produção (não um cenário sintético isolado), que só a observabilidade (ainda pendente de janela) confirma ou desmente.

---

## Escopo

### Dentro do escopo

- Log **estruturado** (JSON, uma chamada `console.log(JSON.stringify({...}))`, sem lib de logging nova) em `ai.service.ts`, no ponto onde `cenaTocada` já é calculado (`:830-831`) — emite em **todo** turno (não só quando `reconcileScene` dispara).
- Campos fixos da linha: `event` (tag estável, `"arc_signal"`), `turnId` (US-117, já disponível como parâmetro em `streamChat`), `adventureId`, `characterId`, `cenaTocada` (booleano), `timestamp` — mesma ordem (`event`/`turnId`/`timestamp` primeiro) que US-118/119/120 já convencionaram no resto do arquivo. Nomes de campo definidos aqui não mudam depois — é o contrato que a agregação lê.
- Nenhuma tabela nova, nenhum serviço novo: reaproveita o log stream que o Render já expõe (US-59) e o console em dev — segue o mesmo formato JSON que US-118/119/120 já estabeleceram para os outros 22 call sites, não um formato novo que esta US inventa.
- Agregação da janela medida — filtrar pelo campo `event`/`cenaTocada` no log do Render (ou `jq` local em dev) e calcular a taxa, sem precisar ler linha por linha.
- Cenário novo `viagem-pedida` em `narrative-bakeoff.test.ts` / `SCENARIOS`, com as duas variantes de `turnState` (a) sem arco e (b) com bloco de arco hardcoded.
- Critério objetivo de sucesso por rodada do bake-off: a narração chega a B (cita o destino pedido, ou o turno chamaria `updateScene` num caminho real) vs redescreve A.
- `pnpm eval` roda as duas variantes, N repetições cada (mesmo `REPS` dos outros cenários, `narrative-bakeoff.test.ts:65`), e o relatório mostra a taxa de chegada em B por variante.
- Relatório único com três números: taxa de `cenaTocada: false` em dev, em produção, e taxa (a) vs (b) do bake-off — todos comparados ao baseline 9/24 (37,5%) da US-71.

### Fora do escopo

- Qualquer coisa do escopo da US-112 (schema, migração, `extractOpeningArc`, bloco de produção, tool `advanceBeat`).
- Lib de logging estruturado (pino, winston, etc.) ou tabela/serviço de métricas — "estruturado" aqui é o formato JSON da linha, não uma peça de infraestrutura nova. O log continua temporário, só para a janela de medição desta US.
- O bloco de arco da variante (b) não é o contrato final da US-112 (`StoryBeat`, `muda`, `gatilho`) — só precisa ser plausível ao modelo para o spike. Fixar o contrato de dado é problema da US-112, não deste spike.

---

## Critérios de aceite

- [x] Log JSON com campos fixos (`event`, `turnId`, `adventureId`, `characterId`, `cenaTocada`, `timestamp`) emite em todo turno que passa pelo `onFinish` de `streamChat` (`ai.service.ts:683`), sem alterar o comportamento existente de `reconcileScene`. — Implementado em `ai.service.ts:830-834`. Teste de integração cobrindo `cenaTocada: true`/`false` escrito em `ai.int.test.ts` (`describe('US-116 (ADR 011) — sinal arc_signal')`), mas **não executado** nesta sessão — o Postgres local disponível (`ai-dm-postgres`) não bate com as credenciais descartáveis do doc da US-95, e o teste faz `TRUNCATE CASCADE`; decisão da mantenedora foi pular por ora (rodar depois com `pnpm test:int` contra um banco efêmero real, ver doc da US-95).
- [ ] Rodando `pnpm dev` e jogando turnos manuais, a linha JSON aparece no console e é parseável (`jq` ou `JSON.parse` direto, sem regex). — Não verificado manualmente nesta sessão (sem sessão de jogo real); a forma da linha é `JSON.stringify` de objeto plano, sempre parseável por construção.
- [ ] Em produção (Render), a mesma linha JSON aparece no log stream do serviço. — Pendente de deploy.
- [ ] Depois de uma janela definida (dev: N turnos manuais; produção: N turnos reais ou N dias), o relatório calcula a taxa de `cenaTocada: false` filtrando pelos campos da linha (não por grep de texto livre) e compara com 9/24 (37,5%) da US-71. — Pendente de janela real (dias de tráfego); o log já emite o campo que a agregação precisa.
- [x] Cenário `viagem-pedida` existe em `narrative-bakeoff.test.ts`, com as duas variantes de `turnState` (a) e (b). — `VIAGEM_TURN_STATE_A`/`VIAGEM_TURN_STATE_B`, critério objetivo `chegouEmB` (chamou `updateScene` com o destino, OU a narração cita o destino — sem juiz).
- [x] `pnpm eval` roda as duas variantes e o relatório mostra a taxa de chegada em B por variante, lado a lado com a taxa observada de `cenaTocada: false`. — Comando real é `BAKEOFF=1 ... pnpm --filter @ai-dm/ai-engine test narrative-bakeoff -t "chegada em B"` (mesma convenção dos outros 6 cenários — nenhum deles passa por `pnpm eval`/`evals/cases`, apesar do texto original desta US dizer isso). **Rodada real em 08/08/2026** contra o modelo de PRODUÇÃO (`openrouter:~deepseek/deepseek-v4-flash-latest`, não os candidatos NVIDIA do bake-off principal — correção feita em cima da 1ª tentativa, que rodou contra o roster errado): variante (a) 3/3 chegou em B, variante (b) 3/3 chegou em B. Relatório em `evals/reports/2026-08-08-viagem-pedida.md` (local, não versionado — US-36). Taxa de `cenaTocada: false` observada (dev/produção) ainda não existe pra comparar lado a lado — depende da janela de medição, ainda pendente.
- [x] `pnpm typecheck` passa; **nenhuma migração Prisma** é criada por esta US. — `pnpm typecheck` limpo (4 workspaces); zero arquivo em `apps/api/prisma/migrations` tocado.

---

## Notas de implementação

> *Dicas. O implementador pode divergir com boa justificativa.*

- `console.log(JSON.stringify({ event: 'arc_signal', turnId, adventureId, characterId, cenaTocada, timestamp: new Date().toISOString() }))` — nativo, sem dependência nova, mesmo padrão que US-118/119/120 já cravaram no resto do arquivo (não é mais precedente isolado, é convenção do arquivo — inclui `detectSlopName`, `ai.service.ts:818-819`, já migrado). `turnId` chega pronto como parâmetro de `streamChat` (`:247`, US-117) — só precisa ser lido no ponto onde `cenaTocada` é calculado, sem propagação nova.
- Render Free (US-59) não garante retenção longa de log — a janela de medição em produção precisa caber nessa retenção, ou os logs precisam ser puxados com frequência antes de rotacionar. Ver *Questões em aberto* #1.
- Filtragem por campo em produção depende do que o painel/API de log do Render Free realmente suporta (filtro estruturado vs busca de texto simples) — não verificado ainda. Se o plano não filtrar por campo JSON, a agregação cai para grep de texto na mesma linha, sem perder o dado — só perde a conveniência. Ver *Questões em aberto* #3.
- Bloco de arco da variante (b) do bake-off é texto solto no teste, não usa `buildTurnStateBlock` (`dm-system.ts:445`) nem `StoryBeat` — só precisa parecer plausível para o modelo.
- As duas medições são independentes uma da outra: dá pra rodar o bake-off sem esperar a janela de observação de produção fechar, e vice-versa. Não há ordem obrigatória entre elas.

---

## Questões em aberto

1. **Retenção de log no Render Free** — dá pra esperar uma janela real de dias e puxar depois, ou a medição em produção tem que ser "ao vivo", puxando os logs com frequência antes que rotacionem? Decide o tamanho da janela viável.

   **Encaminhamento:** não travar na resposta exata. Script/cron simples puxa o log a cada poucas horas e acumula localmente (append num `.jsonl`) durante a janela de medição — funciona seja qual for a retenção real do Free tier, sem precisar descobri-la antes.

   **Resposta medida (08/08/2026):** testado via API do Render (`list_logs`, serviço `srv-d9f50kjrjlhs73dimceg`). Serviço criado 2026-07-20T16:44Z; log mais antigo que a API retorna é **2026-08-01T14:06:46Z** — nada antes disso (`hasMore:false` no intervalo 20/07–01/08). **Retenção real ≈ 7 dias**, não os ~19 dias de vida do serviço. Confirma que a medição em produção não pode esperar uma janela longa sem puxar — o script/cron do encaminhamento acima é necessário, não opcional, para janelas > 7 dias.

2. **N repetições do bake-off suficientes para o resultado significar algo** — quantas reps os cenários existentes já usam (`REPS`, `narrative-bakeoff.test.ts:65`)? Alinhar com o mesmo N em vez de inventar padrão novo.

   **Encaminhamento:** resolvida — `REPS = Math.max(1, Number(process.env['JUDGE_REPS'] ?? 3))` (`narrative-bakeoff.test.ts:65`), default 3. Usar o mesmo default; só subir via `JUDGE_REPS` se o resultado sair perto demais de 50/50 pra decidir.

3. **O Render Free filtra log por campo JSON, ou só busca texto?** Não verificado. Se não filtrar por campo, a agregação em produção vira grep na linha JSON inteira em vez de query estruturada — funciona, só é mais manual. Checar antes de prometer "filtrável por campo" como critério de aceite definitivo.

   **Encaminhamento:** não bloquear nisso. Desenhar a tag (`"event":"arc_signal"`) como substring greppável mesmo dentro do JSON — funciona em busca de texto simples ou em filtro estruturado, sem precisar descobrir qual o Free tier suporta antes de escrever código.

4. **Se as duas medições divergirem** (ex.: taxa em produção caiu bastante desde os fixes de 28/07, mas o bake-off mostra o bloco de arco ainda melhorando a taxa (a) vs (b)) — qual pesa mais na decisão de abrir US-112? Não decidido; registrar aqui quando as duas rodarem.

   **Encaminhamento:** não competem — respondem perguntas diferentes. Taxa de produção decide **se vale a pena mexer** (sintoma ainda existe?); bake-off decide **se essa solução funciona** (bloco de arco muda o resultado?). Precedência: taxa alta + bake-off positivo → constrói US-112. Taxa baixa (fixes já resolveram) → não constrói, independente do bake-off. Taxa alta + bake-off negativo → sintoma real, mas arco não é a resposta certa — questiona a hipótese central da US-112, não só o timing.

---

## Referências no código

- [`apps/api/src/ai/ai.service.ts:830-831`](../../../apps/api/src/ai/ai.service.ts) — `cenaTocada`, o sinal a logar.
- [`apps/api/src/ai/ai.service.ts:247`](../../../apps/api/src/ai/ai.service.ts) — `streamChat`, assinatura já recebe `turnId?: string` (US-117).
- [`apps/api/src/ai/ai.service.ts:1074`](../../../apps/api/src/ai/ai.service.ts) — `reconcileScene`, o que hoje consome o sinal sem logar; já recebe `turnId`.
- [`apps/api/src/ai/ai.service.ts:818-819`](../../../apps/api/src/ai/ai.service.ts) — `detectSlopName`/`slop_name`, já em JSON (US-119) — o exemplo a seguir, não mais o "texto livre" da redação original.
- [`packages/ai-engine/src/narrative-bakeoff.test.ts:179`](../../../packages/ai-engine/src/narrative-bakeoff.test.ts) — `SCENARIOS`, onde entra `viagem-pedida`; `:65` `REPS`, padrão de repetições a seguir.
- [`packages/ai-engine/src/prompts/dm-system.ts:445`](../../../packages/ai-engine/src/prompts/dm-system.ts) — `buildTurnStateBlock`, molde do bloco real que a variante (b) imita sem chamar.
- [US-112](./US-112-arco-de-beats-do-que-muda.md) — *Questões em aberto* #1, o que esta US responde.
- [US-71](./US-71-simplificar-localizacao-do-personagem.md) — baseline 9/24 pré-fixes.
- [US-59](./US-59-api-em-producao-render.md) — onde o log de produção vive hoje.
- [ADR 011](../../adr/011-observabilidade-em-camadas.md) — convenção em camadas que esta US disparou.
- [US-117](./US-117-turnid-por-turno.md), [US-118](./US-118-eventos-json-do-controller.md), [US-119](./US-119-eventos-json-do-ai-service.md), [US-120](./US-120-erro-de-llm-estruturado.md) — Camadas 1 e 2 do ADR 011, já implementadas.
