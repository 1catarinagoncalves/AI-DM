# ADR 011 — Observabilidade em camadas: convenção antes de infraestrutura

**Status:** Proposto
**Data:** 2026-08-08
**Decisores:** Mantenedora
**Relacionado:** [ADR 006 — Deploy a custo zero](./006-deploy-custo-zero.md) (fixa Render Free/Neon Free como teto de infra desta fase) · [US-116](../sdlc/01-requisitos/US-116-observabilidade-da-cena-nao-avancada.md) (primeiro sinal JSON, escopo de spike) · [Checklist de Deploy](../sdlc/05-deploy/checklist.md) → *Observabilidade — o que existe hoje* / *Desejado, não implementado*

---

## 1. Contexto

`apps/api` tem hoje 23 chamadas `console.log`/`warn`/`error`, todas texto livre no formato `[Prefixo] mensagem` (`ai.service.ts`, `ai.controller.ts`, `llm-error.ts`, `main.ts` — inventariado linha a linha em 08/08/2026, tabela completa na Camada 2). O Render captura esse stdout no painel de log (US-59). Isso é **tudo** que existe: sem `traceId`/correlação por turno, sem métrica de custo de token, sem tracker de erro, sem alerta — confirmado no [Checklist de Deploy](../sdlc/05-deploy/checklist.md) §*Observabilidade — o que existe hoje* (29/07/2026) e ainda verdadeiro.

Três fatos already-on-the-books mudam o ponto de partida deste ADR:

1. **A convenção já existe no papel, só não no código.** `AGENTS.md` → *Padrões de código* → *Logging* já manda "JSON estruturado para debugging/observabilidade" — nenhuma das 23 chamadas atuais segue isso.
2. **O mesmo checklist já lista o desejo**, sem implementação: `traceId` ligando ação → tools → narração → estado persistido; alertas de taxa de erro/latência/custo. Não é requisito inventado para este ADR — é o próprio backlog da mantenedora.
3. **US-116 já é o primeiro caso real**, ainda como spike: uma linha `console.log(JSON.stringify({event:'arc_signal', adventureId, characterId, cenaTocada, timestamp}))` no ponto onde `cenaTocada` é calculado (`ai.service.ts:804-805`), explicitamente **sem** lib nova e **sem** serviço novo — só para medir uma taxa numa janela e depois virar decisão sobre US-112.

O que falta não é descobrir a necessidade — é decidir se US-116 fica um sinal isolado e temporário, ou vira o primeiro passo de uma convenção que os outros 23 call sites também seguem.

---

## 2. Decisão

Formalizar observabilidade como **convenção de log incremental, sem dependência nova e sem serviço novo** nesta fase. Quatro camadas, cada uma só se justifica pela anterior — nenhuma pula para a próxima sem dado que peça.

### Camada 0 — Formato: JSON estruturado, zero lib

Todo log de aplicação (não CLI) vira `console.log(JSON.stringify({ event, ...campos, timestamp }))`. É o que `AGENTS.md` já manda e US-116 já faz para um sinal. `console.*` do Node + `JSON.stringify` do stdlib bastam — nenhuma dependência (`pino`/`winston`) entra por este ADR.

Campo `event` é a tag estável e greppável (`"arc_signal"`, `"turn_guard"`, `"llm_failure"`) — funciona tanto em busca de texto simples quanto em filtro estruturado, a mesma escolha que a US-116 já fez para a *Questão em aberto* #3 dela.

### Camada 1 — Correlação: `turnId` por turno

Um id gerado uma vez por turno no Game Server (`ai.controller.ts`, onde o turno começa) e propagado como campo fixo em todo log daquele turno — tool calls, guards, narração, persistência. Resolve o item "Desejado, não implementado" do checklist (*"traceId ligando ação → tools → narração → estado persistido"*). Não precisa de tabela nem de header HTTP novo: é um `crypto.randomUUID()` passado como parâmetro pelas funções que já se chamam dentro do mesmo turno.

### Camada 2 — Sinais: um `event` por decisão que hoje é `console.warn` de texto

