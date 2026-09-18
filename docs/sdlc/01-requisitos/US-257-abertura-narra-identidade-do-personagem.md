# US-257 — Abertura narra raça, classe, background e origem do personagem amarrados ao mundo

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** [US-125](./US-125-beneficios-origem-no-system-prompt.md) (✅ — dona do tipo `OriginNarrative` e da seção `## Origin narrative` que esta story leva à abertura) · [US-39](./US-39-identidade-narrativa-background-ideais.md) (✅ — dona de `CharacterBackground`/`backgroundSection`, já presente na abertura) · [US-168](./US-168-abertura-narra-gancho-fixo-nao-aventura-gerada.md) (✅ — dona de `buildOpeningInstruction`, a função que esta story estende)
**Relacionado:** [US-172](./US-172-abertura-gerada-nao-copia-gancho-fixo.md) (heurística *in medias res*/LGMRD que a instrução nova precisa conviver, não substituir) · [US-121](./US-121-catalogo-backgrounds-a5e-adventurers-guide.md)/[US-122](./US-122-escolha-background-catalogo-na-criacao.md) (catálogo de origem cuja prosa `adventuresAndAdvancement` esta story expõe pela 1ª vez na abertura)
**Criada em:** 2026-09-18

---

## História

> **Como** jogadora que acabou de criar um personagem,
> **quero** que a primeira narração do Mestre apresente quem meu personagem É — raça, classe, background e origem — amarrado ao mundo e ao gancho da aventura que vou jogar,
> **para que** a cena de abertura me situe tanto no MUNDO quanto na IDENTIDADE do meu personagem, em vez de tratar raça/classe como detalhe decorativo e origem como se não existisse.

---

## Contexto e motivação

### O problema observado

`AiService.generateOpeningNarration` ([ai.service.ts:1386-1429](../../../apps/api/src/ai/ai.service.ts)) monta o `system` da abertura chamando `buildDmSystemPrompt` — mas sua assinatura **não tem parâmetro `originNarrative`**, e as duas chamadas que a alimentam (`adventure.service.ts:530` no ramo "Aventura pronta"/preset, e `adventure.service.ts:707` no ramo com motor de geração) confirmam isso: nenhuma das duas passa `originNarrative`. Resultado: a seção `## Origin narrative` (US-125 — gancho de aventura típico da origem, conexão e memento escolhidos na criação) **nunca aparece no prompt da 1ª cena**, só a partir do 2º turno (`streamChat`, [ai.service.ts:669-673](../../../apps/api/src/ai/ai.service.ts), que monta e passa `originNarrative` corretamente).

Ou seja: a origem do personagem — metade do que esta story pede para narrar — é invisível ao modelo exatamente no momento em que ele escreve a cena que deveria apresentá-la.

O comentário em `buildAdventureProfile` ([adventure.service.ts:153-155](../../../apps/api/src/adventure/adventure.service.ts)) já registra a decisão de deixar `connection`/`memento` fora do `AdventureProfile` "de propósito", afirmando que os dois "continuam servindo só a narração de turno ao vivo (`ai.service.ts:344-356`, lê `Character.origin` direto, não este perfil)" — mas a abertura (`generateOpeningNarration`) TAMBÉM é uma narração ao vivo gerada por IA, e não está entre os consumidores dessa leitura. A afirmação vale para os turnos 2+, não para o turno 1.

`background` (US-39 — história/ideais/vínculos/fraquezas/divindade) **já chega** à abertura hoje (`adventure.service.ts:541` e `:721` passam `background` para `generateOpeningNarration`) — não é um gap de dado, só de instrução (ver abaixo).

### Por que a solução atual não basta

Mesmo com `background` presente, `buildOpeningInstruction` ([dm-system.ts:702-741](../../../packages/ai-engine/src/prompts/dm-system.ts)) só instrui: *"use `${characterName}`'s race and class as a lens on the world"* — uma linha, só raça+classe, dentro da frase de craft bar. Não menciona background nem origem, e não pede para a cena amarrar identidade a MUNDO+HISTÓRIA — a instrução de `backgroundSection` no system prompt ([dm-system.ts:328-329](../../../packages/ai-engine/src/prompts/dm-system.ts)) é genérica para QUALQUER turno ("deixe colorir QUANDO a cena pedir... NÃO force onde a cena não pede"), o oposto do que a abertura precisa: a cena de abertura é exatamente o momento em que a cena PEDE.

### A proposta

`generateOpeningNarration` passa a receber e repassar `originNarrative` a `buildDmSystemPrompt`, do mesmo jeito que `background` já é repassado hoje — a seção `## Origin narrative` passa a existir desde a 1ª cena. `buildOpeningInstruction` ganha uma linha explícita instruindo a amarrar raça, classe, background e origem ao mundo e ao gancho desta aventura específica — sem virar bloco de exposição estática nem contradizer a heurística *in medias res* da US-172 (a identidade entra tecida na ação, não antes dela).

---

## Escopo

### Dentro do escopo

