# US-28 — Aventura inicial baseada na classe do personagem

**Épico:** 2 — Aventura
**Fase:** 1 — MVP single-player
**Status:** ✅ Pronta para desenvolvimento
**Depende de:** [US-26](./US-26-criacao-personagem-em-etapas.md) (personagem confirmado antes da aventura), [US-22](./US-22-fusao-campanha-aventura.md) (aventura como entidade única) e [US-23](./US-23-dm-ciente-da-ficha.md) (DM recebe ficha completa).
**Criada em:** 2026-07-04

---

## História

> **Como** jogador,
> **quero** que a primeira aventura do meu personagem comece a desenvolver a história dele a partir da classe escolhida,
> **para que** qualquer personagem, independentemente da classe, entre no jogo com um conflito inicial que pareça feito para sua identidade.

---

## Contexto e motivação

### O problema observado

A US-28 estava descrita como uma seleção de módulos prontos, por exemplo "A Mina Perdida — Iniciante · masmorra". Isso ajuda a começar rápido, mas trata personagens muito diferentes como se tivessem o mesmo ponto de partida. Um mago, uma ladina, um paladino ou uma classe customizada entram na mesma aventura sem que a primeira cena reconheça o que o jogador acabou de escolher.

No fluxo de criação 1a, a etapa de aventura vem logo depois da revisão do personagem. Esse é o melhor momento para transformar a classe em promessa narrativa: o jogador acabou de decidir "sou uma maga", "sou um guerreiro", "sou uma barda", etc., então a primeira aventura deve responder a isso.

### Por que a solução atual não basta

O endpoint atual `POST /characters/:characterId/adventures` recebe apenas um `title`. O backend cria `Adventure`, `AdventureParticipant` e `CharacterState`, mas não cria uma premissa, uma primeira cena, nem uma quest principal ligada à classe. A consequência é que o DM só descobre a identidade do personagem depois, via prompt, e a aventura inicial nasce genérica.

Também não basta fazer o LLM "inventar uma origem" sem persistência. A aventura inicial precisa existir como estado do Game Server: título, quest principal e primeiro evento narrativo devem ser criados e registrados no banco. O LLM pode narrar em cima disso, mas não deve ser a fonte de verdade.

### A proposta

Substituir a seleção genérica de módulo por uma etapa **Aventura inicial** que apresenta uma abertura orientada pela classe do personagem. Os ganchos vêm do `System.config` do sistema escolhido, com cobertura para as classes base conhecidas e um fallback obrigatório para qualquer classe desconhecida/customizada, usando o nome da classe como elemento narrativo em vez de bloquear o fluxo.

Ao confirmar essa aventura inicial, o Game Server cria a aventura, liga o personagem, cria o estado inicial, registra uma quest principal e adiciona a primeira narração/evento de abertura. O jogador é levado direto para a tela de jogo.

---

## Escopo

### Catálogo inicial sugerido

Este catálogo é material de produto para o MVP. Os textos finais podem mudar na implementação, mas cada classe deve preservar a intenção narrativa:

| Classe | Título sugerido | Conflito inicial |
|---|---|---|
| Bárbaro | O Chamado da Fúria Antiga | Um sinal do clã, da terra natal ou de uma força ancestral exige que o personagem prove se sua fúria é maldição ou proteção. |
| Bardo | A Canção Que Ninguém Devia Ouvir | Uma apresentação revela uma verdade escondida e coloca o personagem entre fama, segredo e perigo. |
| Clérigo | A Relíquia Sem Voz | Um símbolo sagrado perde o poder ou chama pelo personagem, abrindo uma crise de fé que precisa ser investigada. |
| Druida | A Raiz Envenenada | Um desequilíbrio na natureza reconhece o personagem como mediador antes que a corrupção se espalhe. |
| Guerreiro | O Contrato Que Sangra | Um trabalho aparentemente simples testa honra, técnica e lealdade quando o verdadeiro inimigo aparece. |
| Monge | O Último Selo do Mosteiro | Um ensinamento, rival ou juramento do treinamento retorna para testar disciplina e propósito. |
| Paladino | A Primeira Quebra do Juramento | Uma injustiça força o personagem a agir antes que sua convicção esteja confortável ou reconhecida. |
| Patrulheiro | Rastros Fora do Mapa | Uma trilha impossível atravessa território conhecido e revela uma ameaça que só o personagem consegue seguir. |
| Ladino | A Dívida da Sombra | Um golpe, favor ou segredo antigo cobra seu preço e empurra o personagem para uma escolha de confiança. |
| Feiticeiro | O Sangue Desperta | O poder inato do personagem reage a um fenômeno perigoso e atrai gente interessada demais em sua origem. |
| Bruxo | O Preço do Pacto | Um patrono, marca ou promessa cobra a primeira consequência concreta, sem explicar tudo. |
| Mago | O Arquivo Que Sussurra | Um conhecimento proibido reconhece o personagem e transforma estudo em investigação urgente. |
| Fallback | O Primeiro Sinal de {characterClass} | Algo no mundo reconhece a vocação, ofício ou tradição do personagem e o chama para provar o que essa classe significa ali. |

