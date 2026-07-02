# US-21 — Sistema de regras como dado reutilizável pelas APIs

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** nenhuma (para D1; o colapso de entidades é story separada)
**Criada em:** 2026-07-01
**Relacionado:** [ADR 003 — Sistemas como dado](../../adr/003-sistemas-como-dado.md) (decisão D1)

---

## História

> **Como** desenvolvedora,
> **quero** que os atributos e os kits iniciais de cada sistema venham de um `config` no próprio `System`,
> **para que** integrar um sistema novo seja inserir um `System` + `config` — sem tocar em controller ou serviço.

---

## Contexto e motivação

### O problema observado

Dois pontos das APIs assumem D&D 5e e impedem reaproveitá-las noutro sistema:

1. **`POST /characters` fixa os 6 atributos de D&D** (`strength…charisma`) no Zod e no DTO (`character.controller.ts`, `character.service.ts`). Um sistema com outros atributos (PbtA, um de 3 stats) não consegue criar personagem, embora o banco guarde `baseAttributes` como `Json` livre.
2. **`starting-inventory.ts` ignora o `systemId`** — os kits são chumbados a classes estilo D&D; qualquer sistema herda os mesmos.

Consequência: adicionar um sistema hoje exigiria **editar controller/serviço**, não só inserir um `System`.

### Por que a solução atual não basta

O armazenamento já é flexível (`baseAttributes`, `attributes`, `inventory` são `Json`), mas o **contrato da API é rígido**: valida contra constantes de D&D e resolve kit por uma tabela hardcoded. Falta o sistema **conhecer as próprias regras como dado** e o personagem **saber a que sistema pertence na hora da criação** (hoje `POST /characters` nasce sem `systemId`).

### A proposta

Pendurar um `config` no `System` (atributos + kits), fazer `Character` carregar `systemId`, e os endpoints genéricos lerem esse config: Zod dinâmico na criação de personagem e kits vindos do sistema. Ver [ADR 003](../../adr/003-sistemas-como-dado.md).

---

## Escopo

### Dentro do escopo

- `System.config` (`Json?`) com `attributes[]` e `startingKits{}`, validado por schema Zod em `packages/shared`.
- `Character.systemId` — o personagem pertence a um sistema; conhecido na criação.
- `POST /characters` valida os atributos com Zod **dinâmico** montado a partir de `config.attributes`.
- `getStartingInventory` lê `config.startingKits` do sistema (com `default` como rede).
- Seed dos sistemas atuais (`system-free`, `system-dnd5e`) com seus `config`.
- Setup reordenado para *sistema → personagem → aventura* (o sistema precisa ser escolhido antes de criar o personagem).

### Fora do escopo

- **Colapsar `Campaign`+`Adventure`** numa entidade (decisão D2 da [ADR 003](../../adr/003-sistemas-como-dado.md)) — story própria; aqui `Character.systemId` convive com a `Campaign` atual.
- Convenções de dado, fórmulas de HP ou resolução de regras no `config` — `rollDice`/`updateCharacterHp` já são genéricos (YAGNI).
- RAG de livro upado — `ragIndexId` já é coluna própria do `System`.
- Editor de sistema pela UI (upload é Fase 3).

---

## Modelo de dados proposto

**`System.config` (`Json?`):**

```json
{
  "attributes": [
    { "key": "strength", "label": "Força", "min": 1, "max": 20, "default": 10 }
  ],
  "startingKits": {
    "guerreiro": [{ "name": "Espada longa", "qty": 1 }],
    "default":   [{ "name": "Adaga", "qty": 1 }]
  }
}
```

| Campo | Tipo | Descrição |
|---|---|---|
| `attributes[].key` | string | Chave do atributo em `baseAttributes` (ex.: `strength`). |
| `attributes[].label` | string | Rótulo exibido na ficha/UI (substitui o `ATTR_LABELS` hardcoded do `GameView`). |
| `attributes[].min/max/default` | int | Limites de validação e valor inicial no setup. |
| `startingKits` | `Record<classe, Item[]>` | Kit por classe; chave `default` obrigatória como fallback. |

**Novo campo:** `Character.systemId` (FK → `System`).

**Persistência:** `Json` em `System` + Zod em `packages/shared/src/types/`. Nenhuma tabela nova.

### Variação de kit (resolvida)

Kits **por classe**; todo sistema tem classe, e um sistema sem classes formais define uma classe padrão única. O resolver casa a classe do personagem e cai em `default` quando não acha — nunca devolve vazio (mantém o comportamento atual de `starting-inventory.ts`).

---

## Critérios de aceite

