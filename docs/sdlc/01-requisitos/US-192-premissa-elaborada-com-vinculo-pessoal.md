# US-192 — Premissa nasce de rolagem simples, sem elaboração nem vínculo pessoal

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** 🚧 Em progresso
**Depende de:** nenhuma — `rollContent`/`generateLocationsAndNpcs`/`generateClosing` já existem; esta story adiciona um passo novo e ajusta assinaturas existentes, não é peça de infraestrutura nova.
**Relacionado:** [US-146](./US-146-seed-deterministico-motor-aventura.md) (seed determinístico — a rolagem dos candidatos continua presa a ele) · [US-147](./US-147-rolagem-registro-conteudo.md) (rolagem/registro/conteúdo, dona de `rollContent` que esta story estende) · [US-149](./US-149-segredos-40-prompts-lgmrd.md) (molde mais próximo: rolagem bruta do LGMRD → IA veste de prosa informada por `background`) · [US-158](./US-158-locais-npcs-prosa-motor.md) (elenco original, ganhou `characterAnchors` no commit `32ec73d` desta mesma leva) · [US-180](./US-180-abertura-ignora-vinculos-do-personagem.md)/[US-183](./US-183-antagonista-ganha-conexao-pessoal-com-personagem.md) (as outras 3 chamadas que já ancoram em `characterAnchors`) · [Backlog — Motor de geração de aventuras one-shot §Ordem de geração](./backlog-motor-de-geracao-de-aventuras.md) (passo 1, "objetivo ← tabela de quests" — o que esta story substitui)
**Criada em:** 2026-08-23 — a pedido da mantenedora, aplicando a técnica do *Adventure Generator* do Shadowdark RPG (rolar múltiplos resultados e, para cada um, imaginar como os personagens são puxados DIRETAMENTE para a ação, escolhendo o que mais demanda ação) ao passo 1 do motor, que hoje aceita a primeira rolagem cega. Sequência direta dos commits `32ec73d`/`b753c0b` do mesmo dia (elenco original e fecho passaram a ancorar em `background.story`/`origin.adventuresAndAdvancement`) — a mantenedora notou que a PREMISSA que alimenta as duas continua sendo a única peça do motor sem esse vínculo.

---

## História

> **Como** jogadora que gera uma aventura nova,
> **quero** que a premissa (a ideia central da aventura) nasça de vários candidatos rolados e seja escolhida/elaborada considerando como a MINHA personagem fica sabendo do problema — usando `background.story` e `origin.adventuresAndAdvancement` quando existirem —,
> **para que** a aventura pare de abrir com uma linha de tabela em inglês sem relação nenhuma comigo, e a trama já nasça pessoal, não só a cena de abertura escrita por cima dela.

---

## Contexto e motivação

### O problema observado

`rollContent()` ([roll-content.ts:52-73](../../../apps/api/src/adventure-generation/roll-content.ts)) rola UMA linha da tabela `1d20quests` do LGMRD (20 linhas) e devolve crua: `premissa: String(questRow['item'])` ([roll-content.ts:63](../../../apps/api/src/adventure-generation/roll-content.ts)). É uma frase curta em inglês do livro-fonte (ex. `"Open a gate"`, `"Kill a villain"`) — nunca traduzida, nunca elaborada, nunca vê a ficha do personagem.

Essa string crua não fica só a serviço de outras chamadas de IA — ela É o que a jogadora acaba lendo. `adventure.service.ts:357` grava `summary: content.premissa` no artefato (`GeneratedAdventure.summary`, [adventure-generation.ts:88](../../../packages/shared/src/types/adventure-generation.ts)); esse mesmo `summary` vira `Adventure.title` ([adventure.service.ts:524](../../../apps/api/src/adventure/adventure.service.ts)), `Quest.title` da quest principal ([adventure.service.ts:557](../../../apps/api/src/adventure/adventure.service.ts)) e a primeira linha de `mainQuest` ([adventure.service.ts:451](../../../apps/api/src/adventure/adventure.service.ts)) — o bloco que `buildTurnStateBlock` expõe ao Mestre TODO turno. Ou seja: o título da aventura, o título da quest principal e o contexto que o Mestre relê a cada turno carregam, hoje, uma linha de tabela em inglês — quebra a disciplina "saída sempre no idioma da mesa" (US-97/US-178) e nunca se liga à ficha.

