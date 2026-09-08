# US-219 — XP por evento narrativo

**Épico:** 1 — Personagem
**Fase:** 1 — MVP single-player
**Status:** 🗂️ Backlog
**Depende de:** nenhuma
**Criada em:** 2026-09-07

---

## História

> **Como** jogadora,
> **quero** que meu personagem ganhe XP quando a ficção resolve um evento relevante (objetivo cumprido, obstáculo superado, descoberta importante),
> **para que** a progressão do personagem reflita o que ele realmente fez na aventura, em vez de ficar travada no nível escolhido na criação.

---

## Contexto e motivação

### O problema observado

`Character.level` (`apps/api/prisma/schema.prisma:47`) é definido na criação do personagem e nunca muda depois disso. Não existe campo de XP em lugar nenhum do schema, nem tool do DM Agent que atribua progresso. `completeQuest` (`apps/api/src/ai/ai.service.ts:1081`) fecha a aventura mas não devolve nada em troca — a ficha sai de uma aventura de 10 encontros com o mesmo nível de uma de 1 encontro.

### Por que a solução atual não basta

Sem XP não há sinal mecânico de progresso. `updateCharacterHp` e `updateInventory` mudam a ficha durante a aventura; nada muda a ficha *por causa* da aventura ter acontecido.

### A proposta

O repositório [ZoltyMat/dnd](https://github.com/ZoltyMat/dnd) — tracker de campanha 5e — mantém na ficha um contador de XP explícito ("Current XP: 900 / 2.700 (Nível 4)") e um script (`validate-character.js`) que confere nível, bônus de proficiência e XP sempre em sincronia, atualizado ao fim de cada sessão. O repositório não modela XP por combate — usa as faixas padrão de nível do SRD 5e como teto.

Esta story adota a mesma ideia (contador de XP acumulado, validado contra thresholds oficiais do SRD), mas a fonte do ganho é o **evento narrativo**, não o combate: Fase 1 não tem combate por turno (ver [backlog-combate-por-turno.md](./backlog-combate-por-turno.md)), então XP por "matar monstro" não se aplica — quem resolve o evento é o Mestre, na narração, e é ele quem atribui.

---

## Escopo

### Dentro do escopo

- `Character.xp: Int @default(0)` no schema Prisma (nova migração).
- Tabela `SRD_XP_THRESHOLDS` em `packages/shared/src` — XP acumulado necessário por nível (1 a 20, valores oficiais do SRD 5e: 0, 300, 900, 2700, 6500, ...).
- Tool nova `awardXp` no DM Agent (`ai.service.ts`, ao lado de `completeQuest`): o Mestre chama quando a ficção resolve um evento marcante (objetivo secundário cumprido, obstáculo superado, descoberta importante). Parâmetro é uma **categoria fixa** (`minor` | `moderate` | `major`), não um número livre — a IA não decide quantidade, só categoria; o valor em XP de cada categoria é calculado no servidor a partir do nível atual do personagem.
- `completeQuest` passa a somar XP também (categoria `major`, fixa) além do que já faz hoje.
- `xp` exposto no endpoint de personagem e exibido na ficha da interface (XP atual / XP necessário pro próximo nível).
- Resposta da tool sinaliza `readyToLevelUp: boolean` quando o total cruza o threshold do próximo nível.

### Fora do escopo

- O level-up em si (HP extra, novas features, ASI, slots de magia) — mecânica separada e maior, só faz sentido como story própria depois que progressão de classe por nível existir no motor. `awardXp` só acumula e sinaliza; não aplica nada.
- XP por combate/kill — não há combate por turno em Fase 1.
- Ajuste manual de XP pela jogadora — só o Mestre atribui, por ora.

---

## Modelo de dados proposto

```json
{
  "xp": 900
}
```

| Campo | Tipo | Descrição |
|---|---|---|
| `xp` | `Int` | XP acumulado total do personagem, nunca decresce. |

**Persistência:** coluna nova em `Character` (não em `CharacterState`) — XP é do personagem, atravessa aventuras diferentes, igual a `level`.

---

## Critérios de aceite

- [ ] `Character.xp` existe, `@default(0)`.
- [ ] `packages/shared` exporta `SRD_XP_THRESHOLDS` com os 20 valores oficiais do SRD 5e.
- [ ] Tool `awardXp` existe, aceita só `category: 'minor' | 'moderate' | 'major'` (schema zod), calcula o valor em XP a partir do nível atual, e soma ao `xp` do personagem.
- [ ] `completeQuest` (outcome `"success"`) soma XP de categoria `major` além do comportamento já existente.
- [ ] `xp` nunca decresce — não existe caminho de tool que aceite delta negativo.
- [ ] Ao cruzar o threshold do próximo nível, a resposta de `awardXp`/`completeQuest` inclui `readyToLevelUp: true`; `Character.level` **não** muda sozinho.
- [ ] A ficha na interface mostra XP atual e XP necessário pro próximo nível.
- [ ] **Eval / teste de regressão:** personagem nível 1 (threshold do nível 2 = 300 XP) recebe `awardXp({ category: 'major' })` equivalente a 300 XP → `xp === 300` e `readyToLevelUp === true`; chamar com `category` fora do enum é rejeitado pelo schema, sem persistir nada.

---

## Notas de implementação

- Seguir o shape de `completeQuest` (`ai.service.ts:1081`) e `updateCharacterHp` (`ai.service.ts:871`) pra tool nova: `description` explica pro modelo QUANDO chamar (evento resolvido, não toda rolagem), parâmetros mínimos.
- Categoria fixa em vez de número livre evita a IA inflar XP por injeção de prompt ("dá 999999 XP") — o valor por categoria vive no servidor, não no parâmetro.
- Valores de `SRD_XP_THRESHOLDS`: usar a tabela oficial do Player's Handbook (via [ADR 004](../../adr/004-origem-do-dado-de-sistema.md) / Open5e), não inventar números.

---

## Questões em aberto

1. Valor de XP por categoria (`minor`/`moderate`/`major`) é fixo por nível (ex.: fração do threshold do próximo nível) ou vem do motor de encontro (LGMRD, budget do evento)? O repositório de referência não resolve isso — ele só rastreia o total acumulado, não a origem por evento.
2. `completeQuest` com `outcome: "failure"` também dá XP parcial (por ter tentado) ou zero?

---

## Referências no código

- `apps/api/src/ai/ai.service.ts:1081` — `completeQuest`, ponto onde XP de conclusão de missão entra.
- `apps/api/src/ai/ai.service.ts:871` — `updateCharacterHp`, padrão de tool que muta a ficha.
- `apps/api/prisma/schema.prisma:24` — `model Character`, onde `xp` entra ao lado de `level`.
- [backlog-combate-por-turno.md](./backlog-combate-por-turno.md) — por que XP de combate fica fora desta story.
- Referência externa: [ZoltyMat/dnd](https://github.com/ZoltyMat/dnd) — tracker de campanha 5e com XP na ficha (900/2.700 no nível 4) e script de validação nível↔XP↔bônus de proficiência (`scripts/validate-character.js`); catálogo de escopo, não fonte de código.
