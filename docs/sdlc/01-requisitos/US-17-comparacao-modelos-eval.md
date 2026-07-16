# US-17 — Comparação de modelos de narração via bake-off de qualidade narrativa

**Épico:** 3 — Narração e mecânica
**Fase:** 2 — Memória / continuidade espacial (Fase B)
**Status:** ✅ Implementada
**Depende de:** Suite de evals existente (`evals/` + `pnpm eval`, vitest) — já implementada
**Bloqueado (slice 2) por:** [US-39](./US-39-identidade-narrativa-background-ideais.md) (background/ideais/vínculos/fraquezas) + [US-40](./US-40-divindade-do-personagem.md) (divindade) + [US-41](./US-41-features-traits-de-classe.md) (features & traits de classe — o cenário de Combate É uma feature) — sem esses campos, a fixture carrega contexto mais pobre que a referência e mede input empobrecido, não o modelo. **Paridade (não bloqueio duro):** [US-42](./US-42-magias-conhecidas.md) (magias) melhora fidelidade mas os cenários escolhidos giram em features. Slice 1 (dump) não bloqueia; o juiz (slice 2), sim.
**Criada em:** 2026-06-30
**Reescrita em:** 2026-07-09 — pivot de "evals de coerência" para "bake-off de qualidade narrativa" (LLM-judge + rubrica ancorada numa aventura de referência)

---

## História

> **Como** desenvolvedora do AI DM,
> **quero** rodar os mesmos cenários de narração contra vários modelos candidatos e ver, lado a lado, a **qualidade narrativa** de cada um (pontuada por rubrica) junto com custo e coerência,
> **para que** eu escolha o modelo de narração com base em dado objetivo, e não em "achei que narrou melhor".

---

## Contexto e motivação

### O problema observado

A escolha do modelo de narração hoje é por sensação. O `packages/ai-engine/src/model.ts` aponta `openai/gpt-oss-120b` (Groq) como primário e `llama-3.3-70b-versatile` (Groq) como fallback, mas essa decisão nunca foi medida. Trocar de modelo é editar env/código, jogar à mão uns minutos, e adivinhar.

A qualidade que mais distingue um bom DM é **como ele narra** — imersão em 2ª pessoa, detalhe sensorial ancorado, voz distinta de NPC, oferecer escolhas com sentido, ritmo — e isso é subjetivo demais para "acho que gostei mais" e sutil demais para um teste determinístico. É exatamente o caso de uso de um **LLM-as-judge com rubrica**.

### O que estamos usando como referência do "bom"

Uma aventura real jogada no Grok (`docs/sdlc/referencia/aventura-seraphine.md` — a extrair do `.docx` original, ver Notas) serve de **âncora positiva** da rubrica: é o padrão de narração que queremos reproduzir. Dela saem tanto a rubrica (as qualidades que agradaram) quanto 3–5 **turnos exemplares** (`ação do jogador → resposta do DM`) usados como few-shot de calibração para o juiz.

**Atenção — o que a referência NÃO é gold:** a mesma aventura tem falhas mecânicas conhecidas (não rolava dados, o mestre não lia a ficha, inventário mal calculado). Essas dimensões **não** vão para o juiz LLM — ele alucinaria tão bem quanto o Grok. Corretude mecânica fica em testes determinísticos (US-27/29/38 já cobrem parte). A referência é âncora **só de narração**.

### Por que a solução atual não basta

A suite `evals/` (vitest, `runner`/`scorer` por trás de `pnpm eval`) valida comportamento do DM Agent, **mas roda contra um único modelo** — o `defaultModel` fixo em `model.ts`. Não há como:

1. Apontar a mesma bateria para uma lista de modelos numa só execução.
2. Pontuar **qualidade narrativa** por rubrica multi-eixo, não só passa/falha.
3. Produzir um comparativo lado a lado (matriz modelo × dimensão) com custo/latência na mesma tabela.

### A proposta

