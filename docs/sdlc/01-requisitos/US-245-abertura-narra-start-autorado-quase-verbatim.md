# US-245 — Abertura narra o `start` autorado quase verbatim, para de recompor uma cena nova por cima dele

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada (16/09/2026) — QA manual/bake-off (último critério) fica pro bake-off da US-17, mesmo precedente da US-168
**Depende de:** nenhuma — `buildOpeningInstruction`/`generateOpeningNarration`/`generateAdventureAuthoring` já existem; é reescrita de instrução na chamada existente, não peça nova.
**Relacionado:** [US-168](./US-168-abertura-narra-gancho-fixo-nao-aventura-gerada.md) (`mainQuest` domina `hookSeed` quando presente — premissa que esta story mantém) · [US-172](./US-172-abertura-gerada-nao-copia-gancho-fixo.md)/[US-180](./US-180-abertura-ignora-vinculos-do-personagem.md)/[US-194](./US-194-abertura-e-encontro-1-competem-como-cena-inicial.md) (as três investiram em `start` como beat a **recompor** por uma chamada de IA dedicada à abertura — arquitetura toda substituída pela inversão mundo-primeiro antes de qualquer uma delas ser revisitada; esta story é a revisita que faltou) · [US-232](./US-232-schema-cresce-e-prompt-de-autoria-call-unico.md) (a inversão — `start` passa a nascer como prosa autorada na CHAMADA 1 única, não mais composta por código nem gerada por chamada própria) · [US-241](./US-241-summary-formula-lgmrd-macguffin.md) (disciplina de tradução na autoria — por que `start` já nasce no idioma-alvo hoje)
**Criada em:** 2026-09-16 — a pedido da mantenedora: a abertura deve ser baseada no texto de `start` do JSON que `generateAdventure` já produz, em vez de tratá-lo como inspiração solta para uma cena nova.

---

## História

> **Como** jogadora que acabou de gerar uma aventura,
> **quero** que a primeira cena narrada pelo Mestre seja o texto do gancho (`start`) que o motor já escreveu para esta aventura especificamente — não uma cena nova que o Mestre inventa por cima dele —,
> **para que** a abertura que eu leio seja de fato a que o motor autorou (nomes, fatos e gancho incluídos), sem uma segunda chamada de IA arriscando divergir do que já foi decidido.

---

## Contexto e motivação

### O que `start` é hoje (não é mais o que as stories antigas descrevem)

`AUTHORING_SCHEMA.start` ([ai.service.ts:170](../../../apps/api/src/ai/ai.service.ts)):

```
start: z.string().min(1).describe('SÓ o gancho — a última parte da Story ("O gancho: …")')
```

É prosa de verdade, escrita pela ÚNICA chamada de autoria mundo-primeiro (`generateAdventureAuthoring`, US-232) — não mais o `hookSeed` fixo por classe (aposentado pela US-172) nem o briefing rotulado por código (`Location:`/`Situation:`/`Scene type:`/`Present:`, US-194 — ver abaixo). `buildAuthoringSystem` ([ai.service.ts:180-214](../../../apps/api/src/ai/ai.service.ts)) manda responder **sempre no idioma-alvo** (linha 204) e aplica a mesma barra de qualidade de prosa (`CRAFT_CORE_SECTION`/`NPC_VOICE_BULLET`/`ONOMASTICS_SECTION`, linha 212) e a mesma disciplina de tábula rasa (nenhum NPC já conhece o personagem, nenhum evento anterior pressuposto) que `world`/`story`/`locations`/`encounters`. `start` nasce, hoje, já como um parágrafo de gancho bem escrito, com nomes canônicos deste mundo específico, no idioma certo — não uma semente crua a ser "traduzida" em outra cena.

`AdventureService.generateAdventure` ([adventure.service.ts:204-215](../../../apps/api/src/adventure/adventure.service.ts)) grava esse valor direto: `start: authored.start` ([adventure.service.ts:346](../../../apps/api/src/adventure/adventure.service.ts)) — sem transformação de código.

