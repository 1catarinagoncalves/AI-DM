# US-84 — Nomes de bloco do turn-state deixam de ser string duplicada em duas camadas do prompt

**Épico:** 5 — Qualidade e avaliação do DM Agent
**Fase:** 1 — MVP single-player
**Status:** 🚧 Em progresso
**Depende de:** [ADR 007](../../adr/007-camadas-do-prompt-por-volatilidade.md) — a *regra 2* dele (*a camada 2 nunca nomeia conteúdo da camada 3 por literal*) é o que esta story implementa. Fora isso é refactor puro em `dm-system.ts`; não precisa de CI nem de eval novo.
**Nasceu de:** [US-77](./US-77-reancorar-assertivas-de-prompt-e-guard-de-regressao.md) → *Questões em aberto #2, categoria 1*. Aquela story classificou esses cabeçalhos como **interface** (não prosa) e por isso os deixou de fora da reancoragem; classificar não conserta o acoplamento.
**Relacionada a:** [US-56](./US-56-estado-do-turno-na-mensagem.md) (separou as duas camadas em mensagens diferentes — é o que torna a dessincronia possível), [US-71](./US-71-simplificar-localizacao-do-personagem.md) (precedente: já renomeou um cabeçalho de seção), [US-55](./US-55-prompt-caching-do-dm.md) (o texto renderizado não pode mudar, sob pena de invalidar cache).
**Criada em:** 2026-07-27

---

## História

> **Como** mantenedor do DM Agent,
> **quero** que o nome de cada bloco do turn-state exista **uma vez** no código, e que quem o cita na prosa do system prompt use essa mesma fonte,
> **para que** renomear um bloco não deixe o prompt mandando o modelo confiar num bloco que não existe mais com aquele nome.

---

## Contexto e motivação

### O problema observado

O system prompt manda o Mestre confiar em blocos do turn-state **citando-os pelo nome**, em prosa:

```
dm-system.ts:349   The "Cena atual" and "Entidades do mundo" blocks in the turn-state are the SOURCE OF TRUTH…
dm-system.ts:359   …it is listed under "Current inventory" in the turn-state block that precedes the player's action.
```

E o builder do turn-state emite os cabeçalhos, em **outra função** e — desde a [US-56](./US-56-estado-do-turno-na-mensagem.md) — em **outra mensagem**:

```
dm-system.ts:415   `## Cena atual (FONTE DE VERDADE — tem precedência sobre qualquer inferência da prosa)`
dm-system.ts:430   `## Entidades do mundo (FONTE DE VERDADE — canon permanente da campanha…)`
dm-system.ts:465   `## Current inventory (read-only — managed by the Game Server)`
```

São a mesma string escrita duas vezes, sem nada ligando as duas pontas. Renomear um lado é uma edição de uma palavra; o outro lado continua apontando para um nome que não existe mais. Não quebra teste, não quebra `typecheck`, não aparece em log — o modelo simplesmente recebe uma instrução para confiar num bloco fantasma.

O precedente já existe: a [US-71](./US-71-simplificar-localizacao-do-personagem.md) renomeou o cabeçalho `SPATIAL & SCENE CONTINUITY`. Não foi um desses quatro por sorte.

### O inventário do acoplamento

Quatro nomes, seis citações, duas camadas:

| Nome do bloco | Emitido em | Citado na prosa em | Camada da citação |
|---|---|---|---|
| `Cena atual` | `dm-system.ts:415` | `:349` (2×) | system prompt (estático, cacheado) |
| `Entidades do mundo` | `:430` | `:314`, `:349` | system prompt |
| `Current inventory` | `:465` | `:275`, `:359` | system prompt |
| `Skills` (linha da ficha) | `:183` | `:272` | system prompt |

O caso de `Skills` é o mais afiado: `:272` manda passar `skill` para o `rollDice` **com o nome EXATAMENTE como está na linha "Skills" da ficha**. Renomear a linha para `Perícias` (o repo é bilíngue — ver [ADR 005](../../adr/005-locale-como-dimensao.md)) quebra a instrução sem quebrar nenhum teste.

### Por que a solução atual não basta

Os testes existentes (`dm-system.test.ts:132`, `:219`, `:239`, `:253`, `:259`) provam **só o lado emissor**: que o builder emite `## Cena atual` quando há cena, e não emite quando não há. Nenhum prova que a prosa do system prompt cita o mesmo nome. As duas metades do contrato são testadas pela metade.

