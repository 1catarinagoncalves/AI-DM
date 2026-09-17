# US-252 — Papel do encontro vira monstro nominal do bestiário, não rótulo genérico ("Minion")

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** [US-251](./US-251-bestiario-nominal-nao-existe-como-dado-do-sistema.md) (`bestiary-5e.json`, o dado que esta story consome) · [US-233](./US-233-numeros-dos-encontros-passo-2-5e.md) (PASSO 2, `assignCombatRoles`/`assignBudgetedCombatRoles` — o ponto exato onde `npc.combatRole` é atribuído hoje, e onde esta story troca o nome)
**Relacionado:** [US-152](./US-152-statblocks-papel-orcamento.md) (`MONSTER_ROLE_CR`, os três papéis — não mudam, só ganham nome real por trás) · [US-250](./US-250-autoria-inventa-numero-de-inimigos-sem-orcamento-de-cr.md) (CR como parâmetro de ENTRADA da autoria — eixo diferente, mas sem ela `assignBudgetedCombatRoles` devolve `combatRole: undefined` pra TODO NPC em nível 1-3/modo `'adventure'`, sempre — `sumBudget` é 0 nesse caso, [monster-roles.ts:128](../../../apps/api/src/adventure-generation/monster-roles.ts), qualquer `cr > 0` já estoura; esta story não depende dela pra RODAR, mas sem ela só produz `nominalCreature` em nível 4+ ou modo `'challenge'`) · [US-253](./US-253-autoria-recebe-nome-do-monstro-nominal-como-parametro.md) (evolução desta story: leva o nome escolhido aqui pro prompt de autoria, quando US-250 estiver pronta) · [US-29](./US-29-saneamento-de-rolagens-ficticias.md) (HP/CD/ataque não vêm do modelo nem deste bestiário — só nome/tipo, sem número de combate)
**Criada em:** 2026-09-17 — segunda parte do pedido de bestiário nominal (US-251 é o dado; esta é o consumo mínimo, sem esperar a inversão de ordem que US-253 propõe).

---

## História

> **Como** jogadora,
> **quero** que os inimigos de um encontro de combate tenham nome de criatura de verdade ("Goblin Minion", "Kobold Warrior") em vez de um rótulo mecânico exposto ("Minion", "Soldier"),
> **para que** a ficção e a mecânica falem do mesmo monstro, sem eu nunca ver o vocabulário interno do motor.

---

## Contexto e motivação

### O problema observado

`buildEncounterNpcs` ([monster-roles.ts:138-149](../../../apps/api/src/adventure-generation/monster-roles.ts)) escreve `name: role` — literalmente a string `"Minion"`, `"Soldier"` ou `"Brute"` como NOME do NPC (função hoje sem chamador em produção, ver comentário "cleanup em MA-7", mas o padrão persiste). No caminho realmente ativo (PASSO 2, US-233, [adventure.service.ts:325-332](../../../apps/api/src/adventure/adventure.service.ts)), o `name` do NPC já vem da FICÇÃO (autoria, US-232) — mas `npc.combatRole` (o papel mecânico atribuído por `assignBudgetedCombatRoles`) nunca é usado pra ENRIQUECER esse nome com uma criatura real: fica só o rótulo técnico internamente, e a autoria narra o inimigo do jeito que quiser, sem noção de qual criatura o papel representa.

### Por que a solução atual não basta

Hoje não existe NENHUM ponto do pipeline que sugira "este `combatRole: 'Soldier'` (CR 1/2) é, por exemplo, um Orc" — só o CR abstrato. O exemplar de referência que ancora o eval da estrutura ([evals/exemplars/cripta-do-veu-silencioso.md](../../../evals/exemplars/cripta-do-veu-silencioso.md)) usa criatura nomeada e reconhecível ("4x Orc Bárbaro", "6x Esqueleto Guardião") — o motor real não tem de onde tirar esse nome.

### A proposta

