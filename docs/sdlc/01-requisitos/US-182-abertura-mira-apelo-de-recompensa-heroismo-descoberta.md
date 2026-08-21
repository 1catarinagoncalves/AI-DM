# US-182 — Abertura gerada mira ao menos 2 de recompensa/heroísmo/descoberta, não só urgência

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** [US-180](./US-180-abertura-ignora-vinculos-do-personagem.md) (`generateOpeningBeat`, estado atual — já resolve tom, ancoragem factual, vínculo pessoal e o dilema Enraizada/Confronto; esta story acrescenta um eixo que nenhuma das anteriores cobre)
**Relacionado:** [US-172](./US-172-abertura-gerada-nao-copia-gancho-fixo.md) (dona original de `generateOpeningBeat`; instituiu a exigência *in medias res*/"strong start", que é URGÊNCIA — esta story soma um segundo eixo, não substitui) · [US-149](./US-149-segredos-40-prompts-lgmrd.md) (`anchorInstruction`/`characterAnchors`, molde de instrução reusado por `generateOpeningBeat` — esta story soma outra instrução no mesmo `system`, não mexe nessa)
**Criada em:** 2026-08-20 — a partir de notas de design trazidas pela mantenedora: um gancho de abertura eficaz precisa de dois elementos — urgência (já coberta pela US-172, "abra em ação") e apelo, que se divide em três motivos clássicos de jogador: recompensa (ganhar algo), heroísmo (agir bem, salvar alguém, corrigir um erro) e descoberta (desvendar um segredo/mistério). `generateOpeningBeat` hoje só garante o primeiro elemento — nada instrui o modelo a mirar o segundo.

---

## História

> **Como** jogadora,
> **quero** que a cena de abertura gerada, além de já estar em ação, me dê um motivo pra continuar — a chance de ganhar algo, de agir de forma heroica, ou de descobrir algo —,
> **para que** a abertura prenda por mais do que só "algo está acontecendo agora": ela também precisa me fazer querer saber o que vem depois.

---

## Contexto e motivação

### O que existe hoje

`generateOpeningBeat` ([ai.service.ts:1541-1578](../../../apps/api/src/ai/ai.service.ts)) já resolve, story a story: tom (`registry.tone`, US-172), ancoragem factual numa `location`/`npc`/`secret` real (US-172), vínculo pessoal quando existir (`bonds`/`story`/`flaws`/`origin.adventuresAndAdvancement`, via `characterAnchors`, US-180), e a escolha entre dois estilos — **Enraizada** (chegada a um local vivo, sem exigir luta) e **Confronto** (ameaça/luta já em ação) — pelo que `premissa`/`complicacao` sugerirem (US-180). O `system` ([ai.service.ts:1562-1571](../../../apps/api/src/ai/ai.service.ts)) exige a cena *in medias res* — "nunca descrição estática de cenário parado".

### O problema

*In medias res* garante urgência — a cena já está em movimento — mas urgência sozinha não é apelo. Uma abertura pode estar plenamente "em ação" (alguém grita, um objeto cai, um NPC corre) sem dar ao jogador NENHUM motivo pra se importar com o que vem a seguir: nada a ganhar, nada de heroico a fazer, nada a descobrir. O `system` de hoje não menciona nenhum dos três — a única exigência de conteúdo, além de urgência/ancoragem/vínculo, é tom.

### Por que a solução atual não basta

As quatro exigências já implementadas (tom, ancoragem, vínculo, estilo) resolvem "esta abertura pertence a ESTA aventura" e "esta abertura está em movimento" — nenhuma delas resolve "esta abertura me faz querer jogar". São eixos ortogonais: uma cena pode citar o local certo, o NPC certo, estar em ação, e ainda assim ser urgência vazia — o personagem foge de algo sem nenhum ganho, ato heroico ou mistério à vista.

### A proposta