Os guards que já existem trocam a linha de texto livre por JSON com o mesmo formato da Camada 0, carregando o `turnId` da Camada 1. Não é lógica nova — é reformatar chamadas que já disparam, uma US pequena por vez (o padrão de granularidade do repo: US-116 é o primeiro exemplo).

**Inventário completo, 23 call sites** (`console.log`/`warn`/`error`, varrido linha a linha em 08/08/2026 — fonte de verdade se divergir do código):

*Grupo A — guards/decisões (prioridade alta, é o que Camada 2 cobre):*

| Local | Mensagem atual | `event` proposto |
|---|---|---|
| `ai.controller.ts:194` | modelo attempt falhou antes de emitir texto; caindo para fallback | `model_fallback` |
| `ai.controller.ts:210` | degeneração; re-amostrando mesmo modelo (reroll N/MAX) | `degeneration_reroll` |
| `ai.controller.ts:215` | degeneração persistente após N re-rolls; escalando | `degeneration_escalate` |
| `ai.controller.ts:239` | turno truncado (sem opções); completando fecho sem re-rodar | `turn_truncated_recovered` |
| `ai.service.ts:394` | rollDice: teste repetido no turno, reusando o 1º | `roll_dedup` |
| `ai.service.ts:403` | rollDice sem perícia/atributo resolvível → +0 | `roll_unresolved_skill` |
| `ai.service.ts:740` | saneador removeu raciocínio vazado (N trechos) | `leak_reasoning_stripped` |
| `ai.service.ts:751` | saneador removeu N rolagem(ns) fictícia(s) | `leak_fake_roll_stripped` |
| `ai.service.ts:759` | saneador removeu N tag(s) de estado vazada(s) | `leak_state_tag_stripped` |
| `ai.service.ts:766` | turno degenerado descartado pelo guard (US-69), não persistido | `turn_discarded_degenerate` |
| `ai.service.ts:775` | turno truncado sem opções (US-74), não persistido | `turn_discarded_truncated` |
| `ai.service.ts:793` | slop de nome clichê (`detectSlopName`) — precedente já citado na US-116, mas ainda em texto | `slop_name` |
| `ai.service.ts:1072` | cena sincronizada (`reconcileScene` bem-sucedido) | `scene_reconciled` |
| `ai.service.ts:1105` | juiz do live-eval falhou (ignorado) | `live_eval_judge_failed` |

*Grupo B — erro, ponto único de passagem:*

| Local | Nota |
|---|---|
| `llm-error.ts:31` e `:39` (`logLlmFailure`) | As 2 chamadas vivem numa função só, chamada por todo `catch` de LLM do serviço (ex. `reconcileScene`, `ai.service.ts:1074`). Migrar **a função**, não cada chamador — 1 edição cobre todos os call sites de erro de uma vez, mesma regra do `AGENTS.md`/ponytail de consertar na raiz, não em cada sintoma. `event` proposto: `llm_call_failed`, com `scope`/`consequence`/`statusCode` como campos |

*Grupo C — dependência da Camada 4:*

| Local | Nota |
|---|---|
| `ai.service.ts:694` | `onFinish`: `finishReason`, `model`, `tokens=`, `steps=` — é a linha que já carrega o dado que a Camada 4 precisa persistir (`tokensCost`, `durationMs` por turno). Migrar esta **antes** de decidir a Camada 4, não depois. `event` proposto: `turn_summary` |

*Grupo D — fora desta migração (não é guard, ou é temporário):*

| Local | Motivo de ficar fora |
|---|---|
| `main.ts:30`, `main.ts:31` | Boot do processo (API/docs em localhost) — sem `turnId`, sem valor de correlação por turno |
| `ai.service.ts:146` | Resumo de modelo por chamada — redundante com `:694` depois de migrado |
| `ai.service.ts:638` | "turno attempt iniciado" — redundante com `:694` (mesmo turno) |
| `ai.service.ts:709` | Dump de cache-spike atrás de `DM_CACHE_SPIKE`, já marcado `ponytail:` para remoção quando a Q1 da US-55 fechar (doc marca Q1 como resolvida — flag pode já estar madura para remoção, fora do escopo deste ADR) — não migrar algo que vai sumir |
| `ai.service.ts:1100` | Média do live-eval — diagnóstico de dev, não sinal de produção |

