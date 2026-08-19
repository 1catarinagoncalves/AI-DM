# US-168 — Abertura narrada expande o gancho fixo, não a aventura gerada

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** [US-173](./US-173-registro-fica-so-com-tone.md) (bloqueia — reduz `registry` a `{ tone }` antes desta story rodar)
**Relacionado:** [US-153](./US-153-aventura-deixa-de-ser-derivada-da-classe.md) (aposentou o gancho fixo por classe como *a aventura*, mas não atualizou `buildOpeningInstruction` pra isso) · [US-164](./US-164-orquestrador-motor-monta-aventura-gerada.md) (dono do `GeneratedAdventure`/`mainQuest` que deveria dominar a abertura) · [US-157](./US-157-tela-de-mundo-depois-da-revisao.md) (1º fluxo ponta-a-ponta — criação de personagem → passo Mundo → aventura — que expôs o bug em validação manual)
**Criada em:** 2026-08-18 — achado ao validar manualmente o fluxo de criação da US-157: personagem Bardo, aventura gerada com resumo "Protect an NPC" (visível no hub), mas a 1ª narração do Mestre foi sobre um baile na corte Eladrin — o gancho fixo do Bardo, sem nenhuma menção à aventura gerada.

---

## História

> **Como** jogador que acabou de criar um personagem e uma aventura gerada (tom escolhido ou sorteado, US-157),
> **quero** que a primeira narração do Mestre seja sobre a aventura que foi de fato gerada para mim,
> **para que** a premissa que vejo no hub ("Aventura: X") bata com o que o Mestre efetivamente narra na 1ª cena.

---

## Contexto e motivação

### O problema observado

Personagem Bardo, aventura gerada com resumo "Protect an NPC" (título mostrado no hub de personagens). A 1ª narração do Mestre (persistida como o evento `NARRATION` inicial e mostrada na tela de jogo) não menciona a NPC, o objetivo de proteção, nem qualquer elemento do artefato gerado — é uma cena inteira sobre um Carvalhal feérico, uma corte de Eladrin dançando, e uma chave/baú, com um Eladrin convidando o personagem para dançar. Esse conteúdo bate, quase frase a frase, com o gancho fixo por classe do Bardo (o `hookSeed` resolvido por `resolveInitialHook` a partir do config do sistema) — não com o `GeneratedAdventure.summary`/`start` que o motor de geração (US-164) produziu para esta aventura específica.

### Por que a solução atual não basta

`buildOpeningInstruction` ([dm-system.ts:614](../../../packages/ai-engine/src/prompts/dm-system.ts)) recebe só `characterName`, `hookSeed` e `locale` — **nunca** `mainQuest`. A instrução que ela monta diz literalmente ao modelo:

> "Use this seed as the spark for the scene... Expand it into a full cinematic opening... do NOT quote it verbatim: `"{hookSeed}"`"

`hookSeed` aqui é `profile.hookSeed` (`adventure.service.ts` → `buildAdventureProfile`), que é o gancho **fixo por classe** — o mesmo texto que, antes da US-153/US-164, era a aventura inteira. A US-153 aposentou esse gancho como *a aventura* (ele virou só uma âncora de continuidade/estilo para o motor de geração), mas ninguém atualizou `buildOpeningInstruction`: ela continua tratando `hookSeed` como "a fagulha da cena", a única coisa que o modelo recebe como instrução direta de "isto é o que você narra agora".

O `mainQuest` de verdade (`${generated.summary}\n${generated.start}`, montado em `createForCharacter`) só entra em `buildTurnStateBlock` como bloco passivo de estado — "## Main quest", sob o cabeçalho "read-only — managed by the Game Server", junto de HP/inventário/cena. Ele nunca é apresentado como a fonte da cena de abertura. O modelo obedece à instrução mais explícita e recente (a mensagem de usuário, `buildOpeningInstruction`) em vez do bloco de estado — daí expandir fielmente o gancho fixo e ignorar a aventura gerada.

