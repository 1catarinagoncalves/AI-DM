# US-237 — Remove seed, rebaixa LGMRD, mantém Monster Builder

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** nada (limpeza). **Bloqueia:** [US-233](./US-233-numeros-dos-encontros-passo-2-5e.md) na parte do statblock (o `sync` do Monster Builder fica de pé).
**Relacionado:** [US-146](./US-146-seed-deterministico-motor-aventura.md) (seed — **não sai mais**, ver revisão) · [US-147](./US-147-rolagem-registro-conteudo.md) (`rollAdventure`/rolagem-espinha antiga — essa sim sai) · [US-145](./US-145-sync-lgmrd-notice.md) (`sync` — metade Monster Builder fica, metade LGMRD rebaixa) · [US-241](./US-241-summary-formula-lgmrd-macguffin.md) (reviveu `readLgmrdTables` via `rollQuestSeed`) · [ADR 012](../../adr/012-aventura-gerada-como-dado.md) (D1 — premissa de seed morto, corrigida) · [Backlog — MA-7](./backlog-motor-de-geracao-de-aventuras.md)
**Criada em:** 2026-09-13 · **Escopo revisado em:** 2026-09-18

> O título ("remove seed") ficou de fora depois da revisão — mantido porque outros docs linkam este arquivo pelo nome. Ler a História e o Escopo abaixo, não o título, pra saber o que a story faz hoje.

---

## História

> **Como** desenvolvedora,
> **quero** apagar só o código de rolagem que ficou de fato inalcançável (`rollAdventure` e o que só ele chama, os 40 prompts de segredo) e manter tudo que o motor `generateAdventure` (US-232) ainda chama direto (`adventure-seed.ts`, `roll-registry.ts`, `roll-quest-seed.ts`, `sync` do Monster Builder) —
> **para que** o repo não carregue uma espinha de geração morta ao lado da viva, sem quebrar a que está em produção, e o gate de código morto (`pnpm dead`) fique limpo.

---

## Contexto e motivação

A inversão (ADR 012 D5) trocou "montar de tabela com `seed`" por "modelo autora". A leitura original desta story (2026-09-13) foi que isso matou `deriveAdventureSeed`/`createSeededRandom` (US-146) inteiros e toda a rolagem registro+conteúdo (US-147) — ADR 012 D1 registrou "seed morto".

Revisão de 2026-09-18 (grep de call sites contra `AdventureService.generateAdventure`, `apps/api/src/adventure/adventure.service.ts`, US-232) mostra que isso só é meio verdade:

- `generateAdventure` chama `rollRegistry`/`rollFactionCount`/`rollNamingRegister` ([roll-registry.ts](../../../apps/api/src/adventure-generation/roll-registry.ts)) e `rollQuestSeed` ([roll-quest-seed.ts](../../../apps/api/src/adventure-generation/roll-quest-seed.ts), US-241) **diretamente**, e os dois usam `deriveAdventureSeed`/`createSeededRandom`. A inversão não matou o seed — só matou o **caminho antigo** até ele (`rollAdventure`, US-147), que a autoria contornou chamando `rollRegistry`/`rollQuestSeed` sem passar por ele.
- O que morreu de fato é só o entry point antigo `rollAdventure()` (`roll-adventure.ts`) e tudo que só ele alcançava: `rollContent`/`rollPremissaCandidates`/`rollPatronsAndNpcs`/`generatePremissa` (`roll-content.ts`, US-192) e os 40 prompts de segredo (`readSecretPrompts`, US-149, `lgmrd-tables.ts`).
- O `sync` (US-145) segue dividido como o título original previa: metade **Monster Builder** (`5e_Monster_Builder.json`) alimenta os statblocks do PASSO 2 (US-233, confirmado vivo via `monster-roles.ts`/`lazy-encounter-benchmark.ts`) e **fica**. Das 135 tabelas do LGMRD, as 4 de rolagem de quest (`1d20quests`/`locationsmonumentsanditems`/`conditiondescriptionandorigin`/`patronsandnpcs`) foram revividas em 2026-09-14 por [US-241](./US-241-summary-formula-lgmrd-macguffin.md), que reverte só para `summary` a exclusão total de tabela LGMRD (ADR 012 D5) e ganha em `rollQuestSeed` um consumidor novo que lê essas 4 direto pra compor a semente de gancho do prompt de autoria — **essas ficam**. `rollQuestSeed` lê as MESMAS 4 tabelas com uma rolagem nova; não revive `rollContent` nem o caminho antigo. O resto das 135 (as que só `rollContent`/`readSecretPrompts` liam) segue sem uso e sai.

