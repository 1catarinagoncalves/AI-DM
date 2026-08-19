# US-180 — `generateOpeningBeat` ignora vínculos do personagem e força abertura por combate quando nada se destaca

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** nenhuma — `generateOpeningBeat` já existe (US-172, ✅); são parâmetros novos e reescrita de instrução na chamada existente, não peça nova.
**Relacionado:** [US-172](./US-172-abertura-gerada-nao-copia-gancho-fixo.md) (dona de `generateOpeningBeat`, decide hoje como `start` ancora — inclusive o fallback de confronto que esta story substitui) · [US-149](./US-149-segredos-40-prompts-lgmrd.md) (dona do `anchorInstruction` em `generateSecrets`, que já combina `background` + `origin` — molde principal a espelhar, mais completo que o `bondsInstruction`) · [US-158](./US-158-locais-npcs-prosa-motor.md) (dona do `bondsInstruction`, versão mais simples do mesmo padrão, só `bonds`) · [US-174](./US-174-hookseed-sai-das-outras-chamadas-do-motor.md)/[US-175](./US-175-generateclosing-perde-hookseed-antagonista-so-premissa.md) (disciplina "`hookSeed` fora do motor" — esta story NÃO reabre isso; `background`/`origin` são campos diferentes de `hookSeed`) · [US-173](./US-173-registro-fica-so-com-tone.md) (por que o pilar "ambiente" do artigo-fonte fica de fora, ver *Criada em*) · [US-39](./US-39-identidade-narrativa-background-ideais.md) (origem de `background.bonds`)
**Criada em:** 2026-08-19 — a pedido da mantenedora, aplicando ao motor de geração as ideias do artigo [*Your D&D Campaign's Starting Point*](https://www.rjd20.com/2019/05/your-d-campaigns-starting-point.html) (rjd20.com). O artigo organiza um bom início de campanha em três eixos: **(1)** ambiente escolhido para o grupo, **(2)** conflito de fundo, **(3)** por que CADA personagem pertence àquele lugar especificamente ("who do the characters know locally"). Dos três: **(2)** já é coberto no motor (`premissa`+antagonista via `generateClosing`, US-164); **(1)** foi deliberadamente descartado NESTA MESMA DATA pela US-173 (`setting`/`areaType` sem consumidor real) — esta story não reabre aquela decisão. Sobra **(3)**, e é lacuna real — mas ao investigar o fallback atual (`generateOpeningBeat`, "sem conflito óbvio, abra com confronto ou ameaça imediata", herdado literal do LGMRD), a mantenedora pediu explicitamente para também mudar ESSE comportamento: o artigo argumenta que povoados/locais vivos com gente conhecida servem melhor a grupos de nível baixo do que empurrar os jogadores para um enredo/conflito pré-definido — "avoid forcing players into predetermined plot lines, allowing them to discover stories organically". Um fallback que SEMPRE resolve em luta é exatamente esse empurrão. Esta story passa a cobrir dois problemas: falta de vínculo pessoal (pilar 3) e combate como único destino do fallback.

---

## História

> **Como** jogador que gera uma aventura nova,
> **quero** que a abertura (`start`) ancore, quando existir, no local ou NPC que já carrega um vínculo (`bonds`) do meu personagem, e que — na ausência de vínculo ou de conflito óbvio — o motor prefira uma cena enraizada no lugar (chegada, gente conhecida, tensão de fundo já pairando) em vez de cair direto em combate,
> **para que** a primeira cena que eu leio já responda "por que EU estou aqui", e para que abertura genérica pare de significar "luta genérica" por padrão.

---

## Contexto e motivação

### O problema observado

`generateOpeningBeat` ([ai.service.ts:1492-1514](../../../apps/api/src/ai/ai.service.ts)) recebe `locations`, `npcs`, `secrets`, `registry`, `premissa` — nunca `background`/`origin`. `buildOpeningBeatPrompt` ([ai.service.ts:226-245](../../../apps/api/src/ai/ai.service.ts)) instrui ancorar a cena "numa das locations recebidas" sem preferência nenhuma por qual.

Duas outras chamadas do motor já usam `background`/`origin` para ligação pessoal, cada uma com um molde de instrução: `generateLocationsAndNpcs` (US-158) amarra ao menos um NPC a `bonds` via `bondsInstruction` ([ai.service.ts:1345-1351](../../../apps/api/src/ai/ai.service.ts)) — só `bonds`, não recebe `origin`. `generateSecrets` (US-149) vai mais longe: `anchorInstruction` ([ai.service.ts:1408-1422](../../../apps/api/src/ai/ai.service.ts)) combina `background.story`, `bonds`, `flaws` **e** `origin.connection`/`origin.memento` (a conexão de origem do personagem com o mundo e o objeto que carrega dela) numa lista só de âncoras. Nenhuma amarração produz sinal estruturado no artefato — não existe campo tipo `AdventureNpc.boundToCharacter` — é só prosa dentro de `role`/`interactions`/`text`. Resultado: mesmo quando existe um NPC/local ligado a um vínculo ou à origem do personagem, `generateOpeningBeat` não tem como saber QUAL é — não recebe nem `background` nem `origin` — e a cena de abertura pode ancorar em qualquer local/NPC, sem relação nenhuma com o personagem.

**Segundo problema, no mesmo `system`** ([ai.service.ts:1502-1507](../../../apps/api/src/ai/ai.service.ts)): a única instrução de fallback hoje é *"Sem conflito óbvio na premissa/locations/npcs/secrets recebidos, abra com confronto ou ameaça imediata."* — herdada literal do LGMRD (*"when in doubt, start with a fight"*). É a ÚNICA saída de fallback: o `system` não oferece nenhuma alternativa não-violenta quando nada se destaca. `generateOpeningBeat` também nunca recebe `complicacao` (o eixo de tensão de fundo que `generateClosing` já usa, [ai.service.ts:1461](../../../apps/api/src/ai/ai.service.ts)) — então o modelo decide "conflito óbvio ou não" sem o dado que mais provavelmente CONTÉM esse conflito.

### Por que a solução atual não basta

A US-172 resolveu dois eixos de `start`: TOM (deixou de copiar `hookSeed` cru) e ANCORAGEM FACTUAL (cita `location`/`npc` real, não solto). Não resolveu o eixo PESSOAL — o próprio artigo nomeia isso como pilar distinto de ambiente e de conflito: *"why does each character belong here"*. O motor já paga esse pilar numa chamada (`generateLocationsAndNpcs`), mas perde o resultado no caminho até a chamada que decide a PRIMEIRA cena que o jogador de fato lê.

Quanto ao fallback: "abra com confronto" como ÚNICO destino padrão contradiz o próprio artigo que motivou esta trilha de mudanças. O artigo defende que um local de partida vivo — onde o personagem tem raízes e gente conhecida, com uma tensão de fundo já perceptível mas não necessariamente violenta — serve melhor a aventuras exploratórias do que empurrar o grupo para um confronto fixo assim que a cena abre. `complicacao` (já rolada deterministicamente, US-146/US-147) quase sempre TEM alguma tensão nomeável — "sem conflito óbvio" hoje é raro na prática, mas quando o modelo julga que é o caso, a única saída que o `system` oferece é violência.

### A proposta

Duas mudanças na mesma chamada:

1. `generateOpeningBeat` ganha `background` **e** `origin` como parâmetros (mesmos tipos que `generateSecrets` já recebe — `origin?: { connection?: string; memento?: string }`), e o `system` ganha uma instrução espelhando o `anchorInstruction` de `generateSecrets` (US-149), não o `bondsInstruction` mais simples de `generateLocationsAndNpcs`: quando `bonds`/`story`/`flaws`/`origin.connection`/`origin.memento` existirem, preferir ancorar a cena no local/NPC mais alinhado a uma dessas âncoras.
2. `generateOpeningBeat` também passa a receber `complicacao` (mesmo tipo já usado em `generateClosing`), e o `system` troca o fallback único de "abra com confronto" por dois estilos de abertura forte nomeados, ambos do repertório LGMRD/artigo — o modelo escolhe pelo que a `premissa`/`complicacao` sugerir, sem viés padrão para violência:
   - **Enraizada** (preferida quando nada aponta violência): chegada a um local vivo, encontro com um NPC — de preferência o ligado a uma âncora pessoal, via item 1 — com a `complicacao` já pairando como tensão perceptível, sem exigir luta.
   - **Confronto** (quando `premissa`/`complicacao`/`secrets` tornarem a violência a leitura mais natural — perseguição, ataque em curso, monstro solto): ameaça ou luta já em ação, comportamento de hoje, preservado como opção, não removido.

---

## Escopo

### Dentro do escopo

- `generateOpeningBeat` ([ai.service.ts:1492](../../../apps/api/src/ai/ai.service.ts)) ganha `params.background?: CharacterBackground`, `params.origin?: { connection?: string; memento?: string }` (mesmo tipo de `generateSecrets`) e `params.complicacao: { condition: string; description: string; origin: string }` (mesmo tipo já usado em `generateClosing`) — três parâmetros novos, mesma assinatura de objeto.
- `system`/`buildOpeningBeatPrompt` ganham instrução de vínculo espelhando o `anchorInstruction` de `generateSecrets` ([ai.service.ts:1408-1422](../../../apps/api/src/ai/ai.service.ts)) — `story`/`bonds`/`flaws`/`origin.connection`/`origin.memento`, o que houver, preferir ancorar a cena no local/NPC ligado a uma dessas âncoras.
- `system` reescrito: o fallback único "sem conflito óbvio, abra com confronto" vira dois estilos nomeados — **Enraizada** (padrão quando nada aponta violência: chegada/encontro com gente conhecida, `complicacao` como tensão de fundo perceptível, sem exigir luta) e **Confronto** (quando `premissa`/`complicacao`/`secrets` tornarem violência a leitura mais natural: ameaça ou luta já em ação — comportamento de hoje, preservado como opção). O modelo escolhe pelo conteúdo recebido, não por um verbo de comando único.
- `adventure.service.ts:172-178` (chamada dentro de `generateAdventure`) passa `background: profile.background`, `origin: profile.origin` e `complicacao: content.complicacao` a `generateOpeningBeat`, igual já faz para `generateSecrets` (linha 149-150, `background`+`origin`) e para `generateClosing` (linha 169, `complicacao`).
- Teste de regressão: (a) fixture com `bonds`/`origin.connection`/`origin.memento` citando um NPC/local por nome/traço — confirma instrução de vínculo no `system`/`prompt` e `start` referenciando esse NPC/local; (b) fixture com `complicacao` claramente não-violenta (ex. disputa política, segredo social) — confirma que `start` gerado NÃO abre em luta; (c) fixture com `premissa`/`complicacao` inerentemente violenta — confirma que a opção de confronto continua disponível e é usada quando cabe.
- `pnpm eval` roda e passa (mudança em prompt de geração — regra do projeto, `AGENTS.md`).

### Fora do escopo

- **Reabrir `setting`/`areaType`** (pilar "ambiente" do artigo) — a US-173 descartou os dois eixos HOJE por não terem consumidor real; esta story não reintroduz esse julgamento. `tone` já cumpre o papel de "ambiente adequado ao grupo" que sobrou depois daquela decisão.
- **Remover o confronto como opção de abertura** — o artigo não diz "nunca comece com luta", diz "não force um enredo pré-definido"; a heurística LGMRD "when in doubt, start with a fight" continua válida quando a `premissa`/`complicacao` for inerentemente violenta. Esta story deixa de ser o ÚNICO destino, não elimina a opção.
- **Conflito de fundo como campo novo** (pilar 2 do artigo) — já coberto por `premissa`/`complicacao`/antagonista (`generateClosing`, decisão #2 da US-164); esta story só passa `complicacao`, que já existe, a mais uma chamada — não cria dado novo.
- **Campo estruturado marcando qual NPC/local foi amarrado a uma âncora pessoal** (ex. `AdventureNpc.boundToCharacter: boolean`) — mudaria o schema (US-144) por um sinal que só esta chamada consumiria; a instrução textual (mesmo padrão de `anchorInstruction`) resolve sem tocar schema. Se um eval futuro mostrar que o modelo não segue a instrução de forma confiável, campo estruturado vira story própria.
- **Unificar `bondsInstruction` (US-158, só `bonds`) com o molde mais rico desta story** — são chamadas diferentes (`generateLocationsAndNpcs` amarra NPC no MOMENTO de criá-lo; `generateOpeningBeat` só escolhe entre NPCs/locais já prontos) e nada indica que precisam do mesmo conjunto de âncoras. Se um eval futuro mostrar que `generateLocationsAndNpcs` também se beneficiaria de `origin`/`story`/`flaws`, vira story própria.
- **Entrada colaborativa do jogador em NPCs/locais antes da geração** (o artigo também recomenda "allow players collaborative input") — não pedido, e não cabe no fluxo síncrono de criação de personagem hoje (não há etapa de negociação de mundo antes da aventura existir).
- **`deity`/`portfolio` como âncora adicional da abertura** — já ancora o antagonista via `premissa`/`generateClosing`; `bonds` é o campo que o backlog do motor (*§As entradas já existem no repo*) já nomeia como "o encaixe mais forte" para ligação pessoal. Não somar um segundo eixo sem necessidade observada.
- **Escolher o estilo (Enraizada/Confronto) por nível do personagem** — o artigo sugere que povoados servem melhor a grupos de nível baixo, mas o motor hoje só gera nível 1 (*Ressalva do nível* do backlog do motor); condicionar por nível não muda nada na prática e adiciona lógica sem sinal para testar. Se a progressão de nível (D1) entrar, revisitar.

---

## Critérios de aceite

- [ ] `generateOpeningBeat` aceita `params.background?: CharacterBackground`, `params.origin?: { connection?: string; memento?: string }` e `params.complicacao: { condition: string; description: string; origin: string }`.
- [ ] Quando `background.bonds`/`story`/`flaws` ou `origin.connection`/`origin.memento` tiverem ao menos um item não vazio, o `system`/`prompt` de `generateOpeningBeat` inclui instrução de ancorar a cena no local/NPC ligado a uma dessas âncoras.
- [ ] `system` de `generateOpeningBeat` não tem mais um único fallback de combate — oferece **Enraizada** (chegada/gente conhecida/tensão de fundo sem exigir luta) e **Confronto** (ameaça/luta em ação) como estilos nomeados, escolha do modelo pela `premissa`/`complicacao` recebida.
- [ ] Confronto continua disponível e é a leitura esperada quando `premissa`/`complicacao` for inerentemente violenta — não é regressão de capacidade, só deixa de ser o único destino.
- [ ] `generateAdventure` (`adventure.service.ts`) passa `profile.background`, `profile.origin` e `content.complicacao` a `generateOpeningBeat`.
- [ ] `hookSeed` continua fora dos parâmetros de `generateOpeningBeat` — esta story não reabre a disciplina da US-172 (`background`/`origin`/`complicacao` ≠ `hookSeed`).
- [ ] **Eval / teste de regressão:** (a) fixture com `bonds` ou `origin.connection`/`origin.memento` citando um NPC/local por nome — `start` gerado referencia esse NPC/local; (b) fixture com `complicacao` não-violenta — `start` gerado não abre em luta; (c) fixture com `premissa`/`complicacao` violenta — `start` gerado usa a abertura de confronto.
- [ ] `pnpm typecheck` e `pnpm test` passam.
- [ ] `pnpm eval` passa.

---

## Notas de implementação

- Extrair a lógica de `anchors`/`anchorInstruction` ([ai.service.ts:1408-1422](../../../apps/api/src/ai/ai.service.ts)) para uma função pura reusada nas duas chamadas (`generateSecrets` e `generateOpeningBeat`) — evita duas listas quase-idênticas (`story`/`bonds`/`flaws`/`origin.connection`/`origin.memento`) divergindo com o tempo. Mesmo argumento de reuso que motivou US-177/US-179 (seção compartilhada extraída de `dm-system.ts`) nesta mesma leva de stories. `bondsInstruction` (US-158, `generateLocationsAndNpcs`) fica de fora dessa extração — molde mais simples, chamada com propósito diferente (ver Fora do escopo).
- Plumbing em `adventure.service.ts:172-178`: `profile.background` e `profile.origin` já estão no escopo local (linhas 149-150 já os usam para `generateSecrets`) e `content.complicacao` também (linha 169 já o passa a `generateClosing`) — três campos a mais no mesmo objeto de `params`, sem lógica nova.
- `complicacao` já é tipado inline em `generateClosing` ([ai.service.ts:1461](../../../apps/api/src/ai/ai.service.ts)) — reusar o mesmo tipo inline em `generateOpeningBeat`, não criar interface nova só para isso.
- Redação dos dois estilos (Enraizada/Confronto): manter concisa — cada um 1-2 frases no `system`, no mesmo estilo direto das instruções atuais (`ai.service.ts:1503-1507`), não um bloco longo.
- `generateOpeningBeat` continua "nunca captura erro" (disciplina da US-172) — esta story não muda isso.

---

## Questões em aberto

1. `anchorInstruction` deveria virar função compartilhada já nesta story, ou ficar duplicado lado a lado por ora, com extração como limpeza separada? Recomendação: extrair já — é a mesma lista de âncoras, mudança mecânica, e evita as duas divergirem (favorece nomes greppáveis/funções pequenas, `AGENTS.md`).
2. Vale medir com eval dedicado (LLM-judge) se a cena de abertura realmente soa "pessoal" quando há vínculo, ou o teste estrutural (instrução presente + nome citado) basta por ora? Mesma pergunta que US-177/US-179 deixaram em aberto para seus próprios reforços de prompt — decidir junto, mesmo padrão.
3. O modelo escolhe entre Enraizada/Confronto sozinho, pelo conteúdo — não há classificador determinístico de "isto é violento" no código. Se o eval mostrar viés forte para um lado (ex. o modelo continuar caindo em confronto na maioria das vezes, hábito herdado do texto antigo), vale reforçar a instrução com um exemplo positivo de abertura Enraizada, ou é cedo para prescrever isso sem ver a saída real?

---

## Referências no código

- [apps/api/src/ai/ai.service.ts:1492-1514](../../../apps/api/src/ai/ai.service.ts) — `generateOpeningBeat`, a mudar.
- [apps/api/src/ai/ai.service.ts:226-245](../../../apps/api/src/ai/ai.service.ts) — `buildOpeningBeatPrompt`.
- [apps/api/src/ai/ai.service.ts:1401-1422](../../../apps/api/src/ai/ai.service.ts) — `generateSecrets`, `anchors`/`anchorInstruction`, molde principal a espelhar/extrair (já combina `background` e `origin`).
- [apps/api/src/ai/ai.service.ts:1345-1351](../../../apps/api/src/ai/ai.service.ts) — `bondsInstruction` em `generateLocationsAndNpcs`, molde mais simples (só `bonds`), citado por contraste — não é o que esta story espelha.
- [apps/api/src/ai/ai.service.ts:1461](../../../apps/api/src/ai/ai.service.ts) — tipo inline de `complicacao` em `generateClosing`, a reusar.
- [apps/api/src/adventure/adventure.service.ts:172-178](../../../apps/api/src/adventure/adventure.service.ts) — chamada dentro de `generateAdventure`, ganha `background`, `origin` e `complicacao` (linhas 149-150 e 169 já mostram os mesmos dados indo para `generateSecrets`/`generateClosing`).
- [apps/api/src/character/character.schema.ts:51](../../../apps/api/src/character/character.schema.ts) — `origin` no DTO de criação (`connection`/`memento`), fonte última do dado.
- [US-172](./US-172-abertura-gerada-nao-copia-gancho-fixo.md) — dona de `generateOpeningBeat`.
- [US-149](./US-149-segredos-40-prompts-lgmrd.md) — dona do `anchorInstruction`, molde principal desta story.
- [US-158](./US-158-locais-npcs-prosa-motor.md) — origem do `bondsInstruction`, molde mais simples citado por contraste.
- [US-173](./US-173-registro-fica-so-com-tone.md) — por que o pilar "ambiente" do artigo-fonte fica fora desta story.
- [US-39](./US-39-identidade-narrativa-background-ideais.md) — origem de `background.bonds`.
- [Backlog — Motor de geração de aventuras one-shot §As entradas já existem no repo](./backlog-motor-de-geracao-de-aventuras.md) — "`background.deity` é o encaixe mais forte [...] para o antagonista"; `bonds` é o equivalente para ligação pessoal do personagem com locais/NPCs.
- Artigo-fonte: [*Your D&D Campaign's Starting Point*](https://www.rjd20.com/2019/05/your-d-campaigns-starting-point.html) (rjd20.com, 2019) — três pilares de um início de campanha (ambiente, conflito de fundo, vínculo de personagem); esta story implementa só o terceiro.
