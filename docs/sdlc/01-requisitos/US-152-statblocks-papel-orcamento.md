# US-152 — Statblocks por papel e orçamento de encontro para um personagem

**Épico:** 3 — Narração e mecânica
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** [US-145](./US-145-sync-lgmrd-notice.md) (`5e_Monster_Builder.json` baixado) · [US-147](./US-147-rolagem-registro-conteudo.md) (conteúdo já rolado, incluindo local/complicação que o encontro habita)
**Relacionado:** [Backlog — Motor de geração de aventuras one-shot](./backlog-motor-de-geracao-de-aventuras.md) (GEN-9, caminho crítico) · [US-111](./US-111-classe-de-dificuldade-do-srd-2024.md) (régua de dificuldade do SRD 2024, referência de orçamento)
**Criada em:** 2026-08-15

---

## História

> **Como** mantenedora,
> **quero** povoar cada encontro gerado com statblocks por papel (Minion, Soldier, Brute) do `5e_Monster_Builder.json`, com orçamento medido para **um** personagem daquele nível,
> **para que** nenhum encontro gerado mate um personagem solo de nível 1 — e o gate da GEN-7 tenha o que verificar.

---

## Contexto e motivação

### O problema observado

Sem statblocks nem orçamento, [GEN-7](./US-150-gate-antes-de-persistir-aventura-gerada.md) (o gate) não tem contra o que verificar "o orçamento do encontro cabe em um personagem" — a verificação existiria em texto, sem dado. E sem essa verificação, um encontro escrito com o **default de grupo** (a maioria dos geradores de conteúdo D&D assume 4 personagens) mataria um personagem solo de nível 1, que é exatamente o público desta fase (ver ADR de escopo do backlog: campanha de grupo foi adiada para a fase 4).

### Por que a solução atual não basta

O repo não tem hoje **nenhum** dado de monstro — nem bestiário nominal, nem statblock por papel. Ingerir o bestiário completo do SRD seria um pipeline inteiro (parsing de ataques, resistências, CR nominal), desproporcional ao que o motor precisa: só um oponente jogável por papel funcional. O `5e_Monster_Builder.json` do LGMRD já resolve isso de graça — statblocks por **função** (Minion CR 1/8, Soldier CR 1/2, Brute CR 2), não por nome de monstro.

### A proposta

Ler `5e_Monster_Builder.json` (baixado pela US-145) e usar os três papéis diretamente — sem ingerir monstro nominal do SRD. O passo povoa cada encontro com os papéis que existem, e o orçamento é medido contra a régua de dificuldade referenciada pela [US-111](./US-111-classe-de-dificuldade-do-srd-2024.md), calibrado para **um** personagem.

---

## Escopo

### Dentro do escopo

- **Leitura direta de `5e_Monster_Builder.json`** — sem parser normalizado (mesma decisão da GEN-4/US-147 para o `LGMRD.json`: nenhum `ingest.mjs` novo, o motor lê o artefato bruto em tempo de execução).
- **Seleção de papel por encontro** (Minion CR 1/8, Soldier CR 1/2, Brute CR 2), filtrada por nível do personagem — encontro de nível 1 não recebe um Brute sozinho sem Minions ao redor, por exemplo (a régua exata de composição fica para a implementação calibrar contra a régua de dificuldade).
- **Orçamento medido para UM personagem**, nunca para grupo. **Tamanho de grupo é 1, escrito como 1 — não como parâmetro.** Multiplayer é fase 4; até lá, um multiplicador por número de personagens seria configuração com um único valor possível, que é configuração falsa. Quando a fase 4 chegar, o multiplicador entra num lugar só (aqui).
- **Está no caminho crítico**: sem esta story, o gate da GEN-7 não tem o que verificar no encontro, e encontro escrito no default de grupo mata um personagem solo de nível 1.
- **Popula `encounter.npcIds[]`** (ou campo equivalente que a GEN-9 acrescente ao schema da US-144, se `AdventureEncounterSchema` precisar de campos de orçamento/papel — ver *Questões em aberto* da US-144) com os statblocks escolhidos.

### Fora do escopo

