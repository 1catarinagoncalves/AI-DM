# US-240 — Um registro de nomenclatura sorteado pra aventura inteira (mundo, facções, locais, NPCs)

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** 📋 Proposta
**Depende de:** [US-232](./US-232-schema-cresce-e-prompt-de-autoria-call-unico.md) ✅ (`buildAuthoringPrompt`/`buildAuthoringSystem`, [ai.service.ts:181-249](../../../apps/api/src/ai/ai.service.ts); `rollFactionCount` como precedente exato do sorteio determinístico, [roll-registry.ts:41-45](../../../apps/api/src/adventure-generation/roll-registry.ts))
**Relacionado:** [US-177](./US-177-onomastica-em-npcs-e-locais-do-motor.md) (extraiu `ONOMASTICS_SECTION` pra const compartilhada — o bullet novo desta story entra ali, vale pros dois caminhos de uma vez) · [US-236](./US-236-params-de-mundo-como-restricao-e-toggle.md) (mesmo padrão de eixo injetado como linha de restrição no prompt de autoria) · [rubric-drift.test.ts](../../../packages/ai-engine/src/rubric-drift.test.ts) (guard de hash sobre `NARRATIVE_CRAFT_SECTION` — esta story MUDA o valor, precisa atualizar)
**Criada em:** 2026-09-14 — achado ao revisar duas aventuras exportadas de bake-off: o mundo de uma se chama "Lúcivis" e a antagonista de fato da outra é "A Afogadora", nomes que a mantenedora já viu se repetir em OUTRAS gerações sem relação entre si. **Revisada três vezes no mesmo dia:**
1. A 1ª versão propunha um gate que rejeita e regenera a aventura inteira no nome batido; a mantenedora recusou — regenerar é retrabalho e não garante nada, já que nada muda entre a tentativa 1 e a 2 no eixo que causa o clichê.
2. A 2ª versão só sorteava registro pro MUNDO, presumindo que NPC/facção "já tinha âncora própria e já funcionava"; a mantenedora perguntou de onde saiu "Afogadora" nesse caso — a NPC TINHA âncora (facção "Os Afogados de Vur", culto aquático) e mesmo assim saiu clichê. Virou sorteio por facção (um registro por índice, além do registro do mundo).
3. A mantenedora pediu pra simplificar de novo: **um único sorteio pra aventura inteira**, aplicado a TUDO (mundo, facções, locais, NPCs) — não um registro por facção, que arrisca um mundo soar como colcha de retalhos (facção grega, outra nórdica, outra élfica, sem nenhuma razão narrativa pra essa mistura). Versão final desta story.

---

## História

> **Como** mantenedora,
> **quero** que a chamada de autoria sorteie UM registro de nomenclatura pra aventura inteira e o aplique a TODO nome próprio que ela inventar (mundo, locais-âncora, facções, NPCs, itens),
> **para que** o mundo inteiro soe como UM lugar coerente — nunca uma mistura de culturas sem relação — e nenhum canto da aventura (nem a facção cujo arquétipo foge do cheat-sheet, caso da "Afogadora") fique sem uma âncora concreta de som, resolvido na origem do prompt, sem gate nem retrabalho.

---

## Contexto e motivação

### O problema observado

Duas exportações da autoria mundo-primeiro (US-232), modelos/sessões diferentes, sem relação de seed (seed morreu, ADR 012 D1):

- Uma tem `world.name: "Lúcivis"` (arquipélago de sete ilhas).
- A outra tem `npc.name: "A Afogadora"` (sacerdotisa do mar, antagonista de fato da trama) — mesmo epíteto, aventura sem nenhuma ligação com a primeira.

A mantenedora relata já ter visto os dois nomes se repetirem em gerações anteriores, fora dessas duas capturas.

### Por que regenerar no gate não resolve

Um gate que REJEITA e regenera tem dois problemas:

1. **Retrabalho** — cada regeneração é uma chamada de autoria inteira (mundo + facções + locais + NPCs + encontros, ~$0.013–0.02) descartada só por causa de 1 campo que já saiu ruim.
2. **Sem garantia** — o prompt que produziu "Lúcivis" na tentativa 1 é o MESMO prompt na tentativa 2 (nada no seed hoje cobre o eixo que causa o clichê). Bloquear no gate só funciona se a fonte de aleatoriedade que muda entre tentativas também cobrir a causa — e hoje não cobre.

### Por que "Afogadora" aconteceu COM âncora — e por que um registro POR ENTIDADE não é a resposta certa