A [US-77](./US-77-reancorar-assertivas-de-prompt-e-guard-de-regressao.md) chegou a esse acoplamento por outro caminho — perguntando se cabeçalho é âncora de teste válida — e concluiu corretamente que **é**, justamente porque é interface. Mas ela é uma story de testes: reancorar assertivas não impede a dessincronia, só a torna detectável se alguém tiver escrito um teste para ela. Ninguém escreveu.

### A proposta

Extrair os nomes de bloco para constantes e interpolá-las **nos dois lados**. Rename passa a ser uma edição só; a dessincronia deixa de ser possível em vez de ficar sendo vigiada.

---

## Escopo

### Dentro do escopo

- Constante única por nome de bloco (`Cena atual`, `Entidades do mundo`, `Current inventory`, `Skills`), interpolada tanto no cabeçalho emitido quanto na citação em prosa.
- As 6 citações e os 4 pontos de emissão da tabela acima.
- Prova de que o prompt renderizado não mudou: `buildDmSystemPrompt` e `buildTurnStateBlock` produzem texto **idêntico byte a byte** antes e depois.

### Fora do escopo

- **Reescrever qualquer regra do prompt.** É refactor de identificador; o texto que chega ao modelo é o mesmo.
- **As 🟡 MÉDIO da US-77.** Continuam com a política de lá: reancoradas oportunisticamente por quem tocar no arquivo.
- **Os cabeçalhos da categoria 3** (`## ⚠️ TURN RESOLUTION ORDER`, `## MANDATORY TEXT FORMATTING RULES`, …). Ninguém os cita; não há acoplamento para remover. Extrair constante para eles seria abstração sem segundo caller.
- **`## Estado atual`** (`:401`). É a fronteira de cache da [US-55](./US-55-prompt-caching-do-dm.md), o que o torna sensível por outro motivo — mas nenhuma prosa o cita pelo nome. Entra só se a Questão #1 disser que sim.

---

## Critérios de aceite

- [ ] Cada um dos 4 nomes existe **uma vez** no código; `grep` pelo literal (`"Cena atual"`, `"Entidades do mundo"`, `"Current inventory"`, `"Skills"`) retorna a definição da constante e mais nada em `dm-system.ts`.
- [ ] Renomear a constante muda o cabeçalho **e** a citação na prosa, sem nenhuma outra edição.
- [ ] **Prompt renderizado inalterado:** o texto de `buildDmSystemPrompt` e de `buildTurnStateBlock` (com cena, entidades, inventário e perícias preenchidos) é idêntico byte a byte ao de antes do refactor. Sem isso, o refactor invalida o cache da [US-55](./US-55-prompt-caching-do-dm.md).
- [ ] **Teste de regressão:** um teste que quebra se as duas pontas divergirem — asserção sobre o par (a prosa do system prompt contém o mesmo literal que o builder emite como `## `), escrita em cima da constante, não do literal repetido.
- [ ] `pnpm test` verde. `pnpm eval` verde (nenhuma assertiva de prompt deveria nem notar o refactor — se alguma notar, ela ancorava em algo que mudou e isso é achado, não falha esperada).

---

## Notas de implementação

