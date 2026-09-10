# ADR 012 — Aventura gerada: artefato autoral congelado, mundo-primeiro, coluna própria

**Status:** Aceito
**Data:** 2026-08-16 · **Revista:** 2026-09-09 (inversão para geração mundo-primeiro)
**Decisores:** Mantenedora
**Relacionado:** [US-143](../sdlc/01-requisitos/US-143-adr-aventura-como-dado-gerado.md) (story de origem) · [ADR 003](./003-sistemas-como-dado.md) (molde e precedente — "X é dado gerado, não código") · [US-144](../sdlc/01-requisitos/US-144-schema-aventura-shared.md) (schema Zod que consome esta decisão) · [Backlog — motor de geração de aventuras](../sdlc/01-requisitos/backlog-motor-de-geracao-de-aventuras.md) · [Arquitetura — motor de aventuras autorais](../arquitetura-motor-aventuras-autorais.md) (decisão de abordagem que motivou a revisão de 09/09 e o Spike 1)

> **Revisão de 2026-09-09.** A versão de 16/08/2026 desenhava a aventura como **montada de tabelas** (rolagem LGMRD com `seed` determinístico recomputável). O resultado saiu genérico, de estrutura plana e prosa fraca — longe do alvo autoral (o artefato *O Olho de Iremet*). O [doc de arquitetura](../arquitetura-motor-aventuras-autorais.md) e o Spike 1 (2026-09-09) confirmaram a inversão: **o modelo autora o mundo primeiro, tabelas viram tempero**. Esta revisão **mantém** as decisões de persistência (congela, coluna própria, `id`) e **aposenta o `seed`** — a única peça que a inversão derruba. As decisões novas (D5–D7) registram a autoria mundo-primeiro, o crescimento do schema e a âncora de eval que substitui o determinismo.

---

## 1. Contexto

Aventura é **dado gerado** ([ADR 003](./003-sistemas-como-dado.md), mesmo molde de sistemas de regras): o conteúdo é decidido na geração, sem hardcode. A questão desta ADR é o que acontece **depois** de gerada — como persiste, onde mora, e o que ancora a qualidade.

`Adventure.entities` ([schema.prisma](../../apps/api/prisma/schema.prisma)) guarda o ledger `WorldEntity[]` (US-75), forma diferente do artefato do motor. O artefato completo — mundo autoral, facções, locais, NPCs, segredos, encontros, atos, fecho ramificado — é maior e tem ciclo de vida próprio (nasce imutável na criação da aventura; o ledger muta turno a turno via `recordEntity`).

**A inversão (revisão de 09/09).** "Dado gerado" passou a significar **autorado pelo modelo**, não **montado de tabela**. O Spike 1 mostrou que uma chamada de autoria produz mundo bespoke (Ur-Veth, cidade nas vértebras de um leviatã de sal), 3 facções concorrentes, arco de 3 beats e fecho ramificado — no nível do exemplar, a centavos. A rolagem determinística das 135 tabelas do LGMRD deixa de ser espinha; vira inspiração injetada no prompt, quando entra.

**O que isso significa pro jogador:** o artefato congelado é a parte que ele sente — a aventura fica fixa no banco assim que criada, não muda de forma entre sessões nem se o motor/modelo for atualizado depois.

---

## 2. Decisão

### D1 — Artefato grava congelado. `seed` não existe mais

Uma vez gerada, a aventura comporta-se como **entidade persistida**: grava congelada em coluna própria, não é recalculada a cada leitura, nem regenerada em runtime pra servir uma segunda versão ao jogador. Atualizar motor/modelo depois **não** reescreve história já jogada.

**O `seed` é aposentado** (mudança de 09/09). Com a geração mundo-primeiro (D5), o modelo autora com temperatura — não há mais rolagem determinística sobre tabelas, então `deriveAdventureSeed(characterId, order)` não tem o que semear de forma reproduzível byte a byte. A promessa "a mesma ficha regenera a mesma aventura" **cai**, e é aceitável: reprodutibilidade agora é propriedade do **artefato congelado** (ver D7), não de recomputar a geração. Onde a eval precisar de quase-determinismo, usa `temperature: 0` + versão de modelo pinada sobre perfis fixos — separado da variedade de produção.

