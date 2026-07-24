# US-69 — Guard anti-degeneração da narração (o jogador NUNCA vê a parede)

**Épico:** 2 — Aventura
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** [US-34](./US-34-qualidade-da-narracao-do-dm.md) (ofício narrativo), [US-68](./US-68-nomes-de-fantasia-originais.md) (onomástica — é o que empurra o modelo para a região OOD onde a degeneração mora).
**Criada em:** 2026-07-23
**Atualizada em:** 2026-07-24 — 2º modo de degeneração observado em prod (embaralhamento de whitespace, `finishReason=stop`), distinto do loop; premissa "`frequencyPenalty` é grátis" corrigida. Ver Contexto.

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

### Segundo modo observado (2026-07-24): embaralhamento de whitespace

Reincidência com sintoma **diferente** do loop, no mesmo modelo (DeepSeek V4 Flash via OpenRouter, `attempt=0`). A narração saiu com o **whitespace deslocado**: espaço antes da pontuação, espaço faltando entre palavras (`traçaum`, `diantedeboca`), letra dobrada (`dedoss`) — a frase inteira embaralhada, mas **sem repetição**. Diferença crítica para o detector: terminou com `finishReason=`**`stop`**, `completionTokens=839` (normal) — **não** `length`. O modelo terminou "com sucesso"; a corrupção está no **conteúdo**, não no comprimento. O detector de repetição desta story NÃO pega este modo (não há token/n-grama repetido) e o gatilho de ativação abaixo (`finishReason=length`) também não o vê.

**Não é o nosso pipeline.** Descartado por leitura de código: o transporte é lossless — `res.write('0:'+JSON.stringify(delta))` (`ai.controller.ts`) preserva os bytes exatos e o cliente concatena; os saneadores (`packages/shared/src/narration.ts`) só colapsam runs de espaço (`[ \t]{2,}`→`1`), nunca removem espaço único entre palavras nem inserem espaço antes de pontuação. A corrupção nasce no output do modelo/provider.

**Diagnóstico (logs do Render, 2026-07-24 ~16:35, service `srv-d9f50kjrjlhs73dimceg`):** ~18 turnos na mesma janela, **config idêntica** (`frequencyPenalty:0.3` + `effort:high` + deepseek-v4-flash). Só **um** embaralhou; vários mais longos (completion 1364, 1175 tokens) saíram limpos. Config idêntica em 17 turnos limpos ⇒ a config **não é gatilho suficiente**. O que variou naquela chamada foi o backend que o OpenRouter roteou ⇒ **hipótese principal: corrupção de tokenização transitória no upstream do OpenRouter** (backend quantizado/mal-configurado roteado só naquele request). Implicação para esta story: como a causa provável é roteamento transitório, o próprio **descarte+retry** (re-roteia) tende a resolver este modo — mais uma razão para a rede determinística cobrir também whitespace, não só repetição.

