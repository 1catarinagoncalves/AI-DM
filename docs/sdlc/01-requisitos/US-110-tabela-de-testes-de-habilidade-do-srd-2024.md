# US-110 — Tabela de testes de habilidade do SRD 2024 escolhe o teste da situação

**Épico:** 3 — Narração e mecânica
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada (06/08/2026 — um critério em aberto de propósito: ver "Eval / teste de regressão")
**Depende de:** [US-108](./US-108-tabela-de-modificadores-do-srd-2024.md) (o `Rule.json` já entrou no `sync` e o padrão de extração/artefato já existe) · [US-38](./US-38-rolagens-ancoradas-na-ficha.md) (o modificador já vem da ficha; falta ancorar QUAL teste é feito)
**Relacionado:** [US-27](./US-27-pericias-do-personagem.md) (as 18 perícias e seus atributos-âncora, já vindos do `Skill.json`) · [US-77](./US-77-reancorar-assertivas-de-prompt-e-guard-de-regressao.md) (como ancorar assertiva nova no prompt) · [US-72](./US-72-evals-de-prompt-resistentes-a-reescrita.md) (evals resistentes a reescrita) · US-48 (corpus de regras — o mesmo `Rule.json`) · [US-109](./US-109-bonus-circunstancial-no-teste-de-d20.md) (o outro termo da mesma soma) · [ADR 007](../../adr/007-camadas-do-prompt-por-volatilidade.md) (camadas do prompt por volatilidade)
**Criada em:** 2026-08-06

---

## História

> **Como** jogadora,
> **quero** que o Mestre escolha **qual** teste rolar seguindo a tabela de exemplos do SRD 2024 — Força para arrombar, Destreza para se mover em silêncio, Sabedoria para notar —,
> **para que** a mesma situação sempre chame o mesmo tipo de teste, em vez de depender de qual atributo o modelo lembrou naquele turno.

---

## Contexto e motivação

### O problema observado

O SRD 2024, no ruleset `srd-2024_d20-tests` (já baixado no `Rule.json` pela [US-108](./US-108-tabela-de-modificadores-do-srd-2024.md), tag `v2.1.0`), publica **tabelas de exemplo que dizem qual habilidade a situação chama**. A da regra `srd-2024_d20-tests_ability-checks` (*Ability Check Examples*, texto verbatim do dataset):

| Ability | Make a Check To … |
|---|---|
| Strength | Lift, push, pull, or break something |
| Dexterity | Move nimbly, quickly, or quietly |
| Constitution | Push your body beyond normal limits |
| Intelligence | Reason or remember |
| Wisdom | Notice things in the environment or in creatures' behavior |
| Charisma | Influence, entertain, or deceive |

O prompt do Mestre **não tem nada disso**. A única instrução sobre a escolha é uma frase em [`dm-system.ts`](../../../packages/ai-engine/src/prompts/dm-system.ts): *"ONE action → ONE check: pick the single most relevant skill"*. "Mais relevante" segundo quem? Segundo o que o modelo lembrar do 5e — que é justamente a memória que o [ADR 003](../../adr/003-sistemas-como-dado.md) e a [US-47](./US-47-ingestao-srd-como-dado.md) tiraram de todo o resto do sistema.

O que a [US-38](./US-38-rolagens-ancoradas-na-ficha.md) resolveu foi o **número**: o modificador vem da ficha, o modelo não inventa `+6`. Mas **a escolha do teste continua livre**. Empurrar uma porta emperrada pode virar Atletismo num turno e Força cru no outro; perceber um cheiro estranho pode virar Percepção (Sabedoria) ou Investigação (Inteligência) conforme o humor da amostragem. As duas rolagens são igualmente "válidas" para o código — `resolveRollModifier` resolve as duas e devolve modificadores diferentes, de perícias diferentes, para a mesma ficção.

### Por que a solução atual não basta

O catálogo de perícias já traz o atributo-âncora de cada uma (`Skill.json`, 18 perícias: `athletics :: str`, `perception :: wis`, `stealth :: dex`…), e a [US-27](./US-27-pericias-do-personagem.md) já usa esse vínculo para calcular o modificador. Mas o vínculo é **perícia → atributo**, não **situação → teste**. Ele responde "quanto vale Furtividade", nunca "isto aqui é Furtividade".

