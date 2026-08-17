# US-152 — Statblocks por papel e orçamento de encontro para um personagem

**Épico:** 3 — Narração e mecânica
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** [US-145](./US-145-sync-lgmrd-notice.md) (`5e_Monster_Builder.json` baixado) · [US-147](./US-147-rolagem-registro-conteudo.md) (conteúdo já rolado, incluindo local/complicação que o encontro habita) · [US-159](./US-159-orcamento-de-encontro-lgmrd.md) (o *Lazy Encounter Benchmark* contra o qual o orçamento é medido)
**Relacionado:** [Backlog — Motor de geração de aventuras one-shot](./backlog-motor-de-geracao-de-aventuras.md) (US-152, caminho crítico) · [ADR 012](../../adr/012-aventura-gerada-como-dado.md) (resolve rótulos `GEN-N` do backlog para número de story)
**Criada em:** 2026-08-15

---

## História

> **Como** mantenedora,
> **quero** povoar cada encontro gerado com statblocks por papel (Minion, Soldier, Brute) do `5e_Monster_Builder.json`, com orçamento medido para **um** personagem daquele nível,
> **para que** nenhum encontro gerado mate um personagem solo de nível 1 — e o gate da [US-150](./US-150-gate-antes-de-persistir-aventura-gerada.md) tenha o que verificar.

---

## Contexto e motivação

### O problema observado

Sem statblocks nem orçamento, [US-150](./US-150-gate-antes-de-persistir-aventura-gerada.md) (o gate) não tem contra o que verificar "o orçamento do encontro cabe em um personagem" — a verificação existiria em texto, sem dado. E sem essa verificação, um encontro escrito com o **default de grupo** (a maioria dos geradores de conteúdo D&D assume 4 personagens) mataria um personagem solo de nível 1, que é exatamente o público desta fase (ver ADR de escopo do backlog: campanha de grupo foi adiada para a fase 4).

### Por que a solução atual não basta

O repo não tem hoje **nenhum** dado de monstro — nem bestiário nominal, nem statblock por papel. Ingerir o bestiário completo do SRD seria um pipeline inteiro (parsing de ataques, resistências, CR nominal), desproporcional ao que o motor precisa: só um oponente jogável por papel funcional. O `5e_Monster_Builder.json` do LGMRD já resolve isso de graça — statblocks por **função** (Minion CR 1/8, Soldier CR 1/2, Brute CR 2), não por nome de monstro.

### A proposta

Ler `5e_Monster_Builder.json` (baixado pela US-145) e usar os três papéis diretamente — sem ingerir monstro nominal do SRD. O passo povoa cada encontro com os papéis que existem, e o orçamento é medido contra o *Lazy Encounter Benchmark* da [US-159](./US-159-orcamento-de-encontro-lgmrd.md) (o mesmo artefato, seção diferente), calibrado para **um** personagem.

---

## Escopo

### Dentro do escopo

- **Leitura direta de `5e_Monster_Builder.json`** — sem parser normalizado (mesma decisão da [US-147](./US-147-rolagem-registro-conteudo.md) para o `LGMRD.json`: nenhum `ingest.mjs` novo, o motor lê o artefato bruto em tempo de execução).
- **Seleção de papel por encontro** (Minion CR 1/8, Soldier CR 1/2, Brute CR 2), filtrada por nível do personagem — encontro de nível 1 não recebe um Brute sozinho sem Minions ao redor, por exemplo (a régua exata de composição fica para a implementação calibrar contra a régua de dificuldade).
- **Orçamento medido para UM personagem**, nunca para grupo. **Tamanho de grupo é 1, escrito como 1 — não como parâmetro.** Multiplayer é fase 4; até lá, um multiplicador por número de personagens seria configuração com um único valor possível, que é configuração falsa. Quando a fase 4 chegar, o multiplicador entra num lugar só (aqui).
- **Está no caminho crítico**: sem esta story, o gate da [US-150](./US-150-gate-antes-de-persistir-aventura-gerada.md) não tem o que verificar no encontro, e encontro escrito no default de grupo mata um personagem solo de nível 1.
- **Popula `encounter.npcIds[]`** (ou campo equivalente que a US-152 acrescente ao schema da US-144, se `AdventureEncounterSchema` precisar de campos de orçamento/papel — ver *Questões em aberto* da US-144) com os statblocks escolhidos.

### Fora do escopo

