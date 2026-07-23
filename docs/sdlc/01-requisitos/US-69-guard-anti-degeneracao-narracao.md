# US-69 — Guard anti-degeneração da narração (o jogador NUNCA vê a parede)

**Épico:** 2 — Aventura
**Fase:** 1 — MVP single-player
**Status:** 🗂️ Backlog
**Depende de:** [US-34](./US-34-qualidade-da-narracao-do-dm.md) (ofício narrativo), [US-68](./US-68-nomes-de-fantasia-originais.md) (onomástica — é o que empurra o modelo para a região OOD onde a degeneração mora).
**Criada em:** 2026-07-23

---

## História

> **Como** jogador,
> **quero** que, quando o modelo de IA travar num loop de repetição ("cra cra cra cra…"), o AI DM detecte e se recupere sozinho — reescrevendo o turno ou mostrando um erro limpo,
> **para que** eu NUNCA veja uma parede de texto repetido nem uma narração cortada no meio, e a sessão continue jogável.

---

## Contexto e motivação

### O problema observado

Em teste de produção, ao inventar o nome de uma erva, o modelo de narração (DeepSeek V4 Flash, via OpenRouter) entrou em **loop de repetição degenerado**: cuspiu "cra cra cra cra…" por centenas de tokens, sem fechar a frase, até estourar o teto de saída (`maxTokens: 4000`) e terminar com `finishReason=length`. Do lado do jogador: uma parede de texto repetido e a narração inutilizada.

**Por que acontece (causa-raiz):** geração autorregressiva. Cada token é previsto condicionado no que já foi gerado; emitir "cra" torna "cra" mais provável no passo seguinte — feedback loop autossustentado (poço de atração). Dispara com mais força em regiões **OOD** (out-of-distribution): tokens raros/inventados onde a distribuição de probabilidade fica achatada e "repetir o anterior" vira o pico local mais seguro. Inventar um nome original de erva/NPC/lugar — exatamente o que a [US-68](./US-68-nomes-de-fantasia-originais.md) pede — é OOD por design: foge do que é comum no treino, então aumenta a chance de degeneração.

### Por que a solução atual não basta

Já existem duas camadas, e nenhuma cobre este caso:

1. **`frequencyPenalty: 0.3`** em `apps/api/src/ai/ai.service.ts` (mitigação já em prod desde 2026-07-23). Penaliza a logit de um token ∝ quantas vezes já apareceu → desmancha o loop de token único na origem. **Mas é probabilístico, não uma garantia:** reduz a chance, não zera. E não pega loop de **n-grama** (uma FRASE repetida — "ela olha, ela olha" — dilui a contagem por token e escapa da penalidade).

2. **Escada de retry** (`narrationModels` + `attempt++`) no `ai.controller.ts`. Só entra quando o modelo falha **ANTES** de emitir qualquer texto (`!emittedAnyText`). A degeneração acontece **no meio do stream** — o texto já começou a sair —, então a escada nunca dispara. Uma vez que os tokens de "cra" foram para o cliente via SSE (`res.write('0:'+delta)`), não há recuperação: a parede é transmitida ao vivo.

Falta uma rede **determinística** que aja DURANTE o streaming.

### A proposta

Um guard que monitora o texto conforme ele é gerado, detecta repetição patológica cedo (token único OU n-grama), e, ao detectar: **descarta** o que estava sendo transmitido, **reescreve** o turno (retry) e, se a reescrita também degenerar, cai numa **mensagem de erro limpa** — nunca na parede. Zero dependência de sorte de amostragem.

---

## Escopo

### Dentro do escopo

- **Detector de degeneração** rodando no laço de streaming (`ai.controller.ts`), sobre o texto acumulado do step (`curStepText`), por delta:
  - **Token/sílaba única:** mesmo curto token repetido ≥ N vezes seguidas (ex.: N=8).
  - **N-grama:** mesmo bigrama/trigrama repetido ≥ M vezes numa janela deslizante (ex.: M=5).
  - Limiares configuráveis por constante (não mágicos espalhados).
