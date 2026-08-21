# US-166 — Motor gera 8 encontros como situações completas (location, inhabitants, behaviors, goal, complications)

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** [US-164](./US-164-orquestrador-motor-monta-aventura-gerada.md) (`generateAdventure`, [adventure.service.ts:131-204](../../../apps/api/src/adventure/adventure.service.ts) — estende o array de 1 elemento pra 8; `generateClosing`, já dentro do `Promise.all` das linhas 164-189, ganha `encounterSkeleton`/`encounterSituations`) · [US-152](./US-152-statblocks-papel-orcamento.md)/[US-160](./US-160-composer-encontro-usa-limiar-de-soma.md)/[US-161](./US-161-jogador-escolhe-nivel-de-desafio-do-encontro.md) (`composeEncounterRoles`/`buildEncounterNpcs`, ✅ implementadas, reusadas nos slots `combat`) · [US-144](./US-144-schema-aventura-shared.md) (`AdventureEncounterSchema` — MUDA, ganha `behaviors`/`goal`/`complications`) · [US-158](./US-158-locais-npcs-prosa-motor.md) (`generateLocationsAndNpcs`, ✅ implementada — fonte de `locationId`/`npcIds` via `location.occupants`) · [US-149](./US-149-segredos-40-prompts-lgmrd.md) (`generateSecrets`, ✅ implementada — `secrets[]` já é parâmetro de `generateClosing` DESDE ANTES desta story, US-166 só reaproveita) · [US-181](./US-181-antagonista-ganha-want-e-method-estruturados.md) (`antagonist: {name, want, method}`, 📋 **NÃO implementada** — bloqueia esta story mais que os outros itens: sem ela, `CLOSING_SCHEMA` não tem `antagonist` pra a posição 8 ecoar) · [US-170](./US-170-locais-gerados-entram-no-ledger.md) (`seedLedgerFromGeneratedAdventure`/`locationEntities`, ✅ implementada — muda o `nota`) · [US-114](./US-114-modelo-utilitario-para-extracao-e-fecho.md) (modelo barato, molde de `generateClosing`)
**Relacionado:** [US-150](./US-150-gate-antes-de-persistir-aventura-gerada.md) (gate — verificação 3 filtra `type === 'combat'`) · [US-171](./US-171-encontros-de-combate-entram-no-ledger.md) (`encounterNpcEntities` MUDA, ganha filtro `type === 'combat'`) · [US-163](./US-163-jogador-escolhe-tamanho-da-aventura.md) (dial de NPCs de história — o eixo de locais que essa story propunha saiu de lá em 2026-08-20; `N` de encontros é 8 fixo, decidido, não negociável nem por esta story)
**Criada em:** 2026-08-18 — questão em aberto #3 da US-164 (*"um encontro ou 4-5?"*), respondida "4-5" e destacada como story própria por tocar contrato/custo além do escopo do orquestrador.
**Atualizada em:** 2026-08-20 — define a estrutura fixa: **8 encontros** (não mais 4-5), sequência de tipo `combat/skill/social/combat/skill/social/skill/combat` sem repetição adjacente, sempre fechando em combate. Piso de locais fixado em 8 (absorve o eixo de locais que a US-163 propunha; ela fica só com o dial de NPCs de história).
**Atualizada em (2):** 2026-08-21 — reescrita de fundo, a pedido da mantenedora. A story deixa de amarrar cada encontro a uma perícia testada (`testedSkill`, tentado e abandonado no mesmo dia) e passa a gerar 8 **situações** completas, framework Sly Flourish (Location/Inhabitants/Behaviors/Goal/Complications — ver *Referências externas*): `location` = `locationId`, `inhabitants` = `npcIds` (`combat` via composer, `social` via `location.occupants` com fallback round-robin, `skill` vazio), e três campos novos — `behaviors`/`goal`/`complications` — prosa do modelo (US-114). Perícia testada volta a ser 100% emergente no turno, sem sinal estruturado — a garantia de "toda perícia proficiente é convocada" (motivo original desta story, US-164) deixa de ser resolvida por ela.
**Atualizada em (3):** 2026-08-21, mesmo dia — `generateEncounterSituations` ganha `secrets`/`antagonist` como contexto, decisão da mantenedora. `secrets` é barato (já existe no passo 4, antes dos encontros — sem conflito de ordem). `antagonist` (US-181) só existe DEPOIS de `generateClosing` rodar, e essa chamada estava planejada pra rodar em PARALELO com `generateEncounterSituations` — escolhida a opção que quebra o paralelo: `generateEncounterSituations` passa a rodar SEQUENCIAL, depois do `Promise.all([generateClosing, generateOpeningBeat])`, não mais dentro dele. Custo aceito: 1 round-trip sequencial a mais (a latência que a reescrita (2) evitava de propósito). Ganho: encontro pode ecoar `antagonist.want`/`method` de verdade, não só tom genérico.
**Atualizada em (4):** 2026-08-21, mesmo dia — decisão da mantenedora, resolve *Questão em aberto* #1 (agora removida): a sequência de `type` deixa de ser constante fixa e passa a ser SORTEADA por seed determinístico (mesmo par `characterId`+`order` → mesma sequência, mesmo padrão de `tableSeed`/`createSeededRandom` que o resto do motor já usa, US-146). Posição 8 continua sempre `combat`, mas agora FIXA por construção (não sorteada) — porque vira o **confronto final com o antagonista**: a situação instrui esse encontro específico a ecoar `antagonist.want`/`method` diretamente, não só "pode". Posições 1-7 sorteiam o multiset `{combat×2, skill×3, social×2}` (mesma proporção 3/3/2 de antes, já que 1 combat foi reservado pra posição 8), respeitando "nunca dois tipos iguais adjacentes" — incluindo contra a posição 8 fixa.
**Atualizada em (5):** 2026-08-21, mesmo dia — fecha as questões em aberto restantes. A mais relevante muda desenho: `generateEncounterSituations` deixa de ser função nova — vira mais dois campos (`encounterSkeleton` de entrada, `encounterSituations` de saída) no MESMO `generateClosing` que a US-181 já estende com `antagonist`. Volta a rodar dentro do `Promise.all([generateClosing, generateOpeningBeat])` original — **nenhum round-trip sequencial a mais**, resolve o custo/latência da reescrita (3) por arquitetura, não por aceitar o gasto. As outras: `combat` mantém segmento no `nota` do local (é o que dá o payoff do confronto final); `CRAFT_CORE_SECTION` reusado verbatim (seção própria só se eval mostrar complicação genérica); sem `background`/`origin` como insumo no MVP; dependência de US-181 continua DURA, não vira opcional (a posição 8 exige `antagonist` de verdade); teto de retry do `shuffleEncounterTypes` (~20) mantido, espaço de shuffles válidos é grande.

