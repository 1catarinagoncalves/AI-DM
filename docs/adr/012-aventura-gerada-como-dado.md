# ADR 012 — Aventura gerada: artefato congelado, seed recomputável, coluna própria

**Status:** Aceito
**Data:** 2026-08-16
**Decisores:** Mantenedora
**Relacionado:** [US-143](../sdlc/01-requisitos/US-143-adr-aventura-como-dado-gerado.md) (story de origem) · [ADR 003](./003-sistemas-como-dado.md) (molde e precedente — "X é dado gerado, não código") · [US-144](../sdlc/01-requisitos/US-144-schema-aventura-shared.md) (GEN-1, schema Zod que consome esta decisão) · [US-146](../sdlc/01-requisitos/US-146-seed-deterministico-motor-aventura.md) (GEN-3, `deriveAdventureSeed`) · [Backlog — motor de geração de aventuras](../sdlc/01-requisitos/backlog-motor-de-geracao-de-aventuras.md) (GEN-0/GEN-7/GEN-8) · [Backlog — aventuras autorais LazyGM](../sdlc/01-requisitos/backlog-aventuras-autorais-lazygm.md) (decisão aberta 1, herdada)

---

## 1. Contexto

O [backlog do motor de geração](../sdlc/01-requisitos/backlog-motor-de-geracao-de-aventuras.md) inverteu a ordem: o motor roda **antes** de existir aventura autoral de referência, e o [GEN-1](../sdlc/01-requisitos/US-144-schema-aventura-shared.md) (schema Zod em `@ai-dm/shared`) precisa de resposta antes de desenhar `id`/envelope. Sem esta ADR, GEN-1 desenha um campo no escuro.

`Adventure.entities` ([schema.prisma](../../apps/api/prisma/schema.prisma)) já existe como `Json?`, mas guarda **só** o ledger `WorldEntity[]` (`nome`, `tipo?`, `local?`, `sabido?`, `revelado?`, `relacoes?`) semeado pela US-75 e produzido hoje por `extractOpeningEntities` ([ai.service.ts:1112](../../apps/api/src/ai/ai.service.ts)). O artefato completo que o motor emite — `npcs[]`, `secrets[]`, `locations[]`, `encounters[]`, `followUps[]` — é maior e tem forma diferente. Não há coluna, tabela nem contrato pra "a aventura como o motor gerou", só o resultado já materializado em `Adventure.title`, `Quest`, e o ledger.

O [backlog irmão de aventuras autorais](../sdlc/01-requisitos/backlog-aventuras-autorais-lazygm.md) tem uma *decisão aberta 1* herdada: "a aventura autoral é dado de um sistema ou entidade reusável entre sistemas?" — pergunta sobre **portabilidade** (Pegāna, mundo de Dunsany sem nada de 5e, não deveria pendurar num `System` chamado "D&D 5e"). Essa pergunta é distinta da que GEN-0 precisa responder agora — **persistência** (congelar ou regenerar) — mas as duas se sobrepõem parcialmente e o backlog do motor pede que esta ADR feche a que bloqueia GEN-1.

**O que isso significa pro jogador:** o artefato congelado é a parte que ele sente — a aventura gerada fica fixa no banco assim que criada, não muda de forma entre sessões nem se o motor/modelo for atualizado depois. O `seed` é bastidor (QA/eval), não visível.

---

## 2. Decisão

### D1 — Artefato grava congelado; `seed` não ganha coluna, é sempre recomputável

Aventura é **dado gerado** só durante a geração — o motor decide o conteúdo sem hardcode, mesmo raciocínio da [ADR 003](./003-sistemas-como-dado.md) pra sistemas de regras. Uma vez gerada, comporta-se como **entidade persistida**: grava congelada, não é recalculada a cada leitura.

"Regenerável" vira propriedade de **proveniência**, não modo de fetch em produção: o `seed` prova de onde a aventura veio (QA, eval, bug report reproduzível — US-146), nunca é recomputado em runtime pra servir o jogador uma segunda versão.