1. Parametrizar a suite por **modelo** (rodar a mesma bateria contra N candidatos numa execução).
2. Adicionar um **LLM-judge com rubrica multi-eixo** ancorado na aventura de referência, pontuando cada turno gerado (1–5 por dimensão).
3. Manter **guardrails determinísticos baratos** (ex.: "não rola dado sozinho") e **coerência** como uma das dimensões — a US mescla narração + coerência, não troca uma pela outra.
4. Gerar um **relatório comparativo**: matriz modelo × dimensão + custo/latência estimados.

O output é a base objetiva para decidir o `narrationModels` em `model.ts`.

---

## Entregável (o que você vê)

O resultado **não** é tela do app nem dashboard — é uma **tabela no terminal** + um **arquivo markdown com a matriz**, gerados ao rodar o comando gated. Nada player-facing: alimenta uma decisão de dev (qual modelo vai pro `narrationModels`).

Ao rodar `BAKEOFF=1 NVIDIA_API_KEY=... pnpm --filter @ai-dm/ai-engine test narrative-bakeoff`:

**1. Slice 1 (dump) — no stdout.** Narração inteira de cada modelo lado a lado + tabela `TTFT / tokens / chars`. Pra ler a prosa com o olho:

```
========== mistralai/mistral-large-3-475b-instruct ==========
A chuva fina batia no seu elmo enquanto Aurora relinchava, nervosa. O portão
entreaberto rangia... [narração INTEIRA que o modelo escreveu]

┌──────────────────────────────┬─────────┬────────┬───────┐
│ modelo                       │ TTFT    │ tokens │ chars │
│ mistral-large-3-475b-instruct│ 820 ms  │ 412    │ 1893  │
│ llama-3.3-70b-instruct       │ 540 ms  │ 305    │ 1421  │
└──────────────────────────────┴─────────┴────────┴───────┘
```

**2. Slice 2 (juiz) — no stdout E gravado em `evals/reports/<data>.md`.** A matriz de decisão: linha por modelo, coluna por dimensão (média 1–5 das repetições) + MÉDIA geral + spread + custo. É o entregável que decide o `narrationModels`:

```
MATRIZ FINAL (média das dimensões × 5 cenários, 3 reps)
┌────────────────────────┬────────┬──────────┬────────┬────────┬───────┬──────────┬───────┬───────┬────────┐
│ modelo                 │Imersão │Sensorial │Agência │Voz NPC │Ritmo  │Coerência │ MÉDIA │spread │ custo  │
│ mistral-large-3-475b   │ 4.7    │ 4.5      │ 4.3    │ 4.6    │ 4.4   │ 4.8      │ 4.55  │ ±0.3  │ grátis │
│ qwen3-next-80b         │ 4.2    │ 4.0      │ 4.1    │ 3.9    │ 4.3   │ 4.5      │ 4.17  │ ±0.5  │ grátis │
│ llama-3.3-70b          │ 3.8    │ 3.6      │ 4.0    │ 3.5    │ 4.1   │ 4.2      │ 3.87  │ ±0.4  │ grátis │
│ gpt-oss-120b (Groq)    │ 4.0    │ 3.9      │ 4.2    │ 3.8    │ 4.0   │ 4.4      │ 4.05  │ ±0.3  │ pago   │
└────────────────────────┴────────┴──────────┴────────┴────────┴───────┴──────────┴───────┴───────┴────────┘
Guardrails: idioma OK (todos) · reasoning-leak: nenhum · rollDice: OK (todos)
→ Vencedor por MÉDIA: mistral-large-3-475b (4.55) vs incumbente Groq 4.05
```

O **mesmo conteúdo** é gravado em `evals/reports/<data>.md` (versionável, comparável entre rodadas) como tabela markdown:

```markdown
# Bake-off narrativo — 2026-07-09

| modelo | Imersão | Sensorial | Agência | Voz NPC | Ritmo | Coerência | MÉDIA | spread | custo |
|---|---|---|---|---|---|---|---|---|---|
| mistral-large-3-475b | 4.7 | 4.5 | 4.3 | 4.6 | 4.4 | 4.8 | **4.55** | ±0.3 | grátis |
| qwen3-next-80b | 4.2 | 4.0 | 4.1 | 3.9 | 4.3 | 4.5 | 4.17 | ±0.5 | grátis |
| llama-3.3-70b | 3.8 | 3.6 | 4.0 | 3.5 | 4.1 | 4.2 | 3.87 | ±0.4 | grátis |
| gpt-oss-120b (Groq) | 4.0 | 3.9 | 4.2 | 3.8 | 4.0 | 4.4 | 4.05 | ±0.3 | pago |

Guardrails: idioma OK · reasoning-leak: nenhum · rollDice: OK
Vencedor: **mistral-large-3-475b** (4.55) vs incumbente Groq 4.05.
```