### Dentro do escopo

- Uma etapa pós-criação de personagem chamada **Aventura inicial**, acionada depois do `Confirmar personagem` da [US-26](./US-26-criacao-personagem-em-etapas.md).
- A etapa lê o personagem recém-criado (classe, nome e sistema) e mostra **uma única aventura inicial** compatível com a classe.
- O `System.config` oferece **1 gancho inicial por classe base** listada na US-26: Bárbaro, Bardo, Clérigo, Druida, Guerreiro, Monge, Paladino, Patrulheiro, Ladino, Feiticeiro, Bruxo e Mago.
- Existe um gancho **fallback** para qualquer classe que não esteja no catálogo, incluindo sistemas futuros ou classes vindas de upload.
- O fallback deve mencionar a classe escolhida pelo jogador e enquadrá-la como vocação, ofício, tradição ou papel social, sem assumir regras específicas que talvez não existam no sistema.
- Ao iniciar a aventura, o backend cria em uma transação:
  - `Adventure` com `systemId` e `creatorId` derivados do personagem.
  - `AdventureParticipant` ligando personagem e aventura.
  - `CharacterState` inicial, usando a ficha persistida e o kit inicial do sistema.
  - `Quest` principal (`isPrimary = true`) derivada do gancho escolhido.
  - `EventLog` inicial do tipo `NARRATION` com a primeira cena apresentada ao jogador.
- A aventura anterior ativa do personagem continua sendo encerrada conforme a regra atual de `AdventureService.createForCharacter`.
- A tela de jogo abre já com o histórico inicial carregável via [US-18](./US-18-historico-servido-pela-api.md), incluindo a primeira narração.
- O título e a primeira cena deixam claro que a aventura é o começo da trajetória daquele personagem, não uma missão avulsa.

### Fora do escopo

- Geração procedural profunda de campanha inteira. Esta story só cria a abertura, a quest principal inicial e a primeira cena.
- Upload de livros e RAG por campanha — fase futura.
- Arcos pessoais longos, evolução psicológica ou múltiplos capítulos de background — podem nascer de stories futuras de memória e progressão.
- Integrar **raça** e **background** do personagem na narração inicial — desejado para uma evolução futura, mas fora do MVP desta story. Nesta US, a escolha da aventura inicial é baseada somente na classe.
- Editor para o jogador escrever seu próprio gancho inicial.
- Multiplayer. A aventura criada aqui é single-player; quando houver múltiplos personagens, será preciso compor ganchos de várias classes.

---

## Modelo de dados proposto

Sem nova tabela. A story usa entidades já existentes (`Adventure`, `AdventureParticipant`, `CharacterState`, `Quest`, `EventLog`) e adiciona um catálogo de ganchos iniciais ao `System.config`.

Forma sugerida para o contrato de dados no `System.config`:

```ts
type InitialAdventureHook = {
  id: string
  title: string
  classKey: string | 'default'
  pitch: string
  primaryQuestTitle: string
  primaryQuestDescription: string
  openingNarration: string
  tags: string[]
}

type SystemConfig = {
  // campos já existentes: attributes, startingKits, pointBuy, etc.
  initialAdventures: {
    hooks: InitialAdventureHook[]
  }
}
```

Exemplo:

```json
{
  "attributes": [],
  "startingKits": { "default": [] },
  "initialAdventures": {
    "hooks": [
      {
        "id": "wizard-forbidden-archive",
        "title": "O Arquivo Que Sussurra",
        "classKey": "Mago",
        "pitch": "Um grimório reconhece o personagem antes que ele o abra.",
        "primaryQuestTitle": "Descobrir por que o arquivo conhece seu nome",
        "primaryQuestDescription": "Investigar a origem do grimório e impedir que seu segredo caia em mãos perigosas.",
        "openingNarration": "A vela da escrivaninha se curva sozinha quando você se aproxima. Na lombada do grimório, letras novas aparecem: o seu nome.",
        "tags": ["mistério", "conhecimento", "origem"]
      },
      {
        "id": "default-first-sign",
        "title": "O Primeiro Sinal de {characterClass}",
        "classKey": "default",
        "pitch": "Algo no mundo reconhece a vocação do personagem.",
        "primaryQuestTitle": "Descobrir por que sua vocação foi reconhecida",
        "primaryQuestDescription": "Investigar o chamado inicial sem presumir regras específicas da classe.",
        "openingNarration": "Antes que a estrada decida seu rumo, alguém pronuncia sua classe como se ela fosse uma chave: {characterClass}.",
        "tags": ["origem", "chamado"]
      }
    ]
  }
}
```

| Campo | Tipo | Descrição |
|---|---|---|
| `initialAdventures.hooks` | `InitialAdventureHook[]` | Ganchos iniciais disponíveis para o sistema. No MVP deve haver exatamente um hook por classe base e um hook `default`. |
| `classKey` | string \| `"default"` | Classe à qual o hook se aplica. `default` é obrigatório e cobre classes desconhecidas/customizadas. |
| `openingNarration` | string | Primeira narração persistida no `EventLog`; pode conter placeholders como `{characterName}` e `{characterClass}`. |

**Persistência:** o catálogo vive em `System.config` e é versionado junto com o seed/config do sistema. A aventura escolhida é persistida nas tabelas existentes: `Adventure.title`, `Quest.title`, `Quest.description`, `Quest.isPrimary = true` e `EventLog.payload.text` para a primeira narração.

---

## Integração com o AI DM (primeira mensagem na tela de jogo)

A aventura inicial só cumpre seu propósito se a narração de abertura aparecer **como primeira mensagem do Mestre na tela de chat** e o AI DM **continuar a história a partir dela** quando o jogador enviar a primeira ação. Esta seção detalha as garantias de integração entre a criação da aventura e o fluxo de chat existente.

### 1. EventLog de abertura como mensagem do DM

O `EventLog` criado na transação de `createForCharacter` deve ter:
- `type: 'NARRATION'`
- `summarized: false` (padrão da coluna)
- `payload: { text: "<narração de abertura com placeholders resolvidos>" }`

Esse registro serve dois propósitos simultâneos:
1. **Tela de jogo:** `getTurns()` já filtra por `type IN ('ACTION', 'NARRATION')` e mapeia `NARRATION` para `role: 'dm'`. A abertura aparece automaticamente como primeira mensagem do Mestre, sem mudança no componente `GameView` nem no endpoint de turnos.
2. **Janela de contexto do AI DM:** `AiService.streamChat` carrega `historyLogs` com `summarized: false`. A abertura entra como mensagem `assistant` no array `history`, então o DM sabe o que já narrou e continua dali — não reinventa a cena.

### 2. Resolução de placeholders no backend

Os templates de `openingNarration`, `title` e `primaryQuestTitle` podem conter placeholders como `{characterName}` e `{characterClass}`. A resolução acontece **no backend, na hora da criação da aventura**, antes de persistir. Os campos gravados no banco já contêm texto final, sem placeholders pendentes. Assim nem o frontend nem o AI DM precisam saber que existiam templates.

Placeholders suportados no MVP:
| Placeholder | Valor |
|---|---|
| `{characterName}` | `character.name` |
| `{characterClass}` | `character.class` |

### 3. Quest primária no system prompt do DM

Hoje `buildDmSystemPrompt` recebe `mainQuest` apenas como título (`quests.find(q => q.isPrimary)?.title`). Para que o DM saiba **o que** a quest pede e narre com coerência, a descrição da quest também deve chegar ao prompt.

Ajuste necessário em `AiService.streamChat`:
```ts
const primary = quests.find((q) => q.isPrimary)
const mainQuest = primary
  ? `${primary.title}\n${primary.description}`
  : null
```

