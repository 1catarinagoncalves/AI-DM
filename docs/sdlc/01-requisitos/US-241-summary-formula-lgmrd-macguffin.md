# US-241 — Summary nasce da fórmula do LGMRD: conceito primário + "because" + MacGuffin

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** [US-232](./US-232-schema-cresce-e-prompt-de-autoria-call-unico.md) ✅ (`AUTHORING_SCHEMA`/`buildAuthoringPrompt` — esta story ganha um parâmetro novo, não reabre o call único) · [US-144](./US-144-schema-aventura-shared.md) (`GeneratedAdventureSchema.summary`, campo que recebe a restrição — schema em si não muda)
**Relacionado:** [ADR 012](../../adr/012-aventura-gerada-como-dado.md) D5 (**esta story reverte, só para `summary`**, a decisão "nada das 135 tabelas do LGMRD entra, nem como espinha nem como tempero") · [US-237](./US-237-remove-seed-rebaixa-lgmrd-mantem-monster-builder.md) (MA-7, limpeza de código morto — precisa anotar exceção: `readLgmrdTables`/`lgmrd-tables.ts` NÃO morrem com esta story viva) · [US-192](./US-192-premissa-elaborada-com-vinculo-pessoal.md) (precedente aposentado — `rollContent`/`rollPremissaCandidates`/`generatePremissa` liam `1d20quests` de outro jeito; **não** é revivido aqui, ver *Fora do escopo*) · [US-240](./US-240-registro-de-nome-sorteado-na-autoria.md) (`rollNamingRegister`, molde mais recente do padrão "sub-seed único, entra como restrição do prompt de autoria")
**Criada em:** 2026-09-14 — a pedido da mantenedora, aplicando a fórmula real de geração de quests do LGMRD (Sly Flourish): rolar um **conceito primário** (tabela `1d20 Quests`) e um **MacGuffin** — local/monumento/item **combinado com** 2 de 3 atributos de condição/descrição/origem, OU, como alternativa, um patrono/NPC — e uni-los com "because" para formar o gancho completo. A inversão mundo-primeiro (ADR 012 D5/US-232) deixou `summary` como linha livre do modelo, sem essa estrutura testada.

---

## História

> **Como** jogadora que gera uma aventura nova,
> **quero** que a sinopse (`summary`) nasça de uma fórmula fixa do LGMRD — um conceito de ação sorteado (ex. "Kill a villain") combinado com um MacGuffin sorteado (ex. um objeto amaldiçoado, ou a razão por trás do problema), ligados por "porque" —,
> **para que** a premissa sempre tenha um gancho de ação concreto e um motivo por trás dele, em vez de depender só da criatividade livre do modelo a cada geração (que pode sair genérica, tipo "uma aventura perigosa aguarda").

---

## Contexto e motivação

### O problema observado

Hoje `summary` é um campo solto dentro do `AUTHORING_SCHEMA` ([ai.service.ts:120](../../../apps/api/src/ai/ai.service.ts)):

```ts
summary: z.string().min(1).describe('Sinopse de UMA linha da aventura (lista/quest)'),
```

Sem mais instrução nenhuma no `system`/prompt de autoria ([ai.service.ts:181-256](../../../apps/api/src/ai/ai.service.ts)) além de "escreva uma sinopse de uma linha". O modelo escreve essa linha em paralelo com todo o resto do artefato (`world`, `story`, `factions[]`, ...), na MESMA chamada — sem um gancho de ação nem um motivo estruturado por trás, uma sinopse de UMA linha tende a sair mais genérica que os campos de prosa longa (`world.description`, `story`), que têm mais espaço pra ganhar especificidade sozinhos.

### Por que a solução atual não basta

A [ADR 012](../../adr/012-aventura-gerada-como-dado.md) D5 (revisão 09/09) e a [US-232](./US-232-schema-cresce-e-prompt-de-autoria-call-unico.md) (Implementada) decidiram, de forma explícita e testada pelo Spike de autoria: **nenhuma das 135 tabelas do LGMRD entra no prompt de autoria — nem como espinha, nem como tempero/inspiração** ([US-232, linha 67](./US-232-schema-cresce-e-prompt-de-autoria-call-unico.md)). A motivação foi real: montar a aventura INTEIRA de tabela produzia resultado genérico e plano (o problema original que a inversão resolveu).