### D2 — Artefato mora em coluna própria: `Adventure.generatedAdventure Json?`

Não reusa `Adventure.entities` (ledger `WorldEntity[]`, forma diferente, ciclo de vida mutável). Forçar as duas na mesma coluna exigiria um envelope `{ ledger, adventure }` misturando um ciclo imutável (artefato) com um mutável (ledger).

Coluna `Adventure.generatedAdventure Json?`, validada por `GeneratedAdventureSchema` ([US-144](../sdlc/01-requisitos/US-144-schema-aventura-shared.md)) — mesmo padrão `Json?` + Zod de `entities` e `System.config` ([ADR 003 D1](./003-sistemas-como-dado.md)). O ledger segue `WorldEntity[]` em `Adventure.entities`, sem mudar forma; o motor **deriva** o ledger do artefato persistido (segredos com `revelado: false`, NPCs com `revelado: true`).

### D3 — `GeneratedAdventureSchema.id` fica como está, sem renomear

`Adventure.id` é chave primária da linha (nível SQL); `generatedAdventure.id` é campo dentro da coluna `Json?` (documento aninhado). Namespaces diferentes, sem colisão real pro Prisma/Postgres. Renomear pra `generationId` só criaria divergência com o schema já escrito na US-144.

### D4 — Portabilidade cross-`System` não decidida aqui

A **estrutura** do schema nasce agnóstica de sistema (chave, nunca rótulo — contrato de `catalogLabel`, [US-105](../sdlc/01-requisitos/US-105-raca-e-classe-por-chave-do-srd.md)). O **conteúdo** gerado (CD, orçamento de encontro por CR) é amarrado ao `System` de origem. Reusar um artefato entre `System`s diferentes é decisão do backlog autoral, adiada pra fase 4 — não bloqueia nada aqui.

### D5 — Geração é mundo-primeiro: o modelo autora, tabelas são tempero *(novo, 09/09)*

A aventura é gerada **autorada**, não montada, num **call único** de autoria + passo determinístico + gate:

```
CHAMADA 1 — autoria (modelo, UMA chamada, do mundo pro detalhe):
   · mundo autoral + tom          (o bespoke tipo Khemsar/Ur-Veth)
   · facções (3) com desejos concorrentes
   · conflito central + fecho ramificado (escolha sem herói)
   · locais + NPCs                (amarrados às facções)
   · segredos / pistas            (referenciam locais/facções por id)
   · atos / sessões + followUps
   · encontros — FICÇÃO só         (local + facção + situação, SEM números)
PASSO 2 — números dos encontros   ← 5e determinístico no código (papel + orçamento pro nível),
                                     preenchendo a ficção da CHAMADA 1
PASSO 3 — gate                    ← grafo fecha + orçamento cabe. Falha ⇒ regenera a CHAMADA 1
```

Call único (não cadeia multi-passo): o Spike 1 provou que uma chamada basta pra qualidade Khemsar-grade, e é mais rápido (passos são sequencialmente dependentes, não paralelizam) e menos código. Trade: gate valida a aventura inteira e regenera o blob, não por-peça — cadeia é o caminho de volta se o controle fino importar.

A mecânica **continua 5e SRD** (Open5e, statblocks por papel, CD 2024) — só a **apresentação e a estrutura** vêm do alvo estético (o artefato é AD&D 2E, não se porta a mecânica dele). O passo 7 é a única matemática determinística que fica. As 135 tabelas do LGMRD deixam de ser roladas como espinha; entram como inspiração no prompt, se entrarem (a decidir no reslice do backlog).

**Modelo de prosa:** escada `deepseek/deepseek-v4-pro` → `deepseek/deepseek-v4-pro-0813` → `deepseek/deepseek-v4.1-flash` (preferência da mantenedora lendo as saídas do Spike 1 — o juiz saturou e não discriminou; ver [doc de arquitetura](../arquitetura-motor-aventuras-autorais.md) §*Escada de prosa*). O pro foi anunciado pra descontinuação (10/09); a escada absorve — o `-0813` é fallback de qualidade (mesma família, pode sair junto), o `v4.1-flash` é o sobrevivente. Roda off-turn (sem streaming, sem o teto de 60s do proxy SSE), então paga o modelo forte sem impacto de latência de turno.

