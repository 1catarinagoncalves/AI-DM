@echo off
REM Launcher do quadro Kanban das user stories (US-31).
REM Abre o navegador e sobe o servidor local. Fecha esta janela para parar.
cd /d "%~dp0"
start "" http://127.0.0.1:5051
node kanban-server.js
pause
