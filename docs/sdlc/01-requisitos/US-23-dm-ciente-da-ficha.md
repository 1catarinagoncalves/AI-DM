# US-23 — DM ciente da ficha completa (injeção dirigida por dados)

**Épico:** 3 — Narração e mecânica
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** nenhuma (renderiza a ficha atual; `System.config` da [US-21](./US-21-sistemas-como-dado.md) só melhora os rótulos)
**Criada em:** 2026-07-01
**Relacionado:** [US-19](./US-19-estado-de-ficha-via-api.md) (mesma fonte, `CharacterState`) · [US-21](./US-21-sistemas-como-dado.md) (atributos como dado)

---

## História

> **Como** jogador,
> **quero** que o mestre tenha ciência de tudo que está na minha ficha (atributos, HP, nível, condições e o que for adicionado no futuro),
> **para que** a narração e as decisões dele sejam coerentes com o estado real do meu personagem — e sem precisar reescrever o prompt cada vez que a ficha ganha um campo novo.

---

## Contexto e motivação

### O problema observado

O `buildDmSystemPrompt` injeta só parte da ficha (`dm-system.ts:57-68`): nome, gênero, raça, classe e inventário. Ficam de fora, hoje:

- **Atributos** (`baseAttributes`) — o mestre rola dados sem saber os atributos do personagem.
- **HP / HP máx** — narra sem saber se o personagem está à beira da morte.
- **Nível** e **condições** (`CharacterState.conditions`, que existe e nunca é injetado).

O `ai.service` já carrega `character` + `characterState` inteiros do banco (`ai.service.ts:50-69`) — os dados estão em mãos, só não chegam ao prompt.

### Por que "adicionar uns params" não basta

A correção óbvia — passar `attributes`, `hp`, `level`, `conditions` como parâmetros do builder — resolve o hoje, mas **não escala**: cada parâmetro novo da ficha (uma reserva de mana, reputação, um stat de um sistema futuro) obrigaria editar o `buildDmSystemPrompt` de novo. O requisito é que a ficha ganhe campos sem tocar no prompt.

### A proposta

Injetar a ficha **dirigida por dados**: o `ai.service` monta um objeto de ficha a partir do estado persistido e o `buildDmSystemPrompt` **renderiza o que estiver lá**, iterando os dados — não uma lista fixa de campos no código. Assim, um parâmetro novo na ficha aparece no prompt automaticamente.

---

## Escopo

### Dentro do escopo

- O system prompt passa a incluir a ficha completa atual: atributos, HP/HP máx, nível, condições (além do que já mostra).
- A renderização é **dirigida pelos dados**: atributos vêm do map `attributes`/`baseAttributes` iterado (não chaves fixas); condições da lista; qualquer chave nova nesses dados é renderizada sem alterar o builder.
- Seção marcada como **read-only / fonte de verdade**, no mesmo estilo do inventário — o mestre *conhece* a ficha, mas só a altera via tools.
- Rótulos dos atributos vêm de `System.config.attributes[].label` quando disponível ([US-21](./US-21-sistemas-como-dado.md)); sem config, usa a própria chave.

### Fora do escopo

- **Imprimir** status na narração — segue proibido (`dm-system.ts:113`); isto é sobre o que o mestre *sabe* (entrada), não o que escreve (saída).
- Tools novas de mutação de ficha (mana, condições) — quando esses parâmetros existirem, a mutação é outra story; esta só garante que, existindo no estado, cheguem ao mestre.
- Sincronizar a ficha para a UI ao vivo — é a [US-19](./US-19-estado-de-ficha-via-api.md).

---

## Modelo de dados / contrato

Sem dado novo. Um objeto de ficha derivado do estado persistido, passado ao builder:

```ts
interface DmCharacterSheet {
  level: number
  hp: number
  maxHp: number
  attributes: Record<string, number>   // iterado; rótulos via System.config
  conditions: string[]
  // futuros parâmetros entram AQUI (no estado/config), não como novos params do builder
}
```

Renderização no prompt (o builder itera, não enumera):

```
## Character sheet (read-only — source of truth, managed by the Game Server)
- Level: 3
- HP: 18/24
- Conditions: envenenado
- Attributes: FOR 16, DES 12, CON 14, INT 10, SAB 13, CAR 8
```

**A regra de extensão:** parâmetro novo da ficha = novo dado no `CharacterState`/`System.config`, renderizado pela iteração existente. Se um parâmetro exigir formatação especial (ex.: uma reserva com atual/máx), ele entra como um grupo de dados renderizado genericamente (como atributos), não como um `if` novo no builder.

---

## Critérios de aceite