- [x] `System` tem `config` (`attributes[]` + `startingKits{}`), validado por um schema Zod em `packages/shared` ([system.ts](../../../packages/shared/src/types/system.ts)).
- [x] `Character` tem `systemId`; `POST /characters` recebe e persiste o sistema.
- [x] `POST /characters` valida os atributos **contra `config.attributes`** do sistema (nomes, min/max), não contra um Zod fixo de D&D (`buildCharacterAttributesSchema`, dinâmico por request).
- [x] Criar personagem num sistema com conjunto de atributos diferente de D&D funciona sem alterar controller/serviço.
- [x] `getStartingInventory` devolve o kit de `config.startingKits`; classe sem match cai em `default`; nunca devolve vazio.
- [x] Os sistemas seed (`system-free`, `system-dnd5e`) têm `config` coerente com o comportamento atual (D&D 5e mantém os 6 atributos e os kits de hoje).
- [x] Setup segue a ordem *sistema → personagem → aventura* ([SetupWizard.tsx](../../../apps/web/src/components/setup/SetupWizard.tsx)).
- [x] **Eval / teste de regressão:** dado um `System` de teste com atributos `["cool","hard"]` e um kit próprio, criar personagem valida esses dois atributos (rejeita `strength`) e recebe o kit do config — tudo sem tocar em código de controller. (`packages/shared/src/types/system.test.ts`, `apps/api/src/character/character.service.test.ts`)
- [x] **Docs:** [`modelo-de-dados.md`](../02-design/modelo-de-dados.md) e [`contratos-de-api.md`](../02-design/contratos-de-api.md) atualizados — D1 passou a estado atual, D2 segue marcada como planejada.
- [x] **ADR:** status da decisão **D1** na [ADR 003](../../adr/003-sistemas-como-dado.md) atualizado para implementado (banner de status + §2.1 faseamento).

---

## Notas de implementação

- Montar o Zod dinâmico: a partir de `config.attributes`, gerar `z.object({ [key]: z.number().int().min(min).max(max) })`. Reusar em `CreateCharacterSchema`.
- `getStartingInventory(system, class)` passa a receber o sistema; manter a lógica de match/normalização atual, só trocando a fonte da tabela de constante para `config.startingKits`.
- `ATTR_LABELS` no `GameView` pode passar a vir de `config.attributes[].label` (via a ficha que o `PlayPage` já carrega) — remove outro hardcode de D&D no front.
- Seed: transportar a tabela `KITS` de `starting-inventory.ts` para o `config` de `system-dnd5e`; `system-free` recebe um `config` mínimo (atributos genéricos + kit `default`).
- Guardar rede: `config` é obrigatório; `System` sem `config` válido rejeita a criação de personagem com erro claro (ver Questões em aberto §1).

---

## Questões em aberto (resolvidas)

1. **`System` sem `config`: rejeitar criação, ou aplicar default embutido?**
   **Decisão:** `config` obrigatório. Seed sempre define `config`; `POST /characters` rejeita com erro claro (422) se o `System` referenciado não tiver `config` válido. Já é a posição do [ADR 003](../../adr/003-sistemas-como-dado.md) §5 ("config inválido/ausente quebra criação de personagem → Zod de config e `default` de kit são obrigatórios") — esta story só formaliza o comportamento.

2. **`label`/`min/max` na UI: 100% do `config`, ou fallback para sistema legado sem `config`?**
   **Decisão:** 100% do `config`, sem fallback. Consequência direta da (1): não existe "sistema legado sem `config`" em runtime, todo `System` tem um. O único fallback que sobrevive é o transitório da [US-23](./US-23-dm-ciente-da-ficha.md) (renderizar a chave crua *enquanto esta story não aterrissa*) — não é um fallback permanente por sistema.

3. **Ordem do setup: *sistema* como passo próprio, ou dropdown no topo da tela de personagem?**
   **Decisão:** passo próprio, primeiro (*Sistema → Personagem → Aventura*, 3 passos). O form de atributos do passo "personagem" é dinâmico (`config.attributes`) — só dá para renderizá-lo sabendo o sistema. Embutir como dropdown faria os campos de atributo mudarem sob o usuário a cada troca de sistema, mais estado para o mesmo resultado. `SetupWizard.tsx` já é orientado a `Step` (`'character' | 'campaign'`); adicionar `'system'` como primeiro passo é a extensão natural do padrão existente — o passo "campaign" perde o `<select>` de sistema, que migra para o novo passo inicial.

4. **Dois eixos por parâmetro (`showToDm`, limites de mutação): agora ou só no 2º recurso?**
   **Decisão:** adiar. Mantém `updateCharacterHp` como está; generalizar para uma tool `updateResource` só quando aparecer um segundo recurso (mana, ouro, etc.) além do HP — YAGNI, a regra de extensão do [US-23](./US-23-dm-ciente-da-ficha.md) já garante o caminho quando for necessário.

---

## Referências no código

- `apps/api/src/character/character.controller.ts` — `CreateCharacterSchema` (Zod fixo dos 6 atributos).
- `apps/api/src/character/character.service.ts` — DTO e montagem de `baseAttributes`.
- `apps/api/src/character/starting-inventory.ts` — tabela `KITS` a migrar para `config`.
- `apps/api/prisma/schema.prisma` — `System`, `Character` (novos campos).
- `apps/web/src/components/setup/SetupWizard.tsx` — ordem do setup e escolha de sistema (ver [US-20](./US-20-catalogo-de-sistemas-via-api.md)).
- `apps/web/src/components/game/GameView.tsx` — `ATTR_LABELS` hardcoded.
- `docs/adr/003-sistemas-como-dado.md` — decisão que esta story implementa (D1).