A NPC-antagonista tinha âncora: facção "Os Afogados de Vur" (culto aquático, sacerdotisa do mar). O problema não foi falta de âncora — foi que esse arquétipo (culto afogado/aquático) não é NENHUMA das 10 categorias do cheat-sheet da Onomástica ([dm-system.ts:183-194](../../../packages/ai-engine/src/prompts/dm-system.ts)). Sem categoria pronta, a Onomástica manda "OPEN PALETTE: invente um registro coerente do zero" ([dm-system.ts:196](../../../packages/ai-engine/src/prompts/dm-system.ts)) — tarefa mais difícil, sem scaffold — e é sob essa tarefa mais difícil que o modelo tomou o atalho: pegou o substantivo comum pt-BR ("afogadora") e botou artigo na frente, em vez de inventar fonética nova.

A correção intermediária (registro sorteado por FACÇÃO, uma revisão atrás) resolveria esse caso específico, mas troca um risco por outro: cada facção sorteando seu próprio registro, independente, pode produzir um mundo onde a facção 1 soa grega, a facção 2 nórdica, a facção 3 élfica — sem NENHUMA razão narrativa pra essa mistura, numa aventura que é UMA geografia, UM conflito local (três facções disputando a mesma pedra/relíquia no mesmo vale). Multiculturalismo tem que vir de UMA escolha deliberada da ficção, não de três sorteios independentes que por acaso caíram diferentes.

A resposta mais simples resolve os dois problemas de uma vez: **um único sorteio, aplicado a tudo.** Nenhuma entidade (mundo, facção, local, NPC) fica sem registro — logo nenhuma cai na porta OPEN PALETTE por falta de cobertura — e como é o MESMO registro em toda a aventura, o mundo soa como um lugar só, nunca uma colcha de retalhos.

### A proposta

1. **Um registro sorteado por aventura:** código sorteia (determinístico, mesmo padrão de `rollFactionCount`) um único `namingRegister` e injeta como restrição no prompt de autoria, cobrindo TODO nome próprio que o modelo for inventar — não só `world.name`, também `factions[].name`, `locations[].title`, `npcs[].name`, `objective.reward.name`. Pra ESTA chamada, a restrição tem prioridade sobre o passo 1 da Onomástica ("registro decidido pela raça/classe da cena") — a Onomástica compartilhada (`ONOMASTICS_SECTION`) não muda esse passo (ele continua certo pra narração ao vivo, uma campanha longa que atravessa várias culturas); só a linha nova em `buildAuthoringPrompt` avisa que, NESTA aventura específica, o registro já está decidido.
2. **Bullet novo na Onomástica, mirando o passo OPEN PALETTE especificamente** — defesa em profundidade pro que sobrar: a narração ao vivo (que não tem o sorteio desta story) e o caso raro de o modelo ignorar a restrição. Quando o registro precisa ser inventado do zero, a proibição de "nome de prateleira" vale igual pra um atalho de epíteto-substantivo-comum-com-artigo — SEM citar "Lúcivis"/"Afogadora" nem qualquer palavra específica (achado da US-36: nome citado como proibido no prompt PRIMA o modelo a usá-lo mais).

---

## Escopo

### Dentro do escopo

- **`NAMING_REGISTERS`** (novo array, `registry-catalog.ts`) com as 10 categorias do cheat-sheet da Onomástica ([dm-system.ts:183-194](../../../packages/ai-engine/src/prompts/dm-system.ts)): Greco-classical, Celtic, Norse/Germanic, Latin/Roman, Arabic/Persian, Slavic/folkloric, Elvish, Guttural/brute, Infernal/exotic, Rustic — mesmas categorias, sem inventar rótulo novo (sincronizar as duas listas é a mesma disciplina que o comentário em `registry-catalog.ts:6-8` já documenta pra `SETTINGS`/`TONES`/`AREA_TYPES`).
- **`rollNamingRegister(characterId, order, attempt)`** em `roll-registry.ts`, MESMO formato de `rollFactionCount` — sub-seed próprio (`characterId:namingRegister`), um sorteio só, sem loop, sem depender de `factionCount` existir primeiro.
- **`adventure.service.ts`** (`generateAdventure`, [linhas 155-171](../../../apps/api/src/adventure/adventure.service.ts)): chama `rollNamingRegister` ao lado de `rollRegistry`/`rollFactionCount`, passa como novo param `namingRegister: string` pra `generateAdventureAuthoring`.
- **`buildAuthoringPrompt`** ([ai.service.ts:215-249](../../../apps/api/src/ai/ai.service.ts)): novo param `namingRegister: string`; nova linha no prompt — algo como `Registro de nomenclatura DESTA aventura: ${namingRegister}. TODO nome próprio que você inventar — mundo, locais-âncora, facções, NPCs, item de recompensa — soa nesse mesmo registro; é a identidade sonora de UM mundo específico, não uma mistura de culturas. Isto tem prioridade sobre a escolha de registro do passo 1 da Onomástica pra esta aventura.`
- **`ONOMASTICS_SECTION`** ([dm-system.ts:175-196](../../../packages/ai-engine/src/prompts/dm-system.ts)) ganha um bullet novo no final do parágrafo OPEN PALETTE, em termos GERAIS (formato, não exemplo): um epíteto de substantivo comum + artigo ("a Guardiã", "o Errante") só é válido se a PALAVRA em si carregar a textura do registro (composto, arcaico, raiz estrangeira) — um substantivo de dicionário puro com artigo na frente é o MESMO tipo de falha que cair num nome de prateleira, não um atalho válido pra fugir do trabalho de inventar.
- Guard de hash (US-36): `rubric-drift.test.ts` (`REVIEWED_CRAFT_HASH`) atualizado pro novo valor de `NARRATIVE_CRAFT_SECTION`; `DIMENSIONS` em `rubric.ts` revisado junto (mesmo protocolo do comentário em [dm-system.ts:164-167](../../../packages/ai-engine/src/prompts/dm-system.ts)).
- Teste de regressão: `rollNamingRegister` é determinístico; `system`/`prompt` de `generateAdventureAuthoring` incluem a linha de registro e o bullet novo da Onomástica.
- `pnpm eval` roda e passa (mudança na barra de ofício que a rubrica referencia — regra do projeto, `AGENTS.md`).

