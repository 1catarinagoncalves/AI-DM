# Evals — AI Dungeon Master

Suite de avaliação do DM Agent. Mede qualidade, correção e comportamento do agente de IA.

## Por que evals existem

Seguindo o novo SDLC: evals são escritos *antes* do código de produção.
São o contrato formal do que "correto" significa para o DM Agent.
Sem evals passando, nenhum PR que toca o AI Engine pode ser mergeado.

## Estrutura

```
evals/
  cases/          — eval cases por user story
    us-08-streaming.ts
    us-09-dice-roll.ts
    us-10-rules.ts
    us-11-natural-language.ts
  fixtures/       — dados de teste reutilizáveis (personagens, aventuras, estados)
  runner.ts       — executor dos evals
  scorer.ts       — lógica de pontuação e threshold
```

## Comandos

```bash
pnpm eval                    # todos os casos
pnpm eval --filter us-09     # filtrar por story
pnpm eval --ci               # modo CI (exit 1 se abaixo do threshold)
pnpm eval --verbose          # exibe detalhes de cada caso
```

## Adicionando um novo eval case

1. Crie `evals/cases/<story-id>-<descricao>.ts`
2. Exporte um objeto `EvalCase` com: `id`, `description`, `story`, `input`, `expectedTools`, `assertions`
3. Rode `pnpm eval --filter <story-id>` para validar localmente
4. O novo caso é incluído automaticamente no CI

## Thresholds mínimos (configurados em scorer.ts)

| Métrica | Mínimo |
|---------|--------|
| Tools corretas chamadas | 90% |
| Ausência de alucinação de regras | 95% |
| State persistido corretamente | 100% |

Ver estratégia completa em `docs/sdlc/04-testes/estrategia-de-testes.md`.
