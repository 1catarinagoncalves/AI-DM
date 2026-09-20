# US-238 — Eval da aventura gerada, recalibrada

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** [US-232](./US-232-schema-cresce-e-prompt-de-autoria-call-unico.md) (o artefato a avaliar) · [US-239](./US-239-motor-em-createforcharacter-ledger-e-aposenta-gancho.md) (motor no caminho de criação, pro live eval opcional) · [US-154](./US-154-eval-aventura-gerada.md) (eval original — esta story **recalibra**)
**Relacionado:** [US-36](./US-36-eval-de-qualidade-da-narracao.md) (LLM-judge + rubrica) · [ADR 012](../../adr/012-aventura-gerada-como-dado.md) (D7 — âncora de eval) · [Arquitetura — §Âncora de eval](../../arquitetura-motor-aventuras-autorais.md) · [Backlog — MA-8](./backlog-motor-de-geracao-de-aventuras.md)
**Criada em:** 2026-09-13

---

## História

> **Como** desenvolvedora,
> **quero** medir a qualidade da aventura gerada contra exemplares reais e por asserts sobre o artefato, não só pela nota de um juiz que satura —
> **para que** regressão de qualidade seja pega de verdade, e não escondida atrás de um "5/5" automático.

---

## Contexto e motivação

O determinismo byte-a-byte morreu (ADR 012 D1). "Regressão" agora é medir **rubrica sobre amostra** a partir de perfis pinados. Duas descobertas do Spike moldam esta story: (1) o **juiz LLM satura** nesta tarefa (quase tudo 5/5 — inútil pra ranquear), então a nota não pode ser o sinal decisivo; (2) agora existem **exemplares** solo/pt-BR/autorais — a lacuna que o backlog velho lamentava está preenchida: *O Olho de Iremet* (prosa) e *A Cripta do Véu Silencioso* (estrutura das 8 seções). A rubrica ancora em **asserts sobre o artefato**, verificáveis, não na nota do juiz.

---

## Escopo

### Dentro do escopo

- **Exemplares de referência:** *O Olho de Iremet* (prosa/densidade) + *A Cripta do Véu Silencioso* ([evals/exemplars/](../../../evals/exemplars/cripta-do-veu-silencioso.md), estrutura das 8 seções + Challenges/Objective).
- **Asserts sobre o artefato** (o sinal duro, não a nota do juiz): grafo fecha (toda ref por `id` existe); `secretId` marcado oculto continua oculto; NPC referenciado existe; orçamento de cada encontro cabe no nível; exatamente 3 facções com `want` distintos; `objective` com `reward`; ≥N `challenges[]` não-combate; nenhum número de mecânica na prosa (reusa o saneamento da US-234).
- **Rubrica (US-36/154) sobre amostra pinada** como sinal **secundário** — roda, mas a decisão de regressão é dos asserts (juiz satura).
- **Quase-determinismo pra testar pipeline** (não criatividade): `temperature: 0` + versão de modelo pinada sobre os perfis fixos.
- **Live eval opcional** no caminho de criação (mesmo molde do `DM_LIVE_EVAL` da US-36).

### Fora do escopo

- **O juiz como gate** — ele satura; nunca bloqueia persistência (isso é o gate de grafo/orçamento, US-234).
- **Gate de presunção "tábula rasa" automatizado** — hoje é olho (o achado do spike foi visual); um assert robusto pra "nenhum NPC já conhece o personagem" é trabalho futuro, não desta story.
- **A geração em si** (US-232) e o gate (US-234) — esta story mede, não gera nem valida-pra-persistir.

---

## Critérios de aceite