Mas essa decisão foi tomada olhando o artefato inteiro, não o campo `summary` isoladamente. O LGMRD tem uma fórmula ESPECÍFICA e testada — de outro produto do mesmo autor (Sly Flourish), não da montagem-por-tabela antiga deste projeto — pensada exatamente pra gerar UMA frase de gancho a partir de duas peças pequenas: um verbo de ação (`1d20quests`, ex. "Kill a villain", "Uncover a secret") e um MacGuffin, que sai de UM de 2 caminhos: (A) local/monumento/item (`locationsmonumentsanditems`) **combinado com** 2 dos 3 atributos de condição/descrição/origem (`conditiondescriptionandorigin`) — as duas tabelas SEMPRE juntas nesse caminho; ou (B) um patrono/NPC (`patronsandnpcs`) sozinho, como alternativa ao caminho A inteiro. Essas 4 tabelas já estão extraídas e commitadas (`scripts/lazygm/lgmrd-tables.json`), sem uso nenhum hoje (o antigo consumidor, `rollContent`/US-147/149/192, está marcado pra remoção em [US-237](./US-237-remove-seed-rebaixa-lgmrd-mantem-monster-builder.md)/MA-7) — descartar esse dado de novo sem testar a fórmula certa pro problema certo (uma linha de gancho, não a aventura inteira) seria jogar fora algo que resolve exatamente a lacuna observada.

### A proposta

Reverter, **só para o campo `summary`**, a exclusão total de tabela LGMRD: sortear deterministicamente (mesmo padrão de `rollFactionCount`/`rollNamingRegister`, [roll-registry.ts](../../../apps/api/src/adventure-generation/roll-registry.ts)) um conceito primário + um MacGuffin, compor uma frase-semente em inglês ("`{conceito} because {MacGuffin}`"), e injetá-la no prompt de autoria ÚNICO como uma restrição a mais (mesmo tratamento de `worldLines`/`characterStory`) — sem chamada de IA nova, sem round-trip extra. O modelo escreve `summary` traduzindo/adaptando essa semente pro idioma-alvo (nunca copiando a palavra em inglês), e o resto do artefato (`story`/`objective`) não pode contradizê-la.

**`setting` também entra como parâmetro pra escrever `summary`.** O vocabulário nativo do LGMRD é fantasia medieval (cripta, obelisco, patrono élfico/anão) — mas `SETTINGS` ([registry-catalog.ts](../../../apps/api/src/adventure-generation/registry-catalog.ts)) inclui eixos que destoam completamente disso: `steampunk`, `post-apocalyptic`, `sci-fi-space-opera`, `cyberpunk`. Quando `world.setting` já está restringido (rolado ou escolhido pela jogadora), a instrução de `summary` tem que pedir TRANSPOSIÇÃO do conceito pro eixo escolhido (ex.: "Kill a villain because of the Obelisk in the Crypts" → num setting `sci-fi-space-opera`, o obelisco/cripta viram um núcleo de reator ancestral numa estação abandonada — mesmo conceito+motivo, substantivos trocados), não a substituição literal. Sem `setting` fixado ("Aleatório"), a semente entra sem essa instrução extra — o modelo é livre pra manter o registro medieval-padrão do LGMRD ou não.

---

## Escopo

### Dentro do escopo

- **Nova função `rollQuestSeed(characterId: string, order: number, attempt = 0): string`** — sorteia, com sub-seeds independentes (mesma disciplina de `tableSeed`/`pickCandidate`, nunca reaproveitar sequência entre rolagens):
  1. **Conceito primário** — 1 linha de `1d20quests` (`readLgmrdTables().tables['1d20quests']`, ex. `"Kill a villain"`).
  2. **Caminho do MacGuffin** — sorteio BINÁRIO entre os 2 caminhos da fórmula do LGMRD:
     - **(A) `locationsmonumentsanditems` + `conditiondescriptionandorigin`, SEMPRE combinadas:** 1 linha inteira de `locationsmonumentsanditems` (`location`+`monument`+`item` da MESMA linha — como `rollContent` já lia antes de ser aposentado) **e**, além dela, **2 dos 3 atributos** de `conditiondescriptionandorigin`, cada um rolado numa coluna INDEPENDENTE (`condition`/`description`/`origin` são, na prática, 3 tabelas de 20 valores empacotadas numa única estrutura — ver *Notas de implementação*; **diferente** do padrão antigo de `rollContent`, que lia os 3 da mesma linha/mesmo índice). As duas peças formam UM MacGuffin só (ex.: "o Obelisco nas Criptas, que está Fumegante").
     - **(B) `patronsandnpcs` sozinha, como alternativa ao caminho A inteiro:** 1 linha inteira (`behavior`+`ancestry`).
  3. Compõe a frase EM INGLÊS (idioma nativo do dataset, [ADR 005](../../adr/005-locale-como-dimensao.md)): `"{conceito primário} because {MacGuffin formatado}"`.