Depois que `assignBudgetedCombatRoles` atribui `combatRole` a cada NPC de combate (PASSO 2, comportamento intacto), um passo novo escolhe uma criatura do bestiário (US-251, `bestiary-5e.json`) com `cr` igual ao `MONSTER_ROLE_CR[combatRole]`, filtrada por `type` pra combinar com o tema/tom já presente na ficção do encontro (ex.: encontro com NPCs `type: 'humanoid'` puxa criatura humanoide, não um `ooze`). Determinístico (mesmo espírito de `assignCombatRoles`: sem RNG novo — índice estável por `npcId`/seed já existente). O nome escolhido some do dado interno do NPC (`combatRole`) e vira insumo pra quem narra — não aparece cru na prosa como "Goblin Minion" gritado pelo jogador; a ficção pode ADAPTAR (mesmo tratamento de `questSeed`, US-241).

---

## Escopo

### Dentro do escopo

- **Realocar o artefato de US-251** ([`scripts/srd/ingest.mjs`](../../../scripts/srd/ingest.mjs)): trocar `write('bestiary-5e.json', bestiary)` ([`ingest.mjs:1431`](../../../scripts/srd/ingest.mjs)) por um `BESTIARY_PATH` explícito (molde de `D20_TESTS_PATH`, [`ingest.mjs:55`](../../../scripts/srd/ingest.mjs)) apontando pra `apps/api/src/adventure-generation/bestiary-5e.json`, e `writeFile(BESTIARY_PATH, stableStringify(bestiary) + '\n')` (molde de [`ingest.mjs:1438`](../../../scripts/srd/ingest.mjs)). Rodar `pnpm --filter @ai-dm/api ...` o script de ingest de novo, apagar `scripts/srd/bestiary-5e.json` (não fica duplicado — ver *Notas de implementação*). Pré-requisito da função abaixo (precisa existir onde `monster-roles.ts` consegue importar direto).
- Nova função pura em `monster-roles.ts` (ou arquivo irmão): dado `combatRole` (`MonsterRole`) + um `type` de tema preferido (opcional) + o bestiário (US-251, agora em `apps/api/src/adventure-generation/bestiary-5e.json`), devolve o `name` de uma criatura com `cr === MONSTER_ROLE_CR[combatRole]` (ou o mais próximo, se o CR exato não tiver candidato do `type` pedido).
- PASSO 2 ([adventure.service.ts:325-332](../../../apps/api/src/adventure/adventure.service.ts)) ganha essa chamada logo depois de atribuir `combatRole` — o `AdventureNpc` passa a carregar o nome da criatura nominal (campo novo, ver *Modelo de dados proposto*) além do `name` narrativo já escrito pela autoria.
- Tema preferido: derivado do `type`/vibe já presente no encontro (ex.: `location.vibe`/`encounter.type`) — sem IA nova, heurística determinística (ver *Notas de implementação*).
- Determinístico: mesmo `combatRole` + mesmo tema produz sempre a mesma criatura candidata a um índice dado (sem depender de ordem de iteração do array do bestiário).
- Testes de regressão: `combatRole: 'Minion'` devolve criatura de CR 1/8; tema `humanoid` restringe corretamente; ausência de candidato no tema pedido cai pra qualquer `type` (fallback documentado, não erro).
- `pnpm eval` roda e passa.

### Fora do escopo

- **Ordem do pipeline** (nome escolhido ANTES da autoria escrever a ficção, entrando como parâmetro do prompt) — story própria: [US-253](./US-253-autoria-recebe-nome-do-monstro-nominal-como-parametro.md). Esta story escolhe o nome DEPOIS, no mesmo ponto que `combatRole` já é atribuído hoje.
- **Expor o nome nominal na prosa como está no bestiário** (inglês cru) — quem narra decide se traduz/adapta; esta story só disponibiliza o dado, não instrui o prompt de narração (isso é consumo futuro, potencialmente parte de US-253 ou de quem escrever `fiction`/`behaviors`).
- **Statblock completo do monstro nominal** (ataques, HP, CA) — sem consumidor até combate por turno existir (mesmo corte da US-152/US-251).
- **`buildEncounterNpcs`** (a função hoje sem chamador) — não é reativada por esta story; o ponto de encaixe real é o PASSO 2 (US-233), já em produção.

