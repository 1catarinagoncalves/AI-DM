# US-42 — Magias conhecidas pelo mestre (awareness, sem motor de spellcasting)

**Épico:** 3 — Narração e mecânica
**Fase:** 2 — Memória / continuidade espacial (Fase B)
**Status:** 📋 Planejada (não iniciada)
**Depende de:** [US-23](./US-23-dm-ciente-da-ficha.md) (injeção dirigida por dados) · fonte do kit de classe ([US-28](./US-28-aventura-inicial-baseada-na-classe.md) / [US-21](./US-21-sistemas-como-dado.md))
**Relacionado:** [US-41](./US-41-features-traits-de-classe.md) (features & traits — sistema irmão, mesma seção de awareness)
**Parcialmente bloqueia:** [US-17](./US-17-comparacao-modelos-eval.md) slice 2 — melhora a **paridade** de contexto (a "Cura divina" da referência são magias), mas os cenários escolhidos do bake-off giram em features, não em cura; então é dependência de **fidelidade**, não bloqueio duro.
**Criada em:** 2026-07-09

---

## História

> **Como** jogador de um conjurador,
> **quero** que o mestre conheça as magias que meu personagem tem,
> **para que** ele ofereça e narre conjurações coerentes (Cura Divina, Luz Sagrada…) em vez de inventar ou ignorar minhas magias.

---

## Contexto e motivação

### O problema observado

A "Cura divina" da paladina de referência ([aventura-seraphine.md](../referencia/aventura-seraphine.md)) — curar ferimentos, doenças, purificação — são **magias** (Cure Wounds, Lesser Restoration…). No 5e, magias são uma **seção própria** da ficha, distinta de features/traits e de ataques. O AI DM não tem onde guardar as magias do personagem, então o mestre não sabe o que ele pode conjurar.

### Por que a solução atual não basta

A [US-41](./US-41-features-traits-de-classe.md) cobre **features & traits** (poderes de classe passivos/por-descanso). Magias são um sistema à parte no 5e — lista de magias, níveis, preparação, componentes, slots. Meter magia no campo de features perderia a semântica e empurraria a US para o motor de spellcasting inteiro. Separar mantém cada uma no seu tamanho.

### A proposta

Uma lista read-only de **magias conhecidas/preparadas** do personagem (nome + nível + descrição curta), injetada no prompt para o mestre **oferecer e narrar** conjurações. **Awareness apenas** — o motor de spellcasting (slots, gasto, preparação, upcasting, componentes, concentração) fica **fora**, para uma US de mecânica futura.

---

## Escopo

### Dentro do escopo

- Lista de magias no personagem: `{ name, level?, description? }[]` (ex.: "Curar Ferimentos (nível 1) — restaura vitalidade pelo toque").
- Origem no kit da classe/nível (mesmo caminho da [US-28](./US-28-aventura-inicial-baseada-na-classe.md)/[US-21](./US-21-sistemas-como-dado.md)).
- Injeção no prompt como seção read-only (ou sub-bloco da seção de identidade de ação da US-41), renderizada por iteração (US-23), com instrução de **oferecer/narrar**, nunca resolver slot/efeito.

### Fora do escopo (o grande — deliberado)

- **Motor de spellcasting:** spell slots por nível, gasto/recuperação, magias preparadas vs conhecidas, upcasting, componentes (V/S/M), concentração. É a US de mecânica de magia, futura e grande.
- **Features & traits** — [US-41](./US-41-features-traits-de-classe.md).
- **Ataques** (incl. ataques de magia com to-hit/dano) — camada de rolagem (`rollDice`).
- Preparação diária / troca de magias — depende do motor; fora.

---

## Modelo de dados proposto

```ts
interface KnownSpell {
  name: string          // "Curar Ferimentos"
  level?: number        // 1  (0 = truque/cantrip)
  description?: string   // "Restaura vitalidade pelo toque."
}
// Character.spells: KnownSpell[]  (do kit de classe/nível na criação)
```

**Persistência:** lista em `Character` (Prisma), do kit de classe no `System.config`. Injetada como grupo iterado. Vazia (não-conjurador) → seção some.

Render no prompt:

```
## Known spells (read-only — offer and narrate; never track slots or resolve here)
- Curar Ferimentos (nível 1): restaura vitalidade pelo toque.
- Luz Sagrada (truque): um clarão divino que fere as trevas.
```

---

## Critérios de aceite

- [ ] `Character` guarda uma lista de magias (`{name, level?, description?}`), populada do kit de classe/nível na criação.
- [ ] O prompt inclui a seção de magias renderizada **por iteração**; magia nova não exige editar o builder.
- [ ] O prompt instrui o mestre a **oferecer/narrar** conjurações e a **não** rastrear slot nem resolver efeito ali.
- [ ] Personagem não-conjurador (lista vazia) não gera seção nem crash.
- [ ] **Eval / regressão:** personagem com "Curar Ferimentos" tem a magia na seção do prompt; não-conjurador não tem a seção (`evals/cases/us-42-*.ts`).

---

## Notas de implementação

- Segue US-23 e espelha a [US-41](./US-41-features-traits-de-classe.md): mesma mecânica de kit por classe + iteração no builder. Pode compartilhar a seção de "identidade de ação" com as features, só com sub-rótulos diferentes.
- **Não** implementar slot/preparação — se aparecer a tentação de contar slots, é sinal de que virou a US de mecânica; parar.
- Truque/cantrip = `level: 0`; render como "truque".

---

## Questões em aberto

1. **Conhecidas vs preparadas:** modelar a distinção agora ou lista chapada de "disponíveis"? Sugestão: lista chapada — a distinção depende do motor de preparação (fora do escopo). YAGNI.
2. **Descrição:** texto curto por magia (mais tokens no prompt, melhor narração) ou só nome (barato)? Sugestão: descrição curta só para as de uso narrativo frequente; resto só nome.
3. **Fonte/nível:** magias vêm do kit de classe filtradas por nível do personagem? Resolver junto do kit de classe da [US-28](./US-28-aventura-inicial-baseada-na-classe.md)/[US-21](./US-21-sistemas-como-dado.md).

---

## Referências no código

- `packages/ai-engine/src/prompts/dm-system.ts` — `buildDmSystemPrompt`, seção read-only dirigida por dados.
- `apps/api/prisma/schema.prisma` — `Character` (onde entra `spells`).
- `apps/api/prisma/seed.ts` — kit por sistema/classe, base para o kit de magias.
- `docs/sdlc/01-requisitos/US-41-features-traits-de-classe.md` — sistema irmão (features/traits).
- `docs/sdlc/referencia/aventura-seraphine.md` — "Cura divina" da Seraphine (na verdade magias).