`seed` não ganha coluna própria. `deriveAdventureSeed(characterId, order)` ([US-146](../sdlc/01-requisitos/US-146-seed-deterministico-motor-aventura.md), `@ai-dm/shared`) é função pura sobre `Character.id` + `Adventure.order` — **ambos já colunas existentes** ([schema.prisma](../../apps/api/prisma/schema.prisma)). Persistir o `seed` seria redundante enquanto a fórmula de derivação não mudar; eval/QA recomputa a partir dos dois campos que já existem, sem custo de coluna extra.

### D2 — Artefato mora em coluna própria: `Adventure.generatedAdventure Json?`

Não reusa `Adventure.entities`. A coluna hoje é `WorldEntity[]` — forma diferente do artefato do motor (`npcs[]`, `secrets[]`, `locations[]`, `encounters[]`, `followUps[]`, do [GEN-1/US-144](../sdlc/01-requisitos/US-144-schema-aventura-shared.md)). Forçar as duas na mesma coluna exigiria um envelope `{ ledger, adventure }` misturando dois ciclos de vida diferentes (ledger muta turno a turno via `recordEntity`; artefato nasce imutável na criação).

Nova coluna: `Adventure.generatedAdventure Json?`, validada por `GeneratedAdventureSchema` ([US-144](../sdlc/01-requisitos/US-144-schema-aventura-shared.md)) — mesmo padrão `Json?` + Zod já usado em `entities` e em `System.config` ([ADR 003 D1](./003-sistemas-como-dado.md)).

O ledger continua `WorldEntity[]` em `Adventure.entities`, **sem mudar forma**. O [GEN-8](../sdlc/01-requisitos/backlog-motor-de-geracao-de-aventuras.md) passa a **derivar** o ledger a partir do artefato persistido (segredos entram com `revelado: false`, NPCs com `revelado: true`) — a fonte muda de extração por LLM (`extractOpeningEntities`) pra leitura estruturada do artefato já congelado; a coluna do ledger e seu consumidor (`recordEntity`, `mergeEntities`) não mudam.

### D3 — `GeneratedAdventureSchema.id` fica como está, sem renomear

O rascunho de [US-144](../sdlc/01-requisitos/US-144-schema-aventura-shared.md) já tem `id` na raiz do schema. A preocupação de colisão com `Adventure.id` (levantada na US-143 original) é infundada: `Adventure.id` é chave primária no nível SQL da linha; `generatedAdventure.id` é campo dentro de uma coluna `Json?` — nível de documento aninhado. Não há ambiguidade real pro Prisma/Postgres nem pro código que lê a coluna. Renomear pra `generationId` sem necessidade técnica adiciona uma divergência de nome entre o schema já desenhado (US-144) e o que a ADR pede, sem ganho — mantém `id`.

### D4 — Decisão aberta 1 do backlog irmão: resolvida na dimensão persistência, adiada na dimensão portabilidade

A pergunta "aventura é dado de um sistema ou entidade reusável?" tem duas leituras que o backlog autoral funde numa só frase:

1. **Persistência/regeneração** — o que esta ADR decide (D1 acima): dado durante a geração, entidade depois de gerada.
2. **Portabilidade entre `System`s** (o exemplo do backlog é Pegāna, mundo sem nada de 5e, preso a um `System` chamado "D&D 5e") — esta ADR **não decide**. O schema GEN-1 já guarda chave, nunca rótulo (`setting`/`tone`/`areaType`, mesmo contrato de `catalogLabel` da [US-105](../sdlc/01-requisitos/US-105-raca-e-classe-por-chave-do-srd.md)), então a **estrutura** nasce agnóstica de sistema. Mas o **conteúdo** gerado (CD, orçamento de encontro por CR — [GEN-9](../sdlc/01-requisitos/US-152-statblocks-papel-orcamento.md)) é amarrado ao `System` de origem, porque é o motor daquele `System` que gerou. Reusar um artefato entre `System`s diferentes é decisão do backlog autoral, já **adiado pra fase 4** (nota de 07/08/2026 do próprio backlog) — não bloqueia GEN-1 e não é resolvido aqui.

---

## 3. Decisões-chave e justificativas