**Como usar:** lê a MÉDIA (olhando spread + custo) → escolhe o modelo → **num commit separado** troca o `narrationModels` em [model.ts](../../../packages/ai-engine/src/model.ts). A US produz o **número**; a troca de produção é decisão manual (fora do escopo).

---

## Escopo

### Dentro do escopo

- Rodar contra **uma lista de modelos** numa execução via env `MODELS=a,b,c` (sem ela, usa a rodada 1). Ex.: `BAKEOFF=1 NVIDIA_API_KEY=... MODELS=mistralai/mistral-large-3-475b-instruct,meta/llama-3.3-70b-instruct pnpm --filter @ai-dm/ai-engine test narrative-bakeoff`.
- **LLM-judge com rubrica multi-eixo** (dimensões abaixo), com saída estruturada (JSON via `generateObject` + Zod), ancorado nos turnos exemplares da aventura de referência.
- **Guardrail determinístico** "não rola dado sozinho" (verifica chamada da tool, não a prosa).
- **Coerência** como dimensão da rubrica (o caso "NPC consistente") + reuso do fixture de histórico longo.
- Relatório comparativo: matriz modelo × dimensão (média 1–5 por eixo) + coluna de custo/latência estimados; N repetições por caso para estabilizar a média.
- **Bolt no vitest existente**, não um runner novo: teste gated por env (padrão `bench-ttft.test.ts`), fora do `pnpm eval`/CI. Não existe `runner.ts`/`scorer.ts` — a suite `evals/cases` atual é vitest determinístico puro e fica intacta.

### Fora do escopo

- Trocar o modelo de produção em `model.ts` — é a **decisão** que a US habilita, não a entrega (commit separado depois de ver o relatório).
- Fine-tuning ou ajuste de prompt por modelo — compara-se o **mesmo** prompt em todos.
- Custo exato por billing real — basta estimativa por preço de tabela × contagem de tokens do SDK.
- Julgar corretude mecânica (dados/ficha/inventário) pelo juiz LLM — isso é determinístico e mora nas US de mecânica.
- Avaliação humana lado a lado (blind rating) — pode virar US futura para validar o próprio juiz.

---

## Rubrica de qualidade narrativa (o coração da US)

Derivada da aventura de referência. Cada dimensão pontuada **1–5** pelo juiz, com justificativa curta. Score narrativo do turno = média ponderada.

| Dimensão | Pergunta que o juiz responde |
|---|---|
| **Imersão** | Narra em 2ª pessoa, presente, sem quebrar a 4ª parede nem virar "assistente"? |
| **Detalhe sensorial** | Ancora a cena em visão/som/cheiro/toque sem encher linguiça? |
| **Agência** | Fecha o turno oferecendo escolhas significativas (+ opção livre)? |
| **Voz de NPC** | NPCs falam distinto, com intenção e emoção próprias? |
| **Ritmo** | Avança a cena sem atropelar nem enrolar; tamanho adequado? |
| **Coerência** | Respeita o estado da cena/ficha/histórico dado no contexto (o NPC que mentiu, o ambiente atual)? |

Notas anti-viés (ver Notas de implementação): a rubrica penaliza explicitamente **length bias** (resposta longa ≠ melhor) e o juiz recebe os exemplares como âncora de "5", não como texto a copiar.

## Cases de avaliação

Cobertura por **ortogonalidade**, não volume: cada cenário de juiz tensiona eixos diferentes da rubrica, para a decisão não sair de um único tipo de momento. Cada um usa o turno exemplar correspondente da referência ([aventura-seraphine.md](../referencia/aventura-seraphine.md)) como âncora de "nota 5" — o juiz compara maçã com maçã.

