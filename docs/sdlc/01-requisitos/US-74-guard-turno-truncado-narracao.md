# US-74 — Guard de turno truncado (a narração NUNCA termina sem opções)

**Épico:** 2 — Aventura
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** [US-34](./US-34-qualidade-da-narracao-do-dm.md) (ofício narrativo — o contrato "fecha nas opções"), [US-69](./US-69-guard-anti-degeneracao-narracao.md) (guard irmão anti-degeneração — mesma maquinaria de descarte+re-amostra).
**Criada em:** 2026-07-24
**Atualizada em:** 2026-07-25 — incidente de produção: o descarte+re-amostra fazia a narração SUMIR (timeout do proxy) e dessincronizava o mundo (tools já commitadas). Redesenhado para SALVAMENTO. Ver "Atualização 2026-07-25".

---

## ⚠️ Atualização 2026-07-25 — incidente de produção e redesenho para SALVAMENTO

### O que quebrou em prod

Com o guard já live (deploy `9f75d4f`), um turno truncou e, em vez de reescrever, **a narração sumiu**; ao reenviar a ação, **o NPC respondeu de forma incoerente**. Duas causas-raiz, ambas na estratégia original de **descarte + re-amostra**:

1. **"Sumiu" — timeout do proxy.** O guard mandava `X` (cliente limpa a bolha) e **re-amostrava o turno INTEIRO** (mesmo modelo até 2× + escada), tudo dentro da MESMA resposta SSE. Cada chamada deepseek com `effort:high` leva 20–40s; 2–3 seriais estouram o teto de **60s** do proxy Vercel Hobby (`apps/web/src/app/api/chat/route.ts`, `maxDuration=60`). O proxy é morto no meio → o cliente fica com a bolha vazia (último sentinel foi `X`) → nada persiste no servidor → o turno some. A reconciliação `getTurns` confirma o sumiço.
2. **"NPC incoerente" — efeitos colaterais vazam.** Toda tool (`updateScene`/`recordEntity`/`updateInventory`/`updateCharacterHp`) escreve no banco na hora do `execute`, DURANTE a tentativa, antes do guard decidir descartar. Turno descartado/perdido = cena e entidades **já avançaram** sem ACTION/NARRATION persistida → no reenvio o DM lê um mundo adiantado sem narrativa correspondente. Bônus: `updateInventory` (delta) aplica em dobro a cada re-amostra.

Lição: **descartar um turno que já rodou tools é destrutivo** — a narração é reversível (só stream), o mundo não é (tool já commitou). A re-amostra dentro de um SSE com teto de tempo é incompatível com `effort:high`.

### O redesenho — salvar, não descartar

A degeneração (US-69, loop "cra cra…") **continua** com descarte+re-amostra: ali o texto é lixo e é detectado cedo, mid-stream, com parcial pequeno. Só o caminho do **turno truncado** mudou:

- **NÃO descarta e NÃO re-roda o turno.** A narração truncada é BOA — só falta o fecho. Mantém-se na tela.
- **`AiService.completeTruncatedTurn`**: UMA chamada CURTA, SEM tools, `effort:low` (latência), `maxTokens: 700`, que continua a prosa de onde parou e fecha nas opções. As opções ancoram-se no próprio texto da narração (que já descreveu a cena) — não recarrega ficha/cena do banco. Cabe folgado no orçamento de 60s.
- **Persistência única**: `completeTruncatedTurn` grava ACTION + NARRATION(narração + fecho) e sumariza. O `onFinish` da tentativa truncada continua gateado por `turnGuard.incomplete` (não grava). Como o turno é SALVO (não descartado), os efeitos das tools batem com a narração persistida — **fim do desync**.
- **Nunca sem saída**: se a geração do fecho falhar ou vier sem opções, anexa um fecho estático (`- 💬 Continuar.`).
- **Latch `turnHadOptions` reseta no `R`**: um step com opções descartado pelo `R` não pode marcar o turno como completo (senão um desfecho truncado após `R` se perderia).

### Pendente (fora do escopo desta atualização)

- **US-69 tem o MESMO defeito latente**: descarte+re-amostra serial (timeout) + efeitos colaterais de tentativas descartadas. Menos crítico (degeneração é rara e o parcial é pequeno), mas o vazamento de tools de uma tentativa descartada existe lá também. Endereçar se reincidir.

---

## História

> **Como** jogador,
> **quero** que o AI DM NUNCA termine um turno num cliffhanger sem opções — que sempre revele o desfecho do que armou e me apresente ações,
> **para que** eu nunca fique preso numa narração meio-feita ("Você abre a primeira." → fim), sem carta revelada e sem nada para escolher.

---

## Contexto e motivação

### O problema observado

Em produção, a última mensagem do Mestre terminou assim:

> *"Você desata o cordão. São cinco cartas, numeradas na borda superior — da primeira à quinta. […] Você abre a primeira."*

E parou. **Sem** o conteúdo da carta e **sem** a lista de opções (`- 🗡️ …`). O contrato do prompt (regra §4 de formatação + "Close on a LIVING hook: … then present the action options") exige que TODA narração completa termine com as opções. Aqui não terminou — o jogador ficou sem saída.

