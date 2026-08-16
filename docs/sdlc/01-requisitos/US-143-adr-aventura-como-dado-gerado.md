# US-143 — ADR: aventura gerada é regenerável ou congelada, e onde ela mora

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** nenhuma
**Relacionado:** [Backlog — Motor de geração de aventuras one-shot](./backlog-motor-de-geracao-de-aventuras.md) (GEN-0, caminho crítico) · [ADR 003](../../adr/003-sistemas-como-dado.md) (sistema como dado — mesmo raciocínio aplicado a aventura) · [backlog das aventuras autorais](./backlog-aventuras-autorais-lazygm.md) (decisão aberta 1, herdada e tornada urgente por esta ADR)
**Criada em:** 2026-08-15

---

## História

> **Como** mantenedora,
> **quero** decidir, antes de existir schema de aventura, se o artefato gerado é regenerável pelo seed ou congelado no banco — e onde ele mora,
> **para que** o [GEN-1](./backlog-motor-de-geracao-de-aventuras.md) (schema em `@ai-dm/shared`) tenha uma resposta em vez de um campo desenhado no escuro.

---

## Contexto e motivação

### O problema observado

O [backlog do motor](./backlog-motor-de-geracao-de-aventuras.md) inverteu a ordem das duas frentes de geração de aventura: o motor passa a rodar **antes** de qualquer aventura escrita à mão existir, e o schema que ele emite (GEN-1) deixa de ter um exemplar de referência (AV-1) para copiar. Isso reabre, sob pressão de calendário, a *decisão aberta 1* do [backlog irmão](./backlog-aventuras-autorais-lazygm.md): **a aventura é dado de um sistema (regenerável) ou entidade reusável (persistida)?** Sem resposta, GEN-1 não sabe se está desenhando um DTO efêmero ou uma linha de banco.

### Por que a solução atual não basta

`Adventure.entities` já existe no [schema.prisma](../../../apps/api/prisma/schema.prisma) como coluna `Json?`, mas hoje guarda **só** o ledger de `WorldEntity[]` semeado pela [US-75](./US-75-dimensao-de-proveniencia-no-ledger.md) — NPCs, locais e objetos com `sabido`/`revelado`. O artefato completo que o motor emite (locations com `boxedText`, encontros com orçamento, `followUps[]`, etc.) é uma estrutura maior e diferente: reusar a mesma coluna sem decidir o formato colide com um campo que já tem consumidor (`extractOpeningEntities`, `recordEntity`, `mergeEntities`). Não há hoje nenhuma coluna, nenhuma tabela e nenhum contrato para "a aventura como o motor a gerou" — só o resultado já materializado em `Adventure` (`title`), `Quest` (`primaryQuestTitle`/`Description`) e o ledger.

### A proposta

Uma ADR curta, decidida **antes** de GEN-1 escrever uma linha de Zod: grava-se **os dois** — o artefato gerado inteiro (fonte que GEN-8 semeia no ledger e que a eval pina) e o `seed` que o regenera (o que a US-49/eval usa para reprodutibilidade). Decide também **onde** o artefato mora: reusar `Adventure.entities` como a AV-1 propunha, ou abrir coluna própria (`Adventure.generatedAdventure`, por exemplo) para não colidir com o ledger de `WorldEntity[]` que já vive ali.

**O que isso significa para o jogador:** o artefato congelado é a parte que ele sente — a aventura gerada (NPCs, locais, segredos) fica fixa no banco assim que criada, não é recalculada a cada acesso, então não muda de forma entre sessões nem se o motor/modelo for atualizado depois. O `seed` não é visível ao jogador: é reprodutibilidade de bastidor (QA/eval, US-146) que prova "esse personagem gera essa aventura" sem custo de coluna extra hoje, e deixa aberta, sem redesenho, uma futura opção de regenerar.

---

## Escopo

### Dentro do escopo

- **Documento ADR** em `docs/adr/012-aventura-gerada-como-dado.md` (próximo número livre — ver *Referências no código*), no molde da [ADR 003](../../adr/003-sistemas-como-dado.md): contexto, decisão, consequências positivas/negativas.
- **Decisão 1 — regenerável ou congelada:** recomendação do backlog é gravar os dois: o artefato (JSON) porque GEN-8 semeia o ledger a partir dele e GEN-11/eval precisa inspecionar o que foi gerado sem rerodar o motor; o `seed` porque é o que a eval pina e o que torna "a mesma ficha regenera a mesma aventura" verificável sem persistir nada.
- **Decisão 2 — onde o artefato mora:** `Adventure.entities` (reuso, como a AV-1 original propunha) **ou** coluna nova. A ADR examina o conflito de forma com `WorldEntity[]` (esta US já aponta que a coluna hoje tem consumidor com forma diferente) e recomenda.
- **Onde o `seed` mora:** campo em `Adventure` (ex. `Adventure.order` já existe e compõe o seed com `Character.id`, ver GEN-3/[US-146](./US-146-seed-deterministico-motor-aventura.md) — decidir se o seed em si precisa de coluna própria ou é sempre recomputável de `characterId + order`).
- A ADR **bloqueia** [GEN-1](./US-144-schema-aventura-shared.md): a forma do campo `id`/persistência do schema Zod depende desta decisão.

### Fora do escopo

- **O schema Zod em si** (`levelRange`, `npcs[]`, `secrets[]`, etc.) — é o GEN-1/US-144, que consome a decisão desta ADR mas não a escreve.
- **Migração Prisma.** Se a decisão for coluna nova, a migração em si roda dentro do GEN-1 (que já muda `@ai-dm/shared`) ou de uma story de infraestrutura mínima — esta US só decide o nome/formato, não aplica `prisma migrate`.
- **Política de regeneração em produção** (quando re-gerar uma aventura existente, se o jogador puder pedir). Fora do motor v1; a ADR só garante que a reprodutibilidade é possível.

