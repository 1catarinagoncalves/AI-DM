# US-147 — Rolagem do motor: registro primeiro, conteúdo depois

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** [US-145](./US-145-sync-lgmrd-notice.md) (artefato `LGMRD.json` baixado) · [US-146](./US-146-seed-deterministico-motor-aventura.md) (gerador seedado)
**Consome, quando existir:** [US-156](./US-156-catalogos-registro-dto-validacao.md) (escolha do jogador por campo de registro)
**Relacionado:** [Backlog — Motor de geração de aventuras one-shot](./backlog-motor-de-geracao-de-aventuras.md) (US-147, alimenta [US-149](./US-149-segredos-40-prompts-lgmrd.md) e [US-152](./US-152-statblocks-papel-orcamento.md)) · [ADR 012](../../adr/012-aventura-gerada-como-dado.md) (resolve rótulos `GEN-N` do backlog para número de story)
**Criada em:** 2026-08-15

---

## História

> **Como** mantenedora,
> **quero** que o Game Server role, pelo seed determinístico, primeiro o **registro** da aventura (`setting`, `tone`, `areaType`, uma vez) e só depois o **conteúdo** por peça (premissa, locais, monumentos, complicação, pelas 135 tabelas do LGMRD),
> **para que** o tom não varie peça a peça — Grimdark no primeiro ato e Comedic no fecho — e todas as chamadas de modelo seguintes recebam o mesmo registro fixado.

---

## Contexto e motivação

### O problema observado

O motor precisa de matéria-prima antes de qualquer chamada ao modelo ([US-149](./US-149-segredos-40-prompts-lgmrd.md) escreve os segredos com locais e NPCs já decididos "no contexto — nunca antes"). Sem uma etapa de rolagem determinística, essa matéria-prima não existe: o motor teria que pedir ao próprio modelo para inventar premissa e locais, reintroduzindo exatamente o problema que a [US-29](./US-29-saneamento-de-rolagens-ficticias.md) já baniu do lado da rolagem de jogo — sorteio que o modelo faz não é sorteio, é invenção sem procedência.

### Por que a solução atual não basta

Nada no repo hoje lê o `LGMRD.json` (a US-145 apenas o baixa) nem distingue duas naturezas de sorteio que o backlog identifica como **diferentes e com ordem importando entre si**: registro (tom/cenário/tipo de área, fixado **uma vez** para toda a aventura) versus conteúdo (premissa, locais, monumentos, complicação, rolado **por peça** das 135 tabelas). Tratar as duas como a mesma coisa — ou rolar registro peça a peça — é o defeito que o backlog nomeia explicitamente: *"tom rolado por peça sai Grimdark no primeiro ato e Comedic no fecho"*.

### A proposta

Duas rolagens, nesta ordem, ambas pelo seed da [US-146](./US-146-seed-deterministico-motor-aventura.md), lendo o artefato da [US-145](./US-145-sync-lgmrd-notice.md): primeiro o registro (uma vez, três campos independentes), depois o conteúdo (por peça, pelas 135 tabelas). Cada um dos três campos de registro pode vir escolhido pelo jogador (quando a [US-156](./US-156-catalogos-registro-dto-validacao.md) existir) ou sorteado aqui — por campo, não tudo-ou-nada.

---

## Escopo

### Dentro do escopo

- **Roda no Game Server** (`apps/api`), pelo mesmo argumento dos dados existentes: sorteio determinístico não é trabalho de modelo de linguagem.
- **Registro — uma vez por aventura.** `setting`, `tone`, `areaType` — sorteados pelo seed quando o jogador não escolheu ([US-156](./US-156-catalogos-registro-dto-validacao.md) ausente ou campo omitido no DTO). Fixado uma vez, passado a **todas** as chamadas de modelo seguintes ([US-149](./US-149-segredos-40-prompts-lgmrd.md) em diante).
- **Conteúdo — por peça.** Rola, pelo mesmo seed, as tabelas que produzem premissa, locais, monumentos, complicação — a lista de escolhas que os passos seguintes ([US-149](./US-149-segredos-40-prompts-lgmrd.md), prosa dos locais) vestem de prosa. Ainda não é uma `GeneratedAdventure` (US-144) montada — é a matéria-prima bruta.
- **Artefato derivado committed, extraído de `LGMRD.json`** — `scripts/lazygm/lgmrd-tables.json` (nome a confirmar na implementação), só as subsections de `coreadventuregenerators` que esta story rola (`1d20quests`, `locationsmonumentsanditems`, `conditiondescriptionandorigin`, `patronsandnpcs`, ...). Gerado a partir do artefato bruto (US-145, gitignored) e commitado no repo — mesmo padrão que `scripts/srd/srd-5e.config.<locale>.json` já usa (SRD: raw gitignored em `_data/`, derivado committed, lido por `readFileSync` no seed — ver `apps/api/prisma/seed.ts:53`). Resolve dois problemas de uma vez: `LGMRD.json` nunca é sincronizado em CI/Render (`render.yaml` buildCommand não roda `lazygm:sync`, só o teste de regressão do pin) — sem artefato committed, a leitura em produção quebraria por arquivo ausente; e o teste de regressão do critério de aceite abaixo (`fixture salva`) usa o mesmo arquivo, trimado, em vez de duplicar ou depender do `LGMRD.json` de 600KB gitignored.
- **Cada campo de registro é independente:** escolher o tom e deixar o local no aleatório é caminho normal — não existe combinação inválida entre "escolhido" e "sorteado" por campo.
- **"Aleatório" continua determinístico:** mesmo seed, mesmo resultado — o jogador não re-rola recarregando a página, e a eval ([US-154](./US-154-eval-aventura-gerada.md)) pode pinar a aventura inteira mesmo quando nenhum campo foi escolhido manualmente.
- **Sem cópia das listas de rótulo do DnDGenerate.** O eixo (haver `tone`/`setting`/`areaType` como dimensão fixada uma vez) é o que se copia; os dez valores genéricos por eixo não — o catálogo real vem da [US-156](./US-156-catalogos-registro-dto-validacao.md).