As duas stories mais recentes (commits `32ec73d` e `b753c0b`, mesmo dia) já fecharam o vínculo pessoal nas 4 chamadas de IA que escrevem a aventura (`generateLocationsAndNpcs`, `generateSecrets`, `generateAntagonist`, `generateClosing`, `generateOpeningBeat`) via `characterAnchors()` ([ai.service.ts:237-245](../../../apps/api/src/ai/ai.service.ts)). Mas a fonte da própria `premissa` que alimenta todas elas continua sendo o passo 1 do backlog ("objetivo ← tabela de quests", [backlog-motor-de-geracao-de-aventuras.md:323](./backlog-motor-de-geracao-de-aventuras.md)) — puramente determinístico, sem `characterAnchors` nenhum. As 5 chamadas do motor agora ancoram no vínculo pessoal EXCETO a própria ideia central que recebem como insumo comum.

### Por que a solução atual não basta

US-146 (seed determinístico) e US-147 (rolagem/registro/conteúdo) resolveram a metade certa do problema: a rolagem de CONTEÚDO precisa ser determinística e nunca decidida pelo modelo ("sorteio que o modelo faz não é sorteio", texto do backlog). Mas isso nunca implicou que a SAÍDA da rolagem tivesse que ser usada crua — `generateLocationsAndNpcs` (US-158) e `generateSecrets` (US-149) já mostram o padrão certo: rolar dados brutos determinísticos, depois vestir de prosa via IA. `premissa` é a única peça do "Ordem de geração" que nunca passou por essa segunda etapa — nasce e morre como a mesma linha de tabela, do dado até os 3 lugares onde é exibida à jogadora.

### A proposta

Em vez de uma rolagem = uma premissa, `rollContent` passa a rolar 5 candidatos (mesmo padrão de `rollPatronsAndNpcs`, sub-seed por roll). Uma chamada de IA nova, ANTES de `generateLocationsAndNpcs` (passo 1, antes do passo 2 do backlog), recebe os 5 candidatos + `background.story`/`origin.adventuresAndAdvancement` (via `characterAnchors`, reusado) e — inspirada na técnica do *Adventure Generator* do Shadowdark RPG (rolar N, imaginar como os personagens ficam sabendo do problema de forma direta, escolher a situação que mais demanda ação) — escolhe e escreve a premissa final: 1-2 frases, no locale da jogadora, com a personagem já puxada para dentro do problema.

---

## Escopo

### Dentro do escopo