### O que a abertura faz com esse texto hoje

`finalizeGeneratedAdventure` monta `mainQuest = \`${generated.summary}\n${generated.start}\`` ([adventure.service.ts:641](../../../apps/api/src/adventure/adventure.service.ts)) e passa pra `generateOpeningNarration` ([adventure.service.ts:647-673](../../../apps/api/src/adventure/adventure.service.ts)), que injeta no prompt via `buildOpeningInstruction` ([ai.service.ts:1403](../../../apps/api/src/ai/ai.service.ts)). A instrução atual, ramo `mainQuest` presente ([dm-system.ts:708-727](../../../packages/ai-engine/src/prompts/dm-system.ts)):

> "Use this as the spark for the scene — it is the opening briefing generated for this character. **Compose the opening scene FROM it**, matching the Narrative craft bar; **do NOT quote it verbatim**"
> "**Aim for at least 2 of these 3 appeals**, grounded only in what the spark above already gives you, never a new element: reward..., heroism..., discovery..."

Ou seja: uma chamada de IA já escreveu um gancho bem trabalhado (`start`), com nomes e fatos deste mundo — e a segunda chamada (`generateOpeningNarration`) é instruída a **não usar esse texto diretamente**, e sim inventar uma cena nova "a partir dele" como inspiração, proibida de citá-lo. Duas autorias sobre a mesma cena, a segunda decidida a se afastar da primeira. O risco óbvio é divergência: a "cena real" que a jogadora lê pode contradizer ou diluir o gancho que o motor decidiu ser o certo para esta aventura.

### Regra morta encontrada durante a investigação: a ramificação por "Scene type"

O mesmo trecho de `buildOpeningInstruction` (linha 719) ainda ramifica a abertura por um rótulo `Scene type:` supostamente presente no `mainQuest`:

> "Match the pace to the **'Scene type' named in the spark above, when present**: combat — the action already started...; skill — the obstacle already blocks the way...; social — someone has already addressed the character..."

Esse rótulo (`Location:`/`Situation:`/`Scene type:`/`Present:`) era o formato do briefing que `composeStartBriefing` produzia (US-194) — função que **não existe mais no repo**: `grep -r composeStartBriefing apps/api/src` só encontra um comentário obsoleto em [`next-encounter-hint.ts:9-10`](../../../apps/api/src/adventure-generation/next-encounter-hint.ts), também desatualizado, citando uma função apagada. A inversão mundo-primeiro (US-232/US-239, 2026-09-09) substituiu toda aquela cadeia de 6 chamadas por uma única (`generateAdventureAuthoring`) sem jamais revisitar `buildOpeningInstruction` — ninguém errou, a instrução simplesmente ficou órfã do formato de dado que a motivou. `mainQuest` real hoje (`summary + "\n" + start`) é prosa corrida, sem rótulo nenhum — a condição "when present" nunca é verdadeira, em NENHUM dos dois ramos (`mainQuest` nem `hookSeed`, que também nunca carregou esse rótulo). É instrução morta, custando tokens de prompt sem efeito nenhum, nos dois ramos, desde a inversão.

**A cobertura de teste mascarava isso — parcialmente corrigido em sessão separada (2026-09-16).** `dm-system.test.ts:779-802` (`describe('buildOpeningInstruction — compõe a partir da aventura gerada, não renderiza beat pronto (US-194)')`) já teve o nome do `describe`, o comentário acima dele e a fixture reescritos: a fixture agora é prosa corrida realista (`'Um culto celebra à beira d\'água na Enseada Cinzenta.\nO gancho: Marta corre até você, sangrando, e implora que impeça o ritual antes da lua cheia.'`), sem os rótulos `Location:`/`Scene type:`/`Present:` da US-194 nem menção a `composeStartBriefing`. O que segue stale são as ASSERÇÕES dentro dos três `it()` (linhas 782-801): elas ainda checam o comportamento ATUAL de `buildOpeningInstruction` — `Compose the opening scene`, os três ramos `combat`/`skill`/`social` de Scene type, e `at least 2 of these 3 appeals` — ou seja, testam exatamente o que esta story precisa mudar. Essas três `it()` são o alvo da reescrita, não a fixture.