- **Descarte do parcial + retry:** ao disparar, emitir um sentinel de **descarte** para o cliente limpar o que já mostrou naquele turno, e refazer o turno pela escada (`attempt++`) — próximo modelo, ou o mesmo com penalidade mais agressiva.
- **Mensagem de erro limpa como último recurso:** se todas as tentativas degenerarem/falharem, mostrar algo como `[O Mestre se perdeu nas palavras. Tenta de novo.]` em vez da parede. Reusar/estender a mensagem de erro que já existe no controller (linha ~147).
- **Cooperação do cliente (`apps/web`):** o frontend precisa honrar o sentinel de descarte — apagar o buffer de texto parcial do turno antes de renderizar a reescrita. Há precedente: o sentinel `R\n` já reseta texto de step (US-29/US-38); esta US estende para um descarte de turno inteiro.
- **Corte defensivo do `maxTokens`:** avaliar baixar o teto ou abortar mais cedo — hoje 4000 comporta o raciocínio oculto do deepseek; um loop enche isso todo antes de o guard por contagem sequer precisar agir. O guard por repetição é o gatilho primário; o `maxTokens` é só a barreira final.

### Fora do escopo

- **Trocar o modelo primário / mexer em sampling além do já feito.** `frequencyPenalty` fica; subir para `0.5` ou somar `presencePenalty` é ajuste de config, não precisa desta story (fazer inline se ajudar).
- **Buffer-and-gate (bufferizar o turno inteiro antes de mostrar).** Garantiria zero parede trivialmente, mas MATA o streaming/TTFT — e a app inteira é construída em torno do stream (US-55 caching, proxy SSE da US-60). Rejeitado; ver Questão em aberto #1.
- **Eliminar a degeneração na origem.** É comportamento emergente da decodificação autorregressiva em OOD; não se "conserta" o modelo, só se contém o sintoma.
- **Guard nas chamadas de `summarizeOldTurns` / `generateOpeningNarration`.** Menor risco (não é streaming ao vivo para o jogador); só entra se também reincidir lá.

---

## Critérios de aceite

- [ ] Existe um detector de repetição no laço de streaming do `ai.controller.ts` que dispara para (a) token único repetido ≥ N e (b) n-grama repetido ≥ M, com limiares em constantes nomeadas.
- [ ] Ao disparar, o turno é **descartado e reescrito** pela escada de modelos (não streamado até o fim).
- [ ] O cliente (`apps/web`) honra o sentinel de descarte: o texto parcial degenerado é apagado da tela antes da reescrita — o jogador não fica com "cra cra" preso na UI.
- [ ] Se TODAS as tentativas degenerarem/falharem, o jogador vê uma **mensagem de erro limpa**, nunca a parede nem uma narração cortada.
- [ ] A escada de retry existente (falha antes do texto) e os saneadores (US-29 rolagens, vazamento de raciocínio, tags de estado) continuam funcionando — o guard SOMA, não substitui.
- [ ] **Regressão:** um stream sintético que emite "cra " 30× seguidas é detectado e NÃO chega inteiro ao cliente; um stream normal (narração legítima com uma palavra repetida 2-3× por ênfase) NÃO dispara falso-positivo.

---

## Notas de implementação

> *Dicas para quem implementar. O implementador pode divergir com boa justificativa.*

- **Onde detectar:** o laço `for await (const part of result.fullStream)` no `ai.controller.ts` (~linha 103), no ramo `text-delta` (~134-141). `curStepText` já acumula o texto do step — rodar o detector sobre ele a cada delta é barato (checar só a cauda, janela deslizante, não o texto todo).
- **Tensão central — streaming é append-only no cliente.** Uma vez enviado `res.write('0:'+delta)`, o token está na tela. "NUNCA ver a parede" só é possível se o detector disparar **cedo** (poucas repetições) E o cliente souber **descartar** o parcial. Portanto: manter o limiar N baixo o bastante para cortar antes de virar parede, mas alto o bastante para não matar ênfase legítima. Calibrar com saídas reais.
- **Reaproveitar o sentinel de reset:** o `R\n` (controller ~136) já instrui o cliente a descartar texto de step. Estender esse mecanismo (ou criar um irmão, ex.: `X\n` = descarte de turno) evita inventar protocolo novo. Exige tocar no parser SSE do `apps/web`.
- **Retry sem duplicar estado:** a escada já dedupe blocos de rolagem entre tentativas (`emittedRolls`, controller ~89/129) e só persiste `ACTION`/`NARRATION` quando `finalText.length > 0` (ai.service ~608). O retry por degeneração precisa entrar nessa mesma disciplina — não gravar o turno degenerado, não re-emitir a rolagem.
- **`frequencyPenalty` fica:** é a primeira linha (probabilística); este guard é a segunda (determinística). As duas juntas.
- **Detector puro e testável:** extrair a lógica de detecção como função pura (`detectDegeneration(text): boolean`) para o teste de regressão exercê-la sem stream real — mesmo padrão de `resolveKnownSpell`/saneadores.

---

## Custo da solução

