@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Bake-off OpenRouter v2
rem ATENCAO: este arquivo e ASCII PURO de proposito. Nada de acento, travessao ou
rem simbolo fora do ASCII, nem em comentario. O cmd.exe guarda a posicao de leitura
rem em BYTES: com chcp 65001 um char multi-byte desalinha o offset, o parser volta
rem no meio da linha e executa lixo como comando -- e chega a ENGOLIR a linha
rem seguinte (foi assim que o set MODELS sumiu e a rodada caiu no DEFAULT_MODELS).
rem
rem 2 candidatos OpenRouter (ambos com tool-use) + gpt-oss-120b NO OPENROUTER como
rem linha de base. Sem base na mesma rodada a nota nao diz nada: o juiz LLM calibra
rem COMPARANDO as narracoes lado a lado no mesmo batch.
rem A base e o mesmo MODELO da producao, mas servido pelo OpenRouter em vez do Groq
rem - provider unico isola qualidade-do-modelo de infra/roteamento.
rem Sem espera entre chamadas (PACE_MS=0) - se voltar 429, subir de novo.
set "MODELS=openrouter:nex-agi/nex-n2-mini,openrouter:xiaomi/mimo-v2.5,openrouter:openai/gpt-oss-120b"
set "JUDGE_MODEL=gemini-3.1-flash-lite"
rem 3 reps: cada (modelo x cenario) roda 3x. O juiz custa cenarios x reps = 15
rem chamadas - de olho na quota diaria do Gemini free.
set "JUDGE_REPS=3"
set "PACE_MS=0"
set "RUN_LABEL=openrouter-v2"
echo === Bake-off OpenRouter v2 (2 candidatos + base openrouter/gpt-oss-120b) ===
echo Preco in/out por 1M: nex-n2-mini 0.025/0.10 ^| mimo-v2.5 0.14/0.28 ^| gpt-oss-120b 0.037/0.17 (base)
echo 3 modelos x 5 cenarios x 3 reps = 45 geracoes + 15 chamadas ao juiz. Sem pace: ~6-8 min.
echo Precisa credito na conta OpenRouter.
node --env-file=..\..\.env run-bakeoff.mjs
echo.
pause
