@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Bake-off OpenRouter
set "MODELS=openrouter:meta-llama/llama-3.3-70b-instruct:free,openrouter:qwen/qwen3-next-80b-a3b-instruct:free,openrouter:openai/gpt-oss-120b:free,openrouter:nousresearch/hermes-3-llama-3.1-405b:free,openrouter:cognitivecomputations/dolphin-mistral-24b-venice-edition:free"
set "JUDGE_MODEL=gemini-3-flash-preview"
set "JUDGE_REPS=1"
set "PACE_MS=15000"
echo === Bake-off OpenRouter (5 modelos free - precisa credito na conta p/ RPM) ===
node --env-file=..\..\.env run-bakeoff.mjs
echo.
pause