**Hipótese secundária (não descartada): `frequencyPenalty` × raciocínio longo.** `frequency_penalty` penaliza ∝ **contagem** do token; whitespace é o token de MAIOR contagem. Com `effort:high`, o raciocínio oculto (excluído do retorno via `reasoning.exclude`, mas gerado e contado) acumula contagem de espaço **antes** da prosa → a penalidade pode suprimir espaços na narração visível, produzindo exatamente este padrão. Não dá para medir o tamanho do raciocínio oculto pelos logs atuais (o `completionTokens` provavelmente não o inclui), então este vetor fica **aberto** até instrumentar `providerMetadata` (ver Questões em aberto #4).

**Correção a uma premissa desta story:** o `frequencyPenalty` **não** é "custo ~zero, sem falso-positivo" como afirmado em Custo/Fora do escopo abaixo. Ele tem efeito colateral real: sob geração longa (raciocínio + prosa) pode **desmanchar o whitespace**. Consequência direta — a tática de retry "subir o `frequencyPenalty`" (Fora do escopo / Questão #3) pode **piorar** o embaralhamento. Se for preciso endurecer o anti-loop, `presencePenalty` (penalidade **fixa**, não ∝ contagem) não crush o whitespace ao longo do comprimento — melhor candidato que subir o frequency.

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

- **Instrumentar `providerMetadata` no `onFinish` (PASSO 0 — fazer primeiro).** Logar SEMPRE (hoje só atrás da flag `DM_CACHE_SPIKE`) o provider upstream que o OpenRouter roteou + a contagem nativa de tokens de raciocínio. Na próxima ocorrência do 2º modo (embaralhamento), isso desambigua **backend ruim** (hipótese principal) de **`frequencyPenalty` × raciocínio longo** (secundária) — sem esse dado o diagnóstico fica no chute. ~1 linha, custo ~zero, e é **pré-requisito de qualquer mexida em sampling** (baixar/trocar `frequencyPenalty` às cegas pode reabrir o loop à toa). Detalhe em Questão em aberto #4.
- **Detector de degeneração** rodando no laço de streaming (`ai.controller.ts`), sobre o texto acumulado do step (`curStepText`), por delta:
  - **Token/sílaba única:** mesmo curto token repetido ≥ N vezes seguidas (ex.: N=8).
  - **N-grama:** mesmo bigrama/trigrama repetido ≥ M vezes numa janela deslizante (ex.: M=5).
  - **Embaralhamento de whitespace (2º modo, 2026-07-24) — candidato, não commitado:** anomalia de espaçamento sem repetição (espaço antes de pontuação, palavras fundidas anormalmente longas). Sinal DISTINTO dos dois acima e mais difícil de calibrar (prosa legítima tem pontuação e palavras longas). Como termina em `finishReason=stop`, SÓ um detector mid-stream o pega. Avaliar um sinal barato (ex.: fração de tokens sem espaço interno acima de um comprimento, ou densidade de `\s` abaixo do esperado) — mas só entrar se **reincidir**; a causa provável (roteamento transitório do OpenRouter) pode não voltar.
  - Limiares configuráveis por constante (não mágicos espalhados).
- **Descarte do parcial + retry no MESMO modelo:** ao disparar, emitir um sentinel de **descarte** para o cliente limpar o que já mostrou naquele turno, e **refazer o turno no mesmo modelo** (re-amostra o primário) — não descer a escada de imediato. Racional: loop e embaralhamento são falhas de **amostragem**, não do modelo estar quebrado; re-rolar resolve, e via OpenRouter a nova chamada pode reroteiar para outro backend (cobre a corrupção transitória do 2º modo). Descer para o próximo modelo da escada (`attempt++`) fica só como **escalonamento** se o mesmo modelo degenerar repetidas vezes.
- **Mensagem de erro limpa como último recurso:** se todas as tentativas degenerarem/falharem, mostrar algo como `[O Mestre se perdeu nas palavras. Tenta de novo.]` em vez da parede. Reusar/estender a mensagem de erro que já existe no controller (linha ~147).
- **Cooperação do cliente (`apps/web`):** o frontend precisa honrar o sentinel de descarte — apagar o buffer de texto parcial do turno antes de renderizar a reescrita. Há precedente: o sentinel `R\n` já reseta texto de step (US-29/US-38); esta US estende para um descarte de turno inteiro.
- **Corte defensivo do `maxTokens`:** avaliar baixar o teto ou abortar mais cedo — hoje 4000 comporta o raciocínio oculto do deepseek; um loop enche isso todo antes de o guard por contagem sequer precisar agir. O guard por repetição é o gatilho primário; o `maxTokens` é só a barreira final.

### Fora do escopo

- **Trocar o modelo primário / mexer em sampling além do já feito.** `frequencyPenalty` fica; somar `presencePenalty` é ajuste de config, não precisa desta story (fazer inline se ajudar). ⚠️ **Atualização 2026-07-24:** **não** subir o `frequencyPenalty` (ex.: para `0.5`) — ele penaliza ∝ contagem e o token mais contado é o espaço, então subir agrava o embaralhamento de whitespace (2º modo). Para endurecer o anti-loop use `presencePenalty` (penalidade fixa, não escala com o comprimento). Considerar até **baixar** o `frequencyPenalty` (0.3→~0.1) se o embaralhamento reincidir com `providerMetadata` apontando a hipótese secundária.
- **Buffer-and-gate (bufferizar o turno inteiro antes de mostrar).** Garantiria zero parede trivialmente, mas MATA o streaming/TTFT — e a app inteira é construída em torno do stream (US-55 caching, proxy SSE da US-60). Rejeitado; ver Questão em aberto #1.
- **Eliminar a degeneração na origem.** É comportamento emergente da decodificação autorregressiva em OOD; não se "conserta" o modelo, só se contém o sintoma.
- **Guard nas chamadas de `summarizeOldTurns` / `generateOpeningNarration`.** Menor risco (não é streaming ao vivo para o jogador); só entra se também reincidir lá.

---

## Critérios de aceite

- [x] Existe um detector de repetição no laço de streaming do `ai.controller.ts` que dispara para (a) token único repetido ≥ N e (b) n-grama repetido ≥ M, com limiares em constantes nomeadas.
- [x] Ao disparar, o turno é **descartado e reescrito no mesmo modelo** (re-amostragem do primário, não streamado até o fim). Só desce a escada de modelos (`attempt++`) como escalonamento se o mesmo modelo degenerar repetidas vezes.
- [x] O cliente (`apps/web`) honra o sentinel de descarte: o texto parcial degenerado é apagado da tela antes da reescrita — o jogador não fica com "cra cra" preso na UI.
- [x] Se TODAS as tentativas degenerarem/falharem, o jogador vê uma **mensagem de erro limpa**, nunca a parede nem uma narração cortada.
- [x] A escada de retry existente (falha antes do texto) e os saneadores (US-29 rolagens, vazamento de raciocínio, tags de estado) continuam funcionando — o guard SOMA, não substitui.
- [x] **Regressão:** um stream sintético que emite "cra " 30× seguidas é detectado e NÃO chega inteiro ao cliente; um stream normal (narração legítima com uma palavra repetida 2-3× por ênfase) NÃO dispara falso-positivo.

---

## Notas de implementação

> *Dicas para quem implementar. O implementador pode divergir com boa justificativa.*

- **Onde detectar:** o laço `for await (const part of result.fullStream)` no `ai.controller.ts` (~linha 103), no ramo `text-delta` (~134-141). `curStepText` já acumula o texto do step — rodar o detector sobre ele a cada delta é barato (checar só a cauda, janela deslizante, não o texto todo).
- **Tensão central — streaming é append-only no cliente.** Uma vez enviado `res.write('0:'+delta)`, o token está na tela. "NUNCA ver a parede" só é possível se o detector disparar **cedo** (poucas repetições) E o cliente souber **descartar** o parcial. Portanto: manter o limiar N baixo o bastante para cortar antes de virar parede, mas alto o bastante para não matar ênfase legítima. Calibrar com saídas reais.
- **Reaproveitar o sentinel de reset:** o `R\n` (controller ~136) já instrui o cliente a descartar texto de step. Estender esse mecanismo (ou criar um irmão, ex.: `X\n` = descarte de turno) evita inventar protocolo novo. Exige tocar no parser SSE do `apps/web`.
- **Retry sem duplicar estado:** a escada já dedupe blocos de rolagem entre tentativas (`emittedRolls`, controller ~89/129) e só persiste `ACTION`/`NARRATION` quando `finalText.length > 0` (ai.service ~608). O retry por degeneração precisa entrar nessa mesma disciplina — não gravar o turno degenerado, não re-emitir a rolagem.
- **`frequencyPenalty` fica — mas com ressalva (2026-07-24):** é a primeira linha (probabilística) contra o loop; este guard é a segunda (determinística). As duas juntas. Porém ele NÃO é neutro: por penalizar ∝ contagem, pressiona o token de espaço e pode embaralhar whitespace sob geração longa (2º modo observado). Não o suba para reforçar o anti-loop — prefira `presencePenalty`.
- **Detector puro e testável:** extrair a lógica de detecção como função pura (`detectDegeneration(text): boolean`) para o teste de regressão exercê-la sem stream real — mesmo padrão de `resolveKnownSpell`/saneadores.

---

## Custo da solução

Defesa em camadas por **custo crescente**: sampling penalty (grátis) → este guard+retry (médio) → buffer-and-gate (caro, mata streaming). Sobe de camada só quando a de baixo falha — por isso esta story fica em backlog atrás do `frequencyPenalty`.

Princípio-chave: **o turno saudável não paga nada.** O detector roda sempre, mas é ~zero; o custo pesado (retry) só ocorre no caminho de exceção (loop real OU falso-positivo).

| Eixo                   | Custo                                                                                                                                                                                                                                                   | Quando                   |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| **Implementação**      | Médio, cross-cutting em 2 apps (`apps/api` detector+retry no caminho crítico de todo turno; `apps/web` parser SSE honrando o sentinel de descarte; protocolo coordenado entre os dois). Não é 1 arquivo.                                                | Uma vez, na entrega      |
| **Runtime — detector** | ~Zero. Checa só a cauda do texto (janela deslizante) por delta, não o texto todo. Micro-CPU.                                                                                                                                                            | **Todo** turno           |
| **Runtime — retry**    | Alto pontual: reescrever o turno = 2ª chamada de LLM completa (input + raciocínio + saída de novo). Custo esperado ≈ (taxa de loop + taxa de falso-positivo) × custo do turno.                                                                          | **Só** quando dispara    |
| **UX — latência**      | Jogador espera ~2× o tempo naquele turno (stream descartado + reescrita). Aceitável vs ver a parede.                                                                                                                                                    | Só no disparo            |
| **UX — lampejo**       | Limiar N baixo pode deixar passar 2-3 repetições antes do corte. Não é parede, mas não é zero.                                                                                                                                                          | Só no disparo            |
| **Falso-positivo**     | O custo escondido e mais perigoso: limiar mal calibrado corta ênfase legítima ("não, não, não!", "corre, corre, CORRE") como se fosse loop → descarta narração boa + retry à toa (latência + $ + narração pior). Calibração é o trabalho fino da story. | Sempre que o limiar erra |
| **Manutenção**         | Baixo, não nulo: protocolo de sentinel novo entre API e web é mais uma coisa que pode quebrar num refactor do stream.                                                                                                                                   | Contínuo                 |

**Comparação com a mitigação já em prod:** `frequencyPenalty: 0.3` custa ~zero em CPU/infra — um número na config, sem retry, sem cliente. É por isso que ele é a 1ª linha e este guard só se paga se o barato não segurar. **Ressalva (2026-07-24):** "sem falso-positivo" era premissa otimista — ele tem um custo de QUALIDADE escondido: penalizando ∝ contagem, pode desmanchar o whitespace sob geração longa (ver 2º modo). Barato em infra, não neutro em saída.

---

## Questões em aberto

1. **Early-abort+descarte vs buffer-and-gate — DECIDIDO: early-abort+descarte.** Mantém o streaming (bom TTFT), ao custo de cooperação do cliente (honrar o sentinel de descarte) e de um limiar bem calibrado — o jogador pode ver um lampejo de 2-3 "cra" antes do corte. Buffer-and-gate garantiria zero parede mas mata o streaming (rejeitado em Fora do escopo). Reavaliar só se o lampejo incomodar na prática.
2. **Limiares N (token) e M (n-grama).** Chutes iniciais N=8, M=5. Precisam de calibração contra narração real para não cortar ênfase legítima ("não, não, não!") nem deixar passar loop. Candidato a medir no runner de `evals/`.
3. **Retry no MESMO modelo (DECIDIDO) — como endurecer se re-rolar puro não bastar.** O retry por degeneração é no **mesmo modelo** (re-amostra o primário), não desce a escada de cara — loop/embaralhamento são falhas de amostragem, e via OpenRouter a re-chamada já pode reroteiar backend (cobre o 2º modo transitório). Aberto: se a simples re-amostragem não bastar, endurecer COMO? ⚠️ **Não** subir `frequencyPenalty` (agrava o whitespace, 2º modo) — usar `presencePenalty` (penalidade fixa). Descer para o próximo modelo da escada fica como **escalonamento** após N re-rolls degenerados no mesmo modelo (definir N na calibração).
4. **Instrumentar `providerMetadata` no `onFinish` (pré-requisito para desambiguar o 2º modo).** Hoje o `onFinish` (`ai.service.ts`) só loga `finishReason`+`usage`; o provider upstream do OpenRouter e a contagem nativa de tokens de raciocínio só saem em `providerMetadata`/`response.body`, atrás da flag `DM_CACHE_SPIKE`. Sem isso não dá para saber, na próxima ocorrência, se foi backend ruim (hipótese principal) ou `frequencyPenalty` × raciocínio longo (secundária). Passo barato (~1 linha, logar sempre) que fecha o diagnóstico. Fazer ANTES de mexer em sampling — se for provider, mexer em penalty/effort é esforço perdido e reabre risco de loop à toa.

---

## Referências no código

- `apps/api/src/ai/ai.controller.ts` — laço de streaming SSE (`fullStream`, ~103); ramo `text-delta` (~134) onde o detector entra; escada de retry `attempt++` (~91) que só age antes do texto; mensagem de erro limpa (~147); sentinel `R\n` de reset de step (~136).
- `apps/api/src/ai/ai.service.ts` — `streamText` com `maxTokens: 4000` e `frequencyPenalty: 0.3`; `onFinish` com log `finishReason`+`usage` — sinal de detecção do problema em prod; dump de `providerMetadata`/`response.body` atrás da flag `DM_CACHE_SPIKE` (candidato a virar log permanente, Questão #4); persistência condicional do turno.
- `packages/shared/src/narration.ts` — saneadores (`stripReasoningLeak`/`stripFabricatedRolls`/`stripWorldStateTags`); relevantes ao 2º modo por PROVA NEGATIVA: só colapsam runs de espaço, então NÃO produzem o embaralhamento — confirma que a corrupção é do modelo/provider, não nossa.
- Logs do Render (service `srv-d9f50kjrjlhs73dimceg`, `ai-dm-api`) — fonte do diagnóstico do 2º modo (2026-07-24 ~16:35): `finishReason=stop`, `completionTokens=839`, `attempt=0`, 17 turnos irmãos limpos com config idêntica.
- `packages/ai-engine/src/model.ts` — `narrationModels` (escada) e `NARRATION_PROVIDER_OPTIONS` (~88-112).
- [US-68](./US-68-nomes-de-fantasia-originais.md) — a onomástica que empurra o modelo para OOD (a exposição do bug).
- [US-36](./US-36-eval-de-qualidade-da-narracao.md) — eval de narração; candidato a hospedar a calibração dos limiares e a checagem de regressão.

---

## Gatilho para ativar (backlog condicional)

Ativar quando houver **reincidência em prod**. Dois sinais, não um:

1. **Loop de repetição:** `finishReason=length` recorrente nos logs do `onFinish`, ou relato de parede de repetição pelo jogador.
2. **Embaralhamento de whitespace (2º modo, 2026-07-24):** `finishReason=stop` com prosa corrompida (espaço deslocado, palavras fundidas) — **não** dá `length`, então o sinal #1 NÃO o pega. Detecção via relato do jogador ou inspeção da narração persistida. **Antes de ativar o guard para este modo, instrumentar `providerMetadata`** (Questão #4) para saber se a rede determinística é sequer a resposta certa (se for provider transitório, o retro já cobre; se for `frequencyPenalty`, o fix é config, não este guard).

Enquanto o `frequencyPenalty: 0.3` segurar o loop (sinal #1) sem reincidência, não vale a complexidade — YAGNI. A rede determinística é o próximo passo se a mitigação probabilística falhar. O 2º modo teve **uma** ocorrência (2026-07-24), ambígua entre provider e config — ainda não é reincidência que justifique o guard; é motivo para instrumentar e vigiar.