- `RolledAdventureContent.premissa: string` ([roll-content.ts:10](../../../apps/api/src/adventure-generation/roll-content.ts)) vira `premissaCandidates: string[]` (5 itens) — mesmo padrão de `RolledPatronOrNpc[]`/`rollPatronsAndNpcs` ([roll-content.ts:37-42](../../../apps/api/src/adventure-generation/roll-content.ts)): sub-seed próprio por roll (`tableSeed(characterId, order, `premissa-${i+1}`, attempt)`), mesma tabela `1d20quests` já extraída — nenhum conteúdo/licença nova.
- Nova constante `PREMISSA_ROLL_COUNT = 5` (ao lado de `NPC_ROLL_COUNT`, [roll-content.ts:20](../../../apps/api/src/adventure-generation/roll-content.ts)) — 5 é o número do artigo-fonte, não arbitrário.
- Nova função `rollPremissaCandidates` (mesma forma de `rollPatronsAndNpcs`), chamada de dentro de `rollContent`.
- Nova chamada em `AiService`: `generatePremissa(params: { candidates: string[]; complicacao: { condition: string; description: string; origin: string }; registry: AdventureRegistry; background?: CharacterBackground; origin?: { adventuresAndAdvancement?: string }; locale?: Locale }): Promise<{ premissa: string }>` — mesmo molde das outras 5 chamadas do motor (`generateObject`, `primaryModel`, `ENGINE_PROVIDER_OPTIONS`, `localeNameForPrompt`, `CRAFT_CORE_SECTION`, nunca captura erro). Reusa `characterAnchors(params)` ([ai.service.ts:237-245](../../../apps/api/src/ai/ai.service.ts)) — não reimplementa a combinação story+adventuresAndAdvancement. `complicacao` (já rolada em `content.complicacao`, mesmo tipo usado em `generateClosing`/`generateOpeningBeat`) entra AQUI pela primeira vez — sem ela, a premissa elaborada pode contradizer ou ignorar a tensão de fundo que já foi rolada para a mesma aventura (achado de revisão: candidato escolhido e complicação independente podem destoar; antes disso era imperceptível porque a premissa crua era só uma palavra-chave genérica, depois de elaborada a incoerência fica visível). `registry` (`tone`/`setting`/`areaType`, já disponível em `rollAdventure` antes desta chamada) entra no `system` pelo mesmo motivo que entra em `generateAntagonist`/`generateClosing`/`generateOpeningBeat`/`generateLocationsAndNpcs` — sem ele a premissa nasceria surda ao tom já sorteado e poderia destoar das 4 chamadas seguintes, que todas ancoram nele (achado de revisão, decidido explicitamente nesta story: risco simétrico ao de `complicacao` acima, mesma mitigação).
- `system` de `generatePremissa` instrui a técnica do artigo: para cada um dos 5 candidatos, considerar como a personagem ficaria sabendo do problema, favorecendo a situação que a envolve mais DIRETAMENTE e que mais demanda ação; com vínculo pessoal presente (`characterAnchors`), preferir a situação que se encaixa nele; e escrever a premissa de um jeito que não contradiga a `complicacao` recebida (não precisa citá-la — só não destoar).
- `generateAdventure` ([adventure.service.ts:207](../../../apps/api/src/adventure/adventure.service.ts)) chama `generatePremissa` logo depois de `rollAdventure` ([adventure.service.ts:215](../../../apps/api/src/adventure/adventure.service.ts)) e antes de `generateLocationsAndNpcs` ([adventure.service.ts:217](../../../apps/api/src/adventure/adventure.service.ts)) — sequencial, fora do `Promise.all` existente (linha 303): locais/NPCs/segredos/antagonista dependem do resultado. Falha aqui é a mais BARATA do pipeline: acontece antes de qualquer uma das outras 4 chamadas rodar, então um reseed do gate (US-150) desperdiça zero trabalho de LLM a mais do que já desperdiçaria sem esta story.
- `generateLocationsAndNpcs` ganha `premissa: string` como parâmetro explícito (mesmo padrão das outras 4 chamadas) — hoje lê `rolled.premissa` de dentro de `buildLocationsAndNpcsPrompt` ([ai.service.ts:153-165](../../../apps/api/src/ai/ai.service.ts), interpolação na linha 158); passa a receber o valor já elaborado, não o `rolled` cru.
- Todo `content.premissa` hoje passado a `generateAntagonist`/`generateClosing`/`generateOpeningBeat` passa a ser a variável local `premissa` (o elaborado), não `content.premissa` — que deixa de existir. (`generateSecrets` nunca recebeu `premissa` — nem no schema de params nem na chamada em `adventure.service.ts:225-233` — nada a mudar ali.)
- `summary: content.premissa` ([adventure.service.ts:357](../../../apps/api/src/adventure/adventure.service.ts)) vira `summary: premissa` — corrige de graça o título em inglês cru em `Adventure.title`/`Quest.title`/`mainQuest`.
- **Atualizar o fixture pinado de [roll-content.test.ts:14-30](../../../apps/api/src/adventure-generation/roll-content.test.ts)** (`'seleção de linhas pinada para (char-1, 1)'`) — esse teste é DESENHADO pra quebrar quando o algoritmo de rolagem muda (mesmo espírito do hash da US-146: pegar drift, não confirmar drift). Trocar `premissa: 'Open a gate'` pelos 5 novos valores de `premissaCandidates`, conferidos manualmente contra `scripts/lazygm/lgmrd-tables.json` (tabela `1d20quests`, 20 linhas) — nunca só `-u` cego sem olhar se os 5 valores batem com o que os novos sub-seeds (`premissa-1`..`premissa-5`) realmente produzem.
- Fixture `rolled = { premissa: 'Open a gate', ... }` no topo do describe `AiService.generateLocationsAndNpcs` em [ai.service.test.ts](../../../apps/api/src/ai/ai.service.test.ts) — único outro ponto fora de `roll-content.ts`/`roll-content.test.ts` que constrói o shape `RolledAdventureContent` literal; vira `premissaCandidates: [...]`. Os demais ~50 usos de `premissa:` nesse arquivo são o parâmetro `premissa: string` já existente em `generateSecrets`/`generateAntagonist`/`generateClosing`/`generateOpeningBeat` — não mudam de shape, não tocar.
- Teste de regressão: (a) fixture com `background.story`/`origin.adventuresAndAdvancement` confirma que ao menos um chega ao `system`/`prompt` de `generatePremissa` (mesmo padrão dos testes de `characterAnchors` já existentes nas outras 5 chamadas); (b) os 5 candidatos chegam ao `prompt`; (c) `complicacao` chega ao `prompt`/`system` (mesmo padrão de `generateClosing`); (d) sem background/origin, cai no fallback genérico; (e) `rollPremissaCandidates` com o mesmo seed produz sempre os mesmos 5 candidatos (mesmo padrão de determinismo de `adventure-seed.test.ts`); (f) `locale` entra no `system` como instrução de idioma-alvo, ausente cai no default pt-BR (mesmo padrão US-178 das outras 5 chamadas — mitiga o risco de a premissa elaborada vazar em inglês pras 4 chamadas seguintes, que a interpolam como dado, não como algo que re-traduzem).
- `pnpm eval` roda e passa (mudança em prompt de geração — regra do projeto, `AGENTS.md`).

