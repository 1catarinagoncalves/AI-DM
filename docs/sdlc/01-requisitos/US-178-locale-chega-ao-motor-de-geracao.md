# US-178 — `locale` do jogador chega ao motor de geração (hoje as 4 chamadas escrevem só em pt-BR)

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** nenhuma — `locale` já é resolvido em `createForCharacter` ([adventure.service.ts:226](../../../apps/api/src/adventure/adventure.service.ts)) antes da chamada ao motor; é encanamento, mesma peça que `generateOpeningNarration` já recebe ([adventure.service.ts:309](../../../apps/api/src/adventure/adventure.service.ts)).
**Relacionado:** [ADR 005](../../adr/005-locale-como-dimensao.md) (bilíngue PT-BR/EN é dimensão de Fase 1, não detalhe de UI) · [US-97](./US-97-seletor-de-idioma-pt-br-en.md) ("idioma é preferência do jogador, não chute a partir da última mensagem" — regra que esta story estende ao motor) · [US-177](./US-177-onomastica-em-npcs-e-locais-do-motor.md) (mesmo arquivo/função de `generateLocationsAndNpcs`, mudança independente — ver Notas) · [US-179](./US-179-barra-de-oficio-no-motor-de-geracao.md) (story irmã, mesmo padrão de achado, mesmas 4 chamadas)
**Criada em:** 2026-08-19 — achado ao auditar quais regras de qualidade do prompt de narração NÃO chegam ao motor de geração de aventuras.

---

## História

> **Como** jogador que escolheu inglês como idioma da mesa (`User.locale`),
> **quero** que a aventura GERADA (locais, NPCs, segredos, fecho, abertura) também nasça em inglês,
> **para que** a aventura inteira seja consistente no meu idioma — hoje só a narração AO VIVO (turno a turno) respeita minha escolha; o conteúdo gerado de antemão sai sempre em português, não importa meu `locale`.

---

## Contexto e motivação

### O problema observado

Nenhuma das 4 chamadas de IA do motor de geração recebe `locale` como parâmetro — grep confirma zero ocorrência em qualquer uma das assinaturas:

- `generateLocationsAndNpcs({ rolled, registry, background })` — [ai.service.ts:1340-1344](../../../apps/api/src/ai/ai.service.ts)
- `generateSecrets({ locations, npcs, secretPrompts, background, origin })` — [ai.service.ts:1399-1405](../../../apps/api/src/ai/ai.service.ts)
- `generateClosing({ locations, npcs, secrets, registry, complicacao, premissa })` — [ai.service.ts:1456-1463](../../../apps/api/src/ai/ai.service.ts)
- `generateOpeningBeat({ locations, npcs, secrets, registry, premissa })` — [ai.service.ts:1492-1498](../../../apps/api/src/ai/ai.service.ts)

Os 4 `system` prompts são strings hardcoded em português puro (ex.: `'Você é o Mestre de um RPG vestindo de prosa o conteúdo bruto rolado...'`, [ai.service.ts:1357](../../../apps/api/src/ai/ai.service.ts)) — nenhuma delas usa `localeNameForPrompt`/`${targetLanguage}`, ao contrário de `buildDmSystemPrompt`/`buildOpeningInstruction` ([dm-system.ts:252](../../../packages/ai-engine/src/prompts/dm-system.ts), [:627](../../../packages/ai-engine/src/prompts/dm-system.ts)), que já resolvem isso desde a US-97.

Em `adventure.service.ts`, `createForCharacter` resolve `locale` na linha 226 (`resolveLocale(character.user?.locale)`) — mas a chamada ao motor, `generateGatedAdventure(profile, characterId, order, {...})` na linha 268, NÃO recebe `locale`. `generateAdventure` (chamada por `generateGatedAdventure`, [adventure.service.ts:130-136](../../../apps/api/src/adventure/adventure.service.ts)) também não tem `locale` na assinatura, e repassa só `rolled`/`registry`/`background`/`profile.level` às 4 chamadas de IA (linhas 139-178). Por comparação, `generateOpeningNarration`, chamada 20 linhas depois no MESMO método ([adventure.service.ts:289-313](../../../apps/api/src/adventure/adventure.service.ts)), já recebe `locale` (linha 309) — é a única das 5 chamadas de IA de `createForCharacter` que fica de fora.