---

## Modelo de dados proposto

```ts
// packages/shared/src/types/adventure-generation.ts
// NOVO campo, opcional — mesmo padrão de combatRole (US-233): ausente pra NPC narrativo.
export const AdventureNpcSchema = z.object({
  // ...campos existentes (id, name, role, want, factionId, combatRole)...
  nominalCreature: z.string().min(1).optional(), // US-252: nome do bestiário (SRD), em inglês
})
```

```ts
// apps/api/src/adventure-generation/monster-roles.ts (ou bestiary.ts, novo)
// Determinístico: mesmo combatRole+tema+índice produz sempre a mesma criatura.
export function chooseNominalCreature(
  combatRole: MonsterRole,
  preferredType: string | undefined,
  bestiary: BestiaryCreature[],
  index: number,
): string // devolve BestiaryCreature.name
```

**Persistência:** `nominalCreature` persiste em `GeneratedAdventure.npcs[]` (mesmo caminho que `combatRole` já persiste, US-233) — dado transiente-mas-gravado, não recalculado a cada turno.

---

## Critérios de aceite

- [x] Todo NPC com `combatRole` atribuído (PASSO 2) recebe `nominalCreature` correspondente, com `cr` do bestiário igual a `MONSTER_ROLE_CR[combatRole]`.
- [x] Quando um tema preferido é informado e existe candidato desse `type` no CR certo, a escolha respeita o tema (ex.: `humanoid` nunca devolve um `ooze`).
- [x] Quando não existe candidato do tema pedido naquele CR exato, cai pra qualquer `type` do mesmo CR — nunca lança erro, nunca deixa `nominalCreature` ausente pra um NPC com `combatRole`.
- [x] Mesma entrada (`combatRole`, tema, índice) produz sempre o mesmo nome — testável por igualdade, sem RNG.
- [x] `GeneratedAdventureSchema.parse()` passa com o campo novo.
- [x] `pnpm typecheck`, `pnpm test` e `pnpm eval` passam.
- [x] **Eval / teste de regressão:** fixture com 3 `combatRole` diferentes (Minion/Soldier/Brute) e bestiário reduzido (US-251) → cada um recebe `nominalCreature` do CR certo; fixture sem candidato no tema pedido → cai pro fallback sem quebrar. ([`bestiary.test.ts`](../../../apps/api/src/adventure-generation/bestiary.test.ts))

---

## Notas de implementação

- **Reusar o bestiário de US-251 tal como está** — sem re-derivar CR, sem parser novo.
- **Heurística de tema:** primeira aproximação razoável é `encounter.type`/`location.vibe` já presentes no schema (`combat`/`skill`/`social` não mapeia direto pra `type` de criatura, então provavelmente o tema vem de outro sinal — ex. o `factionId`/`kind` da facção dona do encontro, se existir, ou simplesmente nenhum tema restrito na primeira versão, com `preferredType` opcional e fallback já cobrindo o caso comum). Calibrar durante implementação; não travar a story nisso.
  **Confirmado por inspeção do schema real (17/09/2026):** `location.vibe` NÃO é um segundo sinal — [`adventure-generation.ts:74-77`](../../../packages/shared/src/types/adventure-generation.ts) documenta "mesmos 3 valores de `AdventureEncounterSchema.type`" (`combat`/`skill`/`social`), o MESMO eixo já descartado por não mapear pra `type` de criatura. Sobra só `faction.kind` ([`adventure-generation.ts:36`](../../../packages/shared/src/types/adventure-generation.ts)) — string LIVRE (`"poder"`/`"submundo"`/`"culto"`...), sem correspondência com as 14 categorias do bestiário (`humanoid`/`undead`/`beast`...); mapear um pro outro é lógica nova, não especificada aqui. Forte indício de que a v1 sai sem filtro de tema — só CR — não por preguiça, mas porque nenhum dos dois sinais que o schema oferece hoje serve.