E o prompt não pode ser corrigido "escrevendo melhor": qualquer lista de exemplos redigida à mão vira regra autoral sem procedência — exatamente o defeito que a [US-108](./US-108-tabela-de-modificadores-do-srd-2024.md) tirou da tabela de modificadores. A tabela certa já existe, é normativa, tem licença CC-BY e **já está baixada no repo**.

### A proposta

Extrair as tabelas de exemplo do ruleset `srd-2024_d20-tests` como **artefato versionado** (mesmo pipeline e mesmo padrão da US-108) e **renderizar a tabela de testes de habilidade dentro da seção de regras do system prompt**, com os rótulos de atributo que a ficha já usa.

A tabela entra como **critério de escolha**, não como classificador: continua sendo o modelo que lê a ficção e decide. O que muda é que a régua da decisão passa a ser o texto do SRD, versionado e auditável, em vez da memória do modelo.

---

## Escopo

### Dentro do escopo

- **Extração das tabelas de exemplo** — módulo próprio em `scripts/srd/`, no molde do [`ability-modifiers.mjs`](../../../scripts/srd/ability-modifiers.mjs): lê o `desc` markdown das regras do ruleset `srd-2024_d20-tests`, produz `d20-tests.srd-2024.json` versionado no repo, com procedência (documento, tag, `pk`s, licença). **Na implementação o artefato foi gravado em [`packages/ai-engine/src/prompts/`](../../../packages/ai-engine/src/prompts/d20-tests.srd-2024.json), não em `scripts/srd/`** — ele tem consumidor de runtime (o builder do prompt o importa como módulo) e JSON de fora do pacote arrastaria o `rootDir` do `tsc`, a armadilha documentada na US-108. O `NOTICE` aponta para lá.
- **Falha alta na extração** — ruleset ausente, `pk` ausente ou tabela com número de linhas diferente do esperado reprovam o `ingest` com mensagem explícita. Bump de tag que mexa nas tabelas aparece no diff, não em silêncio.
- **Bloco no system prompt, só no ramo do sistema nomeado** — as 6 linhas da *Ability Check Examples* entram na seção `## Rules` de [`dm-system.ts`](../../../packages/ai-engine/src/prompts/dm-system.ts), usando os **mesmos rótulos de atributo que a linha `Attributes` da ficha já imprime** (o modelo precisa ligar "Strength" ao `FOR 16` que ele vê). O ramo `Free` **não** recebe a tabela (decidido em 06/08/2026 — ver "Questões em aberto" 1).
- **Atribuição** — [`NOTICE-open5e.md`](../../../scripts/srd/NOTICE-open5e.md) passa a listar o derivado novo, como já lista o da US-108.
- **Testes** — do parser (em `ingest.test.mjs`, junto dos da US-108) e do prompt (o bloco renderiza as 6 linhas vindas do artefato, com âncora feita na convenção do [`PROMPT-ANCHORS.md`](../../../evals/PROMPT-ANCHORS.md)).
- ~~**Guard de drift** — hash do bloco renderizado, no molde da `NARRATIVE_CRAFT_SECTION` da [US-36](./US-36-eval-de-qualidade-da-narracao.md).~~ **Não implementado, por não caber**: aquele hash existe porque a barra de ofício e a rubrica são DUAS fontes escritas à mão da mesma coisa. Aqui há uma fonte só — o bloco é derivado do artefato. Um hash aqui seria snapshot de conteúdo gerado, e o próprio comentário do guard da US-36 avisa que snapshot convida ao reflexo `-u`. O que substitui: o teste **lê o mesmo artefato** que o prompt importa, então tabela fixada à mão no prompt fica vermelha no primeiro bump de tag.
- **Um caso de eval vivo** — situação clara ("a porta está emperrada"), esperando o teste da família certa. É a **única** verificação que mede obediência do modelo; o resto mede que a régua está no prompt. **Não implementado** — ver o critério de aceite.

### Fora do escopo