### Fora do escopo

- **O catálogo de valores possíveis para `tone`/`setting`/`areaType`** e a validação server-side de chave — isso é [US-156](./US-156-catalogos-registro-dto-validacao.md); esta story consome o catálogo quando ele existir, mas roda mesmo sem ele (sorteando entre valores fixos temporários, a decidir na implementação, até US-156 chegar).
- **A chamada ao modelo dos segredos** ([US-149](./US-149-segredos-40-prompts-lgmrd.md)) e a prosa das locações — esta story só produz a lista de escolhas roladas, não texto.
- **Statblocks e orçamento de encontro** — [US-152](./US-152-statblocks-papel-orcamento.md), que lê o mesmo `LGMRD.json` mas por outra tabela (`5e_Monster_Builder.json`).
- **Persistir o resultado da rolagem** — o output desta story alimenta [US-149](./US-149-segredos-40-prompts-lgmrd.md)/[US-150](./US-150-gate-antes-de-persistir-aventura-gerada.md) em memória, dentro da mesma execução do motor; persistência do artefato final é escopo de [US-144](./US-144-schema-aventura-shared.md).

---

## Modelo de dados proposto

> Sem schema Zod novo formal — o output é a matéria-prima interna do motor, consumida pela [US-149](./US-149-segredos-40-prompts-lgmrd.md). Se a implementação achar útil, tipar como um objeto intermediário (`RolledAdventureContent`) em `@ai-dm/shared`, mas sem obrigação de persistência.

| Campo | Tipo | Descrição |
|---|---|---|
| `setting` | string (chave) | Rolado uma vez, ou vindo do DTO ([US-156](./US-156-catalogos-registro-dto-validacao.md)). |
| `tone` | string (chave) | Idem. |
| `areaType` | string (chave) | Idem. |
| `premissa`, `locais`, `monumentos`, `complicacao` | conteúdo bruto das tabelas do LGMRD | Rolado por peça, pelo mesmo seed — a lista que a [US-149](./US-149-segredos-40-prompts-lgmrd.md) e a prosa das locações consomem. |

**Persistência do resultado rolado:** nenhuma nesta story — output efêmero dentro da execução do motor.

**Persistência do artefato-fonte (diferente do resultado rolado acima):** `scripts/lazygm/lgmrd-tables.json`, derivado committed, extraído de `LGMRD.json` — ver "Notas de implementação". Sem isso as tabelas de onde a rolagem lê não existem fora da máquina de quem rodou `pnpm lazygm:sync`.

---

## Critérios de aceite

- [x] O registro (`setting`, `tone`, `areaType`) é decidido **antes** de qualquer rolagem de conteúdo, e o mesmo valor de cada campo é usado em toda chamada subsequente do motor na mesma execução.
- [x] Cada um dos três campos de registro aceita valor vindo de fora (quando [US-156](./US-156-catalogos-registro-dto-validacao.md) existir) ou sorteia independentemente quando ausente — sem exigir que os três venham juntos.
- [x] O sorteio de conteúdo (premissa, locais, monumentos, complicação) lê `scripts/lazygm/lgmrd-tables.json` (derivado committed, extraído de `LGMRD.json`) e usa o `createSeededRandom` da US-146 — nenhuma chamada a `Math.random`.
- [x] `scripts/lazygm/lgmrd-tables.json` está versionado no repo (não gitignored) e não depende de `pnpm lazygm:sync` ter rodado — `pnpm build`/`pnpm test` funcionam num clone limpo sem o artefato bruto da US-145 presente.
- [x] Mesmo `(characterId, order)` produz o mesmo registro e o mesmo conteúdo em duas execuções — determinismo ponta a ponta desta etapa.
- [x] Registro diferente (tom escolhido manualmente diferente do que seria sorteado) não afeta o determinismo do conteúdo — os dois sorteios são independentes entre si, exceto pela ordem de execução.
- [x] **Eval / teste de regressão:** com seed fixo, a rolagem de conteúdo produz a mesma seleção de linhas das tabelas do LGMRD em duas execuções (fixture salva); teste separado prova que tom rolado numa execução com seed A é diferente do tom da execução com seed B (não-degenerado).