### Fora do escopo

- **Bloqueio/rejeição no gate** (`detectSlopName`/`SLOP_NAMES`, `adventure-gate.ts`) — decisão revertida na 1ª revisão. Se, MESMO com o registro sorteado, um nome específico voltar a se repetir OBSERVADAMENTE em produção, a defesa mecânica (hoje só narração, só loga) é candidata a reabrir — não é objeto desta story.
- **Registro por facção/entidade individual** (variante da 2ª revisão) — descartado nesta revisão final: multiplica o risco de o mundo soar como colcha de retalhos, e é mais código (loop dependente de `factionCount`) pro mesmo problema que um sorteio só já resolve.
- **Cobertura das 10 categorias pra arquétipos que nenhuma serve bem** (ex. culto aquático/afogado — nenhuma das 10 é "aquática") — o sorteio força uma categoria mesmo com encaixe temático imperfeito, de propósito (dá scaffold fonético em vez de zero); o cheat-sheet já instrui "calibre, nunca copie literal" pro modelo ajustar a textura ao tema. Adicionar uma 11ª categoria só pra cobrir o caso observado é overfit num caso só — não entra aqui.
- **Rótulo pt-BR do registro sorteado (catálogo/UI, US-156)** — este eixo nunca é escolhido pelo jogador (sem toggle "Aleatório", sempre sorteado pelo código), então não precisa do tratamento rótulo-pt-BR/`catalogLabel` que `setting`/`tone`/`areaType` têm — o valor injetado no prompt pode ser a categoria em inglês do próprio cheat-sheet, mesma mistura de idioma que `ONOMASTICS_SECTION` já usa (nota em US-177 §Notas de implementação).
- **Enforcement na narração ao vivo** (passar de "loga" pra "bloquear" em `ai.service.ts:1194`, `detectSlopName`) — decisão da US-36 foi deliberadamente observar primeiro; esta story não reabre isso.
- **Medir se o sorteio reduziu a repetição de fato** — esta story muda a origem (prompt); confirmar que "Lúcivis"/"Afogadora" pararam de aparecer é observação de produção ao longo do tempo, não um critério de aceite bloqueante (não dá pra provar ausência num PR).

---

## Critérios de aceite

- [ ] `NAMING_REGISTERS` existe com as 10 categorias do cheat-sheet da Onomástica.
- [ ] `rollNamingRegister(characterId, order, attempt)` sorteia determinístico — mesma entrada ⇒ mesmo resultado; `attempt` diferente pode mudar o resultado.
- [ ] `generateAdventure` (`adventure.service.ts`) chama `rollNamingRegister` e passa `namingRegister` pra `generateAdventureAuthoring`.
- [ ] `buildAuthoringPrompt` inclui a linha de restrição de registro cobrindo mundo/facções/locais/NPCs/recompensa (não só o mundo).
- [ ] `ONOMASTICS_SECTION` inclui o bullet novo no parágrafo OPEN PALETTE sobre o atalho de epíteto genérico, SEM citar "Lúcivis"/"Afogadora"/qualquer palavra específica.
- [ ] `rubric-drift.test.ts` (`REVIEWED_CRAFT_HASH`) atualizado pro novo valor; `DIMENSIONS` (`rubric.ts`) revisado.
- [ ] `pnpm typecheck`, `pnpm test` e `pnpm eval` passam.

---

## Notas de implementação