| # | Decisão | Por quê |
|---|---------|---------|
| 1 | Artefato (`GeneratedAdventureSchema`) grava congelado | GEN-8 semeia o ledger a partir dele; GEN-11/eval inspeciona sem rerodar o motor; jogador não vê a aventura mudar de forma entre sessões |
| 2 | `seed` não ganha coluna — recomputado de `Character.id` + `Adventure.order` | Ambos os campos já existem; coluna extra seria redundante e arriscaria divergir da fórmula |
| 3 | Coluna nova `Adventure.generatedAdventure Json?`, não reuso de `entities` | Forma diferente de `WorldEntity[]`; reuso exigiria envelope misturando dois ciclos de vida |
| 4 | Ledger (`Adventure.entities`) não muda de forma | `recordEntity`/`mergeEntities` já consomem `WorldEntity[]`; GEN-8 só troca a fonte (artefato em vez de LLM) |
| 5 | `GeneratedAdventureSchema.id` mantido, sem renomear | Namespace diferente de `Adventure.id` (JSON aninhado vs PK de linha); sem colisão técnica real |
| 6 | Portabilidade cross-`System` não decidida aqui | Fora do que GEN-1 precisa pra começar; já adiada pro backlog autoral, fase 4 |

---

## 4. Alternativas rejeitadas

| Alternativa | Motivo da rejeição |
|-------------|-------------------|
| Persistir `seed` em coluna própria | Redundante enquanto `Character.id`/`Adventure.order` existirem; risco de a coluna divergir da fórmula se um dos dois mudar sem migração |
| Nunca persistir o artefato — regenerar sob demanda a partir do `seed` | Quebra "a aventura não muda de forma entre sessões"; atualizar motor/modelo depois reescreveria uma história já jogada |
| Reusar `Adventure.entities` pro artefato inteiro | Colide de forma com `WorldEntity[]`; envelope `{ledger, adventure}` mistura ciclo de vida mutável (ledger) com imutável (artefato) numa coluna só |
| Renomear `GeneratedAdventureSchema.id` para `generationId` | Sem necessidade técnica — namespaces já distintos (JSON aninhado × PK de linha); só criaria divergência com o rascunho já escrito na US-144 |
| Resolver portabilidade cross-`System` nesta ADR | Fora do escopo que bloqueia GEN-1; o backlog autoral já adiou essa pergunta pra fase 4 |

---

## 5. Consequências

**Positivas**
- GEN-1 desenha `id`/envelope do schema sem reabrir esta decisão.
- Ledger (`WorldEntity[]`) não muda de forma — GEN-8 só troca a fonte de dado, `recordEntity`/`mergeEntities` seguem intactos.
- Reprodutibilidade (QA, eval, bug report) sem coluna extra — `characterId + order` já bastam.
- Artefato congelado: jogador não vê a história mudar de forma entre sessões nem por atualização de motor/modelo.

**Negativas / riscos**
- Migração Prisma nova (`Adventure.generatedAdventure Json?`) necessária — fica a cargo do GEN-1/US-144 aplicar, esta ADR só nomeia a coluna.
- Se a fórmula de `deriveAdventureSeed` mudar no futuro, aventuras já geradas perdem a capacidade de provar proveniência com a fórmula nova — mitigação: não alterar a fórmula sem motivo forte, e se alterar, registrar a versão usada.
- Se GEN-9 (statblocks) exigir campos extras em `encounters[]` (`budget`, `role`), artefatos já congelados de aventuras antigas ficam sem esses campos — versionamento de schema é problema futuro, fora do escopo aqui.

---

## 6. Implementação (referência)

- `apps/api/prisma/schema.prisma` — `Adventure.generatedAdventure Json?` (coluna nova, migração aplicada pelo GEN-1/US-144).
- `packages/shared/src/types/adventure-generation.ts` — `GeneratedAdventureSchema` (US-144), consumidor direto desta decisão.
- `packages/shared/src/adventure-seed.ts` — `deriveAdventureSeed`, `createSeededRandom` (US-146).
- `apps/api/src/adventure/adventure.service.ts` — `createForCharacter`; caminho de semeadura que o GEN-8 reusa.
- `apps/api/src/ai/ai.service.ts:1112` — `extractOpeningEntities`, forma atual (e inalterada) de `Adventure.entities`.
