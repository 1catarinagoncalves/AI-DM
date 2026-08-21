# US-183 — Antagonista ganha conexão pessoal com o personagem no artefato gerado

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** [US-181](./US-181-antagonista-ganha-want-e-method-estruturados.md) (`antagonist: { name, want, method, trait, weakness }` — esta story soma o quinto campo ao MESMO objeto, não recria a estrutura) · [US-180](./US-180-abertura-ignora-vinculos-do-personagem.md) (`characterAnchors`, função pura já extraída em [ai.service.ts:225-233](../../../apps/api/src/ai/ai.service.ts) — esta story REUSA, não reimplementa)
**Relacionado:** [US-169](./US-169-quest-gerada-ganha-objetivo-e-conclusao-acionavel.md) (`objective`, ainda não implementada — quando implementada, `connection` é outro insumo que pode citar, além de `want`/`method`/`weakness`) · [US-153, Questão em aberto #4](./US-153-aventura-deixa-de-ser-derivada-da-classe.md) (disciplina "`conclusion` não vaza antes de merecer" — mesma cautela vale pro campo novo)
**Criada em:** 2026-08-21 — desmembrada da [US-181](./US-181-antagonista-ganha-want-e-method-estruturados.md) durante leitura de material de design de vilões de RPG trazido pela mantenedora: o eixo "conexão pessoal com o herói" aparece em praticamente toda a literatura (RJD20, MonkeyDM, TheGamer, Foe Foundry) como o que mais eleva investimento do jogador — mas, diferente de `trait`/`weakness` (que a US-181 absorveu), este eixo pede insumo novo (`characterAnchors`) em `generateClosing`, o que a US-181 deliberadamente não faz. Virou story própria em vez de forçar dentro da US-181.

---

## História

> **Como** jogadora,
> **quero** que o antagonista gerado tenha uma conexão com a MINHA personagem — não só motivo/método genéricos —,
> **para que** o confronto final pareça pessoal, não um vilão que existiria idêntico em qualquer mesa.

---

## Contexto e motivação

### O que existe hoje

A [US-181](./US-181-antagonista-ganha-want-e-method-estruturados.md) estrutura `antagonist: { name, want, method, trait, weakness }` em `generateClosing`, ancorado só em `premissa`/`complicacao`/`locations`/`npcs`/`secrets` — deliberadamente **sem** insumo de personagem. `characterAnchors` ([ai.service.ts:225-233](../../../apps/api/src/ai/ai.service.ts)) já existe como função pura — lista `background.story`/`origin.adventuresAndAdvancement` — e já é consumida por `generateSecrets` (US-149) e `generateOpeningBeat` (US-180). `generateClosing` não a recebe.

### O problema

Um antagonista pode ter `want`/`method`/`trait`/`weakness` plenamente coerentes com a aventura e ainda ser intercambiável entre qualquer personagem que jogasse a mesma `premissa` — nada no artefato liga o vilão à história PARTICULAR de quem está jogando. É exatamente o eixo que RJD20 chama de "connection to the party" e TheGamer de "mirror PC problems": o que faz o jogador se importar além de "esse NPC é o vilão da vez".

### Por que a solução atual não basta

`generateOpeningBeat` já resolve esse problema pro INÍCIO da aventura (US-180, `anchorInstruction`). O fecho (`generateClosing`) não tem o equivalente — o antagonista nasce sem saber que `characterAnchors` existe, mesmo a função já estando extraída e pronta pra reuso.

### A proposta

`generateClosing` passa a receber os MESMOS `background`/`origin` que `generateOpeningBeat` já recebe (ambos já disponíveis em `adventure.service.ts`, no mesmo `Promise.all` — [adventure.service.ts:168-189](../../../apps/api/src/adventure/adventure.service.ts)) e reusa `characterAnchors(params)` pra montar uma instrução de conexão, mesmo padrão do `anchorInstruction` de `generateOpeningBeat`. `antagonist` ganha `connection: string` — como o antagonista se relaciona (ainda que indiretamente) com o vínculo pessoal da personagem, quando existir; sem vínculo registrado, descreve uma conexão mais genérica ancorada só em `locations`/`npcs`/`secrets` (mesmo fallback que `anchorInstruction` já usa).

---

## Escopo

### Dentro do escopo

- `generateClosing` ([ai.service.ts:1490](../../../apps/api/src/ai/ai.service.ts)) ganha os parâmetros `background?: CharacterBackground` e `origin?: { adventuresAndAdvancement?: string }` — mesma forma que `generateOpeningBeat` já recebe.
- `generateClosing` chama `characterAnchors(params)` (função já existente, sem duplicar) e monta uma instrução de conexão — mesmo padrão condicional do `anchorInstruction` de `generateOpeningBeat` ([ai.service.ts:1550-1553](../../../apps/api/src/ai/ai.service.ts)): com âncora, prefere ligar o antagonista a ela; sem âncora, cai pra conexão genérica ancorada em `locations`/`npcs`/`secrets`.
- `CLOSING_SCHEMA` ganha `antagonist.connection: z.string().min(1)`.
- `GeneratedAdventureSchema`/`AdventureAntagonistSchema` (US-144, `adventure-generation.ts`) ganham o campo `connection`, mesma forma.
- `adventure.service.ts`: a chamada a `generateClosing` dentro do `Promise.all` ([adventure.service.ts:168-177](../../../apps/api/src/adventure/adventure.service.ts)) passa `background: profile.background, origin: profile.origin` — os mesmos dois campos já passados à chamada de `generateOpeningBeat` logo abaixo, sem buscar dado novo.
- Teste de regressão: fixture com `background.story`/`origin.adventuresAndAdvancement` preenchidos → `generateClosing` recebe os dois; fixture sem nenhum dos dois → `antagonist.connection` ainda não vazio (fallback genérico); artefato final (`GeneratedAdventureSchema.parse`) tem `antagonist.connection` nos dois casos.

### Fora do escopo

- **`bonds`/`flaws`/`deity`/`origin.connection`/`origin.memento` como insumo.** Mesma exclusão que `characterAnchors` já fixa no comentário ([ai.service.ts:222-224](../../../apps/api/src/ai/ai.service.ts)): motor de geração só consome `story`/`adventuresAndAdvancement`, resto serve só narração de turno ao vivo. Esta story reusa `characterAnchors` como está — não expande o que a função lê.
- **Antagonista como entidade rastreável / exposição no ledger.** Mesmas exclusões da US-181 (Fora do escopo), não revisitadas aqui.
- **Implementar `objective` (US-169).** Só deixa `antagonist.connection` disponível como insumo melhor.
- **Mudar `generateOpeningBeat`/`anchorInstruction`.** Esta story só estende `generateClosing` pro MESMO padrão que já existe lá — não toca a implementação existente.

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
// apps/api/src/ai/ai.service.ts — generateClosing
async generateClosing(params: {
  locations: AdventureLocation[]
  npcs: AdventureNpc[]
  secrets: AdventureSecret[]
  registry: AdventureRegistry
  complicacao: { condition: string; description: string; origin: string }
  premissa: string
  background?: CharacterBackground // novo — igual generateOpeningBeat
  origin?: { adventuresAndAdvancement?: string } // novo — igual generateOpeningBeat
  locale?: Locale
}): Promise<{ conclusion: string; followUps: string[]; antagonist: AdventureAntagonist }>
```

---

## Critérios de aceite

- [ ] `generateClosing` aceita `background`/`origin`, mesma forma que `generateOpeningBeat`.
- [ ] `CLOSING_SCHEMA` exige `antagonist.connection`, string não vazia.
- [ ] `system` de `generateClosing` usa `characterAnchors(params)` (reuso, sem duplicar a função) pra instruir a conexão — com âncora, prefere ligar a ela; sem âncora, cai pro fallback genérico.
- [ ] `GeneratedAdventureSchema.parse` exige `antagonist.connection` — falha o gate (US-150) se ausente.
- [ ] `adventure.service.ts` passa `background`/`origin` na chamada de `generateClosing`, mesmos valores já passados a `generateOpeningBeat`.
- [ ] **Teste de regressão:** fixture COM âncora (`background.story` ou `origin.adventuresAndAdvancement` preenchido) e fixture SEM nenhuma âncora → `antagonist.connection` não vazio nos dois casos; `.parse()` passa.
- [ ] `pnpm typecheck` e `pnpm test` passam.
- [ ] `pnpm eval` passa (mudança de prompt do motor de geração).

---

## Notas de implementação

- Pontos exatos: [ai.service.ts:225-233](../../../apps/api/src/ai/ai.service.ts) (`characterAnchors`, reusar), [ai.service.ts:1490-1518](../../../apps/api/src/ai/ai.service.ts) (`generateClosing`, ganha parâmetros e instrução), [ai.service.ts:1550-1553](../../../apps/api/src/ai/ai.service.ts) (`anchorInstruction` de `generateOpeningBeat`, molde de redação condicional a seguir), [adventure.service.ts:168-177](../../../apps/api/src/adventure/adventure.service.ts) (chamada a estender).
- `connection` é frase curta (1 sentença), mesmo formato direto de `want`/`method`/`trait`/`weakness` — não vira bloco de backstory longo.
- `connection` **não** é convite a `generateClosing` citar `bonds` ou revelar prematuramente vínculo que `conclusion` deveria dosar — mesma disciplina "`conclusion` não vaza antes de merecer" (US-153 #4) que já protege o resto do fecho.
- Sem âncora registrada, `connection` descreve algo mais frio (ex. "atua na região que a personagem já percorreu nesta aventura") — nunca campo vazio ou "N/A", mesma disciplina de robustez que `want`/`method`/`trait`/`weakness` já adotam (US-181).

---

## Questões em aberto

1. Quando existe âncora, `connection` deve SEMPRE usá-la, ou só quando fizer sentido com `premissa`/`complicacao`? Decisão sugerida: mesmo texto condicional de `anchorInstruction` ("prefira ancorar... quando fizer sentido") — não forçar conexão artificial numa aventura onde o vínculo não tem nada a ver com o antagonista. Não travado, ajuste de prompt se o eval acusar conexões forçadas.
2. ~~`connection` deveria também poder citar um `secret` insinuado (ex. o antagonista SABE do vínculo mas o personagem não sabe que ele sabe)?~~ **Decidido (2026-08-21): não, não nesta story.** Motivo: aumenta a superfície da instrução por uma variante específica sem evidência de que a versão simples (só `characterAnchors`) produza `connection` genérica — decidir a favor de um refinamento antes de ver o problema real é o mesmo erro que a US-181 (Questão #3, taxonomia de `trait`/`weakness`) evitou de propósito. Fica fechada como NÃO agora, reabrir só se `pnpm eval`/produção mostrar `connection` sistematicamente rasa (ex. "atua na mesma região", sem nada específico do vínculo) — nesse caso a story de refinamento cita este documento como ponto de partida, não reabre esta questão.

---

## Referências no código

- [apps/api/src/ai/ai.service.ts:225-233](../../../apps/api/src/ai/ai.service.ts) — `characterAnchors`, função pura a reusar.
- [apps/api/src/ai/ai.service.ts:1490-1518](../../../apps/api/src/ai/ai.service.ts) — `generateClosing`, a estender.
- [apps/api/src/ai/ai.service.ts:1539-1576](../../../apps/api/src/ai/ai.service.ts) — `generateOpeningBeat`, molde do padrão `anchorInstruction` a replicar.
- [apps/api/src/adventure/adventure.service.ts:168-189](../../../apps/api/src/adventure/adventure.service.ts) — `generateAdventure`, `Promise.all` a estender com `background`/`origin` na chamada de `generateClosing`.
- [packages/shared/src/types/adventure-generation.ts](../../../packages/shared/src/types/adventure-generation.ts) — `AdventureAntagonistSchema`, ganha `connection`.
- [US-181](./US-181-antagonista-ganha-want-e-method-estruturados.md) — story-mãe, cria `antagonist`/`want`/`method`/`trait`/`weakness`; esta story soma o quinto campo.
- [US-180](./US-180-abertura-ignora-vinculos-do-personagem.md) — origem de `characterAnchors` e do padrão `anchorInstruction` reusado aqui.
- Artigo-fonte: [*Villains Die*](https://www.rjd20.com/2021/01/villains-die.html) (rjd20.com, 2021) — "connection to the party" como um dos quatro eixos de vilão memorável; [*8 Steps to Building a D&D Villain*](https://www.thegamer.com/dungeons-and-dragons-dnd-sympathetic-villain-creation-tips/) (thegamer.com) — "mirror PC problems" como o que mais eleva empatia/investimento do jogador.
