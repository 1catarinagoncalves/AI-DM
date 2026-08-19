# US-179 — Barra de ofício da narração chega ao motor de geração (prosa gerada sem regra de qualidade)

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** nenhuma — `NARRATIVE_CRAFT_SECTION` já existe pronta em [dm-system.ts:169-178](../../../packages/ai-engine/src/prompts/dm-system.ts); é extração + adaptação, não peça nova.
**Relacionado:** [US-34](./US-34-qualidade-da-narracao-do-dm.md) (origem da barra de ofício) · [US-36](./US-36-eval-de-qualidade-da-narracao.md) (rubrica `DIMENSIONS` que mede a barra) · [US-177](./US-177-onomastica-em-npcs-e-locais-do-motor.md) (mesmo padrão de achado — a seção-irmã `### Onomastics`, dentro da MESMA `NARRATIVE_CRAFT_SECTION`, já ganhou story própria; esta story cobre o resto da seção) · [US-178](./US-178-locale-chega-ao-motor-de-geracao.md) (story irmã, mesmas 4 chamadas, achado no mesmo levantamento)

**Criada em:** 2026-08-19 — achado ao auditar quais regras de qualidade do prompt de narração NÃO chegam ao motor de geração de aventuras (mesmo levantamento que originou a US-177 e a US-178).

---

## História

> **Como** mantenedora,
> **quero** que as 4 chamadas do motor de geração (locais, NPCs, segredos, fecho, abertura) sigam a mesma barra de qualidade de prosa (concretude sensorial, proibição de prosa genérica "video-gamey", NPC com voz/corpo/aposta) que já governa a narração ao vivo,
> **para que** o conteúdo que vira canon ANTES da primeira cena (ADR 012) não seja o elo fraco que solta descrição rasa numa aventura cujo Mestre, no mesmo jogo, é proibido de fazer exatamente isso.

---

## Contexto e motivação

### O problema observado

`NARRATIVE_CRAFT_SECTION` ([dm-system.ts:169-178](../../../packages/ai-engine/src/prompts/dm-system.ts)) abre com uma frase categórica: *"Every narration — including the very first scene — must meet this bar. Generic, 'video-gamey' prose... is a FAILURE even when mechanically correct."* Ela lista 8 regras, entre elas:

- Abrir nos SENTIDOS, não em exposição.
- Ser concreto e NOMEAR coisas — um detalhe específico bate um genérico.
- Dar aos NPCs voz e corpo — movimento, emoção, aposta, "especially the vulnerable".
- Mostrar tensão antes de explicá-la.

Nenhuma das 4 chamadas do motor ([ai.service.ts:1340-1514](../../../apps/api/src/ai/ai.service.ts)) cita qualquer uma dessas regras. Os `system` são puramente MECÂNICOS — dizem o que estruturalmente produzir (`id`, `locationId`, ancoragem em `bonds`/`tone`), nunca COMO escrever a prosa de cada campo:

- `generateLocationsAndNpcs`: `boxedText` (texto para o Mestre LER EM VOZ ALTA ao jogador, método LGMRD) e `description` de cada local, `role` de cada NPC — só instrução de "invente NOME e ARQUÉTIPO", zero menção a voz/corpo/sentidos.
- `generateSecrets`: `text` de cada segredo — só "responda a uma das perguntas-molde".
- `generateClosing`: `conclusion` (2-3 parágrafos) — só "resolvendo a premissa e a complicação".
- `generateOpeningBeat`: `start` (1-2 parágrafos, *in medias res*) — só "jogue a cena já em ação".

### Por que a solução atual não basta

Todo esse texto é PROSA que o jogador lê direto (`boxedText` é lido em voz alta por definição do método) ou que o Mestre ao vivo herda como CANON e precisa narrar em cima, coerente ([dm-system.ts:463](../../../packages/ai-engine/src/prompts/dm-system.ts): *"never contradict"* o que já foi estabelecido). Um `role` de NPC gerado como rótulo seco ("comerciante desconfiado") sem voz/corpo already trava toda futura interação daquele NPC pela mesa inteira — o Mestre ao vivo é instruído a "dar voz e corpo" a um NPC que nasceu sem nenhuma delas. É o mesmo padrão de furo que motivou a US-177 (Onomástica é uma sub-seção da MESMA `NARRATIVE_CRAFT_SECTION`, já reconhecida como furo): a barra de ofício inteira existe só para o lado da narração ao vivo; o motor de geração, que produz canon ANTES de qualquer turno, fica de fora.