- `AiService.generateOpeningNarration` ganha parâmetro `originNarrative?: OriginNarrative` e repassa para `buildDmSystemPrompt` (mesmo padrão de `background`, já existente).
- As duas chamadas em `adventure.service.ts` (`:530` ramo preset, `:707` ramo com motor) passam `originNarrative`, montado da MESMA forma que `streamChat` já faz (`ai.service.ts:669-673`): `{ adventuresAndAdvancement: resolveAdventuresAndAdvancement(config.backgrounds, origin.key), connection: origin.connection, memento: origin.memento }`, lendo `character.origin` bruto — não o `AdventureProfile.origin` (que de propósito só carrega `adventuresAndAdvancement`, ver `adventure.service.ts:153-158`).
- `buildOpeningInstruction` ganha uma frase explícita pedindo para a cena de abertura amarrar raça, classe, background e origem do personagem ao MUNDO e ao gancho desta aventura — sem virar exposição estática nem lista, preservando a regra *in medias res* (US-172) e a proibição de listar traços verbatim (US-39).
- Continua valendo a regra de PROVENÂNCIA de `originNarrative` (US-125, `dm-system.ts:389`): conexão/memento são passado PRIVADO do personagem — a abertura pode deixar o personagem REFLETIR sobre eles internamente, mas nenhum NPC pode conhecê-los, nomeá-los ou aludir a eles nesta cena.
- Eval/teste de regressão: fixture com `originNarrative` preenchido confirma que a abertura gerada reflete (ou pelo menos não contradiz) a conexão/memento/gancho de origem — mesmo formato de amostragem qualitativa usado pela US-168 (bake-off da US-17), não asserção de string exata.

### Fora do escopo

- Mudar `backgroundSection`/`originNarrativeSection` em `buildDmSystemPrompt` — o texto e a regra de provenância já estão corretos (US-39/US-125); esta story só preenche o parâmetro que falta em UM caminho de chamada (a abertura) e ajusta a instrução da abertura, não a seção do system prompt em si.
- Expor o RÓTULO cru do catálogo de origem (ex. "Acólito") como campo novo no prompt — `adventuresAndAdvancement` (a prosa da origem, já incluída em `originNarrative`) já comunica o sabor da origem sem precisar do rótulo solto; se isso se provar insuficiente em QA, vira story própria.
- `subclass` do personagement — não foi pedido nesta story e hoje não chega a `buildDmSystemPrompt`/`buildOpeningInstruction` em nenhum turno (não é regressão introduzida aqui, é um campo que nunca existiu no prompt).
- Reabrir a decisão *in medias res* da US-172 ou o craft bar da US-245 — esta story acrescenta uma instrução de amarração de identidade DENTRO do craft bar existente, não substitui a estrutura de cena já decidida.
- Aventuras criadas ANTES desta story — `originNarrative` ausente/vazio (personagem sem `connection`/`memento` escolhidos, ou sistema sem catálogo de origem) cai no comportamento atual: seção ausente, instrução nova não força nada onde não há dado.

---

## Critérios de aceite

- [ ] `AiService.generateOpeningNarration` aceita `originNarrative?: OriginNarrative` e repassa a `buildDmSystemPrompt`.
- [ ] Ambos os call sites em `adventure.service.ts` (ramo preset e ramo com motor de geração) passam `originNarrative` construído a partir de `character.origin` bruto + `config.backgrounds`, mesmo cálculo do `streamChat`.
- [ ] Sem `origin.key`/`connection`/`memento` preenchidos (personagem sem origem escolhida), `originNarrative` fica com campos vazios e a seção `## Origin narrative` continua ausente do prompt — nenhum caminho existente quebra.
- [ ] `buildOpeningInstruction` contém uma instrução explícita para amarrar raça, classe, background e origem do personagem ao mundo/gancho desta aventura — verificável por teste que a string da instrução mudou nesse sentido (não é geração, é o texto do PROMPT em si).
- [ ] A regra de provenância de `connection`/`memento` (PRIVADO — nenhum NPC conhece até o jogador revelar) permanece intacta na abertura: teste de regressão confirma que a instrução nova não remove nem enfraquece o aviso de provenância já existente em `originNarrativeSection`.
- [ ] `pnpm typecheck` e `pnpm test` passam.
- [ ] **Eval / teste de regressão:** `dm-system.test.ts` cobre que, com `originNarrative` preenchido, o PROMPT da abertura contém a seção `## Origin narrative` (hoje ausente na abertura, presente só a partir do turno 2) — mesmo molde da US-168 (`buildOpeningInstruction — mainQuest domina o gancho fixo`); `ai.service.test.ts`/`adventure.service.test.ts` confirmam que `originNarrative` chega a `generateOpeningNarration` nos dois call sites.
- [ ] **Eval / teste de regressão (qualitativa, bake-off US-17):** fixture com origem/conexão/memento distintos do gancho de classe (`hookSeed`) confirma que a abertura gerada reflete raça/classe/background/origem tecidos na cena, sem virar bloco de exposição estática nem contradizer a estrutura *in medias res*.
- [ ] `pnpm eval` passa (mudança em prompt do DM Agent — regra do projeto, `AGENTS.md`) — rodar antes de fechar a story (custa chamadas reais pagas de LLM).

