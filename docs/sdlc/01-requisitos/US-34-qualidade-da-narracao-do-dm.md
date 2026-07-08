# US-34 — Qualidade cinematográfica da narração do AI DM

**Épico:** 2 — Aventura
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** [US-28](./US-28-aventura-inicial-baseada-na-classe.md) (primeira narração da aventura), [US-23](./US-23-dm-ciente-da-ficha.md) (DM recebe ficha completa) e [US-11b](./US-11b-estado-de-cena-estruturado.md) (estado de cena estruturado).
**Criada em:** 2026-07-07

---

## História

> **Como** jogador,
> **quero** que a primeira narração do AI DM tenha qualidade cinematográfica e que essa qualidade se mantenha em todos os turnos seguintes,
> **para que** a aventura pareça escrita por um mestre humano do início ao fim, e não uma sequência de respostas genéricas de "você faz X, sucesso/falha".

---

## Contexto e motivação

### A barra de qualidade

O jogador apontou uma abertura de referência como o padrão a ser atingido — e mantido — em toda a narração:

> A chuva fina caía sobre a estrada de terra batida enquanto você cavalgava em sua égua branca, Aurora. A armadura brilhante, mesmo molhada, ainda refletia a luz fraca do entardecer. Fazia três dias desde que deixou a última cidade, guiada por um sonho divino: "Nas sombras de Eldridge, as trevas despertam. Uma chama se apaga… e o inocente clama por justiça."
>
> À frente, as luzes tremulantes de Vila de Eldridge surgiam entre as árvores. [...] Mas algo estava errado. O portão de madeira estava entreaberto, e o silêncio era pesado demais para uma vila ao anoitecer.
>
> — Pela Luz! Uma paladina! — ele exclama, com a voz trêmula. — Senhora… por favor… eles levaram as crianças! [...]
>
> Você sente um formigamento familiar no peito: a presença do mal próximo. [...]
>
> O que você faz, Lady Seraphine?
> (Exemplos: Perguntar mais detalhes ao velho / Entrar na vila e procurar o prefeito / Usar sua habilidade para Detectar o Mal / Outra ação)

O que torna esse texto bom é **ofício**, não sorte:
- Abre pelos **sentidos** (chuva, armadura molhada, luz do entardecer) antes de qualquer exposição.
- É **concreto e específico**: a égua tem nome (Aurora), a espada tem nome (Luz da Manhã), o escudo tem símbolo (Sol Dourado).
- **Ancora o personagem**: a classe (paladina) vira uma lente sobre o mundo — o "formigamento no peito" é a habilidade de detectar o mal, mostrada como sensação, não como número.
- **Mostra a tensão antes de explicá-la**: o silêncio errado da vila vem antes de sabermos o que houve.
- Dá **voz e corpo a um NPC** (o velho ajoelhado, de voz trêmula) com stakes emocionais (as crianças).
- **Fecha num gancho vivo**: dirige-se ao personagem pelo nome e apresenta opções de ação.

### O problema observado

A narração do AI DM não alcança essa barra — nem na primeira cena, nem ao longo do jogo — porque **falta uma definição explícita de qualidade** no lugar onde a narração é produzida.

O sintoma aparece em dois momentos, mas a causa é a mesma:

- **Na abertura**, a primeira narração (US-28) é um `openingNarration` **estático** do `System.config`, resolvido só com `{characterName}`/`{characterClass}`. São frases de uma linha (ex.: *"A prece de sempre volta oca. O símbolo sagrado nas tuas mãos esfria…"*): bom sinal de intenção, mas sem cena, NPC, sentidos nem opções, e incapaz de reagir à raça, ao gênero ou ao equipamento do personagem.
- **Nos turnos seguintes**, a narração é guiada pelo system prompt (`buildDmSystemPrompt`), que hoje tem muitas regras de **consistência e formatação** (ordem de resolução de turno, opções vs. diálogo, continuidade espacial, concordância de gênero…) mas quase nenhuma orientação de **ofício**. A única seção de estilo resume tudo a *"medieval-fantasy tone: descriptive and immersive, but always concise."* Sem uma barra explícita, o modelo cai em narração funcional e genérica.

Ou seja: onde a abertura é um texto fixo curto demais para ser bom, e onde os turnos seguintes carecem de instrução de qualidade, o resultado é o mesmo — narração abaixo da barra.

