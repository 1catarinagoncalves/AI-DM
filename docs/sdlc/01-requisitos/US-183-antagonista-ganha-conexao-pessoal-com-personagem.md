# US-183 — Antagonista ganha conexão pessoal com o personagem no artefato gerado

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada (22/08/2026). `pnpm typecheck` + `pnpm test` (shared 128, ai-engine 148, web 119, api 361) + `pnpm eval` (67 passam, 2 skipped pré-existentes) — todos verdes.
**Depende de:** [US-181](./US-181-antagonista-ganha-want-e-method-estruturados.md) (`antagonist: { name, want, method, trait, weakness }` — esta story soma o quinto campo ao MESMO objeto, não recria a estrutura) · [US-180](./US-180-abertura-ignora-vinculos-do-personagem.md) (`characterAnchors`, função pura já extraída em [ai.service.ts:225-233](../../../apps/api/src/ai/ai.service.ts) — esta story REUSA, não reimplementa)
**Relacionado:** [US-169](./US-169-quest-gerada-ganha-objetivo-e-conclusao-acionavel.md) (`objective`, ainda não implementada — quando implementada, `connection` é outro insumo que pode citar, além de `want`/`method`/`weakness`) · [US-153, Questão em aberto #4](./US-153-aventura-deixa-de-ser-derivada-da-classe.md) (disciplina "`conclusion` não vaza antes de merecer" — mesma cautela vale pro campo novo) · [US-190](./US-190-antagonista-vira-passo-proprio-entre-segredos-e-encontros.md) (~~**move ONDE `connection` é sintetizada**~~ — **JÁ MOVEU** (22/08/2026): a US-181 implementou direto no formato do US-190, `generateAntagonist` já existe como chamada própria. Esta story não precisa mais "mover" nada — só soma `connection`/`background`/`origin` à chamada que já está no lugar certo)
**Criada em:** 2026-08-21 — desmembrada da [US-181](./US-181-antagonista-ganha-want-e-method-estruturados.md) durante leitura de material de design de vilões de RPG trazido pela mantenedora: o eixo "conexão pessoal com o herói" aparece em praticamente toda a literatura (RJD20, MonkeyDM, TheGamer, Foe Foundry) como o que mais eleva investimento do jogador — mas, diferente de `trait`/`weakness` (que a US-181 absorveu), este eixo pede insumo novo (`characterAnchors`) em `generateClosing`, o que a US-181 deliberadamente não faz. Virou story própria em vez de forçar dentro da US-181.

---

## História

> **Como** jogadora,
> **quero** que o antagonista gerado tenha uma conexão com a MINHA personagem — não só motivo/método genéricos —,
> **para que** o confronto final pareça pessoal, não um vilão que existiria idêntico em qualquer mesa.

---

## Contexto e motivação

### O que existe hoje

> **Atualizado 22/08/2026:** parágrafo original (abaixo) dizia que a US-181 estruturava
> `antagonist` dentro de `generateClosing` — não foi assim que saiu implementada.

A [US-181](./US-181-antagonista-ganha-want-e-method-estruturados.md) estrutura `antagonist: { name, want, method, trait, weakness }` em `generateAntagonist` — chamada PRÓPRIA ([ai.service.ts:1518-1553](../../../apps/api/src/ai/ai.service.ts)), não dentro de `generateClosing` — ancorado só em `premissa`/`complicacao`/`locations`/`npcs`/`secrets` — deliberadamente **sem** insumo de personagem. `characterAnchors` ([ai.service.ts:225-233](../../../apps/api/src/ai/ai.service.ts)) já existe como função pura — lista `background.story`/`origin.adventuresAndAdvancement` — e já é consumida por `generateSecrets` (US-149) e `generateOpeningBeat` (US-180). `generateAntagonist` não a recebe (nem `generateClosing`, que também não recebe `background`/`origin` — nunca chegou a precisar, porque nunca sintetizou `antagonist`).

### O problema

Um antagonista pode ter `want`/`method`/`trait`/`weakness` plenamente coerentes com a aventura e ainda ser intercambiável entre qualquer personagem que jogasse a mesma `premissa` — nada no artefato liga o vilão à história PARTICULAR de quem está jogando. É exatamente o eixo que RJD20 chama de "connection to the party" e TheGamer de "mirror PC problems": o que faz o jogador se importar além de "esse NPC é o vilão da vez".

### Por que a solução atual não basta

`generateOpeningBeat` já resolve esse problema pro INÍCIO da aventura (US-180, `anchorInstruction`). Nem `generateClosing` nem `generateAntagonist` (o passo que hoje decide o antagonista) tem o equivalente — o antagonista nasce sem saber que `characterAnchors` existe, mesmo a função já estando extraída e pronta pra reuso.

### A proposta

> **Atualizado 22/08/2026:** parágrafo original (abaixo) mirava `generateClosing`, porque
> na hora em que esta story foi escrita `generateClosing` ainda sintetizava `antagonist`
> (plano original da US-181). Depois disso, US-181 implementou no formato do US-190:
> `generateAntagonist`, chamada própria, é quem decide `antagonist` — é ELA que precisa
> ganhar `background`/`origin`, não `generateClosing` (que só consome `antagonist` pronto e
> nunca teve motivo pra receber os dois). Texto original abaixo trocando só o alvo.

`generateAntagonist` passa a receber `background`/`origin` — mesmos dois campos que `generateOpeningBeat`/`generateSecrets` já recebem, já disponíveis em `adventure.service.ts` no ponto em que `generateAntagonist` é chamado ([adventure.service.ts:170-183](../../../apps/api/src/adventure/adventure.service.ts), sequencial, antes do `Promise.all`) — e reusa `characterAnchors(params)` pra montar uma instrução de conexão, mesmo padrão do `anchorInstruction` de `generateOpeningBeat`. `antagonist` ganha `connection: string` — como o antagonista se relaciona (ainda que indiretamente) com o vínculo pessoal da personagem, quando existir; sem vínculo registrado, descreve uma conexão mais genérica ancorada só em `locations`/`npcs`/`secrets` (mesmo fallback que `anchorInstruction` já usa).

---

## Escopo

### Dentro do escopo

> **Retargeting 22/08/2026:** todo `generateClosing`/`CLOSING_SCHEMA` abaixo lê-se
> `generateAntagonist`/`ANTAGONIST_SCHEMA` — ver nota em *A proposta*.

- `generateAntagonist` ([ai.service.ts:1518](../../../apps/api/src/ai/ai.service.ts)) ganha os parâmetros `background?: CharacterBackground` e `origin?: { adventuresAndAdvancement?: string }` — mesma forma que `generateOpeningBeat`/`generateSecrets` já recebem.
- `generateAntagonist` chama `characterAnchors(params)` (função já existente, sem duplicar) e monta uma instrução de conexão — mesmo padrão condicional do `anchorInstruction` de `generateOpeningBeat` ([ai.service.ts:1626](../../../apps/api/src/ai/ai.service.ts), checado em 22/08/2026): com âncora, prefere ligar o antagonista a ela; sem âncora, cai pra conexão genérica ancorada em `locations`/`npcs`/`secrets`.
- `ANTAGONIST_SCHEMA` ganha `connection: z.string().min(1)`.
- `GeneratedAdventureSchema`/`AdventureAntagonistSchema` (US-144, `adventure-generation.ts`) ganham o campo `connection`, mesma forma.
- `adventure.service.ts`: a chamada a `generateAntagonist` (sequencial, antes do `Promise.all` — [adventure.service.ts:170-183](../../../apps/api/src/adventure/adventure.service.ts)) passa `background: profile.background, origin: profile.origin` — os mesmos dois campos já passados à chamada de `generateOpeningBeat` no `Promise.all` logo abaixo, sem buscar dado novo. `generateClosing` não precisa dos dois — continua só consumindo `antagonist` já pronto.
- Teste de regressão: fixture com `background.story`/`origin.adventuresAndAdvancement` preenchidos → `generateAntagonist` recebe os dois; fixture sem nenhum dos dois → `antagonist.connection` ainda não vazio (fallback genérico); artefato final (`GeneratedAdventureSchema.parse`) tem `antagonist.connection` nos dois casos.

### Fora do escopo

- **`bonds`/`flaws`/`deity`/`origin.connection`/`origin.memento` como insumo.** Mesma exclusão que `characterAnchors` já fixa no comentário ([ai.service.ts:222-224](../../../apps/api/src/ai/ai.service.ts)): motor de geração só consome `story`/`adventuresAndAdvancement`, resto serve só narração de turno ao vivo. Esta story reusa `characterAnchors` como está — não expande o que a função lê.
- **Antagonista como entidade rastreável / exposição no ledger.** Mesmas exclusões da US-181 (Fora do escopo), não revisitadas aqui.
- **Implementar `objective` (US-169).** Só deixa `antagonist.connection` disponível como insumo melhor.
- **Mudar `generateOpeningBeat`/`anchorInstruction`.** Esta story só estende `generateAntagonist` pro MESMO padrão que já existe em `generateOpeningBeat` — não toca a implementação existente.
- **Somar `antagonist` como parâmetro de `generateOpeningBeat`** (US-190, item ainda não implementado — ver [US-190](./US-190-antagonista-vira-passo-proprio-entre-segredos-e-encontros.md)). Story diferente; esta aqui só soma `connection` ao objeto `antagonist` em si.

---

## Modelo de dados proposto

```ts
// packages/shared/src/types/adventure-generation.ts
export const AdventureAntagonistSchema = z.object({
  name: z.string().min(1),
  want: z.string().min(1),
  method: z.string().min(1),
  trait: z.string().min(1),
  weakness: z.string().min(1),
  connection: z.string().min(1), // como se relaciona com o vínculo pessoal da personagem (ou conexão genérica, se não houver vínculo)
})
```

```ts
// apps/api/src/ai/ai.service.ts — generateAntagonist (retargeting 22/08/2026 — era generateClosing no plano original)
async generateAntagonist(params: {
  locations: AdventureLocation[]
  npcs: AdventureNpc[]
  secrets: AdventureSecret[]
  registry: AdventureRegistry
  complicacao: { condition: string; description: string; origin: string }
  premissa: string
  background?: CharacterBackground // novo — igual generateOpeningBeat/generateSecrets
  origin?: { adventuresAndAdvancement?: string } // novo — igual generateOpeningBeat/generateSecrets
  locale?: Locale
}): Promise<AdventureAntagonist> // já inclui connection — generateClosing não muda de assinatura
```

---

## Critérios de aceite

- [x] `generateAntagonist` aceita `background`/`origin`, mesma forma que `generateOpeningBeat`/`generateSecrets`.
- [x] `ANTAGONIST_SCHEMA` exige `connection`, string não vazia.
- [x] `system` de `generateAntagonist` usa `characterAnchors(params)` (reuso, sem duplicar a função) pra instruir a conexão — com âncora, prefere ligar a ela; sem âncora, cai pro fallback genérico.
- [x] `GeneratedAdventureSchema.parse` exige `antagonist.connection` — falha o gate (US-150) se ausente.
- [x] `adventure.service.ts` passa `background`/`origin` na chamada de `generateAntagonist` (sequencial, antes do `Promise.all`), mesmos valores já passados a `generateOpeningBeat`. `generateClosing` não muda.
- [x] **Teste de regressão:** fixture COM âncora (`background.story` ou `origin.adventuresAndAdvancement` preenchido) e fixture SEM nenhuma âncora → `antagonist.connection` não vazio nos dois casos; `.parse()` passa.
- [x] `pnpm typecheck` e `pnpm test` passam.
- [x] `pnpm eval` passa (mudança de prompt do motor de geração).

---

## Notas de implementação

- **Retargeting (22/08/2026):** pontos exatos ATUALIZADOS — [ai.service.ts:225-233](../../../apps/api/src/ai/ai.service.ts) (`characterAnchors`, reusar), [ai.service.ts:1518-1553](../../../apps/api/src/ai/ai.service.ts) (`generateAntagonist`, ganha parâmetros e instrução — NÃO `generateClosing`, que não sintetiza `antagonist` desde que a US-181 foi implementada no formato US-190), [ai.service.ts:1626](../../../apps/api/src/ai/ai.service.ts) (`anchorInstruction` de `generateOpeningBeat`, molde de redação condicional a seguir), [adventure.service.ts:170-183](../../../apps/api/src/adventure/adventure.service.ts) (chamada a `generateAntagonist`, sequencial antes do `Promise.all`, a estender).
- `connection` é frase curta (1 sentença), mesmo formato direto de `want`/`method`/`trait`/`weakness` — não vira bloco de backstory longo.
- `connection` **não** é convite a `generateClosing` citar `bonds` ou revelar prematuramente vínculo que `conclusion` deveria dosar — mesma disciplina "`conclusion` não vaza antes de merecer" (US-153 #4) que já protege o resto do fecho.
- Sem âncora registrada, `connection` descreve algo mais frio (ex. "atua na região que a personagem já percorreu nesta aventura") — nunca campo vazio ou "N/A", mesma disciplina de robustez que `want`/`method`/`trait`/`weakness` já adotam (US-181).

---

## Questões em aberto

1. Quando existe âncora, `connection` deve SEMPRE usá-la, ou só quando fizer sentido com `premissa`/`complicacao`? Decisão sugerida: mesmo texto condicional de `anchorInstruction` ("prefira ancorar... quando fizer sentido") — não forçar conexão artificial numa aventura onde o vínculo não tem nada a ver com o antagonista. Não travado, ajuste de prompt se o eval acusar conexões forçadas.
2. ~~`connection` deveria também poder citar um `secret` insinuado (ex. o antagonista SABE do vínculo mas o personagem não sabe que ele sabe)?~~ **Decidido (2026-08-21): não, não nesta story.** Motivo: aumenta a superfície da instrução por uma variante específica sem evidência de que a versão simples (só `characterAnchors`) produza `connection` genérica — decidir a favor de um refinamento antes de ver o problema real é o mesmo erro que a US-181 (Questão #3, taxonomia de `trait`/`weakness`) evitou de propósito. Fica fechada como NÃO agora, reabrir só se `pnpm eval`/produção mostrar `connection` sistematicamente rasa (ex. "atua na mesma região", sem nada específico do vínculo) — nesse caso a story de refinamento cita este documento como ponto de partida, não reabre esta questão.

---

## Referências no código

> Atualizado 22/08/2026 pro alvo real (`generateAntagonist`, não `generateClosing` — ver *Status*).

- [apps/api/src/ai/ai.service.ts:225-233](../../../apps/api/src/ai/ai.service.ts) — `characterAnchors`, função pura a reusar.
- [apps/api/src/ai/ai.service.ts:240](../../../apps/api/src/ai/ai.service.ts) — `ANTAGONIST_SCHEMA`, a estender com `connection`.
- [apps/api/src/ai/ai.service.ts:1518-1553](../../../apps/api/src/ai/ai.service.ts) — `generateAntagonist`, a estender (ganha `background`/`origin` + instrução de conexão).
- [apps/api/src/ai/ai.service.ts:1560-1596](../../../apps/api/src/ai/ai.service.ts) — `generateClosing`, NÃO muda (já recebe `antagonist` pronto desde a US-181; nunca sintetizou `connection`).
- [apps/api/src/ai/ai.service.ts:1600-1655](../../../apps/api/src/ai/ai.service.ts) — `generateOpeningBeat`, molde do padrão `anchorInstruction` a replicar (linha exata: 1626).
- [apps/api/src/adventure/adventure.service.ts:170-183](../../../apps/api/src/adventure/adventure.service.ts) — `generateAdventure`, chamada a `generateAntagonist` (sequencial, antes do `Promise.all`) a estender com `background`/`origin`.
- [packages/shared/src/types/adventure-generation.ts](../../../packages/shared/src/types/adventure-generation.ts) — `AdventureAntagonistSchema`, ganha `connection`.
- [US-181](./US-181-antagonista-ganha-want-e-method-estruturados.md) — story-mãe, cria `antagonist`/`want`/`method`/`trait`/`weakness` (implementada 22/08/2026, já no formato US-190); esta story soma o quinto campo.
- [US-190](./US-190-antagonista-vira-passo-proprio-entre-segredos-e-encontros.md) — a "chamada própria" que esta story mirava como movimento futuro JÁ EXISTE (parte do escopo do US-190 chegou via US-181); esta story só precisa somar `connection`/`background`/`origin` a ela.
- [US-180](./US-180-abertura-ignora-vinculos-do-personagem.md) — origem de `characterAnchors` e do padrão `anchorInstruction` reusado aqui.
- Artigo-fonte: [*Villains Die*](https://www.rjd20.com/2021/01/villains-die.html) (rjd20.com, 2021) — "connection to the party" como um dos quatro eixos de vilão memorável; [*8 Steps to Building a D&D Villain*](https://www.thegamer.com/dungeons-and-dragons-dnd-sympathetic-villain-creation-tips/) (thegamer.com) — "mirror PC problems" como o que mais eleva empatia/investimento do jogador.
