# US-150 — Gate antes de persistir a aventura gerada

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** [US-149](./US-149-segredos-40-prompts-lgmrd.md)
**Relacionado:** [Backlog — Motor de geração de aventuras one-shot](./backlog-motor-de-geracao-de-aventuras.md) (US-150, critério de saída do corte mínimo) · [ADR 012](../../adr/012-aventura-gerada-como-dado.md) (resolve rótulos `GEN-N` do backlog para número de story) · [US-144](./US-144-schema-aventura-shared.md) (o `parse()` que o gate roda) · [US-111](./US-111-classe-de-dificuldade-do-srd-2024.md) (régua de dificuldade do SRD 2024, referência para o orçamento de encontro)
**Criada em:** 2026-08-15

---

## História

> **Como** mantenedora,
> **quero** que toda aventura gerada passe por quatro verificações antes de ser persistida — schema válido, grafo de referências fechado, orçamento de encontro compatível com um personagem, piso de quantidade por seção —, com reseed em vez de conserto quando falha,
> **para que** nenhuma aventura com pista órfã, NPC sem função ou encontro letal para um personagem solo chegue ao jogador.

---

## Contexto e motivação

### O problema observado

Sem gate, o motor entregaria diretamente ao jogador o que quer que [US-149](./US-149-segredos-40-prompts-lgmrd.md) tenha produzido — incluindo os defeitos que um LLM instruído a "referenciar locais e NPCs por id" comete de vez em quando: um `locationId` que não existe, um NPC declarado que nenhum segredo ou encontro menciona, um encontro cujo orçamento mataria um personagem de nível 1 solo. Com a inversão de ordem do backlog (motor roda **antes** de qualquer aventura escrita à mão existir), não há piso de qualidade humano por baixo — o gate é a única rede.

### Por que a solução atual não basta

`GeneratedAdventureSchema.parse()` (US-144) verifica **forma** — que os campos existem e têm o tipo certo. Não verifica **conteúdo**: um `secret.locationId` sintaticamente válido (`"loc-3"`) mas que não corresponde a nenhum `location.id` real passa no `.parse()` e falha na mesa. É exatamente a lacuna que a integridade referencial do DnDGenerate (citada no backlog) resolve — mas só se alguém a verificar depois da geração, não confiando que o modelo sempre obedeceu a instrução.

### A proposta

Quatro verificações, na ordem certa, e **re-seed em vez de conserto**: nunca se pede ao modelo para consertar a própria saída (mesma disciplina de "nunca fabricar número" da rolagem de jogo, aplicada aqui à estrutura da aventura).

---

## Escopo

### Dentro do escopo

1. **O artefato passa no `parse()` da [US-144](./US-144-schema-aventura-shared.md).** Primeira verificação, mais barata.
2. **O grafo fecha.** Todo `locationId`, `npcId` e `encounterId` referenciado existe na seção correspondente, e nenhuma locação ou NPC declarado fica órfão — sem encontro, sem segredo, sem interação apontando para ele. Substitui a checagem mais fraca de "ao menos três segredos referenciam entidade que existe" (que só media um lado da relação).
3. **O orçamento do encontro cabe em um personagem** daquele nível — comparado contra a régua de dificuldade referenciada pelo backlog ([US-111](./US-111-classe-de-dificuldade-do-srd-2024.md)) e os papéis de statblock da [US-152](./US-152-statblocks-papel-orcamento.md).
4. **Piso de quantidade por seção** (locais, NPCs, segredos, encontros) — verificado **no prompt** da [US-149](./US-149-segredos-40-prompts-lgmrd.md), não aqui em código (molde do DnDGenerate: pedir "se houver menos de N, escreva mais" é mais barato que re-rolar a aventura inteira por falta de um NPC). Este gate só confirma que o piso foi atingido, não o impõe via retry de prompt.
- **Re-seed, teto explícito.** Falha em qualquer uma das quatro verificações → gera de novo com `seed + 1` (US-146). Teto de tentativas explícito (ex. 3), com falha **registrada** (log estruturado com o motivo da última falha) — gerador que re-rola sem limite trava a criação de personagem.
- **Critério de saída do corte mínimo, não automatizável:** um seed pinado, jogado à mão ponta a ponta — critério humano, não substituível por `pnpm test` verde. Vira rotina: um seed novo jogado a cada mudança no prompt de segredos ([US-149](./US-149-segredos-40-prompts-lgmrd.md)).

### Fora do escopo