- **Falta de candidato em CR exato:** se o bestiário não tiver NENHUMA criatura em `cr === MONSTER_ROLE_CR[combatRole]` (ex.: CR 1/8 com poucas entradas dependendo da decisão da US-251 sobre união 5.1/5.2), decidir fallback pro CR mais próximo — mesmo espírito de "nunca falha silenciosamente, mas também nunca quebra a geração por isso".
- **`index` como parâmetro** em vez de `Math.random()` — mesmo padrão de determinismo que `assignCombatRoles` já estabeleceu (US-233); a fonte do índice pode ser a posição do NPC no encontro, sem precisar de seed novo. Já disponível de graça: o `forEach((npcId, i) => ...)` do PASSO 2 ([`adventure.service.ts:334`](../../../apps/api/src/adventure/adventure.service.ts)) já expõe `i`.
- **Carregar `bestiary-5e.json` em runtime, dentro de `apps/api` — sem precedente.** O artefato (US-251) vive em `scripts/srd/`, fora de `apps/api`; inspeção de `apps/api/src` (17/09/2026) não encontrou NENHUM import de JSON de `scripts/srd/` hoje. `apps/api/tsconfig.json` não inclui `scripts/` no `include`, e `startCommand: node apps/api/dist/main` ([`render.yaml`](../../../render.yaml)) depende do `tsc` manter a estrutura de `dist/` — um import relativo cruzando pra fora de `apps/api/src` pode mudar o `rootDir` inferido e quebrar esse path no deploy.
  O único precedente real de JSON gerado por `ingest.mjs` e importado direto por TS em runtime (`d20-tests.srd-2024.json`) NÃO faz esse cruzamento: [`ingest.mjs:55`](../../../scripts/srd/ingest.mjs) grava o artefato DENTRO do pacote consumidor (`packages/ai-engine/src/prompts/d20-tests.srd-2024.json`), nunca em `scripts/srd/`. `bestiary-5e.json` quebrou esse padrão ficando só em `scripts/srd/` (decisão deliberada da US-251, por não ter locale — ver *Questões em aberto* dela).
  **Decisão (17/09/2026):** opção (a) — mesmo mecanismo exato de `D20_TESTS_PATH`. `ingest.mjs` ganha `BESTIARY_PATH = join(HERE, '..', '..', 'apps', 'api', 'src', 'adventure-generation', 'bestiary-5e.json')` (molde de [`ingest.mjs:55`](../../../scripts/srd/ingest.mjs)); a chamada em [`ingest.mjs:1431`](../../../scripts/srd/ingest.mjs) troca `write('bestiary-5e.json', bestiary)` (grava em `scripts/srd/`, o padrão default) por `writeFile(BESTIARY_PATH, stableStringify(bestiary) + '\n')` — mesma forma de [`ingest.mjs:1438`](../../../scripts/srd/ingest.mjs). `bestiary-5e.json` sai de `scripts/srd/` (não fica duplicado — `d20-tests.srd-2024.json` também não existe lá, só dentro do pacote consumidor) e passa a viver só em `apps/api/src/adventure-generation/`, importável por TS direto (`import BESTIARY from './bestiary-5e.json'`) sem cruzar `rootDir`, sem `fs.readFileSync` novo, sem depender de `scripts/` sobreviver no deploy do Render.
  Descartado (b) `fs.readFileSync` com path absoluto — mecanismo sem precedente no repo, mais código pra manter só pra evitar mover um arquivo. Descartado (c) import relativo cruzando pra `scripts/srd/` — risco de `rootDir`/deploy sem necessidade, quando (a) resolve com zero risco.
  Isso é addendum de local de arquivo à US-251 (já ✅ Implementada) — não reabre nenhuma decisão de CONTEÚDO dela (fonte única 5.1, campos `name`/`cr`/`type`/`size` continuam os mesmos), só o destino de escrita do `ingest.mjs`.

---

## Questões em aberto