### A proposta

Definir a barra de qualidade **uma vez**, no system prompt do DM, e fazer com que **toda** narração — incluindo a primeira — passe por ela.

Concretamente, uma única mudança coerente com dois efeitos:

1. O system prompt ganha uma seção de **ofício narrativo** que estabelece a barra e vale para todo turno.
2. A **primeira narração passa a ser gerada pelo mesmo DM** (via LLM, usando esse system prompt) em vez de um texto fixo. A fagulha do gancho da classe entra como semente; o `openingNarration` estático vira **fallback** caso a geração falhe, para a aventura nunca ficar sem abertura.

Assim a abertura e os turnos seguintes deixam de ser dois mecanismos com qualidades diferentes e passam a ser **a mesma voz, sob a mesma barra**.

---

## Escopo

### Dentro do escopo

- Seção de **ofício narrativo** em `buildDmSystemPrompt`, aplicável à abertura e a todos os turnos, sem enfraquecer as regras de consistência/formatação já existentes.
- A **primeira narração é gerada por IA** na criação da aventura (`AdventureService.createForCharacter`), reusando `buildDmSystemPrompt` e a fagulha do gancho (`hook.openingNarration`) como semente.
- **Fallback obrigatório** ao `openingNarration` estático do gancho quando a geração por IA falhar ou vier vazia. A aventura nunca fica sem abertura.
- A geração da abertura roda **fora da transação** de criação (LLM é lento; não deve segurar locks). Só o texto final entra na transação que grava `Adventure`, `CharacterState`, `Quest` e o `EventLog` de abertura.
- A abertura continua persistida como `EventLog` `type: 'NARRATION'`, `summarized: false`, aparecendo em `getTurns()` (tela) e em `historyLogs` (contexto do DM) — sem mudança no contrato da US-28.
- A geração da abertura **não usa tools** (não há ação, dados nem `CharacterState` estruturado ainda): apenas prosa + opções.

### Fora do escopo

- Integrar **raça** e **background** como eixos formais da história (evolução futura da US-28). O ofício *incentiva* usar a identidade do personagem, mas a escolha do gancho continua baseada só na classe.
- **Streaming** da primeira narração. A abertura é gerada e persistida de uma vez na criação; streaming segue só nos turnos de chat.
- Estabelecer o **estado de cena estruturado** (`sceneState`) já na abertura. Como o `CharacterState` nasce na mesma transação, a cena estruturada continua nula até o primeiro turno; a abertura estabelece a cena só na prosa. (Ver Questões em aberto.)
- Suíte de **eval automatizada de qualidade literária**. Esta US garante o mecanismo; medir qualidade por rubrica é candidato a story de evals futura.
- Reescrever os `openingNarration` estáticos do seed. Continuam como estão, agora no papel de semente/fallback.

---

## Abordagem técnica

A entrega é uma mudança só, em duas partes que se apoiam: a barra vive no system prompt, e a abertura passa a consumir esse mesmo prompt.

### 1. Ofício narrativo no system prompt

Adicionar em `packages/ai-engine/src/prompts/dm-system.ts`, logo após `## Your role`, uma seção que estabelece a barra e vale para todo turno. Regras acionáveis (não decorativas):

- **Abrir pelos sentidos**, não pela exposição.
- **Ser concreto e nomear coisas** (a montaria, a espada, o símbolo, o NPC) — detalhe específico bate genérico.
- **Ancorar o personagem**: raça, classe, equipamento e habilidades aparecem por ação e sensação, nunca como lista de stats; a classe é uma lente sobre o mundo.
- **Mostrar a tensão antes de explicá-la.**
- **Dar voz e corpo aos NPCs** (movimento, emoção, stakes — especialmente para os inocentes/vulneráveis).
- **Variar o ritmo** (frases curtas + longas).
- **Manter conciso** (3–5 parágrafos curtos; imersivo ≠ prolixo).
- **Fechar num gancho vivo**, dirigindo-se ao personagem pelo nome, seguido das opções.
- Deixar explícito que narração genérica/"video-gamey" é uma **falha**, mesmo que mecanicamente correta.

Essa seção **soma** orientação de qualidade onde hoje só há orientação de estrutura; não substitui nenhuma regra de formatação/consistência existente.

### 2. Primeira narração gerada pelo mesmo DM