---

## Notas de implementação

- Cálculo de `originNarrative` para a abertura deve espelhar EXATAMENTE `ai.service.ts:669-673` (`streamChat`) — mesma função `resolveAdventuresAndAdvancement`, mesmo formato `{ adventuresAndAdvancement, connection, memento }` — para não divergir do que os turnos seguintes veem.
- **Não reusar `AdventureProfile.origin`** para isto — ele só carrega `adventuresAndAdvancement` por decisão explícita (`adventure.service.ts:153-155`); `connection`/`memento` têm que vir de `character.origin` bruto, disponível nos dois call sites (`character.origin` já é lido em `createForCharacter` para outros fins, ex. `origin.key` na linha 484-488).
- `ai-engine` roda de `dist` — `pnpm --filter @ai-dm/ai-engine build` depois de editar `dm-system.ts`, senão a mudança de prompt não aparece nem em dev nem em teste de `api`.
- Ao redigir a frase nova em `buildOpeningInstruction`, evitar duplicar a instrução de provenância já presente em `originNarrativeSection` do system prompt — a instrução da abertura deve pedir a AMARRAÇÃO (identidade↔mundo), a regra de "o que o NPC pode saber" já vive no system e não precisa ser repetida.
- Mudança em prompt do DM Agent — rodar `pnpm eval` depois (custa chamadas reais de LLM, ver `AGENTS.md`).

---

## Questões em aberto

1. A frase nova em `buildOpeningInstruction` deve citar os 4 eixos (raça/classe/background/origem) explicitamente, ou uma instrução mais aberta tipo "amarre quem `${characterName}` é a este mundo e a este gancho"? A primeira arrisca virar checklist mecânica que o modelo tenta marcar item a item (sintoma parecido com os "apelos forçados" que a US-182 removeu, citado na US-245); a segunda confia mais no craft bar já detalhado no system prompt. Recomendação: instrução aberta, citando os 4 eixos só como PARÊNTESE de exemplo, não como lista obrigatória — decisão final cabe à mantedora antes de implementar.
2. Quando `mainQuest` (aventura gerada) e a origem do personagem puxam para tons diferentes (ex. origem "Acólito devoto" vs. aventura sorteada `tone: 'comedic'`), qual pesa mais na abertura? Nenhuma story existente resolve esse conflito — provavelmente o mesmo tratamento do `tone` (US-168): a aventura gerada dá o registo, a identidade dá a LENTE através da qual o personagem vive esse registo, nunca o contrário. Confirmar com a mantedora se essa hierarquia implícita precisa virar instrução explícita ou se o craft bar atual já resolve por inferência.

---

## Referências no código

- [`apps/api/src/ai/ai.service.ts:1386-1429`](../../../apps/api/src/ai/ai.service.ts) — `generateOpeningNarration`, assinatura e chamada a `buildDmSystemPrompt` que ganham `originNarrative`.
- [`apps/api/src/ai/ai.service.ts:669-673`](../../../apps/api/src/ai/ai.service.ts) — cálculo de `originNarrative` em `streamChat`, o molde a replicar para a abertura.
- [`apps/api/src/adventure/adventure.service.ts:530`](../../../apps/api/src/adventure/adventure.service.ts) — call site do ramo "Aventura pronta"/preset, sem `originNarrative`.
- [`apps/api/src/adventure/adventure.service.ts:707`](../../../apps/api/src/adventure/adventure.service.ts) — call site do ramo com motor de geração (`finalizeGeneratedAdventure`), sem `originNarrative`.
- [`apps/api/src/adventure/adventure.service.ts:153-158`](../../../apps/api/src/adventure/adventure.service.ts) — comentário que documenta a exclusão deliberada de `connection`/`memento` do `AdventureProfile`, e a afirmação (só parcialmente verdadeira) de que os dois já alimentam "a narração de turno ao vivo".
- [`packages/ai-engine/src/prompts/dm-system.ts:702-741`](../../../packages/ai-engine/src/prompts/dm-system.ts) — `buildOpeningInstruction`, a função que ganha a instrução nova.
- [`packages/ai-engine/src/prompts/dm-system.ts:328-333`](../../../packages/ai-engine/src/prompts/dm-system.ts) — `backgroundSection`, já presente na abertura hoje.
- [`packages/ai-engine/src/prompts/dm-system.ts:386-393`](../../../packages/ai-engine/src/prompts/dm-system.ts) — `originNarrativeSection`, incluindo a regra de PROVENÂNCIA que esta story precisa preservar.
- [US-125](./US-125-beneficios-origem-no-system-prompt.md) — dona do tipo `OriginNarrative` e da seção que esta story leva à abertura.
- [US-168](./US-168-abertura-narra-gancho-fixo-nao-aventura-gerada.md) — dona de `buildOpeningInstruction`, mesmo padrão de teste de regressão a seguir.
- [US-172](./US-172-abertura-gerada-nao-copia-gancho-fixo.md) — heurística *in medias res* que a instrução nova não pode contradizer.