- **Onde a constante vive:** `dm-system.ts`, junto do builder. Não exportar para fora do pacote sem terceiro caller — as duas funções que precisam dela estão no mesmo arquivo.
- **A objeção óbvia, e por que não se aplica aqui.** A [US-77](./US-77-reancorar-assertivas-de-prompt-e-guard-de-regressao.md) rejeitou (*Alternativas* 1) "exportar os contratos do prompt como constantes e os testes casarem a constante" — porque o eval passaria a testar a si mesmo. Aqui o alvo é outro: não é o **conteúdo da regra**, é o **identificador compartilhado por dois emissores**. Se a regra sumir, o teste de conteúdo continua sendo o de sempre; a constante só garante que os dois lados escrevem o mesmo nome. Vale a pena registrar essa distinção no `PROMPT-ANCHORS.md` da US-77 quando ele existir.
- **Legibilidade do prompt cai um pouco.** `The "${SCENE_BLOCK}" and "${ENTITIES_BLOCK}" blocks…` lê pior que a prosa literal. É o preço; a alternativa é um teste de consistência que precisa ser lembrado a cada bloco novo.
- **Cache:** interpolar constante não muda o texto renderizado (mesma string todo turno), então a fronteira de cache da US-55 e a divisão de camadas da US-56 ficam intactas. O critério de aceite "byte a byte" é o que prova isso — rodar antes/depois e comparar, não confiar na leitura.
- **`Skills` merece atenção separada:** `:183` emite `- Skills (modifier; * = proficient): …` e `:272` cita `"Skills" line`. A constante é só a palavra `Skills`, não a linha inteira.

---

## Questões em aberto

1. **`## Estado atual` entra?** É a fronteira de cache da [US-55](./US-55-prompt-caching-do-dm.md) e o cabeçalho mais sensível do prompt, mas **nenhuma prosa o cita pelo nome** — não há acoplamento a remover, só um cabeçalho valioso. Se entrar, entra por outro motivo (proteger a fronteira de cache), e aí é candidato ao guard por hash da US-77 (P3), não a esta story.
2. **"Entidades do mundo" citado incondicionalmente, emitido condicionalmente.** `entitiesSection` é `''` quando o ledger está vazio (`:429`), mas `:314` e `:349` afirmam sem ressalva que ele é a fonte de verdade — o prompt aponta para um bloco ausente. E ledger vazio **não é falha**: `extractOpeningEntities` é best-effort por design (`adventure.service.ts:127-135` — falha/vazio → ledger vazio) e `recordEntity` é discricionário do modelo, então uma campanha nova roda vários turnos sem entidade nenhuma. Provavelmente inofensivo (o modelo ignora), mas é a mesma classe de defeito desta story vista de outro ângulo — dessincronia no eixo *presença* em vez do eixo *nome*. Medir antes de mexer: vale um eval, não um palpite.

   **A metade da cena não entra.** `sceneSection` também é `''` sem cena (`:414`), mas a [US-35](./US-35-cena-estruturada-na-abertura.md) confinou esse caso ao turno de **abertura**, onde ele é logicamente inevitável: a abertura é o que *gera* a cena (`adventure.service.ts:104` gera o texto → `:130` extrai a cena dele → `:172` persiste), então `ai.service.ts:863` passa `sceneState: null` por causalidade, não por omissão. Do turno 1 em diante o campo está preenchido. Sobram só resíduos raros: extração da US-35 falhando, e cena não-nula que `formatSceneState` renderiza vazia (`scene.ts:38`).

---

## Referências no código

- `packages/ai-engine/src/prompts/dm-system.ts` — `:183`, `:272`, `:275`, `:314`, `:349`, `:359` (citações) e `:415`, `:430`, `:465` (emissões). É o arquivo inteiro da story.
- `packages/ai-engine/src/prompts/dm-system.test.ts` — `:132`, `:219`, `:239`, `:253`, `:259`: os testes que cobrem só o lado emissor e explicam a lacuna.
- [US-77](./US-77-reancorar-assertivas-de-prompt-e-guard-de-regressao.md) — *Questões em aberto #2*, tabela das três categorias: a categoria 1 é exatamente o alvo desta story.
