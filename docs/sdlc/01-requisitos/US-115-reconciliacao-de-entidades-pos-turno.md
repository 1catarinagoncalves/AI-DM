# US-115 — O ledger recolhe a entidade que o Mestre esqueceu de registrar

**Épico:** 3 — Narração e mecânica
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** [US-75](./US-75-dimensao-de-proveniencia-no-ledger.md) (o ledger, os eixos `sabido`/`revelado`, `mergeEntities` e a semeadura da abertura — esta story é a continuação que aquela deixou fora por escrito)
**Relacionada a:** [US-73](./US-73-reconciliador-de-cena-em-background.md) (**o molde exato**: mesma arquitetura de extração pós-turno em background, aplicada à cena; esta aplica ao ledger) · [US-114](./US-114-modelo-utilitario-para-extracao-e-fecho.md) (o modelo barato que esta extração deveria usar) · [US-113](./US-113-vinculos-ancorados-na-fonte-no-ledger.md) (vínculos ficam **fora** desta rede — ver *Fora do escopo*)
**Criada em:** 2026-08-07

---

## História

> **Como** jogador,
> **quero** que o Mestre não esqueça um NPC ou um lugar que ele próprio acabou de apresentar,
> **para que** a taverneira que me atendeu no turno 8 ainda exista no turno 40, mesmo que o Mestre não a tenha anotado quando a criou.

---

## Contexto e motivação

### O problema observado

A [US-75](./US-75-dimensao-de-proveniencia-no-ledger.md) deixou isto fora do escopo, com nome e tudo:

> *"**Reconciliar entidades pós-turno** (uma US-73 para o ledger, extraindo entidades novas da narração automaticamente). Esta US semeia na GÊNESE e adiciona as dimensões; a semeadura contínua turno-a-turno é trabalho à parte."*

O trabalho à parte é este. Nada entre a US-76 e a US-114 o cobriu.

Hoje uma entidade só entra no ledger por dois caminhos: a **semeadura da abertura** (`extractOpeningEntities`, [`ai.service.ts:1020`](../../../apps/api/src/ai/ai.service.ts), roda uma vez por aventura) e a **tool `recordEntity`** (`ai.service.ts:565`), que depende inteiramente da disciplina do modelo. Entidade apresentada no turno 8 e não registrada fica **fora do ledger para sempre**: o `EventLog` daquele turno é comprimido pela sumarização, e a prosa que a apresentou vira resumo lossy.

É exatamente a amnésia que criou o ledger — *"a Vigia na sala secreta"* apagada do resumo, o comentário em [`schema.prisma:73-77`](../../../apps/api/prisma/schema.prisma). O ledger resolve o problema **para as entidades que estão nele**. Para as que o Mestre não registrou, a promessa que o prompt faz ao modelo — *"This ledger is your PERMANENT memory"* ([`dm-system.ts:367`](../../../packages/ai-engine/src/prompts/dm-system.ts)) — simplesmente não vale, e falha em silêncio.

### Por que a solução atual não basta

**A instrução é que está falhando, e reforçá-la é o que já se tentou.** O `dm-system.ts:367` manda registrar *"whenever you INTRODUCE or CHANGE a person, place, object or faction"*, e a `description` da própria tool repete a ordem todo turno. Não há linha a acrescentar.

O precedente medido é do vizinho: `updateScene` foi ignorada em **9 de 24 viagens** ([US-71](./US-71-simplificar-localizacao-do-personagem.md)) apesar de instrução equivalente — e foi essa medição que justificou a US-73 construir a rede em vez de escrever mais prompt. Aqui a mesma disciplina é pedida à mesma família de modelo, na mesma posição do turno.

**Ressalva honesta: a taxa de omissão do `recordEntity` NÃO foi medida.** É analogia com o `updateScene`, não dado. Por isso o §*Escopo* entrega em duas fases e a fase A é a medição.

E a rede que existe não cobre isto: `reconcileScene` (`ai.service.ts:1047`) reconstrói **a cena** — `local`, `presentes`, `objetos_em_cena`. `presentes` é lista de nomes do agora, que o próprio schema do `updateScene` manda **não** usar para estado durável (`ai.service.ts:521`: *"an NPC's durable condition/status belongs in the entity ledger via `recordEntity`, not here"*). A cena esquece; o ledger é que devia lembrar.