---

## Critérios de aceite

- [x] Existe `docs/adr/012-aventura-gerada-como-dado.md`, seguindo o formato das ADRs existentes (contexto → decisão → consequências).
- [x] A ADR responde explicitamente: artefato gerado é persistido, `seed` é persistido (ou recomputável), ou ambos — com a recomendação do backlog (gravar os dois) aceita ou revertida com justificativa.
- [x] A ADR responde onde o artefato mora: `Adventure.entities` reusado (e como ele convive com `WorldEntity[]` do ledger) ou coluna própria nomeada.
- [x] A ADR referencia e resolve, ou explicitamente adia, a *decisão aberta 1* do [backlog irmão](./backlog-aventuras-autorais-lazygm.md).
- [x] [GEN-1](./US-144-schema-aventura-shared.md) consegue começar sem reabrir esta decisão — critério de saída informal, verificado pela story seguinte não ter uma "Questão em aberto" duplicando esta.
- [x] **Eval / teste de regressão:** não aplicável — esta story não produz código executável, só a decisão registrada. Nenhum `pnpm test`/`pnpm eval` novo.

---

## Notas de implementação

- **Molde de ADR:** copiar a estrutura da [ADR 003](../../adr/003-sistemas-como-dado.md) (sistema como dado) — decisão análoga, "X é dado gerado, não código", já resolvida uma vez neste repo para outro tipo de entidade.
- **O conflito de forma é o argumento central contra reuso ingênuo de `Adventure.entities`:** a coluna hoje é `WorldEntity[]` (`nome`, `tipo?`, `local?`, `sabido?`, `revelado?`, `relacoes?`), semeada por `extractOpeningEntities` ([ai.service.ts:1112](../../../apps/api/src/ai/ai.service.ts)) e mutada por `recordEntity`. O artefato do motor tem `npcs[]`, `secrets[]`, `locations[]`, `encounters[]` — superconjunto com forma diferente. Se a decisão for reusar a coluna, precisa decidir se ela vira `{ ledger: WorldEntity[], adventure: GeneratedAdventure }` ou se o ledger continua sendo *derivado* do artefato (GEN-8 lê o artefato e popula `WorldEntity[]` à parte — o que já é o desenho do GEN-8 no backlog).
- **Seed é barato de recomputar:** `Character.id + Adventure.order` já existem nas duas tabelas ([schema.prisma](../../../apps/api/prisma/schema.prisma)) — persistir o `seed` explicitamente pode ser redundante se a fórmula de derivação nunca mudar. Vale registrar a fórmula na ADR mesmo que a coluna não exista.

---

## Questões em aberto

1. Herdada do [backlog irmão](./backlog-aventuras-autorais-lazygm.md): "aventura é dado de um sistema ou entidade reusável?" — esta US existe para fechá-la.
   **Sugestão:** resposta híbrida, não escolher um lado. Aventura é dado gerado (motor decide o conteúdo, sem hardcode — mesmo raciocínio da [ADR 003](../../adr/003-sistemas-como-dado.md)), mas se comporta como entidade persistida depois de gerada: o artefato grava congelado, não é recalculado a cada leitura. "Regenerável" vira propriedade de proveniência (o `seed` prova de onde a aventura veio, uso de auditoria/QA — US-146), não um modo de fetch em produção.
2. Se a resposta for coluna própria, o nome (`Adventure.generatedAdventure`? `Adventure.adventureData`?) fica para quem escrever a ADR decidir, com o `id` do JSON evitando colisão com o `id` do próprio `Adventure`.
   **Sugestão:** `Adventure.generatedAdventure` (`Json?`, mesmo padrão de `entities Json?` já existente na tabela). Evitar `adventureData` — `data` é nome genérico banido pelas [padrões de código](../../../AGENTS.md) do repo. Sobre colisão de `id`: o JSON gerado não deve ter campo `id` solto no nível raiz — `Adventure.id` já é a chave primária da linha; se o motor precisar marcar a geração internamente, usar nome distinto (ex. `generationId`), nunca `id` puro, para não confundir com o `id` da linha no banco.

---

## Referências no código

- [docs/adr/003-sistemas-como-dado.md](../../adr/003-sistemas-como-dado.md) — molde de ADR e precedente de "entidade X é dado gerado/derivado, não hardcode".
- [docs/adr/009-uniao-dos-srd-5-1-e-5-2.md](../../adr/009-uniao-dos-srd-5-1-e-5-2.md) — ADR mais recente do repo (009); próximo número livre é **012** (`docs/adr/010-upload-de-livro-como-lore.md`, `011-observabilidade-em-camadas.md` já ocupados).
- [apps/api/prisma/schema.prisma](../../../apps/api/prisma/schema.prisma) — `Adventure.entities` (`Json?`), `Adventure.order`, `Character.id`: os três campos que a decisão desta ADR precisa encaixar.
- [apps/api/src/ai/ai.service.ts:1112](../../../apps/api/src/ai/ai.service.ts) — `extractOpeningEntities`, o único produtor atual de `Adventure.entities`; mostra a forma que já ocupa a coluna.
- [Backlog — Motor de geração de aventuras one-shot §Tarefas (GEN-0)](./backlog-motor-de-geracao-de-aventuras.md) — texto de origem desta story.
- [backlog-aventuras-autorais-lazygm.md](./backlog-aventuras-autorais-lazygm.md) — decisão aberta 1, herdada.