---

## Escopo

### Dentro do escopo

- **Remover `rollAdventure()` inteiro** (`roll-adventure.ts`) — entry point US-147 ("registro depois conteúdo"), só chamado pelo próprio teste; `generateAdventure` não passa por ele.
- **Remover `rollContent`/`rollPremissaCandidates`/`rollPatronsAndNpcs`/`generatePremissa`** (`roll-content.ts`, US-192) — órfãos, só alcançáveis via `rollAdventure` morto.
- **Remover `readSecretPrompts`/os 40 prompts de segredo** (US-149, [lgmrd-tables.ts](../../../apps/api/src/adventure-generation/lgmrd-tables.ts)) — sem consumidor fora do próprio arquivo/teste.
- **Passar no `pnpm dead`** (knip, US-89): nenhum export órfão sobra dessas remoções; grep confirma que nenhum consumidor vivo lê os símbolos acima.
- **Manter o `sync` do `5e_Monster_Builder.json`** (metade da US-145) — os statblocks que a US-233 consome.
- **Manter `adventure-seed.ts` (`deriveAdventureSeed`/`createSeededRandom`) inteiro** — consumido direto por `roll-registry.ts` e `roll-quest-seed.ts`, ambos chamados por `generateAdventure`.
- **Manter `roll-registry.ts` (`rollRegistry`/`rollFactionCount`/`rollNamingRegister`) e `roll-quest-seed.ts` (`rollQuestSeed`) inteiros** — espinha viva do motor US-232, não rolagem morta.
- **Manter as 4 tabelas de rolagem de quest do LGMRD** (`readLgmrdTables`) — consumidor vivo é `rollQuestSeed` (US-241).

### Fora do escopo

- **As tabelas do LGMRD que só `rollContent`/`readSecretPrompts` liam** (fora as 4 de quest): saem por tabela junto da remoção acima; se alguma delas merece virar inspiração de prompt em vez de sumir é decisão aberta (ver *Questões em aberto*), mas essa decisão não bloqueia a remoção do código morto.
- **O PASSO 2 que usa o Monster Builder** — US-233/MA-3.
- **Migração de artefatos velhos** — não há (descartados, ADR 012 D6).
- **Qualquer coisa em `roll-registry.ts`/`roll-quest-seed.ts`/`adventure-seed.ts`** — vivas, não fazem parte desta limpeza.

---

## Critérios de aceite

- [x] `roll-adventure.ts` removido (`rollAdventure()` e o arquivo).
- [x] `rollContent`/`rollPremissaCandidates`/`rollPatronsAndNpcs`/`generatePremissa` removidos de `roll-content.ts` (arquivo saiu — não sobrou export vivo, `localizePatronRow` incluído: só tinha consumidor no próprio arquivo/teste).
- [x] `readSecretPrompts` e os 40 prompts de segredo removidos de `lgmrd-tables.ts`.
- [x] `pnpm dead` (knip) limpo — nenhum export/dep órfão das remoções.
- [x] `pnpm typecheck` e `pnpm test` passam sem os símbolos removidos (`roll-adventure.test.ts`/`roll-content.test.ts` removidos junto dos arquivos; `lgmrd-tables.test.ts` perdeu o describe de `readSecretPrompts` e a asserção de chaves virou `arrayContaining` — o JSON committed ainda tem as 4 tabelas de segredo, fora de escopo remover).
- [x] `adventure-seed.ts` (`deriveAdventureSeed`/`createSeededRandom`), `roll-registry.ts` e `roll-quest-seed.ts` **continuam intactos e passando** — não fazem parte da remoção.
- [x] O `sync` do `5e_Monster_Builder.json` **continua** funcionando (statblocks disponíveis pra US-233) — não tocado.
- [x] `generateAdventure` (US-232) segue gerando aventura sem regressão — suite completa (`pnpm test`, 4 pacotes, 1091 testes) e `pnpm typecheck` verdes depois da remoção.