- [x] A suite roda sobre um conjunto **pinado de perfis** e produz asserts sobre o artefato (grafo fecha, `secretId` oculto, NPC existe, orçamento cabe, 3 facções, `objective.reward`, `challenges[]` não-combate, prosa sem número). → 8 asserts em [adventure-eval.ts](../../../apps/api/src/adventure-generation/adventure-eval.ts), 3 perfis em [adventure-eval-profiles.ts](../../../apps/api/src/adventure-generation/adventure-eval-profiles.ts), runner ao vivo em [run-adventure-eval.ts](../../../apps/api/scripts/run-adventure-eval.ts). Três dos itens da lista mudaram de forma — ver *Notas de implementação*.
- [x] Os dois exemplares (*O Olho de Iremet*, *A Cripta do Véu Silencioso*) são as referências da rubrica; a de estrutura vem de `evals/exemplars/`. → a estrutura é cobrada pelo assert `estrutura-8-secoes` (com teste de deriva contra o exemplar) e a seção *Setting* da Cripta é a âncora "nota 5" do juiz. **O Olho de Iremet não está no repo** (só citado em docs), então não é âncora executável — só a Cripta é.
- [x] A nota do juiz é registrada mas **não** é o critério de aprovação/reprovação (documentado que satura). → `adventureEvalPassed` ignora a nota; o relatório a marca "informativo, não decide".
- [x] Quase-determinismo (`temperature: 0` + modelo pinado) disponível pro teste de pipeline, separado da variedade de produção. → `PIPELINE_AUTHORING_SAMPLING` (`model.ts`), flag `--pipeline` do runner; produção nunca passa `sampling`.
- [x] **Regressão:** rodar a suite contra um artefato deliberadamente quebrado (grafo órfão, ou número na prosa) **falha** nos asserts; artefato bom passa. → [adventure-eval.test.ts](../../../apps/api/src/adventure-generation/adventure-eval.test.ts), roda no `pnpm test` (sem chave, sem banco).

---

## Notas de implementação

- Reusar o runner/rubrica da US-36 (`gemini` judge) — mas o peso decisório vai pros asserts, mesma lição do bake-off (juiz que satura não discrimina; US-17).
- Reusar o saneamento da US-234 pra o assert "sem número na prosa" — não escrever um segundo detector.
- Exemplar de estrutura já existe em [evals/exemplars/cripta-do-veu-silencioso.md](../../../evals/exemplars/cripta-do-veu-silencioso.md); *O Olho de Iremet* é o artefato de prosa (referência externa).

**Onde mora e por quê.** Os asserts ficam em `apps/api/src/adventure-generation/`, **não** em `evals/cases/`: o `vitest.eval.config.ts` só aliasa `@ai-dm/ai-engine` e `@ai-dm/shared`, e o orçamento de CR (`lazy-encounter-benchmark.ts`, `monster-roles.ts`), o gate e o `seed-ledger` são de `apps/api`. Reimplementá-los num caso de eval (o que a US-154 teve de fazer com `MONSTER_NPC_IDS`) criaria o segundo detector que a story proíbe. Consequência: a regressão roda no `pnpm test`, não no `pnpm eval`. O runner pago fica em `apps/api/scripts/` (mesmo padrão do `run-authoring.ts`, US-232).

**Como o eval se relaciona com o gate (US-234).** Não é um segundo gate: o gate bloqueia persistência e para no primeiro motivo; o eval mede uma amostra e devolve os 8 veredictos de uma vez. Onde o gate já verifica (grafo, orçamento, stripper), o eval **chama o mesmo código** — `checkAdventureGraph`, `checkEncounterBudget` e `sanitizeProse` passaram a ser exportados.

**Os três itens do AC1 que a leitura literal quebraria** (hipótese da US ≠ fato — checado no código em 20/09/2026):

- **`secretId` oculto.** `secrets[]` saiu do artefato na US-232 (a própria US-234 registra isso), então não há `secretId` a verificar. O invariante equivalente é o que a US-154 protegia: nada semeado do artefato nasce revelado, e o bloco de entidades que o Mestre lê todo turno marca cada linha com `⚠ OCULTO`. Assert `ledger-oculto`: `seedLedgerFromGeneratedAdventure` + `formatEntities`.
- **"Exatamente 3 facções".** A contagem é sorteada em **[2,4]** no Game Server (`rollFactionCount`, `roll-registry.ts`); "exatamente 3" reprovaria 2 de cada 3 gerações certas. O perfil pinado fixa `characterId`/`order`/`attempt`, e o assert `facoes` cobra **a contagem que aquele sorteio devolve** mais `want` distintos (igualdade textual — paráfrase do mesmo desejo passa; o juiz e o olho pegam esse caso). Sem perfil (live eval), cobra só a faixa [2,4].
- **"NPC existe".** Não é assert separado: `encounter.npcIds` e `location.occupants` que não resolvem já reprovam `grafo-fecha` (mesmo `checkAdventureGraph` do gate). "Não-combate" em `desafios-nao-combate` também é estrutural — `challenges[]` é um array distinto de `encounters[]`; o assert cobra a contagem mínima (`AUTHORING_COUNTS.challenges`, agora exportada).