- **Builder de instrução de abertura** (`buildOpeningInstruction`) em `ai-engine`: monta a mensagem de usuário que dispara a 1ª cena, deixando claro que é a abertura (o jogador ainda não agiu), passando a semente do gancho e restringindo a saída (sem tools, sem dados, sem tags — só prosa + opções).
- **Método no `AiService`** (`generateOpeningNarration`): reusa `buildDmSystemPrompt` como `system` (com a seção de ofício), chama `generateText` com o modelo primário de narração **sem tools**, e devolve `string | null` (try/catch → `null`, com log). Nunca lança.
- **`AdventureService.createForCharacter`**: antes da transação, resolve o gancho e chama `generateOpeningNarration`. `openingText = geradoPorIA ?? hook.openingNarration`. A transação grava `openingText` no `EventLog` de abertura.
- **Wiring:** `AiModule` exporta `AiService`; `AdventureModule` importa `AiModule` (`AdventureModule → AiModule → GameModule`, sem ciclo).

### Diagrama de fluxo (alteração sobre a US-28)

```
POST /characters/:characterId/adventures  { initialHookId }
  │
  ├─ resolve hook do System.config pela classe
  ├─ resolve placeholders ({characterName}, {characterClass})
  │
  ├─ generateOpeningNarration(...)   ← NOVO, fora da transação
  │     ├─ buildDmSystemPrompt(...) [com a seção de ofício]
  │     ├─ buildOpeningInstruction({ characterName, hookSeed })
  │     └─ generateText (sem tools) → texto | null
  │  openingText = geradoPorIA ?? hook.openingNarration   ← FALLBACK
  │
  └─ TRANSAÇÃO (igual à US-28):
       ├─ Adventure.create(title)
       ├─ AdventureParticipant.create
       ├─ CharacterState.create
       ├─ Quest.create(isPrimary: true, title, description)
       └─ EventLog.create(type: NARRATION, payload.text: openingText)
```

---

## Critérios de aceite

- [ ] `buildDmSystemPrompt` inclui uma seção explícita de ofício narrativo, aplicável tanto à abertura quanto a cada turno seguinte.
- [ ] Essa seção **não remove nem enfraquece** as regras existentes de formatação e consistência (ordem de resolução de turno, opções vs. diálogo, continuidade espacial, concordância de gênero).
- [ ] A seção instrui, no mínimo: abrir pelos sentidos; nomear coisas concretas; usar a classe como lente; mostrar tensão antes de explicar; dar voz/corpo aos NPCs; variar ritmo; manter conciso (3–5 parágrafos); fechar num gancho vivo com opções.
- [ ] Ao iniciar a aventura, a primeira narração é gerada por LLM usando esse mesmo system prompt e a fagulha do gancho da classe como semente.
- [ ] Se a geração por IA falhar ou vier vazia, o sistema usa o `openingNarration` estático do gancho como **fallback** e a aventura é criada normalmente.
- [ ] A geração por IA acontece **fora** da transação de criação; a transação só grava texto final.
- [ ] A abertura (gerada ou fallback) é persistida como `EventLog` `type: 'NARRATION'`, `summarized: false`, e aparece como primeira mensagem do Mestre em `getTurns()`.
- [ ] A geração da abertura **não chama tools** e não emite tags internas — apenas prosa e opções.
- [ ] Placeholders (`{characterName}`, `{characterClass}`) continuam resolvidos no backend antes de qualquer geração/persistência; nenhum placeholder cru chega ao LLM, ao jogador ou ao banco.
- [ ] **(regressão — fallback determinístico)** Com a geração por IA mockada devolvendo `null`, criar uma personagem `Mago` e verificar que o `EventLog` de abertura contém o `openingNarration` estático do gancho de Mago com placeholders resolvidos — idêntico à US-28.
- [ ] **(regressão — caminho IA)** Com a geração devolvendo texto, verificar que o `EventLog` de abertura contém esse texto, não o template estático.
- [ ] **(regressão — continuidade DM)** Após a primeira ação do jogador, o AI DM recebe a abertura como mensagem `assistant` no histórico e continua a partir dela, sem repetir a cena.
- [ ] A criação da aventura não estoura timeout: a chamada de LLM roda fora da transação e tem fallback rápido.

---

## Notas de implementação