---

## Notas de implementação

- **Ordem importa e é o ponto central da story** — não é um detalhe de implementação, é o próprio critério de aceite: registro decidido depois do conteúdo já rolado quebra a garantia central ("tom decidido depois não retroage no que já foi escrito", nas palavras do backlog sobre a *Ordem de geração* completa).
- **Extração mínima committed, decidida em 2026-08-16** — revisão da nota original ("ler `LGMRD.json` diretamente, sem parser"). `LGMRD.json` (US-145) é gitignored e nunca sincronizado em CI/Render (`render.yaml` buildCommand não chama `lazygm:sync`; CI só roda `lazygm:sync:test`, regressão do pin sem I/O) — ler o arquivo bruto diretamente do Game Server quebraria em produção por ausência do arquivo. Precedente já resolvido no repo pro mesmo problema: SRD mantém `_data/` bruto gitignored mas commita o derivado (`scripts/srd/srd-5e.config.<locale>.json`), lido via `readFileSync` em `apps/api/prisma/seed.ts:53`. Esta story replica o padrão: script (rodado uma vez, junto do `lazygm:sync`, ou como passo próprio) extrai as subsections usadas de `coreadventuregenerators` pra `scripts/lazygm/lgmrd-tables.json` e commita — não é normalização de schema (que continua não-uniforme por tabela, ver questão 1 abaixo), só recorte do que a rolagem usa.
- **Onde este código mora:** junto do `createSeededRandom` (`packages/shared/src/adventure-seed.ts`, US-146) e do sorteio de statblock ([US-152](./US-152-statblocks-papel-orcamento.md)) — provavelmente um módulo `adventure-generation` dentro de `apps/api` (o backlog é explícito: "roda no Game Server"). `createSeededRandom` já mora em `@ai-dm/shared`, não em `apps/api` — o módulo desta story importa de lá, não reimplementa.
- **Implementada em `apps/api/src/adventure-generation/`** (módulo próprio, decidido durante a implementação): `lgmrd-tables.ts` (lê o artefato committed via `readFileSync`, mesmo motivo do `readSrdArtifact` — import de JSON de fora de `apps/api` arrastaria o `rootDir` do tsc), `registry-catalog.ts` (a lista provisória da Questão 2), `roll-registry.ts`, `roll-content.ts` e `roll-adventure.ts` (orquestrador: chama `rollRegistry` antes de `rollContent`, expõe a ordem no código em vez de deixá-la implícita no caller).
- **Sub-seed por campo, não uma sequência compartilhada** — decisão de implementação para o critério "registro diferente não afeta o determinismo do conteúdo": cada campo/tabela deriva o próprio seed via `deriveAdventureSeed(`${characterId}:${propósito}`, order)` (reuso direto da assinatura da US-146, sem função nova), em vez de todos os sorteios avançarem a mesma instância de `createSeededRandom`. Assim, sortear ou não `tone` nunca desloca a sequência de `setting`/`areaType`/conteúdo — a independência é estrutural, não uma coincidência de quantas vezes cada campo consumiu a sequência.
- **`extractTables` extrai 4 subsections, não só as 3 que a rolagem usa** — `patronsandnpcs` entra no artefato committed (`scripts/lazygm/lgmrd-tables.json`) mas ainda não é rolado por nenhuma função desta story; fica pronto para a geração de NPCs (GEN-3 do backlog, story futura) sem precisar re-extrair do `LGMRD.json` bruto.

---

## Questões em aberto

