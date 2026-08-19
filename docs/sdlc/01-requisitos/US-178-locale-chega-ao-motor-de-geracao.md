# US-178 — `locale` do jogador chega ao motor de geração (hoje as 4 chamadas escrevem só em pt-BR)

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
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

- [ ] `generateAdventure`/`generateGatedAdventure` aceitam `locale: Locale`.
- [ ] `createForCharacter` passa o `locale` já resolvido (linha 226) na chamada ao motor.
- [ ] As 4 chamadas (`generateLocationsAndNpcs`, `generateSecrets`, `generateClosing`, `generateOpeningBeat`) aceitam `locale?: Locale` e citam `localeNameForPrompt(locale)` no `system`.
- [ ] Teste: com `locale: 'en-US'`, o `system` de cada uma das 4 chamadas contém instrução de idioma-alvo em inglês (ou equivalente verificável); com `locale: 'pt-BR'` (ou ausente), comportamento igual ao de hoje.
- [ ] `pnpm typecheck` e `pnpm test` passam.
- [ ] `pnpm eval` passa (mudança em prompt do motor de geração — regra do projeto, `AGENTS.md`).
- [ ] **Eval / teste de regressão qualitativo:** gerar uma aventura com `locale: 'en-US'` end-to-end (ou mock do provider) e confirmar que `locations[].description`, `npcs[].role`, `secrets[].text`, `conclusion` e `start` saem em inglês — não só o `system` interno, mas a SAÍDA do modelo.

---

## Notas de implementação

- **Import direto**: `Locale`, `resolveLocale`, `localeNameForPrompt`, `DEFAULT_LOCALE` já existem em `@ai-dm/shared` e já são usados exatamente deste jeito em `dm-system.ts`/`adventure.service.ts` — não inventar mecanismo novo, copiar o padrão.
- **5ª chamada da mesma função**: `createForCharacter` já tem `locale` em escopo (linha 226) quando chama `generateGatedAdventure` (linha 268) — não precisa nova query nem novo cálculo, só passar a variável adiante, mesmo padrão que a US-176 aplicou para `registry`.
- **Overlap com US-177**: ambas tocam o `system` de `generateLocationsAndNpcs` ([ai.service.ts:1356-1359](../../../apps/api/src/ai/ai.service.ts)) — uma adiciona a seção de Onomástica, esta adiciona a instrução de idioma. Mudanças em pontos diferentes da mesma string; se rodarem em paralelo, uma precisa rebasear a concatenação (não é bloqueio, é ordem de merge — mesmo padrão já usado entre US-174/US-176).
- **`system` continua majoritariamente em português** (é a instrução PARA o modelo, não a saída) — só a linha de idioma-alvo muda de conteúdo; não é necessário traduzir o resto do `system` de cada chamada.
- **`prompt` (não o `system`) de cada chamada carrega o conteúdo rolado** (`buildLocationsAndNpcsPrompt`, `buildSecretsPrompt`, etc.) — hoje em português (vem de `RolledAdventureContent`, que é sempre pt-BR, rolado do LGMRD). Confirmar no eval se o modelo consegue escrever a SAÍDA em inglês mesmo com o `prompt` de entrada em português (mesma situação que `buildOpeningInstruction` já resolve: a semente pode estar noutra língua, a narração segue o idioma-alvo, [dm-system.ts:637](../../../packages/ai-engine/src/prompts/dm-system.ts)).

---

## Questões em aberto

1. `RolledAdventureContent` (`premissa`/`locais`/`monumentos`) é sempre rolado do LGMRD em português — isso vira insumo em português para uma saída em inglês em todas as 4 chamadas. Funciona na prática (mesmo padrão do `hookSeed` na abertura) ou a qualidade da saída em inglês degrada por causa disso? Só o eval decide; se degradar, pode precisar de instrução mais explícita tipo "o conteúdo abaixo está em português, mas sua saída é 100% em inglês" — decidir na implementação.
2. Vale medir/gatear isso com um teste de eval dedicado (LLM-judge simples: "esta string está no idioma X?") além do teste unitário de `system`, ou o teste unitário + revisão manual de uma geração real bastam para fechar esta story?

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