- `readLgmrdTables()` ([lgmrd-tables.ts](../../../apps/api/src/adventure-generation/lgmrd-tables.ts)) ganha consumidor novo — nunca é removida, mesmo com o resto de `roll-content.ts` (US-192) saindo em MA-7.
- `buildAuthoringPrompt` ([ai.service.ts:215](../../../apps/api/src/ai/ai.service.ts)) ganha parâmetro `questSeed: string`, entra como restrição obrigatória (mesmo bloco de `worldLines`): "o gancho central desta aventura nasce de `{questSeed}` (semente em inglês) — escreva `summary` TRADUZINDO/ADAPTANDO essa ideia pro idioma-alvo, nunca copiando a palavra em inglês; `story`/`objective` não podem contradizê-la."
- **`setting` (`params.world.setting`, já lido por `buildAuthoringPrompt`) soma à mesma instrução, quando presente:** "o MacGuffin acima é vocabulário PADRÃO do LGMRD (fantasia medieval) — TRANSPONHA os substantivos pro eixo de Cenário já restringido acima (ex.: obelisco/cripta → núcleo de reator/estação abandonada, num Cenário sci-fi), mantendo conceito+motivo; NÃO force cripta/obelisco/patrono élfico se o Cenário destoar." Sem `setting` fixado, a instrução de transposição NÃO entra (mesmo condicional de `worldLines.length > 0`, [ai.service.ts:236-238](../../../apps/api/src/ai/ai.service.ts)) — o modelo fica livre pra manter ou não o registro medieval-padrão.
- `buildAuthoringSystem` ([ai.service.ts:181](../../../apps/api/src/ai/ai.service.ts)) ganha guarda-corpo negativo contra vazamento de palavra em inglês — mesma categoria de risco já documentada pra `patronsandnpcs` (`roll-content.ts:89-97`, o bug real de "lizardfolk"/"cheery" vazando cru na narração pt-BR).
- `AiService.generateAdventureAuthoring` ([ai.service.ts:1495](../../../apps/api/src/ai/ai.service.ts)) recebe `questSeed` e repassa a `buildAuthoringPrompt`.
- `AdventureService.generateAdventure` chama `rollQuestSeed` no mesmo ponto onde já chama `rollFactionCount`/`rollNamingRegister`, e passa o resultado adiante.
- Teste de regressão: (a) `rollQuestSeed` é determinístico — mesmo `characterId`+`order`+`attempt` produz sempre a mesma semente; (b) `questSeed` chega ao `prompt` de `buildAuthoringPrompt` (assert de substring, mesmo padrão dos outros guards de prompt no arquivo); (c) o guarda-corpo de tradução aparece no `system`; (d) a categoria "2 de 3" nunca sorteia sempre o MESMO par de atributos (amostra pequena, smoke — não estatística completa).
- `pnpm eval` roda e passa (mudança em prompt de geração — regra do projeto, `AGENTS.md`).
- **Nota obrigatória no PR/commit** (não critério de teste, mesma disciplina da US-192 §Critérios #11): registra explicitamente que esta story **reverte, só para `summary`**, a decisão "zero tabela LGMRD" da ADR 012 D5/US-232 — e recomenda atualizar a seção de revisão da ADR (não é este documento que edita o arquivo da ADR).
- **Atualizar [US-237](./US-237-remove-seed-rebaixa-lgmrd-mantem-monster-builder.md)** (nota, não re-escrita da story): `readLgmrdTables`/`lgmrd-tables.ts` deixam de ser candidatos a remoção total no MA-7 — só `rollContent`/`rollPremissaCandidates`/`rollPatronsAndNpcs`/`generatePremissa` (US-192) e os 40 prompts de segredo (US-149, `readSecretPrompts`) continuam mortos.

### Fora do escopo

- **Reviver `rollContent`/`generatePremissa`/`rollPatronsAndNpcs` (US-192).** Código morto continua morto — esta story lê as MESMAS tabelas com uma rolagem nova e mais simples (sem 5 candidatos, sem chamada de IA dedicada), dentro do call único de autoria.
- **Reviver os 40 prompts de segredo (`readSecretPrompts`, US-149).** Tabela diferente, sem relação com a fórmula de quest.
- **Mapa de tradução estática (tipo `PATRON_ROW_PT_BR`) para `1d20quests`/MacGuffin.** A combinatória (20 conceitos × 3 categorias × ~20 linhas cada, e "2 de 3" multiplicando ainda mais) é grande demais pra um mapa fixo valer a pena — diferente de `patronsandnpcs` (20+36 valores discretos, vocabulário fechado pequeno). A tradução/adaptação fica a cargo do MODELO, dentro do prompt — mesma saída que resolvia isso quando `generatePremissa` (US-192) ainda existia.
- **Expor `questSeed` cru à jogadora.** Só inspiração interna de prompt — mesma disciplina de `characterAnchors`/exemplares, nunca aparece no artefato nem na UI.
- **Mudar `story`/`objective`/qualquer outro campo do schema.** Só `summary` recebe a restrição nova; os outros campos só não podem CONTRADIZER a semente (mesma disciplina de `complicacao` na US-192, quando existia).
- **Editar o arquivo da ADR 012.** Fica como nota obrigatória no commit/PR (ver *Dentro do escopo*), não como mudança de código desta story.
- **Dial de dificuldade ou qualquer número mecânico vindo da semente.** `questSeed` é só ficção/gancho — mesma regra de "sem número na prosa" (US-29) que já vale pro resto da autoria.

---

## Modelo de dados proposto

```ts
// apps/api/src/adventure-generation/roll-registry.ts (ou arquivo dedicado — ver Questões em aberto #1)
export function rollQuestSeed(characterId: string, order: number, attempt = 0): string
```

| Retorno | Tipo | Descrição |
|---|---|---|
| `questSeed` | `string` | Frase EM INGLÊS `"{conceito primário} because {MacGuffin}"` — nunca persistida, só entra no prompt de autoria como restrição. |

**Persistência:** nenhuma nova. `questSeed` é efêmero — como `premissaCandidates` era na US-192 — computado a cada chamada de `generateAdventure`, nunca gravado em `Adventure`/`Quest`/`GeneratedAdventureSchema`. `summary` continua `z.string().min(1)`, sem mudança de schema.

---

## Critérios de aceite

- [ ] `rollQuestSeed(characterId, order, attempt)` é determinístico: mesmo trio de argumentos produz sempre a mesma semente.
- [ ] `rollQuestSeed` sorteia o conceito primário de `1d20quests`, o caminho do MacGuffin (binário: A = local/monumento/item + condição/descrição/origem, ou B = patrono/NPC), e o(s) valor(es) de cada tabela envolvida — cada sorteio com sub-seed próprio (nenhum desloca o outro se um mudar).
- [ ] No caminho A, `locationsmonumentsanditems` e `conditiondescriptionandorigin` SEMPRE entram juntas (nunca uma sem a outra); `conditiondescriptionandorigin` sorteia exatamente 2 dos 3 atributos (`condition`/`description`/`origin`), cada um por coluna INDEPENDENTE — não a mesma linha/d20 dos 3 juntos. No caminho B, só `patronsandnpcs` entra.
- [ ] `questSeed` chega ao `prompt` de `buildAuthoringPrompt` (assert de substring).
- [ ] O `system` de `buildAuthoringSystem` instrui explicitamente: traduzir/adaptar a semente pro idioma-alvo, nunca copiar a palavra em inglês.
- [ ] Com `world.setting` presente, o `prompt` inclui a instrução de TRANSPOR o vocabulário medieval-padrão do MacGuffin pro eixo de Cenário restringido (assert de substring, fixture com `setting: 'cyberpunk'` ou similar). Sem `setting` (Aleatório), essa instrução extra NÃO aparece no prompt.
- [ ] `AiService.generateAdventureAuthoring` recebe e repassa `questSeed`; `AdventureService.generateAdventure` chama `rollQuestSeed` e passa adiante, no mesmo ponto de `rollFactionCount`/`rollNamingRegister`.
- [ ] `pnpm typecheck` e `pnpm test` passam.
- [ ] `pnpm eval` passa.
- [ ] **Eval / teste de regressão:** fixture com `characterId`/`order` fixos confere que a MESMA semente chega ao prompt em duas chamadas seguidas (determinismo); fixture separada confere que trocar só `attempt` muda a semente (reseed funciona, US-150).
- [ ] Seed jogado à mão (ou leitura manual de 3-5 aventuras reais geradas): `summary` reflete o conceito primário sorteado sem repetir a palavra em inglês, e sem contradizer o MacGuffin — sem gate automático de qualidade de prosa, essa é a checagem que fica (mesma disciplina da US-198 §Critérios, último item).
- [ ] **Nota no PR/commit** registrando a reversão parcial da ADR 012 D5 (ver *Dentro do escopo*).

---

## Notas de implementação

- **`conditiondescriptionandorigin` como 3 tabelas empacotadas:** confirmado nos dados (`scripts/lazygm/lgmrd-tables.json`) — cada linha tem `condition`/`description`/`origin` em posições que representam 3 d20 diferentes, não uma linha coesa (ex.: linha 1 = `Smoky`/`Ruined`/`Human`, sem relação temática entre si). O padrão ANTIGO de `rollContent` (`roll-content.ts:73-84`) lia os 3 juntos, da MESMA linha — **esta story diverge**: rola cada atributo escolhido (2 dos 3) com ÍNDICE PRÓPRIO, independente. Não reaproveitar `pickRow`/`tableSeed` de `roll-content.ts` sem ajustar pra esse formato.
- **Formato da frase por caminho** — ponto de partida, calibrar lendo saídas reais (mesma disciplina "medir antes de travar" da US-198 Q1):
  - **Caminho A** (`locationsmonumentsanditems` + 2 de 3 `conditiondescriptionandorigin`, sempre combinadas): `"{concept} because of the {monument} in the {location}, which is {attr1} and {attr2}"` — `attr1`/`attr2` são os 2 atributos sorteados (`condition`/`description`/`origin`, quaisquer 2 dos 3), `item` fica disponível pra variação se a frase-base soar repetitiva.
  - **Caminho B** (`patronsandnpcs`, alternativa ao caminho A): `"{concept} because a {behavior} {ancestry} demands it"` (ou similar).
- **Sub-seed:** mesma disciplina de `tableSeed`/`pickCandidate` (`roll-content.ts`/`roll-registry.ts`) — nunca compartilhar sequência entre conceito primário, caminho do MacGuffin (A/B), e a(s) rolagem(ns) dentro do caminho escolhido.
- **`characterAnchors`/`background.story` NÃO entram em `rollQuestSeed`.** A semente é só de tabela — o vínculo pessoal já é responsabilidade do `characterStory` que `buildAuthoringPrompt` já injeta (US-232); `questSeed` é aditivo, não substitui esse tom.
- **Arquivos principais:** `apps/api/src/adventure-generation/roll-registry.ts` (molde de `rollFactionCount`/`rollNamingRegister`) ou um arquivo novo dedicado (ver *Questões em aberto* #1); `apps/api/src/adventure-generation/lgmrd-tables.ts` (`readLgmrdTables`, sem mudança de forma); `apps/api/src/ai/ai.service.ts` (`AUTHORING_SCHEMA`, `buildAuthoringSystem`, `buildAuthoringPrompt`, `generateAdventureAuthoring`); `apps/api/src/adventure/adventure.service.ts` (`generateAdventure`, ponto de chamada).

---

## Questões em aberto

1. **`rollQuestSeed` mora em `roll-registry.ts` ou em arquivo próprio?** `roll-registry.ts` hoje só lê arrays estáticos em TS (`SETTINGS`/`TONES`/`NAMING_REGISTERS`); esta função lê um JSON do disco (`readLgmrdTables`, fs). Misturar as duas fontes de dado no mesmo arquivo pode confundir — um `roll-quest-seed.ts` dedicado, ao lado de `lgmrd-tables.ts`, talvez fique mais limpo. Decidir na implementação, sem travar a story.
2. **Formato exato da frase por categoria** (ver *Notas de implementação*) — proposta é ponto de partida; calibrar com saídas reais antes de travar um formato final, mesma disciplina "medir antes de otimizar" de outras stories do motor (ex. US-193, US-198).
3. **Dado do caminho do MacGuffin (binário A/B): 50/50 (`rand() < 0.5`) ou algum outro peso?** O LGMRD não prescreve um dado específico pra ESSA escolha (é meta-escolha entre 2 caminhos, não uma tabela do livro em si) — proposta: 50/50, mesmo espírito de `rollFactionCount` (que também já foge de "d20 puro" pra um intervalo pequeno, `[2,4]`).
4. **Vale medir se `summary` realmente ficou menos genérico?** Sem gate automático de qualidade de prosa nesta fase (mesma disciplina de US-198), a única checagem é leitura manual (ver Critérios de aceite, último item) — se a mantenedora achar que não mudou o suficiente após algumas gerações reais, a fórmula (item 2 acima) é o primeiro lugar a ajustar antes de reverter a story inteira.

---

## Referências no código

- [apps/api/src/adventure-generation/roll-registry.ts](../../../apps/api/src/adventure-generation/roll-registry.ts) — `rollFactionCount`/`rollNamingRegister`, molde direto a espelhar (sub-seed único, entra como restrição do prompt de autoria).
- [apps/api/src/adventure-generation/lgmrd-tables.ts](../../../apps/api/src/adventure-generation/lgmrd-tables.ts) — `readLgmrdTables`, ganha consumidor novo.
- `apps/api/src/adventure-generation/roll-content.ts:73-84` — leitura ANTIGA de `conditiondescriptionandorigin` (mesma linha pros 3 atributos) que esta story diverge (2 colunas independentes); `localizePatronRow` (linha 153) — precedente do guarda-corpo "nunca vazar palavra em inglês crua".
- [apps/api/src/ai/ai.service.ts:114-173](../../../apps/api/src/ai/ai.service.ts) — `AUTHORING_SCHEMA`, campo `summary` (linha 120).
- [apps/api/src/ai/ai.service.ts:181-256](../../../apps/api/src/ai/ai.service.ts) — `buildAuthoringSystem`/`buildAuthoringPrompt`, onde `questSeed` entra como restrição.
- [apps/api/src/ai/ai.service.ts:1495](../../../apps/api/src/ai/ai.service.ts) — `generateAdventureAuthoring`.
- [apps/api/src/adventure/adventure.service.ts](../../../apps/api/src/adventure/adventure.service.ts) — `generateAdventure`, ponto de chamada de `rollFactionCount`/`rollNamingRegister`, onde `rollQuestSeed` entra também.
- [scripts/lazygm/lgmrd-tables.json](../../../scripts/lazygm/lgmrd-tables.json) — dataset: `1d20quests`, `locationsmonumentsanditems`, `conditiondescriptionandorigin`, `patronsandnpcs`.
- [apps/api/src/adventure-generation/registry-catalog.ts](../../../apps/api/src/adventure-generation/registry-catalog.ts) — `SETTINGS`, inclui eixos que destoam do vocabulário nativo do LGMRD (`steampunk`/`post-apocalyptic`/`sci-fi-space-opera`/`cyberpunk`) — motivo da instrução de transposição.
- [docs/adr/012-aventura-gerada-como-dado.md](../../adr/012-aventura-gerada-como-dado.md) D5 — decisão que esta story reverte parcialmente (só `summary`).
- [US-237](./US-237-remove-seed-rebaixa-lgmrd-mantem-monster-builder.md) — precisa anotar exceção (`readLgmrdTables`/`lgmrd-tables.ts` não morrem).
- [US-192](./US-192-premissa-elaborada-com-vinculo-pessoal.md) — precedente aposentado, técnica parecida (tradução via modelo) mas não revivido igual (sem candidatos múltiplos, sem chamada de IA dedicada).