- **ai-engine:** adicionar a seção de ofício em `packages/ai-engine/src/prompts/dm-system.ts` (após `## Your role`) e o builder `buildOpeningInstruction({ characterName, hookSeed })`; exportar o builder no `index`. A API roda `packages/ai-engine/dist` — obrigatório `pnpm --filter @ai-dm/ai-engine build` após editar o `src`.
- **AiService:** `generateOpeningNarration(params)` monta `buildDmSystemPrompt` (com `sceneState: null`, `memorySummary: null`, `activeQuests: []`), chama `generateText` com `narrationModels[0]` **sem tools**, devolve `string | null` (try/catch → `null`, com log).
- **AdventureService:** injetar `AiService`; em `createForCharacter`, calcular `startingInventory` uma vez, gerar a abertura antes da transação e usar `openingText = gerado ?? hook.openingNarration` no `EventLog`. Passar ao gerador: `systemName`, `characterName/Gender/Class/Race`, `mainQuest` (título+descrição da quest primária), inventário inicial, `sheet` (level/hp/maxHp/attributes/conditions) e `hookSeed = hook.openingNarration`.
- **Módulos:** `AiModule` passa a `exports: [AiService]`; `AdventureModule` passa a `imports: [AiModule]`. Verificar ausência de ciclo de DI.
- **Testes:** estender `apps/api/src/adventure/adventure.service.test.ts` com um fake de `AiService` — por padrão devolvendo `null` (preserva as asserções de texto estático da US-28) e um caso devolvendo texto (exercita o caminho IA). Todas as construções `new AdventureService(prisma)` passam a receber o fake.
- **Sem mudança de contrato:** a US-28 continua válida em tudo (transação, quest primária, `EventLog`, resolução de placeholders). Esta US só troca a *fonte* do texto da abertura (IA com fallback) e adiciona a barra de ofício ao prompt.
- **Robustez:** a falha da IA nunca deve impedir a criação da aventura — o fallback estático é a rede de segurança e deve ser testado.

---

## Questões em aberto

1. ~~**Estado de cena na abertura.**~~ **Resolvido:** como o `CharacterState` nasce na mesma transação, a abertura gerada não popula o `sceneState` estruturado (a cena vive só na prosa até o 1º turno), abrindo uma janela de inconsistência no primeiro turno. Encaminhado para a [US-35](./US-35-cena-estruturada-na-abertura.md), que extrai `local/ambiente/período/presentes` da abertura e já popula o `sceneState`.
2. ~~**Custo/latência na criação.**~~ **Resolvido:** a chamada de LLM extra no fluxo de "iniciar aventura" é **aceitável** no MVP. Roda fora da transação e tem fallback rápido ao template estático. Um indicador de carregamento na UI é desejável, mas opcional, e não bloqueia esta US.
3. ~~**Modelo dedicado para a abertura.**~~ **Resolvido:** a abertura usa o **mesmo modelo primário de narração** dos turnos seguintes (`narrationModels[0]`), sem modelo dedicado. Mantém a voz consistente entre abertura e jogo, e simplifica o código; se a primeira impressão pedir mais no futuro, vira story própria.
4. ~~**Eval de qualidade.**~~ **Resolvido:** encaminhado para a [US-36](./US-36-eval-de-qualidade-da-narracao.md), que mede a qualidade da narração por rubrica (LLM-as-judge) como rede de segurança contra regressão.

---

## Referências no código

- `packages/ai-engine/src/prompts/dm-system.ts` — `buildDmSystemPrompt`; adicionar a seção de ofício e o builder `buildOpeningInstruction`.
- `packages/ai-engine/src/index.ts` — exportar o novo builder.
- `apps/api/src/ai/ai.service.ts` — novo método `generateOpeningNarration`.
- `apps/api/src/ai/ai.module.ts` — exportar `AiService`.
- `apps/api/src/adventure/adventure.module.ts` — importar `AiModule`.
- `apps/api/src/adventure/adventure.service.ts` — injetar `AiService`; gerar a abertura com fallback em `createForCharacter`.
- `apps/api/src/adventure/adventure.service.test.ts` — fake de `AiService`; casos de fallback e de caminho IA.
- `apps/api/prisma/seed.ts` — `openingNarration` por classe; passa a ser a semente da geração e o fallback estático.
- `docs/sdlc/01-requisitos/US-28-aventura-inicial-baseada-na-classe.md` — story base; esta US refina a fonte do texto de abertura e a qualidade da narração.
