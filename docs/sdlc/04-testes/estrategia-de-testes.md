# Estratégia de Testes e Evals — AI Dungeon Master

**Atualizado em:** 2026-07-29

> As camadas abaixo foram auditadas contra o repo em 29/07/2026 ([US-89](../01-requisitos/US-89-gate-de-codigo-morto-com-knip.md)).
> O que era desenho não construído (Supertest, banco em memória, MSW, Docker Compose)
> saiu ou está marcado como tal — doc que promete infraestrutura inexistente manda o
> leitor procurar o que não há.

---

## Princípio central

Seguindo o novo SDLC: **testes e evals são escritos antes do código de produção.**
Eles são o contrato com o agente — comunicam o que "correto" significa de forma
mais precisa do que qualquer prompt em linguagem natural.

---

## Camadas de teste

### 1. Testes unitários (todos os workspaces)

- Framework: **Vitest**, um `pnpm test` recursivo (`pnpm --recursive test`).
- Cobertura obrigatória:
  - `dice.service.ts` — todas as fórmulas de dados, edge cases (0 dados, modificador negativo)
  - Cálculo de HP, modificadores de atributo
  - Saneamento da narração e contratos de `packages/shared` (rolagem fictícia, degeneração,
    lista de opções)
- **Nenhum teste toca banco.** O Prisma é substituído por *fake class* nomeada no teste
  (`fakePrisma()` em `ai.service.test.ts`), como manda o `AGENTS.md`. Não há SQLite em
  memória nem container de Postgres — o CI roda com `DATABASE_URL` fictícia só para o
  `prisma.config.ts` carregar ([`ci.yml:16`](../../../.github/workflows/ci.yml)).

### 2. Testes de integração — não existem ainda

Nem Supertest, nem banco de teste, nem Docker Compose no CI: o loop
`ação → tool → persistir → estado` é coberto hoje só por unitário com Prisma falso.
Fechar essa camada exige decidir onde o banco de teste vive (US-80, questão em aberto #2)
— até lá, esta seção é lacuna conhecida, não plano em andamento.

### 3. Testes de componente (apps/web)

- Framework: **Vitest + Testing Library**, DOM via `happy-dom`.
- Cobre: renderização da ficha, fluxo de turno no chat, acessibilidade (`axe-core`).
- Sem chamadas reais ao backend: o módulo `@/lib/api` é mockado e o `fetch` do stream é
  substituído com `vi.stubGlobal` no próprio teste. Não usamos MSW.

### 4. Evals do DM Agent (evals/)

Avaliação da qualidade do agente de IA. **Estas são as mais críticas.**

#### Tipos de eval

| Tipo | O que mede | Hoje |
|------|-----------|------|
| **Output eval** | O resultado final está correto? (narração coerente, state atualizado) | ✅ é a maioria dos casos |
| **Hallucination eval** | O agente inventou números, itens ou regras que não existem? | ✅ US-29 (rolagem fictícia), US-42 (magia fora da lista) |
| **Trajectory eval** | O agente chamou as tools certas na ordem certa? | ❌ nenhum caso inspeciona `toolCalls` |
| **Rule eval** | O agente aplicou a regra correta para a ação descrita? | ❌ depende do RAG de regras, que não existe |

#### Estrutura de um eval case (evals/cases/)

Não há DSL própria: cada caso é um **arquivo de teste Vitest** nomeado pela US, rodado por
um config à parte (`packages/ai-engine/vitest.eval.config.ts`, que faz alias dos pacotes
para o `src`). O caso mistura parte determinística (roda sempre) com parte que chama LLM
(gated por chave de API).

```typescript
// evals/cases/us-29-rolagens.ts
import { describe, it, expect } from 'vitest'
import { stripFabricatedRolls } from '@ai-dm/shared'

describe('US-29 — saneador de rolagens', () => {
  it('remove total inventado da prosa', () => {
    const { clean } = stripFabricatedRolls('Com um total de 20 no teste de Percepção, você nota a sombra.')
    expect(clean).not.toMatch(/20/)
  })
})
```

**Gotcha registrado:** `import { … } from 'ai'` dentro de `evals/cases/` quebra a suíte —
a geração vive no pacote (`narration-gen.ts`), o caso só a consome.

#### Rodando evals

```bash
pnpm eval
```

Um caso só (o `pnpm eval` da raiz não repassa filtro — vá direto ao Vitest do pacote):

```bash
pnpm --filter ai-engine exec vitest run --config vitest.eval.config.ts us-29
```

Não há flag `--ci`: o gate É o `pnpm eval`, que reprova sozinho quando a qualidade cai
abaixo do threshold. Casos que dependem de LLM se auto-pulam sem as chaves
(`OPENROUTER_API_KEY`, `GEMINI_API_KEY`), então a suíte local roda sem segredo nenhum.

---

## Threshold de qualidade (CI)

| Métrica | Threshold mínimo | Onde é aplicado |
|---------|-----------------|-----------------|
| Testes unitários passando | 100% | `pnpm test` no CI |
| Qualidade da narração (US-36, LLM-as-judge) | MÉDIA ≥ 3.5 (escala 1–5) | `QUALITY_THRESHOLD` em `rubric.ts` |
| Piso por dimensão (US-70) | sensorial/tensão/concretude/língua pt-BR ≥ 3 | `DIMENSION_FLOORS` |
| Taxa de slop de onomástica (US-70) | report-only (aviso acima de `SLOP_RATE_MAX` = 0.5) | não reprova até a produção reduzir o slop |

Um PR que derrube qualquer métrica **desta tabela** abaixo do threshold é bloqueado pelo CI.
Percentuais de "tools corretas chamadas" e "state persistido" já figuraram aqui como meta e
foram removidos em 29/07/2026: nunca houve código que os medisse, e threshold que ninguém
calcula é promessa, não gate.

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