- **Precedente exato a copiar:** `rollFactionCount` ([roll-registry.ts:41-45](../../../apps/api/src/adventure-generation/roll-registry.ts)) — mesmo formato, sub-seed próprio (o comentário em `roll-registry.ts:12-15` explica por quê: cada campo precisa de sub-seed isolado pra escolher um eixo manualmente não deslocar o sorteio dos outros). `rollNamingRegister` é um sorteio SÓ (sem `slot`, sem loop) — mais simples que a versão anterior desta story, que sorteava um por facção.
- **`attempt` já é repassado no reseed do gate** ([adventure.service.ts:143-144](../../../apps/api/src/adventure/adventure.service.ts), comentário) — `rollNamingRegister` herda isso de graça: uma regeneração por falha estrutural (grafo/orçamento) já sorteia um registro diferente na tentativa seguinte, efeito colateral bom, não o mecanismo principal desta story.
- **`ai-engine` roda de `dist`** — editar `ONOMASTICS_SECTION` em `src/prompts/dm-system.ts` exige `pnpm --filter @ai-dm/ai-engine build` antes de `apps/api` enxergar a mudança.
- **`ONOMASTICS_SECTION` é COMPARTILHADA** entre narração ao vivo (`NARRATIVE_CRAFT_SECTION`) e autoria (`buildAuthoringSystem`) — o bullet do atalho open-palette vale pros dois caminhos de uma vez só (mesma reutilização que a US-177 já estabeleceu). O passo 1 (registro por raça/classe/cena) NÃO muda — continua certo pra narração ao vivo; a prioridade do registro único vale só dentro do prompt de autoria (`buildAuthoringPrompt`, não em `ONOMASTICS_SECTION`).

---

## Questões em aberto

Nenhuma — decidido: todas as 10 categorias entram no pool de `NAMING_REGISTERS`, sem exclusão (ex. "Guttural/brute" fica; modelo calibra intensidade ao contexto). Se qualidade cair na prática, filtrar pool é ajuste de uma linha no array, não redesenho.

---

## Referências no código

- [packages/ai-engine/src/prompts/dm-system.ts:175-196](../../../packages/ai-engine/src/prompts/dm-system.ts) — `ONOMASTICS_SECTION`, onde o bullet novo entra.
- [packages/ai-engine/src/prompts/dm-system.ts:183-194](../../../packages/ai-engine/src/prompts/dm-system.ts) — cheat-sheet, fonte das 10 categorias de `NAMING_REGISTERS`.
- [apps/api/src/ai/ai.service.ts:181-209](../../../apps/api/src/ai/ai.service.ts) — `buildAuthoringSystem`.
- [apps/api/src/ai/ai.service.ts:211-249](../../../apps/api/src/ai/ai.service.ts) — `buildAuthoringPrompt`, onde a restrição de mundo (`worldLines`) já existe — mesmo padrão pra `namingRegister`.
- [apps/api/src/adventure-generation/roll-registry.ts:36-45](../../../apps/api/src/adventure-generation/roll-registry.ts) — `rollFactionCount`, precedente exato do sorteio determinístico.
- [apps/api/src/adventure-generation/registry-catalog.ts](../../../apps/api/src/adventure-generation/registry-catalog.ts) — `SETTINGS`/`TONES`/`AREA_TYPES`, precedente de array + comentário de sincronização com a fonte irmã.
- [apps/api/src/adventure/adventure.service.ts:150-171](../../../apps/api/src/adventure/adventure.service.ts) — `generateAdventure`, ponto de wiring do novo sorteio.
- [packages/ai-engine/src/rubric-drift.test.ts](../../../packages/ai-engine/src/rubric-drift.test.ts) — guard de hash sobre `NARRATIVE_CRAFT_SECTION`/`ONOMASTICS_SECTION`, a atualizar.
- [packages/ai-engine/src/guardrails.ts:139-164](../../../packages/ai-engine/src/guardrails.ts) — `SLOP_NAMES`/`detectSlopName`, defesa mecânica existente (narração ao vivo, só loga) — candidata a reabrir SE o sorteio de registro não bastar na prática (ver *Fora do escopo*), não objeto desta story.
- [US-177](./US-177-onomastica-em-npcs-e-locais-do-motor.md) — extraiu `ONOMASTICS_SECTION` pra const compartilhada, mesma reutilização usada aqui.
- [US-236](./US-236-params-de-mundo-como-restricao-e-toggle.md) — mesmo padrão de eixo injetado como restrição no prompt de autoria.
- Aventuras que motivaram o achado (arquivos locais da mantenedora, fora do repo): `authoring-deepseek-v4-pro-0813-2026-09-13T23-29-14.json` (`world.name: "Lúcivis"`), `authoring-cmtsvp5du0000v8undpak2qw6-2026-09-13T13-11-27.json` (`npc.name: "A Afogadora"`).