### Fora do escopo

- **Importar a tabela própria do Shadowdark RPG** (a imagem do artigo-fonte) — usa-se a TÉCNICA (rolar N, escolher pela ligação direta com a personagem), não o conteúdo. `1d20quests` do LGMRD, já extraída/licenciada pela sync existente, continua sendo a fonte de dados; trocar de fonte é decisão de conteúdo separada, fora desta story.
- **Expor à jogadora QUAL dos 5 candidatos foi escolhido**, ou as situações imaginadas — só a premissa final elaborada sai do schema, mesma disciplina de `generateAntagonist`/`generateClosing` (que também não expõem alternativas descartadas).
- **Deduplicar candidatos repetidos.** `1d20quests` tem 20 linhas; `rollPatronsAndNpcs` já rola 7 de uma tabela de 20 linhas sem dedup (precedente aceito no código atual) — 5 de 20 aqui segue o mesmo padrão. Se a IA notoriamente repetir o mesmo candidato com frequência alta o bastante pra virar problema real, dedup vira story própria com dado de produção, não suposição.
- **Tornar `premissa` escolhível manualmente pela jogadora** (como `tone`/`setting`/`areaType` já são via `AdventureRegistryOverrides`, US-156) — não pedido; overrides hoje cobrem só REGISTRO, não conteúdo.
- **Mudar a ordem dos outros passos do motor** (locais, NPCs, segredos, antagonista, encontros, fecho) — só o passo 1 muda de forma; a lista do backlog continua valendo depois dele.

---

## Modelo de dados proposto