- **Ingerir bestiário nominal do SRD.** Deliberadamente evitado — os papéis do `5e_Monster_Builder.json` bastam, sem pipeline de ingestão de monstro.
- **Multiplicador por tamanho de grupo.** Não existe antes da fase 4 — nem como flag desligada, nem como parâmetro com um valor só (configuração falsa).
- **A verificação do gate em si** (que o orçamento cabe) — é [US-150](./US-150-gate-antes-de-persistir-aventura-gerada.md); esta story só produz o dado que o gate compara.
- **HP/AC inventados pelo modelo.** Já saneado pela [US-29](./US-29-saneamento-de-rolagens-ficticias.md); os statblocks vêm do artefato, nunca de invenção do LLM.
- **Extrair AC/HP/ataque do statblock (o blob de markdown de cada papel).** Fase 1 não tem combate por turno (roadmap, sem US própria ainda) — nenhum consumidor precisa desses campos hoje, só `role`+`cr`. Receita pronta pra quando existir, ver *Notas de implementação*; construir agora seria abstração sem consumidor.

---

## Modelo de dados proposto

> Sem schema Zod formal novo obrigatório — se `AdventureEncounterSchema` (US-144) precisar de campos de orçamento explícitos (`budget`, papel por `npcId`), esta story é quem primeiro exige a extensão; a decisão de estender o schema ou manter externo fica registrada aqui como consumo, não como definição.

| Campo (statblock) | Origem | Descrição |
|---|---|---|
| `role` | `5e_Monster_Builder.json` | `Minion` \| `Soldier` \| `Brute`. |
| `cr` | `5e_Monster_Builder.json` | `1/8`, `1/2`, `2` respectivamente. |
| `budget` (orçamento do encontro) | calculado | Soma dos statblocks escolhidos, comparada contra a régua de dificuldade para um personagem do nível dado. |

**Persistência:** nenhuma nesta story — o resultado alimenta o artefato que o gate valida ([US-150](./US-150-gate-antes-de-persistir-aventura-gerada.md)) e que é persistido pela decisão da US-143.

---

## Critérios de aceite

- [x] O motor lê `5e_Monster_Builder.json` (US-145) e extrai os três papéis (Minion, Soldier, Brute) com seus respectivos CR.
- [x] Nenhum ingest/parser novo é criado para monstro nominal do SRD — a leitura é direta do artefato do LGMRD.
- [x] O orçamento de cada encontro é calculado e comparado contra o *Lazy Encounter Benchmark* de **um** personagem daquele nível ([US-159](./US-159-orcamento-de-encontro-lgmrd.md)) — nunca multiplicado por tamanho de grupo.
- [x] Nenhum parâmetro de "tamanho de grupo" existe no código — a constante `1` está escrita como `1`, não como config com um valor possível.
- [x] Encontro de nível 1 gerado por esta lógica não excede o orçamento de um personagem solo (verificável comparando contra `encounterDeadlyThreshold`/`singleMonsterCrCap` da US-159).
- [x] Cada instância de statblock (Minion/Soldier/Brute) vira um item de `npcs[]` sem campo novo em `AdventureEncounterSchema`/`AdventureNpcSchema`: `role` = chave canônica do papel de combate, `interactions: []`, `id` continua o contador sequencial `npc-N` que a US-158 já minta (sem namespace por encontro) — `name` pode repetir entre instâncias do mesmo papel.
- [x] Encontro com múltiplas instâncias do mesmo papel (ex.: 2 Minions) recebe `id`s distintos do contador `npc-N`, sem campo `count` — a contagem é o tamanho de `npcIds[]` filtrado por `role`. Testado.
- [x] `pnpm typecheck` e testes do módulo passam.
- [x] **Eval / teste de regressão:** fixture com nível 1 produz encontro dentro do orçamento (ex.: 2 Minions, não 1 Brute sozinho se o Brute sozinho exceder o orçamento de um personagem nível 1); teste falha se o cálculo de orçamento multiplicar por qualquer coisa além de 1.

---

## Notas de implementação

