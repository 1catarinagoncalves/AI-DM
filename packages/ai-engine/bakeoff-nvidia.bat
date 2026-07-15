@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Bake-off NVIDIA
set "MODELS=mistralai/mistral-large-3-675b-instruct-2512,mistralai/mistral-small-4-119b-2603,z-ai/glm-5.2"
set "JUDGE_MODEL=gemini-3.1-flash-lite"
set "JUDGE_REPS=1"
set "PACE_MS=15000"
echo === Bake-off NVIDIA (trio validado) ===
node --env-file=..\..\.env run-bakeoff.mjs
echo.
pause