### Por que a solução atual não basta

`start` já É a decisão do motor sobre como a aventura começa — inclui nomes, local e o gancho, escritos com a mesma barra de qualidade que o resto do artefato. Pedir para a segunda chamada "compor uma cena nova, não citando" duplica trabalho de autoria (mais uma chamada de IA reinventando o que a primeira já resolveu bem) e abre a porta pra divergência (nomes trocados, tom diferente, um fato do gancho contradito). O que falta na cena que a jogadora lê não é invenção — `start` sozinho é só 1-2 parágrafos de gancho, sem opções de ação, sem voz de NPC em diálogo, sem a formatação de turno jogável — é **encenação**: transformar o gancho já decidido em uma cena com ritmo, sensorialidade e as opções de ação ao final, sem reabrir o que já foi decidido.

---

## A proposta

`buildOpeningInstruction`, no ramo `mainQuest` presente, para de pedir para **compor** uma cena nova "a partir" do texto (inspiração livre, citação proibida) e passa a pedir para **narrar/encenar** o texto de `mainQuest` de perto — preservar os nomes, fatos e o gancho que ele já estabelece, sem inventar elemento de enredo novo, elaborando só o necessário para virar uma cena jogável (abertura sensorial, ritmo, vozes de NPC, fechamento com as opções de ação). Citar ou parafrasear de perto o texto deixa de ser proibido — é o comportamento esperado.

O ramo `hookSeed` (fallback — sistema sem motor de geração, ex. Free) **não muda de comportamento**: `hookSeed` continua sendo o gancho fixo por classe, curto e sem a mesma barra de qualidade de prosa que `start` recebe na autoria — continua fazendo sentido pedir para o modelo compor/dramatizar livremente a partir dele, como a US-168 decidiu.

O trecho de ramificação por "Scene type" sai dos DOIS ramos — é código morto desde a inversão mundo-primeiro (US-232/US-239), não some por causa desta mudança de fidelidade.

---

## Escopo

### Dentro do escopo

- `buildOpeningInstruction` ([dm-system.ts:696](../../../packages/ai-engine/src/prompts/dm-system.ts)) ganha DOIS corpos de instrução distintos por ramo (hoje só a linha do `spark` é ramificada; o resto do template — in medias res, apelos, craft bar, onomástica, restrição de saída — é compartilhado):
  - **Ramo `mainQuest` presente:** instrui narrar/expandir o texto recebido preservando nomes/fatos/gancho, sem inventar elemento de enredo novo além do que ele já contém. "Do NOT quote it verbatim" sai — citação/paráfrase próxima passa a ser o objetivo, não o que se evita. "Aim for at least 2 of these 3 appeals..." (US-182) sai deste ramo — os apelos já são responsabilidade da autoria que escreveu `start` (mesma barra de qualidade, `CRAFT_CORE_SECTION`), não algo pra uma segunda chamada inventar por cima.
  - **Ramo `hookSeed` (sem `mainQuest`):** comportamento de hoje intocado — "compor a partir do gancho", "do NOT quote it verbatim", "aim for at least 2 of these 3 appeals" continuam.