---

## História

> **Como** jogadora,
> **quero** que a aventura gerada me leve por 8 situações — combate, interação social e desafio de perícia — cada uma com moradores, comportamento, um objetivo que explica por que estou ali e uma complicação que pode virar o jogo de cabeça pra baixo,
> **para que** cada encontro pareça um lugar vivo com gente fazendo alguma coisa, não uma lista de monstros ou uma pergunta de quiz de perícia.

---

## Contexto e motivação

### O problema observado

A versão anterior desta story ([backlog §Ordem de geração](./backlog-motor-de-geracao-de-aventuras.md), passo 5) previa "encontros (4-5)" sem tipo — na prática, `composeEncounterRoles`/`buildEncounterNpcs` (US-152/160/161) só sabem montar **combate**. Uma aventura com 4-5 encontros, todos de combate, contradiz o resto do artefato: `~6` locais, `~7` NPCs e `~11` segredos (US-149) já cobrem exploração e interação social em prosa, mas nenhum vira um **encontro estruturado** — só o combate ganha essa forma.

### A proposta

Cada um dos 8 `AdventureEncounter` passa a responder as cinco perguntas de uma situação (Sly Flourish, *Building Situations*/*Situation Checklist* — ver *Referências externas*) em vez de amarrar uma perícia (`locationId`/`npcIds`/chave crua tipo `"stealth"` não são uma cena, são uma etiqueta):

| Pergunta | Campo | Como é decidido |
|---|---|---|
| **Location** — onde isso acontece? | `locationId` | Round-robin sobre `locations[]` (já existia) |
| **Inhabitants** — quem mora ali? | `npcIds` | `combat`: `composeEncounterRoles`/`buildEncounterNpcs`. `social`: `location.occupants`, fallback round-robin. `skill`: `[]` — obstáculo não precisa de morador |
| **Behaviors** — o que estão fazendo? | `behaviors` (NOVO) | Prosa curta, modelo (US-114) |
| **Goal** — por que o personagem foi lá, o que conta como sucesso? | `goal` (NOVO) | Prosa curta, modelo (US-114) |
| **Complications** — o que pode virar o jogo? | `complications` (NOVO) | Prosa curta, modelo (US-114) |

`type` (`combat`/`skill`/`social`) continua existindo, mas não trava perícia — direciona o QUE o modelo escreve (`skill` puxa pra obstáculo físico/ambiental, `social` pra negociação com NPC, `combat` pra ameaça e cerco). A sequência de `type` é SORTEADA (seed determinístico), não mais constante: cada aventura embaralha `{combat×2, skill×3, social×2}` nas posições 1-7, sem dois tipos iguais adjacentes. A posição 8 é sempre `combat`, fixa, não sorteada — é o **confronto final com o antagonista**, e é o que garante variedade de FORMATO entre aventuras sem abrir mão do showdown.

`behaviors`/`goal`/`complications` não nascem no vácuo: a mesma chamada de `generateClosing` que já recebe `secrets[]` (US-149 — a situação PODE entrelaçar um segredo do mesmo local sem revelá-lo) e já sintetiza `antagonist: {name, want, method}` (US-181 — a situação PODE ecoar o plano do vilão, e a do encontro final DEVE) escreve as 8 situações junto de `conclusion`/`followUps`/`antagonist`, no mesmo texto. Contexto de prompt, não vínculo estrutural — nenhum `secretId`/`antagonistId` novo no schema do encontro.

---

## Escopo

### Dentro do escopo

- `AdventureEncounterSchema` (US-144) ganha `behaviors: z.string().min(1)`, `goal: z.string().min(1)`, `complications: z.string().min(1)` — presentes nos 8 encontros, `combat` incluso. `type` continua igual.
- `generateAdventure` (US-164) monta exatamente **8** encontros. `type` de cada um: posição 8 = `combat` (fixo, sempre o confronto final); posições 1-7 = shuffle seedado (`createSeededRandom`, sub-seed próprio via `deriveAdventureSeed`+`purpose`, mesmo padrão de `tableSeed` em `roll-content.ts`) do multiset `{combat×2, skill×3, social×2}`, com retry (mesma família de seed, contador local) até não ter dois tipos iguais adjacentes — incluindo contra a posição 8 fixa (posição 7 nunca pode ser `combat`).
- `locationId` de cada um dos 8: `locations[i % locations.length]`, round-robin. `buildLocationsAndNpcsPrompt` ganha instrução de quantidade-alvo de locais (8), mesmo número dos encontros.
- `npcIds`: `combat` vem de `composeEncounterRoles`/`buildEncounterNpcs` (cumulativo entre chamadas, sem colisão de `id`); `social` vem de `location.occupants` (US-158, [ai.service.ts:1416-1421](../../../apps/api/src/ai/ai.service.ts), já popula com `id` real de `npcs[]`), fallback `npcs[socialIndex % npcs.length]` quando o local não tem occupant; `skill` continua `[]`.
- **`generateClosing` ganha `encounterSkeleton`/`encounterSituations` — não é função nova, é o MESMO contrato que a US-181 já estende com `antagonist`.** Entrada: `encounterSkeleton`, o esqueleto já decidido dos 8 encontros (`id`, `type`, a `AdventureLocation` referenciada, os `AdventureNpc` referenciados por `npcIds`). Saída: `encounterSituations`, array de exatamente 8 `{ behaviors, goal, complications }`, POSICIONAL — o modelo nunca inventa `id`. Schema de saída usa `.length(8)`; contagem errada é falha dura (reseed via US-150). O `system` da chamada instrui O ÚLTIMO item do esqueleto (posição 8, sempre `combat`) de forma DIFERENTE dos outros 7: é o confronto final, `behaviors`/`goal`/`complications` DEVEM ecoar `antagonist.want`/`method` diretamente — os outros 7 só PODEM entrelaçar `secrets`/`antagonist` quando fizer sentido pro local/tipo.
- **Continua dentro do `Promise.all([generateClosing, generateOpeningBeat])`** já existente em [adventure.service.ts:164-189](../../../apps/api/src/adventure/adventure.service.ts) — nada muda na forma como esse `Promise.all` é chamado, só o que `generateClosing` recebe/devolve cresce. `generateOpeningBeat` não é afetado. `encounterSkeleton` (type/locationId/npcIds já resolvidos) precisa estar pronto ANTES desse `Promise.all` rodar, então o loop de 8 encontros de US-164 continua vindo antes dele, só a etapa que faltava (`behaviors`/`goal`/`complications`) deixa de ser uma chamada à parte.
- `id` de cada `AdventureEncounter`: `encounter-1`..`encounter-8`.
- Gate (US-150), verificação 3: compara orçamento só nos encontros `type === 'combat'` — inalterado.
- `encounterNpcEntities` (US-171, [seed-ledger.ts:54-67](../../../apps/api/src/adventure-generation/seed-ledger.ts)) ganha filtro `encounter.type === 'combat'`. Sem ele, o `npcIds` do `social` (NPC de história, já semeado com `nome`/`revelado: true` correto por `npcEntities`) ganharia uma SEGUNDA `WorldEntity` errada pro mesmo NPC.
- `seedLedgerFromGeneratedAdventure` (US-170, `locationEntities`, [seed-ledger.ts:43-49](../../../apps/api/src/adventure-generation/seed-ledger.ts)): pra cada local, junta os encontros que o referenciam (todo `type` agora) e acrescenta ao `nota` já montado (`boxedText`+`aspects`) um segmento por encontro: `"{type} — objetivo: {goal}; comportamento: {behaviors}; complicação: {complications}"`, segmentos de encontros diferentes separados por `" | "`.
- Testes de regressão: 8 encontros gerados, tipo alternando sem repetição adjacente, posição 8 sempre `combat`; sequência de `type` muda entre `characterId`/`order` diferentes mas é estável pro mesmo par (`shuffleEncounterTypes`); `behaviors`/`goal`/`complications` presentes em todo encontro, encontro final referenciando `antagonist`; `locationId`/`npcIds` determinísticos; `seedLedgerFromGeneratedAdventure` inclui os três campos no `nota` do local certo.

### Fora do escopo

- **Perícia estruturada testada pelo encontro.** Removida do schema — qual perícia o jogador rola fica 100% emergente da ficção de `behaviors`/`goal`/`complications` no turno, tabela do SRD (US-110), sem sinal estruturado.
- **Variar o teste real rolado no turno / CD por encontro.** Quem decide qual d20 rolar continua sendo o modelo via tabela do SRD (US-110) no momento do turno; CD é outro dado do SRD (US-111), sem consumidor hoje.
- **Vínculo estrutural (`secretId`/`antagonistId`) entre encontro e segredo/antagonista.** `secrets`/`antagonist` entram como CONTEXTO de prompt pra `generateClosing` (ver *A proposta*), não como campo novo no schema do encontro — sobreposição fica na prosa (`goal`/`complications`), nunca vira referência por `id`. `AdventureSecretSchema`/`AdventureAntagonistSchema` (US-149/US-181) ficam intocados.
- **`generateClosing` receber `background`/`origin` do personagem pra ancorar as situações no vínculo pessoal** (mesmo padrão de `generateSecrets`/`generateOpeningBeat`). Não pedido em nenhum critério de aceite; `locations`/`npcs`/`secrets`/`registry`/`antagonist` já bastam. Candidato a somar depois se o eval mostrar situação genérica demais.
- **Antagonista virar NPC estruturado no `npcIds` do combate final.** Mesma decisão da US-181 (*Fora do escopo*, antagonista não é entidade rastreável) — o `npcIds` da posição 8 continua vindo de `composeEncounterRoles`/`buildEncounterNpcs` como qualquer outro `combat` (papéis genéricos Minion/Soldier/Brute); o vínculo com o antagonista é só narrativo, via `behaviors`/`goal`/`complications`.
- **Sortear TAMBÉM as posições 1-7 numa proporção diferente de `{combat×2, skill×3, social×2}`, ou tornar a proporção configurável.** Proporção herdada da sequência fixa anterior (3 combat/3 skill/2 social no total, 1 combat reservado pra posição 8) — sortear só a ORDEM, não a proporção, é a opção mais barata.
- **Escrever diálogo novo pro NPC do `social`, ou setar `interactions[].encounterId`.** `npcIds` referencia o NPC já gerado por `generateLocationsAndNpcs` (US-158) — `interactions[]` continua igual, escrito ANTES de o encontro existir. Reescrever depois custa mais que o ganho.
- **Priorizar o NPC amarrado a `background.bonds`** na escolha do `social`. `location.occupants` não distingue NPC comum de NPC de vínculo — enriquecimento de story futura.
- **Amarrar 8 (encontros OU locais) ao dial de NPCs de história da US-163, ou tornar N parametrizável.** Eixos diferentes; `N = 8` é constante fixa desta story, decidido — não preferência do jogador.
- **Tornar o piso de 8 locais escolhível pelo jogador, ou variar composição de papéis por encontro `combat`.** Requisito estrutural / `composeEncounterRoles` é pura por design (US-160).
- **Distribuição temática de `locationId`.** Round-robin é a opção barata.
- **Reabrir US-152/US-160/US-161.** Funções de combate usadas como estão.

---

## Modelo de dados proposto

```ts
// packages/shared/src/types/adventure-generation.ts
export const AdventureEncounterSchema = z.object({
  id: z.string().min(1),
  locationId: z.string().min(1),
  npcIds: z.array(z.string()),
  type: z.enum(['combat', 'skill', 'social']),
  // As 5 perguntas de "situação" (Sly Flourish): location=locationId, inhabitants=npcIds,
  // as 3 abaixo fecham o resto. Prosa curta escrita pelo modelo (US-114) — igual
  // boxedText/description (US-158), NUNCA pelo código. Presentes nos 8, `combat` incluso.
  behaviors: z.string().min(1),
  goal: z.string().min(1),
  complications: z.string().min(1),
})
```

```ts
// apps/api/src/adventure-generation/shuffle-encounter-types.ts (NOVO, US-166)
// Posição 8 sempre 'combat' (fixo, não sorteado — é o confronto final com o antagonista).
// Posições 1-7: shuffle seedado do multiset {combat×2, skill×3, social×2}, retry até não
// ter dois tipos iguais adjacentes (incluindo posição 7 vs. 8). Mesmo padrão de sub-seed
// de tableSeed (roll-content.ts): deriveAdventureSeed(`${characterId}:encounter-types`, order, attempt).
export function shuffleEncounterTypes(
  characterId: string,
  order: number,
  attempt?: number,
): Array<'combat' | 'skill' | 'social'> // length 8, [7] === 'combat'
```

```ts
// apps/api/src/ai/ai.service.ts — generateClosing (US-181 já acrescenta `antagonist`;
// esta story acrescenta `encounterSkeleton`/`encounterSituations` ao MESMO contrato,
// não cria função nova)
async generateClosing(params: {
  locations: AdventureLocation[]
  npcs: AdventureNpc[]
  secrets: AdventureSecret[]
  registry: AdventureRegistry
  complicacao: { condition: string; description: string; origin: string }
  premissa: string
  locale?: Locale
  encounterSkeleton: Array<{ // NOVO (US-166)
    id: string
    type: 'combat' | 'skill' | 'social'
    location: AdventureLocation
    npcs: AdventureNpc[] // resolvidos a partir de npcIds, [] se skill
  }>
}): Promise<{
  conclusion: string
  followUps: string[]
  antagonist: { name: string; want: string; method: string } // US-181
  encounterSituations: Array<{ behaviors: string; goal: string; complications: string }> // NOVO (US-166), posicional, length === encounterSkeleton.length
}>
```

```ts
// apps/api/src/ai/ai.service.ts — CLOSING_SCHEMA (US-181 já acrescenta `antagonist`;
// esta story acrescenta `encounterSituations`)
const CLOSING_SCHEMA = z.object({
  conclusion: z.string().min(1),
  followUps: z.array(z.string()).min(1),
  antagonist: z.object({
    name: z.string().min(1),
    want: z.string().min(1),
    method: z.string().min(1),
  }),
  encounterSituations: z.array(z.object({
    behaviors: z.string().min(1),
    goal: z.string().min(1),
    complications: z.string().min(1),
  })).length(8),
})
```

---

## Critérios de aceite

- [ ] `generateAdventure` produz exatamente 8 `AdventureEncounter`.
- [ ] `type` dos 8 encontros: posição 8 sempre `combat`; posições 1-7 são o multiset `{combat×2, skill×3, social×2}` embaralhado, sem dois tipos iguais adjacentes (nem entre posição 7 e 8).
- [ ] Encontro da posição 8: `behaviors`/`goal`/`complications` referenciam `antagonist.want`/`method` diretamente — não é opcional como nos outros 7.
- [ ] `behaviors`, `goal` e `complications` presentes (não-vazios) em TODO encontro, incluindo `combat`.
- [ ] `locationId` de cada encontro referencia uma location real, distribuído round-robin.
- [ ] `npcIds` não-vazio e válido (referencia `npcs[]` existente) em `combat` (ids novos, sem colisão) e em `social` (`location.occupants` ou fallback round-robin); vazio em `skill`.
- [ ] `seedLedgerFromGeneratedAdventure`: `encounterNpcEntities` só gera `WorldEntity` pra encontros `type === 'combat'` — NPC de história referenciado por `social` não duplica no ledger (a entrada certa, `revelado: true`, já vem de `npcEntities`).
- [ ] Mesmo `characterId`+`order` produz a mesma sequência de `type`/`locationId`/`npcIds` (parte determinística, 100% código, inclui o sorteio de `shuffleEncounterTypes`); personagens/aventuras diferentes produzem sequências de `type` diferentes. `behaviors`/`goal`/`complications` são prosa do modelo — mesma disciplina de não-determinismo que `boxedText`/`description` dos locais já têm (US-158); **não** é critério exigir prosa idêntica entre execuções.
- [ ] Gate (US-150), verificação 3: compara orçamento só nos encontros `type === 'combat'`; `skill`/`social` não reprovam por ausência de orçamento.
- [ ] `seedLedgerFromGeneratedAdventure`: `nota` do local que hospeda QUALQUER encontro inclui `"{type} — objetivo: {goal}; comportamento: {behaviors}; complicação: {complications}"`, segmentos separados por `" | "`; local sem encontro fica igual ao que a US-170 já produz.
- [ ] `generateClosing` devolve `encounterSituations` com exatamente `encounterSkeleton.length` (8) itens — contagem errada falha o `parse()`, motivo de reseed (US-150).
- [ ] `GeneratedAdventureSchema.parse()` passa com o schema novo.
- [ ] `pnpm typecheck` e testes do módulo passam.
- [ ] **Eval / teste de regressão:** fixture com locations/npcs geradas → `generateAdventure` monta os 8 encontros válidos, `.parse()` passa, sem `npcId`/`id` duplicado.

---

## Notas de implementação

- **`shuffleEncounterTypes` usa sub-seed próprio** (`deriveAdventureSeed(`${characterId}:encounter-types`, order, attempt)`, mesmo padrão de `tableSeed` em `roll-content.ts`) — não compartilha stream com nenhuma outra rolagem, sortear mais ou menos posições no futuro não desloca sequência de outro campo. Retry (mesma família de seed, contador local incrementado a cada tentativa rejeitada, teto pequeno tipo 20) até achar um shuffle das posições 1-7 sem dois tipos iguais adjacentes nem `combat` na posição 7.
- **Posição 8 nunca entra no shuffle** — é atribuída `combat` direto, fora do array embaralhado. Simplifica a condição de parada do retry (só precisa checar posições 1-7 entre si + posição 7 contra a constante `combat`, não contra um valor também sorteado).
- **Nível 1-3 em modo `'adventure'` (US-160) devolve `roles: []`** pra `composeEncounterRoles` — os 3 slots `combat` podem nascer sem monstro, resultado correto herdado da US-160. `behaviors`/`goal`/`complications` ainda existem (o modelo escreve "ameaça evitada"/"tensão sem luta") — situação sem `npcIds`, não encontro vazio.
- **`buildEncounterNpcs` assume `existingNpcs` cumulativo** — passar só os NPCs mintados até aquele ponto, nunca resetar entre slots `combat`.
- **Fallback de `social` sem occupant usa contador próprio (`socialIndex`)**, incrementa só nos 2 slots `social`. Com `npcs.length === 0` (defensivo) o encontro nasce com `npcIds: []`.
- **`encounterSkeleton` precisa estar pronto ANTES de `generateClosing` ser chamado** — `type`/`locationId`/`npcIds` dos 8 encontros são todos código determinístico (shuffle + round-robin + composer), então continuam vindo primeiro. Ordem final em `generateAdventure`: rollAdventure → generateLocationsAndNpcs → generateSecrets → monta `encounterSkeleton` (`type`/`locationId`/`npcIds`) → `Promise.all([generateClosing(..., encounterSkeleton), generateOpeningBeat])` → junta `encounterSkeleton` com `encounterSituations` da resposta → `encounters[]` final.
- **`generateClosing` ganha campo, não vira função nova — mesmo padrão que a US-181 já usa pra `antagonist`.** O corpo da função ([ai.service.ts:1490-1518](../../../apps/api/src/ai/ai.service.ts)) já faz `generateObject` com `CRAFT_CORE_SECTION`/`ENGINE_PROVIDER_OPTIONS`/`NUNCA captura erro` — esta story só soma `encounterSkeleton` ao `prompt` (via `buildClosingPrompt`) e `encounterSituations` ao destructure de retorno (`object.encounterSituations`), igual a US-181 soma `object.antagonist`.
- **`combat` mantém segmento no `nota` do local** (decisão fechada, ver *Atualizada em (5)*) — é o que carrega o payoff do confronto final pro Mestre; cortar só `skill`/`social` esvaziaria justo a posição 8.
- **`CRAFT_CORE_SECTION` reusado verbatim pra `encounterSituations`, sem seção própria** (decisão fechada) — barra de qualidade igual ao resto da prosa do motor; seção dedicada (ex. insistir em complicação concreta) só entra se o eval acusar prosa genérica.
- **Teto de retry do `shuffleEncounterTypes` fica em ~20** (decisão fechada) — espaço de shuffles válidos pra `{combat×2, skill×3, social×2}` em 7 posições é grande o bastante, não precisa provar antes de escrever.
- **Local sem NENHUM encontro só ocorre se o modelo entregar MAIS de 8 locais** apesar da instrução de piso — com `locations.length <= 8`, o round-robin `i % locations.length` cobre toda posição pelo menos uma vez.

---

## Referências no código

- [`apps/api/src/adventure/adventure.service.ts:131-204`](../../../apps/api/src/adventure/adventure.service.ts) — `generateAdventure` (US-164); linhas 158-162 são o loop de 1 elemento a virar 8 (constrói `encounterSkeleton`); linhas 164-189 são o `Promise.all` que passa a levar `encounterSkeleton` pra `generateClosing` e recebe `encounterSituations` de volta.
- [US-181](./US-181-antagonista-ganha-want-e-method-estruturados.md) — `antagonist: {name, want, method}`, mesmo `generateClosing` que esta story estende junto.
- [US-149](./US-149-segredos-40-prompts-lgmrd.md) — `generateSecrets`; `secrets[]` já é parâmetro de `generateClosing` DESDE ANTES desta story (usado pra `conclusion`) — nenhuma plumbing nova, só reuso do que já chega.
- [`apps/api/src/adventure-generation/monster-roles.ts`](../../../apps/api/src/adventure-generation/monster-roles.ts) — `composeEncounterRoles`/`buildEncounterNpcs`, chamadas só nos slots `combat`.
- [`packages/shared/src/adventure-seed.ts`](../../../packages/shared/src/adventure-seed.ts) — `deriveAdventureSeed`/`createSeededRandom` (US-146), reusados por `shuffleEncounterTypes` (NOVA função desta story).
- [`apps/api/src/adventure-generation/roll-content.ts:30-32`](../../../apps/api/src/adventure-generation/roll-content.ts) — `tableSeed`, o padrão de sub-seed-por-propósito que `shuffleEncounterTypes` copia.
- [`packages/shared/src/types/adventure-generation.ts`](../../../packages/shared/src/types/adventure-generation.ts) — `AdventureEncounterSchema`, ganha `behaviors`/`goal`/`complications`.
- [`apps/api/src/ai/ai.service.ts:1490-1518`](../../../apps/api/src/ai/ai.service.ts) — `generateClosing`, a função que esta story estende (junto da US-181) — corpo (`generateObject`, `CRAFT_CORE_SECTION`, `NUNCA captura erro`) não muda de padrão.
- [`apps/api/src/ai/ai.service.ts:104-116,1416-1421`](../../../apps/api/src/ai/ai.service.ts) — `occupants` como índice/`id` real de `npcs[]` (US-158); fonte do `npcIds` de `social`.
- [`apps/api/src/ai/ai.service.ts:124-135`](../../../apps/api/src/ai/ai.service.ts) — `buildLocationsAndNpcsPrompt`, precedente de instrução de quantidade-alvo que esta story espelha pra locais.
- [`apps/api/src/adventure-generation/seed-ledger.ts:16-70`](../../../apps/api/src/adventure-generation/seed-ledger.ts) — `seedLedgerFromGeneratedAdventure`: `locationEntities` (US-170, linhas 43-49) ganha os 3 campos no `nota`; `encounterNpcEntities` (US-171, linhas 54-67) ganha filtro `type === 'combat'`.
- [US-164](./US-164-orquestrador-motor-monta-aventura-gerada.md) · [US-150](./US-150-gate-antes-de-persistir-aventura-gerada.md) · [US-158](./US-158-locais-npcs-prosa-motor.md) · [US-163](./US-163-jogador-escolhe-tamanho-da-aventura.md) · [US-170](./US-170-locais-gerados-entram-no-ledger.md) · [US-171](./US-171-encontros-de-combate-entram-no-ledger.md) · [US-114](./US-114-modelo-utilitario-para-extracao-e-fecho.md) — stories relacionadas, ver *Depende de*/*Relacionado*.
- [Backlog — Motor de geração de aventuras one-shot §Ordem de geração](./backlog-motor-de-geracao-de-aventuras.md) — passo 5, intenção original que esta story substitui.

### Referências externas

- [Sly Flourish — Building Situations](https://slyflourish.com/building_situations.html) — framework Location/Inhabitants/Behaviors/Goal/Complications; núcleo do redesign — as 5 perguntas viraram os campos do encontro.
- [Sly Flourish — Anatomy of a Situation: Castle Orzelbirg](https://slyflourish.com/anatomy_of_a_situation_castle_orzelbirg.html) — exemplo aplicado; base do formato de `behaviors`/`goal`/`complications` como prosa curta e concreta.
- [Sly Flourish — Running Investigations and Mysteries](https://slyflourish.com/running_investigations_and_mysteries.html) — "build situations, not mystery novels": um `goal`+`complications` bem escritos já convidam mais de uma abordagem, sem precisar de campo estruturado de perícia.
- [Sly Flourish — Situation Checklist](https://slyflourish.com/situation_checklist.html) — checklist Location/Inhabitants/Behaviors/Goal/Complications; é a tabela em *A proposta*.
