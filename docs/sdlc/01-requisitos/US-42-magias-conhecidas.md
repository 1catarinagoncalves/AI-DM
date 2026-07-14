# US-42 — Magias conhecidas pelo mestre (awareness, sem motor de spellcasting)

**Épico:** 3 — Narração e mecânica
**Fase:** 2 — Memória / continuidade espacial (Fase B)
**Status:** 🚧 Em progresso
**Depende de:** [US-23](./US-23-dm-ciente-da-ficha.md) (injeção dirigida por dados) · fonte do kit de classe ([US-28](./US-28-aventura-inicial-baseada-na-classe.md) / [US-21](./US-21-sistemas-como-dado.md))
**Relacionado:** [US-41](./US-41-features-traits-de-classe.md) (features & traits — sistema irmão, mesma seção de awareness)
**Parcialmente bloqueia:** [US-17](./US-17-comparacao-modelos-eval.md) slice 2 — melhora a **paridade** de contexto (a "Cura divina" da referência são magias), mas os cenários escolhidos do bake-off giram em features, não em cura; então é dependência de **fidelidade**, não bloqueio duro.
**Criada em:** 2026-07-09
**Atualizada em:** 2026-07-11 — escopo reduzido a **apenas truques (nível 0)** por classe, para conter o volume de magias; nomes/descrições em PT-BR. (Recortes anteriores: truques + todas as magias de nível 1.)

---

## História

> **Como** jogador de um conjurador,
> **quero** que o mestre conheça as magias que meu personagem tem,
> **para que** ele ofereça e narre conjurações coerentes (Chama Sagrada, Orientação, Rajada Mística…) em vez de inventar ou ignorar minhas magias.

---

## Contexto e motivação

### O problema observado

A "Cura divina" da paladina de referência ([aventura-seraphine.md](../referencia/aventura-seraphine.md)) — curar ferimentos, doenças, purificação — são **magias**. No 5e, magias são uma **seção própria** da ficha, distinta de features/traits e de ataques. O AI DM não tem onde guardar as magias do personagem, então o mestre não sabe o que ele pode conjurar.

### Por que a solução atual não basta

A [US-41](./US-41-features-traits-de-classe.md) cobre **features** (poderes de classe passivos/por-descanso). Magias são um sistema à parte no 5e — lista de magias, níveis, preparação, componentes, slots. Meter magia no campo de features perderia a semântica e empurraria a US para o motor de spellcasting inteiro. Separar mantém cada uma no seu tamanho.

### A proposta