E garantir que `buildDmSystemPrompt` já aceita esse formato (hoje recebe `string | null`, sem mudança de tipo).

### 4. Continuidade narrativa: o DM não repete a abertura

Quando o jogador envia a primeira ação, o `history` passado ao `streamText` já contém a narração de abertura como mensagem `assistant`. O DM vê:

```
[assistant] "A vela da escrivaninha se curva sozinha..." (abertura)
[user]      "Examino o grimório com cuidado."           (primeira ação)
```

Isso basta para que o modelo continue a cena sem repeti-la. Não é necessário instrução extra no system prompt — o comportamento segue da janela de conversa preenchida.

### 5. Tela de jogo: sem placeholder quando há narração

`GameView` hoje mostra um placeholder ("A tua aventura começa aqui") quando `messages.length === 0`. Com a abertura persistida, `getTurns()` devolve pelo menos uma mensagem, então o placeholder nunca aparece para aventuras criadas pela US-28. Nenhuma mudança em `GameView` é necessária.

### 6. Diagrama de fluxo resumido

```
US-26: Confirmar personagem
  │
  ▼
US-28: Etapa "Aventura inicial" (UI mostra gancho da classe)
  │  Jogador clica "Iniciar aventura"
  ▼
POST /characters/:characterId/adventures  { initialHookId }
  │
  ├─ resolve hook do System.config pela classe
  ├─ resolve placeholders ({characterName}, {characterClass})
  │
  └─ TRANSAÇÃO:
       ├─ Adventure.create(title)
       ├─ AdventureParticipant.create
       ├─ CharacterState.create (HP, inventário, atributos)
       ├─ Quest.create(isPrimary: true, title, description)
       └─ EventLog.create(type: NARRATION, payload.text: abertura)
  │
  ▼
Redirect → /play/:adventureId?characterId=...
  │
  ▼
GameView monta → getTurns() → [{ role: 'dm', content: abertura }]
  │  Jogador vê a narração de abertura como primeira mensagem do Mestre
  │  Jogador envia sua primeira ação
  ▼
POST /ai/chat  { adventureId, characterId, message }
  │
  ├─ historyLogs inclui o EventLog de abertura (summarized: false)
  ├─ mainQuest inclui título + descrição da quest primária
  ├─ systemPrompt com ficha, quest, inventário, etc.
  │
  └─ AI DM continua a história a partir da abertura
       (vê a narração como mensagem assistant no histórico)
```

---

## Critérios de aceite

- [ ] Depois de confirmar o personagem na US-26, o jogador entra numa etapa **Aventura inicial** antes da tela de jogo.
- [ ] A etapa mostra exatamente uma opção de aventura cujo texto foi escolhido a partir da `class` persistida do personagem.
- [ ] O gancho exibido vem de `System.config.initialAdventures`, não de uma lista hardcoded no componente web.
- [ ] Para cada classe base da US-26 existe pelo menos um gancho específico no catálogo.
- [ ] O `System.config` do sistema seedado contém um hook `default`; sem `default`, o config é inválido.
- [ ] Para uma classe desconhecida/customizada, o sistema mostra um gancho fallback e **não bloqueia** o início da aventura.
- [ ] O gancho fallback inclui o nome da classe escolhida pelo jogador, mas não inventa regras, poderes ou números específicos dessa classe.
- [ ] Ao iniciar a aventura, o backend cria `Adventure`, `AdventureParticipant`, `CharacterState`, `Quest` principal e `EventLog` inicial em uma única transação.
- [ ] A `Quest` inicial da aventura é marcada como `isPrimary = true`.
- [ ] A primeira narração aparece no histórico da tela de jogo ao abrir a aventura, sem depender de uma nova chamada ao LLM.
- [ ] O `systemId` da aventura é sempre derivado do personagem; o cliente não envia nem escolhe `systemId` para a aventura.
- [ ] Se a criação da aventura falhar, o personagem recém-criado continua salvo e a UI mostra erro com opção de tentar iniciar a aventura novamente.
- [ ] O jogador é redirecionado para `/play/:adventureId` apenas depois que a aventura e seus registros iniciais forem persistidos com sucesso.
- [ ] **Eval / teste de regressão (classe conhecida):** criar uma personagem `Mago`, escolher aventura inicial, e verificar que a aventura criada tem título/quest/narração vindos do gancho de Mago.
- [ ] **Eval / teste de regressão (classe desconhecida):** criar personagem com classe `Cartógrafa Estelar`, iniciar aventura, e verificar que o fluxo conclui com gancho fallback contendo `Cartógrafa Estelar`, sem erro e sem texto de outra classe base.
- [ ] **Eval / teste de regressão (persistência):** após iniciar a aventura, `GET /characters/:characterId/adventures/:adventureId/turns` devolve a primeira narração criada no `EventLog`.