### A proposta

A rede da US-73, aplicada ao ledger, com **duas diferenças que a US-73 não precisou ter**:

1. **Um portão determinístico antes do LLM.** Turno sem `updateScene` é sinal forte: a cena existe sempre, então não a tocar é suspeito. Turno sem `recordEntity` é sinal **fraco** — a maioria dos turnos legitimamente não apresenta entidade durável nenhuma. Copiar o gatilho da US-73 aqui pagaria extração em quase todo turno. Então o gatilho é um detector puro, custo zero, que só acusa quando a narração traz **nome próprio que não está no ledger**.

2. **A rede só INSERE; nunca promove nem altera.** Um extrator lendo a narração assumiria que tudo que apareceu foi revelado ao jogador — e ao fazer merge numa entidade existente promoveria `revelado: false → true`, **queimando o reveal** que o Mestre pinou de propósito (Erro 3 da US-75). Reveal é decisão de ficção; extrator não tem como sabê-la. Insert-only, sem exceção.

---

## Escopo

Entrega em **duas fases**, e a fase A é o que decide se a fase B se constrói.

### Fase A — medir (dentro do escopo, custo zero)

- **Detector `detectUnledgeredName(narration, ledger, playerName)`** em [`guardrails.ts`](../../../packages/ai-engine/src/guardrails.ts), no molde dos detectores que já vivem ali: função **pura**, sem API, sem custo, testada no `pnpm test` normal. Acusa nome próprio na narração que não casa com nenhuma entidade do ledger (match com a mesma tolerância a acento/caixa do `mergeEntities`), nem com o nome da personagem-jogadora.
- **Log de observabilidade no `onFinish`**, no molde exato do `detectSlopName` (`ai.service.ts:792`): detecta, **loga, e não age**. Dá a taxa real de omissão em turnos jogados, que é o número que falta.

### Fase B — agir (dentro do escopo, condicionada)

- **`reconcileEntities(adventureId, narration, sceneState)`** em `ai.service.ts`, irmão de `reconcileScene`: `generateObject` com o schema de `WorldEntity[]`, `EXTRACTION_PROVIDER_OPTIONS`, no `extractionModel` da [US-114](./US-114-modelo-utilitario-para-extracao-e-fecho.md) (ou no modelo grande, se a US-114 não tiver entrado).
- **Disparo:** no `onFinish`, **depois** da persistência do turno, fire-and-forget, e **só quando** (a) o modelo não chamou `recordEntity` neste turno **e** (b) o detector da fase A acusou. Nunca lança — o turno já foi entregue.
- **Também no caminho de salvamento.** `completeTruncatedTurn` (`ai.service.ts:828`) **não passa pelo `onFinish`** (gateado por `turnGuard.incomplete`, `:774`) — a US-73/74 já teve de corrigir exatamente esse esquecimento para a cena (o comentário em `:865` documenta o bug em produção de 29/07/2026). Não repetir.
- **Insert-only.** Entidade cujo `nome` já existe no ledger é **descartada**, não fundida. `mergeEntities` não pode ser chamado com patch vindo do extrator sobre entidade existente.
- **Proveniência do que é inserido:** `revelado: true` — a narração foi mostrada ao jogador, mesma lógica da semeadura da abertura (US-75: *"a abertura É pública e já vivida"*). `sabido`: aplica o backstop que a US-75 escreveu como opcional — se a cena corrente tem `presentes` vazio (jogador sozinho), `privado`; senão, `publico`.
- **Instrução dura ao extrator,** herdada da US-75 e mais necessária aqui: extraia **só o que esta narração afirma**; não infira dono, identidade, parentesco nem segredo.
- **Não loga `CHARACTER_UPDATE`** — mesma razão do `recordEntity` e do `reconcileScene` (o comentário em `ai.service.ts:608`): o evento marcaria o turno como mutação e o guard da [US-67](./US-67-editar-acao-enviada-ao-dm.md) bloquearia a edição.
- **Não dispara** em turno degenerado ([US-69](./US-69-guard-anti-degeneracao-narracao.md)) nem truncado-não-salvo: aqueles não são persistidos, não há o que reconciliar.

### Fora do escopo