### Camada 3 — Agregação: leitura sob demanda, sem métrica nova

Nenhum serviço de métrica entra nesta fase. Agregação é o painel de log do Render filtrado por campo (produção) ou `jq` sobre stdout (dev) — a mesma abordagem que a US-116 já desenhou. **Medido em 08/08/2026** via API do Render (`list_logs`): retenção real é **~7 dias**, não os ~19 dias de vida do serviço até então — log mais antigo disponível é 2026-08-01T14:06:46Z contra criação em 2026-07-20T16:44Z. Janela de medição maior que isso exige puxar o log periodicamente para `.jsonl` local (encaminhamento já na US-116), não é opcional. Revisitar esta camada **só** se o volume real tornar `jq`/filtro de painel inviável dentro dessa janela de 7 dias — evidência, não hipótese.

### Camada 4 — Erro dedicado e alerta automático: **adiado, não decidido agora**

O checklist deseja alerta automático (erro > 1%, p95 > 10s, custo/sessão > 2× média de 7 dias). Fica registrado como próxima camada possível, **não implementada**:

- Opções catalogadas para quando houver dado real que justifique: tracker de erro free-tier (ex. Sentry, 5k eventos/mês sem cartão) para stack trace + agrupamento; ou um workflow agendado (GitHub Actions cron, já usado no repo para CI — sem custo) que lê o log do Render/consulta um endpoint e falha/notifica se o campo `event` cruzar um limiar.
- Motivo de não entrar já: dev solo, sem on-call, zero incidente medido até hoje (nenhum dos dois runtimes tem histórico de erro em produção registrado) — o custo de manter mais um painel/serviço supera o benefício antes de existir volume real para alertar sobre. Mesma régua do ADR 006 (custo zero, Fase 1): alerta automático troca "log lido à mão, ocasionalmente" por "peça de infra a manter" sem que o tráfego atual peça isso.

**Desenho concreto, se/quando entrar (não implementado):**

Alertar sem alguém ler log exige dado agregável, não texto de log — a retenção do Render Free é curta (medida em 08/08/2026: ~7 dias, ver Camada 3) e a API de log do Render não serve como fonte de longo prazo. Quatro peças, nenhuma delas serviço pago novo:

1. **Persistir outcome por turno onde já existe write.** O turno já vira row no Postgres (Neon) — bastam campos `errorOccurred` (bool), `durationMs`, `tokensCost` (se rastreado). Zero tabela nova se cabe na row existente; senão, uma tabela fina só com esses campos + `turnId` (Camada 1).
2. **Query de janela rolante.** SQL simples sobre as últimas N linhas ou últimas 24h, comparando aos 3 limiares do checklist (erro > 1%, p95 > 10s, custo/sessão > 2× média de 7 dias).
3. **Runner agendado sem servidor novo.** GitHub Actions cron — já usado em `ci.yml`, minutos grátis — roda a query periodicamente contra `DATABASE_URL` (secret, mesmo padrão já usado no repo para a Neon).
4. **Canal de saída que não é "olhar log".** GitHub já manda e-mail de falha de workflow agendado por padrão, sem webhook novo; alternativa é um webhook grátis (Discord/Slack) ou `ntfy.sh` (grátis, sem conta).

Isto substitui a dependência no log do Render por dado que a própria aplicação já persiste — zero dependência nova em `apps/api`, só 1 tabela/campo + 1 script + 1 workflow YAML quando a Camada 4 for priorizada.

---

## 3. Alternativas rejeitadas