1. ~~A forma exata de `LGMRD.json`...~~ **Resolvida em 2026-08-16**, por inspeção direta do artefato já baixado (`scripts/lazygm/_data/LGMRD.json`):
   - 135 tabelas no total (`type: "table"` dentro de `sections[].subsections[].content[]`) — bate com o número do backlog.
   - Referência estável é `(section.id, subsection.id)`, não índice numérico.
   - **Schema de `data` não é uniforme entre tabelas** — cuidado ao tipar: coluna de dado varia (`item_num` em 76 tabelas; `d20`/`d8`/`d10` nomeado pelo dado em outras; ausente — ordem implícita pelo índice — em 47 tabelas de TOC/prosa, sem uso de rolagem). Colunas de conteúdo também variam por linha: a maioria só tem `item`, mas algumas trazem múltiplos campos por roll — ex. `locationsmonumentsanditems` (`d20+item+location+monument`, um roll dá local+monumento+item juntos) e `conditiondescriptionandorigin` (`condition+d20+description+origin`, a complicação).
   - Seção-chave pra conteúdo desta story: `coreadventuregenerators` — subsections `1d20quests` (premissa), `locationsmonumentsanditems` (locais+monumentos), `conditiondescriptionandorigin` (complicação), `patronsandnpcs` (NPC/patrono).
   - **Confirma também a resposta da questão 2:** não existe tabela `tone`/`setting`/`areaType` no LGMRD — registro não sai daqui, precisa mesmo de lista provisória própria ou de US-156.
2. ~~Enquanto US-156 não existe...~~ **Resolvida em 2026-08-16:** esta story **não espera** US-156 — status atual de [US-156](./US-156-catalogos-registro-dto-validacao.md) é "📋 Planejada (não iniciada)", e o backlog já marca a relação como "consome, quando existir" (não dependência formal). Bloquear US-147 nisso contradiz a própria proposta da story (rolagem roda com ou sem escolha do jogador).
   - **Lista provisória hardcoded**, no mesmo módulo do sorteio de registro (`adventure-generation`, ver Notas de implementação). Chaves em inglês canônico (mesmo padrão da US-54 — `paladin`/`wizard`, não rótulo pt-BR), sem rótulo: rótulo/tradução é problema do catálogo (US-156), não desta rolagem, que só precisa de uma chave pra sortear e propagar.
   - **Trivialmente substituível** = a função de sorteio recebe a lista de chaves candidatas por parâmetro (ou import de uma constante isolada), nunca hardcoded inline na lógica de sorteio. Quando US-156 chegar, troca-se a fonte da lista (constante local → `SystemConfig.settings/tones/areaTypes`) sem tocar a assinatura nem o algoritmo de sorteio.

---

## Referências no código

- [Backlog — Motor de geração de aventuras one-shot §GEN-4](./backlog-motor-de-geracao-de-aventuras.md) (US-147) — texto de origem, incluindo *Ordem de geração* (passo 0: registro) e *O desenho: três camadas*.
- [US-145](./US-145-sync-lgmrd-notice.md) — `LGMRD.json`, a fonte que esta story lê (extração pontual, não em runtime — ver Notas de implementação).
- [scripts/lazygm/extract-tables.mjs](../../../scripts/lazygm/extract-tables.mjs) — extrai as 4 subsections de `coreadventuregenerators` do `LGMRD.json` bruto para `scripts/lazygm/lgmrd-tables.json` (committed). `pnpm lazygm:extract` / `pnpm lazygm:extract:test`.
- [scripts/lazygm/lgmrd-tables.json](../../../scripts/lazygm/lgmrd-tables.json) — o artefato derivado committed, lido em runtime pelo Game Server.
- [apps/api/prisma/seed.ts:53](../../../apps/api/prisma/seed.ts) — precedente do padrão "raw gitignored + derivado committed" que esta story replica pro LGMRD.
- [apps/api/src/adventure-generation/lgmrd-tables.ts](../../../apps/api/src/adventure-generation/lgmrd-tables.ts) — lê `lgmrd-tables.json` via `readFileSync`.
- [apps/api/src/adventure-generation/roll-registry.ts](../../../apps/api/src/adventure-generation/roll-registry.ts) — rola `setting`/`tone`/`areaType`, cada um com sub-seed independente; aceita overrides.
- [apps/api/src/adventure-generation/registry-catalog.ts](../../../apps/api/src/adventure-generation/registry-catalog.ts) — a lista provisória de chaves (Questão 2), trocável quando a US-156 chegar.
- [apps/api/src/adventure-generation/roll-content.ts](../../../apps/api/src/adventure-generation/roll-content.ts) — rola premissa/locais/monumentos/complicação das tabelas do LGMRD.
- [apps/api/src/adventure-generation/roll-adventure.ts](../../../apps/api/src/adventure-generation/roll-adventure.ts) — orquestrador: registro antes de conteúdo, no código.
- [US-146](./US-146-seed-deterministico-motor-aventura.md) — `createSeededRandom`/`deriveAdventureSeed`, o gerador que esta story consome (reusado por composição de string para os sub-seeds por campo/tabela, sem função nova em `@ai-dm/shared`).
- [US-29](./US-29-saneamento-de-rolagens-ficticias.md) — a disciplina "sorteio que o modelo faz não é sorteio", aplicada aqui ao motor de geração.
- [ADR 012](../../adr/012-aventura-gerada-como-dado.md) — decisão que resolve os rótulos `GEN-N` do backlog para número de story.
