# ADR 002 — Memória de sessão do DM Agent (contexto em sessões longas)

**Status:** Aceito (Fases A e B implementadas)
**Data:** 2026-06-27
**Decisores:** Time de Produto e Engenharia
**Relacionado:** [ADR 001 — Arquitetura](./001-arquitetura.md) · [US-11b](../sdlc/01-requisitos/US-11b-estado-de-cena-estruturado.md)

---

## 1. Contexto

O DM Agent (ver [ADR 001](./001-arquitetura.md), §2.2) narra a aventura turno a turno. Cada turno
envia ao LLM um system prompt + o histórico da conversa. O problema é **como representar o histórico
em sessões longas** sem perder coerência nem estourar custo/limites.

### Sintoma que motivou a decisão

Na implementação inicial, o serviço de chat enviava ao modelo **apenas a mensagem atual** do jogador,
sem nenhum histórico. Resultado: o mestre perdia a memória da cena entre turnos e alucinava. Caso real:
o personagem estava numa **praça** e recebeu um **mapa da estrada**; ao "olhar o mapa", o mestre narrou
o personagem olhando o mapa "aberto **sobre uma mesa**" (inexistente) mostrando uma **região diferente**
da que o mapa representava.

### Restrições

- Modelo de narração: `llama-3.3-70b-versatile` (Groq) — janela de 128k tokens, mas o plano tem teto de
  **tokens por minuto (TPM)**, e latência/custo crescem a cada turno.
- O `EventLog` (append-only, [ADR 001](./001-arquitetura.md) §2.3) já é a base de memória, com tipos
  `ACTION` e `NARRATION` previstos porém, à época, não usados para reconstruir contexto.
- O campo `Adventure.memorySummary` já existia no schema, sem uso.
- A [ADR 001](./001-arquitetura.md) §6 já antecipava o risco: *"Custo de inferência cresce com contexto
  longo — mitigar com sumarização + RAG enxuto"*. Este ADR concretiza essa mitigação para a **memória de
  sessão** (curto/médio prazo); a memória **entre aventuras** via RAG permanece como na [ADR 001](./001-arquitetura.md).

### Por que uma janela deslizante pura não basta

A correção imediata foi reidratar o histórico do `EventLog` e enviar os últimos N turnos. Mas uma janela
deslizante pura tem falha silenciosa: ao chegar ao turno 60, os turnos 1–20 **somem sem aviso** — a quest
inicial, o nome do vilão, promessas a NPCs. O modelo volta a alucinar, só que mais tarde e de forma mais
difícil de detectar. Aumentar a janela apenas adia o problema e estoura o TPM. Janela pura **troca memória
por custo, e nunca tem as duas**.

---

## 2. Decisão

Adotar **memória hierárquica de sessão em dois níveis**, persistida no `EventLog`/`Adventure` e
reconstruída a cada turno:

1. **Resumo contínuo (longo prazo)** — um resumo acumulado em `Adventure.memorySummary`, injetado no
   system prompt como *"A história até agora"*. Condensado **incrementalmente** por um modelo pequeno e
   barato quando a janela recente cresce além de um limite.
2. **Janela recente verbatim (curto prazo)** — os últimos turnos não-resumidos (`ACTION`/`NARRATION`)
   enviados palavra por palavra como `messages`, garantindo continuidade fina (tom, detalhes da cena).

```
SYSTEM PROMPT
 ├─ ## A história até agora   ← resumo acumulado (Adventure.memorySummary)
 │     "Lyra recebeu de Thorne o mapa da estrada para investigar
 │      ataques. Já está a caminho da Floresta Escura, é noite..."
 │
MESSAGES
 ├─ turno N-k  (jogador)   ┐  janela recente VERBATIM
 ├─ turno N-k  (mestre)    │  (turnos ainda não resumidos)
 ├─ ...                    │
 ├─ turno N    (jogador)   ┘
```

### 2.1 Sumarização incremental

O resumo **nunca reprocessa a sessão inteira** — é incremental e custo ~constante por turno:

```
resumo_novo = LLM_pequeno(resumo_antigo + turnos_que_saem_da_janela)
```

- **Gatilho:** por **contagem de turnos**. Quando os eventos não-resumidos passam de
  `SUMMARIZE_THRESHOLD` (30 eventos ≈ 15 turnos), os mais antigos são fundidos no resumo, mantendo
  `KEEP_RECENT` (12 eventos ≈ 6 turnos) verbatim. Sumarização em **lote**, não a cada turno.
- **Modelo:** `llama-3.1-8b-instant` (Groq) — pequeno e barato; resumir é tarefa simples e não deve
  consumir o TPM da narração.
- **Quando roda:** no `onFinish` do stream, de forma **assíncrona**, sem segurar a resposta ao jogador.
  Falha na sumarização é capturada e apenas **adia** a condensação para o próximo turno — nunca derruba
  o turno já entregue.
- **Marcação:** flag `EventLog.summarized` distingue o que já foi condensado do que ainda vai verbatim,
  tornando a fronteira da janela determinística e indexável.

### 2.2 Continuidade espacial (Fase B — implementada)

Resumo em prosa cobre bem o **enredo**, mas a continuidade **espacial** (onde estou, quem está comigo)
é frágil em texto livre — foi a classe do bug do mapa. A **Fase B** ([US-11b](../sdlc/01-requisitos/US-11b-estado-de-cena-estruturado.md))
adiciona um **estado de cena estruturado** (`sceneState`: local, ambiente, presentes, período, objetos)
como **fonte de verdade**, alimentado deterministicamente (tool `updateScene`) e reinjetado a cada turno.
Implementada: `CharacterState.sceneState`, merge parcial em `packages/ai-engine/src/scene.ts`, reinjeção
no prompt e no resumo (ver §6).