- **Saving throws e attack rolls como mecânica.** As tabelas *Saving Throw Examples* e *Attack Roll Abilities* saem no mesmo artefato (mesmo ruleset, mesmo parser, custo zero a mais), mas **não vão para o prompt**: a tool `rollDice` não tem noção de tipo de teste — tudo que ela resolve é teste de habilidade. Ensinar ao Mestre uma mecânica que a tool não executa produz narração anunciando salvaguarda que ninguém rola. Story própria, e é ela que dá `kind` à tool.
- **Classe de Dificuldade.** A *Typical Difficulty Classes* (5 a 30) está no `desc` da mesma regra e sai no artefato, mas responde "quão difícil", não "qual teste" — e o Game Server não compara total com CD hoje. Sibling desta.
- **Classificador determinístico situação → perícia.** Um mapa de palavra-chave ("porta" → Atletismo) seria pior que o modelo em ficção real e brigaria com o desenho da US-38. A tabela é **guia no prompt**, nunca lookup no servidor.
- **Aterrissar na PERÍCIA certa.** Esta story orienta a escolha da **habilidade** — o nível em que o SRD dá exemplos. A linha derivada que desdobra habilidade em perícias ("Wisdom → Percepção, Intuição, Sobrevivência") **vem depois** (decidido em 06/08/2026 — ver "Questões em aberto" 2): mede-se antes se a tabela de habilidade sozinha já muda a escolha, com o caso de eval desta story.
- **O ramo `Free` do prompt.** Não recebe a tabela (decisão de 06/08/2026): o Free segue antimecânico. Se um dia mudar, é decisão de produto do Free, não desta story.
- **Mostrar o atributo-âncora na linha de perícias** (`Furtividade (DES) +5`). Parece a correção óbvia e é uma armadilha: `resolveRollModifier` casa por rótulo normalizado, e o modelo passaria `"Furtividade (DES)"` como `skill` — sem match, `unresolved`, `+0` silencioso. Só entra junto de um matcher mais tolerante.
- **Vantagem/desvantagem** e **bônus circunstancial** ([US-109](./US-109-bonus-circunstancial-no-teste-de-d20.md)) — outros termos/outras regras do mesmo ruleset.
- **Tradução do texto das tabelas para pt-BR.** O system prompt é escrito em inglês (só a saída segue o `targetLanguage`), então a tabela em inglês é coerente com o arquivo. Traduzir segue a disciplina da [US-52](./US-52-traducao-automatica-do-srd.md), se algum dia a tabela for exibida a gente.

---

## Modelo de dados proposto

Artefato derivado, versionado no repo (o `scripts/srd/_data/` é gitignored — sem o derivado commitado, nem o prompt nem o teste rodam em CI):

```json
{
  "source": {
    "document": "srd-2024",
    "tag": "v2.1.0",
    "ruleset": "srd-2024_d20-tests",
    "rules": ["srd-2024_d20-tests_ability-checks", "srd-2024_d20-tests_saving-throw", "srd-2024_d20-tests_attack-rolls"],
    "license": "CC-BY-4.0"
  },
  "abilityChecks": [
    { "ability": "strength", "example": "Lift, push, pull, or break something" },
    { "ability": "dexterity", "example": "Move nimbly, quickly, or quietly" }
  ],
  "savingThrows": [{ "ability": "strength", "example": "Physically resist direct force" }],
  "attackRolls": [{ "ability": "strength", "example": "Melee attack with a weapon or an Unarmed Strike" }],
  "difficultyClasses": [{ "task": "Very easy", "dc": 5 }]
}
```

| Campo | Tipo | Descrição |
|---|---|---|
| `source` | objeto | Procedência: documento, tag, ruleset, `pk`s de origem, licença. É o que torna o bump auditável no diff. |
| `abilityChecks` | lista (6) | A tabela que vai para o prompt. `ability` na **chave canônica do catálogo** (`strength`, `dexterity`, …) — que é a do `config.attributes` e a que o `ABILITY_MAP` do ingest já produz a partir do `str`/`dex` cru do dataset. |
| `savingThrows` | lista (6) | Importada, não usada ainda (a tool não tem tipo de teste). |
| `attackRolls` | lista (3) | Idem. `Varies` (ataque mágico) não é atributo — sai com `ability: null`, e o texto do exemplo já explica. |
| `difficultyClasses` | lista (6) | Importada, não usada ainda (não há comparação com CD). |

