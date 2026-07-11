# Bake-off narrativo — 2026-07-11

| modelo | Imersão | Sensorial | Agência | Voz NPC | Ritmo | Coerência | MÉDIA | spread | custo |
|---|---|---|---|---|---|---|---|---|---|


Guardrails: idioma OK · reasoning-leak: nenhum · rollDice: OK (1 reps × 5 cenários)
Sem candidatos.

## Por que vazio

Free tier do OpenRouter inutilizável sem crédito na conta. Os 5 candidatos (`meta-llama/llama-3.3-70b-instruct:free`, `qwen/qwen3-next-80b-a3b-instruct:free`, `openai/gpt-oss-120b:free`, `nousresearch/hermes-3-llama-3.1-405b:free`, `cognitivecomputations/dolphin-mistral-24b-venice-edition:free`) falharam em todas as 25 gerações:

- **`Rate limit exceeded: limit_rpm`** — modelos `:free` limitados a RPM ~zero sem ≥$10 de crédito (política OpenRouter: sem crédito = 50 req/dia + RPM mínimo).
- **`Provider returned error`** — endpoints upstream free sobrecarregados/instáveis.
- **`No endpoints support tool use`** — hermes-405b e dolphin-venice não fazem tool calling (só afeta o cenário de combate; corrigido no runner: tool só no combate).

Para rodar: adicionar crédito no OpenRouter (destrava RPM) — vale sobretudo pelos 2 genuinamente novos (hermes-405b uncensored, dolphin-venice RPG-friendly). Os outros 3 já rodam via NVIDIA (ver `2026-07-11-nvidia.md`).