### Cenários de qualidade narrativa (LLM-judge, rubrica multi-eixo)

| Cenário | Input fixo | Eixos que estressa | Âncora |
|---|---|---|---|
| **Turno de abertura** | Chegada a Eldridge ao anoitecer, sob chuva, ao portão entreaberto | Imersão, Detalhe sensorial, Agência | Exemplar 1 |
| **Diálogo com NPC** | Interrogar o velho sobre as crianças e o padre sumido | Voz de NPC, Agência | Exemplar 2 |
| **Combate / ação** | Invocar Expulsar Mortos-Vivos na entrada da igreja | Ritmo, Detalhe sensorial | Exemplar 3 |
| **Dilema moral** | Usar visão divina para julgar os dois cultistas rendidos | Agência, Voz de NPC múltipla | Exemplar 4 |
| **Coerência longa** | Histórico onde um NPC mente no turno ~3; jogador confronta no turno ~20 | Coerência | fixture de histórico longo |

### Guardrails determinísticos (pré-juiz — cortam candidato por 0 token de juiz)

| Guardrail | Input | Falha se |
|---|---|---|
| **Não rola dados sozinho** | "ataco o goblin" (mesmo input do Combate) | Não chamou `rollDice`; inventou o número na prosa |
| **Deriva de idioma** | qualquer cenário | Narração saiu do PT-BR (detecção de idioma) — pega o modelo English-centric na hora |
| **Vazamento de reasoning / voz de assistente** | qualquer cenário | Prosa contém `<think>`, "As an AI", "Aqui está a cena:", bullets de meta-comentário |

**Ordem de implementação:** guardrails primeiro (baratos, eliminam candidatos fracos antes de gastar juiz), depois os cenários de juiz. O Combate compartilha o input com o guardrail "não rola dados". Manter a lista nesses 5 cenários + 3 guardrails — cada cenário a mais multiplica `cenários × modelos × reps × juiz` (teto do free tier do Gemini).

## Modelos candidatos (NVIDIA NIM, free endpoint)

Provider dos candidatos: NVIDIA `https://integrate.api.nvidia.com/v1` (endpoints preview grátis, `NVIDIA_API_KEY`). Ids com prefixo do publisher — confirmar o slug exato na página de cada modelo no catálogo. Lista curta e configurável; **≤ 3 por rodada** por causa do rate limit do preview + custo do juiz. Selecionados do catálogo `nimType:preview` pelo filtro: LLM de texto, mid-large, multilíngue com PT-BR — o resto foi cortado.

**Instruct puros (aposta principal — PT-BR + prosa cinematográfica):**

- `mistralai/mistral-large-3-475b-instruct` — peso-pesado multilíngue; aposta nº1
- `qwen/qwen3-next-80b-a3b-instruct` — multilíngue forte, MoE eficiente
- `meta/llama-3.3-70b-instruct` — baseline confiável (é o fallback de produção atual)
- `meta/llama-3.1-70b-instruct` — bom entendimento de contexto longo (ajuda Coerência)
- `zai/glm-4.6` — generalista/agentic forte
- `mistralai/mistral-medium-3.1-128b` — text-gen + agentic, mais barato que o large

**Reasoning (testar SÓ com thinking off/low):** vazam traço de raciocínio na prosa, puxam voz de "assistente" e sobem latência/custo — ver Notas. Entram só como comparação, com reasoning desligado:

- `nvidia/nemotron-3-super-120b-a10b`
- `nvidia/llama-3.3-nemotron-super-49b-v1.5`
- `openai/gpt-oss-120b` (mesmo modelo do Groq de produção, aqui via NVIDIA)

**Controle:** incumbente `openai/gpt-oss-120b` no **Groq** — coluna de referência para saber se vale trocar de provider/modelo.

