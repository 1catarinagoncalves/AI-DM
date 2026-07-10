# US-41 — Features de classe conhecidas pelo mestre

**Épico:** 3 — Narração e mecânica
**Fase:** 2 — Memória / continuidade espacial (Fase B)
**Status:** 🚧 Em progresso
**Depende de:** [US-23](./US-23-dm-ciente-da-ficha.md) (injeção dirigida por dados) · fonte do kit de classe ([US-28](./US-28-aventura-inicial-baseada-na-classe.md) / catálogo [US-20](./US-20-catalogo-de-sistemas-via-api.md)/[US-21](./US-21-sistemas-como-dado.md))
**Relacionado:** [US-42](./US-42-magias-conhecidas.md) (magias — sistema separado no 5e, fora do escopo) · [US-27](./US-27-pericias-do-personagem.md) (perícias, que NÃO são features)
**Bloqueia:** [US-17](./US-17-comparacao-modelos-eval.md) slice 2 — o cenário de **Dilema** do bake-off usa **Sentido Divino** (feature de nível 1); sem o kit, o modelo inventa poder ou narra genérico. (Features de níveis superiores — Expulsar Mortos-Vivos, Aura de Proteção — ficam fora deste escopo; ver [Fora do escopo](#fora-do-escopo).)
**Criada em:** 2026-07-09

---

## História

> **Como** jogador,
> **quero** que o mestre conheça as **features de classe de nível 1** do meu personagem (Sentido Divino, Impor as Mãos, Fúria, Ataque Furtivo…),
> **para que** ele ofereça e narre esses poderes de forma coerente, em vez de inventar habilidades ou ignorar as que eu tenho.

---

## Contexto e motivação

### O problema observado

Na aventura de referência ([aventura-seraphine.md](../referencia/aventura-seraphine.md)), **cada turno é uma invocação de poder** — "ativa Sentido Divino", "Impor as Mãos na ferida". Essas são **features de classe** (Divine Sense, Lay on Hands), o coração da identidade de ação da paladina. O AI DM de hoje **não tem campo nenhum** para elas.

### Por que a solução atual não basta

O código tem **atributos** (ability scores em `shared/ability.ts`) e **perícias** (`skills`, [US-27](./US-27-pericias-do-personagem.md) — para testes tipo Percepção). Nenhum dos dois é feature de classe. Feature é uma **terceira** coisa (o que o personagem *sabe fazer* de especial), sem home no modelo. Sem ela, o cenário de Dilema do bake-off da [US-17](./US-17-comparacao-modelos-eval.md) não roda justo — o modelo não sabe que "Sentido Divino" existe.

### A proposta

Uma lista read-only de **features de classe de nível 1** do personagem (nome + descrição curta), injetada no system prompt (padrão dirigido por dados da US-23), para o mestre **oferecer e narrar** coerente. **Awareness apenas** — resolver o efeito/custo é outra camada (ver Fora do escopo).

---

## Escopo

### Dentro do escopo

- Lista de features de classe no personagem: `{ name, description }[]` (ex.: "Sentido Divino — sente presenças de bem/mal e mortos-vivos por perto"; "Impor as Mãos — cura ferimentos tocando o alvo com energia divina").
- **Apenas features desbloqueadas no nível 1** (o único nível da Fase 1 — MVP). Features de níveis superiores não são materializadas.
- Origem no **kit da classe** (o mesmo caminho do equipamento inicial da [US-28](./US-28-aventura-inicial-baseada-na-classe.md) e das perícias) — populada na criação, não digitada à mão pelo jogador.
- Injeção no prompt: seção read-only "Class features", renderizada por iteração (US-23), com instrução ao mestre de **oferecer/narrar**, nunca resolver mecânica ali.

### Fora do escopo

- **Traits raciais** (Visão no Escuro, Ancestralidade Feérica…) — vêm da raça, não da classe; fonte de dados diferente. Story futura.
- **Features de nível > 1** (Channel Divinity / Expulsar Mortos-Vivos no nível 2–3, Aura de Proteção no nível 6…) — dependem de sistema de progressão de nível, que não existe na Fase 1.
- **Resolução mecânica:** usos por descanso, cargas, número de cura/dano, cooldown, recuperação em descanso — sistema de recursos, story futura. Aqui o mestre só *conhece* o poder.
- **Magias** — sistema próprio, [US-42](./US-42-magias-conhecidas.md). O "Conjuração/Spellcasting" que várias classes ganham no nível 1 é magia, não feature: fica na US-42.
- **Ataques de arma** (to-hit/dano) — é a camada de rolagem (`rollDice`/US-29/38), não feature.
- Editor de features na UI — o kit vem da classe; customização é futura.

---

## Modelo de dados proposto

Lista derivada do kit de classe, materializada no `Character` (como o inventário inicial):

```ts
interface ClassFeature {
  name: string         // "Impor as Mãos"
  description: string  // "Cura ferimentos tocando o alvo com energia divina."
}
// Character.features: ClassFeature[]  (populado na criação a partir da classe)
```

**Persistência:** lista em `Character` (Prisma), preenchida do kit da classe no `System.config` ([US-21](./US-21-sistemas-como-dado.md)) na criação, tomando apenas as features de nível 1. Injetada como grupo iterado no prompt (regra de extensão da US-23). Campo vazio → seção some.

Render no prompt:

```
## Class features (read-only — what the character can DO; offer and narrate these, never resolve mechanics here)
- Sentido Divino: sente presenças de bem/mal e mortos-vivos por perto.
- Impor as Mãos: cura ferimentos tocando o alvo com energia divina.
```

---

## Referência — features de nível 1 por classe (D&D 5e SRD)

Kit a semear no `System.config` (base para `apps/api/prisma/seed.ts`). Exclui Conjuração/Spellcasting (→ [US-42](./US-42-magias-conhecidas.md)), proficiências e perícias ([US-27](./US-27-pericias-do-personagem.md)).

| Classe | Features de nível 1 |
| --- | --- |
| **Bárbaro** | **Fúria** — entra em fúria, ganhando ímpeto e resistência no combate. · **Defesa sem Armadura** — protege-se sem armadura usando o próprio vigor. |
| **Bardo** | **Inspiração de Bardo** — inspira um aliado, dando-lhe um impulso extra numa ação. |
| **Clérigo** | *(sem feature de classe de nível 1 nesta fase — a feature de nível 1 vem do domínio; ver nota)* |
| **Druida** | **Druídico** — conhece a língua secreta dos druidas e as suas mensagens ocultas. |
| **Guerreiro** | **Estilo de Luta** — domina uma técnica marcial que o torna mais eficaz. · **Retomar o Fôlego** — recupera vigor no meio da batalha por um instante. |
| **Monge** | **Defesa sem Armadura** — protege-se sem armadura pela sua serenidade e treino. · **Artes Marciais** — luta desarmado com golpes rápidos e precisos. |
| **Paladino** | **Sentido Divino** — sente presenças de bem/mal e mortos-vivos por perto. · **Impor as Mãos** — cura ferimentos tocando o alvo com energia divina. |
| **Patrulheiro** | **Inimigo Favorito** — conhece a fundo um tipo de criatura e como caçá-la. · **Explorador Nato** — move-se e sobrevive com maestria no seu terreno. |
| **Ladino** | **Especialização** — é excepcionalmente bom em certas perícias. · **Ataque Furtivo** — golpe extra devastador quando pega o alvo desprevenido. · **Gíria de Ladrão** — comunica-se em código secreto do submundo. |
| **Feiticeiro** | *(sem feature de classe de nível 1 nesta fase — a feature de nível 1 vem da origem; ver nota)* |
| **Bruxo** | *(sem feature de classe de nível 1 nesta fase — a feature de nível 1 vem do patrono; ver nota)* |
| **Mago** | **Recuperação Arcana** — recupera parte da energia mágica ao descansar brevemente. |

> **Nota subclasses (YAGNI):** Clérigo, Feiticeiro e Bruxo têm como única feature de nível 1 um poder dependente de subclasse (domínio/origem/patrono). A Fase 1 não escolhe subclasse — então essas features **não existem** por ora e a lista fica vazia (exercita o critério "personagem sem features não gera seção nem crash"). Entram quando houver escolha de subclasse.
>
> **Nota Seraphine:** o kit completo da paladina de referência abrange vários níveis; aqui materializa-se só o subconjunto de nível 1 (**Sentido Divino**, **Impor as Mãos**). Expulsar Mortos-Vivos e Aura de Proteção ficam para uma story de progressão de nível.

---

## Critérios de aceite

- [ ] `Character` guarda uma lista de features (`{name, description}`), populada do kit da classe na criação, **apenas com features de nível 1**.
- [ ] O system prompt inclui uma seção de features renderizada **por iteração** (feature nova não exige editar o builder).
- [ ] O prompt instrui o mestre a **oferecer/narrar** as features, e a **não** resolver custo/efeito ali (isso é tool/mecânica).
- [ ] Personagem sem features (classe sem kit) não gera seção nem crash.
- [ ] **Eval / regressão:** personagem paladino tem "Sentido Divino" e "Impor as Mãos" na seção de features do prompt (`evals/cases/us-41-*.ts`). A metade "narra a feature coerente" fica no bake-off da US-17.

---

## Notas de implementação

- Segue US-23: `ai.service` monta a lista a partir do `Character`, o builder itera. Sem `if` por feature.
- Kit por classe: reaproveitar o mecanismo que já dá equipamento inicial por classe ([US-28](./US-28-aventura-inicial-baseada-na-classe.md)); features são só mais uma faceta do kit no `System.config`, ao lado de `startingKits`.
- **Cuidado de nome:** no código "ability" já é atributo (`shared/ability.ts`). Chamar isto de **feature**, nunca "ability", "habilidade" nem "trait" (trait = racial), para não colidir.
- Não imprimir a lista crua na narração — é awareness de *o que pode fazer*, não texto a recitar.
- Domínio/Origem/Patrono (Clérigo, Feiticeiro, Bruxo): a feature de nível 1 depende de subclasse. Sem escolha de subclasse na Fase 1 (YAGNI), esses personagens ficam **sem features** — não inventar feature genérica. A story de subclasse resolve quando existir.

---

## Questões em aberto

1. **Fonte:** features como dado no kit de classe do `System.config` ([US-21](./US-21-sistemas-como-dado.md)) (consistente, reusável) ou lista simples materializada no `Character` na criação? Sugestão: derivar do `config`, materializar no personagem — mesma escolha do equipamento inicial.
2. **Usos/recursos:** quando entrar a mecânica (Fúria X vezes/descanso, dados de Impor as Mãos, etc.), ela lê esta lista — mas o **contador** é story futura. Aqui, sem contador.
3. **Subclasse:** Clérigo/Feiticeiro/Bruxo têm feature de nível 1 que depende da subclasse (domínio/origem/patrono). Sem escolha de subclasse na criação (Fase 1, YAGNI), esses personagens ficam sem features de classe — nada a materializar. Story de subclasse resolve quando existir.

---

## Referências no código

- `packages/ai-engine/src/prompts/dm-system.ts` — `buildDmSystemPrompt`, seção read-only dirigida por dados.
- `packages/shared/src/ability.ts` — `ability` = **atributo** (o nome já está tomado; features são outra coisa).
- `apps/api/prisma/schema.prisma` — `Character` (onde entra `features`).
- `apps/api/prisma/seed.ts` — kit/perícias por sistema (`dnd5eKits`), base para o kit de features de nível 1 por classe.
- `docs/sdlc/referencia/aventura-seraphine.md` — "Habilidades principais" da Seraphine (na verdade features; só as de nível 1 entram aqui).