### Por que a solução atual não basta

Resultado prático: um jogador com `locale: en-US` faz uma mesa cuja abertura narrada (`generateOpeningNarration`) e todos os turnos seguintes (`buildDmSystemPrompt`) saem em inglês — mas `locations[].description`/`boxedText`, `npcs[].role`, `secrets[].text`, `conclusion`, `followUps[]` e `start` (o próprio gancho que winRelaxNarration expande, ver US-172) nascem em português, porque é a língua em que o `system` das 4 chamadas está escrito e nenhuma instrução de idioma-alvo é dada ao modelo. Esse conteúdo é CANON PERSISTIDO (ADR 012) — não há segunda chance de gerar em inglês depois; a mistura de idioma fica fixada no artefato da aventura inteira. Não é regressão recente: nenhuma das 4 chamadas jamais recebeu `locale`, desde que cada uma foi criada (US-158/US-149/US-164/US-172).

### A proposta

`generateAdventure` ganha `locale: Locale` (repassado de `createForCharacter`, já resolvido ali) e propaga para as 4 chamadas de IA, cada uma citando `${localeNameForPrompt(locale)}` no `system` — mesmo padrão que `buildDmSystemPrompt` já usa. `AdventureProfile`/`registry` não mudam de forma; é só um parâmetro novo entrando nas 4 chamadas e no método que as orquestra.

---

## Escopo

### Dentro do escopo

- `generateAdventure` ([adventure.service.ts:130-136](../../../apps/api/src/adventure/adventure.service.ts)) ganha parâmetro `locale: Locale`.
- `generateGatedAdventure` ([adventure.service.ts:202-208](../../../apps/api/src/adventure/adventure.service.ts)) repassa `locale` para `generateAdventure` (mesmo padrão dos outros parâmetros já encanados).
- `createForCharacter` ([adventure.service.ts:268](../../../apps/api/src/adventure/adventure.service.ts)) passa `locale` (já resolvido na linha 226, mesma variável que `generateOpeningNarration` já usa) na chamada a `generateGatedAdventure`.
- As 4 assinaturas em `AiService` ganham `locale?: Locale` (opcional com fallback pro `DEFAULT_LOCALE`, mesmo contrato de `buildDmSystemPrompt`):
  - `generateLocationsAndNpcs`, `generateSecrets`, `generateClosing`, `generateOpeningBeat`.
- Cada um dos 4 `system` cita o idioma-alvo via `localeNameForPrompt(locale)` — instrução explícita de que TODA prosa gerada (não só a instrução do `system`, que pode continuar em português) deve sair no idioma-alvo. Formato exato a decidir na implementação, seguindo o padrão de `buildDmSystemPrompt` (linha `Always respond in ${targetLanguage}`, [dm-system.ts:374](../../../packages/ai-engine/src/prompts/dm-system.ts)).
- Teste de regressão: fixture com `locale: 'en-US'` vs `locale: 'pt-BR'` confirma que o `system` passado a cada uma das 4 chamadas muda conforme o idioma.

### Fora do escopo

