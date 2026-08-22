# US-190 — Antagonista vira passo próprio, entre segredos e encontros — não mais sintetizado dentro do fecho

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** 🚧 Parcialmente implementada (22/08/2026, como efeito colateral da implementação do US-181). Feito: `generateAntagonist` (chamada própria), `ANTAGONIST_SCHEMA`, sequenciamento (`generateAntagonist` depois de `generateSecrets`, antes do `Promise.all`), `generateClosing` recebendo `antagonist` como parâmetro. Falta: `generateOpeningBeat` ganhar `antagonist` como insumo novo (item desta story que o US-181 deliberadamente NÃO tocou), `connection`/`characterAnchors` no `ANTAGONIST_SCHEMA` (depende do US-183, ainda não implementada), e a correção de texto no backlog (`§Ordem de geração`). Ver [US-181, Notas de implementação](./US-181-antagonista-ganha-want-e-method-estruturados.md) pro que já está pronto.
**Depende de:** [US-149](./US-149-segredos-40-prompts-lgmrd.md) (`generateSecrets`, ✅ implementada — `secrets[]` é insumo do antagonista) · [US-158](./US-158-locais-npcs-prosa-motor.md) (`generateLocationsAndNpcs`, ✅ implementada — `locations`/`npcs` são insumo) · [US-181](./US-181-antagonista-ganha-want-e-method-estruturados.md) (`want`/`method`/`trait`/`weakness` — esta story MUDA ONDE isso é sintetizado, não o quê; ver *Notas de implementação*) · [US-183](./US-183-antagonista-ganha-conexao-pessoal-com-personagem.md) (`connection`/`characterAnchors` — mesma mudança de lugar)
**Relacionado:** [US-166](./US-166-motor-gera-multiplos-encontros.md) (`encounterSkeleton`/`generateClosing` ganham `antagonist` como INSUMO pronto, não mais produzido na mesma chamada; posição 8 continua o confronto final, agora com antagonista decidido ANTES de qualquer situação ser escrita) · [US-188](./US-188-antagonista-vira-npc-rastreavel.md) (antagonista → `AdventureNpc`; o momento de mintar esse NPC pode subir pra logo após esta story, não precisa mais esperar o `Promise.all` do fecho — ver *Notas de implementação*) · [US-189](./US-189-antagonista-entra-no-ledger.md) (ledger; só consome `antagonist.npcId` quando existir, sem mudança de comportamento) · [US-180](./US-180-abertura-ignora-vinculos-do-personagem.md) (`generateOpeningBeat`, `characterAnchors` — ganha `antagonist` como insumo NOVO, primeira vez que a abertura pode ecoar o vilão real) · [US-169](./US-169-quest-gerada-ganha-objetivo-e-conclusao-acionavel.md) (`objective`, síntese em `generateClosing` que cita `antagonist.want`/`method` — muda de "coproduzido na mesma chamada" pra "lido de parâmetro pronto"; conteúdo de `objective` não muda) · [Backlog — Motor de geração de aventuras one-shot §Ordem de geração](./backlog-motor-de-geracao-de-aventuras.md) (texto corrigido por esta story — ver *Notas de implementação*)
**Criada em:** 2026-08-21 — achado ao revisar a ordem de geração com a mantenedora. O backlog original previa antagonista no **passo 1** ("objetivo + antagonista ← tabela de quests + `background.deity`"), mas a US-164 (Questão em aberto #2, decisão anterior a US-181/183) já tinha rejeitado essa fonte: `background.deity` é a fé do PERSONAGEM, não um vilão, e `premissa` (a linha crua da tabela de quests) "não tem entidade nenhuma atrás". Por isso US-181/183 ancoraram `want`/`method`/`connection` em `locations`/`npcs`/`secrets` — só que fizeram isso dentro de `generateClosing`, o ÚLTIMO passo do pipeline (junto de `conclusion`/`followUps`), não logo depois que `locations`/`npcs`/`secrets` ficam prontos (passo 4). Consequência real: `generateOpeningBeat`, que roda em PARALELO com `generateClosing`, nunca vê o antagonista — a abertura da aventura não pode ecoar nem de leve o vilão que o fecho já decidiu, mesmo os dois rodando na mesma leva de chamadas.

---

## História

> **Como** jogadora,
> **quero** que o antagonista já esteja decidido antes de a abertura e os 8 encontros serem escritos, não só no parágrafo final,
> **para que** a aventura inteira — não só o confronto final — possa ecoar de forma consistente quem é o vilão e o que ele está fazendo.

---

## Contexto e motivação

### O que existe hoje (nas stories planejadas)

`generateClosing` (US-181 soma `antagonist: {name, want, method, trait, weakness}`; US-183 soma `connection`, recebendo `background`/`origin` pra isso) roda dentro do MESMO `Promise.all` que `generateOpeningBeat` — as duas em paralelo, nenhuma vê a saída da outra ([adventure.service.ts:164-189](../../../apps/api/src/adventure/adventure.service.ts)). `antagonist` só existe depois que esse `Promise.all` resolve. Quando US-166 for implementada, a posição 8 dos 8 encontros (o confronto final) também depende de `antagonist` — e por isso a própria US-166 teve que dobrar `encounterSituations` pra dentro de `generateClosing`, só pra garantir que o dado existisse a tempo (ver *Atualizada em (5)* daquele documento).

### O problema

Duas consequências da mesma causa (antagonista nasce tarde demais):

1. **`generateOpeningBeat` nunca vê o antagonista.** A abertura da aventura — a PRIMEIRA coisa que a jogadora lê — não pode citar nem indiretamente o `method` do vilão, porque ele ainda não existe no momento em que a abertura é escrita.
2. **`generateEncounterSituations` (US-166) só consegue amarrar o antagonista à posição 8 fundindo-se em `generateClosing`.** Isso funciona, mas é um acoplamento de conveniência (duas responsabilidades bem diferentes — "escrever o fecho da história" e "escrever 8 situações de jogo" — na mesma chamada só porque uma precisa de um dado que a outra produz), não uma escolha de desenho.

### Por que a solução atual não basta

O backlog nomeia antagonista como decisão de PASSO PRÓPRIO, não como subproduto do fecho — e por um motivo prático, não só estético: um vilão que "está reunindo um exército" (`method`) deveria poder ter presença ANTES da cena final (capangas nos encontros 1-7, um indício na abertura), não aparecer do nada só no parágrafo de encerramento. Isso exige o dado existir cedo, não só no mesmo texto que o fecho.

### A proposta

`generateAntagonist` — chamada de modelo NOVA, própria, rodando **depois de `generateSecrets` (passo 4) e antes de qualquer coisa que precise dele** (encontros, fecho, abertura). Absorve o que US-181 e US-183 já desenharam (`want`/`method`/`trait`/`weakness` ancorados em `locations`/`npcs`/`secrets`; `connection` via `characterAnchors(background, origin)`) — mesmo CONTEÚDO, lugar diferente no pipeline. `generateClosing` e `generateOpeningBeat` passam a RECEBER `antagonist` já pronto (insumo, não mais produto de `generateClosing`); os dois continuam paralelos entre si — nenhum precisa esperar o outro, só esperam `generateAntagonist`, que já rodou antes dos dois.

---

## Escopo

### Dentro do escopo

- `generateAntagonist` (NOVA função, `ai.service.ts`, molde de `generateClosing`/`generateSecrets`): recebe `locations`, `npcs`, `secrets`, `registry`, `complicacao`, `premissa`, `background?`, `origin?`, `locale?` — os MESMOS insumos que US-181+US-183 já desenhavam pra essa síntese, só que como parâmetros de uma chamada própria. Devolve `{ name, want, method, trait, weakness, connection }`. Reusa `characterAnchors(params)` ([ai.service.ts:225-233](../../../apps/api/src/ai/ai.service.ts)) pra `connection`, mesmo padrão que US-183 já previa pra `generateClosing`.
- `ANTAGONIST_SCHEMA` (zod, NOVO): os seis campos, todos `z.string().min(1)` — o schema de saída que US-181 propunha DENTRO de `CLOSING_SCHEMA` sai de lá e vira o schema desta chamada.
- `generateClosing`: PERDE a síntese de `antagonist` (schema de saída volta a ser só `conclusion`/`followUps`, mais `encounterSituations` se US-166 já estiver implementada) e GANHA `antagonist: AdventureAntagonist` como parâmetro de ENTRADA — usado no `system`/prompt pra ancorar `conclusion` no vilão já decidido, nunca reinventado. PERDE também `background`/`origin` como parâmetro (US-183 os adicionava só pra `connection`; `connection` sai daqui).
- `generateOpeningBeat`: GANHA `antagonist: AdventureAntagonist` como parâmetro de ENTRADA NOVO — instrução no `system` pra abertura poder insinuar (nunca nomear ou revelar `weakness`) o `method`/`trait` do antagonista, mesma disciplina "não vaza antes de merecer" que já protege `conclusion` (US-153 #4).
- `generateAdventure` ([adventure.service.ts:131-204](../../../apps/api/src/adventure/adventure.service.ts)): `generateAntagonist` roda DEPOIS de `generateSecrets`, ANTES do `Promise.all([generateClosing, generateOpeningBeat])` — sequencial, não entra no `Promise.all` (é insumo dos dois, não pode ser paralelo a eles). O `Promise.all` em si continua com exatamente as mesmas duas chamadas de hoje (mais `encounterSituations`, se fundida por US-166), só que ambas agora recebem `antagonist` pronto.
- Backlog (`backlog-motor-de-geracao-de-aventuras.md`, §*Ordem de geração*): texto corrigido — antagonista sai do passo 1 (nunca funcionou como escrito, `background.deity` já tinha sido rejeitado pela US-164 #2) e vira passo próprio depois de segredos, antes de encontros. Ver *Notas de implementação*.
- Teste de regressão: fixture com `locations`/`npcs`/`secrets` → `generateAntagonist` devolve os 6 campos não-vazios; fixture COM e SEM âncora de personagem → `connection` não-vazio nos dois casos (mesmo par de casos que US-183 já previa, só que testando a função nova). Fixture com `antagonist` mockado → `generateClosing`/`generateOpeningBeat` recebem e usam no prompt (teste de integração, não de conteúdo gerado).

### Fora do escopo

- **Mudar o CONTEÚDO de `antagonist`** (quais campos existem, o que cada um significa). `name`/`want`/`method`/`trait`/`weakness` (US-181) e `connection` (US-183) ficam exatamente como desenhados — esta story só move ONDE são sintetizados.
- **Mintar o `AdventureNpc` do antagonista** (US-188). Continua story própria; com `antagonist` existindo mais cedo, US-188 PODE mintar o NPC logo após esta chamada em vez de esperar o `Promise.all` do fecho — mas isso é ajuste da própria US-188 quando for implementada, não travado aqui.
- **Ledger** (US-189). Sem mudança — continua consumindo `antagonist.npcId` sempre que existir, independente de QUANDO no pipeline ele foi decidido.
- **`generateEncounterSituations`/`encounterSkeleton` deixarem de estar fundidos em `generateClosing`** (decisão da US-166, *Atualizada em (5)*). Com `antagonist` chegando mais cedo, a fusão deixa de ser NECESSÁRIA (o motivo original — "antagonist só existe depois do Promise.all" — desaparece), mas desfazer a fusão é decisão de US-166, não desta story. Registrado como *Questão em aberto*.
- **Locais/NPCs/segredos (passos 2-4) referenciarem o antagonista.** Continuam cegos a ele — antagonista roda DEPOIS desses três passos, não antes. Resolve só a cegueira de `generateOpeningBeat`/`generateEncounterSituations`/`generateClosing` (passos que rodam DEPOIS do antagonista), não a dos passos anteriores. Voltar antagonista pra ANTES de locais/NPCs recriaria o problema original (US-164 #2): sem `locations`/`npcs`/`secrets`, não há em que ancorar `want`/`method`.

---

## Modelo de dados proposto

```ts
// apps/api/src/ai/ai.service.ts — generateAntagonist (NOVA função, US-190)
// Absorve o design de US-181 (want/method/trait/weakness) + US-183 (connection via
// characterAnchors) — mesmo conteúdo, chamada própria em vez de dentro de generateClosing.
async generateAntagonist(params: {
  locations: AdventureLocation[]
  npcs: AdventureNpc[]
  secrets: AdventureSecret[]
  registry: AdventureRegistry
  complicacao: { condition: string; description: string; origin: string }
  premissa: string
  background?: CharacterBackground
  origin?: { adventuresAndAdvancement?: string }
  locale?: Locale
}): Promise<{
  name: string
  want: string
  method: string
  trait: string
  weakness: string
  connection: string
}>
```

```ts
// apps/api/src/ai/ai.service.ts — ANTAGONIST_SCHEMA (sai de dentro de CLOSING_SCHEMA, US-181/183)
const ANTAGONIST_SCHEMA = z.object({
  name: z.string().min(1),
  want: z.string().min(1),
  method: z.string().min(1),
  trait: z.string().min(1),
  weakness: z.string().min(1),
  connection: z.string().min(1),
})
```

```ts
// apps/api/src/ai/ai.service.ts — generateClosing e generateOpeningBeat, diff de assinatura
// generateClosing PERDE `background`/`origin` (só serviam pra connection, que saiu daqui)
// e GANHA `antagonist: AdventureAntagonist` como entrada; CLOSING_SCHEMA volta a não ter
// `antagonist` na saída (encounterSituations, se US-166 já estiver implementada, continua).
// generateOpeningBeat GANHA `antagonist: AdventureAntagonist` como entrada nova.
```

---

## Critérios de aceite

- [ ] `generateAntagonist` existe como função própria, roda com sucesso a partir de `locations`/`npcs`/`secrets`/`registry`/`complicacao`/`premissa` (+ `background`/`origin` opcionais).
- [ ] `ANTAGONIST_SCHEMA` exige os 6 campos, todos string não-vazia.
- [ ] `connection` não-vazio COM e SEM âncora de personagem (`background.story`/`origin.adventuresAndAdvancement`) — mesmo comportamento de fallback que US-183 já especificava.
- [ ] `generateAdventure` chama `generateAntagonist` DEPOIS de `generateSecrets` e ANTES do `Promise.all([generateClosing, generateOpeningBeat])` — sequencial, fora do `Promise.all`.
- [ ] `generateClosing` recebe `antagonist` como parâmetro; `CLOSING_SCHEMA` não exige mais `antagonist` na saída.
- [ ] `generateOpeningBeat` recebe `antagonist` como parâmetro novo; `system` instrui insinuação (nunca nomear/revelar `weakness`), mesma disciplina de `conclusion`.
- [ ] `generateAdventure` monta o `GeneratedAdventureSchema` final com `antagonist` vindo de `generateAntagonist` diretamente (não mais de `generateClosing`).
- [ ] Backlog (`backlog-motor-de-geracao-de-aventuras.md`): §*Ordem de geração* reflete antagonista como passo próprio entre segredos e encontros; nota registra que o passo 1 original nunca foi implementável (US-164 #2).
- [ ] **Teste de regressão:** fixture com `generateAntagonist` mockado → `generateClosing`/`generateOpeningBeat` recebem `antagonist` corretamente no prompt (asserção de chamada, não de conteúdo gerado).
- [ ] `pnpm typecheck`, `pnpm test` e `pnpm eval` passam (muda prompt/estrutura de 3 chamadas de modelo).

---

## Notas de implementação

- **Esta story SUPERSEDE os pontos de código de US-181/US-183, não o conteúdo delas.** Se US-181/US-183 forem implementadas ANTES desta (antagonist dentro de `generateClosing`), esta story é um refactor de MOVER a síntese, preservando os 6 campos e a lógica de `characterAnchors` já escrita — não uma reescrita de zero. Se esta story for implementada ANTES de US-181/US-183 chegarem a existir como código, ela já nasce no lugar certo e US-181/US-183 encolhem pra "adicionar campo ao `ANTAGONIST_SCHEMA`" em vez de "adicionar campo + mover chamada".
- **Ordem de implementação sugerida:** esta story antes de US-166/US-188/US-189 (todas consomem `antagonist` de algum jeito e se beneficiam de ele já existir cedo), mas DEPOIS de US-181 (precisa que `want`/`method`/`trait`/`weakness` já estejam desenhados, mesmo que o código ainda não exista — o desenho é o que esta story move).
- **Correção no backlog:** a linha `1. objetivo + antagonista ← tabela de quests + background.deity` vira `1. objetivo ← tabela de quests` (antagonista sai do passo 1) e um passo novo entra entre `4. segredos` e `5. encontros`: `4.5 (ou renumerado) antagonista ← modelo, ancorado em locais/NPCs/segredos já decididos`. Nota no backlog explica que o passo 1 original citava `background.deity`, fonte já rejeitada pela US-164 #2 antes de qualquer story de antagonista existir — o backlog ficou desatualizado, não o código.
- **`generateEncounterSituations`/fusão em `generateClosing` (US-166) não é desfeita por esta story** — mas o motivo que justificou a fusão (antagonist só existe depois do `Promise.all`) deixa de valer. Fica registrado como *Questão em aberto* pra US-166 decidir separadamente se vale separar de novo, agora que voltaria a ser só ganho arquitetural (schema menor, sem custo de latência) e não mais requisito.
- **Custo:** antes desta story, o pipeline tinha 3 chamadas de modelo (locations+npcs, secrets, `Promise.all` de 2). Depois, são 4: a nova `generateAntagonist` roda sequencial, sozinha, entre segredos e o `Promise.all` — 1 round-trip a mais que o baseline SEM antagonista nenhum, mas ZERO a mais que o baseline COM antagonista (US-181/183 já custavam essa síntese, só que de graça dentro de `generateClosing`; aqui custa 1 round-trip próprio, mas dá visibilidade a `generateOpeningBeat` que a versão "de graça" nunca daria).

---

## Questões em aberto

1. Com `antagonist` chegando antes do `Promise.all`, vale desfazer a fusão de `generateEncounterSituations` em `generateClosing` (US-166) e devolvê-la a uma chamada própria, paralela a `generateClosing`/`generateOpeningBeat`? Ganho: `CLOSING_SCHEMA` menor, três responsabilidades (fecho, abertura, situações) em três chamadas em vez de duas. Custo: mais uma chamada no `Promise.all` (paralela, sem latência sequencial a mais, mas mais uma requisição de rede). Não decidido aqui — é ajuste de US-166, não desta story.
2. `generateOpeningBeat` ecoando o antagonista é sempre desejável, ou às vezes o produto quer a abertura TOTALMENTE cega ao vilão (mistério puro, "quem é o antagonista" só se revela mais tarde)? Decisão adotada: sempre insinuar, com a mesma disciplina de dosagem que já protege `conclusion`/`weakness` — se o eval mostrar abertura revelando demais, é ajuste de prompt, não reversão do insumo.
3. Vale medir o custo real da 4ª chamada sequencial (decisão aberta #3 do backlog-mãe, "quantas chamadas ao modelo por aventura, e a que custo?") antes de implementar, ou aceitar e medir depois com `pnpm eval`/produção? Não decidido — mesma disciplina que o resto do motor já usa (medir depois, não travar implementação nisso).

---

## Referências no código

- [`apps/api/src/adventure/adventure.service.ts:131-204`](../../../apps/api/src/adventure/adventure.service.ts) — `generateAdventure`, ganha a chamada sequencial nova entre `generateSecrets` e o `Promise.all`.
- [`apps/api/src/ai/ai.service.ts:225-233`](../../../apps/api/src/ai/ai.service.ts) — `characterAnchors`, reusada por `generateAntagonist` (antes seria reusada por `generateClosing`, US-183).
- [`apps/api/src/ai/ai.service.ts:1490-1518`](../../../apps/api/src/ai/ai.service.ts) — `generateClosing`, perde a síntese de `antagonist`, ganha o parâmetro.
- [`apps/api/src/ai/ai.service.ts:1539-1576`](../../../apps/api/src/ai/ai.service.ts) — `generateOpeningBeat`, ganha `antagonist` como parâmetro novo.
- [US-181](./US-181-antagonista-ganha-want-e-method-estruturados.md) — desenho de `want`/`method`/`trait`/`weakness`, conteúdo preservado, local de síntese movido por esta story.
- [US-183](./US-183-antagonista-ganha-conexao-pessoal-com-personagem.md) — desenho de `connection`/`characterAnchors`, idem.
- [US-166](./US-166-motor-gera-multiplos-encontros.md) — *Atualizada em (5)*, a fusão de `encounterSituations` em `generateClosing` cujo motivo original esta story remove (ver *Questão em aberto* #1).
- [US-188](./US-188-antagonista-vira-npc-rastreavel.md) — pode mintar o NPC do antagonista mais cedo, com `antagonist` disponível antes do `Promise.all`.
- [US-164, Questão em aberto #2](./US-164-orquestrador-motor-monta-aventura-gerada.md) — decisão original que rejeitou `background.deity`/`premissa` como fonte de antagonista, motivo raiz de o passo 1 do backlog nunca ter sido implementável como escrito.
- [Backlog — Motor de geração de aventuras one-shot §Ordem de geração](./backlog-motor-de-geracao-de-aventuras.md) — texto corrigido por esta story.