```ts
// roll-content.ts
export interface RolledAdventureContent {
  premissaCandidates: string[]  // era `premissa: string`
  locais: string
  monumentos: string
  complicacao: { condition: string; description: string; origin: string }
  patronsandnpcs: RolledPatronOrNpc[]
}
```

| Campo | Tipo | Descrição |
|---|---|---|
| `premissaCandidates` | `string[]` (5) | Linhas cruas de `1d20quests`, uma por sub-seed `premissa-1`..`premissa-5`. Nunca exibido à jogadora — insumo de `generatePremissa`. |

**Persistência:** nenhuma nova — `premissaCandidates` é intermediário (como `patronsandnpcs` já é hoje); só a `premissa` elaborada final entra em `GeneratedAdventure.summary`, sem mudança de schema (`adventure-generation.ts` não muda).

---

## Critérios de aceite

- [x] `rollContent` rola 5 candidatos de `1d20quests`, sub-seed próprio por roll, determinístico (mesmo par `characterId`+`order`+`attempt` → mesmos 5 candidatos sempre).
- [x] `generatePremissa` recebe os 5 candidatos + `background`/`origin` opcionais + `locale`, devolve `{ premissa: string }` não vazio.
- [x] Com `background.story` e/ou `origin.adventuresAndAdvancement` presentes, o `system`/`prompt` de `generatePremissa` inclui a instrução de vínculo (via `characterAnchors`) — mesmo padrão das outras 5 chamadas do motor.
- [x] `system` de `generatePremissa` instrui explicitamente a técnica: considerar como a personagem fica sabendo do problema para cada candidato, preferindo a situação mais direta/urgente.
- [x] `complicacao` chega ao `prompt`/`system` de `generatePremissa` — a premissa elaborada não recebe instrução de contradizê-la (achado de revisão: candidato + complicação independentes podiam destoar de forma mais visível depois de elaborados).
- [x] `locale` entra no `system` de `generatePremissa` como instrução de idioma-alvo (mesmo padrão US-178 das outras 5 chamadas) — sem isso, uma falha de idioma nesta chamada se propaga como dado cru pras 4 chamadas seguintes, que só interpolam o texto recebido.
- [x] `registry` (`tone`/`setting`/`areaType`) entra no `system` de `generatePremissa` — mesmo padrão de `generateAntagonist`/`generateClosing`/`generateOpeningBeat`/`generateLocationsAndNpcs`, decidido nesta story (ver Notas de implementação).
- [x] `generateAdventure` chama `generatePremissa` antes de `generateLocationsAndNpcs`, e o resultado (não `content.premissa`) é o que chega às 4 chamadas subsequentes que consomem `premissa` (`generateLocationsAndNpcs`/`generateAntagonist`/`generateClosing`/`generateOpeningBeat` — `generateSecrets` nunca recebeu `premissa`, ver Escopo).
- [x] `GeneratedAdventure.summary` (e por consequência `Adventure.title`/`Quest.title`/`mainQuest`) carrega a premissa ELABORADA, no locale da jogadora — não a linha crua da tabela.
- [x] [roll-content.test.ts:14-30](../../../apps/api/src/adventure-generation/roll-content.test.ts) (fixture pinado) atualizado com os 5 novos candidatos, conferidos contra a tabela real — nunca `-u` sem checar.
- [x] `pnpm typecheck` e `pnpm test` passam.
- [x] `pnpm eval` passa.
- [x] **Eval / teste de regressão:** fixture com `background.story` — `system`/`prompt` de `generatePremissa` cita esse texto; fixture sem background/origin cai no fallback genérico, nunca campo vazio.
- [ ] **Nota no PR/commit desta story (não critério de teste, mas obrigatório):** registra explicitamente que a mudança do sub-seed (`'premissa'` → `'premissa-1'`..`'premissa-5'`) quebra a reprodutibilidade byte a byte (US-146) de aventuras já geradas ANTES desta story — mesmo `characterId`+`order` passa a produzir candidatos diferentes dos que produzia antes. Não é regressão de bug, é descontinuidade esperada de mudar o algoritmo de rolagem; só não pode ficar implícita.