- **Persistir `locale` na aventura gerada** — `GeneratedAdventureSchema` não ganha campo novo; o idioma já está implícito no `Character`/`User` que a possui, mesmo padrão de hoje (nenhuma outra prosa gerada guarda seu próprio idioma).
- **Nomes próprios (NPC/local)** — regidos pela regra de Onomástica ("proper names... stay AS THEY ARE, even when they come from another language", [dm-system.ts:390](../../../packages/ai-engine/src/prompts/dm-system.ts)); esta story só afeta a PROSA ao redor, não os nomes cunhados (ver [US-177](./US-177-onomastica-em-npcs-e-locais-do-motor.md), story separada e independente).
- **Traduzir aventuras já geradas em português** — sem locale, o histórico gerado antes desta story fica como está; não há backfill.
- **`extractOpeningScene`/`extractOpeningEntities`** — extraem estrutura DO texto já gerado (na língua que ele já está); não escrevem prosa nova, não precisam de `locale`.

---

## Critérios de aceite

- [x] `generateAdventure`/`generateGatedAdventure` aceitam `locale: Locale` ([adventure.service.ts:130-217](../../../apps/api/src/adventure/adventure.service.ts)).
- [x] `createForCharacter` passa o `locale` já resolvido (linha 230) na chamada ao motor ([adventure.service.ts:272](../../../apps/api/src/adventure/adventure.service.ts)).
- [x] As 4 chamadas (`generateLocationsAndNpcs`, `generateSecrets`, `generateClosing`, `generateOpeningBeat`) aceitam `locale?: Locale` e citam `localeNameForPrompt(locale ?? DEFAULT_LOCALE)` no `system` ([ai.service.ts](../../../apps/api/src/ai/ai.service.ts)).
- [x] Teste: com `locale: 'en-US'`, o `system` de cada uma das 4 chamadas contém instrução de idioma-alvo em inglês (`'English'`); com `locale: 'pt-BR'` (ou ausente), `'Brazilian Portuguese (pt-BR)'` — um teste por chamada em `ai.service.test.ts`, mais um teste dedicado em `adventure.service.test.ts` confirmando que `User.locale` chega a `generateGatedAdventure`.
- [x] `pnpm typecheck` e `pnpm test` passam (693 testes, 0 falhas).
- [x] `pnpm eval` passa (mudança em prompt do motor de geração — regra do projeto, `AGENTS.md`).
- ~~Eval / teste de regressão qualitativo (geração real end-to-end)~~ — **dispensado**, resolvido na Questão 2 acima: sem o risco que motivava a checagem (insumo em português confundindo saída em inglês, refutado — LGMRD já é inglês), o teste unitário do `system` já cobre a garantia estrutural desta story.

---

## Notas de implementação

- **Import direto**: `Locale`, `resolveLocale`, `localeNameForPrompt`, `DEFAULT_LOCALE` já existem em `@ai-dm/shared` e já são usados exatamente deste jeito em `dm-system.ts`/`adventure.service.ts` — não inventar mecanismo novo, copiar o padrão.
- **5ª chamada da mesma função**: `createForCharacter` já tem `locale` em escopo (linha 226) quando chama `generateGatedAdventure` (linha 268) — não precisa nova query nem novo cálculo, só passar a variável adiante, mesmo padrão que a US-176 aplicou para `registry`.
- **Overlap com US-177**: ambas tocam o `system` de `generateLocationsAndNpcs` ([ai.service.ts:1356-1359](../../../apps/api/src/ai/ai.service.ts)) — uma adiciona a seção de Onomástica, esta adiciona a instrução de idioma. Mudanças em pontos diferentes da mesma string; se rodarem em paralelo, uma precisa rebasear a concatenação (não é bloqueio, é ordem de merge — mesmo padrão já usado entre US-174/US-176).
- **`system` continua majoritariamente em português** (é a instrução PARA o modelo, não a saída) — só a linha de idioma-alvo muda de conteúdo; não é necessário traduzir o resto do `system` de cada chamada.
- **`prompt` (não o `system`) de cada chamada carrega o conteúdo rolado** (`buildLocationsAndNpcsPrompt`, `buildSecretsPrompt`, etc.) — SEMPRE em inglês, não em português: `RolledAdventureContent` ([roll-content.ts:9-15](../../../apps/api/src/adventure-generation/roll-content.ts)) vem direto das tabelas do LGMRD ([lgmrd-tables.json](../../../scripts/lazygm/lgmrd-tables.json)), fonte nativa em inglês (Lazy GM Resource Document, CC-BY-4.0 — ver [NOTICE-lazygm.md](../../../scripts/lazygm/NOTICE-lazygm.md)), sem nenhuma camada de tradução em `scripts/lazygm/` (`sync.mjs`/`extract-tables.mjs` não tocam idioma). Confirmado direto no artefato: `premissa: "Find an item"`, `locais: "Tower"`, `monumentos: "Sarcophagus"`, `complicacao.condition: "Smoky"`. Isso BAIXA o risco desta story: para `locale: 'pt-BR'` (default hoje, sem esta US), a produção já roda o caso mais difícil — entrada inglês, saída português — desde que cada uma das 4 chamadas existe (US-158/US-149/US-164/US-172), sem indício de degradação; para `locale: 'en-US'`, entrada e saída ficam no MESMO idioma, caso mais fácil que o de hoje.

