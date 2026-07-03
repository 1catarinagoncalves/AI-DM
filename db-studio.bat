@echo off
cd /d "%~dp0"
rem carrega variaveis do .env da raiz (tira aspas com %%~b)
for /f "usebackq eol=# tokens=1,* delims==" %%a in (".env") do set "%%a=%%~b"
pnpm --filter api exec prisma studio
pause
