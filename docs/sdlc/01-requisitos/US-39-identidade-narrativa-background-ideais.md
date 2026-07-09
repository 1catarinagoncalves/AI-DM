# US-39 — Identidade narrativa do personagem: background, ideais, vínculos e fraquezas

**Épico:** 3 — Narração e mecânica
**Fase:** 2 — Memória / continuidade espacial (Fase B)
**Status:** ✅ Implementada
**Depende de:** [US-23](./US-23-dm-ciente-da-ficha.md) (injeção de ficha dirigida por dados — o mecanismo) · [US-26](./US-26-criacao-personagem-em-etapas.md) (fluxo de criação que captura os campos)
**Bloqueia:** [US-17](./US-17-comparacao-modelos-eval.md) slice 2 (o bake-off precisa de contexto de identidade em paridade com a aventura de referência, senão mede input pobre)
**Criada em:** 2026-07-09

---

## História

> **Como** jogador,
> **quero** que meu personagem tenha background, ideais, vínculos e fraquezas que o mestre conhece e respeita,
> **para que** a narração reaja a quem meu personagem é — tensão a partir das fraquezas, escolhas guiadas pelos ideais, stakes ancorados nos vínculos — e não a uma casca de classe/raça.

---

## Contexto e motivação

### O problema observado

A aventura de referência ([aventura-seraphine.md](../referencia/aventura-seraphine.md)) imergia em boa parte por causa da **identidade** da personagem: "nobre menor que perdeu a família para um culto demoníaco", "código de honra rígido — não mente, não abandona inocentes, não tolera injustiça". Esses traços moviam a reação dos NPCs, o peso das escolhas morais e o tom. O AI DM de hoje **não tem onde guardar nem como injetar isso**: o `buildDmSystemPrompt` conhece nome, gênero, raça, classe, ficha de estado (HP/atributos/condições) e inventário — nada de background ou personalidade.

### Por que a solução atual não basta

A [US-23](./US-23-dm-ciente-da-ficha.md) tornou a injeção da ficha **dirigida por dados**, mas só para o **estado** (HP, atributos, condições). Identidade narrativa (background, ideais/vínculos/fraquezas) **não existe no modelo de dados** — não há campo no `Character`, então não há o que iterar nem injetar. É um dado novo, não um render novo.

### A proposta

Adicionar campos de **identidade narrativa** ao personagem (dados de criação, não de estado) e injetá-los no system prompt como uma seção read-only de *roleplay guidance*, no mesmo estilo dirigido por dados da US-23. São campos **padrão de D&D 5e** (Background + Personality: Ideals/Bonds/Flaws) — completar a ficha, não inventar mecânica.

---

## Escopo

### Dentro do escopo

- Campos de identidade no `Character`: **background**, **ideais**, **vínculos**, **fraquezas**.
- Captura no fluxo de criação ([US-26](./US-26-criacao-personagem-em-etapas.md)): a classe **semeia** background/ideais/vínculos/fraquezas por default e o jogador **edita ou aceita** — nunca campo em branco. Garante identidade sempre preenchida.
- Injeção no system prompt: seção read-only "Character identity (roleplay)", renderizada por iteração (campo vazio não aparece), com instrução ao mestre de **como usar** cada um (fraqueza → tensão; ideal → guia de escolha; vínculo → stake).
- A seção é **fonte de verdade de personalidade**, análoga à ficha da US-23: o mestre conhece e honra, mas não a reescreve na prosa.

### Fora do escopo

- **Divindade/patrono** — é a [US-40](./US-40-divindade-do-personagem.md).
- **Consequência mecânica** de violar um voto/ideal (enfraquecer poderes, como o juramento da paladina) — narração só; mecânica de oath é story futura.
- Editor de identidade na UI pós-criação — captura na criação basta para a Fase 2.
- Catálogo de backgrounds/ideais por SRD como dado (`System.config`) — por ora texto livre; catalogar é extensão futura (à la [US-20](./US-20-catalogo-de-sistemas-via-api.md)/[US-21](./US-21-sistemas-como-dado.md)).

---

## Modelo de dados proposto

Campos de **criação** (estáticos), no `Character` — não em `CharacterState` (não mudam por turno):

```ts
interface CharacterBackground {
  story?: string        // prosa de história de vida — "Nobre menor que perdeu a família para um culto demoníaco"
  ideals?: string[]     // ["Justiça acima de tudo", "A Luz protege os inocentes"]
  bonds?: string[]      // ["Jurou vingança contra o culto que matou sua família"]
  flaws?: string[]      // ["Código de honra rígido: não mente, não abandona inocentes"]
}
```

> **Nota de nome:** o container chama-se `background` (campo `Character.background`); o campo interno de prosa é `story` — não `background.background`. A linha no prompt continua rotulada "Background:".

**Persistência:** um campo JSON `background` em `Character` (Prisma, `@default("{}")`) — evita 4 colunas e segue a regra de extensão da US-23 (dado novo entra como grupo, renderizado por iteração). Injetado no builder pelo `ai.service` (turno de jogo) e pelo `adventure.service` (abertura).