**Persistência:** arquivo no repo, gerado pelo `ingest`, revisado no diff a cada bump de tag. Não vai para o banco nem para o `System.config`: o único consumidor de runtime é o builder do prompt, que o importa como módulo do próprio pacote (o `tsc` copia o JSON para o `dist`).

---

## Critérios de aceite

- [x] O `ingest` gera `d20-tests.srd-2024.json` com as 6 linhas de *Ability Check Examples*, as 6 de *Saving Throw Examples*, as 3 de *Attack Roll Abilities*, as 6 de CD e o bloco `source`.
- [x] O `ingest` **falha com mensagem explícita** se o ruleset, um `pk` ou uma das tabelas sumir/mudar de tamanho no dado baixado.
- [x] As chaves de habilidade do artefato são as mesmas do catálogo (`strength`…`charisma`), **conferidas contra os atributos que aquele bump construiu** — não contra constante paralela. Habilidade desconhecida falha com o valor ofensor.
- [x] O system prompt do sistema SRD contém as 6 linhas da tabela de testes de habilidade, com os **rótulos de atributo do config ativo** — os mesmos que a linha `Attributes` da ficha imprime.
- [x] O system prompt do sistema `Free` **não** contém a tabela — as duas metades verificadas no mesmo teste.
- [x] O bloco é montado a partir do artefato, não digitado no `dm-system.ts`: o teste monta a linha esperada a partir do MESMO JSON que o prompt importa, então texto fixado à mão diverge no primeiro bump de tag.
- [x] O bloco fica na **parte estática** do prompt (dentro do `rulesSection`, antes do bloco de estado do turno), sem quebrar a fronteira de cache da [US-55](./US-55-prompt-caching-do-dm.md) / [ADR 007](../../adr/007-camadas-do-prompt-por-volatilidade.md).
- [x] [`NOTICE-open5e.md`](../../../scripts/srd/NOTICE-open5e.md) lista o derivado novo.
- [x] **Teste de regressão (a) e (b):** 7 testes do parser em `ingest.test.mjs` — tabela ausente, exemplo faltando, habilidade fora do catálogo e a segunda tabela do mesmo `desc` (CD) não virando exemplo; mais 4 testes do prompt em `dm-system.test.ts` e o eval case `us-110-tabela-de-testes.ts`.
- [ ] **(c) Eval vivo da obediência do modelo — NÃO entregue, e não por esquecimento.** Medir a escolha exige inspecionar a trajetória de *tool calling*, e o gerador dos evals é **deliberadamente sem tools** ([`narration-gen.ts`](../../../packages/ai-engine/src/narration-gen.ts)): a [US-70](./US-70-piso-por-dimensao-e-robustez-do-eval.md) tirou o tool-loop de lá porque o modelo gastava os passos em chamadas e devolvia narração vazia. Construir esse harness é story própria — e é ela que responde a questão 3 abaixo. Até lá, esta story entrega **procedência e régua no prompt**, não comportamento medido.

---

## Notas de implementação

- **A extração é a mesma da US-108.** `desc` é markdown com a tabela embutida (`|Ability|Make a Check To …|`); reaproveite o leitor de tabela do [`ability-modifiers.mjs`](../../../scripts/srd/ability-modifiers.mjs) em vez de escrever um segundo parser. Vale a mesma armadilha: o texto do Open5e **não é ASCII** (U+2212, U+2013, reticências `…`).
- **Ponto de inserção no prompt:** o `rulesSection` de [`dm-system.ts`](../../../packages/ai-engine/src/prompts/dm-system.ts) já se ramifica entre `Free` e sistema nomeado. A tabela entra no ramo do sistema nomeado, ao lado de *"Apply the rules of … correctly"*, que é onde ela responde.
- **Rótulos, não chaves.** O prompt já imprime `FOR 16 / DES 12` com os rótulos do config (US-99). A tabela tem de usar a mesma fonte de rótulo, senão o modelo lê "Strength" e vê "FOR" — dois vocabulários para a mesma coisa.
- **Custo de token é pequeno e estático:** 6 linhas curtas, na camada cacheada. Não mexe na fronteira de cache; mexe uma vez no baseline medido pela US-104.
- **Âncora do teste do prompt:** siga [`PROMPT-ANCHORS.md`](../../../evals/PROMPT-ANCHORS.md) — a âncora estável aqui é **o dado injetado** (o texto da linha vinda do artefato), não a prosa que a introduz. E checar unicidade: `Strength`/`FOR` já aparecem na ficha renderizada.
- **A tabela não substitui a regra de QUANDO rolar.** A ordem de resolução do turno já diz que ação trivial não rola e que Percepção não revela o que está à vista. A tabela responde a pergunta seguinte — escolhido rolar, rolar o quê. Deixe as duas separadas no prompt; fundi-las produz o efeito colateral clássico de o modelo passar a rolar mais.