### Integração com o AI DM

- [ ] O `EventLog` de abertura é criado com `type: 'NARRATION'` e `summarized: false`, garantindo que aparece tanto em `getTurns()` (tela de chat) quanto em `historyLogs` (janela de contexto do DM).
- [ ] Placeholders (`{characterName}`, `{characterClass}`) são resolvidos **no backend** antes de persistir; nenhum placeholder cru chega ao banco, ao jogador ou ao DM.
- [ ] A `Quest` primária é criada com `title` e `description` preenchidos a partir do hook; `AiService.streamChat` injeta ambos no `mainQuest` do system prompt para que o DM saiba o objetivo da aventura.
- [ ] Quando o jogador envia a primeira ação, o AI DM recebe a narração de abertura como mensagem `assistant` no histórico e **continua** a partir dela, sem repetir a cena nem gerar uma segunda abertura.
- [ ] **Eval / teste de regressão (continuidade DM):** criar aventura com classe `Guerreiro`, enviar primeira ação do jogador, e verificar que a resposta do DM referencia ou continua o contexto do gancho (ex.: o contrato, o inimigo) em vez de inventar uma abertura nova.

---

## Notas de implementação

- **Backend principal:** estender `apps/api/src/adventure/adventure.service.ts`. O método `createForCharacter` já concentra a transação certa; ele deve passar a resolver o gancho inicial, criar a quest principal e inserir o primeiro `EventLog`.
- **Contrato compartilhado:** estender `packages/shared/src/types/system.ts` para validar `SystemConfig.initialAdventures.hooks`, incluindo a exigência de um hook `classKey: 'default'`.
- **Seed/config dos sistemas:** adicionar os hooks iniciais ao `config` dos sistemas seedados em `apps/api/prisma/seed.ts`. O sistema usado no MVP deve trazer os 12 hooks base + `default`.
- **DTO:** trocar ou ampliar `CreateAdventureDto` para receber `initialHookId` em vez de apenas `title`. O backend deve validar se o hook existe e se é permitido para a classe do personagem; o cliente não deve mandar título arbitrário como fonte de verdade.
- **Controller:** ajustar `apps/api/src/adventure/adventure.controller.ts` para documentar o novo payload. Exemplo: `{ "initialHookId": "wizard-forbidden-archive" }`.
- **Cliente:** adicionar em `apps/web/src/lib/api.ts` uma chamada para buscar a aventura inicial resolvida para o personagem, por exemplo `GET /characters/:characterId/initial-adventure`, e ajustar `createAdventure(characterId, initialHookId)`.
- **UI principal:** a US-26 atualmente volta para `/` após `api.createCharacter`. A US-28 deve interceptar esse ponto: depois de criar o personagem, salvar a sessão com `characterId` e mostrar a etapa **Aventura inicial**; só depois de `api.createAdventure` salvar `adventureId` e navegar para `/play/:adventureId`.
- **Normalização de classe:** usar comparação tolerante a acentos/caixa para classes base (`Mago`, `mago`, `Mágo` não deve quebrar por casing; acento estranho deve cair no fallback se não houver match seguro).
- **Fallback:** manter um hook `default` obrigatório. Ele deve usar placeholders como `{characterName}` e `{characterClass}` para garantir personalização mínima sem pressupor regra.
- **Primeira narração:** pode ser template determinístico do hook. Se futuramente for expandida por LLM, o resultado final ainda deve ser persistido no `EventLog` antes de aparecer ao jogador.
- **Integração DM — quest no prompt:** em `apps/api/src/ai/ai.service.ts`, alterar a construção de `mainQuest` para incluir `description` além de `title`:
  ```ts
  const primary = quests.find((q) => q.isPrimary)
  const mainQuest = primary ? `${primary.title}\n${primary.description}` : null
  ```
  `buildDmSystemPrompt` já aceita `string | null` — sem mudança de tipo.