| Alternativa | Motivo da rejeição |
|---|---|
| **OpenTelemetry + Grafana/Loki (self-hosted ou Grafana Cloud)** | Stack de observabilidade própria para um serviço single-process, dev solo, tráfego de MVP — infraestrutura para escala que não existe ainda. Contradiz ADR 006 (custo zero, sem serviço extra) |
| **Datadog / New Relic** | Pago acima do free tier trivial; MVP não tem orçamento de infra (ADR 006) nem volume que justifique APM completo |
| **pino/winston agora** | `JSON.stringify` nativo já produz o formato que `AGENTS.md` pede; a lib ganharia níveis/transporte que ninguém consome ainda — dependência por ganho marginal, contra a regra "não adicione dependência sem verificar equivalente" |
| **Sentry (ou similar) já nesta ADR** | Zero incidente de produção medido até hoje para calibrar o que capturar; adicionar tracker sem esse dado é infraestrutura especulativa — fica listado na Camada 4 para quando houver sinal real |
| **`traceId` como header HTTP entre web e api** | O front não precisa do id — só o api correlaciona seus próprios logs internos (tools → narração → persistência). Propagar via header seria superfície nova sem consumidor |

---

## 4. Consequências

**Positivas**
- Zero dependência nova, zero serviço novo — nenhuma linha do ADR 006 (custo zero) muda.
- Convenção já declarada em `AGENTS.md` passa a ser seguida, não só escrita.
- Cada camada só existe se a anterior já estiver em uso — nenhum trabalho adiantado para volume/incidente hipotético.
- `turnId` (Camada 1) é o único item deste ADR que não é reformatação de log existente; é barato (um `randomUUID` propagado) e resolve o gap mais citado no checklist.

**Negativas / riscos**
- Descoberta de incidente continua manual até a Camada 4 existir — sem alerta automático, um erro em produção só aparece se alguém ler o log.
- Retenção do log no Render Free é curta — **medida em 08/08/2026: ~7 dias** (log mais antigo disponível via API foi 2026-08-01T14:06:46Z, serviço criado 2026-07-20T16:44Z). A Camada 3 depende de puxar log antes de rotacionar sempre que a janela de medição passar de 7 dias.
- Reformatar os 23 call sites do inventário (Camada 2) é trabalho real, ainda que mecânico — cada US pequena precisa passar por revisão para não perder informação que o texto livre carregava (ex. o array `removed` em `ai.service.ts:751`).

---

## 5. Próximos passos

Granularidade igual à do repo — uma US pequena por passo, não um épico. Ordem de dependência: 116 e 117 primeiro (117 não depende de 116, mas 118/119/120 dependem de 117); 118/119/120 podem rodar em qualquer ordem entre si depois de 117.

1. **[US-116](../sdlc/01-requisitos/US-116-observabilidade-da-cena-nao-avancada.md)** (já rascunhada) — sinal `arc_signal` isolado, spike de medição para US-112.
2. **[US-117](../sdlc/01-requisitos/US-117-turnid-por-turno.md)** — Camada 1, `turnId` gerado em `ai.controller.ts` e propagado pelas chamadas do mesmo turno.
3. **[US-118](../sdlc/01-requisitos/US-118-eventos-json-do-controller.md)** — Camada 2, Grupo A parte 1: os 4 guards de `ai.controller.ts` para `event` JSON.
4. **[US-119](../sdlc/01-requisitos/US-119-eventos-json-do-ai-service.md)** — Camada 2, Grupo A parte 2 + Grupo C: os 10 guards de `ai.service.ts` mais `turn_summary` (`:694`, dependência da Camada 4) para `event` JSON.
5. **[US-120](../sdlc/01-requisitos/US-120-erro-de-llm-estruturado.md)** — Camada 2, Grupo B: `logLlmFailure` para `event` JSON — 1 função, cobre os 7 call sites que a chamam.
6. Camada 4 fica **fora de qualquer US** até haver incidente real ou volume que justifique (ver §2, "o que falta para decidir agora": volume de tráfego medido, baseline de erro/custo de 7 dias, e US-117/119 já implementadas) — não abrir story para ela ainda.

USs 117–120 criadas em 08/08/2026, junto com este ADR.