**Cortados** (não narram ou PT-BR fraco): vision/VL (`*-vl`, `*-vision`), voz/TTS (`maggie-tts`, studio/background voice), safety/guard (`*-content-safety`, `llama-guard`), embed/rerank (`nv-embed`, `rerank`), world/robótica (`cosmos*`, `nemotron-relocalise`, `berformer`), bio (`esm`/`fold`), detecção (`retail-object`, `active-speaker`), tradutor (`rtw-translate`), NER (`gliner`), PT-BR fraco (`stockmark` JP, `sarvam` índico), tiny <8B (`llama-3.2-1b/3b`, `phi-4-mini`, `nemotron-mini-4b`), e toda a família Gemma.

**Rodada 1** (curta, é o **default** do bake-off): `BAKEOFF=1 NVIDIA_API_KEY=... pnpm --filter @ai-dm/ai-engine test narrative-bakeoff` roda `mistralai/mistral-large-3-475b-instruct`, `qwen/qwen3-next-80b-a3b-instruct`, `meta/llama-3.3-70b-instruct`. O incumbente Groq como coluna de controle entra no **slice 2** (precisa roteamento de provider por prefixo).

---

## Progresso de implementação

- **Slice 1 (feito):** `packages/ai-engine/src/narrative-bakeoff.test.ts` — roda os candidatos contra o turno de abertura e despeja narração + TTFT + tokens. Sem juiz. Provider NVIDIA religado em `model.ts` (`nvidiaModel`).
- **Slice 2 — guardrails (feito):** `packages/ai-engine/src/guardrails.ts` (+ `guardrails.test.ts`, 13 casos, offline/CI) — detectores determinísticos `checkNoSelfRoll` (não rola dados sozinho), `detectLanguageDrift` (deriva de PT-BR) e `detectReasoningLeak` (`<think>`/voz de assistente/bullet meta). Ligados no `narrative-bakeoff.test.ts`: cenário `combat` ("ataco o goblin") + stub `rollDice` para observar a chamada via `toolCalls`; verdict impresso por turno e na tabela resumo.
- **Slice 2 — juiz (feito):** `packages/ai-engine/src/rubric.ts` (+ `rubric.test.ts`, 10 casos puros offline/CI) — rubrica de 6 dimensões, schema Zod, juiz `judgeTurn` via `generateObject`, agregação `aggregateReps` (média/spread), `estimateCost` (const de preços) e `renderReportMarkdown`. `judgeModel` em `model.ts` (`@ai-sdk/google@1.2.22` pinado no provider 1.1.3) com roteador por prefixo: `openai:<id>`/`openrouter:<id>` (openai-compatible, sem dep nova) senão Google. `resolveModel` roteia candidatos (`groq:` → incumbente). 5 cenários (abertura, diálogo, combate, dilema, coerência "NPC mentiu") com exemplares "nota 5" da referência.
- **Slice 2 — execução (feito, 2026-07-10):** matriz gerada, artefato em [`evals/reports/2026-07-10.md`](../../../evals/reports/2026-07-10.md). Achados da 1ª execução real:
  - **Slugs corrigidos** — os ids antigos eram fantasia (`mistral-large-3-475b` = 404; `llama-3.3-70b`/`qwen3-next` penduravam). Trio validado no catálogo real (`GET /v1/models`): `mistralai/mistral-large-3-675b-instruct-2512`, `mistralai/mistral-small-4-119b-2603`, `z-ai/glm-5.2`.
  - **Runner standalone `run-bakeoff.mjs`** é o entry de execução pesada, NÃO o vitest: o par `streamText`+vitest pendurava (o `await result.usage` trava quando o stream aborta) e o teto de 600s/1200s estourava. O runner usa `generateText` (resolve inteiro), série + pacing + `maxRetries` moderado, e sobrevive ao rate-limit do preview.
  - **Escolha do juiz importa (questão 2, empírico):** `gpt-4o-mini` **satura** (tudo ~5.0, spread ±0.17 — inútil pra decidir); `gemini-flash-latest`/`gemini-3.5-flash` **discriminam** (notas 3–5, spread ±0.5). Default do juiz corrigido para `gemini-flash-latest` (`gemini-2.5-flash` foi descontinuado p/ novos users; `*-pro` têm quota-zero no free tier desta chave).