- O trecho morto de ramificação por `Scene type` (`combat — the action already started...`/`skill — ...`/`social — ...`) sai dos DOIS ramos — nenhuma fixture real (produção) carrega esse rótulo desde que `composeStartBriefing` (US-194) foi removido; confirmado por grep no repo inteiro.
- Narrative craft bar (abrir pelos sentidos, nomear coisas concretas, raça/classe como lente, NPC com voz e interesse, 3-5 parágrafos, fechar endereçando o personagem + opções) e a regra de Onomástica permanecem nos DOIS ramos, sem mudança de forma — a mudança é só na relação com o texto-semente (citar de perto vs. inventar por cima), não na qualidade exigida da prosa final.
- A ressalva de idioma ("The seed below may be written in another language") passa a valer só quando o `spark` é `hookSeed` — no ramo `mainQuest`, `start` já nasce no idioma-alvo pela autoria ([ai.service.ts:204](../../../apps/api/src/ai/ai.service.ts)), a ressalva não descreve mais a realidade desse ramo.
- `dm-system.test.ts`: a suíte `describe('buildOpeningInstruction — compõe a partir da aventura gerada, não renderiza beat pronto (US-194)')` (linhas 779-802) já tem nome e fixture corrigidos (fixture é prosa corrida realista, sem rótulos `Location:`/`Scene type:`/`Present:` — feito em sessão separada, 2026-09-16). O que falta é reescrever as três `it()` de dentro dela (linhas 782-801), que hoje ainda afirmam o comportamento ATUAL (`Compose the opening scene`, os três ramos de Scene type, `at least 2 of these 3 appeals`): trocar por citação/paráfrase próxima permitida (não mais proibida), ausência da instrução de apelos forçados neste ramo, ausência do trecho de `Scene type` nos dois ramos, e confirmação de que o ramo `hookSeed` mantém "do NOT quote it verbatim" + apelos intactos.
- `pnpm eval` roda e passa (mudança em prompt de narração do DM Agent — regra do projeto, `AGENTS.md`).

### Fora do escopo

- Mudar `AUTHORING_SCHEMA.start` ou o prompt de autoria (`buildAuthoringSystem`/`buildAuthoringPrompt`, [ai.service.ts:114-276](../../../apps/api/src/ai/ai.service.ts)) — o texto de `start` já sai bem escrito; esta story muda como ele é CONSUMIDO na abertura, não como é produzido.
- ~~Corrigir `nextUnrevealedEncounterLocation`~~ **Resolvido em sessão separada (2026-09-16), fora desta story** — [next-encounter-hint.ts](../../../apps/api/src/adventure-generation/next-encounter-hint.ts): o pulo incondicional do encontro 1 foi removido (o comentário que citava `composeStartBriefing`, função apagada, pressupunha vínculo estrutural entre `start` e o local do encontro 1 que a autoria mundo-primeiro não garante mais). `revelado` volta a ser o único critério de exclusão; comentário reescrito explicando a origem do bug (US-194 → US-232); testes em `next-encounter-hint.test.ts` invertidos pra cobrir o comportamento novo (encontro 1 conta como qualquer outro). Era bug adjacente independente de como `buildOpeningInstruction` consome o texto — não mudou nada do escopo desta story.
- ~~Corrigir JSDoc/comentário/fixture stale citando `composeStartBriefing`~~ **Já feito (2026-09-16, sessão separada — esta)**: o JSDoc de `buildOpeningInstruction` ([dm-system.ts:678-695](../../../packages/ai-engine/src/prompts/dm-system.ts)) e o comentário inline antes de `spark` ([dm-system.ts:702-707](../../../packages/ai-engine/src/prompts/dm-system.ts)) — ambos citavam `composeStartBriefing` (US-194, função apagada na US-232) como a função que compõe o briefing rotulado (`Location:`/`Situation:`/`Scene type:`/`Present:`) consumido pela instrução — foram reescritos pra descrever a realidade atual: `mainQuest` chega como prosa livre (`generated.summary + '\n' + generated.start`, onde `start` é `authored.start`, saído da chamada única de autoria). O mesmo passou no teste: o nome do `describe` e a fixture em `dm-system.test.ts:779-802` também já foram trocados por uma versão realista (prosa corrida, sem rótulos). É correção de comentário/documentação/fixture stale, não da instrução em si — o CORPO do prompt (linhas 708-727: "do NOT quote it verbatim", a ramificação morta por "Scene type", os apelos forçados) permanece intocado, e as três `it()` dentro daquele `describe` ainda afirmam esse comportamento atual; nenhum critério de aceite acima é satisfeito por essa mudança — a reescrita das asserções segue precisando do trabalho previsto no Escopo acima.
- Reforçar a regra de Onomástica em `buildOpeningInstruction` para citar explicitamente nomes já existentes em `entities`/`world`/`npcs` (hoje ela só diz "nome ORIGINAL... pick the register on purpose", como se sempre inventasse do zero) — o ledger (`entitiesSection`, `buildTurnStateBlock`) já carrega os nomes canônicos autorados, e a mudança desta story (narrar `start` de perto) reduz bastante o espaço pra nome novo aparecer na abertura, mas não elimina o risco de colisão por completo. Se o eval acusar nome divergente, vira story própria.
- Alterar a assinatura de `generateOpeningNarration`/`buildTurnStateBlock`/a chamada em `finalizeGeneratedAdventure` ([adventure.service.ts:647-673](../../../apps/api/src/adventure/adventure.service.ts)) — nenhum parâmetro novo, só o TEXTO que `buildOpeningInstruction` devolve muda.
- Eliminar a chamada de IA da abertura (virar template puro sem LLM) — fora de escopo; `generateOpeningNarration` ainda precisa montar a cena jogável (voz de NPC, ritmo, opções de ação ao final) a partir do gancho, só que sem reinventá-lo.

