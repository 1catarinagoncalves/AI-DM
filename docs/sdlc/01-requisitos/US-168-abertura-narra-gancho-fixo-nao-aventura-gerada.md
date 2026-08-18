# US-168 — Abertura narrada expande o gancho fixo, não a aventura gerada

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** 🚧 Em progresso
**Depende de:** nenhuma
**Relacionado:** [US-153](./US-153-aventura-deixa-de-ser-derivada-da-classe.md) (aposentou o gancho fixo por classe como *a aventura*, mas não atualizou `buildOpeningInstruction` pra isso) · [US-164](./US-164-orquestrador-motor-monta-aventura-gerada.md) (dono do `GeneratedAdventure`/`mainQuest` que deveria dominar a abertura) · [US-157](./US-157-tela-de-mundo-depois-da-revisao.md) (1º fluxo ponta-a-ponta — criação de personagem → passo Mundo → aventura — que expôs o bug em validação manual)
**Criada em:** 2026-08-18 — achado ao validar manualmente o fluxo de criação da US-157: personagem Bardo, aventura gerada com resumo "Protect an NPC" (visível no hub), mas a 1ª narração do Mestre foi sobre um baile na corte Eladrin — o gancho fixo do Bardo, sem nenhuma menção à aventura gerada.

---

## História

> **Como** jogador que acabou de criar um personagem e uma aventura gerada (setting/tom/tipo de área escolhidos ou sorteados, US-157),
> **quero** que a primeira narração do Mestre seja sobre a aventura que foi de fato gerada para mim,
> **para que** a premissa que vejo no hub ("Aventura: X") bata com o que o Mestre efetivamente narra na 1ª cena.

---

## Contexto e motivação

### O problema observado

Personagem Bardo, aventura gerada com resumo "Protect an NPC" (título mostrado no hub de personagens). A 1ª narração do Mestre (persistida como o evento `NARRATION` inicial e mostrada na tela de jogo) não menciona a NPC, o objetivo de proteção, nem qualquer elemento do artefato gerado — é uma cena inteira sobre um Carvalhal feérico, uma corte de Eladrin dançando, e uma chave/baú, com um Eladrin convidando o personagem para dançar. Esse conteúdo bate, quase frase a frase, com o gancho fixo por classe do Bardo (o `hookSeed` resolvido por `resolveInitialHook` a partir do config do sistema) — não com o `GeneratedAdventure.summary`/`start` que o motor de geração (US-164) produziu para esta aventura específica.

### Por que a solução atual não basta

`buildOpeningInstruction` ([dm-system.ts:614](../../../packages/ai-engine/src/prompts/dm-system.ts)) recebe só `characterName`, `hookSeed` e `locale` — **nunca** `mainQuest`. A instrução que ela monta diz literalmente ao modelo:

> "Use this seed as the spark for the scene... Expand it into a full cinematic opening... do NOT quote it verbatim: `"{hookSeed}"`"

`hookSeed` aqui é `profile.hookSeed` (`adventure.service.ts` → `buildAdventureProfile`), que é o gancho **fixo por classe** — o mesmo texto que, antes da US-153/US-164, era a aventura inteira. A US-153 aposentou esse gancho como *a aventura* (ele virou só uma âncora de continuidade/estilo para o motor de geração), mas ninguém atualizou `buildOpeningInstruction`: ela continua tratando `hookSeed` como "a fagulha da cena", a única coisa que o modelo recebe como instrução direta de "isto é o que você narra agora".

O `mainQuest` de verdade (`${generated.summary}\n${generated.start}`, montado em `createForCharacter`) só entra em `buildTurnStateBlock` como bloco passivo de estado — "## Main quest", sob o cabeçalho "read-only — managed by the Game Server", junto de HP/inventário/cena. Ele nunca é apresentado como a fonte da cena de abertura. O modelo obedece à instrução mais explícita e recente (a mensagem de usuário, `buildOpeningInstruction`) em vez do bloco de estado — daí expandir fielmente o gancho fixo e ignorar a aventura gerada.

### A proposta

`buildOpeningInstruction` passa a receber `mainQuest` e a instrução centra nele como "a fagulha da cena" — a aventura gerada é o que a 1ª narração precisa dramatizar. `hookSeed` deixa de ser citado como o spark principal (ele já está embutido em `mainQuest`, ver Notas de implementação).

---

## Escopo

### Dentro do escopo

