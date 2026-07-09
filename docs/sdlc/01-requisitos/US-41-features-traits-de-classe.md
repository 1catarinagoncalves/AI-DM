# US-41 — Features & traits de classe conhecidos pelo mestre

**Épico:** 3 — Narração e mecânica
**Fase:** 2 — Memória / continuidade espacial (Fase B)
**Status:** 📋 Planejada (não iniciada)
**Depende de:** [US-23](./US-23-dm-ciente-da-ficha.md) (injeção dirigida por dados) · fonte do kit de classe ([US-28](./US-28-aventura-inicial-baseada-na-classe.md) / catálogo [US-20](./US-20-catalogo-de-sistemas-via-api.md)/[US-21](./US-21-sistemas-como-dado.md))
**Relacionado:** [US-42](./US-42-magias-conhecidas.md) (magias — sistema separado no 5e) · [US-27](./US-27-pericias-do-personagem.md) (perícias, que NÃO são features)
**Bloqueia:** [US-17](./US-17-comparacao-modelos-eval.md) slice 2 — o cenário de **Combate** do bake-off É uma feature (Expulsar Mortos-Vivos = Channel Divinity) e o **Dilema** usa Divine Sense; sem o kit, o modelo inventa poder ou narra genérico.
**Criada em:** 2026-07-09

---

## História

> **Como** jogador,
> **quero** que o mestre conheça as features e traits de classe do meu personagem (Detectar o Mal, Expulsar Mortos-Vivos, Aura de Proteção…),
> **para que** ele ofereça e narre esses poderes de forma coerente, em vez de inventar habilidades ou ignorar as que eu tenho.

---

## Contexto e motivação

### O problema observado

Na aventura de referência ([aventura-seraphine.md](../referencia/aventura-seraphine.md)), **cada turno é uma invocação de poder** — "ativa Detectar o Mal", "Expulsar Mortos-Vivos ativado", "Bênção de Proteção". Essas são **features de classe** (Divine Sense, Channel Divinity: Turn Undead, Aura of Protection, Lay on Hands), o coração da identidade de ação da paladina. O AI DM de hoje **não tem campo nenhum** para elas.

### Por que a solução atual não basta

O código tem **atributos** (ability scores em `shared/ability.ts`) e **perícias** (`skills`, [US-27](./US-27-pericias-do-personagem.md) — para testes tipo Percepção). Nenhum dos dois é feature de classe. Feature/trait é uma **terceira** coisa (o que o personagem *sabe fazer* de especial), sem home no modelo. Sem ela, o cenário de Combate do bake-off da [US-17](./US-17-comparacao-modelos-eval.md) não roda justo — o modelo não sabe que "Expulsar Mortos-Vivos" existe.

### A proposta

Uma lista read-only de **features & traits** do personagem (nome + descrição curta), injetada no system prompt (padrão dirigido por dados da US-23), para o mestre **oferecer e narrar** coerente. **Awareness apenas** — resolver o efeito/custo é outra camada (ver Fora do escopo).

---

## Escopo

### Dentro do escopo

- Lista de features & traits no personagem: `{ name, description }[]` (ex.: "Detectar o Mal — sente presenças corruptas por perto"; "Expulsar Mortos-Vivos — repele/destrói mortos-vivos com energia divina").
- Origem no **kit da classe** (o mesmo caminho do equipamento inicial da [US-28](./US-28-aventura-inicial-baseada-na-classe.md) e das perícias) — populada na criação, não digitada à mão pelo jogador.
- Injeção no prompt: seção read-only "Class features & traits", renderizada por iteração (US-23), com instrução ao mestre de **oferecer/narrar**, nunca resolver mecânica ali.

### Fora do escopo