Uma lista de **magias conhecidas** do personagem (nome + nível + descrição curta). Os **nomes** são injetados no prompt para o mestre **oferecer** conjurações; a **descrição** vem **sob demanda** (tool `getSpell`) quando o jogador conjura (ver [Estratégia de injeção](#estratégia-de-injeção-no-prompt--sob-demanda)). **Awareness apenas** — o motor de spellcasting (slots, gasto, preparação, upcasting, componentes, concentração) fica **fora**, para uma US de mecânica futura.

Cada classe conjuradora recebe, na criação, **todos os truques (nível 0)** da sua lista de classe (regra 2024, **independente da escola** de magia). Magias de nível ≥ 1 ficam **fora** deste recorte, para conter o volume (ver [contagens](#contagem-por-classe)) — **exceto** 2 magias de nível 1 fixas para Paladino e Patrulheiro, que não têm truques ([Exceção](#exceção--2-magias-de-nível-1-para-paladino-e-patrulheiro)). É a lista da classe, materializada no personagem — do mesmo jeito que o inventário e as features vêm do kit da classe.

> **Paladino e Patrulheiro (Ranger) não têm truques** no 5e/2024 — a lista deles começa no nível 1. Para não ficarem sem magia nenhuma (e por serem o coração da US — a "Cura divina" da paladina), cada um recebe **2 magias de nível 1 fixas** como exceção (ver [Exceção](#exceção--2-magias-de-nível-1-para-paladino-e-patrulheiro)). As demais classes seguem só com truques.

---

## Escopo

### Dentro do escopo

- Lista de magias no personagem: `{ name, level?, description? }[]` (ex.: "Chama Sagrada (truque) — luz sagrada desce sobre o alvo").
- **Cobertura por classe:** todos os **truques (nível 0)** da lista da classe (ver [Catálogo](#catálogo-de-truques)). Sem filtro por escola. **Exceção:** Paladino e Patrulheiro (sem truques) recebem 2 magias de nível 1 fixas ([Exceção](#exceção--2-magias-de-nível-1-para-paladino-e-patrulheiro)).
- Origem no kit da classe no `System.config`, keyed pela chave canônica de classe (mesmo match tolerante do inventário/features).
- **Nomes** injetados no prompt (seção read-only leve, por iteração — US-23) para o mestre **oferecer**; **descrição sob demanda** via tool `getSpell(name)` quando o jogador conjura (ver [Estratégia de injeção](#estratégia-de-injeção-no-prompt--sob-demanda)). Nunca resolve slot/efeito.

### Fora do escopo (o grande — deliberado)

- **Magias de nível ≥ 1** — fora deste recorte (redução de volume), **exceto** as 2 fixas de Paladino e Patrulheiro ([Exceção](#exceção--2-magias-de-nível-1-para-paladino-e-patrulheiro)). O resto do nível 1 (Escudo, Míssil Mágico…) entra numa próxima iteração desta US, provavelmente junto do motor de slots; nível ≥ 2 depende de progressão de nível. Só **truques + essas 4 magias** entram agora.
- **Motor de spellcasting:** spell slots por nível, gasto/recuperação, magias preparadas vs conhecidas, upcasting, componentes (V/S/M), concentração. US de mecânica futura e grande.
- **Features & traits** — [US-41](./US-41-features-traits-de-classe.md).
- **Ataques** (incl. ataques de magia com to-hit/dano) — camada de rolagem (`rollDice`).
- **Aba de magias na ficha (UI)** — ao contrário da US-41 (que ganhou aba "Features"), esta US é **só backend/prompt + eval**. A aba de magias na ficha, se desejada, é uma US de interface separada.

---

## Estratégia de injeção no prompt — sob demanda

Injetar a **descrição** de toda a lista a cada turno gasta tokens à toa. Mas o mestre precisa **saber quais** magias o personagem tem para poder oferecê-las. Meio-termo: injetar **só os nomes** e buscar o texto sob demanda.

**Decisão:**

1. **Nomes no system prompt** — seção read-only leve, só `nome (nível)`, **sem descrição**, renderizada por iteração (US-23). Barato, e o mestre vê a lista, então pode **oferecer** conjurações.
2. **Descrição sob demanda via tool `getSpell(name)`** (padrão `rollDice`/`getRule`) — quando o jogador declara conjurar ("lanço Chama Sagrada"), o mestre chama `getSpell("Chama Sagrada")`; o Game Server valida contra `Character.spells` (fonte de verdade) e devolve `{ known, level, description }` — ou `known: false` se não conhece. Só aí o efeito completo entra no contexto.

`Character.spells` (materializado na criação, do [Catálogo](#catálogo-de-truques)) alimenta os dois consumidores: o builder lê só `name`/`level`; o `getSpell` lê a `description`.

**Por que nenhum dos extremos:** lista inteira com descrição a cada turno = caro; nada no prompt = o mestre não oferece (não vê a lista). Nomes-só preserva a oferta e corta o grosso do custo (a descrição).

---

## Fonte e método

Duas fontes, papéis distintos:

1. **Seleção (quais truques, por classe)** — página [`dnd2024.wikidot.com/spell:all`](http://dnd2024.wikidot.com/spell:all), aba **Cantrip**. A coluna *Spell lists* dá as classes de cada truque. Filtro: nível 0, **todas as escolas**.
2. **Título + descrição** — [D&D Beyond — Basic Rules 2014, Spell Descriptions](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/spells#SpellDescriptions). O nome em inglês é o **título oficial** dessa fonte; o texto oficial é a fonte de verdade do **efeito**, aqui **destilado numa linha curta em PT-BR** (não copiado inteiro).

**Idioma:** nomes e descrições em **PT-BR**, para casar com o resto da ficha (US-39/40/41 usam PT-BR: "Sentido Divino", "Impor as Mãos").

**Mapa de classes (do wiki → chaves do projeto):** as chaves seguem a nomenclatura das outras USs (`patrulheiro`, `bruxo` como classes próprias). Feiticeiro e Bruxo ficam **separados**, cada um com a sua lista de truques do wiki:

| Chave do projeto | Classe do wiki | Nota |
| --- | --- | --- |
| `mago` | Wizard | — |
| `clerigo` | Cleric | — |
| `druida` | Druid | — |
| `bardo` | Bard | — |
| `feiticeiro` | Sorcerer | só os truques do Feiticeiro |
| `bruxo` | Warlock | **separado** do Feiticeiro (ver [Notas de implementação](#notas-de-implementação)) |
| `paladino` | Paladin | **sem truques** → 2 magias de nível 1 fixas ([Exceção](#exceção--2-magias-de-nível-1-para-paladino-e-patrulheiro)) |
| `patrulheiro` | Ranger | **sem truques** → 2 magias de nível 1 fixas ([Exceção](#exceção--2-magias-de-nível-1-para-paladino-e-patrulheiro)) |
| — | Artificer | **sem** classe correspondente no projeto → ignorado |

Não-conjuradores (`guerreiro`, `barbaro`, `monge`, `ladino`) → lista vazia (**4 classes** — exercita o critério "sem magias, sem seção, sem crash").

> **†** — alguns truques do recorte 2024 **não existem** nas Basic Rules 2014 (truques novos/renomeados: Toll the Dead, Mind Sliver, Sorcerous Burst, etc.). Para esses, a descrição curta foi redigida a partir de conhecimento geral de D&D e **precisa de verificação** contra uma fonte 2024. Marcados com **†**.

---

## Modelo de dados proposto

```ts
interface KnownSpell {
  name: string          // "Chama Sagrada"
  level?: number        // 0  (0 = truque/cantrip)
  description?: string   // "Luz sagrada desce sobre o alvo."
}
// Character.spells: KnownSpell[]  (do kit de classe na criação)
```

**Persistência:** lista em `Character` (Prisma, `spells Json @default("[]")`), materializada do kit de classe no `System.config` (`classSpells`, mesmo esquema de `classFeatures`/`startingKits`: `Record<chaveDeClasse, KnownSpell[]>` com `default` opcional). Injetada como grupo iterado. Vazia (não-conjurador, ou classe sem truques) → seção some.

Consumo (ver [Estratégia de injeção](#estratégia-de-injeção-no-prompt--sob-demanda)) — **nomes no prompt, descrição sob demanda**:

Seção injetada (só nomes):
```
## Known spells (read-only — offer these; call getSpell for the effect before narrating)
- Chama Sagrada (truque)
- Orientação (truque)
```

Descrição via tool, quando o jogador conjura:
```
getSpell("Chama Sagrada")   // clérigo tem
→ { known: true, level: 0, description: "Luz sagrada desce sobre o alvo, ignorando cobertura." }

getSpell("Bola de Fogo")    // clérigo não tem
→ { known: false }
```

`level === 0` → "(truque)"; `level >= 1` → "(nível N)" (mantido no schema para quando o nível 1 entrar); `level` ausente → sem rótulo de nível.

---

## Catálogo de truques

**Fonte da seleção** (quais truques, por classe): wiki 2024 — [`dnd2024.wikidot.com/spell:all`](http://dnd2024.wikidot.com/spell:all), aba Cantrip.
**Fonte do título e da descrição** (coluna EN + linha em PT-BR): [D&D Beyond — Basic Rules 2014, Spell Descriptions](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/spells#SpellDescriptions). O nome em inglês entre parênteses é o **título oficial** dessa fonte; o PT-BR é a tradução e a descrição é destilada dela.

**Classes**: `Mag` Mago · `Clé` Clérigo · `Dru` Druida · `Bar` Bardo · `Fei` Feiticeiro (Sorcerer) · `Bru` Bruxo (Warlock). *(Paladino e Patrulheiro não têm truques.)* **†** = ausente nas Basic Rules 2014 → título/descrição vêm do wiki 2024 (a verificar).

### Contagem por classe

| Classe | Truques |
| --- | --- |
| `mago` | 20 |
| `feiticeiro` | 20 |
| `druida` | 13 |
| `bardo` | 13 |
| `bruxo` | 12 |
| `clerigo` | 9 |
| `paladino` | 0 truques + **2 de nível 1** *(exceção)* |
| `patrulheiro` | 0 truques + **2 de nível 1** *(exceção)* |
| `guerreiro` · `barbaro` · `monge` · `ladino` | 0 *(não-conjuradores)* |

Total de truques distintos no catálogo: **34**.

### Truques (nível 0)

| Truque (PT-BR / EN) | Classes | Descrição curta |
| --- | --- | --- |
| **Amizade** † (Friends) | Mag Bar Fei Bru | por um instante influencia alguém com mais facilidade (que depois nota o encanto). |
| **Ataque Certeiro** (True Strike) | Mag Bar Fei Bru | guia o próximo golpe, tornando-o mais preciso. |
| **Bordão Druídico** (Shillelagh) | Dru | imbui um bordão com a força da natureza, tornando-o arma mágica. |
| **Borrifo Venenoso** (Poison Spray) | Mag Dru Fei Bru | um sopro de gás tóxico atinge um alvo próximo. |
| **Chama Sagrada** (Sacred Flame) | Clé | luz sagrada desce sobre o alvo, ignorando cobertura. |
| **Chicote de Espinhos** † (Thorn Whip) | Dru | um chicote de espinhos fere e puxa o alvo para perto. |
| **Consertar** (Mending) | Mag Clé Dru Bar Fei | repara uma pequena quebra ou rasgo num objeto. |
| **Dobre dos Mortos** † (Toll the Dead) | Mag Clé Bru | um dobre fúnebre soa e fere a mente ou a carne do alvo. |
| **Elementalismo** † (Elementalism) | Mag Dru Fei | manipula um punhado dos elementos: faísca, brisa, respingo, poeira. |
| **Estabilizar** (Spare the Dying) | Clé Dru | um toque estabiliza uma criatura caída a 0 de vida. |
| **Estilhaço Mental** † (Mind Sliver) | Mag Fei Bru | lasca psíquica fere a mente e atrapalha o próximo salvamento do alvo. |
| **Estrondo** † (Thunderclap) | Mag Dru Bar Fei Bru | uma onda de trovão explode ao redor, atingindo todos por perto. |
| **Explosão Feiticeira** † (Sorcerous Burst) | Fei | um estouro de energia mágica bruta atinge um alvo. |
| **Fagulha Estelar** † (Starry Wisp) | Dru Bar | um lampejo de luz estelar fere e destaca o alvo. |
| **Guarda de Lâmina** † (Blade Ward) | Mag Bar Fei Bru | energia defensiva reduz por um instante o dano de golpes físicos. |
| **Ilusão Menor** (Minor Illusion) | Mag Bar Fei Bru | cria um som ou uma pequena imagem ilusória. |
| **Jato de Ácido** (Acid Splash) | Mag Fei | arremessa uma bolha de ácido que corrói um ou dois alvos próximos. |
| **Luz** (Light) | Mag Clé Bar Fei | faz um objeto brilhar como uma tocha. |
| **Luzes Dançantes** (Dancing Lights) | Mag Bar Fei | cria pequenas luzes flutuantes que controla à distância. |
| **Mensagem** (Message) | Mag Dru Bar Fei | sussurra uma mensagem que só o alvo distante ouve, e ele pode responder. |
| **Mão Mágica** (Mage Hand) | Mag Bar Fei Bru | mão espectral flutuante manipula objetos leves à distância. |
| **Orientação** (Guidance) | Clé Dru | um toque divino dá um impulso extra ao próximo teste do aliado. |
| **Palavra Radiante** † (Word of Radiance) | Clé | uma palavra sagrada faz luz ofuscante ferir os inimigos ao redor. |
| **Prestidigitação** (Prestidigitation) | Mag Bar Fei Bru | pequenos truques mágicos: limpar, sujar, aromatizar, faíscas inofensivas. |
| **Produzir Chama** (Produce Flame) | Dru | uma chama na palma ilumina ou é arremessada num alvo. |
| **Raio de Fogo** (Fire Bolt) | Mag Fei | lança um dardo de fogo que incendeia alvo ou objeto. |
| **Raio de Gelo** (Ray of Frost) | Mag Fei | um feixe gélido fere e reduz a velocidade do alvo. |
| **Rajada Mística** (Eldritch Blast) | Bru | feixe de energia crepitante dispara contra um alvo. |
| **Resistência** (Resistance) | Clé Dru | um toque divino dá um impulso extra ao próximo salvamento do aliado. |
| **Taumaturgia** (Thaumaturgy) | Clé | manifesta um pequeno prodígio divino: voz trovejante, chamas trêmulas, portas que batem. |
| **Toque Chocante** (Shocking Grasp) | Mag Fei | descarga elétrica salta da mão e impede a reação do alvo. |
| **Toque Gélido** (Chill Touch) | Mag Fei Bru | mão esquelética fantasmagórica queima o alvo e o impede de se curar. |
| **Truque Druídico** (Druidcraft) | Dru | pequenos sinais da natureza: prever o tempo, abrir uma flor, acender uma chama. |
| **Zombaria Cruel** (Vicious Mockery) | Bar | insultos encantados ferem a mente e atrapalham o alvo. |

### Exceção — 2 magias de nível 1 para Paladino e Patrulheiro

Paladino e Patrulheiro não têm truques (a lista deles começa no nível 1). Para não ficarem sem magia — e por serem o coração da US (a "Cura divina" da paladina) — cada um recebe **2 magias de nível 1 fixas**, escolhidas por serem as mais icônicas/narrativas da classe. São `level: 1` no `KnownSpell` (render "(nível 1)").

| Classe | Magia (PT-BR / EN) | Nível | Descrição curta |
| --- | --- | --- | --- |
| `paladino` | **Curar Ferimentos** (Cure Wounds) | 1 | restaura vitalidade a uma criatura pelo toque. |
| `paladino` | **Abençoar** (Bless) | 1 | até três aliados ganham um impulso em ataques e salvamentos. |
| `patrulheiro` | **Marca do Caçador** † (Hunter's Mark) | 1 | marca uma presa, somando dano a cada golpe e facilitando rastreá-la. |
| `patrulheiro` | **Curar Ferimentos** (Cure Wounds) | 1 | restaura vitalidade a uma criatura pelo toque. |

---

## Critérios de aceite

- [ ] `Character` guarda uma lista de magias (`{name, level?, description?}`), populada do kit de classe na criação.
- [ ] Cada classe com truques recebe **todos os truques (nível 0)** da sua lista; **Paladino e Patrulheiro** recebem as **2 magias de nível 1 fixas** ([Exceção](#exceção--2-magias-de-nível-1-para-paladino-e-patrulheiro)); não-conjuradores recebem `[]`. Feiticeiro e Bruxo têm listas **distintas**.
- [ ] O `System.config` traz `classSpells` (mesmo esquema de `classFeatures`), validado por Zod em `@ai-dm/shared`; seed popula Free e D&D 5e SRD.
- [ ] O system prompt injeta **só os nomes** (`nome (nível)`) das magias conhecidas, renderizados **por iteração** (truque novo não exige editar o builder); **sem descrição**.
- [ ] Descrição vem via tool `getSpell(name)`: valida contra `Character.spells`, devolve `{ known, level, description }`; magia não conhecida → `known: false` e o mestre **não inventa** o efeito.
- [ ] `level === 0` renderiza como "(truque)" na seção de nomes e volta como "truque" no `getSpell`.
- [ ] O mestre **oferece** magias pelos nomes e narra a conjuração a partir do `getSpell`; **não** rastreia slot nem resolve efeito ali.
- [ ] Personagem sem magias → nenhuma seção de nomes; `getSpell` de quem não conjura/não conhece → `known: false`, sem crash.
- [ ] **Eval / regressão:** clérigo tem "Chama Sagrada" na seção de nomes do prompt; `getSpell("Chama Sagrada")` para clérigo → `known: true` + descrição; guerreiro sem seção e `getSpell` → `known: false` (`evals/cases/us-42-magias.ts`).

---

## Notas de implementação

- Segue US-23 e **espelha a [US-41](./US-41-features-traits-de-classe.md)** ponto a ponto — mesma mecânica de kit por classe + iteração no builder:
  - `SystemSpellSchema` / `classSpells` em `packages/shared/src/types/system.ts` (ao lado de `SystemClassFeatureSchema`/`classFeatures`).
  - `getClassSpells(config, class)` em `apps/api/src/character/starting-inventory.ts` (mesmo `normalize` do `getClassFeatures`).
- **⚠️ `CLASS_SYNONYMS` precisa mudar:** hoje o mapa colapsa `brux`→`feiticeiro` e `patrulhei`/`ranger`/`cacador`→`arqueiro`. Para esta US, `bruxo` e `patrulheiro` são **chaves próprias**: `brux`→`bruxo`, `patrulhei`/`ranger`/`cacador`→`patrulheiro`. Sem isso, o Bruxo herdaria os truques do Feiticeiro e o Patrulheiro cairia no bucket errado.
- **⚠️ `startingKits` (seed) segue junto — o `CLASS_SYNONYMS` é compartilhado:** `getStartingInventory` usa o **mesmo** `CLASS_SYNONYMS` (ver `starting-inventory.ts`). Mudar os alvos do sinônimo muda a busca do inventário também. Hoje `dnd5eKits` tem a chave `arqueiro` e **não tem** `bruxo` — depois da mudança, `patrulheiro` e `bruxo` não achariam kit e cairiam no `default`, **regredindo** o inventário inicial da [US-28](./US-28-aventura-inicial-baseada-na-classe.md). Correção no `seed.ts`:
  - renomear a chave do kit `arqueiro` → `patrulheiro`;
  - adicionar um kit `bruxo` (ou apontar `bruxo` para o mesmo kit do `feiticeiro`, se o equipamento for igual).
- **`classFeatures` (US-41) idem:** o `getClassFeatures` também usa o `CLASS_SYNONYMS`. Hoje as chaves de features não têm `bruxo`/`patrulheiro` (caem no `default []`, sem features), então a renomeação não regride nada — mas conferir ao alinhar o mapa.
  - Materialização em `character.service.ts` (`spells = getClassSpells(...)`), campo `spells` no `character.create`.
  - `dm-system.ts`: `buildDmSystemPrompt` recebe os **nomes** (`{name, level}[]`) e renderiza a seção "Known spells" por iteração (espelha `featuresSection`, mas **sem** descrição), + instrução de chamar `getSpell` antes de narrar a conjuração. `KnownSpell` exportado no `index.ts`.
  - Tool `getSpell(name)` (padrão `rollDice`/`getRule`): handler no Game Server lê `Character.spells`, valida e devolve `{ known, level, description }`.
  - `ai.service.ts` passa os nomes (`character.spells` mapeado a `{name, level}`) ao builder **e** registra o tool `getSpell` (turnos e abertura).
- Pode compartilhar a seção de "identidade de ação" com as features (US-41), só com sub-rótulos diferentes.
- **Não** implementar slot/preparação — se aparecer a tentação de contar slots, é sinal de que virou a US de mecânica; parar.
- Truque/cantrip = `level: 0`; render como "truque". O campo `level` fica no schema mesmo só usando 0 agora, para o nível 1 entrar sem migração de forma.
- Prisma: `spells Json @default("[]")` em `Character` — precisa de migração (mesmo passo que `features` da US-41).

---

## Questões em aberto

1. ~~Paladino e Patrulheiro ficam sem magias.~~ **Resolvido:** cada um recebe **2 magias de nível 1 fixas** ([Exceção](#exceção--2-magias-de-nível-1-para-paladino-e-patrulheiro)) — Paladino: Curar Ferimentos + Abençoar; Patrulheiro: Marca do Caçador + Curar Ferimentos. As demais classes seguem só com truques.
2. **Descrições dos truques marcados † :** ~10 truques não estão nas Basic Rules 2014 (Toll the Dead, Mind Sliver, Sorcerous Burst, Word of Radiance, Blade Ward, Thunderclap, Thorn Whip, Starry Wisp, Elementalism, Friends); descrição redigida de conhecimento geral. Verificar contra fonte 2024 antes de congelar o seed.
3. **`feiticeiro` e `bruxo` separados:** listas distintas conforme o wiki — Feiticeiro (Sorcerer, 20 truques) e Bruxo (Warlock, 12), com sobreposição parcial (Toque Gélido, Estilhaço Mental…) e exclusivos de cada (Rajada Mística é só Bruxo; Jato de Ácido, Raio de Fogo só Feiticeiro). Depende de `CLASS_SYNONYMS` deixar de colapsar Bruxo→Feiticeiro (ver Notas).
4. **Custo de tokens — meio-termo escolhido:** injeta **só os nomes** (barato: ≤ 20 linhas curtas, sem descrição) e busca o texto com `getSpell` sob demanda. Preserva a oferta proativa e corta o grosso do custo (a descrição). Se até os nomes pesarem, cair para o `getSpell` puro (nada no prompt) — improvável com ≤ 20 truques.
5. **Conhecidas vs preparadas:** modelar a distinção agora ou lista chapada de "disponíveis"? Sugestão: lista chapada — a distinção depende do motor de preparação (fora do escopo). YAGNI.

---

## Referências no código

- `packages/ai-engine/src/prompts/dm-system.ts` — `buildDmSystemPrompt`, seção read-only dirigida por dados (espelhar `featuresSection`).
- `packages/ai-engine/src/index.ts` — exportar `KnownSpell` (ao lado de `ClassFeature`).
- `packages/shared/src/types/system.ts` — `SystemSpellSchema` + `classSpells` no `SystemConfigSchema`.
- `apps/api/prisma/schema.prisma` — `Character.spells` (onde entra a lista).
- `apps/api/prisma/seed.ts` — `dnd5eClassSpells` por classe, base para o kit de truques (do [Catálogo](#catálogo-de-truques)).
- `apps/api/src/character/starting-inventory.ts` — `getClassSpells` (espelhar `getClassFeatures`).
- `apps/api/src/character/character.service.ts` — materialização de `spells` na criação.
- `apps/api/src/ai/ai.service.ts` — passa `spells` ao `buildDmSystemPrompt` (turnos e abertura).
- `docs/sdlc/01-requisitos/US-41-features-traits-de-classe.md` — sistema irmão (features), o molde desta US.
- `docs/sdlc/referencia/aventura-seraphine.md` — "Cura divina" da Seraphine (na verdade magias — de nível 1, fora deste recorte).