1. Heurística exata de "tema preferido" — não fechada (ver *Notas de implementação*); pode nascer simples (sem filtro de `type`, só CR) e evoluir depois se o eval mostrar monstro destoante do tom da aventura (ex.: `ooze` num encontro social/urbano). Paliativo: nesta story o nome é escolhido DEPOIS da ficção já escrita, então "tema" tem que adivinhar o tom a partir de sinais indiretos. [US-253](./US-253-autoria-recebe-nome-do-monstro-nominal-como-parametro.md) resolve o problema de raiz invertendo a ordem — criatura escolhida ANTES, vira parâmetro do prompt de autoria, ficção escrita em cima do monstro real — mas só entra depois que US-250 estiver pronta.
2. ~~Se US-251 decidir por UNIÃO (5.1+5.2) em vez de fonte única...~~ Fechada: US-251 decidiu fonte única SRD 5.1 (325 criaturas), sem união com 5.2 (decisão de 17/09/2026, a pedido da mantenedora). Bestiário desta story é o que sair de `bestiary-5e.json` só com o 5.1 — sem esperar cobertura maior.
3. ~~`nominalCreature` participa do saneamento da US-29...~~ Fechada: `stripFabricatedRolls` (US-29) só pega vocabulário de ROLAGEM/TESTE perto de número (`total`, `rola`, `teste`, `d20`...) — não cobre o LLM citando estatística de lore do monstro de cor (ex.: "o Ogre com seus 59 pontos de vida avança"), que não é rolagem e passaria batido. **Decisão:** qualquer prompt que consumir `nominalCreature` (US-253 ou quem escrever `fiction`/`behaviors`) tem que incluir instrução explícita — nome é só rótulo pra ficção, NUNCA licença pra expor HP/CA/ataque do monstro de memória do modelo (o bestiário desta story nem carrega esses campos, por desenho). Vetor novo, fora da cobertura de regex da US-29; não reabre US-29, mas o consumidor de `nominalCreature` nasce com esse guardrail no prompt desde o primeiro dia.

---

## Referências no código

- [`apps/api/src/adventure/adventure.service.ts:325-332`](../../../apps/api/src/adventure/adventure.service.ts) — PASSO 2 (US-233), ponto de encaixe da escolha do nome.
- [`apps/api/src/adventure-generation/monster-roles.ts`](../../../apps/api/src/adventure-generation/monster-roles.ts) — `MONSTER_ROLE_CR`, `assignCombatRoles`, `assignBudgetedCombatRoles`.
- [`apps/api/src/adventure-generation/bestiary.ts`](../../../apps/api/src/adventure-generation/bestiary.ts) — `chooseNominalCreature` (implementada como arquivo irmão, não dentro de `monster-roles.ts`), `BESTIARY` (o JSON importado). PASSO 2 chama com `preferredType: undefined` — v1 saiu sem filtro de tema, confirmando o indício das *Notas de implementação* (nenhum sinal do schema mapeia pra `type` de criatura hoje); a função já implementa o filtro pra quando um consumidor futuro tiver um tema de verdade.
- [US-251](./US-251-bestiario-nominal-nao-existe-como-dado-do-sistema.md) — `bestiary-5e.json`, a fonte desta story; local de escrita realocado por esta story pra `apps/api/src/adventure-generation/bestiary-5e.json` (ver *Notas de implementação*, artefato sai de `scripts/srd/`).
- [`scripts/srd/ingest.mjs`](../../../scripts/srd/ingest.mjs) — `buildBestiary()`, `D20_TESTS_PATH` (molde), ganha `BESTIARY_PATH` equivalente.
- [`packages/shared/src/types/adventure-generation.ts`](../../../packages/shared/src/types/adventure-generation.ts) — `AdventureNpcSchema`, ganha `nominalCreature?`.
- [evals/exemplars/cripta-do-veu-silencioso.md](../../../evals/exemplars/cripta-do-veu-silencioso.md) — exemplar de referência (monstro nomeado e reconhecível).