### Diagnóstico (verificado nos logs do Render, não hipótese)

Puxados os logs do serviço `srv-d9f50kjrjlhs73dimceg` (`ai-dm-api`), filtro `text=["finishReason"]`, janela de 7 dias:

- **100% dos `onFinish` = `finishReason=stop`.** Zero `length`, zero `tool-calls`, zero `error`.
- `completionTokens` observados ~800–1700 — muito abaixo do teto `maxTokens: 4000`.
- `steps` sempre 1–3 — muito abaixo do teto `maxSteps: 5`.

**Conclusão dura pelos dados:** o corte NÃO é teto de token (`length`) nem teto de step (`tool-calls`). Essas duas hipóteses ficaram descartadas por medição. É `stop`: o modelo decide **terminar o turno de propósito**, num beat dramático, sem emitir as opções.

**Por que acontece (causa provável):** o modelo de narração (DeepSeek V4 Flash, modelo de raciocínio, `effort:high`) trata "abrir a carta" como fronteira de turno — acha que revelar o conteúdo é o próximo turno. Reforçado pelo próprio prompt: o bloco **TURN RESOLUTION ORDER** martelava *"STOP. Your turn is over. … produce NOTHING further"* três vezes, de forma **incondicional**, enquanto a exigência de fechar nas opções ficava enterrada na §4 de formatação. O modelo sobre-aplica o STOP e para ANTES das opções, não depois.

### Por que a solução atual não bastava

- **O prompt sozinho é probabilístico.** Mesmo com a regra das opções, o modelo às vezes escolhe o cliffhanger — igual ao raciocínio da US-69, "penalidade de sampling não é garantia".
- **A escada de retry** (`narrationModels` + `attempt++`) no `ai.controller.ts` só dispara quando o modelo falha **ANTES** de emitir texto (`!emittedAnyText`). Aqui o texto saiu inteiro (só faltaram as opções) — a escada nunca via.
- **O guard da US-69** (`detectDegeneration`) pega loop de **repetição**. Este turno não tem repetição nenhuma — é geração encerrada cedo. O detector de degeneração não vê e não dispara.

Faltava uma rede **determinística** que reconhecesse "turno sem opções = truncado" e re-amostrasse — exatamente o padrão da US-69, mas para outro sintoma.

---

## Escopo

### Dentro do escopo

- **Predicado puro `hasOptionsList(text)`** em `packages/shared/src/narration.ts` (regex `/(^|\n)\s*-\s/`): detecta a presença da lista de opções. Ausência = turno truncado. É a MESMA regex que o controller e o serviço já usavam **inline** para o dedupe de narração dupla (`COMPLETE_NARRATION`) — agora **fonte única**, testável (mesmo padrão dos saneadores).
- **Gate de PERSISTÊNCIA no `onFinish`** (`ai.service.ts`): se o `finalText` saneado não tem lista de opções, NÃO grava `ACTION`/`NARRATION` nem sumariza em cima — sinaliza `turnGuard.incomplete = true`. Mesmo mecanismo de gate do turno degenerado (US-69).
- **Detecção + re-amostra no controller** (`ai.controller.ts`): latch `turnHadOptions` no laço de streaming (as opções podem vir num step de desfecho depois de um step de preparação); ao fim do turno, se emitiu prosa mas nunca as opções → descarta o parcial (sentinel `X`) e re-amostra o MESMO modelo. Escalona pela escada (`modelIndex++`) só após `MAX_SAME_MODEL_REROLLS`. Fundido no MESMO bloco do guard de degeneração (`degenerated || incomplete`) — reusa toda a disciplina (dedupe de rolagem, reset de emissão, mensagem de erro limpa como último recurso).
- **Prompt endurecido** (`packages/ai-engine/src/prompts/dm-system.ts`, bloco TURN RESOLUTION ORDER): o STOP passa a ser **condicional** — só vale DEPOIS das opções escritas. Regra dura nova: *"NEVER end your turn before the options list … NEVER stop on a cliffhanger and defer the payoff."* Editado **FORA** do `NARRATIVE_CRAFT_SECTION` → não mexe no `REVIEWED_CRAFT_HASH` (drift guard da US-36 não é afetado).

### Decisão de arquitetura — sem corrida onFinish×loop

Controller e serviço **computam o mesmo predicado independentemente** (`hasOptionsList`) sobre o mesmo turno, cada um decidindo sozinho:
- o **serviço** é a autoridade de **persistência** (não grava beco-sem-saída);
- o **controller** é a autoridade de **re-amostra** (descarta e refaz).

A ordem em que o `onFinish` (SDK) e o fim do laço `for await` do controller executam NÃO é garantida. Como ambos aplicam a mesma regra ao mesmo texto, o veredito é consistente sem lock nem `await` cruzado. Reforço: o controller marca `turnGuard.incomplete` também, e o `onFinish` honra a flag pré-setada além de computar a própria — quem decidir primeiro basta.

### Fora do escopo