---

## Notas de implementação

- Reusar `characterAnchors()` ([ai.service.ts:237-245](../../../apps/api/src/ai/ai.service.ts)) tal como está — já combina `background.story`+`origin.adventuresAndAdvancement`; não duplicar a lista.
- Nomear a nova chamada `generatePremissa` (não `resolvePremissa`) — `resolveX` no código é reservado a função PURA/síncrona (`resolveAdventuresAndAdvancement`, `resolveHook`); esta é uma chamada de IA, mesmo prefixo das outras 5 (`generateX`).
- `generateLocationsAndNpcs` deixa de receber `rolled: RolledAdventureContent` como único insumo de premissa — ganha `premissa: string` explícito, mesma forma das outras 4 chamadas. `buildLocationsAndNpcsPrompt` ([ai.service.ts:153-165](../../../apps/api/src/ai/ai.service.ts)) troca a leitura de `rolled.premissa` (linha 158) por um parâmetro `premissa` separado.
- Sequencial, não paralelo: `generatePremissa` roda ANTES do primeiro `await` de `generateLocationsAndNpcs` — soma uma chamada de IA a mais no caminho crítico (latência), diferente de `generateClosing`/`generateOpeningBeat`/`generateAntagonistLocationProse`, que já correm em `Promise.all` (linha 303) porque não dependem um do outro. Aqui a dependência é real (passo 1 antes do passo 2, backlog), não dá pra paralelizar.
- Schema minimalista (`{ premissa: string }`) — não expor os 5 candidatos nem as situações imaginadas no `object` de saída; isso é raciocínio interno instruído no `system`, mesma disciplina de `generateAntagonist` (não expõe alternativas descartadas).
- `generatePremissa` "nunca captura erro" — mesma disciplina de `generateSecrets`/`generateAntagonist`/`generateClosing`/`generateOpeningBeat`: falha aqui é motivo de reseed da US-150, não degradação silenciosa.
- **Checar por `as never`/`as unknown as X` nos testes que tocam `RolledAdventureContent`** antes de confiar só no `tsc` pra pegar todo mundo que ainda espera `premissa: string` — o padrão já existe no arquivo (ex. teste de `hookSeed` em `generateLocationsAndNpcs`, `{ rolled, registry, hookSeed } as never`) pra forçar um campo indevido através do compilador; se algum teste (presente ou futuro) usar o mesmo truque perto de `premissa`, o typecheck não vai acusar a mudança de shape ali.
- **Categoria de risco aceita, não nova:** a premissa elaborada virar dado cru interpolado nas 4 chamadas seguintes (sem re-tradução) é a MESMA categoria de risco que `generateAntagonist.connection` já carrega hoje pra `generateClosing`/`generateOpeningBeat` — uma chamada de IA escreve texto, chamadas seguintes só embutem esse texto como contexto. O critério de locale em `generatePremissa` (acima) é a mitigação; não precisa de mecanismo novo além do que as outras 5 chamadas já usam.
- **Reprodutibilidade:** aventuras geradas ANTES desta story, se regeradas pelo mesmo `characterId`+`order` DEPOIS do deploy, produzem candidatos/premissa diferentes — a troca do sub-seed é uma mudança de algoritmo, não um bug. Documentar no commit (ver Critérios de aceite); não é caso de tentar preservar compatibilidade retroativa (não pedido, e US-146 nunca prometeu estabilidade ENTRE versões do algoritmo, só determinismo DENTRO da mesma versão).

---

## Questões em aberto

