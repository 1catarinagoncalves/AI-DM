# US-114 — As extrações e o fecho saem do modelo da narração

**Épico:** 3 — Narração e mecânica
**Fase:** 1 — MVP single-player
**Status:** 🗂️ Backlog
**Depende de:** [US-103](./US-103-proveniencia-do-endpoint-no-turno.md) (`logExtractionEndpoint` — o instrumento que mede para onde cada extração foi) · [US-104](./US-104-baseline-de-cache-do-prompt-pos-pin.md) (a baseline de custo contra a qual o ganho é medido)
**Relacionada a:** [US-73](./US-73-reconciliador-de-cena-em-background.md) e [US-75](./US-75-dimensao-de-proveniencia-no-ledger.md) (as extrações que mudam de modelo) · [US-74](./US-74-guard-turno-truncado-narracao.md) (o fecho de salvamento, e o teto de 60s do proxy SSE que é a razão da latência importar)
**Criada em:** 2026-08-07

---

## História

> **Como** mantenedora,
> **quero** que o trabalho mecânico do turno — extrair a cena, extrair entidades, fechar um turno truncado — rode num modelo barato e rápido em vez do modelo caro que escreve a narração,
> **para que** cada turno custe e demore menos sem que o jogador note diferença na prosa.

---

## Contexto e motivação

### O problema observado

`packages/ai-engine/src/model.ts:295`:

```ts
export const summaryModel: LanguageModelV1 = primaryModel
```

**A costura existe e aponta para o mesmo modelo.** O nome `summaryModel` e a constante separada `EXTRACTION_PROVIDER_OPTIONS` (`model.ts:282`) descrevem um modelo utilitário que nunca existiu: toda extração estruturada do turno roda no **deepseek-v4-flash da narração**.

Quem paga o modelo caro hoje sem escrever uma palavra que o jogador leia:

| Chamada | Onde | O que faz | Entrada |
|---|---|---|---|
| `extractOpeningScene` | `ai.service.ts:948` | copia local/presentes/objetos da prosa de abertura | um texto de abertura |
| `extractOpeningEntities` | `ai.service.ts:1027` (US-75) | copia entidades duráveis da abertura | um texto de abertura |
| `reconcileScene` | `ai.service.ts:1047` (US-73) | funde cena corrente + narração do turno | cena + uma narração |
| `completeTruncatedTurn` | `ai.service.ts:828` (US-74) | continua a prosa e fecha com as opções | ação + narração, `maxTokens: 700` |

As três primeiras são `generateObject` com **schema fechado e instrução de copiar do texto** — o próprio comentário de `EXTRACTION_PROVIDER_OPTIONS` já reconhece isso ao desligar o *thinking*: *"Extrair não é tarefa de raciocínio"*. Um modelo de fronteira num trabalho de cópia é desperdício direto.

A quarta é diferente e importa mais: o fecho de salvamento é **uma geração inteira extra, serializada, dentro do turno**. A US-74 documenta que a causa real do *"a narração sumiu"* em produção foi o **teto de 60s do proxy SSE** (Hobby da Vercel, ver [US-60](./US-60-web-em-producao-vercel.md)) — quer dizer que o custo aqui não é dinheiro, é o turno estourar e o jogador ficar sem saída.

### Por que a solução atual não basta

Não é descuido: **já se tentou e quebrou.** O comentário em `model.ts:289-294` documenta a tentativa anterior — `groq('llama-3.1-8b-instant')` como modelo de sumarização, revertido porque o *free tier* daquele modelo tem teto de **6000 TPM** e o lote de overflow (resumo acumulado + N turnos) estourava com **413 "Request too large"**.

O que essa reversão prova é mais estreito do que "modelo barato não serve". O lote que estourou foi o da **sumarização** — entrada grande por natureza, cresce com a aventura. As quatro chamadas da tabela acima têm entrada **pequena e limitada**: um texto de abertura, ou uma narração de um turno. A reversão de 2026 aplicou o remédio ao alias inteiro porque o alias era um só; separar o alias é o que permite manter a sumarização no modelo grande e mover o resto.