- **Consertar a saída do modelo** (pedir para ele corrigir um `id` inválido) — deliberadamente fora; o remédio é sempre reseed.
- **A cadeia causal entre pistas e a subversão do template** — o grafo fechar garante que a pista aponta para algo que existe, não que as pistas componham um mecanismo coerente. É piso, não teto (ver *O que o motor não produz* no backlog) — não é critério de aceite mecânico desta story.
- **Escolher os valores da régua de dificuldade** — usa o que a [US-111](./US-111-classe-de-dificuldade-do-srd-2024.md)/[US-152](./US-152-statblocks-papel-orcamento.md) já definirem; esta story só compara, não define a escala.

---

## Modelo de dados proposto

> Sem schema novo — a função de gate devolve um resultado de validação, não um novo tipo de dado persistido.

```ts
type GateResult =
  | { ok: true; adventure: GeneratedAdventure }
  | { ok: false; reason: string; attempt: number }
```

**Persistência:** o log de falha de reseed (motivo + tentativa) é candidato a log estruturado (console/observabilidade, [ADR 011](../../adr/011-observabilidade-em-camadas.md)), não a tabela nova.

---

## Critérios de aceite

- [ ] Artefato que falha `.parse()` (US-144) é rejeitado antes das outras três verificações rodarem — ordem de custo crescente.
- [ ] Toda referência cruzada (`locationId`, `npcId`, `encounterId`) do artefato é resolvida contra as seções correspondentes; artefato com referência para `id` inexistente falha o gate.
- [ ] Nenhuma locação ou NPC declarado fica órfão — sem nenhum encontro, segredo ou interação apontando para ele — sob pena de falhar o gate.
- [ ] Orçamento de cada encontro é comparado contra a régua de dificuldade para **um** personagem daquele nível; encontro fora do orçamento falha o gate.
- [ ] Falha em qualquer verificação aciona reseed (`seed + 1`, US-146), até um teto explícito de tentativas; ao esgotar o teto, a falha é registrada com o motivo da última tentativa, e a criação da aventura não trava indefinidamente.
- [ ] Nenhuma tentativa de "consertar" a saída do modelo existe no código — só reseed inteiro.
- [ ] **Critério de saída do corte mínimo (não automatizável):** um seed pinado, jogado à mão ponta a ponta, sem sopa de pista genérica — registrado como parte do relato desta story, não como teste automatizado.
- [ ] **Eval / teste de regressão:** fixture de artefato com `secret.locationId` inválido falha o gate com o motivo correto; fixture com NPC órfão falha; fixture com encontro superorçado falha; fixture válida passa em todas as quatro verificações.

---

## Notas de implementação

- **Ordem de verificação por custo:** `.parse()` primeiro (mais barato), grafo depois (percorrer arrays, ainda barato), orçamento por último (pode exigir os dados de statblock da [US-152](./US-152-statblocks-papel-orcamento.md) já carregados). Falhar cedo evita trabalho desperdiçado antes do reseed.
- **O grafo fecha é a verificação central desta story** — é o que a integridade referencial do schema (US-144) torna possível verificar de forma mecânica, ao contrário do LGMRD puro (oito listas sem obrigação de citação cruzada).
- **Teto de tentativas** — número exato (3? 5?) fica para a implementação decidir olhando o custo real por chamada ([US-149](./US-149-segredos-40-prompts-lgmrd.md) é a mais cara, uma chamada de modelo por tentativa de reseed inteira).

---

## Questões em aberto

1. Quando o teto de reseed se esgota, a criação da aventura falha de vez (o jogador não consegue começar) ou cai num fallback (aventura mais simples, sem os quatro gates)? O backlog não decide — "trava a criação de personagem" é citado como o risco a evitar, mas o comportamento de esgotamento não é especificado. Recomendação: falhar explicitamente com erro estruturado (molde da [US-120](./US-120-erro-de-llm-estruturado.md)), nunca silenciar.

---

## Referências no código

- [Backlog — Motor de geração de aventuras one-shot §GEN-7](./backlog-motor-de-geracao-de-aventuras.md) (US-150) — texto de origem, as quatro verificações e o critério de saída do corte mínimo.
- [US-144](./US-144-schema-aventura-shared.md) — `GeneratedAdventureSchema.parse()`, primeira verificação.
- [US-146](./US-146-seed-deterministico-motor-aventura.md) — `seed + 1`, o mecanismo de reseed.
- [US-111](./US-111-classe-de-dificuldade-do-srd-2024.md) — régua de dificuldade referenciada para o orçamento de encontro.
- [US-120](./US-120-erro-de-llm-estruturado.md) — molde de erro estruturado para o esgotamento do teto de reseed.