- [x] O system prompt inclui atributos, HP/HP máx, nível e condições da ficha atual. (`dm-system.ts` — seção "Character sheet")
- [x] Atributos são renderizados iterando o map `attributes`/`baseAttributes` — não há chaves de atributo hardcoded no builder. (`Object.entries(sheet.attributes)`)
- [x] A seção da ficha é marcada como read-only/fonte de verdade; o mestre não a altera na narração, só via tools.
- [x] **Extensibilidade (o critério-chave):** adicionar um parâmetro novo à ficha (ex.: um atributo `sorte`, ou uma condição nova no estado) faz esse parâmetro aparecer no prompt **sem editar `buildDmSystemPrompt`**. (`dm-system.test.ts` cobre o atributo `sorte`)
- [x] Rótulos de atributo usam `System.config.attributes[].label` quando presente; sem config, caem na chave crua (nenhum crash).
- [x] **Eval / teste de regressão:** bloco de ficha de um personagem com HP baixo + "envenenado" contém HP, nível, condições e todos os atributos (`evals/cases/us-23-dm-ciente-da-ficha.ts`). A metade "narração coerente" depende de modelo vivo e não roda na suite (sem API paga).

---

## Notas de implementação

- `ai.service` monta o `DmCharacterSheet` a partir de `character` (level, `baseAttributes`) + `characterState` (hp, maxHp, `attributes`, `conditions`) — já carregados em `streamChat`.
- `buildDmSystemPrompt` recebe **um** objeto `sheet` (não N escalares) e renderiza cada bloco por iteração: `Object.entries(sheet.attributes)`, `sheet.conditions.join(...)`. Adicionar campo ao objeto ≠ editar a lógica de render.
- HP é o do **início do turno** (o prompt é montado antes das tools); suficiente para consciência situacional. Tools que mudam HP já devolvem o novo valor ao modelo no mesmo turno.
- Preferir `characterState.attributes` (pode evoluir com level-up) e cair em `character.baseAttributes` quando o estado ainda não existe.
- Rótulos: se a [US-21](./US-21-sistemas-como-dado.md) ainda não tiver landado, renderizar a chave crua; quando o `config` existir, mapear para o label. Sem acoplamento rígido.

---

## Questões em aberto (resolvidas)

1. **Reservas com atual/máx no futuro (mana, stamina): modelar já como grupo `resources`, ou só quando o primeiro aparecer?**
   **Decisão:** só quando aparecer — YAGNI. A regra de extensão já cobre o caminho: o primeiro recurso entra como um grupo de dados no `sheet` (à imagem de `attributes`) e é renderizado pela iteração genérica, sem `if` novo no builder. Não se cria a estrutura `resources` especulativamente.

2. **Condições precisam de descrição/efeito no prompt (ex.: "envenenado: -2 em testes") ou basta o nome?**
   **Decisão:** só o nome, por ora. `CharacterState.conditions` é `string[]` — o builder renderiza a lista crua. Efeitos mecânicos de condição não existem como dado hoje (o `config` da [US-21](./US-21-sistemas-como-dado.md) define atributos e kits, não efeitos de condição). Quando/se o sistema definir efeitos no `config`, eles entram como mais um grupo de dados renderizado genericamente — mesma regra de extensão da (1), sem tocar na lógica de render.

3. **Quão verboso deve ser o bloco para não inflar o prompt a cada turno?**
   **Decisão:** render compacto, fixo. Uma linha por bloco (Level, HP, Conditions) e **todos os atributos numa única linha** (`FOR 16, DES 12, …`), exatamente como no exemplo da seção "Modelo de dados". Ordem por prioridade narrativa: HP e condições no topo, atributos por último. É barato e determinístico; o custo por turno é umas poucas linhas. Fichas grandes de sistemas futuros são endereçadas pela (4), não por truncar aqui.

4. **Introduzir agora uma flag `showToDm` por parâmetro no `System.config`, ou só quando existir um parâmetro que precise ser ocultado?**
   **Decisão:** adiar — YAGNI, alinhado à decisão análoga da [US-21 §4](./US-21-sistemas-como-dado.md) (adiar eixos por parâmetro até o 2º recurso). Hoje toda a ficha (atributos, HP, nível, condições) é narrativamente relevante, então não há nada a ocultar. A mitigação de bloat da (3) — render compacto + HP/condições no topo — vale independentemente e é suficiente para a Fase 1. Quando surgir um parâmetro que o autor do sistema queira esconder do mestre, `showToDm` no `config` é a extensão natural, e a iteração do builder já sabe pular chaves não marcadas.

---

## Referências no código

- `packages/ai-engine/src/prompts/dm-system.ts` — `buildDmSystemPrompt`, seção "The player's character" e a regra de não imprimir status (`:113`).
- `apps/api/src/ai/ai.service.ts` — carga de `character`/`characterState` e a chamada a `buildDmSystemPrompt` (`:89-99`).
- `apps/api/prisma/schema.prisma` — `Character.baseAttributes`, `CharacterState` (`hp`, `maxHp`, `attributes`, `conditions`).
- `docs/sdlc/01-requisitos/US-21-sistemas-como-dado.md` — atributos/labels como dado (`System.config`).