- **Vínculos / arestas da [US-113](./US-113-vinculos-ancorados-na-fonte-no-ledger.md).** A rede insere entidade, nunca relação. A *Questão em aberto* #1 daquela story já alerta que campo estruturado de relação convida o modelo a inventar vínculo; um extrator automático amplificaria isso sem ninguém no circuito.
- **Promover `revelado` ou `sabido`, ou atualizar entidade existente.** É a regra de segurança da proposta, não um recorte de conveniência.
- **Remover entidade do ledger.** O ledger é acumulativo por desenho; entidade que sumiu da ficção muda de `estado`, não de existência — e isso é decisão do Mestre via tool.
- **Extrair da ação do jogador.** Só a narração do Mestre é canon. O que o jogador escreve é intenção, não fato do mundo.
- **Reconciliar o arco de beats** ([US-112](./US-112-arco-de-beats-do-que-muda.md), *Questões em aberto* #3). Mesma família de problema, gatilho e schema diferentes.

---

## Critérios de aceite

**Fase A**

- [ ] `detectUnledgeredName` existe em `guardrails.ts`, é função pura (sem API, sem custo) e roda no `pnpm test` normal, como os detectores vizinhos.
- [ ] Não acusa o nome da personagem-jogadora, nem entidade já no ledger com grafia diferente em acento/caixa (mesma tolerância do `mergeEntities`).
- [ ] Não acusa palavra capitalizada por ser início de frase — o alvo é nome próprio, e em narração PT-BR a maiúscula inicial é ruído dominante (ver *Questões em aberto* #1).
- [ ] O `onFinish` loga a detecção **sem agir**, no molde do `detectSlopName` (`ai.service.ts:792`).
- [ ] **A taxa medida está registrada na story antes de a fase B começar.** Se o Mestre registra quase sempre, a fase B não se constrói e a US fecha na fase A com um achado — que é resultado, não fracasso.

**Fase B**

- [ ] `reconcileEntities` insere no ledger a entidade que a narração apresentou e o Mestre não registrou (teste com o extrator mockado).
- [ ] **Insert-only:** entidade cujo `nome` já existe é descartada. Especificamente, entidade existente com `revelado: false` **continua** `revelado: false` depois de a rede rodar sobre uma narração que a mencione — é o teste de regressão que protege o Erro 3 da US-75.
- [ ] Entidade inserida nasce `revelado: true`; e `sabido: 'privado'` quando a cena corrente tem `presentes` vazio, `'publico'` caso contrário.
- [ ] A rede **não** dispara quando o modelo chamou `recordEntity` no turno, nem quando o detector da fase A não acusou (custo zero no turno disciplinado).
- [ ] A rede dispara no caminho de `completeTruncatedTurn`, que não passa pelo `onFinish` — teste de regressão explícito, porque é o bug que a US-73/74 já cometeu uma vez para a cena.
- [ ] Falha/timeout/quota do extrator **nunca** derruba o turno: engolida com log, o turno já foi entregue.
- [ ] Não cria `EventLog` do tipo `CHARACTER_UPDATE` (regressão do guard da US-67).
- [ ] **Eval / regressão do alvo:** narração que apresenta um NPC nomeado sem o modelo chamar `recordEntity` → depois do turno, o NPC está em `Adventure.entities`; num turno seguinte, o bloco de entidades o mostra e o Mestre não o trata como desconhecido.
- [ ] `pnpm eval` e `pnpm typecheck` passam.

---

## Notas de implementação

> *Dicas. O implementador pode divergir com boa justificativa.*

- **`detectSlopName` não serve de base.** É **lista fechada** de nomes clichê (`guardrails.ts:139-145`), não extrator de nome próprio. O detector novo é vizinho dele no arquivo e no estilo, não derivado dele.
- **O detector é heurística com teto conhecido.** Nome próprio em PT-BR por maiúscula tem falso-positivo garantido (início de frase, topônimo genérico, título). Marcar o teto com comentário `ponytail:` e aceitar falso-positivo: o custo de um falso-positivo é **uma extração desnecessária**, e o de um falso-negativo é **uma entidade perdida para sempre**. Errar para o lado barato.
- **`reconcileScene` é o molde inteiro** (`ai.service.ts:1047`): a estrutura de `try`/`generateObject`/merge/`update`/`logLlmFailure` copia-se quase verbatim; o que muda é o schema, o alvo da persistência (`Adventure.entities` em vez de `characterState.sceneState`) e a regra insert-only.
- **Ler do banco, não do closure.** `recordEntity` já faz isso (`ai.service.ts:596`) para acumular corretamente; a rede roda **depois** do turno, então o closure está garantidamente velho.
- **`EXTRACTION_PROVIDER_OPTIONS` é obrigatório** (`model.ts:282`): `reasoning: { enabled: false }`. Trocar por `exclude`/`effort` derruba a chamada com 400 **em silêncio** — o `catch` devolve e a aventura segue sem ledger novo, sem ninguém notar.
- **`ai-engine` roda de `dist`:** `guardrails.ts` exige `pnpm --filter @ai-dm/ai-engine build` para a API pegar. `ai.service.ts` roda TS direto.

---

## Questões em aberto

1. **O detector consegue ser útil em PT-BR?** Maiúscula inicial de frase domina o texto; sem análise sintática o filtro precisa de heurística de posição (maiúscula no meio da frase) que erra em diálogo e em lista. Se a taxa de falso-positivo for tão alta que a fase B dispare em quase todo turno, o portão não portou nada e a economia da proposta evapora — nesse caso a decisão é entre disparar sempre com o modelo barato da US-114, ou não construir a fase B.
2. **A rede compete com o Mestre?** Se o modelo aprende (via contexto) que entidades aparecem sozinhas no ledger, pode chamar `recordEntity` menos. Não há como o modelo observar isso dentro de um turno, mas o ledger crescido reaparece no turno seguinte. Vigiar a taxa da fase A **depois** de a fase B entrar, não só antes.
3. **`sabido` por `presentes` vazio é bom o bastante?** É o backstop que a US-75 propôs e nunca implementou. Cena com `presentes` vazio significa "ninguém mais em cena", que é boa proxy de "o jogador estava sozinho" — mas a cena pode estar desatualizada justamente nos turnos em que a rede dispara. Medir se o `privado` sai atribuído a mais coisa do que deveria.
4. **Entidade duplicada por grafia.** "a Vigia" e "Vigia" e "a vigia da capela" são a mesma pessoa para o jogador e três entradas para o merge. `mergeEntities` já casa por acento/caixa, não por artigo nem por aposto. A rede automática multiplica esse risco porque insere sem ninguém revisar.

---

## Referências no código

- [`apps/api/src/ai/ai.service.ts`](../../../apps/api/src/ai/ai.service.ts) — `:1047` `reconcileScene` (o molde); `:804` a checagem `cenaTocada`, análoga à de `recordEntity`; `:792` `detectSlopName` no `onFinish` (o molde do log da fase A); `:828` `completeTruncatedTurn` e `:865` o comentário que documenta o esquecimento a não repetir; `:565` a tool `recordEntity`, `:596` a releitura do banco, `:608` por que não se loga `CHARACTER_UPDATE`; `:1020` `extractOpeningEntities`, o extrator de entidades que já existe.
- [`packages/ai-engine/src/guardrails.ts`](../../../packages/ai-engine/src/guardrails.ts) — casa do detector novo; `:139` `detectSlopName` (vizinho, **não** base); `:191` `detectCanonDenial`; `guardrails.test.ts` é onde o teste puro entra.
- [`packages/ai-engine/src/entities.ts:16`](../../../packages/ai-engine/src/entities.ts) — `mergeEntities` e a tolerância de match que o detector precisa reproduzir.
- [`packages/ai-engine/src/prompts/dm-system.ts:367`](../../../packages/ai-engine/src/prompts/dm-system.ts) — a instrução `DURABLE CANON` que já pede o registro; é o que está falhando.
- [`packages/ai-engine/src/model.ts:282`](../../../packages/ai-engine/src/model.ts) — `EXTRACTION_PROVIDER_OPTIONS`.
- [`apps/api/prisma/schema.prisma:73`](../../../apps/api/prisma/schema.prisma) — o comentário de `Adventure.entities` que explica a amnésia original.
- [US-75](./US-75-dimensao-de-proveniencia-no-ledger.md) — *Fora do escopo* nomeia esta story; o backstop de `sabido` está nas *Notas de implementação* de lá.
