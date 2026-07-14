@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Bake-off Groq
set "MODELS=groq:openai/gpt-oss-120b,groq:llama-3.3-70b-versatile"
set "JUDGE_MODEL=gemini-3-flash-preview"
set "JUDGE_REPS=1"
set "PACE_MS=15000"
echo === Bake-off Groq (incumbente gpt-oss-120b + llama-3.3-70b) ===
node --env-file=..\..\.env run-bakeoff.mjs
echo.
pause