O `system` de `generateOpeningBeat` ganha uma instrução nova, ao lado da de estilo (Enraizada/Confronto): a cena deve mirar **pelo menos 2 dos 3** apelos — **recompensa** (algo a ganhar: riqueza, poder, um item, um favor), **heroísmo** (a chance de agir bem: proteger alguém, corrigir um erro, impedir um dano) e **descoberta** (um segredo ou mistério que a cena já insinua, sem revelar) — sem exigir os três, sem prescrever QUAIS dois, e sem inventar elemento fora de `locations`/`npcs`/`secrets`/`premissa`/`complicacao` já recebidos. Mesma disciplina de "instrução no `system`, não campo estruturado novo" que a US-180 já adotou para o dilema Enraizada/Confronto — validação semântica fica com `pnpm eval`/QA manual, não com teste unitário mockado.

---

## Escopo

### Dentro do escopo

- `system` de `generateOpeningBeat` ([ai.service.ts:1562-1571](../../../apps/api/src/ai/ai.service.ts)) ganha instrução nova: a cena deve mirar ao menos 2 de recompensa/heroísmo/descoberta, cada um definido em 1 frase curta (mesmo estilo direto das instruções de Enraizada/Confronto já presentes) — sem exigir os três, sem hierarquia entre eles, escolha do modelo pelo que `locations`/`npcs`/`secrets`/`premissa`/`complicacao` já sugerirem.
- A instrução deixa explícito que os dois apelos escolhidos têm de vir do que já foi gerado (um NPC real oferecendo recompensa, um `secret` insinuado como descoberta, uma ameaça a alguém ligado ao vínculo pessoal como heroísmo) — nunca elemento novo inventado fora da lista recebida, mesma disciplina que já vale para ancoragem factual (US-172).
- Teste de regressão (estrutural, mesmo padrão da US-180): confirma que o `system` gerado contém a instrução de apelo — os três rótulos (recompensa/heroísmo/descoberta) e a exigência de pelo menos 2.
- `pnpm eval` roda e passa (mudança em prompt de geração — regra do projeto, `AGENTS.md`).

### Fora do escopo

- **Campo estruturado reportando quais 2 apelos a abertura mirou** (ex. `appeals: z.array(z.enum(['reward','heroism','discovery'])).min(2)` em `OPENING_BEAT_SCHEMA`). Mesma decisão que a US-180 já tomou para o dilema Enraizada/Confronto: instrução textual resolve sem tocar schema; campo estruturado só se um eval futuro mostrar que a instrução não é seguida de forma confiável (ver *Questões em aberto*).
- **Gate/verificação de apelo na US-150.** Sem campo estruturado (item acima), não há o que o gate verifique mecanicamente — mesma razão pela qual o gate hoje não verifica Enraizada/Confronto.
- **Aplicar a mesma checagem a `hookSeed`** (os 13 ganchos fixos por classe, `initial-adventures.ts`). São conteúdo estático, escrito uma vez, não gerado por chamada de modelo — "instruir a geração a mirar apelo" não se aplica a texto já escrito. Se os 13 ganchos precisam de revisão de apelo, é tarefa de conteúdo/redação, não desta story.
- **Mudar `generateClosing`/`generateSecrets`/`generateLocationsAndNpcs`.** Só `generateOpeningBeat` ganha a instrução — as outras chamadas do motor não mudam.
- **Eval dedicado (LLM-judge) medindo apelo.** Mesma decisão que a US-180 tomou pra "soa pessoal": teste estrutural (instrução presente no `system`) basta nesta story; eval semântico dedicado, se algum dia pedido, é story própria.

---

## Modelo de dados proposto

Nenhum. Mudança é só na string do `system` de `generateOpeningBeat` — `OPENING_BEAT_SCHEMA` (`{ start: z.string().min(1) }`) fica inalterado.

---

## Critérios de aceite

