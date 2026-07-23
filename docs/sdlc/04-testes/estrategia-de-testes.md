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
| Qualidade da narração (US-36, LLM-as-judge) | MÉDIA ≥ 3.5 (escala 1–5) |
| Piso por dimensão (US-70) | sensorial/tensão/concretude/língua pt-BR ≥ 3 |
| Taxa de slop de onomástica (US-70) | report-only (aviso > 50% das reps; não reprova até a produção reduzir o slop) |

PRs que reduzem qualquer métrica abaixo do threshold são bloqueados.

A métrica de qualidade da narração (US-36) é medida por LLM-as-judge (juiz Gemini,
externo à escada de narração) sobre a rubrica `DIMENSIONS` de
`packages/ai-engine/src/rubric.ts` — espelho da barra de ofício
(`NARRATIVE_CRAFT_SECTION` de `dm-system.ts`, US-34). O threshold vive em
`QUALITY_THRESHOLD` no mesmo arquivo. O caso `evals/cases/us-36-qualidade-narracao.ts`
é gated por `OPENROUTER_API_KEY` + `GEMINI_API_KEY`; o portão só vale no CI quando
o job exporta as duas chaves.

A US-70 deu **dente** ao gate: além da média, cada dimensão-chave tem um **piso**
próprio (`DIMENSION_FLOORS`, `≥ 3`) — um eixo colapsado reprova mesmo com média alta;
e o eval roda cada caso `JUDGE_REPS` (default 3) vezes e gateia sobre a **média das reps**
(`aggregateReps`), não um tiro único. A decisão de aprovação vive em `gateQuality()`
(pura, sem API), provada no `pnpm test` (`rubric.test.ts`). Um **anchor set** rotulado
valida que o juiz rankeia narrações boas acima das ruins por margem (detecta deriva do juiz).

O `slopRate` de onomástica é **report-only** por ora: a taxa-base do modelo (~40% nos
casos com muitos nomes) cola no `SLOP_RATE_MAX`, então gatear a REPS=3 seria *flaky*
(violaria a AC "não-flaky"). O slop é medido e avisado; vira gate quando a produção o
reduzir (US irmã de enforcement, fora do escopo desta US).

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
