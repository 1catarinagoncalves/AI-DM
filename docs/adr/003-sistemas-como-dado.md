# ADR 003 — Sistemas de regras como dado e hierarquia centrada no personagem

**Status:** Aceito (planejado — não implementado)
**Data:** 2026-07-01
**Decisores:** Time de Produto e Engenharia
**Relacionado:** [ADR 001 — Arquitetura](./001-arquitetura.md) · [US-21](../sdlc/01-requisitos/US-21-sistemas-como-dado.md)

---

## 1. Contexto

Requisito de arquitetura: **as APIs devem ser reaproveitadas entre sistemas de regras** (Free, D&D 5e SRD, e futuros via upload), de modo que **integrar um sistema novo = inserir um `System` + config, sem reescrever controller/serviço**.

Ao mapear o código atual, o acoplamento a D&D está concentrado em dois pontos — o resto já é agnóstico:

- **`POST /characters` fixa os 6 atributos de D&D** (`strength…charisma`) no Zod e no DTO (`character.controller.ts`), apesar de o banco guardar `baseAttributes` como `Json` livre. A rigidez está no **contrato da API**, não nos dados.
- **`starting-inventory.ts` ignora o `systemId`** — kits chumbados a classes estilo D&D em português, herdados por qualquer sistema.

Já são reutilizáveis (não mudam): `/campaigns`, `/adventures`, `/ai/chat` (o prompt recebe `systemName` como string), `rollDice`/`updateInventory`/`updateScene` (tools genéricas), `EventLog`, memória e `sceneState`.

### Discussão de modelo que motivou a segunda decisão

Ao alinhar a hierarquia, ficou claro que:

1. **A criação do personagem depende do sistema** — mas hoje `POST /characters` nasce **sem** `systemId`; o sistema só é conhecido depois, ao entrar numa campanha. Isso contradiz "atributos validados contra o sistema".
2. **"Campanha" e "aventura" são, no domínio, o mesmo conceito** — a história com uma missão principal. O schema atual carrega duas entidades (`Campaign` + `Adventure`) onde o produto enxerga uma. A `Campaign` só segura `systemId`, um nome, e agrupa `Adventure`s ordenadas.
3. **A continuidade entre aventuras mora no personagem** — mesmo com conexão narrativa entre histórias, o que liga é o personagem (ficha + memória, ver [ADR 002](./002-memoria-de-sessao.md)), não um agrupador acima dele.

---

## 2. Decisão

### D1 — Regra de sistema vira dado no `System`, consumido por endpoints genéricos

`System` ganha um `config Json?` (validado por Zod em `packages/shared`) que descreve **o schema de atributos** e **os kits iniciais** do sistema. Os endpoints genéricos passam a ler esse config em vez de constantes hardcoded:

- `POST /characters` valida os atributos com um **Zod dinâmico** montado a partir de `config.attributes`.
- `getStartingInventory` lê `config.startingKits` (com `default` como rede).

Forma do `config` (detalhe e alternativas em [US-21](../sdlc/01-requisitos/US-21-sistemas-como-dado.md)):

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

**Todo sistema tem classe.** Sistema sem classes formais define uma classe padrão única; o resolver de kit cai em `default` quando não casa. Nada de caso especial no código.

Por que `Json` + Zod (e não tabelas relacionais nem registry em código): um sistema **upado em runtime** (`sourceType: UPLOAD`, já no schema) tem que ser **dado**, não código; `Json` evita migração por sistema novo; o Zod devolve a type-safety que o `Json` cru perde. (Ver alternativas rejeitadas.)

### D2 — Hierarquia centrada no personagem; `Campaign` e `Adventure` colapsam

Hierarquia-alvo:

```
User 1─* Character ── systemId  (o personagem pertence a um sistema)
                   │
                   └─* Adventure   (a história = 1 missão principal;
                         │           antiga Campaign + Adventure fundidas)
                         ├ per-aventura: CharacterState, Quest, memorySummary, EventLog
                         └ order → sequência de aventuras do MESMO personagem
```

- **`Character` ganha `systemId`.** "Criação depende do sistema" passa a ser literal: o sistema é conhecido na criação e valida os atributos (D1). Ordem do setup **inverte**: *sistema → personagem → aventura*.
- **`Campaign` e `Adventure` fundem numa entidade só** (a "aventura" = história com missão). O `systemId` do personagem é a fonte de verdade; some a duplicação.
- **O personagem é o fio de continuidade** entre aventuras seguidas — cada aventura é uma história fechada, ligada pelas lembranças do personagem, não por um agrupador.
- **`CharacterState` continua por `(character, adventure)`** — granularidade correta; HP/inventário/cena reiniciam por aventura, o personagem-base persiste.
- **Multiplayer (Fase 4)** reintroduz um join personagem↔aventura no **nível da aventura** (o papel que o `CharacterSlot` tinha na campanha). Fora do escopo do MVP single-player.