---

## Critérios de aceite

- [x] Ramo `mainQuest` presente: a instrução NÃO contém "do NOT quote it verbatim" nem variante equivalente que desencoraje citar o texto de perto.
- [x] Ramo `mainQuest` presente: a instrução pede explicitamente para narrar/expandir o texto de `mainQuest`, preservando nomes, fatos e o gancho que ele já estabelece — sem inventar elemento de enredo novo além do que `mainQuest` já contém.
- [x] Ramo `mainQuest` presente: a instrução NÃO contém mais "at least 2 of these 3 appeals" (US-182 sai deste ramo).
- [x] Ramo `hookSeed` (sem `mainQuest`): comportamento de hoje intacto — "do NOT quote it verbatim" e "at least 2 of these 3 appeals" continuam presentes; nenhum teste existente desse ramo quebra.
- [x] Nos DOIS ramos: o trecho de ramificação por `Scene type` (`combat — the action already started`/`skill — the obstacle already blocks the way`/`social — someone has already addressed the character`) sai do prompt.
- [x] Narrative craft bar e a regra de Onomástica permanecem presentes nos DOIS ramos, sem mudança de texto.
- [x] `dm-system.test.ts`: as três `it()` da suíte da US-194 (`describe` e fixture já realistas, linhas 779-802) ganham asserções novas cobrindo os pontos acima — não testam mais `Compose the opening scene`/Scene type/apelos como comportamento esperado do ramo `mainQuest`.
- [x] `pnpm typecheck` e `pnpm test` passam.
- [x] `pnpm eval` passa (mudança em prompt do DM Agent, `AGENTS.md`).
- [ ] QA manual / bake-off (fora de teste unitário mockado, mesmo precedente da US-168 §Critérios de aceite): confirmar que a narração de fato honra o gancho autorado de perto, não só que o PROMPT pede isso.

---

## Notas de implementação

- Arquivo principal: [packages/ai-engine/src/prompts/dm-system.ts](../../../packages/ai-engine/src/prompts/dm-system.ts) → `buildOpeningInstruction` (linha 696). Hoje só a variável `spark` (linhas 708-712) é ramificada por `mainQuest ? ... : ...`; esta story estende a ramificação pro corpo de instrução inteiro (citação/apelos), mantendo fora do `if` o que é comum aos dois ramos (idioma-alvo, craft bar, onomástica, restrição de saída).
- O trecho a apagar (`Scene type`) é código morto comprovado: a única função que um dia produziu o rótulo (`composeStartBriefing`, US-194) não existe mais em `apps/api/src` (grep vazio). O comentário obsoleto que ainda citava essa função em [`next-encounter-hint.ts:9-13`](../../../apps/api/src/adventure-generation/next-encounter-hint.ts) já foi reescrito em sessão separada (2026-09-16, ver *Fora do escopo*) — não é mais a única referência viva a `composeStartBriefing` no repo, mas a busca acima (`grep -r composeStartBriefing apps/api/src`) segue valendo como prova de que a função em si não existe.
- `mainQuest` real, hoje, é sempre `\`${generated.summary}\n${generated.start}\`` ([adventure.service.ts:641](../../../apps/api/src/adventure/adventure.service.ts)) — duas linhas de prosa corrida. A fixture de `dm-system.test.ts:780` já segue essa forma; não precisa trocar, só as asserções que a usam.
- Mudança em prompt do DM Agent — rodar `pnpm eval` depois (custa chamadas reais de LLM, `AGENTS.md`).