---

## Questões em aberto

1. ✅ **O ramo `Free` também recebe a tabela?** **Não** (06/08/2026). Só o ramo do sistema nomeado (D&D/SRD). O Free herda o catálogo de perícias do SRD ([US-106](./US-106-catalogo-com-chave-e-free-herdando-o-srd.md)), mas a prosa dele é deliberadamente antimecânica (*"not bound to any official RPG system"*) — enfiar tabela normativa lá contradiz o que o próprio prompt promete ao jogador. Consequência para quem implementar: o bloco é montado dentro do ramo `!isFree` do `rulesSection`, e o teste do prompt tem de provar as duas metades — presente no sistema nomeado, **ausente** no Free.
2. ✅ **A tabela orienta a escolha da PERÍCIA ou só do ATRIBUTO?** **Só a habilidade, por ora** (06/08/2026) — que é o nível em que o SRD dá exemplos. A linha derivada habilidade → perícias fica para uma story posterior: o modelo já vê a linha `Skills` com as 18 perícias, então a derivação pode ser redundante, e o caso de eval desta story é o que diz se a tabela de habilidade sozinha já corrige a escolha. Engordar o prompt antes de medir é o erro que esta ordem evita.
3. **Quanto vale de fato?** Segue aberta, e agora com o motivo preciso: a régua no prompt está verificada, a obediência do modelo **não foi medida** — o harness que mediria (trajetória de tool calling) não existe, e o gerador dos evals é sem tools por decisão da [US-70](./US-70-piso-por-dimensao-e-robustez-do-eval.md). Fechar esta questão é construir esse harness (com chave, US-94) — story própria, que também destrava medir a questão 2 (habilidade basta, ou precisa desdobrar em perícia?).

---

## Referências no código

- `scripts/srd/_data/Rule.json` — o ruleset `srd-2024_d20-tests` e suas 4 regras (baixado pela US-108, não versionado).
- `scripts/srd/d20-tests.mjs` — `parseD20Tests`: separa as tabelas do `desc` (a regra dos exemplos traz DUAS), mapeia habilidade → chave canônica e cobra a cobertura das 6.
- `packages/ai-engine/src/prompts/d20-tests.srd-2024.json` — o artefato gerado, importado pelo prompt.
- `scripts/srd/ability-modifiers.mjs` — `toAscii` e `requireRule`, exportados na US-110: o mesmo campo do mesmo arquivo, um normalizador de tipografia só.
- `scripts/srd/ingest.mjs` — onde o artefato novo é gravado, junto do da US-108.
- `scripts/srd/ingest.test.mjs` — onde entram os testes do parser (é este arquivo que o CI roda em `pnpm srd:ingest:test`).
- `scripts/srd/NOTICE-open5e.md` — atribuição CC-BY dos derivados.
- `packages/ai-engine/src/prompts/dm-system.ts` — `abilityCheckTable` (o bloco novo) dentro do ramo não-`Free` do `rulesSection`; a linha `Attributes` é a fonte dos rótulos, e a regra `ONE action → ONE check` continua respondendo a outra pergunta.
- `packages/ai-engine/src/prompts/dm-system.test.ts` — as 4 assertivas do bloco novo, ancoradas no dado do artefato.
- `evals/cases/us-110-tabela-de-testes.ts` — o eval case (determinístico: contrato do prompt, não obediência).
- `packages/shared/src/roll.ts` — `resolveRollModifier`: por que mexer no formato da linha de perícias é arriscado (casamento por rótulo normalizado).
- `evals/PROMPT-ANCHORS.md` — convenção da âncora.
- `evals/cases/us-38-rolagens-ancoradas.ts` — o caso vizinho, modelo para o caso de eval desta story.