- **Continuar a geração de onde parou** (em vez de descartar+refazer). Mais complexo com o SDK (retomar mid-turn); o descarte+re-amostra já reusa a maquinaria da US-69. Rejeitado por custo/benefício.
- **Mexer em `maxTokens`/`maxSteps`.** Os dados provam que os tetos estão folgados — não são a causa. Não tocar.
- **Guard nas chamadas de `summarizeOldTurns`/`generateOpeningNarration`.** A abertura já restringe a saída a prosa+opções sem tools; menor risco. Só entra se reincidir lá.

---

## Critérios de aceite

- [x] Existe um predicado puro `hasOptionsList(text)` em `@ai-dm/shared`, testado, e ele substitui as duas cópias inline de `COMPLETE_NARRATION` (controller + serviço) — fonte única.
- [x] O `onFinish` (`ai.service.ts`) NÃO persiste nem sumariza um turno cuja narração final não tem lista de opções; marca `turnGuard.incomplete`.
- [x] O controller detecta o turno truncado (prosa emitida, opções nunca), descarta o parcial no cliente (`X`) e re-amostra o MESMO modelo; escalona pela escada só após esgotar os re-rolls.
- [x] Se TODAS as tentativas truncarem, o jogador vê a mensagem de erro limpa (`[O Mestre se perdeu nas palavras. Tenta de novo.]`), nunca o beco-sem-saída.
- [x] O prompt condiciona o STOP à emissão das opções e proíbe o cliffhanger sem opções — editado fora do `NARRATIVE_CRAFT_SECTION` (drift guard intacto).
- [x] Guard de degeneração (US-69), escada de retry e saneadores continuam funcionando — este guard SOMA, não substitui.
- [x] **Regressão:** um stream sintético que emite prosa sem opções é descartado (`X`) e reescrito completo no mesmo modelo; um turno que termina COM opções NÃO dispara falso-positivo; travessão de diálogo (`—`) NÃO conta como opção.

---

## Notas de implementação

- **Latch, não checar só o último step.** As opções podem chegar num step de desfecho depois de um step de preparação (o modelo prepara, rola um dado, narra o resultado com as opções). Por isso `turnHadOptions` latcha assim que QUALQUER step exibe a lista — checar só o `curStepText` final daria falso-positivo no caso preparação+desfecho.
- **Só dispara com prosa emitida.** `incomplete = !degenerated && emittedAnyText && !turnHadOptions`. Turno que falhou antes de emitir texto cai na escada de fallback existente, não neste guard. Mensagens de erro que o próprio controller escreve não têm opções mas também não passam por aqui (o caminho de erro já dá `break`).
- **Travessão ≠ bullet.** A regex casa hífen+espaço no início de linha (`- `), não o travessão (`—`) do diálogo. Um turno só-diálogo ("— Volveu cedo — diz Marta.") sem opções é corretamente detectado como truncado.
- **Predicado puro e testável:** `hasOptionsList` extraído como função pura, exercida pelo teste de regressão sem stream real — mesmo padrão de `detectDegeneration`/saneadores.

---

## Referências no código

- `packages/shared/src/narration.ts` — `hasOptionsList()` (predicado de fecho) + teste em `narration.test.ts`.
- `apps/api/src/ai/ai.service.ts` — `turnGuard.incomplete`; gate de persistência no `onFinish` (`hasOptionsList(finalText)`).
- `apps/api/src/ai/ai.controller.ts` — latch `turnHadOptions` no ramo `text-delta`; bloco `degenerated || incomplete` (descarte `X` + re-amostra); dedupe de `COMPLETE_NARRATION` para `hasOptionsList`. Teste em `ai.controller.test.ts`.
- `packages/ai-engine/src/prompts/dm-system.ts` — bloco TURN RESOLUTION ORDER com o STOP condicionado às opções.
- Logs do Render (serviço `srv-d9f50kjrjlhs73dimceg`, `ai-dm-api`) — fonte do diagnóstico: 100% `finishReason=stop`, tokens/steps folgados.
- [US-69](./US-69-guard-anti-degeneracao-narracao.md) — guard irmão; maquinaria de descarte+re-amostra reusada.
- [US-36](./US-36-eval-de-qualidade-da-narracao.md) — eval de narração (juiz externo); candidato a hospedar checagem de regressão de fecho.

---

## Verificação da entrega

- `@ai-dm/shared`: testes de `narration.test.ts` verdes (inclui os novos de `hasOptionsList`).
- `api`: `ai.controller.test.ts` verde (novos casos do guard US-74 + fixtures ajustados para turnos completos).
- `@ai-dm/ai-engine`: suíte verde, **incluindo `rubric-drift.test.ts`** (confirma que a edição do prompt ficou fora do `NARRATIVE_CRAFT_SECTION`).
- `pnpm typecheck` limpo; `dist` de `shared` e `ai-engine` reconstruídos.
- `pnpm eval` **não** rodado nesta entrega — precisa de `GEMINI_API_KEY` (juiz) + chaves NVIDIA/GROQ do `.env` da raiz, negado ao Claude Code. Rodar manualmente antes do deploy.
