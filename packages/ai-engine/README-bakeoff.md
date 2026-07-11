# Bake-off narrativo (US-17) — como rodar

Runner standalone: `run-bakeoff.mjs`. Fora do vitest (o par `streamText`+vitest
pendurava e estourava o timeout). Gera `evals/reports/<data>-<tag>.md`.

## Pré-requisitos

- Chaves no `.env` da raiz do repo: `NVIDIA_API_KEY`, `GEMINI_API_KEY` (juiz),
  `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `OPENAI_API_KEY`.
- `node --env-file` NÃO sobrescreve variável já setada no ambiente do SO. Se uma
  chave estiver também nas Variáveis de Ambiente do Windows, ela mascara o `.env`.
  Remover a duplicata do SO (escopo Usuário): `[Environment]::SetEnvironmentVariable('NOME', $null, 'User')` e reabrir o terminal.
- Se editar `src/`, rebuildar antes (o runner importa `dist/`):
  `pnpm --filter @ai-dm/ai-engine build`.

## Rodar (PowerShell)

```powershell
cd "packages\ai-engine"
node --env-file=..\..\.env run-bakeoff.mjs          # trio NVIDIA default
```

## Variáveis

| env | efeito | default |
|---|---|---|
| `MODELS` | lista CSV de candidatos; prefixo roteia o provider | trio NVIDIA |
| `JUDGE_MODEL` | juiz; `openai:<id>` / `openrouter:<id>` / senão Google | `gemini-flash-latest` |
| `JUDGE_REPS` | repetições por caso (desempate de líderes) | 1 |
| `RUN_LABEL` | tag no nome do arquivo | auto (`nvidia`/`groq`/`openrouter`/`mixed`) |

Prefixos de `MODELS`: sem prefixo → NVIDIA NIM; `groq:` → Groq; `openrouter:` → OpenRouter.

```powershell
# exemplos
$env:MODELS="groq:openai/gpt-oss-120b,groq:llama-3.3-70b-versatile"; node --env-file=..\..\.env run-bakeoff.mjs
$env:MODELS="mistralai/mistral-large-3-675b-instruct-2512,z-ai/glm-5.2"; $env:JUDGE_REPS="3"; node --env-file=..\..\.env run-bakeoff.mjs
Remove-Item Env:MODELS,Env:JUDGE_MODEL,Env:JUDGE_REPS -ErrorAction SilentlyContinue   # limpar entre runs
```

## Notas

- Juiz: `gemini-flash-latest`/`gemini-3.5-flash` discriminam; `gpt-4o-mini` satura
  (tudo ~5.0); `*-pro` do Gemini têm quota-zero no free tier. `gpt-5-mini` exige
  verificação de org na OpenAI.
- Slugs NVIDIA validados: `mistralai/mistral-large-3-675b-instruct-2512`,
  `mistralai/mistral-small-4-119b-2603`, `z-ai/glm-5.2`. Confirmar novos via
  `GET https://integrate.api.nvidia.com/v1/models`.
- Free tier (NVIDIA preview per-model + Gemini flash) esgota após muitas rodadas
  no mesmo dia → 429/quota. Espaçar, ou `JUDGE_REPS=1` no primeiro pente.
- OpenRouter `:free` precisa de ~$10 de crédito na conta pra ter RPM utilizável.
```