### 2.3 Faseamento

| Fase | Entregável | Status |
|------|-----------|--------|
| A | Resumo contínuo incremental + janela recente verbatim | ✅ Implementada |
| B | Estado de cena estruturado (`sceneState`) | ✅ Implementada — [US-11b](../sdlc/01-requisitos/US-11b-estado-de-cena-estruturado.md) |
| C | Trocar gatilho de contagem por orçamento de tokens; RAG de memória entre aventuras | 🔭 Futuro (alinha com [ADR 001](./001-arquitetura.md), Fase 2/3) |

---

## 3. Decisões-chave e justificativas

| # | Decisão | Por quê |
|---|---------|---------|
| 1 | Memória hierárquica (resumo + janela) em vez de janela pura | Janela pura esquece o início em silêncio e/ou estoura TPM; hierárquica mantém memória **e** custo limitado |
| 2 | Reusar `Adventure.memorySummary` e `EventLog` | Campos já existiam no schema; menor superfície de mudança |
| 3 | Gatilho por contagem de turnos | Simples, previsível e fácil de testar para o MVP; orçamento por tokens fica para a Fase C |
| 4 | Sumarização em lote (não a cada turno) | Reduz nº de chamadas extras ao LLM; janela oscila entre `KEEP_RECENT` e `SUMMARIZE_THRESHOLD` |
| 5 | Modelo pequeno (`llama-3.1-8b-instant`) para resumir | Resumir é tarefa simples; preserva o TPM e o custo do modelo de narração |
| 6 | Sumarizar no `onFinish`, assíncrono e tolerante a falha | Não adiciona latência ao jogador; falha só adia, não quebra o turno |
| 7 | Flag `EventLog.summarized` como fronteira da janela | Determinístico e indexável; evita ambiguidade de timestamp ou contagem em memória |
| 8 | Continuidade espacial separada, via estado estruturado (Fase B) | Prosa não é fonte de verdade confiável para lugar; estado estruturado ataca o bug na raiz |

---

## 4. Alternativas rejeitadas

| Alternativa | Motivo da rejeição |
|-------------|-------------------|
| Janela deslizante pura (só aumentar N) | Esquece o início em silêncio; adia e agrava o estouro de TPM/custo |
| Enviar a sessão inteira a cada turno | Inviável em custo/TPM; cresce sem limite |
| RAG/embeddings dos turnos para memória de sessão | Overkill no MVP; recupera trechos soltos, não o fio narrativo; melhor para memória **entre aventuras** (Fase 2/3 da [ADR 001](./001-arquitetura.md)) |
| Resumir a sessão inteira do zero a cada condensação | Custo cresce com o tamanho da campanha; incremental mantém custo ~constante |
| Resumir a cada turno | Mais chamadas de LLM sem ganho; lote é suficiente |
| Usar o modelo de narração (70b) para resumir | Mais caro e consome o TPM da narração sem ganho relevante |

---

## 5. Consequências

**Positivas**
- Custo/contexto por turno **limitado** (resumo curto + janela ≤ `SUMMARIZE_THRESHOLD`), independente do
  tamanho da campanha.
- Nada de enredo some em silêncio: fatos antigos sobrevivem condensados no resumo.
- Usa infraestrutura existente (`EventLog`, `memorySummary`, gancho `onFinish`).
- Caminho claro para a Fase B (continuidade espacial) e Fase C (orçamento por tokens / RAG).

**Negativas / riscos**
- Sumarização pode **perder nuance** ou introduzir viés; mitigar com prompt que prioriza fatos duráveis e
  proíbe inventar/resolver fios.
- Uma chamada extra de LLM por condensação (em lote) — barata, mas existe; assíncrona para não pesar na UX.
- ~~Continuidade espacial **ainda depende da prosa** até a Fase B entrar.~~ Resolvido na Fase B: `sceneState` estruturado é a fonte de verdade reinjetada a cada turno.
- Se a sumarização falhar repetidamente, a janela não-resumida cresce até o problema se resolver — aceitável
  no MVP, mas vale alarme/observabilidade na Fase C.

---

## 6. Implementação (referência)

- `apps/api/src/ai/ai.service.ts` — reidratação do histórico não-resumido, injeção do `memorySummary`,
  persistência de `ACTION`/`NARRATION`, e `summarizeOldTurns()` no `onFinish` (constantes
  `SUMMARIZE_THRESHOLD = 30`, `KEEP_RECENT = 12`).
- `packages/ai-engine/src/model.ts` — `summaryModel` (`llama-3.1-8b-instant`).
- `packages/ai-engine/src/prompts/summary.ts` — `SUMMARY_SYSTEM_PROMPT` + `buildSummaryInput()`.
- `packages/ai-engine/src/prompts/dm-system.ts` — seção *"A história até agora"* e regra
  *SPATIAL & SCENE CONTINUITY*.
- `apps/api/prisma/schema.prisma` — `EventLog.summarized` (migração `20260627214045_add_eventlog_summarized`).

**Fase B (continuidade espacial):**
- `packages/ai-engine/src/scene.ts` — `mergeSceneState` (merge parcial) e `formatSceneState` (reinjeção).
- `apps/api/src/ai/ai.service.ts` — tool `updateScene` e inclusão do `sceneState` em `summarizeOldTurns`.
- `packages/shared/src/types/character.ts` — tipo `SceneState`.
- `apps/api/prisma/schema.prisma` — `CharacterState.sceneState`.