- `buildOpeningInstruction` ganha parâmetro `mainQuest?: string | null` e reescreve a instrução para usá-lo como a fagulha da cena.
- Chamada em `ai.service.ts` (`generateOpeningNarration`, linha ~1173) passa `params.mainQuest` na chamada.
- Fallback: sem `mainQuest` (ex.: `resolveInitialHook`/motor indisponível, ou sistema legado sem aventura gerada), a instrução cai no comportamento atual — `hookSeed` como spark — para não quebrar nenhum caminho existente.
- Eval/teste de regressão cobrindo que a abertura gerada reflete o `mainQuest`, não só o `hookSeed`.

### Fora do escopo

- Mudar o formato do bloco "## Main quest" em `buildTurnStateBlock` — ele já expõe o dado certo, só não é onde a instrução de abertura devia buscar a fagulha.
- Mudar `AdventureService.generateAdventure`/o motor de geração (US-164) — o artefato gerado já está correto; o bug é só na instrução de prompt que ignora ele.
- Fallback estático (`openingText = generatedOpening ?? profile.hookSeed`, `adventure.service.ts:329`) quando a chamada de IA falha inteira — esse comportamento é correto e intencional (US-101), não é este bug.

---

## Critérios de aceite

- [ ] `buildOpeningInstruction` aceita `mainQuest?: string | null`.
- [ ] Com `mainQuest` presente, a instrução usa esse texto como a fagulha da cena de abertura ("use isto, não `hookSeed`, como o que você dramatiza").
- [ ] Sem `mainQuest` (`null`/`undefined`), a instrução cai no comportamento atual (`hookSeed` como spark) — nenhum caminho existente quebra.
- [ ] `generateOpeningNarration` (`ai.service.ts`) passa `params.mainQuest` para `buildOpeningInstruction`.
- [ ] **Eval / teste de regressão:** caso que monta um `hookSeed` A e um `mainQuest` B claramente distintos (ex.: hookSeed sobre uma corte feérica, mainQuest sobre proteger uma NPC numa mina) e confirma que a abertura gerada referencia elementos de B, não de A.
- [ ] `pnpm eval` passa (regra do projeto para qualquer mudança em prompt do DM Agent).

---

## Notas de implementação

- `GeneratedAdventure.start` **já é** `profile.hookSeed` (`adventure.service.ts:206`, `start: profile.hookSeed` dentro de `generateAdventure`) — e `mainQuest = \`${generated.summary}\n${generated.start}\`` (`adventure.service.ts` em `createForCharacter`). Ou seja, `mainQuest` já contém o `hookSeed` embutido no fim; citar só `mainQuest` na instrução não perde a âncora de continuidade, só corrige o peso (a aventura gerada vem primeiro/dominante, o gancho de classe vira o fecho/tempero).
- Arquivo principal: [dm-system.ts](../../../packages/ai-engine/src/prompts/dm-system.ts) → `buildOpeningInstruction` (linha 614).
- Segundo arquivo: [ai.service.ts](../../../apps/api/src/ai/ai.service.ts) → `generateOpeningNarration` (linha ~1173), onde a chamada precisa do novo argumento.
- Mudança em prompt do DM Agent — rodar `pnpm eval` depois (custa chamadas reais de LLM, ver `AGENTS.md`).

---

## Questões em aberto

1. Quando `mainQuest` e `hookSeed` divergem em algum detalhe concreto (nome de item, tom), a instrução deve mencionar `hookSeed` explicitamente como pano de fundo de personagem/classe, ou só `mainQuest`? Como `generated.start` já É `hookSeed`, na prática os dois deveriam estar sempre alinhados — mas vale confirmar com um caso onde o motor gerou uma aventura em tom bem diferente do gancho de classe (ex.: Bardo cortesão numa aventura de terror em masmorra).

---

## Referências no código

- [packages/ai-engine/src/prompts/dm-system.ts:614](../../../packages/ai-engine/src/prompts/dm-system.ts) — `buildOpeningInstruction`, a função a mudar.
- [apps/api/src/ai/ai.service.ts:1173](../../../apps/api/src/ai/ai.service.ts) — chamada que hoje só passa `hookSeed`.
- [apps/api/src/adventure/adventure.service.ts:206](../../../apps/api/src/adventure/adventure.service.ts) — `start: profile.hookSeed` dentro de `generateAdventure` (prova que `mainQuest` já contém o `hookSeed`).
- [apps/api/src/adventure/adventure.service.ts:329](../../../apps/api/src/adventure/adventure.service.ts) — fallback estático quando `generateOpeningNarration` devolve `null` (comportamento correto, não é este bug).