- **Falta:** (1) **matriz limpa decision-grade** — a rodada com juiz que discrimina (gemini-flash) ficou parcial porque o free tier (NVIDIA preview per-model + Gemini flash) esgotou após muitas iterações no mesmo dia; rodar 1× com quota fresca, espaçado, para os 3 candidatos completos. (2) spot-check manual do juiz (questão 2). (3) paridade de input (US-39/40/41): fixture hoje magra de propósito; enriquecer com background/divindade/features da Seraphine. (4) controle Groq (`groq:openai/gpt-oss-120b`) na matriz.

## Critérios de aceite

- [x] A suite aceita uma **lista de modelos** por env `MODELS=a,b,c` e roda o mesmo cenário contra cada um numa execução (sem `MODELS`, usa a rodada 1). _(slice 1)_
- [x] Existe o **LLM-judge com rubrica multi-eixo**, com saída estruturada (JSON/Zod), pontuando cada dimensão 1–5 com justificativa, ancorado nos turnos exemplares da aventura de referência. _(slice 2: `rubric.ts` `judgeTurn` + `rubricSchema`; exemplares 1–4 da referência como few-shot)_
- [x] Existe o guardrail **determinístico** "não rola dados sozinho" (verifica que `rollDice` foi chamada, não a prosa). _(slice 2: `checkNoSelfRoll` + `guardrails.test.ts`; também deriva de idioma e vazamento de reasoning)_
- [x] Existe o case de **coerência** ("NPC consistente"), pontuado pela dimensão Coerência da rubrica. _(slice 2: cenário `coerencia` com `COHERENCE_SYSTEM` — Garrick mentiu no histórico; `EX_COHERENCE` como âncora)_
- [x] A execução produz um **relatório comparativo** legível: linha por modelo, coluna por dimensão (média 1–5) + coluna de custo/latência estimados; N repetições por caso reportando a média. _(slice 2: `renderReportMarkdown` + `console.table` de TTFT/tokens/reps; grava `evals/reports/<data>.md`)_
- [x] A estrutura do relatório é **determinística** (mesma tabela sempre); só os números variam pelo não-determinismo do LLM. _(slice 2: teste "estrutura estável: mesma entrada → mesma saída" em `rubric.test.ts`)_
- [x] O bake-off é gated por `BAKEOFF` (padrão `bench-ttft`) → `pnpm eval`/`pnpm test`/CI não são afetados.
- [x] **Regressão:** a execução produz a tabela com uma linha por modelo, a rubrica pontuada e o caso "não rola dados sozinho" avaliado. _(2026-07-10: matriz completa em `evals/reports/2026-07-10.md` via `run-bakeoff.mjs`; guardrails aplicados por turno. Falta só a matriz decision-grade com juiz que discrimina + todos os candidatos numa rodada de quota fresca.)_

---

## Notas de implementação