### 2.1 Faseamento (as duas decisões são independentes)

| Fase | Entregável | Depende de |
|------|-----------|-----------|
| 1 | D1 — `System.config` + `Character.systemId` + validação dinâmica + kits por sistema + setup reordenado | — |
| 2 | D2 — colapso `Campaign`+`Adventure` numa entidade | Fase 1 (personagem já carrega o sistema) |

D1 entrega a reutilização (o requisito original) **sem** exigir o colapso: `Character.systemId` pode conviver com a `Campaign` atual (sistema derivado do personagem) até a Fase 2 remover a duplicação.

---

## 3. Decisões-chave e justificativas

| # | Decisão | Por quê |
|---|---------|---------|
| 1 | Config de sistema como `Json` no `System` | Sistema upado é dado de runtime, não código; sem migração por sistema novo |
| 2 | Validar o `Json` com Zod em `shared` | Recupera a type-safety que o `Json` cru perde; mesmo schema valida escrita e leitura |
| 3 | Zod dinâmico em `POST /characters` a partir do config | Um único endpoint serve qualquer conjunto de atributos, sem `if` por sistema |
| 4 | `Character.systemId` (personagem pertence ao sistema) | Torna "criação depende do sistema" verdadeira na hora certa (na criação) |
| 5 | Colapsar `Campaign`+`Adventure` | Produto enxerga um conceito só; remove entidade-casca e a duplicação de `systemId` |
| 6 | Continuidade no personagem, não em agrupador | Aventuras seguidas ligam-se pela ficha+memória do personagem (ADR 002) |
| 7 | Reusar `baseAttributes/attributes Json` já existentes | O banco já é flexível; a mudança é no contrato da API, não no armazenamento |
| 8 | D1 e D2 faseadas e independentes | Desacopla a reutilização (feature) da migração estrutural (risco maior) |

---

## 4. Alternativas rejeitadas

| Alternativa | Motivo da rejeição |
|-------------|-------------------|
| Config em **tabelas relacionais** (`SystemAttribute`, `SystemKit`) | Migração + joins para algo sempre lido por sistema inteiro; overkill no MVP |
| Config em **registry no código** (`Record<systemId, config>`) | Não serve sistema upado em runtime; adicionar sistema exigiria deploy |
| Duplicar regras de dado/HP dentro do `config` | `rollDice`/`updateCharacterHp` já são genéricos; YAGNI até um sistema quebrar isso |
| Manter `Campaign` **e** `Adventure` separadas | Duas entidades para um conceito; `Campaign` vira casca que só duplica `systemId` |
| `systemId` só na campanha (não no personagem) | Deixa a criação do personagem sem saber o sistema — não valida atributos na criação |
| Um agrupador de "saga" acima da aventura | Continuidade já vem do personagem; agrupador extra sem função no single-player (YAGNI) |

---

## 5. Consequências

**Positivas**
- Integrar um sistema novo = inserir `System` + `config`; controllers e serviços não mudam.
- Hierarquia bate com o modelo mental do produto (sistema → personagem → aventura).
- Some a duplicação de `systemId` e uma entidade inteira (`Campaign`) no single-player.
- Reaproveita armazenamento `Json` e memória já existentes.

**Negativas / riscos**
- D2 é migração estrutural com alcance amplo: setup, `campaign.controller/service`, `ai.service` (lê `adventure.campaign.system.name`), FKs `Adventure.campaignId`/`CharacterSlot`. Faseada e opcional face a D1 para conter o risco.
- `config` inválido/ausente num sistema quebra criação de personagem → o Zod de `config` e um `default` de kit são obrigatórios.
- O doc `docs/sdlc/02-design/modelo-de-dados.md` reflete a hierarquia antiga e precisa ser atualizado quando D2 for implementada.

---

## 6. Implementação (referência)

- `apps/api/src/character/character.controller.ts` — Zod fixo dos 6 atributos → Zod dinâmico via `config`.
- `apps/api/src/character/starting-inventory.ts` — tabela `KITS` hardcoded → `config.startingKits`.
- `apps/api/prisma/schema.prisma` — `System.config Json?`, `Character.systemId`; (D2) fusão `Campaign`/`Adventure`.
- `apps/api/src/ai/ai.service.ts` — `adventure.campaign.system.name` (D2: passa por `character.system`).
- `apps/web/src/components/setup/SetupWizard.tsx` — reordenar para *sistema → personagem → aventura*.
- `packages/shared/src/types/` — schema Zod do `System.config` (novo).