**Segundo achado, mesma causa (2026-08-18):** `createForCharacter` já computa `seededEntities = seedLedgerFromGeneratedAdventure(generated)` ([adventure.service.ts:295](../../../apps/api/src/adventure/adventure.service.ts)) — os NPCs e segredos que o motor gerou, no formato `WorldEntity[]` que `buildTurnStateBlock` já sabe renderizar (parâmetro `entities`, usado em todo turno normal). Mas a chamada a `generateOpeningNarration` logo depois não manda `seededEntities` em lugar nenhum — nem o parâmetro existe na assinatura da função. `generateOpeningNarration` monta o `turnState` sem `entities`, então `buildTurnStateBlock` cai no ramo "(nenhuma entidade registrada ainda...)". A abertura é escrita cega ao elenco que o motor já criou: o modelo inventa NPC/local novos ali mesmo (violando a própria regra de Onomástica do prompt, que existe para casar nomes com o registro), e o que ele inventa pode não bater com `seededEntities`, que é persistido no MESMO turno como o ledger canônico — fratura de continuidade já na 1ª cena.

**Terceiro achado, escopo maior — não é só a abertura (2026-08-18):** `registry.tone`/`registry.setting`/`registry.areaType` (US-156) alimentam os prompts do MOTOR (`generateLocationsAndNpcs`/`generateClosing`, ver `Tom: ${params.registry.tone}...` em [ai.service.ts:1302](../../../apps/api/src/ai/ai.service.ts) e [:1408](../../../apps/api/src/ai/ai.service.ts)) — moldam O QUE é gerado. **Correção (2026-08-19):** a versão anterior desta nota também listava `generateSecrets` entre os consumidores de `registry` — checado contra o código, é falso. `generateSecrets` ([ai.service.ts:1339-1373](../../../apps/api/src/ai/ai.service.ts)) não recebe `tone`/`setting`/`areaType` em grau nenhum, nem como frase solta — gap mais profundo que o do Mestre, fora do escopo desta story (não investigado aqui, sem story própria ainda). Mas nunca chegam a `buildDmSystemPrompt` nem a `buildTurnStateBlock`, então nada instrui o Mestre sobre COMO narrar (registo, mood, mais sombrio ou mais cômico) — nem na abertura, nem em turno nenhum depois dela. Pior: `Adventure.generatedAdventure Json?` — a coluna que a [ADR 012 §D2](../../adr/012-aventura-gerada-como-dado.md) e a [US-144](./US-144-schema-aventura-shared.md) reservaram exatamente pra guardar `tone`/`setting`/`areaType` (entre outros campos do artefato) acessível turno a turno — existe no schema ([schema.prisma:85](../../../apps/api/prisma/schema.prisma)) mas **não é escrita em lugar nenhum**: `tx.adventure.create` em `createForCharacter` não inclui `generatedAdventure: generated` no `data`. Confirmado por grep: `generatedAdventure` não aparece em nenhum arquivo de `apps/api/src` fora da definição do schema — coluna morta desde que foi criada.

Achado a favor: o turno JÁ busca `adventure` inteiro sem `select` (`this.prisma.adventure.findUnique({ where: { id: adventureId }, include: { system: true } })`, [ai.service.ts:408](../../../apps/api/src/ai/ai.service.ts)) — Prisma devolve todos os escalares por padrão, então `adventure.generatedAdventure` já estaria disponível ali de graça assim que a escrita existir. Não precisa de query nova.

### A proposta

`buildOpeningInstruction` passa a receber `mainQuest` e a instrução centra nele como "a fagulha da cena" — a aventura gerada é o que a 1ª narração precisa dramatizar. `hookSeed` deixa de ser citado como o spark principal (ele já está embutido em `mainQuest`, ver Notas de implementação). `generateOpeningNarration` passa a receber e repassar `entities` (os `seededEntities` já computados) ao `buildTurnStateBlock`, do mesmo jeito que todo turno normal já faz — a abertura escreve sobre o elenco que o motor gerou, não um elenco à parte. `createForCharacter` passa a escrever `generatedAdventure: generated` na criação; `buildDmSystemPrompt` ganha `tone` (camada 2 — constante pela aventura inteira, cacheável, ver Notas de implementação) e `streamChat` o lê de `adventure.generatedAdventure` todo turno, não só na abertura.

> **Nota (2026-08-19):** [US-173](./US-173-registro-fica-so-com-tone.md) bloqueia esta story — `registry` já é `{ tone }` (sem `setting`/`areaType`) quando esta roda. Todo `registry`/`buildDmSystemPrompt`/`streamChat` citado neste documento é só `tone`.

---

## Escopo

### Dentro do escopo