- **Integração DM — continuidade automática:** a narração de abertura entra no `historyLogs` (filtro `summarized: false`) como mensagem `assistant`. Não é necessário nenhum tratamento especial no `AiService` nem no prompt — o modelo continua da janela de conversa preenchida. Porém, se no futuro a sumarização marcar o EventLog de abertura como `summarized: true`, ele passará ao `memorySummary` e continuará visível ao DM por essa via.
- **Resolução de placeholders:** criar uma função utilitária (ex.: `resolveHookTemplate(text, { characterName, characterClass })`) no service, usada antes de persistir `Adventure.title`, `Quest.title`, `Quest.description` e `EventLog.payload.text`.
- **Testes:** estender `apps/api/src/adventure/adventure.service.test.ts` com classe conhecida, fallback e criação de `Quest`/`EventLog`; estender `apps/web/src/components/setup/SetupWizard.test.tsx` para cobrir a etapa pós-revisão.
- **Testes de integração DM:** verificar que `streamChat` recebe a abertura no histórico e que `mainQuest` inclui descrição da quest primária.

---

## Questões em aberto

1. ~~**Quantas opções mostrar por classe no MVP?**~~ **Resolvido:** por enquanto a UI mostra **exatamente 1 aventura por classe**. Variações alternativas por classe ficam para uma story futura, depois que o fluxo base estiver validado.
2. ~~**Catálogo em código ou `System.config`?**~~ **Resolvido:** já fica em `System.config` no MVP. Isso mantém a regra "sistema como dado": classes, kits e aventuras iniciais do sistema viajam juntos no mesmo config. O backend apenas valida o schema, escolhe o hook pela classe e aplica o fallback `default`.
3. ~~**A classe deve ser o único eixo?**~~ **Resolvido:** nesta US, sim. Por enquanto a aventura inicial é baseada **somente na classe**. Depois, uma story futura deve integrar **raça** e **background** do personagem na narração inicial, sem mudar a garantia central desta US: a classe sempre influencia a abertura.

---

## Referências no código

- `apps/api/src/adventure/adventure.service.ts` — cria aventura, participante e estado inicial; ponto principal para adicionar hook, quest primária e evento inicial.
- `apps/api/src/adventure/adventure.controller.ts` — rota `POST /characters/:characterId/adventures`; payload deve deixar de ser apenas `{ title }`.
- `apps/api/src/adventure/adventure.service.test.ts` — testes atuais de `createForCharacter`; expandir para cobrir hook por classe e fallback.
- `packages/shared/src/types/system.ts` — schema compartilhado do `System.config`; adicionar `initialAdventures.hooks`.
- `apps/api/prisma/seed.ts` — seed dos sistemas; adicionar o catálogo inicial no `config`.
- `apps/web/src/components/setup/SetupWizard.tsx` — após `Confirmar personagem`, deve exibir a etapa de aventura inicial antes de navegar.
- `apps/web/src/components/setup/SetupWizard.test.tsx` — cobrir a navegação da revisão para aventura inicial e o erro/retry de criação da aventura.
- `apps/web/src/lib/api.ts` — cliente de `createAdventure`; precisa aceitar o identificador do hook e buscar a aventura inicial resolvida para o personagem.
- `apps/api/src/ai/ai.service.ts` — `streamChat` monta `historyLogs` e `mainQuest` para o system prompt do DM; precisa passar `Quest.description` além de `title` e já receberá a abertura via `historyLogs` automaticamente.
- `packages/ai-engine/src/prompts/dm-system.ts` — `buildDmSystemPrompt` recebe `mainQuest: string | null`; sem mudança de tipo, mas o valor agora inclui descrição.
- `apps/web/src/components/game/GameView.tsx` — sem mudança necessária; o placeholder "A tua aventura começa aqui" deixa de aparecer porque `getTurns()` devolve a abertura.
- `apps/api/prisma/schema.prisma` — entidades existentes usadas pela story: `Adventure`, `Quest`, `EventLog`, `CharacterState` e `AdventureParticipant`.