1. ~~Vale medir o impacto de latência antes de aceitar?~~ **Resolvida parcialmente:** não achei timeout configurado especificamente pra `POST /adventures` (grep vazio em `render.yaml`/`adventure/`), então não há limite conhecido que a chamada extra estoure de cara. Mesmo assim, "sem timeout documentado" não é "sem risco" — critério de aceite implementável: medir o tempo total de `generateAdventure` (log/instrumentação simples, mesmo padrão de `logExtractionEndpoint`) antes e depois desta story, num ambiente real (não só teste mockado), e registrar o delta no commit/PR. Se o delta for grande o bastante pra preocupar, mitigar é story própria (não written aqui, sem dado real pra desenhar a mitigação certa agora).
2. A instrução "imagine 3 situações por candidato, escolha a mais direta" é fiel à técnica do artigo, mas o schema só pede a premissa final — não há como testar unitário se o modelo realmente considerou os 5 ou só elaborou o primeiro. Mesma disciplina da Questão em aberto #2 da US-180 (verificação real é eval/QA manual, não teste mockado) — aceitável aqui também, sem mudança de escopo.

---

## Referências no código

- [apps/api/src/adventure-generation/roll-content.ts](../../../apps/api/src/adventure-generation/roll-content.ts) — `RolledAdventureContent`, `rollContent`, `rollPatronsAndNpcs` (molde a espelhar para `rollPremissaCandidates`), `pickRow`/`tableSeed`.
- [apps/api/src/adventure-generation/roll-adventure.ts](../../../apps/api/src/adventure-generation/roll-adventure.ts) — `rollAdventure`, ponto de entrada que `generateAdventure` chama.
- [apps/api/src/ai/ai.service.ts:237-245](../../../apps/api/src/ai/ai.service.ts) — `characterAnchors`, a reusar.
- [apps/api/src/ai/ai.service.ts:153-165](../../../apps/api/src/ai/ai.service.ts) — `buildLocationsAndNpcsPrompt`, onde `rolled.premissa` é lido hoje (linha 158).
- [apps/api/src/ai/ai.service.ts:1516](../../../apps/api/src/ai/ai.service.ts) — `generateLocationsAndNpcs`, ganha `premissa` explícito.
- [apps/api/src/adventure-generation/roll-content.test.ts:14-30](../../../apps/api/src/adventure-generation/roll-content.test.ts) — fixture pinado que precisa atualização manual conferida (não `-u` cego).
- [apps/api/src/adventure/adventure.service.ts:207-220](../../../apps/api/src/adventure/adventure.service.ts) — `generateAdventure`, onde `generatePremissa` entra, entre `rollAdventure` (linha 215) e `generateLocationsAndNpcs` (linha 217).
- [apps/api/src/adventure/adventure.service.ts:357](../../../apps/api/src/adventure/adventure.service.ts) — `summary: content.premissa`, vira `summary: premissa`.
- [apps/api/src/adventure/adventure.service.ts:451,524,557](../../../apps/api/src/adventure/adventure.service.ts) — `mainQuest`/`Adventure.title`/`Quest.title`, todos herdam `summary` — corrigidos de graça por esta story.
- [packages/shared/src/types/adventure-generation.ts:84-101](../../../packages/shared/src/types/adventure-generation.ts) — `GeneratedAdventureSchema`, campo `summary` (linha 88); sem mudança de schema, só do valor.
- [docs/sdlc/01-requisitos/backlog-motor-de-geracao-de-aventuras.md §Ordem de geração](./backlog-motor-de-geracao-de-aventuras.md) — passo 1, "objetivo ← tabela de quests", o que esta story substitui.
- [US-146](./US-146-seed-deterministico-motor-aventura.md) — a rolagem dos 5 candidatos continua presa ao seed determinístico; nenhum sorteio novo foge dele.
- [US-147](./US-147-rolagem-registro-conteudo.md) — dona de `rollContent`, que esta story estende.
- [US-149](./US-149-segredos-40-prompts-lgmrd.md) — molde mais próximo: rolagem bruta → IA veste de prosa informada por background.
- Commit `32ec73d` — elenco original (`generateLocationsAndNpcs`) ganhou `characterAnchors`.
- Commit `b753c0b` — fecho (`generateClosing`) ganhou `characterAnchors`; as duas juntas fecham 5 das 6 chamadas do motor no vínculo pessoal — esta story fecha a última, a fonte da própria premissa.