---

## Questões em aberto

1. A regra de Onomástica em `buildOpeningInstruction` deveria citar explicitamente `entities`/`world`/`npcs` como fonte de nomes preferencial (em vez de instruir "nome ORIGINAL" como se inventasse do zero)? Deixado fora do escopo (ver *Fora do escopo*) — decidir depois de ver se a narração, já mais próxima de `start`, ainda erra nome com frequência que justifique a mudança.
2. Se o motor de geração um dia alimentar também o sistema Free (hoje só `hookSeed` fixo por classe), o ramo `hookSeed` precisaria da mesma revisão desta story? Não decidido — não é um caso real hoje.

---

## Referências no código

- [packages/ai-engine/src/prompts/dm-system.ts:696-727](../../../packages/ai-engine/src/prompts/dm-system.ts) — `buildOpeningInstruction`, a função a reescrever.
- [packages/ai-engine/src/prompts/dm-system.test.ts:779-802](../../../packages/ai-engine/src/prompts/dm-system.test.ts) — suíte da US-194; `describe`/fixture já realistas, as três `it()` (782-801) a reescrever.
- [apps/api/src/ai/ai.service.ts:114-172](../../../apps/api/src/ai/ai.service.ts) — `AUTHORING_SCHEMA`, `start` descrito como "SÓ o gancho — a última parte da Story".
- [apps/api/src/ai/ai.service.ts:180-214](../../../apps/api/src/ai/ai.service.ts) — `buildAuthoringSystem`, prova que `start` já nasce no idioma-alvo e com a barra de qualidade de prosa.
- [apps/api/src/ai/ai.service.ts:1403](../../../apps/api/src/ai/ai.service.ts) — chamada a `buildOpeningInstruction` dentro de `generateOpeningNarration`.
- [apps/api/src/adventure/adventure.service.ts:204-215](../../../apps/api/src/adventure/adventure.service.ts) — `generateAdventureAuthoring`, a chamada única (US-232) que produz `authored.start`.
- [apps/api/src/adventure/adventure.service.ts:346](../../../apps/api/src/adventure/adventure.service.ts) — `start: authored.start`, sem transformação de código.
- [apps/api/src/adventure/adventure.service.ts:641-673](../../../apps/api/src/adventure/adventure.service.ts) — `finalizeGeneratedAdventure`, monta `mainQuest` e chama `generateOpeningNarration`.
- [apps/api/src/adventure-generation/next-encounter-hint.ts](../../../apps/api/src/adventure-generation/next-encounter-hint.ts) — comentário que citava `composeStartBriefing` (função apagada) já corrigido em sessão separada (2026-09-16); staleness adjacente, sempre fora do escopo desta story.
- [US-232](./US-232-schema-cresce-e-prompt-de-autoria-call-unico.md) — a inversão mundo-primeiro que tornou `start` prosa autorada em vez de briefing composto por código.
- [US-194](./US-194-abertura-e-encontro-1-competem-como-cena-inicial.md) — arquitetura anterior (`composeStartBriefing`, rótulos `Location:`/`Scene type:`), substituída pela inversão antes de qualquer revisita.
- [backlog-motor-de-geracao-de-aventuras.md](./backlog-motor-de-geracao-de-aventuras.md) — o backlog da inversão mundo-primeiro (MA-1…MA-9); nenhuma tarefa dele revisitou `buildOpeningInstruction`.