- **Sem runner novo:** o bake-off é um teste vitest gated (`narrative-bakeoff.test.ts`), padrão `bench-ttft`. Modelos vêm de `MODELS=` (env), resolvidos por `nvidiaModel(id)` de `model.ts`. Parametrização por env, não flag `--models` de CLI — vitest não repassa flag custom.
- **Dois providers na malha:** o incumbente vem da fábrica `groq(...)` de `model.ts`; os candidatos NVIDIA usam `createOpenAICompatible({ baseURL: 'https://integrate.api.nvidia.com/v1', apiKey: NVIDIA_API_KEY })` — já religado em `model.ts` (`nvidia`/`nvidiaModel`), reaproveitando o encanamento do `bench-ttft.test.ts`. Slice 1 manda tudo via `nvidiaModel`; o resolvedor por prefixo (`id → provider`, para incluir o controle Groq) é slice 2.
- **Reasoning off nos candidatos de reasoning:** passar `reasoning_effort: 'low'` (gpt-oss / nemotron) ou o equivalente por família (`/no_think` no Qwen) para comparar justo com os instruct puros. E **separar o canal de reasoning da narração** no stream — no AI SDK v4 o reasoning chega em parte própria; se não isolar, vaza `<think>` na prosa e detona a dimensão Imersão.
- **Juiz externo aos candidatos:** para evitar *self-preference bias*, o juiz não deve ser o mesmo modelo/provider que gera. **Default: `gemini-2.5-flash` (Google, tier grátis)** via `@ai-sdk/google` + `GEMINI_API_KEY`. Zera o custo do pipeline (juiz é a única peça paga) e os limites do free tier aguentam o bake-off. `gemini-2.5-pro` (grátis, rate limit apertado) para **calibrar** um subconjunto; `gpt-5-mini` (OpenAI, pago) como **fallback** se o rate limit do Google incomodar. Reasoning é **desejável** no juiz (delibera e descarta o raciocínio, fica só o JSON) — oposto da narração. Modelo trocável por env/const (ver questão em aberto).
  - **Pin do SDK:** `@ai-sdk/google` precisa resolver para `@ai-sdk/provider@1.1.x` (AI SDK v4 / `LanguageModelV1`), senão `tsc` quebra — mesma armadilha do `@ai-sdk/openai-compatible`. Confirmar a versão compatível antes de instalar.
  - **Uso de dados:** free tier do Google AI Studio pode usar prompts/saídas para melhorar produtos. Entram só narração + trechos da referência (sem PII sensível) → risco baixo, mas registrado. Vertex/tier pago não treina nos dados.
  - **Structured output:** Gemini suporta `responseSchema` → casa com `generateObject` + Zod. Rodar N repetições e tirar média (reasoning não é 100% estável).
- **Saída do juiz:** `generateObject` + schema Zod (`{ dimensao: { nota: 1-5, justificativa: string } }`). Nada de parsear prosa livre.
- **Calibração:** passar 3–5 turnos exemplares da aventura de referência como few-shot ("isto é nota 5"), **não** como resposta a copiar.
- **Anti-viés:** instruir o juiz explicitamente contra length bias e position bias; embaralhar a ordem quando comparar; a rubrica premia concisão adequada, não volume.
- **Não-determinismo:** rodar cada caso N vezes (sugestão: 3) e reportar a média — evita decidir por um sample sortudo/azarado.
- **Custo:** candidatos NVIDIA rodam em endpoint preview **grátis** (custo de API ~0, mas rate limit baixo → ≤ 3 por rodada, N repetições espaçadas). O custo pago real é o **juiz** (OpenAI): N repetições × M candidatos × 1 chamada de juiz por turno. Estimar via tokens do SDK × mapa estático `model → $/1M tokens`; latência entra na tabela mesmo com custo grátis (TTFT importa para narração streamada).
- **Paridade de input (crítico):** a fixture do bake-off deve espelhar a identidade da referência (background, ideais/fraquezas, divindade da Seraphine) via os campos da [US-39](./US-39-identidade-narrativa-background-ideais.md)/[US-40](./US-40-divindade-do-personagem.md) — mas **exatamente o que a produção entrega**, nunca mais rico. Fixture acima da produção = medir contexto que o app não fornece → decisão inválida. Slice 1 usa a ficha magra de hoje de propósito (só prova o pipeline); o juiz do slice 2 só é justo depois da US-39/40.
- **Local dos arquivos:** slice 1 vive em `packages/ai-engine/src/narrative-bakeoff.test.ts` (perto do `bench-ttft`, para importar `buildDmSystemPrompt`/`nvidiaModel` sem cruzar workspace). A rubrica + turnos exemplares (slice 2) e o fixture de histórico longo do "NPC consistente" ficam ali ao lado ou em `evals/narrative/` — decidir no slice 2.
- **Extrair a referência:** o `.docx` original (`A Jornada de Lady Seraphine Valthor.docx`) tem acentos corrompidos em cp1252 na extração — reconverter para UTF-8 limpo ao gerar `docs/sdlc/referencia/aventura-seraphine.md` e ao recortar os turnos exemplares.

## Questões em aberto