---

## Notas de implementação

- Fazer as remoções **depois** que a US-232/233 não dependerem mais do caminho velho — ou o `pnpm dead` de outra story acusa antes da hora. É limpeza, roda quando o motor novo já produz.
- **Não apagar `adventure-seed.ts`, `roll-registry.ts` ou `roll-quest-seed.ts`** — a leitura original desta story (seed = código morto) estava errada; confirmar por grep antes de tocar em qualquer um dos três que nenhum consumidor vivo (em especial `AdventureService.generateAdventure`) restou, exatamente como foi feito para `roll-adventure.ts`/`roll-content.ts`/`readSecretPrompts` na revisão de 2026-09-18.
- shared roda de `dist` — buildar após remover (mesmo que `adventure-seed.ts` não seja tocado, `roll-content.ts` e afins podem ter outros exports de `shared` a limpar).

---

## Questões em aberto

1. **As tabelas do LGMRD fora das 4 de quest: inspiração no prompt de autoria, ou saem de vez?** O Spike gerou Khemsar-grade sem elas, e as 4 de quest já foram revividas via `rollQuestSeed` (US-241) — a pergunta original ficou mais estreita: só sobra decidir o destino do resto (as que alimentavam `rollContent`/`readSecretPrompts`, agora mortos). Decidir junto de US-232.

   **Sugestão (2026-09-18): descartar, não guardar como inspiração.** O Spike já prova qualidade Khemsar-grade sem essas tabelas — não há gap medido que justifique carregá-las. Colar como inspiração no prompt tem custo real e imediato: infla o prompt, mexe na camada de volatilidade do cache (US-55), e precisa de adaptação pt-BR (`buildDmSystemPrompt`, [packages/ai-engine/src/prompts/dm-system.ts](../../../packages/ai-engine/src/prompts/dm-system.ts), é único — compartilhado entre EN e pt-BR, sem fork por locale) — contra um benefício especulativo. Decisão é reversível (a tabela não some do histórico git); se o eval de qualidade narrativa (US-36) acusar queda depois de remover, revisitar.

---

## Referências no código

- [packages/shared/src/adventure-seed.ts](../../../packages/shared/src/adventure-seed.ts) — `deriveAdventureSeed`/`createSeededRandom`. **Vivo**, consumido por `roll-registry.ts`/`roll-quest-seed.ts`; fora do escopo de remoção.
- [apps/api/src/adventure-generation/roll-registry.ts](../../../apps/api/src/adventure-generation/roll-registry.ts) — `rollRegistry`/`rollFactionCount`/`rollNamingRegister`, chamados direto por `AdventureService.generateAdventure`. Vivo, fora do escopo.
- [apps/api/src/adventure-generation/roll-quest-seed.ts](../../../apps/api/src/adventure-generation/roll-quest-seed.ts) — `rollQuestSeed` (US-241), chamado direto por `generateAdventure`. Vivo, fora do escopo.
- `apps/api/src/adventure-generation/roll-adventure.ts` — `rollAdventure()`, entry point US-147. Morto (só o próprio teste chama) — remover.
- `apps/api/src/adventure-generation/roll-content.ts` — `rollContent` e afins, US-192. Morto (órfão via `rollAdventure`) — remover.
- [apps/api/src/adventure-generation/lgmrd-tables.ts](../../../apps/api/src/adventure-generation/lgmrd-tables.ts) — `readLgmrdTables` vivo (US-241/`rollQuestSeed`); `readSecretPrompts` morto — remover só esse export.
- [US-145](./US-145-sync-lgmrd-notice.md) — `sync`; metade Monster Builder fica, metade LGMRD rebaixa.
- [US-146](./US-146-seed-deterministico-motor-aventura.md)/[US-147](./US-147-rolagem-registro-conteudo.md) — histórico de onde vieram o seed e a rolagem-espinha antiga.
- [Backlog — MA-7](./backlog-motor-de-geracao-de-aventuras.md).
