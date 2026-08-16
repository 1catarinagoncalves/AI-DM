# US-147 — Rolagem do motor: registro primeiro, conteúdo depois

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
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
- **Conteúdo — por peça.** Lê `LGMRD.json` (baixado pela US-145) e rola, pelo mesmo seed, as tabelas que produzem premissa, locais, monumentos, complicação — a lista de escolhas que os passos seguintes ([US-149](./US-149-segredos-40-prompts-lgmrd.md), prosa dos locais) vestem de prosa. Ainda não é uma `GeneratedAdventure` (US-144) montada — é a matéria-prima bruta.
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

**Persistência:** nenhuma nesta story — output efêmero dentro da execução do motor.

---

## Critérios de aceite

- [ ] O registro (`setting`, `tone`, `areaType`) é decidido **antes** de qualquer rolagem de conteúdo, e o mesmo valor de cada campo é usado em toda chamada subsequente do motor na mesma execução.
- [ ] Cada um dos três campos de registro aceita valor vindo de fora (quando [US-156](./US-156-catalogos-registro-dto-validacao.md) existir) ou sorteia independentemente quando ausente — sem exigir que os três venham juntos.
- [ ] O sorteio de conteúdo (premissa, locais, monumentos, complicação) lê `LGMRD.json` da US-145 e usa o `createSeededRandom` da US-146 — nenhuma chamada a `Math.random`.
- [ ] Mesmo `(characterId, order)` produz o mesmo registro e o mesmo conteúdo em duas execuções — determinismo ponta a ponta desta etapa.
- [ ] Registro diferente (tom escolhido manualmente diferente do que seria sorteado) não afeta o determinismo do conteúdo — os dois sorteios são independentes entre si, exceto pela ordem de execução.
- [ ] **Eval / teste de regressão:** com seed fixo, a rolagem de conteúdo produz a mesma seleção de linhas das tabelas do LGMRD em duas execuções (fixture salva); teste separado prova que tom rolado numa execução com seed A é diferente do tom da execução com seed B (não-degenerado).

---

## Notas de implementação

- **Ordem importa e é o ponto central da story** — não é um detalhe de implementação, é o próprio critério de aceite: registro decidido depois do conteúdo já rolado quebra a garantia central ("tom decidido depois não retroage no que já foi escrito", nas palavras do backlog sobre a *Ordem de geração* completa).
- **Ler `LGMRD.json` diretamente**, sem parser/ingest normalizado (a US-145 explicitamente não produz um `config` — só o artefato bruto versionado). Esta story é o primeiro consumidor real do JSON baixado; a forma exata das 135 tabelas só se confirma inspecionando o artefato depois do `sync` rodar — não assumir a partir desta story.
- **Onde este código mora:** junto do `createSeededRandom` (US-146) e do sorteio de statblock ([US-152](./US-152-statblocks-papel-orcamento.md)) — provavelmente um módulo `adventure-generation` dentro de `apps/api` (o backlog é explícito: "roda no Game Server").

---

## Questões em aberto

1. A forma exata de `LGMRD.json` (nomes de tabela, estrutura de linhas) só se confirma depois de rodar `pnpm --filter ... lazygm:sync` (US-145) e inspecionar o artefato — pode mudar como as tabelas de premissa/local/monumento/complicação são referenciadas no código desta story.
2. Enquanto [US-156](./US-156-catalogos-registro-dto-validacao.md) não existe, os valores possíveis de `setting`/`tone`/`areaType` para sortear precisam vir de algum lugar — uma lista provisória hardcoded nesta story, substituída quando US-156 chegar? Ou esta story espera US-156 mesmo não estando formalmente dependente dela (o backlog marca "consome, quando existir")? Decidir na implementação; a lista provisória, se usada, deve ser trivialmente substituível.

---

## Referências no código

- [Backlog — Motor de geração de aventuras one-shot §GEN-4](./backlog-motor-de-geracao-de-aventuras.md) (US-147) — texto de origem, incluindo *Ordem de geração* (passo 0: registro) e *O desenho: três camadas*.
- [US-145](./US-145-sync-lgmrd-notice.md) — `LGMRD.json`, a fonte que esta story lê.
- [US-146](./US-146-seed-deterministico-motor-aventura.md) — `createSeededRandom`, o gerador que esta story consome.
- [US-29](./US-29-saneamento-de-rolagens-ficticias.md) — a disciplina "sorteio que o modelo faz não é sorteio", aplicada aqui ao motor de geração.
- [ADR 012](../../adr/012-aventura-gerada-como-dado.md) — decisão que resolve os rótulos `GEN-N` do backlog para número de story.