- `buildOpeningInstruction` ganha parâmetro `mainQuest?: string | null` e reescreve a instrução para usá-lo como a fagulha da cena.
- `generateOpeningNarration` ganha parâmetro `entities?: WorldEntity[] | null` e repassa pro `buildTurnStateBlock` (mesmo formato que os turnos normais já usam) e pro `buildOpeningInstruction` via `mainQuest`.
- `createForCharacter` passa `params.mainQuest` e `params.entities: seededEntities` na chamada a `generateOpeningNarration` (linha ~307).
- Fallback: sem `mainQuest`/`entities` (ex.: `resolveInitialHook`/motor indisponível, ou sistema legado sem aventura gerada), a instrução cai no comportamento atual — `hookSeed` como spark, ledger vazio — para não quebrar nenhum caminho existente.
- `tx.adventure.create` (dentro de `createForCharacter`) passa a escrever `generatedAdventure: generated` — a coluna que a ADR 012/US-144 já reservaram, agora populada de verdade.
- `buildDmSystemPrompt` ganha `tone?: string` (opcional — sistema sem motor de geração, ex. Free, não tem) e uma linha curta de instrução de registo/mood na seção de ofício.
- `streamChat` (`ai.service.ts`, chamada de TODO turno) lê `adventure.generatedAdventure` (já disponível de graça, sem query nova — ver Notas) e passa `tone` para `buildDmSystemPrompt`.
- `generateOpeningNarration`/`createForCharacter` passam o mesmo campo (já tem `generated.tone` em mãos, antes mesmo da escrita no banco) — a abertura já nasce coerente, não só os turnos depois dela.
- Eval/teste de regressão cobrindo que a abertura gerada reflete o `mainQuest` E nomeia (ou pelo menos não contradiz) os NPCs de `entities`, não só o `hookSeed`; e que um turno qualquer (não só o 1º) narra num registo compatível com o `tone` gerado.

### Fora do escopo

- Mudar o formato do bloco "## Main quest"/"## Entidades" em `buildTurnStateBlock` — eles já expõem o dado certo, só não são onde a instrução de abertura devia buscar a fagulha/o elenco.
- Mudar `AdventureService.generateAdventure`/o motor de geração (US-164) ou `seedLedgerFromGeneratedAdventure` (US-151) — o artefato gerado e o ledger já estão corretos; o bug é só na instrução de prompt que ignora os dois.
- Fallback estático (`openingText = generatedOpening ?? profile.hookSeed`, `adventure.service.ts:329`) quando a chamada de IA falha inteira — esse comportamento é correto e intencional (US-101), não é este bug.
- `seedLedgerFromGeneratedAdventure` não emite `WorldEntity` de tipo `'local'` para `adventure.locations` (só NPCs e segredos) — gap real, mas de outra story (US-151), não desta.
- Versionar/migrar `generatedAdventure` para aventuras já criadas ANTES desta story (coluna sempre esteve `Json?` — ficam `null`, `buildDmSystemPrompt` cai no fallback sem `tone`, sem quebrar).
- Mudar os prompts do MOTOR (`generateLocationsAndNpcs`/`generateClosing`) que já recebem `tone` — só o Mestre (narração) está cego a ele. `generateSecrets` NÃO recebe `registry` (correção 2026-08-19, ver *Terceiro achado*) — fora do escopo aqui também, mas por motivo diferente (gap não coberto por story nenhuma ainda, não "já recebe corretamente").

---

## Critérios de aceite