Render no prompt (o builder itera, não enumera; campo vazio some):

```
## Character identity (read-only — roleplay guidance, honor it; never print verbatim)
- Background: Nobre menor que perdeu a família para um culto demoníaco.
- Ideais: Justiça acima de tudo; a Luz protege os inocentes.
- Vínculos: Jurou vingança contra o culto que matou sua família.
- Fraquezas: Código de honra rígido — não mente, não abandona inocentes, não tolera injustiça.
```

---

## Critérios de aceite

- [x] `Character` guarda `background` (`{story?, ideals?, bonds?, flaws?}`, campo JSON), o wizard captura na criação (etapa "Background", texto livre) e o `ai.service`/`adventure.service` injetam no prompt. (migração `add_character_background`; Slices B+C+D) _(defaults semeados por classe = pendente, precisa do catálogo no `System.config` — ver questão §2)_
- [x] O system prompt inclui uma seção de identidade renderizada **por iteração** — um campo novo/vazio não quebra nem exige editar o builder. (`dm-system.ts`, `IDENTITY_LABELS`)
- [x] O prompt instrui o mestre a **usar** cada eixo (fraqueza→tensão, ideal→escolha, vínculo→stake), não só listá-los. (redação default US-39 §3)
- [x] Personagem **sem** identidade preenchida não gera seção nem crash (tudo opcional). (`dm-system.test.ts`)
- [x] **Eval / regressão:** ficha de um personagem com background + uma fraqueza produz um prompt que contém os dois textos na seção de identidade (`evals/cases/us-39-identidade-narrativa.ts`). A metade "narração honra a fraqueza" depende de modelo vivo e fica no bake-off da US-17.

---

## Notas de implementação

- Segue o padrão da US-23: `ai.service` monta o objeto de identidade a partir do `Character` e passa ao `buildDmSystemPrompt`; o builder renderiza por iteração (`Object.entries`), não por lista fixa de campos.
- `ideais/vínculos/fraquezas` como `string[]` (join por `; ` no render) — permite 0..N sem `if` por campo.
- Defaults por classe entram no fluxo de criação ([US-26](./US-26-criacao-personagem-em-etapas.md)), não no builder — o builder só renderiza o que existe.
- Armadilha: **não imprimir** os traços na narração (mesma regra do status da US-23, `dm-system.ts`) — é entrada de *como jogar*, não texto a recitar.

---

## Questões em aberto

1. **Texto livre vs estrutura:** **decidido — texto livre** (`string[]`). Simples e flexível; catalogar por SRD/`System.config` fica para quando houver necessidade real (YAGNI).
2. **Captura na criação:** **decidido — gerar defaults por classe que o jogador edita.** **Entregue em parte:** o wizard já tem a etapa "Background" com campos editáveis (texto livre) e o backend persiste/normaliza. **Pendente — o seeding por classe:** os defaults moram no kit de classe (`System.config`, mesma fonte do equipamento/perícias), mas esse catálogo (background/ideais/vínculos/fraquezas por classe × ~12 classes) ainda não existe no config/`seed.ts`. Enquanto não existir, os campos nascem em branco (editáveis), não semeados. Follow-up: **[US-44](./US-44-defaults-de-background-por-classe.md)** (adicionar `backgroundDefaults` por `classKey` ao `SystemConfig` + seed, e o wizard pré-preencher a partir da classe escolhida).
3. **Peso no prompt:** **decidido — esta US entrega uma redação default de equilíbrio (chute inicial); a calibração fina é [US-43](./US-43-calibracao-peso-traços-identidade.md), separada.** O default (condicional, cor-não-mandato, ancorado no papel de cada traço):

   > "Deixe estes traços colorirem as escolhas e a tensão quando a cena pedir — a fraqueza cria dilema, o ideal guia a decisão, o vínculo é o que está em jogo. Não os force onde a cena não pede."

   Se é *de fato* equilibrado só a medição diz, mas isso é um A/B de redação (modelo fixo, cenário que tenta a fraqueza) — atividade que só faz sentido depois do bake-off da [US-17](./US-17-comparacao-modelos-eval.md) escolher o modelo. Fica na [US-43](./US-43-calibracao-peso-traços-identidade.md); a US-39 não bloqueia nela.

---

## Referências no código

- `packages/ai-engine/src/prompts/dm-system.ts` — `buildDmSystemPrompt`, `DmCharacterSheet`, regra de render dirigido por dados e de não imprimir status.
- `apps/api/src/ai/ai.service.ts` — monta os params do builder a partir de `Character`/`CharacterState`.
- `apps/api/prisma/schema.prisma` — `Character` (onde entra o campo `identity`).
- `docs/sdlc/referencia/aventura-seraphine.md` — origem dos exemplos (background/honor-code da Seraphine).
- `docs/sdlc/01-requisitos/US-23-dm-ciente-da-ficha.md` — mecanismo de injeção dirigida por dados.