### D6 — O schema cresce pra caber a aventura autoral *(novo, 09/09)*

`GeneratedAdventureSchema` (US-144) ganha, mantendo referência cruzada por `id`:

- **`world`** — objeto autoral: `name` (ex. "Khemsar, o Mar de Areia"), `description`, locais-âncora. **Distinto** da chave coarse `setting`, que sobrevive só como dimensão de filtro/eval — não é mais a fonte do mundo.
- **`factions[]`** — entidade de 1ª classe: `id`, `name`, `kind`, `want`, vínculos por `id` a `npcs`/`locations`/`secrets`. Hoje só existe `npc.role` (texto solto), o que produz a tensão fraca do resultado antigo.
- **`acts[]` / sessões** — agrupamento sobre `encounters[]`, cada ato fechando num gancho. Hoje `encounters[]` é plano.
- **`branchedResolution`** — array `{ choice, consequence }` (o fecho sem herói). **Substitui** `conclusion` (string), que sai pra não virar campo morto. `start` fica (seed de abertura, código, US-194); `followUps[]` fica obrigatório e passa a entrar no prompt de autoria.
**Fora do schema (decisão 10/09):** `hazardTable`/tabela de perigo — removida da geração a pedido da mantenedora; perigo de viagem fica a cargo do Mestre em jogo.

Cada campo novo é chave/estrutura verificável pelo gate ([US-150](../sdlc/01-requisitos/US-150-gate-antes-de-persistir-aventura-gerada.md)), que passa a **regenerar** on-fail (não re-seed — o seed morreu).

### D7 — Âncora de eval substitui o determinismo *(novo, 09/09)*

"Reprodutibilidade" são duas coisas; a inversão só mata uma:

1. **Repro pra debug** — o artefato congelado (D1) fica gravado em `Adventure.generatedAdventure`. Aventura ruim é linha inspecionável, não se regenera. Morre reproduzir o *processo*; o *resultado* fica de graça.
2. **Regressão** — mede rubrica ([US-36](../sdlc/01-requisitos/US-36-eval-de-qualidade-da-narracao.md)/[US-154](../sdlc/01-requisitos/US-154-eval-aventura-gerada.md)) sobre amostra, a partir de perfis pinados, contra **O Olho de Iremet** como exemplar (resolve a lacuna do backlog: sem exemplar solo/pt-BR/autoral). Como o juiz LLM **satura** nesta tarefa (medido no Spike 1: quase tudo 5/5), a rubrica de regressão ancora em **asserts sobre o artefato** (este `secretId` continua oculto, este NPC existe, o grafo fecha), não na nota do juiz.

---

## 3. Decisões-chave e justificativas

| # | Decisão | Por quê |
|---|---------|---------|
| 1 | Artefato grava congelado; `seed` aposentado | Jogador não vê a aventura mudar de forma; sem rolagem determinística, o seed não tem o que semear (D5); repro vem do artefato congelado (D7) |
| 2 | Coluna nova `Adventure.generatedAdventure Json?`, não reuso de `entities` | Forma e ciclo de vida diferentes de `WorldEntity[]` |
| 3 | `GeneratedAdventureSchema.id` mantido | Namespace diferente de `Adventure.id`, sem colisão técnica |
| 4 | Portabilidade cross-`System` não decidida aqui | Fora do que bloqueia o schema; adiada pra fase 4 |
| 5 | Geração mundo-primeiro; mecânica 5e; prosa em deepseek-v4-pro | O Spike 1 mostrou que autoria bate a montagem por tabela no nível do exemplar; 5e é a fundação do projeto; pro foi a escolha a olho |
| 6 | Schema cresce (`world`/`factions[]`/`acts[]`/`branchedResolution`) | Os campos do resultado antigo (registro por chave, `npc.role` solto, `conclusion` string) são exatamente o que saiu genérico e plano |
| 7 | Eval = artefato congelado + rubrica ancorada em asserts | Juiz LLM satura na tarefa (medido); determinismo byte-a-byte não existe mais |

---

## 4. Alternativas rejeitadas