- **Ingerir bestiário nominal do SRD.** Deliberadamente evitado — os papéis do `5e_Monster_Builder.json` bastam, sem pipeline de ingestão de monstro.
- **Multiplicador por tamanho de grupo.** Não existe antes da fase 4 — nem como flag desligada, nem como parâmetro com um valor só (configuração falsa).
- **A verificação do gate em si** (que o orçamento cabe) — é [GEN-7](./US-150-gate-antes-de-persistir-aventura-gerada.md); esta story só produz o dado que o gate compara.
- **HP/AC inventados pelo modelo.** Já saneado pela [US-29](./US-29-saneamento-de-rolagens-ficticias.md); os statblocks vêm do artefato, nunca de invenção do LLM.

---

## Modelo de dados proposto

> Sem schema Zod formal novo obrigatório — se `AdventureEncounterSchema` (US-144) precisar de campos de orçamento explícitos (`budget`, papel por `npcId`), esta story é quem primeiro exige a extensão; a decisão de estender o schema ou manter externo fica registrada aqui como consumo, não como definição.

| Campo (statblock) | Origem | Descrição |
|---|---|---|
| `role` | `5e_Monster_Builder.json` | `Minion` \| `Soldier` \| `Brute`. |
| `cr` | `5e_Monster_Builder.json` | `1/8`, `1/2`, `2` respectivamente. |
| `budget` (orçamento do encontro) | calculado | Soma dos statblocks escolhidos, comparada contra a régua de dificuldade para um personagem do nível dado. |

**Persistência:** nenhuma nesta story — o resultado alimenta o artefato que o gate valida (GEN-7) e que é persistido pela decisão da US-143.

---

## Critérios de aceite

- [ ] O motor lê `5e_Monster_Builder.json` (US-145) e extrai os três papéis (Minion, Soldier, Brute) com seus respectivos CR.
- [ ] Nenhum ingest/parser novo é criado para monstro nominal do SRD — a leitura é direta do artefato do LGMRD.
- [ ] O orçamento de cada encontro é calculado e comparado contra a régua de dificuldade de **um** personagem daquele nível — nunca multiplicado por tamanho de grupo.
- [ ] Nenhum parâmetro de "tamanho de grupo" existe no código — a constante `1` está escrita como `1`, não como config com um valor possível.
- [ ] Encontro de nível 1 gerado por esta lógica não excede o orçamento de um personagem solo (verificável comparando contra a régua da US-111).
- [ ] `pnpm typecheck` e testes do módulo passam.
- [ ] **Eval / teste de regressão:** fixture com nível 1 produz encontro dentro do orçamento (ex.: 2 Minions, não 1 Brute sozinho se o Brute sozinho exceder o orçamento de um personagem nível 1); teste falha se o cálculo de orçamento multiplicar por qualquer coisa além de 1.

---

## Notas de implementação

- **A assimetria com nível:** nível *é* parâmetro desde já (a assinatura do motor recebe nível — GEN-5/US-148), mesmo que hoje sempre valha 1 (D1 ausente); tamanho de grupo *não* muda antes da fase 4. As duas constantes têm ciclo de vida diferente — não tratar como o mesmo tipo de "valor fixo por enquanto".
- **Caminho de volta é conhecido e barato**, segundo o backlog: quando a fase 4 chegar, o multiplicador entra num lugar só (este módulo) — não é uma decisão que precisa de flag/abstração preventiva agora.
- **A forma exata de `5e_Monster_Builder.json`** só se confirma inspecionando o artefato depois do sync (US-145) rodar — não assumir a estrutura a partir desta story.

---

## Questões em aberto

1. `AdventureEncounterSchema` (US-144) precisa de campos novos (`budget`, papel por NPC) para o gate (GEN-7) verificar o orçamento? Ou o orçamento é calculado em memória durante a geração, sem persistir no schema final? Decidir olhando o que a GEN-7 precisa ler — se o gate roda na mesma execução que esta story, o orçamento pode ser um valor transiente, não campo do schema.

---

## Referências no código

- [US-145](./US-145-sync-lgmrd-notice.md) — `5e_Monster_Builder.json`, a fonte desta story.
- [US-111](./US-111-classe-de-dificuldade-do-srd-2024.md) — régua de dificuldade do SRD 2024, referenciada para o orçamento (a forma exata de aplicação — se via `difficultyClasses` ou outra tabela de orçamento de XP — é decisão de implementação a confirmar contra o artefato real).
- [US-29](./US-29-saneamento-de-rolagens-ficticias.md) — por que HP/AC não são inventados pelo modelo.
- [Backlog — Motor de geração de aventuras one-shot §GEN-9](./backlog-motor-de-geracao-de-aventuras.md) — texto de origem, incluindo a nota sobre tamanho de grupo = 1.
