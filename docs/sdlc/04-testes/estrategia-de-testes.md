# Estratégia de Testes e Evals — AI Dungeon Master

**Atualizado em:** 2026-06-27

---

## Princípio central

Seguindo o novo SDLC: **testes e evals são escritos antes do código de produção.**
Eles são o contrato com o agente — comunicam o que "correto" significa de forma
mais precisa do que qualquer prompt em linguagem natural.

---

## Camadas de teste

### 1. Testes unitários (apps/api, packages/ai-engine)

- Framework: **Vitest**
- Cobertura obrigatória:
  - `dice.service.ts` — todas as fórmulas de dados, edge cases (0 dados, modificador negativo)
  - Cálculo de HP, modificadores de atributo
  - Validação de CharacterStatePatch
- Sem mocks do banco; use banco SQLite em memória via Prisma

### 2. Testes de integração (apps/api)

- Framework: **Vitest + Supertest**
- Banco de teste PostgreSQL isolado (Docker Compose no CI)
- Cobre o loop completo: receber ação → executar tool → persistir → retornar estado
- Foco: idempotência das tools, integridade do EventLog, unicidade de CharacterSlot

### 3. Testes de componente (apps/web)

- Framework: **Vitest + Testing Library**
- Cobre: renderização da ficha, atualização de HP em tempo real, exibição de rolagem de dados
- Sem chamadas reais ao backend; use MSW para mock de API/WebSocket

### 4. Evals do DM Agent (evals/)

Avaliação da qualidade do agente de IA. **Estas são as mais críticas.**

#### Tipos de eval

| Tipo | O que mede |
|------|-----------|
| **Output eval** | O resultado final está correto? (narração coerente, state atualizado) |
| **Trajectory eval** | O agente chamou as tools certas na ordem certa? |
| **Rule eval** | O agente aplicou a regra correta para a ação descrita? |
| **Hallucination eval** | O agente inventou números, itens ou regras que não existem? |

#### Estrutura de um eval case (evals/cases/)

```typescript
{
  id: "us08-streaming-narration",
  description: "Narração chega em streaming após ação do jogador",
  story: "US-08",
  input: {
    adventureId: "test-adventure-1",
    characterId: "test-char-1",
    message: "Ataco o goblin com minha espada longa"
  },
  expectedTools: ["rollDice", "updateCharacterSheet", "addEventLog"],
  assertions: [
    "rollDice foi chamado com fórmula de ataque válida (1d20+mod)",
    "updateCharacterSheet foi chamado se o ataque acertou",
    "narração menciona resultado do dado",
    "narração não menciona valores de HP do goblin que não foram revelados"
  ]
}
```

#### Rodando evals

```bash
pnpm eval                    # todos os eval cases
pnpm eval --filter us-08     # eval de uma story específica
pnpm eval --ci               # modo CI (falha se score < threshold)
```

---

## Threshold de qualidade (CI)

| Métrica | Threshold mínimo |
|---------|-----------------|
| Tools corretas chamadas | 90% |
| Ausência de alucinação de regras | 95% |
| State persistido corretamente | 100% |
| Testes unitários passando | 100% |

PRs que reduzem qualquer métrica abaixo do threshold são bloqueados.

---

## Flywheel de qualidade (após MVP)

```
Executar evals → identificar falhas por categoria
   → ajustar prompts/tools/contexto que causaram a falha
   → verificar correção com suite de regressão
   → monitorar produção para novos modos de falha
   → adicionar novos eval cases baseados em falhas reais
```

Este ciclo é o mecanismo central de melhoria contínua do DM Agent.
