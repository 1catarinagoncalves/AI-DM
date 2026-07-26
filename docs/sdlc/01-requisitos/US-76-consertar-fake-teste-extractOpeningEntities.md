# US-76 — Consertar fake de teste do US-75 (`extractOpeningEntities`)

**Épico:** 2 — Aventura
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** [US-75](./US-75-dimensao-de-proveniencia-no-ledger.md) (adicionou `AiService.extractOpeningEntities`, chamada em `createForCharacter`).
**Criada em:** 2026-07-25

---

## História

> **Como** dev do AI DM,
> **quero** que a suíte de `adventure.service.test.ts` volte a passar,
> **para que** o débito de teste deixado pelo US-75 em progresso não bloqueie a suíte nem esconda regressões reais.

---

## Contexto

O US-75 adicionou `AiService.extractOpeningEntities` (`apps/api/src/ai/ai.service.ts:940`) e passou a chamá-la em `AdventureService.createForCharacter` — num `Promise.all` ao lado de `extractOpeningScene` (`apps/api/src/adventure/adventure.service.ts:130-136`).

O fake de `AiService` no teste (`adventure.service.test.ts:10-18`) só mocka `generateOpeningNarration` e `extractOpeningScene`. Como o fake usa `as unknown as AiService`, o cast apaga a checagem de tipo e o método faltante só explode em runtime:

```
TypeError: this.ai.extractOpeningEntities is not a function
```

**6 testes falham** — exatamente os de `describe('AdventureService.createForCharacter')` que chegam à linha 135 (não os dois que rejeitam antes: hook incompatível e personagem inexistente; nem os de `getInitialAdventure`/`getTurns`, que não tocam o método).

É débito de teste puro — a lógica de produção do US-75 está correta.

---

## Escopo

### Dentro do escopo

- Adicionar `extractOpeningEntities` ao fake `fakeAi` (`adventure.service.test.ts:10-18`), default `async () => null` (preserva o comportamento pré-US-75: ledger vazio, sem tocar as asserções existentes).
- Opcional: aceitar um 3º parâmetro em `fakeAi` para devolver entidades e exercitar o caminho de semeadura do ledger (Erro 1 do US-75), espelhando como `scene` já faz para o US-35. Só se algum caso precisar afirmar a semeadura.

### Fora do escopo

- Qualquer alteração em `adventure.service.ts` ou `ai.service.ts` — a produção está correta.
- Testes novos de comportamento do ledger da abertura (isso é do US-75, se ainda faltar cobertura lá).

---

## Critérios de aceite

- [x] `fakeAi` inclui `extractOpeningEntities`, default `null`.
- [x] `pnpm --filter api exec vitest run src/adventure/adventure.service.test.ts` passa (0 falhas).
- [x] Nenhuma mudança em código de produção.

---

## Referências no código

- `apps/api/src/adventure/adventure.service.test.ts:10-18` — fake `fakeAi` a corrigir.
- `apps/api/src/adventure/adventure.service.ts:130-136` — `Promise.all` que chama `extractOpeningEntities`.
- `apps/api/src/ai/ai.service.ts:940` — definição do método (US-75).