### A proposta

Adaptar o subconjunto de `NARRATIVE_CRAFT_SECTION` aplicável a PROSA GERADA UMA VEZ (não a um turno interativo — bullets como "close on a living hook, address the character by name" ou "vary paragraph rhythm across a conversation" são específicos de turno e não fazem sentido aqui) para uma seção própria, citada nos `system` das 4 chamadas do motor: concretude sensorial, proibição de prosa genérica, e — no caso específico de `generateLocationsAndNpcs` — a instrução de dar ao NPC voz/corpo/aposta em vez de só nome+arquétipo.

---

## Escopo

### Dentro do escopo

- Nova seção (ex.: `GENERATION_CRAFT_SECTION`, nome a decidir na implementação) com o subconjunto de `NARRATIVE_CRAFT_SECTION` relevante a prosa gerada de uma vez: abrir nos sentidos, ser concreto/nomear coisas, mostrar tensão antes de explicar, e (só para `generateLocationsAndNpcs`) dar ao NPC voz/corpo/aposta.
- `generateLocationsAndNpcs` ([ai.service.ts:1356-1359](../../../apps/api/src/ai/ai.service.ts)): `system` ganha a barra — cobre `boxedText`/`description` de local e `role` de NPC.
- `generateSecrets` ([ai.service.ts:1425-1430](../../../apps/api/src/ai/ai.service.ts)): `system` ganha a barra — cobre `text` de cada segredo.
- `generateClosing` ([ai.service.ts:1467-1472](../../../apps/api/src/ai/ai.service.ts)): `system` ganha a barra — cobre `conclusion`.
- `generateOpeningBeat` ([ai.service.ts:1502-1507](../../../apps/api/src/ai/ai.service.ts)): `system` ganha a barra — cobre `start`.
- Teste de regressão: `system` de cada uma das 4 chamadas contém o texto/marcador da nova seção.
- `pnpm eval` roda e passa (mudança em prompt do motor — regra do projeto, `AGENTS.md`).

### Fora do escopo

- **Onomástica** — já é a [US-177](./US-177-onomastica-em-npcs-e-locais-do-motor.md), story separada; esta story não duplica a seção `### Onomastics`, só o resto da barra.
- **Idioma-alvo (`locale`)** — já é a [US-178](./US-178-locale-chega-ao-motor-de-geracao.md); esta story assume que o `system` continua na língua atual (predominantemente português nas instruções), só adiciona regra de QUALIDADE de prosa, não de IDIOMA.
- **Regras de rimo/parágrafo específicas de turno** ("mix short and long sentences", "3-5 short paragraphs", "close on a living hook") — não fazem sentido para um campo estruturado de 1-3 parágrafos gerado uma vez; não entram na seção adaptada.
- **Rubrica de eval (`DIMENSIONS`, US-36)** — mede a narração AO VIVO, não a prosa do motor; se esta story revelar necessidade de medir qualidade da prosa gerada, é rubrica/eval NOVOS, story própria.
- **Alterar o schema** (`AdventureLocationSchema`/`AdventureNpcSchema`/etc.) — não muda; a regra vive só no `system`, nenhum campo novo.

---

## Critérios de aceite

- [ ] Seção de barra de ofício adaptada para geração existe (const própria ou trecho reusado de `NARRATIVE_CRAFT_SECTION`, decisão de implementação).
- [ ] `system` de `generateLocationsAndNpcs` inclui a seção, cobrindo local (`boxedText`/`description`) e NPC (`role` com voz/corpo/aposta, não só arquétipo).
- [ ] `system` de `generateSecrets`, `generateClosing` e `generateOpeningBeat` incluem a seção (variante sem a parte de NPC, que só se aplica a `generateLocationsAndNpcs`).
- [ ] Teste em `ai.service.test.ts` verifica a presença da seção no `system` das 4 chamadas.
- [ ] `pnpm typecheck`, `pnpm test` e `pnpm eval` passam.

---

## Notas de implementação