### A proposta

Quebrar o alias em dois. `summaryModel` **continua** o modelo grande — a sumarização é o caso que já falhou e não muda. Um `extractionModel` novo, barato e sem *thinking*, assume as três extrações estruturadas e o fecho de salvamento.

A rede de segurança do fecho **já existe e não precisa ser construída**: `hasOptionsList(closure)` seguido de `SALVAGE_FALLBACK` (`ai.service.ts:850`) garante que o jogador nunca fica sem opções, mesmo que o modelo pequeno ignore a instrução. O pior caso do fecho degradado já está coberto por código escrito para outra US.

Ideia lida em [tegridydev/dnd-llm-game](https://github.com/tegridydev/dnd-llm-game), que separa o modelo de narração de um modelo utilitário pequeno para dados, extração de estado e geração das opções do jogador. **Licença "Other" (não-padrão) — verificar o arquivo antes de tocar em qualquer linha de lá.** Nada precisa ser copiado: a costura já está aberta neste repo, só falta ligá-la a outro modelo.

---

## Escopo

### Dentro do escopo

- **`extractionModel` em `model.ts`**, distinto de `primaryModel`, com o comentário que registra **por que ele existe** e **por que a sumarização não o usa** (o 413 de 6000 TPM não pode ser reintroduzido por quem ler só o nome).
- **As três extrações estruturadas passam a usá-lo**: `extractOpeningScene`, `extractOpeningEntities`, `reconcileScene`.
- **O fecho de salvamento passa a usá-lo**: `completeTruncatedTurn` troca `narrationModels[0]` (`ai.service.ts:836`) por `extractionModel`. É o item de maior valor da US — ganho de latência num caminho com teto de 60s — e o de maior risco de qualidade, porque é prosa que o jogador lê.
- **`summaryModel` fica onde está**, com o comentário do 413 preservado e reforçado. Não apagar: ele explica um bug de produção.
- **Opções de provider para o modelo novo.** `EXTRACTION_PROVIDER_OPTIONS` hoje carrega `DEEPSEEK_ROUTE` (`model.ts:250`), que é pin de rota **específico do DeepSeek** (`only: DEEPSEEK_ALLOWED_PROVIDERS`). Modelo de outra família precisa do seu próprio pin ou de nenhum — herdar o do DeepSeek falha, e ver *Notas de implementação* para como falha.
- **Medição antes/depois**, com o instrumento que já existe: `logExtractionEndpoint` (US-103) registra o endpoint de cada extração; a baseline da US-104 dá o custo. Comparar custo por turno, latência do fecho e **fidelidade da extração** em fixtures fixos.
- **Reversão de uma linha.** `extractionModel = primaryModel` restaura o comportamento de hoje sem tocar em call site nenhum — é o que torna a US segura de tentar.

### Fora do escopo

- **Trocar o modelo da sumarização.** É o caso que quebrou com 413. Fora até alguém medir o tamanho real do lote de overflow.
- **Trocar o modelo da narração.** A prosa é o produto; a escada de provedores dela é assunto de outra story.
- **Gerar as opções do jogador numa chamada separada em todo turno** (o desenho do `dnd-llm-game`, onde o modelo utilitário sempre produz as escolhas). Aqui as opções são parte da narração e o modelo grande as escreve de graça no mesmo fluxo; extraí-las sempre adicionaria uma chamada por turno para resolver um problema que só aparece quando o turno trunca. Esta US move **só o caminho de salvamento**, que já é uma chamada extra hoje.
- **Rodar modelo local (Ollama)**, como o repo de origem faz. A API roda no Render Free ([US-59](./US-59-api-em-producao-render.md)) — não há máquina para isso.
- **Escolher o slug aqui.** Os slugs do OpenRouter mudam demais para viver num documento; `model.ts` é a fonte viva. Esta US fixa os **critérios** (ver *Questões em aberto* #1).

---

## Critérios de aceite

- [ ] `extractionModel` existe em `model.ts`, exportado, distinto de `primaryModel`, com comentário explicando por que existe e por que `summaryModel` não o usa.
- [ ] `extractOpeningScene`, `extractOpeningEntities` e `reconcileScene` usam `extractionModel`; nenhuma delas usa `summaryModel`.
- [ ] `completeTruncatedTurn` usa `extractionModel`.
- [ ] `summarizeOldTurns` continua no modelo grande, e o comentário do 413 de 6000 TPM segue no arquivo (regressão do bug documentado).
- [ ] As opções de provider do modelo novo **não** herdam `DEEPSEEK_ROUTE` se ele não for DeepSeek. Coberto pelo teste de contrato existente (`provider-contract.test.ts`, `model-routing.test.ts`).
- [ ] **Fidelidade da extração:** contra as mesmas fixtures de abertura e de narração de viagem, `extractOpeningScene` / `extractOpeningEntities` / `reconcileScene` no modelo novo produzem `local`, `presentes` e a lista de entidades **equivalentes** aos do modelo grande. Divergência é motivo de reverter, não de ajustar o critério — extração errada falha **em silêncio** (cada `catch` devolve `null` e a aventura segue sem cena/ledger, como o comentário de `EXTRACTION_PROVIDER_OPTIONS` já avisa).
- [ ] **Qualidade do fecho:** num turno truncado de fixture, o fecho gerado pelo modelo novo continua a prosa sem repetir o final da narração e emite a lista de opções (`hasOptionsList` verdadeiro). Quando não emite, o `SALVAGE_FALLBACK` assume — teste de regressão do guard da US-74, que **não** pode ter sido enfraquecido.
- [ ] **Latência:** tempo do `completeTruncatedTurn` medido antes e depois, no mesmo caminho. O número precisa aparecer no relato da story — é a justificativa contra o teto de 60s do proxy.
- [ ] **Custo:** custo por turno antes e depois, contra a baseline da US-104.
- [ ] Reverter é `extractionModel = primaryModel`, uma linha, sem tocar em call site.
- [ ] `pnpm eval` e `pnpm typecheck` passam.

---

## Notas de implementação

> *Dicas. O implementador pode divergir com boa justificativa.*

- **A armadilha do `reasoning`.** `EXTRACTION_PROVIDER_OPTIONS` usa `reasoning: { enabled: false }`, e o comentário em `model.ts:263-281` mede que **`exclude` e `effort` derrubam as três chamadas com 400** (`Thinking mode does not support this tool_choice`) — e derrubam **em silêncio**. Modelo novo sem *thinking* pode não aceitar a chave; testar as três chamadas de ponta a ponta, não só compilar.
- **A armadilha do pin de rota.** `DEEPSEEK_ROUTE` (`model.ts:250`) tem `only: DEEPSEEK_ALLOWED_PROVIDERS` e `require_parameters: true`. Aplicado a modelo de outra família, o OpenRouter não tem provedor que case e a chamada falha — de novo, para dentro de um `catch` que devolve `null`. Se o modelo escolhido não for DeepSeek, ou dar-lhe o próprio pin, ou omitir `provider` e aceitar a rota padrão.
- **`generateObject` e o modo tool.** `createChatModel` do `openai-compatible` força `defaultObjectGenerationMode: 'tool'` (`model.ts:231-238`): o schema viaja como definição de tool, não como `response_format`. **O modelo escolhido precisa suportar tool calling** — um modelo minúsculo sem tool calling não roda as extrações, por mais barato que seja.
- **Medir com o que existe.** `logExtractionEndpoint` (US-103) já loga o endpoint de cada extração; a live eval (`DM_LIVE_EVAL`, US-36) já pontua turnos reais em dev. Nenhum instrumento novo é necessário para os critérios acima.
- **Ordem de entrega sugerida:** primeiro as três extrações (baixo risco — saída estruturada, comparável campo a campo), medir, e só então o fecho (prosa que o jogador lê). Duas entregas dão dois pontos de reversão em vez de um.
- **`ai-engine` roda de `dist`:** mexer em `model.ts` exige `pnpm --filter @ai-dm/ai-engine build` para a API pegar — sem isso a API continua com o modelo antigo e a medição não mede nada.
- **Chave e ambiente:** a API não carrega `.env` sozinha (sem `ConfigModule`/`dotenv`); em dev os secrets vêm do `.env` da **raiz** via `dotenv -e .env`. Em produção, `OPENROUTER_API_KEY` já está no Render (US-59) — se o modelo novo for de outro provedor, é **env var nova nos painéis**, configuração manual.

---

## Questões em aberto

1. **Qual modelo?** Critérios, em ordem: (a) suporta **tool calling** — sem isso `generateObject` não roda; (b) sem *thinking* obrigatório, ou com desligar aceito; (c) barato por token de entrada, que é onde está o volume; (d) rápido no TTFT, que é o que importa no fecho; (e) já alcançável pela `OPENROUTER_API_KEY` existente, para não virar env var nova em três painéis. Escolher no dia, do catálogo vivo — não fixar slug neste documento.
2. **O modelo pequeno escreve um fecho aceitável?** O guard da US-74 garante que **existem opções**, não que a prosa case com o tom do turno. Um fecho tonalmente errado é pior que um fecho lento, e o critério de aceite mede `hasOptionsList`, não estilo. Se a live eval acusar queda, o fecho volta para o modelo grande e a US entrega só as extrações — que já são a maior parte do volume.
3. **Onde está o volume real?** Nenhum dos quatro caminhos é por-turno garantido: o fecho só roda em turno truncado, `reconcileScene` só quando o Mestre não chamou `updateScene` (`ai.service.ts:804`), as duas de abertura uma vez por aventura. Se `reconcileScene` disparar raramente, o ganho de custo é pequeno e sobra só o de latência. **Medir a frequência antes de implementar** — pode ser que a US valha só pelo fecho.
4. **Vale um terceiro modelo?** Extração estruturada e continuação de prosa são tarefas diferentes; o mesmo `extractionModel` para as duas é o atalho barato. Se o item 2 falhar por qualidade e o 1 por custo, a saída é um modelo por tarefa — mais superfície de configuração, e só com dado que a justifique.

---

## Referências no código

- [`packages/ai-engine/src/model.ts`](../../../packages/ai-engine/src/model.ts) — `:295` `summaryModel = primaryModel`, o alias que esta US quebra, com o comentário do 413 de 6000 TPM logo acima; `:282` `EXTRACTION_PROVIDER_OPTIONS` e a medição do `reasoning`; `:252` `NARRATION_PROVIDER_OPTIONS`; `:250` `DEEPSEEK_ROUTE`; `:231-238` por que `generateObject` usa o modo tool.
- [`apps/api/src/ai/ai.service.ts`](../../../apps/api/src/ai/ai.service.ts) — `:828` `completeTruncatedTurn` e `:836` o `narrationModels[0]` que sai; `:850` o guard `hasOptionsList` + `SALVAGE_FALLBACK` que já cobre o pior caso; `:1047` `reconcileScene`; `:1020` `extractOpeningEntities`; `:804` a condição que dispara a reconciliação; `:807` `summarizeOldTurns`, que **não** muda.
- [`packages/shared/src/narration.ts:210`](../../../packages/shared/src/narration.ts) — `hasOptionsList`, o predicado puro que garante o contrato de fecho.
- [`apps/api/src/ai/ai.controller.ts:153`](../../../apps/api/src/ai/ai.controller.ts) — o mesmo predicado do lado do controller, que re-amostra; a latência medida é a deste caminho.
- `packages/ai-engine/src/provider-contract.test.ts` e `model-routing.test.ts` — os testes de contrato que o modelo novo tem de passar.
- [US-74](./US-74-guard-turno-truncado-narracao.md) — o teto de 60s do proxy SSE, razão pela qual a latência do fecho é o item de maior valor aqui.