| Alternativa | Motivo da rejeição |
|-------------|-------------------|
| **Manter a montagem por tabela (versão original desta ADR)** | Produziu genérico, plano, prosa fraca — a razão da revisão de 09/09 |
| **Híbrido: esqueleto determinístico + camada autoral** | Guardado como plano B do Spike 1; a inversão pura passou a barra, então o esqueleto de tabela (que puxa pro genérico) não se justifica |
| Persistir/manter o `seed` | Sem rolagem determinística ele não semeia nada reproduzível; repro vem do artefato congelado |
| Nunca persistir o artefato — regenerar sob demanda | Quebra "a aventura não muda de forma entre sessões"; atualizar motor/modelo reescreveria história jogada |
| Reusar `Adventure.entities` pro artefato inteiro | Colide de forma e mistura ciclo mutável (ledger) com imutável (artefato) |
| Renomear `GeneratedAdventureSchema.id` para `generationId` | Namespaces já distintos; só criaria divergência com a US-144 |
| Portar a mecânica 2E do artefato (THAC0, CA descendente) | Conflita com a fundação 5e SRD; só apresentação/estrutura se porta |

---

## 5. Consequências

**Positivas**
- Aventura autoral no nível do exemplar (Spike 1), a partir de mundo bespoke em vez de rótulo de catálogo.
- Ledger (`WorldEntity[]`) não muda de forma — o motor só troca a fonte de dado; `recordEntity`/`mergeEntities` seguem intactos.
- Artefato congelado: jogador não vê a história mudar de forma; repro de bug vem de ler a linha, sem regenerar.
- O exemplar *O Olho de Iremet* vira âncora de eval solo/pt-BR/autoral que faltava.

**Negativas / riscos**
- **Determinismo byte-a-byte morre.** `deriveAdventureSeed` (US-146, implementada) vira código morto a remover (gate `pnpm dead`, US-89). A eval perde o "mesmo seed, mesma aventura" e passa a medir distribuição de qualidade.
- **Custo/latência por aventura sobem** — um call único de autoria em deepseek-v4-pro (~$0.012/aventura, ~95s+ no Spike 1) contra a rolagem barata de antes. Off-turn mitiga latência (US-197, tela de espera).
- **Juiz LLM satura** — a regressão não pode depender da nota; ancora em asserts sobre o artefato.
- **Ancoragem de motivo no prompt** — no Spike 1 todos os modelos convergiram em "cidade sobre ossos de titã" porque a referência do prompt descrevia Khemsar literalmente. Em produção a referência tem de ensinar **qualidades**, não semear um motivo.
- Migração Prisma nova pros campos de D6 — a cargo da US-144 revisada.
- **Artefatos gerados pelo motor velho são descartados, não migrados** (decisão da mantenedora, 09/09) — o schema novo não tolera a forma velha; sem versionamento nem backfill. Seguro só porque a fase 1 é pré-lançamento (sem save real a proteger); a decisão volta à mesa se houver história jogada a preservar. Ver [doc de arquitetura](../arquitetura-motor-aventuras-autorais.md) §*Artefatos do motor velho*.

---

## 6. Implementação (referência)

- `apps/api/prisma/schema.prisma` — `Adventure.generatedAdventure Json?` (coluna existente; D6 acrescenta campos ao JSON, não à tabela).
- `packages/shared/src/types/adventure-generation.ts` — `GeneratedAdventureSchema`; cresce com `world`/`factions[]`/`acts[]`/`branchedResolution` (D6).
- `packages/ai-engine/src/model.ts` — nova escada de prosa da autoria (D5): `deepseek/deepseek-v4-pro` → `-pro-0813` → `deepseek/deepseek-v4.1-flash`, no molde de `narrationModels` (tenta em ordem, cai pro próximo na falha).
- `apps/api/src/adventure-generation/adventure-gate.ts` — o gate passa a regenerar on-fail (D5, PASSO 3), grafo fecha sobre o schema de D6.
- `packages/shared/src/adventure-seed.ts` — `deriveAdventureSeed`/`createSeededRandom`: **código morto** após a inversão (D1), remover.
- `apps/api/src/adventure/adventure.service.ts` — `createForCharacter`: caminho de criação onde a chamada de autoria mundo-primeiro entra.
- `evals/reports/adventure-authoring-spike-2026-09-09T*.md` — Spike 1, evidência de D5/D7.