- **Pontos exatos:** `system` de cada chamada — [ai.service.ts:1356-1359](../../../apps/api/src/ai/ai.service.ts) (`generateLocationsAndNpcs`), [:1425-1430](../../../apps/api/src/ai/ai.service.ts) (`generateSecrets`), [:1467-1472](../../../apps/api/src/ai/ai.service.ts) (`generateClosing`), [:1502-1507](../../../apps/api/src/ai/ai.service.ts) (`generateOpeningBeat`).
- **Duas formas de extrair, decidir na implementação:**
  1. Const nova em `dm-system.ts` com o subconjunto adaptado (paralelo ao que a US-177 propõe para `ONOMASTICS_SECTION`) — mantém uma fonte de verdade única, mas o texto de `NARRATIVE_CRAFT_SECTION` é escrito para "the OPENING scene AND every turn"; extrair só o subconjunto exige reescrever a frase de abertura da seção, então NÃO é extração byte-a-byte como a Onomástica — o guard de drift da US-36 (`rubric-drift.test.ts`) NÃO se aplica aqui do mesmo jeito, porque o texto muda.
  2. Escrever a seção adaptada direto em `ai.service.ts`, sem tocar em `dm-system.ts` — menos reuso, mas evita qualquer risco de mexer em `NARRATIVE_CRAFT_SECTION`/`REVIEWED_CRAFT_HASH`.
  - Preferência: opção 1 SE a reescrita da frase de abertura for pequena o bastante para não arriscar o hash da US-36; senão, opção 2.
- **Overlap com US-177:** ambas tocam o `system` de `generateLocationsAndNpcs` (mesma string concatenada); mudanças em conteúdo diferente (Onomástica vs. barra de ofício geral) — mesma disciplina de "overlap sem dependência, ordem de merge decide" já usada entre US-174/US-176.
- **`boxedText` merece atenção especial** — é o único campo entre os 4 que o método LGMRD define como texto para LER EM VOZ ALTA (não paráfrase do Mestre); a seção adaptada deveria deixar claro que vale a MESMA barra de concretude sensorial, não uma versão mais fraca por ser "só um trecho curto".

---

## Questões em aberto

1. A barra adaptada deve ser uma const ÚNICA reusada nas 4 chamadas, ou cada chamada precisa de uma REDAÇÃO própria (já que `generateSecrets`/`generateClosing`/`generateOpeningBeat` não têm NPC pra dar voz/corpo, só `generateLocationsAndNpcs` tem)? Decidir olhando se a versão genérica (sem a parte de NPC) ainda faz sentido nas outras 3, ou se fica vago demais.
2. Vale medir isso com eval dedicado (LLM-judge, rubrica nova ou adaptada da US-36) além do teste unitário de presença da seção no `system`? A US-36 mede a narração ao vivo; replicar a disciplina pro motor é trabalho de eval considerável — avaliar se cabe nesta story ou vira story própria depois de observar a saída real em produção.

---

## Referências no código

- [packages/ai-engine/src/prompts/dm-system.ts:160-201](../../../packages/ai-engine/src/prompts/dm-system.ts) — `NARRATIVE_CRAFT_SECTION`, fonte do subconjunto a adaptar (⚠️ nota do próprio arquivo: espelhada pela rubrica `DIMENSIONS`/US-36 — ver Notas antes de tocar).
- [apps/api/src/ai/ai.service.ts:1340-1514](../../../apps/api/src/ai/ai.service.ts) — as 4 chamadas do motor, `system` de cada uma a alterar.
- [packages/ai-engine/src/rubric-drift.test.ts](../../../packages/ai-engine/src/rubric-drift.test.ts) — guard de hash sobre `NARRATIVE_CRAFT_SECTION`; conferir se a opção de implementação escolhida o afeta.
- [docs/adr/012-aventura-gerada-como-dado.md](../../adr/012-aventura-gerada-como-dado.md) — por que a prosa do motor vira canon imutável (motivo de esta story importar).
- [US-34](./US-34-qualidade-da-narracao-do-dm.md) — origem da barra de ofício.
- [US-36](./US-36-eval-de-qualidade-da-narracao.md) — rubrica que mede a barra na narração ao vivo.
- [US-177](./US-177-onomastica-em-npcs-e-locais-do-motor.md) — story-irmã, mesma seção-mãe, mesmo padrão de achado, overlap de arquivo.
- [US-178](./US-178-locale-chega-ao-motor-de-geracao.md) — story-irmã, mesmas 4 chamadas, achado no mesmo levantamento.