- **Statblock de monstro é uma entrada normal de `AdventureNpcSchema`, sem campo novo.** `encounter.npcIds[]` referencia `AdventureNpcSchema.id` (US-144) — não existe schema separado para combatente. Cada instância de Minion/Soldier/Brute vira um item de `npcs[]`: `role` guarda a chave canônica do papel de combate (`Minion`/`Soldier`/`Brute`, mesmo padrão de chave EN da US-54) em vez de descrição de personalidade; `interactions: []` (combatente genérico não tem fala); `name` pode repetir entre instâncias do mesmo papel (dois "Minion" lado a lado) — `id` continua o contador sequencial `npc-N` que a US-158 já minta pros NPCs narrativos (sem esquema novo por encontro), porque é `id` que o grafo do gate (US-150) resolve, não `name`. Contagem por papel (ex.: 2 Minions) é o tamanho de `npcIds[]` filtrado por `role`, sem campo `count` novo. CR não persiste em campo nenhum — fica transiente na mesma execução (ver *Questões em aberto*, resolvida); se o gate precisar do CR depois de já ter os `npcs[]` montados, ele usa a estrutura em memória que gerou os statblocks, não relê o schema serializado.
- **Efeito colateral pro jogador — statblock não pode vazar como elenco narrativo.** `npcs[]` é a mesma lista que a [US-158](./US-158-locais-npcs-prosa-motor.md) usa como "elenco" da aventura (prosa de local, ocupantes). Um "Minion" com `role="Minion"` e `interactions=[]` misturado ali, sem filtro, vaza pro jogador como se fosse personagem nomeado — quebra a convenção do LGMRD de nunca ler statblock de monstro em voz alta. **Quem consumir `npcs[]` para prosa/narração (US-158 ou o motor de narração) precisa filtrar por `role` conhecido (`Minion`/`Soldier`/`Brute`) antes de tratar a lista como elenco** — não implementado em lugar nenhum ainda (confirmado: nenhum consumidor de `npcs[]` existe no código além da própria geração, US-158 é ✅ mas só *produz* `npcs[]`, não os renderiza pro jogador). Registrar esse filtro como requisito de quem primeiro escrever esse consumidor, não desta story.
- **A assimetria com nível:** nível *é* parâmetro desde já (a assinatura do motor recebe nível — [US-148](./US-148-perfil-personagem-entrada-motor.md)), mesmo que hoje sempre valha 1 (D1 ausente); tamanho de grupo *não* muda antes da fase 4. As duas constantes têm ciclo de vida diferente — não tratar como o mesmo tipo de "valor fixo por enquanto".
- **Caminho de volta é conhecido e barato**, segundo o backlog: quando a fase 4 chegar, o multiplicador entra num lugar só (este módulo) — não é uma decisão que precisa de flag/abstração preventiva agora.
- **A forma exata de `5e_Monster_Builder.json` — confirmada por inspeção em 17/08/2026** (`scripts/lazygm/_data/`, gitignored, depois de rodar `node scripts/lazygm/sync.mjs`): `sections[].id === 'generalusestatblocks'`, `subsections[].id` em `minion`/`soldier`/`brute` (+ `specialist`/`myrmidon`/`sentinel`/`champion`, CR mais alto, fora do escopo desta story). `subsections[].title` é string limpa (`"Minion (CR 1/8)"`) — role e CR saem daí. O statblock completo (AC/HP/ataque) mora num `content[0].markdown` só, prosa solta com campos em negrito (`**Armor Class** 11`), sem coluna de tabela — mas esta story (ver *Modelo de dados proposto*) só precisa de `role`+`cr`, nunca toca esse blob.
- **Régua de composição escolhida (calibração desta story, ver *Escopo*):** `composeEncounterRoles(level)` em [`monster-roles.ts`](../../../apps/api/src/adventure-generation/monster-roles.ts) usa `singleMonsterCrCap` (US-159) como teto do encontro inteiro — não `encounterDeadlyThreshold`, que já nasce `0` até nível 3 e não sobra composição alguma pra caber nele. Greedy: tenta Brute primeiro a cada rodada, cai pra Soldier/Minion se não couber mais estritamente abaixo do teto (`<`, nunca `<=` — CR igual ao teto já conta como letal pelo LGMRD). Resultado: nível 1 nunca recebe um Brute sozinho (CR 2 ≥ teto 1), mas sempre produz ao menos 1 combatente.
- **CR não é parseado do título em runtime — mesmo padrão do módulo irmão `lazy-encounter-benchmark.ts` (US-159).** Aquele módulo já estabeleceu o precedente pra este artefato: fórmula/constantes HARDCODED no código (`encounterDeadlyThreshold`/`singleMonsterCrCap`), com um script irmão (`scripts/lazygm/extract-benchmark.mjs`) que só serve de **guard de drift** — confirma que a seção/subseção ainda existe na fonte pinada, sem derivar o valor numérico dela. Mesma receita aqui: `Minion=1/8`, `Soldier=1/2`, `Brute=2` viram constante no módulo novo (`apps/api/src/adventure-generation/monster-roles.ts` ou nome equivalente), e um `scripts/lazygm/extract-monster-roles.mjs` espelhando `extract-benchmark.mjs` (mesmo `SECTION_ID`/`SUBSECTION_IDS`, mesmo formato de `sourceSubsections` com o `title` snapshotted) falha alto se a fonte renomear/remover `minion`/`soldier`/`brute`. Evita depender de regex contra `title` em produção — só o script de extração (rodado manualmente, não em runtime da API) toca o JSON bruto.
- **Receita de AC/HP/ataque, pra quando o combate por turno existir (fora do escopo AGORA, ver *Fora do escopo*).** Confirmado por inspeção em 17/08/2026 nos 3 papéis (`minion`/`soldier`/`brute`): o statblock completo mora em `content[0].markdown` (um `paragraph`), campo sempre `**Label** valor` (`**Armor Class**`, `**Hit Points**`, `**Speed**`, `**Challenge**`, `**Senses**`), mas **campos variam por papel** — Brute tem `**Saving Throws**`/`**Skills**` extras que Minion/Soldier não têm. Regex por label (`/\*\*Armor Class\*\*\s*(\d+)/`), nunca split posicional por `\n\n` — contagem/ordem de campo não é estável entre papéis. AC e HP têm sufixo parentético (`"12 (leather armor...)"`, `"22 (4d8 + 4)"`) — capturar só o número líder se precisar valor numérico, guardar string completa se for pra exibir. Ataque mora em `***Attack.***`/`***Multiattack.***` dentro da mesma seção `**ACTIONS**`, formato de prosa livre (não regex trivial de um campo só) — maior custo de parser desse grupo todo, avaliar quando a story existir.