1. **Modelo-juiz:** ~~default `gemini-2.5-flash`~~ **atualizado (2026-07-10, empírico):** `gemini-2.5-flash` foi **descontinuado** para novos users e os `*-pro` (2.5/3-pro) têm **quota-zero** no free tier desta chave. Default agora **`gemini-flash-latest`** (alias vivo). Confirmado que o juiz **discrimina** (notas 3–5, spread ±0.5); o fallback OpenAI testado foi **`gpt-4o-mini`** (`gpt-5-mini` exige verificação de org), que **satura** (tudo ~5.0) → serve de exemplo negativo, não como juiz. Trocável por env `JUDGE_MODEL` (`openai:`/`openrouter:`/Google por prefixo).
2. **Validar o próprio juiz:** **decidido: spot-check manual leve no slice 2, NÃO US futura.** O juiz é a fundação — se estiver descalibrado, toda a tabela é lixo, então validar é barato e obrigatório. Versão preguiçosa: pontuar à mão **~5–8 turnos** (a rubrica e a referência já existem) e comparar com o juiz. Critério de confiança: mesmo **ranking** dos modelos + concordância **±1** na maioria das dimensões. Se divergir, subir pro `gemini-2.5-pro` e re-checar. Sem Cohen's kappa nem formalismo — é gate de sanidade, não paper.
3. **Quantas repetições** por caso — **decidido: 3 default + bump adaptativo pra 5 só nos finalistas próximos.** Redução de ruído é sublinear (erro-padrão ∝ 1/√N: 3→5 aperta só ~23%), mas o custo é linear (+67% de gerações E de chamadas de juiz → mais risco de throttle no free tier do Gemini). Então 3 no primeiro pente (elimina perdedores óbvios) e 5 (ou mais) só quando dois candidatos empatam dentro do ruído. **Reportar sempre o spread** (min–max ou desvio) junto da média: um modelo de alta variância se denuncia mesmo com 3 reps e sinaliza que ELE precisa de mais, não todos.
4. **Pesos das dimensões:** **decidido: todas iguais (1.0) por ora.** Ponderar antes de ver dado é premature optimization — não dá pra saber qual eixo pesa até olhar a matriz. Pesos ficam numa const trivial de mudar; só se o relatório mostrar uma dimensão redundante ou puro ruído é que se ajusta. Começar honesto: média simples dos 6 eixos.
5. **Tabela de preços:** **decidido: const hardcoded no módulo do bake-off**, não JSON. São ~poucas entradas, estáticas, só o eval lê — um arquivo JSON só adiciona read+parse sem ganho (YAGNI). E é minúscula: candidatos NVIDIA são grátis (preço 0, só latência/TTFT na coluna), então o mapa `model → $/1M` cobre na prática só o juiz (Gemini free = 0) e o fallback pago `gpt-5-mini`.
6. **Formato do relatório:** **decidido: stdout (`console.table`) + a matriz gravada em `evals/reports/<data>.md`** (tabela markdown, ver "Entregável"). O `.md` é o artefato durável — versionável e comparável entre rodadas — e é o que a decisão de `narrationModels` referencia. Slice 1 (dump) fica só no stdout; a gravação em `.md` vale para a matriz do juiz (slice 2). Caminho fixo por data; sem máquina de histórico além disso (YAGNI).

## Referências no código

- `packages/ai-engine/src/model.ts` — fábricas `groq(...)` e `nvidia` (`createOpenAICompatible`), export `nvidiaModel(id)`, `narrationModels`, `defaultModel`, `summaryModel`.
- `packages/ai-engine/src/narrative-bakeoff.test.ts` — bake-off slice 1 (dump). `bench-ttft.test.ts` — precedente do teste gated + provider NVIDIA. _(não existe `runner.ts`/`scorer.ts`; a menção anterior era aspiracional.)_
- `evals/cases/us-29-rolagens.ts` / `us-38-rolagens-ancoradas.ts` — base determinística para "não rola dados sozinho".
- `evals/cases/us-03-scene-state.ts` — caso de cena reaproveitável para coerência.
- `evals/README.md` — estrutura da suite e thresholds atuais.
- `docs/sdlc/referencia/aventura-seraphine.md` — âncora de qualidade narrativa (a extrair do `.docx`).
- `packages/ai-engine/src/prompts/dm-system.ts` — prompt de sistema do DM, o mesmo aplicado a todos os candidatos.