- [ ] `buildOpeningInstruction` aceita `mainQuest?: string | null`.
- [ ] Com `mainQuest` presente, a instrução usa esse texto como a fagulha da cena de abertura ("use isto, não `hookSeed`, como o que você dramatiza").
- [ ] Sem `mainQuest` (`null`/`undefined`), a instrução cai no comportamento atual (`hookSeed` como spark) — nenhum caminho existente quebra.
- [ ] `generateOpeningNarration` (`ai.service.ts`) aceita `entities?: WorldEntity[] | null` e repassa pro `buildTurnStateBlock` da abertura, junto de `mainQuest`.
- [ ] `createForCharacter` passa `seededEntities` (já computado antes da chamada) como `entities` — a abertura passa a ver o mesmo elenco que o ledger vai persistir no mesmo turno.
- [ ] `tx.adventure.create` grava `generatedAdventure: generated` — coluna deixa de ficar sempre `null`.
- [ ] `buildDmSystemPrompt` aceita `tone?` e adiciona uma instrução curta de registo/mood quando presente; ausente (sistema sem motor, ou aventura anterior a esta story) não muda o prompt de hoje.
- [ ] `streamChat` lê `adventure.generatedAdventure` (sem query nova) e repassa `tone` pra `buildDmSystemPrompt` em TODO turno, não só na abertura.
- [ ] `createForCharacter`/`generateOpeningNarration` recebem o mesmo campo direto de `generated.tone` (sem esperar o round-trip pelo banco) pra abertura já nascer coerente.
- [ ] **Eval / teste de regressão:** caso que monta um `hookSeed` A e um `mainQuest`/`entities` B claramente distintos (ex.: hookSeed sobre uma corte feérica, mainQuest+NPC nomeado sobre proteger alguém numa mina) e confirma que a abertura gerada referencia elementos de B (inclusive o nome do NPC gerado), não de A.
- [ ] **Eval / teste de regressão:** caso com `tone: 'grimdark'` vs `tone: 'comedic'` (mesmo `mainQuest`) e confirma que a narração de um turno qualquer (não só a abertura) muda de registo entre os dois.
- [ ] `pnpm eval` passa (regra do projeto para qualquer mudança em prompt do DM Agent).

---

## Notas de implementação

- `GeneratedAdventure.start` **já é** `profile.hookSeed` (`adventure.service.ts:206`, `start: profile.hookSeed` dentro de `generateAdventure`) — e `mainQuest = \`${generated.summary}\n${generated.start}\`` (`adventure.service.ts` em `createForCharacter`). Ou seja, `mainQuest` já contém o `hookSeed` embutido no fim; citar só `mainQuest` na instrução não perde a âncora de continuidade, só corrige o peso (a aventura gerada vem primeiro/dominante, o gancho de classe vira o fecho/tempero).
- `seededEntities` já existe como variável local em `createForCharacter` ANTES da chamada a `generateOpeningNarration` — é só encanamento (thread through), sem lógica nova: mesmo `WorldEntity[]` que `buildTurnStateBlock` já sabe formatar (`entitiesSection`, usada em todo turno).
- Arquivo principal: [dm-system.ts](../../../packages/ai-engine/src/prompts/dm-system.ts) → `buildOpeningInstruction` (linha 614) e `buildDmSystemPrompt` (linha 224, `tone` novo).
- Segundo arquivo: [ai.service.ts](../../../apps/api/src/ai/ai.service.ts) → `generateOpeningNarration` (linha ~1130-1186), assinatura + chamada a `buildTurnStateBlock` (~1165) precisam do novo campo `entities`; `streamChat` (linha ~400) precisa ler `adventure.generatedAdventure` e passar pra `buildDmSystemPrompt` (~504).
- Terceiro arquivo: [adventure.service.ts](../../../apps/api/src/adventure/adventure.service.ts) → `createForCharacter` (chamada a `generateOpeningNarration`, ~linha 307, passa `mainQuest`/`entities`/`tone`; `tx.adventure.create`, ~linha 348, ganha `generatedAdventure: generated`).
- `tone` é CONSTANTE pra aventura inteira (nasce no `GeneratedAdventure`, nunca muda turno a turno) — camada 2 do ADR 007 (`docs/adr/007-camadas-do-prompt-por-volatilidade.md`), igual a `characterClass`/`characterRace`: vai em `buildDmSystemPrompt` (cacheável), não em `buildTurnStateBlock` (camada 3, volátil, US-56). Meter em `buildTurnStateBlock` funcionaria narrativamente, mas custaria cache-hit toda vez que o resto do bloco de estado mudar (US-55).
- `adventure.generatedAdventure` já vem no `SELECT *` implícito do Prisma (`findUnique` sem `select`, só `include: { system: true }`) — nenhuma query nova em `streamChat`, só ler o campo que já está no objeto.
- `GeneratedAdventureSchema.parse` (ou cast direto, já validado no gate da US-150 antes de persistir) pra extrair `tone` do JSON — mesmo padrão que `SystemConfigSchema.parse(configForLocale(...))` já usa pra `System.config`.
- Mudança em prompt do DM Agent — rodar `pnpm eval` depois (custa chamadas reais de LLM, ver `AGENTS.md`).

---

## Questões em aberto