---

## Questões em aberto

Nenhuma.

1. ~~`AdventureEncounterSchema` (US-144) precisa de campos novos (`budget`, papel por NPC) para o gate ([US-150](./US-150-gate-antes-de-persistir-aventura-gerada.md)) verificar o orçamento? Ou o orçamento é calculado em memória durante a geração, sem persistir no schema final?~~ **Resolvida em 17/08/2026:** orçamento é valor transiente, não campo de schema. A própria [US-150](./US-150-gate-antes-de-persistir-aventura-gerada.md) (*Notas de implementação*) já assume gate e geração na mesma execução — a verificação de orçamento "pode exigir os dados de statblock da US-152 já carregados", e `encounterDeadlyThreshold`/`singleMonsterCrCap` são fórmula hardcoded, sem I/O extra. `AdventureEncounterSchema` só ganha `npcIds[]` (já no escopo desta story); o cálculo de orçamento em si não persiste. Reabrir só se gate e geração passarem a rodar em execuções separadas.

---

## Referências no código

- [US-145](./US-145-sync-lgmrd-notice.md) — `5e_Monster_Builder.json`, a fonte desta story.
- [US-159](./US-159-orcamento-de-encontro-lgmrd.md) — *Lazy Encounter Benchmark*, a régua de orçamento contra a qual o encontro é medido (**não** é `difficultyClasses` da US-111 — resolvida em 17/08/2026, ver *Fora do escopo* da US-111).
- [US-29](./US-29-saneamento-de-rolagens-ficticias.md) — por que HP/AC não são inventados pelo modelo.
- [Backlog — Motor de geração de aventuras one-shot §GEN-9](./backlog-motor-de-geracao-de-aventuras.md) (US-152) — texto de origem, incluindo a nota sobre tamanho de grupo = 1.
- [US-158](./US-158-locais-npcs-prosa-motor.md) — `npcs[]`/`AdventureNpcSchema` reusado sem campo novo pro statblock de combate; contador `npc-N` que esta story continua está em [`ai.service.ts:1278`](../../../apps/api/src/ai/ai.service.ts) (`generateLocationsAndNpcs`).
- [packages/shared/src/types/adventure-generation.ts](../../../packages/shared/src/types/adventure-generation.ts) — `AdventureNpcSchema`/`AdventureEncounterSchema` (US-144), sem campo novo nesta story.
- [scripts/lazygm/_data/5e_Monster_Builder.json](../../../scripts/lazygm/sync.mjs) — dado cru baixado pela US-145 (gitignored); seção `generalusestatblocks` tem `minion`/`soldier`/`brute` com CR no título da subseção, statblock em markdown solto (sem coluna estruturada de AC/HP).
- [scripts/lazygm/extract-benchmark.mjs](../../../scripts/lazygm/extract-benchmark.mjs) — molde do script de extração/guard de drift espelhado por `extract-monster-roles.mjs`: CR fica hardcoded no código, o script só confirma que a seção/subseção-fonte ainda existe.
- [apps/api/src/adventure-generation/monster-roles.ts](../../../apps/api/src/adventure-generation/monster-roles.ts) — `MONSTER_ROLE_CR`, `composeEncounterRoles`, `buildEncounterNpcs`: o módulo desta story.
- [scripts/lazygm/extract-monster-roles.mjs](../../../scripts/lazygm/extract-monster-roles.mjs) / [monster-roles.json](../../../scripts/lazygm/monster-roles.json) — guard de drift committed da seção `generalusestatblocks`.