- **Resolução mecânica:** usos por descanso, cargas de Channel Divinity, número de cura/dano, cooldown, recuperação em descanso — sistema de recursos, story futura de mecânica. Aqui o mestre só *conhece* o poder.
- **Magias** — sistema próprio, [US-42](./US-42-magias-conhecidas.md).
- **Ataques de arma** (to-hit/dano) — é a camada de rolagem (`rollDice`/US-29/38), não feature.
- Editor de features na UI — o kit vem da classe; customização é futura.

---

## Modelo de dados proposto

Lista derivada do kit de classe, materializada no `Character` (como o inventário inicial):

```ts
interface ClassFeature {
  name: string         // "Expulsar Mortos-Vivos"
  description: string  // "Repele ou destrói mortos-vivos próximos com energia divina."
}
// Character.features: ClassFeature[]  (populado na criação a partir da classe)
```

**Persistência:** lista em `Character` (Prisma), preenchida do kit da classe no `System.config` ([US-21](./US-21-sistemas-como-dado.md)) na criação. Injetada como grupo iterado no prompt (regra de extensão da US-23). Campo vazio → seção some.

Render no prompt:

```
## Class features & traits (read-only — what the character can DO; offer and narrate these, never resolve mechanics here)
- Detectar o Mal: sente presenças corruptas por perto.
- Expulsar Mortos-Vivos: repele ou destrói mortos-vivos com energia divina.
- Aura de Proteção: aliados próximos resistem melhor a magias e efeitos.
```

---

## Critérios de aceite

- [ ] `Character` guarda uma lista de features & traits (`{name, description}`), populada do kit da classe na criação.
- [ ] O system prompt inclui uma seção de features renderizada **por iteração** (feature nova não exige editar o builder).
- [ ] O prompt instrui o mestre a **oferecer/narrar** as features, e a **não** resolver custo/efeito ali (isso é tool/mecânica).
- [ ] Personagem sem features (classe sem kit) não gera seção nem crash.
- [ ] **Eval / regressão:** personagem paladino tem "Expulsar Mortos-Vivos" na seção de features do prompt (`evals/cases/us-41-*.ts`). A metade "narra a feature coerente" fica no bake-off da US-17.

---

## Notas de implementação

- Segue US-23: `ai.service` monta a lista a partir do `Character`, o builder itera. Sem `if` por feature.
- Kit por classe: reaproveitar o mecanismo que já dá equipamento inicial por classe ([US-28](./US-28-aventura-inicial-baseada-na-classe.md)); features são só mais uma faceta do kit no `System.config`.
- **Cuidado de nome:** no código "ability" já é atributo (`shared/ability.ts`). Chamar isto de **feature/trait**, nunca "ability" nem "habilidade", para não colidir.
- Não imprimir a lista crua na narração — é awareness de *o que pode fazer*, não texto a recitar.

---

## Questões em aberto

1. **Fonte:** features como dado no kit de classe do `System.config` ([US-21](./US-21-sistemas-como-dado.md)) (consistente, reusável) ou lista simples materializada no `Character` na criação? Sugestão: derivar do `config`, materializar no personagem — mesma escolha do equipamento inicial.
2. **Usos/recursos:** quando entrar a mecânica (Channel Divinity 1/descanso, etc.), ela lê esta lista — mas o **contador** é story futura. Aqui, sem contador.
3. **Nível:** features desbloqueiam por nível (Aura só no 6º). Materializar só as já desbloqueadas, ou todas com marca de nível? Sugestão: só as desbloqueadas no nível atual.

---

## Referências no código

- `packages/ai-engine/src/prompts/dm-system.ts` — `buildDmSystemPrompt`, seção read-only dirigida por dados.
- `packages/shared/src/ability.ts` — `ability` = **atributo** (o nome já está tomado; features são outra coisa).
- `apps/api/prisma/schema.prisma` — `Character` (onde entra `features`).
- `apps/api/prisma/seed.ts` — kit/perícias por sistema, base para o kit de features por classe.
- `docs/sdlc/referencia/aventura-seraphine.md` — "Habilidades principais" da Seraphine (na verdade features/traits).