- [ ] `system` de `generateOpeningBeat` contém instrução exigindo ao menos 2 de recompensa/heroísmo/descoberta, com os três rótulos nomeados e cada um definido em 1 frase.
- [ ] A instrução deixa claro que os apelos vêm do que já foi gerado (`locations`/`npcs`/`secrets`) — nunca elemento inventado fora da lista recebida.
- [ ] Instrução de estilo (Enraizada/Confronto, US-180) e de vínculo pessoal (`anchorInstruction`, US-180) continuam presentes e inalteradas — esta story soma, não substitui.
- [ ] **Teste de regressão (estrutural):** o `system` gerado por `buildOpeningBeatPrompt`/dentro de `generateOpeningBeat` contém os três rótulos e a exigência "ao menos 2" — mesmo padrão de teste estrutural da US-180 (não mede a saída real do modelo).
- [ ] `pnpm typecheck` e `pnpm test` passam.
- [ ] `pnpm eval` passa.

---

## Notas de implementação

- Ponto exato: [ai.service.ts:1562-1571](../../../apps/api/src/ai/ai.service.ts), dentro da string `system` de `generateOpeningBeat` — soma uma linha à lista que já tem tom/ancoragem/vínculo/estilo, mesmo formato direto (1-2 frases), sem virar bloco longo.
- Redação sugerida dos três apelos, no mesmo tom das instruções atuais: *"RECOMPENSA — algo a ganhar (riqueza, poder, um item, um favor). HEROÍSMO — a chance de agir bem (proteger alguém, corrigir um erro, impedir um dano). DESCOBERTA — um segredo ou mistério que a cena já insinua, sem revelar."* — decisão de redação, não critério de aceite fechado.
- **Não conflita com Confronto.** Um confronto pode carregar heroísmo (proteger alguém sob ataque) e descoberta (o que está atacando é estranho/desconhecido) ao mesmo tempo — os dois eixos (estilo × apelo) são ortogonais, a instrução nova não força trocar de estilo.
- `generateOpeningBeat` continua "nunca captura erro" (disciplina da US-172) — esta story não muda isso.

---

## Questões em aberto

1. O modelo mira os 2 apelos de forma confiável só com instrução textual, ou a taxa de acerto cai o bastante pra justificar campo estruturado (`appeals[]`) mais adiante? Mesma pergunta que a US-180 deixou aberta pro dilema Enraizada/Confronto (Questão em aberto #2 de lá) — não decidido, esperar leitura de `pnpm eval`/produção antes de prescrever.
2. Vale reforçar a instrução com um exemplo positivo (uma abertura de referência que mire os 2 apelos claramente), ou é cedo sem ver a saída real? Mesmo padrão de cautela que a US-180 registrou para o próprio reforço dela.

---

## Referências no código

- [apps/api/src/ai/ai.service.ts:1541-1578](../../../apps/api/src/ai/ai.service.ts) — `generateOpeningBeat`, a mudar (só o `system`).
- [apps/api/src/ai/ai.service.ts:1562-1571](../../../apps/api/src/ai/ai.service.ts) — string `system` atual (tom/ancoragem/vínculo/estilo), ponto exato da nova linha.
- [apps/api/src/ai/ai.service.ts:224-236](../../../apps/api/src/ai/ai.service.ts) — `characterAnchors`, instrução de vínculo já presente, molde de tom de redação a seguir.
- [US-172](./US-172-abertura-gerada-nao-copia-gancho-fixo.md) — dona de `generateOpeningBeat`, instituiu a exigência de urgência (*in medias res*) que esta story complementa.
- [US-180](./US-180-abertura-ignora-vinculos-do-personagem.md) — última mudança em `generateOpeningBeat` (vínculo pessoal + dilema Enraizada/Confronto); mesmo padrão de decisão (instrução textual, não campo estruturado) que esta story repete.
- [`apps/api/prisma/initial-adventures.ts`](../../../apps/api/prisma/initial-adventures.ts) — os 13 ganchos fixos por classe (`hookSeed`), fora do escopo desta story (conteúdo estático, não gerado).