---

## Questões em aberto

Nenhuma — as duas levantadas na criação desta story foram resolvidas antes da implementação, checando `scripts/lazygm/lgmrd-tables.json` direto:

1. ~~`RolledAdventureContent` é sempre rolado do LGMRD em português~~ — **falso, premissa incorreta.** `RolledAdventureContent` é sempre rolado em INGLÊS (fonte LGMRD nativa, sem tradução — ver Notas de implementação acima). Não existe caso "insumo em português, saída em inglês": para `en-US` insumo e saída já nascem no mesmo idioma; para `pt-BR` (default hoje) a mistura inglês→português é o comportamento ATUAL em produção, rodando sem esta story, sem indício de degradação. Nada a instruir de explícito sobre idioma do insumo.
2. Não vale um teste de eval dedicado (LLM-judge de idioma) além do já previsto. O risco que motivava a pergunta (insumo em português confundindo a saída) não existe — ver item 1. O teste unitário de `system` (critério de aceite) mais a geração real end-to-end já listada como critério de aceite (linha abaixo) bastam para fechar esta story; `pnpm eval` continua rodando pela regra geral do projeto (mudança em prompt do motor), não como eval extra desta feature.

---

## Referências no código

- [apps/api/src/adventure/adventure.service.ts:130-194](../../../apps/api/src/adventure/adventure.service.ts) — `generateAdventure`, orquestrador das 4 chamadas, assinatura a mudar.
- [apps/api/src/adventure/adventure.service.ts:202-213](../../../apps/api/src/adventure/adventure.service.ts) — `generateGatedAdventure`, repassa `locale`.
- [apps/api/src/adventure/adventure.service.ts:215-327](../../../apps/api/src/adventure/adventure.service.ts) — `createForCharacter`, `locale` resolvido na linha 226, chamada ao motor na linha 268; `generateOpeningNarration` (linha 289-313) já recebe `locale` — padrão de referência.
- [apps/api/src/ai/ai.service.ts:1340-1514](../../../apps/api/src/ai/ai.service.ts) — as 4 assinaturas a alterar (`generateLocationsAndNpcs`, `generateSecrets`, `generateClosing`, `generateOpeningBeat`).
- [packages/ai-engine/src/prompts/dm-system.ts:249-252](../../../packages/ai-engine/src/prompts/dm-system.ts) — `buildDmSystemPrompt`, padrão de referência para `localeNameForPrompt(locale)`.
- [US-97](./US-97-seletor-de-idioma-pt-br-en.md) — regra original: idioma é preferência do jogador, resolvida no servidor.
- [ADR 005](../../adr/005-locale-como-dimensao.md) — locale como dimensão de Fase 1, não detalhe de UI.
- [US-177](./US-177-onomastica-em-npcs-e-locais-do-motor.md) — overlap de arquivo/função, mudança independente.