1. ~~Quando `mainQuest` e `hookSeed` divergem em algum detalhe concreto (nome de item, tom), a instrução deve mencionar `hookSeed` explicitamente como pano de fundo de personagem/classe, ou só `mainQuest`?~~ **RESOLVIDO (2026-08-19), decisão da mantenedora: só `mainQuest` — gancho de classe some da narração de vez.** Quando `mainQuest` existe, `hookSeed` não é citado em grau nenhum (nem spark, nem pano de fundo secundário) — já era a proposta desta story (linha 76: "use isto, não `hookSeed`"), agora confirmado sem exceção. Efeito colateral em [US-172](./US-172-abertura-gerada-nao-copia-gancho-fixo.md) (nova, 2026-08-19): `generated.start` deixa de ser `profile.hookSeed` literal — a nota abaixo ("`GeneratedAdventure.start` já é `profile.hookSeed`") vale só até aquela story ser implementada; depois disso `mainQuest` não carrega mais NENHUM traço do gancho de classe, o que reforça esta resolução em vez de contradizê-la (nada a ajustar aqui).
2. A instrução de registo/mood em `buildDmSystemPrompt` deve ser uma frase fixa por `tone` (dicionário `tone → instrução`, precisa cobrir toda a lista de `TONES` do motor) ou uma linha genérica tipo "narre no registo: {tone}" deixando o modelo interpretar a palavra-chave sozinho? A segunda é mais barata de manter (nenhuma lista pra sincronizar quando `TONES` ganhar entrada nova), mas depende do modelo interpretar bem o rótulo cru do catálogo.

---

## Referências no código

- [packages/ai-engine/src/prompts/dm-system.ts:614](../../../packages/ai-engine/src/prompts/dm-system.ts) — `buildOpeningInstruction`, a função a mudar.
- [apps/api/src/ai/ai.service.ts:1173](../../../apps/api/src/ai/ai.service.ts) — chamada que hoje só passa `hookSeed`.
- [apps/api/src/adventure/adventure.service.ts:206](../../../apps/api/src/adventure/adventure.service.ts) — `start: profile.hookSeed` dentro de `generateAdventure` (prova que `mainQuest` já contém o `hookSeed`).
- [apps/api/src/adventure/adventure.service.ts:329](../../../apps/api/src/adventure/adventure.service.ts) — fallback estático quando `generateOpeningNarration` devolve `null` (comportamento correto, não é este bug).
- [apps/api/src/adventure/adventure.service.ts:295](../../../apps/api/src/adventure/adventure.service.ts) — `seededEntities = seedLedgerFromGeneratedAdventure(generated)`, computado mas nunca repassado à abertura.
- [apps/api/src/adventure-generation/seed-ledger.ts](../../../apps/api/src/adventure-generation/seed-ledger.ts) — `seedLedgerFromGeneratedAdventure`, formato `WorldEntity[]` que a abertura precisa receber.
- [apps/api/prisma/schema.prisma:85](../../../apps/api/prisma/schema.prisma) — `Adventure.generatedAdventure Json?`, coluna reservada (ADR 012/US-144) e nunca escrita.
- [docs/adr/012-aventura-gerada-como-dado.md](../../adr/012-aventura-gerada-como-dado.md) — decisão D2, dono da coluna `generatedAdventure` que esta story finalmente popula.
- [US-144](./US-144-schema-aventura-shared.md) — `GeneratedAdventureSchema`, schema de validação do JSON persistido.
- [apps/api/src/ai/ai.service.ts:408](../../../apps/api/src/ai/ai.service.ts) — `streamChat`, o `findUnique` de `adventure` que já traz `generatedAdventure` de graça (sem `select`).
- [apps/api/src/ai/ai.service.ts:504](../../../apps/api/src/ai/ai.service.ts) — chamada a `buildDmSystemPrompt` de todo turno, precisa do campo novo (`tone`).
- [apps/api/src/ai/ai.service.ts:1302](../../../apps/api/src/ai/ai.service.ts) e [:1408](../../../apps/api/src/ai/ai.service.ts) — `Tom: ${params.registry.tone}...`, prova que `tone` já chega aos prompts do MOTOR (geração de conteúdo), só não ao Mestre (narração).
- [packages/ai-engine/src/prompts/dm-system.ts:224](../../../packages/ai-engine/src/prompts/dm-system.ts) — `buildDmSystemPrompt`, ganha o campo novo (`tone`, camada 2, cacheável).
- [US-173](./US-173-registro-fica-so-com-tone.md) — bloqueia esta story; reduziu `registry` a `{ tone }` antes desta rodar.