Defesa em camadas por **custo crescente**: sampling penalty (grátis) → este guard+retry (médio) → buffer-and-gate (caro, mata streaming). Sobe de camada só quando a de baixo falha — por isso esta story fica em backlog atrás do `frequencyPenalty`.

Princípio-chave: **o turno saudável não paga nada.** O detector roda sempre, mas é ~zero; o custo pesado (retry) só ocorre no caminho de exceção (loop real OU falso-positivo).

| Eixo | Custo | Quando |
|---|---|---|
| **Implementação** | Médio, cross-cutting em 2 apps (`apps/api` detector+retry no caminho crítico de todo turno; `apps/web` parser SSE honrando o sentinel de descarte; protocolo coordenado entre os dois). Não é 1 arquivo. | Uma vez, na entrega |
| **Runtime — detector** | ~Zero. Checa só a cauda do texto (janela deslizante) por delta, não o texto todo. Micro-CPU. | **Todo** turno |
| **Runtime — retry** | Alto pontual: reescrever o turno = 2ª chamada de LLM completa (input + raciocínio + saída de novo). Custo esperado ≈ (taxa de loop + taxa de falso-positivo) × custo do turno. | **Só** quando dispara |
| **UX — latência** | Jogador espera ~2× o tempo naquele turno (stream descartado + reescrita). Aceitável vs ver a parede. | Só no disparo |
| **UX — lampejo** | Limiar N baixo pode deixar passar 2-3 repetições antes do corte. Não é parede, mas não é zero. | Só no disparo |
| **Falso-positivo** | O custo escondido e mais perigoso: limiar mal calibrado corta ênfase legítima ("não, não, não!", "corre, corre, CORRE") como se fosse loop → descarta narração boa + retry à toa (latência + $ + narração pior). Calibração é o trabalho fino da story. | Sempre que o limiar erra |
| **Manutenção** | Baixo, não nulo: protocolo de sentinel novo entre API e web é mais uma coisa que pode quebrar num refactor do stream. | Contínuo |

**Comparação com a mitigação já em prod:** `frequencyPenalty: 0.3` custa ~zero — um número na config, sem retry, sem cliente, sem falso-positivo. É por isso que ele é a 1ª linha e este guard só se paga se o barato não segurar.

---

## Questões em aberto

1. **Early-abort+descarte vs buffer-and-gate.** O descarte mantém o streaming (bom TTFT) mas exige cooperação do cliente e um limiar bem calibrado (o jogador pode ver um lampejo de 2-3 "cra" antes do corte). Bufferizar garante zero parede mas mata o streaming. Proposta atual: early-abort+descarte. Reavaliar se o lampejo incomodar.
2. **Limiares N (token) e M (n-grama).** Chutes iniciais N=8, M=5. Precisam de calibração contra narração real para não cortar ênfase legítima ("não, não, não!") nem deixar passar loop. Candidato a medir no runner de `evals/`.
3. **Retry no mesmo modelo com penalidade maior vs pular direto para o próximo.** Reescrever no mesmo primário com `frequencyPenalty` temporariamente alto pode bastar (mais barato que trocar de modelo). A decidir na implementação.

---

## Referências no código

- `apps/api/src/ai/ai.controller.ts` — laço de streaming SSE (`fullStream`, ~103); ramo `text-delta` (~134) onde o detector entra; escada de retry `attempt++` (~91) que só age antes do texto; mensagem de erro limpa (~147); sentinel `R\n` de reset de step (~136).
- `apps/api/src/ai/ai.service.ts` — `streamText` com `maxTokens: 4000` e `frequencyPenalty: 0.3` (~520-532); `onFinish` com log `finishReason` (~535/539) — sinal de detecção do problema em prod; persistência condicional do turno (~608).
- `packages/ai-engine/src/model.ts` — `narrationModels` (escada) e `NARRATION_PROVIDER_OPTIONS` (~88-112).
- [US-68](./US-68-nomes-de-fantasia-originais.md) — a onomástica que empurra o modelo para OOD (a exposição do bug).
- [US-36](./US-36-eval-de-qualidade-da-narracao.md) — eval de narração; candidato a hospedar a calibração dos limiares e a checagem de regressão.

---

## Gatilho para ativar (backlog condicional)

Esta story fica no backlog **de propósito**. Ativar só quando houver **reincidência em prod**: `finishReason=length` recorrente nos logs do `onFinish`, ou relato de parede de repetição pelo jogador. Enquanto o `frequencyPenalty: 0.3` segurar (sem reincidência), não vale a complexidade — YAGNI. A rede determinística é o próximo passo se a mitigação probabilística falhar.