**Achado no caminho — `factionId` órfão nunca foi verificado.** O AC da US-234 ("`npc.factionId` apontando pra id inexistente ⇒ reprova") estava marcado ✅ mas `adventure-gate.ts` não tinha o check. Hoje o órfão não nasce (`resolveFactionId` do `mint-adventure.ts` descarta índice fora da faixa), mas o eval mede "toda referência por `id`", então o check entrou no gate (`checkFactionReferences`, com testes) em vez de existir só no eval.

**`prosa-sem-numero` só mede vazamento no artefato BRUTO.** O gate sanea a prosa e segue, então no artefato já persistido o assert é vazio por construção. O runner roda os asserts **antes** do gate (`generateRestArtifact`); e a fatia 1A já sai saneada de `generateSlice` (US-256), então o vazamento medido é o da 1B (`challenges`/`encounters`/`objective`/`branchedResolution`/`followUps` — os campos que a US-234 chama de "mais propensos a vazar"). A comparação é espaço-normalizada: o stripper também colapsa espaço e quebra de linha, e isso não é número vazado.

**Quase-determinismo.** `AuthoringSampling` (`{ temperature, models }`) entra como parâmetro opcional de `generateAdventureSlice`/`generateAdventureRest`/`generateSlice`/`generateRestArtifact` — nunca lido de env, e produção (create/retry) nunca o passa. `PIPELINE_AUTHORING_SAMPLING` = `temperature: 0` + o snapshot fixo `deepseek-v4-pro-0813`, **sem** escada: se o modelo pinado falhar o run lança em vez de cair em outro modelo (mudaria o que está sendo medido). "Quase" porque o OpenRouter ainda escolhe o endpoint (`AUTHORING_PROVIDER_OPTIONS`) — dois runs não são idênticos byte a byte.

**Live eval no caminho de criação.** `liveEvalAdventure` roda em `generateGatedRest` quando o gate aprova, só com `DM_LIVE_EVAL` ligada e fora de produção, fire-and-forget, nunca lança: loga **uma** linha JSON (`adventure_live_eval`) com os asserts que falharam e a nota do juiz. Aqui o artefato já passou pelo gate, então `prosa-sem-numero` é vazio — a medição de vazamento é do runner.

**Como rodar o suite ao vivo** (custa chamadas reais no OpenRouter + Gemini; off do CI):

```bash
npx dotenv-cli -e .env -- pnpm --filter api exec ts-node scripts/run-adventure-eval.ts --pipeline
```

Sem `--pipeline`: escada e temperatura de produção (variedade real). `--profile <id>` roda um perfil só. Exit 1 se qualquer assert falhar; relatório em `evals/reports/us-238-<data>.md` (gitignored).

**O caso `evals/cases/us-154-eval-aventura-gerada.ts` continua verde mas descreve o artefato antigo** (`secrets[]`, `antagonist`, `conclusion`). Ele passa porque o vitest não tipa o fixture; a cobertura viva do "não vaza segredo" é o `ledger-oculto` desta story. Reescrever/aposentar o caso da US-154 não foi feito aqui.

---

## Questões em aberto

1. **Automatizar o assert de tábula rasa?** Hoje a presunção de passado (NPC que já conhece o personagem, dívida pré-jogo) é pega a olho. Um assert confiável exigiria detectar referência a `bonds`/`story` na saída — trabalho futuro; registrado.

---

## Referências no código

- [adventure-eval.ts](../../../apps/api/src/adventure-generation/adventure-eval.ts) — os 8 asserts, puros, + relatório.
- [adventure-eval-profiles.ts](../../../apps/api/src/adventure-generation/adventure-eval-profiles.ts) — perfis pinados.
- [adventure-eval-live.ts](../../../apps/api/src/adventure-generation/adventure-eval-live.ts) — juiz (informativo) + hook `DM_LIVE_EVAL`.
- [run-adventure-eval.ts](../../../apps/api/scripts/run-adventure-eval.ts) — runner ao vivo.
- [US-154](./US-154-eval-aventura-gerada.md) — eval original que esta recalibra.
- [US-36](./US-36-eval-de-qualidade-da-narracao.md) — LLM-judge + rubrica, runner a reusar.
- [evals/exemplars/cripta-do-veu-silencioso.md](../../../evals/exemplars/cripta-do-veu-silencioso.md) — exemplar de estrutura.
- [Backlog — MA-8](./backlog-motor-de-geracao-de-aventuras.md).
