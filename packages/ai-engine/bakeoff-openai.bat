@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Bake-off OpenAI
set "MODELS=openai:gpt-4o-mini,openai:gpt-4.1-mini"
set "JUDGE_MODEL=gemini-3.1-flash-lite"
set "JUDGE_REPS=1"
set "PACE_MS=15000"
echo === Bake-off OpenAI (gpt-4o-mini + gpt-4.1-mini) ===
echo Custo aprox: gpt-4o-mini 0.15/0.60, gpt-4.1-mini 0.40/1.60 por 1M (in/out)
node --env-file=..\..\.env run-bakeoff.mjs
echo.
pause
